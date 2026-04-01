import { describe, it, before, mock } from 'node:test';
import assert from 'node:assert/strict';

// --- Mock state holders ---

let mockGetUnprocessedSyncQueueItems: () => Promise<unknown[]> = async () => [];
let mockGetDriveWatchChannel: (channelId: string) => Promise<unknown> = async () => null;
let mockMarkQueueItemProcessed: (id: number, error?: string) => Promise<void> = async () => {};
let mockGetSkillByDriveFileId: (driveFileId: string) => Promise<unknown> = async () => null;
let mockUpdateSkillContent: (data: unknown) => Promise<void> = async () => {};
let mockUpdateSkillMetadata: (data: unknown) => Promise<void> = async () => {};
let mockDeleteSkill: (driveFileId: string) => Promise<void> = async () => {};
let mockUpdateDrivePageToken: (channelId: string, pageToken: string) => Promise<void> = async () => {};

let mockListChanges: (userId: string, pageToken: string) => Promise<unknown> = async () => ({ changes: [], newPageToken: 'tok2' });
let mockResolveChannel: (fileId: string, accessToken: string) => Promise<string | null> = async () => null;
let mockExtractContent: (fileId: string, mimeType: string, accessToken: string) => Promise<string | null> = async () => null;
let mockResolveSkillType: (fileId: string, accessToken: string) => Promise<string> = async () => 'sop';
let mockHashContent: (content: string) => string = (c) => 'hash_' + c.slice(0, 8);

let mockGetGoogleAccessToken: (userId: string) => Promise<string | null> = async () => 'fake-token';

// --- Module mocks (before any imports of the module under test) ---

mock.module('../../web/lib/queries/drive.js', {
  namedExports: {
    getUnprocessedSyncQueueItems: (limit?: number) => mockGetUnprocessedSyncQueueItems(),
    getDriveWatchChannel: (channelId: string) => mockGetDriveWatchChannel(channelId),
    markQueueItemProcessed: (id: number, error?: string) => mockMarkQueueItemProcessed(id, error),
    getSkillByDriveFileId: (driveFileId: string) => mockGetSkillByDriveFileId(driveFileId),
    updateSkillContent: (data: unknown) => mockUpdateSkillContent(data),
    updateSkillMetadata: (data: unknown) => mockUpdateSkillMetadata(data),
    deleteSkill: (driveFileId: string) => mockDeleteSkill(driveFileId),
    updateDrivePageToken: (channelId: string, pageToken: string) => mockUpdateDrivePageToken(channelId, pageToken),
  },
});

mock.module('../../web/lib/drive-sync.js', {
  namedExports: {
    listChanges: (userId: string, pageToken: string) => mockListChanges(userId, pageToken),
    resolveChannel: (fileId: string, accessToken: string) => mockResolveChannel(fileId, accessToken),
    extractContent: (fileId: string, mimeType: string, accessToken: string) => mockExtractContent(fileId, mimeType, accessToken),
    resolveSkillType: (fileId: string, accessToken: string) => mockResolveSkillType(fileId, accessToken),
    hashContent: (content: string) => mockHashContent(content),
    CHANNEL_FOLDER_MAP: new Map(),
  },
});

mock.module('../../web/lib/google-tokens.js', {
  namedExports: {
    getGoogleAccessToken: (userId: string) => mockGetGoogleAccessToken(userId),
  },
});

// Import module under test AFTER mocks are registered
const { processChange, processQueue } = await import('./process-drive-queue.js');

// Helper: build a minimal DriveChange object
function makeChange(overrides: Partial<{
  changeType: 'file' | 'drive';
  fileId: string;
  removed: boolean;
  file: {
    id: string;
    name: string;
    mimeType: string;
    trashed: boolean;
    parents: string[];
    modifiedTime: string;
  } | undefined;
}> = {}) {
  return {
    changeType: 'file' as const,
    fileId: 'file-123',
    removed: false,
    file: {
      id: 'file-123',
      name: 'Test SOP',
      mimeType: 'application/vnd.google-apps.document',
      trashed: false,
      parents: ['folder-abc'],
      modifiedTime: '2026-01-01T00:00:00Z',
    },
    ...overrides,
  };
}

// --- processChange tests ---

describe('processChange', () => {

  // SYNC-02: File under DRIVE_FOLDER_PAID_SOCIAL -> resolveChannel returns 'paid_social'
  it('SYNC-02: calls updateSkillContent when resolveChannel returns a channel slug', async () => {
    mockResolveChannel = async () => 'paid_social';
    mockResolveSkillType = async () => 'sop';
    mockExtractContent = async () => 'SOP content here';
    mockHashContent = () => 'abc123';
    mockGetSkillByDriveFileId = async () => null; // no existing skill
    const calls: unknown[] = [];
    mockUpdateSkillContent = async (data) => { calls.push(data); };
    mockUpdateSkillMetadata = async () => { throw new Error('should not call updateSkillMetadata'); };
    mockDeleteSkill = async () => { throw new Error('should not call deleteSkill'); };

    const change = makeChange();
    await processChange(change, 'fake-token');

    assert.equal(calls.length, 1, 'updateSkillContent should be called once');
    const call = calls[0] as { driveFileId: string; channel: string; content: string; contentHash: string };
    assert.equal(call.driveFileId, 'file-123');
    assert.equal(call.channel, 'paid_social');
    assert.equal(call.content, 'SOP content here');
    assert.equal(call.contentHash, 'abc123');

    // reset
    mockUpdateSkillContent = async () => {};
    mockUpdateSkillMetadata = async () => {};
    mockDeleteSkill = async () => {};
  });

  // SYNC-02: File 2 levels deep under DRIVE_FOLDER_SEO -> resolveChannel returns 'seo'
  it('SYNC-02: resolveChannel returning seo sets channel to seo on updateSkillContent', async () => {
    mockResolveChannel = async () => 'seo';
    mockResolveSkillType = async () => 'link_building';
    mockExtractContent = async () => 'SEO content';
    mockHashContent = () => 'seo-hash';
    mockGetSkillByDriveFileId = async () => null;
    const calls: unknown[] = [];
    mockUpdateSkillContent = async (data) => { calls.push(data); };

    const change = makeChange({ fileId: 'file-seo', file: { id: 'file-seo', name: 'Link Building SOP', mimeType: 'application/vnd.google-apps.document', trashed: false, parents: ['subfolder-id'], modifiedTime: '2026-01-01T00:00:00Z' } });
    await processChange(change, 'fake-token');

    assert.equal(calls.length, 1);
    const call = calls[0] as { channel: string; skillType: string };
    assert.equal(call.channel, 'seo');
    assert.equal(call.skillType, 'link_building');

    mockUpdateSkillContent = async () => {};
  });

  // SYNC-02: File outside all watched folders -> resolveChannel returns null -> deleteSkill
  it('SYNC-02: calls deleteSkill when resolveChannel returns null (outside watched folders)', async () => {
    mockResolveChannel = async () => null;
    const deleted: string[] = [];
    mockDeleteSkill = async (fileId) => { deleted.push(fileId); };
    mockUpdateSkillContent = async () => { throw new Error('should not call updateSkillContent'); };
    mockUpdateSkillMetadata = async () => { throw new Error('should not call updateSkillMetadata'); };

    const change = makeChange({ fileId: 'file-outside' });
    await processChange(change, 'fake-token');

    assert.equal(deleted.length, 1);
    assert.equal(deleted[0], 'file-outside');

    mockDeleteSkill = async () => {};
    mockUpdateSkillContent = async () => {};
    mockUpdateSkillMetadata = async () => {};
  });

  // SYNC-04: Same content hash -> updateSkillMetadata called (not updateSkillContent)
  it('SYNC-04: calls updateSkillMetadata when content hash is unchanged', async () => {
    mockResolveChannel = async () => 'paid_social';
    mockResolveSkillType = async () => 'sop';
    mockExtractContent = async () => 'existing content';
    mockHashContent = () => 'same-hash';
    mockGetSkillByDriveFileId = async () => ({ id: 1, drive_file_id: 'file-123', title: 'Old Title', content: 'existing content', content_hash: 'same-hash', channel: 'paid_social', skill_type: 'sop', drive_modified_at: '2026-01-01T00:00:00Z', indexed_at: '2026-01-01T00:00:00Z', version: 1 });
    const metadataCalls: unknown[] = [];
    mockUpdateSkillMetadata = async (data) => { metadataCalls.push(data); };
    mockUpdateSkillContent = async () => { throw new Error('should not call updateSkillContent on same hash'); };

    const change = makeChange();
    await processChange(change, 'fake-token');

    assert.equal(metadataCalls.length, 1, 'updateSkillMetadata should be called once');

    mockUpdateSkillMetadata = async () => {};
    mockUpdateSkillContent = async () => {};
  });

  // SYNC-04: Changed content hash -> updateSkillContent called with new hash
  it('SYNC-04: calls updateSkillContent when content hash changes', async () => {
    mockResolveChannel = async () => 'paid_social';
    mockResolveSkillType = async () => 'sop';
    mockExtractContent = async () => 'new content';
    mockHashContent = () => 'new-hash';
    mockGetSkillByDriveFileId = async () => ({ id: 1, drive_file_id: 'file-123', title: 'Old Title', content: 'old content', content_hash: 'old-hash', channel: 'paid_social', skill_type: 'sop', drive_modified_at: '2026-01-01T00:00:00Z', indexed_at: '2026-01-01T00:00:00Z', version: 1 });
    const contentCalls: unknown[] = [];
    mockUpdateSkillContent = async (data) => { contentCalls.push(data); };
    mockUpdateSkillMetadata = async () => { throw new Error('should not call updateSkillMetadata on hash change'); };

    const change = makeChange();
    await processChange(change, 'fake-token');

    assert.equal(contentCalls.length, 1);
    const call = contentCalls[0] as { contentHash: string };
    assert.equal(call.contentHash, 'new-hash');

    mockUpdateSkillContent = async () => {};
    mockUpdateSkillMetadata = async () => {};
  });

  // SYNC-05: change.removed=true + file.trashed=true -> deleteSkill called
  it('SYNC-05: calls deleteSkill when change.removed is true', async () => {
    const deleted: string[] = [];
    mockDeleteSkill = async (fileId) => { deleted.push(fileId); };
    mockResolveChannel = async () => { throw new Error('should not resolve channel on removed change'); };

    const change = makeChange({ removed: true, fileId: 'file-removed', file: { id: 'file-removed', name: 'Removed', mimeType: 'application/vnd.google-apps.document', trashed: true, parents: [], modifiedTime: '2026-01-01T00:00:00Z' } });
    await processChange(change, 'fake-token');

    assert.equal(deleted.length, 1);
    assert.equal(deleted[0], 'file-removed');

    mockDeleteSkill = async () => {};
    mockResolveChannel = async () => null;
  });

  // SYNC-05: file.trashed=true -> deleteSkill called
  it('SYNC-05: calls deleteSkill when file.trashed is true', async () => {
    const deleted: string[] = [];
    mockDeleteSkill = async (fileId) => { deleted.push(fileId); };
    mockResolveChannel = async () => { throw new Error('should not resolve channel on trashed file'); };

    const change = makeChange({ removed: false, fileId: 'file-trashed', file: { id: 'file-trashed', name: 'Trashed', mimeType: 'application/vnd.google-apps.document', trashed: true, parents: ['folder-abc'], modifiedTime: '2026-01-01T00:00:00Z' } });
    await processChange(change, 'fake-token');

    assert.equal(deleted.length, 1);
    assert.equal(deleted[0], 'file-trashed');

    mockDeleteSkill = async () => {};
    mockResolveChannel = async () => null;
  });

  // SYNC-05: Rename (name change, same content hash) -> title updated via updateSkillMetadata, content NOT re-indexed
  it('SYNC-05: rename updates title via updateSkillMetadata without re-indexing content', async () => {
    mockResolveChannel = async () => 'paid_social';
    mockResolveSkillType = async () => 'sop';
    mockExtractContent = async () => 'same content';
    mockHashContent = () => 'same-hash';
    mockGetSkillByDriveFileId = async () => ({ id: 1, drive_file_id: 'file-renamed', title: 'Old Title', content: 'same content', content_hash: 'same-hash', channel: 'paid_social', skill_type: 'sop', drive_modified_at: '2026-01-01T00:00:00Z', indexed_at: '2026-01-01T00:00:00Z', version: 1 });
    const metadataCalls: Array<{ title: string }> = [];
    mockUpdateSkillMetadata = async (data) => { metadataCalls.push(data as { title: string }); };
    mockUpdateSkillContent = async () => { throw new Error('should not update content on rename'); };

    const change = makeChange({ fileId: 'file-renamed', file: { id: 'file-renamed', name: 'New Title', mimeType: 'application/vnd.google-apps.document', trashed: false, parents: ['folder-abc'], modifiedTime: '2026-01-01T00:00:00Z' } });
    await processChange(change, 'fake-token');

    assert.equal(metadataCalls.length, 1);
    assert.equal(metadataCalls[0].title, 'New Title');

    mockUpdateSkillMetadata = async () => {};
    mockUpdateSkillContent = async () => {};
  });

  // SYNC-05: Move between channel folders -> skills.channel updated to new channel
  it('SYNC-05: move between channel folders updates channel via updateSkillMetadata or updateSkillContent', async () => {
    mockResolveChannel = async () => 'seo'; // moved to seo
    mockResolveSkillType = async () => 'sop';
    mockExtractContent = async () => 'content after move';
    mockHashContent = () => 'moved-hash';
    mockGetSkillByDriveFileId = async () => ({ id: 1, drive_file_id: 'file-moved', title: 'Moved File', content: 'content after move', content_hash: 'old-hash-different', channel: 'paid_social', skill_type: 'sop', drive_modified_at: '2026-01-01T00:00:00Z', indexed_at: '2026-01-01T00:00:00Z', version: 1 });
    const contentCalls: Array<{ channel: string }> = [];
    mockUpdateSkillContent = async (data) => { contentCalls.push(data as { channel: string }); };
    mockUpdateSkillMetadata = async () => {};

    const change = makeChange({ fileId: 'file-moved', file: { id: 'file-moved', name: 'Moved File', mimeType: 'application/vnd.google-apps.document', trashed: false, parents: ['seo-folder'], modifiedTime: '2026-01-02T00:00:00Z' } });
    await processChange(change, 'fake-token');

    // channel should be 'seo' after move
    const channelUpdated = contentCalls.some(c => c.channel === 'seo');
    assert.ok(channelUpdated, 'channel should be updated to seo after move');

    mockUpdateSkillContent = async () => {};
    mockUpdateSkillMetadata = async () => {};
  });

  // SYNC-05: Move out of all watched folders -> deleteSkill called
  it('SYNC-05: move out of all watched folders calls deleteSkill', async () => {
    mockResolveChannel = async () => null; // outside all watched folders
    const deleted: string[] = [];
    mockDeleteSkill = async (fileId) => { deleted.push(fileId); };
    mockUpdateSkillContent = async () => { throw new Error('should not call updateSkillContent'); };
    mockUpdateSkillMetadata = async () => { throw new Error('should not call updateSkillMetadata'); };

    const change = makeChange({ fileId: 'file-moved-out', file: { id: 'file-moved-out', name: 'Moved Out', mimeType: 'application/vnd.google-apps.document', trashed: false, parents: ['unknown-folder'], modifiedTime: '2026-01-01T00:00:00Z' } });
    await processChange(change, 'fake-token');

    assert.equal(deleted.length, 1);
    assert.equal(deleted[0], 'file-moved-out');

    mockDeleteSkill = async () => {};
    mockUpdateSkillContent = async () => {};
    mockUpdateSkillMetadata = async () => {};
  });

});

// --- processQueue tests ---

describe('processQueue', () => {

  it('returns { processed: 0, errors: 0 } when queue is empty', async () => {
    mockGetUnprocessedSyncQueueItems = async () => [];

    const result = await processQueue();
    assert.deepEqual(result, { processed: 0, errors: 0 });
  });

  it('groups queue items by channel_id and calls listChanges once per channel', async () => {
    const queueItems = [
      { id: 1, channel_id: 'ch-abc', resource_state: 'change', received_at: '2026-01-01T00:00:00Z', processed_at: null, error: null },
      { id: 2, channel_id: 'ch-abc', resource_state: 'change', received_at: '2026-01-01T00:01:00Z', processed_at: null, error: null },
    ];
    mockGetUnprocessedSyncQueueItems = async () => queueItems;
    mockGetDriveWatchChannel = async () => ({
      id: 1, channel_id: 'ch-abc', resource_id: 'res-1', expiration: Date.now() + 86_400_000,
      page_token: 'page-tok-1', user_id: 'user-1', created_at: '2026-01-01T00:00:00Z', renewed_at: null,
    });

    const listChangesCalls: string[] = [];
    mockListChanges = async (userId, pageToken) => {
      listChangesCalls.push(pageToken);
      return { changes: [], newPageToken: 'new-tok' };
    };

    const markedProcessed: number[] = [];
    mockMarkQueueItemProcessed = async (id) => { markedProcessed.push(id); };

    process.env.DRIVE_ADMIN_USER_ID = 'user-1';
    await processQueue();

    assert.equal(listChangesCalls.length, 1, 'listChanges should be called once for channel ch-abc');

    assert.equal(markedProcessed.length, 2, 'both queue items should be marked processed');

    // cleanup
    mockGetUnprocessedSyncQueueItems = async () => [];
    mockGetDriveWatchChannel = async () => null;
    mockListChanges = async () => ({ changes: [], newPageToken: 'tok2' });
    mockMarkQueueItemProcessed = async () => {};
  });

});
