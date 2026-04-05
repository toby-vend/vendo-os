# Ecosystem Map — Vendo OS

> Structured reference of every service, data flow, database table, web route, and sync schedule in the Vendo OS ecosystem. Machine-queryable, not prose.

Last updated: 2026-04-02

---

## 1. Services Registry

| Service | Purpose | API Type | Connection Status | Sync Script | Sync Frequency | Env Vars Required |
|---------|---------|----------|-------------------|-------------|----------------|-------------------|
| Fathom | Meeting recordings, transcripts, action items | MCP | Connected | `scripts/sync/sync-meetings.ts` | Daily | _(MCP — no env vars)_ |
| Xero | Invoicing, contacts, P&L, bank summaries | OAuth 2.0 REST | Connected | `scripts/sync/sync-xero.ts` | Daily | `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET` |
| GoHighLevel | CRM pipelines, opportunities, sales stages | REST API key | Connected | `scripts/sync/sync-ghl.ts` | Daily | `GHL_API_KEY` |
| Meta Ads | Ad account performance, campaign insights | REST (Graph API) | Connected | `scripts/sync/sync-meta-ads.ts` | Daily | `META_ACCESS_TOKEN` |
| Meta Ad Library | Competitor ad intelligence, creative library | REST (Graph API) | Connected | `scripts/sync/sync-meta-ad-library.ts` | Fortnightly | `META_ACCESS_TOKEN` |
| Google Ads | Campaign spend, account-level metrics | REST | Connected | `scripts/sync/sync-google-ads.ts` | Daily | `GOOGLE_ADS_DEVELOPER_TOKEN` |
| Asana | Task management, project tracking | MCP | Connected | `scripts/sync/sync-asana.ts` | Daily | _(MCP — no env vars)_ |
| Google Drive | SOPs, brand hub docs, skills library | OAuth 2.0 REST | Connected | `scripts/sync/sync-drive.ts` | Webhook + daily | _(OAuth — browser flow)_ |
| Slack | Team messaging, notifications | REST (Bot API) | Not connected | — | — | `SLACK_BOT_TOKEN` |
| Turso (LibSQL) | Remote database replication | LibSQL wire protocol | Connected | `scripts/sync/push-to-turso.ts` | After each sync run | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` |

---

## 2. Data Flow Map

```
External Services          Sync Scripts              SQLite / Turso           Web App
──────────────────         ─────────────             ──────────────           ───────

Fathom ──────────────► sync-meetings.ts ──────► meetings                ──► /meetings
                                          ──────► action_items           ──► /action-items
                                          ──────► key_decisions

Xero ────────────────► sync-xero.ts ─────────► xero_invoices           ──► /clients
                                          ──────► xero_contacts
                                          ──────► xero_pnl_monthly
                                          ──────► xero_bank_summary
                                          ──────► clients

GoHighLevel ─────────► sync-ghl.ts ──────────► ghl_pipelines           ──► /pipeline
                                          ──────► ghl_stages
                                          ──────► ghl_opportunities

Meta Ads ────────────► sync-meta-ads.ts ─────► meta_ad_accounts        ──► /ads
                                          ──────► meta_insights

Meta Ad Library ─────► sync-meta-ad-library.ts ► meta_ad_library

Google Ads ──────────► sync-google-ads.ts ───► gads_accounts           ──► /ads
                                          ──────► gads_campaign_spend

Asana ───────────────► sync-asana.ts ────────► asana_tasks             ──► /tasks

Google Drive ────────► sync-drive.ts ────────► skills                  ──► /skills-browser
                                          ──────► brand_hub             ──► /drive
                                          ──────► drive_watch_channels
                                          ──────► drive_sync_queue

(Internal) ──────────► sync-brands.ts ───────► brand_hub (enrichment)

All tables ──────────► push-to-turso.ts ─────► Turso remote DB         ──► Vercel deployment
```

### Data flow direction

| Direction | Description |
|-----------|-------------|
| Inbound | External service --> sync script --> local SQLite |
| Replication | Local SQLite --> push-to-turso.ts --> Turso remote |
| Outbound | Turso remote --> Fastify web app --> browser |
| Webhook | Google Drive --> Vercel endpoint --> drive_sync_queue --> process-drive-queue.ts |

---

## 3. Database Tables

### Meetings Domain

| Table | Source | Est. Rows | Refresh Cadence | Notes |
|-------|--------|-----------|-----------------|-------|
| `meetings` | Fathom | 450+ | Daily | Transcripts, summaries, attendees |
| `action_items` | Fathom (processed) | 1,500+ | Daily | Extracted from meeting transcripts |
| `key_decisions` | Fathom (processed) | 500+ | Daily | Decisions logged per meeting |

### Finance Domain

| Table | Source | Est. Rows | Refresh Cadence | Notes |
|-------|--------|-----------|-----------------|-------|
| `xero_invoices` | Xero | 1,000+ | Daily | All invoices with status |
| `xero_contacts` | Xero | 200+ | Daily | Supplier and client contacts |
| `xero_pnl_monthly` | Xero | 50+ | Daily | Monthly P&L summary rows |
| `xero_bank_summary` | Xero | 50+ | Daily | Bank account balances |
| `clients` | Xero (derived) | 50+ | Daily | Canonical client list |

### CRM / Pipeline Domain

| Table | Source | Est. Rows | Refresh Cadence | Notes |
|-------|--------|-----------|-----------------|-------|
| `ghl_pipelines` | GoHighLevel | 5–10 | Daily | Pipeline definitions |
| `ghl_stages` | GoHighLevel | 20–40 | Daily | Stages within pipelines |
| `ghl_opportunities` | GoHighLevel | 200+ | Daily | Deals / opportunities |

### Advertising Domain

| Table | Source | Est. Rows | Refresh Cadence | Notes |
|-------|--------|-----------|-----------------|-------|
| `meta_ad_accounts` | Meta Ads | 10–20 | Daily | Client ad accounts |
| `meta_insights` | Meta Ads | 5,000+ | Daily | Daily campaign metrics |
| `meta_ad_library` | Meta Ad Library | 500+ | Fortnightly | Competitor creative intel |
| `gads_accounts` | Google Ads | 10–20 | Daily | Google Ads accounts |
| `gads_campaign_spend` | Google Ads | 2,000+ | Daily | Campaign-level spend data |

### Content / Skills Domain

| Table | Source | Est. Rows | Refresh Cadence | Notes |
|-------|--------|-----------|-----------------|-------|
| `skills` | Google Drive | 200+ | Webhook + daily | SOPs and playbooks |
| `brand_hub` | Google Drive / sync-brands | 50+ | Daily | Brand guidelines per client |
| `drive_watch_channels` | Google Drive | 5–10 | Daily | Active webhook subscriptions |
| `drive_sync_queue` | Google Drive webhook | Variable | Real-time (webhook) | Pending file changes |

### Tasks Domain

| Table | Source | Est. Rows | Refresh Cadence | Notes |
|-------|--------|-----------|-----------------|-------|
| `asana_tasks` | Asana | 1,000+ | Daily | Project tasks and subtasks |

### Auth / System Domain

| Table | Source | Est. Rows | Refresh Cadence | Notes |
|-------|--------|-----------|-----------------|-------|
| `users` | Internal | 10–20 | On change | Web app user accounts |
| `sessions` | Internal | Variable | On change | Active login sessions |
| `permissions` | Internal | 20+ | On change | Role-based access control |
| `tasks` | Internal | 50+ | On change | Scheduled task definitions |
| `task_runs` | Internal | 500+ | On change | Task execution log |
| `sync_log` | Internal | 1,000+ | Each sync run | Sync execution history |
| `google_oauth_tokens` | Internal | 5–10 | On OAuth refresh | Drive OAuth credentials |

---

## 4. Web App Routes

Base URL: `https://app.vendodigital.co.uk` (Vercel) / `http://localhost:3000` (local dev)

### Dashboard

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Main dashboard |

### Meetings

| Method | Path | Description |
|--------|------|-------------|
| GET | `/meetings` | Meeting list (filterable) |
| GET | `/meetings/:id` | Meeting detail + transcript |

### Action Items

| Method | Path | Description |
|--------|------|-------------|
| GET | `/action-items` | Action items list (filterable by assignee, status) |

### Clients

| Method | Path | Description |
|--------|------|-------------|
| GET | `/clients` | Client list |
| GET | `/clients/:name` | Client detail |

### Pipeline (CRM)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/pipeline` | Pipeline overview |
| GET | `/pipeline/:id` | Opportunity detail |

### Advertising

| Method | Path | Description |
|--------|------|-------------|
| GET | `/ads` | Ad accounts overview |
| GET | `/ads/campaigns/:accountId` | Meta campaign detail |
| GET | `/ads/gads/campaigns/:accountId` | Google Ads campaign detail |

### Tasks & Automation

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tasks` | Scheduled tasks list |
| GET | `/tasks/new` | Create new task form |
| POST | `/tasks` | Create task |
| GET | `/task-runs` | Task run history (UI) |
| GET | `/task-runs/rows` | Task run table rows (HTMX partial) |
| GET | `/task-runs/new` | New task run form |
| GET | `/task-runs/task-types` | Available task types |
| POST | `/task-runs/new` | Submit new task run |
| GET | `/task-runs/:id` | Task run detail |
| POST | `/task-runs/:id/approve` | Approve task output |
| POST | `/task-runs/:id/reject` | Reject task output |
| POST | `/task-runs/:id/regenerate` | Re-run task |
| POST | `/api/task-runs/runs` | API: create task run (programmatic) |

### Drive / Skills

| Method | Path | Description |
|--------|------|-------------|
| GET | `/drive` | Drive file browser |
| GET | `/skills-browser` | Skills library by channel |
| POST | `/api/drive/webhook` | Google Drive change webhook receiver |
| GET | `/api/cron/renew-drive-channels` | Cron: renew Drive webhook subscriptions |

### Briefs

| Method | Path | Description |
|--------|------|-------------|
| GET | `/briefs` | Daily brief archive |
| GET | `/briefs/:date` | Brief for specific date |

### Chat

| Method | Path | Description |
|--------|------|-------------|
| GET | `/chat` | AI chat interface |

### Auth

| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/login` | Login page |
| POST | `/auth/login` | Submit login |
| GET | `/auth/logout` | Log out |
| GET | `/auth/change-password` | Change password form |
| POST | `/auth/change-password` | Submit password change |
| GET | `/auth/google/connect` | Initiate Google OAuth |
| GET | `/auth/google/callback` | Google OAuth callback |
| POST | `/auth/google/disconnect` | Disconnect Google account |

### Admin

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/users` | User management list |
| POST | `/admin/users` | Create user |
| GET | `/admin/users/:id/edit` | Edit user form |
| POST | `/admin/users/:id` | Update user |
| POST | `/admin/users/:id/delete` | Delete user |
| POST | `/admin/users/:id/reset-password` | Reset user password |
| GET | `/admin/permissions` | Permissions management |
| POST | `/admin/permissions` | Update permissions |
| GET | `/admin/usage` | System usage stats |

### System

| Method | Path | Description |
|--------|------|-------------|
| GET | `/sync-status` | Data sync status overview |
| GET | `/settings` | Application settings |

---

## 5. Sync Schedule

### Recommended Cadence

| Cadence | Services | Trigger | Script |
|---------|----------|---------|--------|
| **Real-time** | Google Drive (webhook) | Webhook POST to `/api/drive/webhook` | `process-drive-queue.ts` |
| **Daily** | Fathom, Xero, GoHighLevel, Meta Ads, Google Ads, Asana, Drive (full), Brands | `run-all.ts` or cron | All sync scripts via `run-all.ts` |
| **Fortnightly** | Meta Ad Library | Manual or cron | `run-fortnightly.sh` |
| **After each sync** | Turso push | Automatic (end of `run-all.ts`) | `push-to-turso.ts` |

### Orchestration

| Script | Purpose | Usage |
|--------|---------|-------|
| `scripts/sync/run-all.ts` | Runs all daily syncs in sequence, then pushes to Turso | `npx tsx scripts/sync/run-all.ts` |
| `scripts/sync/run-all.ts --only meetings,xero` | Run specific syncs only | Selective re-sync |
| `scripts/sync/run-all.ts --no-push` | Skip Turso push | Local-only sync |
| `scripts/sync/run-fortnightly.sh` | Fortnightly syncs (Meta Ad Library) | `bash scripts/sync/run-fortnightly.sh` |
| `scripts/sync/push-to-turso.ts` | Replicate local SQLite to Turso remote | `npx tsx scripts/sync/push-to-turso.ts` |

### Sync Timeout

Each individual sync has a 5-minute timeout enforced by `run-all.ts`.

---

## 6. Infrastructure

| Component | Technology | Location |
|-----------|------------|----------|
| Local database | SQLite | `data/vendo.db` |
| Remote database | Turso (LibSQL) | Turso cloud |
| Web framework | Fastify + Eta templates | `web/` |
| Hosting | Vercel (serverless) | Production |
| Package manager | npm | — |
| Language | TypeScript (tsx) | — |
| Auth | Session-based (bcrypt passwords) | Internal |

---

## 7. Environment Variables

### Required for full operation

| Variable | Service | Notes |
|----------|---------|-------|
| `XERO_CLIENT_ID` | Xero | OAuth app credentials |
| `XERO_CLIENT_SECRET` | Xero | OAuth app credentials |
| `GHL_API_KEY` | GoHighLevel | API key |
| `META_ACCESS_TOKEN` | Meta Ads + Ad Library | Long-lived token |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads | Developer token |
| `TURSO_DATABASE_URL` | Turso | Remote DB URL |
| `TURSO_AUTH_TOKEN` | Turso | Auth token |

### Not yet connected

| Variable | Service | Notes |
|----------|---------|-------|
| `SLACK_BOT_TOKEN` | Slack | Bot token for messaging |

### MCP-based (no env vars needed)

| Service | Notes |
|---------|-------|
| Fathom | Connected via MCP server |
| Asana | Connected via MCP server |
