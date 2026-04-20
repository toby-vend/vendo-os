import type { FastifyPluginAsync } from 'fastify';
import { exec } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getSyncStatus } from '../lib/queries.js';
import { syncXero } from '../lib/jobs/sync-xero.js';
import { syncGoogleAds } from '../lib/jobs/sync-google-ads.js';
import { syncMetaAds } from '../lib/jobs/sync-meta-ads.js';
import { syncGhl } from '../lib/jobs/sync-ghl.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');

interface SyncSource {
  slug: string;
  label: string;
  /** In-process Turso-native job. Undefined → fall back to exec() (dev-only). */
  run?: () => Promise<unknown>;
  /** Legacy script path for the exec fallback (dev/local only). */
  script?: string;
  /** Display names from getSyncStatus() that this script covers */
  covers: string[];
}

const SYNC_SOURCES: SyncSource[] = [
  { slug: 'meetings', label: 'Meetings', script: 'scripts/sync/sync-meetings.ts', covers: ['Fathom (Meetings)'] },
  { slug: 'meta-ads', label: 'Meta Ads', run: syncMetaAds, covers: ['Meta Ads'] },
  { slug: 'google-ads', label: 'Google Ads', run: syncGoogleAds, covers: ['Google Ads'] },
  { slug: 'ghl', label: 'GHL', run: syncGhl, covers: ['GHL (Pipeline)'] },
  { slug: 'xero', label: 'Xero', run: syncXero, covers: ['Xero (Invoices)', 'Xero (Contacts)', 'Xero (P&L)'] },
];

const SOURCE_MAP = new Map(SYNC_SOURCES.map(s => [s.slug, s]));

/** Build a display-name → slug lookup for the template */
function buildSlugLookup(): Record<string, string> {
  const lookup: Record<string, string> = {};
  for (const s of SYNC_SOURCES) {
    for (const name of s.covers) {
      lookup[name] = s.slug;
    }
  }
  return lookup;
}

const SLUG_LOOKUP = buildSlugLookup();

export const syncStatusRoutes: FastifyPluginAsync = async (app) => {
  // GET / — Full sync status page
  app.get('/', async (request, reply) => {
    const sources = await getSyncStatus();
    const isAdmin = request.user?.role === 'admin';
    reply.render('sync-status', { sources, slugLookup: SLUG_LOOKUP, isAdmin });
  });

  // GET /table — HTMX partial returning just the table body rows
  app.get('/table', async (request, reply) => {
    const sources = await getSyncStatus();
    const isAdmin = request.user?.role === 'admin';
    reply.render('sync-status-rows', { sources, slugLookup: SLUG_LOOKUP, isAdmin });
  });

  // POST /run/:source — Trigger a single sync (admin only)
  app.post<{ Params: { source: string } }>('/run/:source', async (request, reply) => {
    if (request.user?.role !== 'admin') {
      return reply.code(403).send({ ok: false, message: 'Admin access required' });
    }

    const def = SOURCE_MAP.get(request.params.source);
    if (!def) {
      return reply.code(400).send({ ok: false, message: `Unknown source: ${request.params.source}` });
    }

    // In-process Turso-native job (runs on Vercel). Fire-and-forget so the
    // response returns immediately; the job continues on the server.
    if (def.run) {
      def.run()
        .then(result => console.log(`[sync] ${def.slug} complete:`, result))
        .catch(err => console.error(`[sync] ${def.slug} failed:`, err instanceof Error ? err.message : err));
      return reply.send({ ok: true, message: `Syncing ${def.label}...` });
    }

    // Legacy exec path for sources not yet ported (local dev only — this
    // silently fails on Vercel serverless).
    if (!def.script) {
      return reply.code(500).send({ ok: false, message: `${def.label} has no runner configured` });
    }
    const scriptPath = resolve(PROJECT_ROOT, def.script);
    const pushPath = resolve(PROJECT_ROOT, 'scripts/sync/push-to-turso.ts');

    exec(`npx tsx ${scriptPath} && npx tsx ${pushPath}`, { cwd: PROJECT_ROOT, timeout: 300_000 }, (error, stdout, stderr) => {
      if (error) console.error(`[sync] ${def.slug} failed:`, error.message);
      if (stdout) console.log(`[sync] ${def.slug} stdout:`, stdout);
      if (stderr) console.error(`[sync] ${def.slug} stderr:`, stderr);
    });

    return reply.send({ ok: true, message: `Syncing ${def.label}...` });
  });

  // POST /run-all — Trigger every in-process sync sequentially (admin only)
  app.post('/run-all', async (request, reply) => {
    if (request.user?.role !== 'admin') {
      return reply.code(403).send({ ok: false, message: 'Admin access required' });
    }

    // Fire-and-forget sequential runner so response returns immediately.
    (async () => {
      for (const src of SYNC_SOURCES) {
        if (!src.run) continue;
        try {
          const result = await src.run();
          console.log(`[sync] ${src.slug} complete:`, result);
        } catch (err) {
          console.error(`[sync] ${src.slug} failed:`, err instanceof Error ? err.message : err);
        }
      }
    })().catch(err => console.error('[sync] run-all fatal:', err));

    return reply.send({ ok: true, message: 'Syncing all sources...' });
  });
};
