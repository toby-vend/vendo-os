/**
 * Shared types for the code-health scanner.
 *
 * `Finding` is the unit of work — produced by both static checks and the
 * per-file LLM review, fingerprinted before write so re-scans dedup
 * cleanly against code_findings. Schema lives in
 * scripts/migrations/2026-05-12-code-findings.ts; keep this file aligned.
 */

export type Severity = 'P0' | 'P1' | 'P2' | 'P3';

export type FindingType =
  | 'bug'
  | 'perf'
  | 'refactor'
  | 'security'
  | 'style'
  | 'dead-code'
  | 'type'
  | 'dependency'
  | 'cron-drift'
  | 'todo';

export type FindingSource =
  | 'static:tsc'
  | 'static:audit'
  | 'static:knip'
  | 'static:gitleaks'
  | 'static:cron-drift'
  | 'static:todo'
  | 'llm:review';

export type FindingStatus = 'open' | 'resolved' | 'noise' | 'wontfix';

/**
 * A single issue produced by any layer of the scan, before persistence.
 * The fingerprint is computed in findings-store.ts; the producer doesn't
 * set it.
 */
export interface Finding {
  file_path: string;
  line_start: number | null;
  line_end: number | null;
  finding_type: FindingType;
  severity: Severity;
  source: FindingSource;
  title: string;
  description: string | null;
  proposed_fix: string | null;
}

export interface FindingRow extends Finding {
  id: number;
  fingerprint: string;
  status: FindingStatus;
  first_seen: string;
  last_seen: string;
  resolved_at: string | null;
  resolved_commit: string | null;
  noise_marked_by: string | null;
  noise_reason: string | null;
  occurrences: number;
}

export interface RunSummary {
  filesScanned: number;
  findingsNew: number;
  findingsPersisting: number;
  findingsResolved: number;
  durationMs: number;
  costUsd: number | null;
  status: 'ok' | 'partial' | 'failed';
  error: string | null;
  topFindings: FindingRow[];
  runId: number | null;
}
