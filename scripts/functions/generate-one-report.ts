/**
 * Generate ONE client report through the production pipeline — for testing a
 * single client before rolling out to all of them.
 *
 * Drives the exact same code path as the monthly cron and the editor's
 * "Generate" button (web/lib/reports/generate.ts), against the SAME database
 * the app uses (Turso in production via .env.local). It creates or reuses the
 * `client_reports` row for the period, pulls Google Ads + Asana + Fathom
 * context, auto-writes the narrative, and generates the AI blocks.
 *
 * Usage:
 *   npm run report:one -- "Thornley Park Dental"
 *   npm run report:one -- "Thornley Park Dental" --period 2026-05
 *   npm run report:one -- "Thornley Park Dental" --period 2026-05 --force
 *   npm run report:one -- "Thornley Park Dental" --force-narrative
 *
 * Flags:
 *   --period YYYY-MM   Reporting month (default: previous calendar month)
 *   --force            Regenerate AI blocks even if the report already exists
 *   --force-narrative  Overwrite worked_on_md from the auto-pulled draft even
 *                      if it already has content
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

/** First non-flag argument after the script path = client name. */
function positionalClient(): string | undefined {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      // Skip flags that take a value.
      if (a === '--period') i++;
      continue;
    }
    return a;
  }
  return undefined;
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
  const end = new Date(Date.UTC(y, m, 0)); // last day of month
  const monthName = start.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' });
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { label: `${monthName} ${y}`, start: fmt(start), end: fmt(end) };
}

async function main() {
  const clientName = arg('--client') ?? positionalClient();
  if (!clientName) {
    console.error('Usage: npm run report:one -- "<Client Name>" [--period YYYY-MM] [--force] [--force-narrative]');
    process.exit(1);
  }
  const period = arg('--period') ?? prevMonthPeriod();
  const force = hasFlag('--force');
  const forceNarrative = hasFlag('--force-narrative');
  const channelArg = (arg('--channel') ?? 'google_ads').toLowerCase();
  const { label, start, end } = periodBounds(period);

  // Import AFTER dotenv so base.ts binds to TURSO_* at module init.
  const { rows } = await import('../../web/lib/queries/base.js');
  const { createReport, findReport, getReport, getClientActiveChannels, channelLabel, isReportChannel } =
    await import('../../web/lib/queries/reports.js');
  const { generateReportForId } = await import('../../web/lib/reports/generate.js');

  if (channelArg !== 'all' && !isReportChannel(channelArg)) {
    console.error(`Invalid --channel "${channelArg}" (expected google_ads | meta | seo | all)`);
    process.exit(1);
  }

  const usingTurso = !!process.env.TURSO_DATABASE_URL;
  console.log(`\nDB target: ${usingTurso ? 'TURSO (production)' : 'local SQLite'}`);
  console.log(`Period:    ${label} (${start} .. ${end})`);

  // Resolve the client — exact match first, then a forgiving LIKE.
  const matches = await rows<{ id: number; name: string; vertical: string | null; status: string | null }>(
    `SELECT id, name, vertical, status FROM clients
      WHERE name = ? OR display_name = ?
         OR name LIKE ? OR display_name LIKE ?
      ORDER BY (name = ?) DESC, name
      LIMIT 10`,
    [clientName, clientName, `%${clientName}%`, `%${clientName}%`, clientName],
  );
  if (!matches.length) {
    console.error(`\nNo client matching "${clientName}".`);
    process.exit(1);
  }
  if (matches.length > 1 && !matches.some(m => m.name.toLowerCase() === clientName.toLowerCase())) {
    console.error(`\nAmbiguous client "${clientName}" — matches:`);
    for (const m of matches) console.error(`  - ${m.name}${m.vertical ? ` (${m.vertical})` : ''}`);
    console.error('Re-run with the exact name.');
    process.exit(1);
  }
  const client = matches.find(m => m.name.toLowerCase() === clientName.toLowerCase()) ?? matches[0];
  console.log(`Client:    ${client.name}${client.vertical ? ` (${client.vertical})` : ''}  [id ${client.id}]`);

  // Resolve the channel list.
  let channels: ('google_ads' | 'meta' | 'seo')[];
  if (channelArg === 'all') {
    channels = await getClientActiveChannels(client.id);
    if (!channels.length) {
      console.error('\nClient has no active channels (no Google Ads / Meta / SEO mappings).');
      process.exit(1);
    }
  } else {
    channels = [channelArg as 'google_ads' | 'meta' | 'seo'];
  }
  console.log(`Channels:  ${channels.map(channelLabel).join(', ')}\n`);

  let anyFail = false;
  for (const channel of channels) {
    console.log(`\n══════════════ ${channelLabel(channel).toUpperCase()} ══════════════`);

    let reportId = await findReport(client.id, start, end, channel);
    if (reportId) {
      if (!force) {
        console.log(`Report already exists (id ${reportId}). Re-run with --force to regenerate.`);
        console.log(linksFor(reportId));
        continue;
      }
      console.log(`Report ${reportId} exists — regenerating (--force).`);
    } else {
      reportId = await createReport({
        clientId: client.id,
        channel,
        periodLabel: label,
        periodStart: start,
        periodEnd: end,
        createdBy: `script:generate-one-report:${clientName}`,
      });
      console.log(`Created report ${reportId}.`);
    }

    const result = await generateReportForId(reportId, {
      userId: null,
      applyNarrativeDraft: true,
      forceNarrative,
      log: (m) => console.log(`  · ${m}`),
    });

    console.log(`  ${channelLabel(channel)} data: ${result.channelHasData ? 'yes' : 'no'} | ` +
      `Asana: ${result.asanaTasksUsed} | meetings: ${result.meetingsUsed} | ` +
      `narrative: ${result.narrativeApplied ? 'yes' : 'no'} | ` +
      `AI: ${result.aiGenerated ? 'yes' : `NO — ${result.aiError ?? 'error'}`}`);

    if (result.aiGenerated) {
      const fresh = await getReport(reportId);
      if (fresh) {
        console.log('\n--- EXEC SUMMARY ---\n' + (fresh.exec_summary_md || '(empty)'));
        console.log('\n--- PERFORMANCE ---\n' + (fresh.performance_summary_md || '(empty)'));
        console.log('\n--- WINS ---\n' + (fresh.wins_md || '(empty)'));
        console.log('\n--- RISKS ---\n' + (fresh.risks_md || '(empty)'));
        console.log('\n--- RECOMMENDATIONS ---\n' + (fresh.recommendations_md || '(empty)'));
      }
    } else {
      anyFail = true;
    }
    console.log('\n' + linksFor(reportId));
  }

  process.exit(anyFail ? 1 : 0);
}

function linksFor(reportId: number): string {
  const base = process.env.APP_BASE_URL || 'https://your-vendo-os.app';
  return [
    'Review in the app:',
    `  Editor:  ${base}/reports/${reportId}`,
    `  Preview: ${base}/reports/${reportId}/preview`,
    `  Text:    ${base}/reports/${reportId}/text`,
  ].join('\n');
}

main().catch(err => {
  console.error('\ngenerate-one-report failed:', err);
  process.exit(1);
});
