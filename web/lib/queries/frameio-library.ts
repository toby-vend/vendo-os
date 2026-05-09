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
  /** For folder rows: total videos in this folder *and all its descendants*.
   *  Always 0 for file rows. Helps users avoid drilling into empty branches. */
  descendantVideos: number;
}

/**
 * Walk the entire subtree rooted at `folderId` and tally how many videos
 * sit beneath each *immediate* child folder. Done in JS rather than a
 * recursive CTE because libSQL CTE support varies and our trees are
 * tiny (max depth ~10, max ~1000 nodes).
 */
async function videosByImmediateChildFolder(folderId: string): Promise<Map<string, number>> {
  // First, fetch the project_id for the starting folder so we can scope the
  // walk to a single project (folder ids are globally unique but this keeps
  // the SQL cheap and tidy).
  const root = await db.execute({
    sql: 'SELECT project_id FROM frameio_assets WHERE id = ? LIMIT 1',
    args: [folderId],
  });
  const projectId = (root.rows[0] as unknown as { project_id?: string } | undefined)?.project_id;
  if (!projectId) return new Map();

  // Pull every node in the project. ~24 to ~120 rows per project, trivial.
  const r = await db.execute({
    sql: `SELECT id, parent_id, type FROM frameio_assets
            WHERE project_id = ? AND deleted_at IS NULL`,
    args: [projectId],
  });

  const parentOf = new Map<string, string | null>();
  const isVideo = new Map<string, boolean>();
  for (const row of r.rows) {
    const x = row as unknown as { id: string; parent_id: string | null; type: string };
    parentOf.set(x.id, x.parent_id);
    if (x.type === 'file') isVideo.set(x.id, true);
  }

  // Find immediate child folders of the starting folder.
  const immediateChildren = Array.from(parentOf.entries())
    .filter(([, p]) => p === folderId)
    .map(([id]) => id);
  const counts = new Map<string, number>(immediateChildren.map((id) => [id, 0]));

  // For every video, walk up parents until we either hit one of the
  // immediate children (record under it) or run off the top (skip).
  for (const videoId of isVideo.keys()) {
    let cursor: string | null = videoId;
    // Walk up. When parent is the starting folder, the previous step is one
    // of the immediate children (or it's directly under the starting folder
    // — in which case it's a leaf video, not a descendant of a sub-folder).
    let prev: string | null = null;
    let safety = 50;
    while (cursor && safety-- > 0) {
      if (cursor === folderId) {
        if (prev && counts.has(prev)) counts.set(prev, (counts.get(prev) ?? 0) + 1);
        break;
      }
      prev = cursor;
      cursor = parentOf.get(cursor) ?? null;
    }
  }
  return counts;
}

/** Immediate children of a folder, with folders first, then videos by name. */
export async function getFolderChildren(folderId: string): Promise<FolderEntry[]> {
  return safe(async () => {
    const [r, descendantCounts] = await Promise.all([
      db.execute({
        sql: `SELECT id, type, name, file_size, media_type, view_url, created_at, updated_at
                FROM frameio_assets
               WHERE parent_id = ?
                 AND type IN ('folder', 'file')
                 AND deleted_at IS NULL
            ORDER BY (CASE type WHEN 'folder' THEN 0 ELSE 1 END), name`,
        args: [folderId],
      }),
      videosByImmediateChildFolder(folderId),
    ]);
    return r.rows.map((row) => {
      const x = row as unknown as Record<string, unknown>;
      const id = String(x.id);
      const typed = x.type === 'folder' ? 'folder' : 'file';
      // Count immediate-child videos in this folder too (not just descendants
      // of *sub*-folders), so a folder containing 5 direct videos shows '5'.
      let descendantVideos = 0;
      if (typed === 'folder') descendantVideos = descendantCounts.get(id) ?? 0;
      return {
        id,
        type: typed,
        name: String(x.name),
        fileSize: (x.file_size as number | null) ?? null,
        mediaType: (x.media_type as string | null) ?? null,
        viewUrl: (x.view_url as string | null) ?? null,
        createdAt: (x.created_at as string | null) ?? null,
        updatedAt: (x.updated_at as string | null) ?? null,
        descendantVideos,
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

export interface SearchHit {
  id: string;
  name: string;
  type: 'folder' | 'file';
  mediaType: string | null;
  viewUrl: string | null;
  parentId: string | null;
  projectId: string;
  projectName: string;
  /** Folder breadcrumb from project root → parent folder, joined with ' › '. */
  path: string;
}

/**
 * Substring search across all mirrored Frame.io assets (videos + folders).
 *
 * Walks each project's tree once to build a path string per matching node,
 * because joining all the parent rows in SQL is awkward and the dataset is
 * tiny (~1k rows). Limited to 30 hits to keep responses snappy.
 */
export async function searchLibrary(query: string, limit = 30): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  return safe(async () => {
    const matches = await db.execute({
      sql: `SELECT id, name, type, media_type, view_url, parent_id, project_id
              FROM frameio_assets
             WHERE deleted_at IS NULL
               AND type IN ('folder', 'file')
               AND LOWER(name) LIKE LOWER(?)
          ORDER BY (CASE type WHEN 'file' THEN 0 ELSE 1 END), name
             LIMIT ?`,
      args: [`%${q}%`, limit * 2], // overfetch a bit; we'll trim once paths resolve
    });
    if (matches.rows.length === 0) return [];

    // Pull every project + folder for path resolution. Cheap.
    const all = await db.execute({
      sql: `SELECT id, name, parent_id, type, project_id
              FROM frameio_assets WHERE deleted_at IS NULL AND type IN ('project', 'folder')`,
      args: [],
    });
    const byId = new Map<string, { name: string; parent_id: string | null; type: string; project_id: string }>();
    for (const row of all.rows) {
      const x = row as unknown as { id: string; name: string; parent_id: string | null; type: string; project_id: string };
      byId.set(x.id, { name: x.name, parent_id: x.parent_id, type: x.type, project_id: x.project_id });
    }

    const hits: SearchHit[] = [];
    for (const row of matches.rows) {
      const x = row as unknown as {
        id: string; name: string; type: string; media_type: string | null;
        view_url: string | null; parent_id: string | null; project_id: string;
      };
      const projectMeta = byId.get(x.project_id);
      const projectName = projectMeta?.name ?? '(unknown project)';

      // Walk up from parent_id to project to build the path. Skip 'root'.
      const segments: string[] = [];
      let cursor: string | null = x.parent_id;
      let safety = 30;
      while (cursor && safety-- > 0) {
        const node = byId.get(cursor);
        if (!node) break;
        if (node.type === 'project') break;
        if (node.name !== 'root') segments.unshift(node.name);
        cursor = node.parent_id;
      }
      hits.push({
        id: x.id,
        name: x.name,
        type: x.type === 'folder' ? 'folder' : 'file',
        mediaType: x.media_type,
        viewUrl: x.view_url,
        parentId: x.parent_id,
        projectId: x.project_id,
        projectName,
        path: segments.join(' › '),
      });
      if (hits.length >= limit) break;
    }
    return hits;
  }, []);
}
