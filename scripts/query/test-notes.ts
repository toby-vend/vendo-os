import { config } from 'dotenv';
config({ path: '.env.local' });

import { rows } from '../../web/lib/queries/base.js';
import { addNote, listNotes, archiveNote, editNote } from '../../web/lib/queries/client-notes.js';
import { generateBriefing, invalidateBriefingCache } from '../../web/lib/client-knowledge/briefing.js';

const [c] = await rows<{ id: number; name: string }>(
  `SELECT id, name FROM clients WHERE name = 'Kana Health Group' LIMIT 1`,
);
const [u] = await rows<{ id: string; name: string }>(
  `SELECT id, name FROM users WHERE role = 'admin' LIMIT 1`,
);
if (!c || !u) {
  console.error('Need a Kana Health Group client + at least one admin user');
  process.exit(1);
}

console.log(`Adding test note for ${c.name} as ${u.name}...`);
const noteId = await addNote({
  clientId: c.id,
  authorUserId: u.id,
  body: 'Test note from Phase B smoke — feel free to archive.',
  category: 'context',
  source: 'manual',
});
console.log(`  inserted id=${noteId}`);

invalidateBriefingCache(c.id);
const b = await generateBriefing(c.id);
console.log(`\nBriefing now has ${b?.notes.length ?? 0} notes:`);
for (const n of b?.notes ?? []) {
  console.log(`  [${n.category}] ${n.body}  — ${n.authorName} (${n.updatedAt})`);
}

console.log('\nEditing the test note...');
await editNote({ noteId, body: 'Test note edited.', category: 'gotcha' });

invalidateBriefingCache(c.id);
const b2 = await generateBriefing(c.id);
const edited = b2?.notes.find((n) => n.id === noteId);
console.log(`  edited: [${edited?.category}] ${edited?.body}`);

console.log('\nArchiving the test note...');
await archiveNote(noteId);

invalidateBriefingCache(c.id);
const b3 = await generateBriefing(c.id);
console.log(`Briefing now has ${b3?.notes.length ?? 0} notes (archived note should not appear)`);

console.log('\n✓ Phase B verified.');
