# Phase 6: Task Matching Engine - Research

**Researched:** 2026-04-01
**Domain:** Async task queuing, SOP + brand context retrieval, task_runs lifecycle management
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TASK-01 | AM can assign a task by selecting client, channel, and task type | POST /api/tasks/runs route writes to task_runs with status=queued; returns immediately |
| TASK-02 | Task matching engine retrieves relevant SOPs based on channel + task type | searchSkills(query, channel) from drive.ts is the retrieval mechanism; query is constructed from task_type |
| TASK-03 | Task matching engine retrieves client brand context and injects it into agent prompt | getBrandContext(clientSlug) from brand.ts; client_slug derived from client_id lookup |
| TASK-06 | Task execution runs asynchronously — does not block the web request | Fire-and-forget after reply.send(); Vercel serverless requires response-then-background pattern |
| TASK-07 | Each task has a status: queued / generating / qa_check / draft_ready / approved / failed | task_runs.status column already exists; query module needs updateTaskRunStatus() |
</phase_requirements>

---

## Summary

Phase 6 introduces the task submission endpoint and the context-assembly engine that backs it. An AM submits a task (client + channel + task type), the HTTP route writes a `task_runs` row with `status=queued` and responds immediately, then a fire-and-forget function assembles context (SOP retrieval + brand context) and transitions the task to `generating` (Phase 7 completes the actual generation). This phase stops at context assembly and status bookkeeping — the LLM call is Phase 7.

The infrastructure already exists. `task_runs` is in the schema (Phase 1). `searchSkills()` is in `web/lib/queries/drive.ts` (Phase 4). `getBrandContext()` is in `web/lib/queries/brand.ts` (Phase 5). The Fastify server already handles async fire-and-forget in the Drive webhook pattern. The Anthropic SDK is installed. No new dependencies are required.

The primary design decision is the async execution model. The project runs on Vercel serverless. Vercel serverless functions must respond before their timeout or the response is dropped. The established project pattern is to enqueue work (see drive webhook → sync queue), not to background within the same request lifecycle. For Phase 6, the correct pattern is: respond 200 with `{id, status:'queued'}` then trigger the context-assembly logic in a fire-and-forget `Promise` that immediately writes `sops_used` + `brand_context_id` to the task run and transitions to `generating`. The actual LLM call is Phase 7's responsibility.

**Primary recommendation:** New `web/lib/queries/task-runs.ts` module plus a `POST /api/tasks/runs` Fastify route. Context assembly runs fire-and-forget after reply.send(). No new queuing infrastructure needed — task_runs IS the queue.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@libsql/client` | 0.17.2 | task_runs reads/writes via Turso | Already the DB client for all query modules |
| `fastify` | 5.8.4 | HTTP route for task submission | Established server framework |
| `@anthropic-ai/sdk` | ^0.81.0 | Already installed, referenced by Phase 7 | Phase 6 only prepares context; SDK not called here but import pattern established |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js `node:test` | built-in | Unit tests for task-runs query module | All query module tests use this pattern |
| `tsx/esm` | dev dep | ESM TypeScript in `--import` flag | Established test runner flag |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Fire-and-forget Promise | BullMQ / pg-boss / Inngest | Job queue adds infrastructure complexity; task_runs already provides queue semantics; fire-and-forget acceptable at current scale |
| task_runs as the queue | Separate queue table | task_runs IS the persistent state; a separate queue would duplicate records without adding value |
| FTS5 BM25 for SOP retrieval | Embedding-based semantic search | Embeddings require external service + cost; BM25 already proven in Phase 4 with good results for SOP retrieval |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Project Structure

```
web/
├── lib/
│   └── queries/
│       ├── task-runs.ts          # New: task_runs query module
│       └── task-runs.test.ts     # New: TDD tests
├── routes/
│   └── task-runs.ts              # New: POST /api/tasks/runs, GET /api/tasks/runs/:id
└── lib/
    └── task-matcher.ts           # New: context assembly logic (searchSkills + getBrandContext)
```

### Pattern 1: task_runs Query Module

**What:** Domain query module for task_runs, following exact same structure as `drive.ts` and `brand.ts` — imports from `./base.js`, exports typed functions.
**When to use:** All DB reads/writes for task_runs go through this module.

```typescript
// web/lib/queries/task-runs.ts
import { rows, scalar, db } from './base.js';

export type TaskRunStatus = 'queued' | 'generating' | 'qa_check' | 'draft_ready' | 'approved' | 'failed';

export interface TaskRunRow {
  id: number;
  client_id: number;
  channel: string;
  task_type: string;
  status: TaskRunStatus;
  sops_used: string | null;      // JSON array of skill IDs
  brand_context_id: number | null;
  output: string | null;
  qa_score: number | null;
  qa_critique: string | null;
  attempts: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export async function createTaskRun(data: {
  clientId: number;
  channel: string;
  taskType: string;
  createdBy: string;
}): Promise<number> {
  const now = new Date().toISOString();
  const result = await db.execute({
    sql: `INSERT INTO task_runs (client_id, channel, task_type, status, attempts, created_by, created_at, updated_at)
          VALUES (?, ?, ?, 'queued', 0, ?, ?, ?)`,
    args: [data.clientId, data.channel, data.taskType, data.createdBy, now, now],
  });
  return Number(result.lastInsertRowid);
}

export async function updateTaskRunStatus(
  id: number,
  status: TaskRunStatus,
  extras?: { sopsUsed?: number[]; brandContextId?: number },
): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE task_runs SET status = ?, sops_used = ?, brand_context_id = ?, updated_at = ? WHERE id = ?`,
    args: [
      status,
      extras?.sopsUsed ? JSON.stringify(extras.sopsUsed) : null,
      extras?.brandContextId ?? null,
      now,
      id,
    ],
  });
}

export async function getTaskRun(id: number): Promise<TaskRunRow | null> {
  const result = await rows<TaskRunRow>('SELECT * FROM task_runs WHERE id = ?', [id]);
  return result[0] ?? null;
}
```

### Pattern 2: Fire-and-Forget After Reply

**What:** The Fastify route sends the response, then kicks off async context assembly without awaiting it.
**When to use:** Any operation that must not block the web request. Established precedent: drive webhook enqueues then returns 200.

```typescript
// web/routes/task-runs.ts — POST handler
app.post('/', async (request, reply) => {
  const { clientId, channel, taskType } = request.body as TaskRunPayload;
  const user = (request as any).user as SessionUser;

  // Validate inputs
  if (!VALID_CHANNELS.includes(channel) || !clientId || !taskType) {
    return reply.code(400).send({ error: 'invalid_input' });
  }

  // Write queued record — this is the only await before responding
  const taskRunId = await createTaskRun({
    clientId, channel, taskType, createdBy: user.email,
  });

  // Respond immediately — TASK-06
  reply.code(202).send({ id: taskRunId, status: 'queued' });

  // Fire-and-forget context assembly — runs after response is sent
  assembleContext(taskRunId, clientId, channel, taskType).catch((err) => {
    request.log.error({ taskRunId, err }, 'context assembly failed');
    // Status update to 'failed' happens inside assembleContext's catch block
  });
});
```

### Pattern 3: Context Assembly Function

**What:** Pure function that retrieves SOPs and brand context, writes results to task_runs, transitions status.
**When to use:** Called fire-and-forget from the route after reply.send().

```typescript
// web/lib/task-matcher.ts
import { searchSkills } from './queries/drive.js';
import { getBrandContext, listBrandClients } from './queries/brand.js';
import { updateTaskRunStatus } from './queries/task-runs.js';

export async function assembleContext(
  taskRunId: number,
  clientId: number,
  channel: string,
  taskType: string,
): Promise<void> {
  try {
    // Transition to generating immediately so status polling reflects work in progress
    await updateTaskRunStatus(taskRunId, 'generating');

    // Retrieve top SOPs for this channel + task type (TASK-02)
    const sopResults = await searchSkills(taskType, channel, 5);
    const sopIds = sopResults.results.map(r => r.id);

    // Retrieve client brand context (TASK-03)
    // client_slug derived from clientId — requires a clients lookup
    const clientSlug = await resolveClientSlug(clientId);
    const brandFiles = clientSlug ? await getBrandContext(clientSlug) : [];
    const brandContextId = brandFiles[0]?.id ?? null;

    // Write assembled context back to task_run — Phase 7 reads sops_used + brand_context_id
    await updateTaskRunStatus(taskRunId, 'generating', {
      sopsUsed: sopIds,
      brandContextId: brandContextId ?? undefined,
    });
  } catch (err) {
    await updateTaskRunStatus(taskRunId, 'failed').catch(() => {});
    throw err;
  }
}
```

### Pattern 4: Client Slug Resolution

**What:** The `task_runs` table stores `client_id` (integer). Brand context lookup requires `client_slug`. A resolution function bridges them.
**When to use:** Context assembly and any route that needs client slug from client ID.

The `brand_hub` table has both `client_id` and `client_slug`. Query it to resolve:

```typescript
// Inside task-matcher.ts or task-runs.ts
async function resolveClientSlug(clientId: number): Promise<string | null> {
  const result = await rows<{ client_slug: string }>(
    'SELECT client_slug FROM brand_hub WHERE client_id = ? LIMIT 1',
    [clientId],
  );
  return result[0]?.client_slug ?? null;
}
```

This is a safe no-op — if no brand file exists for the client, `brandContextId` stays null. The task still proceeds with SOP context only.

### Pattern 5: Valid Channel + Task Type Taxonomy

**What:** Input validation must use the existing controlled vocabulary from the codebase.
**When to use:** POST route body validation.

From `web/lib/drive-sync.ts` (confirmed):
- Channels: `paid_social`, `seo`, `paid_ads`
- Skill types (SKILL_TYPE_MAP): `ad_copy_template`, `creative_framework`, `content_guide`, `performance_sop`, `audience_research`, `reporting_template`, `client_comms`, `onboarding`, `sop`, `general`

The POST body `taskType` should be one of these values. The FTS query in `searchSkills()` uses the task_type as the search query, so free text also works — but validation against known types is preferred for integrity.

### Anti-Patterns to Avoid

- **Awaiting assembleContext before reply:** Blocks the web request. Violates TASK-06. Always fire-and-forget.
- **Storing full SOP content in sops_used:** The column is JSON of skill IDs only. Phase 7 fetches content at generation time. Storing content in task_runs would bloat the table.
- **Querying brand_hub without clientSlug:** `searchBrandContent` without slug returns global results — violates BRND-04. Always use `getBrandContext(clientSlug)` which enforces client isolation by design.
- **Using task_type as raw FTS query without sanitisation:** `searchSkills()` already sanitises — strip quotes, split tokens, append `*`. Do not duplicate this logic; call searchSkills() and let it handle it.
- **Creating a new queue table:** task_runs already has `status`, `created_at`, indexes on `client_id`, `status`, `created_at`. It IS the queue. No separate queue table.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| FTS5 SOP retrieval | Custom keyword matching | `searchSkills()` from `drive.ts` | Already implemented, tested, BM25-ranked, handles gap detection |
| Brand context fetch | SQL query inline in route | `getBrandContext(clientSlug)` from `brand.ts` | Client isolation (BRND-04) is enforced inside this function |
| FTS5 query sanitisation | String manipulation | `searchSkills()` internal sanitiser | Already strips quotes, splits tokens, appends wildcards |
| Status transition logic | Custom SQL in route | `updateTaskRunStatus()` from task-runs.ts | Centralises the updated_at timestamp logic |

**Key insight:** All retrieval infrastructure was purpose-built in Phases 4 and 5 to be called exactly here. The task matcher is mostly wiring, not new logic.

---

## Common Pitfalls

### Pitfall 1: Vercel Serverless Background Promise Truncation

**What goes wrong:** On Vercel, once the response is sent the serverless function may be killed before the fire-and-forget promise completes. Context assembly starts but never writes results.
**Why it happens:** Vercel serverless functions are not guaranteed to run beyond the response send on their default execution model.
**How to avoid:** This is acceptable for Phase 6 because `assembleContext` only writes metadata to the DB (fast, < 1s typically). The actual LLM call (Phase 7) will need a different pattern — potentially a dedicated cron endpoint or Vercel background function. For Phase 6, the assembleContext work is lightweight enough that fire-and-forget within the request handler window is safe. The `task_runs.status` starts as `queued` — if the function is killed, the status never advances to `generating` and the task is visibly stuck, not silently corrupted.
**Warning signs:** Tasks stuck in `queued` status in production; works fine in local dev.

### Pitfall 2: client_id → client_slug Resolution Failure

**What goes wrong:** The `task_runs` table stores `client_id` (integer). The brand hub is keyed by `client_slug`. If a client has no brand files yet, `resolveClientSlug()` returns null and brand context is silently skipped.
**Why it happens:** `brand_hub` is populated from Drive. New clients may not have brand files yet.
**How to avoid:** This is correct behaviour — proceed with SOP context only, set `brand_context_id = null`. Do not fail the task. Log a warning so the gap is visible.
**Warning signs:** `brand_context_id` is always null in `task_runs` — check whether brand files exist for active clients.

### Pitfall 3: FTS5 gap when task_type has no matching SOPs

**What goes wrong:** `searchSkills()` returns `gap: true` when zero results match the channel + task_type query. If Phase 6 does not handle this, the task proceeds to generation with empty SOP context — defeating the purpose of the system.
**Why it happens:** A task type with no indexed SOPs, or the FTS query finds no match.
**How to avoid:** Check `sopResults.gap` in `assembleContext()`. If gap is true, set status to `failed` with a structured error logged. The REQUIREMENTS doc explicitly says SKIL-05 surfaces an explicit "no matching skill found" signal — honour it here.
**Warning signs:** Tasks generating with `sops_used = []`.

### Pitfall 4: Race condition on status transitions

**What goes wrong:** Two concurrent requests for the same client/channel/task_type both pass validation and create duplicate `queued` rows.
**Why it happens:** No uniqueness constraint on `(client_id, channel, task_type, status='queued')` in the schema.
**How to avoid:** Do not add a constraint — the schema is set (Phase 1). Instead, the route should check for existing `queued` or `generating` rows for the same client+channel+task_type combination before inserting. Alternatively, accept duplicates for v1 and handle deduplication in the task list UI (Phase 10). The simpler v1 approach: allow duplicates, document as known limitation.
**Warning signs:** Duplicate task rows in the task list.

### Pitfall 5: Wrong import path for query modules

**What goes wrong:** TypeScript compiled with `moduleResolution: bundler` does not auto-resolve `.js` extensions. Import `from './base.js'` not `from './base'`.
**Why it happens:** Established project decision — all query module imports use explicit `.js` extension.
**How to avoid:** Follow the same import pattern as all other query modules: `import { rows, scalar, db } from './base.js'`.

---

## Code Examples

### Creating a task run row

```typescript
// Source: pattern from existing query modules (drive.ts, brand.ts)
const now = new Date().toISOString();
const result = await db.execute({
  sql: `INSERT INTO task_runs (client_id, channel, task_type, status, attempts, created_by, created_at, updated_at)
        VALUES (?, ?, ?, 'queued', 0, ?, ?, ?)`,
  args: [clientId, channel, taskType, createdBy, now, now],
});
const taskRunId = Number(result.lastInsertRowid);
```

### Searching SOPs for a task

```typescript
// Source: web/lib/queries/drive.ts — searchSkills()
// task_type as FTS query; returns top 5 results ranked by BM25 (ASC = most relevant)
const sopResults = await searchSkills(taskType, channel, 5);
if (sopResults.gap) {
  // No matching SOPs — fail the task rather than generating without grounding
  await updateTaskRunStatus(taskRunId, 'failed');
  return;
}
const sopIds = sopResults.results.map(r => r.id);
```

### Getting brand context with client isolation

```typescript
// Source: web/lib/queries/brand.ts — getBrandContext()
// Always uses clientSlug — enforces BRND-04 client isolation
const brandFiles = await getBrandContext(clientSlug);
// brandFiles is BrandHubRow[] — content field contains the full brand document
```

### Resolving client slug from brand_hub

```typescript
// Source: derived from brand_hub schema (Phase 5)
const result = await rows<{ client_slug: string }>(
  'SELECT client_slug FROM brand_hub WHERE client_id = ? LIMIT 1',
  [clientId],
);
const clientSlug = result[0]?.client_slug ?? null;
```

### Test pattern (from brand.test.ts and drive.test.ts)

```typescript
// Source: web/lib/queries/brand.test.ts — established project test pattern
// Run: node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/task-runs.test.ts

const testDb = createClient({ url: ':memory:' });

mock.module('./base.js', {
  namedExports: {
    db: testDb,
    rows: async <T>(sql: string, args = []) => { ... },
    scalar: async <T = number>(sql: string, args = []) => { ... },
  },
});

const { createTaskRun, updateTaskRunStatus, getTaskRun } = await import('./task-runs.js');
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| N/A — new feature | task_runs as persistent queue with status lifecycle | Phase 1 schema | Status transitions are the source of truth; no separate queue table needed |
| Blocking HTTP handlers | Fire-and-forget after reply.send() | Established in Drive webhook (Phase 2) | Route returns 200/202 immediately; heavy work decoupled |

**Deprecated/outdated:**
- None applicable — this is new feature territory.

---

## Open Questions

1. **Client list source for the task submission form**
   - What we know: `brand_hub` has `client_id + client_name + client_slug`. No separate `clients` table exists in the schema.
   - What's unclear: Phase 10 (AM Interface) will need a client dropdown. Phase 6 only needs to accept `client_id` in the POST body. The planner should decide whether to derive the client list from `brand_hub` or defer to Phase 10.
   - Recommendation: For Phase 6, accept raw `client_id` integer in the POST body. Client dropdown is Phase 10's concern.

2. **Vercel background function vs fire-and-forget for Phase 7**
   - What we know: Phase 6's context assembly is fast (2 DB queries). Phase 7's LLM call may take 10–30 seconds and will hit Vercel's 60-second serverless limit.
   - What's unclear: Whether Phase 7 should use a dedicated cron-triggered endpoint (like drive-cron) or a Vercel background function.
   - Recommendation: Phase 6 research flags this as a Phase 7 concern. Phase 6 sets `status=generating` and stops. Phase 7 can pick up `generating` rows via a cron endpoint. Document the handoff contract here so Phase 7 planner can implement accordingly.

3. **sops_used column type**
   - What we know: `sops_used TEXT` in schema, intended to hold JSON. Schema doesn't enforce JSON validity.
   - What's unclear: Whether to store `[skill_id_1, skill_id_2]` (IDs only) or `[{id, title, version}]` (richer objects).
   - Recommendation: Store IDs only for Phase 6. Phase 9 (Audit) adds version attribution — richer objects can be written at that point. Keeping Phase 6 minimal avoids schema interpretation debt.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` (no external test runner) |
| Config file | None — flags passed directly to node |
| Quick run command | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/task-runs.test.ts` |
| Full suite command | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/task-runs.test.ts web/lib/queries/brand.test.ts web/lib/queries/drive.test.ts` |

### Phase Requirements → Test Map

| Req ID | Behaviour | Test Type | Automated Command | File Exists? |
|--------|-----------|-----------|-------------------|-------------|
| TASK-01 | createTaskRun() returns an integer ID and writes status=queued | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/task-runs.test.ts` | Wave 0 |
| TASK-02 | assembleContext() calls searchSkills() and writes sops_used JSON | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/task-runs.test.ts` | Wave 0 |
| TASK-03 | assembleContext() calls getBrandContext(clientSlug) and writes brand_context_id | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/task-runs.test.ts` | Wave 0 |
| TASK-06 | Route responds 202 before context assembly completes | manual-only | Verify via integration test or manual curl — fire-and-forget timing is not unit-testable | N/A |
| TASK-07 | Status transitions: queued → generating → failed (gap case) | unit | `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/task-runs.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/task-runs.test.ts`
- **Per wave merge:** Full suite command above
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `web/lib/queries/task-runs.test.ts` — covers TASK-01, TASK-02, TASK-03, TASK-07
- [ ] `web/lib/task-matcher.ts` — context assembly logic (not a test file, but required before tests pass)

*(Existing test infrastructure: `brand.test.ts`, `drive.test.ts`, `index.test.ts` all use the same pattern — no new framework needed)*

---

## Sources

### Primary (HIGH confidence)

- `web/lib/queries/drive.ts` — searchSkills() signature, FTS5 BM25 ordering, gap detection, SkillSearchResponse interface
- `web/lib/queries/brand.ts` — getBrandContext(), searchBrandContent() client isolation, BrandHubRow interface
- `web/lib/queries/auth.ts` — task_runs schema: columns, indexes, status default value
- `web/lib/queries/base.ts` — rows/scalar/db helpers, libsql client setup
- `web/lib/drive-sync.ts:316` — SKILL_TYPE_MAP exported constants, channel values (paid_social, seo, paid_ads)
- `web/routes/drive-webhook.ts` — fire-and-forget pattern: enqueue then return 200
- `web/lib/queries/brand.test.ts` — canonical test pattern: mock.module + in-memory libsql + node:test
- `vercel.json` — Vercel serverless runtime config, existing cron pattern

### Secondary (MEDIUM confidence)

- `scripts/matching/strategies/ai-classify.ts` — Anthropic SDK initialisation pattern (`new Anthropic({ apiKey })`, `client.messages.create()`, model IDs)
- `api/index.ts` — Vercel serverless function architecture; Fastify app.inject() bridge

### Tertiary (LOW confidence)

- Vercel serverless function background execution behaviour — general knowledge that functions may be killed post-response; verified consistent with project's queue-based patterns

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies already installed; no new packages
- Architecture: HIGH — derived directly from existing Phase 4/5 code and established project patterns
- Pitfalls: HIGH — specific pitfalls derived from STATE.md accumulated decisions and schema inspection
- Test patterns: HIGH — copied exactly from brand.test.ts and drive.test.ts

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable stack; no fast-moving dependencies)
