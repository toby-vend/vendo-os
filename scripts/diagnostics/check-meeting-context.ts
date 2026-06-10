/**
 * Diagnostic: why are client reports not pulling meeting notes?
 *
 * Checks, against the configured DB (Turso in prod when env vars set):
 *   1. Meeting sync freshness (latest meeting date + synced_at).
 *   2. How many meetings in the last 2 months have client_name set vs not.
 *   3. Per recent report: whether meetings exist for that client + period,
 *      and whether they have summaries.
 */
import { rows } from '../../web/lib/queries/base.js';

async function main() {
  const freshness = await rows<{ latest_date: string; latest_synced: string; total: number }>(
    `SELECT MAX(date) AS latest_date, MAX(synced_at) AS latest_synced, COUNT(*) AS total FROM meetings`,
  );
  console.log('Meetings table:', freshness[0]);

  const matchStats = await rows<{ matched: number; unmatched: number }>(
    `SELECT
       SUM(CASE WHEN client_name IS NOT NULL AND length(trim(client_name)) > 0 THEN 1 ELSE 0 END) AS matched,
       SUM(CASE WHEN client_name IS NULL OR length(trim(client_name)) = 0 THEN 1 ELSE 0 END) AS unmatched
     FROM meetings
     WHERE date >= date('now', '-60 days')`,
  );
  console.log('Last 60 days client_name matching:', matchStats[0]);

  const summaryStats = await rows<{ with_summary: number; without_summary: number }>(
    `SELECT
       SUM(CASE WHEN summary IS NOT NULL AND length(trim(summary)) > 0 THEN 1 ELSE 0 END) AS with_summary,
       SUM(CASE WHEN summary IS NULL OR length(trim(summary)) = 0 THEN 1 ELSE 0 END) AS without_summary
     FROM meetings
     WHERE date >= date('now', '-60 days')`,
  );
  console.log('Last 60 days summaries:', summaryStats[0]);

  // Recent reports and whether meeting context would be found for them.
  const reports = await rows<{
    id: number; client_id: number; client_name: string; period_start: string; period_end: string; channel: string;
  }>(
    `SELECT cr.id, cr.client_id, c.name AS client_name, cr.period_start, cr.period_end, cr.channel
     FROM client_reports cr JOIN clients c ON c.id = cr.client_id
     ORDER BY cr.updated_at DESC LIMIT 12`,
  );

  for (const r of reports) {
    const m = await rows<{ n: number; with_summary: number }>(
      `SELECT COUNT(*) AS n,
              SUM(CASE WHEN summary IS NOT NULL AND length(trim(summary)) > 0 THEN 1 ELSE 0 END) AS with_summary
       FROM meetings
       WHERE client_name = ? AND date >= ? AND date < date(?, '+1 day')`,
      [r.client_name, r.period_start, r.period_end],
    );
    // Also: meetings that LOOK like this client's but aren't matched (title contains name token).
    const token = r.client_name.split(/\s+/)[0];
    const near = await rows<{ n: number }>(
      `SELECT COUNT(*) AS n FROM meetings
       WHERE (client_name IS NULL OR client_name <> ?)
         AND date >= ? AND date < date(?, '+1 day')
         AND title LIKE '%' || ? || '%'`,
      [r.client_name, r.period_start, r.period_end, token],
    );
    console.log(
      `report ${r.id} [${r.channel}] ${r.client_name} ${r.period_start}..${r.period_end}: ` +
      `meetings=${m[0].n} withSummary=${m[0].with_summary} unmatchedTitleHits=${near[0].n}`,
    );
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
