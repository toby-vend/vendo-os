# Plan: Data Layer — Connect Business Tools to AI OS

**Created:** 2026-03-27
**Status:** Draft
**Layer:** Data
**Request:** Connect Vendo Digital's key business tools so the AI OS has real data to work with.

---

## Overview

### What This Accomplishes
Connects Vendo Digital's core business systems (Xero, GoHighLevel, Slack, Meta Ads, Google Ads, Asana, Ahrefs) to the AI OS. Once complete, Claude can query live financial data, pipeline status, team communication, ad performance, and project workload — enabling the Daily Brief and every function built on top.

### Why It Matters
- **Profit margin (10% → 25%):** Data visibility is the foundation for AI-driven automation. You can't automate what you can't see.
- **Revenue growth (£1.24M → £2M):** Sales pipeline data from GHL enables tracking, forecasting, and eventually automating the sales function.
- **Decision quality:** Every recommendation becomes data-backed instead of assumption-based.

### Layer Dependencies
- **Context layer:** Complete (done 2026-03-27)
- **AI OS layer:** Complete

---

## Current State

- 16 tools identified in `context/integrations.md`
- Zero tools connected
- No `.env.local` file (no API keys configured)
- No `.mcp.json` file (no MCP connections)
- No sync scripts in `scripts/`
- No database configured

---

## Connection Strategy

### Three Connection Methods

| Method | When to Use | Tools |
|--------|------------|-------|
| **MCP (zero-code)** | Service has an MCP server — live queries, no sync needed | Slack |
| **API sync scripts** | Service has an API but no MCP — pull data on a schedule | Xero, GHL, Meta Ads, Google Ads, Microsoft Ads, Ahrefs, Asana, Agency Analytics, Triple Whale, Shopify |
| **Manual/export** | No API or low priority — drop files in | Fathom transcripts, Looker Studio exports |

### Database Strategy

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Structured metrics** | SQLite (local) | Revenue, pipeline, ad performance, KPIs — queryable from Claude Code |
| **Future upgrade** | Supabase (cloud) | When scheduling cloud tasks, migrate to PostgreSQL + pgvector for semantic search and remote access |

SQLite first because it's zero-setup, fast, and works immediately. Migrate to Supabase when the Function layer needs cloud scheduling.

---

## Proposed Changes

### Summary
- Create `.env.local` with API keys for all connected services
- Create `.mcp.json` for MCP-compatible services (Slack)
- Build sync scripts for each API-connected service
- Set up SQLite database with tables for each data source
- Create a master sync script that runs all syncs in sequence

### New Files

| File Path | Purpose |
|-----------|---------|
| `.env.local` | API keys and credentials (gitignored) |
| `.mcp.json` | MCP server connections |
| `scripts/utils/db.ts` | SQLite database setup and helpers |
| `scripts/sync/sync-xero.ts` | Xero financial data sync |
| `scripts/sync/sync-ghl.ts` | GoHighLevel CRM/pipeline sync |
| `scripts/sync/sync-meta-ads.ts` | Meta Ads performance sync |
| `scripts/sync/sync-google-ads.ts` | Google Ads performance sync |
| `scripts/sync/sync-microsoft-ads.ts` | Microsoft Ads performance sync |
| `scripts/sync/sync-asana.ts` | Asana project/task sync |
| `scripts/sync/sync-ahrefs.ts` | Ahrefs SEO data sync |
| `scripts/sync/sync-all.ts` | Master sync runner |
| `scripts/package.json` | Dependencies (better-sqlite3, node-fetch, etc.) |
| `data/vendo.db` | SQLite database file (gitignored) |

### Files to Modify

| File Path | Changes |
|-----------|---------|
| `.gitignore` | Add `.env.local`, `data/*.db` |
| `context/integrations.md` | Update status as each service is connected |
| `context/current-data.md` | Update data sources table with automation status |

---

## Design Decisions

1. **SQLite over Supabase (for now):** No cloud setup, no credentials to manage, works offline. Migrate later when cloud scheduling is needed.
2. **TypeScript for all scripts:** Best Claude Code support, type safety, consistent with the AI OS recommendation.
3. **One script per service:** Keeps each integration isolated. Easier to debug, test, and maintain.
4. **Idempotent syncs:** Every script can be re-run safely — upsert logic, not insert. No duplicate data.
5. **Wave-based rollout:** Connect services in priority order, not all at once. Validate each before moving on.

---

## Step-by-Step Tasks

### Wave 1: Foundation + Finance (Xero)

**Why first:** Revenue and profit data feeds directly into the £2M / 25% targets. This is the single highest-value data source for the Daily Brief.

#### Step 1.1: Set up project infrastructure
- Initialise `scripts/package.json` with TypeScript and dependencies
- Create `scripts/utils/db.ts` with SQLite setup and helper functions
- Create `.env.local` template
- Update `.gitignore`

**Files affected:**
- `scripts/package.json` (new)
- `scripts/utils/db.ts` (new)
- `.env.local` (new)
- `.gitignore` (modify)

#### Step 1.2: Connect Xero
- User provides Xero API credentials (OAuth2 client ID + secret)
- Build `scripts/sync/sync-xero.ts` to pull: invoices, payments, P&L summary, bank balances
- Database tables: `invoices`, `payments`, `financial_summary`
- Test sync and verify data

**Files affected:**
- `scripts/sync/sync-xero.ts` (new)
- `scripts/utils/db.ts` (modify — add Xero tables)
- `.env.local` (add Xero credentials)

**API credentials needed from user:**
- Xero OAuth2 Client ID
- Xero OAuth2 Client Secret
- Xero Tenant ID

---

### Wave 2: CRM + Communication (GHL + Slack)

**Why second:** Pipeline data powers the sales function being built. Slack gives team communication context.

#### Step 2.1: Connect GoHighLevel
- User provides GHL API key
- Build `scripts/sync/sync-ghl.ts` to pull: contacts, opportunities/pipeline, conversations
- Database tables: `contacts`, `opportunities`, `conversations`
- Test sync and verify data

**Files affected:**
- `scripts/sync/sync-ghl.ts` (new)
- `scripts/utils/db.ts` (modify — add GHL tables)
- `.env.local` (add GHL API key)

**API credentials needed from user:**
- GoHighLevel API key (or OAuth credentials)

#### Step 2.2: Connect Slack via MCP
- User provides Slack Bot OAuth token
- Create `.mcp.json` with Slack MCP server config
- Restart Claude Code session to activate
- Verify live queries work

**Files affected:**
- `.mcp.json` (new)
- `.env.local` (add Slack token)

**API credentials needed from user:**
- Slack Bot User OAuth Token (from https://api.slack.com/apps)

---

### Wave 3: Ad Platforms (Meta, Google, Microsoft)

**Why third:** Core delivery platforms — performance data for all client campaigns.

#### Step 3.1: Connect Meta Ads
- Use existing system user token (Business ID 2966248696869064)
- Build `scripts/sync/sync-meta-ads.ts` to pull: campaign performance, spend, ROAS by account
- Database tables: `meta_campaigns`, `meta_insights`
- **Note:** Must not call Meta API from Claude Code sessions directly (account ban risk). Script runs as a standalone Node process.

**Files affected:**
- `scripts/sync/sync-meta-ads.ts` (new)
- `.env.local` (add Meta access token)

#### Step 3.2: Connect Google Ads
- User provides Google Ads API credentials
- Build `scripts/sync/sync-google-ads.ts` to pull: campaign performance, spend, conversions
- Database tables: `google_campaigns`, `google_insights`

**Files affected:**
- `scripts/sync/sync-google-ads.ts` (new)
- `.env.local` (add Google Ads credentials)

**API credentials needed from user:**
- Google Ads Developer Token
- Google Ads OAuth credentials
- Google Ads Manager Account ID

#### Step 3.3: Connect Microsoft Ads
- User provides Microsoft Ads credentials
- Build `scripts/sync/sync-microsoft-ads.ts` to pull: campaign performance, spend
- Database tables: `microsoft_campaigns`, `microsoft_insights`

**Files affected:**
- `scripts/sync/sync-microsoft-ads.ts` (new)
- `.env.local` (add Microsoft Ads credentials)

---

### Wave 4: Project Management + SEO (Asana + Ahrefs)

**Why fourth:** Team workload visibility and SEO delivery data.

#### Step 4.1: Connect Asana
- User provides Asana Personal Access Token
- Build `scripts/sync/sync-asana.ts` to pull: projects, tasks, assignees, due dates, completion status
- Database tables: `asana_projects`, `asana_tasks`

**Files affected:**
- `scripts/sync/sync-asana.ts` (new)
- `.env.local` (add Asana token)

#### Step 4.2: Connect Ahrefs
- User provides Ahrefs API key
- Build `scripts/sync/sync-ahrefs.ts` to pull: rank tracking, backlink profile, domain metrics
- Database tables: `ahrefs_rankings`, `ahrefs_domains`

**Files affected:**
- `scripts/sync/sync-ahrefs.ts` (new)
- `.env.local` (add Ahrefs API key)

---

### Wave 5: Master Sync + Validation

#### Step 5.1: Build master sync runner
- Create `scripts/sync/sync-all.ts` that runs all sync scripts in sequence
- Add error handling and reporting
- Log sync results to `data/sync-log.json`

**Files affected:**
- `scripts/sync/sync-all.ts` (new)

#### Step 5.2: Update context files
- Update `context/integrations.md` with connected status for each service
- Update `context/current-data.md` data sources table

**Files affected:**
- `context/integrations.md` (modify)
- `context/current-data.md` (modify)

---

## Deferred (Connect Later)

These are lower priority and can be added after the core data layer is working:

| Service | Why Deferred |
|---------|-------------|
| Agency Analytics | Reporting layer — useful but not foundational |
| Triple Whale | Ecom attribution — valuable for ecom clients only |
| Shopify | Client stores — connect per-client as needed |
| Fathom | Meeting transcripts — manual export initially |
| Motion | Scheduling tool — low data value |
| Looker Studio | Output/reporting — no API needed |
| Frame / SiteGround | Hosting — minimal data value |
| Loom | Video platform — no meaningful API data |

---

## Validation Checklist

- [ ] `.env.local` exists with all required API keys
- [ ] `.mcp.json` exists and Slack MCP connection is live
- [ ] Each sync script runs without errors
- [ ] SQLite database contains data from all connected services
- [ ] `sync-all.ts` runs end-to-end successfully
- [ ] Can query financial data: "What was last month's revenue?"
- [ ] Can query pipeline data: "How many open opportunities in GHL?"
- [ ] Can query ad performance: "What's total Meta spend this month?"
- [ ] Can query team data: "What tasks are overdue in Asana?"
- [ ] `context/integrations.md` reflects actual connection status

## Success Criteria

1. **6+ services connected** and syncing data into SQLite
2. **Slack live via MCP** — can query team messages in real time
3. **Financial truth available** — Xero data queryable for revenue, profit, invoices
4. **Pipeline visible** — GHL data shows opportunities, contacts, stages
5. **Ad performance accessible** — Meta + Google campaign data in database
6. **Ready for Daily Brief** — enough data flowing to build the first Function layer output

---

## Credentials Needed From User (Summary)

Before implementation can start, the following API credentials are needed:

| Service | What's Needed | Where to Get It |
|---------|--------------|----------------|
| Xero | OAuth2 Client ID + Secret + Tenant ID | Xero Developer Portal → My Apps |
| GoHighLevel | API Key | GHL Settings → Business Profile → API Key |
| Slack | Bot User OAuth Token | api.slack.com/apps → OAuth & Permissions |
| Meta Ads | System User Access Token | Already have (Conversions API System User) |
| Google Ads | Developer Token + OAuth + Manager Account ID | Google Ads API Centre |
| Microsoft Ads | Client ID + Client Secret | Microsoft Advertising Developer Portal |
| Asana | Personal Access Token | Asana Developer Console |
| Ahrefs | API Key | Ahrefs → Account → API |

**Start collecting these now. Wave 1 only needs Xero credentials.**
