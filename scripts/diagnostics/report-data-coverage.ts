/**
 * Read-only diagnostic: report data coverage per client for a given month.
 *
 * Loads .env.local first so it queries the SAME database the production
 * reports feature uses (Turso when TURSO_DATABASE_URL is set, local SQLite
 * otherwise). This lets us confirm production has fresh Fathom / Asana /
 * Google Ads data and pick a well-covered client to test report generation.
 *
 * Usage:
 *   tsx scripts/diagnostics/report-data-coverage.ts --period 2026-05
 *   tsx scripts/diagnostics/report-data-coverage.ts --period 2026-05 --vertical dental
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function monthBounds(period: string): { start: string; endExclusive: string; label: string } {
  const [y, m] = period.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const endExclusive = new Date(Date.UTC(y, m, 1));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), endExclusive: fmt(endExclusive), label: period };
}

async function main() {
  const period = arg('--period') ?? '2026-05';
  const verticalFilter = arg('--vertical');
  const { start, endExclusive, label } = monthBounds(period);

  // Import AFTER dotenv so base.ts picks up TURSO_* at module init.
  const { rows, scalar } = await import('../../web/lib/queries/base.js');

  const usingTurso = !!process.env.TURSO_DATABASE_URL;
  console.log(`\nDB target: ${usingTurso ? 'TURSO (production)' : 'local SQLite'}`);
  console.log(`Period: ${label}  (${start} .. <${endExclusive})\n`);

  // Sanity: overall freshness in the target DB.
  const meetingsMax = await scalar<string>('SELECT MAX(date) FROM meetings');
  const asanaCompletedAny = await scalar<number>('SELECT COUNT(*) FROM asana_tasks WHERE completed = 1 AND completed_at IS NOT NULL');
  const asanaCompletedMonth = await scalar<number>(
    'SELECT COUNT(*) FROM asana_tasks WHERE completed = 1 AND completed_at >= ? AND completed_at < ?',
    [start, endExclusive],
  );
  console.log(`Freshness: latest meeting date = ${meetingsMax ?? 'none'}`);
  console.log(`Asana completions: total-with-completed_at = ${asanaCompletedAny ?? 0}, in ${label} = ${asanaCompletedMonth ?? 0}\n`);

  interface Row {
    id: number;
    name: string;
    vertical: string | null;
    asana_projects: number;
    asana_done: number;
    meetings: number;
    meetings_with_summary: number;
    gads_spend: number | null;
  }

  const clients = await rows<Row>(
    `
    SELECT
      c.id, c.name, c.vertical,
      (SELECT COUNT(*) FROM client_source_mappings m
        WHERE m.client_id = c.id AND m.source = 'asana') AS asana_projects,
      (SELECT COUNT(*) FROM asana_tasks t
        JOIN client_source_mappings m ON m.external_id = t.project_gid AND m.source = 'asana'
        WHERE m.client_id = c.id AND t.completed = 1 AND t.deleted = 0
          AND t.completed_at >= ? AND t.completed_at < ?) AS asana_done,
      (SELECT COUNT(*) FROM meetings mt
        WHERE mt.client_name = c.name AND mt.date >= ? AND mt.date < ?) AS meetings,
      (SELECT COUNT(*) FROM meetings mt
        WHERE mt.client_name = c.name AND mt.date >= ? AND mt.date < ?
          AND mt.summary IS NOT NULL AND length(trim(mt.summary)) > 0) AS meetings_with_summary,
      (SELECT ROUND(SUM(s.spend), 2) FROM gads_campaign_spend s
        JOIN gads_account_client_map am ON am.gads_customer_id = s.account_id
        WHERE am.client_id = c.id AND s.date >= ? AND s.date < ?) AS gads_spend
    FROM clients c
    WHERE COALESCE(c.status, 'active') = 'active'
    `,
    [start, endExclusive, start, endExclusive, start, endExclusive, start, endExclusive],
  );

  const filtered = verticalFilter
    ? clients.filter(c => (c.vertical ?? '').toLowerCase() === verticalFilter.toLowerCase())
    : clients;

  // Rank by data richness: has google ads spend + meetings-with-summary + asana done.
  const scored = filtered
    .map(c => ({
      ...c,
      score:
        (Number(c.gads_spend) > 0 ? 3 : 0) +
        Math.min(Number(c.meetings_with_summary), 5) +
        Math.min(Number(c.asana_done), 5),
    }))
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  console.log('Best-covered clients (score = gads>0:3 + min(mtg_summ,5) + min(asana_done,5)):\n');
  console.log(
    'score'.padEnd(6),
    'gads£'.padEnd(11),
    'mtg'.padEnd(4),
    'summ'.padEnd(5),
    'asana'.padEnd(6),
    'vertical'.padEnd(10),
    'client',
  );
  for (const c of scored) {
    console.log(
      String(c.score).padEnd(6),
      String(c.gads_spend ?? 0).padEnd(11),
      String(c.meetings).padEnd(4),
      String(c.meetings_with_summary).padEnd(5),
      String(c.asana_done).padEnd(6),
      (c.vertical ?? '-').padEnd(10),
      c.name,
    );
  }
  console.log('');
  process.exit(0);
}

main().catch(err => {
  console.error('coverage diagnostic failed:', err);
  process.exit(1);
});
