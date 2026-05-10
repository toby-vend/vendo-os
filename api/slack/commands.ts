/**
 * /api/slack/commands — Slack slash command receiver.
 *
 * Wired to the `/vendo` slash command in the Slack App config:
 *   Request URL: https://<host>/api/slack/commands
 *
 * Behaviour:
 *   - HMAC-verifies the request (SLACK_SIGNING_SECRET).
 *   - ACKs ephemerally with "Atlas is thinking…" within 3 s.
 *   - Resolves the invoking Slack user → Vendo user.
 *   - Runs Atlas with `text` as the prompt.
 *   - Delivers the final reply via Slack's response_url (ephemeral, only
 *     the invoking user sees it). The function stays alive after ACK until
 *     the awaited work resolves.
 *
 * Bot scopes required: commands, users:read.email.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { waitUntil } from '@vercel/functions';
import {
  verifySlackSignature,
  readRawBody,
  parseSlackForm,
} from '../../web/lib/agents/channels/slack-verify.js';
import { slackUserIdToVendoUser } from '../../web/lib/agents/channels/slack.js';
import { getAgentForUser } from '../../web/lib/agents/agents/index.js';
import { runAgentBackground } from '../../web/lib/agents/runtime.js';
import type { ToolCtx, ChannelName } from '../../web/lib/agents/types.js';

export const config = {
  runtime: 'nodejs',
  maxDuration: 120,
  api: { bodyParser: false },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).end('method not allowed');
    return;
  }

  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    console.warn('[slack/commands] SLACK_SIGNING_SECRET not set');
    res.status(503).end('not configured');
    return;
  }

  let rawBody: string;
  try {
    rawBody = await readRawBody(req);
  } catch (err) {
    console.error('[slack/commands] readRawBody failed:', err);
    res.status(400).end('cannot read body');
    return;
  }

  const timestamp = String(req.headers['x-slack-request-timestamp'] || '');
  const signature = String(req.headers['x-slack-signature'] || '');
  if (!timestamp || !signature ||
      !verifySlackSignature({ signingSecret, timestamp, signature, rawBody })) {
    res.status(401).end('bad signature');
    return;
  }

  const form = parseSlackForm(rawBody);
  const slackUserId = form['user_id'] || '';
  const text = (form['text'] || '').trim();
  const responseUrl = form['response_url'] || '';

  if (!slackUserId || !responseUrl) {
    res.status(400).end('missing fields');
    return;
  }

  if (!text) {
    res.status(200).json({
      response_type: 'ephemeral',
      text: 'Usage: `/vendo <ask Atlas anything>`',
    });
    return;
  }

  // Schedule the agent run as a post-response background task. Vercel's
  // Fluid Compute freezes the function the moment we send the response,
  // so anything we do before waitUntil() must be the response itself —
  // and anything after must be inside waitUntil() for the platform to
  // keep the instance alive.
  waitUntil(runAgentAndDeliver({ slackUserId, text, responseUrl }));

  // ACK ephemerally so the user sees something within 3 s. The final
  // answer comes via response_url once the agent finishes.
  res.status(200).json({
    response_type: 'ephemeral',
    text: ':hourglass_flowing_sand: Atlas is thinking…',
  });
}

async function runAgentAndDeliver(opts: {
  slackUserId: string;
  text: string;
  responseUrl: string;
}): Promise<void> {
  const { slackUserId, text, responseUrl } = opts;
  try {
    const user = await slackUserIdToVendoUser(slackUserId);
    if (!user) {
      await postFollowup(responseUrl, ':x: I could not match your Slack account to a Vendo user.');
      return;
    }

    const agent = getAgentForUser(user);
    if (!agent) {
      await postFollowup(responseUrl, ':no_entry: Atlas is for Vendo team accounts only.');
      return;
    }

    const ctx: ToolCtx = {
      runId: '',
      agent: agent.name,
      user,
      channel: 'slack' as ChannelName,
      conversationId: null,
      graduations: new Set(),
    };

    const result = await runAgentBackground({
      agent,
      ctx,
      prompt: text,
      trigger: 'slack:command:/atlas',
      conversationId: null,
    });

    const reply = result.text?.trim()
      || (result.error ? `:warning: Atlas errored: ${result.error}` : '_(no reply)_');

    await postFollowup(responseUrl, reply);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[slack/commands] handler failed:', message);
    try {
      await postFollowup(responseUrl, `:warning: Atlas hit an error: ${message}`);
    } catch {
      /* swallow */
    }
  }
}

// ---------------------------------------------------------------------------
// response_url POST — Slack lets us deliver a follow-up to the invoker for
// up to 30 minutes after the slash command. We always send ephemeral so
// only they see it.
// ---------------------------------------------------------------------------

async function postFollowup(responseUrl: string, text: string): Promise<void> {
  await fetch(responseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ response_type: 'ephemeral', text }),
  });
}
