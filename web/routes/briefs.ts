import type { FastifyPluginAsync } from 'fastify';
import { listBriefs, getBriefContent } from '../lib/queries.js';

export const briefsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_request, reply) => {
    const briefs = listBriefs();
    reply.render('briefs/list', { briefs });
  });

  app.get('/:date', async (request, reply) => {
    const { date } = request.params as { date: string };
    const content = getBriefContent(date);
    if (content === null) { reply.code(404).send('Brief not found'); return; }
    reply.render('briefs/detail', { date, content });
  });
};
