/**
 * Traffic Light Alerts — Red/Amber client health alerts with Asana tasks and Slack notifications.
 *
 * Reads client_health for Red (<40) and Amber (40-70) clients,
 * creates Asana tasks for the AM, and posts Slack alerts.
 * Red clients also alert #slt.
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

interface HealthRow {
  client_name: string;
  score: number;
  performance_score: number;
  relationship_score: number;
  financial_score: number;
  breakdown: string;
  period: string;
}

async function asanaCreateTask(name: string, notes: string, dueOn: string): Promise<string | null> {
  if (!ASANA_API_KEY || !ASANA_WORKSPACE_GID) return null;

  try {
    const res = await fetch(`${ASANA_BASE_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ASANA_API_KEY}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          name,
          notes,
          due_on: dueOn,
          workspace: ASANA_WORKSPACE_GID,
        },
      }),
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
  if (breakdown.adSpend === 0) issues.push('No ad spend in last 30 days');
  if (breakdown.ctr === 0 && breakdown.adSpend > 0) issues.push('CTR below 1%');
  if (breakdown.spendConsistency === 0) issues.push('Inconsistent ad spend');

  // Relationship issues
  if (breakdown.recentMeeting === 0) issues.push('No meeting in 30 days');
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

async function main() {
  await initSchema();
  const db = await getDb();

  // Get the latest period
  const periodResult = db.exec('SELECT MAX(period) FROM client_health');
  if (!periodResult.length || !periodResult[0].values.length || !periodResult[0].values[0][0]) {
    log('TRAFFIC-LIGHT', 'No client health data. Run health:score first.');
    closeDb();
    return;
  }
  const period = periodResult[0].values[0][0] as string;

  // Fetch at-risk and critical clients
  const result = db.exec(`
    SELECT client_name, score, performance_score, relationship_score,
           financial_score, breakdown, period
    FROM client_health
    WHERE period = ? AND score < 70
    ORDER BY score ASC
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

  for (const row of rows) {
    const { tier, emoji } = tierLabel(row.score);
    const summary = buildSummary(row);
    const isRed = row.score < 40;

    if (isRed) redCount++;
    else amberCount++;

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
    ].join('\n');

    const taskGid = await asanaCreateTask(taskName, taskNotes, dueDate);
    if (taskGid) {
      log('TRAFFIC-LIGHT', `  Asana task created for ${row.client_name}: ${taskGid}`);
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
  }

  log('TRAFFIC-LIGHT', `Alerts sent: ${redCount} red, ${amberCount} amber for period ${period}`);
  closeDb();
}

main().catch((err) => {
  logError('TRAFFIC-LIGHT', 'Failed', err);
  process.exit(1);
});
