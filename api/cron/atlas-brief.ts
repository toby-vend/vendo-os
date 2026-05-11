/**
 * /api/cron/atlas-brief — daily personal brief for each admin user.
 *
 * Triggered by Vercel cron at 7am UK time, Mon-Fri (`0 7 * * 1-5` —
 * 7am UTC = 8am BST in summer, 7am GMT in winter; 30 minutes before
 * the existing channel-wide static brief at 7:30 UTC so the personal
 * digest lands first).
 *
 * For every admin user we run the `atlas-brief` agent and DM them the
 * resulting markdown. The agent uses its read tools to inspect the
 * day's signals (yesterday's meetings, open Asana tasks, flagged
 * concerns, campaign anomalies) and produces a concise per-person
 * digest. Brief is saved to agent_runs / agent_messages so we can
 * audit what was sent.
 *
 * Auth: Vercel cron sends a Bearer token in the Authorization header
 * matching CRON_SECRET. Other invocations are 401'd.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../web/lib/queries/base.js';
import { userRowToSessionUser, type UserRow } from '../../web/lib/queries/auth.js';
import { atlasBriefAgent } from '../../web/lib/agents/agents/index.js';
import { runAgentBackground } from '../../web/lib/agents/runtime.js';
import { postSlackMessage, slackChannel } from '../../web/lib/agents/channels/slack.js';
import type { ToolCtx, ChannelName } from '../../web/lib/agents/types.js';
import { recordHeartbeat } from '../../web/lib/jobs/heartbeat.js';

export const config = {
  runtime: 'nodejs',
  maxDuration: 300, // brief can take 30-60s per user; 5 admins ~5 min worst case
};

interface BriefResult {
  user: string;
  email: string;
  ok: boolean;
  runId?: string;
  error?: string;
  textLength?: number;
  posted?: boolean;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const t0 = Date.now();
  // -- Auth: Vercel cron Bearer token --------------------------------------
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.warn('[cron/atlas-brief] CRON_SECRET not set');
    res.status(503).end('not configured');
    return;
  }
  const auth = String(req.headers['authorization'] || '');
  if (auth !== `Bearer ${cronSecret}`) {
    res.status(401).end('unauthorized');
    return;
  }

  // -- Pull admin users ----------------------------------------------------
  // Restrict to real @vendodigital.co.uk admins. Test accounts on
  // @vendo.com are also flagged role='admin' but should never receive
  // the brief — Slack lookup would fail anyway and pollute the run log.
  const r = await db.execute({
    sql: `SELECT id, email, name, password_hash, role, must_change_password,
                 created_at, updated_at
            FROM users
           WHERE role = 'admin'
             AND email LIKE '%@vendodigital.co.uk'
           ORDER BY name`,
    args: [],
  });
  const adminRows = r.rows as unknown as UserRow[];

  if (adminRows.length === 0) {
    res.status(200).json({ ok: true, message: 'No admin users to brief.' });
    return;
  }

  // -- Run the brief for each admin in parallel ----------------------------
  // Parallel because each run is a fresh ai SDK call; no shared state.
  const results = await Promise.all(
    adminRows.map((row) => runAndDeliver(row).catch((err) => ({
      user: row.name,
      email: row.email,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    } as BriefResult))),
  );

  const ok = results.every((r) => r.ok);
  await recordHeartbeat(
    'atlas-brief',
    ok,
    Date.now() - t0,
    ok ? undefined : results.find((r) => !r.ok)?.error,
  );
  res.status(ok ? 200 : 207).json({
    ok,
    delivered: results.filter((r) => r.ok && r.posted).length,
    total: results.length,
    results,
  });
}

async function runAndDeliver(row: UserRow): Promise<BriefResult> {
  const user = userRowToSessionUser(row);
  const ctx: ToolCtx = {
    runId: '',
    agent: atlasBriefAgent.name,
    user,
    channel: 'cron' as ChannelName,
    conversationId: `atlas-brief:${user.id}:${todayKey()}`,
    graduations: new Set(),
  };

  const result = await runAgentBackground({
    agent: atlasBriefAgent,
    ctx,
    prompt: `Generate today's morning briefing for ${user.name}.`,
    trigger: 'cron:atlas-brief',
    conversationId: ctx.conversationId,
  });

  if (result.status !== 'completed' || !result.text?.trim()) {
    return {
      user: user.name,
      email: user.email,
      ok: false,
      runId: result.runId,
      error: result.error ?? 'no text returned',
    };
  }

  // Resolve their Slack DM channel via deliverProactive (handles the
  // email → Slack id lookup internally).
  let posted = false;
  try {
    await slackChannel.deliverProactive(user.id, {
      title: `Morning brief — ${todayWords()}`,
      body: result.text.trim(),
    });
    posted = true;
  } catch (err) {
    console.error(`[cron/atlas-brief] Slack delivery failed for ${user.email}:`,
      err instanceof Error ? err.message : String(err));
  }

  return {
    user: user.name,
    email: user.email,
    ok: true,
    runId: result.runId,
    textLength: result.text.length,
    posted,
  };
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function todayWords(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

// Silence unused-import warning when we only use postSlackMessage indirectly.
void postSlackMessage;
