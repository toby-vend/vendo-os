import Anthropic from '@anthropic-ai/sdk';
import { db } from '../queries/base.js';
import { recordRejection } from '../queries/ad-copy-rejections.js';
import {
  buildAdCopyContext,
  renderBrandNotesBlock,
  renderMetaWinnersBlock,
  type AdCopyContext,
} from './ad-copy-context.js';
import { createAdCopyAsanaTask } from './asana-handoff.js';

/**
 * Phase 5 — generate Meta ad copy from a Frame.io creative-review row.
 *
 * Inputs we have today:
 *   - asset name + type (from the creative_review row)
 *   - all client comments on the asset (creative_reviews.feedback, the
 *     newline-delimited audit trail from Phase 2)
 *   - client name (already mapped from the Frame.io project)
 *   - client brand context — name, vertical, aliases (from `clients`)
 *
 * What we don't have yet (deferred):
 *   - actual transcript (Frame.io V4 has no transcript API; would need
 *     to download the asset and run Whisper. Tracked as a follow-up).
 *
 * Output: structured markdown matching the existing meta-ad-copy skill
 * convention. Stored on `creative_reviews.ad_copy_md` and surfaced on
 * the /dashboards/frame-io view.
 */

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 2400;

let schemaEnsured = false;

/**
 * Idempotent migrations for the ad-copy columns on creative_reviews.
 *
 * Each ALTER is wrapped individually — one column's failure must not abort
 * the rest. Matches the convention in processor.ts:55-66.
 *
 * Columns added across iterations:
 *   Phase 5: ad_copy_md, ad_copy_generated_at, ad_copy_objective
 *   Phase 6: ad_copy_status, ad_copy_approved_*, ad_copy_rejected_*,
 *            ad_copy_rejection_reason, ad_copy_asana_task_gid
 */
async function ensureSchema(): Promise<void> {
  if (schemaEnsured) return;
  const cols: string[] = [
    // Phase 5
    'ad_copy_md TEXT',
    'ad_copy_generated_at TEXT',
    'ad_copy_objective TEXT',
    // Phase 6 — approval gate
    "ad_copy_status TEXT DEFAULT 'draft'",
    'ad_copy_approved_at TEXT',
    'ad_copy_approved_by TEXT',
    'ad_copy_rejected_at TEXT',
    'ad_copy_rejected_by TEXT',
    'ad_copy_rejection_reason TEXT',
    // Phase 6 — Asana hand-off (distinct from the existing asana_task_gid
    // column on creative_reviews, which is reserved for review-task tracking)
    'ad_copy_asana_task_gid TEXT',
  ];
  for (const col of cols) {
    try { await db.execute(`ALTER TABLE creative_reviews ADD COLUMN ${col}`); } catch { /* exists */ }
  }
  schemaEnsured = true;
}

export interface AdCopyInput {
  reviewId: number;
  /** Optional override; defaults to 'leads'. */
  objective?: 'awareness' | 'traffic' | 'leads' | 'sales';
  /** Optional override for the angle, e.g. tone or audience hint. */
  audienceHint?: string;
}

export interface AdCopyResult {
  ok: true;
  reviewId: number;
  clientName: string;
  assetName: string;
  objective: string;
  markdown: string;
  generatedAt: string;
}
export interface AdCopyError {
  ok: false;
  reason: string;
}

/**
 * Build the system + user prompt from a fully-loaded AdCopyContext.
 *
 * The system prompt is unchanged from Phase 5 — preserves the meta-ad-copy
 * skill's output schema. The user prompt grows four optional sections,
 * each omitted when empty:
 *   - BRAND CONTEXT          (client_notes + brand_hub presence)
 *   - PAST WINNING ADS       (top performers from meta_insights, last 60d)
 *   - TRANSCRIPT             (Whisper output; wired in commit 7)
 *   - LESSONS FROM PRIOR REJECTIONS  (wired in commit 4)
 */
function buildPrompt(opts: {
  ctx: AdCopyContext;
  objective: string;
  audienceHint: string | null;
}): { system: string; user: string } {
  const system = `You are a Meta (Facebook/Instagram) ad copywriter for Vendo Digital, a UK digital marketing agency. You write punchy, on-brand ad copy that conforms to Meta's character limits and best practices.

Output **ONLY** Markdown matching this exact structure (use the date provided in the user message — do not invent one):

# Meta Ad Copy: <client name>
**Objective:** <objective>
**Audience:** <audience>
**Asset:** <asset name>
**Date:** <YYYY-MM-DD>

---

## Variant 1: <theme/angle name>

**Primary Text:**
<copy — under 125 chars for full visibility, hook in first line>

**Headline:** <≤27 chars recommended>
**Description:** <≤27 chars recommended>
**CTA Button:** <one of: Learn More, Shop Now, Sign Up, Book Now, Contact Us, Get Offer, Get Quote, Subscribe, Apply Now, Download, Watch More>

**Rationale:** <one sentence>

---
(repeat for Variants 2-5)

---

## Testing Recommendations
- **Test variable:** <what to A/B>
- **Audience:** <who to target first>
- **Budget:** <starting daily spend suggestion>

Structural constraints:
- Five variants, each with a meaningfully different A/B hypothesis (not five rewrites of the same idea). Use the suggested angles as a starting frame: problem/solution, social proof, urgency, aspiration, value-led — but reject any angle that doesn't have evidence in the inputs.
- UK English only (organise, behaviour, colour). No US spellings.
- No emoji unless they're already part of the brand voice in the inputs.
- Honour Meta's character guidelines — character counts in parentheses help reviewers.
- Do not output anything other than the markdown above. No preamble, no commentary.

ANTI-HALLUCINATION (strict — violations get the variant rejected):
Do NOT invent any of the following unless they appear explicitly in the inputs:
- Prices, discounts, percentages off, deposits, or finance terms.
- Availability claims ("limited spaces", "filling fast", "selling out", "only X left", "limited time").
- Guarantees, money-back promises, warranties, refund policies.
- Awards, certifications, accreditations, "rated #1", "award-winning".
- Testimonials or named patient/customer quotes.
- Statistics ("9 in 10 patients", "30% improvement", "thousands trust us").
- Time-limited offers, deadlines, countdowns.
- Capabilities the client doesn't have evidence of in the inputs.
- A specific brand identity for unmapped clients — say "the brand" or use the asset's actual subject matter instead of inventing a positioning.
If you don't know it, write something specific to what the asset actually shows / what the brief says — never reach for generic claims.

SPECIFICITY REQUIREMENT (strict):
Every variant's Primary Text MUST contain at least ONE concrete detail drawn from the inputs:
- a phrase from the TRANSCRIPT (preferred — quote or close-paraphrase it),
- a fact from the CLIENT SNAPSHOT,
- a hook from PAST WINNING ADS,
- the explicit HERO BENEFIT from the brief,
- or the asset's actual subject matter from CLIENT COMMENTS.
Copy that could apply to any brand in this vertical fails the brief. If you find yourself writing generic copy, stop and pull a specific from the inputs.

TRANSCRIPT USAGE:
When the TRANSCRIPT section is present and contains a strong line the speaker actually says, quote or close-paraphrase it in at least one variant's Primary Text. The asset's own words are the strongest signal we have.

BANNED TEMPLATE PHRASES (do not use under any circumstances — these are dead-weight ad-speak):
- "find out why"
- "discover" (when generic — fine when followed by a specific noun)
- "take the first step"
- "now is the time"
- "imagine if"
- "what's possible"
- "the right way"
- "your way" (without specific context)
- "your journey"
- "what works for you"
- "transparent" (unless the inputs explicitly justify it)
- "experience the difference"
- "elevate"

CLIENT SNAPSHOT IS AUTHORITATIVE:
When a CLIENT SNAPSHOT is included in the user message, treat it as the ground-truth source on who this client is. Defer to it over any inference you might make from the asset filename, project name, or comment trail. If the snapshot is marked unmapped or best-guess, be honest about that in the copy — never fabricate a brand identity to fill the gap.`;

  const { ctx } = opts;
  const aliases = ctx.client?.aliases ?? '';
  const vertical = ctx.client?.vertical ?? '';

  const sections: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  sections.push(`Today: ${today}`);
  sections.push(`Generate Meta ad copy for the following Frame.io creative asset.`);
  sections.push(
    [
      `CLIENT: ${ctx.review.client_name}${vertical ? ` (vertical: ${vertical})` : ''}`,
      aliases ? `ALSO KNOWN AS: ${aliases}` : null,
      `ASSET: ${ctx.review.asset_name} (${ctx.review.asset_type})`,
      ctx.review.frameio_view_url ? `FRAME.IO LINK: ${ctx.review.frameio_view_url}` : null,
      ``,
      `OBJECTIVE: ${opts.objective}`,
      opts.audienceHint ? `AUDIENCE HINT: ${opts.audienceHint}` : null,
    ].filter(Boolean).join('\n'),
  );

  // CLIENT SNAPSHOT is the authoritative source on who this client is.
  // The copywriter must defer to it over its own inferences from the
  // asset filename or comment trail.
  if (ctx.snapshot) {
    sections.push(
      `CLIENT SNAPSHOT (authoritative — defer to this over inferences from the asset name; confidence: ${ctx.snapshot.confidence}):\n${ctx.snapshot.snapshotMd}`,
    );
  }

  const commentBlock = ctx.comments.length
    ? ctx.comments.map((c) => `- "${c}"`).join('\n')
    : '(no client comments yet)';
  sections.push(`CLIENT COMMENTS ON THIS ASSET (use to infer tone, hero benefit, target audience):\n${commentBlock}`);

  const brandBlock = renderBrandNotesBlock(ctx.brandNotes, ctx.brandHubHasGuidelines);
  if (brandBlock) {
    sections.push(`BRAND CONTEXT (raw tribal-knowledge notes — the snapshot above synthesises these; quote specifics here when useful):\n${brandBlock}`);
  }

  const winnersBlock = renderMetaWinnersBlock(ctx.topMetaWinners);
  if (winnersBlock) {
    sections.push(
      `PAST WINNING ADS FOR THIS CLIENT (last 60 days — match this client's proven tone and angles):\n${winnersBlock}`,
    );
  }

  if (ctx.transcript && ctx.transcript.text) {
    sections.push(`TRANSCRIPT (what's actually said on screen):\n${ctx.transcript.text}`);
  }

  if (ctx.rejectionLessons.length) {
    const lessons = ctx.rejectionLessons.map((l) => `- ${l}`).join('\n');
    sections.push(`LESSONS FROM PRIOR REJECTIONS (do not repeat these mistakes):\n${lessons}`);
  }

  sections.push(`Write five variants, each with a distinct angle, and the testing recommendations block. UK English. Stick to the markdown structure exactly.`);

  return { system, user: sections.join('\n\n') };
}

let _anthropic: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic();
  return _anthropic;
}

export async function generateAdCopyForReview(input: AdCopyInput): Promise<AdCopyResult | AdCopyError> {
  await ensureSchema();
  const ctx = await buildAdCopyContext(input.reviewId);
  if (!ctx) return { ok: false, reason: 'review_not_found' };

  const objective = input.objective ?? 'leads';
  const { system, user } = buildPrompt({
    ctx,
    objective,
    audienceHint: input.audienceHint ?? null,
  });

  let markdown: string;
  try {
    const resp = await anthropic().messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: 'user', content: user }],
    });
    const block = resp.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') return { ok: false, reason: 'no_text_block' };
    markdown = block.text.trim();
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    return { ok: false, reason: `anthropic_error: ${msg}` };
  }

  // Regenerating resets the approval state — any prior approval / rejection
  // referred to the old copy, not this one. Asana task gid is intentionally
  // NOT cleared; commit 5 uses its presence to skip duplicate task creation.
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE creative_reviews
            SET ad_copy_md = ?,
                ad_copy_generated_at = ?,
                ad_copy_objective = ?,
                ad_copy_status = 'draft',
                ad_copy_approved_at = NULL,
                ad_copy_approved_by = NULL,
                ad_copy_rejected_at = NULL,
                ad_copy_rejected_by = NULL,
                ad_copy_rejection_reason = NULL,
                updated_at = ?
          WHERE id = ?`,
    args: [markdown, now, objective, now, input.reviewId],
  });

  return {
    ok: true,
    reviewId: input.reviewId,
    clientName: ctx.review.client_name,
    assetName: ctx.review.asset_name,
    objective,
    markdown,
    generatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// Approval gate
// ---------------------------------------------------------------------------

const REASON_MIN_LEN = 5;
const REASON_MAX_LEN = 1000;

export interface ApproveResult {
  ok: true;
  reviewId: number;
  status: 'approved';
  approvedAt: string;
  /** Set when a new Asana task was created; null on re-approve or Asana failure. */
  asanaTaskGid: string | null;
  /** Non-fatal Asana failure surfaced for UI banners. */
  asanaWarning: string | null;
}
export interface RejectResult {
  ok: true;
  reviewId: number;
  status: 'rejected';
  rejectedAt: string;
  rejectionId: number;
}
export type GateError =
  | { ok: false; reason: 'review_not_found' }
  | { ok: false; reason: 'no_copy_to_approve' }
  | { ok: false; reason: 'no_copy_to_reject' }
  | { ok: false; reason: 'reason_too_short'; min: number }
  | { ok: false; reason: 'reason_too_long'; max: number };

interface GateRow {
  id: number;
  client_name: string;
  asset_name: string;
  frameio_view_url: string | null;
  ad_copy_md: string | null;
  ad_copy_objective: string | null;
  ad_copy_asana_task_gid: string | null;
}

async function loadGateRow(reviewId: number): Promise<(GateRow & { clientId: number | null }) | null> {
  await ensureSchema();
  let r;
  try {
    r = await db.execute({
      sql: `SELECT id, client_name, asset_name, frameio_view_url,
                   ad_copy_md, ad_copy_objective, ad_copy_asana_task_gid
              FROM creative_reviews WHERE id = ?`,
      args: [reviewId],
    });
  } catch {
    return null;
  }
  const row = r.rows[0] as unknown as GateRow | undefined;
  if (!row) return null;
  // Look up clientId for the rejection log (so future generations can join on it).
  let clientId: number | null = null;
  try {
    const c = await db.execute({
      sql: 'SELECT id FROM clients WHERE name = ? LIMIT 1',
      args: [row.client_name],
    });
    clientId = (c.rows[0] as unknown as { id: number } | undefined)?.id ?? null;
  } catch { /* swallow */ }
  return { ...row, clientId };
}

/**
 * Mark a generated ad copy as approved.
 *
 * Idempotent — a second approve on an already-approved row refreshes the
 * timestamp but skips Asana task creation if ad_copy_asana_task_gid is
 * already populated. Asana failure is non-fatal: the approval still
 * succeeds and the caller gets `asanaWarning` so the UI can surface it.
 */
export async function approveAdCopy(reviewId: number, userEmail: string | null): Promise<ApproveResult | GateError> {
  const row = await loadGateRow(reviewId);
  if (!row) return { ok: false, reason: 'review_not_found' };
  if (!row.ad_copy_md) return { ok: false, reason: 'no_copy_to_approve' };

  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE creative_reviews
            SET ad_copy_status = 'approved',
                ad_copy_approved_at = ?,
                ad_copy_approved_by = ?,
                ad_copy_rejected_at = NULL,
                ad_copy_rejected_by = NULL,
                ad_copy_rejection_reason = NULL,
                updated_at = ?
          WHERE id = ?`,
    args: [now, userEmail, now, reviewId],
  });

  // Asana hand-off — skipped on re-approve (gid already set).
  let asanaTaskGid: string | null = null;
  let asanaWarning: string | null = null;
  if (!row.ad_copy_asana_task_gid) {
    const result = await createAdCopyAsanaTask({
      reviewId,
      clientName: row.client_name,
      assetName: row.asset_name,
      markdown: row.ad_copy_md,
      frameioViewUrl: row.frameio_view_url,
      approverEmail: userEmail,
    });
    if (result.ok) {
      asanaTaskGid = result.taskGid;
      try {
        await db.execute({
          sql: `UPDATE creative_reviews SET ad_copy_asana_task_gid = ? WHERE id = ?`,
          args: [result.taskGid, reviewId],
        });
      } catch (err) {
        // Persisting failed but the task exists — surface it so the user
        // doesn't think the hand-off didn't happen.
        asanaWarning = `task_persist_failed: ${(err as Error).message ?? String(err)}`;
      }
    } else {
      asanaWarning = result.reason;
      // Best-effort console log so the function logs show the failure.
      console.warn(`[frameio.approve] Asana task creation failed for review ${reviewId}: ${result.reason}`);
    }
  }

  return { ok: true, reviewId, status: 'approved', approvedAt: now, asanaTaskGid, asanaWarning };
}

/**
 * Mark a generated ad copy as rejected with a mandatory reason. The reason
 * is persisted to ad_copy_rejections (per-client learning log) and also
 * mirrored onto creative_reviews.ad_copy_rejection_reason for cheap UI
 * display without an extra join.
 */
export async function rejectAdCopy(reviewId: number, userEmail: string | null, rawReason: string): Promise<RejectResult | GateError> {
  const reason = rawReason.trim();
  if (reason.length < REASON_MIN_LEN) return { ok: false, reason: 'reason_too_short', min: REASON_MIN_LEN };
  if (reason.length > REASON_MAX_LEN) return { ok: false, reason: 'reason_too_long', max: REASON_MAX_LEN };

  const row = await loadGateRow(reviewId);
  if (!row) return { ok: false, reason: 'review_not_found' };
  if (!row.ad_copy_md) return { ok: false, reason: 'no_copy_to_reject' };

  const rejectionId = await recordRejection({
    reviewId,
    clientId: row.clientId,
    clientName: row.client_name,
    adCopyMd: row.ad_copy_md,
    objective: row.ad_copy_objective,
    reason,
    rejectedBy: userEmail,
  });

  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE creative_reviews
            SET ad_copy_status = 'rejected',
                ad_copy_rejected_at = ?,
                ad_copy_rejected_by = ?,
                ad_copy_rejection_reason = ?,
                ad_copy_approved_at = NULL,
                ad_copy_approved_by = NULL,
                updated_at = ?
          WHERE id = ?`,
    args: [now, userEmail, reason, now, reviewId],
  });

  return { ok: true, reviewId, status: 'rejected', rejectedAt: now, rejectionId };
}

/** Compose a download filename matching the existing skill convention. */
export function adCopyFilename(clientName: string, assetName: string, generatedAt: string): string {
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const date = generatedAt.slice(0, 10); // YYYY-MM-DD
  const asset = slug(assetName).slice(0, 40) || 'asset';
  return `${slug(clientName)}-meta-${asset}-${date}.md`;
}
