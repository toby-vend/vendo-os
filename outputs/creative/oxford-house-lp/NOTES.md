# Oxford House: landing pages (design)

Built 20 Oct 2026 on the shared harness (`scripts/lp-harness/`) with `/client-landing-pages`, following the MK Smiles
build. First page type: new patient (Meta). Figma: "Oxford House — Landing Pages" (Kana Health Group folder).

Brand: Oxford House guideline (Figma i0YW4eDguLAwoZpLn4WSTX; harness `outputs/creative/oxford-house-meta-statics/`)
and the practice's July 2026 Meta statics. `brand.json`: Josefin Sans Bold Deep Teal headlines with the turn in
Josefin Light Italic (Logo Teal on white, Bright Teal on Deep Teal), Josefin SemiBold caps labels in Gold, Poppins body,
Bright Teal buttons in Josefin Bold title case with 8px corners, square photos, 10px cards, white / Mist / Deep Teal
rhythm. The signature device is the guideline's: real practice photography under a Deep Teal wash (the red-brick house
in the hero, the lounge behind the mid-page form), outlined crown list cards in the hero, the Kana crown in place of
ticks, and the house sketch as a watermark off an edge. Logos are PNG only, wrapped as SVG for the harness.

Harness addition (this branch): `"backdrop"` on `hero_form`, `form_band` and `final_cta` sets the section on a real
photo under the brand's dark wash (`ui.wash`), for brands whose device is a washed photo rather than a framed
portrait. Without it every block renders as before.

Source of truth (Toby, 20 Oct 2026): lp.mkdentist.co.uk/new-patients-offer-meta/. The Google draft
(lp.mkdentist.co.uk/new-patients-offer) has the same offer, prices, inclusions and copy; the only difference is the
phone number 01908 373614 in its header and body (kept off our page: form is the only CTA).
Every price is in `facts.json`. Build: `python3 make_pages.py`, then from `scripts/lp-harness/`: `build.py`,
`lint.py` (0 failures), `render.sh` (port 8911). Brand spec sheet: `python3 brand_spec.py` after building `brand-spec`.

## Pages in Figma
- "Brand spec": palette + type sheet, desktop and mobile of the hero, USP strip, pricing panel and form band.
- "New patient": desktop 1440, mobile 390 and both thank-you frames. Sections: header, hero + form (wash over the
  house, £85 seal), USP strip, patient stories, pricing panel, Google reviews, form band (wash over the lounge), pain
  points, what's included, four steps, services (photo cards), why us, opening hours spotlight, meet your dentist
  (Dr Pavanpal Diu, Clinical Lead), clinician carousel (first names, draft headshots), practice tour (the draft's
  "Why Choose Oxford House" video), FAQ, final CTA + form, footer.

## Sections left out
- Membership plans: the site's Denplan/membership table lists Options A to E with prices but the inclusions don't
  line up column by column, so the plans can't be shown accurately. Add once the practice confirms each plan.
- Before-and-afters: none on the draft. The site's smile gallery has a few small 2019 images (300x200) with no
  consent record; not used.
- Awards: none on the draft or site.
- Phone numbers, call buttons (LP rule: form only).

## Copy changes against the draft
- Hero: "New Patient Dental Check Up £85 (Inc Xrays)" becomes "Your new patient check-up, £85." with "Digital X-rays
  included" as the tagline. Price unchanged.
- "Schedule an Appointment Now" becomes "Book Appointment" (SOP CTA list).
- "Calm, spa-like surroundings in the heart of Milton Keynes" becomes "A calm, homely practice ... in Fenny
  Stratford" (the practice isn't central MK; "spa-like" unverifiable).
- "Same-day emergency appointments when you need them" becomes "Emergency appointments ... for new and existing
  patients" until same-day is confirmed.
- "Flexible scheduling, including lunchtime and evening slots" becomes opening-hours copy (from 8am, Wednesday to
  6pm, Saturday mornings): the latest close is 6pm.
- "Google Rated by 840 Happy Patients" becomes "Rated Excellent from 950+ Google reviews" (the draft's own widget says
  953).
- Added from mkdentist.co.uk: Edwardian house, two waiting areas, tablet check-in (new patient journey page); child
  check-up £42.50 and treatment "from" prices (fees page).

## Decisions
- Hero price £85 inc X-rays (draft; fees page agrees). CTA "Book Appointment".
- Hero photo: the red-brick house (Frame.io practice-1), the house in the logo. Form band: the lounge (practice-12).
- Meet your dentist: Dr Pavanpal Diu, Clinical Lead, GDC 211338 (draft). Team carousel: the nine draft clinicians,
  draft headshots cropped mid-chest, first names only. Unnamed Frame.io portraits elsewhere.
- No "specialist" wording anywhere (see open checks).

## Open checks for the client
See `facts.json` `to_confirm`.
