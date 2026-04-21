import type { FastifyPluginAsync } from 'fastify';
import {
  getRecentAutoTasks,
  recordRejection,
  undoRejection,
  normaliseForMatch,
} from '../../lib/queries/auto-tasks.js';

/**
 * QA dashboard for auto-created Asana tasks. Lets the user flag irrelevant
 * tasks with a reason — future syncs then auto-skip anything with the same
 * normalised text.
 */
const adminAutoTasksRoutes: FastifyPluginAsync = async (app) => {
  // GET / — list recent auto-tasks with rejection status
  app.get('/', async (_request, reply) => {
    const tasks = await getRecentAutoTasks(150);
    reply.render('admin/auto-tasks', { tasks });
  });

  // POST /reject — mark an auto-created task as "not relevant"
  app.post('/reject', async (request, reply) => {
    const body = request.body as { task_gid?: string; task_name?: string; reason?: string };
    const taskName = (body.task_name || '').trim();
    const reason = (body.reason || '').trim();
    if (!taskName || !reason) {
      reply.redirect('/admin/auto-tasks?error=missing_fields');
      return;
    }
    const session = (request as unknown as { session?: { userId?: string } }).session;
    await recordRejection({
      taskGid: body.task_gid || null,
      taskName,
      reason,
      userId: session?.userId || null,
    });
    reply.redirect('/admin/auto-tasks?rejected=1');
  });

  // POST /undo — clear a rejection so future matching tasks sync again
  app.post('/undo', async (request, reply) => {
    const body = request.body as { task_name?: string };
    const taskName = (body.task_name || '').trim();
    if (!taskName) {
      reply.redirect('/admin/auto-tasks?error=missing_fields');
      return;
    }
    await undoRejection(normaliseForMatch(taskName));
    reply.redirect('/admin/auto-tasks?undone=1');
  });
};

export { adminAutoTasksRoutes };
