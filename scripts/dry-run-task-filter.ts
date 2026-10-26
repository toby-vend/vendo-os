/**
 * Dry run of the auto-task filter over recent meetings: prints what would be
 * kept and dropped without touching Asana. Usage:
 *   node --env-file=.env.local --import tsx/esm scripts/dry-run-task-filter.ts [days]
 */
import { db } from '../web/lib/queries/base.js';
import { parseActionItems } from '../web/lib/jobs/sync-actions-to-asana.js';
import { reviewActionItem } from '../web/lib/asana/task-filter.js';

const days = Number(process.argv[2] || 7);
const since = new Date(Date.now() - days * 864e5).toISOString();
const { rows } = await db.execute({
  sql: `SELECT id, title, client_name, summary, calendar_invitees, raw_action_items
          FROM meetings WHERE date >= ? AND raw_action_items IS NOT NULL AND raw_action_items != ''
         ORDER BY date`,
  args: [since],
});
let kept = 0, dropped = 0;
for (const m of rows) {
  let invitees = [];
  try { invitees = JSON.parse((m.calendar_invitees as string) || '[]'); } catch { /* none */ }
  const ctx = { title: m.title as string, clientName: (m.client_name as string) || null, summary: (m.summary as string) || null, invitees };
  console.log(`\n## ${m.title} (${m.client_name ?? 'internal'})`);
  for (const item of parseActionItems(m.raw_action_items as string)) {
    const r = await reviewActionItem(ctx, item.description, item.assignee, undefined, item.assigneeEmail);
    r.keep ? kept++ : dropped++;
    console.log(`  ${r.keep ? 'KEEP' : 'DROP'} ${r.kind}(${r.kindConfidence?.toFixed(2)}) owner=${r.suggestedOwner ?? '-'} fathom=${item.assignee ?? '-'} | ${item.description.slice(0, 100)}`);
  }
}
console.log(`\nkept ${kept}, dropped ${dropped}`);
