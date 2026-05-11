/**
 * client_notes queries. Notes are free-text "tribal knowledge" per client,
 * authored by staff. Soft-delete via `archived_at`. See migration
 * scripts/migrations/2026-05-12-client-notes.ts.
 */
import { rows, db } from './base.js';

export type NoteCategory = 'context' | 'gotcha' | 'preference' | 'history' | 'todo';

export const NOTE_CATEGORIES: readonly NoteCategory[] = [
  'context',
  'gotcha',
  'preference',
  'history',
  'todo',
] as const;

export interface ClientNoteRow {
  id: number;
  client_id: number;
  author_user_id: string;
  author_name: string | null;
  body: string;
  category: NoteCategory;
  source: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function listNotes(clientId: number): Promise<ClientNoteRow[]> {
  return rows<ClientNoteRow>(
    `SELECT cn.id, cn.client_id, cn.author_user_id,
            u.name AS author_name,
            cn.body, cn.category, cn.source, cn.archived_at,
            cn.created_at, cn.updated_at
     FROM client_notes cn
     LEFT JOIN users u ON u.id = cn.author_user_id
     WHERE cn.client_id = ? AND cn.archived_at IS NULL
     ORDER BY cn.updated_at DESC`,
    [clientId],
  );
}

export async function getNote(noteId: number): Promise<ClientNoteRow | null> {
  const result = await rows<ClientNoteRow>(
    `SELECT cn.id, cn.client_id, cn.author_user_id,
            u.name AS author_name,
            cn.body, cn.category, cn.source, cn.archived_at,
            cn.created_at, cn.updated_at
     FROM client_notes cn
     LEFT JOIN users u ON u.id = cn.author_user_id
     WHERE cn.id = ?`,
    [noteId],
  );
  return result[0] ?? null;
}

export async function addNote(input: {
  clientId: number;
  authorUserId: string;
  body: string;
  category?: NoteCategory;
  source?: string;
}): Promise<number> {
  const now = new Date().toISOString();
  const category = input.category ?? 'context';
  const source = input.source ?? 'manual';

  const result = await db.execute({
    sql: `INSERT INTO client_notes
          (client_id, author_user_id, body, category, source, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          RETURNING id`,
    args: [input.clientId, input.authorUserId, input.body, category, source, now, now],
  });

  const row = result.rows[0];
  return Number(row?.id ?? 0);
}

export async function editNote(input: {
  noteId: number;
  body?: string;
  category?: NoteCategory;
}): Promise<void> {
  const sets: string[] = ['updated_at = ?'];
  const args: (string | number)[] = [new Date().toISOString()];
  if (input.body !== undefined) {
    sets.push('body = ?');
    args.push(input.body);
  }
  if (input.category !== undefined) {
    sets.push('category = ?');
    args.push(input.category);
  }
  args.push(input.noteId);
  await db.execute({
    sql: `UPDATE client_notes SET ${sets.join(', ')} WHERE id = ?`,
    args,
  });
}

export async function archiveNote(noteId: number): Promise<void> {
  await db.execute({
    sql: `UPDATE client_notes SET archived_at = ?, updated_at = ? WHERE id = ?`,
    args: [new Date().toISOString(), new Date().toISOString(), noteId],
  });
}

export async function unarchiveNote(noteId: number): Promise<void> {
  await db.execute({
    sql: `UPDATE client_notes SET archived_at = NULL, updated_at = ? WHERE id = ?`,
    args: [new Date().toISOString(), noteId],
  });
}
