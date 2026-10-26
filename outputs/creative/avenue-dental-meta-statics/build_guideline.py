"""Avenue Dental Practice brand guideline: HTML harness for Figma capture.

Sources (26 Oct 2026):
- Logo: Drive logo folder 1KQwkWnxeC9ONlFYUJJjInB3H6-2saVwh, "Avenue Dental web-svg.svg" (gold AP monogram
  #A88C61 over a black AVENUE DENTAL wordmark). assets/logo-primary.svg is that file unchanged. The reverse,
  all-gold and monogram-only files are the same paths with only the fill swapped; nothing is redrawn.
- Palette and fonts: Drive "Avenue Dental Brand Sheet.png" (1u9xCd8rKKDb7t41CICoWhZP990gdRUjU): Main Gold
  #A88C61, Sand Gold #C49C60, Blush Gold #EDE2CF, Black #1B1B1B, White; brand fonts Lexend and Jost (both
  Google fonts, assets/fonts). The live site (avenuedentalpractice.co.uk) runs #1D1D1D / #191919 dark sections
  and #A88C61 gold, and sets headings in Josefin Sans; this guideline moves headings to Jost per the brand sheet.
- Shapes (homepage, 26 Oct 2026): photos sit in frames with one large rounded corner (the "leaf"), gold pill
  buttons with black text, gold line icons inside an open gold ring, two-tone headings (a gold phrase, then
  white), a short gold rule before eyebrow labels, and a long gold hairline after "Find out more". The practice
  interior adds wood slats, white marble and the round black sign with the gold monogram.
- Photos: the site's own practice photography only (assets/photos/web, gitignored). The Drive shoot folders
  (Nov 2025 "Photos", 30 Sep 2026 shoot) were not reachable from the browser; swap in higher-res files when
  supplied. Stock lifestyle images on the site (girls' selfie, older couple) are not used. No team member is
  named except the founder, Dr Bobby Bhandal, who is named on the site.
- Facts (site, 26 Oct 2026): 2 Lime Avenue, Lillington, Leamington Spa, CV32 7DA; 01926 291536; 4.9 from 227
  Google reviews (site widget, recheck before each batch); Private Dentistry Awards 2025, Highly Commended,
  Treatment of Nervous Patients, Midlands (award image on the site; it is a commendation, not a win); founded by
  Dr Bobby Bhandal, who grew up locally; serves Leamington Spa, Warwick, Kenilworth and surrounding Warwickshire.

Usage: python3 build_guideline.py  ->  guideline.html + guideline-capture.html (Figma capture)
"""
import subprocess
from pathlib import Path

HERE = Path(__file__).parent
WEB = HERE / 'assets/photos/web'

GOLD, SAND, BLUSH, BLACK, WHITE = '#A88C61', '#C49C60', '#EDE2CF', '#1B1B1B', '#FFFFFF'
CHAR, INK, GREY = '#252525', '#1B1B1B', '#6E6A64'
STOP = '#B5523F'


def img(name, w, extra=''):
    return f'<img src="assets/{name}" style="display:block;width:{w}px;{extra}">'


def logo(w, kind='primary'):
    return img({'primary': 'logo-primary.svg', 'reverse': 'logo-reverse.svg', 'gold': 'logo-allgold.svg'}[kind], w)


def mono(w, white=False, extra=''):
    return img('monogram-white.svg' if white else 'monogram-gold.svg', w, extra)


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


def leaf(src, x, y, w, h, fx=.5, fy=.5, corner='tr', r=None):
    """The site's photo frame: square corners except one large rounded corner."""
    r = r or round(min(w, h) * .16)
    rad = {'tr': f'0 {r}px 0 0', 'tl': f'{r}px 0 0 0', 'br': f'0 0 {r}px 0', 'bl': f'0 0 0 {r}px'}[corner]
    return (f'<div class="ph" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;border-radius:{rad}">'
            f'<img src="{crop(src, w, h, fx, fy)}"></div>')


def ring(size, inner='', stroke=GOLD, sw=2):
    """The open gold ring the site draws round its line icons (a gap at the upper right)."""
    r = size / 2 - sw
    c = 2 * 3.14159 * r
    return (f'<div style="position:relative;width:{size}px;height:{size}px;display:flex;align-items:center;justify-content:center">'
            f'<svg class="abs" style="left:0;top:0" width="{size}" height="{size}"><circle cx="{size / 2}" cy="{size / 2}" r="{r}" fill="none" stroke="{stroke}" stroke-width="{sw}" '
            f'stroke-dasharray="{c * .86:.1f} {c * .14:.1f}" transform="rotate(-60 {size / 2} {size / 2})"/></svg>{inner}</div>')


TOOTH = '<svg width="{s}" height="{s}" viewBox="0 0 48 48" fill="none" stroke="{c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 6c-5 0-9 4-9 10 0 5 2 8 3 12 1 5 2 14 6 14 3 0 3-9 8-9s5 9 8 9c4 0 5-9 6-14 1-4 3-7 3-12 0-6-4-10-9-10-3 0-5 2-8 2s-5-2-8-2z"/></svg>'
HEART = '<svg width="{s}" height="{s}" viewBox="0 0 48 48" fill="none" stroke="{c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M24 40S7 30 7 18a8.5 8.5 0 0 1 17-2 8.5 8.5 0 0 1 17 2c0 12-17 22-17 22z"/></svg>'
CUP = '<svg width="{s}" height="{s}" viewBox="0 0 48 48" fill="none" stroke="{c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 20h26v8a11 11 0 0 1-11 11h-4A11 11 0 0 1 9 28z"/><path d="M35 23h3a4 4 0 0 1 0 8h-4"/><path d="M17 8c0 3 3 3 3 6M25 8c0 3 3 3 3 6"/></svg>'


def icon(svg, size, colour=GOLD):
    return ring(size, svg.format(s=round(size * .5), c=colour))


CSS = f"""
@font-face{{font-family:'Jost';src:url('assets/fonts/Jost.ttf');font-weight:100 900;font-style:normal}}
@font-face{{font-family:'Jost';src:url('assets/fonts/Jost-Italic.ttf');font-weight:100 900;font-style:italic}}
@font-face{{font-family:'Lexend';src:url('assets/fonts/Lexend.ttf');font-weight:100 900;font-style:normal}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:#3a3733;font-family:'Lexend',sans-serif;font-weight:300;color:{INK};display:flex;flex-direction:column;gap:120px;padding:120px;width:2160px;-webkit-font-smoothing:antialiased}}
.page{{position:relative;width:1920px;height:1080px;overflow:hidden;background:{WHITE}}}
.dark{{background:{BLACK};color:{WHITE}}} .blush{{background:{BLUSH}}}
.abs{{position:absolute}}
.h{{font-family:'Jost',sans-serif;font-weight:500;letter-spacing:-.01em;line-height:1.08;color:{INK}}}
.dark .h{{color:{WHITE}}}
.h b{{font-weight:500;color:{GOLD}}}
.label{{font-family:'Jost',sans-serif;font-weight:500;font-size:14px;letter-spacing:.28em;text-transform:uppercase}}
.eyebrow{{display:flex;align-items:center;gap:16px;font-family:'Jost',sans-serif;font-weight:500;font-size:18px;color:{INK}}}
.eyebrow:before{{content:'';width:46px;height:1.5px;background:{GOLD}}}
.dark .eyebrow{{color:{WHITE}}}
.body{{font-size:19px;line-height:1.7;color:{GREY}}} .body p+p{{margin-top:14px}}
.dark .body{{color:#D9D4CC}}
.small{{font-size:15px;line-height:1.6}}
.ph{{position:absolute;overflow:hidden}}
.ph img{{width:100%;height:100%;object-fit:cover;display:block}}
.full{{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}}
.btn{{display:inline-flex;align-items:center;justify-content:center;font-family:'Jost',sans-serif;font-weight:600;border-radius:100px;white-space:nowrap;border:1.5px solid transparent}}
.foot{{position:absolute;left:80px;right:80px;bottom:44px;display:flex;justify-content:space-between}}
.swatch{{position:absolute;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;padding:28px}}
.rule{{height:1px;background:{GOLD};opacity:.6}}
.cap{{position:absolute;font-family:'Jost',sans-serif;font-weight:500;font-size:10px;letter-spacing:.24em;text-transform:uppercase;opacity:.65}}
.more{{display:flex;align-items:center;gap:22px;font-family:'Jost',sans-serif;font-weight:600;font-size:16px}}
.more:after{{content:'';flex:1;height:1.5px;background:{GOLD}}}
"""

PIN = '<svg width="{s}" height="{s}" viewBox="0 0 24 24" style="display:block;flex:none"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2z" fill="currentColor"/></svg>'
STAR = '<svg width="{s}" height="{s}" viewBox="0 0 24 24" style="display:block"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill="{c}"/></svg>'
ADDRESS = '2 Lime Avenue, Leamington Spa, CV32 7DA'

BTN = {'gold': (GOLD, BLACK, GOLD), 'black': (BLACK, WHITE, BLACK), 'outline': ('transparent', WHITE, GOLD),
       'outline-dark': ('transparent', INK, GOLD)}


def btn(text, size, padx, pady, kind='gold'):
    bg, fg, bd = BTN[kind]
    return f'<div class="btn" style="font-size:{size}px;padding:{pady}px {padx}px;background:{bg};color:{fg};border-color:{bd}">{text}</div>'


def proof(size, colour=WHITE, star=GOLD):
    stars_ = ''.join(STAR.format(s=round(size * 1.1), c=star) for _ in range(5))
    return f'<div style="display:flex;align-items:center;gap:{size * .5}px;color:{colour};font-size:{size}px;font-weight:400;white-space:nowrap"><div style="display:flex;gap:2px">{stars_}</div>4.9 from 227 Google reviews</div>'


def address(size, colour=WHITE):
    return f'<div style="display:flex;align-items:center;gap:{size * .6}px;font-size:{size}px;color:{colour}">{PIN.format(s=round(size * 1.3))}{ADDRESS}</div>'


def wash(direction='90deg', a=.94, b=.15):
    return f'<div class="abs" style="inset:0;background:linear-gradient({direction},rgba(27,27,27,{a}) 0%,rgba(27,27,27,{b}) 100%)"></div>'


def page(cls, body, n=None, title=None, dark=False):
    c = WHITE if dark else INK
    head = ''
    if title:
        head = f'<div class="abs label" style="left:80px;top:62px;color:{GOLD}">{n:02d}</div><div class="abs label" style="left:130px;top:62px;color:{c};opacity:.8">{title}</div>'
    foot = f'<div class="foot label" style="font-size:11px;color:{c};opacity:.55"><span>avenuedentalpractice.co.uk</span><span>Brand guidelines · 2026</span></div>'
    return f'<section class="page {cls}">{head}{body}{foot}</section>'


# ---------- ads in the system (Applications page) ----------

def ad_square(s):
    S = lambda v: round(v * s, 2)
    return f"""<div style="position:relative;width:{S(1080)}px;height:{S(1080)}px;overflow:hidden;background:{BLACK}">
{leaf('exterior-night.jpg', S(560), S(0), S(520), S(1080), .42, .5, 'bl', S(140))}
<div class="abs" style="left:{S(70)}px;top:{S(70)}px">{logo(S(190), 'reverse')}</div>
<div class="abs eyebrow" style="left:{S(70)}px;top:{S(330)}px;font-size:{S(22)}px;color:{WHITE}">New patients welcome</div>
<div class="abs h" style="left:{S(70)}px;top:{S(380)}px;width:{S(450)}px;font-size:{S(64)}px;color:{WHITE}"><b>Your dentist</b> on Lime Avenue</div>
<div class="abs" style="left:{S(70)}px;top:{S(640)}px">{proof(S(20))}</div>
<div class="abs" style="left:{S(70)}px;top:{S(830)}px">{btn('Book Your Appointment', S(24), S(44), S(22))}</div>
<div class="abs" style="left:{S(70)}px;top:{S(975)}px">{address(S(16))}</div>
</div>"""


def ad_story(s):
    S = lambda v: round(v * s, 2)
    return f"""<div style="position:relative;width:{S(1080)}px;height:{S(1920)}px;overflow:hidden;background:{BLACK}">
{leaf('lounge-sign.jpg', S(0), S(250), S(1080), S(900), .5, .4, 'br', S(200))}
<div class="abs" style="left:0;right:0;top:{S(1210)}px;display:flex;justify-content:center">{mono(S(150))}</div>
<div class="abs h" style="left:{S(90)}px;right:{S(90)}px;top:{S(1330)}px;text-align:center;font-size:{S(70)}px;color:{WHITE}"><b>Less clinical,</b> more like home</div>
<div class="abs" style="left:0;right:0;top:{S(1500)}px;display:flex;justify-content:center">{btn('Book a Consultation', S(30), S(54), S(26))}</div>
</div>"""


# ---------- pages ----------

def cover():
    return page('dark', f"""
<img class="full" src="{crop('exterior-night.jpg', 1920, 1080, .5, .5)}">
{wash('90deg', .97, .25)}
<div class="abs" style="left:160px;top:230px">{logo(470, 'reverse')}</div>
<div class="abs label" style="left:164px;top:700px;font-size:22px;color:{WHITE}">Brand guidelines</div>
<div class="abs label" style="left:164px;top:748px;color:{GOLD}">Avenue Dental Practice · Lime Avenue, Leamington Spa</div>""", dark=True)


def story():
    return page('dark', f"""
<div class="abs eyebrow" style="left:80px;top:150px">Who we are</div>
<div class="abs h" style="left:80px;top:200px;width:860px;font-size:64px"><b>Rooted in Leamington Spa.</b> Built for the community.</div>
<div class="abs body" style="left:80px;top:420px;width:780px">
<p>Avenue is a private practice on Lime Avenue in Lillington, founded by Dr Bobby Bhandal, who grew up around the corner. It covers check-ups and hygiene, implants and dentures, Invisalign and orthodontics, bonding, veneers and whitening, and children's dentistry.</p>
<p>The idea was simple: a dental visit that feels less clinical and more like home. The lounge has velvet chairs, marble and warm wood, the team takes its time, and the practice was Highly Commended for its care of nervous patients.</p></div>
<div class="abs" style="left:80px;top:800px;width:780px">
  <div class="label" style="color:{GOLD}">Brand idea</div>
  <div class="h" style="font-size:40px;margin-top:14px"><b>Less clinical,</b> more like home.</div></div>
{leaf('lounge-sign.jpg', 980, 150, 520, 780, .5, .45, 'tr')}
<div class="abs" style="left:1550px;top:150px;width:300px">
  <div class="label" style="color:{GOLD}">What sets us apart</div>
  <div class="small" style="margin-top:18px;line-height:2.1;color:#D9D4CC">Founded by a local dentist<br>Support for nervous patients<br>Free consultations on selected treatments<br>Finance options available</div>
  <div class="rule" style="margin:34px 0"></div>
  <div class="label" style="color:{GOLD}">Proof</div>
  <div style="margin-top:16px">{proof(15)}</div>
  <div class="small" style="margin-top:12px;color:#D9D4CC">Private Dentistry Awards 2025, Highly Commended: Treatment of Nervous Patients (Midlands)</div>
  <div class="rule" style="margin:34px 0"></div>
  <div class="label" style="color:{GOLD}">Areas served</div>
  <div class="small" style="margin-top:18px;line-height:2.1;color:#D9D4CC">Leamington Spa · Lillington<br>Warwick · Kenilworth<br>Surrounding Warwickshire</div>
</div>""", 1, 'Who we are', dark=True)


def logo_page():
    misuse = [
        ('Stretched', f'<div style="transform:scaleX(1.55)">{logo(80)}</div>'),
        ('Recoloured', f'<div style="filter:hue-rotate(160deg) saturate(3)">{logo(110)}</div>'),
        ('Rotated', f'<div style="transform:rotate(-12deg)">{logo(110)}</div>'),
        ('Black wordmark on dark', f'<div style="position:absolute;inset:0;background:{BLACK}"></div><div style="position:relative">{logo(110)}</div>'),
    ]
    mis = ''.join(f"""<div style="width:262px;height:160px;background:{BLUSH};position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden">{x}
<svg class="abs" style="left:0;top:0" width="262" height="160"><line x1="16" y1="146" x2="246" y2="14" stroke="{STOP}" stroke-width="2.5"/></svg>
<div class="abs label" style="left:16px;top:14px;font-size:10px;color:{STOP};background:rgba(255,255,255,.85);padding:2px 6px">{t}</div></div>""" for t, x in misuse)
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:72px">The <b>logo</b></div>
<div class="abs body" style="left:80px;top:250px;width:540px"><p>A tall Didone-style AP monogram in Main Gold, with AVENUE DENTAL set in widely spaced capitals across its middle.</p>
<p>Clear space on every side equals the height of the wordmark capitals times three. Minimum width is 110px on screen, 25mm in print.</p>
<p>Use the black wordmark on white or Blush Gold and the white wordmark on Black or dark photography. The monogram alone works as a watermark, an avatar and the round black sign in the practice. Never redraw or retype it.</p></div>
<div class="abs" style="left:700px;top:130px;width:1140px;height:430px;background:{WHITE};border:1px solid {BLUSH};display:flex;align-items:center;justify-content:center">
  <div style="position:relative;padding:44px 64px;border:1.5px dashed {GOLD}">{logo(360)}</div></div>
<div class="abs" style="left:700px;top:590px;width:270px;height:150px;background:{WHITE};border:1px solid {BLUSH};display:flex;align-items:center;justify-content:center">{logo(130)}</div>
<div class="abs" style="left:990px;top:590px;width:270px;height:150px;background:{BLACK};display:flex;align-items:center;justify-content:center">{logo(130, 'reverse')}</div>
<div class="abs" style="left:1280px;top:590px;width:270px;height:150px;overflow:hidden"><img class="full" src="{crop('exterior-day.jpg', 270, 150, .5, .6)}">{wash('180deg', .8, .7)}<div class="abs" style="inset:0;display:flex;align-items:center;justify-content:center">{logo(130, 'reverse')}</div></div>
<div class="abs" style="left:1570px;top:590px;width:270px;height:150px;background:{BLUSH};display:flex;align-items:center;justify-content:center;gap:30px">
  {mono(84)}<div style="width:96px;height:96px;border-radius:50%;background:{BLACK};display:flex;align-items:center;justify-content:center">{mono(54)}</div></div>
<div class="abs label" style="left:700px;top:752px;font-size:10px;opacity:.7">Primary on white</div>
<div class="abs label" style="left:990px;top:752px;font-size:10px;opacity:.7">Reverse on Black</div>
<div class="abs label" style="left:1280px;top:752px;font-size:10px;opacity:.7">On photo, with dark wash</div>
<div class="abs label" style="left:1570px;top:752px;font-size:10px;opacity:.7">Monogram · round sign</div>
<div class="abs label" style="left:700px;top:800px;color:{GOLD}">Misuse</div>
<div class="abs" style="left:700px;top:832px;display:flex;gap:24px">{mis}</div>""", 2, 'Logo')


def colour():
    sw = [
        ('Black', BLACK, 'Main ground: dark sections, ad backgrounds', WHITE, 80, 150, 580, 400, False),
        ('Main Gold', GOLD, 'Monogram, buttons, headline accent, rules', BLACK, 680, 150, 580, 400, False),
        ('White', WHITE, 'Text on Black, light pages', BLACK, 1280, 150, 560, 400, True),
        ('Sand Gold', SAND, 'Highlights and the gold gradient', BLACK, 80, 570, 560, 290, False),
        ('Blush Gold', BLUSH, 'Soft light grounds and cards', BLACK, 660, 570, 560, 290, False),
        ('Gold gradient', f'linear-gradient(90deg,{GOLD},{SAND} 55%,{GOLD})', 'The site navigation bar; use sparingly', BLACK, 1240, 570, 600, 290, False),
    ]
    cards = ''.join(f"""<div class="swatch" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;background:{c};color:{t};{'border:1px solid #E6E0D6;' if b else ''}">
<div style="font-family:Jost;font-weight:500;font-size:{44 if h > 300 else 30}px">{n}</div><div class="label" style="font-size:12px;margin-top:10px">{c if c.startswith('#') else GOLD + ' → ' + SAND}</div><div class="small" style="margin-top:6px;opacity:.85;font-size:14px">{u}</div></div>""" for n, c, u, t, x, y, w, h, b in sw)
    return page('', f"""{cards}
<div class="abs small" style="left:80px;top:900px;width:1760px;color:{GREY}">Avenue is dark-first: Black carries most ads and sections, as a solid ground or a deep wash over real practice photography, with White text and one Main Gold phrase per headline. Roughly 60% Black, 20% White, 12% Blush Gold, the rest gold. Main Gold is for the monogram, pill buttons, rules and the accent phrase; Sand Gold lifts highlights; Blush Gold is the light alternative ground. Body text on Black is a soft off-white (#D9D4CC). No clinical blues, no bright colours, no gold on gold.</div>""", 3, 'Colour')


def typography():
    return page('', f"""
<div class="abs" style="left:80px;top:130px;width:1080px">
  <div class="label" style="color:{GOLD}">Headline · Jost Medium · accent phrase in Main Gold</div>
  <div class="h" style="font-size:108px;margin-top:22px;line-height:1.04"><b>Dental implants</b> in Leamington Spa</div>
  <div class="small" style="margin-top:24px;width:860px;color:{GREY}">Sentence case, short and plain. One phrase turns gold, the way every heading on the website does: usually the first words on Black, or the key phrase on light grounds. No exclamation marks.</div>
</div>
<div class="abs" style="left:80px;top:660px;width:520px">
  <div class="label" style="color:{GOLD}">Body · Lexend Light 300</div>
  <div class="body" style="margin-top:14px;color:{INK}">We take time to explain every option, so you always know what happens next.</div>
</div>
<div class="abs" style="left:680px;top:660px;width:520px">
  <div class="label" style="color:{GOLD}">Label · Jost Medium · caps · +28%</div>
  <div class="label" style="margin-top:20px;font-size:18px;color:{INK}">Lime Avenue · Leamington Spa</div>
  <div class="label" style="color:{GOLD};margin-top:46px">Button · Jost SemiBold · title case · gold pill</div>
  <div style="margin-top:14px">{btn('Book Your Appointment', 18, 34, 18)}</div>
</div>
<div class="abs dark" style="left:1240px;top:130px;width:600px;height:800px;padding:56px;overflow:hidden">
  {mono(420, False, 'position:absolute;left:250px;top:470px;opacity:.08')}
  <div style="position:relative">
  <div class="label" style="color:{GOLD}">Eyebrow · Jost Medium · gold rule</div>
  <div class="eyebrow" style="margin-top:22px">Replace missing teeth</div>
  <div class="h" style="font-size:64px;margin-top:16px"><b>Dental</b><br>Implants</div>
  <div class="label" style="color:{GOLD};margin-top:60px">Link · Jost SemiBold · long gold hairline</div>
  <div class="more" style="margin-top:22px;width:420px;color:{WHITE}">Find out more</div>
  <div class="label" style="color:{GOLD};margin-top:60px">Brand sheet fonts</div>
  <div class="small" style="margin-top:12px;color:#D9D4CC">Lexend and Jost, both Google fonts. The current website sets headings in Josefin Sans; new work uses Jost.</div>
  </div>
</div>""", 4, 'Typography')


def shapes():
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:72px;width:520px">One <b>soft corner</b></div>
<div class="abs body" style="left:80px;top:330px;width:500px">
<p>On the website, photos are square-cornered rectangles with one large rounded corner, usually the one facing the copy. That single curve is the signature: calm and modern, never bubbly.</p>
<p>Line icons sit inside an open gold ring with a small gap. Buttons are full gold pills with black text. Circles are kept for the monogram sign and avatars.</p>
<p>No drop shadows, no glow, no tilted cards, no hard boxes round copy.</p></div>
{leaf('lounge-chat.jpg', 640, 130, 560, 420, .5, .5, 'tr')}
<div class="cap" style="left:640px;top:564px">Leaf frame · one corner at 16%</div>
{leaf('exterior-night.jpg', 1240, 130, 600, 420, .5, .5, 'tl')}
<div class="cap" style="left:1240px;top:564px">Corner faces the copy</div>
<div class="abs dark" style="left:640px;top:620px;width:1200px;height:330px;display:flex;align-items:center;gap:56px;padding:0 60px">
  {icon(TOOTH, 120)}{icon(HEART, 120)}{icon(CUP, 120)}
  <div style="width:1px;height:160px;background:{GOLD};opacity:.5"></div>
  <div style="display:flex;flex-direction:column;gap:22px">{btn('Book a Consultation', 18, 34, 17)}{btn('Our Ethos', 18, 34, 17, 'outline')}</div>
  <div style="width:110px;height:110px;border-radius:50%;background:#000;border:1px solid #333;display:flex;align-items:center;justify-content:center">{mono(66)}</div></div>
<div class="cap" style="left:640px;top:962px">Open gold rings · gold pills · round monogram sign</div>""", 5, 'Shapes and frames')


def elements():
    col = lambda i: 80 + i * 447
    return page('', f"""
<div class="abs" style="left:{col(0)}px;top:130px;width:417px;height:440px;overflow:hidden">
  <img class="full" src="{crop('lounge-sign.jpg', 417, 440, .3, .5)}">
  <div class="abs" style="inset:0;background:linear-gradient(90deg,rgba(27,27,27,.96) 0%,rgba(27,27,27,.75) 45%,rgba(27,27,27,0) 85%)"></div>
  <div class="abs h" style="left:34px;top:170px;width:240px;font-size:40px;color:{WHITE}"><b>Black</b> wash</div>
</div>
<div class="cap" style="left:{col(0)}px;top:584px">Black wash · 96% to clear behind copy</div>
<div class="abs dark" style="left:{col(1)}px;top:130px;width:417px;height:440px;overflow:hidden">
  {mono(360, False, 'position:absolute;left:150px;top:180px;opacity:.1')}
  <div class="abs label" style="left:34px;top:40px;font-size:12px;color:{GOLD}">Dark sections</div>
</div>
<div class="cap" style="left:{col(1)}px;top:584px">Monogram watermark 10%</div>
<div class="abs" style="left:{col(2)}px;top:130px;width:417px;height:440px;overflow:hidden">
  <img class="full" src="{crop('lounge-sign.jpg', 417, 440, .08, .5)}">
</div>
<div class="cap" style="left:{col(2)}px;top:584px">Wood slats and marble · from the lounge</div>
<div class="abs blush" style="left:{col(3)}px;top:130px;width:417px;height:440px;padding:50px 40px">
  <div class="eyebrow">Replace missing teeth</div>
  <div class="rule" style="margin:40px 0"></div>
  <div class="more" style="color:{INK}">Find out more</div>
  <div class="rule" style="margin:40px 0"></div>
  {proof(17, INK)}
</div>
<div class="cap" style="left:{col(3)}px;top:584px">Eyebrow rule · link hairline · review proof</div>
<div class="abs dark" style="left:80px;top:650px;width:1760px;height:270px;overflow:hidden;display:flex;align-items:center;gap:70px;padding:0 70px">
  <img src="assets/award.png" style="height:200px;display:block">
  <div style="width:1px;height:150px;background:{GOLD};opacity:.5"></div>
  <div style="width:820px"><div class="label" style="color:{GOLD}">Third-party proof</div>
  <div class="small" style="margin-top:12px;color:#D9D4CC">Private Dentistry Awards 2025, Highly Commended for Treatment of Nervous Patients, Midlands. Always say "Highly Commended", never "award-winning". Use the practice's live Google rating, rechecked before each batch.</div></div>
</div>
<div class="cap" style="left:80px;top:934px">Award mark · use the client's own file, never a generic trophy</div>""", 6, 'Graphic elements')


def photography():
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:72px;width:520px"><b>Our practice,</b> our people</div>
<div class="abs body" style="left:80px;top:330px;width:500px">
<p>Real people in the real practice: the team in black scrubs, the lounge with its velvet chairs, marble and slatted wood, the round gold-on-black sign, and the red-brick corner building on Lime Avenue, lit up at night.</p>
<p>Name a team member only when the name is confirmed on the website. The founder, Dr Bobby Bhandal, is named on the site.</p></div>
{leaf('exterior-night.jpg', 640, 130, 400, 520, .45, .5, 'tr')}
{leaf('exterior-day.jpg', 1070, 130, 370, 250, .5, .55, 'tr')}
{leaf('card-plant.jpg', 1470, 130, 370, 250, .5, .55, 'tr')}
{leaf('scanner-a.jpg', 1070, 410, 370, 240, .5, .4, 'tr')}
{leaf('mirror.jpg', 1470, 410, 370, 240, .5, .4, 'tr')}
<div class="abs blush" style="left:640px;top:690px;width:1200px;height:250px;padding:40px 50px;display:flex;gap:60px">
  <div style="width:520px"><div class="label" style="color:{GOLD}">Look for</div><div class="small" style="margin-top:12px;color:{INK}">Warm low light, dark tones and gold details. Calm conversations in the lounge, the team at work in black scrubs, the building at dusk. Patients who look relaxed, not posed.</div></div>
  <div style="width:520px"><div class="label" style="color:{STOP}">Avoid</div><div class="small" style="margin-top:12px;color:{INK}">Stock models, bright clinical white rooms, instruments and needles, gloved hands in mouths, and before-and-afters without the patient's written consent.</div></div></div>""", 7, 'Photography')


def voice():
    pairs = [('Warm', 'We take time to listen before anything else.', 'Pain-free dentistry, guaranteed!'),
             ('Local', 'Founded by a dentist who grew up in Leamington Spa.', 'The best dentist in the Midlands.'),
             ('Honest', 'Clear prices and a plan you understand.', 'Unbeatable prices! Book NOW!'),
             ('Reassuring', 'Nervous? You are far from the only one.', 'Don’t be a baby about the dentist.')]
    rows = ''.join(f"""<div style="display:flex;gap:30px;padding:22px 0;border-top:1px solid {GOLD}">
<div class="h" style="width:260px;font-size:38px"><b>{t}</b></div>
<div style="width:600px"><div class="label" style="font-size:10px;color:{GOLD}">We say</div><div class="body" style="margin-top:6px;color:{INK}">{y}</div></div>
<div style="width:540px;opacity:.45"><div class="label" style="font-size:10px">We don’t say</div><div class="body" style="margin-top:6px;text-decoration:line-through">{n}</div></div></div>""" for t, y, n in pairs)
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:80px">How <b>we sound</b></div>
<div class="abs body" style="left:80px;top:250px;width:1500px">Confident and warm, like a trusted local expert. Never salesy, never clinical. UK English, sentence case, no exclamation marks, no em dashes, no outcome guarantees or “pain-free” claims, no finance figures without FCA wording, and urgency only when an offer is genuinely live.</div>
<div class="abs" style="left:80px;top:400px;width:1450px">{rows}</div>
{leaf('lounge-chat.jpg', 1580, 400, 260, 440, .3, .5, 'tr')}""", 8, 'Tone of voice')


def applications():
    return page('blush', f"""
<div class="abs h" style="left:80px;top:130px;font-size:80px;width:560px">In <b>use</b></div>
<div class="abs body" style="left:80px;top:250px;width:520px;color:{INK}"><p>Meta statics: Black grounds, a real practice photo in a leaf frame, the reverse logo, a Jost headline with one gold phrase, review proof and a gold pill button.</p>
<p>Stories keep the logo and copy out of the top 250px and bottom 340px. Review proof uses the live Google count, rechecked before each batch.</p></div>
<div class="abs" style="left:680px;top:150px">{ad_square(0.68)}</div>
<div class="abs label" style="left:680px;top:900px;font-size:11px;opacity:.6">Feed 1:1</div>
<div class="abs" style="left:1440px;top:110px">{ad_story(0.43)}</div>
<div class="abs label" style="left:1440px;top:950px;font-size:11px;opacity:.6">Story 9:16</div>""", 9, 'Applications')


def close():
    return page('dark', f"""
{mono(760, False, 'position:absolute;left:1060px;top:300px;opacity:.07')}
<div class="abs" style="left:160px;top:250px">{logo(420, 'reverse')}</div>
<div class="abs label" style="left:164px;top:700px;font-size:20px;color:{WHITE}">Less clinical, more like home</div>
<div class="abs small" style="left:164px;top:750px;opacity:.8">{ADDRESS} · 01926 291536</div>""", dark=True)


def main():
    pages = [cover(), story(), logo_page(), colour(), typography(), shapes(), elements(), photography(), voice(), applications(), close()]
    head = f'<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>Avenue Dental Brand Guidelines</title><style>{CSS}</style>'
    body = f'</head><body>{"".join(pages)}</body></html>'
    (HERE / 'guideline.html').write_text(head + body)
    (HERE / 'guideline-capture.html').write_text(head + '<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>' + body)
    print('pages', len(pages))


if __name__ == '__main__':
    main()
