"""Body sections 2-15 of the Siha new patient oral health assessment landing page.

Each section is a function taking m (True = mobile 390, False = desktop 1440) and returning HTML.
Copy follows the live page, with the fixes agreed with Toby on 6 Oct 2026:
real Google reviews in Patient stories, £89 everywhere, one practice (no "clinics"),
and a photo gallery in place of the empty tour-video slot.
"""
from build import C, ICON, LOGO, TICK_SVG, CTA, PHONE, stars, tick, form_card, nav_d, nav_m

PLAY = '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>'


def sec(name, inner, m, bg=None, pad=(112, 80), pad_m=(64, 20)):
    py, px = pad_m if m else pad
    return (f'<section data-name="{name}" style="position:relative;background:{bg or C["nu"]};padding:{py}px {px}px">'
            f'{inner}</section>')


def head(label, title, sub=None, m=False, dark=False, center=False, width=760):
    fg, subc = (C['nu'], C['be']) if dark else (C['od'], C['ol'])
    al = "text-align:center;margin-left:auto;margin-right:auto;" if center else ""
    out = f'<div style="{al}max-width:{width}px">'
    if label:
        out += f'<div class="label" style="color:{C["bo"]}">{label}</div>'
    out += f'<h2 class="h1" style="margin-top:14px;font-size:{32 if m else 44}px;color:{fg}">{title}</h2>'
    if sub:
        out += f'<p class="body" style="margin-top:16px;font-size:{16 if m else 18}px;color:{subc}">{sub}</p>'
    return out + '</div>'


def grid(items, cols, gap=24):
    return f'<div style="display:grid;grid-template-columns:repeat({cols},1fr);gap:{gap}px">{"".join(items)}</div>'


def swipe(items, w=290, gap=14, dark=False):
    """Mobile: horizontal swipe row with dots instead of a tall stack (cards keep their own styling)."""
    cells = "".join(f'<div style="flex:none;width:{w}px;display:flex">{i}</div>' for i in items)
    dots = "".join(f'<span style="width:{18 if k == 0 else 6}px;height:6px;border-radius:3px;background:{(C["be"] if dark else C["od"]) if k == 0 else ("rgba(225,213,202,.3)" if dark else "rgba(20,33,26,.2)")}"></span>' for k in range(len(items)))
    return (f'<div data-name="Swipe row" style="overflow:hidden;margin-right:-20px"><div style="display:flex;gap:{gap}px;align-items:stretch">{cells}</div></div>'
            f'<div data-name="Dots" style="display:flex;gap:6px;justify-content:center;margin-top:20px">{dots}</div>')


def mob_cta(title):
    """Mobile replacement for the mid-page form: one button back to the hero form, plus tap-to-call."""
    inner = (f'<div class="label" style="color:{C["bo"]}">Book now</div>'
             f'<h2 class="h1" style="margin-top:12px;font-size:30px">{title}</h2>'
             f'<p class="body" style="margin-top:12px;color:{C["ol"]}">It takes under a minute. We’ll call you back to confirm.</p>'
             f'<div style="margin-top:24px"><span class="btn primary" style="height:56px;width:100%">{CTA}</span></div>')
    return sec("Book now (mobile: button to hero form)", inner, True, pad_m=(48, 20))


def photo(img, h, radius=30, pos="50% 50%"):
    return (f'<div data-name="Photo" style="height:{h}px;border-radius:{radius}px;'
            f'background:url(assets/photos/{img}) {pos}/cover no-repeat"></div>')


def cta_row(m, dark=False, top=48):
    """Repeated CTA: one unified button that scrolls to the form (form fill is the only CTA, per Toby 6 Oct 2026)."""
    phone_c, num_c = (C['be'], C['nu']) if dark else (C['ol'], C['od'])
    return (f'<div data-name="CTA" style="display:flex;{"flex-direction:column;align-items:flex-start;" if m else "align-items:center;"}gap:{16 if m else 24}px;margin-top:{top}px">'
            f'<span class="btn {"beige" if dark else "primary"}">{CTA}</span></div>')


def mark(color, size=22):
    svg = ICON.replace('class="icon"', 'class="icon" style="width:100%"', 1)
    return f'<div style="flex:none;width:{size}px;color:{color}">{svg}</div>'


# Simple thin-line icons (Hannan, 10 Oct 2026: a simple graphic per item instead of the Siha logo mark)
ICONS = {
    "plan": '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M8.5 10h7M8.5 13.5h7M8.5 17h4"/>',
    "award": '<circle cx="12" cy="9" r="5.5"/><path d="M8.6 13.4L7 21l5-2.6 5 2.6-1.6-7.6"/>',
    "wallet": '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M15.5 14.5h2"/>',
    "clock": '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    "calm": '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
    "shield": '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z"/><path d="M8.8 12.2l2.2 2.2 4.2-4.4"/>',
    "person": '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5c.8-3.8 3.8-6 7.5-6s6.7 2.2 7.5 6"/>',
    "tooth": '<path d="M12 6.2C10.4 4.6 8 4 6.3 5 4 6.4 4.2 9.6 5.3 12.5c.8 2 1 4.6 1.6 6.6.4 1.4 1.9 1.4 2.3 0 .5-1.7.8-4.1 2.8-4.1s2.3 2.4 2.8 4.1c.4 1.4 1.9 1.4 2.3 0 .6-2 .8-4.6 1.6-6.6C19.8 9.6 20 6.4 17.7 5 16 4 13.6 4.6 12 6.2z"/>',
    "star": '<path d="M12 3.8l2.5 5.2 5.7.7-4.2 3.9 1.1 5.6L12 16.4l-5.1 2.8 1.1-5.6-4.2-3.9 5.7-.7z"/>',
    "scan": '<path d="M4 8.5V5.5A1.5 1.5 0 0 1 5.5 4h3M15.5 4h3A1.5 1.5 0 0 1 20 5.5v3M20 15.5v3a1.5 1.5 0 0 1-1.5 1.5h-3M8.5 20h-3A1.5 1.5 0 0 1 4 18.5v-3M4 12h16"/>',
}


def icon(name, color, size=40):
    return (f'<svg data-name="Icon" width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{color}" '
            f'stroke-width="{1.5 * 24 / size:.2f}" stroke-linecap="round" stroke-linejoin="round" style="flex:none;display:block">{ICONS[name]}</svg>')


# ---------------------------------------------------------------- awards strip (Siha Drive: Awards PNGs), trust signals by the hero
AWARDS = ["brand-design-2025.png", "patient-care-2025.png", "da25-team-london.png", "da25-website-london.png", "da25-website-overall.png",
          "brand-design-2024.png", "website-2024.png", "best-new-practice-2024.png"]
# Plain-text captions so the award reads even where the logo's own gold lettering is faint (mobile cards)
AWARD_CAPTIONS = [("Winner", "Practice brand &amp; design", "Private Dentistry Awards 2025"),
                  ("Winner", "Patient care", "Private Dentistry Awards 2025"),
                  ("Winner", "Team of the year, London", "Dentistry Awards 2025"),
                  ("Winner", "Website of the year, London", "Dentistry Awards 2025"),
                  ("Overall winner", "Website of the year", "Dentistry Awards 2025"),
                  ("Winner", "Practice brand &amp; design, South", "Private Dentistry Awards 2024"),
                  ("Winner", "Website of the year, London", "Private Dentistry Awards 2024"),
                  ("Highly commended", "New practice", "Private Dentistry Awards 2024")]


def awards(m):
    """Awards marquee: an edge-to-edge banner that auto-scrolls right to left and loops (shown mid-scroll here).
    Build: CSS animation translateX(-50%) over ~30s on a doubled track; pause on hover; respect prefers-reduced-motion."""
    h, gap = (58, 28) if m else (84, 72)
    item = lambda a, w, t: (f'<div data-name="Award" style="flex:none;{"width:140px;" if m else ""}display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center">'
                            f'<img src="assets/awards/{a}" style="height:{h}px;width:auto;max-width:{140 if m else 220}px;object-fit:contain">'
                            f'<span class="label" style="font-size:{10 if m else 12}px;line-height:1.5;{"" if m else "white-space:nowrap;"}color:{C["br"]}">{w}<br>{t}</span></div>' if m else
                            f'<div data-name="Award" style="flex:none;display:flex;flex-direction:column;align-items:center;gap:10px">'
                            f'<img src="assets/awards/{a}" style="height:{h}px;width:auto">'
                            f'<span class="label" style="font-size:12px;white-space:nowrap;color:{C["br"]}">{w} · {t}</span></div>')
    items = "".join(item(a, w, t) for a, (w, t, e) in zip(AWARDS, AWARD_CAPTIONS))
    fade = lambda side: (f'<div style="position:absolute;top:0;bottom:0;{side}:0;width:{60 if m else 160}px;'
                         f'background:linear-gradient(to {"right" if side == "left" else "left"},{C["wh"]},rgba(255,255,255,0));z-index:1"></div>')
    return (f'<section data-name="Awards marquee (auto-scrolls, loops)" style="position:relative;background:{C["wh"]};padding:{"28px 0 30px" if m else "36px 0 40px"};overflow:hidden">'
            f'<div class="label" style="text-align:center;color:{C["bo"]};margin-bottom:{18 if m else 24}px">3 awards in 2024 · 5 in 2025</div>'
            f'<div style="position:relative;overflow:hidden">{fade("left")}{fade("right")}'
            f'<div class="track" data-name="Track" style="--g:{gap}px;display:flex;gap:{gap}px;align-items:flex-start;margin-left:-{70 if m else 220}px;width:max-content">{items}{items}</div></div></section>')


# ---------------------------------------------------------------- 2 why patients choose us
WHY = [("plan", "A comprehensive assessment, with a plan built around your goals"),
       ("award", "An award-winning team of professionals and specialists"),
       ("wallet", "Flexible payments and dental membership plans"),
       ("clock", "Evening, weekend and out-of-hours appointments"),
       ("calm", "Sedation available for nervous patients")]


def why_choose(m):
    if m:
        return ""  # mobile: folded into the hero trust line
    items = [f'<div style="display:flex;flex-direction:column;gap:16px;align-items:flex-start">{icon(i, C["bo"], 36)}'
             f'<span class="body" style="color:{C["be"]};font-size:{15 if m else 16}px">{t}</span></div>' for i, t in WHY]
    inner = (f'<div class="label" style="color:{C["bo"]};{"" if m else "text-align:center;"}margin-bottom:{24 if m else 40}px">Why patients choose us</div>'
             + grid(items, 1 if m else 5, 20 if m else 40))
    return sec("Why patients choose us", inner, m, bg=C['od'], pad=(56, 80), pad_m=(48, 20))


# ---------------------------------------------------------------- 3 patient stories (real Google reviews already on the page)
STORIES = [
    ("ICON, whitening &amp; bonding", "I’ve had white spots for as long as I can remember and this year finally took the plunge to fix them, and I’m so glad I found Siha Dental.", "Samantha Cooper"),
    ("Composite bonding", "I came in with chipped front teeth and he restored them to perfection with composite bonding. You cannot even tell they were ever damaged.", "Hoda Munchow"),
    ("Aligners &amp; edge bonding", "My edge bonding was done really well and looks so natural, which I’m really pleased with. I’ve always felt like I was in good hands.", "Aria KS"),
]


def stories(m):
    cards = [f'''<div class="card" data-name="Story" style="background:{C['wh']};padding:{28 if m else 40}px;display:flex;flex-direction:column;gap:20px">
      <div class="label" style="color:{C['bo']}">{t}</div>
      <p class="h3" style="font-weight:400;font-size:{18 if m else 20}px;line-height:1.5">“{q}”</p>
      <div style="margin-top:auto">
        <div style="display:flex;align-items:center;justify-content:space-between"><span class="body" style="font-weight:600">{n}</span>{stars(5, 14)}</div>
        <div class="body" style="font-size:13px;color:{C['br']}">Google review</div></div>
    </div>''' for t, q, n in STORIES]
    inner = (head("Patient stories", "Real patients. Real results.",
                  "Every smile is different. These are a few of the people who trusted us with theirs.", m)
             + f'<div style="margin-top:{32 if m else 56}px">{(swipe(cards) if m else grid(cards, 3, 20 if m else 24))}</div>' + cta_row(m))
    return sec("Patient stories", inner, m)


# ---------------------------------------------------------------- 4 pricing + what you get
GET = [("Comprehensive exam", "Teeth, gums, bite and jaw, plus an oral cancer screening"),
       ("Small X-rays and a 3D scan", "Included. See your own mouth on-screen as your dentist talks you through it"),
       ("A plan built around your goals", "Your short- and long-term goals first, then a plan tailored to them, costed upfront"),
       ("Siha Dental &amp; Facial Membership plan", "For patients without insurance. Plans from £19.56 a month, see below")]


def pricing(m):
    price = f'''<div class="card" data-name="Price card" style="background:{C['od']};color:{C['nu']};padding:{32 if m else 56}px;display:flex;flex-direction:column">
      <div class="label" style="color:{C['bo']}">Pricing</div>
      <h2 class="h1" style="margin-top:14px;font-size:{30 if m else 40}px;color:{C['nu']}">Transparent pricing. No surprises.</h2>
      <p class="body" style="margin-top:16px;color:{C['be']}">One flat fee for a comprehensive oral health assessment. Anything that needs attention afterwards is costed and explained upfront, before you decide anything.</p>
      <div style="margin-top:{32 if m else 44}px;padding-top:28px;border-top:1px solid rgba(225,213,202,.2)">
        <div class="label" style="color:{C['be']}">Oral health assessment</div>
        <div style="display:flex;align-items:baseline;gap:16px;margin-top:8px"><span style="font-weight:300;font-size:{72 if m else 96}px;line-height:1">£89</span><span class="body" style="color:{C['be']}">Small X-rays included</span></div>
        <p class="body" style="margin-top:16px;font-size:14px;color:{C['be']}">Up to 12 months 0% interest-free finance available for any treatment identified at your assessment.</p>
      </div>
      <span class="btn beige" style="margin-top:32px;align-self:flex-start">{CTA}</span>
    </div>'''
    rows = "".join(f'''<div style="display:flex;gap:18px;padding:22px 0;border-bottom:1px solid rgba(20,33,26,.12)">
        <i style="flex:none;width:36px;height:36px;border-radius:50%;background:{C['nu']};display:flex;align-items:center;justify-content:center">{TICK_SVG}</i>
        <div><div class="h3">{t}</div><div class="body" style="color:{C['ol']};margin-top:4px">{d}</div></div></div>''' for t, d in GET)
    right = f'''<div style="display:flex;flex-direction:column">
      {photo("opg.jpg", 220 if m else 260, pos="50% 35%")}
      <div class="label" style="color:{C['bo']};margin-top:32px">What you get</div>
      <div style="margin-top:6px">{rows}</div></div>'''
    return sec("Pricing", grid([price, right], 1 if m else 2, 32 if m else 48), m, bg=C['be'])


# ---------------------------------------------------------------- 5 membership
# siha.dental/fees-and-finance (12 Oct 2026). Under-6s free with a registered parent: Hannan, 10 Oct 2026.
ADULT_PLANS = [("Smile", "£19.56", "Routine care", ["1 oral health assessment a year", "2 hygiene appointments a year", "Routine X-rays as required", "5% off treatments, 10% off oral health products", "Global dental accident &amp; emergency scheme"]),
               ("Smile Plus", "£33.89", "Gum health or complex restorative work", ["1 oral health assessment a year", "4 hygiene appointments a year", "Routine X-rays as required", "5% off treatments, 10% off oral health products", "Global dental accident &amp; emergency cover"])]
CHILD_PLANS = [("Smile Child", "£5.45", "Under 12 years", ["2 oral health assessments a year, with brushing and diet advice", "Fluoride varnish", "Routine X-rays as clinically required", "5% off treatments, 10% off oral health products"]),
               ("Smile Plus", "£12.07", "13–17 years", ["2 oral health assessments a year, with brushing and diet advice", "1 hygiene visit a year", "Fluoride varnish", "Routine X-rays as clinically required", "5% off treatments, 10% off oral health products"])]


def membership(m):
    def plan_cards(plans, hi_first):
        return [plan_card(n, pr, who, feats, hi_first and i == 0) for i, (n, pr, who, feats) in enumerate(plans)]

    def plan_card(n, pr, who, feats, hi):
        bg, fg, sub = (C['od'], C['nu'], C['be']) if hi else (C['wh'], C['od'], C['ol'])
        line = 'rgba(225,213,202,.2)' if hi else 'rgba(20,33,26,.1)'
        feat_html = "".join(f'<div class="body" style="font-size:14px;line-height:1.5;color:{sub};display:flex;gap:10px"><span style="color:{C["bo"]}">•</span><span>{f}</span></div>' for f in feats)
        return (f'''<div class="card" data-name="Plan" style="background:{bg};color:{fg};padding:32px;display:flex;flex-direction:column;width:100%">
          <div class="h3">{n}</div><div class="body" style="font-size:14px;color:{sub};margin-top:2px">{who}</div>
          <div style="margin-top:24px"><span style="font-weight:300;font-size:48px;line-height:1">{pr}</span><span class="body" style="color:{sub}"> /month</span></div>
          <div style="height:1px;background:{line};margin:24px 0"></div>
          <div style="display:grid;gap:12px">{feat_html}</div></div>''')

    def group(label, sub):
        return (f'<div data-name="Plan group" style="display:flex;align-items:baseline;gap:14px;{"flex-direction:column;gap:4px;" if m else ""}'
                f'padding-bottom:16px;margin-bottom:{20 if m else 24}px;border-bottom:1.5px solid {C["od"]}">'
                f'<span class="h2" style="font-size:{24 if m else 28}px">{label}</span><span class="body" style="font-size:15px;color:{C["ol"]}">{sub}</span></div>')
    free = (f'<div data-name="Under 6s free" style="display:flex;gap:14px;align-items:center;margin-top:20px;padding:18px 22px;border-radius:20px;background:{C["be"]}">'
            f'<span style="flex:none;font-weight:600;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:{C["bo"]}">Under 6s free</span>'
            f'<span class="body" style="font-size:14px;color:{C["ol"]}">when a parent is registered with us and attends regularly</span></div>')
    adults = group("Adults", "18 and over") + (swipe(plan_cards(ADULT_PLANS, True)) if m else grid(plan_cards(ADULT_PLANS, True), 2, 20))
    kids = group("Children", "Plans from £5.45 a month") + (swipe(plan_cards(CHILD_PLANS, False)) if m else grid(plan_cards(CHILD_PLANS, False), 2, 20)) + free
    plans = (adults + f'<div style="margin-top:48px">{kids}</div>') if m else f'<div style="display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:start"><div>{adults}</div><div>{kids}</div></div>'
    inner = (head("Siha Dental &amp; Facial Membership", "A smarter way to care for your smile",
                  "A monthly plan that builds your routine care in, with separate plans for adults and children.", m)
             + f'<div style="margin-top:{32 if m else 56}px">{plans}</div>'
             + f'<p class="body" style="margin-top:28px;font-size:13px;color:{C["br"]};max-width:900px">Siha Dental &amp; Facial Membership is not dental insurance and does not cover all treatments. It is designed to support routine preventative care, and additional treatment may incur separate costs. T&amp;Cs apply. Ask the team about joining at your visit.</p>')
    return sec("Membership", inner, m)


# ---------------------------------------------------------------- 6 reviews
REVIEWS = [("Diane Redmond", "My experience at Siha Dental Surgery has been very positive. I have always been treated with respect and given clear explanations about my treatment plan and what to expect."),
           ("Sheela Vaghela", "They explained everything properly at every stage, so I always knew exactly what was happening and what to expect, which made the whole experience feel so comfortable and reassuring."),
           ("Kate Barry", "I cannot thank Dr Hannan enough for the care and kindness he showed me when I was experiencing a dental emergency.")]


def reviews(m):
    cards = [f'''<div class="card" data-name="Review" style="background:{C['ol']};padding:32px;display:flex;flex-direction:column;gap:18px">
      {stars(5, 16)}<p class="body" style="color:{C['nu']};font-size:17px;line-height:1.6">“{q}”</p>
      <div style="margin-top:auto"><div class="body" style="font-weight:600;color:{C['nu']}">{n}</div><div class="body" style="font-size:13px;color:{C['be']}">Posted on Google</div></div></div>''' for n, q in REVIEWS]
    score = f'''<div style="display:flex;align-items:center;gap:20px;{'margin-top:24px' if m else ''}">
      <span style="font-weight:300;font-size:72px;line-height:1;color:{C['nu']}">5.0</span>
      <div>{stars(5, 18)}<div class="body" style="color:{C['be']};font-size:14px;margin-top:4px">Based on 157 Google reviews</div></div></div>'''
    top = (f'<div style="display:flex;{"flex-direction:column" if m else "justify-content:space-between;align-items:flex-end"}">'
           f'{head("Patient reviews", "What our patients say", "5.0 stars from 150+ verified Google reviews.", m, dark=True, width=620)}{score}</div>')
    return sec("Reviews", top + f'<div style="margin-top:{32 if m else 56}px">{(swipe(cards) if m else grid(cards, 3, 20))}</div>', m, bg=C['od'])


# ---------------------------------------------------------------- CTA #2 with form (LP framework: repeat the CTA with a simple form)
def cta_form(m):
    if m:
        return mob_cta("Ready when you are")
    left = f'''<div style="display:flex;flex-direction:column;justify-content:center">
      {head("Oral health assessment", "Ready when you are", "Same-week appointments, evenings and weekends. £89 for a full exam, 3D scan and small X-rays, with no hidden extras.", m, width=520)}
      <div style="display:grid;gap:12px;margin-top:28px">{tick("Full exam, 3D scan + small X-rays")}{tick("Oral cancer screening")}{tick("A plan built around your goals")}{tick("0% finance available")}</div></div>'''
    form = form_card(350 if m else 520, 24 if m else 40, title="Book your assessment")
    body = grid([left, form], 1, 32) if m else f'<div style="display:grid;grid-template-columns:1fr 520px;gap:96px;align-items:center">{left}{form}</div>'
    return sec("Book your assessment (form 2)", body, m, bg=C['be'])


# ---------------------------------------------------------------- 7 sound familiar
FAMILIAR = [("You haven’t seen a dentist in years", "Life got busy. No judgement here, just a proper look at where things stand."),
            ("You’re anxious about the dentist", "A bad experience put you off. Our team takes gentle, unhurried appointments, and sedation is available if you need it."),
            ("You’ve just moved to London", "You need a dental home close to work or home, run to a consistent standard."),
            ("You’ve got an issue you’ve been ignoring", "Sensitivity, a chip, something that doesn’t feel quite right. Better to get it looked at now than wait for it to get worse."),
            ("Your last dentist rushed you through", "Ten minutes and out the door. You want a dentist who actually explains what they’re looking at."),
            ("You want one dentist for the whole family", "Care for you and your kids under one roof. Under 6s are free when a parent is registered and attends regularly.")]


def familiar(m):
    cards = [f'''<div class="card" data-name="Situation" style="background:{C['wh']};padding:{28 if m else 36}px">
      <div class="h3">{t}</div><p class="body" style="margin-top:10px;color:{C['ol']}">{d}</p></div>''' for t, d in FAMILIAR]
    close = (f'<p style="margin:{36 if m else 56}px auto 0;max-width:860px;{"" if m else "text-align:center;"}font-size:{20 if m else 24}px;font-weight:300;line-height:1.45">'
             'Our assessment is a <b style="font-weight:600">full look at your oral health with honest advice</b>: no lectures, no judgement, and no pressure to have anything done.</p>')
    inner = (head("Sound familiar?", "It’s been a while and that’s okay",
                  "Most new patients come to us after months, sometimes years, of meaning to book. Whatever brought you here, you’re in the right place.", m, center=not m)
             + f'<div style="margin-top:{32 if m else 56}px">{(swipe(cards) if m else grid(cards, 3, 20))}</div>' + close)
    return sec("Sound familiar", inner, m)


# ---------------------------------------------------------------- 8 the check-up
FACTS = ["Small X-rays included", "Prevention before cure", "Mercury-free &amp; BPA-free fillings", "Sedation for nervous patients"]


def checkup(m):
    left = photo("hygienist-action.jpg", 360 if m else 680, pos="40% 50%")
    right = f'''<div style="display:flex;flex-direction:column;justify-content:center">
      {head("The assessment", "More than a check-up. A proper look at your oral health.", None, m, width=560)}
      <p class="body" style="margin-top:18px;color:{C['ol']}">We take time to understand your short- and long-term goals, then tailor your plan to them. Small issues are fixed early, before they get worse: prevention before cure.</p>
      <div class="card" style="background:{C['be']};padding:28px;margin-top:28px">
        <div class="h3">Your oral health is part of your overall health</div>
        <p class="body" style="margin-top:10px;color:{C['ol']};font-size:15px">Gum disease is linked to chronic conditions including cardiovascular disease, diabetes and Alzheimer’s. That’s why your assessment covers teeth, gums, bite and jaw, an oral cancer screening, small X-rays and a 3D scan, not just a quick look.</p>
      </div>
      <div class="label" style="color:{C['bo']};margin-top:28px">Key facts</div>
      <div style="display:grid;grid-template-columns:{'1fr' if m else '1fr 1fr'};gap:14px 20px;margin-top:14px">{"".join(tick(f, 15) for f in FACTS)}</div>
    </div>'''
    return sec("The assessment", grid([left, right], 1 if m else 2, 32 if m else 72), m)


# ---------------------------------------------------------------- 9 how it works
STEPS = [("Book your assessment", "Choose a time that works for you, including evenings and weekends."),
         ("Full examination &amp; scan", "Teeth, gums, bite, small X-rays and a 3D scan, explained in plain English as we go."),
         ("A plan around your goals", "We talk through your goals, then cost everything upfront. No pressure to proceed same-day."),
         ("Ongoing care", "Regular hygiene visits and a dentist who knows your history for whatever comes next.")]


def how(m):
    cards = [f'''<div data-name="Step" style="border-top:1.5px solid {C['od']};padding-top:24px">
      <div style="font-weight:300;font-size:{40 if m else 56}px;line-height:1;color:{C['bo']}">{i + 1:02d}</div>
      <div class="h3" style="margin-top:20px">{t}</div><p class="body" style="margin-top:8px;color:{C['ol']}">{d}</p></div>''' for i, (t, d) in enumerate(STEPS)]
    return sec("How it works", head("How it works", "From booking to ongoing care", None, m)
               + f'<div style="margin-top:{32 if m else 56}px">{grid(cards, 1 if m else 4, 28 if m else 40)}</div>' + cta_row(m), m, bg=C['be'])


# ---------------------------------------------------------------- 10 services
SERVICES = [("Oral Health &amp; Hygiene", "Regular assessments and professional cleans that catch small issues before they become big ones.", "hygiene-suite.jpg", "50% 50%"),
            ("Fillings &amp; Restorations", "Mercury-free, BPA-free tooth-coloured fillings that blend with your natural teeth.", "suite-one.jpg", "50% 50%"),
            ("Root Canal Treatment", "Gentle, modern endodontics to save a tooth rather than lose it.", "asiya-magnification.jpg", "50% 40%"),
            ("Gum Health", "Screening and treatment for gum disease, which is linked to wider health problems as well as tooth loss.", "suite-consult.jpg", "50% 60%"),
            ("Emergency Dentistry", "Same-week appointments for pain, breakages or anything that can’t wait.", "concierge-patient.jpg", "50% 40%"),
            ("Cosmetic &amp; Straightening", "Whitening, bonding, veneers and Invisalign, if your assessment uncovers something you’d like to change.", "face-photo.jpg", "50% 40%")]


def services(m):
    cards = [f'''<div class="card" data-name="Service" style="background:{C['wh']};overflow:hidden">
      {photo(img, 200, 0, pos)}<div style="padding:28px"><div class="h3">{t}</div><p class="body" style="margin-top:8px;color:{C['ol']};font-size:15px">{d}</p></div></div>''' for t, d, img, pos in SERVICES]
    return sec("Services", head("Our services", "Everything your mouth needs, under one roof",
                                "Whatever your assessment uncovers, you won’t need to be referred somewhere else.", m)
               + f'<div style="margin-top:{32 if m else 56}px">{(swipe(cards) if m else grid(cards, 3, 20 if m else 24))}</div>', m)


# ---------------------------------------------------------------- 11 why siha
WHY_SIHA = [("shield", "GDC-registered dentists", "GDC-registered dentists trained to handle both simple and complex cases."),
            ("person", "Founder-led care", "Dr Hannan is personally involved in the standard of care across all treatments."),
            ("tooth", "Mercury-free &amp; BPA-free fillings", "Tooth-coloured fillings without mercury or BPA."),
            ("star", "Rated 5.0★ by patients", "150+ verified Google reviews from real patients, consistency you can check for yourself."),
            ("wallet", "0% finance &amp; membership", "0% interest-free finance, plus a Siha Dental &amp; Facial Membership plan for patients without insurance."),
            ("scan", "Digital-first diagnostics", "Modern, digital-first diagnostics, including 3D intraoral scanning at every assessment.")]


def why_siha(m):
    cards = [f'''<div data-name="Reason" style="padding:{24 if m else 32}px 0;border-top:1px solid rgba(225,213,202,.2)">
      {icon(i, C['bo'], 40)}<div class="h3" style="margin-top:16px;color:{C['nu']}">{t}</div><p class="body" style="margin-top:8px;color:{C['be']};font-size:15px">{d}</p></div>''' for i, t, d in WHY_SIHA]
    # Design QA 9.2: no unverifiable superlatives ("the most trusted name") in healthcare copy
    return sec("Why Siha", head("Why Siha Dental &amp; Facial", "Why patients trust us with their smiles", None, m, dark=True)
               + f'<div style="margin-top:{24 if m else 48}px">{(swipe(cards, dark=True) if m else grid(cards, 3, 48))}</div>' + cta_row(m, dark=True), m, bg=C['od'])


# ---------------------------------------------------------------- 12 meet your dentist (LP checklist: clinician bio; facts from siha.dental/our-team)
CREDS = ["Newcastle University School of Dental Science graduate",
         "MFDS, Royal College of Surgeons (Edinburgh)",
         "PG Certificate in Restorative Dentistry, Eastman Dental Institute",
         "Member, British Society of Restorative Dentistry"]


def quote(m):
    creds = "".join(f'<div class="body" style="font-size:15px;color:{C["ol"]};display:flex;gap:10px"><span style="color:{C["bo"]}">•</span><span>{c}</span></div>' for c in CREDS)
    text = f'''<div style="display:flex;flex-direction:column;justify-content:center">
      <div class="label" style="color:{C['bo']}">Meet your dentist</div>
      <h2 class="h1" style="margin-top:14px;font-size:{32 if m else 44}px">Dr Hannan</h2>
      <div class="body" style="color:{C['br']}">Director and Restorative Dentist · Founder · GDC 264888</div>
      <p style="font-weight:300;font-size:{21 if m else 26}px;line-height:1.45;margin-top:28px;padding-left:24px;border-left:2px solid {C['bo']}">“The best appointment is the one where nothing’s a surprise. We tell you exactly what we see and let you decide what happens next.”</p>
      <div style="display:grid;gap:10px;margin-top:28px">{creds}</div></div>'''
    # Mid-chest up (Hannan, 10 Oct 2026): face box (Apple Vision) 620,578 317px on the 1467x2200 source
    ph = 380 if m else 560
    sc = ph / (1434 - 340)
    pic = (f'<div data-name="Photo" style="height:{ph}px;border-radius:30px;background:url(assets/photos/hannan-2.jpg) '
           f'calc(50% - {(778 - 1467 / 2) * sc:.0f}px) -{340 * sc:.0f}px/{1467 * sc:.0f}px {2200 * sc:.0f}px no-repeat {C["be"]}"></div>')
    return sec("Founder quote", grid([pic, text] if m else [text, pic], 1 if m else 2, 32 if m else 96), m, bg=C['be'])


# ---------------------------------------------------------------- 13 practice gallery (replaces the empty tour-video slot)
def tour(h, m):
    """Practice tour video slot (LP framework: video tour). Source clips: Siha Drive > Video - Clinic Interior."""
    btn = 72 if m else 96
    return (f'<div data-name="Practice tour video" style="position:relative;height:{h}px;border-radius:30px;overflow:hidden;background:url(assets/photos/lounge.jpg) 50% 50%/cover">'
            f'<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(20,33,26,0) 50%,rgba(20,33,26,.55) 100%)"></div>'
            f'<div data-name="Play" style="position:absolute;left:calc(50% - {btn // 2}px);top:calc(50% - {btn // 2}px);width:{btn}px;height:{btn}px;border-radius:50%;background:{C["nu"]};color:{C["od"]};display:flex;align-items:center;justify-content:center;padding-left:4px">{PLAY}</div>'
            f'<div class="label" style="position:absolute;left:{20 if m else 32}px;bottom:{20 if m else 28}px;color:{C["nu"]}">Practice tour</div></div>')


def gallery(m):
    if m:
        pics = tour(240, m) + f'<div style="margin-top:12px">{grid([photo("suite-one.jpg", 140), photo("lounge-plants.jpg", 140)], 2, 12)}</div>'
    else:
        pics = f'''<div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:20px">
          {tour(540, m)}
          <div style="display:grid;gap:20px">{photo("suite-one.jpg", 260)}{photo("hygiene-suite.jpg", 260)}</div>
          <div style="display:grid;gap:20px">{photo("lounge-plants.jpg", 260)}{photo("facade.jpg", 260, pos="50% 60%")}</div></div>'''
    return sec("Practice gallery", head("Inside Siha Dental &amp; Facial", "Take a look around our practice", None, m)
               + f'<div style="margin-top:{32 if m else 48}px">{pics}</div>', m)


# ---------------------------------------------------------------- 14 faq
FAQ = [("What’s included in the oral health assessment?", "A comprehensive exam covering your teeth, gums, bite and jaw, an oral cancer screening, small X-rays, and a 3D digital scan you can see on-screen while your dentist talks you through it. We ask about your short- and long-term goals, and you leave with a plan tailored to them, including confirmation that nothing needs doing, if that’s the case."),
       ("How much does the oral health assessment cost?", "£89, flat. That includes your full examination and small X-rays. There’s nothing added on afterwards. If your assessment identifies anything that needs attention, it’s costed and explained upfront before you decide anything."),
       ("Do you accept dental insurance?", "Yes. All major dental insurances are accepted. We’ll provide the receipts and paperwork you need to claim back with your insurer. If you’re unsure whether your policy covers the assessment or any recommended treatment, bring your policy details and we’ll help you check."),
       ("Is finance or a membership plan available if I’m not insured?", "Yes. Any treatment identified at your assessment can be spread over up to 12 months with 0% interest-free finance. We also offer a Siha Dental &amp; Facial Membership plan designed for patients without insurance. Ask at your visit and the team will talk you through the options."),
       ("Do you offer emergency appointments?", "Yes. We hold same-week appointments for pain, breakages or anything that can’t wait. Send us your details and we’ll get you seen as quickly as possible."),
       ("How often should I come in?", "For most people, every six to twelve months. It depends on your oral health, your history, and your risk of things like gum disease. Your dentist will recommend the right interval for you at your first visit, rather than defaulting everyone to the same schedule."),
       ("Do you see children and treat the whole family?", "Yes. We look after whole families: assessments, hygiene and treatment for adults and children under one roof, with dentists who get to know your history. Children under 6 are free when a parent is registered with us and attends regularly."),
       ("I’m nervous about the dentist. Can you help?", "Yes. Appointments are gentle and unhurried, and sedation is available for nervous patients. Mention it when you book and we’ll talk you through the options."),
       ("It’s been years since I last saw a dentist. Is that a problem?", "Not at all, and you won’t get a lecture about it. A large share of our new patients haven’t seen a dentist in years. Your assessment simply establishes where things stand today, and anything that needs attention is explained and costed clearly. No judgement, no pressure.")]


def faq(m):
    rows = []
    for i, (q, a) in enumerate(FAQ):
        open_ = i == 0
        ans = f'<p class="body" style="margin-top:12px;color:{C["ol"]};max-width:760px">{a}</p>' if open_ else ''
        rows.append(f'''<div data-name="FAQ item" style="border-bottom:1px solid rgba(20,33,26,.14);padding:{20 if m else 26}px 0">
          <div style="display:flex;justify-content:space-between;gap:20px;align-items:center"><span class="h3" style="font-size:{17 if m else 20}px">{q}</span>
          <span style="flex:none;width:36px;height:36px;border-radius:50%;background:{C['od'] if open_ else C['be']};color:{C['nu'] if open_ else C['od']};display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:300">{'–' if open_ else '+'}</span></div>
          {ans}</div>''')
    left = head("FAQ", "Common questions", "Can’t see your question? Send us your details and we’ll call you back.", m, width=380)
    right = f'<div style="border-top:1px solid rgba(20,33,26,.14)">{"".join(rows)}</div>'
    body = grid([left, right], 1, 32) if m else f'<div style="display:grid;grid-template-columns:380px 1fr;gap:80px">{left}{right}</div>'
    return sec("FAQ", body, m)


# ---------------------------------------------------------------- 15 final cta + footer
def final(m):
    left = f'''<div style="display:flex;flex-direction:column;justify-content:center">
      <div class="label" style="color:{C['bo']}">Get started</div>
      <h2 class="display" style="margin-top:18px;color:{C['nu']};font-size:{34 if m else 56}px">Your oral <span style="white-space:nowrap">health,</span> <b>sorted</b></h2>
      <p class="body" style="margin-top:20px;color:{C['be']};font-size:{16 if m else 18}px">Book your oral health assessment at Siha Dental &amp; Facial. Straight answers, no pressure, and a plan you understand.</p>
      <div style="display:flex;gap:28px;margin-top:20px;flex-wrap:wrap">
        <span class="label" style="color:{C['be']};font-weight:500">0% finance available</span><span class="label" style="color:{C['be']};font-weight:500">All major insurances accepted</span></div>
      <div style="display:flex;align-items:center;gap:12px;margin-top:28px">{stars(5, 16)}<span class="body" style="color:{C['be']};font-size:14px">5.0 from 157 Google reviews</span></div>
    </div>'''
    form = form_card(350 if m else 500, 24 if m else 40, title="Book your assessment")
    # LP framework step 9: final CTA with a clean, easy form
    inner = grid([left, form], 1, 32) if m else f'<div style="display:grid;grid-template-columns:1fr 500px;gap:96px;align-items:center">{left}{form}</div>'
    foot = f'''<div data-name="Footer" style="margin-top:{56 if m else 96}px;padding-top:32px;border-top:1px solid rgba(225,213,202,.2);display:flex;{'flex-direction:column;gap:16px' if m else 'justify-content:space-between;align-items:center'}">
      <div style="width:130px;color:{C['be']}">{LOGO}</div>
      <span class="body" style="font-size:13px;color:{C['be']}">157 Askew Road, London W12 9AU</span>
      <span class="body" style="font-size:13px;color:{C['br']}">© 2026 Siha Dental &amp; Facial. All rights reserved. <u>Privacy policy</u> · Marketing by Vendo Digital</span></div>'''
    return sec("Final CTA", inner + foot, m, bg=C['od'])


from team import team

BODY = [awards, why_choose, stories, pricing, membership, reviews, cta_form, familiar, checkup, how, services, why_siha, quote, team, gallery, faq, final]


# ---------------------------------------------------------------- thank-you page (LP process SOP: confirms the submission + option to book online)
def thank_you(m):
    big_tick = TICK_SVG.replace('width="12" height="12"', 'width="26" height="26"')
    card = f'''<div class="card" data-name="Confirmation" style="background:{C['wh']};max-width:720px;margin:0 auto;padding:{32 if m else 64}px;text-align:center;box-shadow:0 30px 60px rgba(20,33,26,.10)">
      <div style="width:64px;height:64px;border-radius:50%;background:{C['be']};display:flex;align-items:center;justify-content:center;margin:0 auto">{big_tick}</div>
      <div class="label" style="color:{C['bo']};margin-top:28px">Request received</div>
      <h1 class="h1" style="margin-top:12px;font-size:{32 if m else 44}px">Thank you. We’ve got your details.</h1>
      <p class="body" style="margin-top:16px;color:{C['ol']};font-size:{16 if m else 18}px">Our team will be in touch to confirm your oral health assessment. If you’d rather pick a time yourself, you can book online now.</p>
      <div style="display:flex;{'flex-direction:column;' if m else ''}gap:16px;justify-content:center;align-items:center;margin-top:32px">
        <span class="btn primary">Choose a time online</span></div>
      <p class="body" style="margin-top:28px;font-size:14px;color:{C['br']}">157 Askew Road, London W12 9AU</p>
    </div>'''
    foot = f'''<div style="display:flex;{'flex-direction:column;gap:16px' if m else 'justify-content:space-between;align-items:center'}">
      <div style="width:130px;color:{C['be']}">{LOGO}</div>
      <span class="body" style="font-size:13px;color:{C['be']}">157 Askew Road, London W12 9AU</span>
      <span class="body" style="font-size:13px;color:{C['br']}">© 2026 Siha Dental &amp; Facial. All rights reserved. <u>Privacy policy</u></span></div>'''
    return ((nav_m() if m else nav_d()) + sec("Thank you", card, m, pad=(120, 80), pad_m=(48, 20))
            + sec("Footer", foot, m, bg=C['od'], pad=(40, 80), pad_m=(32, 20)))
