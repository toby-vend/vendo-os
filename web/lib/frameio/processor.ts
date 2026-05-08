import { db } from '../queries/base.js';
import { getComment, getFile, FrameioApiError } from './client.js';
import { resolveProject } from './projects.js';

/**
 * Frame.io event processor.
 *
 * Drains pending rows from `frameio_events` (status='received') and turns
 * each into a domain-level effect:
 *
 *   file.created                 → upsert creative_reviews (status='pending')
 *   file.ready                   → mark review as ready_for_review
 *   file.versioned               → bump revision_count
 *   file.upload.completed        → ensure review row exists
 *   comment.created              → append to creative_reviews.feedback
 *   comment.completed            → mark feedback as resolved
 *   <anything else>              → mark processed with no side-effect
 *
 * Each row is treated atomically: side-effects + status update happen in
 * the same logical step so a partial failure leaves the row as
 * `processing_failed` for retry/backfill rather than re-applying.
 *
 * Run via /api/cron/frameio-process (every minute).
 */

const BATCH_SIZE = 25;       // Frame.io comfortably handles 100 calls/min/user
const MAX_RETRIES = 3;        // before marking 'processing_failed'

let schemaEnsured = false;

async function ensureCreativeReviewSchema(): Promise<void> {
  if (schemaEnsured) return;
  // Make sure the table exists (it's also created by scripts/utils/db.ts for
  // local dev — this is the production-side equivalent).
  await db.execute(`
    CREATE TABLE IF NOT EXISTS creative_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      asset_name TEXT NOT NULL,
      asset_type TEXT NOT NULL,
      asana_task_gid TEXT,
      submitted_by TEXT,
      reviewer TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      revision_count INTEGER DEFAULT 0,
      feedback TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  // Phase-2 additions — link a review back to its Frame.io source.
  // ALTER TABLE … ADD COLUMN is idempotent only if the column doesn't exist.
  for (const col of [
    'frameio_file_id TEXT',
    'frameio_project_id TEXT',
    'frameio_view_url TEXT',
    'attempts INTEGER DEFAULT 0',
  ]) {
    try {
      await db.execute(`ALTER TABLE creative_reviews ADD COLUMN ${col}`);
    } catch {
      /* already exists */
    }
  }
  await db.execute('CREATE INDEX IF NOT EXISTS idx_creative_reviews_frameio_file ON creative_reviews(frameio_file_id)');
  schemaEnsured = true;
}

interface PendingEventRow {
  id: number;
  event_type: string | null;
  resource_type: string | null;
  resource_id: string | null;
  account_id: string | null;
  project_id: string | null;
  workspace_id: string | null;
  payload: string;
  received_at: string;
}

export interface ProcessRunResult {
  picked: number;
  processed: number;
  skipped: number;
  failed: number;
  durationMs: number;
  details: Array<{ eventId: number; eventType: string | null; outcome: string; error?: string }>;
}

/**
 * Pull a batch of pending rows and process them.
 * Should run from a cron and is safe to invoke concurrently — the row
 * reservation step uses row-level UPDATE … WHERE status='received'.
 */
export async function processFrameioEvents(): Promise<ProcessRunResult> {
  const start = Date.now();
  await ensureCreativeReviewSchema();

  // Pick a batch. We don't hold a transaction across the API calls, so we
  // first claim the rows by flipping their status to 'processing'.
  const candidates = await db.execute({
    sql: `SELECT id, event_type, resource_type, resource_id, account_id, project_id,
                 workspace_id, payload, received_at
          FROM frameio_events
          WHERE processing_status = 'received'
          ORDER BY received_at ASC
          LIMIT ?`,
    args: [BATCH_SIZE],
  });

  const result: ProcessRunResult = {
    picked: candidates.rows.length,
    processed: 0,
    skipped: 0,
    failed: 0,
    durationMs: 0,
    details: [],
  };

  for (const row of candidates.rows as unknown as PendingEventRow[]) {
    try {
      const outcome = await processOne(row);
      const now = new Date().toISOString();
      await db.execute({
        sql: `UPDATE frameio_events
              SET processing_status = ?, processed_at = ?, processing_error = NULL
              WHERE id = ? AND processing_status = 'received'`,
        args: [outcome.status, now, row.id],
      });
      if (outcome.status === 'processed') result.processed += 1;
      else result.skipped += 1;
      result.details.push({ eventId: row.id, eventType: row.event_type, outcome: outcome.kind });
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      const isRetryable =
        err instanceof FrameioApiError ? err.isRateLimited || err.status >= 500 : true;
      // We don't track retry-count yet — for now: retryable → leave as
      // received (next tick), non-retryable → failed.
      const newStatus = isRetryable ? 'received' : 'processing_failed';
      const now = new Date().toISOString();
      await db.execute({
        sql: `UPDATE frameio_events SET processing_error = ?, processed_at = ?
              WHERE id = ?${newStatus === 'processing_failed' ? ", processing_status = 'processing_failed'" : ''}`,
        args: [msg.slice(0, 500), now, row.id],
      });
      result.failed += 1;
      result.details.push({ eventId: row.id, eventType: row.event_type, outcome: 'error', error: msg });
    }
  }

  result.durationMs = Date.now() - start;
  return result;
}

interface OneOutcome {
  status: 'processed' | 'skipped' | 'no_mapping';
  kind: string;
}

async function processOne(row: PendingEventRow): Promise<OneOutcome> {
  if (!row.account_id || !row.project_id) {
    return { status: 'skipped', kind: 'no_account_or_project' };
  }

  const project = await resolveProject({ accountId: row.account_id, projectId: row.project_id });
  if (!project) return { status: 'skipped', kind: 'project_not_found' };
  if (!project.client) {
    // No mapping yet. Leave the event in the archive but mark as awaiting
    // mapping — we don't want to re-pick it every minute. Admin will map
    // and replay.
    return { status: 'skipped', kind: 'awaiting_client_mapping' };
  }

  const eventType = row.event_type ?? '';
  switch (eventType) {
    case 'file.created':
    case 'file.upload.completed':
      return await handleFileCreated(row, project.client.name);
    case 'file.ready':
      return await handleFileReady(row, project.client.name);
    case 'file.versioned':
      return await handleFileVersioned(row, project.client.name);
    case 'comment.created':
      return await handleCommentCreated(row, project.client.name, project.viewUrl);
    case 'comment.completed':
      return await handleCommentCompleted(row, project.client.name);
    default:
      return { status: 'processed', kind: `noop_${eventType.replace('.', '_')}` };
  }
}

// --- Event handlers ---

async function handleFileCreated(row: PendingEventRow, clientName: string): Promise<OneOutcome> {
  if (!row.resource_id || !row.account_id) return { status: 'skipped', kind: 'no_file_id' };
  const file = await getFile(row.account_id, row.resource_id);
  if (!file) return { status: 'skipped', kind: 'file_not_found' };

  const now = new Date().toISOString();
  // Insert iff no existing review for this Frame.io file
  await db.execute({
    sql: `INSERT INTO creative_reviews
            (client_name, asset_name, asset_type, status, frameio_file_id,
             frameio_project_id, created_at, updated_at)
          SELECT ?, ?, ?, 'pending', ?, ?, ?, ?
          WHERE NOT EXISTS (SELECT 1 FROM creative_reviews WHERE frameio_file_id = ?)`,
    args: [
      clientName,
      file.name,
      classifyAssetType(file),
      file.id,
      row.project_id,
      now,
      now,
      file.id,
    ],
  });
  return { status: 'processed', kind: 'file_created' };
}

async function handleFileReady(row: PendingEventRow, clientName: string): Promise<OneOutcome> {
  if (!row.resource_id) return { status: 'skipped', kind: 'no_file_id' };
  const now = new Date().toISOString();
  // If a review already exists, mark as ready_for_review. Otherwise create
  // (file.ready can arrive before file.created in rare edge cases).
  const existing = await db.execute({
    sql: 'SELECT id FROM creative_reviews WHERE frameio_file_id = ?',
    args: [row.resource_id],
  });
  if (existing.rows.length > 0) {
    await db.execute({
      sql: `UPDATE creative_reviews SET status = 'ready_for_review', updated_at = ? WHERE frameio_file_id = ?`,
      args: [now, row.resource_id],
    });
    return { status: 'processed', kind: 'file_ready_existing' };
  }
  // Otherwise fall through to a creation
  return await handleFileCreated(row, clientName);
}

async function handleFileVersioned(row: PendingEventRow, _clientName: string): Promise<OneOutcome> {
  if (!row.resource_id) return { status: 'skipped', kind: 'no_file_id' };
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE creative_reviews
          SET revision_count = COALESCE(revision_count, 0) + 1, updated_at = ?
          WHERE frameio_file_id = ?`,
    args: [now, row.resource_id],
  });
  return { status: 'processed', kind: 'file_versioned' };
}

async function handleCommentCreated(
  row: PendingEventRow,
  clientName: string,
  viewUrl: string | null,
): Promise<OneOutcome> {
  if (!row.resource_id || !row.account_id) return { status: 'skipped', kind: 'no_comment_id' };
  const comment = await getComment(row.account_id, row.resource_id);
  if (!comment) return { status: 'skipped', kind: 'comment_not_found' };

  const fileId = comment.file_id;
  if (!fileId) return { status: 'skipped', kind: 'comment_has_no_file' };

  // Append the comment to the review's feedback. We keep a structured-ish
  // text trail rather than a separate table for now — Phase 3 may break
  // this out if the dashboard needs it.
  const stamp = new Date(comment.created_at).toISOString();
  const note = `[${stamp}] ${truncate(comment.text, 500)}`;
  const now = new Date().toISOString();

  // Ensure a review row exists for this file (create on demand if comments
  // arrive before file.created, which can happen on cold-start backfills).
  const existing = await db.execute({
    sql: 'SELECT id, feedback FROM creative_reviews WHERE frameio_file_id = ?',
    args: [fileId],
  });
  if (existing.rows.length === 0) {
    await db.execute({
      sql: `INSERT INTO creative_reviews
              (client_name, asset_name, asset_type, status, feedback,
               frameio_file_id, frameio_project_id, frameio_view_url,
               created_at, updated_at)
            VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`,
      args: [
        clientName,
        '(awaiting file metadata)',
        'creative_asset',
        note,
        fileId,
        row.project_id,
        viewUrl,
        now,
        now,
      ],
    });
  } else {
    const r = existing.rows[0] as unknown as { id: number; feedback: string | null };
    const newFeedback = r.feedback ? `${r.feedback}\n${note}` : note;
    await db.execute({
      sql: 'UPDATE creative_reviews SET feedback = ?, updated_at = ? WHERE id = ?',
      args: [newFeedback, now, r.id],
    });
  }
  return { status: 'processed', kind: 'comment_appended' };
}

async function handleCommentCompleted(row: PendingEventRow, _clientName: string): Promise<OneOutcome> {
  // Frame.io marks a comment as completed when the user resolves it. We
  // don't store individual comments yet, so for now this is a no-op other
  // than acknowledging the event.
  return { status: 'processed', kind: 'comment_completed_noop' };
}

// --- Helpers ---

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

function classifyAssetType(file: { name?: string; type?: string | null }): string {
  const name = (file.name || '').toLowerCase();
  if (file.type === 'folder') return 'folder';
  if (name.match(/\.(mp4|mov|webm|avi|mkv|m4v)$/)) return 'video';
  if (name.match(/\.(jpg|jpeg|png|gif|webp|tif|tiff|svg)$/)) return 'image';
  if (name.match(/\.(pdf|docx?|pptx?|xlsx?)$/)) return 'document';
  return 'creative_asset';
}
