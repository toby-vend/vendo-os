import type { FastifyPluginAsync } from 'fastify';
import { getUserByEmail, updateUserPassword } from '../lib/queries.js';
import {
  verifyPassword,
  hashPassword,
  createSessionToken,
  sessionCookie,
  clearSessionCookie,
  type SessionUser,
} from '../lib/auth.js';

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.get('/login', async (_request, reply) => {
    reply.render('login', {});
  });

  app.post('/login', async (request, reply) => {
    const body = request.body as { email?: string; password?: string } | undefined;
    const email = (body?.email || '').trim().toLowerCase();
    const password = body?.password || '';

    if (!email || !password) {
      reply.render('login', { error: 'Email and password are required' });
      return;
    }

    const user = await getUserByEmail(email);
    if (!user || !verifyPassword(password, user.password_hash)) {
      reply.render('login', { error: 'Invalid email or password' });
      return;
    }

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

    if (password.length < 8) {
      reply.render('change-password', { error: 'Password must be at least 8 characters' });
      return;
    }

    if (password !== confirm) {
      reply.render('change-password', { error: 'Passwords do not match' });
      return;
    }

    await updateUserPassword(user.id, hashPassword(password), false);

    // Re-issue token so session stays valid
    const token = createSessionToken({ userId: user.id, role: user.role, iat: Date.now() });
    reply.header('Set-Cookie', sessionCookie(token));
    reply.redirect('/');
  });
};
