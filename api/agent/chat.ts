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
import { getAgentForUser, resolveAgentByName } from '../../web/lib/agents/agents/index.js';
import { loadGraduations } from '../../web/lib/agents/permissions.js';
import { streamAgent } from '../../web/lib/agents/runtime.js';
import type { ChannelName } from '../../web/lib/agents/types.js';
import {
  createConversation,
  touchConversation,
  setConversationTitle,
  refreshConversationSearchBody,
  getConversation,
  truncateAtWordBoundary,
} from '../../web/lib/queries/conversations.js';

export const config = {
  runtime: 'nodejs',
  maxDuration: 60,
};

interface ChatBody {
  messages: UIMessage[];
  conversationId?: string;
  trigger?: string;
  // When set, dispatch to that specific agent via resolveAgentByName
  // (admin-gated for specialists). When absent, the tier router picks
  // atlas or atlas-staff based on user role — the existing behaviour.
  agentName?: string;
}

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}

/**
 * Pull the plain text out of a UIMessage. AI SDK 6 UIMessages have a
 * `parts: [{ type: 'text', text: string } | { type: 'tool-...' } | ...]`
 * shape; we concatenate every text part. Returns null if the message
 * has no text content at all.
 */
function extractText(message: UIMessage): string | null {
  const parts = (message as { parts?: Array<{ type?: string; text?: string }> }).parts;
  if (!Array.isArray(parts)) return null;
  const text = parts
    .filter((p) => p && p.type === 'text' && typeof p.text === 'string')
    .map((p) => p.text as string)
    .join(' ')
    .trim();
  return text.length > 0 ? text : null;
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

  // -- Agent selection ----------------------------------------------------
  // If the client requested a specific agent (specialist picker in /chat),
  // resolve through resolveAgentByName which enforces admin-only access
  // to specialists. Otherwise the tier router runs:
  //   admin    → atlasAgent (full toolset)
  //   standard → atlasStaffAgent (no finance, no decisions)
  //   client   → 403 (client-portal users don't get Atlas)
  const agent = body.agentName
    ? resolveAgentByName(body.agentName, user)
    : getAgentForUser(user);
  if (!agent) {
    sendJson(res, 403, { error: 'No Atlas tier for your role.' });
    return;
  }

  // -- Stream ---------------------------------------------------------------
  const graduations = await loadGraduations(agent.name);
  const conversationId = body.conversationId ?? generateId();

  // -- Conversation metadata (chat memory) --------------------------------
  // Upsert the agent_conversations row before the run starts so the
  // drawer can list it the moment the user sends a message. Then derive
  // a title from the first user message (truncated; LLM-summary later).
  // Best-effort — failures here are logged but never block the stream.
  try {
    const existing = await getConversation(conversationId, user.id);
    if (!existing) {
      await createConversation({
        id: conversationId,
        userId: user.id,
        agent: agent.name,
        channel: 'web',
      });
    }
    await touchConversation(conversationId, 1);

    // Title + FTS body — only set on the first turn (title IS NULL clause
    // inside setConversationTitle). Search body is refreshed on every turn
    // so search picks up new content.
    const userTexts = body.messages
      .filter((m) => m.role === 'user')
      .map((m) => extractText(m))
      .filter((t): t is string => typeof t === 'string' && t.length > 0);
    if (userTexts.length > 0) {
      const firstUser = userTexts[0];
      const title = truncateAtWordBoundary(firstUser, 60);
      const ftsBody = userTexts.join('\n\n');
      if (!existing?.title) {
        await setConversationTitle({
          id: conversationId,
          userId: user.id,
          agent: agent.name,
          title,
          body: ftsBody,
        });
      } else {
        await refreshConversationSearchBody({
          id: conversationId,
          userId: user.id,
          agent: agent.name,
          title: existing.title,
          body: ftsBody,
        });
      }
    }
  } catch (err) {
    console.error('[api/agent/chat] conversation metadata upsert failed:', err instanceof Error ? err.message : String(err));
  }

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
