import { db } from '../queries/base.js';
import { sendSlackMessage } from '../../../scripts/utils/slack-alert.js';
import { createAsanaTask } from '../../../scripts/utils/asana-client.js';
import { alreadyAlerted, recordAlert, consoleLog, type MonitorRunResult } from './base.js';

const MONITOR_NAME = 'ad-spend-pacing';

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export async function run(): Promise<MonitorRunResult> {
  const alertsChannel = process.env.SLACK_CHANNEL_ALERTS || '#alerts';
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const dayOfMonth = now.getDate();
  const totalDays = daysInMonth(year, month);
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const expectedPacePct = dayOfMonth / totalDays;

  // Turso's clients table has no monthly_budget column (a sql.js-era field).
  // Detect the column at runtime and skip gracefully if it's still missing.
  try {
    await db.execute('SELECT monthly_budget FROM clients LIMIT 1');
  } catch {
    consoleLog(MONITOR_NAME, 'clients.monthly_budget column missing in Turso — skipping pacing monitor');
    return { checked: 0, flagged: 0 };
  }

  const { rows: clients } = await db.execute({
    sql: `SELECT c.id, c.name, c.monthly_budget, c.am AS account_manager
          FROM clients c
          WHERE c.status = 'active'
            AND c.monthly_budget IS NOT NULL
            AND c.monthly_budget > 0`,
  });

  if (!clients.length) {
    consoleLog(MONITOR_NAME, 'No active clients with monthly_budget');
    return { checked: 0, flagged: 0 };
  }

  let checked = 0;
  let flagged = 0;

  for (const client of clients) {
    const clientId = client.id as number;
    const clientName = client.name as string;
    const monthlyBudget = client.monthly_budget as number;
    const accountManager = (client.account_manager as string) || '';

    const metaR = await db.execute({
      sql: `SELECT COALESCE(SUM(mi.spend), 0) as total
            FROM meta_insights mi
            JOIN client_source_mappings csm
              ON mi.account_id = csm.external_id AND csm.source = 'meta'
            WHERE csm.client_id = ? AND mi.date >= ?`,
      args: [clientId, monthStart],
    });
    const gadsR = await db.execute({
      sql: `SELECT COALESCE(SUM(gs.spend), 0) as total
            FROM gads_campaign_spend gs
            JOIN client_source_mappings csm
              ON gs.account_id = csm.external_id AND csm.source = 'gads'
            WHERE csm.client_id = ? AND gs.date >= ?`,
      args: [clientId, monthStart],
    });
    const metaSpend = (metaR.rows[0]?.total as number) || 0;
    const gadsSpend = (gadsR.rows[0]?.total as number) || 0;
    const actualSpend = metaSpend + gadsSpend;
    if (actualSpend === 0) continue;

    checked++;
    const expectedSpend = monthlyBudget * expectedPacePct;
    const pacingPct = expectedSpend > 0 ? (actualSpend / expectedSpend) * 100 : 0;

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
    if (await alreadyAlerted(MONITOR_NAME, clientName, alertType)) continue;

    const msg = `${status} for ${clientName}.\nActual: £${actualSpend.toFixed(2)} | Expected: £${expectedSpend.toFixed(2)} | Budget: £${monthlyBudget.toFixed(2)}/mo\nDay ${dayOfMonth}/${totalDays}`;
    const icon = alertType === 'overspend' ? ':moneybag:' : ':snail:';
    await sendSlackMessage(alertsChannel, `${icon} *Ad Spend Pacing*\n${msg}`);

    const deviation = Math.abs(pacingPct - 100);
    if (deviation > 20) {
      await createAsanaTask({
        name: `Ad spend pacing: ${clientName} — ${pacingPct.toFixed(0)}%`,
        notes: `${msg}\n\nAction required: adjust daily budgets or investigate delivery issues.`,
        ...(accountManager ? { assigneeEmail: accountManager } : {}),
      });
    }
    await recordAlert(MONITOR_NAME, clientName, alertType, msg);
    flagged++;
  }

  consoleLog(MONITOR_NAME, `Checked ${checked} clients with budgets, flagged ${flagged}`);
  return { checked, flagged };
}
