/**
 * Slack notifications for Frame.io events.
 *
 * Phase 3 alerts on:
 *   - external user comment.created   (client wants a response)
 *   - external user comment.completed (client signed off / approved)
 *
 * Posts via incoming webhook (FRAMEIO_SLACK_WEBHOOK_URL) so no bot-token
 * scopes need negotiating. Fails open — a missing env var or 4xx from
 * Slack is logged but never throws back into the processor (we still
 * want the row marked processed).
 *
 * Message format uses Slack Block Kit so the alert reads cleanly and
 * carries a deep link straight into the Frame.io comment.
 */

import type { FrameioFile } from './client.js';
import type { ResolvedUser } from './users.js';

const WEBHOOK_ENV = 'FRAMEIO_SLACK_WEBHOOK_URL';

interface CommentAlertInput {
  kind: 'comment.created' | 'comment.completed';
  clientName: string;
  projectName: string | null;
  projectViewUrl: string | null;
  commentText: string;
  commentTimestampSeconds: number | null;
  commentCreatedAt: string;
  file: Pick<FrameioFile, 'id' | 'name' | 'view_url'> | null;
  author: ResolvedUser;
}

function formatVideoTimestamp(seconds: number | null): string | null {
  if (seconds == null || seconds === 0) return null;
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

export async function postCommentAlert(input: CommentAlertInput): Promise<{ posted: boolean; reason?: string }> {
  const webhook = process.env[WEBHOOK_ENV];
  if (!webhook) return { posted: false, reason: `${WEBHOOK_ENV} not configured` };

  const verb = input.kind === 'comment.completed' ? 'resolved a comment' : 'commented';
  const authorLabel = input.author.name
    ? `${input.author.name}${input.author.email ? ` (${input.author.email})` : ''}`
    : (input.author.email ?? 'unknown reviewer');
  const fileName = input.file?.name ?? '(file)';
  const ts = formatVideoTimestamp(input.commentTimestampSeconds);

  const headlineEmoji = input.kind === 'comment.completed' ? '✅' : '💬';
  const headline = `${headlineEmoji} *${authorLabel}* ${verb} on *${input.clientName}*`;

  // Deep-link priority: file view_url → project view_url → none
  const link = input.file?.view_url ?? input.projectViewUrl;

  const contextLines: string[] = [];
  contextLines.push(`📁 ${fileName}${ts ? `  ·  🎬 ${ts}` : ''}`);
  if (input.projectName) contextLines.push(`📂 ${input.projectName}`);

  const blocks: Array<Record<string, unknown>> = [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: headline },
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: contextLines.join('\n') }],
    },
  ];

  if (input.commentText && input.kind === 'comment.created') {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `>${truncate(input.commentText, 800).replace(/\n/g, '\n>')}` },
    });
  }

  if (link) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Open in Frame.io' },
          url: link,
          style: 'primary',
        },
      ],
    });
  }

  // Plain-text fallback for notification previews
  const fallback = `${authorLabel} ${verb} on ${input.clientName} — ${fileName}${ts ? ` @ ${ts}` : ''}: ${truncate(input.commentText || '', 200)}`;

  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: fallback, blocks }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[frameio/slack] webhook ${res.status}: ${body.slice(0, 200)}`);
      return { posted: false, reason: `slack_${res.status}` };
    }
    return { posted: true };
  } catch (err) {
    console.error('[frameio/slack] post failed:', err);
    return { posted: false, reason: (err as Error).message };
  }
}
