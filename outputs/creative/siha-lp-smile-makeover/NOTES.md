# Siha Dental — Smile makeover LP (design)

Figma: https://www.figma.com/design/H8qdMp3qSzHTbQp49d9LVZ, page "Smile makeover"
Frames: Desktop 1440 + Mobile 390 landing page, Desktop + Mobile thank-you page.
Source page: https://maxr155.sg-host.com/smile-makeover/ (6 Oct 2026)
Built the same way as ../siha-lp-new-patient (Siha guideline + Vendo LP SOPs). common.py is a copy of that page's
sections; sections.py holds this page's content.

## Build
`python3 build.py`, serve this folder on :8854, `./render.sh <height>`.
Figma captures run in headless Chrome (no focus stealing): scratchpad hcap.sh pattern, see git history.

## Copy changes vs the draft (prices checked on siha.dental, 6 Oct 2026)
- Hero: "from £395 per tooth" replaced by a free-consultation headline + "treatments from £250 a tooth".
- Bonding £250 a tooth (edge) / £295 full surface; veneers £995 a tooth; no "minimum 6 teeth" anywhere.
- Clear aligners £2,195 from (treatment under 3 months, after the 1 Oct £200 rise); draft inclusions
  (whitening worth £595, retainers worth £395/arch, Diamond provider) removed: not on Siha's site.
- Whitening unpriced (Siha's whitening prices are marked limited-time); "Vendo Whitening" removed.
- Finance: Siha's own wording (Tabeo, up to 12 months, over £300, instant decision); no monthly figures (FCA);
  "approval for all patients" removed.
- Bond Dental carry-over removed: 4 London locations, "whichever clinic", £0 deposit line, other-clinic testimonials.
- "Smile design specialists" -> "Smile design experience" (GDC specialist title); "most trusted name" removed.
- Gum contouring removed (not a listed Siha treatment); ICON (£395 up to two teeth) added in its place.
- Before & after: 4 cases from siha.dental/smile-gallery (P15, P14, P9, P11), per Toby.

## Hannan's feedback (email 10 Oct 2026), applied 12 Oct
- Awards banner: "3 awards in 2024 · 5 in 2025". 2025 winners: PDA practice brand & design, PDA patient care, DA team of the year London,
  DA website of the year London, DA overall winner website of the year. 2024: PDA brand & design (South), PDA website of the year (London),
  plus the existing PDA 2024 new practice highly-commended badge. PDA 2025 practice-of-the-year (highly commended) dropped to match his count.
  Hero stat now "5 · 2025 award wins".
- Orthodontist-led aligners: new dark section after pricing (Dr Abeera, Specialist Orthodontist; more predictable / safer / faster,
  no never-ending adjustments), plus a line on the aligners price card and the building-blocks card.
- Refundable deposit: form card line, a deposit card in the consultation section (desktop + mobile), second FAQ (shown open),
  final CTA copy. No amount shown.
- Simple line icons (icons.py) replace the Siha mark in "Why patients choose us", "What can your makeover include?" and
  "Why patients trust us with their smiles".
- Team: Dr Nicholas, Dr Ayesha, Dr Thishock added; first names only everywhere; every team photo cropped mid-chest up
  (assets/team-chest, face-detected crops). Hero cut-out reframed to mid-chest and clipped at the frame bottom; "Meet your dentist"
  uses a mid-chest crop (assets/photos/hannan-chest.jpg). "The treatment" photo (two team members, full length) swapped for the
  empty consult room (suite-consult.jpg).

## To confirm with Hannan
- Deposit amount (not shown on the page) and exact refund terms wording.
- Roles for Dr Ayesha and Dr Thishock (shown as "Dentist"; they aren't on siha.dental yet).
- That "planned and led by our specialist orthodontist" applies to every aligner case.
- That the smile-gallery consent covers paid ads use.
- Online booking link for the thank-you page; tour video edit (Drive > Video - Clinic Interior).
- FAQ answers for the collapsed items follow the draft with the price fixes above.

## Responsive preview
`index.html` (+ `thank-you.html`) is the live, fully responsive page: mobile layout below 1024px, desktop layout from 1024px, content capped at 1280px. Sticky header; mobile Book Now bar appears once the hero button has scrolled off and hides while the hero form is on screen; every button scrolls to the hero form. `lp-*/ty-*` stay as the fixed 1440/390 Figma capture files (the `#figmacapture` hash switches live behaviour off).
