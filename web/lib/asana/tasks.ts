/**
 * Thin wrappers around Asana task-mutation endpoints used by the QA page
 * (click-to-reassign, click-to-reassign-client). Kept in one place so the
 * route file stays readable.
 */

const ASANA_API_KEY = process.env.ASANA_API_KEY || process.env.ASANA_PAT || '';
const ASANA_BASE_URL = 'https://app.asana.com/api/1.0';

async function asanaFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!ASANA_API_KEY) throw new Error('ASANA_API_KEY not configured');
  const res = await fetch(`${ASANA_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${ASANA_API_KEY}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Asana API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res;
}

/** Reassign an Asana task to a different user. */
export async function assignAsanaTask(taskGid: string, userGid: string): Promise<void> {
  await asanaFetch(`/tasks/${taskGid}`, {
    method: 'PUT',
    body: JSON.stringify({ data: { assignee: userGid } }),
  });
}

/** Return the list of project gids a task is currently in. */
export async function getAsanaTaskProjects(taskGid: string): Promise<string[]> {
  const res = await asanaFetch(`/tasks/${taskGid}?opt_fields=projects.gid`);
  const json = (await res.json()) as { data: { projects: Array<{ gid: string }> } };
  return (json.data?.projects || []).map((p) => p.gid);
}

export async function addAsanaTaskToProject(taskGid: string, projectGid: string): Promise<void> {
  await asanaFetch(`/tasks/${taskGid}/addProject`, {
    method: 'POST',
    body: JSON.stringify({ data: { project: projectGid } }),
  });
}

export async function removeAsanaTaskFromProject(taskGid: string, projectGid: string): Promise<void> {
  await asanaFetch(`/tasks/${taskGid}/removeProject`, {
    method: 'POST',
    body: JSON.stringify({ data: { project: projectGid } }),
  });
}

/**
 * Create an Asana task in the assignee's My Tasks. If `projects` is supplied
 * the task is attached to those project boards too — otherwise it stays
 * private to the assignee.
 *
 * Name is kept (legacy `createPrivateAsanaTask`) for back-compat but the
 * behaviour is now governed by the optional `projects` arg.
 */
export async function createPrivateAsanaTask(input: {
  name: string;
  /** Omit to create an unassigned task (e.g. when no AM is mapped). */
  assigneeGid?: string;
  dueOn: string;
  notes?: string;
  projects?: string[];
}): Promise<string> {
  const workspaceGid = process.env.ASANA_WORKSPACE_GID || process.env.ASANA_WORKSPACE_ID || '';
  if (!workspaceGid) throw new Error('ASANA_WORKSPACE_GID not configured');
  const projects = (input.projects ?? []).filter(Boolean);
  const res = await asanaFetch('/tasks', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        name: input.name.slice(0, 200),
        notes: input.notes || '',
        due_on: input.dueOn,
        // Asana drops undefined fields on JSON.stringify — leaving the task
        // unassigned when no gid is supplied.
        ...(input.assigneeGid ? { assignee: input.assigneeGid } : {}),
        workspace: workspaceGid,
        ...(projects.length > 0 ? { projects } : {}),
      },
    }),
  });
  const json = (await res.json()) as { data: { gid: string } };
  return json.data.gid;
}
