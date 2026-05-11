/**
 * Performance review gaps — weekly Monday 09:00 UTC.
 * Wave V / V5.
 *
 * Scans every active Harvest user. For each person whose last review was
 * more than 90 days ago (or who has never been reviewed), posts a Slack
 * digest to the perf-reviews channel listing the gaps. Idempotent within
 * a 7-day window — re-runs in the same week don't re-prompt.
 *
 * Why Slack-digest rather than per-person Asana tasks: VendoOS has no
 * manager-mapping table, so we can't auto-assign in Asana with confidence.
 * The digest lets Toby/Helen triage and schedule reviews manually. When
 * manager mapping lands, this job can fan out to per-manager Asana tasks.
 */
import { db } from '../queries/base.js';
import { sendSlackMessage } from '../../../scripts/utils/slack-alert.js';
import { consoleLog } from '../monitors/base.js';

const LOG_SOURCE = 'performance-review-gaps';

export interface PerformanceReviewGap {
  personName: string;
  lastReviewPeriod: string | null;
  daysSinceLastReview: number | null;
}

export interface PerformanceReviewGapsResult {
  totalActive: number;
  gaps: number;
  posted: boolean;
  durationMs: number;
  rows: PerformanceReviewGap[];
}

async function ensureSchema(): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS performance_review_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      posted_at TEXT NOT NULL,
      gap_count INTEGER NOT NULL,
      summary TEXT
    )
  `);
}

async function recentlyPosted(daysBack: number): Promise<boolean> {
  const r = await db.execute({
    sql: `SELECT 1 FROM performance_review_reminders
          WHERE posted_at >= datetime('now', ?)
          LIMIT 1`,
    args: [`-${daysBack} days`],
  });
  return r.rows.length > 0;
}

export async function runPerformanceReviewGaps(): Promise<PerformanceReviewGapsResult> {
  const start = Date.now();
  await ensureSchema();

  // Pull active Harvest users (the team roster). LEFT JOIN to their last
  // review period from performance_reviews. Filter for gaps > 90 days OR
  // no review on record.
  const usersRes = await db.execute(`
    SELECT first_name || ' ' || last_name AS name
    FROM harvest_users
    WHERE is_active = 1
    ORDER BY first_name
  `);
  const totalActive = usersRes.rows.length;

  const gaps: PerformanceReviewGap[] = [];
  for (const u of usersRes.rows) {
    const name = String(u.name);
    const last = await db.execute({
      sql: `SELECT period FROM performance_reviews
            WHERE person_name = ? ORDER BY period DESC LIMIT 1`,
      args: [name],
    });
    const lastPeriod = last.rows[0]?.period ? String(last.rows[0].period) : null;

    let daysSince: number | null = null;
    if (lastPeriod) {
      // period strings are like 'Q1-2026'. Convert to a midpoint date.
      const m = lastPeriod.match(/Q(\d)-(\d{4})/);
      if (m) {
        const quarter = Number(m[1]);
        const year = Number(m[2]);
        const month = (quarter - 1) * 3 + 2; // mid-quarter
        const reviewDate = new Date(year, month - 1, 15);
        daysSince = Math.floor((Date.now() - reviewDate.getTime()) / (1000 * 60 * 60 * 24));
      } else {
        // ISO date fallback
        const t = Date.parse(lastPeriod);
        if (!isNaN(t)) {
          daysSince = Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
        }
      }
    }

    // Gap if never reviewed, or last review > 90 days ago
    if (lastPeriod === null || (daysSince !== null && daysSince > 90)) {
      gaps.push({ personName: name, lastReviewPeriod: lastPeriod, daysSinceLastReview: daysSince });
    }
  }

  // Suppress if we already posted this week
  let posted = false;
  if (gaps.length > 0 && !(await recentlyPosted(6))) {
    const channel = process.env.SLACK_CHANNEL_HR || process.env.SLACK_CHANNEL_ALERTS || '#alerts';
    const lines = [
      `:clipboard: *Performance review gaps — ${gaps.length} ${gaps.length === 1 ? 'person' : 'people'} overdue*`,
      ...gaps.map((g) => {
        const since = g.daysSinceLastReview === null
          ? 'never reviewed'
          : `${g.daysSinceLastReview}d since ${g.lastReviewPeriod}`;
        return `  • ${g.personName} — ${since}`;
      }),
      '',
      'Book a 30-min review or run `npx tsx scripts/functions/performance-reviews.ts --create "Name" "Q-Year"` to generate metrics.',
    ];
    try {
      await sendSlackMessage(channel, lines.join('\n'));
      posted = true;
      await db.execute({
        sql: `INSERT INTO performance_review_reminders (posted_at, gap_count, summary) VALUES (?, ?, ?)`,
        args: [new Date().toISOString(), gaps.length, gaps.map((g) => g.personName).join(', ')] as (string | number | null)[],
      });
    } catch (err) {
      consoleLog(LOG_SOURCE, `Slack post failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  return {
    totalActive,
    gaps: gaps.length,
    posted,
    durationMs: Date.now() - start,
    rows: gaps,
  };
}
