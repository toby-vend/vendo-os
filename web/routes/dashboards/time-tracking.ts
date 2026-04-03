import type { FastifyPluginAsync } from 'fastify';
import { getTimeTrackingData, getProjectBudgets, getTeamUtilisation, getHarvestUsers } from '../../lib/queries.js';

export const timeTrackingRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const days = parseInt(q.days || '30', 10);
    const userId = q.user ? parseInt(q.user, 10) : undefined;
    const [users, timeData, budgets, utilisation] = await Promise.all([
      getHarvestUsers(),
      getTimeTrackingData(days, userId),
      getProjectBudgets(days),
      getTeamUtilisation(days),
    ]);
    reply.render('dashboards/time-tracking', { users, timeData, budgets, utilisation, days, query: q });
  });
};
