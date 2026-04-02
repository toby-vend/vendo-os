/**
 * Client Profitability — per-client margin calculation and threshold alerts.
 *
 * For each active client, calculates:
 *   - Revenue: monthly retainer from Xero invoices
 *   - Costs: AM hours (Asana tasks), ad management overhead, estimated AI costs
 *   - Gross margin and margin percentage
 *   - Threshold classification: healthy (>50%), warning (30-50%), critical (<30%)
 *
 * Usage:
 *   npx tsx scripts/functions/client-profitability.ts              # full profitability report
 *   npx tsx scripts/functions/client-profitability.ts --alert       # only show at-risk clients
 *   npx tsx scripts/functions/client-profitability.ts --client "X"  # single client detail
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';
import { sendSlackAlert } from '../utils/slack-alert.js';

// --- Cost assumptions ---
// These should be tuned to Vendo's actual rates over time.

const HOURLY_RATE_AM = 45;           // £/hr for AM time
const HOURLY_RATE_SPECIALIST = 55;   // £/hr for specialist time
const AD_MGMT_OVERHEAD_PCT = 0.10;   // 10% of ad spend as management overhead
const AI_COST_PER_CLIENT = 15;       // £/month estimated AI compute per client
const AVG_HOURS_PER_TASK = 0.5;      // estimated hours per Asana task

// --- DB table for profitability log ---

async function ensureProfitabilitySchema(): Promise<void> {
  const db = await getDb();

  db.run(`
    CREATE TABLE IF NOT EXISTS client_profitability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      period TEXT NOT NULL,
      revenue REAL NOT NULL DEFAULT 0,
      cost_am_hours REAL NOT NULL DEFAULT 0,
      cost_ad_mgmt REAL NOT NULL DEFAULT 0,
      cost_ai REAL NOT NULL DEFAULT 0,
      cost_total REAL NOT NULL DEFAULT 0,
      gross_margin REAL NOT NULL DEFAULT 0,
      margin_pct REAL NOT NULL DEFAULT 0,
      classification TEXT NOT NULL DEFAULT 'unknown',
      root_cause TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(client_name, period)
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_profitability_client ON client_profitability(client_name)');
  db.run('CREATE INDEX IF NOT EXISTS idx_profitability_period ON client_profitability(period)');
  db.run('CREATE INDEX IF NOT EXISTS idx_profitability_class ON client_profitability(classification)');
}

// --- Data gathering ---

interface ClientCosts {
  clientName: string;
  revenue: number;
  taskCount: number;
  amHours: number;
  costAmHours: number;
  adSpend: number;
  costAdMgmt: number;
  costAi: number;
  costTotal: number;
  grossMargin: number;
  marginPct: number;
  classification: 'healthy' | 'warning' | 'critical';
  rootCause: string | null;
}

async function calculateClientProfitability(clientFilter?: string): Promise<ClientCosts[]> {
  const db = await getDb();
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  // Get active clients with recent invoices
  let revenueQuery = `
    SELECT
      contact_name,
      ROUND(SUM(total), 2) as monthly_revenue
    FROM xero_invoices
    WHERE type = 'ACCREC'
      AND status IN ('AUTHORISED', 'PAID')
      AND strftime('%Y-%m', date) = ?
      AND contact_name IS NOT NULL
  `;

  const params: (string)[] = [currentMonth];
  if (clientFilter) {
    revenueQuery += ' AND contact_name LIKE ?';
    params.push(`%${clientFilter}%`);
  }

  revenueQuery += ' GROUP BY contact_name ORDER BY monthly_revenue DESC';

  const revenueResult = db.exec(revenueQuery, params);
  if (!revenueResult.length || !revenueResult[0].values.length) {
    // Try last month if current month has no data yet
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthStr = lastMonth.toISOString().slice(0, 7);
    params[0] = lastMonthStr;

    const retryResult = db.exec(revenueQuery, params);
    if (!retryResult.length || !retryResult[0].values.length) return [];

    return processRevenue(retryResult, db, lastMonthStr);
  }

  return processRevenue(revenueResult, db, currentMonth);
}

async function processRevenue(
  revenueResult: { columns: string[]; values: unknown[][] }[],
  db: Awaited<ReturnType<typeof getDb>>,
  period: string,
): Promise<ClientCosts[]> {
  const results: ClientCosts[] = [];

  for (const row of revenueResult[0].values) {
    const clientName = row[0] as string;
    const revenue = (row[1] as number) ?? 0;

    // Count Asana tasks for this client this month
    const taskResult = db.exec(`
      SELECT COUNT(*) as task_count
      FROM asana_tasks
      WHERE project_name LIKE ?
        AND (
          (completed = 1 AND strftime('%Y-%m', completed_at) = ?)
          OR (completed = 0 AND strftime('%Y-%m', modified_at) = ?)
        )
    `, [`%${clientName}%`, period, period]);

    const taskCount = taskResult.length && taskResult[0].values.length
      ? (taskResult[0].values[0][0] as number) ?? 0
      : 0;

    // Estimate AM hours from task count
    const amHours = taskCount * AVG_HOURS_PER_TASK;
    const costAmHours = Math.round(amHours * HOURLY_RATE_AM * 100) / 100;

    // Ad spend from Google Ads + Meta Ads
    const adSpendResult = db.exec(`
      SELECT COALESCE(SUM(spend), 0) as total_spend
      FROM (
        SELECT spend FROM gads_campaign_spend
        WHERE account_name LIKE ? AND strftime('%Y-%m', date) = ?
        UNION ALL
        SELECT spend FROM meta_insights
        WHERE account_name LIKE ? AND strftime('%Y-%m', date) = ? AND level = 'account'
      )
    `, [`%${clientName}%`, period, `%${clientName}%`, period]);

    const adSpend = adSpendResult.length && adSpendResult[0].values.length
      ? (adSpendResult[0].values[0][0] as number) ?? 0
      : 0;

    const costAdMgmt = Math.round(adSpend * AD_MGMT_OVERHEAD_PCT * 100) / 100;
    const costAi = AI_COST_PER_CLIENT;
    const costTotal = Math.round((costAmHours + costAdMgmt + costAi) * 100) / 100;
    const grossMargin = Math.round((revenue - costTotal) * 100) / 100;
    const marginPct = revenue > 0 ? Math.round((grossMargin / revenue) * 100) : 0;

    let classification: 'healthy' | 'warning' | 'critical';
    let rootCause: string | null = null;

    if (marginPct >= 50) {
      classification = 'healthy';
    } else if (marginPct >= 30) {
      classification = 'warning';
      // Diagnose root cause
      if (amHours > 20) rootCause = 'high_am_hours';
      else if (costAdMgmt > revenue * 0.3) rootCause = 'high_ad_management_overhead';
      else rootCause = 'low_retainer_vs_effort';
    } else {
      classification = 'critical';
      if (revenue < 500) rootCause = 'retainer_too_low';
      else if (amHours > 30) rootCause = 'scope_creep';
      else rootCause = 'inefficiency';
    }

    results.push({
      clientName,
      revenue,
      taskCount,
      amHours,
      costAmHours,
      adSpend,
      costAdMgmt,
      costAi,
      costTotal,
      grossMargin,
      marginPct,
      classification,
      rootCause,
    });
  }

  return results;
}

// --- Logging ---

async function logProfitability(clients: ClientCosts[], period: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  for (const c of clients) {
    db.run(`
      INSERT INTO client_profitability
        (client_name, period, revenue, cost_am_hours, cost_ad_mgmt, cost_ai, cost_total, gross_margin, margin_pct, classification, root_cause, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(client_name, period) DO UPDATE SET
        revenue = excluded.revenue, cost_am_hours = excluded.cost_am_hours,
        cost_ad_mgmt = excluded.cost_ad_mgmt, cost_ai = excluded.cost_ai,
        cost_total = excluded.cost_total, gross_margin = excluded.gross_margin,
        margin_pct = excluded.margin_pct, classification = excluded.classification,
        root_cause = excluded.root_cause, created_at = excluded.created_at
    `, [c.clientName, period, c.revenue, c.costAmHours, c.costAdMgmt, c.costAi, c.costTotal, c.grossMargin, c.marginPct, c.classification, c.rootCause, now]);
  }

  saveDb();
}

// --- Display ---

function formatGbp(amount: number): string {
  return `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function showReport(clients: ClientCosts[], alertOnly: boolean): Promise<void> {
  const display = alertOnly ? clients.filter((c) => c.classification !== 'healthy') : clients;

  if (!display.length) {
    log('PROFITABILITY', alertOnly ? 'No at-risk clients' : 'No client profitability data');
    return;
  }

  const title = alertOnly ? 'At-Risk Clients' : 'Client Profitability Report';
  console.log(`\n=== ${title} ===\n`);
  console.log('  Client                              Revenue     Cost     Margin   Margin%   Status');
  console.log('  ' + '-'.repeat(85));

  for (const c of display) {
    const statusIcon = { healthy: 'OK', warning: 'WARN', critical: 'CRIT' }[c.classification];
    console.log(
      `  ${c.clientName.slice(0, 35).padEnd(35)} ` +
      `${formatGbp(c.revenue).padStart(9)} ` +
      `${formatGbp(c.costTotal).padStart(8)} ` +
      `${formatGbp(c.grossMargin).padStart(9)} ` +
      `${(c.marginPct + '%').padStart(8)} ` +
      `  ${statusIcon}`,
    );

    if (c.rootCause && c.classification !== 'healthy') {
      const cause = c.rootCause.replace(/_/g, ' ');
      console.log(`    Root cause: ${cause} | Tasks: ${c.taskCount} | AM hrs: ${c.amHours.toFixed(1)} | Ad spend: ${formatGbp(c.adSpend)}`);
    }
  }

  // Summary
  const total = clients.length;
  const healthy = clients.filter((c) => c.classification === 'healthy').length;
  const warning = clients.filter((c) => c.classification === 'warning').length;
  const critical = clients.filter((c) => c.classification === 'critical').length;
  const totalRevenue = clients.reduce((s, c) => s + c.revenue, 0);
  const totalCost = clients.reduce((s, c) => s + c.costTotal, 0);
  const avgMargin = clients.length > 0
    ? Math.round(clients.reduce((s, c) => s + c.marginPct, 0) / clients.length)
    : 0;

  console.log(`\n  Total: ${total} clients | Healthy: ${healthy} | Warning: ${warning} | Critical: ${critical}`);
  console.log(`  Total revenue: ${formatGbp(totalRevenue)} | Total cost: ${formatGbp(totalCost)} | Avg margin: ${avgMargin}%`);

  // Alert on critical clients
  if (critical > 0) {
    const critClients = clients.filter((c) => c.classification === 'critical');
    const msg = `${critical} client(s) with critical margin (<30%): ${critClients.map((c) => c.clientName).join(', ')}`;
    await sendSlackAlert('client-profitability', msg, 'warning').catch(() => {});
  }

  console.log('');
}

// --- Main ---

async function main() {
  await initSchema();
  await ensureProfitabilitySchema();

  const alertOnly = process.argv.includes('--alert');
  const clientFilter = process.argv.includes('--client')
    ? process.argv[process.argv.indexOf('--client') + 1]
    : undefined;

  log('PROFITABILITY', 'Calculating client profitability...');
  const clients = await calculateClientProfitability(clientFilter);

  if (clients.length) {
    const period = new Date().toISOString().slice(0, 7);
    await logProfitability(clients, period);
    log('PROFITABILITY', `Logged ${clients.length} client(s) for ${period}`);
  }

  await showReport(clients, alertOnly);
  closeDb();
}

main().catch((err) => {
  logError('PROFITABILITY', 'Client profitability failed', err);
  process.exit(1);
});
