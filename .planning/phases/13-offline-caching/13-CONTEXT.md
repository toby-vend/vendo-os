# Phase 13: Offline Caching - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the Phase 12 service worker to cache visited pages for offline reading, handle HTMX partial responses correctly (never serve a full page into a partial swap target), add a branded offline fallback page, and add `Vary: HX-Request` to all Fastify routes. No push notifications (Phase 14).

</domain>

<decisions>
## Implementation Decisions

### Caching Strategy
- All visited full pages cached with NetworkFirst (Workbox) — show cached version when offline, always try network first when online
- HTMX partial requests (HX-Request: true) cached separately from full-page responses
- Service worker checks `request.headers.get('HX-Request')` to branch caching logic
- Static assets remain CacheFirst from Phase 12 — no change needed

### Vary Header
- All Fastify routes must include `Vary: HX-Request` in response headers
- Implemented as a global Fastify `onSend` hook — not per-route
- This enables the browser and SW to cache full-page and partial responses separately for the same URL

### HTMX Partial Offline Handling
- When offline and a partial request has no cache hit: serve a small HTML snippet (not the full offline page)
- The snippet should say "You're offline" styled to fit inside the swap target — not a full `<html>` document
- Full-page navigations that miss cache: serve the branded offline fallback page

### Offline Fallback Page
- Static HTML file: `public/offline.html`
- Precached by the service worker on install (alongside static assets)
- Design: Claude's discretion — match the existing dark theme, include VendoOS logo, "You're offline" message, retry button
- Retry: Claude decides simplest reliable approach

### What Gets Cached
- All visited pages (any URL the user navigates to) — cached automatically by NetworkFirst
- No selective caching — if they visited it, it's cached
- Cache expiry: Claude decides reasonable TTL (probably 24h or 7d)

### Claude's Discretion
- Offline fallback page visual design (within existing dark theme)
- Retry button behaviour (reload vs ping-then-redirect)
- Offline partial snippet content and styling
- Cache name conventions and expiry durations
- Whether to show an "offline" indicator in the topbar when connection drops
- Service worker update/activation strategy (skipWaiting already set in Phase 12)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `public/sw.js`: Phase 12 service worker with Workbox 7.4.0 CDN, CacheFirst for static assets — extend with NavigationRoute and page caching
- `web/views/layouts/base.eta`: template where `Vary` header logic connects via Fastify hooks
- `public/assets/style.css`: existing dark theme tokens for offline page styling

### Established Patterns
- Fastify `onSend` hook pattern: already used for session auth checks — add Vary header in same hook chain
- `@fastify/static` serves `public/` — `offline.html` goes here
- HTMX sends `HX-Request: true` header on all partial requests — this is the discriminator

### Integration Points
- `public/sw.js`: add NetworkFirst route for navigation requests, add partial request handling
- `web/lib/server.ts` (or wherever Fastify hooks are registered): add global `onSend` hook for Vary header
- `public/offline.html`: new static file, precached by SW
- Service worker `install` event: add `offline.html` to precache list

</code_context>

<specifics>
## Specific Ideas

- The offline partial snippet should be unobtrusive — a muted "You're offline" message that fits naturally inside any HTMX swap target without breaking layout.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 13-offline-caching*
*Context gathered: 2026-04-06*
