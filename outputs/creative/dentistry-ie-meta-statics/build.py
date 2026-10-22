"""Dentistry.ie general (new patient) Meta statics: 10 concepts x 8 clinics x 1:1 + 9:16, in the website blues.

Concepts (copy and research in copy-*.md, research.md):
  C1  Been a while        - Mark, lapsed. Problem aware, sophistication 5.
  C2  One person          - Denise, switching. Solution aware, 3 (the coordinator is the mechanism).
  C3  New to the area     - Sophie, local search. Product aware, 2 (address, inclusions, proof).
  C4  Before it hurts     - Mark/Ray, only goes when in pain. Problem aware, 4.
  C5  Dentist retired     - Denise/Sophie, the moment. Problem aware, 5.
  C6  Taking new patients - most aware, 2. Hanging sign over the reception.
  C7  Reviews             - product aware, 2. Three Google reviews from dentistry.ie, unnamed.
  C8  First visit         - Mark, doesn't know what happens. Solution aware, 3.
  C9  Specialists         - Denise, switching. Solution aware, 4 (coordinated care).
  C10 Note to self        - Mark, keeps putting it off. Problem aware, 5. Lo-fi post-it.

Clinic facts (addresses, coordinators) come from each clinic's lp.dentistry.ie/<slug>/new-patients-meta page, 22 Oct 2026.
No prices or opening hours on image (Toby, 22 Oct 2026). Brand system: build_guideline.py. Toby asked for more of the website
blues (22 Oct), so grounds rotate through Harbour Blue, Navy and Sky, with Linen as the light ground.

Usage: python3 build.py  ->  loc-<clinic>.html (+ -capture.html for Figma): a 1:1 row and a 9:16 row of all 10 concepts.
"""
from pathlib import Path

from build_guideline import (CSS as G_CSS, HARBOUR, LINEN, NAVY, SKY, STONE, SLATE, WHITE, ARROW, TICK, STAR,
                             logo, mark, btn, chip)

HERE = Path(__file__).parent

CLINICS = [  # key, area on image, short address, coordinator first name (None = not listed on the LP)
    ('artane', 'Artane', 'Artane Castle Shopping Centre', 'Amy'),
    ('balbriggan', 'Balbriggan', '6 Chapel Street, Balbriggan', 'Tracy'),
    ('castleknock', 'Castleknock', 'Ashleigh Centre, Castleknock Road', 'Gosia'),
    ('dublin2', 'Dublin 2', '17 Fitzwilliam Street Upper', 'Natalie'),
    ('kildare', 'Kildare', 'Claregate Street, Kildare', 'Alina'),
    ('kilkenny', 'Kilkenny', 'Friary Street, Kilkenny', None),
    ('kimmage', 'Kimmage', 'Sundrive Shopping Centre', 'AnnMarie'),
    ('maynooth', 'Maynooth', 'Maynooth, Co. Kildare', 'Gosia'),
]

SKY_PALE = '#CFEBF4'  # Sky at ~35% on white: post-it paper, light panels

GRAIN = ("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260'>"
         "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .55 0'/></filter>"
         "<rect width='100%' height='100%' filter='url(%23n)'/></svg>")

CSS = G_CSS.replace('\nbody{', '\nbody{background:#cfd3d8 !important;gap:160px !important;padding:80px !important;width:max-content !important;') + f"""
@font-face{{font-family:'Caveat';src:url('assets/fonts/Caveat.ttf');font-weight:400 700}}
.row{{display:flex;gap:80px;align-items:flex-start}}
.ad{{position:relative;overflow:hidden;flex:none}}
.s1{{width:1080px;height:1080px}} .s9{{width:1080px;height:1920px}}
.grain{{position:absolute;inset:0;background-image:url("{GRAIN}");opacity:.06;pointer-events:none;mix-blend-mode:multiply}}
.glow{{position:absolute;border-radius:50%;filter:blur(90px);pointer-events:none}}
.card{{position:absolute;background:{WHITE};border-radius:28px;box-shadow:0 30px 60px -20px rgba(15,27,41,.35),0 8px 18px -8px rgba(15,27,41,.25)}}
.photo{{position:absolute;overflow:hidden;border-radius:36px;box-shadow:0 34px 70px -24px rgba(15,27,41,.45)}}
.photo img{{width:100%;height:100%;object-fit:cover;display:block}}
.hand{{font-family:'Caveat',cursive;font-weight:600;line-height:1.05}}
"""


def photo(src, x, y, w, h, pos='50% 50%', radius=36):
    return f'<div class="photo" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;border-radius:{radius}px"><img src="assets/photos/{src}" style="object-position:{pos}"></div>'


def heart(src, x, y, h, shadow=True):
    sh = 'filter:drop-shadow(0 30px 40px rgba(15,27,41,.3));' if shadow else ''
    return f'<img src="assets/photos/{src}" style="position:absolute;left:{x}px;top:{y}px;height:{h}px;width:{round(h * .905)}px;display:block;{sh}">'


def pin(size, colour):
    return f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" style="display:block;flex:none"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" stroke="{colour}" stroke-width="1.8"/><circle cx="12" cy="10" r="2.4" fill="{colour}"/></svg>'


def stars(s, c=SKY):
    return '<div style="display:flex;gap:4px">' + ''.join(STAR.format(s=s, c=c) for _ in range(5)) + '</div>'


def ticks(items, size, colour=NAVY, bg=HARBOUR, fg=LINEN, gap=18):
    return ''.join(f'<div style="display:flex;align-items:center;gap:{size * .65}px;margin-top:{gap}px;font-size:{size}px;color:{colour}">{TICK.format(s=round(size * 1.1), bg=bg, fg=fg)}<span>{t}</span></div>' for t in items)


def area_chip(text, size, bg=NAVY, fg=LINEN):
    return f'<div style="display:inline-flex;align-items:center;gap:{size * .5}px;background:{bg};color:{fg};font-weight:500;font-size:{size}px;padding:{size * .5}px {size * .9}px;border-radius:999px">{pin(round(size * 1.1), fg)}{text}</div>'


def glow(x, y, d, colour, op):
    return f'<div class="glow" style="left:{x}px;top:{y}px;width:{d}px;height:{d}px;background:{colour};opacity:{op}"></div>'


def ad(cls, bg, body):
    return f'<section class="ad {cls}" style="background:{bg}">{body}<div class="grain"></div></section>'


def at(addr):
    return 'in' if addr.startswith('Maynooth') else 'at'


# ---------------------------------------------------------------- C1 Been a while (Mark) | Harbour Blue
C1_SUB = 'Your first visit is a full check-up and an honest chat about your options. No obligation.'


def c1_1x1(c):
    k, area, addr, coord = c
    return ad('s1', HARBOUR, f"""
{glow(560, 60, 640, SKY, .45)}
<div style="position:absolute;left:72px;top:68px">{logo(230, LINEN)}</div>
<div style="position:absolute;left:72px;top:190px">{area_chip('New patients welcome in ' + area, 22)}</div>
<div class="h" style="position:absolute;left:72px;top:290px;width:540px;font-size:70px;line-height:1.06;color:{LINEN}">It’s been a few years. <em>We won’t make a thing of it.</em></div>
<div class="body" style="position:absolute;left:72px;top:690px;width:470px;font-size:25px;line-height:1.5;color:{LINEN};opacity:.88">{C1_SUB}</div>
<div style="position:absolute;left:72px;top:920px">{btn('Book your check-up', 26, 36, 22, SKY, NAVY)}</div>
{heart('mask-team.png', 600, 300, 560)}""")


def c1_9x16(c):
    k, area, addr, coord = c
    return ad('s9', HARBOUR, f"""
{glow(180, 760, 760, SKY, .5)}
<div style="position:absolute;left:0;right:0;top:270px;display:flex;justify-content:center">{logo(300, LINEN)}</div>
<div style="position:absolute;left:0;right:0;top:390px;display:flex;justify-content:center">{area_chip('New patients welcome in ' + area, 26)}</div>
<div class="h" style="position:absolute;left:90px;right:90px;top:490px;text-align:center;font-size:84px;line-height:1.05;color:{LINEN}">It’s been a few years. <em>We won’t make a thing of it.</em></div>
{heart('mask-team.png', 288, 790, 560)}
<div class="body" style="position:absolute;left:150px;right:150px;top:1380px;text-align:center;font-size:28px;line-height:1.45;color:{LINEN};opacity:.88">{C1_SUB}</div>
<div style="position:absolute;left:0;right:0;top:1490px;display:flex;justify-content:center">{btn('Book your check-up', 28, 40, 24, SKY, NAVY)}</div>""")


# ---------------------------------------------------------------- C2 One person (Denise) | photo into Harbour Blue
def badge(coord, area, w, s=1.0):
    who = coord if coord else 'Your coordinator'
    return f"""<div class="card" style="position:relative;width:{w}px;padding:{30 * s}px {34 * s}px;border-radius:{24 * s}px;transform:rotate(-2deg)">
<div style="position:absolute;left:50%;top:{-14 * s}px;transform:translateX(-50%);width:{90 * s}px;height:{22 * s}px;border-radius:{11 * s}px;background:{STONE};box-shadow:inset 0 2px 4px rgba(0,0,0,.12)"></div>
<div style="display:flex;align-items:center;gap:{18 * s}px">
<div style="width:{70 * s}px;height:{70 * s}px;border-radius:50%;background:{HARBOUR};display:flex;align-items:center;justify-content:center;flex:none">{mark(round(40 * s), LINEN)}</div>
<div><div style="font-size:{34 * s}px;font-weight:500;line-height:1.1">{who}</div>
<div style="font-size:{17 * s}px;color:{HARBOUR};margin-top:{6 * s}px;font-weight:500">Treatment coordinator, {area}</div></div></div></div>"""


C2_SUB = 'They explain your options and the costs before anything starts. No pressure, no surprises.'


def c2_1x1(c):
    k, area, addr, coord = c
    return ad('s1', HARBOUR, f"""
{photo('fees.png', 0, 0, 1080, 600, '50% 40%', radius=0)}
<div style="position:absolute;left:0;top:0;width:1080px;height:240px;background:linear-gradient(180deg,rgba(15,27,41,.8),rgba(15,27,41,0))"></div>
<div style="position:absolute;left:0;top:380px;width:1080px;height:222px;background:linear-gradient(180deg,rgba(50,116,163,0),{HARBOUR})"></div>
<div style="position:absolute;left:72px;top:68px">{logo(230, LINEN)}</div>
<div class="h" style="position:absolute;left:72px;top:560px;width:940px;font-size:66px;line-height:1.06;color:{LINEN}">One person looks after you, <em>start to finish.</em></div>
<div class="body" style="position:absolute;left:72px;top:735px;width:880px;font-size:25px;line-height:1.5;color:{LINEN};opacity:.9">{C2_SUB}</div>
<div style="position:absolute;left:72px;top:860px">{badge(coord, area, 470)}</div>
<div style="position:absolute;left:600px;top:905px">{btn('Book a new patient visit', 24, 32, 22, NAVY, LINEN)}</div>""")


def c2_9x16(c):
    k, area, addr, coord = c
    return ad('s9', HARBOUR, f"""
{photo('fees.png', 0, 0, 1080, 1120, '45% 50%', radius=0)}
<div style="position:absolute;left:0;top:640px;width:1080px;height:480px;background:linear-gradient(180deg,rgba(50,116,163,0),{HARBOUR})"></div>
<div style="position:absolute;left:0;top:0;width:1080px;height:520px;background:linear-gradient(180deg,rgba(15,27,41,.85) 22%,rgba(15,27,41,0))"></div>
<div style="position:absolute;left:0;right:0;top:270px;display:flex;justify-content:center">{logo(300, LINEN)}</div>
<div class="h" style="position:absolute;left:90px;right:90px;top:1060px;text-align:center;font-size:84px;line-height:1.05;color:{LINEN}">One person looks after you, <em>start to finish.</em></div>
<div class="body" style="position:absolute;left:140px;right:140px;top:1290px;text-align:center;font-size:29px;line-height:1.45;color:{LINEN};opacity:.9">{C2_SUB}</div>
<div style="position:absolute;left:0;right:0;top:1430px;display:flex;justify-content:center">{badge(coord, area, 520)}</div>""")


# ---------------------------------------------------------------- C3 New to the area (Sophie) | Harbour band over Linen
VISIT = ['Full dental exam', 'Gum health check', 'Mouth cancer screening', 'A clear plan, explained']


def visit_card(w, s=1.0, rot=1.6):
    return f"""<div class="card" style="position:relative;width:{w}px;padding:{34 * s}px {38 * s}px {38 * s}px;transform:rotate({rot}deg)">
<div class="label" style="font-size:{14 * s}px;color:{HARBOUR}">Your first visit</div>
{ticks(VISIT, round(26 * s), gap=round(16 * s))}</div>"""


def proof_line(size, colour=NAVY, star=HARBOUR):
    return f'<div style="display:flex;align-items:center;gap:{size * .6}px;font-size:{size}px;color:{colour}">{stars(round(size * 1.05), star)}<span><b style="font-weight:500">500+ five-star</b> Google reviews</span></div>'


def c3_1x1(c):
    k, area, addr, coord = c
    return ad('s1', LINEN, f"""
<div style="position:absolute;left:0;top:0;width:1080px;height:600px;background:{HARBOUR}"></div>
{glow(-160, -200, 620, SKY, .45)}
{photo('why-us-home.png', 540, 70, 470, 600, '56% 45%')}
<div style="position:absolute;left:72px;top:68px">{logo(230, LINEN)}</div>
<div class="h" style="position:absolute;left:72px;top:190px;width:480px;font-size:76px;line-height:1.04;color:{LINEN}">Looking for a dentist <em>in {area}?</em></div>
<div style="position:absolute;left:72px;top:520px;display:flex;align-items:center;gap:10px;font-size:22px;color:{LINEN}">{pin(26, SKY)}{addr}</div>
<div style="position:absolute;left:470px;top:560px">{visit_card(520)}</div>
<div style="position:absolute;left:72px;top:660px;width:390px">{proof_line(20)}<div class="small" style="margin-top:10px;font-size:20px;color:{SLATE}">Caring for families since 1980</div></div>
<div style="position:absolute;left:72px;top:920px">{btn('Book an appointment', 26, 36, 22)}</div>""")


def c3_9x16(c):
    k, area, addr, coord = c
    return ad('s9', LINEN, f"""
<div style="position:absolute;left:0;top:0;width:1080px;height:960px;background:{HARBOUR}"></div>
{glow(600, 100, 700, SKY, .45)}
<div style="position:absolute;left:0;right:0;top:270px;display:flex;justify-content:center">{logo(300, LINEN)}</div>
<div class="h" style="position:absolute;left:90px;right:90px;top:390px;text-align:center;font-size:92px;line-height:1.03;color:{LINEN}">Looking for a dentist <em>in {area}?</em></div>
<div style="position:absolute;left:0;right:0;top:640px;display:flex;justify-content:center;align-items:center;gap:10px;font-size:26px;color:{LINEN}">{pin(30, SKY)}{addr}</div>
{photo('why-us-home.png', 90, 730, 900, 560, '56% 42%')}
<div style="position:absolute;left:250px;top:1190px">{visit_card(580, 1.05)}</div>
<div style="position:absolute;left:0;right:0;top:1520px;display:flex;justify-content:center">{proof_line(24)}</div>""")


# ---------------------------------------------------------------- C4 Before it hurts (Mark/Ray) | Sky
C4_SUB = 'A full check-up looks for early signs of decay and wear, while they’re still small.'


def c4_1x1(c):
    k, area, addr, coord = c
    return ad('s1', SKY, f"""
{glow(520, 500, 700, LINEN, .55)}
{photo('journey-image-1.png', 600, 90, 410, 560, '50% 30%')}
<div style="position:absolute;left:72px;top:68px">{logo(230)}</div>
<div style="position:absolute;left:72px;top:190px">{area_chip('New patients welcome in ' + area, 22)}</div>
<div class="h" style="position:absolute;left:72px;top:290px;width:520px;font-size:72px;line-height:1.05">Only go when something hurts? <em>Come in before it does.</em></div>
<div class="body" style="position:absolute;left:72px;top:700px;width:860px;font-size:26px;line-height:1.5;color:{NAVY}">{C4_SUB}</div>
<div style="position:absolute;left:72px;top:900px">{btn('Book your check-up', 26, 36, 22, NAVY, LINEN)}</div>
<div class="card" style="left:690px;top:600px;padding:22px 28px;border-radius:20px;transform:rotate(-2deg)"><div class="label" style="font-size:13px;color:{HARBOUR}">Your first visit</div><div style="font-size:24px;font-weight:500;margin-top:6px">Full check-up</div></div>""")


def c4_9x16(c):
    k, area, addr, coord = c
    return ad('s9', SKY, f"""
{glow(150, 900, 800, LINEN, .55)}
<div style="position:absolute;left:0;right:0;top:270px;display:flex;justify-content:center">{logo(300)}</div>
<div style="position:absolute;left:0;right:0;top:390px;display:flex;justify-content:center">{area_chip('New patients welcome in ' + area, 26)}</div>
<div class="h" style="position:absolute;left:80px;right:80px;top:480px;text-align:center;font-size:78px;line-height:1.04">Only go when something hurts? <em>Come in before it does.</em></div>
{photo('journey-image-1.png', 240, 790, 600, 570, '50% 28%')}
<div class="body" style="position:absolute;left:140px;right:140px;top:1395px;text-align:center;font-size:29px;line-height:1.45;color:{NAVY}">{C4_SUB}</div>
<div style="position:absolute;left:0;right:0;top:1500px;display:flex;justify-content:center">{btn('Book your check-up', 28, 40, 24, NAVY, LINEN)}</div>""")


# ---------------------------------------------------------------- C5 Dentist retired | Navy + Harbour glow
C5_SUB = 'A full check-up and a proper conversation. We take the time to listen, and explain everything in plain English.'


def c5_1x1(c):
    k, area, addr, coord = c
    return ad('s1', NAVY, f"""
{glow(-200, 500, 760, HARBOUR, .8)}
{photo('video-page-break.png', 540, 360, 470, 650, '32% 50%')}
<div style="position:absolute;left:72px;top:68px">{logo(230, LINEN)}</div>
<div class="h" style="position:absolute;left:72px;top:170px;width:940px;font-size:64px;line-height:1.06;color:{LINEN}">Your old dentist retired? <em>We’ve been here since 1980.</em></div>
<div style="position:absolute;left:72px;top:400px">{area_chip('New patients welcome in ' + area, 21, SKY, NAVY)}</div>
<div class="body" style="position:absolute;left:72px;top:500px;width:420px;font-size:25px;line-height:1.5;color:{LINEN};opacity:.88">{C5_SUB}</div>
<div style="position:absolute;left:72px;top:920px">{btn('Book a new patient visit', 24, 32, 22, SKY, NAVY)}</div>""")


def c5_9x16(c):
    k, area, addr, coord = c
    return ad('s9', NAVY, f"""
{glow(-150, 1100, 900, HARBOUR, .8)}
<div style="position:absolute;left:0;right:0;top:270px;display:flex;justify-content:center">{logo(300, LINEN)}</div>
<div class="h" style="position:absolute;left:80px;right:80px;top:390px;text-align:center;font-size:74px;line-height:1.05;color:{LINEN}">Your old dentist retired? <em>We’ve been here since 1980.</em></div>
<div style="position:absolute;left:0;right:0;top:660px;display:flex;justify-content:center">{area_chip('New patients welcome in ' + area, 26, SKY, NAVY)}</div>
{photo('video-page-break.png', 120, 770, 840, 580, '40% 45%')}
<div class="body" style="position:absolute;left:140px;right:140px;top:1385px;text-align:center;font-size:29px;line-height:1.45;color:{LINEN};opacity:.88">{C5_SUB}</div>
<div style="position:absolute;left:0;right:0;top:1500px;display:flex;justify-content:center">{btn('Book a new patient visit', 28, 40, 24, SKY, NAVY)}</div>""")


# ---------------------------------------------------------------- C6 Taking new patients | hanging sign over blurred reception
def sign(area, w, s=1.0):
    return f"""<div class="card" style="position:relative;width:{w}px;padding:{44 * s}px {50 * s}px {46 * s}px;border-radius:{30 * s}px;text-align:center">
<div style="position:absolute;left:{w * .18}px;top:{24 * s}px;width:{16 * s}px;height:{16 * s}px;border-radius:50%;background:{STONE};box-shadow:inset 0 2px 3px rgba(0,0,0,.25)"></div>
<div style="position:absolute;right:{w * .18}px;top:{24 * s}px;width:{16 * s}px;height:{16 * s}px;border-radius:50%;background:{STONE};box-shadow:inset 0 2px 3px rgba(0,0,0,.25)"></div>
<div class="h" style="font-size:{120 * s}px;line-height:1;color:{HARBOUR};margin-top:{6 * s}px"><em>Yes,</em></div>
<div class="h" style="font-size:{58 * s}px;line-height:1.08;margin-top:{10 * s}px">we’re taking new patients</div>
<div style="height:1px;background:{STONE};margin:{26 * s}px 0 {20 * s}px"></div>
<div style="display:flex;align-items:center;justify-content:center;gap:{12 * s}px;font-size:{24 * s}px;font-weight:500;color:{SLATE}">{pin(round(26 * s), HARBOUR)}Dentistry.ie {area}</div></div>"""


def cords(x1, x2, top, bottom, spread):
    return f'<svg style="position:absolute;left:0;top:0" width="1080" height="{bottom + 40}"><line x1="{x1 - spread}" y1="{top}" x2="{x1}" y2="{bottom}" stroke="{LINEN}" stroke-width="3" opacity=".8"/><line x1="{x2 + spread}" y1="{top}" x2="{x2}" y2="{bottom}" stroke="{LINEN}" stroke-width="3" opacity=".8"/></svg>'


USP = ['100% Irish owned', 'Since 1980', '500+ five-star reviews']


def usp_bar(size, vertical=False):
    items = ''.join(f'<div style="display:flex;align-items:center;gap:{size * .6}px;font-family:\'IBM Plex Serif\',serif;font-style:italic;font-size:{size}px;color:{LINEN}">{TICK.format(s=round(size * 1.05), bg=LINEN, fg=HARBOUR)}{u}</div>' for u in USP)
    d = 'column;gap:18px;align-items:center' if vertical else 'row;justify-content:space-around;align-items:center'
    return f'<div style="display:flex;flex-direction:{d};width:100%;height:100%">{items}</div>'


def c6_1x1(c):
    k, area, addr, coord = c
    return ad('s1', NAVY, f"""
<img src="assets/photos/fees-blur.jpg" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">
<div style="position:absolute;inset:0;background:rgba(15,27,41,.55)"></div>
{cords(380, 700, 0, 262, 40)}
<div style="position:absolute;left:72px;top:68px">{logo(230, LINEN)}</div>
<div style="position:absolute;left:250px;top:240px;transform:rotate(-1.5deg)">{sign(area, 580)}</div>
<div style="position:absolute;left:0;top:880px;width:1080px;height:200px;background:{HARBOUR};padding:0 40px">{usp_bar(24)}</div>""")


def c6_9x16(c):
    k, area, addr, coord = c
    return ad('s9', NAVY, f"""
<img src="assets/photos/fees-blur.jpg" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:40% 50%">
<div style="position:absolute;inset:0;background:rgba(15,27,41,.55)"></div>
<div style="position:absolute;left:0;right:0;top:270px;display:flex;justify-content:center">{logo(300, LINEN)}</div>
{cords(360, 720, 380, 652, 50)}
<div style="position:absolute;left:180px;top:630px;transform:rotate(-1.5deg)">{sign(area, 720, 1.2)}</div>
<div style="position:absolute;left:0;top:1260px;width:1080px;height:320px;background:{HARBOUR};padding:40px 0">{usp_bar(30, vertical=True)}</div>""")


# ---------------------------------------------------------------- C7 Reviews | Harbour Blue + stacked review cards
REVIEWS = ['I was talked through everything and everyone was so lovely.',
           'I am delighted that I changed to this dental practice.',
           'As an extremely nervous patient I was so at ease the minute I walked in the door.']


def review_card(q, w, s=1.0, rot=0):
    return f"""<div class="card" style="position:relative;width:{w}px;padding:{26 * s}px {32 * s}px;border-radius:{22 * s}px;transform:rotate({rot}deg)">
{stars(round(22 * s), HARBOUR)}<div style="font-family:'IBM Plex Serif',serif;font-style:italic;font-size:{28 * s}px;line-height:1.35;margin-top:{12 * s}px">“{q}”</div></div>"""


def c7_1x1(c):
    k, area, addr, coord = c
    cards = ''.join(f'<div style="position:absolute;left:{x}px;top:{y}px">{review_card(q, 760, 1, r)}</div>' for q, x, y, r in
                    zip(REVIEWS, (72, 248, 140), (330, 500, 670), (-1.2, 1, -.6)))
    return ad('s1', HARBOUR, f"""
{glow(500, -200, 760, SKY, .45)}
<div style="position:absolute;left:72px;top:68px">{logo(230, LINEN)}</div>
<div class="h" style="position:absolute;left:72px;top:160px;width:940px;font-size:60px;line-height:1.06;color:{LINEN}">Over 500 five-star reviews. <em>Here’s what patients say.</em></div>
{cards}
<div style="position:absolute;left:72px;top:935px">{btn('Book a new patient visit', 24, 32, 22, LINEN, NAVY)}</div>
<div class="small" style="position:absolute;left:560px;top:945px;width:460px;font-size:18px;color:{LINEN};opacity:.8">Google reviews of Dentistry.ie clinics. New patients welcome in {area}.</div>""")


def c7_9x16(c):
    k, area, addr, coord = c
    cards = ''.join(f'<div style="position:absolute;left:{x}px;top:{y}px">{review_card(q, 860, 1.1, r)}</div>' for q, x, y, r in
                    zip(REVIEWS, (90, 130, 100), (640, 860, 1080), (-1.2, 1, -.6)))
    return ad('s9', HARBOUR, f"""
{glow(400, 1100, 900, SKY, .45)}
<div style="position:absolute;left:0;right:0;top:270px;display:flex;justify-content:center">{logo(300, LINEN)}</div>
<div class="h" style="position:absolute;left:80px;right:80px;top:390px;text-align:center;font-size:76px;line-height:1.05;color:{LINEN}">Over 500 five-star reviews. <em>Here’s what patients say.</em></div>
{cards}
<div class="small" style="position:absolute;left:120px;right:120px;top:1360px;text-align:center;font-size:24px;color:{LINEN};opacity:.85">Google reviews of Dentistry.ie clinics. New patients welcome in {area}.</div>
<div style="position:absolute;left:0;right:0;top:1460px;display:flex;justify-content:center">{btn('Book a new patient visit', 28, 40, 24, LINEN, NAVY)}</div>""")


# ---------------------------------------------------------------- C8 First visit, step by step | Linen + Harbour panel
STEPS = [('Book online', 'The team gets in touch to find a time'),
         ('Full check-up', 'Teeth, gums and mouth cancer screening'),
         ('Findings explained', 'In plain English, with time for questions'),
         ('Your plan', 'Plus advice for home. You decide')]


def steps_row(w, s=1.0):
    cols = ''.join(f"""<div style="flex:1;padding-right:{14 * s}px">
<div style="width:{56 * s}px;height:{56 * s}px;border-radius:50%;background:{SKY};color:{NAVY};display:flex;align-items:center;justify-content:center;font-size:{26 * s}px;font-weight:500">{i + 1}</div>
<div style="font-size:{24 * s}px;font-weight:500;color:{LINEN};margin-top:{16 * s}px;line-height:1.2">{t}</div>
<div style="font-size:{18 * s}px;color:{LINEN};opacity:.82;margin-top:{6 * s}px;line-height:1.4">{d}</div></div>""" for i, (t, d) in enumerate(STEPS))
    return f'<div style="display:flex;width:{w}px">{cols}</div>'


def steps_col(s=1.0):
    return ''.join(f"""<div style="display:flex;gap:{24 * s}px;align-items:center;margin-top:{i and 26 * s or 0}px">
<div style="width:{60 * s}px;height:{60 * s}px;border-radius:50%;background:{SKY};color:{NAVY};display:flex;align-items:center;justify-content:center;font-size:{28 * s}px;font-weight:500;flex:none">{i + 1}</div>
<div><div style="font-size:{28 * s}px;font-weight:500;color:{LINEN}">{t}</div><div style="font-size:{21 * s}px;color:{LINEN};opacity:.82;margin-top:{4 * s}px">{d}</div></div></div>""" for i, (t, d) in enumerate(STEPS))


def c8_1x1(c):
    k, area, addr, coord = c
    return ad('s1', LINEN, f"""
{glow(600, -150, 600, SKY, .5)}
{photo('beautiful-patient-stock-photo.png', 610, 70, 400, 400, '45% 40%')}
<div style="position:absolute;left:72px;top:68px">{logo(230)}</div>
<div class="h" style="position:absolute;left:72px;top:170px;width:520px;font-size:68px;line-height:1.05">Your first visit, <em>step by step.</em></div>
<div class="small" style="position:absolute;left:72px;top:345px;width:500px;font-size:22px;color:{SLATE}">At our {area} clinic. New patients welcome.</div>
<div style="position:absolute;left:40px;top:520px;width:1000px;height:330px;background:{HARBOUR};border-radius:32px;padding:44px 40px;box-shadow:0 30px 60px -24px rgba(15,27,41,.4)">{steps_row(920, 1.15)}</div>
<div style="position:absolute;left:72px;top:920px">{btn('Book your first visit', 26, 36, 22)}</div>""")


def c8_9x16(c):
    k, area, addr, coord = c
    return ad('s9', LINEN, f"""
{glow(500, 300, 700, SKY, .5)}
<div style="position:absolute;left:0;right:0;top:270px;display:flex;justify-content:center">{logo(300)}</div>
<div class="h" style="position:absolute;left:80px;right:80px;top:380px;text-align:center;font-size:88px;line-height:1.04">Your first visit, <em>step by step.</em></div>
<div class="small" style="position:absolute;left:0;right:0;top:590px;text-align:center;font-size:26px;color:{SLATE}">At our {area} clinic. New patients welcome.</div>
{photo('beautiful-patient-stock-photo.png', 150, 650, 780, 330, '45% 35%')}
<div style="position:absolute;left:60px;top:1010px;width:960px;height:560px;background:{HARBOUR};border-radius:36px;padding:52px 56px;box-shadow:0 30px 60px -24px rgba(15,27,41,.4)">{steps_col(1.25)}</div>""")


# ---------------------------------------------------------------- C9 Specialists together | Navy + diagram
ICONS = {
    'tooth': '<path d="M12 3c-2-1.6-5.5-1.2-6.6 1.4C4.3 7 5.6 9.6 6.3 12c.6 2.2.6 6.7 2.4 7.6 1.6.8 1.7-3.9 3.3-3.9s1.7 4.7 3.3 3.9c1.8-.9 1.8-5.4 2.4-7.6.7-2.4 2-5-.9-7.6C15.7 1.8 14 1.4 12 3z"/>',
    'aligner': '<path d="M4 9c0 6 3.6 10 8 10s8-4 8-10"/><path d="M7 9.5c0 4.2 2.2 6.8 5 6.8s5-2.6 5-6.8"/><path d="M4 9h3M17 9h3"/>',
    'implant': '<path d="M8 3h8l-1 4H9z"/><path d="M10 7v11l2 3 2-3V7"/><path d="M9 10h6M9 13h6M9 16h6"/>',
}


def node(icon, label, cx, cy, r, fs):
    return f"""<div style="position:absolute;left:{cx - r}px;top:{cy - r}px;width:{2 * r}px;height:{2 * r}px;border-radius:50%;background:{HARBOUR};border:3px solid {SKY};display:flex;align-items:center;justify-content:center;box-shadow:0 20px 40px -16px rgba(0,0,0,.5)">
<svg width="{r}" height="{r}" viewBox="0 0 24 24" fill="none" stroke="{LINEN}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">{ICONS[icon]}</svg></div>
<div style="position:absolute;left:{cx - 160}px;top:{cy + r + 14}px;width:320px;text-align:center;font-size:{fs}px;font-weight:500;color:{LINEN}">{label}</div>"""


def plan_node(cx, cy, r, fs):
    return f"""<div style="position:absolute;left:{cx - r}px;top:{cy - r}px;width:{2 * r}px;height:{2 * r}px;border-radius:50%;background:{LINEN};display:flex;align-items:center;justify-content:center;box-shadow:0 24px 50px -16px rgba(0,0,0,.55)">{mark(round(r * .9), HARBOUR)}</div>
<div style="position:absolute;left:{cx - 160}px;top:{cy + r + 14}px;width:320px;text-align:center;font-family:'IBM Plex Serif',serif;font-style:italic;font-size:{fs + 4}px;color:{SKY}">One plan</div>"""


def links(pts, centre, w, h):
    ls = ''.join(f'<line x1="{x}" y1="{y}" x2="{centre[0]}" y2="{centre[1]}" stroke="{SKY}" stroke-width="3" stroke-dasharray="10 10" opacity=".8"/>' for x, y in pts)
    return f'<svg style="position:absolute;left:0;top:0" width="{w}" height="{h}">{ls}</svg>'


NODES = [('tooth', 'General dentist'), ('aligner', 'Orthodontist'), ('implant', 'Implant specialist')]


def c9_1x1(c):
    k, area, addr, coord = c
    xs, y, r = (210, 540, 870), 480, 66
    return ad('s1', NAVY, f"""
{glow(200, 400, 700, HARBOUR, .8)}
<div style="position:absolute;left:72px;top:68px">{logo(230, LINEN)}</div>
<div class="h" style="position:absolute;left:72px;top:160px;width:940px;font-size:60px;line-height:1.06;color:{LINEN}">Your dentist and specialists <em>plan your care together.</em></div>
{links([(x, y) for x in xs], (540, 740), 1080, 1080)}
{''.join(node(i, l, x, y, r, 21) for (i, l), x in zip(NODES, xs))}
{plan_node(540, 740, 76, 21)}
<div style="position:absolute;left:72px;top:950px">{btn('Book a new patient visit', 24, 32, 22, SKY, NAVY)}</div>
<div class="small" style="position:absolute;left:640px;top:955px;width:380px;font-size:18px;color:{LINEN};opacity:.8">Specialists across our eight clinics. New patients welcome in {area}.</div>""")


def c9_9x16(c):
    k, area, addr, coord = c
    xs, y, r = (220, 540, 860), 820, 90
    return ad('s9', NAVY, f"""
{glow(150, 900, 800, HARBOUR, .85)}
<div style="position:absolute;left:0;right:0;top:270px;display:flex;justify-content:center">{logo(300, LINEN)}</div>
<div class="h" style="position:absolute;left:80px;right:80px;top:390px;text-align:center;font-size:80px;line-height:1.05;color:{LINEN}">Your dentist and specialists <em>plan your care together.</em></div>
{links([(x, y) for x in xs], (540, 1170), 1080, 1920)}
{''.join(node(i, l, x, y, r, 26) for (i, l), x in zip(NODES, xs))}
{plan_node(540, 1170, 105, 26)}
<div class="small" style="position:absolute;left:120px;right:120px;top:1370px;text-align:center;font-size:24px;color:{LINEN};opacity:.85">Specialists across our eight clinics. New patients welcome in {area}.</div>
<div style="position:absolute;left:0;right:0;top:1460px;display:flex;justify-content:center">{btn('Book a new patient visit', 28, 40, 24, SKY, NAVY)}</div>""")


# ---------------------------------------------------------------- C10 Note to self | post-it on Harbour Blue
def postit(w, s=1.0, rot=-3):
    return f"""<div style="position:relative;width:{w}px;height:{w}px;background:{SKY_PALE};transform:rotate({rot}deg);box-shadow:0 40px 50px -30px rgba(15,27,41,.6),0 4px 10px rgba(15,27,41,.15);padding:{70 * s}px {56 * s}px">
<div style="position:absolute;left:50%;top:{-22 * s}px;transform:translateX(-50%) rotate(2deg);width:{170 * s}px;height:{48 * s}px;background:rgba(250,249,246,.65);box-shadow:0 2px 4px rgba(0,0,0,.08)"></div>
<div class="hand" style="font-size:{78 * s}px;color:{NAVY}">Ring the dentist.</div>
<div class="hand" style="font-size:{56 * s}px;color:{HARBOUR};margin-top:{28 * s}px">(It’s been 3 years.)</div>
<svg style="position:absolute;left:{56 * s}px;bottom:{70 * s}px" width="{220 * s}" height="{24 * s}" viewBox="0 0 220 24"><path d="M2 14c40-10 80 6 120-2s70-6 96 0" fill="none" stroke="{NAVY}" stroke-width="3" stroke-linecap="round" opacity=".7"/></svg></div>"""


def c10_1x1(c):
    k, area, addr, coord = c
    return ad('s1', HARBOUR, f"""
{glow(250, 120, 640, SKY, .55)}
<div style="position:absolute;left:72px;top:68px">{logo(230, LINEN)}</div>
<div style="position:absolute;left:300px;top:150px">{postit(480)}</div>
<div class="h" style="position:absolute;left:72px;right:72px;top:720px;text-align:center;font-size:48px;line-height:1.1;color:{LINEN}">Consider this your sign. <em>New patients welcome in {area}.</em></div>
<div style="position:absolute;left:0;right:0;top:900px;display:flex;justify-content:center">{btn('Book your check-up', 26, 36, 22, LINEN, NAVY)}</div>""")


def c10_9x16(c):
    k, area, addr, coord = c
    return ad('s9', HARBOUR, f"""
{glow(160, 400, 800, SKY, .55)}
<div style="position:absolute;left:0;right:0;top:270px;display:flex;justify-content:center">{logo(300, LINEN)}</div>
<div style="position:absolute;left:220px;top:470px">{postit(640, 1.3)}</div>
<div class="h" style="position:absolute;left:90px;right:90px;top:1210px;text-align:center;font-size:64px;line-height:1.1;color:{LINEN}">Consider this your sign. <em>New patients welcome in {area}.</em></div>
<div style="position:absolute;left:0;right:0;top:1460px;display:flex;justify-content:center">{btn('Book your check-up', 28, 40, 24, LINEN, NAVY)}</div>""")


CONCEPTS = [('c1', c1_1x1, c1_9x16), ('c2', c2_1x1, c2_9x16), ('c3', c3_1x1, c3_9x16), ('c4', c4_1x1, c4_9x16),
            ('c5', c5_1x1, c5_9x16), ('c6', c6_1x1, c6_9x16), ('c7', c7_1x1, c7_9x16), ('c8', c8_1x1, c8_9x16),
            ('c9', c9_1x1, c9_9x16), ('c10', c10_1x1, c10_9x16)]


def main():
    head = f'<!doctype html><html lang="en-IE"><head><meta charset="utf-8"><title>Dentistry.ie general statics</title><style>{CSS}</style>'
    cap = '<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>'
    for c in CLINICS:
        r1 = ''.join(f1(c) for _, f1, _ in CONCEPTS)
        r9 = ''.join(f9(c) for _, _, f9 in CONCEPTS)
        body = f'</head><body><div class="row">{r1}</div><div class="row">{r9}</div></body></html>'
        (HERE / f'loc-{c[0]}.html').write_text(head + body)
        (HERE / f'loc-{c[0]}-capture.html').write_text(head + cap + body)
    print('built', len(CLINICS), 'clinic pages,', len(CLINICS) * len(CONCEPTS) * 2, 'artboards')


if __name__ == '__main__':
    main()
