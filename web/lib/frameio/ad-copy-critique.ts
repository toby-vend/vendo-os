/**
 * Self-critique pass — opt-in second-pass review of generated ad copy.
 *
 * Asks Sonnet to score each variant on three axes (specificity, brand fit,
 * hypothesis distinctiveness) and suggest one concrete tweak per variant
 * scoring under 7 on any axis. Output is structured Markdown stored on
 * creative_reviews.ad_copy_critique_md.
 *
 * Off by default; runs on explicit user click. Cached once generated; the
 * generator clears it when the underlying ad copy is regenerated.
 */
import Anthropic from '@anthropic-ai/sdk';
import { db } from '../queries/base.js';
import { buildAdCopyContext } from './ad-copy-context.js';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1500;

export interface CritiqueResult {
  ok: true;
  reviewId: number;
  markdown: string;
  generatedAt: string;
}
export interface CritiqueError {
  ok: false;
  reason: string;
}

let _anthropic: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic();
  return _anthropic;
}

const SYSTEM_PROMPT = `You are the Critique agent for Vendo Digital's Meta ad copy pipeline.

A copywriter produced 5 ad-copy variants for a Frame.io creative asset. Your job is to score each variant 1-10 on three independent axes and suggest one concrete improvement per variant scoring under 7 on any axis.

Axes:
- **Specificity** — does it reference concrete details from the brief / snapshot / transcript / past winners? A generic ad that could apply to any brand in this vertical scores 1-3. A variant that quotes the transcript or references the hero benefit by name scores 8-10.
- **Brand fit** — does it sound like the client's voice (per the snapshot)? Does it respect banned words and rejection lessons? Mismatched tone or banned-word usage scores 1-3.
- **Hypothesis distinctiveness** — is this variant testing a genuinely different angle than the other 4? Five rewrites of the same idea score 1-3.

Output **ONLY** Markdown matching this exact structure:

## Variant 1: <theme/angle from the variant heading>
**Specificity:** <score>/10 — <one sentence>
**Brand fit:** <score>/10 — <one sentence>
**Hypothesis distinctiveness:** <score>/10 — <one sentence>
**Improvement:** <one concrete tweak under 12 words, or "—" if all axes ≥7>

(repeat for Variants 2-5)

## Overall
**Best variant:** <variant number + one-sentence why>
**Weakest variant:** <variant number + one-sentence why>
**Top fix to ship:** <one sentence pointing at the highest-leverage improvement>

Rules:
- Be specific in scoring — cite a phrase from the variant that earned (or lost) the score.
- UK English.
- Do not output anything other than the Markdown above. No preamble, no commentary.`;

interface ReviewRow {
  id: number;
  ad_copy_md: string | null;
  ad_copy_hero_benefit: string | null;
  ad_copy_audience: string | null;
  ad_copy_cta_target: string | null;
  ad_copy_banned_words: string | null;
  ad_copy_tone: string | null;
}

async function loadReview(reviewId: number): Promise<ReviewRow | null> {
  try {
    const r = await db.execute({
      sql: `SELECT id, ad_copy_md, ad_copy_hero_benefit, ad_copy_audience,
                   ad_copy_cta_target, ad_copy_banned_words, ad_copy_tone
              FROM creative_reviews WHERE id = ? LIMIT 1`,
      args: [reviewId],
    });
    return (r.rows[0] as unknown as ReviewRow | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function runCritique(reviewId: number, opts: { force?: boolean } = {}): Promise<CritiqueResult | CritiqueError> {
  const row = await loadReview(reviewId);
  if (!row) return { ok: false, reason: 'review_not_found' };
  if (!row.ad_copy_md) return { ok: false, reason: 'no_ad_copy_to_critique' };

  // Cache check — return existing critique unless force=true.
  if (!opts.force) {
    try {
      const cached = await db.execute({
        sql: `SELECT ad_copy_critique_md, ad_copy_critique_at FROM creative_reviews WHERE id = ? LIMIT 1`,
        args: [reviewId],
      });
      const c = cached.rows[0] as unknown as { ad_copy_critique_md: string | null; ad_copy_critique_at: string | null } | undefined;
      if (c?.ad_copy_critique_md) {
        return { ok: true, reviewId, markdown: c.ad_copy_critique_md, generatedAt: c.ad_copy_critique_at ?? new Date().toISOString() };
      }
    } catch { /* swallow */ }
  }

  // Load supporting context (snapshot, transcript, past winners, rejection lessons)
  // so the critique can judge whether the variants actually used them.
  const ctx = await buildAdCopyContext(reviewId);

  const userPromptParts: string[] = [];
  userPromptParts.push(`Critique the following 5-variant Meta ad-copy output for review ${reviewId}.`);
  if (ctx?.snapshot) {
    userPromptParts.push(`CLIENT SNAPSHOT (the brand profile the copywriter was given):\n${ctx.snapshot.snapshotMd}`);
  }
  const briefLines: string[] = [];
  if (row.ad_copy_hero_benefit) briefLines.push(`- Hero benefit: ${row.ad_copy_hero_benefit}`);
  if (row.ad_copy_audience) briefLines.push(`- Audience: ${row.ad_copy_audience}`);
  if (row.ad_copy_cta_target) briefLines.push(`- CTA target: ${row.ad_copy_cta_target}`);
  if (row.ad_copy_banned_words) briefLines.push(`- Banned words: ${row.ad_copy_banned_words}`);
  if (row.ad_copy_tone) briefLines.push(`- Tone: ${row.ad_copy_tone}`);
  if (briefLines.length) userPromptParts.push(`BRIEF the copywriter was given:\n${briefLines.join('\n')}`);
  if (ctx?.transcript?.text) {
    userPromptParts.push(`TRANSCRIPT of the asset (use this to judge specificity — did any variant quote it?):\n${ctx.transcript.text.slice(0, 3000)}`);
  }
  if (ctx?.topMetaWinners && ctx.topMetaWinners.length > 0) {
    const wins = ctx.topMetaWinners.map((w) => `- "${w.ad_name}" (${w.leads} leads, ${w.ctr.toFixed(2)}% CTR)`).join('\n');
    userPromptParts.push(`PAST WINNING ADS for this client (judge whether variants borrowed from these):\n${wins}`);
  }
  if (ctx?.rejectionLessons && ctx.rejectionLessons.length > 0) {
    userPromptParts.push(`PAST REJECTION REASONS (judge whether variants avoided these mistakes):\n${ctx.rejectionLessons.map((l) => `- ${l}`).join('\n')}`);
  }
  userPromptParts.push(`AD COPY TO CRITIQUE:\n---\n${row.ad_copy_md}\n---`);
  userPromptParts.push(`Score each variant. Be specific. UK English. Stick to the markdown structure exactly.`);

  let markdown: string;
  try {
    const resp = await anthropic().messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPromptParts.join('\n\n') }],
    });
    const block = resp.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') return { ok: false, reason: 'no_text_block' };
    markdown = block.text.trim();
  } catch (err) {
    return { ok: false, reason: `anthropic_error: ${(err as Error).message ?? String(err)}` };
  }

  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE creative_reviews SET ad_copy_critique_md = ?, ad_copy_critique_at = ? WHERE id = ?`,
    args: [markdown, now, reviewId],
  });

  return { ok: true, reviewId, markdown, generatedAt: now };
}
