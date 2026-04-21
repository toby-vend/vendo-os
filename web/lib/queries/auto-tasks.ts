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
  // Idempotent migration to scope-aware rejections (client + assignee).
  for (const sql of [
    'ALTER TABLE asana_task_rejections ADD COLUMN client_name TEXT',
    'ALTER TABLE asana_task_rejections ADD COLUMN assignee TEXT',
  ]) {
    try { await db.execute(sql); } catch { /* column already exists */ }
  }
  // Swap the name-only index for the scope-aware one.
  try { await db.execute('DROP INDEX IF EXISTS idx_atr_name'); } catch { /* ignore */ }
  await db.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_atr_scope
       ON asana_task_rejections(name_normalised, COALESCE(client_name, ''), COALESCE(assignee, ''))`,
  );
  _schemaReady = true;
}

/** Normalise task text for exact-match dedupe. Mirrors the sync job. */
export function normaliseForMatch(s: string): string {
  return (s || '').toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// --- Rejection checks ---

/**
 * Returns the rejection reason if any rule matches this task, else null.
 *
 * A rule matches when:
 *   - name_normalised == normalisedName
 *   - client_name IS NULL (wildcard) OR == clientName
 *   - assignee    IS NULL (wildcard) OR == assignee
 *
 * When multiple rules match, the most specific one wins (rule with both
 * client + assignee set beats a client-only rule, which beats a global one).
 */
export async function getRejectionReason(
  normalisedName: string,
  clientName: string | null,
  assignee: string | null,
): Promise<string | null> {
  try {
    await ensureRejectionSchema();
    const r = await rows<{ reason: string }>(
      `SELECT reason,
              (CASE WHEN client_name IS NOT NULL THEN 1 ELSE 0 END
             + CASE WHEN assignee    IS NOT NULL THEN 1 ELSE 0 END) AS specificity
         FROM asana_task_rejections
        WHERE name_normalised = ?
          AND (client_name IS NULL OR client_name = ?)
          AND (assignee    IS NULL OR assignee = ?)
        ORDER BY specificity DESC, rejected_at DESC
        LIMIT 1`,
      [normalisedName, clientName ?? '', assignee ?? ''],
    );
    return r[0]?.reason || null;
  } catch {
    return null;
  }
}

// --- Recording rejections ---

export async function recordRejection(input: {
  taskGid: string | null;
  taskName: string;
  clientName: string | null;
  assignee: string | null;
  reason: string;
  userId: string | null;
}): Promise<void> {
  await ensureRejectionSchema();
  const normalised = normaliseForMatch(input.taskName);
  // Manual upsert — SQLite's ON CONFLICT can't target a COALESCE'd index
  // cleanly, so delete-then-insert keeps this readable.
  await db.execute({
    sql: `DELETE FROM asana_task_rejections
           WHERE name_normalised = ?
             AND COALESCE(client_name, '') = COALESCE(?, '')
             AND COALESCE(assignee, '')    = COALESCE(?, '')`,
    args: [normalised, input.clientName, input.assignee],
  });
  await db.execute({
    sql: `INSERT INTO asana_task_rejections
            (task_gid, name_normalised, client_name, assignee, reason, rejected_by_user_id, rejected_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      input.taskGid,
      normalised,
      input.clientName,
      input.assignee,
      input.reason,
      input.userId,
      new Date().toISOString(),
    ],
  });
}

export async function undoRejection(
  normalisedName: string,
  clientName: string | null,
  assignee: string | null,
): Promise<void> {
  await ensureRejectionSchema();
  await db.execute({
    sql: `DELETE FROM asana_task_rejections
           WHERE name_normalised = ?
             AND COALESCE(client_name, '') = COALESCE(?, '')
             AND COALESCE(assignee, '')    = COALESCE(?, '')`,
    args: [normalisedName, clientName, assignee],
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
  rejection_client: string | null;
  rejection_assignee: string | null;
}

/**
 * Recent auto-created tasks joined with meeting context and rejection status.
 * A task shows as rejected when any rule matches its (name, client, assignee)
 * tuple — global wildcards and client/assignee-scoped rules both count.
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
            r.reason       as rejection_reason,
            r.rejected_at  as rejected_at,
            r.client_name  as rejection_client,
            r.assignee     as rejection_assignee
       FROM fathom_asana_synced fas
       LEFT JOIN meetings m
              ON m.id = fas.meeting_id
             AND fas.source_type = 'meeting'
       LEFT JOIN asana_task_rejections r
              ON LOWER(fas.action_description) = r.name_normalised
             AND (r.client_name IS NULL OR r.client_name = m.client_name)
             AND (r.assignee    IS NULL OR r.assignee    = fas.assignee)
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
