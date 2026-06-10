/**
 * Backfill action_items from meetings.raw_action_items.
 *
 * Action item extraction only existed in scripts/analysis/process-meetings.ts
 * (local DB), so once the Fathom webhook became the production sync path the
 * action_items table in Turso went stale — no rows after mid-March 2026
 * despite raw_action_items arriving on every meeting. The webhook now
 * extracts on ingest (web/lib/action-items.ts); this script repairs the gap.
 *
 * Idempotent — safe to re-run. Respects the configured DB (Turso when
 * TURSO_DATABASE_URL is set).
 *
 * Usage:
 *   node --env-file=.env.local --import tsx/esm scripts/sync/backfill-action-items.ts            # only meetings with no extracted items
 *   node --env-file=.env.local --import tsx/esm scripts/sync/backfill-action-items.ts --dry-run
 */
import { rows } from '../../web/lib/queries/base.js';
import { extractActionItems } from '../../web/lib/action-items.js';

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const meetings = await rows<{ id: string; title: string; date: string; raw_action_items: string }>(
    `SELECT id, title, date, raw_action_items
     FROM meetings
     WHERE raw_action_items IS NOT NULL
       AND length(trim(raw_action_items)) > 2
       AND NOT EXISTS (SELECT 1 FROM action_items ai WHERE ai.meeting_id = meetings.id)
     ORDER BY date ASC`,
  );
  console.log(`${meetings.length} meetings with raw action items but no extracted rows${DRY_RUN ? ' (dry run)' : ''}`);

  let totalInserted = 0;
  for (const m of meetings) {
    if (DRY_RUN) {
      try {
        const n = (JSON.parse(m.raw_action_items) as unknown[]).length;
        console.log(`  ${m.date.slice(0, 10)} "${m.title}" — ${n} raw items`);
      } catch {
        console.log(`  ${m.date.slice(0, 10)} "${m.title}" — malformed raw JSON`);
      }
      continue;
    }
    const inserted = await extractActionItems(m.id, m.raw_action_items, m.date);
    totalInserted += inserted;
    if (inserted) console.log(`  ✓ ${m.date.slice(0, 10)} "${m.title}" — ${inserted} items`);
  }

  console.log(`\nDone: ${totalInserted} action items inserted across ${meetings.length} meetings.`);
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
