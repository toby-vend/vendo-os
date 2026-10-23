"""Dentistry.ie treatment campaign statics: Implants, Smile Makeover & Ortho, Medical Cards. 5 concepts each, 1:1 + 9:16.

Campaigns and clinics come from the live Meta account in Motion (23 Oct 2026):
  Implants              Balbriggan, Kildare, Kilkenny, McEvoy (Dublin 2)                         -> lp.dentistry.ie/<slug>/dental-implants-meta
  Smile Makeover/Ortho  all eight clinics (Kildare runs it as "Ortho", Maynooth "Ortho + SMO")   -> lp.dentistry.ie/<slug>/smile-makeover-meta
  Medical Cards (IF)    Artane, Balbriggan, Sundrive (Kimmage); instant form, no landing page    -> facts from the client's live ad copy

Research and sources: research-campaigns.md. Copy: gen_copy_campaigns.py.
No prices on image or in copy: implant and bonding prices differ between the LPs, the main site and past creatives.
No review counts: the LPs say 85+, 600+ and the main site 500+. Proof is "since 1980" and "100% Irish owned".
No sedation language (nervous personas rule). No named staff: the LP team lists are copied between clinics.
Navy is the main ground (Toby, 22 Oct): 4 of 5 concepts per campaign are navy.

Usage: python3 build_campaigns.py  ->  camp-<campaign>-<clinic>.html (+ -capture.html): a 1:1 row and a 9:16 row.
"""
from build import (CSS, HERE, SKY_PALE, ad, area_chip, glow, photo, pin, portrait, ticks)
from build_guideline import HARBOUR, LINEN, NAVY, SKY, STONE, SLATE, WHITE, TICK, logo, mark, btn

DATE = '261023'

ALL = {  # key: (area on image, short address)
    'artane': ('Artane', 'Artane Castle Shopping Centre'),
    'balbriggan': ('Balbriggan', '6 Chapel Street, Balbriggan'),
    'castleknock': ('Castleknock', 'Ashleigh Centre, Castleknock Road'),
    'dublin2': ('Dublin 2', '17 Fitzwilliam Street Upper'),
    'kildare': ('Kildare', 'Claregate Street, Kildare'),
    'kilkenny': ('Kilkenny', 'Friary Street, Kilkenny'),
    'kimmage': ('Kimmage', 'Sundrive Shopping Centre, Kimmage'),
    'maynooth': ('Maynooth', 'Maynooth, Co. Kildare'),
}


def logo1(colour=LINEN):
    return f'<div style="position:absolute;left:72px;top:68px">{logo(230, colour)}</div>'


def logo9(colour=LINEN):
    return f'<div style="position:absolute;left:0;right:0;top:270px;display:flex;justify-content:center">{logo(300, colour)}</div>'


def centre(top, html):
    return f'<div style="position:absolute;left:0;right:0;top:{top}px;display:flex;justify-content:center">{html}</div>'


def head(x, y, w, size, html, colour=LINEN, align='left'):
    return f'<div class="h" style="position:absolute;left:{x}px;top:{y}px;width:{w}px;font-size:{size}px;line-height:1.06;color:{colour};text-align:{align}">{html}</div>'


def sub(x, y, w, size, text, colour=LINEN, align='left', op=.88):
    return f'<div class="body" style="position:absolute;left:{x}px;top:{y}px;width:{w}px;font-size:{size}px;line-height:1.48;color:{colour};opacity:{op};text-align:{align}">{text}</div>'


def fade(top, h, to=NAVY, up=False):
    a, b = ('rgba(15,27,41,0)', to) if not up else (to, 'rgba(15,27,41,0)')
    return f'<div style="position:absolute;left:0;top:{top}px;width:1080px;height:{h}px;background:linear-gradient(180deg,{a},{b})"></div>'


def tick_card(label, items, w, s=1.0, rot=0):
    return f"""<div class="card" style="position:relative;width:{w}px;padding:{32 * s}px {36 * s}px {36 * s}px;transform:rotate({rot}deg)">
<div class="label" style="font-size:{14 * s}px;color:{HARBOUR}">{label}</div>
{ticks(items, round(25 * s), gap=round(15 * s))}</div>"""


def steps(items, w, s=1.0, dark=True, start=1):
    """Numbered vertical journey, dots joined by a line (the LP's 1-4 journey)."""
    fg, line, num_bg, num_fg = (LINEN, 'rgba(250,249,246,.35)', SKY, NAVY) if dark else (NAVY, STONE, HARBOUR, LINEN)
    d = round(54 * s)
    rows = ''.join(f"""<div style="display:flex;gap:{24 * s}px;align-items:flex-start;position:relative;padding-bottom:{30 * s}px">
<div style="width:{d}px;height:{d}px;border-radius:50%;background:{num_bg};color:{num_fg};flex:none;display:flex;align-items:center;justify-content:center;font-size:{24 * s}px;font-weight:500;position:relative;z-index:1">{i + start}</div>
<div style="padding-top:{4 * s}px"><div style="font-size:{29 * s}px;font-weight:500;color:{fg};line-height:1.15">{t}</div><div style="font-size:{20 * s}px;color:{fg};opacity:.75;margin-top:{6 * s}px;line-height:1.35">{b}</div></div></div>""" for i, (t, b) in enumerate(items))
    return f"""<div style="position:relative;width:{w}px"><div style="position:absolute;left:{d / 2 - 1.5}px;top:{d / 2}px;bottom:{d}px;width:3px;background:{line}"></div>{rows}</div>"""


def handnote(lines, w, s=1.0, rot=-2, paper=SKY_PALE):
    out = ''
    for txt, colour, strike in lines:
        st = f'text-decoration:line-through;text-decoration-thickness:{3 * s}px;text-decoration-color:{colour};' if strike else ''
        out += f'<div class="hand" style="font-size:{58 * s}px;color:{colour};margin-top:{10 * s}px;{st}">{txt}</div>'
    return f"""<div style="position:relative;width:{w}px;background:{paper};transform:rotate({rot}deg);box-shadow:0 40px 50px -30px rgba(15,27,41,.6),0 4px 10px rgba(15,27,41,.15);padding:{60 * s}px {54 * s}px {56 * s}px;background-image:repeating-linear-gradient(180deg,transparent 0 {69 * s}px,rgba(50,116,163,.22) {69 * s}px {71 * s}px);background-position:0 {48 * s}px">
<div style="position:absolute;left:50%;top:{-22 * s}px;transform:translateX(-50%) rotate(2deg);width:{170 * s}px;height:{48 * s}px;background:rgba(250,249,246,.7);box-shadow:0 2px 4px rgba(0,0,0,.08)"></div>{out}</div>"""


def addr_line(addr, size, colour=LINEN, align='flex-start'):
    return f'<div style="display:flex;align-items:center;justify-content:{align};gap:10px;font-size:{size}px;color:{colour}">{pin(round(size * 1.15), SKY)}{addr}</div>'


# ============================================================ IMPLANTS
IMP_CTA = 'Book an implant consultation'


def i1_1(area, addr):  # Eat what you want | Navy, photo top (the Dentures Slipping layout Toby picked)
    return ad('s1', NAVY, f"""
{photo('stk-couple-lunch-laugh.jpg', 0, 0, 1080, 610, '62% 30%', radius=0)}
{fade(0, 220, up=True)}{fade(390, 222)}
{logo1()}
{head(72, 560, 940, 66, 'Order what you fancy. <em>Not what’s easy to chew.</em>')}
{sub(72, 735, 820, 25, 'Implants replace missing teeth with fixed teeth that look natural and don’t slip or click.')}
<div style="position:absolute;left:72px;top:900px">{btn(IMP_CTA, 24, 32, 22, SKY, NAVY)}</div>
<div style="position:absolute;left:640px;top:917px">{addr_line(area, 24)}</div>""")


def i1_9(area, addr):
    return ad('s9', NAVY, f"""
{photo('stk-couple-lunch-laugh.jpg', 0, 0, 1080, 1150, '66% 40%', radius=0)}
{fade(0, 560, up=True)}{fade(700, 452)}
{logo9()}
{head(80, 1060, 920, 74, 'Order what you fancy. <em>Not what’s easy to chew.</em>', align='center')}
{sub(140, 1330, 800, 29, 'Implants replace missing teeth with fixed teeth that look natural and don’t slip or click.', align='center')}
{centre(1460, btn(IMP_CTA, 28, 40, 24, SKY, NAVY))}""")


def i2_1(area, addr):  # Used to the gap | Navy, photo top
    return ad('s1', NAVY, f"""
{photo('stk-family-selfie.jpg', 0, 0, 1080, 610, '50% 35%', radius=0)}
{fade(0, 220, up=True)}{fade(390, 222)}
{logo1()}
{head(72, 560, 940, 66, 'You’ve got used to the gap. <em>You don’t have to.</em>')}
{sub(72, 735, 820, 25, 'A single implant replaces one missing tooth without touching the healthy teeth either side.')}
<div style="position:absolute;left:72px;top:900px">{btn(IMP_CTA, 24, 32, 22, SKY, NAVY)}</div>
<div style="position:absolute;left:640px;top:917px">{addr_line(area, 24)}</div>""")


def i2_9(area, addr):
    return ad('s9', NAVY, f"""
{photo('stk-family-selfie.jpg', 0, 0, 1080, 1150, '48% 40%', radius=0)}
{fade(0, 560, up=True)}{fade(700, 452)}
{logo9()}
{head(80, 1060, 920, 74, 'You’ve got used to the gap. <em>You don’t have to.</em>', align='center')}
{sub(140, 1330, 800, 29, 'A single implant replaces one missing tooth without touching the healthy teeth either side.', align='center')}
{centre(1460, btn(IMP_CTA, 28, 40, 24, SKY, NAVY))}""")


IMP_STEPS = [('Consultation', 'Your goals, your options, your questions'),
             ('3D scan and plan', 'X-rays and a CBCT scan before anything is placed'),
             ('Placing the implant', 'A minor procedure, with full aftercare'),
             ('Your new tooth', 'A custom crown, made to match')]


def step_row(items, w, cols, s=1.0):
    """Numbered steps in a grid on navy: Sky number, Linen title."""
    d = round(46 * s)
    cells = ''.join(f"""<div style="display:flex;gap:{16 * s}px;align-items:center">
<div style="width:{d}px;height:{d}px;border-radius:50%;background:{SKY};color:{NAVY};flex:none;display:flex;align-items:center;justify-content:center;font-size:{21 * s}px;font-weight:500">{i + 1}</div>
<div style="font-size:{24 * s}px;font-weight:500;color:{LINEN};line-height:1.2">{t}</div></div>""" for i, (t, _) in enumerate(items))
    return f'<div style="width:{w}px;display:grid;grid-template-columns:repeat({cols},1fr);gap:{26 * s}px {24 * s}px">{cells}</div>'


def i3_1(area, addr):  # Four steps | Navy, photo top + step grid
    return ad('s1', NAVY, f"""
{photo('stk-couple-cooking.jpg', 0, 0, 1080, 560, '45% 30%', radius=0)}
{fade(0, 220, up=True)}{fade(340, 222)}
{logo1()}
{head(72, 500, 940, 66, 'Implants, explained <em>before anything starts.</em>')}
<div style="position:absolute;left:72px;top:680px">{step_row(IMP_STEPS, 900, 2, 1.1)}</div>
<div style="position:absolute;left:72px;top:900px">{btn(IMP_CTA, 24, 32, 22, SKY, NAVY)}</div>
<div style="position:absolute;left:640px;top:917px">{addr_line(area, 24)}</div>""")


def i3_9(area, addr):
    return ad('s9', NAVY, f"""
{photo('stk-couple-cooking.jpg', 0, 360, 1080, 740, '45% 40%', radius=0)}
{fade(360, 200, up=True)}{fade(760, 342)}
{logo9()}
{head(80, 900, 920, 74, 'Implants, explained <em>before anything starts.</em>', align='center')}
<div style="position:absolute;left:120px;top:1130px">{step_row(IMP_STEPS, 860, 2, 1.3)}</div>
{centre(1460, btn(IMP_CTA, 28, 40, 24, SKY, NAVY))}""")


def i4_1(area, addr):  # Going abroad | Navy, photo top
    return ad('s1', NAVY, f"""
{photo('stk-couple-seashore.jpg', 0, 0, 1080, 580, '50% 40%', radius=0)}
{fade(0, 220, up=True)}{fade(360, 222)}
{logo1()}
{head(72, 495, 940, 58, 'Thinking of going abroad for implants? <em>Ask who looks after them after.</em>')}
{sub(72, 735, 820, 25, f'Your implant team is in {area}, for every check-up and question after it’s placed.')}
<div style="position:absolute;left:72px;top:900px">{btn(IMP_CTA, 24, 32, 22, SKY, NAVY)}</div>
<div style="position:absolute;left:640px;top:917px">{addr_line(area, 24)}</div>""")


def i4_9(area, addr):
    return ad('s9', NAVY, f"""
{photo('stk-couple-seashore.jpg', 0, 380, 1080, 720, '50% 40%', radius=0)}
{fade(380, 200, up=True)}{fade(800, 302)}
{logo9()}
{head(80, 980, 920, 70, 'Thinking of going abroad for implants? <em>Ask who looks after them after.</em>', align='center')}
{sub(140, 1300, 800, 29, f'Your implant team is in {area}, for every check-up and question after it’s placed.', align='center')}
{centre(1460, btn(IMP_CTA, 28, 40, 24, SKY, NAVY))}""")


def i5_1(area, addr):  # Dentures slipping | Navy, photo top
    return ad('s1', NAVY, f"""
{photo('stk-friends-toast.jpg', 0, 0, 1080, 610, '55% 35%', radius=0)}
{fade(0, 220, up=True)}{fade(390, 222)}
{logo1()}
{head(72, 560, 940, 66, 'Dentures slipping when you laugh? <em>Implants stay put.</em>')}
{sub(72, 735, 820, 25, 'A fixed bridge on implants, from one tooth to a full arch. No adhesive, no clicking.')}
<div style="position:absolute;left:72px;top:900px">{btn(IMP_CTA, 24, 32, 22, SKY, NAVY)}</div>
<div style="position:absolute;left:640px;top:917px">{addr_line(area, 24)}</div>""")


def i5_9(area, addr):
    return ad('s9', NAVY, f"""
{photo('stk-friends-toast.jpg', 0, 0, 1080, 1150, '52% 40%', radius=0)}
{fade(0, 560, up=True)}{fade(700, 452)}
{logo9()}
{head(80, 1060, 920, 74, 'Dentures slipping when you laugh? <em>Implants stay put.</em>', align='center')}
{sub(140, 1330, 800, 29, 'A fixed bridge on implants, from one tooth to a full arch. No adhesive, no clicking.', align='center')}
{centre(1460, btn(IMP_CTA, 28, 40, 24, SKY, NAVY))}""")


# ============================================================ SMILE MAKEOVER & ORTHO
SMO_CTA = 'Book a smile consultation'


def smo_1(img, pos, h, body, photo_h=610, top=560, size=66, sub_top=735, extra=''):
    """Smile makeover 1:1 in the approved photo-top layout (Dentures Slipping): warm group photo, headline below on navy."""
    return ad('s1', NAVY, f"""
{photo(img, 0, 0, 1080, photo_h, pos, radius=0)}
{fade(0, 220, up=True)}{fade(photo_h - 220, 222)}
{logo1()}
{head(72, top, 940, size, h)}
{sub(72, sub_top, 820, 25, body) if body else ''}{extra}
<div style="position:absolute;left:72px;top:900px">{btn(SMO_CTA, 24, 32, 22, SKY, NAVY)}</div>""")


def smo_9(img, pos, h, body, photo_top=0, head_top=1060, size=74, extra=''):
    return ad('s9', NAVY, f"""
{photo(img, 0, photo_top, 1080, 1150 - photo_top, pos, radius=0)}
{fade(photo_top, 560 - photo_top // 2, up=True)}{fade(700, 452)}
{logo9()}
{head(80, head_top, 920, size, h, align='center')}
{sub(140, 1330, 800, 29, body, align='center') if body else ''}{extra}
{centre(1460, btn(SMO_CTA, 28, 40, 24, SKY, NAVY))}""")


S1_H = 'Next group photo, <em>you’ll want a copy too.</em>'
S1_B = 'Straighten, brighten and fix chips and gaps, with one plan under one roof.'


def s1_1(area, addr):  # Hiding in photos | friends laughing at a photo on a phone over dinner
    return smo_1('stk-friends-phone-laugh.jpg', '55% 35%', S1_H, S1_B, extra=f'<div style="position:absolute;left:640px;top:917px">{addr_line(area, 24)}</div>')


def s1_9(area, addr):
    return smo_9('stk-friends-phone-laugh.jpg', '58% 40%', S1_H, S1_B, photo_top=380)


S2_H = 'The straighter smile you’ve wanted for years. <em>No train tracks.</em>'
S2_B = 'Invisalign clear aligners are custom-made, barely noticeable, and come with a bespoke retainer.'


def s2_1(area, addr):  # No train tracks | friends laughing over a glass of wine
    return smo_1('stk-women-wine-laugh.jpg', '45% 30%', S2_H, S2_B, extra=f'<div style="position:absolute;left:640px;top:917px">{addr_line(area, 24)}</div>')


def s2_9(area, addr):
    return smo_9('stk-women-wine-laugh.jpg', '58% 40%', S2_H, S2_B, photo_top=380)


SMO_PLAN = [('Invisalign', 'Straighten crowding and gaps'), ('Whitening', 'Lift the shade'), ('Bonding', 'Refine chips and edges')]
S3_H = 'One plan for the smile you’ve pictured. <em>Not three separate fixes.</em>'


def s3_1(area, addr):  # One plan | friends toasting at lunch + the plan as a step row
    return smo_1('stk-friends-lunch-cheers.jpg', '40% 30%', S3_H, '', photo_h=560, top=500,
                 extra=f'<div style="position:absolute;left:72px;top:720px">{step_row(SMO_PLAN, 900, 3, 1.1)}</div>'
                       f'<div style="position:absolute;left:640px;top:917px">{addr_line(area, 24)}</div>')


def s3_9(area, addr):
    return smo_9('stk-friends-lunch-cheers.jpg', '42% 40%', S3_H, '', photo_top=360, head_top=900,
                 extra=f'<div style="position:absolute;left:120px;top:1170px">{step_row(SMO_PLAN, 860, 3, 1.3)}</div>'
                       f'{centre(1340, addr_line("Smile makeovers in " + area, 26, align="center"))}')


S4_H = 'Laugh without thinking about that chip. <em>Often fixed in one visit.</em>'
S4_B = 'Composite bonding is colour-matched to your teeth and shaped by hand, usually in a single appointment.'


def s4_1(area, addr):  # Chipped tooth | man mid-laugh with friends at the bar
    return smo_1('stk-man-bar-laugh.jpg', '62% 30%', S4_H, S4_B, extra=f'<div style="position:absolute;left:640px;top:917px">{addr_line(area, 24)}</div>')


def s4_9(area, addr):
    return smo_9('stk-man-bar-laugh.jpg', '64% 40%', S4_H, S4_B, photo_top=380)


S5_H = 'Picture your new smile <em>before you commit to anything.</em>'
S5_B = 'Your consultation includes a digital scan, photos of your smile and a clear, written plan.'


def s5_1(area, addr):  # See what's possible | woman laughing at dinner with friends
    return smo_1('stk-woman-dinner-laugh.jpg', '50% 30%', S5_H, S5_B, extra=f'<div style="position:absolute;left:640px;top:917px">{addr_line(area, 24)}</div>')


def s5_9(area, addr):
    return smo_9('stk-woman-dinner-laugh.jpg', '50% 40%', S5_H, S5_B, photo_top=380)


# ============================================================ MEDICAL CARDS
MED_CTA = 'Book your appointment'
MED_COVER = ['Dental examination', 'Fillings', 'Extractions']


def med_card(area, w, s=1.0, rot=-3):
    """A generic 'accepted here' plaque, not a replica of the HSE card."""
    return f"""<div class="card" style="position:relative;width:{w}px;padding:{40 * s}px {44 * s}px;border-radius:{28 * s}px;transform:rotate({rot}deg)">
<div style="display:flex;align-items:center;gap:{16 * s}px"><div style="width:{64 * s}px;height:{64 * s}px;border-radius:50%;background:{HARBOUR};display:flex;align-items:center;justify-content:center;flex:none">{mark(round(36 * s), LINEN)}</div>
<div class="label" style="font-size:{16 * s}px;color:{HARBOUR}">Dentistry.ie {area}</div></div>
<div class="h" style="font-size:{62 * s}px;line-height:1.02;margin-top:{26 * s}px">Medical card <em style="color:{HARBOUR}">patients welcome</em></div>
<div style="height:1px;background:{STONE};margin:{26 * s}px 0 {4 * s}px"></div>
{ticks(MED_COVER, round(24 * s), gap=round(14 * s))}</div>"""


def m1_1(area, addr):  # Yes, we accept | Navy, plaque over photo
    return ad('s1', NAVY, f"""
{photo('stk-couple-sofa.jpg', 0, 0, 560, 1080, '22% 40%', radius=0)}
<div style="position:absolute;left:340px;top:0;width:222px;height:1080px;background:linear-gradient(90deg,rgba(15,27,41,0),{NAVY})"></div>
<div style="position:absolute;left:0;top:0;width:640px;height:220px;background:linear-gradient(180deg,rgba(15,27,41,.75),rgba(15,27,41,0))"></div>
{logo1()}
{head(600, 150, 420, 66, 'Have a medical card? <em>We’ll see you.</em>')}
<div style="position:absolute;left:470px;top:440px">{med_card(area, 520, .9, -2)}</div>
<div style="position:absolute;left:600px;top:950px">{btn(MED_CTA, 22, 28, 20, SKY, NAVY)}</div>""")


def m1_9(area, addr):
    return ad('s9', NAVY, f"""
{photo('stk-couple-sofa.jpg', 0, 520, 1080, 800, '45% 40%', radius=0)}
{fade(520, 240, up=True)}{fade(1080, 242)}
{logo9()}
{head(80, 390, 920, 86, 'Have a medical card? <em>We’ll see you.</em>', align='center')}
<div style="position:absolute;left:230px;top:1030px">{med_card(area, 620, 1.0, -2)}</div>
{centre(1540, btn(MED_CTA, 28, 40, 24, SKY, NAVY))}""")


def m2_1(area, addr):  # What it covers | Navy, tick list + portrait
    return ad('s1', NAVY, f"""
{glow(560, 60, 640, HARBOUR, .85)}
{logo1()}
<div style="position:absolute;left:72px;top:190px">{area_chip('Medical card dentist in ' + area, 22, SKY, NAVY)}</div>
{head(72, 290, 560, 68, 'Your medical card covers <em>your dental care.</em>')}
<div style="position:absolute;left:72px;top:540px">{ticks(MED_COVER, 30, LINEN, SKY, NAVY, 20)}</div>
<div style="position:absolute;left:72px;top:920px">{btn(MED_CTA, 24, 32, 22, SKY, NAVY)}</div>
{portrait('stk-couple-tea.jpg', 836, 600, 380, '50% 40%', 1.35, '50% 30%')}""")


def m2_9(area, addr):
    return ad('s9', NAVY, f"""
{glow(180, 760, 760, HARBOUR, .85)}
{logo9()}
{centre(390, area_chip('Medical card dentist in ' + area, 26, SKY, NAVY))}
{head(90, 490, 900, 84, 'Your medical card covers <em>your dental care.</em>', align='center')}
{portrait('stk-couple-tea.jpg', 540, 1030, 480, '50% 40%', 1.35, '50% 30%')}
<div style="position:absolute;left:0;right:0;top:1320px;display:flex;justify-content:center;gap:34px">{''.join(f'<div style="display:flex;align-items:center;gap:12px;font-size:28px;color:{LINEN}">{TICK.format(s=30, bg=SKY, fg=NAVY)}{t}</div>' for t in MED_COVER)}</div>
{centre(1460, btn(MED_CTA, 28, 40, 24, SKY, NAVY))}""")


def m3_1(area, addr):  # Rang around | Harbour, hand note
    return ad('s1', HARBOUR, f"""
{glow(250, 120, 640, SKY, .55)}
{logo1()}
<div style="position:absolute;left:300px;top:150px">{handnote([('Dentist 1', SLATE, True), ('Dentist 2', SLATE, True), ('Dentist 3', SLATE, True), (f'Dentistry.ie {area}', NAVY, False)], 480, .8, -3)}</div>
{head(72, 740, 936, 50, 'Rang around and heard “we don’t take medical cards”? <em>We do.</em>', align='center')}
{centre(910, btn(MED_CTA, 26, 36, 22, LINEN, NAVY))}""")


def m3_9(area, addr):
    return ad('s9', HARBOUR, f"""
{glow(160, 400, 800, SKY, .55)}
{logo9()}
<div style="position:absolute;left:220px;top:470px">{handnote([('Dentist 1', SLATE, True), ('Dentist 2', SLATE, True), ('Dentist 3', SLATE, True), (f'Dentistry.ie {area}', NAVY, False)], 640, 1.05, -3)}</div>
{head(80, 1150, 920, 58, 'Rang around and heard “we don’t take medical cards”? <em>We do.</em>', align='center')}
{centre(1460, btn(MED_CTA, 28, 40, 24, LINEN, NAVY))}""")


def m4_1(area, addr):  # Don't let it go unused | Navy, photo top
    return ad('s1', NAVY, f"""
{photo('stk-woman-coffee-friends.jpg', 0, 0, 1080, 610, '50% 35%', radius=0)}
{fade(0, 220, up=True)}{fade(390, 222)}
{logo1()}
{head(72, 560, 940, 66, 'Your dental care is covered. <em>Don’t let it go unused.</em>')}
{sub(72, 735, 860, 25, 'Medical card holders can have a check-up, fillings and extractions at our clinic.')}
<div style="position:absolute;left:72px;top:900px">{btn(MED_CTA, 24, 32, 22, SKY, NAVY)}</div>
<div style="position:absolute;left:600px;top:917px">{addr_line(area, 24)}</div>""")


def m4_9(area, addr):
    return ad('s9', NAVY, f"""
{photo('stk-woman-coffee-friends.jpg', 0, 500, 1080, 650, '55% 30%', radius=0)}
{fade(500, 200, up=True)}{fade(900, 252)}
{logo9()}
{head(80, 1060, 920, 72, 'Your dental care is covered. <em>Don’t let it go unused.</em>', align='center')}
{sub(140, 1330, 800, 29, 'Medical card holders can have a check-up, fillings and extractions at our clinic.', align='center')}
{centre(1460, btn(MED_CTA, 28, 40, 24, SKY, NAVY))}""")


def m5_1(area, addr):  # Local | Navy, address card + photo
    return ad('s1', NAVY, f"""
{glow(-160, -200, 620, HARBOUR, .8)}
{photo('stk-man-breakfast.jpg', 560, 80, 450, 560, '30% 35%')}
{logo1()}
{head(72, 190, 460, 70, f'A medical card dentist <em>in {area}.</em>')}
<div class="card" style="left:72px;top:560px;width:560px;padding:34px 38px;transform:rotate(-1.5deg)">
<div class="label" style="font-size:14px;color:{HARBOUR}">Find us</div>
<div style="display:flex;align-items:center;gap:12px;font-size:28px;font-weight:500;margin-top:12px">{pin(30, HARBOUR)}{addr}</div>
<div style="font-size:21px;color:{SLATE};margin-top:12px">100% Irish owned. Caring for families since 1980.</div></div>
<div style="position:absolute;left:72px;top:920px">{btn(MED_CTA, 24, 32, 22, SKY, NAVY)}</div>""")


def m5_9(area, addr):
    return ad('s9', NAVY, f"""
{glow(600, 100, 700, HARBOUR, .8)}
{logo9()}
{head(80, 390, 920, 88, f'A medical card dentist <em>in {area}.</em>', align='center')}
{photo('stk-man-breakfast.jpg', 140, 640, 800, 600, '30% 35%')}
<div class="card" style="left:170px;top:1150px;width:740px;padding:40px 46px;transform:rotate(-1.5deg)">
<div class="label" style="font-size:16px;color:{HARBOUR}">Find us</div>
<div style="display:flex;align-items:center;gap:14px;font-size:32px;font-weight:500;margin-top:12px">{pin(34, HARBOUR)}{addr}</div>
<div style="font-size:24px;color:{SLATE};margin-top:12px">100% Irish owned. Caring for families since 1980.</div></div>
{centre(1490, btn(MED_CTA, 28, 40, 24, SKY, NAVY))}""")


CAMPAIGNS = {
    'implants': {
        'title': 'Implants', 'clinics': ['balbriggan', 'kildare', 'kilkenny', 'dublin2'],
        'concepts': [('Eat What You Want', 'Lifestyle', i1_1, i1_9), ('Used To The Gap', 'Lifestyle', i2_1, i2_9),
                     ('Four Steps', 'Graphic', i3_1, i3_9), ('Going Abroad', 'Note', i4_1, i4_9),
                     ('Dentures Slipping', 'Lifestyle', i5_1, i5_9)]},
    'smo': {
        'title': 'Smile Makeover & Ortho', 'clinics': list(ALL),
        'concepts': [('Hiding In Photos', 'Lifestyle', s1_1, s1_9), ('No Train Tracks', 'Lifestyle', s2_1, s2_9),
                     ('One Plan', 'Lifestyle', s3_1, s3_9), ('Chipped Tooth', 'Lifestyle', s4_1, s4_9),
                     ('See What’s Possible', 'Lifestyle', s5_1, s5_9)]},
    'medical': {
        'title': 'Medical Cards', 'clinics': ['artane', 'balbriggan', 'kimmage'],
        'concepts': [('We Accept Medical Cards', 'Lifestyle', m1_1, m1_9), ('What It Covers', 'Lifestyle', m2_1, m2_9),
                     ('Rang Around', 'Note', m3_1, m3_9), ('Don’t Let It Go Unused', 'Lifestyle', m4_1, m4_9),
                     ('Local Dentist', 'Lifestyle', m5_1, m5_9)]},
}


def main():
    cap = '<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>'
    n = 0
    for key, camp in CAMPAIGNS.items():
        hd = f'<!doctype html><html lang="en-IE"><head><meta charset="utf-8"><title>Dentistry.ie {camp["title"]} statics</title><style>{CSS}</style>'
        for k in camp['clinics']:
            area, addr = ALL[k]
            r1 = ''.join(f1(area, addr) for _, _, f1, _ in camp['concepts'])
            r9 = ''.join(f9(area, addr) for _, _, _, f9 in camp['concepts'])
            body = f'</head><body><div class="row">{r1}</div><div class="row">{r9}</div></body></html>'
            (HERE / f'camp-{key}-{k}.html').write_text(hd + body)
            (HERE / f'camp-{key}-{k}-capture.html').write_text(hd + cap + body)
            n += len(camp['concepts']) * 2
    print('built', n, 'artboards')


if __name__ == '__main__':
    main()
