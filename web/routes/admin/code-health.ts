/**
 * /admin/code-health — the daily codebase-health dashboard.
 *
 * GET /                      filterable list of findings + run summary
 * POST /:id/resolve          mark finding as manually resolved
 * POST /:id/noise            mark finding as noise (never re-raise)
 * POST /:id/wontfix          acknowledge but won't act
 * POST /run-now              fire a manual scan (admin-only, useful for
 *                            testing without waiting for the cron)
 *
 * Admin-only via server.ts /admin/* gate. The route handler doesn't
 * re-check role — that's enforced upstream.
 */
import type { FastifyPluginAsync } from 'fastify';
import { db } from '../../lib/queries/base.js';
import type { SessionUser } from '../../lib/auth.js';
import { runScan } from '../../lib/code-health/scan.js';
import type {
  FindingRow,
  FindingStatus,
  Severity,
  FindingType,
  FindingSource,
} from '../../lib/code-health/types.js';

interface RunRow {
  id: number;
  run_at: string;
  trigger: string;
  files_scanned: number;
  findings_new: number;
  findings_persisting: number;
  findings_resolved: number;
  duration_ms: number | null;
  cost_usd: number | null;
  status: string;
  error: string | null;
}

interface OpenCounts {
  P0: number;
  P1: number;
  P2: number;
  P3: number;
  total: number;
}

export const adminCodeHealthRoutes: FastifyPluginAsync = async (app) => {
  // -- GET / — list + filter ----------------------------------------------
  app.get('/', async (request, reply) => {
    const q = (request.query ?? {}) as Record<string, string>;
    const status: FindingStatus = (
      ['open', 'resolved', 'noise', 'wontfix'].includes(q.status)
        ? (q.status as FindingStatus)
        : 'open'
    );
    const severity = q.severity && ['P0', 'P1', 'P2', 'P3'].includes(q.severity)
      ? (q.severity as Severity)
      : null;
    const type = q.type || null;
    const source = q.source || null;

    const where: string[] = ['status = ?'];
    const args: (string | number)[] = [status];
    if (severity) {
      where.push('severity = ?');
      args.push(severity);
    }
    if (type) {
      where.push('finding_type = ?');
      args.push(type);
    }
    if (source) {
      where.push('source = ?');
      args.push(source);
    }

    const r = await db.execute({
      sql: `SELECT * FROM code_findings
             WHERE ${where.join(' AND ')}
          ORDER BY severity ASC, last_seen DESC
             LIMIT 500`,
      args,
    });
    const findings = r.rows as unknown as FindingRow[];

    // Open counts for the header chips.
    const countsR = await db.execute({
      sql: `SELECT severity, COUNT(*) AS n
              FROM code_findings
             WHERE status = 'open'
          GROUP BY severity`,
      args: [],
    });
    const counts: OpenCounts = { P0: 0, P1: 0, P2: 0, P3: 0, total: 0 };
    for (const row of countsR.rows) {
      const sev = String(row.severity) as Severity;
      const n = Number(row.n);
      if (sev in counts) counts[sev] = n;
      counts.total += n;
    }

    // Latest run for the "last scan" header line.
    const lastRunR = await db.execute({
      sql: `SELECT * FROM code_health_runs ORDER BY run_at DESC LIMIT 1`,
      args: [],
    });
    const lastRun = (lastRunR.rows[0] as unknown as RunRow) ?? null;

    reply.render('admin/code-health', {
      findings: findings.map(viewRow),
      counts,
      lastRun: lastRun ? viewRun(lastRun) : null,
      query: q,
      currentStatus: status,
    });
  });

  // -- POST /:id/resolve ---------------------------------------------------
  app.post('/:id/resolve', async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isFinite(id)) {
      reply.code(400).send({ ok: false, error: 'bad id' });
      return;
    }
    await db.execute({
      sql: `UPDATE code_findings
               SET status = 'resolved',
                   resolved_at = datetime('now'),
                   resolved_commit = NULL
             WHERE id = ?`,
      args: [id],
    });
    reply.redirect('/admin/code-health');
  });

  // -- POST /:id/noise -----------------------------------------------------
  app.post('/:id/noise', async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    const user = (request as unknown as { user: SessionUser }).user;
    const body = (request.body ?? {}) as { reason?: string };
    if (!Number.isFinite(id)) {
      reply.code(400).send({ ok: false, error: 'bad id' });
      return;
    }
    await db.execute({
      sql: `UPDATE code_findings
               SET status = 'noise',
                   noise_marked_by = ?,
                   noise_reason = ?
             WHERE id = ?`,
      args: [user.email, body.reason ?? null, id],
    });
    reply.redirect('/admin/code-health');
  });

  // -- POST /:id/wontfix ---------------------------------------------------
  app.post('/:id/wontfix', async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isFinite(id)) {
      reply.code(400).send({ ok: false, error: 'bad id' });
      return;
    }
    await db.execute({
      sql: `UPDATE code_findings SET status = 'wontfix' WHERE id = ?`,
      args: [id],
    });
    reply.redirect('/admin/code-health');
  });

  // -- POST /run-now -------------------------------------------------------
  // Fires the scan synchronously and redirects back. The function maxes
  // out at the server's request timeout — usually fine for manual runs
  // because we keep the file cap modest. For a heavier scan, prefer the
  // cron path which has 300s.
  app.post('/run-now', async (_request, reply) => {
    try {
      const summary = await runScan({ trigger: 'manual' });
      reply.redirect(
        `/admin/code-health?notice=run-complete&new=${summary.findingsNew}&persisting=${summary.findingsPersisting}&resolved=${summary.findingsResolved}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      reply.redirect(`/admin/code-health?notice=run-failed&error=${encodeURIComponent(msg)}`);
    }
  });
};

// ---------------------------------------------------------------------------
// View helpers
// ---------------------------------------------------------------------------

function viewRow(f: FindingRow) {
  return {
    ...f,
    location: f.line_start ? `${f.file_path}:${f.line_start}` : f.file_path,
    sourceLabel: f.source.replace(/^static:/, '').replace(/^llm:/, 'AI '),
    severityClass: `sev-${f.severity.toLowerCase()}`,
    firstSeenShort: f.first_seen?.slice(0, 16) ?? '',
    lastSeenShort: f.last_seen?.slice(0, 16) ?? '',
  };
}

function viewRun(r: RunRow) {
  const ago = r.run_at ? timeAgo(r.run_at) : '—';
  const durationSec = r.duration_ms ? (r.duration_ms / 1000).toFixed(1) : null;
  return {
    ...r,
    ago,
    durationSec,
    costStr: r.cost_usd !== null ? `$${r.cost_usd.toFixed(3)}` : '—',
  };
}

function timeAgo(iso: string): string {
  // libsql returns 'YYYY-MM-DD HH:MM:SS' (UTC).
  const t = Date.parse(iso.replace(' ', 'T') + 'Z');
  if (!Number.isFinite(t)) return iso;
  const ms = Date.now() - t;
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} min ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)} h ago`;
  return `${Math.floor(ms / 86_400_000)} d ago`;
}
