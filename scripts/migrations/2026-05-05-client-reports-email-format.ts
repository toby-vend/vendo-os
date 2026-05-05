/**
 * Add contact_name + performance_summary_md columns to client_reports.
 *
 * - contact_name: person being addressed in the greeting (e.g. "Adam")
 * - performance_summary_md: AI-extracted metric breakdown from the screenshots
 *   (overall + per-campaign), formatted as markdown bullets
 *
 * Safe to re-run.
 *
 * Usage: npx tsx scripts/migrations/2026-05-05-client-reports-email-format.ts
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

async function addColumnIfMissing(table: string, column: string, definition: string): Promise<void> {
  const cols = await client.execute(`PRAGMA table_info(${table})`);
  const exists = cols.rows.some(r => r.name === column);
  if (exists) {
    console.log(`  ${table}.${column} already exists — skipping`);
    return;
  }
  await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  console.log(`  ✓ added ${table}.${column}`);
}

const target = process.env.TURSO_DATABASE_URL ? 'Turso' : 'local SQLite';
console.log(`Running client-reports email-format migration against ${target}...`);

try {
  await addColumnIfMissing('client_reports', 'contact_name', "TEXT NOT NULL DEFAULT ''");
  await addColumnIfMissing('client_reports', 'performance_summary_md', "TEXT NOT NULL DEFAULT ''");
  console.log('Done.');
} catch (err: any) {
  console.error('✗ Migration error:', err.message);
  process.exit(1);
}
