import { config } from 'dotenv';
config({ path: '.env.local' });

import {
  getUnprocessedSyncQueueItems,
  getDriveWatchChannel,
  markQueueItemProcessed,
  getSkillByDriveFileId,
  updateSkillContent,
  updateSkillMetadata,
  deleteSkill,
  updateDrivePageToken,
} from '../../web/lib/queries/drive.js';

import {
  listChanges,
  resolveChannel,
  extractContent,
  resolveSkillType,
  hashContent,
  type DriveChange,
} from '../../web/lib/drive-sync.js';

/**
 * Process a single Drive change event.
 *
 * Pattern 4 from RESEARCH.md:
 * 1. Ignore drive-level changes.
 * 2. Trashed / removed → deleteSkill.
 * 3. Missing file metadata → skip.
 * 4. resolveChannel null → deleteSkill (moved outside watched folders).
 * 5. Extract content + hash.
 * 6. Same hash → updateSkillMetadata only.
 * 7. Changed hash → updateSkillContent (full upsert).
 * 8. No content (non-indexable) → updateSkillMetadata.
 */
export async function processChange(change: DriveChange, accessToken: string): Promise<void> {
  // 1. Ignore drive-level changes
  if (change.changeType !== 'file') return;

  const fileId = change.fileId;

  // 2. Trashed or removed → delete
  if (change.removed || change.file?.trashed) {
    await deleteSkill(fileId);
    return;
  }

  // 3. No file metadata → skip
  if (!change.file) return;

  const { name, mimeType, modifiedTime } = change.file;

  // 4. Resolve channel; if null the file is outside watched folders → delete
  const channel = await resolveChannel(fileId, accessToken);
  if (channel === null) {
    await deleteSkill(fileId);
    return;
  }

  // 5. Derive skill type
  const skillType = await resolveSkillType(fileId, accessToken);

  // 6. Extract content
  const content = await extractContent(fileId, mimeType, accessToken);

  if (content !== null) {
    // 7. Hash gate: compare against existing record
    const newHash = hashContent(content);
    const existing = await getSkillByDriveFileId(fileId);

    if (existing && existing.content_hash === newHash) {
      // Same content — metadata-only update (covers renames and reclassification)
      await updateSkillMetadata({
        driveFileId: fileId,
        title: name,
        channel,
        skillType,
        driveModifiedAt: modifiedTime,
      });
    } else {
      // New or changed content — full upsert
      await updateSkillContent({
        driveFileId: fileId,
        title: name,
        content,
        contentHash: newHash,
        channel,
        skillType,
        driveModifiedAt: modifiedTime,
      });
    }
  } else {
    // 8. Non-indexable type — metadata only
    await updateSkillMetadata({
      driveFileId: fileId,
      title: name,
      channel,
      skillType,
      driveModifiedAt: modifiedTime,
    });
  }
}

/**
 * Consume unprocessed drive_sync_queue items.
 *
 * Pattern 1 from RESEARCH.md:
 * - Groups items by channel_id (one changes.list call per channel).
 * - Persists the new pageToken BEFORE processing changes (pitfall 2).
 * - Per-change errors are caught without aborting the batch.
 * - All queue items marked processed (with error string on failure).
 */
export async function processQueue(): Promise<{ processed: number; errors: number }> {
  const items = await getUnprocessedSyncQueueItems(50);
  if (items.length === 0) return { processed: 0, errors: 0 };

  // Group by channel_id (deduplicate multiple webhooks for the same batch)
  const channelGroups = new Map<string, typeof items>();
  for (const item of items) {
    const existing = channelGroups.get(item.channel_id) ?? [];
    existing.push(item);
    channelGroups.set(item.channel_id, existing);
  }

  let totalErrors = 0;
  const itemErrors = new Map<number, string>();

  for (const [channelId, groupItems] of channelGroups) {
    const channel = await getDriveWatchChannel(channelId);
    if (!channel || !channel.page_token) {
      // Mark all items in this group as errored
      const errMsg = channel ? 'No page_token on channel' : 'Channel not found';
      for (const item of groupItems) {
        itemErrors.set(item.id, errMsg);
        totalErrors++;
      }
      continue;
    }

    const userId = channel.user_id ?? process.env.DRIVE_ADMIN_USER_ID;
    if (!userId) {
      const errMsg = 'No userId available — set DRIVE_ADMIN_USER_ID';
      for (const item of groupItems) {
        itemErrors.set(item.id, errMsg);
        totalErrors++;
      }
      continue;
    }

    let changes: DriveChange[];
    let newPageToken: string;
    try {
      const result = await listChanges(userId, channel.page_token) as { changes: DriveChange[]; newPageToken: string };
      changes = result.changes;
      newPageToken = result.newPageToken;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      for (const item of groupItems) {
        itemErrors.set(item.id, errMsg);
        totalErrors++;
      }
      continue;
    }

    // Persist new pageToken BEFORE processing — prevents token loss on crash
    await updateDrivePageToken(channelId, newPageToken);

    // Get access token once for this channel's user
    // (listChanges already refreshes internally, but processChange needs it for per-file calls)
    const { getGoogleAccessToken } = await import('../../web/lib/google-tokens.js');
    const accessToken = await getGoogleAccessToken(userId);
    if (!accessToken) {
      const errMsg = 'Could not obtain Google access token for userId: ' + userId;
      for (const item of groupItems) {
        itemErrors.set(item.id, errMsg);
        totalErrors++;
      }
      continue;
    }

    // Process each change — errors are isolated (do not abort the batch)
    for (const change of changes) {
      try {
        await processChange(change, accessToken);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[process-drive-queue] Error processing change for file ${change.fileId}: ${errMsg}`);
        totalErrors++;
      }
    }
  }

  // Mark all queue items as processed
  for (const item of items) {
    const error = itemErrors.get(item.id);
    await markQueueItemProcessed(item.id, error);
  }

  return { processed: items.length, errors: totalErrors };
}

// --- CLI entry point ---

async function main() {
  const result = await processQueue();
  console.log(`Processed: ${result.processed}, Errors: ${result.errors}`);
}

if (process.argv[1]?.endsWith('process-drive-queue.ts') || process.argv[1]?.endsWith('process-drive-queue.js')) {
  main().catch(err => { console.error(err); process.exit(1); });
}
