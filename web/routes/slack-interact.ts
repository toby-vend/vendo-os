import crypto from 'crypto';
import type { FastifyPluginAsync } from 'fastify';
import { getDirectorSlackAction } from '../lib/classification/slack.js';
import { resolveAssignee } from '../lib/asana/assignee.js';
import { createPrivateAsanaTask } from '../lib/asana/tasks.js';

/**
 * Slack interactivity endpoint. Handles button clicks from the messages
 * posted to #claude-director-meetings (see web/lib/classification/slack.ts).
 *
 *   POST /api/slack/interact
 *
 * Expects Slack's standard interactivity payload (url-encoded form with a
 * `payload` field containing JSON). Verifies the HMAC signature using
 * SLACK_SIGNING_SECRET, resolves the clicker's Vendo email via the Slack
 * Web API (SLACK_BOT_TOKEN → users.info), and creates a private Asana task
 * assigned to that user and due today.
 */

const SLACK_API = 'https://slack.com/api';
const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function verifySlackSignature(input: {
  signingSecret: string;
  timestamp: string;
  signature: string;
  rawBody: string;
}): boolean {
  const ts = Number(input.timestamp);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > TIMESTAMP_TOLERANCE_SECONDS) return false;
  const base = `v0:${input.timestamp}:${input.rawBody}`;
  const expected = 'v0=' + crypto.createHmac('sha256', input.signingSecret).update(base).digest('hex');
  return timingSafeEqualStr(expected, input.signature);
}

async function fetchSlackUserEmail(slackUserId: string): Promise<string | null> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`${SLACK_API}/users.info?user=${encodeURIComponent(slackUserId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { ok: boolean; user?: { profile?: { email?: string } } };
    if (!json.ok) return null;
    return json.user?.profile?.email || null;
  } catch {
    return null;
  }
}

interface SlackAction {
  action_id?: string;
  value?: string;
}

interface SlackPayload {
  type?: string;
  user?: { id?: string };
  actions?: SlackAction[];
  response_url?: string;
}

export const slackInteractRoutes: FastifyPluginAsync = async (app) => {
  app.post('/interact', async (request, reply) => {
    const signingSecret = process.env.SLACK_SIGNING_SECRET;
    if (!signingSecret) {
      request.log.warn('SLACK_SIGNING_SECRET not set — rejecting Slack interaction');
      reply.code(503).send('not configured');
      return;
    }

    const rawBody = (request as unknown as { rawBody?: string }).rawBody || '';
    const timestamp = String(request.headers['x-slack-request-timestamp'] || '');
    const signature = String(request.headers['x-slack-signature'] || '');
    if (!timestamp || !signature || !verifySlackSignature({ signingSecret, timestamp, signature, rawBody })) {
      reply.code(401).send('bad signature');
      return;
    }

    // Payload is x-www-form-urlencoded with a single `payload` field.
    const body = request.body as Record<string, string | string[]> | undefined;
    const payloadRaw = typeof body?.payload === 'string'
      ? body.payload
      : Array.isArray(body?.payload) ? body!.payload[0] : '';
    if (!payloadRaw) {
      reply.code(400).send('missing payload');
      return;
    }

    let payload: SlackPayload;
    try {
      payload = JSON.parse(payloadRaw) as SlackPayload;
    } catch {
      reply.code(400).send('bad payload');
      return;
    }

    const firstAction = payload.actions?.[0];
    if (firstAction?.action_id !== 'add_to_asana') {
      reply.send({ text: 'Unknown action.' });
      return;
    }
    const value = firstAction.value || '';
    const actionId = value.startsWith('action:') ? parseInt(value.slice(7), 10) : NaN;
    if (!Number.isFinite(actionId)) {
      reply.send({ response_type: 'ephemeral', text: ':x: Invalid action reference.' });
      return;
    }

    const action = await getDirectorSlackAction(actionId);
    if (!action) {
      reply.send({ response_type: 'ephemeral', text: ':x: This action item has expired and can no longer be added.' });
      return;
    }

    const slackUserId = payload.user?.id || '';
    const email = slackUserId ? await fetchSlackUserEmail(slackUserId) : null;
    if (!email) {
      reply.send({ response_type: 'ephemeral', text: ':x: We could not read your Vendo email from Slack. Ask an admin to check the Slack app permissions (users:read.email).' });
      return;
    }

    const assigneeGid = await resolveAssignee(undefined, email);
    if (!assigneeGid) {
      reply.send({
        response_type: 'ephemeral',
        text: `:x: ${email} is not a Vendo-domain user in Asana, so this task can't be assigned.`,
      });
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const notes = [
      `Copied from #claude-director-meetings`,
      action.meeting_title ? `Meeting: ${action.meeting_title}` : null,
      action.fathom_url ? `Fathom: ${action.fathom_url}` : null,
      '',
      `Original task: ${action.task_name}`,
    ].filter(Boolean).join('\n');

    try {
      await createPrivateAsanaTask({
        name: action.task_name,
        assigneeGid,
        dueOn: today,
        notes,
      });
      reply.send({
        response_type: 'ephemeral',
        text: ':white_check_mark: Added to your Asana, due today.',
      });
    } catch (err) {
      request.log.error({ err, actionId }, 'Slack-triggered Asana task create failed');
      reply.send({
        response_type: 'ephemeral',
        text: ':warning: Asana rejected the task. Ask an admin to check the logs.',
      });
    }
  });
};
