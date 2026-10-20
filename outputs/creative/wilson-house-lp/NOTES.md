# Wilson House: landing pages (design)

Built 20 Oct 2026 on the shared harness (`scripts/lp-harness/`) with `/client-landing-pages`, Phases 0 to 3, new
patient page only (Meta). Figma: "Wilson House — Landing Pages" Dp4CF7h8Obwe2UT1elvp8d (Kana Health Group folder).
Frames: Brand spec page: sheet 6:4, desktop 5:4, mobile 4:4. New patient page: desktop 12:4, mobile 11:4, thank-you
desktop 3:4, thank-you mobile 2:4. Captured headless, auto layout stripped, sections named.

Brand: Wilson House guideline (Figma IGQz4NTnCHwBgcouPheI90, harness `outputs/creative/wilson-house-meta-statics/`)
plus the practice website's own shapes, which Toby asked for: arch photo frames with a 1px Blush hairline 8–10px
outside the photo and open at the bottom, a side arch bleeding off the right edge (What's included), Tan hairline
treatment and team cards, 100px pill buttons (Royal Purple on light, Lilac on Purple), 24px fields, the site's two-layer
wave dividers and gold hairline curve (SVGs inlined from `assets/shapes`), gold stars and the crown watermark on
Aubergine sections, crown bullets, steps numbered "01." in Lilac Playfair. Rhythm: white / Cream / Wilson Purple, with
Aubergine for steps, why us and the final CTA.
Headlines are Playfair Display with an italic turn, as the guideline says. The July 2026 statics use Montserrat Bold
headlines: Toby to confirm which.

Harness additions (generic, in `scripts/lp-harness/`): `device.line` / `photo_frame` hairline frames open at the
bottom, side-arch photos (`"shape": "side"`) that bleed off the edge, `explainer.photo_right`, `step_suffix`, and a
`divider` block that draws a client's own shape SVG between sections.

Source of truth (Toby, 20 Oct 2026): lp.wilsonhousedentalpractice.com/new-patients-offer-meta. The Google page
(/new-patients-offer) has identical copy and prices; it only adds the phone number and a Book Now header button.
Every price is in `facts.json`. Build: `python3 make_pages.py`, then from `scripts/lp-harness/`: `build.py`, `lint.py`
(0 failures), `render.sh`. Brand spec sheet: `python3 brand_spec.py` after building `brand-spec`.

## Pages in Figma
- "Brand spec": palette, type and the site's shapes on one sheet, plus desktop and mobile of the hero, gold curve,
  USP strip, pricing panel and form band with the waves.
- "New patient": desktop 1440, mobile 390 and both thank-you frames. Sections: header, hero + form (arch device, £85
  seal), gold curve, award finalists marquee, USP strip, patient stories, pricing panel, Google reviews, form band,
  pain points, what's included (side arch), four steps, services (Tan photo cards), why us, find us (hours, parking,
  Denplan), meet your dentist (Dr Zakaria Ghrouf), team carousel (first names), practice video, FAQ, final CTA + form,
  footer.
- Left out: membership plans (the site's plan table is labelled 2025 and its options don't line up; Denplan is
  mentioned instead), before-and-afters (none on the draft or the site), a separate hygiene section (folded into
  pricing and services). Phone numbers and call buttons (LP rule: form only).

## Copy changes against the draft
- CTA "Schedule An Appointment" becomes "Book Appointment" (SOP wording).
- Headline "Need A Private Dentist In Milton Keynes?" becomes the priced headline "Your new patient check-up, only
  £85", with Newport Pagnell in the eyebrow (the practice's own town; the draft says Milton Keynes throughout).
- "We specialise in gentle dentistry" dropped (GDC "specialist" wording). "5-Star Rated" becomes "Rated Excellent on
  Google". "Exclusive New Patient Offers" and "rapid-response" dropped.
- Three steps become four (booking, visit, advice, plan), all from the draft's own lines.
- doug futers' review is trimmed with an ellipsis (the cut part mentions phoning the on-call dentist).
- Awards: the homepage says "finalists and winners" but all six badges say Finalist, so the strip says Finalist only.

## Quotes and GDC numbers
Quoted words under a named person are only that person's published words: Google reviews from the draft, and Dr Zakaria's
line from his site profile. His GDC number (256699) and DMD are from the same profile page. Sources in facts.json.

## Photos
Real practice photos only, no stock: Drive Content Assets, Joe Goodchild's July 2026 shoot, the site's /team/ headshots
and the YouTube poster. Hero: Dr Keval in the lounge chair (the site's file names pair this face with him). People
are named only where the site pairs face and name. fio-root-unassigned/10.jpg (a different building) is not used.

## Open checks for the client
See `facts.json` `to_confirm`.
