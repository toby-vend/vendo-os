# Codebase Structure

**Analysis Date:** 2026-04-01

## Directory Layout

```
vendo-os/
├── .claude/                  # AI OS framework (CLAUDE.md, commands, skills)
├── .planning/                # Planning and analysis (this directory)
│   └── codebase/            # Codebase documentation (ARCHITECTURE.md, STRUCTURE.md, etc.)
├── .vercel/                 # Vercel deployment config (project.json or repo.json)
├── api/                     # Legacy/placeholder (unused or minimal)
├── context/                 # Business context (personal-info.md, companies.md, team.md, etc.)
├── data/                    # Local data storage
│   ├── vendo.db            # SQLite database (gitignored, rebuilt from API syncs)
│   └── decisions/          # Decision journal (dated JSON files)
├── outputs/                 # Generated deliverables
│   ├── analyses/           # Strategic analyses
│   ├── briefs/             # Daily briefs (markdown, dated YYYY-MM-DD.md)
│   └── decisions/          # Decision tracking
├── plans/                   # Implementation plans (dated YYYY-MM-DD-*.md)
├── public/                  # Static assets (served by Vercel or local server)
│   └── assets/             # CSS, images, fonts
├── reference/              # Framework documentation (architecture.md, autonomy-ladder.md, etc.)
├── scripts/                # Data sync and function scripts (not web routes)
│   ├── analysis/           # Process meetings (categorise, extract, normalise)
│   ├── auth/               # OAuth flows (Xero, Google)
│   ├── functions/          # Business functions (daily brief generation)
│   ├── query/              # Database queries (search, report)
│   ├── sync/               # External API syncs (meetings, Xero, GHL, Meta)
│   ├── utils/              # Shared utilities (database, API clients, logging)
│   └── setup.sh            # Initial setup script
├── web/                     # Web dashboard (Fastify + Eta)
│   ├── lib/                # Shared libraries and utilities
│   │   ├── auth.ts         # Session tokens, password hashing, JWT
│   │   ├── crypto.ts       # Encryption utilities
│   │   ├── google-tokens.ts # Google OAuth token storage/refresh
│   │   ├── notifications.ts # Notification building (for routes)
│   │   └── queries.ts      # Database queries (all endpoints expose these)
│   ├── public/             # Static files (favicon, robots.txt, etc.)
│   ├── routes/             # Fastify route handlers
│   │   ├── admin/          # Admin-only routes (users, permissions)
│   │   ├── action-items.ts # GET /action-items, POST /action-items/:id
│   │   ├── ads.ts          # GET /ads (ad account summaries)
│   │   ├── auth.ts         # GET/POST /login, /logout, /change-password
│   │   ├── briefs.ts       # GET /briefs
│   │   ├── clients.ts      # GET /clients, /clients/:name
│   │   ├── dashboard.ts    # GET / (main dashboard)
│   │   ├── drive.ts        # GET /drive (Google Drive file browser)
│   │   ├── google-oauth.ts # GET /connect-google, /oauth/google/callback
│   │   ├── meetings.ts     # GET /meetings, /meetings/:id
│   │   ├── pipeline.ts     # GET /pipeline (GHL sales pipeline)
│   │   ├── settings.ts     # GET /settings, POST /settings
│   │   └── sync-status.ts  # GET /sync-status (last sync times)
│   ├── views/              # Eta templates (server-side rendered HTML)
│   │   ├── layouts/base.eta # Main layout wrapper
│   │   ├── admin/          # Admin templates
│   │   ├── briefs/         # Brief templates
│   │   ├── clients/        # Client detail templates
│   │   ├── meetings/       # Meeting templates
│   │   ├── action-items.eta
│   │   ├── ads.eta
│   │   ├── dashboard.eta
│   │   ├── login.eta
│   │   ├── pipeline.eta
│   │   └── [other views]
│   ├── server.ts           # Fastify app setup, middleware, plugin registration
│   └── start.ts            # Entry point (loads .env, starts server on port)
├── .env.example            # Template for environment variables (check this for required vars)
├── .env.local              # Actual env vars (gitignored, never committed)
├── .gitignore              # Ignore patterns (includes .env.local, data/vendo.db, node_modules)
├── CLAUDE.md               # Project instructions and workspace definition
├── package.json            # Dependencies, scripts, project metadata
├── package-lock.json       # Locked dependency versions
├── tsconfig.json           # TypeScript configuration
└── README.md               # Project overview

```

## Directory Purposes

**`web/`**
- Purpose: Dashboard web server (Fastify + Eta templates, HTMX-enhanced forms)
- Contains: Route handlers, template files, authentication middleware, database queries
- Key files: `web/server.ts` (Fastify setup), `web/lib/queries.ts` (all queries), `web/lib/auth.ts` (session tokens)

**`scripts/`**
- Purpose: Data sync and function scripts (not web routes, run via npm scripts or scheduled tasks)
- Contains: Sync scripts (fetch from Fathom, Xero, GHL, Meta), analysis (process meetings), functions (generate briefs), utilities (database, API clients)
- Key files: `scripts/sync/*.ts` (sync workflows), `scripts/utils/db.ts` (database abstraction), `scripts/utils/*.ts` (API clients)

**`data/`**
- Purpose: Local persistent storage
- Contains: SQLite database (vendo.db, gitignored), decision journal (JSON files)
- Generated: Yes (vendo.db built from API syncs)
- Committed: No (vendo.db is gitignored; decisions/ are committed)

**`outputs/`**
- Purpose: Generated deliverables
- Contains: Daily briefs (markdown), analyses, decision tracking
- Generated: Yes (populated by functions/generate-daily-brief.ts and analyses)
- Committed: Yes (outputs are versioned)

**`context/`**
- Purpose: Business context layer (who you are, what you do, where you're going)
- Contains: personal-info.md, companies.md, team.md, strategy.md, current-data.md, integrations.md
- Committed: Yes (essential for system to understand your business)

**`plans/`**
- Purpose: Implementation plans (created by /create-plan, executed by /implement)
- Contains: Dated markdown files describing build steps
- Committed: Yes (reference/audit trail)

**`reference/`**
- Purpose: Framework documentation (architecture, autonomy ladder, decision engine, MCP guide, scheduling, channels)
- Committed: Yes (part of AI OS framework)

**`public/`**
- Purpose: Static assets served by web server
- Contains: CSS (style.css), images, fonts, favicon
- Committed: Yes (part of codebase)

## Key File Locations

**Entry Points:**

- `web/start.ts`: Loads .env.local, initialises Fastify app, starts server on port (default 3000)
- `scripts/sync/sync-meetings.ts`: Primary sync script for Fathom video meetings
- `scripts/functions/generate-daily-brief.ts`: Cloud function to generate daily brief
- `scripts/analysis/process-meetings.ts`: Post-sync processing (categorisation, client extraction, assignee normalisation)

**Configuration:**

- `.env.example`: Template showing all required environment variables (copy to .env.local)
- `tsconfig.json`: TypeScript compiler options (target ES2022, module esnext)
- `package.json`: npm scripts, dependencies, project metadata
- `web/server.ts`: Fastify middleware configuration (auth hook, form parser, template engine)

**Core Logic:**

- `web/lib/queries.ts`: All database queries (28KB file, 600+ lines). Exports 40+ functions for stats, meetings, actions, clients, ads, pipeline, users.
- `web/lib/auth.ts`: Session tokens, password hashing, session validation. Uses bcryptjs (BCRYPT_ROUNDS=10) and custom HMAC-SHA256 tokens.
- `scripts/utils/db.ts`: Database abstraction (sql.js for dev, Turso for prod). Handles schema initialisation, transaction lifecycle, FTS indexing.
- `scripts/utils/fathom-client.ts`: Fathom API wrapper. Fetches meetings, transcripts, action items.
- `scripts/utils/xero-client.ts`: Xero API wrapper (OAuth 2.0, granular scopes). Fetches invoices, contacts, accounts.
- `scripts/utils/meta-client.ts`: Meta Ads API wrapper. Fetches ad accounts, campaigns, performance metrics.

**Testing:**

- No test files found. Project uses no test framework (Jest, Vitest, etc.). Testing likely manual or integration via staging deployment.

**Database Schema:**

- Tables created in `scripts/utils/db.ts` (CREATE TABLE statements):
  - `meetings`: Meeting metadata, summaries, transcripts, categorisation
  - `action_items`: Tasks extracted from meetings, assignee tracking
  - `clients`: Client names, verticals, status, first/last meeting dates
  - `ads_accounts`, `ads_campaigns`, `ads_daily`: Meta Ads performance
  - `xero_invoices`, `xero_contacts`: Xero financial data
  - `ghl_opportunities`: Sales pipeline opportunities
  - `users`: Dashboard users, roles, passwords
  - `channels`: User permission groups
  - `user_channels`: Many-to-many user ↔ channel mapping
  - `oauth_tokens`: Stored Google/Xero OAuth tokens (encrypted or hashed)
  - `sync_log`: Timestamp and row count of last sync per source

## Naming Conventions

**Files:**

- Routes: Kebab-case (e.g., `action-items.ts`, `google-oauth.ts`)
- Templates: Kebab-case with `.eta` extension (e.g., `dashboard.eta`, `action-items.eta`)
- Utilities: Camel-case (e.g., `fathomClient.ts`, not fathom-client)
- Sync scripts: `sync-[service].ts` pattern (e.g., `sync-meetings.ts`, `sync-xero.ts`)

**Directories:**

- Route groups: Kebab-case matching feature (e.g., `admin/`, `briefs/`, `meetings/`)
- Library directories: Singular names (`lib/`, `utils/`)
- Data directories: Singular names (`data/`, `scripts/`, `outputs/`)

**TypeScript:**

- Types/Interfaces: PascalCase (e.g., `SessionUser`, `MeetingRow`, `FathomMeeting`)
- Functions: camelCase (e.g., `getDashboardStats`, `verifyPassword`)
- Constants: UPPER_SNAKE_CASE (e.g., `BCRYPT_ROUNDS`, `SESSION_DURATION`)
- Database fields: snake_case (e.g., `must_change_password`, `raw_action_items`)

## Where to Add New Code

**New Feature (e.g., New Section of Dashboard):**

1. **Route handler:** Create `web/routes/[feature].ts` exporting `FastifyPluginAsync`
2. **Queries:** Add functions to `web/lib/queries.ts` (or new file if complex)
3. **Template:** Create `web/views/[feature].eta`
4. **Register route:** Import and call in `web/server.ts` via `app.register()`

Example structure for new "reports" feature:
```
web/routes/reports.ts          # GET /reports handler
web/lib/queries.ts             # Add getReportData() function
web/views/reports.eta          # Report template
web/views/reports/detail.eta   # Detail template if nested
```

**New Sync (e.g., Connect New API):**

1. **Client wrapper:** Create `scripts/utils/[service]-client.ts` with fetch-based wrapper
2. **Sync script:** Create `scripts/sync/sync-[service].ts` with upsert logic
3. **Schema:** Add tables to `scripts/utils/db.ts` (CREATE TABLE statements)
4. **npm script:** Add to `package.json` under scripts: `"sync:[service]": "tsx scripts/sync/sync-[service].ts"`

Example for hypothetical HubSpot integration:
```
scripts/utils/hubspot-client.ts    # Fetch from HubSpot API
scripts/sync/sync-hubspot.ts       # Upsert to database
scripts/utils/db.ts                # Add CREATE TABLE for hubspot_contacts, hubspot_deals
package.json                       # Add "sync:hubspot" script
```

**New Scheduled Function (e.g., Weekly Report):**

1. **Function script:** Create `scripts/functions/generate-weekly-report.ts`
2. **npm script:** Add to `package.json`: `"weekly:report": "tsx scripts/functions/generate-weekly-report.ts"`
3. **Schedule:** Set up cloud task or GitHub Actions workflow

**Shared Library:**

- **Authentication/Session logic:** Add to `web/lib/auth.ts`
- **API client helpers:** Add to `scripts/utils/[service]-client.ts` or create new `scripts/utils/helpers.ts`
- **Database helpers:** Add to `scripts/utils/db.ts` if schema-related, else `web/lib/queries.ts`

**Utilities:**

- Shared helpers: `scripts/utils/helpers.ts` or service-specific file
- Type definitions: Keep with implementation (same file as where used)

## Special Directories

**`.env.local`**
- Purpose: Environment variables for local development and API credentials
- Generated: No (manually created from .env.example)
- Committed: No (gitignored for security)
- Contains: Database URLs, API keys, OAuth secrets, session secret, admin password

**`data/vendo.db`**
- Purpose: Local SQLite database (development only)
- Generated: Yes (built by sync scripts, saved to disk)
- Committed: No (gitignored, rebuilt from API syncs)
- Note: In production, reads/writes to Turso cloud database via TURSO_DATABASE_URL and TURSO_AUTH_TOKEN env vars

**`.vercel/`**
- Purpose: Vercel project configuration
- Contains: `project.json` (single-project setup) or `repo.json` (monorepo setup)
- Committed: Yes (needed for deployments)

**`outputs/briefs/`**
- Purpose: Generated daily briefs
- Files: Named `YYYY-MM-DD.md` (e.g., `2026-04-01.md`)
- Generated: Yes (by `npm run brief:data`)
- Committed: Yes (versioned output)

---

*Structure analysis: 2026-04-01*
