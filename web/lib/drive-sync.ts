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

// --- Phase 3: Drive API helpers ---

/**
 * Map of top-level watched folder IDs to channel slugs.
 * Built from env vars at module load time; entries with undefined env vars are omitted.
 */
const _channelEntries: [string, string][] = [];
if (process.env.DRIVE_FOLDER_PAID_SOCIAL) _channelEntries.push([process.env.DRIVE_FOLDER_PAID_SOCIAL, 'paid_social']);
if (process.env.DRIVE_FOLDER_SEO) _channelEntries.push([process.env.DRIVE_FOLDER_SEO, 'seo']);
if (process.env.DRIVE_FOLDER_PAID_ADS) _channelEntries.push([process.env.DRIVE_FOLDER_PAID_ADS, 'paid_ads']);
if (process.env.DRIVE_FOLDER_GENERAL) _channelEntries.push([process.env.DRIVE_FOLDER_GENERAL, 'general']);

export const CHANNEL_FOLDER_MAP = new Map<string, string>(_channelEntries);

/**
 * A single change entry from the Drive Changes API.
 */
export interface DriveChange {
  changeType: 'file' | 'drive';
  fileId: string;
  removed: boolean;
  file?: {
    id: string;
    name: string;
    mimeType: string;
    trashed: boolean;
    parents: string[];
    modifiedTime: string;
  };
}

interface ChangesListResponse {
  changes: DriveChange[];
  nextPageToken?: string;
  newStartPageToken?: string;
}

/**
 * Paginate through changes.list from the given pageToken.
 * Returns all accumulated changes and the new cursor token.
 */
export async function listChanges(
  userId: string,
  pageToken: string,
): Promise<{ changes: DriveChange[]; newPageToken: string }> {
  const accessToken = await getGoogleAccessToken(userId);
  if (!accessToken) throw new Error('No access token available for Drive changes.list');

  const allChanges: DriveChange[] = [];
  let currentToken = pageToken;

  while (true) {
    const params = new URLSearchParams({
      pageToken: currentToken,
      fields: 'changes(changeType,fileId,removed,file(id,name,mimeType,trashed,parents,modifiedTime)),nextPageToken,newStartPageToken',
      includeRemoved: 'true',
      spaces: 'drive',
    });

    const res = await fetch(`${DRIVE_API}/changes?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`changes.list failed: ${res.status} ${body}`);
    }

    const data = await res.json() as ChangesListResponse;
    allChanges.push(...(data.changes ?? []));

    if (data.newStartPageToken) {
      return { changes: allChanges, newPageToken: data.newStartPageToken };
    }
    if (data.nextPageToken) {
      currentToken = data.nextPageToken;
    } else {
      // Defensive fallback — should not happen when API responds correctly
      return { changes: allChanges, newPageToken: currentToken };
    }
  }
}

/**
 * Helper: call files.get with specified fields, returning parsed JSON.
 */
async function filesGet(fileId: string, accessToken: string, fields: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=${encodeURIComponent(fields)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`files.get failed for ${fileId}: ${res.status} ${body}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

/**
 * Walk up the parent chain (up to 5 levels) to find a watched top-level folder.
 * Returns the channel slug (e.g. 'paid_social') or null if outside all watched folders.
 */
export async function resolveChannel(
  fileId: string,
  accessToken: string,
): Promise<string | null> {
  let currentId = fileId;

  for (let level = 0; level < 5; level++) {
    const file = await filesGet(currentId, accessToken, 'id,parents');
    const parents = file.parents as string[] | undefined;
    if (!parents?.length) return null;

    const parentId = parents[0];
    if (CHANNEL_FOLDER_MAP.has(parentId)) {
      return CHANNEL_FOLDER_MAP.get(parentId)!;
    }
    currentId = parentId;
  }

  return null;
}

/**
 * Extract plain text content from a Drive file.
 * Returns null for spreadsheets, PDFs, and unsupported MIME types.
 * Returns null (with a console warning) if export fails due to file size limits (403).
 */
export async function extractContent(
  fileId: string,
  mimeType: string,
  accessToken: string,
): Promise<string | null> {
  try {
    if (mimeType === 'application/vnd.google-apps.document') {
      const res = await fetch(
        `${DRIVE_API}/files/${encodeURIComponent(fileId)}/export?mimeType=text%2Fplain`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (res.status === 403) {
        console.warn(`[drive-sync] extractContent: export size limit exceeded for file ${fileId} — storing metadata only`);
        return null;
      }
      if (!res.ok) return null;
      return res.text();
    }

    if (mimeType === 'application/vnd.google-apps.spreadsheet') {
      // Metadata only — spreadsheets are unlikely SOPs
      return null;
    }

    if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
      const res = await fetch(
        `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!res.ok) return null;
      return res.text();
    }

    // PDF, unknown MIME type — metadata only
    return null;
  } catch {
    return null;
  }
}

/**
 * Slugify a folder name for use as a skill_type value.
 * "Ad copy templates" → "ad_copy_templates"
 */
function slugifyFolderName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Derive skill_type from the file's immediate parent subfolder name.
 * If the file is directly inside a top-level channel folder, returns 'sop'.
 * Falls back to 'sop' if resolution fails.
 */
export async function resolveSkillType(
  fileId: string,
  accessToken: string,
): Promise<string> {
  try {
    const file = await filesGet(fileId, accessToken, 'id,parents');
    const parents = file.parents as string[] | undefined;
    const parentId = parents?.[0];
    if (!parentId) return 'sop';

    // File is directly inside the top-level channel folder
    if (CHANNEL_FOLDER_MAP.has(parentId)) return 'sop';

    const parent = await filesGet(parentId, accessToken, 'id,name');
    const name = parent.name as string | undefined;
    const slugified = name ? slugifyFolderName(name) : '';
    return slugified || 'sop';
  } catch {
    return 'sop';
  }
}

/**
 * Compute SHA-256 hex digest of a string.
 */
export function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}
