import { rows, scalar, db } from './base.js';

// --- Types ---

export interface BrandHubRow {
  id: number;
  client_id: number;
  client_name: string;
  client_slug: string;
  title: string;
  content: string;
  content_hash: string;
  drive_file_id: string | null;
  drive_modified_at: string | null;
  indexed_at: string;
}

export interface BrandClientRow {
  client_id: number;
  client_name: string;
  client_slug: string;
  file_count: number;
}

export interface BrandSearchResult {
  id: number;
  client_id: number;
  client_name: string;
  client_slug: string;
  title: string;
  content: string;
  drive_file_id: string | null;
  bm25_score: number;
}

// --- Brand Hub Queries ---

/**
 * Return all brand files for a specific client, ordered by title.
 * BRND-04: always requires clientSlug — never returns cross-client data.
 */
export async function getBrandContext(clientSlug: string): Promise<BrandHubRow[]> {
  return rows<BrandHubRow>(
    'SELECT * FROM brand_hub WHERE client_slug = ? ORDER BY title ASC',
    [clientSlug],
  );
}

/**
 * Return distinct clients with their file counts. Never returns content.
 */
export async function listBrandClients(): Promise<BrandClientRow[]> {
  return rows<BrandClientRow>(`
    SELECT client_name, client_slug, client_id, COUNT(*) as file_count
    FROM brand_hub
    GROUP BY client_id
    ORDER BY client_name ASC
  `);
}

/**
 * FTS5 search across brand content.
 * When clientSlug is provided, results are scoped to that client only (BRND-04).
 * Without clientSlug, returns results across all clients (internal global search).
 * Results ordered by bm25 relevance (negative values — ASC = most relevant first).
 */
export async function searchBrandContent(query: string, clientSlug?: string): Promise<BrandSearchResult[]> {
  const ftsQuery = query.replace(/['"]/g, '').trim().split(/\s+/).filter(Boolean).map(w => w + '*').join(' ');

  if (!ftsQuery) return [];

  if (clientSlug) {
    return rows<BrandSearchResult>(`
      SELECT b.id, b.client_id, b.client_name, b.client_slug, b.title, b.content, b.drive_file_id,
             bm25(brand_hub_fts) as bm25_score
      FROM brand_hub_fts fts
      JOIN brand_hub b ON b.rowid = fts.rowid
      WHERE brand_hub_fts MATCH ?
        AND b.client_slug = ?
      ORDER BY bm25(brand_hub_fts) ASC
      LIMIT 10
    `, [ftsQuery, clientSlug]);
  }

  return rows<BrandSearchResult>(`
    SELECT b.id, b.client_id, b.client_name, b.client_slug, b.title, b.content, b.drive_file_id,
           bm25(brand_hub_fts) as bm25_score
    FROM brand_hub_fts fts
    JOIN brand_hub b ON b.rowid = fts.rowid
    WHERE brand_hub_fts MATCH ?
    ORDER BY bm25(brand_hub_fts) ASC
    LIMIT 10
  `, [ftsQuery]);
}

/**
 * Return a single brand file record by Drive file ID. Returns null if not found.
 */
export async function getBrandFile(driveFileId: string): Promise<BrandHubRow | null> {
  const result = await rows<BrandHubRow>(
    'SELECT * FROM brand_hub WHERE drive_file_id = ? LIMIT 1',
    [driveFileId],
  );
  return result[0] ?? null;
}

/**
 * Insert or update a brand file by drive_file_id.
 * Reads old row before upsert for correct FTS5 content-sync.
 */
export async function upsertBrandFromDrive(data: {
  driveFileId: string;
  title: string;
  content: string;
  contentHash: string;
  clientId: number;
  clientName: string;
  clientSlug: string;
  driveModifiedAt: string;
}): Promise<void> {
  // Read old row BEFORE upsert for FTS5 content-sync delete step
  // Use id as rowid alias — libsql maps rowid to the INTEGER PRIMARY KEY column name
  const existing = await rows<{ id: number; client_name: string; content: string }>(
    'SELECT id, client_name, content FROM brand_hub WHERE drive_file_id = ?',
    [data.driveFileId],
  );
  const oldRow = existing[0] ?? null;

  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO brand_hub (drive_file_id, title, client_id, client_name, client_slug, content, content_hash, drive_modified_at, indexed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(drive_file_id) DO UPDATE SET
            title = excluded.title,
            client_id = excluded.client_id,
            client_name = excluded.client_name,
            client_slug = excluded.client_slug,
            content = excluded.content,
            content_hash = excluded.content_hash,
            drive_modified_at = excluded.drive_modified_at,
            indexed_at = excluded.indexed_at`,
    args: [data.driveFileId, data.title, data.clientId, data.clientName, data.clientSlug, data.content, data.contentHash, data.driveModifiedAt, now],
  });

  // Fetch id (rowid alias) after upsert — needed for both INSERT and UPDATE paths
  const rowid = await scalar<number>('SELECT id FROM brand_hub WHERE drive_file_id = ?', [data.driveFileId]);
  if (rowid !== null) {
    if (oldRow) {
      await syncBrandFts(rowid, oldRow.client_name, oldRow.content, data.clientName, data.content);
    } else {
      await syncBrandFts(rowid, '', '', data.clientName, data.content);
    }
  }
}

/**
 * Delete a brand file by Drive file ID.
 * Removes FTS5 entry before deleting the row (required by content-sync tables).
 */
export async function deleteBrandFile(driveFileId: string): Promise<void> {
  const existing = await rows<{ id: number; client_name: string; content: string }>(
    'SELECT id, client_name, content FROM brand_hub WHERE drive_file_id = ?',
    [driveFileId],
  );
  const oldRow = existing[0] ?? null;

  if (oldRow) {
    await deleteBrandFts(oldRow.id, oldRow.client_name, oldRow.content);
  }

  await db.execute({
    sql: 'DELETE FROM brand_hub WHERE drive_file_id = ?',
    args: [driveFileId],
  });
}

// --- FTS5 Sync Helpers ---

/**
 * Update the FTS5 index for a brand hub entry after content changes.
 * Uses the explicit DELETE-then-INSERT pattern required by content-sync tables.
 * oldClientName/oldContent must be the values currently indexed (before update).
 */
export async function syncBrandFts(
  rowid: number,
  oldClientName: string,
  oldContent: string,
  newClientName: string,
  newContent: string,
): Promise<void> {
  await db.execute({
    sql: `INSERT INTO brand_hub_fts(brand_hub_fts, rowid, client_name, content) VALUES(?, ?, ?, ?)`,
    args: ['delete', rowid, oldClientName, oldContent],
  });
  await db.execute({
    sql: `INSERT INTO brand_hub_fts(rowid, client_name, content) VALUES(?, ?, ?)`,
    args: [rowid, newClientName, newContent],
  });
}

/**
 * Remove a brand hub entry from the FTS5 index.
 * Must receive current client_name and content values (required by content-sync tables).
 */
export async function deleteBrandFts(rowid: number, clientName: string, content: string): Promise<void> {
  await db.execute({
    sql: `INSERT INTO brand_hub_fts(brand_hub_fts, rowid, client_name, content) VALUES('delete', ?, ?, ?)`,
    args: [rowid, clientName, content],
  });
}
