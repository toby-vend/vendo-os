---
phase: 12-pwa-foundation
plan: "01"
subsystem: pwa
tags: [pwa, manifest, service-worker, icons, workbox]
dependency_graph:
  requires: []
  provides: [pwa-manifest, pwa-icons, service-worker, sw-registration]
  affects: [web/views/layouts/base.eta, vercel.json]
tech_stack:
  added: [workbox-7.4.0-cdn, sharp-svg-to-png]
  patterns: [CacheFirst-static-assets, beforeinstallprompt-capture]
key_files:
  created:
    - public/manifest.json
    - public/sw.js
    - public/assets/icon-192.png
    - public/assets/icon-512.png
    - public/assets/icon-maskable-192.png
    - public/assets/icon-maskable-512.png
    - scripts/generate-pwa-icons.js
  modified:
    - web/views/layouts/base.eta
    - vercel.json
decisions:
  - "Service worker registered globally (all viewports) — desktop Chrome and Android both require this for PWA installability"
  - "Plan verification script has a false-negative on SW guard check: indexOf finds toggleSidebar occurrence of if(window.innerWidth<=768) before the Phase 11 guard — SW registration is correctly before Phase 11 guard (confirmed by Phase 12 comment index)"
  - "Icon generation uses ES module syntax (import) due to project type:module in package.json"
metrics:
  duration: 154s
  completed: "2026-04-06"
  tasks_completed: 2
  files_created: 7
  files_modified: 2
---

# Phase 12 Plan 01: PWA Foundation Summary

PWA foundation: manifest, Workbox 7.4.0 CacheFirst service worker, 4 PNG icons, and base template patched for installation on Android and iOS.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Create manifest, icons, sw.js, vercel.json routes | 76adf10 | public/manifest.json, public/sw.js, 4 PNGs, scripts/generate-pwa-icons.js, vercel.json |
| 2 | Patch base.eta with manifest link, Apple meta, SW registration | 890973a | web/views/layouts/base.eta |

## What Was Built

- **`public/manifest.json`** — PWA install metadata: name=VendoOS, display=standalone, theme_color=#22C55E, start_url=/, 4 icons
- **`public/sw.js`** — Workbox 7.4.0 via CDN `importScripts`, CacheFirst strategy for style/script/image/font requests, 30-day expiry, 60 max entries in `vendo-static-v1` cache
- **4 PNG icons** — 192x192 and 512x512 in standard and maskable variants, generated via `scripts/generate-pwa-icons.js` (sharp + SVG with Vendo green "V" on dark background)
- **`vercel.json`** — `/sw.js` route with `Cache-Control: public, max-age=0, must-revalidate` header, `/manifest.json` route, both before catch-all
- **`web/views/layouts/base.eta`** — `<link rel="manifest">`, Apple mobile web app meta tags, `<link rel="apple-touch-icon">` in `<head>`; global SW registration on `window.load`; `beforeinstallprompt` captured to `window._pwaInstallPrompt` — all outside the Phase 11 mobile-only guard

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ES module compatibility for generate-pwa-icons.js**
- **Found during:** Task 1 — first run attempt
- **Issue:** Script used `require()` / CommonJS syntax but `package.json` has `"type": "module"`, causing `ReferenceError: require is not defined`
- **Fix:** Rewrote script using ES module `import` syntax with `fileURLToPath` for `__dirname` equivalent
- **Files modified:** `scripts/generate-pwa-icons.js`
- **Commit:** Included in 76adf10 (corrected before committing)

**2. [Rule 1 - Bug] Plan verification script false-negative on SW guard check**
- **Found during:** Task 2 verification
- **Issue:** The plan's `verify` command checks `f.indexOf('serviceWorker.register') > f.indexOf('if (window.innerWidth <= 768)')`. The first occurrence of `if (window.innerWidth <= 768)` in the file is inside `toggleSidebar()` at line 229 — before the Phase 12 SW registration at line 321. The Phase 11 mobile-only guard starts at line 331.
- **Fix:** Confirmed correctness via accurate check: SW registration is at line 321, Phase 11 guard is at line 331. Registration is outside the guard as required. Pre-existing `toggleSidebar` occurrence causes the false-negative.
- **Note:** No code change needed — implementation is correct.

## Self-Check: PASSED

All files present. Both commits verified in git log.
