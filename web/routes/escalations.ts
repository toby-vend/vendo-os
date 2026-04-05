import type { FastifyPluginAsync } from 'fastify';
import { getEscalations, getEscalationStats, addEscalation, resolveEscalation } from '../lib/queries.js';

export const escalationsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const statusFilter = query.status || undefined;
    const [escalations, stats] = await Promise.all([
      getEscalations(statusFilter),
      getEscalationStats(),
    ]);
    reply.render('escalations', { escalations, stats, statusFilter: statusFilter || '' });
  });

  app.post('/raise', async (request, reply) => {
    const body = request.body as Record<string, string>;
    const clientName = (body.client_name || '').trim();
    const tier = body.tier || 'am';
    const description = (body.description || '').trim();

    if (!clientName || !description) return reply.redirect('/escalations?error=required');

    await addEscalation(clientName, tier, description);
    return reply.redirect('/escalations');
  });

  app.post('/:id/resolve', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, string>;
    const resolution = (body.resolution || '').trim();
    if (!resolution) return reply.redirect('/escalations');

    await resolveEscalation(Number(id), resolution);
    return reply.redirect('/escalations');
  });
};
