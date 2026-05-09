/**
 * Slack channel — bot-token-backed adapter for the conversational and
 * approval surfaces.
 *
 * Uses the existing SLACK_BOT_TOKEN env var (already present per
 * web/lib/notifications.ts) to call chat.postMessage and users.lookupByEmail.
 *
 * The full "Vendo OS" Slack App with Events API + interactivity URLs is
 * Block 8 work; this adapter ships the *outbound* half today so cron
 * agents can deliver approval cards to Slack DMs from week one. Inbound
 * (DM → agent + button → recommendations.decide) lands when the App is
 * created.
 *
 * If SLACK_BOT_TOKEN is unset, every method logs and returns — never
 * throws. This keeps the runtime working in dev without a Slack app.
 */
import type { Channel, ApprovalCard } from './_channel';
import { logChannel } from './_channel';
import { getUserById } from '../../queries/auth';

const SLACK_API = 'https://slack.com/api';
const TOKEN = process.env.SLACK_BOT_TOKEN;

async function lookupSlackUserIdByEmail(email: string): Promise<string | null> {
  if (!TOKEN) return null;
  try {
    const res = await fetch(
      `${SLACK_API}/users.lookupByEmail?email=${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${TOKEN}` } },
    );
    const data = (await res.json()) as { ok: boolean; user?: { id: string } };
    return data.ok && data.user ? data.user.id : null;
  } catch (err: unknown) {
    console.error(
      '[channel:slack] lookupSlackUserIdByEmail failed:',
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

async function vendoUserToSlackId(vendoUserId: string): Promise<string | null> {
  const user = await getUserById(vendoUserId);
  if (!user) return null;
  return lookupSlackUserIdByEmail(user.email);
}

async function postToSlack(body: Record<string, unknown>): Promise<boolean> {
  if (!TOKEN) {
    logChannel('slack', 'postToSlack.skipped', { reason: 'no SLACK_BOT_TOKEN' });
    return false;
  }
  try {
    const res = await fetch(`${SLACK_API}/chat.postMessage`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!data.ok) {
      console.error('[channel:slack] chat.postMessage error:', data.error);
    }
    return data.ok;
  } catch (err: unknown) {
    console.error(
      '[channel:slack] chat.postMessage failed:',
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
}

// ---------------------------------------------------------------------------
// Block Kit renderer — converts an ApprovalCard into the blocks payload
// chat.postMessage expects. Action ids carry the recommendation id so the
// Events API receiver (Block 8) can route the click back to
// recommendations.decide().
// ---------------------------------------------------------------------------

function approvalBlocks(card: ApprovalCard) {
  const fieldLines = card.fields
    .map(f => `*${f.label}:* ${f.value}`)
    .join('\n');
  const sourceLinks = (card.sourceLinks ?? [])
    .map(s => `<${s.url}|${s.label}>`)
    .join(' · ');

  return [
    { type: 'header', text: { type: 'plain_text', text: card.title.slice(0, 150) } },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: card.reasoning },
    },
    ...(fieldLines
      ? [{ type: 'section', text: { type: 'mrkdwn', text: fieldLines } }]
      : []),
    ...(sourceLinks
      ? [
          {
            type: 'context',
            elements: [{ type: 'mrkdwn', text: `Sources: ${sourceLinks}` }],
          },
        ]
      : []),
    {
      type: 'actions',
      block_id: `rec_${card.id}`,
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Approve' },
          style: 'primary',
          action_id: `approve:${card.id}`,
          value: card.id,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Edit' },
          action_id: `edit:${card.id}`,
          value: card.id,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Reject' },
          style: 'danger',
          action_id: `reject:${card.id}`,
          value: card.id,
        },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// Channel implementation
// ---------------------------------------------------------------------------

export const slackChannel: Channel = {
  name: 'slack',

  async sendMessage(channelOrUser: string, text: string) {
    logChannel('slack', 'sendMessage', { channel: channelOrUser });
    await postToSlack({ channel: channelOrUser, text });
  },

  async requestApproval(userId: string, card: ApprovalCard) {
    logChannel('slack', 'requestApproval', { userId, recId: card.id });
    const slackId = await vendoUserToSlackId(userId);
    if (!slackId) {
      console.warn(
        `[channel:slack] no slack user found for vendo user '${userId}' — skipping approval card.`,
      );
      return;
    }
    await postToSlack({
      channel: slackId,
      text: `Vendo: ${card.title}`,
      blocks: approvalBlocks(card),
    });
  },

  async deliverProactive(userId, payload) {
    logChannel('slack', 'deliverProactive', { userId, title: payload.title });
    const slackId = await vendoUserToSlackId(userId);
    if (!slackId) return;
    const text = payload.url
      ? `*${payload.title}*\n${payload.body}\n<${payload.url}|Open>`
      : `*${payload.title}*\n${payload.body}`;
    await postToSlack({ channel: slackId, text });
  },
};
