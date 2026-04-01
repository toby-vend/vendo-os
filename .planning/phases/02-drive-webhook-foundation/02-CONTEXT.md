# Phase 2: Drive Webhook Foundation - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish real-time Google Drive push notifications so VendoOS knows immediately when SOPs or brand files change. Three deliverables: (1) register Drive webhook channels and receive push notifications, (2) auto-renew channels before their silent 7-day expiry, (3) provide a manual full re-index command for initial population and recovery. No document processing or classification — that's Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

User trusts Claude to make sensible technical decisions for all Drive webhook choices. Key areas and recommended approaches:

**Drive auth approach:**
- Reuse existing per-user Google OAuth flow (`web/routes/google-oauth.ts`) — tokens already stored encrypted in DB
- An admin user connects their Google account (existing flow), their token is used for Drive API calls
- Add `https://www.googleapis.com/auth/drive.readonly` scope to existing OAuth flow
- For webhook registration, use the admin user's token to call `changes.watch()`
- Service account would require Workspace admin setup — overkill for current scale, can migrate later if needed
- Store which user's token is being used for Drive sync in `drive_watch_channels` table

**Webhook endpoint design:**
- New Fastify route: `POST /api/drive/webhook` — receives Drive push notifications
- Google sends a POST with `X-Goog-Channel-ID`, `X-Goog-Resource-ID`, `X-Goog-Resource-State` headers
- Validate channel ID against `drive_watch_channels` table (reject unknown channels)
- On receive: write a `drive_sync_queue` row (or similar lightweight record) and return 200 immediately
- Actual document processing happens in a separate function (Phase 3) — webhook just records "something changed"
- Vercel function timeout is not a concern since webhook handler just writes a DB row and returns

**Channel renewal:**
- Cron job (Vercel Cron or scheduled task) runs daily to check `drive_watch_channels.expiration`
- If any channel expires within 24 hours, call `changes.watch()` again with the same parameters
- Update `drive_watch_channels` row with new channel_id, resource_id, expiration, renewed_at
- Log renewal events for debugging
- If renewal fails (e.g. token expired), surface error in admin dashboard status

**Re-index strategy:**
- Use Google Drive Changes API with `changes.getStartPageToken()` for initial setup
- Full re-index: list all files in the configured Drive folders recursively, insert/update skill records
- Store `page_token` in `drive_watch_channels` table — survives Vercel cold starts
- Re-index command: `npm run drive:reindex` — walks folder tree, processes each file
- Changes API for incremental updates (webhook-triggered): fetch changes since last `page_token`
- Re-index is idempotent — safe to run multiple times

**Folder configuration:**
- Drive folder IDs for each channel (paid social, SEO, paid ads, general) stored in env vars or config
- Format: `DRIVE_FOLDER_PAID_SOCIAL`, `DRIVE_FOLDER_SEO`, `DRIVE_FOLDER_PAID_ADS`, `DRIVE_FOLDER_GENERAL`
- Brand files folder: `DRIVE_FOLDER_BRANDS` — separate from channel folders

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `web/routes/google-oauth.ts`: Full OAuth2 flow with encrypted token storage — reuse for Drive API auth
- `web/lib/google-tokens.ts`: Token retrieval with lazy v0→v1 migration — use to get access tokens for Drive API calls
- `web/lib/crypto.ts`: Versioned encryption — tokens already handled
- `web/lib/queries/base.ts`: Shared db client + helpers — new `queries/drive.ts` module slots in here
- `drive_watch_channels` table: Already created in Phase 1 with channel_id, resource_id, expiration, page_token

### Established Patterns
- External API clients follow pattern: standalone module in `scripts/utils/` (e.g. `fathom-client.ts`, `xero-client.ts`)
- Sync scripts live in `scripts/sync/` with `npm run sync:*` commands
- Route handlers validate session + permissions before processing

### Integration Points
- `web/routes/google-oauth.ts` — extend scopes to include `drive.readonly`
- `web/lib/queries/` — add `drive.ts` module for drive_watch_channels queries
- `scripts/sync/` — add `sync-drive.ts` for re-index command
- `vercel.json` — may need cron configuration for channel renewal
- `.env.local` — add Drive folder ID env vars

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User explicitly delegated all Drive webhook decisions to Claude.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-drive-webhook-foundation*
*Context gathered: 2026-04-01*
