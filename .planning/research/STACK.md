# Stack Research

**Domain:** Agency operating system — Google Drive-synced skills library with AI agent task execution
**Researched:** 2026-04-01
**Confidence:** HIGH (all critical choices verified against official docs or npm registry)

---

## Context: What We Are Adding

The existing app is Fastify 5 + Eta + HTMX on Vercel with @libsql/client (Turso in prod). This research covers the net-new libraries and patterns needed for:

1. Google Drive real-time webhooks (watch channels)
2. Document extraction and text chunking from Drive files
3. Skills library: indexed, searchable, classified store of SOPs
4. AI agent task execution with tool use
5. QA loop: validate output against SOP standards

Nothing below changes the existing stack. Everything extends it.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| googleapis | 171.x | Google Drive API v3 — files.list, files.export, changes.watch | Google's official Node.js client; includes Drive v3, typed, handles OAuth2 refresh automatically |
| google-auth-library | 10.x | OAuth2 token management for Drive access | Already implied by existing Google OAuth flow; googleapis depends on it; handles token refresh |
| @anthropic-ai/sdk | 0.81.x | Claude API — messages, tool use, streaming | Official Anthropic SDK; supports streaming tool use out of the box; works in Node.js serverless |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @libsql/client | 0.17.x (existing) | Vector storage via Turso's native F32_BLOB vector type | Extend existing skills tables with embedding columns; no new DB client needed |
| openai | 4.x | text-embedding-3-small embeddings only | Cheapest high-quality embedding model at $0.02/1M tokens; Anthropic has no embedding model |
| tiktoken | 1.x | Token counting for chunking decisions | Count tokens before splitting so chunks stay under the 8191 token limit for embeddings |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| tsx (existing) | Run sync/index scripts without compile step | Already in project; use for Drive sync and indexing scripts |
| vercel.json functions config | Set maxDuration per route | Set `maxDuration: 800` on the agent execution endpoint (Pro plan supports up to 800s with Fluid Compute) |

---

## Installation

```bash
# New dependencies
npm install googleapis google-auth-library openai tiktoken

# No additional dev dependencies needed — tsx already present
```

---

## Architecture Decisions

### Google Drive Webhooks: `changes.watch`, not `files.watch`

Use the `changes` resource watch (not per-file watch) because:
- A single channel covers an entire shared drive or user's My Drive
- Webhook delivers a delta token; you call `changes.list` with that token to get the diff
- Maximum channel lifetime: 604,800 seconds (7 days) for changes resource
- **Renewal is manual** — store channel expiry in the DB, run a daily cron that renews channels expiring within 24 hours

The POST Google sends to your webhook contains no file details — only `X-Goog-Resource-State` (e.g. `change`) and channel ID. Your handler must call `changes.list` to fetch what changed. Respond 200 immediately; do the Drive fetch asynchronously (or queue it).

### Embeddings: OpenAI text-embedding-3-small via @libsql/client F32_BLOB

Turso has native vector search via `F32_BLOB(N)` column type and `vector_top_k()`. It runs on the same `@libsql/client` already in the project — no new DB dependency, no separate vector DB.

Embedding cost: ~$0.02/1M tokens. A 500-token SOP chunk costs $0.00001. Even 10,000 SOP chunks at 500 tokens each = $0.10 total. Re-index on document change is negligible cost.

Use `text-embedding-3-small` at 1536 dimensions. Define the column as `F32_BLOB(1536)`.

**Status caveat:** Turso vector search is in beta. The SQL syntax works today over HTTP (which is how `@libsql/client` connects to Turso cloud). Verify it works end-to-end in your dev environment before building the full indexing pipeline. Fallback: store embeddings as JSON text and do cosine similarity in JS — ugly but functional if Turso beta has issues.

### AI Agent Execution: @anthropic-ai/sdk with manual tool loop

Do NOT use `@anthropic-ai/claude-agent-sdk` for this. That SDK is designed for general-purpose autonomous agents (file system, bash, etc.) and brings in its own tool execution model and 48 MB of overhead.

Instead, use `@anthropic-ai/sdk` (the base SDK) with a manual tool-use loop:
1. Send a message with tools defined (tool definitions are plain JSON schema)
2. If the response contains `tool_use` blocks, execute them (e.g. `lookupSOP(channel, query)`, `getClientBrandContext(clientId)`)
3. Feed tool results back as a new message
4. Loop until the model returns a plain text response
5. Run a QA pass: send the draft + SOP excerpt to a second Claude call asking it to validate compliance

This pattern is 30 lines of TypeScript and fully under your control. No framework dependency.

### Vercel Function Timeout

Agent task execution will take 10–60 seconds (2–4 Claude round trips + DB queries). The existing `api/index.ts` function is the Fastify handler for all routes. Set `maxDuration` in `vercel.json`:

```json
{
  "functions": {
    "api/index.ts": {
      "maxDuration": 300
    }
  }
}
```

300 seconds is the default with Fluid Compute (enabled by default since April 2025 for new projects on Pro). This is plenty for agent tasks. Do not set to 800 unless you have evidence you need it — it affects billing (provisioned memory time, not just CPU time).

Stream the response using SSE (Server-Sent Events) or chunked transfer so the browser shows progress rather than waiting for a 504.

### Document Text Extraction

Google Docs → `drive.files.export({ fileId, mimeType: 'text/plain' })` — returns clean plaintext, strips formatting. This is the correct approach for indexing SOPs.

Non-Google files (PDFs, DOCX) — use `drive.files.get({ fileId, alt: 'media' })` to download the binary. Extracting text from arbitrary PDFs and DOCX files requires additional libraries. Recommendation: treat only Google Docs as indexable for MVP; log non-Google-Doc files as `unindexable` in the skills table. Revisit if AMs report they have SOPs in PDF.

### Chunking Strategy

Chunk each document into 400–500 token segments with 50-token overlap. Use `tiktoken` to count tokens precisely before splitting. Store each chunk as a separate row in `skills_chunks` with a FK to `skills_documents`. Similarity search returns chunks, not full documents — the agent receives the 3–5 most relevant chunks as context.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| @anthropic-ai/sdk (manual loop) | @anthropic-ai/claude-agent-sdk | Only if you want Claude to autonomously run bash/read files — irrelevant here |
| @anthropic-ai/sdk (manual loop) | Vercel AI SDK | If you were building a streaming chat UI in a React/Next.js app; overkill for a server-side task pipeline |
| @anthropic-ai/sdk (manual loop) | LangChain/LangGraph | If you need complex multi-agent orchestration with dozens of tools; LangChain adds large bundle size and abstraction cost for a simple 3-step loop |
| text-embedding-3-small (OpenAI) | Voyage AI embeddings | voyage-3-lite has better retrieval benchmarks but costs more and adds another vendor dependency; not worth it at this scale |
| Turso native vector (F32_BLOB) | Dedicated vector DB (Pinecone, Weaviate) | Only justified at millions of documents — overkill for a skills library with ~500–2000 SOP chunks |
| googleapis (official) | Custom fetch wrapper | Absolutely do not — Drive API auth and retry logic is complex; use the official client |
| changes.watch (drive-level) | files.watch (per-file) | Per-file watch requires a separate channel per file; changes.watch is one channel for the whole drive |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| LangChain / LangGraph | 100+ MB bundle weight, heavy abstraction over a simple loop, adds compatibility risk with Vercel's 250 MB bundle limit | @anthropic-ai/sdk manual tool loop |
| @anthropic-ai/claude-agent-sdk | Designed for autonomous coding agents, not structured task pipelines; brings file system/bash tools you don't want; 48 MB | @anthropic-ai/sdk 0.81.x |
| Pinecone / Weaviate / Qdrant | External vector DB adds latency, cost, and ops burden for a library of <2000 chunks | Turso native F32_BLOB vector search |
| Polling Drive for changes | Misses rapid updates, burns API quota, AMs edit SOPs frequently | changes.watch webhooks |
| Edge Runtime for agent routes | Edge has 25s response initiation limit — too tight for multi-step agent loops | Node.js runtime (already in use) with maxDuration |
| text-embedding-ada-002 | Deprecated by OpenAI; replaced by text-embedding-3-small which is cheaper and better | text-embedding-3-small |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|----------------|-------|
| googleapis@171.x | google-auth-library@10.x | googleapis has a peer dep on google-auth-library; install both explicitly |
| @anthropic-ai/sdk@0.81.x | Node.js 18+ (ESM or CJS) | Project already uses ESNext modules; compatible |
| openai@4.x | Node.js 18+ | Used only for embeddings endpoint; no conflict with Anthropic SDK |
| tiktoken@1.x | Node.js 18+; WASM-based | Ships with WASM; no native compilation needed; works on Vercel |
| @libsql/client@0.17.x (existing) | Turso vector beta | F32_BLOB works over HTTP (Turso cloud); verify in dev before committing to it |

---

## Key Environment Variables to Add

```
ANTHROPIC_API_KEY=           # Claude API — task execution and QA
OPENAI_API_KEY=              # Embeddings only (text-embedding-3-small)
GOOGLE_CLIENT_ID=            # Already exists for OAuth
GOOGLE_CLIENT_SECRET=        # Already exists for OAuth
GOOGLE_DRIVE_WEBHOOK_SECRET= # Token to validate incoming Drive webhook POST requests
```

---

## Sources

- [Google Drive Push Notifications — official docs](https://developers.google.com/workspace/drive/api/guides/push) — webhook headers, channel lifecycle, domain requirements (HIGH confidence)
- [googleapis npm](https://www.npmjs.com/package/googleapis) — version 171.4.0, last published 2 months ago (HIGH confidence)
- [google-auth-library npm](https://www.npmjs.com/package/google-auth-library) — version 10.6.2, last published 16 days ago (HIGH confidence)
- [@anthropic-ai/sdk npm](https://www.npmjs.com/package/@anthropic-ai/sdk) — version 0.81.0 (HIGH confidence)
- [Turso native vector search](https://turso.tech/vector) — F32_BLOB syntax, libsql_vector_idx, vector_top_k (MEDIUM confidence — beta status)
- [OpenAI text-embedding-3-small pricing](https://www.helicone.ai/llm-cost/provider/openai/model/text-embedding-3-small) — $0.02/1M tokens (HIGH confidence)
- [Vercel Functions Limits](https://vercel.com/docs/functions/limitations) — 300s default, 800s max (Pro) with Fluid Compute (HIGH confidence — fetched directly from Vercel docs)
- [LangChain vs Vercel AI SDK vs OpenAI SDK — Strapi](https://strapi.io/blog/langchain-vs-vercel-ai-sdk-vs-openai-sdk-comparison-guide) — framework comparison (MEDIUM confidence — third-party)
- [Serverless Agent Inference — DomAIn Labs](https://www.domainlabs.dev/blog/agent-guides/serverless-agent-deployment) — Vercel agent patterns (MEDIUM confidence — third-party)

---
*Stack research for: VendoOS skills layer — Google Drive sync + AI agent task execution*
*Researched: 2026-04-01*
