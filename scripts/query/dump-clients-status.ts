import { rows } from '../../web/lib/queries/base.js';
const r = await rows<{ id: number; name: string; display_name: string | null; status: string | null; aliases: string | null }>(
  `SELECT id, name, display_name, status, aliases FROM clients
   WHERE name LIKE '%Smile%' OR name LIKE '%Lakewood%' OR name LIKE '%Kana%'
   ORDER BY name`,
);
for (const c of r) console.log(c);
