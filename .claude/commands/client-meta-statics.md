# /client-meta-statics: brand guideline + persona-led Meta statics in Figma

Usage: `/client-meta-statics <client name> <website URL> [guideline|statics|all]`

This takes a client from nothing to a Figma brand guideline and a Figma file of researched Meta static ads. Each ad comes in 1:1 and 9:16, with primary text and a headline. The Siha Dental build (Oct 2026) is the reference implementation:
- Harness, copy and research: `outputs/creative/siha-meta-statics/`
- Brand guideline: https://www.figma.com/design/AbtwUHTD50G38QuOaCG4Hh
- Statics: https://www.figma.com/design/UwQkUCpzSoFVngNIRjkSG5

Default scope is `all`. Work one phase at a time and stop at every **GATE** for Toby's answer.

---

## Phase 0: Inputs (ask once, up front)

Collect these before building anything. Look first and only ask for what's missing, in up to 2 short questions per round:

1. **Client Bio sheet** on the Shared Drive. You need the **Media Plan tab** (which Meta campaigns are running), offers, prices and the onboarding notes.
2. **Brand assets:**
   - The client's logo folder on Drive.
   - Their existing guidelines PDF, if any.
   - The brand font files. Ask for a zip if it isn't a Google font.
3. **Target area:**
   - Dental clients: a 3–5 mile radius, per the dental SOP.
   - Confirm whether copy names a place. Practice town and target areas often differ.
4. **Volume:** personas × concepts × sizes. Siha was 5 personas × 5 concepts × (1:1 + 9:16).
5. **Onboarding call:** find it in Fathom (`mcp__fathom__search_meetings`). The client's own numbers and wording come from here.

Create the working folder `outputs/creative/<client>-meta-statics/` and a new branch `feat/<client>-meta-statics`.

---

## Phase 1: Brand guideline in Figma

1. **Gather:**
   - Website: colours from the CSS, type, photography style and graphic motifs.
   - Logos from Drive. Prefer clean SVGs; the website's CDN often has them.
   - The guidelines PDF: it wins on palette and motifs. Note any typos in hex labels against the actual swatches.
2. **Figma folder:**
   - Client files live in the Vendo team (`team::1559477527539243709`), in a folder named after the client.
   - If the folder doesn't exist, create it in Chrome (All folders, then + Folder). The MCP can't create folders or move files.
   - Pass the folder id as `projectId` to `create_new_file`.
3. **Install the brand font** to `~/Library/Fonts`.
   - `use_figma` runs on Figma's servers and can only use Google fonts. A custom font has to come in through the HTML capture (Phase 4), or Toby swaps it by hand.
4. **Build the sections** as top-level frames:
   - Cover
   - Logo (with clear space and misuse examples)
   - Colour
   - Typography
   - Graphic elements
   - Photography
   - Tone of voice
   - Example applications
5. **Cleanup:** see "Figma finishing" below.

**GATE:** send Toby the link and wait for sign-off before you start the ads.

---

## Phase 2: Personas and campaigns

1. Read the Meta campaign SOPs on the Shared Drive (folder `181zvEqS8-O4IocWzoCRl0XqaGQ6Cy39H`). Use the dental SOP for dental clients and the service-based SOP for everyone else.
2. Pull the persona bank from the Shared Drive SOPs. For dental, use the Dental Persona Bank.
3. Map personas to the **Media Plan tab** campaigns. Only build for campaigns that are actually running.

**GATE:** use AskUserQuestion to confirm the persona shortlist (with the recommended picks first), the target area rule and the volume.

---

## Phase 3: Research and copy (masterclass method)

Follow `data/playbooks/yt-doc/how-to-write-meta-ads-that-scale-copywriting-masterclass/` (`cheatsheet.md` and `revision.md`). Read both before writing anything.

1. **`research.md`:** a sourced quote bank with links.
   - **Sources:**
     - The client's Google reviews: star rating, count and review topics.
     - Forums. Mumsnet works; Reddit is blocked in the browser.
     - The client's own site pages.
     - The onboarding call.
   - **What to find, per persona:** the accommodation, the failed or rejected solution, the "nearly didn't buy", the customer's own word, the moment they decide, and the after.
   - **Proof ladder:** volume proof is usable now. Named reviews need the reviewer's permission first.
   - **Offer facts:** prices, timings and guarantees, each with its source URL.
2. **`copy-<persona>.md`,** one per persona. Each file holds the persona, campaign, offer and the rules for that persona. Each concept gets:
   - **Labels:** awareness stage, sophistication stage and angle. Image, headline and primary text all start at the same stage.
   - **Research:** the verbatim quote(s) it's built on.
   - **On image:** hook, problem, promise, mechanism. The problem is shown in the imagery.
   - **Headline.**
   - **Primary text:** the nine beats. Proof, offer, risk reversal and a CTA that says what happens next. End on an identity line.
   - **Notes:** a closing section listing every unconfirmed claim for the client to check.
3. **Hard rules:**
   - Never invent a quote, number, offer or result.
   - Urgency only if an offer is genuinely live.
   - No before-and-afters without consented cases.
   - Leave conflicting prices off the ads and flag them.
   - Dental: no sedation language for anxious personas. Finance figures need FCA wording, so leave them off.
   - Client-facing copy: UK English, no em dashes.

---

## Phase 4: Build the statics (HTML harness, then Figma)

1. **Start the harness:** copy `outputs/creative/siha-meta-statics/build.py` as the starting point, then swap in:
   - The palette dict.
   - The `@font-face` block, pointing at `assets/fonts/`.
   - The logo SVGs in `assets/`.
   - The photo set in `assets/photos/`. Use the client's own photography from their site or Drive, and keep `assets/photos/` gitignored.
   - The brand graphic device (Siha's was `sframe()`). Any photo mask must **cover-crop from the real image aspect** (read the JPEG header), never stretch.
2. **Shared pieces you can reuse:**
   - `proof()`: the stars and review count.
   - `steps` / `timeline`, `compare_cards`, `plan_card`, `receipt` and `bullets`.
   - A grain overlay.
   - CTA constants.
3. **Artboards:** 1080×1080 and 1080×1920, with 9:16 safe zones (keep the top 250px and bottom 340px clear of key copy). Write one `<persona>-1x1.html` and one `<persona>-9x16.html` per persona.
4. **Render QA, before every capture:**
   - Serve locally: `python3 -m http.server 8765` in the folder.
   - Render with headless Chrome: `--force-device-scale-factor=0.5`, `--window-size=11600,2400` for 1x1, `11600,4160` for 9x16.
   - Crop each artboard with ffmpeg and look at every one. Check overlaps, crops, legibility, and whether the image matches the copy (who's pictured has to fit the line).
5. **Capture into Figma:**
   - Create the statics file in the client's folder. Use one page per persona, named "01 <Persona> | <angle>".
   - Run `generate_figma_design` with capture.js in the page.
   - Open the URL with `#figmacapture=<id>&figmaendpoint=...&figmadelay=2000` in Chrome. Take a screenshot to keep the tab active, then poll.
   - The capture keeps the custom font on text. CSS `outline` is dropped, so use borders.
6. **Name ads to the build standard:** `<Concept> | Static | <Talent> | <Detail> | 1x1 | YYMMDD`.
7. **Copy row:** add a row of copy cards (Inter) under the 1:1 row on each page, holding the primary text and headline per concept.
8. **Build one persona at a time** and show Toby each before moving on.

---

## Figma finishing (both files, after every capture)

Do these in this order. Getting it wrong stacks every artboard on top of each other.

1. **Strip auto layout:**
   - Set `layoutMode='NONE'`, parents first by depth.
   - `resize()` each frame back to its original size.
   - Verify positions with `absoluteBoundingBox`.
   - Wrap grids collapse into one row when auto layout comes off, so re-grid them by hand.
2. **Lift each artboard** out of the capture wrapper ("<page> | 1x1" > "Body") to page level, keeping its absolute x/y. Then delete the empty wrapper.
3. **Lock** the full-size grain layer (rename it "Grain (locked)") and the large gradient overlays ("Overlay (locked)"). Otherwise they catch every click and Toby can't drag anything.
4. **Name** image frames "Photo".
5. **Lay out:** 1:1 row at y=80 with x = 80 + i×1160; copy row below it; 9:16 row below that.
6. **Check:** take one screenshot per page.

---

## Phase 5: Close out

1. Commit after each persona: `feat(<client>): <persona> statics and copy`. Push.
2. Report to Toby:
   - Both Figma links.
   - A one-line table per persona (concept, image headline, angle).
   - **Checks for the client:** every open item from the copy files' Notes sections (price conflicts, offers, reviewer permissions, consented before-and-afters, staff availability).
3. Save a `project_<client>_client.md` memory with the asset locations, palette, font, Figma file ids and verified facts.

## Never

- Promise the client launch dates or say creative is "ready" before Toby confirms.
- Build for campaigns that aren't on the Media Plan.
- Present forum quotes as the client's patients.
