/**
 * Capacity & utilisation digest — weekly Monday 08:30 UTC.
 * Wave C / C3.
 *
 * Pulls harvest_time_entries for the last 7 days, joined with each
 * active harvest_user's `weekly_capacity_hours`. Flags people who are
 * either over-utilised (>110% of their weekly capacity) or under-utilised
 * (<60%) and posts a Slack digest to SLACK_CHANNEL_OPS so Toby/Helen
 * can act on it before Monday standup.
 *
 * Idempotent within 6 days — re-runs the same week won't double-post.
 */
import { db } from '../queries/base.js';
import { sendSlackMessage } from '../../../scripts/utils/slack-alert.js';
import { consoleLog } from '../monitors/base.js';

const LOG_SOURCE = 'capacity-digest';
const OVER_THRESHOLD_PCT = 110;
const UNDER_THRESHOLD_PCT = 60;

interface UtilisationRow {
  user_name: string;
  hours_logged: number;
  weekly_capacity: number;
  utilisation_pct: number;
}

export interface CapacityDigestResult {
  posted: boolean;
  total: number;
  over: number;
  under: number;
  durationMs: number;
  rows: UtilisationRow[];
}

async function ensureSchema(): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS capacity_digest_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      posted_at TEXT NOT NULL,
      total INTEGER NOT NULL,
      over INTEGER NOT NULL,
      under INTEGER NOT NULL
    )
  `);
}

async function recentlyPosted(daysBack: number): Promise<boolean> {
  const r = await db.execute({
    sql: `SELECT 1 FROM capacity_digest_runs
          WHERE posted_at >= datetime('now', ?) LIMIT 1`,
    args: [`-${daysBack} days`],
  });
  return r.rows.length > 0;
}

export async function runCapacityDigest(): Promise<CapacityDigestResult> {
  const start = Date.now();
  await ensureSchema();

  // 7-day window. Same shape as dashboards.ts:getTeamUtilisation but
  // inlined so this job has no cross-module dependency on the dashboards
  // query layer.
  const res = await db.execute(`
    SELECT u.first_name || ' ' || u.last_name AS user_name,
           ROUND(COALESCE(SUM(h.hours), 0), 2) AS hours_logged,
           u.weekly_capacity_hours AS weekly_capacity,
           CASE WHEN u.weekly_capacity_hours > 0
                THEN ROUND(COALESCE(SUM(h.hours), 0) / u.weekly_capacity_hours * 100, 1)
                ELSE 0 END AS utilisation_pct
    FROM harvest_users u
    LEFT JOIN harvest_time_entries h
      ON h.user_id = u.id AND h.spent_date >= date('now', '-7 days')
    WHERE u.is_active = 1 AND u.weekly_capacity_hours > 0
    GROUP BY u.id
    ORDER BY utilisation_pct DESC
  `);

  const rows = res.rows as unknown as UtilisationRow[];
  const over = rows.filter((r) => r.utilisation_pct >= OVER_THRESHOLD_PCT);
  const under = rows.filter((r) => r.utilisation_pct < UNDER_THRESHOLD_PCT);

  let posted = false;
  if ((over.length > 0 || under.length > 0) && !(await recentlyPosted(6))) {
    const channel = process.env.SLACK_CHANNEL_OPS
      || process.env.SLACK_CHANNEL_ALERTS
      || '#alerts';
    const lines = [
      `:bar_chart: *Capacity & utilisation — last 7 days*`,
    ];
    if (over.length > 0) {
      lines.push('', '*Over-capacity* (>110%):');
      for (const r of over) {
        lines.push(`  • ${r.user_name} — ${r.hours_logged}h / ${r.weekly_capacity}h (${r.utilisation_pct}%)`);
      }
    }
    if (under.length > 0) {
      lines.push('', '*Under-utilised* (<60%):');
      for (const r of under) {
        lines.push(`  • ${r.user_name} — ${r.hours_logged}h / ${r.weekly_capacity}h (${r.utilisation_pct}%)`);
      }
    }
    lines.push('', `Total team: ${rows.length}. Full view in /dashboards/capacity.`);
    try {
      await sendSlackMessage(channel, lines.join('\n'));
      posted = true;
      await db.execute({
        sql: `INSERT INTO capacity_digest_runs (posted_at, total, over, under) VALUES (?, ?, ?, ?)`,
        args: [new Date().toISOString(), rows.length, over.length, under.length] as (string | number | null)[],
      });
    } catch (err) {
      consoleLog(LOG_SOURCE, `Slack post failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  return {
    posted,
    total: rows.length,
    over: over.length,
    under: under.length,
    durationMs: Date.now() - start,
    rows,
  };
}
