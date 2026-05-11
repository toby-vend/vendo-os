/**
 * AGENT-COORD: STUB — Owned by Agent A3 (Narrative).
 *
 * This file exists in A4's worktree only so `npm run typecheck` passes while
 * A3 builds the real implementation in parallel. The coordinator replaces
 * this file at merge time with A3's branch contents. Do NOT change signatures
 * without coordinating with A3.
 *
 * Contract (per plans/2026-05-11-google-ads-autonomous-reporting.md):
 *   - buildNarrativeContext pulls Asana completions, meeting actions, and
 *     last month's `focus_next_md` for the period, and assembles them into
 *     a markdown draft (`suggested_worked_on_md`).
 *   - saveNarrativeDraft writes that markdown to
 *     `client_reports.narrative_draft_md` so the editor partial can offer it
 *     as a one-click "Use suggestion".
 */
import { db } from '../queries/base.js';

export interface NarrativeContext {
  asana_tasks_completed: Array<{ name: string; completed_at: string; project: string | null }>;
  meeting_actions: Array<{ summary: string; assignee: string | null; meeting_date: string }>;
  last_focus_next_md: string | null;
  suggested_worked_on_md: string;
}

/**
 * STUB — returns an empty context. A3 will replace with the real pull.
 * Callers should treat `suggested_worked_on_md === ''` as "nothing to draft"
 * and skip the saveNarrativeDraft step.
 */
export async function buildNarrativeContext(
  _clientId: number,
  _periodStart: string,
  _periodEnd: string,
): Promise<NarrativeContext> {
  return {
    asana_tasks_completed: [],
    meeting_actions: [],
    last_focus_next_md: null,
    suggested_worked_on_md: '',
  };
}

/**
 * STUB — persists the suggested draft on the report row. A3 may keep this
 * exact body (it's a one-line UPDATE) or replace it; either is fine.
 */
export async function saveNarrativeDraft(reportId: number, draftMd: string): Promise<void> {
  await db.execute({
    sql: `UPDATE client_reports
            SET narrative_draft_md = ?,
                updated_at = datetime('now')
          WHERE id = ?`,
    args: [draftMd, reportId],
  });
}
