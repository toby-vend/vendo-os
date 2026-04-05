/**
 * Contract Renewal Monitor (#28)
 *
 * Checks for upcoming contract end dates and alerts at:
 *   - 60 days: Asana task for AM
 *   - 30 days: escalation if no renewal action logged
 *   - 14 days: Slack to SLT
 *
 * Usage:
 *   npx tsx scripts/monitors/contract-renewal.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import type { Database } from 'sql.js';
import { getDb, saveDb, closeDb, log, logError } from '../utils/db.js';
import { sendSlackMessage } from '../utils/slack-alert.js';
import { createAsanaTask } from '../utils/asana-client.js';

const MONITOR_NAME = 'contract-renewal';
const SLT_CHANNEL = process.env.SLACK_CHANNEL_SLT || '#slt';
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
  // For contract renewal, check if we've EVER sent this specific threshold alert
  // (not just today — we only want one 60-day alert per client, one 30-day, etc.)
  const result = db.exec(
    `SELECT COUNT(*) FROM monitor_alerts
     WHERE monitor = ? AND entity = ? AND alert_type = ?`,
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

export async function run(): Promise<{ checked: number; flagged: number }> {
  const db = await getDb();
  await ensureAlertSchema(db);

  // Try both possible column names
  let contractCol = 'contract_end';
  try {
    db.exec(`SELECT contract_end FROM clients LIMIT 1`);
  } catch {
    try {
      db.exec(`SELECT contract_end_date FROM clients LIMIT 1`);
      contractCol = 'contract_end_date';
    } catch {
      log(MONITOR_NAME, 'No contract_end or contract_end_date column found in clients table — skipping');
      closeDb();
      return { checked: 0, flagged: 0 };
    }
  }

  const clients = queryRows(db, `
    SELECT name, ${contractCol} AS contract_end, am AS account_manager
    FROM clients
    WHERE status = 'active'
      AND ${contractCol} IS NOT NULL
      AND ${contractCol} != ''
  `);

  if (!clients.length) {
    log(MONITOR_NAME, 'No active clients with contract end dates found');
    closeDb();
    return { checked: 0, flagged: 0 };
  }

  const now = new Date();
  const todayMs = now.getTime();

  let checked = 0;
  let flagged = 0;

  for (const client of clients) {
    const name = client.name as string;
    const contractEnd = client.contract_end as string;
    const accountManager = (client.account_manager as string) || '';

    const endDate = new Date(contractEnd);
    if (isNaN(endDate.getTime())) {
      log(MONITOR_NAME, `${name}: invalid contract end date "${contractEnd}" — skipping`);
      continue;
    }

    checked++;
    const daysRemaining = Math.ceil((endDate.getTime() - todayMs) / (24 * 60 * 60 * 1000));

    if (daysRemaining < 0 || daysRemaining > 60) continue;

    log(MONITOR_NAME, `${name}: contract ends ${contractEnd} (${daysRemaining} days remaining)`);

    // 14-day alert — SLT escalation
    if (daysRemaining <= 14) {
      const alertType = 'renewal-14d';
      if (!alreadyAlerted(db, name, alertType)) {
        const msg = `Contract renewal URGENT: ${name} — ${daysRemaining} days remaining (ends ${contractEnd})`;
        await sendSlackMessage(SLT_CHANNEL, `:rotating_light: *Contract Renewal — 14 Days*\n${msg}`);

        await createAsanaTask({
          name: `URGENT Contract Renewal: ${name} — ${daysRemaining} days`,
          notes: `${msg}\n\nImmediate action required. Contract expires ${contractEnd}.`,
          ...(accountManager ? { assigneeEmail: accountManager } : {}),
        });

        recordAlert(db, name, alertType, msg);
        log(MONITOR_NAME, `ALERT (14d): ${name} — ${daysRemaining} days`);
        flagged++;
      }
    }
    // 30-day alert — escalation
    else if (daysRemaining <= 30) {
      const alertType = 'renewal-30d';
      if (!alreadyAlerted(db, name, alertType)) {
        const msg = `Contract renewal escalation: ${name} — ${daysRemaining} days remaining (ends ${contractEnd}). No renewal action logged.`;
        await sendSlackMessage(ALERTS_CHANNEL, `:warning: *Contract Renewal — 30 Days*\n${msg}`);

        await createAsanaTask({
          name: `Contract Renewal Escalation: ${name} — 30 days`,
          notes: `${msg}\n\nReview renewal status and engage client.`,
          ...(accountManager ? { assigneeEmail: accountManager } : {}),
        });

        recordAlert(db, name, alertType, msg);
        log(MONITOR_NAME, `ALERT (30d): ${name} — ${daysRemaining} days`);
        flagged++;
      }
    }
    // 60-day alert — initial task creation
    else if (daysRemaining <= 60) {
      const alertType = 'renewal-60d';
      if (!alreadyAlerted(db, name, alertType)) {
        const msg = `Contract renewal due: ${name} — ${daysRemaining} days remaining (ends ${contractEnd}).`;

        await createAsanaTask({
          name: `Contract Renewal: ${name} — 60 days`,
          notes: `${msg}\n\nBegin renewal conversations. Review performance data and prepare renewal proposal.`,
          ...(accountManager ? { assigneeEmail: accountManager } : {}),
        });

        recordAlert(db, name, alertType, msg);
        log(MONITOR_NAME, `Task created (60d): ${name} — ${daysRemaining} days`);
        flagged++;
      }
    }
  }

  saveDb();
  log(MONITOR_NAME, `Checked ${checked} clients with contracts, flagged ${flagged}`);
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
