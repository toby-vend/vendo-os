import { db } from '../queries/base.js';
import { consoleLog } from '../monitors/base.js';

/**
 * Turso-native port of scripts/sync/sync-google-ads.ts. Runs in-process on
 * Vercel serverless — no sql.js, no filesystem, no child process.
 *
 * Auth: the refresh token lives in GOOGLE_ADS_REFRESH_TOKEN env var rather
 * than .secrets/google-ads-tokens.json (Google refresh tokens are
 * long-lived and don't rotate, so an env var is sufficient). The access
 * token is minted fresh on every run.
 *
 * Scope — parity with the original incremental sync:
 *   1. Discover MCC client accounts  → gads_accounts
 *   2. Campaign spend (last 7 days)  → gads_campaign_spend
 *   3. Keyword stats (last 7 days)   → gads_keyword_stats
 *
 * Client-to-account resolution is out of scope here — the original helper
 * is sql.js-based; a Turso port will follow in a later commit.
 */

const LOG = 'sync-google-ads';
const API_VERSION = 'v23';
const BASE_URL = `https://googleads.googleapis.com/${API_VERSION}`;
const DEFAULT_DAYS = 7;

export interface GoogleAdsSyncResult {
  accounts: number;
  campaignRows: number;
  keywordRows: number;
  durationMs: number;
}

interface GadsRow {
  segments?: { date: string };
  customer?: { id: string | number; descriptiveName?: string };
  campaign?: { id: string | number; name?: string; status?: string };
  adGroup?: { id: string | number; name?: string };
  adGroupCriterion?: { keyword?: { text?: string; matchType?: string } };
  customerClient?: {
    id: string | number;
    descriptiveName?: string;
    currencyCode?: string;
    timeZone?: string;
    status?: string;
    manager?: boolean;
  };
  metrics?: {
    costMicros?: string | number;
    impressions?: string | number;
    clicks?: string | number;
    conversions?: string | number;
    conversionsValue?: string | number;
  };
}

// --- Auth ---

async function mintAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_ADS_REFRESH_TOKEN must be set');
  }
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Google Ads token refresh failed (${resp.status}): ${body.slice(0, 200)}`);
  }
  const data = (await resp.json()) as { access_token: string };
  return data.access_token;
}

async function gadsQuery(accessToken: string, customerId: string, query: string): Promise<GadsRow[]> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/-/g, '');
  if (!developerToken || !loginCustomerId) {
    throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN and GOOGLE_ADS_LOGIN_CUSTOMER_ID must be set');
  }
  const resp = await fetch(`${BASE_URL}/customers/${customerId}/googleAds:searchStream`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': developerToken,
      'login-customer-id': loginCustomerId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Google Ads API ${resp.status}: ${body.slice(0, 300)}`);
  }
  const data = (await resp.json()) as Array<{ results?: GadsRow[] }>;
  const rows: GadsRow[] = [];
  for (const batch of data) if (batch.results) rows.push(...batch.results);
  return rows;
}

// --- Helpers ---

function dateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

// --- Sync steps ---

async function listClientAccounts(accessToken: string): Promise<Array<{ id: string; name: string; currency: string; tz: string; status: string }>> {
  const loginId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID!.replace(/-/g, '');
  const rows = await gadsQuery(accessToken, loginId, `
    SELECT
      customer_client.id,
      customer_client.descriptive_name,
      customer_client.currency_code,
      customer_client.time_zone,
      customer_client.status,
      customer_client.manager
    FROM customer_client
    WHERE customer_client.status = 'ENABLED'
      AND customer_client.manager = false
  `);
  return rows.map(r => ({
    id: String(r.customerClient!.id),
    name: r.customerClient!.descriptiveName || 'Unnamed',
    currency: r.customerClient!.currencyCode || 'GBP',
    tz: r.customerClient!.timeZone || 'Europe/London',
    status: r.customerClient!.status || 'ENABLED',
  }));
}

async function upsertAccounts(accounts: Array<{ id: string; name: string; currency: string; tz: string; status: string }>, now: string): Promise<void> {
  const loginId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID!.replace(/-/g, '');
  const batch = accounts.map(a => ({
    sql: `INSERT INTO gads_accounts (id, descriptive_name, currency_code, time_zone, manager_id, status, synced_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            descriptive_name = excluded.descriptive_name,
            currency_code = excluded.currency_code,
            time_zone = excluded.time_zone,
            status = excluded.status,
            synced_at = excluded.synced_at`,
    args: [a.id, a.name, a.currency, a.tz, loginId, a.status, now] as (string | number | null)[],
  }));
  if (batch.length) await db.batch(batch);
}

async function fetchCampaignSpend(accessToken: string, customerId: string, dateFrom: string, dateTo: string): Promise<GadsRow[]> {
  return gadsQuery(accessToken, customerId, `
    SELECT
      segments.date,
      customer.id,
      customer.descriptive_name,
      campaign.id,
      campaign.name,
      campaign.status,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE segments.date BETWEEN '${dateFrom}' AND '${dateTo}'
    ORDER BY segments.date DESC
  `);
}

async function fetchKeywordStats(accessToken: string, customerId: string, dateFrom: string, dateTo: string): Promise<GadsRow[]> {
  return gadsQuery(accessToken, customerId, `
    SELECT
      segments.date,
      customer.id,
      campaign.id,
      campaign.name,
      ad_group.id,
      ad_group.name,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.conversions_value
    FROM keyword_view
    WHERE segments.date BETWEEN '${dateFrom}' AND '${dateTo}'
      AND ad_group_criterion.status = 'ENABLED'
    ORDER BY metrics.cost_micros DESC
    LIMIT 500
  `);
}

async function ensureKeywordTable(): Promise<void> {
  await db.execute(`CREATE TABLE IF NOT EXISTS gads_keyword_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    account_id TEXT NOT NULL,
    campaign_id TEXT,
    campaign_name TEXT,
    ad_group_id TEXT,
    ad_group_name TEXT,
    keyword_text TEXT NOT NULL,
    match_type TEXT,
    spend REAL DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    conversions REAL DEFAULT 0,
    conversion_value REAL DEFAULT 0,
    synced_at TEXT NOT NULL,
    UNIQUE(date, account_id, campaign_id, ad_group_id, keyword_text)
  )`);
  await db.execute('CREATE INDEX IF NOT EXISTS idx_gads_kw_account ON gads_keyword_stats(account_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_gads_kw_date ON gads_keyword_stats(date)');
}

// --- Main ---

export async function syncGoogleAds(): Promise<GoogleAdsSyncResult> {
  const start = Date.now();
  const accessToken = await mintAccessToken();
  const now = new Date().toISOString();

  consoleLog(LOG, 'Fetching MCC client accounts...');
  const accounts = await listClientAccounts(accessToken);
  consoleLog(LOG, `Found ${accounts.length} accounts`);
  await upsertAccounts(accounts, now);

  const dateFrom = dateStr(DEFAULT_DAYS);
  const dateTo = dateStr(0);
  consoleLog(LOG, `Fetching campaign spend ${dateFrom} → ${dateTo}`);

  let campaignRows = 0;
  for (const acct of accounts) {
    try {
      const rows = await fetchCampaignSpend(accessToken, acct.id, dateFrom, dateTo);
      if (!rows.length) continue;
      const batch = rows.map(r => {
        const costMicros = Number(r.metrics?.costMicros ?? 0);
        const spend = costMicros / 1_000_000;
        const conversions = Number(r.metrics?.conversions ?? 0);
        const conversionValue = Number(r.metrics?.conversionsValue ?? 0);
        const costPerConversion = conversions > 0 ? spend / conversions : 0;
        return {
          sql: `INSERT INTO gads_campaign_spend (date, account_id, account_name, campaign_id, campaign_name, campaign_status, spend_micros, spend, impressions, clicks, conversions, conversion_value, cost_per_conversion, synced_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(date, account_id, campaign_id) DO UPDATE SET
                  account_name = excluded.account_name,
                  campaign_name = excluded.campaign_name,
                  campaign_status = excluded.campaign_status,
                  spend_micros = excluded.spend_micros,
                  spend = excluded.spend,
                  impressions = excluded.impressions,
                  clicks = excluded.clicks,
                  conversions = excluded.conversions,
                  conversion_value = excluded.conversion_value,
                  cost_per_conversion = excluded.cost_per_conversion,
                  synced_at = excluded.synced_at`,
          args: [
            r.segments!.date,
            String(r.customer!.id),
            r.customer!.descriptiveName || acct.name,
            String(r.campaign!.id),
            r.campaign!.name || null,
            r.campaign!.status || null,
            costMicros,
            spend,
            Number(r.metrics?.impressions ?? 0),
            Number(r.metrics?.clicks ?? 0),
            conversions,
            conversionValue,
            costPerConversion,
            now,
          ] as (string | number | null)[],
        };
      });
      await db.batch(batch);
      campaignRows += rows.length;
      consoleLog(LOG, `  ${acct.name}: ${rows.length} campaign rows`);
    } catch (err) {
      consoleLog(LOG, `  ${acct.name}: campaign fetch failed — ${err instanceof Error ? err.message.slice(0, 120) : err}`);
    }
  }

  await ensureKeywordTable();
  consoleLog(LOG, 'Fetching keyword stats...');
  let keywordRows = 0;
  for (const acct of accounts) {
    try {
      const rows = await fetchKeywordStats(accessToken, acct.id, dateFrom, dateTo);
      if (!rows.length) continue;
      const batch = rows.map(r => {
        const costMicros = Number(r.metrics?.costMicros ?? 0);
        return {
          sql: `INSERT INTO gads_keyword_stats (date, account_id, campaign_id, campaign_name, ad_group_id, ad_group_name, keyword_text, match_type, spend, impressions, clicks, conversions, conversion_value, synced_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(date, account_id, campaign_id, ad_group_id, keyword_text) DO UPDATE SET
                  campaign_name = excluded.campaign_name,
                  ad_group_name = excluded.ad_group_name,
                  match_type = excluded.match_type,
                  spend = excluded.spend,
                  impressions = excluded.impressions,
                  clicks = excluded.clicks,
                  conversions = excluded.conversions,
                  conversion_value = excluded.conversion_value,
                  synced_at = excluded.synced_at`,
          args: [
            r.segments!.date,
            String(r.customer!.id),
            String(r.campaign?.id || ''),
            r.campaign?.name || null,
            String(r.adGroup?.id || ''),
            r.adGroup?.name || null,
            r.adGroupCriterion?.keyword?.text || 'Unknown',
            r.adGroupCriterion?.keyword?.matchType || null,
            costMicros / 1_000_000,
            Number(r.metrics?.impressions ?? 0),
            Number(r.metrics?.clicks ?? 0),
            Number(r.metrics?.conversions ?? 0),
            Number(r.metrics?.conversionsValue ?? 0),
            now,
          ] as (string | number | null)[],
        };
      });
      await db.batch(batch);
      keywordRows += rows.length;
      consoleLog(LOG, `  ${acct.name}: ${rows.length} keywords`);
    } catch (err) {
      // keyword_view is unavailable for some campaign types — non-fatal
      consoleLog(LOG, `  ${acct.name}: keyword skipped (${err instanceof Error ? err.message.slice(0, 60) : err})`);
    }
  }

  const durationMs = Date.now() - start;
  consoleLog(LOG, `Sync complete in ${durationMs}ms: ${campaignRows} campaign rows, ${keywordRows} keyword rows`);
  return { accounts: accounts.length, campaignRows, keywordRows, durationMs };
}
