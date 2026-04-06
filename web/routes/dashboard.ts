import type { FastifyPluginAsync } from 'fastify';
import { getDashboardStats } from '../lib/queries.js';
import { getFinanceOverview, getRevenueTrend } from '../lib/queries/dashboards.js';
import { getPipelineOverview, getStalledDeals } from '../lib/queries/pipeline.js';

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const user = (request as any).user;
    const isAdmin = user?.role === 'admin';

    // Queries for all users
    const baseQueries = Promise.all([
      getDashboardStats(),
    ]);

    // Additional queries for admin users
    const adminQueries = isAdmin
      ? Promise.all([
          getFinanceOverview(),
          getPipelineOverview(),
          getStalledDeals(14),
          getRevenueTrend(2),
        ])
      : Promise.resolve(null);

    const [baseResults, adminResults] = await Promise.all([baseQueries, adminQueries]);
    const [stats] = baseResults;

    const data: Record<string, unknown> = { stats, isAdmin };

    if (adminResults) {
      const [finance, pipelineOverviews, stalledDeals, revenueTrend] = adminResults;
      // Aggregate across all pipelines
      const pipeline = {
        totalOpen: pipelineOverviews.reduce((s, p) => s + p.totalOpen, 0),
        totalOpenValue: pipelineOverviews.reduce((s, p) => s + p.totalOpenValue, 0),
        wonThisMonth: pipelineOverviews.reduce((s, p) => s + p.wonThisMonth, 0),
        wonThisMonthValue: pipelineOverviews.reduce((s, p) => s + p.wonThisMonthValue, 0),
        lostThisMonth: pipelineOverviews.reduce((s, p) => s + p.lostThisMonth, 0),
        // Count proposals: stages with "proposal" in name
        proposalsOut: pipelineOverviews.reduce((s, p) =>
          s + p.stages.filter(st => st.name.toLowerCase().includes('proposal')).reduce((ss, st) => ss + st.count, 0), 0),
      };
      // Revenue trend: compare last 2 months
      const current = revenueTrend.length > 0 ? revenueTrend[revenueTrend.length - 1] : null;
      const previous = revenueTrend.length > 1 ? revenueTrend[revenueTrend.length - 2] : null;
      const marginPct = current && current.income > 0
        ? Math.round(current.net / current.income * 1000) / 10
        : 0;
      const revChange = current && previous && previous.income > 0
        ? Math.round((current.income - previous.income) / previous.income * 1000) / 10
        : 0;

      data.finance = finance;
      data.pipeline = pipeline;
      data.stalledCount = stalledDeals.length;
      data.marginPct = marginPct;
      data.revChange = revChange;
      data.currentIncome = current?.income ?? 0;
    }

    reply.render('dashboard', data);
  });
};
