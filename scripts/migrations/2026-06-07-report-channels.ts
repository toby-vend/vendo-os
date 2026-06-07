/**
 * Add per-channel client reports.
 *
 * Adds `channel` ('google_ads' | 'meta' | 'seo') to client_reports and changes
 * the uniqueness from (client_id, period_start, period_end) to
 * (client_id, period_start, period_end, channel) so a client can have a
 * separate, channel-pure report per channel each month.
 *
 * SQLite can't drop a table-level UNIQUE in place, so this rebuilds the table
 * (preserving ids, columns and data). Existing rows are backfilled to
 * channel='google_ads' (current reports are Google Ads-led). Idempotent: if
 * `channel` already exists it exits cleanly.
 *
 * Usage: npx tsx scripts/migrations/2026-06-07-report-channels.ts
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

// Exact current column list (live schema, in order). The new table mirrors it
// and appends `channel`.
const COLUMNS = [
  'id', 'client_id', 'period_label', 'period_start', 'period_end', 'status',
  'worked_on_md', 'focus_next_md', 'exec_summary_md', 'wins_md', 'risks_md',
  'recommendations_md', 'ai_generated_at', 'created_by', 'created_at', 'updated_at',
  'contact_name', 'performance_summary_md', 'contact_email', 'gads_summary_json',
  'narrative_draft_md', 'submitted_for_review_at', 'submitted_for_review_by',
  'approved_at', 'approved_by', 'first_client_view_at', 'first_client_view_by',
];

const NEW_TABLE = `CREATE TABLE client_reports_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  period_label TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  worked_on_md TEXT NOT NULL DEFAULT '',
  focus_next_md TEXT NOT NULL DEFAULT '',
  exec_summary_md TEXT NOT NULL DEFAULT '',
  wins_md TEXT NOT NULL DEFAULT '',
  risks_md TEXT NOT NULL DEFAULT '',
  recommendations_md TEXT NOT NULL DEFAULT '',
  ai_generated_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  contact_name TEXT NOT NULL DEFAULT '',
  performance_summary_md TEXT NOT NULL DEFAULT '',
  contact_email TEXT,
  gads_summary_json TEXT,
  narrative_draft_md TEXT,
  submitted_for_review_at TEXT,
  submitted_for_review_by TEXT,
  approved_at TEXT,
  approved_by TEXT,
  first_client_view_at TEXT,
  first_client_view_by TEXT,
  channel TEXT NOT NULL DEFAULT 'google_ads',
  UNIQUE(client_id, period_start, period_end, channel)
)`;

// New-schema table body (sans the CREATE prefix) so we can stamp it with
// either the temp name or the final name.
const TABLE_BODY = NEW_TABLE.replace('CREATE TABLE client_reports_new ', '');

async function main() {
  console.log(`Running report-channels migration against ${target}...`);

  const info = await client.execute('PRAGMA table_info(client_reports)');
  const hasChannel = info.rows.some(r => r.name === 'channel');
  if (hasChannel) {
    console.log('✓ `channel` column already present — nothing to do.');
    process.exit(0);
  }

  const before = await client.execute('SELECT COUNT(*) AS n FROM client_reports');
  const beforeCount = Number(before.rows[0].n);
  console.log(`Existing rows: ${beforeCount}`);

  const oldCols = COLUMNS.join(', ');
  const allCols = `${oldCols}, channel`;

  // FK off for the rebuild (children: screenshots, deliveries, data_cache).
  // We avoid ALTER TABLE ... RENAME: on Turso/libsql renaming a table that
  // other tables FK-reference fails ("already another table with this name")
  // and PRAGMA legacy_alter_table is blocked. Instead we copy to a temp table,
  // drop + recreate the real table under its own name (so child FK references
  // resolve to it), copy back, and drop the temp.
  await client.execute('PRAGMA foreign_keys=OFF');
  try {
    await client.execute(`CREATE TABLE client_reports_new ${TABLE_BODY}`);
    await client.execute(
      `INSERT INTO client_reports_new (${oldCols}) SELECT ${oldCols} FROM client_reports`,
    );
    const copied = Number((await client.execute('SELECT COUNT(*) AS n FROM client_reports_new')).rows[0].n);
    if (copied !== beforeCount) {
      throw new Error(`Row count mismatch (old ${beforeCount} vs temp ${copied}) — aborting before drop`);
    }

    await client.execute('DROP TABLE client_reports');
    await client.execute(`CREATE TABLE client_reports ${TABLE_BODY}`);
    await client.execute(
      `INSERT INTO client_reports (${allCols}) SELECT ${allCols} FROM client_reports_new`,
    );
    const restored = Number((await client.execute('SELECT COUNT(*) AS n FROM client_reports')).rows[0].n);
    if (restored !== beforeCount) {
      throw new Error(`Row count mismatch after restore (${restored} vs ${beforeCount})`);
    }
    await client.execute('DROP TABLE client_reports_new');

    await client.execute(`CREATE INDEX IF NOT EXISTS idx_client_reports_client ON client_reports(client_id, period_start DESC)`);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_client_reports_status ON client_reports(status, period_start DESC)`);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_client_reports_channel ON client_reports(client_id, channel, period_start DESC)`);
  } finally {
    await client.execute('PRAGMA foreign_keys=ON');
  }

  const after = await client.execute('SELECT COUNT(*) AS n FROM client_reports');
  console.log(`✓ Rebuilt with channel column. Rows: ${after.rows[0].n} (existing rows backfilled channel='google_ads').`);
  console.log('Done.');
  process.exit(0);
}

main().catch(err => {
  console.error('✗ Migration error:', err.message);
  process.exit(1);
});
