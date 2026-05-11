/**
 * Persistent log of rejected ad-copy generations.
 *
 * Every time a reviewer rejects a generated draft we capture the reason
 * here, scoped to the client. Subsequent generations for the same client
 * read the recent reasons back via getRecentRejectionLessons() and feed
 * them into the LLM prompt under "LESSONS FROM PRIOR REJECTIONS" — every
 * 'no' tightens the next 'yes'.
 *
 * The rejected markdown itself is kept for audit; the prompt only quotes
 * the reason (much shorter signal, no risk of the model re-mining the
 * bad copy for ideas).
 */
import { db, rows } from './base.js';

let schemaEnsured = false;

export async function ensureSchema(): Promise<void> {
  if (schemaEnsured) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS ad_copy_rejections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      review_id INTEGER NOT NULL,
      client_id INTEGER,
      client_name TEXT,
      ad_copy_md TEXT NOT NULL,
      objective TEXT,
      reason TEXT NOT NULL,
      rejected_by TEXT,
      rejected_at TEXT NOT NULL
    )
  `);
  try { await db.execute(`CREATE INDEX IF NOT EXISTS idx_ad_copy_rejections_client ON ad_copy_rejections(client_id, rejected_at)`); } catch { /* exists */ }
  schemaEnsured = true;
}

export interface RecordRejectionInput {
  reviewId: number;
  clientId: number | null;
  clientName: string;
  adCopyMd: string;
  objective: string | null;
  reason: string;
  rejectedBy: string | null;
}

/** Insert a rejection row. Returns the new id. */
export async function recordRejection(input: RecordRejectionInput): Promise<number> {
  await ensureSchema();
  const now = new Date().toISOString();
  const r = await db.execute({
    sql: `INSERT INTO ad_copy_rejections
            (review_id, client_id, client_name, ad_copy_md, objective, reason, rejected_by, rejected_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id`,
    args: [
      input.reviewId,
      input.clientId,
      input.clientName,
      input.adCopyMd,
      input.objective,
      input.reason,
      input.rejectedBy,
      now,
    ],
  });
  return Number((r.rows[0] as unknown as { id: number } | undefined)?.id ?? 0);
}

interface ReasonRow { reason: string }

/**
 * Most recent rejection reasons for this client, newest first.
 * Returns trimmed, single-line versions safe to inline into a prompt.
 * Quietly returns [] if the rejections table doesn't exist yet.
 */
export async function getRecentRejectionLessons(clientId: number | null, limit = 5): Promise<string[]> {
  if (clientId == null) return [];
  try {
    const r = await rows<ReasonRow>(
      `SELECT reason FROM ad_copy_rejections
        WHERE client_id = ?
        ORDER BY rejected_at DESC
        LIMIT ?`,
      [clientId, limit],
    );
    return r
      .map((x) => x.reason.replace(/\s+/g, ' ').trim())
      .filter((s) => s.length > 0);
  } catch {
    return [];
  }
}
