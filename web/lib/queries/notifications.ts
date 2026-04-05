import { rows, scalar, db } from './base.js';

export interface NotificationRow {
  id: number;
  user_id: number | null;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: number;
  created_at: string;
}

export async function getNotifications(userId: number, limit = 20): Promise<NotificationRow[]> {
  return rows<NotificationRow>(`
    SELECT id, user_id, type, title, body, link, read, created_at
    FROM notifications
    WHERE user_id IS NULL OR user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `, [userId, limit]);
}

export async function getUnreadCount(userId: number): Promise<number> {
  const count = await scalar<number>(`
    SELECT COUNT(*) FROM notifications
    WHERE (user_id IS NULL OR user_id = ?) AND read = 0
  `, [userId]);
  return count ?? 0;
}

export async function markRead(notificationId: number): Promise<void> {
  await db.execute({
    sql: 'UPDATE notifications SET read = 1 WHERE id = ?',
    args: [notificationId],
  });
}

export async function markAllRead(userId: number): Promise<void> {
  await db.execute({
    sql: 'UPDATE notifications SET read = 1 WHERE (user_id IS NULL OR user_id = ?) AND read = 0',
    args: [userId],
  });
}

export async function createNotification(notification: {
  user_id?: number | null;
  type: string;
  title: string;
  body?: string;
  link?: string;
}): Promise<void> {
  await db.execute({
    sql: `INSERT INTO notifications (user_id, type, title, body, link, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      notification.user_id ?? null,
      notification.type,
      notification.title,
      notification.body || null,
      notification.link || null,
      new Date().toISOString(),
    ],
  });
}
