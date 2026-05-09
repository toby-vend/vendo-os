import type { FastifyPluginAsync } from 'fastify';
import {
  getDashboardStats,
  getRecentExternalComments,
  getClientSummaries,
  getActivityFeed,
} from '../../lib/queries/frameio-dashboard.js';
import { getConnectionStatus } from '../../lib/frameio/auth.js';

/**
 * GET /dashboards/frame-io — Phase 4 of the Frame.io integration.
 *
 * Surfaces:
 *   - OAuth connection state + 24-hour processing health
 *   - Stats: pending reviews, comment volume (today + 7d, total + external)
 *   - Recent client comments awaiting response
 *   - Per-client summary table
 *   - Raw activity feed for the last 30 events
 *
 * All data flows through queries that tolerate missing tables — a fresh
 * environment without any Frame.io traffic still renders cleanly.
 */
export const frameIoDashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_request, reply) => {
    const [connection, stats, recentComments, clientSummaries, activity] = await Promise.all([
      getConnectionStatus(),
      getDashboardStats(),
      getRecentExternalComments(15),
      getClientSummaries(),
      getActivityFeed(30),
    ]);

    reply.render('dashboards/frame-io', {
      connection,
      stats,
      recentComments,
      clientSummaries,
      activity,
    });
  });
};
