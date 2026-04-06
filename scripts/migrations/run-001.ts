/**
 * Run video production migration against the configured database (local or Turso).
 * Usage: npx tsx scripts/migrations/run-001.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@libsql/client';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || `file:${resolve(__dirname, '../../data/vendo.db')}`,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const sql = readFileSync(resolve(__dirname, '001-video-production.sql'), 'utf-8');

const dbTarget = process.env.TURSO_DATABASE_URL ? 'Turso' : 'local SQLite';
console.log(`Running migration against ${dbTarget}...`);

try {
  await client.executeMultiple(sql);
  console.log('✓ All statements executed successfully.');
} catch (err: any) {
  console.error('✗ Migration error:', err.message);
  process.exit(1);
}

console.log('Done.');
