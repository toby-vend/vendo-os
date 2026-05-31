/**
 * Force-recompute one or more client report dashboards against production
 * Turso, bypassing the 15-minute cache. Prints the Google topline + campaign
 * list so the result can be eyeballed against the Google Ads backend.
 *
 * Run: node --env-file=.env.local --import tsx/esm scripts/recompute-report.ts 10 11
 */
import { recomputeDashboard } from '../web/lib/reports/build-dashboard-data.js';

const ids = process.argv.slice(2).map(Number).filter(n => Number.isFinite(n));
if (ids.length === 0) {
  console.error('Usage: recompute-report.ts <reportId> [<reportId> ...]');
  process.exit(1);
}

for (const id of ids) {
  try {
    const p = await recomputeDashboard(id, 'internal');
    const g = p.google;
    const spend = g.topline.find(t => t.key === 'spend')?.value;
    const clicks = g.topline.find(t => t.key === 'clicks')?.value;
    const leads = g.topline.find(t => t.key === 'leads')?.value;
    console.log(`\n=== report ${id} — ${p.client?.name ?? '?'} (${p.range?.current?.start}..${p.range?.current?.end}) ===`);
    console.log(`TOPLINE  spend=£${Number(spend ?? 0).toFixed(2)}  clicks=${clicks}  leads=${leads}`);
    console.log('CAMPAIGNS:');
    for (const c of g.campaigns) {
      console.log(`  - ${c.name} [${c.status}]  £${Number(c.spend).toFixed(2)}  ${c.clicks} clicks  ${c.leads} leads  CPL £${Number(c.cpl).toFixed(2)}`);
    }
  } catch (err) {
    console.error(`report ${id} FAILED:`, err instanceof Error ? err.message : err);
  }
}
process.exit(0);
