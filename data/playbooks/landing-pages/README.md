# Landing pages playbook

Read this before designing any client landing page (LP). It is what `/client-landing-pages` follows, and it is in
git so everyone running the skill works to the same rules. Sources: the Drive SOPs (below), the Siha build
(Oct 2026), the Maylands LPs on the Vendo Dental Kit, and Toby's corrections along the way.

**Where the pages end up.** LPs are built by the designers on WordPress with `vendo-theme` + `vendo-dental-kit`
(the LP section library, v0.49.0 on lp.maylandsdentalpractice.co.uk). Dilith owns the kit. Our job is the design
in Figma, built on the kit's sections and branded to the client, plus the review pack and the handover.
`~/vendo-kit` (github vendo-digital-temp/vendo-kit) is the separate full-website framework; borrow its discipline
(every value is a named setting, mobile follows rules) but it is not the LP system.

## Drive SOPs (read the source if in doubt)
- Ad Landing Page Checklist SOP: Drive 1A_5Jk5N4UMsSUMajrm7-3DEmdvS9q5T0 (+ checklist sheet 16QMkkfvP-Q1Uc-U5iR37T3mLWi48qQUuA4aRXKa-NsE)
- Web Design QA Checklist & Scorecard: Doc 1ISjNtbMMaywUswsJ3HwUp9KRDuijsx98iIkSOLacrTo (ship at ≥85% with no ★ fails)
- Web > Landing Pages folder 1xE6vNAPTg3WA21S_rTICCrAkC_CWJ4xr: LP Template Framework, Landing Page Checklist, LP Process, Dental LP Templates

## Rules (fixed; Toby's overrides of the SOP are marked)
**Offer and headline**
- Direct, priced headline with the location above the fold ("Oral health assessment £89", "Emergency dentist £49").
- The hero price is the one Toby set on his draft. Keep it and make the rest of the page match. A price the client has
  confirmed directly beats both. Flag conflicts with the client's fees page in NOTES.md; never swap silently.
- Every £ figure on a page must be in `facts.json` with its source. The content check enforces this.
- Urgency only when an offer is genuinely live (override: the SOP says "create urgency"). No expired countdowns.

**CTA and forms**
- One unified CTA wording per page, from: Book Now, Book Appointment, Book Consultation. Never "Book Online".
- The form is the only CTA (override: the SOP's "single prominent phone number"). No call buttons, "or call" lines,
  click-to-call icons, phone numbers in nav or footer, or WhatsApp on the LP. Every button scrolls to the hero form.
- Call and WhatsApp buttons may go on the thank-you page, only when the client asks, so those clicks can be tracked.
- Forms in three places: hero, mid-page, final. Mobile swaps the mid-page form for one button back to the hero form.
- Keep forms short (name, email, mobile; first/last name only if the client's CRM needs it). Privacy line under the button.
- The thank-you page confirms the request and offers online booking (needs the client's booking link).

**Proof and trust**
- 3–4 real testimonials (Google reviews already on the client's page or profile), trust logos, award logos, the
  clinician's bio with GDC number. Never another clinic's template testimonials.
- Before-and-afters only from consented cases: the client's own Drive or published smile gallery. Disclaimer line always.
- Team: first names only; photos mid-chest up (`tools/team_crop.py`). Some team photos are AI-extended below the chest.

**Claims (healthcare, ASA/GDC)**
- No unverifiable superlatives ("the most trusted name", "the best").
- "Specialist" only for clinicians on the GDC specialist list; otherwise "special interest in" or "experience".
- Finance: the client's own wording (provider, term, threshold); no monthly repayment figures (FCA).
- No guaranteed outcomes. No sedation promises beyond what the client offers.

**Imagery and design**
- The client's own photos and video from their Drive or website first. If the client has no photography yet (a new
  practice), use stock where it helps the page, mark every stock slot in NOTES.md, and give a shot list of the real
  photos to get (Toby, 19 Oct 2026). Real photos replace stock as soon as they exist.
- Brand from the signed-off guideline (`/client-meta-statics` Phase 1), not just its colours: headline style, the
  graphic device, photo treatment, shapes and the light/dark rhythm all go in `brand.json` (see the harness README).
- Desktop 1440 and mobile 390 frames, plus the responsive `index.html` preview. Sticky header on mobile; a Book Now
  bar once the hero button has scrolled off.
- A video tour slot (poster + play). Awards as a scrolling strip.

**Copy**
- UK English, no em dashes, the client's own words for prices and terms.
- Template leftovers fail the check: other clinics' names, "clinics" plural for a single site, "Vendo Whitening",
  empty prices ("from  a month"). See `template-leftovers.txt`.

**Tracking (handover note, built by the designers)**
- GTM on the page; conversion = form submit (and thank-you page call/WhatsApp clicks if present). Clarity installed.
- Account manager reviews performance 2 and 7 days after launch (SOP).

## Files
- `kit-sections.md`: the kit's blocks, what each holds, and how SOP points map to them
- `page-types.md`: section recipes for new patient, emergency and smile makeover
- `template-leftovers.txt`: phrases the content check fails or warns on
- Harness: `scripts/lp-harness/` (README there)
