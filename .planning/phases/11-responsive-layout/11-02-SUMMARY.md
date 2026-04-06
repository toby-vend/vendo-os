---
phase: 11-responsive-layout
plan: "02"
subsystem: frontend/templates
tags: [mobile, responsive, cards, css, eta-templates]
dependency_graph:
  requires: ["11-01"]
  provides: ["RESP-06", "RESP-07", "RESP-08"]
  affects: ["web/views/task-runs/list-rows.eta", "web/views/clients/list-table.eta", "public/assets/style.css"]
tech_stack:
  added: []
  patterns: ["desktop-only/mobile-only toggle", "card layout reflow", "swipe-action stub"]
key_files:
  modified:
    - web/views/task-runs/list-rows.eta
    - web/views/clients/list-table.eta
    - public/assets/style.css
decisions:
  - "Swipe-action-approve div rendered in markup (display:none) on draft_ready cards — wired by Plan 03, not Plan 02"
  - "Draft review page mobile fix uses attribute selector [style*='max-width: 780px'] to avoid touching the detail.eta markup"
  - "Client card health dot uses same colour logic as the table (green >=70, amber >=40, red <40, grey if null)"
metrics:
  duration_seconds: 101
  completed_date: "2026-04-06"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 3
---

# Phase 11 Plan 02: Mobile Card Layouts Summary

**One-liner:** Task run and client list tables reflow to touch-friendly card layouts below 768px, with swipe-action stubs pre-rendered for Plan 03.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Task run and client card reflow templates + CSS | 8b86888 | list-rows.eta, list-table.eta, style.css |

## What Was Built

### Task run cards (list-rows.eta)
- Existing `<table>` wrapped in `<div class="desktop-only">` — hidden on mobile via Plan 01 CSS
- `.task-card-list.mobile-only` added after the table with one `.task-card-wrapper` per run
- Each card shows: client name, status badge, channel badge, task type, date, and AM
- Cards are click-navigable to `/tasks/:id`
- `.swipe-action-approve` div pre-rendered (hidden) on `draft_ready` cards — Plan 03 wires the gesture

### Client cards (list-table.eta)
- Existing `<table>` wrapped in `<div class="desktop-only">`
- `.client-card-list.mobile-only` added with one `.client-card` per client as an `<a>` tag
- Top row: client label (left) + health colour dot (right)
- Bottom row: vertical (left) + health score for admin users (right)

### CSS additions (style.css — Phase 11 `@media (max-width: 768px)` block)
- `.task-card-list`, `.task-card-wrapper`, `.task-card`, `.task-card-header`, `.task-card-meta`, `.task-card-footer` — card layout and styling
- `.task-card.swiped-right` — transform hook for Plan 03 swipe gestures
- `.swipe-action-approve` — positioned behind the card, revealed on swipe
- `.client-card-list`, `.client-card`, `.client-card-row`, `.client-card-name` — client card layout
- Form mobile fixes: full-width inputs, `box-sizing: border-box`, submit buttons full-width
- Draft review page: `max-width: 100%` override, `pre`/`code` overflow wrapping, action button stacking

## Verification

All 11 automated checks passed:
- Task card markup, desktop-only/mobile-only wrappers, data-task-id attribute
- Client card markup, desktop-only wrapper
- CSS: `.task-card`, `.client-card`, `.swipe-action-approve`, `.task-card-wrapper`, `.swiped-right`

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- FOUND: web/views/task-runs/list-rows.eta
- FOUND: web/views/clients/list-table.eta
- FOUND: public/assets/style.css
- FOUND: .planning/phases/11-responsive-layout/11-02-SUMMARY.md
- FOUND: commit 8b86888
