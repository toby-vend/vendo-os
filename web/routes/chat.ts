import type { FastifyPluginAsync } from 'fastify';

export const chatRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_request, reply) => {
    reply.render('chat', {});
  });
};
