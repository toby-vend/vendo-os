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
import { createTaskFromOverride, getAsanaProjectForClient } from '../../lib/jobs/sync-actions-to-asana.js';
import {
  assignAsanaTask,
  addAsanaTaskToProject,
  removeAsanaTaskFromProject,
} from '../../lib/asana/tasks.js';
import { resolveAssignee } from '../../lib/asana/assignee.js';
import { db } from '../../lib/queries/base.js';

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

  // POST /update-assignee — reassign the Asana task and persist the new
  // name on the sync row. Expects double-confirm client-side.
  app.post('/update-assignee', async (request, reply) => {
    const body = request.body as { sync_id?: string; task_gid?: string; new_assignee?: string };
    const syncId = parseInt(body.sync_id || '', 10);
    const taskGid = (body.task_gid || '').trim();
    const newAssignee = (body.new_assignee || '').trim();
    if (!Number.isFinite(syncId) || !taskGid || !newAssignee) {
      reply.redirect('/admin/auto-tasks?error=missing_fields');
      return;
    }
    const assigneeGid = await resolveAssignee(newAssignee);
    if (!assigneeGid) {
      reply.redirect('/admin/auto-tasks?error=assignee_not_found');
      return;
    }
    try {
      await assignAsanaTask(taskGid, assigneeGid);
      await db.execute({
        sql: 'UPDATE fathom_asana_synced SET assignee = ? WHERE id = ?',
        args: [newAssignee, syncId],
      });
      reply.redirect('/admin/auto-tasks?updated=assignee');
    } catch (err) {
      request.log.error({ err, syncId, taskGid }, 'Assignee update failed');
      reply.redirect('/admin/auto-tasks?error=update_failed');
    }
  });

  // POST /update-client — move the task to a different client's Asana
  // project AND patch meetings.client_name so future auto-tasks route
  // correctly. Expects double-confirm client-side.
  app.post('/update-client', async (request, reply) => {
    const body = request.body as {
      task_gid?: string;
      meeting_id?: string;
      new_client?: string;
      old_client?: string;
    };
    const taskGid = (body.task_gid || '').trim();
    const meetingId = (body.meeting_id || '').trim();
    const newClient = (body.new_client || '').trim();
    const oldClient = (body.old_client || '').trim();
    if (!taskGid || !newClient) {
      reply.redirect('/admin/auto-tasks?error=missing_fields');
      return;
    }
    if (newClient === oldClient) {
      reply.redirect('/admin/auto-tasks?error=no_change');
      return;
    }
    try {
      const newProject = await getAsanaProjectForClient(newClient);
      if (!newProject) {
        reply.redirect('/admin/auto-tasks?error=client_project_missing');
        return;
      }
      await addAsanaTaskToProject(taskGid, newProject);
      if (oldClient) {
        const oldProject = await getAsanaProjectForClient(oldClient);
        if (oldProject && oldProject !== newProject) {
          try {
            await removeAsanaTaskFromProject(taskGid, oldProject);
          } catch (err) {
            request.log.warn({ err, taskGid, oldProject }, 'Could not remove from old project — likely already removed');
          }
        }
      }
      if (meetingId) {
        await db.execute({
          sql: 'UPDATE meetings SET client_name = ? WHERE id = ?',
          args: [newClient, meetingId],
        });
      }
      reply.redirect('/admin/auto-tasks?updated=client');
    } catch (err) {
      request.log.error({ err, taskGid, meetingId }, 'Client update failed');
      reply.redirect('/admin/auto-tasks?error=update_failed');
    }
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
