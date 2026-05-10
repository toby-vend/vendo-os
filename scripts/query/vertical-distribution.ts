/**
 * One-shot query: distribution of `clients.vertical` values in Turso.
 * Used to refine the text → vertical-slug mapping in push-clients-to-portal.ts.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { rows } from '../../web/lib/queries/base.js';

const result = await rows<{ vertical: string | null; n: number }>(
  `SELECT COALESCE(LOWER(TRIM(vertical)), '(null)') AS vertical, COUNT(*) AS n
   FROM clients
   GROUP BY 1
   ORDER BY n DESC`,
);

console.log(`distinct vertical values: ${result.length}`);
for (const r of result) console.log(`  ${String(r.n).padStart(4)}  ${r.vertical}`);
