/**
 * Per-user report-channel access.
 *
 * Admins see all report channels (Google Ads / Meta / SEO). Non-admin staff
 * see only the channel(s) they work in. This table stores each non-admin's
 * allowed channels. A user with NO rows is treated as "all channels" (no
 * restriction) so nobody is locked out until an admin assigns channels.
 *
 * Plain CREATE TABLE — safe + idempotent.
 *
 * Usage: npx tsx scripts/migrations/2026-06-07-user-report-channels.ts
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
  console.log(`Running user-report-channels migration against ${target}...`);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS user_report_channels (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      report_channel TEXT NOT NULL,
      PRIMARY KEY (user_id, report_channel)
    )
  `);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_user_report_channels_user ON user_report_channels(user_id)`);
  console.log('✓ user_report_channels ready.');
  console.log('Done.');
  process.exit(0);
}

main().catch(err => {
  console.error('✗ Migration error:', err.message);
  process.exit(1);
});
