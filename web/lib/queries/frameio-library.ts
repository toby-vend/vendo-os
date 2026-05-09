import { db } from './base.js';

/**
 * Read queries for the /dashboards/frame-io/library tree-view.
 *
 * The library mirror lives in `frameio_assets` (created by sync-library.ts).
 * Three views are surfaced:
 *
 *   - Workspace overview — list of projects with video counts
 *   - Project tree     — folders + videos beneath one project, breadcrumb path
 *   - Folder children  — flat list of immediate children of a folder
 *
 * Tolerates a missing table the same way the dashboard queries do — fresh
 * environments render an empty state instead of 500ing.
 */

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (String((err as Error).message ?? '').includes('no such table')) return fallback;
    throw err;
  }
}

export interface ProjectOverview {
  projectId: string;
  name: string;
  workspaceId: string | null;
  viewUrl: string | null;
  videoCount: number;
  folderCount: number;
  totalSize: number;
  lastUpdatedAt: string | null;
  rootFolderId: string | null;
  clientName: string | null;
}

export async function getProjectsOverview(): Promise<ProjectOverview[]> {
  return safe(async () => {
    const r = await db.execute({
      sql: `
        SELECT  p.id AS project_id,
                p.name,
                p.workspace_id,
                p.view_url,
                p.updated_at,
                p.file_size AS total_size,
                (SELECT COUNT(*) FROM frameio_assets v
                   WHERE v.project_id = p.id AND v.type = 'file' AND v.deleted_at IS NULL) AS video_count,
                (SELECT COUNT(*) FROM frameio_assets f
                   WHERE f.project_id = p.id AND f.type = 'folder' AND f.deleted_at IS NULL) AS folder_count,
                (SELECT id FROM frameio_assets r
                   WHERE r.project_id = p.id AND r.type = 'folder' AND r.parent_id IS NULL AND r.deleted_at IS NULL
                   LIMIT 1) AS root_folder_id,
                c.name AS client_name
          FROM frameio_assets p
     LEFT JOIN client_source_mappings csm
                ON csm.source = 'frameio' AND csm.external_id = p.id
     LEFT JOIN clients c
                ON c.id = csm.client_id
         WHERE p.type = 'project' AND p.deleted_at IS NULL
      ORDER BY p.name
      `,
      args: [],
    });
    return r.rows.map((row) => {
      const x = row as unknown as Record<string, unknown>;
      return {
        projectId: String(x.project_id),
        name: String(x.name),
        workspaceId: (x.workspace_id as string | null) ?? null,
        viewUrl: (x.view_url as string | null) ?? null,
        videoCount: Number(x.video_count ?? 0),
        folderCount: Number(x.folder_count ?? 0),
        totalSize: Number(x.total_size ?? 0),
        lastUpdatedAt: (x.updated_at as string | null) ?? null,
        rootFolderId: (x.root_folder_id as string | null) ?? null,
        clientName: (x.client_name as string | null) ?? null,
      };
    });
  }, []);
}

export interface FolderEntry {
  id: string;
  type: 'folder' | 'file';
  name: string;
  fileSize: number | null;
  mediaType: string | null;
  viewUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/** Immediate children of a folder, with folders first, then videos by name. */
export async function getFolderChildren(folderId: string): Promise<FolderEntry[]> {
  return safe(async () => {
    const r = await db.execute({
      sql: `SELECT id, type, name, file_size, media_type, view_url, created_at, updated_at
              FROM frameio_assets
             WHERE parent_id = ?
               AND type IN ('folder', 'file')
               AND deleted_at IS NULL
          ORDER BY (CASE type WHEN 'folder' THEN 0 ELSE 1 END), name`,
      args: [folderId],
    });
    return r.rows.map((row) => {
      const x = row as unknown as Record<string, unknown>;
      return {
        id: String(x.id),
        type: x.type === 'folder' ? 'folder' : 'file',
        name: String(x.name),
        fileSize: (x.file_size as number | null) ?? null,
        mediaType: (x.media_type as string | null) ?? null,
        viewUrl: (x.view_url as string | null) ?? null,
        createdAt: (x.created_at as string | null) ?? null,
        updatedAt: (x.updated_at as string | null) ?? null,
      } as FolderEntry;
    });
  }, []);
}

export interface BreadcrumbCrumb { id: string; name: string; type: string }

/** Walk parent_id chain up to the project to render breadcrumb. */
export async function getBreadcrumb(folderId: string): Promise<BreadcrumbCrumb[]> {
  return safe(async () => {
    const crumbs: BreadcrumbCrumb[] = [];
    let cursor: string | null = folderId;
    for (let i = 0; i < 20 && cursor; i += 1) {
      const r = await db.execute({
        sql: 'SELECT id, name, type, parent_id, project_id FROM frameio_assets WHERE id = ? LIMIT 1',
        args: [cursor],
      });
      if (r.rows.length === 0) break;
      const x = r.rows[0] as unknown as Record<string, unknown>;
      const isRoot = (x.name as string) === 'root';
      // Hide the synthetic 'root' folder from the breadcrumb — it's noise.
      if (!isRoot) crumbs.unshift({ id: String(x.id), name: String(x.name), type: String(x.type) });
      cursor = (x.parent_id as string | null) ?? null;
      // If we've walked past the root, hop to the project row by id == project_id.
      if (cursor === null && (x.type as string) === 'folder') {
        const projectId = x.project_id as string | undefined;
        if (projectId && projectId !== x.id) {
          cursor = projectId;
        }
      }
    }
    return crumbs;
  }, []);
}

export interface LibraryStats {
  totalProjects: number;
  totalFolders: number;
  totalVideos: number;
  totalSize: number;
  lastSyncAt: string | null;
}

export async function getLibraryStats(): Promise<LibraryStats> {
  return safe(async () => {
    const r = await db.execute({
      sql: `
        SELECT
          SUM(CASE WHEN type = 'project' THEN 1 ELSE 0 END) AS projects,
          SUM(CASE WHEN type = 'folder'  THEN 1 ELSE 0 END) AS folders,
          SUM(CASE WHEN type = 'file'    THEN 1 ELSE 0 END) AS videos,
          SUM(CASE WHEN type = 'file'    THEN file_size ELSE 0 END) AS total_size,
          MAX(synced_at) AS last_sync_at
        FROM frameio_assets WHERE deleted_at IS NULL`,
      args: [],
    });
    const x = r.rows[0] as unknown as Record<string, unknown>;
    return {
      totalProjects: Number(x.projects ?? 0),
      totalFolders: Number(x.folders ?? 0),
      totalVideos: Number(x.videos ?? 0),
      totalSize: Number(x.total_size ?? 0),
      lastSyncAt: (x.last_sync_at as string | null) ?? null,
    };
  }, { totalProjects: 0, totalFolders: 0, totalVideos: 0, totalSize: 0, lastSyncAt: null });
}
