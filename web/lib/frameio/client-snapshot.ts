/**
 * Client Brand Snapshot agent — Step 1 of the ad-copy pipeline.
 *
 * Before the copywriter agent ever runs, this builds (or reuses) a
 * structured ~200-word brand profile from everything we know about the
 * client. The copywriter then treats the snapshot as authoritative
 * context rather than re-inferring a brand identity from the asset
 * filename on every run.
 *
 * Sources synthesised:
 *   - clients row (name, vertical, aliases, status)
 *   - client_notes (last 20 by recency, grouped by category)
 *   - brand_hub presence (file count, guidelines flag)
 *   - meta_insights top 5 ads (last 60d, by leads / CTR)
 *   - last 3 ad_copy_md values (what we've already produced for them)
 *   - last 5 ad_copy_rejections reasons (what we've been told NOT to do)
 *   - current asset's transcript (when video + cached)
 *
 * Cached 7 days per scope_key. Manual refresh forces rebuild.
 * For unmapped projects: scope_key = project:<projectId>, confidence is
 * 'best_guess' or 'unmapped' (low), and the snapshot is explicit about
 * what's missing so the copywriter doesn't fabricate.
 */
import Anthropic from '@anthropic-ai/sdk';
import { db, rows } from '../queries/base.js';
import { listNotes, type ClientNoteRow } from '../queries/client-notes.js';
import { getTopMetaAdsForClient } from '../queries/meta-ads-history.js';
import { getRecentRejectionLessons } from '../queries/ad-copy-rejections.js';
import {
  getSnapshot,
  isFresh,
  scopeKeyFor,
  upsertSnapshot,
  type BrandSnapshot,
  type SnapshotConfidence,
} from '../queries/client-snapshots.js';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 900;

export interface SnapshotBuildInput {
  /** Mapped client id, when known. */
  clientId: number | null;
  /** Display name — '(unmapped)' for unmapped scope. */
  clientName: string;
  /** Frame.io project id — required when clientId is null. */
  projectId: string | null;
  /** Asset name + Frame.io project name help the model orient for unmapped. */
  assetName?: string | null;
  projectName?: string | null;
  /** Optional transcript text for the current asset. */
  transcript?: string | null;
  /** Optional review id that triggered this build (for audit). */
  reviewId?: number | null;
  /** Who triggered this build — null for auto, email for manual refresh. */
  refreshedBy?: string | null;
}

export interface SnapshotResult {
  ok: true;
  snapshot: BrandSnapshot;
  cached: boolean;
}
export interface SnapshotError {
  ok: false;
  reason: string;
}

let _anthropic: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic();
  return _anthropic;
}

interface ClientRow {
  id: number;
  name: string;
  display_name: string | null;
  vertical: string | null;
  aliases: string | null;
  status: string | null;
}

interface BrandHubRow { file_count: number; has_guidelines: number }

interface PastAdCopyRow { client_name: string; asset_name: string; ad_copy_md: string; ad_copy_generated_at: string }

async function loadClientRow(clientId: number): Promise<ClientRow | null> {
  try {
    const r = await rows<ClientRow>(
      `SELECT id, name, display_name, vertical, aliases, status
         FROM clients WHERE id = ? LIMIT 1`,
      [clientId],
    );
    return r[0] ?? null;
  } catch { return null; }
}

async function loadBrandHub(clientId: number): Promise<{ fileCount: number; hasGuidelines: boolean }> {
  try {
    const r = await rows<BrandHubRow>(
      `SELECT COUNT(*) AS file_count,
              SUM(CASE WHEN category = 'guidelines' THEN 1 ELSE 0 END) AS has_guidelines
         FROM brand_hub WHERE client_id = ?`,
      [clientId],
    );
    const row = r[0];
    return { fileCount: row?.file_count ?? 0, hasGuidelines: (row?.has_guidelines ?? 0) > 0 };
  } catch {
    return { fileCount: 0, hasGuidelines: false };
  }
}

async function loadPastAdCopy(clientName: string, limit = 3): Promise<PastAdCopyRow[]> {
  try {
    return await rows<PastAdCopyRow>(
      `SELECT client_name, asset_name, ad_copy_md, ad_copy_generated_at
         FROM creative_reviews
        WHERE client_name = ? AND ad_copy_md IS NOT NULL
        ORDER BY ad_copy_generated_at DESC
        LIMIT ?`,
      [clientName, limit],
    );
  } catch { return []; }
}

// -------------------------------------------------------------------------
// Prompt construction
// -------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are the Brand Intelligence agent for Vendo Digital, a UK marketing agency.

Your job: synthesise everything Vendo knows about a client into a compact, authoritative brand profile that will be fed into downstream Meta ad copywriting prompts. The copywriter treats your output as the ground-truth source on who this client is — so be specific, cite the data you used, and surface uncertainty plainly.

Output **ONLY** Markdown matching this exact structure (omit lines where you have no information — never invent):

## <Client display name>
**Business model:** <what they sell, to whom, positioning>
**Target market:** <demographics, geography, intent stage>
**Brand voice:** <tone, vocabulary preferences, things to avoid in language>
**Key USPs:** <pulled from notes + past winning ads — what genuinely differentiates them>
**Things to avoid:** <pulled from rejection lessons + gotcha notes — explicit no-go words, claims, angles>
**Proven angles:** <pulled from past winning Meta ads — hooks that have worked>
**Open questions:** <what we don't know that would sharpen future copy>

**Confidence:** mapped | best_guess | unmapped

Rules (strict):
- Do NOT fabricate. If a section has no evidence, write "Unknown — needs sales/AM input" or omit it.
- Cite the source inline in parentheses when useful, e.g. "**Brand voice:** Warm, never gimmicky (from gotcha note 2026-04)."
- For UNMAPPED projects: be explicit about what you can infer from the asset name / project name vs what's genuinely missing. Start the profile with "⚠ Unmapped — best guess only based on <signals>."
- UK English only.
- ~200 words max. Aim for density, not length.
- Output only the Markdown — no preamble, no commentary.`;

function buildUserPrompt(opts: {
  clientName: string;
  clientRow: ClientRow | null;
  notes: ClientNoteRow[];
  brandHub: { fileCount: number; hasGuidelines: boolean };
  topMetaWinners: Array<{ ad_name: string; spend: number; leads: number; ctr: number; campaign_name: string | null }>;
  pastAdCopy: PastAdCopyRow[];
  rejectionLessons: string[];
  assetName?: string | null;
  projectName?: string | null;
  transcript?: string | null;
  confidence: SnapshotConfidence;
}): string {
  const sections: string[] = [];
  sections.push(`Synthesise the brand profile for: ${opts.clientName} (confidence: ${opts.confidence})`);

  if (opts.clientRow) {
    sections.push(
      [
        `CLIENTS TABLE:`,
        `  name: ${opts.clientRow.name}`,
        opts.clientRow.display_name ? `  display: ${opts.clientRow.display_name}` : null,
        opts.clientRow.vertical ? `  vertical: ${opts.clientRow.vertical}` : null,
        opts.clientRow.aliases ? `  aliases: ${opts.clientRow.aliases}` : null,
        opts.clientRow.status ? `  status: ${opts.clientRow.status}` : null,
      ].filter(Boolean).join('\n'),
    );
  } else {
    sections.push(`CLIENTS TABLE: no row — this scope is unmapped.`);
  }

  if (opts.notes.length > 0) {
    const grouped: Record<string, string[]> = {};
    for (const n of opts.notes) {
      const cat = n.category || 'context';
      grouped[cat] = grouped[cat] || [];
      grouped[cat].push(`- ${n.body.trim().replace(/\s+/g, ' ').slice(0, 240)}`);
    }
    const block = Object.entries(grouped)
      .map(([cat, lines]) => `  [${cat}]\n${lines.map((l) => '    ' + l).join('\n')}`)
      .join('\n');
    sections.push(`CLIENT NOTES (tribal knowledge):\n${block}`);
  } else {
    sections.push(`CLIENT NOTES: none`);
  }

  sections.push(
    `BRAND HUB: ${opts.brandHub.fileCount} file(s)${opts.brandHub.hasGuidelines ? ', guidelines present' : ''}`,
  );

  if (opts.topMetaWinners.length > 0) {
    const wins = opts.topMetaWinners
      .map((w) => `  - "${w.ad_name}" — £${w.spend.toFixed(0)} spend, ${w.leads} leads, ${w.ctr.toFixed(2)}% CTR${w.campaign_name ? ` (campaign: ${w.campaign_name})` : ''}`)
      .join('\n');
    sections.push(`TOP PERFORMING META ADS (last 60d):\n${wins}`);
  } else {
    sections.push(`TOP PERFORMING META ADS: no ad-level data on file.`);
  }

  if (opts.pastAdCopy.length > 0) {
    const past = opts.pastAdCopy
      .map((p) => `  --- ${p.asset_name} (${p.ad_copy_generated_at.slice(0, 10)}) ---\n${p.ad_copy_md.slice(0, 1200)}`)
      .join('\n\n');
    sections.push(`PAST AD COPY WE'VE PRODUCED FOR THIS CLIENT (most recent first):\n${past}`);
  }

  if (opts.rejectionLessons.length > 0) {
    sections.push(`PAST REJECTION REASONS (things the team has rejected before):\n${opts.rejectionLessons.map((l) => `  - ${l}`).join('\n')}`);
  }

  if (opts.assetName) sections.push(`CURRENT ASSET NAME: ${opts.assetName}`);
  if (opts.projectName) sections.push(`FRAME.IO PROJECT NAME: ${opts.projectName}`);
  if (opts.transcript) {
    const t = opts.transcript.length > 3000 ? opts.transcript.slice(0, 3000) + '...[truncated]' : opts.transcript;
    sections.push(`CURRENT ASSET TRANSCRIPT (helps orient the brand if other context is sparse):\n${t}`);
  }

  sections.push(`Build the profile. UK English. Stick to the exact Markdown structure. Be specific. Surface gaps as "Unknown" rather than guessing.`);

  return sections.join('\n\n');
}

// -------------------------------------------------------------------------
// Orchestrator
// -------------------------------------------------------------------------

/**
 * Determine confidence from inputs.
 */
function determineConfidence(clientId: number | null, signalCount: number): SnapshotConfidence {
  if (clientId) return 'mapped';
  return signalCount >= 2 ? 'best_guess' : 'unmapped';
}

export async function getOrBuildClientSnapshot(input: SnapshotBuildInput): Promise<SnapshotResult | SnapshotError> {
  const scopeKey = scopeKeyFor(input.clientId, input.projectId);
  if (!scopeKey) return { ok: false, reason: 'no_scope_resolvable' };

  // Cache-first
  if (!input.refreshedBy) {
    const cached = await getSnapshot(scopeKey);
    if (cached && isFresh(cached)) {
      return { ok: true, snapshot: cached, cached: true };
    }
  }

  // Gather inputs in parallel
  const [clientRow, notes, brandHub, topMetaWinners, pastAdCopy, rejectionLessons] = await Promise.all([
    input.clientId ? loadClientRow(input.clientId) : Promise.resolve(null),
    input.clientId ? listNotes(input.clientId).catch(() => [] as ClientNoteRow[]) : Promise.resolve([] as ClientNoteRow[]),
    input.clientId ? loadBrandHub(input.clientId) : Promise.resolve({ fileCount: 0, hasGuidelines: false }),
    input.clientId ? getTopMetaAdsForClient(input.clientId, 60, 5) : Promise.resolve([]),
    loadPastAdCopy(input.clientName, 3),
    input.clientId ? getRecentRejectionLessons(input.clientId, 5) : Promise.resolve([] as string[]),
  ]);

  const signalCount = (notes.length > 0 ? 1 : 0) + (brandHub.fileCount > 0 ? 1 : 0)
    + (topMetaWinners.length > 0 ? 1 : 0) + (pastAdCopy.length > 0 ? 1 : 0)
    + (input.transcript ? 1 : 0);
  const confidence = determineConfidence(input.clientId, signalCount);

  const userPrompt = buildUserPrompt({
    clientName: input.clientName,
    clientRow,
    notes,
    brandHub,
    topMetaWinners: topMetaWinners.map((w) => ({
      ad_name: w.ad_name, spend: w.spend, leads: w.leads, ctr: w.ctr, campaign_name: w.campaign_name,
    })),
    pastAdCopy,
    rejectionLessons,
    assetName: input.assetName,
    projectName: input.projectName,
    transcript: input.transcript,
    confidence,
  });

  let snapshotMd: string;
  try {
    const resp = await anthropic().messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const block = resp.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') return { ok: false, reason: 'no_text_block' };
    snapshotMd = block.text.trim();
  } catch (err) {
    return { ok: false, reason: `anthropic_error: ${(err as Error).message ?? String(err)}` };
  }

  const sourceSummary = {
    clientId: input.clientId,
    notes: notes.length,
    brandHubFiles: brandHub.fileCount,
    brandHubGuidelines: brandHub.hasGuidelines,
    metaWinners: topMetaWinners.length,
    pastAdCopy: pastAdCopy.length,
    rejectionLessons: rejectionLessons.length,
    transcript: input.transcript ? input.transcript.length : 0,
    confidence,
  };

  const snapshot = await upsertSnapshot({
    clientId: input.clientId,
    clientName: input.clientName,
    scopeKey,
    snapshotMd,
    confidence,
    sourceSummary,
    refreshedBy: input.refreshedBy ?? null,
    generationReviewId: input.reviewId ?? null,
  });

  return { ok: true, snapshot, cached: false };
}

/**
 * When an unmapped project becomes mapped to a client, discard the old
 * unmapped snapshot so the next generation rebuilds under the new scope.
 * Returns the deleted scope_key (or null if nothing to delete).
 */
export async function dropUnmappedSnapshot(projectId: string): Promise<string | null> {
  const scopeKey = `project:${projectId}`;
  await db.execute({
    sql: `DELETE FROM client_brand_snapshots WHERE scope_key = ?`,
    args: [scopeKey],
  });
  return scopeKey;
}
