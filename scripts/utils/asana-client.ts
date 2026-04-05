/**
 * Asana REST API client for creating tasks programmatically.
 * Set ASANA_PAT and ASANA_WORKSPACE_ID in .env.local.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const PAT = process.env.ASANA_PAT;
const WORKSPACE_ID = process.env.ASANA_WORKSPACE_ID;
const BASE_URL = 'https://app.asana.com/api/1.0';

interface AsanaTaskResult {
  gid: string;
  name: string;
  permalink_url: string;
}

export async function createAsanaTask(opts: {
  projectId?: string;
  name: string;
  notes: string;
  assigneeEmail?: string;
  dueDate?: string; // YYYY-MM-DD
  tags?: string[];
}): Promise<AsanaTaskResult | null> {
  if (!PAT || !WORKSPACE_ID) {
    console.warn('[asana] ASANA_PAT or ASANA_WORKSPACE_ID not set — skipping task creation');
    return null;
  }

  const body: Record<string, unknown> = {
    data: {
      workspace: WORKSPACE_ID,
      name: opts.name,
      notes: opts.notes,
      ...(opts.projectId ? { projects: [opts.projectId] } : {}),
      ...(opts.dueDate ? { due_on: opts.dueDate } : {}),
    },
  };

  try {
    const res = await fetch(`${BASE_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const json = await res.json() as { data: AsanaTaskResult };

    if (!res.ok) {
      console.error(`[asana] Failed to create task: ${res.status}`, json);
      return null;
    }

    // Assign via email if provided (separate call)
    if (opts.assigneeEmail && json.data?.gid) {
      await fetch(`${BASE_URL}/tasks/${json.data.gid}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${PAT}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: { assignee: opts.assigneeEmail } }),
      });
    }

    console.log(`[asana] Created task: ${json.data?.name} (${json.data?.permalink_url})`);
    return json.data;
  } catch (err) {
    console.error(`[asana] Error creating task: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

/**
 * Look up the Asana project GID for a client via client_source_mappings.
 * Returns the project GID or the default project as fallback.
 */
export async function getAsanaProjectForClient(clientName: string): Promise<string | null> {
  try {
    const { getDb } = await import('./db.js');
    const db = await getDb();
    const result = db.exec(
      `SELECT csm.external_id FROM client_source_mappings csm
       JOIN clients c ON c.id = csm.client_id
       WHERE csm.source = 'asana' AND (c.name = ? OR c.display_name = ?)
       LIMIT 1`,
      [clientName, clientName],
    );
    if (result.length && result[0].values.length) {
      return result[0].values[0][0] as string;
    }
  } catch { /* table may not exist */ }
  return process.env.ASANA_DEFAULT_PROJECT_GID || null;
}

/**
 * Look up the AM name for a client from the clients table.
 */
export async function getClientAM(clientName: string): Promise<string | null> {
  try {
    const { getDb } = await import('./db.js');
    const db = await getDb();
    const result = db.exec(
      'SELECT am FROM clients WHERE (name = ? OR display_name = ?) AND am IS NOT NULL LIMIT 1',
      [clientName, clientName],
    );
    if (result.length && result[0].values.length) {
      return result[0].values[0][0] as string | null;
    }
  } catch { /* column may not exist */ }
  return null;
}

export async function findAsanaUser(email: string): Promise<string | null> {
  if (!PAT || !WORKSPACE_ID) return null;

  try {
    const res = await fetch(
      `${BASE_URL}/workspaces/${WORKSPACE_ID}/users?opt_fields=email,name`,
      { headers: { 'Authorization': `Bearer ${PAT}` } }
    );
    const json = await res.json() as { data: Array<{ gid: string; email: string; name: string }> };
    const user = json.data?.find(u => u.email === email);
    return user?.gid ?? null;
  } catch {
    return null;
  }
}
