/** Part 2: sample unmatched meetings + run buildNarrativeContext for real reports. */
import { rows } from '../../web/lib/queries/base.js';
import { buildNarrativeContext } from '../../web/lib/reports/narrative-context.js';

async function main() {
  const unmatched = await rows<{ title: string; date: string }>(
    `SELECT title, date FROM meetings
     WHERE (client_name IS NULL OR length(trim(client_name)) = 0)
       AND date >= date('now', '-45 days')
     ORDER BY date DESC LIMIT 25`,
  );
  console.log('--- Unmatched meetings (last 45 days) ---');
  for (const m of unmatched) console.log(`${m.date.slice(0, 10)}  ${m.title}`);

  const reports = await rows<{ id: number; client_id: number; name: string; period_start: string; period_end: string }>(
    `SELECT cr.id, cr.client_id, c.name, cr.period_start, cr.period_end
     FROM client_reports cr JOIN clients c ON c.id = cr.client_id
     WHERE cr.period_start = '2026-05-01'
     ORDER BY cr.updated_at DESC LIMIT 8`,
  );
  console.log('\n--- buildNarrativeContext per report ---');
  for (const r of reports) {
    const ctx = await buildNarrativeContext(r.client_id, r.period_start, r.period_end);
    console.log(
      `report ${r.id} ${r.name}: discussions=${ctx.meeting_discussions.length} ` +
      `actions=${ctx.meeting_actions.length} asana=${ctx.asana_tasks_completed.length}`,
    );
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
