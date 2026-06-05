/**
 * Create the access_requests table for Google-only login.
 *
 * Login is now "Sign in with Google", gated on an admin-provisioned account
 * (matched by email). A Google sign-in for an unknown email is blocked and a
 * row is recorded here so admins can provision the account. Repeat attempts
 * collapse onto one row (email is UNIQUE).
 *
 * See plans/2026-06-05-google-only-login.md for the full design.
 *
 * Safe to re-run.
 *
 * Usage: npx tsx scripts/migrations/2026-06-05-google-login.ts
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
  `CREATE TABLE IF NOT EXISTS access_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    google_sub TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 1,
    first_requested_at TEXT NOT NULL,
    last_requested_at TEXT NOT NULL,
    resolved_at TEXT,
    resolved_by TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status)`,
];

const target = process.env.TURSO_DATABASE_URL ? 'Turso' : 'local SQLite';
console.log(`Running google-login migration against ${target}...`);

try {
  for (const sql of statements) {
    await client.execute(sql);
  }
  console.log('✓ access_requests created.');
} catch (err: any) {
  console.error('✗ Migration error:', err.message);
  process.exit(1);
}

console.log('Done.');
