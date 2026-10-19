# Plan: /client-landing-pages — client-branded landing pages on the Vendo Dental Kit

**Created:** 2026-10-19
**Status:** Approved 2026-10-19 (Step 7 dropped for now)
**Layer:** Function
**Request:** Turn what we did by hand for Siha into a repeatable skill. It runs after `/client-meta-statics` and designs a client's landing pages on Vendo's own LP system: same sections and features for every client, but branded to the client's design language rather than recoloured.

---

## Overview

### What This Accomplishes
A slash command, `/client-landing-pages <client> [page types]`, takes a client with a signed-off brand guideline and produces three things:
- Figma designs (desktop and mobile LP plus a thank-you page) for each page type, built section by section on the `vendo-dental-kit` blocks.
- A brand spec the designers can implement once per client.
- A client review pack.

Every page passes the Vendo LP SOPs and a content check before anyone sees it.

### Why It Matters
- **Time.** Siha took about four hours of design plus a feedback round, mostly because rules were discovered mid-build: form-only CTA, keep Toby's hero price, team carousel, mobile bar, scrolling awards, fully responsive. Written down, those rules make the next client a gated run, not a conversation.
- **Not a recolour.** Today a client gets about 29 `--vdk-*` settings (colours, one font, one radius), which is why kit pages read as recoloured.
- **Improvements stay with one client.** Improvements made per client (Maylands' Additional CSS, Siha's separate `siha-landing` plugin) never reach the next client.
- **Accuracy.** The Bond template copy is still live on Maylands ("Vendo Whitening", "whichever clinic", a missing aligner price). A content check stops that reaching a client.

### Layer Dependencies
- **Context.** `/client-meta-statics` Phase 1 brand guideline, signed off, in the client's Figma folder.
- **Data.**
  - Client Bio sheet (offers, prices, Media Plan).
  - Client Drive media (team, clinic, awards, B&A).
  - Vendo LP SOPs on Drive (`reference_vendo_lp_sops` memory).
  - Google reviews.
- **Function.**
  - `vendo-dental-kit` v0.49.0 (on SiteGround sites, not in git).
  - Figma MCP plus the HTML-capture route.
  - Drive token (`.secrets/.gdrive-server-credentials.json`).

---

## Current State

**What exists**
- **Siha reference build.**
  - Folders: `outputs/creative/siha-lp-new-patient/`, `siha-lp-smile-makeover/`, `siha-lp-emergency/`. Each has `build.py`, `common.py`/`sections.py`, `team.py`, `render.sh`, `NOTES.md`, a responsive `index.html` and fixed 1440/390 capture files.
  - Figma: H8qdMp3qSzHTbQp49d9LVZ.
- **Siha review pack.** Drive upload plus a review sheet with previews (`outputs/creative/siha-client-review/`: `upload.ts`, `build-sheet.ts`).
- **The Vendo Dental Kit LP system,** seen on lp.maylandsdentalpractice.co.uk.
  - 15 blocks: header, hero-form, usp-text, story-cards, results (B&A), pricing-cards, google-reviews, pain-points, treatment, services, why-us, practice-tour, faq, cta, footer.
  - GHL form embed, GTM, Meta pixel and GHL call tracking.
- **`~/vendo-kit`** (github vendo-digital-temp/vendo-kit). The full-website framework. It sets the token discipline (palette roles, type scale, spacing unit) but is not the LP system.

**Gaps**
1. Three copies of the Siha section code have already drifted. There is no shared harness.
2. The Siha harness isn't organised around the kit's blocks, so the designers had to reinterpret it. Hence `siha-landing`, a separate plugin.
3. The LP rules live in auto-memory only, which is per machine and not in git. Teammates running the skill wouldn't get them.
4. Key tools sit in session scratchpads or one-off folders: the headless Figma capture script, the face-detected team crop, cut-outs, render QA.
5. No content check. Template leftovers have been found by eye on Siha and are still live on Maylands.
6. The Maylands improvements live in WP Additional CSS and raw HTML blocks:
   - mobile sticky bar;
   - patient-smiles scroller;
   - B&A slider;
   - meet-your-dentist;
   - three-column hero photo.

   They aren't in the kit.
7. There is no defined place in WordPress for a client's brand layer beyond the 29 settings. That is a developer decision (see Open Questions).

---

## Proposed Changes

### Summary
- Write the LP rules and the kit section catalogue into git as a playbook.
- Build one shared LP harness, organised one function per kit block, driven by a per-client `brand.json` and `content.json`.
- Commit the supporting tools: Figma capture, team crop, cut-out and render QA.
- Add a content check: template leftovers, prices against verified facts, CTA rules, healthcare and FCA claims, em dashes.
- Generalise the Siha review pack into a reusable step.
- Write the `/client-landing-pages` command with gates.
- Write a kit backlog doc for the developers. The first items are the Maylands improvements.
- Pilot on one client before calling it done.

### New Files

| File Path | Purpose |
|-----------|---------|
| `data/playbooks/landing-pages/README.md` | The LP rules: SOP checklist, form-only CTA (call/WhatsApp on the thank-you page only), CTA wording, hero price rule, healthcare and FCA claims, team names and crops, no stock |
| `data/playbooks/landing-pages/kit-sections.md` | The 15 vdk blocks: what each holds, which SOP point it covers, what the brand layer may change, and the Maylands extras |
| `data/playbooks/landing-pages/page-types.md` | A section recipe per page type (new patient, emergency, smile makeover to start), taken from the Siha and Maylands builds |
| `data/playbooks/landing-pages/template-leftovers.txt` | Known template phrases to flag (Bond clinic names, "Vendo Whitening", "whichever clinic", "most trusted name", Diamond provider, the £595/£395 inclusions, "specialists") |
| `scripts/lp-harness/lpkit/brand.py` | Loads `brand.json` and emits CSS variables plus "treatments" (headline style, graphic device, photo crop, card shape, section rhythm, icon style) |
| `scripts/lp-harness/lpkit/sections/*.py` | One module per kit block, each taking content plus brand treatments. Ported from Siha `common.py`, renamed to match the kit |
| `scripts/lp-harness/lpkit/page.py` | Assembles a page from a recipe. Writes `lp-desktop.html`, `lp-mobile.html`, a responsive `index.html` and the thank-you pages |
| `scripts/lp-harness/build.py` | CLI: `build.py <client-folder> <page-type>` |
| `scripts/lp-harness/render.sh` | Headless Chrome full-page renders at 1440 and 390 for QA |
| `scripts/lp-harness/figma-capture.sh` | The headless capture flow (`generate_figma_design` hash URL) that only existed in a scratchpad |
| `scripts/lp-harness/tools/team_crop.py` | Mid-chest-up crops from face boxes (Apple Vision), first names only |
| `scripts/lp-harness/tools/cutout.py` | rembg cut-out with edge clean-up |
| `scripts/lp-harness/lint.py` | Content check: leftovers list, plural "clinics" for single-site clients, `tel:`/WhatsApp on the LP, prices not in `facts.json`, banned claims, monthly finance figures, em dashes. Non-zero exit on failure |
| `scripts/lp-harness/review-pack/` | Generalised `upload.ts` + `build-sheet.ts` from `siha-client-review` (rebuild in place so client comments survive) |
| `scripts/lp-harness/README.md` | How to run it end to end |
| `.claude/commands/client-landing-pages.md` | The skill: phases, gates, rules, "never" list |
| `docs/vendo-dental-kit-backlog.md` | Developer backlog: kit features to add so improvements reach every client, plus the brand-layer mechanism question |
| `outputs/creative/<client>-lp/` (per run) | `brand.json`, `content.json`, `facts.json`, `NOTES.md`, builds, renders. Media gitignored |

### Files to Modify

| File Path | Changes |
|-----------|---------|
| `data/playbooks/README.md` | Point LP work at `landing-pages/` |
| `.claude/commands/client-meta-statics.md` | Add a closing pointer: "next: `/client-landing-pages`", and note that its brand guideline feeds `brand.json` |
| `CLAUDE.md` | Add `/client-landing-pages` to the Commands table and LP work to the playbook rule |
| `outputs/creative/siha-lp-*/NOTES.md` | Note that they are the reference build, superseded by the shared harness |

---

## Design Decisions

1. **Build on `vendo-dental-kit`, not `vendo-kit`.** The dental kit is the LP system in use (Maylands, sg-host). `vendo-kit` is the full-website framework. From `vendo-kit` we borrow only its discipline: every value maps to a named setting, and mobile follows rules rather than being invented.
2. **One harness function per kit block.** The designers implement section by section against blocks they already have, so client work stops turning into a separate plugin like `siha-landing`. Sections the kit lacks are marked "kit backlog" in the design, never quietly invented.
3. **The brand layer is a spec plus treatments, not just colours.** `brand.json` holds:
   - the kit's 29 settings;
   - per-section treatments taken from the guideline. Siha's were: uppercase light headline with one bold word, S-frame photo crop with a cut-out breaking out, 30px cards, pill buttons, dark/nude rhythm, line icons.

   Toby signs this off once per client before any page is built (a gate). It's what stops a recolour.
4. **Keep desktop and mobile frames.** Siha's designers used both, and the dental kit has its own mobile behaviour (sticky bar, swipe rows, marquee). The responsive `index.html` stays as the live preview for Toby and the client.
5. **Rules and catalogue in git, not memory.** Auto-memory is per machine. Teammates need the same rules.
6. **The content check is a script, not a reminder.** The same leftovers slipped through on Maylands. A failing check blocks capture to Figma.
7. **Figma via the HTML capture route.** Custom brand fonts survive capture; `use_figma` can only use Google fonts. This is the same method as `/client-meta-statics`.
8. **Scope ends at design and review.** The skill hands over to the designers. It doesn't edit WordPress, so it never touches a live site, Additional CSS or GHL. Revisit once the kit backlog decides where a brand layer lives.

---

## Step-by-Step Tasks

### Step 1: Write the rules and catalogue into git
**Actions:**
- Write the LP playbook. Sources:
  - the `reference_vendo_lp_sops`, `feedback_lp_form_only_cta` and `feedback_lp_draft_prices` memories;
  - the three Siha `NOTES.md` files;
  - the Drive SOPs (re-read "SOP_ Ad Landing Page Checklist" and the QA Scorecard, ≥85% with no ★ fails).
- Write `kit-sections.md` from the Maylands page source: block class names, fields seen, and how each SOP point maps to a block.
- Write `page-types.md` with the three recipes.
- Write `template-leftovers.txt` from the Siha and Maylands fixes.

**Files affected:**
- `data/playbooks/landing-pages/*`

### Step 2: Shared harness
**Actions:**
- Port Siha's `common.py`/`sections.py` into `lpkit/sections/`, one module per kit block, plus the thank-you page.
- Replace Siha's hardcoded palette and S-frame with `brand.py` treatments. Write Siha's own `brand.json` as the first fixture.
- `page.py` builds from a recipe plus `content.json`. Keep the `.live` responsive layer and the `#figmacapture` static switch that Siha already has.
- Rebuild the Siha new patient page from the harness and diff its render against the existing `siha-lp-new-patient` render. It should match within small spacing differences.

**Files affected:**
- `scripts/lp-harness/lpkit/**`
- `scripts/lp-harness/build.py`

### Step 3: Commit the supporting tools
**Actions:**
- Recover the headless capture script from git history or the Siha session notes into `figma-capture.sh`.
- Move the team-crop and cut-out code out of the Siha folders into `tools/`.
- Generalise `render.sh` (port as an argument).

**Files affected:**
- `scripts/lp-harness/figma-capture.sh`
- `render.sh`
- `tools/*`

### Step 4: Content check
**Actions:**
- `lint.py` reads the built HTML, `facts.json` and `template-leftovers.txt`.
- It reports each failure with the section and the text.
- Test it against the current Maylands smile makeover source (saved locally): it must flag "Vendo Whitening", "whichever clinic", "from  a month" and "most trusted name".
- Test it against the final Siha pages: it must pass.

**Files affected:**
- `scripts/lp-harness/lint.py`

### Step 5: Review pack
**Actions:**
- Generalise the Siha `upload.ts` and `build-sheet.ts`: client name, Drive folder ID and an existing sheet ID (rebuild in place) as arguments.
- Add a landing pages tab with desktop and mobile previews.

**Files affected:**
- `scripts/lp-harness/review-pack/*`

### Step 6: The command
**Actions:**
- Write `.claude/commands/client-landing-pages.md` with these phases:
  - **Phase 0, inputs.** Guideline link, Client Bio sheet, Drive media root, page types, prices and offers, B&A consent, booking link, the Fathom onboarding call. Branch `feat/<client>-lp`.
  - **Phase 1, brand spec.** Read the guideline and the client's approved ads, then write `brand.json` and a one-page spec frame in Figma. **GATE.**
  - **Phase 2, facts and copy.** Verified prices with sources, offers, claims to confirm. Copy per section from the page-type recipe. Conflicts flagged, and Toby's price is kept. **GATE** on conflicts.
  - **Phase 3, first page.** Build, render QA at 1440, 1024, 768 and 390, run the content check, capture to Figma. **GATE.**
  - **Phase 4, remaining page types.** Carousels (team, B&A) shown to Toby first.
  - **Phase 5, review pack.** Drive plus the review sheet. Toby shares it with the client.
  - **Phase 6, feedback round.** Apply the client's email, update `NOTES.md`, rebuild the sheet in place.
  - **Phase 7, handover.** Figma link, `brand.json`, per-section notes ("kit block X with treatment Y", "needs kit backlog item Z"), open client checks, tracking needs (form name, thank-you page, call/WhatsApp only there).
- Write the "Never" list:
  - no stock imagery;
  - no call or WhatsApp on the LP;
  - no promised dates;
  - no "ready" claims;
  - no unverified claims;
  - no editing live WordPress.

**Files affected:**
- `.claude/commands/client-landing-pages.md`
- `.claude/commands/client-meta-statics.md`
- `CLAUDE.md`

### Step 7: Kit backlog for the developers (DROPPED for now, Toby 2026-10-19)
**Actions:**
- Write `docs/vendo-dental-kit-backlog.md`:
  - **Features to move into the kit.** Each comes from the Maylands Additional CSS, with what it does, where it is today and why it belongs in the kit:
    - mobile sticky bar;
    - patient-smiles scroller;
    - B&A slider;
    - meet-the-dentist block;
    - hero image slot;
    - scrolling awards strip;
    - team carousel (Siha).
  - **The brand-layer question.** Where a client's treatments live (per-client stylesheet/child plugin, extra kit settings, or block style variations). Present it as options for the developers to choose from, not a decision.
- This is a document only. No kit code changes.

**Files affected:**
- `docs/vendo-dental-kit-backlog.md`

### Step 8: Pilot
**Actions:**
- Run the command end to end on one client (Toby to pick), up to the Phase 3 gate.
- Fix whatever breaks in the harness or command. Then commit, update memory and close.

**Files affected:**
- `outputs/creative/<pilot>-lp/*`

---

## Validation Checklist
- [ ] Siha new patient page rebuilt from the shared harness matches the existing render (visual diff checked by eye at 1440 and 390)
- [ ] The content check flags all four known Maylands leftovers and passes the final Siha pages
- [ ] A Figma capture from the harness keeps the brand font on text (Metropolis for Siha)
- [ ] The review pack rebuild keeps existing sheet comments (test on a copy of the Siha sheet)
- [ ] `python3 -m py_compile` and `npx tsc --noEmit` clean on new scripts
- [ ] The command runs on the pilot client to the Phase 3 gate without unplanned questions

## Success Criteria
1. A new client gets a signed-off brand spec and a first LP in Figma in one session, with no rule re-learnt mid-build.
2. Every page reaches the client with zero content-check failures.
3. The designers can implement each section against a named kit block without reinterpreting the design.
4. The kit backlog doc is in front of the developers with the Maylands improvements listed.

---

## Decisions from Toby (2026-10-19)
1. Page types: new patient, emergency, smile makeover.
2. Pilot client: Concept Dental (statics in progress on feat/concept-dental-meta-statics).
3. Designers get desktop and mobile frames.
4. Dilith owns the kit. Step 7 (backlog doc) is dropped for now; do what we can without it.
5. Maylands copy problems already flagged by Toby.
