/**
 * Live probe: call the Google Ads API directly for MR Mouldings March 2026
 * to compare against what's in gads_campaign_spend.
 *
 * Usage: npx tsx --env-file=.env.local scripts/utils/probe-gads-march.ts
 */
import { readFileSync } from 'fs';

const CUSTOMER_ID = '8865709674';      // MR Mouldings
const LOGIN_CUSTOMER_ID = (process.env.LOGIN_CUSTOMER_ID || process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '').replace(/-/g, '');
const DEVELOPER_TOKEN = process.env.DEVELOPER_TOKEN || process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

// Local sync reads OAuth client + refresh_token from .secrets/google-ads-tokens.json
const tokens = JSON.parse(readFileSync('.secrets/google-ads-tokens.json', 'utf-8'));
const CLIENT_ID = (tokens.client_id || process.env.GOOGLE_CLIENT_ID || '').trim();
const CLIENT_SECRET = (tokens.client_secret || process.env.GOOGLE_CLIENT_SECRET || '').trim();
const REFRESH_TOKEN = (tokens.refresh_token || process.env.GOOGLE_ADS_REFRESH_TOKEN || '').trim();

if (!LOGIN_CUSTOMER_ID || !DEVELOPER_TOKEN || !CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  console.error('Missing creds. Need env: GOOGLE_ADS_LOGIN_CUSTOMER_ID, GOOGLE_ADS_DEVELOPER_TOKEN. Need .secrets/google-ads-tokens.json with client_id/secret/refresh_token.');
  process.exit(1);
}

async function mintAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
      refresh_token: REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
  });
  const j = await res.json() as { access_token: string; error?: string };
  if (!j.access_token) throw new Error(`Token mint failed: ${JSON.stringify(j)}`);
  return j.access_token;
}

interface GadsRow {
  segments?: { date?: string };
  customer?: { id?: string; descriptiveName?: string };
  campaign?: { id?: string; name?: string };
  metrics?: {
    costMicros?: string | number;
    impressions?: string | number;
    clicks?: string | number;
    conversions?: string | number;
    conversionsValue?: string | number;
    allConversions?: string | number;
    allConversionsValue?: string | number;
  };
}

async function gaql(accessToken: string, customerId: string, query: string): Promise<GadsRow[]> {
  const url = `https://googleads.googleapis.com/v23/customers/${customerId}/googleAds:searchStream`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': DEVELOPER_TOKEN!,
      'login-customer-id': LOGIN_CUSTOMER_ID!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`GAQL ${res.status}: ${text.slice(0, 400)}`);
  const chunks: Array<{ results?: GadsRow[] }> = JSON.parse(text);
  const out: GadsRow[] = [];
  for (const c of chunks) if (c.results) out.push(...c.results);
  return out;
}

const accessToken = await mintAccessToken();

// Query A: same shape as the Vendo sync — campaign × date with conversions
const queryA = `
  SELECT
    segments.date,
    campaign.id,
    campaign.name,
    metrics.cost_micros,
    metrics.conversions,
    metrics.conversions_value,
    metrics.all_conversions,
    metrics.all_conversions_value
  FROM campaign
  WHERE segments.date BETWEEN '2026-03-01' AND '2026-03-31'
    AND metrics.cost_micros > 0
`;
const rowsA = await gaql(accessToken, CUSTOMER_ID, queryA);
console.log(`Daily-segmented rows (Vendo sync shape): ${rowsA.length}`);

// Aggregate by campaign for comparison with CSV
const byCampaign = new Map<string, { spend: number; conv: number; allConv: number; convValue: number; allConvValue: number }>();
for (const r of rowsA) {
  const name = r.campaign?.name || '?';
  const agg = byCampaign.get(name) || { spend: 0, conv: 0, allConv: 0, convValue: 0, allConvValue: 0 };
  agg.spend += Number(r.metrics?.costMicros ?? 0) / 1_000_000;
  agg.conv += Number(r.metrics?.conversions ?? 0);
  agg.allConv += Number(r.metrics?.allConversions ?? 0);
  agg.convValue += Number(r.metrics?.conversionsValue ?? 0);
  agg.allConvValue += Number(r.metrics?.allConversionsValue ?? 0);
  byCampaign.set(name, agg);
}
console.log('\n--- LIVE API: daily-segmented sum by campaign (what the sync would store) ---');
console.log('Campaign'.padEnd(40), 'Spend'.padStart(10), 'Conv'.padStart(8), 'AllConv'.padStart(8), 'ConvVal'.padStart(10));
const live = [...byCampaign.entries()].sort((a, b) => b[1].spend - a[1].spend);
for (const [name, v] of live) {
  console.log(name.slice(0, 40).padEnd(40), `£${v.spend.toFixed(2)}`.padStart(10), v.conv.toFixed(2).padStart(8), v.allConv.toFixed(2).padStart(8), `£${v.convValue.toFixed(2)}`.padStart(10));
}

// Query B: monthly-aggregate (no date segment) — what the UI shows in its CSV export
const queryB = `
  SELECT
    campaign.id,
    campaign.name,
    metrics.cost_micros,
    metrics.conversions,
    metrics.conversions_value,
    metrics.all_conversions,
    metrics.all_conversions_value
  FROM campaign
  WHERE segments.date BETWEEN '2026-03-01' AND '2026-03-31'
    AND metrics.cost_micros > 0
`;
const rowsB = await gaql(accessToken, CUSTOMER_ID, queryB);
console.log(`\n--- LIVE API: monthly aggregate (no date segment) — matches Google Ads UI CSV ---`);
console.log('Campaign'.padEnd(40), 'Spend'.padStart(10), 'Conv'.padStart(8), 'AllConv'.padStart(8), 'ConvVal'.padStart(10));
const monthly = rowsB.map(r => ({
  name: r.campaign?.name || '?',
  spend: Number(r.metrics?.costMicros ?? 0) / 1_000_000,
  conv: Number(r.metrics?.conversions ?? 0),
  allConv: Number(r.metrics?.allConversions ?? 0),
  convValue: Number(r.metrics?.conversionsValue ?? 0),
})).sort((a, b) => b.spend - a.spend);
for (const r of monthly) {
  console.log(r.name.slice(0, 40).padEnd(40), `£${r.spend.toFixed(2)}`.padStart(10), r.conv.toFixed(2).padStart(8), r.allConv.toFixed(2).padStart(8), `£${r.convValue.toFixed(2)}`.padStart(10));
}
