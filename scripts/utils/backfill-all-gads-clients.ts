/**
 * Backfill Google Ads campaign spend for ALL clients mapped in
 * gads_account_client_map, over the last 90 days. Fixes historical
 * attribution-lag drift across the whole client base.
 *
 * Idempotent. Safe to re-run. Logs each account's before/after totals.
 *
 * Usage: npx tsx --env-file=.env.local scripts/utils/backfill-all-gads-clients.ts
 */
import { readFileSync } from 'fs';
import { db, rows } from '../../web/lib/queries/base.js';

const BACKFILL_DAYS = 90;
const today = new Date();
const dateTo = today.toISOString().slice(0, 10);
const from = new Date(today);
from.setDate(from.getDate() - BACKFILL_DAYS);
const dateFrom = from.toISOString().slice(0, 10);

const LOGIN_CUSTOMER_ID = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '').replace(/-/g, '').trim();
const DEVELOPER_TOKEN = (process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '').trim();
const tokens = JSON.parse(readFileSync('.secrets/google-ads-tokens.json', 'utf-8'));
const CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || '').trim();
const CLIENT_SECRET = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
const REFRESH_TOKEN = (tokens.refresh_token || process.env.GOOGLE_ADS_REFRESH_TOKEN || '').trim();

async function mintAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const j = await res.json() as { access_token?: string };
  if (!j.access_token) throw new Error(`Token mint failed: ${JSON.stringify(j)}`);
  return j.access_token;
}

interface GadsRow {
  segments?: { date?: string };
  customer?: { descriptiveName?: string };
  campaign?: { id?: string; name?: string; status?: string };
  metrics?: {
    costMicros?: string | number;
    impressions?: string | number;
    clicks?: string | number;
    conversions?: string | number;
    conversionsValue?: string | number;
  };
}

async function fetchCampaignSpend(token: string, customerId: string): Promise<GadsRow[]> {
  const url = `https://googleads.googleapis.com/v23/customers/${customerId}/googleAds:searchStream`;
  const query = `
    SELECT
      segments.date,
      customer.descriptive_name,
      campaign.id, campaign.name, campaign.status,
      metrics.cost_micros, metrics.impressions, metrics.clicks,
      metrics.conversions, metrics.conversions_value
    FROM campaign
    WHERE segments.date BETWEEN '${dateFrom}' AND '${dateTo}'
      AND metrics.cost_micros > 0
  `;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'developer-token': DEVELOPER_TOKEN,
      'login-customer-id': LOGIN_CUSTOMER_ID,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw new Error(`GAQL ${res.status}: ${body}`);
  }
  const chunks: Array<{ results?: GadsRow[] }> = JSON.parse(await res.text());
  const out: GadsRow[] = [];
  for (const c of chunks) if (c.results) out.push(...c.results);
  return out;
}

const accounts = await rows<{ gads_customer_id: string; client_id: number; notes: string | null }>(
  `SELECT m.gads_customer_id, m.client_id, m.notes
     FROM gads_account_client_map m
     ORDER BY m.gads_customer_id`,
);
console.log(`Mapped accounts to backfill: ${accounts.length}`);
console.log(`Period: ${dateFrom} → ${dateTo} (${BACKFILL_DAYS} days)`);

const token = await mintAccessToken();
const syncedAt = new Date().toISOString();
// Skip threshold: an account whose latest row was synced within the last
// 6 hours is treated as already-backfilled. Lets the script resume cleanly
// after a crash without redoing finished accounts.
const SKIP_IF_SYNCED_WITHIN_MS = 6 * 60 * 60 * 1000;
const todayStartIso = new Date(Date.now() - SKIP_IF_SYNCED_WITHIN_MS).toISOString();

/** Retry a fn on transient network errors (ECONNRESET, EAI_AGAIN, timeouts). */
async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let n = 1; n <= attempts; n++) {
    try { return await fn(); }
    catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const transient = /ECONNRESET|EAI_AGAIN|ETIMEDOUT|fetch failed|socket hang up|503|502|504/i.test(msg);
      if (!transient || n === attempts) throw err;
      const backoff = 500 * Math.pow(2, n - 1);  // 0.5s, 1s, 2s
      console.log(`  ${label}: transient error (attempt ${n}/${attempts}), retrying in ${backoff}ms — ${msg.slice(0, 80)}`);
      await new Promise(r => setTimeout(r, backoff));
    }
  }
  throw lastErr;
}

let totalRowsBefore = 0;
let totalConvsBefore = 0;
let totalRowsAfter = 0;
let totalConvsAfter = 0;
let skipped = 0;
const errors: string[] = [];

for (let i = 0; i < accounts.length; i++) {
  const acc = accounts[i];
  const tag = `[${(i + 1).toString().padStart(2)}/${accounts.length}] ${acc.gads_customer_id}`;

  // Skip-if-already-synced-today: if ANY row for this account was synced
  // today, the previous run got here. Makes the script crash-resumable.
  const syncCheck = await withRetry(`${tag} check`, () => db.execute({
    sql: `SELECT MAX(synced_at) as last_sync
            FROM gads_campaign_spend
           WHERE account_id = ? AND date BETWEEN ? AND ?`,
    args: [acc.gads_customer_id, dateFrom, dateTo],
  }));
  const lastSync = (syncCheck.rows[0] as { last_sync: string | null }).last_sync;
  if (lastSync && lastSync >= todayStartIso) {
    console.log(`${tag}  skipped (already synced today)  ${acc.notes ?? ''}`);
    skipped++;
    continue;
  }

  // Before
  const before = await withRetry(`${tag} before`, () => db.execute({
    sql: `SELECT COUNT(*) as rows_, COALESCE(SUM(conversions),0) as conv
            FROM gads_campaign_spend
           WHERE account_id = ? AND date BETWEEN ? AND ?`,
    args: [acc.gads_customer_id, dateFrom, dateTo],
  }));
  const b = before.rows[0] as { rows_: number; conv: number };
  totalRowsBefore += Number(b.rows_);
  totalConvsBefore += Number(b.conv);

  let rowsApi: GadsRow[];
  try {
    rowsApi = await withRetry(`${tag} api`, () => fetchCampaignSpend(token, acc.gads_customer_id));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`${acc.gads_customer_id} (${acc.notes ?? '?'}): ${msg}`);
    console.log(`${tag}  ERROR: ${msg.slice(0, 100)}`);
    continue;
  }

  // Batch all upserts for this account into a single libsql transaction —
  // one round-trip instead of N. Both faster and far less exposure to
  // transient connection drops mid-account.
  const batch: Array<{ sql: string; args: (string | number | null)[] }> = [];
  for (const r of rowsApi) {
    const date = r.segments?.date;
    const campaignId = r.campaign?.id;
    if (!date || !campaignId) continue;
    const spend = Number(r.metrics?.costMicros ?? 0) / 1_000_000;
    const conv = Number(r.metrics?.conversions ?? 0);
    const convVal = Number(r.metrics?.conversionsValue ?? 0);
    const cpc = conv > 0 ? spend / conv : 0;
    batch.push({
      sql: `INSERT INTO gads_campaign_spend (date, account_id, account_name, campaign_id, campaign_name, campaign_status, spend_micros, spend, impressions, clicks, conversions, conversion_value, cost_per_conversion, synced_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(date, account_id, campaign_id) DO UPDATE SET
              spend_micros = excluded.spend_micros,
              spend = excluded.spend,
              impressions = excluded.impressions,
              clicks = excluded.clicks,
              conversions = excluded.conversions,
              conversion_value = excluded.conversion_value,
              cost_per_conversion = excluded.cost_per_conversion,
              synced_at = excluded.synced_at`,
      args: [
        date, acc.gads_customer_id, r.customer?.descriptiveName ?? '',
        campaignId, r.campaign?.name ?? '', r.campaign?.status ?? '',
        Number(r.metrics?.costMicros ?? 0), spend,
        Number(r.metrics?.impressions ?? 0), Number(r.metrics?.clicks ?? 0),
        conv, convVal, cpc, syncedAt,
      ],
    });
  }
  if (batch.length) {
    // db.batch chunks in groups of 200 statements to stay under libsql's
    // payload limit while still cutting round-trips dramatically.
    for (let s = 0; s < batch.length; s += 200) {
      const chunk = batch.slice(s, s + 200);
      await withRetry(`${tag} upsert[${s}-${s + chunk.length}]`, () => db.batch(chunk, 'write'));
    }
  }

  const after = await withRetry(`${tag} after`, () => db.execute({
    sql: `SELECT COUNT(*) as rows_, COALESCE(SUM(conversions),0) as conv
            FROM gads_campaign_spend
           WHERE account_id = ? AND date BETWEEN ? AND ?`,
    args: [acc.gads_customer_id, dateFrom, dateTo],
  }));
  const a = after.rows[0] as { rows_: number; conv: number };
  totalRowsAfter += Number(a.rows_);
  totalConvsAfter += Number(a.conv);

  const delta = (Number(a.conv) - Number(b.conv));
  console.log(`${tag}  rows: ${b.rows_}→${a.rows_}  conv: ${Number(b.conv).toFixed(1)}→${Number(a.conv).toFixed(1)} (${delta >= 0 ? '+' : ''}${delta.toFixed(1)})  ${acc.notes ?? ''}`);
}

console.log('');
console.log('=== Backfill summary ===');
console.log(`Accounts processed:    ${accounts.length - skipped}`);
console.log(`Accounts skipped:      ${skipped} (already synced within 6h)`);
console.log(`Rows before:           ${totalRowsBefore}`);
console.log(`Rows after:            ${totalRowsAfter}`);
console.log(`Conversions before:    ${totalConvsBefore.toFixed(1)}`);
console.log(`Conversions after:     ${totalConvsAfter.toFixed(1)}`);
console.log(`Conversion delta:      ${(totalConvsAfter - totalConvsBefore).toFixed(1)}`);
if (errors.length) {
  console.log('');
  console.log(`Errors (${errors.length}):`);
  for (const e of errors) console.log(`  ${e}`);
}
