// APPEND-ONLY: This module must never export a DELETE function for task_runs.
// Audit log integrity depends on this constraint. See AUDT-03.

import { rows, scalar, db } from './base.js';

// --- Types ---

/**
 * A point-in-time snapshot of an SOP at the moment a draft was generated.
 * Stored as JSON in task_runs.sops_used for audit trail (AUDT-01).
 */
export interface SopSnapshot {
  id: number;
  title: string;
  drive_modified_at: string;
  content_hash: string;
}

/**
 * Parsed audit view of a task run row.
 * sops_used is parsed from raw JSON into SopSnapshot[] for typed consumption (AUDT-02).
 */
export interface AuditRecord {
  id: number;
  created_by: string;
  client_id: number;
  channel: string;
  task_type: string;
  sops_used: SopSnapshot[] | null;
  qa_score: number | null;
  qa_critique: string | null;
  attempts: number;
  created_at: string;
  updated_at: string;
}

export type TaskRunStatus =
  | 'queued'
  | 'generating'
  | 'qa_check'
  | 'draft_ready'
  | 'approved'
  | 'failed';

export interface TaskRunRow {
  id: number;
  client_id: number;
  channel: string;
  task_type: string;
  status: TaskRunStatus;
  sops_used: string | null;
  brand_context_id: number | null;
  output: string | null;
  qa_score: number | null;
  qa_critique: string | null;
  attempts: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// --- Queries ---

/**
 * Insert a new task run with status=queued and attempts=0.
 * Returns the integer ID of the inserted row.
 */
export async function createTaskRun(data: {
  clientId: number;
  channel: string;
  taskType: string;
  createdBy: string;
}): Promise<number> {
  const now = new Date().toISOString();
  const result = await db.execute({
    sql: `INSERT INTO task_runs (client_id, channel, task_type, status, attempts, created_by, created_at, updated_at)
          VALUES (?, ?, ?, 'queued', 0, ?, ?, ?)`,
    args: [data.clientId, data.channel, data.taskType, data.createdBy, now, now],
  });
  return Number(result.lastInsertRowid);
}

/**
 * Update the status of a task run. Optionally writes sops_used (as JSON) and
 * brand_context_id when provided in extras.
 */
export async function updateTaskRunStatus(
  id: number,
  status: TaskRunStatus,
  extras?: { sopsUsed?: number[]; brandContextId?: number | null },
): Promise<void> {
  const now = new Date().toISOString();

  if (extras?.sopsUsed !== undefined || extras?.brandContextId !== undefined) {
    const sopsUsed = extras.sopsUsed !== undefined ? JSON.stringify(extras.sopsUsed) : null;
    const brandContextId = extras.brandContextId !== undefined ? extras.brandContextId : null;

    await db.execute({
      sql: `UPDATE task_runs SET status = ?, sops_used = COALESCE(?, sops_used), brand_context_id = COALESCE(?, brand_context_id), updated_at = ? WHERE id = ?`,
      args: [status, sopsUsed, brandContextId, now, id],
    });
  } else {
    await db.execute({
      sql: `UPDATE task_runs SET status = ?, updated_at = ? WHERE id = ?`,
      args: [status, now, id],
    });
  }
}

/**
 * Retrieve a full task run row by ID. Returns null if not found.
 */
export async function getTaskRun(id: number): Promise<TaskRunRow | null> {
  const result = await rows<TaskRunRow>(
    'SELECT * FROM task_runs WHERE id = ? LIMIT 1',
    [id],
  );
  return result[0] ?? null;
}

/**
 * Atomically sets status to draft_ready and writes the output JSON string.
 * Caller must JSON.stringify the output before passing.
 */
export async function updateTaskRunOutput(
  id: number,
  output: string, // JSON string — caller must JSON.stringify before passing
): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE task_runs SET status = 'draft_ready', output = ?, updated_at = ? WHERE id = ?`,
    args: [output, now, id],
  });
}

/**
 * Updates qa_score and qa_critique for a task run.
 * The critique parameter is a pre-stringified JSON string — caller handles serialisation.
 * This is a targeted QA-only update, separate from updateTaskRunOutput.
 */
export async function updateTaskRunQA(
  id: number,
  qa: { score: number; critique: string },
): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE task_runs SET qa_score = ?, qa_critique = ?, updated_at = ? WHERE id = ?`,
    args: [qa.score, qa.critique, now, id],
  });
}

/**
 * Increments the attempts counter by 1 for a task run.
 * Called once per QA cycle (generation + QA evaluation), not per Anthropic call.
 */
export async function incrementAttempts(id: number): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE task_runs SET attempts = attempts + 1, updated_at = ? WHERE id = ?`,
    args: [now, id],
  });
}

/**
 * List task runs with optional filters for status and clientId.
 * Results ordered by created_at DESC, defaulting to 50 rows.
 */
export async function listTaskRuns(filters?: {
  status?: TaskRunStatus;
  clientId?: number;
  limit?: number;
}): Promise<TaskRunRow[]> {
  const conditions: string[] = [];
  const args: (string | number | null)[] = [];

  if (filters?.status !== undefined) {
    conditions.push('status = ?');
    args.push(filters.status);
  }

  if (filters?.clientId !== undefined) {
    conditions.push('client_id = ?');
    args.push(filters.clientId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters?.limit ?? 50;
  args.push(limit);

  return rows<TaskRunRow>(
    `SELECT * FROM task_runs ${where} ORDER BY created_at DESC LIMIT ?`,
    args,
  );
}
