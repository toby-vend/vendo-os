"""Woburn Sands page recipes for the shared LP harness.

Source of truth (Toby's draft for the Meta campaign, read 20 Oct 2026):
lp.woburnsandsdentalpractice.co.uk/new-patients-offer-meta. The offer (new patient check-up £85 including X-rays),
what's included, the hygiene price, the Google reviews and the opening hours come from it. Everything else is from
woburnsandsdentalpractice.co.uk (fees, membership, team, about, smile gallery), read the same day. Every price is in
facts.json; conflicts and open checks are in NOTES.md.
Photos: Joe Goodchild's July 2026 shoot (from the guideline harness), team crops matched to the site's own
headshots, and before-and-afters from the practice's published smile gallery. All media in assets/ is gitignored.
Pages: brand-spec (Phase 1 sections) and new-patient (full page).
Run: /usr/bin/python3 make_assets.py once, then python3 make_pages.py, then build.py from scripts/lp-harness.
"""
import json
from pathlib import Path

P = "assets/photos/"
T = "assets/team/"
CROWN_RULE = '<img src="assets/crown-rule-{c}.png" alt="" style="display:block;width:{w}px;margin-bottom:22px">'
# Hero: a clinician from the July shoot at the practice's trees (portrait 1012x1800, nobody named beside it)
HERO_PHOTO = {"src": P + "p1.jpg", "w": 1012, "h": 1800, "rows": [40, 1740], "cx": 506}

FORM = {"fields": [{"label": "Full name", "full": True}, "Email", "Mobile"]}
NP_FORM = {"label": "New patient offer", "title": "Book your check-up",
           "sub": "New patients welcome, for you or your family.",
           "note": "£85 new patient check-up, X-rays included."}
TY = {"text": "Thank you. Our team will be in touch to confirm your check-up. If you’d rather pick a time yourself, you can book online now.",
      "buttons": [{"label": "Choose a time online", "href": "{{booking_url}}", "style": "primary"}]}

HERO = {"block": "hero_form", "eyebrow": "New patients welcome · Woburn Sands, Milton Keynes",
        "title": "New patient<br>check&#8209;up, <b>only £85.</b>",
        "tagline": "Need a new private dentist in Milton Keynes?",
        "sub": "A thorough check-up and a clear, personalised plan from a friendly local team who take the time to listen.",
        "ticks": ["Full dental examination", "X-rays included", "Oral cancer screening", "Personalised plan"],
        "ticks_m": ["Full dental examination", "X-rays included"],
        "trust": "Rated {{rating}} from {{review_count}} Google reviews",
        "stats": [["{{rating}}", "Google rating"], ["{{review_count}}", "Google reviews"], ["8am", "Weekday starts"]],
        "stats_m": [["{{rating}}", "Rating"], ["{{review_count}}", "Reviews"], ["8am", "Weekdays"]],
        "photo": HERO_PHOTO, "device_gap_m": 96,
        "seal": {"top": "New patients", "price": "£85", "bottom": "Check-up + X-rays"}}
USP = {"block": "usp_text", "hide_m": False, "label": "Why families choose Woburn Sands", "items": [
    ["person", "A kind, caring team who explain everything clearly"],
    ["card", "Transparent pricing, with no pressure"],
    ["heart", "Nervous patients welcome"],
    ["pin", "Ground-floor surgeries on Theydon Avenue"]]}
PRICING = {"block": "pricing", "layout": "panel", "eyebrow": "Pricing", "title": "Clear prices, <b>no surprises.</b>",
           "sub": "You’ll leave with clear recommendations and full cost transparency, and a plan with no pressure.",
           "price_label": "New patient check-up", "price": "£85", "price_note": "X-rays included",
           "notes": ["Hygiene appointments from £81.20.", "Children’s new patient assessment £25 · Fillings from £132.30 · Extractions from £131.30."],
           "photo": {"src": P + "s10.jpg", "pos": "50% 55%"},
           "get": [["A full dental examination", "We assess your teeth, gums, bite and soft tissues to spot any concerns early"],
                   ["Health and oral cancer screening", "A thorough check for early signs of gum disease, alongside a soft tissue screening"],
                   ["Digital X-rays when needed", "Safe, high-quality imaging to spot hidden issues, at no additional cost"],
                   ["Your personalised treatment plan", "Clear recommendations and full cost transparency, with no pressure"]]}
FORM_BAND = {"block": "form_band", "name": "Book your check-up (form 2)", "eyebrow": "New patient offer",
             "title": "Your family dentist, <b>in Woburn Sands.</b>",
             "sub": "Book your £85 new patient check-up, with X-rays included, at a practice families have trusted for years.",
             "ticks": ["Full examination and X-rays", "Nervous patients welcome", "For adults and children", "Clear pricing upfront"],
             "form_title": "Book your check-up"}

STORIES = {"block": "story_cards", "title": "Looked after <b>for years.</b>", "sub": "Don’t just take it from us. Here’s what our patients say about their care.", "items": [
    ["Extraction", "Very good. I had an extraction done by Simone who was very kind and patient with me. She explained exactly what she was going to do. No problems encountered then or afterwards.", "Sheila Read"],
    ["Long-standing patient", "I’ve been a patient at this Practice for more years than I care to remember. I’ve never had an issue. I always feel that I’m valued and not just a number.", "Mark Summers"],
    ["Routine care", "Been using Woburn Dental practice for many years, never had any issues, very professional, everyone is friendly.", "Dave"]],
    "cta": False}
MEMBERSHIP = {"block": "membership", "eyebrow": "Membership plans", "title": "Spread the cost of <b>routine care.</b>",
              "sub": "Regular check-ups and hygiene visits on a small monthly fee, with X-rays included and 10% off further private treatment. Your dentist suggests the plan that suits you.",
              "groups": [{"label": "Adult plans", "sub": "From £8.60 a month", "plans": [
                  {"name": "Option A", "price": "£8.60", "who": "2 check-ups a year", "featured": False,
                   "feats": ["2 dental examinations a year", "X-rays included", "10% off further private treatment"]},
                  {"name": "Option B", "price": "£19.25", "who": "2 check-ups, 2 hygiene visits", "featured": True,
                   "feats": ["2 dental examinations a year", "2 hygiene appointments a year", "X-rays included", "10% off further private treatment"]},
                  {"name": "Option C", "price": "£29.45", "who": "2 check-ups, 4 hygiene visits", "featured": False,
                   "feats": ["2 dental examinations a year", "4 hygiene appointments a year", "X-rays included", "10% off further private treatment"]}]}],
              "small": "Also available: Option D, £9.60 a month for 1 examination and 1 hygiene appointment a year, and children’s plans. Ask the team when you visit."}
REVIEWS = {"block": "google_reviews", "sub": "Real reviews from Woburn Sands patients, posted on Google.", "items": [
    ["Sally Connelly", "I got seen promptly and my treatment was efficient and sympathetically done."],
    ["Liz Whitelegg", "Very professional &amp; expert treatment."],
    ["Joan Barbara Nielsen", "Confident and happy with treatment."]]}
PAIN = {"block": "pain_points", "title": "Looking for a dentist <b>you can stay with?</b>",
        "sub": "Whether you’re new to the area, overdue a check-up or simply want a practice that takes time to explain things, you’re in the right place.",
        "items": [["You’ve just moved to the area", "You want a friendly, well-reviewed practice close to home for you and your family."],
                  ["You’re overdue a check-up", "Regular check-ups help spot concerns early, before they become harder to treat."],
                  ["You’re nervous about the dentist", "We take the time to listen to your questions and explain everything, so you feel at ease."],
                  ["You want to know the cost first", "Clear recommendations and full cost transparency, with no pressure."],
                  ["You need a practice for the whole family", "Family dentistry for adults and children, all under one roof."],
                  ["Something doesn’t feel quite right", "Emergency appointments are available if you need to be seen sooner."]],
        "close": "Your check-up is a <b style=\"font-weight:600\">thorough look at your oral health</b>, followed by a plan built around you."}
EXPLAINER = {"block": "explainer", "name": "What’s included", "photo": {"src": P + "s24.jpg", "pos": "50% 40%"},
             "eyebrow": "What’s included", "title": "A proper check-up, <b>explained clearly.</b>",
             "text": "We assess your teeth, gums, bite and soft tissues, take digital X-rays where needed and include a high-precision 3D digital scan, then talk you through everything we find.",
             "card": {"title": "Time to talk", "text": "We take the time to listen to your questions and explain everything clearly, so you feel completely at ease before anything goes ahead."},
             "facts": ["Full examination", "Oral cancer screening", "Digital X-rays", "3D digital scan"]}
STEPS = {"block": "steps", "eyebrow": "What happens next", "title": "Your check-up, <b>step by step.</b>", "items": [
    ["Book your appointment", "Send us your details and our team will arrange a time that suits you."],
    ["Visit us for your check-up", "A full examination, screening and X-rays where needed, in our ground-floor surgeries."],
    ["Talk it through", "We explain what we’ve found and answer your questions, with prices upfront."],
    ["Your treatment plan", "Clear advice and a tailored plan to keep your smile healthy."]]}
SERVICES = {"block": "services", "style": "photo", "eyebrow": "Our care", "title": "Care for the whole family, <b>under one roof.</b>",
            "sub": "Modern dentistry in a calm, friendly setting, from routine check-ups to cosmetic and implant care.",
            "items": [{"title": "Check-ups &amp; X-rays", "text": "A full examination with X-rays included, £85 for new patients.", "photo": {"src": P + "s13.jpg", "pos": "50% 50%"}},
                      {"title": "Hygiene &amp; Airflow", "text": "Hygiene appointments from £81.20, with Airflow stain removal if applicable.", "photo": {"src": P + "s40.jpg", "pos": "50% 40%"}},
                      {"title": "Family dentistry", "text": "Care for adults and children. Children’s new patient assessment £25.", "photo": {"src": P + "s25.jpg", "pos": "50% 40%"}},
                      {"title": "Fillings &amp; extractions", "text": "Fillings from £132.30 and extractions from £131.30, explained before treatment.", "photo": {"src": P + "s31.jpg", "pos": "50% 40%"}},
                      {"title": "Teeth whitening", "text": "Professional teeth whitening from £350.", "photo": {"src": P + "s29.jpg", "pos": "50% 40%"}},
                      {"title": "Implants &amp; Invisalign", "text": "Implant consultations £145 and Invisalign consultations £110.", "photo": {"src": P + "s33.jpg", "pos": "50% 35%"}}]}
RESULTS = {"block": "results", "eyebrow": "Smile gallery", "title": "Real smiles, <b>real patients.</b>",
           "sub": "A few of the cases from our own smile gallery: teeth whitening, Invisalign and dental implants.", "ratio": 0.814,
           "items": [["assets/ba/whitening-1.jpg", "Teeth whitening"], ["assets/ba/invisalign-1.jpg", "Invisalign"],
                     ["assets/ba/implant-1.jpg", "Dental implant"], ["assets/ba/whitening-2.jpg", "Teeth whitening"],
                     ["assets/ba/invisalign-2.jpg", "Invisalign"], ["assets/ba/implant-2.jpg", "Dental implants"]]}
WHY = {"block": "why_us", "eyebrow": "Why Woburn Sands", "title": "Why patients <b>choose us.</b>", "items": [
    ["pin", "Trusted local dental care", "A family-oriented practice in Woburn Sands, caring for patients from across Milton Keynes."],
    ["star", "Rated {{rating}} on Google", "From {{review_count}} reviews by local patients."],
    ["calm", "A calm, friendly setting", "Modern dentistry in a purpose-built practice, with ground-floor surgeries."],
    ["clock", "Emergency appointments", "Available when you need to be seen sooner."],
    ["smile", "Family dentistry", "For adults and children, all at one practice."],
    ["heart", "Nervous patients welcome", "Transparent pricing and personalised care, at your pace."]]}
HOURS = {"block": "spotlight", "name": "Opening hours", "eyebrow": "Opening hours and location",
         "title": "Easy to <b>find, easy to reach.</b>",
         "sub": "A single-storey practice set back among the trees on Theydon Avenue, in the heart of Woburn Sands.",
         "photo": {"src": P + "s11-dup1.jpg", "pos": "50% 50%"},
         "badge": {"name": "Woburn Sands Dental Practice", "role": "16 Theydon Avenue, MK17 8PL"},
         "items": [["clock", "Weekdays", "Monday to Friday, 8am to 5.30pm."],
                   ["calendar", "Saturdays", "Saturday, 8am to 1.45pm. Closed Sundays."],
                   ["person", "Step-free access", "Ground-floor surgeries with wide corridors, suitable for wheelchair users."]]}
MEET = {"block": "meet_dentist", "name": "Simone Duggal", "role": "Dentist · BDS (Liverpool, 2017) · GDC 270660",
        "quote": "Your first visit is about getting to know you: your oral health, your questions and your goals, explained clearly and with no pressure.",
        "creds": ["Three years in hospital service in oral and maxillofacial surgery",
                  "Passed the Royal College of Surgeons MFDS examinations",
                  "Post-graduate Diploma in Implant Dentistry",
                  "Named by patients for kind, patient care"],
        "photo": {"src": P + "s32.jpg", "pos": "50% 35%"}}
TEAM = {"block": "team", "eyebrow": "Meet the team", "title": "The people who’ll <b>look after you.</b>",
        "sub": "A friendly, GDC-registered team who will help you feel at ease from the moment you arrive.",
        "members": [[T + "simone.jpg", "Simone", "Dentist"], [T + "sabrina.jpg", "Sabrina", "Dentist"],
                    [T + "boglarka.jpg", "Boglarka", "Dentist"], [T + "tessa.jpg", "Tessa", "Dental Hygienist"],
                    [T + "agnieszka.jpg", "Agnieszka", "Dental Nurse"], [T + "charlotte.jpg", "Charlotte", "Practice Manager"],
                    [T + "julia.jpg", "Julia", "Front of House"]]}
FAQ = {"block": "faq", "items": [
    ["How much is the new patient check-up?", "Your new patient check-up is £85, with X-rays included. It covers a full dental examination, health and oral cancer screening, digital X-rays when needed and a personalised treatment plan."],
    ["How long does the appointment take?", "Around 30 minutes, including a short introduction to the practice before you meet the dentist."],
    ["Will I need X-rays?", "We take digital X-rays when necessary to spot hidden issues, at no additional cost."],
    ["I’m nervous about the dentist. Can you help?", "Yes. Nervous patients are very welcome. Let us know when you book and we’ll take the time to listen and explain everything, so you feel at ease."],
    ["Do you see children?", "Yes. We offer family dentistry for adults and children. A children’s new patient assessment is £25."],
    ["How much is a hygiene appointment?", "Hygiene appointments start from £81.20, including a scale and polish, a gum health check and Airflow stain removal if applicable."],
    ["Do you offer membership plans?", "Yes. Plans start from £8.60 a month and include routine check-ups, X-rays and 10% off further private treatment."],
    ["Where are you?", "Woburn Sands Dental Practice is at 16 Theydon Avenue, Woburn Sands, Milton Keynes MK17 8PL, with ground-floor surgeries and wheelchair access."]]}
FINAL = {"block": "final_cta", "eyebrow": CROWN_RULE.format(c="white", w=240) + "Book today",
         "title": "Your new patient check-up, <b>only £85.</b>", "size": 52, "size_m": 32,
         "sub": "Book today for a thorough check-up and a clear, personalised plan from a kind and caring team.",
         "tags": ["X-rays included", "Nervous patients welcome", "16 Theydon Avenue"],
         "trust": "Rated {{rating}} from {{review_count}} Google reviews", "form_title": "Book your check-up"}


def page(title, form, sections, ty=TY, cta=None):
    out = {"title": title, "form": {**FORM, **form}, "sections": sections, "thank_you": ty}
    if cta:
        out["cta"] = cta
    return out


brand_spec = page("Brand spec", NP_FORM, [{"block": "header"}, HERO, USP, PRICING, FORM_BAND])
new_patient = page("New patient check-up", NP_FORM, [
    {"block": "header"}, HERO, USP, STORIES, PRICING, MEMBERSHIP, REVIEWS, FORM_BAND, PAIN, EXPLAINER, STEPS,
    SERVICES, RESULTS, WHY, HOURS, MEET, TEAM, FAQ, FINAL])

pages = {"brand-spec": brand_spec, "new-patient": new_patient}
out = Path(__file__).parent / "pages"
out.mkdir(exist_ok=True)
for name, spec in pages.items():
    (out / f"{name}.json").write_text(json.dumps(spec, indent=1, ensure_ascii=False))
    print("wrote", name)
