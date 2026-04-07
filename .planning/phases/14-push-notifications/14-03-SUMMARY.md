---
phase: 14-push-notifications
plan: "03"
subsystem: push-notifications
tags: [push, pwa, toast, settings, ios, client-side]
dependency_graph:
  requires: [push-subscriptions-db, push-api-routes]
  provides: [push-toast-banner, push-settings-section]
  affects: [web/views/layouts/base.eta, web/views/settings.eta, public/assets/style.css]
tech_stack:
  added: []
  patterns: [localStorage-dismiss-counter, serviceWorker-ready-await, Notification-requestPermission-promise]
key_files:
  created: []
  modified:
    - web/views/layouts/base.eta
    - web/views/settings.eta
    - public/assets/style.css
decisions:
  - "Toast triggered by draft_ready badge detection on DOM and HTMX afterSwap — avoids server-side changes to task response HTML"
  - "Dismiss-twice flag uses two localStorage keys: push-toast-dismiss-count (count) and push-toast-dismissed (lock)"
  - "Settings push section renders entirely client-side from serviceWorker.ready — no SSR needed"
  - "Disable calls sub.unsubscribe() then DELETE /api/push/subscribe — both browser and server cleanup"
metrics:
  duration: 115s
  completed: "2026-04-07"
  tasks_completed: 1
  files_changed: 3
---

# Phase 14 Plan 03: Push Notification Client UX Summary

Push notification client-side UX: toast banner for permission prompting after task completion, Settings page push management section with enable/disable/test controls, iOS standalone mode gating, and dismiss-twice localStorage logic.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Toast banner, Settings push section, iOS gating | a60482c | web/views/layouts/base.eta, web/views/settings.eta, public/assets/style.css |

## Awaiting Human Verification

Task 2 is a `checkpoint:human-verify` — execution paused for end-to-end testing on a real device.

## What Was Built

**public/assets/style.css** — Push toast banner styles appended:
- `.push-toast`: fixed top bar, dark background (#1E293B), slide-in animation
- `@keyframes push-toast-slide-in`: `translateY(-100%)` → `translateY(0)` over 0.3s
- `.push-toast-btn`: green (#22C55E) action button
- `.push-toast-close`: neutral close button

**web/views/layouts/base.eta** — Phase 14 toast banner script block added after SW registration:
- Helper functions: `urlBase64ToUint8Array`, `isPushIOS`, `isPushStandalone`
- `shouldShowToast()`: checks SW/PushManager support, Notification.permission !== 'granted', dismiss lock
- `buildToastHTML()`: three content variants — iOS no-standalone (install link), denied (informational), normal (enable button)
- `showToast()`: injects banner into body, wires close button (dismiss counter), enable button (requestPermission → VAPID fetch → subscribe POST)
- Three triggers: `DOMContentLoaded` on `/tasks/*` pages with draft_ready badge, `htmx:afterSwap` with draft_ready content, `vendoos:task-completed` custom event

**web/views/settings.eta** — Push Notifications section added below Install App section:
- Card with `id="push-notifications-section"` and `id="push-content"` placeholder
- Inline script with full client-side render flow:
  - No SW/PushManager → "not supported" message
  - iOS without standalone → install instructions with link
  - Permission denied → informational text only
  - Subscribed: green "Enabled" label, device count, Send Test + Disable buttons
  - Not subscribed: grey "Disabled" label, device count, Enable button
- Enable flow: `Notification.requestPermission()` → VAPID key fetch → `pushManager.subscribe()` → `POST /api/push/subscribe` → re-render
- Disable flow: `sub.unsubscribe()` → `DELETE /api/push/subscribe` → re-render
- Test flow: `POST /api/push/test` → "Test sent!" confirmation with 2s reset

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files exist:
- web/views/layouts/base.eta: FOUND
- web/views/settings.eta: FOUND
- public/assets/style.css: FOUND

Commits exist:
- a60482c: FOUND (verified via git log above)
