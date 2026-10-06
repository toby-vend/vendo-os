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

## To confirm with Hannan
- That the smile-gallery consent covers paid ads use.
- Online booking link for the thank-you page; tour video edit (Drive > Video - Clinic Interior).
- FAQ answers for the collapsed items follow the draft with the price fixes above.

## Responsive preview
`index.html` (+ `thank-you.html`) is the live, fully responsive page: mobile layout below 1024px, desktop layout from 1024px, content capped at 1280px. Sticky header; mobile Book Now bar appears once the hero button has scrolled off and hides while the hero form is on screen; every button scrolls to the hero form. `lp-*/ty-*` stay as the fixed 1440/390 Figma capture files (the `#figmacapture` hash switches live behaviour off).
