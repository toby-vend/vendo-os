/**
 * Heartbeat writer used by every cron handler. Single row per job keyed
 * on the `job` text. Failures here are swallowed — heartbeats are
 * observability, not the critical path.
 *
 * Schema lives at web/lib/monitors/run-all.ts:ensureHeartbeatSchema()
 * (table is created lazily on first monitor run). Wave R / R4 of the
 * efficiency roadmap.
 *
 * Usage in a cron handler:
 *
 *   const t0 = Date.now();
 *   try {
 *     const result = await syncSomething();
 *     await recordHeartbeat('sync-something', true, Date.now() - t0);
 *     return reply.send({ ok: true, ...result });
 *   } catch (err) {
 *     await recordHeartbeat('sync-something', false, Date.now() - t0,
 *       err instanceof Error ? err.message : String(err));
 *     throw err;
 *   }
 *
 * Or via `withHeartbeat()` wrapper for cleaner handlers.
 */
import { db } from '../queries/base.js';

async function ensureHeartbeatSchema(): Promise<void> {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS cron_heartbeats (
        job TEXT PRIMARY KEY,
        last_success_at TEXT,
        last_error_at TEXT,
        last_error TEXT,
        last_duration_ms INTEGER
      )
    `);
  } catch {
    /* ignore — table almost always exists */
  }
}

/** Idempotent heartbeat write. Never throws. */
export async function recordHeartbeat(
  job: string,
  ok: boolean,
  durationMs: number,
  error?: string,
): Promise<void> {
  try {
    await ensureHeartbeatSchema();
    if (ok) {
      await db.execute({
        sql: `INSERT INTO cron_heartbeats
                (job, last_success_at, last_duration_ms, last_error, last_error_at)
              VALUES (?, datetime('now'), ?, NULL, NULL)
              ON CONFLICT(job) DO UPDATE SET
                last_success_at = excluded.last_success_at,
                last_duration_ms = excluded.last_duration_ms,
                last_error = NULL,
                last_error_at = NULL`,
        args: [job, durationMs],
      });
    } else {
      await db.execute({
        sql: `INSERT INTO cron_heartbeats
                (job, last_error_at, last_error, last_duration_ms)
              VALUES (?, datetime('now'), ?, ?)
              ON CONFLICT(job) DO UPDATE SET
                last_error_at = excluded.last_error_at,
                last_error = excluded.last_error,
                last_duration_ms = excluded.last_duration_ms`,
        args: [job, error || 'unknown', durationMs],
      });
    }
  } catch (writeErr) {
    // Heartbeat writes are best-effort; never propagate.
    console.warn(
      '[heartbeat] write failed for',
      job,
      ':',
      writeErr instanceof Error ? writeErr.message : String(writeErr),
    );
  }
}

/**
 * Wrap a job function so its result is heartbeated automatically.
 * Re-throws the original error so the cron handler's try/catch still
 * gets to set HTTP status.
 */
export async function withHeartbeat<T>(job: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  try {
    const result = await fn();
    await recordHeartbeat(job, true, Date.now() - t0);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await recordHeartbeat(job, false, Date.now() - t0, msg);
    throw err;
  }
}

export interface HeartbeatRow {
  job: string;
  last_success_at: string | null;
  last_error_at: string | null;
  last_error: string | null;
  last_duration_ms: number | null;
}

/** Read all heartbeats — used by /operations to render the status table. */
export async function listHeartbeats(): Promise<HeartbeatRow[]> {
  const result = await db.execute(`
    SELECT job, last_success_at, last_error_at, last_error, last_duration_ms
    FROM cron_heartbeats
    ORDER BY COALESCE(last_error_at, last_success_at, '') DESC
  `);
  return result.rows.map((r) => ({
    job: String(r.job),
    last_success_at: r.last_success_at as string | null,
    last_error_at: r.last_error_at as string | null,
    last_error: r.last_error as string | null,
    last_duration_ms: r.last_duration_ms as number | null,
  }));
}
