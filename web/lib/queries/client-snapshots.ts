/**
 * Persistent client brand snapshots — synthesised Markdown profiles built
 * once and reused across all ad-copy generations for the same scope.
 *
 * Scope_key is either `client:<id>` (mapped) or `project:<frameio_project_id>`
 * (unmapped, project-level guess). Refreshing replaces; no version history.
 * Snapshots expire after 7 days and rebuild automatically on next request,
 * or immediately on a manual /refresh.
 */
import { db, rows } from './base.js';

const DEFAULT_TTL_DAYS = 7;

let schemaEnsured = false;

export async function ensureSchema(): Promise<void> {
  if (schemaEnsured) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS client_brand_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER,
      client_name TEXT NOT NULL,
      scope_key TEXT NOT NULL UNIQUE,
      snapshot_md TEXT NOT NULL,
      confidence TEXT NOT NULL,
      source_summary_json TEXT,
      generated_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      refreshed_by TEXT,
      generation_review_id INTEGER
    )
  `);
  try { await db.execute(`CREATE INDEX IF NOT EXISTS idx_brand_snapshots_scope ON client_brand_snapshots(scope_key)`); } catch { /* exists */ }
  schemaEnsured = true;
}

export type SnapshotConfidence = 'mapped' | 'best_guess' | 'unmapped';

export interface BrandSnapshot {
  id: number;
  clientId: number | null;
  clientName: string;
  scopeKey: string;
  snapshotMd: string;
  confidence: SnapshotConfidence;
  sourceSummary: Record<string, unknown> | null;
  generatedAt: string;
  expiresAt: string;
  refreshedBy: string | null;
  generationReviewId: number | null;
}

interface SnapshotRow {
  id: number;
  client_id: number | null;
  client_name: string;
  scope_key: string;
  snapshot_md: string;
  confidence: string;
  source_summary_json: string | null;
  generated_at: string;
  expires_at: string;
  refreshed_by: string | null;
  generation_review_id: number | null;
}

function mapRow(row: SnapshotRow): BrandSnapshot {
  let summary: Record<string, unknown> | null = null;
  if (row.source_summary_json) {
    try { summary = JSON.parse(row.source_summary_json) as Record<string, unknown>; } catch { /* keep null */ }
  }
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    scopeKey: row.scope_key,
    snapshotMd: row.snapshot_md,
    confidence: (row.confidence as SnapshotConfidence) ?? 'unmapped',
    sourceSummary: summary,
    generatedAt: row.generated_at,
    expiresAt: row.expires_at,
    refreshedBy: row.refreshed_by,
    generationReviewId: row.generation_review_id,
  };
}

/** Compose the scope_key for a generation context. */
export function scopeKeyFor(clientId: number | null, projectId: string | null): string | null {
  if (clientId) return `client:${clientId}`;
  if (projectId) return `project:${projectId}`;
  return null;
}

export async function getSnapshot(scopeKey: string): Promise<BrandSnapshot | null> {
  await ensureSchema();
  try {
    const r = await rows<SnapshotRow>(
      `SELECT id, client_id, client_name, scope_key, snapshot_md, confidence,
              source_summary_json, generated_at, expires_at, refreshed_by, generation_review_id
         FROM client_brand_snapshots WHERE scope_key = ? LIMIT 1`,
      [scopeKey],
    );
    if (r.length === 0) return null;
    return mapRow(r[0]);
  } catch {
    return null;
  }
}

export function isFresh(snapshot: BrandSnapshot): boolean {
  try {
    return new Date(snapshot.expiresAt).getTime() > Date.now();
  } catch {
    return false;
  }
}

export interface UpsertSnapshotInput {
  clientId: number | null;
  clientName: string;
  scopeKey: string;
  snapshotMd: string;
  confidence: SnapshotConfidence;
  sourceSummary: Record<string, unknown> | null;
  refreshedBy: string | null;
  generationReviewId: number | null;
  ttlDays?: number;
}

export async function upsertSnapshot(input: UpsertSnapshotInput): Promise<BrandSnapshot> {
  await ensureSchema();
  const now = new Date();
  const ttl = input.ttlDays ?? DEFAULT_TTL_DAYS;
  const expires = new Date(now.getTime() + ttl * 24 * 60 * 60 * 1000);
  await db.execute({
    sql: `INSERT INTO client_brand_snapshots
            (client_id, client_name, scope_key, snapshot_md, confidence,
             source_summary_json, generated_at, expires_at, refreshed_by, generation_review_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(scope_key) DO UPDATE SET
            client_id = excluded.client_id,
            client_name = excluded.client_name,
            snapshot_md = excluded.snapshot_md,
            confidence = excluded.confidence,
            source_summary_json = excluded.source_summary_json,
            generated_at = excluded.generated_at,
            expires_at = excluded.expires_at,
            refreshed_by = excluded.refreshed_by,
            generation_review_id = excluded.generation_review_id`,
    args: [
      input.clientId,
      input.clientName,
      input.scopeKey,
      input.snapshotMd,
      input.confidence,
      input.sourceSummary ? JSON.stringify(input.sourceSummary) : null,
      now.toISOString(),
      expires.toISOString(),
      input.refreshedBy,
      input.generationReviewId,
    ],
  });
  const stored = await getSnapshot(input.scopeKey);
  if (!stored) throw new Error('upsertSnapshot: row not found after insert');
  return stored;
}

/**
 * Delete the snapshot at scopeKey (e.g. when an unmapped project gets mapped
 * to a client and we want to rebuild from scratch under the new scope).
 */
export async function deleteSnapshot(scopeKey: string): Promise<void> {
  await ensureSchema();
  try {
    await db.execute({
      sql: `DELETE FROM client_brand_snapshots WHERE scope_key = ?`,
      args: [scopeKey],
    });
  } catch { /* swallow */ }
}

/** Manual override — replace the snapshot_md only, leave metadata intact. */
export async function editSnapshotBody(scopeKey: string, snapshotMd: string, editedBy: string | null): Promise<BrandSnapshot | null> {
  await ensureSchema();
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE client_brand_snapshots
            SET snapshot_md = ?, refreshed_by = ?, generated_at = ?
          WHERE scope_key = ?`,
    args: [snapshotMd, editedBy, now, scopeKey],
  });
  return getSnapshot(scopeKey);
}
