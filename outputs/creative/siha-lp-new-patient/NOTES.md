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
- Membership: this page says Smile £19.56/m and "plans from £22.50/month"; the live site says £18.28/m. Confirm.
- 0% finance over 12 months, "same-week appointments" and "all major insurances accepted" need confirming.
- Award logos used: PDA 2025 winner (Brand & Design, Patient Care), Dentistry Awards 2025 winner (Team of the Year London),
  PDA 2025 highly commended (Practice of the Year), PDA 2024 highly commended (New Practice).
- Tracking (GTM, form + call conversions) and the LP tracker/brief steps are for the build stage.
