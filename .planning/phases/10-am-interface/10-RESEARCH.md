# Phase 10: AM Interface - Research

**Researched:** 2026-04-01
**Domain:** Fastify + Eta SSR + HTMX UI layer on top of existing task run infrastructure
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Fastify + Eta SSR + HTMX — no new frameworks
- Dedicated `/tasks/new` page: searchable client picker, channel selector, dynamically filtered task types via HTMX swap
- Optional "Additional instructions" textarea appended to task context
- Submits to existing `POST /api/tasks/runs`, redirects after creation
- Draft review: structured card layout per channel (ad_copy: variant cards; content_brief: meta fields + sections; rsa_copy: headline/description lists)
- Collapsible "Based on" section showing SOP names + versions from `getAuditRecord` SopSnapshot data
- QA warnings as yellow banner, AHPRA violations as red banner at top of draft
- Four actions on `draft_ready` tasks: Approve, Regenerate (with optional comment), Reject (with required reason), Copy to clipboard
- AM feedback stored in `qa_critique` JSON under `am_feedback: { action, reason?, comment? }`
- Task list: HTMX polling every 10s, four filters (status, client, channel, date range), compact rows, newest-first default
- Skills browser: channel tabs, search within tab, grouped by skill_type, full content on click using `searchSkills()` FTS5
- `rejected` status must be added to `TaskRunStatus` union

### Claude's Discretion
- Exact CSS styling and colour choices for status badges and alert banners
- HTMX swap targets and trigger configuration details
- Whether the client picker uses a library (e.g. Tom Select) or plain HTMX
- Navigation placement (sidebar link, top nav, or both)
- Pagination approach for task list and skills list
- Copy-to-clipboard implementation (Clipboard API vs textarea hack)

### Deferred Ideas (OUT OF SCOPE)
- System learning from rejection reasons — data captured now, learning mechanism later
- Admin skills management UI (ADMN-01 v2)
- Admin audit trail viewer (ADMN-02 v2)
- Inline editing of draft content before approval
- Bulk task submission
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UI-01 | AM can submit a new task from the web dashboard (select client, channel, task type) | `/tasks/new` route + Eta template + HTMX channel→task type swap + `POST /api/tasks/runs` |
| UI-02 | AM can view generated draft with SOP attribution | `getAuditRecord` returns `SopSnapshot[]`; per-channel card layout templates; collapsible SOP section |
| UI-03 | AM can approve a draft or request regeneration | New UI action endpoints (approve/regenerate/reject); `updateTaskRunStatus` + `qa_critique` update |
| UI-04 | AM can browse and search indexed skills by channel and type | `searchSkills()` FTS5; channel tab approach; skill detail view |
| UI-05 | Task list shows all tasks with current status | `listTaskRuns()` with filter extensions; HTMX polling partial; `rejected` status added |
</phase_requirements>

---

## Summary

Phase 10 is a pure UI layer. Every query, type, and business logic function it needs already exists from Phases 6–9. The work is: new Fastify route modules, new Eta templates, extensions to `TaskRunStatus`, and two new action endpoints (approve/regenerate/reject are the only new write paths). There is no new database schema, no new LLM calls, and no new FTS5 work.

The existing codebase establishes the exact conventions to follow: `FastifyPluginAsync` registered in `server.ts`, `reply.render('template', { data })` for full-page and HTMX-partial responses, `hx-get`/`hx-trigger`/`hx-target`/`hx-swap` attributes already used in `drive.eta` and `meetings/list.eta`, and the `class="compact"` table pattern used across all list views. The `base.eta` layout already has `/tasks` and `/tasks/new` in its `pageNames` map, confirming the navigation slot is already reserved.

The main complexity areas are: (1) the HTMX-driven channel→task type swap on the submission form, (2) the three-banner + four-action draft review template which must handle three structurally different output shapes, and (3) ensuring the `rejected` status is propagated consistently through the TypeScript type, the query layer, and the route validation array.

**Primary recommendation:** Build in four discrete units — task submission form, draft review + actions, task list with polling, skills browser — each as its own route file + template pair, sharing a single `web/routes/task-runs-ui.ts` for the UI action endpoints (approve/regenerate/reject).

---

## Standard Stack

### Core (already in project — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Fastify | existing | HTTP server + route registration | All routes use this |
| Eta | existing | SSR template engine | All views use this |
| HTMX | 2.0.4 (CDN, base.eta line 11) | Partial updates, polling, AJAX forms | Already loaded globally |
| `@libsql/client` | existing | SQLite/Turso queries | All DB access |

### Supporting — discretion items

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Tom Select | 2.x (CDN) | Searchable dropdown for client picker | If plain HTMX type-ahead is too cumbersome for 25+ clients |
| Clipboard API | browser built-in | Copy-to-clipboard | Modern browsers; textarea fallback for older |

**No new npm installs are required for this phase.**

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain HTMX type-ahead for client picker | Tom Select (CDN) | Tom Select gives keyboard nav + accessible searchable select with zero JS authoring; HTMX type-ahead requires a partial endpoint and more template code |
| Clipboard API | `document.execCommand('copy')` textarea hack | Clipboard API is cleaner but requires `https` or `localhost`; both work in this environment |

**Installation (if Tom Select chosen — CDN only, no npm):**
```html
<!-- In base.eta or per-page <head> override -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tom-select@2/dist/css/tom-select.css">
<script src="https://cdn.jsdelivr.net/npm/tom-select@2/dist/js/tom-select.complete.min.js"></script>
```

---

## Architecture Patterns

### Recommended File Structure for This Phase

```
web/
├── routes/
│   ├── task-runs-ui.ts          # UI action endpoints: approve/regenerate/reject + form submit redirect
│   └── skills-browser.ts        # GET /skills + GET /skills/search partial
├── views/
│   ├── task-runs/
│   │   ├── new.eta              # Task submission form (/tasks/new replacement)
│   │   ├── list.eta             # Task list with polling wrapper
│   │   ├── list-rows.eta        # HTMX partial — table rows only (polled every 10s)
│   │   ├── detail.eta           # Draft review page
│   │   └── partials/
│   │       ├── draft-ad-copy.eta        # ad_copy variant cards
│   │       ├── draft-content-brief.eta  # content_brief meta + sections
│   │       └── draft-rsa-copy.eta       # rsa_copy headline/description lists
│   └── skills/
│       ├── browser.eta          # Skills browser with channel tabs
│       └── skill-detail.eta     # Full SOP content view (HTMX swap or modal)
```

**Note on route registration:** `task-runs-ui.ts` registers under prefix `/tasks` (UI pages) while the existing `task-runs.ts` stays at `/api/tasks`. Both are registered in `server.ts`. Alternatively, the existing `tasksRoutes` in `web/routes/tasks.ts` currently handles Asana tasks at `/tasks` — this will be replaced or extended. The planner must decide whether to repurpose `tasks.ts` or register a new module at `/tasks` prefix with a route ordering guard.

### Pattern 1: HTMX Polling Partial

The `meetings/list.eta` establishes the full-page wrapper pattern. The list-rows partial is what HTMX swaps:

```html
<!-- list.eta — wrapper page, renders once -->
<div id="task-rows"
     hx-get="/tasks/rows"
     hx-trigger="every 10s"
     hx-swap="innerHTML">
  <%~ include('/task-runs/list-rows', it) %>
</div>
```

```html
<!-- list-rows.eta — partial, returned by GET /tasks/rows -->
<% it.runs.forEach(run => { %>
<tr>
  <td><%= run.client_id %></td>
  <td><span class="badge badge-<%= run.status %>"><%= run.status %></span></td>
  ...
</tr>
<% }) %>
```

The route handler for `/tasks/rows` checks `request.headers['hx-request']` and returns only the partial — same pattern as `drive.ts` line 138–142.

### Pattern 2: HTMX-Driven Channel → Task Type Swap

```html
<!-- In new.eta -->
<select name="channel" id="channel"
        hx-get="/tasks/task-types"
        hx-target="#task-type-container"
        hx-trigger="change"
        hx-include="[name='channel']">
  <option value="">Select channel...</option>
  <option value="paid_social">Paid Social</option>
  <option value="seo">SEO</option>
  <option value="paid_ads">Paid Ads</option>
</select>

<div id="task-type-container">
  <!-- Replaced by HTMX on channel change -->
  <select name="taskType" disabled><option value="">Select channel first</option></select>
</div>
```

Route `GET /tasks/task-types?channel=paid_social` returns an `<select>` partial populated from `REGISTRY` keys in `task-types/index.ts`. The REGISTRY currently has three entries: `paid_social:ad_copy`, `seo:content_brief`, `paid_ads:rsa_copy` — these are the valid combinations.

### Pattern 3: Fastify Route Handler with HTMX-Aware Responses

```typescript
// Source: existing drive.ts lines 138-142 — established pattern
app.get('/rows', async (request, reply) => {
  const runs = await listTaskRuns(/* filters from query */);
  if (request.headers['hx-request']) {
    reply.render('task-runs/list-rows', { runs });
    return;
  }
  reply.render('task-runs/list', { runs });
});
```

### Pattern 4: Action Endpoints (Approve / Regenerate / Reject)

These are POST endpoints that update `task_runs` and redirect. They do NOT return JSON — they redirect to the detail page (or return an HTMX-friendly response).

```typescript
// POST /tasks/:id/approve
app.post<{ Params: { id: string } }>('/:id/approve', async (request, reply) => {
  const id = parseInt(request.params.id, 10);
  const run = await getTaskRun(id);
  if (!run || run.status !== 'draft_ready') {
    return reply.code(400).send({ error: 'invalid_state' });
  }
  await updateTaskRunStatus(id, 'approved');
  reply.redirect(`/tasks/${id}`);
});

// POST /tasks/:id/reject — requires reason, stores in qa_critique
app.post<{ Params: { id: string } }>('/:id/reject', async (request, reply) => {
  const id = parseInt(request.params.id, 10);
  const body = request.body as { reason?: string };
  if (!body.reason?.trim()) {
    return reply.redirect(`/tasks/${id}?error=reason_required`);
  }
  const run = await getTaskRun(id);
  if (!run || run.status !== 'draft_ready') return reply.code(400).send({ error: 'invalid_state' });

  // Merge am_feedback into existing qa_critique JSON
  const existing = run.qa_critique ? JSON.parse(run.qa_critique) : {};
  const updated = { ...existing, am_feedback: { action: 'reject', reason: body.reason.trim() } };
  await updateTaskRunQA(id, { score: run.qa_score ?? 0, critique: JSON.stringify(updated) });
  await updateTaskRunStatus(id, 'rejected');
  reply.redirect('/tasks');
});
```

The `regenerate` action resets status to `queued` and re-fires `assembleContext` — same fire-and-forget pattern as `POST /api/tasks/runs`.

### Anti-Patterns to Avoid

- **Polling the full page:** Only poll the row partial (`/tasks/rows`), not the entire list page. Polling full-page responses causes layout flicker.
- **Blocking reply before fire-and-forget:** The regenerate endpoint must call `reply.redirect(...)` before `assembleContext(...)` — same as `task-runs.ts` line 49–53.
- **Using `getTaskRun` instead of `getAuditRecord` on the detail page:** The draft review page needs `SopSnapshot[]` not raw JSON — always use `getAuditRecord`.
- **Hardcoding task type labels:** Derive them from `REGISTRY` keys in `loadTaskTypeConfig` — adding a new task type to the registry must automatically appear in the UI.
- **Rendering output JSON directly:** Parse `run.output` before passing to templates — templates should receive typed objects, not JSON strings.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Searchable client dropdown (25+ clients) | Custom HTMX typeahead with debounce | Tom Select (CDN) or plain `<datalist>` | Tom Select handles keyboard nav, accessibility, filtering; `<datalist>` is zero-JS |
| FTS5 skills search | Custom search logic | `searchSkills()` already in `drive.ts` | Fully implemented with BM25 ranking |
| SOP snapshot rendering | Re-fetch skills by ID | `getAuditRecord().sops_used` — already stored at generation time | Snapshots are point-in-time; re-fetching would show current version, not the one used |
| Channel → task type mapping | Hardcoded HTML options | REGISTRY from `task-types/index.ts` | Single source of truth; planner extends it in one place |
| Copy to clipboard | Server round-trip | `navigator.clipboard.writeText()` client-side | No server involvement needed; purely browser |

---

## Common Pitfalls

### Pitfall 1: Route Conflict — `/tasks` Already Registered

**What goes wrong:** `server.ts` already registers `tasksRoutes` at prefix `/tasks` (Asana task management). Adding a new AM task-runs UI at the same prefix causes Fastify to throw a route conflict on startup.

**Why it happens:** Both the old Asana task list and the new AM task-run list want to own `GET /tasks/`.

**How to avoid:** Either (a) repurpose `web/routes/tasks.ts` entirely (rename the old Asana UI to `/asana-tasks` or remove it if unused), or (b) register the new AM task-run UI at a distinct prefix like `/task-runs`. The CONTEXT.md uses `/tasks/new` and the `base.eta` already has `/tasks` in `pageNames` — so the intent is to take over `/tasks`. The planner should confirm whether the old Asana tasks route is still needed.

**Warning signs:** Fastify startup error: `FST_ERR_ROUTE_ALREADY_DEFINED` or similar duplicate route error.

### Pitfall 2: `rejected` Status Missing from Multiple Places

**What goes wrong:** Adding `'rejected'` to the TypeScript union but forgetting to add it to the `VALID_STATUSES` array in `task-runs.ts` (line 8), causing the filter to silently ignore `status=rejected` query params.

**Why it happens:** The status union is defined in `task-runs.ts` queries module; the validation array is defined separately in the routes module.

**How to avoid:** Touch both files atomically. The `VALID_STATUSES` array in `web/routes/task-runs.ts` line 8 must include `'rejected'` alongside the type union change.

**Warning signs:** `status=rejected` filter returns all rows instead of filtered rows.

### Pitfall 3: `qa_critique` JSON Clobbering

**What goes wrong:** The approve/reject/regenerate endpoints write `am_feedback` into `qa_critique` — if they call `updateTaskRunQA` without first merging the existing object, they overwrite `sop_issues` and `ahpra_violations` written by Phase 8.

**Why it happens:** `updateTaskRunQA` takes a full `critique` string — it replaces the entire JSON.

**How to avoid:** Always read `run.qa_critique`, parse it, spread-merge `am_feedback` in, then re-serialise before calling `updateTaskRunQA`. Pattern shown in the code example above.

**Warning signs:** QA score and SOP issues disappear from `qa_critique` after AM rejection.

### Pitfall 4: Output JSON Parsed in Template vs Route

**What goes wrong:** Passing raw `run.output` (a JSON string) to Eta templates and calling `JSON.parse()` inside the template — this silently produces empty renders if `output` is null (task not yet draft_ready).

**Why it happens:** `task_runs.output` is `string | null` — null when status is not `draft_ready`.

**How to avoid:** Parse `output` in the route handler, guard for null, and pass the typed object (or null) to the template. Template only needs to check `if (it.output)`.

### Pitfall 5: HTMX Polling Fires After Navigation

**What goes wrong:** HTMX polling interval continues after the user navigates away from the task list, causing background requests to a page the user is no longer viewing — harmless but wasteful.

**Why it happens:** HTMX does not cancel polls on `popstate`/navigation by default.

**How to avoid:** Use `hx-trigger="every 10s [document.visibilityState === 'visible']"` or simply accept the brief overlap — HTMX cancels the poll when the element is removed from the DOM.

---

## Code Examples

### Registering New Routes in server.ts

```typescript
// Source: web/server.ts lines 180-183 — established pattern
import { taskRunsUiRoutes } from './routes/task-runs-ui.js';
import { skillsBrowserRoutes } from './routes/skills-browser.js';

app.register(taskRunsUiRoutes, { prefix: '/tasks' });  // replaces old tasksRoutes
app.register(skillsBrowserRoutes, { prefix: '/skills' });
```

### HTMX-Aware Route Handler

```typescript
// Source: pattern from web/routes/drive.ts lines 138-142
app.get('/rows', async (request, reply) => {
  const q = request.query as Record<string, string>;
  const runs = await listTaskRuns({ /* parse filters */ });
  if (request.headers['hx-request']) {
    reply.render('task-runs/list-rows', { runs });
    return;
  }
  reply.render('task-runs/list', { runs });
});
```

### Collapsible SOP Attribution Section (Eta)

```html
<!-- Based on: getAuditRecord().sops_used -->
<% if (it.sopsUsed && it.sopsUsed.length) { %>
<details style="margin-top: 1rem;">
  <summary style="font-size: 13px; color: #94A3B8; cursor: pointer;">Based on <%= it.sopsUsed.length %> SOP<%= it.sopsUsed.length > 1 ? 's' : '' %></summary>
  <ul style="margin-top: 0.5rem; padding-left: 1.25rem;">
    <% it.sopsUsed.forEach(sop => { %>
    <li style="font-size: 13px; color: #64748B;">
      <%= sop.title %> <span style="opacity:0.5;">(v <%= sop.drive_modified_at.slice(0,10) %>)</span>
    </li>
    <% }) %>
  </ul>
</details>
<% } %>
```

### Status Badge Colours (aligned with existing badge classes)

```html
<!-- Existing badge classes: badge-completed, badge-overdue, badge-open -->
<!-- New classes needed for task run statuses -->
<span class="badge badge-<%= run.status %>"><%= run.status.replace('_', ' ') %></span>
```

CSS additions to `style.css`:
```css
.badge-queued      { background: rgba(148,163,184,0.15); color: #94A3B8; }
.badge-generating  { background: rgba(251,191,36,0.15);  color: #FBBF24; }
.badge-qa_check    { background: rgba(251,191,36,0.15);  color: #FBBF24; }
.badge-draft_ready { background: rgba(59,130,246,0.15);  color: #60A5FA; }
.badge-approved    { background: rgba(34,197,94,0.15);   color: #22C55E; }
.badge-failed      { background: rgba(239,68,68,0.15);   color: #EF4444; }
.badge-rejected    { background: rgba(239,68,68,0.08);   color: #F87171; }
```

### QA/AHPRA Alert Banners

```html
<% const critique = it.qaCritique ? JSON.parse(it.qaCritique) : null; %>
<% if (critique?.ahpra_violations?.length) { %>
<div style="padding: 0.75rem 1.25rem; margin-bottom: 1rem; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.3); border-radius: 10px;">
  <strong style="color: #EF4444; font-size: 13px;">AHPRA Compliance Issues</strong>
  <ul style="margin: 0.5rem 0 0; padding-left: 1.25rem;">
    <% critique.ahpra_violations.forEach(v => { %>
    <li style="font-size: 13px; color: #FCA5A5;"><%= v %></li>
    <% }) %>
  </ul>
</div>
<% } %>
<% if (critique?.sop_issues?.length) { %>
<div style="padding: 0.75rem 1.25rem; margin-bottom: 1rem; background: rgba(251,191,36,0.06); border: 1px solid rgba(251,191,36,0.25); border-radius: 10px;">
  <strong style="color: #FBBF24; font-size: 13px;">QA Warnings</strong>
  <ul style="margin: 0.5rem 0 0; padding-left: 1.25rem;">
    <% critique.sop_issues.forEach(issue => { %>
    <li style="font-size: 13px; color: #FDE68A;"><%= issue %></li>
    <% }) %>
  </ul>
</div>
<% } %>
```

### Copy-to-Clipboard (client-side JS, no server round-trip)

```html
<button type="button" onclick="copyDraft()" style="...">Copy to clipboard</button>
<script>
function copyDraft() {
  const text = document.getElementById('draft-copy-target').innerText;
  navigator.clipboard.writeText(text).then(() => {
    document.getElementById('copy-feedback').textContent = 'Copied!';
    setTimeout(() => { document.getElementById('copy-feedback').textContent = ''; }, 2000);
  }).catch(() => {
    // Fallback for non-https or older browsers
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
}
</script>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| HTMX 1.x `hx-trigger="every Xs"` | HTMX 2.x same syntax, same behaviour | HTMX 2.0 (2024) | No change needed — syntax identical |
| Full-page reload for status refresh | HTMX partial polling | Phase architecture choice | Implemented via `hx-trigger="every 10s"` on a `<div>` wrapping only the rows |

---

## Open Questions

1. **Route conflict at `/tasks`**
   - What we know: `web/routes/tasks.ts` is registered at `{ prefix: '/tasks' }` for Asana task management (still in `server.ts` line 180). The new AM task-run UI also wants `/tasks`.
   - What's unclear: Whether the old Asana tasks page is still actively used by the team or is dead weight.
   - Recommendation: Planner should add a Wave 0 task to either (a) rename `tasksRoutes` to `/asana-tasks` and update the `base.eta` nav entry, or (b) merge the AM task-run pages directly into `tasks.ts`. Given the `base.eta` `pageNames` already has `/tasks` mapped to "Tasks" (line 139), option (a) is cleanest.

2. **Client name in task list rows**
   - What we know: `listTaskRuns()` returns `client_id` (integer), not `client_name`. The task list compact rows should show client name.
   - What's unclear: Whether to JOIN brand_hub at query time or do a client lookup map in the route handler.
   - Recommendation: Add a `client_name` column to `listTaskRuns` via LEFT JOIN on `brand_hub GROUP BY client_id` — or add a lightweight `getClientName(clientId)` helper. The planner should choose which query to extend.

3. **Regenerate endpoint and `assembleContext` signature**
   - What we know: `assembleContext(taskRunId, clientId, channel, taskType, userId)` takes five args from the original request context — but on regeneration, `userId` comes from the current session, not the original creator.
   - What's unclear: Whether `additionalInstructions` from the original submission are stored anywhere (they are not — `task_runs` has no `instructions` column).
   - Recommendation: The planner should confirm that regeneration re-runs without the original additional instructions (acceptable given the deferred scope), or add an `instructions` column to `task_runs` in Wave 0.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | node:test (built-in) |
| Config file | none — flags passed per-test-file |
| Quick run command | `node --test --experimental-test-module-mocks --import tsx/esm web/routes/task-runs-ui.test.ts` |
| Full suite command | `node --test --experimental-test-module-mocks --import tsx/esm web/**/*.test.ts` |

### Phase Requirements → Test Map

| Req ID | Behaviour | Test Type | Automated Command | File Exists? |
|--------|-----------|-----------|-------------------|-------------|
| UI-01 | POST /tasks/new submits to /api/tasks/runs and redirects | integration | `node --test --experimental-test-module-mocks --import tsx/esm web/routes/task-runs-ui.test.ts` | ❌ Wave 0 |
| UI-01 | Channel → task type HTMX partial returns correct options | integration | same file | ❌ Wave 0 |
| UI-02 | Draft detail page parses output JSON and passes typed object to template | unit | same file | ❌ Wave 0 |
| UI-03 | Approve endpoint transitions status to approved | integration | same file | ❌ Wave 0 |
| UI-03 | Reject endpoint stores am_feedback in qa_critique without clobbering sop_issues | integration | same file | ❌ Wave 0 |
| UI-03 | Regenerate endpoint resets status to queued and fires assembleContext | integration | same file | ❌ Wave 0 |
| UI-04 | Skills browser returns skills grouped by channel/skill_type | integration | `node --test --experimental-test-module-mocks --import tsx/esm web/routes/skills-browser.test.ts` | ❌ Wave 0 |
| UI-05 | Task list rows partial returns filtered/sorted rows | integration | same as UI-01 test file | ❌ Wave 0 |
| UI-05 | `rejected` status accepted by listTaskRuns filter | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/task-runs.test.ts` | ✅ (extend existing) |

### Sampling Rate

- **Per task commit:** Run the specific test file for the changed module
- **Per wave merge:** `node --test --experimental-test-module-mocks --import tsx/esm web/**/*.test.ts`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `web/routes/task-runs-ui.test.ts` — covers UI-01, UI-02, UI-03, UI-05
- [ ] `web/routes/skills-browser.test.ts` — covers UI-04
- [ ] Extend `web/lib/queries/task-runs.test.ts` — add `rejected` status assertion for UI-05

---

## Sources

### Primary (HIGH confidence)

- `web/routes/task-runs.ts` — existing API routes, VALID_STATUSES array, fire-and-forget pattern
- `web/lib/queries/task-runs.ts` — TaskRunStatus union, getAuditRecord, listTaskRuns, updateTaskRunStatus, updateTaskRunQA
- `web/views/layouts/base.eta` — HTMX 2.0.4 already loaded, pageNames map (tasks/new already present), nav canSee pattern
- `web/routes/drive.ts` lines 138–142 — HTMX-aware route handler pattern
- `web/views/meetings/list.eta` — filter-bar + HTMX partial pattern
- `web/lib/task-types/index.ts` — REGISTRY with 3 channel:taskType combos
- `web/lib/task-types/ad_copy.ts`, `content_brief.ts`, `rsa_copy.ts` — output shapes for draft card templates
- `web/lib/queries/drive.ts` `searchSkills()` — FTS5 function for skills browser
- `web/lib/queries/brand.ts` `listBrandClients()` — client picker data source
- `web/server.ts` — route registration pattern, auth hook, existing `/tasks` conflict

### Secondary (MEDIUM confidence)

- HTMX 2.x docs — `hx-trigger="every Ns"` syntax confirmed identical to 1.x for polling use case

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new libraries; everything verified against live source files
- Architecture patterns: HIGH — all patterns derived from existing codebase (drive.ts, meetings, task-runs.ts)
- Pitfalls: HIGH — route conflict and status array gap verified by reading source; qa_critique clobber verified by reading updateTaskRunQA signature
- Open questions: MEDIUM — client_name gap and regeneration instructions gap identified from source but resolution requires planner judgement

**Research date:** 2026-04-01
**Valid until:** Stable — no external dependencies; only changes if Phase 9 outputs are modified
