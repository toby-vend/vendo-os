import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import { db } from './queries/base.js';
import { trackUsage } from './usage-tracker.js';

/**
 * Real-time client concern detection.
 *
 * Runs after the Fathom webhook upserts a meeting into Turso. Analyses the
 * transcript + summary with Haiku, writes the result to `meeting_concerns`,
 * and posts a Slack alert to SLACK_WEBHOOK_CONCERNS when severity is
 * critical or high. Skips internal-only meetings.
 */

const MODEL = 'claude-haiku-4-5-20251001';
const TRANSCRIPT_LIMIT = 3000;
const MONITOR_NAME = 'concern-ai';

const SYSTEM_PROMPT = `You are a client relationship analyst for Vendo Digital, a UK digital marketing agency. Analyse this meeting for client concerns.

Detect:
- Performance complaints (campaign results, KPIs, ROI dissatisfaction)
- Service quality issues (missed deadlines, poor communication, errors)
- Budget or scope disputes (cost challenges, scope creep disagreements)
- Relationship friction (trust erosion, considering alternatives, frustration with team)
- Any issue the senior leadership team should be aware of

Respond with ONLY valid JSON, no markdown fences:
{"concern_detected":true,"severity":"critical|high|medium|low","category":"performance_complaint|service_quality|budget_dispute|relationship_friction|scope_dispute|other","summary":"One sentence describing the concern","excerpts":["Relevant quote from the text"]}

If no genuine concern is found:
{"concern_detected":false,"severity":null,"category":null,"summary":null,"excerpts":[]}

Be conservative — routine feedback, constructive suggestions, or normal business discussions are NOT concerns. Only flag things that indicate a real risk to the client relationship.`;

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface ConcernResult {
  concern_detected: boolean;
  severity: Severity | null;
  category: string | null;
  summary: string | null;
  excerpts: string[];
}

export interface AnalyseInput {
  meetingId: string;
  title: string;
  date: string;
  clientName?: string | null;
  fathomUrl?: string | null;
  shareUrl?: string | null;
  transcript: string | null;
  summary: string | null;
  /** From Fathom's calendar_invitees_domains_type — only alert on external meetings. */
  domainsType?: string | null;
  /** Optional CRM matches from the Fathom webhook payload. */
  crmMatches?: {
    contacts?: Array<{ name: string; email: string; record_url?: string | null }>;
    companies?: Array<{ name: string; record_url?: string | null }>;
    deals?: Array<{ name: string; amount?: number | null; record_url?: string | null }>;
  } | null;
}

let _anthropic: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic();
  return _anthropic;
}

function parseResponse(text: string): ConcernResult {
  try {
    const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned) as ConcernResult;
    if (typeof parsed.concern_detected !== 'boolean') throw new Error('bad shape');
    return parsed;
  } catch {
    return { concern_detected: false, severity: null, category: null, summary: null, excerpts: [] };
  }
}

async function runHaiku(summary: string | null, transcript: string | null): Promise<{
  result: ConcernResult;
  callId: string;
  qualityScore: number;
  raw: string;
}> {
  const parts: string[] = [];
  if (summary) parts.push(`## Meeting Summary\n${summary}`);
  if (transcript) {
    const truncated = transcript.slice(0, TRANSCRIPT_LIMIT);
    const suffix = transcript.length > TRANSCRIPT_LIMIT ? '\n[transcript truncated]' : '';
    parts.push(`## Transcript Excerpt\n${truncated}${suffix}`);
  }

  const callId = randomUUID();
  const response = await anthropic().messages.create({
    model: MODEL,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: parts.join('\n\n') }],
    max_tokens: 300,
    temperature: 0,
  });

  // Feed the /admin/usage dashboard (fire-and-forget).
  void trackUsage({
    userId: null,
    model: MODEL,
    feature: 'concern_detection',
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  const raw = textBlock && 'text' in textBlock ? textBlock.text : '';
  const result = parseResponse(raw);
  const qualityScore = raw.trim().length > 10 ? 1 : 0;

  return { result, callId, qualityScore, raw };
}

function buildAlertMessage(input: AnalyseInput, result: ConcernResult): string {
  const severityLabel = result.severity?.toUpperCase() || 'UNKNOWN';
  const client = input.clientName || input.crmMatches?.companies?.[0]?.name || 'Unknown client';
  const excerpt = result.excerpts[0] ? `\n\n> ${result.excerpts[0]}` : '';
  const fathomLink = input.fathomUrl ? `\n<${input.fathomUrl}|View in Fathom>` : '';

  const crmLinks: string[] = [];
  if (input.crmMatches?.companies?.length) {
    for (const co of input.crmMatches.companies.slice(0, 2)) {
      if (co.record_url) crmLinks.push(`<${co.record_url}|${co.name}>`);
    }
  }
  if (input.crmMatches?.deals?.length) {
    for (const d of input.crmMatches.deals.slice(0, 2)) {
      const amt = d.amount ? ` (£${d.amount.toLocaleString()})` : '';
      if (d.record_url) crmLinks.push(`<${d.record_url}|Deal: ${d.name}${amt}>`);
    }
  }
  const crmLine = crmLinks.length ? `\n*CRM:* ${crmLinks.join(' · ')}` : '';

  return (
    `:warning: *Client Concern Detected*\n` +
    `*Client:* ${client}\n` +
    `*Meeting:* ${input.title}\n` +
    `*Date:* ${input.date.slice(0, 10)}\n` +
    `*Severity:* ${severityLabel} — ${result.category}${crmLine}\n` +
    `\n${result.summary}${excerpt}${fathomLink}`
  );
}

async function sendConcernAlert(text: string, log: { info: (...a: unknown[]) => void; warn: (...a: unknown[]) => void }): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_CONCERNS;
  if (!webhookUrl) {
    log.warn('SLACK_WEBHOOK_CONCERNS not configured — skipping alert');
    return;
  }
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    log.warn({ status: res.status, body: body.slice(0, 200) }, 'Slack webhook returned non-2xx');
  }
}

async function alreadyAlertedToday(meetingId: string): Promise<boolean> {
  const result = await db.execute({
    sql: `SELECT 1 FROM monitor_alerts
          WHERE monitor = ? AND entity = ? AND date(created_at) = date('now')
          LIMIT 1`,
    args: [MONITOR_NAME, meetingId],
  });
  return result.rows.length > 0;
}

export interface AnalyseOutput {
  analysed: boolean;
  skipped?: 'internal_only' | 'no_content' | 'missing_api_key';
  detected?: boolean;
  severity?: Severity | null;
  alerted?: boolean;
  error?: string;
}

/**
 * Analyse a meeting's content and, if severity is critical/high, post a Slack
 * alert and record the alert for dedupe. Stores the analysis result to Turso.
 * Safe to call for every webhook — silently no-ops when content is missing,
 * the meeting is internal-only, or API keys are not configured.
 */
export async function analyseAndAlert(
  input: AnalyseInput,
  log: { info: (...a: unknown[]) => void; warn: (...a: unknown[]) => void; error: (...a: unknown[]) => void },
): Promise<AnalyseOutput> {
  if (input.domainsType === 'only_internal') {
    return { analysed: false, skipped: 'internal_only' };
  }
  if (!input.summary && !input.transcript) {
    return { analysed: false, skipped: 'no_content' };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    log.warn('ANTHROPIC_API_KEY not configured — skipping concern detection');
    return { analysed: false, skipped: 'missing_api_key' };
  }

  try {
    const { result, callId, qualityScore } = await runHaiku(input.summary, input.transcript);

    await db.execute({
      sql: `INSERT INTO meeting_concerns
              (meeting_id, concern_detected, severity, category, ai_summary, excerpts, quality_score, ai_call_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(meeting_id) DO UPDATE SET
              concern_detected = excluded.concern_detected,
              severity = excluded.severity,
              category = excluded.category,
              ai_summary = excluded.ai_summary,
              excerpts = excluded.excerpts,
              quality_score = excluded.quality_score,
              ai_call_id = excluded.ai_call_id,
              created_at = excluded.created_at`,
      args: [
        input.meetingId,
        result.concern_detected ? 1 : 0,
        result.severity,
        result.category,
        result.summary,
        result.excerpts.length ? JSON.stringify(result.excerpts) : null,
        qualityScore,
        callId,
      ],
    });
    await db.execute({
      sql: 'UPDATE meetings SET concern_analysed_at = datetime(\'now\') WHERE id = ?',
      args: [input.meetingId],
    });

    if (!result.concern_detected || (result.severity !== 'critical' && result.severity !== 'high')) {
      return { analysed: true, detected: result.concern_detected, severity: result.severity, alerted: false };
    }

    if (await alreadyAlertedToday(input.meetingId)) {
      return { analysed: true, detected: true, severity: result.severity, alerted: false };
    }

    const text = buildAlertMessage(input, result);
    await sendConcernAlert(text, log);

    await db.execute({
      sql: `INSERT INTO monitor_alerts (monitor, entity, alert_type, message) VALUES (?, ?, ?, ?)`,
      args: [MONITOR_NAME, input.meetingId, result.severity, result.summary || ''],
    });

    log.info(
      { meetingId: input.meetingId, severity: result.severity, category: result.category },
      'Client concern alert sent',
    );
    return { analysed: true, detected: true, severity: result.severity, alerted: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ err, meetingId: input.meetingId }, 'Concern detection failed');
    return { analysed: false, error: msg };
  }
}
