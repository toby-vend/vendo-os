import type { FastifyPluginAsync } from 'fastify';
import { getDriveWatchChannel, insertDriveSyncQueueItem } from '../lib/queries/drive.js';

export const driveWebhookRoutes: FastifyPluginAsync = async (app) => {
  app.post('/webhook', async (request, reply) => {
    const channelId = request.headers['x-goog-channel-id'] as string | undefined;
    const resourceState = request.headers['x-goog-resource-state'] as string | undefined;
    const channelToken = request.headers['x-goog-channel-token'] as string | undefined;

    // Validate token against DRIVE_WEBHOOK_SECRET
    const secret = process.env.DRIVE_WEBHOOK_SECRET;
    if (!secret || channelToken !== secret) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    // Acknowledge initial sync notification — do not write a queue row
    if (resourceState === 'sync') {
      return reply.code(200).send();
    }

    // Look up the channel — reject unknown channels
    if (!channelId) {
      return reply.code(404).send({ error: 'Channel not found' });
    }

    const channel = await getDriveWatchChannel(channelId);
    if (!channel) {
      return reply.code(404).send({ error: 'Channel not found' });
    }

    // Enqueue the change notification
    await insertDriveSyncQueueItem({ channelId, resourceState: resourceState ?? 'change' });

    return reply.code(200).send();
  });
};
