# Phase 11: Responsive Layout - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Make every VendoOS page fully usable on mobile — replace the desktop sidebar with a bottom tab bar, reflow key tables to card layouts, add swipe gestures for navigation and task actions, and add pull-to-refresh. Mobile use case is read-and-approve, not task creation.

</domain>

<decisions>
## Implementation Decisions

### Bottom Tab Bar
- 4 tabs: Dashboard, Tasks, Clients, More
- Icon + label style (small icon above short text label)
- Fixed at bottom of viewport on screens below 768px
- Active tab highlighted with Vendo green
- "More" tab opens a full-screen nav overlay with all remaining nav sections in a clean list
- Tab bar completely replaces the sidebar on mobile — sidebar is hidden, not just collapsed

### Table-to-Card Reflow
- Task runs list: full card reflow on mobile — must be fully usable (core AM workflow)
- Client list: full card reflow on mobile
- Other tables: Claude decides per-table based on column count and importance (horizontal scroll acceptable for secondary tables)
- Card visual style: Claude decides per-table — compact list cards for dense data, fuller cards where detail matters

### Swipe Behaviour
- Swiping left/right on the main content area switches between tab bar sections (Dashboard → Tasks → Clients)
- Individual task run cards have swipe actions: swipe right reveals green Approve button, swipe left opens detail view
- Swipe actions only on task run cards (not client cards or other lists)

### Pull-to-Refresh
- Claude decides which list pages get pull-to-refresh based on what makes sense (task list at minimum)

### Mobile Navigation
- Full-screen nav page when "More" is tapped — not a slide-out sheet, not a half-screen modal
- Full-screen nav shows all nav groups from sidebarConfig in a clean, scrollable list with the same icons
- Hamburger button in topbar: Claude decides whether to keep or remove based on cleanest UX (tab bar + More may be sufficient)

### Claude's Discretion
- Card layout density and information hierarchy per table type
- Whether to keep or remove hamburger menu button on mobile
- Which pages beyond task list get pull-to-refresh
- Exact swipe gesture thresholds and animation
- Loading skeleton designs for mobile cards
- How charts adapt on mobile (Chart.js canvas sizing)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `sidebarConfig` (data-driven nav): Bottom tab bar and More page can read from the same config array
- Existing mobile breakpoint at 768px with sidebar slide-out and backdrop — will be replaced by tab bar
- CSS custom properties (--vendo-green, --glass-bg, etc.) for consistent theming
- `.mobile-menu-btn` already conditionally shown at 768px — integration point for tab bar

### Established Patterns
- Eta SSR templates: new tab bar markup goes in `layouts/base.eta`
- Single CSS file: `public/assets/style.css` — mobile rules appended at end to avoid specificity issues
- HTMX for partial updates: tab section switching could use `hx-get` with `hx-push-url`
- Nav group accordion pattern: reusable in More page

### Integration Points
- `layouts/base.eta`: sidebar markup replaced/hidden on mobile, tab bar injected
- `public/assets/style.css`: all responsive additions here
- Inline `<script>` in base.eta: sidebar toggle JS replaced with tab bar JS on mobile
- `topbar`: may need height/content adjustments for mobile
- `dvh` units needed instead of `vh` for iOS Safari (research finding)
- Input `font-size` must be ≥ 16px to prevent iOS Safari auto-zoom

</code_context>

<specifics>
## Specific Ideas

- The sidebar bug is caused by inverted collapse logic on mobile — `collapsed` class hides it, but on load it's not collapsed so it shows and can't be dismissed properly. Tab bar replacement eliminates this entirely.
- AMs primarily check task status and approve drafts on mobile — the tab bar order (Dashboard, Tasks, Clients, More) reflects this priority.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 11-responsive-layout*
*Context gathered: 2026-04-06*
