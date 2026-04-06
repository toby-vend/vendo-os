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
};
