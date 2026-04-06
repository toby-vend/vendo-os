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

---

---

# Mobile & PWA Feature Research — v1.1

**Domain:** Mobile-optimised internal dashboard — task management / content production for account managers
**Researched:** 2026-04-06
**Milestone:** v1.1 Mobile & PWA
**Overall confidence:** MEDIUM-HIGH

---

## Context

VendoOS is an internal B2B tool used exclusively by Vendo staff (account managers and admins). The existing stack is Fastify + Eta (SSR) + HTMX, deployed on Vercel. This section covers what mobile/PWA features are table stakes vs differentiating for that specific use case.

Mobile is **supplementary to desktop, not primary**. AMs primarily work at desks but need mobile access for:
- Checking task status whilst away from their desk
- Approving or rejecting drafts without going to a laptop
- Receiving alerts when something requires action

B2B SaaS internal tools see roughly 34-40% mobile traffic with desktop dominating complex workflows. Mobile is for quick actions, not authoring.

---

## Table Stakes

Features users expect from a mobile tool. Missing any of these makes the experience feel broken or unusable on mobile — users won't adopt it.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Responsive layout — no horizontal scroll | Every modern web tool is responsive; sideways scrolling is immediately disqualifying | Med | Sidebar collapse, fluid grids, viewport meta tag. CSS only — no JS framework change needed. |
| Bottom tab bar navigation on mobile | Industry standard since iOS 7 / Material Design; hamburger menus are now considered poor UX on mobile | Med | Replace desktop sidebar with a bottom bar (4–5 core tabs) at ≤768px. Keep sidebar for desktop unchanged. |
| Touch targets ≥ 44×44px | Apple HIG specifies 44×44pt minimum; Material Design specifies 48×48dp. Below this causes misclicks and frustration. | Low | Apply to all buttons, links, and table row actions. Pure CSS change on most elements. |
| Readable tables on small screens | Task lists and skills tables with 8+ columns break layout; AMs use these constantly | Med | Horizontal scroll with sticky first column is the most cost-effective fix. Card view on mobile is higher complexity but better UX. |
| Approve / Regenerate actions accessible from mobile | The core mobile use case — if AMs cannot approve drafts on mobile, the entire feature is useless away from desk | Med | Must be reachable within 2 taps from the home screen install. |
| Input font-size ≥ 16px | iOS Safari zooms in on inputs with font-size < 16px, breaking layout and requiring the user to manually zoom out | Low | Single CSS rule fix. Apply to all `<input>`, `<textarea>`, `<select>`. |
| Installable to home screen (PWA manifest) | The "Add to Home Screen" capability is the entry point for everything else (push notifications, offline, launch icon). Without it, the mobile experience is just a small website. | Low | `manifest.json` with correct icons (at minimum 192×192 and 512×512), `start_url`, `display: standalone`, `theme_color`. |
| Service worker — app shell cache | Without a service worker, the PWA install prompt does not appear on Android. Also required for push notifications. At minimum, cache the shell so it launches without a blank screen on poor signal. | Med | Use Workbox to simplify caching strategy. Cache-first for static assets (CSS, JS, icons); network-first for HTML responses. |

---

## Differentiators

Features that provide real productivity value beyond baseline mobile access. Not universally expected yet, but directly solve real AM pain points.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Push notifications — draft ready | AM finds out instantly when an agent task completes, without polling the dashboard. Direct time saving. | High | Requires: service worker + Push API + server-side subscription storage + VAPID key pair + push dispatch on task completion. iOS requires home screen install first (iOS 16.4+). |
| Push notifications — QA failure | AM knows immediately when a draft failed QA and needs attention, avoiding task backlogs building up silently. | High | Same infrastructure as above; different event trigger. Implement all notification types in one pass. |
| Push notifications — task status changes | Closes the feedback loop for all in-progress tasks without the AM needing to refresh. | High | Same infrastructure again. |
| Offline draft viewing | AMs can review cached drafts whilst in signal-poor dental practices or on commutes. Read-only is sufficient. | High | Extend service worker with network-first + stale-while-revalidate for draft content and task lists. IndexedDB for structured offline storage if richer queries needed. |
| In-browser install prompt / banner | Most users do not know to use "Add to Home Screen". A contextual banner shown after the second visit materially increases install rate. | Low | Android: intercept `beforeinstallprompt` event and show a custom button. iOS: there is no native prompt — show a manual banner with "Tap Share → Add to Home Screen" instructions. Must handle both separately. |
| Badge count on home screen icon | Shows count of pending approvals on the app icon without opening it. Reduces the need to open the app just to check if anything needs attention. | Med | Badging API (`navigator.setAppBadge`). Good Android support; improving on iOS (iOS 16.4+). Requires push notification infrastructure to be in place first. |
| Swipe gestures on task cards | Approve/regenerate via swipe is faster than tapping into a detail view. Familiar from email apps. | Med | CSS touch event handling. Not critical but reduces friction for high-volume approval days. Defer until core flows are stable. |

---

## Anti-Features

Features to deliberately not build for mobile.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Task creation on mobile | Task creation requires selecting client, channel, task type, and writing a detailed brief — this is a seated desktop workflow. Building a full mobile creation form adds significant complexity for very low real-world usage. | Keep task creation desktop-only. Mobile is review and approval. |
| Real-time chat or messaging | Already out of scope per PROJECT.md. Adds WebSocket complexity, presence indicators, message history storage — none of which align with the tool's purpose. | Push notifications replace the "did my task finish?" polling behaviour. That covers the mobile communication need. |
| Complex data visualisations on mobile | Financial dashboards and ad performance charts with 12 metric series do not work at 375px width. Attempting to render them causes zooming, truncation, and confusion. | Show summary KPIs on mobile (single numbers, sparklines). Link to full chart view on desktop. |
| Offline write / edit support | Offline editing creates sync conflicts, especially with AI-generated content that may have been superseded server-side. Complexity far exceeds value for this tool. | Offline read-only. View cached drafts; all writes require connectivity. Show a clear "you are offline" indicator if an AM attempts an action. |
| Native-style page transition animations | HTMX SSR architecture is not designed for gesture-driven page transitions. Building them requires client-side JS that directly conflicts with the hypermedia approach and adds maintenance overhead. | Use CSS transitions for micro-interactions (button state, tab switch highlight). Skip full-page slide animations. |
| Push notification opt-in on first visit | Browsers suppress permission prompts shown immediately — browsers may auto-deny them on behalf of users. First-visit opt-in rates are below 5%. | Prompt after a meaningful trigger: after the first task completes and a draft is waiting. Frame the permission clearly: "Get notified when your draft is ready." |
| Background sync for task submission | Background Sync API allows queuing writes when offline. iOS support is still limited and unreliable. The added complexity (queue management, conflict resolution) is not justified given AMs have reliable connectivity in most contexts. | Require connectivity for task submission. Show a clear error on failure. Revisit once iOS support matures. |

---

## Feature Dependencies

```
PWA Manifest
  └─ required for: Home Screen Install
      └─ required for: iOS Push Notifications (iOS 16.4+)
          └─ required for: All Push Notification Types

Service Worker
  └─ required for: PWA Installability (Android install prompt)
  └─ required for: Offline App Shell
      └─ required for: Offline Draft Viewing
  └─ required for: Push Notifications (service worker handles push events)
  └─ required for: Background Sync (future, iOS support permitting)

Responsive Layout
  └─ required for: Bottom Tab Bar Navigation
  └─ required for: Touch-Optimised Tables
  └─ required for: Touch-Friendly Forms (16px inputs, 44px targets)

Push Notification Infrastructure (server-side: VAPID keys, subscription storage, dispatch)
  └─ required for: Draft Ready Notifications
  └─ required for: QA Failure Notifications
  └─ required for: Task Status Notifications
      └─ required for (optional): Badge Count API

In-Browser Install Banner
  └─ depends on: PWA Manifest + Service Worker (must be installable first)
```

**Build order:** Responsive Layout → PWA Manifest + Service Worker (shell) → Offline Caching → Push Notification Infrastructure → Individual Notification Types → Badge Count + Install Banner.

---

## iOS-Specific Constraints

These affect implementation and must be understood before building.

- **Push requires home screen install.** Safari tabs cannot receive PWA push. The install prompt must be surfaced and the notification value proposition communicated before installation.
- **No `beforeinstallprompt` on iOS.** Android fires an interceptable event for a custom install button. iOS does not — display a manual banner: "Tap Share → Add to Home Screen".
- **iOS 16.4+ required for push.** Older iOS versions cannot receive push from PWAs. Accept this as a hard limitation. Do not build a fallback polling system to compensate.
- **iOS 26 improvement (2026):** Every site added to Home Screen will default to opening as a web app (standalone mode), reducing friction for future iOS users.
- **Storage quotas improved in Safari 17.** Offline caching is more reliable than it was in 2022–2023. Still more limited than Android Chrome.

---

## MVP for v1.1

Build in this order. Each phase is independently deployable.

**Phase A — Layout (no new tech, CSS only):**
1. Responsive layout overhaul — sidebar collapses, fluid grids, viewport meta
2. Bottom tab bar at mobile breakpoint
3. Touch targets and input font sizes

**Phase B — PWA Foundation (enables install + notifications):**
4. `manifest.json` with correct icons and `display: standalone`
5. Service worker with app shell caching (use Workbox)

**Phase C — Offline (extends service worker):**
6. Offline caching for draft content and task lists
7. Offline indicator when connectivity is lost

**Phase D — Push Notifications (new backend work):**
8. VAPID key pair generation and server-side subscription storage
9. Push dispatch on task completion and QA failure events
10. In-browser install prompt / banner

**Defer to v1.2:**
- Swipe gestures on task cards
- Badge count API
- Background sync

---

## Sources

- [PWA Capabilities in 2026 — Progressier](https://progressier.com/pwa-capabilities) — MEDIUM confidence
- [PWA on iOS - Current Status & Limitations 2025 — Brainhub](https://brainhub.eu/library/pwa-on-ios) — HIGH confidence (multiple verified claims)
- [PWA iOS Limitations and Safari Support 2026 — MagicBell](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) — HIGH confidence
- [Offline-First PWAs: Service Worker Caching Strategies — MagicBell](https://www.magicbell.com/blog/offline-first-pwas-service-worker-caching-strategies) — MEDIUM confidence
- [Offline and background operation — MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation) — HIGH confidence (official)
- [PWA | 2025 | The Web Almanac by HTTP Archive](https://almanac.httparchive.org/en/2025/pwa) — HIGH confidence (data-driven annual report)
- [Mobile Navigation UX Best Practices 2026](https://www.designstudiouiux.com/blog/mobile-navigation-ux/) — MEDIUM confidence
- [Designing an Intuitive Mobile Dashboard UI — Toptal](https://www.toptal.com/designers/dashboard-design/mobile-dashboard-ui) — MEDIUM confidence
- [Mobile-First UX Patterns 2026 — TensorBlue](https://tensorblue.com/blog/mobile-first-ux-patterns-driving-engagement-design-strategies-for-2026) — MEDIUM confidence
- [The HTMX Renaissance — SoftwareSeni](https://www.softwareseni.com/the-htmx-renaissance-rethinking-web-architecture-for-2026/) — MEDIUM confidence
- [Content review and approval best practices — zipBoard](https://zipboard.co/blog/collaboration/content-review-and-approval-best-practices-tools-automation/) — MEDIUM confidence

---

*Mobile & PWA feature research for: VendoOS v1.1*
*Researched: 2026-04-06*
