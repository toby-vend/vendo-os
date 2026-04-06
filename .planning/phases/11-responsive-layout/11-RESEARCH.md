# Phase 11: Responsive Layout - Research

**Researched:** 2026-04-06
**Domain:** Mobile CSS, touch gestures, bottom tab bar, card reflow — vanilla CSS + vanilla JS on an Eta SSR / HTMX stack
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Bottom tab bar: 4 tabs — Dashboard, Tasks, Clients, More
- Icon + label style (small icon above short text label)
- Fixed at bottom of viewport on screens below 768px
- Active tab highlighted with Vendo green
- "More" tab opens a full-screen nav overlay with all remaining nav sections in a clean list
- Tab bar completely replaces the sidebar on mobile — sidebar hidden, not just collapsed
- Task runs list: full card reflow on mobile — must be fully usable (core AM workflow)
- Client list: full card reflow on mobile
- Other tables: Claude decides per-table based on column count and importance (horizontal scroll acceptable for secondary tables)
- Swiping left/right on the main content area switches between tab bar sections (Dashboard → Tasks → Clients)
- Individual task run cards have swipe actions: swipe right reveals green Approve button, swipe left opens detail view
- Swipe actions only on task run cards
- Pull-to-refresh on task list at minimum
- Full-screen nav page when "More" is tapped — not a slide-out sheet, not a half-screen modal
- Full-screen nav shows all nav groups from sidebarConfig in a clean, scrollable list with the same icons
- `dvh` units needed instead of `vh` for full-height mobile containers
- Input `font-size` must be >= 16px to prevent iOS Safari auto-zoom

### Claude's Discretion
- Card layout density and information hierarchy per table type
- Whether to keep or remove hamburger menu button on mobile
- Which pages beyond task list get pull-to-refresh
- Exact swipe gesture thresholds and animation
- Loading skeleton designs for mobile cards
- How charts adapt on mobile (Chart.js canvas sizing)

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RESP-01 | All pages fit within the mobile viewport with no horizontal scrolling | CSS `overflow-x: hidden` on body + `max-width: 100%` on content wrappers + table → card reflow |
| RESP-02 | Viewport meta tag and mobile-first CSS reset applied globally | Already present in base.eta; audit and harden in the existing `@media (max-width: 768px)` block |
| RESP-03 | Sidebar collapses to a fixed bottom tab bar on screens below 768px | New `.tab-bar` element in base.eta; sidebar gets `display: none` at 768px |
| RESP-04 | Bottom tab bar provides navigation to the 4-5 most-used sections | 4 tabs (Dashboard, Tasks, Clients, More) hardcoded in base.eta markup |
| RESP-05 | All interactive elements have minimum 48px touch targets on mobile | CSS `min-height: 48px; min-width: 48px` on buttons, selects, nav items at 768px |
| RESP-06 | Data tables reflow to a stacked card layout on screens below 768px | `.task-card` and `.client-card` CSS classes; `<table>` hidden at 768px, card list shown |
| RESP-07 | Task submission form is usable on mobile (inputs, selects, buttons all fit) | `font-size: 16px` on inputs; full-width stacked layout already in task-runs/new.eta |
| RESP-08 | Draft review page displays structured output readably on mobile | Audit task-runs/detail.eta; ensure `max-width: 780px` is overridden to `max-width: 100%` + padding on mobile |
| RESP-09 | User can swipe left/right to navigate between sections on mobile | Vanilla JS touch event handler in base.eta script block |
| RESP-10 | User can pull down on task list to trigger a refresh | Vanilla JS `touchstart`/`touchmove`/`touchend` handler triggering HTMX refresh on `#task-rows` |
</phase_requirements>

---

## Summary

VendoOS is an Eta SSR app with no JS build pipeline and a single CSS file (`public/assets/style.css`). All mobile work is additive: new CSS at the bottom of the existing file plus new/modified markup in `web/views/layouts/base.eta` and two Eta partials for the card reflow. There is no bundler, no React, no framework — every gesture and UI component is implemented in vanilla JS and vanilla CSS.

The existing mobile CSS at `@media (max-width: 768px)` has an inverted sidebar collapse bug (sidebar shows by default on mobile because it has no `collapsed` class on load, but the CSS hides it only when `collapsed` is present). Replacing the sidebar entirely with a tab bar eliminates this bug cleanly without touching the existing desktop sidebar logic.

The two hard implementation areas are: (1) the full-screen More overlay (must be CSS-only positioned above everything, with the same sidebarConfig data already available at render time), and (2) the pull-to-refresh handler (must integrate with HTMX's `htmx.trigger()` rather than a native browser mechanism, since there is no service worker yet).

**Primary recommendation:** Implement in five sequential concerns — viewport/global reset, tab bar + More overlay, card reflow (task runs + clients), touch gestures (swipe + pull), then audit individual pages (form, draft review, charts).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla CSS (media queries) | — | Layout + responsive breakpoints | No bundler — everything in style.css |
| Vanilla JS (touch events) | — | Swipe + pull-to-refresh | No React/Vue; JS lives in base.eta script block |
| HTMX | 2.0.4 (CDN) | Trigger partial refresh on pull-to-refresh | Already in stack; `htmx.trigger(el, 'htmx:refresh')` or swap targets |
| Eta SSR | — | Tab bar markup and More overlay rendered server-side | Already in stack; sidebarConfig available in base.eta |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Chart.js | 4.4.7 (CDN) | Existing charts — needs `responsive: true, maintainAspectRatio: false` on mobile | Chart wrapping canvases need `max-height` at 768px |
| CSS `env(safe-area-inset-bottom)` | browser API | iPhone home indicator clearance | Tab bar padding-bottom |
| CSS `dvh` | browser API | Dynamic viewport height (avoids iOS address bar overflow) | Any element using 100vh on mobile |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vanilla JS touch events | Hammer.js | Adds a dependency; touch events are sufficient for 2-direction swipe + pull-to-refresh |
| Full-screen More overlay in Eta SSR | HTMX-loaded overlay | SSR is simpler — sidebarConfig is already available at render time |
| CSS card reflow | Duplicate Eta templates with card markup | Single template with dual rendering (table hidden, cards shown) is cleaner |

**Installation:** No new dependencies required for Phase 11.

---

## Architecture Patterns

### Recommended File Touches
```
web/views/layouts/base.eta      — tab bar HTML, More overlay HTML, updated JS
public/assets/style.css         — all new CSS appended at end (mobile section)
web/views/task-runs/list-rows.eta — add card markup below table; table hidden on mobile
web/views/clients/list-table.eta  — add card markup below table; table hidden on mobile
```

### Pattern 1: Tab Bar in base.eta

**What:** A `<nav class="tab-bar">` element injected directly into `base.eta` before `</body>`, with 4 fixed anchor/button items. It is always in the DOM; CSS hides it on desktop and shows it on mobile.

**When to use:** Any page. The tab bar is global layout.

```html
<!-- Inside base.eta, after .app-layout, before closing </body> -->
<nav class="tab-bar" id="tab-bar" aria-label="Mobile navigation">
  <a href="/" class="tab-item<%= it.currentPath === '/' ? ' active' : '' %>">
    <svg class="tab-icon" ...></svg>
    <span class="tab-label">Dashboard</span>
  </a>
  <a href="/tasks" class="tab-item<%= it.currentPath?.startsWith('/tasks') ? ' active' : '' %>">
    <svg class="tab-icon" ...></svg>
    <span class="tab-label">Tasks</span>
  </a>
  <a href="/clients" class="tab-item<%= it.currentPath?.startsWith('/clients') ? ' active' : '' %>">
    <svg class="tab-icon" ...></svg>
    <span class="tab-label">Clients</span>
  </a>
  <button class="tab-item" onclick="openMoreNav()" aria-label="More navigation">
    <svg class="tab-icon" ...></svg>
    <span class="tab-label">More</span>
  </button>
</nav>

<!-- More overlay — full-screen, built from sidebarConfig at render time -->
<div class="more-nav-overlay" id="more-nav-overlay" aria-hidden="true">
  <div class="more-nav-header">
    <span>Menu</span>
    <button onclick="closeMoreNav()">...</button>
  </div>
  <div class="more-nav-body">
    <% (it.sidebarConfig || []).forEach(function(group) { %>
    <!-- render group items as list rows -->
    <% }) %>
  </div>
</div>
```

**CSS pattern:**
```css
/* === Mobile Tab Bar === */
.tab-bar {
  display: none; /* hidden on desktop */
}

@media (max-width: 768px) {
  /* Hide sidebar entirely */
  .sidebar { display: none !important; }
  .sidebar-backdrop { display: none !important; }
  .mobile-menu-btn { display: none !important; } /* tab bar replaces it */

  /* Show tab bar */
  .tab-bar {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: calc(56px + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    background: var(--glass-bg-strong);
    backdrop-filter: saturate(180%) var(--glass-blur);
    -webkit-backdrop-filter: saturate(180%) var(--glass-blur);
    border-top: 1px solid var(--glass-border);
    z-index: 100;
    justify-content: space-around;
    align-items: stretch;
  }

  .tab-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    min-height: 48px;
    color: var(--vendo-text-muted);
    text-decoration: none;
    font-size: 10px;
    font-weight: 500;
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--vendo-font);
  }

  .tab-item.active, .tab-item:focus { color: var(--vendo-green); }

  .tab-icon { width: 22px; height: 22px; }

  /* Pad main content so it doesn't hide under tab bar */
  .main-content {
    padding-bottom: calc(56px + env(safe-area-inset-bottom) + 1rem);
  }

  /* Full-height with dvh instead of vh */
  .app-layout {
    height: 100dvh;
  }
}
```

### Pattern 2: More Full-Screen Overlay

**What:** A `position: fixed; inset: 0` overlay, `z-index: 300`, shown/hidden with a CSS class toggle via JS. It contains a scrollable list of all sidebarConfig groups and their items.

**When to use:** When "More" tab is tapped on mobile.

```css
@media (max-width: 768px) {
  .more-nav-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: var(--vendo-bg);
    z-index: 300;
    flex-direction: column;
    overflow-y: auto;
  }
  .more-nav-overlay.open {
    display: flex;
  }
  .more-nav-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--glass-border);
    min-height: 56px;
  }
  .more-nav-body {
    flex: 1;
    padding: 0.75rem 0;
    overflow-y: auto;
  }
  .more-nav-item {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 0 1.25rem;
    min-height: 48px;
    color: var(--vendo-text);
    text-decoration: none;
    font-size: 15px;
  }
}
```

```javascript
function openMoreNav() {
  document.getElementById('more-nav-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeMoreNav() {
  document.getElementById('more-nav-overlay').classList.remove('open');
  document.body.style.overflow = '';
}
```

### Pattern 3: Table-to-Card Reflow

**What:** Keep the `<table>` in the template but add a sibling `<div class="card-list mobile-only">` with card markup. CSS shows one and hides the other at the 768px breakpoint.

**Why:** No server-side branching needed. One template serves both desktop (table) and mobile (cards).

```css
@media (max-width: 768px) {
  .desktop-only { display: none !important; }
  .mobile-only  { display: block; }
}
/* On desktop the card list is hidden */
.mobile-only { display: none; }
```

**Task run card shape (compact list card — dense data):**
```html
<div class="task-card mobile-only" onclick="window.location='/tasks/<%= run.id %>'">
  <div class="task-card-header">
    <span class="task-card-client"><%= run.client_name %></span>
    <span class="badge badge-<%= run.status %>"><%= run.status.replace(/_/g,' ') %></span>
  </div>
  <div class="task-card-meta">
    <span class="badge"><%= run.channel.replace(/_/g,' ') %></span>
    <span><%= run.task_type.replace(/_/g,' ') %></span>
  </div>
  <div class="task-card-footer">
    <span style="color:#64748B;font-size:12px"><%= formattedDate %></span>
    <span style="color:#64748B;font-size:12px"><%= run.created_by %></span>
  </div>
</div>
```

**Client card shape:**
```html
<a href="/clients/<%= encodeURIComponent(c.name) %>" class="client-card mobile-only">
  <div class="client-card-row">
    <span class="client-card-name"><%= c.label %></span>
    <span style="width:10px;height:10px;border-radius:50%;background:<%= healthColour %>"></span>
  </div>
  <div class="client-card-row" style="color:#64748B;font-size:12px">
    <span><%= c.vertical || '—' %></span>
    <% if (it.isAdmin && c.health_score != null) { %><span><%= c.health_score %>/100</span><% } %>
  </div>
</a>
```

### Pattern 4: Swipe to Navigate Between Tabs

**What:** On `.main-content`, track `touchstart`/`touchmove`/`touchend`. If horizontal delta > 60px and faster than 300ms, navigate to the adjacent tab.

**Section order (mirrors tab bar):** `/` → `/tasks` → `/clients`

```javascript
(function() {
  var SECTIONS = ['/', '/tasks', '/clients'];
  var currentPath = window.location.pathname;
  var startX, startY, startTime;

  document.addEventListener('touchstart', function(e) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startTime = Date.now();
  }, { passive: true });

  document.addEventListener('touchend', function(e) {
    if (!startX) return;
    var dx = e.changedTouches[0].clientX - startX;
    var dy = e.changedTouches[0].clientY - startY;
    var dt = Date.now() - startTime;
    // Only horizontal swipe: dx dominant and fast enough
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5 || dt > 400) return;
    var idx = SECTIONS.indexOf(currentPath.replace(/\/$/, '') || '/');
    if (idx === -1) return;
    var next = dx < 0 ? SECTIONS[idx + 1] : SECTIONS[idx - 1];
    if (next) window.location.href = next;
    startX = null;
  }, { passive: true });
})();
```

### Pattern 5: Pull-to-Refresh

**What:** On `#task-rows` (the HTMX-polled task list container), detect a pull gesture (finger moves down while already at scroll top). Show a visual indicator, then call `htmx.trigger()` on the container.

```javascript
(function() {
  var PTR_THRESHOLD = 70; // px pull before trigger
  var startY, pulling = false;

  var content = document.querySelector('.main-content');
  if (!content) return;

  content.addEventListener('touchstart', function(e) {
    if (content.scrollTop === 0) {
      startY = e.touches[0].clientY;
      pulling = true;
    }
  }, { passive: true });

  content.addEventListener('touchend', function(e) {
    if (!pulling) return;
    var dy = e.changedTouches[0].clientY - startY;
    if (dy > PTR_THRESHOLD) {
      var target = document.getElementById('task-rows');
      if (target) htmx.trigger(target, 'htmx:refresh');
    }
    pulling = false;
  }, { passive: true });
})();
```

Note: this is a lightweight custom implementation; it fires on the task list page only when `#task-rows` is present in the DOM. It should be guarded: `if (!document.getElementById('task-rows')) return;` before attaching.

### Pattern 6: Task Card Swipe Actions

**What:** Per-card swipe: right-swipe reveals a green Approve action, left-swipe navigates to detail. This is distinct from the page-level navigation swipe.

**Implementation approach:** Each `.task-card` tracks its own `touchstart`/`touchend`. On right-swipe (dx > 60px), translate the card to reveal a `.swipe-action-approve` button behind it. On left-swipe, navigate.

```javascript
function initCardSwipe(card, taskId, isApproveEligible) {
  var startX;
  card.addEventListener('touchstart', function(e) {
    startX = e.touches[0].clientX;
  }, { passive: true });
  card.addEventListener('touchend', function(e) {
    var dx = e.changedTouches[0].clientX - startX;
    if (dx > 60 && isApproveEligible) {
      // reveal approve button (CSS transform)
      card.classList.toggle('swiped-right');
    } else if (dx < -60) {
      window.location.href = '/tasks/' + taskId;
    }
  }, { passive: true });
}
```

CSS for the swipe-reveal:
```css
.task-card-wrapper {
  position: relative;
  overflow: hidden;
  border-radius: 12px;
}
.task-card {
  transition: transform 0.2s ease;
  position: relative;
  z-index: 1;
  background: var(--vendo-surface);
}
.task-card.swiped-right {
  transform: translateX(80px);
}
.swipe-action-approve {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 80px;
  background: var(--vendo-green);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #0B0B0B;
  font-size: 13px;
  font-weight: 600;
  z-index: 0;
}
```

### Anti-Patterns to Avoid

- **Adding `overflow: hidden` to body globally on mobile:** This prevents scrolling in the main content. Use `overflow-y: auto` on `.main-content` instead. The `overflow: hidden` on `body` that exists for the desktop glassmorphism layout must be overridden on mobile.
- **Using `vh` for any full-height mobile container:** iOS Safari's address bar causes `100vh` to overflow. Use `100dvh` instead. `dvh` has broad support (all modern browsers). The existing CSS `height: 100vh` on `.app-layout` must be changed to `100dvh` inside the 768px media query.
- **Inputs with `font-size < 16px`:** iOS Safari auto-zooms the viewport. All `<input>`, `<select>`, `<textarea>` inside `@media (max-width: 768px)` must have `font-size: 16px` minimum. The task form currently sets `font-size: 14px` — this must be overridden.
- **Passive event listener warnings:** Attach touch handlers with `{ passive: true }` for `touchstart`/`touchmove`. If you need to call `preventDefault()` (for pull visual animation), you must register a non-passive listener specifically — do not prevent default inside a passive listener.
- **Tab bar hiding with sidebar collapse logic:** The existing mobile sidebar JS (`toggleSidebar`, `closeSidebar`) must be neutered on mobile. Since the tab bar is CSS-driven and the sidebar is `display: none` on mobile, the JS will run harmlessly (it toggles classes on a hidden element), but the existing `isMobile && !sidebar.classList.contains('collapsed')` branch that sets `backdrop.classList.toggle('visible')` will still run. Guard it: `if (isMobile) return;` at the top of `toggleSidebar`.
- **More overlay with z-index below notification dropdown:** The notification bell dropdown uses no explicit z-index. The More overlay should use `z-index: 300` to sit above everything. The existing sidebar `z-index: 200` is fine since the sidebar is hidden on mobile.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pull-to-refresh network indicator | Custom spinner/CSS animation | Simple CSS `@keyframes` rotate on an SVG icon | No need for a library; a 20-line CSS animation is sufficient |
| Swipe gesture physics | Full inertia/momentum system | Hard threshold (60px, 400ms) + CSS `transition` | The use case is simple binary left/right, not a drag handle |
| Tab bar active state detection | JS-driven class management | Server-side Eta template conditionals using `it.currentPath` | Simpler — no JS needed for active highlighting |

**Key insight:** This phase is CSS and DOM work. No new npm packages are needed. Every problem here is solved with media queries, touch events, and CSS transitions.

---

## Common Pitfalls

### Pitfall 1: Body overflow breaking mobile scroll
**What goes wrong:** The existing `body { overflow: hidden }` (used to prevent outer scroll on desktop) stops `.main-content` from scrolling naturally on mobile after the sidebar is hidden.
**Why it happens:** `overflow: hidden` on body propagates scroll blocking even when the body itself isn't the scroll container.
**How to avoid:** In `@media (max-width: 768px)`, set `body { overflow: auto }` and ensure `.main-content` has `overflow-y: auto; height: calc(100dvh - var(--topbar-height) - 56px - env(safe-area-inset-bottom))`.
**Warning signs:** Page content visible but not scrollable on mobile.

### Pitfall 2: iOS Safari input zoom persisting after fix
**What goes wrong:** Even after setting `font-size: 16px` on inputs, the viewport zooms in if the rule is applied via a specificity-losing media query.
**Why it happens:** The inline `style="font-size: 14px"` on inputs in `task-runs/new.eta` has higher specificity than a class rule.
**How to avoid:** Either (a) add `font-size: 16px !important` in the mobile media query for `input, select, textarea`, or (b) remove the inline font-size from the template and use CSS. Option (b) is cleaner.
**Warning signs:** Zoom still occurs after setting the CSS rule.

### Pitfall 3: `env(safe-area-inset-bottom)` not applied to tab bar
**What goes wrong:** On iPhones with a home indicator (iPhone X+), the tab bar's bottom items are hidden behind the gesture bar.
**Why it happens:** The `env()` function needs `padding-bottom` (not `margin-bottom`) and the tab bar's `height` must account for it.
**How to avoid:** `height: calc(56px + env(safe-area-inset-bottom))` and `padding-bottom: env(safe-area-inset-bottom)`. Also add `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">` — the `viewport-fit=cover` attribute is required for `env(safe-area-inset-*)` to work.
**Warning signs:** Tab labels cut off on physical iPhone.

### Pitfall 4: `dvh` not supported in older browsers
**What goes wrong:** `dvh` causes parse errors in browsers before 2022.
**Why it happens:** `dvh` is a newer CSS unit — supported in Chrome 108+, Safari 15.4+, Firefox 101+.
**How to avoid:** Provide a `vh` fallback: `height: 100vh; height: 100dvh;` — browsers that don't understand `dvh` use the `vh` value.
**Warning signs:** Layout broken on older Android WebView.

### Pitfall 5: HTMX polling conflicts with pull-to-refresh
**What goes wrong:** The task list already polls every 10s via `hx-trigger="every 10s"`. A pull-to-refresh that also triggers a swap can race with the polling trigger.
**Why it happens:** Both use `hx-swap="innerHTML"` on `#task-rows`. If the poll fires mid-swipe, the DOM updates and the swipe state is lost.
**How to avoid:** The `htmx.trigger(target, 'htmx:refresh')` call triggers the `hx-get` on `#task-rows`. The polling and the manual trigger both call the same endpoint — HTMX serialises these by default (it won't issue two simultaneous requests to the same target). No special handling needed.

### Pitfall 6: Swipe navigation conflicting with horizontal scrolls
**What goes wrong:** Horizontal date pill selectors (e.g. `.portal-date-pills`) already use `-webkit-overflow-scrolling: touch`. A global swipe handler will intercept those scrolls.
**Why it happens:** `touchend` fires regardless of whether the default was prevented.
**How to avoid:** In the page-level swipe handler, check that `startX` was on an element matching `[data-no-swipe], .overflow-x-scroll, .portal-date-pills` and bail if so. Or check `e.target.closest('[data-no-swipe]')` in the touchstart.

### Pitfall 7: More overlay not dismissing on navigation
**What goes wrong:** User opens More overlay, taps a link, page navigates. If they go back, the overlay is still `open` in the DOM.
**Why it happens:** Browser back restores the page's DOM from bfcache with the `open` class.
**How to avoid:** On `pageshow` event, call `closeMoreNav()`: `window.addEventListener('pageshow', closeMoreNav)`.

---

## Code Examples

Verified patterns from the existing codebase:

### Existing mobile sidebar CSS (to be replaced)
```css
/* Current — buggy: sidebar not collapsed on load so it shows */
.sidebar:not(.collapsed) { transform: translateX(0); }
.sidebar.collapsed { transform: translateX(-100%); }

/* Replacement approach — just hide it */
@media (max-width: 768px) {
  .sidebar { display: none !important; }
}
```

### HTMX trigger for pull-to-refresh
```javascript
// Existing HTMX trigger pattern in the codebase (from task list)
// hx-trigger="every 10s" on #task-rows already uses this mechanism.
// Pull-to-refresh fires the same endpoint:
htmx.trigger(document.getElementById('task-rows'), 'htmx:refresh');
// Note: 'htmx:refresh' is the standard HTMX event for re-triggering a hx-get
```

### Chart.js responsive on mobile
```javascript
// Chart.js already defaults to responsive: true
// The only mobile fix needed is max-height on the canvas wrapper:
// CSS: .chart-wrap canvas { max-height: 220px; }  ← already exists at 768px
// For the canvas element itself, Chart.js will respect the container size.
```

### Viewport meta — current (base.eta line 5)
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```
Must become:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
```
The `viewport-fit=cover` is required for `env(safe-area-inset-bottom)` to work on iPhones with notch/home indicator.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `100vh` for full-height layouts | `100dvh` (dynamic viewport height) | CSS spec ~2022, Safari 15.4 | Prevents overflow behind iOS address bar |
| `viewport-fit` not set | `viewport-fit=cover` in meta viewport | iOS 11 (2017) | Required for `env(safe-area-inset-*)` |
| Hamburger → slide-out drawer | Bottom tab bar | Industry standard for mobile apps since ~2018 | Thumb-reachable navigation |
| `<table>` everywhere | Card layout on mobile | — | Tables overflow on narrow viewports |

**Deprecated/outdated in this codebase:**
- The existing sidebar mobile CSS at line 969–991 (`sidebar:not(.collapsed)`, `sidebar.collapsed`) is the bug source. It will be fully replaced by `display: none !important`.
- The `isMobile` JS variable and the `toggleSidebar`/`closeSidebar` functions are desktop-only concerns going forward. They should be guarded with `if (window.innerWidth > 768) return;` at the top.

---

## Open Questions

1. **Swipe threshold on the task list vs. page navigation swipe**
   - What we know: Task card swipe (60px) and page navigation swipe (60px) both fire on the same element tree.
   - What's unclear: Will a task card right-swipe (reveal Approve) also trigger the page swipe handler?
   - Recommendation: The page navigation swipe handler checks `SECTIONS.indexOf(currentPath)`. On `/tasks`, left-swipe navigates to `/clients`, right-swipe navigates to `/`. The card swipe only fires on `.task-card` elements with their own handler. Since both check `Math.abs(dx) < Math.abs(dy) * 1.5`, the only risk is if the card right-swipe also propagates to the page handler. Add `e.stopPropagation()` in the card swipe handler — but note this requires a non-passive listener on the card.

2. **Pull-to-refresh visual indicator**
   - What we know: No visual feedback makes the gesture feel broken.
   - What's unclear: Whether a CSS spinner appended temporarily is sufficient, or if a sticky header-style pull indicator is expected.
   - Recommendation: Append a small spinner `<div>` to `.main-content` during the pull and remove it after `htmx:afterSettle` fires on `#task-rows`. This is 10 lines of JS.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` |
| Config file | None — run directly with `node --test` |
| Quick run command | `node --test --import tsx/esm web/lib/task-matcher.test.ts` |
| Full suite command | `node --test --import tsx/esm $(find web/lib -name '*.test.ts' \| tr '\n' ' ')` |

### Phase Requirements → Test Map

Phase 11 is entirely CSS and vanilla JS — there are no TypeScript modules to unit test. All requirements are verified visually/manually or via browser-based checks.

| Req ID | Behaviour | Test Type | Automated Command | File Exists? |
|--------|-----------|-----------|-------------------|-------------|
| RESP-01 | No horizontal scroll at 375px | manual | open DevTools responsive mode at 375px | N/A |
| RESP-02 | Viewport meta + mobile CSS reset | manual | inspect `<head>` for `viewport-fit=cover` | N/A |
| RESP-03 | Sidebar hidden, tab bar visible at 768px | manual | resize to 767px in DevTools | N/A |
| RESP-04 | 4 tabs visible with correct routes | manual | visual inspection | N/A |
| RESP-05 | 48px touch targets | manual | DevTools CSS inspector on tab items, buttons | N/A |
| RESP-06 | Cards visible, table hidden on mobile | manual | resize to 375px on /tasks and /clients | N/A |
| RESP-07 | Form usable without zoom on mobile | manual | open /tasks/new on iPhone simulator or real device | N/A |
| RESP-08 | Draft review readable on mobile | manual | open /tasks/:id on 375px | N/A |
| RESP-09 | Swipe navigates between tabs | manual | swipe gesture on mobile browser | N/A |
| RESP-10 | Pull-to-refresh triggers reload | manual | pull down on /tasks in mobile browser | N/A |

### Sampling Rate
- **Per task commit:** Reload the affected page in DevTools responsive mode at 375px
- **Per wave merge:** Full visual walkthrough of all 4 tab sections + More overlay + pull-to-refresh on mobile emulator
- **Phase gate:** All 10 requirements verified on a real iOS Safari device before `/gsd:verify-work`

### Wave 0 Gaps
None — existing test infrastructure (Node `node:test`) covers backend logic. Phase 11 has no backend changes and no testable TypeScript modules. All verification is manual/visual.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase read: `public/assets/style.css` — existing media queries, CSS custom properties, layout structure
- Direct codebase read: `web/views/layouts/base.eta` — existing sidebar markup, JS, sidebarConfig usage
- Direct codebase read: `web/views/task-runs/list-rows.eta`, `web/views/clients/list-table.eta` — table structures to reflow
- Direct codebase read: `web/lib/queries/sidebar.ts` — SidebarConfig type and DEFAULT_SIDEBAR_CONFIG
- `.planning/STATE.md` — accumulated v1.1 decisions (dvh, env(safe-area-inset-bottom), 16px font-size)

### Secondary (MEDIUM confidence)
- MDN CSS `dvh` unit — browser support: Chrome 108+, Safari 15.4+, Firefox 101+ (all current)
- MDN `env(safe-area-inset-bottom)` — requires `viewport-fit=cover` in meta viewport
- HTMX docs 2.0 — `htmx.trigger()` for manual refresh

### Tertiary (LOW confidence)
- None — all claims verified against codebase or MDN

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; existing HTMX + vanilla CSS + vanilla JS confirmed in codebase
- Architecture: HIGH — markup patterns derived from reading actual templates; CSS derived from reading actual style.css
- Pitfalls: HIGH — dvh/safe-area/16px-font-size decisions already in STATE.md from prior research; sidebar bug confirmed by reading base.eta JS

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable stack — no fast-moving dependencies)
