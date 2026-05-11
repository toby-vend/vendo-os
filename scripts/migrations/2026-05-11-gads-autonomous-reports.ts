/**
 * Foundation schema for Google Ads autonomous monthly reporting.
 *
 * 1. Creates `gads_account_client_map` — links a Google Ads customer ID to a
 *    Vendo client. Today `gads_accounts` is synced daily but never joined to
 *    `clients.id` (the sql.js port dropped the local `resolveClientBatch()`).
 *    This map is the manual override the admin UI writes to.
 * 2. Creates `client_report_deliveries` — audit log of report pushes to the
 *    ClientDashboard portal (and any future channels).
 * 3. Extends `client_reports` with columns for the two-stage approval gate
 *    (submitted_for_review_*, approved_*), cached Google Ads structured
 *    summary (`gads_summary_json`), the auto-pulled worked-on draft
 *    (`narrative_draft_md`), and a contact email.
 *
 * Idempotent — re-runs are safe. Uses CREATE TABLE IF NOT EXISTS for new
 * tables and a PRAGMA table_info() existence check before each ALTER ADD
 * COLUMN, mirroring scripts/migrations/2026-05-05-client-reports-email-format.ts.
 *
 * Runs against Turso (production) when TURSO_DATABASE_URL is set, otherwise
 * the local file:./data/vendo.db.
 *
 * Usage:
 *   npx tsx scripts/migrations/2026-05-11-gads-autonomous-reports.ts
 *   # or (per feedback_env_file_invocation memory, for scripts importing web/lib/queries/base):
 *   node --env-file=.env.local --import tsx/esm scripts/migrations/2026-05-11-gads-autonomous-reports.ts
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

const createStatements: string[] = [
  // 1. Map Google Ads accounts to Vendo clients (foundation)
  `CREATE TABLE IF NOT EXISTS gads_account_client_map (
    gads_customer_id TEXT PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_gads_map_client
     ON gads_account_client_map(client_id)`,

  // 2. Delivery audit log
  `CREATE TABLE IF NOT EXISTS client_report_deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL REFERENCES client_reports(id) ON DELETE CASCADE,
    channel TEXT NOT NULL,
    status TEXT NOT NULL,
    payload_json TEXT,
    error_msg TEXT,
    sent_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_deliveries_report
     ON client_report_deliveries(report_id, created_at DESC)`,
];

const target = process.env.TURSO_DATABASE_URL ? 'Turso' : 'local SQLite';
console.log(`Running gads-autonomous-reports migration against ${target}...`);

try {
  // 1 + 2. Create new tables / indexes
  for (const sql of createStatements) {
    await client.execute(sql);
    console.log('  ok:', sql.replace(/\s+/g, ' ').slice(0, 80));
  }

  // 3. Extend client_reports
  console.log('\nExtending client_reports columns...');
  await addColumnIfMissing('client_reports', 'contact_email', 'TEXT');
  await addColumnIfMissing('client_reports', 'gads_summary_json', 'TEXT');
  await addColumnIfMissing('client_reports', 'narrative_draft_md', 'TEXT');
  await addColumnIfMissing('client_reports', 'submitted_for_review_at', 'TEXT');
  await addColumnIfMissing('client_reports', 'submitted_for_review_by', 'TEXT');
  await addColumnIfMissing('client_reports', 'approved_at', 'TEXT');
  await addColumnIfMissing('client_reports', 'approved_by', 'TEXT');

  console.log('\n✓ gads_account_client_map, client_report_deliveries created; client_reports extended.');
  console.log('Done.');
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('✗ Migration error:', msg);
  process.exit(1);
}
