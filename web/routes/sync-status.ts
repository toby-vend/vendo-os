import type { FastifyPluginAsync } from 'fastify';
import { getSyncStatus } from '../lib/queries.js';

export const syncStatusRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_request, reply) => {
    const sources = await getSyncStatus();
    reply.render('sync-status', { sources });
  });
};
