"""MK Smiles Dental Practice brand guideline: HTML harness for Figma capture.

Sources (20 Oct 2026):
- Logo: mksmiles.co.uk/wp-content/uploads/2023/02/MK-Smiles-CMYK-Final.png (colour) and Drive
  "MK Smiles White Logo .png" (1n9AacJfCQzFuZaMylxgwfwsiqrz0nuIh). PNG only, no vector. The MK, M and
  crown-rule pieces are straight crops of those files (assets/mark-*, crown-rule-*), never redrawn.
- Palette: site Elementor globals (primary #046169, secondary #7D9F98, accent #BFA05D, #DFD1B5),
  which match the logo artwork (#006068 / #709C90 / #BC9C60 sampled). Mint #7EBBAF is the CTA fill
  on the July 2026 Kana_MK_Smiles_FB statics (Drive), the creative the client has already run.
- Type: site uses Jost 600 (headings) + Poppins (body); the July statics use Poppins SemiBold
  headlines with a light italic turn. Both Google fonts.
- Photos: Joe Goodchild's processed shoot, Frame.io "KANA PROCESSED PHOTOS / MK SMILES" (Jul 2026).
  assets/photos is gitignored; the harness uses assets/photos/web/ (1800px copies).
- Facts: 42 Montague Crescent, Brooklands, MK10 7LN (inside Brooklands Health Centre); Mon + Wed to
  7pm, Sat 8:45am-4:30pm (mksmiles.co.uk); 4.8 stars from 295 Google reviews (Google Maps embed on
  the homepage, 20 Oct 2026).

Usage: python3 build_guideline.py  ->  guideline.html + guideline-capture.html (Figma capture)
"""
from pathlib import Path

HERE = Path(__file__).parent

TEAL, SAGE, MINT, GOLD, SAND, WHITE = '#046169', '#7D9F98', '#7EBBAF', '#BFA05D', '#DFD1B5', '#FFFFFF'
DEEP, MIST, INK = '#03474D', '#EEF4F3', '#0E2A2C'
STOP = '#B5523F'


def img(name, w, extra=''):
    return f'<img src="assets/{name}" style="display:block;width:{w}px;{extra}">'


def logo(w, white=False):
    return img('logo-white.png' if white else 'logo-colour.png', w)


def mk(w, white=False, extra=''):
    return img('mark-mk-white.png' if white else 'mark-mk-colour.png', w, extra)


def m(w, white=True, extra=''):
    return img('mark-m-white.png' if white else 'mark-m-colour.png', w, extra)


def crown(w, white=False):
    return img('crown-rule-white.png' if white else 'crown-rule-colour.png', w)


CSS = f"""
@font-face{{font-family:'Poppins';src:url('assets/fonts/Poppins-Light.ttf');font-weight:300;font-style:normal}}
@font-face{{font-family:'Poppins';src:url('assets/fonts/Poppins-LightItalic.ttf');font-weight:300;font-style:italic}}
@font-face{{font-family:'Poppins';src:url('assets/fonts/Poppins-Regular.ttf');font-weight:400;font-style:normal}}
@font-face{{font-family:'Poppins';src:url('assets/fonts/Poppins-Italic.ttf');font-weight:400;font-style:italic}}
@font-face{{font-family:'Poppins';src:url('assets/fonts/Poppins-Medium.ttf');font-weight:500;font-style:normal}}
@font-face{{font-family:'Poppins';src:url('assets/fonts/Poppins-SemiBold.ttf');font-weight:600;font-style:normal}}
@font-face{{font-family:'Poppins';src:url('assets/fonts/Poppins-Bold.ttf');font-weight:700;font-style:normal}}
@font-face{{font-family:'Jost';src:url('assets/fonts/Jost.ttf');font-weight:100 900;font-style:normal}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:#c9d6d4;font-family:'Poppins',sans-serif;font-weight:400;color:{INK};display:flex;flex-direction:column;gap:120px;padding:120px;width:2160px;-webkit-font-smoothing:antialiased}}
.page{{position:relative;width:1920px;height:1080px;overflow:hidden;background:{WHITE}}}
.teal{{background:{TEAL};color:{WHITE}}} .mist{{background:{MIST}}}
.abs{{position:absolute}}
.h{{font-weight:600;letter-spacing:-.01em;line-height:1.12;color:{TEAL}}}
.teal .h{{color:{WHITE}}}
.h em{{font-style:italic;font-weight:300;color:{SAGE}}}
.teal .h em{{color:{MINT}}}
.label{{font-family:'Jost',sans-serif;font-weight:500;font-size:14px;letter-spacing:.22em;text-transform:uppercase}}
.body{{font-size:19px;line-height:1.7}} .body p+p{{margin-top:14px}}
.small{{font-size:15px;line-height:1.6}}
.dim{{opacity:.8}}
.ph{{position:absolute;overflow:hidden}}
.ph img{{width:100%;height:100%;object-fit:cover;display:block}}
.full{{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}}
.btn{{display:inline-flex;align-items:center;justify-content:center;background:{MINT};color:{INK};font-weight:500;border-radius:6px;white-space:nowrap}}
.pill{{display:flex;align-items:center;border:1.5px solid rgba(255,255,255,.55);background:rgba(255,255,255,.08);border-radius:10px;color:{WHITE};font-weight:600}}
.foot{{position:absolute;left:80px;right:80px;bottom:44px;display:flex;justify-content:space-between}}
.swatch{{position:absolute;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;padding:28px}}
.rule{{height:1px;background:{SAND}}}
"""

PIN = '<svg width="{s}" height="{s}" viewBox="0 0 24 24" style="display:block;flex:none"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2z" fill="currentColor"/></svg>'
STAR = '<svg width="{s}" height="{s}" viewBox="0 0 24 24" style="display:block"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill="{c}"/></svg>'
ADDRESS = '42 Montague Crescent, Brooklands, Milton Keynes, MK10 7LN'


def btn(text, size, padx, pady):
    return f'<div class="btn" style="font-size:{size}px;padding:{pady}px {padx}px">{text}</div>'


def pills(items, size, padx, pady, gap, icon):
    return ''.join(f'<div class="pill" style="font-size:{size}px;padding:{pady}px {padx}px;gap:{icon * .7}px;margin-top:{gap if i else 0}px">{m(icon)}{t}</div>' for i, t in enumerate(items))


def address(size, colour=WHITE, rule=True):
    r = f'<div style="height:1px;background:{colour};opacity:.45;margin-bottom:{size * 1.3}px"></div>' if rule else ''
    return f'<div style="color:{colour}">{r}<div style="display:flex;align-items:center;gap:{size * .6}px;font-size:{size}px;font-weight:500">{PIN.format(s=round(size * 1.3))}{ADDRESS}</div></div>'


def proof(size, colour=TEAL, star=GOLD):
    stars = ''.join(STAR.format(s=round(size * 1.1), c=star) for _ in range(5))
    return f'<div style="display:flex;align-items:center;gap:{size * .5}px;color:{colour};font-size:{size}px;font-weight:500"><div style="display:flex;gap:2px">{stars}</div>4.8 from 295 Google reviews</div>'


def wash(direction='180deg', a=.92, b=.35):
    return f'<div class="abs" style="inset:0;background:linear-gradient({direction},rgba(4,97,105,{a}) 0%,rgba(4,97,105,{b}) 100%)"></div>'


def page(cls, body, n=None, title=None, dark=False):
    c = WHITE if dark else TEAL
    head = ''
    if title:
        head = f'<div class="abs label" style="left:80px;top:62px;color:{GOLD}">{n:02d}</div><div class="abs label" style="left:130px;top:62px;color:{c};opacity:.8">{title}</div>'
    foot = f'<div class="foot label" style="font-size:11px;color:{c};opacity:.55"><span>mksmiles.co.uk</span><span>Brand guidelines · 2026</span></div>'
    return f'<section class="page {cls}">{head}{body}{foot}</section>'


def ph(src, x, y, w, h, pos='50% 50%', radius=0):
    return f'<div class="ph" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;border-radius:{radius}px"><img src="assets/photos/web/{src}" style="object-position:{pos}"></div>'


# ---------- ads in the system (Applications page) ----------

def ad_square(s):
    return f"""<div style="position:relative;width:{1080 * s}px;height:{1080 * s}px;overflow:hidden;background:{TEAL}">
<img class="full" src="assets/photos/web/26.jpg" style="object-position:72% 40%">
<div class="abs" style="inset:0;background:linear-gradient(90deg,rgba(4,97,105,.97) 0%,rgba(4,97,105,.9) 46%,rgba(4,97,105,0) 72%)"></div>
<div class="abs" style="left:{70 * s}px;top:{70 * s}px">{logo(190 * s, True)}</div>
<div class="abs h" style="left:{70 * s}px;top:{290 * s}px;width:{560 * s}px;font-size:{60 * s}px;color:{WHITE}">A calmer approach to <em style="color:{MINT}">dental care</em></div>
<div class="abs" style="left:{70 * s}px;top:{560 * s}px;width:{520 * s}px">{pills(['Unhurried consultations', 'Saturday appointments', 'Support for nervous patients'], 24 * s, 22 * s, 16 * s, 14 * s, 30 * s)}</div>
<div class="abs" style="left:{70 * s}px;top:{840 * s}px">{btn('Book Your Appointment', 26 * s, 44 * s, 24 * s)}</div>
<div class="abs" style="left:{70 * s}px;right:{70 * s}px;top:{970 * s}px">{address(17 * s, WHITE, False)}</div>
</div>"""


def ad_story(s):
    return f"""<div style="position:relative;width:{1080 * s}px;height:{1920 * s}px;overflow:hidden;background:{TEAL}">
<img class="full" src="assets/photos/web/4.jpg" style="object-position:50% 50%">
{wash('180deg', .96, .25)}
<div class="abs" style="left:0;right:0;top:{260 * s}px;display:flex;justify-content:center">{logo(260 * s, True)}</div>
<div class="abs h" style="left:{100 * s}px;right:{100 * s}px;top:{600 * s}px;text-align:center;font-size:{78 * s}px;color:{WHITE}">Open Saturdays in <em style="color:{MINT}">Brooklands</em></div>
<div class="abs" style="left:0;right:0;top:{820 * s}px;display:flex;justify-content:center">{proof(26 * s, WHITE)}</div>
<div class="abs" style="left:0;right:0;top:{1440 * s}px;display:flex;justify-content:center">{btn('Book Your Appointment', 30 * s, 54 * s, 28 * s)}</div>
</div>"""


# ---------- pages ----------

def cover():
    return page('teal', f"""
<img class="full" src="assets/photos/web/4.jpg" style="object-position:50% 60%">
<div class="abs" style="inset:0;background:linear-gradient(90deg,rgba(4,97,105,.98) 0%,rgba(4,97,105,.94) 42%,rgba(4,97,105,.35) 100%)"></div>
<div class="abs" style="left:160px;top:250px">{logo(440, True)}</div>
<div class="abs label" style="left:164px;top:760px;font-size:22px;color:{WHITE}">Brand guidelines</div>
<div class="abs label" style="left:164px;top:808px;color:{MINT}">MK Smiles Dental Practice · Brooklands, Milton Keynes · A Kana Health Group practice</div>""", dark=True)


def story():
    return page('', f"""
<div class="abs h" style="left:80px;top:150px;width:860px;font-size:80px">A calmer approach to <em>dental care</em></div>
<div class="abs body dim" style="left:80px;top:400px;width:760px">
<p>MK Smiles is a modern private practice inside Brooklands Health Centre, on the eastern edge of Milton Keynes. It cares for the whole family, from check-ups, hygiene and emergencies to Invisalign, bonding, whitening, implants and facial aesthetics.</p>
<p>Patients here are mostly young professionals and families in new-build Brooklands, Broughton and Atterbury. They research before they book, and they want a dentist who explains things, fits around work and school, and never rushes them.</p></div>
<div class="abs" style="left:80px;top:790px;width:780px">
  <div class="label" style="color:{GOLD}">Brand idea</div>
  <div class="h" style="font-size:38px;margin-top:14px">Informed, comfortable and <em>supported</em> at every stage.</div></div>
{ph('26.jpg', 980, 150, 520, 780, '74% 40%')}
<div class="abs" style="left:1550px;top:150px;width:300px">
  <div class="label" style="color:{GOLD}">What sets us apart</div>
  <div class="small" style="margin-top:18px;line-height:2.1">Open Saturdays, 8:45am to 4:30pm<br>Late evenings Monday + Wednesday<br>Inside Brooklands Health Centre<br>Family care under one roof</div>
  <div class="rule" style="margin:34px 0"></div>
  <div class="label" style="color:{GOLD}">Proof</div>
  <div style="margin-top:16px">{proof(15)}</div>
  <div class="rule" style="margin:34px 0"></div>
  <div class="label" style="color:{GOLD}">Areas served</div>
  <div class="small" style="margin-top:18px;line-height:2.1">Brooklands · Broughton<br>Broughton Gate · Atterbury<br>Middleton · Oakgrove<br>Monkston · Kingston</div>
</div>""", 1, 'Who we are')


def logo_page():
    misuse = [
        ('Stretched', f'<div style="transform:scaleX(1.55)">{logo(78)}</div>'),
        ('Recoloured', f'<div style="filter:hue-rotate(150deg) saturate(2)">{logo(96)}</div>'),
        ('Rotated', f'<div style="transform:rotate(-12deg)">{logo(96)}</div>'),
        ('Busy photo, no wash', f'<img class="full" src="assets/photos/web/13.jpg"><div style="position:relative">{logo(96, True)}</div>'),
    ]
    mis = ''.join(f"""<div style="width:262px;height:160px;background:{MIST};position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden">{x}
<svg class="abs" style="left:0;top:0" width="262" height="160"><line x1="16" y1="146" x2="246" y2="14" stroke="{STOP}" stroke-width="2.5"/></svg>
<div class="abs label" style="left:16px;top:14px;font-size:10px;color:{STOP};background:rgba(255,255,255,.85);padding:2px 6px">{t}</div></div>""" for t, x in misuse)
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:72px">The <em>logo</em></div>
<div class="abs body dim" style="left:80px;top:250px;width:540px"><p>A tooth-shaped M beside a Sage K, Smiles set wide beneath, then the Kana Health Group crown and rule over DENTAL PRACTICE in Gold.</p>
<p>Clear space on every side equals the height of the crown. Minimum width is 120px on screen, 30mm in print.</p>
<p>The MK monogram can stand alone as an avatar or watermark. The tooth M alone is a bullet icon. Use the full-colour logo on white and the white logo on Teal or washed photography. The files are PNG only: crop from them, never redraw or retype.</p></div>
<div class="abs" style="left:700px;top:130px;width:1140px;height:430px;background:{WHITE};border:1px solid {MIST};display:flex;align-items:center;justify-content:center">
  <div style="position:relative;padding:40px 60px;border:1.5px dashed {SAGE}">{logo(300)}</div></div>
<div class="abs" style="left:700px;top:590px;width:270px;height:150px;background:{WHITE};border:1px solid {MIST};display:flex;align-items:center;justify-content:center">{logo(96)}</div>
<div class="abs" style="left:990px;top:590px;width:270px;height:150px;background:{TEAL};display:flex;align-items:center;justify-content:center">{logo(96, True)}</div>
<div class="abs" style="left:1280px;top:590px;width:270px;height:150px;overflow:hidden"><img class="full" src="assets/photos/web/6.jpg">{wash('180deg', .85, .6)}<div class="abs" style="inset:0;display:flex;align-items:center;justify-content:center">{logo(96, True)}</div></div>
<div class="abs" style="left:1570px;top:590px;width:270px;height:150px;background:{MIST};display:flex;align-items:center;justify-content:center;gap:34px">{mk(110)}{m(44, False)}</div>
<div class="abs label" style="left:700px;top:752px;font-size:10px;opacity:.7">Full colour on white</div>
<div class="abs label" style="left:990px;top:752px;font-size:10px;opacity:.7">White on Teal</div>
<div class="abs label" style="left:1280px;top:752px;font-size:10px;opacity:.7">On photo, with Teal wash</div>
<div class="abs label" style="left:1570px;top:752px;font-size:10px;opacity:.7">MK monogram · tooth M</div>
<div class="abs label" style="left:700px;top:800px;color:{GOLD}">Misuse</div>
<div class="abs" style="left:700px;top:832px;display:flex;gap:24px">{mis}</div>""", 2, 'Logo')


def colour():
    sw = [
        ('MK Teal', TEAL, 'Main colour: grounds, washes, headlines', WHITE, 80, 150, 580, 420, False),
        ('Sage', SAGE, 'The K. Headline accent, icons', WHITE, 680, 150, 580, 420, False),
        ('White', WHITE, 'Canvas and type on Teal', TEAL, 1280, 150, 560, 420, True),
        ('Mint', MINT, 'Buttons and accents on Teal', INK, 80, 590, 420, 280, False),
        ('Gold', GOLD, 'Crown, stars, fine detail only', WHITE, 520, 590, 420, 280, False),
        ('Sand', SAND, 'Warm rules and soft grounds', INK, 960, 590, 420, 280, False),
    ]
    cards = ''.join(f"""<div class="swatch" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;background:{c};color:{t};{'border:1px solid ' + MIST + ';' if b else ''}">
<div style="font-weight:600;font-size:{44 if h > 300 else 30}px">{n}</div><div class="label" style="font-size:12px;margin-top:10px">{c}</div><div class="small" style="margin-top:6px;opacity:.85;font-size:14px">{u}</div></div>""" for n, c, u, t, x, y, w, h, b in sw)
    return page('', f"""{cards}
<div class="abs" style="left:1400px;top:590px;width:440px;height:280px;display:flex">
  <div style="flex:45;background:{TEAL}"></div><div style="flex:30;background:{WHITE};border:1px solid {MIST}"></div><div style="flex:12;background:{SAGE}"></div><div style="flex:9;background:{MINT}"></div><div style="flex:4;background:{GOLD}"></div></div>
<div class="abs label" style="left:1400px;top:882px;font-size:11px;opacity:.7">Balance · 45 / 30 / 12 / 9 / 4</div>
<div class="abs small dim" style="left:80px;top:900px;width:1240px">Teal leads and carries most ads, usually as a wash over real practice photography. Sage gives headlines their soft turn, Mint is the button, and Gold is kept small, exactly as it sits in the logo. Mist {MIST} (a light tint of Sage) is the only extra ground. No black panels, no off-palette blues.</div>""", 3, 'Colour')


def typography():
    return page('', f"""
<div class="abs" style="left:80px;top:130px;width:1080px">
  <div class="label" style="color:{GOLD}">Headline · Poppins SemiBold 600 · turn in Poppins Light Italic, Sage</div>
  <div class="h" style="font-size:110px;margin-top:22px;line-height:1.06">Needing a new <em>dentist?</em></div>
  <div class="small dim" style="margin-top:24px;width:860px">Short and plain-spoken, sentence case. The last word or two carry the feeling and are set in Light Italic: Sage on white, Mint on Teal. This is how the practice's current ads already read.</div>
</div>
<div class="abs" style="left:80px;top:640px;width:520px">
  <div class="label" style="color:{GOLD}">Body · Poppins Regular 400</div>
  <div class="body dim" style="margin-top:14px">Every treatment begins with a thorough consultation, so our team understands your goals before recommending anything.</div>
</div>
<div class="abs" style="left:680px;top:640px;width:480px">
  <div class="label" style="color:{GOLD}">Label · Jost Medium · caps · +22%</div>
  <div class="label" style="margin-top:20px;font-size:18px;color:{TEAL}">Brooklands · Milton Keynes</div>
  <div class="label" style="color:{GOLD};margin-top:46px">Button · Poppins Medium · title case</div>
  <div style="margin-top:14px">{btn('Book Your Appointment', 18, 34, 18)}</div>
</div>
<div class="abs teal" style="left:1240px;top:130px;width:600px;height:800px;padding:56px">
  <div class="label" style="color:{MINT}">List · Poppins SemiBold · tooth M bullet</div>
  <div style="margin-top:30px">{pills(['Detailed dental examination', 'Flexible appointments', 'Support for nervous patients'], 22, 22, 16, 16, 28)}</div>
  <div class="small" style="margin-top:28px;opacity:.75">Website headings use Jost SemiBold. Keep Jost for web headings and small caps labels; ads and print use Poppins.</div>
  <div class="label" style="color:{MINT};margin-top:56px">Numerals · Poppins Light</div>
  <div style="display:flex;gap:34px;margin-top:18px;font-weight:300;font-size:104px;line-height:1;color:{MINT}"><span>4.8</span><span style="color:{WHITE}">295</span></div>
</div>""", 4, 'Typography')


def elements():
    return page('', f"""
<div class="abs" style="left:80px;top:130px;width:520px;height:440px;overflow:hidden">
  <img class="full" src="assets/photos/web/21.jpg" style="object-position:80% 40%">
  <div class="abs" style="inset:0;background:linear-gradient(90deg,rgba(4,97,105,.96) 0%,rgba(4,97,105,.7) 38%,rgba(4,97,105,0) 62%)"></div>
  <div class="abs h" style="left:36px;top:150px;width:260px;font-size:38px;color:{WHITE}">Teal <em style="color:{MINT}">wash</em></div>
</div>
<div class="abs label" style="left:80px;top:584px;font-size:10px;opacity:.65">Teal wash · 95% to clear, behind every headline on a photo</div>
<div class="abs teal" style="left:640px;top:130px;width:520px;height:440px;padding:60px 56px">
  {pills(['Detailed dental examination', 'Flexible appointments', 'Support for nervous patients'], 20, 20, 15, 14, 26)}
</div>
<div class="abs label" style="left:640px;top:584px;font-size:10px;opacity:.65">Outlined list cards · white hairline, tooth M bullet</div>
<div class="abs" style="left:1200px;top:130px;width:640px;height:440px;background:{MIST};overflow:hidden">
  <div class="abs" style="left:300px;top:40px;opacity:.16">{mk(520, False)}</div>
  <div class="abs" style="left:60px;top:150px">{crown(300)}</div>
  <div class="abs label" style="left:60px;top:220px;font-size:12px;color:{TEAL}">Crown rule · from the logo</div>
</div>
<div class="abs label" style="left:1200px;top:584px;font-size:10px;opacity:.65">MK watermark at 10–16% off an edge · crown rule as a divider</div>
<div class="abs teal" style="left:80px;top:650px;width:1080px;height:260px;padding:56px 50px">
  {address(22)}
  <div style="margin-top:34px">{proof(20, WHITE)}</div>
</div>
<div class="abs label" style="left:80px;top:924px;font-size:10px;opacity:.65">Address strip with hairline, and review proof · Gold stars</div>
<div class="abs" style="left:1200px;top:650px;width:640px;height:260px;background:{TEAL};padding:44px 50px">
  <div class="label" style="color:{MINT}">Call to action</div>
  <div style="display:flex;gap:20px;margin-top:30px;align-items:center">{btn('Book Your Appointment', 18, 30, 18)}{btn('Schedule A Consultation', 18, 30, 18)}</div>
  <div class="small" style="margin-top:24px;color:{WHITE};opacity:.75">Mint fill, Ink text, 6px corners. Say what happens next.</div></div>""", 5, 'Graphic elements')


def photography():
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:72px;width:520px">Our team, <em>our practice</em></div>
<div class="abs body dim" style="left:80px;top:330px;width:500px">
<p>Real people, in the real practice. Team portraits at the MK Smiles reception wall, bright clean interiors, and the Brooklands Health Centre building that patients will recognise.</p>
<p>The catchment is young and diverse, so imagery should reflect it. Use the team by name only when the name is confirmed (Dr Gizel Pereira, pictured, is named on her scrubs).</p></div>
{ph('26.jpg', 640, 130, 380, 520, '72% 40%')}
{ph('4.jpg', 1050, 130, 790, 250, '50% 62%')}
{ph('6.jpg', 1050, 400, 385, 250, '50% 50%')}
{ph('29.jpg', 1455, 400, 385, 250, '50% 35%')}
<div class="abs mist" style="left:640px;top:690px;width:1200px;height:250px;padding:40px 50px;display:flex;gap:60px">
  <div style="width:520px"><div class="label" style="color:{TEAL}">Look for</div><div class="small" style="margin-top:12px">Warm eye contact and natural smiles, the MK wall softly behind. Bright, even light. Leave the left or top third quiet for a Teal wash and headline.</div></div>
  <div style="width:520px"><div class="label" style="color:{STOP}">Avoid</div><div class="small" style="margin-top:12px">Generic stock families, instruments, needles, gloved hands in mouths, over-whitened teeth, and before-and-afters without the patient's written consent.</div></div></div>""", 6, 'Photography')


def voice():
    pairs = [('Reassuring', 'We’ll explain everything before anything happens.', 'Pain-free dentistry, guaranteed!'),
             ('Honest', 'Clear guidance and a plan built around you.', 'The best prices in Milton Keynes.'),
             ('Warm', 'Bring the whole family. Saturdays too.', 'Don’t miss out! Book NOW!'),
             ('Local', 'Inside Brooklands Health Centre, MK10.', 'The UK’s number one dental practice.')]
    rows = ''.join(f"""<div style="display:flex;gap:30px;padding:22px 0;border-top:1px solid {SAND}">
<div class="h" style="width:260px;font-size:38px"><em>{t}</em></div>
<div style="width:600px"><div class="label" style="font-size:10px;color:{GOLD}">We say</div><div class="body" style="margin-top:6px">{y}</div></div>
<div style="width:540px;opacity:.45"><div class="label" style="font-size:10px">We don’t say</div><div class="body" style="margin-top:6px;text-decoration:line-through">{n}</div></div></div>""" for t, y, n in pairs)
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:80px">How <em>we sound</em></div>
<div class="abs body dim" style="left:80px;top:250px;width:1500px">Friendly, family-centred and clear, like the dentist who takes time to explain. Patients should feel informed, comfortable and supported. UK English, no em dashes, no outcome guarantees or “pain-free” claims, no finance figures without FCA wording, and urgency only when an offer is genuinely live.</div>
<div class="abs" style="left:80px;top:400px;width:1450px">{rows}</div>""", 7, 'Tone of voice')


def applications():
    return page('mist', f"""
<div class="abs h" style="left:80px;top:130px;font-size:80px;width:560px">In <em>use</em></div>
<div class="abs body dim" style="left:80px;top:250px;width:520px"><p>Meta statics: a real practice photo under a Teal wash, the white logo, a Poppins headline with its Light Italic turn, tooth M list cards, the Mint button and the address strip.</p>
<p>Stories keep the logo and copy out of the top 250px and bottom 340px. Review proof uses the live Google count, rechecked before each batch.</p></div>
<div class="abs" style="left:680px;top:150px">{ad_square(0.68)}</div>
<div class="abs label" style="left:680px;top:900px;font-size:11px;opacity:.6">Feed 1:1</div>
<div class="abs" style="left:1440px;top:110px">{ad_story(0.43)}</div>
<div class="abs label" style="left:1440px;top:950px;font-size:11px;opacity:.6">Story 9:16</div>""", 8, 'Applications')


def close():
    return page('teal', f"""
<div class="abs" style="left:1180px;top:300px;opacity:.12">{mk(900, True)}</div>
<div class="abs" style="left:160px;top:250px">{logo(380, True)}</div>
<div class="abs label" style="left:164px;top:700px;font-size:20px;color:{WHITE}">A calmer approach to dental care</div>
<div class="abs small" style="left:164px;top:750px;opacity:.75">Brooklands Health Centre · {ADDRESS} · 01908 348 100</div>""", dark=True)


def main():
    pages = [cover(), story(), logo_page(), colour(), typography(), elements(), photography(), voice(), applications(), close()]
    head = f'<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>MK Smiles Brand Guidelines</title><style>{CSS}</style>'
    body = f'</head><body>{"".join(pages)}</body></html>'
    (HERE / 'guideline.html').write_text(head + body)
    (HERE / 'guideline-capture.html').write_text(head + '<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>' + body)
    print('pages', len(pages))


if __name__ == '__main__':
    main()
