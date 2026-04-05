# Agent-to-Flow Map — Vendo OS

> Maps all 39 operational flows to RuFlo agent types, automation level, triggers, data dependencies, and escalation paths.

Last updated: 2026-04-02

---

## Legend

### Automation Levels

| Level | Meaning |
|-------|---------|
| **Automated** | Runs without human input; human reviews output |
| **Semi-automated** | Agent prepares work; human approves or intervenes at checkpoints |
| **Manual** | Human-driven with agent assistance on demand |

### Trigger Types

| Trigger | Meaning |
|---------|---------|
| **Scheduled** | Runs on a cron cadence (daily, weekly, monthly) |
| **Event-driven** | Fires on a webhook, database change, or pipeline stage transition |
| **Manual** | Initiated by a team member |

---

## Phase 1: System Infrastructure

| # | Flow | Primary Agent(s) | Automation | Trigger | Data Dependencies | Escalation |
|---|------|-------------------|------------|---------|-------------------|------------|
| 1 | Ecosystem Architecture | system-architect, planner | Manual | Manual | All tables (audit), sync_log | Toby |
| 2 | Meeting Data | task-orchestrator, backend-dev | Automated | Scheduled (daily) | meetings, action_items, key_decisions | Toby |
| 3 | Data Ingestion | backend-dev, task-orchestrator | Automated | Scheduled (daily) | All sync tables, sync_log | Toby |
| 4 | Agent Architecture | system-architect, planner | Manual | Manual | — (design-time) | Toby |
| 26 | Error Handling | backend-dev, security-auditor | Semi-automated | Event-driven (error logs) | sync_log, task_runs | Toby |
| 27 | Backup / DR | backend-dev, security-auditor | Automated | Scheduled (daily) | All tables (full DB) | Toby |

---

## Phase 2: Client Journey

| # | Flow | Primary Agent(s) | Automation | Trigger | Data Dependencies | Escalation |
|---|------|-------------------|------------|---------|-------------------|------------|
| 5 | Lead to Sale | task-orchestrator, researcher | Semi-automated | Event-driven (GHL stage change) | ghl_pipelines, ghl_stages, ghl_opportunities, meetings | Sam (Sales Lead) |
| 6 | Onboarding | task-orchestrator, content-writer | Semi-automated | Event-driven (deal won) | ghl_opportunities, clients, asana_tasks, brand_hub | Sam / Account Manager |
| 7 | Monthly Cycle | task-orchestrator, planner | Semi-automated | Scheduled (monthly) | clients, xero_invoices, meta_insights, gads_campaign_spend, asana_tasks | Account Manager |
| 8 | Offboarding | task-orchestrator, content-writer | Semi-automated | Event-driven (client churn flag) | clients, xero_invoices, asana_tasks | Sam |
| 28 | Upsell | researcher, content-writer | Semi-automated | Scheduled (monthly) | clients, meta_insights, gads_campaign_spend, xero_invoices, meetings | Account Manager |
| 29 | NPS | task-orchestrator | Automated | Scheduled (quarterly) | clients, meetings | Sam |
| 30 | Escalation | task-orchestrator, planner | Semi-automated | Event-driven (escalation trigger) | clients, meetings, action_items, asana_tasks | Toby |

---

## Phase 2: Delivery

| # | Flow | Primary Agent(s) | Automation | Trigger | Data Dependencies | Escalation |
|---|------|-------------------|------------|---------|-------------------|------------|
| 9 | Campaign Build | task-orchestrator, backend-dev | Semi-automated | Event-driven (onboarding complete) | clients, brand_hub, meta_ad_accounts, gads_accounts, asana_tasks | Delivery Lead |
| 10 | Creative Review | reviewer, content-writer | Semi-automated | Event-driven (creative submitted) | brand_hub, meta_ad_library, skills | Delivery Lead |
| 11 | QA Grading | tester, reviewer | Semi-automated | Event-driven (campaign ready) | meta_insights, gads_campaign_spend, skills | Delivery Lead |
| 12 | Reporting | task-orchestrator, content-writer | Automated | Scheduled (monthly) | meta_insights, gads_campaign_spend, xero_invoices, clients | Account Manager |
| 31 | Vendor Management | task-orchestrator, researcher | Semi-automated | Scheduled (quarterly) | xero_contacts, xero_invoices | Toby |
| 32 | Emergency Outage | task-orchestrator, backend-dev | Semi-automated | Event-driven (alert) | meta_ad_accounts, gads_accounts, clients | Toby (immediate) |

---

## Phase 3: AI Systems

| # | Flow | Primary Agent(s) | Automation | Trigger | Data Dependencies | Escalation |
|---|------|-------------------|------------|---------|-------------------|------------|
| 13 | Admin Chatbot | task-orchestrator, researcher | Automated | Event-driven (user message) | All tables (read-only), skills, meetings | Toby |
| 14 | Client Chatbot | task-orchestrator, content-writer | Semi-automated | Event-driven (client message) | clients, meta_insights, gads_campaign_spend, brand_hub | Account Manager |
| 15 | Daily Brief | planner, researcher, content-writer | Automated | Scheduled (daily, 06:00) | meetings, action_items, xero_invoices, ghl_opportunities, meta_insights, gads_campaign_spend, asana_tasks | Toby |
| 16 | SOP Creation | content-writer, reviewer | Semi-automated | Manual | skills, meetings, brand_hub | Toby |
| 33 | AI Fallback | task-orchestrator, backend-dev | Semi-automated | Event-driven (agent failure) | task_runs, sync_log | Toby |

---

## Phase 4: Team / HR

| # | Flow | Primary Agent(s) | Automation | Trigger | Data Dependencies | Escalation |
|---|------|-------------------|------------|---------|-------------------|------------|
| 17 | Roles | planner, content-writer | Manual | Manual | asana_tasks, skills | Toby |
| 18 | Team Onboarding | task-orchestrator, content-writer | Semi-automated | Event-driven (new hire) | users, skills, asana_tasks | Toby |
| 19 | Performance Review | researcher, planner | Semi-automated | Scheduled (quarterly) | asana_tasks, meetings, action_items | Toby |
| 20 | Hiring | researcher, content-writer | Semi-automated | Manual | — (external job boards) | Toby |
| 34 | Leave Cover | task-orchestrator, planner | Semi-automated | Event-driven (leave request) | asana_tasks, users, clients | Toby |
| 35 | IT Access Revocation | task-orchestrator, security-auditor | Semi-automated | Event-driven (offboarding trigger) | users, permissions, google_oauth_tokens | Toby |

---

## Phase 5: Growth

| # | Flow | Primary Agent(s) | Automation | Trigger | Data Dependencies | Escalation |
|---|------|-------------------|------------|---------|-------------------|------------|
| 21 | LinkedIn Content | content-writer, reviewer | Semi-automated | Scheduled (weekly) | meetings, skills, meta_ad_library | Toby / Marketing Lead |
| 22 | Outbound Lead Gen | web-researcher, content-writer | Semi-automated | Scheduled (weekly) | ghl_opportunities, clients, meta_ad_library | Sam |
| 36 | Case Studies | content-writer, researcher | Semi-automated | Event-driven (client milestone) | clients, meta_insights, gads_campaign_spend, meetings | Marketing Lead |
| 37 | Referral / Partner | task-orchestrator, content-writer | Semi-automated | Scheduled (monthly) | clients, ghl_opportunities, xero_invoices | Sam |

---

## Phase 6: Finance

| # | Flow | Primary Agent(s) | Automation | Trigger | Data Dependencies | Escalation |
|---|------|-------------------|------------|---------|-------------------|------------|
| 24 | KPI Dashboard | backend-dev, planner | Automated | Scheduled (daily) | All metrics tables (meta_insights, gads_campaign_spend, xero_pnl_monthly, ghl_opportunities, asana_tasks) | Toby |
| 25 | Revenue / Finance | researcher, planner | Semi-automated | Scheduled (monthly) | xero_invoices, xero_pnl_monthly, xero_bank_summary, clients | Toby |
| 38 | Client Profitability | researcher, planner | Semi-automated | Scheduled (monthly) | xero_invoices, meta_insights, gads_campaign_spend, clients, asana_tasks | Toby |
| 39 | Expense / AP | task-orchestrator, researcher | Semi-automated | Scheduled (fortnightly) | xero_invoices, xero_contacts, xero_bank_summary | Toby |

---

## Summary: Automation Distribution

| Level | Count | Percentage |
|-------|-------|------------|
| Automated | 8 | 21% |
| Semi-automated | 27 | 69% |
| Manual | 4 | 10% |

## Summary: Trigger Distribution

| Trigger | Count |
|---------|-------|
| Scheduled | 17 |
| Event-driven | 17 |
| Manual | 5 |

## Summary: Most-Used Agent Types

| Agent Type | Flow Count | Primary Role |
|------------|------------|--------------|
| task-orchestrator | 20 | Workflow coordination, multi-step process management |
| content-writer | 14 | Report generation, communications, documentation |
| planner | 12 | Strategic planning, resource allocation, scheduling |
| researcher | 11 | Data analysis, market research, pattern recognition |
| backend-dev | 8 | Infrastructure, sync scripts, API integrations |
| reviewer | 5 | Quality assurance, creative review, code review |
| security-auditor | 3 | Access control, error auditing, compliance |
| tester | 1 | Campaign QA grading |
| web-researcher | 1 | Outbound lead prospecting |
| system-architect | 2 | Architecture design, ecosystem planning |

---

## Data Dependency Heatmap

Tables referenced by 10+ flows (highest coupling):

| Table | Referenced By (flow count) |
|-------|---------------------------|
| `clients` | 18 |
| `meta_insights` | 12 |
| `asana_tasks` | 11 |
| `meetings` | 10 |
| `gads_campaign_spend` | 10 |
| `xero_invoices` | 10 |

Tables referenced by fewer than 3 flows (low coupling):

| Table | Referenced By (flow count) |
|-------|---------------------------|
| `drive_watch_channels` | 1 |
| `drive_sync_queue` | 1 |
| `google_oauth_tokens` | 1 |
| `ghl_pipelines` | 1 |
| `ghl_stages` | 1 |
| `xero_bank_summary` | 2 |

---

## Agent Assignment Principles

1. **task-orchestrator** is the default coordinator for any multi-step flow. It delegates to specialist agents.
2. **planner** handles strategic, analytical, or scheduling-heavy flows. Pairs with researcher for data-heavy analysis.
3. **content-writer** handles any flow that produces human-readable output (reports, briefs, SOPs, communications).
4. **backend-dev** handles any flow that requires code changes, API integration, or infrastructure work.
5. **reviewer** is a checkpoint agent — it validates output quality before delivery.
6. **security-auditor** is involved wherever access control, credentials, or compliance matter.
7. Every flow escalates to a named human. Financial approvals always escalate to Toby.
