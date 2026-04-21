import type { FastifyPluginAsync } from 'fastify';
import {
  getUsageSummary,
  getUsageByModel,
  getUsageByFeature,
  getAllUsersWithUsage,
  getMonthlyForecast,
  getAsanaTaskVolume,
  setUserCostLimits,
  estimateCostGbp,
} from '../../lib/queries/usage.js';
import { getRejectionSummary } from '../../lib/queries/auto-tasks.js';

const adminUsageRoutes: FastifyPluginAsync = async (app) => {
  // GET / — usage dashboard
  app.get('/', async (request, reply) => {
    const { from, to } = request.query as { from?: string; to?: string };
    const filter = { from: from || undefined, to: to || undefined };

    const [summary, usersWithUsage, byModel, byFeature, forecast, asanaVolume, rejections] = await Promise.all([
      getUsageSummary(filter),
      getAllUsersWithUsage(filter),
      getUsageByModel(filter),
      getUsageByFeature(filter),
      getMonthlyForecast(),
      getAsanaTaskVolume(),
      getRejectionSummary(),
    ]);

    reply.render('admin/usage', {
      summary,
      usersWithUsage,
      byModel,
      byFeature,
      forecast,
      asanaVolume,
      rejections,
      estimateCostGbp,
      from: from || '',
      to: to || '',
    });
  });

  // POST /limits/:userId — set or clear cost limits (input in £, stored as pence)
  app.post<{ Params: { userId: string } }>('/limits/:userId', async (request, reply) => {
    const { userId } = request.params;
    const body = request.body as { monthly_limit?: string; daily_limit?: string };

    const poundsToNullablePence = (val?: string): number | null => {
      const trimmed = val?.trim();
      if (!trimmed || trimmed === '') return null;
      const pounds = parseFloat(trimmed);
      if (isNaN(pounds) || pounds < 0) return null;
      return Math.round(pounds * 100);
    };

    await setUserCostLimits(userId, {
      monthlyPence: poundsToNullablePence(body.monthly_limit),
      dailyPence: poundsToNullablePence(body.daily_limit),
    });

    reply.redirect('/admin/usage');
  });
};

export { adminUsageRoutes };
