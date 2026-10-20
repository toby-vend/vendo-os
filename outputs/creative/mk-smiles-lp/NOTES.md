# MK Smiles: landing pages (design)

Built 20 Oct 2026 on the shared harness (`scripts/lp-harness/`) with `/client-landing-pages`. First page type:
new patient (Meta). Figma: "MK Smiles — Landing Pages" PSc1AHVW9d7XxsAN3sjQLa (Kana Health Group folder).

Brand: MK Smiles guideline (Figma Q67istgFgNYkRSaMFD9kCi, signed off 20 Oct 2026) and the practice's July 2026 Meta
statics. `brand.json`: Poppins SemiBold Teal headlines with the turn in Light Italic (Sage on light, Mint on Teal),
Jost caps labels in Gold, tooth M bullets in place of ticks, square real-photo frames, MK watermark at 5% in the
hero, Teal buttons on light and Mint on Teal, 6px buttons and fields, 10px cards, white / Mist / Teal rhythm.
The logo is PNG only (no vector), wrapped as SVG for the harness.

Copy sources, in order: Toby's Meta draft lp.mksmiles.co.uk/new-patients-offer-meta (live; listed in the
"VD | Ad Landing Pages" sheet, tab KHG - MK Smiles), mksmiles.co.uk/prices and /membership-plan (20 Oct 2026).
Every price is in `facts.json`. Build: `python3 make_pages.py`, then from `scripts/lp-harness/`: `build.py`,
`lint.py` (0 failures), `render.sh`. Brand spec sheet: `python3 brand_spec.py` after building `brand-spec`.

## Phase 1 (brand spec), awaiting Toby
Figma page "Brand spec": palette + type sheet, desktop 1440 and mobile 390 of the new patient hero, USP strip
(Teal), pricing panel (Mist) and the mid-page form band (Teal).

## Decisions so far
- Hero price £50, usually £76.70 (the draft's price stands; the fees page agrees on £50 for the adult assessment).
- CTA wording "Book Appointment" (closest SOP wording to the draft's "Book An Appointment").
- Review line 4.8 from 295 Google reviews (Google, 20 Oct 2026), not the draft's "5 stars from 230+".
- Hero photo: Dr Gizel Pereira at the MK reception wall (named on her scrubs). Real photos only, from Joe
  Goodchild's July 2026 shoot. No stock.
- Left off until confirmed: airflow, fillings and extraction prices (draft and fees page disagree).

## Open checks for the client
See `facts.json` `to_confirm`.
