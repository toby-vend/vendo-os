import type { FastifyPluginAsync } from 'fastify';
import { getAllActiveClients, getUnifiedAdsData, getDailyAdSpend } from '../../lib/queries.js';

export const unifiedAdsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const days = parseInt(q.days || '30', 10);
    const platform = (q.platform === 'meta' || q.platform === 'google') ? q.platform : undefined;
    const clientId = q.client ? parseInt(q.client, 10) : undefined;

    const [clients, data, dailySpend] = await Promise.all([
      getAllActiveClients(),
      getUnifiedAdsData(days, platform, clientId),
      getDailyAdSpend(days, clientId),
    ]);

    const totalSpend = data.reduce((s, r) => s + r.spend, 0);
    const totalConversions = data.reduce((s, r) => s + r.conversions, 0);
    const totalValue = data.reduce((s, r) => s + r.conversion_value, 0);
    const avgCPA = totalConversions > 0 ? Math.round(totalSpend / totalConversions * 100) / 100 : 0;
    const blendedROAS = totalSpend > 0 ? Math.round(totalValue / totalSpend * 100) / 100 : 0;

    reply.render('dashboards/ads', {
      clients,
      data,
      dailySpend,
      days,
      platform: platform || '',
      totalSpend,
      totalConversions,
      totalValue,
      avgCPA,
      blendedROAS,
      query: q,
    });
  });
};
