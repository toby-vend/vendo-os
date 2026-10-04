import { db } from '../queries/base.js';

/**
 * Queue of AI video edit jobs started from Frame.io (plans/2026-10-03-frameio-native-ai-edits.md).
 *
 * Vercel writes jobs (the Frame.io custom action endpoint); each editor's MacBook runs a worker that
 * claims the jobs routed to it, runs the edit locally and writes the result back. Turso is the only
 * thing both sides share, so the worker talks to this table directly.
 *
 * A first cut starts a chain; every revision of that video is a new job in the same chain and runs on
 * the same Mac (the job folder with the source footage and edit plan lives there).
 */

export type JobKind = 'first_cut' | 'revision' | 'export';
export type JobStatus = 'queued' | 'running' | 'done' | 'failed';

export interface FirstCutParams {
  section: 'Social Ads' | 'Organic';
  /** Set by the AI after the first pass (title.json), not by the person starting the job. */
  treatment: string | null;
  concept: string | null;
  brand: string;
  notes: string;
}

export interface VideoJob {
  id: number;
  kind: JobKind;
  status: JobStatus;
  chain_id: number | null;
  interaction_id: string | null;
  requested_by_user_id: string | null;
  requested_by_email: string | null;
  requested_by_name: string | null;
  worker_email: string;
  source_file_id: string;
  project_id: string | null;
  params: string;
  job_dir: string | null;
  result_file_id: string | null;
  result_stack_id: string | null;
  result_view_url: string | null;
  message: string | null;
  created_at: string;
  claimed_at: string | null;
  heartbeat_at: string | null;
  finished_at: string | null;
}

let schemaEnsured = false;

export async function ensureVideoJobsSchema(): Promise<void> {
  if (schemaEnsured) return;
  const stmts = [
    `CREATE TABLE IF NOT EXISTS video_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      chain_id INTEGER,
      interaction_id TEXT UNIQUE,
      requested_by_user_id TEXT,
      requested_by_email TEXT,
      requested_by_name TEXT,
      worker_email TEXT NOT NULL,
      source_file_id TEXT NOT NULL,
      project_id TEXT,
      params TEXT NOT NULL DEFAULT '{}',
      job_dir TEXT,
      result_file_id TEXT,
      result_stack_id TEXT,
      result_view_url TEXT,
      message TEXT,
      created_at TEXT NOT NULL,
      claimed_at TEXT,
      heartbeat_at TEXT,
      finished_at TEXT
    )`,
    'CREATE INDEX IF NOT EXISTS idx_video_jobs_worker ON video_jobs(worker_email, status)',
    'CREATE INDEX IF NOT EXISTS idx_video_jobs_chain ON video_jobs(chain_id)',
    'CREATE INDEX IF NOT EXISTS idx_video_jobs_result ON video_jobs(result_file_id)',
    `CREATE TABLE IF NOT EXISTS video_workers (
      email TEXT PRIMARY KEY,
      host TEXT,
      last_seen_at TEXT NOT NULL
    )`,
  ];
  for (const sql of stmts) await db.execute(sql);
  schemaEnsured = true;
}

const now = () => new Date().toISOString();

/** Queue a job. Returns the existing job when Frame.io retries the same interaction. */
export async function queueJob(job: {
  kind: JobKind;
  chainId?: number | null;
  interactionId: string | null;
  requestedBy: { userId: string | null; email: string | null; name: string | null };
  workerEmail: string;
  sourceFileId: string;
  projectId: string | null;
  params: unknown;
  jobDir?: string | null;
}): Promise<VideoJob> {
  await ensureVideoJobsSchema();
  if (job.interactionId) {
    const existing = await db.execute({ sql: 'SELECT * FROM video_jobs WHERE interaction_id = ?', args: [job.interactionId] });
    if (existing.rows.length) return existing.rows[0] as unknown as VideoJob;
  }
  const res = await db.execute({
    sql: `INSERT INTO video_jobs (kind, status, chain_id, interaction_id, requested_by_user_id, requested_by_email,
            requested_by_name, worker_email, source_file_id, project_id, params, job_dir, created_at)
          VALUES (?, 'queued', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      job.kind, job.chainId ?? null, job.interactionId, job.requestedBy.userId, job.requestedBy.email,
      job.requestedBy.name, job.workerEmail.toLowerCase(), job.sourceFileId, job.projectId,
      JSON.stringify(job.params ?? {}), job.jobDir ?? null, now(),
    ],
  });
  const id = Number(res.lastInsertRowid);
  // A first cut is the head of its own chain.
  if (job.kind === 'first_cut') await db.execute({ sql: 'UPDATE video_jobs SET chain_id = ? WHERE id = ?', args: [id, id] });
  return (await getJob(id))!;
}

export async function getJob(id: number): Promise<VideoJob | null> {
  await ensureVideoJobsSchema();
  const res = await db.execute({ sql: 'SELECT * FROM video_jobs WHERE id = ?', args: [id] });
  return (res.rows[0] as unknown as VideoJob) ?? null;
}

/** The most recent finished job that delivered this Frame.io file or version stack. */
export async function findJobByDelivered(fileOrStackId: string): Promise<VideoJob | null> {
  await ensureVideoJobsSchema();
  const res = await db.execute({
    sql: `SELECT * FROM video_jobs WHERE status = 'done' AND kind != 'export' AND (result_file_id = ? OR result_stack_id = ?) ORDER BY id DESC LIMIT 1`,
    args: [fileOrStackId, fileOrStackId],
  });
  return (res.rows[0] as unknown as VideoJob) ?? null;
}

/** Latest delivered version in a chain (where the next revision or export starts from). Exports deliver no version. */
export async function latestDoneInChain(chainId: number): Promise<VideoJob | null> {
  const res = await db.execute({
    sql: `SELECT * FROM video_jobs WHERE chain_id = ? AND status = 'done' AND kind != 'export' ORDER BY id DESC LIMIT 1`,
    args: [chainId],
  });
  return (res.rows[0] as unknown as VideoJob) ?? null;
}

/** A job in the chain that hasn't finished yet, if any. */
export async function openJobInChain(chainId: number): Promise<VideoJob | null> {
  await ensureVideoJobsSchema();
  const res = await db.execute({
    sql: `SELECT * FROM video_jobs WHERE chain_id = ? AND status IN ('queued', 'running') ORDER BY id LIMIT 1`,
    args: [chainId],
  });
  return (res.rows[0] as unknown as VideoJob) ?? null;
}

/**
 * Claim the oldest queued job for this worker. The conditional UPDATE makes the claim atomic, so two
 * worker processes on the same Mac can never pick up the same job.
 */
export async function claimNextJob(workerEmail: string): Promise<VideoJob | null> {
  await ensureVideoJobsSchema();
  const next = await db.execute({
    sql: `SELECT id FROM video_jobs WHERE worker_email = ? AND status = 'queued' ORDER BY id LIMIT 1`,
    args: [workerEmail.toLowerCase()],
  });
  if (!next.rows.length) return null;
  const id = Number(next.rows[0].id);
  const t = now();
  const res = await db.execute({
    sql: `UPDATE video_jobs SET status = 'running', claimed_at = ?, heartbeat_at = ? WHERE id = ? AND status = 'queued'`,
    args: [t, t, id],
  });
  return res.rowsAffected === 1 ? getJob(id) : null;
}

export async function heartbeatJob(id: number, message?: string): Promise<void> {
  await db.execute({
    sql: 'UPDATE video_jobs SET heartbeat_at = ?, message = COALESCE(?, message) WHERE id = ?',
    args: [now(), message ?? null, id],
  });
}

export async function finishJob(id: number, result: {
  jobDir: string; fileId: string; stackId: string | null; viewUrl: string | null; message: string;
}): Promise<void> {
  await db.execute({
    sql: `UPDATE video_jobs SET status = 'done', job_dir = ?, result_file_id = ?, result_stack_id = ?,
            result_view_url = ?, message = ?, finished_at = ? WHERE id = ?`,
    args: [result.jobDir, result.fileId, result.stackId, result.viewUrl, result.message, now(), id],
  });
}

export async function failJob(id: number, message: string, jobDir?: string | null): Promise<void> {
  await db.execute({
    sql: `UPDATE video_jobs SET status = 'failed', message = ?, job_dir = COALESCE(?, job_dir), finished_at = ? WHERE id = ?`,
    args: [message.slice(0, 2000), jobDir ?? null, now(), id],
  });
}

/** Jobs left 'running' by a worker that died (laptop shut mid-edit) go back to the queue. */
export async function requeueStale(workerEmail: string, staleMinutes = 20): Promise<number> {
  await ensureVideoJobsSchema();
  const cutoff = new Date(Date.now() - staleMinutes * 60_000).toISOString();
  const res = await db.execute({
    sql: `UPDATE video_jobs SET status = 'queued', claimed_at = NULL WHERE worker_email = ? AND status = 'running' AND heartbeat_at < ?`,
    args: [workerEmail.toLowerCase(), cutoff],
  });
  return res.rowsAffected;
}

export async function touchWorker(email: string, host: string): Promise<void> {
  await ensureVideoJobsSchema();
  await db.execute({
    sql: `INSERT INTO video_workers (email, host, last_seen_at) VALUES (?, ?, ?)
          ON CONFLICT(email) DO UPDATE SET host = excluded.host, last_seen_at = excluded.last_seen_at`,
    args: [email.toLowerCase(), host, now()],
  });
}

/** Editors whose Mac has checked in within the last 60 days (has the AI edit app installed). */
export async function listWorkers(): Promise<string[]> {
  await ensureVideoJobsSchema();
  const cutoff = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const res = await db.execute({ sql: 'SELECT email FROM video_workers WHERE last_seen_at > ? ORDER BY last_seen_at DESC', args: [cutoff] });
  return res.rows.map((r) => String(r.email));
}

/** When this person's Mac last checked in, or null if it never has. */
export async function workerLastSeen(email: string): Promise<string | null> {
  await ensureVideoJobsSchema();
  const res = await db.execute({ sql: 'SELECT last_seen_at FROM video_workers WHERE email = ?', args: [email.toLowerCase()] });
  return (res.rows[0]?.last_seen_at as string | undefined) ?? null;
}
