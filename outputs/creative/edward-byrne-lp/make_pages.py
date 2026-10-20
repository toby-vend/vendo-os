"""Edward Byrne Associates page recipes for the shared LP harness.

Source of truth (Toby, 20 Oct 2026): the Meta draft lp.edwardbyrne.com/new-patients-offer-meta (read 20 Oct 2026).
The Google draft (lp.edwardbyrne.com/new-patients-offer) has the same offer and copy. The £60 price, what's
included, the 45-minute appointments, Direct Access hygiene, the loyalty rate, membership from £9.25, the Google
reviews, the five dentists and the opening hours come from the draft; other prices from edwardbyrne.com/prices and
plan detail from edwardbyrne.com/membership-plans. Every price is in facts.json.
Photos: Joe Goodchild's July 2026 shoot (the brand guideline's assets/photos/web), the draft's clinician headshots
and its YouTube poster. All media in assets/ is gitignored.
Pages: brand-spec (Phase 1 sections) and new-patient (full page).
Run: python3 make_pages.py, then build.py from scripts/lp-harness.
"""
import json
from pathlib import Path

P = "assets/photos/"
T = "assets/team-chest/"
CROWN = '<img src="assets/crown.png" alt="" style="height:12px;width:auto;display:inline-block;vertical-align:-1px;margin-right:12px">'
# Dr Smita at the villa's front door (p8; matched by face to her headshot on the draft); rows = source rows that fill the frame
SMITA_DOOR = {"src": P + "p8.jpg", "w": 1012, "h": 1800, "rows": [170, 1250], "cx": 515}

FORM = {"fields": [{"label": "Full name", "full": True}, "Email", "Mobile"]}
NP_FORM = {"label": "New patient offer", "title": "Book your check-up",
           "sub": "New patients welcome at our Bedford practice.",
           "note": "£60 new patient check-up, with a complimentary 3D digital scan."}
TY = {"text": "Our team will be in touch to arrange your new patient check-up. If you’d rather pick a time yourself, you can book online now.",
      "buttons": [{"label": "Choose a time online", "href": "{{booking_url}}", "style": "primary"}]}

HERO = {"block": "hero_form", "eyebrow": CROWN + "New patients welcome · Bedford",
        "title": "New patient check-up in Bedford, <b>only £60.</b>",
        "tagline": "Looking for a new private dentist? Your first visit includes a complimentary 3D digital scan.",
        "sub": "High-quality private dental care in a calm and welcoming practice, with a trusted local team who take the time to listen.",
        "ticks": ["Comprehensive dental examination", "Complimentary 3D digital scan", "Personalised treatment plan", "Home care and prevention advice"],
        "ticks_m": ["Comprehensive dental examination", "Complimentary 3D digital scan"],
        "trust": "Rated Excellent from {{review_count}} Google reviews",
        "stats": [["{{review_count}}", "Google reviews"], ["45", "Minute appointments"], ["Tue", "Open to 7:30pm"]],
        "stats_m": [["{{review_count}}", "Reviews"], ["45", "Minutes"], ["Tue", "To 7:30pm"]],
        "photo": SMITA_DOOR, "device_gap_m": 130,
        "seal": {"top": "New patients", "price": "£60", "bottom": "Check-up + 3D scan"}}
USP = {"block": "usp_text", "hide_m": False, "label": CROWN + "Why Bedford patients choose Edward Byrne", "items": [
    ["clock", "Unhurried 45-minute appointments, so you never feel rushed"],
    ["scan", "A complimentary 3D digital scan, with no messy impressions"],
    ["card", "Clear, transparent pricing with honest advice"],
    ["pin", "A red-brick villa on De Parys Avenue, Bedford"]]}
PRICING = {"block": "pricing", "layout": "panel", "eyebrow": "Pricing", "title": "One clear price <b>to get started.</b>",
           "sub": "No unnecessary treatment. If anything is needed after your check-up, we give you a clear treatment plan and costs before you decide to go ahead.",
           "price_label": "New patient check-up", "price": "£60", "price_note": "45-minute appointment",
           "notes": ["After your first visit, ongoing check-ups are at our loyalty rate of £47.50.",
                     "Or spread the cost with a membership plan from £9.25 a month."],
           "photo": {"src": P + "l1.jpg", "pos": "50% 55%"},
           "get": [["A comprehensive dental examination", "A thorough assessment of your teeth, gums and overall oral health"],
                   ["A complimentary 3D digital scan", "A detailed digital map of your mouth, without traditional impressions"],
                   ["Your personalised treatment plan", "Findings explained clearly, with recommendations based on your needs and priorities"],
                   ["Home care and prevention advice", "Practical guidance to keep your teeth and gums healthy between visits"]]}
FORM_BAND = {"block": "form_band", "name": "Book your check-up (form 2)", "eyebrow": "New patient offer", "title": "Your new dentist, <b>in Bedford.</b>",
             "sub": "Book your £60 new patient check-up at Edward Byrne Associates, with a complimentary 3D digital scan.",
             "ticks": ["45-minute appointments", "Complimentary 3D scan", "Late Tuesdays to 7:30pm", "Nervous patients welcome"], "form_title": "Book your check-up",
             "m_sub": "Send us your details and our team will be in touch to arrange your check-up."}

STORIES = {"block": "story_cards", "sub": "Don’t just take it from us. Here’s what our patients say about their care.", "items": [
    ["Tooth extraction", "The dentist at Edward Byrne did a great job and explained everything very well in a professional and also friendly manner. I was very satisfied with the treatment I received.", "Andy Bunting"],
    ["Feeling at ease", "All staff were welcoming and put me at ease straight away.", "Yvette Pearson"],
    ["Routine care", "Professional practice and always professional friendly service. Can not ever fault the service I receive.", "Janine Valerio"]],
    "cta": False}
MEMBERSHIP = {"block": "membership", "eyebrow": "Membership plans", "title": "Spread the cost of <b>routine care.</b>",
              "sub": "Denplan Essentials plans cover your check-ups, hygiene visits and X-rays for a simple monthly fee, with 10% off further private treatment.",
              "groups": [{"label": "Denplan Essentials", "sub": "From £9.25 a month", "plans": [
                  {"name": "Option A", "price": "£9.25", "who": "1 check-up, 1 hygiene visit", "featured": False,
                   "feats": ["1 dental examination a year", "1 hygiene appointment a year", "X-rays included", "10% off further private treatment"]},
                  {"name": "Option B", "price": "£19.75", "who": "2 check-ups, 2 hygiene visits", "featured": True,
                   "feats": ["2 dental examinations a year", "2 hygiene appointments a year", "X-rays included", "10% off further private treatment"]},
                  {"name": "Option C", "price": "£31.80", "who": "2 check-ups, 4 hygiene visits", "featured": False,
                   "feats": ["2 dental examinations a year", "4 hygiene appointments a year", "X-rays included", "10% off further private treatment"]}]}],
              "small": "Edward Byrne Associates is a Denplan Excel accredited practice."}
REVIEWS = {"block": "google_reviews", "sub": "Real reviews from Edward Byrne patients, posted on Google.", "items": [
    ["Jonathan Tedd", "Very professional and thorough service."],
    ["Robert Whitlock", "Excellent dentist and hygienist."],
    ["Stephen Chilvers", "Excellent treatment and care."]]}
PAIN = {"block": "pain_points", "title": "Looking for a dentist <b>who takes the time?</b>",
        "sub": "Whether you’re new to Bedford, overdue a check-up or new to private dentistry, you’re in the right place.",
        "items": [["You’ve just moved to the area", "You want a trusted local practice for your ongoing care."],
                  ["It’s been a while since your last check-up", "Regular check-ups catch problems early, before they become uncomfortable or costly."],
                  ["You’re nervous about the dentist", "We’re used to supporting anxious patients and take things at your pace, explaining everything as we go."],
                  ["You’re new to private dentistry", "A gentle, supportive approach and a clear plan before anything goes ahead."],
                  ["You want to know the cost first", "Clear, transparent pricing with honest advice and no unnecessary treatment."],
                  ["Daytime appointments are hard to fit in", "Late appointments on Tuesdays until 7:30pm, and Saturday mornings."]],
        "close": "Your check-up is a <b style=\"font-weight:500\">45-minute assessment of your oral health</b>, followed by a plan built around your needs."}
EXPLAINER = {"block": "explainer", "name": "What’s included", "photo": {"src": P + "l16.jpg", "pos": "45% 40%"},
             "eyebrow": "What’s included", "title": "A thorough check-up, <b>never rushed.</b>",
             "text": "Every new patient appointment is 45 minutes. That dedicated time lets us carry out a comprehensive assessment, take X-rays if they’re clinically necessary and talk through your oral health goals.",
             "card": {"title": "Why regular check-ups matter", "text": "Early detection, consistent monitoring of your gums and teeth, and regular assessments that include oral cancer screening, so issues are caught before they become uncomfortable or costly to treat."},
             "facts": ["Comprehensive examination", "3D digital scan", "X-rays if needed", "Prevention advice"]}
STEPS = {"block": "steps", "eyebrow": "What to expect", "title": "Your new patient check-up, <b>step by step.</b>", "items": [
    ["Book your check-up", "Send us your details and our team will arrange a time that suits you."],
    ["Your assessment", "A thorough examination of your teeth and gums, with your complimentary 3D scan and X-rays if clinically necessary."],
    ["Clear findings", "We explain what we’ve found and the next steps, with any costs set out before you decide."],
    ["Your treatment plan", "A tailored plan for your needs, plus practical advice for caring for your teeth at home."]]}
SERVICES = {"block": "services", "style": "photo", "eyebrow": "Our care", "title": "General and private dentistry, <b>under one roof.</b>",
            "sub": "From routine check-ups to hygiene and cosmetic care, at our practice on De Parys Avenue.",
            "items": [{"title": "Check-ups &amp; X-rays", "text": "A comprehensive examination with X-rays only if clinically necessary, £60 for new patients.", "photo": {"src": P + "l19.jpg", "pos": "45% 40%"}},
                      {"title": "Hygiene", "text": "Direct Access hygiene, with or without a dental exam, from £68.50.", "photo": {"src": P + "l14.jpg", "pos": "50% 35%"}},
                      {"title": "Nervous patients", "text": "A gentle, supportive approach, at your pace, with everything explained as we go.", "photo": {"src": P + "l13.jpg", "pos": "50% 35%"}},
                      {"title": "Fillings", "text": "Fillings from £89.50, with the plan and costs explained before treatment.", "photo": {"src": P + "l15.jpg", "pos": "50% 35%"}},
                      {"title": "Teeth whitening", "text": "Professional teeth whitening from £299.", "photo": {"src": P + "l3.jpg", "pos": "70% 40%"}},
                      {"title": "Invisalign &amp; cosmetic care", "text": "Clear aligners, composite bonding and veneers, planned with you after an examination.", "photo": {"src": P + "l18.jpg", "pos": "50% 35%"}}]}
WHY = {"block": "why_us", "eyebrow": "Why Edward Byrne", "title": "Why patients <b>choose us.</b>", "items": [
    ["person", "A friendly, experienced team", "Focused on making every visit comfortable and relaxed."],
    ["calm", "A calm, welcoming practice", "High standards of private dental care in a red-brick villa in Bedford."],
    ["scan", "Modern technology", "For accurate diagnosis and effective treatment planning."],
    ["card", "Clear, transparent pricing", "Honest advice and no unnecessary treatment."],
    ["heart", "Gentle with nervous patients", "A supportive approach for anxious patients and those new to private dentistry."],
    ["award", "Denplan Excel accredited", "Our care is independently reviewed against strict criteria every year."]]}
HOURS = {"block": "spotlight", "name": "Opening hours", "eyebrow": "Opening hours",
         "title": "Appointments that fit <b>around your week.</b>",
         "sub": "Our practice on De Parys Avenue, a short walk from Bedford town centre.",
         "photo": {"src": P + "l6.jpg", "pos": "50% 50%"},
         "badge": {"name": "Edward Byrne Associates", "role": "16 De Parys Avenue, MK40 2TW"},
         "items": [["clock", "Late Tuesdays", "Tuesday, 9am to 7:30pm."],
                   ["calendar", "Saturday mornings", "Selected Saturdays, 9am to 1pm."],
                   ["pin", "Weekdays", "Monday, Wednesday and Thursday 9am to 5pm. Friday 9am to 3:30pm. Closed Sundays."]]}
MEET = {"block": "meet_dentist", "name": "Dr Neeta Mehta", "role": "Dentist · GDC 82463",
        "text": "Dr Neeta is one of our five GDC-registered dentists. At your first visit we take the time to understand your oral health and your goals, and explain everything clearly before anything goes ahead.",
        "creds": ["BDS (Lond), MFDS RCS (Eng)", "Postgraduate diplomas in clear aligner therapy and orthodontics", "Clear explanations and costs before treatment"],
        "photo": {"src": P + "p12.jpg", "pos": "50% 22%"}}
TEAM = {"block": "team", "eyebrow": "Meet your dentists", "title": "The people who’ll <b>look after you.</b>",
        "sub": "A friendly, experienced team of GDC-registered dentists, supported by our hygienists and nurses.",
        "members": [[T + "neeta.jpg", "Dr Neeta", "Dentist"], [T + "smita.jpg", "Dr Smita", "Dentist"],
                    [T + "stuart.jpg", "Dr Stuart", "Dentist"], [T + "rishi.jpg", "Dr Rishi", "Dentist"],
                    [T + "usman.jpg", "Dr Usman", "Dentist"]]}
TOUR = {"block": "practice_tour", "eyebrow": "Inside Edward Byrne", "title": "Take a look <b>around.</b>", "poster": P + "yt-general-top.jpg",
        "photos": [{"src": P + "l23.jpg", "pos": "50% 60%"}, {"src": P + "l1.jpg", "pos": "40% 55%"}, {"src": P + "l12.jpg", "pos": "50% 50%"}, {"src": P + "l4.jpg", "pos": "50% 50%"}]}
FAQ = {"block": "faq", "sub": "Can’t see your question? Send us your details and our team will be in touch.", "items": [
    ["How much is the new patient check-up?", "Your new patient check-up is £60. It includes a comprehensive dental examination, a complimentary 3D digital scan, a personalised treatment plan and home care advice."],
    ["What happens at my first appointment?", "We’ll carry out a full examination of your teeth and gums, discuss any concerns, and explain the next steps clearly."],
    ["How long does a new patient check-up take?", "All appointments are 45 minutes, so there’s time for a comprehensive assessment, any X-rays you need and a proper conversation about your goals, without feeling rushed."],
    ["Will I need X-rays?", "Only if clinically necessary. If we recommend them, we’ll explain why and what they help us check."],
    ["I’m nervous about visiting the dentist. Can you help?", "Yes. We’re used to supporting anxious patients and we’ll take things at your pace, explaining everything as we go."],
    ["Can I book a hygiene appointment as well?", "Yes. We offer Direct Access hygiene, so you can book a professional clean without a dental exam, or follow your check-up with a hygiene visit."],
    ["Do you see new patients in an emergency?", "Yes, wherever possible. A new patient emergency appointment is £85. Let us know when you get in touch and we’ll advise you on the quickest option."],
    ["How much will any treatment cost?", "If anything is needed, we’ll give you a clear treatment plan and costs before you decide to go ahead."],
    ["Where are you?", "Edward Byrne Associates is at 16 De Parys Avenue, Bedford MK40 2TW."]]}
FINAL = {"block": "final_cta", "eyebrow": "Book today", "title": "Your new patient check-up, <b>only £60.</b>", "size": 52, "size_m": 32,
         "sub": "Book today and discover a Bedford practice that puts your comfort, confidence and long-term oral health first.",
         "tags": ["Complimentary 3D scan", "45-minute appointments", "De Parys Avenue, Bedford"], "trust": "Rated Excellent from {{review_count}} Google reviews", "form_title": "Book your check-up"}


def page(title, form, sections, ty=TY, cta=None):
    out = {"title": title, "form": {**FORM, **form}, "sections": sections, "thank_you": ty}
    if cta:
        out["cta"] = cta
    return out


brand_spec = page("Brand spec", NP_FORM, [{"block": "header"}, HERO, USP, PRICING, FORM_BAND])
new_patient = page("New patient check-up", NP_FORM, [
    {"block": "header"}, HERO, USP, STORIES, PRICING, MEMBERSHIP, REVIEWS, FORM_BAND, PAIN, EXPLAINER, STEPS,
    SERVICES, WHY, HOURS, MEET, TEAM, TOUR, FAQ, FINAL])

pages = {"brand-spec": brand_spec, "new-patient": new_patient}
out = Path(__file__).parent / "pages"
out.mkdir(exist_ok=True)
for name, spec in pages.items():
    (out / f"{name}.json").write_text(json.dumps(spec, indent=1, ensure_ascii=False))
    print("wrote", name)
