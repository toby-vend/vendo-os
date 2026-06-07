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

import type { ReportChannel } from '../queries/reports.js';

export interface FewShotExample {
  /** Short label, e.g. "Dental — Google Ads — Apr 2026". */
  label: string;
  /** Which channel this example belongs to — only shown on matching reports. */
  channel: ReportChannel;
  /** The example report body (markdown), used to anchor structure + tone. */
  content: string;
}

/**
 * Distilled style standard.
 *
 * Calibrated from Toby's real monthly Google Ads reports
 * (data/report-examples/) — the genuine house standard for client-facing
 * Paid Search reporting. PRESENTATION here (prose, "enquiries"/"cost per lead",
 * clean campaign names) intentionally takes precedence over the bullet/CPR/
 * "VD |" presentation in report-ai.ts for these Google Ads client emails. The
 * SUBSTANTIVE locked rules in report-ai.ts still hold: anti-fabrication,
 * bottom-funnel only, skip inactive campaigns, dental View Content handling,
 * and the positive/mirroring tone.
 *
 * The few-shot examples below carry the structure; this guide states the rules.
 */
export const STYLE_GUIDE = `A warm, first-person monthly email from the account manager. Greeting and
sign-off are templated; your sections sit inside that flow and read as ONE
coherent email — match the gold-standard example below exactly.

SECTION MAP (onto the report fields):
- exec_summary = "Headline": 2–3 sentences. The topline (total enquiries,
  blended cost per lead, total spend) stated ONCE, plus the real story
  including the one thing to address.
- performance_summary = "Performance by campaign": a markdown TABLE
  (Campaign | Enquiries | Cost per lead | Spend | % of budget, + Total row),
  then ONE short paragraph reading the allocation honestly.
- worked_on = "What we did this month": deduped bullets, active voice.
- risks = "Watch point": the single key issue, owned, framed as a fix-it item
  with a reassess date.
- recommendations = "Next month": specific actions with goals, ending with
  "One thing I need from you:" + a single yes/no ask.

NON-NEGOTIABLES (these are what separate a credible report from a padded one):
- Say each number ONCE. Topline in the Headline; per-campaign figures ONLY in
  the table. Never restate a metric across sections.
- No duplicate or near-duplicate lines. Each action once, active voice.
- Show the spend split + % of budget so allocation is visible. Own the
  trade-off (e.g. "a third of budget for ~5% of enquiries") — don't excuse it.
- Earn adjectives: only "strong/efficient/etc." with a benchmark (MoM or
  target). Otherwise drop the word and let the number stand.
- Anchor to bookings/revenue when that data exists — booking is the real goal.
- Close with a decision request, not "let us know if you have questions".

TERMINOLOGY:
- Lead-gen (dental, services, B2B): "enquiries", "cost per lead" (£X per lead),
  "form submissions", "phone calls", "bookings". Not "conversions"/"CPR".
- Ecommerce: "sales"/"purchases", "CPA", "revenue", "spend", "ROAS".
- Clean campaign names — strip "VD |" / "Search -" prefixes. Friendly platform
  names ("Performance Max"/"PMax").

VOICE: first person, plain English, confident, decisive. Exact numbers, never
rounded into vagueness, never invented. Tight beats padded.`;

/**
 * Worked examples — adapted from Toby's real monthly reports, anonymised
 * (client/owner names replaced with placeholders; figures kept as realistic
 * illustrations). They teach STRUCTURE and VOICE; the model must not copy
 * their numbers or facts. Greeting/sign-off shown for context only — the app
 * templates those, so the model writes the body sections.
 */
export const FEW_SHOT_EXAMPLES: FewShotExample[] = [
  {
    // The gold standard (Toby's own rewrite). Greeting/sign-off templated by
    // the app — these are the body sections the model writes, shown in render
    // order. Note: each number stated once, spend split + % of budget visible,
    // trade-off owned, single explicit ask at the end. Match this exactly.
    label: 'Dental — Google Ads (the standard to match)',
    channel: 'google_ads',
    content: `[Greeting — templated: "Hi [Name], Hope you're well. Here's your Google Ads summary for May 2026."]

[HEADLINE]
112 enquiries at a blended cost per lead of £23.61, from £2,644.32 spend. General Dentistry did the heavy lifting; Performance Max was the most efficient channel; Clear Aligners remains low-volume and is the main thing to address.

[PERFORMANCE BY CAMPAIGN]
| Campaign | Enquiries | Cost per lead | Spend | % of budget |
|---|---|---|---|---|
| General Dentistry | 99 | £16.34 | £1,617.66 | 61% |
| Clear Aligners | 6 | £155.48 | £932.88 | 35% |
| Performance Max | 7 | £13.39 | £93.73 | 4% |
| **Total** | **112** | **£23.61** | **£2,644.32** | **100%** |

General Dentistry is delivering volume efficiently and remains the engine for filling diaries. Performance Max is punching above its weight and is worth scaling. Clear Aligners is currently taking about a third of the budget for around 5% of enquiries, so the priority this month is to make that spend work harder rather than let it ride.

[WHAT WE DID THIS MONTH]
- Completed quarterly, monthly and bi-weekly optimisations, plus a full account audit.
- Fixed a form issue on the Clear Aligners landing page to keep the enquiry journey friction-free.
- Updated the website thank-you page.
- Progressed the Boxly CRM migration, coordinating the lead-flow switchover to avoid disruption to incoming enquiries.
- Reviewed geographic targeting and prepared zone recommendations to apply going forward.

[WATCH POINT: CLEAR ALIGNERS]
6 enquiries at £155.48 is well above the rest of the account. A higher cost per lead is expected for this treatment, but at current volume the spend is hard to justify on its own. Rather than simply accept it, we're treating this as a fix-it item (see next month) and will reassess at the end of June.

[NEXT MONTH]
- Clear Aligners review: full search-term and keyword analysis to cut wasted spend, add tighter negatives, and surface higher-intent terms. Goal: lift volume and bring the cost per lead down.
- Geo-targeting refinement: apply the zone recommendations to concentrate spend on the highest-converting areas.
- CRM lead-flow: ensure all Google Ads enquiries feed cleanly into Boxly with automated follow-up, to speed up response and improve enquiry-to-booking.
- Smile Makeover campaign: build a dedicated Smile Makeover ad group to capture higher-value demand alongside Clear Aligners.

**One thing I need from you:** a yes or no on building out the Smile Makeover campaign, so I can scope it for June.

[Sign-off — templated: "Thanks, Toby"]`,
  },
];

/**
 * Compose the optional style addendum for the system prompt. Returns an empty
 * string when nothing is configured, so the caller can append unconditionally.
 */
export function renderStyleAddendum(channel?: ReportChannel): string {
  const sections: string[] = [];

  if (STYLE_GUIDE.trim()) {
    sections.push(
      '\n\n----------------------------------------------------------------------------\n' +
        'VENDO REPORT STYLE STANDARD — match this structure, tone, and phrasing.\n' +
        '----------------------------------------------------------------------------\n' +
        STYLE_GUIDE.trim(),
    );
  }

  // Only show examples for the report's channel — a Meta or SEO report must not
  // be anchored on Google Ads exemplars.
  const examplesForChannel = channel
    ? FEW_SHOT_EXAMPLES.filter(ex => ex.channel === channel)
    : FEW_SHOT_EXAMPLES;

  if (examplesForChannel.length) {
    const examples = examplesForChannel.map(
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
