/**
 * Video Production notification helpers.
 * Creates in-app notifications and optionally sends Slack/email alerts.
 * All external sends are fire-and-forget — failures never block the caller.
 */

import { db } from './queries/base.js';

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || '';
const SLACK_CHANNEL = process.env.SLACK_VIDEO_CHANNEL || process.env.SLACK_GENERAL_CHANNEL || '';
const MAKE_WEBHOOK_URL = process.env.MAKE_VIDEO_WEBHOOK_URL || '';
const APP_URL = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

// ── In-app notifications ────────────────────────────────────────

export async function createNotification(data: {
  userId?: string | number | null;
  type: string;
  title: string;
  body?: string;
  link?: string;
}): Promise<void> {
  try {
    await db.execute({
      sql: `INSERT INTO notifications (user_id, type, title, body, link, read, created_at)
            VALUES (?, ?, ?, ?, ?, 0, ?)`,
      args: [
        data.userId ?? null,
        data.type,
        data.title,
        data.body || null,
        data.link || null,
        new Date().toISOString(),
      ],
    });
  } catch (err) {
    console.error('[video-notify] Failed to create notification:', err);
  }
}

export async function getUnreadNotifications(userId: string, limit = 20): Promise<{
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
}[]> {
  const result = await db.execute({
    sql: 'SELECT id, type, title, body, link, created_at FROM notifications WHERE (user_id = ? OR user_id IS NULL) AND read = 0 ORDER BY created_at DESC LIMIT ?',
    args: [userId, limit],
  });
  return result.rows as any[];
}

export async function getUnreadCount(userId: string): Promise<number> {
  const result = await db.execute({
    sql: 'SELECT COUNT(*) as count FROM notifications WHERE (user_id = ? OR user_id IS NULL) AND read = 0',
    args: [userId],
  });
  return (result.rows[0] as any)?.count ?? 0;
}

export async function markNotificationRead(id: number): Promise<void> {
  await db.execute({ sql: 'UPDATE notifications SET read = 1 WHERE id = ?', args: [id] });
}

export async function markAllRead(userId: string): Promise<void> {
  await db.execute({
    sql: 'UPDATE notifications SET read = 1 WHERE (user_id = ? OR user_id IS NULL) AND read = 0',
    args: [userId],
  });
}

// ── Slack channel message (fire-and-forget) ─────────────────────

async function sendSlackMessage(text: string): Promise<void> {
  if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL) return;
  try {
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel: SLACK_CHANNEL, text }),
    });
  } catch (err) {
    console.error('[video-notify] Slack error:', err);
  }
}

// ── Make.com webhook (fire-and-forget) ──────────────────────────

async function fireWebhook(payload: Record<string, unknown>): Promise<void> {
  if (!MAKE_WEBHOOK_URL) return;
  try {
    await fetch(MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('[video-notify] Webhook error:', err);
  }
}

// ── Video event dispatcher ──────────────────────────────────────

interface VideoEventContext {
  projectId: number;
  projectTitle: string;
  clientName: string;
  userId?: string | null;
  userName?: string | null;
  editorId?: string | null;
  editorName?: string | null;
  oldStatus?: string;
  newStatus?: string;
  extra?: Record<string, unknown>;
}

export function notifyVideoEvent(event: string, ctx: VideoEventContext): void {
  // Fire everything async — don't await
  const link = `/video-production/${ctx.projectId}`;
  const portalLink = `/portal/video-production/${ctx.projectId}`;
  const ts = new Date().toISOString();

  // Always fire webhook for column moves
  if (event === 'status_change' || ctx.oldStatus) {
    fireWebhook({
      event: 'video_status_change',
      project_id: ctx.projectId,
      project_title: ctx.projectTitle,
      client_name: ctx.clientName,
      old_status: ctx.oldStatus,
      new_status: ctx.newStatus,
      user: ctx.userName,
      timestamp: ts,
      ...ctx.extra,
    });
  }

  switch (event) {
    case 'project_created':
      createNotification({
        type: 'video',
        title: `New shoot booked: ${ctx.clientName}`,
        body: ctx.projectTitle,
        link,
      });
      sendSlackMessage(`📹 *New shoot booked:* ${ctx.clientName} — ${ctx.projectTitle}`);
      break;

    case 'shoot_plan_submitted':
      // Notify client (null userId = broadcast, client will see in portal)
      createNotification({
        type: 'video_client',
        title: `Shoot plan ready for review`,
        body: `${ctx.clientName} — ${ctx.projectTitle}`,
        link: portalLink,
      });
      sendSlackMessage(`📋 *Shoot plan submitted for review:* ${ctx.clientName} — ${ctx.projectTitle}`);
      break;

    case 'shoot_plan_approved':
      createNotification({
        type: 'video',
        title: `Shoot plan approved: ${ctx.clientName}`,
        body: ctx.projectTitle,
        link,
      });
      sendSlackMessage(`✅ *Shoot plan approved:* ${ctx.clientName} — ${ctx.projectTitle}`);
      break;

    case 'shoot_plan_changes_requested':
      createNotification({
        type: 'video',
        title: `Client requested plan changes: ${ctx.clientName}`,
        body: ctx.projectTitle,
        link: `${link}/shoot-plan`,
      });
      sendSlackMessage(`🔄 *Plan changes requested:* ${ctx.clientName} — ${ctx.projectTitle}`);
      break;

    case 'content_day_completed':
      createNotification({
        type: 'video',
        title: `Content day complete: ${ctx.clientName}`,
        body: ctx.projectTitle,
        link,
      });
      break;

    case 'raw_files_shared':
      createNotification({
        type: 'video_client',
        title: `Raw files ready for review`,
        body: `${ctx.clientName} — ${ctx.projectTitle}`,
        link: portalLink,
      });
      sendSlackMessage(`📁 *Raw files shared with client:* ${ctx.clientName} — ${ctx.projectTitle}`);
      break;

    case 'raw_files_confirmed':
      createNotification({
        type: 'video',
        title: `Client confirmed raw files: ${ctx.clientName}`,
        body: `${ctx.projectTitle} — ready for editing`,
        link,
      });
      sendSlackMessage(`✅ *Raw files confirmed:* ${ctx.clientName} — ${ctx.projectTitle} → In Editing`);
      break;

    case 'qa_pass':
      createNotification({
        type: 'video_client',
        title: `Edit ready for your review`,
        body: `${ctx.clientName} — ${ctx.projectTitle}`,
        link: portalLink,
      });
      sendSlackMessage(`✅ *QA passed:* ${ctx.clientName} — ${ctx.projectTitle} → Client Review`);
      break;

    case 'qa_fail':
      if (ctx.editorId) {
        createNotification({
          userId: ctx.editorId,
          type: 'video',
          title: `QA failed — revisions needed`,
          body: `${ctx.clientName} — ${ctx.projectTitle}`,
          link,
        });
      }
      sendSlackMessage(`❌ *QA failed:* ${ctx.clientName} — ${ctx.projectTitle} → Revisions (${ctx.editorName || 'unassigned'})`);
      break;

    case 'editor_resubmitted':
      createNotification({
        type: 'video',
        title: `Edit re-submitted for QA`,
        body: `${ctx.clientName} — ${ctx.projectTitle}`,
        link,
      });
      break;

    case 'client_approved':
      createNotification({
        type: 'video',
        title: `Client approved edit: ${ctx.clientName}`,
        body: `${ctx.projectTitle} → Live`,
        link,
      });
      sendSlackMessage(`🎉 *Client approved:* ${ctx.clientName} — ${ctx.projectTitle} → Live!`);
      break;

    case 'client_changes_requested':
      if (ctx.editorId) {
        createNotification({
          userId: ctx.editorId,
          type: 'video',
          title: `Client requested changes`,
          body: `${ctx.clientName} — ${ctx.projectTitle}`,
          link,
        });
      }
      sendSlackMessage(`🔄 *Client changes requested:* ${ctx.clientName} — ${ctx.projectTitle} → Revisions`);
      break;

    case 'escalation_r3':
      sendSlackMessage(`⚠️ *Escalation:* ${ctx.clientName} — ${ctx.projectTitle} is on revision round R3+. Review scope.`);
      break;
  }
}
