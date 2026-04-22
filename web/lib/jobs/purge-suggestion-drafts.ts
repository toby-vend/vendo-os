import { del } from '@vercel/blob';
import { purgeStaleDrafts, purgeOrphanAttachments } from '../queries/suggestions.js';

/**
 * Daily maintenance: clear out suggestion drafts older than 7 days plus any
 * Vercel Blob attachments that were uploaded but never tied to a submitted
 * suggestion. Safe to run anywhere — idempotent by construction.
 */
export async function purgeSuggestionDrafts(): Promise<{
  draftsDeleted: number;
  attachmentsDeleted: number;
  blobErrors: number;
}> {
  const draftsDeleted = await purgeStaleDrafts(7);
  const orphans = await purgeOrphanAttachments();

  let blobErrors = 0;
  for (const a of orphans) {
    try {
      await del(a.blob_url);
    } catch (err) {
      blobErrors += 1;
      // Best-effort cleanup — log and continue.
      console.warn(`[purge-suggestion-drafts] Failed to delete blob ${a.blob_pathname}:`, err);
    }
  }

  return {
    draftsDeleted,
    attachmentsDeleted: orphans.length,
    blobErrors,
  };
}
