import type { FastifyPluginAsync } from 'fastify';
import { exec } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getSyncStatus } from '../lib/queries.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');

interface SyncSource {
  slug: string;
  label: string;
  script: string;
  /** Display names from getSyncStatus() that this script covers */
  covers: string[];
}

const SYNC_SOURCES: SyncSource[] = [
  { slug: 'meetings', label: 'Meetings', script: 'scripts/sync/sync-meetings.ts', covers: ['Fathom (Meetings)'] },
  { slug: 'meta-ads', label: 'Meta Ads', script: 'scripts/sync/sync-meta-ads.ts', covers: ['Meta Ads'] },
  { slug: 'google-ads', label: 'Google Ads', script: 'scripts/sync/sync-google-ads.ts', covers: ['Google Ads'] },
  { slug: 'ghl', label: 'GHL', script: 'scripts/sync/sync-ghl.ts', covers: ['GHL (Pipeline)'] },
  { slug: 'xero', label: 'Xero', script: 'scripts/sync/sync-xero.ts', covers: ['Xero (Invoices)', 'Xero (Contacts)', 'Xero (P&L)'] },
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

    const scriptPath = resolve(PROJECT_ROOT, def.script);
    const pushPath = resolve(PROJECT_ROOT, 'scripts/sync/push-to-turso.ts');

    // Fire-and-forget: run sync then push to Turso
    exec(`npx tsx ${scriptPath} && npx tsx ${pushPath}`, { cwd: PROJECT_ROOT, timeout: 300_000 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`[sync] ${def.slug} failed:`, error.message);
      }
      if (stdout) console.log(`[sync] ${def.slug} stdout:`, stdout);
      if (stderr) console.error(`[sync] ${def.slug} stderr:`, stderr);
    });

    return reply.send({ ok: true, message: `Syncing ${def.label}...` });
  });

  // POST /run-all — Trigger all syncs (admin only)
  app.post('/run-all', async (request, reply) => {
    if (request.user?.role !== 'admin') {
      return reply.code(403).send({ ok: false, message: 'Admin access required' });
    }

    const scriptPath = resolve(PROJECT_ROOT, 'scripts/sync/run-all.ts');

    exec(`npx tsx ${scriptPath}`, { cwd: PROJECT_ROOT, timeout: 600_000 }, (error, stdout, stderr) => {
      if (error) {
        console.error('[sync] run-all failed:', error.message);
      }
      if (stdout) console.log('[sync] run-all stdout:', stdout);
      if (stderr) console.error('[sync] run-all stderr:', stderr);
    });

    return reply.send({ ok: true, message: 'Syncing all sources...' });
  });
};
