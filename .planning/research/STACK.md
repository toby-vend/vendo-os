# Technology Stack

**Project:** VendoOS — Mobile & PWA milestone (v1.1)
**Researched:** 2026-04-06
**Confidence:** HIGH for core choices; MEDIUM for iOS push behaviour (browser spec variances persist)

---

## Context: What This Covers

The existing stack (Fastify 5 + Eta + HTMX on Vercel, @fastify/static 9, SQLite/Turso, custom session auth) is **not changing**. This research covers only the net-new additions required for:

1. Mobile-responsive layout (sidebar collapse, bottom tab bar, touch-friendly tables)
2. PWA manifest and installability (home screen, splash screen, standalone mode)
3. Service worker with offline caching
4. Web push notifications (draft ready, QA failure, task status changes)

Nothing below requires a new framework or a build pipeline. No webpack, no Vite, no bundler. The project is already ESM TypeScript with no client-side build step.

---

## Recommended Stack

### PWA Manifest

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Static JSON file served by @fastify/static | — | Web app manifest | Zero dependencies; `manifest.json` is plain JSON placed in `public/` and served as `/manifest.json`. @fastify/static already serves the public directory. No library needed. |

**Implementation:** Add `<link rel="manifest" href="/manifest.json">` to the base layout template (`web/views/layouts/`). The manifest JSON requires at minimum: `name`, `short_name`, `start_url`, `display: "standalone"`, `background_color`, `theme_color`, and `icons` at 192×192 and 512×512 (PNG).

**iOS meta tags:** Safari does not fully implement the manifest spec. Add Apple-specific meta tags to the layout for correct iOS home screen behaviour:
- `<meta name="apple-mobile-web-app-capable" content="yes">`
- `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`
- `<link rel="apple-touch-icon" href="/assets/icon-192.png">`

**Confidence:** HIGH — MDN and Chrome developer docs confirm these as current installability requirements.

---

### Service Worker + Offline Caching

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Workbox (CDN import via importScripts) | 7.4.0 | Cache strategies, precaching, routing | Google's production-grade service worker library. Used by 54% of mobile sites. CDN import avoids needing a build step — critical for this stack which has no client-side bundler. |

**Why not vanilla service worker:** The web platform APIs for cache management are low-level and error-prone. Cache versioning, stale content cleanup, cache-first vs network-first routing all need to be implemented manually. Workbox handles all of this correctly and is maintained by Google Chrome team.

**Why CDN over npm install:** This project has no webpack/Vite/Rollup build pipeline for client-side code. Installing Workbox as an npm package would require adding a build step. Using `importScripts` from the Workbox CDN (Google Storage, not a third-party CDN) is the supported pattern for non-bundled environments.

**CDN URL for service worker:**
```js
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.4.0/workbox-sw.js');
```

**Caching strategy per asset type:**
- Static assets (CSS, JS, images, icons): **CacheFirst** with expiry — served from cache instantly, updated in background
- HTML pages / HTMX partials: **NetworkFirst** — fetch fresh from server, fall back to cache if offline
- API routes (`/api/*`): **NetworkOnly** — never serve stale API data offline; show cached UI with offline message
- Push subscription endpoint: **NetworkOnly** — must reach the server

**Service worker file location:** `public/sw.js` — served at `/sw.js`. The service worker must be served from the root scope (`/`) to intercept all page requests. @fastify/static already serves `public/` at the root, so this works without configuration changes.

**Vercel cache header for service worker:** Service workers must not be cached by the CDN or browser HTTP cache — they must be re-fetched on every page load so updates are detected promptly. Add to `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/sw.js",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }
      ]
    }
  ]
}
```

**Confidence:** HIGH for Workbox patterns (Google Chrome docs). HIGH for service worker cache header requirement (Vercel docs, March 2026).

---

### Web Push Notifications

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| web-push | 3.6.7 | Server-side VAPID key generation and push message sending | The de facto standard Node.js library for Web Push Protocol. Works with any framework including Fastify. Handles JWT signing, encryption, and GCM fallback. |
| @types/web-push | latest | TypeScript types for web-push | Project is TypeScript; types are in DefinitelyTyped, not bundled. |

**Why web-push 3.6.7 despite slow release cadence:** The Web Push Protocol (RFC 8030) and VAPID (RFC 8292) are stable, ratified specifications. The library implements a stable spec; infrequent releases are not a maintenance concern here — the protocol does not change. Version 3.6.7 is the current published version.

**Why not ntfy or PushForge:** ntfy is self-hosted and requires a separate server — incompatible with Vercel serverless. PushForge is a third-party service with vendor lock-in and ongoing cost. Web Push with VAPID uses browser-native push infrastructure (FCM for Android/Chrome, APNs for iOS Safari) with no third-party intermediary required.

**VAPID key generation (one-time setup):**
```bash
npx web-push generate-vapid-keys
```
Store `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` as Vercel environment variables. The public key is sent to the browser for subscription; the private key signs server-side push requests. Never commit either to git.

**Subscription storage:** Store push subscriptions in a new `push_subscriptions` table in the existing Turso/SQLite database. Columns: `id`, `user_id` (FK to existing users table), `endpoint`, `p256dh`, `auth`, `created_at`, `last_used_at`. One user can have multiple subscriptions (different devices/browsers).

**iOS push limitations (MEDIUM confidence):**
- Push only works for PWAs **installed to the iOS home screen** — it does not work in the browser tab
- Requires iOS 16.4+ — below this version, push silently fails (no error thrown)
- The push permission prompt must be triggered by a direct user interaction (button tap), not on page load
- Smaller notification payload limit than Android; keep title + body under 200 characters
- Interactive action buttons in notifications are not supported on iOS Safari

**Confidence:** HIGH for web-push library and VAPID flow. MEDIUM for iOS-specific push behaviour (tested across multiple sources but Apple's implementation has historically changed without notice).

---

### Mobile CSS

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Existing `public/assets/style.css` | — | All responsive styles | No CSS framework added. Mobile styles are additive media queries on top of the existing stylesheet. Adding Tailwind or Bootstrap would require a build step and rewrite existing styles. |

**Approach:** Mobile-first responsive additions to the existing CSS file. The project already has a custom CSS file — extend it rather than replace it.

**Key patterns to implement (no new dependencies):**

1. **Viewport meta tag** (if not present): `<meta name="viewport" content="width=device-width, initial-scale=1">` in base layout
2. **Sidebar collapse on mobile:** Media query at `768px` — hide sidebar, show hamburger toggle. Sidebar becomes a slide-in drawer via CSS `transform: translateX(-100%)` + a toggled class.
3. **Bottom tab bar:** Fixed position bar at `bottom: 0` visible only below `768px`. Contains 4–5 primary navigation links as icon + label. Use `env(safe-area-inset-bottom)` for iPhone notch/home indicator clearance.
4. **Tables:** Horizontal scroll container (`overflow-x: auto`) wrapping existing table elements. No table restructuring needed.
5. **Touch targets:** All interactive elements (buttons, links, form controls) minimum `44px × 44px` tap target (Apple HIG / WCAG 2.5.5).
6. **Viewport units:** Use `dvh` (dynamic viewport height) rather than `vh` for full-screen layouts on mobile — `vh` on iOS Safari includes the address bar height and causes overflow bugs.

**Confidence:** HIGH — these are established CSS patterns with no library dependency.

---

### HTMX + Service Worker Interaction

No library change required. One architectural note:

HTMX makes partial HTML requests (`hx-get`, `hx-post`) that fetch page fragments. The service worker must be configured to **NetworkFirst** for these requests so HTMX always gets current server HTML. Serving stale HTMX partial responses from cache produces broken UI (partial swap into a page that has changed).

The only exception: if the user is offline, the service worker can serve a cached "offline" partial HTML response for HTMX requests that fail, displaying a graceful degradation message within the swapped element rather than a full-page error.

**Confidence:** HIGH — derived from Workbox NetworkFirst documentation and HTMX's documented fetch behaviour.

---

## Installation

```bash
# Server-side push notifications only
npm install web-push
npm install -D @types/web-push
```

**No other npm packages are needed.** Workbox is loaded via CDN in the service worker file itself. All CSS changes go into the existing stylesheet. The manifest is a static JSON file.

---

## File Changes Summary

| File | Change |
|------|--------|
| `public/manifest.json` | New — PWA manifest |
| `public/sw.js` | New — service worker (Workbox CDN) |
| `public/assets/icon-192.png` | New — PWA icon (192×192) |
| `public/assets/icon-512.png` | New — PWA icon (512×512) |
| `public/assets/style.css` | Modified — mobile responsive styles |
| `web/views/layouts/base.eta` (or equivalent) | Modified — manifest link, Apple meta tags, viewport meta, SW registration script |
| `vercel.json` | Modified — no-cache header for `/sw.js` |
| `web/routes/` | New routes — `/push/subscribe`, `/push/unsubscribe`, `/push/send` (internal) |
| Database schema | New `push_subscriptions` table |
| `.env.local` / Vercel env vars | New — `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Vite PWA plugin (`vite-plugin-pwa`) | Requires adding Vite as a bundler — the entire project has no client-side build step | Workbox CDN import + manual manifest.json |
| next-pwa | Next.js only | Workbox CDN import |
| Firebase Cloud Messaging (FCM direct SDK) | Adds Google dependency; VAPID already works natively with Chrome/Android via FCM under the hood without SDK | web-push with VAPID |
| Pusher / OneSignal / Sendbird | Third-party push intermediary with cost and vendor lock-in; not justified for an internal tool | web-push with VAPID |
| Tailwind CSS | Requires a build step; would require migrating or duplicating existing CSS | Media queries in existing style.css |
| `vh` for full-height mobile layouts | iOS Safari's `vh` includes hidden address bar, causing 100vh to overflow | `dvh` (dynamic viewport height, supported iOS 15.4+, Chrome 108+) |
| `importScripts` with unpinned Workbox CDN URL | Service worker would silently update Workbox version, potentially breaking caching behaviour | Pin to `workbox-cdn/releases/7.4.0/` |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Service worker tooling | Workbox 7.4.0 via CDN | Vanilla service worker | Error-prone cache versioning and cleanup; no caching strategy abstractions; more code to maintain |
| Push library | web-push 3.6.7 | PushForge | Third-party SaaS; ongoing cost; vendor lock-in for an internal tool |
| Push library | web-push 3.6.7 | ntfy self-hosted | Requires a separate always-on server; incompatible with Vercel serverless |
| CSS approach | Extend existing style.css | Add Tailwind | Requires build pipeline; would require rewriting or co-existing with existing custom CSS |
| Manifest delivery | Static file via @fastify/static | Dynamic Fastify route returning JSON | No benefit to dynamic generation; manifest content is static per environment |

---

## Environment Variables to Add

```
VAPID_PUBLIC_KEY=      # Generated by web-push; safe to expose to client
VAPID_PRIVATE_KEY=     # Generated by web-push; server only — never expose to client
VAPID_SUBJECT=         # mailto: or https: URL identifying the push sender, e.g. mailto:admin@vendo.co.uk
```

---

## Sources

- [Workbox 7.4.0 — workbox-routing npm](https://www.npmjs.com/package/workbox-routing) — confirmed version 7.4.0, last published November 2025 (HIGH confidence)
- [Workbox CDN import — workbox-sw module](https://developer.chrome.com/docs/workbox/modules/workbox-sw) — official Google Chrome docs for CDN usage pattern (HIGH confidence)
- [Workbox caching strategies overview](https://developer.chrome.com/docs/workbox/caching-strategies-overview) — CacheFirst, NetworkFirst, StaleWhileRevalidate (HIGH confidence)
- [web-push npm](https://www.npmjs.com/package/web-push) — version 3.6.7 (HIGH confidence)
- [web-push GitHub](https://github.com/web-push-libs/web-push) — VAPID key generation, Node.js usage (HIGH confidence)
- [Making PWAs installable — MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) — manifest requirements, service worker requirement (HIGH confidence)
- [PWA iOS limitations 2026 — MagicBell](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) — iOS push constraints, iOS 16.4+ requirement (MEDIUM confidence — third-party, cross-referenced with Apple developer docs)
- [Apple web push docs](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers) — iOS Safari push requirements (HIGH confidence)
- [Vercel cache headers — official docs](https://vercel.com/docs/caching/cache-control-headers) — service worker no-cache header pattern confirmed March 2026 (HIGH confidence)
- [PWA best practices 2026 — web.dev](https://web.dev/learn/pwa/workbox) — Workbox recommendation (HIGH confidence)
- [Offline caching strategies — MagicBell](https://www.magicbell.com/blog/offline-first-pwas-service-worker-caching-strategies) — strategy selection rationale (MEDIUM confidence — third-party)

---

*Stack research for: VendoOS v1.1 — Mobile & PWA*
*Researched: 2026-04-06*
*Prior milestone stack (skills layer / Drive sync): see git history*
