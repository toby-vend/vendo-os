# Phase 10: AM Interface - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Account managers can submit tasks, monitor status, review drafts with SOP attribution, and approve or request regeneration — all from the existing web dashboard. Phase 10 adds Eta templates + Fastify routes for the AM-facing task workflow. No new frameworks — extends the existing Fastify + Eta + HTMX stack.

</domain>

<decisions>
## Implementation Decisions

### Task submission form
- Dedicated page at `/tasks/new` — full page form, linked from task list and navigation
- Searchable dropdown for client picker (populated from `listBrandClients()`, type-ahead filtering for 25+ clients)
- Channel selector: paid_social, seo, paid_ads
- Task type options filter dynamically by selected channel via HTMX swap (prevents invalid combinations)
- Optional free-text "Additional instructions" textarea — appended to task context if provided
- Submits to existing `POST /api/tasks/runs` and redirects to task detail or list

### Draft review and approval
- Structured card layout per channel: ad_copy renders each variant as a card (headline, body, CTA); content_brief renders meta fields + brief sections; rsa_copy renders headline/description lists
- Collapsible "Based on" section showing SOP names + versions (from `getAuditRecord` SopSnapshot data)
- QA warnings and AHPRA violations displayed as alert banner at top of draft (yellow for QA issues, red for AHPRA violations) — lists specific issues, impossible to miss but doesn't block reading
- Four actions on draft_ready tasks:
  1. **Approve** — transitions to 'approved' status
  2. **Regenerate** — with optional comment field; resets to 'queued' and re-runs pipeline. Comment stored in qa_critique JSON under `am_feedback`
  3. **Reject** — with required reason field; transitions to 'rejected' status (new status). Reason stored in qa_critique JSON under `am_feedback` for system learning
  4. **Copy to clipboard** — copies structured output fields for pasting into ad platforms/CMS
- AM feedback (rejection reasons, regeneration comments) stored in qa_critique JSON: `{sop_issues, ahpra_violations, am_feedback: {action, reason?, comment?}}`

### Task list and status display
- HTMX polling every 10 seconds (`hx-trigger="every 10s"`) on the task list table partial
- Filters: status (all/queued/generating/draft_ready/approved/failed), client (searchable dropdown), channel (dropdown), date range (from/to pickers)
- Compact rows: client name, channel badge, task type, coloured status badge, created date, AM name — click row to open detail view
- Default sort: newest first (created_at descending)

### Skills browser
- Channel tabs (Paid Social, SEO, Paid Ads, General) with search bar within each tab
- Skills grouped by skill_type within each channel tab
- Skill card: title + skill_type badge + last updated date — compact, scannable
- Click skill to see full extracted text content (not just metadata) — AMs can read SOPs directly in dashboard
- Search uses existing `searchSkills()` FTS5 function

### Claude's Discretion
- Exact CSS styling and colour choices for status badges and alert banners
- HTMX swap targets and trigger configuration details
- Whether the client picker uses a library (e.g. Tom Select) or plain HTMX
- Navigation placement (sidebar link, top nav, or both)
- Pagination approach for task list and skills list
- Copy-to-clipboard implementation (Clipboard API vs textarea hack)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `web/views/layouts/base.eta`: Main layout wrapper — all new pages use this
- `web/views/dashboard.eta`: Dashboard with stat cards, tables — pattern for task list
- `web/views/meetings/list.eta`: HTMX-powered list with `hx-trigger` — pattern for polling
- `web/views/drive.eta`: HTMX-powered search results — pattern for skills browser
- `web/routes/task-runs.ts`: API routes already exist (POST, GET by ID, GET list)
- `web/lib/queries/task-runs.ts`: `createTaskRun`, `getAuditRecord`, `listTaskRuns`, `updateTaskRunStatus`
- `web/lib/queries/drive.ts`: `searchSkills()` for skills browser
- `web/lib/queries/brand.ts`: `listBrandClients()` for client picker
- `web/lib/task-types/index.ts`: `loadTaskTypeConfig()` for channel→task type mapping
- HTMX already loaded in base.eta layout

### Established Patterns
- Route handlers render Eta templates with data: `reply.view('template', { data })`
- HTMX patterns: `hx-get`, `hx-trigger`, `hx-swap`, `hx-target` used in drive.eta, meetings
- Session auth via `onRequest` hook — all routes require login (except webhook/cron)
- Tables use `class="compact"` with standard column patterns

### Integration Points
- `web/server.ts` — register new route modules (tasks UI routes, skills browser routes)
- `web/views/` — add new Eta templates for task pages
- `web/views/layouts/base.eta` — add navigation links to tasks and skills
- `web/routes/task-runs.ts` — extend with approve/reject/regenerate endpoints or add separate UI route
- `task_runs.status` — may need 'rejected' added to TaskRunStatus type

</code_context>

<specifics>
## Specific Ideas

- Rejection reasons and regeneration comments should be stored for the system to learn from — user explicitly wants the system to prevent future issues based on this feedback
- "Keep all stored learnings to prevent future issues" — deferred to a future learning/feedback phase, but the data capture mechanism is built now
- Copy to clipboard is a quick export for pasting into Meta Ads Manager, Google Ads, or CMS

</specifics>

<deferred>
## Deferred Ideas

- System learning from rejection reasons and regeneration comments — capture the data now, build learning mechanism later
- Admin skills management UI (view indexed skills, force re-sync, mark deprecated) — ADMN-01 (v2)
- Admin audit trail viewer with filtering — ADMN-02 (v2)
- Inline editing of draft content before approval — future enhancement
- Bulk task submission (multiple clients, same channel/type) — future enhancement

</deferred>

---

*Phase: 10-am-interface*
*Context gathered: 2026-04-02*
