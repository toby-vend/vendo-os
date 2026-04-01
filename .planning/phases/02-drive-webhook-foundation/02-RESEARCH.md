# Phase 2: Drive Webhook Foundation - Research

**Researched:** 2026-04-01
**Domain:** Google Drive Changes API, Vercel Cron Jobs, serverless webhook handling
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Drive auth approach:**
- Reuse existing per-user Google OAuth flow (`web/routes/google-oauth.ts`) — tokens already stored encrypted in DB
- An admin user connects their Google account (existing flow), their token is used for Drive API calls
- Add `https://www.googleapis.com/auth/drive.readonly` scope to existing OAuth flow (already present in SCOPES array)
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
- Drive folder IDs for each channel (paid social, SEO, paid ads, general) stored in env vars
- Format: `DRIVE_FOLDER_PAID_SOCIAL`, `DRIVE_FOLDER_SEO`, `DRIVE_FOLDER_PAID_ADS`, `DRIVE_FOLDER_GENERAL`
- Brand files folder: `DRIVE_FOLDER_BRANDS` — separate from channel folders

### Claude's Discretion

User trusts Claude to make sensible technical decisions for all Drive webhook choices. All implementation details are Claude's discretion within the locked framework above.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SYNC-01 | System receives Google Drive webhook notifications when files are created, updated, or deleted | Changes API `changes.watch()` + Fastify webhook route — covered in detail below |
| SYNC-03 | System auto-renews webhook watch channels before silent expiry (max 7 days) | Vercel Cron daily job + channel expiry detection in `drive_watch_channels` — covered below |
| SYNC-06 | System provides a manual full re-index command for initial population and recovery | `npm run drive:reindex` script using Drive Files API folder traversal + `getStartPageToken` — covered below |
</phase_requirements>

---

## Summary

Phase 2 implements the real-time plumbing between Google Drive and VendoOS. Three discrete deliverables: (1) a webhook endpoint that receives Google's change notifications, (2) a daily cron job that renews 7-day watch channels before they expire silently, (3) a CLI re-index script that bootstraps the skills table from all current Drive files.

The Google Drive Changes API (`changes.watch`) is the canonical approach. It sends an empty HTTP POST to your registered HTTPS endpoint when something changes. Your handler validates the channel ID, writes a queue row, and returns 200 — the actual diff work (fetching what changed via `changes.list()`) belongs to Phase 3. The `page_token` persists in Turso, not in serverless memory, so cold starts cannot cause sync gaps.

Vercel Cron on a Pro plan supports daily frequency (and finer) with per-minute precision. The renewal endpoint is protected by `CRON_SECRET`. The `drive.readonly` scope is already present in the existing OAuth SCOPES array — no OAuth re-consent flow is needed if users already connected.

**Primary recommendation:** Implement all three deliverables as thin, independent units. Webhook handler is fire-and-forget (writes queue row, returns 200). Renewal cron is idempotent (safe to run multiple times). Re-index script is idempotent (upserts by `drive_file_id`).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Google Drive REST API v3 | v3 (current) | `changes.watch()`, `changes.getStartPageToken()`, `files.list()` | Official API — no SDK needed, project already uses raw `fetch` for Google APIs |
| `@libsql/client` | `^0.17.2` (already installed) | Persist page_token and drive_watch_channels in Turso | Already in use across the project |
| Fastify | `^5.8.4` (already installed) | Webhook route handler | Existing web framework |
| Vercel Cron | (platform feature) | Daily channel renewal trigger | Already on Vercel, zero infrastructure cost |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tsx` | `^4.19.0` (already installed) | Run re-index script via `npm run drive:reindex` | Already used for all `scripts/sync/*` commands |
| `dotenv` | `^16.4.0` (already installed) | Load `.env.local` in scripts | Same pattern as `sync-xero.ts`, `sync-meetings.ts` |
| `crypto` (Node built-in) | — | Generate UUID channel IDs | Already used in `google-oauth.ts` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `changes.watch()` | Google Workspace Events API (Cloud Pub/Sub) | Workspace Events API is newer and more reliable but requires Cloud Pub/Sub infrastructure — overkill vs direct webhook for current scale |
| Vercel Cron | External cron (Upstash, cron-job.org) | Vercel Cron is zero infrastructure and already in platform — external adds a dependency |
| Raw `fetch` for Drive API | `googleapis` npm package | Project already uses raw `fetch` for all Google APIs; adding `googleapis` would be inconsistent |

**Installation:** No new packages needed — all dependencies already present.

---

## Architecture Patterns

### Recommended Project Structure
```
web/
├── routes/
│   └── drive-webhook.ts       # POST /api/drive/webhook handler
├── lib/
│   └── queries/
│       └── drive.ts           # drive_watch_channels + drive_sync_queue queries
api/
└── cron/
    └── renew-drive-channels.ts  # GET handler invoked by Vercel Cron
scripts/
└── sync/
    └── sync-drive.ts          # npm run drive:reindex command
```

### Pattern 1: Webhook Handler — Write and Return 200
**What:** Receive Drive notification, validate channel ID, write queue row, return 200 immediately.
**When to use:** Any inbound webhook with latency risk — never do real work in the handler.
**Example:**
```typescript
// Source: https://developers.google.com/workspace/drive/api/guides/push
// Drive sends POST with headers only — no body with change data
app.post('/api/drive/webhook', async (request, reply) => {
  const channelId = request.headers['x-goog-channel-id'] as string;
  const resourceState = request.headers['x-goog-resource-state'] as string;

  // Ignore the initial sync notification (resource-state: sync)
  if (resourceState === 'sync') {
    reply.code(200).send();
    return;
  }

  // Validate against known channels — reject unknown
  const channel = await getDriveWatchChannel(channelId);
  if (!channel) {
    reply.code(404).send();
    return;
  }

  // Write queue row — Phase 3 processes it
  await insertDriveSyncQueueItem({ channelId, resourceState });

  reply.code(200).send();
});
```

### Pattern 2: Changes API Registration Sequence
**What:** Correct order of operations to register a watch channel and persist the pageToken.
**When to use:** Initial setup and every renewal.
**Example:**
```typescript
// Source: https://developers.google.com/workspace/drive/api/guides/push
// Step 1: Get start page token
const startRes = await fetch(
  'https://www.googleapis.com/drive/v3/changes/startPageToken',
  { headers: { Authorization: `Bearer ${accessToken}` } }
);
const { startPageToken } = await startRes.json();

// Step 2: Register watch channel
const channelId = crypto.randomUUID();
const watchRes = await fetch(
  `https://www.googleapis.com/drive/v3/changes/watch?pageToken=${startPageToken}`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: channelId,          // UUID, max 64 chars
      type: 'web_hook',
      address: 'https://your-domain.vercel.app/api/drive/webhook',
      token: process.env.DRIVE_WEBHOOK_SECRET, // verification token
      // No expiration field = Google sets max (604800s = 7 days for changes resource)
    }),
  }
);
const { resourceId, expiration } = await watchRes.json();

// Step 3: Persist to drive_watch_channels
await upsertDriveWatchChannel({
  channelId,
  resourceId,
  expiration: parseInt(expiration), // milliseconds unix timestamp
  pageToken: startPageToken,
});
```

### Pattern 3: Vercel Cron Endpoint for Channel Renewal
**What:** GET handler that checks expiry, renews soon-to-expire channels.
**When to use:** Runs once daily via Vercel Cron.
**Example:**
```typescript
// Source: https://vercel.com/docs/cron-jobs/manage-cron-jobs
// api/cron/renew-drive-channels.ts — registered in vercel.json
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers['authorization'];
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ success: false });
  }

  const expiringChannels = await getChannelsExpiringWithin24h();
  for (const channel of expiringChannels) {
    await renewChannel(channel); // re-calls changes.watch() with new UUID
  }

  return res.status(200).json({ renewed: expiringChannels.length });
}
```

**vercel.json crons entry:**
```json
{
  "crons": [
    {
      "path": "/api/cron/renew-drive-channels",
      "schedule": "0 6 * * *"
    }
  ]
}
```

### Pattern 4: Re-index Script (Drive Files API Folder Walk)
**What:** Walk each configured folder recursively using `files.list`, upsert skill rows.
**When to use:** Initial population, recovery, or triggered manually.
**Example:**
```typescript
// scripts/sync/sync-drive.ts — follows same pattern as sync-xero.ts
import { config } from 'dotenv';
config({ path: '.env.local' });

const folderIds = {
  paid_social: process.env.DRIVE_FOLDER_PAID_SOCIAL,
  seo: process.env.DRIVE_FOLDER_SEO,
  paid_ads: process.env.DRIVE_FOLDER_PAID_ADS,
  general: process.env.DRIVE_FOLDER_GENERAL,
  brands: process.env.DRIVE_FOLDER_BRANDS,
};

async function listFilesInFolder(folderId: string, accessToken: string): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', `'${folderId}' in parents and trashed = false`);
    url.searchParams.set('fields', 'files(id,name,mimeType,modifiedTime),nextPageToken');
    url.searchParams.set('pageSize', '100');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    files.push(...(data.files ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return files;
}
```

### Pattern 5: drive_sync_queue Table
**What:** Lightweight append-only queue written by webhook handler, consumed by Phase 3 processor.
**When to use:** Decouples real-time webhook receipt from (potentially slow) document processing.

The `drive_sync_queue` table needs to be added to `initSchema()` in `web/lib/queries/auth.ts`:

```sql
CREATE TABLE IF NOT EXISTS drive_sync_queue (
  id INTEGER PRIMARY KEY,
  channel_id TEXT NOT NULL,
  resource_state TEXT NOT NULL,
  received_at TEXT NOT NULL,
  processed_at TEXT,
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_dsq_unprocessed ON drive_sync_queue(processed_at) WHERE processed_at IS NULL;
```

### Anti-Patterns to Avoid
- **Processing in the webhook handler:** Drive will retry if it doesn't get a 200 within a few seconds. Any DB query, file fetch, or processing belongs in Phase 3's consumer, not here.
- **Storing pageToken in memory:** Vercel serverless functions have no persistent memory. Always read/write pageToken from Turso.
- **Not handling the `sync` notification:** Google sends a resource-state `sync` notification immediately after `changes.watch()` registration. It contains no changes — return 200 and discard it.
- **Re-using the same channel ID on renewal:** Each `changes.watch()` call must use a fresh UUID. The old channel_id becomes invalid once the new one is created.
- **Omitting the `token` verification field:** Without a `token` field in the watch registration, any party that discovers your webhook URL can send fake notifications. Set `token` to a secret env var and validate `X-Goog-Channel-Token` header on receipt.
- **Registering without `pageToken` in the query parameter:** `changes.watch()` requires `pageToken` as a query param — without it the request fails with a 400.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Generating a webhook channel UUID | Custom ID generator | `crypto.randomUUID()` (Node built-in) | Already used in `google-oauth.ts`; UUIDs are the Google-recommended format |
| Token expiry tracking | Custom clock math | Store `expiration` from Google's response (ms unix timestamp); compare to `Date.now()` | Google tells you the exact expiry; no need to calculate it |
| Webhook security validation | Custom HMAC scheme | `X-Goog-Channel-Token` header matching (set in watch registration, validated on receipt) | Google's built-in mechanism; and separately use `CRON_SECRET` for the cron endpoint |
| Handling paginated file lists | Recursive function builder | Standard `do { ... } while (nextPageToken)` loop | Simple pagination, well-understood pattern already in `meta-client.ts` |
| Retry logic for Drive API calls | Exponential backoff library | Simple single-retry with 1s delay for 429/5xx | Drive API errors in this context are transient setup ops, not hot path |

**Key insight:** The Drive Changes API is deliberately minimal — it sends a signal (something changed), not the data. Never try to extract change details from webhook headers; always call `changes.list()` after receiving a notification (Phase 3 concern).

---

## Common Pitfalls

### Pitfall 1: Domain Verification Required for Webhook URL
**What goes wrong:** `changes.watch()` returns 400 or 403 with no useful error if your webhook domain is not verified in Google Search Console and registered with your GCP project.
**Why it happens:** Google validates your domain ownership before allowing push notifications to it — HTTPS alone is not sufficient.
**How to avoid:** Verify `vendos.app` (or whatever the production domain is) in Google Search Console using the Domain method (not URL prefix). Register the same domain in the GCP project's OAuth consent screen / Push Notification domain settings.
**Warning signs:** `changes.watch()` returns `{"error": {"code": 400, "message": "Delegate cannot act as domain"}}` or similar domain-related errors.

### Pitfall 2: pageToken Not Persisted Before Watch Registration
**What goes wrong:** If `getStartPageToken()` is called but the result isn't written to Turso before registering the watch channel, a serverless cold start between those two steps loses the token. The next `changes.list()` call starts with no token and may return a massive backlog or error.
**Why it happens:** Serverless memory is ephemeral — if the function restarts between steps, any in-memory state is gone.
**How to avoid:** Write the pageToken to `drive_watch_channels` atomically with the channel registration result. Use a transaction or write the token first, then register the channel and update.
**Warning signs:** `changes.list()` returns `newStartPageToken` pointing far in the past; or a 400 "invalid page token" error.

### Pitfall 3: Silent Channel Expiry
**What goes wrong:** Drive watch channels for `changes` expire after maximum 7 days (604800 seconds). Google sends no notification when a channel expires — sync just stops silently.
**Why it happens:** This is the documented behaviour — no renewal notification is sent.
**How to avoid:** The daily cron at 06:00 UTC checks `drive_watch_channels.expiration` and renews any channel expiring within 24 hours. Verify cron is running in production Vercel logs.
**Warning signs:** `drive_watch_channels.expiration` has passed; no new rows in `drive_sync_queue` despite known Drive changes.

### Pitfall 4: Hobby Plan Cron Frequency Restriction
**What goes wrong:** If the project is on Vercel Hobby, cron jobs can only run once per day, and the timing precision is ±59 minutes. Deploying a more-frequent schedule causes a deployment failure.
**Why it happens:** Vercel Hobby has hard cron frequency restrictions.
**How to avoid:** Confirm the Vercel project is on Pro plan before adding cron config. Daily `0 6 * * *` is within Hobby limits if needed, but Pro is required for any sub-daily frequency. The renewal cron only needs to run once daily — this is fine on either plan.
**Warning signs:** Vercel deployment error: "Hobby accounts are limited to daily cron jobs."

### Pitfall 5: drive.readonly Scope Not on Admin User's Existing Token
**What goes wrong:** The `drive.readonly` scope is already in the SCOPES constant in `google-oauth.ts`, but any user who connected Google _before_ this phase will have a stored token without that scope. `changes.watch()` calls will return 403.
**Why it happens:** OAuth tokens only include scopes granted at consent time. Adding a scope to the code does not retroactively update existing tokens.
**How to avoid:** The re-index script and channel registration should check the stored token's `scopes` column before proceeding. If `drive.readonly` is absent, surface a clear message: "Admin must reconnect their Google account to add Drive access."
**Warning signs:** `changes.watch()` returns 403; stored token's `scopes` column doesn't contain `drive.readonly`.

### Pitfall 6: changes.watch() Requires pageToken as Query Parameter
**What goes wrong:** Calling `POST https://www.googleapis.com/drive/v3/changes/watch` without `?pageToken=...` returns a 400 error.
**Why it happens:** Unlike `files.watch()`, `changes.watch()` requires the pageToken in the request URL, not the body.
**How to avoid:** Always append `?pageToken=<token>` to the URL when calling `changes.watch()`. Call `getStartPageToken()` first if no existing token is stored.
**Warning signs:** `changes.watch()` returns 400 "Bad Request" or "missing required parameter: pageToken".

---

## Code Examples

Verified patterns from official sources:

### Complete Watch Registration
```typescript
// Source: https://developers.google.com/workspace/drive/api/guides/push
async function registerWatchChannel(accessToken: string, webhookUrl: string): Promise<{
  channelId: string;
  resourceId: string;
  expiration: number;
  pageToken: string;
}> {
  // 1. Get start page token
  const tokenRes = await fetch(
    'https://www.googleapis.com/drive/v3/changes/startPageToken',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!tokenRes.ok) throw new Error(`getStartPageToken failed: ${tokenRes.status}`);
  const { startPageToken } = await tokenRes.json() as { startPageToken: string };

  // 2. Register watch channel (pageToken MUST be in query params, not body)
  const channelId = crypto.randomUUID();
  const watchRes = await fetch(
    `https://www.googleapis.com/drive/v3/changes/watch?pageToken=${encodeURIComponent(startPageToken)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: channelId,
        type: 'web_hook',
        address: webhookUrl,
        token: process.env.DRIVE_WEBHOOK_SECRET, // validated via X-Goog-Channel-Token
        // No expiration field = Google uses maximum (604800s for changes resource)
      }),
    }
  );
  if (!watchRes.ok) throw new Error(`changes.watch failed: ${watchRes.status} ${await watchRes.text()}`);
  const { resourceId, expiration } = await watchRes.json() as { resourceId: string; expiration: string };

  return {
    channelId,
    resourceId,
    expiration: parseInt(expiration, 10), // Google returns ms unix timestamp as string
    pageToken: startPageToken,
  };
}
```

### Webhook Header Validation
```typescript
// Source: https://developers.google.com/workspace/drive/api/guides/push
// Headers Google sends with every notification:
// X-Goog-Channel-ID    — your channelId
// X-Goog-Resource-ID   — stable resource identifier
// X-Goog-Resource-State — 'sync' | 'add' | 'remove' | 'update' | 'trash' | 'untrash' | 'change'
// X-Goog-Channel-Token — your secret token (if set in registration)
// X-Goog-Message-Number — sequential counter (1 for sync)
// X-Goog-Channel-Expiration — human-readable expiry (informational)

function validateWebhookHeaders(request: FastifyRequest): {
  channelId: string;
  resourceState: string;
  valid: boolean;
} {
  const channelId = request.headers['x-goog-channel-id'] as string;
  const resourceState = request.headers['x-goog-resource-state'] as string;
  const channelToken = request.headers['x-goog-channel-token'] as string;

  const valid = !!(
    channelId &&
    resourceState &&
    channelToken === process.env.DRIVE_WEBHOOK_SECRET
  );

  return { channelId, resourceState, valid };
}
```

### Stopping a Watch Channel (for renewal)
```typescript
// Source: https://developers.google.com/workspace/drive/api/guides/push
async function stopWatchChannel(
  channelId: string,
  resourceId: string,
  accessToken: string
): Promise<void> {
  await fetch('https://www.googleapis.com/drive/v3/channels/stop', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id: channelId, resourceId }),
  });
  // Returns 204 on success; ignore errors (channel may already be expired)
}
```

### vercel.json Cron Entry
```json
{
  "crons": [
    {
      "path": "/api/cron/renew-drive-channels",
      "schedule": "0 6 * * *"
    }
  ]
}
```

### Checking Stored Scopes Before Drive API Calls
```typescript
// Verify admin user has drive.readonly before proceeding
const tokenRow = await getUserOAuthToken(adminUserId, 'google');
if (!tokenRow) throw new Error('Admin has not connected Google account');
if (!tokenRow.scopes.includes('https://www.googleapis.com/auth/drive.readonly')) {
  throw new Error('Admin must reconnect Google account to grant Drive access');
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `files.watch()` per-file | `changes.watch()` drive-wide | Drive API v3 (2015, stable) | Single channel watches all changes; no per-file registration needed |
| Direct `googleapis` npm SDK | Raw `fetch` to REST endpoints | Project convention | Consistent with existing codebase; no additional dependency |
| files.watch channel expiry | changes.watch max 7 days (604800s) | Documented limit | Renewal cron must run at least daily to catch this |
| No alternative | Google Workspace Events API (Cloud Pub/Sub) | Preview 2025 | Future migration path if reliability issues arise; not needed now |

**Deprecated/outdated:**
- `supportsTeamDrives` parameter: Deprecated, use `supportsAllDrives` instead in any Drive API calls
- `teamDriveId` parameter: Deprecated, use `driveId` instead

---

## Open Questions

1. **Domain verification status**
   - What we know: Google requires the webhook domain to be verified in Search Console and registered with the GCP project before `changes.watch()` will accept it
   - What's unclear: Whether `vendos.app` (or the actual production domain) is already verified in Search Console
   - Recommendation: Make this a Wave 0 pre-flight check in the plan — the planner should include a verification step before implementing the watch registration

2. **Admin user ID for Drive API calls**
   - What we know: `drive_watch_channels` table should store which user's token is used; the context says "admin user"
   - What's unclear: How the admin user ID is resolved at runtime (env var? query for role='admin'? fixed user?)
   - Recommendation: Use `DRIVE_ADMIN_USER_ID` env var — explicit, not fragile to team changes. Fall back to first user with `role='admin'` if not set.

3. **`drive_sync_queue` table — in Phase 2 or Phase 3?**
   - What we know: Webhook handler needs somewhere to write "something changed" immediately; Phase 3 consumes it
   - What's unclear: Whether creating the table in Phase 2 schema migration creates unwanted Phase 3 coupling
   - Recommendation: Create the table in Phase 2 `initSchema()`. It's infrastructure, and Phase 3 only adds the consumer. An empty table is not a coupling problem.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` (no vitest/jest installed) |
| Config file | None — `node --test` discovers `*.test.ts` files via tsx loader |
| Quick run command | `node --import tsx/esm --test web/lib/queries/index.test.ts` |
| Full suite command | `node --import tsx/esm --test web/lib/queries/**/*.test.ts` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SYNC-01 | Webhook route returns 200 for valid `sync` notification | unit | `node --import tsx/esm --test web/routes/drive-webhook.test.ts` | ❌ Wave 0 |
| SYNC-01 | Webhook route returns 200 and writes queue row for valid `change` notification | unit | `node --import tsx/esm --test web/routes/drive-webhook.test.ts` | ❌ Wave 0 |
| SYNC-01 | Webhook route returns 404 for unknown channel ID | unit | `node --import tsx/esm --test web/routes/drive-webhook.test.ts` | ❌ Wave 0 |
| SYNC-03 | `getChannelsExpiringWithin24h()` returns channels where expiration < now + 86400000 | unit | `node --import tsx/esm --test web/lib/queries/drive.test.ts` | ❌ Wave 0 |
| SYNC-03 | Cron endpoint returns 401 without CRON_SECRET | unit | `node --import tsx/esm --test api/cron/renew-drive-channels.test.ts` | ❌ Wave 0 |
| SYNC-06 | Drive queries module exports are present (barrel smoke test) | unit | `node --import tsx/esm --test web/lib/queries/index.test.ts` | ✅ (needs new exports added) |

### Sampling Rate
- **Per task commit:** `node --import tsx/esm --test web/lib/queries/index.test.ts` (barrel smoke, ~1s)
- **Per wave merge:** `node --import tsx/esm --test "web/**/*.test.ts" "api/**/*.test.ts"`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `web/routes/drive-webhook.test.ts` — covers SYNC-01 webhook handler behaviour
- [ ] `web/lib/queries/drive.test.ts` — covers SYNC-03 expiry query logic
- [ ] `api/cron/renew-drive-channels.test.ts` — covers SYNC-03 cron auth and renewal logic
- [ ] `web/lib/queries/index.test.ts` — update to add Drive query exports to barrel smoke test (file exists, needs additions)

---

## Sources

### Primary (HIGH confidence)
- [Google Drive Push Notifications Guide](https://developers.google.com/workspace/drive/api/guides/push) — webhook registration, notification headers, channel expiry, stop/renew flow
- [changes.watch API Reference](https://developers.google.com/workspace/drive/api/reference/rest/v3/changes/watch) — request parameters, body fields, OAuth scopes
- [changes.getStartPageToken Reference](https://developers.google.com/workspace/drive/api/reference/rest/v3/changes/getStartPageToken) — pageToken never expires, initialisation flow
- [Vercel Cron Jobs Docs](https://vercel.com/docs/cron-jobs) — cron expression syntax, vercel.json format, CRON_SECRET pattern
- [Vercel Cron Jobs — Managing](https://vercel.com/docs/cron-jobs/manage-cron-jobs) — CRON_SECRET implementation, duration limits, concurrency, idempotency
- [Vercel Cron Jobs — Usage and Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) — Hobby: once/day; Pro: once/minute; 100 jobs/project on all plans

### Secondary (MEDIUM confidence)
- [Emptor: Demystifying the Google Drive Changes API](https://www.emptor.io/blog/demystifying-the-google-drive-changes-api) — changes.list() flow after notification receipt, nextPageToken vs newStartPageToken distinction (cross-verified with official docs)

### Tertiary (LOW confidence)
- None — all critical claims verified against official sources.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed; Drive API v3 is stable and well-documented
- Architecture: HIGH — patterns derived from official Google Drive Push Notifications guide and verified against actual project code
- Pitfalls: HIGH — domain verification, scope gaps, and pageToken persistence are documented Google requirements; Vercel cron plan restrictions confirmed from official pricing page

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (Google Drive API v3 is stable; Vercel pricing/cron limits change infrequently)
