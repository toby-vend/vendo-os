import { db } from '../queries/base.js';
import { consoleLog } from '../monitors/base.js';

/**
 * Turso-native port of scripts/automation/fathom-to-asana.ts. Runs from the
 * daily Vercel cron (/api/cron/sync-actions-to-asana) to create Asana tasks
 * for:
 *   1. Fathom meeting action items from the last 24 hours
 *   2. Open escalations (tier = critical/high/medium)
 *   3. NPS detractors that haven't had follow-up logged
 *
 * Deduplicated via the fathom_asana_synced table (source_type + source_id).
 */

const ASANA_API_KEY = process.env.ASANA_API_KEY || process.env.ASANA_PAT || '';
const ASANA_WORKSPACE_GID = process.env.ASANA_WORKSPACE_GID || process.env.ASANA_WORKSPACE_ID || '';
const ASANA_DEFAULT_PROJECT_GID = process.env.ASANA_DEFAULT_PROJECT_GID || '';
const ASANA_BASE_URL = 'https://app.asana.com/api/1.0';
const LOG_SOURCE = 'sync-actions-to-asana';

interface ActionItem {
  description: string;
  assignee?: string;
  dueDate?: string;
}

const userMap: Map<string, string> = new Map();

async function asanaFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${ASANA_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${ASANA_API_KEY}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Asana API ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data: T };
  return json.data;
}

async function loadAsanaUsers(): Promise<void> {
  if (!ASANA_WORKSPACE_GID) return;
  try {
    const users = await asanaFetch<Array<{ gid: string; name: string }>>(
      `/users?workspace=${ASANA_WORKSPACE_GID}&opt_fields=name`,
    );
    for (const u of users) {
      userMap.set(u.name.toLowerCase(), u.gid);
      const firstName = u.name.split(' ')[0].toLowerCase();
      if (!userMap.has(firstName)) userMap.set(firstName, u.gid);
    }
    consoleLog(LOG_SOURCE, `Loaded ${users.length} Asana users`);
  } catch (err) {
    consoleLog(LOG_SOURCE, `Failed to load Asana users: ${err instanceof Error ? err.message : err}`);
  }
}

function resolveAssignee(name?: string): string | undefined {
  if (!name) return undefined;
  return userMap.get(name.toLowerCase().trim());
}

function parseActionLine(line: string): ActionItem {
  let text = line.replace(/^[-*\d+.)\]]+\s*/, '').trim();
  let assignee: string | undefined;
  const assigneeMatch =
    text.match(/\((?:Assignee|Owner|Assigned to)[:\s]+([^)]+)\)/i) ||
    text.match(/\[([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\]\s*/);
  if (assigneeMatch) {
    assignee = assigneeMatch[1].trim();
    text = text.replace(assigneeMatch[0], '').trim();
  }
  let dueDate: string | undefined;
  const dueDateMatch = text.match(/\((?:Due|By|Deadline)[:\s]+(\d{4}-\d{2}-\d{2})\)/i);
  if (dueDateMatch) {
    dueDate = dueDateMatch[1];
    text = text.replace(dueDateMatch[0], '').trim();
  }
  return { description: text, assignee, dueDate };
}

function parseActionItems(raw: string | null): ActionItem[] {
  if (!raw) return [];
  const items: ActionItem[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (typeof item === 'string') {
          items.push(parseActionLine(item));
        } else if (item?.description || item?.text) {
          items.push({
            description: item.description || item.text,
            assignee: item.assignee?.name || item.assignee || item.owner,
            dueDate: item.due_date || item.dueDate,
          });
        }
      }
      return items;
    }
  } catch {
    /* fall through to text */
  }
  for (const line of raw.split('\n').map((l) => l.trim()).filter(Boolean)) {
    if (line.startsWith('#') || line.startsWith('Action Items') || line.startsWith('---')) continue;
    items.push(parseActionLine(line));
  }
  return items;
}

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

async function ensureSyncTable(): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS fathom_asana_synced (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id TEXT NOT NULL,
      action_description TEXT NOT NULL,
      asana_task_gid TEXT NOT NULL,
      assignee TEXT,
      created_at TEXT NOT NULL,
      source_type TEXT DEFAULT 'meeting',
      source_id TEXT,
      UNIQUE(meeting_id, action_description)
    )
  `);
  await db.execute('CREATE INDEX IF NOT EXISTS idx_fas_meeting ON fathom_asana_synced(meeting_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_fas_source ON fathom_asana_synced(source_type, source_id)');
}

async function alreadySynced(sourceType: string, sourceId: string): Promise<boolean> {
  const r = await db.execute({
    sql: 'SELECT 1 FROM fathom_asana_synced WHERE source_type = ? AND source_id = ? LIMIT 1',
    args: [sourceType, sourceId],
  });
  return r.rows.length > 0;
}

async function recordSync(
  meetingId: string,
  description: string,
  taskGid: string,
  assignee: string | null,
  sourceType: string,
  sourceId: string,
): Promise<void> {
  await db.execute({
    sql: `INSERT OR IGNORE INTO fathom_asana_synced
            (meeting_id, action_description, asana_task_gid, assignee, created_at, source_type, source_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [meetingId, description, taskGid, assignee, new Date().toISOString(), sourceType, sourceId],
  });
}

/**
 * Look up the AM for a client, preferring the Deliverables module's
 * client_service_configs (where AMs are managed day-to-day) over the
 * legacy clients.am column. Resolves initials → full name using
 * deliverable_team_members so the returned value is ready for Asana user
 * matching. Handles multi-person AM fields like "MP / SF" by picking the
 * first entry.
 */
async function getClientAM(clientName: string | null): Promise<string | null> {
  if (!clientName) return null;

  // 1. Deliverables module — authoritative per-client AM
  try {
    const r = await db.execute({
      sql: `SELECT am FROM client_service_configs
            WHERE client_name = ? AND status = 'active' AND am IS NOT NULL AND am != ''
            ORDER BY id DESC LIMIT 1`,
      args: [clientName],
    });
    const rawAm = r.rows[0]?.am as string | undefined;
    if (rawAm) {
      const initials = rawAm.split(/[\/,]/)[0].trim().toUpperCase();
      if (initials) {
        const m = await db.execute({
          sql: 'SELECT name FROM deliverable_team_members WHERE UPPER(initials) = ? AND is_active = 1 LIMIT 1',
          args: [initials],
        });
        const name = m.rows[0]?.name as string | undefined;
        if (name) return name;
      }
      // Fallback: if it's already a full name, return as-is
      if (/[a-z]/.test(rawAm)) return rawAm;
    }
  } catch {
    /* table may not exist — continue to legacy fallback */
  }

  // 2. Legacy fallback — clients.am column
  try {
    const r = await db.execute({
      sql: `SELECT am FROM clients
            WHERE (name = ? OR display_name = ?) AND am IS NOT NULL LIMIT 1`,
      args: [clientName, clientName],
    });
    return (r.rows[0]?.am as string) || null;
  } catch {
    return null;
  }
}

async function getAsanaProjectForClient(clientName: string | null): Promise<string | undefined> {
  if (!clientName) return undefined;
  try {
    const r = await db.execute({
      sql: `SELECT csm.external_id FROM client_source_mappings csm
            JOIN clients c ON c.id = csm.client_id
            WHERE csm.source = 'asana' AND (c.name = ? OR c.display_name = ?)
            LIMIT 1`,
      args: [clientName, clientName],
    });
    return (r.rows[0]?.external_id as string) || undefined;
  } catch {
    return undefined;
  }
}

async function createAsanaTaskFromAction(
  source: string,
  item: ActionItem,
  clientName: string | null,
  projectGid?: string,
): Promise<string> {
  let assigneeGid = resolveAssignee(item.assignee);
  if (!assigneeGid && clientName) {
    const am = await getClientAM(clientName);
    if (am) assigneeGid = resolveAssignee(am);
  }
  const taskData: Record<string, unknown> = {
    name: item.description.slice(0, 200),
    notes: `Source: ${source}\n\nOriginal: ${item.description}`,
    due_on: item.dueDate || defaultDueDate(),
    workspace: ASANA_WORKSPACE_GID,
  };
  if (assigneeGid) taskData.assignee = assigneeGid;
  const resolvedProject = projectGid || ASANA_DEFAULT_PROJECT_GID;
  if (resolvedProject) taskData.projects = [resolvedProject];

  const result = await asanaFetch<{ gid: string }>('/tasks', {
    method: 'POST',
    body: JSON.stringify({ data: taskData }),
  });
  return result.gid;
}

interface SyncCount {
  created: number;
  skipped: number;
}

/**
 * Create Asana tasks for a single meeting's action items. Called in
 * real-time from the Fathom webhook so tasks appear as soon as the
 * meeting finishes processing. Idempotent — re-sending the same webhook
 * won't duplicate tasks thanks to the fathom_asana_synced dedupe table.
 *
 * Returns counts so the webhook can log, but never throws — task creation
 * failures should not fail the webhook.
 */
export async function createTasksForMeeting(input: {
  meetingId: string;
  title: string;
  rawActionItems: string | null;
  clientName: string | null;
}): Promise<SyncCount> {
  if (!ASANA_API_KEY || !input.rawActionItems) return { created: 0, skipped: 0 };
  await ensureSyncTable();
  if (!userMap.size) await loadAsanaUsers();

  const items = parseActionItems(input.rawActionItems);
  if (!items.length) return { created: 0, skipped: 0 };

  const projectGid = await getAsanaProjectForClient(input.clientName);
  let created = 0;
  let skipped = 0;

  for (const item of items) {
    if (!item.description || item.description.length < 5) continue;
    const sourceId = `meeting-${input.meetingId}-${item.description.slice(0, 50)}`;
    if (await alreadySynced('meeting', sourceId)) { skipped++; continue; }
    const legacy = await db.execute({
      sql: 'SELECT 1 FROM fathom_asana_synced WHERE meeting_id = ? AND action_description = ? LIMIT 1',
      args: [input.meetingId, item.description],
    });
    if (legacy.rows.length) { skipped++; continue; }

    try {
      const taskGid = await createAsanaTaskFromAction(`Meeting: ${input.title}`, item, input.clientName, projectGid);
      await recordSync(input.meetingId, item.description, taskGid, item.assignee || null, 'meeting', sourceId);
      created++;
    } catch (err) {
      consoleLog(LOG_SOURCE, `Meeting task failed: ${err instanceof Error ? err.message : err}`);
    }
  }
  return { created, skipped };
}

async function syncMeetingActions(): Promise<SyncCount> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let created = 0;
  let skipped = 0;
  const { rows } = await db.execute({
    sql: `SELECT id, title, raw_action_items, client_name
          FROM meetings
          WHERE date >= ? AND raw_action_items IS NOT NULL AND raw_action_items != ''
          ORDER BY date DESC`,
    args: [twentyFourHoursAgo],
  });
  if (!rows.length) return { created, skipped };

  for (const row of rows) {
    const result = await createTasksForMeeting({
      meetingId: row.id as string,
      title: row.title as string,
      rawActionItems: row.raw_action_items as string,
      clientName: (row.client_name as string) || null,
    });
    created += result.created;
    skipped += result.skipped;
  }
  return { created, skipped };
}

async function syncEscalations(): Promise<SyncCount> {
  let created = 0;
  let skipped = 0;
  let rows: Array<Record<string, unknown>>;
  try {
    const r = await db.execute("SELECT id, client_name, tier, description FROM escalations WHERE status = 'open'");
    rows = r.rows as Array<Record<string, unknown>>;
  } catch {
    return { created, skipped };
  }
  const today = new Date().toISOString().slice(0, 10);
  for (const row of rows) {
    const id = row.id as number;
    const clientName = (row.client_name as string) || null;
    const tier = (row.tier as string) || 'unknown';
    const description = (row.description as string) || '';
    const sourceId = `escalation-${id}`;
    if (await alreadySynced('escalation', sourceId)) { skipped++; continue; }
    const projectGid = await getAsanaProjectForClient(clientName);
    const taskName = `[ESCALATION] ${clientName ?? 'Unknown'} — ${description}`.slice(0, 200);
    try {
      const taskGid = await createAsanaTaskFromAction(
        `Escalation (${tier.toUpperCase()})`,
        { description: taskName, dueDate: today },
        clientName,
        projectGid,
      );
      await recordSync(sourceId, taskName, taskGid, null, 'escalation', sourceId);
      created++;
    } catch (err) {
      consoleLog(LOG_SOURCE, `Escalation task failed: ${err instanceof Error ? err.message : err}`);
    }
  }
  return { created, skipped };
}

async function syncNpsDetractors(): Promise<SyncCount> {
  let created = 0;
  let skipped = 0;
  let rows: Array<Record<string, unknown>>;
  try {
    const r = await db.execute('SELECT id, client_name, score, feedback FROM nps_responses WHERE score < 7 AND follow_up_done = 0');
    rows = r.rows as Array<Record<string, unknown>>;
  } catch {
    return { created, skipped };
  }
  const threeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  for (const row of rows) {
    const id = row.id as number;
    const clientName = (row.client_name as string) || null;
    const score = row.score as number;
    const sourceId = `nps-${id}`;
    if (await alreadySynced('nps', sourceId)) { skipped++; continue; }
    const projectGid = await getAsanaProjectForClient(clientName);
    const taskName = `[NPS] ${clientName ?? 'Unknown'} scored ${score}/10 — follow up required`;
    try {
      const taskGid = await createAsanaTaskFromAction(
        `NPS detractor (${score}/10)`,
        { description: taskName, dueDate: threeDays },
        clientName,
        projectGid,
      );
      await recordSync(sourceId, taskName, taskGid, null, 'nps', sourceId);
      created++;
    } catch (err) {
      consoleLog(LOG_SOURCE, `NPS task failed: ${err instanceof Error ? err.message : err}`);
    }
  }
  return { created, skipped };
}

export interface SyncActionsResult {
  meetings: SyncCount;
  escalations: SyncCount;
  nps: SyncCount;
  durationMs: number;
}

export async function syncActionsToAsana(): Promise<SyncActionsResult> {
  if (!ASANA_API_KEY) {
    consoleLog(LOG_SOURCE, 'ASANA_API_KEY not configured — skipping');
    return { meetings: { created: 0, skipped: 0 }, escalations: { created: 0, skipped: 0 }, nps: { created: 0, skipped: 0 }, durationMs: 0 };
  }
  const start = Date.now();
  await ensureSyncTable();
  await loadAsanaUsers();
  const meetings = await syncMeetingActions();
  const escalations = await syncEscalations();
  const nps = await syncNpsDetractors();
  const durationMs = Date.now() - start;
  consoleLog(
    LOG_SOURCE,
    `Done: meetings ${meetings.created}/${meetings.skipped}, escalations ${escalations.created}/${escalations.skipped}, nps ${nps.created}/${nps.skipped} (${durationMs}ms)`,
  );
  return { meetings, escalations, nps, durationMs };
}
