/**
 * agent_conversations — chat-thread metadata helpers.
 *
 * Every helper here is per-user-scoped: callers pass userId and we filter
 * on it in WHERE clauses. There is no admin override at this layer —
 * cross-user leakage would be a bug.
 *
 * The FTS5 mirror table (agent_conversation_search) is kept in lockstep
 * with agent_conversations via the same helpers, so searches always see
 * consistent state without a separate trigger.
 */
import { db, rows } from './base.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConversationRow {
  id: string;
  user_id: string;
  agent: string;
  channel: string;
  title: string | null;
  message_count: number;
  last_message_at: string;
  archived_at: string | null;
  created_at: string;
}

export interface ConversationListItem {
  id: string;
  agent: string;
  title: string | null;
  messageCount: number;
  lastMessageAt: string;
  archivedAt: string | null;
}

// ---------------------------------------------------------------------------
// Create + mutate
// ---------------------------------------------------------------------------

export async function createConversation(input: {
  id: string;
  userId: string;
  agent: string;
  channel: string;
}): Promise<void> {
  await db.execute({
    sql: `INSERT INTO agent_conversations (id, user_id, agent, channel)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(id) DO NOTHING`,
    args: [input.id, input.userId, input.agent, input.channel],
  });
}

/**
 * Increment message_count + bump last_message_at. Called on every turn.
 * Idempotent at the row level — multiple touches in quick succession just
 * roll the counter forward.
 */
export async function touchConversation(id: string, delta = 1): Promise<void> {
  await db.execute({
    sql: `UPDATE agent_conversations
             SET message_count = message_count + ?,
                 last_message_at = datetime('now')
           WHERE id = ?`,
    args: [delta, id],
  });
}

/**
 * Set the title on a conversation if it has no title yet (first-turn only).
 * Mirrors the title + body into the FTS5 index for search. Cheap REPLACE
 * semantics keep the index in sync if the title later changes.
 */
export async function setConversationTitle(opts: {
  id: string;
  userId: string;
  agent: string;
  title: string;
  body: string;
}): Promise<void> {
  await db.execute({
    sql: `UPDATE agent_conversations SET title = ? WHERE id = ? AND title IS NULL`,
    args: [opts.title, opts.id],
  });
  // Mirror to FTS — DELETE then INSERT so re-titling stays consistent.
  await db.execute({
    sql: `DELETE FROM agent_conversation_search WHERE conversation_id = ?`,
    args: [opts.id],
  });
  await db.execute({
    sql: `INSERT INTO agent_conversation_search (conversation_id, user_id, agent, title, body)
          VALUES (?, ?, ?, ?, ?)`,
    args: [opts.id, opts.userId, opts.agent, opts.title, opts.body],
  });
}

/**
 * Refresh the FTS5 body for a conversation when later turns add new user
 * messages. Cheap to do per turn; the search index stays current.
 */
export async function refreshConversationSearchBody(opts: {
  id: string;
  userId: string;
  agent: string;
  title: string | null;
  body: string;
}): Promise<void> {
  await db.execute({
    sql: `DELETE FROM agent_conversation_search WHERE conversation_id = ?`,
    args: [opts.id],
  });
  await db.execute({
    sql: `INSERT INTO agent_conversation_search (conversation_id, user_id, agent, title, body)
          VALUES (?, ?, ?, ?, ?)`,
    args: [opts.id, opts.userId, opts.agent, opts.title ?? '', opts.body],
  });
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getConversation(
  id: string,
  userId: string,
): Promise<ConversationRow | null> {
  const r = await rows<ConversationRow>(
    `SELECT * FROM agent_conversations WHERE id = ? AND user_id = ? LIMIT 1`,
    [id, userId],
  );
  return r[0] ?? null;
}

export interface ListConversationsInput {
  userId: string;
  agent?: string;
  limit?: number;
  beforeMs?: number; // cursor — list items with last_message_at < this
  includeArchived?: boolean;
  /** When set, returns ONLY archived conversations. Overrides includeArchived. */
  archivedOnly?: boolean;
}

export async function listConversations(
  input: ListConversationsInput,
): Promise<ConversationListItem[]> {
  const where: string[] = ['user_id = ?'];
  const args: (string | number | null)[] = [input.userId];

  if (input.archivedOnly) {
    where.push('archived_at IS NOT NULL');
  } else if (!input.includeArchived) {
    where.push('archived_at IS NULL');
  }

  if (input.agent) {
    where.push('agent = ?');
    args.push(input.agent);
  }
  if (input.beforeMs && Number.isFinite(input.beforeMs)) {
    where.push("last_message_at < datetime(?, 'unixepoch')");
    args.push(Math.floor(input.beforeMs / 1000));
  }

  const limit = Math.max(1, Math.min(100, input.limit ?? 25));
  args.push(limit);

  const result = await rows<ConversationRow>(
    `SELECT id, user_id, agent, channel, title, message_count, last_message_at, archived_at, created_at
       FROM agent_conversations
      WHERE ${where.join(' AND ')}
      ORDER BY last_message_at DESC
      LIMIT ?`,
    args,
  );
  return result.map(rowToItem);
}

// ---------------------------------------------------------------------------
// Search (FTS5)
// ---------------------------------------------------------------------------

export interface SearchConversationsInput {
  userId: string;
  query: string;
  agent?: string;
  limit?: number;
}

export async function searchConversations(
  input: SearchConversationsInput,
): Promise<ConversationListItem[]> {
  const q = input.query.trim();
  if (q.length === 0) return [];

  // Escape FTS5 special chars defensively and append a prefix wildcard so
  // partial words match ("velt" → matches "Veltuff").
  const ftsQuery = ftsPrefixQuery(q);
  const limit = Math.max(1, Math.min(50, input.limit ?? 25));

  // Join FTS hits back to the main table so we get the canonical row
  // (title might have been updated since the search-table mirror).
  const where: string[] = ['c.user_id = ?', 'c.archived_at IS NULL'];
  const args: (string | number | null)[] = [input.userId];
  if (input.agent) {
    where.push('c.agent = ?');
    args.push(input.agent);
  }

  const result = await rows<ConversationRow>(
    `SELECT c.id, c.user_id, c.agent, c.channel, c.title, c.message_count,
            c.last_message_at, c.archived_at, c.created_at
       FROM agent_conversation_search s
       JOIN agent_conversations c ON c.id = s.conversation_id
      WHERE agent_conversation_search MATCH ?
        AND s.user_id = ?
        AND ${where.join(' AND ')}
      ORDER BY c.last_message_at DESC
      LIMIT ?`,
    [ftsQuery, input.userId, ...args, limit],
  );
  return result.map(rowToItem);
}

function ftsPrefixQuery(q: string): string {
  // Strip everything that FTS5 treats specially, then append * for prefix
  // matching on the last token. Conservative — keeps the query a plain
  // tokens list so MATCH never errors.
  const cleaned = q.replace(/["()*:^]/g, ' ').replace(/\s+/g, ' ').trim();
  if (cleaned.length === 0) return q;
  const parts = cleaned.split(' ');
  parts[parts.length - 1] = parts[parts.length - 1] + '*';
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Archive / restore / delete
// ---------------------------------------------------------------------------

export async function archiveConversation(
  id: string,
  userId: string,
): Promise<boolean> {
  const r = await db.execute({
    sql: `UPDATE agent_conversations
             SET archived_at = datetime('now')
           WHERE id = ? AND user_id = ? AND archived_at IS NULL`,
    args: [id, userId],
  });
  return r.rowsAffected > 0;
}

export async function restoreConversation(
  id: string,
  userId: string,
): Promise<boolean> {
  const r = await db.execute({
    sql: `UPDATE agent_conversations
             SET archived_at = NULL
           WHERE id = ? AND user_id = ? AND archived_at IS NOT NULL`,
    args: [id, userId],
  });
  return r.rowsAffected > 0;
}

/**
 * Hard-delete a conversation row + its FTS mirror. Only allowed once the
 * conversation is already archived — two-stage delete prevents accidental
 * permanent loss. The underlying agent_runs / agent_messages rows are
 * kept for audit; only the metadata + search index are removed here.
 */
export async function deleteConversation(
  id: string,
  userId: string,
): Promise<boolean> {
  // Verify ownership AND archived state in a single guard
  const row = await getConversation(id, userId);
  if (!row || row.archived_at === null) return false;

  await db.execute({
    sql: `DELETE FROM agent_conversation_search WHERE conversation_id = ?`,
    args: [id],
  });
  const r = await db.execute({
    sql: `DELETE FROM agent_conversations WHERE id = ? AND user_id = ?`,
    args: [id, userId],
  });
  return r.rowsAffected > 0;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToItem(row: ConversationRow): ConversationListItem {
  return {
    id: row.id,
    agent: row.agent,
    title: row.title,
    messageCount: row.message_count,
    lastMessageAt: row.last_message_at,
    archivedAt: row.archived_at,
  };
}

/**
 * Truncate a string at a word boundary, falling back to a hard cut if no
 * boundary lies within the budget. Used to auto-derive conversation titles
 * from the first user message.
 */
export function truncateAtWordBoundary(text: string, max = 60): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= max) return trimmed;
  const slice = trimmed.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace > max * 0.5) return slice.slice(0, lastSpace).trimEnd() + '…';
  return slice.trimEnd() + '…';
}
