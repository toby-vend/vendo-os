import { config } from 'dotenv';
config({ path: '.env.local' });

import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { md, sanitiseHtml } from './lib/markdown.js';
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
import { adminAutoTasksRoutes } from './routes/admin/auto-tasks.js';
import { adminClientsRoutes } from './routes/admin/clients.js';
import { adminClientMappingRoutes } from './routes/admin/client-mapping.js';
import { adminPortalUsersRoutes } from './routes/admin/portal-users.js';
import { adminOnboardingRoutes } from './routes/admin/onboarding.js';
import { adminSidebarRoutes } from './routes/admin/sidebar.js';
import { googleOAuthRoutes } from './routes/google-oauth.js';
import { settingsRoutes } from './routes/settings.js';
import { chatRoutes } from './routes/chat.js';
import { tasksRoutes } from './routes/tasks.js';
import { driveWebhookRoutes } from './routes/drive-webhook.js';
import { slackInteractRoutes } from './routes/slack-interact.js';
import { fathomWebhookRoutes } from './routes/fathom-webhook.js';
import { driveCronRoutes } from './routes/drive-cron.js';
import { taskRunRoutes } from './routes/task-runs.js';
import { taskRunsUiRoutes } from './routes/task-runs-ui.js';
import { skillsBrowserRoutes } from './routes/skills-browser.js';
import { portalRoutes } from './routes/portal.js';
import { metaDentalRoutes } from './routes/dashboards/meta-dental.js';
import { gadsDentalRoutes } from './routes/dashboards/gads-dental.js';
import { reportingHubRoutes } from './routes/dashboards/reporting-hub.js';
import { clientMerRoutes } from './routes/dashboards/client-mer.js';
import { financeRoutes } from './routes/dashboards/finance.js';
import { timeTrackingRoutes } from './routes/dashboards/time-tracking.js';
import { capacityRoutes } from './routes/dashboards/capacity.js';
import { gadsEcomRoutes } from './routes/dashboards/gads-ecom.js';
import { unifiedAdsRoutes } from './routes/dashboards/ads.js';
import { profitabilityRoutes } from './routes/dashboards/profitability.js';
import { pipelineTrackerRoutes } from './routes/dashboards/pipeline.js';
import { reviewsRoutes } from './routes/dashboards/reviews.js';
import { healthRoutes } from './routes/dashboards/health.js';
// client-database merged into /clients — see routes/clients.ts
import { operationsRoutes } from './routes/operations.js';
import { skillsLibraryRoutes } from './routes/skills-library.js';
import { cronRoutes } from './routes/api/cron.js';
import { alertsRoutes } from './routes/api/alerts.js';
import { skillsApiRoutes } from './routes/api/skills.js';
import { onboardPublicRoutes, onboardingInternalRoutes } from './routes/onboarding.js';
import { videoProductionRoutes } from './routes/video-production.js';
import { deliverablesRoutes } from './routes/deliverables.js';
import { pushRoutes } from './routes/push.js';
import crypto from 'crypto';
import {
  parseCookies,
  verifySessionToken,
  getRouteSlug,
  generateCsrfToken,
  verifyCsrfToken,
  type SessionUser,
} from './lib/auth.js';
import { initVapid } from './lib/push-sender.js';
import { getUserById, getUserChannelSlugs, getUserAllowedRoutes, hasUserOAuthToken, getClientForUser, migrateSidebarConfig } from './lib/queries.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = Fastify({ logger: process.env.VERCEL ? false : true });

// Initialise VAPID details for push notifications (no-op if env vars are missing)
initVapid();

// Template engine
const eta = new Eta({ views: resolve(__dirname, 'views'), cache: process.env.NODE_ENV === 'production' });

// Decorate request with user
app.decorateRequest('user', null);

// Decorate with eta render helper — passes user to every template
app.decorateReply('render', function (template: string, data: Record<string, unknown> = {}) {
  const isHtmx = this.request.headers['hx-request'] === 'true';
  const user = (this.request as any).user as SessionUser | null;
  const sessionToken = (this.request as any)._sessionToken as string | undefined;
  const csrfToken = sessionToken ? generateCsrfToken(sessionToken) : '';
  const html = eta.render(template, {
    ...data,
    isHtmx,
    currentPath: this.request.url.split('?')[0],
    user,
    csrfToken,
    md,
    sanitiseHtml,
    sidebarConfig: (this.request as any)._sidebarConfig,
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

// Run sidebar migration once on first request
let sidebarMigrated = false;
app.addHook('onRequest', async () => {
  if (!sidebarMigrated) {
    sidebarMigrated = true;
    try { await migrateSidebarConfig(); } catch { /* table may not exist yet */ }
  }
});

// Auth hook — verify session, load user, check permissions
app.addHook('onRequest', async (request, reply) => {
  const path = request.url.split('?')[0];

  // Public routes (no session required)
  if (path.startsWith('/assets/') || path === '/login' || (path.startsWith('/onboard') && !path.startsWith('/onboarding')) || path === '/api/drive/webhook' || path === '/api/fathom/webhook') return;

  // Cron routes — validate Vercel cron secret
  if (path.startsWith('/api/cron/')) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      reply.code(401).send({ error: 'Cron secret not configured' });
      return;
    }
    const auth = request.headers['authorization'];
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(cronSecret))) {
      reply.code(401).send({ error: 'Unauthorised' });
      return;
    }
    return;
  }

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

  const { getSidebarConfig } = await import('./lib/queries/sidebar.js');
  const [channels, allowedRoutes, googleConnected, clientMapping, sidebarConfig] = await Promise.all([
    getUserChannelSlugs(dbUser.id),
    dbUser.role === 'admin' ? Promise.resolve([]) : getUserAllowedRoutes(dbUser.id),
    hasUserOAuthToken(dbUser.id, 'google'),
    dbUser.role === 'client' ? getClientForUser(dbUser.id) : Promise.resolve(null),
    getSidebarConfig(),
  ]);
  (request as any)._sidebarConfig = sidebarConfig;

  const user: SessionUser = {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role,
    mustChangePassword: dbUser.must_change_password === 1,
    channels,
    allowedRoutes,
    googleConnected,
    clientId: clientMapping?.client_id ?? null,
    clientName: clientMapping?.client_name ?? null,
  };

  (request as any).user = user;
  (request as any)._sessionToken = token;

  // Force password change
  if (user.mustChangePassword && path !== '/change-password' && path !== '/logout') {
    reply.redirect('/change-password');
    return;
  }

  // Client role — restrict to /portal/* routes only
  if (user.role === 'client') {
    const allowed = path.startsWith('/portal') || path === '/logout' || path === '/change-password';
    if (!allowed) {
      if (request.headers['hx-request']) { reply.code(403).send('Access denied'); return; }
      reply.redirect('/portal');
      return;
    }
    return; // skip further permission checks for client users
  }

  // Admin-only routes
  if (path.startsWith('/admin') && user.role !== 'admin') {
    const html = eta.render('403', { user });
    reply.code(403).type('text/html').send(html);
    return;
  }

  // Channel-based route permission check for standard users (deny-by-default)
  if (user.role === 'standard') {
    // Allow common routes for all authenticated users
    if (path === '/change-password' || path === '/logout' || path === '/settings') return;
    const routeSlug = getRouteSlug(path);
    // If no route slug mapping exists, deny access (unmapped routes are admin-only)
    if (!routeSlug || !user.allowedRoutes.includes(routeSlug)) {
      if (request.headers['hx-request']) { reply.code(403).send('Access denied'); return; }
      const html = eta.render('403', { user });
      reply.code(403).type('text/html').send(html);
      return;
    }
  }
});

// Security headers
app.addHook('onSend', async (_request, reply) => {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  reply.header('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self'",
    "frame-src https://app.frame.io https://*.frame.io",
    "frame-ancestors 'none'",
  ].join('; '));
  reply.header('Vary', 'HX-Request');
});

// Form body parser — supports multi-value fields (e.g. checkboxes with same name)
app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (req, body, done) => {
  // Stash the raw body for signature-verifying endpoints (Slack interactions).
  (req as unknown as { rawBody?: string }).rawBody = String(body);
  const parsed: Record<string, string[]> = {};
  String(body).split('&').forEach(pair => {
    const [key, val] = pair.split('=');
    if (key) {
      const k = decodeURIComponent(key.replace(/\+/g, ' '));
      const v = decodeURIComponent((val || '').replace(/\+/g, ' '));
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

// CSRF validation for form POST requests
app.addHook('preHandler', async (request, reply) => {
  if (request.method !== 'POST') return;

  const path = request.url.split('?')[0];

  // Skip CSRF for API endpoints, webhooks, login (no session token yet), and OAuth callbacks
  if (path.startsWith('/api/') || path === '/login' || path.startsWith('/auth/google/')) return;

  const sessionToken = (request as any)._sessionToken as string | undefined;
  if (!sessionToken) return; // no session = not authenticated, auth hook will handle

  const body = request.body as Record<string, string | string[]> | undefined;
  const headerToken = request.headers['x-csrf-token'] as string | undefined;
  const csrfToken = headerToken || (typeof body?._csrf === 'string' ? body._csrf : '');
  if (!verifyCsrfToken(sessionToken, csrfToken)) {
    reply.code(403).send('CSRF token invalid');
    return;
  }
});

// 404 handler
app.setNotFoundHandler((request, reply) => {
  if (request.headers['hx-request']) {
    reply.code(404).send('Not found');
  } else {
    reply.code(404).type('text/html').send(eta.render('404', {}));
  }
});

// Global error handler — prevent leaking internal details
app.setErrorHandler((error, request, reply) => {
  if (process.env.VERCEL) {
    console.error(`[error] ${request.method} ${request.url}:`, error);
  } else {
    request.log.error(error);
  }
  const statusCode = (error as any).statusCode ?? 500;
  if (request.headers['hx-request']) {
    reply.code(statusCode).send('Something went wrong');
  } else {
    reply.code(statusCode).type('text/html').send(
      eta.render('error', { user: (request as any).user, statusCode, errorDetail: error?.message }),
    );
  }
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
app.register(adminAutoTasksRoutes, { prefix: '/admin/auto-tasks' });
app.register(adminClientsRoutes, { prefix: '/admin/clients' });
app.register(adminClientMappingRoutes, { prefix: '/admin/client-mapping' });
app.register(adminPortalUsersRoutes, { prefix: '/admin/portal-users' });
app.register(adminOnboardingRoutes, { prefix: '/admin/onboarding' });
app.register(adminSidebarRoutes, { prefix: '/admin/sidebar' });
app.register(googleOAuthRoutes);
app.register(settingsRoutes, { prefix: '/settings' });
app.register(chatRoutes, { prefix: '/chat' });
app.register(tasksRoutes, { prefix: '/asana-tasks' });
app.register(driveWebhookRoutes, { prefix: '/api/drive' });
app.register(slackInteractRoutes, { prefix: '/api/slack' });
app.register(fathomWebhookRoutes, { prefix: '/api/fathom' });
app.register(driveCronRoutes, { prefix: '/api/cron' });
app.register(taskRunRoutes, { prefix: '/api/tasks' });
app.register(pushRoutes, { prefix: '/api/push' });
app.register(taskRunsUiRoutes, { prefix: '/tasks' });
app.register(skillsBrowserRoutes, { prefix: '/skills-drive' });
app.register(portalRoutes, { prefix: '/portal' });
// Redirect old /client-database URL to unified /clients
app.get('/client-database', async (_req, reply) => reply.redirect('/clients'));
app.register(operationsRoutes, { prefix: '/operations' });
app.register(skillsLibraryRoutes, { prefix: '/skills' });
app.register(onboardPublicRoutes, { prefix: '/onboard' });
app.register(onboardingInternalRoutes, { prefix: '/onboarding' });
app.register(cronRoutes, { prefix: '/api/cron' });
app.register(alertsRoutes, { prefix: '/api/alerts' });
app.register(skillsApiRoutes, { prefix: '/api/skills' });
app.register(videoProductionRoutes, { prefix: '/video-production' });
app.register(deliverablesRoutes, { prefix: '/deliverables' });

// Dashboard modules
app.register(unifiedAdsRoutes, { prefix: '/dashboards/ads' });
app.register(metaDentalRoutes, { prefix: '/dashboards/meta-dental' });
app.register(gadsDentalRoutes, { prefix: '/dashboards/gads-dental' });
app.register(reportingHubRoutes, { prefix: '/dashboards/reporting-hub' });
app.register(clientMerRoutes, { prefix: '/dashboards/client-mer' });
app.register(financeRoutes, { prefix: '/dashboards/finance' });
app.register(timeTrackingRoutes, { prefix: '/dashboards/time-tracking' });
app.register(capacityRoutes, { prefix: '/dashboards/capacity' });
app.register(gadsEcomRoutes, { prefix: '/dashboards/gads-ecom' });
app.register(profitabilityRoutes, { prefix: '/dashboards/profitability' });
app.register(pipelineTrackerRoutes, { prefix: '/dashboards/pipeline' });
app.register(reviewsRoutes, { prefix: '/dashboards/reviews' });
app.register(healthRoutes, { prefix: '/dashboards/health' });

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
