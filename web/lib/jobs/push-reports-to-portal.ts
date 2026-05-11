/**
 * Push finalised `client_reports` to the ClientDashboard portal.
 *
 * Selects VendoOS rows where `status = 'final'` AND there is no successful
 * delivery row for channel='portal' in `client_report_deliveries`. For each
 * one, resolves the CD `organisations.id` via `external_vendo_id =
 * clients.id` and upserts a row into CD `client_reports` keyed on
 * `(organisation_id, period_start)`.
 *
 * On success: writes a `status='sent'` row to VendoOS client_report_deliveries.
 * On failure: writes a `status='failed'` row with error_msg, continues.
 *
 * Idempotent — re-running picks up only pending reports. Existing
 * delivery rows are never mutated; new attempts append.
 *
 * Used by:
 *   - web/routes/api/cron.ts (Vercel cron: /api/cron/push-reports-to-portal,
 *     every 15 minutes)
 *
 * See plans/2026-05-11-google-ads-autonomous-reporting.md and
 * plans/2026-05-11-cd-reports-schema-delta.md for the design.
 */
import { createClient } from '@supabase/supabase-js';
import { rows } from '../queries/base.js';
import {
  listReportsPendingDelivery,
  recordDelivery,
} from '../queries/report-deliveries.js';

export interface PushReportsResult {
  attempted: number;
  pushed: number;
  failed: number;
  durationMs: number;
  errors: Array<{ report_id: number; error: string }>;
}

/**
 * Row shape coming out of the VendoOS join. Only columns the portal needs.
 * `client_id` is the bridge key (= organisations.external_vendo_id on CD).
 */
interface PendingReportRow {
  id: number;
  client_id: number;
  period_label: string;
  period_start: string;
  period_end: string;
  exec_summary_md: string | null;
  performance_summary_md: string | null;
  wins_md: string | null;
  risks_md: string | null;
  recommendations_md: string | null;
  worked_on_md: string | null;
  focus_next_md: string | null;
  contact_name: string | null;
  approved_at: string | null;
  approved_by: string | null;
}

/**
 * Payload upserted into CD `client_reports`. Keyed on (organisation_id,
 * period_start) per the schema delta plan.
 */
interface CdReportUpsert {
  organisation_id: string;
  external_vendo_report_id: number;
  period_label: string;
  period_start: string;
  period_end: string;
  exec_summary_md: string | null;
  performance_summary_md: string | null;
  wins_md: string | null;
  risks_md: string | null;
  recommendations_md: string | null;
  worked_on_md: string | null;
  focus_next_md: string | null;
  contact_name: string | null;
  approved_at: string | null;
  approved_by: string | null;
  updated_at: string;
}

async function loadPendingReports(reportIds: number[]): Promise<PendingReportRow[]> {
  if (!reportIds.length) return [];
  const placeholders = reportIds.map(() => '?').join(', ');
  return rows<PendingReportRow>(
    `SELECT r.id, r.client_id,
            r.period_label, r.period_start, r.period_end,
            r.exec_summary_md, r.performance_summary_md,
            r.wins_md, r.risks_md, r.recommendations_md,
            r.worked_on_md, r.focus_next_md,
            r.contact_name, r.approved_at, r.approved_by
     FROM client_reports r
     WHERE r.id IN (${placeholders})
     ORDER BY r.period_start ASC, r.id ASC`,
    reportIds,
  );
}

export async function pushFinalReportsToPortal(): Promise<PushReportsResult> {
  const startedAt = Date.now();
  const errors: Array<{ report_id: number; error: string }> = [];
  let pushed = 0;
  let failed = 0;

  const supabaseUrl = process.env.PORTAL_SUPABASE_URL;
  const supabaseKey = process.env.PORTAL_SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing PORTAL_SUPABASE_URL or PORTAL_SUPABASE_SERVICE_ROLE_KEY');
  }

  const portal = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  // 1. Find pending reports (final + no successful portal delivery yet)
  const pendingIds = await listReportsPendingDelivery('portal');
  const attempted = pendingIds.length;

  if (!attempted) {
    return { attempted: 0, pushed: 0, failed: 0, durationMs: Date.now() - startedAt, errors };
  }

  // 2. Hydrate rows from client_reports
  const pendingRows = await loadPendingReports(pendingIds);

  // 3. Resolve CD organisation_id for each client_id in a single round-trip.
  //    `external_vendo_id` is the bridge key set by push-clients-to-portal.
  const clientIds = Array.from(new Set(pendingRows.map((r) => r.client_id)));
  const orgIdByClientId = new Map<number, string>();
  const orgLookupErrorByClientId = new Map<number, string>();

  if (clientIds.length) {
    const { data: orgRows, error: orgErr } = await portal
      .from('organisations')
      .select('id, external_vendo_id')
      .in('external_vendo_id', clientIds)
      .returns<Array<{ id: string; external_vendo_id: number | null }>>();
    if (orgErr) {
      throw new Error(`load organisations for report push: ${orgErr.message}`);
    }
    for (const o of orgRows ?? []) {
      if (o.external_vendo_id != null) orgIdByClientId.set(o.external_vendo_id, o.id);
    }
    for (const clientId of clientIds) {
      if (!orgIdByClientId.has(clientId)) {
        orgLookupErrorByClientId.set(
          clientId,
          `no portal organisation found for vendoos client_id=${clientId} (external_vendo_id mapping missing) — has push-clients-to-portal run?`,
        );
      }
    }
  }

  // 4. Push each report one row at a time so a single bad report doesn't
  //    take the batch down. Per-row writes also map cleanly onto a
  //    per-row delivery audit entry.
  for (const row of pendingRows) {
    const orgId = orgIdByClientId.get(row.client_id);
    if (!orgId) {
      const errMsg =
        orgLookupErrorByClientId.get(row.client_id) ??
        `no portal organisation for client_id=${row.client_id}`;
      await recordDelivery({
        reportId: row.id,
        channel: 'portal',
        status: 'failed',
        errorMsg: errMsg,
      });
      errors.push({ report_id: row.id, error: errMsg });
      failed++;
      continue;
    }

    const upsert: CdReportUpsert = {
      organisation_id: orgId,
      external_vendo_report_id: row.id,
      period_label: row.period_label,
      period_start: row.period_start,
      period_end: row.period_end,
      exec_summary_md: row.exec_summary_md,
      performance_summary_md: row.performance_summary_md,
      wins_md: row.wins_md,
      risks_md: row.risks_md,
      recommendations_md: row.recommendations_md,
      worked_on_md: row.worked_on_md,
      focus_next_md: row.focus_next_md,
      contact_name: row.contact_name,
      approved_at: row.approved_at,
      approved_by: row.approved_by,
      updated_at: new Date().toISOString(),
    };

    try {
      const { error: upErr } = await portal
        .from('client_reports')
        .upsert(upsert, { onConflict: 'organisation_id,period_start' });
      if (upErr) throw new Error(upErr.message);

      await recordDelivery({
        reportId: row.id,
        channel: 'portal',
        status: 'sent',
        payloadJson: JSON.stringify(upsert),
        sentAt: new Date().toISOString(),
      });
      pushed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await recordDelivery({
        reportId: row.id,
        channel: 'portal',
        status: 'failed',
        payloadJson: JSON.stringify(upsert),
        errorMsg: msg,
      });
      errors.push({ report_id: row.id, error: msg });
      failed++;
    }
  }

  return {
    attempted,
    pushed,
    failed,
    durationMs: Date.now() - startedAt,
    errors,
  };
}
