/**
 * Fathom failsafe monitor.
 *
 * The Fathom webhook + sync cron is the primary path for ingesting
 * meetings. Inline concern-detection runs only **if** a meeting arrives.
 * This monitor checks the opposite: are we missing meetings we *should*
 * be ingesting?
 *
 * Heuristic: on a working day (Mon-Fri), if there have been no new
 * meetings recorded in the last 36 hours AND at least one Vendo user
 * has a calendar event whose title looks meeting-shaped, flag it.
 *
 * Without a clean calendar feed we can't know "expected meetings", so
 * the simpler heuristic is: on a working day, no meetings in 36h is
 * itself anomalous (Vendo's average is 5-10 meetings per working day).
 * That single signal catches the practical failure mode (Fathom webhook
 * dies / sync cron stops running).
 *
 * Suppressed on weekends (Sat/Sun) and bank holidays (we can't detect
 * the latter without a calendar; deferred).
 */
import { db } from '../queries/base.js';
import { sendSlackMessage } from '../../../scripts/utils/slack-alert.js';
import { alreadyAlerted, recordAlert, consoleLog, type MonitorRunResult } from './base.js';

const MONITOR_NAME = 'fathom-failsafe';
const STALE_HOURS = 36;

function isWorkingDayUtc(d: Date): boolean {
  const dow = d.getUTCDay(); // 0=Sun, 6=Sat
  return dow >= 1 && dow <= 5;
}

export async function run(): Promise<MonitorRunResult> {
  const channel = process.env.SLACK_CHANNEL_ALERTS || '#alerts';
  const today = new Date();

  // Weekend → no-op. Don't even count as 'checked' so the monitor
  // doesn't accumulate noise in heartbeats.
  if (!isWorkingDayUtc(today)) {
    consoleLog(MONITOR_NAME, 'Weekend — skip');
    return { checked: 0, flagged: 0 };
  }

  // Newest meeting in our DB
  const r = await db.execute(`
    SELECT MAX(date) AS latest, COUNT(*) AS total_24h
    FROM meetings
    WHERE date >= date('now', '-24 hours')
  `);
  const latest = r.rows[0]?.latest ? String(r.rows[0].latest) : null;
  const total24h = Number(r.rows[0]?.total_24h ?? 0);

  let stale = false;
  if (latest === null) {
    stale = true;
  } else {
    const ageMs = Date.now() - new Date(latest).getTime();
    stale = ageMs > STALE_HOURS * 60 * 60 * 1000;
  }

  if (!stale) {
    consoleLog(MONITOR_NAME, `Healthy — ${total24h} meetings in last 24h, latest ${latest}`);
    return { checked: 1, flagged: 0 };
  }

  // Dedup key includes the date so we only alert once per working day.
  const entity = `failsafe:${today.toISOString().slice(0, 10)}`;
  if (await alreadyAlerted(MONITOR_NAME, entity, 'stale-feed')) {
    consoleLog(MONITOR_NAME, 'Already alerted today');
    return { checked: 1, flagged: 0 };
  }

  const ageHours = latest
    ? Math.round((Date.now() - new Date(latest).getTime()) / (60 * 60 * 1000))
    : null;
  const msg = latest
    ? `Fathom feed looks stale — no new meetings in ${ageHours}h (last: ${latest}). Working day, expected 5-10 meetings.`
    : 'Fathom feed has zero meetings in the last 24 hours. Check the webhook + sync cron.';

  await sendSlackMessage(channel, `:warning: *Fathom failsafe*\n${msg}`).catch((err) => {
    consoleLog(MONITOR_NAME, `Slack post failed: ${err instanceof Error ? err.message : err}`);
  });
  await recordAlert(MONITOR_NAME, entity, 'stale-feed', msg);

  consoleLog(MONITOR_NAME, `Flagged stale feed: ${msg}`);
  return { checked: 1, flagged: 1 };
}
