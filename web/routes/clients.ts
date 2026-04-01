import type { FastifyPluginAsync } from 'fastify';
import { getClients, getClientByName } from '../lib/queries.js';

export const clientsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_request, reply) => {
    const clients = await getClients();
    reply.render('clients/list', { clients });
  });

  app.get('/:name', async (request, reply) => {
    const { name } = request.params as { name: string };
    const decoded = decodeURIComponent(name);
    const data = await getClientByName(decoded);
    if (!data.client) { reply.code(404).send('Client not found'); return; }
    reply.render('clients/detail', data);
  });
};
