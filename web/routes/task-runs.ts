import type { FastifyPluginAsync } from 'fastify';
import { createTaskRun, getAuditRecord, getTaskRun, listTaskRuns, type TaskRunStatus } from '../lib/queries/task-runs.js';
import { assembleContext } from '../lib/task-matcher.js';

const VALID_CHANNELS = ['paid_social', 'seo', 'paid_ads'] as const;
type ValidChannel = typeof VALID_CHANNELS[number];

const VALID_STATUSES: TaskRunStatus[] = ['queued', 'generating', 'qa_check', 'draft_ready', 'approved', 'failed'];

function isValidStatus(value: unknown): value is TaskRunStatus {
  return typeof value === 'string' && (VALID_STATUSES as string[]).includes(value);
}

function isValidChannel(value: unknown): value is ValidChannel {
  return typeof value === 'string' && (VALID_CHANNELS as readonly string[]).includes(value);
}

export const taskRunRoutes: FastifyPluginAsync = async (app) => {
  // POST /runs — create a task run and fire off context assembly
  app.post('/runs', async (request, reply) => {
    const body = request.body as Record<string, unknown> | null ?? {};
    const { clientId: rawClientId, channel, taskType } = body as {
      clientId?: unknown;
      channel?: unknown;
      taskType?: unknown;
    };

    // Validate clientId — must be a positive integer
    const clientId = Number(rawClientId);
    if (!Number.isInteger(clientId) || clientId <= 0) {
      return reply.code(400).send({ error: 'invalid_input', detail: 'clientId must be a positive integer' });
    }

    // Validate channel
    if (!isValidChannel(channel)) {
      return reply.code(400).send({ error: 'invalid_input', detail: `channel must be one of: ${VALID_CHANNELS.join(', ')}` });
    }

    // Validate taskType — must be a non-empty string
    if (typeof taskType !== 'string' || taskType.trim() === '') {
      return reply.code(400).send({ error: 'invalid_input', detail: 'taskType must be a non-empty string' });
    }

    const createdBy = (request as any).user?.email ?? 'unknown';

    const taskRunId = await createTaskRun({ clientId, channel, taskType, createdBy });

    // Respond immediately before context assembly starts
    reply.code(202).send({ id: taskRunId, status: 'queued' });

    // Fire-and-forget: assemble context in background after response is sent
    assembleContext(taskRunId, clientId, channel, taskType).catch((err: unknown) => {
      request.log.error({ taskRunId, err }, 'context assembly failed');
    });
  });

  // GET /runs/:id — fetch a single task run by id
  app.get<{ Params: { id: string } }>('/runs/:id', async (request, reply) => {
    const id = parseInt(request.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return reply.code(400).send({ error: 'invalid_input', detail: 'id must be a positive integer' });
    }

    const run = await getAuditRecord(id);
    if (run === null) {
      return reply.code(404).send({ error: 'not_found' });
    }

    return reply.code(200).send(run);
  });

  // GET /runs — list task runs with optional filters
  app.get<{ Querystring: { status?: string; clientId?: string } }>('/runs', async (request, reply) => {
    const { status, clientId: rawClientId } = request.query;

    const filters: { status?: TaskRunStatus; clientId?: number } = {};
    if (status && isValidStatus(status)) filters.status = status;
    if (rawClientId !== undefined) {
      const clientId = parseInt(rawClientId, 10);
      if (!Number.isNaN(clientId) && clientId > 0) filters.clientId = clientId;
    }

    const runs = await listTaskRuns(filters);
    return reply.code(200).send({ runs });
  });
};
