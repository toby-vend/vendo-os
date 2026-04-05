# Client CRM Performance System — Architecture Plan

**Date:** 2026-04-02
**Status:** Draft — awaiting approval
**Author:** System Architect agent

---

## 1. Overview

A client-facing reporting portal for Vendo Digital that shows each client their marketing performance across all channels (Google Ads, Meta Ads, SEO, CRM/leads) with lead attribution and ROI calculations.

**What exists today (internal-only):**
- Meta Ads sync → `meta_insights` table (campaign/adset/ad level, daily)
- Google Ads sync → `gads_campaign_spend` table (campaign level, daily — no conversions yet)
- GHL CRM sync → `ghl_opportunities` table (pipeline/stage/contact data)
- Fastify web app with Eta templates, HTMX, Turso (prod) / SQLite (dev)
- User auth with roles (`admin` / `standard`), channel-based permissions
- Existing `/ads` route showing spend summaries by account
- Existing `/pipeline` route showing GHL pipeline stages
- Client report generator (`scripts/functions/generate-client-report.ts`) using `account_name LIKE` matching

**What needs building:**
1. Client-to-account mapping table (structured, not LIKE matching)
2. GA4 + Google Search Console + Ahrefs sync scripts
3. Lead source attribution engine
4. Lead enrichment with treatment types and values
5. ROI calculation engine
6. Client-facing dashboard with scoped login
7. Conversions metric added to Google Ads sync

---

## 2. Database Schema

All tables use the existing dual-database pattern: `sql.js` (local dev via `scripts/utils/db.ts`) and `@libsql/client` / Turso (production via `web/lib/queries/base.ts`). Schema init goes into `scripts/utils/db.ts::initSchema()` for local, and `web/lib/queries/auth.ts::initSchema()` for Turso.

### 2.1 Client-Account Mapping

The existing system matches clients to ad accounts by string matching (`account_name LIKE '%ClientName%'`). This is fragile. Replace with an explicit mapping table.

```sql
CREATE TABLE IF NOT EXISTS client_account_map (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  client_name TEXT NOT NULL,
  platform TEXT NOT NULL,           -- 'meta', 'gads', 'ga4', 'gsc', 'ghl', 'ahrefs'
  platform_account_id TEXT NOT NULL,
  platform_account_name TEXT,
  crm_type TEXT NOT NULL DEFAULT 'ghl', -- 'ghl', 'boxly', 'none'
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(client_id, platform, platform_account_id)
);

CREATE INDEX IF NOT EXISTS idx_cam_client ON client_account_map(client_id);
CREATE INDEX IF NOT EXISTS idx_cam_platform ON client_account_map(platform);
CREATE INDEX IF NOT EXISTS idx_cam_platform_account ON client_account_map(platform_account_id);
```

### 2.2 Google Analytics (GA4) Data

```sql
CREATE TABLE IF NOT EXISTS ga4_properties (
  id TEXT PRIMARY KEY,               -- GA4 property ID, e.g. '123456789'
  display_name TEXT,
  time_zone TEXT,
  currency TEXT,
  synced_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ga4_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  property_id TEXT NOT NULL,
  sessions INTEGER DEFAULT 0,
  users INTEGER DEFAULT 0,
  new_users INTEGER DEFAULT 0,
  page_views INTEGER DEFAULT 0,
  engaged_sessions INTEGER DEFAULT 0,
  engagement_rate REAL,
  avg_session_duration REAL,
  bounce_rate REAL,
  conversions INTEGER DEFAULT 0,
  conversion_events TEXT,             -- JSON: { "generate_lead": 5, "purchase": 2 }
  synced_at TEXT NOT NULL,
  UNIQUE(date, property_id)
);

CREATE INDEX IF NOT EXISTS idx_ga4_daily_date ON ga4_daily(date);
CREATE INDEX IF NOT EXISTS idx_ga4_daily_property ON ga4_daily(property_id);

-- Traffic by source/medium (for attribution)
CREATE TABLE IF NOT EXISTS ga4_traffic_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  property_id TEXT NOT NULL,
  source TEXT,                        -- 'google', 'facebook', '(direct)', etc.
  medium TEXT,                        -- 'cpc', 'organic', '(none)', 'social', etc.
  campaign TEXT,                      -- UTM campaign name
  sessions INTEGER DEFAULT 0,
  users INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  synced_at TEXT NOT NULL,
  UNIQUE(date, property_id, source, medium, campaign)
);

CREATE INDEX IF NOT EXISTS idx_ga4_traffic_date ON ga4_traffic_sources(date);
CREATE INDEX IF NOT EXISTS idx_ga4_traffic_property ON ga4_traffic_sources(property_id);
CREATE INDEX IF NOT EXISTS idx_ga4_traffic_source ON ga4_traffic_sources(source, medium);
```

### 2.3 Google Search Console Data

```sql
CREATE TABLE IF NOT EXISTS gsc_sites (
  id TEXT PRIMARY KEY,               -- site URL, e.g. 'sc-domain:example.com'
  permission_level TEXT,
  synced_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gsc_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  site_id TEXT NOT NULL,
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  ctr REAL,
  avg_position REAL,
  synced_at TEXT NOT NULL,
  UNIQUE(date, site_id)
);

CREATE INDEX IF NOT EXISTS idx_gsc_daily_date ON gsc_daily(date);
CREATE INDEX IF NOT EXISTS idx_gsc_daily_site ON gsc_daily(site_id);

CREATE TABLE IF NOT EXISTS gsc_queries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  site_id TEXT NOT NULL,
  query TEXT NOT NULL,
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  ctr REAL,
  position REAL,
  synced_at TEXT NOT NULL,
  UNIQUE(date, site_id, query)
);

CREATE INDEX IF NOT EXISTS idx_gsc_queries_date ON gsc_queries(date);
CREATE INDEX IF NOT EXISTS idx_gsc_queries_site ON gsc_queries(site_id);
CREATE INDEX IF NOT EXISTS idx_gsc_queries_query ON gsc_queries(query);

-- Page-level data for landing page analysis
CREATE TABLE IF NOT EXISTS gsc_pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  site_id TEXT NOT NULL,
  page TEXT NOT NULL,
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  ctr REAL,
  position REAL,
  synced_at TEXT NOT NULL,
  UNIQUE(date, site_id, page)
);

CREATE INDEX IF NOT EXISTS idx_gsc_pages_date ON gsc_pages(date);
CREATE INDEX IF NOT EXISTS idx_gsc_pages_site ON gsc_pages(site_id);
```

### 2.4 Ahrefs Data

```sql
CREATE TABLE IF NOT EXISTS ahrefs_domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain TEXT NOT NULL UNIQUE,
  domain_rating REAL,
  organic_keywords INTEGER DEFAULT 0,
  organic_traffic INTEGER DEFAULT 0,
  referring_domains INTEGER DEFAULT 0,
  backlinks INTEGER DEFAULT 0,
  synced_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ahrefs_domains_domain ON ahrefs_domains(domain);

-- Historical snapshots for trend tracking
CREATE TABLE IF NOT EXISTS ahrefs_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  domain TEXT NOT NULL,
  domain_rating REAL,
  organic_keywords INTEGER DEFAULT 0,
  organic_traffic INTEGER DEFAULT 0,
  referring_domains INTEGER DEFAULT 0,
  backlinks INTEGER DEFAULT 0,
  synced_at TEXT NOT NULL,
  UNIQUE(date, domain)
);

CREATE INDEX IF NOT EXISTS idx_ahrefs_snap_date ON ahrefs_snapshots(date);
CREATE INDEX IF NOT EXISTS idx_ahrefs_snap_domain ON ahrefs_snapshots(domain);
```

### 2.5 Lead Attribution

```sql
-- Enriched leads: GHL opportunities augmented with source attribution
CREATE TABLE IF NOT EXISTS attributed_leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ghl_opportunity_id TEXT NOT NULL UNIQUE,
  client_id INTEGER NOT NULL,
  client_name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,

  -- Attribution
  attributed_source TEXT NOT NULL,    -- 'google_ads', 'meta_ads', 'organic', 'direct', 'referral', 'other'
  attribution_method TEXT NOT NULL,   -- 'utm', 'ghl_source', 'gclid', 'fbclid', 'landing_page', 'manual'
  attribution_confidence TEXT NOT NULL DEFAULT 'medium', -- 'high', 'medium', 'low'
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  landing_page TEXT,

  -- Enrichment
  treatment_type TEXT,                -- 'implants', 'invisalign', 'composite_bonding', 'whitening', 'general', etc.
  treatment_value REAL,               -- estimated or actual value in GBP
  conversion_status TEXT NOT NULL DEFAULT 'lead', -- 'lead', 'qualified', 'booked', 'attended', 'converted', 'lost'

  -- Timestamps
  lead_date TEXT NOT NULL,            -- when the lead was created
  qualified_at TEXT,
  converted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attr_leads_client ON attributed_leads(client_id);
CREATE INDEX IF NOT EXISTS idx_attr_leads_source ON attributed_leads(attributed_source);
CREATE INDEX IF NOT EXISTS idx_attr_leads_treatment ON attributed_leads(treatment_type);
CREATE INDEX IF NOT EXISTS idx_attr_leads_status ON attributed_leads(conversion_status);
CREATE INDEX IF NOT EXISTS idx_attr_leads_date ON attributed_leads(lead_date);
CREATE INDEX IF NOT EXISTS idx_attr_leads_ghl ON attributed_leads(ghl_opportunity_id);
```

### 2.6 Treatment Types (Reference Table)

```sql
CREATE TABLE IF NOT EXISTS treatment_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  default_value REAL NOT NULL DEFAULT 0,  -- average treatment value in GBP
  vertical TEXT NOT NULL DEFAULT 'dental', -- 'dental', 'aesthetics', 'general'
  keywords TEXT                            -- JSON array of matching keywords
);
```

Seed data (dental vertical):

| slug | label | default_value | keywords |
|------|-------|---------------|----------|
| implants | Dental Implants | 3500 | `["implant", "implants", "all-on-4", "all on 4"]` |
| invisalign | Invisalign | 3500 | `["invisalign", "aligners", "braces", "clear aligners"]` |
| composite_bonding | Composite Bonding | 1500 | `["bonding", "composite", "veneers"]` |
| whitening | Teeth Whitening | 400 | `["whitening", "bleaching"]` |
| general | General Dentistry | 250 | `["checkup", "check-up", "cleaning", "filling", "extraction"]` |
| emergency | Emergency | 150 | `["emergency", "pain", "toothache"]` |

### 2.7 Client Portal Users

The existing `users` table already has `role: 'admin' | 'standard'`. Extend this to support a third role for client users.

```sql
-- Add 'client' role to the existing users table.
-- Client users have a client_id linking them to the clients table.
-- No ALTER TABLE needed — the role column is TEXT and already stores free-form values.

-- New: link client users to their client
CREATE TABLE IF NOT EXISTS client_user_map (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL,
  client_name TEXT NOT NULL,
  PRIMARY KEY (user_id)
);

CREATE INDEX IF NOT EXISTS idx_cum_client ON client_user_map(client_id);
```

### 2.8 Google Ads Conversions (Schema Extension)

Add conversion columns to the existing `gads_campaign_spend` table:

```sql
ALTER TABLE gads_campaign_spend ADD COLUMN conversions REAL DEFAULT 0;
ALTER TABLE gads_campaign_spend ADD COLUMN conversion_value REAL DEFAULT 0;
ALTER TABLE gads_campaign_spend ADD COLUMN cost_per_conversion REAL;
```

---

## 3. Data Pipeline

### 3.1 New Sync Scripts

All follow the established pattern: import from `../utils/db.js`, use `getDb()` / `saveDb()` / `closeDb()`, support `--backfill` flag.

| Script | Source | Schedule | Notes |
|--------|--------|----------|-------|
| `scripts/sync/sync-ga4.ts` | GA4 Data API v1 | Daily | Uses service account or OAuth (existing Google tokens pattern) |
| `scripts/sync/sync-gsc.ts` | Search Console API | Daily | Uses same Google OAuth flow |
| `scripts/sync/sync-ahrefs.ts` | Ahrefs API v3 | Weekly | Needs API key confirmation |
| `scripts/sync/sync-google-ads.ts` | Google Ads API v23 | Daily | **Existing — add conversions metric** |

**npm scripts to add to `package.json`:**

```json
{
  "sync:ga4": "tsx scripts/sync/sync-ga4.ts",
  "sync:ga4:backfill": "tsx scripts/sync/sync-ga4.ts --backfill",
  "sync:gsc": "tsx scripts/sync/sync-gsc.ts",
  "sync:gsc:backfill": "tsx scripts/sync/sync-gsc.ts --backfill",
  "sync:ahrefs": "tsx scripts/sync/sync-ahrefs.ts",
  "leads:attribute": "tsx scripts/functions/lead-attribution.ts",
  "leads:attribute:backfill": "tsx scripts/functions/lead-attribution.ts --backfill"
}
```

### 3.2 GA4 Sync — `scripts/sync/sync-ga4.ts`

**API:** Google Analytics Data API v1 (`https://analyticsdata.googleapis.com/v1beta`)

**Auth:** Reuse the existing `scripts/auth/google-ads-auth.ts` OAuth flow. GA4 Data API requires `https://www.googleapis.com/auth/analytics.readonly` scope. The existing Google OAuth tokens in `.secrets/google-ads-tokens.json` need this scope added.

**Env vars:**
```
GA4_PROPERTY_IDS=123456789,987654321   # comma-separated property IDs
```

**Logic:**
1. Refresh access token (same pattern as `sync-google-ads.ts`)
2. For each property ID:
   - Call `runReport` with dimensions: `[date]`, metrics: `[sessions, totalUsers, newUsers, screenPageViews, engagedSessions, engagementRate, averageSessionDuration, bounceRate, conversions]`
   - Upsert into `ga4_daily`
   - Call `runReport` with dimensions: `[date, sessionSource, sessionMedium, sessionCampaignName]`, metrics: `[sessions, totalUsers, conversions]`
   - Upsert into `ga4_traffic_sources`
3. `saveDb()`, `closeDb()`

**Date range:** Default 7 days, `--backfill` 90 days.

### 3.3 Google Search Console Sync — `scripts/sync/sync-gsc.ts`

**API:** Search Console API v1 (`https://www.googleapis.com/webmasters/v3`)

**Auth:** Same Google OAuth tokens. Requires `https://www.googleapis.com/auth/webmasters.readonly` scope.

**Env vars:**
```
GSC_SITE_URLS=sc-domain:example1.com,sc-domain:example2.com
```

**Logic:**
1. For each site URL:
   - POST to `/searchAnalytics/query` with `dimensions: ['date']` for daily totals → `gsc_daily`
   - POST with `dimensions: ['date', 'query']` for keyword data → `gsc_queries` (top 100 queries per day)
   - POST with `dimensions: ['date', 'page']` for page data → `gsc_pages` (top 50 pages per day)
2. Respect row limits (25,000 per request) with pagination

**Date range:** Default 7 days, `--backfill` 90 days (GSC data available up to 16 months back).

### 3.4 Ahrefs Sync — `scripts/sync/sync-ahrefs.ts`

**API:** Ahrefs API v3 (`https://api.ahrefs.com/v3`)

**Auth:** Bearer token.

**Env vars:**
```
AHREFS_API_TOKEN=your_token_here
AHREFS_DOMAINS=example1.com,example2.com
```

**Logic:**
1. For each domain:
   - GET `/site-explorer/overview` → domain rating, organic traffic, keywords, referring domains, backlinks
   - Upsert into `ahrefs_domains` (latest snapshot)
   - Insert into `ahrefs_snapshots` (historical trend)

**Schedule:** Weekly (Ahrefs data updates slowly, daily is wasteful).

### 3.5 Google Ads Conversions — Modify `scripts/sync/sync-google-ads.ts`

Add `metrics.conversions` and `metrics.conversions_value` to the existing GAQL query:

```
SELECT
  segments.date,
  customer.id,
  customer.descriptive_name,
  campaign.id,
  campaign.name,
  campaign.status,
  metrics.cost_micros,
  metrics.impressions,
  metrics.clicks,
  metrics.conversions,
  metrics.conversions_value
FROM campaign
WHERE segments.date BETWEEN '{start}' AND '{end}'
  AND campaign.status != 'REMOVED'
```

Update the upsert to include the three new columns.

---

## 4. Lead Source Attribution Engine

`scripts/functions/lead-attribution.ts`

### 4.1 Attribution Waterfall

For each GHL opportunity, determine the lead source using this priority order:

```
1. GCLID present in GHL contact tags or source field
   → attributed_source: 'google_ads'
   → attribution_method: 'gclid'
   → confidence: 'high'

2. FBCLID or "facebook" / "fb" in GHL source field
   → attributed_source: 'meta_ads'
   → attribution_method: 'fbclid'
   → confidence: 'high'

3. UTM parameters in GHL source field (source=xxx&medium=yyy)
   → Parse and map:
     medium='cpc' + source='google'    → 'google_ads'
     medium='cpc' + source='facebook'  → 'meta_ads'
     medium='organic'                  → 'organic'
     medium='referral'                 → 'referral'
     else                              → 'other'
   → attribution_method: 'utm'
   → confidence: 'high'

4. GHL source field text matching
   → Contains 'google' or 'ppc'       → 'google_ads', confidence: 'medium'
   → Contains 'facebook' or 'meta'    → 'meta_ads', confidence: 'medium'
   → Contains 'organic' or 'seo'      → 'organic', confidence: 'medium'
   → Contains 'referral'              → 'referral', confidence: 'medium'

5. GHL contact tags matching
   → Tags contain 'google ads'        → 'google_ads', confidence: 'medium'
   → Tags contain 'facebook ads'      → 'meta_ads', confidence: 'medium'
   → Tags contain 'organic'           → 'organic', confidence: 'medium'

6. Fallback
   → attributed_source: 'direct'
   → attribution_method: 'fallback'
   → confidence: 'low'
```

### 4.2 Treatment Type Detection

After attribution, enrich each lead with treatment type by scanning:

1. GHL opportunity name (e.g. "Invisalign Enquiry - John Smith")
2. GHL contact tags (e.g. tags contain "implants")
3. GHL pipeline/stage name (e.g. pipeline named "Invisalign Pipeline")
4. UTM campaign name (e.g. `utm_campaign=invisalign_2026`)

Match against `treatment_types.keywords` JSON array. First match wins. If no match, default to `'general'`.

### 4.3 Treatment Value Assignment

1. If GHL `monetary_value > 0`, use it directly
2. Else, use `treatment_types.default_value` for the matched treatment
3. Store in `attributed_leads.treatment_value`

### 4.4 Conversion Status Mapping

Map from GHL opportunity status and stage:

| GHL Status | GHL Stage (contains) | Conversion Status |
|------------|---------------------|-------------------|
| `open` | "new" / "enquiry" | `lead` |
| `open` | "qualified" / "contacted" | `qualified` |
| `open` | "booked" / "appointment" | `booked` |
| `open` | "attended" / "consult" | `attended` |
| `won` | any | `converted` |
| `lost` / `abandoned` | any | `lost` |

---

## 5. ROI Calculation Engine

`web/lib/queries/roi.ts`

### 5.1 Formulas

All calculations are per-client, per-period (default: last 30 days).

**Cost Per Lead (CPL) by channel:**
```
CPL = Total Channel Spend / Count of Leads Attributed to Channel
```

**Channel ROI:**
```
Channel Revenue = SUM(treatment_value) for converted leads from that channel
Channel Cost    = SUM(ad spend for that channel in period)
Channel ROI     = ((Channel Revenue - Channel Cost) / Channel Cost) * 100
```

**ROI by treatment type:**
```
Treatment Revenue  = SUM(treatment_value) for converted leads of that treatment
Treatment Ad Spend = SUM(ad spend) proportionally allocated based on lead count
Treatment ROI      = ((Treatment Revenue - Treatment Ad Spend) / Treatment Ad Spend) * 100
```

**Blended ROI (all channels):**
```
Total Revenue     = SUM(treatment_value) for all converted leads
Total Ad Spend    = SUM(meta spend + google ads spend)
Blended ROI       = ((Total Revenue - Total Ad Spend) / Total Ad Spend) * 100
```

**Lead-to-Conversion Rate:**
```
Conversion Rate = (Converted Leads / Total Leads) * 100
```

### 5.2 SQL Queries (in `web/lib/queries/roi.ts`)

```typescript
// Cost per lead by channel
export async function getCostPerLead(clientId: number, days = 30) {
  return rows(`
    SELECT
      al.attributed_source as channel,
      COUNT(*) as lead_count,
      -- Ad spend from the corresponding platform
      CASE al.attributed_source
        WHEN 'google_ads' THEN (
          SELECT COALESCE(SUM(g.spend), 0) FROM gads_campaign_spend g
          JOIN client_account_map cam ON cam.platform_account_id = g.account_id AND cam.platform = 'gads'
          WHERE cam.client_id = ? AND g.date >= date('now', '-' || ? || ' days')
        )
        WHEN 'meta_ads' THEN (
          SELECT COALESCE(SUM(m.spend), 0) FROM meta_insights m
          JOIN client_account_map cam ON cam.platform_account_id = m.account_id AND cam.platform = 'meta'
          WHERE cam.client_id = ? AND m.date >= date('now', '-' || ? || ' days') AND m.level = 'campaign'
        )
        ELSE 0
      END as channel_spend,
      -- CPL
      CASE WHEN COUNT(*) > 0 THEN
        ROUND(CASE al.attributed_source ... END / COUNT(*), 2)
      ELSE 0 END as cpl
    FROM attributed_leads al
    WHERE al.client_id = ? AND al.lead_date >= date('now', '-' || ? || ' days')
    GROUP BY al.attributed_source
    ORDER BY lead_count DESC
  `, [clientId, days, clientId, days, clientId, days]);
}
```

In practice, the ROI queries will be split into composable functions rather than a single monster query:

```typescript
export async function getChannelSpend(clientId: number, days: number): Promise<ChannelSpend[]>;
export async function getLeadsByChannel(clientId: number, days: number): Promise<ChannelLeads[]>;
export async function getRevenueByChannel(clientId: number, days: number): Promise<ChannelRevenue[]>;
export async function getROISummary(clientId: number, days: number): Promise<ROISummary>;
export async function getROIByTreatment(clientId: number, days: number): Promise<TreatmentROI[]>;
export async function getConversionFunnel(clientId: number, days: number): Promise<FunnelStage[]>;
```

---

## 6. Client Portal — Routes and Pages

### 6.1 Auth and Access Control

**New role:** `'client'` (alongside existing `'admin'` and `'standard'`).

**Middleware change in `web/server.ts`:** After verifying the session token and loading the user, check if `user.role === 'client'`. If so:
- Load `client_user_map` to get the client's `client_id`
- Restrict access to only `/portal/*` routes
- Inject `clientId` into the request object for all portal queries

**Route access matrix:**

| Role | Routes | Description |
|------|--------|-------------|
| `admin` | All routes | Full internal dashboard |
| `standard` | Channel-scoped routes | Internal team (existing behaviour) |
| `client` | `/portal/*` only | Client portal only |

### 6.2 New Routes

Add to `web/routes/portal.ts`:

```typescript
export const portalRoutes: FastifyPluginAsync = async (app) => {
  // Dashboard — executive summary
  app.get('/', handler);

  // SEO performance (GA4 + GSC + Ahrefs)
  app.get('/seo', handler);

  // Paid ads performance (Meta + Google Ads)
  app.get('/ads', handler);

  // Lead attribution
  app.get('/leads', handler);

  // ROI breakdown
  app.get('/roi', handler);

  // HTMX partials for date range changes
  app.get('/partials/seo-summary', handler);
  app.get('/partials/ads-summary', handler);
  app.get('/partials/leads-table', handler);
  app.get('/partials/roi-chart', handler);
};
```

Register in `web/server.ts`:
```typescript
import { portalRoutes } from './routes/portal.js';
app.register(portalRoutes, { prefix: '/portal' });
```

### 6.3 Admin Routes for Client Management

Add to `web/routes/admin/client-portal.ts`:

```typescript
// List all client portal users
app.get('/admin/portal-users', handler);

// Create/edit client portal user (assign client_id, set initial password)
app.post('/admin/portal-users', handler);

// Map client to platform accounts
app.get('/admin/client-mapping/:clientId', handler);
app.post('/admin/client-mapping/:clientId', handler);

// Seed treatment types
app.post('/admin/treatment-types', handler);
```

### 6.4 Pages and Templates

All in `web/views/portal/`:

| Template | Route | Description |
|----------|-------|-------------|
| `dashboard.eta` | `/portal` | Executive summary: headline KPIs, sparklines, channel split |
| `seo.eta` | `/portal/seo` | GSC clicks/impressions trend, top keywords, Ahrefs DR/backlinks, GA4 organic traffic |
| `ads.eta` | `/portal/ads` | Meta + Google Ads: spend, clicks, impressions, CPC, CTR, conversions by campaign |
| `leads.eta` | `/portal/leads` | Lead table with source, treatment, status; filterable by date/source/treatment |
| `roi.eta` | `/portal/roi` | ROI by channel, ROI by treatment, cost per lead, conversion funnel |
| `layout.eta` | - | Portal layout (separate from internal dashboard layout, client branding) |

### 6.5 Dashboard KPIs (Executive Summary)

The portal dashboard (`/portal`) shows:

| KPI | Source | Calculation |
|-----|--------|-------------|
| Total Leads (period) | `attributed_leads` | `COUNT(*)` |
| Leads by Channel | `attributed_leads` | `GROUP BY attributed_source` |
| Total Ad Spend | `meta_insights` + `gads_campaign_spend` | `SUM(spend)` via `client_account_map` |
| Blended CPL | calculated | `Total Spend / Total Leads` |
| Conversion Rate | `attributed_leads` | `converted / total * 100` |
| Estimated Revenue | `attributed_leads` | `SUM(treatment_value) WHERE status = 'converted'` |
| Blended ROI | calculated | `(Revenue - Spend) / Spend * 100` |
| Organic Sessions | `ga4_daily` | `SUM(sessions)` filtered by organic source |
| Keyword Rankings | `gsc_queries` | Top 10 keywords by clicks |
| Domain Authority | `ahrefs_domains` | `domain_rating` |

---

## 7. Component Architecture

### 7.1 New Query Modules

| File | Exports |
|------|---------|
| `web/lib/queries/roi.ts` | `getChannelSpend`, `getLeadsByChannel`, `getRevenueByChannel`, `getROISummary`, `getROIByTreatment`, `getConversionFunnel` |
| `web/lib/queries/portal.ts` | `getPortalDashboard`, `getPortalSEO`, `getPortalAds`, `getPortalLeads` |
| `web/lib/queries/ga4.ts` | `getGA4Summary`, `getGA4TrafficSources`, `getOrganicTrend` |
| `web/lib/queries/gsc.ts` | `getGSCSummary`, `getTopQueries`, `getTopPages` |
| `web/lib/queries/ahrefs.ts` | `getAhrefsSummary`, `getAhrefsTrend` |
| `web/lib/queries/client-mapping.ts` | `getClientMappings`, `setClientMapping`, `getClientIdForUser` |
| `web/lib/queries/attribution.ts` | `getAttributedLeads`, `getLeadsBySource`, `getLeadsByTreatment` |

### 7.2 New Sync Scripts

| File | Purpose |
|------|---------|
| `scripts/sync/sync-ga4.ts` | GA4 Data API sync |
| `scripts/sync/sync-gsc.ts` | Google Search Console sync |
| `scripts/sync/sync-ahrefs.ts` | Ahrefs API sync |
| `scripts/functions/lead-attribution.ts` | Attribution engine (run after GHL sync) |
| `scripts/functions/seed-treatments.ts` | Seed `treatment_types` reference data |

### 7.3 Modified Files

| File | Change |
|------|--------|
| `scripts/utils/db.ts` | Add all new `CREATE TABLE` statements to `initSchema()` |
| `scripts/sync/sync-google-ads.ts` | Add conversions + conversion_value to GAQL query and upsert |
| `web/lib/queries/auth.ts` | Add `client_account_map`, `client_user_map`, portal tables to Turso `initSchema()` |
| `web/server.ts` | Register portal routes, update auth hook for client role |
| `web/lib/auth.ts` | Add `'client'` to role union type, add `clientId` to `SessionUser` |
| `scripts/sync/run-all.ts` | Add GA4, GSC syncs; add attribution run after GHL sync |
| `package.json` | Add new npm scripts |
| `vercel.json` | Add `/portal` assets if needed |

---

## 8. Data Flow Diagram

```
                    ┌──────────────────────────────────────────────────────────┐
                    │                     DATA SOURCES                         │
                    │                                                          │
                    │  Google Ads    Meta Ads    GHL CRM    GA4    GSC   Ahrefs │
                    └──────┬───────────┬──────────┬─────────┬──────┬──────┬────┘
                           │           │          │         │      │      │
                    ┌──────▼───────────▼──────────▼─────────▼──────▼──────▼────┐
                    │                   SYNC SCRIPTS (tsx)                      │
                    │                                                          │
                    │  sync-google-   sync-meta-  sync-    sync-  sync-  sync- │
                    │  ads.ts         ads.ts      ghl.ts   ga4.ts gsc.ts ahrefs│
                    └──────┬───────────┬──────────┬─────────┬──────┬──────┬────┘
                           │           │          │         │      │      │
                    ┌──────▼───────────▼──────────▼─────────▼──────▼──────▼────┐
                    │               LOCAL SQLite / Turso DB                     │
                    │                                                          │
                    │  gads_campaign_spend  │  meta_insights  │  ghl_*         │
                    │  ga4_daily            │  ga4_traffic_sources             │
                    │  gsc_daily / queries  │  ahrefs_*       │  clients       │
                    └──────────────────┬───────────────────────────────────────┘
                                       │
                    ┌──────────────────▼──────────────────────────────────────┐
                    │            client_account_map (links clients            │
                    │            to platform account IDs)                     │
                    └──────────────────┬─────────────────────────────────────┘
                                       │
                    ┌──────────────────▼──────────────────────────────────────┐
                    │          LEAD ATTRIBUTION ENGINE                        │
                    │          scripts/functions/lead-attribution.ts          │
                    │                                                        │
                    │  GHL opportunities ──► waterfall attribution            │
                    │                    ──► treatment type detection         │
                    │                    ──► value assignment                 │
                    │                    ──► status mapping                   │
                    │                                                        │
                    │  Output: attributed_leads table                         │
                    └──────────────────┬─────────────────────────────────────┘
                                       │
                    ┌──────────────────▼──────────────────────────────────────┐
                    │          ROI CALCULATION ENGINE                         │
                    │          web/lib/queries/roi.ts                         │
                    │                                                        │
                    │  Reads: attributed_leads + ad spend tables              │
                    │  Calculates: CPL, channel ROI, treatment ROI,          │
                    │              conversion rate, blended ROI               │
                    └──────────────────┬─────────────────────────────────────┘
                                       │
              ┌────────────────────────┴───────────────────────┐
              │                                                │
    ┌─────────▼────────────┐                     ┌─────────────▼────────────┐
    │  INTERNAL DASHBOARD  │                     │    CLIENT PORTAL         │
    │  (admin/standard)    │                     │    (client role)         │
    │                      │                     │                          │
    │  /ads                │                     │  /portal                 │
    │  /pipeline           │                     │  /portal/seo             │
    │  /clients            │                     │  /portal/ads             │
    │  /admin/portal-users │                     │  /portal/leads           │
    │  /admin/client-map   │                     │  /portal/roi             │
    └──────────────────────┘                     └──────────────────────────┘
```

---

## 9. Implementation Plan

### Phase 1: Foundation (Week 1)
1. Add all new tables to `scripts/utils/db.ts` and `web/lib/queries/auth.ts`
2. Create `client_account_map` admin UI for mapping clients to platform accounts
3. Seed `treatment_types` reference data
4. Add conversions metric to Google Ads sync
5. Run `db:push` to deploy schema to Turso

### Phase 2: New Integrations (Week 2)
1. Build `sync-ga4.ts`
2. Build `sync-gsc.ts`
3. ~~Build `sync-ahrefs.ts`~~ — **Deferred** (no API access yet)
4. Add GA4 + GSC to `run-all.ts`
5. Backfill 90 days of data
6. Build GHL sub-account discovery admin tool

### Phase 3: Attribution Engine (Week 3)
1. Build `lead-attribution.ts`
2. Backfill all existing GHL opportunities
3. Build query modules (`roi.ts`, `attribution.ts`, `ga4.ts`, `gsc.ts`, `ahrefs.ts`)
4. Validate attribution accuracy against known leads

### Phase 4: Client Portal (Week 4) ✅
1. Add `client` role to auth system
2. Build portal routes and middleware
3. Build portal templates (dashboard, SEO, ads, leads, ROI)
4. Build admin UI for creating client portal users
5. Deploy and test with one pilot client

### Phase 5: Admin Onboarding UI (Week 5)

Replace manual CLI/env-var setup with a self-service admin flow at `/admin/onboarding`.

1. **Client master table** — create `clients` table if not already present (id, name, domain, crm_type, created_at)
2. **API account discovery endpoints** — server-side routes that list available accounts from each platform:
   - `GET /admin/api/ghl-locations` — pull GHL sub-accounts from agency API
   - `GET /admin/api/meta-accounts` — list Meta ad accounts from existing token
   - `GET /admin/api/gads-accounts` — list Google Ads accounts from existing token
   - `GET /admin/api/ga4-properties` — list GA4 properties (Admin API)
   - `GET /admin/api/gsc-sites` — list verified GSC sites
3. **Multi-step onboarding wizard** (`/admin/onboarding`):
   - Step 1: Create client (name, domain, CRM type)
   - Step 2: Link platform accounts (dropdowns populated from discovery endpoints)
   - Step 3: Configure treatment types (show defaults, allow per-client adjustments)
   - Step 4: Create portal user (email + password)
   - Step 5: Trigger initial sync + attribution backfill (background task with progress)
4. **Server-side sync trigger** — `POST /admin/api/sync-client` that runs backfill for all linked platforms as a background task, returns progress via SSE or polling
5. **Per-client GA4/GSC config** — move GA4_PROPERTY_IDS and GSC_SITE_URLS from .env.local into client_account_map so each client's properties are stored in the database, not env vars. Update sync scripts to read from DB instead.

**Pilot client:** Zen House Dental

---

## 10. Environment Variables (New)

Add to `.env.example`:

```
# GA4
GA4_PROPERTY_IDS=                    # Comma-separated GA4 property IDs

# Google Search Console
GSC_SITE_URLS=                       # Comma-separated site URLs (sc-domain:example.com)

# Ahrefs
AHREFS_API_TOKEN=                    # Ahrefs API v3 bearer token
AHREFS_DOMAINS=                      # Comma-separated domains to track
```

Google OAuth scopes to add (for GA4 + GSC):
```
https://www.googleapis.com/auth/analytics.readonly
https://www.googleapis.com/auth/webmasters.readonly
```

These must be added to the existing OAuth consent screen and the token re-authorised.

---

## 11. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Ahrefs API access not confirmed | No DA/backlink data in portal | Defer Ahrefs section; show placeholder. Build the sync script so it slots in when access is granted. |
| GHL source field inconsistency | Low attribution accuracy | Build manual override in admin UI; log attribution confidence; review `low` confidence leads monthly |
| Google OAuth scope expansion | Re-auth required | Document the process; existing token refresh pattern handles it cleanly |
| Treatment value estimates wrong | ROI numbers misleading | Use GHL `monetary_value` when available; make `treatment_types.default_value` editable in admin |
| Client sees internal data | Data leak | Enforce `client_id` scoping at query level (not just route level); add tests for query isolation |
| Turso migration failures | Production schema out of sync | Use `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN` with try/catch (established pattern) |

---

## 12. Decisions (Resolved 2026-04-02)

| # | Question | Decision |
|---|----------|----------|
| 1 | Ahrefs API access | **Deferred.** Skip Ahrefs integration for now. Earmark for later. |
| 2 | GHL webhook vs polling | **Webhook.** Real-time attribution on new GHL opportunities. |
| 3 | Multi-location | **Yes.** Multiple GHL locations per client supported. Some clients on Boxly (handle later). |
| 4 | Historical data | **6 months.** Backfill attribution for 6 months of GHL data. |
| 5 | Client branding | **Standard Vendo portal.** No per-client branding. |
| 6 | Google OAuth re-auth | **Toby manages Google Cloud Console.** |
| 7 | Treatment values | **Roughly correct.** Pull from GHL `monetary_value` when available; fall back to `treatment_types.default_value`. |
| 8 | GHL pipeline stages | **TBD.** Will map when reviewing GHL pipeline setup. |
| 9 | Lead privacy | **Clients see lead data.** Build GHL sub-account auto-discovery from agency account → link to clients. |
| 10 | Date ranges | **30 days default with date picker.** |
| 11 | Pilot client | **Zen House Dental** (changed from Avenue Dental — Avenue not on GHL). Ecom clients won't have GHL — need CRM type selector (GHL / Boxly / none). |
| 12 | Meta token expiry | **Manual refresh.** No automation needed. |

### New Requirements from Decisions

1. **CRM type on clients:** `client_account_map` needs a `crm_type` field (`ghl`, `boxly`, `none`) to support clients on different CRM systems.
2. **GHL sub-account discovery:** Admin tool that pulls all GHL locations from the agency account and lets you link each to a Vendo client. Auto-populates `client_account_map`.
3. **Multi-CRM architecture:** The attribution engine and portal must gracefully handle clients with no CRM (ecom-only) — show ads/SEO data without lead attribution.
