/**
 * /admin/growth — unified dashboard for the cooperating growth agents.
 *
 * Reads growth_findings (the row each growth agent writes via
 * recordGrowthFinding) and renders a filterable list + per-finding
 * detail. Mirrors the /admin/code-health pattern.
 *
 * GET  /                  list with filter chips
 * GET  /:id               per-finding detail with reasoning + action
 * POST /:id/acted         mark resolved/acted-on
 * POST /:id/dismissed     mark as noise (never re-raise)
 * POST /:id/stale         mark stale (acknowledged, no action needed)
 *
 * Admin-only via server.ts /admin/* gate. CSRF on every POST.
 */
import type { FastifyPluginAsync } from 'fastify';
import {
  listGrowthFindings,
  getGrowthFinding,
  getOpenCountsBySeverity,
  markActed,
  markDismissed,
  markStale,
} from '../../lib/growth/findings-store.js';
import type { GrowthSeverity, GrowthStatus } from '../../lib/growth/types.js';
import type { SessionUser } from '../../lib/auth.js';

const SEVS: GrowthSeverity[] = ['P0', 'P1', 'P2', 'P3'];
const STATUSES: GrowthStatus[] = ['open', 'acted', 'dismissed', 'stale'];
const FINDING_TYPES = [
  'churn-risk',
  'upsell',
  'lead-score',
  'profit-alert',
  'feature-priority',
  'case-study-candidate',
  'growth-prescription',
];

export const adminGrowthRoutes: FastifyPluginAsync = async (app) => {
  // -- GET / --------------------------------------------------------------
  app.get('/', async (request, reply) => {
    const q = (request.query ?? {}) as Record<string, string>;
    const status: GrowthStatus =
      STATUSES.includes(q.status as GrowthStatus) ? (q.status as GrowthStatus) : 'open';
    const severity: GrowthSeverity | null =
      SEVS.includes(q.severity as GrowthSeverity) ? (q.severity as GrowthSeverity) : null;
    const agent = q.agent || null;
    const findingType = q.finding_type || null;

    const [findings, counts] = await Promise.all([
      listGrowthFindings({
        status,
        severity: severity ?? undefined,
        agent: agent ?? undefined,
        finding_type: findingType ?? undefined,
        limit: 300,
      }),
      getOpenCountsBySeverity(),
    ]);

    reply.render('admin/growth', {
      findings: findings.map(viewRow),
      counts,
      currentStatus: status,
      query: q,
      findingTypes: FINDING_TYPES,
    });
  });

  // -- GET /:id -----------------------------------------------------------
  app.get('/:id', async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isFinite(id)) {
      reply.code(400).send('bad id');
      return;
    }
    const finding = await getGrowthFinding(id);
    if (!finding) {
      reply.code(404).send('not found');
      return;
    }
    reply.render('admin/growth-detail', { finding: viewRow(finding) });
  });

  // -- POST /:id/acted ----------------------------------------------------
  app.post('/:id/acted', async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    const user = (request as unknown as { user: SessionUser }).user;
    const body = (request.body ?? {}) as { outcome?: string };
    if (!Number.isFinite(id)) {
      reply.code(400).send({ ok: false, error: 'bad id' });
      return;
    }
    await markActed({ id, by: user.email, outcome: body.outcome });
    reply.redirect('/admin/growth');
  });

  // -- POST /:id/dismissed ------------------------------------------------
  app.post('/:id/dismissed', async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    const user = (request as unknown as { user: SessionUser }).user;
    if (!Number.isFinite(id)) {
      reply.code(400).send({ ok: false, error: 'bad id' });
      return;
    }
    await markDismissed({ id, by: user.email });
    reply.redirect('/admin/growth');
  });

  // -- POST /:id/stale ----------------------------------------------------
  app.post('/:id/stale', async (_request, reply) => {
    const id = Number((_request.params as { id: string }).id);
    if (!Number.isFinite(id)) {
      reply.code(400).send({ ok: false, error: 'bad id' });
      return;
    }
    await markStale({ id });
    reply.redirect('/admin/growth');
  });
};

// ---------------------------------------------------------------------------
// View helpers
// ---------------------------------------------------------------------------

function viewRow(f: import('../../lib/growth/types.js').GrowthFindingRow) {
  return {
    ...f,
    severityClass: `sev-${f.severity.toLowerCase()}`,
    firstSeenShort: f.first_seen?.slice(0, 16) ?? '',
    lastSeenShort: f.last_seen?.slice(0, 16) ?? '',
  };
}
