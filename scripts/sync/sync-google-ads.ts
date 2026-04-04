/**
 * Google Ads sync — pulls campaign spend data for all MCC client accounts.
 *
 * Run: npm run sync:gads             (last 7 days)
 *      npm run sync:gads:backfill    (last 90 days)
 *      npm run sync:gads:accounts    (list accounts only)
 */
import { config } from 'dotenv';
config({ path: '.env.local', override: true });

import { readFileSync } from 'fs';
import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';
import { resolveClientBatch } from '../utils/resolve-client.js';

const BACKFILL = process.argv.includes('--backfill');
const ACCOUNTS_ONLY = process.argv.includes('--accounts-only');
const DEFAULT_DAYS = 7;
const BACKFILL_DAYS = 90;

const API_VERSION = 'v23';
const BASE_URL = `https://googleads.googleapis.com/${API_VERSION}`;

// --- Config ---

const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
const LOGIN_CUSTOMER_ID = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/-/g, '');
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

let tokens: { access_token: string; refresh_token: string };
try {
  tokens = JSON.parse(readFileSync('.secrets/google-ads-tokens.json', 'utf-8'));
} catch {
  logError('GADS', 'No tokens found — run: npm run google-ads:auth');
  process.exit(1);
}

if (!DEVELOPER_TOKEN || !LOGIN_CUSTOMER_ID) {
  logError('GADS', 'GOOGLE_ADS_DEVELOPER_TOKEN and GOOGLE_ADS_LOGIN_CUSTOMER_ID must be set in .env.local');
  process.exit(1);
}

// --- Token refresh ---

async function refreshAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  tokens.access_token = data.access_token;
  return data.access_token;
}

// --- Google Ads API helpers ---

async function gadsQuery(customerId: string, query: string): Promise<any[]> {
  const accessToken = await refreshAccessToken();
  const url = `${BASE_URL}/customers/${customerId}/googleAds:searchStream`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': DEVELOPER_TOKEN!,
      'login-customer-id': LOGIN_CUSTOMER_ID!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Ads API error (${res.status}): ${body}`);
  }

  const data = await res.json();
  // searchStream returns an array of result batches
  const rows: any[] = [];
  for (const batch of data) {
    if (batch.results) {
      rows.push(...batch.results);
    }
  }
  return rows;
}

// --- Discover client accounts under MCC ---

interface ClientAccount {
  id: string;
  descriptiveName: string;
  currencyCode: string;
  timeZone: string;
  status: string;
}

async function listClientAccounts(): Promise<ClientAccount[]> {
  const query = `
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
  `;

  const rows = await gadsQuery(LOGIN_CUSTOMER_ID!, query);
  return rows.map(r => ({
    id: String(r.customerClient.id),
    descriptiveName: r.customerClient.descriptiveName || 'Unnamed',
    currencyCode: r.customerClient.currencyCode || 'GBP',
    timeZone: r.customerClient.timeZone || 'Europe/London',
    status: r.customerClient.status || 'ENABLED',
  }));
}

// --- Fetch campaign spend ---

function dateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

async function fetchCampaignSpend(customerId: string, dateFrom: string, dateTo: string) {
  const query = `
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
  `;

  return gadsQuery(customerId, query);
}

// --- Main ---

async function syncGoogleAds() {
  await initSchema();
  const db = await getDb();

  try {
    // 1. Discover all client accounts
    log('GADS', 'Fetching client accounts from MCC...');
    const accounts = await listClientAccounts();
    log('GADS', `Found ${accounts.length} client accounts`);

    const now = new Date().toISOString();
    const upsertAccount = db.prepare(
      `INSERT INTO gads_accounts (id, descriptive_name, currency_code, time_zone, manager_id, status, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET descriptive_name=excluded.descriptive_name, currency_code=excluded.currency_code, time_zone=excluded.time_zone, status=excluded.status, synced_at=excluded.synced_at`
    );

    for (const acct of accounts) {
      upsertAccount.run([acct.id, acct.descriptiveName, acct.currencyCode, acct.timeZone, LOGIN_CUSTOMER_ID, acct.status, now]);
      log('GADS', `  ${acct.id} — ${acct.descriptiveName} (${acct.currencyCode})`);
    }
    upsertAccount.free();
    saveDb();

    if (ACCOUNTS_ONLY) {
      log('GADS', 'Accounts-only mode — skipping spend data');
      closeDb();
      return;
    }

    // 2. Fetch campaign spend for each account
    const days = BACKFILL ? BACKFILL_DAYS : DEFAULT_DAYS;
    const dateFrom = dateStr(days);
    const dateTo = dateStr(0);
    log('GADS', `Fetching campaign spend from ${dateFrom} to ${dateTo} (${days} days)`);

    const upsertSpend = db.prepare(
      `INSERT INTO gads_campaign_spend (date, account_id, account_name, campaign_id, campaign_name, campaign_status, spend_micros, spend, impressions, clicks, conversions, conversion_value, cost_per_conversion, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(date, account_id, campaign_id) DO UPDATE SET
         account_name=excluded.account_name, campaign_name=excluded.campaign_name, campaign_status=excluded.campaign_status,
         spend_micros=excluded.spend_micros, spend=excluded.spend, impressions=excluded.impressions, clicks=excluded.clicks,
         conversions=excluded.conversions, conversion_value=excluded.conversion_value, cost_per_conversion=excluded.cost_per_conversion, synced_at=excluded.synced_at`
    );

    let totalRows = 0;

    for (const acct of accounts) {
      try {
        log('GADS', `  ${acct.descriptiveName}...`);
        const rows = await fetchCampaignSpend(acct.id, dateFrom, dateTo);

        if (rows.length === 0) {
          log('GADS', `    No campaign data`);
          continue;
        }

        for (const row of rows) {
          const costMicros = Number(row.metrics?.costMicros || 0);
          const spend = costMicros / 1_000_000;
          const conversions = Number(row.metrics?.conversions || 0);
          const conversionValue = Number(row.metrics?.conversionsValue || 0);
          const costPerConversion = conversions > 0 ? spend / conversions : 0;

          upsertSpend.run([
            row.segments.date,
            String(row.customer.id),
            row.customer.descriptiveName || acct.descriptiveName,
            String(row.campaign.id),
            row.campaign.name || null,
            row.campaign.status || null,
            costMicros,
            spend,
            Number(row.metrics?.impressions || 0),
            Number(row.metrics?.clicks || 0),
            conversions,
            conversionValue,
            costPerConversion,
            now,
          ]);
        }

        totalRows += rows.length;
        log('GADS', `    ${rows.length} rows`);

      } catch (err) {
        logError('GADS', `Failed to fetch spend for ${acct.descriptiveName}`, err);
      }
    }

    upsertSpend.free();
    saveDb();
    log('GADS', `Sync complete: ${totalRows} rows across ${accounts.length} accounts`);

    // Auto-resolve Google Ads accounts to canonical clients
    const gadsAccounts = db.exec('SELECT DISTINCT account_id, account_name FROM gads_campaign_spend WHERE account_name IS NOT NULL');
    if (gadsAccounts.length && gadsAccounts[0].values.length) {
      await resolveClientBatch('gads', gadsAccounts[0].values.map((r: unknown[]) => ({ id: r[0] as string, name: r[1] as string })));
    }

  } catch (err) {
    logError('GADS', 'Sync failed', err);
    process.exit(1);
  } finally {
    closeDb();
  }
}

syncGoogleAds();
