"""One-off: turn the v1 Siha harness (outputs/creative/siha-lp-*/) into page recipes for the shared builder.
Kept as the record of how the fixture was made. Usage: python3 make_pages_from_siha_v1.py <dump-folder>
where <dump-folder> holds siha-<page>.json dumps of each v1 page's content constants."""
import json
import os, sys
S = sys.argv[1]
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pages")
L = lambda p: json.load(open(f"{S}/siha-{p}.json"))
HANNAN_HERO = {"src": "assets/photos/hannan-1600.jpg", "w": 1067, "h": 1600, "head_top": 312, "chest": 1031, "face_cx": 545, "cutout": "assets/cutouts/hannan.png"}
HANNAN_QUOTE = {"src": "assets/photos/hannan-2.jpg", "crop": {"w": 1467, "h": 2200, "top": 340, "bottom": 1434, "cx": 778}}

def awards(d, label):
    return {"block": "awards", "label": label, "items": [{"img": f"assets/awards/{a}", "result": w, "title": t} for a, (w, t, e) in zip(d["AWARDS"], d["AWARD_CAPTIONS"])]}

def team(d, sub="Dentists, specialists, hygienists and the faces who greet you at the door."):
    return {"block": "team", "eyebrow": "Meet the team", "title": "The people who’ll look after you", "sub": sub,
            "members": [[f"assets/team-chest/{p}.jpg", n, r] for p, n, r in d["TEAM"]]}

def faq(d, open_=(0,)):
    return {"block": "faq", "items": [[q, a] for q, a in d["FAQ"]], "open": list(open_)}

def gallery(name):
    return {"block": "practice_tour", "eyebrow": "Inside {{name}}", "title": "Take a look around our practice", "poster": "assets/photos/lounge.jpg",
            "photos": ["assets/photos/suite-one.jpg", "assets/photos/hygiene-suite.jpg", "assets/photos/lounge-plants.jpg", {"src": "assets/photos/facade.jpg", "pos": "50% 60%"}]}

TY_BOOK = [{"label": "Choose a time online", "href": "{{booking_url}}", "style": "primary"}]

# ------------------------------------------------------------------ new patient
d = L("new-patient")
np = {
 "title": "New patient assessment",
 "form": {"label": "Oral health assessment", "title": "Book your first visit", "sub": "Same-week appointments, evenings and weekends available.",
          "note": "Your assessment is £89, small X-rays included."},
 "sections": [
  {"block": "header"},
  {"block": "hero_form", "eyebrow": "New patients welcome · Shepherd’s Bush, W12", "title": "Oral health assessment <b>£89</b>",
   "tagline": "A dentist you can actually stick with.",
   "sub": "Not a quick check-up: a comprehensive look at your oral health, honest advice and a plan built around your goals.",
   "ticks": ["Full exam, 3D scan + X-rays", "Same-week appointments", "Sedation available", "0% finance available"],
   "ticks_m": ["Full exam, 3D scan + small X-rays", "Sedation for nervous patients"],
   "stats": [["5.0", "Google rating"], ["150+", "Patient reviews"], ["8", "Award wins"]],
   "stats_m": [["5.0", "Google rating"], ["150+", "Reviews"], ["8", "Awards"]],
   "photo": HANNAN_HERO},
  awards(d, "3 awards in 2024 · 5 in 2025"),
  {"block": "usp_text", "items": d["WHY"]},
  {"block": "story_cards", "sub": "Every smile is different. These are a few of the people who trusted us with theirs.", "items": d["STORIES"]},
  {"block": "pricing", "layout": "panel", "title": "Transparent pricing. No surprises.",
   "sub": "One flat fee for a comprehensive oral health assessment. Anything that needs attention afterwards is costed and explained upfront, before you decide anything.",
   "price_label": "Oral health assessment", "price": "£89", "price_note": "Small X-rays included",
   "notes": ["Up to 12 months 0% interest-free finance available for any treatment identified at your assessment."],
   "photo": {"src": "assets/photos/opg.jpg", "pos": "50% 35%"}, "get": d["GET"]},
  {"block": "membership", "eyebrow": "{{name}} Membership", "title": "A smarter way to care for your smile",
   "sub": "A monthly plan that builds your routine care in, with separate plans for adults and children.",
   "groups": [
     {"label": "Adults", "sub": "18 and over", "plans": [{"name": n, "price": p, "who": w, "feats": f, "featured": i == 0} for i, (n, p, w, f) in enumerate(d["ADULT_PLANS"])]},
     {"label": "Children", "sub": "Plans from £5.45 a month", "plans": [{"name": n, "price": p, "who": w, "feats": f} for n, p, w, f in d["CHILD_PLANS"]],
      "note": {"label": "Under 6s free", "text": "when a parent is registered with us and attends regularly"}}],
   "small": "{{name}} Membership is not dental insurance and does not cover all treatments. It is designed to support routine preventative care, and additional treatment may incur separate costs. T&amp;Cs apply. Ask the team about joining at your visit."},
  {"block": "google_reviews", "sub": "5.0 stars from 150+ verified Google reviews.", "items": d["REVIEWS"]},
  {"block": "form_band", "name": "Book your assessment (form 2)", "eyebrow": "Oral health assessment", "title": "Ready when you are",
   "sub": "Same-week appointments, evenings and weekends. £89 for a full exam, 3D scan and small X-rays, with no hidden extras.",
   "ticks": ["Full exam, 3D scan + small X-rays", "Oral cancer screening", "A plan built around your goals", "0% finance available"], "form_title": "Book your assessment"},
  {"block": "pain_points", "title": "It’s been a while and that’s okay",
   "sub": "Most new patients come to us after months, sometimes years, of meaning to book. Whatever brought you here, you’re in the right place.",
   "items": d["FAMILIAR"], "close": "Our assessment is a <b style=\"font-weight:600\">full look at your oral health with honest advice</b>: no lectures, no judgement, and no pressure to have anything done."},
  {"block": "explainer", "name": "The assessment", "photo": {"src": "assets/photos/hygienist-action.jpg", "pos": "40% 50%"}, "eyebrow": "The assessment",
   "title": "More than a check-up. A proper look at your oral health.",
   "text": "We take time to understand your short- and long-term goals, then tailor your plan to them. Small issues are fixed early, before they get worse: prevention before cure.",
   "card": {"title": "Your oral health is part of your overall health", "text": "Gum disease is linked to chronic conditions including cardiovascular disease, diabetes and Alzheimer’s. That’s why your assessment covers teeth, gums, bite and jaw, an oral cancer screening, small X-rays and a 3D scan, not just a quick look."},
   "facts": d["FACTS"]},
  {"block": "steps", "title": "From booking to ongoing care", "items": d["STEPS"]},
  {"block": "services", "style": "photo", "eyebrow": "Our services", "title": "Everything your mouth needs, under one roof",
   "sub": "Whatever your assessment uncovers, you won’t need to be referred somewhere else.",
   "items": [{"title": t, "text": x, "photo": {"src": f"assets/photos/{i}", "pos": p}} for t, x, i, p in d["SERVICES"]]},
  {"block": "why_us", "name": "Why Siha", "eyebrow": "Why {{name}}", "title": "Why patients trust us with their smiles", "items": d["WHY_SIHA"]},
  {"block": "meet_dentist", "name": "Dr Hannan", "role": "Director and Restorative Dentist · Founder · GDC 264888",
   "quote": "The best appointment is the one where nothing’s a surprise. We tell you exactly what we see and let you decide what happens next.",
   "creds": d["CREDS"], "photo": HANNAN_QUOTE},
  team(d), gallery("np"), faq(d),
  {"block": "final_cta", "title": "Your oral <span style=\"white-space:nowrap\">health,</span> <b>sorted</b>",
   "sub": "Book your oral health assessment at {{name}}. Straight answers, no pressure, and a plan you understand.",
   "tags": ["0% finance available", "All major insurances accepted"], "form_title": "Book your assessment"}],
 "thank_you": {"text": "Our team will be in touch to confirm your oral health assessment. If you’d rather pick a time yourself, you can book online now.", "buttons": TY_BOOK}}
json.dump(np, open(f"{D}/new-patient.json", "w"), ensure_ascii=False, indent=1)

def no_story_cta(page):
    for x in page["sections"]:
        if x["block"] == "story_cards":
            x["cta"] = False
    return page

# ------------------------------------------------------------------ smile makeover
d = L("smile-makeover")
deposit = {"name": "Refundable deposit", "icon": "shield", "title": "Refundable deposit", "text": d["DEPOSIT"]}
sm = {
 "title": "Smile makeover",
 "cta": "Book Consultation",
 "form": {"label": "Smile makeover", "title": "Book your free consultation", "sub": "Find out what your makeover would involve. No commitment, no pressure.",
          "fields": [{"label": "Full name", "full": True}, "Email", "Mobile"], "note": "Free consultation. A refundable deposit secures your slot."},
 "sections": [
  {"block": "header"},
  {"block": "hero_form", "eyebrow": "Smile makeovers · Shepherd’s Bush, W12", "title": "Free smile makeover <b>consultation</b>", "title_size": 52,
   "tagline": "A complete smile makeover, designed around you.", "sub": "Bonding, veneers, whitening and clear aligners, combined into one plan by cosmetic dentists you can trust. Treatments from £250 a tooth.",
   "ticks": ["Bespoke smile design", "3D digital preview", "0% finance available", "Minimally invasive"],
   "stats": [["5.0", "Google rating"], ["150+", "Patient reviews"], ["5", "2025 award wins"]], "stats_m": [["5.0", "Google rating"], ["150+", "Reviews"], ["5", "2025 awards"]],
   "device_gap_m": 96,
   "photo": {"src": "assets/photos/hannan-2-1600.jpg", "w": 1067, "h": 1600, "face": [453, 420, 228, 228], "cutout": "assets/cutouts/hannan-2.png", "breakout": "all"}},
  awards(d, d.get("AWARDS_LABEL", "3 awards in 2024 · 5 in 2025")),
  {"block": "usp_text", "items": d["WHY"] if isinstance(d["WHY"][0], list) else d["WHY"]},
  {"block": "story_cards", "sub": "Every smile is different. These are a few of the people who trusted us with theirs.", "items": d["STORIES"]},
  {"block": "pricing", "layout": "cards", "tone": "light", "title": "Transparent pricing. No surprises.",
   "sub": "Your makeover is built from whichever of these your smile needs, often more than one. The full plan is priced and agreed upfront, before any treatment begins.",
   "items": [{"tag": t, "name": n, "desc": x, "price": p, "unit": u, "feats": f, "featured": i == 1} for i, (t, n, x, p, u, f) in enumerate(d["PRICES"])],
   "finance": {"title": "0% interest-free finance", "text": "Spread the cost over up to 12 months on treatments over £300, through our partner Tabeo. It takes two minutes to apply, with an instant decision.",
               "aside": "Professional whitening is priced at your consultation."}},
  {"block": "spotlight", "name": "Orthodontist-led aligners", "photo": {"src": "assets/team-chest/abeera.jpg", "pos": "50% 0%"},
   "badge": {"name": "Dr Abeera", "role": "Specialist Orthodontist"}, "eyebrow": "Orthodontist-led aligners",
   "title": "Straightening planned by a specialist orthodontist",
   "sub": "Every aligner case at Siha is planned and led by Dr Abeera, our specialist orthodontist. That makes treatment more predictable, safer and faster, without the never-ending adjustments.",
   "items": d["ORTHO"]},
  {"block": "results", "sub": "Real {{name}} patients, with every plan built from the treatments their smile actually needed.",
   "items": [[f"assets/ba-cards/{k}.jpg", t] for k, t in d["BA"]]},
  {"block": "google_reviews", "sub": "5.0 stars from 150+ verified Google reviews.", "items": d["REVIEWS"]},
  {"block": "form_band", "name": "Book a consultation (form 2)", "tone": "light", "eyebrow": "Smile makeover consultation", "title": "See your new smile before you commit",
   "sub": "We scan your teeth, design the result with you and give you a full itemised plan. The consultation is free, with no obligation.",
   "ticks": ["3D digital scan", "Your smile designed with you", "A full, itemised plan", "0% finance available"], "form_title": "Book your free consultation", "note_card": deposit},
  {"block": "pain_points", "title": "It’s never just one thing about your smile", "width": 820,
   "sub": "Most people who ask us about a smile makeover don’t have a single problem. It’s a chip here, some staining there, one tooth slightly out of line. Small things that add up every time you look in the mirror.",
   "items": d["FAMILIAR"], "close_width": 900, "close": "A smile makeover fixes all of the above with <b style=\"font-weight:600\">one joined-up plan</b>: straightening, whitening, bonding and veneers sequenced properly, so every step builds towards the final result."},
  {"block": "explainer", "photo": {"src": "assets/photos/suite-consult.jpg"}, "photo_h": 700, "eyebrow": "The treatment",
   "title": "One plan. Every treatment your smile needs. Nothing it doesn’t.",
   "text": "A smile makeover isn’t a single procedure. It’s a sequence of treatments designed together, so the straightening, the shade and the shape all arrive at one finished result.",
   "card": {"title": "What is a smile makeover?", "text": "A smile makeover is a personalised combination of cosmetic treatments (typically clear aligners, professional whitening, composite bonding and porcelain veneers) planned as a single journey. At your consultation we take a 3D digital scan, design your new smile with you, and sequence only the treatments you actually need. Some makeovers are completed in a single visit; others begin with a short course of aligners before the cosmetic finishing. Either way, you see the plan, the timeline and the full cost before anything begins."},
   "facts": d["FACTS"]},
  {"block": "steps", "title": "From first scan to final reveal", "items": d["STEPS"]},
  {"block": "services", "style": "icon", "name": "Building blocks", "eyebrow": "The building blocks", "title": "What can your makeover include?",
   "sub": "Every plan is different. Yours is built from whichever of these your smile actually needs.",
   "items": [{"icon": k, "title": t, "text": x} for k, t, x in d["BLOCKS"]]},
  {"block": "why_us", "eyebrow": "Why {{name}}", "title": "Why patients trust us with their smiles", "items": d["WHY_SIHA"]},
  {"block": "meet_dentist", "name": "Dr Hannan", "role": "Director and Restorative Dentist · Founder · GDC 264888",
   "quote": "A great smile makeover result comes from careful planning, not shortcuts. Every treatment is designed around your smile, your facial features and your long-term dental health.",
   "creds": d["CREDS"], "photo": {"src": "assets/photos/hannan-chest.jpg", "pos": "50% 0%"}},
  team(d), gallery("sm"), faq(d, d.get("FAQ_OPEN", [0, 1])),
  {"block": "final_cta", "title": "One plan, <b>one result</b>", "size": 50, "size_m": 32,
   "sub": "Book your free smile makeover consultation at {{name}}. We’ll scan your teeth, design your new smile with you, and give you a full itemised plan. No commitment required, and your booking deposit is refundable.",
   "tags": ["No obligation", "0% finance available", "Free consultation"]}],
 "thank_you": {"text": "Our team will be in touch to confirm your free smile makeover consultation. If you’d rather pick a time yourself, you can book online now.", "buttons": TY_BOOK}}
json.dump(no_story_cta(sm), open(f"{D}/smile-makeover.json", "w"), ensure_ascii=False, indent=1)

# ------------------------------------------------------------------ emergency
d = L("emergency")
why = [[i, t] for i, t in zip(d["WHY_ICONS"], d["WHY"])]
em = {
 "title": "Emergency dentist",
 "form": {"label": "Emergency appointment", "title": "Get seen as soon as possible", "sub": "Send your details and we’ll call you back to get you booked in.",
          "fields": [{"label": "Full name", "full": True}, "Email", "Mobile"], "note": "Your emergency appointment is £49. X-rays and treatment are costed and agreed first."},
 "sections": [
  {"block": "header"},
  {"block": "hero_form", "eyebrow": "Emergency dentist · Shepherd’s Bush, W12", "title": "Emergency dentist <b>£49</b>", "title_size": 52,
   "tagline": "In pain? Same-day appointments are often available.", "sub": "For severe pain, swelling, breakages and anything that can’t wait. Open Saturdays and until 7pm on Tuesdays, at our Shepherd’s Bush practice.",
   "ticks": ["Pain relief comes first", "New &amp; existing patients", "Open Saturdays", "0% finance on treatment"],
   "stats": [["5.0", "Google rating"], ["150+", "Patient reviews"], ["5", "2025 award wins"]], "stats_m": [["5.0", "Google rating"], ["150+", "Reviews"], ["5", "2025 awards"]],
   "device_gap_m": 150,
   "photo": {"src": "assets/photos/abeera-1600.jpg", "w": 1067, "h": 1600, "rows": [250, 1040], "cx": 560}},
  awards(d, "3 awards in 2024 · 5 in 2025"),
  {"block": "usp_text", "items": why},
  {"block": "story_cards", "sub": "Every smile is different. These are a few of the people who trusted us with theirs.", "items": d["STORIES"]},
  {"block": "pricing", "layout": "panel", "title": "Transparent pricing. Even in an emergency.",
   "sub": "One fixed fee to be seen, assessed and given a treatment plan. Our fees are fixed, so there are no surprises: the same price whatever the day or time.",
   "price_label": "Emergency appointment", "price": "£49", "price_note": "Fixed fee",
   "notes": ["Includes your clinical assessment, a treatment plan and a prescription if you need one. X-rays and treatment are charged separately, and every cost is agreed before we start.",
             "Out of hours: one fixed fee of £450, whatever the problem, including the assessment, small X-rays, antibiotic prescription and treatment such as an extraction or repairing a broken tooth.",
             "0% interest-free finance over up to 12 months on treatments over £300."],
   "photo": {"src": "assets/photos/concierge-patient.jpg", "pos": "50% 40%"}, "get": d["GET"]},
  {"block": "google_reviews", "sub": "5.0 stars from 150+ verified Google reviews.", "items": d["REVIEWS"]},
  {"block": "form_band", "name": "Get seen (form 2)", "tone": "light", "eyebrow": "Emergency appointment", "title": "Don’t wait in pain",
   "sub": "Same-day appointments are often available, and we aim to see you within 24 hours. Send your details and we’ll call you back.",
   "ticks": ["Pain relief comes first", "New &amp; existing patients", "Open Saturdays and late on Tuesdays", "Fixed fees, any day or time"]},
  {"block": "pain_points", "title": "If something feels wrong, don’t wait",
   "sub": "Dental emergencies rarely get better on their own. These are the problems we see, and treat, every day at our practice.", "items": d["FAMILIAR"],
   "close": "An emergency appointment at {{name}} means <b style=\"font-weight:600\">pain relief first, clear options second</b>, and nothing done without your agreement."},
  {"block": "explainer", "name": "Emergency care", "photo": {"src": "assets/photos/suite-consult.jpg"}, "eyebrow": "Emergency care",
   "title": "From first contact to fixed, as fast as we can get you in.",
   "text": "You don’t need to be an existing patient, and you won’t be left waiting in pain. Here’s exactly what happens when you contact us with an emergency.",
   "card": {"title": "What counts as a dental emergency?", "text": "Severe or persistent toothache, sudden swelling, a knocked-out or broken tooth, a lost crown or filling, or a broken brace or denture. If it hurts, or it can’t wait, it’s an emergency to us. And if you’re not sure, get in touch anyway: we’d far rather check something minor than let something serious wait."},
   "facts": d["FACTS"]},
  {"block": "steps", "title": "What happens when you get in touch", "items": d["STEPS"]},
  {"block": "services", "style": "icon", "name": "What we treat", "eyebrow": "What we treat", "title": "Same-day help, whatever the problem",
   "sub": "Our practice is equipped to diagnose and treat emergencies on the spot, with no referrals and no bouncing between practices.",
   "items": [{"icon": i, "title": t, "text": x} for (t, x), i in zip(d["TREAT"], d["TREAT_ICONS"])]},
  {"block": "why_us", "eyebrow": "Why {{name}}", "title": "Why patients trust us with their smiles",
   "items": [[i, t, x] for i, (t, x) in zip(d["WHY_SIHA_ICONS"], d["WHY_SIHA"])]},
  {"block": "meet_dentist", "name": "Dr Hannan", "role": "Director and Restorative Dentist · Founder · GDC 264888",
   "quote": "The best appointment is the one where nothing’s a surprise. We tell you exactly what we see and let you decide what happens next.",
   "creds": d["CREDS"], "photo": HANNAN_QUOTE},
  team(d), gallery("em"), faq(d),
  {"block": "final_cta", "eyebrow": "Don’t wait in pain", "title": "In pain? <b>Let’s get you seen</b>", "size": 50, "size_m": 32,
   "sub": "Same-day emergency appointments are often available at our Shepherd’s Bush practice. Pain relief first, honest advice always, and every cost agreed before treatment.",
   "tags": ["Open Saturdays", "Fixed fees", "0% finance available", "New patients welcome"]}],
 "thank_you": {"title": "Thank you. We’ll call you back.", "text": "Our team will call you as soon as possible to get you booked in. In a lot of pain? Call or WhatsApp us now and we’ll get you seen.",
   "buttons": [{"name": "Call (tracked as a conversion)", "label": "Call {{phone}}", "href": "tel:02046023510", "icon": "phone"},
               {"name": "WhatsApp (number TBC from Hannan)", "label": "WhatsApp us", "href": "#whatsapp-number-tbc", "icon": "chat"},
               {"label": "Choose a time online", "href": "{{booking_url}}", "style": "outline"}]}}
json.dump(no_story_cta(em), open(f"{D}/emergency.json", "w"), ensure_ascii=False, indent=1)
print("ok")
