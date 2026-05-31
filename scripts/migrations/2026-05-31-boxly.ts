/**
 * Create boxly_events + boxly_leads tables.
 *
 * Boxly (boxly.ai, formerly EnquiryBox) has no public API and no native
 * outbound webhook. The only reliable export route is Zapier's "New Lead"
 * trigger → "Webhooks by Zapier" POST to /api/boxly/webhook. This migration
 * provisions the archive (boxly_events, raw payloads for replay/debug) and the
 * normalised lead store (boxly_leads, what the reporting hub reads).
 *
 * See plans/2026-05-31-boxly-integration.md for the full design.
 *
 * Safe to re-run.
 *
 * Usage: npx tsx scripts/migrations/2026-05-31-boxly.ts
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
  // Raw archive — every POST lands here verbatim before normalisation, so a
  // parser bug never loses a lead. Replayable from `payload`.
  `CREATE TABLE IF NOT EXISTS boxly_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT UNIQUE,
    client_id INTEGER,
    box TEXT,
    stage TEXT,
    payload TEXT NOT NULL,
    headers TEXT NOT NULL,
    received_at TEXT NOT NULL,
    processing_status TEXT NOT NULL DEFAULT 'received',
    processing_error TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_boxly_events_received
     ON boxly_events(received_at)`,
  `CREATE INDEX IF NOT EXISTS idx_boxly_events_client
     ON boxly_events(client_id, received_at)`,

  // Normalised leads — what the reporting hub reads. dedup_key is UNIQUE so
  // Zapier retries (and the optional booked-stage Zap re-sending the same lead)
  // collapse to one row.
  `CREATE TABLE IF NOT EXISTS boxly_leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL REFERENCES clients(id),
    dedup_key TEXT NOT NULL,
    boxly_lead_id TEXT,
    contact_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    message TEXT,
    entry_point_url TEXT,
    channel TEXT,
    source_label TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    gclid TEXT,
    fbclid TEXT,
    box TEXT,
    stage TEXT,
    booked_at TEXT,
    created_at TEXT NOT NULL,
    received_at TEXT NOT NULL,
    UNIQUE(client_id, dedup_key)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_boxly_leads_client
     ON boxly_leads(client_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_boxly_leads_channel
     ON boxly_leads(client_id, channel, created_at)`,
];

const target = process.env.TURSO_DATABASE_URL ? 'Turso' : 'local SQLite';
console.log(`Running boxly migration against ${target}...`);

try {
  for (const sql of statements) {
    await client.execute(sql);
  }
  console.log('✓ boxly_events + boxly_leads created.');
} catch (err: any) {
  console.error('✗ Migration error:', err.message);
  process.exit(1);
}

console.log('Done.');
