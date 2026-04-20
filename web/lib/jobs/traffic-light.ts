import { db } from '../queries/base.js';
import { sendSlackAlert } from '../../../scripts/utils/slack-alert.js';
import { createAsanaTask } from '../../../scripts/utils/asana-client.js';
import { consoleLog } from '../monitors/base.js';

/**
 * Turso-native port of scripts/automation/traffic-light-alerts.ts. Reads
 * the latest client_health period for Red (<40) and Amber (40–70) clients,
 * creates Asana tasks, and posts Slack alerts. Red clients also page
 * SLT via SLACK_SLT_WEBHOOK_URL.
 *
 * Runs monthly (1st of month, 02:00) via /api/cron/traffic-light — should
 * fire after /api/cron/health-score finishes scoring.
 */

const LOG_SOURCE = 'traffic-light';

interface HealthRow {
  client_name: string;
  score: number;
  performance_score: number;
  relationship_score: number;
  financial_score: number;
  breakdown: string;
  period: string;
  account_manager: string | null;
}

function buildSummary(row: HealthRow): string {
  let breakdown: Record<string, number>;
  try {
    breakdown = JSON.parse(row.breakdown);
  } catch {
    return 'Low scores across multiple dimensions';
  }
  const issues: string[] = [];
  if (breakdown.adSpend === 0) issues.push('No ad spend/traffic in last 30 days');
  if (breakdown.ctr === 0 && breakdown.adSpend > 0) issues.push('Low CTR/engagement');
  if (breakdown.spendConsistency === 0) issues.push('Inconsistent activity');
  if (breakdown.recentMeeting === 0) issues.push('No meeting in 45+ days');
  else if (breakdown.recentMeeting < 8) issues.push('Meeting overdue (30+ days)');
  if (breakdown.actionsResolved === 0) issues.push('Low action item completion rate');
  if (breakdown.noOverdue === 0) issues.push('Overdue invoices');
  if (breakdown.paidOnTime === 0) issues.push('Last invoice not fully paid');
  return issues.length ? issues.join('; ') : 'Low scores across multiple dimensions';
}

function tierLabel(score: number): { tier: 'RED' | 'AMBER'; emoji: string } {
  return score < 40 ? { tier: 'RED', emoji: ':red_circle:' } : { tier: 'AMBER', emoji: ':large_orange_circle:' };
}

async function ensureAlertTable(): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS traffic_light_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      period TEXT NOT NULL,
      tier TEXT NOT NULL,
      score INTEGER NOT NULL,
      asana_task_gid TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(client_name, period)
    )
  `);
}

async function sendSltAlert(message: string): Promise<void> {
  const url = process.env.SLACK_SLT_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    });
  } catch (err) {
    consoleLog(LOG_SOURCE, `SLT Slack alert failed: ${err instanceof Error ? err.message : err}`);
  }
}

export interface TrafficLightResult {
  period: string | null;
  red: number;
  amber: number;
  skipped: number;
  durationMs: number;
}

export async function runTrafficLightAlerts(): Promise<TrafficLightResult> {
  const start = Date.now();
  await ensureAlertTable();

  const periodR = await db.execute('SELECT MAX(period) as p FROM client_health');
  const period = periodR.rows[0]?.p as string | null;
  if (!period) {
    consoleLog(LOG_SOURCE, 'No client_health data — run health-score first');
    return { period: null, red: 0, amber: 0, skipped: 0, durationMs: Date.now() - start };
  }

  const { rows } = await db.execute({
    sql: `SELECT ch.client_name, ch.score, ch.performance_score, ch.relationship_score,
                 ch.financial_score, ch.breakdown, ch.period, c.am AS account_manager
          FROM client_health ch
          LEFT JOIN clients c ON c.name = ch.client_name
          WHERE ch.period = ? AND ch.score < 70
          ORDER BY ch.score ASC`,
    args: [period],
  });
  if (!rows.length) {
    consoleLog(LOG_SOURCE, 'All clients healthy — no alerts');
    return { period, red: 0, amber: 0, skipped: 0, durationMs: Date.now() - start };
  }

  const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  let redCount = 0;
  let amberCount = 0;
  let skippedCount = 0;

  for (const row of rows as unknown as HealthRow[]) {
    const existing = await db.execute({
      sql: 'SELECT 1 FROM traffic_light_alerts WHERE client_name = ? AND period = ? LIMIT 1',
      args: [row.client_name, row.period],
    });
    if (existing.rows.length) { skippedCount++; continue; }

    const { tier, emoji } = tierLabel(row.score);
    const summary = buildSummary(row);
    const isRed = row.score < 40;
    if (isRed) redCount++; else amberCount++;

    const task = await createAsanaTask({
      name: `[${tier}] Client health alert: ${row.client_name} (${row.score}/100)`,
      notes: [
        `Client: ${row.client_name}`,
        `Health Score: ${row.score}/100 (${tier})`,
        `Performance: ${row.performance_score}/40 | Relationship: ${row.relationship_score}/30 | Financial: ${row.financial_score}/30`,
        '',
        `Issues: ${summary}`,
        '',
        'Action required: Review client status and create intervention plan.',
        row.account_manager ? `\nAccount Manager: ${row.account_manager}` : '',
      ].join('\n'),
      dueDate,
      assigneeEmail: row.account_manager || undefined,
    });
    const taskGid = task?.gid ?? null;

    await sendSlackAlert(
      'traffic-light',
      `${emoji} *${tier} Alert — ${row.client_name}*\nScore: ${row.score}/100 | ${summary}`,
      isRed ? 'error' : 'warning',
    );

    if (isRed) {
      await sendSltAlert(
        `:rotating_light: *CRITICAL CLIENT ALERT — ${row.client_name}*\n` +
        `Health Score: ${row.score}/100\n` +
        `Performance: ${row.performance_score}/40 | Relationship: ${row.relationship_score}/30 | Financial: ${row.financial_score}/30\n` +
        `Issues: ${summary}\nImmediate intervention required.`,
      );
    }

    await db.execute({
      sql: `INSERT INTO traffic_light_alerts (client_name, period, tier, score, asana_task_gid, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [row.client_name, row.period, tier, row.score, taskGid, new Date().toISOString()],
    });
  }

  const durationMs = Date.now() - start;
  consoleLog(LOG_SOURCE, `Period ${period}: ${redCount} red, ${amberCount} amber, ${skippedCount} already alerted in ${durationMs}ms`);
  return { period, red: redCount, amber: amberCount, skipped: skippedCount, durationMs };
}
