/**
 * Create + generate the Google Ads report for EVERY client with a mapped
 * Google Ads account, for a given month. Drives the same production pipeline as
 * the editor's "Generate" button and the monthly cron (web/lib/reports/
 * generate.ts), writing channel-pure google_ads reports to the database.
 *
 * Each report is created in 'draft' for the team to review/approve.
 *
 * Usage:
 *   npm run report:google-all                      # previous calendar month
 *   npm run report:google-all -- --period 2026-05
 *   npm run report:google-all -- --period 2026-05 --force   # regenerate existing
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function prevMonthPeriod(): string {
  const now = new Date();
  const ref = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  ref.setUTCMonth(ref.getUTCMonth() - 1);
  return `${ref.getUTCFullYear()}-${String(ref.getUTCMonth() + 1).padStart(2, '0')}`;
}

function periodBounds(period: string): { label: string; start: string; end: string } {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) throw new Error(`Invalid --period "${period}" (expected YYYY-MM)`);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  const monthName = start.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' });
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { label: `${monthName} ${y}`, start: fmt(start), end: fmt(end) };
}

async function main() {
  const period = arg('--period') ?? prevMonthPeriod();
  const force = hasFlag('--force');
  const { label, start, end } = periodBounds(period);

  const { rows } = await import('../../web/lib/queries/base.js');
  const { createReport, findReport } = await import('../../web/lib/queries/reports.js');
  const { generateReportForId } = await import('../../web/lib/reports/generate.js');

  console.log(`\nDB target: ${process.env.TURSO_DATABASE_URL ? 'TURSO (production)' : 'local SQLite'}`);
  console.log(`Channel:   Google Ads`);
  console.log(`Period:    ${label} (${start} .. ${end})`);
  console.log(`Mode:      ${force ? 'create + REGENERATE existing' : 'create missing + generate new'}\n`);

  // Every active client with a mapped Google Ads account.
  const clients = await rows<{ id: number; name: string }>(
    `SELECT DISTINCT c.id AS id, COALESCE(c.display_name, c.name) AS name
       FROM gads_account_client_map m
       JOIN clients c ON c.id = m.client_id
      WHERE COALESCE(c.status, 'active') = 'active'
      ORDER BY name`,
  );
  console.log(`${clients.length} Google Ads clients found.\n`);

  let created = 0, regenerated = 0, skipped = 0, withData = 0, aiFailed = 0, failed = 0;
  let i = 0;
  for (const client of clients) {
    i++;
    const tag = `[${i}/${clients.length}] ${client.name}`;
    try {
      let reportId = await findReport(client.id, start, end, 'google_ads');
      if (reportId && !force) {
        skipped++;
        console.log(`${tag}: report ${reportId} already exists — skipped (use --force to regenerate)`);
        continue;
      }
      if (reportId) {
        regenerated++;
      } else {
        reportId = await createReport({
          clientId: client.id,
          channel: 'google_ads',
          periodLabel: label,
          periodStart: start,
          periodEnd: end,
          createdBy: 'script:generate-all-google-reports',
        });
        created++;
      }

      const res = await generateReportForId(reportId, {
        userId: null,
        applyNarrativeDraft: true,
        forceNarrative: force,
      });
      if (res.channelHasData) withData++;
      if (!res.aiGenerated) aiFailed++;
      console.log(
        `${tag}: report ${reportId} ${reportId && !force && regenerated ? '' : ''}` +
        `${res.channelHasData ? 'data ✓' : 'NO Google Ads data'} | ` +
        `AI ${res.aiGenerated ? '✓' : `✗ (${res.aiError ?? 'error'})`}`,
      );
    } catch (err) {
      failed++;
      console.log(`${tag}: FAILED — ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\n=== Done (${label}) ===`);
  console.log(`Clients:      ${clients.length}`);
  console.log(`Created:      ${created}`);
  console.log(`Regenerated:  ${regenerated}`);
  console.log(`Skipped:      ${skipped}`);
  console.log(`Had GAds data:${withData}`);
  console.log(`AI failed:    ${aiFailed}`);
  console.log(`Errored:      ${failed}`);
  console.log(`\nReview at /reports (filter to Google Ads). Reports are in draft for approval.`);
  process.exit(failed > 0 || aiFailed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('\ngenerate-all-google-reports failed:', err);
  process.exit(1);
});
