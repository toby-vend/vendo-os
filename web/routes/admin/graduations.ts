/**
 * /admin/graduations — agent × write-tool matrix.
 *
 * Each cell is one of three states:
 *   1. agent does not declare the tool   → "n/a"
 *   2. tool declared, no graduation row  → "Grant" form
 *   3. graduation row present            → audit fields + "Revoke" form
 *
 * Granting writes a row to agent_graduations. The runtime's defineTool
 * gate (web/lib/agents/tools/_tool.ts:148-159) reads loadGraduations() per
 * run and lifts the dry-run coercion accordingly — so a graduation here
 * takes effect on the next run, no restart required.
 *
 * Admin-only. Server-level guard (web/server.ts:227-230) redirects
 * non-admins away from /admin/* before this handler is reached.
 */
import type { FastifyPluginAsync } from 'fastify';
import {
  listGraduations,
  graduate,
  revokeGraduation,
} from '../../lib/agents/permissions.js';
import { listAgents, getAgent } from '../../lib/agents/agents/index.js';
import { WRITE_TOOL_NAMES } from '../../lib/agents/tools/index.js';
import type { SessionUser } from '../../lib/auth.js';

interface MatrixCell {
  state: 'n/a' | 'ungraduated' | 'graduated';
  graduatedAt?: string;
  graduatedBy?: string;
  notes?: string | null;
}

export const adminGraduationsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const q = (request.query ?? {}) as Record<string, string>;
    const rows = await listGraduations();
    const grad = new Map<string, (typeof rows)[number]>();
    for (const r of rows) grad.set(`${r.agent}:${r.toolName}`, r);

    const agents = listAgents();
    const matrix: { agent: string; cells: { tool: string; cell: MatrixCell }[] }[] = [];
    for (const agentName of agents) {
      const def = getAgent(agentName);
      if (!def) continue;
      const declared = new Set(def.tools);
      const cells = WRITE_TOOL_NAMES.map((tool) => {
        if (!declared.has(tool)) {
          return { tool, cell: { state: 'n/a' as const } };
        }
        const row = grad.get(`${agentName}:${tool}`);
        if (!row) {
          return { tool, cell: { state: 'ungraduated' as const } };
        }
        return {
          tool,
          cell: {
            state: 'graduated' as const,
            graduatedAt: row.graduatedAt,
            graduatedBy: row.graduatedBy,
            notes: row.notes,
          },
        };
      });
      matrix.push({ agent: agentName, cells });
    }

    reply.render('admin/graduations', {
      matrix,
      writeTools: [...WRITE_TOOL_NAMES],
      query: q,
    });
  });

  app.post('/grant', async (request, reply) => {
    const user = (request as unknown as { user: SessionUser }).user;
    const body = (request.body ?? {}) as { agent?: string; toolName?: string; notes?: string };
    const { agent, toolName, notes } = body;

    if (!agent || !toolName) {
      reply.code(400).send({ ok: false, error: 'missing agent or toolName' });
      return;
    }

    // Defensive: only allow declared write tools and registered agents.
    const writeTools = new Set<string>(WRITE_TOOL_NAMES);
    if (!writeTools.has(toolName)) {
      reply.code(400).send({ ok: false, error: 'unknown write tool' });
      return;
    }
    const def = getAgent(agent);
    if (!def) {
      reply.code(400).send({ ok: false, error: 'unknown agent' });
      return;
    }
    if (!def.tools.includes(toolName)) {
      reply.code(400).send({ ok: false, error: 'agent does not declare this tool' });
      return;
    }

    await graduate({
      agent,
      toolName,
      graduatedBy: user.email,
      notes: notes && notes.trim().length > 0 ? notes.trim() : undefined,
    });

    reply.redirect(`/admin/graduations?notice=granted&pair=${encodeURIComponent(`${agent}:${toolName}`)}`);
  });

  app.post('/revoke', async (request, reply) => {
    const body = (request.body ?? {}) as { agent?: string; toolName?: string };
    const { agent, toolName } = body;

    if (!agent || !toolName) {
      reply.code(400).send({ ok: false, error: 'missing agent or toolName' });
      return;
    }

    await revokeGraduation(agent, toolName);

    reply.redirect(`/admin/graduations?notice=revoked&pair=${encodeURIComponent(`${agent}:${toolName}`)}`);
  });

  /**
   * Bulk grant — accepts an array of "agent:tool" pairs from the matrix
   * checkbox column. Optional shared notes apply to every grant in the
   * batch. Skips pairs that are already graduated, unknown agents,
   * unknown write tools, or agents that don't declare the tool — those
   * are reported back in the redirect notice for transparency.
   */
  app.post('/bulk-grant', async (request, reply) => {
    const user = (request as unknown as { user: SessionUser }).user;
    const body = (request.body ?? {}) as { pairs?: string | string[]; notes?: string };
    const rawPairs = body.pairs;
    const pairs: string[] = Array.isArray(rawPairs)
      ? rawPairs
      : rawPairs
        ? [rawPairs]
        : [];

    if (pairs.length === 0) {
      reply.redirect('/admin/graduations?notice=bulk-none');
      return;
    }

    const writeTools = new Set<string>(WRITE_TOOL_NAMES);
    const sharedNotes = body.notes && body.notes.trim().length > 0 ? body.notes.trim() : undefined;

    // Pre-load current graduations so we skip already-granted pairs
    // (idempotent, but avoids touching graduated_at / graduated_by on
    // rows the admin didn't actively re-grant).
    const existing = await listGraduations();
    const existingKeys = new Set(existing.map((g) => `${g.agent}:${g.toolName}`));

    let granted = 0;
    let skipped = 0;
    for (const raw of pairs) {
      const [agent, toolName] = String(raw).split(':');
      if (!agent || !toolName) { skipped++; continue; }
      if (existingKeys.has(`${agent}:${toolName}`)) { skipped++; continue; }
      if (!writeTools.has(toolName)) { skipped++; continue; }
      const def = getAgent(agent);
      if (!def) { skipped++; continue; }
      if (!def.tools.includes(toolName)) { skipped++; continue; }

      await graduate({
        agent,
        toolName,
        graduatedBy: user.email,
        notes: sharedNotes,
      });
      granted++;
    }

    const params = new URLSearchParams({
      notice: 'bulk-granted',
      granted: String(granted),
      skipped: String(skipped),
    });
    reply.redirect(`/admin/graduations?${params.toString()}`);
  });
};
