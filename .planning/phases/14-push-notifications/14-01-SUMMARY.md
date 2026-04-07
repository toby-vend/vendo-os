---
phase: 14-push-notifications
plan: "01"
subsystem: push-notifications
tags: [push, vapid, web-push, fastify, sqlite]
dependency_graph:
  requires: []
  provides: [push-subscriptions-db, push-sender, push-api-routes]
  affects: [web/server.ts, web/lib/queries/auth.ts]
tech_stack:
  added: [web-push@3.6.7, "@types/web-push"]
  patterns: [fastify-plugin-async, promise-allsettled-fan-out, insert-or-replace-on-conflict]
key_files:
  created:
    - scripts/generate-vapid-keys.ts
    - web/lib/queries/push-subscriptions.ts
    - web/lib/push-sender.ts
    - web/routes/push.ts
  modified:
    - web/lib/queries/auth.ts
    - web/server.ts
    - package.json
    - package-lock.json
decisions:
  - "UNIQUE constraint on push_subscriptions.endpoint (not user_id) — one row per device, multiple per user (locked decision from research)"
  - "Promise.allSettled for fan-out sends — one failing device must not abort others"
  - "On-send 410/404 pruning — dead subscriptions removed at send time, not by a scheduled job"
  - "initVapid() guards against missing env vars with console.warn — does not crash server"
  - "sendPushToUserByEmail added because task_runs.created_by stores email, not user_id"
metrics:
  duration: 152s
  completed: "2026-04-07"
  tasks_completed: 2
  files_changed: 8
---

# Phase 14 Plan 01: Push Notification Backend Summary

Push notification backend infrastructure using `web-push` 3.6.7 and VAPID — VAPID key generation script, push_subscriptions table, subscription CRUD, push-sender module with dead subscription pruning, and Fastify API routes.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | VAPID key script, push_subscriptions table, subscription queries | dffdcfc | scripts/generate-vapid-keys.ts, web/lib/queries/push-subscriptions.ts, web/lib/queries/auth.ts |
| 2 | Push sender module, API routes, server registration | f8fc184 | web/lib/push-sender.ts, web/routes/push.ts, web/server.ts |

## What Was Built

**scripts/generate-vapid-keys.ts** — one-time utility that calls `webpush.generateVAPIDKeys()` and prints VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY in copy-paste format with Vercel setup instructions.

**push_subscriptions table** — added to `initSchema()` in auth.ts. Schema: `id`, `user_id` (FK → users ON DELETE CASCADE), `endpoint` (UNIQUE), `p256dh`, `auth`, `created_at`. Indexed on `user_id`.

**web/lib/queries/push-subscriptions.ts** — four exported functions:
- `upsertPushSubscription` — INSERT OR REPLACE via ON CONFLICT(endpoint)
- `deleteSubscriptionByEndpoint` — used by unsubscribe route and 410 pruning
- `getSubscriptionsByUserId` — returns `{ endpoint, p256dh, auth }[]`
- `countSubscriptionsByUserId` — returns subscription count as number

**web/lib/push-sender.ts** — three exports:
- `initVapid()` — sets VAPID details once at startup; console.warns and returns early if env vars absent
- `sendPushToUser(userId, payload)` — fans out to all devices via Promise.allSettled; auto-prunes 410/404 subscriptions
- `sendPushToUserByEmail(email, payload)` — resolves email → userId via getUserByEmail, then delegates to sendPushToUser

**web/routes/push.ts** — five routes registered at `/api/push/*`:
- `POST /subscribe` — upserts subscription for authenticated user, returns 201
- `DELETE /subscribe` — removes subscription by endpoint, returns 200
- `POST /test` — sends test push to authenticated user, returns 200
- `GET /vapid-public-key` — returns `{ key: VAPID_PUBLIC_KEY }` (no auth required)
- `GET /subscription-count` — returns `{ count }` for authenticated user

**web/server.ts** — `initVapid()` called at startup; `pushRoutes` registered at `/api/push`. CSRF is already skipped for all `/api/` routes.

## Verification

- VAPID script prints valid keys: PASS
- push_subscriptions table in initSchema: PASS
- pushRoutes registered at /api/push in server.ts: PASS
- initVapid() called at startup: PASS
- 410 pruning in push-sender: PASS
- TypeScript: zero errors in new files (pre-existing errors in unrelated files are out of scope)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] web-push installed during Task 1 verification**
- **Found during:** Task 1 verification (npx tsx scripts/generate-vapid-keys.ts)
- **Issue:** web-push was not yet installed when Task 1's verify step ran — ERR_MODULE_NOT_FOUND
- **Fix:** Installed web-push@3.6.7 and @types/web-push (these were already planned for Task 2 step 1) as part of Task 1 execution
- **Files modified:** package.json, package-lock.json
- **Commit:** dffdcfc (included in Task 1 commit)

## Self-Check: PASSED

Files exist:
- scripts/generate-vapid-keys.ts: FOUND
- web/lib/queries/push-subscriptions.ts: FOUND
- web/lib/push-sender.ts: FOUND
- web/routes/push.ts: FOUND

Commits exist:
- dffdcfc: FOUND
- f8fc184: FOUND
