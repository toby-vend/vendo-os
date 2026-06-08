/**
 * AI generation for client reports.
 *
 * Takes the structured report inputs (screenshots, narrative) and produces five
 * polished markdown blocks via Claude's tool-use API:
 *   - exec_summary
 *   - performance_summary (overall + per-campaign metric breakdown)
 *   - wins
 *   - risks
 *   - recommendations
 *
 * The screenshots themselves are sent to Claude as image content blocks (URL
 * sources pointing at Vercel Blob), so the model can read metrics directly off
 * the charts and weave those numbers into the output.
 *
 * ----------------------------------------------------------------------------
 * REPORT RULES — read before changing the prompt or tool description.
 * Each rule below comes from a Toby correction during the v1 rollout. Do not
 * water them down without checking with him first.
 * ----------------------------------------------------------------------------
 *
 * 1. ANTI-FABRICATION
 *    Use only numbers visible in screenshots / captions / narrative. If a
 *    number is unclear, omit it. Currency: GBP unless the screenshot shows
 *    otherwise.
 *
 * 2. CAMPAIGN BREAKDOWN — bottom-funnel only
 *    Per-campaign rows show ONLY: Spend / Purchases (or Leads / Conversions) /
 *    Cost per Purchase (CPA / CPL) / ROAS (or Conversion Rate for lead-gen).
 *    Vanity metrics (impressions, reach, frequency, CTR, CPC) DO NOT appear
 *    in the campaign rows. They can appear in the narrative blocks (wins /
 *    risks / This Month) when they tell a real story.
 *    "Overall [Platform] Performance" allows slightly more breadth (total
 *    spend, total conversions, revenue, blended ROAS) — same anti-vanity rule.
 *
 * 3. SKIP INACTIVE CAMPAIGNS
 *    Any campaign row with £0 spend / zero impressions / zero clicks is
 *    excluded from the breakdown, wins, risks, and recommendations.
 *
 * 4. DENTAL CLIENTS — View Content IS the leads campaign
 *    When `vertical === 'dental'`, the Meta conversion event tracked is
 *    "View Content", and the View Content campaign IS the leads campaign.
 *    - Treat it as the lead/conversion metric in the breakdown.
 *    - Display as "Leads" (or "View Content" if labelled that way).
 *    - NEVER explain what View Content is.
 *    - NEVER recommend switching away from View Content to a Leads /
 *      Conversions objective. Build recommendations on top of it.
 *
 * 5. TONE — positive, mirror the team's framing
 *    Default is constructive, momentum-focused, friendly. If the team's
 *    narrative says "almost done" / "in final stages", reflect that — do
 *    NOT recast it as a delay or risk. Reserve cautionary language
 *    ("delays", "blocking", "cannot launch", "risk to revenue") for issues
 *    the team has explicitly flagged in the inputs OR clear deterioration
 *    in the data (CPL up sharply, conversion volume falling, etc.). No
 *    invented urgency. No catastrophising.
 *
 * 2026-06 CALIBRATION (from Toby's real Google Ads reports — see
 * web/lib/reports/report-style.ts + data/report-examples/):
 *    For single-platform Google Ads / Paid Search client reports, PRESENTATION
 *    follows the real reports: prose paragraphs per campaign (not bullet
 *    tables), client-facing terms "enquiries"/"cost per lead" (not
 *    "conversions"/"CPR"), and CLEAN campaign names (strip "VD |"/"Search -").
 *    The structured bullet layout in the performance_summary tool description
 *    still applies to richer multi-platform/CRM reports. The SUBSTANTIVE rules
 *    above (1–5) are unchanged. Pending Toby's confirmation on roll-out.
 *
 * Cross-reference:
 *   - Memory: feedback_client_reports_rules.md (in
 *     ~/.claude/projects/-Users-Toby-1-Vendo-OS/memory/) keeps the same
 *     rules canonical for future Claude Code sessions.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { ImageBlockParam, TextBlockParam, Tool } from '@anthropic-ai/sdk/resources/messages.js';
import { trackUsage } from './usage-tracker.js';
import { PLATFORM_OPTIONS, channelLabel, type ScreenshotPlatform, type ReportChannel } from './queries/reports.js';
import { renderStyleAddendum } from './reports/report-style.js';

const MODEL = 'claude-sonnet-4-6';

export interface ReportAiInput {
  clientName: string;
  vertical: string | null;
  /** The single channel this report covers. No other channel may appear. */
  channel: ReportChannel;
  periodLabel: string;
  workedOnMd: string;
  focusNextMd: string;
  screenshots: Array<{
    platform: ScreenshotPlatform;
    caption: string;
    url: string;
  }>;
  /**
   * Canonical, channel-pure data block (from channel-summary.ts) for the
   * report's channel. Injected before screenshots; the model treats it as
   * authoritative over screenshot OCR. Empty string when the channel had no
   * activity this period.
   */
  channelData?: string;
  /**
   * CSV campaign-data exports the team uploaded for this report. Treated as
   * canonical campaign data (same authority as channelData) — especially
   * valuable when the API has no data for the channel/period. Channel-filtered
   * upstream.
   */
  uploadedCsv?: Array<{ label: string; text: string }>;
  /**
   * Google Ads change history for the period (pasted by the team or auto-pulled
   * from the API) — the log of account changes (budgets, bids, status,
   * keywords, negatives, etc.). Internal context: synthesise into the
   * client-facing "what we did" themes and use to explain performance shifts;
   * never dump raw rows verbatim.
   */
  changeHistory?: string;
  /**
   * Optional internal meeting context — what was discussed in the client's
   * calls this period (from Fathom summaries). Used to ground the qualitative
   * sections (exec summary, wins, "what we worked on" framing,
   * recommendations) in what actually happened. INTERNAL only: never quoted
   * verbatim or surfaced as client-facing copy, and never a source of metrics.
   */
  meetingDiscussions?: Array<{ title: string; date: string; summary: string }>;
  /**
   * Optional list of work completed this period — Asana tasks closed and
   * meeting action items. INTERNAL source: task names often contain internal
   * shorthand and personal names, so the model must synthesise client-ready
   * prose from them, never reproduce them verbatim. Grounds the "what we
   * worked on" narrative and wins in real delivery.
   */
  completedWork?: Array<{ label: string; date: string; source: 'asana' | 'meeting' }>;
  /**
   * When true, ask the model to also draft the client-facing "What we worked
   * on" narrative (returned as `worked_on`). Used by the automated flow when
   * the team hasn't written one. When false, the model uses the supplied
   * `workedOnMd` as-is and does not return `worked_on`.
   */
  draftWorkedOn?: boolean;
}

export interface ReportAiOutput {
  exec_summary: string;
  performance_summary: string;
  risks: string;
  recommendations: string;
  /** Present only when `draftWorkedOn` was requested. */
  worked_on?: string;
}

const BASE_SYSTEM_PROMPT = `You are a senior account director at Vendo Digital, a UK digital marketing agency. You are drafting the AI-generated sections of a monthly client performance report.

You will be given:
- Client name and reporting period
- One or more performance screenshots — each prefixed with a header naming the platform (Google Ads, Meta, etc.) and any caption the account team wrote. **Read the actual numbers off the charts and tables in the images** — spend, clicks, impressions, conversions, purchases, CTR, ROAS, CPC, CPL, lead counts, revenue, comparison-period deltas, per-campaign breakdowns — and use them in your output.
- A "What we worked on" narrative
- A "Focus next period" narrative
- Optionally, an "Internal meeting context" block — short summaries of the calls held with the client this period
- Optionally, a "Work completed this period" list — Asana tasks closed and meeting actions for the account

If a STRUCTURED [CHANNEL] DATA block is provided, use those numbers as canonical — do not re-derive them from a screenshot. Screenshots may still be present for visual context (e.g. trend charts) but the structured block is authoritative.

Internal meeting context — handle with care:
- This is internal background (auto-generated call summaries) to help you understand what was worked on and discussed. It is NOT client-facing text.
- Use it to: enrich the "what we worked on" framing, identify genuine wins and work delivered, and shape sensible recommendations and next steps that reflect what was actually discussed.
- NEVER quote it verbatim, and NEVER surface internal/commercial details from it in the report — e.g. pricing or contract negotiations, fees, staffing or internal frustrations, churn/cancellation risk, complaints, or anything the client would not expect to read back in their own performance report. When in doubt, leave it out.
- It is NOT a source of performance metrics. All spend/conversion/ROAS numbers must still come only from the screenshots, captions, or the structured Google Ads block. Meeting context informs qualitative narrative only.

"Work completed this period" — handle with care:
- This is an internal list (Asana task names and meeting action items). Task names use internal shorthand and frequently name individual team members or contacts — these are NOT for the client's eyes.
- Synthesise it into client-appropriate themes of delivery (e.g. "migrated your lead capture to the new CRM", "fixed a form issue on the aligner landing page", "completed quarterly and monthly optimisations"). Never reproduce raw task names, internal contact/staff names, ticket references, or internal admin chores (e.g. "send summary email to X") verbatim.
- Use it to ground the "what we worked on" narrative and the wins. It is not a source of metrics.

When asked to draft the "What we worked on" narrative (the \`worked_on\` field): write 2–4 short, client-facing sentences or up to ~5 tight bullets describing what Vendo delivered this period, drawn from the completed-work list and meeting context, in the same confident, momentum-focused voice as the rest of the report. Lead with the client-relevant outcome, not the internal task. If there is no real delivery signal, return a brief, honest line rather than padding.

Use UK English throughout. Currency is GBP (£) unless a screenshot clearly shows otherwise.

Hard rules:
- Use ONLY information visible in the screenshots, captions, or narrative. Do not fabricate metrics, percentages, monetary values, campaign names, or claims.
- If a number is unclear or partly cut off in a screenshot, omit it rather than guessing.
- **Skip inactive campaigns.** If a campaign row shows £0 spend (or zero/blank impressions/clicks) for the period, do NOT include it in the performance breakdown, wins, risks, or recommendations — it was not active and is not relevant to this report. Only discuss campaigns that actually ran during the period.
- **Dental clients:** if the client's vertical is "dental" (or the client is a dental practice), the conversion event tracked in Meta Ads is **View Content** — and the View Content campaign IS the leads campaign for this account. Treat View Content as the lead / conversion metric throughout the report. Display it as "Leads" in the breakdown (or use "View Content" if labelled that way in the screenshot). NEVER define or explain what View Content is — the client already knows. Critically: do NOT recommend "switching to Leads/Conversions objective" or "moving away from View Content" — that would be telling them to swap out the metric they're already optimising on. The recommendation set should treat View Content as the established conversion event and build on top of it (creative, audiences, budget, landing pages), not replace it.

Tone — read carefully:
- Default to **constructive, momentum-focused, positive language**. The client is reading this to feel confident in the work; default to celebrating progress and framing next steps as opportunities.
- **Mirror the framing the team used.** If "What we worked on" says something is "almost done", "in final stages", or "progressing well", reflect that tone — do NOT recast it as a delay, blocker, or risk. If the team frames a workstream positively, you frame it positively.
- Reserve cautionary or concerned language ("delays", "blocking", "risk to revenue", "cannot launch", "needs urgent attention") for situations the team has explicitly flagged as a problem in the inputs, OR where the screenshots show clear deterioration (CPL trending sharply up, conversion volume falling, ROAS dropping, etc.). Do not invent urgency.
- Do not catastrophise. Phrases like "cannot launch effectively without X" or "delays directly impact revenue" are out of bounds unless the team's narrative explicitly says so.
- Address the client directly ("you", "your campaigns"). Confident, plain English, friendly but professional. No marketing fluff.

REPORT CRAFT — the difference between a good report and a credible one:
- **Say each number ONCE.** State the headline figures (total enquiries, blended cost per lead, total spend) in the Headline, and each campaign's figures ONLY in the performance table. Do NOT restate the same metric in multiple sections — repetition reads as padding and erodes trust. Once a number is in the table, refer to the campaign by name afterwards, not by re-quoting its numbers.
- **No duplicate or near-duplicate lines.** Never list the same piece of work twice (e.g. once active, once passive). Each item appears exactly once. Don't split one action into two differently-worded items.
- **Own the trade-offs; don't soften them.** If one campaign is taking a large share of budget for few results, say so plainly and show the spend split — do NOT excuse it with "naturally carries a higher cost per lead". Confront the allocation honestly and frame the planned work as the fix. A client who does the maths must feel you've addressed it, not steered around it.
- **Earn every adjective.** Avoid empty descriptors ("strong", "excellent", "solid", "real promise") unless you can anchor them to a benchmark — a month-on-month change or a target. If there's no benchmark in the data, drop the adjective and let the number stand. "£16.34 per lead across 99 enquiries" beats "an excellent result".
- **Anchor to revenue where you can.** If booking / lead-to-booking / revenue data is present, include it — booking is usually the real goal, so a report that only counts leads is incomplete. Never invent it if absent.
- **Close with a decision.** End the recommendations with one explicit thing you need from the client — a yes/no on a specific next step — not a vague "let us know if you have questions".

Call the \`submit_report\` tool. Fill every field. \`performance_summary\` MUST be a markdown TABLE (see its description). The narrative fields are tight and non-overlapping — together they read as ONE coherent email, not repeated takes on the same facts.`;

/**
 * Channel-purity directive. This is the hard rule that keeps a report to a
 * single channel — no Meta data in a Google Ads report, etc. — plus the
 * client-facing terminology for that channel.
 */
function channelDirective(channel: ReportChannel): string {
  const label = channelLabel(channel);
  const others = (['google_ads', 'meta', 'seo'] as ReportChannel[])
    .filter(c => c !== channel)
    .map(channelLabel)
    .join(' and ');

  const terminology: Record<ReportChannel, string> = {
    google_ads:
      'This is a Google Ads (Paid Search) report. Use Paid Search terminology: "enquiries" / "leads" and "cost per lead" (£X per lead) for lead-gen; "revenue", "spend" and "ROAS" for ecommerce. Refer to campaigns by clean client-facing names (strip internal "VD |" / "Search -" prefixes).',
    meta:
      'This is a Meta (Paid Social) report. Talk only about the Meta/Facebook/Instagram ad campaigns. Use "results" / "leads", "cost per lead" / "cost per result", "ROAS" and "spend". For dental clients the Meta conversion event is View Content — treat it as the leads metric (per the dental rule). Clean campaign names; never show internal prefixes.',
    seo:
      'This is an SEO (Organic Search) report. Talk only about organic search performance: organic users/traffic, clicks, impressions, average position, keyword rankings, top pages, local map (GeoGrid) rankings, and organic leads. There is NO ad spend, CPL or ROAS in an SEO report — do not invent paid metrics.',
  };

  return `

----------------------------------------------------------------------------
CHANNEL — THIS REPORT IS ${label.toUpperCase()} ONLY.
----------------------------------------------------------------------------
${terminology[channel]}
Write EXCLUSIVELY about ${label}. Do NOT mention, compare to, or include any data, campaigns, risks, or recommendations relating to ${others}. If the internal meeting/completed-work context references ${others}, IGNORE those parts entirely — only surface ${label} work. Every section (headline, performance, watch point, next month, what-we-did) must be 100% ${label}.`;
}

/**
 * Final system prompt = base rules + channel directive + optional style
 * standard / channel-matched few-shot examples (see report-style.ts).
 */
function buildSystemPrompt(channel: ReportChannel): string {
  return `${BASE_SYSTEM_PROMPT}${channelDirective(channel)}${renderStyleAddendum(channel)}`;
}

const WORKED_ON_PROPERTY = {
  type: 'string' as const,
  description:
    'The "What we did this month" section — a markdown bullet list. Synthesise the "Work completed this period" list + meeting context into client-appropriate themes of delivery. RULES: each item appears EXACTLY ONCE (never the same action in two differently-worded bullets); use active voice ("Fixed a form issue on the aligner landing page", not "A typo fix was completed"); do NOT restate any performance metrics here (they live in the table); NEVER reproduce raw internal task names or staff/contact names. 3–6 tight bullets. If two source items are the same underlying action, merge them into one.',
};

const REPORT_PROPERTIES = {
  performance_summary: {
        type: 'string',
        description:
          'The "Performance by campaign" section — a markdown TABLE, then ONE short interpretation paragraph.\n\nTABLE columns (in this order): Campaign | Enquiries | Cost per lead | Spend | % of budget. Add a final **Total** row. Use clean client-facing campaign names (strip internal "VD |" / "Search -" prefixes). Include EVERY campaign that spent money in the period — including any marked [PAUSED] in the data (a campaign paused or removed during the month still spent and MUST appear; append " (paused)" to its name and, in the paragraph below, note it was paused during the month). Only exclude campaigns with genuinely £0 spend. The Total row must equal the full month\'s spend. "% of budget" = that campaign\'s spend ÷ total spend, as a whole percent. Terminology by account: "Enquiries"/"Leads" + "Cost per lead" for lead-gen; "Sales"/"Purchases" + "CPA" (+ a ROAS column) for ecommerce. If booking / lead-to-booking or revenue data is present, add a column for it (e.g. Bookings, or Revenue + ROAS) — booking is usually the real goal.\n\nExample:\n\n| Campaign | Enquiries | Cost per lead | Spend | % of budget |\n|---|---|---|---|---|\n| General Dentistry | 99 | £16.34 | £1,617.66 | 61% |\n| Clear Aligners | 6 | £155.48 | £932.88 | 35% |\n| Performance Max | 7 | £13.39 | £93.73 | 4% |\n| **Total** | **112** | **£23.61** | **£2,644.32** | **100%** |\n\nThen ONE short paragraph (2–4 sentences) reading the allocation honestly — which campaign is the efficient engine, which is over/under-funded relative to results, and the resulting priority. Confront trade-offs (e.g. "Clear Aligners is taking ~a third of budget for ~5% of enquiries, so the priority is to make that spend work harder") — do NOT soften with excuses. Do NOT re-list the per-campaign numbers in this paragraph; the table already shows them.',
      },
      exec_summary: {
        type: 'string',
        description:
          'The "Headline" — 2–3 sentences. State the period\'s topline ONCE (total enquiries, blended cost per lead, total spend) and the real story in one breath, including the main thing to address. Example: "112 enquiries at a blended cost per lead of £23.61, from £2,644.32 spend. General Dentistry did the heavy lifting; Performance Max was the most efficient channel; Clear Aligners remains low-volume and is the main thing to address." Plain and decisive — no empty adjectives, no benchmarks-free praise. Markdown.',
      },
      risks: {
        type: 'string',
        description:
          'The "Watch point" — the single most important issue to flag this period, owned honestly and framed as a fix-it item (not doom). 2–4 sentences or tight bullets: name the issue with its figure, acknowledge the context, state that it\'s being treated as an action (cross-reference the next-month fix), and give a reassess point (e.g. "we\'ll reassess at the end of June"). Do NOT repeat the full campaign metrics — reference the one figure that matters. If there is genuinely nothing to watch, return "- No material concerns this period." Never invent a concern.',
      },
      recommendations: {
        type: 'string',
        description:
          'The "Next month" plan — a markdown bullet list of 2–4 specific actions, each leading with the action and stating its goal (e.g. "Clear Aligners review: full search-term and keyword analysis to cut wasted spend and add tighter negatives. Goal: lift volume and bring the cost per lead down."). Then end with ONE explicit ask on its own line, prefixed "**One thing I need from you:**" — a single yes/no decision you need from the client to proceed (e.g. a go/no-go on building a new campaign). Do not pad with vague offers to "answer questions".',
      },
} as const;

/**
 * Build the submit_report tool. Using tool-use rather than free-text JSON
 * guarantees Claude returns exactly the fields we need, in the right shape,
 * and prevents JSON-truncation issues. When `draftWorkedOn` is set, the tool
 * additionally requires a client-facing `worked_on` narrative.
 */
function buildSubmitReportTool(draftWorkedOn: boolean): Tool {
  const baseRequired = ['performance_summary', 'exec_summary', 'risks', 'recommendations'];
  return {
    name: 'submit_report',
    description: 'Submit the generated sections of a monthly client performance report. Every field is required.',
    input_schema: {
      type: 'object',
      properties: draftWorkedOn
        ? { ...REPORT_PROPERTIES, worked_on: WORKED_ON_PROPERTY }
        : { ...REPORT_PROPERTIES },
      required: draftWorkedOn ? [...baseRequired, 'worked_on'] : baseRequired,
    },
  };
}

let _anthropic: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic();
  return _anthropic;
}

function platformLabel(value: ScreenshotPlatform): string {
  return PLATFORM_OPTIONS.find(p => p.value === value)?.label ?? value;
}

/**
 * Build a multimodal message: a header text block, then (when supplied) the
 * channel's canonical structured-data block, then for each screenshot a
 * labelled text block followed by the image itself, then the narrative.
 *
 * The canonical block (channelData) is channel-pure and appears BEFORE any
 * screenshots so Claude treats those numbers as authoritative (per the
 * system prompt). Screenshots are already filtered to this channel upstream.
 */
function buildUserContent(input: ReportAiInput): Array<TextBlockParam | ImageBlockParam> {
  const blocks: Array<TextBlockParam | ImageBlockParam> = [];

  const verticalLine = input.vertical ? `\nVertical: ${input.vertical}` : '';
  blocks.push({
    type: 'text',
    text: `Client: ${input.clientName}${verticalLine}\nChannel: ${channelLabel(input.channel)}\nReporting period: ${input.periodLabel}`,
  });

  if (input.channelData && input.channelData.trim()) {
    blocks.push({ type: 'text', text: `\n${input.channelData.trim()}` });
  }

  if (input.uploadedCsv && input.uploadedCsv.length) {
    const parts: string[] = ['\nUPLOADED CAMPAIGN DATA (CSV — canonical; prefer these figures, parse the rows):'];
    for (const c of input.uploadedCsv) {
      parts.push(`\n### ${c.label}\n\`\`\`csv\n${c.text}\n\`\`\``);
    }
    blocks.push({ type: 'text', text: parts.join('\n') });
  }

  if (input.changeHistory && input.changeHistory.trim()) {
    const ch = input.changeHistory.trim().slice(0, 12000);
    blocks.push({
      type: 'text',
      text:
        '\n## Account change history (internal — what was actually changed in the account this period)\n' +
        '_Use this to ground the "what we did" themes and to explain performance shifts. Synthesise into client-appropriate language — do NOT paste raw log rows, user emails, or timestamps._\n\n' +
        ch,
    });
  }

  if (input.screenshots.length === 0) {
    blocks.push({ type: 'text', text: '\n## Performance screenshots\n_No screenshots uploaded for this period._' });
  } else {
    blocks.push({ type: 'text', text: `\n## Performance screenshots (${input.screenshots.length})` });
    for (let i = 0; i < input.screenshots.length; i++) {
      const s = input.screenshots[i];
      const cap = s.caption.trim() || '(no caption provided)';
      blocks.push({
        type: 'text',
        text: `\n### Screenshot ${i + 1} — ${platformLabel(s.platform)}\nCaption: ${cap}`,
      });
      blocks.push({
        type: 'image',
        source: { type: 'url', url: s.url },
      });
    }
  }

  if (input.draftWorkedOn) {
    blocks.push({
      type: 'text',
      text:
        '\n## What we worked on\n_The team has not written this section — draft the client-facing `worked_on` narrative yourself from the "Work completed this period" list and meeting context below._',
    });
  } else {
    blocks.push({
      type: 'text',
      text: `\n## What we worked on\n${input.workedOnMd.trim() || '_(not provided)_'}`,
    });
  }

  blocks.push({
    type: 'text',
    text: `\n## Focus next period\n${input.focusNextMd.trim() || '_(not provided)_'}`,
  });

  if (input.completedWork && input.completedWork.length) {
    const parts: string[] = [
      '\n## Work completed this period (internal source — synthesise, do not reproduce verbatim)',
      '_Asana tasks closed and meeting actions. Task names contain internal shorthand and personal names — turn these into client-appropriate themes of delivery. Not a source of metrics._',
    ];
    for (const w of input.completedWork) {
      parts.push(`- [${w.source}] ${w.label} (${w.date})`);
    }
    blocks.push({ type: 'text', text: parts.join('\n') });
  }

  if (input.meetingDiscussions && input.meetingDiscussions.length) {
    const parts: string[] = [
      '\n## Internal meeting context (what was discussed this period)',
      '_Internal background only — do not quote verbatim or surface commercially sensitive detail in the client-facing report. Not a source of metrics._',
    ];
    for (const m of input.meetingDiscussions) {
      parts.push(`\n### ${m.date} — ${m.title}\n${m.summary}`);
    }
    blocks.push({ type: 'text', text: parts.join('\n') });
  }

  return blocks;
}

export async function generateReportInsights(
  input: ReportAiInput,
  userId: string | null,
): Promise<ReportAiOutput> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const content = buildUserContent(input);
  const tool = buildSubmitReportTool(!!input.draftWorkedOn);

  const response = await anthropic().messages.create({
    model: MODEL,
    system: buildSystemPrompt(input.channel),
    messages: [{ role: 'user', content }],
    max_tokens: 6000,
    temperature: 0.4,
    tools: [tool],
    tool_choice: { type: 'tool', name: 'submit_report' },
  });

  void trackUsage({
    userId,
    model: MODEL,
    feature: 'report_generation',
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  });

  // Diagnostics: log token usage + stop reason so Vercel logs surface
  // truncation issues if the model runs out of room mid-response.
  console.log('[report-ai] generated', {
    stop_reason: response.stop_reason,
    input_tokens: response.usage?.input_tokens,
    output_tokens: response.usage?.output_tokens,
    screenshots: input.screenshots.length,
  });

  const toolBlock = response.content.find(b => b.type === 'tool_use');
  if (!toolBlock || toolBlock.type !== 'tool_use' || toolBlock.name !== 'submit_report') {
    const textBlock = response.content.find(b => b.type === 'text');
    const text = textBlock && 'text' in textBlock ? textBlock.text : '';
    throw new Error(
      `Model did not call submit_report (stop_reason=${response.stop_reason}, text="${text.slice(0, 200)}")`,
    );
  }

  const args = toolBlock.input as Partial<ReportAiOutput>;
  const out: ReportAiOutput = {
    exec_summary: typeof args.exec_summary === 'string' ? args.exec_summary : '',
    performance_summary: typeof args.performance_summary === 'string' ? args.performance_summary : '',
    risks: typeof args.risks === 'string' ? args.risks : '',
    recommendations: typeof args.recommendations === 'string' ? args.recommendations : '',
    ...(input.draftWorkedOn && typeof args.worked_on === 'string' ? { worked_on: args.worked_on } : {}),
  };

  // If performance_summary came back empty despite required:true, surface it
  // — usually means tokens ran out. Don't silently swallow.
  if (!out.performance_summary.trim()) {
    console.warn('[report-ai] empty performance_summary returned', {
      stop_reason: response.stop_reason,
      output_tokens: response.usage?.output_tokens,
    });
  }

  return out;
}
