/**
 * AI Client Concern Detection
 *
 * Analyses meeting summaries and transcripts for client concerns using Haiku.
 * Flags issues to #claude-client-issues on Slack when severity is critical/high.
 *
 * Can run standalone:
 *   npx tsx scripts/analysis/detect-concerns.ts
 *
 * Or as part of process-meetings.ts / run-all-monitors.ts via the run() export.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import type { Database } from 'sql.js';
import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';
import { aiCall } from '../utils/ai-wrapper.js';

const MONITOR_NAME = 'concern-ai';

async function sendConcernAlert(text: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_CONCERNS;
  if (!webhookUrl) {
    log('CONCERNS', 'SLACK_WEBHOOK_CONCERNS not set — skipping Slack alert');
    return;
  }
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      logError('CONCERNS', `Slack webhook returned ${res.status}: ${await res.text()}`);
    }
  } catch (err) {
    logError('CONCERNS', 'Failed to send Slack alert', err);
  }
}
const EXCLUDED_CATEGORIES = ['interview', 'internal', 'onboarding'];
const TRANSCRIPT_LIMIT = 3000; // chars — keeps Haiku costs low

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

export interface ConcernResult {
  concern_detected: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low' | null;
  category: string | null;
  summary: string | null;
  excerpts: string[];
}

function queryRows(db: Database, sql: string, params: unknown[] = []): Record<string, unknown>[] {
  const result = db.exec(sql, params);
  if (!result.length) return [];
  const cols = result[0].columns;
  return result[0].values.map((row: unknown[]) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((c: string, i: number) => obj[c] = row[i]);
    return obj;
  });
}

function alreadyAlerted(db: Database, meetingId: string): boolean {
  const result = db.exec(
    `SELECT COUNT(*) FROM monitor_alerts
     WHERE monitor = ? AND entity = ? AND date(created_at) = date('now')`,
    [MONITOR_NAME, meetingId],
  );
  return result.length > 0 && (result[0].values[0][0] as number) > 0;
}

export async function analyseConcerns(
  summary: string | null,
  transcript: string | null,
): Promise<{ result: ConcernResult; callId: string; qualityScore: number }> {
  const parts: string[] = [];
  if (summary) parts.push(`## Meeting Summary\n${summary}`);
  if (transcript) {
    const truncated = transcript.slice(0, TRANSCRIPT_LIMIT);
    const suffix = transcript.length > TRANSCRIPT_LIMIT ? '\n[transcript truncated]' : '';
    parts.push(`## Transcript Excerpt\n${truncated}${suffix}`);
  }

  const inputText = parts.join('\n\n');

  const aiResult = await aiCall('concern-detection', {
    model: 'claude-haiku-4-5-20251001',
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: inputText }],
    maxTokens: 300,
    temperature: 0,
    qualityThreshold: 0.3,
  });

  let parsed: ConcernResult;
  try {
    // Strip markdown fences if present
    const cleaned = aiResult.text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    logError('CONCERNS', `Failed to parse AI response: ${aiResult.text.slice(0, 200)}`);
    parsed = { concern_detected: false, severity: null, category: null, summary: null, excerpts: [] };
  }

  return { result: parsed, callId: aiResult.callId, qualityScore: aiResult.qualityScore };
}

export async function run(options?: { reprocess?: boolean }): Promise<{ checked: number; flagged: number }> {
  const db = await getDb();

  // Ensure monitor_alerts table exists (same schema as fathom-failsafe)
  db.run(`
    CREATE TABLE IF NOT EXISTS monitor_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monitor TEXT NOT NULL,
      entity TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  if (options?.reprocess) {
    db.run('DELETE FROM meeting_concerns');
    db.run('UPDATE meetings SET concern_analysed_at = NULL');
    saveDb();
  }

  const excludedList = EXCLUDED_CATEGORIES.map(() => '?').join(', ');
  const meetings = queryRows(db, `
    SELECT id, title, date, client_name, summary, transcript, url
    FROM meetings
    WHERE concern_analysed_at IS NULL
      AND (category IS NULL OR category NOT IN (${excludedList}))
      AND (summary IS NOT NULL OR transcript IS NOT NULL)
    ORDER BY date DESC
  `, [...EXCLUDED_CATEGORIES]);

  if (!meetings.length) {
    log('CONCERNS', 'No unanalysed client-facing meetings');
    return { checked: 0, flagged: 0 };
  }

  log('CONCERNS', `Analysing ${meetings.length} meetings for client concerns...`);

  let checked = 0;
  let flagged = 0;

  for (const meeting of meetings) {
    const meetingId = String(meeting.id);
    const title = (meeting.title as string) || 'Untitled';
    const clientName = (meeting.client_name as string) || 'Unknown';
    const date = (meeting.date as string) || '';
    const summary = meeting.summary as string | null;
    const transcript = meeting.transcript as string | null;
    const fathomUrl = (meeting.url as string) || '';

    try {
      const { result, callId, qualityScore } = await analyseConcerns(summary, transcript);
      checked++;

      // Store result
      db.run(`
        INSERT OR REPLACE INTO meeting_concerns
          (meeting_id, concern_detected, severity, category, ai_summary, excerpts, quality_score, ai_call_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `, [
        meetingId,
        result.concern_detected ? 1 : 0,
        result.severity,
        result.category,
        result.summary,
        result.excerpts.length > 0 ? JSON.stringify(result.excerpts) : null,
        qualityScore,
        callId,
      ]);

      db.run('UPDATE meetings SET concern_analysed_at = datetime(\'now\') WHERE id = ?', [meetingId]);

      if (result.concern_detected && (result.severity === 'critical' || result.severity === 'high')) {
        flagged++;

        if (!alreadyAlerted(db, meetingId)) {
          const severityLabel = result.severity.toUpperCase();
          const excerpt = result.excerpts[0] ? `\n\n> ${result.excerpts[0]}` : '';
          const fathomLink = fathomUrl ? `\n<${fathomUrl}|View in Fathom>` : '';

          // Slack alert
          await sendConcernAlert(
            `:warning: *Client Concern Detected*\n` +
            `*Client:* ${clientName}\n` +
            `*Meeting:* ${title}\n` +
            `*Date:* ${date.slice(0, 10)}\n` +
            `*Severity:* ${severityLabel} — ${result.category}\n` +
            `\n${result.summary}${excerpt}${fathomLink}`,
          );

          db.run(
            `INSERT OR IGNORE INTO monitor_alerts (monitor, entity, alert_type, message)
             VALUES (?, ?, ?, ?)`,
            [MONITOR_NAME, meetingId, result.severity, result.summary || ''],
          );

          log('CONCERNS', `ALERT: "${title}" (${clientName}) — ${result.severity}: ${result.summary}`);
        }
      }

      // Save periodically
      if (checked % 10 === 0) {
        saveDb();
        log('CONCERNS', `Progress: ${checked}/${meetings.length} analysed, ${flagged} flagged`);
      }
    } catch (err) {
      logError('CONCERNS', `Failed to analyse meeting ${meetingId} "${title}"`, err);
      // Mark as analysed to avoid retrying broken meetings endlessly
      db.run('UPDATE meetings SET concern_analysed_at = datetime(\'now\') WHERE id = ?', [meetingId]);
    }
  }

  saveDb();
  log('CONCERNS', `Done: ${checked} analysed, ${flagged} flagged`);
  return { checked, flagged };
}

// Standalone execution
if (process.argv[1]?.endsWith('detect-concerns.ts') || process.argv[1]?.endsWith('detect-concerns.js')) {
  initSchema()
    .then(() => run({ reprocess: process.argv.includes('--reprocess') }))
    .then(() => closeDb())
    .catch((err) => {
      logError('CONCERNS', 'Failed', err);
      process.exit(1);
    });
}
