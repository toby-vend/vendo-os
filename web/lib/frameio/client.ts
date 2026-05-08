import { getValidAccessToken } from './auth.js';

/**
 * Frame.io V4 REST client.
 *
 * Wraps the calls we need for webhook fan-out (resolving comments, files,
 * projects, users, workspaces). Auth uses the OAuth tokens stored by the
 * one-off admin connect flow — see `auth.ts`. The access token is fetched
 * lazily and refreshed automatically when ≤ 60s of life remain.
 *
 * Base URL: https://api.frame.io/v4
 * Resource hierarchy: /v4/accounts/{account_id}/<collection>/<id>
 *
 * Errors:
 *   - 401  → access token rejected. We surface this so the cron can flag the
 *             OAuth connection as broken and prompt re-auth.
 *   - 404  → resource gone. Return null instead of throwing so callers can
 *             tag the originating event as `not_found` rather than retrying.
 *   - 429  → rate limited. Throw a tagged error so the cron can back off.
 */

const BASE_URL = 'https://api.frame.io/v4';

export class FrameioApiError extends Error {
  constructor(public readonly status: number, public readonly url: string, public readonly body: string) {
    super(`Frame.io API ${status} on ${url}: ${body.slice(0, 240)}`);
    this.name = 'FrameioApiError';
  }
  get isAuthError() { return this.status === 401 || this.status === 403; }
  get isNotFound() { return this.status === 404; }
  get isRateLimited() { return this.status === 429; }
}

async function getJson<T>(path: string): Promise<T | null> {
  const token = await getValidAccessToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new FrameioApiError(res.status, `${BASE_URL}${path}`, body);
  }
  return (await res.json()) as T;
}

// --- Domain types (only the fields we use) ---

export interface FrameioComment {
  id: string;
  text: string;
  completed: boolean;
  inserted_at: string;
  owner: { id: string; email: string | null; name: string | null } | null;
  file_id?: string | null;
  asset_id?: string | null;
  timestamp?: number | null;
}

export interface FrameioFile {
  id: string;
  name: string;
  status: string | null;
  filetype: string | null;
  filesize: number | null;
  inserted_at: string;
  parent_id: string | null;
  project_id: string | null;
  uploaded_at: string | null;
  view_count?: number | null;
  versions_count?: number | null;
}

export interface FrameioProject {
  id: string;
  name: string;
  workspace_id: string | null;
  account_id: string | null;
  inserted_at: string;
}

export interface FrameioWorkspace {
  id: string;
  name: string;
  account_id: string | null;
  inserted_at: string;
}

export interface FrameioUser {
  id: string;
  email: string | null;
  name: string | null;
}

// --- Endpoints ---

export async function getComment(accountId: string, commentId: string): Promise<FrameioComment | null> {
  return getJson<FrameioComment>(`/accounts/${accountId}/comments/${commentId}`);
}

export async function getFile(accountId: string, fileId: string): Promise<FrameioFile | null> {
  return getJson<FrameioFile>(`/accounts/${accountId}/files/${fileId}`);
}

export async function getProject(accountId: string, projectId: string): Promise<FrameioProject | null> {
  return getJson<FrameioProject>(`/accounts/${accountId}/projects/${projectId}`);
}

export async function getWorkspace(accountId: string, workspaceId: string): Promise<FrameioWorkspace | null> {
  return getJson<FrameioWorkspace>(`/accounts/${accountId}/workspaces/${workspaceId}`);
}

export async function getUser(accountId: string, userId: string): Promise<FrameioUser | null> {
  // V4 returns user info via the account_users endpoint — exact path may vary
  // by Adobe's roll-out. We try the most common shape first.
  return getJson<FrameioUser>(`/accounts/${accountId}/users/${userId}`);
}

export async function getMe(): Promise<{ id: string; email: string | null } | null> {
  return getJson<{ id: string; email: string | null }>('/me');
}
