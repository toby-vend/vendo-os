/**
 * Fathom -> Asana Action Creator
 *
 * Reads recent meetings (last 24 hours), parses raw_action_items,
 * creates Asana tasks via REST API, and logs synced items.
 *
 * Requires: ASANA_API_KEY, ASANA_WORKSPACE_GID, ASANA_DEFAULT_PROJECT_GID
 *
 * Usage:
 *   npx tsx scripts/automation/fathom-to-asana.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';

const ASANA_API_KEY = process.env.ASANA_API_KEY || '';
const ASANA_WORKSPACE_GID = process.env.ASANA_WORKSPACE_GID || '';
const ASANA_DEFAULT_PROJECT_GID = process.env.ASANA_DEFAULT_PROJECT_GID || '';
const ASANA_BASE_URL = 'https://app.asana.com/api/1.0';

// Map common names to Asana user GIDs (populated at runtime)
let userMap: Map<string, string> = new Map();

interface ActionItem {
  description: string;
  assignee?: string;
  dueDate?: string;
}

async function asanaFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${ASANA_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${ASANA_API_KEY}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Asana API ${res.status}: ${body}`);
  }

  const json = await res.json() as { data: T };
  return json.data;
}

async function loadAsanaUsers(): Promise<void> {
  if (!ASANA_WORKSPACE_GID) return;
  try {
    const users = await asanaFetch<{ gid: string; name: string }[]>(
      `/users?workspace=${ASANA_WORKSPACE_GID}&opt_fields=name`,
    );
    for (const u of users) {
      userMap.set(u.name.toLowerCase(), u.gid);
      // Also map first name only
      const firstName = u.name.split(' ')[0].toLowerCase();
      if (!userMap.has(firstName)) userMap.set(firstName, u.gid);
    }
    log('FATHOM-ASANA', `Loaded ${users.length} Asana users`);
  } catch (err) {
    logError('FATHOM-ASANA', 'Failed to load Asana users', err);
  }
}

function resolveAssignee(name?: string): string | undefined {
  if (!name) return undefined;
  const normalised = name.toLowerCase().trim();
  return userMap.get(normalised);
}

function parseActionItems(raw: string | null): ActionItem[] {
  if (!raw) return [];
  const items: ActionItem[] = [];

  // Handle JSON array format
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (typeof item === 'string') {
          items.push(parseActionLine(item));
        } else if (item.description || item.text) {
          items.push({
            description: item.description || item.text,
            assignee: item.assignee || item.owner,
            dueDate: item.due_date || item.dueDate,
          });
        }
      }
      return items;
    }
  } catch {
    // Not JSON — treat as newline-separated text
  }

  // Plain text: one action per line
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    // Skip header-like lines
    if (line.startsWith('#') || line.startsWith('Action Items') || line.startsWith('---')) continue;
    items.push(parseActionLine(line));
  }

  return items;
}

function parseActionLine(line: string): ActionItem {
  // Remove bullet/numbering prefixes
  let text = line.replace(/^[\-\*\d+\.\)\]]+\s*/, '').trim();

  // Extract assignee patterns like "(Assignee: Sam)" or "[Sam]" or "- Sam:"
  let assignee: string | undefined;
  const assigneeMatch = text.match(/\((?:Assignee|Owner|Assigned to)[:\s]+([^)]+)\)/i)
    || text.match(/\[([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\]\s*/);
  if (assigneeMatch) {
    assignee = assigneeMatch[1].trim();
    text = text.replace(assigneeMatch[0], '').trim();
  }

  // Extract due date patterns like "(Due: 2026-04-10)" or "by Friday"
  let dueDate: string | undefined;
  const dueDateMatch = text.match(/\((?:Due|By|Deadline)[:\s]+(\d{4}-\d{2}-\d{2})\)/i);
  if (dueDateMatch) {
    dueDate = dueDateMatch[1];
    text = text.replace(dueDateMatch[0], '').trim();
  }

  return { description: text, assignee, dueDate };
}

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

async function createAsanaTask(
  meetingTitle: string,
  item: ActionItem,
  projectGid?: string,
): Promise<string> {
  const assigneeGid = resolveAssignee(item.assignee);

  const taskData: Record<string, unknown> = {
    name: item.description.slice(0, 200),
    notes: `From meeting: ${meetingTitle}\n\nOriginal action item: ${item.description}`,
    due_on: item.dueDate || defaultDueDate(),
    workspace: ASANA_WORKSPACE_GID,
  };

  if (assigneeGid) taskData.assignee = assigneeGid;
  if (projectGid || ASANA_DEFAULT_PROJECT_GID) {
    taskData.projects = [projectGid || ASANA_DEFAULT_PROJECT_GID];
  }

  const result = await asanaFetch<{ gid: string }>('/tasks', {
    method: 'POST',
    body: JSON.stringify({ data: taskData }),
  });

  return result.gid;
}

async function ensureSyncTable(): Promise<void> {
  const db = await getDb();
  db.run(`
    CREATE TABLE IF NOT EXISTS fathom_asana_synced (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id TEXT NOT NULL,
      action_description TEXT NOT NULL,
      asana_task_gid TEXT NOT NULL,
      assignee TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(meeting_id, action_description)
    )
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_fas_meeting ON fathom_asana_synced(meeting_id)');
}

async function main() {
  if (!ASANA_API_KEY) {
    logError('FATHOM-ASANA', 'ASANA_API_KEY not set in .env.local');
    process.exit(1);
  }

  await initSchema();
  await ensureSyncTable();
  await loadAsanaUsers();

  const db = await getDb();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Fetch recent meetings with action items
  const result = db.exec(`
    SELECT id, title, raw_action_items, client_name
    FROM meetings
    WHERE date >= ? AND raw_action_items IS NOT NULL AND raw_action_items != ''
    ORDER BY date DESC
  `, [twentyFourHoursAgo]);

  if (!result.length || !result[0].values.length) {
    log('FATHOM-ASANA', 'No recent meetings with action items');
    closeDb();
    return;
  }

  let created = 0;
  let skipped = 0;

  for (const row of result[0].values) {
    const [meetingId, title, rawItems, clientName] = row as [string, string, string, string | null];
    const items = parseActionItems(rawItems);

    // Find Asana project for this client (if mapped)
    let projectGid: string | undefined;
    if (clientName) {
      const mapping = db.exec(
        "SELECT external_id FROM client_source_mappings WHERE source = 'asana' AND client_id IN (SELECT id FROM clients WHERE name = ? OR display_name = ?) LIMIT 1",
        [clientName, clientName],
      );
      if (mapping.length && mapping[0].values.length) {
        projectGid = mapping[0].values[0][0] as string;
      }
    }

    for (const item of items) {
      if (!item.description || item.description.length < 5) continue;

      // Check if already synced
      const existing = db.exec(
        'SELECT id FROM fathom_asana_synced WHERE meeting_id = ? AND action_description = ?',
        [meetingId, item.description],
      );
      if (existing.length && existing[0].values.length) {
        skipped++;
        continue;
      }

      try {
        const taskGid = await createAsanaTask(title, item, projectGid);
        const now = new Date().toISOString();

        db.run(`
          INSERT INTO fathom_asana_synced (meeting_id, action_description, asana_task_gid, assignee, created_at)
          VALUES (?, ?, ?, ?, ?)
        `, [meetingId, item.description, taskGid, item.assignee || null, now]);

        created++;
        log('FATHOM-ASANA', `  Created task: ${item.description.slice(0, 60)}...`);
      } catch (err) {
        logError('FATHOM-ASANA', `Failed to create task: ${item.description.slice(0, 60)}`, err);
      }
    }
  }

  saveDb();
  log('FATHOM-ASANA', `Done: ${created} tasks created, ${skipped} already synced`);
  closeDb();
}

main().catch((err) => {
  logError('FATHOM-ASANA', 'Failed', err);
  process.exit(1);
});
