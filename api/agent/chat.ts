/**
 * /api/agent/chat — the conversational entrypoint for the web channel.
 *
 * Node-style Vercel handler. The streamAgent function returns a Web Response
 * whose body is a streaming UIMessage chunk feed; we pipe the body through
 * the Node response object so Vercel's @vercel/node legacy builder is
 * happy (it doesn't accept (Request) → Response handlers directly).
 *
 * Auth: reads vendo_session cookie, verifies the JWT, hydrates the full
 * SessionUser via getUserById. 401 if any step fails.
 *
 * Body: { messages: UIMessage[], conversationId?: string }
 *   `messages` is the running UIMessage[] from useChat on the client.
 *   `conversationId` lets us thread runs together — defaults to a
 *   freshly generated id when absent.
 *
 * Side-effects:
 *   - Logs every step into agent_messages and every tool call into
 *     agent_tool_calls (via the runtime / defineTool wiring).
 *   - Closes an agent_runs row on finish with status, usage and cost.
 *   - Honours the graduations table — write tools default to dry-run.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { UIMessage } from 'ai';
import { Readable } from 'node:stream';
import { parseCookies, verifySessionToken, generateId } from '../../web/lib/auth.js';
import { getUserById, userRowToSessionUser } from '../../web/lib/queries/auth.js';
import { getAgentForUser } from '../../web/lib/agents/agents/index.js';
import { loadGraduations } from '../../web/lib/agents/permissions.js';
import { streamAgent } from '../../web/lib/agents/runtime.js';
import type { ChannelName } from '../../web/lib/agents/types.js';

export const config = {
  runtime: 'nodejs',
  maxDuration: 60,
};

interface ChatBody {
  messages: UIMessage[];
  conversationId?: string;
  trigger?: string;
}

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  // -- Auth -----------------------------------------------------------------
  const cookieHeader =
    (Array.isArray(req.headers.cookie) ? req.headers.cookie[0] : req.headers.cookie) ?? '';
  const cookies = parseCookies(cookieHeader);
  const token = cookies['vendo_session'];
  const payload = token ? verifySessionToken(token) : null;
  if (!payload) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return;
  }

  const userRow = await getUserById(payload.userId);
  if (!userRow) {
    sendJson(res, 401, { error: 'Session user no longer exists' });
    return;
  }
  const user = userRowToSessionUser(userRow);

  // -- Body -----------------------------------------------------------------
  // @vercel/node parses JSON bodies for us, but only when content-type is
  // application/json. useChat sends that header, so req.body is the parsed
  // object; fall back to raw-string parsing defensively.
  let body: ChatBody;
  try {
    if (typeof req.body === 'string') {
      body = JSON.parse(req.body) as ChatBody;
    } else if (req.body && typeof req.body === 'object') {
      body = req.body as ChatBody;
    } else {
      sendJson(res, 400, { error: 'Invalid JSON body' });
      return;
    }
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body' });
    return;
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    sendJson(res, 400, { error: 'messages array required' });
    return;
  }

  // -- Tier router ---------------------------------------------------------
  // role === 'admin'    → atlasAgent (full toolset)
  // role === 'standard' → atlasStaffAgent (no finance, no decisions)
  // role === 'client'   → 403 (client-portal users don't get Atlas)
  const agent = getAgentForUser(user);
  if (!agent) {
    sendJson(res, 403, { error: 'No Atlas tier for your role.' });
    return;
  }

  // -- Stream ---------------------------------------------------------------
  const graduations = await loadGraduations(agent.name);
  const conversationId = body.conversationId ?? generateId();

  const streamResponse = await streamAgent({
    agent,
    ctx: {
      runId: '',     // stamped by the runtime
      agent: agent.name,
      user,
      channel: 'web' as ChannelName,
      conversationId,
      graduations,
    },
    uiMessages: body.messages,
    conversationId,
    trigger: body.trigger ?? 'user-message',
  });

  // -- Pipe the Web Response body to the Node response ---------------------
  // Use Readable.fromWeb so back-pressure, error propagation, and the
  // final end() signal are all handled by Node's stream plumbing rather
  // than our own getReader loop. The previous manual reader loop dropped
  // the connection mid-stream on Vercel — the server-side run completed
  // cleanly, but the client saw 'network error' because the final chunk
  // never arrived.
  res.status(streamResponse.status);
  streamResponse.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    // Skip headers Node manages itself (and that conflict with chunked
    // streaming when set explicitly).
    if (lower === 'content-length' || lower === 'transfer-encoding' || lower === 'connection') return;
    res.setHeader(key, value);
  });

  if (!streamResponse.body) {
    res.end();
    return;
  }

  // Promise-wrap so the function doesn't return before the pipe finishes
  // — otherwise Vercel may tear the function down with the stream open.
  await new Promise<void>((resolve) => {
    const nodeStream = Readable.fromWeb(streamResponse.body as unknown as Parameters<typeof Readable.fromWeb>[0]);
    nodeStream.on('error', (err) => {
      console.error('[api/agent/chat] stream pipe error:', err instanceof Error ? err.message : String(err));
      try { res.end(); } catch { /* already ended */ }
      resolve();
    });
    res.on('close', () => resolve());
    res.on('finish', () => resolve());
    nodeStream.pipe(res);
  });
}
