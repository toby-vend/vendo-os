"""Iconic Dent brand guideline: HTML harness for Figma capture.

Sources (26 Oct 2026):
- Logo: the monogram is traced from the client's own "Iconic Dent Logo.PNG" (Drive, Content Assets > Pictures >
  Practice, 1HCQ98nExzCrCepIQdn2wm-VQRQn13IB8). The ICONIC DENT wordmark is set in Mongolian Baiti, the font it
  was drawn in (checked glyph by glyph against the site's ID_LOGO_COLOUR webp), converted to outlines. Lockup
  proportions are measured from the site logo. No master vector exists on Drive: ask the client for one.
- Palette: the site's Elementor kit: Gold #BEA17A (primary), Linen #E3DFD3, Sand #E4DCD1, Paper #F4F0EF,
  Charcoal #2E2C2B, Black #000000, White. Light Gold #E1C49D appears in the kit but barely on the site.
- Type: headings Mongolian Baiti (font file supplied by Toby, assets/fonts, licensed Microsoft font, gitignored);
  body, eyebrows and buttons Montserrat.
- Shapes (homepage, 26 Oct 2026): circle photo frames bleeding off the page edge with a small solid gold disc
  overlapping the rim; tall capsule (stadium) frames for portraits; a gold disc holding a product cut-out; a huge
  faint monogram watermark; gold pill buttons and black pill buttons, white text; gold tick-in-circle bullets;
  tracked gold eyebrow labels; dark sections with rounded dark cards.
- Photos: real practice photos only. The March 2026 Sone shoot (Drive "Photos", phone stills of the gold sign
  wall, reception, surgery, CBCT, branded cups and mirror) and the team portraits on the site. The site's
  interior renders (Copy-of-Copy-of-*.webp) are CGI and the smile/lifestyle people are stock (one is Envato
  watermarked): neither is used. Team members are not named in ads unless the client confirms.
- Facts (site, 26 Oct 2026): 2 Magdalen Street, Norwich, NR3 1HX; 01603 516755; Google "Excellent" on 11 reviews
  (Trustindex widget, no average shown); directors Dr Lana Nashef and Dr Lana Haj Yahya; mission "to help every
  patient feel understood, cared for, and fully confident in their smile"; philosophy "We listen before we
  treat. We explain before we begin. We care before anything else."

Usage: python3 build_guideline.py  ->  guideline.html + guideline-capture.html (Figma capture)
"""
import subprocess
from pathlib import Path

HERE = Path(__file__).parent
WEB = HERE / 'assets/photos/web'

GOLD, LINEN, SAND, PAPER = '#BEA17A', '#E3DFD3', '#E4DCD1', '#F4F0EF'
CHAR, BLACK, WHITE = '#2E2C2B', '#000000', '#FFFFFF'
INK, GREY = '#111111', '#5E5A55'
STOP = '#A4473A'


def img(name, w, extra=''):
    return f'<img src="assets/{name}" style="display:block;width:{w}px;{extra}">'


def logo(w, colour='charcoal', kind='stacked'):
    return img(f'logo-{kind}-{colour}.svg', w)


def mono(w, colour='gold', extra=''):
    return img(f'logo-monogram-{colour}.svg', w, extra)


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


def circle(src, x, y, d, fx=.5, fy=.5, disc=None):
    """The site's circle photo frame, optionally with the small solid gold disc on its rim."""
    dot = ''
    if disc:
        dx, dy, dd = disc
        dot = f'<div class="abs" style="left:{x + dx}px;top:{y + dy}px;width:{dd}px;height:{dd}px;border-radius:50%;background:{GOLD}"></div>'
    return (f'<div class="ph" style="left:{x}px;top:{y}px;width:{d}px;height:{d}px;border-radius:50%">'
            f'<img src="{crop(src, d, d, fx, fy)}"></div>{dot}')


def capsule(src, x, y, w, h, fx=.5, fy=.5):
    """The site's tall capsule (stadium) frame for portraits and treatment cards."""
    return (f'<div class="ph" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;border-radius:{w / 2}px">'
            f'<img src="{crop(src, w, h, fx, fy)}"></div>')


TICK = ('<svg width="{s}" height="{s}" viewBox="0 0 24 24" style="display:block;flex:none"><circle cx="12" cy="12" r="12" fill="{c}"/>'
        '<path d="M7 12.4l3.2 3.1L17 8.8" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>')
STAR = '<svg width="{s}" height="{s}" viewBox="0 0 24 24" style="display:block"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill="{c}"/></svg>'
PIN = '<svg width="{s}" height="{s}" viewBox="0 0 24 24" style="display:block;flex:none"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2z" fill="currentColor"/></svg>'
ADDRESS = '2 Magdalen Street, Norwich, NR3 1HX'

CSS = f"""
@font-face{{font-family:'Mongolian Baiti';src:url('assets/fonts/monbaiti.ttf');font-weight:400;font-style:normal}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:#3a3733;font-family:'Montserrat',sans-serif;font-weight:400;color:{INK};display:flex;flex-direction:column;gap:120px;padding:120px;width:2160px;-webkit-font-smoothing:antialiased}}
.page{{position:relative;width:1920px;height:1080px;overflow:hidden;background:{PAPER}}}
.dark{{background:{CHAR};color:{LINEN}}} .linen{{background:{LINEN}}} .white{{background:{WHITE}}}
.abs{{position:absolute}}
.h{{font-family:'Mongolian Baiti',serif;font-weight:400;line-height:1.08;color:{INK}}}
.dark .h{{color:{LINEN}}}
.eyebrow{{font-family:'Montserrat',sans-serif;font-weight:500;font-size:15px;letter-spacing:.3em;text-transform:uppercase;color:{GOLD}}}
.label{{font-family:'Montserrat',sans-serif;font-weight:600;font-size:13px;letter-spacing:.24em;text-transform:uppercase}}
.body{{font-size:19px;line-height:1.7;color:{GREY}}} .body p+p{{margin-top:14px}}
.dark .body{{color:#CFC9BE}}
.small{{font-size:15px;line-height:1.6}}
.ph{{position:absolute;overflow:hidden}}
.ph img{{width:100%;height:100%;object-fit:cover;display:block}}
.full{{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}}
.btn{{display:inline-flex;align-items:center;justify-content:center;font-family:'Montserrat',sans-serif;font-weight:500;border-radius:100px;white-space:nowrap}}
.foot{{position:absolute;left:80px;right:80px;bottom:44px;display:flex;justify-content:space-between}}
.swatch{{position:absolute;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;padding:28px}}
.rule{{height:1px;background:{GOLD};opacity:.6}}
.cap{{position:absolute;font-family:'Montserrat',sans-serif;font-weight:600;font-size:10px;letter-spacing:.24em;text-transform:uppercase;opacity:.6}}
.ticks{{display:flex;flex-direction:column;gap:14px}}
.ticks div{{display:flex;align-items:center;gap:14px}}
"""


def btn(text, size, padx, pady, kind='gold'):
    bg, fg = {'gold': (GOLD, WHITE), 'black': (BLACK, WHITE), 'linen': (LINEN, INK)}[kind]
    return f'<div class="btn" style="font-size:{size}px;padding:{pady}px {padx}px;background:{bg};color:{fg}">{text}</div>'


def proof(size, colour=INK, star=GOLD):
    stars_ = ''.join(STAR.format(s=round(size * 1.1), c=star) for _ in range(5))
    return f'<div style="display:flex;align-items:center;gap:{size * .5}px;color:{colour};font-size:{size}px;font-weight:500;white-space:nowrap"><div style="display:flex;gap:2px">{stars_}</div>Rated Excellent on Google</div>'


def ticks(items, size=17, colour=INK):
    rows = ''.join(f'<div>{TICK.format(s=round(size * 1.3), c=GOLD)}<span style="font-size:{size}px;color:{colour}">{t}</span></div>' for t in items)
    return f'<div class="ticks">{rows}</div>'


def address(size, colour=INK):
    return f'<div style="display:flex;align-items:center;gap:{size * .6}px;font-size:{size}px;color:{colour}">{PIN.format(s=round(size * 1.3))}{ADDRESS}</div>'


def wash(direction='90deg', a=.92, b=.1):
    return f'<div class="abs" style="inset:0;background:linear-gradient({direction},rgba(46,44,43,{a}) 0%,rgba(46,44,43,{b}) 100%)"></div>'


def page(cls, body, n=None, title=None, dark=False):
    c = LINEN if dark else INK
    head = ''
    if title:
        head = f'<div class="abs label" style="left:80px;top:62px;color:{GOLD}">{n:02d}</div><div class="abs label" style="left:130px;top:62px;color:{c};opacity:.8">{title}</div>'
    foot = f'<div class="foot label" style="font-size:11px;color:{c};opacity:.5"><span>iconicdent.co.uk</span><span>Brand guidelines · 2026</span></div>'
    return f'<section class="page {cls}">{head}{body}{foot}</section>'


# ---------- ads in the system (Applications page) ----------

def ad_square(s):
    S = lambda v: round(v * s, 2)
    return f"""<div style="position:relative;width:{S(1080)}px;height:{S(1080)}px;overflow:hidden;background:{LINEN}">
{mono(S(900), 'white', f'position:absolute;left:{S(-260)}px;top:{S(330)}px;opacity:.35')}
{circle('reception-front.jpg', S(560), S(170), S(760), .42, .5, (S(0), S(560), S(140)))}
<div class="abs" style="left:{S(70)}px;top:{S(70)}px">{logo(S(150))}</div>
<div class="abs eyebrow" style="left:{S(70)}px;top:{S(330)}px;font-size:{S(20)}px">New patients welcome</div>
<div class="abs h" style="left:{S(70)}px;top:{S(380)}px;width:{S(440)}px;font-size:{S(70)}px">Private Dentist<br>Norwich</div>
<div class="abs" style="left:{S(70)}px;top:{S(830)}px">{btn('Book your Consultation', S(24), S(44), S(22))}</div>
<div class="abs" style="left:{S(70)}px;top:{S(975)}px">{address(S(17))}</div>
</div>"""


def ad_story(s):
    S = lambda v: round(v * s, 2)
    return f"""<div style="position:relative;width:{S(1080)}px;height:{S(1920)}px;overflow:hidden;background:{CHAR}">
{capsule('sign-wall-tall.jpg', S(240), S(250), S(600), S(900), .5, .35)}
<div class="abs" style="left:{S(700)}px;top:{S(980)}px;width:{S(180)}px;height:{S(180)}px;border-radius:50%;background:{GOLD}"></div>
<div class="abs h" style="left:{S(90)}px;right:{S(90)}px;top:{S(1240)}px;text-align:center;font-size:{S(76)}px;color:{LINEN}">Join The Iconic Experience</div>
<div class="abs" style="left:0;right:0;top:{S(1440)}px;display:flex;justify-content:center">{btn('Book your Consultation', S(30), S(54), S(26))}</div>
</div>"""


# ---------- pages ----------

def cover():
    return page('dark', f"""
<img class="full" src="{crop('reception-front.jpg', 1920, 1080, .5, .5)}">
{wash('90deg', .97, .3)}
<div class="abs" style="left:170px;top:250px">{logo(380, 'cream')}</div>
<div class="abs eyebrow" style="left:170px;top:720px;font-size:22px;color:{LINEN}">Brand guidelines</div>
<div class="abs eyebrow" style="left:170px;top:768px">Iconic Dent · Magdalen Street, Norwich</div>""", dark=True)


def story():
    return page('linen', f"""
{mono(820, 'white', 'position:absolute;left:1180px;top:200px;opacity:.55')}
<div class="abs eyebrow" style="left:80px;top:150px">Who we are</div>
<div class="abs h" style="left:80px;top:190px;width:820px;font-size:68px">Private Dentist Norwich</div>
<div class="abs body" style="left:80px;top:320px;width:760px;color:{INK}">
<p>Iconic Dent is a private practice at 2 Magdalen Street in central Norwich, run by two directors, Dr Lana Nashef and Dr Lana Haj Yahya. It covers check-ups and hygiene, emergency appointments, implants and dentures, Invisalign and clear aligners, bonding, veneers, whitening and smile makeovers.</p>
<p>The practice exists “to help every patient feel understood, cared for, and fully confident in their smile.” Three membership plans spread routine care across the year.</p></div>
<div class="abs" style="left:80px;top:690px;width:760px">
  <div class="eyebrow">Our philosophy</div>
  <div class="h" style="font-size:36px;margin-top:16px;line-height:1.35">We listen before we treat.<br>We explain before we begin.<br>We care before anything else.</div></div>
{circle('sign-wall-chair.jpg', 960, 150, 520, .5, .38, (20, 400, 110))}
<div class="abs" style="left:1540px;top:170px;width:300px">
  <div class="eyebrow" style="font-size:13px">What sets us apart</div>
  <div style="margin-top:20px">{ticks(['Membership plans', 'Emergency appointments', 'Complimentary cosmetic consultations', '0% finance available', 'Support for nervous patients'], 15)}</div>
  <div class="rule" style="margin:32px 0"></div>
  <div class="eyebrow" style="font-size:13px">Proof</div>
  <div style="margin-top:16px">{proof(15)}</div>
  <div class="small" style="margin-top:10px;color:{GREY}">Google reviews via the site widget. Recheck the live count before each batch.</div>
</div>""", 1, 'Who we are')


def logo_page():
    misuse = [
        ('Stretched', f'<div style="transform:scaleX(1.5)">{logo(70)}</div>'),
        ('Recoloured', f'<div style="filter:hue-rotate(200deg) saturate(4)">{logo(90, "gold")}</div>'),
        ('Retyped', f'<div style="display:flex;flex-direction:column;align-items:center;gap:8px">{mono(56, "charcoal")}<div style="font-family:Montserrat;font-weight:700;font-size:15px;letter-spacing:.05em">ICONIC DENT</div></div>'),
        ('Gold on Linen', f'<div style="position:absolute;inset:0;background:{LINEN}"></div><div style="position:relative;opacity:.9">{logo(90, "white")}</div>'),
    ]
    mis = ''.join(f"""<div style="width:262px;height:160px;background:{WHITE};position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden">{x}
<svg class="abs" style="left:0;top:0" width="262" height="160"><line x1="16" y1="146" x2="246" y2="14" stroke="{STOP}" stroke-width="2.5"/></svg>
<div class="abs label" style="left:16px;top:14px;font-size:10px;color:{STOP};background:rgba(255,255,255,.85);padding:2px 6px">{t}</div></div>""" for t, x in misuse)
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:76px">The Logo</div>
<div class="abs body" style="left:80px;top:250px;width:540px"><p>A ring holding an angular monogram of fine strokes, over ICONIC DENT in widely set capitals. The stacked lockup is the primary. The horizontal lockup suits narrow headers; the monogram alone is the sign on the reception wall, a watermark and an avatar.</p>
<p>Clear space on every side equals the height of the wordmark capitals. Minimum width 110px on screen, 25mm in print.</p>
<p>Charcoal on Paper, Linen or White. Linen or White on Charcoal and dark photography. Gold where the practice uses it: the brushed gold sign. Never retype the wordmark or redraw the ring.</p></div>
<div class="abs white" style="left:700px;top:130px;width:1140px;height:430px;display:flex;align-items:center;justify-content:center;gap:120px">
  <div style="position:relative;padding:40px 56px;border:1.5px dashed {GOLD}">{logo(300)}</div>
  <div style="position:relative;padding:30px 40px;border:1.5px dashed {GOLD}">{logo(330, 'charcoal', 'horizontal')}</div></div>
<div class="abs" style="left:700px;top:590px;width:270px;height:150px;background:{LINEN};display:flex;align-items:center;justify-content:center">{logo(110)}</div>
<div class="abs" style="left:990px;top:590px;width:270px;height:150px;background:{CHAR};display:flex;align-items:center;justify-content:center">{logo(110, 'cream')}</div>
<div class="abs" style="left:1280px;top:590px;width:270px;height:150px;overflow:hidden"><img class="full" src="{crop('reception-side.jpg', 270, 150, .5, .5)}">{wash('180deg', .82, .72)}<div class="abs" style="inset:0;display:flex;align-items:center;justify-content:center">{logo(110, 'cream')}</div></div>
<div class="abs" style="left:1570px;top:590px;width:270px;height:150px;background:{WHITE};display:flex;align-items:center;justify-content:center;gap:30px">
  {mono(84, 'gold')}<div style="width:96px;height:96px;border-radius:50%;background:{CHAR};display:flex;align-items:center;justify-content:center">{mono(62, 'cream')}</div></div>
<div class="abs label" style="left:700px;top:752px;font-size:10px;opacity:.7">Primary on Linen</div>
<div class="abs label" style="left:990px;top:752px;font-size:10px;opacity:.7">Reverse on Charcoal</div>
<div class="abs label" style="left:1280px;top:752px;font-size:10px;opacity:.7">On photo, with dark wash</div>
<div class="abs label" style="left:1570px;top:752px;font-size:10px;opacity:.7">Monogram · avatar</div>
<div class="abs label" style="left:700px;top:800px;color:{GOLD}">Misuse</div>
<div class="abs" style="left:700px;top:832px;display:flex;gap:24px">{mis}</div>""", 2, 'Logo')


def colour():
    sw = [
        ('Gold', GOLD, 'Buttons, eyebrows, ticks, discs, the sign', WHITE, 80, 150, 580, 400, False),
        ('Linen', LINEN, 'Signature light ground', INK, 680, 150, 580, 400, False),
        ('Charcoal', CHAR, 'Dark sections and ad grounds', LINEN, 1280, 150, 560, 400, False),
        ('Paper', PAPER, 'Page ground, light sections', INK, 80, 570, 420, 290, True),
        ('Sand', SAND, 'Alternate light ground', INK, 520, 570, 420, 290, False),
        ('White', WHITE, 'Cards, text on gold', INK, 960, 570, 420, 290, True),
        ('Black', BLACK, 'Headlines, secondary button', WHITE, 1400, 570, 440, 290, False),
    ]
    cards = ''.join(f"""<div class="swatch" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;background:{c};color:{t};{'border:1px solid #DDD6CB;' if b else ''}">
<div style="font-family:'Mongolian Baiti';font-size:{48 if h > 300 else 34}px">{n}</div><div class="label" style="font-size:12px;margin-top:10px">{c}</div><div class="small" style="margin-top:6px;opacity:.85;font-size:14px">{u}</div></div>""" for n, c, u, t, x, y, w, h, b in sw)
    return page('', f"""{cards}
<div class="abs small" style="left:80px;top:900px;width:1760px;color:{GREY}">Iconic is light, warm and quiet: Linen and Paper carry most of the space, Charcoal is for dark sections and evening-toned ads, and Gold is the single accent. Roughly 60% Linen and Paper, 20% Charcoal, 10% White, 10% Gold. Gold is used solid (buttons, discs, ticks) or as the photographed brushed-gold sign, never as a gradient or a glow. Headlines are Black on light grounds and Linen on Charcoal. No clinical blues, no bright colours.</div>""", 3, 'Colour')


def typography():
    return page('', f"""
<div class="abs" style="left:80px;top:130px;width:1080px">
  <div class="label" style="color:{GOLD}">Headline · Mongolian Baiti · Title Case</div>
  <div class="h" style="font-size:112px;margin-top:22px;line-height:1.02">Your Smile, Our Passion</div>
  <div class="small" style="margin-top:24px;width:860px;color:{GREY}">Large, light and classical. Title Case, as on every heading on the website. Short lines, no exclamation marks, never bold or italic.</div>
</div>
<div class="abs" style="left:80px;top:640px;width:520px">
  <div class="label" style="color:{GOLD}">Body · Montserrat Regular</div>
  <div class="body" style="margin-top:14px;color:{INK}">We talk you through everything we can see, so nothing goes over your head.</div>
  <div class="label" style="color:{GOLD};margin-top:40px">Ticks · gold circle</div>
  <div style="margin-top:16px">{ticks(['Emergency appointments available', 'Complimentary cosmetic consultations'], 16)}</div>
</div>
<div class="abs" style="left:680px;top:640px;width:520px">
  <div class="label" style="color:{GOLD}">Eyebrow · Montserrat Medium · caps · +30%</div>
  <div class="eyebrow" style="margin-top:20px;font-size:17px">Transform your confidence with</div>
  <div class="label" style="color:{GOLD};margin-top:46px">Buttons · Montserrat Medium · pill</div>
  <div style="margin-top:14px;display:flex;gap:16px">{btn('Book your Consultation', 17, 32, 17)}{btn('Find out more', 17, 32, 17, 'black')}</div>
</div>
<div class="abs dark" style="left:1240px;top:130px;width:600px;height:800px;padding:56px;overflow:hidden">
  {mono(460, 'cream', 'position:absolute;left:230px;top:430px;opacity:.07')}
  <div style="position:relative">
  <div class="eyebrow">Membership plans</div>
  <div class="h" style="font-size:66px;margin-top:18px">Join The ICONIC Experience</div>
  <div class="body" style="margin-top:26px">On Charcoal, headlines turn Linen and body text a soft stone (#CFC9BE). The practice name sits in capitals when it is the brand: ICONIC Signature, ICONIC VIP.</div>
  <div class="label" style="color:{GOLD};margin-top:50px">Font files</div>
  <div class="small" style="margin-top:12px;color:#CFC9BE">Mongolian Baiti is a licensed Windows font, so Mac and phone visitors to the site see a fallback. Ads and print embed the real font. Montserrat is a Google font.</div>
  </div>
</div>""", 4, 'Typography')


def shapes():
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:72px;width:520px">Circles And Capsules</div>
<div class="abs body" style="left:80px;top:330px;width:500px">
<p>Photos sit in soft geometry: large circles that bleed off the page edge, and tall capsules for portraits and treatment cards. Both echo the ring of the monogram.</p>
<p>A small solid gold disc overlaps the rim of the frame. One per layout, never more.</p>
<p>No hard square crops, no drop shadows, no tilted cards, no outlined boxes round copy.</p></div>
{circle('reception-front.jpg', 640, 130, 470, .4, .5, (8, 350, 110))}
<div class="cap" style="left:640px;top:620px">Circle frame · gold disc on the rim</div>
{capsule('P1217728.jpg', 1180, 130, 280, 460, .5, .35)}
<div class="cap" style="left:1180px;top:620px">Capsule · portraits</div>
<div class="abs" style="left:1520px;top:180px;width:320px;height:320px;border-radius:50%;background:{GOLD};display:flex;align-items:center;justify-content:center">{mono(170, 'white')}</div>
<div class="cap" style="left:1520px;top:620px">Gold disc · holds a cut-out or the monogram</div>
<div class="abs linen" style="left:640px;top:680px;width:1200px;height:270px;display:flex;align-items:center;gap:56px;padding:0 60px;overflow:hidden">
  {mono(520, 'white', 'position:absolute;left:820px;top:-120px;opacity:.6')}
  <div style="position:relative;display:flex;flex-direction:column;gap:18px">{btn('Book your Consultation', 17, 32, 17)}{btn('Find out more', 17, 32, 17, 'black')}</div>
  <div style="position:relative">{ticks(['Rooted in Norwich', 'Emergency appointments', '0% finance available'], 16)}</div></div>
<div class="cap" style="left:640px;top:962px">Pill buttons · gold ticks · monogram watermark</div>""", 5, 'Shapes and frames')


def elements():
    col = lambda i: 80 + i * 447
    return page('', f"""
<div class="abs" style="left:{col(0)}px;top:130px;width:417px;height:440px;overflow:hidden">
  <img class="full" src="{crop('surgery.jpg', 417, 440, .45, .5)}">
  <div class="abs" style="inset:0;background:linear-gradient(90deg,rgba(46,44,43,.95) 0%,rgba(46,44,43,.7) 45%,rgba(46,44,43,0) 90%)"></div>
  <div class="abs h" style="left:34px;top:180px;width:260px;font-size:44px;color:{LINEN}">Charcoal Wash</div>
</div>
<div class="cap" style="left:{col(0)}px;top:584px">Charcoal wash · 95% to clear behind copy</div>
<div class="abs linen" style="left:{col(1)}px;top:130px;width:417px;height:440px;overflow:hidden">
  {mono(520, 'white', 'position:absolute;left:60px;top:60px;opacity:.7')}
  <div class="abs eyebrow" style="left:34px;top:40px;font-size:12px">Watermark</div>
</div>
<div class="cap" style="left:{col(1)}px;top:584px">Monogram watermark · White on Linen</div>
<div class="abs" style="left:{col(2)}px;top:130px;width:417px;height:440px;overflow:hidden">
  <img class="full" src="{crop('sign-wall-tall.jpg', 417, 440, .5, .32)}">
</div>
<div class="cap" style="left:{col(2)}px;top:584px">The brushed gold sign · real, never rendered</div>
<div class="abs white" style="left:{col(3)}px;top:130px;width:417px;height:440px;padding:50px 40px">
  <div class="eyebrow">Dental implants</div>
  <div class="rule" style="margin:36px 0"></div>
  {ticks(['Single implants', 'Full-arch options'], 16)}
  <div class="rule" style="margin:36px 0"></div>
  {proof(16)}
</div>
<div class="cap" style="left:{col(3)}px;top:584px">Eyebrow · ticks · review proof</div>
<div class="abs dark" style="left:80px;top:650px;width:1760px;height:270px;overflow:hidden;display:flex;align-items:center;gap:60px;padding:0 70px">
  <div style="width:150px;height:150px;border-radius:50%;overflow:hidden;flex:none"><img src="{crop('coffee-cup.jpg', 150, 150, .45, .62)}" style="width:100%;height:100%;display:block"></div>
  <div style="width:150px;height:150px;border-radius:50%;overflow:hidden;flex:none"><img src="{crop('mirror-boutique.jpg', 150, 150, .5, .62)}" style="width:100%;height:100%;display:block"></div>
  <div style="width:1px;height:150px;background:{GOLD};opacity:.5"></div>
  <div style="width:900px"><div class="eyebrow">Branded details</div>
  <div class="small" style="margin-top:12px;color:#CFC9BE">The practice already carries the brand into small things: the monogram on coffee cups, hand mirrors and the reception desk. Use these real details as proof of care. Never mock up the logo onto products the practice does not have.</div></div>
</div>
<div class="cap" style="left:80px;top:934px;color:{INK}">Real branded objects from the practice</div>""", 6, 'Graphic elements')


def photography():
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:72px;width:520px">Our Practice, Our People</div>
<div class="abs body" style="left:80px;top:330px;width:500px">
<p>Real people in the real practice on Magdalen Street: the team in stone-coloured scrubs, the gold sign on the marble wall, the reception and lounge, the surgeries and the CBCT room.</p>
<p>The site's interior renders are CGI and its smiling-model photos are stock. Neither goes into ads. Name a team member only when the practice confirms it.</p></div>
{capsule('Tegan-Lewis-Dental-Nurse.jpg', 640, 130, 300, 520, .5, .4)}
{circle('reception-side.jpg', 980, 130, 250, .5, .5)}
{circle('surgery.jpg', 1260, 130, 250, .5, .5)}
{circle('cbct.jpg', 1540, 130, 250, .5, .4)}
{circle('consult-room.jpg', 980, 400, 250, .45, .5)}
{circle('drinks-station.jpg', 1260, 400, 250, .5, .5)}
{circle('IMG_7396.jpg', 1540, 400, 250, .5, .55)}
<div class="abs linen" style="left:640px;top:690px;width:1200px;height:250px;padding:40px 50px;display:flex;gap:60px">
  <div style="width:520px"><div class="eyebrow">Look for</div><div class="small" style="margin-top:12px;color:{INK}">Warm uplight, marble, brushed gold and soft stone tones. The team at work, calm conversations at the screen, the branded details. Patients who look relaxed, not posed.</div></div>
  <div style="width:520px"><div class="eyebrow" style="color:{STOP}">Avoid</div><div class="small" style="margin-top:12px;color:{INK}">Stock models, CGI renders, harsh clinical white, needles and gloved hands in mouths, and before-and-afters without the patient's written consent.</div></div></div>""", 7, 'Photography')


def voice():
    pairs = [('Transparent', 'You’ll get your options and costs in writing.', 'Unbeatable prices! Book NOW!'),
             ('Reassuring', 'We go at your pace and explain every step.', 'Pain-free dentistry, guaranteed.'),
             ('Local', 'Your dentist on Magdalen Street, in the heart of Norwich.', 'The best dentist in East Anglia.'),
             ('Personal', 'Tell us what you’d like to change, and we’ll show you what’s possible.', 'Get the perfect Hollywood smile.')]
    rows = ''.join(f"""<div style="display:flex;gap:30px;padding:22px 0;border-top:1px solid {GOLD}">
<div class="h" style="width:280px;font-size:38px">{t}</div>
<div style="width:600px"><div class="label" style="font-size:10px;color:{GOLD}">We say</div><div class="body" style="margin-top:6px;color:{INK}">{y}</div></div>
<div style="width:520px;opacity:.45"><div class="label" style="font-size:10px">We don’t say</div><div class="body" style="margin-top:6px;text-decoration:line-through">{n}</div></div></div>""" for t, y, n in pairs)
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:80px">How We Sound</div>
<div class="abs body" style="left:80px;top:250px;width:1500px">Calm, warm and plain-spoken: we listen, we explain, we care. Never salesy, never clinical. UK English, no exclamation marks, no em dashes, no outcome guarantees or “pain-free” claims, no finance figures without FCA wording, and urgency only when an offer is genuinely live.</div>
<div class="abs" style="left:80px;top:400px;width:1450px">{rows}</div>
{capsule('P1080465.jpg', 1580, 400, 260, 440, .5, .35)}""", 8, 'Tone of voice')


def applications():
    return page('linen', f"""
<div class="abs h" style="left:80px;top:130px;font-size:80px;width:560px">In Use</div>
<div class="abs body" style="left:80px;top:250px;width:520px;color:{INK}"><p>Meta statics: a Linen or Charcoal ground, a real practice photo in a circle or capsule with one gold disc, the logo, a Mongolian Baiti headline, gold ticks and a gold pill button.</p>
<p>Stories keep the logo and copy out of the top 250px and bottom 340px. Review proof uses the live Google count, rechecked before each batch.</p></div>
<div class="abs" style="left:680px;top:150px">{ad_square(0.68)}</div>
<div class="abs label" style="left:680px;top:900px;font-size:11px;opacity:.6">Feed 1:1</div>
<div class="abs" style="left:1440px;top:110px">{ad_story(0.43)}</div>
<div class="abs label" style="left:1440px;top:950px;font-size:11px;opacity:.6">Story 9:16</div>""", 9, 'Applications')


def close():
    return page('dark', f"""
{mono(760, 'cream', 'position:absolute;left:1060px;top:300px;opacity:.06')}
<div class="abs" style="left:170px;top:250px">{logo(360, 'cream')}</div>
<div class="abs eyebrow" style="left:170px;top:700px;font-size:20px;color:{LINEN}">We listen before we treat</div>
<div class="abs small" style="left:170px;top:750px;opacity:.8">{ADDRESS} · 01603 516755</div>""", dark=True)


def main():
    pages = [cover(), story(), logo_page(), colour(), typography(), shapes(), elements(), photography(), voice(), applications(), close()]
    fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap">'
    head = f'<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>Iconic Dent Brand Guidelines</title>{fonts}<style>{CSS}</style>'
    body = f'</head><body>{"".join(pages)}</body></html>'
    (HERE / 'guideline.html').write_text(head + body)
    (HERE / 'guideline-capture.html').write_text(head + '<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>' + body)
    print('pages', len(pages))


if __name__ == '__main__':
    main()
