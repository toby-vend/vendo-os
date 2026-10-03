import crypto from 'crypto';
import type { FastifyPluginAsync } from 'fastify';
import { ACCOUNT_ID } from '../lib/frameio/media-io.js';
import { resolveUser } from '../lib/frameio/users.js';
import {
  ACTION_EVENTS, destinationPath, firstCutForm, message, parseActionPayload, pipelineName, validateFirstCut,
  type ActionMessage, type ActionPayload,
} from '../lib/video-jobs/actions.js';
import {
  findJobByDelivered, latestDoneInChain, openJobInChain, queueJob, workerLastSeen,
} from '../lib/video-jobs/store.js';
import { verifyFrameioSignature } from './frameio-webhook.js';

/**
 * Frame.io custom actions: "AI First Cut" and "AI Revision" in the right-click menu
 * (plans/2026-10-03-frameio-native-ai-edits.md, step 1).
 *
 * Frame.io must get an answer within a few seconds, so this only validates and queues: the edit itself
 * runs on the editor's MacBook (scripts/video-worker.ts), which claims the job from `video_jobs`.
 *
 * Auth: the same URL token as the webhook (FRAMEIO_WEBHOOK_TOKEN). If FRAMEIO_ACTION_SECRET is set, the
 * v0 HMAC signature is also required.
 */

const WORKER_STALE_MS = 10 * 60_000;

function tokenOk(presented: string, expected: string): boolean {
  return presented.length === expected.length && crypto.timingSafeEqual(Buffer.from(presented), Buffer.from(expected));
}

/** The person who clicked, if they are a Vendo team member with an email. */
async function requester(p: ActionPayload) {
  if (!p.userId) return null;
  const user = await resolveUser({ accountId: p.accountId ?? ACCOUNT_ID, userId: p.userId });
  return user?.email && !user.isExternal ? user : null;
}

/** A line about whether the Mac that will run the job is switched on. */
async function macStatus(email: string, whose: string): Promise<string> {
  const seen = await workerLastSeen(email);
  if (!seen) return ` ${whose} Mac doesn't have the AI edit app set up yet (see the AI Edits SOP); the job starts as soon as it is.`;
  if (Date.now() - new Date(seen).getTime() > WORKER_STALE_MS) return ` ${whose} Mac is offline at the moment; the job starts when it's back on.`;
  return '';
}

async function firstCut(p: ActionPayload): Promise<unknown> {
  if (p.resourceType && !['file', 'version_stack'].includes(p.resourceType)) {
    return message('AI First Cut', 'Right-click the raw video clip (in Raw Footage), not a folder.');
  }
  if (!p.data) return firstCutForm();
  const check = validateFirstCut(p.data);
  if (!check.ok) return firstCutForm(p.data, check.problem);

  const user = await requester(p);
  if (!user) return message('AI First Cut', 'Only Vendo team members can start AI edits.');
  const job = await queueJob({
    kind: 'first_cut', interactionId: p.interactionId,
    requestedBy: { userId: user.userId, email: user.email, name: user.name },
    workerEmail: user.email!, sourceFileId: p.resourceId!, projectId: p.projectId, params: check.params,
  });
  return message(
    'AI First Cut queued',
    `"${pipelineName(check.params)}" will land in ${destinationPath(check.params).join(' › ')} as v01 Internal, ` +
      `usually 15 to 25 minutes after your Mac picks it up (job ${job.id}).${await macStatus(user.email!, 'Your')}`,
  );
}

async function revision(p: ActionPayload): Promise<ActionMessage> {
  if (!p.resourceId) return message('AI Revision', 'Right-click the AI-made video you left comments on.');
  const delivered = await findJobByDelivered(p.resourceId);
  if (!delivered?.chain_id) {
    return message('AI Revision', "This video wasn't made by the AI, so the AI can't revise it. Use AI First Cut on the raw clip instead.");
  }
  const open = await openJobInChain(delivered.chain_id);
  if (open) return message('AI Revision', `The AI is already working on this video (job ${open.id}). Wait for that version first.`);

  const user = await requester(p);
  if (!user) return message('AI Revision', 'Only Vendo team members can start AI edits.');
  const latest = (await latestDoneInChain(delivered.chain_id)) ?? delivered;
  const job = await queueJob({
    kind: 'revision', chainId: delivered.chain_id, interactionId: p.interactionId,
    requestedBy: { userId: user.userId, email: user.email, name: user.name },
    workerEmail: latest.worker_email, sourceFileId: latest.result_file_id!, projectId: p.projectId,
    params: {}, jobDir: latest.job_dir,
  });
  const whose = latest.worker_email === user.email?.toLowerCase() ? 'Your' : `${latest.worker_email}'s`;
  return message(
    'AI Revision queued',
    `The AI will apply the open comments on the latest version and stack the next one on top (job ${job.id}). ` +
      `It runs on the Mac that made the first cut.${await macStatus(latest.worker_email, whose)}`,
  );
}

export const frameioActionRoutes: FastifyPluginAsync = async (app) => {
  // Keep the raw body for the signature check.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body: string, done) => {
    (req as { rawBody?: string }).rawBody = body;
    try { done(null, body.length ? JSON.parse(body) : {}); } catch (err) { done(err as Error, undefined); }
  });

  app.post('/action', async (request, reply) => {
    const expected = process.env.FRAMEIO_WEBHOOK_TOKEN;
    if (!expected) return reply.code(500).send({ error: 'Action endpoint not configured' });
    const presented = (request.query as Record<string, string | undefined>)?.token ?? '';
    if (!tokenOk(presented, expected)) return reply.code(403).send({ error: 'Invalid token' });

    const secret = process.env.FRAMEIO_ACTION_SECRET;
    if (secret) {
      const verdict = verifyFrameioSignature({
        secret, rawBody: (request as { rawBody?: string }).rawBody ?? '', headers: request.headers as Record<string, string | undefined>,
      });
      if (verdict !== 'ok') return reply.code(401).send({ error: `Signature ${verdict}` });
    }

    const p = parseActionPayload(request.body);
    request.log.info({ event: p.event, resourceType: p.resourceType, hasData: !!p.data, keys: Object.keys((request.body ?? {}) as object) }, 'Frame.io action');
    try {
      if (p.event === ACTION_EVENTS.first_cut) return reply.send(await firstCut(p));
      if (p.event === ACTION_EVENTS.revision) return reply.send(await revision(p));
      return reply.send(message('Vendo', `Unknown action "${p.event}".`));
    } catch (err) {
      request.log.error({ err }, 'Frame.io action failed');
      return reply.send(message('Something went wrong', `${(err as Error).message.slice(0, 200)}. Try again, or tell the Lead Video Editor.`));
    }
  });
};
