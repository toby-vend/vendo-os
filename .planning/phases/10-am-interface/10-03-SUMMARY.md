---
phase: 10-am-interface
plan: "03"
subsystem: web
tags: [typescript, eta, htmx, fastify, sqlite, fts5, skills-browser]

requires:
  - phase: 10-am-interface-01
    provides: "Skills nav link at /skills in base.eta layout"
  - phase: 04-skills-library
    provides: "skills table, skills_fts FTS5 index, searchSkills function"

provides:
  - "listSkillsByChannel(channel) query helper"
  - "getSkillById(id) query helper"
  - "listSkillChannels() query helper"
  - "GET /skills — skills browser with dynamic channel tabs"
  - "GET /skills/search — HTMX partial for search results"
  - "GET /skills/:id — full SOP content view"
  - "skills/browser.eta, skill-results.eta, skill-detail.eta templates"

affects: []

tech-stack:
  added: []
  patterns:
    - "SkillForDisplay Pick<> type bridges SkillRow and SkillSearchResult for shared groupBySkillType function"
    - "HTMX hx-trigger=keyup delay:300ms for debounced search without full page reload"

key-files:
  created:
    - web/routes/skills-browser.ts
    - web/views/skills/browser.eta
    - web/views/skills/skill-detail.eta
    - web/views/skills/skill-results.eta
  modified:
    - web/lib/queries/drive.ts
    - web/server.ts

key-decisions:
  - "SkillForDisplay Pick<> type used so groupBySkillType accepts both SkillRow (browse path) and SkillSearchResult (search path) without duplication"
  - "listSkillChannels() is dynamic — channel tabs appear automatically when new channels are indexed, no hardcoded list"
  - "skill-detail uses <%=%> (HTML-escaped) for content since Drive extraction produces plain text — prevents XSS if content ever contains markup"

requirements-completed: [UI-04]

duration: 167s
completed: 2026-04-02
---

# Phase 10 Plan 03: Skills Browser Summary

**Skills browser built at /skills with dynamic channel tabs, FTS5-backed HTMX search, skill type grouping, and full SOP content view — three new query helpers added to drive.ts**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-02
- **Completed:** 2026-04-02
- **Tasks:** 2 of 2 complete
- **Files modified:** 6

## Accomplishments

- Added `listSkillsByChannel`, `getSkillById`, and `listSkillChannels` query helpers to `web/lib/queries/drive.ts`
- Created `skillsBrowserRoutes` (FastifyPluginAsync) with GET `/`, `/search`, and `/:id` endpoints
- GET `/` serves the full browser page or HTMX partial depending on `hx-request` header
- GET `/search` always returns the skill-results partial for HTMX tab and search updates
- GET `/:id` serves full SOP content, returning 404 if skill not found
- Created `skills/browser.eta` — channel tabs with HTMX tab switching, debounced search input, results container
- Created `skills/skill-results.eta` — HTMX partial grouping skills by `skill_type` with card list
- Created `skills/skill-detail.eta` — full SOP content view with channel/skill_type badges, metadata, and white-space pre-wrap content block
- Registered `skillsBrowserRoutes` at `/skills` prefix in `server.ts`
- Human verification of full AM interface end-to-end approved — /tasks, /tasks/new, /tasks/:id, /skills, /skills/:id, /asana-tasks all functional on Vercel

## Task Commits

1. **Task 1: Skills browser routes and templates** - `e03645d` (feat)
2. **Task 2: Verify complete AM interface end-to-end** - human-verify checkpoint approved

## Files Created/Modified

- `web/lib/queries/drive.ts` — Added `listSkillsByChannel`, `getSkillById`, `listSkillChannels`
- `web/routes/skills-browser.ts` — New: `skillsBrowserRoutes` plugin with 3 routes
- `web/server.ts` — Registered `skillsBrowserRoutes` at `/skills`
- `web/views/skills/browser.eta` — New: skills browser full page
- `web/views/skills/skill-results.eta` — New: HTMX partial for results grouped by skill_type
- `web/views/skills/skill-detail.eta` — New: full SOP content view

## Decisions Made

- `SkillForDisplay` Pick<> type bridges `SkillRow` and `SkillSearchResult` so `groupBySkillType` works on both the browse path and the FTS5 search path without duplication
- `listSkillChannels()` queries `DISTINCT channel` at runtime — channel tabs are dynamic, not hardcoded
- `skill-detail.eta` uses `<%= %>` (escaped) for content rendering rather than `<%- %>` — safer default even though Drive content is currently plain text

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check

- `/Users/Toby_1/Vendo-OS/web/routes/skills-browser.ts` — FOUND
- `/Users/Toby_1/Vendo-OS/web/views/skills/browser.eta` — FOUND
- `/Users/Toby_1/Vendo-OS/web/views/skills/skill-detail.eta` — FOUND
- `/Users/Toby_1/Vendo-OS/web/views/skills/skill-results.eta` — FOUND
- Commit `e03645d` — FOUND
- TypeScript: no new errors in `web/` files

## Self-Check: PASSED

---
*Phase: 10-am-interface*
*Completed: 2026-04-02*
