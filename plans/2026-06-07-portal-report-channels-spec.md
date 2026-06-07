# Spec — Per-channel client reports in the ClientDashboard portal

**Audience:** ClientDashboard (portal) repo maintainer.
**Reason:** Vendo-OS now produces **channel-pure** client reports — a separate
report per channel (`google_ads`, `meta`, `seo`) per client per month. The
portal currently stores **one report per (organisation, month)**, so when two
channels for the same month are approved, the second overwrites the first.
This spec adds `channel` to the portal so all three coexist.

Source of truth on the Vendo-OS side: `web/lib/jobs/push-reports-to-portal.ts`.

---

## 1. Supabase migration (portal DB)

The portal `client_reports` table is keyed/upserted on
`(organisation_id, period_start)`. Add `channel` and widen the key.

```sql
-- 1. Add the column (backfill existing rows to google_ads — current history
--    is Google Ads-led, matching the Vendo-OS backfill).
alter table public.client_reports
  add column if not exists channel text not null default 'google_ads'
  check (channel in ('google_ads', 'meta', 'seo'));

-- 2. Replace the (organisation_id, period_start) uniqueness with a
--    channel-aware one. Find the existing constraint/index name first:
--      select conname from pg_constraint
--       where conrelid = 'public.client_reports'::regclass and contype = 'u';
-- Drop it (name will differ — example shown), then add the new one.
alter table public.client_reports
  drop constraint if exists client_reports_organisation_id_period_start_key;

alter table public.client_reports
  add constraint client_reports_org_period_channel_key
  unique (organisation_id, period_start, channel);

-- 3. Helpful index for the portal's per-month, per-channel fetch.
create index if not exists idx_client_reports_org_period_channel
  on public.client_reports (organisation_id, period_start desc, channel);
```

If RLS is enabled, no policy change is needed (column addition only). Confirm
the service-role key used by the Vendo-OS push can still upsert.

---

## 2. Vendo-OS push change (coordinated — deploy AFTER step 1)

These are the exact edits to `web/lib/jobs/push-reports-to-portal.ts` in the
Vendo-OS repo. **Do not deploy these until the portal migration in step 1 is
live**, otherwise the upsert references a column/constraint that doesn't exist.

```diff
 interface PendingReportRow {
   id: number;
   client_id: number;
+  channel: 'google_ads' | 'meta' | 'seo';
   period_label: string;
   ...
 }

 interface CdReportUpsert {
   organisation_id: string;
   external_vendo_report_id: number;
+  channel: string;
   period_label: string;
   ...
 }

 // loadPendingReports SELECT — add r.channel:
-    `SELECT r.id, r.client_id,
+    `SELECT r.id, r.client_id, r.channel,
             r.period_label, r.period_start, r.period_end,
             ...

 // build upsert — add channel:
     const upsert: CdReportUpsert = {
       organisation_id: orgId,
       external_vendo_report_id: row.id,
+      channel: row.channel,
       ...
     };

 // upsert onConflict — widen the key:
       const { error: upErr } = await portal
         .from('client_reports')
-        .upsert(upsert, { onConflict: 'organisation_id,period_start' });
+        .upsert(upsert, { onConflict: 'organisation_id,period_start,channel' });
```

No change to the delivery-audit logic (`client_report_deliveries`) — it is
already keyed per Vendo-OS report id, which is per-channel.

---

## 3. Portal UI (ClientDashboard frontend)

The client now receives up to three reports per month. Recommended UX:

- **Group by month, then split by channel.** On the report view, show a
  channel switch (Google Ads / Meta / SEO) — only render channels that have a
  report for the selected month. This mirrors the Vendo-OS editor.
- Channel labels: `google_ads → "Google Ads"`, `meta → "Meta"`, `seo → "SEO"`.
- The report body fields are unchanged (`exec_summary_md`,
  `performance_summary_md`, `wins_md`, `risks_md`, `recommendations_md`,
  `worked_on_md`, `focus_next_md`) — they are already channel-scoped content.
- Email/heading wording should reflect the single channel, e.g.
  "Your May 2026 Google Ads Report" (Vendo-OS preview already does this).
- If the portal currently fetches "the report for this month" with
  `.eq('organisation_id', …).eq('period_start', …).single()`, change to
  `.select()` (no `.single()`) and branch on `channel`.

---

## 4. Rollout order (important)

1. Apply the **Supabase migration** (step 1) — backwards-compatible; existing
   single-channel rows become `channel='google_ads'`.
2. Ship the **portal UI** change (step 3) so the client can see per-channel
   reports.
3. Deploy the **Vendo-OS push change** (step 2). From here, approving a Meta or
   SEO report writes its own portal row instead of overwriting Google Ads.

Until step 3 ships, Vendo-OS keeps pushing every channel's report onto the
`google_ads` row (the current behaviour) — so hold approvals of non–Google-Ads
reports, or accept that they'll overwrite, until the rollout completes.

---

## 5. Acceptance check

- Approve a Google Ads **and** a Meta report for the same client/month in
  Vendo-OS.
- After the 15-min portal cron, the portal `client_reports` table has **two
  rows** for that `(organisation_id, period_start)` — one per channel — and the
  portal renders both under a channel switch.
