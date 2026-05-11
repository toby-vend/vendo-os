/**
 * Agent conversations — metadata table for chat memory.
 *
 * One row per chat thread, keyed by the same id used as
 * agent_runs.conversation_id. Powers the conversation drawer:
 *
 *   - Drawer listing: agent_conversations.user_id + last_message_at DESC
 *   - Resume hydration: agent_messages JOIN agent_runs WHERE conversation_id = ?
 *   - Title rendering: agent_conversations.title (auto-derived from first user
 *     message; LLM-summarised in a future pass)
 *   - Archive / soft-delete: archived_at IS NULL filter
 *   - Search: separate FTS5 virtual table on (title, body) for cheap MATCH
 *
 * Safe to re-run.
 *
 * Usage:
 *   node --env-file=.env.local --import tsx/esm scripts/migrations/2026-05-11-agent-conversations.ts
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
  // -----------------------------------------------------------------------
  // agent_conversations — chat-thread metadata
  // -----------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS agent_conversations (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL,
    agent           TEXT NOT NULL,
    channel         TEXT NOT NULL,
    title           TEXT,
    message_count   INTEGER NOT NULL DEFAULT 0,
    last_message_at TEXT NOT NULL DEFAULT (datetime('now')),
    archived_at     TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // Partial indexes — only the active rows are queried in the hot path.
  `CREATE INDEX IF NOT EXISTS idx_agent_conv_user_active
     ON agent_conversations(user_id, last_message_at DESC)
     WHERE archived_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS idx_agent_conv_user_agent_active
     ON agent_conversations(user_id, agent, last_message_at DESC)
     WHERE archived_at IS NULL`,
  // Archived list needs its own index (different filter).
  `CREATE INDEX IF NOT EXISTS idx_agent_conv_user_archived
     ON agent_conversations(user_id, archived_at DESC)
     WHERE archived_at IS NOT NULL`,

  // -----------------------------------------------------------------------
  // agent_conversation_search — FTS5 virtual table on title + body
  //
  // No `content=''` — we want FTS5 to keep its own copies of UNINDEXED
  // columns so we can SELECT conversation_id / user_id / agent back out
  // and JOIN to the canonical table. Storage cost is ~2x for the small
  // text we index; not material at our scale.
  // -----------------------------------------------------------------------
  `CREATE VIRTUAL TABLE IF NOT EXISTS agent_conversation_search USING fts5(
    conversation_id UNINDEXED,
    user_id UNINDEXED,
    agent UNINDEXED,
    title,
    body
  )`,
];

const target = process.env.TURSO_DATABASE_URL ? 'Turso' : 'local SQLite';
console.log(`Running agent-conversations migration against ${target}...`);

try {
  for (const sql of statements) {
    await client.execute(sql);
  }
  console.log('✓ agent_conversations created (table + 3 indexes).');
  console.log('✓ agent_conversation_search FTS5 created.');
} catch (err: any) {
  console.error('✗ Migration error:', err.message);
  process.exit(1);
}

console.log('Done.');
