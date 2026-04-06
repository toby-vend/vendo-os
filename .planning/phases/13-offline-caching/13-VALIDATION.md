---
phase: 13
slug: offline-caching
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual + smoke tests (SW + Fastify header changes) |
| **Config file** | none |
| **Quick run command** | `curl -sI http://localhost:3000/tasks \| grep -i vary` |
| **Full suite command** | Quick run + DevTools offline simulation |
| **Estimated runtime** | ~10 seconds (smoke) + ~120 seconds (manual offline test) |

---

## Sampling Rate

- **After every task commit:** Check affected files exist and are syntactically valid
- **After every plan wave:** Vary header smoke test + DevTools offline simulation
- **Before `/gsd:verify-work`:** Full offline walkthrough on real device with airplane mode
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | OFFL-05 | smoke | curl -sI localhost:3000/tasks, check Vary header | N/A | ⬜ pending |
| 13-01-02 | 01 | 1 | OFFL-01,02,03,04 | manual | DevTools offline mode — navigate cached pages | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `public/offline.html` — offline fallback page (created during execution)
- No test framework gaps — Phase 13 modifies sw.js, server.ts, and adds static HTML

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full pages cached offline | OFFL-02 | Requires browser SW runtime | Visit /tasks and /clients online, go offline, reload — pages should load |
| HTMX partials offline | OFFL-03 | Requires HTMX + SW interaction | Go offline, trigger an hx-get (e.g. tab switch) — should show offline snippet, not full page |
| Offline fallback page | OFFL-04 | Requires offline + uncached URL | Go offline, navigate to unvisited page — should show branded offline page |
| Vary header present | OFFL-05 | Can be automated via curl | curl -sI any route, check for `Vary: HX-Request` |

---

## Validation Sign-Off

- [ ] All tasks have manual verify or smoke test
- [ ] Sampling continuity: check after every commit
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
