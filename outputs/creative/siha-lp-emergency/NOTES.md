# Siha Dental — Emergency dentist LP (design)

Figma: https://www.figma.com/design/H8qdMp3qSzHTbQp49d9LVZ, page "Emergency dentist"
Frames: Desktop 1440 + Mobile 390 landing page, Desktop + Mobile thank-you page.
Source page: https://maxr155.sg-host.com/emergency-dentist/ (6 Oct 2026)
Same system as ../siha-lp-new-patient (Siha guideline + Vendo LP SOPs); common.py = shared sections.
Build: `python3 build.py`, serve on :8855, `./render.sh <height>`; Figma captures via headless Chrome.

## Decisions
- Price £95 everywhere, per Toby (the draft mixed £95 and £49).
- Hero clinician: Dr Asiya (endodontics, cut-out over the S-frame); Dr Hannan in "Meet your dentist".
- Hook from the Siha Client Bio sheet: open Saturdays and late Tuesdays (site hours Tue 10–7, Sat 9–5).
- CTA "Book Now" (SOP-approved wording; the draft's "Get Seen Today" isn't on the list). The thank-you page leads with the phone.

## Copy changes vs the draft
- "We'll see you today" softened to Siha's own wording: same-day appointments often available, aim to see you within 24 hours.
- One practice: "nearest clinic", "across our clinics", "every clinic", "four London locations", "central London" removed.
- Other-clinic template testimonials replaced with real Google reviews (Kate Barry's emergency review leads).
- "The most trusted name in dental care" replaced; out-of-hours fee added from the fees page.

## To confirm with Hannan
- £95: Siha's fees page lists the emergency appointment at £49 (existing patients) / £69 (new patients), and the
  treatment page says £49. The live site needs to match £95 before ads run.
- The out-of-hours £450 (assessment + treatment) line is from the fees page; confirm it should show on the LP.
- Online booking link for the thank-you page; tour video edit.
