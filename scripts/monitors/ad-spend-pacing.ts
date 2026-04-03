/**
 * Ad Spend Pacing Monitor (#33)
 *
 * For each client with ad accounts, compares actual month-to-date spend
 * against expected pacing (based on monthly budget from clients table).
 *
 * Flags:
 *   - <80% pacing = underspend
 *   - >110% pacing = overspend
 *   - >20% off track = Asana task
 *
 * Usage:
 *   npx tsx scripts/monitors/ad-spend-pacing.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import type { Database } from 'sql.js';
import { getDb, saveDb, closeDb, log, logError } from '../utils/db.js';
import { sendSlackMessage } from '../utils/slack-alert.js';
import { createAsanaTask } from '../utils/asana-client.js';

const MONITOR_NAME = 'ad-spend-pacing';
const ALERTS_CHANNEL = process.env.SLACK_CHANNEL_ALERTS || '#alerts';

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

function queryScalar(db: Database, sql: string, params: unknown[] = []): unknown {
  const result = db.exec(sql, params);
  if (!result.length || !result[0].values.length) return null;
  return result[0].values[0][0];
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export async function run(): Promise<{ checked: number; flagged: number }> {
  const db = await getDb();
  await ensureAlertSchema(db);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const dayOfMonth = now.getDate();
  const totalDays = daysInMonth(year, month);
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const expectedPacePct = dayOfMonth / totalDays;

  // Get clients with a monthly budget
  const clients = queryRows(db, `
    SELECT c.id, c.name, c.monthly_budget, c.account_manager
    FROM clients c
    WHERE c.status = 'active'
      AND c.monthly_budget IS NOT NULL
      AND c.monthly_budget > 0
  `);

  if (!clients.length) {
    log(MONITOR_NAME, 'No active clients with monthly_budget found — skipping');
    closeDb();
    return { checked: 0, flagged: 0 };
  }

  let checked = 0;
  let flagged = 0;

  for (const client of clients) {
    const clientId = client.id as number;
    const clientName = client.name as string;
    const monthlyBudget = client.monthly_budget as number;
    const accountManager = (client.account_manager as string) || '';

    // Sum Meta spend this month
    const metaSpend = (queryScalar(db, `
      SELECT COALESCE(SUM(mi.spend), 0)
      FROM meta_insights mi
      JOIN client_source_mappings csm ON mi.account_id = csm.source_id AND csm.source_type = 'meta'
      WHERE csm.client_id = ? AND mi.date >= ?
    `, [clientId, monthStart]) as number) || 0;

    // Sum Google Ads spend this month
    const gadsSpend = (queryScalar(db, `
      SELECT COALESCE(SUM(gs.spend), 0)
      FROM gads_campaign_spend gs
      JOIN client_source_mappings csm ON gs.account_id = csm.source_id AND csm.source_type = 'gads'
      WHERE csm.client_id = ? AND gs.date >= ?
    `, [clientId, monthStart]) as number) || 0;

    const actualSpend = metaSpend + gadsSpend;
    if (actualSpend === 0 && metaSpend === 0 && gadsSpend === 0) {
      // No ad accounts mapped — skip silently
      continue;
    }

    checked++;
    const expectedSpend = monthlyBudget * expectedPacePct;
    const pacingPct = expectedSpend > 0 ? (actualSpend / expectedSpend) * 100 : 0;

    log(MONITOR_NAME, `${clientName}: £${actualSpend.toFixed(2)} / £${expectedSpend.toFixed(2)} expected (${pacingPct.toFixed(0)}% paced, budget £${monthlyBudget.toFixed(2)}/mo)`);

    let alertType: string | null = null;
    let status = '';

    if (pacingPct < 80) {
      alertType = 'underspend';
      status = `Underspend: ${pacingPct.toFixed(0)}% of expected pace`;
    } else if (pacingPct > 110) {
      alertType = 'overspend';
      status = `Overspend: ${pacingPct.toFixed(0)}% of expected pace`;
    }

    if (!alertType) continue;

    if (alreadyAlerted(db, clientName, alertType)) continue;

    const msg = `${status} for ${clientName}.\nActual: £${actualSpend.toFixed(2)} | Expected: £${expectedSpend.toFixed(2)} | Budget: £${monthlyBudget.toFixed(2)}/mo\nDay ${dayOfMonth}/${totalDays}`;

    // Slack alert
    const icon = alertType === 'overspend' ? ':moneybag:' : ':snail:';
    await sendSlackMessage(ALERTS_CHANNEL, `${icon} *Ad Spend Pacing*\n${msg}`);

    // Asana task if >20% off track
    const deviation = Math.abs(pacingPct - 100);
    if (deviation > 20) {
      await createAsanaTask({
        name: `Ad spend pacing: ${clientName} — ${pacingPct.toFixed(0)}%`,
        notes: `${msg}\n\nAction required: adjust daily budgets or investigate delivery issues.`,
        ...(accountManager ? { assigneeEmail: accountManager } : {}),
      });
    }

    recordAlert(db, clientName, alertType, msg);
    log(MONITOR_NAME, `ALERT: ${clientName} — ${status}`);
    flagged++;
  }

  saveDb();
  log(MONITOR_NAME, `Checked ${checked} clients with budgets, flagged ${flagged}`);
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
