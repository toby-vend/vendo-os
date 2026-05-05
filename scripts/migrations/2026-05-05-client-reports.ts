/**
 * Create client_reports + client_report_screenshots tables.
 *
 * Stores monthly client performance reports authored manually today (screenshots
 * + narrative + AI-generated insights). Designed so a future API ingestion service
 * can write screenshot/metric rows with source='api' against the same schema —
 * no UI rewrite needed when platform integrations land.
 *
 * Safe to re-run.
 *
 * Usage: npx tsx scripts/migrations/2026-05-05-client-reports.ts
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
  `CREATE TABLE IF NOT EXISTS client_reports (
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
    UNIQUE(client_id, period_start, period_end)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_client_reports_client
     ON client_reports(client_id, period_start DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_client_reports_status
     ON client_reports(status, period_start DESC)`,

  `CREATE TABLE IF NOT EXISTS client_report_screenshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL REFERENCES client_reports(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    caption TEXT NOT NULL DEFAULT '',
    blob_url TEXT NOT NULL,
    blob_pathname TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'manual',
    width INTEGER,
    height INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE INDEX IF NOT EXISTS idx_report_screenshots_report
     ON client_report_screenshots(report_id, position)`,
];

const target = process.env.TURSO_DATABASE_URL ? 'Turso' : 'local SQLite';
console.log(`Running client-reports migration against ${target}...`);

try {
  for (const sql of statements) {
    await client.execute(sql);
  }
  console.log('✓ client_reports + client_report_screenshots created.');
} catch (err: any) {
  console.error('✗ Migration error:', err.message);
  process.exit(1);
}

console.log('Done.');
