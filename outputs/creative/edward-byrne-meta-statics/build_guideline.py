"""Edward Byrne Associates brand guideline: HTML harness for Figma capture.

Sources (20 Oct 2026):
- Logo: edwardbyrne.com/wp-content/uploads/2023/02/Edward-Byrne-Logo-RGB.png (colour, 2568px, transparent)
  and .../2023/02/Edward-Byrne-Logo-REVERSE-RGB-1.png (white + Gold). The practice Drive "Logos" folder
  (1UNDBqa0SaNrB9AQDrtlRu_EuHbP7vsgV) is empty. The site's only SVG is a PNG wrapped in SVG, so PNG is
  the best source. Wordmark, crown-rule and crown pieces are straight crops of those files (assets/), never
  redrawn. The crown is the Kana Health Group crown; KHG white logo from Drive (1q0Ybm0v6X9f8aDs_K0V_H5a8148GZsTy).
- Palette: site Elementor globals (post-9.css): primary #241F1F, secondary #C2A76C, #73424F, #F8EDE2,
  #1E365B. Logo artwork samples: Plum #72414E (= #73424F), Blush #D0B0A8 ("Associates"), Gold #BD9F61.
  The July 2026 Kana_Edward_Byrne_FB statics on Drive (Meta Ads > New Meta Statics for Approval) run on
  black with Gold #C1A161 buttons and italic turns, crown bullets in outlined cards.
- Type: site uses Jost 600 (headings), Poppins (body), Roboto (accent); the July statics use Poppins
  SemiBold/Bold headlines with a Poppins italic turn in Gold. All Google fonts. The logo serif is artwork only.
- Photos: Joe Goodchild's July 2026 shoot (assets/photos, gitignored); harness uses assets/photos/web/
  1800px copies (p = portraits, l = landscapes). l16-sq.jpg is a pre-cropped square of landscapes/16.jpg for
  the 1:1 ad (the Figma capture does not reliably honour object-position on that frame). Nobody is named: no badges visible, so no names confirmed.
- Facts: 16 De Parys Avenue, Bedford, MK40 2TW; 01234 352372; Mon 9-5, Tue 9-7.30, Wed/Thu 9-5, Fri 9-3.30,
  Sat 9-1 (alternate Saturdays), Sun closed; new patients welcome; NHS Minor Oral Surgery referrals; implants
  and All-on-4 (edwardbyrne.com homepage, 20 Oct 2026). 4.9 stars from 413 Google reviews (Google Maps embed
  for the homepage address, 20 Oct 2026). Advertising areas from the Vendo Catchment & Positioning Report
  (Drive 1HAXqlRiuV5YBtr7EoJiiZZ8cEPmWYGHFPo7MtHc4DZc, 8 Aug 2026).
- Left out on purpose: "Free Implant Consultations" (site banner conflicts with the £95 fees line) and
  "Oral Surgeon" titles (GDC specialist status unverified).

Usage: python3 build_guideline.py  ->  guideline.html + guideline-capture.html (Figma capture)
"""
from pathlib import Path

HERE = Path(__file__).parent

BLACK, GOLD, PLUM, BLUSH, CREAM, WHITE = '#241F1F', '#C2A76C', '#73424F', '#D0B0A8', '#F8EDE2', '#FFFFFF'
NAVY, CARD, INK = '#1E365B', '#2E2716', '#241F1F'
STOP = '#B5523F'


def img(name, w, extra=''):
    return f'<img src="assets/{name}" style="display:block;width:{w}px;{extra}">'


def logo(w, white=False):
    return img('logo-white.png' if white else 'logo-colour.png', w)


def wordmark(w, white=True):
    return img('wordmark-white.png' if white else 'wordmark-colour.png', w)


def crown_icon(w, extra=''):
    return img('crown.png', w, extra)


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
body{{background:#d8d2cc;font-family:'Poppins',sans-serif;font-weight:400;color:{INK};display:flex;flex-direction:column;gap:120px;padding:120px;width:2160px;-webkit-font-smoothing:antialiased}}
.page{{position:relative;width:1920px;height:1080px;overflow:hidden;background:{WHITE}}}
.black{{background:{BLACK};color:{WHITE}}} .cream{{background:{CREAM}}}
.abs{{position:absolute}}
.h{{font-weight:600;letter-spacing:-.01em;line-height:1.12;color:{BLACK}}}
.black .h{{color:{WHITE}}}
.h em{{font-style:italic;font-weight:400;color:{PLUM}}}
.black .h em{{color:{GOLD}}}
.label{{font-family:'Jost',sans-serif;font-weight:500;font-size:14px;letter-spacing:.22em;text-transform:uppercase}}
.body{{font-size:19px;line-height:1.7}} .body p+p{{margin-top:14px}}
.small{{font-size:15px;line-height:1.6}}
.dim{{opacity:.8}}
.ph{{position:absolute;overflow:hidden}}
.ph img{{width:100%;height:100%;object-fit:cover;display:block}}
.full{{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}}
.btn{{display:inline-flex;align-items:center;justify-content:center;background:{GOLD};color:{INK};font-weight:500;border-radius:4px;white-space:nowrap}}
.pill{{display:flex;align-items:center;border:1.5px solid {GOLD};background:{CARD};border-radius:10px;color:{WHITE};font-weight:600}}
.foot{{position:absolute;left:80px;right:80px;bottom:44px;display:flex;justify-content:space-between}}
.swatch{{position:absolute;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;padding:28px}}
.rule{{height:1px;background:{BLUSH}}}
"""

PIN = '<svg width="{s}" height="{s}" viewBox="0 0 24 24" style="display:block;flex:none"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2z" fill="currentColor"/></svg>'
STAR = '<svg width="{s}" height="{s}" viewBox="0 0 24 24" style="display:block"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill="{c}"/></svg>'
ADDRESS = '16 De Parys Avenue, Bedford, MK40 2TW'


def btn(text, size, padx, pady):
    return f'<div class="btn" style="font-size:{size}px;padding:{pady}px {padx}px">{text}</div>'


def pills(items, size, padx, pady, gap, icon):
    return ''.join(f'<div class="pill" style="font-size:{size}px;padding:{pady}px {padx}px;gap:{icon * .6}px;margin-top:{gap if i else 0}px">{crown_icon(icon)}{t}</div>' for i, t in enumerate(items))


def address(size, colour=WHITE, rule=True):
    r = f'<div style="height:1px;background:{colour};opacity:.45;margin-bottom:{size * 1.3}px"></div>' if rule else ''
    return f'<div style="color:{colour}">{r}<div style="display:flex;align-items:center;gap:{size * .6}px;font-size:{size}px;font-weight:500">{PIN.format(s=round(size * 1.3))}{ADDRESS}</div></div>'


def proof(size, colour=BLACK, star=GOLD):
    stars = ''.join(STAR.format(s=round(size * 1.1), c=star) for _ in range(5))
    return f'<div style="display:flex;align-items:center;gap:{size * .5}px;color:{colour};font-size:{size}px;font-weight:500"><div style="display:flex;gap:2px">{stars}</div>4.9 from 413 Google reviews</div>'


def wash(direction='180deg', a=.92, b=.35):
    return f'<div class="abs" style="inset:0;background:linear-gradient({direction},rgba(36,31,31,{a}) 0%,rgba(36,31,31,{b}) 100%)"></div>'


def page(cls, body, n=None, title=None, dark=False):
    c = WHITE if dark else BLACK
    head = ''
    if title:
        head = f'<div class="abs label" style="left:80px;top:62px;color:{GOLD}">{n:02d}</div><div class="abs label" style="left:130px;top:62px;color:{c};opacity:.8">{title}</div>'
    foot = f'<div class="foot label" style="font-size:11px;color:{c};opacity:.55"><span>edwardbyrne.com</span><span>Brand guidelines · 2026</span></div>'
    return f'<section class="page {cls}">{head}{body}{foot}</section>'


def ph(src, x, y, w, h, pos='50% 50%', radius=0):
    return f'<div class="ph" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;border-radius:{radius}px"><img src="assets/photos/web/{src}" style="object-position:{pos}"></div>'


# ---------- ads in the system (Applications page) ----------

def ad_square(s):
    return f"""<div style="position:relative;width:{1080 * s}px;height:{1080 * s}px;overflow:hidden;background:{BLACK}">
<img class="full" src="assets/photos/web/l16-sq.jpg" style="object-position:50% 50%">
<div class="abs" style="inset:0;background:linear-gradient(90deg,rgba(36,31,31,.98) 0%,rgba(36,31,31,.93) 44%,rgba(36,31,31,0) 63%)"></div>
<div class="abs" style="left:{70 * s}px;top:{70 * s}px">{wordmark(260 * s)}</div>
<div class="abs h" style="left:{70 * s}px;top:{270 * s}px;width:{600 * s}px;font-size:{62 * s}px;color:{WHITE}">Considering dental <em style="color:{GOLD}">implants?</em></div>
<div class="abs" style="left:{70 * s}px;top:{540 * s}px;width:{520 * s}px">{pills(['Implants and All-on-4', 'Oral surgery on site', 'New patients welcome'], 24 * s, 22 * s, 16 * s, 14 * s, 34 * s)}</div>
<div class="abs" style="left:{70 * s}px;top:{830 * s}px">{btn('Book Your Consultation', 26 * s, 44 * s, 24 * s)}</div>
<div class="abs" style="left:{70 * s}px;right:{70 * s}px;top:{970 * s}px">{address(17 * s, WHITE, False)}</div>
</div>"""


def ad_story(s):
    return f"""<div style="position:relative;width:{1080 * s}px;height:{1920 * s}px;overflow:hidden;background:{BLACK}">
<img class="full" src="assets/photos/web/p6.jpg" style="object-position:50% 40%">
<div class="abs" style="inset:0;background:linear-gradient(180deg,rgba(36,31,31,.92) 0%,rgba(36,31,31,.15) 22%,rgba(36,31,31,.05) 40%,rgba(36,31,31,.92) 58%,rgba(36,31,31,.98) 100%)"></div>
<div class="abs" style="left:0;right:0;top:{260 * s}px;display:flex;justify-content:center">{wordmark(380 * s)}</div>
<div class="abs h" style="left:{100 * s}px;right:{100 * s}px;top:{1130 * s}px;text-align:center;font-size:{80 * s}px;color:{WHITE}">Your local <em style="color:{GOLD}">Bedford</em> dentist</div>
<div class="abs" style="left:0;right:0;top:{1340 * s}px;display:flex;justify-content:center">{proof(26 * s, WHITE)}</div>
<div class="abs" style="left:0;right:0;top:{1460 * s}px;display:flex;justify-content:center">{btn('Book Your Appointment', 30 * s, 54 * s, 28 * s)}</div>
</div>"""


# ---------- pages ----------

def cover():
    return page('black', f"""
<img class="full" src="assets/photos/web/l23.jpg" style="object-position:50% 55%">
<div class="abs" style="inset:0;background:linear-gradient(90deg,rgba(36,31,31,.98) 0%,rgba(36,31,31,.94) 42%,rgba(36,31,31,.4) 100%)"></div>
<div class="abs" style="left:160px;top:260px">{logo(620, True)}</div>
<div class="abs label" style="left:164px;top:760px;font-size:22px;color:{WHITE}">Brand guidelines</div>
<div class="abs label" style="left:164px;top:808px;color:{GOLD}">Edward Byrne Associates · De Parys Avenue, Bedford · A Kana Health Group practice</div>""", dark=True)


def story():
    return page('', f"""
<div class="abs h" style="left:80px;top:150px;width:860px;font-size:80px">Patient-focused care <em>in Bedford</em></div>
<div class="abs body dim" style="left:80px;top:400px;width:760px">
<p>Edward Byrne Associates is a private practice in a red-brick villa at 16 De Parys Avenue, Bedford. It covers check-ups, hygiene and emergencies through to Invisalign, whitening, veneers, dental implants and All-on-4.</p>
<p>Implant and oral surgery care is a real strength: the practice treats patients referred by other dentists through the NHS Minor Oral Surgery pathway, as well as its own private patients.</p></div>
<div class="abs" style="left:80px;top:790px;width:780px">
  <div class="label" style="color:{GOLD}">Brand idea</div>
  <div class="h" style="font-size:38px;margin-top:14px">Gentle care, <em>explained at every step.</em></div></div>
{ph('p5.jpg', 980, 150, 520, 780, '50% 30%')}
<div class="abs" style="left:1550px;top:150px;width:300px">
  <div class="label" style="color:{GOLD}">What sets us apart</div>
  <div class="small" style="margin-top:18px;line-height:2.1">Implants and All-on-4<br>NHS oral surgery referrals<br>Late Tuesdays, to 7.30pm<br>Alternate Saturdays, 9am to 1pm</div>
  <div class="rule" style="margin:34px 0"></div>
  <div class="label" style="color:{GOLD}">Proof</div>
  <div style="margin-top:16px">{proof(15)}</div>
  <div class="rule" style="margin:34px 0"></div>
  <div class="label" style="color:{GOLD}">Where we advertise</div>
  <div class="small" style="margin-top:18px;line-height:2.1">Bedford · Kempston<br>Bromham · Clapham<br>Sharnbrook · Great Barford<br>Willington · Cardington</div>
</div>""", 1, 'Who we are')


def logo_page():
    misuse = [
        ('Stretched', f'<div style="transform:scaleX(1.55)">{logo(78)}</div>'),
        ('Recoloured', f'<div style="filter:hue-rotate(150deg) saturate(2)">{logo(110)}</div>'),
        ('Rotated', f'<div style="transform:rotate(-12deg)">{logo(110)}</div>'),
        ('Busy photo, no wash', f'<img class="full" src="assets/photos/web/l12.jpg"><div style="position:relative">{logo(110, True)}</div>'),
    ]
    mis = ''.join(f"""<div style="width:262px;height:160px;background:{CREAM};position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden">{x}
<svg class="abs" style="left:0;top:0" width="262" height="160"><line x1="16" y1="146" x2="246" y2="14" stroke="{STOP}" stroke-width="2.5"/></svg>
<div class="abs label" style="left:16px;top:14px;font-size:10px;color:{STOP};background:rgba(255,255,255,.85);padding:2px 6px">{t}</div></div>""" for t, x in misuse)
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:72px">The <em>logo</em></div>
<div class="abs body dim" style="left:80px;top:250px;width:540px"><p>Edward Byrne in Plum serif, Associates spaced wide in Blush, then the Kana Health Group crown on a fine rule over DENTAL PRACTICE in Gold.</p>
<p>Clear space on every side equals the height of the crown. Minimum width is 140px on screen, 35mm in print.</p>
<p>In ads the wordmark (Edward Byrne Associates) can stand alone, white on Black, as the practice's current statics do. The crown alone is the bullet icon. Files are PNG only: crop from them, never redraw or retype.</p></div>
<div class="abs" style="left:700px;top:130px;width:1140px;height:430px;background:{WHITE};border:1px solid {CREAM};display:flex;align-items:center;justify-content:center">
  <div style="position:relative;padding:40px 60px;border:1.5px dashed {BLUSH}">{logo(420)}</div></div>
<div class="abs" style="left:700px;top:590px;width:270px;height:150px;background:{WHITE};border:1px solid {CREAM};display:flex;align-items:center;justify-content:center">{logo(150)}</div>
<div class="abs" style="left:990px;top:590px;width:270px;height:150px;background:{BLACK};display:flex;align-items:center;justify-content:center">{logo(150, True)}</div>
<div class="abs" style="left:1280px;top:590px;width:270px;height:150px;overflow:hidden"><img class="full" src="assets/photos/web/l6.jpg">{wash('180deg', .85, .6)}<div class="abs" style="inset:0;display:flex;align-items:center;justify-content:center">{logo(150, True)}</div></div>
<div class="abs" style="left:1570px;top:590px;width:270px;height:150px;background:{BLACK};display:flex;align-items:center;justify-content:center;gap:30px">{wordmark(150)}{crown_icon(40)}</div>
<div class="abs label" style="left:700px;top:752px;font-size:10px;opacity:.7">Full colour on white</div>
<div class="abs label" style="left:990px;top:752px;font-size:10px;opacity:.7">White and Gold on Black</div>
<div class="abs label" style="left:1280px;top:752px;font-size:10px;opacity:.7">On photo, with Black wash</div>
<div class="abs label" style="left:1570px;top:752px;font-size:10px;opacity:.7">Ad wordmark · crown</div>
<div class="abs label" style="left:700px;top:800px;color:{GOLD}">Misuse</div>
<div class="abs" style="left:700px;top:832px;display:flex;gap:24px">{mis}</div>""", 2, 'Logo')


def colour():
    sw = [
        ('Byrne Black', BLACK, 'Main ground for ads, washes and type', WHITE, 80, 150, 580, 420, False),
        ('Gold', GOLD, 'Crown, buttons, headline turns on Black', INK, 680, 150, 580, 420, False),
        ('White', WHITE, 'Canvas and type on Black', BLACK, 1280, 150, 560, 420, True),
        ('Plum', PLUM, 'Logo wordmark. Headline turns on light', WHITE, 80, 590, 420, 280, False),
        ('Blush', BLUSH, 'Associates. Fine rules, soft detail', INK, 520, 590, 420, 280, False),
        ('Cream', CREAM, 'Warm light grounds and panels', INK, 960, 590, 420, 280, True),
    ]
    cards = ''.join(f"""<div class="swatch" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;background:{c};color:{t};{'border:1px solid #E6DCD2;' if b else ''}">
<div style="font-weight:600;font-size:{44 if h > 300 else 30}px">{n}</div><div class="label" style="font-size:12px;margin-top:10px">{c}</div><div class="small" style="margin-top:6px;opacity:.85;font-size:14px">{u}</div></div>""" for n, c, u, t, x, y, w, h, b in sw)
    return page('', f"""{cards}
<div class="abs" style="left:1400px;top:590px;width:440px;height:280px;display:flex">
  <div style="flex:45;background:{BLACK}"></div><div style="flex:28;background:{WHITE};border:1px solid #E6DCD2"></div><div style="flex:12;background:{GOLD}"></div><div style="flex:8;background:{CREAM}"></div><div style="flex:5;background:{PLUM}"></div><div style="flex:2;background:{BLUSH}"></div></div>
<div class="abs label" style="left:1400px;top:882px;font-size:11px;opacity:.7">Balance · 45 / 28 / 12 / 8 / 5 / 2</div>
<div class="abs small dim" style="left:80px;top:900px;width:1240px">Black and Gold carry the ads, exactly as the practice's current statics do. Plum and Blush come from the logo and stay quiet: Plum for the italic turn on light pages, Blush for rules. Navy {NAVY} is the website's heading and footer colour only; keep it off ads. No off-palette blues or bright accents.</div>""", 3, 'Colour')


def typography():
    return page('', f"""
<div class="abs" style="left:80px;top:130px;width:1080px">
  <div class="label" style="color:{GOLD}">Headline · Poppins SemiBold 600 · turn in Poppins Italic, Plum or Gold</div>
  <div class="h" style="font-size:110px;margin-top:22px;line-height:1.06">Looking for a new dentist in <em>Bedford?</em></div>
  <div class="small dim" style="margin-top:24px;width:860px">Short and plain-spoken, sentence case. The last word or two carry the feeling and are set in Italic: Plum on light grounds, Gold on Black. This is how the practice's current ads already read.</div>
</div>
<div class="abs" style="left:80px;top:700px;width:520px">
  <div class="label" style="color:{GOLD}">Body · Poppins Regular 400</div>
  <div class="body dim" style="margin-top:14px">We take time to explain your options, so you understand your treatment before anything begins.</div>
</div>
<div class="abs" style="left:680px;top:700px;width:480px">
  <div class="label" style="color:{GOLD}">Label · Jost Medium · caps · +22%</div>
  <div class="label" style="margin-top:20px;font-size:18px;color:{PLUM}">De Parys Avenue · Bedford</div>
  <div class="label" style="color:{GOLD};margin-top:46px">Button · Poppins Medium · title case</div>
  <div style="margin-top:14px">{btn('Book Your Appointment', 18, 34, 18)}</div>
</div>
<div class="abs black" style="left:1240px;top:130px;width:600px;height:800px;padding:56px">
  <div class="label" style="color:{GOLD}">List · Poppins SemiBold · crown bullet</div>
  <div style="margin-top:30px">{pills(['Detailed dental examination', 'Flexible appointments', 'Support for nervous patients'], 22, 22, 16, 16, 30)}</div>
  <div class="small" style="margin-top:28px;opacity:.75">Website headings use Jost SemiBold. Keep Jost for web headings and small caps labels; ads and print use Poppins. The logo serif is artwork only, never typed.</div>
  <div class="label" style="color:{GOLD};margin-top:56px">Numerals · Poppins Light</div>
  <div style="display:flex;gap:34px;margin-top:18px;font-weight:300;font-size:104px;line-height:1;color:{GOLD}"><span>4.9</span><span style="color:{WHITE}">413</span></div>
</div>""", 4, 'Typography')


def elements():
    return page('', f"""
<div class="abs" style="left:80px;top:130px;width:520px;height:440px;overflow:hidden">
  <img class="full" src="assets/photos/web/l14.jpg" style="object-position:0% 40%">
  <div class="abs" style="inset:0;background:linear-gradient(90deg,rgba(36,31,31,.96) 0%,rgba(36,31,31,.72) 38%,rgba(36,31,31,0) 64%)"></div>
  <div class="abs h" style="left:36px;top:150px;width:260px;font-size:38px;color:{WHITE}">Black <em style="color:{GOLD}">wash</em></div>
</div>
<div class="abs label" style="left:80px;top:584px;font-size:10px;opacity:.65">Black wash · 95% to clear, behind every headline on a photo</div>
<div class="abs black" style="left:640px;top:130px;width:520px;height:440px;padding:60px 56px">
  {pills(['Detailed dental examination', 'Flexible appointments', 'Support for nervous patients'], 20, 20, 15, 14, 28)}
</div>
<div class="abs label" style="left:640px;top:584px;font-size:10px;opacity:.65">Outlined list cards · Gold hairline, crown bullet</div>
<div class="abs cream" style="left:1200px;top:130px;width:640px;height:440px;overflow:hidden">
  <div class="abs" style="left:330px;top:60px;opacity:.14">{crown_icon(420)}</div>
  <div class="abs" style="left:60px;top:150px">{crown(320)}</div>
  <div class="abs label" style="left:60px;top:210px;font-size:12px;color:{PLUM}">Crown rule · from the logo</div>
</div>
<div class="abs label" style="left:1200px;top:584px;font-size:10px;opacity:.65">Crown watermark at 10–16% off an edge · crown rule as a divider</div>
<div class="abs black" style="left:80px;top:650px;width:1080px;height:260px;padding:56px 50px">
  {address(22)}
  <div style="margin-top:34px">{proof(20, WHITE)}</div>
</div>
<div class="abs label" style="left:80px;top:924px;font-size:10px;opacity:.65">Address strip with hairline, and review proof · Gold stars</div>
<div class="abs" style="left:1200px;top:650px;width:640px;height:260px;background:{BLACK};padding:44px 50px">
  <div class="label" style="color:{GOLD}">Call to action</div>
  <div style="display:flex;gap:20px;margin-top:30px;align-items:center">{btn('Book Your Appointment', 18, 30, 18)}{btn('Book Your Consultation', 18, 30, 18)}</div>
  <div class="small" style="margin-top:24px;color:{WHITE};opacity:.75">Gold fill, Black text, 4px corners. Say what happens next.</div></div>""", 5, 'Graphic elements')


def photography():
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:72px;width:520px">Our team, <em>our practice</em></div>
<div class="abs body dim" style="left:80px;top:330px;width:500px">
<p>Real people at the real practice. Team portraits at the front door, the red-brick villas of De Parys Avenue, and bright surgeries and waiting rooms that patients will recognise.</p>
<p>Bedford is a diverse town, so imagery should reflect it. Name a team member only when the name is confirmed by the practice; none of these portraits carry a name badge.</p></div>
{ph('p2.jpg', 640, 130, 380, 520, '50% 35%')}
{ph('l24.jpg', 1050, 130, 790, 250, '50% 55%')}
{ph('l1.jpg', 1050, 400, 385, 250, '50% 50%')}
{ph('l18.jpg', 1455, 400, 385, 250, '50% 40%')}
<div class="abs cream" style="left:640px;top:690px;width:1200px;height:250px;padding:40px 50px;display:flex;gap:60px">
  <div style="width:520px"><div class="label" style="color:{PLUM}">Look for</div><div class="small" style="margin-top:12px">Warm eye contact and natural smiles, the villa doorway or surgery softly behind. Even daylight. Leave the left or top third quiet for a Black wash and headline.</div></div>
  <div style="width:520px"><div class="label" style="color:{STOP}">Avoid</div><div class="small" style="margin-top:12px">Generic stock families, instruments, needles, gloved hands in mouths, over-whitened teeth, and before-and-afters without the patient's written consent.</div></div></div>""", 6, 'Photography')


def voice():
    pairs = [('Reassuring', 'We’ll explain everything before anything happens.', 'Pain-free implants, guaranteed!'),
             ('Honest', 'Clear options and a plan built around you.', 'The best prices in Bedford.'),
             ('Welcoming', 'New patients welcome. Late Tuesdays too.', 'Don’t miss out! Book NOW!'),
             ('Local', '16 De Parys Avenue, Bedford.', 'The UK’s number one dental practice.')]
    rows = ''.join(f"""<div style="display:flex;gap:30px;padding:22px 0;border-top:1px solid {BLUSH}">
<div class="h" style="width:260px;font-size:38px"><em>{t}</em></div>
<div style="width:600px"><div class="label" style="font-size:10px;color:{GOLD}">We say</div><div class="body" style="margin-top:6px">{y}</div></div>
<div style="width:540px;opacity:.45"><div class="label" style="font-size:10px">We don’t say</div><div class="body" style="margin-top:6px;text-decoration:line-through">{n}</div></div></div>""" for t, y, n in pairs)
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:80px">How <em>we sound</em></div>
<div class="abs body dim" style="left:80px;top:250px;width:1500px">Gentle, patient-focused and clear, like the dentist who takes time to explain your options. Patients should feel welcomed, informed and at ease. UK English, no em dashes, no outcome guarantees or “pain-free” claims, no specialist titles without GDC confirmation, no finance figures without FCA wording, and urgency only when an offer is genuinely live.</div>
<div class="abs" style="left:80px;top:400px;width:1450px">{rows}</div>""", 7, 'Tone of voice')


def applications():
    return page('cream', f"""
<div class="abs h" style="left:80px;top:130px;font-size:80px;width:560px">In <em>use</em></div>
<div class="abs body dim" style="left:80px;top:250px;width:520px"><p>Meta statics: a real practice photo under a Black wash, the white wordmark, a Poppins headline with its Gold italic turn, crown list cards, the Gold button and the address strip.</p>
<p>Stories keep the logo and copy out of the top 250px and bottom 340px. Review proof uses the live Google count, rechecked before each batch.</p></div>
<div class="abs" style="left:680px;top:150px">{ad_square(0.68)}</div>
<div class="abs label" style="left:680px;top:900px;font-size:11px;opacity:.6">Feed 1:1</div>
<div class="abs" style="left:1440px;top:110px">{ad_story(0.43)}</div>
<div class="abs label" style="left:1440px;top:950px;font-size:11px;opacity:.6">Story 9:16</div>""", 8, 'Applications')


def close():
    return page('black', f"""
<div class="abs" style="left:1240px;top:250px;opacity:.1">{crown_icon(620)}</div>
<div class="abs" style="left:160px;top:250px">{logo(560, True)}</div>
<div class="abs label" style="left:164px;top:560px;font-size:20px;color:{WHITE}">Gentle, patient-focused care in Bedford</div>
<div class="abs small" style="left:164px;top:610px;opacity:.75">{ADDRESS} · 01234 352372</div>
<div class="abs" style="left:164px;top:740px;display:flex;align-items:center;gap:26px"><div class="label" style="font-size:11px;color:{GOLD}">A Kana Health Group practice</div>{img('khg-white.png', 230)}</div>""", dark=True)


def main():
    pages = [cover(), story(), logo_page(), colour(), typography(), elements(), photography(), voice(), applications(), close()]
    head = f'<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>Edward Byrne Associates Brand Guidelines</title><style>{CSS}</style>'
    body = f'</head><body>{"".join(pages)}</body></html>'
    (HERE / 'guideline.html').write_text(head + body)
    (HERE / 'guideline-capture.html').write_text(head + '<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>' + body)
    # single-page capture for re-capturing one artboard: python3 build_guideline.py 8 -> guideline-capture-08.html
    import sys
    for n in sys.argv[1:]:
        one = f'</head><body>{pages[int(n)]}</body></html>'
        (HERE / f'guideline-capture-{int(n):02d}.html').write_text(head + '<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>' + one)
    print('pages', len(pages))


if __name__ == '__main__':
    main()
