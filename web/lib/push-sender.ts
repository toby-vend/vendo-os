import webpush from 'web-push';
import {
  getSubscriptionsByUserId,
  deleteSubscriptionByEndpoint,
} from './queries/push-subscriptions.js';
import { getUserByEmail } from './queries/auth.js';

/**
 * Initialise VAPID details once at server startup.
 * Guards against missing env vars — warns rather than crashing the server.
 */
export function initVapid(): void {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    console.warn('[push] VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY not set — push notifications disabled');
    return;
  }

  webpush.setVapidDetails('mailto:admin@vendoagency.com.au', publicKey, privateKey);
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

/**
 * Send a push notification to all registered devices for a given user.
 * Uses Promise.allSettled so one failing device does not abort others.
 * Dead subscriptions (410 / 404) are pruned automatically.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const subscriptions = await getSubscriptionsByUserId(userId);
  if (!subscriptions.length) return;

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 3600 },
        );
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Dead subscription — prune it
          await deleteSubscriptionByEndpoint(sub.endpoint);
        } else {
          console.error('[push] sendNotification failed', { endpoint: sub.endpoint, status: err.statusCode, message: err.message });
        }
      }
    }),
  );
}

/**
 * Send a push notification to a user identified by email address.
 * Required because task_runs.created_by stores email, not user_id.
 */
export async function sendPushToUserByEmail(email: string, payload: PushPayload): Promise<void> {
  const user = await getUserByEmail(email);
  if (!user) {
    console.warn('[push] sendPushToUserByEmail: user not found for email', email);
    return;
  }
  await sendPushToUser(user.id, payload);
}
