"""Body sections of the Siha emergency dentist landing page.

Shared building blocks come from common.py (copy of the check-up page's sections). Content follows the live draft
with these fixes (6 Oct 2026):
- price: £95 everywhere, per Toby (the draft mixed £95 and £49; Siha's fees page lists £49 / £69)
- "We'll see you today" softened to Siha's own wording: same-day appointments often available, aim to see you within 24h
- Saturday + late-Tuesday availability (Siha Client Bio hook; site hours Tue 10-7, Sat 9-5)
- one practice: all "clinics", "nearest clinic", "four London locations", "central London" removed
- other-clinic template testimonials replaced with real Google reviews; no unverifiable superlatives
"""
import common
from common import sec, head, grid, photo, mark, cta_row, awards, why_choose, reviews, gallery, faq, why_siha
from build import C, LOGO, TICK_SVG, CTA, PHONE, stars, tick, form_card, nav_d, nav_m

# ---------------------------------------------------------------- patient stories (real Google reviews on the draft page)
common.STORIES = [
    ("Emergency care", "At a time when no other dentist was willing to help, Dr Hannan took the time to see me and went above and beyond to make sure I received the treatment and care I needed.", "Kate Barry"),
    ("Chipped teeth repaired", "I came in with chipped front teeth and he restored them to perfection with composite bonding. You cannot even tell they were ever damaged.", "Hoda Munchow"),
    ("Calm, clear care", "I have always been treated with respect and given clear explanations about my treatment plan and what to expect.", "Diane Redmond"),
]
stories = common.stories
common.REVIEWS = [("Samantha Cooper", "Dr. Hannan really listened to my concerns and took great care in achieving a result far better than I could have imagined."),
                  ("Sheela Vaghela", "They explained everything properly at every stage, so I always knew exactly what was happening and what to expect, which made the whole experience feel so comfortable and reassuring."),
                  ("Daniel", "Excellent service from Siha. I’ve had aligners and used their hygienist and was really happy with the process and results.")]

# ---------------------------------------------------------------- pricing (Siha adult treatment costs)
GET = [("Prompt assessment", "A full examination of the problem to find the cause, not just the symptom"),
       ("Pain relief first", "Our first priority is getting you comfortable before anything else is discussed"),
       ("Clear, costed options", "Every option explained upfront. Nothing is done without your agreement"),
       ("A follow-up plan", "If a filling, crown or root canal is needed, it’s scheduled before you leave")]


def pricing(m):
    price = f'''<div class="card" data-name="Price card" style="background:{C['od']};color:{C['nu']};padding:{32 if m else 56}px;display:flex;flex-direction:column">
      <div class="label" style="color:{C['bo']}">Pricing</div>
      <h2 class="h1" style="margin-top:14px;font-size:{30 if m else 40}px;color:{C['nu']}">Transparent pricing. Even in an emergency.</h2>
      <p class="body" style="margin-top:16px;color:{C['be']}">One flat fee to be seen and diagnosed. If treatment is needed, every option is costed and explained before we do anything, so there are no surprises on a difficult day.</p>
      <div style="margin-top:{32 if m else 44}px;padding-top:28px;border-top:1px solid rgba(225,213,202,.2)">
        <div class="label" style="color:{C['be']}">Emergency appointment</div>
        <div style="display:flex;align-items:baseline;gap:16px;margin-top:8px"><span style="font-weight:300;font-size:{72 if m else 96}px;line-height:1">£95</span><span class="body" style="color:{C['be']}">Assessment + advice</span></div>
        <p class="body" style="margin-top:14px;font-size:14px;color:{C['be']}">Covers being seen, examined and diagnosed. Any treatment is costed and agreed before we start.</p>
        <p class="body" style="margin-top:14px;font-size:14px;color:{C['be']}">Out of hours: £450, including the assessment, small X-rays, antibiotic prescription and treatment such as an extraction or repairing a broken tooth.</p>
        <p class="body" style="margin-top:14px;font-size:14px;color:{C['be']}">0% interest-free finance over up to 12 months on treatments over £300.</p>
      </div>
      <span class="btn beige" style="margin-top:32px;align-self:flex-start">{CTA}</span>
    </div>'''
    rows = "".join(f'''<div style="display:flex;gap:18px;padding:22px 0;border-bottom:1px solid rgba(20,33,26,.12)">
        <i style="flex:none;width:36px;height:36px;border-radius:50%;background:{C['nu']};display:flex;align-items:center;justify-content:center">{TICK_SVG}</i>
        <div><div class="h3">{t}</div><div class="body" style="color:{C['ol']};margin-top:4px">{d}</div></div></div>''' for t, d in GET)
    right = f'''<div style="display:flex;flex-direction:column">
      {photo("concierge-patient.jpg", 220 if m else 260, pos="50% 40%")}
      <div class="label" style="color:{C['bo']};margin-top:32px">What you get</div>
      <div style="margin-top:6px">{rows}</div></div>'''
    return sec("Pricing", grid([price, right], 1 if m else 2, 32 if m else 48), m, bg=C['be'])


# ---------------------------------------------------------------- CTA #2 with form
def cta_form(m):
    left = f'''<div style="display:flex;flex-direction:column;justify-content:center">
      {head("Emergency appointment", "Don’t wait in pain", "Same-day appointments are often available, and we aim to see you within 24 hours. Send your details and we’ll call you back.", m, width=520)}
      <div style="display:grid;gap:12px;margin-top:28px">{tick("Pain relief comes first")}{tick("New &amp; existing patients")}{tick("Open Saturdays and late on Tuesdays")}{tick("Every cost agreed before treatment")}</div>
      <p class="body" style="margin-top:28px;color:{C['ol']}">In severe pain? Call <b style="font-weight:600;color:{C['od']}">{PHONE}</b></p></div>'''
    form = form_card(350 if m else 520, 24 if m else 40)
    body = grid([left, form], 1, 32) if m else f'<div style="display:grid;grid-template-columns:1fr 520px;gap:96px;align-items:center">{left}{form}</div>'
    return sec("Get seen (form 2)", body, m)


# ---------------------------------------------------------------- sound familiar
FAMILIAR = [("Severe toothache that won’t settle", "Persistent, throbbing pain is your tooth telling you something is wrong. We’ll find the cause, not just mask it."),
            ("Swelling or an abscess", "Sudden facial swelling or a gum abscess can escalate quickly and should be assessed the same day."),
            ("A chipped, cracked or broken tooth", "Whether it happened at dinner or at five-a-side, we’ll protect what’s left and restore the tooth."),
            ("A knocked-out tooth", "Time matters most here. Treated quickly enough, a knocked-out tooth can sometimes be saved. Contact us immediately."),
            ("A lost filling or crown", "An exposed tooth is vulnerable and often painful. We’ll cover and rebuild it before it gets worse."),
            ("Broken dentures, braces or implants", "Sharp wires, loose appliances or a cracked denture: we’ll make it safe and get it properly fixed.")]


def familiar(m):
    cards = [f'''<div class="card" data-name="Situation" style="background:{C['wh']};padding:{28 if m else 36}px">
      <div class="h3">{t}</div><p class="body" style="margin-top:10px;color:{C['ol']}">{d}</p></div>''' for t, d in FAMILIAR]
    close = (f'<p style="margin:{36 if m else 56}px auto 0;max-width:860px;{"" if m else "text-align:center;"}font-size:{20 if m else 24}px;font-weight:300;line-height:1.45">'
             'An emergency appointment at Siha Dental &amp; Facial means <b style="font-weight:600">pain relief first, clear options second</b>, and nothing done without your agreement.</p>')
    inner = (head("Sound familiar?", "If something feels wrong, don’t wait",
                  "Dental emergencies rarely get better on their own. These are the problems we see, and treat, every day at our practice.", m, center=not m)
             + f'<div style="margin-top:{32 if m else 56}px">{grid(cards, 1 if m else 3, 20)}</div>' + close)
    return sec("Sound familiar", inner, m)


# ---------------------------------------------------------------- emergency care
FACTS = ["Same-day appointments often available", "Pain relief comes first", "New patients welcome", "Costs agreed before treatment"]


def care(m):
    left = photo("asiya-magnification.jpg", 360 if m else 680, pos="45% 50%")
    right = f'''<div style="display:flex;flex-direction:column;justify-content:center">
      {head("Emergency care", "From first contact to fixed, as fast as we can get you in.", None, m, width=560)}
      <p class="body" style="margin-top:18px;color:{C['ol']}">You don’t need to be an existing patient, and you won’t be left waiting in pain. Here’s exactly what happens when you contact us with an emergency.</p>
      <div class="card" style="background:{C['be']};padding:28px;margin-top:28px">
        <div class="h3">What counts as a dental emergency?</div>
        <p class="body" style="margin-top:10px;color:{C['ol']};font-size:15px">Severe or persistent toothache, sudden swelling, a knocked-out or broken tooth, a lost crown or filling, or a broken brace or denture. If it hurts, or it can’t wait, it’s an emergency to us. And if you’re not sure, get in touch anyway: we’d far rather check something minor than let something serious wait.</p>
      </div>
      <div class="label" style="color:{C['bo']};margin-top:28px">Key facts</div>
      <div style="display:grid;grid-template-columns:{'1fr' if m else '1fr 1fr'};gap:14px 20px;margin-top:14px">{"".join(tick(f, 15) for f in FACTS)}</div>
    </div>'''
    return sec("Emergency care", grid([left, right], 1 if m else 2, 32 if m else 72), m)


# ---------------------------------------------------------------- how it works
STEPS = [("Get in touch", "Tell us what’s happened and where it hurts. We’ll book you into the first available appointment, often the same day."),
         ("Advice while you wait", "We’ll give you interim guidance: pain relief, cold compresses, or how to preserve a knocked-out tooth."),
         ("Assessment &amp; immediate care", "Your dentist finds the cause, relieves the pain and treats what can be treated on the day."),
         ("Your follow-up plan", "If more work is needed, such as a filling, crown or root canal, it’s costed, explained and scheduled before you leave.")]


def how(m):
    cards = [f'''<div data-name="Step" style="border-top:1.5px solid {C['od']};padding-top:24px">
      <div style="font-weight:300;font-size:{40 if m else 56}px;line-height:1;color:{C['bo']}">{i + 1:02d}</div>
      <div class="h3" style="margin-top:20px">{t}</div><p class="body" style="margin-top:8px;color:{C['ol']}">{d}</p></div>''' for i, (t, d) in enumerate(STEPS)]
    return sec("How it works", head("How it works", "What happens when you get in touch", None, m)
               + f'<div style="margin-top:{32 if m else 56}px">{grid(cards, 1 if m else 4, 28 if m else 40)}</div>' + cta_row(m), m, bg=C['be'])


# ---------------------------------------------------------------- what we treat
TREAT = [("Toothache &amp; abscesses", "Fast diagnosis and relief for severe pain, infection and swelling, treated at the source."),
         ("Chips, cracks &amp; breaks", "Tooth-coloured repairs that protect the tooth and blend in with your smile."),
         ("Root canal treatment", "Gentle, modern endodontics to save a painful tooth rather than lose it."),
         ("Knocked-out teeth", "Rapid treatment that gives a knocked-out or loosened tooth its best chance of being saved."),
         ("Lost fillings &amp; crowns", "Exposed teeth covered and rebuilt before small problems become big ones."),
         ("Denture, brace &amp; implant problems", "Broken dentures, sharp wires and loose appliances made safe and properly repaired.")]


def treat(m):
    cards = [f'''<div class="card" data-name="Treatment" style="background:{C['wh']};padding:{28 if m else 36}px">
      {mark(C['bo'], 22)}<div class="h3" style="margin-top:18px">{t}</div><p class="body" style="margin-top:8px;color:{C['ol']};font-size:15px">{d}</p></div>''' for t, d in TREAT]
    return sec("What we treat", head("What we treat", "Same-day help, whatever the problem",
                                     "Our practice is equipped to diagnose and treat emergencies on the spot, with no referrals and no bouncing between practices.", m)
               + f'<div style="margin-top:{32 if m else 56}px">{grid(cards, 1 if m else 3, 20 if m else 24)}</div>', m)


# ---------------------------------------------------------------- why siha
common.WHY_SIHA = [("GDC-registered dentists", "GDC-registered dentists trained to handle both simple and complex cases."),
                   ("Founder-led care", "Dr. Hannan Imran is personally involved in the standard of care across all treatments."),
                   ("Open Saturdays and late Tuesdays", "Saturdays 9am to 5pm and Tuesdays until 7pm, with out-of-hours appointments available."),
                   ("Rated 5.0★ by patients", "150+ verified Google reviews from real patients, consistency you can check for yourself."),
                   ("0% finance &amp; membership", "0% interest-free finance, so an unexpected emergency doesn’t have to mean an unexpected bill."),
                   ("Digital-first diagnostics", "Modern, digital-first diagnostics that find the cause of the problem fast and accurately.")]


# ---------------------------------------------------------------- meet your dentist
CREDS = ["Newcastle University School of Dental Science graduate",
         "MFDS, Royal College of Surgeons (Edinburgh)",
         "PG Certificate in Restorative Dentistry, Eastman Dental Institute",
         "Member, British Society of Restorative Dentistry"]


def dentist(m):
    creds = "".join(f'<div class="body" style="font-size:15px;color:{C["ol"]};display:flex;gap:10px"><span style="color:{C["bo"]}">•</span><span>{c}</span></div>' for c in CREDS)
    text = f'''<div style="display:flex;flex-direction:column;justify-content:center">
      <div class="label" style="color:{C['bo']}">Meet your dentist</div>
      <h2 class="h1" style="margin-top:14px;font-size:{32 if m else 44}px">Dr. Hannan Imran</h2>
      <div class="body" style="color:{C['br']}">Director and Restorative Dentist · Founder · GDC 264888</div>
      <p style="font-weight:300;font-size:{21 if m else 26}px;line-height:1.45;margin-top:28px;padding-left:24px;border-left:2px solid {C['bo']}">“When someone arrives in pain, our first job is to make it stop. Options, costs and next steps come once you’re comfortable, in that order.”</p>
      <div style="display:grid;gap:10px;margin-top:28px">{creds}</div></div>'''
    pic = photo("hannan-2.jpg", 380 if m else 560, pos="50% 22%")
    return sec("Meet your dentist", grid([pic, text] if m else [text, pic], 1 if m else 2, 32 if m else 96), m, bg=C['be'])


# ---------------------------------------------------------------- faq
common.FAQ = [
    ("How quickly can I be seen?", "Same-day appointments are often available, and we aim to see you within 24 hours. Get in touch as early in the day as you can and we’ll book you into the first available appointment. If you’re in severe pain, call us on 020 4602 3510."),
    ("How much does an emergency appointment cost?", None), ("I’m not a Siha Dental &amp; Facial patient. Can I still come in?", None),
    ("What should I do with a knocked-out tooth?", None), ("Will I be treated on the same day?", None),
    ("Do you offer evening and weekend appointments?", None), ("Can I spread the cost of treatment?", None),
    ("I’m anxious about the dentist. Will that be a problem?", None)]
# Collapsed answers for the build: cost = £95 emergency appointment (seen, examined and diagnosed),
# treatment costed separately; evenings/weekends = Tue until 7pm, Sat 9-5,
# out-of-hours emergency + treatment £450. No "clinics"/"four London locations".


# ---------------------------------------------------------------- final cta + footer
def final(m):
    left = f'''<div style="display:flex;flex-direction:column;justify-content:center">
      <div class="label" style="color:{C['bo']}">Don’t wait in pain</div>
      <h2 class="display" style="margin-top:18px;color:{C['nu']};font-size:{32 if m else 50}px">In pain? <b>Let’s get you seen</b></h2>
      <p class="body" style="margin-top:20px;color:{C['be']};font-size:{16 if m else 18}px">Same-day emergency appointments are often available at our Shepherd’s Bush practice. Pain relief first, honest advice always, and every cost agreed before treatment.</p>
      <p class="body" style="margin-top:24px;color:{C['be']}">In severe pain? Call <b style="color:{C['nu']};font-weight:600">{PHONE}</b></p>
      <div style="display:flex;gap:28px;margin-top:20px;flex-wrap:wrap">
        <span class="label" style="color:{C['be']};font-weight:500">Open Saturdays</span><span class="label" style="color:{C['be']};font-weight:500">0% finance available</span><span class="label" style="color:{C['be']};font-weight:500">New patients welcome</span></div>
      <div style="display:flex;align-items:center;gap:12px;margin-top:28px">{stars(5, 16)}<span class="body" style="color:{C['be']};font-size:14px">5.0 from 157 Google reviews</span></div>
    </div>'''
    form = form_card(350 if m else 500, 24 if m else 40)
    inner = grid([left, form], 1, 32) if m else f'<div style="display:grid;grid-template-columns:1fr 500px;gap:96px;align-items:center">{left}{form}</div>'
    foot = f'''<div data-name="Footer" style="margin-top:{56 if m else 96}px;padding-top:32px;border-top:1px solid rgba(225,213,202,.2);display:flex;{'flex-direction:column;gap:16px' if m else 'justify-content:space-between;align-items:center'}">
      <div style="width:130px;color:{C['be']}">{LOGO}</div>
      <span class="body" style="font-size:13px;color:{C['be']}">157 Askew Road, London W12 9AU · {PHONE}</span>
      <span class="body" style="font-size:13px;color:{C['br']}">© 2026 Siha Dental &amp; Facial. All rights reserved. <u>Privacy policy</u> · Marketing by Vendo Digital</span></div>'''
    return sec("Final CTA", inner + foot, m, bg=C['od'])


from team import team

BODY = [awards, why_choose, stories, pricing, reviews, cta_form, familiar, care, how, treat, why_siha, dentist, team, gallery, faq, final]


# ---------------------------------------------------------------- thank-you page (emergency: lead with the phone)
def thank_you(m):
    big_tick = TICK_SVG.replace('width="12" height="12"', 'width="26" height="26"')
    card = f'''<div class="card" data-name="Confirmation" style="background:{C['wh']};max-width:720px;margin:0 auto;padding:{32 if m else 64}px;text-align:center;box-shadow:0 30px 60px rgba(20,33,26,.10)">
      <div style="width:64px;height:64px;border-radius:50%;background:{C['be']};display:flex;align-items:center;justify-content:center;margin:0 auto">{big_tick}</div>
      <div class="label" style="color:{C['bo']};margin-top:28px">Request received</div>
      <h1 class="h1" style="margin-top:12px;font-size:{32 if m else 44}px">Thank you. We’ll call you back.</h1>
      <p class="body" style="margin-top:16px;color:{C['ol']};font-size:{16 if m else 18}px">Our team will call you as soon as possible to get you booked in. If you’re in severe pain, call us now. You can also pick a time online.</p>
      <div style="display:flex;{'flex-direction:column;' if m else ''}gap:16px;justify-content:center;align-items:center;margin-top:32px">
        <span class="btn primary">Call {PHONE}</span><span class="btn outline">Choose a time online</span></div>
      <p class="body" style="margin-top:28px;font-size:14px;color:{C['br']}">157 Askew Road, London W12 9AU</p>
    </div>'''
    foot = f'''<div style="display:flex;{'flex-direction:column;gap:16px' if m else 'justify-content:space-between;align-items:center'}">
      <div style="width:130px;color:{C['be']}">{LOGO}</div>
      <span class="body" style="font-size:13px;color:{C['be']}">157 Askew Road, London W12 9AU · {PHONE}</span>
      <span class="body" style="font-size:13px;color:{C['br']}">© 2026 Siha Dental &amp; Facial. All rights reserved. <u>Privacy policy</u></span></div>'''
    return ((nav_m() if m else nav_d()) + sec("Thank you", card, m, pad=(120, 80), pad_m=(48, 20))
            + sec("Footer", foot, m, bg=C['od'], pad=(40, 80), pad_m=(32, 20)))
