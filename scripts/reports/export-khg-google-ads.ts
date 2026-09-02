/**
 * Export the Google Ads "Campaign performance by month" and "Conversion
 * actions by month" reports for every Kana Health Group (KHG) account.
 *
 * Mirrors the two predefined UI reports Kana share with us, so the CSVs land
 * in data/kana-health-group/uploads/google-ads/ in the same column layout.
 *
 * Run: node --env-file=.env.local --import tsx/esm scripts/reports/export-khg-google-ads.ts [--from=2026-02-01] [--to=YYYY-MM-DD]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const API_VERSION = 'v23';
const BASE_URL = `https://googleads.googleapis.com/${API_VERSION}`;
const OUT_DIR = 'data/kana-health-group/uploads/google-ads';

const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
const LOGIN_CUSTOMER_ID = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.trim().replace(/-/g, '');
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim();
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET?.trim();

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const FROM = arg('from') ?? '2025-01-01';
const TO = arg('to') ?? new Date().toISOString().slice(0, 10);

const tokens = JSON.parse(readFileSync('.secrets/google-ads-tokens.json', 'utf-8'));
if (!DEVELOPER_TOKEN || !LOGIN_CUSTOMER_ID || !CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing Google Ads env vars');
  process.exit(1);
}

async function accessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID!, client_secret: CLIENT_SECRET!,
      refresh_token: tokens.refresh_token, grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed (${res.status}): ${await res.text()}`);
  return (await res.json()).access_token;
}

async function gaql(customerId: string, query: string, token: string): Promise<any[]> {
  const res = await fetch(`${BASE_URL}/customers/${customerId}/googleAds:searchStream`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'developer-token': DEVELOPER_TOKEN!,
      'login-customer-id': LOGIN_CUSTOMER_ID!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Google Ads API error (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return data.flatMap((b: any) => b.results ?? []);
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const monthLabel = (ymd: string) => `${MONTHS[parseInt(ymd.slice(5, 7), 10) - 1]} ${ymd.slice(0, 4)}`;
const money = (micros: any) => (Number(micros ?? 0) / 1e6).toFixed(2);
const pct = (v: any) => `${(Number(v ?? 0) * 100).toFixed(2)}%`;
const csv = (rows: string[][]) =>
  rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n') + '\n';
const STATE: Record<string, string> = { ENABLED: 'Enabled', PAUSED: 'Paused', REMOVED: 'Removed' };
const TYPE: Record<string, string> = { SEARCH: 'Search', PERFORMANCE_MAX: 'Performance Max', DISPLAY: 'Display', VIDEO: 'Video', SHOPPING: 'Shopping', DEMAND_GEN: 'Demand Gen' };

async function main() {
  const token = await accessToken();
  const accounts = await gaql(LOGIN_CUSTOMER_ID!, `
    SELECT customer_client.id, customer_client.descriptive_name
    FROM customer_client
    WHERE customer_client.status = 'ENABLED' AND customer_client.manager = false
      AND customer_client.descriptive_name LIKE 'KHG - %'`, token);
  mkdirSync(OUT_DIR, { recursive: true });

  for (const a of accounts) {
    const id = String(a.customerClient.id);
    const name = String(a.customerClient.descriptiveName).replace(/^KHG - /, '');
    const slug = name.replace(/[^A-Za-z0-9]+/g, '-').replace(/-$/, '');

    const perf = await gaql(id, `
      SELECT campaign.name, campaign.status, campaign.advertising_channel_type, segments.month,
        customer.currency_code,
        metrics.clicks, metrics.impressions, metrics.ctr, metrics.average_cpc, metrics.cost_micros,
        metrics.absolute_top_impression_percentage, metrics.top_impression_percentage,
        metrics.conversions, metrics.view_through_conversions, metrics.cost_per_conversion,
        metrics.conversions_from_interactions_rate
      FROM campaign
      WHERE segments.date BETWEEN '${FROM}' AND '${TO}' AND metrics.impressions > 0
      ORDER BY campaign.name, segments.month`, token);

    const perfRows: string[][] = [[
      'Campaign','Campaign state','Campaign type','Month','Clicks','Impr.','CTR','Currency code','Avg. CPC','Cost',
      'Impr. (Abs. Top) %','Impr. (Top) %','Conversions','View-through conv.','Cost / conv.','Conv. rate',
    ]];
    for (const r of perf) {
      const m = r.metrics ?? {};
      perfRows.push([
        r.campaign.name, STATE[r.campaign.status] ?? r.campaign.status, TYPE[r.campaign.advertisingChannelType] ?? r.campaign.advertisingChannelType,
        monthLabel(r.segments.month), String(m.clicks ?? 0), String(m.impressions ?? 0), pct(m.ctr), r.customer.currencyCode,
        money(m.averageCpc), money(m.costMicros), pct(m.absoluteTopImpressionPercentage), pct(m.topImpressionPercentage),
        Number(m.conversions ?? 0).toFixed(2), String(m.viewThroughConversions ?? 0), money(m.costPerConversion),
        pct(m.conversionsFromInteractionsRate),
      ]);
    }

    const conv = await gaql(id, `
      SELECT campaign.name, campaign.status, campaign.advertising_channel_type, segments.month,
        segments.conversion_action_name, metrics.conversions
      FROM campaign
      WHERE segments.date BETWEEN '${FROM}' AND '${TO}' AND metrics.conversions > 0
      ORDER BY campaign.name, segments.month`, token);

    const convRows: string[][] = [['Campaign','Campaign state','Campaign type','Month','Conversion action','Conversions']];
    for (const r of conv) {
      convRows.push([
        r.campaign.name, STATE[r.campaign.status] ?? r.campaign.status, TYPE[r.campaign.advertisingChannelType] ?? r.campaign.advertisingChannelType,
        monthLabel(r.segments.month), r.segments.conversionActionName, Number(r.metrics?.conversions ?? 0).toFixed(2),
      ]);
    }

    const stamp = `${FROM}-to-${TO}`;
    const p1 = join(OUT_DIR, `${slug}-Campaign-Performance-by-Month-${stamp}.csv`);
    const p2 = join(OUT_DIR, `${slug}-Conversion-Actions-by-Month-${stamp}.csv`);
    writeFileSync(p1, csv(perfRows));
    writeFileSync(p2, csv(convRows));
    const spend = perf.reduce((s, r) => s + Number(r.metrics?.costMicros ?? 0) / 1e6, 0);
    console.log(`${name} (${id}): ${perfRows.length - 1} perf rows, ${convRows.length - 1} conv rows, £${spend.toFixed(2)} total → ${p1}`);
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
