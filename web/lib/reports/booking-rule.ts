/**
 * Universal booking-rule helper.
 *
 * From plan §4.4 (OQ-4 — answered):
 *   "GHL Stage is booked when they are in the Booked Appointment Pipeline.
 *    It will be universal for all GHL clients."
 *
 * An opportunity counts as a booking if its `pipeline_id` resolves to a
 * pipeline whose name matches `(?i)booked appointment` (substring,
 * case-insensitive). Stage within the pipeline doesn't matter — being
 * in the pipeline IS the signal. Universal across all GHL clients.
 *
 * Time bucketing: an opportunity counts as booked IN a period if it
 * currently sits in the booking pipeline AND its `last_stage_change_at`
 * (or `updated_at` as fallback) falls inside the period. Opportunities
 * that moved out of the booking pipeline after the period are still
 * counted (we don't track historical pipeline state).
 *
 * Clients whose GHL workspace doesn't have a matching pipeline get
 * `missingPipeline: true` in the result + `flags.bookingPipelineMissing`
 * on the payload — the UI shows a small footnote.
 *
 * See plans/2026-05-12-client-report-v2-tab-dashboard.md.
 */
import { rows } from '../queries/base.js';
import type { DateRange } from './dashboard-types.js';

export const BOOKING_PIPELINE_PATTERN = /booked appointment/i;

/** Cheap test on a raw pipeline name. Used in tests and small utilities. */
export function isBookedAppointmentPipeline(name: string | null | undefined): boolean {
  if (!name) return false;
  return BOOKING_PIPELINE_PATTERN.test(name);
}

/**
 * Resolve the regex that decides which pipelines count as bookings for
 * this client. Per-client override (`clients.booking_pipeline_pattern`)
 * wins; falls back to the universal default.
 *
 * The override is stored as a raw regex source (without slashes). If it
 * fails to compile, we log and fall back to the default rather than
 * crashing the dashboard build.
 */
export async function getBookingPipelinePattern(clientId: number): Promise<RegExp> {
  const found = await rows<{ booking_pipeline_pattern: string | null }>(
    `SELECT booking_pipeline_pattern
       FROM clients
      WHERE id = ?
      LIMIT 1`,
    [clientId],
  );
  const override = found[0]?.booking_pipeline_pattern?.trim();
  if (!override) return BOOKING_PIPELINE_PATTERN;
  try {
    return new RegExp(override, 'i');
  } catch (err) {
    console.warn(
      `[booking-rule] client ${clientId} has invalid booking_pipeline_pattern ` +
      `${JSON.stringify(override)} — using default. ${(err as Error).message}`,
    );
    return BOOKING_PIPELINE_PATTERN;
  }
}

/**
 * Return the IDs of every booking pipeline owned by this client, using
 * the per-client override pattern if set (default `/booked appointment/i`).
 * Empty array means the client has no matching pipeline — the caller
 * should set `missingPipeline: true` and report bookings as 0.
 *
 * We can't run a JS RegExp inside SQL directly. Instead we pull the
 * client's pipelines (typically a handful) and filter in-memory.
 */
export async function findBookingPipelineIds(clientId: number): Promise<string[]> {
  const pattern = await getBookingPipelinePattern(clientId);
  const found = await rows<{ id: string; name: string }>(
    `SELECT p.id, p.name
       FROM ghl_pipelines p
      WHERE p.location_id IN (
              SELECT external_id
                FROM client_source_mappings
               WHERE client_id = ?
                 AND source = 'ghl'
            )`,
    [clientId],
  );
  return found.filter(r => pattern.test(r.name)).map(r => r.id);
}

/**
 * Terminal-negative stage names. In GHL these are positioned AFTER the
 * "Booked Appointment" stage, so a naive position threshold would wrongly
 * count them as booked. Exclude them explicitly.
 */
const NEGATIVE_STAGE_PATTERN =
  /lost|no\s*response|wrong\s*number|closed|cancel|unqualified|not\s*interested|junk|spam|dnq|duplicate/i;

export interface BookingScope {
  /** Pipelines whose NAME matches the booking pattern — every opp counts. */
  pipelineIds: string[];
  /** "Booked-or-beyond" stage IDs within treatment pipelines (excludes the
   *  negative terminal stages that sit after Booked in GHL). */
  stageIds: string[];
}

/**
 * Resolve what counts as a booking for this client. Two shapes are supported:
 *
 *  1. A dedicated pipeline named "Booked Appointment" (legacy) — every opp in
 *     it is booked (via `pipelineIds`).
 *  2. A "Booked Appointment" STAGE inside treatment pipelines (Zen House &
 *     most dental clients) — an opp is booked once its stage is at or beyond
 *     that stage, EXCLUDING the negative terminal stages (Lost / No Response /
 *     Wrong Number …) which GHL positions after it (via `stageIds`).
 *
 * Empty pipelineIds AND empty stageIds ⇒ client has no booking signal.
 */
export async function resolveBookingScope(clientId: number): Promise<BookingScope> {
  const pattern = await getBookingPipelinePattern(clientId);
  const pipelineIds = await findBookingPipelineIds(clientId);
  const namedSet = new Set(pipelineIds);

  const stageRows = await rows<{
    pipeline_id: string;
    stage_id: string;
    stage_name: string;
    position: number;
  }>(
    `SELECT s.pipeline_id AS pipeline_id, s.id AS stage_id,
            s.name AS stage_name, s.position AS position
       FROM ghl_stages s
       JOIN ghl_pipelines p ON p.id = s.pipeline_id
      WHERE p.location_id IN (
              SELECT external_id FROM client_source_mappings
               WHERE client_id = ? AND source = 'ghl'
            )`,
    [clientId],
  );

  const byPipeline = new Map<string, typeof stageRows>();
  for (const r of stageRows) {
    const arr = byPipeline.get(r.pipeline_id) ?? [];
    arr.push(r);
    byPipeline.set(r.pipeline_id, arr);
  }

  const stageIds: string[] = [];
  for (const [pid, stages] of byPipeline) {
    if (namedSet.has(pid)) continue; // whole pipeline already counts
    const bookingStage = stages.find(s => pattern.test(s.stage_name));
    if (!bookingStage) continue;
    for (const s of stages) {
      if (s.position >= bookingStage.position && !NEGATIVE_STAGE_PATTERN.test(s.stage_name)) {
        stageIds.push(s.stage_id);
      }
    }
  }
  return { pipelineIds, stageIds };
}

/** Build the `(pipeline_id IN (...) OR stage_id IN (...))` predicate + params. */
export function bookingPredicate(scope: BookingScope): { clause: string; params: string[] } {
  const parts: string[] = [];
  const params: string[] = [];
  if (scope.pipelineIds.length) {
    parts.push(`pipeline_id IN (${scope.pipelineIds.map(() => '?').join(',')})`);
    params.push(...scope.pipelineIds);
  }
  if (scope.stageIds.length) {
    parts.push(`stage_id IN (${scope.stageIds.map(() => '?').join(',')})`);
    params.push(...scope.stageIds);
  }
  if (parts.length === 0) return { clause: '1=0', params: [] };
  return { clause: `(${parts.join(' OR ')})`, params };
}

export interface BookingOpportunity {
  id: string;
  contact_name: string | null;
  source: string | null;
  monetary_value: number;
  created_at: string | null;
  updated_at: string | null;
  last_stage_change_at: string | null;
  location_id: string | null;
  /** GHL pipeline name (= treatment) — lets aggregators attribute booking
   *  revenue to a campaign via the pipeline→treatment join. */
  pipeline_name: string | null;
}

/**
 * Raw list of booking opportunities for a client in the given period.
 * Used by the Meta + Google aggregators to attribute bookings back to
 * source / campaign.
 *
 * Time filter: an opp is included when its `last_stage_change_at`
 * (preferred) or `updated_at` (fallback) is within the range AND it is
 * currently in the booking pipeline.
 */
export async function listBookingOpportunities(
  clientId: number,
  range: DateRange,
): Promise<BookingOpportunity[]> {
  const scope = await resolveBookingScope(clientId);
  const predicate = bookingPredicate(scope);
  if (predicate.clause === '1=0') return [];

  const startTs = range.current.start;
  const endTs = range.current.end + 'T23:59:59';

  return rows<BookingOpportunity>(
    `SELECT o.id, o.contact_name, o.source, o.monetary_value,
            o.created_at, o.updated_at, o.last_stage_change_at, o.location_id,
            p.name AS pipeline_name
       FROM ghl_opportunities o
       LEFT JOIN ghl_pipelines p ON p.id = o.pipeline_id
      WHERE ${predicate.clause}
        AND COALESCE(o.last_stage_change_at, o.updated_at) >= ?
        AND COALESCE(o.last_stage_change_at, o.updated_at) <= ?`,
    [...predicate.params, startTs, endTs],
  );
}

export interface BookingCount {
  /** Total bookings in the period for this client. */
  total: number;
  /** Total in the previous-period (same length, immediately preceding). */
  totalPrev: number;
  /** Set when this client has no pipeline matching the rule. */
  missingPipeline: boolean;
}

/**
 * Aggregate booking counts for a client in the period + the previous
 * period (for delta computation). Used by the topline tile builders.
 */
export async function countBookingsForClient(
  clientId: number,
  range: DateRange,
): Promise<BookingCount> {
  const scope = await resolveBookingScope(clientId);
  const predicate = bookingPredicate(scope);
  if (predicate.clause === '1=0') {
    return { total: 0, totalPrev: 0, missingPipeline: true };
  }

  const startCurrent = range.current.start;
  const endCurrent = range.current.end + 'T23:59:59';
  const startPrev = range.previous.start;
  const endPrev = range.previous.end + 'T23:59:59';

  const [current, prev] = await Promise.all([
    rows<{ n: number }>(
      `SELECT COUNT(*) AS n
         FROM ghl_opportunities
        WHERE ${predicate.clause}
          AND COALESCE(last_stage_change_at, updated_at) >= ?
          AND COALESCE(last_stage_change_at, updated_at) <= ?`,
      [...predicate.params, startCurrent, endCurrent],
    ),
    rows<{ n: number }>(
      `SELECT COUNT(*) AS n
         FROM ghl_opportunities
        WHERE ${predicate.clause}
          AND COALESCE(last_stage_change_at, updated_at) >= ?
          AND COALESCE(last_stage_change_at, updated_at) <= ?`,
      [...predicate.params, startPrev, endPrev],
    ),
  ]);

  return {
    total: current[0]?.n ?? 0,
    totalPrev: prev[0]?.n ?? 0,
    missingPipeline: false,
  };
}

/**
 * Detect platform from a GHL opportunity's `source` field.
 *
 * GHL's source values are messy and not standardised — this heuristic
 * categorises by the patterns Vendo most often sees. Returns 'other'
 * when the source doesn't match anything. The aggregator agents (A3
 * Meta, A4 Google) use this to count bookings per platform.
 */
export type BookingPlatform = 'meta' | 'google' | 'organic' | 'direct' | 'other';

export function classifyBookingSource(source: string | null | undefined): BookingPlatform {
  if (!source) return 'other';
  const s = source.toLowerCase();
  if (/(fb|facebook|instagram|ig\b|meta)/i.test(s)) return 'meta';
  if (/(google[-_ ]?ads|adwords|gads|paid[-_ ]?search|gclid)/i.test(s)) return 'google';
  if (/(organic|seo|search engine)/i.test(s)) return 'organic';
  if (/(direct|website|web form|enquiry|contact form)/i.test(s)) return 'direct';
  return 'other';
}
