import { db } from '../queries/base.js';
import {
  listWorkspaces,
  listProjectsInWorkspace,
  listFolderChildren,
  type FrameioFolderChild,
} from './client.js';

/**
 * Walk Frame.io's account → workspace → project → folder → asset tree
 * and mirror it into VendoOS as `frameio_assets` rows.
 *
 * Scope: videos + their containing folders. Non-video files (images, PDFs,
 * version-stack snapshots) are skipped per the Phase 6 design call. Folders
 * always sync (we need them to render the breadcrumb tree).
 *
 * Idempotent: rows are upserted by id and stamped with `synced_at`. Anything
 * not touched in a given run gets `deleted_at` set so the UI can hide it
 * without losing history.
 */

const FRAME_RATE_LIMIT_DELAY_MS = 200; // gentle throttle — well under 100/min/user
const VIDEO_MEDIA_PREFIX = 'video/';

let schemaEnsured = false;

async function ensureSchema(): Promise<void> {
  if (schemaEnsured) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS frameio_assets (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      workspace_id TEXT,
      parent_id TEXT,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT,
      file_size INTEGER,
      media_type TEXT,
      view_url TEXT,
      thumbnail_url TEXT,
      created_at TEXT,
      updated_at TEXT,
      synced_at TEXT NOT NULL,
      deleted_at TEXT
    )
  `);
  await db.execute('CREATE INDEX IF NOT EXISTS idx_frameio_assets_project ON frameio_assets(project_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_frameio_assets_parent ON frameio_assets(parent_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_frameio_assets_type ON frameio_assets(type)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_frameio_assets_media ON frameio_assets(media_type)');
  schemaEnsured = true;
}

function isVideo(child: FrameioFolderChild): boolean {
  if (child.type === 'folder') return false;
  return Boolean(child.media_type && child.media_type.toLowerCase().startsWith(VIDEO_MEDIA_PREFIX));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface UpsertInput {
  id: string;
  accountId: string;
  projectId: string;
  workspaceId: string | null;
  parentId: string | null;
  type: string;
  name: string;
  status: string | null;
  fileSize: number | null;
  mediaType: string | null;
  viewUrl: string | null;
  thumbnailUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

async function upsertAsset(row: UpsertInput, syncedAt: string): Promise<void> {
  await db.execute({
    sql: `INSERT INTO frameio_assets (id, account_id, project_id, workspace_id, parent_id, type, name,
                                       status, file_size, media_type, view_url, thumbnail_url,
                                       created_at, updated_at, synced_at, deleted_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
          ON CONFLICT(id) DO UPDATE SET
            account_id = excluded.account_id,
            project_id = excluded.project_id,
            workspace_id = excluded.workspace_id,
            parent_id = excluded.parent_id,
            type = excluded.type,
            name = excluded.name,
            status = excluded.status,
            file_size = excluded.file_size,
            media_type = excluded.media_type,
            view_url = excluded.view_url,
            thumbnail_url = excluded.thumbnail_url,
            created_at = COALESCE(excluded.created_at, frameio_assets.created_at),
            updated_at = excluded.updated_at,
            synced_at = excluded.synced_at,
            deleted_at = NULL`,
    args: [
      row.id,
      row.accountId,
      row.projectId,
      row.workspaceId,
      row.parentId,
      row.type,
      row.name,
      row.status,
      row.fileSize,
      row.mediaType,
      row.viewUrl,
      row.thumbnailUrl,
      row.createdAt,
      row.updatedAt,
      syncedAt,
    ],
  });
}

export interface SyncResult {
  durationMs: number;
  workspacesScanned: number;
  projectsScanned: number;
  foldersScanned: number;
  videosFound: number;
  rowsUpserted: number;
  rowsSoftDeleted: number;
  errors: Array<{ where: string; message: string }>;
}

/**
 * Full-account sync. Walks every workspace → project → folder tree.
 *
 * Run from cron (`/api/cron/sync-frameio`) or CLI (`npm run sync:frameio`).
 */
export async function syncFrameioLibrary(opts?: { accountId?: string; logger?: (msg: string) => void }): Promise<SyncResult> {
  await ensureSchema();
  const start = Date.now();
  const log = opts?.logger ?? (() => {});
  const result: SyncResult = {
    durationMs: 0,
    workspacesScanned: 0,
    projectsScanned: 0,
    foldersScanned: 0,
    videosFound: 0,
    rowsUpserted: 0,
    rowsSoftDeleted: 0,
    errors: [],
  };
  const syncedAt = new Date().toISOString();
  const seen = new Set<string>();

  // We pin to the account-id we're already using elsewhere if not passed.
  // Multi-account support could iterate over Frame.io's `/v4/accounts` list,
  // but Vendo only has one Frame.io account today.
  const accountId = opts?.accountId ?? '915ca91e-31fe-4f6a-bfb6-29e661cf1297';

  let workspaces;
  try {
    workspaces = await listWorkspaces(accountId);
  } catch (err) {
    result.errors.push({ where: 'listWorkspaces', message: (err as Error).message });
    result.durationMs = Date.now() - start;
    return result;
  }
  log(`workspaces: ${workspaces.length}`);

  for (const ws of workspaces) {
    result.workspacesScanned += 1;
    let projects;
    try {
      projects = await listProjectsInWorkspace(accountId, ws.id);
    } catch (err) {
      result.errors.push({ where: `workspace ${ws.id}`, message: (err as Error).message });
      continue;
    }
    log(`  workspace "${ws.name}" — ${projects.length} project(s)`);

    for (const p of projects) {
      result.projectsScanned += 1;

      // Stamp the project itself as a synthetic 'project' row so the library
      // tree can hang folders off it.
      await upsertAsset(
        {
          id: p.id,
          accountId,
          projectId: p.id,
          workspaceId: ws.id,
          parentId: null,
          type: 'project',
          name: p.name,
          status: p.status,
          fileSize: typeof p.storage === 'number' ? p.storage : null,
          mediaType: null,
          viewUrl: p.view_url,
          thumbnailUrl: null,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        },
        syncedAt,
      );
      seen.add(p.id);
      result.rowsUpserted += 1;

      // Walk the folder tree starting from root_folder_id.
      const rootFolderId = p.root_folder_id;
      if (!rootFolderId) continue;

      const queue: Array<{ id: string; depth: number }> = [{ id: rootFolderId, depth: 0 }];
      while (queue.length > 0) {
        const { id: folderId, depth } = queue.shift()!;
        if (depth > 10) {
          result.errors.push({ where: `folder ${folderId}`, message: 'depth>10 — bailing to avoid loops' });
          continue;
        }
        result.foldersScanned += 1;
        let children: FrameioFolderChild[];
        try {
          children = await listFolderChildren(accountId, folderId);
        } catch (err) {
          result.errors.push({ where: `folder ${folderId}`, message: (err as Error).message });
          continue;
        }
        await sleep(FRAME_RATE_LIMIT_DELAY_MS);

        for (const c of children) {
          if (c.type === 'folder') {
            await upsertAsset(
              {
                id: c.id,
                accountId,
                projectId: c.project_id,
                workspaceId: ws.id,
                parentId: c.parent_id,
                type: 'folder',
                name: c.name,
                status: c.status ?? null,
                fileSize: null,
                mediaType: null,
                viewUrl: c.view_url ?? null,
                thumbnailUrl: null,
                createdAt: c.created_at,
                updatedAt: c.updated_at,
              },
              syncedAt,
            );
            seen.add(c.id);
            result.rowsUpserted += 1;
            queue.push({ id: c.id, depth: depth + 1 });
          } else if (isVideo(c)) {
            await upsertAsset(
              {
                id: c.id,
                accountId,
                projectId: c.project_id,
                workspaceId: ws.id,
                parentId: c.parent_id,
                type: 'file',
                name: c.name,
                status: c.status ?? null,
                fileSize: c.file_size ?? null,
                mediaType: c.media_type ?? null,
                viewUrl: c.view_url ?? null,
                thumbnailUrl: c.thumbnail_url ?? null,
                createdAt: c.created_at,
                updatedAt: c.updated_at,
              },
              syncedAt,
            );
            seen.add(c.id);
            result.rowsUpserted += 1;
            result.videosFound += 1;
          }
          // non-video files are intentionally skipped
        }
      }
    }
  }

  // Soft-delete anything we didn't see this run.
  if (seen.size > 0) {
    // libSQL doesn't support large IN lists nicely; chunk the kept-set.
    const keptIds = Array.from(seen);
    const CHUNK = 200;
    let totalKept = 0;
    for (let i = 0; i < keptIds.length; i += CHUNK) {
      const chunk = keptIds.slice(i, i + CHUNK);
      const placeholders = chunk.map(() => '?').join(',');
      const r = await db.execute({
        sql: `SELECT COUNT(*) AS n FROM frameio_assets WHERE id IN (${placeholders})`,
        args: chunk,
      });
      totalKept += Number((r.rows[0] as unknown as { n: number }).n);
    }
    const before = await db.execute({ sql: 'SELECT COUNT(*) AS n FROM frameio_assets WHERE deleted_at IS NULL', args: [] });
    const beforeN = Number((before.rows[0] as unknown as { n: number }).n);
    if (beforeN > totalKept) {
      // Mark rows not in the kept set as deleted. Do it in chunks too.
      // Simpler: stamp everything older than this run's syncedAt.
      const r = await db.execute({
        sql: `UPDATE frameio_assets SET deleted_at = ?
              WHERE synced_at < ? AND deleted_at IS NULL`,
        args: [syncedAt, syncedAt],
      });
      result.rowsSoftDeleted = r.rowsAffected ?? 0;
    }
  }

  result.durationMs = Date.now() - start;
  return result;
}
