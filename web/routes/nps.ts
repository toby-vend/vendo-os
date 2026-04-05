import type { FastifyPluginAsync } from 'fastify';
import { getNpsResponses, getNpsStats, addNpsResponse, updateNpsFollowUp } from '../lib/queries.js';

export const npsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_request, reply) => {
    const [responses, stats] = await Promise.all([getNpsResponses(), getNpsStats()]);
    reply.render('nps', { responses, stats });
  });

  app.post('/add', async (request, reply) => {
    const body = request.body as Record<string, string>;
    const clientName = (body.client_name || '').trim();
    const score = parseInt(body.score, 10);
    const feedback = (body.feedback || '').trim() || null;

    if (!clientName || isNaN(score) || score < 0 || score > 10) {
      return reply.redirect('/nps?error=invalid');
    }

    await addNpsResponse(clientName, score, feedback);
    return reply.redirect('/nps');
  });

  app.post('/:id/follow-up', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, string>;
    const action = (body.action || '').trim();
    const done = body.done === '1';
    await updateNpsFollowUp(Number(id), action, done);
    return reply.redirect('/nps');
  });
};
