/**
 * Meta ROAS Alert Monitor (#14)
 *
 * For ecom clients, calculates ROAS from Meta ad spend and purchase value.
 * Alerts if:
 *   - 30-day ROAS < 2.0 (configurable)
 *   - Week-on-week ROAS drops > 50%
 *
 * Usage:
 *   npx tsx scripts/monitors/meta-roas-alert.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import type { Database } from 'sql.js';
import { getDb, saveDb, closeDb, log, logError } from '../utils/db.js';
import { sendSlackMessage } from '../utils/slack-alert.js';
import { createAsanaTask } from '../utils/asana-client.js';

const MONITOR_NAME = 'meta-roas';
const ALERTS_CHANNEL = process.env.SLACK_CHANNEL_ALERTS || '#alerts';
const ROAS_TARGET = parseFloat(process.env.ROAS_TARGET || '2.0');

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

function parsePurchaseValue(actionsJson: string | null): number {
  if (!actionsJson) return 0;
  try {
    const actions = JSON.parse(actionsJson) as Array<{ action_type: string; value: string }>;
    return actions
      .filter(a => a.action_type && (
        a.action_type.toLowerCase().includes('purchase') ||
        a.action_type.toLowerCase().includes('omni_purchase')
      ))
      .reduce((sum, a) => sum + (parseFloat(a.value) || 0), 0);
  } catch {
    return 0;
  }
}

interface WeekData { spend: number; purchaseValue: number }

function calcRoas(data: WeekData): number {
  return data.spend > 0 ? data.purchaseValue / data.spend : 0;
}

export async function run(): Promise<{ checked: number; flagged: number }> {
  const db = await getDb();
  await ensureAlertSchema(db);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Get ecom clients with Meta data over 30 days
  const rows = queryRows(db, `
    SELECT c.name AS client_name, mi.spend, mi.actions_json, mi.date
    FROM meta_insights mi
    JOIN client_source_mappings csm ON mi.account_id = csm.source_id AND csm.source_type = 'meta'
    JOIN clients c ON csm.client_id = c.id
    WHERE c.category LIKE '%ecom%'
      AND mi.date >= ?
  `, [thirtyDaysAgo]);

  if (!rows.length) {
    log(MONITOR_NAME, 'No ecom Meta data found for the last 30 days');
    closeDb();
    return { checked: 0, flagged: 0 };
  }

  // Aggregate by client: 30-day total + weekly splits
  const clientData: Record<string, {
    total: WeekData;
    thisWeek: WeekData;
    lastWeek: WeekData;
  }> = {};

  for (const row of rows) {
    const name = row.client_name as string;
    const date = row.date as string;
    const spend = (row.spend as number) || 0;
    const purchaseValue = parsePurchaseValue(row.actions_json as string | null);

    if (!clientData[name]) {
      clientData[name] = {
        total: { spend: 0, purchaseValue: 0 },
        thisWeek: { spend: 0, purchaseValue: 0 },
        lastWeek: { spend: 0, purchaseValue: 0 },
      };
    }

    clientData[name].total.spend += spend;
    clientData[name].total.purchaseValue += purchaseValue;

    if (date >= sevenDaysAgo) {
      clientData[name].thisWeek.spend += spend;
      clientData[name].thisWeek.purchaseValue += purchaseValue;
    } else if (date >= fourteenDaysAgo) {
      clientData[name].lastWeek.spend += spend;
      clientData[name].lastWeek.purchaseValue += purchaseValue;
    }
  }

  let checked = 0;
  let flagged = 0;

  for (const [clientName, data] of Object.entries(clientData)) {
    checked++;

    const roas30d = calcRoas(data.total);
    const roasThisWeek = calcRoas(data.thisWeek);
    const roasLastWeek = calcRoas(data.lastWeek);

    log(MONITOR_NAME, `${clientName}: 30d ROAS ${roas30d.toFixed(2)}, this week ${roasThisWeek.toFixed(2)}, last week ${roasLastWeek.toFixed(2)}`);

    const alerts: string[] = [];

    // Check 30-day ROAS below target
    if (data.total.spend > 0 && roas30d < ROAS_TARGET) {
      alerts.push(`30-day ROAS ${roas30d.toFixed(2)}x is below target ${ROAS_TARGET}x`);
    }

    // Check WoW ROAS drop > 50%
    if (roasLastWeek > 0 && roasThisWeek > 0) {
      const dropPct = ((roasLastWeek - roasThisWeek) / roasLastWeek) * 100;
      if (dropPct > 50) {
        alerts.push(`Week-on-week ROAS dropped ${dropPct.toFixed(0)}% (${roasLastWeek.toFixed(2)}x → ${roasThisWeek.toFixed(2)}x)`);
      }
    }

    if (alerts.length > 0) {
      const alertType = 'low-roas';
      if (!alreadyAlerted(db, clientName, alertType)) {
        const msg = `ROAS alert for ${clientName}:\n${alerts.map(a => `• ${a}`).join('\n')}\n\n30d spend: £${data.total.spend.toFixed(2)}, purchase value: £${data.total.purchaseValue.toFixed(2)}`;

        await sendSlackMessage(ALERTS_CHANNEL, `:chart_with_downwards_trend: *Meta ROAS Alert*\n${msg}`);

        await createAsanaTask({
          name: `Low Meta ROAS: ${clientName} — ${roas30d.toFixed(2)}x`,
          notes: `${msg}\n\nAction required: review product feed, audience targeting, and creative performance.`,
        });

        recordAlert(db, clientName, alertType, msg);
        log(MONITOR_NAME, `ALERT: ${clientName} — ${alerts.join('; ')}`);
        flagged++;
      }
    }
  }

  saveDb();
  log(MONITOR_NAME, `Checked ${checked} ecom clients, flagged ${flagged}`);
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
