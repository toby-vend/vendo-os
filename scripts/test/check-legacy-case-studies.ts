import { config } from 'dotenv';
config({ path: '.env.local' });
const { db } = await import('../../web/lib/queries/base.js');

try {
  const r = await db.execute(`SELECT * FROM case_studies LIMIT 5`);
  console.log('--- legacy case_studies cols ---');
  console.log(r.columns.join(' | '));
  for (const row of r.rows) {
    const truncated: Record<string, string> = {};
    for (const c of r.columns) {
      const v = (row as Record<string, unknown>)[c];
      truncated[c] = typeof v === 'string' ? v.slice(0, 80) : String(v ?? '');
    }
    console.log(JSON.stringify(truncated, null, 2));
  }
} catch (e) {
  console.log('error:', e instanceof Error ? e.message : String(e));
}
