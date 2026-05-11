import { config } from 'dotenv';
config({ path: '.env.local' });

import { rows } from '../../web/lib/queries/base.js';
import { insertChunk, searchSimilar } from '../../web/lib/agents/memory/long-term.js';

const both = await rows<{ id: number; name: string }>(
  `SELECT id, name FROM clients WHERE LOWER(vertical) = 'dental' ORDER BY id LIMIT 2`,
);
const [c1, c2] = both;
if (!c1 || !c2) { console.error('Need at least 2 dental clients'); process.exit(1); }
console.log(`Using ${c1.name} (id=${c1.id}) and ${c2.name} (id=${c2.id})`);

console.log(`Inserting tagged chunks...`);
await insertChunk({
  scope: 'meeting',
  scope_id: `smoke-${c1.id}-pricing`,
  content: `${c1.name}: discussed pricing tier upgrade in March quarterly review.`,
  metadata: { clientName: c1.name },
  clientId: c1.id,
});
await insertChunk({
  scope: 'meeting',
  scope_id: `smoke-${c2.id}-pricing`,
  content: `${c2.name}: discussed pricing renegotiation given new competitor.`,
  metadata: { clientName: c2.name },
  clientId: c2.id,
});
console.log('  inserted 2 chunks');

console.log(`\nCross-client search for "pricing":`);
const all = await searchSimilar({ query: 'pricing', limit: 4 });
for (const h of all) console.log(`  [client_id=?] ${h.scope_id}  sim=${(1 - h.distance).toFixed(3)}`);

console.log(`\nClient-scoped search for "pricing" (clientId=${c1.id}, ${c1.name}):`);
const scoped = await searchSimilar({ query: 'pricing', limit: 4, clientId: c1.id });
for (const h of scoped) console.log(`  ${h.scope_id}  sim=${(1 - h.distance).toFixed(3)}`);
const leak = scoped.some((h) => h.scope_id.startsWith(`smoke-${c2.id}-`));
console.log(leak ? '  ✗ LEAK: returned other client\'s chunk' : `  ✓ no cross-tenant leak`);

console.log(`\nCleanup: deleting smoke chunks`);
await rows(`DELETE FROM agent_memory_chunks WHERE scope_id LIKE 'smoke-%'`);
console.log('  done');
