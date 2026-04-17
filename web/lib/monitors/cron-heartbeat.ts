import { db } from '../queries/base.js';
import { sendSlackMessage } from '../../../scripts/utils/slack-alert.js';
import { alreadyAlerted, recordAlert, consoleLog, type MonitorRunResult } from './base.js';

const MONITOR_NAME = 'cron-heartbeat';
const STALE_AFTER_HOURS = 2;

/**
 * Meta-monitor: checks cron_heartbeats for jobs whose last successful run
 * is older than STALE_AFTER_HOURS. If any are stale — or have a recorded
 * error more recent than their last success — post to #alerts so silent
 * failures don't go unnoticed like the 12-day concern-detection blind spot.
 *
 * Dedupes per job/day via monitor_alerts.
 */
export async function run(): Promise<MonitorRunResult> {
  const channel = process.env.SLACK_CHANNEL_ALERTS || '#alerts';

  const { rows } = await db.execute(
    `SELECT job, last_success_at, last_error_at, last_error,
            (strftime('%s', 'now') - strftime('%s', COALESCE(last_success_at, '1970-01-01')))/3600.0 AS hours_since_success
     FROM cron_heartbeats`,
  );

  if (!rows.length) {
    consoleLog(MONITOR_NAME, 'No heartbeats recorded yet — skipping');
    return { checked: 0, flagged: 0 };
  }

  let checked = 0;
  let flagged = 0;

  for (const row of rows) {
    checked++;
    const job = row.job as string;
    const hoursSince = Number(row.hours_since_success);
    const lastError = row.last_error as string | null;
    const lastErrorAt = row.last_error_at as string | null;
    const lastSuccessAt = row.last_success_at as string | null;

    const errorIsFresh =
      lastError &&
      lastErrorAt &&
      (!lastSuccessAt || lastErrorAt > lastSuccessAt);

    const isStale = hoursSince > STALE_AFTER_HOURS;

    if (!errorIsFresh && !isStale) continue;

    const alertType = errorIsFresh ? 'cron-error' : 'cron-stale';
    if (await alreadyAlerted(MONITOR_NAME, job, alertType)) continue;

    const msg = errorIsFresh
      ? `Cron job "${job}" last errored at ${lastErrorAt}: ${lastError}\nLast success: ${lastSuccessAt || 'never'}`
      : `Cron job "${job}" has not succeeded in ${hoursSince.toFixed(1)} hours. Last success: ${lastSuccessAt || 'never'}.`;

    await sendSlackMessage(channel, `:rotating_light: *Cron Health Alert*\n${msg}`);
    await recordAlert(MONITOR_NAME, job, alertType, msg);
    consoleLog(MONITOR_NAME, `ALERT: ${job} — ${alertType}`);
    flagged++;
  }

  consoleLog(MONITOR_NAME, `Checked ${checked} cron jobs, flagged ${flagged}`);
  return { checked, flagged };
}
