import { rows, scalar, db } from './base.js';

// --- Interfaces ---

export interface SkillSearchResult {
  id: number;
  title: string;
  content: string;
  channel: string;
  skill_type: string;
  drive_modified_at: string;
  content_hash: string;
  bm25_score: number;
}

export interface SkillSearchResponse {
  results: SkillSearchResult[];
  gap: boolean;
  query: string;
  channel: string;
}

export interface SkillVersionInfo {
  drive_modified_at: string;
  content_hash: string;
  indexed_at: string;
  version: number;
}

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

export interface SkillRow {
  id: number;
  drive_file_id: string;
  title: string;
  content: string;
  content_hash: string;
  channel: string;
  skill_type: string;
  drive_modified_at: string;
  indexed_at: string;
  version: number;
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

// --- Skills (Drive upsert) ---

/**
 * Upsert a Drive file's metadata into the skills table.
 * Content is left empty — Phase 3 handles extraction.
 * Idempotent: safe to run multiple times.
 */
export async function upsertSkillFromDrive(data: {
  driveFileId: string;
  title: string;
  channel: string;
  driveModifiedAt: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO skills (drive_file_id, title, content, content_hash, channel, skill_type, drive_modified_at, indexed_at, version)
          VALUES (?, ?, '', '', ?, 'sop', ?, ?, 1)
          ON CONFLICT(drive_file_id) DO UPDATE SET
            title = excluded.title,
            channel = excluded.channel,
            drive_modified_at = excluded.drive_modified_at,
            indexed_at = excluded.indexed_at`,
    args: [data.driveFileId, data.title, data.channel, data.driveModifiedAt, now],
  });
}

// --- Queue Processing ---

/**
 * Mark a queue item as processed. Pass an error string if processing failed.
 */
export async function markQueueItemProcessed(id: number, error?: string): Promise<void> {
  await db.execute({
    sql: `UPDATE drive_sync_queue SET processed_at = ?, error = ? WHERE id = ?`,
    args: [new Date().toISOString(), error ?? null, id],
  });
}

// --- Skills (Phase 3 content + metadata) ---

/**
 * Get a skill record by its Drive file ID. Returns null if not found.
 */
export async function getSkillByDriveFileId(driveFileId: string): Promise<SkillRow | null> {
  const result = await rows<SkillRow>(
    'SELECT * FROM skills WHERE drive_file_id = ?',
    [driveFileId],
  );
  return result[0] ?? null;
}

/**
 * Insert or update a skill with full content (triggers version increment on conflict).
 */
export async function updateSkillContent(data: {
  driveFileId: string;
  title: string;
  content: string;
  contentHash: string;
  channel: string;
  skillType: string;
  driveModifiedAt: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO skills (drive_file_id, title, content, content_hash, channel, skill_type, drive_modified_at, indexed_at, version)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
          ON CONFLICT(drive_file_id) DO UPDATE SET
            title = excluded.title,
            content = excluded.content,
            content_hash = excluded.content_hash,
            channel = excluded.channel,
            skill_type = excluded.skill_type,
            drive_modified_at = excluded.drive_modified_at,
            indexed_at = excluded.indexed_at,
            version = version + 1`,
    args: [
      data.driveFileId, data.title, data.content, data.contentHash,
      data.channel, data.skillType, data.driveModifiedAt, now,
    ],
  });
}

/**
 * Update skill metadata (title, channel, skill_type, drive_modified_at) without touching
 * content or content_hash. Used for renames, moves, and metadata-only changes.
 */
export async function updateSkillMetadata(data: {
  driveFileId: string;
  title: string;
  channel: string;
  skillType: string;
  driveModifiedAt: string;
}): Promise<void> {
  await db.execute({
    sql: `UPDATE skills SET title = ?, channel = ?, skill_type = ?, drive_modified_at = ?
          WHERE drive_file_id = ?`,
    args: [data.title, data.channel, data.skillType, data.driveModifiedAt, data.driveFileId],
  });
}

/**
 * Delete a skill record by Drive file ID.
 * Used when a file is trashed, permanently deleted, or moved outside watched folders.
 */
export async function deleteSkill(driveFileId: string): Promise<void> {
  await db.execute({
    sql: `DELETE FROM skills WHERE drive_file_id = ?`,
    args: [driveFileId],
  });
}

/**
 * Advance the stored pageToken for a watch channel after processing its changes.
 */
export async function updateDrivePageToken(channelId: string, pageToken: string): Promise<void> {
  await db.execute({
    sql: `UPDATE drive_watch_channels SET page_token = ? WHERE channel_id = ?`,
    args: [pageToken, channelId],
  });
}

// --- Skills FTS5 Search ---

/**
 * Full-text search across skills. Returns results in the given channel plus
 * any skills in the 'general' channel, ranked by BM25 relevance.
 *
 * When zero results are found, gap is set to true to signal a missing SOP.
 */
export async function searchSkills(
  query: string,
  channel: string,
  limit = 5,
): Promise<SkillSearchResponse> {
  // Sanitise: strip quotes, split on whitespace, append * to each token
  const ftsQuery = query.replace(/['"]/g, '').trim().split(/\s+/).filter(Boolean).map(w => w + '*').join(' ');

  if (!ftsQuery) {
    return { results: [], gap: true, query, channel };
  }

  const results = await rows<SkillSearchResult>(`
    SELECT s.id, s.title, s.content, s.channel, s.skill_type, s.drive_modified_at, s.content_hash,
           bm25(skills_fts) as bm25_score
    FROM skills_fts fts
    JOIN skills s ON s.rowid = fts.rowid
    WHERE skills_fts MATCH ?
      AND (s.channel = ? OR s.channel = 'general')
    ORDER BY bm25(skills_fts) ASC
    LIMIT ?
  `, [ftsQuery, channel, limit]);

  return {
    results,
    gap: results.length === 0,
    query,
    channel,
  };
}

// --- Skills FTS5 Sync Helpers ---

/**
 * Update the FTS5 index for a skill after its content has changed.
 * Uses the explicit DELETE-then-INSERT pattern required by content-sync tables.
 *
 * oldTitle/oldContent must be the values currently indexed in FTS5 (before the
 * skills row was updated). newTitle/newContent are the replacement values.
 * Passing the old values to the delete command is required for the FTS5
 * content-sync table to correctly remove the previously indexed tokens.
 */
export async function syncSkillFts(
  rowid: number,
  oldTitle: string,
  oldContent: string,
  newTitle: string,
  newContent: string,
): Promise<void> {
  await db.execute({
    sql: `INSERT INTO skills_fts(skills_fts, rowid, title, content) VALUES(?, ?, ?, ?)`,
    args: ['delete', rowid, oldTitle, oldContent],
  });
  await db.execute({
    sql: `INSERT INTO skills_fts(rowid, title, content) VALUES(?, ?, ?)`,
    args: [rowid, newTitle, newContent],
  });
}

/**
 * Remove a skill entry from the FTS5 index.
 * Must receive the current title and content values (required by content-sync tables).
 */
export async function deleteSkillFts(rowid: number, title: string, content: string): Promise<void> {
  await db.execute({
    sql: `INSERT INTO skills_fts(skills_fts, rowid, title, content) VALUES('delete', ?, ?, ?)`,
    args: [rowid, title, content],
  });
}

// --- Skills Version Tracking ---

/**
 * Get version metadata for a skill by its Drive file ID.
 * Returns null if the skill has not been indexed.
 */
export async function getSkillVersion(driveFileId: string): Promise<SkillVersionInfo | null> {
  const result = await rows<SkillVersionInfo>(
    `SELECT drive_modified_at, content_hash, indexed_at, version FROM skills WHERE drive_file_id = ?`,
    [driveFileId],
  );
  return result[0] ?? null;
}

/**
 * Return all skills in a channel that were indexed after the given ISO date string.
 */
export async function getSkillsByVersion(channel: string, since: string): Promise<SkillRow[]> {
  return rows<SkillRow>(
    `SELECT * FROM skills WHERE channel = ? AND indexed_at > ? ORDER BY indexed_at DESC`,
    [channel, since],
  );
}
