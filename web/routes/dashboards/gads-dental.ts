import type { FastifyPluginAsync } from 'fastify';

export const gadsDentalRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const params = new URLSearchParams();
    params.set('platform', 'google');
    if (q.days) params.set('days', q.days);
    if (q.client) params.set('client', q.client);
    reply.redirect(`/dashboards/ads?${params.toString()}`);
  });
};
