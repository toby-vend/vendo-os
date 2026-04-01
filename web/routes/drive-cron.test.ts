import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';

// --- Mocks ---
// Mocked before route import so the route picks up the stubs.

let mockGetChannelsExpiringWithin24h: () => Promise<unknown[]> = async () => [];
let mockRenewChannel: (channel: unknown) => Promise<unknown> = async () => ({
  channelId: 'new-ch',
  resourceId: 'new-res',
  expiration: Date.now() + 7 * 86_400_000,
  pageToken: 'tok',
});

mock.module('../lib/queries/drive.js', {
  namedExports: {
    getChannelsExpiringWithin24h: () => mockGetChannelsExpiringWithin24h(),
  },
});

mock.module('../lib/drive-sync.js', {
  namedExports: {
    renewChannel: (channel: unknown) => mockRenewChannel(channel),
  },
});

// Import after mocking
const { driveCronRoutes } = await import('./drive-cron.js');

describe('GET /api/cron/renew-drive-channels', () => {
  let app: ReturnType<typeof Fastify>;

  before(async () => {
    process.env.CRON_SECRET = 'test-cron-secret';
    app = Fastify({ logger: false });
    app.register(driveCronRoutes, { prefix: '/api/cron' });
    await app.ready();
  });

  after(async () => {
    await app.close();
    delete process.env.CRON_SECRET;
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/cron/renew-drive-channels',
    });
    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.equal(body.success, false);
  });

  it('returns 401 when Authorization header has wrong Bearer token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/cron/renew-drive-channels',
      headers: { Authorization: 'Bearer wrong-token' },
    });
    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.equal(body.success, false);
  });

  it('returns 401 when CRON_SECRET env var is not set (never skips auth)', async () => {
    const saved = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;

    const res = await app.inject({
      method: 'GET',
      url: '/api/cron/renew-drive-channels',
      headers: { Authorization: 'Bearer test-cron-secret' },
    });
    assert.equal(res.statusCode, 401);

    process.env.CRON_SECRET = saved;
  });

  it('returns 200 with renewed:0 when no channels are expiring', async () => {
    mockGetChannelsExpiringWithin24h = async () => [];

    const res = await app.inject({
      method: 'GET',
      url: '/api/cron/renew-drive-channels',
      headers: { Authorization: 'Bearer test-cron-secret' },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.equal(body.renewed, 0);
    assert.equal(body.failed, 0);
  });

  it('returns 200 with correct renewed count when channels are expiring', async () => {
    const fakeChannel = {
      id: 1,
      channel_id: 'ch-expiring',
      resource_id: 'res-1',
      expiration: Date.now() + 3600_000, // 1 hour from now
      page_token: 'tok',
      user_id: 'user-1',
      created_at: new Date().toISOString(),
      renewed_at: null,
    };
    mockGetChannelsExpiringWithin24h = async () => [fakeChannel];
    mockRenewChannel = async () => ({
      channelId: 'new-ch',
      resourceId: 'new-res',
      expiration: Date.now() + 7 * 86_400_000,
      pageToken: 'new-tok',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/cron/renew-drive-channels',
      headers: { Authorization: 'Bearer test-cron-secret' },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.equal(body.renewed, 1);
    assert.equal(body.failed, 0);

    // Reset
    mockGetChannelsExpiringWithin24h = async () => [];
    mockRenewChannel = async () => ({
      channelId: 'new-ch',
      resourceId: 'new-res',
      expiration: Date.now() + 7 * 86_400_000,
      pageToken: 'tok',
    });
  });

  it('continues renewing remaining channels if one renewal fails', async () => {
    const fakeChannels = [
      { id: 1, channel_id: 'ch-1', resource_id: 'res-1', expiration: Date.now() + 3600_000, page_token: 'tok', user_id: 'u1', created_at: new Date().toISOString(), renewed_at: null },
      { id: 2, channel_id: 'ch-2', resource_id: 'res-2', expiration: Date.now() + 3600_000, page_token: 'tok', user_id: 'u2', created_at: new Date().toISOString(), renewed_at: null },
      { id: 3, channel_id: 'ch-3', resource_id: 'res-3', expiration: Date.now() + 3600_000, page_token: 'tok', user_id: 'u3', created_at: new Date().toISOString(), renewed_at: null },
    ];
    mockGetChannelsExpiringWithin24h = async () => fakeChannels;

    let callCount = 0;
    mockRenewChannel = async (channel: unknown) => {
      callCount++;
      const ch = channel as { channel_id: string };
      // Fail the second channel
      if (ch.channel_id === 'ch-2') throw new Error('Renewal failed for ch-2');
      return { channelId: 'new-ch', resourceId: 'new-res', expiration: Date.now() + 7 * 86_400_000, pageToken: 'tok' };
    };

    const res = await app.inject({
      method: 'GET',
      url: '/api/cron/renew-drive-channels',
      headers: { Authorization: 'Bearer test-cron-secret' },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.equal(body.renewed, 2, 'should renew 2 successfully');
    assert.equal(body.failed, 1, 'should count 1 failure');
    assert.equal(callCount, 3, 'should attempt all 3 channels');

    // Reset
    mockGetChannelsExpiringWithin24h = async () => [];
    mockRenewChannel = async () => ({
      channelId: 'new-ch',
      resourceId: 'new-res',
      expiration: Date.now() + 7 * 86_400_000,
      pageToken: 'tok',
    });
  });
});
