# /client-landing-pages: client-branded landing pages on the Vendo Dental Kit

Usage: `/client-landing-pages <client name> [new-patient] [emergency] [smile-makeover]`

This runs after `/client-meta-statics`. It takes a client with a signed-off brand guideline and designs their landing pages on Vendo's LP system (`vendo-theme` + `vendo-dental-kit`). Every client gets the same sections and features. The look comes from the client's own design language, not a recolour.

You produce:
- A Figma file with desktop 1440 and mobile 390 frames per page type, plus the thank-you pages.
- The client's `brand.json` brand layer.
- A content check that passes.
- A review pack for the client.
- A handover for the designers, who build in WordPress.

Default page types: all three. Work one phase at a time and stop at every **GATE** for Toby's answer.

**Read first:**
- `data/playbooks/landing-pages/README.md` (the rules)
- `kit-sections.md` and `page-types.md` (same folder)
- `scripts/lp-harness/README.md` (the tools)

**Reference build:** Siha (Oct 2026).
- Harness folder: `outputs/creative/siha-lp/`
- Figma: H8qdMp3qSzHTbQp49d9LVZ

---

## Phase 0: Inputs (look first, then ask up to 2 short questions per round)

1. **Toby's drafts on the LP theme.** One URL per page type, on the client's sg-host or lp. site.
   - The hero price on the draft stands.
   - The rest of the draft is copy to check, not copy to trust: it carries Bond template leftovers.
2. **Brand guideline:**
   - The Figma brand guideline from `/client-meta-statics` Phase 1, signed off.
   - The client's approved Meta statics file. Read it: the signed-off ads show how the brand is actually applied.
   - Font files.
3. **Client Bio sheet** on the Shared Drive: offers, prices, opening hours, hooks, Media Plan.
4. **Client media root on Drive:**
   - team photos
   - clinic interior
   - action shots
   - awards
   - treatment and before-and-after folders
   - practice video
   - Never stock. List the gaps instead.
5. **Facts to confirm:**
   - the online booking link (for the thank-you page);
   - before-and-after consent;
   - who the lead clinician is (GDC number);
   - whether the client wants call or WhatsApp buttons on the thank-you page;
   - whether they take a consultation deposit.
6. **Onboarding call and emails** in Fathom/Gmail: the client's own numbers and wording.

Setup:
- Create a branch `feat/<client>-lp`.
- Create the working folder `outputs/creative/<client>-lp/`: `client.json`, `facts.json`, `pages/`, `assets/` (fonts and logos in git, media gitignored), `.gitignore` copied from `siha-lp`.
- Use a git worktree if another session is working in the main checkout.

## Phase 1: Brand layer

1. Write `brand.json` from the guideline and the approved ads:
   - **Palette roles:** map the guideline colours onto ink, ink2, muted, bg, panel, card, accent, dark, dark2, on_dark and on_dark2.
   - **Headline style:** case, weight, tracking, and how the one emphasised word is set (bold, serif italic, accent colour).
   - **Graphic device:** the shape that frames the hero clinician (S-frame, arch, rounded, circle, backdrop), and whether the cut-out breaks out.
   - **Shapes:** card, button, field and photo radii; button case and tracking.
   - **Rhythm:** which tone each section sits in (light, panel, card, dark), so the page alternates the way the brand does.
   - **Icon stroke, logo files and sizes**, plus `css_extra` for anything signature (grain, a rule, a texture).
2. Build the new patient hero, the first two sections and one dark section.
3. Render, and add a one-page "Brand spec" frame to the Figma file, showing:
   - the palette roles;
   - the type scale;
   - the device on a real team photo;
   - a card, a button and a form;
   - a light section and a dark section.

**GATE:** Toby signs off the brand spec before any full page is built. Ask him: "does this read as <client>, or as our template in their colours?"

## Phase 2: Facts and copy

1. **`facts.json`:** every price and claim with its source (draft, call, email, fees page plus the date checked).
   - Conflicts get both values and a note.
   - Toby's draft price wins unless the client confirmed otherwise.
2. **Copy per section** from the recipe in `page-types.md`, sourced in this order:
   - the draft;
   - confirmed facts;
   - the client's site;
   - the Client Bio sheet.
3. **Drop, don't fake.** If the client can't support a section (no consented before-and-afters, no membership plan), leave it out and note it.
4. **Write `NOTES.md`:** copy changes against the draft, decisions, and open checks for the client.

**GATE:** use AskUserQuestion on any price or claim conflict and on any section dropped. Recommended answer first.

## Phase 3: First page (new patient unless Toby says otherwise)

1. Write `pages/<type>.json` and build: `python3 scripts/lp-harness/build.py outputs/creative/<client>-lp <type>`.
2. **Content check:** run `lint.py`. Zero failures before going further. List the warnings for Toby.
3. **Render:** run `render.sh`. Crop and look at every section at 1440 and 390. Check:
   - overlaps;
   - crops (faces and the mid-chest rule);
   - legibility on every tone;
   - that pictured people fit the line next to them;
   - that no button says anything off the CTA list.
4. **Live preview:** open `index.html` through a local server at 375, 768, 1024 and 1440. Check:
   - the sticky header;
   - the Book Now bar appears after the hero button;
   - every button scrolls to the form;
   - the marquee moves.
5. **Figma:**
   - Create `<Client> — Landing Pages` in the client's Figma folder (Vendo team; create the folder in Chrome if it's missing).
   - Make one page per page type, named "New patient", "Emergency dentist" or "Smile makeover".
   - Capture four frames per page: `lp-desktop`, `lp-mobile`, `ty-desktop`, `ty-mobile`. Use `generate_figma_design`, then `scripts/lp-harness/figma-capture.sh` (headless, never Toby's browser).
   - Then follow "Figma finishing" in `/client-meta-statics`: strip auto layout parents-first, lift the frames out of the wrapper, name the frames, and lay them out side by side.
   - Screenshot each page to check it.

**GATE:** send Toby the Figma link and the preview path. Wait for his feedback before the other page types.

## Phase 4: Remaining page types

Same as Phase 3. The team and before-and-after carousels are always shown to Toby first.
- Team cards: run `tools/team_crop.py crop` on the Drive team photos. First names only.
- Before-and-after cards: consented cases only.

## Phase 5: Review pack (only when Toby says it can go to the client)

1. Write `review.json`: Drive folder (Toby's), title "<Client> x Vendo — Landing pages for review", intro, pages.
2. Run `review-pack.ts` from the repo root. It link-shares the image folder. Toby shares the sheet with the client as Commenter himself.
3. Rebuilds pass the existing sheet ID, so the client's comments survive.

## Phase 6: Feedback round

1. Read the client's email or sheet comments.
2. Apply the changes in `pages/*.json` and `facts.json`. Rebuild, run the check, render and recapture.
3. Add the round to `NOTES.md` and rebuild the review sheet in place.
4. Draft the reply to the client for Toby. It must not promise dates.

## Phase 7: Handover to the designers

Write `HANDOVER.md` in the client folder and send Toby the summary to forward. It covers:
- The Figma link, and `brand.json` turned into the kit's settings: the `--vdk-*` colours, font, radius and section padding.
- **Per section:** the kit block it's built on, and the brand treatment to apply. Sections not in the kit yet are flagged as such, never left implicit.
- **Mobile behaviour:** sticky header, Book Now bar, swipe rows, awards marquee.
- **Forms:**
  - fields;
  - GoHighLevel form or native;
  - form names;
  - the thank-you page URL;
  - call and WhatsApp buttons on the thank-you page only, if the client asked for them.
- **Tracking:** GTM, form-submit conversion, Clarity. Performance review at 2 and 7 days after launch, per the SOP.
- **Open client checks** from `NOTES.md` and `facts.json` `to_confirm`.

Commit after each phase, `feat(<client>): <what>`. Save or update the `project_<client>_client.md` memory with the Figma ID, the harness folder and the verified facts.

## Never
- Promise the client dates, or say pages are "ready" or "built" before Toby confirms.
- Put a call button, a phone link or WhatsApp on a landing page.
- Use stock imagery, other clinics' testimonials, or before-and-afters without consent.
- Leave a price that isn't in `facts.json`, or quote monthly finance repayments.
- Edit WordPress, the kit, Additional CSS or GoHighLevel on a live site. This skill ends at design and handover.
- Capture into Figma with failures from the content check outstanding.
