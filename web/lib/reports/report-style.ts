/**
 * Quality anchor for AI-generated client reports.
 *
 * Two levers keep generated reports matching Vendo's established standard:
 *
 *   1. STYLE_GUIDE — a distilled written standard (structure, tone, phrasing,
 *      metric conventions) extracted from real past reports. Appended to the
 *      system prompt.
 *   2. FEW_SHOT_EXAMPLES — 1–2 real past reports embedded verbatim as worked
 *      examples so the model can match exact structure and depth.
 *
 * Both are populated from the example reports in `data/report-examples/`
 * (see that folder's README). Until then they are empty and have no effect —
 * the base prompt rules in report-ai.ts still apply.
 *
 * Keep examples ANONYMISED of anything that shouldn't live in the repo if the
 * source reports contain sensitive commercial detail — the point is to teach
 * structure and tone, not to store client data.
 */

export interface FewShotExample {
  /** Short label, e.g. "Dental — Google Ads — Apr 2026". */
  label: string;
  /** The example report body (markdown), used to anchor structure + tone. */
  content: string;
}

/**
 * Distilled style standard. Filled from analysis of past reports.
 * Empty string = not yet configured (no effect on the prompt).
 */
export const STYLE_GUIDE = '';

/**
 * Verbatim worked examples. Keep to 1–2 to control prompt cost.
 * Empty array = not yet configured (no effect on the prompt).
 */
export const FEW_SHOT_EXAMPLES: FewShotExample[] = [];

/**
 * Compose the optional style addendum for the system prompt. Returns an empty
 * string when nothing is configured, so the caller can append unconditionally.
 */
export function renderStyleAddendum(): string {
  const sections: string[] = [];

  if (STYLE_GUIDE.trim()) {
    sections.push(
      '\n\n----------------------------------------------------------------------------\n' +
        'VENDO REPORT STYLE STANDARD — match this structure, tone, and phrasing.\n' +
        '----------------------------------------------------------------------------\n' +
        STYLE_GUIDE.trim(),
    );
  }

  if (FEW_SHOT_EXAMPLES.length) {
    const examples = FEW_SHOT_EXAMPLES.map(
      (ex, i) =>
        `\n--- EXAMPLE ${i + 1}: ${ex.label} ---\n${ex.content.trim()}`,
    ).join('\n');
    sections.push(
      '\n\n----------------------------------------------------------------------------\n' +
        'REFERENCE REPORTS — these are real past Vendo reports. Match their depth,\n' +
        'section ordering, metric formatting, and voice. Do NOT copy their numbers\n' +
        'or client-specific facts; only mirror the style.\n' +
        '----------------------------------------------------------------------------' +
        examples,
    );
  }

  return sections.join('');
}
