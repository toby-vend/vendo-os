import type { FastifyPluginAsync } from 'fastify';
import { getNotifications, getUnreadCount, markRead, markAllRead } from '../../lib/queries.js';

export const notificationRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/notifications — list notifications for current user
  app.get('/', async (request, reply) => {
    const userId = (request as any).user?.id ?? 0;
    const [notifications, unread] = await Promise.all([
      getNotifications(userId),
      getUnreadCount(userId),
    ]);
    return reply.send({ notifications, unread });
  });

  // GET /api/notifications/count — unread count only
  app.get('/count', async (request, reply) => {
    const userId = (request as any).user?.id ?? 0;
    const unread = await getUnreadCount(userId);
    return reply.send({ unread });
  });

  // POST /api/notifications/:id/read — mark one as read
  app.post('/:id/read', async (request, reply) => {
    const { id } = request.params as { id: string };
    await markRead(Number(id));
    return reply.send({ ok: true });
  });

  // POST /api/notifications/read-all — mark all as read
  app.post('/read-all', async (request, reply) => {
    const userId = (request as any).user?.id ?? 0;
    await markAllRead(userId);
    return reply.send({ ok: true });
  });
};
