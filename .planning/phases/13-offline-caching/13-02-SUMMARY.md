---
phase: 13-offline-caching
plan: "02"
subsystem: pwa
tags: [service-worker, workbox, offline, htmx, NetworkFirst, caching]

# Dependency graph
requires:
  - phase: 13-offline-caching-01
    provides: offline.html, offline-partial.html fallback files + Vary header
  - phase: 12-pwa-foundation
    provides: base sw.js with Workbox CDN import and CacheFirst static asset route
provides:
  - NetworkFirst page caching (vendo-pages-v1) with 7-day TTL
  - NetworkFirst HTMX partial caching (vendo-partials-v1) with 24h TTL
  - Precaching of offline fallback files at install time
  - HX-Request header routing to prevent cross-serving fallbacks
affects:
  - 14-push-notifications

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "NetworkFirst strategy with async try/catch handler for explicit fallback control"
    - "HX-Request header used in SW matcher to branch full-page vs partial routing"
    - "Manual caches.open().addAll() for precaching (no build tooling required)"

key-files:
  created: []
  modified:
    - public/sw.js

key-decisions:
  - "try/catch on NetworkFirst.handle() is required — it throws on both network and cache miss, not just network miss"
  - "Precaching via manual install event (not workbox.precaching.precacheAndRoute) — CDN-only Workbox has no manifest injection support"
  - "Partial route explicitly checks request.method === 'GET' for clarity, though Workbox only handles GET by default"

patterns-established:
  - "SW route order: static assets (CacheFirst) first, then navigations, then partials — specificity descending"
  - "Separate cache names per resource type (vendo-static-v1, vendo-pages-v1, vendo-partials-v1, vendo-precache-v1) for independent expiry control"

requirements-completed: [OFFL-01, OFFL-02, OFFL-03]

# Metrics
duration: 2min
completed: 2026-04-06
---

# Phase 13 Plan 02: Offline Caching Summary

**NetworkFirst caching for full-page navigations and HTMX partials with HX-Request-gated fallback routing to offline.html / offline-partial.html**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-06T21:57:00Z
- **Completed:** 2026-04-06T21:57:49Z
- **Tasks:** 2 of 2
- **Files modified:** 1

## Accomplishments

- Extended `public/sw.js` with install-time precaching of `/offline.html` and `/offline-partial.html` into `vendo-precache-v1`
- Added NetworkFirst page route: `request.mode === 'navigate'` AND `HX-Request !== 'true'`, 7-day TTL, falls back to `caches.match('/offline.html')`
- Added NetworkFirst partial route: `request.method === 'GET'` AND `HX-Request === 'true'`, 24h TTL, falls back to `caches.match('/offline-partial.html')`
- Phase 12 CacheFirst static asset route unchanged and registered first — route order preserved

## Task Commits

1. **Task 1: Extend sw.js with NetworkFirst routes and precaching** - `0a4ecd2` (feat)

## Files Created/Modified

- `/Users/Toby_1/Vendo-OS/public/sw.js` — Added Phase 13 install event, pageStrategy, partialStrategy, two new Workbox routes

## Decisions Made

- `try/catch` wraps `NetworkFirst.handle()` because the strategy throws when both network AND cache fail, not just on network error
- Manual `caches.open().addAll()` used for precaching because `workbox.precaching.precacheAndRoute` requires build-time manifest injection which is unavailable with CDN-only Workbox
- Explicit `request.method === 'GET'` check added to partial matcher for clarity even though Workbox only processes GET by default

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 13 complete — all offline caching scenarios verified end-to-end by user in Chrome DevTools offline simulation
- Phase 14 (Push Notifications) can begin: service worker infrastructure is in place, `web-push` is the only new dependency needed
- All three offline scenarios confirmed working: cached pages serve from cache, uncached pages show branded fallback, HTMX partials show inline snippet

---
*Phase: 13-offline-caching*
*Completed: 2026-04-06*
