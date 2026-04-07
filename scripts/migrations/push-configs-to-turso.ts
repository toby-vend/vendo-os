/**
 * Push just client_service_configs to Turso.
 * Usage: npx tsx scripts/migrations/push-configs-to-turso.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@libsql/client';
import initSqlJs from 'sql.js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const DB_PATH = resolve('data/vendo.db');

async function main() {
  const remote = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  const SQL = await initSqlJs();
  const buffer = readFileSync(DB_PATH);
  const local = new SQL.Database(buffer);

  // Ensure table exists on remote
  const schema = local.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='client_service_configs'");
  if (schema.length) {
    const createSql = (schema[0].values[0][0] as string).replace('CREATE TABLE', 'CREATE TABLE IF NOT EXISTS');
    await remote.execute(createSql);
  }

  const colInfo = local.exec('PRAGMA table_info(client_service_configs)');
  const columns = colInfo[0].values.map(r => r[1] as string);
  const data = local.exec('SELECT * FROM client_service_configs');

  if (data.length) {
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT OR REPLACE INTO client_service_configs (${columns.join(', ')}) VALUES (${placeholders})`;
    const stmts = data[0].values.map(row => ({
      sql,
      args: row.map(v => v === null ? null : v) as any[],
    }));
    await remote.batch(stmts);
    console.log(`Pushed ${stmts.length} rows to Turso client_service_configs`);
  }

  local.close();
}

main().catch(console.error);
