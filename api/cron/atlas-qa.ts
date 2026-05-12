/**
 * /api/cron/atlas-qa — weekly meta-audit of the growth agent stack.
 *
 * Schedule: 0 19 * * 0 (Sunday 19:00 UTC, before Monday morning).
 *
 * Pre-fetches the four layers of audit data (findings hygiene, runs
 * health, invokeAgent samples, meeting-concern coverage) and feeds
 * them in as a prompt prefix. The agent itself only needs to read,
 * reason, and record one qa-audit finding via recordGrowthFinding.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../web/lib/queries/base.js';
import { userRowToSessionUser, type UserRow } from '../../web/lib/queries/auth.js';
import { atlasQaAgent } from '../../web/lib/agents/agents/index.js';
import { runAgentBackground } from '../../web/lib/agents/runtime.js';
import { recordHeartbeat } from '../../web/lib/jobs/heartbeat.js';
import type { ToolCtx, ChannelName } from '../../web/lib/agents/types.js';

export const config = { runtime: 'nodejs', maxDuration: 300 };

const RUNNER_EMAIL = process.env.GROWTH_RUNNER_EMAIL ?? 'toby@vendodigital.co.uk';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const t0 = Date.now();

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

  const r = await db.execute({
    sql: `SELECT id, email, name, password_hash, role, must_change_password,
                 created_at, updated_at
            FROM users WHERE email = ? LIMIT 1`,
    args: [RUNNER_EMAIL],
  });
  const runnerRow = (r.rows[0] as unknown as UserRow) ?? null;
  if (!runnerRow) {
    await recordHeartbeat('atlas-qa', false, Date.now() - t0, `runner ${RUNNER_EMAIL} missing`);
    res.status(500).json({ ok: false, error: `runner ${RUNNER_EMAIL} not found` });
    return;
  }
  const user = userRowToSessionUser(runnerRow);

  // -- Pre-fetch the four audit layers ----------------------------------
  const prefix = await buildAuditPrefix();

  const ctx: ToolCtx = {
    runId: '',
    agent: atlasQaAgent.name,
    user,
    channel: 'cron' as ChannelName,
    conversationId: `atlas-qa:${todayKey()}`,
    graduations: new Set(),
    depth: 0,
    parentRunId: null,
  };

  const result = await runAgentBackground({
    agent: atlasQaAgent,
    ctx,
    prompt:
      prefix +
      '\n\nProduce this week\'s QA audit. Follow your system prompt and ' +
      'record one qa-audit finding via recordGrowthFinding.',
    trigger: 'cron:atlas-qa',
    conversationId: ctx.conversationId,
  });

  const ok = result.status === 'completed';
  await recordHeartbeat(
    'atlas-qa',
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
}

// ---------------------------------------------------------------------------
// Audit-data assembly. Each block is bounded — the prompt has a hard
// budget so we cap row counts deliberately.
// ---------------------------------------------------------------------------

async function buildAuditPrefix(): Promise<string> {
  const blocks: string[] = [];
  blocks.push('# Weekly QA audit data — pre-fetched\n');

  // (a) findings hygiene -------------------------------------------------
  blocks.push('## (a) Growth findings hygiene — last 7 days\n');
  blocks.push(await findingsHygieneBlock());

  // (b) agent_runs health ------------------------------------------------
  blocks.push('\n## (b) Agent runs health — last 7 days\n');
  blocks.push(await runsHealthBlock());

  // (c) invokeAgent samples ---------------------------------------------
  blocks.push('\n## (c) Recent invokeAgent calls (sample of 20)\n');
  blocks.push(await invokeSampleBlock());

  // (d) meeting concerns vs findings -------------------------------------
  blocks.push('\n## (d) Recent meeting concerns vs findings coverage\n');
  blocks.push(await coverageBlock());

  return blocks.join('\n');
}

async function findingsHygieneBlock(): Promise<string> {
  try {
    const byStatus = await db.execute(`
      SELECT status, COUNT(*) AS n
        FROM growth_findings
       WHERE last_seen >= datetime('now', '-7 days')
    GROUP BY status
    `);
    const byAgent = await db.execute(`
      SELECT agent,
             SUM(CASE WHEN status='open' THEN 1 ELSE 0 END) AS open,
             SUM(CASE WHEN status='acted' THEN 1 ELSE 0 END) AS acted,
             SUM(CASE WHEN status='dismissed' THEN 1 ELSE 0 END) AS dismissed,
             SUM(CASE WHEN status='stale' THEN 1 ELSE 0 END) AS stale
        FROM growth_findings
       WHERE last_seen >= datetime('now', '-7 days')
    GROUP BY agent
    `);
    const oldOpen = await db.execute(`
      SELECT id, agent, severity, title, first_seen
        FROM growth_findings
       WHERE status = 'open'
         AND first_seen < datetime('now', '-14 days')
    ORDER BY first_seen ASC
       LIMIT 30
    `);
    const actedNoOutcome = await db.execute(`
      SELECT id, agent, title, acted_by, acted_at
        FROM growth_findings
       WHERE status = 'acted'
         AND (acted_outcome IS NULL OR acted_outcome = '')
         AND acted_at >= datetime('now', '-30 days')
    ORDER BY acted_at DESC
       LIMIT 20
    `);

    const lines: string[] = [];
    lines.push('Counts by status (last 7d):');
    for (const row of byStatus.rows as unknown as { status: string; n: number }[]) {
      lines.push(`  ${row.status}: ${row.n}`);
    }
    lines.push('');
    lines.push('Per-agent breakdown (last 7d): agent | open | acted | dismissed | stale');
    for (const row of byAgent.rows as unknown as { agent: string; open: number; acted: number; dismissed: number; stale: number }[]) {
      lines.push(`  ${row.agent} | ${row.open} | ${row.acted} | ${row.dismissed} | ${row.stale}`);
    }
    lines.push('');
    lines.push(`Findings open >14 days (process gaps) — ${oldOpen.rows.length}:`);
    for (const row of oldOpen.rows as unknown as { id: number; agent: string; severity: string; title: string; first_seen: string }[]) {
      lines.push(`  #${row.id} [${row.severity}] (${row.agent}) ${row.title} — first seen ${row.first_seen?.slice(0, 10)}`);
    }
    lines.push('');
    lines.push(`Acted findings with NO acted_outcome (lost learnings) — ${actedNoOutcome.rows.length}:`);
    for (const row of actedNoOutcome.rows as unknown as { id: number; agent: string; title: string; acted_by: string; acted_at: string }[]) {
      lines.push(`  #${row.id} (${row.agent}) ${row.title} — by ${row.acted_by} on ${row.acted_at?.slice(0, 10)}`);
    }
    return lines.join('\n');
  } catch (err) {
    return `(query failed: ${err instanceof Error ? err.message : String(err)})`;
  }
}

async function runsHealthBlock(): Promise<string> {
  try {
    const r = await db.execute(`
      SELECT agent,
             COUNT(*) AS runs,
             SUM(CASE WHEN status='errored' THEN 1 ELSE 0 END) AS errors,
             SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
             COALESCE(SUM(cost_usd), 0) AS cost,
             AVG(cost_usd) AS avg_cost,
             AVG(input_tokens + output_tokens) AS avg_tokens
        FROM agent_runs
       WHERE started_at >= datetime('now', '-7 days')
    GROUP BY agent
    ORDER BY cost DESC
    `);
    const lines: string[] = [];
    lines.push('Per-agent (last 7d): agent | runs | errors | error% | total cost USD | avg tokens');
    for (const row of r.rows as unknown as { agent: string; runs: number; errors: number; completed: number; cost: number; avg_cost: number | null; avg_tokens: number | null }[]) {
      const errPct = row.runs > 0 ? ((Number(row.errors) / Number(row.runs)) * 100).toFixed(1) : '0';
      lines.push(`  ${row.agent} | ${row.runs} | ${row.errors} | ${errPct}% | $${Number(row.cost).toFixed(4)} | ${row.avg_tokens != null ? Math.round(Number(row.avg_tokens)) : '—'}`);
    }
    // Find silent-failures: completed runs with no text persisted in agent_messages
    const silent = await db.execute(`
      SELECT r.id, r.agent, r.started_at
        FROM agent_runs r
       WHERE r.status = 'completed'
         AND r.started_at >= datetime('now', '-7 days')
         AND NOT EXISTS (
           SELECT 1 FROM agent_messages m
            WHERE m.run_id = r.id
              AND m.role = 'assistant'
         )
       LIMIT 10
    `);
    if (silent.rows.length > 0) {
      lines.push('');
      lines.push(`Silent failures (completed but no assistant text) — ${silent.rows.length}:`);
      for (const row of silent.rows as unknown as { id: string; agent: string; started_at: string }[]) {
        lines.push(`  ${row.id.slice(0, 8)}… (${row.agent}) at ${row.started_at?.slice(0, 16)}`);
      }
    }
    return lines.join('\n');
  } catch (err) {
    return `(query failed: ${err instanceof Error ? err.message : String(err)})`;
  }
}

async function invokeSampleBlock(): Promise<string> {
  try {
    const r = await db.execute(`
      SELECT t.call_id, t.run_id, t.phase, t.input, t.output, t.error, t.created_at,
             r.agent AS parent_agent
        FROM agent_tool_calls t
        JOIN agent_runs r ON r.id = t.run_id
       WHERE t.tool_name = 'invokeAgent'
         AND t.created_at >= datetime('now', '-7 days')
    ORDER BY t.created_at DESC
       LIMIT 40
    `);
    type Row = {
      call_id: string;
      run_id: string;
      phase: string;
      input: string | null;
      output: string | null;
      error: string | null;
      created_at: string;
      parent_agent: string;
    };
    const rows = r.rows as unknown as Row[];

    // Group by call_id, keep up to 20 logical calls (parent prompt + child reply pairs).
    const byCall = new Map<string, Row[]>();
    for (const row of rows) {
      const list = byCall.get(row.call_id);
      if (list) list.push(row);
      else byCall.set(row.call_id, [row]);
    }
    const lines: string[] = [];
    let n = 0;
    for (const [, calls] of byCall) {
      if (n >= 20) break;
      const start = calls.find(c => c.phase === 'start');
      const end = calls.find(c => c.phase === 'end');
      let inp: { agentName?: string; prompt?: string } = {};
      let out: { text?: string; status?: string } = {};
      try { if (start?.input) inp = JSON.parse(start.input); } catch { /* ignore */ }
      try { if (end?.output) out = JSON.parse(end.output); } catch { /* ignore */ }
      lines.push(
        `--- call ${n + 1} (${calls[0].parent_agent} → ${inp.agentName ?? '?'}, status=${out.status ?? 'unknown'}) ---`,
      );
      lines.push(`PROMPT: ${(inp.prompt ?? '').slice(0, 400)}`);
      lines.push(`REPLY:  ${(out.text ?? '').slice(0, 400)}`);
      lines.push('');
      n++;
    }
    if (n === 0) lines.push('(no invokeAgent calls in the last 7 days)');
    return lines.join('\n');
  } catch (err) {
    return `(query failed: ${err instanceof Error ? err.message : String(err)})`;
  }
}

async function coverageBlock(): Promise<string> {
  try {
    const concerns = await db.execute(`
      SELECT id, client_id, severity, summary, created_at
        FROM meeting_concerns
       WHERE created_at >= datetime('now', '-14 days')
    ORDER BY created_at DESC
       LIMIT 30
    `);
    const findingSubjects = await db.execute(`
      SELECT DISTINCT subject_id
        FROM growth_findings
       WHERE last_seen >= datetime('now', '-14 days')
         AND subject_type = 'client'
    `);
    type SubjectRow = { subject_id: string | null };
    const haveFinding = new Set<string>(
      (findingSubjects.rows as unknown as SubjectRow[])
        .map(r => r.subject_id)
        .filter((v): v is string => !!v),
    );

    const lines: string[] = [];
    lines.push(`Recent meeting concerns (last 14d) — ${concerns.rows.length}:`);
    for (const row of concerns.rows as unknown as { id: number; client_id: string | null; severity: string; summary: string; created_at: string }[]) {
      const covered = row.client_id && haveFinding.has(String(row.client_id)) ? '[COVERED]' : '[BLIND SPOT]';
      lines.push(`  ${covered} #${row.id} [${row.severity}] client=${row.client_id ?? '?'} — ${(row.summary ?? '').slice(0, 120)}`);
    }
    return lines.join('\n');
  } catch (err) {
    return `(query failed: ${err instanceof Error ? err.message : String(err)})`;
  }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
