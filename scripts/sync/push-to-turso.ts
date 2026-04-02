/**
 * Push local SQLite data to Turso remote database.
 *
 * Usage:
 *   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... npx tsx scripts/sync/push-to-turso.ts
 *
 * This reads the local data/vendo.db and inserts all data into the remote Turso database.
 * It creates tables if they don't exist and upserts all rows.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@libsql/client';
import initSqlJs from 'sql.js';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, '../../data/vendo.db');

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error('Error: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local');
  process.exit(1);
}

if (!existsSync(DB_PATH)) {
  console.error(`Error: Local database not found at ${DB_PATH}`);
  process.exit(1);
}

const remote = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

async function main() {
  console.log('Loading local database...');
  const SQL = await initSqlJs();
  const buffer = readFileSync(DB_PATH);
  const local = new SQL.Database(buffer);

  // Get all table schemas from local DB
  const tables = local.exec("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'meetings_fts%'");
  if (!tables.length) { console.error('No tables found'); process.exit(1); }

  // Create tables on remote
  console.log('Creating tables on Turso...');
  for (const row of tables[0].values) {
    const [name, sql] = row as [string, string];
    console.log(`  Creating ${name}...`);
    await remote.execute(sql.replace('CREATE TABLE', 'CREATE TABLE IF NOT EXISTS'));
  }

  // Run schema migrations for existing tables
  const migrations = [
    'ALTER TABLE clients ADD COLUMN xero_contact_id TEXT',
    'ALTER TABLE clients ADD COLUMN email TEXT',
    "ALTER TABLE clients ADD COLUMN source TEXT DEFAULT 'xero'",
    'ALTER TABLE clients ADD COLUMN total_invoiced REAL DEFAULT 0',
    'ALTER TABLE clients ADD COLUMN outstanding REAL DEFAULT 0',
    'ALTER TABLE clients ADD COLUMN first_invoice_date TEXT',
    'ALTER TABLE clients ADD COLUMN last_invoice_date TEXT',
    // Meetings waterfall matcher columns
    'ALTER TABLE meetings ADD COLUMN match_method TEXT',
    'ALTER TABLE meetings ADD COLUMN match_confidence TEXT',
    'ALTER TABLE meetings ADD COLUMN calendar_invitees TEXT',
    'ALTER TABLE meetings ADD COLUMN invitee_domains_type TEXT',
    'ALTER TABLE meetings ADD COLUMN needs_review INTEGER DEFAULT 0',
    // GHL lead scoring columns
    'ALTER TABLE ghl_opportunities ADD COLUMN lead_score INTEGER',
    'ALTER TABLE ghl_opportunities ADD COLUMN score_breakdown TEXT',
    'ALTER TABLE ghl_opportunities ADD COLUMN scored_at TEXT',
    // Brand hub title column
    "ALTER TABLE brand_hub ADD COLUMN title TEXT NOT NULL DEFAULT ''",
    // Drive watch user_id column
    'ALTER TABLE drive_watch_channels ADD COLUMN user_id TEXT',
    // Client hub display name
    'ALTER TABLE clients ADD COLUMN display_name TEXT',
  ];
  for (const sql of migrations) {
    try { await remote.execute(sql); } catch { /* column already exists */ }
  }

  // Create indexes
  const indexes = local.exec("SELECT sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL");
  if (indexes.length) {
    for (const row of indexes[0].values) {
      const sql = (row[0] as string)
        .replace('CREATE UNIQUE INDEX', 'CREATE UNIQUE INDEX IF NOT EXISTS')
        .replace('CREATE INDEX', 'CREATE INDEX IF NOT EXISTS');
      try { await remote.execute(sql); } catch { /* index may already exist */ }
    }
  }

  // Push data table by table
  const tableNames = tables[0].values.map(r => r[0] as string);

  for (const tableName of tableNames) {
    console.log(`\nPushing ${tableName}...`);

    const countResult = local.exec(`SELECT COUNT(*) FROM ${tableName}`);
    const totalRows = countResult[0].values[0][0] as number;
    console.log(`  ${totalRows} rows to push`);

    if (totalRows === 0) continue;

    // Get column names
    const colInfo = local.exec(`PRAGMA table_info(${tableName})`);
    const columns = colInfo[0].values.map(r => r[1] as string);

    // Read all data in batches
    const BATCH_SIZE = 100;
    let offset = 0;

    while (offset < totalRows) {
      const batch = local.exec(`SELECT * FROM ${tableName} LIMIT ${BATCH_SIZE} OFFSET ${offset}`);
      if (!batch.length || !batch[0].values.length) break;

      const placeholders = columns.map(() => '?').join(', ');
      const insertSql = `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;

      // Execute batch
      const statements = batch[0].values.map(row => ({
        sql: insertSql,
        args: row.map(v => v === null ? null : v) as any[],
      }));

      await remote.batch(statements);
      offset += batch[0].values.length;
      process.stdout.write(`  ${Math.min(offset, totalRows)}/${totalRows}\r`);
    }

    console.log(`  ${tableName}: done`);
  }

  // Recreate FTS table
  console.log('\nCreating FTS index on Turso...');
  await remote.execute("CREATE VIRTUAL TABLE IF NOT EXISTS meetings_fts USING fts4(title, summary, transcript, content='meetings')");
  await remote.execute("INSERT INTO meetings_fts(meetings_fts) VALUES ('rebuild')");
  console.log('  FTS index rebuilt');

  local.close();
  console.log('\nDone! All data pushed to Turso.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
