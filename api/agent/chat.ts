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
  // File attachments (data-URI encoded) that the user dropped or
  // attached on the latest turn. Images are passed to the model as
  // file parts; non-image attachments are rejected at v1.
  attachments?: { id: string; name: string; type: string; dataUri: string }[];
  // Large text the user pasted as a snippet card. Inlined into the
  // user message text under a labelled fence so the model sees it.
  pastedSnippets?: { id: string; content: string }[];
}

/** Hard cap matching the Vercel body limit headroom (~4MB of attachments). */
const MAX_ATTACHMENT_PAYLOAD = 4_000_000;

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

/**
 * Rewrite the last user message in `messages` to include any attachments
 * and pasted snippets the client supplied. Image attachments become
 * `file` parts (AI SDK 6 shape). Pasted snippets are appended to the
 * user's text content under a labelled fence so the model sees them
 * verbatim. Returns the rewritten messages array; never mutates the
 * input array.
 *
 * Throws if no user message exists to attach to, or if the total
 * attachment payload exceeds MAX_ATTACHMENT_PAYLOAD.
 */
function applyAttachmentsToMessages(
  messages: UIMessage[],
  attachments: ChatBody['attachments'] = [],
  pastedSnippets: ChatBody['pastedSnippets'] = [],
): UIMessage[] {
  const safeAttachments = Array.isArray(attachments) ? attachments : [];
  const safeSnippets = Array.isArray(pastedSnippets) ? pastedSnippets : [];
  if (safeAttachments.length === 0 && safeSnippets.length === 0) return messages;

  // Cumulative size guard. dataUri base64 is ~33% larger than raw bytes,
  // but we cap the encoded string length too — same headroom either way.
  let total = 0;
  for (const a of safeAttachments) total += a.dataUri ? a.dataUri.length : 0;
  if (total > MAX_ATTACHMENT_PAYLOAD) {
    throw new Error('attachment_payload_too_large');
  }

  // Find the last user message — that's the one the user just typed.
  const idx = [...messages].reverse().findIndex((m) => m.role === 'user');
  if (idx === -1) return messages;
  const targetIndex = messages.length - 1 - idx;
  const target = messages[targetIndex] as UIMessage & {
    parts?: Array<Record<string, unknown>>;
  };

  // Build the new parts array. Image attachments are prepended as
  // `file` parts; pasted snippets fold into the text part.
  const originalParts = Array.isArray(target.parts) ? [...target.parts] : [];
  const filePartsToPrepend: Array<Record<string, unknown>> = [];
  for (const a of safeAttachments) {
    if (a.type && a.type.startsWith('image/') && typeof a.dataUri === 'string') {
      filePartsToPrepend.push({
        type: 'file',
        mediaType: a.type,
        url: a.dataUri,
      });
    }
    // Non-image attachments silently skipped at v1.
  }

  // Append pasted snippets to the (first) text part. If there's no text
  // part yet, create one.
  let touchedText = false;
  const nextParts = originalParts.map((p) => {
    if (!touchedText && p.type === 'text') {
      touchedText = true;
      const original = typeof p.text === 'string' ? p.text : '';
      const fences = safeSnippets
        .map((s, i) => `\n\n--- pasted snippet ${i + 1} ---\n${s.content}\n--- end snippet ${i + 1} ---`)
        .join('');
      return { ...p, text: original + fences };
    }
    return p;
  });
  if (!touchedText && safeSnippets.length > 0) {
    const fences = safeSnippets
      .map((s, i) => `--- pasted snippet ${i + 1} ---\n${s.content}\n--- end snippet ${i + 1} ---`)
      .join('\n\n');
    nextParts.unshift({ type: 'text', text: fences });
  }

  const merged = {
    ...target,
    parts: [...filePartsToPrepend, ...nextParts],
  } as UIMessage;

  // Return a new array with the rewritten target in place.
  const out = [...messages];
  out[targetIndex] = merged;
  return out;
}

// Re-export internals for the smoke test only.
export const __internals = { applyAttachmentsToMessages };

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

  // -- Apply attachments + pasted snippets to the last user message -------
  let uiMessages: UIMessage[];
  try {
    uiMessages = applyAttachmentsToMessages(
      body.messages,
      body.attachments,
      body.pastedSnippets,
    );
  } catch (err) {
    if (err instanceof Error && err.message === 'attachment_payload_too_large') {
      sendJson(res, 413, { error: 'Attachment payload too large (4MB cap).' });
      return;
    }
    throw err;
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
    uiMessages,
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
