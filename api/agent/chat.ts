/**
 * /api/agent/chat — the conversational entrypoint for the web channel.
 *
 * Exports a fetch-style Vercel handler so streamAgent's Response can be
 * returned directly without re-pumping bytes through a Node res object.
 *
 * Auth: reads vendo_session cookie, verifies the JWT, hydrates the full
 * SessionUser via getUserById. 401 if any step fails.
 *
 * Body: { messages: UIMessage[], conversationId?: string }
 *   `messages` is the running UIMessage[] from useChat on the client.
 *   `conversationId` lets us thread runs together — defaults to the
 *   first user message id when absent.
 *
 * Side-effects:
 *   - Logs every step into agent_messages and every tool call into
 *     agent_tool_calls (via the runtime / defineTool wiring).
 *   - Closes an agent_runs row on finish with status, usage and cost.
 *   - Honours the graduations table — write tools default to dry-run.
 */
import type { UIMessage } from 'ai';
import { parseCookies, verifySessionToken, generateId } from '../../web/lib/auth';
import { getUserById, userRowToSessionUser } from '../../web/lib/queries/auth';
import { getAgentForUser } from '../../web/lib/agents/agents';
import { loadGraduations } from '../../web/lib/agents/permissions';
import { streamAgent } from '../../web/lib/agents/runtime';
import type { ChannelName } from '../../web/lib/agents/types';

export const config = {
  runtime: 'nodejs',
  maxDuration: 60,
};

interface ChatBody {
  messages: UIMessage[];
  conversationId?: string;
  trigger?: string;
}

function unauthorized(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

function badRequest(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // -- Auth -----------------------------------------------------------------
  const cookieHeader = request.headers.get('cookie') ?? '';
  const cookies = parseCookies(cookieHeader);
  const token = cookies['vendo_session'];
  const payload = token ? verifySessionToken(token) : null;
  if (!payload) return unauthorized('Unauthorized');

  const userRow = await getUserById(payload.userId);
  if (!userRow) return unauthorized('Session user no longer exists');
  const user = userRowToSessionUser(userRow);

  // -- Body -----------------------------------------------------------------
  let body: ChatBody;
  try {
    body = (await request.json()) as ChatBody;
  } catch {
    return badRequest('Invalid JSON body');
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return badRequest('messages array required');
  }

  // -- Tier router ---------------------------------------------------------
  // role === 'admin'    → atlasAgent (full toolset)
  // role === 'standard' → atlasStaffAgent (no finance, no decisions)
  // role === 'client'   → 403 (client-portal users don't get Atlas)
  const agent = getAgentForUser(user);
  if (!agent) {
    return new Response(JSON.stringify({ error: 'No Atlas tier for your role.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // -- Stream ---------------------------------------------------------------
  const graduations = await loadGraduations(agent.name);
  const conversationId = body.conversationId ?? generateId();

  return streamAgent({
    agent,
    ctx: {
      runId: '', // stamped by the runtime
      user,
      channel: 'web' as ChannelName,
      conversationId,
      graduations,
    },
    uiMessages: body.messages,
    conversationId,
    trigger: body.trigger ?? 'user-message',
  });
}
