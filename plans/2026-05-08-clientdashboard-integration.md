# ClientDashboard ↔ VendoOS Integration Plan

**Status:** Approved (architectural shape, 2026-05-08)
**Supersedes:** `2026-04-17-client-hub.md` — ClientDashboard fulfils the Client Hub goal directly.

---

## TL;DR

ClientDashboard (Next.js 16 + Supabase + Drizzle, at `/Users/Toby_1/ClientDashboard`) becomes the **client-facing portal**. VendoOS stays as the **staff cockpit + sync engine**. They share `clients` via a one-way bridge keyed on `organisations.external_vendo_id`. Per-client OAuth replaces VendoOS's central ad-account mapping for the new portal — central mapping stays in VendoOS for staff dashboards only.

---

## Decisions made

| Decision | Choice | Why |
|---|---|---|
| Domain split | ClientDashboard = client portal; VendoOS = staff cockpit + sync | Don't rewrite working code; ClientDashboard already covers what `/portal/*` was meant to be |
| Deployment | Two Vercel projects, two domains | `portal.vendodigital.co.uk` (ClientDashboard), existing host (VendoOS) |
| Database | Two DBs. Postgres (Supabase) = system-of-record for entities ClientDashboard owns. Turso = VendoOS's sync + intelligence working memory | Avoids a multi-week data migration before delivering value |
| Bridge | One-way: VendoOS `clients` → ClientDashboard `organisations` (idempotent on slug) | VendoOS is canonical for client identity today |
| OAuth model | **Per-client OAuth.** Each client connects Meta / Google Ads / GA4 / GSC / GHL inside the portal | Aligns with ClientDashboard's existing flows; encrypted per-org tokens; cleaner long-term |
| Central account mappings in VendoOS | Stay for staff ops dashboards | Frame.io, Asana, Harvest, Xero, profitability all depend on `client_source_mappings` — don't disturb |
| Auth | Supabase Auth for portal users (with MFA available); existing cookie-auth stays for VendoOS staff | No SSO unification in scope yet |
| Sync code ownership | ClientDashboard runs its own Inngest sync per-client OAuth. VendoOS keeps its sync for staff-side dashboards only | Each app owns its data path; no double-write |

---

## Architecture

```
┌─────────────────────────────────────┐    ┌──────────────────────────────────┐
│  CLIENT PORTAL (ClientDashboard)    │    │  STAFF COCKPIT (VendoOS)         │
│  portal.vendodigital.co.uk          │    │  vendo-os.vercel.app             │
│                                     │    │                                  │
│  • Login (Supabase Auth + MFA)      │    │  • /clients, /meetings           │
│  • Onboarding questionnaires        │    │  • /dashboards/*                 │
│  • Education courses                │    │  • /operations, /admin           │
│  • Per-client OAuth (Meta/Google…)  │    │  • Frame.io mapping              │
│  • Dashboards (Meta/Google/GA4/GSC) │    │  • Daily briefs, agent skills    │
│  • Deliverables (LP/VSL/ad copy)    │    │  • All current cron syncs        │
│  • Monthly PDF reports              │    │                                  │
│                                     │    │                                  │
│  ▼ writes to                        │    │  ▼ writes to                     │
│  Supabase Postgres                  │    │  Turso (LibSQL)                  │
│  ─ organisations                    │    │  ─ clients (canonical)           │
│  ─ user_profiles                    │    │  ─ meetings, action_items        │
│  ─ platform_connections             │    │  ─ xero_*, harvest_*, asana_*    │
│  ─ campaign/ad/audience_insights    │    │  ─ frameio_*, ghl_*              │
│  ─ ga4_sessions, gsc_queries        │    │  ─ client_source_mappings        │
│  ─ questionnaire_*, deliverables    │    │  ─ profitability, health         │
│  ─ reports                          │    │                                  │
└─────────────────────────────────────┘    └──────────────────────────────────┘
                  ▲                                       │
                  │  push: clients → organisations        │
                  └───────────────────────────────────────┘
                     scripts/sync/push-clients-to-portal.ts
                     (signed, idempotent, hourly cron)
```

---

## Phase 0 — Reconciliation (1–2 days)

**Goal:** Confirm the integration is buildable before moving anything. Output is a doc, not code.

- [ ] **0.1** Verify ClientDashboard deploy state. Is it on Vercel? Is `portal.vendodigital.co.uk` claimed? Does Supabase project exist with migrations applied?
- [ ] **0.2** Schema delta: walk every column of VendoOS `clients` and confirm a home in ClientDashboard `organisations`. Document gaps in `plans/clientdashboard-schema-delta.md`. Known gaps to investigate:
  - VendoOS `clients` has aliases (array), vertical, status, contract dates — does `organisations` have equivalents or do we need columns?
  - VendoOS portal users live in `portal_users` table — map to ClientDashboard `user_profiles`.
- [ ] **0.3** Auth model decision recap: portal users get fresh Supabase accounts with magic-link-or-temp-password seeding. They are not synced from VendoOS users; only `clientId → organisation_id` linkage matters.
- [ ] **0.4** Identify minimal seed: 5 pilot clients (mix of verticals) for Phase 2 cut-over. Don't migrate all 75 at once.
- [ ] **0.5** Document the read-only API VendoOS exposes for ClientDashboard staff features that aren't moving (e.g. "show last meeting summary on org page" — optional, future).

---

## Phase 1 — Bridge (3–5 days)

**Goal:** ClientDashboard and VendoOS know about the same clients.

- [ ] **1.1** Add migration to ClientDashboard: `organisations.external_vendo_id INTEGER UNIQUE NULL`. (One Drizzle migration file.)
- [ ] **1.2** Add Supabase service-role key to VendoOS env: `PORTAL_SUPABASE_URL`, `PORTAL_SUPABASE_SERVICE_ROLE_KEY`.
- [ ] **1.3** Build `scripts/sync/push-clients-to-portal.ts`:
  - Reads `clients` from Turso
  - Upserts into Supabase `organisations` (key: `external_vendo_id`)
  - Maps: name → name, slug → slug, vertical → verticalId (lookup), logoUrl → logoUrl
  - Idempotent: dry-run flag, `--client <id>` flag for single sync
- [ ] **1.4** Add Vercel cron to VendoOS: `0 */6 * * *` runs the sync.
- [ ] **1.5** Smoke test on the 5 pilot clients.

---

## Phase 2 — Portal cut-over (1–2 weeks)

**Goal:** First pilot clients log into ClientDashboard instead of `/portal/*`.

- [ ] **2.1** Pilot user seeding: for each of the 5 pilots, create a `user_profiles` row + Supabase auth user with `client_admin` role. Send Supabase magic-link invitation.
- [ ] **2.2** Configure ClientDashboard env vars (Resend, OAuth credentials for Google/Meta, Inngest keys, token encryption key).
- [ ] **2.3** Walk one pilot client through per-client OAuth (Meta, Google Ads, GA4, GSC). Verify Inngest sync populates dashboards.
- [ ] **2.4** Compare ClientDashboard portal data side-by-side with VendoOS `/portal/*` for the same date range. Reconcile discrepancies.
- [ ] **2.5** Roll out to remaining clients in batches of ~10. Monitor support load.
- [ ] **2.6** Add 301 redirect: `/portal/*` on VendoOS → `https://portal.vendodigital.co.uk/dashboard`.
- [ ] **2.7** Mark VendoOS `portal_users` as deprecated; lock further creations.

---

## Phase 3 — Onboarding / Education / Deliverables (2–3 weeks)

**Goal:** Activate ClientDashboard's purpose-built features.

- [ ] **3.1** Configure `questionnaire_templates` per Vendo vertical (start with Dental — it's the most-developed in VendoOS skills). One template per vertical, versioned.
- [ ] **3.2** Set up `integration_guides` for Meta / Google / GHL / GA4 / GSC. Pull copy from VendoOS's existing onboarding scripts where possible.
- [ ] **3.3** Education: seed initial courses (Vendo onboarding, "How we work", platform tutorials).
- [ ] **3.4** Deliverables wiring: ClientDashboard has `deliverables` table with `type ∈ {lp_brief, meta_ad_script, vsl_script}`. Connect VendoOS skills (`landing-page-brief`, `meta-ad-copy`, `creative-strategist`) as upstream content generators — call them from a server action, persist output in `deliverables.content`.
- [ ] **3.5** Activate Inngest `report-generator` for the pilot clients. Validate PDF output against existing client-reports rules (see `feedback_client_reports_rules.md`).
- [ ] **3.6** Roll out report generation to all clients.

---

## Phase 4 — Steady state (ongoing)

- VendoOS keeps shipping internal features (Frame.io, profitability, daily briefs, etc.).
- ClientDashboard keeps shipping client-facing features.
- Cross-system reads use the signed VendoOS API or the bridge sync — no shared writes.
- Revisit single-DB consolidation in 6+ months once both are stable.

---

## Open questions

1. **Domain provisioning** — who owns DNS for `portal.vendodigital.co.uk`? Need to confirm before Phase 2.
2. **Resend sender** — the global memory says we use `Vendo Digital <noreply@vendodigital.co.uk>`. Confirm that's still the right sender for portal emails.
3. **Custom conversions** — VendoOS doesn't currently track these but ClientDashboard does. Are there agreed conversion definitions per client, or is this a fresh capability for clients to define?
4. **Lesson files / Tiptap content** — ClientDashboard expects Supabase Storage for lesson files. Confirm Storage is provisioned in the Supabase project.
5. **Existing `/portal/*` data backfill** — do we backfill historical ad spend / GA4 / GSC into Postgres, or only forward-only sync? Recommended: forward-only, with a one-time "last 90 days" backfill per client at Phase 2 cut-over.

---

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| 75 clients re-onboarding OAuth = high friction | High | Pilot first, batch rollout, white-glove onboarding for top accounts. AM does it on a screen-share if needed. |
| Schema mismatch on niche fields (aliases, contract dates) | Medium | Phase 0 schema delta surfaces this before Phase 1. Add columns to `organisations` as needed. |
| Two-DB drift (org exists in Postgres but client deleted in Turso) | Medium | Sync script handles deletes via soft-archive (`archivedAt`). Monitor mismatched-row count weekly. |
| ClientDashboard staging vs production envs not yet defined | Medium | Clarify in Phase 0.1. |
| Frame.io / Asana / Harvest never make it into ClientDashboard | Low (acceptable) | These are staff-side; no need to expose in portal. Document so future contributors don't try. |
| Cost: Supabase + Turso both billed | Low | Both are cheap at this scale. Budget likely under £50/mo combined for a year. |

---

## What this plan deliberately does NOT do

- Migrate VendoOS sync code into ClientDashboard. Per-client OAuth replaces it from the portal side.
- Sunset the VendoOS web layer. Staff cockpit stays Fastify+Eta indefinitely.
- Unify auth across both apps (no shared SSO yet).
- Move meetings / action items / profitability data into Postgres (out of scope; possibly Phase 5+).
- Touch the Frame.io integration that just shipped.

---

## Next action

Phase 0.1: confirm ClientDashboard's current deploy state (Vercel project? Supabase project? domain?). Until that's known, Phase 1 work is blocked.
