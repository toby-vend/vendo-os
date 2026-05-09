# Block 8 Resume — Slack inbound (Vendo OS App)

**Last updated:** 2026-05-09
**Branch:** `feat/agent-runtime-foundation`
**Last commit:** `bfb67d5 feat(chat): React island for /chat — Atlas conversational surface`
**Plan reference:** `.claude/plans/sprightly-bubbling-fountain.md` (overview) and `.claude/plans/sprightly-bubbling-fountain-agent-aec47fa30faf56426.md` (full architecture)

---

## Where we are

Phase 0 (foundation) and Phase 1 web surface are shipped on `feat/agent-runtime-foundation`. Atlas is live at `/chat` with two-tier security (admin sees full toolset, staff sees client + performance only).

### Done — committed + pushed

| # | Commit | What |
|---|---|---|
| Block 1 | `9efb82d` `2578bc5` `a7d6e44` | Schema migrations (9 tables in Turso), trace + recommendations helpers, smoke (22 assertions) |
| Block 2 | `a661cf2` `a0e04f7` `7cf3daf` `b363f54` | `defineTool` contract + permissions/graduations, 10 tools (6 read + 4 draft), registry, smoke at 33 |
| Block 3 | `64c53cb` | Runtime — `streamAgent` + `runAgentBackground` wrapping AI SDK 6, model registry |
| Block 4 | `a9ef86b` | Channel adapters — web (push), Slack (outbound only), Telegram (stub if no token), `recToCard` helper |
| Block 5 | `13726da` `4548c7a` | Vector memory — embed wrapper, libSQL `vector_distance_cos` search, `searchKnowledge` real impl, seed-memory script |
| Block 6 | `b56751c` | Atlas agent definition + agents registry |
| Block 7a | `ed36d78` | `/api/agent/chat` (fetch-style) + `/api/agent/approve` (legacy req/res) + live runtime smoke |
| Block 7b-tier | `712d6cd` | Two-tier Atlas — admin vs staff variants, `getAgentForUser`, staff-safe `getClientHealthStaff` tool |
| Block 7b-ui | `bfb67d5` | React island at `/chat` (650 KB bundle), Eta page, esbuild build script, `useChat` integration |

**Smoke runs:** 89 assertions, all green against real Turso + AI Gateway. One live Haiku call per run (~$0.00005). Run with:
```bash
node --env-file=.env.local --import tsx/esm scripts/agents/smoke.ts
```

---

## Block 8 — Slack inbound (the next deliverable)

**Goal:** Stand up the new "Vendo OS" Slack App so the team can DM Atlas in Slack and approve recommendations from button clicks. Outbound already works (Block 4 adapter). This block adds inbound.

### What needs building

1. **Slack App config** (manual one-time, not code):
   - Create new app at api.slack.com/apps named "Vendo OS"
   - Bot scopes: `chat:write`, `users:read.email`, `im:history`, `app_mentions:read`, `commands`
   - Event subscriptions URL: `https://<vendo-os-domain>/api/slack/events`
   - Subscribe to bot events: `message.im`, `app_mention`
   - Interactivity URL: `https://<vendo-os-domain>/api/slack/events` (same endpoint handles both)
   - Slash command: `/vendo` → `https://<vendo-os-domain>/api/slack/commands`
   - Install to workspace, capture `SLACK_VENDO_OS_BOT_TOKEN` and `SLACK_VENDO_OS_SIGNING_SECRET` env vars (or reuse existing `SLACK_BOT_TOKEN` + `SLACK_SIGNING_SECRET` if those are unused by other apps)

2. **`/api/slack/events.ts`** — Vercel route handling:
   - `url_verification` (one-off challenge response when configuring the app)
   - `event_callback` with `message.im` → run Atlas with the message text via `runAgentBackground`, deliver reply via `slackChannel.sendMessage`
   - `event_callback` with `app_mention` → same flow
   - Block actions (interactive components) — parse `action_id: 'approve:<recId>' | 'edit:<recId>' | 'reject:<recId>'`, look up rec, call `recommendations.decide()`, on approve re-run the underlying tool in execute mode (same logic as `api/agent/approve.ts`)
   - **Signature verification** required — match the existing pattern in `web/lib/classification/slack.ts` HMAC verification (already verified on the outbound side; we need to receive that header)

3. **`/api/slack/commands.ts`** — slash command receiver:
   - Validates HMAC like events
   - Treats `text` as the user prompt
   - Posts a "thinking..." ephemeral response, runs Atlas async, follows up with the result

4. **User resolution** — `event.user` (Slack user id) → Vendo SessionUser. Reuse `lookupSlackUserIdByEmail` (reverse direction). Pattern: Slack user id → `users.lookupByEmail` returns email → `getUserByEmail` returns Vendo user. If no Vendo user, reply "you're not registered for Atlas" and bail.

5. **Channel preference** — when Atlas runs from a Slack trigger, the recommendation should be delivered via Slack (`slackChannel.requestApproval`). Already plumbed in Block 4; just needs the agent run's `channel` set to `'slack'` when the trigger is Slack.

6. **Smoke updates** — verify signature verification works, verify the action_id parser, verify a happy-path Slack action lands as `recommendations.decide()`.

### Files to create / modify

```
api/slack/events.ts             NEW   url_verification + event_callback + block_actions
api/slack/commands.ts           NEW   slash command /vendo handler
web/lib/agents/channels/slack.ts MOD  add reverse lookup helper (slack-id → email → vendo user)
                                     possibly extract postBlockKitApproval to be reusable
                                     possibly add a way to route inbound message to a thread
scripts/agents/smoke.ts         MOD   add ~6 assertions for action_id parsing + signature verify
.env.local                      USER  add SLACK_VENDO_OS_BOT_TOKEN + SLACK_VENDO_OS_SIGNING_SECRET
                                     (or reuse SLACK_BOT_TOKEN + SLACK_SIGNING_SECRET if unused)
vercel.json                     MOD   add api/slack/events.ts + api/slack/commands.ts builds
```

### Design decisions to confirm at session start

- **Reuse existing `SLACK_BOT_TOKEN`** (which is already present and used by `web/lib/notifications.ts`) **vs new `SLACK_VENDO_OS_BOT_TOKEN`?** Reuse is simpler but couples this app to whatever else uses that token. New token is cleaner separation.
- **Slack inbound routes Atlas as `runAgentBackground`** (single-shot, returns text) **vs streaming `chat.postMessage` updates?** Single-shot is simpler and Slack streaming requires the experimental `chat.postMessage` ack-then-edit pattern. Recommend: single-shot for v1.
- **Per-channel agent** — does the same admin/staff tier split apply on Slack? Yes — `getAgentForUser(user)` runs the same way regardless of inbound channel.

---

## Critical gotchas to know before resuming

### 1. Branch resets between sessions

The harness has been resetting me to `main` between session turns repeatedly. **First action when resuming should be:**

```bash
git branch --show-current
# if 'main' not 'feat/agent-runtime-foundation':
git stash push -m "session-resume" -- web/lib/frameio/  # often has unrelated WIP
git checkout feat/agent-runtime-foundation
```

If `web/lib/frameio/` has uncommitted changes blocking the checkout, stash them — they're unrelated to the agent work.

### 2. ESM env-file invocation pattern

Any script that imports from `web/lib/queries/base` must be invoked with Node's `--env-file` flag (not just `dotenv.config()` in the script body) — ESM hoists imports before the script body runs, so `dotenv.config()` is too late. The correct invocation:

```bash
node --env-file=.env.local --import tsx/esm scripts/agents/smoke.ts
```

This is documented at the top of `scripts/agents/smoke.ts`.

### 3. Smoke cleanup is essential

The smoke test writes to **production Turso**. Always run the cleanup snippet after smoke runs:

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
console.log('Cleaned smoke rows.');
"
```

### 4. Codebase conventions (already verified)

- **Imports:** extensionless (`'../auth'` not `'../auth.js'`) — `moduleResolution: bundler`, jsx: react-jsx now configured
- **Migrations:** `dotenv` config first, then `import { createClient } from '@libsql/client'`, statements array, sequential execute. `CREATE TABLE IF NOT EXISTS`. `datetime('now')` for timestamps. Run via `npx tsx scripts/migrations/X.ts` directly.
- **DB client:** `import { db, rows, scalar } from '../queries/base'`. Single client.
- **IDs:** `crypto.randomUUID()` or `generateId()` from `web/lib/auth`.
- **Inserts:** `db.execute({ sql, args })` with `?` placeholders. `ON CONFLICT DO UPDATE` for idempotency.
- **Tests:** `node:test` framework — but the smoke test does most of our verification.
- **Vercel routes:** can be (req, res) legacy style OR fetch-style `(request: Request) => Response`. AI SDK's `toUIMessageStreamResponse()` returns a fetch Response, so streaming routes use fetch-style.
- **HMAC verification for Slack:** existing pattern in `web/lib/classification/slack.ts` and `web/routes/slack-interact.ts`. Reuse the helpers.

### 5. AI SDK version notes

- `ai@6.0.177` — fetch-style handlers work out of the box. `tool()` has Zod 3/4 compatibility but `defineTool` in `_tool.ts` already navigates the variance via `zodSchema()` + `@ts-expect-error`.
- `@ai-sdk/react@3.0.179` — `useChat` from `@ai-sdk/react`, NOT from `ai`. Uses `DefaultChatTransport` from `ai` for the transport.
- Models pass as plain `provider/model` strings — gateway routing automatic via `AI_GATEWAY_API_KEY` (confirmed working in dev).

### 6. Bundle build

After changes to `web/client/agent-chat/**`:
```bash
NODE_ENV=production npm run build:chat
git add public/assets/agent-chat.js
git commit
```

The bundle is committed (not built on Vercel). 650 KB minified.

---

## Recommended Block 8 task list (to set up at resume)

1. Confirm env vars decision (reuse `SLACK_BOT_TOKEN` or new `SLACK_VENDO_OS_BOT_TOKEN`?)
2. Add Slack signing secret verification helper (or reuse existing)
3. Write `api/slack/events.ts` — challenge handler + message dispatch + interactive component handler
4. Write `api/slack/commands.ts` — slash `/vendo` handler
5. Add Slack channel adapter inbound helpers (slack user id → vendo user)
6. Update `vercel.json` with the two new routes
7. Smoke updates — signature verification + action_id parsing
8. UAT: install the Slack App, send a DM, see Atlas reply; trigger a draft tool, click Approve in Slack
9. Commit + push

Estimated 1–2 days of focused work, depending on how much of the Slack App config the user does manually vs scripted.

---

## Useful files for orientation when resuming

| Read first | Why |
|---|---|
| `.claude/plans/sprightly-bubbling-fountain.md` | The strategic plan |
| `web/lib/agents/channels/slack.ts` | Existing outbound Slack adapter — has bot token usage, Block Kit renderer for approvals, `vendoUserToSlackId` helper |
| `web/routes/slack-interact.ts` | Existing inbound handler for the OLD outbound webhook flow — references HMAC verification |
| `web/lib/classification/slack.ts` | Existing Slack helpers (postDirectorActionItems, dmTobyFailsafe) |
| `web/lib/notifications.ts` | Existing direct REST chat.postMessage helper — pattern to match |
| `api/agent/chat.ts` | Reference for the runtime + auth flow |
| `api/agent/approve.ts` | Reference for the decide → execute flow we'll mirror in Slack action handler |

---

## State at this checkpoint

```
$ git log --oneline -10
bfb67d5 feat(chat): React island for /chat — Atlas conversational surface
712d6cd feat(agents): two-tier Atlas — admin (full) + staff (no finance / decisions)
ed36d78 feat(agents): /api/agent/chat + /api/agent/approve (Block 7a)
b56751c feat(agents): Atlas generalist agent + agents registry
4548c7a chore(agents): seed-memory backfill + extend smoke to 58 assertions
13726da feat(agents): vector memory module + searchKnowledge real impl
a9ef86b feat(agents): web / Slack / Telegram channel adapters
64c53cb feat(agents): runtime (streamAgent + runAgentBackground) + model registry
b363f54 feat(agents): tool registry + extend smoke to cover defineTool gates
7cf3daf feat(agents): four draft tools (asana, slack, push, email)
```

---

## What to say at session start

> Resume Block 8 — Slack inbound. Read `plans/2026-05-09-block8-slack-resume.md` for full state. First action: switch to `feat/agent-runtime-foundation` if not already on it.

Or just paste the bullet list under "Recommended Block 8 task list" and we go.
