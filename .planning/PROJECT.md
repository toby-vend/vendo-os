# VendoOS

## What This Is

VendoOS is the internal operating system for Vendo, a dental marketing agency managing 25+ clients across paid social, SEO, and paid ads channels. It ingests company knowledge from Google Drive (SOPs, templates, frameworks, content guides), meeting intelligence from Fathom, and financial/CRM data from Xero, GHL, and Meta — then uses AI agents to produce client deliverables (ad copy, content, reports) against those SOPs, with QA enforcement.

## Core Value

When an AM assigns a task (e.g. "write Meta ad copy for Lateral Dental"), the system automatically pulls the right SOPs, brand context, and templates, produces draft work, and validates it against standards — turning hours of manual work into minutes.

## Requirements

### Validated

- Google Drive folder structure maintained by AMs (paid social, SEO, paid ads, general/agency-wide)
- Ad copy templates, creative frameworks, content writing guides, performance SOPs all exist in Drive
- Meeting intelligence: Fathom sync, processing, categorisation, querying (444+ meetings)
- Web dashboard: Fastify + Eta SSR with HTMX, deployed on Vercel
- Authentication: Custom session-based auth with bcrypt, admin/standard roles
- Data syncs: Fathom, Xero, GHL, Meta Ads — all pulling into SQLite/Turso
- Daily brief generation from aggregated data sources
- Google OAuth flow for Drive/Gmail/Calendar access
- Database: Local SQLite (dev) + Turso cloud (prod) via @libsql/client

### Active

- [ ] Google Drive real-time sync via webhooks (document watcher)
- [ ] Auto-classification of Drive documents by channel (folder-based)
- [ ] Skills library: indexed, classified, queryable store of SOPs and templates
- [ ] Brand hub: per-client brand files (25+ clients)
- [ ] Channel hub: channel-specific SOP collections (paid social, SEO, paid ads)
- [ ] Task matching engine: match assigned task to relevant skills + brand context
- [ ] Agent task execution: produce draft work using combined skill set
- [ ] QA check: validate agent output against SOP standards, retry if below standard
- [ ] Three access tiers: admin (sensitive data), staff (tools + chatbot), client CRM (isolated DB)

### Out of Scope

- Specialist sub-agents (creative, audience, copy, reporting per channel) — future layer, marked as dashed in architecture
- QA agents (cross-cutting audit of all processes) — future layer
- Client CRM portal with isolated database — separate milestone after core skills layer
- Real-time chat or messaging features — not core to the operating system
- Mobile app — web-first, accessed via browser

## Current Milestone: v1.1 Mobile & PWA

**Goal:** Make VendoOS fully usable on mobile — responsive layout, touch-optimised interactions, installable PWA with push notifications and offline support.

**Target features:**
- Responsive layout overhaul (sidebar, navigation, all pages)
- Bottom tab bar navigation on mobile
- Touch-optimised tables and task flows
- PWA manifest + service worker (installable to home screen)
- Push notifications (draft ready, QA failure, task status changes)
- Offline caching (view cached drafts/tasks when signal drops)

## Context

Vendo is a dental marketing agency with a structured Google Drive containing all operational knowledge: SOPs, templates, frameworks, and content guides organised by channel (paid social, SEO, paid ads) and type. AMs currently manually reference these documents when producing client work. The goal is to automate this: Drive becomes the source of truth, VendoOS indexes and classifies everything, and AI agents use this knowledge to produce work.

The existing codebase already has a working web dashboard, meeting intelligence pipeline, and data syncs from four external services. Google OAuth is partially implemented. The next step is building the skills layer that connects Drive content to task execution.

25+ active dental clients, each with their own brand context (brand files, tone, compliance requirements). Classification is folder-based — Drive folder structure determines channel assignment.

## Constraints

- **Data source**: Google Drive is the source of truth for all SOPs/templates — VendoOS keeps a classified copy, never the authoritative version
- **Classification**: Folder-based, not AI-based — Drive folder structure determines channel (paid social/SEO/paid ads)
- **Sync mechanism**: Real-time via Google Drive webhooks (push notifications)
- **Access tiers**: Admin sees everything; staff sees tools + chatbot only (no revenue/financials); client portal is completely isolated database
- **Stack**: Fastify + Eta + HTMX on Vercel (existing stack, no framework change)
- **Database**: SQLite/Turso (existing pattern, extend with skills tables)
- **Client scale**: 25+ clients — brand hub must be scalable, not hardcoded

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Folder-based classification over AI classification | Drive folder structure already maps to channels; simpler, deterministic, no false positives | -- Pending |
| Real-time webhook sync over periodic cron | AMs update Drive frequently; stale SOPs mean agents produce wrong work | -- Pending |
| Skills layer before client CRM portal | Skills + agents = direct revenue impact; client portal is visibility, not productivity | -- Pending |
| Extend existing Fastify/Eta stack | Proven in production, team knows it, no migration cost | -- Pending |

---
*Last updated: 2026-04-06 after milestone v1.1 initialisation*
