import type { FastifyPluginAsync } from 'fastify';
import { getAllActiveClients, getReportingHubData } from '../../lib/queries.js';

export const reportingHubRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const days = parseInt(q.days || '30', 10);
    const clientId = q.client ? parseInt(q.client, 10) : undefined;
    const clients = await getAllActiveClients();
    const report = clientId ? await getReportingHubData(clientId, days) : null;
    reply.render('dashboards/reporting-hub', { clients, report, days, query: q });
  });
};
