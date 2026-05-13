/**
 * Mirror agent-produced growth findings into the legacy growth-tab tables.
 *
 * The team uses /growth (top-level) with tabs for Case Studies, Upsells,
 * Referrals, etc. Each tab reads from a dedicated legacy table
 * (case_studies, upsell_opportunities, …). When my agents write to
 * growth_findings, this module also writes a row into the matching
 * legacy table so the team's existing UI surfaces the new content
 * without changing how they work.
 *
 * Strategy: best-effort, dedup-by-(client + recency). Each mirror
 * checks for an open row for the same client from the last 7 days; if
 * present, the existing row is refreshed (draft / signal / action),
 * otherwise a new row is inserted with status='identified'.
 *
 * Failures here never abort the parent recordGrowthFinding call — the
 * primary write to growth_findings is authoritative. We log and move on.
 */
import { db } from '../queries/base.js';
import type { GrowthFindingInput } from './types.js';

/**
 * Dispatch a growth finding to its legacy table, if one applies.
 *
 *   case-study-candidate → case_studies
 *   upsell               → upsell_opportunities
 *
 * No-op for other finding types.
 */
export async function mirrorFindingToLegacy(input: GrowthFindingInput): Promise<void> {
  try {
    if (input.finding_type === 'case-study-candidate') {
      await mirrorCaseStudy(input);
    } else if (input.finding_type === 'upsell') {
      await mirrorUpsell(input);
    }
  } catch (err) {
    console.warn(
      `[growth/legacy-mirror] mirror failed for ${input.finding_type}:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

// ---------------------------------------------------------------------------
// case_studies — fields: id, client_name, win_type, metric_highlight,
// client_approved, anonymous, draft, status, distribution, published_at,
// created_at, updated_at
// ---------------------------------------------------------------------------

async function mirrorCaseStudy(input: GrowthFindingInput): Promise<void> {
  const client = (input.subject_label ?? '').trim();
  if (!client) return; // no client to attach to

  // Refresh an existing open row for this client from the last 14 days,
  // otherwise insert. Skip if a row is already 'published' / 'archived'
  // — manual lifecycle wins.
  const existing = await db.execute({
    sql: `SELECT id, status FROM case_studies
           WHERE client_name = ?
             AND created_at >= datetime('now', '-14 days')
        ORDER BY id DESC
           LIMIT 1`,
    args: [client],
  });
  const row = existing.rows[0] as unknown as { id: number; status: string } | undefined;

  // Derive minimal fields the legacy tab expects.
  // win_type: pick first word of finding title that looks like a category,
  //   falling back to the agent's generic type.
  const winType = deriveWinType(input.title);
  // metric_highlight: the headline of the title (≤120 chars).
  const metricHighlight = input.title.slice(0, 120);
  // draft: the agent's description IS the case-study draft.
  const draft = input.description ?? '';

  if (row && row.status !== 'published' && row.status !== 'archived') {
    await db.execute({
      sql: `UPDATE case_studies
               SET win_type = ?,
                   metric_highlight = ?,
                   draft = ?,
                   status = CASE WHEN status IN ('identified', 'drafted') THEN 'drafted' ELSE status END,
                   updated_at = datetime('now')
             WHERE id = ?`,
      args: [winType, metricHighlight, draft, row.id],
    });
    return;
  }

  if (row && (row.status === 'published' || row.status === 'archived')) {
    // Don't disturb the manual lifecycle. The agent finding is the
    // authoritative new draft; the legacy row is the team's published
    // record. Leave it.
    return;
  }

  // No existing row — insert a fresh one.
  await db.execute({
    sql: `INSERT INTO case_studies
            (client_name, win_type, metric_highlight, draft, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'drafted', datetime('now'), datetime('now'))`,
    args: [client, winType, metricHighlight, draft],
  });
}

// ---------------------------------------------------------------------------
// upsell_opportunities — fields: id, client_name, trigger_type, signal,
// confidence, recommended_action, status, outcome, created_at, updated_at
// ---------------------------------------------------------------------------

async function mirrorUpsell(input: GrowthFindingInput): Promise<void> {
  const client = (input.subject_label ?? '').trim();
  if (!client) return;

  const existing = await db.execute({
    sql: `SELECT id, status FROM upsell_opportunities
           WHERE client_name = ?
             AND created_at >= datetime('now', '-14 days')
        ORDER BY id DESC
           LIMIT 1`,
    args: [client],
  });
  const row = existing.rows[0] as unknown as { id: number; status: string } | undefined;

  const triggerType = deriveTriggerType(input.title, input.severity);
  const signal = `${input.title}\n\n${input.description ?? ''}`.trim();
  const recommendedAction = input.proposed_action ?? '';
  // Map our P0-P3 severity to a 0-1 confidence rough cut.
  const confidence =
    input.severity === 'P0' ? 0.95
      : input.severity === 'P1' ? 0.8
      : input.severity === 'P2' ? 0.6
      : 0.4;

  if (row && row.status !== 'won' && row.status !== 'lost' && row.status !== 'archived') {
    await db.execute({
      sql: `UPDATE upsell_opportunities
               SET trigger_type = ?,
                   signal = ?,
                   confidence = ?,
                   recommended_action = ?,
                   updated_at = datetime('now')
             WHERE id = ?`,
      args: [triggerType, signal, confidence, recommendedAction, row.id],
    });
    return;
  }

  if (row && (row.status === 'won' || row.status === 'lost' || row.status === 'archived')) {
    return; // closed lifecycle — don't disturb
  }

  await db.execute({
    sql: `INSERT INTO upsell_opportunities
            (client_name, trigger_type, signal, confidence, recommended_action,
             status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 'identified', datetime('now'), datetime('now'))`,
    args: [client, triggerType, signal, confidence, recommendedAction],
  });
}

// ---------------------------------------------------------------------------
// Helpers — pick a sensible "type" for the legacy tab from the agent's
// title. The legacy schema uses free-text strings for these category
// fields, so we don't have to map to a fixed enum.
// ---------------------------------------------------------------------------

function deriveWinType(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('roas')) return 'roas_lift';
  if (t.includes('cpc') || t.includes('cpl') || t.includes('cost-per')) return 'cost_efficiency';
  if (t.includes('lead volume') || t.includes('leads')) return 'lead_growth';
  if (t.includes('organic') || t.includes('seo')) return 'organic_growth';
  if (t.includes('spend')) return 'spend_growth';
  if (t.includes('booking') || t.includes('booked')) return 'booking_growth';
  return 'agent_detected';
}

function deriveTriggerType(title: string, severity: string): string {
  const t = title.toLowerCase();
  if (t.includes('tier up') || t.includes('tier-up')) return 'tier_up';
  if (t.includes('add ') || t.includes('expand') || t.includes('extend')) return 'service_expansion';
  if (t.includes('tiktok') || t.includes('linkedin') || t.includes('youtube')) return 'new_channel';
  if (t.includes('budget')) return 'budget_increase';
  return severity === 'P0' || severity === 'P1' ? 'strong_signal' : 'agent_detected';
}
