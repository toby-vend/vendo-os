import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { getDirectorSlackAction } from '../lib/classification/slack.js';
import { resolveAssignee } from '../lib/asana/assignee.js';
import { createPrivateAsanaTask } from '../lib/asana/tasks.js';
import { verifySlackSignature } from '../lib/agents/channels/slack-verify.js';
import {
  parseAgentActionId,
  slackUserIdToVendoUser,
  type AgentActionDecision,
} from '../lib/agents/channels/slack.js';
import { getById, decide, markExecuted } from '../lib/agents/recommendations.js';
import { TOOL_FACTORIES, type ToolName } from '../lib/agents/tools/index.js';
import type { ChannelName, ToolCtx } from '../lib/agents/types.js';

/**
 * Slack interactivity endpoint (POST /api/slack/interact).
 *
 * Slack only allows one Interactivity URL per app, so this is the single
 * dispatcher for all Block Kit button clicks. Routes by `action_id`:
 *
 *   add_to_asana                 → director-meeting → private Asana task
 *   agent:approve:<recId>        → recommendations.decide('approved') + execute
 *   agent:edit:<recId>           → recommendations.decide('edited') (UI follow-up)
 *   agent:reject:<recId>         → recommendations.decide('rejected')
 *
 * Every request is HMAC-verified with SLACK_SIGNING_SECRET (5-min replay
 * window). Bot scopes required: `users:read.email` for the Vendo user
 * lookup.
 */

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

function ephemeral(reply: FastifyReply, text: string) {
  reply.send({ response_type: 'ephemeral', text });
}

/**
 * Approve/edit/reject handler — mirrors api/agent/approve.ts but
 * authenticates via Slack id (not session JWT) and replies ephemerally.
 */
async function handleAgentAction(opts: {
  reply: FastifyReply;
  decision: AgentActionDecision;
  recId: string;
  slackUserId: string;
  log: (...args: unknown[]) => void;
}): Promise<void> {
  const { reply, decision, recId, slackUserId, log } = opts;

  const user = await slackUserIdToVendoUser(slackUserId);
  if (!user) {
    ephemeral(
      reply,
      ':x: We could not match your Slack account to a Vendo user. Ask an admin to check that your Slack email matches your Vendo email and that the Slack app has `users:read.email`.',
    );
    return;
  }

  const rec = await getById(recId);
  if (!rec) {
    ephemeral(reply, ':x: That recommendation no longer exists.');
    return;
  }
  if (rec.status !== 'pending') {
    ephemeral(reply, `:information_source: Already ${rec.status}.`);
    return;
  }
  if (rec.user_id !== user.id && user.role !== 'admin') {
    ephemeral(reply, ':no_entry: That recommendation belongs to someone else.');
    return;
  }

  const updated = await decide({ id: recId, decidedBy: user.id, decision });
  if (!updated) {
    ephemeral(reply, ':warning: Could not record your decision. Ask an admin to check the logs.');
    return;
  }

  if (decision === 'rejected') {
    ephemeral(reply, ':white_check_mark: Rejected.');
    return;
  }

  if (decision === 'edited') {
    // The full edit flow lives on the web /inbox page; the Slack button
    // just records intent. The user follows up there with their tweaks.
    ephemeral(reply, ':pencil2: Marked as edited — open Atlas on the web to make your changes.');
    return;
  }

  // Approved — re-run the tool in execute mode (graduation-bypassed for
  // this single call; the human click is the gate).
  const factory = TOOL_FACTORIES[rec.tool_name as ToolName];
  if (!factory) {
    ephemeral(reply, `:warning: Unknown tool ${rec.tool_name}; cannot execute.`);
    return;
  }
  const ctx: ToolCtx = {
    runId: rec.run_id,
    agent: rec.agent,
    user,
    channel: 'slack' as ChannelName,
    conversationId: null,
    graduations: new Set([rec.tool_name]),
  };
  const tool = factory(ctx);
  if (!tool.execute) {
    ephemeral(reply, ':warning: This tool has no execute() — cannot run from approval.');
    return;
  }

  const originalPayload = JSON.parse(rec.payload) as Record<string, unknown>;
  const finalInput = { ...originalPayload, mode: 'execute' };

  let result: unknown;
  try {
    result = await tool.execute(finalInput as never, { toolCallId: `slack-approval-${rec.id}`, messages: [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log('agent action execute failed', msg);
    ephemeral(reply, `:warning: Execute failed: ${msg}`);
    return;
  }

  await markExecuted(rec.id, result);
  ephemeral(reply, ':white_check_mark: Approved and executed.');
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
    if (!timestamp || !signature ||
        !verifySlackSignature({ signingSecret, timestamp, signature, rawBody })) {
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
    const actionId = firstAction?.action_id || '';

    // -- Atlas approval/reject/edit -----------------------------------------
    const parsed = parseAgentActionId(actionId);
    if (parsed) {
      const slackUserId = payload.user?.id || '';
      if (!slackUserId) {
        ephemeral(reply, ':x: Could not read your Slack user id from the payload.');
        return;
      }
      await handleAgentAction({
        reply,
        decision: parsed.decision,
        recId: parsed.recId,
        slackUserId,
        log: (...args) => request.log.error({ args }, 'agent action'),
      });
      return;
    }

    // -- Existing director-meeting "Add to Asana" flow ----------------------
    if (actionId === 'add_to_asana') {
      const value = firstAction?.value || '';
      const taskActionId = value.startsWith('action:') ? parseInt(value.slice(7), 10) : NaN;
      if (!Number.isFinite(taskActionId)) {
        ephemeral(reply, ':x: Invalid action reference.');
        return;
      }

      const action = await getDirectorSlackAction(taskActionId);
      if (!action) {
        ephemeral(reply, ':x: This action item has expired and can no longer be added.');
        return;
      }

      const slackUserId = payload.user?.id || '';
      const email = slackUserId ? await fetchSlackUserEmail(slackUserId) : null;
      if (!email) {
        ephemeral(
          reply,
          ':x: We could not read your Vendo email from Slack. Ask an admin to check the Slack app permissions (users:read.email).',
        );
        return;
      }

      const assigneeGid = await resolveAssignee(undefined, email);
      if (!assigneeGid) {
        ephemeral(reply, `:x: ${email} is not a Vendo-domain user in Asana, so this task can't be assigned.`);
        return;
      }

      const today = new Date().toISOString().slice(0, 10);
      const notes = [
        'Copied from #claude-director-meetings',
        action.meeting_title ? `Meeting: ${action.meeting_title}` : null,
        action.fathom_url ? `Fathom: ${action.fathom_url}` : null,
        '',
        `Original task: ${action.task_name}`,
      ].filter(Boolean).join('\n');

      try {
        await createPrivateAsanaTask({ name: action.task_name, assigneeGid, dueOn: today, notes });
        ephemeral(reply, ':white_check_mark: Added to your Asana, due today.');
      } catch (err) {
        request.log.error({ err, taskActionId }, 'Slack-triggered Asana task create failed');
        ephemeral(reply, ':warning: Asana rejected the task. Ask an admin to check the logs.');
      }
      return;
    }

    // -- Unknown action -----------------------------------------------------
    reply.send({ text: 'Unknown action.' });
  });
};

// ---------------------------------------------------------------------------
// Local helper retained from the previous version for the add_to_asana flow.
// (The reverse direction — slack id → email — also lives in
// web/lib/agents/channels/slack.ts as lookupSlackUserEmail. Kept here to
// avoid touching the existing director-action audit trail.)
// ---------------------------------------------------------------------------

const SLACK_API = 'https://slack.com/api';

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
