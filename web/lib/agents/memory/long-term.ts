/**
 * Long-term memory — semantic search over agent_memory_chunks.
 *
 * Schema (from scripts/migrations/2026-05-22-agent-memory.ts):
 *   id          TEXT PRIMARY KEY
 *   scope       TEXT       'meeting' | 'decision' | 'recommendation' | 'client-doc'
 *   scope_id    TEXT       the source row's id (e.g. meeting.id, rec.id)
 *   content     TEXT       the embedded passage
 *   embedding   F32_BLOB(1536)
 *   metadata    TEXT       JSON
 *   created_at  TEXT
 *
 * Storage:
 *   - insertChunk(s) takes content + scope; embedding is computed here
 *   - id is derived deterministically from (scope, scope_id) so re-runs of
 *     the seed script don't duplicate (we use INSERT OR REPLACE)
 *
 * Search:
 *   - searchSimilar embeds the query and ORDERs BY vector_distance_cos
 *   - libSQL's idx_agent_memory_vec is present but the brute-force path
 *     is fast enough for ≤50k rows; we'll switch to vector_top_k(idx,...)
 *     once chunk count grows beyond that
 */
import { db } from '../../queries/base';
import { generateId } from '../../auth';
import {
  embedTexts,
  embedOne,
  serialiseVector,
  EMBEDDING_DIM,
} from './embed';

export type MemoryScope =
  | 'meeting'
  | 'decision'
  | 'recommendation'
  | 'client-doc';

export interface MemoryChunk {
  id: string;
  scope: MemoryScope;
  scope_id: string;
  content: string;
  metadata: Record<string, unknown> | null;
}

export interface MemoryHit extends MemoryChunk {
  /** Cosine distance: 0 = identical, 2 = opposite. Lower = better. */
  distance: number;
}

// ---------------------------------------------------------------------------
// Insert — single
// ---------------------------------------------------------------------------

export async function insertChunk(input: {
  scope: MemoryScope;
  scope_id: string;
  content: string;
  metadata?: Record<string, unknown>;
}): Promise<string | null> {
  const embedding = await embedOne(input.content);
  if (!embedding) return null;
  const id = chunkId(input.scope, input.scope_id);
  await db.execute({
    sql: `INSERT INTO agent_memory_chunks
      (id, scope, scope_id, content, embedding, metadata)
    VALUES (?, ?, ?, ?, vector(?), ?)
    ON CONFLICT(id) DO UPDATE SET
      content = excluded.content,
      embedding = excluded.embedding,
      metadata = excluded.metadata,
      created_at = datetime('now')`,
    args: [
      id,
      input.scope,
      input.scope_id,
      input.content,
      serialiseVector(embedding),
      input.metadata ? JSON.stringify(input.metadata) : null,
    ],
  });
  return id;
}

// ---------------------------------------------------------------------------
// Insert — batch (more efficient: one embedMany call)
// ---------------------------------------------------------------------------

export interface InsertChunkInput {
  scope: MemoryScope;
  scope_id: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export async function insertChunks(
  chunks: InsertChunkInput[],
): Promise<{ inserted: number; failed: number }> {
  if (chunks.length === 0) return { inserted: 0, failed: 0 };
  const embeddings = await embedTexts(chunks.map(c => c.content));
  let inserted = 0;
  let failed = 0;
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const e = embeddings[i];
    if (!e) {
      failed++;
      continue;
    }
    try {
      await db.execute({
        sql: `INSERT INTO agent_memory_chunks
          (id, scope, scope_id, content, embedding, metadata)
        VALUES (?, ?, ?, ?, vector(?), ?)
        ON CONFLICT(id) DO UPDATE SET
          content = excluded.content,
          embedding = excluded.embedding,
          metadata = excluded.metadata,
          created_at = datetime('now')`,
        args: [
          chunkId(c.scope, c.scope_id),
          c.scope,
          c.scope_id,
          c.content,
          serialiseVector(e),
          c.metadata ? JSON.stringify(c.metadata) : null,
        ],
      });
      inserted++;
    } catch (err: unknown) {
      console.error(
        '[agent-memory] insertChunks failed for',
        c.scope,
        c.scope_id,
        ':',
        err instanceof Error ? err.message : String(err),
      );
      failed++;
    }
  }
  return { inserted, failed };
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export async function searchSimilar(input: {
  query: string;
  scope?: MemoryScope | 'all';
  limit?: number;
}): Promise<MemoryHit[]> {
  const limit = input.limit ?? 8;
  const embedding = await embedOne(input.query);
  if (!embedding) return [];

  const scope = input.scope ?? 'all';
  const queryVec = serialiseVector(embedding);

  const sql =
    scope === 'all'
      ? `SELECT id, scope, scope_id, content, metadata,
                vector_distance_cos(embedding, vector(?)) AS distance
         FROM agent_memory_chunks
         ORDER BY distance ASC
         LIMIT ?`
      : `SELECT id, scope, scope_id, content, metadata,
                vector_distance_cos(embedding, vector(?)) AS distance
         FROM agent_memory_chunks
         WHERE scope = ?
         ORDER BY distance ASC
         LIMIT ?`;

  const args =
    scope === 'all'
      ? [queryVec, limit]
      : [queryVec, scope, limit];

  const result = await db.execute({ sql, args });
  return result.rows.map(rowToHit);
}

// ---------------------------------------------------------------------------
// Maintenance helpers
// ---------------------------------------------------------------------------

export async function listByScope(
  scope: MemoryScope,
  limit = 100,
): Promise<MemoryChunk[]> {
  const result = await db.execute({
    sql: `SELECT id, scope, scope_id, content, metadata
          FROM agent_memory_chunks
          WHERE scope = ?
          ORDER BY created_at DESC
          LIMIT ?`,
    args: [scope, limit],
  });
  return result.rows.map(rowToChunk);
}

export async function existingScopeIds(scope: MemoryScope): Promise<Set<string>> {
  const result = await db.execute({
    sql: `SELECT scope_id FROM agent_memory_chunks WHERE scope = ?`,
    args: [scope],
  });
  return new Set(result.rows.map(r => String(r.scope_id)));
}

export async function deleteByScope(scope: MemoryScope): Promise<number> {
  const result = await db.execute({
    sql: `DELETE FROM agent_memory_chunks WHERE scope = ?`,
    args: [scope],
  });
  return result.rowsAffected;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function chunkId(scope: MemoryScope, scopeId: string): string {
  // Deterministic id so re-runs upsert rather than duplicate.
  return `${scope}:${scopeId}`;
}

function rowToChunk(row: Record<string, unknown>): MemoryChunk {
  let metadata: Record<string, unknown> | null = null;
  if (row.metadata && typeof row.metadata === 'string') {
    try {
      metadata = JSON.parse(row.metadata) as Record<string, unknown>;
    } catch {
      metadata = null;
    }
  }
  return {
    id: String(row.id),
    scope: String(row.scope) as MemoryScope,
    scope_id: String(row.scope_id),
    content: String(row.content),
    metadata,
  };
}

function rowToHit(row: Record<string, unknown>): MemoryHit {
  return {
    ...rowToChunk(row),
    distance: Number(row.distance),
  };
}

export { EMBEDDING_DIM, generateId };
