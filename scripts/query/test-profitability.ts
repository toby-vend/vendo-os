import { config } from 'dotenv';
config({ path: '.env.local' });
import { recomputeClientProfitability } from '../../web/lib/jobs/client-profitability.js';

const result = await recomputeClientProfitability();
console.log('period:', result.period);
console.log('clientsProcessed:', result.clientsProcessed);
console.log('  healthy:', result.healthy);
console.log('  warning:', result.warning);
console.log('  critical:', result.critical);
console.log('upserted:', result.upserted);
console.log('durationMs:', result.durationMs);
if (result.rows.length > 0) {
  console.log('\nTop 3 by margin:');
  const sorted = [...result.rows].sort((a, b) => b.marginPct - a.marginPct).slice(0, 3);
  for (const r of sorted) {
    console.log(`  ${r.clientName.padEnd(40)} £${r.revenue}  ${r.marginPct}% [${r.classification}]`);
  }
  console.log('\nBottom 3 by margin:');
  const worst = [...result.rows].sort((a, b) => a.marginPct - b.marginPct).slice(0, 3);
  for (const r of worst) {
    console.log(`  ${r.clientName.padEnd(40)} £${r.revenue}  ${r.marginPct}% [${r.classification}]${r.rootCause ? '  → ' + r.rootCause : ''}`);
  }
}
