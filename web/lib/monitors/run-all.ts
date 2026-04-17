import { db } from '../queries/base.js';
import { consoleLog } from './base.js';
import { run as runAsanaOverdue } from './asana-overdue.js';
import { run as runMetaCpl } from './meta-cpl.js';
import { run as runMetaRoas } from './meta-roas.js';
import { run as runGadsCpa } from './gads-cpa.js';
import { run as runAdSpendPacing } from './ad-spend-pacing.js';
import { run as runContractRenewal } from './contract-renewal.js';

/**
 * In-process orchestrator for the hourly monitor cron. Replaces the old
 * `exec('npx tsx run-all-monitors.ts')` pattern which silently failed on
 * Vercel serverless because tsx and the local sql.js DB weren't available.
 *
 * Monitors retired (now handled in real-time by the Fathom webhook):
 *   - fathom-failsafe   → superseded by AI concern detection on ingestion
 *   - concern-detection → runs inline in web/lib/concern-detection.ts
 */

interface MonitorResult {
  name: string;
  checked: number;
  flagged: number;
  durationMs: number;
  error?: string;
}

async function ensureHeartbeatSchema(): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS cron_heartbeats (
      job TEXT PRIMARY KEY,
      last_success_at TEXT,
      last_error_at TEXT,
      last_error TEXT,
      last_duration_ms INTEGER
    )
  `);
}

async function writeHeartbeat(job: string, ok: boolean, durationMs: number, error?: string): Promise<void> {
  if (ok) {
    await db.execute({
      sql: `INSERT INTO cron_heartbeats (job, last_success_at, last_duration_ms, last_error, last_error_at)
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
      sql: `INSERT INTO cron_heartbeats (job, last_error_at, last_error, last_duration_ms)
            VALUES (?, datetime('now'), ?, ?)
            ON CONFLICT(job) DO UPDATE SET
              last_error_at = excluded.last_error_at,
              last_error = excluded.last_error,
              last_duration_ms = excluded.last_duration_ms`,
      args: [job, error || 'unknown', durationMs],
    });
  }
}

export interface RunAllResult {
  results: MonitorResult[];
  totalFlagged: number;
  durationMs: number;
}

export async function runAllMonitors(): Promise<RunAllResult> {
  await ensureHeartbeatSchema();

  const monitors: Array<{ name: string; fn: () => Promise<{ checked: number; flagged: number }> }> = [
    { name: 'asana-overdue', fn: runAsanaOverdue },
    { name: 'meta-cpl', fn: runMetaCpl },
    { name: 'meta-roas', fn: runMetaRoas },
    { name: 'gads-cpa', fn: runGadsCpa },
    { name: 'ad-spend-pacing', fn: runAdSpendPacing },
    { name: 'contract-renewal', fn: runContractRenewal },
  ];

  const start = Date.now();
  const results: MonitorResult[] = [];
  for (const m of monitors) {
    const t0 = Date.now();
    try {
      const r = await m.fn();
      const duration = Date.now() - t0;
      results.push({ name: m.name, checked: r.checked, flagged: r.flagged, durationMs: duration });
      await writeHeartbeat(m.name, true, duration).catch(() => {});
    } catch (err) {
      const duration = Date.now() - t0;
      const msg = err instanceof Error ? err.message : String(err);
      consoleLog('monitors', `${m.name} failed: ${msg}`);
      results.push({ name: m.name, checked: 0, flagged: 0, durationMs: duration, error: msg });
      await writeHeartbeat(m.name, false, duration, msg).catch(() => {});
    }
  }

  const durationMs = Date.now() - start;
  const totalFlagged = results.reduce((s, r) => s + r.flagged, 0);
  consoleLog('monitors', `All monitors done in ${durationMs}ms, ${totalFlagged} total flagged`);
  return { results, totalFlagged, durationMs };
}
