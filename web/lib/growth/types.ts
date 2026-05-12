/**
 * Shared types for the growth-agent stack. Schema lives in
 * scripts/migrations/2026-05-13-growth-findings.ts — keep aligned.
 */

export type GrowthSeverity = 'P0' | 'P1' | 'P2' | 'P3';

export type GrowthFindingType =
  | 'churn-risk'
  | 'upsell'
  | 'lead-score'
  | 'profit-alert'
  | 'feature-priority'
  | 'case-study-candidate'
  | 'growth-prescription';

export type GrowthSubjectType = 'client' | 'lead' | 'feature' | 'global';

export type GrowthStatus = 'open' | 'acted' | 'dismissed' | 'stale';

/**
 * The shape an agent produces and `recordGrowthFinding` accepts. The
 * fingerprint is derived in the store — the agent doesn't set it.
 */
export interface GrowthFindingInput {
  agent: string;
  finding_type: GrowthFindingType;
  subject_type: GrowthSubjectType | null;
  subject_id: string | null;
  subject_label: string | null;
  severity: GrowthSeverity;
  title: string;
  description: string | null;
  reasoning: string | null;
  proposed_action: string | null;
  run_id: string | null;
}

export interface GrowthFindingRow extends GrowthFindingInput {
  id: number;
  fingerprint: string;
  status: GrowthStatus;
  occurrences: number;
  first_seen: string;
  last_seen: string;
  acted_at: string | null;
  acted_by: string | null;
  acted_outcome: string | null;
}
