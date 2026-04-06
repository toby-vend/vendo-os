# Architecture Patterns — Mobile PWA Layer

**Domain:** PWA + responsive design integration with Fastify + Eta + HTMX server-rendered dashboard
**Milestone:** v1.1 Mobile & PWA
**Researched:** 2026-04-06
**Confidence:** HIGH

---

## System Overview

The PWA layer sits entirely on top of the existing architecture. The Fastify server, Eta templates, HTMX partial updates, and Turso database are unchanged. What is added is:

1. A service worker (static file served from `/`) that intercepts network requests
2. A web app manifest (`/manifest.json`) that enables home-screen installation
3. A push subscription API endpoint on the Fastify server (`/api/push/*`)
4. A push subscriptions table in Turso/SQLite
5. CSS changes to the single stylesheet (`public/assets/style.css`) for responsive layout

```
┌────────────────────────────────────────────────────────────────────────┐
│                         DEVICE / BROWSER                               │
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                   SERVICE WORKER THREAD                         │   │
│  │  (sw.js — separate JS thread, intercepts fetch, handles push)   │   │
│  │                                                                 │   │
│  │  ┌─────────────┐   ┌─────────────┐   ┌──────────────────────┐  │   │
│  │  │ Cache Store │   │ Push Handler│   │ Background Sync Queue│  │   │
│  │  │ (CacheAPI)  │   │ (onpush)    │   │ (NOT on iOS Safari)  │  │   │
│  │  └─────────────┘   └─────────────┘   └──────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│              ↑ intercepts fetch requests                               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     MAIN PAGE THREAD                            │   │
│  │   Eta-rendered HTML + HTMX + Chart.js                           │   │
│  │   service worker registration (base.eta <head>)                 │   │
│  │   push subscription management (subscribe/unsubscribe JS)       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
                            ↕ HTTPS
┌────────────────────────────────────────────────────────────────────────┐
│                    FASTIFY SERVER (Vercel)                              │
│                                                                        │
│  ┌──────────────────────┐  ┌───────────────────────────────────────┐   │
│  │ Static assets        │  │ Existing routes (unmodified)          │   │
│  │ /sw.js               │  │ Eta SSR, HTMX partials                │   │
│  │ /manifest.json       │  │ Session auth                          │   │
│  │ /assets/style.css    │  └───────────────────────────────────────┘   │
│  └──────────────────────┘                                              │
│  ┌──────────────────────┐                                              │
│  │ NEW: Push API routes │                                              │
│  │ POST /api/push/subscribe                                           │
│  │ POST /api/push/unsubscribe                                         │
│  │ POST /api/push/send (internal trigger)                             │
│  └──────────────────────┘                                              │
└────────────────────────────────────────────────────────────────────────┘
                            ↕ HTTPS (encrypted push payload)
┌────────────────────────────────────────────────────────────────────────┐
│               BROWSER PUSH SERVICE (platform-operated)                 │
│    Chrome: FCM (Google)  |  Firefox: Mozilla  |  Safari: Apple APNs   │
│    VendoOS server encrypts payload with device public key + VAPID.     │
│    Push service forwards to device when online.                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

| Component | Responsibility | Location | Communicates With |
|-----------|----------------|----------|-------------------|
| `sw.js` | Intercept fetch, serve from cache, handle push events, show browser notifications | `public/sw.js` | Browser Cache API, Notification API, main thread via postMessage |
| `manifest.json` | PWA install metadata (name, icons, start_url, display: standalone, theme colour) | `public/manifest.json` | Browser install prompt only |
| Push API routes | Accept push subscriptions, store in DB, trigger `web-push` sendNotification | `web/routes/push.ts` | Turso/SQLite `push_subscriptions` table, `web-push` npm library |
| `push_subscriptions` table | Per-user push endpoint, public key, auth token — stored against `user_id` | Turso DB | Push API routes |
| Responsive CSS | Media queries, mobile layout, bottom tab bar, touch targets | `public/assets/style.css` | None — pure CSS |
| Offline fallback page | Static HTML rendered when network fails and no cache hit exists | `public/offline.html` | Served by service worker only |
| VAPID key pair | Server identity for push services — generated once, stored in env vars | `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` env vars | Push API routes |

---

## Data Flow

### 1. PWA Installation Flow

```
User visits VendoOS on mobile browser
  → base.eta serves <link rel="manifest" href="/manifest.json">
  → base.eta registers service worker: navigator.serviceWorker.register('/sw.js')
  → sw.js install event: precache static assets (style.css, htmx.js, offline.html)
  → sw.js activate event: delete old caches
  → Browser shows "Add to Home Screen" prompt (Android/Chrome automatic;
    iOS requires user to tap Share → Add to Home Screen)
  → User installs → subsequent opens launch in standalone mode (no browser chrome)
```

### 2. Request Interception and Caching (HTMX Partial Updates)

This is the most architecturally significant integration point with HTMX.

```
User navigates / HTMX fires hx-get request
  → Fetch event intercepted by service worker

  IF request is a static asset (style.css, htmx.js, chart.js, fonts):
    → Cache-first strategy
    → Return from cache immediately; revalidate in background

  IF request is a full-page navigation (no HX-Request header):
    → Network-first strategy
    → Fetch from Fastify server → cache response → return
    → On network failure → return cached page or offline.html

  IF request has HX-Request: true header (HTMX partial):
    → Network-first strategy
    → Fetch from Fastify → cache partial response → return
    → On network failure → return cached partial OR return offline partial
      (pre-cached /offline-partial.html snippet)

  IF request is POST (form submit, HTMX post):
    → Pass through to network, never cache
    → On network failure → show error (Background Sync not viable; see pitfalls)
```

**Critical detail:** HTMX partials are identified by the `HX-Request: true` header. The service worker must check for this header to distinguish full-page navigations from HTMX partial swaps. Treating them differently matters: a full-page fallback served for an HTMX partial request will corrupt the DOM.

### 3. Push Notification Flow (Server to Device)

```
Internal event occurs (e.g. task status changes to 'complete', QA fails)
  → Event handler in Fastify route calls pushNotificationService.send(userId, payload)

pushNotificationService.send():
  → SELECT push_subscriptions WHERE user_id = ? (may be multiple devices)
  → for each subscription:
      webPush.sendNotification(subscription, JSON.stringify(payload), vapidOptions)
      → POST to browser push service endpoint (FCM / Mozilla / Apple APNs)
      → Push service holds payload until device is online

Device receives push (online or wakes):
  → Service worker push event fires (sw.js onpush handler)
  → sw.js: self.registration.showNotification(title, options)
  → Notification appears in OS notification centre
  → User taps notification
  → notificationclick event fires in sw.js
  → sw.js: clients.openWindow(payload.url) or focus existing window
  → VendoOS opens to the relevant page
```

**Vercel constraint:** `webPush.sendNotification()` is a standard outbound HTTPS call — compatible with Vercel serverless functions. The Vercel function does not need to stay alive; the push service handles delivery. No long-lived connections required.

### 4. Push Subscription Lifecycle

```
User opens VendoOS (post-install or in browser)
  → Settings page or banner triggers requestNotificationPermission()
  → User grants permission
  → pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC_KEY })
  → Browser returns PushSubscription object (endpoint URL + keys)
  → POST /api/push/subscribe { subscription: {...} }
  → Server: INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, ua_hint)
  → Confirmation shown to user

Push delivery failure (subscription expired / device unregistered):
  → webPush.sendNotification() throws with statusCode 410 (Gone)
  → Server: DELETE FROM push_subscriptions WHERE endpoint = ?
  → Subscription pruned automatically — no manual cleanup needed
```

---

## Caching Strategy by Resource Type

| Resource Type | Strategy | Rationale |
|---------------|----------|-----------|
| CSS, HTMX JS, Chart.js | Cache-first + background revalidate (stale-while-revalidate) | Static — serve instantly, update silently |
| Font files (Manrope) | Cache-first (long TTL) | Immutable once loaded |
| SVG icons / favicon | Cache-first | Immutable |
| Full-page navigations (GET, no HX-Request header) | Network-first, cache fallback | Pages have session-dependent content; freshness matters |
| HTMX partial responses (GET, HX-Request: true) | Network-first, cache fallback | Partials contain live data; offline fallback partial acceptable |
| POST requests (form submissions, HTMX posts) | Network only — never cache | Mutations must reach server |
| Push subscription API (`/api/push/*`) | Network only | Subscription state must be accurate |

---

## New Files and Integration Points

```
public/
├── sw.js                    NEW — service worker
├── manifest.json            NEW — PWA manifest
├── offline.html             NEW — offline fallback (full page)
├── offline-partial.html     NEW — offline fallback (HTMX partial swap)
├── icons/                   NEW — PWA icons (192×192, 512×512 PNG + maskable)
│   ├── icon-192.png
│   ├── icon-512.png
│   └── icon-maskable-512.png
└── assets/
    └── style.css            MODIFIED — responsive CSS additions

web/
├── views/
│   └── layouts/
│       └── base.eta         MODIFIED — add manifest link, SW registration,
│                              push subscription JS, mobile-menu button
├── routes/
│   └── push.ts              NEW — POST /api/push/subscribe + unsubscribe + send
└── lib/
    └── push.ts              NEW — webPush.sendNotification() wrapper,
                               subscription CRUD queries

data/
└── migrations/
    └── add_push_subscriptions.sql   NEW — push_subscriptions table
```

---

## Database Schema: Push Subscriptions

```sql
CREATE TABLE push_subscriptions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,          -- push service URL (device-specific)
  p256dh      TEXT NOT NULL,                 -- device public key
  auth        TEXT NOT NULL,                 -- auth secret
  ua_hint     TEXT,                          -- e.g. 'Chrome/Android' for debugging
  created_at  TEXT DEFAULT (datetime('now')),
  last_used   TEXT
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);
```

No separate subscriptions-per-notification-type table needed at this scale. All notifications go to all subscriptions for a user. Opt-out is handled at the OS notification settings level.

---

## Responsive Layout Architecture

The sidebar-based desktop layout must coexist with a bottom-tab-bar mobile layout. The transition breakpoint is 768px (already used in `base.eta` JS logic — `window.innerWidth <= 768`).

```
Desktop (> 768px):                  Mobile (≤ 768px):
┌──────────┬─────────────────┐      ┌────────────────────────────┐
│          │   Topbar        │      │   Topbar (hamburger only)  │
│ Sidebar  ├─────────────────┤      ├────────────────────────────┤
│          │                 │      │                            │
│          │   Main content  │      │   Main content             │
│          │                 │      │   (full width)             │
│          │                 │      │                            │
└──────────┴─────────────────┘      ├────────────────────────────┤
                                    │   Bottom tab bar           │
                                    │ (Home|Clients|Briefs|More) │
                                    └────────────────────────────┘
```

The sidebar (currently `<aside class="sidebar">`) is hidden at mobile breakpoint. A bottom tab bar `<nav class="mobile-tab-bar">` is added inside `base.eta` as a sibling to `.main-wrapper`. It contains the 4-5 most-used navigation items. The overflow drawer (slide-up panel triggered by "More") exposes remaining navigation groups — this replaces the desktop sidebar accordion on mobile.

The topbar hamburger button (`class="mobile-menu-btn"`) is already in `base.eta`; it currently triggers `toggleSidebar()`. On mobile, this will open a slide-over drawer rather than the sidebar.

---

## Build Order (Dependencies)

This order avoids blockers and allows incremental testing at each step.

```
1. Responsive CSS
   (no dependencies — pure CSS changes to style.css)

2. Web app manifest + icons
   (depends on: CSS breakpoints decided, icon assets designed)
   (enables: "Add to Home Screen" prompt on Android Chrome)

3. Service worker — static asset caching only
   (depends on: manifest registered in base.eta)
   (enables: offline static assets, Lighthouse PWA score, installability)
   Build and validate before adding fetch interception for dynamic routes.

4. Service worker — full-page + HTMX partial caching
   (depends on: static caching working; offline.html + offline-partial.html exist)
   (enables: offline page fallback, cached navigation)
   THIS STEP carries the highest integration risk with HTMX — test thoroughly.

5. Push subscription API (server-side)
   (depends on: VAPID keys generated, push_subscriptions table migration run)
   (enables: subscriptions stored; does not require service worker push handling)

6. Service worker push handler
   (depends on: push subscription API complete)
   (enables: notifications appearing on device)

7. Trigger push from application events
   (depends on: push subscription API + service worker push handler both working)
   Wire into existing task status changes, QA results, etc.
```

---

## Integration with Existing HTMX Partial Updates

HTMX makes a standard `fetch()` under the hood. The service worker intercepts all fetches, including HTMX partial requests. This creates one important integration concern:

**Partial vs full response disambiguation.** When offline, the service worker must not serve a full cached page as the response to an HTMX swap — this would replace the `<main>` content with a full HTML document including `<html>`, `<head>`, `<body>`, breaking the page. The service worker must:

1. Check for `HX-Request: true` request header to identify HTMX requests
2. Serve a cached partial (`offline-partial.html`) or a lightweight JSON error response
3. NEVER serve a full-page HTML response to an HTMX swap target

HTMX's `hx-boost` is not used in VendoOS — navigation is standard `<a>` links plus `hx-get`/`hx-post` for partials. The service worker strategy does not need to handle `hx-boost` page intercept patterns.

**Cache key design.** HTMX partial responses vary by URL path (e.g. `/video-production/notifications` returns partial HTML). The cache key is the full URL. The service worker uses `Request.url` as the cache key and `Request.headers.get('HX-Request')` for strategy selection. No special cache key manipulation is needed.

---

## Platform Constraints (iOS Safari)

| Feature | Android Chrome | iOS Safari (≥ 16.4) |
|---------|---------------|----------------------|
| PWA install to home screen | Automatic prompt via `beforeinstallprompt` | Manual: Share → Add to Home Screen only |
| Service worker | Full support | Full support |
| Offline caching | Full support | Full support |
| Push notifications (installed PWA) | Full support | Supported since iOS 16.4 |
| Push notifications (browser tab, not installed) | Not supported | Not supported |
| Background Sync API | Supported | Not supported |
| Periodic Background Sync | Supported | Not supported |
| EU users (iOS 17.4+) | N/A | PWA opens in Safari tab — no push |

**Implication for VendoOS:** Push notifications only reach staff who have installed the PWA to their home screen. This is acceptable for an internal tool — staff can be instructed to install it. Do not design push as the only notification channel.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Caching POST Requests
The Cache API cannot store POST responses. Service worker `fetch` handlers should pass POST requests straight to the network. Attempting to cache or intercept writes will corrupt form submission flows and HTMX `hx-post` behaviour.

### Anti-Pattern 2: Serving Full Pages to HTMX Partial Targets
When the service worker returns a cached full-page response to an HTMX `hx-swap`, the entire `<html>` document is injected into the swap target element. The page breaks visually and functionally. Always identify and handle HTMX requests separately.

### Anti-Pattern 3: Registering the Service Worker from a Subdirectory Path
If `sw.js` is served from `/assets/sw.js`, its scope is limited to `/assets/`. It will not intercept requests for `/`, `/dashboard`, `/clients`, etc. The service worker **must** be served from the root path (`/sw.js`) to control the entire origin.

Fastify static file serving must explicitly serve `/sw.js` with `Cache-Control: no-cache` so updated service workers are picked up promptly.

### Anti-Pattern 4: Hardcoding VAPID Keys in Source
VAPID private key must not be committed to git. Store in `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` environment variables. The public key is safe to expose in client JS (it is public by design). The private key is server-only.

### Anti-Pattern 5: One Push Subscription Row Per User (No Multi-Device Support)
Staff will access VendoOS from phone and laptop. `UNIQUE` constraint on `user_id` would overwrite the other device's subscription on each new login. Use `UNIQUE` on `endpoint` only — one row per device, multiple rows per user.

### Anti-Pattern 6: Relying on Background Sync for Offline Write Queue
Background Sync API is not supported on iOS Safari and was removed from Firefox. An offline write queue (e.g. "retry form submission when back online") cannot be implemented with this API cross-platform. For VendoOS, the correct behaviour is: POST fails while offline → show an error toast → user retries manually when online. Implementing a custom write queue in IndexedDB is over-engineering for an internal tool.

---

## Sources

- [MDN: PWA Caching Strategies](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Caching) — HIGH confidence
- [Chrome Developers: Workbox Caching Strategies Overview](https://developer.chrome.com/docs/workbox/caching-strategies-overview) — HIGH confidence
- [MDN: Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) — HIGH confidence
- [web-push npm library](https://www.npmjs.com/package/web-push) — HIGH confidence (active, 4.6.x, Node.js standard for VAPID push)
- [Apple Developer: Sending Web Push in Web Apps](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers) — HIGH confidence
- [MagicBell: PWA iOS Limitations](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) — MEDIUM confidence
- [Philip Walton: Smaller HTML Payloads with Service Workers](https://philipwalton.com/articles/smaller-html-payloads-with-service-workers/) — HIGH confidence (authoritative on HTMX + SW integration pattern)
- [HTMX GitHub Issue #1445: HTMX and service workers](https://github.com/bigskysoftware/htmx/issues/1445) — MEDIUM confidence (community discussion confirming fetch interception approach)
- [MDN: Making PWAs Installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) — HIGH confidence

---

*Architecture research for: VendoOS v1.1 Mobile & PWA*
*Researched: 2026-04-06*
