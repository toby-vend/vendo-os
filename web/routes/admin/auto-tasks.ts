import type { FastifyPluginAsync } from 'fastify';
import {
  getRecentAutoTasks,
  recordRejection,
  undoRejection,
  normaliseForMatch,
  getClientOptions,
  getAssigneeOptions,
  getAllRejections,
} from '../../lib/queries/auto-tasks.js';
import {
  getRecentQaSkips,
  getQaSkipById,
  recordQaOverride,
  resetQaCache,
} from '../../lib/qa/auto-task-qa.js';
import {
  getRecentRoutingDecisions,
  rerunMeetingAsStandard,
} from '../../lib/classification/router.js';
import { createTaskFromOverride, getAsanaProjectForClient } from '../../lib/jobs/sync-actions-to-asana.js';
import {
  assignAsanaTask,
  addAsanaTaskToProject,
  removeAsanaTaskFromProject,
  createPrivateAsanaTask,
} from '../../lib/asana/tasks.js';
import type { SessionUser } from '../../lib/auth.js';
import { resolveAssignee } from '../../lib/asana/assignee.js';
import { db } from '../../lib/queries/base.js';

/**
 * QA dashboard for auto-created Asana tasks. Lets the user flag irrelevant
 * tasks with a reason — future syncs then auto-skip anything with the same
 * normalised text.
 */
const adminAutoTasksRoutes: FastifyPluginAsync = async (app) => {
  // GET / — list recent auto-tasks with rejection status + recent agent blocks + routing decisions
  app.get('/', async (_request, reply) => {
    const [tasks, clientOptions, assigneeOptions, qaSkips, routingDecisions] = await Promise.all([
      getRecentAutoTasks(150),
      getClientOptions(),
      getAssigneeOptions(),
      getRecentQaSkips(50),
      getRecentRoutingDecisions(30),
    ]);
    reply.render('admin/auto-tasks', { tasks, clientOptions, assigneeOptions, qaSkips, routingDecisions });
  });

  // GET /learnings — readable dump of every rejection rule + recent QA
  // agent blocks with admin verdicts. This is what the Haiku QA agent
  // consumes as context, rendered so you can scan it without SQL.
  app.get('/learnings', async (_request, reply) => {
    const [rejections, qaSkips] = await Promise.all([
      getAllRejections(),
      getRecentQaSkips(200),
    ]);
    reply.render('admin/auto-task-learnings', { rejections, qaSkips });
  });

  // POST /rerun/:meetingId — manual override: re-run a DIRECTOR/SLT/
  // FAILSAFE meeting through STANDARD routing (normal multi-project
  // Asana task creation). Idempotent via fathom_asana_synced dedupe.
  app.post<{ Params: { meetingId: string } }>('/rerun/:meetingId', async (request, reply) => {
    const meetingId = request.params.meetingId;
    if (!meetingId) {
      reply.redirect('/admin/auto-tasks?error=missing_meeting_id');
      return;
    }
    try {
      const result = await rerunMeetingAsStandard(meetingId);
      if (!result) {
        reply.redirect('/admin/auto-tasks?error=meeting_not_found');
        return;
      }
      reply.redirect(`/admin/auto-tasks?rerun_created=${result.created}&rerun_skipped=${result.skipped}`);
    } catch (err) {
      request.log.error({ err, meetingId }, 'Rerun as STANDARD failed');
      reply.redirect('/admin/auto-tasks?error=rerun_failed');
    }
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
    // Invalidate the Haiku QA rules cache so the new rejection is picked up
    // on the very next sync, not after the 5-minute TTL expires.
    resetQaCache();
    reply.redirect('/admin/auto-tasks?rejected=1');
  });

  // POST /add-to-my-asana — copy a task into the current user's private
  // Asana "My Tasks" (no projects → only visible to them). Due today.
  app.post('/add-to-my-asana', async (request, reply) => {
    const body = request.body as { task_name?: string; source?: string };
    const taskName = (body.task_name || '').trim();
    if (!taskName) {
      reply.redirect('/admin/auto-tasks?error=missing_fields');
      return;
    }
    const currentUser = (request as unknown as { user?: SessionUser }).user;
    if (!currentUser?.email) {
      reply.redirect('/admin/auto-tasks?error=not_logged_in');
      return;
    }
    const assigneeGid = await resolveAssignee(currentUser.name, currentUser.email);
    if (!assigneeGid) {
      reply.redirect('/admin/auto-tasks?error=asana_user_not_found');
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const sourceLine = body.source ? `Copied from: ${body.source}\n\n` : '';
    const notes = `${sourceLine}Original task: ${taskName}\n\nAdded from Vendo OS /admin/auto-tasks on ${today}.`;
    try {
      await createPrivateAsanaTask({
        name: taskName,
        assigneeGid,
        dueOn: today,
        notes,
      });
      reply.redirect('/admin/auto-tasks?added_to_my_asana=1');
    } catch (err) {
      request.log.error({ err, taskName }, 'Add to personal Asana failed');
      reply.redirect('/admin/auto-tasks?error=add_failed');
    }
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
    resetQaCache();
    reply.redirect('/admin/auto-tasks?undone=1');
  });
};

export { adminAutoTasksRoutes };
