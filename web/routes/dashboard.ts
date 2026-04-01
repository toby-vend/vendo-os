import type { FastifyPluginAsync } from 'fastify';
import { getDashboardStats, getRecentMeetings, getActionsByAssignee, getSyncStatus } from '../lib/queries.js';

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_request, reply) => {
    const [stats, recentMeetings, assigneeSummary, syncStatus] = await Promise.all([
      getDashboardStats(),
      getRecentMeetings(5),
      getActionsByAssignee(),
      getSyncStatus(),
    ]);

    reply.render('dashboard', { stats, recentMeetings, assigneeSummary, syncStatus });
  });
};
