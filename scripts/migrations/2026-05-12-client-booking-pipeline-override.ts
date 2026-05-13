/**
 * Add per-client booking pipeline override.
 *
 * The default booking-rule regex (`/booked appointment/i`) matches no
 * real client today — actual GHL pipelines are per-treatment ("General
 * Dentistry Appointments", "Dental Implant Appointments", etc).
 *
 * Resolution (plan §4.4 amendment after Phase 1/A3 finding):
 *   - Default stays `/booked appointment/i`
 *   - Per-client override stored on clients.booking_pipeline_pattern
 *   - When NULL, helper falls back to the default
 *
 * Safe to re-run (try/catch around ALTER for SQLite-style idempotency).
 *
 * Usage: npx tsx scripts/migrations/2026-05-12-client-booking-pipeline-override.ts
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
console.log(`Adding booking_pipeline_pattern column to clients (${target})...`);

try {
  await client.execute(`ALTER TABLE clients ADD COLUMN booking_pipeline_pattern TEXT`);
  console.log('✓ clients.booking_pipeline_pattern added.');
} catch (err: any) {
  if (/duplicate column|already exists/i.test(err.message ?? '')) {
    console.log('✓ clients.booking_pipeline_pattern already present — skipping.');
  } else {
    console.error('✗ Migration error:', err.message);
    process.exit(1);
  }
}

console.log('Done.');
