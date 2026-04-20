import { db } from '../queries/base.js';
import { consoleLog } from '../monitors/base.js';

/**
 * Turso-native port of scripts/sync/sync-meta-ads.ts. Runs in-process on
 * Vercel serverless — no sql.js, no filesystem, no child process.
 *
 * Auth uses META_ACCESS_TOKEN env var (long-lived system user token).
 *
 * Scope — parity with the original incremental sync:
 *   1. Discover ad accounts                → meta_ad_accounts
 *   2. Insights at campaign/adset/ad level → meta_insights (last 7 days)
 *   3. Backfill creative thumbnails        → meta_insights.thumbnail_url
 */

const LOG = 'sync-meta-ads';
const API_VERSION = 'v21.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;
const DEFAULT_DAYS = 7;
const RATE_LIMIT_PER_MIN = 180;
const BATCH_SIZE = 100;

export interface MetaSyncResult {
  accounts: number;
  activeAccounts: number;
  insightRows: number;
  thumbnails: number;
  durationMs: number;
}

interface MetaAdAccount {
  id: string;
  name: string;
  account_id: string;
  account_status: number;
  currency: string;
  timezone_name: string;
}

interface MetaInsightRow {
  date_start: string;
  date_stop: string;
  account_id: string;
  account_name?: string;
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

interface PagedResponse<T> {
  data: T[];
  paging?: { next?: string };
}

// --- Rate limiter ---

class RateLimiter {
  private timestamps: number[] = [];
  async acquire(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < 60_000);
    if (this.timestamps.length >= RATE_LIMIT_PER_MIN) {
      const waitMs = 60_000 - (now - this.timestamps[0]) + 100;
      consoleLog(LOG, `Rate limit — waiting ${Math.ceil(waitMs / 1000)}s`);
      await new Promise(r => setTimeout(r, waitMs));
      return this.acquire();
    }
    this.timestamps.push(Date.now());
  }
}

const limiter = new RateLimiter();

async function metaFetch<T>(url: string, accessToken: string, retries = 3): Promise<T> {
  await limiter.acquire();
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (resp.status === 429) {
    const retryAfter = parseInt(resp.headers.get('retry-after') || '60', 10);
    consoleLog(LOG, `429 — waiting ${retryAfter}s`);
    await new Promise(r => setTimeout(r, retryAfter * 1000));
    return metaFetch<T>(url, accessToken, retries);
  }
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    if (retries > 0 && resp.status >= 500) {
      await new Promise(r => setTimeout(r, Math.pow(2, 3 - retries) * 1000));
      return metaFetch<T>(url, accessToken, retries - 1);
    }
    throw new Error(`Meta HTTP ${resp.status}: ${body.slice(0, 200)}`);
  }
  return (await resp.json()) as T;
}

// --- Helpers ---

function dateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function parseNum(v: string | undefined): number | null {
  if (v === undefined || v === null) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

async function listAdAccounts(accessToken: string): Promise<MetaAdAccount[]> {
  const accounts: MetaAdAccount[] = [];
  let url = `${BASE_URL}/me/adaccounts?fields=id,name,account_id,account_status,currency,timezone_name&limit=100`;
  while (url) {
    const resp = await metaFetch<PagedResponse<MetaAdAccount>>(url, accessToken);
    accounts.push(...resp.data);
    url = resp.paging?.next || '';
  }
  return accounts;
}

async function fetchInsights(
  accessToken: string,
  accountId: string,
  level: 'campaign' | 'adset' | 'ad',
  dateFrom: string,
  dateTo: string,
): Promise<MetaInsightRow[]> {
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
    const resp = await metaFetch<PagedResponse<MetaInsightRow>>(url, accessToken);
    rows.push(...resp.data);
    url = resp.paging?.next || '';
  }
  return rows;
}

function insightsToBatch(rows: MetaInsightRow[], level: string, now: string) {
  return rows.map(row => ({
    sql: `INSERT INTO meta_insights (date, account_id, account_name, level, campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name, impressions, clicks, spend, cpc, cpm, ctr, reach, frequency, conversions, conversion_values, actions, cost_per_action, synced_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(date, account_id, level, campaign_id, adset_id, ad_id) DO UPDATE SET
            account_name = excluded.account_name,
            campaign_name = excluded.campaign_name,
            adset_name = excluded.adset_name,
            ad_name = excluded.ad_name,
            impressions = excluded.impressions,
            clicks = excluded.clicks,
            spend = excluded.spend,
            cpc = excluded.cpc,
            cpm = excluded.cpm,
            ctr = excluded.ctr,
            reach = excluded.reach,
            frequency = excluded.frequency,
            conversions = excluded.conversions,
            conversion_values = excluded.conversion_values,
            actions = excluded.actions,
            cost_per_action = excluded.cost_per_action,
            synced_at = excluded.synced_at`,
    args: [
      row.date_start,
      row.account_id,
      row.account_name || null,
      level,
      row.campaign_id || null,
      row.campaign_name || null,
      row.adset_id || null,
      row.adset_name || null,
      row.ad_id || null,
      row.ad_name || null,
      parseInt(row.impressions) || 0,
      parseInt(row.clicks) || 0,
      parseFloat(row.spend) || 0,
      parseNum(row.cpc),
      parseNum(row.cpm),
      parseNum(row.ctr),
      row.reach ? parseInt(row.reach) : null,
      parseNum(row.frequency),
      row.conversions ? JSON.stringify(row.conversions) : null,
      row.conversion_values ? JSON.stringify(row.conversion_values) : null,
      row.actions ? JSON.stringify(row.actions) : null,
      row.cost_per_action_type ? JSON.stringify(row.cost_per_action_type) : null,
      now,
    ] as (string | number | null)[],
  }));
}

async function backfillThumbnails(accessToken: string): Promise<number> {
  // meta_insights.thumbnail_url may not yet exist; swallow on idempotent failure
  try {
    await db.execute('ALTER TABLE meta_insights ADD COLUMN thumbnail_url TEXT');
  } catch { /* already exists */ }

  const missing = await db.execute(`
    SELECT DISTINCT ad_id FROM meta_insights
    WHERE level = 'ad' AND ad_id IS NOT NULL AND thumbnail_url IS NULL
    LIMIT 50
  `);
  if (!missing.rows.length) return 0;

  let count = 0;
  for (const row of missing.rows) {
    const adId = row.ad_id as string;
    try {
      const resp = await fetch(
        `${BASE_URL}/${adId}?fields=creative{thumbnail_url,image_url}&access_token=${encodeURIComponent(accessToken)}`,
      );
      if (!resp.ok) continue;
      const data = (await resp.json()) as { creative?: { thumbnail_url?: string; image_url?: string } };
      const thumbUrl = data?.creative?.thumbnail_url || data?.creative?.image_url || null;
      if (thumbUrl) {
        await db.execute({
          sql: 'UPDATE meta_insights SET thumbnail_url = ? WHERE ad_id = ?',
          args: [thumbUrl, adId],
        });
        count++;
      }
    } catch {
      // Non-fatal per ad
    }
  }
  return count;
}

// --- Main ---

export async function syncMetaAds(): Promise<MetaSyncResult> {
  const start = Date.now();
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!accessToken) throw new Error('META_ACCESS_TOKEN must be set');

  const now = new Date().toISOString();

  consoleLog(LOG, 'Fetching ad accounts...');
  const accounts = await listAdAccounts(accessToken);
  const active = accounts.filter(a => a.account_status === 1);
  consoleLog(LOG, `Found ${accounts.length} accounts (${active.length} active)`);

  if (accounts.length) {
    const accountBatch = accounts.map(a => ({
      sql: `INSERT INTO meta_ad_accounts (id, account_id, name, account_status, currency, timezone_name, synced_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              account_status = excluded.account_status,
              currency = excluded.currency,
              timezone_name = excluded.timezone_name,
              synced_at = excluded.synced_at`,
      args: [a.id, a.account_id, a.name, a.account_status, a.currency, a.timezone_name, now] as (string | number | null)[],
    }));
    await db.batch(accountBatch);
  }

  const dateFrom = dateStr(DEFAULT_DAYS);
  const dateTo = dateStr(0);
  consoleLog(LOG, `Fetching insights ${dateFrom} → ${dateTo}`);

  let totalRows = 0;
  for (const acct of active) {
    for (const level of ['campaign', 'adset', 'ad'] as const) {
      try {
        const rows = await fetchInsights(accessToken, acct.id, level, dateFrom, dateTo);
        if (!rows.length) continue;
        const all = insightsToBatch(rows, level, now);
        for (let i = 0; i < all.length; i += BATCH_SIZE) {
          await db.batch(all.slice(i, i + BATCH_SIZE));
        }
        totalRows += rows.length;
        consoleLog(LOG, `  ${acct.name} ${level}: ${rows.length} rows`);
      } catch (err) {
        consoleLog(LOG, `  ${acct.name} ${level} failed: ${err instanceof Error ? err.message.slice(0, 120) : err}`);
      }
    }
  }

  const thumbnails = await backfillThumbnails(accessToken);

  const durationMs = Date.now() - start;
  consoleLog(LOG, `Sync complete in ${durationMs}ms: ${totalRows} rows, ${thumbnails} thumbnails`);
  return { accounts: accounts.length, activeAccounts: active.length, insightRows: totalRows, thumbnails, durationMs };
}
