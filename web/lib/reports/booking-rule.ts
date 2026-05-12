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
 * Return the IDs of every "Booked Appointment" pipeline owned by this
 * client. Empty array means the client has no matching pipeline — the
 * caller should set `missingPipeline: true` and report bookings as 0.
 */
export async function findBookingPipelineIds(clientId: number): Promise<string[]> {
  const found = await rows<{ id: string }>(
    `SELECT p.id
       FROM ghl_pipelines p
      WHERE p.location_id IN (
              SELECT external_id
                FROM client_source_mappings
               WHERE client_id = ?
                 AND source = 'ghl'
            )
        AND LOWER(p.name) LIKE '%booked appointment%'`,
    [clientId],
  );
  return found.map(r => r.id);
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
  const pipelineIds = await findBookingPipelineIds(clientId);
  if (pipelineIds.length === 0) return [];

  const placeholders = pipelineIds.map(() => '?').join(',');
  const startTs = range.current.start;
  const endTs = range.current.end + 'T23:59:59';

  return rows<BookingOpportunity>(
    `SELECT id, contact_name, source, monetary_value,
            created_at, updated_at, last_stage_change_at, location_id
       FROM ghl_opportunities
      WHERE pipeline_id IN (${placeholders})
        AND COALESCE(last_stage_change_at, updated_at) >= ?
        AND COALESCE(last_stage_change_at, updated_at) <= ?`,
    [...pipelineIds, startTs, endTs],
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
  const pipelineIds = await findBookingPipelineIds(clientId);
  if (pipelineIds.length === 0) {
    return { total: 0, totalPrev: 0, missingPipeline: true };
  }

  const placeholders = pipelineIds.map(() => '?').join(',');
  const startCurrent = range.current.start;
  const endCurrent = range.current.end + 'T23:59:59';
  const startPrev = range.previous.start;
  const endPrev = range.previous.end + 'T23:59:59';

  const [current, prev] = await Promise.all([
    rows<{ n: number }>(
      `SELECT COUNT(*) AS n
         FROM ghl_opportunities
        WHERE pipeline_id IN (${placeholders})
          AND COALESCE(last_stage_change_at, updated_at) >= ?
          AND COALESCE(last_stage_change_at, updated_at) <= ?`,
      [...pipelineIds, startCurrent, endCurrent],
    ),
    rows<{ n: number }>(
      `SELECT COUNT(*) AS n
         FROM ghl_opportunities
        WHERE pipeline_id IN (${placeholders})
          AND COALESCE(last_stage_change_at, updated_at) >= ?
          AND COALESCE(last_stage_change_at, updated_at) <= ?`,
      [...pipelineIds, startPrev, endPrev],
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
