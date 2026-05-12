/**
 * Dashboard payload orchestrator.
 *
 * Composes the structured DashboardPayload by fanning out to per-block
 * aggregators in parallel, then wraps the result with the client header
 * and date range. Caches the payload in client_report_data_cache.
 *
 * Used by:
 *   - GET /reports/:id/view              (admin shell)
 *   - GET /portal/reports/:id/view       (client shell)
 *   - GET /api/reports/:id/data.json     (debug / dashboard refresh)
 *   - POST /api/reports/:id/recompute    (force-bust the cache)
 *
 * See plans/2026-05-12-client-report-v2-tab-dashboard.md.
 */
import { getReport } from '../queries/reports.js';
import { fetchClientHeader } from './client-header.js';
import {
  readCachedPayload,
  writeCachedPayload,
  invalidateCachedPayload,
  isStale,
} from './dashboard-cache.js';
import { buildOverview } from './aggregators/overview.js';
import { buildMeta } from './aggregators/meta.js';
import { buildGoogle } from './aggregators/google.js';
import { buildSeo } from './aggregators/seo.js';
import { buildAiSummary } from './aggregators/ai-summary.js';
import { buildTreatments } from './aggregators/treatment.js';
import { findBookingPipelineIds } from './booking-rule.js';
import type {
  DashboardMode,
  DashboardPayload,
  DateRange,
  ReportHeader,
} from './dashboard-types.js';

interface BuildOptions {
  mode: DashboardMode;
  /** Bypass cache and recompute. */
  forceRecompute?: boolean;
}

export async function buildDashboardData(
  reportId: number,
  opts: BuildOptions,
): Promise<DashboardPayload> {
  // Cache hit?
  if (!opts.forceRecompute) {
    const cached = await readCachedPayload(reportId);
    if (cached && !isStale(cached.computedAt)) {
      // Always overwrite mode — the same cached payload is served to both
      // /admin and /portal callers, but the mode flag toggles UI chrome.
      return { ...cached, mode: opts.mode };
    }
  }

  const report = await getReport(reportId);
  if (!report) throw new Error(`Report ${reportId} not found`);

  const client = await fetchClientHeader(report.client_id);
  const range = computeRange(report);

  // Aggregators run in parallel — they're independent reads against
  // different source tables. Treatment + aiSummary are wired separately
  // because they feed into multiple blocks / flags. The booking-pipeline
  // existence check runs alongside so we can flag clients whose GHL
  // workspace doesn't have a 'Booked Appointment' pipeline.
  const [overview, meta, googleResult, seo, aiSummary, treatments, bookingPipelineIds] = await Promise.all([
    buildOverview(report.client_id, range),
    buildMeta(report.client_id, range),
    buildGoogle(report.client_id, range),
    buildSeo(report.client_id, range),
    buildAiSummary(reportId),
    buildTreatments(report.client_id, range),
    findBookingPipelineIds(report.client_id),
  ]);

  const google = googleResult.block;
  const deviceSplitMissing = googleResult.deviceSplitMissing;
  const bookingPipelineMissing = bookingPipelineIds.length === 0;

  // Treatment rows live inside the overview block. Aggregators may also
  // surface flags (default avg value, missing mapping, missing booking
  // pipeline, missing device split) which we hoist to payload.flags.
  const overviewWithTreatments = {
    ...overview,
    treatments: treatments.treatments,
  };

  const payload: DashboardPayload = {
    mode: opts.mode,
    client,
    report: toReportHeader(report),
    range,
    overview: overviewWithTreatments,
    meta,
    google,
    seo,
    aiSummary,
    flags: {
      gbpComingSoon: true,
      geoGridComingSoon: true,
      ...(treatments.averageCaseValueIsDefault ? { averageCaseValueIsDefault: true as const } : {}),
      ...(treatments.treatmentMappingMissing ? { treatmentMappingMissing: true as const } : {}),
      ...(bookingPipelineMissing ? { bookingPipelineMissing: true as const } : {}),
      ...(deviceSplitMissing ? { deviceSplitMissing: true as const } : {}),
    },
    computedAt: new Date().toISOString(),
  };

  await writeCachedPayload(reportId, payload);
  return payload;
}

/** Forcibly drop the cache for a report. Called by POST .../recompute. */
export async function recomputeDashboard(reportId: number, mode: DashboardMode): Promise<DashboardPayload> {
  await invalidateCachedPayload(reportId);
  return buildDashboardData(reportId, { mode, forceRecompute: true });
}

// ── helpers ─────────────────────────────────────────────────────────────

function computeRange(report: {
  period_start: string;
  period_end: string;
}): DateRange {
  const start = new Date(report.period_start + 'T00:00:00Z');
  const end = new Date(report.period_end + 'T00:00:00Z');
  const lenMs = Math.max(0, end.getTime() - start.getTime());
  // Previous window is the same length immediately preceding `start`.
  const prevEnd = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  const prevStart = new Date(prevEnd.getTime() - lenMs);
  const iso = (d: Date): string => d.toISOString().slice(0, 10);
  return {
    current: { start: iso(start), end: iso(end) },
    previous: { start: iso(prevStart), end: iso(prevEnd) },
    granularity: 'day',
  };
}

function toReportHeader(report: {
  id: number;
  status: string;
  period_label: string;
  period_start: string;
  period_end: string;
}): ReportHeader {
  return {
    id: report.id,
    status: (report.status as ReportHeader['status']) || 'draft',
    periodLabel: report.period_label,
    periodStart: report.period_start,
    periodEnd: report.period_end,
  };
}
