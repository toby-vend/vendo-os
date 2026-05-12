/**
 * /admin/agents/:name      Per-agent detail page (system prompt + tools +
 *                          recent runs + 24h stats).
 *
 * /admin/agents/run/:runId Run-tree transcript — agent_messages timeline
 *                          plus recursively-fetched child runs (any
 *                          invokeAgent descendants).
 *
 * Admin-only via server.ts /admin/* gate. Read-only.
 *
 * The system prompt is rendered against a synthetic preview ctx so what
 * an admin sees matches what the agent sees at runtime — same date, same
 * user identity. graduations are loaded for the agent so the tools
 * column can show which write-tool calls actually execute.
 */
import type { FastifyPluginAsync } from 'fastify';
import { db } from '../../lib/queries/base.js';
import { getAgent, listAgents, SPECIALIST_AGENTS } from '../../lib/agents/agents/index.js';
import { TOOL_FACTORIES, WRITE_TOOL_NAMES } from '../../lib/agents/tools/index.js';
import { loadGraduations } from '../../lib/agents/permissions.js';
import type { ToolCtx } from '../../lib/agents/types.js';
import type { SessionUser } from '../../lib/auth.js';
import { formatGbp } from '../../lib/format/currency.js';

interface AgentRunRow {
  id: string;
  agent: string;
  user_id: string;
  channel: string;
  conversation_id: string | null;
  trigger: string;
  model: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  error: string | null;
  parent_run_id: string | null;
  depth: number;
}

interface AgentMessageRow {
  id: string;
  run_id: string;
  step: number;
  role: 'system' | 'user' | 'assistant' | 'tool';
  parts: string;
  created_at: string;
}

export const adminAgentsDetailRoutes: FastifyPluginAsync = async (app) => {
  // -- /admin/agents/run/:runId — declared first so it doesn't collide with
  //    /admin/agents/:name (Fastify routes literal segments before params).
  app.get('/run/:runId', async (request, reply) => {
    const runId = String((request.params as { runId: string }).runId);

    const root = await loadRun(runId);
    if (!root) {
      reply.code(404).send('run not found');
      return;
    }

    const tree = await loadRunTree(runId);
    const messages = await loadMessages(runId);

    reply.render('admin/agent-run', {
      root: viewRun(root),
      tree: tree.map(viewRun),
      messages: messages.map(viewMessage),
    });
  });

  // -- /admin/agents/:name -----------------------------------------------
  app.get('/:name', async (request, reply) => {
    const user = (request as unknown as { user: SessionUser }).user;
    const name = String((request.params as { name: string }).name);
    const def = getAgent(name);
    if (!def) {
      reply.code(404).send('agent not found');
      return;
    }

    const [graduations, recentRuns, stats] = await Promise.all([
      loadGraduations(name),
      loadRecentRunsForAgent(name, 50),
      load24hAgentStats(name),
    ]);

    // Render the system prompt against a preview ctx so the admin sees
    // exactly what the agent sees at runtime.
    const previewCtx: ToolCtx = {
      runId: 'preview',
      agent: name,
      user,
      channel: 'web',
      conversationId: null,
      graduations,
      depth: 0,
      parentRunId: null,
    };
    let systemPrompt: string;
    try {
      systemPrompt = def.systemPrompt(previewCtx);
    } catch (err) {
      systemPrompt = `[failed to render system prompt: ${err instanceof Error ? err.message : String(err)}]`;
    }

    const writeTools = new Set<string>(WRITE_TOOL_NAMES);
    const tools = def.tools.map((tn) => ({
      name: tn,
      registered: tn in TOOL_FACTORIES,
      isWrite: writeTools.has(tn),
      graduated: graduations.has(tn),
    }));

    reply.render('admin/agents-detail', {
      def: {
        name,
        model: def.model,
        maxSteps: def.maxSteps ?? 8,
        tier: classifyTier(name),
      },
      systemPrompt,
      tools,
      recentRuns: recentRuns.map(viewRun),
      stats: { ...stats, costDisplay: formatGbp(stats.cost, 3) },
    });
  });
};

// ---------------------------------------------------------------------------
// Data loaders
// ---------------------------------------------------------------------------

async function loadRun(runId: string): Promise<AgentRunRow | null> {
  const r = await db.execute({
    sql: `SELECT * FROM agent_runs WHERE id = ?`,
    args: [runId],
  });
  const row = r.rows[0];
  return row ? (row as unknown as AgentRunRow) : null;
}

/**
 * Walk the run tree starting at runId. Uses WITH RECURSIVE — libsql
 * supports it. Capped at 200 rows defensively.
 *
 * Returns the root row plus every descendant, ordered by depth-then-time
 * so the view can render an indented tree.
 */
async function loadRunTree(runId: string): Promise<AgentRunRow[]> {
  try {
    const r = await db.execute({
      sql: `
        WITH RECURSIVE run_tree(id, agent, user_id, channel, conversation_id,
                                trigger, model, status, started_at, ended_at,
                                input_tokens, output_tokens, cost_usd, error,
                                parent_run_id, depth, level) AS (
          SELECT id, agent, user_id, channel, conversation_id,
                 trigger, model, status, started_at, ended_at,
                 input_tokens, output_tokens, cost_usd, error,
                 parent_run_id, depth, 0 AS level
            FROM agent_runs
           WHERE id = ?
          UNION ALL
          SELECT r.id, r.agent, r.user_id, r.channel, r.conversation_id,
                 r.trigger, r.model, r.status, r.started_at, r.ended_at,
                 r.input_tokens, r.output_tokens, r.cost_usd, r.error,
                 r.parent_run_id, r.depth, t.level + 1
            FROM agent_runs r
            JOIN run_tree t ON r.parent_run_id = t.id
        )
        SELECT * FROM run_tree
         ORDER BY level, started_at
         LIMIT 200`,
      args: [runId],
    });
    return r.rows as unknown as AgentRunRow[];
  } catch (err) {
    console.warn('[admin/agents-detail] run-tree query failed, falling back to flat:', err);
    // Fallback: just the root + immediate children.
    const root = await loadRun(runId);
    const kids = await db.execute({
      sql: `SELECT * FROM agent_runs WHERE parent_run_id = ? ORDER BY started_at`,
      args: [runId],
    });
    return [
      ...(root ? [root] : []),
      ...((kids.rows as unknown as AgentRunRow[]) ?? []),
    ];
  }
}

async function loadMessages(runId: string): Promise<AgentMessageRow[]> {
  const r = await db.execute({
    sql: `SELECT id, run_id, step, role, parts, created_at
            FROM agent_messages
           WHERE run_id = ?
        ORDER BY step ASC, created_at ASC`,
    args: [runId],
  });
  return r.rows as unknown as AgentMessageRow[];
}

async function loadRecentRunsForAgent(name: string, limit: number): Promise<AgentRunRow[]> {
  try {
    const r = await db.execute({
      sql: `SELECT * FROM agent_runs
             WHERE agent = ?
          ORDER BY started_at DESC
             LIMIT ?`,
      args: [name, limit],
    });
    return r.rows as unknown as AgentRunRow[];
  } catch {
    return [];
  }
}

async function load24hAgentStats(name: string): Promise<{
  runs: number;
  errors: number;
  cost: number;
  avgDurationSec: number | null;
}> {
  try {
    const r = await db.execute({
      sql: `SELECT
              COUNT(*) AS runs,
              COALESCE(SUM(CASE WHEN status = 'errored' THEN 1 ELSE 0 END), 0) AS errors,
              COALESCE(SUM(cost_usd), 0) AS cost,
              AVG(
                CASE WHEN started_at IS NOT NULL AND ended_at IS NOT NULL
                     THEN (julianday(ended_at) - julianday(started_at)) * 86400
                     ELSE NULL END
              ) AS avg_dur_s
            FROM agent_runs
            WHERE agent = ?
              AND started_at >= datetime('now', '-1 day')`,
      args: [name],
    });
    const row = r.rows[0] as unknown as {
      runs: number;
      errors: number;
      cost: number;
      avg_dur_s: number | null;
    } | undefined;
    return {
      runs: Number(row?.runs ?? 0),
      errors: Number(row?.errors ?? 0),
      cost: Number(row?.cost ?? 0),
      avgDurationSec: row?.avg_dur_s != null ? Number(row.avg_dur_s) : null,
    };
  } catch {
    return { runs: 0, errors: 0, cost: 0, avgDurationSec: null };
  }
}

// ---------------------------------------------------------------------------
// View helpers
// ---------------------------------------------------------------------------

function classifyTier(name: string): 'admin' | 'standard' | 'specialist' | 'cron' {
  if (SPECIALIST_AGENTS.has(name)) return 'specialist';
  if (name === 'atlas-brief' || name === 'atlas-monitor') return 'cron';
  if (name === 'atlas-staff') return 'standard';
  return 'admin';
}

function viewRun(r: AgentRunRow) {
  let durationSec: number | null = null;
  if (r.started_at && r.ended_at) {
    const a = Date.parse(r.started_at.replace(' ', 'T') + 'Z');
    const b = Date.parse(r.ended_at.replace(' ', 'T') + 'Z');
    if (Number.isFinite(a) && Number.isFinite(b)) {
      durationSec = (b - a) / 1000;
    }
  }
  return {
    ...r,
    startedShort: r.started_at?.slice(0, 16) ?? '',
    startedAgo: r.started_at ? timeAgo(r.started_at) : '',
    durationSec: durationSec !== null ? durationSec.toFixed(1) : null,
    cost: formatGbp(r.cost_usd, 4),
    statusClass: r.status === 'errored' ? 'run-error' : r.status === 'running' ? 'run-running' : 'run-ok',
    // Indentation cue for the tree view — depth is also a property so the
    // template can prefix the agent name with ↳ characters.
    indent: '  '.repeat(Math.min(r.depth ?? 0, 5)),
  };
}

function viewMessage(m: AgentMessageRow) {
  let parts: { text?: string; toolCalls?: unknown[]; finishReason?: string | null } = {};
  try {
    parts = JSON.parse(m.parts);
  } catch {
    // ignore
  }
  return {
    ...m,
    text: parts.text ?? '',
    toolCalls: Array.isArray(parts.toolCalls) ? parts.toolCalls : [],
    finishReason: parts.finishReason ?? null,
  };
}

function timeAgo(iso: string): string {
  const t = Date.parse(iso.replace(' ', 'T') + 'Z');
  if (!Number.isFinite(t)) return iso;
  const ms = Date.now() - t;
  if (ms < 0) return 'in future';
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} min ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)} h ago`;
  return `${Math.floor(ms / 86_400_000)} d ago`;
}

// Silence unused-import warning when listAgents isn't referenced.
void listAgents;
