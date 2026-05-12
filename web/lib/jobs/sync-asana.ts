/**
 * Turso-native port of scripts/sync/sync-asana.ts. Runs inside Vercel
 * serverless via /api/cron/sync-asana (hourly). Writes directly to Turso
 * — no sql.js, no filesystem, no child processes.
 *
 * Keeps parity with the original sync:
 *   1. Fetch all active projects from the workspace
 *   2. Fetch incomplete tasks from each project (paginated)
 *   3. Upsert into asana_tasks (deduped by task gid)
 *   4. Auto-resolve project_gid → canonical client_id via
 *      resolveClientBatch('asana', ...)
 *
 * Wave R / R1 of the efficiency roadmap. Replaces the fragile
 * exec('npx tsx ...') shim that silently failed on Vercel.
 */
import { db } from '../queries/base.js';

const BASE_URL = 'https://app.asana.com/api/1.0';

interface AsanaTask {
  gid: string;
  name: string;
  assignee: { gid: string; name: string } | null;
  due_on: string | null;
  completed: boolean;
  completed_at: string | null;
  memberships: { section: { gid: string; name: string } }[];
  projects: { gid: string; name: string }[];
  notes: string;
  permalink_url: string;
  created_at: string;
  modified_at: string;
}

export interface AsanaSyncResult {
  projectsScanned: number;
  tasksFetched: number;
  tasksUpserted: number;
  resolvedClients: number;
  durationMs: number;
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not set`);
  return value;
}

async function asanaGet<T>(path: string, params: Record<string, string>, apiKey: string): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Asana API ${res.status} on ${path}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data: T };
  return json.data;
}

async function fetchProjects(workspaceGid: string, apiKey: string): Promise<{ gid: string; name: string }[]> {
  return asanaGet<{ gid: string; name: string }[]>(
    '/projects',
    { workspace: workspaceGid, opt_fields: 'name', archived: 'false' },
    apiKey,
  );
}

async function fetchProjectTasks(projectGid: string, apiKey: string): Promise<AsanaTask[]> {
  const allTasks: AsanaTask[] = [];
  let offset: string | undefined;
  // `completed_since` toggles whether the API returns completed tasks
  // at all. Asana's default (and `completed_since='now'`, used here for
  // months) returns ONLY incomplete tasks — a task that transitions
  // open → completed silently disappears from sync results, leaving
  // the prior `completed=0` row stuck. We use a rolling 90-day window
  // so completions land in our mirror without pulling Asana's full
  // history every hour (which would blow past Vercel's 300s budget).
  // The 2026-05-12 one-shot all-time resync filled in older completions.
  const completedSince = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  do {
    const params: Record<string, string> = {
      completed_since: completedSince,
      opt_fields:
        'name,assignee,assignee.name,due_on,completed,completed_at,memberships.section.name,projects,projects.name,notes,permalink_url,created_at,modified_at',
      limit: '100',
    };
    if (offset) params.offset = offset;
    const url = new URL(`${BASE_URL}/projects/${projectGid}/tasks`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Asana API ${res.status} on /projects/${projectGid}/tasks: ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as { data: AsanaTask[]; next_page: { offset: string } | null };
    allTasks.push(...json.data);
    offset = json.next_page?.offset;
  } while (offset);
  return allTasks;
}

/**
 * Main job entry. Idempotent. Throws on hard failure (caller wraps in
 * try/catch — see /api/cron/sync-asana handler).
 */
export async function syncAsana(): Promise<AsanaSyncResult> {
  const start = Date.now();
  const apiKey = requireEnv('ASANA_API_KEY');
  const workspaceGid = requireEnv('ASANA_WORKSPACE_GID');
  const now = new Date().toISOString();

  // 1. Fetch projects
  const projects = await fetchProjects(workspaceGid, apiKey);

  // 2. Fetch tasks across all projects (dedupe on gid)
  const allTasks: AsanaTask[] = [];
  const seenGids = new Set<string>();
  for (const project of projects) {
    const tasks = await fetchProjectTasks(project.gid, apiKey);
    for (const task of tasks) {
      if (!seenGids.has(task.gid)) {
        seenGids.add(task.gid);
        allTasks.push(task);
      }
    }
  }

  // 3. Upsert. libsql `batch` is faster than per-row execute for ~hundreds
  // of rows. Chunk to keep statement count per batch reasonable.
  const CHUNK = 100;
  let upserted = 0;
  for (let i = 0; i < allTasks.length; i += CHUNK) {
    const slice = allTasks.slice(i, i + CHUNK);
    const stmts = slice
      .filter((t) => t.name)
      .map((task) => ({
        sql: `INSERT INTO asana_tasks
                (gid, name, assignee_gid, assignee_name, due_on, completed, completed_at,
                 section_name, project_gid, project_name, notes, permalink_url,
                 created_at, modified_at, synced_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(gid) DO UPDATE SET
                name = excluded.name,
                assignee_gid = excluded.assignee_gid,
                assignee_name = excluded.assignee_name,
                due_on = excluded.due_on,
                completed = excluded.completed,
                completed_at = excluded.completed_at,
                section_name = excluded.section_name,
                project_gid = excluded.project_gid,
                project_name = excluded.project_name,
                notes = excluded.notes,
                permalink_url = excluded.permalink_url,
                modified_at = excluded.modified_at,
                synced_at = excluded.synced_at`,
        args: [
          task.gid,
          task.name,
          task.assignee?.gid ?? null,
          task.assignee?.name ?? null,
          task.due_on ?? null,
          task.completed ? 1 : 0,
          task.completed_at ?? null,
          task.memberships?.[0]?.section?.name ?? null,
          task.projects?.[0]?.gid ?? null,
          task.projects?.[0]?.name ?? null,
          task.notes ?? null,
          task.permalink_url ?? null,
          task.created_at ?? null,
          task.modified_at ?? null,
          now,
        ] as (string | number | null)[],
      }));
    if (stmts.length > 0) {
      await db.batch(stmts, 'write');
      upserted += stmts.length;
    }
  }

  // 4. Auto-resolve project_gid → canonical client_id (Asana source).
  // The old CLI version called resolveClientBatch from scripts/utils — that
  // helper still uses sql.js. Inline a libsql-native version here so the
  // job stays self-contained.
  const projectMap = await db.execute(
    `SELECT DISTINCT project_gid, project_name FROM asana_tasks
     WHERE project_gid IS NOT NULL AND project_name IS NOT NULL`,
  );
  const projectCandidates = projectMap.rows.map((r) => ({
    gid: String(r.project_gid),
    name: String(r.project_name),
  }));

  // For each project gid not already mapped, try a fuzzy name match against
  // clients.name + display_name. Insert into client_source_mappings on hit.
  let resolved = 0;
  if (projectCandidates.length > 0) {
    const existing = await db.execute(
      `SELECT external_id FROM client_source_mappings WHERE source = 'asana'`,
    );
    const mappedGids = new Set(existing.rows.map((r) => String(r.external_id)));
    const clientsResult = await db.execute(
      `SELECT id, name, display_name FROM clients`,
    );
    const clientByName = new Map<string, number>();
    for (const c of clientsResult.rows) {
      const id = Number(c.id);
      if (c.name) clientByName.set(String(c.name).toLowerCase().trim(), id);
      if (c.display_name) clientByName.set(String(c.display_name).toLowerCase().trim(), id);
    }

    for (const proj of projectCandidates) {
      if (mappedGids.has(proj.gid)) continue;
      const clientId = clientByName.get(proj.name.toLowerCase().trim());
      if (clientId != null) {
        try {
          await db.execute({
            sql: `INSERT INTO client_source_mappings
                    (client_id, source, external_id, external_name, created_at)
                  VALUES (?, 'asana', ?, ?, ?)`,
            args: [clientId, proj.gid, proj.name, now],
          });
          resolved++;
        } catch {
          // Unique constraint may exist; safe to ignore.
        }
      }
    }
  }

  return {
    projectsScanned: projects.length,
    tasksFetched: allTasks.length,
    tasksUpserted: upserted,
    resolvedClients: resolved,
    durationMs: Date.now() - start,
  };
}
