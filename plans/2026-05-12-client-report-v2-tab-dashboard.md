# Plan: Client Report v2 — Tab-based dashboard

**Author:** Toby
**Date:** 2026-05-12
**Branch:** `feat/client-report-v2` (to be created from `main`)
**Status:** Draft — awaiting approval before implementation

---

## 1. Goal

Replace the screenshots-of-numbers client report with a structured, tab-based performance dashboard that matches the design supplied in `Vendo Reporting.zip` — pixel-for-pixel where reasonable, feature-for-feature in full.

**Audience:** Both internal team and clients. Internal users hit `/admin/reports/:id/view`; clients log into their existing portal and hit `/portal/reports/:id/view`, gated by the existing portal auth (`request.user.clientId`) — no share tokens, no magic links.
**Workflow:** Runs alongside the existing draft → review → final editor flow; doesn't replace it on day one.
**Stack:** React SPA bundle compiled by esbuild (mirroring the `/chat` island pattern), loaded into an Eta server shell.
**Scope:** All five tabs (Overview, Summary, Paid Social, Paid Search, Organic Search), GBP & GeoGrid show "Coming soon" placeholders.

---

## 2. Mockup audit — what we're building

From `Vendo Reporting.zip`:

| Tab | Components | Data needed |
|---|---|---|
| **Overview** | 4 KPI cards (spend/leads/CPL/revenue) with 30-day sparklines, 3-card channel grid (Meta/Google/SEO) with deltas, sortable treatment-breakdown table | Daily Meta + Google spend; GHL leads + revenue + treatment (from campaign-name mapping); GA4 organic |
| **Summary (AI)** | AI-generated headline + Wins / Watch / Focus pillars, topline mirror | Existing `generateReportInsights` output, adapted |
| **Paid Social (Meta)** | 8 topline tiles (spend, clicks, leads, CPL, bookings, CPB, revenue, ROAS) each with sparkline, campaigns table, top-4 creative cards with thumbnails, audience list | `meta_insights` (campaign + creative levels), GHL bookings (`Booked Appointment` pipeline) keyed to source |
| **Paid Search (Google)** | 8 topline tiles, campaigns table, top-6 keywords table, device split | `gads_campaign_spend`, `gads_keyword_stats`, GHL bookings keyed to source |
| **Organic Search (SEO)** | Segmented 30d/90d toggle, 6 topline tiles, 3 insight cards, 24-month Search Console multi-series chart with hover, **GeoGrid widget (placeholder)**, **GBP widget (placeholder)**, top pages + queries tables, site-health tiles | `gsc_daily`, `gsc_queries`, `gsc_pages`, `ga4_daily`. GBP + GeoGrid not yet wired. |

Cross-cutting: sidebar with brand/client switch/nav, topbar with breadcrumb + date picker + Download PDF + Export + Share, Tweaks panel (dark mode/accent hue/density/date range — internal only), light/dark theming, JetBrains Mono for numbers, `oklch()` colour space.

---

## 3. Architecture

```
GET /admin/reports/:id/view        (internal — requireTeamUser)
GET /portal/reports/:id/view       (client-facing — existing portal session,
                                    asserts request.user.clientId === report.client_id;
                                    admin preview via ?clientId= per existing pattern)
  │
  ├─ Eta shell page renders:
  │    <link  href="/assets/client-report.css">
  │    <script>window.VENDO_REPORT = { …JSON payload…, mode: 'internal'|'client' }</script>
  │    <div id="report-root"></div>
  │    <script src="/assets/client-report.js"></script>
  │
  └─ React bundle (compiled by scripts/build-client-report.ts):
       web/client/client-report/main.tsx
        ├─ App.tsx                    (sidebar, topbar, tab switching, tweaks)
        ├─ tabs/OverviewTab.tsx
        ├─ tabs/SummaryTab.tsx
        ├─ tabs/MetaTab.tsx
        ├─ tabs/GoogleTab.tsx
        ├─ tabs/SeoTab.tsx
        ├─ components/Sparkline.tsx
        ├─ components/KpiCard.tsx
        ├─ components/DataTable.tsx
        ├─ components/Delta.tsx
        ├─ components/ChannelCard.tsx
        ├─ components/AiSummary.tsx
        ├─ components/SearchConsoleChart.tsx
        ├─ components/GeoGridPlaceholder.tsx
        ├─ components/GbpPlaceholder.tsx
        └─ components/TweaksPanel.tsx

Data assembly:
  GET /api/reports/:id/data.json
    → web/lib/reports/build-dashboard-data.ts   (NEW)
       ├─ buildOverview(clientId, range)
       ├─ buildMeta(clientId, range)
       ├─ buildGoogle(clientId, range)
       ├─ buildSeo(clientId, range)
       ├─ buildTreatments(clientId, range)     (uses client_treatment_mappings)
       └─ buildAiSummary(reportId)              (reads existing AI markdown blocks)
```

**Key principle:** the React app is pure — it receives a single typed JSON payload and renders. No client-side data fetching, no client-side aggregation, no auth logic.

---

## 4. Data model

### 4.1 No schema changes to existing report tables

`client_reports` and `client_report_screenshots` stay as-is. They continue to back the editor workflow.

### 4.2 New tables

```sql
-- Cached dashboard payloads (recomputed on demand; cuts time-to-paint for client views)
CREATE TABLE client_report_data_cache (
  report_id INTEGER PRIMARY KEY,
  payload_json TEXT NOT NULL,
  computed_at TEXT NOT NULL,
  FOREIGN KEY(report_id) REFERENCES client_reports(id) ON DELETE CASCADE
);

-- Per-client treatment mapping. Treatment is derived from the campaign name
-- the client is actually advertising. Auto-suggested from observed campaign
-- names; AM/client can edit, add, or remove rows.
CREATE TABLE client_treatment_mappings (
  id INTEGER PRIMARY KEY,
  client_id INTEGER NOT NULL,
  treatment_name TEXT NOT NULL,           -- e.g. "Invisalign & Ortho"
  campaign_pattern TEXT NOT NULL,         -- regex (case-insensitive), e.g. "(?i)invisalign|ortho|braces"
  applies_to TEXT NOT NULL DEFAULT 'both',-- 'meta' | 'google' | 'both'
  avg_case_value_gbp REAL,                -- nullable; falls back to vertical default
  priority INTEGER NOT NULL DEFAULT 100,  -- lower wins when multiple patterns match
  is_active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE
);
CREATE INDEX idx_treatment_mappings_client ON client_treatment_mappings(client_id, is_active);

-- Default case values per vertical/treatment for the "leave an average in for now"
-- behaviour. Shipped seeded; AM overrides per-client via client_treatment_mappings.
CREATE TABLE treatment_value_defaults (
  vertical TEXT NOT NULL,                 -- 'dental', 'aesthetics', 'medical', 'home-services', 'other'
  treatment_name TEXT NOT NULL,
  avg_case_value_gbp REAL NOT NULL,
  source_note TEXT,                       -- where this estimate came from
  PRIMARY KEY (vertical, treatment_name)
);
```

Migration: `scripts/migrations/2026-05-12-client-report-v2.ts`.

### 4.3 Treatment mapping — answered

> "Propose a default but allow us to map our own custom treatments — they will be based on what we are actually advertising so you should be able to pull it from the campaigns"

**Implementation:**

1. **Default extraction (no config needed).** Aggregator inspects every active Meta + Google campaign name. A built-in regex library covers common treatments (Invisalign, Dental Implants, Emergency, Smile Makeover, Whitening, Botox, Fillers, etc.). Each campaign is bucketed by its first match.
2. **Auto-suggest mappings.** On a client's first dashboard build, any unmatched campaign is recorded as "Other". A one-time job (and an admin button) writes suggested `client_treatment_mappings` rows from the seen campaign names — AM reviews and edits in a new admin UI.
3. **Override.** Once a row exists in `client_treatment_mappings`, it wins over the built-in defaults. The AM/client can add new treatments, edit patterns, change `applies_to`, or set `avg_case_value_gbp`.
4. **Fallback.** Campaigns matching nothing roll into "Other" so totals always balance.

The aggregator builds the treatment row from:
- **Spend** — sum of campaign spend matched to that treatment (Meta + Google)
- **Leads** — count of `ghl_opportunities` whose source attributes to a matched campaign (via UTM `utm_campaign` if present, otherwise the source field, otherwise nothing — see Risks §9)
- **CPL** — spend / leads
- **CAC** — spend / bookings (bookings = same lead count, filtered to `Booked Appointment` pipeline)
- **Revenue** — bookings × `avg_case_value_gbp` for v1 (per answer below)
- **avgValue** — from `client_treatment_mappings.avg_case_value_gbp` if set, else `treatment_value_defaults` for the client's vertical, else a documented vertical-agnostic fallback

### 4.4 Booking attribution — answered

> "GHL Stage is booked when they are in the Booked Appointment Pipeline — it will be universal for all GHL clients"

**Implementation:** an opportunity counts as a *booking* in the report period if, at any point during the period, it sat in a pipeline whose name matches `(?i)booked appointment` (case-insensitive, substring). Stage within that pipeline doesn't matter — being in the pipeline is the signal.

- Source: `ghl_pipelines.name` resolves to its `id`; we then filter `ghl_opportunities.pipeline_id` against the matched set.
- Cross-pipeline movement: if an opp ever lived in the Booked Appointment pipeline during the period (per `ghl_opportunities.last_stage_change_at` or `updated_at` falling in range, *and* the current pipeline is Booked Appointment), count it once.
- Universal: no per-client config — applies to every GHL location identically.
- Documented in `web/lib/reports/booking-rule.ts` so the rule lives in one place.

**Edge cases noted:**
- Clients whose GHL workspace doesn't have a "Booked Appointment" pipeline → bookings show `0` and a small footnote: "No pipeline matched 'Booked Appointment' in GHL — bookings unavailable for this client." Surfaced as a `flags.bookingPipelineMissing` on the payload so the UI can render the note without changing the layout.

### 4.5 Average case value — answered

> "Lets leave an average in there for now — but we will set that to be the actual average case for the clients when we have more information"

**Implementation for v1:**

1. **Resolve in this order** when the aggregator computes a treatment row:
   1. `client_treatment_mappings.avg_case_value_gbp` for that client + treatment (AM/client-set override)
   2. `treatment_value_defaults` for that client's `vertical` + treatment_name
   3. A vertical-agnostic fallback (£500), with `flags.averageCaseValueIsDefault: true` returned in the payload so the UI can show a subtle "default value — not your data" hint.
2. **Seed values** — ship `treatment_value_defaults` with sensible UK industry averages per vertical (dental at least; others stubbed and flagged). Sources documented in `source_note`.
3. **Phase 4 path** — replace the lookup with an actual rolling average from closed-won `ghl_opportunities.monetary_value` per treatment per client (90-day trailing). Not wired in v1; the override column is the seam.

---

## 5. API surface

### 5.1 New endpoints

| Method | Path | Handler | Auth |
|---|---|---|---|
| `GET` | `/admin/reports/:id/view` | `dashboardViewHandler` (renders Eta shell, mode='internal') | `requireTeamUser()` |
| `GET` | `/portal/reports/:id/view` | `portalDashboardViewHandler` (renders Eta shell, mode='client') | existing portal auth; asserts `request.user.clientId === report.client_id`; admin preview via `?clientId=` per `web/routes/portal.ts` pattern |
| `GET` | `/api/reports/:id/data.json` | `dashboardDataHandler` | `requireTeamUser()` OR portal session whose `clientId` matches the report |
| `POST` | `/api/reports/:id/recompute` | force-recompute the data cache | `requireTeamUser()` |
| `GET` | `/admin/reports/:id/view/print` | print-friendly variant | `requireTeamUser()` |
| `GET` | `/admin/clients/:clientId/treatment-mappings` | list + edit treatment mappings | `requireTeamUser()` |
| `POST` | `/admin/clients/:clientId/treatment-mappings` | create | `requireTeamUser()` |
| `POST` | `/admin/clients/:clientId/treatment-mappings/:id/update` | edit | `requireTeamUser()` |
| `POST` | `/admin/clients/:clientId/treatment-mappings/:id/delete` | delete | `requireTeamUser()` |
| `POST` | `/admin/clients/:clientId/treatment-mappings/auto-suggest` | scan campaigns + write suggested rows | `requireTeamUser()` |

### 5.2 Data payload contract

```typescript
// web/lib/reports/dashboard-types.ts
export interface DashboardPayload {
  client: { id: number; name: string; location: string; initials: string; since: string; vertical: string };
  report: { id: number; status: ReportStatus; periodLabel: string; periodStart: string; periodEnd: string };
  range: { current: { start: string; end: string }; previous: { start: string; end: string }; granularity: 'day' };
  mode: 'internal' | 'client';
  overview: OverviewBlock;
  meta: MetaBlock;
  google: GoogleBlock;
  seo: SeoBlock;
  aiSummary: AiSummaryBlock;
  flags: {
    gbpComingSoon: true;
    geoGridComingSoon: true;
    bookingPipelineMissing?: true;
    averageCaseValueIsDefault?: true;
    treatmentMappingMissing?: true;
  };
}
```

Each sub-block mirrors the mockup's `data.jsx` shape so the React port lifts straight across, just with real numbers.

### 5.3 Existing endpoints

No changes. Editor, screenshots, AI-blocks endpoints stay untouched.

---

## 6. Build pipeline

New script: `scripts/build-client-report.ts` — copy `build-agent-chat.ts` verbatim, swap entry point and outfile:

```
entry:  web/client/client-report/main.tsx
output: public/assets/client-report.js
```

`package.json`:
```
"build:report": "tsx scripts/build-client-report.ts",
"build:report:watch": "tsx scripts/build-client-report.ts --watch",
"build": "npm run build:chat && npm run build:report"   // wired so Vercel rebuilds on deploy
```

CSS: write to `public/assets/client-report.css` and mirror to `web/public/client-report.css` (per the two-CSS-file convention in auto-memory).

**Token namespacing:** the mockup uses generic `--accent`, `--ink`, `--bg`. Auto-memory says never invent generic tokens. Solution — rename everything to a `--vr-*` (Vendo Report) prefix inside the new CSS file. The bundle scopes them to `#report-root` so they don't leak to the rest of the app.

```css
#report-root {
  --vr-bg: oklch(0.985 0.005 80);
  --vr-ink: oklch(0.22 0.012 250);
  --vr-accent: oklch(0.55 0.12 195);
  /* …etc. */
}
#report-root[data-vr-theme="dark"] { /* dark palette */ }
```

---

## 7. Phased delivery

### Phase 0 — Foundation (≈1 day)
- [ ] Branch `feat/client-report-v2`
- [ ] Migration `2026-05-12-client-report-v2.ts` (`client_report_data_cache`, `client_treatment_mappings`, `treatment_value_defaults` + seed rows)
- [ ] `scripts/build-client-report.ts` + `package.json` wiring
- [ ] `web/client/client-report/main.tsx` — minimal "hello world" island, renders into `#report-root`
- [ ] `web/views/reports/dashboard.eta` — Eta shell with `window.VENDO_REPORT` injection
- [ ] Route `GET /admin/reports/:id/view` in `web/routes/reports.ts` — renders shell with a stub payload (`mode: 'internal'`)
- [ ] Route `GET /portal/reports/:id/view` in `web/routes/portal.ts` — same shell, `mode: 'client'`, with `clientId === report.client_id` check
- [ ] CSS scaffolding: `public/assets/client-report.css` with `--vr-*` tokens, sidebar/topbar shell
- [ ] Verify build → load → render cycle works end-to-end for both routes

**Exit criteria:** `/admin/reports/:id/view` and `/portal/reports/:id/view` both render the sidebar + topbar + empty tab body, with `mode` differing.

### Phase 1 — Data layer (≈3–4 days)
- [ ] `web/lib/reports/dashboard-types.ts` — full TypeScript contract
- [ ] `web/lib/reports/booking-rule.ts` — single source of truth for the "Booked Appointment pipeline" rule
- [ ] `web/lib/reports/build-dashboard-data.ts` — orchestrator
- [ ] `web/lib/reports/aggregators/overview.ts` — pulls from Meta + Google + GHL + GA4
- [ ] `web/lib/reports/aggregators/meta.ts` — campaigns from `meta_insights`, creative top-N, audiences (best-effort from targeting field)
- [ ] `web/lib/reports/aggregators/google.ts` — campaigns from `gads_campaign_spend`, keywords from `gads_keyword_stats`, device split (use Google Ads `segments.device` field — add to sync)
- [ ] `web/lib/reports/aggregators/seo.ts` — GSC daily/queries/pages, GA4 daily, 24-month series for the SC chart
- [ ] `web/lib/reports/aggregators/treatment.ts` — campaign-name → treatment mapping (defaults + overrides); resolves `avg_case_value_gbp` via the 3-step lookup
- [ ] `web/lib/reports/aggregators/ai-summary.ts` — wraps existing `generateReportInsights` output into the new schema (Wins/Watch/Focus labels)
- [ ] `GET /api/reports/:id/data.json` route + cache layer (writes to `client_report_data_cache`)
- [ ] `POST /api/reports/:id/recompute` — force-refresh cache
- [ ] Unit tests for each aggregator with seeded fixtures, including the Booked Appointment rule

**Exit criteria:** `curl /api/reports/<real-id>/data.json | jq` returns a valid `DashboardPayload` for a real client with real numbers and correct booking counts.

### Phase 2 — Frontend port (≈4–5 days)
Port the mockup files into TypeScript React, file-for-file. The mockup is already cleanly split — this is mostly mechanical with type annotation. Order:

- [ ] Primitives: `Sparkline`, `MiniBar`, `Delta`, `KpiCard`, `StatTile`, `SectionHeader`, `Placeholder`, `ChannelPip`, formatting utils (`fmt`)
- [ ] Shell: `App.tsx` (sidebar, topbar, tab routing, theme/density), `TweaksPanel` (hidden when `mode === 'client'`)
- [ ] `OverviewTab` (treatment row shows the "default value" hint chip when `flags.averageCaseValueIsDefault`)
- [ ] `SummaryTab`
- [ ] `MetaTab`
- [ ] `GoogleTab`
- [ ] `SeoTab` — most complex (SearchConsoleChart, GeoGridPlaceholder, GbpPlaceholder, segmented control)
- [ ] Loading skeletons (lightweight shimmer per tab)
- [ ] Empty states (no data yet, sync pending, bookingPipelineMissing footnote)
- [ ] Error boundary that falls back to a "Refresh / report a bug" card
- [ ] Print stylesheet: `@media print` rules + dedicated `/print` route variant

**Exit criteria:** open `/admin/reports/:id/view` and `/portal/reports/:id/view` for a real client, see all 5 tabs with real numbers; print preview renders cleanly.

### Phase 3 — Integration + portal wiring (≈1–2 days)
- [ ] Add "View as dashboard" button on the existing editor (`web/views/reports/editor.eta`) — opens `/admin/reports/:id/view` in a new tab
- [ ] Add a "Reports" entry to the existing portal sidebar — clients see a list of their reports + click through to the dashboard
- [ ] Push-to-portal job (`web/lib/jobs/push-reports-to-portal.ts`) — extend so finalised reports become visible in the client portal (or confirm existing job already does this)
- [ ] Treatment-mappings admin UI under `/admin/clients/:clientId/treatment-mappings`
- [ ] Auto-suggest button on first dashboard build
- [ ] Client-facing mode (`mode === 'client'`): hide Tweaks panel, hide Export button, keep Download PDF, show Vendo branded footer
- [ ] Slack notification when a client first views a finalised report (reuse existing `slack-interact`)

**Exit criteria:** AM finalises a report; client logs into the portal and sees the report in their nav; the dashboard renders for them with no admin chrome.

### Phase 4 — Deferred / out-of-scope for v1
| Item | Effort | Notes |
|---|---|---|
| GBP sync (Google My Business API) | ≈3 days | Need to register a Google MyBusiness API quota; reuse the existing Google OAuth tokens |
| Local GeoGrid (Local Falcon API or SerpAPI) | ≈3–5 days | Pick a provider; weekly scan job; new `geogrid_scans` table |
| **Real-data average case value** | ≈1 day | Replace the defaults table lookup with rolling 90-day `ghl_opportunities.monetary_value` average per (client, treatment). Override column already present. |
| Server-side PDF (Puppeteer / pdfshift) | ≈2 days | Only if browser print isn't enough |
| Real-time data refresh (currently cached, recomputed on save) | ≈1 day | Auto-recompute when underlying syncs complete |

---

## 8. Files

### Files to create

```
plans/2026-05-12-client-report-v2-tab-dashboard.md            (this file)
scripts/migrations/2026-05-12-client-report-v2.ts
scripts/build-client-report.ts

web/views/reports/dashboard.eta
web/views/reports/dashboard-print.eta
web/views/admin/treatment-mappings.eta

web/lib/reports/dashboard-types.ts
web/lib/reports/build-dashboard-data.ts
web/lib/reports/dashboard-cache.ts
web/lib/reports/booking-rule.ts
web/lib/reports/treatment-defaults.ts
web/lib/reports/aggregators/overview.ts
web/lib/reports/aggregators/meta.ts
web/lib/reports/aggregators/google.ts
web/lib/reports/aggregators/seo.ts
web/lib/reports/aggregators/treatment.ts
web/lib/reports/aggregators/ai-summary.ts
web/lib/queries/treatment-mappings.ts

web/client/client-report/main.tsx
web/client/client-report/App.tsx
web/client/client-report/types.ts
web/client/client-report/lib/format.ts
web/client/client-report/lib/useTweaks.ts
web/client/client-report/components/Sidebar.tsx
web/client/client-report/components/Topbar.tsx
web/client/client-report/components/TweaksPanel.tsx
web/client/client-report/components/Sparkline.tsx
web/client/client-report/components/MiniBar.tsx
web/client/client-report/components/Delta.tsx
web/client/client-report/components/KpiCard.tsx
web/client/client-report/components/StatTile.tsx
web/client/client-report/components/ChannelPip.tsx
web/client/client-report/components/SectionHeader.tsx
web/client/client-report/components/DataTable.tsx
web/client/client-report/components/ChannelCard.tsx
web/client/client-report/components/AiSummary.tsx
web/client/client-report/components/SearchConsoleChart.tsx
web/client/client-report/components/GeoGridPlaceholder.tsx
web/client/client-report/components/GbpPlaceholder.tsx
web/client/client-report/tabs/OverviewTab.tsx
web/client/client-report/tabs/SummaryTab.tsx
web/client/client-report/tabs/MetaTab.tsx
web/client/client-report/tabs/GoogleTab.tsx
web/client/client-report/tabs/SeoTab.tsx

public/assets/client-report.css
web/public/client-report.css
```

### Files to modify

```
package.json                       add build:report scripts; wire into "build"
vercel.json                        add public/assets/client-report.* to includeFiles
web/routes/reports.ts              add /admin/reports/:id/view, /view/print, /api/data.json, /recompute, treatment-mappings admin
web/routes/portal.ts               add /portal/reports/:id/view + portal report list entry
web/views/reports/editor.eta       add "View as dashboard" button
web/views/portal/layout.eta        add "Reports" nav entry (if not already there)
web/lib/jobs/push-reports-to-portal.ts   verify final reports are pushed to the portal index
```

### Files left alone

```
web/lib/queries/reports.ts         (existing report queries untouched)
web/lib/report-ai.ts               (existing AI generator untouched; aggregator wraps its output)
web/views/reports/preview.eta      (old email-style preview stays — old flow continues)
web/public/reports.css             (old CSS stays for editor)
scripts/migrations/2026-05-05-*    (existing migrations stay)
```

---

## 9. Risks & open questions

### Risks
1. **24-month GSC history** — `gsc_daily` may not have 24 months of data yet. Mitigation: show "data starts <month>" if shorter; the chart x-axis adjusts.
2. **Meta creative thumbnails** — `meta_insights.thumbnail_url` may expire (Meta CDN tokens are short-lived). Mitigation: rehost thumbnails to Vercel Blob on sync.
3. **Sparkline data freshness** — daily aggregation has a 1–3 day lag for some sources (GSC delays 3 days). Make the topbar surface "Data synced · 2m ago" honestly; per-source lag shown on hover.
4. **GHL `Booked Appointment` pipeline absent** — some clients won't have one named that way. Mitigation: aggregator returns bookings=0 + a `flags.bookingPipelineMissing` payload flag; UI shows a subtle footnote. Document the naming convention so onboarding gets it right.
5. **Lead → campaign attribution** — for treatment-row leads we need to tie `ghl_opportunities` back to a campaign. UTM `utm_campaign` is the cleanest path; the existing `lead_attribution.ts` already does some of this. Where UTM is missing, fall back to attributing by `source` field substring; where that also fails, the lead falls into "Other" rather than being double-counted.
6. **CSS token clashing** — must verify `#report-root` scoping doesn't bleed; test against the existing `--vendo-*` tokens.
7. **Portal session for a client viewing a different client's report** — `request.user.clientId` mismatch must 404, not 403, to avoid leaking the existence of a report.

### Open questions

All six original questions answered. Remaining items I'm taking as defaults unless flagged:

| Ref | Question | Decision |
|---|---|---|
| **OQ-1** | Treatment mapping | ✅ Default from campaign names + per-client `client_treatment_mappings` overrides + auto-suggest UI |
| **OQ-2** | Client-facing auth | ✅ Existing portal login at `/portal/reports/:id/view`; no share tokens |
| **OQ-3** | Tweaks panel for clients | ✅ Hidden when `mode === 'client'`; locked defaults (light, default density, no accent customisation) |
| **OQ-4** | Booking attribution | ✅ Opportunities in any pipeline named `(?i)booked appointment`. Universal across all GHL clients. |
| **OQ-5** | Date range freedom | Default to report's `period_start`/`period_end`; date picker visible in internal mode only |
| **OQ-6** | Average case value | ✅ For v1 use `client_treatment_mappings.avg_case_value_gbp` → vertical default → vertical-agnostic £500 fallback, with a "default value" flag. Phase 4 replaces with rolling actuals from `ghl_opportunities.monetary_value`. |

---

## 10. Test plan

- Unit: each aggregator hits a seeded SQLite fixture with known inputs → asserts exact output numbers; explicit test for the `Booked Appointment` rule across multiple pipeline-name variants
- Integration: `GET /api/reports/:id/data.json` for a real client (Vendo Dental) returns a valid payload, schema-validated against `DashboardPayload`
- Auth: a portal session for client A 404s when hitting client B's report; an admin can still preview with `?clientId=`
- Visual regression: snapshot each tab as a screenshot (Playwright) for a fixed seed payload; compare on every PR
- Print: `@media print` renders cleanly to a single multi-page PDF on Chrome and Safari
- Mobile: app shell collapses sidebar to top nav at 800px breakpoint (already in mockup CSS)
- Treatment mappings: auto-suggest produces sensible rows on Vendo Dental's actual campaigns

---

## 11. Definition of done (v1)

- [ ] `/admin/reports/:id/view` renders the 5-tab dashboard for any report with real client data
- [ ] `/portal/reports/:id/view` works for a logged-in client; rejects mismatched `clientId` with a 404
- [ ] Treatment-mappings admin page works; auto-suggest produces usable defaults
- [ ] Real numbers from Meta, Google, GA4, GSC and GHL flow through with correct deltas and sparklines
- [ ] Bookings count off the `Booked Appointment` pipeline rule; missing-pipeline footnote shows when applicable
- [ ] Average case value resolves via the 3-step lookup; "default value" hint shows when fallback is used
- [ ] GBP and GeoGrid show clear "Coming soon" cards with a one-line explanation
- [ ] AI Summary tab pulls from the existing generated markdown blocks (no regeneration needed)
- [ ] Print/PDF export of the dashboard from Chrome looks correct
- [ ] Dark mode, density, accent hue work in internal mode; hidden + locked in client mode
- [ ] All tests green; typecheck clean; lint clean
- [ ] Tested end-to-end with one real client report before merging to `main`

---

## 12. Sequencing summary

```
Day 1        : Phase 0 — foundation
Day 2–5      : Phase 1 — data layer (parallelisable per aggregator)
Day 6–10     : Phase 2 — frontend (gated on a stable data contract by end of Day 4)
Day 11–12    : Phase 3 — portal wiring + treatment-mappings admin
                                                   ── v1 ships ──
Later        : Phase 4 — GBP sync, GeoGrid integration, real-data avg case value
```

Working solo / Claude Code, realistic calendar: **~2 working weeks for v1**, plus GBP and GeoGrid as separate ~1-week mini-projects when ready.

---

## 13. Next step

Plan is fully scoped against your answers. On approval I'll:

1. `git checkout -b feat/client-report-v2`
2. Execute Phase 0 in a single commit so the shell renders end-to-end at both `/admin/reports/:id/view` and `/portal/reports/:id/view`
3. Push for review before kicking off Phase 1
