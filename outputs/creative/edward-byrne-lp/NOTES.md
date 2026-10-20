# Edward Byrne Associates: landing pages (design)

Built 20 Oct 2026 on the shared harness (`scripts/lp-harness/`) with `/client-landing-pages`, matched to the MK Smiles
build (Kana sister practice). First page type: new patient (Meta). Figma: "Edward Byrne Associates — Landing Pages"
X8SCuho643YKYYIasWHk3F (Kana Health Group folder).

Brand: Edward Byrne guideline (Figma hR3IRDkgBzuJoYycZ2qTe4, harness `outputs/creative/edward-byrne-meta-statics/`),
the practice's July 2026 Meta statics and edwardbyrne.com. `brand.json`: Byrne Black hero and inverted bands (as the
statics run), Poppins SemiBold headlines with an italic turn (Plum on light, Gold on Black), Jost caps labels (Plum
on light, Gold on Black), the Kana crown in place of ticks and before section labels, Gold hairline outlined cards,
square photos (the site's square photo tiles) with an offset Gold hairline frame on the hero photo, crown watermark,
Gold buttons with Black text and 4px corners (as the site and statics), white / Cream / Black rhythm. The logo is PNG
only (Drive Logos folder is empty), wrapped as SVG for the harness.

Source of truth: Toby's Meta draft lp.edwardbyrne.com/new-patients-offer-meta (read 20 Oct 2026). The Google draft
lp.edwardbyrne.com/new-patients-offer is the same page: same £60 offer, inclusions and copy; it only adds the phone
number in the header and between sections, and a "Book Now" button. Other prices from edwardbyrne.com/prices, plan
detail from edwardbyrne.com/membership-plans. Every price is in `facts.json`.
Build: `python3 make_pages.py`, then from `scripts/lp-harness/`: `build.py`, `lint.py` (0 failures), `render.sh`.
Brand spec sheet: `python3 brand_spec.py` after building `brand-spec`.

## Pages in Figma
Node ids: Brand spec page 0:1 (sheet 5:4, desktop 6:4, mobile 4:4); New patient page 1:2 (desktop 14:4, mobile 13:4,
thank-you desktop 3:4, thank-you mobile 2:4). Captured 20 Oct 2026, auto layout stripped.
- "Brand spec": palette + type sheet, desktop and mobile of the hero, USP strip, pricing panel and form band.
- "New patient": desktop 1440, mobile 390 and both thank-you frames. Sections: header, hero + form (offer seal £60),
  USP strip, patient stories, pricing panel, membership (Denplan Essentials A/B/C), Google reviews, form band, pain
  points, what's included, four steps, services, why us, opening hours spotlight, meet your dentist (Dr Neeta Mehta),
  dentist carousel (first names), practice tour (YouTube poster), FAQ, final CTA + form, footer.
- Left out:
  - Awards strip: the site's logo row is the Kana sister practices (Oxford House, MK Smiles, Wilson House, Woburn
    Sands, The Academy), not awards. Denplan Excel accreditation is in why us and under the plans instead (no logo file).
  - Before-and-afters: none on the draft or the site.
  - Phone numbers and call buttons (LP rule: form only). The draft's "Whether you call or book online" and "call the
    practice" lines were rewritten.
  - The draft's photo of a dentist with a patient (patient consent unknown).
  - Diane Bate's Google review (it carries a negative line about the practice).

## Decisions so far
- Hero price £60 ("New Patient Check Up Only £60" on the draft). The fees page agrees (New Patient Assessment, Adult
  £60.00). No "was" price exists, so the seal has none.
- CTA wording "Book Appointment" (closest SOP wording to the draft's "Schedule An Appointment").
- Reviews: "Rated Excellent from 287 Google reviews", the draft's Trustindex widget (see open checks for 413).
- Meet your dentist has no quote attributed to Dr Neeta (none published); it is plain practice copy. GDC 82463 is from the team page and the draft (GDC register not checked).
- Hero photo: Dr Smita at the villa's front door (shoot p8). Meet your dentist: Dr Neeta Mehta at the door (p12).
  Both are matched by face to the named headshots on the draft; nobody wears a badge.
- Team carousel: the five dentists on the draft with their draft headshots, cropped mid-chest, first names only,
  all titled "Dentist". Hygienists and nurses have no matched headshots, so they are mentioned, not pictured.
- Services photos are unnamed team members in the surgeries and the reception's Invisalign/Enlighten display.
- Treatment prices from the fees page: hygiene from £68.50, fillings from £89.50, whitening from £299, new patient
  emergency £85. Loyalty rate £47.50 and plans from £9.25 from the draft.
- Saturday hours say "selected Saturdays" (the site says alternate Saturdays; the draft lists every Saturday).

## Open checks for the client
See `facts.json` `to_confirm`.
