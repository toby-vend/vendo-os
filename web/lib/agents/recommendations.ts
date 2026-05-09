/**
 * Agent recommendations — the human-in-the-loop surface.
 *
 * Every write tool, while ungraduated, runs in dry-run mode and produces a
 * recommendation: a structured draft (payload) with reasoning and source
 * links, surfaced to the user as an ApprovalCard. The user approves, edits,
 * or rejects via web/Slack/Telegram.
 *
 * `decide()` updates the recommendation row but does NOT execute the
 * underlying tool — that is the runtime's job. After execute, callers should
 * invoke `markExecuted()` with the tool's result payload.
 *
 * `recordOutcome()` is the 30-day review hook used by the Decision Engine.
 */
import { db } from '../queries/base.js';
import { generateId } from '../auth.js';
import type {
  CreateRecommendationInput,
  DecideRecommendationInput,
  RecommendationRow,
  RecommendationStatus,
  RecordOutcomeInput,
} from './types.js';

// ---------------------------------------------------------------------------
// Create — called from any write tool while in dry-run mode.
// ---------------------------------------------------------------------------

export async function create(input: CreateRecommendationInput): Promise<string> {
  const id = generateId();
  await db.execute({
    sql: `INSERT INTO agent_recommendations
      (id, run_id, agent, user_id, title, reasoning, tool_name, payload, source_links, expires_at, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    args: [
      id,
      input.runId,
      input.agent,
      input.userId,
      input.title,
      input.reasoning,
      input.toolName,
      JSON.stringify(input.payload),
      input.sourceLinks ? JSON.stringify(input.sourceLinks) : null,
      input.expiresAt ?? null,
    ],
  });
  return id;
}

// ---------------------------------------------------------------------------
// Decide — channel callback when the user clicks Approve / Edit / Reject.
// Sets status, decided_by, decided_at, optional edit_diff. Returns the row.
// ---------------------------------------------------------------------------

export async function decide(
  input: DecideRecommendationInput,
): Promise<RecommendationRow | null> {
  const status: RecommendationStatus = input.decision;
  await db.execute({
    sql: `UPDATE agent_recommendations
            SET status = ?,
                decided_by = ?,
                decided_at = datetime('now'),
                edit_diff = ?
          WHERE id = ?
            AND status = 'pending'`,
    args: [
      status,
      input.decidedBy,
      input.editDiff === undefined ? null : JSON.stringify(input.editDiff),
      input.id,
    ],
  });
  return getById(input.id);
}

// ---------------------------------------------------------------------------
// markExecuted — runtime calls this after running the underlying tool in
// execute mode (post-approval). Records executed_at + result payload.
// ---------------------------------------------------------------------------

export async function markExecuted(
  id: string,
  result: unknown,
): Promise<void> {
  await db.execute({
    sql: `UPDATE agent_recommendations
            SET executed_at = datetime('now'),
                execute_result = ?
          WHERE id = ?`,
    args: [JSON.stringify(result), id],
  });
}

// ---------------------------------------------------------------------------
// Read helpers — backing the /inbox page.
// ---------------------------------------------------------------------------

export async function getById(id: string): Promise<RecommendationRow | null> {
  const result = await db.execute({
    sql: `SELECT * FROM agent_recommendations WHERE id = ?`,
    args: [id],
  });
  return (result.rows[0] as unknown as RecommendationRow) ?? null;
}

export async function listForUser(
  userId: string,
  opts: { status?: RecommendationStatus; limit?: number } = {},
): Promise<RecommendationRow[]> {
  const limit = opts.limit ?? 50;
  if (opts.status) {
    const result = await db.execute({
      sql: `SELECT * FROM agent_recommendations
            WHERE user_id = ? AND status = ?
            ORDER BY created_at DESC
            LIMIT ?`,
      args: [userId, opts.status, limit],
    });
    return result.rows as unknown as RecommendationRow[];
  }
  const result = await db.execute({
    sql: `SELECT * FROM agent_recommendations
          WHERE user_id = ?
          ORDER BY created_at DESC
          LIMIT ?`,
    args: [userId, limit],
  });
  return result.rows as unknown as RecommendationRow[];
}

export async function listPendingForInbox(
  userId: string,
  limit = 50,
): Promise<RecommendationRow[]> {
  return listForUser(userId, { status: 'pending', limit });
}

// ---------------------------------------------------------------------------
// Outcome — 30-day review by the Decision Engine. One per recommendation.
// ---------------------------------------------------------------------------

export async function recordOutcome(input: RecordOutcomeInput): Promise<void> {
  await db.execute({
    sql: `INSERT INTO agent_outcomes (id, recommendation_id, outcome, notes, reviewed_by)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(recommendation_id) DO UPDATE SET
            outcome = excluded.outcome,
            notes = excluded.notes,
            reviewed_by = excluded.reviewed_by,
            reviewed_at = datetime('now')`,
    args: [
      generateId(),
      input.recommendationId,
      input.outcome,
      input.notes ?? null,
      input.reviewedBy,
    ],
  });
}

// ---------------------------------------------------------------------------
// Acceptance metrics — used by /decisions/dashboard and the graduation flow.
// Returns rolling acceptance rate over the given window.
// ---------------------------------------------------------------------------

export async function acceptanceRate(opts: {
  agent: string;
  toolName: string;
  windowDays: number;
}): Promise<{ approved: number; total: number; rate: number }> {
  const windowSql = `created_at >= datetime('now', '-' || ? || ' days')`;
  const total = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM agent_recommendations
          WHERE agent = ? AND tool_name = ?
            AND status IN ('approved','rejected','edited')
            AND ${windowSql}`,
    args: [opts.agent, opts.toolName, String(opts.windowDays)],
  });
  const approved = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM agent_recommendations
          WHERE agent = ? AND tool_name = ?
            AND status IN ('approved','edited')
            AND ${windowSql}`,
    args: [opts.agent, opts.toolName, String(opts.windowDays)],
  });
  const totalN = Number(total.rows[0]?.n ?? 0);
  const approvedN = Number(approved.rows[0]?.n ?? 0);
  return {
    approved: approvedN,
    total: totalN,
    rate: totalN === 0 ? 0 : approvedN / totalN,
  };
}
