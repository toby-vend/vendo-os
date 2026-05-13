/**
 * Add first-view tracking to client_reports.
 *
 * Two columns:
 *   - first_client_view_at: ISO timestamp of the first client portal view
 *   - first_client_view_by: user id of the client who first opened it
 *
 * Used by web/lib/reports/notify-first-view.ts to fire a single Slack
 * ping the first time a finalised report is opened in the client
 * portal. Subsequent opens by the same or other client users are silent.
 *
 * Safe to re-run.
 *
 * Usage: npx tsx scripts/migrations/2026-05-12-client-report-first-view.ts
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

const target = process.env.TURSO_DATABASE_URL ? 'Turso' : 'local SQLite';
console.log(`Adding first-view tracking to client_reports (${target})...`);

const columns: Array<{ name: string; sql: string }> = [
  { name: 'first_client_view_at', sql: 'ALTER TABLE client_reports ADD COLUMN first_client_view_at TEXT' },
  { name: 'first_client_view_by', sql: 'ALTER TABLE client_reports ADD COLUMN first_client_view_by TEXT' },
];

for (const { name, sql } of columns) {
  try {
    await client.execute(sql);
    console.log(`✓ ${name} added.`);
  } catch (err: any) {
    if (/duplicate column|already exists/i.test(err.message ?? '')) {
      console.log(`✓ ${name} already present — skipping.`);
    } else {
      console.error(`✗ ${name} migration error:`, err.message);
      process.exit(1);
    }
  }
}

console.log('Done.');
