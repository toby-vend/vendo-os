/**
 * Traffic Light Alerts — Red/Amber client health alerts with Asana tasks and Slack notifications.
 *
 * Reads client_health for Red (<40) and Amber (40-70) clients,
 * creates Asana tasks assigned to the account manager, and posts Slack alerts.
 * Red clients also alert #slt.
 *
 * Deduplicates: will not re-alert the same client for the same period.
 *
 * Requires: ASANA_API_KEY, ASANA_WORKSPACE_GID, SLACK_WEBHOOK_URL, SLACK_SLT_WEBHOOK_URL
 *
 * Usage:
 *   npx tsx scripts/automation/traffic-light-alerts.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';
import { sendSlackAlert } from '../utils/slack-alert.js';

const ASANA_API_KEY = process.env.ASANA_API_KEY || '';
const ASANA_WORKSPACE_GID = process.env.ASANA_WORKSPACE_GID || '';
const ASANA_BASE_URL = 'https://app.asana.com/api/1.0';
const SLACK_SLT_WEBHOOK = process.env.SLACK_SLT_WEBHOOK_URL || '';

// Asana user map: lowercase name → GID
let asanaUserMap: Map<string, string> = new Map();

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

async function loadAsanaUsers(): Promise<void> {
  if (!ASANA_API_KEY || !ASANA_WORKSPACE_GID) return;

  try {
    const res = await fetch(`${ASANA_BASE_URL}/users?workspace=${ASANA_WORKSPACE_GID}&opt_fields=name`, {
      headers: { 'Authorization': `Bearer ${ASANA_API_KEY}`, 'Accept': 'application/json' },
    });
    if (!res.ok) return;
    const json = await res.json() as { data: { gid: string; name: string }[] };

    for (const u of json.data) {
      asanaUserMap.set(u.name.toLowerCase(), u.gid);
      const firstName = u.name.split(' ')[0].toLowerCase();
      if (!asanaUserMap.has(firstName)) asanaUserMap.set(firstName, u.gid);
    }
    log('TRAFFIC-LIGHT', `Loaded ${json.data.length} Asana users`);
  } catch (err) {
    logError('TRAFFIC-LIGHT', 'Failed to load Asana users', err);
  }
}

function resolveAsanaUser(name?: string | null): string | undefined {
  if (!name) return undefined;
  const lower = name.toLowerCase().trim();
  return asanaUserMap.get(lower) || asanaUserMap.get(lower.split(' ')[0]);
}

async function asanaCreateTask(name: string, notes: string, dueOn: string, assigneeGid?: string): Promise<string | null> {
  if (!ASANA_API_KEY || !ASANA_WORKSPACE_GID) return null;

  try {
    const taskData: Record<string, unknown> = {
      name,
      notes,
      due_on: dueOn,
      workspace: ASANA_WORKSPACE_GID,
    };
    if (assigneeGid) {
      taskData.assignee = assigneeGid;
    }

    const res = await fetch(`${ASANA_BASE_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ASANA_API_KEY}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: taskData }),
    });

    if (!res.ok) {
      const body = await res.text();
      logError('TRAFFIC-LIGHT', `Asana task creation failed: ${res.status} ${body}`);
      return null;
    }

    const json = await res.json() as { data: { gid: string } };
    return json.data.gid;
  } catch (err) {
    logError('TRAFFIC-LIGHT', 'Asana task creation error', err);
    return null;
  }
}

async function sendSltAlert(message: string): Promise<void> {
  if (!SLACK_SLT_WEBHOOK) return;

  try {
    await fetch(SLACK_SLT_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    });
  } catch (err) {
    logError('TRAFFIC-LIGHT', 'SLT Slack alert failed', err);
  }
}

function buildSummary(row: HealthRow): string {
  const breakdown = JSON.parse(row.breakdown);
  const issues: string[] = [];

  // Performance issues
  if (breakdown.adSpend === 0) issues.push('No ad spend/traffic in last 30 days');
  if (breakdown.ctr === 0 && breakdown.adSpend > 0) issues.push('Low CTR/engagement');
  if (breakdown.spendConsistency === 0) issues.push('Inconsistent activity');

  // Relationship issues
  if (breakdown.recentMeeting === 0) issues.push('No meeting in 45+ days');
  else if (breakdown.recentMeeting < 8) issues.push('Meeting overdue (30+ days)');
  if (breakdown.actionsResolved === 0) issues.push('Low action item completion rate');

  // Financial issues
  if (breakdown.noOverdue === 0) issues.push('Overdue invoices');
  if (breakdown.paidOnTime === 0) issues.push('Last invoice not fully paid');

  return issues.length > 0 ? issues.join('; ') : 'Low scores across multiple dimensions';
}

function tierLabel(score: number): { tier: string; emoji: string } {
  if (score < 40) return { tier: 'RED', emoji: ':red_circle:' };
  return { tier: 'AMBER', emoji: ':large_orange_circle:' };
}

function ensureAlertTable(db: { run: (sql: string) => void }): void {
  db.run(`
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

async function main() {
  await initSchema();
  const db = await getDb();

  ensureAlertTable(db);
  await loadAsanaUsers();

  // Get the latest period
  const periodResult = db.exec('SELECT MAX(period) FROM client_health');
  if (!periodResult.length || !periodResult[0].values.length || !periodResult[0].values[0][0]) {
    log('TRAFFIC-LIGHT', 'No client health data. Run health:score first.');
    closeDb();
    return;
  }
  const period = periodResult[0].values[0][0] as string;

  // Fetch at-risk and critical clients, with account manager
  const result = db.exec(`
    SELECT ch.client_name, ch.score, ch.performance_score, ch.relationship_score,
           ch.financial_score, ch.breakdown, ch.period,
           c.am AS account_manager
    FROM client_health ch
    LEFT JOIN clients c ON c.name = ch.client_name
    WHERE ch.period = ? AND ch.score < 70
    ORDER BY ch.score ASC
  `, [period]);

  if (!result.length || !result[0].values.length) {
    log('TRAFFIC-LIGHT', 'All clients healthy — no alerts needed');
    closeDb();
    return;
  }

  const cols = result[0].columns;
  const rows: HealthRow[] = result[0].values.map((row: unknown[]) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((c: string, i: number) => obj[c] = row[i]);
    return obj as unknown as HealthRow;
  });

  const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  let redCount = 0;
  let amberCount = 0;
  let skippedCount = 0;

  for (const row of rows) {
    // Deduplication — skip if already alerted for this client+period
    const existing = db.exec(
      'SELECT id FROM traffic_light_alerts WHERE client_name = ? AND period = ?',
      [row.client_name, row.period],
    );
    if (existing.length && existing[0].values.length) {
      skippedCount++;
      continue;
    }

    const { tier, emoji } = tierLabel(row.score);
    const summary = buildSummary(row);
    const isRed = row.score < 40;

    if (isRed) redCount++;
    else amberCount++;

    // Resolve Asana assignee
    const assigneeGid = resolveAsanaUser(row.account_manager);

    // Create Asana task
    const taskName = `[${tier}] Client health alert: ${row.client_name} (${row.score}/100)`;
    const taskNotes = [
      `Client: ${row.client_name}`,
      `Health Score: ${row.score}/100 (${tier})`,
      `Performance: ${row.performance_score}/40 | Relationship: ${row.relationship_score}/30 | Financial: ${row.financial_score}/30`,
      '',
      `Issues: ${summary}`,
      '',
      'Action required: Review client status and create intervention plan.',
      row.account_manager ? `\nAccount Manager: ${row.account_manager}` : '',
    ].join('\n');

    const taskGid = await asanaCreateTask(taskName, taskNotes, dueDate, assigneeGid);
    if (taskGid) {
      log('TRAFFIC-LIGHT', `  Asana task created for ${row.client_name}: ${taskGid}${assigneeGid ? ' (assigned)' : ' (unassigned)'}`);
    }

    // Slack alert to main channel
    const slackMessage = `${emoji} *${tier} Alert — ${row.client_name}*\nScore: ${row.score}/100 | ${summary}`;
    await sendSlackAlert('traffic-light', slackMessage, isRed ? 'error' : 'warning');

    // Red clients also alert SLT
    if (isRed) {
      const sltMessage = `:rotating_light: *CRITICAL CLIENT ALERT — ${row.client_name}*\n` +
        `Health Score: ${row.score}/100\n` +
        `Performance: ${row.performance_score}/40 | Relationship: ${row.relationship_score}/30 | Financial: ${row.financial_score}/30\n` +
        `Issues: ${summary}\n` +
        `Immediate intervention required.`;
      await sendSltAlert(sltMessage);
    }

    // Record the alert for deduplication
    db.run(`
      INSERT INTO traffic_light_alerts (client_name, period, tier, score, asana_task_gid, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [row.client_name, row.period, tier, row.score, taskGid, new Date().toISOString()]);
  }

  saveDb();

  log('TRAFFIC-LIGHT', `Alerts sent: ${redCount} red, ${amberCount} amber for period ${period}${skippedCount ? ` (${skippedCount} already alerted)` : ''}`);
  closeDb();
}

main().catch((err) => {
  logError('TRAFFIC-LIGHT', 'Failed', err);
  process.exit(1);
});
