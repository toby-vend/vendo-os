import type { FastifyPluginAsync } from 'fastify';
import { getUserById, updateUserPassword, logAuditEvent } from '../lib/queries.js';
import {
  verifyPassword,
  hashPassword,
  createSessionToken,
  verifySessionToken,
  parseCookies,
  sessionCookie,
  clearSessionCookie,
  validatePasswordComplexity,
  type SessionUser,
} from '../lib/auth.js';

// Login is Google-only — "Sign in with Google" is the sole entry point, gated
// on an admin-provisioned account. The OAuth flow itself lives in google-oauth.ts.
const LOGIN_MESSAGES: Record<string, string> = {
  google: 'Google sign-in failed. Please try again.',
  state: 'Your sign-in session expired. Please try again.',
};

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.get('/login', async (request, reply) => {
    const cookies = parseCookies(request.headers.cookie || '');
    const token = cookies['vendo_session'];
    if (token && verifySessionToken(token)) {
      reply.redirect('/');
      return;
    }
    const query = request.query as { flagged?: string; error?: string };
    reply.render('login', {
      flagged: query.flagged === '1',
      error: query.error ? (LOGIN_MESSAGES[query.error] ?? null) : null,
    });
  });

  app.get('/logout', async (_request, reply) => {
    reply.header('Set-Cookie', clearSessionCookie());
    reply.redirect('/login');
  });

  app.get('/change-password', async (request, reply) => {
    reply.render('change-password', {});
  });

  app.post('/change-password', async (request, reply) => {
    const sessionUser = (request as any).user as SessionUser | null;
    if (!sessionUser) { reply.redirect('/login'); return; }

    // Fetch fresh DB record to get current password hash
    const dbUser = await getUserById(sessionUser.id);
    if (!dbUser) { reply.redirect('/login'); return; }

    const body = request.body as { password?: string; confirm?: string } | undefined;
    const password = body?.password || '';
    const confirm = body?.confirm || '';

    const complexityError = validatePasswordComplexity(password);
    if (complexityError) {
      reply.render('change-password', { error: complexityError });
      return;
    }

    if (password !== confirm) {
      reply.render('change-password', { error: 'Passwords do not match' });
      return;
    }

    // Reject if new password is the same as the current one
    if (verifyPassword(password, dbUser.password_hash)) {
      reply.render('change-password', { error: 'New password must be different from your current password' });
      return;
    }

    const newHash = hashPassword(password);
    await updateUserPassword(dbUser.id, newHash, false);
    logAuditEvent({ eventType: 'password_changed', userId: dbUser.id, ipAddress: request.ip }).catch(() => {});

    // Re-issue token so session stays valid
    const token = createSessionToken({ userId: dbUser.id, role: dbUser.role, iat: Date.now() });
    reply.header('Set-Cookie', sessionCookie(token));
    reply.redirect('/');
  });
};
