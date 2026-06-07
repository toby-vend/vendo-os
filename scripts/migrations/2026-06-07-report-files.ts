/**
 * Allow CSV campaign-data uploads alongside screenshots on client reports.
 *
 * Extends client_report_screenshots with:
 *   - kind      'image' | 'csv'        (default 'image' for existing rows)
 *   - file_name original upload name   (nullable)
 *   - csv_text  raw CSV contents       (nullable; fed to the AI as canonical
 *               campaign data so a CSV export can stand in for / supplement a
 *               screenshot)
 *
 * Plain ADD COLUMN — safe and idempotent on Turso. Existing image rows are
 * untouched (kind defaults to 'image').
 *
 * Usage: npx tsx scripts/migrations/2026-06-07-report-files.ts
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

const COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: 'kind', ddl: "ALTER TABLE client_report_screenshots ADD COLUMN kind TEXT NOT NULL DEFAULT 'image'" },
  { name: 'file_name', ddl: 'ALTER TABLE client_report_screenshots ADD COLUMN file_name TEXT' },
  { name: 'csv_text', ddl: 'ALTER TABLE client_report_screenshots ADD COLUMN csv_text TEXT' },
];

async function main() {
  console.log(`Running report-files migration against ${target}...`);
  const info = await client.execute('PRAGMA table_info(client_report_screenshots)');
  const existing = new Set(info.rows.map(r => String(r.name)));

  for (const col of COLUMNS) {
    if (existing.has(col.name)) {
      console.log(`✓ column ${col.name} already present — skipping`);
      continue;
    }
    await client.execute(col.ddl);
    console.log(`✓ added column ${col.name}`);
  }
  console.log('Done.');
  process.exit(0);
}

main().catch(err => {
  console.error('✗ Migration error:', err.message);
  process.exit(1);
});
