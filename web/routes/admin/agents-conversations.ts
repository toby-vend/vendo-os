/**
 * /admin/agents/conversations           — index of recent multi-agent runs
 * /admin/agents/conversations/:rootId   — chatroom view of one conversation
 * /admin/agents/graph                   — communication graph (nodes + edges)
 *
 * The chatroom HTML is rendered server-side (see conversation-render.ts)
 * because the tree is bounded and recursive Eta partials add no value
 * here. Filters on the chatroom view are CSS toggles on the client.
 *
 * Admin-only via the server.ts /admin/* gate.
 */
import type { FastifyPluginAsync } from 'fastify';
import {
  loadConversationTree,
  listConversations,
  loadCommunicationGraph,
  colourForAgent,
  type ConversationIndexEntry,
} from '../../lib/agents/conversations.js';
import { renderConversationHtml } from '../../lib/agents/conversation-render.js';
import { formatGbp } from '../../lib/format/currency.js';

export const adminAgentsConversationsRoutes: FastifyPluginAsync = async (app) => {
  // -- /admin/agents/conversations ---------------------------------------
  app.get('/', async (request, reply) => {
    const q = (request.query ?? {}) as Record<string, string>;
    const agent = q.agent || null;
    const sinceDays = numOrDefault(q.since_days, 7);

    const rows = await listConversations({ sinceDays, agent, limit: 50 });

    reply.render('admin/agents-conversations', {
      rows: rows.map(viewIndexRow),
      filter: { agent: agent ?? '', sinceDays },
    });
  });

  // -- /admin/agents/conversations/:rootId -------------------------------
  app.get('/:rootId', async (request, reply) => {
    const rootId = String((request.params as { rootId: string }).rootId);
    const root = await loadConversationTree(rootId);
    if (!root) {
      reply.code(404).send('conversation not found');
      return;
    }
    const html = renderConversationHtml(root);

    // Build participant list for the colour legend.
    type Node = NonNullable<typeof root>;
    const participants = new Set<string>();
    function walk(node: Node): void {
      participants.add(node.run.agent);
      for (const ev of node.events) {
        if (ev.type === 'tool-call' && ev.toolName === 'invokeAgent' && ev.child) {
          walk(ev.child);
        }
      }
    }
    walk(root);
    const legend = Array.from(participants).sort().map(a => ({
      agent: a,
      colour: colourForAgent(a),
    }));

    reply.render('admin/agents-conversation', {
      root: {
        id: root.run.id,
        agent: root.run.agent,
        trigger: root.run.trigger,
        startedAt: root.run.started_at,
        status: root.run.status,
      },
      legend,
      conversationHtml: html,
    });
  });
};

// Mounted separately because it lives at /admin/agents/graph (sibling, not child of conversations).
export const adminAgentsGraphRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const q = (request.query ?? {}) as Record<string, string>;
    const sinceDays = numOrDefault(q.since_days, 30);

    const graph = await loadCommunicationGraph(sinceDays);

    // Layout: simple circular arrangement so we don't bring in a layout lib.
    // Agents who never participate sit at the bottom in a footer.
    const active = graph.nodes
      .filter(n =>
        graph.edges.some(e => e.from === n.agent || e.to === n.agent),
      )
      .sort((a, b) => a.agent.localeCompare(b.agent));
    const layout = circleLayout(active.map(n => n.agent), 380, 240, 200);

    const maxCalls = graph.edges.reduce((m, e) => Math.max(m, e.callCount), 1);
    const edgesView = graph.edges.map(e => ({
      from: e.from,
      to: e.to,
      callCount: e.callCount,
      costDisplay: formatGbp(e.totalCostUsd, 3),
      // Thickness: 1-6px scaled to max.
      stroke: 1 + (5 * e.callCount) / maxCalls,
      fromPos: layout[e.from],
      toPos: layout[e.to],
    })).filter(e => e.fromPos && e.toPos);

    const nodesView = active.map(n => ({
      agent: n.agent,
      runs: n.totalRuns,
      colour: colourForAgent(n.agent),
      pos: layout[n.agent],
    }));

    reply.render('admin/agents-graph', {
      nodes: nodesView,
      edges: edgesView,
      sinceDays,
      hasData: edgesView.length > 0,
    });
  });
};

// ---------------------------------------------------------------------------
// View helpers
// ---------------------------------------------------------------------------

function viewIndexRow(r: ConversationIndexEntry) {
  return {
    ...r,
    startedShort: r.startedAt?.slice(0, 16) ?? '',
    ago: timeAgo(r.startedAt),
    costDisplay: formatGbp(r.totalCostUsd, 3),
    statusClass: r.status === 'errored' ? 'sev-error' : r.status === 'running' ? 'sev-running' : 'sev-ok',
  };
}

function timeAgo(iso: string): string {
  if (!iso) return '';
  const t = Date.parse(iso.replace(' ', 'T') + 'Z');
  if (!Number.isFinite(t)) return iso;
  const ms = Date.now() - t;
  if (ms < 0) return 'in future';
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} min ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)} h ago`;
  return `${Math.floor(ms / 86_400_000)} d ago`;
}

function numOrDefault(s: string | undefined, dflt: number): number {
  if (!s) return dflt;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : dflt;
}

/** Place agents around a circle for the graph view. */
function circleLayout(
  names: string[],
  cx: number,
  cy: number,
  radius: number,
): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  const n = names.length || 1;
  for (let i = 0; i < names.length; i++) {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    out[names[i]] = {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  }
  return out;
}
