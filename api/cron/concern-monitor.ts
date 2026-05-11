/**
 * /api/cron/concern-monitor — Atlas-driven response to fresh concerns.
 *
 * Runs hourly during the work day (`0 9-18 * * 1-5`). Polls
 * meeting_concerns for high or critical severity rows that haven't
 * yet been processed by atlas-monitor, then for each one runs the
 * atlas-monitor agent. The agent typically drafts an Asana task or
 * Slack DM as a follow-up, which lands as an approval card in the
 * recipient's Slack DM via the auto-persist + Block Kit wiring from
 * Block 8.
 *
 * "Already processed" is tracked in the existing monitor_alerts
 * table — we insert a row tagged with monitor='atlas-concern-monitor'
 * the moment we pick up a concern, so a re-fire of the cron in the
 * same minute won't double-process. Insert is idempotent thanks to
 * the entity check.
 *
 * Auth: Bearer CRON_SECRET (same pattern as atlas-brief).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../web/lib/queries/base.js';
import {
  getUserByEmail,
  userRowToSessionUser,
} from '../../web/lib/queries/auth.js';
import { atlasMonitorAgent } from '../../web/lib/agents/agents/index.js';
import { runAgentBackground } from '../../web/lib/agents/runtime.js';
import type { ToolCtx, ChannelName } from '../../web/lib/agents/types.js';
import { recordHeartbeat } from '../../web/lib/jobs/heartbeat.js';

export const config = {
  runtime: 'nodejs',
  maxDuration: 300,
};

/** Recipient that receives concern follow-up cards. Defaults to Toby. */
const RECIPIENT_EMAIL =
  process.env.CONCERN_MONITOR_RECIPIENT_EMAIL || 'toby@vendodigital.co.uk';

/** Cap on concerns processed per run, to keep cost bounded. */
const PER_RUN_LIMIT = 5;

/** Atlas-monitor only fires for these severity levels. */
const SEVERITY_FILTER = ['high', 'critical'];

interface PendingConcern {
  id: number;
  meeting_id: string;
  severity: string;
  category: string | null;
  ai_summary: string | null;
  excerpts: string | null;
  created_at: string;
  meeting_title: string | null;
  meeting_url: string | null;
  client_name: string | null;
  meeting_date: string | null;
}

interface ProcessResult {
  concernId: number;
  meetingId: string;
  severity: string;
  client: string | null;
  ok: boolean;
  runId?: string;
  error?: string;
  textPreview?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    res.status(503).end('CRON_SECRET not set');
    return;
  }
  const auth = String(req.headers['authorization'] || '');
  if (auth !== `Bearer ${cronSecret}`) {
    res.status(401).end('unauthorized');
    return;
  }

  // Resolve the recipient. Bail loudly if they're not a Vendo user —
  // the agent needs a SessionUser to attribute the recommendation to.
  const recipientRow = await getUserByEmail(RECIPIENT_EMAIL);
  if (!recipientRow) {
    res.status(503).json({
      ok: false,
      error: `recipient ${RECIPIENT_EMAIL} not found in users table`,
    });
    return;
  }
  const recipient = userRowToSessionUser(recipientRow);

  // Pull unprocessed concerns. Left-join to monitor_alerts to filter
  // out anything atlas-monitor has already picked up.
  const placeholders = SEVERITY_FILTER.map(() => '?').join(',');
  const r = await db.execute({
    sql: `
      SELECT mc.id, mc.meeting_id, mc.severity, mc.category, mc.ai_summary,
             mc.excerpts, mc.created_at,
             m.title as meeting_title, m.url as meeting_url,
             m.client_name, m.date as meeting_date
        FROM meeting_concerns mc
        JOIN meetings m ON mc.meeting_id = m.id
        LEFT JOIN monitor_alerts ma
               ON ma.entity = mc.meeting_id
              AND ma.monitor = 'atlas-concern-monitor'
       WHERE mc.concern_detected = 1
         AND mc.severity IN (${placeholders})
         AND ma.id IS NULL
         AND mc.created_at >= datetime('now', '-7 days')
       ORDER BY mc.created_at DESC
       LIMIT ?`,
    args: [...SEVERITY_FILTER, PER_RUN_LIMIT],
  });
  const pending = r.rows as unknown as PendingConcern[];

  if (pending.length === 0) {
    res.status(200).json({ ok: true, message: 'No new concerns.', processed: 0 });
    return;
  }

  // Process each concern. Insert the dedup row FIRST so even if the
  // agent run errors, we don't keep re-trying the same concern.
  const results: ProcessResult[] = [];
  for (const concern of pending) {
    try {
      await db.execute({
        sql: `INSERT INTO monitor_alerts (monitor, entity, alert_type, message, created_at)
              VALUES ('atlas-concern-monitor', ?, ?, ?, datetime('now'))`,
        args: [concern.meeting_id, concern.severity, concern.ai_summary ?? ''],
      });
    } catch (err) {
      // If the dedup insert itself fails, skip without processing.
      results.push({
        concernId: concern.id,
        meetingId: concern.meeting_id,
        severity: concern.severity,
        client: concern.client_name,
        ok: false,
        error: 'dedup-insert-failed: ' + (err instanceof Error ? err.message : String(err)),
      });
      continue;
    }

    try {
      const result = await runConcernResponse(concern, recipient);
      results.push(result);
    } catch (err) {
      results.push({
        concernId: concern.id,
        meetingId: concern.meeting_id,
        severity: concern.severity,
        client: concern.client_name,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const ok = results.every((r) => r.ok);
  await recordHeartbeat(
    'concern-monitor',
    ok,
    0, // unknown duration; this handler doesn't track t0. Heartbeat still useful.
    ok ? undefined : results.find((r) => !r.ok)?.error,
  );
  res.status(ok ? 200 : 207).json({ ok, processed: results.length, results });
}

async function runConcernResponse(
  concern: PendingConcern,
  recipient: ReturnType<typeof userRowToSessionUser>,
): Promise<ProcessResult> {
  const ctx: ToolCtx = {
    runId: '',
    agent: atlasMonitorAgent.name,
    user: recipient,
    channel: 'slack' as ChannelName, // approval cards land via Slack
    conversationId: `atlas-monitor:${concern.meeting_id}`,
    graduations: new Set(),
  };

  const excerpt = readFirstExcerpt(concern.excerpts);
  const prompt = [
    'A new high-severity concern has been flagged. Please respond.',
    '',
    `**Concern id:** ${concern.id}`,
    `**Meeting id:** ${concern.meeting_id}`,
    `**Meeting:** ${concern.meeting_title ?? '(untitled)'}`,
    `**Client:** ${concern.client_name ?? '(unknown)'}`,
    `**Date:** ${concern.meeting_date ?? '(unknown)'}`,
    `**Severity:** ${concern.severity}`,
    `**Category:** ${concern.category ?? '(uncategorised)'}`,
    `**Meeting URL:** ${concern.meeting_url ?? '(no url)'}`,
    '',
    '**Summary:**',
    concern.ai_summary ?? '(no summary)',
    '',
    excerpt ? '**Excerpt from the call:**\n' + excerpt : '',
    '',
    'Investigate briefly and decide whether to draft a follow-up.',
  ].filter(Boolean).join('\n');

  const result = await runAgentBackground({
    agent: atlasMonitorAgent,
    ctx,
    prompt,
    trigger: 'cron:concern-monitor',
    conversationId: ctx.conversationId,
  });

  if (result.status !== 'completed') {
    return {
      concernId: concern.id,
      meetingId: concern.meeting_id,
      severity: concern.severity,
      client: concern.client_name,
      ok: false,
      runId: result.runId,
      error: result.error ?? 'agent did not complete',
    };
  }

  return {
    concernId: concern.id,
    meetingId: concern.meeting_id,
    severity: concern.severity,
    client: concern.client_name,
    ok: true,
    runId: result.runId,
    textPreview: result.text?.slice(0, 200) ?? '',
  };
}

function readFirstExcerpt(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.length > 0) return String(parsed[0]).slice(0, 400);
    if (typeof parsed === 'string') return parsed.slice(0, 400);
  } catch {
    /* fall through */
  }
  return raw.slice(0, 400);
}
