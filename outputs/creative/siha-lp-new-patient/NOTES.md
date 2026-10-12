# Siha Dental — New patient check-up LP (design)

Figma: https://www.figma.com/design/H8qdMp3qSzHTbQp49d9LVZ (Siha Dental folder)
Frames: Desktop 1440 + Mobile 390 landing page, Desktop + Mobile thank-you page.
Source page: https://maxr155.sg-host.com/new-patient-check-up/ (6 Oct 2026)
Built from: Siha brand guideline (Figma AbtwUHTD50G38QuOaCG4Hh) + Vendo LP SOPs on the Shared Drive
(Ad Landing Page Checklist SOP, LP Template Framework, LP Checklist, LP Process, Web Design QA Scorecard).

## Build
`python3 build.py` writes lp-*.html and ty-*.html; `./render.sh <height>` renders them (serve this folder on :8853).
Photos/awards/cut-out are pulled from the Siha Drive and gitignored.

## SOP points applied
- Direct, priced headline with location above the fold; one unified CTA ("Book Now") and one phone number, repeated.
- Sticky header on mobile with click-to-call.
- Forms: hero, mid-page and final; four fields only; privacy line.
- Social proof: 3 patient stories + 3 Google reviews, 5.0 rating, award logos, clinician bio.
- Process (how it works), FAQ, practice tour video slot.
- Thank-you page confirms the request and offers online booking.
- No unverifiable superlatives ("the most trusted name" removed).

## Copy changes vs the live page
- Patient stories: template quotes tagged Marylebone/Mayfair/King's Cross replaced with real Google reviews from the page.
- £95 in the FAQ corrected to £89 (Hannan, 2 Oct call).
- "Choose your nearest clinic" / "across all our clinics" / "across every clinic" reworded for one practice.
- Empty tour-video slot replaced with a video block + gallery.

## For the build / to confirm with Hannan
- Tour video: source clips in Siha Drive > Video - Clinic Interior (vertical); needs a landscape edit for the desktop slot.
- Thank-you "Choose a time online" needs Siha's online booking link.
- Membership: siha.dental/fees-and-finance confirms Smile £19.56/m (6 Oct 2026); the draft's "plans from £22.50/month" corrected to £19.56.
- 0% finance over 12 months, "same-week appointments" and "all major insurances accepted" need confirming.
- Award logos used: PDA 2025 winner (Brand & Design, Patient Care), Dentistry Awards 2025 winner (Team of the Year London),
  PDA 2025 highly commended (Practice of the Year), PDA 2024 highly commended (New Practice).
- Tracking (GTM, form + call conversions) and the LP tracker/brief steps are for the build stage.

## Responsive preview
`index.html` (+ `thank-you.html`) is the live, fully responsive page: mobile layout below 1024px, desktop layout from 1024px, content capped at 1280px. Sticky header; mobile Book Now bar appears once the hero button has scrolled off and hides while the hero form is on screen; every button scrolls to the hero form. `lp-*/ty-*` stay as the fixed 1440/390 Figma capture files (the `#figmacapture` hash switches live behaviour off).

## Hannan's feedback (email 10 Oct 2026), applied 12 Oct 2026
- "Oral health assessment", never "check-up": hero, forms, pricing, FAQ, final CTA, thank-you page. £89, small X-rays included.
- Assessment section: goals-led plan (short- and long-term), prevention before cure; holistic card (gum disease *linked to*
  cardiovascular disease, diabetes, Alzheimer's). Mercury-free + BPA-free fillings (key facts, services, why-Siha);
  sedation for nervous patients (hero, why-choose, familiar card, new FAQ).
- Membership split into Adults (Smile, Smile Plus) and Children (Smile Child under 12, Smile Plus 13–17) with an
  "Under 6s free" note (parent registered and attending regularly). Plan inclusions from siha.dental/fees-and-finance (12 Oct).
- Awards: 8 (3 in 2024, 5 in 2025) from the Drive Awards PNGs; PDA 2025 Practice of the Year (highly commended) dropped
  so the strip matches Hannan's count. Hero stat now "8 award wins".
- Simple line icons replace the Siha S-mark in "Why patients choose us" and "Why patients trust us with their smiles".
- Team: 12 people incl. Dr Nicholas, Dr Ayesha, Dr Thishock; first names only; every photo cropped mid-chest up
  (assets/team-chest, face-detected crops). Hero cut-out and "Meet your dentist" photo also cropped to mid-chest.

## To confirm with Hannan (from this round)
- Roles for Dr Ayesha and Dr Thishock (shown as "Dentist"; not on siha.dental yet).
- Sedation type to name (left generic).
- Child plan age bands: site says Smile Child "under 12" and Smile Plus "13–17" (12-year-olds not covered by either).
- Root canal service card photo shows Dr Asiya (on maternity leave); swap if Hannan prefers.
- Figma frame names still read "New patient check-up | …" to match the existing frames/URL slug.
