# Fix Churn Alerting & Broken Monitor Architecture

**Date:** 2026-04-17
**Trigger:** A client churn call was not flagged to `#claude-client-issues`. Investigation revealed the concern-detection pipeline and all 7 other monitors have not run against live data for 12 days.
**Owner:** Toby
**Status:** Phases 1–4 shipped on 2026-04-17. Follow-up items below.

---

## 1. Problem Statement

### What happened
A client expressed they wanted to leave during a Fathom-recorded call. No alert fired to `#claude-client-issues`. The AI concern-detection script (`scripts/analysis/detect-concerns.ts`) is designed to catch exactly this.

### Why it happened — two stacked failures

**Failure 1: Data path mismatch**
`detect-concerns.ts` and all 7 scripts in `scripts/monitors/` read and write a **local** `sql.js` file at `data/vendo.db` — not Turso. That file is gitignored, 156MB, and lives on individual laptops. Last modified on the canonical machine: **7 Apr**.

**Failure 2: Vercel cron can't execute the monitors**
The `/api/cron/monitors` route does `exec('npx tsx scripts/monitors/run-all-monitors.ts')`. On Vercel serverless this fails because:
- `tsx` is a devDependency, not in the function's `node_modules`
- `data/vendo.db` is gitignored, so there's nothing to read
- The serverless filesystem is ephemeral, so writes would vanish anyway
- The route catches the 500 and nothing alerts on the failure

### Evidence (from Turso, captured 2026-04-17)
| Metric | Value |
|---|---|
| Meetings in `meetings` | 462 |
| Meetings analysed (`meeting_concerns` rows) | 404 — so **58 recent meetings never analysed** |
| Last `meeting_concerns` row | 2026-04-05 19:15:18 |
| Last `monitor_alerts` row | 2026-04-05 19:15:20 |
| Historical severity split | 12 critical · 105 high · 33 medium |
| Local `data/vendo.db` mtime | 2026-04-07 |

### Blast radius
Same architectural issue affects: `fathom-failsafe` (keyword churn), `asana-overdue`, `meta-cpl-alert`, `meta-roas-alert`, `gads-cpa-alert`, `ad-spend-pacing`, `contract-renewal`. **None have fired against live data in 12 days.**

---

## 2. Scope

### In scope
- Real-time concern detection on every Fathom meeting
- Backfill analysis of the 58 unprocessed meetings since 5 Apr
- Porting all 7 monitors to run against Turso, in-process
- Failure alerting on the cron route itself

### Out of scope
- Changing the concern-detection prompt / model / severity thresholds
- Rebuilding the local-SQLite-on-laptops workflow (we're replacing it, not fixing it)
- New monitor types (that's a separate roadmap item)

---

## 3. Phased Plan

### Phase 1 — Real-time concern detection on webhook ingestion  *(priority)*
**Goal:** The next churn meeting alerts within seconds of the recording finishing. Directly addresses the miss that triggered this plan.

1. Extract concern-analysis core into a Turso-backed module (`web/lib/concern-detection.ts`):
   - Takes `{ meetingId, transcript, summary }`, runs the Haiku prompt
   - Writes to Turso `meeting_concerns` table (already exists)
   - Sends Slack alert via `SLACK_WEBHOOK_CONCERNS` on critical/high
   - Writes to Turso `monitor_alerts` for deduplication
2. Call it inline from `web/routes/fathom-webhook.ts` after the meeting upsert completes. ~2–4s added to webhook latency; still well under Fathom's 30s timeout.
3. Skip analysis when `calendar_invitees_domains_type === 'only_internal'` (internal meetings don't need client-concern scans).
4. Add integration test: signed webhook with a known-negative and known-positive transcript.

**Exit criteria:** A meeting with churn language lands in Turso + alerts `#claude-client-issues` within 10s of the webhook firing.

---

### Phase 2 — Backfill the 58 unprocessed meetings
**Goal:** Catch any churn risk that happened during the 12-day blind spot.

1. One-off script `scripts/backfill/analyse-missed-concerns.ts`:
   - Query Turso for meetings where `concern_analysed_at IS NULL` (or missing from `meeting_concerns`)
   - Run each through the new `web/lib/concern-detection.ts` module
   - **Don't** send Slack alerts for historical meetings (noise); instead write a single summary report to `outputs/analyses/churn-backfill-2026-04-17.md` listing any critical/high findings for manual triage
2. Run locally, commit the report, triage findings with SLT.

**Exit criteria:** Zero meetings remain unanalysed. Toby has a triage list of anything critical that was missed.

---

### Phase 3 — Port the 7 monitors to Turso
**Goal:** Hourly cron actually runs the monitor suite against live data.

1. Refactor each monitor in `scripts/monitors/*` to accept a Turso client rather than loading sql.js:
   - `asana-overdue` · `meta-cpl-alert` · `meta-roas-alert` · `gads-cpa-alert` · `ad-spend-pacing` · `contract-renewal` · `fathom-failsafe`
2. Replace the `exec('npx tsx …')` pattern in `web/routes/api/cron.ts` with direct imports and in-process execution. Kills the child-process failure mode entirely.
3. `fathom-failsafe` becomes largely redundant once Phase 1 ships (AI-based detection is strictly better than keyword matching on transcripts). Decide: retire it, or keep as a fallback for simple/high-recall cases.
4. Delete the `data/vendo.db` / `sql.js` local path for monitors (no longer the source of truth).

**Exit criteria:** `/api/cron/monitors` executes in-process, completes in <60s, and we can see it writing to Turso `monitor_alerts` on the hour.

---

### Phase 4 — Detect future silent failures
**Goal:** Never again let a broken monitor go unnoticed for 12 days.

1. Add a heartbeat table in Turso: `cron_heartbeats(job TEXT, last_success_at TEXT, last_error TEXT)`.
2. Every cron route updates its heartbeat on success and failure.
3. Add a **meta-monitor** (itself on the hourly cron) that pages `#alerts` if any job has `last_success_at > 2 hours ago` — detects both outright failures and silent skips.
4. Bonus: surface heartbeat status on the dashboard sync-status page.

**Exit criteria:** Deliberately breaking any monitor triggers a Slack alert within 2 hours.

---

## 4. Risks & Considerations

| Risk | Mitigation |
|---|---|
| Haiku false positives on internal/friendly meetings after broadening to every webhook | Skip `only_internal` meetings; trust the existing conservative prompt; review backfill output before enabling alerts |
| Webhook latency spike if Anthropic API is slow | Timeout AI call at 8s; on failure, upsert meeting anyway + enqueue for retry later |
| Doubled alerts during transition (new inline + old laptop run) | Deprecate local `detect-concerns.ts` invocation before Phase 1 ships |
| Churn risk detected after-hours with nobody watching Slack | Out of scope — existing channel routing decision |
| Concern-detection wrapped in the webhook means a prompt change requires a redeploy | Accept — redeploys take 90s on Vercel |

---

## 5. Sequencing & Estimate

| Phase | Estimate | Blocks | Ship target |
|---|---|---|---|
| 1 — Real-time webhook analysis | 2–3h | Nothing (Fathom webhook already live) | **This week** |
| 2 — Backfill | 1h | Phase 1 module | Same day as Phase 1 |
| 3 — Monitor port to Turso | 1–2 days | Nothing | Next week |
| 4 — Heartbeat + meta-monitor | 0.5 day | Phase 3 | Next week |

---

## 6. Open Questions

1. Should the AI concern detector *also* create an Asana task (like `fathom-failsafe` does) or stay Slack-only?
2. Which channel should medium-severity concerns go to, if any? Currently ignored.
3. Do we want CRM linking (the Fathom webhook includes `crm_matches`) in the alert message — e.g. a HubSpot deep-link?
4. Retire `fathom-failsafe` after Phase 1, or keep as a belt-and-braces keyword fallback?

---

## 7. Not Doing (Yet)

- Moving daily brief / traffic-light crons off the `exec` pattern — they hit Slack webhooks rather than needing the local DB, so they're slightly less broken. Tackle in a follow-up.
- Moving away from Turso for this. Turso is working fine; the issue is scripts not using it.
- Replacing Haiku with a larger model. Haiku has been performing acceptably (404 analysed, credible severity distribution); upgrade only if post-backfill review shows gaps.

## 8. Completion log — 2026-04-17

All four phases shipped the same day. Live validation confirmed each piece.

| Phase | Commit | Status |
|---|---|---|
| 1 — Real-time concern detection on Fathom webhook | `4e10edd` | Live — first catch: Just Smile call tracking concern from 4 Apr |
| Enrichment — client-match + categorise on webhook | `8604bd8` | Live — R-Dental test mapped to "Ranka Ltd" via email_domain |
| 2 — Backfill | *descoped* | 43 "unanalysed external" meetings turned out to be onboarding/interview titles the old detector intentionally excluded. No real backfill needed. |
| 3 — Monitor port to Turso + in-process cron | `494f587`, `d8c0a5c` | Live — 6 monitors run in 2–3s per cron tick, heartbeats written |
| 4 — Cron heartbeat meta-monitor | `480621a` | Live — pages `#alerts` if any job stale >2h or freshly errored |

Code shipped:
- `web/lib/concern-detection.ts` — Turso-native AI concern detector
- `web/lib/meeting-enrichment.ts` — Turso-native client-match + categorisation
- `web/lib/monitors/{asana-overdue,meta-cpl,meta-roas,gads-cpa,ad-spend-pacing,contract-renewal,cron-heartbeat,run-all,base}.ts`
- `web/routes/fathom-webhook.ts` — enrichment + concern detection wired in
- `web/routes/api/cron.ts` — `/monitors` now calls `runAllMonitors()` in-process
- `cron_heartbeats` table auto-created

Follow-up items:
1. **Old monitor scripts in `scripts/monitors/*.ts`** still exist and npm `monitor:*` scripts still point to them. Local runs use sql.js + stale `data/vendo.db`. Delete once the Vercel cron is proven stable over a week.
2. **Remaining crons still exec `npx tsx`**: `/api/cron/daily-brief`, `/health-score`, `/traffic-light`, `/sync-actions-to-asana`. Same Turso port needed — tracked as follow-up, not urgent since they mostly hit external APIs.
3. **`clients.monthly_budget` column missing in Turso** — `ad-spend-pacing` detects this and skips gracefully. Adding the column needs a data-entry decision (source of truth).
4. **Open questions from §6** still unanswered: Asana task on concern? medium-severity channel? retire `fathom-failsafe`? Resolve when confidence in live behaviour is built up.
