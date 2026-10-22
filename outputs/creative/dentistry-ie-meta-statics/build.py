"""Dentistry.ie general (new patient) Meta statics: 3 concepts x 8 clinics x 1:1 + 9:16.

Concepts (copy and research in copy-*.md, research.md):
  C1 Been a while   - Mark, lapsed patient. Problem aware, sophistication 5.
  C2 One person     - Denise, switching and wary of upselling. Solution aware, sophistication 3 (the coordinator is the mechanism).
  C3 New to the area - Sophie, looking for a local dentist. Product aware, sophistication 2 (proof + what's included).

Clinic facts (addresses, coordinators) come from each clinic's lp.dentistry.ie/<slug>/new-patients-meta page, 22 Oct 2026.
No prices on image (Toby, 22 Oct 2026). Brand system: build_guideline.py.

Usage: python3 build.py  ->  c1-1x1.html, c1-9x16.html, c2-..., c3-... (+ *-capture.html for Figma)
"""
from pathlib import Path

from build_guideline import (CSS as G_CSS, HARBOUR, LINEN, NAVY, SKY, STONE, SLATE, STEEL, WHITE, ARROW, TICK, STAR,
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

GRAIN = ("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260'>"
         "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .55 0'/></filter>"
         "<rect width='100%' height='100%' filter='url(%23n)'/></svg>")

CSS = G_CSS.replace('\nbody{', '\nbody{background:#cfd3d8 !important;flex-direction:row !important;flex-wrap:nowrap !important;gap:80px !important;padding:80px !important;width:max-content !important;') + f"""
.ad{{position:relative;overflow:hidden;flex:none}}
.s1{{width:1080px;height:1080px}} .s9{{width:1080px;height:1920px}}
.grain{{position:absolute;inset:0;background-image:url("{GRAIN}");opacity:.06;pointer-events:none;mix-blend-mode:multiply}}
.glow{{position:absolute;border-radius:50%;filter:blur(90px);pointer-events:none}}
.card{{position:absolute;background:{WHITE};border-radius:28px;box-shadow:0 30px 60px -20px rgba(15,27,41,.35),0 8px 18px -8px rgba(15,27,41,.25)}}
.photo{{position:absolute;overflow:hidden;border-radius:36px;box-shadow:0 34px 70px -24px rgba(15,27,41,.45)}}
.photo img{{width:100%;height:100%;object-fit:cover;display:block}}
"""


def photo(src, x, y, w, h, pos='50% 50%', radius=36):
    return f'<div class="photo" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;border-radius:{radius}px"><img src="assets/photos/{src}" style="object-position:{pos}"></div>'


def heart(src, x, y, h, shadow=True):
    sh = 'filter:drop-shadow(0 30px 40px rgba(15,27,41,.28));' if shadow else ''
    return f'<img src="assets/photos/{src}" style="position:absolute;left:{x}px;top:{y}px;height:{h}px;width:{round(h * .905)}px;display:block;{sh}">'


def pin(size, colour):
    return f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" style="display:block;flex:none"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" stroke="{colour}" stroke-width="1.8"/><circle cx="12" cy="10" r="2.4" fill="{colour}"/></svg>'


def stars(s, c=SKY):
    return '<div style="display:flex;gap:4px">' + ''.join(STAR.format(s=s, c=c) for _ in range(5)) + '</div>'


def ticks(items, size, colour=NAVY, bg=HARBOUR, fg=LINEN, gap=18):
    return ''.join(f'<div style="display:flex;align-items:center;gap:{size * .65}px;margin-top:{gap}px;font-size:{size}px;color:{colour}">{TICK.format(s=round(size * 1.1), bg=bg, fg=fg)}<span>{t}</span></div>' for t in items)


def area_chip(text, size, dark=False):
    bg, fg = (SKY, NAVY) if dark else (NAVY, LINEN)
    return f'<div style="display:inline-flex;align-items:center;gap:{size * .5}px;background:{bg};color:{fg};font-weight:500;font-size:{size}px;padding:{size * .5}px {size * .9}px;border-radius:999px">{pin(round(size * 1.1), fg)}{text}</div>'


def ad(cls, bg, body, name):
    return f'<section class="ad {cls}" data-name="{name}" style="background:{bg}">{body}<div class="grain"></div></section>'


# ---------------------------------------------------------------- C1 Been a while (Mark)
C1_SUB = 'Your first visit is a full check-up and an honest chat about your options. No obligation.'


def c1_1x1(c):
    k, area, addr, coord = c
    return ad('s1', LINEN, f"""
<div class="glow" style="left:560px;top:80px;width:620px;height:620px;background:{SKY};opacity:.28"></div>
<div style="position:absolute;left:72px;top:68px">{logo(230)}</div>
<div style="position:absolute;left:72px;top:190px">{area_chip('New patients welcome in ' + area, 22)}</div>
<div class="h" style="position:absolute;left:72px;top:290px;width:540px;font-size:70px;line-height:1.06">It’s been a few years. <em>We won’t make a thing of it.</em></div>
<div class="body" style="position:absolute;left:72px;top:690px;width:470px;font-size:25px;line-height:1.5;color:{SLATE}">{C1_SUB}</div>
<div style="position:absolute;left:72px;top:920px">{btn('Book your check-up', 26, 36, 22)}</div>
{heart('mask-team.png', 600, 300, 560)}
""", f'Been a While | Static | Team | {area} | 1x1')


def c1_9x16(c):
    k, area, addr, coord = c
    return ad('s9', LINEN, f"""
<div class="glow" style="left:180px;top:780px;width:760px;height:760px;background:{SKY};opacity:.3"></div>
<div style="position:absolute;left:0;right:0;top:270px;display:flex;justify-content:center">{logo(300)}</div>
<div style="position:absolute;left:0;right:0;top:390px;display:flex;justify-content:center">{area_chip('New patients welcome in ' + area, 26)}</div>
<div class="h" style="position:absolute;left:90px;right:90px;top:490px;text-align:center;font-size:84px;line-height:1.05">It’s been a few years. <em>We won’t make a thing of it.</em></div>
{heart('mask-team.png', 288, 790, 560)}
<div class="body" style="position:absolute;left:150px;right:150px;top:1380px;text-align:center;font-size:28px;line-height:1.45;color:{SLATE}">{C1_SUB}</div>
<div style="position:absolute;left:0;right:0;top:1490px;display:flex;justify-content:center">{btn('Book your check-up', 28, 40, 24)}</div>
""", f'Been a While | Static | Team | {area} | 9x16')


# ---------------------------------------------------------------- C2 One person (Denise)
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
    return ad('s1', NAVY, f"""
{photo('fees.png', 0, 0, 1080, 600, '50% 40%', radius=0)}
<div style="position:absolute;left:0;top:0;width:1080px;height:240px;background:linear-gradient(180deg,rgba(15,27,41,.8),rgba(15,27,41,0))"></div>
<div style="position:absolute;left:0;top:380px;width:1080px;height:222px;background:linear-gradient(180deg,rgba(15,27,41,0),{NAVY})"></div>
<div style="position:absolute;left:72px;top:68px">{logo(230, LINEN)}</div>
<div class="h" style="position:absolute;left:72px;top:560px;width:940px;font-size:66px;line-height:1.06;color:{LINEN}">One person looks after you, <em>start to finish.</em></div>
<div class="body" style="position:absolute;left:72px;top:735px;width:880px;font-size:25px;line-height:1.5;color:{LINEN};opacity:.82">{C2_SUB}</div>
<div style="position:absolute;left:72px;top:860px">{badge(coord, area, 470)}</div>
<div style="position:absolute;left:600px;top:905px">{btn('Book a new patient visit', 24, 32, 22, SKY, NAVY)}</div>
""", f'One Person | Static | Reception | {area} | 1x1')


def c2_9x16(c):
    k, area, addr, coord = c
    return ad('s9', NAVY, f"""
{photo('fees.png', 0, 0, 1080, 1120, '45% 50%', radius=0)}
<div style="position:absolute;left:0;top:640px;width:1080px;height:480px;background:linear-gradient(180deg,rgba(15,27,41,0),{NAVY})"></div>
<div style="position:absolute;left:0;top:0;width:1080px;height:520px;background:linear-gradient(180deg,rgba(15,27,41,.85) 22%,rgba(15,27,41,0))"></div>
<div style="position:absolute;left:0;right:0;top:270px;display:flex;justify-content:center">{logo(300, LINEN)}</div>
<div class="h" style="position:absolute;left:90px;right:90px;top:1060px;text-align:center;font-size:84px;line-height:1.05;color:{LINEN}">One person looks after you, <em>start to finish.</em></div>
<div class="body" style="position:absolute;left:140px;right:140px;top:1290px;text-align:center;font-size:29px;line-height:1.45;color:{LINEN};opacity:.82">{C2_SUB}</div>
<div style="position:absolute;left:0;right:0;top:1430px;display:flex;justify-content:center">{badge(coord, area, 520)}</div>
""", f'One Person | Static | Reception | {area} | 9x16')


# ---------------------------------------------------------------- C3 New to the area (Sophie)
VISIT = ['Full dental exam', 'Gum health check', 'Mouth cancer screening', 'A clear plan, explained']


def visit_card(w, s=1.0):
    return f"""<div class="card" style="position:relative;width:{w}px;padding:{34 * s}px {38 * s}px {38 * s}px;transform:rotate(1.6deg)">
<div class="label" style="font-size:{14 * s}px;color:{HARBOUR}">Your first visit</div>
{ticks(VISIT, round(26 * s), gap=round(16 * s))}</div>"""


def proof_line(size, colour=NAVY, star=HARBOUR):
    return f'<div style="display:flex;align-items:center;gap:{size * .6}px;font-size:{size}px;color:{colour}">{stars(round(size * 1.05), star)}<span><b style="font-weight:500">500+ five-star</b> Google reviews</span></div>'


def c3_1x1(c):
    k, area, addr, coord = c
    return ad('s1', LINEN, f"""
{photo('why-us-home.png', 540, 70, 470, 600, '56% 45%')}
<div style="position:absolute;left:72px;top:68px">{logo(230)}</div>
<div class="h" style="position:absolute;left:72px;top:190px;width:480px;font-size:76px;line-height:1.04">Looking for a dentist <em>in {area}?</em></div>
<div style="position:absolute;left:72px;top:520px;display:flex;align-items:center;gap:10px;font-size:22px;color:{SLATE}">{pin(26, HARBOUR)}{addr}</div>
<div style="position:absolute;left:470px;top:560px">{visit_card(520)}</div>
<div style="position:absolute;left:72px;top:640px;width:390px">{proof_line(20)}<div class="small" style="margin-top:10px;font-size:20px;color:{SLATE}">Caring for families since 1980</div></div>
<div style="position:absolute;left:72px;top:920px">{btn('Book an appointment', 26, 36, 22)}</div>
""", f'New To Area | Static | Team | {area} | 1x1')


def c3_9x16(c):
    k, area, addr, coord = c
    return ad('s9', LINEN, f"""
<div style="position:absolute;left:0;right:0;top:270px;display:flex;justify-content:center">{logo(300)}</div>
<div class="h" style="position:absolute;left:90px;right:90px;top:390px;text-align:center;font-size:92px;line-height:1.03">Looking for a dentist <em>in {area}?</em></div>
<div style="position:absolute;left:0;right:0;top:640px;display:flex;justify-content:center;align-items:center;gap:10px;font-size:26px;color:{SLATE}">{pin(30, HARBOUR)}{addr}</div>
{photo('why-us-home.png', 90, 730, 900, 560, '56% 42%')}
<div style="position:absolute;left:250px;top:1190px">{visit_card(580, 1.05)}</div>
<div style="position:absolute;left:0;right:0;top:1520px;display:flex;justify-content:center">{proof_line(24)}</div>
""", f'New To Area | Static | Team | {area} | 9x16')


CONCEPTS = {'c1': (c1_1x1, c1_9x16), 'c2': (c2_1x1, c2_9x16), 'c3': (c3_1x1, c3_9x16)}


def main():
    head = f'<!doctype html><html lang="en-IE"><head><meta charset="utf-8"><title>Dentistry.ie general statics</title><style>{CSS}</style>'
    cap = '<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>'
    for key, (f1, f9) in CONCEPTS.items():
        for size, fn in (('1x1', f1), ('9x16', f9)):
            body = f'</head><body>{"".join(fn(c) for c in CLINICS)}</body></html>'
            (HERE / f'{key}-{size}.html').write_text(head + body)
            (HERE / f'{key}-{size}-capture.html').write_text(head + cap + body)
    print('built', len(CONCEPTS) * 2 * len(CLINICS), 'artboards')


if __name__ == '__main__':
    main()
