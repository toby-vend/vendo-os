import type { FastifyPluginAsync } from 'fastify';
import { getAllActiveClients, getClientMER } from '../../lib/queries.js';

export const clientMerRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const clientId = q.client ? parseInt(q.client, 10) : undefined;
    const months = parseInt(q.months || '6', 10);
    const clients = await getAllActiveClients();
    const merData = clientId ? await getClientMER(clientId, months) : [];
    const selectedClient = clients.find(c => c.id === clientId) ?? null;
    reply.render('dashboards/client-mer', { clients, merData, months, selectedClient, query: q });
  });
};
