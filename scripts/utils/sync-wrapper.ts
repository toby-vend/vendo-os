/**
 * Wraps sync script execution with error handling, timing, and DB logging.
 *
 * Usage in a sync script:
 *   import { withSyncErrorHandling } from '../utils/sync-wrapper.js';
 *   await withSyncErrorHandling('xero', async () => { ... your sync logic ... });
 */

import { getDb, saveDb, log, logError } from './db.js';
import { sendSlackAlert } from './slack-alert.js';

export interface SyncResult {
  source: string;
  success: boolean;
  durationMs: number;
  error?: string;
}

export async function withSyncErrorHandling(
  source: string,
  fn: () => Promise<void>
): Promise<SyncResult> {
  const start = Date.now();
  log(source, `Sync started`);

  try {
    await fn();
    const durationMs = Date.now() - start;
    log(source, `Sync completed in ${(durationMs / 1000).toFixed(1)}s`);
    return { source, success: true, durationMs };
  } catch (err) {
    const durationMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack ?? null : null;

    logError(source, 'Sync failed', err);

    // Log to database
    try {
      const db = await getDb();
      db.run(
        `INSERT INTO sync_errors (source, severity, message, stack, created_at) VALUES (?, 'error', ?, ?, ?)`,
        [source, message, stack, new Date().toISOString()]
      );
      saveDb();
    } catch { /* don't let logging failure mask the original error */ }

    // Alert via Slack
    await sendSlackAlert(source, message).catch(() => {});

    return { source, success: false, durationMs, error: message };
  }
}

export async function logSyncWarning(
  source: string,
  message: string,
  context?: string
): Promise<void> {
  log(source, `WARNING: ${message}`);
  try {
    const db = await getDb();
    db.run(
      `INSERT INTO sync_errors (source, severity, message, context, created_at) VALUES (?, 'warning', ?, ?, ?)`,
      [source, message, context ?? null, new Date().toISOString()]
    );
    saveDb();
  } catch { /* swallow */ }
}
