import { rows, scalar, db } from './base.js';

// --- Interfaces ---

export interface DriveWatchChannelRow {
  id: number;
  channel_id: string;
  resource_id: string;
  expiration: number;
  page_token: string | null;
  user_id: string | null;
  created_at: string;
  renewed_at: string | null;
}

export interface DriveSyncQueueRow {
  id: number;
  channel_id: string;
  resource_state: string;
  received_at: string;
  processed_at: string | null;
  error: string | null;
}

// --- Drive Watch Channels ---

export async function getDriveWatchChannel(channelId: string): Promise<DriveWatchChannelRow | null> {
  const result = await rows<DriveWatchChannelRow>(
    'SELECT * FROM drive_watch_channels WHERE channel_id = ?',
    [channelId]
  );
  return result[0] ?? null;
}

export async function upsertDriveWatchChannel(data: {
  channelId: string;
  resourceId: string;
  expiration: number;
  pageToken?: string;
  userId?: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO drive_watch_channels (channel_id, resource_id, expiration, page_token, user_id, created_at, renewed_at)
          VALUES (?, ?, ?, ?, ?, ?, NULL)
          ON CONFLICT(channel_id) DO UPDATE SET
            resource_id = excluded.resource_id,
            expiration = excluded.expiration,
            page_token = excluded.page_token,
            user_id = excluded.user_id,
            renewed_at = ?`,
    args: [data.channelId, data.resourceId, data.expiration, data.pageToken ?? null, data.userId ?? null, now, now],
  });
}

export async function getChannelsExpiringWithin24h(): Promise<DriveWatchChannelRow[]> {
  return rows<DriveWatchChannelRow>(
    'SELECT * FROM drive_watch_channels WHERE expiration < ?',
    [Date.now() + 86_400_000]
  );
}

export async function getAllDriveWatchChannels(): Promise<DriveWatchChannelRow[]> {
  return rows<DriveWatchChannelRow>('SELECT * FROM drive_watch_channels ORDER BY created_at DESC');
}

export async function deleteDriveWatchChannel(channelId: string): Promise<void> {
  await db.execute({
    sql: 'DELETE FROM drive_watch_channels WHERE channel_id = ?',
    args: [channelId],
  });
}

// --- Drive Sync Queue ---

export async function insertDriveSyncQueueItem(data: {
  channelId: string;
  resourceState: string;
}): Promise<void> {
  await db.execute({
    sql: `INSERT INTO drive_sync_queue (channel_id, resource_state, received_at, processed_at, error)
          VALUES (?, ?, ?, NULL, NULL)`,
    args: [data.channelId, data.resourceState, new Date().toISOString()],
  });
}

export async function getUnprocessedSyncQueueItems(limit = 100): Promise<DriveSyncQueueRow[]> {
  return rows<DriveSyncQueueRow>(
    'SELECT * FROM drive_sync_queue WHERE processed_at IS NULL ORDER BY received_at ASC LIMIT ?',
    [limit]
  );
}
