---
phase: 02-drive-webhook-foundation
plan: "01"
subsystem: drive-sync
tags: [google-drive, webhook, queries, tdd]
dependency_graph:
  requires: [web/lib/queries/base.ts, web/lib/google-tokens.ts, web/lib/queries/auth.ts]
  provides: [web/lib/queries/drive.ts, web/lib/drive-sync.ts, web/routes/drive-webhook.ts]
  affects: [web/lib/queries/index.ts, web/lib/queries/auth.ts, web/server.ts, scripts/utils/db.ts]
tech_stack:
  added: []
  patterns: [TDD with node:test + mock.module, Fastify plugin injection, ON CONFLICT upsert]
key_files:
  created:
    - web/lib/queries/drive.ts
    - web/lib/drive-sync.ts
    - web/routes/drive-webhook.ts
    - web/routes/drive-webhook.test.ts
  modified:
    - web/lib/queries/index.ts
    - web/lib/queries/auth.ts
    - web/server.ts
    - scripts/utils/db.ts
decisions:
  - "Used --experimental-test-module-mocks flag (Node 25) for drive-webhook tests — mock.module requires it"
  - "Webhook route exempted from session auth hook via path check in onRequest — Google POSTs are unauthenticated"
  - "drive_sync_queue partial index (WHERE processed_at IS NULL) used in Turso path; sql.js gets unconditional index (no partial index support)"
  - "upsertDriveWatchChannel sets renewed_at on conflict updates, not on initial insert"
metrics:
  duration: "~4 minutes"
  completed_date: "2026-04-01"
  tasks_completed: 2
  files_changed: 8
---

# Phase 2 Plan 1: Drive Webhook Foundation Summary

Drive query module, webhook endpoint, and channel registration using Google Drive Changes API push notifications with DB-first pageToken persistence.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Drive queries module + drive_sync_queue schema | ce1fedb |
| 2 | Webhook route + channel registration module | 3ee46fb |

## What Was Built

### Task 1: Drive Queries Module

`web/lib/queries/drive.ts` — 7 query functions over two tables:

**drive_watch_channels:** `getDriveWatchChannel`, `upsertDriveWatchChannel`, `getChannelsExpiringWithin24h`, `getAllDriveWatchChannels`, `deleteDriveWatchChannel`

**drive_sync_queue:** `insertDriveSyncQueueItem`, `getUnprocessedSyncQueueItems`

Schema additions:
- `drive_sync_queue` table DDL added to `initSchema()` in `web/lib/queries/auth.ts` with partial index `idx_dsq_unprocessed`
- `user_id TEXT` column migration added to `drive_watch_channels` via try/catch ALTER TABLE in both Turso (`auth.ts`) and sql.js (`scripts/utils/db.ts`) paths
- All functions exported from barrel (`web/lib/queries/index.ts`)

### Task 2: Webhook Route + Channel Registration

`web/routes/drive-webhook.ts` — `POST /api/drive/webhook` Fastify plugin:
- Validates `x-goog-channel-token` against `DRIVE_WEBHOOK_SECRET` → 403 if mismatch
- Returns 200 immediately for `resource-state: sync` (initial registration ack, no queue write)
- Looks up channel via `getDriveWatchChannel` → 404 if unknown
- Writes `drive_sync_queue` row via `insertDriveSyncQueueItem` for valid change notifications

`web/lib/drive-sync.ts` — Three exported functions:
- `registerWatchChannel(userId, webhookUrl)` — checks scopes, gets startPageToken, calls changes.watch, **persists to DB before returning**
- `stopWatchChannel(channelId, resourceId, userId)` — best-effort stop + DB delete
- `renewChannel(channel)` — stop old → register new, resolves userId from channel.user_id or DRIVE_ADMIN_USER_ID

`web/server.ts` — Route registered at `/api/drive` prefix, webhook path added to public routes list in `onRequest` hook so Google's unauthenticated POSTs are not rejected.

## Test Results

```
POST /api/drive/webhook (5 tests — all pass)
  ✔ returns 403 when x-goog-channel-token is missing
  ✔ returns 403 when x-goog-channel-token is wrong
  ✔ returns 200 for resource-state "sync" without writing a queue row
  ✔ returns 404 when channel ID is not found in drive_watch_channels
  ✔ returns 200 and writes a queue row for a valid change notification

queries barrel smoke test (11 tests — all pass)
  ✔ drive functions are exported (7 functions)
```

TypeScript: clean (zero web/ errors).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Test type narrowing for queue row assertion**
- **Found during:** Task 2, TypeScript check
- **Issue:** TypeScript inferred `written: never` when using `T | null` pattern with assignment in callback — property access caused TS2339 errors
- **Fix:** Changed to array collector pattern (`writtenItems.push(data)`) which TypeScript narrows correctly
- **Files modified:** web/routes/drive-webhook.test.ts
- **Commit:** 3ee46fb (included in task commit)

**2. [Rule 3 - Blocking] node:test mock.module requires experimental flag**
- **Found during:** Task 2, RED phase
- **Issue:** `mock.module` is not a function without `--experimental-test-module-mocks` flag in Node 25
- **Fix:** Added flag to test run command; tests pass with the experimental warning
- **Files modified:** none (test infrastructure, flag only)

**3. [Rule 2 - Missing Critical] drive_sync_queue partial index incompatibility with sql.js**
- **Found during:** Task 1, schema dual-path review
- **Issue:** `CREATE INDEX ... WHERE processed_at IS NULL` (partial index) is not supported in sql.js
- **Fix:** Turso path uses partial index; sql.js path uses unconditional index on the same column
- **Files modified:** scripts/utils/db.ts

## Self-Check: PASSED

- FOUND: web/lib/queries/drive.ts
- FOUND: web/lib/drive-sync.ts
- FOUND: web/routes/drive-webhook.ts
- FOUND: web/routes/drive-webhook.test.ts
- FOUND: commit ce1fedb (Task 1)
- FOUND: commit 3ee46fb (Task 2)
