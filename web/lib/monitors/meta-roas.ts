import { db } from '../queries/base.js';
import { sendSlackMessage } from '../../../scripts/utils/slack-alert.js';
import { createAsanaTask } from '../../../scripts/utils/asana-client.js';
import { alreadyAlerted, recordAlert, consoleLog, type MonitorRunResult } from './base.js';

const MONITOR_NAME = 'meta-roas';

interface WeekData { spend: number; purchaseValue: number }

function parsePurchaseValue(actionsJson: string | null): number {
  if (!actionsJson) return 0;
  try {
    const actions = JSON.parse(actionsJson) as Array<{ action_type: string; value: string }>;
    return actions
      .filter((a) => a.action_type && (a.action_type.toLowerCase().includes('purchase') || a.action_type.toLowerCase().includes('omni_purchase')))
      .reduce((sum, a) => sum + (parseFloat(a.value) || 0), 0);
  } catch {
    return 0;
  }
}

function calcRoas(d: WeekData): number {
  return d.spend > 0 ? d.purchaseValue / d.spend : 0;
}

export async function run(): Promise<MonitorRunResult> {
  const alertsChannel = process.env.SLACK_CHANNEL_ALERTS || '#alerts';
  const roasTarget = parseFloat(process.env.ROAS_TARGET || '2.0');
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { rows } = await db.execute({
    sql: `SELECT c.name AS client_name, mi.spend, mi.actions_json, mi.date
          FROM meta_insights mi
          JOIN client_source_mappings csm
            ON mi.account_id = csm.source_id AND csm.source_type = 'meta'
          JOIN clients c ON csm.client_id = c.id
          WHERE c.category LIKE '%ecom%' AND mi.date >= ?`,
    args: [thirtyDaysAgo],
  });

  if (!rows.length) {
    consoleLog(MONITOR_NAME, 'No ecom Meta data in last 30 days');
    return { checked: 0, flagged: 0 };
  }

  const clientData: Record<string, { total: WeekData; thisWeek: WeekData; lastWeek: WeekData }> = {};
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
    const roasThis = calcRoas(data.thisWeek);
    const roasLast = calcRoas(data.lastWeek);
    const alerts: string[] = [];
    if (data.total.spend > 0 && roas30d < roasTarget) {
      alerts.push(`30-day ROAS ${roas30d.toFixed(2)}x is below target ${roasTarget}x`);
    }
    if (roasLast > 0 && roasThis > 0) {
      const dropPct = ((roasLast - roasThis) / roasLast) * 100;
      if (dropPct > 50) {
        alerts.push(`Week-on-week ROAS dropped ${dropPct.toFixed(0)}% (${roasLast.toFixed(2)}x → ${roasThis.toFixed(2)}x)`);
      }
    }
    if (!alerts.length) continue;
    const alertType = 'low-roas';
    if (await alreadyAlerted(MONITOR_NAME, clientName, alertType)) continue;

    const msg = `ROAS alert for ${clientName}:\n${alerts.map((a) => `• ${a}`).join('\n')}\n\n30d spend: £${data.total.spend.toFixed(2)}, purchase value: £${data.total.purchaseValue.toFixed(2)}`;
    await sendSlackMessage(alertsChannel, `:chart_with_downwards_trend: *Meta ROAS Alert*\n${msg}`);
    await createAsanaTask({
      name: `Low Meta ROAS: ${clientName} — ${roas30d.toFixed(2)}x`,
      notes: `${msg}\n\nAction required: review product feed, audience targeting, and creative performance.`,
    });
    await recordAlert(MONITOR_NAME, clientName, alertType, msg);
    flagged++;
  }

  consoleLog(MONITOR_NAME, `Checked ${checked} ecom clients, flagged ${flagged}`);
  return { checked, flagged };
}
