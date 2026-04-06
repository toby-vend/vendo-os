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

---
---

# PWA + Mobile Responsiveness Pitfalls (Milestone v1.1)

**Domain:** Retrofitting PWA + responsive design onto an existing Fastify + Eta + HTMX server-rendered dashboard
**Researched:** 2026-04-06
**Confidence:** HIGH for service worker + HTMX interaction (verified across multiple official sources and active GitHub issues); HIGH for iOS push limitations (verified against Apple docs and multiple current reports); MEDIUM for Vercel-specific push notification patterns (verified against Vercel docs + community reports)

---

## Critical Pitfalls

### Pitfall 8: Service Worker Caches HTMX Partial Fragments and Serves Them as Full Pages

**What goes wrong:**
The service worker intercepts ALL fetch requests — including HTMX's partial-page XHRs. If you cache responses without distinguishing between full-page requests and fragment requests, users navigating after an offline period get a raw HTML fragment rendered as if it is a full page. The result is a broken layout: no `<html>`, `<head>`, or nav wrapper — just the inner content floating in a blank page.

**Why it happens:**
HTMX sends an `HX-Request: true` header on partial requests, and the server returns a fragment (not a full document). The service worker's cache doesn't distinguish between these two response types by default. When the service worker returns a cached fragment in response to a full navigation request (browser tab open, address bar visit), the browser renders the fragment directly.

**Prevention:**
- The server **must** respond with `Vary: HX-Request` on all routes that return different content based on whether the request is from HTMX. This causes the browser cache and service worker cache to key responses separately for full-page vs. fragment requests.
- In the service worker fetch handler, inspect the `HX-Request` header on incoming requests. Only cache-match fragment responses for fragment requests, and full-page responses for navigation requests.
- For navigation requests (i.e. `event.request.mode === 'navigate'`), always attempt a network fetch first, falling back to a cached full-page shell — never a cached fragment.
- An alternative to `Vary` is setting `htmx.config.getCacheBusterParam = true`, which appends a cache-busting query param to HTMX GET requests, ensuring fragment and full-page responses never share a cache slot. This is simpler but adds noise to URLs.

**Warning signs:**
- Users report a blank page with partial content after going offline and navigating.
- Network tab shows a cached response for a navigation request that has `Content-Length` much smaller than a full page.
- DevTools Application > Cache Storage shows identical URL keys with full-page and fragment variants stored separately (or not stored separately when they should be).

**Phase to address:** Service worker implementation phase (before any offline caching is added).

---

### Pitfall 9: HTMX History Restoration Breaks Under a Service Worker

**What goes wrong:**
HTMX stores a snapshot of the DOM in `sessionStorage` for history back/forward navigation. When a user presses the browser back button and the snapshot is not found (expired session, new tab), HTMX makes a full network request to that URL — but with the header `HX-History-Restore-Request: true`. If the server does not handle this header and always returns a fragment for that route, the back-navigation renders a fragment as a full page. This is an existing HTMX issue compounded by service workers: the service worker may return a cached fragment (the last cached response for that URL) without the server ever being consulted.

**Why it happens:**
Every route that uses `hx-push-url` must be capable of returning a full page when requested directly (address bar, new tab, `HX-History-Restore-Request`). Most HTMX developers only build the fragment path and assume history works from sessionStorage cache — but sessionStorage is cleared on tab close and service worker cache does not restore HTMX's own history state.

**Prevention:**
- Every route that uses `hx-push-url` must return a complete HTML page when called without the `HX-Request` header (or when `HX-History-Restore-Request: true`). In Eta templates, this means wrapping the fragment in the full layout when detecting a restore request.
- In the service worker, do not serve cached fragment responses for navigation-mode requests. Use `event.request.mode === 'navigate'` to detect navigation and bypass fragment cache entries.
- Set `htmx.config.historyRestoreAsHxRequest = false` (the default in htmx v2) so that history restore requests are treated as full-page requests, not HTMX requests.

**Warning signs:**
- Pressing the browser back button on mobile renders a page with no navigation chrome.
- A hard refresh on a deep URL returns a fragment-only response.
- Error: "Cannot read properties of undefined" in JS console after back navigation (HTMX trying to initialise on a partial DOM).

**Phase to address:** Service worker implementation phase AND responsive layout phase (each push-url route needs full-page fallback built at the same time as the route's HTMX fragment is built).

---

### Pitfall 10: Push Notifications Silently Fail on iOS Unless the App Is Installed

**What goes wrong:**
Web Push on iOS Safari only works when the PWA is installed to the home screen and launched in `standalone` mode. If a team member accesses VendoOS via Safari in the browser tab (the most common entry point during transition), push notification subscription will appear to succeed in some cases but deliver nothing. On iOS, `Notification.permission` can be `"granted"` in the browser but push messages are only delivered to the installed standalone app.

**Why it happens:**
The Web Push permission UI on iOS 16.4+ is only surfaced when the app is in standalone mode. But the Push API can be called from the browser tab without error — it just won't deliver. Developers test on Android or desktop Chrome (where push works in-browser) and assume parity.

**Prevention:**
- Gate the push notification subscription flow behind a check: `window.matchMedia('(display-mode: standalone)').matches`. If not standalone on iOS, show a banner explaining that the app must be installed for notifications to work, with instructions for "Add to Home Screen".
- Detect iOS with `navigator.userAgent` and show an installation prompt before the subscription UI.
- Never show push notification UI to iOS users who are in a browser tab — it creates a confusing "granted but silent" state.
- Test push on a real iOS device with the PWA installed to home screen. DevTools device emulation does not simulate standalone mode accurately.

**Warning signs:**
- iOS users say they enabled notifications but receive nothing.
- Push subscription records exist in the database for iOS users but delivery rate is 0%.
- `PushSubscription.endpoint` shows an Apple push endpoint URL but messages are not received.

**Phase to address:** Push notification implementation phase.

---

### Pitfall 11: No Strategy for Push Subscription Expiry — Silent Drop-Off Over Time

**What goes wrong:**
Web Push subscriptions are stored in the database when a user subscribes. Over time, subscriptions become invalid: the user unsubscribed, cleared browser data, reinstalled the browser, or the push service rotated the endpoint. When you attempt to send to a stale subscription, the push service returns HTTP 410 Gone. If this error is not handled, the invalid subscription remains in the database. Eventually the majority of stored subscriptions are dead, and push notifications are silently delivered to nobody.

**Why it happens:**
Developers implement the "subscribe" path completely and test it once. The error handling for failed push delivery is added later (or never). Vercel serverless functions that send pushes are stateless — each invocation sends and exits, so there is no persistent process to track 410s and clean up subscriptions.

**Prevention:**
- The push-sending Vercel function **must** catch HTTP 410 and 404 responses from the push service and immediately delete the corresponding subscription record from the database.
- Add a `last_successful_delivery_at` column to the push subscriptions table. Run a monthly cleanup cron that removes subscriptions with no successful delivery in 90 days.
- Listen for `pushsubscriptionchange` events in the service worker — this fires when the browser rotates the push endpoint. Re-subscribe and update the backend record.
- On app load, re-check the current subscription state: `registration.pushManager.getSubscription()`. If it differs from what the backend has stored (or if it is null), re-subscribe and update.

**Warning signs:**
- Push delivery success rate declining over weeks without a corresponding drop in active users.
- 410 errors appearing in Vercel function logs for the push endpoint.
- `push_subscriptions` table growing indefinitely with no deletions.

**Phase to address:** Push notification implementation phase.

---

### Pitfall 12: Vercel Serverless Cannot Hold Persistent Connections for Real-Time Push Triggers

**What goes wrong:**
VendoOS needs to send push notifications when events happen server-side (draft ready, QA failure, task status change). The natural impulse is to trigger a push from inside the same Vercel serverless function that processes the event. This works, but if the push send takes more than the function's remaining execution time, or if the function returns a response before the push completes, the push is cancelled. More critically, there is no way to trigger a push from a background process on Vercel without an HTTP trigger — you cannot run a persistent listener.

**Why it happens:**
Developers assume serverless functions can "fire and forget" side effects after returning a response. In standard Vercel functions, code after `response.send()` may not execute. Vercel's `waitUntil` (Fluid Compute) is the correct pattern but is not enabled by default and is not available on the Hobby plan.

**Prevention:**
- Send push notifications synchronously before returning the HTTP response from the event-processing function, not after. Keep push payloads small (< 4KB) so the send completes quickly.
- If triggering push from a Vercel Cron job (e.g., polling for new task completions), ensure the cron function sends the push and handles the response within the function execution window (60s on Pro, 10s on Hobby).
- Do not use `res.end()` / `response.send()` and then attempt to send push — the function may be frozen before the push completes. Use `waitUntil` if on Vercel Pro with Fluid Compute enabled.
- For more reliable delivery, consider a dedicated push queue: write a `pending_notifications` row to the database, and a separate cron function drains it every minute. This decouples push delivery from the event function and survives function timeouts.

**Warning signs:**
- Push notifications arrive inconsistently — sometimes immediately, sometimes minutes later, sometimes never.
- Function logs show push sends that complete successfully but users do not receive the notification.
- Vercel function timeout errors on routes that trigger push notifications.

**Phase to address:** Push notification implementation phase.

---

## Moderate Pitfalls

### Pitfall 13: Single CSS File Refactor Breaks Existing Desktop Layout

**What goes wrong:**
The existing `public/assets/style.css` is a flat, desktop-first stylesheet with no media queries or responsive structure. Adding mobile breakpoints by prepending mobile-first rules causes unexpected overrides on elements that were previously styled without specificity conflicts. Fixed-width values (e.g. `width: 240px` on the sidebar) do not override with `max-width: 100%` in a media query if the original rule has higher specificity.

**Why it happens:**
Retrofitting responsive styles into a desktop-first file means adding `@media (max-width: 768px)` blocks that attempt to override rules written without mobile in mind. Specificity of the desktop rule is often higher than the mobile override, so the override silently has no effect.

**Prevention:**
- Audit the CSS file before writing any mobile rules. Identify all fixed-width declarations, `position: fixed` elements, and `overflow: hidden` containers — these are the highest-risk areas.
- Add mobile styles at the **end** of the file, not interspersed, to leverage cascade order as a tiebreaker when specificity is equal.
- Use CSS custom properties (`--sidebar-width: 240px`) for values that need to change at breakpoints. This avoids specificity battles entirely.
- Test on a real device after every batch of mobile CSS changes — DevTools responsive mode hides many real-device layout bugs.
- Do not add `!important` to override specificity conflicts. Find the root rule and make it responsive instead.

**Warning signs:**
- Mobile media query rules have no visual effect despite appearing correct in DevTools.
- Desktop layout shifts unexpectedly after adding a mobile rule.
- DevTools shows mobile rule being overridden by a desktop rule (strikethrough in the Styles panel).

**Phase to address:** Responsive layout phase.

---

### Pitfall 14: Data Tables Are Unreadable on Mobile Without a Strategy Decision Upfront

**What goes wrong:**
Dashboard tables (client lists, task queues, financial data) are multi-column, fixed-layout, or use `display: table` semantics. On a 375px viewport these become illegible or require horizontal scrolling that disrupts the page layout. Developers add `overflow-x: auto` on the table wrapper and call it done — but on iOS Safari, horizontal scroll inside a container and vertical scroll on the page conflict, making the table nearly unusable by touch.

**Why it happens:**
There is no single correct solution for responsive tables — it depends on the data. Attempting to find one CSS trick that works for all tables in the app leads to a compromise that works for none. The decision is deferred until visual review, then rushed.

**Prevention:**
- Make a deliberate decision per table **before** writing any CSS: (a) horizontal scroll wrapper for data-dense tables where all columns are needed, (b) card/stack layout (hide columns, reformat rows as labelled cards) for summary tables, (c) column prioritisation (hide low-priority columns at mobile breakpoint) for medium-density tables.
- For touch-scroll tables, add `-webkit-overflow-scrolling: touch` and a visible scroll indicator so users know the table scrolls.
- Tables that show financial summaries (the kind likely to be accessed on mobile) suit the card layout best — one row becomes one card with label-value pairs.
- Never use `display: block` on `<td>` elements without also setting `data-label` attributes for the CSS-generated column labels — otherwise the table loses all column context.

**Warning signs:**
- Users pinch-zooming to read table content on mobile.
- Horizontal scroll on the table causes the entire page to scroll horizontally on iOS.
- Columns with numeric values (ad spend, impressions) are truncated to ellipsis on mobile.

**Phase to address:** Responsive layout phase — decide the strategy per table before touching CSS.

---

### Pitfall 15: PWA Manifest Scope Misconfiguration Causes Out-of-Scope Navigation to Break

**What goes wrong:**
The `scope` field in `manifest.json` defines the URL boundary of the installed PWA. If `scope` is set too narrowly (e.g., `/dashboard/`), navigating to any route outside that scope (e.g., `/auth/login`, `/api/...`) opens an in-app browser overlay instead of staying within the PWA window. This is particularly disruptive on iOS where the in-app browser overlay has no back button and no way to return to the app without closing it.

**Why it happens:**
Scope is usually set to the most obvious path during initial manifest creation and not revisited. Auth routes and API routes are not considered as part of the "app scope" even though they are reachable from the app.

**Prevention:**
- Set `scope` to `/` (root) unless there is a specific reason to restrict it. For VendoOS, the entire app lives under one origin — there is no reason to narrow the scope.
- Set `start_url` to the first route a user sees after login (e.g., `/dashboard`), not `/`.
- After any routing changes, walk through every internal link in the app while in standalone mode and confirm none trigger the in-app browser.
- On iOS, confirm that the login redirect flow (`/` → `/auth/login` → `/dashboard`) does not exit standalone mode. It should not if scope is `/`.

**Warning signs:**
- A white browser chrome bar appears mid-session on iOS (in-app browser opened).
- Users report being "kicked out" of the app when logging in or out.
- The PWA install prompt appears even after the app is already installed (scope mismatch can cause this).

**Phase to address:** PWA manifest implementation phase.

---

### Pitfall 16: Service Worker Deployment Update Is Invisible to Users for an Indeterminate Period

**What goes wrong:**
After deploying an update to VendoOS, the old service worker continues serving cached assets to users who have the app open. The new service worker installs but waits in the background — it activates only when all tabs with the old version are closed. Users who keep the PWA open in the background (common for an internal tool) may run an outdated version for hours or days. This becomes critical when a bug fix is deployed — the fix is invisible to the users who need it most.

**Why it happens:**
The browser's service worker lifecycle requires the new worker to wait until no client is using the old worker. Developers do not implement a skip-waiting / claim strategy because it is not needed for basic installs.

**Prevention:**
- Call `self.skipWaiting()` inside the service worker's `install` event handler. This causes the new worker to take control immediately on install.
- Call `clients.claim()` inside the `activate` event handler to take control of existing pages without requiring a reload.
- After the service worker activates, broadcast a message to all controlled clients (using `BroadcastChannel` or `clients.matchAll()`) so the page can show a "new version available" toast and optionally prompt a reload.
- On Vercel, static assets use content-hashed filenames automatically — the service worker should cache by hash, not by URL, so stale assets are never served from cache after a deploy.

**Warning signs:**
- Users report seeing old UI after a deployment.
- The service worker version in DevTools > Application > Service Workers does not match the deployed version.
- A/B-style confusion where some users see new features and others do not, without any feature-flag system in place.

**Phase to address:** Service worker implementation phase.

---

### Pitfall 17: Touch Target Sizes Are Below 44px on Retrofitted Sidebar and Navigation

**What goes wrong:**
The existing sidebar navigation links and action buttons were designed for cursor precision on desktop. On mobile, any interactive element below 44x44px causes "rage taps" — users tapping multiple times because the first tap misses. This is most likely on the sidebar toggle, table row actions, inline edit controls, and any icon-only buttons added during the mobile UI work.

**Why it happens:**
Touch target sizes are invisible in desktop design and not enforced by CSS by default. When converting a sidebar to a bottom tab bar or collapsing it, the icon sizes are preserved from the desktop version (typically 16–24px) without adding sufficient padding.

**Prevention:**
- All interactive elements must have a minimum computed tap area of 44x44px. Use padding to achieve this without changing the visual size of the element.
- For icon-only buttons, apply `min-width: 44px; min-height: 44px; display: flex; align-items: center; justify-content: center;`.
- After implementing the bottom tab bar, test each tab on a real device without looking at the screen — tap each tab once and confirm the correct route loads. Missed taps indicate the target is too small.
- Add `user-select: none` to sidebar icons, tab bar items, and non-text navigation elements to prevent accidental text selection on long-press.

**Warning signs:**
- Users need to tap navigation items multiple times.
- Accidental taps on adjacent items when targeting a specific button.
- Text selection popup appearing on tap-hold of navigation elements.

**Phase to address:** Responsive layout phase (address with every interactive element as it is added to the mobile layout).

---

## Minor Pitfalls

### Pitfall 18: `100vh` Breaks on Mobile Safari Due to the Address Bar

**What goes wrong:**
Setting `height: 100vh` on the app shell or sidebar overlay causes the content to be cut off by the iOS Safari address bar. The `vh` unit is calculated from the maximum viewport height (bar hidden), not the actual visible height (bar visible). The result is a few rows of the bottom navigation or content being hidden beneath the browser chrome.

**Prevention:**
- Use `height: 100dvh` (dynamic viewport height) for full-screen containers. `dvh` recalculates as the address bar appears and disappears.
- Where `dvh` is not sufficient (older iOS), use the `-webkit-fill-available` hack: `height: -webkit-fill-available; height: 100dvh;`.
- The bottom tab bar specifically must use `padding-bottom: env(safe-area-inset-bottom)` to account for the iPhone home indicator notch.

**Phase to address:** Responsive layout phase.

---

### Pitfall 19: The `display: standalone` Manifest Requirement for iOS Push Is Easy to Miss

**What goes wrong:**
iOS Web Push requires the manifest to include `"display": "standalone"`. If the manifest omits this or uses `"display": "browser"`, the PWA installs but push notifications are silently disabled — no error, no warning in the console. This was a common oversight when `standalone` was first made a requirement in iOS 16.4.

**Prevention:**
- Always set `"display": "standalone"` in `manifest.json` for any PWA that will use push notifications.
- After installing the PWA on iOS, open Safari Web Inspector remote debugging and verify `Notification.permission` can be requested (it should be `"default"` before the prompt, not `"denied"` or silently unavailable).

**Phase to address:** PWA manifest phase.

---

### Pitfall 20: Offline Fallback Page Is Not Cached Before It Is Needed

**What goes wrong:**
The service worker is configured to show `/offline.html` when a navigation request fails. But `/offline.html` is only pre-cached during the service worker's `install` event. If the install fails (the offline page is not reachable at install time, or the cache name was changed in a broken deploy), the offline fallback itself returns a network error — the user sees the browser's default network error page instead of the custom offline page.

**Prevention:**
- Pre-cache `/offline.html` in the `install` event using `event.waitUntil(cache.addAll(['/offline.html']))`. The `waitUntil` causes install to fail if caching fails — which surfaces the problem immediately rather than silently.
- Keep the offline page completely self-contained: inline all CSS and do not reference any external assets that could themselves be uncached.
- Test by: installing the service worker, going offline in DevTools, and navigating to a route that is not cached. Confirm the offline page renders.

**Phase to address:** Service worker implementation phase.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Service worker implementation | Caching HTMX fragments as full pages (Pitfall 8) | Add `Vary: HX-Request` to all HTMX routes before writing any cache logic |
| Service worker implementation | History restore serving cached fragment (Pitfall 9) | Ensure all `hx-push-url` routes have full-page fallback before the SW is deployed |
| Service worker implementation | Update invisible to users (Pitfall 16) | Include `skipWaiting` + `clients.claim` from the first version |
| Service worker implementation | Offline page not cached (Pitfall 20) | Pre-cache `/offline.html` in `install` event; verify offline test before shipping |
| PWA manifest | Scope too narrow (Pitfall 15) | Set `scope: "/"` by default; test all internal navigation in standalone mode |
| PWA manifest | `standalone` missing for iOS push (Pitfall 19) | Include in manifest review checklist |
| Responsive CSS layout | CSS specificity overrides silently fail (Pitfall 13) | Audit existing CSS before adding mobile rules; use CSS custom properties for values that change |
| Responsive CSS layout | Table layout unusable on mobile (Pitfall 14) | Decide strategy per table before writing CSS |
| Responsive CSS layout | Touch targets too small (Pitfall 17) | 44px minimum rule enforced in code review |
| Responsive CSS layout | `100vh` cut off by Safari address bar (Pitfall 18) | Use `100dvh` with `env(safe-area-inset-bottom)` padding |
| Push notifications | iOS silent failure unless installed (Pitfall 10) | Gate subscription flow behind standalone mode check |
| Push notifications | Stale subscriptions accumulate (Pitfall 11) | Handle 410 errors and delete dead subscriptions on send; add `pushsubscriptionchange` handler |
| Push notifications | Vercel function timeout cuts off push send (Pitfall 12) | Use `pending_notifications` queue pattern; decouple push send from event handler |

---

## Sources

- [HTMX GitHub Issue #1445 — Service Workers](https://github.com/bigskysoftware/htmx/issues/1445) — maintainer confirms SW integration is out of scope; community cache strategies
- [HTMX Caching Documentation — Vary header requirement](https://www.tutorialspoint.com/htmx/htmx_caching.htm) — `Vary: HX-Request` requirement for correct cache keying
- [HTMX GitHub Issue #854 — Back button device navigation](https://github.com/bigskysoftware/htmx/issues/854) — `hx-push-url` + device back button broken
- [HTMX Discussion #1700 — hx-push-url back/forward handling](https://github.com/bigskysoftware/htmx/discussions/1700) — full-page fallback requirement for every pushed URL
- [HTMX GitHub Issue #497 — Fragment returned on full page reload](https://github.com/bigskysoftware/htmx/issues/497) — fragment vs full page response bug
- [PWA on iOS — Current Status 2025 (Brainhub)](https://brainhub.eu/library/pwa-on-ios) — iOS limitations, standalone requirement, EU DMA restriction
- [Reliable Push Notifications on PWAs for iOS and Android (Edana)](https://edana.ch/en/2026/03/19/push-notifications-on-web-applications-pwa-is-it-really-reliable-on-ios-and-android/) — iOS reliability issues, delivery failure patterns
- [Web Push Error 410 — Pushpad](https://pushpad.xyz/blog/web-push-error-410-the-push-subscription-has-expired-or-the-user-has-unsubscribed) — subscription expiry handling
- [Demystifying Web Push Notifications — PQVST](https://pqvst.com/2023/11/21/web-push-notifications/) — subscription lifecycle, re-subscribe on change
- [Vercel Functions Limitations](https://vercel.com/docs/functions/limitations) — timeout limits, Fluid Compute `waitUntil`
- [Vercel CDN Cache — Cache-Control Headers](https://vercel.com/docs/caching/cache-control-headers) — service worker + CDN cache interaction
- [Service Worker Caching Strategies — Workbox / Chrome Developers](https://developer.chrome.com/docs/workbox/caching-strategies-overview) — cache strategy taxonomy
- [Challenges with Retrofitting Responsive Design — Telerik Blogs](https://www.telerik.com/blogs/challenges-with-retrofitting-responsive-design) — fixed-width, inline style, and specificity pitfalls
- [Responsive Tables Guide 2025 — 618 Media](https://618media.com/en/blog/html-tables-in-responsive-design/) — table strategy options for mobile
- [Accessible Touch Target Sizes — Smashing Magazine](https://www.smashingmagazine.com/2023/04/accessible-tap-target-sizes-rage-taps-clicks/) — 44px standard, rage tap analysis
- [PWA Design Tips — firt.dev](https://firt.dev/pwa-design-tips/) — user-select, bottom nav bar, standalone considerations
- [Understanding Mobile Viewport Units (dvh, svh, lvh) — Medium](https://medium.com/@tharunbalaji110/understanding-mobile-viewport-units-a-complete-guide-to-svh-lvh-and-dvh-0c905d96e21a) — `100vh` breakage on iOS Safari

---
*PWA + mobile pitfalls research for: VendoOS — v1.1 Mobile & PWA milestone*
*Researched: 2026-04-06*
