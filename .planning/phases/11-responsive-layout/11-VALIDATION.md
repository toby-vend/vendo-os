---
phase: 11
slug: responsive-layout
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual visual verification (CSS/JS phase — no testable modules) |
| **Config file** | none |
| **Quick run command** | DevTools responsive mode at 375px — reload affected page |
| **Full suite command** | Full visual walkthrough of all 4 tab sections + More overlay + swipe + pull-to-refresh |
| **Estimated runtime** | ~120 seconds (manual) |

---

## Sampling Rate

- **After every task commit:** Reload the affected page in DevTools responsive mode at 375px
- **After every plan wave:** Full visual walkthrough of all 4 tab sections + More overlay + pull-to-refresh on mobile emulator
- **Before `/gsd:verify-work`:** All 10 requirements verified on a real iOS Safari device
- **Max feedback latency:** ~30 seconds (page reload in DevTools)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | RESP-01 | manual | DevTools 375px — no horizontal scrollbar | N/A | ⬜ pending |
| 11-01-02 | 01 | 1 | RESP-02 | manual | Inspect `<head>` for viewport-fit=cover | N/A | ⬜ pending |
| 11-01-03 | 01 | 1 | RESP-03 | manual | Resize to 767px — sidebar hidden, tab bar visible | N/A | ⬜ pending |
| 11-01-04 | 01 | 1 | RESP-04 | manual | Visual inspection — 4 tabs with correct routes | N/A | ⬜ pending |
| 11-01-05 | 01 | 1 | RESP-05 | manual | CSS inspector — all touch targets >= 48px | N/A | ⬜ pending |
| 11-02-01 | 02 | 1 | RESP-06 | manual | 375px — cards visible, table hidden on /tasks and /clients | N/A | ⬜ pending |
| 11-02-02 | 02 | 1 | RESP-07 | manual | /tasks/new on 375px — form usable without zoom | N/A | ⬜ pending |
| 11-02-03 | 02 | 1 | RESP-08 | manual | /tasks/:id on 375px — draft readable | N/A | ⬜ pending |
| 11-03-01 | 03 | 2 | RESP-09 | manual | Swipe left/right on mobile — tab navigation works | N/A | ⬜ pending |
| 11-03-02 | 03 | 2 | RESP-10 | manual | Pull down on /tasks — refresh triggers | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. This phase is CSS + vanilla JS — no test framework installation needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No horizontal scroll at 375px | RESP-01 | Visual CSS check | Open every page at 375px in DevTools, verify no horizontal scrollbar |
| Tab bar replaces sidebar | RESP-03 | Layout check | Resize to 767px, confirm sidebar hidden and tab bar visible |
| 48px touch targets | RESP-05 | CSS measurement | Inspect computed styles on all interactive elements at 768px |
| Form no auto-zoom | RESP-07 | iOS-specific | Open /tasks/new on real iPhone, tap into input — no zoom |
| Swipe navigation | RESP-09 | Touch gesture | Swipe left/right on mobile browser — verify tab switches |
| Pull-to-refresh | RESP-10 | Touch gesture | Pull down on task list — verify content refreshes |

All phase behaviours require manual verification — this is a CSS/JS UI phase with no server-side logic changes.

---

## Validation Sign-Off

- [ ] All tasks have manual verify instructions
- [ ] Sampling continuity: visual check after every commit
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
