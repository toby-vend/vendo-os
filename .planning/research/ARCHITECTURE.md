# Architecture Research

**Domain:** Agency OS — Google Drive-synced skills library + AI agent task execution in Fastify monolith
**Researched:** 2026-04-01
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  Drive UI    │  │  Skills UI   │  │  Task UI     │              │
│  │ (existing)   │  │  /skills/*   │  │  /tasks/*    │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
└─────────┼─────────────────┼─────────────────┼───────────────────────┘
          │                 │                 │
┌─────────▼─────────────────▼─────────────────▼───────────────────────┐
│                        BUSINESS LOGIC LAYER                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  Drive Sync  │  │  Skills      │  │  Task        │              │
│  │  Engine      │  │  Library     │  │  Executor    │              │
│  │              │  │              │  │              │              │
│  │ - Watch reg  │  │ - Classify   │  │ - Match      │              │
│  │ - Renewal    │  │ - FTS index  │  │ - Retrieve   │              │
│  │ - Extract    │  │ - Brand hub  │  │ - Generate   │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                 │                       │
│  ┌──────▼─────────────────▼─────────────────▼───────────────────┐   │
│  │                    QA Validator                               │   │
│  │           (validate output against SOP standard)             │   │
│  └───────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
          │                 │                 │
┌─────────▼─────────────────▼─────────────────▼───────────────────────┐
│                          DATA LAYER                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  skills      │  │  brand_hub   │  │  task_runs   │              │
│  │  (FTS5)      │  │  (per-client)│  │  (audit log) │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│  ┌──────────────┐  ┌──────────────┐                                │
│  │  drive_watch │  │  (existing   │                                │
│  │  _channels   │  │   tables)    │                                │
│  └──────────────┘  └──────────────┘                                │
└─────────────────────────────────────────────────────────────────────┘
          │                                   │
┌─────────▼───────────────────────────────────▼───────────────────────┐
│                       EXTERNAL SERVICES                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  Google      │  │  Google      │  │  Anthropic   │              │
│  │  Drive API   │  │  Docs Export │  │  API         │              │
│  │  (webhooks)  │  │  (text)      │  │  (Claude)    │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Location |
|-----------|----------------|----------|
| Drive Sync Engine | Register/renew webhook channels, receive push notifications, extract document text, trigger indexing | `web/routes/drive-webhook.ts`, `scripts/sync/sync-drive.ts` |
| Skills Library | Store classified documents (SOPs, templates, frameworks), FTS5 full-text search, channel classification (paid social / SEO / paid ads) | `web/lib/skills.ts`, DB: `skills` table |
| Brand Hub | Per-client brand files (tone, compliance, identifiers), keyed by client slug, queried by task executor | DB: `brand_hub` table |
| Task Executor | Accept task assignment, retrieve relevant skills + brand context, call Claude API, return draft | `scripts/functions/execute-task.ts` |
| QA Validator | Score agent output against SOP standards, trigger retry if below threshold | `scripts/functions/validate-output.ts` |
| Drive Watch Channels | Track active notification channels, expiry timestamps, resource IDs for renewal scheduling | DB: `drive_watch_channels` table |

## Recommended Project Structure

```
web/
├── routes/
│   ├── drive.ts              # existing Drive browser UI
│   ├── drive-webhook.ts      # NEW: POST /api/drive/webhook (receives push notifications)
│   ├── skills.ts             # NEW: GET /skills (skills library UI)
│   └── tasks.ts              # NEW: POST /tasks (task assignment + execution trigger)
├── lib/
│   ├── skills.ts             # NEW: skills retrieval, FTS search, brand context queries
│   ├── drive-sync.ts         # NEW: watch channel registration, renewal, document extraction
│   └── (existing files)
scripts/
├── sync/
│   ├── sync-drive.ts         # NEW: full Drive re-index (on-demand / initial setup)
│   └── (existing files)
├── functions/
│   ├── execute-task.ts       # NEW: task executor using Claude Agent SDK
│   ├── validate-output.ts    # NEW: QA validator
│   ├── renew-drive-watches.ts # NEW: cron-triggered channel renewal
│   └── generate-daily-brief.ts # existing
data/
└── vendo.db                  # extended with skills, brand_hub, task_runs, drive_watch_channels
```

### Structure Rationale

- **`web/routes/drive-webhook.ts`:** Receives Google push notifications. Must be a registered HTTPS endpoint. Lives in the web server so it is reachable via the Vercel deployment URL.
- **`web/lib/skills.ts`:** Query functions following the existing `queries.ts` pattern — keeps all DB access in `web/lib/`.
- **`web/lib/drive-sync.ts`:** Channel management logic separate from route handler; called both by the webhook handler (incremental sync) and the full re-index script.
- **`scripts/functions/execute-task.ts`:** Async, potentially long-running. Runs as a Vercel Function or cloud scheduled task — not in the request/response cycle of a route handler.
- **`scripts/sync/sync-drive.ts`:** Follows the existing sync script pattern. Backfills all Drive documents on initial setup; subsequent changes handled by webhooks.

## Architectural Patterns

### Pattern 1: Folder-Based Classification at Ingest

**What:** Classify documents by their Google Drive folder path at the point of indexing, not at query time.
**When to use:** Always — this is the chosen classification strategy per PROJECT.md constraints.
**Trade-offs:** Deterministic and fast; requires AMs to maintain correct folder structure; no fallback if folder structure is wrong.

```typescript
// In drive-sync.ts
function classifyByFolder(filePath: string): 'paid_social' | 'seo' | 'paid_ads' | 'general' {
  if (filePath.includes('/Paid Social/')) return 'paid_social';
  if (filePath.includes('/SEO/')) return 'seo';
  if (filePath.includes('/Paid Ads/')) return 'paid_ads';
  return 'general';
}
```

### Pattern 2: Incremental Sync via Push + Periodic Full Re-index

**What:** Google Drive push notifications handle real-time changes. A scheduled full re-index runs weekly as a safety net for missed notifications.
**When to use:** Always — required because Drive push channels expire (max 1 day for file resources, 1 week for changes resources per official docs).
**Trade-offs:** Handles channel expiry gaps; adds a scheduled job to maintain.

Channel renewal pattern:
```
drive_watch_channels table: { channel_id, resource_id, expiry_ms, channel_type }
renew-drive-watches.ts runs daily → find channels expiring within 12 hours → register new channel → update table
```

Note: Google Drive does NOT notify you before a channel expires — it silently stops. Renewal must be proactive, not reactive.

### Pattern 3: Retrieve-Then-Generate with FTS5

**What:** Use SQLite FTS5 full-text search to retrieve relevant skills documents before calling Claude API. No vector embeddings needed.
**When to use:** For this system — document corpus is small (SOPs/templates per channel), keyword search on structured documents is sufficient. Adding vector search is a future optimisation if relevance is poor.
**Trade-offs:** Simple, no external embedding service, works within Turso; less semantically aware than vector search.

```sql
-- skills table schema
CREATE VIRTUAL TABLE skills_fts USING fts5(
  title, content, channel, doc_type,
  content='skills', content_rowid='rowid'
);

-- Query: find SOPs relevant to "Meta ad copy for dental practice"
SELECT s.id, s.title, s.channel, s.doc_type, s.content
FROM skills_fts fts JOIN skills s ON s.rowid = fts.rowid
WHERE skills_fts MATCH 'meta ad copy dental'
  AND s.channel IN ('paid_social', 'general')
ORDER BY rank LIMIT 5;
```

### Pattern 4: Task Execution as Async Function (Not Request Handler)

**What:** Task execution (retrieve skills → call Claude → QA → return draft) runs as a background script or cloud function, not inside a Fastify request handler.
**When to use:** Always — Claude generation takes 10-60 seconds; Vercel serverless functions have a max timeout and HTTP requests should not block this long.
**Trade-offs:** Requires a job queue or polling mechanism for the UI to get results; adds complexity.

Simplest viable approach for this scale: task is written to `task_runs` table with `status: pending`, executor runs as a Vercel Function triggered by a webhook or cron, UI polls `/tasks/:id` for status.

### Pattern 5: QA as a Second Claude Call

**What:** After the primary generation call, a second cheaper/faster Claude call evaluates the output against SOP criteria and returns a structured score + verdict.
**When to use:** When output quality standards matter (ad copy, regulated dental content).
**Trade-offs:** Adds latency and API cost; prevents publishing non-compliant output.

```typescript
// validate-output.ts — second Claude call
const qa = await anthropic.messages.create({
  model: 'claude-haiku-4-5-20251001', // cheap, fast
  messages: [{
    role: 'user',
    content: `Evaluate this ad copy against the SOP checklist:\n\nSOP:\n${sopContent}\n\nOutput:\n${draftOutput}\n\nReturn JSON: { passes: boolean, score: number, issues: string[] }`
  }]
});
```

## Data Flow

### Drive Sync Flow (Incremental via Webhook)

```
Google Drive (AM edits file)
    ↓ push notification (POST /api/drive/webhook)
drive-webhook.ts route
    ↓ reads X-Goog-Resource-State header
    ↓ fetches changed file metadata from Drive API
    ↓ calls drive-sync.ts → extractDocumentText()
    ↓ classifyByFolder() → channel assignment
    ↓ upserts to skills table
    ↓ updates skills_fts virtual table
SQLite/Turso (updated skills index)
```

### Task Execution Flow

```
AM submits task via UI (client, channel, task type)
    ↓ POST /tasks
tasks.ts route handler
    ↓ writes task_runs row (status: pending, task details)
    ↓ triggers execute-task function (async, non-blocking)
    ↓ returns task_run id to UI
        [background]
        execute-task.ts
            ↓ queries skills_fts → retrieve top 5 relevant SOPs/templates
            ↓ queries brand_hub → fetch client brand context
            ↓ constructs prompt: task + skills + brand context
            ↓ calls Claude API (claude-sonnet-4-6 for quality)
            ↓ draft output returned
            ↓ validate-output.ts → QA check (claude-haiku-4-5-20251001)
            ↓ if QA fails: retry once with issues appended to prompt
            ↓ writes final output + QA score to task_runs row (status: complete)
UI polls GET /tasks/:id → returns output when status: complete
```

### Channel Renewal Flow

```
renew-drive-watches.ts (runs daily via cloud scheduled task)
    ↓ SELECT channels WHERE expiry_ms < NOW() + 12 hours
    ↓ for each expiring channel:
        ↓ POST to Drive API: files.watch or changes.watch (new channel_id)
        ↓ UPDATE drive_watch_channels: new channel_id, expiry_ms
    ↓ log renewal results
```

## Database Schema Extensions

New tables to add alongside existing schema:

```sql
-- Indexed Drive documents (skills, SOPs, templates)
CREATE TABLE skills (
  id TEXT PRIMARY KEY,              -- Google Drive file ID
  title TEXT NOT NULL,
  channel TEXT NOT NULL,            -- paid_social | seo | paid_ads | general
  doc_type TEXT NOT NULL,           -- sop | template | framework | guide
  content TEXT NOT NULL,            -- extracted plain text
  drive_url TEXT,
  file_modified_at TEXT,
  indexed_at TEXT DEFAULT (datetime('now')),
  is_active INTEGER DEFAULT 1
);

CREATE VIRTUAL TABLE skills_fts USING fts5(
  title, content, channel, doc_type,
  content='skills', content_rowid='rowid'
);

-- Per-client brand context
CREATE TABLE brand_hub (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_slug TEXT NOT NULL,
  brand_voice TEXT,
  compliance_notes TEXT,
  key_differentiators TEXT,
  target_audience TEXT,
  drive_file_id TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Active Drive notification channels
CREATE TABLE drive_watch_channels (
  channel_id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,      -- file | changes
  expiry_ms INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Task execution log
CREATE TABLE task_runs (
  id TEXT PRIMARY KEY,
  client_slug TEXT NOT NULL,
  channel TEXT NOT NULL,
  task_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',    -- pending | running | complete | failed
  input_context TEXT,               -- JSON: skills used, brand context
  draft_output TEXT,
  qa_score REAL,
  qa_issues TEXT,                   -- JSON array
  retry_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);
```

## Integration Points

### External Services

| Service | Integration Pattern | Key Constraints |
|---------|---------------------|-----------------|
| Google Drive Push Notifications | POST endpoint at `/api/drive/webhook` receives notification headers; no body for file resources; must respond 200 within timeout | HTTPS required; channels expire (max 1 day for files, 1 week for changes); renewal must be proactive |
| Google Drive REST API | Existing `getGoogleAccessToken()` pattern; fetch file metadata + export text via `files.export` for Google Docs | Service account preferred over per-user OAuth for server-side sync; per-user OAuth acceptable for initial implementation |
| Anthropic API (Claude) | Direct `@anthropic/sdk` messages.create calls (not Agent SDK for this use case — simpler prompt-in/output-out pattern) | Rate limits; cost scales with context size; use Haiku for QA, Sonnet for generation |

Note on Claude Agent SDK vs direct API: The Agent SDK (`@anthropic-ai/claude-agent-sdk`) is designed for file-system-aware agents that read/write local files. For VendoOS task execution — where context is assembled from DB queries and passed as a prompt — the direct Anthropic client SDK (`@anthropic/sdk`) is simpler and more appropriate. Agent SDK would be relevant if the executor needs to autonomously browse files.

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| drive-webhook.ts route → drive-sync.ts | Direct function call (synchronous extraction, async DB write) | Webhook must respond 200 quickly; heavy extraction should not block response |
| tasks.ts route → execute-task.ts | Via task_runs table (write status: pending, trigger async function) | Decoupled via DB poll; simplest viable approach at this scale |
| execute-task.ts → skills.ts | Direct import, DB query | No HTTP — both run in same Node.js process or function |
| execute-task.ts → Anthropic API | HTTP via @anthropic/sdk | Latency 5-30s; must not run in request cycle |

## Suggested Build Order

Dependencies between components determine this order:

1. **Database schema** — All other components depend on new tables existing. Extend `web/lib/queries.ts` with skills/brand/task queries.

2. **Drive Sync Engine** (`scripts/sync/sync-drive.ts` + `web/lib/drive-sync.ts`) — Required before skills library has any data. Implement full re-index first (webhook is incremental on top).

3. **Skills Library queries** (`web/lib/skills.ts`) — Once documents are indexed, FTS retrieval can be tested independently.

4. **Brand Hub data entry** — Can be seeded manually or via a simple admin UI. Required before task execution can include brand context.

5. **Webhook endpoint** (`web/routes/drive-webhook.ts`) — Enables real-time sync after the full re-index pattern is validated.

6. **Channel Renewal** (`scripts/functions/renew-drive-watches.ts`) — Must be set up before the webhook is in production use, or channels will expire silently.

7. **Task Executor** (`scripts/functions/execute-task.ts`) — Depends on skills + brand hub. Build as a testable script first, then wire to the route.

8. **QA Validator** (`scripts/functions/validate-output.ts`) — Add after executor produces baseline output. Can be skipped in MVP and added in next iteration.

9. **Task UI** (`web/routes/tasks.ts` + template) — Frontend wiring. Depends on task executor being functional.

## Anti-Patterns

### Anti-Pattern 1: Running Task Execution Inside a Route Handler

**What people do:** Call Claude API directly from a Fastify route handler, await the result, return it in the response.
**Why it's wrong:** Claude generation takes 10-60 seconds. Vercel serverless functions have execution limits. HTTP clients time out. Long-running synchronous handlers block the event loop and degrade dashboard responsiveness.
**Do this instead:** Write a `task_runs` row with `status: pending`, trigger execution asynchronously (Vercel background function or cloud scheduled task), and have the UI poll for completion.

### Anti-Pattern 2: Assuming Drive Webhook Channels Are Persistent

**What people do:** Register a channel once during setup and never renew it.
**Why it's wrong:** Google Drive channels expire silently. File-resource channels expire after at most 1 day. Changes channels last at most 1 week. Google does not send expiry notifications. The system will stop receiving updates without any error log.
**Do this instead:** Store expiry timestamps in `drive_watch_channels`. Run a daily renewal job that proactively re-registers channels expiring within 12 hours. Accept brief overlap periods (two active channels) as normal.

### Anti-Pattern 3: Using AI Classification for Drive Documents

**What people do:** Send document content to Claude and ask it to determine channel (paid social / SEO / paid ads).
**Why it's wrong:** Non-deterministic, adds latency and cost to every document ingest, and produces false positives when folder structure is already the correct classification signal.
**Do this instead:** Classify by folder path at ingest time. The Drive folder hierarchy is the authoritative classification maintained by AMs.

### Anti-Pattern 4: One Giant Skills Retrieval Query Across All Channels

**What people do:** Retrieve top-N skills documents regardless of channel when assembling task context.
**Why it's wrong:** An SEO SOP is irrelevant context for a paid social task. Irrelevant context increases prompt length, increases cost, and degrades output quality.
**Do this instead:** Filter by channel at retrieval time. The task executor knows the task channel; pass it as a filter to the FTS query before ranking.

### Anti-Pattern 5: Storing Full Document Text in FTS Table Only

**What people do:** Put all document content into the FTS virtual table and delete the base table.
**Why it's wrong:** SQLite FTS5 virtual tables are index-only; they cannot be used as the primary store for structured data (channel, doc_type, metadata).
**Do this instead:** Keep a `skills` base table with all metadata and content. Create a content-linked FTS5 virtual table (`content='skills'`) that indexes from the base table. Query joins both.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 25 clients, ~200 documents | Current monolith is fine. SQLite/Turso, inline execution, single Vercel deployment. |
| 100+ clients, 1000+ documents | FTS5 performance degrades on large corpora — consider adding `sqlite-vec` for vector search. Task queue should move to a proper job queue (e.g. Upstash QStash). |
| 500+ clients | Brand hub and skills library would benefit from dedicated read replicas. Task execution should move to separate service. |

At 25 clients and ~200 documents (realistic current scope), the described monolith architecture is appropriate with no premature scaling needed.

## Sources

- [Google Drive Push Notifications — Official Docs](https://developers.google.com/workspace/drive/api/guides/push) (updated March 2026) — HIGH confidence
- [SQLite FTS5 Extension](https://sqlite.org/fts5.html) — HIGH confidence
- [Anthropic Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview) — HIGH confidence
- [Anthropic Structured Outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) — HIGH confidence
- [Agentic Workflows 2026 — Vellum AI](https://vellum.ai/blog/agentic-workflows-emerging-architectures-and-design-patterns) — MEDIUM confidence
- Google Drive channel expiry behaviour (no automatic renewal, no expiry notification) — HIGH confidence, sourced from official docs + Prismatic integration guide

---
*Architecture research for: VendoOS skills library + AI agent task execution*
*Researched: 2026-04-01*
