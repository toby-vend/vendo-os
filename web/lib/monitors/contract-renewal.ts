import { db } from '../queries/base.js';
import { sendSlackMessage } from '../../../scripts/utils/slack-alert.js';
import { createAsanaTask } from '../../../scripts/utils/asana-client.js';
import { alreadyAlerted, recordAlert, consoleLog, type MonitorRunResult } from './base.js';

const MONITOR_NAME = 'contract-renewal';

async function detectContractColumn(): Promise<string | null> {
  for (const col of ['contract_end', 'contract_end_date']) {
    try {
      await db.execute(`SELECT ${col} FROM clients LIMIT 1`);
      return col;
    } catch {
      /* continue */
    }
  }
  return null;
}

export async function run(): Promise<MonitorRunResult> {
  const sltChannel = process.env.SLACK_CHANNEL_SLT || '#slt';
  const alertsChannel = process.env.SLACK_CHANNEL_ALERTS || '#alerts';

  const contractCol = await detectContractColumn();
  if (!contractCol) {
    consoleLog(MONITOR_NAME, 'No contract_end column found — skipping');
    return { checked: 0, flagged: 0 };
  }

  const { rows: clients } = await db.execute(
    `SELECT name, ${contractCol} AS contract_end, am AS account_manager
     FROM clients
     WHERE status = 'active'
       AND ${contractCol} IS NOT NULL
       AND ${contractCol} != ''`,
  );

  if (!clients.length) {
    consoleLog(MONITOR_NAME, 'No active clients with contract_end');
    return { checked: 0, flagged: 0 };
  }

  const todayMs = Date.now();
  let checked = 0;
  let flagged = 0;

  for (const client of clients) {
    const name = client.name as string;
    const contractEnd = client.contract_end as string;
    const accountManager = (client.account_manager as string) || '';
    const endDate = new Date(contractEnd);
    if (isNaN(endDate.getTime())) continue;

    checked++;
    const daysRemaining = Math.ceil((endDate.getTime() - todayMs) / (24 * 60 * 60 * 1000));
    if (daysRemaining < 0 || daysRemaining > 60) continue;

    if (daysRemaining <= 14) {
      const alertType = 'renewal-14d';
      if (await alreadyAlerted(MONITOR_NAME, name, alertType)) continue;
      const msg = `Contract renewal URGENT: ${name} — ${daysRemaining} days remaining (ends ${contractEnd})`;
      await sendSlackMessage(sltChannel, `:rotating_light: *Contract Renewal — 14 Days*\n${msg}`);
      await createAsanaTask({
        name: `URGENT Contract Renewal: ${name} — ${daysRemaining} days`,
        notes: `${msg}\n\nImmediate action required. Contract expires ${contractEnd}.`,
        ...(accountManager ? { assigneeEmail: accountManager } : {}),
      });
      await recordAlert(MONITOR_NAME, name, alertType, msg);
      flagged++;
    } else if (daysRemaining <= 30) {
      const alertType = 'renewal-30d';
      if (await alreadyAlerted(MONITOR_NAME, name, alertType)) continue;
      const msg = `Contract renewal escalation: ${name} — ${daysRemaining} days remaining (ends ${contractEnd}). No renewal action logged.`;
      await sendSlackMessage(alertsChannel, `:warning: *Contract Renewal — 30 Days*\n${msg}`);
      await createAsanaTask({
        name: `Contract Renewal Escalation: ${name} — 30 days`,
        notes: `${msg}\n\nReview renewal status and engage client.`,
        ...(accountManager ? { assigneeEmail: accountManager } : {}),
      });
      await recordAlert(MONITOR_NAME, name, alertType, msg);
      flagged++;
    } else if (daysRemaining <= 60) {
      const alertType = 'renewal-60d';
      if (await alreadyAlerted(MONITOR_NAME, name, alertType)) continue;
      const msg = `Contract renewal due: ${name} — ${daysRemaining} days remaining (ends ${contractEnd}).`;
      await createAsanaTask({
        name: `Contract Renewal: ${name} — 60 days`,
        notes: `${msg}\n\nBegin renewal conversations. Review performance data and prepare renewal proposal.`,
        ...(accountManager ? { assigneeEmail: accountManager } : {}),
      });
      await recordAlert(MONITOR_NAME, name, alertType, msg);
      flagged++;
    }
  }

  consoleLog(MONITOR_NAME, `Checked ${checked} clients with contracts, flagged ${flagged}`);
  return { checked, flagged };
}
