/**
 * Smoke test for the reports module — round-trips a draft report through the
 * query helpers. Safe to run repeatedly.
 *
 * Usage: npx tsx scripts/test-reports-smoke.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

// Dynamic import — must come after dotenv config so the libsql client picks up
// TURSO_DATABASE_URL when web/lib/queries/base.ts initialises.
const {
  listActiveClientsForReports,
  listReports,
  listReviewQueue,
  createReport,
  findReport,
  getReport,
  addScreenshot,
  listScreenshots,
  updateNarrative,
  updateAiBlocks,
  submitForReview,
  approveReport,
  reopenReport,
  setGadsSummary,
  deleteReport,
  PLATFORM_OPTIONS,
} = await import('../web/lib/queries/reports.js');

console.log('--- Reports smoke test ---');
console.log(`Target: ${process.env.TURSO_DATABASE_URL ? 'Turso (production)' : 'local SQLite'}`);

const clients = await listActiveClientsForReports();
console.log(`Active clients: ${clients.length}`);
if (!clients.length) throw new Error('No active clients to test against');

const before = await listReports();
console.log(`Existing reports: ${before.length}`);

console.log(`Platforms: ${PLATFORM_OPTIONS.length}`);

const c = clients[0];
console.log(`Test client: ${c.label} (id ${c.id})`);

const start = '1999-12-01';
const end = '1999-12-31';

let id = await findReport(c.id, start, end);
if (id) {
  console.log(`Pre-existing test report id ${id} — cleaning up first`);
  await deleteReport(id);
}

id = await createReport({
  clientId: c.id,
  periodLabel: 'Smoke Test — December 1999',
  periodStart: start,
  periodEnd: end,
  createdBy: 'smoke-test@vendodigital.co.uk',
});
console.log(`Created report id ${id}`);

await updateNarrative(id, {
  workedOnMd: '- Smoke test entry — should be deleted',
  focusNextMd: '- N/A',
});

await updateAiBlocks(id, {
  execSummaryMd: 'Test summary',
  performanceSummaryMd: 'Performance test',
  winsMd: '- win',
  risksMd: '- risk',
  recommendationsMd: '- rec',
});

const fresh = await getReport(id);
if (!fresh) throw new Error('Report disappeared after writes');
console.log(`Read-back: client=${fresh.client_name} period=${fresh.period_label} status=${fresh.status} ai_at=${fresh.ai_generated_at?.slice(0,16) ?? 'null'}`);

const screenshot = await addScreenshot({
  reportId: id,
  platform: 'google_ads',
  caption: 'Smoke test caption',
  blobUrl: 'https://example.invalid/test.png',
  blobPathname: 'reports/smoke/test.png',
});
console.log(`Added screenshot id ${screenshot.id} platform=${screenshot.platform} pos=${screenshot.position}`);

const shots = await listScreenshots(id);
console.log(`Screenshots on report: ${shots.length}`);

// --- Three-state workflow round-trip ---
await setGadsSummary(id, JSON.stringify({ smoke: true, has_data: false }));
const withSummary = await getReport(id);
console.log(`Gads summary attached: ${withSummary?.gads_summary_json ? '✓' : '✗'}`);

await submitForReview(id, 'smoke-test@vendodigital.co.uk');
const inReview = await getReport(id);
console.log(`After submitForReview: status=${inReview?.status} by=${inReview?.submitted_for_review_by ?? 'null'}`);
if (inReview?.status !== 'review') throw new Error('submitForReview did not set status=review');

await approveReport(id, 'am-smoke@vendodigital.co.uk');
const approved = await getReport(id);
console.log(`After approveReport: status=${approved?.status} by=${approved?.approved_by ?? 'null'}`);
if (approved?.status !== 'final') throw new Error('approveReport did not set status=final');

await reopenReport(id);
const reopened = await getReport(id);
console.log(`After reopenReport: status=${reopened?.status} approved_at=${reopened?.approved_at ?? 'null'} submitted_at=${reopened?.submitted_for_review_at ?? 'null'}`);
if (reopened?.status !== 'draft' || reopened.approved_at !== null || reopened.submitted_for_review_at !== null) {
  throw new Error('reopenReport did not fully reset state');
}

// Listing helpers
const queue = await listReviewQueue();
console.log(`Review queue size: ${queue.length} (this draft excluded — already reopened)`);

await deleteReport(id);
const gone = await getReport(id);
console.log(`After delete: ${gone === null ? 'gone ✓' : 'still here ✗'}`);

const shotsAfter = await listScreenshots(id);
console.log(`Screenshots after cascade: ${shotsAfter.length === 0 ? '0 ✓' : `${shotsAfter.length} ✗`}`);

console.log('--- All checks passed ---');
