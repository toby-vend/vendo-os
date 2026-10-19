"""Concept Dental page recipes (new patient, emergency, smile makeover) for the shared LP harness.

Copy comes from conceptdental.co.uk (read 19 Oct 2026: home, fees, dental-examination, emergency-dentist,
smile-makeover, meet-the-team) and the founding-patient offer in the brand guideline. No Google reviews and no
consented before-and-afters exist yet, so the story, review and results sections are left out (see NOTES.md).
Stock photos from the website are marked STOCK in NOTES.md with the real shot to replace each one.
Run: python3 make_pages.py, then build.py from scripts/lp-harness.
"""
import json
from pathlib import Path

P = "assets/photos/"
ZAIN = {"src": P + "dr-zain-concept-dental.jpg", "w": 1024, "h": 1136, "face": [381, 190, 251, 251]}
ANAS = {"src": P + "dr-anas-ashekhi-concept-dental.jpg", "w": 1024, "h": 1136, "face": [365, 171, 260, 260]}
SEAL = {"top": "Founding patient", "price": "£25", "bottom": "Check-up + X-rays", "was": "£50"}

FORM = {"fields": [{"label": "Full name", "full": True}, "Email", "Mobile"]}
USP = {"block": "usp_text", "hide_m": False, "label": "Four promises", "items": [
    ["calm", "Calm, patient-focused care, with sedation for nervous patients"],
    ["doctor", "Postgraduate-trained dentists in restorative, aesthetic and implant dentistry"],
    ["scan", "Modern equipment, including CBCT imaging and digital treatment planning"],
    ["plan", "Clear written pricing before anything starts"]]}
FIRST_VISIT = [
    ["Book an appointment", "Send us your details and we’ll arrange your first visit. No referral needed."],
    ["Consultation", "We assess your oral health, listen to your goals and explain your options in plain language."],
    ["Approval", "You get a written plan with confirmed prices. Nothing moves forward without your agreement."],
    ["Treatment", "In a calm, comfortable setting, at your own pace, with sedation available if you need it."],
    ["Aftercare", "Reviews, hygiene support and clear guidance to keep your results looking their best."]]
WHY = {"block": "why_us", "eyebrow": "How we work", "title": "Nothing moves forward <b>without your say-so.</b>", "items": [
    ["person", "We listen first", "Every appointment starts with understanding what you want from your care."],
    ["plan", "We explain your options", "What’s possible, what it involves and what it costs, before you commit to anything."],
    ["calm", "We support nervous patients", "If you need more time, more reassurance or sedation, we plan for it from the start."],
    ["card", "We put it in writing", "Your treatment plan and costs are confirmed in writing before treatment begins."],
    ["calendar", "Weekend and evening appointments", "Open Monday to Friday 9am to 6pm, and Saturday and Sunday 10:30am to 3pm."],
    ["pin", "On Toton Lane, Stapleford", "On-site parking, for patients across Stapleford, Beeston, Bramcote, Sandiacre and Long Eaton."]]}
TOUR = {"block": "practice_tour", "eyebrow": "Inside the practice", "title": "Take a look <b>around.</b>",
        "poster": P + "concept-dental-reception-waiting-area.jpg",
        "photos": [P + "concept-dental-front-desk.jpg", P + "dental-surgery-green-feature-wall.jpg",
                   P + "concept-dental-waiting-area.jpg", {"src": P + "dentist-talking-with-patient.jpg", "pos": "50% 30%"}]}
ZAIN_BIO = {"block": "meet_dentist", "name": "Dr Zain", "role": "Principal Dentist · GDC 283159",
            "quote": "Time to talk, clear explanations and a written plan with prices before any treatment begins. Whoever you see, that’s the approach.",
            "creds": ["BDS, MSc, MFDS RCS England, MFDS RCS Glasgow",
                      "Postgraduate Diploma in Restorative and Aesthetic Dentistry",
                      "Postgraduate Diploma in Implant Dentistry",
                      "Special interest in sedation, provided at the practice"],
            "photo": {"src": ZAIN["src"], "pos": "50% 0%"}}
ANAS_BIO = {"block": "meet_dentist", "name": "Dr Anas Ashekhi", "role": "Principal Dentist · GDC 274450",
            "quote": "Time to talk, clear explanations and a written plan with prices before any treatment begins. Whoever you see, that’s the approach.",
            "creds": ["BDS", "Postgraduate Diploma in Restorative and Aesthetic Dentistry",
                      "Postgraduate Diploma in Implant Dentistry",
                      "Smile makeovers are an area of special interest"],
            "photo": {"src": ANAS["src"], "pos": "50% 0%"}}
TY = {"text": "Our team will be in touch to confirm your appointment. If you’d rather pick a time yourself, you can book online now.",
      "buttons": [{"label": "Choose a time online", "href": "{{booking_url}}", "style": "primary"}]}


def page(title, form, sections, ty=TY, cta=None):
    out = {"title": title, "form": {**FORM, **form}, "sections": sections, "thank_you": ty}
    if cta:
        out["cta"] = cta
    return out


new_patient = page("New patient check-up", {
    "label": "Founding patient offer", "title": "Book your check-up", "sub": "No referral needed. New patients welcome.",
    "note": "£25 check-up, usually £50, including all X-rays."}, [
    {"block": "header"},
    {"block": "hero_form", "eyebrow": "New patients welcome · Stapleford, Nottingham", "title": "New patient check-up, <b>now £25.</b>",
     "tagline": "Been a while? No judgement here.",
     "sub": "A thorough check-up with all the X-rays you need, explained in plain language, at a calm new practice on Toton Lane.",
     "ticks": ["All X-rays included", "Written prices, no pressure", "Sedation available", "Weekend appointments"],
     "ticks_m": ["All X-rays included", "Written prices, no pressure"],
     "stats": [["£25", "Usually £50"], ["7", "Days a week"], ["2", "Principal dentists"]],
     "stats_m": [["£25", "Usually £50"], ["7", "Days a week"], ["2", "Dentists"]],
     "trust": False, "photo": ZAIN, "seal": SEAL, "device_gap_m": 270},
    USP,
    {"block": "pain_points", "title": "It’s been a while, <b>and that’s okay.</b>",
     "sub": "If it’s been years since your last visit, you won’t be judged for it. Whatever brought you here, we start with where things stand today.",
     "items": [["You haven’t seen a dentist in years", "Life got busy, or the last visit put you off. We start fresh, with no lectures."],
               ["You’re nervous about the dentist", "Agree a stop signal, take it at your pace, and ask about sedation if you need it."],
               ["Something doesn’t feel quite right", "Sensitivity, a chip, a filling that’s seen better days. Better looked at now than later."],
               ["You want to know the cost first", "Every recommendation comes with a written price before anything begins."],
               ["You want the same dentist each time", "You can ask to see the same dentist at every visit."],
               ["You’re looking for a family dentist", "Parents can stay throughout children’s appointments, and child check-ups are £20."]],
     "close": "Your check-up is a <b style=\"font-weight:500\">calm, honest look at your oral health</b>, with no pressure to decide anything on the day."},
    {"block": "pricing", "layout": "panel", "eyebrow": "Pricing", "title": "Clear, honest fees. <b>Always in writing.</b>",
     "sub": "You’ll always know the cost before treatment begins. Every plan comes with clear, written pricing, and we talk you through your options first.",
     "price_label": "Adult check-up, all X-rays included", "price": "£25", "price_note": "Usually £50",
     "notes": ["Children aged 0 to 12: £20.", "Routine hygiene: £75."],
     "photo": {"src": P + "dentist-xray-review-concept-dental.jpg", "pos": "40% 40%"},
     "get": [["A full check of teeth, gums and mouth", "With any X-rays you need, only where they’re clinically necessary"],
             ["Plain-language explanations", "We walk you through what we’ve found, with no jargon and no pressure"],
             ["A written plan if you need treatment", "What we recommend, why, and what it costs, before anything begins"],
             ["Your recall interval", "Usually every six to twelve months, set by the health of your teeth and gums"]]},
    {"block": "membership", "eyebrow": "Membership", "title": "Regular care, <b>spread monthly.</b>",
     "sub": "Check-ups and hygiene visits on a monthly Direct Debit, with 10% off private treatment. No assessment needed to join.",
     "groups": [{"label": "Plans", "sub": "From £9.99 a month", "plans": [
         {"name": "Plan A", "price": "£9.99", "who": "1 check-up, 1 hygiene visit", "featured": False,
          "feats": ["1 dental check-up a year", "1 hygiene visit a year", "10% off private treatment", "All small X-rays included", "Priority appointments", "Worldwide dental A&amp;E cover"]},
         {"name": "Plan B", "price": "£16.99", "who": "2 check-ups, 2 hygiene visits", "featured": True,
          "feats": ["2 dental check-ups a year", "2 hygiene visits a year", "10% off private treatment", "Free child check-up (1 child)", "All small X-rays included", "Priority appointments", "Worldwide dental A&amp;E cover"]},
         {"name": "Plan C", "price": "£26.99", "who": "2 check-ups, 2 hygiene visits, family", "featured": False,
          "feats": ["2 dental check-ups a year", "2 hygiene visits a year", "10% off private treatment", "Free child check-ups (up to 2 children)", "All small X-rays included", "Priority appointments", "Worldwide dental A&amp;E cover"]}]}]},
    {"block": "form_band", "name": "Book your check-up (form 2)", "eyebrow": "Founding patient offer", "title": "Start fresh, <b>for £25.</b>",
     "sub": "Book your first check-up at our new Stapleford practice. Usually £50, now £25 including all X-rays.",
     "ticks": ["All X-rays included", "Written plan with prices", "No referral needed", "Weekend appointments"], "form_title": "Book your check-up"},
    {"block": "explainer", "name": "Your first visit", "photo": {"src": P + "dentist-consultation-concept-dental-1.jpg", "pos": "72% 50%"},
     "eyebrow": "Your first visit", "title": "An unhurried check-up, <b>explained properly.</b>",
     "text": "We check your teeth, gums and mouth, take any X-rays you need, and walk you through what we’ve found in plain language.",
     "card": {"title": "What happens afterwards?", "text": "If everything is healthy, we’ll recommend how often to come back and how to look after your teeth at home. If you need treatment, you’ll leave with a written plan showing what we recommend, why, and what it costs. There’s no pressure to decide on the day."},
     "facts": ["All X-rays included", "No referral needed", "Same dentist each visit", "Sedation available"]},
    {"block": "steps", "eyebrow": "What to expect", "title": "Five calm steps, <b>at your pace.</b>", "items": FIRST_VISIT, "active": 0},
    {"block": "services", "style": "photo", "eyebrow": "Treatments", "title": "Everything under <b>one roof.</b>",
     "sub": "Our dentists’ postgraduate training means most treatments are planned and carried out here at the practice.",
     "items": [{"title": "Check-ups &amp; hygiene", "text": "Routine check-ups, hygiene from £75 and EMS AIRFLOW® polishing.", "photo": {"src": P + "dentist-treatment-concept-dental.jpg", "pos": "50% 40%"}},
               {"title": "Emergency dentistry", "text": "Appointments for pain, swelling and broken teeth, from £50 including X-rays.", "photo": {"src": P + "dentist-treating-patient.jpg", "pos": "50% 35%"}},
               {"title": "Nervous patients", "text": "Agreed stop signals, time to talk, and conscious sedation at the practice.", "photo": {"src": P + "serene-young-woman-with-closed-eyes-enjoying-the-s.jpg", "pos": "50% 30%"}},
               {"title": "Cosmetic dentistry", "text": "Whitening, composite bonding and veneers, with free whitening consultations.", "photo": {"src": P + "woman-admiring-her-healthy-white-smile-in-a-dental.jpg", "pos": "50% 30%"}},
               {"title": "Invisalign &amp; clear aligners", "text": "Discreet straightening from £2,000, with a free Invisalign consultation.", "photo": {"src": P + "pair-of-clear-plastic-orthodontic-aligners-on-a-gr.jpg", "pos": "50% 60%"}},
               {"title": "Dental implants", "text": "Planned with 3D CBCT imaging and placed by a postgraduate-trained implant dentist.", "photo": {"src": P + "dentist-xray-review-concept-dental.jpg", "pos": "40% 40%"}}]},
    WHY, ZAIN_BIO, TOUR,
    {"block": "faq", "items": [
        ["How much does a dental examination cost?", "An adult check-up, including X-rays, is currently £25 (usually £50). Children aged 0 to 12 are £20. Our membership plans include check-ups from £9.99 a month."],
        ["Do I need to be an existing patient to book?", "No. New patients are welcome and don’t need a referral."],
        ["Will I have X-rays at my examination?", "Only where they’re clinically necessary. We’ll always explain why we recommend one before taking it."],
        ["What if I am nervous about attending?", "Let us know when you book and we’ll go at your pace. Sedation is also available at the practice for patients who need extra support."],
        ["How often should I have a dental examination?", "For most patients, every six to twelve months. We’ll advise on the right interval for you based on the health of your teeth and gums."],
        ["Can I see the same dentist each time?", "Yes. You can ask to see the same dentist at every visit."]]},
    {"block": "final_cta", "eyebrow": "Get started", "title": "Calm, expert dentistry. <b>Now on Toton Lane.</b>", "size": 52, "size_m": 32,
     "sub": "Book your £25 check-up at Concept Dental &amp; Implant Clinic. All X-rays included, written prices, and no pressure to decide on the day.",
     "tags": ["No referral needed", "Weekend appointments", "On-site parking"], "trust": None, "form_title": "Book your check-up"}])

emergency = page("Emergency dentist", {
    "label": "Emergency appointment", "title": "Get seen as soon as possible", "sub": "Send your details and we’ll call you back to arrange an appointment.",
    "note": "Emergency appointment £50, including X-rays."}, [
    {"block": "header"},
    {"block": "hero_form", "eyebrow": "Emergency dentist · Stapleford, Nottingham", "title": "Emergency dentist, <b>£50.</b>",
     "tagline": "In pain? We’ll see you as quickly as possible.",
     "sub": "Appointments for pain, swelling, broken teeth and lost fillings, including X-rays. Weekend and out-of-hours appointments available.",
     "ticks": ["X-rays included", "New patients welcome", "Weekend appointments", "Written prices before follow-up"],
     "ticks_m": ["X-rays included", "Weekend appointments"],
     "stats": [["£50", "Inc. X-rays"], ["£200", "Out of hours, inc. treatment"], ["7", "Days a week"]],
     "stats_m": [["£50", "Inc. X-rays"], ["£200", "Out of hours"], ["7", "Days a week"]],
     "trust": False, "photo": ZAIN, "device_gap_m": 285},
    USP,
    {"block": "pain_points", "title": "If it can’t wait, <b>neither should you.</b>",
     "sub": "We treat urgent dental problems at our Stapleford practice. If you’re not sure whether it counts, get in touch: we’d always rather reassure you than have you waiting at home in pain.",
     "items": [["Severe toothache or facial swelling", "Persistent pain or swelling that won’t settle with pain relief."],
               ["A knocked-out or displaced tooth", "The sooner it is repositioned, the better the chance of saving it."],
               ["A cracked, chipped or fractured tooth", "Stabilised and protected before it gets worse."],
               ["A lost or broken filling or crown", "Covered and repaired so the tooth underneath is protected."],
               ["A dental abscess or infection", "This needs urgent treatment, so don’t wait to see whether it settles."],
               ["A broken or painful denture", "Made comfortable so you can eat properly again."]]},
    {"block": "pricing", "layout": "panel", "eyebrow": "Pricing", "title": "Clear fees, <b>even in an emergency.</b>",
     "sub": "You get a written plan with prices before any follow-up treatment begins.",
     "price_label": "Emergency appointment", "price": "£50", "price_note": "Including X-rays",
     "notes": ["Weekend and out of hours: £200, including treatment.", "You don’t need to be an existing patient."],
     "photo": {"src": P + "dentist-treating-patient.jpg", "pos": "50% 35%"},
     "get": [["An urgent assessment", "We find out exactly what’s happening, taking X-rays where needed"],
             ["Treatment at the appointment", "We treat the source of your pain or injury wherever possible"],
             ["A clear follow-up plan", "Any further treatment explained on the day, with costs confirmed in writing"],
             ["Support if you’re nervous", "Tell us and we’ll go at your pace. Sedation is available at the practice"]]},
    {"block": "form_band", "name": "Get seen (form 2)", "eyebrow": "Emergency appointment", "title": "Don’t wait <b>in pain.</b>",
     "sub": "Send us your details and we’ll call you back to arrange an appointment as quickly as possible.",
     "ticks": ["£50 including X-rays", "New patients welcome", "Weekend and out-of-hours appointments", "Written prices before follow-up"]},
    {"block": "explainer", "name": "In an emergency", "photo": {"src": P + "young-woman-with-toothache-sitting-in-a-dental-cli.jpg", "pos": "45% 30%"},
     "eyebrow": "While you wait", "title": "What to do <b>in a dental emergency.</b>",
     "text": "Over-the-counter pain relief such as ibuprofen or paracetamol can help while you wait, but don’t apply aspirin directly to the gum. If swelling is spreading to your face, jaw or neck, seek urgent medical attention.",
     "card": {"title": "Knocked-out tooth?", "text": "Handle the tooth by the crown only, not the root. If it is clean, try to place it back in the socket or store it in milk, and get to us as quickly as possible."},
     "facts": ["X-rays included", "Weekend appointments", "No registration needed", "Sedation available"]},
    {"block": "steps", "eyebrow": "Your emergency appointment", "title": "What happens <b>when you get in touch.</b>", "active": 0, "items": [
        ["Get in touch", "We assess how urgent your situation is and arrange an appointment as quickly as possible."],
        ["Assessment", "We assess the problem, taking X-rays where needed, so we know exactly what is happening."],
        ["Treatment", "We treat the source of your pain or injury wherever possible: draining an abscess, stabilising a tooth or replacing a lost filling."],
        ["Follow-up plan", "If further treatment is needed, we explain it on the day and confirm the costs in writing."]]},
    {"block": "services", "style": "icon", "name": "What we treat", "eyebrow": "What we treat", "title": "Urgent care, <b>at the practice.</b>",
     "sub": "Emergency appointments are carried out by one of our GDC-registered dentists.",
     "items": [{"icon": "toothache", "title": "Toothache &amp; swelling", "text": "Pain treated at the source, not just masked."},
               {"icon": "knocked", "title": "Knocked-out teeth", "text": "Repositioned as quickly as possible to give the tooth its best chance."},
               {"icon": "crack", "title": "Cracked or broken teeth", "text": "Stabilised and protected at the appointment wherever possible."},
               {"icon": "crown", "title": "Lost fillings &amp; crowns", "text": "Exposed teeth covered and protected."},
               {"icon": "shield", "title": "Abscesses &amp; infection", "text": "Urgent treatment for infection, including draining an abscess."},
               {"icon": "smile", "title": "Denture problems", "text": "Broken or ill-fitting dentures made comfortable again."}]},
    WHY, ZAIN_BIO, TOUR,
    {"block": "faq", "items": [
        ["How quickly can I be seen for a dental emergency?", "Get in touch and we will arrange an appointment as quickly as possible. Weekend and out-of-hours appointments are also available."],
        ["How much is an emergency appointment?", "Emergency appointments are £50, including X-rays. Weekend and out-of-hours appointments are £200, including treatment. You get a written plan with prices before any follow-up treatment begins."],
        ["What counts as a dental emergency?", "Significant pain, swelling, injury or the sudden loss of a filling or crown that is affecting your ability to eat or function. If you’re unsure, get in touch and we’ll advise you."],
        ["Do I need to be a registered patient?", "No. You do not need to be an existing patient to have an emergency appointment at Concept Dental."],
        ["Will I need follow-up treatment?", "In most cases, yes. Emergency appointments focus on resolving the immediate problem, and definitive treatment is usually carried out at a follow-up appointment with costs confirmed in writing beforehand."]]},
    {"block": "final_cta", "eyebrow": "Don’t wait in pain", "title": "In pain? <b>Let’s get you seen.</b>", "size": 52, "size_m": 32,
     "sub": "Emergency appointments at our Stapleford practice are £50 including X-rays, with weekend and out-of-hours appointments available.",
     "tags": ["New patients welcome", "Weekend appointments", "On-site parking"], "trust": None, "form_title": "Get seen as soon as possible"}],
    ty={"title": "Thank you. We’ll call you back.", "text": "Our team will call you as soon as possible to arrange your emergency appointment.",
        "buttons": [{"label": "Choose a time online", "href": "{{booking_url}}", "style": "primary"}]})

smile = page("Smile makeover", {
    "label": "Smile makeover consultation", "title": "Book your consultation", "sub": "An unhurried consultation, with options, stages and costs explained before anything begins.",
    "note": "Invisalign and whitening consultations are free."}, [
    {"block": "header"},
    {"block": "hero_form", "eyebrow": "Smile makeovers · Stapleford, Nottingham", "title": "A smile makeover, <b>planned around you.</b>", "title_size": 54,
     "tagline": "Whitening from £250. Invisalign from £2,000.",
     "sub": "A planned combination of cosmetic treatments, in the right order, with a written plan and confirmed prices before you commit.",
     "ticks": ["Written plan, confirmed prices", "Free Invisalign consultation", "Free whitening consultation", "Treatment in stages"],
     "ticks_m": ["Written plan, confirmed prices", "Free Invisalign consultation"],
     "stats": [["£250", "Whitening, usually £350"], ["£2,000", "Invisalign from"], ["£695", "E.max veneers"]],
     "stats_m": [["£250", "Whitening"], ["£2,000", "Invisalign"], ["£695", "Veneers"]],
     "trust": False, "photo": ANAS, "device_gap_m": 245},
    USP,
    {"block": "pain_points", "title": "More than one thing <b>you’d like to change?</b>",
     "sub": "A smile makeover may suit you if there’s more than one thing about your smile you’d like to change. If only one thing bothers you, a single treatment may be all you need, and we’ll tell you so.",
     "items": [["Discoloured or stained teeth", "Coffee, tea and time have taken the brightness out of your smile."],
               ["Chipped, worn or uneven teeth", "Edges that have lost their shape over the years."],
               ["Gaps between teeth", "Spacing you’d like closed or evened out."],
               ["Crooked or crowded teeth", "One or two teeth sitting out of line."],
               ["You want it done in the right order", "Straightening, whitening and bonding planned to work together."],
               ["You want to know the full cost", "Every stage priced in writing before you commit."]],
     "close": "Your teeth and gums need to be healthy first, so if we find decay or gum disease, <b style=\"font-weight:500\">we treat that first and include it in your plan.</b>"},
    {"block": "pricing", "layout": "cards", "tone": "panel", "eyebrow": "Pricing", "title": "Clear prices, <b>stage by stage.</b>",
     "sub": "The cost depends on which treatments are in your plan and how many teeth are involved. You see the full cost in writing before treatment begins.",
     "items": [{"tag": "Brighter", "name": "Teeth whitening", "desc": "Lightens your natural teeth. Usually done before bonding or veneers so new work matches.", "price": "£250", "unit": "usually £350", "feats": ["Free whitening consultation", "Dentist-led", "Before bonding or veneers"]},
               {"tag": "Straighten first", "name": "Invisalign &amp; clear aligners", "desc": "Discreet straightening, usually the first stage so later work fits your teeth in their new position.", "price": "£2,000", "unit": "from", "feats": ["Free Invisalign consultation", "No fixed braces", "Planned around your bite"], "featured": True},
               {"tag": "Shape &amp; shade", "name": "Bonding &amp; veneers", "desc": "Composite bonding to repair chips and close gaps, or E.max veneers to change shape and shade.", "price": "£695", "unit": "E.max veneers", "feats": ["Composite bonding £300", "Shade matched to your whitened teeth", "Planned in your written plan"]}],
     "finance": {"title": "Flexible finance", "text": "Flexible finance options to spread the cost of treatment, with clear pricing agreed before anything begins.", "aside": "Ask about finance at your consultation."}},
    {"block": "spotlight", "name": "Planned in the right order", "photo": {"src": ANAS["src"], "pos": "50% 0%"},
     "badge": {"name": "Dr Anas Ashekhi", "role": "Principal Dentist · GDC 274450"}, "eyebrow": "How we plan it",
     "title": "The order of treatment <b>matters.</b>",
     "sub": "Smile makeovers are an area of special interest for Dr Anas. Your written plan sets out each treatment, the order we’ll carry them out in and the cost of each stage.",
     "items": [["aligners", "Straightening first", "So any bonding or veneers are designed around your teeth in their new position."],
               ["whitening", "Whitening before bonding", "Whitening doesn’t change the colour of composite or porcelain, so we match new work to your whitened shade."],
               ["calendar", "In stages, when you’re ready", "Start with one treatment and continue when you’re ready. We’ll tell you if a stage needs to follow on."]]},
    {"block": "form_band", "name": "Book a consultation (form 2)", "eyebrow": "Smile makeover consultation", "title": "See your options <b>before you commit.</b>",
     "sub": "We talk through what you’d like to change, examine your teeth and gums, and explain which treatments could achieve it, and in what order.",
     "ticks": ["Free Invisalign consultation", "Free whitening consultation", "Written plan with prices", "Treatment in stages"], "form_title": "Book your consultation"},
    {"block": "explainer", "name": "What is a smile makeover", "photo": {"src": P + "woman-admiring-her-healthy-white-smile-in-a-dental.jpg", "pos": "50% 30%"},
     "eyebrow": "The treatment", "title": "Two or more treatments, <b>working together.</b>",
     "text": "A smile makeover combines two or more cosmetic treatments, carried out in a planned order, to change the look of your smile.",
     "card": {"title": "As simple, or as complete, as you need", "text": "It might be as simple as whitening followed by bonding on a couple of front teeth, or a longer plan that starts with straightening. Every plan is bespoke, and we recommend only what suits your smile."},
     "facts": ["Bespoke plan", "Confirmed prices", "Treatment in stages", "Free consultations"]},
    {"block": "steps", "eyebrow": "Your smile makeover journey", "title": "From first chat <b>to final result.</b>", "active": 0, "items": [
        ["Your goals", "We talk through what you’d like to change and examine your teeth and gums."],
        ["Your options", "We explain which treatments could achieve it, and in what order."],
        ["Your written plan", "You receive a written plan with confirmed prices before you commit to anything."],
        ["Your treatment", "Each treatment in the order set out in your plan, then we review the result with you."]]},
    {"block": "services", "style": "icon", "name": "Treatments we combine", "eyebrow": "Treatments we combine", "title": "What can your makeover <b>include?</b>",
     "sub": "Every plan is different. Yours is built from whichever of these your smile actually needs.",
     "items": [{"icon": "aligners", "title": "Invisalign", "text": "Clear aligners to straighten your teeth, from £2,000."},
               {"icon": "whitening", "title": "Teeth whitening", "text": "Lightens your natural teeth. Currently £250 (usually £350)."},
               {"icon": "bonding", "title": "Composite bonding", "text": "Tooth-coloured resin to repair chips, close gaps and reshape teeth."},
               {"icon": "veneers", "title": "Veneers", "text": "Thin coverings that change the shape and shade of your teeth. E.max veneers are £695."},
               {"icon": "air", "title": "Hygiene &amp; air polish", "text": "Often a good starting point, so treatment begins on clean, stain-free teeth."},
               {"icon": "droplet", "title": "White spot removal", "text": "Treatment for white marks on the teeth, discussed at your consultation."}]},
    WHY, ANAS_BIO, TOUR,
    {"block": "faq", "items": [
        ["How many treatments make a smile makeover?", "Usually two or more, chosen to work together. We recommend only what suits your smile, so your plan might be shorter than you expect."],
        ["Why does the order of treatment matter?", "Straightening first means bonding or veneers fit your teeth in their final position, and whitening first means your new work can be matched to your whitened shade."],
        ["Can I have treatment in stages?", "Yes. Because your plan is set out in stages, you can start with one treatment and continue when you are ready. We will tell you if any stage needs to follow on from another."],
        ["Do I need a consultation first?", "Yes. We need to see your teeth and gums and hear what you would like to change before we can plan treatment. Invisalign and whitening consultations are free."],
        ["How long does a smile makeover take?", "It depends on the treatments you choose. A plan that includes straightening takes longer than one based on whitening and bonding. We set out the timeline in your written plan."]]},
    {"block": "final_cta", "eyebrow": "Get started", "title": "One plan, <b>at your pace.</b>", "size": 52, "size_m": 32,
     "sub": "Book your smile makeover consultation at Concept Dental &amp; Implant Clinic. Options, stages and costs explained before anything begins.",
     "tags": ["Free Invisalign consultation", "Free whitening consultation", "On-site parking"], "trust": None, "form_title": "Book your consultation"}],
    ty={"text": "Our team will be in touch to confirm your consultation. If you’d rather pick a time yourself, you can book online now.",
        "buttons": [{"label": "Choose a time online", "href": "{{booking_url}}", "style": "primary"}]},
    cta="Book Consultation")

out = Path(__file__).parent / "pages"
out.mkdir(exist_ok=True)
for name, spec in [("new-patient", new_patient), ("emergency", emergency), ("smile-makeover", smile)]:
    (out / f"{name}.json").write_text(json.dumps(spec, ensure_ascii=False, indent=1))
print("wrote pages")
