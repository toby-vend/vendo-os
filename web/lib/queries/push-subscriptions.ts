import { db, rows, scalar } from './base.js';

export interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Insert or replace a push subscription keyed on the UNIQUE endpoint constraint.
 * One row per device — multiple rows per user are permitted.
 */
export async function upsertPushSubscription(data: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(endpoint) DO UPDATE SET
            user_id = excluded.user_id,
            p256dh = excluded.p256dh,
            auth = excluded.auth,
            created_at = excluded.created_at`,
    args: [data.userId, data.endpoint, data.p256dh, data.auth, now],
  });
}

/**
 * Delete a push subscription by its endpoint (called on unsubscribe or 410/404 response).
 */
export async function deleteSubscriptionByEndpoint(endpoint: string): Promise<void> {
  await db.execute({
    sql: 'DELETE FROM push_subscriptions WHERE endpoint = ?',
    args: [endpoint],
  });
}

/**
 * Get all push subscriptions for a given user (one per registered device).
 */
export async function getSubscriptionsByUserId(userId: string): Promise<PushSubscriptionRow[]> {
  return rows<PushSubscriptionRow>(
    'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?',
    [userId],
  );
}

/**
 * Count how many push subscriptions a user has (i.e. how many devices are registered).
 */
export async function countSubscriptionsByUserId(userId: string): Promise<number> {
  const count = await scalar('SELECT COUNT(*) FROM push_subscriptions WHERE user_id = ?', [userId]);
  return (count as number) ?? 0;
}
