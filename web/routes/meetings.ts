import type { FastifyPluginAsync } from 'fastify';
import { searchMeetings, getMeetingById, getMeetingActionItems, getCategories, getClientNames } from '../lib/queries.js';

export const meetingsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const page = Math.max(1, parseInt(q.page || '1', 10));
    const limit = 20;

    const [result, categories, clientNames] = await Promise.all([
      searchMeetings({
        search: q.search || undefined,
        client: q.client || undefined,
        category: q.category || undefined,
        from: q.from || undefined,
        to: q.to || undefined,
        limit,
        offset: (page - 1) * limit,
      }),
      getCategories(),
      getClientNames(),
    ]);

    const totalPages = Math.ceil(result.total / limit);

    if (request.headers['hx-request']) {
      reply.render('meetings/results', { meetings: result.meetings, total: result.total, page, totalPages, query: q });
      return;
    }

    reply.render('meetings/list', {
      meetings: result.meetings,
      total: result.total,
      categories,
      clientNames,
      page,
      totalPages,
      query: q,
    });
  });

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const meeting = await getMeetingById(id);
    if (!meeting) { reply.code(404).send('Meeting not found'); return; }
    const actions = await getMeetingActionItems(id);
    reply.render('meetings/detail', { meeting, actions });
  });
};
