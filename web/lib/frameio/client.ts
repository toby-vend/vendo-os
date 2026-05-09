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

/**
 * V4 wraps every single-resource response in `{ data: {...} }`. We unwrap
 * here so callers get the resource directly. Use `getJsonRaw` for envelope-
 * sensitive endpoints (e.g. paginated lists).
 */
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
  const json = (await res.json()) as { data?: T } | T;
  return ((json as { data?: T }).data ?? (json as T)) ?? null;
}

// --- Domain types (only the fields we use) ---
// Confirmed against live V4 responses on 2026-05-08.

export interface FrameioComment {
  id: string;
  text: string;
  file_id: string | null;
  completer_id: string | null;
  completed_at: string | null;
  text_edited_at: string | null;
  timestamp: number | null;
  duration: number | null;
  annotation: unknown | null;
  attachments: Array<{ id: string; url?: string }>;
  mentions: Array<{ id: string; type?: string }>;
  links: Array<{ url?: string; text?: string }>;
  created_at: string;
  updated_at: string;
}

export interface FrameioFile {
  id: string;
  name: string;
  status?: string | null;
  type?: string | null;
  filesize?: number | null;
  parent_id?: string | null;
  project_id?: string | null;
  workspace_id?: string | null;
  account_id?: string | null;
  view_url?: string | null;
  thumbnail_url?: string | null;
  versions_count?: number | null;
  created_at: string;
  updated_at: string;
}

export interface FrameioProject {
  id: string;
  name: string;
  status: string | null;
  description: string | null;
  restricted: boolean;
  storage: number;
  workspace_id: string | null;
  root_folder_id: string;
  view_url: string;
  created_at: string;
  updated_at: string;
}

export interface FrameioWorkspace {
  id: string;
  name: string;
  account_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface FrameioUser {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url?: string | null;
  /** Frame.io account role — 'member' / 'owner' / 'admin' / etc. for team
   *  members, undefined for guest/review-link commenters who don't appear
   *  in the account-users list. */
  role?: string | null;
}

/** Shape returned by GET /v4/accounts/:id/users (paginated list). */
export interface FrameioAccountUserEntry {
  user: {
    id: string | null;
    name: string | null;
    email: string | null;
    avatar_url: string | null;
    adobe_user_id: string | null;
    active: boolean;
  };
  role: string;
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

/**
 * V4 doesn't expose a get-user-by-id endpoint. We list the account's users
 * and walk pages until we hit the one we want or run out. Pages are small
 * (Vendo's account has ~4 users today) so this is cheap; for accounts with
 * hundreds of members the caller should cache the full list in DB.
 */
export async function listAccountUsers(accountId: string): Promise<FrameioAccountUserEntry[]> {
  const all: FrameioAccountUserEntry[] = [];
  let path: string | null = `/accounts/${accountId}/users`;
  // Hard cap at 50 pages to bound runtime regardless of API behaviour.
  for (let i = 0; i < 50 && path; i += 1) {
    // V4 list endpoints return { data: [...], links: { next?, prev? } }
    const token = await getValidAccessToken();
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new FrameioApiError(res.status, `${BASE_URL}${path}`, body);
    }
    const json = (await res.json()) as { data: FrameioAccountUserEntry[]; links?: { next?: string | null } };
    all.push(...json.data);
    path = json.links?.next ?? null;
    // V4 returns full URLs in links.next — strip the host so getJson-style
    // relative paths still work. (Some hands roll absolute URLs, others
    // relative; tolerate both.)
    if (path && path.startsWith('http')) path = new URL(path).pathname + new URL(path).search;
    if (path && path.startsWith('/v4')) path = path.slice(3);
  }
  return all;
}

export async function getMe(): Promise<{ id: string; email: string | null } | null> {
  return getJson<{ id: string; email: string | null }>('/me');
}

// --- Library walk (Phase 6) ---

export interface FrameioWorkspaceListEntry {
  id: string;
  name: string;
  account_id: string;
  created_at: string;
  updated_at: string;
}

export interface FrameioFolderChild {
  id: string;
  name: string;
  /** 'folder' | 'file' | 'version_stack' | etc. */
  type: string;
  status?: string | null;
  file_size?: number | null;
  /** MIME-style on files (e.g. 'video/quicktime'); null for folders. */
  media_type?: string | null;
  project_id: string;
  parent_id: string | null;
  view_url?: string | null;
  thumbnail_url?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Generic paginator over a `{ data: T[], links: { next? } }` envelope.
 * Mirrors listAccountUsers' next-link normalisation.
 */
async function listAll<T>(initialPath: string): Promise<T[]> {
  const all: T[] = [];
  let path: string | null = initialPath;
  for (let i = 0; i < 100 && path; i += 1) {
    const token = await getValidAccessToken();
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new FrameioApiError(res.status, `${BASE_URL}${path}`, body);
    }
    const json = (await res.json()) as { data: T[]; links?: { next?: string | null } };
    all.push(...json.data);
    path = json.links?.next ?? null;
    if (path && path.startsWith('http')) path = new URL(path).pathname + new URL(path).search;
    if (path && path.startsWith('/v4')) path = path.slice(3);
  }
  return all;
}

export async function listWorkspaces(accountId: string): Promise<FrameioWorkspaceListEntry[]> {
  return listAll<FrameioWorkspaceListEntry>(`/accounts/${accountId}/workspaces`);
}

export async function listProjectsInWorkspace(
  accountId: string,
  workspaceId: string,
): Promise<FrameioProject[]> {
  return listAll<FrameioProject>(`/accounts/${accountId}/workspaces/${workspaceId}/projects`);
}

export async function listFolderChildren(
  accountId: string,
  folderId: string,
): Promise<FrameioFolderChild[]> {
  return listAll<FrameioFolderChild>(`/accounts/${accountId}/folders/${folderId}/children`);
}
