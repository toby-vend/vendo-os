import type { FastifyPluginAsync } from 'fastify';
import { getActionItems, getActionsByAssignee, getAssignees } from '../lib/queries.js';

export const actionItemsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const page = Math.max(1, parseInt(q.page || '1', 10));
    const limit = 50;

    const [result, assigneeSummary, assignees] = await Promise.all([
      getActionItems({
        assignee: q.assignee || undefined,
        status: (q.status as 'open' | 'completed' | 'all') || 'all',
        from: q.from || undefined,
        to: q.to || undefined,
        limit,
        offset: (page - 1) * limit,
      }),
      getActionsByAssignee(),
      getAssignees(),
    ]);

    const totalPages = Math.ceil(result.total / limit);

    reply.render('action-items', {
      items: result.items,
      total: result.total,
      assigneeSummary,
      assignees,
      page,
      totalPages,
      query: q,
    });
  });
};
