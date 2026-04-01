# External Integrations

**Analysis Date:** 2026-04-01

## APIs & External Services

**Meeting Intelligence:**
- Fathom Video - Meeting transcription, summaries, action item extraction
  - SDK/Client: Custom `FathomClient` in `scripts/utils/fathom-client.ts`
  - Auth: `FATHOM_API_KEY` (Bearer token in X-Api-Key header)
  - Sync: `npm run sync:meetings` - Lists meetings with pagination, fetches transcripts
  - API: `https://api.fathom.ai/external/v1`
  - Rate limit: 55 requests/minute (conservative margin below 60)
  - Database tables: `meetings`, `sync_log`

**CRM & Pipeline:**
- GoHighLevel (GHL) - Pipeline stages, opportunities, contacts
  - SDK/Client: Custom fetch wrapper in `scripts/sync/sync-ghl.ts`
  - Auth: `GHL_API_KEY` (Bearer token in Authorization header), `GHL_LOCATION_ID`
  - Sync: `npm run sync:ghl` - Fetches pipelines, stages, opportunities with pagination
  - API: `https://services.leadconnectorhq.com` (Version 2021-07-28)
  - Database tables: `ghl_pipelines`, `ghl_stages`, `ghl_opportunities`

**Finance & Accounting:**
- Xero - Invoices, contacts, P&L reports, bank summaries
  - SDK/Client: Custom `XeroClient` in `scripts/utils/xero-client.ts`
  - Auth: OAuth 2.0 with granular scopes
    - Client credentials: `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`
    - Token storage: `.secrets/xero-tokens.json` (auto-refreshed)
    - Scopes: accounting.contacts.read, accounting.invoices.read, accounting.payments.read, accounting.reports.* (read-only)
  - Sync: `npm run sync:xero` - Fetches invoices, contacts, P&L (12 months), bank summary (current month)
  - API: `https://api.xero.com/api.xro/2.0`
  - Database tables: `xero_invoices`, `xero_contacts`, `xero_pnl_monthly`, `xero_bank_summary`

**Advertising:**
- Meta (Facebook) Ads - Ad account insights, campaign/adset/ad performance
  - SDK/Client: Custom `MetaClient` in `scripts/utils/meta-client.ts`
  - Auth: `META_ACCESS_TOKEN` (Bearer token)
  - Sync: `npm run sync:meta` (7-day default) or `npm run sync:meta:backfill` (90 days)
  - API: `https://graph.facebook.com/v21.0` (Facebook Graph API v21.0)
  - Rate limit: 180 requests/minute (conservative within Meta's account limits)
  - Database tables: `meta_ad_accounts`, `meta_insights` (campaign, adset, ad levels)

**Team Communication:**
- Slack - Not yet fully integrated, configured in `.mcp.json`
  - SDK: `@modelcontextprotocol/server-slack` (MCP)
  - Auth: `SLACK_BOT_TOKEN`, `SLACK_TEAM_ID`
  - Use case: Future task notifications, decision logging

## Data Storage

**Databases:**

**Local (Development):**
- Type/Provider: SQLite (sql.js 1.11.0 with file persistence)
- File: `data/vendo.db` (git-ignored, auto-created)
- Connection: `file:data/vendo.db` (in `web/lib/queries.ts`)
- Client: `@libsql/client` (supports both local files and Turso)

**Cloud (Production via Vercel):**
- Type/Provider: Turso (managed SQLite)
- Connection: `TURSO_DATABASE_URL` (set in Vercel project settings)
- Auth: `TURSO_AUTH_TOKEN` (secret in Vercel)
- Client: `@libsql/client` (same API as local)
- Fallback: Automatically uses local `data/vendo.db` if `TURSO_DATABASE_URL` is not set

**File Storage:**
- Google Drive - File access configured via OAuth
  - MCP Server: `@modelcontextprotocol/server-gdrive`
  - Auth: Google OAuth tokens stored in `.secrets/gcp-oauth.keys.json`
  - Credentials: `.secrets/.gdrive-server-credentials.json` (service account or OAuth credentials)
  - Scopes: `drive.readonly`, `gmail.readonly`, `calendar.readonly` (via `web/routes/google-oauth.ts`)
  - Use case: Read-only access to Google Drive, Gmail, Calendar

**Caching:**
- None detected - Responses are real-time queries from local/cloud database

## Authentication & Identity

**Auth Provider:**
- Custom in-house implementation (no third-party auth as primary)
  - Implementation: `web/lib/auth.ts`
  - Session tokens: HMAC-SHA256 signed JWT-like tokens (base64url payload + hex signature)
  - Password hashing: bcryptjs with 10 rounds
  - Session duration: 7 days
  - Storage: `vendo_session` HttpOnly cookie
  - Validation: Timing-safe HMAC comparison in `verifySessionToken()`

**OAuth Integrations:**
- Google OAuth - User-initiated flow for Drive, Gmail, Calendar access
  - Endpoint: `GET /auth/google/connect` → Google login → `GET /auth/google/callback`
  - Client ID: `GOOGLE_CLIENT_ID` (set in Vercel env)
  - State validation: HMAC-SHA256 signed state parameter
  - Token storage: Encrypted in database via `web/lib/crypto.ts`
  - Queries: `upsertUserOAuthToken()`, `deleteUserOAuthToken()`, `getUserOAuthToken()`

- Xero OAuth - Automatic token refresh
  - Flow handled in `scripts/auth/xero-auth.ts`
  - Token refresh: Automatic when expired (using refresh_token)
  - Token storage: `.secrets/xero-tokens.json` (on disk for scripts)

## Monitoring & Observability

**Error Tracking:**
- None detected - Errors logged to console/stdout

**Logs:**
- Approach: Console logging via Fastify logger (enabled in dev, disabled on Vercel)
  - Dev: `app.log.error()`, `app.log.info()` via Fastify
  - Vercel: Logger disabled (`process.env.VERCEL ? false : true`)
- Sync scripts: Custom `log()` and `logError()` functions in `scripts/utils/db.ts`
  - Output format: `[CONTEXT] message` (e.g., `[SYNC] Sync complete`)
  - Detailed rate-limit tracking: `[RATE] Limit reached (50/55), waiting 2s`

## CI/CD & Deployment

**Hosting:**
- Vercel (serverless platform)
  - Project ID: `prj_tds20ExrxZt4zaXTYlc1Sy4EGSvG`
  - Project name: `vendo-os`
  - Org ID: `team_4o7ZaIXIOoH4xDrlxGMiQ6Gl`
  - Linked via `.vercel/project.json`
  - Function handler: `api/index.ts` (Fastify app adapter)
  - Static files: `public/` directory (Vercel CDN)

**CI Pipeline:**
- None detected - No GitHub Actions or CI config in repo
- Deployment: Manual via `vercel deploy` or `git push` with Vercel integration
- Environment: Production vs preview (based on branch)

## Environment Configuration

**Required env vars (development):**
```
FATHOM_API_KEY=              # Fathom meeting transcription
GHL_API_KEY=                 # GoHighLevel CRM
GHL_LOCATION_ID=             # GoHighLevel location
SLACK_BOT_TOKEN=             # Slack integration (future)
SLACK_TEAM_ID=               # Slack workspace ID
GDRIVE_CREDENTIALS_PATH=     # Google Drive credentials JSON
GDRIVE_OAUTH_PATH=           # Google Drive OAuth token JSON
SESSION_SECRET=              # For session token signing (or DASHBOARD_PASSWORD)
DASHBOARD_PORT=3000          # Local dev port
NODE_ENV=development         # Optional, defaults to dev
```

**Required env vars (production on Vercel):**
```
TURSO_DATABASE_URL=          # Cloud SQLite database URL
TURSO_AUTH_TOKEN=            # Turso database token
FATHOM_API_KEY=              # Fathom (for sync scripts)
GHL_API_KEY=                 # GoHighLevel (for sync scripts)
GHL_LOCATION_ID=             # GoHighLevel
GOOGLE_CLIENT_ID=            # Google OAuth
GOOGLE_CLIENT_SECRET=        # Google OAuth
SESSION_SECRET=              # Session token signing
SLACK_BOT_TOKEN=             # Slack (if enabled)
SLACK_TEAM_ID=               # Slack
```

**Secrets location:**
- Development: `.env.local` (git-ignored, never committed)
- Production: Vercel project settings → Environment Variables
- OAuth tokens: Stored in database (encrypted) or `.secrets/` directory (local only)

## Webhooks & Callbacks

**Incoming:**
- Google OAuth callback: `GET /auth/google/callback` - Receives auth code, exchanges for token
- Fathom webhook (configured but endpoint not implemented): `FATHOM_WEBHOOK_SECRET` configured in `.env.example`

**Outgoing:**
- None detected - System only pulls data from external APIs, does not push callbacks

## Data Sync Architecture

**Uni-directional (read-only):**
- Fathom → SQLite (meetings, transcripts, summaries, action items)
- Xero → SQLite (invoices, contacts, P&L, bank data)
- GoHighLevel → SQLite (pipelines, stages, opportunities)
- Meta Ads → SQLite (ad accounts, campaign/adset/ad insights)
- Google Drive → On-demand via MCP (no persistent storage of file contents)

**Push to Production:**
- Local `data/vendo.db` → Turso (cloud) via `npm run db:push`
- Uses `scripts/sync/push-to-turso.ts` to bulk-upload database

## MCP (Model Context Protocol) Integrations

Configured in `.mcp.json`:

**Slack:**
- Server: `@modelcontextprotocol/server-slack`
- Tokens: `SLACK_BOT_TOKEN`, `SLACK_TEAM_ID`
- Type: stdio
- Use: Team communication, task notifications

**GoHighLevel:**
- Server: `@drausal/gohighlevel-mcp` (third-party MCP)
- Token: `GHL_API_KEY` (as `BEARER_TOKEN_BEARERAUTH`)
- Type: stdio
- Use: CRM data access via Claude

**Google Drive:**
- Server: `@modelcontextprotocol/server-gdrive`
- Credentials: Service account JSON + OAuth token JSON
- Type: stdio
- Use: File browsing and reading from Google Drive

**Miro:**
- Server: `https://mcp.miro.com/` (Miro's official HTTP MCP)
- Type: http
- Use: Board design and collaboration access

---

*Integration audit: 2026-04-01*
