---
phase: 13-offline-caching
plan: "01"
subsystem: infra
tags: [service-worker, pwa, htmx, fastify, offline, caching]

# Dependency graph
requires:
  - phase: 12-pwa-foundation
    provides: Service worker registration, static CacheFirst routes, public/ served by @fastify/static
provides:
  - Vary: HX-Request header on all Fastify HTTP responses
  - Branded full-page offline fallback at /offline.html
  - HTMX-safe inline offline snippet at /offline-partial.html
affects: [13-offline-caching plan 02, service worker precaching strategy]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Vary header injected via onSend hook ensures HTTP cache correctly keys on HX-Request presence
    - Offline partial is a bare div fragment (no doctype/html tags) safe to inject into any HTMX hx-swap target

key-files:
  created:
    - public/offline.html
    - public/offline-partial.html
  modified:
    - web/server.ts

key-decisions:
  - "Vary: HX-Request added inside existing onSend hook (not a new hook) to keep security header logic consolidated"
  - "Offline files use no external resources — system font stack and inline SVG avoid network dependencies when offline"

patterns-established:
  - "Pattern: Offline partial is a bare HTML fragment — no doctype, no html/body/head tags — safe for HTMX hx-swap injection"
  - "Pattern: Branded offline page references /assets/style.css which is pre-cached by Phase 12 CacheFirst route"

requirements-completed: [OFFL-04, OFFL-05]

# Metrics
duration: 1min
completed: 2026-04-06
---

# Phase 13 Plan 01: Vary Header and Offline Fallback Files Summary

**Vary: HX-Request header on all Fastify responses plus branded offline.html and HTMX-safe offline-partial.html, enabling correct HTTP cache keying and graceful offline degradation**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-04-06T21:54:36Z
- **Completed:** 2026-04-06T21:55:34Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- Added `Vary: HX-Request` header to the existing `onSend` hook in `web/server.ts` — one line addition, no new hooks
- Created `public/offline.html`: dark-themed (#0A0A0A) branded page with inline VendoOS "V" SVG logo, heading, message, and reload button
- Created `public/offline-partial.html`: bare div fragment with wifi-off SVG icon, `role="status"`, `aria-live="polite"`, inline styles — no doctype or html tags

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Vary header and create offline fallback files** - `2295704` (feat)

**Plan metadata:** (to be added after this commit)

## Files Created/Modified
- `web/server.ts` - Added `reply.header('Vary', 'HX-Request')` inside existing onSend security headers hook
- `public/offline.html` - Standalone branded offline page: dark theme, VendoOS green "V" logo, retry button, no external resources
- `public/offline-partial.html` - Minimal HTMX swap fragment: inline div with wifi-off SVG, role=status, aria-live=polite

## Decisions Made
- `Vary: HX-Request` header placed inside the existing `onSend` hook rather than a new hook — keeps all response header logic in one place
- No external resources in either offline file — system font stack (`'Manrope', system-ui, -apple-system, sans-serif`) and inline SVG ensure the pages render correctly with only cached assets

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in `scripts/` directory (sql.js type declarations, implicit any in daily-slack-brief.ts) — confirmed out of scope and not caused by this plan's changes. `web/server.ts` has zero TypeScript errors.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 02 (service worker NetworkFirst + precaching) can now proceed — it will precache both offline files and use `HX-Request` header presence to branch between full-page and partial offline responses
- Research flag from STATE.md still applies: verify `HX-Request: true` is present on all `hx-get`/`hx-post` calls in the actual templates before relying on it for SW strategy branching

---
*Phase: 13-offline-caching*
*Completed: 2026-04-06*
