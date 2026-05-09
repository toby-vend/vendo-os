# Block 8 — Slack inbound (Vendo OS App) — SHIPPED

**Last updated:** 2026-05-09 (evening)
**Status:** ✅ Merged to `main`, deployed to `https://vendo-os.vercel.app`, UAT'd via Slack DM + `/atlas` slash command.

---

## What landed

Block 8 makes the team able to talk to Atlas in Slack and approve recommendations from button clicks. Outbound was Block 4; this completes the loop.

| Endpoint | What it does |
|---|---|
| `POST /api/slack/events` | Slack URL verification + `message.im` (DMs) + `app_mention` (in-channel) |
| `POST /api/slack/commands` | `/atlas <prompt>` slash command |
| `POST /api/slack/interact` | Block Kit button clicks. Existing `add_to_asana` flow (director meetings) plus new `agent:approve\|edit\|reject:<recId>` Atlas action ids — same Fastify route, dispatcher branches by action_id |

All three accept Slack-signed POSTs. HMAC verification uses the existing `SLACK_SIGNING_SECRET` (5-min replay window). Bot token is `SLACK_BOT_TOKEN`. Both env vars are set in Production, Preview (this branch), and Development.

Key implementation choices:

- **`waitUntil` for post-ack work.** Vercel's Fluid Compute freezes the function the moment we send the response, so Atlas's run + the chat.postMessage / response_url follow-up are wrapped in `waitUntil()` from `@vercel/functions`. Without this, Slack saw "Atlas is thinking…" forever and zero agent runs landed in Turso.
- **Single Interactivity URL — extended dispatcher.** Slack only allows one Interactivity URL per app. We kept the existing Fastify route (so director-action buttons keep working) and added `agent:approve\|edit\|reject:<recId>` dispatch alongside.
- **Public path whitelist.** `/api/slack/interact` had to be added to Fastify's auth pre-handler whitelist (Slack POSTs without session cookies — auth middleware was 302-redirecting clicks to `/login`).
- **Reply-mode.** Single-shot for v1 (no streaming via `chat.update`). Slack DM ack within 3 s, then the agent runs in the background, then we post the final reply.

## Slack App config (one-off, by hand — already done)

| Section | Setting |
|---|---|
| Bot scopes | `app_mentions:read`, `chat:write`, `commands`, `im:history`, `users:read.email` (plus `incoming-webhook` + `users:read` left over from earlier) |
| Event Subscriptions URL | `https://vendo-os.vercel.app/api/slack/events` |
| Subscribed bot events | `message.im`, `app_mention` |
| Slash command `/atlas` | `https://vendo-os.vercel.app/api/slack/commands` |
| Interactivity URL | `https://vendo-os.vercel.app/api/slack/interact` |
| App Home → Messages Tab | ON, with "Allow users to send Slash commands and messages from the messages tab" ticked |

If we ever rebuild the app from scratch, redo all of the above.

## Files

```
api/slack/events.ts            NEW   url_verification + event_callback
api/slack/commands.ts          NEW   /atlas slash command
web/lib/agents/channels/
  slack-verify.ts              NEW   verifySlackSignature + readRawBody + parseSlackForm
  slack.ts                     MOD   slackUserIdToVendoUser, postSlackMessage,
                                     parseAgentActionId, agent:* prefix on action_ids
web/routes/slack-interact.ts   MOD   dispatcher branches on agent:* vs add_to_asana
web/server.ts                  MOD   /api/slack/interact added to public whitelist
vercel.json                    MOD   builds + routes for new endpoints
scripts/agents/smoke.ts        MOD   18 new assertions: HMAC verify + parser + form
package.json                   MOD   adds @vercel/functions
```

## UAT verified

- ✅ DM Vendo-OS bot → Atlas reply lands in DM
- ✅ `/atlas <q>` → ephemeral "thinking" then ephemeral final answer via `response_url`
- ✅ `agent_runs` rows persist with `trigger='slack:dm'` / `'slack:command:/atlas'` and full token usage
- ⏳ Approve-button flow — code path exists (mirrors `api/agent/approve.ts`); awaiting first real draft from a graduated tool to click Approve in Slack and confirm execute mode runs

## Resume command for next session

> Block 8 is done. Pick up Block 9 — typically one of:
>
> - **Cron-driven Daily Brief** (Phase 2, the highest-value function) — wire Atlas via `runAgentBackground` to a Vercel cron, deliver the brief via Slack DM to each admin user.
> - **Concern Monitor** (cron-driven) — flagged trends → ApprovalCard → Slack approval card.
> - **Telegram inbound** — same shape as Block 8 but via Telegram Bot API (outbound is already wired).
> - **Approve-button live test** — once any draft tool produces a real recommendation, click Approve in Slack and confirm execute_result lands in `agent_recommendations`.

---

## Critical gotchas (still relevant)

### 1. ESM `.js` extensions in deployed code

Vercel deploys api/* as Node ESM functions which reject extensionless imports. **Every relative import in `api/`, `web/lib/agents/`, and any code reachable from a Vercel-direct route must end in `.js` (or `/index.js` for directories).** A migration script lives at `scripts/migrations/add-js-extensions.mjs` — run it again if new files are added and you start seeing `ERR_MODULE_NOT_FOUND` in Vercel logs.

The smoke test runs locally via `tsx/esm` which forgives missing extensions, so this fails silently in dev.

### 2. `waitUntil` for any post-ack work

Any handler that ack's quickly and then runs a longer task **must** wrap the longer task in `waitUntil()` from `@vercel/functions`. Otherwise Fluid Compute freezes the function on response flush.

### 3. Auth pre-handler whitelist

Any new public/webhook endpoint mounted via Fastify must be added to the public-paths list in `web/server.ts:140` or it'll 302-redirect to `/login`.

### 4. Smoke cleanup

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

---

## Blocks 1–7 recap (for context)

| # | Commit | What |
|---|---|---|
| 1 | `9efb82d` `2578bc5` `a7d6e44` | Schema migrations (9 tables in Turso), trace + recommendations helpers, smoke (22 assertions) |
| 2 | `a661cf2` `a0e04f7` `7cf3daf` `b363f54` | `defineTool` contract + permissions/graduations, 10 tools (6 read + 4 draft), registry, smoke at 33 |
| 3 | `64c53cb` | Runtime — `streamAgent` + `runAgentBackground` wrapping AI SDK 6, model registry |
| 4 | `a9ef86b` | Channel adapters — web (push), Slack (outbound only), Telegram (stub if no token), `recToCard` helper |
| 5 | `13726da` `4548c7a` | Vector memory — embed wrapper, libSQL `vector_distance_cos` search, `searchKnowledge` real impl, seed-memory script |
| 6 | `b56751c` | Atlas agent definition + agents registry |
| 7a | `ed36d78` | `/api/agent/chat` (fetch-style) + `/api/agent/approve` (legacy req/res) + live runtime smoke |
| 7b-tier | `712d6cd` | Two-tier Atlas — admin vs staff variants, `getAgentForUser`, staff-safe `getClientHealthStaff` tool |
| 7b-ui | `bfb67d5` | React island at `/chat` (650 KB bundle), Eta page, esbuild build script, `useChat` integration |
| 8 | `a0fa767` `1b45bc6` `ed3f959` `b59cb1e` `ddb0fc9` `8be436d` | Slack inbound — events, commands, dispatcher, .js-extension migration, waitUntil, auth whitelist |

Smoke at 107 assertions, all green against real Turso. One live Haiku call per run (~$0.00005). Run with:

```bash
node --env-file=.env.local --import tsx/esm scripts/agents/smoke.ts
```
