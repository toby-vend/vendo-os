# Block 9 — Atlas Phase 2 (cron-driven flows + triage UI)

**Last updated:** 2026-05-10 (late evening — full Block 9 minus 3 capability items)
**Branch:** `main` — everything is merged, deployed, and live at `https://vendo-os.vercel.app`.
**Smoke:** 155 assertions, all green. `node --env-file=.env.local --import tsx/esm scripts/agents/smoke.ts`.

---

## State at this checkpoint

Block 8 (Slack inbound, conversation memory, Block Kit approval cards) is fully shipped and UAT'd. Block 9 has been **partially delivered** — three of six candidates in.

### Block 9 — done

| Feature | What ships | Cost / cadence |
|---|---|---|
| **Per-user Daily Brief cron** | `/api/cron/atlas-brief` runs `0 7 * * 1-5`. Each admin gets a personalised morning DM (yesterday's meetings, open Asana, flagged concerns, campaign anomalies). Atlas reasons about what to surface; never dumps every metric. | ~$0.16 / brief × 5 admins × weekdays = ~$200/year |
| **Concern Monitor cron** | `/api/cron/concern-monitor` runs `0 9-18 * * 1-5`. Polls new high/critical `meeting_concerns`, runs `atlas-monitor` agent, drafts a follow-up Asana task or Slack DM, posts a Block Kit approval card to the recipient. Dedup tracked in `monitor_alerts(monitor='atlas-concern-monitor')`. | ~$0.05 / concern × ~14/month = ~$0.70/month |
| **Web /inbox page** | Server-rendered Fastify route at `/inbox`. Lists every agent recommendation with Approve / Edit / Reject buttons. Filters by status and owner. Surfaces tool-internal errors (e.g. failed-but-marked-executed). Same execute-mode re-run path as the Slack Block Kit Approve. | Admin-only at v1 |
| **Approval graduation UI** | `/admin/graduations` matrix view — every (agent × write tool) cell, grant / revoke per pair. Inline "Graduate & approve" affordance on `/inbox` for admins lets the trust decision happen at the moment they're seeing concrete tool output. Once graduated, future calls of that pair skip the inbox entirely. **Plus** graduation now auto-upgrades requested `dry-run` to `execute` — granting a pair really does mean "auto-execute every call." Plan: `plans/2026-05-10-block9-graduation-ui.md`. | The autonomy-loop unlocker |
| **Web /chat fully wired** | Three latent bugs fixed: (a) `api/agent/chat.ts` and `api/agent/approve.ts` were never registered in `vercel.json` → 404; (b) `chat.ts` used a fetch-style `(Request) → Promise<Response>` signature which the legacy `@vercel/node` builder doesn't dispatch → FUNCTION_INVOCATION_FAILED; (c) the manual getReader→res.write pipe dropped final chunks. Now uses `Readable.fromWeb` with `await new Promise` so Vercel doesn't tear down mid-stream. CSRF tokens added to all admin/inbox forms. | Web /chat finally works (was broken since shipped) |
| **draftAsanaTask client resolution** | Added optional `client` field. Resolves via `getAsanaProjectForClient()` → `client_source_mappings` → Asana project gid → task attached to project board. Refuses to execute if `client` provided but unmapped. Atlas's prompt updated to call `searchClients` first when unsure of spelling. | Tasks now land in the right project, not private My Tasks |
| **Outcome-aware tool cards in chat** | Tool card collapsed view now distinguishes drafted (amber) vs executed (green) vs errored (red). Inline "Open →" CTA above the card links to created Asana URL or `/inbox` for review. Markdown rendering via marked + sanitize-html (bold, lists, links). | UAT surfaced that "DONE" was misleading — fixed |

### Block 9 — remaining

| Feature | Estimate | Why it matters |
|---|---|---|
| Xero / Calendar / GHL read tools | ~30 min each, ~2 hours total | Fills obvious gaps; all read-only so no graduation overhead |
| Specialist agent dispatch (AM / Creative / Finance) | ~4 hours per specialist | Atlas hands off; narrower toolsets, sharper prompts, compounds over months |
| Telegram inbound | ~2 hours | Mirror of Slack inbound; off-laptop access |
| Polish — unmapped client fallback | ~30 min | 125/167 clients have no Asana mapping. Atlas currently errors out instead of falling back to a private task. Surfaced during 2026-05-10 UAT. |

---

## Atlas at end-of-session

| Agent | Channel | Tools | Trigger |
|---|---|---|---|
| `atlas` | Web /chat, Slack DM/mention, /atlas slash | 15 (11 read + 4 draft) | user-initiated |
| `atlas-staff` | same as above | 12 (8 read + 4 draft) — no finance/decisions/concerns | user-initiated |
| `atlas-brief` | Slack DM | 8 read tools | cron `0 7 * * 1-5` |
| `atlas-monitor` | Slack DM (recommendation card) | 9 (7 read + 2 draft) | cron `0 9-18 * * 1-5` |

Read tool inventory: `searchMeetings`, `searchClients`, `getClientHealth(Staff)`, `getCampaignPerformance`, `queryDecisions`, `searchKnowledge`, `searchAsanaTasks`, `getTimeSpent`, `getTrafficStats`, `getFrameioStatus`, `searchMeetingConcerns`.

Write tools (all dry-run by default + recommendation card): `draftAsanaTask`, `draftSlackMessage`, `draftPushNotification`, `draftEmail`.

---

## Critical gotchas (still relevant — same as Block 8 doc)

### 1. ESM `.js` extensions in deployed code

Vercel rejects extensionless imports at runtime. Every relative import in `api/`, `web/lib/agents/`, and any code reachable from a Vercel-direct route must end in `.js` (or `/index.js` for directories). The migration script `scripts/migrations/add-js-extensions.mjs` is idempotent — re-run it if new files are added and you start seeing `ERR_MODULE_NOT_FOUND`.

### 2. `waitUntil` for any post-ack work

Any handler that ack-then-does-work must wrap the longer task in `waitUntil()` from `@vercel/functions`. Without it, Fluid Compute freezes the function on response flush and the background work is silently dropped.

### 3. Auth pre-handler whitelist

Public/webhook endpoints mounted via Fastify must be added to the public-paths list in `web/server.ts:140` or they 302-redirect to `/login`. Already covers slack/interact, drive, fathom, frameio, agent-chat-related paths.

### 4. Agent must use Vendo email domain

Agent system prompts now hard-code "@vendodigital.co.uk — NEVER @vendodigital.com" near the top. If Atlas hallucinates a `.com` email when drafting tasks, that fix needs reinforcing.

### 5. Admin bypasses both gates

`hasCapability` short-circuits true for `user.role === 'admin'`. The graduation gate still applies — admins still need explicit approval for each write.

### 7. Vercel functions need explicit registration

`vercel.json` uses legacy v2 schema with explicit `builds`. New files under `api/` are NOT auto-detected — they must be added to both `builds` (so bundled) and `routes` (inserted before the `/(.*)` catch-all). Use `(VercelRequest, VercelResponse)` signatures, not fetch-style — the legacy builder doesn't dispatch `(Request) → Promise<Response>` handlers. If the underlying code returns a Web `Response`, pipe its body to `res` via `Readable.fromWeb()` inside an `await new Promise` so Vercel doesn't tear down mid-stream. Memory note: `feedback_vercel_explicit_builds.md`.

### 8. CSRF tokens required in every Eta form

Every authenticated POST that isn't `/api/*`, `/login`, or `/auth/google/*` is checked by the CSRF preHandler at `web/server.ts:295`. Forms without `<input type="hidden" name="_csrf" value="<%= it.csrfToken %>" />` will 403. The render decorator at `web/server.ts:106` injects `csrfToken` into every template — just reference it. Memory note: `feedback_csrf_in_eta_forms.md`.

### 9. Graduation = auto-execute, not "allow execute"

The graduation gate now auto-upgrades requested `dry-run` to `execute` when a pair is graduated (not just "stops execute being coerced to dry-run"). This is the actual semantics — granting a pair means the agent's calls run for real. Atlas's system prompt is also updated to list graduated tools and tell the model the action is real (so the reply says "I've created" not "Drafted"). See `_tool.ts:148-170`.

### 6. Smoke cleanup

```bash
node --env-file=.env.local --import tsx/esm --eval "
import { createClient } from '@libsql/client';
const c = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
await c.execute({ sql: \"DELETE FROM agent_outcomes WHERE recommendation_id IN (SELECT id FROM agent_recommendations WHERE agent = 'smoke-test')\" });
await c.execute({ sql: \"DELETE FROM agent_recommendations WHERE agent = 'smoke-test'\" });
await c.execute({ sql: \"DELETE FROM agent_tool_calls WHERE run_id IN (SELECT id FROM agent_runs WHERE agent = 'smoke-test')\" });
await c.execute({ sql: \"DELETE FROM agent_messages WHERE run_id IN (SELECT id FROM agent_runs WHERE agent = 'smoke-test')\" });
await c.execute({ sql: \"DELETE FROM agent_runs WHERE agent = 'smoke-test'\" });
await c.execute({ sql: \"DELETE FROM agent_graduations WHERE agent = 'smoke-test'\" });
await c.execute({ sql: \"DELETE FROM agent_memory_chunks WHERE scope_id LIKE 'smoke-%'\" });
console.log('clean');
"
```

---

## Useful queries

### Per-user Atlas usage in the last 7 days

```sql
SELECT u.name, u.role, ar.trigger,
       COUNT(*) as runs,
       ROUND(SUM(COALESCE(ar.cost_usd, 0)), 4) as total_cost,
       MAX(ar.started_at) as last_used
  FROM agent_runs ar
  JOIN users u ON ar.user_id = u.id
 WHERE ar.started_at >= datetime('now', '-7 days')
   AND ar.agent IN ('atlas','atlas-staff')
 GROUP BY u.id, ar.trigger
 ORDER BY runs DESC;
```

### Recent recommendations + their decision lifecycle

```sql
SELECT id, agent, tool_name, status, created_at, decided_at, executed_at,
       json_extract(execute_result, '$.error') as tool_error
  FROM agent_recommendations
 ORDER BY created_at DESC
 LIMIT 20;
```

---

## File map (Atlas-relevant)

```
api/
  agent/
    chat.ts              # web /chat fetch handler (streamAgent)
    approve.ts           # web /chat approval action
  slack/
    events.ts            # Slack DMs + app_mentions (waitUntil pattern)
    commands.ts          # /atlas slash command (waitUntil pattern)
  cron/
    atlas-brief.ts       # NEW — per-user morning brief
    concern-monitor.ts   # NEW — reactive concern follow-ups

web/lib/agents/
  agents/
    atlas.ts             # admin (15 tools)
    atlas-staff.ts       # standard (12 tools, no finance/decisions/concerns)
    atlas-brief.ts       # NEW — cron brief agent
    atlas-monitor.ts     # NEW — cron concern-response agent
    index.ts             # registry + getAgentForUser tier router
  channels/
    slack.ts             # outbound + slack-id→Vendo-user resolver +
                         # parseAgentActionId, postSlackMessage
    slack-verify.ts      # HMAC + raw-body + form-parse helpers
    web.ts, telegram.ts, _channel.ts, index.ts
  memory/
    long-term.ts, embed.ts  # vector store via libSQL vector_distance_cos
  tools/
    _tool.ts             # defineTool wrapper — permission gate + graduation
                         # gate + auto-persist recommendation + Block Kit
                         # card delivery
    search-meetings.ts, search-clients.ts, get-client-health.ts,
    get-client-health-staff.ts, get-campaign-performance.ts,
    query-decisions.ts, search-knowledge.ts,
    search-asana-tasks.ts, get-time-spent.ts, get-traffic-stats.ts,
    get-frameio-status.ts, search-meeting-concerns.ts,
    draft-asana-task.ts, draft-slack-message.ts,
    draft-push-notification.ts, draft-email.ts
    index.ts             # TOOL_FACTORIES registry + buildToolset
  permissions.ts         # CAPABILITIES enum + hasCapability (admin bypass)
  recommendations.ts     # create / decide / markExecuted / acceptanceRate
  runtime.ts             # streamAgent + runAgentBackground
                         # (history-aware; channel = ctx.channel not 'cron')
  trace.ts               # startRun / endRun / recordMessage / loadConversation
  models.ts, types.ts

web/routes/
  inbox.ts               # /inbox page — pending recs + inline graduate flow
  slack-interact.ts      # Block Kit click dispatcher
                         # (extended for agent:approve|edit|reject:<recId>)
  admin/graduations.ts   # NEW — /admin/graduations matrix routes

web/views/
  inbox.eta              # inbox UI + admin "Graduate & approve" affordance
  admin/graduations.eta  # NEW — graduation matrix view

scripts/agents/
  smoke.ts               # 107+ assertions
  seed-memory.ts
scripts/migrations/
  add-js-extensions.mjs  # the .js-extension migrator (idempotent)
  2026-05-15-agent-runtime.ts  # 9-table schema
  2026-05-22-agent-memory.ts
```

---

## Slack App config (if rebuilding from scratch)

| Section | Setting |
|---|---|
| Bot scopes | `app_mentions:read`, `chat:write`, `commands`, `im:history`, `users:read.email` |
| Event Subscriptions URL | `https://vendo-os.vercel.app/api/slack/events` |
| Subscribed bot events | `message.im`, `app_mention` |
| Slash command `/atlas` | `https://vendo-os.vercel.app/api/slack/commands` |
| Interactivity URL | `https://vendo-os.vercel.app/api/slack/interact` |
| App Home → Messages Tab | ON, "Allow users to send Slash commands and messages from the messages tab" ticked |
| Env vars (Production + Preview + Development) | `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `CRON_SECRET`, `CONCERN_MONITOR_RECIPIENT_EMAIL` (optional, defaults to toby@) |

---

## Recommended next pick

Graduation UI now shipped — admins can grant `(agent, tool)` pairs at `/admin/graduations` or graduate-and-approve inline from a pending rec on `/inbox`. The autonomy bottleneck is open.

Next-most-valuable, in order:

1. **Xero / Calendar / GHL read tools** (~2h total) — fills the most obvious capability gaps. All read-only, so no graduation overhead. Mostly mechanical.
2. **Specialist agent dispatch** (AM / Creative / Finance, ~4h each) — architectural play; Atlas hands off to a narrower agent with a sharper prompt. Pays off over months but compounds slowly.
3. **Telegram inbound** (~2h) — mirror of Slack inbound. Smaller payoff than the above; do when off-laptop access becomes a real friction point.
