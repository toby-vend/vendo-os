import { db } from '../queries/base.js';
import type { ActionItem } from '../jobs/sync-actions-to-asana.js';

/**
 * Slack side-effects for DIRECTOR and FAIL-SAFE meeting classifications.
 *
 *   - DIRECTOR: post one message per action item to
 *     SLACK_WEBHOOK_DIRECTOR_MEETINGS. Each message has an "➕ Add to my
 *     Asana" button; the click flow is handled by /api/slack/interact
 *     (Phase 3).
 *   - FAIL-SAFE: DM Toby via SLACK_WEBHOOK_TOBY_DM with meeting title +
 *     Fathom URL + the reason the classifier fell back.
 *
 * Uses incoming webhooks for posting (no bot token required at this layer).
 * Fails open — a missing env var just skips the post with a warning, never
 * an error back to the webhook.
 */

let _actionsSchemaReady = false;

async function ensureActionsSchema(): Promise<void> {
  if (_actionsSchemaReady) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS director_slack_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_name TEXT NOT NULL,
      source_meeting_id TEXT NOT NULL,
      meeting_title TEXT,
      fathom_url TEXT,
      posted_at TEXT NOT NULL
    )
  `);
  await db.execute(
    'CREATE INDEX IF NOT EXISTS idx_dsa_posted ON director_slack_actions(posted_at)',
  );
  _actionsSchemaReady = true;
}

export interface DirectorActionRow {
  id: number;
  task_name: string;
  source_meeting_id: string;
  meeting_title: string | null;
  fathom_url: string | null;
  posted_at: string;
}

export async function getDirectorSlackAction(id: number): Promise<DirectorActionRow | null> {
  try {
    await ensureActionsSchema();
    const r = await db.execute({
      sql: 'SELECT id, task_name, source_meeting_id, meeting_title, fathom_url, posted_at FROM director_slack_actions WHERE id = ? LIMIT 1',
      args: [id],
    });
    return (r.rows[0] as unknown as DirectorActionRow) ?? null;
  } catch {
    return null;
  }
}

async function slackPost(webhookUrl: string, payload: unknown): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Post each action item to #claude-director-meetings as its own message
 * with an "Add to my Asana" button. Returns the number of messages posted.
 */
export async function postDirectorActionItems(input: {
  meetingId: string;
  meetingTitle: string;
  meetingUrl: string | null;
  actionItems: ActionItem[];
}): Promise<{ posted: number }> {
  const webhookUrl = process.env.SLACK_WEBHOOK_DIRECTOR_MEETINGS;
  if (!webhookUrl) return { posted: 0 };
  await ensureActionsSchema();

  let posted = 0;
  for (const item of input.actionItems) {
    const description = (item.description || '').trim();
    if (description.length < 5) continue;

    const fathomUrl = item.playbackUrl || input.meetingUrl || null;
    const r = await db.execute({
      sql: `INSERT INTO director_slack_actions
              (task_name, source_meeting_id, meeting_title, fathom_url, posted_at)
            VALUES (?, ?, ?, ?, ?)`,
      args: [description, input.meetingId, input.meetingTitle, fathomUrl, new Date().toISOString()],
    });
    const actionId = Number(r.lastInsertRowid);

    const blocks: unknown[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Action item — ${input.meetingTitle}*\n${description}`,
        },
      },
    ];
    if (fathomUrl) {
      blocks.push({
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `<${fathomUrl}|Open the moment in Fathom>` }],
      });
    }
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '➕ Add to my Asana' },
          value: `action:${actionId}`,
          action_id: 'add_to_asana',
        },
      ],
    });

    const ok = await slackPost(webhookUrl, { blocks, text: `Action: ${description}` });
    if (ok) posted++;
  }
  return { posted };
}

/** Post a fail-safe DM to Toby. Bare text payload — short and actionable. */
export async function dmTobyFailsafe(input: {
  meetingTitle: string;
  meetingUrl: string | null;
  reason: string;
}): Promise<boolean> {
  const webhookUrl = process.env.SLACK_WEBHOOK_TOBY_DM;
  if (!webhookUrl) return false;
  const lines = [
    ':warning: *Fail-safe: meeting needs manual review*',
    `*Title:* ${input.meetingTitle || '(untitled)'}`,
    `*Reason:* ${input.reason}`,
  ];
  if (input.meetingUrl) lines.push(`*Fathom:* ${input.meetingUrl}`);
  return slackPost(webhookUrl, { text: lines.join('\n') });
}
