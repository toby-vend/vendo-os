/**
 * growth_findings store — upsert-by-fingerprint, list helpers, status
 * transitions.
 *
 * Fingerprint = sha1(agent | finding_type | subject_id | title). A
 * re-run that produces the same logical finding for the same subject
 * bumps occurrences and last_seen rather than inserting a duplicate.
 * Dismissed / acted rows are sticky — re-raises silently bump
 * occurrences but never flip status back to open.
 */
import { createHash } from 'node:crypto';
import { db } from '../queries/base.js';
import type {
  GrowthFindingInput,
  GrowthFindingRow,
  GrowthSeverity,
  GrowthStatus,
} from './types.js';

export function fingerprintOf(f: GrowthFindingInput): string {
  const key = `${f.agent}|${f.finding_type}|${f.subject_id ?? ''}|${f.title}`;
  return createHash('sha1').update(key).digest('hex');
}

export interface UpsertOutcome {
  id: number;
  fingerprint: string;
  status: 'new' | 'persisting' | 'suppressed';
}

/**
 * Upsert a finding. Returns the id + the action taken so the caller (agent
 * tool) can surface what happened.
 *
 * - new        → first time we've seen this fingerprint, status='open'
 * - persisting → existed and was open; last_seen + occurrences bumped
 * - suppressed → existed and was dismissed/acted/stale; only occurrences
 *                bumped, status untouched (the user told us this is noise
 *                or already handled — never re-raise)
 */
export async function upsertGrowthFinding(input: GrowthFindingInput): Promise<UpsertOutcome> {
  const fp = fingerprintOf(input);

  const existing = await db.execute({
    sql: `SELECT id, status FROM growth_findings WHERE fingerprint = ? LIMIT 1`,
    args: [fp],
  });
  const row = existing.rows[0] as unknown as undefined | { id: number; status: GrowthStatus };

  if (!row) {
    const r = await db.execute({
      sql: `INSERT INTO growth_findings
              (fingerprint, agent, finding_type, subject_type, subject_id,
               subject_label, severity, title, description, reasoning,
               proposed_action, run_id, status, occurrences,
               first_seen, last_seen)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', 1,
                    datetime('now'), datetime('now'))`,
      args: [
        fp,
        input.agent,
        input.finding_type,
        input.subject_type,
        input.subject_id,
        input.subject_label,
        input.severity,
        input.title,
        input.description,
        input.reasoning,
        input.proposed_action,
        input.run_id,
      ],
    });
    return { id: Number(r.lastInsertRowid ?? 0), fingerprint: fp, status: 'new' };
  }

  if (row.status !== 'open') {
    // Sticky: only bump occurrences. Never revive an acted/dismissed row.
    await db.execute({
      sql: `UPDATE growth_findings
               SET occurrences = occurrences + 1,
                   last_seen = datetime('now')
             WHERE id = ?`,
      args: [row.id],
    });
    return { id: row.id, fingerprint: fp, status: 'suppressed' };
  }

  // Open + persisting — refresh fields from the latest run.
  await db.execute({
    sql: `UPDATE growth_findings
             SET severity = ?,
                 title = ?,
                 description = ?,
                 reasoning = ?,
                 proposed_action = ?,
                 run_id = ?,
                 subject_label = COALESCE(?, subject_label),
                 last_seen = datetime('now'),
                 occurrences = occurrences + 1
           WHERE id = ?`,
    args: [
      input.severity,
      input.title,
      input.description,
      input.reasoning,
      input.proposed_action,
      input.run_id,
      input.subject_label,
      row.id,
    ],
  });
  return { id: row.id, fingerprint: fp, status: 'persisting' };
}

// ---------------------------------------------------------------------------
// Read helpers — used by /admin/growth.
// ---------------------------------------------------------------------------

export interface ListFilter {
  status?: GrowthStatus;
  severity?: GrowthSeverity;
  agent?: string;
  finding_type?: string;
  limit?: number;
}

export async function listGrowthFindings(filter: ListFilter): Promise<GrowthFindingRow[]> {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (filter.status) {
    where.push('status = ?');
    args.push(filter.status);
  }
  if (filter.severity) {
    where.push('severity = ?');
    args.push(filter.severity);
  }
  if (filter.agent) {
    where.push('agent = ?');
    args.push(filter.agent);
  }
  if (filter.finding_type) {
    where.push('finding_type = ?');
    args.push(filter.finding_type);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = filter.limit ?? 200;
  const r = await db.execute({
    sql: `SELECT * FROM growth_findings
           ${whereSql}
        ORDER BY severity ASC, last_seen DESC
           LIMIT ?`,
    args: [...args, limit],
  });
  return r.rows as unknown as GrowthFindingRow[];
}

export async function getGrowthFinding(id: number): Promise<GrowthFindingRow | null> {
  const r = await db.execute({
    sql: `SELECT * FROM growth_findings WHERE id = ?`,
    args: [id],
  });
  const row = r.rows[0];
  return row ? (row as unknown as GrowthFindingRow) : null;
}

/** Counts grouped by (severity, status) for the dashboard header chips. */
export async function getOpenCountsBySeverity(): Promise<Record<GrowthSeverity, number>> {
  const out: Record<GrowthSeverity, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
  try {
    const r = await db.execute(`
      SELECT severity, COUNT(*) AS n
        FROM growth_findings
       WHERE status = 'open'
    GROUP BY severity
    `);
    for (const row of r.rows as unknown as { severity: GrowthSeverity; n: number }[]) {
      if (row.severity in out) out[row.severity] = Number(row.n);
    }
  } catch {
    // table absent — ignore
  }
  return out;
}

export async function markActed(opts: {
  id: number;
  by: string;
  outcome?: string;
}): Promise<void> {
  await db.execute({
    sql: `UPDATE growth_findings
             SET status = 'acted',
                 acted_at = datetime('now'),
                 acted_by = ?,
                 acted_outcome = ?
           WHERE id = ?`,
    args: [opts.by, opts.outcome ?? null, opts.id],
  });
}

export async function markDismissed(opts: { id: number; by: string }): Promise<void> {
  await db.execute({
    sql: `UPDATE growth_findings
             SET status = 'dismissed',
                 acted_at = datetime('now'),
                 acted_by = ?
           WHERE id = ?`,
    args: [opts.by, opts.id],
  });
}

export async function markStale(opts: { id: number }): Promise<void> {
  await db.execute({
    sql: `UPDATE growth_findings SET status = 'stale' WHERE id = ?`,
    args: [opts.id],
  });
}
