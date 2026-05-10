# Block 9 — Approval Graduation UI

**Block:** 9 (Atlas Phase 2)
**Date:** 2026-05-10
**Estimate:** ~2 hours
**Status:** Planned

---

## Goal

Give admins a UI to graduate `(agent, tool)` pairs so Atlas can execute writes
without per-call approval. Today the `agent_graduations` table exists, the
runtime honours it (`_tool.ts:148-159`), the smoke test exercises it
(`smoke.ts:346-393`) — but the only way to grant or revoke a graduation is
hand-rolled SQL. This is the autonomy bottleneck.

Two surfaces:

1. **`/admin/graduations`** — central matrix. Every (agent × write tool)
   combination, current state, who graduated it and when, with grant / revoke
   buttons and a notes field per pair.
2. **Inline button on `/inbox`** — when an admin approves a recommendation,
   show a one-click "graduate `(agent, tool)`" alongside the result so the
   trust decision happens at the moment they're seeing real behaviour.

Non-goals:
- No per-user graduation. Graduations are global-per-(agent, tool); user trust
  is the permission gate's job, not graduation's.
- No expiry / time-bounded graduations. Add later if needed.
- No approval-rate-driven auto-graduation. Manual only at v1.

---

## Files touched

```
web/lib/agents/permissions.ts            +listGraduations() — new helper
web/routes/admin/graduations.ts          NEW — GET / POST grant / POST revoke
web/views/admin/graduations.eta          NEW — matrix view
web/server.ts                            +import + register at /admin/graduations
web/views/inbox.eta                      +nav link + inline graduate button
web/routes/inbox.ts                      +POST /:recId/graduate handler
                                         +flag in viewmodel for current pair status
scripts/agents/smoke.ts                  +listGraduations assertion
```

No new env vars, no schema changes (`agent_graduations` already in place).

---

## Implementation steps

### 1. `listGraduations()` in `web/lib/agents/permissions.ts`

Add a fetch helper alongside the existing `loadGraduations / graduate /
revokeGraduation`. Returns every row with metadata for the matrix view.

```ts
export interface GraduationView {
  agent: string;
  toolName: string;
  graduatedAt: string;
  graduatedBy: string;
  notes: string | null;
}

export async function listGraduations(): Promise<GraduationView[]> {
  const result = await db.execute({
    sql: `SELECT agent, tool_name, graduated_at, graduated_by, notes
            FROM agent_graduations
           ORDER BY agent, tool_name`,
    args: [],
  });
  return result.rows.map(r => ({
    agent: String(r.agent),
    toolName: String(r.tool_name),
    graduatedAt: String(r.graduated_at),
    graduatedBy: String(r.graduated_by),
    notes: r.notes == null ? null : String(r.notes),
  }));
}
```

### 2. `web/routes/admin/graduations.ts` (new)

Three handlers:

- `GET /` — render the matrix. Build the agent list via `listAgents()` from
  the agents registry, the write-tool list by filtering `TOOL_FACTORIES` to
  the four `draft*` keys (no other write tools today; if more land they'll
  show up automatically because the registry is the source of truth, but only
  after we add a `hasSideEffect` reflection — see step 2a).
- `POST /grant` — body `{ agent, toolName, notes? }`. Calls `graduate({...,
  graduatedBy: user.email })`. Redirect back with `?notice=granted&pair=...`.
- `POST /revoke` — body `{ agent, toolName }`. Calls `revokeGraduation`.
  Redirect with `?notice=revoked&pair=...`.

Admin-only is enforced upstream (`server.ts:227-230` redirects non-admins on
`/admin/*` to a 403 page). No extra check needed here.

#### 2a. Detecting write tools

The TOOL_FACTORIES registry doesn't expose `hasSideEffect` directly — that
flag lives inside each factory's call to `defineTool`. Two options:

- **(chosen)** Maintain a hardcoded list of write-tool names in
  `web/lib/agents/tools/index.ts`:

  ```ts
  export const WRITE_TOOL_NAMES: ToolName[] = [
    'draftAsanaTask', 'draftSlackMessage', 'draftPushNotification', 'draftEmail',
  ];
  ```

  When a new write tool lands, the developer adds it here. One-line change,
  caught by the smoke test (assertion: every name in WRITE_TOOL_NAMES exists
  in TOOL_FACTORIES). Lower-magic than reflection.

- (rejected) Probe each factory by instantiating it with a stub ctx and
  reading the produced tool's metadata. The SDK doesn't expose
  `hasSideEffect` on the returned `Tool`, so we'd need to thread it through
  `defineTool`'s return shape — more invasive than the constant.

#### 2b. Per-(agent, tool) eligibility

A pair is graduatable only if the agent's `tools` list actually contains the
tool name. `atlas-brief` and `atlas-monitor` have narrower toolsets — show
them in the matrix as "n/a" rather than offering a grant button for
combinations they cannot use. The view does this filtering.

### 3. `web/views/admin/graduations.eta` (new)

Layout: a table — rows are write tools, columns are agents (or vice versa,
whichever fits more naturally; agents-as-rows reads better with four agents
× four tools). Each cell renders one of three states:

- **Not in toolset** → `—` (greyed)
- **Ungraduated** → `Grant` button (POSTs to `/admin/graduations/grant`) +
  optional notes textarea (use a `<details>` or modal to keep the matrix
  compact)
- **Graduated** → green tick, "by {email} on {date}", `Revoke` button

Mirror styling from `inbox.eta` — same notice banner, same neutral palette.
Inline `<style>` is the convention here.

### 4. `web/server.ts`

Two-line change: import + register.

```ts
import { adminGraduationsRoutes } from './routes/admin/graduations.js';
// ...
app.register(adminGraduationsRoutes, { prefix: '/admin/graduations' });
```

### 5. `web/views/inbox.eta` — nav + inline graduate

- Add a header link `<a href="/admin/graduations">Manage graduations</a>`
  visible only when `it.user?.role === 'admin'` (use the existing `canSee`
  pattern). Position next to the page title.
- For each `pending` recommendation, after the action buttons, if the
  current user is admin AND the (agent, tool) pair is currently NOT
  graduated, render a small inline form:

  ```html
  <details class="rec-graduate">
    <summary>Auto-execute future {tool} drafts from {agent}</summary>
    <form method="POST" action="/inbox/{id}/graduate">
      <p>Graduating means this exact tool, called by this exact agent, will execute without showing up in the inbox first. Permission gate (capability check) still applies. Approve a few examples before doing this.</p>
      <input type="text" name="notes" placeholder="Why now? (optional)" />
      <button type="submit">Graduate &amp; approve</button>
    </form>
  </details>
  ```

  The handler graduates the pair THEN re-runs the tool in execute mode (same
  path as the normal approve action — actually identical, since the rec is
  also approved by this action). One round-trip, matched at point of trust
  decision.

### 6. `web/routes/inbox.ts`

- Extend `GET /` to compute graduation state per rec. After loading recs,
  build a `Set<string>` of `${agent}:${toolName}` keys present in
  `agent_graduations` (one query — `SELECT agent, tool_name FROM ...`), and
  attach `isGraduated: boolean` to each `rowToView()` result.
- Add `POST /:recId/graduate` handler:
  - Admin-only (`user.role !== 'admin'` → 403).
  - Loads the rec, calls `graduate({ agent: rec.agent, toolName: rec.tool_name,
    graduatedBy: user.email, notes: body.notes })`.
  - Then runs the same approve-and-execute path as `/decide` with
    `decision: 'approved'`.
  - Redirect to `/inbox?notice=graduated-and-approved`.

### 7. `scripts/agents/smoke.ts`

Add three assertions to `[15] graduation gate — execute respected when
graduated`:

- `listGraduations()` returns at least one row containing the smoke pair
  while the row exists.
- `WRITE_TOOL_NAMES` contains every name in `TOOL_FACTORIES` whose factory
  produces a tool with `hasSideEffect: true` (will need a small reflection
  helper for the test only).
- After `revokeGraduation`, `listGraduations()` no longer contains the
  smoke pair.

### 8. UAT checklist

Manually walk through after deploy:

1. Visit `/admin/graduations` as admin → see matrix with current state (likely empty).
2. Click Grant on `(atlas, draftAsanaTask)` with a note → row appears, audit fields populated.
3. Visit `/inbox` → header link visible only as admin. Inline graduate `<details>` only on pending recs whose pair isn't already graduated.
4. Approve a pending Asana draft via the inline graduate button → tool executes, row marked approved, graduation row exists.
5. As standard user, hit `/admin/graduations` directly → 403.
6. As standard user, POST to `/inbox/{id}/graduate` directly with curl → 403, no graduation row.
7. Revoke from the matrix → graduation row gone, future Atlas calls revert to dry-run.
8. Run `node --env-file=.env.local --import tsx/esm scripts/agents/smoke.ts` → 110+ assertions, all green.

---

## Risks / gotchas

- **Single-checkbox autonomy is a real change.** Once `(atlas, draftSlackMessage)`
  is graduated, every Atlas conversation can post a Slack message immediately.
  The copy on the graduation form must call this out plainly.
- **`.js` import extensions** — applies to anything new in `web/routes/admin/`
  and `web/lib/agents/`. Run `node scripts/migrations/add-js-extensions.mjs`
  before commit if `tsc` warns or prod fails.
- **`waitUntil`** doesn't apply here — these are synchronous request/response
  handlers, no post-ack work.
- **CSRF** — current admin routes (`adminPermissionsRoutes`) don't use CSRF
  tokens. Stay consistent for v1; the cookie-based session already requires
  same-origin. If we tighten CSRF later, do it for all admin POSTs at once.
- **No bulk grant / revoke at v1.** If an admin wants to graduate every Atlas
  draft tool at once, they click four buttons. Adding bulk later is trivial.

---

## Verification before merge

```bash
# Type check
npx tsc --noEmit

# Smoke (110+ assertions including new graduation list / write-tool registry)
node --env-file=.env.local --import tsx/esm scripts/agents/smoke.ts

# Local server smoke
npm run dev
# → /admin/graduations renders, grant/revoke round-trip works, inline /inbox flow works
```

Commit incrementally: helper + write-tool list, route + view, server wiring,
inbox integration, smoke additions. One conventional commit per chunk
(`feat(atlas): graduation list helper`, etc.).
