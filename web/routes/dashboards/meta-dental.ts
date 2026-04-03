import type { FastifyPluginAsync } from 'fastify';
import { getDentalClients, getMetaDentalData } from '../../lib/queries.js';

export const metaDentalRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const days = parseInt(q.days || '30', 10);
    const clientId = q.client ? parseInt(q.client, 10) : undefined;
    const [clients, data] = await Promise.all([
      getDentalClients(),
      getMetaDentalData(days, clientId),
    ]);
    const totalSpend = data.reduce((s, r) => s + r.spend, 0);
    const totalLeads = data.reduce((s, r) => s + r.leads, 0);
    const avgCPL = totalLeads > 0 ? Math.round(totalSpend / totalLeads * 100) / 100 : 0;
    reply.render('dashboards/meta-dental', { clients, data, days, totalSpend, totalLeads, avgCPL, query: q });
  });
};
