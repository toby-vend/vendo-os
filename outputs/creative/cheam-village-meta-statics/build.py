"""Cheam Village Dental Studios: Meta statics harness for the £500 off aligner offer (2 Nov to 23 Dec 2026).

One HTML page per persona per size (1x1, 9x16, landscape 1200x628), three concepts side by side, for headless
render QA and Figma capture. Copy lives in copy-<persona>.md; facts and sources in research.md.

Vector-safe by construction: logos are inlined SVG (an <img> SVG is rasterised by the capture) and the Tuesday Night
script is inlined as outlined paths (script_outline.py), because Figma cannot see the font. Photos are pre-cut
crops; house-framed photos are alpha PNGs (build_guideline.house_png).

Usage (fontTools needed for the script outlines):
    <venv>/bin/python build.py [amy|dan|ade ...]
"""
import re
import sys
from pathlib import Path

from build_guideline import (BASE, CHAR, CREAM, GOLD, GRAIN, INK, MIST, NAVY, SAGE, SILVER, SLATE, STONE, WHITE,
                             crop, house_png)
from script_outline import outline

HERE = Path(__file__).parent
DATE = '261027'
SIZES = {'1x1': (1080, 1080), '9x16': (1080, 1920), 'landscape': (1200, 628)}
CTA = 'Book a consultation'
PROOF = '5.0 from 461 Google reviews'


# ---------- vector pieces ----------

def logo(kind, w, colour=INK):
    """Brand-sheet logo, inlined so the capture keeps it as vectors. kind: horizontal | stacked | roundel | tooth."""
    s = (HERE / f'assets/logos/{kind}-ink.svg').read_text()
    s = re.sub(r'<\?xml[^>]*>', '', s).replace('#231F20', 'currentColor')
    s = re.sub(r'<svg ', f'<svg style="display:block;width:{w}px;height:auto;color:{colour}" ', s, count=1)
    return re.sub(r' width="[\d.]+" height="[\d.]+"', '', s, count=1)


def script(text, size, colour, x, y):
    """Tuesday Night line as outlined paths, placed so the text box (line-height 1) starts at x, y."""
    rgb = [int(colour[i:i + 2], 16) for i in (1, 3, 5)]
    svg, pad = outline(text, size, rgb)
    return f'<div class="abs" style="left:{x - pad:.1f}px;top:{y - pad:.1f}px">{svg}</div>'


STAR = '<svg width="{s}" height="{s}" viewBox="0 0 24 24" style="display:block"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill="{c}"/></svg>'
TICK = '<svg width="{s}" height="{s}" viewBox="0 0 24 24" style="display:block;flex:none"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="{c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
SEARCH = '<svg width="{s}" height="{s}" viewBox="0 0 24 24" style="display:block;flex:none"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="{c}" stroke-width="2.2"/><path d="M15.5 15.5L21 21" stroke="{c}" stroke-width="2.2" stroke-linecap="round"/></svg>'
MIC = '<svg width="{s}" height="{s}" viewBox="0 0 24 24" style="display:block;flex:none"><rect x="9" y="3" width="6" height="11" rx="3" fill="{c}"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4" fill="none" stroke="{c}" stroke-width="2" stroke-linecap="round"/></svg>'


def proof(size, colour=INK, star=GOLD):
    stars = ''.join(STAR.format(s=round(size * 1.15), c=star) for _ in range(5))
    return (f'<div style="display:flex;align-items:center;gap:{size * .6:.0f}px;color:{colour};font-size:{size}px;'
            f'font-weight:500;letter-spacing:.04em;white-space:nowrap"><div style="display:flex;gap:3px">{stars}</div>{PROOF}</div>')


def btn(size, bg=NAVY, fg=WHITE, text=CTA):
    return (f'<div class="btn" style="font-size:{size}px;padding:{size * 1.15:.0f}px {size * 2:.0f}px;background:{bg};color:{fg}">'
            f'{text}</div>')


def slash(h, colour=MIST):
    w = h * .9
    sw = h * .1
    return (f'<svg width="{w * 1.5:.0f}" height="{h:.0f}" viewBox="0 0 {w * 1.5:.1f} {h:.1f}" style="display:block;flex:none">'
            f'<line x1="0" y1="{h:.1f}" x2="{w:.1f}" y2="0" stroke="{colour}" stroke-width="{sw:.1f}"/>'
            f'<line x1="{w * .5:.1f}" y1="{h:.1f}" x2="{w * 1.5:.1f}" y2="0" stroke="{colour}" stroke-width="{sw:.1f}"/></svg>')


def house(src, x, y, w, h, fx=.5, fy=.5, roof=.3):
    return (f'<div class="ph" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px">'
            f'<img src="{house_png(src, w, h, fx, fy, roof)}"></div>')


def photo(src, x, y, w, h, fx=.5, fy=.5, extra=''):
    return (f'<div class="ph" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;{extra}">'
            f'<img src="{crop(src, w, h, fx, fy)}"></div>')


def date_line(size, colour=NAVY, slash_colour=MIST):
    return (f'<div style="display:flex;align-items:center;gap:{size * .8:.0f}px">{slash(size * 1.3, slash_colour)}'
            f'<div class="label" style="font-size:{size}px;color:{colour}">Start treatment by 23 December</div></div>')


# ---------- page ----------

CSS = f"""
@font-face{{font-family:'Montserrat';src:url('assets/fonts/Montserrat.ttf');font-weight:100 900}}
@font-face{{font-family:'Caveat';src:url('assets/fonts/Caveat.ttf');font-weight:400 700}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:#3b4145;font-family:'Montserrat',sans-serif;color:{INK};display:flex;gap:80px;padding:80px;align-items:flex-start;-webkit-font-smoothing:antialiased}}
.ab{{position:relative;overflow:hidden;flex:none}}
.abs{{position:absolute}}
.ph{{position:absolute;overflow:hidden}}
.ph img{{width:100%;height:100%;object-fit:cover;display:block}}
.h{{font-weight:300;letter-spacing:.2em;text-transform:uppercase;line-height:1.3}}
.h b{{font-weight:700}}
.label{{font-weight:600;letter-spacing:.3em;text-transform:uppercase}}
.body{{font-weight:400;line-height:1.5}}
.btn{{display:inline-flex;align-items:center;font-weight:600;letter-spacing:.24em;text-transform:uppercase;white-space:nowrap}}
.grain{{position:absolute;inset:0;background-image:url("{GRAIN}");opacity:.12;mix-blend-mode:overlay;pointer-events:none}}
.paper{{background:#FBFAF6;box-shadow:0 28px 50px rgba(13,13,13,.35),0 4px 10px rgba(13,13,13,.18)}}
"""


def board(name, size, bg, inner):
    w, h = SIZES[size]
    return f'<div class="ab" data-name="{name}" style="width:{w}px;height:{h}px;background:{bg}">{inner}<div class="grain"></div></div>'


def page(title, boards):
    return (f"<!doctype html><html lang='en-GB'><head><meta charset='utf-8'><title>{title}</title><style>{CSS}</style>"
            f"<script src='https://mcp.figma.com/mcp/html-to-design/capture.js' async></script></head>"
            f"<body>{''.join(boards)}</body></html>")


def ad_name(concept, talent, detail, size):
    return f"{concept} | Static | {talent} | {detail} | {dict(landscape='1.91x1').get(size, size)} | {DATE}"


# ================================================================ AMY

INCL = 'Your fee includes every appointment, your retainers and a one-year check-up.'


def amy_a1(size):
    """VT-20 Editorial price split: £500 off beside a house-framed portrait."""
    name = ad_name('Amy £500 off all in', 'Stock', 'Editorial price split', size)
    light = f'<div class="abs" style="inset:0;background:radial-gradient(circle at 20% 30%,rgba(255,255,255,.9),rgba(244,244,244,0) 60%)"></div>'
    if size == '1x1':
        inner = f"""{light}
{house('stock-amy-hat.jpg', 590, 150, 430, 930, .45, .35)}
<div class="abs" style="left:72px;top:72px">{logo('stacked', 270)}</div>
<div class="abs label" style="left:72px;top:250px;font-size:17px;color:{STONE}">Invisalign or Angel Aligner · Cheam</div>
<div class="abs" style="left:66px;top:300px;display:flex;align-items:baseline;gap:16px;color:{NAVY}"><div style="font-size:165px;font-weight:300;letter-spacing:-.02em;line-height:1">£500</div><div class="label" style="font-size:38px;font-weight:700;letter-spacing:.2em">Off</div></div>
<div class="abs body" style="left:72px;top:610px;width:440px;font-size:25px;color:{CHAR}">{INCL}</div>
<div class="abs" style="left:72px;top:760px">{date_line(16)}</div>
<div class="abs" style="left:72px;top:830px">{proof(17)}</div>
<div class="abs" style="left:72px;top:900px">{btn(19)}</div>"""
    elif size == '9x16':
        inner = f"""{light}
<div class="abs" style="left:0;right:0;top:120px;display:flex;justify-content:center">{logo('horizontal', 640)}</div>
{house('stock-amy-hat.jpg', 190, 230, 700, 820, .45, .32)}
<div class="abs label" style="left:0;right:0;top:1100px;text-align:center;font-size:20px;color:{STONE}">Invisalign or Angel Aligner · Cheam</div>
<div class="abs" style="left:0;right:0;top:1130px;display:flex;justify-content:center;align-items:baseline;gap:20px;color:{NAVY}"><div style="font-size:210px;font-weight:300;letter-spacing:-.02em;line-height:1">£500</div><div class="label" style="font-size:48px;font-weight:700;letter-spacing:.2em">Off</div></div>
<div class="abs body" style="left:150px;top:1360px;width:780px;text-align:center;font-size:27px;color:{CHAR}">{INCL}</div>
<div class="abs" style="left:0;right:0;top:1460px;display:flex;justify-content:center">{date_line(17)}</div>
<div class="abs" style="left:0;right:0;top:1510px;display:flex;justify-content:center;gap:34px;align-items:center">{btn(19)}{proof(16)}</div>"""
    else:
        inner = f"""{light}
{house('stock-amy-hat.jpg', 800, 40, 360, 588, .45, .3)}
<div class="abs" style="left:56px;top:48px">{logo('stacked', 200)}</div>
<div class="abs label" style="left:56px;top:150px;font-size:13px;color:{STONE}">Invisalign or Angel Aligner · Cheam</div>
<div class="abs" style="left:50px;top:176px;display:flex;align-items:baseline;gap:14px;color:{NAVY}"><div style="font-size:140px;font-weight:300;letter-spacing:-.02em;line-height:1">£500</div><div class="label" style="font-size:32px;font-weight:700;letter-spacing:.2em">Off</div></div>
<div class="abs body" style="left:56px;top:338px;width:560px;font-size:19px;color:{CHAR}">{INCL}</div>
<div class="abs" style="left:56px;top:418px">{date_line(12)}</div>
<div class="abs" style="left:56px;top:466px">{proof(13)}</div>
<div class="abs" style="left:56px;top:516px">{btn(14)}</div>"""
    return board(name, size, BASE, inner)


RECEIPT_LINES = ['Specialist treatment plan', '3D scan and preview', 'Every aligner and appointment',
                 'Retainers at the end', 'One-year check-up']


def receipt(w, s=1.0):
    """Printed receipt: what the aligner fee covers, then the £500 line. Scales with s."""
    S = lambda v: f'{v * s:.1f}px'
    rows = ''.join(f'<div style="display:flex;align-items:center;gap:{S(14)};padding:{S(13)} 0;border-bottom:{S(1.5)} dashed #C9C9C2">'
                   f'{TICK.format(s=round(24 * s), c=NAVY)}<div style="font-size:{S(23)};color:{CHAR}">{t}</div></div>' for t in RECEIPT_LINES)
    teeth = ''.join(f'<polygon points="{i * 24},0 {i * 24 + 12},14 {i * 24 + 24},0" fill="#FBFAF6"/>' for i in range(int(w / 24 / s) + 2))
    return f"""<div style="position:relative;width:{w}px">
<div class="paper" style="padding:{S(44)} {S(40)} {S(36)};">
  <div style="display:flex;justify-content:center">{logo('tooth', round(40 * s), NAVY)}</div>
  <div class="label" style="text-align:center;font-size:{S(14)};margin-top:{S(14)};color:{INK}">Cheam Village Dental Studios</div>
  <div class="label" style="text-align:center;font-size:{S(12)};margin-top:{S(6)};color:{STONE};letter-spacing:.24em">Clear aligner treatment</div>
  <div style="margin-top:{S(26)};border-top:{S(2)} solid {INK}">{rows}</div>
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:{S(22)}">
    <div class="label" style="font-size:{S(17)};color:{NAVY}">Aligner offer</div>
    <div style="font-size:{S(46)};font-weight:700;color:{NAVY};letter-spacing:-.01em">−£500</div></div>
  <div style="font-size:{S(15)};color:{STONE};margin-top:{S(8)}">Invisalign or Angel Aligner · adults and children</div>
</div>
<svg width="{w}" height="{14 * s:.0f}" viewBox="0 0 {w / s:.0f} 14" preserveAspectRatio="none" style="display:block">{teeth}</svg>
<div class="abs label" style="right:{S(-18)};top:{S(-20)};background:#FBFAF6;transform:rotate(8deg);border:{S(3)} solid {NAVY};color:{NAVY};font-size:{S(16)};padding:{S(10)} {S(16)};opacity:.85">Start by 23 Dec</div>
</div>"""


def amy_a2(size):
    """Custom: itemised receipt over the reception desk."""
    name = ad_name('Amy What your fee covers', 'Practice', 'Itemised receipt', size)
    wash = lambda d, a, b: f'<div class="abs" style="inset:0;background:linear-gradient({d},rgba(30,68,91,{a}) 0%,rgba(30,68,91,{b}) 100%)"></div>'
    if size == '1x1':
        inner = f"""{photo('bl-08.jpg', 0, 0, 1080, 1080, .35, .5)}{wash('90deg', .93, .25)}
<div class="abs" style="left:72px;top:72px">{logo('stacked', 250, WHITE)}</div>
<div class="abs h" style="left:72px;top:250px;width:440px;font-size:44px;color:{WHITE}">What your <b>aligner fee</b> covers</div>
<div class="abs body" style="left:72px;top:520px;width:400px;font-size:24px;color:#D7E1E3">Everything in. Then £500 off when you start by 23 December.</div>
<div class="abs" style="left:72px;top:830px">{proof(16, WHITE)}</div>
<div class="abs" style="left:72px;top:900px">{btn(19, WHITE, NAVY)}</div>
<div class="abs" style="left:560px;top:110px">{receipt(450)}</div>"""
    elif size == '9x16':
        inner = f"""{photo('bl-08.jpg', 0, 0, 1080, 1920, .35, .5)}{wash('180deg', .9, .55)}
<div class="abs" style="left:0;right:0;top:110px;display:flex;justify-content:center">{logo('horizontal', 640, WHITE)}</div>
<div class="abs h" style="left:90px;right:90px;top:260px;text-align:center;font-size:52px;color:{WHITE}">What your <b>aligner fee</b> covers</div>
<div class="abs" style="left:215px;top:470px">{receipt(650, 1.3)}</div>
<div class="abs" style="left:0;right:0;top:1470px;display:flex;justify-content:center">{btn(22, WHITE, NAVY)}</div>
<div class="abs" style="left:0;right:0;top:1560px;display:flex;justify-content:center">{proof(18, WHITE)}</div>"""
    else:
        inner = f"""{photo('bl-08.jpg', 0, 0, 1200, 628, .35, .5)}{wash('90deg', .94, .3)}
<div class="abs" style="left:56px;top:48px">{logo('stacked', 190, WHITE)}</div>
<div class="abs h" style="left:56px;top:170px;width:470px;font-size:36px;color:{WHITE}">What your <b>aligner fee</b> covers</div>
<div class="abs body" style="left:56px;top:330px;width:440px;font-size:19px;color:#D7E1E3">Everything in. Then £500 off when you start by 23 December.</div>
<div class="abs" style="left:56px;top:440px">{proof(13, WHITE)}</div>
<div class="abs" style="left:56px;top:500px">{btn(14, WHITE, NAVY)}</div>
<div class="abs" style="left:720px;top:46px">{receipt(400, .74)}</div>"""
    return board(name, size, NAVY, inner)


def result_card(w, s=1.0):
    """Search-result card for the practice, with the live Google rating."""
    S = lambda v: f'{v * s:.1f}px'
    stars = ''.join(STAR.format(s=round(20 * s), c='#E7A93C') for _ in range(5))
    return f"""<div class="paper" style="width:{w}px;border-radius:{S(22)};padding:{S(28)} {S(30)}">
<div style="display:flex;gap:{S(20)};align-items:center">
  <div style="width:{S(66)};height:{S(66)};border-radius:50%;background:{NAVY};display:flex;align-items:center;justify-content:center;flex:none">{logo('tooth', round(30 * s), WHITE)}</div>
  <div><div style="font-size:{S(27)};font-weight:600;color:{INK}">Cheam Village Dental Studios</div>
  <div style="display:flex;align-items:center;gap:{S(8)};margin-top:{S(6)};font-size:{S(20)};color:{CHAR}">5.0 <div style="display:flex;gap:2px">{stars}</div> (461)</div></div></div>
<div style="font-size:{S(19)};color:{STONE};margin-top:{S(14)}">Dentist · 21 Upper Mulgrave Road, Cheam</div>
<div style="margin-top:{S(18)};background:{CREAM};border-left:{S(5)} solid {NAVY};padding:{S(14)} {S(18)};font-size:{S(20)};font-weight:600;color:{NAVY}">£500 off Invisalign and Angel Aligner until 23 Dec</div>
</div>"""


def search_bar(w, s=1.0):
    S = lambda v: f'{v * s:.1f}px'
    return (f'<div class="paper" style="width:{w}px;height:{S(78)};border-radius:{S(40)};display:flex;align-items:center;gap:{S(18)};padding:0 {S(30)}">'
            f'{SEARCH.format(s=round(28 * s), c=STONE)}<div style="flex:1;font-size:{S(26)};color:{INK}">invisalign cheam</div>'
            f'{MIC.format(s=round(26 * s), c=NAVY)}</div>')


def amy_a3(size):
    """VT-29 Search bar: the query she's already typing, and the practice's result."""
    name = ad_name('Amy Searching Invisalign Cheam', 'Stock', 'Search result', size)
    scrim = lambda d, a: f'<div class="abs" style="inset:0;background:linear-gradient({d},rgba(30,68,91,0) 30%,rgba(30,68,91,{a}) 100%)"></div>'
    if size == '1x1':
        inner = f"""{photo('stock-amy-phone.jpg', 0, 0, 1080, 640, .55, .56)}
<div class="abs" style="left:0;top:380px;width:1080px;height:262px;background:linear-gradient(180deg,rgba(30,68,91,0),{NAVY})"></div>
<div class="abs" style="inset:0;background:linear-gradient(180deg,rgba(30,68,91,.8) 0%,rgba(30,68,91,0) 26%)"></div>
<div class="abs" style="left:64px;top:56px">{logo('stacked', 230, WHITE)}</div>
<div class="abs" style="left:110px;top:590px">{search_bar(860, .92)}</div>
<div class="abs" style="left:110px;top:680px">{result_card(860, .92)}</div>
<div class="abs" style="left:110px;top:960px">{btn(18, WHITE, NAVY)}</div>"""
    elif size == '9x16':
        inner = f"""{photo('stock-amy-phone.jpg', 0, 0, 1080, 1100, .55, .35)}
<div class="abs" style="left:0;top:760px;width:1080px;height:342px;background:linear-gradient(180deg,rgba(30,68,91,0),{NAVY})"></div>
<div class="abs" style="inset:0;background:linear-gradient(180deg,rgba(30,68,91,.7) 0%,rgba(30,68,91,0) 16%)"></div>
<div class="abs" style="left:0;right:0;top:120px;display:flex;justify-content:center">{logo('horizontal', 640, WHITE)}</div>
<div class="abs" style="left:90px;top:1070px">{search_bar(900, 1.05)}</div>
<div class="abs" style="left:90px;top:1170px">{result_card(900, 1.05)}</div>
<div class="abs" style="left:0;right:0;top:1500px;display:flex;justify-content:center">{btn(21, WHITE, NAVY)}</div>"""
    else:
        inner = f"""{photo('stock-amy-phone.jpg', 600, 0, 600, 628, .5, .55)}
<div class="abs" style="left:0;top:0;width:640px;height:628px;background:{NAVY}"></div>
<div class="abs" style="left:600px;top:0;width:120px;height:628px;background:linear-gradient(90deg,{NAVY},rgba(30,68,91,0))"></div>
<div class="abs" style="left:56px;top:44px">{logo('stacked', 180, WHITE)}</div>
<div class="abs" style="left:56px;top:140px">{search_bar(600, .8)}</div>
<div class="abs" style="left:56px;top:226px">{result_card(600, .8)}</div>
<div class="abs" style="left:56px;top:520px">{btn(14, WHITE, NAVY)}</div>"""
    return board(name, size, NAVY, inner)


# ================================================================ DAN

OFFER_BAND = '£500 off aligners · start by 23 Dec'


def note(w, s=1.0):
    """Handwritten note taped to the wall (Caveat, Navy ink)."""
    S = lambda v: f'{v * s:.1f}px'
    ticks = ''.join(f'<div style="display:flex;align-items:center;gap:{S(14)};margin-top:{S(10)}">{TICK.format(s=round(34 * s), c=NAVY)}'
                    f'<div style="font-family:Caveat;font-weight:600;font-size:{S(46)};color:{NAVY};line-height:1.1">{t}</div></div>'
                    for t in ['Stopped wearing the retainer', 'Teeth moved back', 'It happens'])
    return f"""<div style="position:relative;width:{w}px;transform:rotate(-2deg)">
<div class="paper" style="padding:{S(56)} {S(50)} {S(48)};background:#FBF8EE">
  <div style="font-family:Caveat;font-weight:700;font-size:{S(70)};color:{NAVY};line-height:1">Had braces as a teen?</div>
  <svg width="{w * .62:.0f}" height="{12 * s:.0f}" viewBox="0 0 300 12" preserveAspectRatio="none" style="display:block;margin:{S(6)} 0 {S(18)}"><path d="M2 8 C 80 2, 180 12, 298 4" fill="none" stroke="{NAVY}" stroke-width="3" stroke-linecap="round"/></svg>
  {ticks}
</div>
<div class="abs" style="left:50%;top:{S(-18)};width:{S(150)};height:{S(40)};margin-left:{S(-75)};background:rgba(229,229,216,.85);transform:rotate(3deg);box-shadow:0 2px 4px rgba(0,0,0,.12)"></div>
</div>"""


def offer_band(size_px, bg=NAVY, fg=WHITE):
    return (f'<div style="display:inline-flex;align-items:center;gap:{size_px * .8:.0f}px;background:{bg};color:{fg};padding:{size_px * .9:.0f}px {size_px * 1.4:.0f}px">'
            f'{slash(size_px * 1.2, MIST)}<div class="label" style="font-size:{size_px}px">{OFFER_BAND}</div></div>')


def dan_d1(size):
    """VT-31 Handwritten sign: a note taped to the slatted reception wall."""
    name = ad_name('Dan Teeth moved back', 'Practice', 'Handwritten note', size)
    wall = lambda w, h: (photo('bl-08-slats.jpg', 0, 0, w, h, .5, .4) +
                         f'<div class="abs" style="inset:0;background:radial-gradient(circle at 45% 40%,rgba(255,255,255,.08),rgba(13,13,13,.45) 85%)"></div>')
    if size == '1x1':
        inner = f"""{wall(1080, 1080)}
<div class="abs" style="left:64px;top:56px">{logo('stacked', 230, WHITE)}</div>
<div class="abs" style="left:250px;top:200px">{note(600)}</div>
<div class="abs" style="left:0;right:0;top:800px;display:flex;justify-content:center">{offer_band(17)}</div>
<div class="abs" style="left:0;right:0;top:910px;display:flex;justify-content:center;gap:30px;align-items:center">{btn(18, WHITE, NAVY)}{proof(16, WHITE)}</div>"""
    elif size == '9x16':
        inner = f"""{wall(1080, 1920)}
<div class="abs" style="left:0;right:0;top:120px;display:flex;justify-content:center">{logo('horizontal', 640, WHITE)}</div>
<div class="abs" style="left:170px;top:420px">{note(740, 1.2)}</div>
<div class="abs" style="left:0;right:0;top:1250px;display:flex;justify-content:center">{offer_band(20)}</div>
<div class="abs" style="left:0;right:0;top:1390px;display:flex;justify-content:center">{btn(21, WHITE, NAVY)}</div>
<div class="abs" style="left:0;right:0;top:1490px;display:flex;justify-content:center">{proof(18, WHITE)}</div>"""
    else:
        inner = f"""{wall(1200, 628)}
<div class="abs" style="left:0;top:0;width:560px;height:628px;background:linear-gradient(90deg,rgba(30,68,91,.95),rgba(30,68,91,.75) 70%,rgba(30,68,91,0))"></div>
<div class="abs" style="left:56px;top:48px">{logo('stacked', 190, WHITE)}</div>
<div class="abs h" style="left:56px;top:180px;width:440px;font-size:32px;color:{WHITE}">Teeth moved back <b>after braces?</b></div>
<div class="abs body" style="left:56px;top:330px;width:420px;font-size:18px;color:#D7E1E3">A specialist orthodontist in Cheam. £500 off Invisalign and Angel Aligner, start by 23 December.</div>
<div class="abs" style="left:56px;top:455px">{proof(13, WHITE)}</div>
<div class="abs" style="left:56px;top:510px">{btn(14, WHITE, NAVY)}</div>
<div class="abs" style="left:640px;top:70px">{note(470, .8)}</div>"""
    return board(name, size, NAVY, inner)


def notif(w, title, msg, s=1.0, when='now'):
    S = lambda v: f'{v * s:.1f}px'
    return f"""<div style="width:{w}px;border-radius:{S(28)};background:rgba(244,244,244,.9);box-shadow:0 10px 30px rgba(0,0,0,.25);padding:{S(22)} {S(26)};display:flex;gap:{S(18)}">
<div style="width:{S(62)};height:{S(62)};border-radius:{S(14)};background:{NAVY};display:flex;align-items:center;justify-content:center;flex:none">{logo('tooth', round(30 * s), WHITE)}</div>
<div style="flex:1"><div style="display:flex;justify-content:space-between"><div style="font-size:{S(21)};font-weight:600;color:{INK}">{title}</div><div style="font-size:{S(18)};color:{STONE}">{when}</div></div>
<div style="font-size:{S(23)};line-height:1.35;color:{CHAR};margin-top:{S(6)}">{msg}</div></div></div>"""


N1 = 'Teeth moved back since your braces? It might be a smaller job than you think.'
N2 = '£500 off Invisalign and Angel Aligner. Start by 23 Dec.'


def dan_d2(size):
    """VT-27 Phone notification: two lock-screen messages from the practice."""
    name = ad_name('Dan Braces didnt fail', 'Stock', 'Phone notification', size)
    title = 'Cheam Village Dental Studios'
    if size == '1x1':
        inner = f"""{photo('stock-dan-scarf.jpg', 0, 0, 1080, 1080, .62, .4)}
<div class="abs" style="inset:0;background:linear-gradient(180deg,rgba(13,13,13,.92) 0%,rgba(13,13,13,.35) 16%,rgba(13,13,13,0) 32%,rgba(30,68,91,.0) 45%,rgba(30,68,91,.92) 100%)"></div>
<div class="abs" style="left:64px;top:56px">{logo('stacked', 230, WHITE)}</div>
<div class="abs" style="left:110px;top:560px">{notif(860, title, N1)}</div>
<div class="abs" style="left:110px;top:720px">{notif(860, title, N2, when='1m ago')}</div>
<div class="abs" style="left:110px;top:900px;display:flex;gap:30px;align-items:center">{btn(18, WHITE, NAVY)}{proof(16, WHITE)}</div>"""
    elif size == '9x16':
        inner = f"""{photo('stock-dan-scarf.jpg', 0, 0, 1080, 1920, .66, .4)}
<div class="abs" style="inset:0;background:linear-gradient(180deg,rgba(13,13,13,.92) 0%,rgba(13,13,13,.3) 10%,rgba(13,13,13,0) 20%,rgba(30,68,91,0) 45%,rgba(30,68,91,.94) 85%)"></div>
<div class="abs" style="left:0;right:0;top:120px;display:flex;justify-content:center">{logo('horizontal', 640, WHITE)}</div>
<div class="abs" style="left:90px;top:1030px">{notif(900, title, N1, 1.08)}</div>
<div class="abs" style="left:90px;top:1210px">{notif(900, title, N2, 1.08, when='1m ago')}</div>
<div class="abs" style="left:0;right:0;top:1440px;display:flex;justify-content:center">{btn(21, WHITE, NAVY)}</div>
<div class="abs" style="left:0;right:0;top:1530px;display:flex;justify-content:center">{proof(18, WHITE)}</div>"""
    else:
        inner = f"""{photo('stock-dan-scarf.jpg', 520, 0, 680, 628, .6, .4)}
<div class="abs" style="left:0;top:0;width:600px;height:628px;background:{NAVY}"></div>
<div class="abs" style="left:560px;top:0;width:140px;height:628px;background:linear-gradient(90deg,{NAVY},rgba(30,68,91,0))"></div>
<div class="abs" style="left:56px;top:44px">{logo('stacked', 180, WHITE)}</div>
<div class="abs" style="left:56px;top:150px">{notif(620, title, N1, .82)}</div>
<div class="abs" style="left:56px;top:290px">{notif(620, title, N2, .82, when='1m ago')}</div>
<div class="abs" style="left:56px;top:450px">{proof(13, WHITE)}</div>
<div class="abs" style="left:56px;top:505px">{btn(14, WHITE, NAVY)}</div>"""
    return board(name, size, NAVY, inner)


def dan_d3(size):
    """Custom: house-framed portrait with the closed-mouth line and a Tuesday Night aside."""
    name = ad_name('Dan Smile with your teeth', 'Stock', 'House frame portrait', size)
    light = f'<div class="abs" style="inset:0;background:radial-gradient(circle at 25% 30%,rgba(255,255,255,.9),rgba(244,244,244,0) 60%)"></div>'
    if size == '1x1':
        inner = f"""{light}
{house('stock-dan-cafe.jpg', 600, 140, 420, 830, .62, .4)}
<div class="abs" style="left:72px;top:72px">{logo('stacked', 250)}</div>
<div class="abs h" style="left:72px;top:250px;width:500px;font-size:40px;color:{INK}">Smiling with your <b>mouth closed</b> again?</div>
{script('since the braces came off', 62, NAVY, 76, 470)}
<div class="abs body" style="left:72px;top:600px;width:470px;font-size:24px;color:{CHAR}">A specialist orthodontist in Cheam can often move them back with clear aligners.</div>
<div class="abs" style="left:72px;top:760px">{proof(16)}</div>
<div class="abs" style="left:72px;top:820px">{btn(18)}</div>
<div class="abs" style="left:0;right:0;bottom:0;height:110px;background:{NAVY};display:flex;align-items:center;justify-content:center;gap:16px">{slash(22)}<div class="label" style="font-size:18px;color:{WHITE}">{OFFER_BAND}</div></div>"""
    elif size == '9x16':
        inner = f"""{light}
<div class="abs" style="left:0;right:0;top:120px;display:flex;justify-content:center">{logo('horizontal', 640)}</div>
{house('stock-dan-cafe.jpg', 220, 260, 640, 760, .6, .4)}
<div class="abs h" style="left:90px;right:90px;top:1060px;text-align:center;font-size:46px;color:{INK}">Smiling with your <b>mouth closed</b> again?</div>
<div class="abs" style="left:0;right:0;top:1210px;height:90px">{script('since the braces came off', 70, NAVY, 175, 0)}</div>
<div class="abs" style="left:0;right:0;top:1360px;display:flex;justify-content:center">{offer_band(18)}</div>
<div class="abs" style="left:0;right:0;top:1470px;display:flex;justify-content:center;gap:30px;align-items:center">{btn(19)}{proof(16)}</div>"""
    else:
        inner = f"""{light}
{house('stock-dan-cafe.jpg', 800, 40, 360, 588, .62, .4)}
<div class="abs" style="left:56px;top:48px">{logo('stacked', 190)}</div>
<div class="abs h" style="left:56px;top:160px;width:620px;font-size:34px;color:{INK}">Smiling with your <b>mouth closed</b> again?</div>
{script('since the braces came off', 50, NAVY, 60, 290)}
<div class="abs" style="left:56px;top:400px">{offer_band(13)}</div>
<div class="abs" style="left:56px;top:480px">{proof(13)}</div>
<div class="abs" style="left:56px;top:530px">{btn(14)}</div>"""
    return board(name, size, BASE, inner)


# ================================================================ ADE

REASONS = ['Planned by a specialist orthodontist', 'Comprehensive aligner plans for crowding and bite problems',
           'A 3D scan and preview before you decide']


def reasons(size_px, gap, colour=INK):
    return ''.join(f'<div style="display:flex;gap:{size_px * .7:.0f}px;align-items:flex-start;margin-top:{gap}px">'
                   f'<div style="width:{size_px * 1.5:.0f}px;height:{size_px * 1.5:.0f}px;border-radius:50%;background:{NAVY};display:flex;align-items:center;justify-content:center;flex:none">'
                   f'{TICK.format(s=round(size_px * .95), c=WHITE)}</div>'
                   f'<div class="body" style="font-size:{size_px}px;color:{colour};padding-top:{size_px * .12:.0f}px">{t}</div></div>' for t in REASONS)


def ade_a1(size):
    """VT-07 Three reasons, with the 3D scan photo in the house frame."""
    name = ad_name('Ade Complex cases specialist', 'Practice', 'Three reasons', size)
    light = f'<div class="abs" style="inset:0;background:radial-gradient(circle at 20% 25%,rgba(255,255,255,.9),rgba(244,244,244,0) 60%)"></div>'
    title = '3 reasons complex cases choose <b>Cheam Village</b>'
    if size == '1x1':
        inner = f"""{light}
{house('bl-07.jpg', 640, 160, 400, 920, .72, .45)}
<div class="abs" style="left:72px;top:72px">{logo('stacked', 250)}</div>
<div class="abs h" style="left:72px;top:230px;width:520px;font-size:38px;color:{INK}">{title}</div>
<div class="abs" style="left:72px;top:440px;width:530px">{reasons(23, 22)}</div>
<div class="abs" style="left:72px;top:745px">{proof(16)}</div>
<div class="abs" style="left:72px;top:800px">{date_line(15)}</div>
<div class="abs" style="left:72px;top:860px">{btn(18)}</div>
<div class="abs label" style="left:72px;top:960px;font-size:15px;color:{NAVY}">£500 off Invisalign and Angel Aligner</div>"""
    elif size == '9x16':
        inner = f"""{light}
<div class="abs" style="left:0;right:0;top:120px;display:flex;justify-content:center">{logo('horizontal', 640)}</div>
{house('bl-07.jpg', 240, 240, 600, 640, .72, .4)}
<div class="abs h" style="left:90px;right:90px;top:920px;text-align:center;font-size:44px;color:{INK}">{title}</div>
<div class="abs" style="left:150px;top:1060px;width:800px">{reasons(27, 24)}</div>
<div class="abs" style="left:0;right:0;top:1360px;display:flex;justify-content:center">{offer_band(17)}</div>
<div class="abs" style="left:0;right:0;top:1460px;display:flex;justify-content:center;gap:30px;align-items:center">{btn(19)}{proof(16)}</div>"""
    else:
        inner = f"""{light}
{house('bl-07.jpg', 820, 40, 340, 588, .72, .45)}
<div class="abs" style="left:56px;top:44px">{logo('stacked', 180)}</div>
<div class="abs h" style="left:56px;top:140px;width:700px;font-size:30px;color:{INK}">{title}</div>
<div class="abs" style="left:56px;top:210px;width:700px">{reasons(18, 16)}</div>
<div class="abs" style="left:56px;top:420px">{offer_band(12)}</div>
<div class="abs" style="left:56px;top:486px">{proof(13)}</div>
<div class="abs" style="left:56px;top:530px">{btn(14)}</div>"""
    return board(name, size, BASE, inner)


def letter(w, s=1.0):
    """A generic assessment letter pinned to the wall: the old verdict struck through, 'Ask a specialist' in pen."""
    S = lambda v: f'{v * s:.1f}px'
    bars = lambda widths: ''.join(f'<div style="height:{S(10)};width:{x}%;background:#D9D8D1;border-radius:{S(5)};margin-top:{S(14)}"></div>' for x in widths)
    return f"""<div style="position:relative;width:{w}px;transform:rotate(1.5deg)">
<div class="paper" style="padding:{S(54)} {S(52)} {S(60)};background:#FCFBF8">
  <div class="label" style="font-size:{S(13)};color:{STONE}">Orthodontic assessment</div>
  <div style="height:{S(2)};background:#C9C9C2;margin:{S(16)} 0 {S(8)}"></div>
  {bars([92, 80, 88])}
  <div style="position:relative;margin-top:{S(30)};font-size:{S(30)};font-weight:600;color:{INK}">Not suitable for clear aligners.
    <svg class="abs" style="left:{S(-8)};top:{S(14)}" width="{w * .9:.0f}" height="{S(16)}" viewBox="0 0 400 16" preserveAspectRatio="none"><path d="M2 10 C 90 4, 200 14, 398 6" fill="none" stroke="{NAVY}" stroke-width="4" stroke-linecap="round"/></svg></div>
  {bars([70, 84])}
  <div style="display:flex;align-items:center;gap:{S(14)};margin-top:{S(26)}">
    <svg width="{S(64)}" height="{S(40)}" viewBox="0 0 64 40"><path d="M4 32 C 20 30, 40 22, 56 10 M44 8 L57 9 L52 21" fill="none" stroke="{NAVY}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <div style="font-family:Caveat;font-weight:700;font-size:{S(60)};color:{NAVY};line-height:1">Ask a specialist</div></div>
</div>
<div class="abs" style="left:50%;top:{S(14)};width:{S(22)};height:{S(22)};margin-left:{S(-11)};border-radius:50%;background:radial-gradient(circle at 35% 35%,#E3C77B,{GOLD} 55%,#8E7B3E);box-shadow:0 3px 5px rgba(0,0,0,.35)"></div>
</div>"""


def ade_a2(size):
    """Custom: the old 'not suitable' letter pinned to the practice's navy wall, struck through."""
    name = ad_name('Ade Told aligners wont work', 'Practice', 'Struck-through letter', size)
    if size == '1x1':
        inner = f"""{photo('bl-10.jpg', 0, 0, 1080, 1080, .55, .45)}
<div class="abs" style="inset:0;background:linear-gradient(180deg,rgba(30,68,91,.35) 0%,rgba(30,68,91,.2) 38%,rgba(30,68,91,.97) 64%)"></div>
<div class="abs" style="left:64px;top:56px">{logo('stacked', 230, WHITE)}</div>
<div class="abs" style="left:96px;top:150px">{letter(560, .95)}</div>
<div class="abs h" style="left:72px;top:770px;width:640px;font-size:38px;color:{WHITE}">Told your case was <b>too complex?</b></div>
<div class="abs label" style="left:72px;top:880px;font-size:15px;color:{MIST}">Specialist orthodontist · Cheam</div>
<div class="abs" style="left:72px;top:930px;display:flex;gap:28px;align-items:center">{btn(18, WHITE, NAVY)}<div class="label" style="font-size:14px;color:{WHITE}">£500 off aligners · until 23 Dec</div></div>"""
    elif size == '9x16':
        inner = f"""{photo('bl-10.jpg', 0, 0, 1080, 1920, .45, .45)}
<div class="abs" style="inset:0;background:linear-gradient(180deg,rgba(13,13,13,.6) 0%,rgba(30,68,91,.1) 14%,rgba(30,68,91,.15) 44%,rgba(30,68,91,.98) 60%)"></div>
<div class="abs" style="left:0;right:0;top:120px;display:flex;justify-content:center">{logo('horizontal', 640, WHITE)}</div>
<div class="abs" style="left:150px;top:330px">{letter(780, 1.3)}</div>
<div class="abs h" style="left:90px;right:90px;top:1200px;text-align:center;font-size:46px;color:{WHITE}">Told your case was <b>too complex?</b></div>
<div class="abs label" style="left:0;right:0;top:1340px;text-align:center;font-size:17px;color:{MIST}">Specialist orthodontist · Cheam</div>
<div class="abs" style="left:0;right:0;top:1400px;display:flex;justify-content:center">{offer_band(17, WHITE, NAVY)}</div>
<div class="abs" style="left:0;right:0;top:1500px;display:flex;justify-content:center">{btn(20, WHITE, NAVY)}</div>"""
    else:
        inner = f"""{photo('bl-10.jpg', 480, 0, 720, 628, .5, .45)}
<div class="abs" style="left:0;top:0;width:560px;height:628px;background:{NAVY}"></div>
<div class="abs" style="left:540px;top:0;width:120px;height:628px;background:linear-gradient(90deg,{NAVY},rgba(30,68,91,0))"></div>
<div class="abs" style="left:56px;top:48px">{logo('stacked', 190, WHITE)}</div>
<div class="abs h" style="left:56px;top:160px;width:480px;font-size:30px;color:{WHITE}">Told your case was <b>too complex?</b></div>
<div class="abs label" style="left:56px;top:300px;font-size:13px;color:{MIST}">Specialist orthodontist · Cheam</div>
<div class="abs body" style="left:56px;top:340px;width:440px;font-size:18px;color:#D7E1E3">£500 off Invisalign and Angel Aligner when you start by 23 December.</div>
<div class="abs" style="left:56px;top:455px">{proof(13, WHITE)}</div>
<div class="abs" style="left:56px;top:510px">{btn(14, WHITE, NAVY)}</div>
<div class="abs" style="left:640px;top:70px">{letter(460, .72)}</div>"""
    return board(name, size, NAVY, inner)


def logo_bug(s=1.0):
    S = lambda v: f'{v * s:.1f}px'
    return (f'<div style="display:inline-flex;align-items:center;gap:{S(14)};background:rgba(244,244,244,.92);padding:{S(12)} {S(20)} {S(12)} {S(12)};border-radius:{S(40)}">'
            f'<div style="width:{S(44)};height:{S(44)};border-radius:50%;background:{NAVY};display:flex;align-items:center;justify-content:center">{logo("tooth", round(20 * s), WHITE)}</div>'
            f'<div class="label" style="font-size:{S(13)};color:{INK};letter-spacing:.22em">Cheam Village Dental Studios</div></div>')


ADE_LINE = 'Specialist-led aligners in Cheam. £500 off until 23 Dec.'


def ade_a3(size):
    """VT-18 Native practice photo: the waiting room as it is, a logo bug and one line."""
    name = ad_name('Ade The practice as it is', 'Practice', 'Native photo', size)
    foot = lambda a: f'<div class="abs" style="inset:0;background:linear-gradient(180deg,rgba(13,13,13,0) {a}%,rgba(13,13,13,.82) 100%)"></div>'
    if size == '1x1':
        inner = f"""{photo('bl-12.jpg', 0, 0, 1080, 1080, .5, .5)}{foot(60)}
<div class="abs" style="left:48px;top:48px">{logo_bug()}</div>
<div class="abs" style="left:56px;right:56px;bottom:56px;font-size:30px;font-weight:500;color:{WHITE};line-height:1.35">{ADE_LINE}</div>"""
    elif size == '9x16':
        inner = f"""{photo('bl-11.jpg', 0, 0, 1080, 1920, .5, .5)}{foot(55)}
<div class="abs" style="left:0;right:0;top:260px;display:flex;justify-content:center">{logo_bug(1.2)}</div>
<div class="abs" style="left:60px;right:60px;top:1440px;text-align:center;font-size:33px;font-weight:500;color:{WHITE};line-height:1.35">{ADE_LINE}</div>"""
    else:
        inner = f"""{photo('bl-12.jpg', 0, 0, 1200, 628, .5, .55)}{foot(50)}
<div class="abs" style="left:40px;top:36px">{logo_bug(.9)}</div>
<div class="abs" style="left:48px;right:48px;bottom:40px;font-size:26px;font-weight:500;color:{WHITE}">{ADE_LINE}</div>"""
    return board(name, size, NAVY, inner)


PERSONAS = {
    'amy': ('Amy | aligner researcher', [amy_a1, amy_a2, amy_a3]),
    'dan': ('Dan | relapsed after braces', [dan_d1, dan_d2, dan_d3]),
    'ade': ('Ade | told he was too complex', [ade_a1, ade_a2, ade_a3]),
}


def build(key):
    title, concepts = PERSONAS[key]
    for size in SIZES:
        (HERE / f'{key}-{size}.html').write_text(page(f'{title} | {size}', [c(size) for c in concepts]))
    print(key, 'built')


if __name__ == '__main__':
    for k in sys.argv[1:] or PERSONAS:
        build(k)
