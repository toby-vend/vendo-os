/**
 * Create client_notes table — free-text "tribal knowledge" per client.
 *
 * Used by the Client Knowledge briefing (web/lib/client-knowledge/) to capture
 * gotchas, preferences, history and todos that aren't derivable from Asana /
 * Fathom / etc. Notes feed the same agent tool as auto-derived data.
 *
 * Safe to re-run.
 *
 * Usage: npx tsx scripts/migrations/2026-05-12-client-notes.ts
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
  `CREATE TABLE IF NOT EXISTS client_notes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id       INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    author_user_id  TEXT    NOT NULL REFERENCES users(id),
    body            TEXT    NOT NULL,
    category        TEXT    NOT NULL DEFAULT 'context'
                      CHECK (category IN ('context','gotcha','preference','history','todo')),
    source          TEXT,
    archived_at     TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_client_notes_client ON client_notes(client_id, archived_at)`,
  `CREATE INDEX IF NOT EXISTS idx_client_notes_category ON client_notes(client_id, category)`,
];

(async () => {
  for (const sql of statements) {
    try {
      await client.execute(sql);
      console.log('  ok:', sql.split('\n')[0].trim().slice(0, 80));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/already exists/i.test(msg)) {
        console.log('  skip (already exists):', sql.split('\n')[0].trim().slice(0, 80));
      } else {
        console.error('  FAIL:', msg);
        process.exit(1);
      }
    }
  }
  console.log('\nclient_notes table ready.');
  process.exit(0);
})();
