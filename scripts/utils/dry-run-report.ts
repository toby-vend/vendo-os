/**
 * Dry-run the autonomous report pipeline for one or more clients without
 * touching the client_reports table. Prints the full report (overview, AI
 * blocks, suggested narrative) to stdout and saves a .md file per client to
 * /tmp/sample-reports/.
 *
 * Usage: npx tsx --env-file=.env.local scripts/utils/dry-run-report.ts
 */
import { rows } from '../../web/lib/queries/base.js';
import { buildGoogleAdsPeriodSummary } from '../../web/lib/reports/gads-summary.js';
import { buildNarrativeContext } from '../../web/lib/reports/narrative-context.js';
import { generateReportInsights } from '../../web/lib/report-ai.js';
import { mkdir, writeFile } from 'fs/promises';

const TARGETS: Array<{ clientId: number; label: string }> = [
  { clientId: 199, label: 'MR Mouldings' },
  { clientId: 251, label: 'The Sword Stall' },
  { clientId: 138, label: 'Avenue Dental Practice' },
];

const PERIOD_START = '2026-03-01';
const PERIOD_END   = '2026-03-31';
const PERIOD_LABEL = 'March 2026';

await mkdir('/tmp/sample-reports', { recursive: true });

function fmtGbp(n: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
}

for (const t of TARGETS) {
  console.log('\n' + '='.repeat(80));
  console.log(`DRY RUN: ${t.label} (client ${t.clientId})  ·  ${PERIOD_LABEL}`);
  console.log('='.repeat(80));

  const c = await rows<{ name: string; display_name: string | null; vertical: string | null }>(
    `SELECT name, display_name, vertical FROM clients WHERE id = ?`,
    [t.clientId],
  );
  const client = c[0];
  const clientName = client?.display_name || client?.name || t.label;

  // 1) Google Ads structured summary
  console.log('\n--- Google Ads structured summary ---');
  const gads = await buildGoogleAdsPeriodSummary(t.clientId, PERIOD_START, PERIOD_END);
  if (!gads.has_data) {
    console.log('  (no Google Ads data for this period)');
  } else {
    console.log(`  Accounts rolled up: ${gads.account_count}`);
    console.log(`  Overall: spend ${fmtGbp(gads.overall.spend)}  ·  conv ${gads.overall.conversions}  ·  CPR ${fmtGbp(gads.overall.cpr)}  ·  ROAS ${gads.overall.roas?.toFixed(2) ?? 'n/a'}`);
    console.log(`  Campaigns (£0 filtered): ${gads.campaigns.length}`);
    for (const camp of gads.campaigns.slice(0, 5)) {
      console.log(`    · ${camp.campaign_name}  ${fmtGbp(camp.spend)} · ${camp.conversions} conv · CPR ${fmtGbp(camp.cpr)}`);
    }
    if (gads.campaigns.length > 5) console.log(`    … +${gads.campaigns.length - 5} more`);
  }

  // 2) Narrative context
  console.log('\n--- Narrative auto-pull ---');
  let narrative;
  try {
    narrative = await buildNarrativeContext(t.clientId, PERIOD_START, PERIOD_END);
    console.log(`  Asana tasks completed: ${narrative.asana_tasks_completed.length}`);
    console.log(`  Meeting actions:       ${narrative.meeting_actions.length}`);
    console.log(`  Last focus_next_md:    ${narrative.last_focus_next_md ? 'found' : '(none — no prior report)'}`);
  } catch (err) {
    console.log(`  (failed: ${err instanceof Error ? err.message : err})`);
    narrative = null;
  }

  // 3) AI generation
  console.log('\n--- Calling Claude Sonnet 4.6 ---');
  let ai;
  try {
    ai = await generateReportInsights({
      clientName,
      vertical: client?.vertical ?? null,
      periodLabel: PERIOD_LABEL,
      workedOnMd: narrative?.suggested_worked_on_md ?? '',
      focusNextMd: narrative?.last_focus_next_md ?? '',
      screenshots: [],
      ...(gads.has_data ? { googleAdsSummary: gads } : {}),
    }, null);
    console.log('  AI generation: ok');
  } catch (err) {
    console.log(`  AI generation failed: ${err instanceof Error ? err.message : err}`);
    continue;
  }

  // 4) Render as the client-facing preview markdown
  const md = `# ${clientName} — ${PERIOD_LABEL}

Here's a summary of your Google Ads performance for ${PERIOD_LABEL}.

## Executive summary

${ai.exec_summary}

## Performance

${ai.performance_summary}

## Wins

${ai.wins}

## Risks

${ai.risks}

## Recommendations

${ai.recommendations}

---

## Suggested narrative (auto-pulled — what the team would normally edit)

${narrative?.suggested_worked_on_md ?? '_(no narrative context available)_'}
`;

  const fname = `/tmp/sample-reports/${t.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${PERIOD_LABEL.toLowerCase().replace(/\s+/g, '-')}.md`;
  await writeFile(fname, md);

  console.log('\n--- REPORT MARKDOWN ---');
  console.log(md);
  console.log(`\n(saved to ${fname})`);
}

console.log('\n' + '='.repeat(80));
console.log('Dry run complete. No rows were written to client_reports.');
console.log('Sample markdown saved to /tmp/sample-reports/');
console.log('='.repeat(80));
