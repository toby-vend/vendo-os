/**
 * Re-sync gads_campaign_spend for specific accounts over a custom date range.
 * Fixes attribution-lag drift in historical rows by overwriting them with
 * fresh API data.
 *
 * Usage: npx tsx --env-file=.env.local scripts/utils/resync-gads-period.ts
 *
 * Hard-coded for now (one-off): MR Mouldings, Sword Stall, Avenue Dental,
 * March 2026.
 */
import { readFileSync } from 'fs';
import { db } from '../../web/lib/queries/base.js';

const ACCOUNTS = [
  { id: '8865709674', name: 'MR Mouldings Skirting' },
  { id: '2310522325', name: 'The Sword Stall' },
  { id: '4198725064', name: 'Avenue Dental Practice' },
];
const DATE_FROM = '2026-03-01';
const DATE_TO = '2026-03-31';

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
  const j = await res.json() as { access_token: string };
  return j.access_token;
}

interface GadsRow {
  segments?: { date?: string };
  customer?: { id?: string; descriptiveName?: string };
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
      customer.id, customer.descriptive_name,
      campaign.id, campaign.name, campaign.status,
      metrics.cost_micros, metrics.impressions, metrics.clicks,
      metrics.conversions, metrics.conversions_value
    FROM campaign
    WHERE segments.date BETWEEN '${DATE_FROM}' AND '${DATE_TO}'
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
  if (!res.ok) throw new Error(`GAQL ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const chunks: Array<{ results?: GadsRow[] }> = JSON.parse(await res.text());
  const out: GadsRow[] = [];
  for (const c of chunks) if (c.results) out.push(...c.results);
  return out;
}

const token = await mintAccessToken();
const syncedAt = new Date().toISOString();

for (const acc of ACCOUNTS) {
  console.log(`\n--- ${acc.name} (${acc.id}) ---`);
  const rows = await fetchCampaignSpend(token, acc.id);
  console.log(`API returned ${rows.length} rows`);

  let written = 0;
  for (const r of rows) {
    const date = r.segments?.date;
    const campaignId = r.campaign?.id;
    if (!date || !campaignId) continue;

    const spend = Number(r.metrics?.costMicros ?? 0) / 1_000_000;
    const conversions = Number(r.metrics?.conversions ?? 0);
    const conversionValue = Number(r.metrics?.conversionsValue ?? 0);
    const costPerConversion = conversions > 0 ? spend / conversions : 0;

    await db.execute({
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
        date, acc.id, r.customer?.descriptiveName || acc.name,
        campaignId, r.campaign?.name || '', r.campaign?.status || '',
        Number(r.metrics?.costMicros ?? 0), spend,
        Number(r.metrics?.impressions ?? 0), Number(r.metrics?.clicks ?? 0),
        conversions, conversionValue, costPerConversion, syncedAt,
      ],
    });
    written++;
  }
  console.log(`Upserted: ${written}`);

  // Sanity check
  const after = await db.execute({
    sql: `SELECT SUM(spend) as s, SUM(conversions) as c, SUM(conversion_value) as v
            FROM gads_campaign_spend
           WHERE account_id = ? AND date BETWEEN ? AND ?`,
    args: [acc.id, DATE_FROM, DATE_TO],
  });
  const row = after.rows[0] as { s: number; c: number; v: number };
  console.log(`DB now: spend £${Number(row.s).toFixed(2)}  conv ${Number(row.c).toFixed(2)}  cv £${Number(row.v).toFixed(2)}`);
}

console.log('\nResync complete.');
