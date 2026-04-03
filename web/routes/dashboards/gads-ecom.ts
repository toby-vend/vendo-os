import type { FastifyPluginAsync } from 'fastify';
import { getEcomClients, getGadsEcomData, getGadsEcomWoW } from '../../lib/queries.js';

export const gadsEcomRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const days = parseInt(q.days || '30', 10);
    const clientId = q.client ? parseInt(q.client, 10) : undefined;
    const [clients, data, wow] = await Promise.all([
      getEcomClients(),
      getGadsEcomData(days, clientId),
      getGadsEcomWoW(clientId),
    ]);
    const totalSpend = data.reduce((s, r) => s + r.spend, 0);
    const totalRevenue = data.reduce((s, r) => s + r.conversion_value, 0);
    const blendedROAS = totalSpend > 0 ? Math.round(totalRevenue / totalSpend * 100) / 100 : 0;
    const wowMap = new Map(wow.map(w => [w.client_id, w]));
    reply.render('dashboards/gads-ecom', { clients, data, wow: wowMap, days, totalSpend, totalRevenue, blendedROAS, query: q });
  });
};
