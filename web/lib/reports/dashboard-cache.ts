/**
 * Cached DashboardPayload read/write.
 *
 * Stores the structured payload as JSON in client_report_data_cache. A
 * stale-while-revalidate pattern would be nice in Phase 4; for now we
 * just expose read / write / invalidate and let the orchestrator decide
 * when to recompute.
 */
import { rows } from '../queries/base.js';
import { db } from '../queries/base.js';
import type { DashboardPayload } from './dashboard-types.js';

/** Default TTL — payloads older than this are recomputed automatically. */
export const DASHBOARD_CACHE_TTL_SECONDS = 15 * 60; // 15 minutes

interface CacheRow {
  payload_json: string;
  computed_at: string;
}

export async function readCachedPayload(reportId: number): Promise<DashboardPayload | null> {
  const found = await rows<CacheRow>(
    `SELECT payload_json, computed_at
       FROM client_report_data_cache
      WHERE report_id = ?
      LIMIT 1`,
    [reportId],
  );
  if (found.length === 0) return null;
  const row = found[0];
  try {
    const payload = JSON.parse(row.payload_json) as DashboardPayload;
    return payload;
  } catch {
    // Corrupted cache row — return null so we recompute.
    return null;
  }
}

export function isStale(computedAtIso: string, ttlSeconds = DASHBOARD_CACHE_TTL_SECONDS): boolean {
  const computedAt = new Date(computedAtIso).getTime();
  if (Number.isNaN(computedAt)) return true;
  return (Date.now() - computedAt) / 1000 > ttlSeconds;
}

export async function writeCachedPayload(reportId: number, payload: DashboardPayload): Promise<void> {
  await db.execute({
    sql: `INSERT INTO client_report_data_cache (report_id, payload_json, computed_at)
          VALUES (?, ?, ?)
          ON CONFLICT(report_id) DO UPDATE SET
            payload_json = excluded.payload_json,
            computed_at  = excluded.computed_at`,
    args: [reportId, JSON.stringify(payload), new Date().toISOString()],
  });
}

export async function invalidateCachedPayload(reportId: number): Promise<void> {
  await db.execute({
    sql: `DELETE FROM client_report_data_cache WHERE report_id = ?`,
    args: [reportId],
  });
}
