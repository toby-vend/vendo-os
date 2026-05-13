/**
 * One-shot backfill: mirror every existing growth_findings row of type
 * 'case-study-candidate' or 'upsell' into its legacy table (case_studies /
 * upsell_opportunities) so the /growth tab UI surfaces them immediately.
 *
 * From now on the recordGrowthFinding tool dual-writes automatically.
 * This script catches the rows that were already in growth_findings
 * before the dual-write went live.
 *
 * Idempotent — uses the same dedup logic (client + last 14d) as the
 * runtime mirror. Safe to re-run.
 *
 * Usage: npx tsx scripts/migrations/2026-05-13-backfill-growth-mirror.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

const { db } = await import('../../web/lib/queries/base.js');
const { mirrorFindingToLegacy } = await import('../../web/lib/growth/legacy-mirror.js');

const r = await db.execute(`
  SELECT agent, finding_type, subject_type, subject_id, subject_label,
         severity, title, description, reasoning, proposed_action, run_id
    FROM growth_findings
   WHERE finding_type IN ('case-study-candidate', 'upsell')
     AND status = 'open'
ORDER BY last_seen ASC
`);

console.log(`Backfilling ${r.rows.length} growth_findings rows into legacy tables…`);

let mirrored = 0;
for (const row of r.rows as unknown as Array<{
  agent: string;
  finding_type: string;
  subject_type: string | null;
  subject_id: string | null;
  subject_label: string | null;
  severity: string;
  title: string;
  description: string | null;
  reasoning: string | null;
  proposed_action: string | null;
  run_id: string | null;
}>) {
  try {
    await mirrorFindingToLegacy({
      agent: row.agent,
      finding_type: row.finding_type as 'case-study-candidate' | 'upsell',
      subject_type: row.subject_type as 'client' | 'lead' | 'feature' | 'global' | null,
      subject_id: row.subject_id,
      subject_label: row.subject_label,
      severity: row.severity as 'P0' | 'P1' | 'P2' | 'P3',
      title: row.title,
      description: row.description,
      reasoning: row.reasoning,
      proposed_action: row.proposed_action,
      run_id: row.run_id,
    });
    console.log(`  ✓ ${row.finding_type} · ${row.subject_label ?? '(no client)'} — ${row.title.slice(0, 60)}`);
    mirrored++;
  } catch (err) {
    console.error(`  ✗ failed for ${row.subject_label}:`, err instanceof Error ? err.message : String(err));
  }
}

console.log(`\nDone — ${mirrored}/${r.rows.length} mirrored.`);

// Show new counts.
const cs = await db.execute(`SELECT COUNT(*) AS n FROM case_studies`);
const up = await db.execute(`SELECT COUNT(*) AS n FROM upsell_opportunities`);
console.log(`case_studies now: ${cs.rows[0].n}`);
console.log(`upsell_opportunities now: ${up.rows[0].n}`);
