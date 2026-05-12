/**
 * Shared helpers for the dashboard aggregators.
 *
 * Date maths, daily series generation, GHL data lookups that are used by
 * more than one aggregator. Keep these small and dependency-free so the
 * per-block aggregators stay focused.
 */
import { rows } from '../../queries/base.js';
import type { DateRange } from '../dashboard-types.js';
import { classifyBookingSource, type BookingPlatform } from '../booking-rule.js';

// ── Date utilities ──────────────────────────────────────────────────────

/** UTC ISO YYYY-MM-DD from a Date. */
export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Number of days between two YYYY-MM-DD strings (inclusive). */
export function inclusiveDays(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00Z').getTime();
  const e = new Date(end + 'T00:00:00Z').getTime();
  return Math.max(1, Math.round((e - s) / 86_400_000) + 1);
}

/** Every YYYY-MM-DD string in [start, end] inclusive, ascending. */
export function enumerateDays(start: string, end: string): string[] {
  const days: string[] = [];
  const startMs = new Date(start + 'T00:00:00Z').getTime();
  const endMs = new Date(end + 'T00:00:00Z').getTime();
  for (let t = startMs; t <= endMs; t += 86_400_000) {
    days.push(isoDay(new Date(t)));
  }
  return days;
}

/**
 * Down/up-sample an array of daily values keyed by date string into a
 * fixed-length sparkline array. Missing days fill with 0.
 *
 * The contract calls for ~30 daily points covering the current period.
 * We always emit exactly the number of days in the range (capped to
 * 30 days max). If the range is shorter we keep the daily granularity
 * (sparkline still renders).
 */
export function buildDailySeries(
  range: DateRange,
  daily: Map<string, number>,
): number[] {
  const days = enumerateDays(range.current.start, range.current.end);
  // Cap at 30 points to keep the SVG cheap. If range > 30, evenly bucket.
  if (days.length <= 30) {
    return days.map(d => Math.round((daily.get(d) ?? 0) * 100) / 100);
  }
  const bucketCount = 30;
  const bucketSize = days.length / bucketCount;
  const out: number[] = [];
  for (let i = 0; i < bucketCount; i++) {
    const startIdx = Math.floor(i * bucketSize);
    const endIdx = Math.floor((i + 1) * bucketSize);
    let sum = 0;
    for (let j = startIdx; j < endIdx; j++) {
      sum += daily.get(days[j]) ?? 0;
    }
    out.push(Math.round(sum * 100) / 100);
  }
  return out;
}

/** SQL bookends for the current period (UTC). */
export function currentSqlRange(range: DateRange): [string, string] {
  return [range.current.start, range.current.end];
}

/** SQL bookends for the previous period (UTC). */
export function previousSqlRange(range: DateRange): [string, string] {
  return [range.previous.start, range.previous.end];
}

// ── GHL lead helpers (period-scoped) ────────────────────────────────────

export interface GhlPeriodOpp {
  id: string;
  monetary_value: number;
  source: string | null;
  created_at: string | null;
  updated_at: string | null;
  pipeline_id: string | null;
}

/**
 * All opportunities for a client whose `created_at` falls within the
 * given range. Used for the lead count and per-platform attribution.
 *
 * We use `created_at` (not `last_stage_change_at`) because a "lead" is
 * a contact who *arrived* during the period — the booking pipeline rule
 * (handled separately in booking-rule.ts) deals with bookings.
 */
export async function listOppsCreatedInRange(
  clientId: number,
  startIso: string,
  endIso: string,
): Promise<GhlPeriodOpp[]> {
  const startTs = startIso + 'T00:00:00';
  const endTs = endIso + 'T23:59:59';
  return rows<GhlPeriodOpp>(
    `SELECT id, monetary_value, source, created_at, updated_at, pipeline_id
       FROM ghl_opportunities
      WHERE (
              location_id IN (SELECT external_id FROM client_source_mappings WHERE client_id = ? AND source = 'ghl')
              OR contact_company IN (SELECT external_id FROM client_source_mappings WHERE client_id = ? AND source = 'ghl')
            )
        AND created_at >= ?
        AND created_at <= ?`,
    [clientId, clientId, startTs, endTs],
  );
}

/** Bucket opportunities by platform (meta/google/organic/direct/other). */
export function bucketOppsByPlatform(opps: GhlPeriodOpp[]): Record<BookingPlatform, GhlPeriodOpp[]> {
  const buckets: Record<BookingPlatform, GhlPeriodOpp[]> = {
    meta: [], google: [], organic: [], direct: [], other: [],
  };
  for (const o of opps) {
    buckets[classifyBookingSource(o.source)].push(o);
  }
  return buckets;
}

// ── Numeric helpers ────────────────────────────────────────────────────

export function safeDiv(num: number, denom: number): number {
  if (!denom || !Number.isFinite(denom)) return 0;
  const v = num / denom;
  return Number.isFinite(v) ? v : 0;
}

export function round2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}
