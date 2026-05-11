/**
 * Lead scoring — Turso-native port of scripts/functions/lead-scoring.ts.
 * Wave V / V1. Runs weekly Friday 09:00 UTC via /api/cron/lead-scoring.
 *
 * Scoring (max 100):
 *   Source:     referral 30 · inbound 20 · outbound 10 · unknown 5
 *   Value:      ≥5000 25 · ≥2000 15 · ≥500 10 · else 5
 *   Engagement: 1+ meeting 20 · extra meetings +10/each (cap +20)
 *   Recency:    ≤7d 10 · ≤30d 5 · else 0
 *   Velocity:   stage moved within 14d → +10
 *
 * Writes lead_score, score_breakdown (JSON), scored_at on ghl_opportunities.
 * Idempotent — every call re-scores all open opps.
 */
import { db } from '../queries/base.js';

interface OppRow {
  id: string;
  name: string | null;
  monetary_value: number | null;
  source: string | null;
  contact_name: string | null;
  contact_company: string | null;
  created_at: string | null;
  last_stage_change_at: string | null;
  stage_name: string | null;
}

export interface ScoreBreakdown {
  source: number;
  value: number;
  engagement: number;
  recency: number;
  velocity: number;
  total: number;
}

export interface LeadScoringResult {
  scored: number;
  top: Array<{
    id: string;
    name: string;
    stage: string | null;
    monetaryValue: number;
    score: number;
  }>;
  durationMs: number;
}

function daysBetween(dateStr: string, now: Date): number {
  const d = new Date(dateStr);
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export async function runLeadScoring(): Promise<LeadScoringResult> {
  const start = Date.now();
  const now = new Date();
  const nowIso = now.toISOString();

  const oppsResult = await db.execute(`
    SELECT o.id, o.name, o.monetary_value, o.source,
           o.contact_name, o.contact_company,
           o.created_at, o.last_stage_change_at,
           s.name AS stage_name
    FROM ghl_opportunities o
    LEFT JOIN ghl_stages s ON o.stage_id = s.id
    WHERE o.status = 'open'
  `);
  const opps = oppsResult.rows as unknown as OppRow[];

  const scored: Array<{ opp: OppRow; breakdown: ScoreBreakdown }> = [];

  for (const opp of opps) {
    const breakdown: ScoreBreakdown = {
      source: 0, value: 0, engagement: 0, recency: 0, velocity: 0, total: 0,
    };

    // Source
    const src = (opp.source || '').toLowerCase();
    if (src.includes('referral') || src.includes('partner')) breakdown.source = 30;
    else if (src.includes('inbound') || src.includes('website') || src.includes('form')) breakdown.source = 20;
    else if (src.includes('outbound') || src.includes('cold') || src.includes('email')) breakdown.source = 10;
    else breakdown.source = 5;

    // Value
    const val = opp.monetary_value || 0;
    if (val >= 5000) breakdown.value = 25;
    else if (val >= 2000) breakdown.value = 15;
    else if (val >= 500) breakdown.value = 10;
    else breakdown.value = 5;

    // Engagement (meeting count via name match)
    const contactName = opp.contact_name || opp.contact_company || '';
    if (contactName) {
      const mr = await db.execute({
        sql: `SELECT COUNT(*) AS cnt FROM meetings
              WHERE client_name = ? OR title LIKE ?`,
        args: [contactName, `%${contactName}%`],
      });
      const count = Number(mr.rows[0]?.cnt) || 0;
      if (count >= 1) breakdown.engagement += 20;
      if (count >= 2) breakdown.engagement += Math.min((count - 1) * 10, 20);
    }

    // Recency
    if (opp.created_at) {
      const d = daysBetween(opp.created_at, now);
      if (d <= 7) breakdown.recency = 10;
      else if (d <= 30) breakdown.recency = 5;
    }

    // Velocity
    const stageRef = opp.last_stage_change_at || opp.created_at;
    if (stageRef) {
      if (daysBetween(stageRef, now) <= 14) breakdown.velocity = 10;
    }

    breakdown.total = Math.min(
      breakdown.source + breakdown.value + breakdown.engagement + breakdown.recency + breakdown.velocity,
      100,
    );

    scored.push({ opp, breakdown });
  }

  // Batch the updates
  const CHUNK = 50;
  for (let i = 0; i < scored.length; i += CHUNK) {
    const slice = scored.slice(i, i + CHUNK);
    const stmts = slice.map(({ opp, breakdown }) => ({
      sql: `UPDATE ghl_opportunities
            SET lead_score = ?, score_breakdown = ?, scored_at = ?
            WHERE id = ?`,
      args: [breakdown.total, JSON.stringify(breakdown), nowIso, opp.id] as (string | number | null)[],
    }));
    if (stmts.length > 0) await db.batch(stmts, 'write');
  }

  scored.sort((a, b) => b.breakdown.total - a.breakdown.total);

  return {
    scored: scored.length,
    top: scored.slice(0, 10).map(({ opp, breakdown }) => ({
      id: opp.id,
      name: opp.name || opp.contact_name || '(unnamed)',
      stage: opp.stage_name,
      monetaryValue: opp.monetary_value || 0,
      score: breakdown.total,
    })),
    durationMs: Date.now() - start,
  };
}
