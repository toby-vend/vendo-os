import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';

// --- Mocks ---
// We mock the query functions before importing the route so the route module
// picks up the stubbed versions via module-level references.

let mockGetDriveWatchChannel: (channelId: string) => Promise<unknown> = async () => null;
let mockInsertDriveSyncQueueItem: (data: { channelId: string; resourceState: string }) => Promise<void> = async () => {};

mock.module('../lib/queries/drive.js', {
  namedExports: {
    getDriveWatchChannel: (channelId: string) => mockGetDriveWatchChannel(channelId),
    insertDriveSyncQueueItem: (data: { channelId: string; resourceState: string }) => mockInsertDriveSyncQueueItem(data),
  },
});

// Import the route after mocking
const { driveWebhookRoutes } = await import('./drive-webhook.js');

describe('POST /api/drive/webhook', () => {
  let app: ReturnType<typeof Fastify>;

  before(async () => {
    process.env.DRIVE_WEBHOOK_SECRET = 'test-secret';
    app = Fastify({ logger: false });
    app.register(driveWebhookRoutes, { prefix: '/api/drive' });
    await app.ready();
  });

  after(async () => {
    await app.close();
    delete process.env.DRIVE_WEBHOOK_SECRET;
  });

  it('returns 403 when x-goog-channel-token is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/drive/webhook',
      headers: {
        'x-goog-channel-id': 'ch-1',
        'x-goog-resource-state': 'change',
        'x-goog-resource-id': 'res-1',
        // token header deliberately omitted
      },
    });
    assert.equal(res.statusCode, 403);
  });

  it('returns 403 when x-goog-channel-token is wrong', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/drive/webhook',
      headers: {
        'x-goog-channel-id': 'ch-1',
        'x-goog-resource-state': 'change',
        'x-goog-channel-token': 'wrong-secret',
        'x-goog-resource-id': 'res-1',
      },
    });
    assert.equal(res.statusCode, 403);
  });

  it('returns 200 for resource-state "sync" without writing a queue row', async () => {
    let queueRowWritten = false;
    mockInsertDriveSyncQueueItem = async () => { queueRowWritten = true; };

    const res = await app.inject({
      method: 'POST',
      url: '/api/drive/webhook',
      headers: {
        'x-goog-channel-id': 'ch-1',
        'x-goog-resource-state': 'sync',
        'x-goog-channel-token': 'test-secret',
        'x-goog-resource-id': 'res-1',
      },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(queueRowWritten, false, 'queue row should not be written for sync notification');

    // Reset mock
    mockInsertDriveSyncQueueItem = async () => {};
  });

  it('returns 404 when channel ID is not found in drive_watch_channels', async () => {
    mockGetDriveWatchChannel = async () => null;

    const res = await app.inject({
      method: 'POST',
      url: '/api/drive/webhook',
      headers: {
        'x-goog-channel-id': 'unknown-channel',
        'x-goog-resource-state': 'change',
        'x-goog-channel-token': 'test-secret',
        'x-goog-resource-id': 'res-1',
      },
    });
    assert.equal(res.statusCode, 404);
  });

  it('returns 200 and writes a queue row for a valid change notification', async () => {
    mockGetDriveWatchChannel = async () => ({
      id: 1,
      channel_id: 'known-channel',
      resource_id: 'res-1',
      expiration: Date.now() + 86_400_000,
      page_token: 'tok',
      user_id: null,
      created_at: new Date().toISOString(),
      renewed_at: null,
    });

    const writtenItems: Array<{ channelId: string; resourceState: string }> = [];
    mockInsertDriveSyncQueueItem = async (data) => { writtenItems.push(data); };

    const res = await app.inject({
      method: 'POST',
      url: '/api/drive/webhook',
      headers: {
        'x-goog-channel-id': 'known-channel',
        'x-goog-resource-state': 'change',
        'x-goog-channel-token': 'test-secret',
        'x-goog-resource-id': 'res-1',
      },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(writtenItems.length, 1, 'queue row should be written');
    assert.equal(writtenItems[0].channelId, 'known-channel');
    assert.equal(writtenItems[0].resourceState, 'change');

    // Reset mocks
    mockGetDriveWatchChannel = async () => null;
    mockInsertDriveSyncQueueItem = async () => {};
  });
});
