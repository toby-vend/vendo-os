/**
 * /api/slack/events — Slack Events API receiver for the Vendo OS app.
 *
 * Wired to two endpoints in the Slack App config:
 *   - Event Subscriptions Request URL: https://<host>/api/slack/events
 *   - Subscribed bot events: message.im, app_mention
 *
 * Behaviour:
 *
 *   url_verification             → echo `challenge`
 *   event_callback / message.im  → run Atlas, post reply via chat.postMessage
 *   event_callback / app_mention → same as message.im, but post in-thread
 *
 * The handler ACKs Slack within 3 s (otherwise Slack retries). The agent
 * run itself happens after the ACK; Vercel keeps the function alive
 * until the async handler resolves, so we don't need waitUntil here.
 *
 * Bot scopes required: chat:write, im:history, app_mentions:read,
 * users:read.email.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { waitUntil } from '@vercel/functions';
import { verifySlackSignature, readRawBody } from '../../web/lib/agents/channels/slack-verify.js';
import {
  slackUserIdToVendoUser,
  postSlackMessage,
} from '../../web/lib/agents/channels/slack.js';
import { getAgentForUser } from '../../web/lib/agents/agents/index.js';
import { runAgentBackground } from '../../web/lib/agents/runtime.js';
import type { ToolCtx, ChannelName } from '../../web/lib/agents/types.js';

// Disable @vercel/node's body parser — we need the raw bytes Slack signed.
// The handler reads them via readRawBody() before any other access.
export const config = {
  runtime: 'nodejs',
  maxDuration: 120,
  api: { bodyParser: false },
};

// ---------------------------------------------------------------------------
// Slack payload shapes — minimal subset we care about.
// ---------------------------------------------------------------------------

interface SlackEnvelope {
  type: 'url_verification' | 'event_callback' | string;
  challenge?: string; // url_verification
  event?: SlackEvent;
  team_id?: string;
}

interface SlackEvent {
  type: 'message' | 'app_mention' | string;
  channel_type?: 'im' | 'channel' | 'group' | string;
  channel?: string;
  user?: string;
  text?: string;
  ts?: string;
  thread_ts?: string;
  bot_id?: string;
  subtype?: string;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.error('[slack/events] invoked', { method: req.method, ua: req.headers['user-agent'] });
  if (req.method !== 'POST') {
    res.status(405).end('method not allowed');
    return;
  }

  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    console.warn('[slack/events] SLACK_SIGNING_SECRET not set');
    res.status(503).end('not configured');
    return;
  }

  // 1) Read raw body before anything touches req — sign-over bytes must
  //    match Slack's HMAC exactly.
  let rawBody: string;
  try {
    rawBody = await readRawBody(req);
  } catch (err) {
    console.error('[slack/events] readRawBody failed:', err);
    res.status(400).end('cannot read body');
    return;
  }

  // 2) HMAC verify.
  const timestamp = String(req.headers['x-slack-request-timestamp'] || '');
  const signature = String(req.headers['x-slack-signature'] || '');
  if (!timestamp || !signature ||
      !verifySlackSignature({ signingSecret, timestamp, signature, rawBody })) {
    res.status(401).end('bad signature');
    return;
  }

  // 3) Parse envelope.
  let env: SlackEnvelope;
  try {
    env = JSON.parse(rawBody) as SlackEnvelope;
  } catch {
    res.status(400).end('bad json');
    return;
  }

  console.error('[slack/events] verified', { envType: env.type, eventType: env.event?.type, channelType: env.event?.channel_type });

  // 4) URL verification — one-off when the Slack App config is saved.
  if (env.type === 'url_verification') {
    res.status(200).json({ challenge: env.challenge ?? '' });
    return;
  }

  // 5) Slack retries failed dispatches. Treat retries as already-handled
  //    so we don't double-process. The original delivery already kicked
  //    off the agent run; if it's still finishing, the user will see the
  //    reply when it lands.
  const retryNum = req.headers['x-slack-retry-num'];
  if (retryNum) {
    res.status(200).end();
    return;
  }

  // 6) Anything that isn't a recognised event_callback gets a 200 ack
  //    (so Slack stops retrying) and is otherwise ignored.
  if (env.type !== 'event_callback' || !env.event) {
    res.status(200).end();
    return;
  }

  const event = env.event;

  // Ignore messages from bots (including ourselves) — prevents loops if
  // the app ever ends up in a channel where its own posts come back.
  if (event.bot_id || event.subtype === 'bot_message') {
    res.status(200).end();
    return;
  }

  const isDM = event.type === 'message' && event.channel_type === 'im';
  const isMention = event.type === 'app_mention';
  if (!isDM && !isMention) {
    res.status(200).end();
    return;
  }

  if (!event.user || !event.channel || !event.text) {
    res.status(200).end();
    return;
  }

  // 7) Schedule the agent run as a background task and ack within the
  //    3-second budget. Vercel's Fluid Compute freezes the function the
  //    moment we send the response, so any work that needs to outlive
  //    the ack must be inside waitUntil().
  const channel = event.channel;
  const threadTs = event.thread_ts || (isMention ? event.ts : undefined);
  const slackUserId = event.user;
  const inboundText = stripBotMention(event.text);

  waitUntil(
    runAgentAndDeliver({
      slackUserId,
      channel,
      threadTs,
      inboundText,
      isMention,
    }),
  );

  res.status(200).end();
}

async function runAgentAndDeliver(opts: {
  slackUserId: string;
  channel: string;
  threadTs: string | undefined;
  inboundText: string;
  isMention: boolean;
}): Promise<void> {
  const { slackUserId, channel, threadTs, inboundText, isMention } = opts;
  try {
    const user = await slackUserIdToVendoUser(slackUserId);
    if (!user) {
      await postSlackMessage({
        channel,
        threadTs,
        text: ":wave: I couldn't match your Slack account to a Vendo user. Ask an admin to check that your Slack email matches your Vendo email.",
      });
      return;
    }

    const agent = getAgentForUser(user);
    if (!agent) {
      await postSlackMessage({
        channel,
        threadTs,
        text: ':no_entry: Atlas is for Vendo team accounts only. Client-portal users do not have access here.',
      });
      return;
    }

    const ctx: ToolCtx = {
      runId: '', // runtime stamps the real id on a fresh copy
      user,
      channel: 'slack' as ChannelName,
      conversationId: threadTs ?? null,
      graduations: new Set(),
    };

    const result = await runAgentBackground({
      agent,
      ctx,
      prompt: inboundText,
      trigger: isMention ? 'slack:app_mention' : 'slack:dm',
      conversationId: threadTs ?? null,
    });

    const reply = result.text?.trim()
      || (result.error ? `:warning: Atlas errored: ${result.error}` : '_(no reply)_');

    await postSlackMessage({ channel, threadTs, text: reply });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[slack/events] handler failed:', message);
    try {
      await postSlackMessage({
        channel,
        threadTs,
        text: `:warning: Atlas hit an error: ${message}`,
      });
    } catch {
      /* swallow */
    }
  }
}

// ---------------------------------------------------------------------------
// strip the leading <@BOTID> mention from app_mention text. The bot id is
// not on the event itself (Slack puts it on `authed_users` at the top
// level, but only for some event types). Stripping any leading `<@...>`
// works for both DM and mention shapes — DMs never carry one.
// ---------------------------------------------------------------------------

function stripBotMention(text: string): string {
  return text.replace(/^\s*<@[A-Z0-9]+>\s*/, '').trim();
}
