# Google Ads Autonomous Reporting

**Date:** 2026-05-11
**Owner:** Toby
**Goal:** Move Paid Search monthly client reports from "team OCRs screenshots" to "system pre-populates draft + AM approves + auto-delivers". Google Ads only for this phase.

---

## Decisions locked

| Decision | Choice |
|---|---|
| Delivery channel | **ClientDashboard portal** + visible/manageable in VendoOS `/reports` (staff view already exists) |
| Approval gate | **Two-stage**: team member submits for review, AM approves and sends |
| AI trigger | **Both** — auto-fire on the 1st of the month; team can re-generate on demand |

---

## Current state (baseline)

- `/reports` editor exists. Team uploads Google Ads screenshots; Claude Sonnet 4.6 OCRs them via [web/lib/report-ai.ts](../web/lib/report-ai.ts).
- `gads_campaign_spend` and `gads_keyword_stats` are synced daily from the MCC ([web/lib/jobs/sync-google-ads.ts](../web/lib/jobs/sync-google-ads.ts)) — but **not consumed** by report generation. They're orphaned data.
- `gads_accounts` exists but has **no link to `clients.id`** (the local sync had `resolveClientBatch()`; the Vercel port dropped it as sql.js-dependent).
- Monthly draft cron exists ([web/lib/jobs/monthly-client-reports.ts](../web/lib/jobs/monthly-client-reports.ts)) — creates blank rows on the 1st.
- ClientDashboard portal push exists for clients ([web/lib/jobs/push-clients-to-portal.ts](../web/lib/jobs/push-clients-to-portal.ts)), keyed on `organisations.external_vendo_id`. **Pattern to mirror for reports.**
- Status today is `draft` | `final`. Single-stage.

---

## Shared contracts

### Database schema (new)

```sql
-- 1. Map Google Ads accounts to Vendo clients (foundation)
CREATE TABLE IF NOT EXISTS gads_account_client_map (
  gads_customer_id TEXT PRIMARY KEY,           -- Google Ads customer ID (string, no dashes)
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_gads_map_client ON gads_account_client_map(client_id);

-- 2. Delivery audit log
CREATE TABLE IF NOT EXISTS client_report_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL REFERENCES client_reports(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,                       -- 'portal' (extensible later)
  status TEXT NOT NULL,                        -- 'queued' | 'sent' | 'failed'
  payload_json TEXT,                           -- snapshot of what was delivered
  error_msg TEXT,
  sent_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_deliveries_report ON client_report_deliveries(report_id, created_at DESC);
```

### `client_reports` additions

```sql
ALTER TABLE client_reports ADD COLUMN contact_email TEXT;
ALTER TABLE client_reports ADD COLUMN gads_summary_json TEXT;        -- cached structured Google Ads summary
ALTER TABLE client_reports ADD COLUMN narrative_draft_md TEXT;        -- auto-pulled suggestion for worked_on_md
ALTER TABLE client_reports ADD COLUMN submitted_for_review_at TEXT;
ALTER TABLE client_reports ADD COLUMN submitted_for_review_by TEXT;
ALTER TABLE client_reports ADD COLUMN approved_at TEXT;
ALTER TABLE client_reports ADD COLUMN approved_by TEXT;
-- status column: extend allowed values to 'draft' | 'review' | 'final' (enforced in app code, not DB constraint)
```

### TypeScript contracts

```typescript
// web/lib/reports/gads-summary.ts  (Agent 2)
export interface GoogleAdsCampaignRow {
  campaign_id: string;
  campaign_name: string;
  spend: number;                  // GBP
  conversions: number;
  conversion_value: number;
  cpr: number;                    // cost per result
  roas: number | null;            // null if no revenue
  currency: string;
}
export interface GoogleAdsPeriodSummary {
  client_id: number;
  client_name: string;
  period_start: string;           // YYYY-MM-DD
  period_end: string;             // YYYY-MM-DD
  overall: {
    spend: number;
    conversions: number;
    conversion_value: number;
    cpr: number;
    roas: number | null;
  };
  campaigns: GoogleAdsCampaignRow[];   // £0-spend campaigns FILTERED OUT
  account_count: number;
  has_data: boolean;
}
export async function buildGoogleAdsPeriodSummary(
  clientId: number,
  periodStart: string,
  periodEnd: string,
): Promise<GoogleAdsPeriodSummary>;

// web/lib/reports/narrative-context.ts  (Agent 3)
export interface NarrativeContext {
  asana_tasks_completed: Array<{ name: string; completed_at: string; project: string | null }>;
  meeting_actions: Array<{ summary: string; assignee: string | null; meeting_date: string }>;
  last_focus_next_md: string | null;       // from previous month's report
  suggested_worked_on_md: string;          // assembled markdown draft
}
export async function buildNarrativeContext(
  clientId: number,
  periodStart: string,
  periodEnd: string,
): Promise<NarrativeContext>;

// web/lib/jobs/push-reports-to-portal.ts  (Agent 5)
export interface PushReportsResult {
  attempted: number;
  pushed: number;
  failed: number;
  durationMs: number;
  errors: Array<{ report_id: number; error: string }>;
}
export async function pushFinalReportsToPortal(): Promise<PushReportsResult>;
```

### File ownership (no collisions across agents)

| Agent | Owns exclusively |
|---|---|
| **A1 — Foundation** | `scripts/migrations/2026-05-11-gads-autonomous-reports.ts` (single migration), `web/routes/admin/gads-account-map.ts`, `web/views/admin/gads-account-map.eta`, link in admin sidebar |
| **A2 — Summariser** | `web/lib/reports/gads-summary.ts` (new), `web/lib/report-ai.ts` (extend `ReportAiInput` to accept optional `googleAdsSummary` + adjust prompt builder to prefer structured data over OCR when present) |
| **A3 — Narrative** | `web/lib/reports/narrative-context.ts` (new), `web/views/reports/_suggested-narrative.eta` (new partial). Does **NOT** touch `editor.eta` directly. |
| **A4 — Status workflow + auto-trigger** | `web/lib/queries/reports.ts` (extend status helpers, add submit/approve), `web/routes/reports.ts` (new endpoints `/submit-review`, `/approve`), `web/views/reports/editor.eta` (status UI + include `_suggested-narrative.eta`), `web/views/reports/list.eta` (review filter + badge), `web/lib/jobs/monthly-client-reports.ts` (extend to auto-generate AI on creation) |
| **A5 — Portal delivery** | `web/lib/jobs/push-reports-to-portal.ts` (new), `web/routes/api/cron.ts` (register `/sync/push-reports`), `vercel.json` (cron schedule + route entry), CD-side mirror table + endpoint design in `plans/2026-05-11-cd-reports-schema-delta.md` |

### Status state machine

```
draft ──[team: Submit for review]──> review ──[AM: Approve & send]──> final
  │                                     │                                │
  └─────────[team: edit]────────────────┘                                │
                                                                          ▼
                                                       portal push (cron, every 15 min)
```

- `draft → review`: anyone on the team. Records `submitted_for_review_at`, `submitted_for_review_by`.
- `review → final`: AM role only. Records `approved_at`, `approved_by`.
- `final` is terminal until the portal push completes (logged in `client_report_deliveries`).

### Coordination rules

- Each agent works in its own git worktree under `.claude/worktrees/agent-<name>`. Branch name: `feat/gads-auto-<slice>`.
- Commit incrementally with conventional messages. Push the branch (no merge to main from the agent — coordinator does that).
- Each agent **must** typecheck (`npm run typecheck`) and run the smoke test (`npm run test:reports-smoke` if relevant) before declaring done.
- If an agent needs to reference a function from another agent's slice, **stub it locally with the signature above**, mark with `// AGENT-COORD: stub for A2 buildGoogleAdsPeriodSummary` comment, and the coordinator wires it during merge.
- All agents follow [CLAUDE.md](../CLAUDE.md): UK English, conventional commits, no placeholders, no temporary fixes. Vercel functions need explicit `vercel.json` registration (per memory).

---

## Verification (post-merge)

1. `npm run typecheck` clean
2. `npm run test:reports-smoke` passes
3. Manual: create a draft for a mapped client, confirm Google Ads summary appears pre-populated, AI insights generate from structured data (no screenshot required)
4. Manual: submit for review → AM approves → report appears in ClientDashboard portal within 15 min
5. Cron heartbeat for `push-reports-to-portal` recording successful runs
