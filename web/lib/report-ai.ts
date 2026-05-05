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
 * Cross-reference:
 *   - Memory: feedback_client_reports_rules.md (in
 *     ~/.claude/projects/-Users-Toby-1-Vendo-OS/memory/) keeps the same
 *     rules canonical for future Claude Code sessions.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { ImageBlockParam, TextBlockParam, Tool } from '@anthropic-ai/sdk/resources/messages.js';
import { trackUsage } from './usage-tracker.js';
import { PLATFORM_OPTIONS, type ScreenshotPlatform } from './queries/reports.js';

const MODEL = 'claude-sonnet-4-6';

export interface ReportAiInput {
  clientName: string;
  vertical: string | null;
  periodLabel: string;
  workedOnMd: string;
  focusNextMd: string;
  screenshots: Array<{
    platform: ScreenshotPlatform;
    caption: string;
    url: string;
  }>;
}

export interface ReportAiOutput {
  exec_summary: string;
  performance_summary: string;
  wins: string;
  risks: string;
  recommendations: string;
}

const SYSTEM_PROMPT = `You are a senior account director at Vendo Digital, a UK digital marketing agency. You are drafting the AI-generated sections of a monthly client performance report.

You will be given:
- Client name and reporting period
- One or more performance screenshots — each prefixed with a header naming the platform (Google Ads, Meta, etc.) and any caption the account team wrote. **Read the actual numbers off the charts and tables in the images** — spend, clicks, impressions, conversions, purchases, CTR, ROAS, CPC, CPL, lead counts, revenue, comparison-period deltas, per-campaign breakdowns — and use them in your output.
- A "What we worked on" narrative
- A "Focus next period" narrative

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

Call the \`submit_report\` tool with all five fields filled in. Every field is required — do not return an empty string for any of them. The performance_summary field MUST contain a structured metric breakdown extracted from the screenshots; the others are short narrative blocks.`;

/**
 * Tool definition for the structured report output. Using tool-use rather
 * than free-text JSON guarantees Claude returns exactly the five fields we
 * need, in the right shape, and prevents JSON-truncation issues.
 */
const SUBMIT_REPORT_TOOL: Tool = {
  name: 'submit_report',
  description: 'Submit the five generated sections of a monthly client performance report. Every field is required.',
  input_schema: {
    type: 'object',
    properties: {
      performance_summary: {
        type: 'string',
        description:
          'Markdown metric breakdown extracted from the screenshots. Section ordering matters — follow this layout exactly:\n\n**1. CRM funnel (only if visible in screenshots)** — for dental / lead-gen / B2B accounts, when a CRM screenshot is provided (Go High Level / GHL, Boxly, HubSpot, etc.) this comes FIRST under a heading like "Go High Level Leads:" or "Boxly:". List each campaign\'s funnel breakdown showing the lead lifecycle exactly as it appears (e.g. Lead → Follow Up → Scheduled / Booked → Won / Lost), with counts. Format example:\n\n**Go High Level Leads:**\n- Dental Implants: 17\n  - Lead: 2\n  - Follow Up: 9\n  - Scheduled: 4\n  - Won: 1\n  - Lost: 1\n\n**2. Overall [Platform] Performance** — for each ad platform that appears (Meta, Google Ads, etc.), give a top-line summary subsection. Format example:\n\n**Overall Meta Performance:**\n- Spend: £10,568.74\n- Purchases: 258\n- Revenue: £115,937.93\n- ROAS: 10.97\n\n**3. Individual Campaign Performance** — per-campaign rows.\n\nEXCLUDE any campaign row with £0 spend (or zero/blank impressions and clicks) — those campaigns were not active.\n\n**Per-campaign rows must be tight and bottom-funnel only.** Use these metrics:\n  - Spend\n  - Conversion volume — labelled per the account: "Purchases" (ecom), "Results (View Content)" (dental on Meta), "Results (Lead Forms)" (instant-form lead-gen), "Leads" or "Results (website leads)" (other)\n  - **CPR** (Cost per Result) — Vendo\'s preferred term for cost per conversion. Derive from Spend ÷ conversions if not shown.\n  - ROAS / Purchase ROAS (ecom) OR omit if there is no revenue tracked\n\nDo NOT include impressions, reach, frequency, CPM, CTR, CPC, or other upper-funnel vanity metrics in the per-campaign rows — those go in the narrative blocks (wins / risks / This Month) only when they tell a real story.\n\nUse the exact campaign names shown. Vendo campaigns are typically prefixed "VD |" and follow the pattern "VD | [Type] | [Audience] | [Optimisation]" (e.g. "VD | Dental Implant | Lead - View Content", "VD | Sales | All Products | Broad | CBO"). Preserve them verbatim. Format examples:\n\n*VD | Dental Implant | Lead - View Content*\n- Spend: £985.27\n- Results (View Content): 16\n- CPR: £61.58\n\n*VD | Sales | All Products | Broad | CBO*\n- Spend: £2,551.85\n- Purchases: 66\n- CPR: £38.66 (per purchase)\n- Purchase ROAS: 14.19',
      },
      exec_summary: {
        type: 'string',
        description:
          'Two to four sentences summarising the headline story for the period. Quote the most important specific numbers visible in the screenshots. Reference platforms by name. Markdown.',
      },
      wins: {
        type: 'string',
        description:
          'Markdown bullet list of 2–5 wins from the period. Each bullet starts with a strong verb and cites a concrete metric where possible. Where the screenshots / narrative reveal which specific creatives, ad sets, or messaging themes drove the strongest results, name them — Vendo reports often call out top performers by theme (e.g. "location-specific messaging", "denture pain-point hooks", "process-focused Smile Makeover ad", "Beginner / Intermediate / Advanced video"). Do NOT invent themes if the inputs don\'t identify which creatives won.',
      },
      risks: {
        type: 'string',
        description:
          'Markdown bullet list of 1–4 risks or concerns spotted in the data (CPL trending up, conversion volume falling, spend rising without conversions, dropped impressions, etc.). If genuinely nothing concerning shows up, return a single bullet: "- No material risks flagged for this period." Do not invent risks.',
      },
      recommendations: {
        type: 'string',
        description:
          'Markdown bullet list of 2–4 specific, actionable next steps that follow from the risks, the metrics, and the focus-next narrative. Vendo "Next Month & Ongoing" sections typically cover: upcoming content shoot days and what they\'ll capture, new campaign launches that depend on incoming creative or landing pages, creative refreshes, A/B tests being introduced, and tooling additions (e.g. Motion for creative analysis). Frame as forward momentum, not as overdue work.',
      },
    },
    required: ['performance_summary', 'exec_summary', 'wins', 'risks', 'recommendations'],
  },
};

let _anthropic: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic();
  return _anthropic;
}

function platformLabel(value: ScreenshotPlatform): string {
  return PLATFORM_OPTIONS.find(p => p.value === value)?.label ?? value;
}

/**
 * Build a multimodal message: a header text block, then for each screenshot
 * a labelled text block followed by the image itself, then the narrative.
 *
 * Interleaving the platform/caption text immediately before each image gives
 * Claude a clear "this chart is Google Ads, here's what the AM said about it"
 * grouping rather than dumping all images and then all text.
 */
function buildUserContent(input: ReportAiInput): Array<TextBlockParam | ImageBlockParam> {
  const blocks: Array<TextBlockParam | ImageBlockParam> = [];

  const verticalLine = input.vertical ? `\nVertical: ${input.vertical}` : '';
  blocks.push({
    type: 'text',
    text: `Client: ${input.clientName}${verticalLine}\nReporting period: ${input.periodLabel}`,
  });

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

  blocks.push({
    type: 'text',
    text: `\n## What we worked on\n${input.workedOnMd.trim() || '_(not provided)_'}`,
  });

  blocks.push({
    type: 'text',
    text: `\n## Focus next period\n${input.focusNextMd.trim() || '_(not provided)_'}`,
  });

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

  const response = await anthropic().messages.create({
    model: MODEL,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content }],
    max_tokens: 6000,
    temperature: 0.4,
    tools: [SUBMIT_REPORT_TOOL],
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
    wins: typeof args.wins === 'string' ? args.wins : '',
    risks: typeof args.risks === 'string' ? args.risks : '',
    recommendations: typeof args.recommendations === 'string' ? args.recommendations : '',
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
