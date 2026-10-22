"""Dentistry.ie brand guideline: HTML harness for Figma capture.

Sources (22 Oct 2026):
- No brand kit or logo masters on Drive. Everything comes from dentistry.ie (Webflow).
- Palette: the site's CSS tokens (accent-1 100-500, accent-2, base 100-500).
- Type: IBM Plex Sans (300/400/500) with IBM Plex Serif Italic 400 for the turn of a headline, as on the site.
- Logo: assets/logo.svg + assets/mark.svg are traced from the site's 464px AVIF (white, alpha in a second AV1 plane).
  Ask the client for the master artwork; swap it in when it arrives.
- Photos: site imagery in assets/photos (gitignored). Team shots are real; files named "stock" are stock.
- Heart-masked photos: make_assets.py.

Usage: python3 build_guideline.py  ->  guideline.html + guideline-capture.html (Figma capture)
"""
import re
from pathlib import Path

HERE = Path(__file__).parent
A = HERE / 'assets'

NAVY, HARBOUR, SKY, LINEN = '#0F1B29', '#3274A3', '#6EC1DB', '#FAF9F6'
STONE, MIST, SLATE, STEEL = '#E6E5E2', '#F3F4F6', '#414D5B', '#7186A5'
SAGE, SAGE_L, WHITE = '#5F6E61', '#B1BCB1', '#FFFFFF'
RED = '#C2453A'

_LOGO_VB = re.search(r'viewBox="([^"]+)"', (A / 'logo.svg').read_text()).group(1)
_MARK_VB = re.search(r'viewBox="([^"]+)"', (A / 'mark.svg').read_text()).group(1)
_LOGO = re.sub(r'^<svg[^>]*>', '', (A / 'logo.svg').read_text().strip()).rsplit('</svg>', 1)[0]
_MARK = re.sub(r'^<svg[^>]*>', '', (A / 'mark.svg').read_text().strip()).rsplit('</svg>', 1)[0]
_LR = (lambda v: v[2] / v[3])(list(map(float, _LOGO_VB.split())))
_MR = (lambda v: v[2] / v[3])(list(map(float, _MARK_VB.split())))


def logo(width, colour=NAVY):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{_LOGO_VB}" width="{width}" height="{round(width / _LR, 1)}" fill="{colour}" style="display:block">{_LOGO}</svg>'


def mark(height, colour=NAVY):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{_MARK_VB}" width="{round(height * _MR, 1)}" height="{height}" fill="{colour}" style="display:block">{_MARK}</svg>'


CSS = f"""
@font-face{{font-family:'IBM Plex Sans';src:url('assets/fonts/IBMPlexSans.ttf');font-weight:100 700;font-style:normal}}
@font-face{{font-family:'IBM Plex Serif';src:url('assets/fonts/IBMPlexSerif-Italic.ttf');font-weight:400;font-style:italic}}
@font-face{{font-family:'IBM Plex Serif';src:url('assets/fonts/IBMPlexSerif-LightItalic.ttf');font-weight:300;font-style:italic}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:#cfd3d8;font-family:'IBM Plex Sans',sans-serif;font-weight:400;color:{NAVY};display:flex;flex-direction:column;gap:120px;padding:120px;width:2160px;-webkit-font-smoothing:antialiased}}
.page{{position:relative;width:1920px;height:1080px;overflow:hidden;background:{LINEN}}}
.navy{{background:{NAVY};color:{LINEN}}} .stone{{background:{STONE}}}
.abs{{position:absolute}}
.h{{font-weight:400;letter-spacing:-.02em;line-height:1.1}}
.h em{{font-family:'IBM Plex Serif',serif;font-style:italic;font-weight:400;letter-spacing:-.01em}}
.label{{font-weight:500;font-size:13px;letter-spacing:.14em;text-transform:uppercase}}
.body{{font-size:19px;line-height:1.65;font-weight:400}} .body p+p{{margin-top:14px}}
.small{{font-size:15px;line-height:1.6;font-weight:400}}
.dim{{opacity:.8}}
.ph{{position:absolute;overflow:hidden}}
.ph img{{width:100%;height:100%;object-fit:cover;display:block}}
.full{{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}}
.btn{{display:inline-flex;align-items:center;gap:12px;font-weight:500;white-space:nowrap}}
.chip{{display:inline-block;background:{LINEN};color:{NAVY};font-weight:500;border-radius:6px}}
.foot{{position:absolute;left:80px;right:80px;bottom:44px;display:flex;justify-content:space-between}}
.swatch{{position:absolute;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;padding:28px;border-radius:20px}}
.rule{{height:1px;background:{STONE}}}
"""

ARROW = '<svg width="{s}" height="{s}" viewBox="0 0 16 16" fill="none" style="display:block"><path d="M4.5 11.5l7-7M5.5 4.5h6v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
TICK = '<svg width="{s}" height="{s}" viewBox="0 0 16 16" fill="none" style="display:block;flex:none"><rect x=".75" y=".75" width="14.5" height="14.5" rx="3" fill="{bg}"/><path d="M4.5 8.2l2.3 2.3 4.7-5" stroke="{fg}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
STAR = '<svg width="{s}" height="{s}" viewBox="0 0 20 20" style="display:block"><path d="M10 1.5l2.6 5.5 6 .7-4.4 4.1 1.1 5.9L10 14.8l-5.3 2.9 1.1-5.9L1.4 7.7l6-.7z" fill="{c}"/></svg>'


def btn(text, size, padx, pady, bg=HARBOUR, fg=LINEN):
    """The site's button: a pill with a square top-right corner and a north-east arrow."""
    r = round(size * 2.3)
    return f'<div class="btn" style="font-size:{size}px;padding:{pady}px {padx}px;background:{bg};color:{fg};border-radius:{r}px 0 {r}px {r}px">{text}{ARROW.format(s=round(size * 1.05))}</div>'


def chip(text, size=13):
    return f'<span class="chip" style="font-size:{size}px;padding:{size * .35}px {size * .7}px">{text}</span>'


def tick_row(items, size=17, bg=HARBOUR, fg=LINEN, gap=14, colour=None):
    style = f'color:{colour};' if colour else ''
    return ''.join(f'<div style="display:flex;align-items:center;gap:{size * .6}px;margin-top:{gap}px;font-size:{size}px;{style}">{TICK.format(s=round(size * 1.05), bg=bg, fg=fg)}<span>{t}</span></div>' for t in items)


def stars(s, c=SKY):
    return '<div style="display:flex;gap:3px">' + ''.join(STAR.format(s=s, c=c) for _ in range(5)) + '</div>'


def page(cls, body, n=None, title=None, dark=False):
    c = LINEN if dark else NAVY
    head = ''
    if title:
        head = f'<div class="abs label" style="left:80px;top:62px;color:{SKY if dark else HARBOUR}">{n:02d}</div><div class="abs label" style="left:130px;top:62px;color:{c};opacity:.7">{title}</div>'
    foot = f'<div class="foot label" style="font-size:11px;color:{c};opacity:.5"><span>dentistry.ie</span><span>Brand guidelines · 2026</span></div>'
    return f'<section class="page {cls}">{head}{body}{foot}</section>'


def ph(src, x, y, w, h, pos='50% 50%', radius=24, circle=False):
    rad = '50%' if circle else f'{radius}px'
    return f'<div class="ph" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;border-radius:{rad}"><img src="assets/photos/{src}" style="object-position:{pos}"></div>'


def heart(src, x, y, h):
    """Photo inside the heart-tooth silhouette (pre-masked PNG, aspect 0.905)."""
    return f'<img class="abs" src="assets/photos/{src}" style="left:{x}px;top:{y}px;height:{h}px;width:{round(h * .905)}px;display:block">'


# ---------- ads in the system (Applications page) ----------

def ad_square(s):
    return f"""<div style="position:relative;width:{1080 * s}px;height:{1080 * s}px;overflow:hidden;background:{LINEN};border-radius:{8 * s}px">
<div style="position:absolute;left:{72 * s}px;top:{72 * s}px">{logo(250 * s)}</div>
<div class="h" style="position:absolute;left:{72 * s}px;top:{250 * s}px;width:{460 * s}px;font-size:{64 * s}px">Stop hiding your smile. <em>Start with a chat.</em></div>
<div style="position:absolute;left:{72 * s}px;top:{560 * s}px;width:{460 * s}px">{tick_row(['Free cosmetic consultation', 'Your own treatment coordinator', '100% Irish owned'], 25 * s, gap=16 * s)}</div>
<div style="position:absolute;left:{72 * s}px;top:{880 * s}px">{btn('Book a consultation', 24 * s, 34 * s, 22 * s)}</div>
{heart('mask-smile.png', 555 * s, 230 * s, 560 * s)}
</div>"""


def ad_story(s):
    return f"""<div style="position:relative;width:{1080 * s}px;height:{1920 * s}px;overflow:hidden;background:{NAVY};color:{LINEN};border-radius:{8 * s}px">
<div style="position:absolute;left:0;right:0;top:{260 * s}px;display:flex;justify-content:center">{logo(330 * s, LINEN)}</div>
<div class="h" style="position:absolute;left:{100 * s}px;right:{100 * s}px;top:{430 * s}px;text-align:center;font-size:{82 * s}px">Caring for families <em>since 1980.</em></div>
{ph('faq-help-image.png', 120 * s, 720 * s, 840 * s, 760 * s, '50% 40%', radius=36 * s)}
<div style="position:absolute;left:{150 * s}px;top:{1400 * s}px">{chip('Saturday appointments', 26 * s)}</div>
<div style="position:absolute;left:0;right:0;top:{1500 * s}px;display:flex;justify-content:center">{btn('Book an appointment', 28 * s, 42 * s, 26 * s, SKY, NAVY)}</div>
</div>"""


# ---------- pages ----------

def cover():
    return page('navy', f"""
<div class="abs" style="left:1240px;top:-60px;opacity:.07">{mark(1240, LINEN)}</div>
<div class="abs" style="left:160px;top:360px">{logo(720, LINEN)}</div>
<div class="abs h" style="left:164px;top:560px;font-size:44px">Brand <em>guidelines</em></div>
<div class="abs label" style="left:166px;top:640px;color:{SKY}">Eight clinics · Dublin · Kildare · Kilkenny</div>""", dark=True)


def story():
    clinics = ['Artane', 'Balbriggan', 'Castleknock', 'Dublin 2 (McEvoy)', 'Kildare', 'Kilkenny (Friary Court)', 'Kimmage (Sundrive)', 'Maynooth (Pearl Dental)']
    return page('', f"""
<div class="abs h" style="left:80px;top:140px;width:880px;font-size:76px">Eight locations. One commitment to <em>exceptional dental care.</em></div>
<div class="abs body dim" style="left:80px;top:420px;width:760px">
<p>Dentistry.ie brings trusted local practices together under one name: general, family and children’s dentistry, cosmetic and restorative work, orthodontics, implants and facial aesthetics.</p>
<p>It is 100% Irish owned and has been caring for families since 1980. Specialists across the group work together on each plan, and every patient has a treatment coordinator to guide them from first chat to aftercare.</p></div>
<div class="abs" style="left:80px;top:760px;width:800px">
  <div class="label" style="color:{HARBOUR}">Brand idea</div>
  <div class="h" style="font-size:40px;margin-top:14px">Big-group expertise, <em>local-practice care.</em></div></div>
{heart('mask-team.png', 980, 140, 560)}
<div class="abs" style="left:1560px;top:140px;width:290px">
  <div class="label" style="color:{HARBOUR}">The clinics</div>
  <div class="small" style="margin-top:16px;line-height:2">{'<br>'.join(clinics)}</div>
  <div class="rule" style="margin:28px 0;background:{SLATE};opacity:.25"></div>
  <div class="label" style="color:{HARBOUR}">Proof points</div>
  <div class="small" style="margin-top:16px;line-height:2">Since 1980<br>100% Irish owned<br>500+ five-star Google reviews<br>90+ years combined experience</div>
</div>""", 1, 'Who we are')


def logo_page():
    misuse = [
        ('Stretched', f'<div style="transform:scaleX(1.45)">{logo(150)}</div>'),
        ('Off-palette colour', logo(200, '#D9822B')),
        ('Rotated', f'<div style="transform:rotate(-12deg)">{logo(190)}</div>'),
        ('Low contrast', f'<div style="position:absolute;inset:0;background:{HARBOUR};display:flex;align-items:center;justify-content:center">{logo(200, STEEL)}</div>'),
    ]
    mis = ''.join(f"""<div style="width:262px;height:160px;background:{STONE};border-radius:14px;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden">{m}
<svg class="abs" style="left:0;top:0" width="262" height="160"><line x1="16" y1="146" x2="246" y2="14" stroke="{RED}" stroke-width="2.5"/></svg>
<div class="abs label" style="left:16px;top:14px;font-size:10px;color:{RED}">{t}</div></div>""" for t, m in misuse)
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:72px">The <em>logo</em></div>
<div class="abs body dim" style="left:80px;top:250px;width:540px"><p>A heart-shaped tooth drawn as one continuous line, beside the Dentistry.ie wordmark with a lighter “.ie”.</p>
<p>Clear space on every side equals the width of the “D”. Minimum width is 140px on screen, 35mm in print.</p>
<p>The mark works alone as an avatar, favicon, bullet and watermark. Navy on light grounds, Linen on Navy or photography. Never redraw or retype it.</p></div>
<div class="abs" style="left:700px;top:130px;width:1140px;height:430px;background:{WHITE};border-radius:24px;display:flex;align-items:center;justify-content:center">
  <div style="position:relative;padding:56px 64px;border:1.5px dashed {STEEL}">{logo(600)}</div></div>
<div class="abs" style="left:700px;top:590px;width:270px;height:150px;border-radius:16px;background:{LINEN};border:1px solid {STONE};display:flex;align-items:center;justify-content:center">{logo(200)}</div>
<div class="abs" style="left:990px;top:590px;width:270px;height:150px;border-radius:16px;background:{NAVY};display:flex;align-items:center;justify-content:center">{logo(200, LINEN)}</div>
<div class="abs" style="left:1280px;top:590px;width:270px;height:150px;border-radius:16px;overflow:hidden"><img class="full" src="assets/photos/video-page-break.png" style="object-position:50% 40%"><div class="abs" style="inset:0;background:rgba(15,27,41,.5)"></div><div class="abs" style="inset:0;display:flex;align-items:center;justify-content:center">{logo(200, LINEN)}</div></div>
<div class="abs" style="left:1570px;top:590px;width:270px;height:150px;border-radius:16px;background:{HARBOUR};display:flex;align-items:center;justify-content:center">{mark(90, LINEN)}</div>
<div class="abs label" style="left:700px;top:752px;font-size:10px;opacity:.7">Navy on Linen</div>
<div class="abs label" style="left:990px;top:752px;font-size:10px;opacity:.7">Linen on Navy</div>
<div class="abs label" style="left:1280px;top:752px;font-size:10px;opacity:.7">On photo, with Navy shade</div>
<div class="abs label" style="left:1570px;top:752px;font-size:10px;opacity:.7">Mark alone</div>
<div class="abs label" style="left:700px;top:800px;color:{RED}">Misuse</div>
<div class="abs" style="left:700px;top:832px;display:flex;gap:24px">{mis}</div>""", 2, 'Logo')


def colour():
    sw = [
        ('Navy', NAVY, 'Headlines, dark pages, logo', LINEN, 80, 150, 580, 400, False),
        ('Linen', LINEN, 'Main light canvas', NAVY, 680, 150, 580, 400, True),
        ('Harbour Blue', HARBOUR, 'Primary buttons, USP bar', LINEN, 1280, 150, 560, 400, False),
        ('Sky', SKY, 'CTA on Navy, highlights, stars', NAVY, 80, 570, 330, 290, False),
        ('Stone', STONE, 'Cards, secondary ground', NAVY, 430, 570, 330, 290, False),
        ('Slate', SLATE, 'Body copy on light', LINEN, 780, 570, 330, 290, False),
        ('Sage', SAGE, 'Quiet accent, rare', LINEN, 1130, 570, 330, 290, False),
    ]
    cards = ''.join(f"""<div class="swatch" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;background:{c};color:{t};{'border:1px solid ' + STONE + ';' if b else ''}">
<div class="h" style="font-size:{44 if h > 300 else 30}px">{n}</div><div class="label" style="font-size:11px;margin-top:10px">{c}</div><div class="small" style="margin-top:6px;opacity:.8;font-size:14px">{u}</div></div>""" for n, c, u, t, x, y, w, h, b in sw)
    return page('', f"""{cards}
<div class="abs" style="left:1480px;top:570px;width:360px;height:290px;display:flex;border-radius:20px;overflow:hidden">
  <div style="flex:45;background:{LINEN};border:1px solid {STONE};border-radius:20px 0 0 20px"></div><div style="flex:30;background:{NAVY}"></div><div style="flex:15;background:{HARBOUR}"></div><div style="flex:7;background:{SKY}"></div><div style="flex:3;background:{STONE}"></div></div>
<div class="abs label" style="left:1480px;top:872px;font-size:11px;opacity:.7">Balance · 45 / 30 / 15 / 7 / 3</div>
<div class="abs small dim" style="left:80px;top:900px;width:1300px">Calm and trustworthy. Linen and Navy carry the layout, Harbour Blue does the asking (buttons, the USP bar) and Sky is the spark on dark grounds. All values are the website’s own colour tokens. Sage exists in the site tokens but is barely used, so keep it for occasional support. No bright clinical teal, no gradients.</div>""", 3, 'Colour')


def typography():
    return page('', f"""
<div class="abs" style="left:80px;top:130px;width:1080px">
  <div class="label" style="color:{HARBOUR}">Headline · IBM Plex Sans Regular 400 · the turn in IBM Plex Serif Italic</div>
  <div class="h" style="font-size:108px;margin-top:22px;line-height:1.05">Transform your smile <em>with our team.</em></div>
  <div class="small dim" style="margin-top:24px;width:860px">Sentence case, tight tracking. The warm or emotional end of the line switches to the serif italic, exactly as the website does. One italic phrase per headline.</div>
</div>
<div class="abs" style="left:80px;top:650px;width:520px">
  <div class="label" style="color:{HARBOUR}">Body · IBM Plex Sans Regular 400</div>
  <div class="body dim" style="margin-top:14px">Start with a complimentary consultation where your treatment coordinator listens, explains the options and discusses prices openly.</div>
</div>
<div class="abs" style="left:680px;top:650px;width:480px">
  <div class="label" style="color:{HARBOUR}">Label · Plex Sans Medium · caps · +14%</div>
  <div class="label" style="margin-top:18px;font-size:18px">Step 01 · Consultation</div>
  <div class="label" style="color:{HARBOUR};margin-top:40px">Button · Plex Sans Medium · sentence case</div>
  <div style="margin-top:14px">{btn('Book a consultation', 17, 26, 16)}</div>
</div>
<div class="abs navy" style="left:1240px;top:130px;width:600px;height:800px;padding:56px;border-radius:28px">
  <div class="label" style="color:{SKY}">Quote · Plex Serif Italic</div>
  <div style="font-family:'IBM Plex Serif',serif;font-style:italic;font-size:44px;line-height:1.3;margin-top:28px">“Everyone was so lovely. I was talked through everything.”</div>
  <div class="small" style="margin-top:22px;opacity:.7">Adapted from a Google review. Real names only with the reviewer’s permission.</div>
  <div class="label" style="color:{SKY};margin-top:60px">Numerals · Plex Sans Light 300</div>
  <div style="display:flex;gap:34px;margin-top:20px;font-weight:300;font-size:110px;line-height:1;color:{SKY}"><span>1</span><span>2</span><span style="color:{LINEN}">4</span></div>
</div>""", 4, 'Typography')


def elements():
    usps = ['100% Irish owned', 'Free cosmetic consultations', 'HSE Medical Card accepted', 'Serving the community since 1980']
    usp = ''.join(f'<div style="display:flex;align-items:center;gap:10px;font-family:\'IBM Plex Serif\',serif;font-style:italic;font-size:17px">{TICK.format(s=18, bg=LINEN, fg=HARBOUR)}{u}</div>' for u in usps)
    steps = ['Consultation', 'Assessment', 'Your plan', 'Treatment']
    tl = ''.join(f'<div style="flex:1"><div style="width:44px;height:44px;border-radius:50%;background:{NAVY if i == 0 else LINEN};color:{LINEN if i == 0 else NAVY};border:1.5px solid {NAVY};display:flex;align-items:center;justify-content:center;font-size:18px">{i + 1}</div><div class="small" style="margin-top:14px;font-size:16px">{s}</div></div>' for i, s in enumerate(steps))
    return page('', f"""
<div class="abs" style="left:80px;top:130px;width:520px;height:440px;background:{STONE};border-radius:24px;overflow:hidden">
  {heart('mask-family.png', 120, 30, 400)}
</div>
<div class="abs label" style="left:80px;top:584px;font-size:10px;opacity:.65">The heart frame · photo inside the mark’s silhouette</div>
<div class="abs" style="left:640px;top:130px;width:520px;height:440px;border-radius:24px;overflow:hidden">
  <img class="full" src="assets/photos/dental-implants.png" style="object-position:50% 25%">
  <div class="abs" style="inset:0;background:linear-gradient(180deg,rgba(15,27,41,0) 35%,rgba(15,27,41,.85) 100%)"></div>
  <div class="abs" style="left:34px;bottom:96px">{chip('Dental implants', 13)}</div>
  <div class="abs h" style="left:34px;bottom:36px;font-size:34px;color:{LINEN}">Replace missing teeth <em>for life.</em></div>
</div>
<div class="abs label" style="left:640px;top:584px;font-size:10px;opacity:.65">Rounded photo card · 24px corners, Linen tag chip</div>
<div class="abs navy" style="left:1200px;top:130px;width:640px;height:440px;border-radius:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px">
  {btn('Book a consultation', 20, 32, 20, SKY, NAVY)}{btn('Book an appointment', 20, 32, 20)}
  <div class="small" style="opacity:.7;width:440px;text-align:center">One square corner, top right, and a north-east arrow. Sky on Navy, Harbour Blue on light.</div></div>
<div class="abs label" style="left:1200px;top:584px;font-size:10px;opacity:.65">The button · from the website</div>
<div class="abs" style="left:80px;top:650px;width:1080px;height:110px;background:{HARBOUR};color:{LINEN};border-radius:20px;display:flex;align-items:center;justify-content:space-around;padding:0 30px">{usp}</div>
<div class="abs label" style="left:80px;top:772px;font-size:10px;opacity:.65">USP bar · Harbour Blue, serif italic, ticks in Linen</div>
<div class="abs" style="left:80px;top:810px;width:1080px;height:130px;background:{WHITE};border-radius:20px;padding:24px 40px">
  <div style="display:flex">{tl}</div></div>
<div class="abs" style="left:1200px;top:650px;width:640px;height:290px;background:{WHITE};border-radius:24px;padding:40px 44px">
  {stars(24)}
  <div style="font-family:'IBM Plex Serif',serif;font-style:italic;font-size:24px;line-height:1.4;margin-top:20px">“I was so at ease the minute I walked in the door.”</div>
  <div class="label" style="margin-top:22px;font-size:12px;color:{HARBOUR}">Google review · 500+ five-star reviews</div></div>""", 5, 'Graphic elements')


def photography():
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:72px;width:540px">Real team, <em>real smiles.</em></div>
<div class="abs body dim" style="left:80px;top:330px;width:500px">
<p>Our own clinicians in their navy and teal scrubs, patients mid-conversation, families together in the chair. Bright, natural light and clean clinic backgrounds.</p>
<p>Team photography leads. Stock is only for treatment explainers, and only when it looks like an ordinary Irish patient, not a model.</p></div>
{ph('dental-implants.png', 640, 130, 380, 520, '50% 30%')}
{ph('video-page-break.png', 1050, 130, 790, 250, '50% 35%')}
{ph('why-us-home.png', 1050, 400, 385, 250, '55% 40%')}
{ph('custom-image-3.png', 1455, 400, 385, 250, '50% 40%')}
<div class="abs" style="left:640px;top:690px;width:1200px;height:250px;background:{STONE};border-radius:24px;padding:40px 50px;display:flex;gap:60px">
  <div style="width:520px"><div class="label" style="color:{HARBOUR}">Look for</div><div class="small" style="margin-top:12px">Named team members from our own clinics, eye contact, relaxed hands, genuine smiles. Families and children (with consent). Leave space for a headline.</div></div>
  <div style="width:520px"><div class="label" style="color:{RED}">Avoid</div><div class="small" style="margin-top:12px">Glossy model stock, instruments and needles in close-up, open mouths mid-treatment, unlabelled before-and-afters, and anything that would worry a nervous patient.</div></div></div>""", 6, 'Photography')


def voice():
    pairs = [('Warm', 'Your family’s smiles matter to us.', 'Don’t miss out! Book NOW!'),
             ('Honest', 'No obligation, just honest advice.', 'Ireland’s best dentist, guaranteed.'),
             ('Reassuring', 'You’ll have one person guiding you throughout.', 'Painless treatment, every time.'),
             ('Local', 'Saturday appointments at your local clinic.', 'Serving clients nationwide.')]
    rows = ''.join(f"""<div style="display:flex;gap:30px;padding:22px 0;border-top:1px solid {STEEL}">
<div class="h" style="width:260px;font-size:40px"><em>{t}</em></div>
<div style="width:600px"><div class="label" style="font-size:10px;color:{HARBOUR}">We say</div><div class="body" style="margin-top:6px">{y}</div></div>
<div style="width:560px;opacity:.45"><div class="label" style="font-size:10px">We don’t say</div><div class="body" style="margin-top:6px;text-decoration:line-through">{n}</div></div></div>""" for t, y, n in pairs)
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:80px">How <em>we sound</em></div>
<div class="abs body dim" style="left:80px;top:250px;width:1500px">Like the friendly face at reception who has known the family for years: warm, plain-spoken and open about cost. We talk about confidence and comfort, never shame. Irish and UK English, euro prices with “from” and the treatment named, no em dashes, no “pain-free” or result guarantees, finance only with the provider named and terms available, and urgency only when an offer really ends.</div>
<div class="abs" style="left:80px;top:430px;width:1480px">{rows}</div>""", 7, 'Tone of voice')


def applications():
    return page('stone', f"""
<div class="abs h" style="left:80px;top:130px;font-size:80px;width:560px">In <em>use</em></div>
<div class="abs body dim" style="left:80px;top:250px;width:520px"><p>Meta statics: Linen or Navy ground, the logo top left or top centre, a Plex Sans headline with its serif-italic turn, a real team or family photo (in the heart frame or a rounded card), ticks for the proof points, and the website’s button.</p>
<p>Name the clinic or area a campaign is for. Stories keep the logo and copy out of the top 250px and bottom 340px.</p></div>
<div class="abs" style="left:680px;top:150px">{ad_square(0.68)}</div>
<div class="abs label" style="left:680px;top:900px;font-size:11px;opacity:.6">Feed 1:1</div>
<div class="abs" style="left:1440px;top:110px">{ad_story(0.43)}</div>
<div class="abs label" style="left:1440px;top:950px;font-size:11px;opacity:.6">Story 9:16</div>""", 8, 'Applications')


def close():
    return page('navy', f"""
<div class="abs" style="left:1240px;top:300px;opacity:.07">{mark(900, LINEN)}</div>
<div class="abs" style="left:160px;top:380px">{logo(620, LINEN)}</div>
<div class="abs h" style="left:164px;top:560px;font-size:40px">Gain confidence <em>in your smile.</em></div>
<div class="abs small" style="left:164px;top:640px;opacity:.7">Artane · Balbriggan · Castleknock · Dublin 2 · Kildare · Kilkenny · Kimmage · Maynooth</div>""", dark=True)


def main():
    pages = [cover(), story(), logo_page(), colour(), typography(), elements(), photography(), voice(), applications(), close()]
    head = f'<!doctype html><html lang="en-IE"><head><meta charset="utf-8"><title>Dentistry.ie Brand Guidelines</title><style>{CSS}</style>'
    body = f'</head><body>{"".join(pages)}</body></html>'
    (HERE / 'guideline.html').write_text(head + body)
    (HERE / 'guideline-capture.html').write_text(head + '<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>' + body)
    print('pages', len(pages))


if __name__ == '__main__':
    main()
