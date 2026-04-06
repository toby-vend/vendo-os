import type { FastifyPluginAsync } from 'fastify';
import {
  getActiveVideoProjects, getVideoProject, createVideoProject,
  updateVideoProject, moveVideoProject,
  getShootPlan, createShootPlan, updateShootPlan, getShootPlanHistory,
  getVideoFiles, addVideoFile, deleteVideoFile,
  getQaReviews, submitQaReview,
  getVideoComments, addVideoComment,
  getVideoAuditLog, logVideoAudit,
  getVideoColumnCounts, getActiveClients, getInternalUsers,
  getVideoProjectsByDateRange, getUpcomingShootList,
  VIDEO_COLUMNS, VALID_STATUSES,
  type VideoProject,
} from '../lib/queries.js';
import type { SessionUser } from '../lib/auth.js';

function requireAuth(user: SessionUser | null): asserts user is SessionUser {
  if (!user) throw { statusCode: 401, message: 'Not authenticated' };
}

export const videoProductionRoutes: FastifyPluginAsync = async (app) => {

  // ── Kanban Board ────────────────────────────────────────────────

  app.get('/', async (request, reply) => {
    const user = (request as any).user as SessionUser;
    requireAuth(user);

    const query = request.query as Record<string, string>;
    const filters: { clientId?: number; editorId?: string; priority?: string; status?: string } = {};
    if (query.client) filters.clientId = parseInt(query.client, 10);
    if (query.editor) filters.editorId = query.editor;
    if (query.priority) filters.priority = query.priority;

    const [projects, clients, editors, columnCounts] = await Promise.all([
      getActiveVideoProjects(filters),
      getActiveClients(),
      getInternalUsers(),
      getVideoColumnCounts(),
    ]);

    // Group projects by status column
    const columns: Record<string, VideoProject[]> = {};
    for (const col of VIDEO_COLUMNS) columns[col.key] = [];
    for (const p of projects) {
      if (columns[p.status]) columns[p.status].push(p);
    }

    reply.render('video-production/index', {
      columns,
      columnDefs: VIDEO_COLUMNS,
      columnCounts,
      clients,
      editors,
      filters: query,
    });
  });

  // ── Card move (drag-and-drop) ───────────────────────────────────

  app.post('/move/:id', async (request, reply) => {
    const user = (request as any).user as SessionUser;
    requireAuth(user);

    const { id } = request.params as { id: string };
    const body = request.body as Record<string, string | string[]>;
    const newStatus = typeof body.status === 'string' ? body.status : '';

    if (!VALID_STATUSES.includes(newStatus as any)) {
      reply.code(400).send('Invalid status');
      return;
    }

    const result = await moveVideoProject(parseInt(id, 10), newStatus, user.id, user.name);
    if (!result) {
      reply.code(404).send('Project not found');
      return;
    }

    // Return updated board via HTMX
    reply.header('HX-Trigger', 'boardUpdated');
    reply.code(200).send('OK');
  });

  // ── Board refresh (HTMX partial) ───────────────────────────────

  app.get('/board', async (request, reply) => {
    const user = (request as any).user as SessionUser;
    requireAuth(user);

    const query = request.query as Record<string, string>;
    const filters: { clientId?: number; editorId?: string; priority?: string } = {};
    if (query.client) filters.clientId = parseInt(query.client, 10);
    if (query.editor) filters.editorId = query.editor;
    if (query.priority) filters.priority = query.priority;

    const [projects, columnCounts] = await Promise.all([
      getActiveVideoProjects(filters),
      getVideoColumnCounts(),
    ]);

    const columns: Record<string, VideoProject[]> = {};
    for (const col of VIDEO_COLUMNS) columns[col.key] = [];
    for (const p of projects) {
      if (columns[p.status]) columns[p.status].push(p);
    }

    reply.render('video-production/partials/board', {
      columns,
      columnDefs: VIDEO_COLUMNS,
      columnCounts,
    });
  });

  // ── Content Calendar ─────────────────────────────────────────────

  app.get('/calendar', async (request, reply) => {
    const user = (request as any).user as SessionUser;
    requireAuth(user);

    const query = request.query as Record<string, string>;
    const view = query.view || 'month'; // month | week | list
    const clientFilter = query.client ? parseInt(query.client, 10) : undefined;

    // Determine the target date
    const now = new Date();
    const year = query.year ? parseInt(query.year, 10) : now.getFullYear();
    const month = query.month ? parseInt(query.month, 10) - 1 : now.getMonth(); // 0-indexed
    const weekStart = query.weekStart || ''; // ISO date for week view

    const clients = await getActiveClients();

    if (view === 'list') {
      const projects = await getUpcomingShootList(clientFilter);
      reply.render('video-production/calendar-list', {
        projects,
        clients,
        filters: query,
        view,
      });
      return;
    }

    if (view === 'week') {
      // Week view — 7 days starting from weekStart or current Monday
      let startDate: Date;
      if (weekStart) {
        startDate = new Date(weekStart);
      } else {
        startDate = new Date(year, month, now.getDate());
        const day = startDate.getDay();
        const diff = day === 0 ? -6 : 1 - day; // Monday
        startDate.setDate(startDate.getDate() + diff);
      }
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);

      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];
      const projects = await getVideoProjectsByDateRange(startStr, endStr, clientFilter);

      // Group by date
      const days: { date: Date; dateStr: string; projects: VideoProject[] }[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const ds = d.toISOString().split('T')[0];
        days.push({ date: d, dateStr: ds, projects: projects.filter(p => p.shoot_date === ds) });
      }

      reply.render('video-production/calendar-week', {
        days,
        startDate,
        endDate,
        clients,
        filters: query,
        view,
      });
      return;
    }

    // Month view (default)
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Extend to fill the calendar grid (start on Monday)
    const gridStart = new Date(firstDay);
    const startDow = gridStart.getDay();
    const mondayOffset = startDow === 0 ? -6 : 1 - startDow;
    gridStart.setDate(gridStart.getDate() + mondayOffset);

    const gridEnd = new Date(lastDay);
    const endDow = gridEnd.getDay();
    if (endDow !== 0) gridEnd.setDate(gridEnd.getDate() + (7 - endDow));

    const startStr = gridStart.toISOString().split('T')[0];
    const endStr = gridEnd.toISOString().split('T')[0];
    const projects = await getVideoProjectsByDateRange(startStr, endStr, clientFilter);

    // Build day cells
    const weeks: { date: Date; dateStr: string; isCurrentMonth: boolean; isToday: boolean; projects: VideoProject[] }[][] = [];
    let current = new Date(gridStart);
    const todayStr = now.toISOString().split('T')[0];

    while (current <= gridEnd) {
      const week: typeof weeks[0] = [];
      for (let d = 0; d < 7; d++) {
        const ds = current.toISOString().split('T')[0];
        week.push({
          date: new Date(current),
          dateStr: ds,
          isCurrentMonth: current.getMonth() === month,
          isToday: ds === todayStr,
          projects: projects.filter(p => p.shoot_date === ds),
        });
        current.setDate(current.getDate() + 1);
      }
      weeks.push(week);
    }

    // Nav links
    const prevMonth = month === 0 ? 12 : month; // 1-indexed for URL
    const prevYear = month === 0 ? year - 1 : year;
    const nextMonth = month === 11 ? 1 : month + 2;
    const nextYear = month === 11 ? year + 1 : year;
    const monthLabel = firstDay.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    reply.render('video-production/calendar', {
      weeks,
      year,
      month: month + 1,
      monthLabel,
      prevMonth,
      prevYear,
      nextMonth,
      nextYear,
      clients,
      filters: query,
      view,
    });
  });

  // ── Create project ──────────────────────────────────────────────

  app.get('/new', async (request, reply) => {
    const user = (request as any).user as SessionUser;
    requireAuth(user);

    const [clients, editors] = await Promise.all([getActiveClients(), getInternalUsers()]);
    reply.render('video-production/new', { clients, editors });
  });

  app.post('/new', async (request, reply) => {
    const user = (request as any).user as SessionUser;
    requireAuth(user);

    const body = request.body as Record<string, string | string[]>;
    const clientId = parseInt(typeof body.client_id === 'string' ? body.client_id : '0', 10);
    const title = typeof body.title === 'string' ? body.title.trim() : '';

    if (!clientId || !title) {
      reply.code(400).send('Client and title are required');
      return;
    }

    const projectId = await createVideoProject({
      client_id: clientId,
      title,
      shoot_date: typeof body.shoot_date === 'string' ? body.shoot_date : undefined,
      shoot_time: typeof body.shoot_time === 'string' ? body.shoot_time : undefined,
      shoot_end_time: typeof body.shoot_end_time === 'string' ? body.shoot_end_time : undefined,
      location: typeof body.location === 'string' ? body.location : undefined,
      contact_on_day: typeof body.contact_on_day === 'string' ? body.contact_on_day : undefined,
      treatments_planned: typeof body.treatments_planned === 'string' ? body.treatments_planned : undefined,
      num_videos: typeof body.num_videos === 'string' ? parseInt(body.num_videos, 10) : undefined,
      internal_notes: typeof body.internal_notes === 'string' ? body.internal_notes : undefined,
      priority: typeof body.priority === 'string' ? body.priority : 'normal',
      deadline: typeof body.deadline === 'string' ? body.deadline : undefined,
      assigned_editor_id: typeof body.assigned_editor_id === 'string' && body.assigned_editor_id ? body.assigned_editor_id : undefined,
      assigned_editor_name: typeof body.assigned_editor_name === 'string' ? body.assigned_editor_name : undefined,
    });

    await logVideoAudit(projectId, 'created', null, 'shoot_booked', user.id, user.name);

    reply.redirect('/video-production');
  });

  // ── Project detail ──────────────────────────────────────────────

  app.get('/:id', async (request, reply) => {
    const user = (request as any).user as SessionUser;
    requireAuth(user);

    const { id } = request.params as { id: string };
    const project = await getVideoProject(parseInt(id, 10));
    if (!project) { reply.code(404).send('Project not found'); return; }

    const [shootPlan, files, qaReviews, comments, auditLog, editors] = await Promise.all([
      getShootPlan(project.id),
      getVideoFiles(project.id),
      getQaReviews(project.id),
      getVideoComments(project.id),
      getVideoAuditLog(project.id),
      getInternalUsers(),
    ]);

    const rawFiles = files.filter(f => f.type === 'raw');
    const editFiles = files.filter(f => f.type === 'edit');

    reply.render('video-production/detail', {
      project,
      shootPlan,
      rawFiles,
      editFiles,
      qaReviews,
      comments,
      auditLog,
      editors,
      columnDefs: VIDEO_COLUMNS,
    });
  });

  // ── Update project fields ───────────────────────────────────────

  app.post('/:id/update', async (request, reply) => {
    const user = (request as any).user as SessionUser;
    requireAuth(user);

    const { id } = request.params as { id: string };
    const projectId = parseInt(id, 10);
    const body = request.body as Record<string, string | string[]>;

    const updates: Record<string, string | number | null> = {};
    const allowedFields = [
      'title', 'shoot_date', 'shoot_time', 'shoot_end_time', 'location',
      'contact_on_day', 'treatments_planned', 'num_videos', 'priority',
      'deadline', 'assigned_editor_id', 'assigned_editor_name', 'internal_notes',
      'publish_date', 'publish_platforms', 'publish_link',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        const val = typeof body[field] === 'string' ? body[field] : '';
        updates[field] = field === 'num_videos' ? parseInt(val, 10) : val;
      }
    }

    if (Object.keys(updates).length > 0) {
      await updateVideoProject(projectId, updates);
      await logVideoAudit(projectId, 'updated', null, null, user.id, user.name, updates);
    }

    reply.redirect(`/video-production/${id}`);
  });

  // ── Add file (raw or edit link) ─────────────────────────────────

  app.post('/:id/files', async (request, reply) => {
    const user = (request as any).user as SessionUser;
    requireAuth(user);

    const { id } = request.params as { id: string };
    const projectId = parseInt(id, 10);
    const body = request.body as Record<string, string | string[]>;

    const url = typeof body.url === 'string' ? body.url.trim() : '';
    const type = typeof body.type === 'string' ? body.type : 'raw';
    if (!url) { reply.code(400).send('URL is required'); return; }

    await addVideoFile({
      project_id: projectId,
      type,
      url,
      label: typeof body.label === 'string' ? body.label : undefined,
      treatment: typeof body.treatment === 'string' ? body.treatment : undefined,
      video_type: typeof body.video_type === 'string' ? body.video_type : undefined,
      version: typeof body.version === 'string' ? parseInt(body.version, 10) : undefined,
      uploaded_by: user.name,
    });

    await logVideoAudit(projectId, 'file_added', null, type, user.id, user.name, { url });

    reply.redirect(`/video-production/${id}`);
  });

  // ── Delete file ─────────────────────────────────────────────────

  app.post('/:id/files/:fileId/delete', async (request, reply) => {
    const user = (request as any).user as SessionUser;
    requireAuth(user);

    const { id, fileId } = request.params as { id: string; fileId: string };
    await deleteVideoFile(parseInt(fileId, 10));
    await logVideoAudit(parseInt(id, 10), 'file_deleted', fileId, null, user.id, user.name);

    reply.redirect(`/video-production/${id}`);
  });

  // ── QA Review submit ────────────────────────────────────────────

  app.post('/:id/qa', async (request, reply) => {
    const user = (request as any).user as SessionUser;
    requireAuth(user);

    const { id } = request.params as { id: string };
    const projectId = parseInt(id, 10);
    const body = request.body as Record<string, string | string[]>;

    const checkVal = (key: string) => body[key] === '1' ? 1 : 0;
    const result = typeof body.result === 'string' ? body.result : 'fail';

    await submitQaReview({
      project_id: projectId,
      reviewer_id: user.id,
      reviewer_name: user.name,
      matches_brief: checkVal('matches_brief'),
      captions_accurate: checkVal('captions_accurate'),
      brand_correct: checkVal('brand_correct'),
      compliance_ok: checkVal('compliance_ok'),
      audio_ok: checkVal('audio_ok'),
      hook_ok: checkVal('hook_ok'),
      cta_present: checkVal('cta_present'),
      result,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
    });

    // Auto-move based on result
    if (result === 'pass') {
      await moveVideoProject(projectId, 'client_review', user.id, user.name);
    } else {
      // Increment revision round
      const project = await getVideoProject(projectId);
      if (project) {
        await updateVideoProject(projectId, { revision_round: project.revision_round + 1 });
      }
      await moveVideoProject(projectId, 'revisions', user.id, user.name);
    }

    await logVideoAudit(projectId, 'qa_submitted', null, result, user.id, user.name);

    reply.redirect(`/video-production/${id}`);
  });

  // ── Add comment / revision note ─────────────────────────────────

  app.post('/:id/comments', async (request, reply) => {
    const user = (request as any).user as SessionUser;
    requireAuth(user);

    const { id } = request.params as { id: string };
    const projectId = parseInt(id, 10);
    const body = request.body as Record<string, string | string[]>;

    const commentBody = typeof body.body === 'string' ? body.body.trim() : '';
    if (!commentBody) { reply.code(400).send('Comment body is required'); return; }

    const project = await getVideoProject(projectId);

    await addVideoComment({
      project_id: projectId,
      source: typeof body.source === 'string' ? body.source : 'internal',
      round: project?.revision_round || 0,
      author_name: user.name,
      body: commentBody,
      timestamp_ref: typeof body.timestamp_ref === 'string' ? body.timestamp_ref : undefined,
    });

    await logVideoAudit(projectId, 'comment_added', null, null, user.id, user.name);

    reply.redirect(`/video-production/${id}`);
  });

  // ── Mark editor re-submission (revisions → QA) ──────────────────

  app.post('/:id/resubmit', async (request, reply) => {
    const user = (request as any).user as SessionUser;
    requireAuth(user);

    const { id } = request.params as { id: string };
    const projectId = parseInt(id, 10);

    await moveVideoProject(projectId, 'qa_review', user.id, user.name);
    await logVideoAudit(projectId, 'editor_resubmitted', 'revisions', 'qa_review', user.id, user.name);

    reply.redirect(`/video-production/${id}`);
  });

  // ── Archive (move to live + archive) ────────────────────────────

  app.post('/:id/archive', async (request, reply) => {
    const user = (request as any).user as SessionUser;
    requireAuth(user);

    const { id } = request.params as { id: string };
    const projectId = parseInt(id, 10);

    await updateVideoProject(projectId, { archived: 1 });
    await logVideoAudit(projectId, 'archived', null, null, user.id, user.name);

    reply.redirect('/video-production');
  });

  // ── Stage transition actions ─────────────────────────────────────

  // Mark content day as complete → moves to content_day_complete
  app.post('/:id/mark-complete', async (request, reply) => {
    const user = (request as any).user as SessionUser;
    requireAuth(user);

    const { id } = request.params as { id: string };
    const projectId = parseInt(id, 10);

    await moveVideoProject(projectId, 'content_day_complete', user.id, user.name);
    await logVideoAudit(projectId, 'content_day_completed', null, null, user.id, user.name);

    reply.redirect(`/video-production/${id}`);
  });

  // Share raw files → moves to raw_files_shared, sets client_status awaiting
  app.post('/:id/share-raw-files', async (request, reply) => {
    const user = (request as any).user as SessionUser;
    requireAuth(user);

    const { id } = request.params as { id: string };
    const projectId = parseInt(id, 10);

    await updateVideoProject(projectId, { client_status: 'awaiting' });
    await moveVideoProject(projectId, 'raw_files_shared', user.id, user.name);
    await logVideoAudit(projectId, 'raw_files_shared', null, null, user.id, user.name);

    reply.redirect(`/video-production/${id}`);
  });

  // Client confirms raw file receipt → moves to in_editing
  app.post('/:id/confirm-receipt', async (request, reply) => {
    const user = (request as any).user as SessionUser;
    requireAuth(user);

    const { id } = request.params as { id: string };
    const projectId = parseInt(id, 10);
    const now = new Date().toISOString();

    await updateVideoProject(projectId, {
      raw_files_confirmed_at: now,
      client_status: 'confirmed',
    });
    await moveVideoProject(projectId, 'in_editing', user.id, user.name);
    await logVideoAudit(projectId, 'raw_files_confirmed', null, null, user.id, user.name);

    reply.redirect(`/video-production/${id}`);
  });

  // Flag raw file issue
  app.post('/:id/flag-raw-issue', async (request, reply) => {
    const user = (request as any).user as SessionUser;
    requireAuth(user);

    const { id } = request.params as { id: string };
    const projectId = parseInt(id, 10);
    const body = request.body as Record<string, string | string[]>;
    const issue = typeof body.issue === 'string' ? body.issue.trim() : 'Raw file issue reported';

    await updateVideoProject(projectId, { client_status: 'changes_requested' });
    await addVideoComment({
      project_id: projectId,
      source: 'client',
      author_name: user.name,
      body: issue,
    });
    await logVideoAudit(projectId, 'raw_file_issue', null, null, user.id, user.name, { issue });

    reply.redirect(`/video-production/${id}`);
  });

  // Assign editor and move to in_editing
  app.post('/:id/assign-editor', async (request, reply) => {
    const user = (request as any).user as SessionUser;
    requireAuth(user);

    const { id } = request.params as { id: string };
    const projectId = parseInt(id, 10);
    const body = request.body as Record<string, string | string[]>;

    const editorId = typeof body.assigned_editor_id === 'string' ? body.assigned_editor_id : '';
    const editorName = typeof body.assigned_editor_name === 'string' ? body.assigned_editor_name : '';

    if (editorId) {
      await updateVideoProject(projectId, {
        assigned_editor_id: editorId,
        assigned_editor_name: editorName,
      });
      await logVideoAudit(projectId, 'editor_assigned', null, editorName, user.id, user.name);
    }

    reply.redirect(`/video-production/${id}`);
  });

  // Client approves edit → moves to live
  app.post('/:id/client-approve', async (request, reply) => {
    const user = (request as any).user as SessionUser;
    requireAuth(user);

    const { id } = request.params as { id: string };
    const projectId = parseInt(id, 10);
    const now = new Date().toISOString();

    await updateVideoProject(projectId, {
      client_status: 'approved',
      client_approved_at: now,
    });
    await moveVideoProject(projectId, 'live', user.id, user.name);
    await logVideoAudit(projectId, 'client_approved', null, null, user.id, user.name);

    reply.redirect(`/video-production/${id}`);
  });

  // Client requests changes on edit → moves to revisions
  app.post('/:id/client-request-changes', async (request, reply) => {
    const user = (request as any).user as SessionUser;
    requireAuth(user);

    const { id } = request.params as { id: string };
    const projectId = parseInt(id, 10);
    const body = request.body as Record<string, string | string[]>;
    const feedback = typeof body.feedback === 'string' ? body.feedback.trim() : '';

    const project = await getVideoProject(projectId);
    const newRound = (project?.revision_round || 0) + 1;

    await updateVideoProject(projectId, {
      client_status: 'changes_requested',
      revision_round: newRound,
    });

    if (feedback) {
      await addVideoComment({
        project_id: projectId,
        source: 'client',
        round: newRound,
        author_name: user.name,
        body: feedback,
      });
    }

    await moveVideoProject(projectId, 'revisions', user.id, user.name);
    await logVideoAudit(projectId, 'client_changes_requested', null, null, user.id, user.name, { feedback });

    reply.redirect(`/video-production/${id}`);
  });

  // ── Shoot Plan ──────────────────────────────────────────────────

  app.get('/:id/shoot-plan', async (request, reply) => {
    const user = (request as any).user as SessionUser;
    requireAuth(user);

    const { id } = request.params as { id: string };
    const project = await getVideoProject(parseInt(id, 10));
    if (!project) { reply.code(404).send('Project not found'); return; }

    const [plan, history] = await Promise.all([
      getShootPlan(project.id),
      getShootPlanHistory(project.id),
    ]);

    reply.render('video-production/shoot-plan', {
      project,
      plan,
      history,
    });
  });

  app.post('/:id/shoot-plan', async (request, reply) => {
    const user = (request as any).user as SessionUser;
    requireAuth(user);

    const { id } = request.params as { id: string };
    const projectId = parseInt(id, 10);
    const project = await getVideoProject(projectId);
    if (!project) { reply.code(404).send('Project not found'); return; }

    const body = request.body as Record<string, string | string[]>;
    const existingPlan = await getShootPlan(projectId);

    const planData = {
      treatments: typeof body.treatments === 'string' ? body.treatments : undefined,
      run_order: typeof body.run_order === 'string' ? body.run_order : undefined,
      shot_list: typeof body.shot_list === 'string' ? body.shot_list : undefined,
      equipment_notes: typeof body.equipment_notes === 'string' ? body.equipment_notes : undefined,
      talent_requirements: typeof body.talent_requirements === 'string' ? body.talent_requirements : undefined,
    };

    if (existingPlan && existingPlan.status === 'draft') {
      // Update existing draft
      await updateShootPlan(existingPlan.id, planData);
      await logVideoAudit(projectId, 'shoot_plan_updated', null, null, user.id, user.name);
    } else {
      // Create new version (either first plan or new version after changes requested)
      await createShootPlan({ project_id: projectId, ...planData });
      await logVideoAudit(projectId, 'shoot_plan_created', null, null, user.id, user.name);
    }

    // Move to shoot_plan_in_progress if still at shoot_booked
    if (project.status === 'shoot_booked') {
      await moveVideoProject(projectId, 'shoot_plan_in_progress', user.id, user.name);
    }

    reply.redirect(`/video-production/${id}/shoot-plan`);
  });

  // Mark plan as ready for client review
  app.post('/:id/shoot-plan/submit', async (request, reply) => {
    const user = (request as any).user as SessionUser;
    requireAuth(user);

    const { id } = request.params as { id: string };
    const projectId = parseInt(id, 10);
    const plan = await getShootPlan(projectId);
    if (!plan) { reply.code(404).send('No shoot plan found'); return; }

    await updateShootPlan(plan.id, { status: 'ready_for_review' });
    await updateVideoProject(projectId, { client_status: 'awaiting' });
    await logVideoAudit(projectId, 'shoot_plan_submitted', 'draft', 'ready_for_review', user.id, user.name);

    reply.redirect(`/video-production/${id}/shoot-plan`);
  });

  // Client approves the plan
  app.post('/:id/shoot-plan/approve', async (request, reply) => {
    const user = (request as any).user as SessionUser;
    requireAuth(user);

    const { id } = request.params as { id: string };
    const projectId = parseInt(id, 10);
    const plan = await getShootPlan(projectId);
    if (!plan) { reply.code(404).send('No shoot plan found'); return; }

    const now = new Date().toISOString();
    await updateShootPlan(plan.id, { status: 'approved', approved_at: now });
    await updateVideoProject(projectId, { client_status: 'approved' });

    // Auto-move Kanban to shoot_plan_approved
    await moveVideoProject(projectId, 'shoot_plan_approved', user.id, user.name);

    // Update project treatments from approved plan
    if (plan.treatments) {
      await updateVideoProject(projectId, { treatments_planned: plan.treatments });
    }

    await logVideoAudit(projectId, 'shoot_plan_approved', null, null, user.id, user.name);

    reply.redirect(`/video-production/${id}/shoot-plan`);
  });

  // Client requests changes
  app.post('/:id/shoot-plan/request-changes', async (request, reply) => {
    const user = (request as any).user as SessionUser;
    requireAuth(user);

    const { id } = request.params as { id: string };
    const projectId = parseInt(id, 10);
    const plan = await getShootPlan(projectId);
    if (!plan) { reply.code(404).send('No shoot plan found'); return; }

    const body = request.body as Record<string, string | string[]>;
    const comments = typeof body.client_comments === 'string' ? body.client_comments.trim() : '';

    await updateShootPlan(plan.id, {
      status: 'changes_requested',
      client_comments: comments,
    });
    await updateVideoProject(projectId, { client_status: 'changes_requested' });

    // Log the feedback as a comment too
    if (comments) {
      await addVideoComment({
        project_id: projectId,
        source: 'client',
        author_name: user.name,
        body: comments,
      });
    }

    // Move back to shoot_plan_in_progress
    await moveVideoProject(projectId, 'shoot_plan_in_progress', user.id, user.name);
    await logVideoAudit(projectId, 'shoot_plan_changes_requested', null, null, user.id, user.name, { comments });

    reply.redirect(`/video-production/${id}/shoot-plan`);
  });
};
