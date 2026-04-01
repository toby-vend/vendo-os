# Feature Research

**Domain:** AI-powered agency operating system — skills-based task execution for dental marketing
**Researched:** 2026-04-01
**Confidence:** HIGH (core features), MEDIUM (compliance specifics), HIGH (anti-features)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features AMs assume exist. Missing these = the system is not usable as a production tool.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Drive document sync | SOPs and templates live in Drive — any system that doesn't stay current with Drive is immediately useless | MEDIUM | Webhook-based (push), not polling. Delta sync only. Must handle renames, moves, deletes. |
| Folder-based channel classification | Drive structure already maps to channels (paid social / SEO / paid ads). AMs won't re-classify manually. | LOW | Deterministic, not AI. Derives from folder path at ingest. |
| Per-client brand context | 25+ clients, each with distinct brand voice, compliance constraints, tone. Without this, all output is generic. | MEDIUM | Brand files are also Drive docs. Same sync pipeline. One brand record per client, queryable by name/ID. |
| Task-triggered document retrieval | The core primitive. AMs assign a task; system pulls the right SOPs + brand context. Without this, everything else is decoration. | HIGH | Requires task→channel mapping + semantic retrieval over indexed skills. Task type must map deterministically to skill set. |
| Agent-produced draft output | The value delivery moment. Agent uses retrieved SOPs + brand context to produce structured draft (ad copy, content brief, report section). | HIGH | Prompt construction from retrieved context is where most failure modes live. Must be structured, not freeform. |
| QA validation against SOP standards | Without this, the system produces plausible-but-wrong output. QA is what separates a tool from a liability. | HIGH | Self-critique pass: agent evaluates its own output against SOP checklist. Retry on failure. Human escalation if retry fails. |
| AHPRA/dental compliance guardrails | Dental advertising in Australia is strictly regulated (AHPRA + TGA). Testimonials, unqualified superlatives, before/after imagery — all prohibited. An agency producing non-compliant copy faces disciplinary action against their client. | MEDIUM | Compliance rules encode into the SOP layer + a dedicated compliance check. Not a separate AI model — rules-based with LLM interpretation. |
| Output status tracking | AMs need to know: is a draft ready, under review, approved, or failed QA? Without status, work gets lost. | LOW | Simple state machine: queued → generating → qa_check → draft_ready → approved. |
| Staff-accessible task interface | AMs need to trigger tasks from the web UI, see output, and approve or request regeneration. | MEDIUM | Fastify + HTMX — fits existing stack. No new framework. |

### Differentiators (Competitive Advantage)

Features that lift VendoOS above a generic AI content tool. These map directly to the agency's specific operating model.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| SOP-grounded output (not freeform LLM) | Output is traceable to specific SOP documents. AMs can see which SOPs were used. This builds trust — and allows debugging when output is wrong. | MEDIUM | Store retrieved doc IDs alongside each generation. Surface in UI as "based on: [doc names]". |
| Skills library versioning | When AMs update a Drive SOP, the indexed version updates too. If output changes after an SOP update, the AM knows why. | MEDIUM | Store document version/modified timestamp at ingest. Link generation to skill version. |
| Channel-specific agent behaviour | Paid social copy agent behaves differently to SEO brief agent — different SOP set, different output structure, different QA criteria. | HIGH | Three channel agents sharing a common execution pipeline but distinct skill contexts. |
| Retry-with-critique loop | On QA failure, the agent sees its own output critique and regenerates — not a dumb retry. Reduces human escalation rate. | MEDIUM | Two-pass: generate → critique → conditional regenerate. Third pass escalates to human. |
| Multi-client brand isolation | Brand context is loaded per-task, never blended. Impossible to produce copy that mixes client A's tone into client B's output. | LOW | Strict client ID scoping at retrieval time. Simple but high-stakes. |
| SOP gap detection | When an AM requests a task type that has no matching SOP, the system surfaces "no skill found" rather than hallucinating with generic knowledge. | LOW | Retrieval confidence threshold. Below threshold = explicit gap signal, not degraded output. |
| Compliance pre-flight on output | Before output is surfaced to the AM, a compliance check runs against AHPRA/TGA rules (no testimonials, no prohibited claims, no unqualified superlatives). Non-compliant draft is flagged, not suppressed — AM sees what failed. | MEDIUM | Rules-based checklist encoded as system prompt constraints + post-generation scan. Dental-specific ruleset. |
| Admin audit trail | Every generation: who triggered it, which SOPs were used, which version, what QA score, what the output was. Required for quality review and debugging. | LOW | Append-only log table in SQLite. No delete. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem reasonable but create problems in this context. Explicitly not building these.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| AI-based document classification | "Let AI decide which channel a doc belongs to" — sounds smart, reduces manual work | False positives are silent and insidious. An SOP filed under the wrong channel gets used in wrong tasks. With 25+ clients and regulated output, deterministic folder-based classification is safer and auditable. | Folder-based classification. If the Drive structure is wrong, fix the Drive structure — don't add AI ambiguity on top. |
| Real-time streaming output | Feels faster, more interactive | Streaming adds frontend complexity (SSE/WebSocket) for content that AMs will review before using anyway. The bottleneck is QA, not display latency. | Async generation with status polling. HTMX polls status endpoint. Draft surfaces when ready. |
| Autonomous publishing / direct-to-platform output | "Skip the AM and post to Meta directly" | Removes the human checkpoint that catches compliance failures before they reach a client's ad account. Dental content + AHPRA = always require AM sign-off. | Draft-ready state requires AM approval. System queues, humans publish. |
| Client-facing AI chat interface | "Let clients interact with the AI directly" | Clients asking an AI about their marketing strategy without AM mediation creates expectation and liability problems. Out of scope for this milestone. | Separate client CRM portal (future milestone) with scoped, read-only data views. No AI chat. |
| Periodic cron-based Drive sync | Simpler to build than webhooks | Stale SOPs mean agents produce wrong work. AMs update Drive frequently. A 30-minute lag between SOP update and available skill is operationally damaging. | Webhook-based real-time sync. Complexity cost is justified. |
| Freeform LLM output without SOP grounding | Faster to prompt generically than to build retrieval | Generic output is not why this system is being built. Without SOP grounding, the system produces content that doesn't match Vendo's standards and cannot be QA'd against anything concrete. | Always retrieve-then-generate. If no SOP exists, surface the gap rather than hallucinate. |
| Per-task fine-tuning or model training | "Train the model on our SOPs" | Training cycles are slow, expensive, and require ML infrastructure not in the current stack. RAG with good retrieval achieves equivalent grounding without those costs. | RAG over indexed skills library. Cheaper, faster, updatable in real time. |
| Complex multi-step approval chains | "Route draft to senior AM, then account director, then client" | Infinite approval loops are the primary cause of content production latency at agencies. The goal is AM → output → approve/regenerate. Adding chain complexity defeats the time-saving purpose. | Single AM review step. Regeneration triggers a new draft, not a new approval chain. |

---

## Feature Dependencies

```
Drive Webhook Sync
    └──required by──> Skills Library (indexed SOPs)
                          └──required by──> Task Matching Engine
                                                └──required by──> Agent Task Execution
                                                                      └──required by──> QA Validation
                                                                                            └──required by──> Output Status / AM Review

Brand Hub (per-client brand files)
    └──required by──> Agent Task Execution (brand context injected into prompt)
    └──also requires──> Drive Webhook Sync (brand files are Drive docs)

AHPRA Compliance Guardrails
    └──required by──> QA Validation (compliance is a QA dimension)
    └──also enhances──> Agent Task Execution (system prompt constraints)

SOP Versioning
    └──enhances──> Skills Library (track document version at ingest)
    └──enhances──> Output Audit Trail (generation linked to skill version)

Retry-with-critique loop
    └──requires──> QA Validation (critique output exists before retry)
    └──enhances──> Agent Task Execution (retry uses critique as additional context)

SOP Gap Detection
    └──requires──> Task Matching Engine (retrieval confidence score available)
    └──conflicts with──> Freeform LLM fallback (must not fall back to generic output)
```

### Dependency Notes

- **Drive Webhook Sync requires completion before Skills Library**: The indexed skills store is only as current as the last sync. Webhook infra must be stable before the skills layer is useful.
- **Brand Hub requires Drive Webhook Sync**: Brand files are Drive documents. Same pipeline, different classification (by client, not channel).
- **Task Matching Engine requires Skills Library**: Cannot match tasks to skills if the skills are not indexed.
- **QA Validation requires Agent Task Execution**: QA runs on generated output. Cannot be built or tested in isolation without generation working first.
- **AHPRA compliance guardrails enhance Agent Task Execution**: Compliance rules are injected as system prompt constraints at generation time, not only as a post-generation check.
- **SOP Gap Detection conflicts with freeform fallback**: If no SOP is found, the system must surface a gap signal — not fall back to generic LLM output. These two behaviours are mutually exclusive.

---

## MVP Definition

### Launch With (v1)

Minimum needed for an AM to assign a real task and get a usable, compliant draft.

- [ ] Drive webhook sync — live document ingestion, handles create/update/delete
- [ ] Folder-based channel classification — deterministic, no AI
- [ ] Skills library — indexed, queryable store of SOPs with channel + doc metadata
- [ ] Brand hub — per-client brand files ingested from Drive, queryable by client
- [ ] Task matching engine — maps task type + client → relevant SOPs + brand context
- [ ] Agent task execution — produces structured draft from retrieved context
- [ ] QA validation with retry — SOP-checklist pass, one retry with critique, escalate on second failure
- [ ] AHPRA compliance pre-flight — dental-specific rules enforced before draft surfaces
- [ ] Output status tracking — queued / generating / qa_check / draft_ready / approved
- [ ] AM review interface — trigger task, view draft, approve or regenerate

### Add After Validation (v1.x)

Add once the core pipeline is running and generating real output for real clients.

- [ ] SOP versioning — track document version at ingest, link generation to skill version; add once initial sync is stable
- [ ] SOP gap detection — surface missing skills explicitly; add once retrieval patterns are understood from real usage
- [ ] Output audit trail — generation log with AM, SOPs used, QA score, version; add before scaling beyond 3-4 AM users
- [ ] Admin skills management UI — view indexed skills, force re-sync, mark skills as deprecated

### Future Consideration (v2+)

Defer until core pipeline is proven and client CRM milestone begins.

- [ ] Specialist sub-agents per channel (creative, audience, copy, reporting) — current single agent per channel is sufficient; split when output quality demands it
- [ ] Client CRM portal — separate milestone, separate database, completely isolated
- [ ] Cross-client performance correlation — using Meta/GHL data to inform content recommendations; requires data layer maturity
- [ ] Automated SOP suggestions — identify gaps from task failure patterns; needs enough run history to be meaningful

---

## Feature Prioritisation Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Drive webhook sync | HIGH | MEDIUM | P1 |
| Folder-based classification | HIGH | LOW | P1 |
| Skills library (indexed store) | HIGH | MEDIUM | P1 |
| Brand hub (per-client) | HIGH | MEDIUM | P1 |
| Task matching engine | HIGH | HIGH | P1 |
| Agent task execution | HIGH | HIGH | P1 |
| QA validation + retry | HIGH | HIGH | P1 |
| AHPRA compliance guardrails | HIGH | MEDIUM | P1 |
| Output status tracking | MEDIUM | LOW | P1 |
| AM review interface (web UI) | HIGH | MEDIUM | P1 |
| SOP-source traceability in UI | MEDIUM | LOW | P2 |
| SOP versioning | MEDIUM | LOW | P2 |
| SOP gap detection | MEDIUM | LOW | P2 |
| Admin audit trail | MEDIUM | LOW | P2 |
| Admin skills management UI | LOW | MEDIUM | P3 |
| Specialist sub-agents per channel | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for first real-use deployment
- P2: Should have; add when P1 is stable
- P3: Nice to have; defer until v2

---

## Competitor Feature Analysis

*Note: VendoOS is an internal tool, not a commercial product competing in a marketplace. The relevant comparison is against the tools it replaces or augments — Jasper, Copy.ai, Adobe GenStudio — and against a human AM manually referencing Drive.*

| Feature | Jasper / Copy.ai (generic AI copy tools) | Adobe GenStudio for Performance Marketing | VendoOS approach |
|---------|------------------------------------------|-------------------------------------------|-----------------|
| Brand voice | Trained on uploaded docs; no per-client isolation | Brand templates; enterprise-grade asset management | Per-client brand files from Drive; strict scoping by client ID |
| SOP grounding | Not SOP-aware; freeform with style guide injection | Brand guidelines enforced; no SOP concept | SOPs are first-class objects; every generation is retrieval-then-generate |
| Compliance checks | Generic; no dental/AHPRA awareness | Brand compliance only; no regulatory layer | AHPRA/TGA dental-specific rules as dedicated check |
| Drive integration | Jasper has basic import; no real-time sync | No Drive integration | Real-time webhook sync; Drive is the source of truth |
| QA with retry | No self-critique loop | Compliance score only; no regeneration | SOP-checklist critique → conditional retry → human escalation |
| Output traceability | No source attribution | Asset origin tracked | Every draft linked to SOP versions used |
| Task assignment flow | Manual prompt construction | Workflow templates | Task type → automatic skill retrieval → structured prompt |

**Key insight:** Generic AI copy tools force AMs to do the retrieval work manually (find the SOP, paste it into the prompt, check compliance themselves). VendoOS automates exactly that retrieval and validation loop. The differentiator is not the LLM — it is the structured knowledge layer and the QA enforcement.

---

## Sources

- [AHPRA Advertising Guidelines 2025](https://www.ahpra.gov.au/Resources/Advertising-hub/Advertising-guidelines-and-other-guidance.aspx) — Dental advertising compliance requirements (HIGH confidence, official source)
- [New AHPRA Guidelines for Dental Practitioners 2025](https://jrmg.com.au/new-ahpra-guidelines-for-dental-health-practitioners/) — 2 September 2025 changes, cosmetic treatment restrictions (MEDIUM confidence, practitioner guide)
- [SOP-Agent: Empower General Purpose AI Agent with Domain-Specific SOPs](https://arxiv.org/html/2501.09316v1) — Academic paper on SOP-guided agent execution (HIGH confidence, peer-reviewed)
- [What Are Agent Skills? Modular AI Agent Frameworks Explained](https://www.datacamp.com/blog/agent-skills) — Skills layer architecture patterns (MEDIUM confidence, synthesis)
- [Agentic RAG: The Next Evolution](https://aisera.com/blog/agentic-rag/) — Retrieval-then-generate patterns, self-critique loops (MEDIUM confidence, vendor)
- [Content Quality Control in AI Marketing](https://www.typeface.ai/blog/content-quality-control-in-ai-marketing-enterprise-governance-and-best-practices) — Brand compliance governance, QA anti-patterns (MEDIUM confidence, vendor)
- [Production AI Playbook: Human Oversight — n8n Blog](https://blog.n8n.io/production-ai-playbook-human-oversight/) — Human-in-the-loop patterns and failure modes (MEDIUM confidence, practitioner)
- [AI Content Workflow for Agencies 2026](https://www.trysight.ai/blog/ai-content-workflow-for-agencies) — Agency-specific content production patterns (LOW confidence, single vendor source)
- [Adobe GenStudio Brand Compliance](https://business.adobe.com/products/genstudio-for-performance-marketing/brand-compliance.html) — Competitor feature reference (HIGH confidence, official product docs)
- [Powering Your RAG: Google Drive Integration](https://www.ragie.ai/blog/powering-your-rag-integrating-google-drive-for-seamless-knowledge-ingestion) — Drive-as-knowledge-source patterns (MEDIUM confidence, practitioner)

---

*Feature research for: VendoOS — skills layer, dental marketing agency*
*Researched: 2026-04-01*
