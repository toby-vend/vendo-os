import { db } from '../queries/base.js';
import { sendSlackMessage } from '../../../scripts/utils/slack-alert.js';
import { createAsanaTask } from '../../../scripts/utils/asana-client.js';
import { alreadyAlerted, recordAlert, consoleLog, type MonitorRunResult } from './base.js';

const MONITOR_NAME = 'meta-cpl';
const CPL_THRESHOLD = 100;

function countLeadsFromActions(actionsJson: string | null): number {
  if (!actionsJson) return 0;
  try {
    const actions = JSON.parse(actionsJson) as Array<{ action_type: string; value: string }>;
    return actions
      .filter((a) => a.action_type && a.action_type.toLowerCase().includes('lead'))
      .reduce((sum, a) => sum + (parseInt(a.value, 10) || 0), 0);
  } catch {
    return 0;
  }
}

export async function run(): Promise<MonitorRunResult> {
  const alertsChannel = process.env.SLACK_CHANNEL_ALERTS || '#alerts';
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { rows } = await db.execute({
    sql: `SELECT c.name AS client_name, mi.spend, mi.actions AS actions_json
          FROM meta_insights mi
          JOIN client_source_mappings csm
            ON mi.account_id = csm.external_id AND csm.source = 'meta'
          JOIN clients c ON csm.client_id = c.id
          WHERE c.vertical LIKE '%dental%' AND mi.date >= ?`,
    args: [sevenDaysAgo],
  });

  if (!rows.length) {
    consoleLog(MONITOR_NAME, 'No dental Meta spend in last 7 days');
    return { checked: 0, flagged: 0 };
  }

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
    if (data.leads === 0) continue;
    const cpl = data.spend / data.leads;
    if (cpl <= CPL_THRESHOLD) continue;

    const alertType = 'high-cpl';
    if (await alreadyAlerted(MONITOR_NAME, clientName, alertType)) continue;

    const msg = `High CPL alert for ${clientName}: £${cpl.toFixed(2)} (threshold: £${CPL_THRESHOLD}). 7-day spend: £${data.spend.toFixed(2)}, leads: ${data.leads}.`;
    await sendSlackMessage(alertsChannel, `:warning: *Meta CPL Alert*\n${msg}`);
    await createAsanaTask({
      name: `High Meta CPL: ${clientName} — £${cpl.toFixed(2)}`,
      notes: `${msg}\n\nAction required: review campaign targeting, creatives, and landing pages.`,
    });
    await recordAlert(MONITOR_NAME, clientName, alertType, msg);
    flagged++;
  }

  consoleLog(MONITOR_NAME, `Checked ${checked} dental clients, flagged ${flagged}`);
  return { checked, flagged };
}
