/**
 * GA4 sync — pulls analytics data for all configured GA4 properties.
 *
 * Run: npm run sync:ga4             (last 7 days)
 *      npm run sync:ga4:backfill    (last 90 days)
 *
 * Uses the same Google OAuth tokens as Google Ads (shared credentials).
 * Property IDs are read from client_account_map (platform = 'ga4').
 * GA4_PROPERTY_IDS env var is supported as an optional override.
 */
import { config } from 'dotenv';
config({ path: '.env.local', override: true });

import { readFileSync } from 'fs';
import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';
import { resolveClientBatch } from '../utils/resolve-client.js';

const BACKFILL = process.argv.includes('--backfill');
const DEFAULT_DAYS = 7;
const BACKFILL_DAYS = 90;

const GA4_API_BASE = 'https://analyticsdata.googleapis.com/v1beta';

// --- Config ---

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GA4_PROPERTY_IDS_ENV = process.env.GA4_PROPERTY_IDS?.split(',').map(s => s.trim()).filter(Boolean);

let tokens: { access_token: string; refresh_token: string };
try {
  tokens = JSON.parse(readFileSync('.secrets/google-ads-tokens.json', 'utf-8'));
} catch {
  logError('GA4', 'No tokens found — run: npm run google-ads:auth');
  process.exit(1);
}

if (!CLIENT_ID || !CLIENT_SECRET) {
  logError('GA4', 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env.local');
  process.exit(1);
}

/**
 * Resolve GA4 property IDs from env var (override) or client_account_map table.
 * Must be called after initSchema().
 */
async function resolveGA4PropertyIds(): Promise<string[]> {
  if (GA4_PROPERTY_IDS_ENV && GA4_PROPERTY_IDS_ENV.length > 0) {
    log('GA4', `Using GA4 properties from env (${GA4_PROPERTY_IDS_ENV.length} properties)`);
    return GA4_PROPERTY_IDS_ENV;
  }

  const db = await getDb();
  const result = db.exec(
    `SELECT DISTINCT platform_account_id FROM client_account_map WHERE platform = 'ga4'`
  );

  const ids: string[] = [];
  if (result.length > 0 && result[0].values.length > 0) {
    for (const row of result[0].values) {
      const id = row[0] as string;
      if (id) ids.push(id);
    }
  }

  if (ids.length > 0) {
    log('GA4', `Using GA4 properties from client_account_map (${ids.length} properties)`);
    return ids;
  }

  logError('GA4', 'No GA4 properties found. Set GA4_PROPERTY_IDS in .env.local or add rows to client_account_map with platform = \'ga4\'');
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

// --- GA4 Data API helper ---

interface GA4ReportRequest {
  dimensions: { name: string }[];
  metrics: { name: string }[];
  dateRanges: { startDate: string; endDate: string }[];
}

interface GA4ReportResponse {
  rows?: {
    dimensionValues: { value: string }[];
    metricValues: { value: string }[];
  }[];
  rowCount?: number;
}

async function runReport(propertyId: string, request: GA4ReportRequest): Promise<GA4ReportResponse> {
  const accessToken = await refreshAccessToken();
  const url = `${GA4_API_BASE}/properties/${propertyId}:runReport`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GA4 API error (${res.status}): ${body}`);
  }

  return res.json();
}

// --- Date range ---

function dateRange(): { startDate: string; endDate: string } {
  const days = BACKFILL ? BACKFILL_DAYS : DEFAULT_DAYS;
  return {
    startDate: `${days}daysAgo`,
    endDate: 'today',
  };
}

// --- Fetch daily overview ---

async function fetchDailyOverview(propertyId: string): Promise<GA4ReportResponse> {
  return runReport(propertyId, {
    dimensions: [{ name: 'date' }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'newUsers' },
      { name: 'screenPageViews' },
      { name: 'engagedSessions' },
      { name: 'engagementRate' },
      { name: 'averageSessionDuration' },
      { name: 'bounceRate' },
      { name: 'conversions' },
    ],
    dateRanges: [dateRange()],
  });
}

// --- Fetch traffic sources ---

async function fetchTrafficSources(propertyId: string): Promise<GA4ReportResponse> {
  return runReport(propertyId, {
    dimensions: [
      { name: 'date' },
      { name: 'sessionSource' },
      { name: 'sessionMedium' },
      { name: 'sessionCampaignName' },
    ],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'conversions' },
    ],
    dateRanges: [dateRange()],
  });
}

// --- GA4 date format (YYYYMMDD) → ISO (YYYY-MM-DD) ---

function ga4DateToISO(d: string): string {
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

// --- Main ---

async function syncGA4() {
  await initSchema();
  const db = await getDb();
  const GA4_PROPERTY_IDS = await resolveGA4PropertyIds();

  try {
    const now = new Date().toISOString();
    const days = BACKFILL ? BACKFILL_DAYS : DEFAULT_DAYS;
    log('GA4', `Syncing ${GA4_PROPERTY_IDS.length} properties (${days} days)`);

    // Upsert property record
    const upsertProperty = db.prepare(
      `INSERT INTO ga4_properties (id, synced_at)
       VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET synced_at=excluded.synced_at`
    );

    // Upsert daily overview
    const upsertDaily = db.prepare(
      `INSERT INTO ga4_daily (date, property_id, sessions, users, new_users, page_views, engaged_sessions, engagement_rate, avg_session_duration, bounce_rate, conversions, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(date, property_id) DO UPDATE SET
         sessions=excluded.sessions, users=excluded.users, new_users=excluded.new_users,
         page_views=excluded.page_views, engaged_sessions=excluded.engaged_sessions,
         engagement_rate=excluded.engagement_rate, avg_session_duration=excluded.avg_session_duration,
         bounce_rate=excluded.bounce_rate, conversions=excluded.conversions, synced_at=excluded.synced_at`
    );

    // Upsert traffic sources
    const upsertTraffic = db.prepare(
      `INSERT INTO ga4_traffic_sources (date, property_id, source, medium, campaign, sessions, users, conversions, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(date, property_id, source, medium, campaign) DO UPDATE SET
         sessions=excluded.sessions, users=excluded.users, conversions=excluded.conversions, synced_at=excluded.synced_at`
    );

    let totalDaily = 0;
    let totalTraffic = 0;

    for (const propertyId of GA4_PROPERTY_IDS) {
      try {
        log('GA4', `  Property ${propertyId}...`);

        // Register property
        upsertProperty.run([propertyId, now]);

        // 1. Daily overview
        const dailyData = await fetchDailyOverview(propertyId);
        const dailyRows = dailyData.rows || [];

        for (const row of dailyRows) {
          const date = ga4DateToISO(row.dimensionValues[0].value);
          const [sessions, users, newUsers, pageViews, engagedSessions, engagementRate, avgSessionDuration, bounceRate, conversions] =
            row.metricValues.map(m => Number(m.value));

          upsertDaily.run([
            date,
            propertyId,
            sessions,
            users,
            newUsers,
            pageViews,
            engagedSessions,
            engagementRate,
            avgSessionDuration,
            bounceRate,
            conversions,
            now,
          ]);
        }

        totalDaily += dailyRows.length;
        log('GA4', `    Daily: ${dailyRows.length} rows`);

        // 2. Traffic sources
        const trafficData = await fetchTrafficSources(propertyId);
        const trafficRows = trafficData.rows || [];

        for (const row of trafficRows) {
          const date = ga4DateToISO(row.dimensionValues[0].value);
          const source = row.dimensionValues[1].value || '(direct)';
          const medium = row.dimensionValues[2].value || '(none)';
          const campaign = row.dimensionValues[3].value || '(not set)';
          const [sessions, users, conversions] = row.metricValues.map(m => Number(m.value));

          upsertTraffic.run([
            date,
            propertyId,
            source,
            medium,
            campaign,
            sessions,
            users,
            conversions,
            now,
          ]);
        }

        totalTraffic += trafficRows.length;
        log('GA4', `    Traffic sources: ${trafficRows.length} rows`);

      } catch (err) {
        logError('GA4', `Failed to sync property ${propertyId}`, err);
      }
    }

    upsertProperty.free();
    upsertDaily.free();
    upsertTraffic.free();
    saveDb();

    log('GA4', `Sync complete: ${totalDaily} daily rows, ${totalTraffic} traffic rows across ${GA4_PROPERTY_IDS.length} properties`);

    // Auto-resolve GA4 properties to canonical clients
    const ga4Props = db.exec('SELECT id, display_name FROM ga4_properties WHERE display_name IS NOT NULL');
    if (ga4Props.length && ga4Props[0].values.length) {
      await resolveClientBatch('ga4', ga4Props[0].values.map((r: unknown[]) => ({ id: r[0] as string, name: r[1] as string })));
    }

  } catch (err) {
    logError('GA4', 'Sync failed', err);
    process.exit(1);
  } finally {
    closeDb();
  }
}

syncGA4();
