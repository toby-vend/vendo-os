import { config } from 'dotenv';
config({ path: '.env.local' });

import { detectClients, invalidateClientCache } from '../../web/lib/agents/client-detect.js';

const cases = [
  'How is Kana Health Group doing this week?',
  'tell me about Just Smile Dental',
  'what concerns are flagged for Lakewood Dental',
  'compare Kana Health Group vs Just Smile Dental on retention',
  'draft a daily brief about marketing trends',  // expect no match
  'i need to chat about ka',                     // too-short token, expect no match
  "Lee's been asking about Kana again",          // matches "Kana" alias
  'review Diamond Smile work this week',
];

invalidateClientCache();

for (const text of cases) {
  const hits = await detectClients(text);
  if (hits.length === 0) {
    console.log(`[no match]    "${text.slice(0, 60)}"`);
  } else {
    const labels = hits.map((h) => `${h.name} (id=${h.id}, "${h.matched}")`).join(' | ');
    console.log(`[${hits.length} match]      "${text.slice(0, 60)}"  →  ${labels}`);
  }
}
