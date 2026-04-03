/**
 * Slack integration utilities.
 * Webhook alerts via SLACK_WEBHOOK_URL, Bot API via SLACK_BOT_TOKEN.
 * Set the relevant env vars in .env.local to enable.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

export async function sendSlackAlert(
  source: string,
  message: string,
  severity: 'error' | 'warning' = 'error'
): Promise<void> {
  if (!WEBHOOK_URL) return; // silently skip if not configured

  const icon = severity === 'error' ? ':rotating_light:' : ':warning:';
  const payload = {
    text: `${icon} *Vendo OS Sync ${severity.toUpperCase()}*\n*Source:* ${source}\n*Message:* ${message}\n*Time:* ${new Date().toISOString()}`,
  };

  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    // Don't throw — alerting failure shouldn't crash the sync
    console.error(`[slack-alert] Failed to send: ${err instanceof Error ? err.message : err}`);
  }
}

/**
 * Post a message to a specific Slack channel via Bot API.
 * Requires SLACK_BOT_TOKEN in .env.local.
 */
export async function sendSlackMessage(
  channel: string,
  text: string,
  blocks?: Record<string, unknown>[]
): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return;

  try {
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, text, ...(blocks ? { blocks } : {}) }),
    });
  } catch (err) {
    console.error(`[slack] Failed to post to ${channel}: ${err instanceof Error ? err.message : err}`);
  }
}

/**
 * Send a direct message to a Slack user via Bot API.
 * Opens a DM conversation first, then posts the message.
 * Requires SLACK_BOT_TOKEN in .env.local.
 */
export async function sendSlackDM(
  userId: string,
  text: string,
  blocks?: Record<string, unknown>[]
): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return;

  try {
    // Open a DM channel first
    const openRes = await fetch('https://slack.com/api/conversations.open', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ users: userId }),
    });
    const openData = await openRes.json() as { ok: boolean; channel?: { id: string } };
    if (!openData.ok || !openData.channel) return;

    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: openData.channel.id, text, ...(blocks ? { blocks } : {}) }),
    });
  } catch (err) {
    console.error(`[slack] Failed to DM ${userId}: ${err instanceof Error ? err.message : err}`);
  }
}
