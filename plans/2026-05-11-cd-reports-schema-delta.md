# ClientDashboard ↔ VendoOS: `client_reports` Schema Delta

**Date:** 2026-05-11
**Companion to:** `2026-05-11-google-ads-autonomous-reporting.md` (TaskID 5)
**Owner (VendoOS side):** Agent A5 — delivery
**Owner (CD side):** ClientDashboard team — applies the migration in `vendo-client-portal`

---

## TL;DR

VendoOS now pushes finalised `client_reports` to the ClientDashboard portal every 15 minutes via the Vercel cron `GET /api/cron/push-reports-to-portal`. ClientDashboard needs a new Postgres table — `client_reports` — keyed on `(organisation_id, period_start)` to receive these pushes. RLS policies must restrict reads to a client's own organisation.

A CD-side route/page to render these reports is **deferred** — see "Open decision" below.

---

## Why a new table

VendoOS approves a monthly client report (status `final`) inside the staff cockpit. Two-stage approval gate (team submits → AM approves) already lives in VendoOS. Once approved, the report must surface in the client's portal view — that's where the client logs in to see their account.

The VendoOS push is one-way and idempotent, mirroring `push-clients-to-portal`. The bridge key is the same one used everywhere else: `organisations.external_vendo_id`.

---

## Verification needed before applying

The integration plan's architecture diagram (`2026-05-08-clientdashboard-integration.md`, line 67) lists `reports` as one of the existing CD tables. **Before applying this migration, the CD team must confirm:**

1. Whether a `reports` table already exists in `vendo-client-portal/src/lib/db/schema/`.
2. If so, whether it's currently used by any UI or job (Inngest `report-generator` is mentioned at line 139 — unactivated).
3. If a `reports` table exists but is empty/unused: rename it `legacy_reports` or drop it, and create `client_reports` per this spec.
4. If a `reports` table is in active use with overlapping fields: reconcile by extending its schema instead of creating a new table — flag back to Toby with the column delta.

The naming `client_reports` matches the VendoOS table name, which keeps cross-system queries readable. If CD prefers a different name (e.g. `monthly_reports`), the VendoOS job's table-name string in `web/lib/jobs/push-reports-to-portal.ts` is the single place to update.

---

## Migration

**File path (CD repo):** `supabase/migrations/00019_client_reports_table.sql`

**Numbering rationale:** the latest applied CD migration is `00018_ecom_template_seed.sql` per the integration plan's deviations log. `00019` is the next sequential slot.

```sql
-- 00019_client_reports_table.sql
-- Receive finalised monthly client reports pushed from VendoOS.
-- Keyed on (organisation_id, period_start). Idempotent upserts from
-- the VendoOS cron GET /api/cron/push-reports-to-portal.
-- See plans/2026-05-11-google-ads-autonomous-reporting.md (VendoOS side).

CREATE TABLE IF NOT EXISTS client_reports (
  id BIGSERIAL PRIMARY KEY,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  external_vendo_report_id INTEGER UNIQUE,          -- = VendoOS client_reports.id
  period_label TEXT NOT NULL,                       -- e.g. "April 2026"
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  exec_summary_md TEXT,
  performance_summary_md TEXT,
  wins_md TEXT,
  risks_md TEXT,
  recommendations_md TEXT,
  worked_on_md TEXT,
  focus_next_md TEXT,
  contact_name TEXT,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_cd_reports_org
  ON client_reports (organisation_id, period_end DESC);

CREATE INDEX IF NOT EXISTS idx_cd_reports_external_vendo
  ON client_reports (external_vendo_report_id);

-- updated_at trigger (mirror existing CD pattern — most tables already have
-- one; check supabase/migrations/00017_missing_tables.sql for the
-- canonical helper name).
CREATE TRIGGER set_client_reports_updated_at
  BEFORE UPDATE ON client_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();   -- adjust to whatever CD's helper is called

-- RLS
ALTER TABLE client_reports ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS by default; VendoOS pushes use the service-role key.
-- Client users see only their own organisation's reports.
CREATE POLICY client_reports_select_own_org
  ON client_reports
  FOR SELECT
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_profiles
      WHERE id = auth.uid()
    )
  );

-- No INSERT / UPDATE / DELETE policy for authenticated users — these rows
-- are managed exclusively by the VendoOS push (service role) and the CD
-- staff admin UI (also service role / elevated). If CD later needs an
-- in-portal action (e.g. "request a revision"), add a separate
-- mutation table rather than relaxing RLS here.
```

### Drizzle schema (CD side)

Add to `src/lib/db/schema/` (new file `client-reports.ts` or fold into an existing reports module, whichever matches CD convention):

```ts
import { pgTable, bigserial, uuid, integer, text, date, timestamp, unique, index } from 'drizzle-orm/pg-core';
import { organisations } from './organisations';

export const clientReports = pgTable('client_reports', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  organisationId: uuid('organisation_id')
    .notNull()
    .references(() => organisations.id, { onDelete: 'cascade' }),
  externalVendoReportId: integer('external_vendo_report_id').unique(),
  periodLabel: text('period_label').notNull(),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  execSummaryMd: text('exec_summary_md'),
  performanceSummaryMd: text('performance_summary_md'),
  winsMd: text('wins_md'),
  risksMd: text('risks_md'),
  recommendationsMd: text('recommendations_md'),
  workedOnMd: text('worked_on_md'),
  focusNextMd: text('focus_next_md'),
  contactName: text('contact_name'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedBy: text('approved_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueOrgPeriod: unique().on(t.organisationId, t.periodStart),
  orgPeriodIdx: index('idx_cd_reports_org').on(t.organisationId, t.periodEnd),
  externalIdx: index('idx_cd_reports_external_vendo').on(t.externalVendoReportId),
}));
```

After applying the migration, run `scripts/check-missing-tables.mjs` (per the integration plan deviation #2) to verify no Drizzle ↔ DB drift.

---

## Open decision (CD side) — client-visible rendering

The VendoOS push lands the report content in `client_reports`. **Whether and how a client sees it inside the portal is a CD-side product decision.** Options:

1. **No portal route yet** — table receives data; clients can't see it. Useful as a staging step while CD designs the UX. VendoOS still benefits because `client_report_deliveries` audits prove the push works end-to-end. Recommended for an initial release.
2. **Read-only list under `/dashboard/reports`** — minimal route that lists `client_reports` for the current org (ordered `period_end DESC`) and clicks into a rendered Markdown view. Pattern would mirror the existing deliverables/onboarding routes in `vendo-client-portal/src/app/(client)/dashboard/`.
3. **PDF export** — the architecture diagram in `2026-05-08-clientdashboard-integration.md` (line 60) already lists "Monthly PDF reports" as a target portal feature. Stretch goal: render the Markdown server-side and stream as PDF on demand.

**Recommendation:** ship option 1 first (silent receive), then option 2 in the next CD sprint once the VendoOS-side approval flow has produced real `final` reports. The audit log on the VendoOS side makes "is the push working?" answerable without any CD UI.

If the CD team wants to ship option 2 immediately, the route needs:

- File path: `src/app/(client)/dashboard/reports/page.tsx` (list) and `[id]/page.tsx` (detail).
- Auth: existing `user_profiles` session — RLS does the rest.
- Markdown rendering: use whatever the CD team already uses for deliverables (likely `react-markdown` per the diagram's mention of education courses). Don't introduce a new lib.

---

## What the VendoOS push payload looks like

For reference, the upsert object from `web/lib/jobs/push-reports-to-portal.ts`:

```ts
{
  organisation_id: <uuid>,              // resolved via external_vendo_id
  external_vendo_report_id: <int>,      // = VendoOS client_reports.id
  period_label: 'April 2026',
  period_start: '2026-04-01',
  period_end: '2026-04-30',
  exec_summary_md: '…',
  performance_summary_md: '…',
  wins_md: '…',
  risks_md: '…',
  recommendations_md: '…',
  worked_on_md: '…',
  focus_next_md: '…',
  contact_name: 'Toby Sanders',
  approved_at: '2026-05-11T09:24:00.000Z',
  approved_by: 'alfie@vendodigital.co.uk',
  updated_at: '2026-05-11T20:55:01.000Z'
}
```

Upsert conflict target: `organisation_id,period_start`. Re-pushes are idempotent and overwrite latest content.

---

## Coordination notes

- **VendoOS side is done** — code shipped on `feat/gads-auto-delivery`. Cron will start running once merged to `main`. Even if CD migration isn't applied, the push job logs failures cleanly (Supabase returns "relation client_reports does not exist") and writes a `failed` row to `client_report_deliveries`. No retries blast off — each report stays in the pending set until it succeeds.
- **CD side ownership** — the migration must be created, reviewed, and applied by the CD team in `toby-vend/vendo-client-portal`. The VendoOS push will not "magically" create the table.
- **Sequencing** — apply the migration **before** merging the VendoOS `feat/gads-auto-delivery` branch to `main`, otherwise the cron will write failure audits for every `final` report on its first run.

---

## Verification (post-apply)

1. `\d+ client_reports` in the Supabase SQL editor — confirm columns, indexes, RLS enabled.
2. Run `scripts/check-missing-tables.mjs` — clean.
3. On the VendoOS side: manually trigger `GET /api/cron/push-reports-to-portal` with a `Bearer ${CRON_SECRET}` header against the deployed Vercel URL, confirm a successful row in `client_report_deliveries`.
4. SELECT from `client_reports` as the service role — row(s) exist.
5. SELECT from `client_reports` as a `client_admin` of a different org — zero rows (RLS holds).
