"""Concept Dental brand guideline: HTML harness for Figma capture.

Sources (19 Oct 2026):
- Concept Brand Sheet.png (Drive > Concept Dental > Logos): palette + Montserrat. The sheet labels Moss
  as "C3BDAO" (letter O); the swatch is #C3BDA0.
- Logo SVGs: conceptdental.co.uk/wp-content/uploads/2026/09/concept-dental-logo.svg (full lockup)
  and 2026/08/Group-10.svg (CD monogram). Same artwork as the Drive master.
- Website conceptdental.co.uk: "Calm, Expert Dentistry", five-step first visit, tone of voice.
- Photos: website imagery (stock, temporary until the clinic is shot). assets/photos is gitignored.

Usage: python3 build_guideline.py  ->  guideline.html + guideline-capture.html (Figma capture)
"""
import re
from pathlib import Path

HERE = Path(__file__).parent
A = HERE / 'assets'

BLACK, TAUPE, COFFEE, MOSS, DUNE, VANILLA = '#252525', '#CAB39C', '#463A34', '#C3BDA0', '#E6DDCB', '#FCF6EE'
TAUPE_D, WHITE = '#9C8670', '#FFFFFF'

_LOGO = re.sub(r'^<svg[^>]*>', '', (A / 'logo-site.svg').read_text().strip()).rsplit('</svg>', 1)[0]
_MARK = re.sub(r'^<svg[^>]*>', '', (A / 'group-10.svg').read_text().strip()).rsplit('</svg>', 1)[0]


def logo(width, colour=COFFEE):
    inner = _LOGO.replace('#FCF6EE', colour)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 198 94" width="{width}" height="{round(width * 94 / 198, 1)}" fill="none" style="display:block">{inner}</svg>'


def mark(width, colour=COFFEE):
    inner = _MARK.replace('#FCF6EE', colour)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 35 37" width="{width}" height="{round(width * 37 / 35, 1)}" fill="none" style="display:block">{inner}</svg>'


CSS = f"""
@font-face{{font-family:'Montserrat';src:url('assets/fonts/Montserrat.ttf');font-weight:100 900;font-style:normal}}
@font-face{{font-family:'Montserrat';src:url('assets/fonts/Montserrat-Italic.ttf');font-weight:100 900;font-style:italic}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:#d9d2c6;font-family:'Montserrat',sans-serif;font-weight:400;color:{COFFEE};display:flex;flex-direction:column;gap:120px;padding:120px;width:2160px;-webkit-font-smoothing:antialiased}}
.page{{position:relative;width:1920px;height:1080px;overflow:hidden;background:{VANILLA}}}
.coffee{{background:{COFFEE};color:{VANILLA}}} .dune{{background:{DUNE}}}
.abs{{position:absolute}}
.h{{font-weight:300;letter-spacing:-.015em;line-height:1.12}}
.h em{{font-style:italic;font-weight:400}}
.title{{font-weight:500;text-transform:uppercase;letter-spacing:.22em;line-height:1.2}}
.label{{font-weight:600;font-size:13px;letter-spacing:.24em;text-transform:uppercase}}
.body{{font-size:19px;line-height:1.7;font-weight:400}} .body p+p{{margin-top:14px}}
.small{{font-size:15px;line-height:1.6;font-weight:400}}
.dim{{opacity:.78}}
.ph{{position:absolute;overflow:hidden}}
.ph img{{width:100%;height:100%;object-fit:cover;display:block}}
.arch{{border-radius:999px 999px 0 0}}
.full{{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}}
.btn{{display:inline-flex;align-items:center;gap:14px;background:{COFFEE};color:{VANILLA};font-weight:600;text-transform:uppercase;letter-spacing:.16em;border-radius:999px;white-space:nowrap}}
.btn.light{{background:{VANILLA};color:{COFFEE}}}
.foot{{position:absolute;left:80px;right:80px;bottom:44px;display:flex;justify-content:space-between}}
.swatch{{position:absolute;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;padding:28px}}
.rule{{height:1px;background:{TAUPE}}}
"""

ARROW = '<svg width="{s}" height="{s}" viewBox="0 0 16 16" fill="none" style="display:block"><path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'


def btn(text, size, padx, pady, light=False):
    return f'<div class="btn{" light" if light else ""}" style="font-size:{size}px;padding:{pady}px {padx}px">{text}{ARROW.format(s=round(size * 1.1))}</div>'


def seal(w, dark=False):
    """Founding-patient seal: £25 exam + scan, first 100 (offer confirmed live by Toby, 19 Oct 2026)."""
    bg, fg = (COFFEE, VANILLA) if dark else (VANILLA, COFFEE)
    r = w / 2
    return f'''<div style="position:relative;width:{w}px;height:{w}px;border-radius:50%;background:{bg};color:{fg};border:1px solid {TAUPE};display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
<div style="position:absolute;inset:{w * .05}px;border-radius:50%;border:1px solid {TAUPE}"></div>
<div class="label" style="font-size:{w * .046}px;letter-spacing:.16em">Founding patient</div>
<div style="font-weight:300;font-size:{w * .3}px;line-height:1;margin-top:{w * .03}px">£25</div>
<div class="label" style="font-size:{w * .05}px;letter-spacing:.16em;margin-top:{w * .04}px;opacity:.8">Exam + digital scan</div>
<div class="small" style="font-size:{w * .05}px;margin-top:{w * .02}px;opacity:.6;text-decoration:line-through">£50</div></div>'''


def watermark(x, y, w, colour=DUNE, opacity=1):
    return f'<div class="abs" style="left:{x}px;top:{y}px;opacity:{opacity}">{mark(w, colour)}</div>'


def page(cls, body, n=None, title=None, dark=False):
    c = VANILLA if dark else COFFEE
    head = ''
    if title:
        head = f'<div class="abs label" style="left:80px;top:62px;color:{TAUPE if dark else TAUPE_D}">{n:02d}</div><div class="abs label" style="left:130px;top:62px;color:{c};opacity:.75">{title}</div>'
    foot = f'<div class="foot label" style="font-size:11px;color:{c};opacity:.5"><span>conceptdental.co.uk</span><span>Brand guidelines · 2026</span></div>'
    return f'<section class="page {cls}">{head}{body}{foot}</section>'


def ph(src, x, y, w, h, pos='50% 50%', arch=False, radius=0):
    cls = 'ph arch' if arch else 'ph'
    rad = '' if arch else f'border-radius:{radius}px;'
    return f'<div class="{cls}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;{rad}"><img src="assets/photos/{src}" style="object-position:{pos}"></div>'


# ---------- ads in the system (Applications page) ----------

def ad_square(s):
    return f"""<div style="position:relative;width:{1080 * s}px;height:{1080 * s}px;overflow:hidden;background:{VANILLA}">
{watermark(-120 * s, 520 * s, 640 * s, DUNE)}
<div style="position:absolute;left:{80 * s}px;top:{80 * s}px">{logo(230 * s)}</div>
<div class="h" style="position:absolute;left:{80 * s}px;top:{300 * s}px;width:{480 * s}px;font-size:{64 * s}px">Been years since you saw a dentist? <em>Start fresh.</em></div>
<div class="small" style="position:absolute;left:{80 * s}px;top:{620 * s}px;width:{440 * s}px;font-size:{24 * s}px">A brand new practice on Toton Lane, Stapleford. No history, no judgement.</div>
<div style="position:absolute;left:{80 * s}px;top:{880 * s}px">{btn('Reserve your place', 20 * s, 34 * s, 22 * s)}</div>
{ph('site-dentist-consultation-concept-dental-1.jpg', 600 * s, 120 * s, 400 * s, 840 * s, '74% 50%', arch=True)}
<div style="position:absolute;left:{700 * s}px;top:{740 * s}px">{seal(230 * s, True)}</div>
</div>"""


def ad_story(s):
    return f"""<div style="position:relative;width:{1080 * s}px;height:{1920 * s}px;overflow:hidden;background:{COFFEE};color:{VANILLA}">
{watermark(560 * s, 1560 * s, 700 * s, '#54473F')}
<div style="position:absolute;left:0;right:0;top:{270 * s}px;display:flex;justify-content:center">{logo(300 * s, VANILLA)}</div>
<div class="h" style="position:absolute;left:{110 * s}px;right:{110 * s}px;top:{470 * s}px;text-align:center;font-size:{76 * s}px">Calm, expert dentistry. <em>Now on Toton Lane.</em></div>
{ph('site-dentist-xray-review-concept-dental.jpg', 190 * s, 760 * s, 700 * s, 760 * s, '45% 50%', arch=True)}
<div style="position:absolute;left:0;right:0;top:{1490 * s}px;display:flex;justify-content:center">{btn('Reserve your place', 24 * s, 40 * s, 26 * s, light=True)}</div>
</div>"""


# ---------- pages ----------

def cover():
    return page('', f"""
{watermark(1180, -40, 900, DUNE)}
<div class="abs" style="left:160px;top:330px">{logo(640)}</div>
<div class="abs title" style="left:164px;top:700px;font-size:30px">Brand guidelines</div>
<div class="abs label" style="left:164px;top:756px;color:{TAUPE_D}">Concept Dental &amp; Implant Clinic · Stapleford, Nottingham</div>""")


def story():
    return page('', f"""
<div class="abs h" style="left:80px;top:150px;width:820px;font-size:84px">Calm, <em>expert</em> dentistry.</div>
<div class="abs body dim" style="left:80px;top:390px;width:740px">
<p>Concept Dental &amp; Implant Clinic is a new private practice at 12 Toton Lane, Stapleford, built around one thing: making patients feel genuinely at ease.</p>
<p>It looks after the whole household, from check-ups, hygiene and emergencies to cosmetic work, Invisalign and dental implants. Whether someone has been putting off treatment for years or is ready for a change, the experience is the same: unhurried, clearly explained, and at their pace.</p></div>
<div class="abs" style="left:80px;top:760px;width:760px">
  <div class="label" style="color:{TAUPE_D}">Brand idea</div>
  <div class="h" style="font-size:40px;margin-top:14px">Nothing moves forward <em>without your say-so.</em></div></div>
{ph('site-concept-dental-front-desk.jpg', 980, 150, 500, 780, '45% 50%', arch=True)}
<div class="abs" style="left:1530px;top:150px;width:310px">
  <div class="label" style="color:{TAUPE_D}">Four promises</div>
  <div class="small" style="margin-top:18px;line-height:2.1">Calm, patient-focused care<br>Experienced clinicians<br>Advanced technology<br>Transparent pricing</div>
  <div class="rule" style="margin:36px 0"></div>
  <div class="label" style="color:{TAUPE_D}">Areas served</div>
  <div class="small" style="margin-top:18px;line-height:2.1">Stapleford · Toton<br>Beeston · Bramcote<br>Sandiacre · Long Eaton</div>
</div>""", 1, 'Who we are')


def logo_page():
    misuse = [
        ('Stretched', f'<div style="transform:scaleX(1.5)">{logo(130)}</div>'),
        ('Off-palette colour', logo(180, '#2F6FD6')),
        ('Rotated', f'<div style="transform:rotate(-12deg)">{logo(170)}</div>'),
        ('Low contrast', f'<div style="position:absolute;inset:0;background:{TAUPE};display:flex;align-items:center;justify-content:center">{logo(180, MOSS)}</div>'),
    ]
    mis = ''.join(f"""<div style="width:262px;height:160px;background:{DUNE};position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden">{m}
<svg class="abs" style="left:0;top:0" width="262" height="160"><line x1="16" y1="146" x2="246" y2="14" stroke="#B5523F" stroke-width="2.5"/></svg>
<div class="abs label" style="left:16px;top:14px;font-size:10px;color:#B5523F">{t}</div></div>""" for t, m in misuse)
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:72px">The <em>logo</em></div>
<div class="abs body dim" style="left:80px;top:250px;width:520px"><p>An interlocking serif C and D above CONCEPT DENTAL in widely spaced capitals, with &amp; IMPLANT CLINIC set lighter beneath.</p>
<p>Clear space on every side equals the height of the monogram’s D. Minimum width is 140px on screen, 35mm in print.</p>
<p>The CD monogram works alone as an avatar, favicon and watermark. Use Coffee on light grounds and Vanilla on Coffee or photography. Never redraw or retype it.</p></div>
<div class="abs" style="left:700px;top:130px;width:1140px;height:430px;background:{WHITE};display:flex;align-items:center;justify-content:center">
  <div style="position:relative;padding:50px 70px;border:1.5px dashed {TAUPE}">{logo(560)}</div></div>
<div class="abs" style="left:700px;top:590px;width:270px;height:150px;background:{VANILLA};border:1px solid {DUNE};display:flex;align-items:center;justify-content:center">{logo(190)}</div>
<div class="abs" style="left:990px;top:590px;width:270px;height:150px;background:{COFFEE};display:flex;align-items:center;justify-content:center">{logo(190, VANILLA)}</div>
<div class="abs" style="left:1280px;top:590px;width:270px;height:150px;overflow:hidden"><img class="full" src="assets/photos/site-concept-dental-front-desk.jpg" style="object-position:50% 40%"><div class="abs" style="inset:0;background:rgba(70,58,52,.55)"></div><div class="abs" style="inset:0;display:flex;align-items:center;justify-content:center">{logo(190, VANILLA)}</div></div>
<div class="abs" style="left:1570px;top:590px;width:270px;height:150px;background:{DUNE};display:flex;align-items:center;justify-content:center">{mark(70)}</div>
<div class="abs label" style="left:700px;top:752px;font-size:10px;opacity:.7">Coffee on Vanilla</div>
<div class="abs label" style="left:990px;top:752px;font-size:10px;opacity:.7">Vanilla on Coffee</div>
<div class="abs label" style="left:1280px;top:752px;font-size:10px;opacity:.7">On photo, with Coffee shade</div>
<div class="abs label" style="left:1570px;top:752px;font-size:10px;opacity:.7">Monogram</div>
<div class="abs label" style="left:700px;top:800px;color:{TAUPE_D}">Misuse</div>
<div class="abs" style="left:700px;top:832px;display:flex;gap:24px">{mis}</div>""", 2, 'Logo')


def colour():
    sw = [
        ('Vanilla', VANILLA, 'Main canvas', COFFEE, 80, 150, 580, 420, True),
        ('Coffee', COFFEE, 'Type, logo, buttons, dark pages', VANILLA, 680, 150, 580, 420, False),
        ('Taupe', TAUPE, 'Accent: rules, seals, labels', COFFEE, 1280, 150, 560, 420, False),
        ('Soft Dune', DUNE, 'Secondary ground, watermark', COFFEE, 80, 590, 420, 280, False),
        ('Moss', MOSS, 'Quiet accent, cards', COFFEE, 520, 590, 420, 280, False),
        ('Black', BLACK, 'Fine print, rare contrast', VANILLA, 960, 590, 420, 280, False),
    ]
    cards = ''.join(f"""<div class="swatch" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;background:{c};color:{t};{'border:1px solid ' + DUNE + ';' if b else ''}">
<div class="h" style="font-size:{44 if h > 300 else 30}px">{n}</div><div class="label" style="font-size:11px;margin-top:10px">{c}</div><div class="small" style="margin-top:6px;opacity:.8;font-size:14px">{u}</div></div>""" for n, c, u, t, x, y, w, h, b in sw)
    return page('', f"""{cards}
<div class="abs" style="left:1400px;top:590px;width:440px;height:280px;display:flex">
  <div style="flex:60;background:{VANILLA};border:1px solid {DUNE}"></div><div style="flex:22;background:{COFFEE}"></div><div style="flex:10;background:{DUNE}"></div><div style="flex:8;background:{TAUPE}"></div></div>
<div class="abs label" style="left:1400px;top:882px;font-size:11px;opacity:.7">Balance · 60 / 22 / 10 / 8</div>
<div class="abs small dim" style="left:80px;top:900px;width:1200px">Light, warm and quiet. Vanilla carries most layouts, Coffee does the talking (type, logo, buttons), and Taupe is the fine detail. Moss and Soft Dune support; Black is reserved for small print. No pure white backgrounds and no clinical blue.</div>""", 3, 'Colour')


def typography():
    return page('', f"""
<div class="abs" style="left:80px;top:130px;width:1080px">
  <div class="label" style="color:{TAUPE_D}">Headline · Montserrat Light 300 · sentence case · italic for the turn</div>
  <div class="h" style="font-size:112px;margin-top:22px;line-height:1.06">Been years? <em>No judgement here.</em></div>
  <div class="small dim" style="margin-top:24px;width:860px">Short, calm and plain-spoken. The emotional turn of a line is set in Montserrat Italic 400. Full stop at the end.</div>
</div>
<div class="abs" style="left:80px;top:640px;width:520px">
  <div class="label" style="color:{TAUPE_D}">Body · Montserrat Regular 400</div>
  <div class="body dim" style="margin-top:14px">We create a personalised treatment plan tailored to you, with clear explanations, options and transparent written pricing.</div>
</div>
<div class="abs" style="left:680px;top:640px;width:480px">
  <div class="label" style="color:{TAUPE_D}">Label · Montserrat SemiBold · caps · +24%</div>
  <div class="label" style="margin-top:20px;font-size:18px">Step 02 · Consultation</div>
  <div class="label" style="color:{TAUPE_D};margin-top:46px">Button · Montserrat SemiBold · caps</div>
  <div style="margin-top:14px">{btn('Reserve your place', 17, 30, 18)}</div>
</div>
<div class="abs coffee" style="left:1240px;top:130px;width:600px;height:800px;padding:56px">
  <div class="label" style="color:{TAUPE}">Title · Montserrat Medium · caps · +22%</div>
  <div class="title" style="font-size:52px;margin-top:30px;line-height:1.3">This is<br>a title</div>
  <div class="small" style="margin-top:26px;opacity:.75">From the brand sheet. Echoes the spaced capitals of the logotype. Short section titles and sign-offs only, never full sentences.</div>
  <div class="label" style="color:{TAUPE};margin-top:60px">Numerals · Montserrat ExtraLight</div>
  <div style="display:flex;gap:34px;margin-top:20px;font-weight:200;font-size:110px;line-height:1;color:{TAUPE}"><span>01</span><span>02</span><span style="color:{VANILLA}">05</span></div>
</div>""", 4, 'Typography')


def elements():
    steps = ['Book', 'Consultation', 'Approval', 'Treatment', 'Aftercare']
    tl = ''.join(f'<div style="flex:1;position:relative"><div style="width:14px;height:14px;border-radius:50%;background:{COFFEE if i == 2 else VANILLA};border:1.5px solid {COFFEE}"></div><div class="label" style="font-size:11px;margin-top:16px;color:{TAUPE_D}">{i + 1:02d}</div><div class="small" style="margin-top:4px;font-size:16px">{s}</div></div>' for i, s in enumerate(steps))
    return page('', f"""
<div class="abs" style="left:80px;top:130px;width:520px;height:440px;background:{DUNE};overflow:hidden">
  {ph('site-dentist-consultation-concept-dental-1.jpg', 150, 50, 300, 390, '68% 40%', arch=True)}
</div>
<div class="abs label" style="left:80px;top:584px;font-size:10px;opacity:.65">The arch · photo frame, from the reception’s arched alcoves</div>
<div class="abs" style="left:640px;top:130px;width:520px;height:440px;background:{VANILLA};border:1px solid {DUNE};overflow:hidden">{watermark(150, 40, 420, DUNE)}</div>
<div class="abs label" style="left:640px;top:584px;font-size:10px;opacity:.65">Monogram watermark · Soft Dune, cropped off an edge</div>
<div class="abs" style="left:1200px;top:130px;width:640px;height:440px;background:{COFFEE};display:flex;align-items:center;justify-content:center;gap:50px">{seal(250)}{seal(170, True)}</div>
<div class="abs label" style="left:1200px;top:584px;font-size:10px;opacity:.65">Founding seal · the £25 exam + scan offer only, while it’s live</div>
<div class="abs" style="left:80px;top:650px;width:1080px;height:260px;background:{WHITE};padding:44px 50px">
  <div class="label" style="color:{TAUPE_D}">The five-step first visit</div>
  <div style="position:relative;display:flex;margin-top:30px"><div class="rule" style="position:absolute;left:7px;right:200px;top:7px"></div>{tl}</div></div>
<div class="abs label" style="left:80px;top:924px;font-size:10px;opacity:.65">Hairline timeline · Taupe 1px, Coffee dot marks where you are</div>
<div class="abs" style="left:1200px;top:650px;width:640px;height:260px;background:{VANILLA};border:1px solid {DUNE};padding:44px 50px">
  <div class="label" style="color:{TAUPE_D}">Call to action</div>
  <div style="display:flex;gap:20px;margin-top:30px;align-items:center">{btn('Reserve your place', 16, 28, 18)}<div class="label" style="font-size:13px;display:flex;gap:10px;align-items:center">Book online {ARROW.format(s=15)}</div></div>
  <div class="small dim" style="margin-top:26px">Coffee pill, caps, arrow on the right. It says what happens next.</div></div>""", 5, 'Graphic elements')


def photography():
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:72px;width:520px">Warm light, <em>real calm.</em></div>
<div class="abs body dim" style="left:80px;top:330px;width:500px">
<p>Soft, warm, natural light. Neutral stone, timber and linen tones that sit inside the palette. People mid-conversation, unhurried, at eye level with their dentist.</p>
<p>The images on this page are the website’s temporary imagery. Replace them with Concept Dental’s own clinic, team and patients (with consent) as soon as the practice is photographed.</p></div>
{ph('site-concept-dental-front-desk.jpg', 640, 130, 380, 520, '40% 50%', arch=True)}
{ph('site-dentist-consultation-concept-dental-1.jpg', 1050, 130, 790, 250, '60% 45%')}
{ph('site-dentist-xray-review-concept-dental.jpg', 1050, 400, 385, 250, '40% 40%')}
{ph('site-dentist-treatment-concept-dental.jpg', 1455, 400, 385, 250, '50% 45%')}
<div class="abs" style="left:640px;top:690px;width:1200px;height:250px;background:{DUNE};padding:40px 50px;display:flex;gap:60px">
  <div style="width:520px"><div class="label" style="color:{TAUPE_D}">Look for</div><div class="small" style="margin-top:12px">Eye contact and explanation, hands relaxed, natural smiles. Grade warm. Leave space for a headline on one side.</div></div>
  <div style="width:520px"><div class="label" style="color:#B5523F">Avoid</div><div class="small" style="margin-top:12px">Cold blue clinical light, close-ups of instruments, gloved hands in mouths, needles, exaggerated white teeth and anything that adds to a nervous patient’s fear.</div></div></div>""", 6, 'Photography')


def voice():
    pairs = [('Calm', 'Whenever you’re ready, we’ll be ready too.', 'Don’t wait! Book NOW before it’s too late!'),
             ('Honest', 'Clear written pricing before anything starts.', 'Unbeatable prices you won’t find anywhere else.'),
             ('Kind', 'No lectures. Nothing happens without your say-so.', 'Ashamed of your teeth? It’s time to fix them.'),
             ('Local', 'A new practice on Toton Lane, Stapleford.', 'Nottingham’s number one dentist.')]
    rows = ''.join(f"""<div style="display:flex;gap:30px;padding:22px 0;border-top:1px solid {TAUPE}">
<div class="h" style="width:240px;font-size:40px"><em>{t}</em></div>
<div style="width:600px"><div class="label" style="font-size:10px;color:{TAUPE_D}">We say</div><div class="body" style="margin-top:6px">{y}</div></div>
<div style="width:560px;opacity:.45"><div class="label" style="font-size:10px">We don’t say</div><div class="body" style="margin-top:6px;text-decoration:line-through">{n}</div></div></div>""" for t, y, n in pairs)
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:80px">How <em>we sound</em></div>
<div class="abs body dim" style="left:80px;top:250px;width:1400px">Like a good dentist talking you through it: warm, reassuring and straight about cost and what happens next. We never shame, rush or overpromise. UK English, no em dashes, no outcome guarantees, no “pain-free” claims, and urgency only when an offer really is limited.</div>
<div class="abs" style="left:80px;top:400px;width:1450px">{rows}</div>""", 7, 'Tone of voice')


def applications():
    return page('dune', f"""
<div class="abs h" style="left:80px;top:130px;font-size:80px;width:560px">In <em>use</em></div>
<div class="abs body dim" style="left:80px;top:250px;width:520px"><p>Meta statics: Vanilla or Coffee ground, the logo top left or top centre, a Montserrat Light headline with its italic turn, an arched photo, and the Coffee pill.</p>
<p>The founding seal appears only while the £25 offer is live. Stories keep the logo and copy out of the top 250px and bottom 340px.</p></div>
<div class="abs" style="left:680px;top:150px">{ad_square(0.68)}</div>
<div class="abs label" style="left:680px;top:900px;font-size:11px;opacity:.6">Feed 1:1</div>
<div class="abs" style="left:1440px;top:110px">{ad_story(0.43)}</div>
<div class="abs label" style="left:1440px;top:950px;font-size:11px;opacity:.6">Story 9:16</div>""", 8, 'Applications')


def close():
    return page('coffee', f"""
{watermark(1240, 420, 820, '#54473F')}
<div class="abs" style="left:160px;top:330px">{logo(520, VANILLA)}</div>
<div class="abs title" style="left:164px;top:660px;font-size:26px">Calm, expert dentistry</div>
<div class="abs small" style="left:164px;top:720px;opacity:.7">12 Toton Lane · Stapleford · Nottingham NG9 7HA</div>""", dark=True)


def main():
    pages = [cover(), story(), logo_page(), colour(), typography(), elements(), photography(), voice(), applications(), close()]
    head = f'<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>Concept Dental Brand Guidelines</title><style>{CSS}</style>'
    body = f'</head><body>{"".join(pages)}</body></html>'
    (HERE / 'guideline.html').write_text(head + body)
    (HERE / 'guideline-capture.html').write_text(head + '<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>' + body)
    print('pages', len(pages))


if __name__ == '__main__':
    main()
