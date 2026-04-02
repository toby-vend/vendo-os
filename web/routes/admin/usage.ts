import type { FastifyPluginAsync } from 'fastify';
import {
  getUsageSummary,
  getUsageByModel,
  getUsageByFeature,
  getAllUsersWithUsage,
  setUserTokenLimits,
  estimateCost,
} from '../../lib/queries/usage.js';

const adminUsageRoutes: FastifyPluginAsync = async (app) => {
  // GET / — usage dashboard
  app.get('/', async (request, reply) => {
    const { from, to } = request.query as { from?: string; to?: string };
    const filter = { from: from || undefined, to: to || undefined };

    const [summary, usersWithUsage, byModel, byFeature] = await Promise.all([
      getUsageSummary(filter),
      getAllUsersWithUsage(filter),
      getUsageByModel(filter),
      getUsageByFeature(filter),
    ]);

    reply.render('admin/usage', {
      summary,
      usersWithUsage,
      byModel,
      byFeature,
      estimateCost,
      from: from || '',
      to: to || '',
    });
  });

  // POST /limits/:userId — set or clear token limits
  app.post<{ Params: { userId: string } }>('/limits/:userId', async (request, reply) => {
    const { userId } = request.params;
    const body = request.body as { monthly_limit?: string; daily_limit?: string };

    const parseLimit = (val?: string): number | null => {
      const trimmed = val?.trim();
      if (!trimmed || trimmed === '') return null;
      const num = parseInt(trimmed, 10);
      if (isNaN(num) || num < 0) return null;
      return num;
    };

    await setUserTokenLimits(userId, {
      monthly: parseLimit(body.monthly_limit),
      daily: parseLimit(body.daily_limit),
    });

    reply.redirect('/admin/usage');
  });
};

export { adminUsageRoutes };
