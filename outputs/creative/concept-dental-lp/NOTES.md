# Concept Dental: landing pages (design)

Built 19 Oct 2026 on the shared harness (`scripts/lp-harness/`) as the pilot for `/client-landing-pages`.
Pages: new patient check-up, emergency dentist, smile makeover (smile makeover isn't on the Media Plan; Toby asked
for all three). Desktop 1440 + mobile 390 + thank-you pages each, plus the responsive `index.html` preview.

Brand: Concept Dental guideline (Figma Sb4b57cWr7haaEpyW4ftP2). `brand.json` carries Montserrat Light sentence-case
headlines with the italic turn, arch photo frames on a Soft Dune backdrop, the CD monogram watermark (hero, why us,
final CTA), the hairline five-step timeline, the founding-patient seal, Coffee pill buttons with an arrow, square
cards, Vanilla / Soft Dune / Coffee rhythm.

Copy sources: conceptdental.co.uk read 19 Oct 2026 (home, fees, dental-examination, emergency-dentist,
smile-makeover, meet-the-team). No draft on the LP theme. Every price is in `facts.json` with its source.
Build: `python3 make_pages.py`, then from `scripts/lp-harness/`: `build.py`, `lint.py` (0 failures), `render.sh`.

## Decisions
- CTA wording: "Book Now" (new patient, emergency), "Book Consultation" (smile makeover). The guideline's
  "Reserve your place" is ad wording and isn't on the LP SOP list.
- Form only. The site pushes "call rather than book online if in pain" for emergencies; the LP stays form-only and the
  emergency thank-you page has online booking only until the client asks for call/WhatsApp buttons (then tracked).
- Left out, not faked: patient stories and Google reviews (no reviews yet, new practice), awards (the site's
  "award-winning dentist" line has no award named), before-and-after results (the site's smile gallery uses
  Shutterstock images), the team carousel (two dentists, shown as Meet your dentist instead).
- Founding-patient seal on the new patient page only: £25 check-up + X-rays, usually £50 (fees page; offer live per
  Toby, 19 Oct 2026).
- Finance: the site's wording only ("flexible finance options"); no terms, no monthly figures.

## Photos: STOCK to replace (Toby, 19 Oct 2026: stock where it helps, flag what to get)
| Where | Current image (from the website) | Status | Shot to get |
|---|---|---|---|
| Hero, meet your dentist (new patient, emergency) | dr-zain-concept-dental.jpg | Confirm real | Dr Zain, chest-up, warm light, plain wall or the reception alcove |
| Hero, spotlight, meet your dentist (smile makeover) | dr-anas-ashekhi-concept-dental.jpg | Confirm real | Dr Anas, chest-up, same set-up |
| Pricing photo, implants card | dentist-xray-review-concept-dental.jpg | Likely generated | Dentist showing a patient their scan on screen |
| First visit (explainer), check-ups card | dentist-consultation / dentist-treatment-concept-dental.jpg | Likely generated | Unhurried consultation in the surgery, eye level, patient smiling |
| Emergency pricing, emergency card | dentist-treating-patient.jpg | STOCK | Dentist treating, no instruments in the mouth, calm |
| Emergency explainer | young-woman-with-toothache…jpg | STOCK | Patient in the chair being reassured (or keep stock: it's illustrative) |
| Smile makeover explainer, cosmetic card | woman-admiring-her-healthy-white-smile…jpg | STOCK | Real patient smile with consent, or a natural smile in the mirror |
| Aligners card | pair-of-clear-plastic-orthodontic-aligners…jpg | STOCK | Fine as product shot; or the practice's own aligner case |
| Nervous patients card | serene-young-woman…jpg | STOCK | Calm patient in the reception or lounge |
| Practice tour poster + gallery | reception-waiting-area, front-desk, waiting-area, surgery-green-wall, dentist-talking-with-patient | STOCK (per the guideline) | Reception, the arched alcoves, waiting area, each surgery, exterior on Toton Lane, a 60–90s landscape tour video |
| (missing) Before and afters | none | Need consent | Consented cases from the practice, per treatment |
| (missing) Team | two dentists only | | Whole team, first names, chest-up |

## To confirm with the client
- Composite bonding £300 and E.max veneers £695: per tooth?
- Finance: provider and terms.
- Founding-patient wording: "exam + digital scan" (guideline) vs "check-up including all X-rays" (fees page); "first 100 patients".
- Which site photos are real (dentist portraits, the "concept-dental" clinic shots) and which are generated or stock.
- The smile gallery's "Real Results" shows Shutterstock images: worth raising with the client (ASA risk on their site).
- Call/WhatsApp buttons on the emergency thank-you page?
- Opening hours as stated on the site (Mon–Fri 9–6, Sat–Sun 10:30–3) and weekend/out-of-hours emergency cover.

## When reviews and photos exist
Add `story_cards` and `google_reviews` back into the recipes (see `data/playbooks/landing-pages/page-types.md`), and
a `results` carousel once consented before-and-afters are on Drive.
