# Vendo OS: Vercel exit handover

**Date:** 26 October 2026
**From:** Toby (with Claude Code, in the existing `toby-vend/vendo-os` repo)
**To:** the new Vendo OS project / host
**Goal:** move everything still running on Vercel to the new host, then terminate the Vercel account.

---

## 1. Current state: read this first

- **Production on Vercel is frozen on the build from about 6 October 2026.** Every deploy since then has failed before building. Vercel's error is "Hobby accounts are limited to daily cron jobs", because Pro was cancelled but `vercel.json` still has crons that run more than once a day. Nothing pushed since roughly 6 October is live.
- That frozen build is **still running** its crons and webhooks, including the old Fathom → Asana task creator that staff have been complaining about.
- **Data lives in Turso, not Vercel** (`TURSO_DATABASE_URL`). Deleting Vercel doesn't touch the database.
- **Environment variables have been backed up and shared with the new project** (done by Toby). Section 6 lists the ones that need new values or are new since the backup.
- **Deploy from `main`.** `main` has the latest Fathom → Asana fixes (commits `afb3391c` and `c13b1902`, see section 8). Some other code work is still unmerged on feature branches (section 9).

---

## 2. How the app runs

Two kinds of code are involved:

1. **The main app: a Fastify server.** On Vercel it runs through `api/index.ts`. Off Vercel it runs as a normal Node process:
   ```bash
   npm ci
   NODE_ENV=production npm start        # = tsx web/start.ts, listens on DASHBOARD_PORT (default 3000)
   ```
   This serves the web UI, all `/api/cron/*` routes **except the ones listed in section 2a**, and every webhook in section 4.
   With `VERCEL` unset, the app serves its own static files from `web/public` under `/assets/`, and logging is on. Set `NODE_ENV=production` so cookies get the `Secure` flag.

2. **Standalone Vercel functions in `api/`.** These are **not** served by `npm start`. They use the `(req: VercelRequest, res: VercelResponse)` handler shape and need mounting on the new host. The simplest route is a thin Fastify wrapper per file, or a small adapter route in `web/server.ts`:

### 2a. Standalone functions to mount

| URL | File | Notes |
|---|---|---|
| `POST /api/chat` | `api/chat.ts` | Needs `context/**` on disk |
| `POST /api/skills/generate` | `api/skills-generate.ts` | Ran with a 60s limit on Vercel |
| `POST /api/skills/save` | `api/skills-save.ts` | |
| `GET /api/skills/outputs` | `api/skills-outputs.ts` | |
| `POST /api/slack/events` | `api/slack/events.ts` | Uses `waitUntil` from `@vercel/functions`; replace it with "ack Slack, then carry on in the background" |
| `POST /api/slack/commands` | `api/slack/commands.ts` | Same `waitUntil` change |
| `POST /api/agent/chat`, `/api/agent/approve`, `/api/agent/conversations*` | `api/agent/*.ts` | Atlas chat |
| `GET/POST /api/cron/atlas-brief` | `api/cron/atlas-brief.ts` | Up to 300s |
| `/api/cron/concern-monitor` | `api/cron/concern-monitor.ts` | |
| `/api/cron/codebase-health` | `api/cron/codebase-health.ts` | |
| `/api/cron/atlas-churn-risk`, `-upsell`, `-lead-quality`, `-case-study`, `-profitability`, `-feature-prioritiser`, `-growth`, `-qa` | `api/cron/atlas-*.ts` | Atlas agents |

On Vercel, the main function bundled these folders, so they must be present on the new host: `web/views/**`, `web/public/**`, `context/**`, `.claude/commands/skills/**`.

---

## 3. Scheduled jobs (replace Vercel Cron)

Every cron is an HTTP call to the app. Each one **must send `Authorization: Bearer $CRON_SECRET`**, or the app returns 401 (see `web/server.ts` and `web/routes/drive-cron.ts`). **All times are UTC**, because that's what Vercel used. Re-check the morning jobs against UK time after the clocks change.

| Schedule (UTC) | Path | What it does |
|---|---|---|
| `*/2 * * * *` | `/api/cron/frameio-process` | Processes queued Frame.io events |
| `*/15 * * * *` | `/api/cron/push-reports-to-portal` | Pushes client reports to the portal (Supabase) |
| `0 * * * *` | `/api/cron/monitors` | Ad-spend / CPL / ROAS / CPA / contract monitors |
| `0 * * * *` | `/api/cron/sync-asana` | Asana → DB sync |
| `0 9-18 * * 1-5` | `/api/cron/concern-monitor` | Hourly in working hours: client concern alerts |
| `0 */2 * * *` | `/api/cron/sync-xero` | Xero sync |
| `15 */4 * * *` | `/api/cron/sync-google-ads` | Google Ads sync |
| `30 */4 * * *` | `/api/cron/sync-meta-ads` | Meta Ads sync (token is dead, see section 10) |
| `45 */4 * * *` | `/api/cron/sync-ghl` | GoHighLevel sync |
| `0 */6 * * *` | `/api/cron/portal-sync` | Portal sync |
| `0 3 * * *` | `/api/cron/health-score` | Client health scores |
| `0 3 * * *` | `/api/cron/purge-suggestion-drafts` | Cleans old suggestion drafts |
| `30 3 * * *` | `/api/cron/sync-frameio` | Frame.io sync |
| `0 4 * * *` | `/api/cron/traffic-light` | Client traffic lights |
| `0 4 * * *` | `/api/cron/atlas-profitability` | Atlas profitability |
| `0 4 * * *` | `/api/cron/client-profitability` | Client profitability |
| `0 6 * * *` | `/api/cron/renew-drive-channels` | Renews Google Drive push channels (needs `DRIVE_WEBHOOK_URL`) |
| `0 9 * * *` | `/api/cron/nps-trigger` | NPS sends |
| `0 18 * * *` | `/api/cron/deliverables-hours-sheet` | Harvest hours + Meta spend → deliverables sheet |
| `30 6 * * 1-5` | `/api/cron/codebase-health` | Code health email |
| `0 7 * * 1-5` | `/api/cron/atlas-brief` | Per-user daily brief |
| `45 7 * * 1-5` | `/api/cron/sync-actions-to-asana` | Meeting/escalation/NPS → Asana catch-up, plus the daily filtered-items DM |
| `0 8 * * 1-5` | `/api/cron/atlas-lead-quality` | |
| `0 9 * * 1-5` | `/api/cron/atlas-churn-risk` | |
| `0 9 * * 1-5` | `/api/cron/specialist-paid-social` | Specialist digests… |
| `30 9 * * 1-5` | `/api/cron/specialist-paid-search` | |
| `0 10 * * 1-5` | `/api/cron/specialist-seo` | |
| `30 10 * * 1-5` | `/api/cron/specialist-creative` | |
| `0 11 * * 1-5` | `/api/cron/specialist-am` | |
| `0 8 * * 1` | `/api/cron/traffic-light-digest` | Weekly |
| `30 8 * * 1` | `/api/cron/capacity-digest` | Weekly |
| `0 9 * * 1` | `/api/cron/performance-review-gaps` | Weekly |
| `0 11 * * 1` | `/api/cron/atlas-feature-prioritiser` | Weekly |
| `0 9 * * 2` | `/api/cron/onboarding-stall` | Weekly |
| `30 9 * * 3` | `/api/cron/atlas-upsell` | Weekly |
| `0 7 * * 3` | `/api/cron/atlas-case-study` | Weekly |
| `0 17 * * 5` | `/api/cron/atlas-growth` | Weekly |
| `0 17 * * 5` | `/api/cron/sales-pipeline-digest` | Weekly |
| `0 19 * * 0` | `/api/cron/atlas-qa` | Weekly |
| `0 6 1 * *` | `/api/cron/monthly-client-reports` | Monthly |

The source of truth is `vercel.json` → `crons` (40 jobs). Some jobs ran for up to 300s on Vercel, so the new scheduler's HTTP timeout needs to be at least 5 minutes.

---

## 4. Inbound webhooks: repoint each one at the new URL

These are configured in **other systems**, which will keep calling the Vercel URL until someone changes them. The new base URL replaces `https://vendo-os.vercel.app`.

| Endpoint | Caller | Where to change it | Priority |
|---|---|---|---|
| `/api/squat/claim`, `/api/squat/shopify-order` | **Squat Success funnel (customer-facing)** and its Shopify order webhook | Funnel form action + Shopify admin → Notifications → Webhooks | **Do first** |
| `/api/boxly/webhook` | Boxly dental leads via Zapier | Zapier action URL | High |
| `/api/fathom/webhook` | Fathom: meetings, summaries, auto-tasks | Fathom → webhook settings | High |
| `/api/frameio/webhook`, `/api/frameio/action`, `/api/frameio/oauth/callback` | Frame.io | Frame.io webhook + custom action + app redirect URI | High |
| `/api/slack/interact` | Slack buttons | Slack app → Interactivity URL | Medium |
| `/api/slack/events` | Slack events (Atlas) | Slack app → Event Subscriptions | Medium |
| `/api/slack/commands` | Slack slash commands | Slack app → Slash Commands (each one) | Medium |
| `/auth/google/callback` | Staff sign-in with Google | Google Cloud Console → OAuth client → redirect URIs | **Before go-live**, or nobody can log in |
| `/api/drive/webhook` | Google Drive push notifications | Set `DRIVE_WEBHOOK_URL`; the 06:00 renew job re-registers it | Medium |

---

## 5. Code that assumes Vercel (change before or at cutover)

| Where | What | Change |
|---|---|---|
| `web/routes/frameio-oauth.ts:20` | Hard-coded `https://vendo-os.vercel.app/api/frameio/oauth/callback` | Use `APP_URL` |
| `web/lib/frameio/asana-handoff.ts:55` | Hard-coded dashboard link in Asana tasks | Use `APP_URL` |
| `web/lib/agents/agents/atlas-brief.ts:92-93` | Hard-coded meeting links in the brief prompt | Use `APP_URL` |
| `web/lib/agents/format/slackify.ts:26` | Falls back to `vendo-os.vercel.app` | Set `APP_URL` (the fallback then goes unused) |
| `web/lib/notifications.ts`, `video-notifications.ts` | Use `APP_URL`, else `VERCEL_PROJECT_PRODUCTION_URL` | Set `APP_URL` |
| `web/lib/drive-sync.ts:121` | Uses `DRIVE_WEBHOOK_URL`, else `VERCEL_PROJECT_PRODUCTION_URL` | Set `DRIVE_WEBHOOK_URL` |
| `web/lib/blob-uploads.ts` | **Vercel Blob** storage for report and suggestion screenshots (`@vercel/blob`, `BLOB_READ_WRITE_TOKEN`) | Move to new storage (S3/R2/Supabase Storage) **and migrate the existing files**, see below |
| `web/lib/agents/models.ts` | Atlas agents use AI SDK slugs that route through **Vercel AI Gateway** when available, otherwise the provider SDK | Off Vercel they use `ANTHROPIC_API_KEY` directly, so it **must be a valid key** (section 10) |
| `api/slack/events.ts`, `api/slack/commands.ts` | `waitUntil` from `@vercel/functions` | Ack, then process in the background |
| `web/server.ts`, `web/lib/auth.ts` | Branch on `process.env.VERCEL` | Leave `VERCEL` unset; set `NODE_ENV=production` |

**Vercel Blob files to migrate:** 18 rows in `client_report_screenshots.blob_url` point at `*.blob.vercel-storage.com`. Copy those files to the new storage and update the URLs **before** terminating Vercel, or the screenshots in those reports break.

---

## 6. Environment variables

These were backed up and shared by Toby. **New or changed values for the new host:**

| Name | Why |
|---|---|
| `APP_URL` | The new public base URL (used in links, invites and Slack) |
| `DRIVE_WEBHOOK_URL` | `<APP_URL>/api/drive/webhook` |
| `NODE_ENV=production` | Secure cookies |
| `DASHBOARD_PORT` | Port for `npm start` (default 3000) |
| `TYPESAFE_API_KEY` | **New on 26 Oct, so probably not in the backup.** Powers the auto-task filter (Jev). It's in Toby's local `.env.local`. |
| `ANTHROPIC_API_KEY` | Needs a **working** key (section 10) |
| Blob replacement credentials | Whatever the new file storage needs |
| Remove: `VERCEL`, `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_PROJECT_URL`, `BLOB_READ_WRITE_TOKEN`, `AI_GATEWAY_API_KEY` | Vercel-only |

The full list of names the code reads is everything matching `process.env.*` under `web/` and `api/`. At the time of writing that's 90 names, including Turso, Asana, Fathom, Slack (bot token, signing secret and webhook URLs), Google OAuth, Google Ads, Xero, Harvest, GoHighLevel (including the Squat Success token), Frame.io, Supabase portal, VAPID push keys, `SESSION_SECRET`, `TOKEN_ENCRYPTION_KEY(_PREVIOUS)` and `CRON_SECRET`. **Carry `SESSION_SECRET` and `TOKEN_ENCRYPTION_KEY` over unchanged**, or existing sessions and encrypted tokens stop working.

---

## 7. Cutover order

1. Deploy `main` to the new host. Set `APP_URL`, `NODE_ENV`, `TYPESAFE_API_KEY` and a working `ANTHROPIC_API_KEY`.
2. Mount the standalone `api/` functions (section 2a) and make the code changes in section 5.
3. Copy the 18 Blob screenshots across and update their URLs.
4. Add the new host's Google OAuth redirect URI, then check staff can log in.
5. Set up all 40 scheduled jobs with the `CRON_SECRET` header (section 3).
6. Repoint webhooks in this order: **Squat Success → Boxly → Fathom → Frame.io → Slack → Drive** (section 4).
7. Smoke test (below).
8. **Only then** delete the Vercel project and terminate the account. Deleting it stops every old cron and webhook straight away.
9. Remove the old Vercel URLs from Fathom, Shopify, Zapier, Frame.io, Slack and Google OAuth.

### Smoke test

- [ ] `/login` → Sign in with Google works for a staff account
- [ ] A cron called by hand with the bearer secret returns 200, and without it returns 401
- [ ] Squat Success: a test claim reaches the GoHighLevel "Book Interest" pipeline
- [ ] Boxly: a Zapier test event lands in the DB
- [ ] Fathom: the next real call creates grouped Asana tasks (one per owner) and **no** director tasks
- [ ] Slack: an "Add to my Asana" button works
- [ ] Frame.io: a comment event is archived to `frameio_events`
- [ ] The next morning: the Atlas brief arrives, and the filtered auto-tasks DM appears in Toby's Slack

---

## 8. Fathom → Asana auto-task changes (on `main`, live once deployed)

Built on 26 Oct after staff complaints about volume, wrong owners and items that weren't real tasks. An audit of all 2,337 assigned auto-tasks is in `outputs/analyses/auto-task-audit/`.

- **Filter before Asana** (`web/lib/asana/task-filter.ts`): if Fathom's suggested owner is on the client side, the item is dropped. Otherwise Jev (TypeSafe, `TYPESAFE_API_KEY`) reads the call summary, and an item is dropped when Jev is at least 80% sure it's a client action or not a real task. If Jev errors, the item is kept.
- **Name collisions:** a first name shared by two people on the call (e.g. the two Alfies) no longer resolves to whoever loaded last.
- **No account-manager fallback** for meeting tasks.
- **Directors opted out** (Toby, Max, Alfie Wakelin): their items go to the digest, not Asana.
- **One task per owner per call:** several items become subtasks of an "Actions from <meeting> – <date>" parent.
- **Dropped items** are logged to the new table `auto_task_filtered`, and a daily Slack DM goes to Toby via `SLACK_WEBHOOK_TOBY_DM`.
- **Tests:** `node --test --import tsx/esm web/lib/asana/task-filter.test.ts`. Dry run: `node --env-file=.env.local --import tsx/esm scripts/dry-run-task-filter.ts 7`.

---

## 9. Code still unmerged (not on `main`)

Recent work has been committed on feature branches and not merged. Code changes (not creative outputs) on `fix/auto-task-quality` / `feat/veltuff-bf-stuart-comments` that aren't on `main`:

- `4f36d3fd` fix(db): retry repeatable statements after a stale-socket hang-up (`web/lib/queries/base.ts`), worth taking
- Scripts only: Frame.io client comments sheet builder, Squat Success / Zen House copy sheets, creative wash-up pack (`scripts/`, run locally, not deployed)

About 15 other `feat/*` branches mostly hold creative outputs. Before wiring the new host to `main`, decide which branches to merge.

---

## 10. Known issues the new host will inherit

- **`ANTHROPIC_API_KEY` in Toby's local `.env.local` returns 401.** If production has the same key, Atlas agents and the auto-task duplicate checker have been failing (the checker fails open). Get a working key.
- **Meta access token is dead** (error 190, since about April 2026), so `sync-meta-ads` brings in no data.
- **Xero token is dead.**
- **Data freshness:** the GoHighLevel sync and the meeting action-item extraction have died silently before. Check `MAX(synced_at)` and the `cron_heartbeats` table after cutover.
- Vercel's Pro plan had 40 crons at its cap. The new scheduler has no such limit, but don't add duplicates.
