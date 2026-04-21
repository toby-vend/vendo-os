import type { FastifyPluginAsync } from 'fastify';
import { getDashboardStats } from '../lib/queries.js';
import { getFinanceOverview, getRevenueTrend } from '../lib/queries/dashboards.js';
import { getPipelineOverview, countStalledDeals, VENDO_LOCATION_ID } from '../lib/queries/pipeline.js';

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const user = (request as any).user;
    const isAdmin = user?.role === 'admin';

    // Queries for all users
    const baseQueries = Promise.all([
      getDashboardStats(),
    ]);

    // Additional queries for admin users.
    // Pipeline data is scoped to Vendo's own GHL location so client sub-account
    // pipelines (Invisalign, General Dentistry, etc.) don't bloat agency figures.
    // Revenue trend pulls 4 months so we have two completed months to compare
    // even when the current month's partial P&L row exists.
    const adminQueries = isAdmin
      ? Promise.all([
          getFinanceOverview(),
          getPipelineOverview(undefined, VENDO_LOCATION_ID),
          countStalledDeals(14, undefined, VENDO_LOCATION_ID),
          getRevenueTrend(4),
        ])
      : Promise.resolve(null);

    const [baseResults, adminResults] = await Promise.all([baseQueries, adminQueries]);
    const [stats] = baseResults;

    const data: Record<string, unknown> = { stats, isAdmin };

    if (adminResults) {
      const [finance, pipelineOverviews, stalledCount, revenueTrend] = adminResults;
      // Aggregate across Vendo's sales pipelines
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

      // Separate the current (partial) month from completed months so the
      // "vs last month" comparison is between two full completed months.
      const nowMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const completed = revenueTrend.filter(r => r.period.slice(0, 7) !== nowMonth);
      const currentMonthRow = revenueTrend.find(r => r.period.slice(0, 7) === nowMonth) ?? null;
      const current = completed.length > 0 ? completed[completed.length - 1] : null;
      const previous = completed.length > 1 ? completed[completed.length - 2] : null;

      // Margin from last completed month; computed from income/expenses so a
      // zero `net_profit` column (historical sync bug) doesn't mask the truth.
      const marginPct = current && current.income > 0
        ? Math.round((current.income - current.expenses) / current.income * 1000) / 10
        : 0;
      const revChange = current && previous && previous.income > 0
        ? Math.round((current.income - previous.income) / previous.income * 1000) / 10
        : 0;

      data.finance = finance;
      data.pipeline = pipeline;
      data.stalledCount = stalledCount;
      data.marginPct = marginPct;
      data.revChange = revChange;
      // Dashboard shows this under "vs Last Month" — use current month-to-date
      // if available, else fall back to last completed month.
      data.currentIncome = currentMonthRow?.income ?? current?.income ?? 0;
    }

    reply.render('dashboard', data);
  });
};
