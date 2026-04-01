import { rows, scalar } from './base.js';

// --- Interfaces ---

export interface MeetingRow {
  id: string;
  title: string;
  date: string;
  category: string | null;
  client_name: string | null;
  duration_seconds: number | null;
  summary: string | null;
  transcript: string | null;
  attendees: string | null;
  url: string | null;
  excerpt?: string;
}

export interface ActionItemRow {
  id: number;
  meeting_id: string;
  description: string;
  assignee: string | null;
  completed: number;
  created_at: string;
  meeting_title?: string;
  meeting_date?: string;
}

export interface MeetingSearchOpts {
  search?: string;
  client?: string;
  category?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface ActionItemSearchOpts {
  assignee?: string;
  status?: 'open' | 'completed' | 'all';
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

// --- Meetings ---

export async function searchMeetings(opts: MeetingSearchOpts): Promise<{ meetings: MeetingRow[]; total: number }> {
  const conditions: string[] = [];
  const args: (string | number)[] = [];

  if (opts.search) {
    const ftsQuery = opts.search.replace(/['"]/g, '').split(/\s+/).map(w => w + '*').join(' ');

    const filterConditions: string[] = [];
    const filterArgs: (string | number)[] = [ftsQuery];

    if (opts.client) { filterConditions.push('m.client_name LIKE ?'); filterArgs.push(`%${opts.client}%`); }
    if (opts.category) { filterConditions.push('m.category = ?'); filterArgs.push(opts.category); }
    if (opts.from) { filterConditions.push('m.date >= ?'); filterArgs.push(opts.from); }
    if (opts.to) { filterConditions.push("m.date <= ? || 'T23:59:59Z'"); filterArgs.push(opts.to); }

    const whereExtra = filterConditions.length ? 'AND ' + filterConditions.join(' AND ') : '';

    const total = await scalar(`
      SELECT COUNT(*) FROM meetings_fts fts JOIN meetings m ON m.rowid = fts.rowid
      WHERE meetings_fts MATCH ? ${whereExtra}
    `, filterArgs) ?? 0;

    const meetings = await rows<MeetingRow>(`
      SELECT m.id, m.title, m.date, m.category, m.client_name, m.duration_seconds,
             snippet(meetings_fts, '<mark>', '</mark>', '...', -1, 40) as excerpt
      FROM meetings_fts fts JOIN meetings m ON m.rowid = fts.rowid
      WHERE meetings_fts MATCH ? ${whereExtra}
      ORDER BY m.date DESC LIMIT ? OFFSET ?
    `, [...filterArgs, opts.limit ?? 20, opts.offset ?? 0]);

    return { meetings, total: total as number };
  }

  // Non-FTS path
  if (opts.client) { conditions.push('client_name LIKE ?'); args.push(`%${opts.client}%`); }
  if (opts.category) { conditions.push('category = ?'); args.push(opts.category); }
  if (opts.from) { conditions.push('date >= ?'); args.push(opts.from); }
  if (opts.to) { conditions.push("date <= ? || 'T23:59:59Z'"); args.push(opts.to); }

  const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const total = await scalar(`SELECT COUNT(*) FROM meetings ${whereClause}`, args) ?? 0;
  const meetings = await rows<MeetingRow>(`
    SELECT id, title, date, category, client_name, duration_seconds
    FROM meetings ${whereClause} ORDER BY date DESC LIMIT ? OFFSET ?
  `, [...args, opts.limit ?? 20, opts.offset ?? 0]);

  return { meetings, total: total as number };
}

export async function getMeetingById(id: string): Promise<MeetingRow | null> {
  const result = await rows<MeetingRow>('SELECT * FROM meetings WHERE id = ?', [id]);
  return result[0] ?? null;
}

export async function getMeetingActionItems(meetingId: string): Promise<ActionItemRow[]> {
  return rows<ActionItemRow>('SELECT * FROM action_items WHERE meeting_id = ? ORDER BY id', [meetingId]);
}

// --- Action Items ---

export async function getActionItems(opts: ActionItemSearchOpts): Promise<{ items: ActionItemRow[]; total: number }> {
  const conditions: string[] = [];
  const args: (string | number)[] = [];

  if (opts.assignee) { conditions.push('ai.assignee LIKE ?'); args.push(`%${opts.assignee}%`); }
  if (opts.status === 'open') { conditions.push('ai.completed = 0'); }
  else if (opts.status === 'completed') { conditions.push('ai.completed = 1'); }
  if (opts.from) { conditions.push('ai.created_at >= ?'); args.push(opts.from); }
  if (opts.to) { conditions.push("ai.created_at <= ? || 'T23:59:59Z'"); args.push(opts.to); }

  const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const total = await scalar(`SELECT COUNT(*) FROM action_items ai ${whereClause}`, args) ?? 0;
  const items = await rows<ActionItemRow>(`
    SELECT ai.*, m.title as meeting_title, m.date as meeting_date
    FROM action_items ai JOIN meetings m ON ai.meeting_id = m.id
    ${whereClause} ORDER BY m.date DESC LIMIT ? OFFSET ?
  `, [...args, opts.limit ?? 50, opts.offset ?? 0]);

  return { items, total: total as number };
}

// --- Filter helpers ---

export async function getCategories(): Promise<{ slug: string; label: string }[]> {
  return rows<{ slug: string; label: string }>('SELECT slug, label FROM meeting_categories ORDER BY label');
}

export async function getAssignees(): Promise<string[]> {
  const result = await rows<{ assignee: string }>('SELECT DISTINCT assignee FROM action_items WHERE assignee IS NOT NULL ORDER BY assignee');
  return result.map(r => r.assignee);
}

export async function getClientNames(): Promise<string[]> {
  const result = await rows<{ client_name: string }>('SELECT DISTINCT client_name FROM meetings WHERE client_name IS NOT NULL ORDER BY client_name');
  return result.map(r => r.client_name);
}
