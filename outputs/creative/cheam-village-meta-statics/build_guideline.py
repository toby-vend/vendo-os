"""Cheam Village Dental Studios brand guideline: HTML harness for Figma capture.

Sources (27 Oct 2026):
- Brand sheet: Drive "Cheam-Village-Dental-Studios-Branding (3) (1).pdf" (1ivs31oHkSXzx_Sfhu9b2Nxm2kyzb6ODo, by
  Lucianne Soley), saved to assets/brand/branding.pdf. It sets the logo, logo variations (stacked, roundel), the
  palette (swatches sampled from the PDF render), icons (tooth, house trio, double slash), patterns (house mosaic
  circle, house trio) and fonts: Montserrat for highlights, Mr Eaves XL Sans for titles and body, Tuesday Night for
  personal messages, with lock-ups "your Smile" and "appointment reminder".
- Logos: vector marks cropped from that PDF (clean_logos.py); nothing is redrawn.
- Fonts: Montserrat (Google). Tuesday Night is the file the live site serves (static.wixstatic.com ufonts).
  Mr Eaves XL Sans is an Adobe font we do not hold; the site sets titles in Montserrat, so this guideline does too.
- Photos: Bethany Lavin practice shoot, Drive "Content Assets / Vendo Images" (assets/photos, gitignored).
- Facts (site + Google, 27 Oct 2026): 21 Upper Mulgrave Road, Cheam, SM2 7AY; 020 8643 6063; 1 minute walk from
  Cheam station; husband-and-wife run; Dr Krishan Patel (Principal and Implant Dentist), Dr Devaki Patel
  (Principal / Specialist Orthodontist, MOrth RCS(Eng)); 5.0 from 461 Google reviews; Private Dentistry Awards
  finalists (site banner: 2025 Best Dental Team; body copy: 2024 Practice of the Year and Best Young Dentist).

Usage: python3 build_guideline.py  ->  guideline.html + guideline-capture.html (Figma capture)
"""
import subprocess
from pathlib import Path

HERE = Path(__file__).parent
PH = HERE / 'assets/photos'

NAVY, SLATE, MIST, SAGE, STONE, CREAM = '#1E445B', '#30424C', '#A8B8B8', '#54655E', '#8C948D', '#E5E5D8'
BLACK, CHAR, SILVER, BASE, WHITE = '#0D0D0D', '#2F2D2E', '#C6C7C8', '#F4F4F4', '#FFFFFF'
GOLD, PINK = '#C9B76D', '#E86987'
INK, GREY, STOP = '#231F20', '#5E6568', '#B5523F'
ADDRESS = '21 Upper Mulgrave Road, Cheam, SM2 7AY'


def logo(kind, w, colour='ink', extra=''):
    return f'<img src="assets/logos/{kind}-{colour}.svg" style="display:block;width:{w}px;{extra}">'


# ---------- photo crops (capture ignores object-position, so every frame gets a pre-cut image) ----------

def _dims(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v', '-show_entries', 'stream=width,height',
                          '-of', 'csv=p=0', str(path)], capture_output=True, text=True).stdout.strip()
    return map(int, out.split(','))


def _cover(src, w, h, fx, fy):
    """ffmpeg crop+scale that cover-crops the real image aspect around a focal point (never stretches)."""
    W, H = _dims(PH / src)
    if W / H > w / h:
        ch, cw = H, round(H * w / h)
    else:
        cw, ch = W, round(W * h / w)
    x = min(max(round(fx * W - cw / 2), 0), W - cw)
    y = min(max(round(fy * H - ch / 2), 0), H - ch)
    ow = min(cw, 2 * w) // 2 * 2
    return f'crop={cw}:{ch}:{x}:{y},scale={ow}:-2', ow


def crop(src, w, h, fx=.5, fy=.5):
    w, h = round(w), round(h)
    out = PH / 'crops' / f'{Path(src).stem}-{w}x{h}-{round(fx * 100)}-{round(fy * 100)}.jpg'
    if not out.exists():
        out.parent.mkdir(exist_ok=True)
        vf, _ = _cover(src, w, h, fx, fy)
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(PH / src), '-vf', vf, '-q:v', '3', str(out)],
                       check=True)
    return f'assets/photos/crops/{out.name}'


def house_png(src, w, h, fx=.5, fy=.5, roof=.26):
    """The brand's village-house shape: a photo with a gabled top, baked into a PNG with an anti-aliased alpha
    edge (Figma capture drops CSS clip-path). roof = gable height as a share of the width."""
    w, h = round(w), round(h)
    out = PH / 'crops' / f'{Path(src).stem}-house-{w}x{h}-{round(fx * 100)}-{round(fy * 100)}-{round(roof * 100)}.png'
    if not out.exists():
        out.parent.mkdir(exist_ok=True)
        vf, ow = _cover(src, w, h, fx, fy)
        r = roof * ow
        alpha = f"a='clip((Y-{r:.1f}*abs(2*X/W-1))*48+128,0,255)'"
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(PH / src), '-vf',
                        f"{vf},format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':{alpha}", str(out)], check=True)
    return f'assets/photos/crops/{out.name}'


def house(src, x, y, w, h, fx=.5, fy=.5, roof=.26):
    return (f'<div class="ph" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px">'
            f'<img src="{house_png(src, w, h, fx, fy, roof)}"></div>')


def frame(src, x, y, w, h, fx=.5, fy=.5):
    return f'<div class="ph" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px"><img src="{crop(src, w, h, fx, fy)}"></div>'


def house_shape(w, colour, roof=.26, extra=''):
    """Solid house silhouette (pattern and icon use), as inline SVG so it lands in Figma as a vector."""
    h = w * 1.15
    r = w * roof
    return (f'<svg width="{w:.0f}" height="{h:.0f}" viewBox="0 0 {w:.1f} {h:.1f}" style="display:block;{extra}">'
            f'<path d="M0 {r:.1f} L{w / 2:.1f} 0 L{w:.1f} {r:.1f} V{h:.1f} H0 Z" fill="{colour}"/></svg>')


def trio(w, colours=(SILVER, SILVER, SILVER), gap=.08):
    """The brand sheet's three-house icon."""
    each = w / (3 + 2 * gap)
    return (f'<div style="display:flex;gap:{each * gap:.1f}px;align-items:flex-end">'
            + ''.join(house_shape(each, c) for c in colours) + '</div>')


def slash(h, colour=MIST, sw=None):
    """The brand sheet's double slash."""
    sw = sw or h * .09
    w = h * .9
    return (f'<svg width="{w * 1.5:.0f}" height="{h:.0f}" viewBox="0 0 {w * 1.5:.1f} {h:.1f}" style="display:block">'
            f'<line x1="0" y1="{h:.1f}" x2="{w:.1f}" y2="0" stroke="{colour}" stroke-width="{sw:.1f}"/>'
            f'<line x1="{w * .5:.1f}" y1="{h:.1f}" x2="{w * 1.5:.1f}" y2="0" stroke="{colour}" stroke-width="{sw:.1f}"/></svg>')


STAR = '<svg width="{s}" height="{s}" viewBox="0 0 24 24" style="display:block"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill="{c}"/></svg>'
PIN = '<svg width="{s}" height="{s}" viewBox="0 0 24 24" style="display:block;flex:none"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2z" fill="currentColor"/></svg>'


def proof(size, colour=INK, star=GOLD):
    stars = ''.join(STAR.format(s=round(size * 1.1), c=star) for _ in range(5))
    return (f'<div style="display:flex;align-items:center;gap:{size * .6}px;color:{colour};font-size:{size}px;'
            f'font-weight:500;letter-spacing:.04em;white-space:nowrap"><div style="display:flex;gap:2px">{stars}</div>'
            f'5.0 from 461 Google reviews</div>')


def btn(text, size, padx, pady, bg=NAVY, fg=WHITE, border=None):
    return (f'<div class="btn" style="font-size:{size}px;padding:{pady}px {padx}px;background:{bg};color:{fg};'
            f'border-color:{border or bg}">{text}</div>')


GRAIN = ("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>"
         "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 .5 0 0 0 0 .5 0 0 0 0 .5 0 0 0 .55 0'/></filter>"
         "<rect width='300' height='300' filter='url(%23n)'/></svg>")

CSS = f"""
@font-face{{font-family:'Montserrat';src:url('assets/fonts/Montserrat.ttf');font-weight:100 900}}
@font-face{{font-family:'Tuesday Night';src:url('assets/fonts/TuesdayNight-Regular.ttf')}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:#3b4145;font-family:'Montserrat',sans-serif;font-weight:400;color:{INK};display:flex;flex-direction:column;gap:120px;padding:120px;width:2160px;-webkit-font-smoothing:antialiased}}
.page{{position:relative;width:1920px;height:1080px;overflow:hidden;background:{WHITE}}}
.navy{{background:{NAVY};color:{WHITE}}} .base{{background:{BASE}}} .cream{{background:{CREAM}}}
.abs{{position:absolute}}
.h{{font-weight:300;letter-spacing:.32em;text-transform:uppercase;line-height:1.35;color:{INK}}}
.h b{{font-weight:700}}
.navy .h{{color:{WHITE}}}
.script{{font-family:'Tuesday Night',cursive;font-weight:400;letter-spacing:0;text-transform:none;line-height:1}}
.label{{font-weight:500;font-size:13px;letter-spacing:.34em;text-transform:uppercase}}
.body{{font-size:18px;line-height:1.75;color:{GREY};font-weight:400}} .body p+p{{margin-top:14px}}
.navy .body{{color:#D3DCDD}}
.small{{font-size:14px;line-height:1.65}}
.ph{{position:absolute;overflow:hidden}}
.ph img{{width:100%;height:100%;object-fit:cover;display:block}}
.full{{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}}
.btn{{display:inline-flex;align-items:center;justify-content:center;font-weight:600;letter-spacing:.26em;text-transform:uppercase;white-space:nowrap;border:1.5px solid transparent}}
.foot{{position:absolute;left:80px;right:80px;bottom:44px;display:flex;justify-content:space-between}}
.swatch{{position:absolute;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;padding:24px}}
.rule{{height:1px;background:{MIST}}}
.cap{{position:absolute;font-weight:500;font-size:10px;letter-spacing:.28em;text-transform:uppercase;opacity:.65}}
.grain{{position:absolute;inset:0;background-image:url("{GRAIN}");opacity:.1;mix-blend-mode:overlay;pointer-events:none}}
"""


def page(cls, body, n=None, title=None, dark=False):
    c = WHITE if dark else INK
    head = ''
    if title:
        head = (f'<div class="abs label" style="left:80px;top:62px;color:{MIST if dark else STONE}">{n:02d}</div>'
                f'<div class="abs label" style="left:130px;top:62px;color:{c};opacity:.8">{title}</div>')
    foot = (f'<div class="foot label" style="font-size:10px;color:{c};opacity:.5"><span>cheamvillagedentalstudios.co.uk</span>'
            f'<span>Brand guidelines · 2026</span></div>')
    return f'<section class="page {cls}">{head}{body}{foot}</section>'


# ---------- ads in the system (Applications page) ----------

def ad_square(s):
    S = lambda v: round(v * s, 2)
    return f"""<div style="position:relative;width:{S(1080)}px;height:{S(1080)}px;overflow:hidden;background:{WHITE};border:1px solid {SILVER}">
{house('bl-07.jpg', S(560), S(150), S(450), S(860), .62, .5, .3)}
<div class="abs" style="left:{S(70)}px;top:{S(80)}px">{logo('stacked', S(300))}</div>
<div class="abs h" style="left:{S(70)}px;top:{S(330)}px;width:{S(460)}px;font-size:{S(40)}px">Straighter teeth, <b>planned by a specialist</b></div>
<div class="abs script" style="left:{S(70)}px;top:{S(560)}px;font-size:{S(92)}px;color:{NAVY}">in Cheam</div>
<div class="abs" style="left:{S(70)}px;top:{S(720)}px">{proof(S(18))}</div>
<div class="abs" style="left:{S(70)}px;top:{S(860)}px">{btn('Book a consultation', S(18), S(36), S(22))}</div>
<div class="grain"></div></div>"""


def ad_story(s):
    S = lambda v: round(v * s, 2)
    return f"""<div style="position:relative;width:{S(1080)}px;height:{S(1920)}px;overflow:hidden;background:{NAVY}">
{house('bl-10.jpg', S(140), S(260), S(800), S(900), .5, .5, .3)}
<div class="abs" style="left:0;right:0;top:{S(1230)}px;display:flex;justify-content:center">{logo('horizontal', S(760), 'white')}</div>
<div class="abs h" style="left:{S(90)}px;right:{S(90)}px;top:{S(1330)}px;text-align:center;font-size:{S(44)}px;color:{WHITE}">Future-proof <b>your smile</b></div>
<div class="abs" style="left:0;right:0;top:{S(1470)}px;display:flex;justify-content:center">{btn('Book now', S(24), S(54), S(26), WHITE, NAVY)}</div>
<div class="grain"></div></div>"""


# ---------- pages ----------

def cover():
    return page('base', f"""
{house('bl-10.jpg', 1080, 150, 680, 930, .5, .55, .3)}
<div class="abs" style="left:160px;top:330px">{logo('stacked', 700)}</div>
<div class="abs script" style="left:150px;top:560px;font-size:120px;color:{NAVY}">Brand guidelines</div>
<div class="abs label" style="left:166px;top:760px;color:{STONE}">{ADDRESS}</div>
<div class="abs" style="left:166px;top:830px">{trio(120, (SILVER, MIST, NAVY))}</div>
<div class="grain"></div>""")


def story():
    return page('navy', f"""
<div class="abs label" style="left:80px;top:150px;color:{MIST}">Who we are</div>
<div class="abs h" style="left:80px;top:200px;width:880px;font-size:46px">A family practice in the <b>heart of Cheam Village</b></div>
<div class="abs body" style="left:80px;top:430px;width:800px">
<p>Cheam Village Dental Studios is a private, husband-and-wife run practice on Upper Mulgrave Road, a minute's walk from Cheam station. Dr Krishan Patel leads implants and general care; Dr Devaki Patel is a specialist orthodontist.</p>
<p>The aim is a personal service: time to listen, a bespoke plan, and a calm, friendly team that puts nervous patients at ease.</p></div>
<div class="abs" style="left:80px;top:720px;width:800px">
  <div class="label" style="color:{MIST}">Brand idea</div>
  <div class="label" style="margin-top:22px;font-size:15px;letter-spacing:.5em">Future-proof</div><div class="script" style="font-size:96px;margin-top:34px;padding-left:20px">your Smile</div></div>
{house('bl-03.jpg', 980, 150, 520, 790, .5, .45, .3)}
<div class="abs" style="left:1550px;top:150px;width:300px">
  <div class="label" style="color:{MIST}">What sets us apart</div>
  <div class="small" style="margin-top:18px;line-height:2.1;color:#D3DCDD">Specialist orthodontist in-house<br>500+ implants placed<br>Husband-and-wife run<br>0% finance plans available</div>
  <div class="rule" style="margin:34px 0;opacity:.4"></div>
  <div class="label" style="color:{MIST}">Proof</div>
  <div style="margin-top:16px">{proof(13, WHITE)}</div>
  <div class="small" style="margin-top:12px;color:#D3DCDD">Private Dentistry Awards finalists. Say "finalist", never "award-winning".</div>
  <div class="rule" style="margin:34px 0;opacity:.4"></div>
  <div class="label" style="color:{MIST}">Area</div>
  <div class="small" style="margin-top:18px;line-height:2.1;color:#D3DCDD">Cheam Village, Sutton SM2<br>3 to 5 mile radius</div>
</div>""", 1, 'Who we are', dark=True)


def logo_page():
    misuse = [
        ('Stretched', f'<div style="transform:scaleX(1.5)">{logo("stacked", 120)}</div>'),
        ('Recoloured', logo('stacked', 170, 'ink', f'filter:invert(40%) sepia(90%) saturate(900%) hue-rotate(300deg)')),
        ('Retyped in bold', f'<div class="h" style="font-size:15px;font-weight:800;letter-spacing:.05em">Cheam Village Dental</div>'),
        ('Ink on navy', f'<div style="position:absolute;inset:0;background:{NAVY}"></div><div style="position:relative">{logo("stacked", 170)}</div>'),
    ]
    mis = ''.join(f"""<div style="width:262px;height:160px;background:{BASE};position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden">{x}
<svg class="abs" style="left:0;top:0" width="262" height="160"><line x1="16" y1="146" x2="246" y2="14" stroke="{STOP}" stroke-width="2.5"/></svg>
<div class="abs label" style="left:14px;top:12px;font-size:9px;color:{STOP};background:rgba(255,255,255,.88);padding:2px 6px">{t}</div></div>""" for t, x in misuse)
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:52px">The <b>logo</b></div>
<div class="abs body" style="left:80px;top:240px;width:540px"><p>Wide-spaced Montserrat capitals with the line-drawn tooth mark. Three lock-ups: horizontal (tooth between the words), stacked (DENTAL STUDIOS in bold) and the round badge.</p>
<p>Clear space on every side equals the height of the tooth mark. Minimum width: horizontal 240px, stacked 140px, badge 70px.</p>
<p>Ink on light grounds, white on Navy or dark photos. The tooth alone is an icon or avatar. Never redraw, retype or re-space it.</p></div>
<div class="abs" style="left:700px;top:130px;width:1140px;height:300px;background:{WHITE};border:1px solid {SILVER};display:flex;align-items:center;justify-content:center">
  <div style="padding:34px 44px;border:1.5px dashed {MIST}">{logo('horizontal', 860)}</div></div>
<div class="abs" style="left:700px;top:450px;width:370px;height:270px;background:{BASE};display:flex;align-items:center;justify-content:center">{logo('stacked', 290)}</div>
<div class="abs" style="left:1085px;top:450px;width:370px;height:270px;background:{NAVY};display:flex;align-items:center;justify-content:center">{logo('stacked', 290, 'white')}</div>
<div class="abs" style="left:1470px;top:450px;width:370px;height:270px;background:{CREAM};display:flex;align-items:center;justify-content:center;gap:50px">{logo('roundel', 170)}{logo('tooth', 70, 'navy')}</div>
<div class="abs label" style="left:700px;top:732px;font-size:9px;opacity:.6">Stacked · ink on Base</div>
<div class="abs label" style="left:1085px;top:732px;font-size:9px;opacity:.6">Stacked · white on Navy</div>
<div class="abs label" style="left:1470px;top:732px;font-size:9px;opacity:.6">Badge · tooth mark</div>
<div class="abs label" style="left:700px;top:790px;color:{STOP}">Misuse</div>
<div class="abs" style="left:700px;top:822px;display:flex;gap:24px">{mis}</div>""", 2, 'Logo')


def colour():
    sw = [
        ('Navy', NAVY, 'The practice wall. Main brand colour', WHITE, 80, 150, 430, 380),
        ('Slate', SLATE, 'Deep grounds, text on light', WHITE, 530, 150, 300, 380),
        ('Mist', MIST, 'Soft accents, rules, icons', INK, 850, 150, 300, 380),
        ('Base', BASE, 'Main light ground', INK, 1170, 150, 670, 380),
        ('Sage', SAGE, 'Calm secondary ground', WHITE, 80, 550, 300, 250),
        ('Stone', STONE, 'Secondary text, captions', WHITE, 400, 550, 300, 250),
        ('Cream', CREAM, 'Warm light ground', INK, 720, 550, 300, 250),
        ('Black', BLACK, 'Logo ink, type', WHITE, 1040, 550, 190, 250),
        ('Charcoal', CHAR, 'Body text', WHITE, 1250, 550, 190, 250),
        ('Silver', SILVER, 'House pattern', INK, 1460, 550, 190, 250),
        ('Gold', GOLD, 'Metal highlight', INK, 1670, 550, 80, 250),
        ('Pink', PINK, 'Rare highlight', WHITE, 1760, 550, 80, 250),
    ]
    cards = ''.join(f"""<div class="swatch" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;background:{c};color:{t};{'border:1px solid #E2E2E2;' if c == BASE else ''}">
<div style="font-weight:600;letter-spacing:.2em;text-transform:uppercase;font-size:{18 if w > 150 else 11}px">{n}</div><div class="label" style="font-size:{11 if w > 150 else 8}px;letter-spacing:.2em;margin-top:8px">{c}</div>{f'<div class="small" style="margin-top:6px;opacity:.85;font-size:13px">{u}</div>' if w > 150 else ''}</div>""" for n, c, u, t, x, y, w, h in sw)
    return page('', f"""{cards}
<div class="abs small" style="left:80px;top:850px;width:1760px;color:{GREY}">Light and airy: roughly 55% Base and white, 25% Navy, the rest Slate, Mist, Sage and Cream. Navy is the practice's own feature wall and carries buttons, headlines on light grounds and full-bleed sections. Gold and Pink are highlight colours from the brand sheet: use one small touch at most, never as a ground. No bright clinical blues, no gradients between brand colours. Hex values are sampled from the brand sheet PDF; the live site uses close variants (#10495D navy, #5B6B66 sage).</div>""", 3, 'Colour')


def typography():
    return page('', f"""
<div class="abs" style="left:80px;top:130px;width:1080px">
  <div class="label" style="color:{STONE}">Headline · Montserrat Light, caps, tracked +32% · key phrase in Bold</div>
  <div class="h" style="font-size:64px;margin-top:26px">Straighter teeth <b>in Cheam Village</b></div>
  <div class="small" style="margin-top:24px;width:860px;color:{GREY}">Short, calm and spaced like the logo. One phrase turns Bold, the way DENTAL STUDIOS does in the stacked lock-up. No exclamation marks.</div>
</div>
<div class="abs" style="left:80px;top:470px;width:1080px">
  <div class="label" style="color:{STONE}">Personal message · Tuesday Night · sentence case, one or two words</div>
  <div class="script" style="font-size:130px;margin-top:70px;padding-left:30px;color:{NAVY}">your Smile</div>
  <div class="small" style="margin-top:56px;width:860px;color:{GREY}">From the brand sheet's lock-ups. A human, handwritten touch beside the capitals: never a full sentence, never under 60px.</div>
</div>
<div class="abs" style="left:80px;top:860px;width:520px">
  <div class="label" style="color:{STONE}">Body · Montserrat Regular 400</div>
  <div class="body" style="margin-top:12px;color:{INK}">We take the time to listen, then plan treatment around you.</div>
</div>
<div class="abs" style="left:680px;top:860px;width:520px">
  <div class="label" style="color:{STONE}">Button · Montserrat SemiBold · caps</div>
  <div style="margin-top:14px">{btn('Book a consultation', 14, 30, 16)}</div>
</div>
<div class="abs navy" style="left:1240px;top:130px;width:600px;height:830px;padding:56px;overflow:hidden">
  {logo('tooth', 420, 'white', 'position:absolute;left:300px;top:430px;opacity:.07')}
  <div style="position:relative">
  <div class="label" style="color:{MIST}">Brand sheet fonts</div>
  <div class="small" style="margin-top:14px;color:#D3DCDD">Highlights: Montserrat<br>Titles and body: Mr Eaves XL Sans<br>Personal messages: Tuesday Night</div>
  <div class="small" style="margin-top:22px;color:#D3DCDD">Mr Eaves is an Adobe font. The website sets titles and body in Montserrat, so ads do too.</div>
  <div class="rule" style="margin:40px 0;opacity:.35"></div>
  <div class="label" style="color:{MIST}">Lock-up</div>
  <div class="label" style="margin-top:34px;font-size:14px;letter-spacing:.5em">Future-proof</div>
  <div class="script" style="font-size:96px;margin-top:40px;padding-left:20px">your Smile</div>
  <div class="script" style="font-size:84px;margin-top:90px;padding-left:20px">appointment</div>
  <div class="label" style="font-size:12px;letter-spacing:.5em;margin-top:34px;padding-left:150px">Reminder</div>
  </div>
</div>""", 4, 'Typography')


def elements():
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:40px;width:520px">The <b>village house</b></div>
<div class="abs body" style="left:80px;top:330px;width:500px">
<p>The brand sheet builds its palette, icons and pattern from one shape: a simple gabled house. It is the "village" in Cheam Village, and the signature frame for photos.</p>
<p>Use one house-framed photo per layout, with a gable roughly a quarter to a third of its width. The trio of houses and the double slash are small accents. The mosaic circle is a quiet background pattern.</p>
<p>No drop shadows, no glow, no tilted cards, no boxes round copy.</p></div>
{house('bl-12.jpg', 640, 130, 400, 520, .45, .5, .3)}
<div class="cap" style="left:640px;top:664px">House frame · gable 30% of width</div>
<div class="abs base" style="left:1080px;top:130px;width:760px;height:250px;display:flex;align-items:center;justify-content:space-around">
  {trio(260, (SILVER, SILVER, SILVER))}{trio(260, (MIST, NAVY, SLATE))}</div>
<div class="cap" style="left:1080px;top:394px">House trio · Silver, or the palette houses</div>
<div class="abs base" style="left:1080px;top:440px;width:370px;height:210px;display:flex;align-items:center;justify-content:center">{slash(110)}</div>
<div class="cap" style="left:1080px;top:664px">Double slash · Mist</div>
<div class="abs base" style="left:1470px;top:440px;width:370px;height:210px;display:flex;align-items:center;justify-content:center;gap:40px">{logo('roundel', 150)}{logo('tooth', 60)}</div>
<div class="cap" style="left:1470px;top:664px">Badge · tooth mark</div>
<div class="abs navy" style="left:640px;top:720px;width:1200px;height:240px;overflow:hidden;display:flex;align-items:center;gap:60px;padding:0 60px">
  <div style="display:flex;gap:14px;align-items:flex-end">{''.join(house_shape(w, c) for w, c in [(70, MIST), (90, WHITE), (70, SILVER)])}</div>
  <div style="width:1px;height:140px;background:{MIST};opacity:.5"></div>
  <div style="width:640px"><div class="label" style="color:{MIST}">Third-party proof</div>
  <div class="small" style="margin-top:12px;color:#D3DCDD">5.0 from 461 Google reviews (recheck before each batch). Private Dentistry Awards finalists: say "finalist", never "winner". Invisalign provider badge only in Invisalign's own artwork.</div></div>
</div>
<div class="cap" style="left:640px;top:972px">Houses on Navy · proof rules</div>
<div class="grain"></div>""", 5, 'Graphic elements')


def photography():
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:40px;width:520px">Our practice, <b>our people</b></div>
<div class="abs body" style="left:80px;top:360px;width:500px">
<p>The practice's own shoot: the navy feature wall with the round logo, slatted oak, soft plants and fresh flowers, the team in black scrubs, the iTero scanner in use, and the shopfront on Upper Mulgrave Road.</p>
<p>Name a team member only when the website confirms the name and role, and only when the face in the photo is theirs.</p></div>
{house('bl-01.jpg', 640, 130, 420, 540, .5, .5, .3)}
{frame('bl-07.jpg', 1090, 130, 360, 255, .6, .4)}
{frame('bl-09.jpg', 1480, 130, 360, 255, .5, .5)}
{frame('bl-08.jpg', 1090, 415, 360, 255, .45, .5)}
{frame('bl-13.jpg', 1480, 415, 360, 255, .5, .6)}
<div class="abs cream" style="left:640px;top:710px;width:1200px;height:250px;padding:40px 50px;display:flex;gap:60px">
  <div style="width:520px"><div class="label" style="color:{SLATE}">Look for</div><div class="small" style="margin-top:12px;color:{INK}">Natural light, navy and oak, real people mid-conversation, the scanner screen, calm waiting room details. Patients who look relaxed, not posed.</div></div>
  <div style="width:520px"><div class="label" style="color:{STOP}">Avoid</div><div class="small" style="margin-top:12px;color:{INK}">Stock models, harsh clinical white, needles and drills, gloved hands in mouths, and before-and-afters without the patient's written consent.</div></div></div>""", 6, 'Photography')


def voice():
    pairs = [('Personal', 'We take the time to listen before anything else.', 'The number one dentist in Surrey!'),
             ('Local', 'A minute from Cheam station.', 'Serving all of London.'),
             ('Clear', 'Specialist orthodontist. A plan you understand.', 'Perfect teeth, guaranteed.'),
             ('Calm', 'Nervous? Tell us, and we will go at your pace.', 'Pain-free dentistry!')]
    rows = ''.join(f"""<div style="display:flex;gap:30px;padding:22px 0;border-top:1px solid {MIST}">
<div class="h" style="width:260px;font-size:24px"><b>{t}</b></div>
<div style="width:600px"><div class="label" style="font-size:9px;color:{STONE}">We say</div><div class="body" style="margin-top:6px;color:{INK}">{y}</div></div>
<div style="width:540px;opacity:.45"><div class="label" style="font-size:9px">We don't say</div><div class="body" style="margin-top:6px;text-decoration:line-through">{n}</div></div></div>""" for t, y, n in pairs)
    return page('', f"""
<div class="abs h" style="left:80px;top:130px;font-size:52px">How <b>we sound</b></div>
<div class="abs body" style="left:80px;top:230px;width:1440px">Warm, personal and quietly expert, like a family practice that knows you by name. UK English, sentence case in body copy, no exclamation marks, no em dashes, no outcome guarantees or "pain-free" claims, no finance figures without FCA wording, and urgency only when an offer is genuinely live.</div>
<div class="abs" style="left:80px;top:380px;width:1450px">{rows}</div>
{house('bl-06.jpg', 1580, 380, 260, 470, .5, .45, .3)}""", 7, 'Tone of voice')


def applications():
    return page('base', f"""
<div class="abs h" style="left:80px;top:130px;font-size:52px;width:560px">In <b>use</b></div>
<div class="abs body" style="left:80px;top:240px;width:520px;color:{INK}"><p>Meta statics: Base or Navy grounds, one real practice photo in the house frame, the stacked logo, a spaced Montserrat headline with one Bold phrase, a short Tuesday Night line, review proof and a Navy button.</p>
<p>Stories keep logo and copy out of the top 250px and bottom 340px. Proof uses the live Google count, rechecked before each batch.</p></div>
<div class="abs" style="left:680px;top:150px">{ad_square(0.68)}</div>
<div class="abs label" style="left:680px;top:900px;font-size:10px;opacity:.6">Feed 1:1</div>
<div class="abs" style="left:1440px;top:110px">{ad_story(0.43)}</div>
<div class="abs label" style="left:1440px;top:950px;font-size:10px;opacity:.6">Story 9:16</div>""", 8, 'Applications')


def close():
    return page('navy', f"""
<div class="abs" style="left:1100px;top:250px;opacity:.12">{trio(640, (WHITE, WHITE, WHITE))}</div>
<div class="abs" style="left:160px;top:330px">{logo('stacked', 640, 'white')}</div>
<div class="abs label" style="left:170px;top:500px;font-size:16px;letter-spacing:.5em">Future-proof</div><div class="abs script" style="left:186px;top:560px;font-size:120px">your Smile</div>
<div class="abs small" style="left:166px;top:780px;opacity:.85;letter-spacing:.12em">{ADDRESS} · 020 8643 6063</div>""", dark=True)


def main():
    pages = [cover(), story(), logo_page(), colour(), typography(), elements(), photography(), voice(), applications(), close()]
    head = f'<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>Cheam Village Brand Guidelines</title><style>{CSS}</style>'
    body = f'</head><body>{"".join(pages)}</body></html>'
    (HERE / 'guideline.html').write_text(head + body)
    (HERE / 'guideline-capture.html').write_text(head + '<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>' + body)
    print('pages', len(pages))


if __name__ == '__main__':
    main()
