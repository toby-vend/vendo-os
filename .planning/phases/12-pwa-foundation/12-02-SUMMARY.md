---
phase: 12-pwa-foundation
plan: "02"
subsystem: ui
tags: [pwa, install-prompt, settings, mobile, ios, android]

requires:
  - phase: 12-pwa-foundation (plan 01)
    provides: window._pwaInstallPrompt set via beforeinstallprompt listener in base.eta

provides:
  - Install App card in settings.eta with platform-aware install instructions
  - Android native install button wired to captured beforeinstallprompt event
  - iOS step-by-step Share > Add to Home Screen instructions
  - Standalone detection showing "App installed" confirmation for already-installed state
  - Generic fallback for desktop / Android without captured prompt

affects: [13-offline-caching, 14-push-notifications]

tech-stack:
  added: []
  patterns:
    - "Client-side platform detection via UA string + matchMedia display-mode: standalone"
    - "Deferred beforeinstallprompt pattern: prompt stored on window._pwaInstallPrompt, triggered on user click"

key-files:
  created: []
  modified:
    - web/views/settings.eta

key-decisions:
  - "All platform detection is client-side only — no SSR detection required"
  - "Install section permanently visible in Settings (never auto-dismissed)"

patterns-established:
  - "Pattern: Check standalone FIRST before platform UA, to avoid showing install UI to users who are already installed"
  - "Pattern: iOS branch shows text instructions only — beforeinstallprompt never fires on iOS Safari"

requirements-completed: [PWA-03]

duration: 2min
completed: 2026-04-06
---

# Phase 12 Plan 02: Install App Section Summary

**Settings page now shows platform-aware PWA install instructions: Android gets a native Add to Home Screen button, iOS gets step-by-step Safari Share instructions, and already-installed users see a green confirmation**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-06T20:33:00Z
- **Completed:** 2026-04-06T20:35:16Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Install App card appended to settings.eta after the Connected Accounts card
- Four distinct states handled: standalone (already installed), iOS Safari, Android with captured prompt, generic fallback
- Inline script detects platform client-side at render time with no server changes needed
- Plan verification check passes; install section wired to `window._pwaInstallPrompt` from Plan 01

## Task Commits

1. **Task 1: Add Install App section to settings.eta** - `0301e73` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `/Users/Toby_1/Vendo-OS/web/views/settings.eta` - Added Install App card with inline platform-detection script (45 lines)

## Decisions Made

None — followed plan as specified. Implementation matches Pattern 5 from RESEARCH.md exactly as documented in the plan.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in `scripts/` and `web/lib/` unrelated to this plan (missing `@types/sql.js`, implicit `any` in sync scripts). Out of scope per deviation rules — logged to deferred items, not fixed.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Install App section complete and linked to Plan 01's beforeinstallprompt capture
- Phase 12 (PWA Foundation) fully complete: manifest + service worker registration (Plan 01) + install UI (Plan 02)
- Ready for Phase 13: Offline Caching

---
*Phase: 12-pwa-foundation*
*Completed: 2026-04-06*

## Self-Check: PASSED

- FOUND: web/views/settings.eta
- FOUND: 12-02-SUMMARY.md
- FOUND: commit 0301e73
