import { config } from 'dotenv';
config({ path: '.env.local' });
import { runAllMonitors } from '../../web/lib/monitors/run-all.js';

const result = await runAllMonitors();
console.log(`Total ${result.totalFlagged} flagged in ${result.durationMs}ms\n`);
console.log('STATUS  MONITOR              CHECKED  FLAGGED  DURATION');
console.log('------  -------------------  -------  -------  --------');
for (const r of result.results) {
  const status = r.error ? '! ERR ' : '  ok  ';
  console.log(`${status}  ${r.name.padEnd(20)} ${String(r.checked).padStart(7)} ${String(r.flagged).padStart(8)}  ${r.durationMs}ms`);
  if (r.error) console.log('        error: ' + r.error.slice(0, 150));
}
