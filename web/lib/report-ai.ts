/**
 * AI generation for client reports.
 *
 * Takes the structured report inputs (screenshots, narrative) and produces five
 * polished markdown blocks: executive summary, performance summary (overall +
 * per-campaign metric breakdown), wins, risks, recommendations.
 *
 * The screenshots themselves are sent to Claude as image content blocks (URL
 * sources pointing at Vercel Blob), so the model can read metrics directly off
 * the charts — spend, conversions, ROAS, CTR, etc. — and weave those numbers
 * into the narrative.
 *
 * The prompt still forbids fabricating numbers: anything Claude states must
 * either appear in the screenshot, the caption, or the narrative.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { ImageBlockParam, TextBlockParam, Tool } from '@anthropic-ai/sdk/resources/messages.js';
import { trackUsage } from './usage-tracker.js';
import { PLATFORM_OPTIONS, type ScreenshotPlatform } from './queries/reports.js';

const MODEL = 'claude-sonnet-4-6';

export interface ReportAiInput {
  clientName: string;
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
- Tone: confident, plain English, friendly but professional. Address the client directly ("you", "your campaigns").

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
          'Markdown metric breakdown extracted from the screenshots. Cover EVERY platform that appears (Meta, Google Ads, etc.) — give each its own "Overall [Platform] Performance" subsection followed by an "Individual Campaign Performance" block.\n\nEXCLUDE any campaign row with £0 spend (or zero/blank impressions and clicks) — those campaigns were not active in the period.\n\n**Per-campaign rows must be tight and bottom-funnel only.** Show ONLY these four metrics per campaign — nothing else:\n  - Spend\n  - Purchases (or Leads / Conversions / Bookings — whichever conversion metric the screenshot shows for this client)\n  - Cost per Purchase (or Cost per Lead / CPA — derive from Spend ÷ conversions if not shown directly)\n  - ROAS (for ecom / revenue-tracked accounts) OR Conversion Rate (for lead-gen accounts where ROAS is not tracked)\n\nDo NOT include impressions, reach, frequency, CPM, CTR, CPC, or other upper-funnel "vanity" metrics in the per-campaign rows — those are meaningful in narrative context (wins / risks / This Month) only if they tell a real story, not in the breakdown.\n\nThe "Overall [Platform] Performance" subsection can include slightly more breadth (e.g. total Spend, total Purchases, total Revenue, blended ROAS) since it is a top-line summary, but keep it focused — same rule against vanity metrics applies.\n\nUse the exact campaign names shown. Format example:\n\n**Overall Meta Performance:**\n- Spend: £10,568.74\n- Purchases: 258\n- Revenue: £115,937.93\n- ROAS: 10.97\n\n**Individual Campaign Performance:**\n\n*VD | Sales | All Products | Broad | CBO*\n- Spend: £2,551.85\n- Purchases: 66\n- Cost per Purchase: £38.66\n- ROAS: 14.19\n\n*VD | Sales | All Products | Prospecting | New Purchase*\n- Spend: £2,810.56\n- Purchases: 61\n- Cost per Purchase: £46.07\n- ROAS: 9.38',
      },
      exec_summary: {
        type: 'string',
        description:
          'Two to four sentences summarising the headline story for the period. Quote the most important specific numbers visible in the screenshots. Reference platforms by name. Markdown.',
      },
      wins: {
        type: 'string',
        description:
          'Markdown bullet list of 2–5 wins. Each bullet starts with a strong verb and cites a concrete metric from the screenshots or narrative wherever possible.',
      },
      risks: {
        type: 'string',
        description:
          'Markdown bullet list of 1–4 risks or concerns spotted in the data (CPL trending up, conversion volume falling, spend rising without conversions, dropped impressions, etc.). If genuinely nothing concerning shows up, return a single bullet: "- No material risks flagged for this period." Do not invent risks.',
      },
      recommendations: {
        type: 'string',
        description:
          'Markdown bullet list of 2–4 specific, actionable next steps that follow from the risks, the metrics, and the focus-next narrative.',
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

  blocks.push({
    type: 'text',
    text: `Client: ${input.clientName}\nReporting period: ${input.periodLabel}`,
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
