/**
 * /api/cron/codebase-health — daily codebase scan + prioritised digest.
 *
 * Cron schedule: 30 6 * * 1-5 (06:30 UTC weekdays). Lands before
 * atlas-brief at 07:00 UTC so the dashboard is fresh when the user
 * sees the morning brief Slack ping.
 *
 * What it does:
 *   1. Run static checks (tsc --noEmit, npm audit, knip, cron drift,
 *      TODO scan) — produces deterministic Findings.
 *   2. Pick the top ~50 files changed in the last 7 days and run a
 *      per-file Sonnet review (concurrency 5).
 *   3. Upsert into code_findings by fingerprint — new/persisting/resolved.
 *   4. Post one Slack DM to admin@vendodigital.co.uk with counts +
 *      top finding + link to /admin/code-health.
 *
 * Auth: CRON_SECRET bearer (matches atlas-brief).
 *
 * This is autonomy Phase 1 (Inform). No auto-fixes, no PRs, no Asana
 * tasks. Surface only.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../web/lib/queries/base.js';
import { slackChannel } from '../../web/lib/agents/channels/slack.js';
import { recordHeartbeat } from '../../web/lib/jobs/heartbeat.js';
import { runScan } from '../../web/lib/code-health/scan.js';
import type { RunSummary } from '../../web/lib/code-health/types.js';

export const config = {
  runtime: 'nodejs',
  // Static layer ~30-60s; LLM 50 files × ~10s at concurrency 5 ≈ 100s.
  // 300s gives headroom for cold start + network jitter.
  maxDuration: 300,
};

const DEFAULT_RECIPIENT_EMAIL =
  process.env.CODE_HEALTH_RECIPIENT_EMAIL ?? 'toby@vendodigital.co.uk';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const t0 = Date.now();

  // -- Auth ---------------------------------------------------------------
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.warn('[cron/codebase-health] CRON_SECRET not set');
    res.status(503).end('not configured');
    return;
  }
  const auth = String(req.headers['authorization'] || '');
  if (auth !== `Bearer ${cronSecret}`) {
    res.status(401).end('unauthorized');
    return;
  }

  let summary: RunSummary;
  try {
    summary = await runScan({ trigger: 'cron' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[cron/codebase-health] scan threw:', msg);
    await recordHeartbeat('codebase-health', false, Date.now() - t0, msg);
    res.status(500).json({ ok: false, error: msg });
    return;
  }

  // -- Deliver Slack ping ------------------------------------------------
  let posted = false;
  try {
    posted = await postSlackPing(summary);
  } catch (err) {
    console.error('[cron/codebase-health] Slack delivery failed:', err);
  }

  const ok = summary.status !== 'failed';
  await recordHeartbeat(
    'codebase-health',
    ok,
    Date.now() - t0,
    ok ? undefined : summary.error ?? 'failed',
  );

  res.status(ok ? 200 : 500).json({
    ok,
    runId: summary.runId,
    status: summary.status,
    filesScanned: summary.filesScanned,
    findingsNew: summary.findingsNew,
    findingsPersisting: summary.findingsPersisting,
    findingsResolved: summary.findingsResolved,
    costUsd: summary.costUsd,
    posted,
  });
}

// ---------------------------------------------------------------------------
// Slack ping — one DM. Concise, link-driven. The detail lives on the
// /admin/code-health page; this message is just a nudge to open it.
// ---------------------------------------------------------------------------

async function postSlackPing(summary: RunSummary): Promise<boolean> {
  // Resolve the recipient by email. If they don't exist in users, log
  // and bail — we don't want to silently fail.
  const r = await db.execute({
    sql: `SELECT id FROM users WHERE email = ? LIMIT 1`,
    args: [DEFAULT_RECIPIENT_EMAIL],
  });
  const row = r.rows[0] as unknown as undefined | { id: string };
  if (!row) {
    console.warn(`[cron/codebase-health] no user row for ${DEFAULT_RECIPIENT_EMAIL}`);
    return false;
  }

  // Build the DM body. Slack mrkdwn — single asterisks for bold,
  // hyperlinks as <url|label>.
  const title = `Codebase health — ${todayWords()}`;
  const body = renderSlackBody(summary);
  const url = `${appUrl()}/admin/code-health`;

  await slackChannel.deliverProactive(row.id, { title, body, url });
  return true;
}

function renderSlackBody(summary: RunSummary): string {
  const newP0 = summary.topFindings.filter(f => f.severity === 'P0' && f.first_seen === f.last_seen).length;
  const newP1 = summary.topFindings.filter(f => f.severity === 'P1' && f.first_seen === f.last_seen).length;

  const lines: string[] = [];
  const parts: string[] = [];
  if (summary.findingsNew > 0) parts.push(`*${summary.findingsNew}* new`);
  if (newP0 > 0) parts.push(`:rotating_light: ${newP0} P0`);
  if (newP1 > 0) parts.push(`:large_orange_diamond: ${newP1} P1`);
  if (summary.findingsPersisting > 0) parts.push(`${summary.findingsPersisting} persisting`);
  if (summary.findingsResolved > 0) parts.push(`${summary.findingsResolved} resolved`);

  if (parts.length === 0) {
    lines.push('No new findings today — codebase is clean since yesterday.');
  } else {
    lines.push(parts.join(' · '));
  }

  // Top item, if any
  const top = summary.topFindings[0];
  if (top) {
    const loc = top.line_start ? `${top.file_path}:${top.line_start}` : top.file_path;
    lines.push('');
    lines.push(`*Top item* (${top.severity}): \`${loc}\` — ${top.title}`);
  }

  if (summary.status === 'partial' && summary.error) {
    lines.push('');
    lines.push(`_⚠ partial run: ${summary.error.slice(0, 200)}_`);
  }

  return lines.join('\n');
}

function appUrl(): string {
  return (
    process.env.APP_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://vendo-os.vercel.app')
  );
}

function todayWords(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}
