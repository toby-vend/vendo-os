/**
 * /admin/agents — single-pane monitoring view for every scheduled agent
 * and cron-triggered job running on Vendo OS.
 *
 * Data sources:
 *   - cron_heartbeats        per-job ok/err timestamps + last duration
 *                            (written by every cron handler via
 *                            web/lib/jobs/heartbeat.ts)
 *   - vercel.json::crons[]   the schedule + path for each cron entry
 *                            (single source of truth — parsed at request
 *                            time so renames are reflected immediately)
 *   - agent_runs             every LLM invocation with usage + cost
 *
 * Read-only. Admin-only via the server.ts /admin/* gate. No "run now"
 * buttons live here — the cron Bearer secret stays out of the browser.
 * Per-agent dashboards (e.g. /admin/code-health) own their own manual
 * trigger affordance.
 */
import type { FastifyPluginAsync } from 'fastify';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../../lib/queries/base.js';
import { listAgents, getAgent, SPECIALIST_AGENTS } from '../../lib/agents/agents/index.js';
import { MODELS } from '../../lib/agents/models.js';
import { formatGbp } from '../../lib/format/currency.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../');

interface HeartbeatRow {
  job: string;
  last_success_at: string | null;
  last_error_at: string | null;
  last_error: string | null;
  last_duration_ms: number | null;
}

interface AgentRunRow {
  id: string;
  agent: string;
  channel: string;
  trigger: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  error: string | null;
}

interface CronEntry {
  path: string;
  schedule: string;
}

interface AgentCard {
  job: string;
  path: string | null;
  schedule: string;
  scheduleHuman: string;
  status: 'ok' | 'error' | 'stale' | 'unknown';
  lastSuccessAt: string | null;
  lastSuccessAgo: string | null;
  lastErrorAt: string | null;
  lastErrorAgo: string | null;
  lastError: string | null;
  lastDurationMs: number | null;
  dashboardUrl: string | null;
}

export const adminAgentsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_request, reply) => {
    const [heartbeats, crons, recentRuns, totals, registry] = await Promise.all([
      loadHeartbeats(),
      loadCrons(),
      loadRecentAgentRuns(20),
      loadTotals(),
      loadAgentRegistry(),
    ]);

    const cards = buildCards(heartbeats, crons);

    reply.render('admin/agents', {
      cards,
      recentRuns: recentRuns.map(viewRun),
      totals: { ...totals, costTodayDisplay: formatGbp(totals.costTodayUsd, 3) },
      registry: registry.map(r => ({ ...r, costDayDisplay: formatGbp(r.costDay, 3) })),
    });
  });
};

// ---------------------------------------------------------------------------
// Agent registry — one row per AgentDef defined in agents/index.ts, joined
// with 24h activity from agent_runs. Drives the "Agent registry" section on
// /admin/agents (separate from the cron heartbeats below it).
// ---------------------------------------------------------------------------

interface RegistryRow {
  name: string;
  model: string;
  modelTier: 'haiku' | 'sonnet' | 'opus' | 'other';
  tier: 'admin' | 'standard' | 'specialist' | 'cron';
  toolCount: number;
  canInvoke: boolean;
  runsDay: number;
  errorsDay: number;
  costDay: number;
}

async function loadAgentRegistry(): Promise<RegistryRow[]> {
  const stats = await load24hAgentStats();
  const rows: RegistryRow[] = [];
  for (const name of listAgents()) {
    const def = getAgent(name);
    if (!def) continue;
    rows.push({
      name,
      model: def.model,
      modelTier: tierOf(def.model),
      tier: classifyTier(name),
      toolCount: def.tools.length,
      canInvoke: def.tools.includes('invokeAgent'),
      runsDay: stats.get(name)?.runs ?? 0,
      errorsDay: stats.get(name)?.errors ?? 0,
      costDay: stats.get(name)?.cost ?? 0,
    });
  }
  // Sort: orchestrators first, specialists second, alphabetical within each.
  const tierRank = { admin: 0, standard: 1, specialist: 2, cron: 3 } as const;
  rows.sort((a, b) => tierRank[a.tier] - tierRank[b.tier] || a.name.localeCompare(b.name));
  return rows;
}

function tierOf(modelSlug: string): RegistryRow['modelTier'] {
  if (modelSlug === MODELS.HAIKU) return 'haiku';
  if (modelSlug === MODELS.SONNET) return 'sonnet';
  if (modelSlug === MODELS.OPUS) return 'opus';
  return 'other';
}

function classifyTier(name: string): RegistryRow['tier'] {
  if (SPECIALIST_AGENTS.has(name)) return 'specialist';
  if (name === 'atlas-brief' || name === 'atlas-monitor') return 'cron';
  if (name === 'atlas-staff') return 'standard';
  return 'admin';
}

async function load24hAgentStats(): Promise<Map<string, { runs: number; errors: number; cost: number }>> {
  const map = new Map<string, { runs: number; errors: number; cost: number }>();
  try {
    const r = await db.execute(`
      SELECT agent,
             COUNT(*) AS runs,
             COALESCE(SUM(CASE WHEN status = 'errored' THEN 1 ELSE 0 END), 0) AS errors,
             COALESCE(SUM(cost_usd), 0) AS cost
        FROM agent_runs
       WHERE started_at >= datetime('now', '-1 day')
    GROUP BY agent
    `);
    for (const row of r.rows as unknown as { agent: string; runs: number; errors: number; cost: number }[]) {
      map.set(row.agent, { runs: Number(row.runs), errors: Number(row.errors), cost: Number(row.cost) });
    }
  } catch {
    // agent_runs may not exist yet on a fresh dev DB.
  }
  return map;
}

// ---------------------------------------------------------------------------
// Data loaders
// ---------------------------------------------------------------------------

async function loadHeartbeats(): Promise<HeartbeatRow[]> {
  try {
    const r = await db.execute(`
      SELECT job, last_success_at, last_error_at, last_error, last_duration_ms
        FROM cron_heartbeats
       ORDER BY COALESCE(last_error_at, last_success_at, '') DESC
    `);
    return r.rows as unknown as HeartbeatRow[];
  } catch {
    // Table is lazily created on first cron run; absent in a fresh dev DB.
    return [];
  }
}

async function loadCrons(): Promise<CronEntry[]> {
  try {
    const raw = await readFile(resolve(REPO_ROOT, 'vercel.json'), 'utf-8');
    const cfg = JSON.parse(raw) as { crons?: CronEntry[] };
    return cfg.crons ?? [];
  } catch {
    return [];
  }
}

async function loadRecentAgentRuns(limit: number): Promise<AgentRunRow[]> {
  try {
    const r = await db.execute({
      sql: `SELECT id, agent, channel, trigger, status,
                   started_at, ended_at,
                   input_tokens, output_tokens, cost_usd, error
              FROM agent_runs
          ORDER BY started_at DESC
             LIMIT ?`,
      args: [limit],
    });
    return r.rows as unknown as AgentRunRow[];
  } catch {
    return [];
  }
}

async function loadTotals(): Promise<{
  runsToday: number;
  costTodayUsd: number;
  errorsToday: number;
}> {
  try {
    const r = await db.execute(`
      SELECT
        COUNT(*) AS runs,
        COALESCE(SUM(cost_usd), 0) AS cost,
        COALESCE(SUM(CASE WHEN status = 'errored' THEN 1 ELSE 0 END), 0) AS errors
      FROM agent_runs
      WHERE started_at >= datetime('now', '-1 day')
    `);
    const row = r.rows[0] as unknown as { runs: number; cost: number; errors: number } | undefined;
    return {
      runsToday: Number(row?.runs ?? 0),
      costTodayUsd: Number(row?.cost ?? 0),
      errorsToday: Number(row?.errors ?? 0),
    };
  } catch {
    return { runsToday: 0, costTodayUsd: 0, errorsToday: 0 };
  }
}

// ---------------------------------------------------------------------------
// Card construction — unions heartbeats and crons[] so we surface jobs
// declared in vercel.json that have never fired (no heartbeat row yet),
// and jobs with heartbeats that have been removed from vercel.json
// (stale handler).
// ---------------------------------------------------------------------------

function buildCards(heartbeats: HeartbeatRow[], crons: CronEntry[]): AgentCard[] {
  const cronByJob = new Map<string, CronEntry>();
  for (const c of crons) cronByJob.set(jobNameFromPath(c.path), c);

  const heartbeatByJob = new Map<string, HeartbeatRow>();
  for (const h of heartbeats) heartbeatByJob.set(h.job, h);

  const allJobs = new Set<string>([
    ...heartbeats.map(h => h.job),
    ...crons.map(c => jobNameFromPath(c.path)),
  ]);

  const cards: AgentCard[] = [];
  for (const job of allJobs) {
    const cron = cronByJob.get(job) ?? null;
    const hb = heartbeatByJob.get(job) ?? null;
    cards.push({
      job,
      path: cron?.path ?? null,
      schedule: cron?.schedule ?? '—',
      scheduleHuman: cron ? humaniseCron(cron.schedule) : 'no cron entry',
      status: deriveStatus(hb),
      lastSuccessAt: hb?.last_success_at ?? null,
      lastSuccessAgo: hb?.last_success_at ? timeAgo(hb.last_success_at) : null,
      lastErrorAt: hb?.last_error_at ?? null,
      lastErrorAgo: hb?.last_error_at ? timeAgo(hb.last_error_at) : null,
      lastError: hb?.last_error ?? null,
      lastDurationMs: hb?.last_duration_ms ?? null,
      dashboardUrl: dashboardForJob(job),
    });
  }

  // Sort: errored first, then stale, then ok; alphabetical within each band.
  const rank = { error: 0, stale: 1, unknown: 2, ok: 3 } as const;
  cards.sort((a, b) => rank[a.status] - rank[b.status] || a.job.localeCompare(b.job));
  return cards;
}

function jobNameFromPath(path: string): string {
  return path.replace(/^\/api\/cron\//, '');
}

/**
 * Status derivation rules — kept simple. A more elaborate "overdue" check
 * (this cron should have fired by now given its schedule) is possible
 * but adds parsing + timezone risk. The two-day stale window catches
 * every job we have today.
 */
function deriveStatus(hb: HeartbeatRow | null): AgentCard['status'] {
  if (!hb) return 'unknown';
  const succ = hb.last_success_at ? Date.parse(hb.last_success_at.replace(' ', 'T') + 'Z') : null;
  const err = hb.last_error_at ? Date.parse(hb.last_error_at.replace(' ', 'T') + 'Z') : null;

  // Most recent event wins. Error after success → error; success after
  // error → ok (job recovered).
  if (err && (!succ || err > succ)) return 'error';
  if (succ && Date.now() - succ < 2 * 24 * 60 * 60 * 1000) return 'ok';
  if (succ) return 'stale';
  return 'unknown';
}

/**
 * Map known job names to their per-agent dashboards (where the user can
 * see findings/recommendations/results). The card surfaces the link so
 * an admin lands one click away from the detail.
 */
function dashboardForJob(job: string): string | null {
  const map: Record<string, string> = {
    'atlas-brief': '/inbox',
    'concern-monitor': '/inbox',
    'codebase-health': '/admin/code-health',
    monitors: '/operations',
    'traffic-light': '/operations',
    'sync-asana': '/sync-status',
    'sync-xero': '/sync-status',
    'sync-google-ads': '/sync-status',
    'sync-meta-ads': '/sync-status',
    'sync-ghl': '/sync-status',
    'sync-frameio': '/sync-status',
    'health-score': '/dashboards/finance',
  };
  return map[job] ?? null;
}

// ---------------------------------------------------------------------------
// Cron schedule → English. Recognises the patterns we use today; falls
// back to the raw expression.
// ---------------------------------------------------------------------------

function humaniseCron(schedule: string): string {
  const s = schedule.trim();
  // Simple lookups for known patterns
  const patterns: Record<string, string> = {
    '0 * * * *': 'Hourly',
    '*/2 * * * *': 'Every 2 minutes',
    '*/15 * * * *': 'Every 15 minutes',
    '0 */2 * * *': 'Every 2 hours',
    '0 */4 * * *': 'Every 4 hours',
    '0 */6 * * *': 'Every 6 hours',
  };
  if (patterns[s]) return patterns[s];

  // `M H * * 1-5` → "Weekdays HH:MM UTC"
  const weekday = /^(\d+) (\d+) \* \* 1-5$/.exec(s);
  if (weekday) {
    return `Weekdays ${pad(weekday[2])}:${pad(weekday[1])} UTC`;
  }
  // `M H * * *` → "Daily HH:MM UTC"
  const daily = /^(\d+) (\d+) \* \* \*$/.exec(s);
  if (daily) {
    return `Daily ${pad(daily[2])}:${pad(daily[1])} UTC`;
  }
  // `M H-H * * 1-5` → "Hourly weekdays HH-HH UTC"
  const hourRange = /^(\d+) (\d+)-(\d+) \* \* 1-5$/.exec(s);
  if (hourRange) {
    return `Hourly weekdays ${pad(hourRange[2])}-${pad(hourRange[3])} UTC`;
  }
  // `M H * * D` (single weekday)
  const singleDay = /^(\d+) (\d+) \* \* ([1-7])$/.exec(s);
  if (singleDay) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `${days[Number(singleDay[3])]} ${pad(singleDay[2])}:${pad(singleDay[1])} UTC`;
  }
  // `M H D * *` (monthly)
  const monthly = /^(\d+) (\d+) (\d+) \* \*$/.exec(s);
  if (monthly) {
    return `Monthly ${monthly[3]} at ${pad(monthly[2])}:${pad(monthly[1])} UTC`;
  }
  return s;
}

function pad(n: string | number): string {
  return String(n).padStart(2, '0');
}

function timeAgo(iso: string): string {
  const t = Date.parse(iso.replace(' ', 'T') + 'Z');
  if (!Number.isFinite(t)) return iso;
  const ms = Date.now() - t;
  if (ms < 0) return 'in future';
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} min ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)} h ago`;
  return `${Math.floor(ms / 86_400_000)} d ago`;
}

function viewRun(r: AgentRunRow) {
  const startedShort = r.started_at?.slice(0, 16) ?? '';
  const startedAgo = r.started_at ? timeAgo(r.started_at) : '';
  let durationMs: number | null = null;
  if (r.started_at && r.ended_at) {
    const a = Date.parse(r.started_at.replace(' ', 'T') + 'Z');
    const b = Date.parse(r.ended_at.replace(' ', 'T') + 'Z');
    if (Number.isFinite(a) && Number.isFinite(b)) durationMs = b - a;
  }
  const cost = formatGbp(r.cost_usd, 4);
  return {
    ...r,
    startedShort,
    startedAgo,
    durationMs,
    durationSec: durationMs !== null ? (durationMs / 1000).toFixed(1) : null,
    cost,
    statusClass: r.status === 'errored' ? 'run-error' : r.status === 'running' ? 'run-running' : 'run-ok',
  };
}
