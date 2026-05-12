/**
 * Client Reporting Hub — picker that hands off to the v2 dashboard.
 *
 * The legacy aggregates view (Overview / Campaigns / Pipeline tabs over a
 * 7/30/90/180/365-day window) is replaced by the report-driven v2
 * dashboard at /reports/:id/view (see
 * plans/2026-05-12-client-report-v2-tab-dashboard.md).
 *
 * Flow:
 *   GET /dashboards/reporting-hub
 *     → list of active clients + their latest finalised report (if any).
 *
 *   GET /dashboards/reporting-hub?client=<id>
 *     → look up the most recent finalised report for that client.
 *       If found: 302 redirect to /reports/<id>/view.
 *       If none:  render the picker page with an empty state pointing
 *                 at /reports/new?client=<id>.
 */
import type { FastifyPluginAsync } from 'fastify';
import { getAllActiveClients } from '../../lib/queries.js';
import { listReports } from '../../lib/queries/reports.js';

interface ClientPickerRow {
  id: number;
  name: string;
  latest_report_id: number | null;
  latest_report_period: string | null;
}

export const reportingHubRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const clientId = q.client ? parseInt(q.client, 10) : undefined;

    // Client picked → redirect to their latest finalised report dashboard.
    if (clientId && Number.isFinite(clientId)) {
      const latest = await listReports({ clientId, status: 'final', limit: 1 });
      if (latest.length > 0) {
        return reply.redirect(`/reports/${latest[0].id}/view`);
      }
      // No finalised report yet — fall through to render the picker with
      // an "empty state for this client" message and a Create CTA.
      const clients = await getAllActiveClients();
      return reply.render('dashboards/reporting-hub', {
        clients,
        emptyClientId: clientId,
        emptyClientName: clients.find(c => c.id === clientId)?.name ?? 'this client',
        clientRows: await buildClientRows(),
      });
    }

    // Landing view: full picker.
    const clients = await getAllActiveClients();
    return reply.render('dashboards/reporting-hub', {
      clients,
      emptyClientId: null,
      emptyClientName: null,
      clientRows: await buildClientRows(),
    });
  });
};

/**
 * For each active client, find their most recent finalised report so the
 * picker page can offer a one-click link straight to the dashboard.
 * Two queries (clients + reports) — keeps complexity low.
 */
async function buildClientRows(): Promise<ClientPickerRow[]> {
  const clients = await getAllActiveClients();
  const allFinal = await listReports({ status: 'final', limit: 1000 });
  // Take the first (most recent) report per client_id — listReports is
  // already ordered by period_start DESC.
  const latestByClient = new Map<number, { id: number; period_label: string }>();
  for (const r of allFinal) {
    if (!latestByClient.has(r.client_id)) {
      latestByClient.set(r.client_id, { id: r.id, period_label: r.period_label });
    }
  }
  return clients.map(c => {
    const latest = latestByClient.get(c.id);
    return {
      id: c.id,
      name: c.name,
      latest_report_id: latest?.id ?? null,
      latest_report_period: latest?.period_label ?? null,
    };
  });
}
