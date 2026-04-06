# Roadmap: VendoOS Mobile & PWA (v1.1)

## v1.0 Complete

Milestone v1.0 (Skills Layer) completed 2026-04-02. Phases 1–10 all code-complete. See git history for phase plans and implementation notes. Production data population (brand:reindex + drive:reindex against Turso) pending after DRIVE_FOLDER_BRANDS env var is configured on Vercel.

---

## Overview

v1.1 adds a mobile and PWA layer on top of the existing Fastify + Eta + HTMX dashboard. No framework changes. No new build pipeline. Everything is additive: responsive CSS additions, a static manifest, a Workbox-powered service worker, `web-push` for server-side notifications, and a `push_subscriptions` table. The build order is strictly dependency-sequenced — responsive layout first (no new tech), PWA manifest and service worker shell second (enables installs), offline caching third (extends the service worker — highest-risk integration), push notifications fourth (new backend work on stable service worker foundation).

The core mobile use case is read-and-approve. AMs use their phones to check task status, review AI-generated drafts, and approve or reject — not to create tasks.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order. v1.1 continues from v1.0 Phase 10.

- [x] **Phase 11: Responsive Layout** - Mobile viewport, bottom tab bar, touch targets, table reflow, swipe and pull-to-refresh gestures (completed 2026-04-06)
- [x] **Phase 12: PWA Foundation** - Manifest, service worker shell, static asset caching, home screen install (completed 2026-04-06)
- [x] **Phase 13: Offline Caching** - Full-page and HTMX partial caching, offline fallback pages, Vary header (completed 2026-04-06)
- [ ] **Phase 14: Push Notifications** - VAPID keys, push subscriptions, draft-ready/QA-failure/status-change notifications, dead subscription pruning

## Phase Details

### Phase 11: Responsive Layout
**Goal**: VendoOS is fully usable on a mobile browser — no horizontal scrolling, touch-sized targets, intuitive navigation, and interactive gestures for the read-and-approve workflow
**Depends on**: Phase 10 (v1.0 AM Interface complete)
**Requirements**: RESP-01, RESP-02, RESP-03, RESP-04, RESP-05, RESP-06, RESP-07, RESP-08, RESP-09, RESP-10
**Success Criteria** (what must be TRUE):
  1. Every page can be viewed and used on a 375px-wide mobile screen with no horizontal scrollbar appearing at any point
  2. On a screen below 768px, the sidebar is hidden and a fixed bottom tab bar appears with navigation to the 4-5 main sections, with each tab target meeting the 48px minimum
  3. Data tables (task list, skills browser) reflow to a stacked card layout on mobile — no table scrolling or cut-off columns
  4. The task submission form and draft review page are fully usable on mobile — all inputs, selects, buttons, and structured output visible without zooming
  5. On the task list, a user can swipe left/right to navigate between sections and pull down to trigger a refresh
**Plans:** 3/3 plans complete

Plans:
- [ ] 11-01-PLAN.md — Global viewport reset, bottom tab bar, More overlay
- [ ] 11-02-PLAN.md — Table-to-card reflow (tasks + clients), form and draft review mobile fixes
- [ ] 11-03-PLAN.md — Swipe navigation, card swipe actions, pull-to-refresh

### Phase 12: PWA Foundation
**Goal**: VendoOS is installable to the home screen on Android and iOS, opens in standalone mode without browser chrome, and loads static assets instantly on repeat visits
**Depends on**: Phase 11
**Requirements**: PWA-01, PWA-02, PWA-03, PWA-04
**Success Criteria** (what must be TRUE):
  1. An Android user sees the browser's "Add to Home Screen" prompt automatically and can install VendoOS to their home screen
  2. An iOS user sees an in-app banner with instructions to use "Share > Add to Home Screen" and can complete installation manually
  3. After installation, tapping the home screen icon opens VendoOS in standalone mode — no browser address bar, no back/forward buttons
  4. Static assets (CSS, HTMX JS, icons) load from the service worker cache on a second visit, not from the network
**Plans:** 2/2 plans complete

Plans:
- [ ] 12-01-PLAN.md — Manifest, icons, service worker, base.eta patches, vercel.json routes
- [ ] 12-02-PLAN.md — Settings page Install App section with platform detection

### Phase 13: Offline Caching
**Goal**: When an AM loses signal (common in dental practices), previously visited pages and drafts remain readable, HTMX partial requests fall back gracefully, and a clear offline indicator is shown when a live action is attempted
**Depends on**: Phase 12
**Requirements**: OFFL-01, OFFL-02, OFFL-03, OFFL-04, OFFL-05
**Success Criteria** (what must be TRUE):
  1. A previously visited full page (e.g. the task list or a draft review) loads correctly when the device is offline
  2. An HTMX partial request made while offline renders an appropriate offline partial snippet in the swap target — not a full HTML document injected into the page (which would corrupt it)
  3. When no cached version of a requested page exists, a branded "You are offline" page is shown, not a browser error
  4. All Fastify routes return a `Vary: HX-Request` header, enabling the service worker to cache full-page and partial responses separately
**Plans:** 2/2 plans complete

Plans:
- [ ] 13-01-PLAN.md — Vary: HX-Request header, offline.html fallback page, offline-partial.html snippet
- [ ] 13-02-PLAN.md — Service worker NetworkFirst routes for pages and HTMX partials, precaching

### Phase 14: Push Notifications
**Goal**: AMs receive OS-level push notifications on their phone when tasks complete, fail QA, or change status — no polling required — with push subscriptions managed per-device and pruned automatically
**Depends on**: Phase 13
**Requirements**: PUSH-01, PUSH-02, PUSH-03, PUSH-04, PUSH-05, PUSH-06, PUSH-07
**Success Criteria** (what must be TRUE):
  1. When a draft is ready for review, the AM who submitted the task receives a push notification on their phone within seconds of the task completing
  2. When a task fails QA after all retries, the AM receives a push notification with the task name and failure reason
  3. A user on iOS who has installed VendoOS to their home screen on iOS 16.4+ can subscribe to push notifications; a user who has not installed it sees an install prompt with instructions rather than a broken permission request
  4. When a push subscription is no longer valid (HTTP 410 from the push service), it is automatically removed from the database — no stale subscriptions accumulate
  5. A single user can subscribe from multiple devices and receive notifications on all of them independently
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 11 -> 12 -> 13 -> 14

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 11. Responsive Layout | 3/3 | Complete    | 2026-04-06 |
| 12. PWA Foundation | 2/2 | Complete    | 2026-04-06 |
| 13. Offline Caching | 2/2 | Complete    | 2026-04-06 |
| 14. Push Notifications | 0/? | Not started | - |
