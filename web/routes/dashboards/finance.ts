import type { FastifyPluginAsync } from 'fastify';
import { getFinanceOverview, getRevenueTrend, getOutstandingInvoices } from '../../lib/queries.js';

export const financeRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_request, reply) => {
    const [overview, trend, overdue] = await Promise.all([
      getFinanceOverview(),
      getRevenueTrend(12),
      getOutstandingInvoices(),
    ]);
    reply.render('dashboards/finance', { overview, trend, overdue });
  });
};
