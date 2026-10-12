# Siha Dental — Emergency dentist LP (design)

Figma: https://www.figma.com/design/H8qdMp3qSzHTbQp49d9LVZ, page "Emergency dentist"
Frames: Desktop 1440 + Mobile 390 landing page, Desktop + Mobile thank-you page.
Source page: https://maxr155.sg-host.com/emergency-dentist/ (6 Oct 2026)
Same system as ../siha-lp-new-patient (Siha guideline + Vendo LP SOPs); common.py = shared sections.
Build: `python3 build.py`, serve on :8855, `./render.sh <height>`; Figma captures via headless Chrome.

## Decisions
- Price £49 everywhere (Hannan, 10 Oct 2026): clinical assessment, treatment plan and prescription included; X-rays and
  treatment charged separately. Fixed fees whatever the day or time; out of hours = one fixed fee (£450, fees page) whatever the problem.
- Hero clinician: Dr Abeera (Toby, 12 Oct; Dr Asiya is on maternity leave for 12 months). S-frame shows the photo only,
  cropped mid-chest up (no break-out cut-out: Hannan wants no hands/arms as some team photos are AI-generated).
  Asiya's magnification shot in "Emergency care" swapped for the consult room (suite-consult.jpg).
- Team: first names only (patients have messaged female team members); Nicholas, Ayesha, Thishock added; all photos
  mid-chest up from assets/team-chest (cropped with Apple Vision face boxes). "Meet your dentist" = "Dr Hannan", chest-up crop.
- Awards: 3 in 2024 + 5 in 2025 (Hannan); 2025 "Practice of the year, highly commended" dropped to match his count.
- Simple line icons replace the Siha logo mark in "Why patients choose us", "Same-day help" and "Why patients trust us".
- Landing page stays form-only. Thank-you page now carries Call (tel:02046023510) + WhatsApp buttons so those clicks can be
  tracked as conversions (Toby, 12 Oct 2026).
- Hook from the Siha Client Bio sheet: open Saturdays and late Tuesdays (site hours Tue 10–7, Sat 9–5).
- CTA "Book Now" (SOP-approved wording; the draft's "Get Seen Today" isn't on the list).

## Copy changes vs the draft
- "We'll see you today" softened to Siha's own wording: same-day appointments often available, aim to see you within 24 hours.
- One practice: "nearest clinic", "across our clinics", "every clinic", "four London locations", "central London" removed.
- Other-clinic template testimonials replaced with real Google reviews (Kate Barry's emergency review leads).
- "The most trusted name in dental care" replaced; out-of-hours fee added from the fees page.

## To confirm with Hannan
- WhatsApp number for the thank-you page button (placeholder href `#whatsapp-number-tbc`).
- Roles for Dr Ayesha and Dr Thishock (shown as "Dentist"; not on siha.dental yet).
- Live site still lists £49 existing / £69 new patients on the fees page: confirm £49 applies to new patients too.
- Online booking link for the thank-you page; tour video edit.

## Responsive preview
`index.html` (+ `thank-you.html`) is the live, fully responsive page: mobile layout below 1024px, desktop layout from 1024px, content capped at 1280px. Sticky header; mobile Book Now bar appears once the hero button has scrolled off and hides while the hero form is on screen; every button scrolls to the hero form. `lp-*/ty-*` stay as the fixed 1440/390 Figma capture files (the `#figmacapture` hash switches live behaviour off).
