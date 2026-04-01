import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';
import { MetaClient, type MetaInsightRow } from '../utils/meta-client.js';

const BACKFILL = process.argv.includes('--backfill');
const ACCOUNTS_ONLY = process.argv.includes('--accounts-only');

// Default: last 7 days. Backfill: last 90 days.
const DEFAULT_DAYS = 7;
const BACKFILL_DAYS = 90;

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

async function syncMetaAds() {
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!accessToken) {
    logError('META', 'META_ACCESS_TOKEN not set in .env.local');
    process.exit(1);
  }

  await initSchema();
  const db = await getDb();
  const client = new MetaClient(accessToken);

  try {
    // 1. Fetch and store all accessible ad accounts
    log('META', 'Fetching ad accounts...');
    const accounts = await client.listAdAccounts();
    const activeAccounts = accounts.filter(a => a.account_status === 1);

    const now = new Date().toISOString();
    const upsertAccount = db.prepare(
      `INSERT INTO meta_ad_accounts (id, account_id, name, account_status, currency, timezone_name, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, account_status=excluded.account_status, currency=excluded.currency, timezone_name=excluded.timezone_name, synced_at=excluded.synced_at`
    );

    for (const acct of accounts) {
      upsertAccount.run([acct.id, acct.account_id, acct.name, acct.account_status, acct.currency, acct.timezone_name, now]);
    }
    upsertAccount.free();
    saveDb();

    log('META', `Found ${accounts.length} ad accounts (${activeAccounts.length} active)`);
    for (const acct of activeAccounts) {
      log('META', `  ${acct.id} — ${acct.name} (${acct.currency})`);
    }

    if (ACCOUNTS_ONLY) {
      log('META', 'Accounts-only mode — skipping insights');
      closeDb();
      return;
    }

    // 2. Fetch insights for each active account
    const days = BACKFILL ? BACKFILL_DAYS : DEFAULT_DAYS;
    const dateFrom = dateStr(days);
    const dateTo = dateStr(0);
    const levels: Array<'campaign' | 'adset' | 'ad'> = ['campaign', 'adset', 'ad'];

    log('META', `Fetching insights from ${dateFrom} to ${dateTo} (${days} days)`);

    let totalRows = 0;

    for (const acct of activeAccounts) {
      for (const level of levels) {
        try {
          log('META', `  ${acct.name} — ${level} level [rate: ${client.rateLimitUsage}]`);
          const rows = await client.getInsights({
            accountId: acct.id,
            level,
            dateFrom,
            dateTo,
          });

          if (rows.length === 0) {
            log('META', `    No ${level} data`);
            continue;
          }

          upsertInsights(db, rows, level);
          totalRows += rows.length;
          log('META', `    ${rows.length} rows`);
          saveDb();

        } catch (err) {
          logError('META', `Failed to fetch ${level} insights for ${acct.name}`, err);
        }
      }
    }

    log('META', `Sync complete: ${totalRows} insight rows across ${activeAccounts.length} accounts`);

  } catch (err) {
    logError('META', 'Sync failed', err);
    process.exit(1);
  } finally {
    closeDb();
  }
}

function upsertInsights(db: any, rows: MetaInsightRow[], level: string) {
  const stmt = db.prepare(
    `INSERT INTO meta_insights (date, account_id, account_name, level, campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name, impressions, clicks, spend, cpc, cpm, ctr, reach, frequency, conversions, conversion_values, actions, cost_per_action, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(date, account_id, level, campaign_id, adset_id, ad_id) DO UPDATE SET
       account_name=excluded.account_name, campaign_name=excluded.campaign_name, adset_name=excluded.adset_name, ad_name=excluded.ad_name,
       impressions=excluded.impressions, clicks=excluded.clicks, spend=excluded.spend,
       cpc=excluded.cpc, cpm=excluded.cpm, ctr=excluded.ctr, reach=excluded.reach, frequency=excluded.frequency,
       conversions=excluded.conversions, conversion_values=excluded.conversion_values,
       actions=excluded.actions, cost_per_action=excluded.cost_per_action, synced_at=excluded.synced_at`
  );

  const now = new Date().toISOString();

  for (const row of rows) {
    stmt.run([
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
    ]);
  }

  stmt.free();
}

syncMetaAds();
