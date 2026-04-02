import type { FastifyPluginAsync } from 'fastify';
import {
  getUsageSummary,
  getUsageByUser,
  getUsageByModel,
  getUsageByFeature,
  getAllUserLimits,
  setUserTokenLimit,
  estimateCost,
} from '../../lib/queries/usage.js';
const adminUsageRoutes: FastifyPluginAsync = async (app) => {
  // GET / — usage dashboard
  app.get('/', async (request, reply) => {
    const { from, to } = request.query as { from?: string; to?: string };
    const filter = { from: from || undefined, to: to || undefined };

    const [summary, byUser, byModel, byFeature, userLimits] = await Promise.all([
      getUsageSummary(filter),
      getUsageByUser(filter),
      getUsageByModel(filter),
      getUsageByFeature(filter),
      getAllUserLimits(),
    ]);

    // Build a limits lookup by user_id
    const limitsMap = new Map(userLimits.map(l => [l.user_id, l]));

    reply.render('admin/usage', {
      summary,
      byUser,
      byModel,
      byFeature,
      limitsMap,
      estimateCost,
      from: from || '',
      to: to || '',
    });
  });

  // POST /limits/:userId — set or clear token limit
  app.post<{ Params: { userId: string } }>('/limits/:userId', async (request, reply) => {
    const { userId } = request.params;
    const body = request.body as { monthly_limit?: string };
    const rawLimit = body.monthly_limit?.trim();

    const limit = rawLimit && rawLimit !== '' ? parseInt(rawLimit, 10) : null;
    if (limit !== null && (isNaN(limit) || limit < 0)) {
      reply.code(400).send({ error: 'Invalid limit value' });
      return;
    }

    await setUserTokenLimit(userId, limit);
    reply.redirect('/admin/usage');
  });
};

export { adminUsageRoutes };
