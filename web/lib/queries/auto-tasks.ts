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
 *
 * The rejection join is done in JS, not SQL, because `normaliseForMatch`
 * strips punctuation and collapses whitespace — a straight `LOWER()` compare
 * misses every task with any punctuation in its name.
 */
export async function getRecentAutoTasks(limit = 100): Promise<AutoTaskRow[]> {
  await ensureRejectionSchema();

  type TaskBase = Omit<AutoTaskRow, 'rejection_reason' | 'rejected_at' | 'rejection_client' | 'rejection_assignee'>;
  const tasks = await rows<TaskBase>(
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
            m.client_name as client_name
       FROM fathom_asana_synced fas
       LEFT JOIN meetings m
              ON m.id = fas.meeting_id
             AND fas.source_type = 'meeting'
      ORDER BY fas.created_at DESC
      LIMIT ?`,
    [limit],
  );

  interface RejectionLookupRow {
    name_normalised: string;
    client_name: string | null;
    assignee: string | null;
    reason: string;
    rejected_at: string;
  }
  const rejections = await rows<RejectionLookupRow>(
    `SELECT name_normalised, client_name, assignee, reason, rejected_at
       FROM asana_task_rejections
      ORDER BY rejected_at DESC`,
  );
  const byName = new Map<string, RejectionLookupRow[]>();
  for (const r of rejections) {
    const bucket = byName.get(r.name_normalised) ?? [];
    bucket.push(r);
    byName.set(r.name_normalised, bucket);
  }

  return tasks.map((t) => {
    const key = normaliseForMatch(t.action_description);
    const candidates = byName.get(key) ?? [];
    // Pick the most specific rule that applies (both-scoped > single-scoped
    // > wildcard). Ties break on most recent, which the ORDER BY above gives.
    let best: RejectionLookupRow | null = null;
    let bestSpecificity = -1;
    for (const r of candidates) {
      const clientOk = !r.client_name || r.client_name === t.client_name;
      const assigneeOk = !r.assignee || r.assignee === t.assignee;
      if (!clientOk || !assigneeOk) continue;
      const specificity = (r.client_name ? 1 : 0) + (r.assignee ? 1 : 0);
      if (specificity > bestSpecificity) {
        best = r;
        bestSpecificity = specificity;
      }
    }
    return {
      ...t,
      rejection_reason: best?.reason ?? null,
      rejected_at: best?.rejected_at ?? null,
      rejection_client: best?.client_name ?? null,
      rejection_assignee: best?.assignee ?? null,
    };
  });
}

// --- Dropdown options for the rejection form ---

/** Active client labels for the searchable client dropdown. */
export async function getClientOptions(): Promise<string[]> {
  try {
    const r = await db.execute(
      "SELECT DISTINCT COALESCE(display_name, name) as label FROM clients WHERE status = 'active' ORDER BY label COLLATE NOCASE",
    );
    return r.rows.map((row) => (row.label as string) || '').filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Assignee names drawn from two sources, deduplicated:
 *  - deliverable_team_members.name (active internal team)
 *  - fathom_asana_synced.assignee  (past Fathom-supplied assignees)
 */
export async function getAssigneeOptions(): Promise<string[]> {
  const seen = new Set<string>();
  try {
    const r = await db.execute(
      'SELECT name FROM deliverable_team_members WHERE is_active = 1 ORDER BY name COLLATE NOCASE',
    );
    for (const row of r.rows) {
      const n = ((row.name as string) || '').trim();
      if (n) seen.add(n);
    }
  } catch { /* table may not exist yet */ }
  try {
    const r = await db.execute(
      "SELECT DISTINCT assignee FROM fathom_asana_synced WHERE assignee IS NOT NULL AND assignee != '' ORDER BY assignee COLLATE NOCASE",
    );
    for (const row of r.rows) {
      const n = ((row.assignee as string) || '').trim();
      if (n) seen.add(n);
    }
  } catch { /* table may not exist yet */ }
  return Array.from(seen).sort((a, b) => a.localeCompare(b));
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
