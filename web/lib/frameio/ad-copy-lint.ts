/**
 * Output verification for generated ad copy.
 *
 * After the copywriter agent returns markdown, we lint it for the
 * deterministic violations we can reliably check:
 *   - Exactly 5 variants
 *   - Character limits (Primary Text ≤125, Headline ≤27, Description ≤27)
 *   - CTA Button is in Meta's approved list
 *   - No banned template phrases (system-wide)
 *   - No client-specific banned words (from the brief)
 *
 * Returns { ok, violations }. The generator orchestrator uses violations
 * to either build a refinement prompt (one retry) or persist as warnings.
 *
 * Semantic checks (transcript quote present, hero benefit referenced)
 * are left to the self-critique pass — they need fuzzy matching that
 * isn't safe to enforce deterministically.
 */

export const APPROVED_META_CTAS: ReadonlySet<string> = new Set([
  'Learn More', 'Shop Now', 'Sign Up', 'Book Now', 'Contact Us',
  'Get Offer', 'Get Quote', 'Subscribe', 'Apply Now', 'Download', 'Watch More',
]);

/**
 * System-wide banned template phrases. Match the system prompt's
 * BANNED TEMPLATE PHRASES section. Used case-insensitively.
 */
export const BANNED_TEMPLATE_PHRASES: readonly string[] = [
  'find out why',
  'take the first step',
  'now is the time',
  'imagine if',
  "what's possible",
  'whats possible',
  'the right way',
  'your way',
  'your journey',
  'what works for you',
  'experience the difference',
  'elevate',
];

export interface ParsedVariant {
  index: number;
  primaryText: string | null;
  headline: string | null;
  description: string | null;
  ctaButton: string | null;
  rationale: string | null;
}

export interface Violation {
  variantIndex: number | null;
  field: 'primary_text' | 'headline' | 'description' | 'cta_button' | 'structure';
  kind:
    | 'missing_field'
    | 'over_char_limit'
    | 'invalid_cta'
    | 'banned_template_phrase'
    | 'banned_client_word'
    | 'wrong_variant_count'
    | 'missing_variant';
  detail: string;
}

export interface LintResult {
  ok: boolean;
  violations: Violation[];
  variants: ParsedVariant[];
}

const CHAR_LIMITS = {
  primary_text: 125,
  headline: 27,
  description: 27,
} as const;

/** Strip the "(N chars)" annotation the model often appends. */
function stripCharAnnotation(value: string): string {
  return value.replace(/\s*\(\s*\d+\s*chars?\s*\)\s*$/i, '').trim();
}

/**
 * Parse the markdown output into variants. Lenient — picks up sub-formats
 * like trailing whitespace, missing blank lines, or stray bold markers.
 */
export function parseVariants(markdown: string): ParsedVariant[] {
  const lines = markdown.split('\n');
  const variants: ParsedVariant[] = [];
  let current: ParsedVariant | null = null;
  let fieldName: string | null = null;
  let fieldBuf: string[] = [];

  const flushField = () => {
    if (!current || !fieldName) {
      fieldBuf = [];
      fieldName = null;
      return;
    }
    const value = stripCharAnnotation(fieldBuf.join('\n').trim());
    if (fieldName === 'primary text') current.primaryText = value;
    else if (fieldName === 'headline') current.headline = value;
    else if (fieldName === 'description') current.description = value;
    else if (fieldName === 'cta button') current.ctaButton = value;
    else if (fieldName === 'rationale') current.rationale = value;
    fieldBuf = [];
    fieldName = null;
  };

  for (const line of lines) {
    const variantMatch = line.match(/^##\s+Variant\s+(\d+)/i);
    if (variantMatch) {
      flushField();
      if (current) variants.push(current);
      current = {
        index: Number(variantMatch[1]),
        primaryText: null, headline: null, description: null, ctaButton: null, rationale: null,
      };
      continue;
    }
    const fieldMatch = line.match(/^\*\*(.+?):\*\*\s*(.*)$/);
    if (fieldMatch && current) {
      flushField();
      fieldName = fieldMatch[1].toLowerCase().trim();
      fieldBuf = [fieldMatch[2]];
      continue;
    }
    if (current && fieldName) {
      // Continuation line for the current field.
      if (line.trim() === '---' || line.trim() === '') {
        flushField();
        continue;
      }
      fieldBuf.push(line);
    }
  }
  flushField();
  if (current) variants.push(current);
  return variants;
}

function parseBannedWords(raw: string | null): string[] {
  if (!raw) return [];
  return raw.split(/[,\n]/).map((s) => s.trim()).filter((s) => s.length >= 2);
}

/** Case-insensitive whole-or-substring scan, ignoring punctuation differences. */
function containsPhrase(haystack: string | null, needle: string): boolean {
  if (!haystack) return false;
  // Normalise apostrophes and dashes so model variants match the canonical phrase.
  const norm = (s: string) => s.toLowerCase().replace(/[’'`]/g, "'").replace(/[–—]/g, '-');
  return norm(haystack).includes(norm(needle));
}

export interface LintInput {
  markdown: string;
  bannedWords?: string | null;
}

export function lintAdCopyOutput(input: LintInput): LintResult {
  const violations: Violation[] = [];
  const variants = parseVariants(input.markdown);

  if (variants.length !== 5) {
    violations.push({
      variantIndex: null,
      field: 'structure',
      kind: 'wrong_variant_count',
      detail: `expected 5 variants, got ${variants.length}`,
    });
  }

  const clientBanned = parseBannedWords(input.bannedWords ?? null);

  for (const v of variants) {
    // Field presence
    if (!v.primaryText) {
      violations.push({ variantIndex: v.index, field: 'primary_text', kind: 'missing_field', detail: 'Primary Text is missing' });
    }
    if (!v.headline) {
      violations.push({ variantIndex: v.index, field: 'headline', kind: 'missing_field', detail: 'Headline is missing' });
    }
    if (!v.description) {
      violations.push({ variantIndex: v.index, field: 'description', kind: 'missing_field', detail: 'Description is missing' });
    }
    if (!v.ctaButton) {
      violations.push({ variantIndex: v.index, field: 'cta_button', kind: 'missing_field', detail: 'CTA Button is missing' });
    }

    // Char limits
    if (v.primaryText && v.primaryText.length > CHAR_LIMITS.primary_text) {
      violations.push({
        variantIndex: v.index, field: 'primary_text', kind: 'over_char_limit',
        detail: `Primary Text is ${v.primaryText.length} chars (limit ${CHAR_LIMITS.primary_text})`,
      });
    }
    if (v.headline && v.headline.length > CHAR_LIMITS.headline) {
      violations.push({
        variantIndex: v.index, field: 'headline', kind: 'over_char_limit',
        detail: `Headline is ${v.headline.length} chars (limit ${CHAR_LIMITS.headline})`,
      });
    }
    if (v.description && v.description.length > CHAR_LIMITS.description) {
      violations.push({
        variantIndex: v.index, field: 'description', kind: 'over_char_limit',
        detail: `Description is ${v.description.length} chars (limit ${CHAR_LIMITS.description})`,
      });
    }

    // CTA in approved list
    if (v.ctaButton && !APPROVED_META_CTAS.has(v.ctaButton)) {
      violations.push({
        variantIndex: v.index, field: 'cta_button', kind: 'invalid_cta',
        detail: `CTA "${v.ctaButton}" is not in Meta's approved list`,
      });
    }

    // Banned template phrases (anywhere in primary/headline/description)
    const scanFields: Array<{ field: Violation['field']; value: string | null }> = [
      { field: 'primary_text', value: v.primaryText },
      { field: 'headline', value: v.headline },
      { field: 'description', value: v.description },
    ];
    for (const { field, value } of scanFields) {
      for (const phrase of BANNED_TEMPLATE_PHRASES) {
        if (containsPhrase(value, phrase)) {
          violations.push({
            variantIndex: v.index, field, kind: 'banned_template_phrase',
            detail: `"${phrase}" in ${field.replace('_', ' ')}`,
          });
        }
      }
      for (const word of clientBanned) {
        if (containsPhrase(value, word)) {
          violations.push({
            variantIndex: v.index, field, kind: 'banned_client_word',
            detail: `"${word}" (client-banned) in ${field.replace('_', ' ')}`,
          });
        }
      }
    }
  }

  return { ok: violations.length === 0, violations, variants };
}

/**
 * Build a refinement user-prompt that asks the model to rewrite ONLY the
 * failing variants. Keeps the rest unchanged so we don't risk regressing
 * the passing ones.
 */
export function buildRefinementPrompt(originalMarkdown: string, violations: Violation[]): string {
  const lines: string[] = [];
  lines.push(`The previous output has ${violations.length} lint violation${violations.length === 1 ? '' : 's'}. Rewrite ONLY the failing variants, keeping all passing variants exactly as they were.`);
  lines.push('');
  lines.push('Violations:');
  for (const v of violations) {
    const tag = v.variantIndex ? `Variant ${v.variantIndex}` : 'Output structure';
    lines.push(`- ${tag} (${v.field.replace('_', ' ')}): ${v.detail}`);
  }
  lines.push('');
  lines.push('Previous output to refine:');
  lines.push('---');
  lines.push(originalMarkdown);
  lines.push('---');
  lines.push('Output the FULL revised markdown (all 5 variants), with the failing variants rewritten and the rest copied verbatim.');
  return lines.join('\n');
}

/** Compact JSON summary stored in creative_reviews.ad_copy_lint_warnings. */
export function summariseViolations(violations: Violation[]): string {
  return JSON.stringify(violations.map((v) => ({
    variant: v.variantIndex,
    field: v.field,
    kind: v.kind,
    detail: v.detail,
  })));
}
