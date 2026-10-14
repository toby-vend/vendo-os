"""Squat Success brand guideline: HTML harness for Figma capture.

Built to the book-funnel look Toby chose (14 Oct 2026): the Dental Freedom Blueprint site
(book.squatsuccess.co.uk, theme repo ~/squat-success-shopify, tokens in assets/squat.css).
- Palette: charcoal #1B1B1B canvas, gold #C49C60, amber #E9872C for action, cream #F0D39E, bone paper.
- Type: Lexend (headlines Regular, body Light), Lexend Deca (display), Manrope Bold tracked caps (labels).
- Logo: the theme's SVG lockup (white SQUAT SUCCESS + white/gold SS monogram). No vector master on Drive.
- Devices: amber highlight phrase, BE BOLD ticker, outline numerals, amber CTA button, letter paper,
  stipple illustrations, free seal, signature, ORDER IT / SKIP IT split.
- Photos: theme + site imagery (assets/photos, gitignored).

Usage: python3 build_guideline.py  ->  guideline.html + guideline-capture.html (Figma capture)
"""
import re
from pathlib import Path

HERE = Path(__file__).parent
A = HERE / 'assets'

BLACK, INK, STAGE, WARM = '#1B1B1B', '#131313', '#090807', '#372D2D'
GOLD, GOLD_L, GOLD_D = '#C49C60', '#D7B886', '#A68B60'
AMBER, CREAM, GREY, BONE, MUTED, WHITE = '#E9872C', '#F0D39E', '#BCBCBC', '#FBF9F5', '#6B6359', '#FFFFFF'

_LOGO = (A / 'logo.svg').read_text()
_LOGO = re.sub(r'^<svg[^>]*>', '', _LOGO.strip()).rsplit('</svg>', 1)[0]
_n = [0]


def _svg(inner, vb, w, h, word, mark_white):
    _n[0] += 1
    k = _n[0]
    inner = inner.replace('paint0_linear_0_45', f'p0_{k}').replace('paint1_linear_0_45', f'p1_{k}')
    inner = inner.replace('fill="white"', f'fill="{word}"')
    # the white S of the monogram is the "Union" path; let it take its own colour
    inner = re.sub(r'(<path id="Union" [^>]*fill=")[^"]+"', rf'\g<1>{mark_white}"', inner)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="{w}" height="{h}" fill="none" style="display:block">{inner}</svg>'


def logo(width, word=WHITE, mark=None):
    """Full lockup. word = wordmark colour; mark = colour of the first S (defaults to word)."""
    return _svg(_LOGO, '0 0 138.887 43.9982', width, round(width * 43.9982 / 138.887, 1), word, mark or word)


def monogram(width, colour=WHITE):
    return _svg(_LOGO, '0 0 41 44', width, round(width * 44 / 41, 1), colour, colour)


CSS = f"""
@font-face{{font-family:'Lexend';src:url('assets/fonts/Lexend.ttf');font-weight:100 900}}
@font-face{{font-family:'Lexend Deca';src:url('assets/fonts/LexendDeca.ttf');font-weight:100 900}}
@font-face{{font-family:'Manrope';src:url('assets/fonts/Manrope.ttf');font-weight:200 800}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:#2b2b2b;font-family:'Lexend',sans-serif;font-weight:300;color:{WHITE};display:flex;flex-direction:column;gap:120px;padding:120px;width:2160px;-webkit-font-smoothing:antialiased}}
.page{{position:relative;width:1920px;height:1080px;overflow:hidden;background:{BLACK}}}
.ink{{background:{INK}}} .paper{{background:{BONE};color:{BLACK}}} .warm{{background:{WARM}}}
.abs{{position:absolute}}
.h{{font-family:'Lexend',sans-serif;font-weight:400;letter-spacing:-.02em;line-height:1.16}}
.hl{{color:{AMBER}}} .hg{{color:{GOLD}}}
.deca{{font-family:'Lexend Deca',sans-serif;font-weight:700;letter-spacing:-.01em;line-height:1}}
.label{{font-family:'Manrope',sans-serif;font-weight:700;font-size:13px;letter-spacing:.2em;text-transform:uppercase}}
.body{{font-size:19px;line-height:1.65;font-weight:300}} .body p+p{{margin-top:14px}}
.small{{font-size:15px;line-height:1.6;font-weight:300}}
.dim{{color:rgba(255,255,255,.62)}} .pdim{{color:rgba(27,27,27,.72)}}
.ph{{position:absolute;overflow:hidden}}
.ph img{{width:100%;height:100%;object-fit:cover;display:block}}
.full{{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}}
.btn{{display:inline-flex;align-items:center;gap:12px;background:{AMBER};color:{WHITE};font-family:'Lexend',sans-serif;font-weight:500;border-radius:11px;white-space:nowrap}}
.foot{{position:absolute;left:80px;right:80px;bottom:44px;display:flex;justify-content:space-between}}
.swatch{{position:absolute;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;padding:26px;border-radius:14px}}
.rule{{height:1px;background:rgba(196,156,96,.35)}}
"""

ARROW = '<svg width="{s}" height="{s}" viewBox="0 0 16 16" fill="none" style="display:block"><path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'


def btn(text, size, padx, pady):
    return f'<div class="btn" style="font-size:{size}px;padding:{pady}px {padx}px">{text}{ARROW.format(s=round(size * .9))}</div>'


def glow(x, y, r, a=.55):
    return f'<div class="abs" style="left:{x - r}px;top:{y - r}px;width:{2 * r}px;height:{2 * r}px;border-radius:50%;background:radial-gradient(circle,rgba(233,135,44,{a}) 0%,rgba(196,156,96,{a * .35}) 38%,rgba(27,27,27,0) 70%)"></div>'


def ticker(top, size=13, colour=GOLD, opacity=1, bg=None):
    words = ' '.join(f'<span>{w}</span><span style="opacity:.4">·</span>' for w in ['Be bold', 'Be brave', 'Be different'] * 6)
    return f'<div class="abs label" style="left:0;right:0;top:{top}px;padding:12px 0;font-size:{size}px;letter-spacing:.32em;color:{colour};opacity:{opacity};white-space:nowrap;overflow:hidden;display:flex;gap:36px;justify-content:center;{"background:" + bg if bg else ""}">{words}</div>'


def onum(n, size, colour=GOLD, stroke=1.4):
    return f'<svg width="{size * 1.3}" height="{size}" style="display:block;overflow:visible"><text x="0" y="{size * .86}" font-family="Lexend" font-weight="300" font-size="{size}" fill="none" stroke="{colour}" stroke-width="{stroke}">{n}</text></svg>'


def page(cls, body, n=None, title=None, light=False):
    c = BLACK if light else WHITE
    head = ''
    if title:
        head = f'<div class="abs label" style="left:80px;top:62px;color:{GOLD_D if light else GOLD}">{n:02d}</div><div class="abs label" style="left:130px;top:62px;color:{c};opacity:.7">{title}</div>'
    foot = f'<div class="foot label" style="font-size:11px;color:{c};opacity:.5"><span>squatsuccess.co.uk</span><span>Brand guidelines · 2026</span></div>'
    return f'<section class="page {cls}">{head}{body}{foot}</section>'


def ph(src, x, y, w, h, pos='50% 50%', radius=14):
    return f'<div class="ph" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;border-radius:{radius}px"><img src="assets/photos/{src}" style="object-position:{pos}"></div>'


def book(w, rot=-4):
    h = round(w * 902 / 600)
    return f'''<div style="position:relative;width:{w}px;height:{h}px;transform:rotate({rot}deg)">
<div style="position:absolute;inset:0;border-radius:3px 6px 6px 3px;overflow:hidden;background:#000;box-shadow:0 40px 80px rgba(0,0,0,.6),0 10px 24px rgba(0,0,0,.5)"><img src="assets/photos/cover-art.png" style="width:100%;height:100%;object-fit:cover;display:block"></div>
<div style="position:absolute;left:0;top:0;bottom:0;width:{round(w * .035)}px;background:linear-gradient(90deg,rgba(255,255,255,.18),rgba(0,0,0,.25))"></div></div>'''


def seal(w):
    return f'<img src="assets/free-seal.svg" style="width:{w}px;display:block">'


# ---------- ads in the system (Applications page) ----------

def ad_square(s):
    return f"""<div style="position:relative;width:{1080 * s}px;height:{1080 * s}px;overflow:hidden;background:{BLACK}">
{glow(260 * s, 300 * s, 620 * s, .5)}
<div style="position:absolute;left:{80 * s}px;top:{80 * s}px">{logo(250 * s)}</div>
<div class="h" style="position:absolute;left:{80 * s}px;top:{250 * s}px;width:{560 * s}px;font-size:{68 * s}px">Opening your own practice shouldn’t be a <span class="hl">leap of faith.</span></div>
<div class="small dim" style="position:absolute;left:{80 * s}px;top:{620 * s}px;width:{500 * s}px;font-size:{24 * s}px">The Dental Freedom Blueprint by Dr Bobby Bhandal. Free book, you cover £4.95 postage.</div>
<div style="position:absolute;left:{80 * s}px;top:{860 * s}px">{btn('Send me my free copy', 30 * s, 34 * s, 22 * s)}</div>
<div style="position:absolute;left:{650 * s}px;top:{230 * s}px">{book(360 * s, 5)}</div>
<div style="position:absolute;left:{860 * s}px;top:{700 * s}px">{seal(170 * s)}</div>
</div>"""


def ad_story(s):
    return f"""<div style="position:relative;width:{1080 * s}px;height:{1920 * s}px;overflow:hidden;background:{BLACK}">
{glow(540 * s, 980 * s, 760 * s, .5)}
<div style="position:absolute;left:0;right:0;top:{270 * s}px;display:flex;justify-content:center">{logo(300 * s)}</div>
<div class="h" style="position:absolute;left:{90 * s}px;right:{90 * s}px;top:{470 * s}px;text-align:center;font-size:{78 * s}px">Two dentists. Same year, <span class="hl">same starting salary.</span></div>
<div style="position:absolute;left:{330 * s}px;top:{800 * s}px">{book(420 * s, -3)}</div>
<div style="position:absolute;left:0;right:0;top:{1470 * s}px;display:flex;justify-content:center">{btn('Send me my free copy', 36 * s, 40 * s, 26 * s)}</div>
</div>"""


# ---------- pages ----------

def cover():
    return page('', f"""
{ticker(0, 12, GOLD, .9, INK)}
{glow(420, 560, 900, .55)}
<div class="abs" style="left:160px;top:330px">{logo(620)}</div>
<div class="abs h" style="left:160px;top:640px;font-size:96px">Brand <span class="hg">guidelines</span></div>
<div class="abs label" style="left:164px;top:790px;color:{GREY}">Squat Success · Dr Bobby Bhandal · Leamington Spa</div>
<div class="abs" style="left:1330px;top:190px">{book(420, 4)}</div>
<div class="abs" style="left:1640px;top:760px">{seal(190)}</div>""")


def story():
    return page('', f"""
<div class="abs h" style="left:80px;top:150px;width:860px;font-size:84px">Opening your own practice shouldn’t be a <span class="hl">leap of faith.</span></div>
<div class="abs body dim" style="left:80px;top:470px;width:760px">
<p>Squat Success helps UK dentists open a squat: a brand-new practice built from scratch, rather than bought.</p>
<p>It was founded by Dr Bobby Bhandal, who left corporate dentistry and built Avenue Dental in Leamington Spa from an empty unit. His book, The Dental Freedom Blueprint, sets out the system he used. The programme gives dentists who have already decided a sequenced plan, direct access to Bobby and a cohort of peers, and accountability.</p></div>
<div class="abs" style="left:80px;top:830px;width:760px">
  <div class="label" style="color:{GOLD}">Brand idea</div>
  <div class="h" style="font-size:38px;margin-top:12px">A plan, <span class="hg">not a feeling.</span></div></div>
{ph('portrait-bobby.png', 1000, 150, 520, 780, '50% 20%')}
<div class="abs" style="left:1560px;top:150px;width:280px">
  <div class="label" style="color:{GOLD}">Founder</div>
  <div class="h" style="font-size:30px;margin-top:10px">Dr Bobby Bhandal</div>
  <div class="small dim" style="margin-top:10px">Founder, Squat Success. Principal, Avenue Dental, Leamington Spa.</div>
  <div style="margin-top:40px;background:{BONE};border-radius:10px;padding:18px 14px"><img src="assets/signature.svg" style="width:100%;display:block"></div>
  <div class="label" style="margin-top:40px;color:{GOLD}">Three pillars</div>
  <div class="small" style="margin-top:12px;line-height:2">The Certainty Compass<br>The A-Team Algorithm<br>The Invisible Waiting List</div>
</div>""", 1, 'Who we are')


def logo_page():
    misuse = [
        ('Stretched', f'<div style="transform:scaleX(1.5)">{logo(150)}</div>'),
        ('Recoloured', logo(210, '#4A7BD8', '#4A7BD8')),
        ('Rotated', f'<div style="transform:rotate(-12deg)">{logo(200)}</div>'),
        ('Gold wordmark on gold', f'<div style="position:absolute;inset:0;background:{GOLD};display:flex;align-items:center;justify-content:center">{logo(210, GOLD_L, GOLD_L)}</div>'),
    ]
    mis = ''.join(f"""<div style="width:262px;height:160px;background:{INK};border-radius:12px;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden">{m}
<svg class="abs" style="left:0;top:0" width="262" height="160"><line x1="16" y1="146" x2="246" y2="14" stroke="#D9534F" stroke-width="3"/></svg>
<div class="abs label" style="left:18px;top:14px;font-size:10px;color:#E8746F">{t}</div></div>""" for t, m in misuse)
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:72px">The <span class="hg">logo</span></div>
<div class="abs body dim" style="left:80px;top:250px;width:520px"><p>A gold and white SS monogram beside SQUAT SUCCESS in a high-contrast serif. The second S carries the gold gradient; never flatten or recolour it.</p>
<p>Clear space on every side equals the width of one S. Minimum width is 120px on screen, 30mm in print.</p>
<p>The monogram works alone as an avatar, favicon and stamp. In ads the lockup sits top left or top centre, white, about a quarter of the canvas width.</p></div>
<div class="abs" style="left:700px;top:130px;width:1140px;height:430px;background:{INK};border-radius:14px;display:flex;align-items:center;justify-content:center">
  <div style="position:relative;padding:56px 64px;border:1.5px dashed rgba(196,156,96,.6)">{logo(600)}
  <div class="abs label" style="left:8px;top:8px;font-size:10px;color:{GOLD}">S</div></div></div>
<div class="abs" style="left:700px;top:590px;width:270px;height:150px;background:{BLACK};border:1px solid rgba(255,255,255,.12);border-radius:12px;display:flex;align-items:center;justify-content:center">{logo(200)}</div>
<div class="abs" style="left:990px;top:590px;width:270px;height:150px;background:{BONE};border-radius:12px;display:flex;align-items:center;justify-content:center">{logo(200, BLACK)}</div>
<div class="abs" style="left:1280px;top:590px;width:270px;height:150px;border-radius:12px;overflow:hidden"><img class="full" src="assets/photos/film-aisha.png" style="object-position:50% 40%"><div class="abs" style="inset:0;background:rgba(9,8,7,.55)"></div><div class="abs" style="inset:0;display:flex;align-items:center;justify-content:center">{logo(200)}</div></div>
<div class="abs" style="left:1570px;top:590px;width:270px;height:150px;background:{BLACK};border:1px solid rgba(255,255,255,.12);border-radius:12px;display:flex;align-items:center;justify-content:center">{monogram(70)}</div>
<div class="abs label" style="left:700px;top:752px;font-size:10px;opacity:.7">White on charcoal</div>
<div class="abs label" style="left:990px;top:752px;font-size:10px;opacity:.7">Charcoal on bone</div>
<div class="abs label" style="left:1280px;top:752px;font-size:10px;opacity:.7">On photo, with shade</div>
<div class="abs label" style="left:1570px;top:752px;font-size:10px;opacity:.7">Monogram</div>
<div class="abs label" style="left:700px;top:800px;color:{GOLD}">Misuse</div>
<div class="abs" style="left:700px;top:832px;display:flex;gap:24px">{mis}</div>""", 2, 'Logo')


def colour():
    sw = [
        ('Charcoal', BLACK, 'Main canvas', WHITE, 80, 150, 430, 380, True),
        ('Gold', GOLD, 'Logo, labels, highlights', BLACK, 530, 150, 430, 380, False),
        ('Amber', AMBER, 'Action only: buttons and the key phrase', WHITE, 980, 150, 430, 380, False),
        ('Bone', BONE, 'Paper: letters, chapters, light pages', BLACK, 1430, 150, 410, 380, False),
        ('Ink', INK, 'Alternate sections, bars', WHITE, 80, 560, 250, 250, True),
        ('Stage', STAGE, 'Deepest shadow, video scrims', WHITE, 350, 560, 250, 250, True),
        ('Warm brown', WARM, 'Letter section ground', WHITE, 620, 560, 250, 250, False),
        ('Cream', CREAM, 'Soft highlight, numerals', BLACK, 890, 560, 250, 250, False),
        ('Gold light', GOLD_L, 'Gradient top, hover', BLACK, 1160, 560, 220, 250, False),
        ('Gold deep', GOLD_D, 'Gold text on bone', WHITE, 1400, 560, 220, 250, False),
        ('Grey', GREY, 'Muted labels on dark', BLACK, 1640, 560, 200, 250, False),
    ]
    cards = ''.join(f"""<div class="swatch" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;background:{c};color:{t};{'border:1px solid rgba(255,255,255,.14);' if b else ''}">
<div class="h" style="font-size:{40 if h > 300 else 26}px">{n}</div><div class="label" style="font-size:11px;margin-top:10px">{c}</div><div class="small" style="margin-top:6px;opacity:.8;font-size:14px">{u}</div></div>""" for n, c, u, t, x, y, w, h, b in sw)
    return page('', f"""{cards}
<div class="abs" style="left:80px;top:850px;width:560px;height:60px;border-radius:12px;background:linear-gradient(90deg,{GOLD} 0%,{AMBER} 55%,{GOLD_D} 100%)"></div>
<div class="abs label" style="left:80px;top:922px;font-size:11px;opacity:.7">Gold gradient · #C49C60 → #E9872C → #A68B60</div>
<div class="abs small dim" style="left:700px;top:850px;width:1140px">Dark first: about 80% charcoal and ink, gold for structure, amber for the one thing to do. Amber appears once per layout, on the button or the key phrase, never both at full size. Bone paper is used for the reading moments: the author’s letter and chapter pages.</div>""", 3, 'Colour')


def typography():
    return page('', f"""
<div class="abs" style="left:80px;top:130px;width:1080px">
  <div class="label" style="color:{GOLD}">Headline · Lexend Regular · sentence case · −2% tracking</div>
  <div class="h" style="font-size:118px;margin-top:22px;line-height:1.08">The difference wasn’t talent, <span class="hl">luck</span> or a rich uncle.</div>
  <div class="small dim" style="margin-top:22px;width:860px">Plain-spoken and conversational. One phrase in the headline lands in amber (or gold on quieter layouts). Full stop at the end.</div>
</div>
<div class="abs" style="left:80px;top:690px;width:520px">
  <div class="label" style="color:{GOLD}">Body · Lexend Light 300</div>
  <div class="body dim" style="margin-top:14px">Ten years on, her diary is built by someone else. She earns a decent, predictable salary, and she owns absolutely nothing.</div>
</div>
<div class="abs" style="left:680px;top:690px;width:480px">
  <div class="label" style="color:{GOLD}">Label · Manrope Bold · caps · +20% tracking</div>
  <div class="label" style="margin-top:20px;font-size:18px;color:{GOLD}">Option B · The brave path</div>
  <div class="label" style="margin-top:12px;font-size:18px;color:{GREY}">A letter from the author</div>
  <div class="label" style="color:{GOLD};margin-top:40px">Button · Lexend Medium</div>
  <div style="margin-top:14px">{btn('Send me my free copy', 22, 26, 16)}</div>
</div>
<div class="abs" style="left:1240px;top:130px;width:600px;height:800px;background:{INK};border-radius:14px;padding:56px">
  <div class="label" style="color:{GOLD}">Display · Lexend Deca Bold · caps</div>
  <div class="deca" style="font-size:84px;white-space:nowrap;margin-top:30px;background:linear-gradient(90deg,{GOLD},{AMBER});-webkit-background-clip:text;background-clip:text;color:transparent">ORDER IT</div>
  <svg width="480" height="84" style="display:block;margin-top:6px;overflow:visible"><text x="0" y="72" font-family="Lexend Deca" font-weight="700" font-size="84" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.5">SKIP IT</text></svg>
  <div class="small dim" style="margin-top:30px">For short, punchy contrasts only. Two words, never a sentence.</div>
  <div class="label" style="color:{GOLD};margin-top:60px">Numerals · Lexend Light, outline</div>
  <div style="display:flex;gap:26px;margin-top:20px">{onum('01', 96, 'rgba(196,156,96,.55)')}{onum('02', 96, 'rgba(196,156,96,.55)')}{onum('06', 96, CREAM)}</div>
</div>""", 4, 'Typography')


def elements():
    return page('', f"""
<div class="abs" style="left:80px;top:130px;width:880px;height:330px;background:{INK};border-radius:14px;padding:44px;overflow:hidden">
  <div class="label" style="color:{GOLD}">The highlight phrase</div>
  <div class="h" style="font-size:46px;margin-top:22px;white-space:nowrap">Same career. <span class="hl">Wildly different life.</span></div>
  <div class="small dim" style="margin-top:22px;width:720px">The payoff of a line goes amber. It carries the emotional turn, never a price or a disclaimer.</div>
</div>
<div class="abs" style="left:1000px;top:130px;width:840px;height:330px;background:{INK};border-radius:14px;padding:44px">
  <div class="label" style="color:{GOLD}">Call to action</div>
  <div style="display:flex;gap:24px;margin-top:30px;align-items:center">{btn('Send me my free copy', 24, 30, 18)}<div class="label" style="color:{GOLD};font-size:13px;display:flex;gap:10px;align-items:center">Get the plan, free {ARROW.format(s=14)}</div></div>
  <div class="small dim" style="margin-top:30px;width:720px">Amber, 11px radius, arrow on the right. The button says what happens next. Text links are gold tracked caps.</div>
</div>
<div class="abs" style="left:80px;top:490px;width:1760px;height:64px;background:{INK};border-radius:14px;overflow:hidden">{ticker(8, 13, GOLD, .9)}</div>
<div class="abs label" style="left:80px;top:566px;font-size:10px;opacity:.6">Ticker · Be bold · Be brave · Be different · the brand’s rallying line, used as a top bar or divider</div>
<div class="abs" style="left:80px;top:610px;width:420px;height:330px;background:{BONE};border-radius:14px;overflow:hidden;display:flex;gap:20px;padding:24px;justify-content:center">
  <img src="assets/photos/graphic-sarah.png" style="height:100%;display:block"><img src="assets/photos/graphic-raj.png" style="height:100%;display:block"></div>
<div class="abs label" style="left:80px;top:952px;font-size:10px;opacity:.6">Stipple illustration · parables only</div>
<div class="abs" style="left:530px;top:610px;width:560px;height:330px;background:{WARM};border-radius:14px;overflow:hidden">
  <div class="abs" style="left:50px;top:36px;width:460px;height:320px;background:{BONE};transform:rotate(-2deg);box-shadow:0 20px 40px rgba(0,0,0,.4);padding:30px;color:{BLACK}">
    <div class="label" style="font-size:9px;color:{GOLD_D}">Squat Success · Leamington Spa</div>
    <div class="h" style="font-size:24px;margin-top:14px;line-height:1.2;width:330px">Why would you post me a book for free?</div>
    <div style="margin-top:16px;display:inline;background:rgba(196,156,96,.28);font-size:16px;line-height:1.7">I’d rather this book was in a thousand hands than sold to two hundred.</div>
    <img src="assets/photos/stamp.png" style="position:absolute;right:22px;top:20px;width:42px">
  </div></div>
<div class="abs label" style="left:530px;top:952px;font-size:10px;opacity:.6">Letter paper · tilt, highlight, stamp</div>
<div class="abs" style="left:1120px;top:610px;width:330px;height:330px;background:{INK};border-radius:14px;display:flex;align-items:center;justify-content:center;overflow:hidden">{glow(165, 165, 200, .35)}<div style="position:relative">{seal(210)}</div></div>
<div class="abs label" style="left:1120px;top:952px;font-size:10px;opacity:.6">Free seal · book offer only</div>
<div class="abs" style="left:1480px;top:610px;width:360px;height:330px;background:{BLACK};border:1px solid rgba(255,255,255,.12);border-radius:14px;overflow:hidden">{glow(120, 120, 300, .6)}</div>
<div class="abs label" style="left:1480px;top:952px;font-size:10px;opacity:.6">Amber glow · warm light from one corner</div>""", 5, 'Graphic elements')


def photography():
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:72px;width:520px">Real dentists, <span class="hg">real rooms.</span></div>
<div class="abs body dim" style="left:80px;top:330px;width:500px">
<p>Low-key and warm: dark grounds, tungsten light, shallow depth of field. Three families of shot: Bobby on stage and in the practice; members telling their story on camera; and the book itself, held, posted and read.</p>
<p>Use Squat Success’s own photography and event footage. Members appear only with their consent and are named the way they are on the site.</p></div>
{ph('portrait-bobby.png', 640, 130, 380, 520, '50% 22%')}
{ph('film-matt.png', 1050, 130, 790, 250, '50% 35%')}
{ph('film-aisha.png', 1050, 400, 385, 250, '50% 35%')}
{ph('film-laurie.png', 1455, 400, 385, 250, '50% 35%')}
<div class="abs" style="left:640px;top:680px;width:1200px;height:260px;border-radius:14px;overflow:hidden;background:{STAGE};display:flex;align-items:center;justify-content:center">{glow(600, 260, 420, .45)}<div style="position:relative;margin-top:60px">{book(150, -6)}</div></div>
<div class="abs" style="left:80px;top:720px;width:500px">
  <div class="label" style="color:{GOLD}">Avoid</div>
  <div class="small dim" style="margin-top:10px">Bright clinical stock, generic handshakes and skylines, smiling-patient imagery (the audience is dentists, not patients), and anything that suggests a get-rich-quick lifestyle.</div>
</div>""", 6, 'Photography')


def voice():
    pairs = [('Honest', 'Building a practice is a five-year commitment.', 'Own a six-figure practice in 90 days!'),
             ('Direct', 'Fear isn’t the issue. Letting fear make your decisions is.', 'Unlock your full potential today.'),
             ('Warm', 'You cover the postage because Royal Mail don’t work for free.', 'Limited copies. Claim yours before they’re gone.'),
             ('Proven', 'From an empty unit to a thriving practice in Leamington Spa.', 'The UK’s number one dental business coach.')]
    rows = ''.join(f"""<div style="display:flex;gap:30px;padding:22px 0;border-top:1px solid rgba(196,156,96,.3)">
<div class="h" style="width:240px;font-size:40px;color:{GOLD}">{t}</div>
<div style="width:600px"><div class="label" style="font-size:10px;color:{GOLD}">We say</div><div class="body" style="margin-top:6px">{y}</div></div>
<div style="width:560px;opacity:.45"><div class="label" style="font-size:10px">We don’t say</div><div class="body" style="margin-top:6px;text-decoration:line-through">{n}</div></div></div>""" for t, y, n in pairs)
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:80px">How <span class="hg">we sound</span></div>
<div class="abs body dim" style="left:80px;top:250px;width:1400px">Like Bobby across the table over a cup of tea: conversational, British, a little self-deprecating, and straight about how hard it is. We talk to dentists as peers. UK English, no em dashes, no hype, no false scarcity. The book is printed to order, so we never say copies are running out.</div>
<div class="abs" style="left:80px;top:400px;width:1450px">{rows}</div>""", 7, 'Tone of voice')


def the_book():
    return page('ink', f"""
{glow(1300, 520, 760, .5)}
<div class="abs" style="left:1130px;top:150px">{book(440, 4)}</div>
<div class="abs" style="left:1500px;top:720px">{seal(210)}</div>
<div class="abs label" style="left:80px;top:150px;color:{GOLD}">Lead offer</div>
<div class="abs h" style="left:80px;top:190px;width:860px;font-size:80px">The Dental Freedom <span class="hg">Blueprint</span></div>
<div class="abs body dim" style="left:80px;top:410px;width:820px"><p>Dr Bobby Bhandal’s book, and the front door to Squat Success. The paperback is free; the reader covers £4.95 UK postage. Printed to order, posted in 5 to 7 working days, no subscription.</p>
<p>The cover keeps its own condensed gold-on-black typography. Treat it as a product shot, never retype it.</p></div>
<div class="abs" style="left:80px;top:690px;display:flex;gap:30px">
  <div style="width:250px"><div class="label" style="color:{GOLD}">Site</div><div class="small" style="margin-top:8px">book.squatsuccess.co.uk</div></div>
  <div style="width:250px"><div class="label" style="color:{GOLD}">Button</div><div class="small" style="margin-top:8px">Send me my free copy</div></div>
  <div style="width:250px"><div class="label" style="color:{GOLD}">Seal</div><div class="small" style="margin-top:8px">Free paperback, you cover £4.95 P&amp;P</div></div></div>
<div class="abs" style="left:80px;top:820px">{btn('Send me my free copy', 26, 32, 20)}</div>""", 8, 'The book')


def applications():
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:80px;width:560px">In <span class="hg">use</span></div>
<div class="abs body dim" style="left:80px;top:250px;width:520px"><p>Meta statics: charcoal canvas lit by the amber glow, the logo in white, a Lexend headline with its amber phrase, the book as the hero object, and the amber button.</p>
<p>Stories keep the logo and copy out of the top 250px and bottom 340px.</p>
<p>Headlines shown are live lines from book.squatsuccess.co.uk.</p></div>
<div class="abs" style="left:680px;top:150px">{ad_square(0.68)}</div>
<div class="abs label" style="left:680px;top:900px;font-size:11px;opacity:.6">Feed 1:1</div>
<div class="abs" style="left:1440px;top:110px">{ad_story(0.43)}</div>
<div class="abs label" style="left:1440px;top:950px;font-size:11px;opacity:.6">Story 9:16</div>""", 9, 'Applications')


def close():
    return page('', f"""
{ticker(0, 12, GOLD, .9, INK)}
{glow(960, 560, 820, .5)}
<div class="abs" style="left:0;right:0;top:360px;display:flex;flex-direction:column;align-items:center;text-align:center">
<div class="h" style="font-size:110px">Be bold. Be brave. <span class="hl">Be different.</span></div>
<div style="margin-top:70px">{logo(360)}</div></div>""")


def main():
    pages = [cover(), story(), logo_page(), colour(), typography(), elements(), photography(), voice(), the_book(), applications(), close()]
    head = f'<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>Squat Success Brand Guidelines</title><style>{CSS}</style>'
    body = f'</head><body>{"".join(pages)}</body></html>'
    (HERE / 'guideline.html').write_text(head + body)
    (HERE / 'guideline-capture.html').write_text(head + '<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>' + body)
    print('pages', len(pages))


if __name__ == '__main__':
    main()
