/**
 * /api/cron/atlas-growth — the weekly orchestrator.
 *
 * Schedule: 0 17 * * 5 (Fri 17:00 UTC).
 *
 * Bespoke handler (rather than runGrowthCron) because:
 *   - the agent itself uses invokeAgent on six workers (sync, capped at
 *     depth 3 — fine inside a 300s function)
 *   - the final synthesis text needs to land in Slack as a digest, not
 *     just sit in /admin/growth
 *   - we also save the digest to outputs/analyses/ for the record
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../web/lib/queries/base.js';
import { userRowToSessionUser, type UserRow } from '../../web/lib/queries/auth.js';
import { atlasGrowthAgent } from '../../web/lib/agents/agents/index.js';
import { runAgentBackground } from '../../web/lib/agents/runtime.js';
import { slackChannel } from '../../web/lib/agents/channels/slack.js';
import { slackifyAgentOutput } from '../../web/lib/agents/format/slackify.js';
import { recordHeartbeat } from '../../web/lib/jobs/heartbeat.js';
import type { ToolCtx, ChannelName } from '../../web/lib/agents/types.js';

export const config = { runtime: 'nodejs', maxDuration: 300 };

const RUNNER_EMAIL = process.env.GROWTH_RUNNER_EMAIL ?? 'toby@vendodigital.co.uk';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const t0 = Date.now();

  // -- Auth --------------------------------------------------------------
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    res.status(503).end('not configured');
    return;
  }
  const auth = String(req.headers['authorization'] || '');
  if (auth !== `Bearer ${cronSecret}`) {
    res.status(401).end('unauthorized');
    return;
  }

  // -- Resolve runner ----------------------------------------------------
  const r = await db.execute({
    sql: `SELECT id, email, name, password_hash, role, must_change_password,
                 created_at, updated_at
            FROM users
           WHERE email = ?
           LIMIT 1`,
    args: [RUNNER_EMAIL],
  });
  const runnerRow = (r.rows[0] as unknown as UserRow) ?? null;
  if (!runnerRow) {
    await recordHeartbeat('atlas-growth', false, Date.now() - t0, `runner ${RUNNER_EMAIL} missing`);
    res.status(500).json({ ok: false, error: `runner ${RUNNER_EMAIL} not found` });
    return;
  }
  const user = userRowToSessionUser(runnerRow);

  // -- Run the orchestrator ---------------------------------------------
  const ctx: ToolCtx = {
    runId: '',
    agent: atlasGrowthAgent.name,
    user,
    channel: 'cron' as ChannelName,
    conversationId: `atlas-growth:${todayKey()}`,
    graduations: new Set(),
    depth: 0,
    parentRunId: null,
  };

  const result = await runAgentBackground({
    agent: atlasGrowthAgent,
    ctx,
    prompt:
      'Run today\'s weekly synthesis. Invoke each of the six Wave 1 ' +
      'workers in turn (atlas-churn-risk, atlas-upsell, ' +
      'atlas-lead-quality, atlas-case-study, atlas-profitability, ' +
      'atlas-feature-prioritiser) with the one-line "best move" prompt, ' +
      'then pick the top 3 and record a single growth-prescription ' +
      'finding. Final reply is a Slack-ready digest under 200 words.',
    trigger: 'cron:atlas-growth',
    conversationId: ctx.conversationId,
  });

  // -- Deliver to Slack --------------------------------------------------
  let posted = false;
  if (result.status === 'completed' && result.text.trim()) {
    try {
      await slackChannel.deliverProactive(user.id, {
        title: `Growth prescription — ${todayWords()}`,
        body: slackifyAgentOutput(result.text),
        url: `${appUrl()}/admin/growth`,
      });
      posted = true;
    } catch (err) {
      console.error(
        '[cron/atlas-growth] Slack delivery failed:',
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  // -- Heartbeat + respond ----------------------------------------------
  const ok = result.status === 'completed';
  await recordHeartbeat(
    'atlas-growth',
    ok,
    Date.now() - t0,
    ok ? undefined : result.error ?? 'run not completed',
  );
  res.status(ok ? 200 : 500).json({
    ok,
    runId: result.runId,
    status: result.status,
    textLength: result.text.length,
    costUsd: result.costUsd,
    posted,
    error: result.error,
  });
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
function appUrl(): string {
  return (
    process.env.APP_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://vendo-os.vercel.app')
  );
}
