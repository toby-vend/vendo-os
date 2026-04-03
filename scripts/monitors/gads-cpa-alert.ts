/**
 * Google Ads CPA Alert Monitor (#15)
 *
 * For dental clients, calculates week-on-week CPA change.
 * Alerts when CPA rises > 50% WoW.
 * Uses conversions if available, clicks as proxy otherwise.
 *
 * Usage:
 *   npx tsx scripts/monitors/gads-cpa-alert.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import type { Database } from 'sql.js';
import { getDb, saveDb, closeDb, log, logError } from '../utils/db.js';
import { sendSlackMessage } from '../utils/slack-alert.js';
import { createAsanaTask } from '../utils/asana-client.js';

const MONITOR_NAME = 'gads-cpa';
const ALERTS_CHANNEL = process.env.SLACK_CHANNEL_ALERTS || '#alerts';
const CPA_SPIKE_THRESHOLD = 50; // percentage increase

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

interface WeekMetrics { spend: number; conversions: number; clicks: number }

export async function run(): Promise<{ checked: number; flagged: number }> {
  const db = await getDb();
  await ensureAlertSchema(db);

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const todayStr = now.toISOString().split('T')[0];

  // Get dental client Google Ads data for the last 14 days
  const rows = queryRows(db, `
    SELECT c.name AS client_name, gs.spend, gs.clicks, gs.conversions, gs.date
    FROM gads_campaign_spend gs
    JOIN client_source_mappings csm ON gs.account_id = csm.source_id AND csm.source_type = 'gads'
    JOIN clients c ON csm.client_id = c.id
    WHERE c.category LIKE '%dental%'
      AND gs.date >= ?
  `, [fourteenDaysAgo]);

  if (!rows.length) {
    log(MONITOR_NAME, 'No dental Google Ads data found for the last 14 days');
    closeDb();
    return { checked: 0, flagged: 0 };
  }

  // Aggregate by client, split into this week and last week
  const clientData: Record<string, { thisWeek: WeekMetrics; lastWeek: WeekMetrics }> = {};

  for (const row of rows) {
    const name = row.client_name as string;
    const date = row.date as string;

    if (!clientData[name]) {
      clientData[name] = {
        thisWeek: { spend: 0, conversions: 0, clicks: 0 },
        lastWeek: { spend: 0, conversions: 0, clicks: 0 },
      };
    }

    const bucket = date >= sevenDaysAgo ? 'thisWeek' : 'lastWeek';
    clientData[name][bucket].spend += (row.spend as number) || 0;
    clientData[name][bucket].conversions += (row.conversions as number) || 0;
    clientData[name][bucket].clicks += (row.clicks as number) || 0;
  }

  let checked = 0;
  let flagged = 0;

  for (const [clientName, data] of Object.entries(clientData)) {
    checked++;

    // Use conversions if available, otherwise fall back to clicks
    const thisWeekActions = data.thisWeek.conversions > 0 ? data.thisWeek.conversions : data.thisWeek.clicks;
    const lastWeekActions = data.lastWeek.conversions > 0 ? data.lastWeek.conversions : data.lastWeek.clicks;
    const actionLabel = data.thisWeek.conversions > 0 ? 'conversions' : 'clicks (proxy)';

    const cpaThisWeek = thisWeekActions > 0 ? data.thisWeek.spend / thisWeekActions : 0;
    const cpaLastWeek = lastWeekActions > 0 ? data.lastWeek.spend / lastWeekActions : 0;

    log(MONITOR_NAME, `${clientName}: this week CPA £${cpaThisWeek.toFixed(2)}, last week CPA £${cpaLastWeek.toFixed(2)} (${actionLabel})`);

    if (cpaLastWeek === 0 || cpaThisWeek === 0) continue;

    const changePercent = ((cpaThisWeek - cpaLastWeek) / cpaLastWeek) * 100;

    if (changePercent > CPA_SPIKE_THRESHOLD) {
      const alertType = 'cpa-spike';
      if (!alreadyAlerted(db, clientName, alertType)) {
        const msg = `CPA spike for ${clientName}: +${changePercent.toFixed(0)}% WoW.\n\nThis week: £${cpaThisWeek.toFixed(2)} CPA (£${data.thisWeek.spend.toFixed(2)} spend / ${thisWeekActions} ${actionLabel})\nLast week: £${cpaLastWeek.toFixed(2)} CPA (£${data.lastWeek.spend.toFixed(2)} spend / ${lastWeekActions} ${actionLabel})`;

        await sendSlackMessage(ALERTS_CHANNEL, `:chart_with_upwards_trend: *Google Ads CPA Alert*\n${msg}`);

        await createAsanaTask({
          name: `Google Ads CPA spike: ${clientName} — +${changePercent.toFixed(0)}% WoW`,
          notes: `${msg}\n\nAction required: review search terms, keyword bids, ad copy, and landing pages.`,
        });

        recordAlert(db, clientName, alertType, msg);
        log(MONITOR_NAME, `ALERT: ${clientName} CPA up ${changePercent.toFixed(0)}%`);
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
