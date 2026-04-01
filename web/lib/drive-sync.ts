import { createHash } from 'node:crypto';
import crypto from 'node:crypto';
import { getGoogleAccessToken } from './google-tokens.js';
import { getUserOAuthToken } from './queries.js';
import {
  upsertDriveWatchChannel,
  deleteDriveWatchChannel,
  type DriveWatchChannelRow,
} from './queries/drive.js';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';

/**
 * Register a new Google Drive push notification channel.
 * Sequence: get token -> check scopes -> getStartPageToken -> watch -> persist
 */
export async function registerWatchChannel(
  userId: string,
  webhookUrl: string,
): Promise<{ channelId: string; resourceId: string; expiration: number; pageToken: string }> {
  const accessToken = await getGoogleAccessToken(userId);
  if (!accessToken) {
    throw new Error('Admin has not connected Google account');
  }

  // Check stored scopes include drive.readonly
  const oauthRow = await getUserOAuthToken(userId, 'google');
  if (!oauthRow || !oauthRow.scopes.includes('drive.readonly')) {
    throw new Error('Admin must reconnect Google account to grant Drive access');
  }

  // Get the start page token
  const pageTokenRes = await fetch(`${DRIVE_API}/changes/startPageToken`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!pageTokenRes.ok) {
    const body = await pageTokenRes.text();
    throw new Error(`Failed to get startPageToken: ${pageTokenRes.status} ${body}`);
  }
  const { startPageToken } = await pageTokenRes.json() as { startPageToken: string };

  const channelId = crypto.randomUUID();
  const secret = process.env.DRIVE_WEBHOOK_SECRET;

  // Register the watch channel
  const watchRes = await fetch(`${DRIVE_API}/changes/watch?pageToken=${encodeURIComponent(startPageToken)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: channelId,
      type: 'web_hook',
      address: webhookUrl,
      token: secret,
    }),
  });
  if (!watchRes.ok) {
    const body = await watchRes.text();
    throw new Error(`Failed to register watch channel: ${watchRes.status} ${body}`);
  }

  const { resourceId, expiration } = await watchRes.json() as { resourceId: string; expiration: string };
  const expirationMs = parseInt(expiration, 10);

  // Persist to DB before returning — pageToken is never held only in memory
  await upsertDriveWatchChannel({
    channelId,
    resourceId,
    expiration: expirationMs,
    pageToken: startPageToken,
    userId,
  });

  return { channelId, resourceId, expiration: expirationMs, pageToken: startPageToken };
}

/**
 * Stop a watch channel (best-effort) and remove from DB.
 */
export async function stopWatchChannel(
  channelId: string,
  resourceId: string,
  userId: string,
): Promise<void> {
  try {
    const accessToken = await getGoogleAccessToken(userId);
    if (accessToken) {
      await fetch(`${DRIVE_API}/channels/stop`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: channelId, resourceId }),
      });
      // Errors ignored — channel may already be expired
    }
  } catch {
    // Best-effort — never throw
  }

  await deleteDriveWatchChannel(channelId);
}

/**
 * Renew an expiring watch channel: stop the old one, register a new one.
 */
export async function renewChannel(
  channel: DriveWatchChannelRow,
): Promise<{ channelId: string; resourceId: string; expiration: number; pageToken: string }> {
  const userId = channel.user_id ?? process.env.DRIVE_ADMIN_USER_ID;
  if (!userId) {
    throw new Error('No userId available for channel renewal — set DRIVE_ADMIN_USER_ID');
  }

  // Stop old channel (best-effort)
  await stopWatchChannel(channel.channel_id, channel.resource_id, userId);

  // Determine webhook URL
  const webhookUrl =
    process.env.DRIVE_WEBHOOK_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/api/drive/webhook`
      : null);

  if (!webhookUrl) {
    throw new Error('DRIVE_WEBHOOK_URL or VERCEL_PROJECT_PRODUCTION_URL must be set');
  }

  return registerWatchChannel(userId, webhookUrl);
}
