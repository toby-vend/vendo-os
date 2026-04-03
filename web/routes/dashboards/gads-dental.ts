import type { FastifyPluginAsync } from 'fastify';
import { getDentalClients, getGadsDentalData, getGadsDentalWoW } from '../../lib/queries.js';

export const gadsDentalRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const days = parseInt(q.days || '30', 10);
    const clientId = q.client ? parseInt(q.client, 10) : undefined;
    const [clients, data, wow] = await Promise.all([
      getDentalClients(),
      getGadsDentalData(days, clientId),
      getGadsDentalWoW(clientId),
    ]);
    const totalSpend = data.reduce((s, r) => s + r.spend, 0);
    const totalConversions = data.reduce((s, r) => s + r.conversions, 0);
    const avgCPA = totalConversions > 0 ? Math.round(totalSpend / totalConversions * 100) / 100 : 0;
    // Build WoW lookup
    const wowMap = new Map(wow.map(w => [w.client_id, w]));
    reply.render('dashboards/gads-dental', { clients, data, wow: wowMap, days, totalSpend, totalConversions, avgCPA, query: q });
  });
};
