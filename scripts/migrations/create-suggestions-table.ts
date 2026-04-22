/**
 * Create suggestions, suggestion_drafts, suggestion_attachments, and app_settings tables.
 * Safe to re-run — uses CREATE TABLE IF NOT EXISTS and INSERT OR IGNORE for seeds.
 *
 * Usage: npx tsx scripts/migrations/create-suggestions-table.ts
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
  `CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submitted_by_user_id TEXT NOT NULL,
    submitted_by_name TEXT NOT NULL,
    title TEXT NOT NULL,
    raw_idea TEXT NOT NULL,
    chat_transcript TEXT NOT NULL,
    structured_output TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'submitted',
    priority TEXT,
    reviewed_by_user_id TEXT,
    reviewed_at TEXT,
    review_notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions(status)`,
  `CREATE INDEX IF NOT EXISTS idx_suggestions_submitter ON suggestions(submitted_by_user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_suggestions_created ON suggestions(created_at DESC)`,

  `CREATE TABLE IF NOT EXISTS suggestion_drafts (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    scope TEXT NOT NULL,
    page_url TEXT,
    page_label TEXT,
    transcript TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE INDEX IF NOT EXISTS idx_suggestion_drafts_user ON suggestion_drafts(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_suggestion_drafts_updated ON suggestion_drafts(updated_at)`,

  `CREATE TABLE IF NOT EXISTS suggestion_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    suggestion_id INTEGER,
    draft_session_id TEXT,
    blob_url TEXT NOT NULL,
    blob_pathname TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    filename TEXT,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE INDEX IF NOT EXISTS idx_suggestion_attachments_suggestion ON suggestion_attachments(suggestion_id)`,
  `CREATE INDEX IF NOT EXISTS idx_suggestion_attachments_draft ON suggestion_attachments(draft_session_id)`,

  // Seed: feature toggle ON by default
  `INSERT OR IGNORE INTO app_settings (key, value) VALUES ('suggestions_enabled', 'true')`,
];

const target = process.env.TURSO_DATABASE_URL ? 'Turso' : 'local SQLite';
console.log(`Running suggestions migration against ${target}...`);

try {
  for (const sql of statements) {
    await client.execute(sql);
  }
  console.log('✓ Tables created and seeds applied.');
} catch (err: any) {
  console.error('✗ Migration error:', err.message);
  process.exit(1);
}

console.log('Done.');
