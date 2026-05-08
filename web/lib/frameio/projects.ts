import { db } from '../queries/base.js';
import { getProject } from './client.js';
import { findBestClientMatch } from './match.js';

/**
 * Frame.io project resolver.
 *
 * Wraps the V4 project endpoint with a local cache so we only hit Frame.io
 * once per project, plus auto-matches projects to VendoOS clients via
 * `findBestClientMatch`. Mappings are stored in the existing
 * `client_source_mappings` table (`source = 'frameio'`).
 *
 * Project metadata (name, view_url, workspace, etc.) is cached in a new
 * `frameio_projects` table — handy for the admin mapping UI without
 * needing to re-call Frame.io.
 *
 * Resolution result:
 *   - `client = ...`        — mapping exists, ready to fan out
 *   - `client = null, queued = true` — first time we've seen this project,
 *                                      either no auto-match or below
 *                                      threshold; admin must review
 */

let schemaEnsured = false;

async function ensureSchema(): Promise<void> {
  if (schemaEnsured) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS frameio_projects (
      project_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      workspace_id TEXT,
      account_id TEXT,
      view_url TEXT,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      details_fetched_at TEXT
    )
  `);
  // Match queue: rows here are projects we've seen but couldn't auto-match.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS frameio_project_match_queue (
      project_id TEXT PRIMARY KEY,
      best_client_id INTEGER,
      best_client_name TEXT,
      best_confidence REAL,
      best_method TEXT,
      created_at TEXT NOT NULL,
      reviewed_at TEXT,
      dismissed_at TEXT
    )
  `);
  schemaEnsured = true;
}

interface ResolvedProject {
  projectId: string;
  projectName: string;
  workspaceId: string | null;
  accountId: string | null;
  viewUrl: string | null;
  client: { id: number; name: string } | null;
  queued: boolean;          // true iff project newly added to match queue
}

export async function resolveProject(opts: {
  accountId: string;
  projectId: string;
}): Promise<ResolvedProject | null> {
  await ensureSchema();

  // 1. Existing mapping?
  const mapping = await db.execute({
    sql: `SELECT csm.client_id, csm.external_name, c.name AS client_name
          FROM client_source_mappings csm
          JOIN clients c ON c.id = csm.client_id
          WHERE csm.source = 'frameio' AND csm.external_id = ?`,
    args: [opts.projectId],
  });
  const mapped = mapping.rows[0] as unknown as
    | { client_id: number; external_name: string | null; client_name: string }
    | undefined;

  // 2. Get project details — from cache if present, otherwise fetch.
  const cached = await db.execute({
    sql: 'SELECT name, workspace_id, account_id, view_url FROM frameio_projects WHERE project_id = ?',
    args: [opts.projectId],
  });
  let projectName: string;
  let workspaceId: string | null;
  let accountId: string | null;
  let viewUrl: string | null;

  if (cached.rows.length > 0) {
    const row = cached.rows[0] as unknown as { name: string; workspace_id: string | null; account_id: string | null; view_url: string | null };
    projectName = row.name;
    workspaceId = row.workspace_id;
    accountId = row.account_id;
    viewUrl = row.view_url;
    await db.execute({
      sql: 'UPDATE frameio_projects SET last_seen_at = ? WHERE project_id = ?',
      args: [new Date().toISOString(), opts.projectId],
    });
  } else {
    const project = await getProject(opts.accountId, opts.projectId);
    if (!project) {
      // Project deleted or out of scope — can't resolve.
      return null;
    }
    projectName = project.name;
    workspaceId = project.workspace_id;
    accountId = opts.accountId;
    viewUrl = project.view_url;
    const now = new Date().toISOString();
    await db.execute({
      sql: `INSERT INTO frameio_projects (project_id, name, workspace_id, account_id, view_url, first_seen_at, last_seen_at, details_fetched_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(project_id) DO UPDATE SET
              name = excluded.name,
              workspace_id = excluded.workspace_id,
              account_id = excluded.account_id,
              view_url = excluded.view_url,
              last_seen_at = excluded.last_seen_at,
              details_fetched_at = excluded.details_fetched_at`,
      args: [opts.projectId, projectName, workspaceId, accountId, viewUrl, now, now, now],
    });
  }

  if (mapped) {
    return {
      projectId: opts.projectId,
      projectName,
      workspaceId,
      accountId,
      viewUrl,
      client: { id: mapped.client_id, name: mapped.client_name },
      queued: false,
    };
  }

  // 3. No mapping yet — try auto-match.
  const match = await findBestClientMatch(projectName);
  if (match && match.autoApplied) {
    const now = new Date().toISOString();
    await db.execute({
      sql: `INSERT INTO client_source_mappings (client_id, source, external_id, external_name, created_at)
            VALUES (?, 'frameio', ?, ?, ?)
            ON CONFLICT(source, external_id) DO NOTHING`,
      args: [match.clientId, opts.projectId, projectName, now],
    });
    // Clean up any queue row that may exist
    await db.execute({
      sql: 'DELETE FROM frameio_project_match_queue WHERE project_id = ?',
      args: [opts.projectId],
    });
    return {
      projectId: opts.projectId,
      projectName,
      workspaceId,
      accountId,
      viewUrl,
      client: { id: match.clientId, name: match.clientName },
      queued: false,
    };
  }

  // 4. No confident auto-match — record best guess in queue for admin review.
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO frameio_project_match_queue (project_id, best_client_id, best_client_name, best_confidence, best_method, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(project_id) DO UPDATE SET
            best_client_id = excluded.best_client_id,
            best_client_name = excluded.best_client_name,
            best_confidence = excluded.best_confidence,
            best_method = excluded.best_method`,
    args: [
      opts.projectId,
      match?.clientId ?? null,
      match?.clientName ?? null,
      match?.confidence ?? null,
      match?.method ?? null,
      now,
    ],
  });

  return {
    projectId: opts.projectId,
    projectName,
    workspaceId,
    accountId,
    viewUrl,
    client: null,
    queued: true,
  };
}

/** Manually link a Frame.io project to a VendoOS client. Used by admin UI. */
export async function linkProjectToClient(opts: {
  projectId: string;
  clientId: number;
}): Promise<void> {
  await ensureSchema();
  const c = await db.execute({ sql: 'SELECT name FROM clients WHERE id = ?', args: [opts.clientId] });
  const clientName = (c.rows[0] as unknown as { name: string } | undefined)?.name;
  if (!clientName) throw new Error(`Unknown client id ${opts.clientId}`);

  const proj = await db.execute({
    sql: 'SELECT name FROM frameio_projects WHERE project_id = ?',
    args: [opts.projectId],
  });
  const projectName = (proj.rows[0] as unknown as { name: string } | undefined)?.name ?? opts.projectId;

  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO client_source_mappings (client_id, source, external_id, external_name, created_at)
          VALUES (?, 'frameio', ?, ?, ?)
          ON CONFLICT(source, external_id) DO UPDATE SET client_id = excluded.client_id, external_name = excluded.external_name`,
    args: [opts.clientId, opts.projectId, projectName, now],
  });
  await db.execute({
    sql: 'UPDATE frameio_project_match_queue SET reviewed_at = ? WHERE project_id = ?',
    args: [now, opts.projectId],
  });
}
