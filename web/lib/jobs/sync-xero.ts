import { db } from '../queries/base.js';
import { consoleLog } from '../monitors/base.js';
import { getXeroTokens, saveXeroTokens, type XeroTokens } from '../integrations/xero-tokens.js';

/**
 * Turso-native port of scripts/sync/sync-xero.ts. Runs inside a Vercel
 * serverless function (via /api/cron/sync-xero and the /sync-status Run
 * button). Writes directly to Turso — no sql.js, no filesystem, no child
 * processes.
 *
 * Keeps parity with the original sync:
 *   1. Invoices   → xero_invoices
 *   2. Contacts   → xero_contacts
 *   3. P&L        → xero_pnl_monthly (last 12 months)
 *   4. Bank       → xero_bank_summary (current month)
 *   5. Clients    → clients (THE user-visible sync that was broken)
 *
 * Auth comes from the integration_tokens Turso table, seeded once via
 * scripts/migrations/seed-xero-tokens.ts. Tokens are refreshed on expiry
 * and persisted back — refresh tokens rotate on each use.
 */

const LOG = 'sync-xero';
const TOKEN_URL = 'https://identity.xero.com/connect/token';
const CONNECTIONS_URL = 'https://api.xero.com/connections';
const API_BASE = 'https://api.xero.com/api.xro/2.0';

export interface XeroSyncResult {
  invoices: number;
  contacts: number;
  clientsUpserted: number;
  pnlMonths: number;
  bankRows: number;
  durationMs: number;
}

// --- Xero API types (subset, matching the original) ---

interface XeroInvoice {
  InvoiceID: string;
  InvoiceNumber?: string;
  Type: 'ACCREC' | 'ACCPAY';
  Contact?: { ContactID: string; Name: string };
  Date?: string;
  DueDate?: string;
  Status: string;
  SubTotal?: number;
  TotalTax?: number;
  Total?: number;
  AmountDue?: number;
  AmountPaid?: number;
  CurrencyCode?: string;
  UpdatedDateUTC?: string;
  Reference?: string;
}

interface XeroContact {
  ContactID: string;
  Name: string;
  EmailAddress?: string;
  IsCustomer?: boolean;
  IsSupplier?: boolean;
  ContactStatus?: string;
  Balances?: {
    AccountsReceivable?: { Outstanding: number; Overdue: number };
    AccountsPayable?: { Outstanding: number; Overdue: number };
  };
  UpdatedDateUTC?: string;
}

interface XeroReportRow {
  RowType: string;
  Title?: string;
  Cells?: Array<{ Value: string }>;
  Rows?: XeroReportRow[];
}

// --- Token + request helpers ---

async function refreshAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<XeroTokens> {
  consoleLog(LOG, 'Refreshing access token...');
  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Xero token refresh failed (${resp.status}): ${body.slice(0, 300)}`);
  }
  const data = (await resp.json()) as { access_token: string; refresh_token: string; expires_in: number };
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000 - 60_000, // 1 min buffer
    tenant_id: '',
  };
}

async function fetchTenantId(accessToken: string): Promise<string> {
  const resp = await fetch(CONNECTIONS_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) throw new Error(`Failed to fetch Xero connections: ${resp.status}`);
  const connections = (await resp.json()) as Array<{ tenantId: string }>;
  if (!connections.length) throw new Error('No Xero organisations connected');
  return connections[0].tenantId;
}

class XeroHttp {
  private tokens: XeroTokens;
  private clientId: string;
  private clientSecret: string;

  constructor(tokens: XeroTokens, clientId: string, clientSecret: string) {
    this.tokens = tokens;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  private async ensureFresh(): Promise<void> {
    if (Date.now() < this.tokens.expires_at) return;
    const refreshed = await refreshAccessToken(this.clientId, this.clientSecret, this.tokens.refresh_token);
    refreshed.tenant_id = this.tokens.tenant_id || (await fetchTenantId(refreshed.access_token));
    this.tokens = refreshed;
    await saveXeroTokens(refreshed);
  }

  async request<T>(path: string, params?: Record<string, string>): Promise<T> {
    await this.ensureFresh();
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    const resp = await fetch(`${API_BASE}${path}${qs}`, {
      headers: {
        Authorization: `Bearer ${this.tokens.access_token}`,
        'Xero-Tenant-Id': this.tokens.tenant_id,
        Accept: 'application/json',
      },
    });

    if (resp.status === 429) {
      const retryAfter = parseInt(resp.headers.get('retry-after') || '5', 10);
      consoleLog(LOG, `Rate limited, waiting ${retryAfter}s...`);
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      return this.request<T>(path, params);
    }

    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new Error(`Xero API ${resp.status}: ${body.slice(0, 300)}`);
    }
    return (await resp.json()) as T;
  }
}

// --- Helpers ---

function xeroDateToIso(xeroDate: string | null | undefined): string | null {
  if (!xeroDate) return null;
  const match = xeroDate.match(/\/Date\((\d+)[+-]\d+\)\//);
  if (match) return new Date(parseInt(match[1], 10)).toISOString();
  const d = new Date(xeroDate);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function parsePnlValue(rows: XeroReportRow[], sectionTitle: string): number {
  for (const row of rows) {
    if (row.RowType === 'Section' && row.Title === sectionTitle && row.Rows) {
      for (const subRow of row.Rows) {
        if (subRow.Cells && subRow.Cells[0]?.Value?.startsWith('Total ')) {
          return parseFloat(subRow.Cells[1]?.Value || '0') || 0;
        }
      }
    }
    if (row.RowType === 'Row' && row.Cells?.[0]?.Value === sectionTitle) {
      return parseFloat(row.Cells[1]?.Value || '0') || 0;
    }
  }
  return 0;
}

// --- Sync steps ---

async function syncInvoices(http: XeroHttp): Promise<number> {
  consoleLog(LOG, 'Syncing invoices...');
  let total = 0;
  let page = 1;
  const now = new Date().toISOString();

  while (true) {
    const resp = await http.request<{ Invoices: XeroInvoice[] }>('/Invoices', { page: String(page) });
    if (!resp.Invoices.length) break;

    const batch = resp.Invoices.map(inv => ({
      sql: `INSERT INTO xero_invoices (id, invoice_number, type, contact_id, contact_name, date, due_date, status, subtotal, total_tax, total, amount_due, amount_paid, currency, reference, updated_at, synced_at)
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
              synced_at = excluded.synced_at`,
      args: [
        inv.InvoiceID,
        inv.InvoiceNumber || null,
        inv.Type,
        inv.Contact?.ContactID || null,
        inv.Contact?.Name || null,
        xeroDateToIso(inv.Date),
        xeroDateToIso(inv.DueDate),
        inv.Status,
        inv.SubTotal ?? 0,
        inv.TotalTax ?? 0,
        inv.Total ?? 0,
        inv.AmountDue ?? 0,
        inv.AmountPaid ?? 0,
        inv.CurrencyCode || 'GBP',
        inv.Reference || null,
        xeroDateToIso(inv.UpdatedDateUTC) ?? now,
        now,
      ],
    }));

    await db.batch(batch);
    total += resp.Invoices.length;
    consoleLog(LOG, `  Invoices page ${page}: ${resp.Invoices.length} (${total} total)`);

    if (resp.Invoices.length < 100) break;
    page++;
  }

  consoleLog(LOG, `Invoices synced: ${total}`);
  return total;
}

async function syncContacts(http: XeroHttp): Promise<number> {
  consoleLog(LOG, 'Syncing contacts...');
  let total = 0;
  let page = 1;
  const now = new Date().toISOString();

  while (true) {
    const resp = await http.request<{ Contacts: XeroContact[] }>('/Contacts', { page: String(page) });
    if (!resp.Contacts.length) break;

    const batch = resp.Contacts.map(c => ({
      sql: `INSERT INTO xero_contacts (id, name, email, is_customer, is_supplier, status, outstanding_receivable, overdue_receivable, outstanding_payable, overdue_payable, updated_at, synced_at)
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
              synced_at = excluded.synced_at`,
      args: [
        c.ContactID,
        c.Name,
        c.EmailAddress || null,
        c.IsCustomer ? 1 : 0,
        c.IsSupplier ? 1 : 0,
        c.ContactStatus || 'ACTIVE',
        c.Balances?.AccountsReceivable?.Outstanding ?? 0,
        c.Balances?.AccountsReceivable?.Overdue ?? 0,
        c.Balances?.AccountsPayable?.Outstanding ?? 0,
        c.Balances?.AccountsPayable?.Overdue ?? 0,
        xeroDateToIso(c.UpdatedDateUTC) ?? now,
        now,
      ],
    }));

    await db.batch(batch);
    total += resp.Contacts.length;
    consoleLog(LOG, `  Contacts page ${page}: ${resp.Contacts.length} (${total} total)`);

    if (resp.Contacts.length < 100) break;
    page++;
  }

  consoleLog(LOG, `Contacts synced: ${total}`);
  return total;
}

async function syncPnl(http: XeroHttp): Promise<number> {
  consoleLog(LOG, 'Syncing P&L reports...');
  const now = new Date().toISOString();
  const today = new Date();
  let monthsSynced = 0;

  for (let i = 0; i < 12; i++) {
    const periodEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);
    const periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1);
    if (periodStart > today) continue;

    const fromDate = formatDate(periodStart);
    const toDate = formatDate(periodEnd);

    try {
      const resp = await http.request<{ Reports?: Array<{ Rows?: XeroReportRow[] }> }>(
        '/Reports/ProfitAndLoss',
        { fromDate, toDate },
      );
      const report = resp.Reports?.[0];
      if (!report?.Rows) continue;

      const totalIncome = parsePnlValue(report.Rows, 'Income') || parsePnlValue(report.Rows, 'Revenue');
      const totalCos = parsePnlValue(report.Rows, 'Less Cost of Sales');
      const grossProfit = parsePnlValue(report.Rows, 'Gross Profit');
      const totalExpenses =
        parsePnlValue(report.Rows, 'Less Operating Expenses') || parsePnlValue(report.Rows, 'Expenses');
      const netProfit = parsePnlValue(report.Rows, 'Net Profit');

      await db.execute({
        sql: `INSERT INTO xero_pnl_monthly (period_start, period_end, total_income, total_cost_of_sales, gross_profit, total_expenses, net_profit, raw_report, synced_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(period_start, period_end) DO UPDATE SET
                total_income = excluded.total_income,
                total_cost_of_sales = excluded.total_cost_of_sales,
                gross_profit = excluded.gross_profit,
                total_expenses = excluded.total_expenses,
                net_profit = excluded.net_profit,
                raw_report = excluded.raw_report,
                synced_at = excluded.synced_at`,
        args: [fromDate, toDate, totalIncome, totalCos, grossProfit, totalExpenses, netProfit, JSON.stringify(report), now],
      });
      monthsSynced++;
    } catch (err) {
      consoleLog(LOG, `  P&L ${fromDate} failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  consoleLog(LOG, `P&L synced: ${monthsSynced} months`);
  return monthsSynced;
}

async function syncBankSummary(http: XeroHttp): Promise<number> {
  consoleLog(LOG, 'Syncing bank summary...');
  const now = new Date().toISOString();
  const today = new Date();
  const fromDate = formatDate(new Date(today.getFullYear(), today.getMonth(), 1));
  const toDate = formatDate(today);

  let written = 0;
  try {
    const resp = await http.request<{ Reports?: Array<{ Rows?: XeroReportRow[] }> }>(
      '/Reports/BankSummary',
      { fromDate, toDate },
    );
    const report = resp.Reports?.[0];
    if (!report?.Rows) return 0;

    await db.execute({
      sql: 'DELETE FROM xero_bank_summary WHERE period_start = ? AND period_end = ?',
      args: [fromDate, toDate],
    });

    const inserts: Array<{ sql: string; args: unknown[] }> = [];
    for (const row of report.Rows) {
      if (row.RowType === 'Section' && row.Rows) {
        for (const subRow of row.Rows) {
          if (subRow.Cells && subRow.Cells.length >= 3) {
            const accountName = subRow.Cells[0]?.Value;
            const opening = parseFloat(subRow.Cells[1]?.Value || '0') || 0;
            const closing = parseFloat(subRow.Cells[2]?.Value || '0') || 0;
            if (accountName && !accountName.startsWith('Total')) {
              inserts.push({
                sql: `INSERT INTO xero_bank_summary (account_name, opening_balance, closing_balance, period_start, period_end, synced_at)
                      VALUES (?, ?, ?, ?, ?, ?)`,
                args: [accountName, opening, closing, fromDate, toDate, now],
              });
            }
          }
        }
      }
    }
    if (inserts.length) await db.batch(inserts as Array<{ sql: string; args: (string | number | null)[] }>);
    written = inserts.length;
    consoleLog(LOG, `Bank summary: ${written} accounts`);
  } catch (err) {
    consoleLog(LOG, `Bank summary failed: ${err instanceof Error ? err.message : err}`);
  }
  return written;
}

/**
 * THIS IS THE CRITICAL STEP the user is complaining about — it populates
 * the `clients` table from Xero contacts + invoices.
 */
async function syncClientsFromXero(): Promise<number> {
  consoleLog(LOG, 'Syncing clients from Xero customers...');

  const customers = await db.execute(
    `SELECT id, name, email, outstanding_receivable
     FROM xero_contacts
     WHERE is_customer = 1 AND status = 'ACTIVE'
     ORDER BY name`,
  );
  if (!customers.rows.length) {
    consoleLog(LOG, 'No Xero customers found');
    return 0;
  }

  const invoiceStats = await db.execute(
    `SELECT contact_id,
            SUM(CASE WHEN status IN ('PAID', 'AUTHORISED') THEN total ELSE 0 END) as total_invoiced,
            MIN(date) as first_invoice,
            MAX(date) as last_invoice
     FROM xero_invoices
     WHERE type = 'ACCREC' AND status != 'DELETED'
     GROUP BY contact_id`,
  );
  const invoiceMap = new Map<string, { total: number; first: string | null; last: string | null }>();
  for (const row of invoiceStats.rows) {
    invoiceMap.set(row.contact_id as string, {
      total: Number(row.total_invoiced) || 0,
      first: (row.first_invoice as string) || null,
      last: (row.last_invoice as string) || null,
    });
  }

  const SKIP_NAMES = new Set(['vendo digital ltd', 'vendo digital']);
  const upserts: Array<{ sql: string; args: (string | number | null)[] }> = [];

  for (const row of customers.rows) {
    const xeroId = row.id as string;
    const name = row.name as string;
    const email = (row.email as string) || null;
    const outstanding = Number(row.outstanding_receivable) || 0;

    if (SKIP_NAMES.has(name.toLowerCase())) continue;
    if (name.startsWith('cus_') || (name.includes('@') && !name.includes(' '))) continue;

    const stats = invoiceMap.get(xeroId);

    upserts.push({
      sql: `INSERT INTO clients (name, display_name, xero_contact_id, email, source, status, total_invoiced, outstanding, first_invoice_date, last_invoice_date)
            VALUES (?, ?, ?, ?, 'xero', 'active', ?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
              display_name = COALESCE(clients.display_name, excluded.display_name),
              xero_contact_id = excluded.xero_contact_id,
              email = COALESCE(excluded.email, clients.email),
              source = 'xero',
              total_invoiced = excluded.total_invoiced,
              outstanding = excluded.outstanding,
              first_invoice_date = excluded.first_invoice_date,
              last_invoice_date = excluded.last_invoice_date`,
      args: [name, name, xeroId, email, stats?.total ?? 0, outstanding, stats?.first ?? null, stats?.last ?? null],
    });
  }

  if (upserts.length) await db.batch(upserts);

  await db.execute(
    "UPDATE clients SET source = 'fathom' WHERE xero_contact_id IS NULL AND source != 'fathom'",
  );

  consoleLog(LOG, `Clients synced: ${upserts.length} from Xero`);
  return upserts.length;
}

// --- Main ---

export async function syncXero(): Promise<XeroSyncResult> {
  const start = Date.now();
  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('XERO_CLIENT_ID and XERO_CLIENT_SECRET must be set');
  }

  const tokens = await getXeroTokens();
  if (!tokens) {
    throw new Error('No Xero tokens in integration_tokens. Seed via scripts/migrations/seed-xero-tokens.ts');
  }

  const http = new XeroHttp(tokens, clientId, clientSecret);

  // Verify connection
  try {
    await http.request('/Organisation');
  } catch (err) {
    throw new Error(`Xero auth check failed: ${err instanceof Error ? err.message : err}`);
  }

  const invoices = await syncInvoices(http);
  const contacts = await syncContacts(http);
  const pnlMonths = await syncPnl(http);
  const bankRows = await syncBankSummary(http);
  const clientsUpserted = await syncClientsFromXero();

  const durationMs = Date.now() - start;
  consoleLog(LOG, `Sync complete in ${durationMs}ms`);
  return { invoices, contacts, clientsUpserted, pnlMonths, bankRows, durationMs };
}
