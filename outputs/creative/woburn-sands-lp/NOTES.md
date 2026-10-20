# Woburn Sands Dental Practice: landing pages (design)

Built 20 Oct 2026 on the shared harness (`scripts/lp-harness/`) with `/client-landing-pages`, following the MK Smiles
build. First page type: new patient (Meta). Figma: "Woburn Sands — Landing Pages" jSN5IyJSji3tQf69PR5aZV (Kana Health Group folder). Brand spec page: sheet 4:4,
desktop 6:4, mobile 5:4. New patient page: desktop 10:4, mobile 8:4, thank-you desktop 2:4, thank-you mobile 3:4.

Brand: Woburn Sands guideline (Figma xOAVGppKkuFSLDgZs0OoyO, harness `outputs/creative/woburn-sands-meta-statics/`),
the July 2026 Meta statics and woburnsandsdentalpractice.co.uk. `brand.json`: Manrope Bold Woburn Green headlines with
the turn in Instrument Serif Italic (Crown Gold on white, Mist on green), Jost caps labels in Crown Gold, Kana crown
bullets in place of ticks, crown cards (Fern fill, white hairline) on green, square photo frames with a Mist offset
block (the site and ads never round photos), the house sketch as a watermark, the crown rule above the final CTA,
green-wash practice photography behind the mid-page form and the final CTA (the guideline's "green wash"), Mist
buttons on green and green buttons on white, 4px buttons and fields, Manrope ExtraLight numerals. Lime waiting-room
walls are decor, not brand: they appear only in photos. Jost stands in for the site's paid Neutra Text on labels.
Header logo: the site's own horizontal SVG lockup with the house line set to Sketch Grey (it is drawn white for the
site's green header); footer uses the guideline's white version. Both are wrapped as SVG for the harness (`make_assets.py`).

Source of truth: Toby's Meta draft lp.woburnsandsdentalpractice.co.uk/new-patients-offer-meta (read 20 Oct 2026).
The Google draft (/new-patients-offer) is the same page plus the phone number in the header and beside each button;
no price, offer or inclusion differs. Fees, membership, team, smile gallery and access facts from the main site.
Every price is in `facts.json`. Build: `/usr/bin/python3 make_assets.py` (once), `python3 make_pages.py`, then from
`scripts/lp-harness/`: `build.py`, `lint.py` (0 failures), `render.sh`. Brand spec sheet: `python3 brand_spec.py`.

## Pages in Figma
- "Brand spec": palette + type sheet, desktop and mobile of the hero, USP strip, pricing panel and form band.
- "New patient": desktop 1440, mobile 390 and both thank-you frames. Sections: header, hero + form + £85 seal, USP
  strip, patient stories, pricing panel, membership (Options A/B/C, D + children's plans in the small print), Google
  reviews, form band, pain points, what's included, four steps, services, smile gallery (before-and-afters), why us,
  opening hours + location, meet your dentist (Simone Duggal), team carousel (first names), FAQ, final CTA + form, footer.

## Dropped
- Awards: none on the draft or the site.
- Practice tour video: no practice video found on the draft, the site or the guideline folder. The kit slot is a video
  poster with a play button, so it would fake a video; left out. Add it when a tour video exists (the July shoot has
  stills only).
- Phone numbers and call buttons (LP rule: form only). The Google draft has the number in four places.
- Draft review from Jemmy Shneider (negative) and Liz Mount (names Parag, who is not on the current team page).

## Copy changes against the draft
- Headline: "New patient check-up, only £85." with the draft's "Need a new private dentist in Milton Keynes?" as the
  tagline (priced headline above the fold, per the SOP). Eyebrow carries Woburn Sands as the location.
- "includes all X-rays" became "X-rays included" / "X-rays when needed, at no extra cost": the draft's own body copy
  says X-rays are taken "when necessary".
- CTA: "Book Appointment" (draft "Schedule An Appointment" is not on the SOP list).
- "5 Star Rated by Local Patients" became "Rated 4.8 on Google" (the real score).
- Reviews: "4.8 from 403 Google reviews" (Google Maps on the homepage, same as the guideline). The draft says "340+"
  in the hero and the Trustindex widget says 341.
- Template leftover in the draft's markup: an icon loaded from zenhousedental.co.uk (Group-899.svg). Not visible copy,
  but the designers should swap it when they rebuild the page.

## Decisions
- Hero price £85 (draft; the fees page agrees on £85 for the adult new patient assessment).
- Hygiene from £81.20 (draft) kept; the fees page says from £78.90. Flagged, not swapped.
- Saturday: shown in the opening hours block only (draft: 8am to 1.45pm), never in the hero or USP. The site says
  8.15am to 1.45pm and Google says closed. Must be confirmed before launch.
- Hero photo: an unnamed clinician from the July shoot (portrait p1) in the square frame; nobody is named beside it.
- Team: July shoot portraits matched by face to the site's own Meet the Team headshots (Simone p4, Sabrina p12,
  Boglarka p9, Tessa p17, Charlotte p15, Agnieszka p8, Julia p5; Julia's badge reads her name). First names only.
  Not shown: Roshwin (MK Smiles shoot), Amisha, Saba, Hafsa, Monisha and the trainees (no matched photo).
- Meet your dentist: Simone Duggal, named in a draft review for a kind, patient extraction; bio and GDC 270660 from
  her team page. The site lists her without "Dr" (her scrubs say Dr Simone Duggal), so the page uses her name only.
  Her quote is written from the practice's own new patient copy and needs her approval.
- Smile gallery: six cases from the practice's published smile gallery (whitening x2, Invisalign x2, implants x2),
  shown before over after. Consent for use on paid-ad landing pages still to confirm.
- 3D digital scan: kept in "what's included" because the draft lists it; it is not in the hero. Confirm the practice
  has an intraoral scanner (the main site only mentions 3D cone beam X-rays for implants).

## Open checks for the client
See `facts.json` `to_confirm`.
