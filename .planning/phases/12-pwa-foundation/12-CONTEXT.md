# Phase 12: PWA Foundation - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Make VendoOS installable to the home screen on Android and iOS, open in standalone mode without browser chrome, and cache static assets for instant repeat loads. No offline page caching (Phase 13) or push notifications (Phase 14) in this phase.

</domain>

<decisions>
## Implementation Decisions

### App Identity
- App name on home screen: "VendoOS" (one word, no space)
- Short name: "VendoOS"
- Theme colour: dark background (#0B0B0B) with Vendo green (#22C55E) as `theme_color` for status bar tint
- Background colour: #0B0B0B (splash screen background)
- Display mode: standalone
- Start URL: `/` (dashboard)
- Orientation: any (portrait and landscape both supported)

### Install Prompt UX
- No automatic install banner — install instructions live on the Settings page only
- Settings page gets a new "Install App" section with platform-detected instructions
- Android: shows native `beforeinstallprompt` button if available, or manual instructions
- iOS: shows "Tap Share → Add to Home Screen" with step-by-step text
- If user dismisses or ignores, section remains in Settings (always accessible)
- Already-installed users (standalone mode detected): section shows "App installed ✓" instead

### Icons
- Generate 192px and 512px PNG icons matching the existing sidebar logo-icon style
- Green "V" letter on dark (#0B0B0B) background with rounded corners
- Also generate maskable versions (with safe-area padding) for Android adaptive icons
- Use the existing Manrope 700 font weight for the "V" character
- favicon.svg already exists — keep it, add PNG icons alongside

### Service Worker
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

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `public/assets/favicon.svg`: existing SVG favicon — keep as-is
- `public/assets/style.css`: CSS custom properties (--vendo-green: #22C55E, --vendo-bg: #0B0B0B)
- `web/views/layouts/base.eta`: `<head>` section where manifest link tag goes
- `web/views/settings.eta`: settings page where install section will be added

### Established Patterns
- `@fastify/static` serves everything in `public/` — manifest.json and sw.js go there
- `vercel.json` exists for deployment config — add Cache-Control header for sw.js
- Eta SSR templates: install section markup goes directly in settings.eta
- Inline `<script>` in base.eta: SW registration goes here (mobile-only guard already exists)

### Integration Points
- `base.eta <head>`: add `<link rel="manifest" href="/manifest.json">`
- `base.eta <head>`: add `<meta name="apple-mobile-web-app-capable" content="yes">`
- `base.eta <head>`: add `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`
- `base.eta <script>`: SW registration inside existing mobile-only guard or globally
- `settings.eta`: new "Install App" section with platform detection
- `vercel.json`: new header rule for `/sw.js`
- `public/manifest.json`: new file
- `public/sw.js`: new file
- `public/assets/icon-192.png` + `icon-512.png` + maskable variants: new files

</code_context>

<specifics>
## Specific Ideas

- Install instructions on Settings page only — this is an internal tool, AMs will be told to install it during onboarding
- The green V icon should look identical to the sidebar logo-icon — consistent brand recognition on the home screen

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 12-pwa-foundation*
*Context gathered: 2026-04-06*
