/**
 * Shared bootstrap for every growth-agent cron handler.
 *
 * Each Wave 1 cron (atlas-churn-risk, atlas-upsell, atlas-lead-quality,
 * atlas-case-study, atlas-profitability, atlas-feature-prioritiser)
 * looks almost identical: Bearer auth, resolve Toby as the run owner
 * (admin user), invoke the agent in the background, record heartbeat.
 * This helper encapsulates that.
 *
 * The orchestrator (atlas-growth) has a bespoke handler because it
 * also delivers a Slack DM after the run.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../web/lib/queries/base.js';
import {
  userRowToSessionUser,
  type UserRow,
} from '../../web/lib/queries/auth.js';
import { getAgent } from '../../web/lib/agents/agents/index.js';
import { runAgentBackground } from '../../web/lib/agents/runtime.js';
import { recordHeartbeat } from '../../web/lib/jobs/heartbeat.js';
import type { ToolCtx, ChannelName } from '../../web/lib/agents/types.js';

const DEFAULT_RUNNER_EMAIL =
  process.env.GROWTH_RUNNER_EMAIL ?? 'toby@vendodigital.co.uk';

/**
 * Resolve the user who owns growth-agent runs. Findings are attributed
 * to this user via agent_runs.user_id. Defaults to Toby — overridable
 * via GROWTH_RUNNER_EMAIL.
 */
async function resolveRunner(): Promise<UserRow | null> {
  const r = await db.execute({
    sql: `SELECT id, email, name, password_hash, role, must_change_password,
                 created_at, updated_at
            FROM users
           WHERE email = ?
           LIMIT 1`,
    args: [DEFAULT_RUNNER_EMAIL],
  });
  return (r.rows[0] as unknown as UserRow) ?? null;
}

/**
 * Run a growth agent end-to-end from a cron entry point. Handles Bearer
 * auth, runner resolution, agent lookup, the background run, and the
 * heartbeat write. Returns the HTTP response shape.
 */
export async function runGrowthCron(opts: {
  req: VercelRequest;
  res: VercelResponse;
  agentName: string;
  /** Optional extra context to fold into the prompt — e.g. atlas-feature-prioritiser's code_findings list. */
  promptPrefix?: string;
  /** The base prompt instructing the agent to do its work. */
  prompt: string;
  /** Heartbeat key — defaults to agentName. */
  heartbeatJob?: string;
}): Promise<void> {
  const { req, res, agentName, promptPrefix, prompt, heartbeatJob } = opts;
  const job = heartbeatJob ?? agentName;
  const t0 = Date.now();

  // -- Auth ---------------------------------------------------------------
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.warn(`[cron/${job}] CRON_SECRET not set`);
    res.status(503).end('not configured');
    return;
  }
  const auth = String(req.headers['authorization'] || '');
  if (auth !== `Bearer ${cronSecret}`) {
    res.status(401).end('unauthorized');
    return;
  }

  // -- Resolve runner + agent --------------------------------------------
  const runnerRow = await resolveRunner();
  if (!runnerRow) {
    const msg = `runner ${DEFAULT_RUNNER_EMAIL} not found in users`;
    await recordHeartbeat(job, false, Date.now() - t0, msg);
    res.status(500).json({ ok: false, error: msg });
    return;
  }
  const def = getAgent(agentName);
  if (!def) {
    const msg = `agent ${agentName} not registered`;
    await recordHeartbeat(job, false, Date.now() - t0, msg);
    res.status(500).json({ ok: false, error: msg });
    return;
  }

  // -- Build ctx + invoke -------------------------------------------------
  const user = userRowToSessionUser(runnerRow);
  const ctx: ToolCtx = {
    runId: '',
    agent: def.name,
    user,
    channel: 'cron' as ChannelName,
    conversationId: `${def.name}:${todayKey()}`,
    graduations: new Set(),
    depth: 0,
    parentRunId: null,
  };

  const fullPrompt = promptPrefix ? `${promptPrefix}\n\n${prompt}` : prompt;

  try {
    const result = await runAgentBackground({
      agent: def,
      ctx,
      prompt: fullPrompt,
      trigger: `cron:${def.name}`,
      conversationId: ctx.conversationId,
    });

    const ok = result.status === 'completed';
    await recordHeartbeat(
      job,
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
      error: result.error,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await recordHeartbeat(job, false, Date.now() - t0, msg);
    res.status(500).json({ ok: false, error: msg });
  }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
