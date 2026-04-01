import type { FastifyPluginAsync } from 'fastify';
import { searchTasks, getTaskAssignees, getTaskProjects, getTaskStats, upsertAsanaTask } from '../lib/queries.js';

const ASANA_API_KEY = process.env.ASANA_API_KEY || '';
const ASANA_WORKSPACE_GID = process.env.ASANA_WORKSPACE_GID || '';
const ASANA_BASE_URL = 'https://app.asana.com/api/1.0';

export const tasksRoutes: FastifyPluginAsync = async (app) => {
  // --- List tasks ---
  app.get('/', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const page = Math.max(1, parseInt(q.page || '1', 10));
    const limit = 50;

    const [result, assignees, projects, stats] = await Promise.all([
      searchTasks({
        assignee: q.assignee || undefined,
        project: q.project || undefined,
        status: (q.status as 'open' | 'completed' | 'all') || 'open',
        due: (q.due as 'overdue' | 'today' | 'week' | 'all') || undefined,
        search: q.search || undefined,
        limit,
        offset: (page - 1) * limit,
      }),
      getTaskAssignees(),
      getTaskProjects(),
      getTaskStats(),
    ]);

    const totalPages = Math.ceil(result.total / limit);

    reply.render('tasks/list', {
      tasks: result.tasks,
      total: result.total,
      assignees,
      projects,
      stats,
      page,
      totalPages,
      query: q,
    });
  });

  // --- Create task form ---
  app.get('/new', async (request, reply) => {
    const [assignees, projects] = await Promise.all([
      getTaskAssignees(),
      getTaskProjects(),
    ]);

    // Also fetch workspace users from Asana for the assignee dropdown
    let workspaceUsers: { gid: string; name: string }[] = [];
    if (ASANA_API_KEY && ASANA_WORKSPACE_GID) {
      try {
        const res = await fetch(`${ASANA_BASE_URL}/users?workspace=${ASANA_WORKSPACE_GID}&opt_fields=name`, {
          headers: { 'Authorization': `Bearer ${ASANA_API_KEY}`, 'Accept': 'application/json' },
        });
        if (res.ok) {
          const json = await res.json() as { data: { gid: string; name: string }[] };
          workspaceUsers = json.data;
        }
      } catch { /* fall back to local assignees */ }
    }

    // Fetch projects from Asana API for the dropdown
    let asanaProjects: { gid: string; name: string }[] = [];
    if (ASANA_API_KEY && ASANA_WORKSPACE_GID) {
      try {
        const res = await fetch(`${ASANA_BASE_URL}/projects?workspace=${ASANA_WORKSPACE_GID}&opt_fields=name&archived=false`, {
          headers: { 'Authorization': `Bearer ${ASANA_API_KEY}`, 'Accept': 'application/json' },
        });
        if (res.ok) {
          const json = await res.json() as { data: { gid: string; name: string }[] };
          asanaProjects = json.data;
        }
      } catch { /* fall back to local projects */ }
    }

    reply.render('tasks/new', {
      assignees,
      projects: asanaProjects.length ? asanaProjects : projects,
      workspaceUsers,
    });
  });

  // --- Create task (POST to Asana, then save locally) ---
  app.post('/', async (request, reply) => {
    const body = request.body as Record<string, string>;
    const { name, assignee, project, due_on, notes } = body;

    if (!name?.trim()) {
      reply.redirect('/tasks/new?error=name_required');
      return;
    }

    if (!ASANA_API_KEY || !ASANA_WORKSPACE_GID) {
      reply.redirect('/tasks/new?error=asana_not_configured');
      return;
    }

    try {
      // Create task in Asana
      const taskData: Record<string, unknown> = {
        name: name.trim(),
        workspace: ASANA_WORKSPACE_GID,
      };
      if (assignee) taskData.assignee = assignee;
      if (due_on) taskData.due_on = due_on;
      if (notes) taskData.notes = notes.trim();
      if (project) taskData.projects = [project];

      const res = await fetch(`${ASANA_BASE_URL}/tasks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ASANA_API_KEY}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: taskData }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        request.log.error(`Asana create failed: ${res.status} ${errBody}`);
        reply.redirect('/tasks/new?error=asana_api_error');
        return;
      }

      const json = await res.json() as { data: { gid: string; assignee: { gid: string; name: string } | null; permalink_url: string; created_at: string; modified_at: string; projects: { gid: string; name: string }[] } };
      const created = json.data;

      // Save to local database
      await upsertAsanaTask({
        gid: created.gid,
        name: name.trim(),
        assignee_gid: created.assignee?.gid ?? assignee ?? null,
        assignee_name: created.assignee?.name ?? null,
        due_on: due_on || null,
        completed: false,
        project_gid: created.projects?.[0]?.gid ?? project ?? null,
        project_name: created.projects?.[0]?.name ?? null,
        notes: notes?.trim() || null,
        permalink_url: created.permalink_url || null,
      });

      reply.redirect('/tasks?created=1');
    } catch (err) {
      request.log.error(err, 'Failed to create Asana task');
      reply.redirect('/tasks/new?error=unexpected');
    }
  });
};
