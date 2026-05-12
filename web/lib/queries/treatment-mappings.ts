/**
 * Query helpers for the campaign → treatment classification tables:
 *   - client_treatment_mappings  (per-client overrides; tier 1)
 *   - treatment_value_defaults   (vertical-wide avg_case_value lookup)
 *
 * Both tables created by scripts/migrations/2026-05-12-client-report-v2.ts.
 *
 * Used by:
 *   - web/lib/reports/aggregators/treatment.ts (build the treatment block)
 *   - the future admin UI at /admin/clients/:clientId/treatment-mappings
 */
import { rows, scalar, db } from './base.js';

/** `applies_to` values stored on client_treatment_mappings. */
export type AppliesTo = 'meta' | 'google' | 'both';

export interface TreatmentMappingRow {
  id: number;
  client_id: number;
  treatment_name: string;
  /** Stored as a regex pattern string. May be invalid — callers
   *  must wrap `new RegExp(...)` in try/catch. */
  campaign_pattern: string;
  applies_to: AppliesTo;
  /** Override for the treatment's avg case value. NULL → fall through to
   *  treatment_value_defaults. */
  avg_case_value_gbp: number | null;
  /** Lower wins when multiple patterns match the same campaign. */
  priority: number;
  is_active: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * List active mappings for a client, lowest-priority-number first so
 * callers can iterate in match-order without an extra sort.
 */
export async function listMappingsForClient(clientId: number): Promise<TreatmentMappingRow[]> {
  return rows<TreatmentMappingRow>(
    `SELECT id, client_id, treatment_name, campaign_pattern, applies_to,
            avg_case_value_gbp, priority, is_active, created_by,
            created_at, updated_at
       FROM client_treatment_mappings
      WHERE client_id = ?
        AND is_active = 1
      ORDER BY priority ASC, id ASC`,
    [clientId],
  );
}

/**
 * Tier-2 lookup of `treatment_value_defaults` — vertical-wide default
 * for a given (vertical, treatment_name). Returns NULL when no row
 * matches; the caller falls through to the £500 vertical-agnostic
 * fallback.
 */
export async function lookupTreatmentDefault(
  vertical: string,
  treatmentName: string,
): Promise<number | null> {
  const value = await scalar<number>(
    `SELECT avg_case_value_gbp
       FROM treatment_value_defaults
      WHERE vertical = ?
        AND treatment_name = ?`,
    [vertical, treatmentName],
  );
  return value ?? null;
}

/**
 * Vertical-agnostic fallback. Used only when both the per-client
 * override and the vertical-default lookup come back empty. Sets
 * `flags.averageCaseValueIsDefault` on the dashboard payload so the UI
 * can render a "default value" hint.
 */
export const VERTICAL_AGNOSTIC_FALLBACK_GBP = 500;

// ============================================================================
// CRUD helpers — used by the admin UI at /admin/clients/:clientId/treatment-mappings
// ============================================================================

/** Single mapping by ID (no client filter — caller must check ownership). */
export async function getMapping(id: number): Promise<TreatmentMappingRow | null> {
  const result = await rows<TreatmentMappingRow>(
    `SELECT id, client_id, treatment_name, campaign_pattern, applies_to,
            avg_case_value_gbp, priority, is_active, created_by,
            created_at, updated_at
       FROM client_treatment_mappings
      WHERE id = ?`,
    [id],
  );
  return result[0] ?? null;
}

export interface CreateMappingInput {
  clientId: number;
  treatmentName: string;
  campaignPattern: string;
  appliesTo: AppliesTo;
  avgCaseValueGbp: number | null;
  priority: number;
  createdBy: string;
}

/** Insert a new mapping; returns the new row's id. */
export async function createMapping(input: CreateMappingInput): Promise<number> {
  const result = await db.execute({
    sql: `INSERT INTO client_treatment_mappings
            (client_id, treatment_name, campaign_pattern, applies_to,
             avg_case_value_gbp, priority, is_active, created_by)
          VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
    args: [
      input.clientId,
      input.treatmentName,
      input.campaignPattern,
      input.appliesTo,
      input.avgCaseValueGbp,
      input.priority,
      input.createdBy,
    ],
  });
  return Number(result.lastInsertRowid);
}

export interface UpdateMappingFields {
  treatmentName?: string;
  campaignPattern?: string;
  appliesTo?: AppliesTo;
  avgCaseValueGbp?: number | null;
  priority?: number;
  isActive?: boolean;
}

/** Partial update — sets only the supplied fields. Always bumps `updated_at`. */
export async function updateMapping(id: number, fields: UpdateMappingFields): Promise<void> {
  const sets: string[] = [];
  const args: (string | number | null)[] = [];

  if (fields.treatmentName !== undefined) {
    sets.push('treatment_name = ?');
    args.push(fields.treatmentName);
  }
  if (fields.campaignPattern !== undefined) {
    sets.push('campaign_pattern = ?');
    args.push(fields.campaignPattern);
  }
  if (fields.appliesTo !== undefined) {
    sets.push('applies_to = ?');
    args.push(fields.appliesTo);
  }
  if (fields.avgCaseValueGbp !== undefined) {
    sets.push('avg_case_value_gbp = ?');
    args.push(fields.avgCaseValueGbp);
  }
  if (fields.priority !== undefined) {
    sets.push('priority = ?');
    args.push(fields.priority);
  }
  if (fields.isActive !== undefined) {
    sets.push('is_active = ?');
    args.push(fields.isActive ? 1 : 0);
  }

  if (!sets.length) return;
  sets.push(`updated_at = datetime('now')`);
  args.push(id);

  await db.execute({
    sql: `UPDATE client_treatment_mappings SET ${sets.join(', ')} WHERE id = ?`,
    args,
  });
}

/** Hard delete. ON DELETE CASCADE handles dependants if any are added later. */
export async function deleteMapping(id: number): Promise<void> {
  await db.execute({
    sql: `DELETE FROM client_treatment_mappings WHERE id = ?`,
    args: [id],
  });
}

// ============================================================================
// Campaign discovery — used by the "auto-suggest" + "unmapped" sidebar
// ============================================================================

export interface ClientCampaign {
  name: string;
  source: 'meta' | 'google';
  spend: number;
}

/**
 * Distinct campaign names spent against by this client over the last 90
 * days. Joins via `client_source_mappings` exactly like the treatment
 * aggregator does. Returns Meta + Google rows in a single flat list so
 * callers can iterate once.
 *
 * Quiet behaviour: returns [] when the underlying tables are missing
 * (e.g. a fresh dev DB before any sync has run).
 */
export async function listClientCampaigns(clientId: number): Promise<ClientCampaign[]> {
  try {
    const [metaRows, gadsRows] = await Promise.all([
      rows<{ campaign_name: string | null; spend: number | null }>(
        `SELECT mi.campaign_name, SUM(mi.spend) AS spend
           FROM meta_insights mi
           JOIN client_source_mappings csm
             ON mi.account_id = csm.external_id AND csm.source = 'meta'
          WHERE csm.client_id = ?
            AND mi.level = 'campaign'
            AND mi.date >= date('now', '-90 days')
            AND mi.campaign_name IS NOT NULL
          GROUP BY mi.campaign_name
          ORDER BY spend DESC NULLS LAST`,
        [clientId],
      ),
      rows<{ campaign_name: string | null; spend: number | null }>(
        `SELECT gs.campaign_name, SUM(gs.spend) AS spend
           FROM gads_campaign_spend gs
           JOIN client_source_mappings csm
             ON gs.account_id = csm.external_id AND csm.source = 'gads'
          WHERE csm.client_id = ?
            AND gs.date >= date('now', '-90 days')
            AND gs.campaign_name IS NOT NULL
          GROUP BY gs.campaign_name
          ORDER BY spend DESC NULLS LAST`,
        [clientId],
      ),
    ]);

    const out: ClientCampaign[] = [];
    for (const r of metaRows) {
      if (!r.campaign_name) continue;
      out.push({ name: r.campaign_name, source: 'meta', spend: r.spend ?? 0 });
    }
    for (const r of gadsRows) {
      if (!r.campaign_name) continue;
      out.push({ name: r.campaign_name, source: 'google', spend: r.spend ?? 0 });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Bulk insert used by the auto-suggest endpoint. Each input row already
 * carries an explicit `applies_to` and `priority` because the suggester
 * may choose to use 'meta' for Meta-only matches in future — current
 * implementation passes 'both'.
 */
export async function bulkCreateMappings(
  clientId: number,
  newRows: Array<{
    treatmentName: string;
    campaignPattern: string;
    appliesTo: AppliesTo;
    avgCaseValueGbp: number | null;
    priority: number;
  }>,
  createdBy: string,
): Promise<number> {
  if (!newRows.length) return 0;
  let inserted = 0;
  for (const r of newRows) {
    await db.execute({
      sql: `INSERT INTO client_treatment_mappings
              (client_id, treatment_name, campaign_pattern, applies_to,
               avg_case_value_gbp, priority, is_active, created_by)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      args: [
        clientId,
        r.treatmentName,
        r.campaignPattern,
        r.appliesTo,
        r.avgCaseValueGbp,
        r.priority,
        createdBy,
      ],
    });
    inserted++;
  }
  return inserted;
}
