import { rows } from '../../web/lib/queries/base.js';
const cs = await rows<{ id: number; name: string }>(
  `SELECT id, name FROM clients WHERE LOWER(vertical) = 'dental' ORDER BY name LIMIT 5`,
);
for (const c of cs) console.log(c.id, c.name);
