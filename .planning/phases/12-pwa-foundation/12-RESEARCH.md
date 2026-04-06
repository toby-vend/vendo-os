# Phase 12: PWA Foundation - Research

**Researched:** 2026-04-06
**Domain:** Progressive Web App — manifest, service worker, install UX, icons
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**App Identity**
- App name on home screen: "VendoOS" (one word, no space)
- Short name: "VendoOS"
- Theme colour: dark background (#0B0B0B) with Vendo green (#22C55E) as `theme_color` for status bar tint
- Background colour: #0B0B0B (splash screen background)
- Display mode: standalone
- Start URL: `/` (dashboard)
- Orientation: any (portrait and landscape both supported)

**Install Prompt UX**
- No automatic install banner — install instructions live on the Settings page only
- Settings page gets a new "Install App" section with platform-detected instructions
- Android: shows native `beforeinstallprompt` button if available, or manual instructions
- iOS: shows "Tap Share → Add to Home Screen" with step-by-step text
- If user dismisses or ignores, section remains in Settings (always accessible)
- Already-installed users (standalone mode detected): section shows "App installed ✓" instead

**Icons**
- Generate 192px and 512px PNG icons matching the existing sidebar logo-icon style
- Green "V" letter on dark (#0B0B0B) background with rounded corners
- Also generate maskable versions (with safe-area padding) for Android adaptive icons
- Use the existing Manrope 700 font weight for the "V" character
- favicon.svg already exists — keep it, add PNG icons alongside

**Service Worker**
- Workbox 7.4.0 loaded via CDN `importScripts` in `sw.js`
- `sw.js` served from `public/` at root path
- `vercel.json` header: `Cache-Control: no-cache` on `/sw.js`
- Static asset caching only in this phase (CSS, JS, icons, fonts) — CacheFirst strategy
- Navigation/HTML caching deferred to Phase 13

### Claude's Discretion
- Exact Workbox caching strategy configuration (route matching, cache names)
- Service worker lifecycle management (skipWaiting, clientsClaim)
- How to detect standalone mode for the "already installed" check
- Splash screen icon sizing and padding
- Whether to precache Manrope font or let it cache on first load

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PWA-01 | Web app manifest exists with app name, icons (192px + 512px), theme colour, display: standalone | Manifest JSON spec confirmed; all required fields documented below |
| PWA-02 | Service worker registers on first page load | SW registration pattern for base.eta confirmed; global registration (not mobile-only) required |
| PWA-03 | App is installable to home screen on Android (auto-prompt) and iOS (manual banner with instructions) | `beforeinstallprompt` event API confirmed; iOS manual flow documented; Settings-only placement confirmed correct |
| PWA-04 | Installed app opens in standalone mode without browser chrome | `display: standalone` in manifest; Apple meta tags in base.eta; standalone detection via `matchMedia` confirmed |

</phase_requirements>

---

## Summary

Phase 12 adds the PWA foundation to VendoOS: a web app manifest, app icons, a minimal service worker (static asset caching only), and an install section on the Settings page. The approach is strictly additive — no new npm dependencies, no build pipeline changes, no modifications to existing routes or database tables.

The existing codebase is already well-prepared. Phase 11 completed the responsive layout and mobile tab bar. `base.eta` already has `viewport-fit=cover` in the viewport meta tag (required for safe-area insets) and the inline `<script>` block where SW registration can be appended. `@fastify/static` already serves `public/` at root — placing `sw.js` and `manifest.json` there requires no server configuration changes.

The one non-obvious implementation detail is the `vercel.json` structure. The existing file uses the legacy `"builds"` + `"routes"` config format. The no-cache header for `/sw.js` cannot be added via a top-level `"headers"` array in the same file (the `"headers"` top-level key is a newer config pattern incompatible with the legacy `"builds"` key). Instead, the route for `/sw.js` must be added to the existing `"routes"` array with an inline `"headers"` property, placed before the catch-all route.

**Primary recommendation:** Write `public/manifest.json`, generate PNG icons via a script, add `public/sw.js` with Workbox CDN CacheFirst for static assets, patch `base.eta` with four additions (manifest link, Apple meta tags, SW registration), patch `settings.eta` with the install section, and update `vercel.json` with a `/sw.js` route entry.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Workbox (CDN) | 7.4.0 | Service worker caching strategies | Google-maintained; CDN `importScripts` pattern is the correct approach for non-bundled stacks; avoids manual cache versioning |
| Static `manifest.json` | — | PWA install metadata | Zero-dependency; served by existing `@fastify/static`; plain JSON |
| `sharp` (Node.js) | latest | Generate PNG icons from SVG or canvas | Available in Node.js; used to create 192/512/maskable PNGs programmatically |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `canvas` / Node.js `createCanvas` | — | Draw "V" icon programmatically | If sharp alone is insufficient; alternatively generate via a one-off script and commit the PNGs |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Workbox CDN | Workbox npm + bundler | npm requires adding Vite/webpack — not justified for this stack |
| Manual icon generation script | Figma export / browser canvas | Script is reproducible and keeps assets in version control |

**Installation:**

No new npm packages needed for Phase 12. Icon generation is a one-time script using Node.js built-ins or `sharp` (dev-only).

---

## Architecture Patterns

### Files Created / Modified

```
public/
├── sw.js                     NEW — service worker (Workbox CDN CacheFirst)
├── manifest.json             NEW — PWA manifest
└── assets/
    ├── favicon.svg           UNCHANGED
    ├── icon-192.png          NEW — PWA icon 192×192
    ├── icon-512.png          NEW — PWA icon 512×512
    ├── icon-maskable-192.png NEW — maskable variant 192×192
    └── icon-maskable-512.png NEW — maskable variant 512×512

web/views/
├── layouts/base.eta          MODIFIED — manifest link, Apple meta tags, SW registration
└── settings.eta              MODIFIED — new "Install App" section

vercel.json                   MODIFIED — /sw.js route with Cache-Control
```

### Pattern 1: Web App Manifest

**What:** Static JSON file declaring app identity for the browser's install mechanism.
**When to use:** Required for PWA installability on all platforms.

```json
// public/manifest.json
{
  "name": "VendoOS",
  "short_name": "VendoOS",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0B0B0B",
  "theme_color": "#22C55E",
  "orientation": "any",
  "icons": [
    { "src": "/assets/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/assets/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/assets/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### Pattern 2: base.eta Head Additions

**What:** Four additions to the `<head>` in `base.eta` enabling PWA behaviour on all platforms.
**When to use:** Must be present on every page served — goes in the layout template.

```html
<!-- After existing <link rel="icon"> line -->
<link rel="manifest" href="/manifest.json">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="apple-touch-icon" href="/assets/icon-192.png">
```

Note: `viewport-fit=cover` is already present in the existing viewport meta tag — no change needed there.

### Pattern 3: Service Worker Registration

**What:** Register `sw.js` globally (not inside the `if (window.innerWidth <= 768)` mobile-only guard). PWA installability requires a service worker on all platforms including desktop Chrome.
**When to use:** Appended to the existing `<script>` block in `base.eta`, outside the mobile-only `if` block.

```javascript
// Source: MDN Service Worker API
// Place OUTSIDE the `if (window.innerWidth <= 768)` block
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js')
      .catch(function(err) { console.warn('SW registration failed:', err); });
  });
}
```

**Critical:** Registration must be outside the mobile-only guard. Desktop Chrome also needs the service worker for Android-Chrome-on-desktop install prompts and for general PWA compliance.

### Pattern 4: Service Worker — Static Asset CacheFirst

**What:** `sw.js` with Workbox CDN, CacheFirst strategy for static assets only. Navigation requests pass through to the network (Phase 13 adds offline caching).

```javascript
// public/sw.js
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.4.0/workbox-sw.js');

workbox.core.skipWaiting();
workbox.core.clientsClaim();

// Static assets — CacheFirst with 30-day expiry
workbox.routing.registerRoute(
  ({ request }) =>
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image' ||
    request.destination === 'font',
  new workbox.strategies.CacheFirst({
    cacheName: 'vendo-static-v1',
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
);

// All other requests (navigation, API, HTMX partials) — pass through to network
// Phase 13 adds NetworkFirst + offline fallback here
```

**Why `skipWaiting` + `clientsClaim`:** Ensures updated service workers activate immediately without requiring a tab reload. For an internal tool where developers push updates frequently, this prevents staff from being stuck on a stale SW version.

### Pattern 5: Install Section in settings.eta

**What:** Platform-aware install instructions added as a new card in settings.eta.
**When to use:** The install UI logic runs client-side; the card is always rendered by the server (no server-side platform detection needed).

```html
<!-- New card appended to settings.eta -->
<div class="card" style="padding: 1.5rem; margin-top: 1.5rem;" id="install-app-section">
  <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 1rem;">Install App</h3>
  <div id="install-content">
    <!-- Populated by inline script below -->
  </div>
</div>

<script>
(function() {
  var el = document.getElementById('install-content');
  if (!el) return;

  // Already installed
  if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
    el.innerHTML = '<p style="font-size:14px;color:#22C55E;">App installed ✓</p>';
    return;
  }

  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  var isAndroid = /android/i.test(navigator.userAgent);

  if (isIOS) {
    el.innerHTML = '<p style="font-size:14px;color:#E2E8F0;line-height:1.6;">'
      + 'To install VendoOS on your home screen:<br>'
      + '1. Tap the <strong>Share</strong> button (box with arrow) in Safari<br>'
      + '2. Scroll down and tap <strong>Add to Home Screen</strong><br>'
      + '3. Tap <strong>Add</strong> to confirm</p>';
    return;
  }

  // Android / Chrome — capture beforeinstallprompt
  if (window._pwaInstallPrompt) {
    el.innerHTML = '<button id="install-btn" style="padding:8px 20px;font-size:14px;'
      + 'color:#0B0B0B;background:#22C55E;border:none;border-radius:8px;cursor:pointer;'
      + 'font-family:var(--vendo-font);font-weight:600;">Add to Home Screen</button>';
    document.getElementById('install-btn').addEventListener('click', function() {
      window._pwaInstallPrompt.prompt();
    });
    return;
  }

  // Generic fallback (desktop or Android without captured prompt)
  el.innerHTML = '<p style="font-size:14px;color:#94A3B8;">Open VendoOS in Chrome on Android '
    + 'and use <strong>Add to Home Screen</strong> from the browser menu.</p>';
})();
</script>
```

The `beforeinstallprompt` event must be captured globally in `base.eta` before the Settings page loads:

```javascript
// In base.eta <script> block, outside mobile guard
window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault();
  window._pwaInstallPrompt = e;
});
```

### Pattern 6: vercel.json — /sw.js Route with Cache-Control

**What:** The existing `vercel.json` uses the legacy `"builds"` + `"routes"` format. The no-cache header for `/sw.js` must be added as a route entry with an inline `"headers"` property, not as a top-level `"headers"` array (which is incompatible with the legacy `"builds"` key).

```json
// Add to "routes" array, BEFORE the catch-all "/(.*)" entry
{ "src": "/sw.js", "headers": { "Cache-Control": "public, max-age=0, must-revalidate" }, "dest": "/public/sw.js" }
```

Also add `/manifest.json` route to avoid it being caught by the catch-all and hitting the Fastify function:

```json
{ "src": "/manifest.json", "dest": "/public/manifest.json" }
```

### Anti-Patterns to Avoid

- **SW registered inside mobile-only guard:** Service workers are needed for desktop PWA installability and cache priming. Do not gate on `window.innerWidth <= 768`.
- **`theme_color` wrong:** `theme_color` in the manifest affects the browser toolbar/status bar colour, not the background. Use `#22C55E` (Vendo green) as specified — this gives the green status bar tint.
- **`purpose: maskable` on the same entry as the standard icon:** Android uses separate entries. Always add maskable as a separate icon object with `"purpose": "maskable"`.
- **Icons placed in `public/icons/` subdirectory:** The existing static assets live in `public/assets/`. Place icons at `public/assets/icon-*.png` to match the existing convention and avoid a new directory.
- **`apple-touch-icon` pointing to a non-existent path:** iOS will fall back to a screenshot if the touch icon is missing or returns 404. Verify the path is correct before testing on device.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cache versioning and cleanup | Manual cache names + version bumps in SW | Workbox ExpirationPlugin | Workbox handles stale cache cleanup automatically; manual versioning is error-prone |
| CacheFirst strategy | `caches.match()` + `fetch()` fallback | `workbox.strategies.CacheFirst` | Workbox handles cache miss, network fallback, and cache population in one line |
| Platform detection for install UI | UA string parsing from scratch | `navigator.userAgent` regex + `matchMedia('(display-mode: standalone)')` | These are the standard browser APIs; no library needed |

---

## Common Pitfalls

### Pitfall 1: SW Registration Inside Mobile-Only Guard

**What goes wrong:** Service worker only registers on mobile viewports. Desktop Chrome users cannot trigger the `beforeinstallprompt` event; Lighthouse PWA audit fails; static asset caching only works on mobile.
**Why it happens:** Phase 11 added touch gesture code inside `if (window.innerWidth <= 768)` — it's tempting to put SW registration there too.
**How to avoid:** SW registration goes outside the mobile-only guard, directly in the `<script>` block alongside the `beforeinstallprompt` listener.
**Warning signs:** Lighthouse PWA audit fails on desktop; "Add to Home Screen" button never appears on Android.

### Pitfall 2: vercel.json Legacy Format Incompatibility

**What goes wrong:** Adding a top-level `"headers"` array alongside `"builds"` in vercel.json causes the headers to be silently ignored, or causes a deployment error.
**Why it happens:** `"headers"` as a top-level key is part of the newer vercel.json config schema. The existing file uses the legacy `"builds"` key, which cannot be mixed with modern top-level config keys.
**How to avoid:** Add the Cache-Control header inside the existing `"routes"` array as an inline `"headers"` property on the `/sw.js` route entry.
**Warning signs:** Service worker never updates in production even after deploying new `sw.js`.

### Pitfall 3: Manifest Not Served at /manifest.json

**What goes wrong:** `manifest.json` is caught by the Fastify catch-all route `/(.*) → /api/index.ts` and Fastify returns a 404 or HTML error page instead of the JSON manifest.
**Why it happens:** The existing vercel.json routes everything to Fastify via the catch-all. Static files need explicit routes before the catch-all, or they get proxied through Fastify.
**How to avoid:** Add `{ "src": "/manifest.json", "dest": "/public/manifest.json" }` to the routes array before the catch-all.
**Warning signs:** Chrome DevTools shows manifest fetch returning HTML; "Add to Home Screen" prompt never appears.

### Pitfall 4: `sw.js` Served from /assets/ Subdirectory

**What goes wrong:** Service worker scope is limited to `/assets/` — it cannot intercept requests for `/`, `/settings`, `/tasks`, etc.
**Why it happens:** Following the existing pattern of placing assets in `public/assets/`.
**How to avoid:** `public/sw.js` at the root of `public/`, not in `public/assets/`. The manifest and SW are special PWA files — they live at the root, not in assets.
**Warning signs:** SW installs but only intercepts requests under `/assets/`; Workbox logs show no route matches for navigation requests.

### Pitfall 5: Missing maskable Icon Causes Ugly Android Adaptive Icon

**What goes wrong:** Android adaptive icons crop the standard icon into a circle or squircle, cutting off the "V" letter edges.
**Why it happens:** The standard 192/512 icons have no safe-area padding. Without a `maskable` variant, Android applies the mask to the standard icon directly.
**How to avoid:** Generate a maskable variant where the "V" sits within the inner 80% of the canvas (the "safe zone"). Add it as a separate manifest icon entry with `"purpose": "maskable"`.
**Warning signs:** Home screen icon looks clipped on Android; Lighthouse warns about maskable icons.

### Pitfall 6: iOS beforeinstallprompt Assumption

**What goes wrong:** Install button on Settings page never fires on iOS because `beforeinstallprompt` does not exist on iOS Safari.
**Why it happens:** `beforeinstallprompt` is a Chrome/Android-only event. iOS Safari does not implement it.
**How to avoid:** The Settings install section uses `isIOS` detection (UA string) to show manual instructions instead of a button. The button path only runs when `window._pwaInstallPrompt` exists (i.e. the event was captured on Android/Chrome).
**Warning signs:** "Add to Home Screen" button appears on iOS but clicking it does nothing.

---

## Code Examples

### Workbox CDN URL (pinned version)

```javascript
// Source: https://developer.chrome.com/docs/workbox/modules/workbox-sw
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.4.0/workbox-sw.js');
```

**Do not use an unpinned URL.** An unpinned URL silently updates Workbox and may break caching behaviour between deployments.

### Standalone Mode Detection

```javascript
// Source: MDN — Window.matchMedia
// navigator.standalone is iOS Safari-specific (non-standard)
// matchMedia is the standard cross-browser check
var isInstalled =
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;
```

### Maskable Icon Safe Zone

The maskable icon safe zone is the inner 80% of the canvas. For a 512px icon, the "V" must fit within a centred 410px circle. Generate the maskable variant with extra padding around the "V" character.

```
Total canvas:    512 × 512
Safe zone:       410 × 410 (centred)
Padding each side: 51px
```

For a 192px icon:
```
Total canvas:    192 × 192
Safe zone:       154 × 154 (centred)
Padding each side: 19px
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manually coded SW cache strategies | Workbox with strategy classes | 2018 onward | Eliminates cache versioning bugs |
| `beforeinstallprompt` install banner | Settings-page install section (internal tool pattern) | N/A | AMs are onboarded explicitly; no need for auto-prompt |
| `vh` for full-height containers | `dvh` (dynamic viewport height) | iOS 15.4 / Chrome 108 | Fixes iOS Safari address bar overflow |

**Deprecated/outdated:**
- `<meta name="mobile-web-app-capable">`: Chrome deprecated this in favour of the manifest `display` field. Do not add it — use `apple-mobile-web-app-capable` (iOS only) + manifest display.
- Unversioned Workbox CDN URL: Always pin to an exact version in the `importScripts` URL.

---

## Open Questions

1. **Icon generation method**
   - What we know: Need 192px, 512px, and maskable PNG icons with "V" on #0B0B0B background, Manrope 700
   - What's unclear: Whether to generate programmatically (Node.js script) or create manually and commit
   - Recommendation: Write a one-off `scripts/generate-pwa-icons.js` using `sharp` or `canvas` — keeps icons reproducible and matches the "V" exactly to the CSS logo-icon

2. **SW registration on DOMContentLoaded vs load event**
   - What we know: MDN recommends registering on `window.addEventListener('load', ...)` to avoid competing with page resources
   - What's unclear: Whether delaying to `load` is noticeable on a fast internal tool
   - Recommendation: Use `load` event per MDN best practice — the difference is negligible for an internal app

3. **Manrope font precaching**
   - What we know: CONTEXT.md marks this as Claude's discretion; Manrope loads from Google Fonts CDN
   - What's unclear: Whether caching cross-origin Google Fonts responses requires additional CORS headers
   - Recommendation: Do not precache in Phase 12. Let Manrope cache on first load via the CacheFirst strategy matching `request.destination === 'font'`. Phase 13 can revisit if needed.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None currently — Phase 12 adds static files, no server-side logic changes |
| Config file | none |
| Quick run command | `npx tsc --noEmit` (TypeScript check — no TS changes in this phase) |
| Full suite command | `npx tsc --noEmit` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PWA-01 | `manifest.json` exists at `/manifest.json` and contains required fields | smoke | `curl -s http://localhost:3000/manifest.json \| node -e "const m=require('fs').readFileSync('/dev/stdin','utf8'); const j=JSON.parse(m); ['name','icons','display','start_url','theme_color'].forEach(k=>{if(!j[k])throw new Error('missing '+k)}); console.log('OK')"` | ❌ Wave 0 |
| PWA-02 | Service worker registers successfully in browser | manual | Open DevTools → Application → Service Workers | — |
| PWA-03 | `beforeinstallprompt` captured; Settings page shows install section | manual | Load `/settings` on Android Chrome + iOS Safari | — |
| PWA-04 | Installed app opens in standalone mode | manual | Install app, tap home screen icon, verify no browser chrome | — |

### Sampling Rate

- **Per task commit:** `npx tsc --noEmit`
- **Per wave merge:** `npx tsc --noEmit` + manual browser check of `/manifest.json` response
- **Phase gate:** All manual checks passing before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `scripts/generate-pwa-icons.js` — icon generation script (run once, output committed)
- [ ] No test framework gaps — Phase 12 adds only static files and template changes

---

## Sources

### Primary (HIGH confidence)

- [MDN: Making PWAs Installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) — manifest required fields, service worker installability requirement
- [Chrome Developers: workbox-sw CDN import](https://developer.chrome.com/docs/workbox/modules/workbox-sw) — CDN `importScripts` pattern, pinned URL format
- [Chrome Developers: Workbox Caching Strategies](https://developer.chrome.com/docs/workbox/caching-strategies-overview) — CacheFirst configuration, ExpirationPlugin
- [Apple Developer: Configuring Web Applications](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html) — `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-touch-icon`
- [Vercel: Static Configuration (vercel.json)](https://vercel.com/docs/project-configuration/vercel-json) — `headers` within `routes` entries, confirmed 2026
- [MDN: beforeinstallprompt event](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event) — Android/Chrome install prompt API
- [web.dev: Maskable icons](https://web.dev/maskable-icon/) — safe zone specification (inner 80%), maskable purpose field

### Secondary (MEDIUM confidence)

- [web.dev: Add to Home Screen](https://web.dev/customize-install/) — install prompt UX patterns
- [MagicBell: PWA iOS Limitations 2026](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) — iOS Safari `beforeinstallprompt` absence confirmed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Workbox CDN pattern and manifest spec are stable, well-documented
- Architecture: HIGH — all integration points verified against existing codebase (base.eta, vercel.json, public/ structure)
- Pitfalls: HIGH for cross-platform PWA pitfalls; MEDIUM for vercel.json legacy format edge cases

**Research date:** 2026-04-06
**Valid until:** 2026-07-06 (stable PWA specs; Workbox version pinned; re-check if vercel.json is migrated to modern format)
