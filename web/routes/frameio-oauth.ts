import crypto from 'crypto';
import type { FastifyPluginAsync } from 'fastify';
import { buildAuthorizeUrl, exchangeCodeForTokens, getConnectionStatus, disconnectFrameio } from '../lib/frameio/auth.js';

/**
 * Frame.io OAuth admin routes.
 *
 *   GET  /api/frameio/oauth/start    — admin-only; redirects to Adobe IMS authorize
 *   GET  /api/frameio/oauth/callback — receives auth code from Adobe, stores tokens
 *   GET  /api/frameio/oauth/status   — admin-only; returns connection state JSON
 *   POST /api/frameio/oauth/disconnect — admin-only; clears stored tokens
 *
 * The admin gate runs in web/server.ts via the regular session/role hook.
 * The OAuth callback is *deliberately* session-protected: anyone with our
 * callback URL would otherwise be able to swap an attacker-supplied auth
 * code for our tokens. State is also signed with the session token so a
 * stolen `code` can't be replayed cross-session.
 */

const OAUTH_REDIRECT_URI = 'https://vendo-os.vercel.app/api/frameio/oauth/callback';
const STATE_VERSION = 'v1';

function signState(sessionToken: string, nonce: string): string {
  const secret = process.env.SESSION_SECRET ?? process.env.TOKEN_ENCRYPTION_KEY ?? 'fallback-state-secret';
  const sig = crypto.createHmac('sha256', secret).update(`${STATE_VERSION}:${sessionToken}:${nonce}`).digest('hex').slice(0, 16);
  return `${STATE_VERSION}.${nonce}.${sig}`;
}

function verifyState(state: string, sessionToken: string): boolean {
  const parts = state.split('.');
  if (parts.length !== 3 || parts[0] !== STATE_VERSION) return false;
  const expected = signState(sessionToken, parts[1]);
  return expected === state;
}

export const frameioOAuthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/oauth/start', async (request, reply) => {
    const user = (request as { user?: { role?: string } }).user;
    if (!user || user.role !== 'admin') {
      return reply.code(403).send({ error: 'Admin only' });
    }
    const sessionToken = (request as { _sessionToken?: string })._sessionToken ?? '';
    const nonce = crypto.randomBytes(12).toString('hex');
    const state = signState(sessionToken, nonce);
    const url = buildAuthorizeUrl({ redirectUri: OAUTH_REDIRECT_URI, state });
    return reply.redirect(url);
  });

  app.get('/oauth/callback', async (request, reply) => {
    const user = (request as { user?: { role?: string; email?: string } }).user;
    if (!user || user.role !== 'admin') {
      return reply.code(403).send({ error: 'Admin only' });
    }

    const q = request.query as { code?: string; state?: string; error?: string; error_description?: string };
    if (q.error) {
      return reply.code(400).type('text/html').send(`
        <h1>Frame.io connection failed</h1>
        <p>Adobe returned: <code>${q.error}</code> — ${q.error_description ?? ''}</p>
        <p><a href="/api/frameio/oauth/start">Try again</a></p>
      `);
    }
    if (!q.code || !q.state) {
      return reply.code(400).send({ error: 'Missing code or state' });
    }

    const sessionToken = (request as { _sessionToken?: string })._sessionToken ?? '';
    if (!verifyState(q.state, sessionToken)) {
      return reply.code(403).send({ error: 'Invalid state' });
    }

    try {
      await exchangeCodeForTokens(q.code);
    } catch (err) {
      const msg = (err as Error).message;
      request.log.error({ err }, 'Frame.io OAuth exchange failed');
      return reply.code(500).type('text/html').send(`
        <h1>Frame.io connection failed</h1>
        <pre>${msg.replace(/[<>]/g, '')}</pre>
        <p><a href="/api/frameio/oauth/start">Try again</a></p>
      `);
    }

    return reply.type('text/html').send(`
      <!doctype html>
      <html><head><title>Frame.io connected</title>
      <style>body{font-family:system-ui;max-width:560px;margin:60px auto;padding:0 20px;color:#222}
      h1{color:#0a7}code{background:#f4f4f4;padding:2px 6px;border-radius:3px}</style>
      </head><body>
      <h1>✓ Frame.io connected</h1>
      <p>Tokens stored. The webhook handler can now resolve Frame.io resource details.</p>
      <p><a href="/">Back to VendoOS</a></p>
      </body></html>
    `);
  });

  app.get('/oauth/status', async (request, reply) => {
    const user = (request as { user?: { role?: string } }).user;
    if (!user || user.role !== 'admin') return reply.code(403).send({ error: 'Admin only' });
    const status = await getConnectionStatus();
    return reply.send(status);
  });

  app.post('/oauth/disconnect', async (request, reply) => {
    const user = (request as { user?: { role?: string } }).user;
    if (!user || user.role !== 'admin') return reply.code(403).send({ error: 'Admin only' });
    await disconnectFrameio();
    return reply.send({ ok: true });
  });
};
