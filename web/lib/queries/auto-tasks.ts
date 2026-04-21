import { db, rows, scalar } from './base.js';

/**
 * Queries for the auto-Asana task QA loop. Tasks are auto-created by the
 * Fathom → Asana sync (meetings, escalations, NPS) and recorded in
 * `fathom_asana_synced`. Users can mark any of them as "not relevant" with a
 * reason — future matches of the same normalised name are then auto-skipped.
 */

let _schemaReady = false;

export async function ensureRejectionSchema(): Promise<void> {
  if (_schemaReady) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS asana_task_rejections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_gid TEXT,
      name_normalised TEXT NOT NULL,
      reason TEXT NOT NULL,
      rejected_by_user_id TEXT,
      rejected_at TEXT NOT NULL
    )
  `);
  await db.execute(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_atr_name ON asana_task_rejections(name_normalised)',
  );
  _schemaReady = true;
}

/** Normalise task text for exact-match dedupe. Mirrors the sync job. */
export function normaliseForMatch(s: string): string {
  return (s || '').toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// --- Rejection checks ---

/**
 * Returns the rejection reason if a task with this normalised name has been
 * rejected, else null. Cheap indexed lookup — called from the sync hot path.
 */
export async function getRejectionReason(normalisedName: string): Promise<string | null> {
  try {
    await ensureRejectionSchema();
    const r = await scalar<string>(
      'SELECT reason FROM asana_task_rejections WHERE name_normalised = ? LIMIT 1',
      [normalisedName],
    );
    return r || null;
  } catch {
    return null;
  }
}

// --- Recording rejections ---

export async function recordRejection(input: {
  taskGid: string | null;
  taskName: string;
  reason: string;
  userId: string | null;
}): Promise<void> {
  await ensureRejectionSchema();
  const normalised = normaliseForMatch(input.taskName);
  await db.execute({
    sql: `INSERT INTO asana_task_rejections (task_gid, name_normalised, reason, rejected_by_user_id, rejected_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(name_normalised) DO UPDATE SET
            task_gid = excluded.task_gid,
            reason = excluded.reason,
            rejected_by_user_id = excluded.rejected_by_user_id,
            rejected_at = excluded.rejected_at`,
    args: [input.taskGid, normalised, input.reason, input.userId, new Date().toISOString()],
  });
}

export async function undoRejection(normalisedName: string): Promise<void> {
  await ensureRejectionSchema();
  await db.execute({
    sql: 'DELETE FROM asana_task_rejections WHERE name_normalised = ?',
    args: [normalisedName],
  });
}

// --- Listing ---

export interface AutoTaskRow {
  id: number;
  asana_task_gid: string;
  meeting_id: string;
  action_description: string;
  assignee: string | null;
  created_at: string;
  source_type: string;
  source_id: string;
  meeting_title: string | null;
  meeting_date: string | null;
  client_name: string | null;
  rejection_reason: string | null;
  rejected_at: string | null;
}

/**
 * Recent auto-created tasks joined with meeting context and rejection status.
 * Returns the last `limit` rows ordered by creation time, newest first.
 */
export async function getRecentAutoTasks(limit = 100): Promise<AutoTaskRow[]> {
  await ensureRejectionSchema();
  return rows<AutoTaskRow>(
    `SELECT fas.id,
            fas.asana_task_gid,
            fas.meeting_id,
            fas.action_description,
            fas.assignee,
            fas.created_at,
            fas.source_type,
            fas.source_id,
            m.title       as meeting_title,
            m.date        as meeting_date,
            m.client_name as client_name,
            r.reason      as rejection_reason,
            r.rejected_at as rejected_at
       FROM fathom_asana_synced fas
       LEFT JOIN meetings m
              ON m.id = fas.meeting_id
             AND fas.source_type = 'meeting'
       LEFT JOIN asana_task_rejections r
              ON r.name_normalised = LOWER(fas.action_description)
      ORDER BY fas.created_at DESC
      LIMIT ?`,
    [limit],
  );
}

// --- Summary counts for /admin/usage ---

export async function getRejectionSummary(): Promise<{ totalRejected: number; thisMonth: number }> {
  try {
    await ensureRejectionSchema();
    const now = new Date();
    const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
    const total = (await scalar<number>('SELECT COUNT(*) FROM asana_task_rejections')) ?? 0;
    const thisMonth = (await scalar<number>(
      'SELECT COUNT(*) FROM asana_task_rejections WHERE rejected_at >= ?',
      [monthStart],
    )) ?? 0;
    return { totalRejected: total, thisMonth };
  } catch {
    return { totalRejected: 0, thisMonth: 0 };
  }
}
