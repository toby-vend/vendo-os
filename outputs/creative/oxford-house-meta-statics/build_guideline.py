"""Oxford House Dental Practice brand guideline: HTML harness for Figma capture.

Sources (20 Oct 2026):
- Logo: Drive "Oxford House Full Colour.png" (1kse8r3v0e-8xbTHquOJ0fJybf6dtEuu3), the stacked lock-up, trimmed
  to assets/logo-colour.png. Horizontal lock-up = the site header file
  mkdentist.co.uk/wp-content/uploads/2021/10/Oxford-House-Logo-main-header.png (assets/logo-h-colour.png).
  The Drive "Oxford House White Logo .png" keeps a teal wordmark, so logo-white / logo-h-white / mark-* white
  files are true white versions made by recolouring the alpha of the colour files. The house sketch and the
  crown rule are straight crops of the stacked file (assets/mark-house-*, crown-rule-*, crown-*), never redrawn.
  The gold crown in the rule is the Kana Health Group crown (Drive "KHG Navy Logo", 1v4Wz1OlRxQy8HKUsHDmP8yavOM4jKlLl).
- Palette: LP Elementor globals on lp.mkdentist.co.uk (#06444B, #0F717A primary, #27A1AC, #14B1BF accent,
  #BFA15C secondary) with #EEF6F6 / #1E2B2D from the same LP CSS. The main site theme CSS
  (wp-content/themes/oxford/css) carries the same set (#06454b, #13727b, #27a0ab, #13b1bf, #bfa15c), and the logo
  artwork samples #28A0AC wordmark, #BC9F5C crown, #545454 house sketch.
- Type: Josefin Sans (headings, 700) + Poppins (body) on both the site and the LP; the July 2026
  Kana_Oxford_House_FB statics (Drive, Meta Ads > New Meta Statics for Approval) set headlines in Josefin Sans
  Bold with a Josefin light italic turn. Both Google fonts (assets/fonts). The site also uses a script face
  (Silentmind) on a few old headings; not carried into this system.
- Photos: Joe Goodchild's July 2026 shoot (Frame.io), assets/photos/fio-portraits + fio-practice; the harness uses
  1800px copies in assets/photos/web/ (gitignored). Nobody is named in this guideline.
- Facts: Aylesbury Street, Fenny Stratford, Milton Keynes, MK2 2BA; 01908 373614; Mon, Tue, Thu, Fri 8am-5:30pm,
  Wed 8am-6pm, Sat 8am-2pm, Sun closed; "A kind and caring approach", "family-orientated practice", "put you at
  ease and make you feel at home", "GDC-registered specialists in periodontics and endodontics", the Referral
  Centre and the specialist orthodontist (all mkdentist.co.uk homepage, 20 Oct 2026). Reviews: 4.8 stars
  (Google Maps, 2 Oct 2026, 956 reviews) and "950+ Google Reviews" / "Based on 953 reviews" (LP review widget,
  20 Oct 2026).

Usage: python3 build_guideline.py  ->  guideline.html + guideline-capture.html (Figma capture)
"""
from pathlib import Path

HERE = Path(__file__).parent

DEEP, TEAL, LOGO, BRIGHT, GOLD, WHITE = '#06444B', '#0F717A', '#27A1AC', '#14B1BF', '#BFA15C', '#FFFFFF'
MIST, MIST2, INK, PENCIL = '#EEF6F6', '#D5E7E8', '#1E2B2D', '#545454'
STOP = '#B5523F'


def img(name, w, extra=''):
    return f'<img src="assets/{name}" style="display:block;width:{w}px;{extra}">'


def logo(w, white=False):
    return img('logo-white.png' if white else 'logo-colour.png', w)


def logo_h(w, white=False):
    return img('logo-h-white.png' if white else 'logo-h-colour.png', w)


def house(w, white=False, extra=''):
    return img('mark-house-white.png' if white else 'mark-house-colour.png', w, extra)


def crown(w, white=False, extra=''):
    return img('crown-white.png' if white else 'crown-colour.png', w, extra)


def crown_rule(w, white=False):
    return img('crown-rule-white.png' if white else 'crown-rule-colour.png', w)


CSS = f"""
@font-face{{font-family:'Poppins';src:url('assets/fonts/Poppins-Light.ttf');font-weight:300;font-style:normal}}
@font-face{{font-family:'Poppins';src:url('assets/fonts/Poppins-Regular.ttf');font-weight:400;font-style:normal}}
@font-face{{font-family:'Poppins';src:url('assets/fonts/Poppins-Italic.ttf');font-weight:400;font-style:italic}}
@font-face{{font-family:'Poppins';src:url('assets/fonts/Poppins-Medium.ttf');font-weight:500;font-style:normal}}
@font-face{{font-family:'Poppins';src:url('assets/fonts/Poppins-SemiBold.ttf');font-weight:600;font-style:normal}}
@font-face{{font-family:'Josefin Sans';src:url('assets/fonts/JosefinSans.ttf');font-weight:100 700;font-style:normal}}
@font-face{{font-family:'Josefin Sans';src:url('assets/fonts/JosefinSans-Italic.ttf');font-weight:100 700;font-style:italic}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:#c9d8d9;font-family:'Poppins',sans-serif;font-weight:400;color:{INK};display:flex;flex-direction:column;gap:120px;padding:120px;width:2160px;-webkit-font-smoothing:antialiased}}
.page{{position:relative;width:1920px;height:1080px;overflow:hidden;background:{WHITE}}}
.deep{{background:{DEEP};color:{WHITE}}} .mist{{background:{MIST}}}
.abs{{position:absolute}}
.h{{font-family:'Josefin Sans',sans-serif;font-weight:700;letter-spacing:-.005em;line-height:1.08;color:{DEEP}}}
.deep .h{{color:{WHITE}}}
.h em{{font-style:italic;font-weight:300;color:{LOGO}}}
.deep .h em{{color:{BRIGHT}}}
.label{{font-family:'Josefin Sans',sans-serif;font-weight:600;font-size:15px;letter-spacing:.2em;text-transform:uppercase}}
.body{{font-size:19px;line-height:1.7}} .body p+p{{margin-top:14px}}
.small{{font-size:15px;line-height:1.6}}
.dim{{opacity:.82}}
.ph{{position:absolute;overflow:hidden}}
.ph img{{width:100%;height:100%;object-fit:cover;display:block}}
.full{{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}}
.btn{{display:inline-flex;align-items:center;justify-content:center;background:{BRIGHT};color:{WHITE};font-family:'Josefin Sans',sans-serif;font-weight:700;letter-spacing:.02em;border-radius:8px;white-space:nowrap}}
.btn.mist{{background:{MIST};color:{DEEP}}}
.pill{{display:flex;align-items:center;border:1.5px solid rgba(255,255,255,.5);background:rgba(255,255,255,.07);border-radius:10px;color:{WHITE};font-weight:500}}
.foot{{position:absolute;left:80px;right:80px;bottom:44px;display:flex;justify-content:space-between}}
.swatch{{position:absolute;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;padding:28px}}
.rule{{height:1px;background:{MIST2}}}
"""

PIN = '<svg width="{s}" height="{s}" viewBox="0 0 24 24" style="display:block;flex:none"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2z" fill="currentColor"/></svg>'
STAR = '<svg width="{s}" height="{s}" viewBox="0 0 24 24" style="display:block"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill="{c}"/></svg>'
ADDRESS = 'Aylesbury Street, Fenny Stratford, Milton Keynes, MK2 2BA'
REVIEWS = '4.8 from 950+ Google reviews'


def btn(text, size, padx, pady, kind=''):
    # Josefin sits high on its baseline; a little extra top padding centres it optically
    return f'<div class="btn {kind}" style="font-size:{size}px;padding:{pady * 1.12}px {padx}px {pady * .88}px">{text}</div>'


def pills(items, size, padx, pady, gap, icon):
    return ''.join(f'<div class="pill" style="font-size:{size}px;padding:{pady}px {padx}px;gap:{icon * .6}px;margin-top:{gap if i else 0}px">{crown(icon, False)}{t}</div>' for i, t in enumerate(items))


def address(size, colour=WHITE, rule=True):
    r = f'<div style="height:1px;background:{colour};opacity:.45;margin-bottom:{size * 1.3}px"></div>' if rule else ''
    return f'<div style="color:{colour}">{r}<div style="display:flex;align-items:center;gap:{size * .6}px;font-size:{size}px;font-weight:500">{PIN.format(s=round(size * 1.3))}{ADDRESS}</div></div>'


def proof(size, colour=DEEP, star=GOLD):
    stars = ''.join(STAR.format(s=round(size * 1.1), c=star) for _ in range(5))
    return f'<div style="display:flex;align-items:center;gap:{size * .5}px;color:{colour};font-size:{size}px;font-weight:500"><div style="display:flex;gap:2px">{stars}</div>{REVIEWS}</div>'


def wash(direction='180deg', a=.92, b=.35):
    return f'<div class="abs" style="inset:0;background:linear-gradient({direction},rgba(6,68,75,{a}) 0%,rgba(6,68,75,{b}) 100%)"></div>'


def page(cls, body, n=None, title=None, dark=False):
    c = WHITE if dark else DEEP
    head = ''
    if title:
        head = f'<div class="abs label" style="left:80px;top:62px;color:{GOLD}">{n:02d}</div><div class="abs label" style="left:130px;top:62px;color:{c};opacity:.8">{title}</div>'
    foot = f'<div class="foot label" style="font-size:11px;color:{c};opacity:.55"><span>mkdentist.co.uk</span><span>Brand guidelines · 2026</span></div>'
    return f'<section class="page {cls}">{head}{body}{foot}</section>'


def ph(src, x, y, w, h, pos='50% 50%', radius=0):
    return f'<div class="ph" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;border-radius:{radius}px"><img src="assets/photos/web/{src}" style="object-position:{pos}"></div>'


# ---------- ads in the system (Applications page) ----------

def ad_square(s):
    return f"""<div style="position:relative;width:{1080 * s}px;height:{1080 * s}px;overflow:hidden;background:{DEEP}">
<img class="full" src="assets/photos/web/portraits-35.jpg" style="object-position:50% 30%;left:{260 * s}px;width:{820 * s}px">
<div class="abs" style="inset:0;background:linear-gradient(90deg,rgba(6,68,75,1) 0%,rgba(6,68,75,.94) 40%,rgba(6,68,75,0) 70%)"></div>
<div class="abs" style="left:{70 * s}px;top:{70 * s}px">{logo_h(330 * s, True)}</div>
<div class="abs h" style="left:{70 * s}px;top:{270 * s}px;width:{560 * s}px;font-size:{64 * s}px;color:{WHITE}">A kind and caring <em style="color:{BRIGHT}">approach</em></div>
<div class="abs" style="left:{70 * s}px;top:{540 * s}px;width:{500 * s}px">{pills(['Family-orientated care', 'Specialists under one roof', 'Open Saturday mornings'], 24 * s, 22 * s, 16 * s, 14 * s, 30 * s)}</div>
<div class="abs" style="left:{70 * s}px;top:{830 * s}px">{btn('Book Your Appointment', 28 * s, 44 * s, 24 * s)}</div>
<div class="abs" style="left:{70 * s}px;right:{70 * s}px;top:{975 * s}px">{address(17 * s, WHITE, False)}</div>
</div>"""


def ad_story(s):
    return f"""<div style="position:relative;width:{1080 * s}px;height:{1920 * s}px;overflow:hidden;background:{DEEP}">
<img class="full" src="assets/photos/web/practice-1.jpg" style="object-position:40% 50%">
<div class="abs" style="inset:0;background:linear-gradient(180deg,rgba(6,68,75,.97) 0%,rgba(6,68,75,.9) 50%,rgba(6,68,75,.3) 100%)"></div>
<div class="abs" style="left:0;right:0;top:{250 * s}px;display:flex;justify-content:center">{logo(330 * s, True)}</div>
<div class="abs h" style="left:{90 * s}px;right:{90 * s}px;top:{620 * s}px;text-align:center;font-size:{80 * s}px;color:{WHITE}">Make yourself <em style="color:{BRIGHT}">at home</em></div>
<div class="abs" style="left:0;right:0;top:{830 * s}px;display:flex;justify-content:center">{proof(26 * s, WHITE)}</div>
<div class="abs" style="left:0;right:0;top:{1450 * s}px;display:flex;justify-content:center">{btn('Book Your Appointment', 32 * s, 54 * s, 28 * s)}</div>
</div>"""


# ---------- pages ----------

def cover():
    return page('deep', f"""
<img class="full" src="assets/photos/web/practice-1.jpg" style="object-position:50% 45%">
<div class="abs" style="inset:0;background:linear-gradient(90deg,rgba(6,68,75,.98) 0%,rgba(6,68,75,.93) 40%,rgba(6,68,75,.3) 100%)"></div>
<div class="abs" style="left:160px;top:200px">{logo(470, True)}</div>
<div class="abs label" style="left:164px;top:640px;font-size:22px;color:{WHITE}">Brand guidelines</div>
<div class="abs label" style="left:164px;top:688px;color:{BRIGHT}">Oxford House Dental Practice · Fenny Stratford, Milton Keynes · A Kana Health Group practice</div>""", dark=True)


def story():
    return page('', f"""
<div class="abs h" style="left:80px;top:150px;width:860px;font-size:80px">A kind and caring <em>approach</em></div>
<div class="abs body dim" style="left:80px;top:400px;width:780px">
<p>Oxford House is a family-orientated practice on Aylesbury Street in Fenny Stratford, in the south of Milton Keynes. From check-ups and hygiene to Invisalign, whitening, implants and facial aesthetics, the team takes pride in a gentle, caring approach.</p>
<p>It is also a referral centre. The team includes GDC-registered specialists in periodontics and endodontics and a specialist orthodontist, so complex work can be handled in-house rather than referred elsewhere.</p></div>
<div class="abs" style="left:80px;top:790px;width:820px">
  <div class="label" style="color:{GOLD}">Brand idea</div>
  <div class="h" style="font-size:38px;margin-top:14px">We put you at ease and<br>make you <em>feel at home.</em></div></div>
{ph('practice-33.jpg', 980, 150, 540, 780, '50% 55%')}
<div class="abs" style="left:1570px;top:150px;width:290px">
  <div class="label" style="color:{GOLD}">What sets us apart</div>
  <div class="small" style="margin-top:18px;line-height:2.1">Specialists under one roof<br>The Referral Centre<br>Family-orientated care<br>Open Saturday mornings</div>
  <div class="rule" style="margin:30px 0"></div>
  <div class="label" style="color:{GOLD}">Proof</div>
  <div style="margin-top:16px;white-space:nowrap">{proof(13)}</div>
  <div class="rule" style="margin:30px 0"></div>
  <div class="label" style="color:{GOLD}">Opening times</div>
  <div class="small" style="margin-top:18px;line-height:2.1">Mon, Tue, Thu, Fri · 8am to 5:30pm<br>Wednesday · 8am to 6pm<br>Saturday · 8am to 2pm<br>Sunday · Closed</div>
</div>""", 1, 'Who we are')


def logo_page():
    misuse = [
        ('Stretched', f'<div style="transform:scaleX(1.5)">{logo_h(120)}</div>'),
        ('Recoloured', f'<div style="filter:hue-rotate(170deg) saturate(2)">{logo_h(170)}</div>'),
        ('Rotated', f'<div style="transform:rotate(-12deg)">{logo_h(170)}</div>'),
        ('Busy photo, no wash', f'<img class="full" src="assets/photos/web/practice-11.jpg"><div style="position:relative">{logo_h(170, True)}</div>'),
    ]
    mis = ''.join(f"""<div style="width:262px;height:160px;background:{MIST};position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden">{x}
<svg class="abs" style="left:0;top:0" width="262" height="160"><line x1="16" y1="146" x2="246" y2="14" stroke="{STOP}" stroke-width="2.5"/></svg>
<div class="abs label" style="left:16px;top:14px;font-size:10px;color:{STOP};background:rgba(255,255,255,.85);padding:2px 6px">{t}</div></div>""" for t, x in misuse)
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:72px">The <em>logo</em></div>
<div class="abs body dim" style="left:80px;top:250px;width:540px"><p>A pencil sketch of the house itself over Oxford House in Teal, then the Kana Health Group crown on a hairline rule and DENTAL PRACTICE in Gold.</p>
<p>Clear space on every side equals the height of the crown. Use the stacked logo where there is room and the horizontal logo in tight spaces. Minimum width is 140px on screen, 35mm in print.</p>
<p>Full colour on white or Mist, white on Deep Teal or washed photography. The files are PNG only: crop from them, never redraw or retype.</p></div>
<div class="abs" style="left:700px;top:130px;width:1140px;height:430px;background:{WHITE};border:1px solid {MIST2};display:flex;align-items:center;justify-content:center">
  <div style="position:relative;padding:34px 46px;border:1.5px dashed {LOGO}">{logo(330)}</div></div>
<div class="abs" style="left:700px;top:590px;width:270px;height:150px;background:{WHITE};border:1px solid {MIST2};display:flex;align-items:center;justify-content:center">{logo_h(210)}</div>
<div class="abs" style="left:990px;top:590px;width:270px;height:150px;background:{DEEP};display:flex;align-items:center;justify-content:center">{logo_h(210, True)}</div>
<div class="abs" style="left:1280px;top:590px;width:270px;height:150px;overflow:hidden"><img class="full" src="assets/photos/web/practice-12.jpg">{wash('180deg', .85, .6)}<div class="abs" style="inset:0;display:flex;align-items:center;justify-content:center">{logo(120, True)}</div></div>
<div class="abs" style="left:1570px;top:590px;width:270px;height:150px;background:{MIST};display:flex;align-items:center;justify-content:center;gap:34px">{house(120)}{crown(44)}</div>
<div class="abs label" style="left:700px;top:752px;font-size:10px;opacity:.7">Horizontal on white</div>
<div class="abs label" style="left:990px;top:752px;font-size:10px;opacity:.7">White on Deep Teal</div>
<div class="abs label" style="left:1280px;top:752px;font-size:10px;opacity:.7">On photo, with Deep Teal wash</div>
<div class="abs label" style="left:1570px;top:752px;font-size:10px;opacity:.7">House sketch · Kana crown</div>
<div class="abs label" style="left:700px;top:800px;color:{GOLD}">Misuse</div>
<div class="abs" style="left:700px;top:832px;display:flex;gap:24px">{mis}</div>""", 2, 'Logo')


def colour():
    sw = [
        ('Deep Teal', DEEP, 'Main ground: washes, panels, headlines', WHITE, 80, 150, 580, 420, False),
        ('Oxford Teal', TEAL, 'Site primary. Secondary grounds, links', WHITE, 680, 150, 580, 420, False),
        ('White', WHITE, 'Canvas and type on Deep Teal', DEEP, 1280, 150, 560, 420, True),
        ('Logo Teal', LOGO, 'The wordmark. Headline turns on white', WHITE, 80, 590, 310, 280, False),
        ('Bright Teal', BRIGHT, 'Buttons and turns on Deep Teal', WHITE, 410, 590, 310, 280, False),
        ('Gold', GOLD, 'Crown, stars, labels, fine detail', WHITE, 740, 590, 310, 280, False),
        ('Mist', MIST, 'Soft grounds and light buttons', DEEP, 1070, 590, 310, 280, False),
    ]
    cards = ''.join(f"""<div class="swatch" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;background:{c};color:{t};{'border:1px solid ' + MIST2 + ';' if b else ''}">
<div class="h" style="color:inherit;font-size:{44 if h > 300 else 30}px">{n}</div><div class="label" style="font-size:12px;margin-top:10px">{c}</div><div class="small" style="margin-top:6px;opacity:.85;font-size:14px">{u}</div></div>""" for n, c, u, t, x, y, w, h, b in sw)
    return page('', f"""{cards}
<div class="abs" style="left:1400px;top:590px;width:440px;height:280px;display:flex">
  <div style="flex:40;background:{DEEP}"></div><div style="flex:28;background:{WHITE};border:1px solid {MIST2}"></div><div style="flex:12;background:{MIST}"></div><div style="flex:9;background:{LOGO}"></div><div style="flex:7;background:{BRIGHT}"></div><div style="flex:4;background:{GOLD}"></div></div>
<div class="abs label" style="left:1400px;top:882px;font-size:11px;opacity:.7">Balance · 40 / 28 / 12 / 9 / 7 / 4</div>
<div class="abs small dim" style="left:80px;top:900px;width:1260px">Deep Teal leads and carries most ads, usually as a wash over real practice photography. Logo Teal gives headlines their soft turn on white, Bright Teal is the button and the turn on dark, and Gold stays small, as it sits in the logo. Body text is Ink {INK}. The pencil grey of the house sketch ({PENCIL}) lives in the logo only. No black panels, no off-palette blues.</div>""", 3, 'Colour')


def typography():
    return page('', f"""
<div class="abs" style="left:80px;top:130px;width:1080px">
  <div class="label" style="color:{GOLD}">Headline · Josefin Sans Bold 700 · turn in Josefin Sans Light Italic</div>
  <div class="h" style="font-size:112px;margin-top:22px;line-height:1.04">Love your <em>smile</em></div>
  <div class="small dim" style="margin-top:24px;width:860px">Short and warm, sentence case. The last word or two carry the feeling and are set in Light Italic: Logo Teal on white, Bright Teal on Deep Teal. This is how the website hero and the practice's current ads already read.</div>
</div>
<div class="abs" style="left:80px;top:640px;width:520px">
  <div class="label" style="color:{GOLD}">Body · Poppins Regular 400</div>
  <div class="body dim" style="margin-top:14px">Whether you’re visiting for a check-up or more extensive dental treatment, our friendly team will put you at ease and make you feel at home.</div>
</div>
<div class="abs" style="left:680px;top:640px;width:480px">
  <div class="label" style="color:{GOLD}">Label · Josefin SemiBold caps +20%</div>
  <div class="label" style="margin-top:20px;font-size:18px;color:{DEEP}">Fenny Stratford · Milton Keynes</div>
  <div class="label" style="color:{GOLD};margin-top:46px">Button · Josefin Sans Bold · title case</div>
  <div style="margin-top:14px">{btn('Book Your Appointment', 20, 34, 18)}</div>
</div>
<div class="abs deep" style="left:1240px;top:130px;width:600px;height:800px;padding:56px">
  <div class="label" style="color:{BRIGHT}">List · Poppins Medium · Kana crown bullet</div>
  <div style="margin-top:30px">{pills(['Family-orientated care', 'Specialists under one roof', 'Open Saturday mornings'], 22, 22, 16, 16, 28)}</div>
  <div class="small" style="margin-top:28px;opacity:.75">Website and landing page headings use Josefin Sans Bold too, so ads, web and print share one voice.</div>
  <div class="label" style="color:{BRIGHT};margin-top:56px">Numerals · Josefin Sans Light</div>
  <div style="display:flex;gap:34px;margin-top:18px;font-family:'Josefin Sans',sans-serif;font-weight:300;font-size:104px;line-height:1;color:{BRIGHT}"><span>4.8</span><span style="color:{WHITE}">950+</span></div>
</div>""", 4, 'Typography')


def elements():
    return page('', f"""
<div class="abs" style="left:80px;top:130px;width:520px;height:440px;overflow:hidden">
  <img class="full" src="assets/photos/web/practice-12.jpg" style="object-position:60% 50%">
  <div class="abs" style="inset:0;background:linear-gradient(90deg,rgba(6,68,75,.97) 0%,rgba(6,68,75,.72) 38%,rgba(6,68,75,0) 64%)"></div>
  <div class="abs h" style="left:36px;top:150px;width:260px;font-size:40px;color:{WHITE}">Deep Teal <em style="color:{BRIGHT}">wash</em></div>
</div>
<div class="abs label" style="left:80px;top:584px;font-size:10px;opacity:.65">Deep Teal wash · 95% to clear, behind every headline on a photo</div>
<div class="abs deep" style="left:640px;top:130px;width:520px;height:440px;padding:60px 56px">
  {pills(['Family-orientated care', 'Specialists under one roof', 'Open Saturday mornings'], 20, 20, 15, 14, 26)}
</div>
<div class="abs label" style="left:640px;top:584px;font-size:10px;opacity:.65">Outlined list cards · white hairline, Kana crown bullet</div>
<div class="abs" style="left:1200px;top:130px;width:640px;height:440px;background:{MIST};overflow:hidden">
  <div class="abs" style="left:250px;top:120px;opacity:.14">{house(470)}</div>
  <div class="abs" style="left:60px;top:150px">{crown_rule(300)}</div>
  <div class="abs label" style="left:60px;top:200px;font-size:12px;color:{DEEP}">Crown rule · from the logo</div>
</div>
<div class="abs label" style="left:1200px;top:584px;font-size:10px;opacity:.65">House sketch watermark at 10–16% off an edge · crown rule as a divider</div>
<div class="abs deep" style="left:80px;top:650px;width:1080px;height:260px;padding:56px 50px">
  {address(22)}
  <div style="margin-top:34px">{proof(20, WHITE)}</div>
</div>
<div class="abs label" style="left:80px;top:924px;font-size:10px;opacity:.65">Address strip with hairline, and review proof · Gold stars</div>
<div class="abs" style="left:1200px;top:650px;width:640px;height:260px;background:{DEEP};padding:44px 50px">
  <div class="label" style="color:{BRIGHT}">Call to action</div>
  <div style="display:flex;gap:20px;margin-top:30px;align-items:center">{btn('Book Your Appointment', 17, 24, 17)}{btn('Book Your Consultation', 17, 24, 17, 'mist')}</div>
  <div class="small" style="margin-top:24px;color:{WHITE};opacity:.75">Bright Teal or Mist fill, 8px corners. Say what happens next.</div></div>""", 5, 'Graphic elements')


def photography():
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:72px;width:520px">Our team, <em>our house</em></div>
<div class="abs body dim" style="left:80px;top:330px;width:500px">
<p>Real people in the real practice. The team in Oxford House teal scrubs, the navy lounge with its velvet chairs, the logo wall in reception, and the red-brick house that patients will recognise from the logo.</p>
<p>Use a person’s name only when it is confirmed against the website team page. This guideline names no one.</p></div>
{ph('portraits-35.jpg', 640, 130, 380, 520, '50% 30%')}
{ph('practice-12.jpg', 1050, 130, 790, 250, '50% 60%')}
{ph('practice-9.jpg', 1050, 400, 385, 250, '50% 45%')}
{ph('practice-31.jpg', 1455, 400, 385, 250, '50% 40%')}
<div class="abs mist" style="left:640px;top:690px;width:1200px;height:250px;padding:40px 50px;display:flex;gap:60px">
  <div style="width:520px"><div class="label" style="color:{DEEP}">Look for</div><div class="small" style="margin-top:12px">Warm eye contact and natural smiles, the navy lounge or bright surgeries softly behind. Bright, even light. Leave the left or top third quiet for a Deep Teal wash and headline.</div></div>
  <div style="width:520px"><div class="label" style="color:{STOP}">Avoid</div><div class="small" style="margin-top:12px">Generic stock families, instruments, needles, gloved hands in mouths, over-whitened teeth, and before-and-afters without the patient’s written consent.</div></div></div>""", 6, 'Photography')


def voice():
    pairs = [('Kind', 'We’ll put you at ease and explain every step.', 'Pain-free dentistry, guaranteed!'),
             ('Expert', 'Specialists in gum and root canal care, under one roof.', 'The best dentists in Milton Keynes.'),
             ('Homely', 'Make yourself at home. Saturday mornings too.', 'Don’t miss out! Book NOW!'),
             ('Local', 'On Aylesbury Street in Fenny Stratford, MK2.', 'The UK’s number one dental practice.')]
    rows = ''.join(f"""<div style="display:flex;gap:30px;padding:22px 0;border-top:1px solid {MIST2}">
<div class="h" style="width:260px;font-size:38px"><em>{t}</em></div>
<div style="width:600px"><div class="label" style="font-size:10px;color:{GOLD}">We say</div><div class="body" style="margin-top:6px">{y}</div></div>
<div style="width:540px;opacity:.45"><div class="label" style="font-size:10px">We don’t say</div><div class="body" style="margin-top:6px;text-decoration:line-through">{n}</div></div></div>""" for t, y, n in pairs)
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:80px">How <em>we sound</em></div>
<div class="abs body dim" style="left:80px;top:250px;width:1500px">Kind, family-centred and quietly expert, like a practice that has looked after the same families for decades. Patients should feel at ease and at home. UK English, no em dashes, no outcome guarantees or “pain-free” claims, no finance figures without FCA wording, and urgency only when an offer is genuinely live.</div>
<div class="abs" style="left:80px;top:400px;width:1450px">{rows}</div>""", 7, 'Tone of voice')


def applications():
    return page('mist', f"""
<div class="abs h" style="left:80px;top:130px;font-size:80px;width:560px">In <em>use</em></div>
<div class="abs body dim" style="left:80px;top:250px;width:520px"><p>Meta statics: a real practice photo under a Deep Teal wash, the white logo, a Josefin Sans headline with its Light Italic turn, crown list cards, the Bright Teal button and the address strip.</p>
<p>Stories keep the logo and copy out of the top 250px and bottom 340px. Review proof uses the live Google count, rechecked before each batch.</p></div>
<div class="abs" style="left:680px;top:150px">{ad_square(0.68)}</div>
<div class="abs label" style="left:680px;top:900px;font-size:11px;opacity:.6">Feed 1:1</div>
<div class="abs" style="left:1440px;top:110px">{ad_story(0.43)}</div>
<div class="abs label" style="left:1440px;top:950px;font-size:11px;opacity:.6">Story 9:16</div>""", 8, 'Applications')


def close():
    return page('deep', f"""
<div class="abs" style="left:1060px;top:330px;opacity:.12">{house(1000, True)}</div>
<div class="abs" style="left:160px;top:200px">{logo(400, True)}</div>
<div class="abs label" style="left:164px;top:620px;font-size:20px;color:{WHITE}">A kind and caring approach</div>
<div class="abs small" style="left:164px;top:670px;opacity:.75">Oxford House Dental Practice · {ADDRESS} · 01908 373614</div>""", dark=True)


def main():
    pages = [cover(), story(), logo_page(), colour(), typography(), elements(), photography(), voice(), applications(), close()]
    head = f'<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>Oxford House Brand Guidelines</title><style>{CSS}</style>'
    body = f'</head><body>{"".join(pages)}</body></html>'
    (HERE / 'guideline.html').write_text(head + body)
    (HERE / 'guideline-capture.html').write_text(head + '<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>' + body)
    print('pages', len(pages))


if __name__ == '__main__':
    main()
