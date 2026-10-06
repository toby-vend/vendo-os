"""Body sections of the Siha smile makeover landing page.

Shared building blocks (sec, head, grid, photo, mark, cta_row, awards, why_choose, reviews, tour, gallery, faq)
come from common.py, a copy of the new patient check-up page's sections. Content here follows the live draft
with the fixes agreed with Toby on 6 Oct 2026:
- prices checked against siha.dental (bonding £250 a tooth, veneers £995 a tooth, aligners from £2,195;
  whitening left unpriced because Siha's prices are marked limited-time)
- no "minimum 6 teeth", no Bond Dental carry-over (4 locations, other clinics, Vendo Whitening, £0 deposit line)
- no "specialist" wording for non-specialists, no unverifiable superlatives, no finance monthly figures
- before-and-afters: carousel of Option A cards built from Siha's Drive treatment folders
"""
import common
from common import sec, head, grid, photo, mark, cta_row, awards, why_choose, reviews, gallery, faq, why_siha
from build import C, LOGO, TICK_SVG, CTA, PHONE, stars, tick, form_card, nav_d, nav_m

# ---------------------------------------------------------------- patient stories (real Google reviews on the draft page)
common.STORIES = [
    ("Bonding, whitening &amp; ICON", "I recently had Composite Bonding, Whitening and ICON treatment done at Siha, and the results were beyond my expectations!", "Beatriz F."),
    ("Composite bonding", "I’m very happy with the results, my teeth are more uniform now and finally all the gaps that I had due to receding gums are gone. I love my new smile.", "Krystyna Sookramanien"),
    ("Aligners &amp; edge bonding", "I had teeth alignment treatment as well as edge bonding done here, and I’m over the moon with the results.", "Aria KS"),
]
stories = common.stories


# ---------------------------------------------------------------- pricing: the building blocks with Siha's own prices
PRICES = [
    ("Same day", "Composite bonding", "Chips, gaps and uneven edges reshaped by hand, usually in one visit.", "£250", "per tooth (edge)",
     ["£295 per tooth for a full surface", "Usually one visit of 1 to 2 hours", "No drilling, nothing healthy removed", "12-month warranty"]),
    ("Straighten first", "Clear aligners", "Straighten first, then finish with whitening or bonding. The foundation of many makeovers.", "£2,195", "from (treatment under 3 months)",
     ["Plans for minor to complex cases", "All-inclusive plan, no hidden fees", "Virtually invisible, removable aligners"]),
    ("Biggest change", "Porcelain veneers", "Custom-made porcelain for a bigger change in shape, shade and symmetry.", "£995", "per tooth",
     ["Custom-made and colour-matched", "Used where bonding alone can’t get the result", "Planned and previewed before anything starts"]),
]


def pricing(m):
    cards = []
    for i, (tag, name, desc, price, unit, feats) in enumerate(PRICES):
        hi = i == 1
        bg, fg, sub = (C['od'], C['nu'], C['be']) if hi else (C['wh'], C['od'], C['ol'])
        line = 'rgba(225,213,202,.2)' if hi else 'rgba(20,33,26,.1)'
        feat_html = "".join(f'<div class="body" style="font-size:14px;line-height:1.5;color:{sub};display:flex;gap:10px"><span style="color:{C["bo"]}">•</span><span>{f}</span></div>' for f in feats)
        cards.append(f'''<div class="card" data-name="Price card" style="background:{bg};color:{fg};padding:{28 if m else 36}px;display:flex;flex-direction:column">
          <div class="label" style="color:{C['bo']}">{tag}</div>
          <div class="h3" style="margin-top:12px;font-size:22px">{name}</div>
          <p class="body" style="margin-top:8px;font-size:15px;color:{sub}">{desc}</p>
          <div style="margin-top:24px;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><span style="font-weight:300;font-size:56px;line-height:1">{price}</span><span class="body" style="font-size:14px;color:{sub}">{unit}</span></div>
          <div style="height:1px;background:{line};margin:24px 0"></div>
          <div style="display:grid;gap:12px">{feat_html}</div></div>''')
    finance = f'''<div class="card" data-name="Finance" style="background:{C['be']};padding:{24 if m else 32}px {24 if m else 40}px;margin-top:24px;display:flex;{'flex-direction:column;gap:12px' if m else 'align-items:center;justify-content:space-between;gap:40px'}">
      <div><div class="h3">0% interest-free finance</div>
      <p class="body" style="margin-top:6px;color:{C['ol']};font-size:15px">Spread the cost over up to 12 months on treatments over £300, through our partner Tabeo. It takes two minutes to apply, with an instant decision.</p></div>
      <div class="body" style="flex:none;font-size:14px;color:{C['ol']}">Professional whitening is priced at your consultation.</div></div>'''
    inner = (head("Pricing", "Transparent pricing. No surprises.",
                  "Your makeover is built from whichever of these your smile needs, often more than one. The full plan is priced and agreed upfront, before any treatment begins.", m)
             + f'<div style="margin-top:{32 if m else 56}px">{grid(cards, 1 if m else 3, 20 if m else 24)}</div>' + finance + cta_row(m))
    return sec("Pricing", inner, m)


# ---------------------------------------------------------------- before & after carousel
# Cards built in ../siha-ba-cards (guideline layout: before / Dark Olive line + S logo / after), chosen by Toby 6 Oct 2026.
# Photos from Siha's Drive treatment folders; exported to assets/ba-cards/ (gitignored).
BA = [("cb04", "Composite bonding + whitening"), ("al04", "Clear aligners"), ("cv02", "Ceramic veneers"),
      ("al01", "Clear aligners"), ("cb06", "Composite bonding"), ("al02", "Clear aligners"),
      ("cb17", "Whitening + composite bonding"), ("al06", "Clear aligners"), ("cb08", "Composite bonding"),
      ("cb21", "Whitening + composite bonding"), ("al05", "Clear aligners"), ("wh04", "Whitening"),
      ("cb26", "Whitening + composite bonding"), ("cb01", "Composite bonding + whitening")]
ARROW = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="{d}"/></svg>'


def before_after(m):
    w = 260 if m else 300
    cards = "".join(f'''<div data-name="Case" style="flex:none;width:{w}px">
      <div data-name="Before and after" style="width:{w}px;height:{int(w * 1.25)}px;border-radius:24px;background:url(assets/ba-cards/{k}.jpg) 50% 50%/cover no-repeat"></div>
      <div class="label" style="margin-top:14px;font-size:11px;color:{C['br']}">{t}</div></div>''' for k, t in BA)
    arrows = (f'<div data-name="Carousel arrows" style="display:flex;gap:12px">'
              f'<span style="width:52px;height:52px;border-radius:50%;border:1.5px solid rgba(20,33,26,.25);color:{C["br"]};display:flex;align-items:center;justify-content:center">{ARROW.format(d="M15 18l-6-6 6-6")}</span>'
              f'<span style="width:52px;height:52px;border-radius:50%;background:{C["od"]};color:{C["nu"]};display:flex;align-items:center;justify-content:center">{ARROW.format(d="M9 18l6-6-6-6")}</span></div>')
    top = (f'<div style="display:flex;{"flex-direction:column;gap:24px" if m else "justify-content:space-between;align-items:flex-end"}">'
           f'{head("Results", "Before &amp; after", "Real Siha Dental &amp; Facial patients, with every plan built from the treatments their smile actually needed.", m, width=760)}{arrows}</div>')
    track = (f'<div data-name="Carousel" style="margin-top:{32 if m else 48}px;overflow:hidden;margin-right:-{20 if m else 80}px">'
             f'<div data-name="Track" style="display:flex;gap:{16 if m else 24}px">{cards}</div></div>')
    bar = (f'<div data-name="Progress" style="margin-top:{28 if m else 40}px;height:2px;background:rgba(20,33,26,.12);border-radius:2px">'
           f'<div style="width:{"7%" if m else "29%"};height:2px;background:{C["od"]};border-radius:2px"></div></div>')
    note = f'<p class="body" style="margin-top:20px;font-size:13px;color:{C["br"]}">Individual results vary. All images are of actual Siha Dental &amp; Facial patients, with consent.</p>'
    return (f'<section data-name="Before and after (carousel)" style="position:relative;background:{C["be"]};padding:{"64px 20px" if m else "112px 80px"};overflow:hidden">'
            f'{top}{track}{bar}{note}</section>')


# ---------------------------------------------------------------- CTA #2 with form
def cta_form(m):
    left = f'''<div style="display:flex;flex-direction:column;justify-content:center">
      {head("Smile makeover consultation", "See your new smile before you commit", "We scan your teeth, design the result with you and give you a full itemised plan. The consultation is free, with no obligation.", m, width=520)}
      <div style="display:grid;gap:12px;margin-top:28px">{tick("3D digital scan")}{tick("Your smile designed with you")}{tick("A full, itemised plan")}{tick("0% finance available")}</div>
      <p class="body" style="margin-top:28px;color:{C['ol']}">Prefer to talk? Call <b style="font-weight:600;color:{C['od']}">{PHONE}</b></p></div>'''
    form = form_card(350 if m else 520, 24 if m else 40, title="Book your free consultation")
    body = grid([left, form], 1, 32) if m else f'<div style="display:grid;grid-template-columns:1fr 520px;gap:96px;align-items:center">{left}{form}</div>'
    return sec("Book a consultation (form 2)", body, m)


# ---------------------------------------------------------------- sound familiar
FAMILIAR = [("Stained or discoloured teeth", "Whitening toothpastes haven’t touched it. Coffee, tea and time have taken the brightness out of your smile."),
            ("Chipped or worn edges", "Your front teeth have lost their shape over the years. Edges are uneven, and it shows in photos."),
            ("Crooked or crowded teeth", "Nothing dramatic, but one or two teeth sit out of line, and it’s the first thing you see."),
            ("Gaps you never asked for", "Spacing between your front teeth that whitening and bonding alone can’t fully solve."),
            ("Self-conscious in photos", "You have a camera face. You know your angles. You’ve been doing this for years without realising why."),
            ("You’ve been putting it off", "This has been on your list for years. You’re still waiting for the right time. There isn’t one. There’s just doing it.")]


def familiar(m):
    cards = [f'''<div class="card" data-name="Situation" style="background:{C['wh']};padding:{28 if m else 36}px">
      <div class="h3">{t}</div><p class="body" style="margin-top:10px;color:{C['ol']}">{d}</p></div>''' for t, d in FAMILIAR]
    close = (f'<p style="margin:{36 if m else 56}px auto 0;max-width:900px;{"" if m else "text-align:center;"}font-size:{20 if m else 24}px;font-weight:300;line-height:1.45">'
             'A smile makeover fixes all of the above with <b style="font-weight:600">one joined-up plan</b>: straightening, whitening, bonding and veneers sequenced properly, so every step builds towards the final result.</p>')
    inner = (head("Sound familiar?", "It’s never just one thing about your smile",
                  "Most people who ask us about a smile makeover don’t have a single problem. It’s a chip here, some staining there, one tooth slightly out of line. Small things that add up every time you look in the mirror.", m, center=not m, width=820)
             + f'<div style="margin-top:{32 if m else 56}px">{grid(cards, 1 if m else 3, 20)}</div>' + close)
    return sec("Sound familiar", inner, m)


# ---------------------------------------------------------------- the treatment
FACTS = ["Fully bespoke plan", "3D smile preview", "Single visit possible", "Minimally invasive", "0% finance available"]


def treatment(m):
    left = photo("concierge-discuss.jpg", 360 if m else 700, pos="50% 50%")
    right = f'''<div style="display:flex;flex-direction:column;justify-content:center">
      {head("The treatment", "One plan. Every treatment your smile needs. Nothing it doesn’t.", None, m, width=560)}
      <p class="body" style="margin-top:18px;color:{C['ol']}">A smile makeover isn’t a single procedure. It’s a sequence of treatments designed together, so the straightening, the shade and the shape all arrive at one finished result.</p>
      <div class="card" style="background:{C['be']};padding:28px;margin-top:28px">
        <div class="h3">What is a smile makeover?</div>
        <p class="body" style="margin-top:10px;color:{C['ol']};font-size:15px">A smile makeover is a personalised combination of cosmetic treatments (typically clear aligners, professional whitening, composite bonding and porcelain veneers) planned as a single journey. At your consultation we take a 3D digital scan, design your new smile with you, and sequence only the treatments you actually need. Some makeovers are completed in a single visit; others begin with a short course of aligners before the cosmetic finishing. Either way, you see the plan, the timeline and the full cost before anything begins.</p>
      </div>
      <div class="label" style="color:{C['bo']};margin-top:28px">Key facts</div>
      <div style="display:grid;grid-template-columns:{'1fr' if m else '1fr 1fr'};gap:14px 20px;margin-top:14px">{"".join(tick(f, 15) for f in FACTS)}</div>
    </div>'''
    return sec("The treatment", grid([left, right], 1 if m else 2, 32 if m else 72), m)


# ---------------------------------------------------------------- how it works
STEPS = [("Your consultation", "We assess your teeth, listen to what you want to change, and take a 3D digital scan. You see a projected outcome before committing to anything."),
         ("Your bespoke plan", "Your dentist designs the combination and sequence of treatments, with the full cost agreed upfront. No surprises later."),
         ("Treatment visits", "Straightening first if needed, then whitening, then bonding or veneers, each stage building on the last."),
         ("Reveal your smile", "The final shape, shade and symmetry, checked against the design you approved. Plus everything you need to keep it that way.")]


def how(m):
    cards = [f'''<div data-name="Step" style="border-top:1.5px solid {C['od']};padding-top:24px">
      <div style="font-weight:300;font-size:{40 if m else 56}px;line-height:1;color:{C['bo']}">{i + 1:02d}</div>
      <div class="h3" style="margin-top:20px">{t}</div><p class="body" style="margin-top:8px;color:{C['ol']}">{d}</p></div>''' for i, (t, d) in enumerate(STEPS)]
    return sec("How it works", head("How it works", "From first scan to final reveal", None, m)
               + f'<div style="margin-top:{32 if m else 56}px">{grid(cards, 1 if m else 4, 28 if m else 40)}</div>' + cta_row(m), m, bg=C['be'])


# ---------------------------------------------------------------- building blocks
BLOCKS = [("Composite bonding", "Chips, gaps and uneven edges sculpted by hand, usually in a single visit. From £250 a tooth, with nothing healthy drilled away."),
          ("Porcelain veneers", "Thin, custom-made porcelain for a bigger change in shape and shade, from £995 a tooth."),
          ("Professional whitening", "Lifts years of staining safely, and is often the finishing touch of a makeover."),
          ("Clear aligners", "Invisalign® and clear aligner straightening. Virtually invisible, and often the first step of a makeover."),
          ("ICON white spot treatment", "White spots treated without needles or drilling. £395 for up to two teeth."),
          ("Airflow hygiene polish", "A professional clean and polish so your new smile starts from the healthiest possible base.")]


def blocks(m):
    cards = [f'''<div class="card" data-name="Treatment" style="background:{C['wh']};padding:{28 if m else 36}px">
      {mark(C['bo'], 22)}<div class="h3" style="margin-top:18px">{t}</div><p class="body" style="margin-top:8px;color:{C['ol']};font-size:15px">{d}</p></div>''' for t, d in BLOCKS]
    return sec("Building blocks", head("The building blocks", "What can your makeover include?",
                                       "Every plan is different. Yours is built from whichever of these your smile actually needs.", m)
               + f'<div style="margin-top:{32 if m else 56}px">{grid(cards, 1 if m else 3, 20 if m else 24)}</div>', m)


# ---------------------------------------------------------------- why siha (no "specialist" wording, no superlatives)
common.WHY_SIHA = [("Smile design experience", "Full smile makeovers: bonding, veneers, whitening and aligners planned together, not sold separately."),
                   ("Founder-led care", "Dr. Hannan Imran sees patients personally, and the practice is built on the standard of results he delivers himself."),
                   ("Convenient Shepherd’s Bush location", "Easy to reach in Shepherd’s Bush, with modern facilities and unhurried, personal care."),
                   ("Rated 5.0★ by patients", "150+ verified Google reviews from real patients, consistency you can check for yourself."),
                   ("0% interest-free finance", "Spread the cost over up to 12 months with no interest, on treatments over £300."),
                   ("Tracked from scan to finish", "Your treatment is monitored throughout, with check-in appointments, adjustments where needed and support at every stage.")]


# ---------------------------------------------------------------- meet your dentist
CREDS = ["Smile makeovers with Invisalign, composite bonding and natural ceramic veneers",
         "MFDS, Royal College of Surgeons (Edinburgh)",
         "PG Certificate in Restorative Dentistry, Eastman Dental Institute",
         "Member, British Society of Restorative Dentistry"]


def dentist(m):
    creds = "".join(f'<div class="body" style="font-size:15px;color:{C["ol"]};display:flex;gap:10px"><span style="color:{C["bo"]}">•</span><span>{c}</span></div>' for c in CREDS)
    text = f'''<div style="display:flex;flex-direction:column;justify-content:center">
      <div class="label" style="color:{C['bo']}">Meet your dentist</div>
      <h2 class="h1" style="margin-top:14px;font-size:{32 if m else 44}px">Dr. Hannan Imran</h2>
      <div class="body" style="color:{C['br']}">Director and Restorative Dentist · Founder · GDC 264888</div>
      <p style="font-weight:300;font-size:{21 if m else 26}px;line-height:1.45;margin-top:28px;padding-left:24px;border-left:2px solid {C['bo']}">“A great smile makeover result comes from careful planning, not shortcuts. Every treatment is designed around your smile, your facial features and your long-term dental health.”</p>
      <div style="display:grid;gap:10px;margin-top:28px">{creds}</div></div>'''
    pic = photo("hannan.jpg", 380 if m else 560, pos="50% 22%")
    return sec("Meet your dentist", grid([pic, text] if m else [text, pic], 1 if m else 2, 32 if m else 96), m, bg=C['be'])


# ---------------------------------------------------------------- faq
common.FAQ = [
    ("What exactly is a smile makeover?", "It’s a personalised combination of cosmetic treatments (usually some mix of clear aligners, professional whitening, composite bonding and porcelain veneers) planned together as one journey. Rather than treating each issue separately, your dentist designs the finished smile first, then sequences only the treatments needed to get there."),
    ("How much does a smile makeover cost?", None), ("How long does a smile makeover take?", None), ("Will the result look natural?", None),
    ("Do I need veneers, or is bonding enough?", None), ("Is any of it painful?", None), ("How do I look after my new smile?", None), ("Do you offer finance?", None)]
# Answers for the collapsed items (for the build): cost = bonding from £250 a tooth, veneers from £995 a tooth,
# clear aligners from £2,195, whitening priced at consultation, full itemised cost upfront, 0% finance over up to 12 months.


# ---------------------------------------------------------------- final cta + footer
def final(m):
    left = f'''<div style="display:flex;flex-direction:column;justify-content:center">
      <div class="label" style="color:{C['bo']}">Get started</div>
      <h2 class="display" style="margin-top:18px;color:{C['nu']};font-size:{32 if m else 50}px">One plan, <b>one result</b></h2>
      <p class="body" style="margin-top:20px;color:{C['be']};font-size:{16 if m else 18}px">Book your free smile makeover consultation at Siha Dental &amp; Facial. We’ll scan your teeth, design your new smile with you, and give you a full itemised plan. No commitment required.</p>
      <p class="body" style="margin-top:24px;color:{C['be']}">Prefer to talk? Call <b style="color:{C['nu']};font-weight:600">{PHONE}</b></p>
      <div style="display:flex;gap:28px;margin-top:20px;flex-wrap:wrap">
        <span class="label" style="color:{C['be']};font-weight:500">No obligation</span><span class="label" style="color:{C['be']};font-weight:500">0% finance available</span><span class="label" style="color:{C['be']};font-weight:500">Free consultation</span></div>
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

BODY = [awards, why_choose, stories, pricing, before_after, reviews, cta_form, familiar, treatment, how, blocks, why_siha, dentist, team, gallery, faq, final]


# ---------------------------------------------------------------- thank-you page
def thank_you(m):
    big_tick = TICK_SVG.replace('width="12" height="12"', 'width="26" height="26"')
    card = f'''<div class="card" data-name="Confirmation" style="background:{C['wh']};max-width:720px;margin:0 auto;padding:{32 if m else 64}px;text-align:center;box-shadow:0 30px 60px rgba(20,33,26,.10)">
      <div style="width:64px;height:64px;border-radius:50%;background:{C['be']};display:flex;align-items:center;justify-content:center;margin:0 auto">{big_tick}</div>
      <div class="label" style="color:{C['bo']};margin-top:28px">Request received</div>
      <h1 class="h1" style="margin-top:12px;font-size:{32 if m else 44}px">Thank you. We’ve got your details.</h1>
      <p class="body" style="margin-top:16px;color:{C['ol']};font-size:{16 if m else 18}px">Our team will be in touch to confirm your free smile makeover consultation. If you’d rather pick a time yourself, you can book online now.</p>
      <div style="display:flex;{'flex-direction:column;' if m else ''}gap:16px;justify-content:center;align-items:center;margin-top:32px">
        <span class="btn primary">Choose a time online</span><span class="btn outline">Call {PHONE}</span></div>
      <p class="body" style="margin-top:28px;font-size:14px;color:{C['br']}">157 Askew Road, London W12 9AU</p>
    </div>'''
    foot = f'''<div style="display:flex;{'flex-direction:column;gap:16px' if m else 'justify-content:space-between;align-items:center'}">
      <div style="width:130px;color:{C['be']}">{LOGO}</div>
      <span class="body" style="font-size:13px;color:{C['be']}">157 Askew Road, London W12 9AU · {PHONE}</span>
      <span class="body" style="font-size:13px;color:{C['br']}">© 2026 Siha Dental &amp; Facial. All rights reserved. <u>Privacy policy</u></span></div>'''
    return ((nav_m() if m else nav_d()) + sec("Thank you", card, m, pad=(120, 80), pad_m=(48, 20))
            + sec("Footer", foot, m, bg=C['od'], pad=(40, 80), pad_m=(32, 20)))
