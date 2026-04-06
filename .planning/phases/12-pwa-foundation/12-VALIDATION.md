---
phase: 12
slug: pwa-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual + smoke tests (static files phase — no server-side logic) |
| **Config file** | none |
| **Quick run command** | `curl -s http://localhost:3000/manifest.json \| node -e "const m=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); ['name','icons','display','start_url','theme_color'].forEach(k=>{if(!m[k])throw 'missing '+k}); console.log('OK')"` |
| **Full suite command** | Quick run + DevTools Application tab check |
| **Estimated runtime** | ~5 seconds (smoke) + ~60 seconds (manual) |

---

## Sampling Rate

- **After every task commit:** Check affected files exist and are valid JSON/JS
- **After every plan wave:** Manifest smoke test + DevTools SW check
- **Before `/gsd:verify-work`:** Full manual check on real Android + iOS device
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | PWA-01 | smoke | curl manifest.json, validate required fields | N/A | ⬜ pending |
| 12-01-02 | 01 | 1 | PWA-02 | manual | DevTools → Application → Service Workers | N/A | ⬜ pending |
| 12-01-03 | 01 | 1 | PWA-03 | manual | Load /settings on Android + iOS, check install section | N/A | ⬜ pending |
| 12-01-04 | 01 | 1 | PWA-04 | manual | Install app, open from home screen, verify standalone | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/generate-pwa-icons.js` — one-off icon generation script (run once, PNGs committed)
- No test framework gaps — Phase 12 adds static files and template changes only

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SW registers in browser | PWA-02 | Requires browser runtime | DevTools → Application → Service Workers → check status |
| Install prompt on Android | PWA-03 | Requires real Android Chrome | Load site, check beforeinstallprompt fires, visit /settings |
| iOS install instructions | PWA-03 | Requires real iOS Safari | Load /settings on iPhone, verify step-by-step text |
| Standalone mode | PWA-04 | Requires installed app | Install to home screen, tap icon, verify no browser chrome |
| Static assets cached | PWA-04 | Requires SW runtime | DevTools → Application → Cache Storage → check entries |

---

## Validation Sign-Off

- [ ] All tasks have manual verify or smoke test
- [ ] Sampling continuity: check after every commit
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
