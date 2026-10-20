# Vendo Dental Kit sections and the harness blocks

The kit (`vendo-dental-kit` v0.49.0) renders each LP section as a block. Class names are from the live Maylands
smile makeover page (19 Oct 2026). Each harness block is designed so the designers can build it on the kit block
named here. "Not in kit" means the design needs a kit addition or a one-off from the designers: say so in the
handover, never leave it implicit.

| Harness block | Kit block (class) | Holds | SOP point it covers |
|---|---|---|---|
| `header` | vdk/header (`vdk-nav`) | Logo, address, one CTA | Sticky header on mobile; no nav distractions |
| `hero_form` | vdk/hero-form (`vdk-hero`) | Eyebrow with location, priced headline, tagline, ticks, stats, brand device photo, form 1 | Priced headline + location above the fold; offer; form |
| `awards` | Not in kit (Maylands/Siha did it by hand) | Award logos, scrolling | Trust signals near the decision point |
| `usp_text` | vdk/usp-text (`vdk-usp-text`) | 4–6 short reasons with icons (kit: a scrolling text strip) | Key benefits |
| `story_cards` | vdk/story-cards (`vdk-stories`) | 3 real reviews with a treatment tag | Social proof |
| `pricing` (panel) | vdk/pricing-cards (`vdk-pcards`) | One headline price on an inverted card + "what you get" | Offer with price |
| `pricing` (cards) | vdk/pricing-cards (`vdk-pcards`) | 3 treatment cards (middle featured) + finance strip | Transparent pricing |
| `membership` | Not in kit | Plan groups (adults, children) | Value for uninsured patients |
| `google_reviews` | vdk/google-reviews (`vdk-tireviews`, Trustindex) | Score + 3 reviews (live widget on build) | Social proof |
| `form_band` | Not in kit | Mid-page form (mobile: button to hero form) | Form 2 of 3 |
| `pain_points` | vdk/pain-points (`vdk-pain`) | 6 "sound familiar" cards + bridging line | Audience pain points |
| `explainer` | vdk/treatment (`vdk-process` explainer part) | Photo, what it is, explainer card, key facts | Benefits, treatment accuracy |
| `steps` | vdk/treatment (`vdk-steps` part) | How it works, 4 steps | Process and next steps |
| `services` | vdk/services (`vdk-svc`) | 6 icon or photo cards | What's included |
| `why_us` | vdk/why-us (`vdk-why`) | 6 reasons; kit also has a founder quote | USPs, trust |
| `spotlight` | Not in kit | One clinician or differentiator with pillars | USP (e.g. orthodontist-led aligners) |
| `results` | vdk/results (`vdk-bna`) | Before-and-after carousel + disclaimer | Proof (consented cases only) |
| `meet_dentist` | Not in kit (Maylands added `vdk-meet` by hand) | Clinician photo, GDC no., quote, credentials | Clinician bio |
| `team` | vdk/team (Team post type) | First names, roles, mid-chest photos | Real people |
| `practice_tour` | vdk/practice-tour (`vdk-tour`) | Video poster + interior photos | Video tour |
| `faq` | vdk/faq (`vdk-faq`) | 6–9 questions, first open | Objection handling |
| `final_cta` | vdk/cta (`vdk-cta`) + vdk/footer | Final headline, tags, trust line, form 3, footer | Final CTA with form |
| `divider` | Not in kit (an SVG shape divider in the section settings) | The client's own wave or line SVG between two sections | Brand (e.g. Wilson House's site waves) |
| `thank_you` | Thank-you page | Confirmation, online booking, optional call/WhatsApp | Booking after submission |

Also on Maylands, built by hand in Additional CSS (not in the kit yet): mobile sticky contact bar, patient-smiles
image scroller, before-and-after slider, three-column hero with a team photo.

## What the brand layer may change
Everything visual, per section: type (headline case, weight, the emphasised word), the hero device and photo
treatment, card radius and fill, button shape, the tone each section sits in, icon style, spacing within the
section. What it may not change without a kit decision: the section's job, its required content (e.g. the form,
the disclaimer, the price), and the form/CTA rules.
