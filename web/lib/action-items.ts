/**
 * Action item extraction — parses a meeting's raw Fathom action items JSON
 * into the `action_items` table.
 *
 * Historically this only happened in scripts/analysis/process-meetings.ts,
 * which runs against the LOCAL sql.js database — so when the team moved to
 * the real-time Fathom webhook (Turso), action item extraction silently
 * stopped (no rows written after mid-March 2026). The webhook now calls this
 * directly, and scripts/sync/backfill-action-items.ts repairs the gap.
 *
 * Idempotent: a (meeting_id, description) pair is only ever inserted once.
 */
import { db } from './queries/base.js';
import { normaliseAssignee } from '../../scripts/matching/team.js';

interface RawActionItem {
  description?: string | null;
  assignee?: { name?: string | null } | null;
  completed?: boolean | null;
}

/**
 * Parse `raw_action_items` JSON and insert any missing rows for the meeting.
 * Returns the number of rows inserted. Malformed JSON is treated as empty.
 */
export async function extractActionItems(
  meetingId: string,
  rawActionItems: string | null,
  meetingDate: string,
): Promise<number> {
  if (!rawActionItems) return 0;

  let items: RawActionItem[];
  try {
    const parsed = JSON.parse(rawActionItems);
    if (!Array.isArray(parsed)) return 0;
    items = parsed as RawActionItem[];
  } catch {
    return 0;
  }

  let inserted = 0;
  for (const item of items) {
    const desc = (item.description || '').trim();
    if (!desc) continue;

    const assigneeName = item.assignee?.name || null;
    const normalised = assigneeName ? normaliseAssignee(assigneeName) : null;

    const result = await db.execute({
      sql: `INSERT INTO action_items (meeting_id, description, assignee, completed, created_at)
            SELECT ?, ?, ?, ?, ?
            WHERE NOT EXISTS (
              SELECT 1 FROM action_items WHERE meeting_id = ? AND description = ?
            )`,
      args: [meetingId, desc, normalised, item.completed ? 1 : 0, meetingDate, meetingId, desc],
    });
    inserted += result.rowsAffected;
  }
  return inserted;
}
