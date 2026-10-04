import crypto from 'crypto';
import type { FastifyPluginAsync } from 'fastify';
import { db } from '../lib/queries/base.js';
import { ACCOUNT_ID, ancestorFolders, getAsset } from '../lib/frameio/media-io.js';
import { pickShootFolder } from '../lib/video-jobs/destination.js';
import { resolveUser } from '../lib/frameio/users.js';
import {
  ACTION_EVENTS, firstCutForm, isTeamMember, looksLikeExport, macOptions, message, parseActionPayload, validateFirstCut,
  type ActionMessage, type ActionPayload,
} from '../lib/video-jobs/actions.js';
import {
  findJobByDelivered, latestDoneInChain, listWorkers, openJobInChain, queueJob, workerLastSeen,
} from '../lib/video-jobs/store.js';
import { verifyFrameioSignature } from './frameio-webhook.js';
import { getFileStatus, LOCKED } from '../lib/video-jobs/gates.js';

/**
 * Frame.io custom actions: "AI First Cut" and "AI Revision" in the right-click menu
 * (plans/2026-10-03-frameio-native-ai-edits.md, step 1).
 *
 * Frame.io must get an answer within a few seconds, so this only validates and queues: the edit itself
 * runs on the editor's MacBook (scripts/video-worker.ts), which claims the job from `video_jobs`.
 *
 * Auth: the same URL token as the webhook (FRAMEIO_WEBHOOK_TOKEN). If FRAMEIO_ACTION_SECRETS (comma-separated,
 * one per action) is set, a valid v0 HMAC signature from one of them is also required.
 */

const WORKER_STALE_MS = 10 * 60_000;

function tokenOk(presented: string, expected: string): boolean {
  return presented.length === expected.length && crypto.timingSafeEqual(Buffer.from(presented), Buffer.from(expected));
}

/** The person who clicked, if they are a Vendo team member with an email. */
async function requester(p: ActionPayload) {
  if (!p.userId) return null;
  const user = await resolveUser({ accountId: p.accountId ?? ACCOUNT_ID, userId: p.userId });
  return user?.email && isTeamMember(user.role, user.email) ? user : null;
}

/** A line about whether the Mac that will run the job is switched on. */
async function macStatus(email: string, mac: string): Promise<string> {
  const seen = await workerLastSeen(email);
  if (!seen) return ` ${mac} doesn't have the AI edit app set up yet (see the AI Edits SOP); the job starts as soon as it is.`;
  if (Date.now() - new Date(seen).getTime() > WORKER_STALE_MS) return ` ${mac} is offline at the moment; the job starts when it's back on.`;
  return '';
}

async function firstCut(p: ActionPayload): Promise<unknown> {
  if (p.resourceType && !['file', 'version_stack'].includes(p.resourceType)) {
    return message('AI First Cut', 'Right-click the raw video clip (in Raw Footage), not a folder.');
  }
  const user = await requester(p);
  if (!user) return message('AI First Cut', 'Only Vendo team members can start AI edits.');
  // Logins can be shared (the team uses creative@ in Frame.io), so the person picks which Mac runs it.
  const macs = macOptions(await listWorkers(), user.email);
  if (!p.data) {
    // Catch the two common mistakes now, not 20 minutes later on the Mac.
    const asset = await getAsset(p.resourceId!);
    const name = asset.head_version?.name ?? asset.name;
    if (looksLikeExport(name)) {
      return message('AI First Cut', `"${name}" is already an edited export. Right-click the raw clip in the shoot's Raw Footage folder instead (to change this video, use AI Revision).`);
    }
    if (!pickShootFolder(await ancestorFolders(asset))) {
      return message('AI First Cut', 'This clip isn\'t in a shoot folder. Move it into <shoot folder> › Raw Footage first, so the AI knows where to file the video.');
    }
    return firstCutForm({}, undefined, macs);
  }
  const check = validateFirstCut(p.data);
  if (!check.ok) return firstCutForm(p.data, check.problem, macs);

  const workerEmail = macs.find((m) => m.value === p.data!.worker)?.value ?? macs[0]?.value ?? user.email!.toLowerCase();
  const job = await queueJob({
    kind: 'first_cut', interactionId: p.interactionId,
    requestedBy: { userId: user.userId, email: user.email, name: user.name },
    workerEmail, sourceFileId: p.resourceId!, projectId: p.projectId, params: check.params,
  });
  const mac = workerEmail === user.email!.toLowerCase() ? 'Your Mac' : macs.find((m) => m.value === workerEmail)?.name ?? `${workerEmail}'s Mac`;
  const where = check.params.section === 'Organic' ? 'Organic' : 'Social Ads › Treatments';
  return message(
    'AI First Cut queued',
    `The AI will cut it, name it from what's said and file v01 Internal under ${where} in this shoot, ` +
      `usually 15 to 25 minutes after the Mac picks it up (job ${job.id}).${await macStatus(workerEmail, mac)}`,
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
  // After Gate 2 the AI must not change the video (latest version, whichever one was clicked).
  const status = await getFileStatus(latest.result_file_id!).catch(() => null);
  if (status && LOCKED.has(status)) {
    return message('AI Revision', `The latest version is ${status}, so the AI won't change it. To make changes, set its Status back to In Progress first.`);
  }
  const job = await queueJob({
    kind: 'revision', chainId: delivered.chain_id, interactionId: p.interactionId,
    requestedBy: { userId: user.userId, email: user.email, name: user.name },
    workerEmail: latest.worker_email, sourceFileId: latest.result_file_id!, projectId: p.projectId,
    params: {}, jobDir: latest.job_dir,
  });
  const mac = latest.worker_email === user.email?.toLowerCase() ? 'Your Mac' : `${latest.worker_email}'s Mac`;
  return message(
    'AI Revision queued',
    `The AI will apply the open comments on the latest version and stack the next one on top (job ${job.id}). ` +
      `It runs on the Mac that made the first cut.${await macStatus(latest.worker_email, mac)}`,
  );
}

/** Export for Editing: layers of the latest AI version for Premiere Pro / CapCut, uploaded as an Edit Pack folder. */
async function exportForEditing(p: ActionPayload): Promise<ActionMessage> {
  if (!p.resourceId) return message('Export for Editing', 'Right-click the AI-made video you want to tweak by hand.');
  const delivered = await findJobByDelivered(p.resourceId);
  if (!delivered?.chain_id) {
    return message('Export for Editing', "This video wasn't made by the AI, so there are no layers to export. Edit the file itself instead.");
  }
  const open = await openJobInChain(delivered.chain_id);
  if (open) return message('Export for Editing', `The AI is still working on this video (job ${open.id}). Export once that version lands.`);
  const user = await requester(p);
  if (!user) return message('Export for Editing', 'Only Vendo team members can export edits.');
  const latest = (await latestDoneInChain(delivered.chain_id)) ?? delivered;
  const job = await queueJob({
    kind: 'export', chainId: delivered.chain_id, interactionId: p.interactionId,
    requestedBy: { userId: user.userId, email: user.email, name: user.name },
    workerEmail: latest.worker_email, sourceFileId: latest.result_file_id!, projectId: p.projectId,
    params: {}, jobDir: latest.job_dir,
  });
  const mac = latest.worker_email === user.email?.toLowerCase() ? 'Your Mac' : `${latest.worker_email}'s Mac`;
  return message(
    'Export for Editing queued',
    `An "Edit Pack" folder for the latest version will appear next to the video in about 5 minutes (job ${job.id}): ` +
      `picture, graphics, captions and a Premiere timeline. Read its README for Premiere and CapCut.${await macStatus(latest.worker_email, mac)}`,
  );
}

/**
 * Keep every call in frameio_events (status 'action_log', never processed) so we can see what Frame.io
 * sent and how we answered, including calls rejected before any work. Never blocks the reply on failure.
 */
async function logCall(request: { body?: unknown; headers: Record<string, unknown>; url: string } & { rawBody?: string }, outcome: string): Promise<void> {
  try {
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(request.headers)) if (k !== 'authorization' && v != null) headers[k] = String(v);
    const body = request.body as { interaction_id?: string; type?: string } | undefined;
    await db.execute({
      sql: `INSERT INTO frameio_events (event_id, event_type, payload, headers, received_at, processing_status, processing_error)
            VALUES (?, 'custom_action', ?, ?, ?, 'action_log', ?)`,
      args: [null, request.rawBody ?? JSON.stringify(request.body ?? {}), JSON.stringify(headers), new Date().toISOString(),
        `${body?.type ?? '?'}: ${outcome}`.slice(0, 500)],
    });
  } catch { /* logging must never break the action */ }
}

export const frameioActionRoutes: FastifyPluginAsync = async (app) => {
  // Keep the raw body for the signature check.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body: string, done) => {
    (req as { rawBody?: string }).rawBody = body;
    try { done(null, body.length ? JSON.parse(body) : {}); } catch (err) { done(err as Error, undefined); }
  });

  app.post('/action', async (request, reply) => {
    const expected = process.env.FRAMEIO_WEBHOOK_TOKEN;
    const req = request as unknown as Parameters<typeof logCall>[0];
    if (!expected) return reply.code(500).send({ error: 'Action endpoint not configured' });
    const presented = (request.query as Record<string, string | undefined>)?.token ?? '';
    if (!tokenOk(presented, expected)) { await logCall(req, 'rejected: bad or missing token'); return reply.code(403).send({ error: 'Invalid token' }); }

    // Each action has its own signing secret; accept a request signed by any of ours.
    // FRAMEIO_ACTION_SECRETS_2 holds secrets for actions added later (env vars are added, never edited).
    const secrets = [process.env.FRAMEIO_ACTION_SECRETS, process.env.FRAMEIO_ACTION_SECRETS_2].join(',').split(',').map((s) => s.trim()).filter(Boolean);
    if (secrets.length) {
      const rawBody = (request as { rawBody?: string }).rawBody ?? '';
      const headers = request.headers as Record<string, string | undefined>;
      const verdicts = secrets.map((secret) => verifyFrameioSignature({ secret, rawBody, headers }));
      if (!verdicts.includes('ok')) { await logCall(req, `rejected: signature ${verdicts[0]}`); return reply.code(401).send({ error: `Signature ${verdicts[0]}` }); }
    }

    const p = parseActionPayload(request.body);
    request.log.info({ event: p.event, resourceType: p.resourceType, hasData: !!p.data, keys: Object.keys((request.body ?? {}) as object) }, 'Frame.io action');
    let answer: unknown;
    try {
      if (p.event === ACTION_EVENTS.first_cut) answer = await firstCut(p);
      else if (p.event === ACTION_EVENTS.revision) answer = await revision(p);
      else if (p.event === ACTION_EVENTS.export) answer = await exportForEditing(p);
      else answer = message('Vendo', `Unknown action "${p.event}".`);
    } catch (err) {
      request.log.error({ err }, 'Frame.io action failed');
      answer = message('Something went wrong', `${(err as Error).message.slice(0, 200)}. Try again, or tell the Lead Video Editor.`);
    }
    await logCall(req, `answered: ${(answer as { title?: string }).title ?? ''}${(answer as { fields?: unknown }).fields ? ' (form)' : ''}`);
    return reply.send(answer);
  });
};
