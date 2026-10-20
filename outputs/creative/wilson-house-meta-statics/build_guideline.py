"""Wilson House Dental Practice brand guideline: HTML harness for Figma capture.

Sources (20 Oct 2026):
- Logo: Drive "Wilson House Full Colour.png" (1gtCTwk6gzrD2Qkf78SKjwXd7l1bPK5l1) and "Wilson House White
  Logo .png" (1hPCO8eo42ltBI3zfVDLvI8kU2c1CPAJC), copied to assets/src. PNG only, no vector. The house,
  crown-rule and crown pieces are straight crops of those files (assets/mark-house-*, crown-rule-*,
  crown-gold.png), never redrawn. crown-white.png is crown-gold.png's alpha filled true white (the white
  logo's own crown is only 74px wide).
- Palette: logo artwork sampled (wordmark #722577, crown + DENTAL PRACTICE #BFA05C, house sketch #575756).
  Site wilsonhousedentalpractice.com: top bar #2A003A, Book Online buttons #4F026B (computed style),
  Elementor globals primary #F8F4EC, secondary #E0C4AB, #D4B8D6; team card frames #B0947B. The July 2026
  Kana_Wilson_House_FB statics (Drive "New Meta Statics for Approval") use #732578 grounds, #D4B8D6 buttons
  and an #E7C3A8 italic turn.
- Shapes (homepage computed styles, 20 Oct 2026): photos sit in frames with a 1px #E0C4AB hairline and an
  8px inset, open at the bottom. Arch frames (radius 1000px 1000px 0 0), side arches bleeding off the page
  edge (1000px 0 0 1000px), square offset frames, team cards with a #B0947B hairline and 10px inset, circle
  avatars. Buttons are full pills (radius 100px): #4F026B fill, #E0C4AB fill, or 1px white outline on dark.
  Form fields 24px radius, panels 20-40px radius. Section dividers are the site's own two-layer wave SVGs, a
  gold #DDAE58 hairline curve and a dot-line-arrow step connector, all downloaded unchanged to
  assets/site-shapes. Dark sections carry the gold star pattern (stars.png, 5%) and a large crown
  watermark (icon.png, 10%). Process steps are numbered "01." in Lilac Playfair.
- Type: site globals are Playfair Display (headings, with italic turns) + Montserrat (body, accent 700).
  Both Google fonts (github google/fonts, assets/fonts). The July statics pair Montserrat Bold headlines
  with a Playfair italic turn; this guideline moves headlines to Playfair to match the logo and the site.
- Photos: Drive Content Assets / Pictures (1jTLqtZLvIDTasJlIQdP7QBzQhNI3-twJ, practice photography) and the
  Frame.io July 2026 shoot (two aerials + one seated portrait, assets/photos/fio). fio-root-unassigned/10.jpg
  is a different building (bay-fronted Victorian semi, no stepped gable) and is not used. No one is named:
  names in the Drive filenames are not confirmed against the live team page.
  assets/photos is gitignored; the harness uses assets/photos/web/ (1800px copies), pre-cropped to each
  frame's aspect in assets/photos/web/crops (the Figma capture ignores object-position).
- Facts: 5 Station Road, Newport Pagnell, Milton Keynes, MK16 0AG; 01908 611 478; free on-site and
  accessible parking, step-free entrance; Denplan Essentials and Care (homepage). Mon to Fri 8am to 6pm,
  lunch 12:30 to 1:30pm, weekends closed (/contact-us/). Diamond Invisalign Provider (practice Instagram bio,
  embedded on the homepage). 4.9 from 454 Google reviews and the catchment villages: Vendo catchment report in
  Drive Client Bio (July 2026); not re-checkable by curl, so recheck on Google before each batch.

Usage: python3 build_guideline.py  ->  guideline.html + guideline-capture.html (Figma capture)
"""
import re
import subprocess
from pathlib import Path

HERE = Path(__file__).parent
WEB = HERE / 'assets/photos/web'
SHAPES = HERE / 'assets/site-shapes'

PURPLE, AUB, LILAC, GOLD, BLUSH, WHITE = '#722577', '#2A003A', '#D4B8D6', '#BFA05C', '#E0C4AB', '#FFFFFF'
CREAM, CHAR, INK = '#F8F4EC', '#575756', '#2A003A'
ROYAL, TAN, LINE = '#4F026B', '#B0947B', '#DDAE58'
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


# ---------- photo crops (capture ignores object-position, so every frame gets a pre-cut image) ----------

def crop(src, w, h, fx=.5, fy=.5):
    w, h = round(w), round(h)
    out = WEB / 'crops' / f'{Path(src).stem}-{w}x{h}-{round(fx * 100)}-{round(fy * 100)}.jpg'
    if not out.exists():
        out.parent.mkdir(exist_ok=True)
        dims = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v', '-show_entries', 'stream=width,height',
                               '-of', 'csv=p=0', str(WEB / src)], capture_output=True, text=True).stdout.strip()
        W, H = map(int, dims.split(','))
        if W / H > w / h:
            ch, cw = H, round(H * w / h)
        else:
            cw, ch = W, round(W * h / w)
        x = min(max(round(fx * W - cw / 2), 0), W - cw)
        y = min(max(round(fy * H - ch / 2), 0), H - ch)
        ow = min(cw, 2 * w) // 2 * 2
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(WEB / src), '-vf',
                        f'crop={cw}:{ch}:{x}:{y},scale={ow}:-2', '-q:v', '3', str(out)], check=True)
    return f'assets/photos/web/crops/{out.name}'


def frame(kind, src, x, y, w, h, fx=.5, fy=.5, inset=8, line=BLUSH):
    """The site's photo frames: 1px hairline, inset gap, open at the bottom (or the bleed edge)."""
    if kind == 'arch':
        pad, bord, iw, ih = f'{inset}px {inset}px 0', f'border:1px solid {line};border-bottom:0', w - 2 - 2 * inset, h - 1 - inset
        r_out, r_in = f'{w / 2}px {w / 2}px 0 0', f'{iw / 2}px {iw / 2}px 0 0'
    elif kind == 'side':
        pad, bord, iw, ih = f'{inset}px 0 {inset}px {inset}px', f'border:1px solid {line};border-right:0', w - 1 - inset, h - 2 - 2 * inset
        r_out, r_in = f'{h / 2}px 0 0 {h / 2}px', f'{ih / 2}px 0 0 {ih / 2}px'
    elif kind == 'circle':
        pad, bord, iw, ih = f'{inset}px', f'border:1px solid {line}', w - 2 - 2 * inset, h - 2 - 2 * inset
        r_out, r_in = '50%', '50%'
    else:  # square offset frame / card
        pad, bord, iw, ih = f'{inset}px {inset}px 0', f'border:1px solid {line};border-bottom:0', w - 2 - 2 * inset, h - 1 - inset
        r_out = r_in = '0'
    return (f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;padding:{pad};{bord};border-radius:{r_out}">'
            f'<div class="ph" style="position:relative;width:{iw}px;height:{ih}px;border-radius:{r_in}"><img src="{crop(src, iw, ih, fx, fy)}"></div></div>')


# ---------- the site's own vector shapes, inlined so they land in Figma as vectors ----------

def svg(name, w, h, extra='', stretch=False):
    s = (SHAPES / name).read_text()
    s = re.sub(r'<svg ([^>]*?)width="[^"]*" height="[^"]*"', rf'<svg \1width="{w}" height="{h}"', s, count=1)
    if stretch:
        s = s.replace('<svg ', '<svg preserveAspectRatio="none" ', 1)
    return f'<div class="abs" style="{extra};width:{w}px;height:{h}px;line-height:0">{s}</div>'


def wave(name, w, h, extra):
    return svg(name, w, h, extra, stretch=True)


def curve(w, extra):
    return svg('curve-line.svg', w, round(w * 121 / 2043), extra)


def connector(h, extra):
    return svg('step-connector.svg', round(h * 6 / 43), h, extra, stretch=True)


def stars(w=1920, extra='left:0;top:0', op=.06):
    return f'<img class="abs" src="assets/site-shapes/stars.png" style="{extra};width:{w}px;opacity:{op}">'


def crown_mark(w, extra, op=.1):
    return f'<img class="abs" src="assets/site-shapes/crown-watermark.png" style="{extra};width:{w}px;opacity:{op}">'


CSS = f"""
@font-face{{font-family:'Playfair Display';src:url('assets/fonts/PlayfairDisplay.ttf');font-weight:400 900;font-style:normal}}
@font-face{{font-family:'Playfair Display';src:url('assets/fonts/PlayfairDisplay-Italic.ttf');font-weight:400 900;font-style:italic}}
@font-face{{font-family:'Montserrat';src:url('assets/fonts/Montserrat.ttf');font-weight:100 900;font-style:normal}}
@font-face{{font-family:'Montserrat';src:url('assets/fonts/Montserrat-Italic.ttf');font-weight:100 900;font-style:italic}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:#d9ccd9;font-family:'Montserrat',sans-serif;font-weight:400;color:{INK};display:flex;flex-direction:column;gap:120px;padding:120px;width:2160px;-webkit-font-smoothing:antialiased}}
.page{{position:relative;width:1920px;height:1080px;overflow:hidden;background:{WHITE}}}
.purple{{background:{PURPLE};color:{WHITE}}} .cream{{background:{CREAM}}} .aub{{background:{AUB};color:{WHITE}}}
.abs{{position:absolute}}
.h{{font-family:'Playfair Display',serif;font-weight:400;letter-spacing:-.005em;line-height:1.1;color:{AUB}}}
.purple .h,.aub .h{{color:{WHITE}}}
.h em{{font-style:italic;color:{PURPLE}}}
.purple .h em,.aub .h em{{color:{BLUSH}}}
.label{{font-family:'Montserrat',sans-serif;font-weight:600;font-size:14px;letter-spacing:.22em;text-transform:uppercase}}
.body{{font-size:19px;line-height:1.7;color:{CHAR}}} .body p+p{{margin-top:14px}}
.purple .body,.aub .body{{color:{WHITE}}}
.small{{font-size:15px;line-height:1.6}}
.dim{{opacity:.9}}
.ph{{position:absolute;overflow:hidden}}
.ph img{{width:100%;height:100%;object-fit:cover;display:block}}
.full{{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}}
.btn{{display:inline-flex;align-items:center;justify-content:center;font-weight:600;border-radius:100px;white-space:nowrap;border:1px solid transparent}}
.pill{{display:flex;align-items:center;border:1.5px solid {BLUSH};background:rgba(255,255,255,.06);border-radius:8px;color:{WHITE};font-weight:600}}
.step{{font-family:'Playfair Display',serif;color:{LILAC};line-height:1}}
.foot{{position:absolute;left:80px;right:80px;bottom:44px;display:flex;justify-content:space-between}}
.swatch{{position:absolute;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;padding:28px}}
.rule{{height:1px;background:{BLUSH}}}
.cap{{position:absolute;font-family:'Montserrat',sans-serif;font-weight:600;font-size:10px;letter-spacing:.22em;text-transform:uppercase;opacity:.65}}
"""

PIN = '<svg width="{s}" height="{s}" viewBox="0 0 24 24" style="display:block;flex:none"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2z" fill="currentColor"/></svg>'
STAR = '<svg width="{s}" height="{s}" viewBox="0 0 24 24" style="display:block"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill="{c}"/></svg>'
ADDRESS = '5 Station Road, Newport Pagnell, Milton Keynes, MK16 0AG'

BTN = {'royal': (ROYAL, WHITE, ROYAL), 'blush': (BLUSH, AUB, BLUSH), 'lilac': (LILAC, AUB, LILAC),
       'outline': ('transparent', WHITE, WHITE), 'outline-royal': ('transparent', ROYAL, ROYAL)}


def btn(text, size, padx, pady, kind='lilac'):
    bg, fg, bd = BTN[kind]
    return f'<div class="btn" style="font-size:{size}px;padding:{pady}px {padx}px;background:{bg};color:{fg};border-color:{bd}">{text}</div>'


def pills(items, size, padx, pady, gap, icon):
    return ''.join(f'<div class="pill" style="font-size:{size}px;padding:{pady}px {padx}px;gap:{icon * .7}px;margin-top:{gap if i else 0}px">{crown(icon)}{t}</div>' for i, t in enumerate(items))


def address(size, colour=WHITE, rule=True):
    r = f'<div style="height:1px;background:{colour};opacity:.45;margin-bottom:{size * 1.3}px"></div>' if rule else ''
    return f'<div style="color:{colour}">{r}<div style="display:flex;align-items:center;gap:{size * .6}px;font-size:{size}px;font-weight:500">{PIN.format(s=round(size * 1.3))}{ADDRESS}</div></div>'


def proof(size, colour=AUB, star=GOLD):
    stars_ = ''.join(STAR.format(s=round(size * 1.1), c=star) for _ in range(5))
    return f'<div style="display:flex;align-items:center;gap:{size * .5}px;color:{colour};font-size:{size}px;font-weight:500;white-space:nowrap"><div style="display:flex;gap:2px">{stars_}</div>4.9 from 454 Google reviews</div>'


def wash(direction='180deg', a=.92, b=.35):
    return f'<div class="abs" style="inset:0;background:linear-gradient({direction},rgba(114,37,119,{a}) 0%,rgba(114,37,119,{b}) 100%)"></div>'


def page(cls, body, n=None, title=None, dark=False):
    c = WHITE if dark else AUB
    head = ''
    if title:
        head = f'<div class="abs label" style="left:80px;top:62px;color:{GOLD}">{n:02d}</div><div class="abs label" style="left:130px;top:62px;color:{c};opacity:.8">{title}</div>'
    foot = f'<div class="foot label" style="font-size:11px;color:{c};opacity:.55"><span>wilsonhousedentalpractice.com</span><span>Brand guidelines · 2026</span></div>'
    return f'<section class="page {cls}">{head}{body}{foot}</section>'


# ---------- ads in the system (Applications page) ----------

def ad_square(s):
    S = lambda v: round(v * s, 2)
    return f"""<div style="position:relative;width:{S(1080)}px;height:{S(1080)}px;overflow:hidden;background:{PURPLE}">
{stars(S(1400), 'left:0;top:0', .07)}
{frame('arch', 'team-surgery-2.jpg', S(600), S(150), S(420), S(930), .5, .45, S(10))}
<div class="abs" style="left:{S(64)}px;top:{S(64)}px">{logo(S(200), True)}</div>
<div class="abs h" style="left:{S(64)}px;top:{S(290)}px;width:{S(500)}px;font-size:{S(60)}px;color:{WHITE}">Looking for a new dentist in <em style="color:{BLUSH}">Newport Pagnell?</em></div>
<div class="abs" style="left:{S(64)}px;top:{S(560)}px;width:{S(480)}px">{pills(['Family dentistry', 'Free on-site parking', 'Support for nervous patients'], S(22), S(20), S(15), S(12), S(30))}</div>
<div class="abs" style="left:{S(64)}px;top:{S(830)}px">{btn('Book Your Appointment', S(24), S(42), S(22))}</div>
<div class="abs" style="left:{S(64)}px;top:{S(975)}px;width:{S(520)}px">{address(S(15), WHITE, False)}</div>
</div>"""


def ad_story(s):
    S = lambda v: round(v * s, 2)
    return f"""<div style="position:relative;width:{S(1080)}px;height:{S(1920)}px;overflow:hidden;background:{AUB}">
{stars(S(1600), 'left:0;top:0', .07)}
{crown_mark(S(700), f'left:{S(190)}px;top:{S(1560)}px', .06)}
<div class="abs" style="left:0;right:0;top:{S(260)}px;display:flex;justify-content:center">{logo(S(280), True)}</div>
{frame('arch', 'exterior-gate-blossom.jpg', S(190), S(590), S(700), S(640), .5, .5, S(12))}
<div class="abs h" style="left:{S(100)}px;right:{S(100)}px;top:{S(1270)}px;text-align:center;font-size:{S(76)}px;color:{WHITE}">Your local dentist on <em style="color:{BLUSH}">Station Road</em></div>
<div class="abs" style="left:0;right:0;top:{S(1470)}px;display:flex;justify-content:center">{btn('Book Your Appointment', S(30), S(54), S(26))}</div>
</div>"""


# ---------- pages ----------

def cover():
    return page('purple', f"""
<img class="full" src="{crop('aerial.jpg', 1920, 1080, .5, .45)}">
<div class="abs" style="inset:0;background:linear-gradient(90deg,rgba(42,0,58,.97) 0%,rgba(114,37,119,.93) 42%,rgba(114,37,119,.3) 100%)"></div>
<div class="abs" style="left:160px;top:200px">{logo(480, True)}</div>
<div class="abs label" style="left:164px;top:700px;font-size:22px;color:{WHITE}">Brand guidelines</div>
<div class="abs label" style="left:164px;top:748px;color:{BLUSH}">Wilson House Dental Practice · Newport Pagnell, Milton Keynes · A Kana Health Group practice</div>
{wave('wave-bottom-white.svg', 1920, 134, 'left:0;bottom:0')}""", dark=True).replace('opacity:.55"><span>', 'opacity:.55;color:#2A003A"><span>', 1)


def story():
    return page('', f"""
<div class="abs h" style="left:80px;top:150px;width:860px;font-size:80px">Caring for every smile in <em>Newport Pagnell</em></div>
<div class="abs body dim" style="left:80px;top:400px;width:780px">
<p>Wilson House is a private practice on Station Road in Newport Pagnell, in the red-brick house its logo is drawn from. It offers check-ups and hygiene, fillings, crowns and bridges, implants and dentures, whitening and bonding, Invisalign and children’s dentistry.</p>
<p>Many patients have been coming for decades and now bring their children and grandchildren. The town is settled and family-minded: people choose a dentist they can trust for years, who explains things clearly and makes nervous patients feel at ease.</p></div>
<div class="abs" style="left:80px;top:800px;width:780px">
  <div class="label" style="color:{GOLD}">Brand idea</div>
  <div class="h" style="font-size:40px;margin-top:14px">Trusted local care for every <em>generation</em>.</div></div>
{curve(860, 'left:80px;top:950px')}
{frame('arch', 'team-surgery-2.jpg', 980, 150, 520, 780, .5, .4)}
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
        ('Busy photo, no wash', f'<img class="full" src="{crop("flowers.jpg", 262, 160)}"><div style="position:relative">{logo(92, True)}</div>'),
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
<div class="abs" style="left:1280px;top:590px;width:270px;height:150px;overflow:hidden"><img class="full" src="{crop('exterior-blossom.jpg', 270, 150)}">{wash('180deg', .85, .6)}<div class="abs" style="inset:0;display:flex;align-items:center;justify-content:center">{logo(120, True)}</div></div>
<div class="abs" style="left:1570px;top:590px;width:270px;height:150px;background:{CREAM};display:flex;align-items:center;justify-content:center;gap:30px">{house(130)}{crown(46, False)}</div>
<div class="abs label" style="left:700px;top:752px;font-size:10px;opacity:.7">Full colour on white</div>
<div class="abs label" style="left:990px;top:752px;font-size:10px;opacity:.7">White on Purple</div>
<div class="abs label" style="left:1280px;top:752px;font-size:10px;opacity:.7">On photo, with Purple wash</div>
<div class="abs label" style="left:1570px;top:752px;font-size:10px;opacity:.7">House sketch · crown</div>
<div class="abs label" style="left:700px;top:800px;color:{GOLD}">Misuse</div>
<div class="abs" style="left:700px;top:832px;display:flex;gap:24px">{mis}</div>""", 2, 'Logo')


def colour():
    sw = [
        ('Wilson Purple', PURPLE, 'Main colour: grounds, washes, the wordmark', WHITE, 80, 150, 580, 400, False),
        ('Aubergine', AUB, 'Headlines on light, dark sections, deep end of washes', WHITE, 680, 150, 580, 400, False),
        ('Cream', CREAM, 'Canvas and soft grounds', AUB, 1280, 150, 560, 400, True),
        ('Royal Purple', ROYAL, 'Pill buttons on light', WHITE, 80, 570, 336, 290, False),
        ('Lilac', LILAC, 'Buttons on Purple, step numbers', AUB, 436, 570, 336, 290, False),
        ('Blush', BLUSH, 'Frame hairlines, italic turn on Purple', AUB, 792, 570, 336, 290, False),
        ('Tan', TAN, 'Card frames', WHITE, 1148, 570, 336, 290, False),
        ('Gold', GOLD, 'Crown, stars, curve line, fine detail', WHITE, 1504, 570, 336, 290, False),
    ]
    cards = ''.join(f"""<div class="swatch" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;background:{c};color:{t};{'border:1px solid #EDE6DA;' if b else ''}">
<div style="font-weight:600;font-size:{44 if h > 300 else 28}px">{n}</div><div class="label" style="font-size:12px;margin-top:10px">{c}</div><div class="small" style="margin-top:6px;opacity:.85;font-size:14px">{u}</div></div>""" for n, c, u, t, x, y, w, h, b in sw)
    return page('', f"""{cards}
<div class="abs small" style="left:80px;top:900px;width:1760px;color:{CHAR}">Wilson Purple leads and carries most ads, as a solid ground or a wash over real practice photography; Aubergine takes the dark sections with the gold stars. Roughly 45% Purple, 28% Cream, 12% Aubergine, the rest accents. Royal Purple and Lilac are buttons, Blush draws the hairline round every photo frame and gives headlines their italic turn on Purple, Tan frames cards, and Gold stays small, as it sits in the logo. Charcoal {CHAR}, the colour of the house sketch, is the body text colour on light. No black panels, no off-palette blues.</div>""", 3, 'Colour')


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
<div class="abs" style="left:680px;top:660px;width:520px">
  <div class="label" style="color:{GOLD}">Label · Montserrat SemiBold · caps · +22%</div>
  <div class="label" style="margin-top:20px;font-size:18px;color:{PURPLE}">Station Road · Newport Pagnell</div>
  <div class="label" style="color:{GOLD};margin-top:46px">Button · Montserrat SemiBold · title case · pill</div>
  <div style="margin-top:14px">{btn('Book Your Appointment', 18, 34, 18, 'royal')}</div>
</div>
<div class="abs purple" style="left:1240px;top:130px;width:600px;height:800px;padding:56px;overflow:hidden">
  {stars(900, 'left:0;top:0', .07)}
  <div style="position:relative">
  <div class="label" style="color:{BLUSH}">List · Montserrat SemiBold · crown bullet</div>
  <div style="margin-top:30px">{pills(['Detailed dental examination', 'Free on-site parking', 'Support for nervous patients'], 22, 22, 16, 16, 30)}</div>
  <div class="small" style="margin-top:28px;opacity:.8">The current Meta statics already use these outlined cards with the crown bullet. Keep them, and keep claims to what the practice can stand behind.</div>
  <div class="label" style="color:{BLUSH};margin-top:50px">Step numbers · Playfair Display · Lilac</div>
  <div style="display:flex;gap:40px;margin-top:18px;align-items:baseline"><span class="step" style="font-size:96px">01.</span><span class="step" style="font-size:96px">02.</span><span class="step" style="font-size:96px;color:{WHITE}">4.9</span></div>
  </div>
</div>""", 4, 'Typography')


def shapes():
    """Every photo on the website sits in one of these frames: hairline, inset gap, open at the bottom."""
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:72px;width:520px">Arches and <em>frames</em></div>
<div class="abs body dim" style="left:80px;top:330px;width:500px">
<p>The website never shows a bare rectangle of photo. Each image sits in a frame: a 1px Blush hairline, an 8px gap, open at the bottom so the photo grounds itself.</p>
<p>The arch is the signature. Use it for portraits and the hero image of an ad. The side arch bleeds off the page edge beside text. Square frames and Tan cards carry treatments and team; circles are for avatars only.</p>
<p>Corners elsewhere are soft: pill buttons, 24px fields, 20 to 40px panels. Never sharp boxes with drop shadows.</p></div>
{frame('arch', 'chair-nurse.jpg', 640, 130, 330, 470, .62, .5)}
<div class="cap" style="left:640px;top:614px">Arch · 1000px top radius</div>
{frame('side', 'gable-sign.jpg', 1010, 130, 910, 300, .5, .45)}
<div class="cap" style="left:1010px;top:444px">Side arch · bleeds off the edge</div>
{frame('square', 'nook.jpg', 1010, 490, 300, 200, .5, .55)}
<div class="cap" style="left:1010px;top:704px">Offset frame</div>
<div class="abs" style="left:1340px;top:490px;width:260px;height:240px;border:1px solid {TAN};padding:10px 10px 0;background:{CREAM}">
  <div class="ph" style="position:relative;width:238px;height:160px"><img src="{crop('team-surgery.jpg', 238, 160, .5, .4)}"></div>
  <div class="h" style="font-size:24px;text-align:center;padding-top:20px">Family <em>Dentistry</em></div></div>
<div class="cap" style="left:1340px;top:744px">Treatment card · Tan hairline</div>
{frame('circle', 'clinician-xray.jpg', 1640, 500, 180, 180, .5, .4)}
<div class="cap" style="left:1640px;top:704px">Circle · avatars</div>
<div class="abs cream" style="left:640px;top:780px;width:1200px;height:170px;border-radius:40px;padding:0 50px;display:flex;align-items:center;gap:22px">
  {btn('Book Online', 17, 32, 16, 'royal')}{btn('Request An Appointment', 17, 32, 16, 'blush')}{btn('Call Us Today', 17, 32, 16, 'outline-royal')}
  <div style="height:50px;width:1px;background:{BLUSH};margin:0 8px"></div>
  <div style="width:250px;height:48px;border:1px solid {BLUSH};border-radius:24px;background:{WHITE};display:flex;align-items:center;padding:0 20px;font-size:15px;color:#9a9a99">Your name</div></div>
<div class="cap" style="left:640px;top:962px">Pill buttons · 24px fields · 40px panel</div>""", 5, 'Shapes and frames')


def elements():
    col = lambda i: 80 + i * 447
    return page('', f"""
<div class="abs" style="left:{col(0)}px;top:130px;width:417px;height:440px;overflow:hidden">
  <img class="full" src="{crop('lounge.jpg', 417, 440, .72, .5)}">
  <div class="abs" style="inset:0;background:linear-gradient(90deg,rgba(114,37,119,.96) 0%,rgba(114,37,119,.7) 45%,rgba(114,37,119,0) 75%)"></div>
  <div class="abs h" style="left:34px;top:160px;width:220px;font-size:40px;color:{WHITE}">Purple <em style="color:{BLUSH}">wash</em></div>
</div>
<div class="cap" style="left:{col(0)}px;top:584px">Purple wash · 95% to clear, behind every headline</div>
<div class="abs aub" style="left:{col(1)}px;top:130px;width:417px;height:440px;overflow:hidden">
  {stars(800, 'left:0;top:0', .1)}
  {crown_mark(300, 'left:58px;top:170px', .1)}
  <div class="abs label" style="left:34px;top:40px;font-size:12px;color:{BLUSH}">Dark sections</div>
</div>
<div class="cap" style="left:{col(1)}px;top:584px">Gold stars 5–12% · crown watermark 10%</div>
<div class="abs cream" style="left:{col(2)}px;top:130px;width:417px;height:440px;overflow:hidden">
  <div class="abs" style="left:130px;top:150px;opacity:.14">{house(420)}</div>
  <div class="abs" style="left:40px;top:110px">{crown_rule(260)}</div>
  <div class="abs label" style="left:40px;top:160px;font-size:12px;color:{PURPLE}">Crown rule · from the logo</div>
</div>
<div class="cap" style="left:{col(2)}px;top:584px">House sketch watermark · crown rule divider</div>
<div class="abs" style="left:{col(3)}px;top:130px;width:417px;height:440px;overflow:hidden;background:{WHITE}">
  <div class="abs" style="left:0;right:0;top:0;height:150px;background:{AUB}"></div>
  {wave('wave-top-purple.svg', 417, 60, 'left:0;top:110px;transform:scaleY(-1)')}
  <div class="abs" style="left:0;right:0;top:290px;bottom:0;background:{PURPLE}"></div>
  {wave('wave-bottom-white.svg', 417, 60, 'left:0;top:262px;transform:scaleY(-1)')}
  <div class="abs label" style="left:34px;top:200px;font-size:12px;color:{PURPLE}">Two-layer waves</div>
</div>
<div class="cap" style="left:{col(3)}px;top:584px">Wave dividers between sections</div>
<div class="abs cream" style="left:80px;top:650px;width:1150px;height:270px;overflow:hidden">
  <div class="abs" style="left:50px;top:44px"><div class="step" style="font-size:64px">01.</div><div class="h" style="font-size:28px;margin-top:12px">A warm <em>welcome</em></div></div>
  <div class="abs" style="left:440px;top:44px"><div class="step" style="font-size:64px">02.</div><div class="h" style="font-size:28px;margin-top:12px">Meeting your <em>team</em></div></div>
  <div class="abs" style="left:830px;top:44px"><div class="step" style="font-size:64px">03.</div><div class="h" style="font-size:28px;margin-top:12px">Your <em>plan</em></div></div>
  {curve(1150, 'left:0;top:175px')}
  {connector(43, 'left:300px;top:60px')}{connector(43, 'left:690px;top:60px')}
</div>
<div class="cap" style="left:80px;top:934px">Numbered steps · gold curve line · dot-line-arrow connector</div>
<div class="abs purple" style="left:1260px;top:650px;width:580px;height:270px;padding:44px 50px">
  {pills(['Detailed dental examination', 'Free on-site parking', 'Support for nervous patients'], 19, 20, 13, 12, 26)}
</div>
<div class="cap" style="left:1260px;top:934px">Outlined list cards · Blush hairline, crown bullet</div>""", 6, 'Graphic elements')


def photography():
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:72px;width:520px">Our team, <em>our house</em></div>
<div class="abs body dim" style="left:80px;top:330px;width:500px">
<p>Real people in the real practice. The team in purple scrubs, bright surgeries with tall sash windows, the mustard chairs of the waiting room, and the red-brick house on Station Road that the logo is drawn from.</p>
<p>Name a team member only when the name is confirmed on the website team page. Never caption anyone as a specific dentist on a guess.</p></div>
{frame('arch', 'chair-portrait.jpg', 640, 130, 380, 520, .5, .62)}
{frame('side', 'aerial.jpg', 1050, 130, 870, 250, .5, .45)}
{frame('square', 'nook.jpg', 1050, 410, 385, 240, .5, .55)}
{frame('square', 'team-purple.jpg', 1455, 410, 385, 240, .5, .3)}
<div class="abs cream" style="left:640px;top:690px;width:1200px;height:250px;padding:40px 50px;display:flex;gap:60px;border-radius:20px">
  <div style="width:520px"><div class="label" style="color:{PURPLE}">Look for</div><div class="small" style="margin-top:12px;color:{CHAR}">Warm eye contact and natural smiles. Purple scrubs, soft window light, the stepped gable and blossom outside. Portraits suit the arch; wide shots of the house suit the side arch.</div></div>
  <div style="width:520px"><div class="label" style="color:{STOP}">Avoid</div><div class="small" style="margin-top:12px;color:{CHAR}">Stock models, instruments, needles, gloved hands in mouths, over-whitened teeth, and before-and-afters without the patient's written consent.</div></div></div>""", 7, 'Photography')


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
<div class="abs" style="left:80px;top:400px;width:1450px">{rows}</div>
{curve(900, 'left:940px;top:890px')}""", 8, 'Tone of voice')


def applications():
    return page('cream', f"""
<div class="abs h" style="left:80px;top:130px;font-size:80px;width:560px">In <em>use</em></div>
<div class="abs body dim" style="left:80px;top:250px;width:520px"><p>Meta statics: a real practice photo in a hairline arch, gold stars over Purple or Aubergine, the white logo, a Playfair headline with its Italic turn, crown list cards and a Lilac pill button.</p>
<p>Stories keep the logo and copy out of the top 250px and bottom 340px. Review proof uses the live Google count, rechecked before each batch.</p></div>
<div class="abs" style="left:680px;top:150px">{ad_square(0.68)}</div>
<div class="abs label" style="left:680px;top:900px;font-size:11px;opacity:.6">Feed 1:1</div>
<div class="abs" style="left:1440px;top:110px">{ad_story(0.43)}</div>
<div class="abs label" style="left:1440px;top:950px;font-size:11px;opacity:.6">Story 9:16</div>""", 9, 'Applications')


def close():
    return page('aub', f"""
{stars(1920, 'left:0;top:0', .06)}
{crown_mark(700, 'left:1080px;top:330px', .07)}
<div class="abs" style="left:160px;top:230px">{logo(420, True)}</div>
<div class="abs label" style="left:164px;top:700px;font-size:20px;color:{WHITE}">Caring for every smile</div>
<div class="abs small" style="left:164px;top:750px;opacity:.8">{ADDRESS} · 01908 611 478</div>""", dark=True)


def main():
    pages = [cover(), story(), logo_page(), colour(), typography(), shapes(), elements(), photography(), voice(), applications(), close()]
    head = f'<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>Wilson House Brand Guidelines</title><style>{CSS}</style>'
    body = f'</head><body>{"".join(pages)}</body></html>'
    (HERE / 'guideline.html').write_text(head + body)
    (HERE / 'guideline-capture.html').write_text(head + '<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>' + body)
    print('pages', len(pages))


if __name__ == '__main__':
    main()
