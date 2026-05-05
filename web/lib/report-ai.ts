/**
 * AI generation for client reports.
 *
 * Takes the structured report inputs (screenshots, narrative) and produces four
 * polished markdown blocks: executive summary, wins, risks, recommendations.
 *
 * Conservative by design — the prompt explicitly forbids fabricating numbers.
 * The model can only reason from what's in the screenshot captions and narrative.
 */
import Anthropic from '@anthropic-ai/sdk';
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
  }>;
}

export interface ReportAiOutput {
  exec_summary: string;
  wins: string;
  risks: string;
  recommendations: string;
}

const SYSTEM_PROMPT = `You are a senior account director at Vendo Digital, a UK digital marketing agency. You are drafting four sections of a monthly client performance report.

You will be given:
- Client name and reporting period
- A list of performance screenshots, each tagged with a platform (e.g. Google Ads, Meta) and an optional caption written by the account team
- A "What we worked on" narrative
- A "Focus next period" narrative

Produce four short, polished markdown sections in UK English:
1. **Executive summary** — 2–4 sentences pulling out the headline story from the period. Reference platforms by name. If the captions or narrative mention specific numbers, you may quote them; do not invent any.
2. **Wins** — bullet list of 2–5 wins. Each bullet starts with a strong verb and is grounded in the captions/narrative.
3. **Risks** — bullet list of 1–4 risks or concerns. If there are none signalled in the inputs, write a single bullet: "No material risks flagged for this period." Do not invent risks.
4. **Recommendations** — bullet list of 2–4 specific, actionable next steps that follow from the risks and the focus-next narrative.

Hard rules:
- Use ONLY information present in the inputs. Do not fabricate metrics, percentages, monetary values, or claims.
- Where data is sparse, say so clearly rather than padding.
- Tone: confident, plain English, no marketing fluff. Address the client directly ("you", "your campaigns").
- Keep each section tight — no rambling paragraphs.

Respond with ONLY valid JSON, no markdown fences:
{"exec_summary":"...","wins":"- ...\\n- ...","risks":"- ...","recommendations":"- ...\\n- ..."}`;

let _anthropic: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic();
  return _anthropic;
}

function platformLabel(value: ScreenshotPlatform): string {
  return PLATFORM_OPTIONS.find(p => p.value === value)?.label ?? value;
}

function buildUserMessage(input: ReportAiInput): string {
  const parts: string[] = [];
  parts.push(`Client: ${input.clientName}`);
  parts.push(`Reporting period: ${input.periodLabel}`);

  if (input.screenshots.length === 0) {
    parts.push('\n## Performance screenshots\n_No screenshots uploaded for this period._');
  } else {
    parts.push('\n## Performance screenshots');
    for (const s of input.screenshots) {
      const cap = s.caption.trim() || '(no caption provided)';
      parts.push(`- **${platformLabel(s.platform)}**: ${cap}`);
    }
  }

  parts.push('\n## What we worked on');
  parts.push(input.workedOnMd.trim() || '_(not provided)_');

  parts.push('\n## Focus next period');
  parts.push(input.focusNextMd.trim() || '_(not provided)_');

  return parts.join('\n');
}

function parseResponse(text: string): ReportAiOutput {
  const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Model returned non-JSON: ${cleaned.slice(0, 200)}`);
  }

  const requiredKeys: (keyof ReportAiOutput)[] = ['exec_summary', 'wins', 'risks', 'recommendations'];
  for (const key of requiredKeys) {
    if (typeof parsed[key] !== 'string') {
      throw new Error(`Model response missing or invalid field: ${key}`);
    }
  }
  return {
    exec_summary: parsed.exec_summary,
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

  const userMessage = buildUserMessage(input);

  const response = await anthropic().messages.create({
    model: MODEL,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
    max_tokens: 1500,
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
