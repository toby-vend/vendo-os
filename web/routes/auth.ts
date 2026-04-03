import type { FastifyPluginAsync } from 'fastify';
import { getUserByEmail, updateUserPassword, logAuditEvent } from '../lib/queries.js';
import {
  verifyPassword,
  hashPassword,
  createSessionToken,
  sessionCookie,
  clearSessionCookie,
  validatePasswordComplexity,
  type SessionUser,
} from '../lib/auth.js';

// --- Login rate limiting (IP-based, in-memory) ---
const LOGIN_WINDOW_MS = 60_000; // 1 minute
const LOGIN_MAX_ATTEMPTS = 5;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > LOGIN_MAX_ATTEMPTS;
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts) {
    if (now > entry.resetAt) loginAttempts.delete(ip);
  }
}, 5 * 60_000).unref();

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.get('/login', async (_request, reply) => {
    reply.render('login', {});
  });

  app.post('/login', async (request, reply) => {
    const ip = request.ip;
    if (isRateLimited(ip)) {
      reply.code(429).render('login', { error: 'Too many login attempts. Please try again in a minute.' });
      return;
    }

    const body = request.body as { email?: string; password?: string } | undefined;
    const email = (body?.email || '').trim().toLowerCase();
    const password = body?.password || '';

    if (!email || !password) {
      reply.render('login', { error: 'Email and password are required' });
      return;
    }

    const user = await getUserByEmail(email);
    if (!user || !verifyPassword(password, user.password_hash)) {
      logAuditEvent({ eventType: 'login_failed', ipAddress: ip, details: `email: ${email}` }).catch(() => {});
      reply.render('login', { error: 'Invalid email or password' });
      return;
    }

    logAuditEvent({ eventType: 'login_success', userId: user.id, ipAddress: ip }).catch(() => {});
    const token = createSessionToken({ userId: user.id, role: user.role, iat: Date.now() });
    reply.header('Set-Cookie', sessionCookie(token));

    if (user.must_change_password === 1) {
      reply.redirect('/change-password');
    } else {
      reply.redirect('/');
    }
  });

  app.get('/logout', async (_request, reply) => {
    reply.header('Set-Cookie', clearSessionCookie());
    reply.redirect('/login');
  });

  app.get('/change-password', async (request, reply) => {
    reply.render('change-password', {});
  });

  app.post('/change-password', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!user) { reply.redirect('/login'); return; }

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

    await updateUserPassword(user.id, hashPassword(password), false);
    logAuditEvent({ eventType: 'password_changed', userId: user.id, ipAddress: request.ip }).catch(() => {});

    // Re-issue token so session stays valid
    const token = createSessionToken({ userId: user.id, role: user.role, iat: Date.now() });
    reply.header('Set-Cookie', sessionCookie(token));
    reply.redirect('/');
  });
};
