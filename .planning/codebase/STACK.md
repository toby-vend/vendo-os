# Technology Stack

**Analysis Date:** 2026-04-01

## Languages

**Primary:**
- TypeScript 5.6 - Core application logic, API routes, scripts, web server
- HTML/Eta 4.5 - Server-side templating engine for views (`web/views/`)

**Secondary:**
- JavaScript - npm scripts and Node.js utilities

## Runtime

**Environment:**
- Node.js (ES2022, ESNext modules) - Backend runtime
- Browser - Frontend (static files served from `public/`)

**Package Manager:**
- npm (with package-lock.json) - Dependency management
- Lockfile: present at `package-lock.json`

## Frameworks

**Core:**
- Fastify 5.8.4 - Web server and HTTP routing
- Eta 4.5.1 - Server-side template engine for rendering HTML views

**Database:**
- sql.js 1.11.0 - In-memory SQLite with file persistence (`data/vendo.db`)
- @libsql/client 0.17.2 - Turso cloud database client for production (`TURSO_DATABASE_URL`)

**Authentication:**
- bcryptjs 3.0.3 - Password hashing (BCRYPT_ROUNDS=10)
- Native crypto module - Session token generation (HMAC-SHA256), OAuth state validation

**Analytics:**
- @vercel/analytics 2.0.1 - Vercel analytics integration

## Key Dependencies

**Critical:**
- @fastify/static 9.0.0 - Serve static files from `web/public/` and `public/`
- dotenv 16.4.0 - Load `.env.local` for configuration
- @libsql/client 0.17.2 - Production database (Turso) – required for production deploys

**Infrastructure:**
- @vercel/node 5.6.22 (devDependency) - Vercel serverless function support
- tsx 4.19.0 - TypeScript execution for scripts and CLI tools

## Configuration

**Environment:**
- Loaded from `.env.local` at application startup (see `.env.example` for template)
- **Key configs required:**
  - `FATHOM_API_KEY` - Fathom meeting transcription service
  - `GHL_API_KEY`, `GHL_LOCATION_ID` - GoHighLevel CRM
  - `SLACK_BOT_TOKEN`, `SLACK_TEAM_ID` - Slack integration
  - `GDRIVE_CREDENTIALS_PATH`, `GDRIVE_OAUTH_PATH` - Google Drive OAuth
  - `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET` - Xero accounting (if using)
  - `META_ACCESS_TOKEN` - Meta Ads API
  - `SESSION_SECRET` or `DASHBOARD_PASSWORD` - Session token signing
  - `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` - Production database (Vercel only)
  - `DASHBOARD_PORT` - Local dev port (default 3000)
  - `NODE_ENV` - Environment mode (development/production)
  - `VERCEL` - Set automatically on Vercel deployments

**Build:**
- `tsconfig.json` - TypeScript compilation config (target: ES2022, module: ESNext)
- `vercel.json` - Vercel deployment configuration (v2 format)
  - Builds `api/index.ts` with @vercel/node
  - Serves static files from `public/` via @vercel/static
  - Routes all requests to `/api/index.ts` (Fastify handler)

## Platform Requirements

**Development:**
- Node.js (version manager not specified – see `.env.example` for shared setup)
- npm
- Git
- Local SQLite database at `data/vendo.db` (auto-created by `npm run db:init`)

**Production:**
- Vercel (serverless platform)
  - Runs as Vercel Function via `/api/index.ts`
  - Database: Turso (cloud SQLite)
  - Static files: Vercel CDN from `public/`
  - Environment vars: Set in Vercel project settings (not `.env.local`)

## Database Strategy

**Local Development:**
- sql.js in-memory SQLite with file persistence
- Database file: `data/vendo.db` (git-ignored, rebuilt from syncs)
- Approach: In-memory for fast queries, periodically synced to disk

**Production (Vercel):**
- Turso (cloud SQLite provider)
- Client: `@libsql/client` connects to `TURSO_DATABASE_URL`
- Auth: `TURSO_AUTH_TOKEN` (stored in Vercel secrets, not `.env.local`)
- Queries: Same SQL.js API, transparent failover from local to Turso based on env vars

## Scripts & Data Sync

**Run Commands:**
```bash
npm run sync:meetings              # Incremental sync from Fathom
npm run sync:meetings:backfill     # Full history backfill from Fathom
npm run sync:xero                  # Incremental Xero invoices/contacts
npm run sync:xero:backfill         # Full Xero backfill
npm run sync:ghl                   # GoHighLevel pipelines & opportunities
npm run sync:meta                  # Meta Ads insights (last 7 days)
npm run sync:meta:backfill         # Meta Ads backfill (last 90 days)
npm run process:meetings           # Categorise & extract action items from transcripts
npm run query                      # Search/query meetings (see scripts/query/search-meetings.ts)
npm run brief:data                 # Generate daily data brief
npm run db:push                    # Push local database to Turso (production sync)
npm run db:init                    # Initialise local database schema
npm run xero:auth                  # Initiate Xero OAuth flow
npm run dev                        # Local development server (watches `web/start.ts`)
npm run start                      # Production server
```

**Sync Location:**
- All sync scripts in `scripts/sync/` pull data from external APIs into local `data/vendo.db`
- Schema: Tables for meetings, actions items, clients, Xero invoices/contacts, GHL pipelines/opportunities, Meta ads insights
- Frequency: Manual runs (future: automated via cloud scheduled tasks)

---

*Stack analysis: 2026-04-01*
