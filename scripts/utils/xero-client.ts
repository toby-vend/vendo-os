import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { log, logError } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');
const TOKEN_PATH = resolve(PROJECT_ROOT, '.secrets/xero-tokens.json');

const AUTH_URL = 'https://login.xero.com/identity/connect/authorize';
const TOKEN_URL = 'https://identity.xero.com/connect/token';
const API_BASE = 'https://api.xero.com/api.xro/2.0';
const CONNECTIONS_URL = 'https://api.xero.com/connections';

const SCOPES = [
  'openid',
  'offline_access',
  'accounting.contacts.read',
  'accounting.settings.read',
  'accounting.invoices.read',
  'accounting.payments.read',
  'accounting.banktransactions.read',
  'accounting.reports.profitandloss.read',
  'accounting.reports.balancesheet.read',
  'accounting.reports.banksummary.read',
].join(' ');

interface XeroTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix ms
  tenant_id: string;
}

function loadTokens(): XeroTokens | null {
  if (!existsSync(TOKEN_PATH)) return null;
  try {
    return JSON.parse(readFileSync(TOKEN_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

function saveTokens(tokens: XeroTokens): void {
  const dir = dirname(TOKEN_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
}

export function getAuthUrl(clientId: string, redirectUri: string, state: string): string {
  // Build URL manually to use %20 scope separators (Xero rejects + encoded scopes)
  const encodedRedirect = encodeURIComponent(redirectUri);
  const encodedScope = encodeURIComponent(SCOPES);
  return `${AUTH_URL}?response_type=code&client_id=${clientId}&redirect_uri=${encodedRedirect}&scope=${encodedScope}&state=${state}`;
}

export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<XeroTokens> {
  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Token exchange failed (${resp.status}): ${body}`);
  }

  const data = await resp.json() as { access_token: string; refresh_token: string; expires_in: number };
  const expiresAt = Date.now() + data.expires_in * 1000 - 60_000; // 1 min buffer

  // Fetch tenant ID
  const connResp = await fetch(CONNECTIONS_URL, {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  if (!connResp.ok) {
    throw new Error(`Failed to fetch Xero connections: ${connResp.status}`);
  }
  const connections = await connResp.json() as Array<{ tenantId: string; tenantName: string }>;
  if (!connections.length) {
    throw new Error('No Xero organisations found. Ensure the app is connected to an organisation.');
  }

  log('XERO', `Connected to organisation: ${connections[0].tenantName}`);

  const tokens: XeroTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: expiresAt,
    tenant_id: connections[0].tenantId,
  };

  saveTokens(tokens);
  return tokens;
}

async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<XeroTokens> {
  log('XERO', 'Refreshing access token...');

  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Token refresh failed (${resp.status}): ${body}. You may need to re-authorise: npm run xero:auth`);
  }

  const data = await resp.json() as { access_token: string; refresh_token: string; expires_in: number };
  const existing = loadTokens();

  const tokens: XeroTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000 - 60_000,
    tenant_id: existing?.tenant_id || '',
  };

  // Re-fetch tenant if missing
  if (!tokens.tenant_id) {
    const connResp = await fetch(CONNECTIONS_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const connections = await connResp.json() as Array<{ tenantId: string }>;
    tokens.tenant_id = connections[0]?.tenantId || '';
  }

  saveTokens(tokens);
  log('XERO', 'Token refreshed successfully');
  return tokens;
}

export class XeroClient {
  private clientId: string;
  private clientSecret: string;
  private tokens: XeroTokens | null;

  constructor(clientId: string, clientSecret: string) {
    if (!clientId || !clientSecret) throw new Error('XERO_CLIENT_ID and XERO_CLIENT_SECRET are required');
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.tokens = loadTokens();
  }

  get isAuthorised(): boolean {
    return this.tokens !== null;
  }

  private async getAccessToken(): Promise<string> {
    if (!this.tokens) {
      throw new Error('Not authorised. Run: npm run xero:auth');
    }

    if (Date.now() >= this.tokens.expires_at) {
      this.tokens = await refreshAccessToken(this.tokens.refresh_token, this.clientId, this.clientSecret);
    }

    return this.tokens.access_token;
  }

  private get tenantId(): string {
    if (!this.tokens?.tenant_id) throw new Error('No tenant ID. Run: npm run xero:auth');
    return this.tokens.tenant_id;
  }

  async request<T>(path: string, params?: Record<string, string>): Promise<T> {
    const token = await this.getAccessToken();
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    const url = `${API_BASE}${path}${qs}`;

    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Xero-Tenant-Id': this.tenantId,
        Accept: 'application/json',
      },
    });

    if (resp.status === 429) {
      const retryAfter = parseInt(resp.headers.get('retry-after') || '5', 10);
      log('XERO', `Rate limited, waiting ${retryAfter}s...`);
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      return this.request<T>(path, params);
    }

    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new Error(`Xero API ${resp.status}: ${body.slice(0, 300)}`);
    }

    return await resp.json() as T;
  }

  // --- Invoices ---

  async getInvoices(options?: { modifiedAfter?: string; page?: number }): Promise<XeroInvoiceResponse> {
    const params: Record<string, string> = { page: String(options?.page || 1) };
    if (options?.modifiedAfter) {
      params['If-Modified-Since'] = options.modifiedAfter;
    }
    return this.request<XeroInvoiceResponse>('/Invoices', params);
  }

  // --- Contacts ---

  async getContacts(options?: { modifiedAfter?: string; page?: number }): Promise<XeroContactResponse> {
    const params: Record<string, string> = { page: String(options?.page || 1) };
    if (options?.modifiedAfter) {
      params['If-Modified-Since'] = options.modifiedAfter;
    }
    return this.request<XeroContactResponse>('/Contacts', params);
  }

  // --- Profit & Loss ---

  async getProfitAndLoss(fromDate: string, toDate: string): Promise<XeroPnlResponse> {
    return this.request<XeroPnlResponse>('/Reports/ProfitAndLoss', {
      fromDate,
      toDate,
    });
  }

  // --- Bank Summary ---

  async getBankSummary(fromDate: string, toDate: string): Promise<XeroBankSummaryResponse> {
    return this.request<XeroBankSummaryResponse>('/Reports/BankSummary', {
      fromDate,
      toDate,
    });
  }

  // --- Organisation ---

  async getOrganisation(): Promise<{ Organisations: Array<{ Name: string; LegalName: string; BaseCurrency: string }> }> {
    return this.request('/Organisation');
  }
}

// --- Xero API types ---

export interface XeroInvoice {
  InvoiceID: string;
  InvoiceNumber: string;
  Type: 'ACCREC' | 'ACCPAY'; // receivable or payable
  Contact: { ContactID: string; Name: string };
  Date: string;
  DueDate: string;
  Status: string;
  SubTotal: number;
  TotalTax: number;
  Total: number;
  AmountDue: number;
  AmountPaid: number;
  AmountCredited: number;
  CurrencyCode: string;
  UpdatedDateUTC: string;
  Reference: string;
  LineItems?: Array<{
    Description: string;
    Quantity: number;
    UnitAmount: number;
    LineAmount: number;
    AccountCode: string;
  }>;
}

interface XeroInvoiceResponse {
  Invoices: XeroInvoice[];
}

export interface XeroContact {
  ContactID: string;
  Name: string;
  EmailAddress: string;
  IsCustomer: boolean;
  IsSupplier: boolean;
  ContactStatus: string;
  Balances?: {
    AccountsReceivable?: { Outstanding: number; Overdue: number };
    AccountsPayable?: { Outstanding: number; Overdue: number };
  };
  UpdatedDateUTC: string;
}

interface XeroContactResponse {
  Contacts: XeroContact[];
}

interface XeroReportRow {
  RowType: string;
  Title?: string;
  Cells?: Array<{ Value: string }>;
  Rows?: XeroReportRow[];
}

export interface XeroPnlResponse {
  Reports: Array<{
    ReportName: string;
    ReportDate: string;
    Rows: XeroReportRow[];
  }>;
}

export interface XeroBankSummaryResponse {
  Reports: Array<{
    ReportName: string;
    Rows: XeroReportRow[];
  }>;
}

export { TOKEN_PATH };
