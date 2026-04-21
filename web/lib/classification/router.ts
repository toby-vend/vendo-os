import { db } from '../queries/base.js';
import type { Classification } from './meeting-classifier.js';

/**
 * Routing action coordinator. Owns the meeting_routing_decisions audit
 * table and (in Phase 2) will drive Slack posting + fail-safe DMs.
 */

let _schemaReady = false;

async function ensureRoutingSchema(): Promise<void> {
  if (_schemaReady) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS meeting_routing_decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id TEXT NOT NULL,
      classification TEXT NOT NULL,
      reason TEXT,
      routed_to TEXT,
      manually_rerun_at TEXT,
      created_at TEXT NOT NULL
    )
  `);
  await db.execute(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_mrd_meeting ON meeting_routing_decisions(meeting_id)',
  );
  _schemaReady = true;
}

/**
 * Record a classification + routing action for a meeting. Upsert — the
 * latest classification for a given meeting replaces any prior one so the
 * table always reflects current state.
 */
export async function logRoutingDecision(input: {
  meetingId: string;
  classification: Classification;
  reason: string;
  routedTo: string[];
}): Promise<void> {
  try {
    await ensureRoutingSchema();
    const now = new Date().toISOString();
    await db.execute({
      sql: 'DELETE FROM meeting_routing_decisions WHERE meeting_id = ?',
      args: [input.meetingId],
    });
    await db.execute({
      sql: `INSERT INTO meeting_routing_decisions
              (meeting_id, classification, reason, routed_to, created_at)
            VALUES (?, ?, ?, ?, ?)`,
      args: [
        input.meetingId,
        input.classification,
        input.reason,
        input.routedTo.join(','),
        now,
      ],
    });
  } catch {
    /* non-critical — audit log should never block the webhook */
  }
}

export interface RoutingDecisionRow {
  id: number;
  meeting_id: string;
  classification: Classification;
  reason: string | null;
  routed_to: string | null;
  manually_rerun_at: string | null;
  created_at: string;
  meeting_title: string | null;
  meeting_date: string | null;
  client_name: string | null;
}

export async function getRecentRoutingDecisions(limit = 50): Promise<RoutingDecisionRow[]> {
  try {
    await ensureRoutingSchema();
    const r = await db.execute({
      sql: `SELECT d.id, d.meeting_id, d.classification, d.reason, d.routed_to,
                   d.manually_rerun_at, d.created_at,
                   m.title as meeting_title, m.date as meeting_date, m.client_name
              FROM meeting_routing_decisions d
              LEFT JOIN meetings m ON m.id = d.meeting_id
             ORDER BY d.created_at DESC
             LIMIT ?`,
      args: [limit],
    });
    return r.rows as unknown as RoutingDecisionRow[];
  } catch {
    return [];
  }
}

export interface RoutingCounts {
  director: number;
  slt: number;
  standard: number;
  failsafe: number;
}

export async function getRoutingCounts(sinceIso?: string): Promise<RoutingCounts> {
  try {
    await ensureRoutingSchema();
    const args: string[] = [];
    let where = '';
    if (sinceIso) {
      where = 'WHERE created_at >= ?';
      args.push(sinceIso);
    }
    const r = await db.execute({
      sql: `SELECT classification, COUNT(*) as c
              FROM meeting_routing_decisions ${where}
             GROUP BY classification`,
      args,
    });
    const counts: RoutingCounts = { director: 0, slt: 0, standard: 0, failsafe: 0 };
    for (const row of r.rows) {
      const c = (row.classification as string) || '';
      const n = Number(row.c) || 0;
      if (c === 'DIRECTOR') counts.director = n;
      else if (c === 'SLT') counts.slt = n;
      else if (c === 'STANDARD') counts.standard = n;
      else if (c === 'FAILSAFE') counts.failsafe = n;
    }
    return counts;
  } catch {
    return { director: 0, slt: 0, standard: 0, failsafe: 0 };
  }
}

export async function markRoutingRerun(meetingId: string): Promise<void> {
  try {
    await ensureRoutingSchema();
    await db.execute({
      sql: 'UPDATE meeting_routing_decisions SET manually_rerun_at = ? WHERE meeting_id = ?',
      args: [new Date().toISOString(), meetingId],
    });
  } catch {
    /* ignore */
  }
}

/**
 * Manual override: re-run a meeting's action items through the STANDARD
 * routing path (normal multi-project creation). Used when the classifier
 * mistakenly routed a meeting to DIRECTOR/SLT/FAILSAFE. Idempotent because
 * fathom_asana_synced dedupes on (meeting_id, action_description).
 */
export async function rerunMeetingAsStandard(
  meetingId: string,
): Promise<{ created: number; skipped: number } | null> {
  // Lazy import to avoid a circular dep between router.ts and the sync job.
  const { createTasksForMeeting } = await import('../jobs/sync-actions-to-asana.js');
  const r = await db.execute({
    sql: `SELECT id, title, raw_action_items, client_name, date, url, calendar_invitees
            FROM meetings WHERE id = ? LIMIT 1`,
    args: [meetingId],
  });
  if (!r.rows.length) return null;
  const row = r.rows[0];
  const result = await createTasksForMeeting({
    meetingId: row.id as string,
    title: (row.title as string) || 'Untitled',
    rawActionItems: (row.raw_action_items as string) || null,
    clientName: (row.client_name as string) || null,
    meetingDate: (row.date as string) || null,
    meetingUrl: (row.url as string) || null,
    invitees: (row.calendar_invitees as string) || null,
  });
  await markRoutingRerun(meetingId);
  return result;
}
