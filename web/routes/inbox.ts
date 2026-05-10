/**
 * /inbox — central triage surface for all pending agent recommendations.
 *
 * Lists every pending recommendation across every agent (atlas, atlas-staff,
 * atlas-monitor, atlas-brief …) with Approve / Edit / Reject buttons. The
 * decide action mirrors api/agent/approve.ts — graduation-bypassed single
 * re-run of the underlying tool in execute mode, then markExecuted.
 *
 * Admin-only via the existing route-slug whitelist (standard users hit the
 * per-user-allowed-routes check in web/server.ts and are 403'd unless
 * explicitly granted).
 */
import type { FastifyPluginAsync } from 'fastify';
import { db } from '../lib/queries/base.js';
import { getById, decide, markExecuted } from '../lib/agents/recommendations.js';
import { TOOL_FACTORIES, type ToolName } from '../lib/agents/tools/index.js';
import type { ToolCtx, ChannelName, RecommendationRow } from '../lib/agents/types.js';
import type { SessionUser } from '../lib/auth.js';

interface PendingRow extends RecommendationRow {
  user_email: string | null;
  user_name: string | null;
}

export const inboxRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const user = (request as unknown as { user: SessionUser }).user;

    const q = (request.query ?? {}) as Record<string, string>;
    const status = (q.status as 'pending' | 'all' | 'approved' | 'rejected' | 'edited') || 'pending';
    const filter = q.filter || '';
    const limit = 50;

    const where: string[] = [];
    const args: (string | number)[] = [];

    if (status === 'pending' || status === 'approved' || status === 'rejected' || status === 'edited') {
      where.push('r.status = ?');
      args.push(status);
    }
    if (filter === 'mine') {
      where.push('r.user_id = ?');
      args.push(user.id);
    }
    if (q.agent) {
      where.push('r.agent = ?');
      args.push(q.agent);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const result = await db.execute({
      sql: `SELECT r.*,
                   u.email as user_email,
                   u.name  as user_name
              FROM agent_recommendations r
              LEFT JOIN users u ON r.user_id = u.id
              ${whereSql}
              ORDER BY r.created_at DESC
              LIMIT ?`,
      args: [...args, limit],
    });
    const recs = result.rows as unknown as PendingRow[];

    // Quick summary counts grouped by status (for the filter chips).
    const counts = await db.execute({
      sql: `SELECT status, COUNT(*) as n FROM agent_recommendations GROUP BY status`,
      args: [],
    });
    const byStatus: Record<string, number> = {};
    for (const row of counts.rows) {
      byStatus[String(row.status)] = Number(row.n);
    }

    // The Eta layout already gets `user` injected via server.ts decorator.
    reply.render('inbox', {
      recs: recs.map(rowToView),
      total: recs.length,
      byStatus,
      query: q,
      currentStatus: status,
      currentFilter: filter,
    });
  });

  // POST /:recId/decide — body: { decision: 'approved' | 'rejected' | 'edited' }
  app.post('/:recId/decide', async (request, reply) => {
    const user = (request as unknown as { user: SessionUser }).user;
    const { recId } = request.params as { recId: string };
    const body = (request.body ?? {}) as { decision?: string };
    const decision = body.decision as 'approved' | 'rejected' | 'edited' | undefined;

    if (!decision || !['approved', 'rejected', 'edited'].includes(decision)) {
      reply.code(400).send({ ok: false, error: 'invalid decision' });
      return;
    }

    const rec = await getById(recId);
    if (!rec) {
      reply.code(404).send({ ok: false, error: 'recommendation not found' });
      return;
    }
    if (rec.status !== 'pending') {
      // Idempotent — already decided; just bounce back to inbox.
      reply.redirect('/inbox?notice=already-' + rec.status);
      return;
    }
    if (rec.user_id !== user.id && user.role !== 'admin') {
      reply.code(403).send({ ok: false, error: 'not your recommendation' });
      return;
    }

    const updated = await decide({ id: recId, decidedBy: user.id, decision });
    if (!updated) {
      reply.code(500).send({ ok: false, error: 'decide() returned no row' });
      return;
    }

    if (decision === 'rejected' || decision === 'edited') {
      reply.redirect('/inbox?notice=' + decision);
      return;
    }

    // approved → re-run the tool in execute mode, mirror api/agent/approve.ts
    const factory = TOOL_FACTORIES[rec.tool_name as ToolName];
    if (!factory) {
      reply.redirect('/inbox?notice=unknown-tool');
      return;
    }
    const ctx: ToolCtx = {
      runId: rec.run_id,
      agent: rec.agent,
      user,
      channel: 'web' as ChannelName,
      conversationId: null,
      graduations: new Set([rec.tool_name]),
    };
    const tool = factory(ctx);
    if (!tool.execute) {
      reply.redirect('/inbox?notice=no-execute');
      return;
    }
    const originalPayload = JSON.parse(rec.payload) as Record<string, unknown>;
    const finalInput = { ...originalPayload, mode: 'execute' };

    let result: unknown;
    try {
      result = await tool.execute(finalInput as never, { toolCallId: `inbox-${rec.id}`, messages: [] });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      reply.redirect('/inbox?notice=error&detail=' + encodeURIComponent(message));
      return;
    }

    await markExecuted(rec.id, result);

    // If the tool returned its own internal error, surface that.
    const toolError = (result && typeof result === 'object' && (result as Record<string, unknown>).error)
      ? String((result as Record<string, unknown>).error)
      : null;
    reply.redirect(toolError
      ? '/inbox?notice=tool-error&detail=' + encodeURIComponent(toolError)
      : '/inbox?notice=approved');
  });
};

function rowToView(rec: PendingRow) {
  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(rec.payload) as Record<string, unknown>; } catch { /* */ }
  let executeResult: Record<string, unknown> | null = null;
  if (rec.execute_result) {
    try { executeResult = JSON.parse(rec.execute_result) as Record<string, unknown>; } catch { /* */ }
  }
  return {
    id: rec.id,
    agent: rec.agent,
    toolName: rec.tool_name,
    title: rec.title,
    reasoning: rec.reasoning,
    status: rec.status,
    userEmail: rec.user_email,
    userName: rec.user_name,
    createdAt: rec.created_at,
    decidedAt: rec.decided_at,
    decidedBy: rec.decided_by,
    executedAt: rec.executed_at,
    payload,
    executeResult,
    toolError: executeResult && typeof executeResult.error === 'string' ? executeResult.error : null,
  };
}
