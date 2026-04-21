import type { FastifyPluginAsync } from 'fastify';
import {
  getRecentAutoTasks,
  recordRejection,
  undoRejection,
  normaliseForMatch,
  getClientOptions,
  getAssigneeOptions,
} from '../../lib/queries/auto-tasks.js';
import {
  getRecentQaSkips,
  getQaSkipById,
  recordQaOverride,
} from '../../lib/qa/auto-task-qa.js';
import { createTaskFromOverride } from '../../lib/jobs/sync-actions-to-asana.js';

/**
 * QA dashboard for auto-created Asana tasks. Lets the user flag irrelevant
 * tasks with a reason — future syncs then auto-skip anything with the same
 * normalised text.
 */
const adminAutoTasksRoutes: FastifyPluginAsync = async (app) => {
  // GET / — list recent auto-tasks with rejection status + recent agent blocks
  app.get('/', async (_request, reply) => {
    const [tasks, clientOptions, assigneeOptions, qaSkips] = await Promise.all([
      getRecentAutoTasks(150),
      getClientOptions(),
      getAssigneeOptions(),
      getRecentQaSkips(50),
    ]);
    reply.render('admin/auto-tasks', { tasks, clientOptions, assigneeOptions, qaSkips });
  });

  // POST /reject — mark an auto-created task as "not relevant". Optional
  // client_name / assignee scope the rule — leave blank to reject globally.
  app.post('/reject', async (request, reply) => {
    const body = request.body as {
      task_gid?: string;
      task_name?: string;
      reason?: string;
      client_name?: string;
      assignee?: string;
    };
    const taskName = (body.task_name || '').trim();
    const reason = (body.reason || '').trim();
    if (!taskName || !reason) {
      reply.redirect('/admin/auto-tasks?error=missing_fields');
      return;
    }
    const clientName = (body.client_name || '').trim() || null;
    const assignee = (body.assignee || '').trim() || null;
    const session = (request as unknown as { session?: { userId?: string } }).session;
    await recordRejection({
      taskGid: body.task_gid || null,
      taskName,
      clientName,
      assignee,
      reason,
      userId: session?.userId || null,
    });
    reply.redirect('/admin/auto-tasks?rejected=1');
  });

  // POST /override/:id — record an admin decision on an agent block. If
  // decision=wrong_call, the task is created in Asana now (bypassing the QA
  // checks) and the resulting gid is stored on the override row for audit.
  app.post<{ Params: { id: string } }>('/override/:id', async (request, reply) => {
    const skipId = parseInt(request.params.id, 10);
    if (!Number.isFinite(skipId)) {
      reply.redirect('/admin/auto-tasks?error=bad_id');
      return;
    }
    const body = request.body as { decision?: string; note?: string };
    const decision = body.decision === 'wrong_call' ? 'wrong_call' : 'correct_call';
    const note = (body.note || '').trim() || null;
    const session = (request as unknown as { session?: { userId?: string } }).session;

    let createdTaskGid: string | null = null;
    if (decision === 'wrong_call') {
      const skip = await getQaSkipById(skipId);
      if (skip) {
        try {
          createdTaskGid = await createTaskFromOverride({
            taskName: skip.task_name,
            clientName: skip.client_name,
            assignee: skip.assignee,
            source: skip.source || 'QA override',
          });
        } catch (err) {
          request.log.error({ err, skipId }, 'Failed to create task from QA override');
          reply.redirect('/admin/auto-tasks?error=create_failed');
          return;
        }
      }
    }

    await recordQaOverride({
      qaSkipId: skipId,
      decision,
      note,
      createdTaskGid,
      userId: session?.userId || null,
    });
    reply.redirect('/admin/auto-tasks?overridden=1');
  });

  // POST /undo — clear a specific scoped rejection.
  app.post('/undo', async (request, reply) => {
    const body = request.body as { task_name?: string; client_name?: string; assignee?: string };
    const taskName = (body.task_name || '').trim();
    if (!taskName) {
      reply.redirect('/admin/auto-tasks?error=missing_fields');
      return;
    }
    const clientName = (body.client_name || '').trim() || null;
    const assignee = (body.assignee || '').trim() || null;
    await undoRejection(normaliseForMatch(taskName), clientName, assignee);
    reply.redirect('/admin/auto-tasks?undone=1');
  });
};

export { adminAutoTasksRoutes };
