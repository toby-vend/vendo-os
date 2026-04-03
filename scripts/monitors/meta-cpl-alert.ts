/**
 * Meta CPL (Cost Per Lead) Alert Monitor (#13)
 *
 * For dental clients, calculates 7-day CPL from Meta ad spend.
 * Alerts if CPL > £100.
 *
 * Usage:
 *   npx tsx scripts/monitors/meta-cpl-alert.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import type { Database } from 'sql.js';
import { getDb, saveDb, closeDb, log, logError } from '../utils/db.js';
import { sendSlackMessage } from '../utils/slack-alert.js';
import { createAsanaTask } from '../utils/asana-client.js';

const MONITOR_NAME = 'meta-cpl';
const ALERTS_CHANNEL = process.env.SLACK_CHANNEL_ALERTS || '#alerts';
const CPL_THRESHOLD = 100; // £100

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

function countLeadsFromActions(actionsJson: string | null): number {
  if (!actionsJson) return 0;
  try {
    const actions = JSON.parse(actionsJson) as Array<{ action_type: string; value: string }>;
    return actions
      .filter(a => a.action_type && a.action_type.toLowerCase().includes('lead'))
      .reduce((sum, a) => sum + (parseInt(a.value, 10) || 0), 0);
  } catch {
    return 0;
  }
}

export async function run(): Promise<{ checked: number; flagged: number }> {
  const db = await getDb();
  await ensureAlertSchema(db);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];

  // Get dental clients with Meta ad accounts
  const rows = queryRows(db, `
    SELECT c.name AS client_name, mi.spend, mi.actions_json
    FROM meta_insights mi
    JOIN client_source_mappings csm ON mi.account_id = csm.source_id AND csm.source_type = 'meta'
    JOIN clients c ON csm.client_id = c.id
    WHERE c.category LIKE '%dental%'
      AND mi.date >= ?
  `, [sevenDaysAgo]);

  if (!rows.length) {
    log(MONITOR_NAME, 'No dental Meta spend data found for the last 7 days');
    closeDb();
    return { checked: 0, flagged: 0 };
  }

  // Aggregate by client
  const clientData: Record<string, { spend: number; leads: number }> = {};
  for (const row of rows) {
    const name = row.client_name as string;
    if (!clientData[name]) clientData[name] = { spend: 0, leads: 0 };
    clientData[name].spend += (row.spend as number) || 0;
    clientData[name].leads += countLeadsFromActions(row.actions_json as string | null);
  }

  let checked = 0;
  let flagged = 0;

  for (const [clientName, data] of Object.entries(clientData)) {
    checked++;

    if (data.leads === 0) {
      log(MONITOR_NAME, `${clientName}: £${data.spend.toFixed(2)} spend, 0 leads — cannot calculate CPL`);
      continue;
    }

    const cpl = data.spend / data.leads;
    log(MONITOR_NAME, `${clientName}: £${data.spend.toFixed(2)} spend, ${data.leads} leads, CPL £${cpl.toFixed(2)}`);

    if (cpl > CPL_THRESHOLD) {
      const alertType = 'high-cpl';
      if (!alreadyAlerted(db, clientName, alertType)) {
        const msg = `High CPL alert for ${clientName}: £${cpl.toFixed(2)} (threshold: £${CPL_THRESHOLD}). 7-day spend: £${data.spend.toFixed(2)}, leads: ${data.leads}.`;

        await sendSlackMessage(ALERTS_CHANNEL, `:warning: *Meta CPL Alert*\n${msg}`);

        await createAsanaTask({
          name: `High Meta CPL: ${clientName} — £${cpl.toFixed(2)}`,
          notes: `${msg}\n\nAction required: review campaign targeting, creatives, and landing pages.`,
        });

        recordAlert(db, clientName, alertType, msg);
        log(MONITOR_NAME, `ALERT: ${clientName} CPL £${cpl.toFixed(2)} exceeds £${CPL_THRESHOLD}`);
        flagged++;
      }
    }
  }

  saveDb();
  log(MONITOR_NAME, `Checked ${checked} dental clients, flagged ${flagged}`);
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
