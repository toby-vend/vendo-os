---
phase: 14-push-notifications
plan: "02"
subsystem: push-notifications
tags: [push, service-worker, task-matcher, notifications]
dependency_graph:
  requires: [push-subscriptions-db, push-sender, push-api-routes]
  provides: [push-triggers, sw-push-handler, sw-notificationclick-handler]
  affects: [web/lib/task-matcher.ts, public/sw.js]
tech_stack:
  added: []
  patterns: [fire-and-forget-push, promise-chain-notification, sw-push-handler]
key_files:
  created: []
  modified:
    - web/lib/task-matcher.ts
    - public/sw.js
decisions:
  - "getTaskRun used to resolve created_by email within generateDraft — avoids threading email through function signature"
  - "scalar used in assembleContext failed paths to resolve client_name from brand_hub inline"
  - "All push sends are fire-and-forget — .then/.catch chains, never awaited, never block main flow"
  - "QA check error push fires after updateTaskRunStatus('failed') — clientName already in scope"
metrics:
  duration: 95s
  completed: "2026-04-07"
  tasks_completed: 2
  files_changed: 2
---

# Phase 14 Plan 02: Push Notification Triggers Summary

Push notification triggers wired into task execution flow using `sendPushToUserByEmail` — draft_ready and failed transitions fire push notifications to the AM's subscribed devices; service worker displays them and handles tap-to-navigate.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Hook push notifications into task-matcher.ts | 9631dfc | web/lib/task-matcher.ts |
| 2 | Service worker push and notificationclick handlers | 4a8a575 | public/sw.js |

## What Was Built

**web/lib/task-matcher.ts** — push sends added at all transition points:

- `draft_ready` (SOP pass): fires after `updateTaskRunOutput` in `generateDraft` — uses `clientName` already in scope, resolves `created_by` via `getTaskRun`
- `draft_ready` (exhausted retries): same pattern — fires after second `updateTaskRunOutput`
- `failed` (QA error): fires after `updateTaskRunStatus('failed')` in the `catch (qaErr)` block — `clientName` and `taskType` in scope
- `failed` (skills gap): fires in `assembleContext` — uses `Promise.all([getTaskRun, scalar client_name])` since `brandFiles` not yet populated
- `failed` (token limit exceeded): same `Promise.all` pattern in `assembleContext`
- `failed` (generation error catch): same `Promise.all` pattern in `assembleContext` catch block

All sends are fire-and-forget `.then()/.catch()` chains — never awaited, never block request/response or task flow.

Notification titles and bodies per locked decisions:
- Draft ready: title `"Draft Ready"`, body `"{task_type} — {client_name}"`
- Task failed: title `"Task Failed"`, body `"{task_type} — {client_name} failed QA: {reason}"`

Reasons by failure type: QA check error / No matching SOPs found / Generation failed.

**public/sw.js** — two event listeners appended after existing Workbox caching code:

- `push` handler: calls `self.registration.showNotification` with title, body, `icon: '/assets/icon-192.png'`, and `data.url` stored in notification data
- `notificationclick` handler: closes notification, navigates an existing open window (or opens a new one) to the task URL from `event.notification.data.url`

## Verification

- `npx tsc --noEmit`: only pre-existing errors in unrelated scripts/ files — zero new errors
- `public/sw.js` contains `addEventListener('push'`: 1 match
- `public/sw.js` contains `notificationclick`: 1 match
- `web/lib/task-matcher.ts` imports `sendPushToUserByEmail` and `getTaskRun`
- No push calls on `queued`, `generating`, or `qa_check` transitions

## Deviations from Plan

None — plan executed exactly as written.

The plan specified using `getTaskRun` to resolve `created_by` within `generateDraft` (where `clientName` is already in scope), and `scalar` for client name in `assembleContext` early-exit paths. Both implemented exactly as specified.

## Self-Check: PASSED

Files exist:
- web/lib/task-matcher.ts: FOUND
- public/sw.js: FOUND

Commits exist:
- 9631dfc: FOUND
- 4a8a575: FOUND
