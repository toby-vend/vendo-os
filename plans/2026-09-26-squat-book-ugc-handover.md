# Handover — Squat Success book: organic holiday UGC images (Magnific)

**Created:** 2026-09-26
**Client:** Squat Success (Dr Bobby Bhandal)
**Status:** Not started. Magnific MCP added to Vendo-OS (local scope) and showing connected; tools need a fresh session to load.

---

## How to run

1. Open Claude Code in `~/Vendo-OS`.
2. If Magnific asks for auth, run `/mcp` → `magnific` → authenticate.
3. Paste: `Run plans/2026-09-26-squat-book-ugc-handover.md`

---

## Goal

Create organic, Instagram-story-style photos of people holding **The Dental Freedom Blueprint** in holiday destinations around the world. These are for free-book Meta ads and organic social.

## Inputs

| File | Use |
|------|-----|
| `outputs/creative/squat-success-book-ugc/reference/cover-art.webp` | **Product reference.** Current black and gold cover. The book in every image must match this cover. |
| `outputs/creative/squat-success-book-ugc/reference/style-reference-beach.jpeg` | **Style reference only.** Composition, feel and framing. It shows the OLD yellow/navy cover, so never copy its cover. |

## Style brief (from the reference)

- First-person POV: one hand holds the book up at arm's length, roughly centre-frame.
- **No faces.** At most a hand, a forearm, knees or feet on a lounger.
- Shot on a phone: slight background blur, natural or harsh sun, a little lens flare, imperfect framing, a slight tilt.
- Everyday real details: towels, drinks, sunbeds, other holidaymakers far off and out of focus.
- Should read like a real person's Insta story, not a staged product shot. No studio lighting and no overly perfect composition.
- Vary the hands across images (skin tones, genders, a watch or bracelet on some) so it looks like different readers.
- Portrait 9:16 (story) as the main format. Also produce 4:5 crops of the best ones for feed.

## Cover accuracy (critical)

- Title: THE DENTAL FREEDOM BLUEPRINT in gold condensed caps on black.
- Author bar: DR. BOBBY BHANDAL / Founder of SquatSuccess.co.uk
- Use the cover image as the reference/input image in Magnific, not text description alone.
- Check every output for garbled text on the cover. Regenerate any that fail. Do not deliver misspelled covers.

## Destinations (8 initial variations)

1. Santorini: white-washed terrace, blue domes, caldera behind
2. Bali: pool lounger beside an infinity pool, palm trees
3. Amalfi Coast: café table with an espresso, cliffside town behind
4. Maldives: overwater villa deck, turquoise lagoon
5. Dubai: rooftop pool, skyline in the haze
6. Swiss Alps: chalet balcony, snowy peaks, a mug of coffee
7. Tulum: hammock in the jungle, dappled light
8. Mykonos: beach club lounger, cocktail on a side table

## Process

1. Load the Magnific tools (`ToolSearch` → "magnific") and check which generation/edit tools and models are available.
2. Generate one test image (Santorini). Check cover accuracy and how organic it looks before batching.
3. Batch the remaining 7. Upscale the keepers with Magnific.
4. Save to `outputs/creative/squat-success-book-ugc/` as `01-santorini.jpg`, `02-bali.jpg`, and so on (9:16), plus a `feed-4x5/` subfolder.
5. Show Toby a contact sheet of the results, flag any rejects, and ask which destinations to expand.

## Rules

- No fabricated testimonials, captions or reader names in any image.
- If the ad copy is written later, follow the memory rules (no em dashes, PAS format, see `project_squat_success_ad_copy`).
- Commit the outputs with `feat(squat-success): holiday book UGC images`.
