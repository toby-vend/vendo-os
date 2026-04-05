# Vendo OS — Master Flow Implementation Plan

> 39 flows across 6 phases + additional flows. Extracted from the Vendo OS Planning board (FigJam).
> Created: 2026-04-02

---

## Status Key

- **DONE** — Already built and functional
- **PARTIAL** — Some infrastructure exists, needs completion
- **TODO** — Not yet started

---

## Phase 1 — System and Data Architecture (Flows 1–4, 26–27)

### Flow 1 — Vendo-OS Ecosystem Architecture
**Status:** PARTIAL
**What:** Core system map — all services, data sources, and how they connect.
**Exists:** CLAUDE.md architecture, context files, integrations.md, sync scripts for GHL/Fathom/Xero/Asana/Google Ads/Meta Ads/Google Drive.
**Remaining:**
- [ ] Formalise system map as a queryable reference (not just docs)
- [ ] Document all API connections and their sync schedules
- [ ] Map data flow between all services

### Flow 2 — Meeting Data Flow
**Status:** DONE
**What:** Fathom meetings synced, processed, categorised, queryable.
**Exists:** `scripts/sync/sync-meetings.ts`, `scripts/analysis/process-meetings.ts`, query CLI, SQLite database with 444+ meetings.

### Flow 3 — Data Ingestion into Turso
**Status:** PARTIAL
**What:** All business data flowing into Turso (or Turso) for centralised querying.
**Exists:** `scripts/sync/push-to-turso.ts`, individual sync scripts for GHL, Xero, Asana, Google Ads, Meta Ads, Google Drive.
**Remaining:**
- [x] Database schema — 46 tables across all entity types (SQLite/Turso, not Turso)
- [ ] Unified ingestion pipeline — single orchestrator that runs all syncs
- [ ] Data validation and deduplication layer
- [ ] Incremental sync for all sources (some already support this)

### Flow 4 — AI Agent Architecture
**Status:** PARTIAL
**What:** Agent system design — which agents exist, what they do, how they coordinate.
**Exists:** RuFlo V3 initialised with 99 agent definitions, CLAUDE.md agent architecture section.
**Remaining:**
- [ ] Map each Vendo flow to specific agent(s) responsible
- [ ] Define agent communication patterns (which agents trigger which)
- [ ] Implement agent memory — persistent context across sessions
- [ ] Define escalation paths (agent → human)

### Flow 26 — Error Handling and Alerting
**Status:** TODO
**What:** Centralised error handling — all scripts/agents report failures, alerts sent via Slack.
**Steps:**
- [ ] Error logging schema in Turso (timestamp, source, severity, message, resolved)
- [ ] Slack webhook integration for critical alerts
- [ ] Wrapper function for all sync scripts to catch + log errors
- [ ] Daily error digest in the daily brief
- [ ] Retry logic with exponential backoff for API failures

### Flow 27 — Backup and Disaster Recovery
**Status:** TODO
**What:** Automated backups of all critical data, recovery procedures documented.
**Steps:**
- [ ] Automated Turso/Turso database backup (daily)
- [ ] Git-based backup of all config and context files (already via GitHub)
- [ ] API key rotation schedule
- [ ] Recovery runbook — step-by-step restore procedures
- [ ] Test restore procedure quarterly

---

## Phase 2 — Client Journey (Flows 5–8, 28–30)

### Flow 5 — Lead to Sale
**Status:** TODO
**What:** New lead enters GHL → qualified → proposal → closed-won/lost. AI scores and assists.
**Steps:**
- [ ] GHL pipeline stages mapped and synced to Turso
- [ ] Lead scoring model (based on source, industry, budget, engagement)
- [ ] Auto-generate proposal draft from discovery call transcript (Fathom data)
- [ ] Pipeline velocity tracking (days per stage)
- [ ] Slack notification on stage changes
- [ ] Win/loss analysis logged for pattern detection

### Flow 6 — Client Onboarding
**Status:** TODO
**What:** New client signed → Asana project created → access provisioned → kickoff scheduled.
**Steps:**
- [ ] Onboarding checklist template in Asana (auto-created per client)
- [ ] GHL contact status update → triggers onboarding flow
- [ ] Access provisioning checklist (Slack channel, Drive folder, ad accounts)
- [ ] Kickoff meeting agenda auto-generated from proposal/discovery data
- [ ] Onboarding completion tracked — flag if stalled >5 days
- [ ] Welcome sequence triggered in GHL

### Flow 7 — Monthly Client Cycle
**Status:** PARTIAL
**What:** Monthly rhythm — reporting, strategy review, content delivery, billing.
**Exists:** Reporting flow partially built (Google Ads + Meta sync), Xero invoicing sync.
**Remaining:**
- [ ] Monthly report template auto-populated with ad performance data
- [ ] Strategy review agenda generated from performance data + meeting notes
- [ ] Task completion tracking per client per month
- [ ] Invoice status check — flag overdue
- [ ] Client health score calculated monthly (performance + responsiveness + payment)

### Flow 8 — Client Offboarding
**Status:** TODO
**What:** Client exits → access revoked → final invoice → learnings captured.
**Steps:**
- [ ] Offboarding trigger (GHL status change or manual)
- [ ] Access revocation checklist (ad accounts, Slack, Drive, Asana)
- [ ] Final invoice generated and sent
- [ ] Exit interview summary captured
- [ ] Learnings logged to decision journal
- [ ] Client data archived (not deleted)

### Flow 28 — Upsell and Cross-sell
**Status:** TODO
**What:** Identify upsell opportunities from performance data and meeting transcripts.
**Steps:**
- [ ] Upsell trigger rules (e.g. ROAS >3x for 3 months, client mentions new channel)
- [ ] Meeting transcript scanning for buying signals
- [ ] Upsell opportunity logged in Turso with confidence score
- [ ] Founder notified with recommended approach
- [ ] Track conversion rate of upsell attempts

### Flow 29 — Client Feedback and NPS
**Status:** TODO
**What:** Quarterly NPS survey, feedback collection, trend tracking.
**Steps:**
- [ ] NPS survey mechanism (GHL form or email)
- [ ] Response logged in Turso with client ID and timestamp
- [ ] NPS trend dashboard (per client and aggregate)
- [ ] Detractor alert — immediate notification if score <7
- [ ] Follow-up action logged and tracked

### Flow 30 — Client Escalation and Crisis
**Status:** TODO
**What:** Client raises urgent issue → escalation path → resolution → post-mortem.
**Steps:**
- [ ] Escalation tiers defined (AM → Founder → Emergency)
- [ ] Slack channel or thread created per escalation
- [ ] Resolution timer — SLA tracking
- [ ] Post-mortem template auto-generated
- [ ] Escalation history logged per client

---

## Phase 2 — Delivery and Operations (Flows 9–12, 31–32)

### Flow 9 — Campaign Build Flow
**Status:** TODO
**What:** New campaign brief → asset creation → platform build → launch.
**Steps:**
- [ ] Campaign brief template (populated from client strategy doc)
- [ ] Asana task sequence auto-created per campaign
- [ ] Asset checklist (copy, creative, landing page, tracking)
- [ ] Platform build checklist (Google Ads / Meta / LinkedIn)
- [ ] Launch approval gate (QA must pass before going live)
- [ ] Launch confirmation logged

### Flow 10 — Creative Review and Approval
**Status:** TODO
**What:** Creative assets submitted → reviewed → approved/revision → delivered.
**Steps:**
- [ ] Submission via Asana task or Drive folder
- [ ] Reviewer assigned (AM or founder depending on client tier)
- [ ] Approval status tracked (pending / approved / revision requested)
- [ ] Revision history maintained
- [ ] Auto-notify client when creative is ready for review

### Flow 11 — QA Grading Flow
**Status:** TODO
**What:** All deliverables graded against quality standards before going live.
**Steps:**
- [ ] QA checklist per deliverable type (ad copy, landing page, campaign setup)
- [ ] AI-assisted QA — Claude reviews against brand guidelines and best practices
- [ ] Grade logged (pass / conditional pass / fail)
- [ ] Fail triggers revision loop back to creator
- [ ] QA metrics tracked per team member over time

### Flow 12 — Reporting Flow
**Status:** PARTIAL
**What:** Monthly performance reports generated and delivered to clients.
**Exists:** Google Ads and Meta Ads data syncing, some report generation logic.
**Remaining:**
- [ ] Report template per client (branded, with commentary)
- [ ] Auto-populate with synced performance data
- [ ] AI-generated insights and recommendations section
- [ ] Report delivery via email or GHL
- [ ] Client acknowledgement tracking

### Flow 31 — Vendor and Freelancer Management
**Status:** TODO
**What:** External vendors/freelancers tracked, onboarded, performance reviewed.
**Steps:**
- [ ] Vendor registry in Turso (name, service, rate, start date, status)
- [ ] Onboarding checklist per vendor (NDA, access, brief)
- [ ] Work tracked via Asana tasks
- [ ] Monthly spend tracked per vendor
- [ ] Performance review quarterly
- [ ] Offboarding flow (access revocation)

### Flow 32 — Emergency Outage Flow
**Status:** TODO
**What:** Ad platform or service outage → detect → mitigate → communicate → resolve.
**Steps:**
- [ ] Monitoring for platform status (Google Ads, Meta, GHL API health)
- [ ] Auto-alert on detection (Slack)
- [ ] Client communication template (what happened, impact, ETA)
- [ ] Incident log in Turso
- [ ] Post-incident review

---

## Phase 3 — AI Systems (Flows 13–16, 33)

### Flow 13 — Admin Chatbot Flow
**Status:** TODO
**What:** Internal chatbot for the Vendo team — queries data, runs reports, answers questions.
**Steps:**
- [ ] Claude Code agent with access to all Turso data
- [ ] Natural language queries (e.g. "what's Client X's ROAS this month?")
- [ ] Accessible via Slack or Telegram channel
- [ ] Query logging for usage patterns
- [ ] Guardrails — read-only for most queries, write requires confirmation

### Flow 14 — Vendo Chatbot Flow
**Status:** TODO
**What:** Client-facing chatbot — answers FAQs, provides report summaries, books meetings.
**Steps:**
- [ ] Scoped agent per client (only sees their data)
- [ ] Embedded in client portal or delivered via GHL
- [ ] Can pull latest performance metrics
- [ ] Can book meetings via calendar integration
- [ ] Escalation to human AM if confidence low

### Flow 15 — Daily Brief Flow
**Status:** DONE
**What:** Automated daily brief generated every morning with key metrics and actions.
**Exists:** `scripts/functions/generate-daily-brief.ts`, outputs to `outputs/briefs/`.

### Flow 16 — SOP Creation and Update Flow
**Status:** TODO
**What:** SOPs auto-generated from process flows, kept current as processes change.
**Steps:**
- [ ] SOP template structure (purpose, steps, owner, last updated)
- [ ] Claude generates SOP from flow diagrams + meeting context
- [ ] Version control via git
- [ ] Quarterly review trigger — flag stale SOPs
- [ ] SOP index — searchable by topic/role

### Flow 33 — AI Fallback and Maintenance Flow
**Status:** TODO
**What:** When AI API calls fail — retry, fallback to manual, alert, audit quality.
**Diagram details (from PDF):**
- AI API call initiated → response check → quality check
- Error path: retry up to 3x → fallback mode → manual process + Slack alert
- Quality path: below threshold → flag for audit
- Monthly prompt audit: test against benchmarks → detect drift → update prompts
- Audit signed off and logged
**Steps:**
- [ ] API call wrapper with retry logic (3 attempts, exponential backoff)
- [ ] Quality scoring function for AI outputs
- [ ] Fallback mode flag — switches to manual process templates
- [ ] Slack alert on degraded AI service
- [ ] Monthly prompt audit script — compare outputs against benchmark
- [ ] Drift detection and prompt version tracking
- [ ] Audit log in Turso

---

## Phase 4 — Team and HR (Flows 17–20, 34–35)

### Flow 17 — Role Responsibility Flow
**Status:** TODO
**What:** Each role documented — responsibilities, KPIs, reporting line, tools used.
**Steps:**
- [ ] Role registry in Turso (or structured markdown in context/)
- [ ] Each role: name, owner, responsibilities, KPIs, tools, reporting to
- [ ] Linked to daily brief (each person sees role-relevant items)
- [ ] Quarterly review trigger

### Flow 18 — New Hire Onboarding
**Status:** TODO
**What:** New team member joins → access provisioned → training → productive.
**Steps:**
- [ ] Onboarding checklist template in Asana (auto-created)
- [ ] IT access provisioning (Slack, Asana, Drive, Turso, ad platforms)
- [ ] Training schedule and SOP reading list
- [ ] 30/60/90 day check-in reminders
- [ ] Buddy/mentor assignment

### Flow 19 — Performance Review Flow
**Status:** TODO
**What:** Quarterly performance reviews — data-driven, structured.
**Steps:**
- [ ] Performance data pulled from Asana (task completion), client metrics, meeting notes
- [ ] Self-assessment template
- [ ] Manager assessment template
- [ ] Review meeting agenda auto-generated
- [ ] Outcomes logged (goals set, development areas)
- [ ] Follow-up actions tracked in Asana

### Flow 20 — Hiring Flow
**Status:** TODO
**What:** Role identified → job posted → applications screened → interviewed → hired.
**Steps:**
- [ ] Role specification template (from Flow 17 data)
- [ ] Job posting draft generated by Claude
- [ ] Application tracking (spreadsheet or simple DB)
- [ ] Interview scorecard template
- [ ] Offer letter template
- [ ] Triggers Flow 18 (onboarding) on acceptance

### Flow 34 — Leave and Absence Cover Flow
**Status:** TODO
**What:** Leave request → approved → cover assigned → clients notified if needed → handback on return.
**Diagram details (from PDF):**
- Pre-leave: request submitted (Sarah approves) → dates confirmed → cover person assigned (AM or Rhiannon) → client list + context shared → Asana tasks reviewed + handed over → daily brief reconfigured → clients notified if >5 days
- During leave: urgent issues → cover handles per SOP → unresolvable → founder contacted
- Return: handback meeting → Asana tasks reassigned → daily brief reconfigured → return confirmed
**Steps:**
- [ ] Leave request form (or Slack command)
- [ ] Approval workflow (Sarah)
- [ ] Auto-assign cover based on role/availability
- [ ] Client notification template (if absence >5 days)
- [ ] Asana task reassignment script
- [ ] Daily brief reconfiguration for cover period
- [ ] Return handback checklist

### Flow 35 — IT Access Revocation / Staff Offboarding
**Status:** TODO
**What:** Staff exits → all access revoked same day → client handover → final admin.
**Diagram details (from PDF):**
- Exit trigger: confirmed (resignation/termination) → exit date confirmed (Sarah)
- Immediate: Slack removed → Asana removed → Drive removed → Turso removed → Vendo admin removed → verify all revoked (if not, flag to founder)
- Client + admin handover: AM reassigned → clients notified → final payroll (Sarah) → exit interview → access audit logged in Turso
**Steps:**
- [ ] Offboarding trigger (manual or HR system)
- [ ] Access revocation script (Slack API, Google Admin, Asana API, Turso)
- [ ] Revocation verification — check all access actually removed
- [ ] Client reassignment workflow
- [ ] Exit interview template
- [ ] Access audit log in Turso

---

## Phase 5 — Growth and Marketing (Flows 21–22, 36–37)

### Flow 21 — LinkedIn Content Flow
**Status:** TODO
**What:** Content calendar → drafts generated → reviewed → published → engagement tracked.
**Steps:**
- [ ] Content pillar framework (Teach, Sell, Build Trust, Personal)
- [ ] Weekly content calendar generated by Claude from meeting insights + performance data
- [ ] Draft posts generated with tone/style guidelines
- [ ] Approval workflow (founder reviews)
- [ ] Publishing schedule (or manual post with reminder)
- [ ] Engagement tracking synced back

### Flow 22 — Outbound Lead Gen Flow
**Status:** TODO
**What:** Target list → personalised outreach → follow-up sequence → meeting booked.
**Steps:**
- [ ] ICP definition and target list building
- [ ] Personalised email/DM drafts generated by Claude
- [ ] Outreach sequence in GHL (or manual with tracking)
- [ ] Response handling — auto-categorise (interested, not now, not interested)
- [ ] Meeting booking integration
- [ ] Conversion tracking (outreach → meeting → proposal → closed)

### Flow 36 — Case Study and Social Proof Flow
**Status:** TODO
**What:** Win identified → client permission → case study drafted → distributed.
**Diagram details (from PDF):**
- Win identification: monthly win spotted in reporting flow → qualifies for case study?
- If yes: client approves data use? If declined → used anonymously
- Creation: Claude drafts from report data → founder reviews + edits
- Distribution: published to website → LinkedIn post (Sell pillar) → added to proposal deck → added to outbound email sequence → stored in Google Drive
**Steps:**
- [ ] Monthly win identification criteria (ROAS threshold, lead volume, etc.)
- [ ] Client permission request template
- [ ] Case study template (challenge, approach, results, testimonial)
- [ ] Claude drafts from performance data + meeting notes
- [ ] Multi-channel distribution checklist
- [ ] Case study index in Turso

### Flow 37 — Referral and Partner Flow
**Status:** TODO
**What:** Referral received → tracked → converted → reward paid → relationship reviewed.
**Diagram details (from PDF):**
- Lead capture: referral received (client or agency partner) → source tagged in CRM → referral contacted + discovery booked
- Conversion: converts? If no → referrer thanked anyway. If yes → onboarded as client → reward type classified (client = invoice credit, partner = commission paid by Sarah)
- Referrer notified + thanked
- Logging: referral data in Turso → partner relationship reviewed quarterly
**Steps:**
- [ ] Referral tracking in GHL (source field + referrer name)
- [ ] Referral pipeline in Turso
- [ ] Reward rules (client referral = invoice credit, agency partner = commission)
- [ ] Auto-notify referrer on conversion
- [ ] Partner relationship dashboard
- [ ] Quarterly partner review trigger

---

## Phase 6 — Finance and Reporting (Flows 24–25, 38–39)

### Flow 24 — KPI Dashboard Flow
**Status:** PARTIAL
**What:** Real-time KPI dashboard pulling from all data sources.
**Exists:** Some metrics available via daily brief and Xero/Google Ads syncs.
**Remaining:**
- [ ] Dashboard schema — which KPIs, which sources, refresh frequency
- [ ] Revenue metrics (MRR, churn, LTV) from Xero
- [ ] Delivery metrics (tasks completed, campaigns launched) from Asana
- [ ] Performance metrics (ROAS, CPA, leads) from Google Ads + Meta
- [ ] Team metrics (utilisation, task velocity) from Asana
- [ ] Web dashboard or daily brief section

### Flow 25 — Revenue and Finance Flow
**Status:** PARTIAL
**What:** Revenue tracking, invoicing, cash flow visibility.
**Exists:** `scripts/sync/sync-xero.ts` for Xero data.
**Remaining:**
- [ ] MRR calculation from active client retainers
- [ ] Invoice status tracking (sent, overdue, paid)
- [ ] Cash flow forecast (based on retainer schedule + known expenses)
- [ ] Revenue by client dashboard
- [ ] Overdue invoice alerts

### Flow 38 — Client Profitability Flow
**Status:** TODO
**What:** Per-client profitability calculated from retainer fee vs cost of delivery.
**Diagram details (from PDF):**
- Cost inputs: monthly retainer (Turso/clients), AM time (Asana task hours), AI compute cost (API calls), ad management overhead (hours x rate)
- Margin calculation: total cost per client → gross margin → margin above 50% target?
- Outcomes: if margin <30% → urgent repricing or exit. If 30–50% → scope creep or inefficiency? Scope → reprice at renewal. Inefficiency → optimise delivery. If >50% → client flagged healthy. Founder notified if decision required.
- Profitability logged monthly in Turso
**Steps:**
- [ ] Cost model per client (retainer, AM hours from Asana, AI costs, ad mgmt overhead)
- [ ] Margin calculation script
- [ ] Threshold alerts (<30% critical, 30-50% warning, >50% healthy)
- [ ] Root cause classification (scope creep vs inefficiency)
- [ ] Monthly profitability log in Turso
- [ ] Founder notification on unhealthy clients

### Flow 39 — Expense and Accounts Payable Flow
**Status:** TODO
**What:** Expenses classified, approved, logged, reported.
**Diagram details (from PDF):**
- Classification: expense incurred → type classified (subscription/ad spend/team expense)
- Processing: receipt uploaded + coded (Sarah) → client or cost centre assigned → approval threshold check
- Approval: under threshold → auto-approved. Over → founder approval required. Rejected → returned.
- Logging: expense logged in Turso → monthly P+L updated (Sarah) → expense report generated for founder
**Steps:**
- [ ] Expense categories (subscription, ad spend, team)
- [ ] Approval threshold rules (auto-approve under X, founder approval over X)
- [ ] Expense logging in Turso (amount, category, client/cost centre, date, approver)
- [ ] Monthly P+L report generation
- [ ] Xero integration for expense reconciliation

---

## Implementation Priority (Recommended Order)

### Wave 1 — Foundation (complete what's partially built)
1. **Flow 3** — Data Ingestion into Turso (unifies everything)
2. **Flow 26** — Error Handling and Alerting (needed before scaling)
3. **Flow 4** — AI Agent Architecture (agent-to-flow mapping)
4. **Flow 1** — Ecosystem Architecture (formalise system map)

### Wave 2 — Client Lifecycle (highest revenue impact)
5. **Flow 5** — Lead to Sale
6. **Flow 6** — Client Onboarding
7. **Flow 7** — Monthly Client Cycle
8. **Flow 12** — Reporting Flow

### Wave 3 — Operations Quality
9. **Flow 9** — Campaign Build
10. **Flow 11** — QA Grading
11. **Flow 10** — Creative Review
12. **Flow 33** — AI Fallback and Maintenance

### Wave 4 — Finance
13. **Flow 25** — Revenue and Finance
14. **Flow 38** — Client Profitability
15. **Flow 39** — Expense and Accounts Payable
16. **Flow 24** — KPI Dashboard

### Wave 5 — Growth
17. **Flow 21** — LinkedIn Content
18. **Flow 22** — Outbound Lead Gen
19. **Flow 36** — Case Study and Social Proof
20. **Flow 37** — Referral and Partner

### Wave 6 — Team and HR
21. **Flow 17** — Role Responsibilities
22. **Flow 18** — New Hire Onboarding
23. **Flow 34** — Leave and Absence Cover
24. **Flow 35** — IT Access Revocation

### Wave 7 — Resilience and Scale
25. **Flow 27** — Backup and Disaster Recovery
26. **Flow 8** — Client Offboarding
27. **Flow 28** — Upsell and Cross-sell
28. **Flow 29** — Client NPS
29. **Flow 30** — Client Escalation
30. **Flow 32** — Emergency Outage
31. **Flow 31** — Vendor Management
32. **Flow 19** — Performance Reviews
33. **Flow 20** — Hiring
34. **Flow 16** — SOP Creation
35. **Flow 13** — Admin Chatbot
36. **Flow 14** — Vendo Client Chatbot

---

## Dependencies

```
Flow 3 (Data Ingestion) ──► ALL other flows depend on centralised data
Flow 26 (Error Handling) ──► All automated flows need error reporting
Flow 4 (Agent Architecture) ──► Flows 13, 14, 15, 33 (AI systems)
Flow 5 (Lead to Sale) ──► Flow 6 (Onboarding) ──► Flow 7 (Monthly Cycle) ──► Flow 8 (Offboarding)
Flow 12 (Reporting) ──► Flow 36 (Case Studies), Flow 38 (Profitability)
Flow 17 (Roles) ──► Flows 18, 19, 20, 34, 35 (HR flows)
Flow 25 (Revenue) ──► Flow 24 (KPI Dashboard), Flow 38 (Profitability)
```

---

## Tooling Requirements

| Tool | Purpose | Status |
|------|---------|--------|
| Turso (LibSQL) | Centralised database | 46 tables, connected |
| GHL API | CRM, pipelines, contacts | Sync exists |
| Xero API | Finance, invoicing | Sync exists |
| Asana API | Task management | Sync exists |
| Google Ads API | Ad performance | Sync exists |
| Meta Ads API | Ad performance | Sync exists |
| Fathom API | Meeting transcripts | Sync exists |
| Google Drive API | File management | Sync exists |
| Slack API | Alerts, chatbot, access management | Needs setup |
| LinkedIn API | Content posting (or manual) | Needs evaluation |
| Make/Zapier | Workflow glue for non-API flows | Optional |
