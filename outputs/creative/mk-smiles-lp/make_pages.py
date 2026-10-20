"""MK Smiles page recipes for the shared LP harness.

Source of truth (Toby, 20 Oct 2026): lp.mksmiles.co.uk/new-patients-offer/ (read 20 Oct 2026). Prices, the offer,
what's included, the Google reviews, the before-and-afters, the clinicians and the opening hours all come from that
page; membership plan detail from mksmiles.co.uk/membership-plan. Every price is in facts.json.
Photos: Joe Goodchild's July 2026 shoot (Frame.io "KANA PROCESSED PHOTOS / MK SMILES") plus the clinician
headshots and before-and-afters from the source page. All media in assets/ is gitignored.
Pages: brand-spec (Phase 1 sign-off sections) and new-patient (full page).
Run: python3 make_pages.py, then build.py from scripts/lp-harness.
"""
import json
from pathlib import Path

P = "assets/photos/"
T = "assets/team-chest/"
# Dr Gizele Pereira at the MK reception wall (named on her scrubs); rows = source rows that fill the frame
# Hero photo per Toby's Figma comment (20 Oct 2026): Frame.io MK SMILES 8.jpg, the reception waiting area
RECEPTION = {"src": P + "8.jpg", "w": 1800, "h": 1012, "rows": [0, 1012], "cx": 1380}
GIZEL = {"src": P + "26.jpg", "w": 1800, "h": 1012, "rows": [96, 1012], "cx": 1180}

FORM = {"fields": [{"label": "Full name", "full": True}, "Email", "Mobile"]}
NP_FORM = {"label": "New patient offer", "title": "Book your check-up",
           "sub": "New patients welcome, for you or your family.",
           "note": "£50 new patient check-up, usually £76.70."}
TY = {"text": "Thank you. Our team will be in touch to confirm your check-up. If you’d rather pick a time yourself, you can book online now.",
      "buttons": [{"label": "Choose a time online", "href": "{{booking_url}}", "style": "primary"}]}

HERO = {"block": "hero_form", "eyebrow": "New patients welcome · Brooklands, Milton Keynes",
        "title": "New patient check-up, <b>now £50.</b>",
        "tagline": "Usually £76.70, with a complimentary 3D digital scan.",
        "sub": "A comprehensive dental examination and a personalised care plan designed around your oral health, in a calm and modern practice.",
        "ticks": ["Detailed dental examination", "Digital X-rays where required", "Complimentary 3D digital scan", "Personalised care plan"],
        "ticks_m": ["Detailed dental examination", "Complimentary 3D digital scan"],
        "trust": "Rated Excellent from {{review_count}} Google reviews",
        "stats": [["{{review_count}}", "Google reviews"], ["7", "GDC-registered dentists"], ["Sat", "Open to 4:30pm"]],
        "stats_m": [["{{review_count}}", "Reviews"], ["7", "Dentists"], ["Sat", "To 4:30pm"]],
        "photo": RECEPTION, "device_gap_m": 130,
        "seal": {"top": "New patients", "price": "£50", "bottom": "Check-up + 3D scan", "was": "£76.70"}}
USP = {"block": "usp_text", "hide_m": False, "label": "Why families choose MK Smiles", "items": [
    ["calendar", "Late evenings Monday and Wednesday, and Saturdays to 4:30pm"],
    ["scan", "A complimentary 3D digital scan, with no messy impressions"],
    ["card", "Clear pricing explained upfront, with no hidden costs"],
    ["pin", "Inside Brooklands Health Centre, MK10"]]}
PRICING = {"block": "pricing", "layout": "panel", "eyebrow": "Pricing", "title": "Clear pricing, <b>explained upfront.</b>",
           "sub": "No hidden costs. If you need any treatment after your check-up, we explain your options and the price before anything goes ahead.",
           "price_label": "New patient check-up", "price": "£50", "price_note": "Usually £76.70",
           "notes": ["Hygienist appointment £79.80 · Hygiene with Airflow £105.", "Fillings from £152 · Extractions from £131 · Teeth whitening £350 · Sedation from £350."],
           "photo": {"src": P + "9.jpg", "pos": "50% 40%"},
           "get": [["A detailed dental examination", "A full assessment of your oral health, concerns and goals"],
                   ["Digital X-rays where required", "A clear and accurate view of your teeth and gums"],
                   ["A complimentary 3D digital scan", "A detailed digital map of your mouth, without traditional impressions"],
                   ["Your personalised care plan", "Tailored recommendations, plus practical advice for caring for your teeth at home"]]}
FORM_BAND = {"block": "form_band", "name": "Book your check-up (form 2)", "eyebrow": "New patient offer", "title": "Your family dentist, <b>in Brooklands.</b>",
             "sub": "Book your £50 new patient check-up at MK Smiles. Usually £76.70, with a complimentary 3D digital scan.",
             "ticks": ["Evenings and Saturdays", "Complimentary 3D scan", "For you or your family", "Clear pricing upfront"], "form_title": "Book your check-up"}

STORIES = {"block": "story_cards", "sub": "Don’t just take it from us. Here’s what our patients say about their care.", "items": [
    ["Nervous patients", "This is an ideal practice for nervous patients. Also Dr Kish did a great job of repairing a broken tooth. Highly recommended.", "Ian Higginson-Burford"],
    ["Sedation &amp; nervous care", "Gizel has listened to my specific fears and works with me to minimise them as much as possible. I even managed to go to my last appointment by myself!", "Mia Walsh"],
    ["Tooth extraction", "They explained each procedure step by step and in a way I could understand. They made me feel very comfortable and most importantly they were patient with me.", "Georgiana Dumitru"]],
    "cta": False}
MEMBERSHIP = {"block": "membership", "eyebrow": "Membership plans", "title": "Spread the cost of <b>routine care.</b>",
              "sub": "Check-ups, hygiene and X-rays on a simple monthly plan, with 10% off further private treatment. Your dentist recommends the plan that suits you.",
              "groups": [{"label": "Plans", "sub": "From £11.25 a month", "plans": [
                  {"name": "Option A", "price": "£11.25", "who": "1 check-up, 1 hygiene visit", "featured": False,
                   "feats": ["1 dental examination a year", "1 hygiene appointment a year", "X-rays included", "10% off further private treatment"]},
                  {"name": "Option B", "price": "£21.50", "who": "2 check-ups, 2 hygiene visits", "featured": True,
                   "feats": ["2 dental examinations a year", "2 hygiene appointments a year", "X-rays included", "10% off further private treatment"]},
                  {"name": "Option C", "price": "£34.25", "who": "2 check-ups, 4 hygiene visits", "featured": False,
                   "feats": ["2 dental examinations a year", "4 hygiene appointments a year", "X-rays included", "10% off further private treatment"]}]}]}
REVIEWS = {"block": "google_reviews", "sub": "Real reviews from MK Smiles patients, posted on Google.", "items": [
    ["Jūratė Sabaliauskaitė", "I’m very happy with my dentist Dr Kishan. He is extremely professional, caring, and excellent at what he does. I always feel comfortable and well looked after during my appointments."],
    ["Ashley Washington", "Amazingly friendly staff, warm smiles, very welcoming."],
    ["Mia Walsh", "The team are so kind and patient and always greet me with a warm welcome, and that extends to everyone I’ve met there."]]}
PAIN = {"block": "pain_points", "title": "Looking for a dentist <b>you can stick with?</b>",
        "sub": "Whether you’re new to Milton Keynes, overdue a check-up or simply want a practice that takes time to explain things, you’re in the right place.",
        "items": [["You’ve just moved to the area", "You need a friendly, highly rated practice close to home for you and your family."],
                  ["It’s been a while since your last check-up", "Regular check-ups catch problems before they become painful or costly to treat."],
                  ["You’re nervous about the dentist", "Our team takes time to understand your history and will talk you through your options at your pace."],
                  ["Weekday appointments are hard to fit in", "Late evenings on Monday and Wednesday, and Saturdays until 4:30pm."],
                  ["You want to know the cost first", "Clear pricing explained upfront, with no hidden costs."],
                  ["Something doesn’t feel quite right", "If discomfort is present, we offer pain relief advice or treatment where appropriate."]],
        "close": "Your check-up is a <b style=\"font-weight:500\">thorough assessment of your oral health</b>, followed by a care plan built around your goals."}
EXPLAINER = {"block": "explainer", "name": "What’s included", "photo": {"src": P + "17.jpg", "pos": "50% 50%"},
             "eyebrow": "What’s included", "title": "A proper check-up, <b>explained clearly.</b>",
             "text": "Your first visit includes a full dental assessment to understand your oral health, concerns and goals, using modern digital imaging where required.",
             "card": {"title": "Why regular check-ups matter", "text": "Early detection, professional monitoring of your gums and teeth, and routine oral cancer screenings, so issues are caught before they become painful or costly to treat."},
             "facts": ["Detailed examination", "Digital X-rays", "3D digital scan", "Oral hygiene advice"]}
STEPS = {"block": "steps", "eyebrow": "What to expect", "title": "Your new patient check-up, <b>step by step.</b>", "items": [
    ["Book your check-up", "Send us your details and our team will arrange a time that suits you, including evenings and Saturdays."],
    ["Dental assessment", "A full examination of your oral health, including X-rays if required and your complimentary 3D scan."],
    ["Diagnosis", "We explain our findings clearly and discuss any recommended treatments, with prices upfront."],
    ["Your care plan", "Tailored recommendations to help maintain or improve your smile, plus advice between visits."]]}
SERVICES = {"block": "services", "style": "photo", "eyebrow": "Our care", "title": "Everything your family needs, <b>under one roof.</b>",
            "sub": "Professional, patient-focused dental care in a calm and modern practice at Brooklands Health Centre.",
            "items": [{"title": "Check-ups &amp; X-rays", "text": "A detailed examination with digital X-rays where required, now £50 for new patients.", "photo": {"src": P + "10.jpg", "pos": "50% 50%"}},
                      {"title": "Hygiene &amp; Airflow", "text": "Hygienist appointments £79.80, or hygiene with Airflow £105.", "photo": {"src": P + "17.jpg", "pos": "50% 50%"}},
                      {"title": "Family dentistry", "text": "Friendly, gentle care for children and adults, all at one practice.", "photo": {"src": "assets/team/unnamed-2.jpg", "pos": "50% 30%"}},
                      {"title": "Fillings &amp; extractions", "text": "Fillings from £152 and extractions from £131, explained before treatment.", "photo": {"src": P + "12.jpg", "pos": "50% 50%"}},
                      {"title": "Teeth whitening", "text": "Professional teeth whitening for £350.", "photo": {"src": P + "14.jpg", "pos": "50% 50%"}},
                      {"title": "Nervous patients", "text": "A welcoming team who take time to listen, with sedation from £350.", "photo": {"src": P + "7.jpg", "pos": "50% 50%"}}]}
WHY = {"block": "why_us", "eyebrow": "Why MK Smiles", "title": "Why patients <b>choose us.</b>", "items": [
    ["person", "A welcoming, supportive team", "Friendly, highly rated care from GDC-registered dentists and hygienists."],
    ["calm", "A calm, modern practice", "Treatment plans tailored to your comfort and priorities."],
    ["scan", "Advanced dental technology", "Modern equipment for efficient, gentle care from your very first visit."],
    ["card", "Clear pricing, no hidden costs", "Everything explained upfront before any treatment goes ahead."],
    ["clock", "Emergency support", "Help when you need it most, with pain relief advice or treatment where appropriate."],
    ["calendar", "Flexible appointment times", "Monday and Wednesday until 7pm, and Saturdays until 4:30pm."]]}
RESULTS = {"block": "results", "eyebrow": "Results", "title": "See the difference <b>a new smile makes.</b>",
           "sub": "A healthy, confident smile can be life-changing. Every smile tells a story.", "ratio": 1.0,
           "items": [["assets/ba/ba-3.jpg", "Invisalign, whitening, veneer + bonding"], ["assets/ba/ba-4.jpg", "Invisalign"],
                     ["assets/ba/ba-2.jpg", "Invisalign, whitening + composite fillings"], ["assets/ba/ba-5.jpg", "Invisalign + whitening"]]}
HOURS = {"block": "spotlight", "name": "Opening hours", "tone": "light", "eyebrow": "Opening hours",
         "title": "Open when <b>you need us.</b>",
         "sub": "Flexible appointment times to fit around work and the school run, at Brooklands Health Centre.",
         "photo": {"src": P + "4.jpg", "pos": "50% 60%"},
         "badge": {"name": "Brooklands Health Centre", "role": "42 Montague Crescent, MK10 7LN"},
         "items": [["clock", "Late evenings", "Monday and Wednesday, 8:45am to 7pm."],
                   ["calendar", "Saturday appointments", "Saturday, 8:45am to 4:30pm."],
                   ["pin", "Weekdays", "Tuesday, Thursday and Friday, 8:45am to 5pm. Closed Sundays."]]}
MEET = {"block": "meet_dentist", "name": "Dr Kishan Chavda", "role": "Associate Dentist · GDC 243885",
        "quote": "Your first visit is about understanding your oral health, your concerns and your goals, then explaining everything clearly before anything goes ahead.",
        "creds": ["GDC-registered dentist at MK Smiles", "Named by patients for nervous care and repairing a broken tooth",
                  "Part of a team of seven GDC-registered dentists", "Clear explanations and prices upfront"],
        "photo": {"src": "assets/team/kishan.jpg", "pos": "50% 15%"}}
TEAM = {"block": "team", "eyebrow": "Meet your clinicians", "title": "The people who’ll <b>look after you.</b>",
        "sub": "Experienced, GDC-registered dentists delivering high-quality general and preventative dental care in Milton Keynes.",
        "members": [[T + "roshwin.jpg", "Dr Roshwin", "Principal Dentist"], [T + "arantxa.jpg", "Dr Arantxa", "Principal Dentist"],
                    [T + "kishan.jpg", "Dr Kishan", "Associate Dentist"], [T + "raluca.jpg", "Dr Raluca", "Associate Dentist"],
                    [T + "anita.jpg", "Dr Anita", "Associate Dentist"], [T + "dhaval.jpg", "Dr Dhaval", "Associate Dentist"],
                    [T + "gizel.jpg", "Dr Gizele", "Associate Dentist"]]}
TOUR = {"block": "practice_tour", "eyebrow": "Inside MK Smiles", "title": "Take a look <b>around.</b>", "poster": P + "yt-general.jpg",
        "photos": [P + "7.jpg", P + "15.jpg", {"src": P + "4.jpg", "pos": "50% 60%"}, P + "17.jpg"]}
FAQ = {"block": "faq", "items": [
    ["How much is the new patient check-up?", "Your new patient dental check-up is £50, usually £76.70. It includes a detailed dental examination, digital X-rays where required, a complimentary 3D digital scan and a personalised care plan."],
    ["What happens at my first appointment?", "We carry out a full assessment of your teeth, gums and overall oral health, explain our findings clearly and discuss any recommended treatments before anything goes ahead."],
    ["Will I need X-rays?", "We use modern digital imaging where required to get a clear and accurate view of your teeth and gums."],
    ["What is the 3D digital scan?", "A high-precision scan of your teeth that gives a detailed digital map of your mouth, without the need for messy, traditional impressions. It’s complimentary at your new patient check-up."],
    ["I’m nervous about the dentist. Can you help?", "Yes. Let us know when you book and our team will take time to understand your history and talk you through your options. Sedation is available from £350."],
    ["When are you open?", "Monday and Wednesday 8:45am to 7pm, Tuesday, Thursday and Friday 8:45am to 5pm, and Saturday 8:45am to 4:30pm."],
    ["Do you offer membership plans?", "Yes. Membership plans start from £11.25 a month and spread the cost of your routine check-ups and hygiene visits."],
    ["Where are you?", "MK Smiles is at Brooklands Health Centre, 42 Montague Crescent, Brooklands, Milton Keynes MK10 7LN."]]}
FINAL = {"block": "final_cta", "eyebrow": "Book today", "title": "Your new patient check-up, <b>now £50.</b>", "size": 52, "size_m": 32,
         "sub": "Book today and experience professional, patient-focused dental care in a calm and modern environment at MK Smiles.",
         "tags": ["Complimentary 3D scan", "Evenings and Saturdays", "Brooklands Health Centre"], "trust": "Rated Excellent from {{review_count}} Google reviews", "form_title": "Book your check-up"}


def page(title, form, sections, ty=TY, cta=None):
    out = {"title": title, "form": {**FORM, **form}, "sections": sections, "thank_you": ty}
    if cta:
        out["cta"] = cta
    return out


brand_spec = page("Brand spec", NP_FORM, [{"block": "header"}, HERO, USP, PRICING, FORM_BAND])
new_patient = page("New patient check-up", NP_FORM, [
    {"block": "header"}, HERO, USP, STORIES, PRICING, MEMBERSHIP, REVIEWS, FORM_BAND, PAIN, EXPLAINER, STEPS,
    SERVICES, RESULTS, WHY, HOURS, MEET, TEAM, TOUR, FAQ, FINAL])

pages = {"brand-spec": brand_spec, "new-patient": new_patient}
out = Path(__file__).parent / "pages"
out.mkdir(exist_ok=True)
for name, spec in pages.items():
    (out / f"{name}.json").write_text(json.dumps(spec, indent=1, ensure_ascii=False))
    print("wrote", name)
