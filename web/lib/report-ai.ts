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
import type { ImageBlockParam, TextBlockParam } from '@anthropic-ai/sdk/resources/messages.js';
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

const SYSTEM_PROMPT = `You are a senior account director at Vendo Digital, a UK digital marketing agency. You are drafting the AI-generated sections of a monthly client performance report that will be sent as an email-style report to the client.

You will be given:
- Client name and reporting period
- One or more performance screenshots — each prefixed with a header line that names the platform (e.g. Google Ads, Meta) and any caption the account team wrote. **Read the actual numbers off the charts and tables in the images** (spend, clicks, impressions, conversions, purchases, CTR, ROAS, CPC, CPL, lead counts, revenue, comparison-period deltas, per-campaign breakdowns, etc.) and use them in your output.
- A "What we worked on" narrative
- A "Focus next period" narrative

Produce FIVE markdown sections in UK English:

1. **exec_summary** — 2–4 sentences pulling out the headline story. Quote the most important specific numbers visible in the screenshots. Reference platforms by name.

2. **performance_summary** — A structured metric breakdown that mirrors this style:

\`\`\`
**Overall [Platform] Performance:**
- Amount Spent: £X
- Clicks: X
- Revenue: £X
- ROAS: X.XX
(other top-level metrics visible)

**Individual Campaign Performance:**

*Campaign Name 1*
- Spend: £X
- Purchases: X
- Revenue: £X
- ROAS: X.XX

*Campaign Name 2*
- Spend: £X
...
\`\`\`

Cover EVERY platform present in the screenshots (Meta, Google Ads, etc.) — give each its own "Overall [Platform] Performance" subsection. Include per-campaign breakdowns when individual campaign rows are visible in the screenshots. Use the exact campaign names shown. List the metrics that actually appear; don't pad with metrics that aren't there.

3. **wins** — bullet list of 2–5 wins. Each bullet starts with a strong verb and cites a concrete metric from the screenshots or narrative wherever possible.

4. **risks** — bullet list of 1–4 risks or concerns spotted in the data (CPL trending up, conversion volume falling, spend rising without conversions, dropped impressions, etc.). If genuinely nothing concerning shows up, write a single bullet: "No material risks flagged for this period." Do not invent risks.

5. **recommendations** — bullet list of 2–4 specific, actionable next steps that follow from the risks, the metrics, and the focus-next narrative.

Hard rules:
- Use ONLY information visible in the screenshots, captions, or narrative. Do not fabricate metrics, percentages, monetary values, campaign names, or claims.
- If a number is unclear or partly cut off in a screenshot, omit it rather than guessing.
- Currency: assume GBP (£) unless a screenshot clearly shows another currency.
- Tone: confident, plain English, friendly but professional. Address the client directly ("you", "your campaigns").

Respond with ONLY valid JSON, no markdown fences:
{"exec_summary":"...","performance_summary":"...","wins":"- ...\\n- ...","risks":"- ...","recommendations":"- ...\\n- ..."}`;

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

function parseResponse(text: string): ReportAiOutput {
  const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Model returned non-JSON: ${cleaned.slice(0, 200)}`);
  }

  const requiredKeys: (keyof ReportAiOutput)[] = ['exec_summary', 'performance_summary', 'wins', 'risks', 'recommendations'];
  for (const key of requiredKeys) {
    if (typeof parsed[key] !== 'string') {
      throw new Error(`Model response missing or invalid field: ${key}`);
    }
  }
  return {
    exec_summary: parsed.exec_summary,
    performance_summary: parsed.performance_summary,
    wins: parsed.wins,
    risks: parsed.risks,
    recommendations: parsed.recommendations,
  };
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
    max_tokens: 4000,
    temperature: 0.4,
  });

  void trackUsage({
    userId,
    model: MODEL,
    feature: 'report_generation',
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  });

  const textBlock = response.content.find(b => b.type === 'text');
  const raw = textBlock && 'text' in textBlock ? textBlock.text : '';
  return parseResponse(raw);
}
