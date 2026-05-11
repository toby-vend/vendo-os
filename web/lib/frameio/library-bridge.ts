/**
 * Bridge from the Frame.io library mirror (frameio_assets) to creative_reviews.
 *
 * Today's creative_reviews rows are populated by the cron processor when a
 * file.created / file.ready / comment.created event fires. Files in the
 * library mirror that have never been commented on don't have a review
 * row — so the ad-copy generator can't see them.
 *
 * This module creates one on demand the first time a reviewer asks for
 * ad copy on a library video. It mirrors the schema-write pattern in
 * processor.ts (handleFileCreated / handleCommentCreated).
 */
import { db } from '../queries/base.js';

export interface LibraryReviewBridge {
  reviewId: number;
  /** Whether the row already existed (true) or was created just now (false). */
  preexisting: boolean;
  clientName: string;
  assetName: string;
  fileId: string;
}

export interface LibraryFileNotFound { ok: false; reason: 'file_not_found' | 'not_a_file' }

interface AssetRow {
  id: string;
  name: string;
  type: string;
  project_id: string;
  parent_id: string | null;
  view_url: string | null;
  media_type: string | null;
  file_size: number | null;
  thumbnail_url: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Resolve a Frame.io library file to a creative_review row, creating one
 * if it doesn't exist. Returns the existing or freshly-inserted review
 * id plus enough context for the caller to log / render.
 */
export async function getOrCreateReviewForLibraryFile(
  fileId: string,
): Promise<LibraryReviewBridge | LibraryFileNotFound> {
  // 1. Fast path — existing review for this file.
  const existing = await db.execute({
    sql: 'SELECT id, client_name, asset_name FROM creative_reviews WHERE frameio_file_id = ? LIMIT 1',
    args: [fileId],
  });
  if (existing.rows.length > 0) {
    const row = existing.rows[0] as unknown as { id: number; client_name: string; asset_name: string };
    return {
      reviewId: Number(row.id),
      preexisting: true,
      clientName: row.client_name,
      assetName: row.asset_name,
      fileId,
    };
  }

  // 2. Resolve the file from the library mirror.
  const assetRes = await db.execute({
    sql: `SELECT id, name, type, project_id, parent_id, view_url, media_type,
                 file_size, thumbnail_url, created_at, updated_at
            FROM frameio_assets WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    args: [fileId],
  });
  const asset = assetRes.rows[0] as unknown as AssetRow | undefined;
  if (!asset) return { ok: false, reason: 'file_not_found' };
  if (asset.type !== 'file') return { ok: false, reason: 'not_a_file' };

  // 3. Find the client mapping via client_source_mappings (source='frameio',
  //    external_id = project_id). Fall back to '(unmapped)' so the row can
  //    still be created — the dashboard already flags unmapped clients.
  let clientName = '(unmapped)';
  try {
    const c = await db.execute({
      sql: `SELECT cl.name FROM client_source_mappings csm
              JOIN clients cl ON cl.id = csm.client_id
             WHERE csm.source = 'frameio' AND csm.external_id = ?
             LIMIT 1`,
      args: [asset.project_id],
    });
    const r = c.rows[0] as unknown as { name: string } | undefined;
    if (r?.name) clientName = r.name;
  } catch {
    /* mapping table missing — keep fallback */
  }

  // 4. Derive asset_type from media_type. Videos are 'video', everything
  //    else falls back to 'creative_asset' so the ad-copy generator doesn't
  //    try to transcribe non-video files.
  const assetType = (asset.media_type ?? '').toLowerCase().startsWith('video') ? 'video' : 'creative_asset';

  const now = new Date().toISOString();
  const ins = await db.execute({
    sql: `INSERT INTO creative_reviews
            (client_name, asset_name, asset_type, status, frameio_file_id,
             frameio_project_id, frameio_view_url, created_at, updated_at)
          VALUES (?, ?, ?, 'ready_for_review', ?, ?, ?, ?, ?)
          RETURNING id`,
    args: [clientName, asset.name, assetType, asset.id, asset.project_id, asset.view_url, now, now],
  });
  const reviewId = Number((ins.rows[0] as unknown as { id: number } | undefined)?.id ?? 0);
  return {
    reviewId,
    preexisting: false,
    clientName,
    assetName: asset.name,
    fileId,
  };
}

/** Read a single asset from the library mirror. Returns null when missing. */
export async function getLibraryAsset(fileId: string): Promise<AssetRow | null> {
  const r = await db.execute({
    sql: `SELECT id, name, type, project_id, parent_id, view_url, media_type,
                 file_size, thumbnail_url, created_at, updated_at
            FROM frameio_assets WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    args: [fileId],
  });
  return (r.rows[0] as unknown as AssetRow | undefined) ?? null;
}
