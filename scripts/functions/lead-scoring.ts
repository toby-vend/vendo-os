/**
 * Lead scoring — calculates and updates scores for all open GHL opportunities.
 *
 * Scoring dimensions (max 100):
 *   Source quality:  referral=30, inbound=20, outbound=10, unknown=5
 *   Monetary value:  >=5000=25, >=2000=15, >=500=10, else=5
 *   Engagement:      discovery meeting=+20, extra meetings=+10 each (max 20)
 *   Recency:         <=7 days=10, <=30 days=5, older=0
 *   Velocity:        stage change in last 14 days=+10
 *
 * Usage:
 *   npx tsx scripts/functions/lead-scoring.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log } from '../utils/db.js';

interface Opportunity {
  id: string;
  name: string;
  monetary_value: number;
  source: string | null;
  contact_name: string | null;
  contact_company: string | null;
  created_at: string;
  last_stage_change_at: string | null;
  stage_name?: string;
}

interface ScoreBreakdown {
  source: number;
  value: number;
  engagement: number;
  recency: number;
  velocity: number;
  total: number;
}

function daysBetween(dateStr: string, now: Date): number {
  const d = new Date(dateStr);
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

async function main() {
  await initSchema();
  const db = await getDb();
  const now = new Date();
  const nowIso = now.toISOString();

  // Fetch open opportunities with stage names
  const result = db.exec(`
    SELECT o.id, o.name, o.monetary_value, o.source, o.contact_name, o.contact_company,
           o.created_at, o.last_stage_change_at, s.name as stage_name
    FROM ghl_opportunities o
    LEFT JOIN ghl_stages s ON o.stage_id = s.id
    WHERE o.status = 'open'
  `);

  if (!result.length) {
    log('LEAD-SCORE', 'No open opportunities found');
    closeDb();
    return;
  }

  const cols = result[0].columns;
  const opps: Opportunity[] = result[0].values.map((row: unknown[]) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((c: string, i: number) => obj[c] = row[i]);
    return obj as unknown as Opportunity;
  });

  log('LEAD-SCORE', `Scoring ${opps.length} open opportunities...`);

  const scored: { opp: Opportunity; breakdown: ScoreBreakdown }[] = [];

  for (const opp of opps) {
    const breakdown: ScoreBreakdown = {
      source: 0, value: 0, engagement: 0, recency: 0, velocity: 0, total: 0,
    };

    // --- Source quality ---
    const src = (opp.source || '').toLowerCase();
    if (src.includes('referral') || src.includes('partner')) breakdown.source = 30;
    else if (src.includes('inbound') || src.includes('website') || src.includes('form')) breakdown.source = 20;
    else if (src.includes('outbound') || src.includes('cold') || src.includes('email')) breakdown.source = 10;
    else breakdown.source = 5;

    // --- Monetary value ---
    const val = opp.monetary_value || 0;
    if (val >= 5000) breakdown.value = 25;
    else if (val >= 2000) breakdown.value = 15;
    else if (val >= 500) breakdown.value = 10;
    else breakdown.value = 5;

    // --- Engagement (Fathom meetings) ---
    const contactName = opp.contact_name || opp.contact_company || '';
    if (contactName) {
      const meetingResult = db.exec(
        `SELECT COUNT(*) as cnt FROM meetings WHERE client_name = ? OR title LIKE ?`,
        [contactName, `%${contactName}%`],
      );
      const meetingCount = meetingResult.length ? (meetingResult[0].values[0][0] as number) : 0;
      if (meetingCount >= 1) breakdown.engagement += 20;
      if (meetingCount >= 2) breakdown.engagement += Math.min((meetingCount - 1) * 10, 20);
    }

    // --- Recency ---
    if (opp.created_at) {
      const daysOld = daysBetween(opp.created_at, now);
      if (daysOld <= 7) breakdown.recency = 10;
      else if (daysOld <= 30) breakdown.recency = 5;
    }

    // --- Velocity (recent stage movement) ---
    const stageRef = opp.last_stage_change_at || opp.created_at;
    if (stageRef) {
      const daysSinceChange = daysBetween(stageRef, now);
      if (daysSinceChange <= 14) breakdown.velocity = 10;
    }

    breakdown.total = Math.min(
      breakdown.source + breakdown.value + breakdown.engagement + breakdown.recency + breakdown.velocity,
      100,
    );

    // Persist score
    db.run(
      'UPDATE ghl_opportunities SET lead_score = ?, score_breakdown = ?, scored_at = ? WHERE id = ?',
      [breakdown.total, JSON.stringify(breakdown), nowIso, opp.id],
    );

    scored.push({ opp, breakdown });
  }

  saveDb();

  // --- Summary ---
  scored.sort((a, b) => b.breakdown.total - a.breakdown.total);

  log('LEAD-SCORE', '\n--- Top 5 Leads ---');
  for (const { opp, breakdown } of scored.slice(0, 5)) {
    const label = opp.name || opp.contact_name || 'Unnamed';
    log('LEAD-SCORE', `  ${breakdown.total}/100  ${label}  (${opp.stage_name || '?'})  £${opp.monetary_value || 0}`);
  }

  const stalled = scored.filter(s => {
    const ref = s.opp.last_stage_change_at || s.opp.created_at;
    return ref && daysBetween(ref, now) > 14 && s.breakdown.total < 30;
  });

  if (stalled.length) {
    log('LEAD-SCORE', `\n--- ${stalled.length} Stalled Lead(s) (>14 days, score <30) ---`);
    for (const { opp, breakdown } of stalled.slice(0, 10)) {
      log('LEAD-SCORE', `  ${breakdown.total}/100  ${opp.name || opp.contact_name || 'Unnamed'}  (stalled)`);
    }
  }

  log('LEAD-SCORE', `\nScored ${scored.length} opportunities`);
  closeDb();
}

main().catch(err => {
  console.error('Lead scoring failed:', err);
  process.exit(1);
});
