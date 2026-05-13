import { config } from 'dotenv';
config({ path: '.env.local' });
const { db } = await import('../../web/lib/queries/base.js');

for (const table of ['case_studies', 'upsell_opportunities', 'referrals', 'outbound_campaigns']) {
  try {
    const r = await db.execute(`SELECT COUNT(*) AS n FROM ${table}`);
    console.log(`${table}: ${r.rows[0].n} rows`);
  } catch (e) {
    console.log(`${table}: ERR (${e instanceof Error ? e.message.slice(0, 80) : ''})`);
  }
}

// Show schema for upsell_opportunities (from Turso, in case it differs from local)
try {
  const r = await db.execute(`SELECT * FROM upsell_opportunities LIMIT 1`);
  console.log('\nupsell_opportunities cols:', r.columns.join(' | '));
} catch {}
