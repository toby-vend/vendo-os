/**
 * /api/agent/conversations — chat-memory CRUD endpoint.
 *
 *   GET    /api/agent/conversations          → list current user's threads
 *   GET    /api/agent/conversations/:id      → full message history (UIMessage[])
 *   PATCH  /api/agent/conversations/:id      → { archive: true|false } or { title }
 *   DELETE /api/agent/conversations/:id      → hard-delete (only if archived)
 *
 * Auth: same vendo_session cookie as /api/agent/chat. Every helper is
 * user-scoped — there is no admin override at this layer.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { parseCookies, verifySessionToken } from '../../web/lib/auth.js';
import { getUserById, userRowToSessionUser } from '../../web/lib/queries/auth.js';
import { loadConversation } from '../../web/lib/agents/trace.js';
import {
  listConversations,
  searchConversations,
  getConversation,
  archiveConversation,
  restoreConversation,
  deleteConversation,
} from '../../web/lib/queries/conversations.js';
import { db } from '../../web/lib/queries/base.js';

export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
};

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // -- Auth --
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

  // -- Route -------------------------------------------------------------
  // url like '/api/agent/conversations' or '/api/agent/conversations/<id>'
  const urlPath = (req.url || '').split('?')[0];
  const segments = urlPath.split('/').filter(Boolean); // ['api','agent','conversations', maybe id]
  const idSegment = segments[3] || null;
  const method = (req.method || 'GET').toUpperCase();

  // -- GET /api/agent/conversations  → list / search ---------------------
  if (!idSegment && method === 'GET') {
    const query = (req.query ?? {}) as Record<string, string | string[]>;
    const agent = typeof query.agent === 'string' ? query.agent : undefined;
    const q = typeof query.q === 'string' ? query.q.trim() : '';
    const limit = parseInt(typeof query.limit === 'string' ? query.limit : '25', 10) || 25;
    const beforeMs = parseInt(typeof query.beforeMs === 'string' ? query.beforeMs : '', 10);
    const archived =
      typeof query.archived === 'string' && (query.archived === '1' || query.archived === 'true');

    const items = q.length > 0
      ? await searchConversations({ userId: user.id, query: q, agent, limit })
      : await listConversations({
          userId: user.id,
          agent,
          limit,
          beforeMs: Number.isFinite(beforeMs) ? beforeMs : undefined,
          archivedOnly: archived,
        });

    sendJson(res, 200, { items });
    return;
  }

  // -- GET /api/agent/conversations/:id → full message history ----------
  if (idSegment && method === 'GET') {
    const conv = await getConversation(idSegment, user.id);
    if (!conv) {
      sendJson(res, 404, { error: 'Conversation not found' });
      return;
    }
    const messages = await loadConversation(idSegment, 200);
    sendJson(res, 200, {
      id: conv.id,
      agent: conv.agent,
      title: conv.title,
      messages, // [{ role, text }] — the client converts to UIMessage shape
    });
    return;
  }

  // -- PATCH /api/agent/conversations/:id → archive / restore -----------
  if (idSegment && method === 'PATCH') {
    const body = parseBody(req);
    if (body == null) {
      sendJson(res, 400, { error: 'Invalid JSON body' });
      return;
    }
    if (typeof body.archive === 'boolean') {
      const ok = body.archive
        ? await archiveConversation(idSegment, user.id)
        : await restoreConversation(idSegment, user.id);
      if (!ok) {
        sendJson(res, 404, { error: 'Conversation not found or already in that state' });
        return;
      }
      sendJson(res, 200, { ok: true });
      return;
    }
    if (typeof body.title === 'string' && body.title.trim().length > 0) {
      const t = body.title.trim().slice(0, 120);
      // Direct UPDATE — ownership enforced via WHERE user_id = ?.
      const r = await db.execute({
        sql: `UPDATE agent_conversations SET title = ? WHERE id = ? AND user_id = ?`,
        args: [t, idSegment, user.id],
      });
      if (r.rowsAffected === 0) {
        sendJson(res, 404, { error: 'Conversation not found' });
        return;
      }
      sendJson(res, 200, { ok: true, title: t });
      return;
    }
    sendJson(res, 400, { error: 'Body must contain { archive: boolean } or { title: string }' });
    return;
  }

  // -- DELETE /api/agent/conversations/:id → hard-delete ----------------
  if (idSegment && method === 'DELETE') {
    const ok = await deleteConversation(idSegment, user.id);
    if (!ok) {
      sendJson(res, 409, {
        error: 'Conversation must be archived before delete, or not found',
      });
      return;
    }
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 405, { error: 'Method not allowed' });
}

function parseBody(req: VercelRequest): Record<string, unknown> | null {
  try {
    if (typeof req.body === 'string') return JSON.parse(req.body);
    if (req.body && typeof req.body === 'object') return req.body as Record<string, unknown>;
    return {};
  } catch {
    return null;
  }
}
