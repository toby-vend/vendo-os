import { db } from '../queries/base.js';
import { sendSlackMessage } from '../../../scripts/utils/slack-alert.js';
import { consoleLog } from '../monitors/base.js';
import { getClientAM } from '../asana/assignee.js';

/**
 * Weekly Monday digest of Orange clients per AM. Replaces the spam of one
 * Slack alert per Orange client with a single per-AM summary: "here are
 * your 4 Orange clients, ranked by MRR priority."
 *
 * Red + Orange real-time alerts still fire via the nightly traffic-light
 * cron. This digest is additive — a reminder for the slower-burning
 * cohort that doesn't warrant immediate SLT attention.
 */

const LOG_SOURCE = 'orange-digest';

interface OrangeRow {
  client_name: string;
  score: number;
  prev_score: number | null;
  priority: number | null;
  mrr: number;
  top_driver: string | null;
  latest_alert_id: number | null;
  acknowledged_at: string | null;
}

export interface OrangeDigestResult {
  period: string | null;
  perAm: Array<{ am: string; client_count: number; posted: boolean }>;
  totalClients: number;
  durationMs: number;
}

export async function runOrangeDigest(): Promise<OrangeDigestResult> {
  const start = Date.now();

  const periodR = await db.execute('SELECT MAX(period) as p FROM client_health');
  const period = periodR.rows[0]?.p as string | null;
  if (!period) {
    consoleLog(LOG_SOURCE, 'No client_health data');
    return { period: null, perAm: [], totalClients: 0, durationMs: Date.now() - start };
  }

  // Orange band = score 40-54 (from health/tiers.ts). Skip grace-period
  // clients, and skip clients whose latest alert is already acknowledged
  // — the AM is already intervening, no need to re-nag weekly.
  const { rows } = await db.execute({
    sql: `SELECT ch.client_name, ch.score, ch.priority, COALESCE(ch.mrr, c.mrr, 0) AS mrr,
                 (
                   SELECT breakdown FROM client_health
                   WHERE client_name = ch.client_name AND period = ch.period
                 ) AS breakdown,
                 (
                   SELECT score FROM client_health
                   WHERE client_name = ch.client_name AND period < ch.period
                   ORDER BY period DESC LIMIT 1
                 ) AS prev_score,
                 (
                   SELECT id FROM traffic_light_alerts
                   WHERE client_name = ch.client_name AND period = ch.period
                   ORDER BY id DESC LIMIT 1
                 ) AS latest_alert_id,
                 (
                   SELECT acknowledged_at FROM traffic_light_alerts
                   WHERE client_name = ch.client_name AND period = ch.period
                   ORDER BY id DESC LIMIT 1
                 ) AS acknowledged_at
          FROM client_health ch
          JOIN clients c ON c.name = ch.client_name
          WHERE ch.period = ?
            AND c.status = 'active'
            AND COALESCE(ch.grace_period, 0) = 0
            AND ch.score >= 40 AND ch.score < 55
          ORDER BY ch.priority DESC, ch.score ASC`,
    args: [period],
  });

  const orange: OrangeRow[] = [];
  for (const row of rows) {
    if (row.acknowledged_at) continue; // AM already on it
    let topDriver: string | null = null;
    try {
      const parsed = JSON.parse(row.breakdown as string) as { topDrivers?: string[] };
      topDriver = parsed.topDrivers?.[0] ?? null;
    } catch { /* ignore */ }
    orange.push({
      client_name: row.client_name as string,
      score: row.score as number,
      prev_score: (row.prev_score as number | null) ?? null,
      priority: (row.priority as number | null) ?? null,
      mrr: (row.mrr as number) || 0,
      top_driver: topDriver,
      latest_alert_id: (row.latest_alert_id as number | null) ?? null,
      acknowledged_at: null,
    });
  }

  if (!orange.length) {
    consoleLog(LOG_SOURCE, 'No Orange clients this period — no digest sent');
    return { period, perAm: [], totalClients: 0, durationMs: Date.now() - start };
  }

  // Group by AM. Unassigned clients get a shared "Unassigned" digest so
  // they don't fall through the cracks.
  const byAm = new Map<string, OrangeRow[]>();
  for (const c of orange) {
    const am = (await getClientAM(c.client_name)) || 'Unassigned';
    const list = byAm.get(am) || [];
    list.push(c);
    byAm.set(am, list);
  }

  const perAm: OrangeDigestResult['perAm'] = [];
  const channel = process.env.SLACK_CHANNEL_ALERTS || '#alerts';

  for (const [am, clients] of byAm) {
    const lines = [
      `:large_orange_circle: *Weekly Orange digest \u2014 ${am}* (${clients.length} client${clients.length === 1 ? '' : 's'})`,
      ...clients.map((c) => {
        const delta = c.prev_score != null ? ` (was ${c.prev_score})` : '';
        const driver = c.top_driver ? ` \u2022 ${c.top_driver}` : '';
        const mrr = c.mrr > 0 ? ` \u2022 \u00a3${Math.round(c.mrr).toLocaleString()}/mo` : '';
        return `  \u2022 ${c.client_name} \u2014 ${c.score}/100${delta}${mrr}${driver}`;
      }),
      '',
      `Review at ${process.env.VERCEL_PROJECT_URL ? `https://${process.env.VERCEL_PROJECT_URL}/dashboards/health?filter=all&tier=orange` : '/dashboards/health'}`,
    ];
    try {
      await sendSlackMessage(channel, lines.join('\n'));
      perAm.push({ am, client_count: clients.length, posted: true });
    } catch (err) {
      consoleLog(LOG_SOURCE, `Failed to post digest for ${am}: ${err instanceof Error ? err.message : err}`);
      perAm.push({ am, client_count: clients.length, posted: false });
    }
  }

  const durationMs = Date.now() - start;
  consoleLog(LOG_SOURCE, `Posted ${perAm.length} digests covering ${orange.length} Orange clients in ${durationMs}ms`);
  return { period, perAm, totalClients: orange.length, durationMs };
}
