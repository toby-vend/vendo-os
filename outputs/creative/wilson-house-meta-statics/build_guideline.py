"""Wilson House Dental Practice brand guideline: HTML harness for Figma capture.

Sources (20 Oct 2026):
- Logo: Drive "Wilson House Full Colour.png" (1gtCTwk6gzrD2Qkf78SKjwXd7l1bPK5l1) and "Wilson House White
  Logo .png" (1hPCO8eo42ltBI3zfVDLvI8kU2c1CPAJC), copied to assets/src. PNG only, no vector. The house,
  crown-rule and crown pieces are straight crops of those files (assets/mark-house-*, crown-rule-*,
  crown-gold.png), never redrawn. crown-white.png is crown-gold.png's alpha filled true white (the white
  logo's own crown is only 74px wide).
- Palette: logo artwork sampled (wordmark #722577, crown + DENTAL PRACTICE #BFA05C, house sketch #575756).
  Site wilsonhousedentalpractice.com: top bar #2A003A, Book Online buttons #4F026B (sampled from a render),
  Elementor globals primary #F8F4EC, secondary #E0C4AB, #D4B8D6. The July 2026 Kana_Wilson_House_FB statics
  (Drive "New Meta Statics for Approval") use #732578 grounds, #D4B8D6 buttons and an #E7C3A8 italic turn.
- Type: site globals are Playfair Display (headings, with italic turns) + Montserrat (body, accent 700).
  Both Google fonts (github google/fonts, assets/fonts). The July statics pair Montserrat Bold headlines
  with a Playfair italic turn; this guideline moves headlines to Playfair to match the logo and the site.
- Photos: Drive Content Assets / Pictures (1jTLqtZLvIDTasJlIQdP7QBzQhNI3-twJ, practice photography) and the
  Frame.io July 2026 shoot (two aerials + one seated portrait, assets/photos/fio). fio-root-unassigned/10.jpg
  is a different building (bay-fronted Victorian semi, no stepped gable) and is not used. No one is named:
  names in the Drive filenames are not confirmed against the live team page.
  assets/photos is gitignored; the harness uses assets/photos/web/ (1800px copies).
- Facts: 5 Station Road, Newport Pagnell, Milton Keynes, MK16 0AG; 01908 611 478; free on-site and
  accessible parking, step-free entrance; Denplan Essentials and Care (homepage). Mon to Fri 8am to 6pm,
  lunch 12:30 to 1:30pm, weekends closed (/contact-us/). Diamond Invisalign Provider (practice Instagram bio,
  embedded on the homepage). 4.9 from 454 Google reviews and the catchment villages: Vendo catchment report in
  Drive Client Bio (July 2026); not re-checkable by curl, so recheck on Google before each batch.

Usage: python3 build_guideline.py  ->  guideline.html + guideline-capture.html (Figma capture)
"""
from pathlib import Path

HERE = Path(__file__).parent

PURPLE, AUB, LILAC, GOLD, BLUSH, WHITE = '#722577', '#2A003A', '#D4B8D6', '#BFA05C', '#E0C4AB', '#FFFFFF'
CREAM, CHAR, INK = '#F8F4EC', '#575756', '#2A003A'
STOP = '#B5523F'


def img(name, w, extra=''):
    return f'<img src="assets/{name}" style="display:block;width:{w}px;{extra}">'


def logo(w, white=False):
    return img('logo-white.png' if white else 'logo-colour.png', w)


def house(w, white=False, extra=''):
    return img('mark-house-white.png' if white else 'mark-house-colour.png', w, extra)


def crown(w, white=True, extra=''):
    return img('crown-white.png' if white else 'crown-gold.png', w, extra)


def crown_rule(w, white=False):
    return img('crown-rule-white.png' if white else 'crown-rule-colour.png', w)


CSS = f"""
@font-face{{font-family:'Playfair Display';src:url('assets/fonts/PlayfairDisplay.ttf');font-weight:400 900;font-style:normal}}
@font-face{{font-family:'Playfair Display';src:url('assets/fonts/PlayfairDisplay-Italic.ttf');font-weight:400 900;font-style:italic}}
@font-face{{font-family:'Montserrat';src:url('assets/fonts/Montserrat.ttf');font-weight:100 900;font-style:normal}}
@font-face{{font-family:'Montserrat';src:url('assets/fonts/Montserrat-Italic.ttf');font-weight:100 900;font-style:italic}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:#d9ccd9;font-family:'Montserrat',sans-serif;font-weight:400;color:{INK};display:flex;flex-direction:column;gap:120px;padding:120px;width:2160px;-webkit-font-smoothing:antialiased}}
.page{{position:relative;width:1920px;height:1080px;overflow:hidden;background:{WHITE}}}
.purple{{background:{PURPLE};color:{WHITE}}} .cream{{background:{CREAM}}}
.abs{{position:absolute}}
.h{{font-family:'Playfair Display',serif;font-weight:400;letter-spacing:-.005em;line-height:1.1;color:{AUB}}}
.purple .h{{color:{WHITE}}}
.h em{{font-style:italic;color:{PURPLE}}}
.purple .h em{{color:{BLUSH}}}
.label{{font-family:'Montserrat',sans-serif;font-weight:600;font-size:14px;letter-spacing:.22em;text-transform:uppercase}}
.body{{font-size:19px;line-height:1.7;color:{CHAR}}} .body p+p{{margin-top:14px}}
.purple .body{{color:{WHITE}}}
.small{{font-size:15px;line-height:1.6}}
.dim{{opacity:.9}}
.ph{{position:absolute;overflow:hidden}}
.ph img{{width:100%;height:100%;object-fit:cover;display:block}}
.full{{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}}
.btn{{display:inline-flex;align-items:center;justify-content:center;background:{LILAC};color:{AUB};font-weight:600;border-radius:4px;white-space:nowrap}}
.pill{{display:flex;align-items:center;border:1.5px solid {BLUSH};background:rgba(255,255,255,.06);border-radius:8px;color:{WHITE};font-weight:600}}
.foot{{position:absolute;left:80px;right:80px;bottom:44px;display:flex;justify-content:space-between}}
.swatch{{position:absolute;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;padding:28px}}
.rule{{height:1px;background:{BLUSH}}}
"""

PIN = '<svg width="{s}" height="{s}" viewBox="0 0 24 24" style="display:block;flex:none"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2z" fill="currentColor"/></svg>'
STAR = '<svg width="{s}" height="{s}" viewBox="0 0 24 24" style="display:block"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill="{c}"/></svg>'
ADDRESS = '5 Station Road, Newport Pagnell, Milton Keynes, MK16 0AG'


def btn(text, size, padx, pady):
    return f'<div class="btn" style="font-size:{size}px;padding:{pady}px {padx}px">{text}</div>'


def pills(items, size, padx, pady, gap, icon):
    return ''.join(f'<div class="pill" style="font-size:{size}px;padding:{pady}px {padx}px;gap:{icon * .7}px;margin-top:{gap if i else 0}px">{crown(icon)}{t}</div>' for i, t in enumerate(items))


def address(size, colour=WHITE, rule=True):
    r = f'<div style="height:1px;background:{colour};opacity:.45;margin-bottom:{size * 1.3}px"></div>' if rule else ''
    return f'<div style="color:{colour}">{r}<div style="display:flex;align-items:center;gap:{size * .6}px;font-size:{size}px;font-weight:500">{PIN.format(s=round(size * 1.3))}{ADDRESS}</div></div>'


def proof(size, colour=AUB, star=GOLD):
    stars = ''.join(STAR.format(s=round(size * 1.1), c=star) for _ in range(5))
    return f'<div style="display:flex;align-items:center;gap:{size * .5}px;color:{colour};font-size:{size}px;font-weight:500;white-space:nowrap"><div style="display:flex;gap:2px">{stars}</div>4.9 from 454 Google reviews</div>'


def wash(direction='180deg', a=.92, b=.35):
    return f'<div class="abs" style="inset:0;background:linear-gradient({direction},rgba(114,37,119,{a}) 0%,rgba(114,37,119,{b}) 100%)"></div>'


def page(cls, body, n=None, title=None, dark=False):
    c = WHITE if dark else AUB
    head = ''
    if title:
        head = f'<div class="abs label" style="left:80px;top:62px;color:{GOLD}">{n:02d}</div><div class="abs label" style="left:130px;top:62px;color:{c};opacity:.8">{title}</div>'
    foot = f'<div class="foot label" style="font-size:11px;color:{c};opacity:.55"><span>wilsonhousedentalpractice.com</span><span>Brand guidelines · 2026</span></div>'
    return f'<section class="page {cls}">{head}{body}{foot}</section>'


def ph(src, x, y, w, h, pos='50% 50%', radius=0):
    return f'<div class="ph" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;border-radius:{radius}"><img src="assets/photos/web/{src}" style="object-position:{pos}"></div>'


# ---------- ads in the system (Applications page) ----------

def ad_square(s):
    return f"""<div style="position:relative;width:{1080 * s}px;height:{1080 * s}px;overflow:hidden;background:{PURPLE}">
<img class="full" src="assets/photos/web/team-purple.jpg" style="object-position:62% 30%">
<div class="abs" style="inset:0;background:linear-gradient(90deg,rgba(114,37,119,.97) 0%,rgba(114,37,119,.92) 46%,rgba(114,37,119,0) 74%)"></div>
<div class="abs" style="left:{70 * s}px;top:{64 * s}px">{logo(210 * s, True)}</div>
<div class="abs h" style="left:{70 * s}px;top:{300 * s}px;width:{560 * s}px;font-size:{64 * s}px;color:{WHITE}">Looking for a new dentist in <em style="color:{BLUSH}">Newport Pagnell?</em></div>
<div class="abs" style="left:{70 * s}px;top:{580 * s}px;width:{520 * s}px">{pills(['Family dentistry', 'Free on-site parking', 'Support for nervous patients'], 24 * s, 22 * s, 16 * s, 14 * s, 32 * s)}</div>
<div class="abs" style="left:{70 * s}px;top:{850 * s}px">{btn('Book Your Appointment', 26 * s, 44 * s, 24 * s)}</div>
<div class="abs" style="left:{70 * s}px;right:{70 * s}px;top:{975 * s}px">{address(17 * s, WHITE, False)}</div>
</div>"""


def ad_story(s):
    return f"""<div style="position:relative;width:{1080 * s}px;height:{1920 * s}px;overflow:hidden;background:{PURPLE}">
<img class="full" src="assets/photos/web/exterior-gate-blossom.jpg" style="object-position:60% 50%">
{wash('180deg', .96, .2)}
<div class="abs" style="left:0;right:0;top:{260 * s}px;display:flex;justify-content:center">{logo(300 * s, True)}</div>
<div class="abs h" style="left:{100 * s}px;right:{100 * s}px;top:{640 * s}px;text-align:center;font-size:{84 * s}px;color:{WHITE}">Your local dentist on <em style="color:{BLUSH}">Station Road</em></div>
<div class="abs" style="left:0;right:0;top:{880 * s}px;display:flex;justify-content:center">{proof(26 * s, WHITE)}</div>
<div class="abs" style="left:0;right:0;top:{1440 * s}px;display:flex;justify-content:center">{btn('Book Your Appointment', 30 * s, 54 * s, 28 * s)}</div>
</div>"""


# ---------- pages ----------

def cover():
    return page('purple', f"""
<img class="full" src="assets/photos/web/aerial.jpg" style="object-position:50% 45%">
<div class="abs" style="inset:0;background:linear-gradient(90deg,rgba(42,0,58,.97) 0%,rgba(114,37,119,.93) 42%,rgba(114,37,119,.3) 100%)"></div>
<div class="abs" style="left:160px;top:230px">{logo(480, True)}</div>
<div class="abs label" style="left:164px;top:740px;font-size:22px;color:{WHITE}">Brand guidelines</div>
<div class="abs label" style="left:164px;top:788px;color:{BLUSH}">Wilson House Dental Practice · Newport Pagnell, Milton Keynes · A Kana Health Group practice</div>""", dark=True)


def story():
    return page('', f"""
<div class="abs h" style="left:80px;top:150px;width:860px;font-size:80px">Caring for every smile in <em>Newport Pagnell</em></div>
<div class="abs body dim" style="left:80px;top:400px;width:780px">
<p>Wilson House is a private practice on Station Road in Newport Pagnell, in the red-brick house its logo is drawn from. It offers check-ups and hygiene, fillings, crowns and bridges, implants and dentures, whitening and bonding, Invisalign and children’s dentistry.</p>
<p>Many patients have been coming for decades and now bring their children and grandchildren. The town is settled and family-minded: people choose a dentist they can trust for years, who explains things clearly and makes nervous patients feel at ease.</p></div>
<div class="abs" style="left:80px;top:800px;width:780px">
  <div class="label" style="color:{GOLD}">Brand idea</div>
  <div class="h" style="font-size:40px;margin-top:14px">Trusted local care for every <em>generation</em>.</div></div>
{ph('team-surgery-2.jpg', 980, 150, 520, 780, '50% 40%')}
<div class="abs" style="left:1550px;top:150px;width:300px">
  <div class="label" style="color:{GOLD}">What sets us apart</div>
  <div class="small" style="margin-top:18px;line-height:2.1;color:{CHAR}">Free on-site, accessible parking<br>Step-free entrance<br>Denplan Essentials and Care<br>Diamond Invisalign Provider</div>
  <div class="rule" style="margin:34px 0"></div>
  <div class="label" style="color:{GOLD}">Proof</div>
  <div style="margin-top:16px">{proof(15)}</div>
  <div class="rule" style="margin:34px 0"></div>
  <div class="label" style="color:{GOLD}">Areas served</div>
  <div class="small" style="margin-top:18px;line-height:2.1;color:{CHAR}">Newport Pagnell · Hanslope<br>Sherington · Emberton<br>Olney · Lathbury<br>Tyringham · Moulsoe</div>
</div>""", 1, 'Who we are')


def logo_page():
    misuse = [
        ('Stretched', f'<div style="transform:scaleX(1.55)">{logo(70)}</div>'),
        ('Recoloured', f'<div style="filter:hue-rotate(150deg) saturate(2)">{logo(92)}</div>'),
        ('Rotated', f'<div style="transform:rotate(-12deg)">{logo(92)}</div>'),
        ('Busy photo, no wash', f'<img class="full" src="assets/photos/web/flowers.jpg"><div style="position:relative">{logo(92, True)}</div>'),
    ]
    mis = ''.join(f"""<div style="width:262px;height:160px;background:{CREAM};position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden">{x}
<svg class="abs" style="left:0;top:0" width="262" height="160"><line x1="16" y1="146" x2="246" y2="14" stroke="{STOP}" stroke-width="2.5"/></svg>
<div class="abs label" style="left:16px;top:14px;font-size:10px;color:{STOP};background:rgba(255,255,255,.85);padding:2px 6px">{t}</div></div>""" for t, x in misuse)
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:72px">The <em>logo</em></div>
<div class="abs body dim" style="left:80px;top:250px;width:540px"><p>A hand-drawn sketch of the practice building, stepped gable and all, above Wilson House in a Purple serif. Beneath sit the Kana Health Group crown on a fine rule, then DENTAL PRACTICE in Gold.</p>
<p>Clear space on every side equals the height of the crown. Minimum width is 120px on screen, 30mm in print.</p>
<p>The house sketch can stand alone as a watermark. The crown alone is a bullet icon. Use the full-colour logo on white or Cream and the white logo on Purple or washed photography. The files are PNG only: crop from them, never redraw or retype.</p></div>
<div class="abs" style="left:700px;top:130px;width:1140px;height:430px;background:{WHITE};border:1px solid {CREAM};display:flex;align-items:center;justify-content:center">
  <div style="position:relative;padding:34px 56px;border:1.5px dashed {BLUSH}">{logo(330)}</div></div>
<div class="abs" style="left:700px;top:590px;width:270px;height:150px;background:{WHITE};border:1px solid {CREAM};display:flex;align-items:center;justify-content:center">{logo(120)}</div>
<div class="abs" style="left:990px;top:590px;width:270px;height:150px;background:{PURPLE};display:flex;align-items:center;justify-content:center">{logo(120, True)}</div>
<div class="abs" style="left:1280px;top:590px;width:270px;height:150px;overflow:hidden"><img class="full" src="assets/photos/web/exterior-blossom.jpg">{wash('180deg', .85, .6)}<div class="abs" style="inset:0;display:flex;align-items:center;justify-content:center">{logo(120, True)}</div></div>
<div class="abs" style="left:1570px;top:590px;width:270px;height:150px;background:{CREAM};display:flex;align-items:center;justify-content:center;gap:30px">{house(130)}{crown(46, False)}</div>
<div class="abs label" style="left:700px;top:752px;font-size:10px;opacity:.7">Full colour on white</div>
<div class="abs label" style="left:990px;top:752px;font-size:10px;opacity:.7">White on Purple</div>
<div class="abs label" style="left:1280px;top:752px;font-size:10px;opacity:.7">On photo, with Purple wash</div>
<div class="abs label" style="left:1570px;top:752px;font-size:10px;opacity:.7">House sketch · crown</div>
<div class="abs label" style="left:700px;top:800px;color:{GOLD}">Misuse</div>
<div class="abs" style="left:700px;top:832px;display:flex;gap:24px">{mis}</div>""", 2, 'Logo')


def colour():
    sw = [
        ('Wilson Purple', PURPLE, 'Main colour: grounds, washes, the wordmark', WHITE, 80, 150, 580, 420, False),
        ('Aubergine', AUB, 'Headlines on light, deep end of washes', WHITE, 680, 150, 580, 420, False),
        ('Cream', CREAM, 'Canvas and soft grounds', AUB, 1280, 150, 560, 420, True),
        ('Lilac', LILAC, 'Buttons on Purple', AUB, 80, 590, 420, 280, False),
        ('Gold', GOLD, 'Crown, stars, fine detail only', WHITE, 520, 590, 420, 280, False),
        ('Blush', BLUSH, 'Italic turn and hairlines on Purple', AUB, 960, 590, 420, 280, False),
    ]
    cards = ''.join(f"""<div class="swatch" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;background:{c};color:{t};{'border:1px solid #EDE6DA;' if b else ''}">
<div style="font-weight:600;font-size:{44 if h > 300 else 30}px">{n}</div><div class="label" style="font-size:12px;margin-top:10px">{c}</div><div class="small" style="margin-top:6px;opacity:.85;font-size:14px">{u}</div></div>""" for n, c, u, t, x, y, w, h, b in sw)
    return page('', f"""{cards}
<div class="abs" style="left:1400px;top:590px;width:440px;height:280px;display:flex">
  <div style="flex:45;background:{PURPLE}"></div><div style="flex:28;background:{CREAM};border:1px solid #EDE6DA"></div><div style="flex:12;background:{AUB}"></div><div style="flex:9;background:{LILAC}"></div><div style="flex:6;background:{GOLD}"></div></div>
<div class="abs label" style="left:1400px;top:882px;font-size:11px;opacity:.7">Balance · 45 / 28 / 12 / 9 / 6</div>
<div class="abs small" style="left:80px;top:900px;width:1240px;color:{CHAR}">Wilson Purple leads and carries most ads, as a solid ground or a wash over real practice photography. Aubergine is the deep end of the wash and the headline colour on light grounds. Lilac is the button, Blush gives headlines their italic turn on Purple, and Gold stays small, as it sits in the logo. Charcoal {CHAR}, the colour of the house sketch, is the body text colour on light. No black panels, no off-palette blues.</div>""", 3, 'Colour')


def typography():
    return page('', f"""
<div class="abs" style="left:80px;top:130px;width:1080px">
  <div class="label" style="color:{GOLD}">Headline · Playfair Display Regular · turn in Playfair Italic, Purple</div>
  <div class="h" style="font-size:108px;margin-top:22px;line-height:1.06">Looking for a new dentist in <em>Newport Pagnell?</em></div>
  <div class="small" style="margin-top:24px;width:860px;color:{CHAR}">Short and plain-spoken, sentence case. The last word or two carry the feeling and turn to Italic: Purple on white, Blush on Purple. Playfair matches the serif of the logo and every heading on the website.</div>
</div>
<div class="abs" style="left:80px;top:660px;width:520px">
  <div class="label" style="color:{GOLD}">Body · Montserrat Regular 400</div>
  <div class="body" style="margin-top:14px">Before you leave the practice, you will always know what happens next.</div>
</div>
<div class="abs" style="left:680px;top:660px;width:480px">
  <div class="label" style="color:{GOLD}">Label · Montserrat SemiBold · caps · +22%</div>
  <div class="label" style="margin-top:20px;font-size:18px;color:{PURPLE}">Station Road · Newport Pagnell</div>
  <div class="label" style="color:{GOLD};margin-top:46px">Button · Montserrat SemiBold · title case</div>
  <div style="margin-top:14px">{btn('Book Your Appointment', 18, 34, 18)}</div>
</div>
<div class="abs purple" style="left:1240px;top:130px;width:600px;height:800px;padding:56px">
  <div class="label" style="color:{BLUSH}">List · Montserrat SemiBold · crown bullet</div>
  <div style="margin-top:30px">{pills(['Detailed dental examination', 'Free on-site parking', 'Support for nervous patients'], 22, 22, 16, 16, 30)}</div>
  <div class="small" style="margin-top:28px;opacity:.8">The current Meta statics already use these outlined cards with the crown bullet. Keep them, and keep claims to what the practice can stand behind.</div>
  <div class="label" style="color:{BLUSH};margin-top:56px">Numerals · Playfair Display</div>
  <div style="display:flex;gap:34px;margin-top:18px;font-family:'Playfair Display',serif;font-size:104px;line-height:1;color:{BLUSH}"><span>4.9</span><span style="color:{WHITE}">454</span></div>
</div>""", 4, 'Typography')


def elements():
    return page('', f"""
<div class="abs" style="left:80px;top:130px;width:520px;height:440px;overflow:hidden">
  <img class="full" src="assets/photos/web/lounge.jpg" style="object-position:70% 50%">
  <div class="abs" style="inset:0;background:linear-gradient(90deg,rgba(114,37,119,.96) 0%,rgba(114,37,119,.7) 38%,rgba(114,37,119,0) 62%)"></div>
  <div class="abs h" style="left:36px;top:150px;width:260px;font-size:40px;color:{WHITE}">Purple <em style="color:{BLUSH}">wash</em></div>
</div>
<div class="abs label" style="left:80px;top:584px;font-size:10px;opacity:.65">Purple wash · 95% to clear, behind every headline on a photo</div>
<div class="abs purple" style="left:640px;top:130px;width:520px;height:440px;padding:60px 56px">
  {pills(['Detailed dental examination', 'Free on-site parking', 'Support for nervous patients'], 20, 20, 15, 14, 28)}
</div>
<div class="abs label" style="left:640px;top:584px;font-size:10px;opacity:.65">Outlined list cards · Blush hairline, crown bullet</div>
<div class="abs" style="left:1200px;top:130px;width:640px;height:440px;background:{CREAM};overflow:hidden">
  <div class="abs" style="left:230px;top:150px;opacity:.14">{house(560)}</div>
  <div class="abs" style="left:60px;top:150px">{crown_rule(300)}</div>
  <div class="abs label" style="left:60px;top:200px;font-size:12px;color:{PURPLE}">Crown rule · from the logo</div>
</div>
<div class="abs label" style="left:1200px;top:584px;font-size:10px;opacity:.65">House sketch watermark at 10–16% off an edge · crown rule as a divider</div>
<div class="abs purple" style="left:80px;top:650px;width:1080px;height:260px;padding:56px 50px">
  {address(22)}
  <div style="margin-top:34px">{proof(20, WHITE)}</div>
</div>
<div class="abs label" style="left:80px;top:924px;font-size:10px;opacity:.65">Address strip with hairline, and review proof · Gold stars</div>
<div class="abs" style="left:1200px;top:650px;width:640px;height:260px;background:{PURPLE};padding:44px 50px">
  <div class="label" style="color:{BLUSH}">Call to action</div>
  <div style="display:flex;gap:20px;margin-top:30px;align-items:center">{btn('Book Your Appointment', 16, 24, 16)}{btn('Request An Appointment', 16, 24, 16)}</div>
  <div class="small" style="margin-top:24px;color:{WHITE};opacity:.8">Lilac fill, Aubergine text, 4px corners. Say what happens next.</div></div>""", 5, 'Graphic elements')


def photography():
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:72px;width:520px">Our team, <em>our house</em></div>
<div class="abs body dim" style="left:80px;top:330px;width:500px">
<p>Real people in the real practice. The team in purple scrubs, bright surgeries with tall sash windows, the mustard chairs of the waiting room, and the red-brick house on Station Road that the logo is drawn from.</p>
<p>Name a team member only when the name is confirmed on the website team page. Never caption anyone as a specific dentist on a guess.</p></div>
{ph('chair-portrait.jpg', 640, 130, 380, 520, '50% 62%')}
{ph('aerial.jpg', 1050, 130, 790, 250, '50% 45%')}
{ph('nook.jpg', 1050, 400, 385, 250, '50% 55%')}
{ph('team-purple.jpg', 1455, 400, 385, 250, '50% 30%')}
<div class="abs cream" style="left:640px;top:690px;width:1200px;height:250px;padding:40px 50px;display:flex;gap:60px">
  <div style="width:520px"><div class="label" style="color:{PURPLE}">Look for</div><div class="small" style="margin-top:12px;color:{CHAR}">Warm eye contact and natural smiles. Purple scrubs, soft window light, the stepped gable and blossom outside. Leave the left or top third quiet for a Purple wash and headline.</div></div>
  <div style="width:520px"><div class="label" style="color:{STOP}">Avoid</div><div class="small" style="margin-top:12px;color:{CHAR}">Stock models, instruments, needles, gloved hands in mouths, over-whitened teeth, and before-and-afters without the patient's written consent.</div></div></div>""", 6, 'Photography')


def voice():
    pairs = [('Reassuring', 'We’ll take time to explain each step.', 'Pain-free dentistry, guaranteed!'),
             ('Honest', 'Clear advice and a care plan built around you.', 'The best dentist in Milton Keynes.'),
             ('Warm', 'From first check-ups to grandparents, all under one roof.', 'Don’t miss out! Book NOW!'),
             ('Local', 'On Station Road, with free parking on site.', 'The UK’s number one dental practice.')]
    rows = ''.join(f"""<div style="display:flex;gap:30px;padding:22px 0;border-top:1px solid {BLUSH}">
<div class="h" style="width:260px;font-size:38px"><em>{t}</em></div>
<div style="width:600px"><div class="label" style="font-size:10px;color:{GOLD}">We say</div><div class="body" style="margin-top:6px">{y}</div></div>
<div style="width:540px;opacity:.45"><div class="label" style="font-size:10px">We don’t say</div><div class="body" style="margin-top:6px;text-decoration:line-through">{n}</div></div></div>""" for t, y, n in pairs)
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:80px">How <em>we sound</em></div>
<div class="abs body dim" style="left:80px;top:250px;width:1500px">Friendly, family-centred and clear, like a dentist the whole family has known for years. Patients should always know what happens next. UK English, no em dashes, no outcome guarantees or “pain-free” claims, no finance figures without FCA wording, and urgency only when an offer is genuinely live.</div>
<div class="abs" style="left:80px;top:400px;width:1450px">{rows}</div>""", 7, 'Tone of voice')


def applications():
    return page('cream', f"""
<div class="abs h" style="left:80px;top:130px;font-size:80px;width:560px">In <em>use</em></div>
<div class="abs body dim" style="left:80px;top:250px;width:520px"><p>Meta statics: a real practice photo under a Purple wash, the white logo, a Playfair headline with its Italic turn, crown list cards, the Lilac button and the address strip.</p>
<p>Stories keep the logo and copy out of the top 250px and bottom 340px. Review proof uses the live Google count, rechecked before each batch.</p></div>
<div class="abs" style="left:680px;top:150px">{ad_square(0.68)}</div>
<div class="abs label" style="left:680px;top:900px;font-size:11px;opacity:.6">Feed 1:1</div>
<div class="abs" style="left:1440px;top:110px">{ad_story(0.43)}</div>
<div class="abs label" style="left:1440px;top:950px;font-size:11px;opacity:.6">Story 9:16</div>""", 8, 'Applications')


def close():
    return page('purple', f"""
<div class="abs" style="left:1020px;top:330px;opacity:.12">{house(1000, True)}</div>
<div class="abs" style="left:160px;top:230px">{logo(420, True)}</div>
<div class="abs label" style="left:164px;top:700px;font-size:20px;color:{WHITE}">Caring for every smile</div>
<div class="abs small" style="left:164px;top:750px;opacity:.8">{ADDRESS} · 01908 611 478</div>""", dark=True)


def main():
    pages = [cover(), story(), logo_page(), colour(), typography(), elements(), photography(), voice(), applications(), close()]
    head = f'<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>Wilson House Brand Guidelines</title><style>{CSS}</style>'
    body = f'</head><body>{"".join(pages)}</body></html>'
    (HERE / 'guideline.html').write_text(head + body)
    (HERE / 'guideline-capture.html').write_text(head + '<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>' + body)
    print('pages', len(pages))


if __name__ == '__main__':
    main()
