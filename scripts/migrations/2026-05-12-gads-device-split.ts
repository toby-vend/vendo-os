/**
 * Google Ads — device split backing table.
 *
 * Adds `gads_device_split` to store daily per-campaign spend & metrics
 * segmented by `segments.device` (Mobile / Desktop / Tablet / Other).
 *
 * We use a NEW table rather than altering `gads_campaign_spend` because
 * the existing table's `UNIQUE(date, account_id, campaign_id)` constraint
 * collapses to one row per campaign per day. Adding a `device` column
 * with the same constraint would either:
 *   a) silently drop all but one device row per campaign-day, or
 *   b) double-count totals if we relaxed the constraint
 *
 * A dedicated split table keeps existing aggregations (gads-summary,
 * getGadsCampaignsForClient) untouched and lets the new dashboard
 * aggregator opt into the device dimension when it needs it.
 *
 * Device values are normalised to 'Mobile' / 'Desktop' / 'Tablet' / 'Other'
 * (capitalised English) at write time in scripts/sync/sync-google-ads.ts.
 *
 * Safe to re-run.
 *
 * Usage: npx tsx scripts/migrations/2026-05-12-gads-device-split.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@libsql/client';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || `file:${resolve(__dirname, '../../data/vendo.db')}`,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const statements: string[] = [
  // Per-day, per-campaign, per-device spend & metrics. One row per
  // (date, account, campaign, device). Mirrors the columns we need from
  // gads_campaign_spend, plus the device dimension.
  `CREATE TABLE IF NOT EXISTS gads_device_split (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    account_id TEXT NOT NULL,
    account_name TEXT,
    campaign_id TEXT NOT NULL,
    campaign_name TEXT,
    device TEXT NOT NULL,                -- 'Mobile' | 'Desktop' | 'Tablet' | 'Other'
    spend_micros INTEGER DEFAULT 0,
    spend REAL DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    conversions REAL DEFAULT 0,
    conversion_value REAL DEFAULT 0,
    synced_at TEXT NOT NULL,
    UNIQUE(date, account_id, campaign_id, device)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_gads_device_split_date
     ON gads_device_split(date)`,
  `CREATE INDEX IF NOT EXISTS idx_gads_device_split_account
     ON gads_device_split(account_id)`,
  `CREATE INDEX IF NOT EXISTS idx_gads_device_split_campaign
     ON gads_device_split(campaign_id)`,
];

const target = process.env.TURSO_DATABASE_URL ? 'Turso' : 'local SQLite';
console.log(`Running gads-device-split migration against ${target}...`);

try {
  for (const sql of statements) {
    await client.execute(sql);
  }
  console.log('✓ gads_device_split table + indexes created.');
} catch (err: any) {
  console.error('✗ Migration error:', err.message);
  process.exit(1);
}

console.log('Done.');
