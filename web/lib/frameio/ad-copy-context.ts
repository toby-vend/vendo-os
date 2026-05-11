/**
 * Pure context aggregator for the Frame.io → Meta Ad Copy flow.
 *
 * Loads everything `generateAdCopyForReview()` needs to build a grounded
 * prompt: the review row, the matched client, parsed comments, brand voice
 * (client_notes + brand_hub presence), and the top performing Meta ads for
 * the client over the last 60 days.
 *
 * Transcripts and rejection lessons are reserved fields populated by later
 * commits in this iteration (`transcribe.ts`, `ad-copy-rejections.ts`).
 *
 * Intentionally side-effect free so it's trivial to unit-test without
 * mocking Anthropic.
 */
import { db, rows, scalar } from '../queries/base.js';
import { listNotes, type ClientNoteRow } from '../queries/client-notes.js';
import { getTopMetaAdsForClient, type MetaWinnerRow } from '../queries/meta-ads-history.js';
import { getRecentRejectionLessons } from '../queries/ad-copy-rejections.js';
import { getOrCreateTranscript } from './transcribe.js';
import { getOrBuildClientSnapshot } from './client-snapshot.js';
import type { BrandSnapshot } from '../queries/client-snapshots.js';

export interface ReviewRow {
  id: number;
  client_name: string;
  asset_name: string;
  asset_type: string;
  feedback: string | null;
  frameio_view_url: string | null;
  frameio_file_id: string | null;
  frameio_project_id: string | null;
}

export interface ClientRow {
  id: number;
  name: string;
  aliases: string | null;
  vertical: string | null;
}

export interface AdCopyContext {
  review: ReviewRow;
  client: ClientRow | null;
  /**
   * Step 1 output — synthesised brand profile. Authoritative source on
   * "who is this client" for the copywriter agent. Built fresh once per
   * 7 days per scope, then cached. Null only on build failure.
   */
  snapshot: BrandSnapshot | null;
  /** Bullet-ready client comments parsed from the newline audit trail. */
  comments: string[];
  /** Most recent client_notes for this client, capped, grouped client-side. */
  brandNotes: ClientNoteRow[];
  /** Whether the client has any files in brand_hub (signal that guidelines exist). */
  brandHubHasGuidelines: boolean;
  /** Top performing Meta ads over the last 60 days for this client. */
  topMetaWinners: MetaWinnerRow[];
  /** Whisper transcript — populated in commit 7. */
  transcript: { text: string; language: string | null; durationSeconds: number | null } | null;
  /** Recent rejection reasons — populated in commit 4. */
  rejectionLessons: string[];
}

/** Brand-voice note cap — total chars after rendering, not raw rows. */
export const BRAND_NOTES_CHAR_BUDGET = 1500;
const BRAND_NOTES_MAX_ROWS = 12;

/** How many days back to look for past Meta winners. */
const META_WINDOW_DAYS = 60;
const META_WINNERS_LIMIT = 3;

/** How many recent rejection reasons to feed back into the next prompt. */
const REJECTION_LESSONS_LIMIT = 5;

/**
 * Hard cap on transcript text inside the user prompt. ~6000 chars ≈
 * 1500 tokens — generous enough for a 60-90s ad, short enough to leave
 * room for the rest of the context.
 */
const TRANSCRIPT_CHAR_CAP = 6000;

/**
 * Heuristic clean of the feedback trail into a list of bullet points.
 * Mirrors the behaviour we inlined in `ad-copy.ts:96-102` before this
 * iteration moved it out.
 */
export function parseComments(feedback: string | null): string[] {
  if (!feedback) return [];
  return feedback
    .split('\n')
    .map((line) => line.replace(/^\[[^\]]+\]\s*/, '').trim())
    .filter(Boolean);
}

async function loadReview(reviewId: number): Promise<ReviewRow | null> {
  const r = await db.execute({
    sql: `SELECT id, client_name, asset_name, asset_type, feedback,
                 frameio_view_url, frameio_file_id, frameio_project_id
            FROM creative_reviews WHERE id = ?`,
    args: [reviewId],
  });
  return (r.rows[0] as unknown as ReviewRow | undefined) ?? null;
}

async function loadClientByName(name: string): Promise<ClientRow | null> {
  const r = await db.execute({
    sql: 'SELECT id, name, aliases, vertical FROM clients WHERE name = ? LIMIT 1',
    args: [name],
  });
  return (r.rows[0] as unknown as ClientRow | undefined) ?? null;
}

async function loadBrandHubPresence(clientId: number): Promise<boolean> {
  try {
    const count = await scalar<number>(
      `SELECT COUNT(*) FROM brand_hub WHERE client_id = ?`,
      [clientId],
    );
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}

async function loadBrandNotes(clientId: number): Promise<ClientNoteRow[]> {
  try {
    const all = await listNotes(clientId);
    return all.slice(0, BRAND_NOTES_MAX_ROWS);
  } catch {
    return [];
  }
}

/**
 * Look up the Frame.io project's display name from the library mirror —
 * used as an orienting signal for the snapshot agent on unmapped projects
 * (where the project name often hints at the client identity).
 */
async function loadProjectName(projectId: string | null): Promise<string | null> {
  if (!projectId) return null;
  try {
    return await scalar<string>(
      `SELECT name FROM frameio_assets WHERE id = ? AND type = 'project' LIMIT 1`,
      [projectId],
    );
  } catch {
    return null;
  }
}

/**
 * Resolve the Frame.io account_id for a given project, since transcribe.ts
 * needs both. The mapping is cached in frameio_projects (populated when
 * the cron processor encounters a project for the first time).
 */
async function resolveAccountIdForProject(projectId: string | null): Promise<string | null> {
  if (!projectId) return null;
  try {
    return await scalar<string>(
      `SELECT account_id FROM frameio_projects WHERE project_id = ? LIMIT 1`,
      [projectId],
    );
  } catch {
    return null;
  }
}

/** Fetch + truncate transcript for a video asset. Null on any failure. */
async function loadTranscript(
  reviewAssetType: string,
  fileId: string | null,
  projectId: string | null,
): Promise<AdCopyContext['transcript']> {
  if (reviewAssetType !== 'video' || !fileId) return null;
  const accountId = await resolveAccountIdForProject(projectId);
  if (!accountId) return null;
  const result = await getOrCreateTranscript(accountId, fileId);
  if (!result.ok || !result.transcript) return null;
  const text = result.transcript.length > TRANSCRIPT_CHAR_CAP
    ? `${result.transcript.slice(0, TRANSCRIPT_CHAR_CAP)}\n[truncated — ${result.transcript.length - TRANSCRIPT_CHAR_CAP} chars omitted]`
    : result.transcript;
  return { text, language: result.language, durationSeconds: result.durationSeconds };
}

/**
 * Assemble everything the ad-copy generator needs in one structured shape.
 * Returns null if the review row itself is missing — the generator should
 * surface this as `review_not_found`.
 */
export async function buildAdCopyContext(reviewId: number): Promise<AdCopyContext | null> {
  const review = await loadReview(reviewId);
  if (!review) return null;

  const client = await loadClientByName(review.client_name);
  const projectName = await loadProjectName(review.frameio_project_id);

  // STEP 1: Client Brand Snapshot — synthesised once per scope per 7 days.
  // The snapshot agent is also responsible for unmapped-project best-guess
  // identification. Runs in parallel with the per-asset queries below —
  // for cache hits this is effectively free; for cache misses it adds
  // ~5-8s of Sonnet latency that overlaps with the transcript fetch.
  //
  // STEP 2: Per-asset/per-client raw inputs (brand notes, past winners,
  // rejection lessons, transcript). Still passed to the copywriter so it
  // can quote specifics — the snapshot orients, these ground.
  const [snapshotResult, brandNotes, brandHubHasGuidelines, topMetaWinners, rejectionLessons, transcript] = await Promise.all([
    getOrBuildClientSnapshot({
      clientId: client?.id ?? null,
      clientName: review.client_name,
      projectId: review.frameio_project_id,
      assetName: review.asset_name,
      projectName,
      transcript: null,
      reviewId: review.id,
      refreshedBy: null,
    }),
    client ? loadBrandNotes(client.id) : Promise.resolve([] as ClientNoteRow[]),
    client ? loadBrandHubPresence(client.id) : Promise.resolve(false),
    client
      ? getTopMetaAdsForClient(client.id, META_WINDOW_DAYS, META_WINNERS_LIMIT)
      : Promise.resolve([] as MetaWinnerRow[]),
    client
      ? getRecentRejectionLessons(client.id, REJECTION_LESSONS_LIMIT)
      : Promise.resolve([] as string[]),
    loadTranscript(review.asset_type, review.frameio_file_id, review.frameio_project_id),
  ]);

  return {
    review,
    client,
    snapshot: snapshotResult.ok ? snapshotResult.snapshot : null,
    comments: parseComments(review.feedback),
    brandNotes,
    brandHubHasGuidelines,
    topMetaWinners,
    transcript,
    rejectionLessons,
  };
}

/** Render brand notes for the LLM prompt under the char budget. */
export function renderBrandNotesBlock(notes: ClientNoteRow[], hasGuidelines: boolean): string {
  if (notes.length === 0 && !hasGuidelines) return '';
  const lines: string[] = [];
  if (hasGuidelines) lines.push('(Brand guidelines are on file in Brand Hub.)');
  let used = lines.join('\n').length;
  for (const n of notes) {
    const body = n.body.trim().replace(/\s+/g, ' ');
    const line = `- [${n.category}] ${body}`;
    if (used + line.length + 1 > BRAND_NOTES_CHAR_BUDGET) break;
    lines.push(line);
    used += line.length + 1;
  }
  return lines.join('\n');
}

/** Render past-winners block. Short — five lines max. */
export function renderMetaWinnersBlock(winners: MetaWinnerRow[]): string {
  if (winners.length === 0) return '';
  return winners
    .map((w) => {
      const parts = [
        `"${w.ad_name}"`,
        `£${w.spend.toFixed(0)} spend`,
        `${w.leads} leads`,
        `${w.ctr.toFixed(2)}% CTR`,
      ];
      const campaign = w.campaign_name ? ` (campaign: ${w.campaign_name})` : '';
      return `- ${parts.join(', ')}${campaign}`;
    })
    .join('\n');
}

// Internal helper kept for parity with the previous ad-copy.ts; re-exported
// so callers don't have to import `rows` directly.
export { rows };
