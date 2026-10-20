# MK Smiles: landing pages (design)

Built 20 Oct 2026 on the shared harness (`scripts/lp-harness/`) with `/client-landing-pages`. First page type:
new patient (Meta). Figma: "MK Smiles — Landing Pages" PSc1AHVW9d7XxsAN3sjQLa (Kana Health Group folder).

Brand: MK Smiles guideline (Figma Q67istgFgNYkRSaMFD9kCi, signed off 20 Oct 2026) and the practice's July 2026 Meta
statics. `brand.json`: Poppins SemiBold Teal headlines with the turn in Light Italic (Sage on light, Mint on Teal),
Jost caps labels in Gold, tooth M bullets in place of ticks, square real-photo frames, MK watermark at 5% in the
hero, Teal buttons on light and Mint on Teal, 6px buttons and fields, 10px cards, white / Mist / Teal rhythm.
The logo is PNG only (no vector), wrapped as SVG for the harness.

Source of truth (Toby, 20 Oct 2026): lp.mksmiles.co.uk/new-patients-offer/. Prices, offer, inclusions, Google reviews,
before-and-afters, clinicians, hours and the two YouTube videos all come from it. Membership plan detail from
mksmiles.co.uk/membership-plan.
Every price is in `facts.json`. Build: `python3 make_pages.py`, then from `scripts/lp-harness/`: `build.py`,
`lint.py` (0 failures), `render.sh`. Brand spec sheet: `python3 brand_spec.py` after building `brand-spec`.

## Pages in Figma
- "Brand spec": palette + type sheet, desktop and mobile of the hero, USP strip, pricing panel and form band.
- "New patient": desktop 1440, mobile 390 and both thank-you frames (20 Oct 2026). Sections: header, hero + form,
  USP strip, patient stories, pricing panel, membership (Options A/B/C), Google reviews, form band, pain points,
  what's included, four steps, services, before-and-afters, why us, meet your dentist (Dr Kishan Chavda), clinician
  carousel (first names), practice tour (YouTube poster), FAQ, final CTA + form, footer.
- Added 20 Oct (Toby: use the before-and-afters, add the other features): hero offer seal (£50, usually £76.70),
  opening hours + location spotlight from the source page, MK watermark on the Teal why-us and final CTA bands.
- Left out: awards (none on the source page). Phone numbers and call buttons (LP rule: form only).

## Decisions so far
- Hero price £50, usually £76.70 (the draft's price stands; the fees page agrees on £50 for the adult assessment).
- CTA wording "Book Appointment" (closest SOP wording to the draft's "Book An Appointment").
- Reviews: "Rated Excellent from 286 Google reviews", the Trustindex widget on the source page.
- Hero photo: Dr Gizel Pereira at the MK reception wall (named on her scrubs). Real photos only, from Joe
  Goodchild's July 2026 shoot. No stock.
- Treatment prices from the source page: hygienist £79.80, airflow £105, fillings from £152, extractions from £131,
  whitening £350, sedation from £350.
- Meet your dentist: Dr Kishan Chavda (named most in the source page's reviews). Team carousel uses the source
  page's headshots, cropped mid-chest, first names only.

## Open checks for the client
See `facts.json` `to_confirm`.
