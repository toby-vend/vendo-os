import { db, rows } from './base.js';

// --- Types ---

export type SuggestionStatus = 'submitted' | 'accepted' | 'rejected' | 'implemented';
export type SuggestionScope = 'page' | 'sitewide';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  attachmentIds?: number[];
}

export interface StructuredOutput {
  title: string;
  scope: SuggestionScope;
  page_url: string | null;
  page_label: string | null;
  problem: string;
  where_in_app: string;
  desired_outcome: string;
  user_journey: string[];
  examples: string;
  acceptance_criteria: string[];
  out_of_scope: string;
  edge_cases: string;
  priority_signal: string;
  attachments: Array<{ url: string; filename: string; content_type: string }>;
}

export interface SuggestionRow {
  id: number;
  submitted_by_user_id: string;
  submitted_by_name: string;
  title: string;
  raw_idea: string;
  chat_transcript: string;
  structured_output: string;
  status: SuggestionStatus;
  priority: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DraftRow {
  session_id: string;
  user_id: string;
  user_name: string;
  scope: SuggestionScope;
  page_url: string | null;
  page_label: string | null;
  transcript: string;
  created_at: string;
  updated_at: string;
}

export interface AttachmentRow {
  id: number;
  suggestion_id: number | null;
  draft_session_id: string | null;
  blob_url: string;
  blob_pathname: string;
  content_type: string;
  size_bytes: number;
  filename: string | null;
  uploaded_at: string;
}

// --- Feature toggle ---

export async function getSuggestionsEnabled(): Promise<boolean> {
  const r = await rows<{ value: string }>(
    `SELECT value FROM app_settings WHERE key = 'suggestions_enabled'`,
  );
  if (!r.length) return true; // default ON
  return r[0].value === 'true';
}

export async function setSuggestionsEnabled(enabled: boolean): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO app_settings (key, value, updated_at) VALUES ('suggestions_enabled', ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    args: [enabled ? 'true' : 'false', now],
  });
}

// --- Drafts ---

export async function createDraft(params: {
  sessionId: string;
  userId: string;
  userName: string;
  scope: SuggestionScope;
  pageUrl: string | null;
  pageLabel: string | null;
}): Promise<void> {
  await db.execute({
    sql: `INSERT INTO suggestion_drafts
          (session_id, user_id, user_name, scope, page_url, page_label, transcript)
          VALUES (?, ?, ?, ?, ?, ?, '[]')`,
    args: [params.sessionId, params.userId, params.userName, params.scope, params.pageUrl, params.pageLabel],
  });
}

export async function getDraft(sessionId: string): Promise<DraftRow | null> {
  const r = await rows<DraftRow>(
    `SELECT * FROM suggestion_drafts WHERE session_id = ?`,
    [sessionId],
  );
  return r[0] ?? null;
}

export async function updateDraftTranscript(sessionId: string, transcript: ChatTurn[]): Promise<void> {
  await db.execute({
    sql: `UPDATE suggestion_drafts SET transcript = ?, updated_at = datetime('now') WHERE session_id = ?`,
    args: [JSON.stringify(transcript), sessionId],
  });
}

export async function deleteDraft(sessionId: string): Promise<void> {
  await db.execute({
    sql: `DELETE FROM suggestion_drafts WHERE session_id = ?`,
    args: [sessionId],
  });
}

/** Purge drafts older than N days (runs via cron). Returns number deleted. */
export async function purgeStaleDrafts(olderThanDays = 7): Promise<number> {
  const result = await db.execute({
    sql: `DELETE FROM suggestion_drafts WHERE updated_at < datetime('now', ?)`,
    args: [`-${olderThanDays} days`],
  });
  return result.rowsAffected ?? 0;
}

/** Purge attachments still tied to a draft that no longer exists. */
export async function purgeOrphanAttachments(): Promise<AttachmentRow[]> {
  // Find orphans first so the caller can delete the underlying blobs.
  const orphans = await rows<AttachmentRow>(
    `SELECT * FROM suggestion_attachments
     WHERE suggestion_id IS NULL
       AND draft_session_id IS NOT NULL
       AND draft_session_id NOT IN (SELECT session_id FROM suggestion_drafts)`,
  );
  if (orphans.length === 0) return [];
  await db.execute({
    sql: `DELETE FROM suggestion_attachments
          WHERE suggestion_id IS NULL
            AND draft_session_id IS NOT NULL
            AND draft_session_id NOT IN (SELECT session_id FROM suggestion_drafts)`,
  });
  return orphans;
}

// --- Attachments ---

export async function saveAttachment(params: {
  draftSessionId: string;
  blobUrl: string;
  blobPathname: string;
  contentType: string;
  sizeBytes: number;
  filename: string | null;
}): Promise<AttachmentRow> {
  const result = await db.execute({
    sql: `INSERT INTO suggestion_attachments
          (draft_session_id, blob_url, blob_pathname, content_type, size_bytes, filename)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      params.draftSessionId,
      params.blobUrl,
      params.blobPathname,
      params.contentType,
      params.sizeBytes,
      params.filename,
    ],
  });
  const id = Number(result.lastInsertRowid ?? 0);
  return {
    id,
    suggestion_id: null,
    draft_session_id: params.draftSessionId,
    blob_url: params.blobUrl,
    blob_pathname: params.blobPathname,
    content_type: params.contentType,
    size_bytes: params.sizeBytes,
    filename: params.filename,
    uploaded_at: new Date().toISOString(),
  };
}

export async function getAttachmentsForDraft(sessionId: string): Promise<AttachmentRow[]> {
  return rows<AttachmentRow>(
    `SELECT * FROM suggestion_attachments WHERE draft_session_id = ? ORDER BY uploaded_at ASC`,
    [sessionId],
  );
}

export async function countAttachmentsForDraft(sessionId: string): Promise<number> {
  const r = await rows<{ c: number }>(
    `SELECT COUNT(*) as c FROM suggestion_attachments WHERE draft_session_id = ?`,
    [sessionId],
  );
  return Number(r[0]?.c ?? 0);
}

export async function deleteAttachment(id: number, sessionId: string): Promise<AttachmentRow | null> {
  // Only allow deleting an attachment that still belongs to the caller's draft.
  const r = await rows<AttachmentRow>(
    `SELECT * FROM suggestion_attachments WHERE id = ? AND draft_session_id = ?`,
    [id, sessionId],
  );
  if (!r[0]) return null;
  await db.execute({
    sql: `DELETE FROM suggestion_attachments WHERE id = ? AND draft_session_id = ?`,
    args: [id, sessionId],
  });
  return r[0];
}

export async function getAttachmentsForSuggestion(suggestionId: number): Promise<AttachmentRow[]> {
  return rows<AttachmentRow>(
    `SELECT * FROM suggestion_attachments WHERE suggestion_id = ? ORDER BY uploaded_at ASC`,
    [suggestionId],
  );
}

/** Move draft attachments onto a freshly-submitted suggestion. */
export async function promoteDraftAttachments(sessionId: string, suggestionId: number): Promise<void> {
  await db.execute({
    sql: `UPDATE suggestion_attachments
          SET suggestion_id = ?, draft_session_id = NULL
          WHERE draft_session_id = ?`,
    args: [suggestionId, sessionId],
  });
}

// --- Suggestions ---

export async function createSuggestion(params: {
  userId: string;
  userName: string;
  title: string;
  rawIdea: string;
  transcript: ChatTurn[];
  structured: StructuredOutput;
}): Promise<number> {
  const result = await db.execute({
    sql: `INSERT INTO suggestions
          (submitted_by_user_id, submitted_by_name, title, raw_idea, chat_transcript, structured_output)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      params.userId,
      params.userName,
      params.title,
      params.rawIdea,
      JSON.stringify(params.transcript),
      JSON.stringify(params.structured),
    ],
  });
  return Number(result.lastInsertRowid ?? 0);
}

export async function getSuggestion(id: number): Promise<SuggestionRow | null> {
  const r = await rows<SuggestionRow>(
    `SELECT * FROM suggestions WHERE id = ?`,
    [id],
  );
  return r[0] ?? null;
}

export interface SuggestionListItem extends SuggestionRow {
  attachment_count: number;
  scope: SuggestionScope;
}

export async function listSuggestions(filters: {
  status?: SuggestionStatus | 'all';
  scope?: SuggestionScope | 'all';
  userId?: string;
  limit?: number;
} = {}): Promise<SuggestionListItem[]> {
  const where: string[] = [];
  const args: (string | number)[] = [];

  if (filters.status && filters.status !== 'all') {
    where.push('s.status = ?');
    args.push(filters.status);
  }
  if (filters.userId) {
    where.push('s.submitted_by_user_id = ?');
    args.push(filters.userId);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = filters.limit ?? 100;

  const results = await rows<SuggestionRow & { attachment_count: number }>(
    `SELECT s.*,
       (SELECT COUNT(*) FROM suggestion_attachments a WHERE a.suggestion_id = s.id) as attachment_count
     FROM suggestions s
     ${whereSql}
     ORDER BY s.created_at DESC
     LIMIT ?`,
    [...args, limit],
  );

  // Post-filter by scope (stored inside structured_output JSON)
  const items: SuggestionListItem[] = results.map(r => {
    let scope: SuggestionScope = 'sitewide';
    try {
      const parsed = JSON.parse(r.structured_output) as StructuredOutput;
      scope = parsed.scope ?? 'sitewide';
    } catch { /* ignore */ }
    return { ...r, attachment_count: Number(r.attachment_count ?? 0), scope };
  });

  if (filters.scope && filters.scope !== 'all') {
    return items.filter(it => it.scope === filters.scope);
  }
  return items;
}

export async function updateSuggestionStatus(params: {
  id: number;
  status: SuggestionStatus;
  reviewerId: string;
  priority?: string | null;
  reviewNotes?: string | null;
}): Promise<void> {
  await db.execute({
    sql: `UPDATE suggestions
          SET status = ?, reviewed_by_user_id = ?, reviewed_at = datetime('now'),
              priority = COALESCE(?, priority),
              review_notes = COALESCE(?, review_notes),
              updated_at = datetime('now')
          WHERE id = ?`,
    args: [
      params.status,
      params.reviewerId,
      params.priority ?? null,
      params.reviewNotes ?? null,
      params.id,
    ],
  });
}
