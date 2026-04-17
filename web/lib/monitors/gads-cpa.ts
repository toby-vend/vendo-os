import { db } from '../queries/base.js';
import { sendSlackMessage } from '../../../scripts/utils/slack-alert.js';
import { createAsanaTask } from '../../../scripts/utils/asana-client.js';
import { alreadyAlerted, recordAlert, consoleLog, type MonitorRunResult } from './base.js';

const MONITOR_NAME = 'gads-cpa';
const CPA_SPIKE_THRESHOLD = 50; // +50% WoW

interface WeekMetrics { spend: number; conversions: number; clicks: number }

export async function run(): Promise<MonitorRunResult> {
  const alertsChannel = process.env.SLACK_CHANNEL_ALERTS || '#alerts';
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { rows } = await db.execute({
    sql: `SELECT c.name AS client_name, gs.spend, gs.clicks, gs.conversions, gs.date
          FROM gads_campaign_spend gs
          JOIN client_source_mappings csm
            ON gs.account_id = csm.external_id AND csm.source = 'gads'
          JOIN clients c ON csm.client_id = c.id
          WHERE c.vertical LIKE '%dental%' AND gs.date >= ?`,
    args: [fourteenDaysAgo],
  });

  if (!rows.length) {
    consoleLog(MONITOR_NAME, 'No dental Google Ads data in last 14 days');
    return { checked: 0, flagged: 0 };
  }

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
    const bucket: 'thisWeek' | 'lastWeek' = date >= sevenDaysAgo ? 'thisWeek' : 'lastWeek';
    clientData[name][bucket].spend += (row.spend as number) || 0;
    clientData[name][bucket].conversions += (row.conversions as number) || 0;
    clientData[name][bucket].clicks += (row.clicks as number) || 0;
  }

  let checked = 0;
  let flagged = 0;
  for (const [clientName, data] of Object.entries(clientData)) {
    checked++;
    const thisActions = data.thisWeek.conversions > 0 ? data.thisWeek.conversions : data.thisWeek.clicks;
    const lastActions = data.lastWeek.conversions > 0 ? data.lastWeek.conversions : data.lastWeek.clicks;
    const actionLabel = data.thisWeek.conversions > 0 ? 'conversions' : 'clicks (proxy)';
    const cpaThis = thisActions > 0 ? data.thisWeek.spend / thisActions : 0;
    const cpaLast = lastActions > 0 ? data.lastWeek.spend / lastActions : 0;
    if (cpaLast === 0 || cpaThis === 0) continue;
    const changePct = ((cpaThis - cpaLast) / cpaLast) * 100;
    if (changePct <= CPA_SPIKE_THRESHOLD) continue;

    const alertType = 'cpa-spike';
    if (await alreadyAlerted(MONITOR_NAME, clientName, alertType)) continue;
    const msg = `CPA spike for ${clientName}: +${changePct.toFixed(0)}% WoW.\n\nThis week: £${cpaThis.toFixed(2)} CPA (£${data.thisWeek.spend.toFixed(2)} spend / ${thisActions} ${actionLabel})\nLast week: £${cpaLast.toFixed(2)} CPA (£${data.lastWeek.spend.toFixed(2)} spend / ${lastActions} ${actionLabel})`;
    await sendSlackMessage(alertsChannel, `:chart_with_upwards_trend: *Google Ads CPA Alert*\n${msg}`);
    await createAsanaTask({
      name: `Google Ads CPA spike: ${clientName} — +${changePct.toFixed(0)}% WoW`,
      notes: `${msg}\n\nAction required: review search terms, keyword bids, ad copy, and landing pages.`,
    });
    await recordAlert(MONITOR_NAME, clientName, alertType, msg);
    flagged++;
  }

  consoleLog(MONITOR_NAME, `Checked ${checked} dental clients, flagged ${flagged}`);
  return { checked, flagged };
}
