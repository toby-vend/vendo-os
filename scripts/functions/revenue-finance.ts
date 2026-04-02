/**
 * Revenue and Finance — MRR, invoice tracking, cash flow forecast, overdue alerts.
 *
 * Pulls from Xero invoice and contact data to calculate:
 *   - Monthly Recurring Revenue (MRR) from active retainers
 *   - Invoice status breakdown (paid, outstanding, overdue)
 *   - Revenue by client
 *   - Simple cash flow forecast based on retainer schedule
 *   - Overdue invoice alerts
 *
 * Usage:
 *   npx tsx scripts/functions/revenue-finance.ts             # full revenue report
 *   npx tsx scripts/functions/revenue-finance.ts --overdue    # overdue invoices only
 *   npx tsx scripts/functions/revenue-finance.ts --forecast   # 3-month cash flow forecast
 *   npx tsx scripts/functions/revenue-finance.ts --client "X" # single client revenue
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';
import { sendSlackAlert } from '../utils/slack-alert.js';

// --- MRR calculation ---
// MRR = sum of monthly retainer values for active clients.
// We estimate this from repeating invoices in the last 3 months.

interface MrrClient {
  contactName: string;
  monthlyAvg: number;
  invoiceCount: number;
  lastInvoiceDate: string;
}

async function calculateMrr(): Promise<{ total: number; clients: MrrClient[] }> {
  const db = await getDb();

  // Get clients with 2+ invoices in the last 90 days (indicates retainer)
  const result = db.exec(`
    SELECT
      contact_name,
      ROUND(AVG(total), 2) as monthly_avg,
      COUNT(*) as invoice_count,
      MAX(date) as last_invoice_date
    FROM xero_invoices
    WHERE type = 'ACCREC'
      AND status IN ('AUTHORISED', 'PAID')
      AND date >= date('now', '-90 days')
      AND contact_name IS NOT NULL
    GROUP BY contact_name
    HAVING COUNT(*) >= 2
    ORDER BY monthly_avg DESC
  `);

  if (!result.length || !result[0].values.length) {
    return { total: 0, clients: [] };
  }

  const clients: MrrClient[] = result[0].values.map((row: unknown[]) => ({
    contactName: row[0] as string,
    monthlyAvg: row[1] as number,
    invoiceCount: row[2] as number,
    lastInvoiceDate: row[3] as string,
  }));

  const total = clients.reduce((sum, c) => sum + c.monthlyAvg, 0);
  return { total: Math.round(total * 100) / 100, clients };
}

// --- Invoice status breakdown ---

interface InvoiceBreakdown {
  totalPaid: number;
  totalOutstanding: number;
  totalOverdue: number;
  paidCount: number;
  outstandingCount: number;
  overdueCount: number;
}

async function getInvoiceBreakdown(months: number = 3): Promise<InvoiceBreakdown> {
  const db = await getDb();

  const result = db.exec(`
    SELECT
      SUM(CASE WHEN status = 'PAID' THEN total ELSE 0 END) as total_paid,
      SUM(CASE WHEN status IN ('AUTHORISED', 'SUBMITTED') AND due_date >= date('now') THEN amount_due ELSE 0 END) as total_outstanding,
      SUM(CASE WHEN status IN ('AUTHORISED', 'SUBMITTED') AND due_date < date('now') THEN amount_due ELSE 0 END) as total_overdue,
      SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) as paid_count,
      SUM(CASE WHEN status IN ('AUTHORISED', 'SUBMITTED') AND due_date >= date('now') THEN 1 ELSE 0 END) as outstanding_count,
      SUM(CASE WHEN status IN ('AUTHORISED', 'SUBMITTED') AND due_date < date('now') THEN 1 ELSE 0 END) as overdue_count
    FROM xero_invoices
    WHERE type = 'ACCREC'
      AND date >= date('now', '-${months} months')
  `);

  if (!result.length || !result[0].values.length) {
    return { totalPaid: 0, totalOutstanding: 0, totalOverdue: 0, paidCount: 0, outstandingCount: 0, overdueCount: 0 };
  }

  const row = result[0].values[0];
  return {
    totalPaid: (row[0] as number) ?? 0,
    totalOutstanding: (row[1] as number) ?? 0,
    totalOverdue: (row[2] as number) ?? 0,
    paidCount: (row[3] as number) ?? 0,
    outstandingCount: (row[4] as number) ?? 0,
    overdueCount: (row[5] as number) ?? 0,
  };
}

// --- Overdue invoices ---

interface OverdueInvoice {
  invoiceNumber: string;
  contactName: string;
  total: number;
  amountDue: number;
  dueDate: string;
  daysPastDue: number;
}

async function getOverdueInvoices(): Promise<OverdueInvoice[]> {
  const db = await getDb();

  const result = db.exec(`
    SELECT
      invoice_number, contact_name, total, amount_due, due_date,
      CAST(julianday('now') - julianday(due_date) AS INTEGER) as days_past_due
    FROM xero_invoices
    WHERE type = 'ACCREC'
      AND status IN ('AUTHORISED', 'SUBMITTED')
      AND due_date < date('now')
      AND amount_due > 0
    ORDER BY days_past_due DESC
  `);

  if (!result.length || !result[0].values.length) return [];

  return result[0].values.map((row: unknown[]) => ({
    invoiceNumber: (row[0] as string) ?? '',
    contactName: (row[1] as string) ?? '',
    total: (row[2] as number) ?? 0,
    amountDue: (row[3] as number) ?? 0,
    dueDate: (row[4] as string) ?? '',
    daysPastDue: (row[5] as number) ?? 0,
  }));
}

// --- Revenue by client ---

interface ClientRevenue {
  contactName: string;
  totalBilled: number;
  totalPaid: number;
  outstanding: number;
  invoiceCount: number;
}

async function getRevenueByClient(clientFilter?: string): Promise<ClientRevenue[]> {
  const db = await getDb();

  let query = `
    SELECT
      contact_name,
      ROUND(SUM(total), 2) as total_billed,
      ROUND(SUM(amount_paid), 2) as total_paid,
      ROUND(SUM(amount_due), 2) as outstanding,
      COUNT(*) as invoice_count
    FROM xero_invoices
    WHERE type = 'ACCREC'
      AND contact_name IS NOT NULL
  `;

  const params: string[] = [];
  if (clientFilter) {
    query += ' AND contact_name LIKE ?';
    params.push(`%${clientFilter}%`);
  }

  query += ' GROUP BY contact_name ORDER BY total_billed DESC';

  const result = db.exec(query, params);
  if (!result.length || !result[0].values.length) return [];

  return result[0].values.map((row: unknown[]) => ({
    contactName: (row[0] as string) ?? '',
    totalBilled: (row[1] as number) ?? 0,
    totalPaid: (row[2] as number) ?? 0,
    outstanding: (row[3] as number) ?? 0,
    invoiceCount: (row[4] as number) ?? 0,
  }));
}

// --- Cash flow forecast ---

interface ForecastMonth {
  month: string;
  expectedIncome: number;
  expectedExpenses: number;
  netCashFlow: number;
}

async function getCashFlowForecast(): Promise<ForecastMonth[]> {
  const db = await getDb();
  const forecast: ForecastMonth[] = [];

  // Base MRR for expected income
  const mrr = await calculateMrr();

  // Get average monthly expenses from Xero P&L
  const expenseResult = db.exec(`
    SELECT ROUND(AVG(total_expenses), 2) as avg_expenses
    FROM xero_pnl_monthly
    WHERE period_start >= date('now', '-6 months')
  `);

  const avgExpenses = expenseResult.length && expenseResult[0].values.length
    ? (expenseResult[0].values[0][0] as number) ?? 0
    : 0;

  // Project 3 months ahead
  for (let i = 1; i <= 3; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() + i);
    const monthStr = date.toISOString().slice(0, 7); // YYYY-MM

    // Known outstanding invoices due in this month
    const dueResult = db.exec(`
      SELECT COALESCE(SUM(amount_due), 0)
      FROM xero_invoices
      WHERE type = 'ACCREC'
        AND status IN ('AUTHORISED', 'SUBMITTED')
        AND strftime('%Y-%m', due_date) = ?
    `, [monthStr]);

    const knownDue = dueResult.length && dueResult[0].values.length
      ? (dueResult[0].values[0][0] as number) ?? 0
      : 0;

    const expectedIncome = Math.round((mrr.total + knownDue) * 100) / 100;
    const expectedExpenses = Math.abs(avgExpenses);
    const netCashFlow = Math.round((expectedIncome - expectedExpenses) * 100) / 100;

    forecast.push({ month: monthStr, expectedIncome, expectedExpenses, netCashFlow });
  }

  return forecast;
}

// --- Display functions ---

function formatGbp(amount: number): string {
  return `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function showFullReport(clientFilter?: string): Promise<void> {
  console.log('\n=== Vendo Revenue & Finance Report ===\n');

  // MRR
  const mrr = await calculateMrr();
  console.log(`  Monthly Recurring Revenue (MRR): ${formatGbp(mrr.total)}`);
  console.log(`  Retainer clients: ${mrr.clients.length}`);
  if (mrr.clients.length > 0) {
    console.log('');
    console.log('  Top retainer clients:');
    for (const c of mrr.clients.slice(0, 10)) {
      console.log(`    ${c.contactName.padEnd(35)} ${formatGbp(c.monthlyAvg).padStart(12)}/mo  (${c.invoiceCount} invoices)`);
    }
  }

  // Invoice breakdown
  console.log('\n--- Invoice Summary (Last 3 Months) ---\n');
  const breakdown = await getInvoiceBreakdown(3);
  console.log(`  Paid:        ${formatGbp(breakdown.totalPaid).padStart(14)}  (${breakdown.paidCount} invoices)`);
  console.log(`  Outstanding: ${formatGbp(breakdown.totalOutstanding).padStart(14)}  (${breakdown.outstandingCount} invoices)`);
  console.log(`  Overdue:     ${formatGbp(breakdown.totalOverdue).padStart(14)}  (${breakdown.overdueCount} invoices)`);

  // Overdue detail
  const overdue = await getOverdueInvoices();
  if (overdue.length) {
    console.log('\n--- Overdue Invoices ---\n');
    console.log('  Invoice        Client                              Amount Due     Days Overdue');
    console.log('  ' + '-'.repeat(80));
    for (const inv of overdue) {
      console.log(
        `  ${(inv.invoiceNumber ?? '').padEnd(14)} ` +
        `${inv.contactName.slice(0, 35).padEnd(35)} ` +
        `${formatGbp(inv.amountDue).padStart(12)} ` +
        `${String(inv.daysPastDue).padStart(13)}`,
      );
    }
  }

  // Revenue by client
  console.log('\n--- Revenue by Client ---\n');
  const clients = await getRevenueByClient(clientFilter);
  if (clients.length) {
    console.log('  Client                              Total Billed       Paid       Outstanding');
    console.log('  ' + '-'.repeat(80));
    for (const c of clients.slice(0, 20)) {
      console.log(
        `  ${c.contactName.slice(0, 35).padEnd(35)} ` +
        `${formatGbp(c.totalBilled).padStart(12)} ` +
        `${formatGbp(c.totalPaid).padStart(10)} ` +
        `${formatGbp(c.outstanding).padStart(13)}`,
      );
    }
  }

  console.log('');
}

async function showOverdue(): Promise<void> {
  const overdue = await getOverdueInvoices();
  if (!overdue.length) {
    log('REVENUE', 'No overdue invoices');
    return;
  }

  console.log('\n=== Overdue Invoices ===\n');
  let totalOverdue = 0;

  for (const inv of overdue) {
    const severity = inv.daysPastDue > 30 ? 'CRITICAL' : inv.daysPastDue > 14 ? 'WARNING' : 'NOTICE';
    console.log(`  [${severity}] ${inv.invoiceNumber} — ${inv.contactName}`);
    console.log(`    Amount due: ${formatGbp(inv.amountDue)} | ${inv.daysPastDue} days overdue (due: ${inv.dueDate.split('T')[0]})`);
    totalOverdue += inv.amountDue;
  }

  console.log(`\n  Total overdue: ${formatGbp(totalOverdue)} across ${overdue.length} invoice(s)`);

  // Alert on critically overdue (>30 days)
  const critical = overdue.filter((i) => i.daysPastDue > 30);
  if (critical.length) {
    const msg = `${critical.length} invoice(s) >30 days overdue, total ${formatGbp(critical.reduce((s, i) => s + i.amountDue, 0))}`;
    await sendSlackAlert('revenue-finance', msg, 'warning').catch(() => {});
  }

  console.log('');
}

async function showForecast(): Promise<void> {
  const forecast = await getCashFlowForecast();

  console.log('\n=== 3-Month Cash Flow Forecast ===\n');
  console.log('  Month       Expected Income   Expected Expenses   Net Cash Flow');
  console.log('  ' + '-'.repeat(65));

  for (const m of forecast) {
    const netIcon = m.netCashFlow >= 0 ? '+' : '';
    console.log(
      `  ${m.month.padEnd(12)} ` +
      `${formatGbp(m.expectedIncome).padStart(16)} ` +
      `${formatGbp(m.expectedExpenses).padStart(19)} ` +
      `${(netIcon + formatGbp(m.netCashFlow)).padStart(14)}`,
    );
  }

  const totalNet = forecast.reduce((s, m) => s + m.netCashFlow, 0);
  console.log(`\n  3-month net: ${formatGbp(totalNet)}`);
  console.log('');
}

// --- Main ---

async function main() {
  await initSchema();

  const clientFilter = process.argv.includes('--client')
    ? process.argv[process.argv.indexOf('--client') + 1]
    : undefined;

  if (process.argv.includes('--overdue')) {
    await showOverdue();
  } else if (process.argv.includes('--forecast')) {
    await showForecast();
  } else {
    await showFullReport(clientFilter);
  }

  closeDb();
}

main().catch((err) => {
  logError('REVENUE', 'Revenue report failed', err);
  process.exit(1);
});
