import type { FastifyPluginAsync } from 'fastify';
import {
  upsertPushSubscription,
  deleteSubscriptionByEndpoint,
  countSubscriptionsByUserId,
} from '../lib/queries/push-subscriptions.js';
import { sendPushToUser } from '../lib/push-sender.js';

export const pushRoutes: FastifyPluginAsync = async (app) => {
  // POST /subscribe — register a push subscription for the authenticated user
  app.post('/subscribe', async (request, reply) => {
    const user = (request as any).user;
    if (!user) {
      return reply.code(401).send({ error: 'Unauthorised' });
    }

    const body = request.body as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | null ?? {};
    const { endpoint, keys } = body as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return reply.code(400).send({ error: 'invalid_input', detail: 'endpoint, keys.p256dh, and keys.auth are required' });
    }

    await upsertPushSubscription({ userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth });
    return reply.code(201).send({ ok: true });
  });

  // DELETE /subscribe — remove a push subscription
  app.delete('/subscribe', async (request, reply) => {
    const user = (request as any).user;
    if (!user) {
      return reply.code(401).send({ error: 'Unauthorised' });
    }

    const body = request.body as { endpoint?: string } | null ?? {};
    const { endpoint } = body as { endpoint?: string };

    if (!endpoint) {
      return reply.code(400).send({ error: 'invalid_input', detail: 'endpoint is required' });
    }

    await deleteSubscriptionByEndpoint(endpoint);
    return reply.code(200).send({ ok: true });
  });

  // POST /test — send a test push notification to the authenticated user
  app.post('/test', async (request, reply) => {
    const user = (request as any).user;
    if (!user) {
      return reply.code(401).send({ error: 'Unauthorised' });
    }

    await sendPushToUser(user.id, {
      title: 'VendoOS',
      body: 'Test notification',
      url: '/settings',
    });

    return reply.code(200).send({ ok: true });
  });

  // GET /vapid-public-key — expose the VAPID public key to clients
  app.get('/vapid-public-key', async (_request, reply) => {
    return reply.code(200).send({ key: process.env.VAPID_PUBLIC_KEY || '' });
  });

  // GET /subscription-count — how many devices the authenticated user has registered
  app.get('/subscription-count', async (request, reply) => {
    const user = (request as any).user;
    if (!user) {
      return reply.code(401).send({ error: 'Unauthorised' });
    }

    const count = await countSubscriptionsByUserId(user.id);
    return reply.code(200).send({ count });
  });
};
