# Project Research Summary

**Project:** VendoOS — Mobile & PWA (v1.1)
**Domain:** Progressive Web App layer on top of existing Fastify + Eta + HTMX internal dashboard
**Researched:** 2026-04-06
**Confidence:** HIGH

---

## Executive Summary

VendoOS v1.1 adds a mobile and PWA layer on top of an existing server-rendered stack (Fastify 5, Eta templates, HTMX, Turso/SQLite, Vercel). The recommended approach is strictly additive: no framework changes, no build pipeline, no new dependencies beyond `web-push` for server-side push notifications. Everything is achieved with a static manifest JSON, a Workbox-powered service worker loaded via CDN, and media query additions to the existing stylesheet. This approach is confirmed correct for the specific stack and avoids the traps of adding bundler tooling or CSS frameworks that would require rewriting or co-existing with existing styles.

The core mobile use case is read-and-approve, not creation. Account managers use their phones to check task status, review AI-generated drafts, and approve or reject without returning to a laptop. The build order is strictly sequenced by dependencies: responsive CSS first (no new tech), then PWA manifest and service worker shell (enables installs), then offline caching (extends the service worker), then push notification infrastructure (new backend work). Each phase is independently deployable and testable before moving to the next.

The primary technical risk is the iOS Safari constraint: push notifications only work on PWAs installed to the home screen on iOS 16.4+, and the iOS installation flow is manual — there is no `beforeinstallprompt` event. For an internal tool where staff can be instructed to install it, this is acceptable. A secondary risk is the HTMX + service worker integration: the service worker must distinguish HTMX partial requests from full-page navigations using the `HX-Request` header, or offline fallbacks will inject a full HTML document into a partial swap target, corrupting the page. This is a well-understood pattern with a clear solution, but it must be tested in an offline simulation before shipping.

---

## Key Findings

### Recommended Stack

The existing stack requires no changes. Two npm packages are added: `web-push` 3.6.7 (server-side VAPID push) and `@types/web-push`. Workbox 7.4.0 is loaded via CDN import inside the service worker file — no build step required. All responsive CSS goes into the existing `public/assets/style.css`. The PWA manifest is a plain JSON file served by the existing `@fastify/static` configuration.

**Core technologies:**

- `web-push` 3.6.7: Server-side VAPID key generation and push message dispatch — de facto Node.js standard for the Web Push Protocol (RFC 8030/8292); handles JWT signing, encryption, and FCM/APNs routing
- Workbox 7.4.0 (CDN): Service worker caching strategies — avoids manual cache versioning and stale content cleanup; CDN import via `importScripts` bypasses the need for a bundler; URL pinned to exact version
- Static `manifest.json`: PWA manifest with name, icons (192×192 and 512×512 PNG), `start_url`, `display: standalone`, `theme_color` — zero dependencies, served from `public/` by existing `@fastify/static`
- Media queries in `public/assets/style.css`: All responsive layout additions — no CSS framework, no build step, additive to existing styles
- `dvh` units for full-height mobile layouts: Avoids the iOS Safari `vh` bug where 100vh includes the hidden address bar, causing overflow; `dvh` supported from iOS 15.4+

**Critical requirements:**

- iOS 16.4+ required for push notifications; older versions silently fail with no error thrown
- `/sw.js` must be served with `Cache-Control: no-cache` in `vercel.json` — otherwise updated service workers are not detected by the browser
- Workbox CDN URL must be pinned to `releases/7.4.0/` — an unpinned URL silently updates Workbox and may break caching behaviour
- VAPID private key must be stored as a Vercel environment variable only — never committed to git

### Expected Features

**Must have (table stakes for v1.1 — missing any makes mobile feel broken):**

- Responsive layout with no horizontal scrolling at any viewport width
- Bottom tab bar navigation at ≤ 768px (hamburger menus are considered poor mobile UX since iOS 7 / Material Design)
- Touch targets ≥ 44×44px on all interactive elements (Apple HIG; WCAG 2.5.5)
- Input `font-size` ≥ 16px — iOS Safari auto-zooms on smaller inputs and breaks layout, requiring manual zoom-out
- Horizontal scroll on data tables — cost-effective fix for 8-column task and skills tables
- Approve/Regenerate actions reachable within 2 taps from the home screen install
- PWA `manifest.json` with correct icons, `display: standalone`, `start_url`
- Service worker with static asset caching (CSS, JS, icons) — required for Android install prompt and for push notifications

**Should have (differentiators that solve real AM pain points):**

- Push notifications for draft ready, QA failure, and task status changes — eliminates polling and closes the feedback loop immediately
- Offline draft viewing (read-only) — AMs reviewing in dental practices with poor signal
- In-browser install prompt/banner — most users do not discover "Add to Home Screen" without prompting
- Badge count on home screen icon — shows pending approval count without opening the app

**Defer to v1.2:**

- Swipe gestures on task cards (approve/regenerate via swipe — higher complexity, low frequency)
- Background sync (iOS support unreliable; not justified for this tool)
- Task creation on mobile (desktop-only workflow; building a full mobile creation form adds complexity for negligible real-world usage)

### Architecture Approach

The PWA layer sits entirely on top of the existing architecture. No existing routes, templates, or database tables are modified except `base.eta` (add manifest link, SW registration, Apple meta tags, mobile menu button) and `style.css` (responsive additions). All new components are additive.

**Major components:**

1. **Service worker (`public/sw.js`)** — Intercepts all fetch requests; routes static assets through CacheFirst, full-page navigations and HTMX partials through NetworkFirst, POST requests and push API calls through NetworkOnly; handles push events and shows OS-level notifications via `self.registration.showNotification`; routes `notificationclick` to the relevant app page; uses Workbox CDN for caching strategy implementations
2. **PWA manifest (`public/manifest.json`)** — Enables home screen installation; contains app name, icons, `start_url`, `display: standalone`, `theme_color`, `background_color`; Apple-specific meta tags in `base.eta` supplement this for iOS Safari
3. **Push API routes (`web/routes/push.ts`)** — Accept push subscriptions via `POST /api/push/subscribe`, store in `push_subscriptions` table, dispatch notifications via `web-push.sendNotification()` on task events, prune stale subscriptions on 410 response from push service
4. **Push subscriptions table** — Per-user, per-device storage: `user_id` FK, `endpoint` (UNIQUE constraint — one row per device, multiple rows per user), `p256dh`, `auth`, `ua_hint`, `created_at`, `last_used`
5. **Responsive CSS additions** — Sidebar hidden at ≤ 768px; bottom tab bar (`position: fixed; bottom: 0`) shown at ≤ 768px; `env(safe-area-inset-bottom)` for iPhone notch/home indicator clearance; `dvh` for full-height containers

**Highest-risk integration point — HTMX + service worker partial disambiguation:**

HTMX partial requests carry an `HX-Request: true` header. The service worker must check this header before selecting a fallback strategy. If a full-page HTML response is served to an HTMX swap target, the entire `<html>` document is injected into the target element, breaking the page. The service worker uses `request.headers.get('HX-Request')` to branch: HTMX partials get `offline-partial.html`; full-page navigations get `offline.html`. This is the single most important implementation detail in the PWA layer.

### Critical Pitfalls

**PWA-specific (v1.1):**

1. **Full-page HTML served to HTMX swap target offline** — Check `HX-Request: true` header in the service worker before selecting offline fallback; serve `offline-partial.html` for partials, `offline.html` for full-page navigations; never cross-serve. This is the highest-risk integration failure in this milestone.

2. **Service worker served from a subdirectory** — If `sw.js` is served from `/assets/sw.js`, its scope is limited to `/assets/` and it cannot intercept requests for `/`, `/dashboard`, `/clients`, etc. It must be served at `/sw.js` (root). `@fastify/static` already serves `public/` at the root — no configuration change needed, but the file must be placed at `public/sw.js`.

3. **Service worker cached by the CDN or browser** — Without `Cache-Control: no-cache` on `/sw.js` in `vercel.json`, browsers serve the old service worker and updated versions are not detected. This is a silent failure — the app appears to work but never updates.

4. **One push subscription row per user** — Staff access VendoOS from multiple devices. A UNIQUE constraint on `user_id` would overwrite the subscription from the first device. The UNIQUE constraint must be on `endpoint` only.

5. **Push permission prompt on first page load** — Browsers auto-suppress or auto-deny immediate push permission prompts; first-visit opt-in rates are below 5%. Trigger the permission request after a meaningful event — ideally when the first task completes and a draft is waiting.

6. **VAPID private key in source control** — The private key is server-only and must never be committed. Store as `VAPID_PRIVATE_KEY` env var in Vercel. The public key is safe to expose in client JS (it is public by design).

**From v1 skills layer research (earlier milestone, recorded for completeness):**

7. **Drive webhook channels expire silently** — Google sends no expiry notification; channels expire after max 7 days. Must be renewed proactively via a daily cron job; store expiry timestamps in the database; overlap old and new channels by one hour to prevent notification gaps.

8. **pageToken loss on Vercel cold start** — The Drive Changes API token must be persisted to the database after every successful poll; in-memory storage is lost between serverless invocations.

9. **Wrong client's SOP or brand data injected into agent context** — Enforce `client_id` filtering at the database query level, never in application logic after retrieval. Add a unit test that proves client B's data cannot appear in client A's task context.

10. **Unbounded QA retry loop** — Hard cap at 2 retries (3 total attempts); on third failure save best attempt as `draft_review_required`. QA failure rate above 30% signals a calibration problem, not a content problem.

---

## Implications for Roadmap

The feature dependency chain within v1.1 is clear and strictly ordered. Each phase is independently deployable and testable before the next begins.

### Phase 1: Responsive Layout

**Rationale:** Pure CSS changes with no new technology, no new dependencies, and no deployment risk. Must come first because all other phases assume a usable mobile layout exists. The bottom tab bar navigation structure also informs which links to include in `base.eta`, which is modified in Phase 2.

**Delivers:** A functional, non-broken mobile experience. Sidebar collapses to a slide-over drawer. Bottom tab bar appears at ≤ 768px. Tables scroll horizontally. Touch targets meet the 44px minimum. Inputs do not trigger iOS zoom. Full-height containers use `dvh` not `vh`.

**Features addressed:** Responsive layout, bottom tab bar, touch targets ≥ 44px, input `font-size` ≥ 16px, horizontal table scroll, approve/regenerate accessible on mobile.

**Pitfalls to avoid:** Use `dvh` not `vh` for full-height containers; use `env(safe-area-inset-bottom)` for iPhone notch/home indicator clearance; do not add Tailwind or any CSS framework (build pipeline cost is not justified).

**Research flag:** Standard CSS patterns — no additional research needed. Build directly.

---

### Phase 2: PWA Foundation (Manifest + Service Worker Shell)

**Rationale:** Manifest and a minimal service worker unlock the "Add to Home Screen" install prompt on Android and satisfy Lighthouse PWA installability requirements. Must be in place before push notifications can work: iOS requires home screen install for push; Android requires a service worker for the install prompt to appear. Keep this phase minimal — static asset caching only — to validate the service worker is deployed and functioning before extending it with full-page request interception.

**Delivers:** Installable PWA. VendoOS appears on the home screen with the correct icon and name. The app launches in standalone mode (no browser chrome). Static assets (CSS, HTMX JS, icons) are cached and load instantly on subsequent visits. In-browser install banner/prompt is included here (low complexity, same base.eta modification pass).

**Stack elements used:** `public/manifest.json`, `public/icons/icon-192.png` and `icon-512.png`, Workbox 7.4.0 CDN in `sw.js`, `vercel.json` no-cache header for `/sw.js`, Apple meta tags in `base.eta`, `navigator.serviceWorker.register('/sw.js')` in `base.eta`.

**Pitfalls to avoid:** Service worker at `/sw.js` not a subdirectory; `Cache-Control: no-cache` on `sw.js` in `vercel.json`; Workbox CDN URL pinned to exact version `7.4.0`; do not add full-page request interception in this phase — validate static caching first.

**Research flag:** Standard patterns, well-documented. No additional research needed.

---

### Phase 3: Offline Caching

**Rationale:** Extends the Phase 2 service worker with NetworkFirst strategies for full-page navigations and HTMX partials, plus dedicated offline fallback responses. Separated into its own phase because the HTMX + service worker integration is the highest-risk component of the entire milestone — it warrants isolated testing before push notification complexity is added on top.

**Delivers:** Graceful offline experience. Cached pages load on poor signal. HTMX partials fall back to an offline partial snippet rather than a broken swap. Full-page navigations fall back to `offline.html`. A clear "you are offline" indicator appears when connectivity is lost and an action is attempted.

**Features addressed:** Offline draft viewing (read-only), offline indicator, cached navigation.

**Architecture components:** `public/offline.html`, `public/offline-partial.html`, NetworkFirst routing in `sw.js` with `HX-Request` header check, POST requests are always NetworkOnly.

**Pitfalls to avoid:** This phase is where pitfall 1 (full-page HTML served to HTMX swap target) must be implemented and tested correctly. Test the offline fallback in an offline simulation against the actual VendoOS template structure before shipping. POST requests must never be cached or queued — show an error and let the user retry.

**Research flag:** Pattern is documented and understood. Key implementation requirement: verify that `HX-Request: true` is present on all `hx-get` and `hx-post` requests in the actual VendoOS codebase. Check `base.eta` for any global HTMX configuration that might suppress request headers.

---

### Phase 4: Push Notification Infrastructure

**Rationale:** The most substantial engineering phase in v1.1. New backend work: VAPID keys, `push_subscriptions` table, push API routes, `web-push` library, and service worker `onpush` handler. All notification types (draft ready, QA failure, task status changes) share the identical infrastructure — implement them all in one pass rather than in separate phases.

**Delivers:** AMs receive OS-level notifications on their phone when tasks complete or fail QA. No polling required. Badge count on the home screen icon shows pending approvals. Push subscriptions are managed per-device, pruned automatically on 410 response. Permission is requested after the first task completes rather than on page load.

**Features addressed:** Push notifications — draft ready, QA failure, task status changes. Badge count API (low-complexity add-on once push infrastructure is working).

**Stack elements used:** `web-push` 3.6.7, `@types/web-push`, `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT` as Vercel environment variables, `push_subscriptions` table migration, `web/routes/push.ts`, `web/lib/push.ts`, `onpush` and `notificationclick` handlers in `sw.js`.

**Pitfalls to avoid:** VAPID private key must not be committed to git; UNIQUE constraint on `endpoint` not `user_id`; push permission requested after meaningful trigger not on first page load; prune subscriptions on 410 response; keep notification title + body under 200 characters for iOS payload limit compatibility.

**Research flag:** VAPID + Vercel serverless is a standard pattern — well-documented. iOS Safari push behaviour carries MEDIUM confidence (Apple has changed behaviour without notice historically). Validate on a real iOS device running iOS 16.4+ early in Phase 4, not as a final step before release. Do not rely on simulator testing for push.

---

### Phase Ordering Rationale

- **CSS before PWA manifest:** No point making VendoOS installable before the layout is usable on mobile. The install prompt should not appear when the experience is broken.
- **Manifest + SW shell before offline caching:** Offline caching extends the Phase 2 service worker. The service worker must be stable and deployed before extending it with NetworkFirst strategies and offline fallback files.
- **Offline caching before push:** The `onpush` handler lives in the same service worker file. The service worker must be fully functional and tested (specifically the HTMX integration) before push complexity is added.
- **All notification types in one phase:** Draft ready, QA failure, and task status notifications share identical infrastructure (VAPID, subscriptions table, push routes, `onpush` handler). Splitting them across phases doubles the setup cost for no benefit.

### Research Flags

**Needs validation during implementation:**

- **Phase 3 (Offline Caching):** Verify `HX-Request: true` header is present on all HTMX requests in the actual VendoOS codebase before relying on it for SW strategy branching. Check global HTMX config in `base.eta`. Test the offline partial fallback in a real offline simulation against the live template structure.
- **Phase 4 (Push):** Test iOS push on a real physical device (iPhone, iOS 16.4+) early in Phase 4. Do not leave real-device validation until the end. Apple's push implementation has changed without notice; simulator behaviour is not representative.

**Standard patterns — no additional research needed:**

- **Phase 1 (Responsive CSS):** Established CSS patterns; nothing novel.
- **Phase 2 (PWA Manifest + SW Shell):** Workbox and manifest spec are well-documented; straightforward implementation.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core choices verified against official Google, MDN, Vercel, and npm documentation. Workbox 7.4.0 confirmed on npm. web-push 3.6.7 confirmed. One MEDIUM caveat: iOS Safari push behaviour (Apple changes implementation without notice). |
| Features | HIGH | Mobile table stakes are industry-established patterns with strong data backing (Web Almanac 2025, Apple HIG, Material Design). PWA feature set derived from official specs and cross-referenced sources. iOS constraints documented across multiple authoritative sources. |
| Architecture | HIGH | Component boundaries are clear and additive. HTMX + service worker integration pattern is documented by authoritative sources (Philip Walton, HTMX GitHub issues). Main risk is execution correctness, not pattern validity. |
| Pitfalls | HIGH for PWA pitfalls; MEDIUM for iOS-specific behaviour | PWA anti-patterns verified against official docs. iOS-specific push behaviour carries MEDIUM due to Apple's history of undocumented changes. |

**Overall confidence:** HIGH

### Gaps to Address

- **iOS push on real hardware:** Research is MEDIUM confidence for iOS-specific push behaviour. Validate on a physical device (iOS 16.4+) early in Phase 4 before building out the full notification dispatch. Simulator testing is not sufficient.
- **HTMX `HX-Request` header presence:** Research confirms the pattern; implementation must verify the header is present on all `hx-get` and `hx-post` requests in the actual VendoOS codebase. Check `base.eta` for any global HTMX configuration that might suppress headers.
- **EU market iOS behaviour:** iOS 17.4+ in the EU opens installed PWAs in a Safari tab rather than standalone mode, which blocks push notifications for EU users. If any Vendo staff are on EU-region devices, push will not work for them on iOS. Accept as a known limitation; do not build a fallback polling system.
- **Token encryption key rotation (pre-existing concern from CONCERNS.md):** This affects the v1 skills layer milestone, not v1.1. Must be resolved before Drive sync is built to prevent OAuth tokens becoming unrecoverable during any future key rotation. Flagged here for visibility.

---

## Sources

### Primary (HIGH confidence)

- [MDN: Making PWAs Installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) — manifest requirements, service worker requirement for installability
- [Chrome Developers: Workbox Caching Strategies Overview](https://developer.chrome.com/docs/workbox/caching-strategies-overview) — CacheFirst, NetworkFirst, StaleWhileRevalidate patterns
- [Chrome Developers: workbox-sw CDN import](https://developer.chrome.com/docs/workbox/modules/workbox-sw) — CDN import pattern for non-bundled environments
- [Apple Developer: Sending Web Push in Web Apps and Browsers](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers) — iOS Safari push requirements
- [web-push npm](https://www.npmjs.com/package/web-push) — version 3.6.7, VAPID key generation, Node.js usage
- [MDN: Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) — subscription lifecycle, `onpush` event, `notificationclick`
- [Vercel: Cache-Control Headers](https://vercel.com/docs/caching/cache-control-headers) — service worker no-cache requirement, confirmed March 2026
- [Philip Walton: Smaller HTML Payloads with Service Workers](https://philipwalton.com/articles/smaller-html-payloads-with-service-workers/) — HTMX + service worker partial disambiguation pattern
- [PWA | 2025 | Web Almanac by HTTP Archive](https://almanac.httparchive.org/en/2025/pwa) — PWA adoption data, mobile traffic patterns for B2B tools
- [MDN: Offline and background operation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation) — offline caching patterns, Background Sync limitations

### Secondary (MEDIUM confidence)

- [MagicBell: PWA iOS Limitations 2026](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) — iOS push constraints, iOS 16.4+ requirement, EU PWA behaviour
- [Brainhub: PWA on iOS — Current Status 2025](https://brainhub.eu/library/pwa-on-ios) — iOS Safari behaviour, install flow differences
- [HTMX GitHub Issue #1445: HTMX and service workers](https://github.com/bigskysoftware/htmx/issues/1445) — community confirmation of fetch interception approach and `HX-Request` header strategy
- [MagicBell: Offline-First PWAs](https://www.magicbell.com/blog/offline-first-pwas-service-worker-caching-strategies) — strategy selection rationale, HTMX integration notes
- [Progressier: PWA Capabilities 2026](https://progressier.com/pwa-capabilities) — current platform support table, iOS 26 improvement note

---

*Research completed: 2026-04-06*
*Ready for roadmap: yes*
