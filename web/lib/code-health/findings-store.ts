/**
 * Findings store — upsert-by-fingerprint persistence layer for code_findings.
 *
 * Fingerprint = sha1(file_path | line_start | finding_type | title).
 *
 * Two write paths:
 *   - `upsertFindings(findings)` — for the active scan results. Inserts
 *     new fingerprints, bumps `last_seen` and `occurrences` on existing
 *     open rows, and revives `resolved` rows (sets status back to 'open').
 *     'noise' and 'wontfix' rows are never re-raised — that's the whole
 *     point of those statuses.
 *
 *   - `resolveStaleFindings(asOf, source, commitSha)` — for findings that
 *     were open before this run but didn't appear in it. They get
 *     `status='resolved'`, `resolved_at=asOf`, `resolved_commit=commitSha`.
 *     Scoped by `source` so a partial scan (e.g. only the static layer
 *     ran, LLM layer skipped) doesn't auto-resolve every LLM finding.
 *
 * Re-raised noise rows are silently kept noisy — the fingerprint match
 * means the row exists but its status stays 'noise', so it never lands
 * in any digest again.
 */
import { createHash } from 'node:crypto';
import { db } from '../queries/base.js';
import type { Finding, FindingRow, FindingSource } from './types.js';

/**
 * Stable fingerprint for a Finding. Insensitive to line shifts inside a
 * file would be ideal, but coupling to `line_start` keeps the contract
 * deterministic — moving an issue by 3 lines re-raises it once and
 * stays put afterwards. Worth the small noise for the schema simplicity.
 */
export function fingerprint(f: Finding): string {
  const key = `${f.file_path}|${f.line_start ?? ''}|${f.finding_type}|${f.title}`;
  return createHash('sha1').update(key).digest('hex');
}

export interface UpsertResult {
  newCount: number;
  persistingCount: number;
  ignoredNoise: number;
}

/**
 * Upsert the active scan results. Returns counts for the run summary.
 */
export async function upsertFindings(findings: Finding[]): Promise<UpsertResult> {
  let newCount = 0;
  let persistingCount = 0;
  let ignoredNoise = 0;

  for (const f of findings) {
    const fp = fingerprint(f);

    // Check existing row by fingerprint. We do this read-then-write
    // rather than a single ON CONFLICT because we need to differentiate
    // (new) vs (persisting) vs (noise-suppressed) for the run summary,
    // and we want different write SQL per case.
    const r = await db.execute({
      sql: `SELECT id, status FROM code_findings WHERE fingerprint = ? LIMIT 1`,
      args: [fp],
    });
    const existing = r.rows[0] as unknown as undefined | { id: number; status: string };

    if (!existing) {
      await db.execute({
        sql: `INSERT INTO code_findings
                (fingerprint, file_path, line_start, line_end, finding_type,
                 severity, source, title, description, proposed_fix, status,
                 first_seen, last_seen, occurrences)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open',
                      datetime('now'), datetime('now'), 1)`,
        args: [
          fp,
          f.file_path,
          f.line_start,
          f.line_end,
          f.finding_type,
          f.severity,
          f.source,
          f.title,
          f.description,
          f.proposed_fix,
        ],
      });
      newCount++;
      continue;
    }

    if (existing.status === 'noise' || existing.status === 'wontfix') {
      // Silently bump occurrences so we have a trail of how often the
      // model re-raises this, but never flip status back to open.
      await db.execute({
        sql: `UPDATE code_findings
                 SET occurrences = occurrences + 1,
                     last_seen = datetime('now')
               WHERE id = ?`,
        args: [existing.id],
      });
      ignoredNoise++;
      continue;
    }

    // status is 'open' or 'resolved' — bump last_seen + occurrences, and
    // revive if it had been auto-resolved. Severity / description /
    // proposed_fix are updated from the freshest run.
    await db.execute({
      sql: `UPDATE code_findings
               SET status = 'open',
                   resolved_at = NULL,
                   resolved_commit = NULL,
                   last_seen = datetime('now'),
                   occurrences = occurrences + 1,
                   line_start = ?,
                   line_end = ?,
                   severity = ?,
                   description = ?,
                   proposed_fix = ?
             WHERE id = ?`,
      args: [
        f.line_start,
        f.line_end,
        f.severity,
        f.description,
        f.proposed_fix,
        existing.id,
      ],
    });
    persistingCount++;
  }

  return { newCount, persistingCount, ignoredNoise };
}

/**
 * Flip open findings that pre-date `asOfIso` and have `source` in
 * `sourcesRun` to 'resolved'. Returns the count.
 *
 * `sourcesRun` matters because a partial scan (LLM layer skipped on cost
 * cap, for instance) shouldn't auto-resolve every LLM-flagged finding
 * just because they didn't reappear.
 */
export async function resolveStaleFindings(opts: {
  asOfIso: string;
  sourcesRun: FindingSource[];
  commitSha: string | null;
}): Promise<number> {
  if (opts.sourcesRun.length === 0) return 0;
  // SQLite IN (?, ?, ?) bind list — build placeholders explicitly.
  const placeholders = opts.sourcesRun.map(() => '?').join(',');
  const r = await db.execute({
    sql: `UPDATE code_findings
             SET status = 'resolved',
                 resolved_at = datetime('now'),
                 resolved_commit = ?
           WHERE status = 'open'
             AND source IN (${placeholders})
             AND last_seen < ?`,
    args: [opts.commitSha, ...opts.sourcesRun, opts.asOfIso],
  });
  return Number(r.rowsAffected ?? 0);
}

/**
 * Insert a code_health_runs row and return its id, used by the cron
 * handler to write back the summary at the end of a run.
 */
export async function startRunRow(trigger: string): Promise<number> {
  const r = await db.execute({
    sql: `INSERT INTO code_health_runs (trigger, status) VALUES (?, 'ok')`,
    args: [trigger],
  });
  return Number(r.lastInsertRowid ?? 0);
}

export async function finishRunRow(opts: {
  id: number;
  filesScanned: number;
  findingsNew: number;
  findingsPersisting: number;
  findingsResolved: number;
  durationMs: number;
  costUsd: number | null;
  status: 'ok' | 'partial' | 'failed';
  error: string | null;
}): Promise<void> {
  await db.execute({
    sql: `UPDATE code_health_runs
             SET files_scanned = ?,
                 findings_new = ?,
                 findings_persisting = ?,
                 findings_resolved = ?,
                 duration_ms = ?,
                 cost_usd = ?,
                 status = ?,
                 error = ?
           WHERE id = ?`,
    args: [
      opts.filesScanned,
      opts.findingsNew,
      opts.findingsPersisting,
      opts.findingsResolved,
      opts.durationMs,
      opts.costUsd,
      opts.status,
      opts.error,
      opts.id,
    ],
  });
}

/**
 * Read the top N open findings for the digest. Severity asc puts P0
 * first (string sort works because P0 < P1 < P2 < P3 lexically).
 */
export async function getTopOpenFindings(limit: number): Promise<FindingRow[]> {
  const r = await db.execute({
    sql: `SELECT * FROM code_findings
           WHERE status = 'open'
        ORDER BY severity ASC, last_seen DESC
           LIMIT ?`,
    args: [limit],
  });
  return r.rows as unknown as FindingRow[];
}
