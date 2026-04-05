/**
 * Google Search Console sync — pulls search performance data for configured sites.
 *
 * Run: npm run sync:gsc             (last 7 days)
 *      npm run sync:gsc:backfill    (last 90 days)
 *
 * Site URLs are read from client_account_map (platform = 'gsc').
 * GSC_SITE_URLS env var is supported as an optional override.
 */
import { config } from 'dotenv';
config({ path: '.env.local', override: true });

import { readFileSync } from 'fs';
import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';
import { resolveClientBatch } from '../utils/resolve-client.js';

const BACKFILL = process.argv.includes('--backfill');
const DEFAULT_DAYS = 7;
const BACKFILL_DAYS = 90;
const GSC_DATA_DELAY_DAYS = 3;
const MAX_ROWS_PER_REQUEST = 25_000;

const BASE_URL = 'https://www.googleapis.com/webmasters/v3';

// --- Config ---

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const SITE_URLS_ENV = process.env.GSC_SITE_URLS?.split(',').map(s => s.trim()).filter(Boolean);

let tokens: { access_token: string; refresh_token: string };
try {
  tokens = JSON.parse(readFileSync('.secrets/google-ads-tokens.json', 'utf-8'));
} catch {
  logError('GSC', 'No tokens found — run: npm run google-ads:auth');
  process.exit(1);
}

if (!CLIENT_ID || !CLIENT_SECRET) {
  logError('GSC', 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env.local');
  process.exit(1);
}

/**
 * Resolve GSC site URLs from env var (override) or client_account_map table.
 * Must be called after initSchema().
 */
async function resolveGscSiteUrls(): Promise<string[]> {
  if (SITE_URLS_ENV && SITE_URLS_ENV.length > 0) {
    log('GSC', `Using GSC site URLs from env (${SITE_URLS_ENV.length} sites)`);
    return SITE_URLS_ENV;
  }

  const db = await getDb();
  const result = db.exec(
    `SELECT DISTINCT platform_account_id FROM client_account_map WHERE platform = 'gsc'`
  );

  const urls: string[] = [];
  if (result.length > 0 && result[0].values.length > 0) {
    for (const row of result[0].values) {
      const url = row[0] as string;
      if (url) urls.push(url);
    }
  }

  if (urls.length > 0) {
    log('GSC', `Using GSC site URLs from client_account_map (${urls.length} sites)`);
    return urls;
  }

  logError('GSC', 'No GSC site URLs found. Set GSC_SITE_URLS in .env.local or add rows to client_account_map with platform = \'gsc\'');
  process.exit(1);
}

// --- Token refresh ---

async function refreshAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  tokens.access_token = data.access_token;
  return data.access_token;
}

// --- GSC API helpers ---

function dateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

interface GscRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface GscResponse {
  rows?: GscRow[];
  responseAggregationType?: string;
}

async function gscQuery(
  siteUrl: string,
  body: Record<string, unknown>,
): Promise<GscRow[]> {
  const accessToken = await refreshAccessToken();
  const encodedSiteUrl = encodeURIComponent(siteUrl);
  const url = `${BASE_URL}/sites/${encodedSiteUrl}/searchAnalytics/query`;

  const allRows: GscRow[] = [];
  let startRow = 0;

  while (true) {
    const requestBody = { ...body, startRow };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`GSC API error (${res.status}): ${errBody}`);
    }

    const data: GscResponse = await res.json();
    const rows = data.rows || [];

    if (rows.length === 0) break;

    allRows.push(...rows);

    // If fewer rows than the limit were returned, we have all data
    if (rows.length < MAX_ROWS_PER_REQUEST) break;

    startRow += rows.length;
  }

  return allRows;
}

// --- Main ---

async function syncGsc() {
  await initSchema();
  const db = await getDb();
  const SITE_URLS = await resolveGscSiteUrls();

  try {
    const now = new Date().toISOString();
    const days = BACKFILL ? BACKFILL_DAYS : DEFAULT_DAYS;
    const startDate = dateStr(days + GSC_DATA_DELAY_DAYS);
    const endDate = dateStr(GSC_DATA_DELAY_DAYS);

    log('GSC', `Syncing ${SITE_URLS.length} site(s) from ${startDate} to ${endDate} (${days} days)`);

    // Upsert sites
    const upsertSite = db.prepare(
      `INSERT INTO gsc_sites (id, permission_level, synced_at)
       VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET synced_at=excluded.synced_at`
    );

    const upsertDaily = db.prepare(
      `INSERT INTO gsc_daily (date, site_id, clicks, impressions, ctr, avg_position, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(date, site_id) DO UPDATE SET
         clicks=excluded.clicks, impressions=excluded.impressions,
         ctr=excluded.ctr, avg_position=excluded.avg_position, synced_at=excluded.synced_at`
    );

    const upsertQuery = db.prepare(
      `INSERT INTO gsc_queries (date, site_id, query, clicks, impressions, ctr, position, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(date, site_id, query) DO UPDATE SET
         clicks=excluded.clicks, impressions=excluded.impressions,
         ctr=excluded.ctr, position=excluded.position, synced_at=excluded.synced_at`
    );

    const upsertPage = db.prepare(
      `INSERT INTO gsc_pages (date, site_id, page, clicks, impressions, ctr, position, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(date, site_id, page) DO UPDATE SET
         clicks=excluded.clicks, impressions=excluded.impressions,
         ctr=excluded.ctr, position=excluded.position, synced_at=excluded.synced_at`
    );

    let totalDaily = 0;
    let totalQueries = 0;
    let totalPages = 0;

    for (const siteUrl of SITE_URLS) {
      log('GSC', `  ${siteUrl}...`);

      // Upsert site record
      upsertSite.run([siteUrl, null, now]);

      // 1. Daily totals
      try {
        const dailyRows = await gscQuery(siteUrl, {
          startDate,
          endDate,
          dimensions: ['date'],
          type: 'web',
        });

        for (const row of dailyRows) {
          upsertDaily.run([
            row.keys[0],  // date
            siteUrl,
            row.clicks,
            row.impressions,
            row.ctr,
            row.position,
            now,
          ]);
        }

        totalDaily += dailyRows.length;
        log('GSC', `    Daily totals: ${dailyRows.length} rows`);
      } catch (err) {
        logError('GSC', `Failed to fetch daily totals for ${siteUrl}`, err);
      }

      // 2. Top queries
      try {
        const queryRows = await gscQuery(siteUrl, {
          startDate,
          endDate,
          dimensions: ['date', 'query'],
          type: 'web',
          rowLimit: 100,
        });

        for (const row of queryRows) {
          upsertQuery.run([
            row.keys[0],  // date
            siteUrl,
            row.keys[1],  // query
            row.clicks,
            row.impressions,
            row.ctr,
            row.position,
            now,
          ]);
        }

        totalQueries += queryRows.length;
        log('GSC', `    Queries: ${queryRows.length} rows`);
      } catch (err) {
        logError('GSC', `Failed to fetch queries for ${siteUrl}`, err);
      }

      // 3. Top pages
      try {
        const pageRows = await gscQuery(siteUrl, {
          startDate,
          endDate,
          dimensions: ['date', 'page'],
          type: 'web',
          rowLimit: 50,
        });

        for (const row of pageRows) {
          upsertPage.run([
            row.keys[0],  // date
            siteUrl,
            row.keys[1],  // page
            row.clicks,
            row.impressions,
            row.ctr,
            row.position,
            now,
          ]);
        }

        totalPages += pageRows.length;
        log('GSC', `    Pages: ${pageRows.length} rows`);
      } catch (err) {
        logError('GSC', `Failed to fetch pages for ${siteUrl}`, err);
      }

      saveDb();
    }

    upsertSite.free();
    upsertDaily.free();
    upsertQuery.free();
    upsertPage.free();
    saveDb();

    log('GSC', `Sync complete: ${totalDaily} daily, ${totalQueries} query, ${totalPages} page rows across ${SITE_URLS.length} site(s)`);

    // Auto-resolve GSC sites to canonical clients (site_id is the URL, used as both ID and name)
    const gscSites = db.exec('SELECT id, id FROM gsc_sites');
    if (gscSites.length && gscSites[0].values.length) {
      await resolveClientBatch('gsc', gscSites[0].values.map((r: unknown[]) => ({ id: r[0] as string, name: r[1] as string })));
    }

  } catch (err) {
    logError('GSC', 'Sync failed', err);
    process.exit(1);
  } finally {
    closeDb();
  }
}

syncGsc();
