# Phase 13: Offline Caching - Research

**Researched:** 2026-04-06
**Domain:** Service Worker offline caching strategy with HTMX partial disambiguation on Workbox 7.4.0
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- All visited full pages cached with NetworkFirst (Workbox) — show cached version when offline, always try network first when online
- HTMX partial requests (HX-Request: true) cached separately from full-page responses
- Service worker checks `request.headers.get('HX-Request')` to branch caching logic
- Static assets remain CacheFirst from Phase 12 — no change needed
- All Fastify routes must include `Vary: HX-Request` in response headers, implemented as a global Fastify `onSend` hook — not per-route
- When offline and a partial request has no cache hit: serve a small HTML snippet (not the full offline page)
- Full-page navigations that miss cache: serve the branded offline fallback page
- Offline fallback page: `public/offline.html`, precached on install, matches existing dark theme, includes VendoOS logo, "You're offline" message, retry button
- All visited pages cached automatically by NetworkFirst — no selective caching
- No Background Sync

### Claude's Discretion
- Offline fallback page visual design (within existing dark theme)
- Retry button behaviour (reload vs ping-then-redirect)
- Offline partial snippet content and styling
- Cache name conventions and expiry durations
- Whether to show an "offline" indicator in the topbar when connection drops
- Service worker update/activation strategy (skipWaiting already set in Phase 12)

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| OFFL-01 | Static assets (CSS, JS, icons, fonts) are cached by the service worker on install | Phase 12 already delivers CacheFirst for static assets. Phase 13 only needs to verify precache list includes `offline.html` on install. |
| OFFL-02 | Previously visited full pages are cached and available offline | Workbox `NetworkFirst` with `workbox.routing.registerRoute` and navigation request matcher; confirmed against Workbox 7.4.0 docs. |
| OFFL-03 | HTMX partial responses are cached separately and served correctly (not as full pages) | `request.headers.get('HX-Request')` discriminator in the fetch event handler; separate cache name for partials; `offline-partial.html` fallback when miss. |
| OFFL-04 | A branded offline fallback page is shown when no cached version exists | `public/offline.html` precached during SW install; served by the SW fetch handler on full-page navigation miss. |
| OFFL-05 | All Fastify routes include `Vary: HX-Request` header to enable correct SW caching | Single `addHook('onSend', ...)` call added to the existing security headers hook in `web/server.ts` line 228. |
</phase_requirements>

---

## Summary

Phase 13 extends the existing Phase 12 service worker (`public/sw.js`) with three additions: (1) a `NetworkFirst` Workbox route for full-page navigations that falls back to a precached `offline.html`, (2) a separate `NetworkFirst` route for HTMX partial requests (identified by `HX-Request: true` header) that falls back to a small `offline-partial.html` snippet, and (3) a global `Vary: HX-Request` header added via Fastify's existing `onSend` hook. No new npm packages are required. No changes to `vercel.json` are needed — the no-cache rule for `/sw.js` is already in place.

The codebase audit confirms: HTMX 2.0.4 is in use (`base.eta` line 16); it sends `HX-Request: true` on all `hx-get` and `hx-post` requests automatically — this behaviour is part of the HTMX specification and is not suppressed anywhere in `base.eta`. There are 76 HTMX partial request usages across templates and 11 routes that use `hx-push-url`. Every `hx-push-url` route must have a corresponding full-page server response, which they do (the Fastify routes render full Eta templates for full-page GETs).

The single highest-risk item is the HTMX partial disambiguation: if the service worker ever serves `offline.html` (a full `<html>` document) in response to an HTMX swap request, the entire HTML document is injected into the swap target, corrupting the page. The implementation guard is a header check before strategy selection.

**Primary recommendation:** Write the `sw.js` fetch handler to check `HX-Request` header first, before routing by URL pattern. Precache `offline.html` and `offline-partial.html` explicitly during the install event.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Workbox (CDN) | 7.4.0 (already pinned) | NetworkFirst strategy, ExpirationPlugin, precaching | Already in sw.js; CDN import avoids bundler; pinned URL prevents silent updates |
| Fastify addHook | (built-in) | `Vary: HX-Request` global header | Already used for security headers in server.ts line 228; same pattern, one line add |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| workbox.strategies.NetworkFirst | 7.4.0 | Full-page + HTMX partial caching strategy | All dynamic routes that have session-dependent content |
| workbox.expiration.ExpirationPlugin | 7.4.0 | TTL + maxEntries on page caches | Prevent unbounded cache growth on pages cache |
| workbox.precaching (manual) | N/A | Precache offline.html + offline-partial.html at install | Guarantees fallback files survive regardless of navigation history |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Workbox NetworkFirst | Custom fetch handler with Cache API | Workbox handles cache versioning, cleanup, and expiry — custom code recreates this at cost |
| Global Vary header via onSend hook | Per-route header | Per-route misses new routes; global hook is consistent and already used for security headers |
| offline-partial.html snippet | JSON error response | HTML snippet integrates more naturally with HTMX swap targets; JSON requires client JS to render |

**Installation:** No new packages required. Workbox 7.4.0 already loaded via `importScripts` in `public/sw.js`.

---

## Architecture Patterns

### Recommended Project Structure

No new directories needed. New files:

```
public/
├── sw.js              MODIFIED — add NetworkFirst routes + partial logic
├── offline.html       NEW — full-page offline fallback
└── offline-partial.html  NEW — inline snippet for HTMX swap targets

web/
└── server.ts          MODIFIED line ~229 — add Vary: HX-Request to onSend hook
```

### Pattern 1: HTMX Partial Disambiguation in Service Worker

**What:** Check `HX-Request` header before selecting caching strategy. Route to partial strategy (separate cache, partial fallback) or page strategy (pages cache, offline.html fallback).

**When to use:** Every fetch that is not a static asset and not a POST.

```javascript
// Source: ARCHITECTURE.md (project research) + MDN Fetch Event
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // POST — never cache
  if (request.method !== 'GET') return;

  // Static assets — handled by existing Workbox CacheFirst route (Phase 12)
  // Workbox routes are checked first via registerRoute

  const isHtmxPartial = request.headers.get('HX-Request') === 'true';

  if (isHtmxPartial) {
    event.respondWith(partialNetworkFirst(request));
  } else if (request.mode === 'navigate') {
    event.respondWith(pageNetworkFirst(request));
  }
  // All other GETs (XHR, fetch) pass through unmodified
});
```

**Critical detail:** Workbox `registerRoute` handlers run before the manual `fetch` event listener only when the route matcher fires. The cleanest approach is to implement the HTMX partial and navigation routes using Workbox's `registerRoute` with custom matchers rather than a raw `fetch` event listener — this keeps the code in Workbox's routing model and avoids listener ordering issues.

### Pattern 2: Workbox NetworkFirst with Offline Fallback

**What:** Try network, on failure serve from cache, on cache miss serve pre-cached fallback file.

```javascript
// Source: Workbox 7.4.0 docs — NetworkFirst strategy with fallback
const pageStrategy = new workbox.strategies.NetworkFirst({
  cacheName: 'vendo-pages-v1',
  plugins: [
    new workbox.expiration.ExpirationPlugin({
      maxEntries: 50,
      maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
    }),
  ],
});

workbox.routing.registerRoute(
  ({ request, url }) =>
    request.mode === 'navigate' &&
    !request.headers.get('HX-Request'),
  async ({ request }) => {
    try {
      return await pageStrategy.handle({ request });
    } catch {
      return caches.match('/offline.html');
    }
  }
);
```

### Pattern 3: Precache Fallback Files on Install

**What:** Add `offline.html` and `offline-partial.html` to the SW cache during the install event so they are available immediately, before any page is visited.

```javascript
// Source: MDN Service Worker API — install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('vendo-precache-v1').then((cache) =>
      cache.addAll(['/offline.html', '/offline-partial.html'])
    )
  );
});
```

**Note:** Phase 12's `skipWaiting()` is already in place. The install event here supplements it — do not remove `skipWaiting`.

### Pattern 4: Global Vary Header in Fastify onSend Hook

**What:** One line added to the existing security headers `onSend` hook in `web/server.ts`.

```typescript
// Source: web/server.ts line 228 — existing onSend hook
app.addHook('onSend', async (_request, reply) => {
  // ... existing security headers (lines 229–245) ...
  reply.header('Vary', 'HX-Request');  // ADD THIS
});
```

**Important:** Fastify's `reply.header('Vary', value)` sets (or appends to) the Vary header. If a route already sets `Vary: Accept-Encoding` (unlikely in this codebase), the hook should append rather than overwrite. Check `reply.getHeader('Vary')` first if needed — but in this codebase no routes set a custom Vary header, so a direct set is safe.

### Pattern 5: Offline Partial HTML Snippet

**What:** A minimal HTML fragment (no `<html>`, `<head>`, `<body>`) designed to render inside any HTMX swap target without breaking layout.

```html
<!-- public/offline-partial.html -->
<div class="offline-partial-notice" role="status" aria-live="polite">
  <svg ...></svg>
  <span>You're offline — this section isn't cached yet</span>
</div>
```

**Styling:** Use `--vendo-text-muted` (#94A3B8) and `--vendo-surface` (#141414) to match the dark theme. Keep height minimal — this is an inline notice, not a full-page replacement.

### Anti-Patterns to Avoid

- **Serving `offline.html` for HTMX partials:** The full `<html>` document is injected into the swap target. The page breaks completely. Always check `HX-Request` first.
- **Caching POST requests:** The Cache API does not support POST. Any attempt to match or respond with a cached POST will silently fail or throw. Pass all POSTs straight through.
- **Matching `hx-push-url` URLs without full-page fallback:** When a user directly navigates to a `hx-push-url`-updated URL (e.g. `/clients?tier=enterprise`) while offline, the SW must serve the cached full page for that URL or fall back to `offline.html`. NetworkFirst caches by full URL including query string — this works automatically.
- **Using `workbox.precaching.precacheAndRoute`:** This requires a build step to generate the manifest. Use manual `caches.open().addAll()` instead (already confirmed correct for CDN-loaded Workbox in this project).
- **Setting `Vary: HX-Request` only on specific routes:** Omitting it from any route means the browser may serve a cached full page in response to an HTMX partial request for the same URL. The global hook approach in the existing `onSend` block eliminates this risk.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cache expiry and eviction | Custom IndexedDB timestamp tracker | `workbox.expiration.ExpirationPlugin` | Handles max entries + TTL with atomic cache operations |
| Network-first fetch with timeout | Custom `Promise.race` fetch timeout | `workbox.strategies.NetworkFirst` | Handles timeouts, cache population, and error fallback with one config option |
| Service worker update coordination | Custom message-passing update flow | `workbox.core.skipWaiting()` + `clientsClaim()` (already in Phase 12) | Phase 12 already handles this; no change needed |

**Key insight:** The Workbox CDN import is already in `sw.js`. All strategies (`NetworkFirst`, `ExpirationPlugin`) are available immediately — no bundler, no new install step. Reach for Workbox primitives before writing any custom cache logic.

---

## Common Pitfalls

### Pitfall 1: Full-Page HTML Injected Into HTMX Swap Target
**What goes wrong:** SW returns `offline.html` (a full `<!DOCTYPE html>` document) as the response to an `hx-get` request. HTMX swaps the full document into the swap target element. The page becomes a nested HTML document — visually broken and non-functional.
**Why it happens:** The SW does not check `HX-Request` header before selecting the fallback. Any route that matches by URL pattern alone will trigger this.
**How to avoid:** Check `request.headers.get('HX-Request') === 'true'` before selecting strategy. Route partials to `offline-partial.html`, pages to `offline.html`. Never cross-serve.
**Warning signs:** After going offline and navigating, the page renders a raw HTML structure inside the main content area. Browser DevTools shows the SW returning a full HTML document for an `hx-get` fetch.

### Pitfall 2: Vary Header Missing — Browser Serves Wrong Cached Response
**What goes wrong:** Without `Vary: HX-Request`, the browser's HTTP cache (and some CDN layers) may serve a cached partial response in response to a full-page navigation (or vice versa). The user sees a fragment of HTML as the full page.
**Why it happens:** HTTP cache keying by URL alone, without considering the `HX-Request` header. The browser cache and the SW cache are separate layers — both must account for this variation.
**How to avoid:** The `Vary: HX-Request` global Fastify hook ensures every response from the server is cache-keyed including the header value. Add this before testing offline behaviour.
**Warning signs:** Full-page navigation to `/clients` shows partial HTML (a table body fragment). Reproduced by loading the partial, then reloading the full page while online — wrong cached version served.

### Pitfall 3: offline.html Not Precached — Fallback Unavailable on First Offline Visit
**What goes wrong:** If `offline.html` is not added to the cache during the SW `install` event, it will only be in cache if the user happened to visit it. The SW has no file to serve as the fallback on a navigation miss.
**Why it happens:** Developers add `offline.html` to the `public/` folder but forget to add it to the precache list.
**How to avoid:** Explicitly `cache.addAll(['/offline.html', '/offline-partial.html'])` in the `install` event. Verify with DevTools > Application > Cache Storage after a hard reload.
**Warning signs:** Going offline and navigating to an uncached page shows a browser-default "no internet" page rather than the branded `offline.html`.

### Pitfall 4: Workbox registerRoute Order Matters
**What goes wrong:** If the navigation/partial routes are registered before the static asset route, static asset requests may match the navigation matcher (if the matcher is too broad) and be routed through NetworkFirst instead of CacheFirst.
**Why it happens:** Workbox evaluates routes in registration order and uses the first match.
**How to avoid:** Keep the existing Phase 12 static asset CacheFirst route registered first. Register navigation and partial routes after. Use specific matchers (`request.mode === 'navigate'` and `request.headers.get('HX-Request')`) to avoid overlap.
**Warning signs:** Static CSS/JS files load slowly on first visit (NetworkFirst overhead) rather than instantly from cache.

### Pitfall 5: HX-Request Header Not Present on Some Requests
**What goes wrong:** Some HTMX requests may not carry `HX-Request: true` — for example, if HTMX is not fully initialised when the request fires, or if a non-HTMX `fetch()` is used in JS code (e.g. the approve button in `base.eta` line 407 uses `fetch('/tasks/' + taskId + '/approve', { method: 'POST', ... })` — this is a POST so it is safe, but any GET `fetch()` calls without the header would be routed as full-page navigations).
**Why it happens:** Custom `fetch()` calls in JS do not automatically include HTMX headers.
**How to avoid:** Manual `fetch()` GET calls are rare in this codebase. Audit `base.eta` and confirm only POST `fetch()` calls exist outside HTMX. Since they are POST, they bypass the SW caching routes. No action needed beyond awareness.
**Warning signs:** A custom `fetch()` GET request during offline returns `offline.html` when it should return a data response or error.

### Pitfall 6: Content Security Policy Blocks Service Worker or Offline Page Assets
**What goes wrong:** `offline.html` references assets (CSS, icons, fonts) that are blocked by the existing CSP header in `web/server.ts`.
**Why it happens:** `offline.html` is a standalone file served by the SW — it is not served by Fastify and does not receive the CSP header. However, any assets it tries to load (`/assets/style.css`, Google Fonts) must be reachable.
**How to avoid:** Offline pages should be self-contained or reference only the cached static assets (CSS, icons). Do not load Google Fonts in `offline.html` — use a system font stack or inline the critical styles. The CSS is available in cache via the Phase 12 CacheFirst route so `/assets/style.css` is safe to reference.
**Warning signs:** `offline.html` renders unstyled. DevTools shows blocked resource loads.

---

## Code Examples

### Complete sw.js additions (Phase 13 section)

```javascript
// Source: Workbox 7.4.0 CDN + project ARCHITECTURE.md

// --- Phase 13: Full-page NavigationFirst with offline fallback ---
const pageStrategy = new workbox.strategies.NetworkFirst({
  cacheName: 'vendo-pages-v1',
  plugins: [
    new workbox.expiration.ExpirationPlugin({
      maxEntries: 50,
      maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
    }),
  ],
});

// HTMX partial strategy — separate cache, shorter TTL
const partialStrategy = new workbox.strategies.NetworkFirst({
  cacheName: 'vendo-partials-v1',
  plugins: [
    new workbox.expiration.ExpirationPlugin({
      maxEntries: 100,
      maxAgeSeconds: 24 * 60 * 60, // 24 hours (partials have live data)
    }),
  ],
});

// Full-page navigations (no HX-Request header)
workbox.routing.registerRoute(
  ({ request }) =>
    request.mode === 'navigate' &&
    !request.headers.get('HX-Request'),
  async ({ request }) => {
    try {
      return await pageStrategy.handle({ request });
    } catch {
      return caches.match('/offline.html');
    }
  }
);

// HTMX partial requests (HX-Request: true)
workbox.routing.registerRoute(
  ({ request }) => request.headers.get('HX-Request') === 'true',
  async ({ request }) => {
    try {
      return await partialStrategy.handle({ request });
    } catch {
      return caches.match('/offline-partial.html');
    }
  }
);

// Precache fallback files at install time
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('vendo-precache-v1').then((cache) =>
      cache.addAll(['/offline.html', '/offline-partial.html'])
    )
  );
});
```

### Fastify Vary header addition

```typescript
// Source: web/server.ts — add one line to the existing onSend hook at line 228
app.addHook('onSend', async (_request, reply) => {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  reply.header('Vary', 'HX-Request'); // ← ADD THIS
  // ... rest of existing headers unchanged
});
```

### offline-partial.html skeleton

```html
<!-- public/offline-partial.html — no doctype, no html/head/body tags -->
<div style="display:flex;align-items:center;gap:0.5rem;padding:0.75rem 1rem;
            color:#94A3B8;font-size:13px;font-family:'Manrope',sans-serif;">
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="2">
    <line x1="1" y1="1" x2="23" y2="23"/>
    <path d="M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0
             0115.06-5.27M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91
             0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01"/>
  </svg>
  You're offline
</div>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual Cache API with custom versioning | Workbox strategies (NetworkFirst, CacheFirst) | Workbox 1.0 (2017), stable since 5.x | Eliminates cache cleanup bugs, handles expiry atomically |
| Single offline fallback page | Separate full-page and partial fallbacks | Emerged with HTMX/partial rendering apps (~2021) | Prevents DOM corruption from full HTML injected into swap targets |
| No Vary header for server-rendered partials | `Vary: HX-Request` on all routes | Required when HTMX + SW caching combined | Enables correct HTTP cache keying when same URL returns different responses |

**Deprecated/outdated:**
- `workbox.precaching.precacheAndRoute([...])` with manifest injection: Requires build tooling (Workbox CLI or webpack plugin). Not applicable here — manual `caches.addAll()` in the install event is the correct approach for CDN-loaded Workbox without a build step.

---

## Open Questions

1. **Online/offline indicator in the topbar**
   - What we know: This is Claude's discretion per CONTEXT.md. The `navigator.onLine` API and the `online`/`offline` window events are available.
   - What's unclear: Whether the planner should include this as a task or leave it as an implementation detail within the sw.js task.
   - Recommendation: Include as a separate small task. A topbar indicator significantly improves UX on intermittent connections and is a 15-line JS addition to `base.eta`.

2. **Cache name versioning strategy for future phases**
   - What we know: Phase 14 (Push Notifications) adds `onpush` and `notificationclick` handlers to `sw.js`. SW update coordination is already handled by `skipWaiting` (Phase 12).
   - What's unclear: Whether Phase 13 should bump cache names to `vendo-pages-v1` or match Phase 12's naming convention (`vendo-static-v1`).
   - Recommendation: Use `vendo-pages-v1` and `vendo-partials-v1` as new, distinct cache names. These are new caches — no conflict with `vendo-static-v1` from Phase 12.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual browser testing (no automated test suite exists for SW behaviour) |
| Config file | None |
| Quick run command | Chrome DevTools > Application > Service Workers > Offline checkbox |
| Full suite command | Chrome DevTools offline simulation + Firefox offline mode |

### Phase Requirements → Test Map
| Req ID | Behaviour | Test Type | Automated Command | File Exists? |
|--------|-----------|-----------|-------------------|-------------|
| OFFL-01 | Static assets cached on install | Manual (DevTools) | Chrome: Application > Cache Storage > vendo-static-v1 | ❌ Wave 0 — manual only |
| OFFL-02 | Visited pages available offline | Manual (DevTools) | Chrome: tick Offline, navigate to visited page | ❌ Wave 0 — manual only |
| OFFL-03 | HTMX partials served correctly offline | Manual (DevTools) | Chrome: tick Offline, trigger HTMX request, verify swap target not corrupted | ❌ Wave 0 — manual only |
| OFFL-04 | Branded offline fallback shown | Manual (DevTools) | Chrome: tick Offline, navigate to unvisited page | ❌ Wave 0 — manual only |
| OFFL-05 | Vary: HX-Request header present | Automated (curl) | `curl -I https://vendo-os.vercel.app/ \| grep -i vary` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** Verify SW registers without console errors; check Vary header via curl
- **Per wave merge:** Full offline simulation in Chrome DevTools; test both full-page and partial offline fallbacks
- **Phase gate:** All 5 requirements manually verified in Chrome DevTools offline mode before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Manual test script — covers OFFL-01 through OFFL-04 (checklist in PLAN.md)
- [ ] Curl command for Vary header — covers OFFL-05

None — no test infrastructure required beyond a browser. All SW behaviour is validated via Chrome DevTools Application panel.

---

## Sources

### Primary (HIGH confidence)
- Workbox 7.4.0 (Google Chrome Developers docs) — NetworkFirst strategy, ExpirationPlugin, CDN import pattern
- MDN: Service Worker API — install event, fetch event, caches.match(), Cache API
- MDN: Fetch API — request.headers, request.mode === 'navigate'
- `public/sw.js` (codebase) — confirmed Phase 12 state: Workbox 7.4.0 CDN, CacheFirst for static assets, skipWaiting, clientsClaim
- `web/server.ts` (codebase) — confirmed existing `onSend` hook at line 228 for security headers
- `web/views/layouts/base.eta` (codebase) — confirmed HTMX 2.0.4 loaded, SW registered, no global HTMX config that suppresses headers
- `vercel.json` (codebase) — confirmed `Cache-Control: public, max-age=0, must-revalidate` on `/sw.js` already in place
- Project ARCHITECTURE.md (`.planning/research/ARCHITECTURE.md`) — HTMX partial disambiguation pattern, caching strategy by resource type
- Project SUMMARY.md (`.planning/research/SUMMARY.md`) — confirmed pitfall 1 as highest-risk item, Phase 3 research flags

### Secondary (MEDIUM confidence)
- Philip Walton: Smaller HTML Payloads with Service Workers — HTMX + SW partial disambiguation pattern (authoritative original source for the pattern)
- HTMX GitHub Issue #1445 — community confirmation that `HX-Request` header is present on all HTMX fetch requests

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Workbox 7.4.0 already in codebase, no new libraries, patterns verified against official docs
- Architecture: HIGH — Three-way routing (static/page/partial) is well-documented; codebase confirms all integration points
- Pitfalls: HIGH — HTMX + SW pitfall is documented, verified in codebase, and confirmed by project-level research

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (Workbox 7.x is stable; HTMX 2.x API is stable; no fast-moving dependencies)
