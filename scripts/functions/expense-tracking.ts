/**
 * Expense Tracking — classify, approve, log, and report on expenses.
 *
 * Pulls from Xero bills (ACCPAY invoices) and P&L data to:
 *   - Classify expenses by type (subscription, ad spend, team, operational)
 *   - Apply approval threshold rules
 *   - Log to expenses table for tracking
 *   - Generate monthly P&L summary
 *
 * Usage:
 *   npx tsx scripts/functions/expense-tracking.ts              # full expense report
 *   npx tsx scripts/functions/expense-tracking.ts --pnl        # monthly P&L summary
 *   npx tsx scripts/functions/expense-tracking.ts --pending     # expenses needing approval
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';

// --- Expense categories and classification rules ---

interface ExpenseRule {
  category: string;
  label: string;
  patterns: RegExp[];
}

const EXPENSE_RULES: ExpenseRule[] = [
  {
    category: 'ad_spend',
    label: 'Ad Spend',
    patterns: [/google ads/i, /meta ads/i, /facebook ads/i, /linkedin ads/i, /tiktok ads/i, /ad spend/i, /advertising/i],
  },
  {
    category: 'subscription',
    label: 'Subscription / SaaS',
    patterns: [/asana/i, /slack/i, /zoom/i, /canva/i, /semrush/i, /hubspot/i, /zapier/i, /make\.com/i, /anthropic/i, /openai/i, /figma/i, /notion/i, /clickup/i, /mailchimp/i, /sendgrid/i, /twilio/i, /hosting/i, /aws/i, /vercel/i, /cloudflare/i, /domain/i, /license/i, /subscription/i],
  },
  {
    category: 'team',
    label: 'Team / Payroll',
    patterns: [/salary/i, /payroll/i, /paye/i, /pension/i, /ni contribution/i, /contractor/i, /freelanc/i, /bonus/i],
  },
  {
    category: 'professional',
    label: 'Professional Services',
    patterns: [/accountant/i, /legal/i, /lawyer/i, /solicitor/i, /consultant/i, /audit/i, /insurance/i],
  },
  {
    category: 'office',
    label: 'Office / Operations',
    patterns: [/rent/i, /office/i, /utilities/i, /electric/i, /internet/i, /phone/i, /postage/i, /stationery/i, /equipment/i, /hardware/i, /furniture/i],
  },
  {
    category: 'travel',
    label: 'Travel / Entertainment',
    patterns: [/travel/i, /train/i, /flight/i, /hotel/i, /uber/i, /taxi/i, /parking/i, /meal/i, /entertainment/i, /client lunch/i],
  },
];

function classifyExpense(description: string): { category: string; label: string } {
  for (const rule of EXPENSE_RULES) {
    if (rule.patterns.some((p) => p.test(description))) {
      return { category: rule.category, label: rule.label };
    }
  }
  return { category: 'other', label: 'Other / Uncategorised' };
}

// --- Approval thresholds ---

const AUTO_APPROVE_THRESHOLD = 500; // £500 auto-approved
const FOUNDER_APPROVAL_THRESHOLD = 2000; // £2000+ needs founder

function getApprovalStatus(amount: number): { status: string; approver: string } {
  if (amount <= AUTO_APPROVE_THRESHOLD) return { status: 'auto_approved', approver: 'system' };
  if (amount <= FOUNDER_APPROVAL_THRESHOLD) return { status: 'pending_sarah', approver: 'Sarah' };
  return { status: 'pending_founder', approver: 'Founder' };
}

// --- Expense schema ---

async function ensureExpenseSchema(): Promise<void> {
  const db = await getDb();

  db.run(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      xero_invoice_id TEXT UNIQUE,
      contact_name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      approval_status TEXT NOT NULL DEFAULT 'pending',
      approver TEXT,
      client_name TEXT,
      cost_centre TEXT,
      created_at TEXT NOT NULL
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category)');
  db.run('CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(approval_status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date)');
}

// --- Sync expenses from Xero bills ---

async function syncExpensesFromXero(): Promise<number> {
  const db = await getDb();
  const now = new Date().toISOString();

  // Pull ACCPAY (bills) from Xero invoices that haven't been logged yet
  const result = db.exec(`
    SELECT id, contact_name, reference, total, date
    FROM xero_invoices
    WHERE type = 'ACCPAY'
      AND status IN ('AUTHORISED', 'PAID')
      AND id NOT IN (SELECT xero_invoice_id FROM expenses WHERE xero_invoice_id IS NOT NULL)
    ORDER BY date DESC
  `);

  if (!result.length || !result[0].values.length) return 0;

  let count = 0;
  for (const row of result[0].values) {
    const [xeroId, contactName, reference, amount, date] = row as [string, string, string | null, number, string];

    const description = `${contactName}${reference ? ' — ' + reference : ''}`;
    const { category } = classifyExpense(description);
    const { status, approver } = getApprovalStatus(amount);

    db.run(`
      INSERT OR IGNORE INTO expenses
        (xero_invoice_id, contact_name, description, category, amount, date, approval_status, approver, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [xeroId, contactName, description, category, amount, date, status, approver, now]);

    count++;
  }

  saveDb();
  return count;
}

// --- Display functions ---

function formatGbp(amount: number): string {
  return `£${Math.abs(amount).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function showExpenseReport(): Promise<void> {
  const db = await getDb();

  // Category breakdown for last 3 months
  const byCategory = db.exec(`
    SELECT
      category,
      COUNT(*) as count,
      ROUND(SUM(amount), 2) as total,
      ROUND(AVG(amount), 2) as avg_amount
    FROM expenses
    WHERE date >= date('now', '-3 months')
    GROUP BY category
    ORDER BY total DESC
  `);

  console.log('\n=== Expense Report (Last 3 Months) ===\n');

  if (byCategory.length && byCategory[0].values.length) {
    console.log('  Category                Count      Total       Avg');
    console.log('  ' + '-'.repeat(60));

    let grandTotal = 0;
    for (const row of byCategory[0].values) {
      const [cat, count, total, avg] = row as [string, number, number, number];
      const label = EXPENSE_RULES.find((r) => r.category === cat)?.label ?? cat;
      console.log(
        `  ${label.padEnd(22)} ${String(count).padStart(5)} ` +
        `${formatGbp(total).padStart(10)} ` +
        `${formatGbp(avg).padStart(9)}`,
      );
      grandTotal += total;
    }

    console.log('  ' + '-'.repeat(60));
    console.log(`  ${'TOTAL'.padEnd(22)} ${' '.repeat(5)} ${formatGbp(grandTotal).padStart(10)}`);
  }

  // Month-on-month trend
  const monthly = db.exec(`
    SELECT
      strftime('%Y-%m', date) as month,
      ROUND(SUM(amount), 2) as total
    FROM expenses
    WHERE date >= date('now', '-6 months')
    GROUP BY month
    ORDER BY month
  `);

  if (monthly.length && monthly[0].values.length) {
    console.log('\n--- Monthly Trend ---\n');
    for (const row of monthly[0].values) {
      const [month, total] = row as [string, number];
      const bar = '█'.repeat(Math.min(Math.round(total / 500), 40));
      console.log(`  ${month}  ${formatGbp(total).padStart(10)}  ${bar}`);
    }
  }

  console.log('');
}

async function showPnl(): Promise<void> {
  const db = await getDb();

  const result = db.exec(`
    SELECT
      period_start, period_end,
      total_income, total_cost_of_sales, gross_profit,
      total_expenses, net_profit
    FROM xero_pnl_monthly
    ORDER BY period_start DESC
    LIMIT 6
  `);

  if (!result.length || !result[0].values.length) {
    log('EXPENSES', 'No P&L data — run npm run sync:xero first');
    return;
  }

  console.log('\n=== Monthly P&L Summary ===\n');
  console.log('  Period         Income       COGS     Gross Profit   Expenses   Net Profit');
  console.log('  ' + '-'.repeat(75));

  for (const row of result[0].values) {
    const [start, _end, income, cogs, gross, expenses, net] = row as [string, string, number, number, number, number, number];
    const month = (start as string)?.slice(0, 7) ?? '';
    console.log(
      `  ${month.padEnd(14)} ` +
      `${formatGbp(income ?? 0).padStart(10)} ` +
      `${formatGbp(cogs ?? 0).padStart(10)} ` +
      `${formatGbp(gross ?? 0).padStart(14)} ` +
      `${formatGbp(expenses ?? 0).padStart(10)} ` +
      `${formatGbp(net ?? 0).padStart(12)}`,
    );
  }

  console.log('');
}

async function showPending(): Promise<void> {
  const db = await getDb();

  const result = db.exec(`
    SELECT contact_name, description, category, amount, date, approval_status, approver
    FROM expenses
    WHERE approval_status LIKE 'pending%'
    ORDER BY amount DESC
  `);

  if (!result.length || !result[0].values.length) {
    log('EXPENSES', 'No expenses pending approval');
    return;
  }

  console.log('\n=== Expenses Pending Approval ===\n');
  console.log('  Supplier                     Amount     Category          Approver     Date');
  console.log('  ' + '-'.repeat(80));

  for (const row of result[0].values) {
    const [contact, _desc, category, amount, date, _status, approver] = row as string[];
    console.log(
      `  ${(contact ?? '').slice(0, 28).padEnd(28)} ` +
      `${formatGbp(Number(amount)).padStart(10)} ` +
      `${(category ?? '').padEnd(17)} ` +
      `${(approver ?? '').padEnd(12)} ` +
      `${(date ?? '').split('T')[0]}`,
    );
  }

  console.log('');
}

// --- Main ---

async function main() {
  await initSchema();
  await ensureExpenseSchema();

  // Always sync latest from Xero
  const synced = await syncExpensesFromXero();
  if (synced > 0) log('EXPENSES', `Synced ${synced} new expense(s) from Xero`);

  if (process.argv.includes('--pnl')) {
    await showPnl();
  } else if (process.argv.includes('--pending')) {
    await showPending();
  } else {
    await showExpenseReport();
  }

  closeDb();
}

main().catch((err) => {
  logError('EXPENSES', 'Expense tracking failed', err);
  process.exit(1);
});
