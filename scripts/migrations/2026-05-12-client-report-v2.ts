/**
 * Client Report v2 — dashboard backing tables.
 *
 * Adds three tables for the tab-based dashboard build (see
 * plans/2026-05-12-client-report-v2-tab-dashboard.md):
 *
 *   - client_report_data_cache       cached structured payload per report
 *   - client_treatment_mappings      per-client campaign → treatment regex map
 *   - treatment_value_defaults       vertical-wide average case values
 *
 * Seeds the defaults table with sensible UK numbers for the dental vertical;
 * other verticals are stubbed with a generic fallback row each.
 *
 * Safe to re-run.
 *
 * Usage: npx tsx scripts/migrations/2026-05-12-client-report-v2.ts
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
  // Cached payload — recomputed on demand. One row per report.
  `CREATE TABLE IF NOT EXISTS client_report_data_cache (
    report_id INTEGER PRIMARY KEY REFERENCES client_reports(id) ON DELETE CASCADE,
    payload_json TEXT NOT NULL,
    computed_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // Per-client treatment mapping. Campaign name → treatment via regex.
  // priority lower wins when multiple rows match the same campaign.
  `CREATE TABLE IF NOT EXISTS client_treatment_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    treatment_name TEXT NOT NULL,
    campaign_pattern TEXT NOT NULL,
    applies_to TEXT NOT NULL DEFAULT 'both',
    avg_case_value_gbp REAL,
    priority INTEGER NOT NULL DEFAULT 100,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE INDEX IF NOT EXISTS idx_treatment_mappings_client
     ON client_treatment_mappings(client_id, is_active, priority)`,

  // Vertical-wide defaults. AM overrides at the client level via
  // client_treatment_mappings.avg_case_value_gbp.
  `CREATE TABLE IF NOT EXISTS treatment_value_defaults (
    vertical TEXT NOT NULL,
    treatment_name TEXT NOT NULL,
    avg_case_value_gbp REAL NOT NULL,
    source_note TEXT,
    PRIMARY KEY (vertical, treatment_name)
  )`,
];

// Seed rows. INSERT OR IGNORE keeps the migration idempotent.
const seedRows: Array<[string, string, number, string]> = [
  // vertical, treatment_name, avg_case_value_gbp, source_note
  ['dental', 'General Dentistry',  220,  'Vendo internal estimate, UK 2025'],
  ['dental', 'Emergency Dentistry', 200, 'Vendo internal estimate, UK 2025'],
  ['dental', 'Invisalign & Ortho', 3200, 'Vendo internal estimate, UK 2025'],
  ['dental', 'Smile Makeover',     4800, 'Vendo internal estimate, UK 2025'],
  ['dental', 'Dental Implants',    4200, 'Vendo internal estimate, UK 2025'],
  ['dental', 'Teeth Whitening',     300, 'Vendo internal estimate, UK 2025'],
  ['dental', 'Composite Bonding',   600, 'Vendo internal estimate, UK 2025'],
  ['dental', 'Other',               500, 'Vertical-agnostic fallback'],

  ['aesthetics', 'Botox',       250, 'Vendo internal estimate, UK 2025'],
  ['aesthetics', 'Fillers',     350, 'Vendo internal estimate, UK 2025'],
  ['aesthetics', 'Skin',        180, 'Vendo internal estimate, UK 2025'],
  ['aesthetics', 'Other',       300, 'Vertical-agnostic fallback'],

  ['medical', 'Consultation',   400, 'Vendo internal estimate, UK 2025'],
  ['medical', 'Procedure',     2500, 'Vendo internal estimate, UK 2025'],
  ['medical', 'Other',          800, 'Vertical-agnostic fallback'],

  ['home-services', 'Quote',    1500, 'Vendo internal estimate, UK 2025'],
  ['home-services', 'Other',     800, 'Vertical-agnostic fallback'],

  ['other', 'Other', 500, 'Vertical-agnostic fallback used when nothing else matches'],
];

const target = process.env.TURSO_DATABASE_URL ? 'Turso' : 'local SQLite';
console.log(`Running client-report-v2 migration against ${target}...`);

try {
  for (const sql of statements) {
    await client.execute(sql);
  }
  console.log('✓ tables created.');

  for (const [vertical, name, value, note] of seedRows) {
    await client.execute({
      sql: `INSERT OR IGNORE INTO treatment_value_defaults
              (vertical, treatment_name, avg_case_value_gbp, source_note)
            VALUES (?, ?, ?, ?)`,
      args: [vertical, name, value, note],
    });
  }
  console.log(`✓ seeded ${seedRows.length} treatment_value_defaults rows.`);
} catch (err: any) {
  console.error('✗ Migration error:', err.message);
  process.exit(1);
}

console.log('Done.');
