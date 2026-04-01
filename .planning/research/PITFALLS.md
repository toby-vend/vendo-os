# Pitfalls Research

**Domain:** Google Drive webhook sync + AI skills/SOP execution + multi-client brand management
**Researched:** 2026-04-01
**Confidence:** HIGH (webhook/API pitfalls verified against official docs and community reports; AI agent pitfalls verified across multiple production post-mortems)

---

## Critical Pitfalls

### Pitfall 1: Webhook Channels Expire Silently and Sync Stops

**What goes wrong:**
Google Drive webhook channels expire — after a maximum of 7 days for file changes, 1 day for folder/drive changes, 1 hour if no expiry is set in the watch request. When a channel expires, Google sends no notification. Drive just stops delivering push events. The sync appears healthy but is silently stale.

**Why it happens:**
Developers register a channel, confirm it works, and ship without implementing renewal. The system appears to function during testing (which is short), then silently degrades in production after a few days. There is no built-in alert.

**How to avoid:**
- Store channel expiry timestamps in the database at registration time.
- Run a cron job (Vercel Cron or Cloud Scheduled Task) that checks for channels expiring within 24 hours and renews them proactively.
- On renewal, overlap old and new channels by ~1 hour to avoid a notification gap; design the handler to be idempotent so duplicate events from the overlap period are harmless.
- Log channel status and last-received event timestamp; alert if no event has been received in 24 hours for an active folder.

**Warning signs:**
- Drive documents were updated but the skills index was not refreshed.
- `last_event_at` column in the webhook_channels table is more than 24 hours ago for an active channel.
- No errors in logs, but document content is stale.

**Phase to address:** Drive webhook sync phase (first milestone phase).

---

### Pitfall 2: Missing the pageToken — Sync Gaps After Restart or Cold Start

**What goes wrong:**
The Google Drive Changes API uses a `pageToken` (start token) to mark where change polling last left off. If this token is not persisted to the database before the Vercel function returns, any changes that occurred between the last stored token and the new token are permanently lost. On cold start or redeploy, polling restarts from a stale or missing token, causing either a gap (missed changes) or a full re-scan.

**Why it happens:**
Developers store the token in memory or a module-level variable, which is destroyed between Vercel serverless invocations. The distinction between `nextPageToken` (more pages) and `newStartPageToken` (end of list, save this for next poll) is easy to misread in the API docs.

**How to avoid:**
- Persist `newStartPageToken` to the database (a `webhook_state` table) immediately after each successful poll, before processing the changes.
- On webhook handler startup, always load the token from the database — never assume in-memory state survives.
- Handle the two-token types explicitly: loop on `nextPageToken` to drain all pages; only save `newStartPageToken` when pagination is complete.
- Include a fallback: if no stored token exists, call `changes.getStartPageToken` and do a full re-index rather than silently skipping.

**Warning signs:**
- After a Vercel redeploy, some recently changed documents are missing from the skills index.
- Webhook handler logs show "no token found, using fresh start token" repeatedly.
- Skills index shows an older version of an SOP that has since been updated.

**Phase to address:** Drive webhook sync phase (first milestone phase).

---

### Pitfall 3: Vercel Serverless Webhook Handler Is Not Idempotent

**What goes wrong:**
Google Drive can deliver the same notification more than once (guaranteed-at-least-once delivery). If the webhook handler is not idempotent, a document gets re-indexed multiple times simultaneously. On Vercel, concurrent invocations of the same serverless function can process the same event at the same time, causing duplicate database rows, duplicate embeddings, or double-processing costs.

**Why it happens:**
The handler processes the event, then checks deduplication — but two parallel invocations both pass the check before either writes. This is a classic TOCTOU (time-of-check-time-of-use) race condition, exacerbated by Drive's tendency to send bursts of events for a single file save.

**How to avoid:**
- Use an event deduplication table keyed on Drive's `X-Goog-Resource-Id` + `X-Goog-Changed` header values.
- Insert the event ID with a UNIQUE constraint before processing; catch the constraint violation as a signal to skip.
- Alternatively, enqueue webhook events to a queue (e.g., a `drive_events` table with status `pending/processing/done`) and use a separate worker to drain it serially.
- Respond 200 to Google immediately upon receipt; process asynchronously.

**Warning signs:**
- Duplicate rows in the `skills` or `documents` table for the same Drive file ID.
- Processing logs showing the same `fileId` handled twice within seconds.
- Embedding API costs higher than expected relative to the number of unique documents.

**Phase to address:** Drive webhook sync phase (first milestone phase).

---

### Pitfall 4: Wrong SOP Injected Into Agent Context (Client Bleed)

**What goes wrong:**
When the task matching engine retrieves SOPs and brand context, a filter bug or missing `client_id` constraint causes an agent to receive the brand guidelines for the wrong dental client. The agent produces content with the wrong practice name, wrong tone, wrong compliance requirements — or worse, mixes compliance requirements from two different clients. This is undetectable without manual review and could cause a real-world compliance issue for dental advertising.

**Why it happens:**
Retrieval queries are written once for the happy path and the `client_id` WHERE clause is either forgotten, placed incorrectly, or bypassed when building dynamic SQL. In RAG pipelines, namespace/tenant filtering is commonly applied after retrieval rather than as a retrieval constraint, which means the wrong documents are fetched and then silently dropped — or not dropped at all.

**How to avoid:**
- Enforce `client_id` filtering at the database/retrieval layer, not in application logic after the fact.
- In every query that returns brand context, skills, or SOP content, `client_id` must be a required parameter — never optional.
- Add a unit test that proves: given client A's task, client B's brand content is never returned.
- When assembling agent context, log which documents were included and which client they belong to — make this auditable.
- If using vector search in the future, use namespace isolation per client, not shared embedding space with post-filter.

**Warning signs:**
- Agent output references a different practice name than the task.
- QA validator passes content that contains the wrong brand voice or wrong offer.
- Logs show documents from multiple `client_id` values in a single task execution.

**Phase to address:** Task matching and agent execution phase.

---

### Pitfall 5: QA Retry Loop Has No Exit Condition — Unbounded Cost and Time

**What goes wrong:**
The QA check validates agent output against SOP standards and retries if below standard. Without a hard retry cap and a fallback behaviour, the agent enters an infinite loop: generate → fail QA → regenerate → fail QA → repeat. In production, this has caused multi-thousand-dollar cost spikes. Even with a retry cap, if the QA judge prompt is too strict or miscalibrated, everything fails and every task costs 3x the expected tokens.

**Why it happens:**
QA thresholds are set during testing on easy examples, then applied uniformly in production to edge cases the threshold wasn't calibrated for. Developers assume "retry until pass" is safe without measuring the failure rate distribution.

**How to avoid:**
- Hard cap: maximum 2 retries (3 total attempts). On third failure, save the best attempt as a `draft_review_required` rather than silently failing or looping.
- Track per-task retry counts and QA scores in the database — this surfaces systemic QA calibration problems.
- Seed the QA judge with concrete, enumerated pass/fail criteria from the SOP (not vague instructions) to reduce false negatives.
- Set per-task token budgets and cost limits; log actual cost per task execution.
- Never make the retry synchronous in the HTTP request cycle — always process asynchronously.

**Warning signs:**
- A single task execution consuming 10x expected tokens.
- Tasks stuck in `processing` status indefinitely.
- Anthropic API cost spikes that correlate with task volume but at a disproportionate ratio.
- QA failure rate above 30% — indicates a calibration problem, not a content quality problem.

**Phase to address:** Agent execution and QA phase.

---

### Pitfall 6: Stale Embeddings After Document Update

**What goes wrong:**
A Drive webhook fires when an SOP is updated. The sync layer updates the document record. But the embedding (used for semantic retrieval in the skills index) is not regenerated. The old embedding still points to the old chunk boundaries and old text. The agent retrieves semantically similar but outdated SOP content, producing work that violates the updated standard — with no error surfaced.

**Why it happens:**
Developers handle "file updated" events by updating the metadata or raw text in the database, but forget that the embedding is a derived artefact that must be invalidated and regenerated. Embeddings are treated as permanent rather than as a cache.

**How to avoid:**
- Treat embeddings as a cache keyed on a content hash of the document text.
- On document update, compare the new content hash against the stored hash; if different, mark embeddings as `stale` and enqueue a re-embedding job.
- Do not serve stale-marked documents for retrieval until re-embedding completes; fall back to keyword search on the raw text instead.
- Include `embedded_at` and `content_hash` columns in the skills table from day one.

**Warning signs:**
- An SOP was updated in Drive 3 days ago but the agent is still generating content based on the old version.
- `embedded_at` timestamp predates the document's `updated_at` timestamp by more than a few minutes.
- Agent output contradicts a known SOP change that was made recently.

**Phase to address:** Skills library indexing phase.

---

### Pitfall 7: OAuth Token Refresh Fails Silently, Breaking the Entire Sync

**What goes wrong:**
The Google OAuth access token used for Drive API calls expires every hour. The token refresh logic uses an encrypted refresh token. If the refresh token is revoked (user re-authorises, password change, token rotation), the token refresh fails. The existing code (`web/lib/google-tokens.ts`) logs the error but does not surface it to operators. All Drive sync stops silently. This is already flagged in CONCERNS.md.

**Why it happens:**
The happy path (token is valid or refreshes successfully) is the only path tested. The revocation/expiry path surfaces only in production, often days later when someone notices stale data.

**How to avoid:**
- Implement a token health check that runs daily and writes a status record to the database.
- If a refresh fails, set a `google_oauth_status` flag to `error` with the failure reason and timestamp.
- Surface this status on the admin dashboard — do not bury it in logs.
- Alert (Slack notification) when Drive sync has been inactive for more than 2 hours during business hours.
- The encryption key rotation problem (CONCERNS.md: `web/lib/crypto.ts`) must be addressed before this milestone to prevent tokens becoming unrecoverable during any future key change.

**Warning signs:**
- `last_synced_at` on Drive channels is not advancing despite AMs making changes.
- `web/lib/google-tokens.ts` error logs appearing in Vercel function logs.
- No webhook events received for > 2 hours during a business day.

**Phase to address:** Drive webhook sync phase — the token infrastructure must be hardened before building on top of it.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Single `queries.ts` file extended with skills queries | Faster to ship | Already at 732 lines; adding skills/brand/agent queries makes it unmaintainable — changes break unrelated queries | Never: split the module before adding new domains |
| Hardcoding `client_id` lists or brand properties | Faster initial setup | Breaks at client 26; requires code change to add/remove clients | Never: use the database as the source of truth |
| Processing webhooks synchronously in the HTTP handler | Simpler initial code | Vercel function timeouts kill long-running indexing jobs; Google retries the webhook, creating duplicate processing | Never for indexing work: enqueue and process async |
| Using the same Google OAuth token for all Drive operations | One token to manage | If that user's permissions change or token is revoked, everything breaks | Never: consider a service account for Drive reads |
| Storing raw SOP text without content hash | Saves one column | No way to detect stale embeddings; forced to re-embed everything on every change | Never: add `content_hash` from day one |
| Skipping per-task cost tracking | Faster to implement | Cost spikes are invisible until the Anthropic bill arrives | Never for agent tasks: log token usage on every execution |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Google Drive watch | Registering a watch on the root folder and expecting recursive change events | Watch individual folders or use `changes.list` on the entire drive with a start token; root folder watch does not propagate to children reliably |
| Google Drive watch | Not sending a `200 OK` within a few seconds | Google marks the channel as failed and stops sending. Acknowledge immediately, process asynchronously |
| Google Drive watch | Using the same `channelId` when renewing | Channel IDs must be unique per registration; reusing an ID will be rejected |
| Google Docs API | Calling `files.export` for every webhook event | Export is rate-limited and expensive; cache the exported content using the `md5Checksum` field from the file metadata to skip unchanged files |
| Google Drive API | Ignoring the `kind: "api#channel"` sync notification sent on channel creation | This initial notification is not a real change event; handle it as a no-op or the handler will attempt to index a document that does not exist |
| Anthropic API | Making Claude API calls synchronously during webhook processing | Webhook handler times out (Vercel max 10-60s); processing must be queued |
| Turso/libsql | Using `sql.js` in sync scripts while the web app uses `@libsql/client` | Schema drift between the two implementations; migrations must be run against both — unify on `@libsql/client` |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full Drive re-scan on every webhook event | Slow indexing, high API quota usage, rate limit errors | Use the Changes API with a persisted `pageToken` to get only changed files | Immediately with > ~50 documents |
| Re-embedding all documents when one changes | Embedding API costs 10x expected, long re-index times | Use content hashing to only re-embed documents whose text has changed | At ~200 documents |
| Loading all brand context for all 25+ clients into each agent context | Context window bloat, slower responses, higher cost | Load only the specific client's brand context using `client_id` filter | At 10+ clients with verbose brand files |
| Running QA validation as a blocking step in the task execution request cycle | Request timeouts, poor UX for AMs waiting for task results | Queue agent execution + QA as background jobs; show status in the UI via polling or HTMX swap | Immediately for tasks > 5 seconds |
| Re-indexing on every API call to the skills library | Database hammered on every agent task | Cache the skills index in memory with a TTL; invalidate on webhook-triggered update events | At > 10 concurrent users |
| Synchronous `crypto.scryptSync()` on every Google token refresh | CPU blocks the Vercel function event loop | Already flagged in CONCERNS.md; add short-TTL in-memory token cache | At > 5 concurrent Drive operations |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Not validating `X-Goog-Channel-Token` on incoming webhooks | Forged webhook requests can trigger false re-indexing or exhaust API quota | Generate a secret token per channel at registration time; store it; validate it on every incoming webhook before processing |
| Returning SOP/skill content in API responses without checking the requesting user's access tier | Staff users see admin-only SOPs; client portal (future) sees internal agency content | Apply access tier filter at the query level — not in the route handler after fetching |
| Logging full SOP text or brand context in application logs | Sensitive client strategy/brand data ends up in Vercel log output, visible to anyone with Vercel dashboard access | Log document IDs and content hashes only; never log raw document content |
| Storing the Google service/user credentials without encryption key versioning | If `TOKEN_ENCRYPTION_KEY` is rotated, all OAuth tokens become unrecoverable | Already flagged in CONCERNS.md; implement key versioning before building Drive sync on top of this |
| Agent prompt includes raw user-supplied task description without sanitisation | A malicious task description could inject instructions that override SOP constraints (prompt injection via stored content in Drive) | Wrap user input in explicit delimiters; instruct the model that content between delimiters is data, not instructions; validate that SOP source documents match expected Drive file IDs |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| AM submits a task and sees no feedback while agent processes | AM submits multiple times, creating duplicate tasks; no confidence the system is working | Show a `queued → processing → complete` status indicator via HTMX polling; disable the submit button after first submission |
| QA failure shows raw LLM output with no context | AM doesn't know what standard was violated or what to fix | QA result should include: which SOP rule failed, the relevant rule text, and a suggested correction action |
| Skills index shows document titles with no indication of last-indexed date | AM cannot tell if the index reflects their latest Drive changes | Show `last indexed` timestamp next to each document in the skills library UI |
| Brand hub shows 25+ clients in a flat list | Hard to find a client quickly; easy to select the wrong one | Group by active/inactive; add search/filter; show client identifier prominently |
| Task output appears as a wall of text | AMs must manually parse and format before sending to client | Structure output with clear sections (headline, body, CTA) matching the channel template format |

---

## "Looks Done But Isn't" Checklist

- [ ] **Drive webhook registration:** Confirm you are receiving the initial `sync` notification AND subsequent change notifications — many setups get the sync but miss updates due to folder-level vs. file-level watch scope
- [ ] **Channel renewal:** Verify a cron job exists that renews channels before expiry; confirm it has fired at least once in production
- [ ] **Idempotency:** Send the same webhook payload twice to your handler in staging; confirm no duplicate database rows result
- [ ] **Client isolation:** Run a query for a task from client A's context; confirm no rows from client B appear in the assembled context
- [ ] **QA retry cap:** Manually cause 3 consecutive QA failures; confirm the task moves to `draft_review_required` status rather than looping
- [ ] **Stale embedding detection:** Update a document in Drive; confirm the `content_hash` changes and re-embedding is triggered
- [ ] **Token revocation handling:** Revoke the Google OAuth token from the Google account settings; confirm the system surfaces an error status rather than silently failing
- [ ] **Access tier enforcement:** Log in as a staff user; confirm they cannot access admin-tier SOP documents or brand financials

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Webhook channel expired, sync gap of N days | MEDIUM | Call `changes.getStartPageToken` to get current state; do a full re-scan of all watched folders; re-index all documents; resume webhook from new token |
| pageToken lost, sync gap unknown | MEDIUM | Full re-scan as above; compare file `modifiedTime` against `last_indexed_at` to prioritise recently changed documents |
| Client brand data bleed in agent output | HIGH | Audit all tasks executed in the affected time window; identify affected deliverables; manually review and correct; patch the retrieval query and add the isolation test |
| Infinite QA retry loop caused cost spike | MEDIUM | Kill in-flight tasks; audit `task_executions` table for stuck jobs; add the retry cap; re-process affected tasks with cap in place |
| Stale embeddings across the corpus | LOW | Run a batch re-embedding job comparing `content_hash` against stored hashes; queue re-embed for all mismatched documents |
| Google OAuth token unrecoverable after key rotation | HIGH | User must re-authorise via the OAuth flow; all Drive sync stops until re-authorisation; prevent by implementing key versioning before this milestone |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Webhook channel silent expiry | Drive sync phase | Cron renewal job deployed; channel expiry timestamps stored; alert fires in staging when channel expires |
| pageToken loss on cold start | Drive sync phase | State stored in DB; redeploy in staging; confirm no sync gap |
| Non-idempotent webhook handler | Drive sync phase | Duplicate event test passes without duplicate DB rows |
| Wrong client's SOP/brand injected | Task matching + agent execution phase | Client isolation unit test present and passing |
| Unbounded QA retry loop | Agent execution + QA phase | 3-failure scenario tested; task lands in `draft_review_required` |
| Stale embeddings after document update | Skills indexing phase | `content_hash` column present; re-embed triggered on change confirmed in staging |
| OAuth token refresh silent failure | Drive sync phase (prerequisite: crypto key versioning) | Token revocation test; status surfaced on admin dashboard |
| Queries.ts monolith extended with skills | Skills indexing phase | `queries.ts` split into domain modules before any skills queries are added |

---

## Sources

- [Google Drive Push Notifications — Official Docs](https://developers.google.com/workspace/drive/api/guides/push) — channel expiry, renewal, domain requirements
- [Google Drive Retrieve Changes — Official Docs](https://developers.google.com/workspace/drive/api/guides/manage-changes) — pageToken management, newStartPageToken vs nextPageToken
- [Google Drive API Usage Limits](https://developers.google.com/workspace/drive/api/guides/limits) — quota limits for read/write and rate limiting
- [Integrating with Google APIs: Tips and Tricks Part 2 — Prismatic](https://prismatic.io/blog/integrating-with-google-apis-tips-and-tricks-part-2/) — production webhook gotchas including gap/overlap on renewal
- [Google Drive Folder Sync Webhooks — Kiprosh](https://blog.kiprosh.com/google-drive-folder-sync-webhooks/) — renewal strategy in production
- [Building Production RAG — Premai](https://blog.premai.io/building-production-rag-architecture-chunking-evaluation-monitoring-2026-guide/) — chunking and retrieval failure modes
- [Why Most RAG Systems Fail in Production — DEV Community](https://dev.to/theprodsde/why-most-rag-systems-fail-in-production-and-how-to-design-one-that-actually-works-j55) — 70% of failures before LLM is called
- [Agentic RAG Failure Modes — Towards Data Science](https://towardsdatascience.com/agentic-rag-failure-modes-retrieval-thrash-tool-storms-and-context-bloat-and-how-to-spot-them-early/) — retrieval thrash, context bloat
- [LLM Tool-Calling Infinite Loop Failure Mode — Medium](https://medium.com/@komalbaparmar007/llm-tool-calling-in-production-rate-limits-retries-and-the-infinite-loop-failure-mode-you-must-2a1e2a1e84c8) — $47k cost spike case study
- [Infinite Agent Loop — Agent Patterns](https://www.agentpatterns.tech/en/failures/infinite-loop) — production controls for agent loops
- [Multi-Tenant Data Isolation Patterns — Propelius](https://propelius.tech/blogs/tenant-data-isolation-patterns-and-anti-patterns/) — client data bleed anti-patterns
- [Tenant Isolation — WorkOS](https://workos.com/blog/tenant-isolation-in-multi-tenant-systems) — silent isolation failures
- [OWASP LLM01:2025 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) — indirect prompt injection via document content
- [Syncing Data Sources to Vector Stores — LangChain](https://blog.langchain.com/syncing-data-sources-to-vector-stores/) — stale embedding management
- Project `CONCERNS.md` — existing crypto, OAuth token, and queries.ts debt that directly affects this milestone

---
*Pitfalls research for: VendoOS — Google Drive sync + skills library + agent task execution*
*Researched: 2026-04-01*
