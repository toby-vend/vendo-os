"""Woburn Sands Dental Practice brand guideline: HTML harness for Figma capture.

Sources (checked 20 Oct 2026):
- Logo: Drive "Woburn Sands Full Colour.png" (1-P_OcR85aSXYJzoSMY-JQXQqT8eYGXbr, Content Assets /
  Pictures), PNG only. No white file on Drive, so logo-white.png is a true white made by keeping the
  PNG's alpha and setting every pixel white (make_assets.py). The horizontal white lockup is the site
  header SVG (woburnsandsdentalpractice.co.uk/wp-content/uploads/2022/06/head-logo2-1.svg) with all
  fills set to white, which is how the July 2026 Meta statics carry it. House, crown and crown-rule
  pieces are straight crops of the PNG, never redrawn.
- Kana link: the crown between the rules is the Kana Health Group crown (Drive KHG logos,
  12ZDnRZINKVLujO6M_CsAo8K89lRxp-Lb); the About page says "We are proudly a part of The Kana Health Group".
- Palette: site stylesheet (css/stylesheet.css) primary #1D6340 (162 uses), gold #BB9B31, sage
  #ABC4B7 (footer). Logo artwork samples: green #026634, gold #BE9E5A, house line #595958. The July
  2026 Kana_Woburn_Sands_FB statics (Drive Meta Ads / New Meta Statics for Approval) run on #19643F
  with a #DCE7E2 button and #396735 crown cards.
- Lime walls: the waiting room and old window vinyl are lime green. That is the interior scheme, not
  the brand (logo, sign panels, website and ads are all forest green + gold), so it is not in the palette.
- Type: the July statics use Manrope Bold headlines with an Instrument Serif Italic turn (matched by
  render, 20 Oct 2026). The website uses Neutra Text (commercial, not on Google Fonts) for headings and
  Poppins for body; Jost stands in for Neutra on small caps labels.
- Photos: Joe Goodchild's July 2026 shoot, assets/photos (gitignored); the harness uses
  assets/photos/web/ (1800px copies, s = practice set, p = portrait set). Nobody is named.
- Facts: 16 Theydon Ave, Woburn Sands, Milton Keynes MK17 8PL; 01908 282428; Mon to Fri 8.00am to
  5.30pm (site header + opening times block). 4.8 from 403 Google reviews (Google Maps embed on the
  homepage, rendered 20 Oct 2026). Ground-floor surgeries, wheelchair access, digital radiography
  (About page). Areas: About page (Woburn, Bletchley, Middleton...) + site location pages (Cranfield,
  Salford) + Vendo catchment report July 2026 (Aspley Guise, Bow Brickhill, Wavendon, Kents Hill).
  "Coming since 1995" is from a published homepage testimonial. Saturday is left out: the site says
  8.15am to 1.45pm, Google says closed (catchment report), unresolved.

Usage: python3 build_guideline.py  ->  guideline.html + guideline-capture.html (Figma capture)
"""
from pathlib import Path

HERE = Path(__file__).parent

GREEN, GOLD, WHITE, SAGE, MIST, SKETCH = '#1D6340', '#BE9E5A', '#FFFFFF', '#ABC4B7', '#DCE7E2', '#595958'
DEEP, FERN, INK, PAPER = '#144A30', '#396735', '#10261B', '#F3F6F4'
STOP = '#B5523F'
G = '29,99,64'  # GREEN as rgb for washes


def img(name, w, extra=''):
    return f'<img src="assets/{name}" style="display:block;width:{w}px;{extra}">'


def logo(w, white=False):
    return img('logo-white.png' if white else 'logo-colour.png', w)


def hlogo(w):
    return img('logo-h-white.png', w)


def house(w, white=False, extra=''):
    return img('house-white.png' if white else 'house-colour.png', w, extra)


def crown(w, white=True, extra=''):
    return img('crown-white.png' if white else 'crown-colour.png', w, extra)


def crown_rule(w, white=False):
    return img('crown-rule-white.png' if white else 'crown-rule-colour.png', w)


CSS = f"""
@font-face{{font-family:'Manrope';src:url('assets/fonts/Manrope.ttf');font-weight:200 800;font-style:normal}}
@font-face{{font-family:'Instrument Serif';src:url('assets/fonts/InstrumentSerif-Italic.ttf');font-weight:400;font-style:italic}}
@font-face{{font-family:'Instrument Serif';src:url('assets/fonts/InstrumentSerif-Regular.ttf');font-weight:400;font-style:normal}}
@font-face{{font-family:'Jost';src:url('assets/fonts/Jost.ttf');font-weight:100 900;font-style:normal}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:#c4d2ca;font-family:'Manrope',sans-serif;font-weight:400;color:{INK};display:flex;flex-direction:column;gap:120px;padding:120px;width:2160px;-webkit-font-smoothing:antialiased}}
.page{{position:relative;width:1920px;height:1080px;overflow:hidden;background:{WHITE}}}
.green{{background:{GREEN};color:{WHITE}}} .paper{{background:{PAPER}}}
.abs{{position:absolute}}
.h{{font-weight:700;letter-spacing:-.015em;line-height:1.1;color:{GREEN}}}
.green .h{{color:{WHITE}}}
.h em{{font-family:'Instrument Serif',serif;font-style:italic;font-weight:400;letter-spacing:0;color:{GOLD};font-size:1.12em;line-height:1}}
.green .h em{{color:{MIST}}}
.label{{font-family:'Jost',sans-serif;font-weight:500;font-size:14px;letter-spacing:.22em;text-transform:uppercase}}
.body{{font-size:19px;line-height:1.7}} .body p+p{{margin-top:14px}}
.small{{font-size:15px;line-height:1.6}}
.dim{{opacity:.82}}
.ph{{position:absolute;overflow:hidden}}
.ph img{{width:100%;height:100%;object-fit:cover;display:block}}
.full{{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}}
.btn{{display:inline-flex;align-items:center;justify-content:center;background:{MIST};color:{INK};font-weight:600;border-radius:4px;white-space:nowrap}}
.card{{display:flex;align-items:center;border:1.5px solid rgba(255,255,255,.75);background:{FERN};border-radius:6px;color:{WHITE};font-weight:600}}
.foot{{position:absolute;left:80px;right:80px;bottom:44px;display:flex;justify-content:space-between}}
.swatch{{position:absolute;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;padding:28px}}
.rule{{height:1px;background:{SAGE}}}
"""

PIN = '<svg width="{s}" height="{s}" viewBox="0 0 24 24" style="display:block;flex:none"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2z" fill="currentColor"/></svg>'
STAR = '<svg width="{s}" height="{s}" viewBox="0 0 24 24" style="display:block"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill="{c}"/></svg>'
ADDRESS = '16 Theydon Avenue, Woburn Sands, Milton Keynes, MK17 8PL'
CARDS = ['Detailed dental examination', 'Ground-floor surgeries', 'Membership plans available']


def btn(text, size, padx, pady):
    return f'<div class="btn" style="font-size:{size}px;padding:{pady}px {padx}px">{text}</div>'


def cards(items, size, padx, pady, gap, icon):
    return ''.join(f'<div class="card" style="font-size:{size}px;padding:{pady}px {padx}px;gap:{icon * .6}px;margin-top:{gap if i else 0}px">{crown(icon)}{t}</div>' for i, t in enumerate(items))


def address(size, colour=WHITE, rule=True):
    r = f'<div style="height:1px;background:{colour};opacity:.45;margin-bottom:{size * 1.3}px"></div>' if rule else ''
    return f'<div style="color:{colour}">{r}<div style="display:flex;align-items:center;gap:{size * .6}px;font-size:{size}px;font-weight:500">{PIN.format(s=round(size * 1.3))}{ADDRESS}</div></div>'


def proof(size, colour=GREEN, star=GOLD):
    stars = ''.join(STAR.format(s=round(size * 1.1), c=star) for _ in range(5))
    return f'<div style="display:flex;align-items:center;gap:{size * .5}px;color:{colour};font-size:{size}px;font-weight:600"><div style="display:flex;gap:2px">{stars}</div>4.8 from 403 Google reviews</div>'


def wash(direction='180deg', a=.92, b=.35):
    return f'<div class="abs" style="inset:0;background:linear-gradient({direction},rgba({G},{a}) 0%,rgba({G},{b}) 100%)"></div>'


def page(cls, body, n=None, title=None, dark=False):
    c = WHITE if dark else GREEN
    head = ''
    if title:
        head = f'<div class="abs label" style="left:80px;top:62px;color:{GOLD}">{n:02d}</div><div class="abs label" style="left:130px;top:62px;color:{c};opacity:.8">{title}</div>'
    foot = f'<div class="foot label" style="font-size:11px;color:{c};opacity:.55"><span>woburnsandsdentalpractice.co.uk</span><span>Brand guidelines · 2026</span></div>'
    return f'<section class="page {cls}">{head}{body}{foot}</section>'


def ph(src, x, y, w, h, pos='50% 50%', radius=0):
    return f'<div class="ph" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;border-radius:{radius}px"><img src="assets/photos/web/{src}" style="object-position:{pos}"></div>'


# ---------- ads in the system (Applications page) ----------

def ad_square(s):
    return f"""<div style="position:relative;width:{1080 * s}px;height:{1080 * s}px;overflow:hidden;background:{GREEN}">
<div class="ph" style="left:{480 * s}px;top:0;width:{600 * s}px;height:{1080 * s}px"><img src="assets/photos/web/p9.jpg" style="object-position:50% 50%"></div>
<div class="abs" style="inset:0;background:linear-gradient(90deg,rgba({G},1) 0%,rgba({G},1) 46%,rgba({G},0) 68%)"></div>
<div class="abs" style="left:{70 * s}px;top:{70 * s}px">{hlogo(330 * s)}</div>
<div class="abs h" style="left:{70 * s}px;top:{250 * s}px;width:{540 * s}px;font-size:{62 * s}px;color:{WHITE}">A kind and caring <em style="color:{MIST}">approach</em></div>
<div class="abs" style="left:{70 * s}px;top:{520 * s}px;width:{520 * s}px">{cards(CARDS, 24 * s, 22 * s, 16 * s, 14 * s, 30 * s)}</div>
<div class="abs" style="left:{70 * s}px;top:{830 * s}px">{btn('Book Your Appointment', 26 * s, 44 * s, 24 * s)}</div>
<div class="abs" style="left:{70 * s}px;right:{70 * s}px;top:{975 * s}px">{address(17 * s, WHITE, False)}</div>
</div>"""


def ad_story(s):
    return f"""<div style="position:relative;width:{1080 * s}px;height:{1920 * s}px;overflow:hidden;background:{GREEN}">
<img class="abs" src="assets/photos/web/p7.jpg" style="left:0;top:{360 * s}px;width:{1080 * s}px;height:{1921 * s}px;display:block">
<div class="abs" style="inset:0;background:linear-gradient(180deg,rgba({G},1) 0%,rgba({G},1) 44%,rgba({G},.3) 56%,rgba({G},0) 63%)"></div>
<div class="abs" style="left:0;right:0;top:{260 * s}px;display:flex;justify-content:center">{logo(330 * s, True)}</div>
<div class="abs h" style="left:{60 * s}px;right:{60 * s}px;top:{620 * s}px;text-align:center;font-size:{70 * s}px;color:{WHITE}">Your dentist in <em style="color:{MIST}">Woburn Sands</em></div>
<div class="abs" style="left:0;right:0;top:{750 * s}px;display:flex;justify-content:center">{proof(26 * s, WHITE)}</div>
<div class="abs" style="left:0;right:0;top:{1490 * s}px;display:flex;justify-content:center">{btn('Book Your Appointment', 30 * s, 54 * s, 28 * s)}</div>
</div>"""


# ---------- pages ----------

def cover():
    return page('green', f"""
<img class="full" src="assets/photos/web/s11-dup1.jpg" style="object-position:50% 45%">
<div class="abs" style="inset:0;background:linear-gradient(90deg,rgba({G},.98) 0%,rgba({G},.95) 40%,rgba({G},.3) 100%)"></div>
<div class="abs" style="left:160px;top:200px">{logo(500, True)}</div>
<div class="abs label" style="left:164px;top:760px;font-size:22px;color:{WHITE}">Brand guidelines</div>
<div class="abs label" style="left:164px;top:808px;color:{MIST}">Woburn Sands Dental Practice · Milton Keynes · A Kana Health Group practice</div>""", dark=True)


def story():
    return page('', f"""
<div class="abs h" style="left:80px;top:150px;width:860px;font-size:80px">A kind and caring <em>approach</em></div>
<div class="abs body dim" style="left:80px;top:390px;width:760px">
<p>Woburn Sands Dental Practice is a family-oriented private practice on Theydon Avenue, in a single-storey building set back among trees. Its ground-floor surgeries care for the whole family, from check-ups and hygiene to implants, straightening, cosmetic work and facial aesthetics.</p>
<p>The village is settled and a little older than the rest of Milton Keynes, and many patients have stayed for decades. Others come in from Aspley Guise, Bow Brickhill, Cranfield and Salford, over the Bedfordshire line. They want a dentist who knows them, explains things and never rushes.</p></div>
<div class="abs" style="left:80px;top:800px;width:780px">
  <div class="label" style="color:{GOLD}">Brand idea</div>
  <div class="h" style="font-size:38px;margin-top:14px">Gentle, personal care from a team that <em>knows you</em>.</div></div>
{ph('s24.jpg', 980, 150, 520, 780, '50% 40%')}
<div class="abs" style="left:1550px;top:150px;width:300px">
  <div class="label" style="color:{GOLD}">What sets us apart</div>
  <div class="small" style="margin-top:18px;line-height:2.1">Open weekdays, 8am to 5.30pm<br>Ground-floor, step-free surgeries<br>Digital X-rays<br>Patients here since 1995</div>
  <div class="rule" style="margin:34px 0"></div>
  <div class="label" style="color:{GOLD}">Proof</div>
  <div style="margin-top:16px">{proof(15)}</div>
  <div class="rule" style="margin:34px 0"></div>
  <div class="label" style="color:{GOLD}">Areas served</div>
  <div class="small" style="margin-top:18px;line-height:2.1">Woburn Sands · Aspley Guise<br>Bow Brickhill · Wavendon<br>Woburn · Cranfield<br>Salford · Kents Hill</div>
</div>""", 1, 'Who we are')


def logo_page():
    misuse = [
        ('Stretched', f'<div style="transform:scaleX(1.55)">{logo(78)}</div>'),
        ('Recoloured lime', f'<div style="filter:hue-rotate(-55deg) saturate(2.6) brightness(1.35)">{logo(110)}</div>'),
        ('Rotated', f'<div style="transform:rotate(-12deg)">{logo(110)}</div>'),
        ('Busy photo, no wash', f'<img class="full" src="assets/photos/web/s5.jpg"><div style="position:relative">{logo(110, True)}</div>'),
    ]
    mis = ''.join(f"""<div style="width:262px;height:160px;background:{PAPER};position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden">{x}
<svg class="abs" style="left:0;top:0" width="262" height="160"><line x1="16" y1="146" x2="246" y2="14" stroke="{STOP}" stroke-width="2.5"/></svg>
<div class="abs label" style="left:16px;top:14px;font-size:10px;color:{STOP};background:rgba(255,255,255,.85);padding:2px 6px">{t}</div></div>""" for t, x in misuse)
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:72px">The <em>logo</em></div>
<div class="abs body dim" style="left:80px;top:250px;width:540px"><p>A hand-drawn sketch of the practice building over a serif Woburn Sands, then the Kana Health Group crown between two fine rules, above DENTAL PRACTICE in Crown Gold.</p>
<p>Clear space on every side equals the height of the crown. Minimum width is 120px on screen, 30mm in print.</p>
<p>Use full colour on white and the all-white logo on Woburn Green or washed photography. Ads use the horizontal white lockup from the website. The house sketch can stand alone as a watermark, the crown as a bullet. PNG only on Drive: crop from the files, never redraw or retype.</p></div>
<div class="abs" style="left:700px;top:130px;width:1140px;height:430px;background:{WHITE};border:1px solid {PAPER};display:flex;align-items:center;justify-content:center">
  <div style="position:relative;padding:34px 46px;border:1.5px dashed {SAGE}">{logo(330)}</div></div>
<div class="abs" style="left:700px;top:590px;width:270px;height:150px;background:{WHITE};border:1px solid {PAPER};display:flex;align-items:center;justify-content:center">{logo(130)}</div>
<div class="abs" style="left:990px;top:590px;width:270px;height:150px;background:{GREEN};display:flex;align-items:center;justify-content:center">{logo(130, True)}</div>
<div class="abs" style="left:1280px;top:590px;width:270px;height:150px;overflow:hidden"><img class="full" src="assets/photos/web/s22.jpg">{wash('180deg', .88, .62)}<div class="abs" style="inset:0;display:flex;align-items:center;justify-content:center">{hlogo(210)}</div></div>
<div class="abs" style="left:1570px;top:590px;width:270px;height:150px;background:{PAPER};display:flex;align-items:center;justify-content:center;gap:34px">{house(120)}{crown(46, False)}</div>
<div class="abs label" style="left:700px;top:752px;font-size:10px;opacity:.7">Full colour on white</div>
<div class="abs label" style="left:990px;top:752px;font-size:10px;opacity:.7">White on Woburn Green</div>
<div class="abs label" style="left:1280px;top:752px;font-size:10px;opacity:.7">Horizontal, on a green wash</div>
<div class="abs label" style="left:1570px;top:752px;font-size:10px;opacity:.7">House sketch · Kana crown</div>
<div class="abs label" style="left:700px;top:800px;color:{GOLD}">Misuse</div>
<div class="abs" style="left:700px;top:832px;display:flex;gap:24px">{mis}</div>""", 2, 'Logo')


def colour():
    sw = [
        ('Woburn Green', GREEN, 'Main colour: grounds, washes, headlines', WHITE, 80, 150, 580, 420, False),
        ('Crown Gold', GOLD, 'The crown and caps. Headline turn on white', WHITE, 680, 150, 580, 420, False),
        ('White', WHITE, 'Canvas and type on Green', GREEN, 1280, 150, 560, 420, True),
        ('Mist', MIST, 'Buttons, and the turn on Green', INK, 80, 590, 420, 280, False),
        ('Sage', SAGE, 'Soft grounds, rules, the website footer', INK, 520, 590, 420, 280, False),
        ('Sketch Grey', SKETCH, 'The house line only', WHITE, 960, 590, 420, 280, False),
    ]
    sws = ''.join(f"""<div class="swatch" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;background:{c};color:{t};{'border:1px solid ' + PAPER + ';' if b else ''}">
<div style="font-weight:700;font-size:{44 if h > 300 else 30}px">{n}</div><div class="label" style="font-size:12px;margin-top:10px">{c}</div><div class="small" style="margin-top:6px;opacity:.85;font-size:14px">{u}</div></div>""" for n, c, u, t, x, y, w, h, b in sw)
    return page('', f"""{sws}
<div class="abs" style="left:1400px;top:590px;width:440px;height:280px;display:flex">
  <div style="flex:50;background:{GREEN}"></div><div style="flex:28;background:{WHITE};border:1px solid {PAPER}"></div><div style="flex:10;background:{MIST}"></div><div style="flex:8;background:{SAGE}"></div><div style="flex:4;background:{GOLD}"></div></div>
<div class="abs label" style="left:1400px;top:882px;font-size:11px;opacity:.7">Balance · 50 / 28 / 10 / 8 / 4</div>
<div class="abs small dim" style="left:80px;top:900px;width:1240px">Woburn Green leads, as it does on the sign, the website and the current ads. Crown Gold stays small, as in the logo. The lime-green waiting room walls are the interior scheme, not the brand: photograph them as they are, but never use lime for type, panels or buttons. Crown cards use Fern {FERN} with a white hairline.</div>""", 3, 'Colour')


def typography():
    return page('', f"""
<div class="abs" style="left:80px;top:130px;width:1080px">
  <div class="label" style="color:{GOLD}">Headline · Manrope Bold 700 · turn in Instrument Serif Italic</div>
  <div class="h" style="font-size:104px;margin-top:22px;line-height:1.08">Looking for a dentist in <em>Woburn Sands?</em></div>
  <div class="small dim" style="margin-top:24px;width:860px">Short and plain-spoken, sentence case. The place or the feeling goes in the serif italic: Crown Gold on white, Mist on Green. It echoes the serif in the logo, and it is how the practice's current ads already read.</div>
</div>
<div class="abs" style="left:80px;top:680px;width:520px">
  <div class="label" style="color:{GOLD}">Body · Manrope Regular 400</div>
  <div class="body dim" style="margin-top:14px">Whether you are visiting for a routine check-up or more extensive dental treatment, our friendly team will help you feel at ease.</div>
</div>
<div class="abs" style="left:680px;top:680px;width:480px">
  <div class="label" style="color:{GOLD}">Label · Jost Medium · caps · +22%</div>
  <div class="label" style="margin-top:20px;font-size:18px;color:{GREEN}">Woburn Sands · Milton Keynes</div>
  <div class="label" style="color:{GOLD};margin-top:46px">Button · Manrope SemiBold · title case</div>
  <div style="margin-top:14px">{btn('Book Your Appointment', 18, 34, 18)}</div>
</div>
<div class="abs green" style="left:1240px;top:130px;width:600px;height:800px;padding:56px">
  <div class="label" style="color:{MIST}">List · Manrope SemiBold · crown bullet</div>
  <div style="margin-top:30px">{cards(CARDS, 22, 22, 16, 16, 28)}</div>
  <div class="small" style="margin-top:28px;opacity:.75">The website sets headings in Neutra Text, a paid font. Jost stands in for it on labels; ads and print use Manrope.</div>
  <div class="label" style="color:{MIST};margin-top:56px">Numerals · Manrope ExtraLight</div>
  <div style="display:flex;gap:34px;margin-top:18px;font-weight:200;font-size:104px;line-height:1;color:{MIST}"><span>4.8</span><span style="color:{WHITE}">403</span></div>
</div>""", 4, 'Typography')


def elements():
    return page('', f"""
<div class="abs" style="left:80px;top:130px;width:520px;height:440px;overflow:hidden">
  <img class="full" src="assets/photos/web/s53.jpg" style="object-position:78% 40%">
  <div class="abs" style="inset:0;background:linear-gradient(90deg,rgba({G},.96) 0%,rgba({G},.72) 38%,rgba({G},0) 64%)"></div>
  <div class="abs h" style="left:36px;top:150px;width:260px;font-size:40px;color:{WHITE}">Green <em style="color:{MIST}">wash</em></div>
</div>
<div class="abs label" style="left:80px;top:584px;font-size:10px;opacity:.65">Woburn Green wash · 95% to clear, behind every headline on a photo</div>
<div class="abs green" style="left:640px;top:130px;width:520px;height:440px;padding:60px 56px">
  {cards(CARDS, 20, 20, 15, 14, 26)}
</div>
<div class="abs label" style="left:640px;top:584px;font-size:10px;opacity:.65">Crown cards · Fern fill, white hairline, crown bullet</div>
<div class="abs" style="left:1200px;top:130px;width:640px;height:440px;background:{PAPER};overflow:hidden">
  <div class="abs" style="left:330px;top:30px;opacity:.22">{house(470)}</div>
  <div class="abs" style="left:60px;top:150px">{crown_rule(300)}</div>
  <div class="abs label" style="left:60px;top:200px;font-size:12px;color:{GREEN}">Crown rule · from the logo</div>
</div>
<div class="abs label" style="left:1200px;top:584px;font-size:10px;opacity:.65">House sketch watermark at 15–25% off an edge · crown rule as a divider</div>
<div class="abs green" style="left:80px;top:650px;width:1080px;height:260px;padding:56px 50px">
  {address(22)}
  <div style="margin-top:34px">{proof(20, WHITE)}</div>
</div>
<div class="abs label" style="left:80px;top:924px;font-size:10px;opacity:.65">Address strip with hairline, and review proof · Crown Gold stars</div>
<div class="abs" style="left:1200px;top:650px;width:640px;height:260px;background:{GREEN};padding:44px 50px">
  <div class="label" style="color:{MIST}">Call to action</div>
  <div style="display:flex;gap:20px;margin-top:30px;align-items:center">{btn('Book Your Appointment', 18, 30, 18)}{btn('Book Online', 18, 30, 18)}</div>
  <div class="small" style="margin-top:24px;color:{WHITE};opacity:.75">Mist fill, Ink text, 4px corners. Say what happens next.</div></div>""", 5, 'Graphic elements')


def photography():
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:72px;width:520px">Our team, <em>our practice</em></div>
<div class="abs body dim" style="left:80px;top:330px;width:500px">
<p>Real people, in the real practice. Team portraits in the surgeries and at the practice sign, the timber and brick building among the trees, and the bright waiting room.</p>
<p>The lime walls belong in the photos, not in the layout. Name a team member only once their name is confirmed with the practice.</p></div>
{ph('s43.jpg', 640, 130, 380, 520, '50% 40%')}
{ph('s22.jpg', 1050, 130, 790, 250, '50% 55%')}
{ph('s9.jpg', 1050, 400, 385, 250, '50% 50%')}
{ph('s14.jpg', 1455, 400, 385, 250, '40% 50%')}
<div class="abs paper" style="left:640px;top:690px;width:1200px;height:250px;padding:40px 50px;display:flex;gap:60px">
  <div style="width:520px"><div class="label" style="color:{GREEN}">Look for</div><div class="small" style="margin-top:12px">Warm eye contact and natural smiles, the surgery window or practice sign softly behind. Bright, even light. Leave the left or top third quiet for a green wash and headline.</div></div>
  <div style="width:520px"><div class="label" style="color:{STOP}">Avoid</div><div class="small" style="margin-top:12px">Generic stock families, instruments, needles, gloved hands in mouths, over-whitened teeth, and before-and-afters without the patient's written consent.</div></div></div>""", 6, 'Photography')


def voice():
    pairs = [('Kind', 'We’ll talk you through every option first.', 'Pain-free dentistry, guaranteed!'),
             ('Honest', 'Clear fees and a plan that suits you.', 'The cheapest dentist in Milton Keynes.'),
             ('Familiar', 'Families have trusted us for decades.', 'Don’t miss out! Book NOW!'),
             ('Local', 'On Theydon Avenue, in Woburn Sands.', 'The UK’s number one dental practice.')]
    rows = ''.join(f"""<div style="display:flex;gap:30px;padding:22px 0;border-top:1px solid {SAGE}">
<div class="h" style="width:260px;font-size:38px"><em>{t}</em></div>
<div style="width:600px"><div class="label" style="font-size:10px;color:{GOLD}">We say</div><div class="body" style="margin-top:6px">{y}</div></div>
<div style="width:540px;opacity:.45"><div class="label" style="font-size:10px">We don’t say</div><div class="body" style="margin-top:6px;text-decoration:line-through">{n}</div></div></div>""" for t, y, n in pairs)
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:80px">How <em>we sound</em></div>
<div class="abs body dim" style="left:80px;top:250px;width:1500px">Gentle, caring and personal, like the village dentist who remembers you. Patients should feel at ease and never rushed. UK English, no em dashes, no outcome guarantees or “pain-free” claims, no finance figures without FCA wording, and urgency only when an offer is genuinely live.</div>
<div class="abs" style="left:80px;top:400px;width:1450px">{rows}</div>""", 7, 'Tone of voice')


def applications():
    return page('paper', f"""
<div class="abs h" style="left:80px;top:130px;font-size:80px;width:560px">In <em>use</em></div>
<div class="abs body dim" style="left:80px;top:250px;width:520px"><p>Meta statics: a real practice photo under a Woburn Green wash, the white logo, a Manrope headline with its serif italic turn, crown cards, the Mist button and the address strip.</p>
<p>Stories keep the logo and copy out of the top 250px and bottom 340px. Review proof uses the live Google count, rechecked before each batch.</p></div>
<div class="abs" style="left:680px;top:150px">{ad_square(0.68)}</div>
<div class="abs label" style="left:680px;top:900px;font-size:11px;opacity:.6">Feed 1:1</div>
<div class="abs" style="left:1440px;top:110px">{ad_story(0.43)}</div>
<div class="abs label" style="left:1440px;top:950px;font-size:11px;opacity:.6">Story 9:16</div>""", 8, 'Applications')


def close():
    return page('green', f"""
<div class="abs" style="left:1100px;top:330px;opacity:.13">{house(900, True)}</div>
<div class="abs" style="left:160px;top:220px">{logo(420, True)}</div>
<div class="abs label" style="left:164px;top:720px;font-size:20px;color:{WHITE}">A kind and caring approach</div>
<div class="abs small" style="left:164px;top:770px;opacity:.75">{ADDRESS} · 01908 282428</div>""", dark=True)


def main():
    pages = [cover(), story(), logo_page(), colour(), typography(), elements(), photography(), voice(), applications(), close()]
    head = f'<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>Woburn Sands Brand Guidelines</title><style>{CSS}</style>'
    body = f'</head><body>{"".join(pages)}</body></html>'
    (HERE / 'guideline.html').write_text(head + body)
    (HERE / 'guideline-capture.html').write_text(head + '<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>' + body)
    print('pages', len(pages))


if __name__ == '__main__':
    main()
