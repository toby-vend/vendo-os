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
export const STYLE_GUIDE = `These reports are written as a warm, first-person monthly email from the
account manager. The greeting and sign-off are templated — your sections sit
inside that flow and must read like the real Vendo reports below.

STRUCTURE (map onto the report's fields):
- exec_summary = the "Overview": one short paragraph. Lead with the headline —
  total enquiries (or sales) and the average cost per lead — then the standing
  goal/context, and, where revenue is tracked, "a total tracked revenue of £X
  from an ad spend of £Y" (note ongoing/lifetime value where relevant).
- performance_summary = "Paid Search Performance": a short PROSE paragraph PER
  campaign — NOT a bullet table. Each runs: "[Clean Campaign Name]: [n]
  enquiries at £X per lead." then one sentence of genuine context (form
  submissions vs calls, quality, availability constraints, an improvement
  month-on-month). For ecom, give an "Overall Performance" line (revenue,
  spend, ROAS, profit if known) then each campaign's revenue contribution.
- recommendations = "Looking Ahead" / "Proceeding Forward": specific, tactical
  next steps in prose-y bullets — search-term reports, keyword analysis,
  negative keywords, bid-strategy/ROAS-target tuning, ad-copy/asset refreshes,
  new ad groups, landing-page suggestions. A light "it'd be good to catch up"
  is on-brand when no recent call.

TERMINOLOGY (client-facing — this is the key calibration):
- Lead-gen (dental, services, B2B): say "enquiries", "cost per lead", "£X per
  lead", "form submissions", "phone calls". Do NOT say "conversions" or "CPR"
  to these clients.
- Ecommerce: say "revenue", "spend", "ROAS" / "return on spend", "profit".
- Use friendly platform names: "Performance Max" or "PMax", "Google Ads",
  "Microsoft Ads".
- CLEAN campaign names — strip internal prefixes. "VD | Search - General
  Dentistry" becomes "General Dentistry"; "VD | Search - Clear Aligners"
  becomes "Invisalign®"/"Clear Aligners" as the client knows it. Never show the
  "VD |" prefix or "Search -" plumbing to the client.

VOICE:
- First person ("I completed a quarterly audit", "we'll be…", "I paused…").
- Warm, plain English, confident, momentum-focused. Honesty is woven naturally
  into the prose (e.g. "a majority of these leads are turned away due to
  limited availability") rather than flagged as a separate risk — only use the
  risks field for something the client genuinely needs to act on.
- Exact numbers, never rounded into vagueness, never invented.
- Tight beats padded: exec_summary one paragraph; per-campaign one short
  paragraph each; recommendations 2–4 points.`;

/**
 * Worked examples — adapted from Toby's real monthly reports, anonymised
 * (client/owner names replaced with placeholders; figures kept as realistic
 * illustrations). They teach STRUCTURE and VOICE; the model must not copy
 * their numbers or facts. Greeting/sign-off shown for context only — the app
 * templates those, so the model writes the body sections.
 */
export const FEW_SHOT_EXAMPLES: FewShotExample[] = [
  {
    label: 'Dental — Paid Search (lead-gen)',
    channel: 'google_ads',
    content: `Dear [Client],

Hope you and the team are well.
Attached is your monthly report and loom video outlining the performance of your Paid Search campaigns for [Month Year].

Overview
The account recorded 68 enquiries at an average cost per lead of £43.21. The ongoing goal has been to find more booked patients for Invisalign and Smile Makeovers, whilst reducing the cost per lead and keeping a good flow of patients to fill the diaries for the weeks ahead. We removed the CPA targets on the high-value campaigns as they were choking the ability to get leads, and they are now performing far more consistently, with reduced cost per lead month on month. In [Month], there was a total tracked revenue of £4,290.50 from the Google campaigns, from an ad spend of £2,938.21, with many patients still to be seen for valuable ongoing treatments — this return will grow with lifetime value over the coming months.

Paid Search Performance
Emergency Dentistry: We had 16 enquiries at £28.50 per lead. Despite some going ahead, it looks like a majority of these leads are turned away due to limited availability.
General Dentistry: This campaign delivered 36 enquiries at £24.08 per lead, with 9 form submissions amongst the phone calls. These convert well compared to emergencies.
Invisalign®: We generated 6 enquiries at an average cost per lead of £124.01 — another improvement. These were mostly forms, which convert better than the phone calls.
Smile Makeover: Delivered 6 enquiries at a cost per lead of £111.62, also an improvement.
PMax: 3 additional enquiries at a cost per lead of £30.02.

Looking Ahead
In [Month], we'll continue working towards converting more high-quality Invisalign and Smile Makeover patients, using optimisations such as keyword analysis and search-term reports. I'll be adding more specific ad groups for general treatments such as fillings and periodontal care, as these are popular — it would be good to add some treatment pricing for these to the general landing page to complement this.

As always, feel free to reach out if you need anything.
Best wishes,`,
  },
  {
    label: 'Ecommerce — Paid Search (revenue/ROAS)',
    channel: 'google_ads',
    content: `Hi [Client],

Attached is your monthly report and loom video detailing the performance of your Paid Search campaigns for [Month Year].

Paid Search
[Month] was a high-activity month focused on structural refinement and scaling high-intent traffic across both Google and Microsoft. We added new product ranges into your Catch All Shopping campaign to capture volume, and expanded our keyword lists for the core ranges. We also performed a major cleanup of search terms, blocking irrelevant traffic, and pushed return-on-spend targets higher across the major campaigns to focus spend on higher-return purchases.

Overall Performance
In [Month], your Paid Search activity generated £131,332.89 in revenue from a total spend of £25,139.15, a platform-wide return on spend (ROAS) of 5.22. Google Ads remained strong, contributing £110,354.37 at a blended ROAS of 4.84, with the PMax campaign having a particularly successful month at £24,438.58 in revenue. Microsoft Ads continues to be a profitable supplementary channel, delivering £20,978.52 at a blended ROAS of 9.0.

Focus Areas for Next Month
We'll continue managing bidding strategies and monitoring the recent ROAS-target increases so spend is directed towards the most profitable orders. We'll also split out further campaigns in Microsoft where performance has been strongest, and look at a Google remarketing campaign targeting website visitors who didn't convert to add another touchpoint.

If you have any questions, feel free to reach out.
Many thanks,`,
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
