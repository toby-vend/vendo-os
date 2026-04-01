import { rows, scalar, db } from './base.js';

// --- Interfaces ---

export interface AsanaTaskRow {
  gid: string;
  name: string;
  assignee_gid: string | null;
  assignee_name: string | null;
  due_on: string | null;
  completed: number;
  completed_at: string | null;
  section_name: string | null;
  project_gid: string | null;
  project_name: string | null;
  notes: string | null;
  permalink_url: string | null;
  created_at: string | null;
  modified_at: string | null;
  synced_at: string;
}

export interface TaskSearchOpts {
  assignee?: string;
  project?: string;
  status?: 'open' | 'completed' | 'all';
  due?: 'overdue' | 'today' | 'week' | 'all';
  search?: string;
  limit?: number;
  offset?: number;
}

// --- Tasks ---

export async function searchTasks(opts: TaskSearchOpts): Promise<{ tasks: AsanaTaskRow[]; total: number }> {
  const conditions: string[] = [];
  const args: (string | number)[] = [];

  if (opts.assignee) { conditions.push('assignee_name LIKE ?'); args.push(`%${opts.assignee}%`); }
  if (opts.project) { conditions.push('project_gid = ?'); args.push(opts.project); }
  if (opts.status === 'open') { conditions.push('completed = 0'); }
  else if (opts.status === 'completed') { conditions.push('completed = 1'); }
  if (opts.search) { conditions.push('(name LIKE ? OR notes LIKE ?)'); args.push(`%${opts.search}%`, `%${opts.search}%`); }

  if (opts.due === 'overdue') {
    conditions.push("due_on < date('now') AND completed = 0");
  } else if (opts.due === 'today') {
    conditions.push("due_on = date('now')");
  } else if (opts.due === 'week') {
    conditions.push("due_on >= date('now') AND due_on <= date('now', '+7 days')");
  }

  const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const total = await scalar(`SELECT COUNT(*) FROM asana_tasks ${whereClause}`, args) ?? 0;
  const tasks = await rows<AsanaTaskRow>(`
    SELECT * FROM asana_tasks ${whereClause}
    ORDER BY
      completed ASC,
      CASE WHEN due_on IS NULL THEN 1 ELSE 0 END,
      due_on ASC,
      name ASC
    LIMIT ? OFFSET ?
  `, [...args, opts.limit ?? 50, opts.offset ?? 0]);

  return { tasks, total: total as number };
}

export async function getTaskByGid(gid: string): Promise<AsanaTaskRow | null> {
  const result = await rows<AsanaTaskRow>('SELECT * FROM asana_tasks WHERE gid = ?', [gid]);
  return result[0] ?? null;
}

// --- Filter helpers ---

export async function getTaskAssignees(): Promise<string[]> {
  const result = await rows<{ assignee_name: string }>('SELECT DISTINCT assignee_name FROM asana_tasks WHERE assignee_name IS NOT NULL ORDER BY assignee_name');
  return result.map(r => r.assignee_name);
}

export async function getTaskProjects(): Promise<{ gid: string; name: string }[]> {
  return rows<{ gid: string; name: string }>(`
    SELECT DISTINCT project_gid as gid, project_name as name
    FROM asana_tasks
    WHERE project_gid IS NOT NULL AND project_name IS NOT NULL
    ORDER BY project_name
  `);
}

// --- Stats ---

export async function getTaskStats(): Promise<{
  total: number;
  open: number;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
}> {
  const total = await scalar('SELECT COUNT(*) FROM asana_tasks WHERE completed = 0') as number ?? 0;
  const overdue = await scalar("SELECT COUNT(*) FROM asana_tasks WHERE completed = 0 AND due_on < date('now')") as number ?? 0;
  const dueToday = await scalar("SELECT COUNT(*) FROM asana_tasks WHERE completed = 0 AND due_on = date('now')") as number ?? 0;
  const dueThisWeek = await scalar("SELECT COUNT(*) FROM asana_tasks WHERE completed = 0 AND due_on >= date('now') AND due_on <= date('now', '+7 days')") as number ?? 0;

  return { total, open: total, overdue, dueToday, dueThisWeek };
}

// --- Upsert (for creating tasks from web UI and syncing back) ---

export async function upsertAsanaTask(task: {
  gid: string;
  name: string;
  assignee_gid?: string | null;
  assignee_name?: string | null;
  due_on?: string | null;
  completed?: boolean;
  section_name?: string | null;
  project_gid?: string | null;
  project_name?: string | null;
  notes?: string | null;
  permalink_url?: string | null;
}): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO asana_tasks (gid, name, assignee_gid, assignee_name, due_on, completed, section_name, project_gid, project_name, notes, permalink_url, created_at, modified_at, synced_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(gid) DO UPDATE SET
            name=excluded.name, assignee_gid=excluded.assignee_gid, assignee_name=excluded.assignee_name,
            due_on=excluded.due_on, completed=excluded.completed, section_name=excluded.section_name,
            project_gid=excluded.project_gid, project_name=excluded.project_name,
            notes=excluded.notes, permalink_url=excluded.permalink_url, modified_at=excluded.modified_at, synced_at=excluded.synced_at`,
    args: [
      task.gid, task.name,
      task.assignee_gid ?? null, task.assignee_name ?? null,
      task.due_on ?? null, task.completed ? 1 : 0,
      task.section_name ?? null, task.project_gid ?? null, task.project_name ?? null,
      task.notes ?? null, task.permalink_url ?? null,
      now, now, now,
    ],
  });
}
