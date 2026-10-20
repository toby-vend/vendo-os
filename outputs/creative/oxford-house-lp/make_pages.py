"""Oxford House Dental Practice page recipes for the shared LP harness.

Source of truth (Toby, 20 Oct 2026): his Meta draft lp.mkdentist.co.uk/new-patients-offer-meta/ (read 20 Oct 2026).
The offer, prices, inclusions, Google reviews, clinicians, hours and the practice video come from it; the Google
draft (lp.mkdentist.co.uk/new-patients-offer) matches apart from its phone number. Treatment prices beyond the
draft from mkdentist.co.uk/our-fees/; the new patient journey (tablet check-in, two waiting areas, Edwardian house)
from mkdentist.co.uk/new-patients-the-journey/. Every price is in facts.json.
Photos: Joe Goodchild's July 2026 shoot (Frame.io, 1800px copies from the guideline harness) plus the clinician
headshots from the draft. All media in assets/ is gitignored.
Pages: brand-spec (Phase 1 sign-off sections) and new-patient (full page).
Run: python3 make_pages.py, then build.py from scripts/lp-harness.
"""
import json
from pathlib import Path

P = "assets/photos/"
T = "assets/team-chest/"

FORM = {"fields": [{"label": "Full name", "full": True}, "Email", "Mobile"]}
NP_FORM = {"label": "New patient offer", "title": "Book your check-up",
           "sub": "New patients welcome, for you or your family.",
           "note": "£85 new patient check-up, X-rays included."}
TY = {"text": "Thank you. Our team will be in touch to confirm your check-up. If you’d rather pick a time yourself, you can book online now.",
      "buttons": [{"label": "Choose a time online", "href": "{{booking_url}}", "style": "primary"}]}

# The signature device: the red-brick house itself under the Deep Teal wash (guideline cover and statics)
HERO = {"block": "hero_form", "eyebrow": "New patients welcome · Fenny Stratford",
        "title": "Your new patient check-up, <b>£85.</b>",
        "tagline": "Digital X-rays included, in a family practice that feels like home.",
        "sub": "A detailed dental examination and a treatment plan tailored to your needs, from a friendly team who will put you at ease.",
        "ticks": ["Full dental examination", "Digital X-rays included", "Personalised treatment plan", "Free treatment consultation"],
        "ticks_m": ["Digital X-rays included", "Personalised treatment plan"],
        "trust": "Rated Excellent from {{review_count}} Google reviews",
        "stats": [["{{review_count}}", "Google reviews"], ["9", "GDC-registered dentists"], ["Sat", "Open to 2pm"]],
        "stats_m": [["{{review_count}}", "Reviews"], ["9", "Dentists"], ["Sat", "To 2pm"]],
        "backdrop": {"src": P + "practice-1.jpg", "pos": "70% 40%", "pos_m": "62% 0%", "h_m": 440, "a": .97, "b": .3},
        "seal": {"top": "New patients", "price": "£85", "bottom": "Check-up + X-rays"}, "form_top": 180, "pad_top_m": 180}
USP = {"block": "usp_text", "hide_m": False, "label": "Why families choose Oxford House", "items": [
    ["calendar", "Open from 8am, Wednesdays until 6pm and Saturday mornings"],
    ["card", "Clear, upfront pricing with no hidden fees"],
    ["chat", "A free 30-minute consultation if you’re considering further treatment"],
    ["pin", "Our Edwardian house on Aylesbury Street, Fenny Stratford"]]}
PRICING = {"block": "pricing", "layout": "panel", "eyebrow": "Pricing", "title": "Clear pricing, <b>no hidden fees.</b>",
           "sub": "If you need any treatment after your check-up, we explain your options and give you a detailed estimate before anything goes ahead.",
           "price_label": "New patient check-up", "price": "£85", "price_note": "X-rays included",
           "notes": ["Check-ups at £36.80 after your first visit · Hygienist appointment £81.20.",
                     "Children’s new patient check-up £42.50."],
           "photo": {"src": P + "practice-9.jpg", "pos": "50% 50%"},
           "get": [["A full dental examination", "A complete check-up of your current oral health and your goals"],
                   ["Digital X-rays included", "A clear, detailed view of your teeth and gums"],
                   ["Your personalised treatment plan", "Options that suit your needs and lifestyle"],
                   ["Oral hygiene advice", "Practical guidance to keep your smile healthy at home"]]}
FORM_BAND = {"block": "form_band", "name": "Book your check-up (form 2)", "eyebrow": "New patient offer", "title": "Make yourself <b>at home.</b>",
             "sub": "Book your £85 new patient check-up at Oxford House, with digital X-rays included.",
             "m_sub": "Book your £85 new patient check-up, with digital X-rays included.",
             "ticks": ["Open Saturday mornings", "X-rays included", "For you or your family", "Clear pricing upfront"], "form_title": "Book your check-up",
             "backdrop": {"src": P + "practice-12.jpg", "pos": "50% 55%", "pos_m": "40% 50%", "h_m": 420, "a": .97, "b": .55}}

STORIES = {"block": "story_cards", "sub": "Don’t just take it from us. Here’s what our patients say about their care.", "items": [
    ["Nervous patients", "I’ve always been a nervous patient but Dr Pav, who is very skilled at what he does, always makes sure I’m okay and comfortable during all the procedures.", "Jana Dobiasova"],
    ["Check-up", "Harshil was extremely accommodating and found a way of fixing my chipped front tooth when in fact, I was only booked in for a checkup.", "KeithPS2"],
    ["Wisdom tooth extraction", "Have nothing but praise for Ka who extracted a wisdom tooth for me. As a very nervous patient, his reassurance was wonderful.", "Carole Hopkins"]],
    "cta": False}
REVIEWS = {"block": "google_reviews", "sub": "Real reviews from Oxford House patients, posted on Google.", "items": [
    ["Natasha Dole", "He was endlessly patient, calm and comforting, taking the time to explain everything and making me feel completely at ease throughout."],
    ["Barry Milne", "Excellent dental care by Joyce, very friendly and professional explaining everything as she worked through procedures."],
    ["Carol", "Always pleasant. They listen. And give good advice."]]}
PAIN = {"block": "pain_points", "title": "Been a while since <b>your last visit?</b>",
        "sub": "Whether you’ve just moved to Milton Keynes, you’re overdue a visit or you’d like a practice that takes time to explain things, you’ll be in good hands.",
        "items": [["You’ve just moved to the area", "You need a friendly, family-orientated practice close to home."],
                  ["It’s been a while since your last check-up", "Regular check-ups help catch problems early, before they become painful or costly."],
                  ["You’re nervous about the dentist", "Our team will put you at ease and talk you through every step, at your pace."],
                  ["Weekdays are hard to fit in", "We open from 8am, until 6pm on Wednesdays, and on Saturday mornings."],
                  ["You want to know the cost first", "Clear, upfront pricing with no hidden fees, and a detailed estimate for any treatment."],
                  ["Something doesn’t feel quite right", "If you’re in discomfort, we’ll offer pain relief and guidance on your next steps."]],
        "close": "Your check-up is <b style=\"font-weight:500\">a full examination of your teeth, gums and oral health</b>, plus a personalised plan built around your goals."}
EXPLAINER = {"block": "explainer", "name": "What’s included", "photo": {"src": P + "practice-23.jpg", "pos": "45% 50%"},
             "eyebrow": "What’s included", "title": "A thorough first visit, <b>designed around you.</b>",
             "text": "Your first visit includes a full examination of your teeth, gums and overall oral health, plus a personalised care plan built around your individual goals.",
             "card": {"title": "Thinking about further treatment?", "text": "Book a free 30-minute consultation with our Treatment Co-ordinator to explore your options in more detail, with no obligation."},
             "facts": ["Full dental examination", "Digital X-rays included", "Personalised treatment plan", "Oral hygiene advice"]}
STEPS = {"block": "steps", "eyebrow": "What to expect", "title": "Your new patient check-up, <b>step by step.</b>", "items": [
    ["Book your check-up", "Send us your details and our team will arrange a time that suits you, including Saturday mornings."],
    ["Welcome to Oxford House", "Check in on a tablet in one of our two waiting areas, so your appointment time is all about you."],
    ["Dental assessment", "A full check-up of your oral health, with any X-rays needed for a clear clinical picture."],
    ["Your treatment plan", "We discuss what we find and create a tailored plan to protect or enhance your smile, with costs upfront."]]}
SERVICES = {"block": "services", "style": "photo", "eyebrow": "Our care", "title": "Everything your family needs, <b>under one roof.</b>",
            "sub": "From check-ups and hygiene to whitening and Invisalign, in our Edwardian practice on Aylesbury Street.",
            "items": [{"title": "Check-ups &amp; X-rays", "text": "A full examination with digital X-rays included, £85 for new patients.", "photo": {"src": P + "practice-39.jpg", "pos": "50% 60%"}},
                      {"title": "Hygiene &amp; Airflow", "text": "Hygienist appointments from £81.20, or with Airflow from £111.20.", "photo": {"src": P + "practice-31.jpg", "pos": "50% 40%"}},
                      {"title": "Family dentistry", "text": "Care for children and adults, with a child’s new patient check-up at £42.50.", "photo": {"src": P + "practice-34.jpg", "pos": "50% 40%"}},
                      {"title": "Fillings &amp; extractions", "text": "White fillings from £163 and extractions from £141, explained before treatment.", "photo": {"src": P + "practice-24.jpg", "pos": "50% 40%"}},
                      {"title": "Whitening &amp; Invisalign", "text": "Teeth whitening from £399 and Invisalign from £2,495.", "photo": {"src": P + "practice-32.jpg", "pos": "50% 40%"}},
                      {"title": "Nervous patients", "text": "A calm, homely practice and a team who listen, with sedation from £350.", "photo": {"src": P + "practice-21.jpg", "pos": "40% 50%"}}]}
WHY = {"block": "why_us", "eyebrow": "Why Oxford House", "title": "Why patients <b>choose us.</b>", "items": [
    ["person", "A friendly, patient-led team", "A team that puts your comfort first and takes time to listen."],
    ["calm", "A calm, homely practice", "Two waiting areas in our Edwardian house in Fenny Stratford."],
    ["plan", "Tailored treatment plans", "Built around your needs, your goals and your lifestyle."],
    ["scan", "Advanced technology", "Modern equipment and digital tools for precise, comfortable care."],
    ["card", "Clear, upfront pricing", "No hidden fees, and check-ups at £36.80 after your first visit."],
    ["clock", "Emergency appointments", "Help for new and existing patients when you need it."]]}
HOURS = {"block": "spotlight", "name": "Opening hours", "eyebrow": "Opening hours",
         "title": "Open early, <b>and on Saturdays.</b>",
         "sub": "Appointments from 8am to fit around work and the school run, at our practice in Fenny Stratford.",
         "photo": {"src": P + "practice-2.jpg", "pos": "35% 50%"},
         "badge": {"name": "Oxford House Dental Practice", "role": "Aylesbury Street, MK2 2BA"},
         "items": [["clock", "Weekdays", "Monday, Tuesday, Thursday and Friday, 8am to 5:30pm."],
                   ["calendar", "Wednesday", "8am to 6pm."],
                   ["calendar", "Saturday mornings", "Saturday, 8am to 2pm. Closed Sundays."]]}
MEET = {"block": "meet_dentist", "name": "Dr Pavanpal Diu", "role": "Clinical Lead · BDS (London) · GDC 211338",
        "quote": "Whether you’re visiting for a check-up or more extensive treatment, our friendly team will put you at ease and make you feel at home.",
        "creds": ["Clinical Lead at Oxford House", "Graduated from King’s College London in 2011",
                  "Named by patients for calm, comfortable care of nervous patients", "Leads a team of nine GDC-registered dentists"],
        "photo": {"src": "assets/team/pavanpal.jpg", "pos": "50% 20%"}}
TEAM = {"block": "team", "eyebrow": "Meet your clinicians", "title": "The people who’ll <b>look after you.</b>",
        "sub": "Experienced, GDC-registered dentists providing friendly general and preventative care in Milton Keynes.",
        "members": [[T + "pavanpal.jpg", "Dr Pavanpal", "Clinical Lead"], [T + "harshil.jpg", "Dr Harshil", "Dentist"],
                    [T + "kayesh.jpg", "Dr Kayesh", "Dentist"], [T + "kar.jpg", "Dr Kar", "Dentist"],
                    [T + "caroline.jpg", "Dr Caroline", "Dentist"], [T + "ashul.jpg", "Dr Ashul", "Dentist"],
                    [T + "syed.jpg", "Dr Syed", "Dentist"], [T + "rakhee.jpg", "Dr Rakhee", "Dentist"],
                    [T + "joyce.jpg", "Dr Joyce", "Dentist"]]}
TOUR = {"block": "practice_tour", "eyebrow": "Inside Oxford House", "title": "Take a look <b>around.</b>", "poster": P + "yt-why-choose.jpg",
        "photos": [{"src": P + "practice-14.jpg", "pos": "40% 50%"}, {"src": P + "practice-16.jpg", "pos": "50% 30%"},
                   {"src": P + "practice-3.jpg", "pos": "50% 50%"}, {"src": P + "practice-39.jpg", "pos": "50% 60%"}]}
FAQ = {"block": "faq", "items": [
    ["How much is the new patient check-up?", "Your new patient check-up is £85, with digital X-rays included. It covers a full dental examination, a personalised treatment plan and oral hygiene advice."],
    ["What happens at my first appointment?", "Your new patient assessment takes around 30 minutes, including a short introduction to the practice. We check your teeth, gums and overall oral health, take any X-rays needed and talk you through what we find."],
    ["Do I pay extra for X-rays?", "No. Digital X-rays are included in your £85 new patient check-up."],
    ["What is the free consultation?", "If you’re considering further treatment, such as whitening or Invisalign, you can book a free 30-minute consultation with our Treatment Co-ordinator to explore your options, with no obligation."],
    ["I’m nervous about the dentist. Can you help?", "Yes. Let us know when you book and our team will take time to put you at ease. Sedation is available from £350 if you need it."],
    ["Do you see children?", "Yes. We’re a family-orientated practice, and a child’s new patient check-up is £42.50."],
    ["How much are check-ups after my first visit?", "Routine check-ups are £36.80 after your first visit, and a hygienist appointment is £81.20."],
    ["When are you open?", "Monday, Tuesday, Thursday and Friday 8am to 5:30pm, Wednesday 8am to 6pm, and Saturday 8am to 2pm."],
    ["Where are you?", "Oxford House Dental Practice is on Aylesbury Street, Fenny Stratford, Milton Keynes MK2 2BA."]]}
FINAL = {"block": "final_cta", "eyebrow": "Book today", "title": "Your new patient check-up, <b>£85.</b>", "size": 54, "size_m": 34,
         "sub": "Book today and make yourself at home at Oxford House, with digital X-rays included.",
         "tags": ["X-rays included", "Open Saturday mornings", "Fenny Stratford, MK2"], "trust": "Rated Excellent from {{review_count}} Google reviews", "form_title": "Book your check-up"}


def page(title, form, sections, ty=TY, cta=None):
    out = {"title": title, "form": {**FORM, **form}, "sections": sections, "thank_you": ty}
    if cta:
        out["cta"] = cta
    return out


brand_spec = page("Brand spec", NP_FORM, [{"block": "header"}, HERO, USP, PRICING, FORM_BAND])
new_patient = page("New patient check-up", NP_FORM, [
    {"block": "header"}, HERO, USP, STORIES, PRICING, REVIEWS, FORM_BAND, PAIN, EXPLAINER, STEPS,
    SERVICES, WHY, HOURS, MEET, TEAM, TOUR, FAQ, FINAL])

pages = {"brand-spec": brand_spec, "new-patient": new_patient}
out = Path(__file__).parent / "pages"
out.mkdir(exist_ok=True)
for name, spec in pages.items():
    (out / f"{name}.json").write_text(json.dumps(spec, indent=1, ensure_ascii=False))
    print("wrote", name)
