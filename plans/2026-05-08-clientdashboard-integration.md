# ClientDashboard ↔ VendoOS Integration Plan

**Status:** Phase 1 complete + portal live (2026-05-11)
**Supersedes:** `2026-04-17-client-hub.md` — ClientDashboard fulfils the Client Hub goal directly.

---

## TL;DR

ClientDashboard (Next.js 16 + Supabase + Drizzle, at `/Users/Toby_1/ClientDashboard`, repo `toby-vend/vendo-client-portal`) is the **client-facing portal**. VendoOS stays as the **staff cockpit + sync engine**. They share clients via a one-way bridge keyed on `organisations.external_vendo_id`. Per-client OAuth replaces VendoOS's central ad-account mapping for the new portal — central mapping stays in VendoOS for staff dashboards only.

---

## Status snapshot — 2026-05-11

| Phase | Status | Notes |
|---|---|---|
| 0 — Reconciliation | ✅ done | Schema delta written (`2026-05-08-clientdashboard-schema-delta.md`), CD verified, Supabase project resurrected |
| 1 — Bridge | ✅ done | 159 orgs synced (74 active + 85 archived), cron firing every 6h, smoke-tested |
| 2 — Portal cut-over | ⏸ partial | Tooling in place; blocked on DNS + Resend + pilot client list |
| 3 — Onboarding / Education / Deliverables | ⏸ partial | Dental + ecom questionnaire templates seeded; education and deliverables pending |
| 4 — Steady state | not yet | |

**Portal URL:** `https://vendo-client-portal.vercel.app` (custom domain `portal.vendodigital.co.uk` pending DNS)
**Production DB:** `https://uipuopmtvwnjmjfpuert.supabase.co` (eu-west-1 pooler)
**Super-admin seeded:** `toby@vendodigital.co.uk` on `Vendo Digital (internal)` org

---

## Decisions made (unchanged)

| Decision | Choice | Why |
|---|---|---|
| Domain split | ClientDashboard = client portal; VendoOS = staff cockpit + sync | Don't rewrite working code; ClientDashboard already covers what `/portal/*` was meant to be |
| Deployment | Two Vercel projects, two domains | `portal.vendodigital.co.uk` (ClientDashboard), `vendo-os.vercel.app` (VendoOS) |
| Database | Two DBs. Supabase Postgres = system-of-record for portal entities. Turso = VendoOS intelligence layer | Avoids a multi-week data migration before delivering value |
| Bridge | One-way VendoOS `clients` → CD `organisations`, idempotent on `external_vendo_id` | VendoOS is canonical for client identity today |
| OAuth model | Per-client OAuth (clients connect Meta/Google/etc. inside the portal) | Aligns with CD's existing flows; encrypted per-org tokens |
| Central account mappings in VendoOS | Stay for staff ops dashboards | Frame.io, Asana, Harvest, Xero, profitability depend on `client_source_mappings` |
| Auth | Supabase Auth + MFA for portal; existing cookie-auth for VendoOS staff | No SSO unification in scope yet |
| Sync code ownership | CD runs its own Inngest sync per-client OAuth (future); VendoOS keeps its sync for staff dashboards | Each app owns its data path; no double-write |

---

## Architecture (as deployed)

```
┌─────────────────────────────────────┐    ┌──────────────────────────────────┐
│  CLIENT PORTAL (ClientDashboard)    │    │  STAFF COCKPIT (VendoOS)         │
│  vendo-client-portal.vercel.app     │    │  vendo-os.vercel.app             │
│  → portal.vendodigital.co.uk (TBD)  │    │                                  │
│                                     │    │  • /clients, /meetings           │
│  • Login (Supabase Auth + MFA)      │    │  • /dashboards/*                 │
│  • Onboarding questionnaires        │    │  • /operations, /admin           │
│  • Education courses (empty)        │    │  • Frame.io mapping              │
│  • Per-client OAuth (Meta/Google…)  │    │  • Daily briefs, agent skills    │
│  • Dashboards (Meta/Google/GA4/GSC) │    │  • All current cron syncs        │
│  • Deliverables (tables ready)      │    │                                  │
│  • Monthly PDF reports              │    │                                  │
│                                     │    │                                  │
│  Supabase Postgres                  │    │  Turso (LibSQL)                  │
│  uipuopmtvwnjmjfpuert.supabase.co   │    │                                  │
│  ─ 17 migrations applied            │    │  ─ clients (canonical, 159)      │
│  ─ 159 organisations                │    │  ─ meetings, action_items        │
│  ─ verticals seeded (4)             │    │  ─ xero_*, harvest_*, asana_*    │
│  ─ 1 super_admin user_profile       │    │  ─ frameio_*, ghl_*              │
│  ─ 2 questionnaire templates        │    │  ─ client_source_mappings        │
│  ─ Tables for: platform_connections │    │                                  │
│    deliverables, reports, courses,  │    │                                  │
│    notifications, etc.              │    │                                  │
└─────────────────────────────────────┘    └──────────────────────────────────┘
                  ▲                                       │
                  │  push: clients → organisations        │
                  └───────────────────────────────────────┘
                     scripts/sync/push-clients-to-portal.ts
                     /api/cron/push-clients-to-portal (0 */6 * * *)
```

---

## Phase 0 — Reconciliation ✅

- [x] **0.1** Verify ClientDashboard deploy state — turned out CD was never on Vercel; the original Supabase project was paused but recoverable.
- [x] **0.2** Schema delta — see `2026-05-08-clientdashboard-schema-delta.md`. Only two new columns added: `organisations.external_vendo_id` and `organisations.contact_email`. Aliases / financials / meetings stay in Turso.
- [x] **0.3** Auth model recap — confirmed magic-link / temp-password for portal users; no sync from VendoOS users.
- [ ] **0.4** Pilot client list — deferred. Will pick at Phase 2 kick-off.
- [ ] **0.5** Read-only VendoOS API — not needed yet; CD reads via its own sync path.

---

## Phase 1 — Bridge ✅

- [x] **1.1** Migration `00016_external_bridge.sql` — adds `external_vendo_id` + `contact_email` to `organisations`, seeds 4 canonical verticals (dental, ecom, plant-hire, other).
- [x] **1.2** VendoOS `.env.local` has `PORTAL_SUPABASE_URL` + `PORTAL_SUPABASE_SERVICE_ROLE_KEY`.
- [x] **1.3** `scripts/sync/push-clients-to-portal.ts` — idempotent, `--dry-run`, `--client <id>` flags. Refactored into `web/lib/jobs/push-clients-to-portal.ts` so the cron and CLI share one path.
- [x] **1.4** Vercel cron `/api/cron/push-clients-to-portal` registered at `0 */6 * * *`.
- [x] **1.5** Smoke-tested: 32/32 routes (16 admin + 8 client) render cleanly; bridge sync writes 159 rows in <5s.

### Live data (verified by `scripts/verify-portal.mjs`)

```
total:    163  (159 bridged + 1 internal + 3 pre-existing test rows)
archived:  85
with_email: 138
by vertical: other 145, dental 14, ecom 4, plant-hire 0
```

---

## Phase 2 — Portal cut-over ⏸

- [ ] **2.1** Pilot user seeding — script: `scripts/seed-super-admin.mjs` adapted for `client_admin`. Pilot list TBD.
- [ ] **2.2** Configure remaining CD env vars on Vercel:
  - `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` (when Phase 3 jobs activate)
  - `GOOGLE_ADS_DEVELOPER_TOKEN` (when first client OAuths into Google Ads)
  - `RESEND_API_KEY` (when sending real emails)
- [ ] **2.3** Walk one pilot client through per-client OAuth.
- [ ] **2.4** Compare CD portal data side-by-side with VendoOS `/portal/*`.
- [ ] **2.5** Batch rollout to remaining clients.
- [ ] **2.6** `/portal/*` 301 redirect on VendoOS.
- [ ] **2.7** Lock `portal_users` table on VendoOS side.

**Blocking items for Phase 2:**
1. DNS for `portal.vendodigital.co.uk`
2. Resend account + verified `vendodigital.co.uk` sending domain
3. Supabase Auth → URL Configuration updated to production URL (currently `localhost:3000`)

---

## Phase 3 — Onboarding / Education / Deliverables ⏸

- [x] **3.1** Questionnaire templates:
  - Dental — 8 sections, 47 questions, published & current (from `00006`)
  - E-commerce — 8 sections, 52 questions, published & current (fixed via `00018` after slug mismatch)
  - Plant-hire — deferred, needs question list from team
- [ ] **3.2** `integration_guides` for Meta / Google / GHL / GA4 / GSC — `integration_guide_templates` table exists but is empty. Seed pending.
- [ ] **3.3** Education courses — `courses`/`sections`/`lessons` tables exist, no content seeded yet.
- [ ] **3.4** Deliverables wiring — `deliverables` table now exists (via `00017`); needs admin UI button + server action that calls a VendoOS skill and persists the output.
- [ ] **3.5** Inngest `report-generator` activation — pending Inngest env vars.
- [ ] **3.6** Roll out report generation to all clients.

---

## Phase 4 — Steady state — not yet

- VendoOS keeps shipping internal features (Frame.io, profitability, daily briefs).
- ClientDashboard keeps shipping client-facing features.
- Cross-system reads use the signed VendoOS API or the bridge sync — no shared writes.
- Revisit single-DB consolidation in 6+ months once both are stable.

---

## Deviations & surprises (execution log)

Worth flagging because future sessions will hit similar things:

1. **Original Supabase project was paused, not deleted.** First DNS check returned NXDOMAIN; second check (a day later) returned 401. Free-tier Supabase projects pause after ~7 days inactivity; resume on next access.
2. **4 tables were defined in Drizzle schema but had no migration.** Hit at `/admin/clients/[id]` with `relation "deliverables" does not exist`. Fixed in `00017_missing_tables.sql` (deliverables, deliverable_templates, email_logs, notification_preferences). Added `scripts/check-missing-tables.mjs` to catch this in future.
3. **E-commerce template seed used the wrong slug.** Migration `00006` joined on `slug='ecommerce'` but our verticals seed (`00016`) uses `slug='ecom'`. Fixed in `00018_ecom_template_seed.sql`.
4. **Two pre-existing module-load errors in CD blocked the build.** `agency-tokens.ts` missing `getAgencyTokenIdForPlatform` export; `connectors/registry.ts` missing the `Exclude<PlatformType, 'google'>` workaround. Both restored from commit `fd16c174` where they'd existed previously.
5. **Vercel rejected the first push because of inngest CVE-2026-INNGEST.** Bumped `inngest@3.52.6 → 3.54.2` with `--legacy-peer-deps` (svelte-kit optional peer conflict on vite).
6. **Vercel rejected the next push because commit author `Toby@Tobys-MacBook-Pro.local` wasn't verified on GitHub.** Set `git config user.email toby@vendodigital.co.uk` in the CD repo.
7. **GitHub default branch was `feat/offers-pricing-rewrite`, not `main`.** Vercel inherited that on import; production deploys went to the wrong branch until production branch was switched manually.
8. **VendoOS `clients.vertical` is almost entirely NULL.** Only 11 rows have `'dental'`; the rest are NULL. The bridge mapper does its best (dental → dental, everything else → other). Re-categorisation has to happen in the portal admin UI or via `scripts/categorise-orgs.mjs` with a paste of names.
9. **Magic-link emails go to localhost:3000.** Supabase Auth `Site URL` was never updated from dev. Needs manual fix before Phase 2.

---

## Open questions (still open)

1. **Domain provisioning** — DNS for `portal.vendodigital.co.uk` not yet pointed at Vercel.
2. **Resend setup** — account not yet created; sending domain not verified.
3. **Plant-hire questionnaire** — needs question list from the team.
4. **AM identification** — no single source of truth in VendoOS for "which staff owns which client". Phase 2 needs a decision before AM seeding into `am_assignments`.
5. **Custom conversions** — VendoOS doesn't track; CD does. Define per-client, or fresh capability for clients to define themselves?
6. **Lesson files / Tiptap content** — Storage bucket `lesson-files` from `00014` needs to exist in Supabase. Not yet verified.
7. **Existing `/portal/*` data backfill** — forward-only sync vs 90-day historical backfill? Recommend forward-only.

---

## Tooling reference

**In `vendo-client-portal`:**

| Script | Purpose |
|---|---|
| `scripts/apply-migration.mjs` | Apply one or all `supabase/migrations/*.sql` via `DATABASE_URL` |
| `scripts/check-missing-tables.mjs` | Diff Drizzle schema vs DB tables (catches drift) |
| `scripts/dump-orgs.mjs` | List all organisations grouped by vertical |
| `scripts/categorise-orgs.mjs <vertical> [--dry-run]` | Bulk-update `vertical_id` by name/id from stdin |
| `scripts/inspect-templates.mjs` | Surface questionnaire-template state |
| `scripts/seed-super-admin.mjs <email> [<pw>]` | Create + link a super_admin |
| `scripts/smoke-test.mjs` | Dual-pass (admin + client) auth+crawl of 32 portal routes |
| `scripts/verify-portal.mjs` | Counts post-bridge state |

**In `vendo-os`:**

| Script / route | Purpose |
|---|---|
| `npm run sync:portal -- --dry-run` | Manual bridge sync (CLI) |
| `GET /api/cron/push-clients-to-portal` | Bridge sync (Vercel cron, every 6h, auth: `Bearer ${CRON_SECRET}`) |
| `scripts/query/vertical-distribution.ts` | Count distinct vertical values in Turso |

---

## Risk register

| Risk | Likelihood | Status |
|---|---|---|
| Schema/migration drift surfaces during pilot | Medium → Low | Mitigated by `check-missing-tables.mjs` + dual-pass smoke test |
| Two-DB drift (org in Postgres but client deleted in Turso) | Medium | Sync uses `archived_at`, not delete. Worth a weekly count comparison. |
| Bulk re-onboarding OAuth = high friction | High | Pilot first, white-glove AM-led for top accounts |
| Supabase free tier pauses again | Low | Upgrade to Pro before pilot launch; ~£25/mo |
| Cron commit author check rejects future syncs | Low | Git config now set in both repos |
| Frame.io / Asana / Harvest never make it into CD | Acceptable | They're staff-only; intentional |

---

## What this plan deliberately does NOT do (unchanged)

- Migrate VendoOS sync code into ClientDashboard.
- Sunset the VendoOS web layer.
- Unify auth across both apps.
- Move meetings / action items / profitability data into Postgres.
- Touch the Frame.io integration.

---

## Next action

Phase 2 unblocks when these three land:

1. DNS — point `portal.vendodigital.co.uk` at Vercel
2. Resend — create account, verify `vendodigital.co.uk` sending domain
3. Supabase Auth Site URL — change from `localhost:3000` to production

After that: pick 1 pilot dental client, seed the user_profile via `seed-super-admin.mjs --role client_admin`, walk them through OAuth, compare data against current VendoOS `/portal/*`.

In parallel I can keep building Phase 3 features (education course seed, deliverables-to-skills wiring) since none of them block on the above.
