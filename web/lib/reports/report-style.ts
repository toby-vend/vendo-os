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
 * Distilled style standard.
 *
 * PROVISIONAL BASELINE — derived from Vendo's established client-report email
 * format (web/views/reports/preview.eta) and house conventions, NOT yet from
 * Toby's uploaded example reports. Once real reports land in
 * data/report-examples/, refine/replace this and add FEW_SHOT_EXAMPLES so the
 * output is calibrated to the genuine standard.
 *
 * This guide is report-LEVEL (how the finished report reads as a whole). The
 * per-field rules in report-ai.ts cover each section's mechanics — this avoids
 * repeating them and focuses on cohesion and house voice.
 */
export const STYLE_GUIDE = `The finished report is delivered as a friendly monthly email. The greeting
and sign-off are added automatically — your sections sit inside this flow and
must read as one coherent, confident update, not five disconnected blocks:

  Hi [first name], — (templated)
  [Period] [Platform] Performance   → performance_summary
  Screenshots                       → (team-uploaded; you don't write these)
  This Month                        → exec_summary, then wins, then worked_on
  Things to keep an eye on          → risks (hidden entirely if "no material risks")
  Next Month & Ongoing              → focus (team) + recommendations
  Thanks, [name] — (templated)

House standard:
- One narrative thread. The exec_summary sets the headline; wins, worked_on and
  recommendations should reinforce it, not restate it. Don't repeat the same
  metric verbatim in three places — lead with it once, then build.
- Numbers are exact and lifted from the canonical data: "£2,644.32", "112
  conversions", "CPR £23.61". Never round into vagueness, never invent.
- "CPR" (Cost per Result) is the house term for cost-per-conversion. Campaign
  rows are bottom-funnel only (Spend / conversions / CPR / ROAS where revenue
  exists). Campaign names verbatim, including the "VD | …" prefix.
- Voice: a senior account director who is on top of the account — warm, plain
  English, momentum-focused, addressed to "you". Confident without hype. No
  agency jargon, no filler, no catastrophising.
- worked_on and recommendations should make the client feel the account is
  being actively driven: concrete delivery this month, concrete plans next.
  Frame everything as forward progress.
- Length discipline: exec_summary 2–4 sentences; wins 2–5 bullets; worked_on
  2–4 sentences or ≤5 bullets; risks 1–4 (or hidden); recommendations 2–4.
  Tight beats padded.`;

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
