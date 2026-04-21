/**
 * Xero data sync — pulls invoices, contacts, P&L, and bank summary.
 *
 * Usage:
 *   npm run sync:xero              # Incremental sync (last 90 days)
 *   npm run sync:xero:backfill     # Full backfill (all history)
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';
import { XeroClient, type XeroInvoice, type XeroContact } from '../utils/xero-client.js';

const BACKFILL = process.argv.includes('--backfill');

function xeroDateToIso(xeroDate: string | null | undefined): string | null {
  if (!xeroDate) return null;
  // Xero dates come as "/Date(1234567890000+0000)/" or ISO strings
  const match = xeroDate.match(/\/Date\((\d+)[+-]\d+\)\//);
  if (match) return new Date(parseInt(match[1], 10)).toISOString();
  const d = new Date(xeroDate);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

async function upsertInvoice(invoice: XeroInvoice): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  db.run(`
    INSERT INTO xero_invoices (id, invoice_number, type, contact_id, contact_name, date, due_date, status, subtotal, total_tax, total, amount_due, amount_paid, currency, reference, updated_at, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      invoice_number = excluded.invoice_number,
      type = excluded.type,
      contact_id = excluded.contact_id,
      contact_name = excluded.contact_name,
      date = excluded.date,
      due_date = excluded.due_date,
      status = excluded.status,
      subtotal = excluded.subtotal,
      total_tax = excluded.total_tax,
      total = excluded.total,
      amount_due = excluded.amount_due,
      amount_paid = excluded.amount_paid,
      currency = excluded.currency,
      reference = excluded.reference,
      updated_at = excluded.updated_at,
      synced_at = excluded.synced_at
  `, [
    invoice.InvoiceID,
    invoice.InvoiceNumber || null,
    invoice.Type,
    invoice.Contact?.ContactID || null,
    invoice.Contact?.Name || null,
    invoice.Date ? xeroDateToIso(invoice.Date) : null,
    invoice.DueDate ? xeroDateToIso(invoice.DueDate) : null,
    invoice.Status,
    invoice.SubTotal ?? 0,
    invoice.TotalTax ?? 0,
    invoice.Total ?? 0,
    invoice.AmountDue ?? 0,
    invoice.AmountPaid ?? 0,
    invoice.CurrencyCode || 'GBP',
    invoice.Reference || null,
    invoice.UpdatedDateUTC ? xeroDateToIso(invoice.UpdatedDateUTC) : now,
    now,
  ]);
}

async function upsertContact(contact: XeroContact): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  db.run(`
    INSERT INTO xero_contacts (id, name, email, is_customer, is_supplier, status, outstanding_receivable, overdue_receivable, outstanding_payable, overdue_payable, updated_at, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      email = excluded.email,
      is_customer = excluded.is_customer,
      is_supplier = excluded.is_supplier,
      status = excluded.status,
      outstanding_receivable = excluded.outstanding_receivable,
      overdue_receivable = excluded.overdue_receivable,
      outstanding_payable = excluded.outstanding_payable,
      overdue_payable = excluded.overdue_payable,
      updated_at = excluded.updated_at,
      synced_at = excluded.synced_at
  `, [
    contact.ContactID,
    contact.Name,
    contact.EmailAddress || null,
    contact.IsCustomer ? 1 : 0,
    contact.IsSupplier ? 1 : 0,
    contact.ContactStatus || 'ACTIVE',
    contact.Balances?.AccountsReceivable?.Outstanding ?? 0,
    contact.Balances?.AccountsReceivable?.Overdue ?? 0,
    contact.Balances?.AccountsPayable?.Outstanding ?? 0,
    contact.Balances?.AccountsPayable?.Overdue ?? 0,
    contact.UpdatedDateUTC ? xeroDateToIso(contact.UpdatedDateUTC) : now,
    now,
  ]);
}

async function syncInvoices(client: XeroClient): Promise<number> {
  log('XERO', 'Syncing invoices...');
  let total = 0;
  let page = 1;

  while (true) {
    const resp = await client.getInvoices({ page });
    if (!resp.Invoices.length) break;

    for (const inv of resp.Invoices) {
      await upsertInvoice(inv);
      total++;
    }

    log('XERO', `  Invoices page ${page}: ${resp.Invoices.length} records (${total} total)`);
    saveDb();

    if (resp.Invoices.length < 100) break; // Xero pages at 100
    page++;
  }

  log('XERO', `Invoices synced: ${total}`);
  return total;
}

async function syncContacts(client: XeroClient): Promise<number> {
  log('XERO', 'Syncing contacts...');
  let total = 0;
  let page = 1;

  while (true) {
    const resp = await client.getContacts({ page });
    if (!resp.Contacts.length) break;

    for (const contact of resp.Contacts) {
      await upsertContact(contact);
      total++;
    }

    log('XERO', `  Contacts page ${page}: ${resp.Contacts.length} records (${total} total)`);
    saveDb();

    if (resp.Contacts.length < 100) break;
    page++;
  }

  log('XERO', `Contacts synced: ${total}`);
  return total;
}

function parsePnlValue(rows: Array<{ RowType: string; Title?: string; Cells?: Array<{ Value: string }>; Rows?: Array<{ Cells?: Array<{ Value: string }> }> }>, sectionTitle: string): number {
  for (const row of rows) {
    if (row.RowType === 'Section' && row.Title === sectionTitle && row.Rows) {
      // The last row in a section is usually the total
      for (const subRow of row.Rows) {
        if (subRow.Cells && subRow.Cells[0]?.Value?.startsWith('Total ')) {
          return parseFloat(subRow.Cells[1]?.Value || '0') || 0;
        }
      }
    }
    // Summary row
    if (row.RowType === 'Row' && row.Cells?.[0]?.Value === sectionTitle) {
      return parseFloat(row.Cells[1]?.Value || '0') || 0;
    }
  }
  return 0;
}

async function syncPnl(client: XeroClient): Promise<void> {
  log('XERO', 'Syncing P&L reports...');
  const db = await getDb();
  const now = new Date().toISOString();
  const today = new Date();

  // Sync monthly P&L for the last 12 months (or 24 for backfill)
  const monthsBack = BACKFILL ? 24 : 12;

  for (let i = 0; i < monthsBack; i++) {
    const periodEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 0); // last day of month
    const periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1);

    // Skip future months
    if (periodStart > today) continue;

    const fromDate = formatDate(periodStart);
    const toDate = formatDate(periodEnd);

    try {
      const resp = await client.getProfitAndLoss(fromDate, toDate);
      const report = resp.Reports?.[0];
      if (!report?.Rows) continue;

      const rows = report.Rows;
      const totalIncome = parsePnlValue(rows, 'Income') || parsePnlValue(rows, 'Revenue');
      const totalCos = parsePnlValue(rows, 'Less Cost of Sales');
      const grossProfit = parsePnlValue(rows, 'Gross Profit');
      const totalExpenses = parsePnlValue(rows, 'Less Operating Expenses') || parsePnlValue(rows, 'Expenses');
      // Xero doesn't always emit a "Net Profit" row at the section level; fall
      // back to income - expenses so the column is never silently zero.
      const parsedNet = parsePnlValue(rows, 'Net Profit');
      const netProfit = parsedNet !== 0 ? parsedNet : totalIncome - totalExpenses;

      // Clear any existing rows for this calendar month before inserting.
      // Historical bad data wrote duplicate rows (e.g. period_start=2026-03-31
      // alongside 2026-03-01) because ON CONFLICT(period_start, period_end)
      // doesn't fire when either date differs. Keying on month kills dupes.
      db.run(
        `DELETE FROM xero_pnl_monthly WHERE strftime('%Y-%m', period_start) = ?`,
        [fromDate.slice(0, 7)]
      );

      db.run(`
        INSERT INTO xero_pnl_monthly (period_start, period_end, total_income, total_cost_of_sales, gross_profit, total_expenses, net_profit, raw_report, synced_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [fromDate, toDate, totalIncome, totalCos, grossProfit, totalExpenses, netProfit, JSON.stringify(report), now]);

      log('XERO', `  P&L ${fromDate}: income=${totalIncome}, expenses=${totalExpenses}, net=${netProfit}`);
    } catch (err) {
      logError('XERO', `  P&L ${fromDate} failed`, err);
    }
  }

  saveDb();
  log('XERO', 'P&L sync complete');
}

async function syncBankSummary(client: XeroClient): Promise<void> {
  log('XERO', 'Syncing bank summary...');
  const db = await getDb();
  const now = new Date().toISOString();
  const today = new Date();

  const fromDate = formatDate(new Date(today.getFullYear(), today.getMonth(), 1));
  const toDate = formatDate(today);

  try {
    const resp = await client.getBankSummary(fromDate, toDate);
    const report = resp.Reports?.[0];
    if (!report?.Rows) {
      logError('XERO', 'Bank summary returned no rows. Likely missing scope — re-authorise: npm run xero:auth');
      return;
    }

    // Clear existing for this period
    db.run('DELETE FROM xero_bank_summary WHERE period_start = ? AND period_end = ?', [fromDate, toDate]);

    // Xero bank summary report has a variable structure: header row(s), one or
    // more Section rows containing account rows, and a totals row. Walk every
    // row/subrow and treat anything with 3+ cells and a non-header label as an
    // account line. The final "Total" row is explicitly skipped.
    let inserted = 0;
    const visit = (rowList: Array<{ RowType: string; Title?: string; Cells?: Array<{ Value: string }>; Rows?: Array<unknown> }>): void => {
      for (const row of rowList) {
        if (row.Rows && Array.isArray(row.Rows)) {
          // Nested section
          visit(row.Rows as typeof rowList);
        }
        if (row.RowType !== 'Row') continue;
        const cells = row.Cells;
        if (!cells || cells.length < 3) continue;
        const accountName = cells[0]?.Value;
        if (!accountName || accountName.startsWith('Total') || accountName === 'Bank Accounts') continue;
        // Detect header row ("Opening Balance" etc.) by non-numeric values
        const opening = parseFloat(cells[1]?.Value || '');
        const closing = parseFloat(cells[cells.length - 1]?.Value || '');
        if (Number.isNaN(opening) && Number.isNaN(closing)) continue;
        db.run(`
          INSERT INTO xero_bank_summary (account_name, opening_balance, closing_balance, period_start, period_end, synced_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [accountName, Number.isNaN(opening) ? 0 : opening, Number.isNaN(closing) ? 0 : closing, fromDate, toDate, now]);
        inserted++;
      }
    };
    visit(report.Rows);

    saveDb();
    if (inserted === 0) {
      logError('XERO', 'Bank summary parsed but wrote 0 accounts — report structure may have changed, inspect raw response');
    } else {
      log('XERO', `Bank summary synced (${inserted} accounts)`);
    }
  } catch (err) {
    logError('XERO', 'Bank summary failed', err);
  }
}

async function syncClientsFromXero(): Promise<number> {
  log('XERO', 'Syncing clients from Xero customers...');
  const db = await getDb();
  let count = 0;

  // Get all Xero contacts marked as customers
  const customers = db.exec(`
    SELECT c.id, c.name, c.email, c.outstanding_receivable, c.status
    FROM xero_contacts c
    WHERE c.is_customer = 1 AND c.status = 'ACTIVE'
    ORDER BY c.name
  `);

  if (!customers.length || !customers[0].values.length) {
    log('XERO', 'No Xero customers found');
    return 0;
  }

  // Get invoice totals and date ranges per contact
  const invoiceStats = db.exec(`
    SELECT contact_id,
           SUM(CASE WHEN status IN ('PAID', 'AUTHORISED') THEN total ELSE 0 END) as total_invoiced,
           MIN(date) as first_invoice,
           MAX(date) as last_invoice
    FROM xero_invoices
    WHERE type = 'ACCREC' AND status != 'DELETED'
    GROUP BY contact_id
  `);

  const invoiceMap = new Map<string, { total: number; first: string | null; last: string | null }>();
  if (invoiceStats.length && invoiceStats[0].values.length) {
    for (const row of invoiceStats[0].values) {
      invoiceMap.set(row[0] as string, {
        total: (row[1] as number) || 0,
        first: row[2] as string | null,
        last: row[3] as string | null,
      });
    }
  }

  // Skip Vendo's own record and junk entries
  const SKIP_NAMES = new Set(['vendo digital ltd', 'vendo digital']);

  for (const row of customers[0].values) {
    const [xeroId, name, email, outstanding] = row as [string, string, string | null, number];

    if (SKIP_NAMES.has(name.toLowerCase())) continue;
    // Skip entries that look like Stripe IDs or email addresses used as names
    if (name.startsWith('cus_') || (name.includes('@') && !name.includes(' '))) continue;

    const stats = invoiceMap.get(xeroId);

    db.run(`
      INSERT INTO clients (name, xero_contact_id, email, source, status, total_invoiced, outstanding, first_invoice_date, last_invoice_date)
      VALUES (?, ?, ?, 'xero', 'pending', ?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        xero_contact_id = excluded.xero_contact_id,
        email = COALESCE(excluded.email, clients.email),
        source = 'xero',
        total_invoiced = excluded.total_invoiced,
        outstanding = excluded.outstanding,
        first_invoice_date = excluded.first_invoice_date,
        last_invoice_date = excluded.last_invoice_date
    `, [
      name,
      xeroId,
      email || null,
      stats?.total ?? 0,
      outstanding ?? 0,
      stats?.first ?? null,
      stats?.last ?? null,
    ]);
    count++;
  }

  // Mark any clients not in Xero as legacy (from old Fathom-only sourcing)
  db.run(`
    UPDATE clients SET source = 'fathom'
    WHERE xero_contact_id IS NULL AND source != 'fathom'
  `);

  saveDb();
  log('XERO', `Clients synced: ${count} from Xero`);
  return count;
}

async function main() {
  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    logError('XERO', 'XERO_CLIENT_ID and XERO_CLIENT_SECRET must be set in .env.local');
    process.exit(1);
  }

  const client = new XeroClient(clientId, clientSecret);

  if (!client.isAuthorised) {
    logError('XERO', 'Not authorised. Run: npm run xero:auth');
    process.exit(1);
  }

  await initSchema();

  // Verify connection
  try {
    const org = await client.getOrganisation();
    log('XERO', `Connected to: ${org.Organisations[0].Name} (${org.Organisations[0].BaseCurrency})`);
  } catch (err) {
    logError('XERO', 'Failed to connect to Xero', err);
    logError('XERO', 'Try re-authorising: npm run xero:auth');
    process.exit(1);
  }

  const mode = BACKFILL ? 'FULL BACKFILL' : 'INCREMENTAL';
  log('XERO', `Starting ${mode} sync...`);

  try {
    const invoiceCount = await syncInvoices(client);
    const contactCount = await syncContacts(client);
    await syncPnl(client);
    await syncBankSummary(client);

    const clientCount = await syncClientsFromXero();

    log('XERO', '--- Sync Summary ---');
    log('XERO', `  Invoices: ${invoiceCount}`);
    log('XERO', `  Contacts: ${contactCount}`);
    log('XERO', `  Clients upserted: ${clientCount}`);
    log('XERO', `  P&L: last ${BACKFILL ? 24 : 12} months`);
    log('XERO', `  Bank summary: current month`);
    log('XERO', 'Sync complete');
  } catch (err) {
    logError('XERO', 'Sync failed', err);
    process.exit(1);
  } finally {
    closeDb();
  }
}

main();
