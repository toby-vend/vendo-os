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
