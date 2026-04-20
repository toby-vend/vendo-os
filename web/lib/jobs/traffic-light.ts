import { db } from '../queries/base.js';
import { sendSlackAlert } from '../../../scripts/utils/slack-alert.js';
import { createAsanaTask } from '../../../scripts/utils/asana-client.js';
import { consoleLog } from '../monitors/base.js';
import { getClientAM, resolveAssignee } from '../asana/assignee.js';
import {
  scoreToTier,
  tierLabel,
  tierAlerts,
  tierEscalatesToSlt,
  type HealthTier,
} from '../health/tiers.js';

/**
 * Turso-native client health traffic-light. Reads the latest client_health
 * period, derives each client's 4-tier classification, and alerts on
 * Orange + Red clients only (Amber is dashboard-only).
 *
 * Runs monthly from /api/cron/traffic-light as a safety-net; the intended
 * primary trigger path after Phase 7 is nightly health-score + real-time
 * alert when a tier drop is detected.
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
  grace_period: number;
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

async function ensureAlertTable(): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS traffic_light_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      period TEXT NOT NULL,
      tier TEXT NOT NULL,
      score INTEGER NOT NULL,
      asana_task_gid TEXT,
      trigger TEXT NOT NULL DEFAULT 'absolute',
      created_at TEXT NOT NULL
    )
  `);
  // Add trigger column if coming from an older schema.
  try {
    await db.execute(`ALTER TABLE traffic_light_alerts ADD COLUMN trigger TEXT NOT NULL DEFAULT 'absolute'`);
  } catch { /* already added */ }
  // New dedupe key replaces the old UNIQUE(client_name, period). Using a
  // unique index so we can migrate without dropping the old table.
  await db.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_tla_client_period_trigger
     ON traffic_light_alerts(client_name, period, trigger)`,
  );
}

async function alreadyAlerted(clientName: string, period: string, trigger: string): Promise<boolean> {
  const r = await db.execute({
    sql: 'SELECT 1 FROM traffic_light_alerts WHERE client_name = ? AND period = ? AND trigger = ? LIMIT 1',
    args: [clientName, period, trigger],
  });
  return r.rows.length > 0;
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

async function fireAlert(opts: {
  row: HealthRow;
  tier: HealthTier;
  trigger: string;
  accountManager: string | null;
}): Promise<string | null> {
  const { row, tier, trigger, accountManager } = opts;
  const { label, emoji } = tierLabel(tier);
  const summary = buildSummary(row);
  const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const task = await createAsanaTask({
    name: `[${label}] Client health alert: ${row.client_name} (${row.score}/100)`,
    notes: [
      `Client: ${row.client_name}`,
      `Health Score: ${row.score}/100 (${label})`,
      `Performance: ${row.performance_score}/40 | Relationship: ${row.relationship_score}/30 | Financial: ${row.financial_score}/30`,
      '',
      `Issues: ${summary}`,
      '',
      `Trigger: ${trigger}`,
      'Action required: Review client status and create intervention plan.',
      accountManager ? `\nAccount Manager: ${accountManager}` : '',
    ].join('\n'),
    dueDate,
    assigneeEmail: accountManager || undefined,
  });
  const taskGid = task?.gid ?? null;

  await sendSlackAlert(
    LOG_SOURCE,
    `${emoji} *${label} Alert — ${row.client_name}*\nScore: ${row.score}/100 | ${summary}`,
    tier === 'red' ? 'error' : 'warning',
  );

  if (tierEscalatesToSlt(tier)) {
    await sendSltAlert(
      `:rotating_light: *CRITICAL CLIENT ALERT — ${row.client_name}*\n` +
      `Health Score: ${row.score}/100\n` +
      `Performance: ${row.performance_score}/40 | Relationship: ${row.relationship_score}/30 | Financial: ${row.financial_score}/30\n` +
      `Issues: ${summary}\nImmediate intervention required.`,
    );
  }

  await db.execute({
    sql: `INSERT OR IGNORE INTO traffic_light_alerts
            (client_name, period, tier, score, asana_task_gid, trigger, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [row.client_name, row.period, label, row.score, taskGid, trigger, new Date().toISOString()],
  });
  return taskGid;
}

export interface TrafficLightResult {
  period: string | null;
  red: number;
  orange: number;
  amber: number; // dashboard-only count, included for visibility
  healthy: number;
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
    return { period: null, red: 0, orange: 0, amber: 0, healthy: 0, skipped: 0, durationMs: Date.now() - start };
  }

  const { rows } = await db.execute({
    sql: `SELECT ch.client_name, ch.score, ch.performance_score, ch.relationship_score,
                 ch.financial_score, ch.breakdown, ch.period,
                 COALESCE(ch.grace_period, 0) AS grace_period
          FROM client_health ch
          JOIN clients c ON c.name = ch.client_name
          WHERE ch.period = ? AND c.status = 'active'
          ORDER BY ch.score ASC`,
    args: [period],
  });
  if (!rows.length) {
    return { period, red: 0, orange: 0, amber: 0, healthy: 0, skipped: 0, durationMs: Date.now() - start };
  }

  let redCount = 0;
  let orangeCount = 0;
  let amberCount = 0;
  let healthyCount = 0;
  let skippedCount = 0;

  for (const row of rows as unknown as HealthRow[]) {
    const tier = scoreToTier(row.score);
    if (tier === 'healthy') { healthyCount++; continue; }
    if (tier === 'amber') { amberCount++; continue; }

    // New clients (<90 days since first contact) are scored and shown in
    // the dashboard but don't trigger alerts — not enough data to judge.
    if (row.grace_period) { skippedCount++; continue; }

    if (await alreadyAlerted(row.client_name, row.period, 'absolute')) {
      skippedCount++;
      continue;
    }

    if (!tierAlerts(tier)) { skippedCount++; continue; }

    // AM for the Asana assignee — prefer Deliverables module then Asana lookup.
    let amName = await getClientAM(row.client_name);
    let amGid: string | undefined;
    if (amName) amGid = await resolveAssignee(amName);
    // createAsanaTask treats `assigneeEmail` as whatever string is passed —
    // we'll pass either the resolved GID or the name; Asana's PUT endpoint
    // accepts both but prefers GIDs. Keep as name for legacy behaviour.
    void amGid;

    await fireAlert({
      row,
      tier,
      trigger: 'absolute',
      accountManager: amName,
    });

    if (tier === 'red') redCount++; else orangeCount++;
  }

  const durationMs = Date.now() - start;
  consoleLog(
    LOG_SOURCE,
    `Period ${period}: ${redCount} red, ${orangeCount} orange, ${amberCount} amber (dashboard-only), ${healthyCount} healthy, ${skippedCount} skipped in ${durationMs}ms`,
  );
  return { period, red: redCount, orange: orangeCount, amber: amberCount, healthy: healthyCount, skipped: skippedCount, durationMs };
}
