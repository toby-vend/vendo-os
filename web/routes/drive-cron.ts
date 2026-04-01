import type { FastifyPluginAsync } from 'fastify';
import { getChannelsExpiringWithin24h } from '../lib/queries/drive.js';
import { renewChannel } from '../lib/drive-sync.js';

export const driveCronRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /renew-drive-channels
   * Vercel Cron route — renews all Drive webhook channels expiring within 24 hours.
   * Authenticated via Authorization: Bearer <CRON_SECRET> header.
   * Must NOT be behind session middleware — Vercel Cron sends no cookies.
   */
  app.get('/renew-drive-channels', async (request, reply) => {
    // Auth: CRON_SECRET must be set and must match the Authorization header.
    // If CRON_SECRET is unset, always reject — never skip auth.
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return reply.code(401).send({ success: false, error: 'Unauthorized' });
    }

    const authHeader = request.headers['authorization'];
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return reply.code(401).send({ success: false, error: 'Unauthorized' });
    }

    const channels = await getChannelsExpiringWithin24h();

    if (channels.length === 0) {
      return reply.code(200).send({
        success: true,
        renewed: 0,
        failed: 0,
        message: 'No channels expiring within 24h',
      });
    }

    let renewed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const channel of channels) {
      try {
        await renewChannel(channel);
        renewed++;
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Channel ${channel.channel_id}: ${msg}`);
        app.log.error({ channelId: channel.channel_id, err }, 'Failed to renew Drive watch channel');
      }
    }

    return reply.code(200).send({ success: true, renewed, failed, errors });
  });
};
