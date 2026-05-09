/**
 * One-off Frame.io library backfill.
 *
 * Usage:
 *   npm run sync:frameio
 *
 * Walks every Frame.io workspace → project → folder tree, mirrors video
 * files + their containing folders into the `frameio_assets` table, and
 * soft-deletes anything that has disappeared since the previous run.
 *
 * Safe to re-run: rows are upserted by id, and the `deleted_at` flag is
 * cleared on every successful re-sync.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { syncFrameioLibrary } = await import('../../web/lib/frameio/sync-library.js');

  console.log('[sync-frameio] starting…');
  const t0 = Date.now();
  const result = await syncFrameioLibrary({
    logger: (msg) => console.log('[sync-frameio]', msg),
  });
  const seconds = ((Date.now() - t0) / 1000).toFixed(1);

  console.log('');
  console.log('[sync-frameio] done in', seconds, 's');
  console.log('[sync-frameio] workspaces:', result.workspacesScanned);
  console.log('[sync-frameio] projects:  ', result.projectsScanned);
  console.log('[sync-frameio] folders:   ', result.foldersScanned);
  console.log('[sync-frameio] videos:    ', result.videosFound);
  console.log('[sync-frameio] upserted:  ', result.rowsUpserted);
  console.log('[sync-frameio] soft-del:  ', result.rowsSoftDeleted);
  if (result.errors.length > 0) {
    console.log('[sync-frameio] errors:');
    for (const e of result.errors) console.log('  ', e.where, '→', e.message);
  }
}

main().catch((err) => {
  console.error('[sync-frameio] failed:', err);
  process.exit(1);
});
