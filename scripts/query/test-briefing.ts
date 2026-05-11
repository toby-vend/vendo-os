import { config } from 'dotenv';
config({ path: '.env.local' });

import { generateBriefing } from '../../web/lib/client-knowledge/briefing.js';
import { renderBriefingMarkdown } from '../../web/lib/client-knowledge/render.js';
import { rows } from '../../web/lib/queries/base.js';

const targetName = process.argv[2] || 'Kana Health Group';

const [c] = await rows<{ id: number; name: string }>(
  'SELECT id, name FROM clients WHERE name = ? LIMIT 1',
  [targetName],
);
if (!c) {
  console.error(`Client "${targetName}" not found`);
  process.exit(1);
}

console.log(`Resolving briefing for: ${c.name}  (id=${c.id})`);
const b = await generateBriefing(c.id);
if (!b) {
  console.error('No briefing returned');
  process.exit(1);
}

console.log('\n--- structured ---');
console.log('  health:        ', b.health ? `${b.health.score}/100 (${b.health.tier})` : 'none');
console.log('  meetings:      ', b.meta.meetingCount, 'last:', b.meta.lastMeetingDate);
console.log('  open actions:  ', b.activity.openActionItems.length);
console.log('  open asana:    ', b.activity.openTasks.length, 'overdue:', b.activity.overdueTasks.length);
console.log('  meta 30d:      ', b.performance.metaSpend);
console.log('  gads 30d:      ', b.performance.gadsSpend);
console.log('  open opps:     ', b.pipeline.openOpps.length);
console.log('  brand files:   ', b.brand.fileCount);
console.log('  notes:         ', b.notes.length);

console.log('\n--- markdown ---\n');
console.log(renderBriefingMarkdown(b));
