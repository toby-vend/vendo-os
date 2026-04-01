import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';

const WORKSPACE_GID = process.env.ASANA_WORKSPACE_GID || '';
const API_KEY = process.env.ASANA_API_KEY || '';
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

async function asanaFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    headers: { 'Authorization': `Bearer ${API_KEY}`, 'Accept': 'application/json' },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Asana API ${res.status}: ${body}`);
  }

  const json = await res.json() as { data: T };
  return json.data;
}

async function fetchAllUsers(): Promise<{ gid: string; name: string }[]> {
  return asanaFetch<{ gid: string; name: string }[]>('/users', {
    workspace: WORKSPACE_GID,
    opt_fields: 'name',
  });
}

async function fetchUserTasks(userGid: string): Promise<AsanaTask[]> {
  // Get tasks from My Tasks list
  const tasks = await asanaFetch<AsanaTask[]>(`/user_task_lists/${userGid}/tasks`, {
    completed_since: 'now', // only incomplete tasks
    opt_fields: 'name,assignee,assignee.name,due_on,completed,completed_at,memberships.section.name,projects,projects.name,notes,permalink_url,created_at,modified_at',
  });
  return tasks;
}

async function fetchWorkspaceTasks(): Promise<AsanaTask[]> {
  // Fetch all incomplete tasks across the workspace
  const allTasks: AsanaTask[] = [];
  let offset: string | undefined;

  do {
    const params: Record<string, string> = {
      workspace: WORKSPACE_GID,
      completed_since: 'now',
      opt_fields: 'name,assignee,assignee.name,due_on,completed,completed_at,memberships.section.name,projects,projects.name,notes,permalink_url,created_at,modified_at',
      limit: '100',
    };
    if (offset) params.offset = offset;

    const url = new URL(`${BASE_URL}/tasks`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    const res = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Accept': 'application/json' },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Asana API ${res.status}: ${body}`);
    }

    const json = await res.json() as { data: AsanaTask[]; next_page: { offset: string } | null };
    allTasks.push(...json.data);
    offset = json.next_page?.offset;
  } while (offset);

  return allTasks;
}

async function fetchProjectTasks(projectGid: string): Promise<AsanaTask[]> {
  const allTasks: AsanaTask[] = [];
  let offset: string | undefined;

  do {
    const params: Record<string, string> = {
      completed_since: 'now',
      opt_fields: 'name,assignee,assignee.name,due_on,completed,completed_at,memberships.section.name,projects,projects.name,notes,permalink_url,created_at,modified_at',
      limit: '100',
    };
    if (offset) params.offset = offset;

    const url = new URL(`${BASE_URL}/projects/${projectGid}/tasks`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    const res = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Accept': 'application/json' },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Asana API ${res.status}: ${body}`);
    }

    const json = await res.json() as { data: AsanaTask[]; next_page: { offset: string } | null };
    allTasks.push(...json.data);
    offset = json.next_page?.offset;
  } while (offset);

  return allTasks;
}

async function fetchProjects(): Promise<{ gid: string; name: string }[]> {
  return asanaFetch<{ gid: string; name: string }[]>('/projects', {
    workspace: WORKSPACE_GID,
    opt_fields: 'name',
    archived: 'false',
  });
}

async function syncAsana() {
  if (!API_KEY) {
    logError('ASANA', 'ASANA_API_KEY not set in .env.local');
    process.exit(1);
  }
  if (!WORKSPACE_GID) {
    logError('ASANA', 'ASANA_WORKSPACE_GID not set in .env.local — run with --discover to find it');
    process.exit(1);
  }

  // Discover mode: list workspaces and projects
  if (process.argv.includes('--discover')) {
    log('ASANA', 'Discovering workspaces...');
    const workspaces = await asanaFetch<{ gid: string; name: string }[]>('/workspaces');
    for (const ws of workspaces) {
      log('ASANA', `  Workspace: ${ws.name} (gid: ${ws.gid})`);
    }
    if (WORKSPACE_GID) {
      log('ASANA', 'Discovering projects...');
      const projects = await fetchProjects();
      for (const p of projects) {
        log('ASANA', `  Project: ${p.name} (gid: ${p.gid})`);
      }
    }
    return;
  }

  await initSchema();
  const db = await getDb();
  const now = new Date().toISOString();

  try {
    // Fetch all projects and their tasks
    log('ASANA', 'Fetching projects...');
    const projects = await fetchProjects();
    log('ASANA', `Found ${projects.length} active projects`);

    const allTasks: AsanaTask[] = [];
    const seenGids = new Set<string>();

    for (const project of projects) {
      log('ASANA', `Fetching tasks from: ${project.name}...`);
      const tasks = await fetchProjectTasks(project.gid);
      for (const task of tasks) {
        if (!seenGids.has(task.gid)) {
          seenGids.add(task.gid);
          allTasks.push(task);
        }
      }
    }

    log('ASANA', `Total unique tasks: ${allTasks.length}`);

    // Upsert tasks
    const upsert = db.prepare(
      `INSERT INTO asana_tasks (gid, name, assignee_gid, assignee_name, due_on, completed, completed_at, section_name, project_gid, project_name, notes, permalink_url, created_at, modified_at, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(gid) DO UPDATE SET
         name=excluded.name, assignee_gid=excluded.assignee_gid, assignee_name=excluded.assignee_name,
         due_on=excluded.due_on, completed=excluded.completed, completed_at=excluded.completed_at,
         section_name=excluded.section_name, project_gid=excluded.project_gid, project_name=excluded.project_name,
         notes=excluded.notes, permalink_url=excluded.permalink_url, modified_at=excluded.modified_at, synced_at=excluded.synced_at`
    );

    for (const task of allTasks) {
      if (!task.name) continue; // skip empty tasks

      const sectionName = task.memberships?.[0]?.section?.name || null;
      const projectGid = task.projects?.[0]?.gid || null;
      const projectName = task.projects?.[0]?.name || null;

      upsert.run([
        task.gid,
        task.name,
        task.assignee?.gid || null,
        task.assignee?.name || null,
        task.due_on || null,
        task.completed ? 1 : 0,
        task.completed_at || null,
        sectionName,
        projectGid,
        projectName,
        task.notes || null,
        task.permalink_url || null,
        task.created_at || null,
        task.modified_at || null,
        now,
      ]);
    }

    upsert.free();
    saveDb();
    log('ASANA', `Synced ${allTasks.length} tasks successfully`);

  } catch (err) {
    logError('ASANA', 'Sync failed', err);
    process.exit(1);
  } finally {
    closeDb();
  }
}

syncAsana();
