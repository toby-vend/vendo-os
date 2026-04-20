import { db } from '../queries/base.js';
import { sendSlackAlert } from '../../../scripts/utils/slack-alert.js';
import { createAsanaTask } from '../../../scripts/utils/asana-client.js';
import { consoleLog } from '../monitors/base.js';
import { getClientAM, resolveAssignee } from '../asana/assignee.js';
import {
  scoreToTier,
  tierLabel,
  tierAlerts,
  tierEscalatesToSlt,
  tierDropped,
  type HealthTier,
} from '../health/tiers.js';

const PRECIPITOUS_DROP_POINTS = 15;

/**
 * Turso-native client health traffic-light. Reads the latest client_health
 * period, derives each client's 4-tier classification, and alerts on
 * Orange + Red clients only (Amber is dashboard-only).
 *
 * Runs monthly from /api/cron/traffic-light as a safety-net; the intended
 * primary trigger path after Phase 7 is nightly health-score + real-time
 * alert when a tier drop is detected.
 */

const LOG_SOURCE = 'traffic-light';

interface HealthRow {
  client_name: string;
  score: number;
  performance_score: number;
  relationship_score: number;
  financial_score: number;
  breakdown: string;
  period: string;
  grace_period: number;
}

function buildSummary(row: HealthRow): string {
  let breakdown: Record<string, number>;
  try {
    breakdown = JSON.parse(row.breakdown);
  } catch {
    return 'Low scores across multiple dimensions';
  }
  const issues: string[] = [];
  if (breakdown.adSpend === 0) issues.push('No ad spend/traffic in last 30 days');
  if (breakdown.ctr === 0 && breakdown.adSpend > 0) issues.push('Low CTR/engagement');
  if (breakdown.spendConsistency === 0) issues.push('Inconsistent activity');
  if (breakdown.recentMeeting === 0) issues.push('No meeting in 45+ days');
  else if (breakdown.recentMeeting < 8) issues.push('Meeting overdue (30+ days)');
  if (breakdown.actionsResolved === 0) issues.push('Low action item completion rate');
  if (breakdown.noOverdue === 0) issues.push('Overdue invoices');
  if (breakdown.paidOnTime === 0) issues.push('Last invoice not fully paid');
  return issues.length ? issues.join('; ') : 'Low scores across multiple dimensions';
}

export async function ensureAlertTable(): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS traffic_light_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      period TEXT NOT NULL,
      tier TEXT NOT NULL,
      score INTEGER NOT NULL,
      asana_task_gid TEXT,
      trigger TEXT NOT NULL DEFAULT 'absolute',
      created_at TEXT NOT NULL
    )
  `);
  // Schema migrations — each wrapped in try/catch since ALTER TABLE ADD
  // COLUMN isn't idempotent on Turso/libSQL.
  for (const sql of [
    `ALTER TABLE traffic_light_alerts ADD COLUMN trigger TEXT NOT NULL DEFAULT 'absolute'`,
    `ALTER TABLE traffic_light_alerts ADD COLUMN acknowledged_at TEXT`,
    `ALTER TABLE traffic_light_alerts ADD COLUMN acknowledged_by TEXT`,
    `ALTER TABLE traffic_light_alerts ADD COLUMN resolution_type TEXT`,
    `ALTER TABLE traffic_light_alerts ADD COLUMN resolution_notes TEXT`,
  ]) {
    try { await db.execute(sql); } catch { /* already added */ }
  }
  await db.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_tla_client_period_trigger
     ON traffic_light_alerts(client_name, period, trigger)`,
  );
}

// alreadyAlerted + shouldSuppressAckedAlert have been replaced by in-memory
// caches built from fetchAlertedKeys() and fetchAcknowledgedScores() — see
// runTrafficLightAlerts. Keeping them as async one-offs wasted a round-trip
// per client per trigger (~1000 queries on a 159-client run).
function _removed_oldDedupeHelpers(): void {
  void 0;
}

async function sendSltAlert(message: string): Promise<void> {
  const url = process.env.SLACK_SLT_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    });
  } catch (err) {
    consoleLog(LOG_SOURCE, `SLT Slack alert failed: ${err instanceof Error ? err.message : err}`);
  }
}

/**
 * Map the dominant driver of a score drop to a one-line suggested next
 * step. Heuristic only — the AM is still the judge, but this removes a
 * "what do I do with this alert?" step for the easy cases.
 */
function suggestNextStep(topDrivers: string[]): string {
  if (!topDrivers.length) return 'Review dashboard breakdown and open a conversation with the client.';
  const first = topDrivers[0].split(':')[0];
  switch (first) {
    case 'adSpend': return 'Investigate ad delivery — campaigns paused, budget depleted, or tracking broken.';
    case 'ctr': return 'Review creative performance and audience targeting.';
    case 'spendConsistency': return 'Check for campaign pauses or account-level issues.';
    case 'meetingCadence': return 'Schedule a catch-up call — >45 days since last touchpoint.';
    case 'meetingSentiment': return 'Read the last 3 meeting summaries; AI has flagged concerns you should address.';
    case 'actionsResolved': return 'Clear outstanding action items from recent calls before next check-in.';
    case 'overdueSeverity': return 'Chase overdue invoices with the client or your accounts team.';
    case 'overdueAge': return 'Escalate overdue payments — oldest invoice is aging fast.';
    default: return 'Review dashboard breakdown and open a conversation with the client.';
  }
}

function clientDetailUrl(clientName: string): string {
  const base = process.env.VERCEL_PROJECT_URL ? `https://${process.env.VERCEL_PROJECT_URL}` : '';
  if (!base) return '';
  return `${base}/clients/${encodeURIComponent(clientName)}`;
}

function asanaTaskUrl(taskGid: string | null): string {
  if (!taskGid) return '';
  return `https://app.asana.com/0/0/${taskGid}`;
}

function buildDeltaLine(row: HealthRow & { prev_score?: number | null }): string {
  if (row.prev_score == null) return `Score: ${row.score}/100`;
  const delta = row.score - row.prev_score;
  const arrow = delta > 0 ? ':arrow_up:' : delta < 0 ? ':arrow_down:' : ':arrow_right:';
  const sign = delta > 0 ? '+' : '';
  return `Score: ${row.prev_score} → ${row.score}/100 ${arrow} (${sign}${delta})`;
}

async function fireAlert(opts: {
  row: HealthRow & { prev_score?: number | null };
  tier: HealthTier;
  trigger: string;
  accountManager: string | null;
}): Promise<string | null> {
  const { row, tier, trigger, accountManager } = opts;
  const { label, emoji } = tierLabel(tier);
  const summary = buildSummary(row);
  const deltaLine = buildDeltaLine(row);

  // Top drivers come from client_health.breakdown.topDrivers (set in Phase 2
  // scoring) — lowest-scoring sub-dimensions for this client.
  let topDrivers: string[] = [];
  try {
    const parsed = JSON.parse(row.breakdown);
    if (Array.isArray(parsed?.topDrivers)) topDrivers = parsed.topDrivers;
  } catch { /* breakdown parse failed */ }
  const suggestion = suggestNextStep(topDrivers);
  const driversLine = topDrivers.length ? `Top drivers: ${topDrivers.join(' · ')}` : '';
  const clientLink = clientDetailUrl(row.client_name);

  const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const taskNotes = [
    `Client: ${row.client_name}`,
    deltaLine,
    `Tier: ${label}`,
    `Performance: ${row.performance_score}/40 | Relationship: ${row.relationship_score}/30 | Financial: ${row.financial_score}/30`,
    driversLine,
    '',
    `Issues: ${summary}`,
    '',
    `Trigger: ${trigger}`,
    `Suggested next step: ${suggestion}`,
    clientLink ? `\nDashboard: ${clientLink}` : '',
    accountManager ? `Account Manager: ${accountManager}` : '',
    '',
    '---',
    'Checklist:',
    '  [ ] Review breakdown on the dashboard',
    '  [ ] Read the last 3 meeting summaries',
    '  [ ] Reach out to the client or decide intervention',
    '  [ ] Log resolution on this task when done',
  ].filter(Boolean).join('\n');

  const task = await createAsanaTask({
    name: `[${label}] ${row.client_name} — ${row.score}/100`,
    notes: taskNotes,
    dueDate,
    assigneeEmail: accountManager || undefined,
  });
  const taskGid = task?.gid ?? null;

  const slackLines = [
    `${emoji} *${label} Alert — ${row.client_name}*`,
    deltaLine,
    driversLine,
    `Issues: ${summary}`,
    `Suggested next step: ${suggestion}`,
  ].filter(Boolean);
  const taskUrl = asanaTaskUrl(taskGid);
  if (clientLink || taskUrl) {
    const links: string[] = [];
    if (clientLink) links.push(`<${clientLink}|dashboard>`);
    if (taskUrl) links.push(`<${taskUrl}|asana task>`);
    slackLines.push(links.join(' · '));
  }

  await sendSlackAlert(
    LOG_SOURCE,
    slackLines.join('\n'),
    tier === 'red' ? 'error' : 'warning',
  );

  if (tierEscalatesToSlt(tier)) {
    await sendSltAlert(
      `:rotating_light: *CRITICAL CLIENT ALERT — ${row.client_name}*\n` +
      `${deltaLine}\n` +
      `Performance: ${row.performance_score}/40 | Relationship: ${row.relationship_score}/30 | Financial: ${row.financial_score}/30\n` +
      `${driversLine}\n` +
      `Issues: ${summary}\n` +
      `Suggested next step: ${suggestion}\n` +
      (clientLink ? `Dashboard: ${clientLink}\n` : '') +
      'Immediate intervention required.',
    );
  }

  await db.execute({
    sql: `INSERT OR IGNORE INTO traffic_light_alerts
            (client_name, period, tier, score, asana_task_gid, trigger, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [row.client_name, row.period, label, row.score, taskGid, trigger, new Date().toISOString()],
  });
  return taskGid;
}

export interface TrafficLightResult {
  period: string | null;
  red: number;
  orange: number;
  amber: number; // dashboard-only count, included for visibility
  healthy: number;
  skipped: number;
  tierDrop: number;
  precipitousDrop: number;
  durationMs: number;
}

export async function runTrafficLightAlerts(): Promise<TrafficLightResult> {
  const start = Date.now();
  await ensureAlertTable();

  const periodR = await db.execute('SELECT MAX(period) as p FROM client_health');
  const period = periodR.rows[0]?.p as string | null;
  if (!period) {
    consoleLog(LOG_SOURCE, 'No client_health data — run health-score first');
    return { period: null, red: 0, orange: 0, amber: 0, healthy: 0, skipped: 0, tierDrop: 0, precipitousDrop: 0, durationMs: Date.now() - start };
  }

  const { rows } = await db.execute({
    sql: `SELECT ch.client_name, ch.score, ch.performance_score, ch.relationship_score,
                 ch.financial_score, ch.breakdown, ch.period,
                 COALESCE(ch.grace_period, 0) AS grace_period
          FROM client_health ch
          JOIN clients c ON c.name = ch.client_name
          WHERE ch.period = ? AND c.status = 'active'
          ORDER BY ch.score ASC`,
    args: [period],
  });
  if (!rows.length) {
    return { period, red: 0, orange: 0, amber: 0, healthy: 0, skipped: 0, tierDrop: 0, precipitousDrop: 0, durationMs: Date.now() - start };
  }

  let redCount = 0;
  let orangeCount = 0;
  let amberCount = 0;
  let healthyCount = 0;
  let skippedCount = 0;
  let tierDropCount = 0;
  let precipitousDropCount = 0;

  // Preload everything we need to decide dedupe/suppression for every
  // client in bulk. Avoids N round-trips per trigger.
  const [prevMap, alertedSet, ackedByTriggerPrefix] = await Promise.all([
    fetchPreviousScores(period),
    fetchAlertedKeys(period),
    fetchAcknowledgedScores(),
  ]);

  const alreadyAlertedCached = (clientName: string, trigger: string): boolean =>
    alertedSet.has(`${clientName}:${period}:${trigger}`);
  const shouldSuppressAckedCached = (clientName: string, triggerPrefix: string, currentScore: number): boolean => {
    const last = ackedByTriggerPrefix.get(`${clientName}:${triggerPrefix}`);
    if (last == null) return false;
    return currentScore >= last;
  };

  // First pass: decide which clients will actually fire alerts (pure CPU,
  // no queries). Then only look up AMs + fire alerts for that subset.
  interface ToFire {
    row: HealthRow;
    tier: HealthTier;
    trigger: string;
    prevScore: number | null;
  }
  const toFire: ToFire[] = [];

  for (const row of rows as unknown as HealthRow[]) {
    const tier = scoreToTier(row.score);
    if (tier === 'healthy') { healthyCount++; }
    else if (tier === 'amber') { amberCount++; }

    if (row.grace_period) { skippedCount++; continue; }

    const prev = prevMap.get(row.client_name) ?? null;

    if (
      tierAlerts(tier)
      && !alreadyAlertedCached(row.client_name, 'absolute')
      && !shouldSuppressAckedCached(row.client_name, 'absolute', row.score)
    ) {
      toFire.push({ row, tier, trigger: 'absolute', prevScore: prev });
    }

    if (prev != null) {
      const prevTier = scoreToTier(prev);
      if (
        tierDropped(prevTier, tier)
        && !alreadyAlertedCached(row.client_name, `tier-drop-${prevTier}-to-${tier}`)
        && !shouldSuppressAckedCached(row.client_name, 'tier-drop', row.score)
      ) {
        toFire.push({ row, tier, trigger: `tier-drop-${prevTier}-to-${tier}`, prevScore: prev });
      }

      const drop = prev - row.score;
      if (
        drop >= PRECIPITOUS_DROP_POINTS
        && !alreadyAlertedCached(row.client_name, `precipitous-drop-${drop}pts`)
        && !shouldSuppressAckedCached(row.client_name, 'precipitous-drop', row.score)
      ) {
        toFire.push({ row, tier, trigger: `precipitous-drop-${drop}pts`, prevScore: prev });
      }
    }

    if (!tierAlerts(tier) && prev == null) { skippedCount++; }
  }

  // Second pass: fire alerts. Parallelise because the per-alert cost is
  // dominated by Asana + Slack HTTP calls rather than Turso.
  const FIRE_CONCURRENCY = 6;
  for (let i = 0; i < toFire.length; i += FIRE_CONCURRENCY) {
    const chunk = toFire.slice(i, i + FIRE_CONCURRENCY);
    await Promise.all(chunk.map(async ({ row, tier, trigger, prevScore }) => {
      const amName = await getClientAM(row.client_name);
      const rowWithPrev = { ...row, prev_score: prevScore };
      await fireAlert({ row: rowWithPrev, tier, trigger, accountManager: amName });
      if (trigger === 'absolute') {
        if (tier === 'red') redCount++; else orangeCount++;
      } else if (trigger.startsWith('tier-drop')) {
        tierDropCount++;
      } else if (trigger.startsWith('precipitous-drop')) {
        precipitousDropCount++;
      }
    }));
  }

  const durationMs = Date.now() - start;
  consoleLog(
    LOG_SOURCE,
    `Period ${period}: ${redCount} red, ${orangeCount} orange, ${amberCount} amber (dashboard-only), ${healthyCount} healthy, ${skippedCount} skipped, ${tierDropCount} tier-drops, ${precipitousDropCount} precipitous-drops in ${durationMs}ms`,
  );
  return {
    period,
    red: redCount,
    orange: orangeCount,
    amber: amberCount,
    healthy: healthyCount,
    skipped: skippedCount,
    tierDrop: tierDropCount,
    precipitousDrop: precipitousDropCount,
    durationMs,
  };
}

/**
 * Load the most recent prior score for every client in one query, so the
 * main loop doesn't do N round-trips. Returns client_name → prev score.
 */
async function fetchPreviousScores(currentPeriod: string): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const r = await db.execute({
      sql: `SELECT client_name, score FROM client_health
            WHERE period = (
              SELECT MAX(period) FROM client_health WHERE period < ?
            )`,
      args: [currentPeriod],
    });
    for (const row of r.rows) {
      map.set(row.client_name as string, row.score as number);
    }
  } catch { /* no prior data */ }
  return map;
}

/**
 * Load every "already fired" alert key for this period in one query.
 * Key shape: `${client_name}:${period}:${trigger}` — matches the
 * per-trigger identity so dedupe is O(1) in-memory.
 */
async function fetchAlertedKeys(period: string): Promise<Set<string>> {
  const set = new Set<string>();
  try {
    const r = await db.execute({
      sql: 'SELECT client_name, period, trigger FROM traffic_light_alerts WHERE period = ?',
      args: [period],
    });
    for (const row of r.rows) {
      set.add(`${row.client_name}:${row.period}:${row.trigger}`);
    }
  } catch { /* table missing */ }
  return set;
}

/**
 * Load the latest acknowledged score per (client, trigger-prefix) so the
 * suppression check is O(1). The key is `${client_name}:${prefix}`, value
 * is the score at the time of the acknowledged alert.
 */
async function fetchAcknowledgedScores(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const r = await db.execute(
      `SELECT client_name, trigger, score
       FROM traffic_light_alerts
       WHERE acknowledged_at IS NOT NULL
       ORDER BY created_at DESC`,
    );
    for (const row of r.rows) {
      const trigger = row.trigger as string;
      // Match the prefixes we dedupe against in the main loop.
      const prefixes = ['absolute', 'tier-drop', 'precipitous-drop'];
      for (const prefix of prefixes) {
        if (trigger === prefix || trigger.startsWith(prefix + '-')) {
          const key = `${row.client_name}:${prefix}`;
          if (!map.has(key)) map.set(key, row.score as number);
        }
      }
    }
  } catch { /* table missing */ }
  return map;
}
