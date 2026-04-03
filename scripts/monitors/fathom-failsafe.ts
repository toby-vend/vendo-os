/**
 * Fathom Meeting Failsafe Monitor (#22)
 *
 * Scans recent meeting transcripts for churn-risk keywords:
 *   stopping, cancel, unhappy, not happy, concerned, disappointed,
 *   leaving, churn, end contract, pause, frustrated, worried
 *
 * Creates Asana tasks and alerts SLT when found.
 *
 * Usage:
 *   npx tsx scripts/monitors/fathom-failsafe.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import type { Database } from 'sql.js';
import { getDb, saveDb, closeDb, log, logError } from '../utils/db.js';
import { sendSlackMessage } from '../utils/slack-alert.js';
import { createAsanaTask } from '../utils/asana-client.js';

const MONITOR_NAME = 'fathom-failsafe';
const SLT_CHANNEL = process.env.SLACK_CHANNEL_SLT || '#slt';

const RISK_KEYWORDS = [
  'stopping', 'cancel', 'unhappy', 'not happy', 'concerned',
  'disappointed', 'leaving', 'churn', 'end contract', 'pause',
  'frustrated', 'worried',
];

// Build a single regex for efficiency
const KEYWORD_REGEX = new RegExp(`(${RISK_KEYWORDS.map(k => k.replace(/\s+/g, '\\s+')).join('|')})`, 'gi');

async function ensureAlertSchema(db: Database): Promise<void> {
  db.run(`
    CREATE TABLE IF NOT EXISTS monitor_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monitor TEXT NOT NULL,
      entity TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(monitor, entity, alert_type, date(created_at))
    )
  `);
}

function alreadyAlerted(db: Database, entity: string, alertType: string): boolean {
  const result = db.exec(
    `SELECT COUNT(*) FROM monitor_alerts
     WHERE monitor = ? AND entity = ? AND alert_type = ? AND date(created_at) = date('now')`,
    [MONITOR_NAME, entity, alertType]
  );
  return result.length > 0 && (result[0].values[0][0] as number) > 0;
}

function recordAlert(db: Database, entity: string, alertType: string, message: string): void {
  db.run(
    `INSERT OR IGNORE INTO monitor_alerts (monitor, entity, alert_type, message)
     VALUES (?, ?, ?, ?)`,
    [MONITOR_NAME, entity, alertType, message]
  );
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

function extractExcerpt(text: string, keyword: string, contextChars: number = 100): string {
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const idx = lowerText.indexOf(lowerKeyword);
  if (idx === -1) return '';

  const start = Math.max(0, idx - contextChars);
  const end = Math.min(text.length, idx + keyword.length + contextChars);
  let excerpt = text.slice(start, end).trim();

  if (start > 0) excerpt = '...' + excerpt;
  if (end < text.length) excerpt = excerpt + '...';

  return excerpt;
}

export async function run(): Promise<{ checked: number; flagged: number }> {
  const db = await getDb();
  await ensureAlertSchema(db);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];

  const meetings = queryRows(db, `
    SELECT id, title, date, client_name, transcript, summary, fathom_url
    FROM meetings
    WHERE date >= ?
    ORDER BY date DESC
  `, [sevenDaysAgo]);

  if (!meetings.length) {
    log(MONITOR_NAME, 'No meetings found in the last 7 days');
    closeDb();
    return { checked: 0, flagged: 0 };
  }

  let checked = 0;
  let flagged = 0;

  for (const meeting of meetings) {
    checked++;
    const meetingId = String(meeting.id);
    const title = (meeting.title as string) || 'Untitled meeting';
    const date = (meeting.date as string) || '';
    const clientName = (meeting.client_name as string) || 'Unknown';
    const fathomUrl = (meeting.fathom_url as string) || '';

    // Combine transcript and summary for scanning
    const text = [
      (meeting.transcript as string) || '',
      (meeting.summary as string) || '',
    ].join('\n');

    if (!text.trim()) continue;

    // Find all keyword matches
    const matches: Array<{ keyword: string; excerpt: string }> = [];
    for (const keyword of RISK_KEYWORDS) {
      if (text.toLowerCase().includes(keyword.toLowerCase())) {
        matches.push({
          keyword,
          excerpt: extractExcerpt(text, keyword),
        });
      }
    }

    if (matches.length === 0) continue;

    const alertType = 'churn-risk';
    if (alreadyAlerted(db, meetingId, alertType)) continue;

    const keywordsFound = matches.map(m => m.keyword).join(', ');
    const excerpts = matches
      .slice(0, 3) // Limit to 3 excerpts to keep messages manageable
      .map(m => `• "${m.keyword}": ${m.excerpt}`)
      .join('\n');

    const msg = `Churn-risk keywords detected in meeting: "${title}"\nClient: ${clientName}\nDate: ${date}\n${fathomUrl ? `Fathom: ${fathomUrl}\n` : ''}\nKeywords: ${keywordsFound}\n\nExcerpts:\n${excerpts}`;

    await sendSlackMessage(SLT_CHANNEL, `:rotating_light: *Meeting Churn Risk*\n${msg}`);

    await createAsanaTask({
      name: `Churn risk: ${clientName} — "${title}"`,
      notes: `${msg}\n\nAction required: review meeting context and reach out to client.`,
    });

    recordAlert(db, meetingId, alertType, msg);
    log(MONITOR_NAME, `ALERT: "${title}" (${clientName}) — keywords: ${keywordsFound}`);
    flagged++;
  }

  saveDb();
  log(MONITOR_NAME, `Scanned ${checked} meetings, flagged ${flagged} with churn-risk keywords`);
  return { checked, flagged };
}

async function main() {
  await run();
  closeDb();
}

main().catch(err => {
  logError(MONITOR_NAME, 'Failed', err);
  process.exit(1);
});
