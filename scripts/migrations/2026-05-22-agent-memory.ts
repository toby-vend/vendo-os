/**
 * Agent memory chunks — vector store for long-term agent memory.
 *
 * Holds embeddings of meeting summaries, decisions, approved recommendations
 * and outcomes, and key client documents. Read by the `searchKnowledge` tool
 * (long-term memory) so agents can retrieve context-relevant prior content
 * before drafting recommendations.
 *
 * libSQL has native vector support via F32_BLOB(N) + libsql_vector_idx().
 * On older Turso plans / sqlite versions this is unavailable — we attempt the
 * native path first, and on failure fall back to a plain BLOB column. The
 * application layer can then do brute-force cosine over the BLOB for ≤50k
 * chunks (well within memory budget at 1536 floats × 4 bytes ≈ 6 KB/chunk).
 *
 * Embedding dimension: 1536 (text-embedding-3-small).
 *
 * Safe to re-run.
 *
 * Usage: npx tsx scripts/migrations/2026-05-22-agent-memory.ts
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
console.log(`Running agent-memory migration against ${target}...`);

// Try native libSQL vector type first; fall back to BLOB if unavailable.
let embeddingType: 'F32_BLOB(1536)' | 'BLOB' = 'F32_BLOB(1536)';
let vectorIndexed = false;

try {
  await client.execute(`CREATE TABLE IF NOT EXISTS __agent_vector_probe (
    id INTEGER PRIMARY KEY,
    e F32_BLOB(1536)
  )`);
  await client.execute(`DROP TABLE IF EXISTS __agent_vector_probe`);
  console.log('✓ libSQL vector support detected — using F32_BLOB(1536).');
} catch (err: any) {
  embeddingType = 'BLOB';
  console.log('⚠ libSQL native vectors unavailable — falling back to BLOB column.');
  console.log('  (Application will use in-process cosine search for ≤50k chunks.)');
  console.log('  Reason:', err.message);
}

const statements: string[] = [
  `CREATE TABLE IF NOT EXISTS agent_memory_chunks (
    id         TEXT PRIMARY KEY,
    scope      TEXT NOT NULL,
    scope_id   TEXT NOT NULL,
    content    TEXT NOT NULL,
    embedding  ${embeddingType},
    metadata   TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_agent_memory_scope
     ON agent_memory_chunks(scope, scope_id)`,
  `CREATE INDEX IF NOT EXISTS idx_agent_memory_created
     ON agent_memory_chunks(created_at DESC)`,
];

try {
  for (const sql of statements) {
    await client.execute(sql);
  }
  console.log('✓ agent_memory_chunks created.');
} catch (err: any) {
  console.error('✗ Migration error:', err.message);
  process.exit(1);
}

// Try to create the native vector index. Skip silently on fallback path.
if (embeddingType === 'F32_BLOB(1536)') {
  try {
    await client.execute(
      `CREATE INDEX IF NOT EXISTS idx_agent_memory_vec
         ON agent_memory_chunks(libsql_vector_idx(embedding))`,
    );
    vectorIndexed = true;
    console.log('✓ libsql_vector_idx created on agent_memory_chunks.embedding.');
  } catch (err: any) {
    console.log('⚠ Native vector column accepted, but libsql_vector_idx() failed.');
    console.log('  Application will use in-process cosine until index is supported.');
    console.log('  Reason:', err.message);
  }
}

console.log(
  vectorIndexed
    ? 'Done. Vector search ready (native).'
    : 'Done. Vector search ready (in-process cosine fallback).',
);
