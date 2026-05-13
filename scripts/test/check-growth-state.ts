/**
 * One-shot diagnostic: what's currently in growth_findings, and is the
 * atlas-case-study cron healthy? Plus legacy case_studies table check.
 *
 * Usage: npx tsx scripts/test/check-growth-state.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

const { db } = await import('../../web/lib/queries/base.js');

const counts = await db.execute(
  `SELECT finding_type, status, COUNT(*) AS n FROM growth_findings GROUP BY finding_type, status ORDER BY finding_type, status`,
);
console.log('--- growth_findings counts ---');
if (counts.rows.length === 0) console.log('  (table empty)');
for (const r of counts.rows) console.log(`  ${r.finding_type} | ${r.status} | ${r.n}`);

const cs = await db.execute(
  `SELECT id, severity, subject_label, title, length(description) AS desc_len, last_seen, occurrences
     FROM growth_findings
    WHERE finding_type = 'case-study-candidate'
 ORDER BY last_seen DESC
    LIMIT 10`,
);
console.log('\n--- case-study-candidate rows ---');
console.log(`(${cs.rows.length} total)`);
for (const r of cs.rows) console.log(`  #${r.id} [${r.severity}] ${r.subject_label} — ${r.title} (desc ${r.desc_len} chars, seen ${r.occurrences}×, last ${r.last_seen})`);

const hb = await db.execute(
  `SELECT last_success_at, last_error_at, last_error, last_duration_ms FROM cron_heartbeats WHERE job = 'atlas-case-study'`,
);
console.log('\n--- atlas-case-study heartbeat ---');
if (hb.rows[0]) console.log(`  success: ${hb.rows[0].last_success_at} | err: ${hb.rows[0].last_error_at} | ${hb.rows[0].last_error ?? 'no error'} | ${hb.rows[0].last_duration_ms}ms`);
else console.log('  no heartbeat row yet — cron has never fired');

const runs = await db.execute(
  `SELECT id, status, started_at, ended_at, cost_usd, input_tokens, output_tokens, error
     FROM agent_runs
    WHERE agent = 'atlas-case-study'
 ORDER BY started_at DESC
    LIMIT 5`,
);
console.log('\n--- atlas-case-study agent_runs ---');
console.log(`(${runs.rows.length} runs)`);
for (const r of runs.rows) {
  const id = String(r.id ?? '');
  console.log(`  ${id.slice(0,8)}... ${r.status} | ${r.started_at} | $${r.cost_usd ?? '—'} | err: ${String(r.error ?? '—').slice(0,80)}`);
}

try {
  const cs2 = await db.execute(`SELECT COUNT(*) AS n FROM case_studies`);
  console.log(`\n--- legacy case_studies table: ${cs2.rows[0].n} rows ---`);
} catch (e) {
  console.log('\n--- legacy case_studies table: does not exist');
}
