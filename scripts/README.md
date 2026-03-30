# Scripts — Building Your Data & Function Layers

> This directory is where your sync scripts, analysis scripts, and automation live. It starts empty because the scripts you need depend on your specific business, tools, and tech stack. Claude will help you build them.

---

## When to Build This

**Not yet — if your Context layer is incomplete.** Go back to `/build-context` first.

The Data and Function layers require a solid Context foundation. Without it, you're building systems that don't understand why they exist.

---

## The Data Layer — What to Build First

> **You don't have to write these yourself.** For services with MCP, you can connect with zero code (see `reference/mcp-guide.md`). For everything else, tell Claude what data you want and it will build the script for you. The guide below is for reference — Claude uses it when building your integrations.

Your AI OS needs real business data. These scripts pull data from your external services into the project.

### Priority Order (build in this sequence)

| Priority | Data Source | Why It's Valuable | Typical Tools |
|----------|-----------|-------------------|---------------|
| 1 | **Call recordings / transcripts** | Every decision, commitment, and insight from calls | Zoom, Google Meet, Fireflies, Otter.ai, Plaud |
| 2 | **Team communication** | Messages, patterns, client channels | Slack, Discord, WhatsApp (export) |
| 3 | **SOP / Knowledge library** | SOPs, docs, processes, institutional knowledge | Google Drive, Notion, ClickUp |
| 4 | **CRM / Sales data** | Pipeline, deals, close rates, client info | GoHighLevel, HubSpot, Pipedrive, Airtable |
| 5 | **Financial data** | Revenue, expenses, profit, cash flow | Stripe, Xero, QuickBooks, spreadsheets |
| 6 | **Email** | Client communication, follow-ups, gaps | Gmail, Outlook |
| 7 | **Project data** | Tasks, workload, delivery status | ClickUp, Asana, Monday.com |
| 8 | **Marketing data** | Ad performance, traffic, conversions | Meta Ads, Google Ads, GA4, YouTube |

### How to Build a Sync Script

You don't need to write these manually. Paste this into Claude Code:

```
I want to pull data from [SERVICE NAME] into my AI OS. Build me a sync script that pulls [WHAT YOU WANT] into a local database. Use /create-plan first.
```

Claude will plan the integration, build the script, and test it. The script will:
- Connect to the service's API
- Pull relevant data
- Store it locally (SQLite recommended for text data)
- Be re-runnable (sync new data without duplicating)

### Database Strategy

| Data Type | Recommended Storage | Why |
|-----------|-------------------|-----|
| Text-heavy (transcripts, messages, posts) | **SQLite** | Local, fast, full-text search, no setup |
| Structured metrics (revenue, KPIs, pipeline) | **Cloud DB (Supabase/PostgreSQL)** | Remote access, dashboards, API-friendly |
| Both (ideal) | **Hybrid** | SQLite for text, cloud for metrics |

### Set Up Semantic Search

Once you have data flowing in, set up semantic search so your AI OS can find information by meaning, not just keywords.

Paste this into Claude Code:

```
I want to set up a Supabase project with pgvector so my AI OS can do semantic search across all my data. Walk me through creating the project, setting up the database, and configuring vector search. Use /create-plan first.
```

Claude will set up everything — the Supabase project, database tables, pgvector extension, and embedding generation.

**What this unlocks:**

- "What are the biggest client frustrations in the last 30 days?" — searched across call transcripts, Slack, and emails by meaning
- "Find meetings where we discussed pricing changes" — finds relevant conversations even without exact keyword matches
- "Show me all decisions related to hiring" — searches your decision journal semantically

This is what turns raw data into intelligence. It's not required to get started, but it's what makes the Daily Brief and other functions genuinely powerful.

---

## The Function Layer — What to Build Second

> **Automate without a server:** Once you've built a function, you can schedule it to run automatically on Anthropic's cloud — no VPS or cron jobs needed. See `reference/scheduling.md`.

Once data is flowing, build systems that act on it.

### Recommended Build Order

| Order | Function | What It Does | Depends On |
|-------|----------|-------------|-----------|
| 1 | **Daily Brief** | Morning intelligence report: financial pulse, team health, priorities | Meeting data + CRM data + financial data |
| 2 | **Meeting Intelligence** | Auto-summarise meetings, extract action items, track commitments | Meeting transcript data |
| 3 | **Communication Analysis** | Flag missed replies, communication gaps, team patterns | Email + Slack data |
| 4 | **Task Automation** | Meeting action items → tracked tasks, auto-reminders | Meeting Intelligence + project data |
| 5 | **Content Pipeline** | Generate ideas, outlines, and drafts from your data | All data sources |
| 6 | **Decision Engine** | Full implementation of `/decide` with semantic matching | Decision logs + vector search |

### How to Build a Function

1. Run `/create-plan build [function name]` — Claude will plan the system
2. Run `/implement` on the plan — Claude will build it
3. Each function should:
   - Read from Context (understand the business)
   - Read from Data (use real numbers and content)
   - Output to `outputs/` (briefs to `outputs/briefs/`, analyses to `outputs/analyses/`)
   - Start in "Inform" mode (present information, user acts)

---

## The Daily Brief — Your First Function

The Daily Brief is the single most valuable function in your AI OS. It's a morning intelligence report that covers everything across your business in one document.

### Suggested Sections

1. **Financial Pulse** — Revenue position, cash flow, outstanding invoices
2. **Pipeline & Sales** — New leads, deals in progress, close rate trends
3. **Client Health** — At-risk clients, satisfaction signals, upcoming renewals
4. **Team Pulse** — Communication patterns, workload signals, who needs attention
5. **Meeting Follow-ups** — Action items from recent meetings, undelivered commitments
6. **Strategic Analysis** — Progress against priorities, risks, opportunities
7. **Today's Priorities** — AI-recommended focus areas based on all data

### How to Build It

Run: `/create-plan build a daily brief that covers my key business metrics, team health, and priorities`

Claude will plan and build a brief generation script that pulls from your connected data sources and produces a structured morning report.

---

## Folder Organisation

As you build scripts, organise them by function:

```
scripts/
├── README.md              # This file
├── sync/                  # Data ingestion scripts
│   ├── sync-crm.ts       # CRM data sync
│   ├── sync-meetings.ts  # Meeting transcript sync
│   └── sync-slack.ts     # Slack message sync
├── analysis/              # Intelligence and analysis
│   ├── generate-brief.ts # Daily Brief generator
│   └── meeting-summary.ts # Meeting summariser
└── utils/                 # Shared utilities
    ├── db.ts             # Database helpers
    └── anthropic.ts      # AI model helpers
```

---

## Tech Stack Recommendations

| Need | Recommendation | Why |
|------|---------------|-----|
| Language | **TypeScript** | Best Claude Code support, type safety, great ecosystem |
| Runtime | **tsx** (via `npx tsx script.ts`) | No build step, run TypeScript directly |
| Local database | **better-sqlite3** | Fast, reliable, full-text search via FTS5 |
| Cloud database | **Supabase** | Free tier generous, PostgreSQL, REST API, real-time |
| AI models | **Anthropic SDK** | Direct access to Opus/Sonnet/Haiku |
| HTTP requests | **Built-in fetch** | No extra dependencies for API calls |
| Scheduling | **Cloud Scheduled Tasks** (Anthropic-hosted) or node-cron for local | For automated daily/hourly runs |

---

_Don't build everything at once. Start with one data source, one function. Get it working. Then expand. The build path is iterative — each addition compounds the value of everything before it._
