import type { FastifyPluginAsync } from 'fastify';
import {
  listTaskRuns,
  getAuditRecord,
  getTaskRun,
  updateTaskRunStatus,
  updateTaskRunQA,
  type TaskRunStatus,
} from '../lib/queries/task-runs.js';
import { listBrandClients } from '../lib/queries/brand.js';
import { getTaskTypesForChannel } from '../lib/task-types/index.js';
import { assembleContext } from '../lib/task-matcher.js';

const VALID_CHANNELS = ['paid_social', 'seo', 'paid_ads'] as const;
type ValidChannel = typeof VALID_CHANNELS[number];

function isValidChannel(value: unknown): value is ValidChannel {
  return typeof value === 'string' && (VALID_CHANNELS as readonly string[]).includes(value);
}

const CHANNEL_LABELS: Record<string, string> = {
  paid_social: 'Paid Social',
  seo: 'SEO',
  paid_ads: 'Paid Ads',
};

const DRAFT_PARTIAL_MAP: Record<string, string> = {
  'paid_social:ad_copy': 'task-runs/partials/draft-ad-copy',
  'seo:content_brief': 'task-runs/partials/draft-content-brief',
  'paid_ads:rsa_copy': 'task-runs/partials/draft-rsa-copy',
};

export const taskRunsUiRoutes: FastifyPluginAsync = async (app) => {
  // GET / — Task list full page (or HTMX rows partial)
  app.get('/', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const status = query.status as TaskRunStatus | undefined;
    const clientId = query.clientId ? Number(query.clientId) : undefined;
    const channel = query.channel || undefined;
    const dateFrom = query.dateFrom || undefined;
    const dateTo = query.dateTo || undefined;
    const page = Math.max(1, Number(query.page) || 1);
    const limit = 50;
    const offset = (page - 1) * limit;

    const [runs, clients] = await Promise.all([
      listTaskRuns({ status, clientId, channel, dateFrom, dateTo, limit, offset }),
      listBrandClients(),
    ]);

    const hasMore = runs.length === limit;
    const totalPages = hasMore ? page + 1 : page;

    // HTMX request — return rows partial only
    if (request.headers['hx-request']) {
      return reply.render('task-runs/list-rows', { runs });
    }

    return reply.render('task-runs/list', {
      runs,
      clients,
      query: { status, clientId, channel, dateFrom, dateTo },
      page,
      totalPages,
      channelLabels: CHANNEL_LABELS,
    });
  });

  // GET /rows — HTMX polling partial (always returns rows only)
  app.get('/rows', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const status = query.status as TaskRunStatus | undefined;
    const clientId = query.clientId ? Number(query.clientId) : undefined;
    const channel = query.channel || undefined;
    const dateFrom = query.dateFrom || undefined;
    const dateTo = query.dateTo || undefined;
    const page = Math.max(1, Number(query.page) || 1);
    const limit = 50;
    const offset = (page - 1) * limit;

    const runs = await listTaskRuns({ status, clientId, channel, dateFrom, dateTo, limit, offset });
    return reply.render('task-runs/list-rows', { runs });
  });

  // GET /new — Task submission form
  app.get('/new', async (request, reply) => {
    const clients = await listBrandClients();
    const query = request.query as Record<string, string>;
    return reply.render('task-runs/new', { clients, error: query.error });
  });

  // GET /task-types — HTMX partial: <select> options filtered by channel
  app.get('/task-types', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const channel = query.channel || '';

    const taskTypes = isValidChannel(channel) ? getTaskTypesForChannel(channel) : [];

    if (taskTypes.length === 0) {
      const html = `<select name="taskType" id="task-type-select" disabled><option value="">Select channel first</option></select>`;
      return reply.type('text/html').send(html);
    }

    const options = taskTypes
      .map(t => `<option value="${t}">${t.replace(/_/g, ' ')}</option>`)
      .join('');
    const html = `<select name="taskType" id="task-type-select" required>${options}</select>`;
    return reply.type('text/html').send(html);
  });

  // POST /new — Form submission handler
  app.post('/new', async (request, reply) => {
    const body = request.body as Record<string, string> ?? {};
    const rawClientId = body.clientId;
    const channel = body.channel;
    const taskType = body.taskType;
    const instructions = body.instructions;

    const clientId = Number(rawClientId);
    if (!Number.isInteger(clientId) || clientId <= 0) {
      return reply.redirect('/tasks/new?error=invalid_client');
    }
    if (!isValidChannel(channel)) {
      return reply.redirect('/tasks/new?error=invalid_channel');
    }
    if (typeof taskType !== 'string' || taskType.trim() === '') {
      return reply.redirect('/tasks/new?error=invalid_task_type');
    }

    if (instructions?.trim()) {
      console.log(`[task-runs-ui] instructions captured (not stored v1): ${instructions.trim().slice(0, 80)}`);
    }

    // Forward to API route to reuse validation, createTaskRun, and fire-and-forget logic
    const response = await app.inject({
      method: 'POST',
      url: '/api/tasks/runs',
      payload: { clientId, channel, taskType },
      headers: { cookie: request.headers.cookie },
    });

    if (response.statusCode !== 202) {
      return reply.redirect('/tasks/new?error=submission_failed');
    }

    let taskRunId: number;
    try {
      const parsed = JSON.parse(response.body) as { id: number };
      taskRunId = parsed.id;
    } catch {
      return reply.redirect('/tasks/new?error=submission_failed');
    }

    return reply.redirect(`/tasks/${taskRunId}`);
  });

  // GET /:id — Draft review / task detail page
  app.get('/:id', async (request, reply) => {
    const { id: rawId } = request.params as { id: string };
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) {
      return reply.code(404).send('Not found');
    }

    const query = request.query as Record<string, string>;
    const run = await getAuditRecord(id);
    if (!run) return reply.code(404).send('Not found');

    // Also get the full row for output, qa_critique, status
    const fullRun = await getTaskRun(id);
    if (!fullRun) return reply.code(404).send('Not found');

    // Parse output JSON if draft is available
    let output: Record<string, unknown> | null = null;
    if (fullRun.output && ['draft_ready', 'approved', 'rejected'].includes(fullRun.status)) {
      try {
        output = JSON.parse(fullRun.output) as Record<string, unknown>;
      } catch {
        output = null;
      }
    }

    // Parse qa_critique JSON for banners
    let qaCritique: Record<string, unknown> = {};
    if (fullRun.qa_critique) {
      try {
        qaCritique = JSON.parse(fullRun.qa_critique) as Record<string, unknown>;
      } catch {
        qaCritique = {};
      }
    }

    const registryKey = `${fullRun.channel}:${fullRun.task_type}`;
    const draftPartial = DRAFT_PARTIAL_MAP[registryKey] ?? null;

    return reply.render('task-runs/detail', {
      run: { ...run, ...fullRun },
      output,
      sopsUsed: run.sops_used,
      qaCritique,
      draftPartial,
      error: query.error,
    });
  });

  // POST /:id/approve — Approve a draft
  app.post('/:id/approve', async (request, reply) => {
    const { id: rawId } = request.params as { id: string };
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) return reply.code(404).send('Not found');

    const run = await getTaskRun(id);
    if (!run) return reply.code(404).send('Not found');
    if (run.status !== 'draft_ready') return reply.redirect(`/tasks/${id}?error=invalid_status`);

    await updateTaskRunStatus(id, 'approved');

    // Merge am_feedback into existing qa_critique
    let existing: Record<string, unknown> = {};
    if (run.qa_critique) {
      try { existing = JSON.parse(run.qa_critique) as Record<string, unknown>; } catch { /* ignore */ }
    }
    const merged = { ...existing, am_feedback: { action: 'approve' } };
    await updateTaskRunQA(id, { score: run.qa_score ?? 0, critique: JSON.stringify(merged) });

    return reply.redirect(`/tasks/${id}`);
  });

  // POST /:id/reject — Reject a draft (requires reason)
  app.post('/:id/reject', async (request, reply) => {
    const { id: rawId } = request.params as { id: string };
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) return reply.code(404).send('Not found');

    const body = request.body as Record<string, string> ?? {};
    const reason = body.reason?.trim();
    if (!reason) return reply.redirect(`/tasks/${id}?error=reason_required`);

    const run = await getTaskRun(id);
    if (!run) return reply.code(404).send('Not found');
    if (run.status !== 'draft_ready') return reply.redirect(`/tasks/${id}?error=invalid_status`);

    let existing: Record<string, unknown> = {};
    if (run.qa_critique) {
      try { existing = JSON.parse(run.qa_critique) as Record<string, unknown>; } catch { /* ignore */ }
    }
    const merged = { ...existing, am_feedback: { action: 'reject', reason } };
    await updateTaskRunQA(id, { score: run.qa_score ?? 0, critique: JSON.stringify(merged) });
    await updateTaskRunStatus(id, 'rejected');

    return reply.redirect('/tasks');
  });

  // POST /:id/regenerate — Regenerate (optional comment)
  app.post('/:id/regenerate', async (request, reply) => {
    const { id: rawId } = request.params as { id: string };
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) return reply.code(404).send('Not found');

    const body = request.body as Record<string, string> ?? {};
    const comment = body.comment?.trim() || undefined;

    const run = await getTaskRun(id);
    if (!run) return reply.code(404).send('Not found');
    if (!['draft_ready', 'rejected', 'failed'].includes(run.status)) {
      return reply.redirect(`/tasks/${id}?error=invalid_status`);
    }

    let existing: Record<string, unknown> = {};
    if (run.qa_critique) {
      try { existing = JSON.parse(run.qa_critique) as Record<string, unknown>; } catch { /* ignore */ }
    }
    const amFeedback: Record<string, unknown> = { action: 'regenerate' };
    if (comment) amFeedback.comment = comment;
    const merged = { ...existing, am_feedback: amFeedback };
    await updateTaskRunQA(id, { score: run.qa_score ?? 0, critique: JSON.stringify(merged) });
    await updateTaskRunStatus(id, 'queued');

    // Redirect first, then fire-and-forget
    reply.redirect(`/tasks/${id}`);
    assembleContext(id, run.client_id, run.channel, run.task_type, (request as any).user?.id ?? null).catch(
      (err: unknown) => console.error(`[task-runs-ui] assembleContext failed for run ${id}:`, err),
    );
  });
};
