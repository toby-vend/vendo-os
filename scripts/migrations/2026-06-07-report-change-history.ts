/**
 * Add a free-text "change history" field to client reports.
 *
 * For Google Ads reports the team can paste the account Change History
 * (budget/bid/status/keyword changes etc.) so the AI has concrete detail on
 * what was actually changed in the account that period — feeding the
 * "What we did this month" section and performance explanations.
 *
 * Plain ADD COLUMN — safe + idempotent on Turso.
 *
 * Usage: npx tsx scripts/migrations/2026-06-07-report-change-history.ts
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

async function main() {
  console.log(`Running report-change-history migration against ${target}...`);
  const info = await client.execute('PRAGMA table_info(client_reports)');
  if (info.rows.some(r => r.name === 'change_history')) {
    console.log('✓ change_history already present — nothing to do.');
    process.exit(0);
  }
  await client.execute("ALTER TABLE client_reports ADD COLUMN change_history TEXT NOT NULL DEFAULT ''");
  console.log('✓ added column change_history');
  console.log('Done.');
  process.exit(0);
}

main().catch(err => {
  console.error('✗ Migration error:', err.message);
  process.exit(1);
});
