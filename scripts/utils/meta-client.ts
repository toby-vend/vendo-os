import { log, logError } from './db.js';

const API_VERSION = 'v21.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;
const MAX_RETRIES = 3;

// Meta Marketing API rate limits are complex (per-account, per-app).
// Conservative: 200 calls per minute to stay well within limits.
const MAX_REQUESTS_PER_MINUTE = 180;
const WINDOW_MS = 60_000;

// --- Types ---

export interface MetaAdAccount {
  id: string;               // "act_123456"
  name: string;
  account_id: string;       // "123456"
  account_status: number;
  currency: string;
  timezone_name: string;
}

export interface MetaInsightRow {
  date_start: string;
  date_stop: string;
  account_id: string;
  account_name: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  impressions: string;
  clicks: string;
  spend: string;
  cpc?: string;
  cpm?: string;
  ctr?: string;
  reach?: string;
  frequency?: string;
  actions?: Array<{ action_type: string; value: string }>;
  cost_per_action_type?: Array<{ action_type: string; value: string }>;
  conversions?: Array<{ action_type: string; value: string }>;
  conversion_values?: Array<{ action_type: string; value: string }>;
}

interface PagingCursor {
  after?: string;
}

interface MetaPaginatedResponse<T> {
  data: T[];
  paging?: {
    cursors?: PagingCursor;
    next?: string;
  };
}

// --- Rate Limiter ---

class RateLimiter {
  private timestamps: number[] = [];

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < WINDOW_MS);

    if (this.timestamps.length >= MAX_REQUESTS_PER_MINUTE) {
      const oldest = this.timestamps[0];
      const waitMs = WINDOW_MS - (now - oldest) + 100;
      log('RATE', `Meta limit reached (${this.timestamps.length}/${MAX_REQUESTS_PER_MINUTE}), waiting ${Math.ceil(waitMs / 1000)}s`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      return this.waitForSlot();
    }

    this.timestamps.push(Date.now());
  }

  get usage(): string {
    const now = Date.now();
    const active = this.timestamps.filter(t => now - t < WINDOW_MS).length;
    return `${active}/${MAX_REQUESTS_PER_MINUTE}`;
  }
}

// --- Client ---

export class MetaClient {
  private accessToken: string;
  private rateLimiter = new RateLimiter();

  constructor(accessToken: string) {
    if (!accessToken) throw new Error('META_ACCESS_TOKEN is required');
    this.accessToken = accessToken;
  }

  private async request<T>(url: string, retries = MAX_RETRIES): Promise<T> {
    await this.rateLimiter.waitForSlot();

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '60', 10);
        log('RATE', `429 from Meta, waiting ${retryAfter}s`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        return this.request<T>(url, retries);
      }

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${body.slice(0, 300)}`);
      }

      return await response.json() as T;
    } catch (err) {
      if (retries > 0 && !(err instanceof Error && err.message.includes('401'))) {
        const delay = Math.pow(2, MAX_RETRIES - retries) * 1000;
        logError('META', `Request failed, retrying in ${delay / 1000}s (${retries} left)`, err);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.request<T>(url, retries - 1);
      }
      throw err;
    }
  }

  /** List all ad accounts accessible to the token */
  async listAdAccounts(): Promise<MetaAdAccount[]> {
    const accounts: MetaAdAccount[] = [];
    let url = `${BASE_URL}/me/adaccounts?fields=id,name,account_id,account_status,currency,timezone_name&limit=100`;

    while (url) {
      const resp = await this.request<MetaPaginatedResponse<MetaAdAccount>>(url);
      accounts.push(...resp.data);
      url = resp.paging?.next || '';
    }

    return accounts;
  }

  /**
   * Fetch insights for an ad account at a given level.
   * Returns daily breakdowns for the given date range.
   */
  async getInsights(options: {
    accountId: string;        // "act_123456" format
    level: 'campaign' | 'adset' | 'ad';
    dateFrom: string;         // YYYY-MM-DD
    dateTo: string;           // YYYY-MM-DD
  }): Promise<MetaInsightRow[]> {
    const { accountId, level, dateFrom, dateTo } = options;
    const fields = [
      'account_id', 'account_name',
      'campaign_id', 'campaign_name',
      'adset_id', 'adset_name',
      'ad_id', 'ad_name',
      'impressions', 'clicks', 'spend',
      'cpc', 'cpm', 'ctr', 'reach', 'frequency',
      'actions', 'cost_per_action_type',
      'conversions', 'conversion_values',
    ].join(',');

    const rows: MetaInsightRow[] = [];
    let url = `${BASE_URL}/${accountId}/insights?fields=${fields}&level=${level}&time_range={"since":"${dateFrom}","until":"${dateTo}"}&time_increment=1&limit=500`;

    while (url) {
      const resp = await this.request<MetaPaginatedResponse<MetaInsightRow>>(url);
      rows.push(...resp.data);
      url = resp.paging?.next || '';
    }

    return rows;
  }

  get rateLimitUsage(): string {
    return this.rateLimiter.usage;
  }
}
