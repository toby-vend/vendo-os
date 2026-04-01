# Architecture

**Analysis Date:** 2026-04-01

## Pattern Overview

**Overall:** Layered monolith with clear separation between web UI layer (Fastify server with Eta templates), business logic layer (route handlers and queries), and data layer (local SQLite + Turso cloud database).

**Key Characteristics:**
- Server-side rendered dashboard using Fastify + Eta template engine
- Hybrid data layer: SQLite for development, Turso for production
- Async data sync scripts that pull from external APIs (Fathom, Xero, GHL, Meta Ads)
- HTMX-enhanced forms for interactive components without client-side framework
- Role-based access control (admin vs. standard user) enforced at request middleware
- Session-based authentication using JWT-like tokens stored in cookies

## Layers

**Presentation (Web UI):**
- Purpose: Server-side rendered HTML dashboard with HTMX interactivity
- Location: `web/`
- Contains: Fastify route handlers, Eta template files, static assets, authentication middleware
- Depends on: Business logic (queries, auth library), data layer
- Used by: End users accessing dashboard via browser

**Business Logic:**
- Purpose: Query builders, data transformations, API integrations
- Location: `web/lib/queries.ts`, `scripts/` (sync/analysis/functions)
- Contains: Database queries (dashboard stats, meetings, actions), client SDK wrappers (Fathom, Xero, GHL, Meta), business rules (meeting categorisation, assignee normalisation)
- Depends on: Data layer, external APIs
- Used by: Route handlers, scheduled functions

**Data Layer:**
- Purpose: Persistent storage and retrieval
- Location: `data/vendo.db` (development), Turso cloud (production)
- Contains: SQLite database with tables for meetings, action items, clients, users, ads data, opportunities
- Depends on: @libsql/client (abstraction that works with both local and cloud databases)
- Used by: All queries, all sync scripts

**External APIs:**
- Fathom Video: Meeting recordings, transcripts, summaries
- Xero: Financial/accounting data
- GHL (GoHighLevel): Sales pipeline opportunities, contacts
- Meta Ads: Ad account performance, campaigns, spend data
- Google Drive/Docs: File integration for users
- Google OAuth: User identity and authentication

## Data Flow

**Dashboard Load:**

1. User makes GET request to `/` → Fastify route handler in `web/routes/dashboard.ts`
2. Middleware validates session token → loads user from database
3. Route handler calls multiple queries in parallel: `getDashboardStats()`, `getRecentMeetings()`, `getActionsByAssignee()`, `getSyncStatus()`
4. Queries execute against database (local SQLite or Turso) via `web/lib/queries.ts`
5. Query results formatted as JSON and passed to Eta template
6. Template renders server-side HTML → returned as response

**Data Sync (Nightly/On-Demand):**

1. Sync script starts: `npm run sync:meetings` (via `scripts/sync/sync-meetings.ts`)
2. Script initialises local SQLite database schema
3. Fetches from external API (e.g., Fathom) since last sync timestamp
4. Transforms API response into database schema
5. Upserts into local database
6. Optional: Pushes updated database to Turso cloud via `scripts/sync/push-to-turso.ts`
7. Saves database file to disk: `data/vendo.db`

**Brief Generation (Cloud Function):**

1. Cloud scheduled task triggers `npm run brief:data`
2. Script in `scripts/functions/generate-daily-brief.ts` executes
3. Fetches GHL pipeline + opportunities, Fathom meetings, Xero financials
4. Aggregates into markdown brief
5. Writes output to `outputs/briefs/YYYY-MM-DD.md`

**State Management:**

- **Session state:** Stored in JWT-like cookie (`vendo_session`) with 7-day expiry. Token contains user ID and role. Validated on every request via middleware.
- **Database state:** Authoritative source. All business data (meetings, actions, clients, users) lives in database. Sync scripts update database from external APIs.
- **Transient state:** None. No in-memory caches. Each request queries fresh data.

## Key Abstractions

**SessionUser:**
- Purpose: Represents authenticated user loaded from database + derived permissions
- Examples: `web/lib/auth.ts` (SessionUser type), `web/server.ts` (loaded in middleware)
- Pattern: Interface defined once, decorated into request object, passed to templates

**Database Client:**
- Purpose: Abstraction over SQLite (dev) and Turso (prod)
- Examples: `web/lib/queries.ts` (uses @libsql/client), `scripts/utils/db.ts` (uses sql.js)
- Pattern: Single client instance, connection string from env vars, works transparently in both environments

**External API Clients:**
- Purpose: Wrap third-party SDKs with consistent error handling
- Examples: `scripts/utils/fathom-client.ts`, `scripts/utils/xero-client.ts`, `scripts/utils/meta-client.ts`
- Pattern: Standalone modules, type definitions for API responses, fetch-based (no vendor SDKs except where necessary)

**Sync Script Pattern:**
- Purpose: Fetch external data, transform, upsert to database
- Examples: `scripts/sync/sync-meetings.ts`, `scripts/sync/sync-xero.ts`, `scripts/sync/sync-meta-ads.ts`
- Pattern: Load env config, get database, fetch from API in paginated batches, transform/normalise, upsert with `db.run()`, save database, log results

**Meeting Categorisation:**
- Purpose: Automatic classification of meetings into types (internal, client_catchup, discovery_sales, etc.)
- Examples: `scripts/analysis/process-meetings.ts`
- Pattern: Keyword matching on title, client name extraction via separators, team member name normalisation against known aliases

## Entry Points

**Dashboard Server:**
- Location: `web/start.ts`
- Triggers: `npm run dev` or `npm run start` during development; Vercel deployment in production
- Responsibilities: Loads environment, initialises Fastify app, binds port 3000 (or DASHBOARD_PORT env var), logs startup

**Web Server:**
- Location: `web/server.ts`
- Triggers: Imported by start.ts
- Responsibilities: Configures Fastify with middleware, registers routes, sets up template engine (Eta), implements session validation hook, handles permission checks

**Sync Scripts:**
- Location: `scripts/sync/*.ts` (sync-meetings, sync-xero, sync-meta-ads, sync-ghl)
- Triggers: `npm run sync:meetings` (or others); scheduled via GitHub Actions or cloud tasks
- Responsibilities: Connect to external API, fetch paginated data, transform to schema, upsert to SQLite, optionally push to Turso

**Brief Generation:**
- Location: `scripts/functions/generate-daily-brief.ts`
- Triggers: `npm run brief:data`; scheduled daily via cloud task
- Responsibilities: Fetch GHL + Fathom + Xero data, aggregate, write markdown brief to `outputs/briefs/`

**Analysis/Processing:**
- Location: `scripts/analysis/process-meetings.ts`
- Triggers: `npm run process:meetings`
- Responsibilities: Read meetings from database, categorise by keywords, extract client names, normalise assignees, persist category and client fields

## Error Handling

**Strategy:** Try-catch in individual API calls and route handlers. Errors logged. User-facing errors returned as rendered templates or HTMX error codes.

**Patterns:**

- **Sync scripts:** Wrap API calls in try-catch, log errors, continue processing (fail-fast on schema errors, graceful on network errors)
- **Route handlers:** Catch errors from queries, return error template with message or redirect to login
- **Database queries:** Assume database is available; no retry logic for local SQLite (it's local); cloud queries fail if Turso is down
- **External API calls:** Validate response status code (e.g., `if (!resp.ok) throw new Error()`)

Example from `web/routes/drive.ts`:
```typescript
try {
  // API call
} catch (e: unknown) {
  // Handle error, render template with error flag
}
```

## Cross-Cutting Concerns

**Logging:** Sync scripts use custom log function from `scripts/utils/db.ts`. Web server uses Fastify logger (disabled in production on Vercel). No structured logging library; console output for dev, silent for prod.

**Validation:** Form data parsed in Fastify content-type parser (custom handler at `web/server.ts` lines 138-149). Route handlers validate presence of required fields (email, password, etc.). Database schema enforces constraints (foreign keys, NOT NULL).

**Authentication:** Session token created on login, stored in httpOnly cookie with 7-day expiry. Validated on every request. If token missing or invalid, redirected to `/login`. Password hashed with bcrypt (10 rounds). Password change forces token re-issue so session stays valid.

**Authorization:** Admin-only routes checked in middleware (path starts with `/admin` → user.role must be `admin`). Standard users restricted to channels they're assigned to via route slug matching. Admin users bypass channel checks.

**HTMX Integration:** Forms use HGET for standard navigation, HPOST for data mutations. Responses check for `hx-request` header to return partial HTML (no layout) vs. full page. Error codes return 401 or 403 with plain text for HTMX to handle.

---

*Architecture analysis: 2026-04-01*
