import Anthropic from '@anthropic-ai/sdk';
import { db } from '../queries/base.js';

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

async function ensureSchema(): Promise<void> {
  if (schemaEnsured) return;
  for (const col of ['ad_copy_md TEXT', 'ad_copy_generated_at TEXT', 'ad_copy_objective TEXT']) {
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

interface ReviewRow {
  id: number;
  client_name: string;
  asset_name: string;
  asset_type: string;
  feedback: string | null;
  frameio_view_url: string | null;
  frameio_file_id: string | null;
  frameio_project_id: string | null;
}

interface ClientRow {
  id: number;
  name: string;
  aliases: string | null;
  vertical: string | null;
}

/** Pull a creative_review and its client. Returns null if missing. */
async function loadContext(reviewId: number): Promise<{ review: ReviewRow; client: ClientRow | null } | null> {
  const r = await db.execute({
    sql: `SELECT id, client_name, asset_name, asset_type, feedback,
                 frameio_view_url, frameio_file_id, frameio_project_id
            FROM creative_reviews WHERE id = ?`,
    args: [reviewId],
  });
  const review = r.rows[0] as unknown as ReviewRow | undefined;
  if (!review) return null;

  const c = await db.execute({
    sql: 'SELECT id, name, aliases, vertical FROM clients WHERE name = ? LIMIT 1',
    args: [review.client_name],
  });
  const client = (c.rows[0] as unknown as ClientRow | undefined) ?? null;
  return { review, client };
}

/** Heuristic clean of the feedback trail into a list of bullet points. */
function parseComments(feedback: string | null): string[] {
  if (!feedback) return [];
  return feedback
    .split('\n')
    .map((line) => line.replace(/^\[[^\]]+\]\s*/, '').trim())
    .filter(Boolean);
}

function buildPrompt(opts: {
  review: ReviewRow;
  client: ClientRow | null;
  objective: string;
  audienceHint: string | null;
  comments: string[];
}): { system: string; user: string } {
  const system = `You are a Meta (Facebook/Instagram) ad copywriter for Vendo Digital, a UK digital marketing agency. You write punchy, on-brand ad copy that conforms to Meta's character limits and best practices.

Output **ONLY** Markdown matching this exact structure:

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

Constraints:
- Five variants, each with a distinct angle (problem/solution, social proof, urgency, aspiration, value-led).
- UK English only (organise, behaviour, colour). No US spellings.
- No emoji unless they're already part of the brand voice in the inputs.
- No fake stats. No testimonials unless quoted in the inputs.
- Honour Meta's character guidelines — character counts in parentheses help reviewers.
- Do not output anything other than the markdown above. No preamble, no commentary.`;

  const commentBlock = opts.comments.length
    ? opts.comments.map((c) => `- "${c}"`).join('\n')
    : '(no client comments yet)';

  const aliases = opts.client?.aliases ?? '';
  const vertical = opts.client?.vertical ?? '';

  const user = `Generate Meta ad copy for the following Frame.io creative asset.

CLIENT: ${opts.review.client_name}${vertical ? ` (vertical: ${vertical})` : ''}
${aliases ? `ALSO KNOWN AS: ${aliases}` : ''}
ASSET: ${opts.review.asset_name} (${opts.review.asset_type})
${opts.review.frameio_view_url ? `FRAME.IO LINK: ${opts.review.frameio_view_url}` : ''}

OBJECTIVE: ${opts.objective}
${opts.audienceHint ? `AUDIENCE HINT: ${opts.audienceHint}` : ''}

CLIENT COMMENTS ON THIS ASSET (use to infer tone, hero benefit, target audience):
${commentBlock}

Write five variants, each with a distinct angle, and the testing recommendations block. UK English. Stick to the markdown structure exactly.`;

  return { system, user };
}

let _anthropic: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic();
  return _anthropic;
}

export async function generateAdCopyForReview(input: AdCopyInput): Promise<AdCopyResult | AdCopyError> {
  await ensureSchema();
  const ctx = await loadContext(input.reviewId);
  if (!ctx) return { ok: false, reason: 'review_not_found' };

  const objective = input.objective ?? 'leads';
  const comments = parseComments(ctx.review.feedback);
  const { system, user } = buildPrompt({
    review: ctx.review,
    client: ctx.client,
    objective,
    audienceHint: input.audienceHint ?? null,
    comments,
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

  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE creative_reviews
            SET ad_copy_md = ?,
                ad_copy_generated_at = ?,
                ad_copy_objective = ?,
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

/** Compose a download filename matching the existing skill convention. */
export function adCopyFilename(clientName: string, assetName: string, generatedAt: string): string {
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const date = generatedAt.slice(0, 10); // YYYY-MM-DD
  const asset = slug(assetName).slice(0, 40) || 'asset';
  return `${slug(clientName)}-meta-${asset}-${date}.md`;
}
