/**
 * Conversation-tree loader for /admin/agents/conversations.
 *
 * Walks the agent_runs tree rooted at a given runId via parent_run_id,
 * fetches every agent_messages row and every agent_tool_calls row for
 * each run, and builds a recursive ConversationNode the chatroom view
 * renders top-to-bottom.
 *
 * One DB-side recursive CTE pulls every descendant in a single round
 * trip; messages and tool-calls then fetch in batches via IN (...) to
 * avoid N+1.
 */
import { db } from '../queries/base.js';

export type Role = 'system' | 'user' | 'assistant' | 'tool';

export interface ConversationRun {
  id: string;
  agent: string;
  parent_run_id: string | null;
  depth: number;
  trigger: string;
  channel: string;
  model: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  error: string | null;
}

export interface MessageEvent {
  type: 'message';
  step: number;
  role: Role;
  text: string;
  finishReason: string | null;
  createdAt: string;
}

export interface ToolCallEvent {
  type: 'tool-call';
  step: number;
  callId: string;
  toolName: string;
  /** Parsed input (one of zod-shaped tool args). */
  input: Record<string, unknown> | null;
  /** Parsed output (tool result). */
  output: Record<string, unknown> | null;
  error: string | null;
  durationMs: number | null;
  createdAt: string;
  /** When toolName === 'invokeAgent', the child run id is in output.runId. */
  childRunId?: string | null;
  /** Inlined for the recursive renderer. */
  child?: ConversationNode;
}

export type ConversationEvent = MessageEvent | ToolCallEvent;

export interface ConversationNode {
  run: ConversationRun;
  events: ConversationEvent[];
}

export interface ConversationIndexEntry {
  rootRunId: string;
  rootAgent: string;
  trigger: string;
  startedAt: string;
  endedAt: string | null;
  status: string;
  participants: number;
  totalMessages: number;
  totalCostUsd: number;
  // Number of agent_runs in this conversation including the root.
  runCount: number;
}

/**
 * Load the full conversation tree rooted at `rootRunId`. Returns null if
 * the root run doesn't exist.
 */
export async function loadConversationTree(rootRunId: string): Promise<ConversationNode | null> {
  // 1. Fetch every run in the tree via recursive CTE.
  let runs: ConversationRun[] = [];
  try {
    const r = await db.execute({
      sql: `
        WITH RECURSIVE tree(id) AS (
          SELECT id FROM agent_runs WHERE id = ?
          UNION ALL
          SELECT r.id FROM agent_runs r JOIN tree t ON r.parent_run_id = t.id
        )
        SELECT r.id, r.agent, r.parent_run_id, r.depth, r.trigger, r.channel,
               r.model, r.status, r.started_at, r.ended_at,
               r.input_tokens, r.output_tokens, r.cost_usd, r.error
          FROM agent_runs r
         WHERE r.id IN tree
      ORDER BY r.started_at ASC
        LIMIT 200`,
      args: [rootRunId],
    });
    runs = r.rows as unknown as ConversationRun[];
  } catch (err) {
    console.warn('[conversations] recursive query failed; falling back:', err);
    // Fallback: just root + immediate children.
    const root = await db.execute({ sql: `SELECT * FROM agent_runs WHERE id = ?`, args: [rootRunId] });
    const kids = await db.execute({ sql: `SELECT * FROM agent_runs WHERE parent_run_id = ?`, args: [rootRunId] });
    runs = [
      ...(root.rows as unknown as ConversationRun[]),
      ...(kids.rows as unknown as ConversationRun[]),
    ];
  }
  if (runs.length === 0) return null;

  const runIds = runs.map(r => r.id);

  // 2. Fetch all messages + tool calls for these runs.
  const placeholders = runIds.map(() => '?').join(',');
  const [msgsR, callsR] = await Promise.all([
    db.execute({
      sql: `SELECT run_id, step, role, parts, created_at
              FROM agent_messages
             WHERE run_id IN (${placeholders})
          ORDER BY run_id, step ASC, created_at ASC`,
      args: runIds,
    }),
    db.execute({
      sql: `SELECT run_id, call_id, step, tool_name, phase, input, output, error,
                   duration_ms, created_at
              FROM agent_tool_calls
             WHERE run_id IN (${placeholders})
          ORDER BY run_id, step ASC, created_at ASC`,
      args: runIds,
    }),
  ]);

  type MsgRow = { run_id: string; step: number; role: Role; parts: string; created_at: string };
  type CallRow = {
    run_id: string;
    call_id: string;
    step: number;
    tool_name: string;
    phase: 'start' | 'end' | 'error';
    input: string | null;
    output: string | null;
    error: string | null;
    duration_ms: number | null;
    created_at: string;
  };

  // 3. Group events by run_id.
  const eventsByRun = new Map<string, ConversationEvent[]>();
  for (const id of runIds) eventsByRun.set(id, []);

  for (const row of msgsR.rows as unknown as MsgRow[]) {
    const events = eventsByRun.get(row.run_id);
    if (!events) continue;
    let parts: { text?: string; finishReason?: string | null } = {};
    try { parts = JSON.parse(row.parts); } catch { /* ignore */ }
    if (!parts.text || !String(parts.text).trim()) continue; // skip empty assistant text
    events.push({
      type: 'message',
      step: row.step,
      role: row.role,
      text: String(parts.text),
      finishReason: parts.finishReason ?? null,
      createdAt: row.created_at,
    });
  }

  // Group tool-call rows by call_id and collapse to one event per call.
  const callsByRun = new Map<string, Map<string, CallRow[]>>();
  for (const id of runIds) callsByRun.set(id, new Map());
  for (const row of callsR.rows as unknown as CallRow[]) {
    const runMap = callsByRun.get(row.run_id);
    if (!runMap) continue;
    const list = runMap.get(row.call_id);
    if (list) list.push(row);
    else runMap.set(row.call_id, [row]);
  }
  for (const [runId, runMap] of callsByRun) {
    const events = eventsByRun.get(runId);
    if (!events) continue;
    for (const [, calls] of runMap) {
      const start = calls.find(c => c.phase === 'start') ?? calls[0];
      const end = calls.find(c => c.phase === 'end');
      const err = calls.find(c => c.phase === 'error');
      let input: Record<string, unknown> | null = null;
      let output: Record<string, unknown> | null = null;
      try { if (start?.input) input = JSON.parse(start.input); } catch { /* ignore */ }
      try { if (end?.output) output = JSON.parse(end.output); } catch { /* ignore */ }
      events.push({
        type: 'tool-call',
        step: start?.step ?? 0,
        callId: start?.call_id ?? '',
        toolName: start?.tool_name ?? '',
        input,
        output,
        error: err?.error ?? null,
        durationMs: end?.duration_ms ?? err?.duration_ms ?? null,
        createdAt: start?.created_at ?? '',
        childRunId:
          start?.tool_name === 'invokeAgent'
            ? typeof output?.runId === 'string'
              ? (output.runId as string)
              : null
            : undefined,
      });
    }
  }

  // 4. Sort each run's events by (step, createdAt).
  for (const events of eventsByRun.values()) {
    events.sort((a, b) => {
      if (a.step !== b.step) return a.step - b.step;
      return a.createdAt.localeCompare(b.createdAt);
    });
  }

  // 5. Build the recursive tree. We resolve invokeAgent → child node by
  //    looking up runs[].parent_run_id, which gives us the canonical link
  //    (output.runId from agent_tool_calls is a soft reference — trust the
  //    runs table, not the JSON).
  const runById = new Map<string, ConversationRun>();
  for (const r of runs) runById.set(r.id, r);

  const childByParent = new Map<string, ConversationRun[]>();
  for (const r of runs) {
    if (r.parent_run_id) {
      const list = childByParent.get(r.parent_run_id);
      if (list) list.push(r);
      else childByParent.set(r.parent_run_id, [r]);
    }
  }

  function buildNode(run: ConversationRun): ConversationNode {
    const events = eventsByRun.get(run.id) ?? [];
    const children = (childByParent.get(run.id) ?? [])
      .slice()
      .sort((a, b) => a.started_at.localeCompare(b.started_at));
    // Walk events; when we hit an invokeAgent tool-call, attach the
    // matching child node (by child runId), then remove from `children`
    // so the order matches the runtime.
    const remaining = new Map<string, ConversationRun>();
    for (const c of children) remaining.set(c.id, c);
    for (const ev of events) {
      if (ev.type === 'tool-call' && ev.toolName === 'invokeAgent') {
        const childRunId = ev.childRunId;
        if (childRunId && remaining.has(childRunId)) {
          const childRun = remaining.get(childRunId)!;
          ev.child = buildNode(childRun);
          remaining.delete(childRunId);
        }
      }
    }
    return { run, events };
  }

  const root = runById.get(rootRunId);
  if (!root) return null;
  return buildNode(root);
}

/**
 * The conversations index — recent multi-agent runs (depth=0 roots that
 * actually delegated). Each row is one conversation; the chatroom view
 * is one click away.
 *
 * Single agent_runs runs with no children are excluded — they're already
 * visible on /admin/agents/run/:id and don't tell a "communication" story.
 */
export async function listConversations(opts: {
  limit?: number;
  sinceDays?: number;
  agent?: string | null;
}): Promise<ConversationIndexEntry[]> {
  const limit = opts.limit ?? 50;
  const sinceDays = opts.sinceDays ?? 7;
  const filterAgent = opts.agent ?? null;

  // Roots are runs with parent_run_id IS NULL and at least one child.
  // We compute "participants" and totals via a single grouped query.
  try {
    const args: (string | number)[] = [sinceDays];
    let agentFilter = '';
    if (filterAgent) {
      agentFilter = 'AND root.agent = ?';
      args.push(filterAgent);
    }
    args.push(limit);

    const r = await db.execute({
      sql: `
        WITH RECURSIVE tree(root_id, run_id) AS (
          SELECT id, id FROM agent_runs
           WHERE parent_run_id IS NULL
             AND started_at >= datetime('now', '-' || ? || ' days')
          UNION ALL
          SELECT t.root_id, r.id
            FROM agent_runs r
            JOIN tree t ON r.parent_run_id = t.run_id
        ),
        rolled AS (
          SELECT t.root_id,
                 COUNT(DISTINCT r.agent)         AS participants,
                 COUNT(*)                         AS run_count,
                 COALESCE(SUM(r.cost_usd), 0)     AS total_cost
            FROM tree t
            JOIN agent_runs r ON r.id = t.run_id
        GROUP BY t.root_id
        )
        SELECT root.id           AS root_run_id,
               root.agent        AS root_agent,
               root.trigger      AS trigger,
               root.started_at   AS started_at,
               root.ended_at     AS ended_at,
               root.status       AS status,
               rl.participants   AS participants,
               rl.run_count      AS run_count,
               rl.total_cost     AS total_cost,
               (SELECT COUNT(*) FROM agent_messages m
                  JOIN tree tt ON tt.root_id = root.id AND tt.run_id = m.run_id
                ) AS total_messages
          FROM rolled rl
          JOIN agent_runs root ON root.id = rl.root_id
         WHERE rl.run_count > 1
           ${agentFilter}
      ORDER BY root.started_at DESC
         LIMIT ?`,
      args,
    });

    return (r.rows as unknown as {
      root_run_id: string;
      root_agent: string;
      trigger: string;
      started_at: string;
      ended_at: string | null;
      status: string;
      participants: number;
      run_count: number;
      total_cost: number;
      total_messages: number;
    }[]).map(row => ({
      rootRunId: row.root_run_id,
      rootAgent: row.root_agent,
      trigger: row.trigger,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      status: row.status,
      participants: Number(row.participants),
      totalMessages: Number(row.total_messages),
      totalCostUsd: Number(row.total_cost),
      runCount: Number(row.run_count),
    }));
  } catch (err) {
    console.warn('[conversations] listConversations failed:', err);
    return [];
  }
}

/**
 * Build the agent communication graph: nodes are agents, edges are
 * `(caller → callee)` pairs with call counts in the window. The view
 * renders this as an SVG node-graph.
 */
export interface GraphNode {
  agent: string;
  totalRuns: number;
}
export interface GraphEdge {
  from: string;
  to: string;
  callCount: number;
  totalCostUsd: number;
}
export interface CommunicationGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  sinceDays: number;
}

export async function loadCommunicationGraph(sinceDays = 30): Promise<CommunicationGraph> {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  try {
    const runs = await db.execute({
      sql: `SELECT agent, COUNT(*) AS n
              FROM agent_runs
             WHERE started_at >= datetime('now', '-' || ? || ' days')
          GROUP BY agent`,
      args: [sinceDays],
    });
    for (const row of runs.rows as unknown as { agent: string; n: number }[]) {
      nodes.push({ agent: row.agent, totalRuns: Number(row.n) });
    }

    // Edges = invokeAgent tool calls. The caller is the run's agent;
    // the callee is in the tool call input.agentName.
    const calls = await db.execute({
      sql: `SELECT r.agent AS caller, t.input, t.output, r.id AS run_id
              FROM agent_tool_calls t
              JOIN agent_runs r ON r.id = t.run_id
             WHERE t.tool_name = 'invokeAgent'
               AND t.phase = 'start'
               AND t.created_at >= datetime('now', '-' || ? || ' days')`,
      args: [sinceDays],
    });
    type CRow = { caller: string; input: string | null; output: string | null; run_id: string };
    const edgeMap = new Map<string, GraphEdge>();
    for (const row of calls.rows as unknown as CRow[]) {
      let callee: string | null = null;
      try {
        if (row.input) {
          const parsed = JSON.parse(row.input) as { agentName?: string };
          callee = parsed.agentName ?? null;
        }
      } catch { /* ignore */ }
      if (!callee) continue;
      const key = `${row.caller}::${callee}`;
      const existing = edgeMap.get(key);
      if (existing) {
        existing.callCount += 1;
      } else {
        edgeMap.set(key, { from: row.caller, to: callee, callCount: 1, totalCostUsd: 0 });
      }
    }
    // Pull child-run cost for each edge by joining tree depth=1 runs.
    const childCosts = await db.execute({
      sql: `SELECT parent.agent AS caller, child.agent AS callee,
                   COALESCE(SUM(child.cost_usd), 0) AS total_cost
              FROM agent_runs child
              JOIN agent_runs parent ON parent.id = child.parent_run_id
             WHERE child.started_at >= datetime('now', '-' || ? || ' days')
          GROUP BY parent.agent, child.agent`,
      args: [sinceDays],
    });
    for (const row of childCosts.rows as unknown as { caller: string; callee: string; total_cost: number }[]) {
      const e = edgeMap.get(`${row.caller}::${row.callee}`);
      if (e) e.totalCostUsd = Number(row.total_cost);
    }
    edges.push(...edgeMap.values());
    edges.sort((a, b) => b.callCount - a.callCount);
  } catch (err) {
    console.warn('[conversations] loadCommunicationGraph failed:', err);
  }
  return { nodes, edges, sinceDays };
}

// ---------------------------------------------------------------------------
// Stable colour assignment per agent — used by the view to give each
// agent a consistent badge colour across the chatroom.
// ---------------------------------------------------------------------------

const PALETTE = [
  '#22C55E', // vendo green
  '#93C5FD', // sky-300
  '#FCD34D', // amber-300
  '#C4B5FD', // violet-300
  '#FCA5A5', // red-300
  '#5EEAD4', // teal-300
  '#FDBA74', // orange-300
  '#F0ABFC', // fuchsia-300
  '#A7F3D0', // emerald-200
  '#BAE6FD', // sky-200
  '#FDE68A', // amber-200
  '#DDD6FE', // violet-200
];

export function colourForAgent(agent: string): string {
  // Deterministic by name: stable across page loads.
  let hash = 0;
  for (let i = 0; i < agent.length; i++) {
    hash = (hash * 31 + agent.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
