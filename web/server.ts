import { config } from 'dotenv';
config({ path: '.env.local' });

import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { md } from './lib/markdown.js';
import { Eta } from 'eta';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import { dashboardRoutes } from './routes/dashboard.js';
import { meetingsRoutes } from './routes/meetings.js';
import { actionItemsRoutes } from './routes/action-items.js';
import { clientsRoutes } from './routes/clients.js';
import { adsRoutes } from './routes/ads.js';
import { briefsRoutes } from './routes/briefs.js';
import { syncStatusRoutes } from './routes/sync-status.js';
import { pipelineRoutes } from './routes/pipeline.js';
import { growthRoutes } from './routes/growth.js';
import { driveRoutes } from './routes/drive.js';
import { authRoutes } from './routes/auth.js';
import { adminUsersRoutes } from './routes/admin/users.js';
import { adminPermissionsRoutes } from './routes/admin/permissions.js';
import { adminUsageRoutes } from './routes/admin/usage.js';
import { adminClientsRoutes } from './routes/admin/clients.js';
import { googleOAuthRoutes } from './routes/google-oauth.js';
import { settingsRoutes } from './routes/settings.js';
import { chatRoutes } from './routes/chat.js';
import { tasksRoutes } from './routes/tasks.js';
import { driveWebhookRoutes } from './routes/drive-webhook.js';
import { driveCronRoutes } from './routes/drive-cron.js';
import { taskRunRoutes } from './routes/task-runs.js';
import { taskRunsUiRoutes } from './routes/task-runs-ui.js';
import { skillsBrowserRoutes } from './routes/skills-browser.js';
import {
  parseCookies,
  verifySessionToken,
  getRouteSlug,
  type SessionUser,
} from './lib/auth.js';
import { getUserById, getUserChannelSlugs, getUserAllowedRoutes, hasUserOAuthToken } from './lib/queries.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = Fastify({ logger: process.env.VERCEL ? false : true });

// Template engine
const eta = new Eta({ views: resolve(__dirname, 'views'), cache: process.env.NODE_ENV === 'production' });

// Decorate request with user
app.decorateRequest('user', null);

// Decorate with eta render helper — passes user to every template
app.decorateReply('render', function (template: string, data: Record<string, unknown> = {}) {
  const isHtmx = this.request.headers['hx-request'] === 'true';
  const user = (this.request as any).user as SessionUser | null;
  const html = eta.render(template, {
    ...data,
    isHtmx,
    currentPath: this.request.url.split('?')[0],
    user,
    md,
  });
  this.type('text/html').send(html);
});

// Serve static files (local dev only — Vercel serves from public/ directory)
if (!process.env.VERCEL) {
  app.register(fastifyStatic, {
    root: resolve(__dirname, 'public'),
    prefix: '/assets/',
  });
}

// Auth hook — verify session, load user, check permissions
app.addHook('onRequest', async (request, reply) => {
  const path = request.url.split('?')[0];

  // Public routes (no session required)
  if (path.startsWith('/assets/') || path === '/login' || path === '/api/drive/webhook' || path.startsWith('/api/cron/')) return;

  const cookies = parseCookies(request.headers.cookie || '');
  const token = cookies['vendo_session'];

  if (!token) {
    if (request.headers['hx-request']) { reply.code(401).send('Session expired'); return; }
    reply.redirect('/login');
    return;
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    if (request.headers['hx-request']) { reply.code(401).send('Session expired'); return; }
    reply.redirect('/login');
    return;
  }

  // Load user from database
  const dbUser = await getUserById(payload.userId);
  if (!dbUser) {
    if (request.headers['hx-request']) { reply.code(401).send('Session expired'); return; }
    reply.redirect('/login');
    return;
  }

  const [channels, allowedRoutes, googleConnected] = await Promise.all([
    getUserChannelSlugs(dbUser.id),
    dbUser.role === 'admin' ? Promise.resolve([]) : getUserAllowedRoutes(dbUser.id),
    hasUserOAuthToken(dbUser.id, 'google'),
  ]);

  const user: SessionUser = {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role,
    mustChangePassword: dbUser.must_change_password === 1,
    channels,
    allowedRoutes,
    googleConnected,
  };

  (request as any).user = user;

  // Force password change
  if (user.mustChangePassword && path !== '/change-password' && path !== '/logout') {
    reply.redirect('/change-password');
    return;
  }

  // Admin-only routes
  if (path.startsWith('/admin') && user.role !== 'admin') {
    const html = eta.render('403', { user });
    reply.code(403).type('text/html').send(html);
    return;
  }

  // Channel-based route permission check for standard users
  if (user.role === 'standard') {
    const routeSlug = getRouteSlug(path);
    if (routeSlug && !user.allowedRoutes.includes(routeSlug)) {
      if (request.headers['hx-request']) { reply.code(403).send('Access denied'); return; }
      const html = eta.render('403', { user });
      reply.code(403).type('text/html').send(html);
      return;
    }
  }
});

// Form body parser — supports multi-value fields (e.g. checkboxes with same name)
app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_req, body, done) => {
  const parsed: Record<string, string[]> = {};
  String(body).split('&').forEach(pair => {
    const [key, val] = pair.split('=');
    if (key) {
      const k = decodeURIComponent(key);
      const v = decodeURIComponent(val || '');
      if (parsed[k]) { parsed[k].push(v); } else { parsed[k] = [v]; }
    }
  });
  // Flatten single-value arrays for backwards compat, keep arrays for multi-value
  const flat: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(parsed)) {
    flat[k] = v.length === 1 ? v[0] : v;
  }
  done(null, flat);
});

// Register routes
app.register(authRoutes);
app.register(dashboardRoutes);
app.register(meetingsRoutes, { prefix: '/meetings' });
app.register(actionItemsRoutes, { prefix: '/action-items' });
app.register(clientsRoutes, { prefix: '/clients' });
app.register(adsRoutes, { prefix: '/ads' });
app.register(briefsRoutes, { prefix: '/briefs' });
app.register(syncStatusRoutes, { prefix: '/sync-status' });
app.register(pipelineRoutes, { prefix: '/pipeline' });
app.register(growthRoutes, { prefix: '/growth' });
app.register(driveRoutes, { prefix: '/drive' });
app.register(adminUsersRoutes, { prefix: '/admin/users' });
app.register(adminPermissionsRoutes, { prefix: '/admin/permissions' });
app.register(adminUsageRoutes, { prefix: '/admin/usage' });
app.register(adminClientsRoutes, { prefix: '/admin/clients' });
app.register(googleOAuthRoutes);
app.register(settingsRoutes, { prefix: '/settings' });
app.register(chatRoutes, { prefix: '/chat' });
app.register(tasksRoutes, { prefix: '/asana-tasks' });
app.register(driveWebhookRoutes, { prefix: '/api/drive' });
app.register(driveCronRoutes, { prefix: '/api/cron' });
app.register(taskRunRoutes, { prefix: '/api/tasks' });
app.register(taskRunsUiRoutes, { prefix: '/tasks' });
app.register(skillsBrowserRoutes, { prefix: '/skills' });

// Export for Vercel
export default app;

// Type augmentation
declare module 'fastify' {
  interface FastifyRequest {
    user: SessionUser | null;
  }
  interface FastifyReply {
    render(template: string, data?: Record<string, unknown>): void;
  }
}
