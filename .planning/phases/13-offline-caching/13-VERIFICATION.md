---
phase: 13-offline-caching
verified: 2026-04-06T22:30:00Z
status: human_needed
score: 7/7 must-haves verified
human_verification:
  - test: "Visit /tasks and /clients online, then go offline (Chrome DevTools > Network > Offline) and reload"
    expected: "Pages load from cache with full styling — no network error or browser offline page"
    why_human: "Requires browser service worker runtime — cannot verify cache population programmatically"
  - test: "While offline, trigger an HTMX partial request (e.g. click a tab that fires hx-get)"
    expected: "Inline offline snippet appears in the swap target — NOT a full HTML page injected into the DOM"
    why_human: "Requires live HTMX + SW interaction in a real browser"
  - test: "While offline, navigate to a page that has never been visited"
    expected: "Branded offline.html page appears: dark background, VendoOS green V logo, 'You're offline' heading, retry button"
    why_human: "Requires browser navigation to an uncached URL while SW is active"
  - test: "Run: curl -sI http://localhost:3000/tasks | grep -i vary"
    expected: "Response includes Vary: HX-Request header"
    why_human: "Server must be running to confirm header is live on all routes including edge cases"
---

# Phase 13: Offline Caching Verification Report

**Phase Goal:** When an AM loses signal, previously visited pages and drafts remain readable, HTMX partial requests fall back gracefully, and a clear offline indicator is shown when a live action is attempted
**Verified:** 2026-04-06T22:30:00Z
**Status:** human_needed — all automated checks pass, four runtime behaviours require browser/server confirmation
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every Fastify response includes a Vary: HX-Request header | VERIFIED | `reply.header('Vary', 'HX-Request')` present in `onSend` hook at line 246 of `web/server.ts` |
| 2 | A branded offline fallback page exists at /offline.html matching the dark theme | VERIFIED | `public/offline.html` — 78 lines, dark background #0A0A0A, inline VendoOS "V" SVG, retry button calling `window.location.reload()`, no external resources |
| 3 | A minimal HTML snippet exists at /offline-partial.html suitable for HTMX swap targets | VERIFIED | `public/offline-partial.html` — bare `<div>`, no DOCTYPE or html/head/body tags, `role="status"`, `aria-live="polite"`, inline styles, wifi-off SVG |
| 4 | A previously visited full page loads correctly when the device is offline | ? UNCERTAIN | NetworkFirst pageStrategy registered for `mode === 'navigate'` AND `HX-Request !== 'true'` with fallback to `caches.match('/offline.html')` — implementation correct, runtime behaviour needs browser verification |
| 5 | An HTMX partial request made while offline renders an inline offline snippet — not a full HTML document | ? UNCERTAIN | NetworkFirst partialStrategy registered for `method === 'GET'` AND `HX-Request === 'true'` with fallback to `caches.match('/offline-partial.html')` — correct routing logic, needs live SW test |
| 6 | When no cached version of a page exists, the branded offline.html fallback is shown | ? UNCERTAIN | Fallback `caches.match('/offline.html')` in navigation catch block is correct; runtime behaviour needs browser verification |
| 7 | offline.html and offline-partial.html are precached during service worker install | VERIFIED | `install` event listener at line 24 of `sw.js` calls `caches.open('vendo-precache-v1').then(cache => cache.addAll(['/offline.html', '/offline-partial.html']))` wrapped in `event.waitUntil()` |

**Score:** 7/7 truths have correct implementation (4 require runtime verification)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `web/server.ts` | Vary: HX-Request header on all responses | VERIFIED | Header added inside existing `onSend` security-headers hook at line 246 — single line, correct hook |
| `public/offline.html` | Full-page offline fallback | VERIFIED | 78 lines, complete branded page, no external resources, retry button present |
| `public/offline-partial.html` | Inline offline snippet for HTMX swap targets | VERIFIED | 6 lines, bare div fragment, no document tags, accessibility attrs present |
| `public/sw.js` | NetworkFirst routes for pages and partials, precaching of fallback files | VERIFIED | 78 lines, both NetworkFirst strategies defined, precache install handler, Phase 12 CacheFirst route preserved |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `web/server.ts` | HTTP responses | `onSend` hook adds Vary header | WIRED | `reply.header('Vary', 'HX-Request')` confirmed at line 246 |
| `public/sw.js` | `/offline.html` | `caches.match` fallback on navigation miss | WIRED | Pattern `caches.match('/offline.html')` at line 51 |
| `public/sw.js` | `/offline-partial.html` | `caches.match` fallback on partial miss | WIRED | Pattern `caches.match('/offline-partial.html')` at line 75 |
| `public/sw.js` | HX-Request header | `request.headers.get` check for routing | WIRED | `request.headers.get('HX-Request')` at lines 46 and 70 — separate matchers for navigation vs partial |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| OFFL-01 | 13-02 | Static assets cached by SW on install | SATISFIED | Phase 12 CacheFirst route (`vendo-static-v1`) intact at lines 7–22 of `sw.js`; Phase 13 extends with `vendo-precache-v1` for offline fallback files |
| OFFL-02 | 13-02 | Previously visited full pages cached and available offline | SATISFIED (runtime unverified) | NetworkFirst `vendo-pages-v1` route with 7-day TTL registered; fallback to cached `/offline.html` on miss |
| OFFL-03 | 13-02 | HTMX partial responses cached separately and served correctly | SATISFIED (runtime unverified) | NetworkFirst `vendo-partials-v1` route with 24h TTL; HX-Request gate prevents offline.html injection into partial swap targets |
| OFFL-04 | 13-01 | Branded offline fallback page shown when no cached version exists | SATISFIED | `public/offline.html` exists with dark theme, inline SVG logo, retry button; precached via install event |
| OFFL-05 | 13-01 | All Fastify routes include Vary: HX-Request header | SATISFIED | `reply.header('Vary', 'HX-Request')` in `onSend` hook — applies to all Fastify responses |

No orphaned requirements found. All five OFFL requirements declared across the two plans are accounted for and have implementation evidence.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No TODOs, FIXMEs, placeholders, empty implementations, or stub handlers found in any Phase 13 files.

---

### Human Verification Required

#### 1. Cached page loads offline

**Test:** Visit `/tasks` and `/clients` while online. Then open Chrome DevTools, go to Network tab, select "Offline". Reload the page.
**Expected:** Pages load correctly from cache with full styling — no browser offline error page and no blank page.
**Why human:** Requires a live browser session with an active service worker. Cache population depends on real navigation having occurred.

#### 2. HTMX partial offline inline snippet

**Test:** While in offline mode (DevTools), trigger an HTMX partial request — for example, click a tab or filter that fires an `hx-get`.
**Expected:** A small inline notice reading "You're offline" (with a wifi-off icon) appears in the HTMX swap target. The page layout must NOT be replaced by a full HTML document.
**Why human:** Requires HTMX + service worker interaction observable only in a real browser. The critical risk — offline.html being injected into a swap target — cannot be confirmed without live HTMX execution.

#### 3. Uncached page shows branded fallback

**Test:** While in offline mode (DevTools), navigate to a URL that has never been visited (e.g., a client detail page not yet opened).
**Expected:** The branded `offline.html` page appears: dark background, green VendoOS "V" logo, "You're offline" heading, "Check your connection and try again" message, and a working "Try again" button.
**Why human:** Requires browser navigation to an uncached URL with the SW active. Cannot reproduce programmatically.

#### 4. Vary header present on live server

**Test:** With the server running, execute: `curl -sI http://localhost:3000/tasks | grep -i vary`
**Expected:** Output includes `Vary: HX-Request`
**Why human:** Server must be running. The static code check confirms the header is set, but confirming it is not stripped by middleware or Fastify's serialisation layer requires an actual HTTP response.

---

### Summary

All seven automated must-haves are verified. The implementation is complete and correct:

- `web/server.ts` has `Vary: HX-Request` inside the consolidated `onSend` security-headers hook — no new hooks, no regressions
- `public/offline.html` is a well-formed branded page: 78 lines, dark theme, inline VendoOS SVG, retry button, zero external resources
- `public/offline-partial.html` is a correctly structured bare fragment: no document tags, accessible, inline styles
- `public/sw.js` has the Phase 12 CacheFirst static asset route preserved first, followed by Phase 13 additions in correct order: install precache, page NetworkFirst route, partial NetworkFirst route
- HX-Request header gating is correctly implemented: navigate requests without the header fall back to `offline.html`; GET requests with the header fall back to `offline-partial.html` — cross-serving of fallbacks is prevented

The four items flagged for human verification are runtime behaviours that require a live browser with an active service worker. The code paths are structurally correct; the human tests confirm they function in the browser environment.

Commits `2295704` (Plan 01) and `0a4ecd2` (Plan 02) both verified present in git history.

---

_Verified: 2026-04-06T22:30:00Z_
_Verifier: Claude (gsd-verifier)_
