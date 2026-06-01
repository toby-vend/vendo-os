/**
 * Sync canonical client curation (status, display_name, aliases) from the local
 * SQLite DB to the production Turso database.
 *
 * The local DB is the source of truth for which clients are "canonical/active"
 * (set by scripts/utils/cleanup-clients.ts from data/canonical-clients.json).
 * The Vercel cron sync inserts every Xero customer as 'active', so production
 * accumulates clutter. This script mirrors the curated status to Turso WITHOUT
 * touching any other table (unlike db:push, which rewrites everything).
 *
 * Usage:
 *   npm run sync:client-status -- --dry-run
 *   npm run sync:client-status
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import initSqlJs from 'sql.js';
import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, '../../data/vendo.db');
const DRY_RUN = process.argv.includes('--dry-run');

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;
if (!TURSO_URL || !TURSO_TOKEN) {
  console.error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local');
  process.exit(1);
}

interface LocalClient { name: string; display_name: string | null; status: string; aliases: string | null; }

async function main() {
  const SQL = await initSqlJs();
  const local = new SQL.Database(readFileSync(DB_PATH));
  const res = local.exec('SELECT name, display_name, COALESCE(status, \'inactive\') as status, aliases FROM clients');
  const localClients: LocalClient[] = [];
  if (res.length) {
    for (const r of res[0].values) {
      localClients.push({ name: r[0] as string, display_name: r[1] as string | null, status: r[2] as string, aliases: r[3] as string | null });
    }
  }
  const activeNames = new Set(localClients.filter(c => c.status === 'active').map(c => c.name));
  console.log(`Local: ${localClients.length} clients, ${activeNames.size} active`);

  const remote = createClient({ url: TURSO_URL!, authToken: TURSO_TOKEN! });

  const before = await remote.execute("SELECT status, COUNT(*) n FROM clients GROUP BY status");
  console.log('Turso BEFORE:', before.rows.map(r => `${r.status}=${r.n}`).join(', '));

  // Which Turso client names exist?
  const remoteRows = await remote.execute('SELECT name FROM clients');
  const remoteNames = new Set(remoteRows.rows.map(r => r.name as string));
  const missingActive = [...activeNames].filter(n => !remoteNames.has(n));
  if (missingActive.length) {
    console.log(`\n⚠ ${missingActive.length} active clients NOT present in Turso (will be inserted):`);
    missingActive.forEach(n => console.log(`   + ${n}`));
  }

  if (DRY_RUN) {
    console.log(`\nDRY RUN — would set ${activeNames.size} active, ${remoteNames.size - [...activeNames].filter(n => remoteNames.has(n)).length} (+ any extras) inactive.`);
    return;
  }

  // 1) Reset every Turso client to inactive (baseline).
  await remote.execute("UPDATE clients SET status = 'inactive'");

  // 2) Apply local curation for active clients: status + canonical display_name + aliases.
  const stmts = localClients
    .filter(c => c.status === 'active')
    .map(c => {
      if (remoteNames.has(c.name)) {
        return {
          sql: "UPDATE clients SET status = 'active', display_name = COALESCE(?, display_name), aliases = ? WHERE name = ?",
          args: [c.display_name, c.aliases, c.name] as (string | null)[],
        };
      }
      return {
        sql: "INSERT INTO clients (name, display_name, status, source, aliases) VALUES (?, ?, 'active', 'manual', ?)",
        args: [c.name, c.display_name ?? c.name, c.aliases] as (string | null)[],
      };
    });
  await remote.batch(stmts);

  const after = await remote.execute("SELECT status, COUNT(*) n FROM clients GROUP BY status");
  console.log('Turso AFTER: ', after.rows.map(r => `${r.status}=${r.n}`).join(', '));
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
