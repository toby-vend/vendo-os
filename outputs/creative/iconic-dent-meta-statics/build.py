"""Build Iconic Dent Meta static harness pages: one HTML page per persona per size.

Usage: ../avenue-dental-meta-statics/.venv/bin/python build.py [persona ...]
       ->  <persona>-1x1.html, <persona>-9x16.html, <persona>-landscape.html
Brand: Iconic Dent guideline (Figma dTOJRD9ZWMVeKejftw5lbq). Headlines in Mongolian Baiti (assets/fonts/monbaiti.ttf,
licensed, gitignored), body and buttons in Montserrat, handwriting in Caveat. Shapes from the site: circle photo frames
with a small solid gold disc on the rim, tall capsules, gold and black pills, gold tick circles, monogram watermark.
Layouts: data/creative-templates/vendo-dental-statics (VT codes), rebuilt in Iconic's brand; custom layouts are marked
Custom in the copy files. Photos: assets/photos/web (gitignored), real practice photos only (no CGI renders, no stock).
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent
A = ROOT / "assets"
WEB = A / "photos/web"

GOLD, LINEN, SAND, PAPER = "#BEA17A", "#E3DFD3", "#E4DCD1", "#F4F0EF"
CHAR, BLACK, WHITE, INK, GREY, STONE = "#2E2C2B", "#000000", "#FFFFFF", "#111111", "#5E5A55", "#CFC9BE"
SIZES = {"s1": (1080, 1080), "s9": (1080, 1920), "ls": (1200, 628)}
SUFFIX = {"s1": "1x1", "s9": "9x16", "ls": "1.91x1"}
DATE = "261026"
REVIEWS = "5.0 from 125 Google reviews"


def svg(name, width, extra=""):
    """Inline one of the logo SVGs at a given width (keeps the viewBox aspect)."""
    s = (A / name).read_text()
    vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', s).group(1).split()]
    h = round(width * vb[3] / vb[2], 1)
    return re.sub(r"<svg ", f'<svg width="{width}" height="{h}" style="display:block;{extra}" ', s, count=1)


def logo(w, colour="charcoal", kind="stacked", extra=""):
    return svg(f"logo-{kind}-{colour}.svg", w, extra)


def mono(w, colour="white", extra=""):
    return svg(f"logo-monogram-{colour}.svg", w, extra)


GRAIN = ("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>"
         "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.9 0'/></filter>"
         "<rect width='100%' height='100%' filter='url(%23n)'/></svg>")

CSS = f"""
@font-face {{ font-family: 'Mongolian Baiti'; src: url(assets/fonts/monbaiti.ttf); font-weight: 400; }}
@font-face {{ font-family: Montserrat; src: url(assets/fonts/Montserrat.ttf); font-weight: 100 900; }}
@font-face {{ font-family: Caveat; src: url(assets/fonts/Caveat.ttf); font-weight: 400 700; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ background: #3a3733; font-family: Montserrat, sans-serif; font-weight: 400; display: flex; gap: 80px; padding: 80px; align-items: flex-start; -webkit-font-smoothing: antialiased; }}
.ab {{ position: relative; overflow: hidden; flex: none; background: {LINEN}; color: {INK}; }}
.abs {{ position: absolute; }}
.ph {{ position: absolute; overflow: hidden; }}
.ph img {{ display: block; width: 100%; height: 100%; }}
.grain {{ position: absolute; inset: 0; background-image: url("{GRAIN}"); opacity: .09; mix-blend-mode: overlay; pointer-events: none; }}
.hl {{ font-family: 'Mongolian Baiti', serif; font-weight: 400; line-height: 1.04; color: {INK}; }}
.dk .hl {{ color: {LINEN}; }}
.hl b {{ font-weight: 400; color: {GOLD}; }}
.body {{ font-family: Montserrat, sans-serif; font-weight: 400; line-height: 1.45; color: {GREY}; }}
.dk .body {{ color: {STONE}; }}
.eyebrow {{ font-family: Montserrat, sans-serif; font-weight: 500; letter-spacing: .3em; text-transform: uppercase; color: {GOLD}; }}
.cta {{ display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; font-family: Montserrat, sans-serif; font-weight: 500; white-space: nowrap; color: {WHITE};
  background: linear-gradient(180deg, #CDB28C 0%, {GOLD} 55%, #A68A63 100%); box-shadow: inset 0 1.5px 0 rgba(255,246,230,.55), inset 0 -2px 0 rgba(90,70,40,.25), 0 10px 24px rgba(60,44,20,.22); }}
.cta.blk {{ background: linear-gradient(180deg, #2a2827, #000); box-shadow: inset 0 1.5px 0 rgba(255,255,255,.12), 0 10px 24px rgba(0,0,0,.3); }}
.rule {{ height: 1.5px; background: {GOLD}; opacity: .7; }}
"""

STAR = '<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="{c}" style="display:block"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>'
PIN = '<svg viewBox="0 0 24 24" width="{s}" height="{s}" style="display:block;flex:none"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2z" fill="currentColor"/></svg>'
TICK = ('<svg width="{s}" height="{s}" viewBox="0 0 24 24" style="display:block;flex:none"><circle cx="12" cy="12" r="12" fill="{c}"/>'
        '<path d="M7 12.4l3.2 3.1L17 8.8" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>')
CTA_CHECK = "Book your check-up"
CTA_CHECK40 = "Book your £40 check-up"


def proof(size=22, color=INK, star=GOLD, text=REVIEWS):
    stars = "".join(STAR.format(s=round(size * 1.05), c=star) for _ in range(5))
    return (f'<div style="display:flex;align-items:center;gap:{size * .55:.0f}px;color:{color};font-family:Montserrat;font-weight:500;font-size:{size}px;white-space:nowrap">'
            f'<span style="display:flex;gap:2px">{stars}</span>{text}</div>')


def cta(text, size=24, h=None, dark=False):
    h = h or round(size * 2.9)
    return f'<span class="cta{" blk" if dark else ""}" style="height:{h}px;padding:0 {round(size * 1.7)}px;font-size:{size}px">{text}</span>'


def ticks(items, size=24, gap=18, color=INK):
    return "".join(f'<div style="display:flex;align-items:center;gap:{size * .6:.0f}px;margin-top:{gap if i else 0}px">{TICK.format(s=round(size * 1.35), c=GOLD)}'
                   f'<span style="font-family:Montserrat;font-weight:500;font-size:{size}px;line-height:1.25;color:{color}">{t}</span></div>' for i, t in enumerate(items))


def address(size=18, color=GREY):
    return (f'<div style="display:flex;align-items:center;gap:{size * .5:.0f}px;font-family:Montserrat;font-weight:500;font-size:{size}px;color:{color};white-space:nowrap">'
            f'{PIN.format(s=round(size * 1.25))}2 Magdalen Street, Norwich</div>')


def crop(src, w, h, fx=.5, fy=.5, zoom=1.0):
    """Cover-crop from the real image aspect into a pre-cut file (the Figma capture ignores object-position)."""
    w, h = round(w), round(h)
    out = WEB / "crops" / f"{Path(src).stem}-{w}x{h}-{round(fx * 100)}-{round(fy * 100)}-{round(zoom * 100)}.jpg"
    if not out.exists():
        out.parent.mkdir(exist_ok=True)
        dims = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries", "stream=width,height",
                               "-of", "csv=p=0", str(WEB / src)], capture_output=True, text=True).stdout.strip()
        W, H = map(int, dims.split(","))
        if W / H > w / h:
            ch, cw = H, round(H * w / h)
        else:
            cw, ch = W, round(W * h / w)
        cw, ch = round(cw / zoom), round(ch / zoom)
        x = min(max(round(fx * W - cw / 2), 0), W - cw)
        y = min(max(round(fy * H - ch / 2), 0), H - ch)
        ow = min(cw, 2 * w) // 2 * 2
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(WEB / src), "-vf",
                        f"crop={cw}:{ch}:{x}:{y},scale={ow}:-2", "-q:v", "3", str(out)], check=True)
    return f"assets/photos/web/crops/{out.name}"


def photo(src, x, y, w, h, fx=.5, fy=.5, zoom=1.0, radius=0, extra=""):
    rad = f"border-radius:{radius}px;" if radius else ""
    return (f'<div class="ph" data-name="Photo" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;{rad}{extra}">'
            f'<img src="{crop(src, w, h, fx, fy, zoom)}"></div>')


def circle(src, x, y, d, fx=.5, fy=.5, zoom=1.0, disc=None):
    """The site's circle photo frame; disc = (dx, dy, diameter) adds the solid gold disc on the rim."""
    dot = ""
    if disc:
        dx, dy, dd = disc
        dot = (f'<div class="abs" style="left:{x + dx}px;top:{y + dy}px;width:{dd}px;height:{dd}px;border-radius:50%;'
               f'background:radial-gradient(circle at 35% 30%, #D2BB98, {GOLD} 55%, #A88B62);box-shadow:0 10px 24px rgba(60,44,20,.25)"></div>')
    return photo(src, x, y, d, d, fx, fy, zoom, radius=d / 2, extra="box-shadow:0 24px 60px rgba(46,44,43,.22);") + dot


def capsule(src, x, y, w, h, fx=.5, fy=.5, zoom=1.0):
    return photo(src, x, y, w, h, fx, fy, zoom, radius=w / 2, extra="box-shadow:0 24px 60px rgba(46,44,43,.22);")


def lit(size, dark=False):
    """Board background: Linen (or Charcoal) lit like the practice, from depth.panel."""
    import depth
    w, h = SIZES[size]
    m = max(w, h)
    glows = [(w * .25, h * .2, m * .32, .5), (w * .75, h * .8, m * .38, .25)]
    if dark:
        return f"{CHAR} url({depth.panel(w, h, [(w * .3, h * .22, m * .3, .14), (w * .7, h * .75, m * .36, .07)], key='bg-char', ink=CHAR, tone='#5A4A35', light='#BEA17A', vignette=.5)}) center/cover"
    return f"{LINEN} url({depth.panel(w, h, glows, key='bg-linen', ink=LINEN, tone='#7A6447', light='#FBF8F2', vignette=.12)}) center/cover"


def board(size, name, inner, bg="linen"):
    w, h = SIZES[size]
    cls = "ab dk" if bg == "char" else "ab"
    if bg in ("linen", "char"):
        bg = lit(size, bg == "char")
    return (f'<div class="{cls}" data-name="{name} | {SUFFIX[size]} | {DATE}" style="width:{w}px;height:{h}px;background:{bg}">'
            f'{inner}<div class="grain"></div></div>')


def page(title, boards):
    return (f"<!doctype html><html lang='en-GB'><head><meta charset='utf-8'><title>{title}</title>"
            f"<style>{CSS}</style><script src='https://mcp.figma.com/mcp/html-to-design/capture.js' async></script>"
            f"</head><body>{''.join(boards)}</body></html>")


def note(w, fs, lines, sign="Iconic Dent", rot=-2.5):
    """A handwritten card propped up (VT-31): Caveat on warm paper with tape and a soft cast shadow."""
    tape = (f'<div style="position:absolute;left:50%;top:{-fs * .42:.0f}px;width:{fs * 3:.0f}px;height:{fs * .85:.0f}px;'
            f'transform:translateX(-50%) rotate(3deg);background:rgba(228,220,209,.85);box-shadow:0 1px 2px rgba(0,0,0,.12)"></div>')
    body = "".join(f'<div style="font-family:Caveat;font-weight:600;font-size:{fs}px;line-height:1.1;color:#24211e;margin-top:{fs * .12 if i else 0:.0f}px">{t}</div>'
                   for i, t in enumerate(lines))
    return (f'<div style="position:relative;width:{w}px;padding:{fs * 1.0:.0f}px {fs * .95:.0f}px {fs * 1.0:.0f}px;background:#FBF8F1;transform:rotate({rot}deg);'
            f'box-shadow:0 {fs * .45:.0f}px {fs * 1.1:.0f}px rgba(46,36,24,.35),0 2px 4px rgba(46,36,24,.2)">{tape}{body}'
            f'<div style="font-family:Caveat;font-weight:500;font-size:{fs * .6:.0f}px;color:#7a7066;margin-top:{fs * .4:.0f}px;text-align:right">{sign}</div></div>')


def review_bar(w, size=20, text=CTA_CHECK40):
    return (f'<div style="width:{w}px;display:flex;align-items:center;justify-content:space-between;padding:{size * .55:.0f}px {size * .55:.0f}px {size * .55:.0f}px {size * 1.2:.0f}px;'
            f'border-radius:999px;background:{CHAR};box-shadow:0 14px 34px rgba(46,44,43,.25)">{proof(size, LINEN)}{cta(text, size, h=round(size * 2.6))}</div>')


# ---------------------------------------------------------------- MARK (back after years away)
GEN = "General Patient"


def m1(size):
    """VT-31 Handwritten sign: a card propped at the real reception."""
    name = f"{GEN} | Static | Practice photo | No lecture"
    lines = ["It's been a while?", "No lecture.", "No pressure.", "Just a plan."]
    if size == "ls":
        inner = f"""{photo('reception-front.jpg', 0, 0, 1200, 628, .55, .5)}
<div class="abs" data-name="Overlay" style="inset:0;background:linear-gradient(90deg,rgba(46,44,43,.92) 0%,rgba(46,44,43,.7) 42%,rgba(46,44,43,.05) 75%)"></div>
<div class="abs" style="left:60px;top:50px">{logo(96, 'cream')}</div>
<div class="abs hl" style="left:60px;top:200px;width:470px;font-size:50px;color:{LINEN}">Back After Years? <b>No Lecture.</b></div>
<div class="abs eyebrow" style="left:60px;top:345px;font-size:14px">Check-ups £40 · Norwich</div>
<div class="abs" style="left:60px;top:400px">{cta(CTA_CHECK, 19)}</div>
<div class="abs" style="left:60px;top:500px">{proof(15, LINEN)}</div>
<div class="abs" style="left:730px;top:110px">{note(400, 50, lines)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    H = 1920 if s9 else 1080
    inner = f"""{photo('reception-front.jpg', 0, 0, 1080, H, .5, .5)}
<div class="abs" data-name="Overlay" style="inset:0;background:linear-gradient(180deg,rgba(46,44,43,.35) 0%,rgba(46,44,43,.15) 40%,rgba(46,44,43,.93) {74 if s9 else 70}%)"></div>
<div class="abs" style="left:0;right:0;top:{270 if s9 else 56}px;display:flex;justify-content:center">{logo(110 if s9 else 92, 'cream')}</div>
<div class="abs" style="left:{200 if s9 else 250}px;top:{560 if s9 else 230}px">{note(680 if s9 else 580, 86 if s9 else 70, lines)}</div>
<div class="abs eyebrow" style="left:80px;top:{1360 if s9 else 815}px;font-size:{19 if s9 else 16}px">New patient check-ups £40 · Magdalen Street, Norwich</div>
<div class="abs" style="left:80px;top:{1420 if s9 else 870}px;display:flex;align-items:center;gap:34px">{cta(CTA_CHECK, 26 if s9 else 22)}{proof(20 if s9 else 18, LINEN)}</div>"""
    return board(size, name, inner)


def m2(size):
    """Custom: circle frame of the real surgery bleeding off the right, gold disc, headline on Linen."""
    name = f"{GEN} | Static | Practice photo | See what we see"
    if size == "ls":
        inner = f"""{mono(480, 'white', 'position:absolute;left:-300px;top:260px;opacity:.35')}
{circle('surgery.jpg', 690, -60, 640, .42, .5, disc=(20, 440, 120))}
<div class="abs" style="left:60px;top:46px">{logo(90)}</div>
<div class="abs hl" style="left:60px;top:170px;width:560px;font-size:56px">You'll See <b>What We See.</b></div>
<div class="abs body" style="left:60px;top:300px;width:520px;font-size:19px;color:{INK}">Your teeth on screen, talked through in plain English.</div>
<div class="abs" style="left:60px;top:400px;display:flex;align-items:baseline;gap:12px"><span class="body" style="font-size:17px">New patient check-up</span><span class="hl" style="font-size:44px;color:{GOLD}">£40</span></div>
<div class="abs" style="left:60px;top:480px;display:flex;align-items:center;gap:24px">{cta(CTA_CHECK, 18)}{proof(14)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    if s9:
        inner = f"""{mono(900, 'white', 'position:absolute;left:-420px;top:1180px;opacity:.35')}
{circle('surgery.jpg', 230, 300, 920, .42, .5, disc=(30, 640, 160))}
<div class="abs" style="left:80px;top:270px">{logo(120)}</div>
<div class="abs hl" style="left:80px;top:1250px;width:920px;font-size:96px">You'll See <b>What We See.</b></div>
<div class="abs body" style="left:80px;top:1460px;width:820px;font-size:30px;color:{INK}">Your teeth on screen, talked through in plain English. Check-up <b style="color:{GOLD};font-weight:600">£40</b>.</div>
<div class="abs" style="left:80px;top:1560px;display:flex;align-items:center;gap:30px">{cta(CTA_CHECK, 26)}{proof(19)}</div>"""
        return board(size, name, inner)
    inner = f"""{mono(700, 'white', 'position:absolute;left:-380px;top:560px;opacity:.35')}
{circle('surgery.jpg', 560, 60, 820, .42, .5, disc=(10, 590, 140))}
<div class="abs" style="left:70px;top:70px">{logo(110)}</div>
<div class="abs hl" style="left:70px;top:300px;width:520px;font-size:86px">You'll See <b>What We See.</b></div>
<div class="abs body" style="left:70px;top:520px;width:430px;font-size:25px;color:{INK}">Your teeth on screen, talked through in plain English.</div>
<div class="abs" style="left:70px;top:680px;display:flex;align-items:baseline;gap:14px"><span class="body" style="font-size:22px">New patient check-up</span><span class="hl" style="font-size:72px;color:{GOLD}">£40</span></div>
<div class="abs" style="left:70px;top:820px">{cta(CTA_CHECK, 23)}</div>
<div class="abs" style="left:70px;top:945px">{proof(18)}</div>"""
    return board(size, name, inner)


M3_TICKS = ["Nobody asks why you left it", "A written plan with costs first", "Nothing booked until you agree"]


def m3(size):
    """VT-07 Three reasons: capsule photo of the reception sign, three gold ticks, review bar."""
    name = f"{GEN} | Static | Practice photo | Three things to know"
    if size == "ls":
        inner = f"""{capsule('sign-wall-tall.jpg', 900, 40, 250, 548, .5, .32)}
<div class="abs hl" style="left:56px;top:44px;width:800px;font-size:46px">If It's Been Years, <b>Three Things To Know.</b></div>
<div class="abs" style="left:56px;top:190px">{ticks(M3_TICKS, 22, 22)}</div>
<div class="abs" style="left:56px;top:415px">{review_bar(790, 17)}</div>
<div class="abs" style="left:56px;top:520px">{logo(170, 'charcoal', 'horizontal')}</div>"""
        return board(size, name, inner, bg=PAPER)
    s9 = size == "s9"
    if s9:
        inner = f"""<div class="abs" style="left:80px;top:270px">{logo(110)}</div>
<div class="abs hl" style="left:80px;top:470px;width:920px;font-size:90px">If It's Been Years, <b>Three Things To Know.</b></div>
<div class="abs" style="left:610px;top:720px;width:470px;height:680px;background:{LINEN};border-radius:340px 0 0 340px"></div>
{capsule('sign-wall-tall.jpg', 650, 760, 360, 620, .5, .3)}
<div class="abs" style="left:80px;top:830px;width:560px">{ticks(M3_TICKS, 31, 66)}</div>
<div class="abs" style="left:80px;top:1440px">{review_bar(920, 22)}</div>"""
        return board(size, name, inner, bg=PAPER)
    inner = f"""<div class="abs hl" style="left:70px;top:80px;width:940px;font-size:76px">If It's Been Years, <b>Three Things To Know.</b></div>
<div class="abs" style="left:640px;top:250px;width:440px;height:600px;background:{LINEN};border-radius:300px 0 0 300px"></div>
{capsule('sign-wall-tall.jpg', 690, 280, 340, 570, .5, .3)}
<div class="abs" style="left:70px;top:350px;width:600px">{ticks(M3_TICKS, 28, 58)}</div>
<div class="abs" style="left:70px;top:880px">{review_bar(940, 20)}</div>
<div class="abs" style="left:70px;top:985px">{logo(190, 'charcoal', 'horizontal')}</div>"""
    return board(size, name, inner, bg=PAPER)


def m4(size):
    """VT-18 Native practice photo: the real Iconic coffee cup, logo bug and one caption line."""
    name = f"{GEN} | Static | Practice photo | Not the dentist you remember"
    w, h = SIZES[size]
    if size == "ls":
        inner = f"""{photo('coffee-cup.jpg', 520, 0, 680, 628, .45, .66)}
<div class="abs" data-name="Overlay" style="left:520px;top:0;width:160px;height:628px;background:linear-gradient(90deg,{CHAR},rgba(46,44,43,0))"></div>
<div class="abs" style="left:56px;top:56px">{logo(150, 'cream', 'horizontal')}</div>
<div class="abs" style="left:56px;top:230px;width:420px;font-family:Montserrat;font-weight:500;font-size:30px;line-height:1.35;color:{WHITE}">The dentist you remember didn't start with a coffee.</div>"""
        return board(size, name, inner, bg=CHAR)
    fy = {"s1": .62, "s9": .55}[size]
    fx = {"s1": .45, "s9": .45, "ls": .45}[size]
    cap_size = {"s1": 30, "s9": 38, "ls": 26}[size]
    cap_top = {"s1": 930, "s9": 1500, "ls": 540}[size]
    bug_top = 250 if size == "s9" else 40
    inner = f"""{photo('coffee-cup.jpg', 0, 0, w, h, fx, fy)}
<div class="abs" data-name="Overlay" style="left:0;right:0;bottom:0;height:{h * .38:.0f}px;background:linear-gradient(180deg,rgba(46,44,43,0),rgba(46,44,43,.78))"></div>
<div class="abs" style="left:40px;top:{bug_top}px;padding:14px 18px;border-radius:16px;background:rgba(46,44,43,.6)">{logo(120 if size == 'ls' else 150, 'cream', 'horizontal')}</div>
<div class="abs" style="left:{50 if size == 'ls' else 70}px;right:{50 if size == 'ls' else 70}px;top:{cap_top}px;font-family:Montserrat;font-weight:500;font-size:{cap_size}px;line-height:1.3;color:{WHITE};text-shadow:0 2px 10px rgba(0,0,0,.45)">The dentist you remember didn't start with a coffee.</div>"""
    return board(size, name, inner, bg=CHAR)


def m5(size):
    """Custom: oversized 5. 10. 20. on Charcoal with a circle of the gold sign and the disc."""
    name = f"{GEN} | Static | Typographic | Five, ten, twenty years"
    big = lambda fs: (f'<div class="hl" style="font-size:{fs}px;line-height:.9;color:{LINEN};white-space:nowrap">5<b>.</b> 10<b>.</b> 20<b>.</b></div>')
    if size == "ls":
        inner = f"""{mono(560, 'cream', 'position:absolute;left:760px;top:-60px;opacity:.06')}
{circle('sign-wall-chair.jpg', 860, 200, 300, .5, .3, disc=(0, 210, 70))}
<div class="abs" style="left:56px;top:46px">{logo(84, 'cream')}</div>
<div class="abs" style="left:56px;top:190px">{big(120)}</div>
<div class="abs body" style="left:60px;top:325px;width:700px;font-size:22px">Years away from the dentist. Our reviews are full of them.</div>
<div class="abs" style="left:60px;top:400px">{proof(16, LINEN)}</div>
<div class="abs" style="left:60px;top:460px">{cta(CTA_CHECK40, 18)}</div>"""
        return board(size, name, inner, bg="char")
    s9 = size == "s9"
    if s9:
        inner = f"""{mono(1100, 'cream', 'position:absolute;left:200px;top:300px;opacity:.06')}
<div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(120, 'cream')}</div>
<div class="abs" style="left:0;right:0;top:620px;display:flex;justify-content:center">{big(230)}</div>
<div class="abs body" style="left:110px;right:110px;top:880px;text-align:center;font-size:36px">Years away from the dentist. Our reviews are full of them.</div>
{circle('sign-wall-chair.jpg', 330, 1040, 420, .5, .3, disc=(320, 300, 100))}
<div class="abs" style="left:0;right:0;top:1500px;display:flex;justify-content:center">{proof(21, LINEN)}</div>
<div class="abs" style="left:0;right:0;top:1550px;display:flex;justify-content:center">{cta(CTA_CHECK40, 26)}</div>"""
        return board(size, name, inner, bg="char")
    inner = f"""{mono(820, 'cream', 'position:absolute;left:420px;top:240px;opacity:.06')}
<div class="abs" style="left:70px;top:70px">{logo(100, 'cream')}</div>
<div class="abs" style="left:70px;top:290px">{big(200)}</div>
<div class="abs body" style="left:74px;top:500px;width:560px;font-size:30px">Years away from the dentist. Our reviews are full of them.</div>
{circle('sign-wall-chair.jpg', 690, 540, 330, .5, .3, disc=(0, 240, 80))}
<div class="abs" style="left:74px;top:720px">{proof(19, LINEN)}</div>
<div class="abs" style="left:74px;top:800px">{cta(CTA_CHECK40, 23)}</div>"""
    return board(size, name, inner, bg="char")


# ---------------------------------------------------------------- DENISE (can't find an NHS place)
SEARCH = '<svg viewBox="0 0 24 24" width="{s}" height="{s}" style="display:block;flex:none"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="{c}" stroke-width="2.2"/><path d="M15.5 15.5L21 21" stroke="{c}" stroke-width="2.2" stroke-linecap="round"/></svg>'
MIC = '<svg viewBox="0 0 24 24" width="{s}" height="{s}" style="display:block;flex:none"><rect x="9" y="3" width="6" height="11" rx="3" fill="{c}"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4" fill="none" stroke="{c}" stroke-width="2" stroke-linecap="round"/></svg>'


def search_bar(w, fs, query):
    return (f'<div style="width:{w}px;height:{fs * 2.9:.0f}px;display:flex;align-items:center;gap:{fs * .7:.0f}px;padding:0 {fs * 1.1:.0f}px;border-radius:999px;background:{WHITE};'
            f'box-shadow:0 {fs * .5:.0f}px {fs * 1.4:.0f}px rgba(0,0,0,.28)">{SEARCH.format(s=round(fs * 1.15), c=GREY)}'
            f'<span style="flex:1;font-family:Montserrat;font-weight:400;font-size:{fs}px;color:{INK};white-space:nowrap">{query}<span style="display:inline-block;width:2px;height:{fs * 1.1:.0f}px;background:{GOLD};vertical-align:middle;margin-left:3px"></span></span>{MIC.format(s=round(fs * 1.1), c=GOLD)}</div>')


def result_card(w, fs, note="New patients welcome. No waiting list."):
    stars = "".join(STAR.format(s=round(fs * .95), c="#E7A33A") for _ in range(5))
    return (f'<div style="width:{w}px;padding:{fs * 1.1:.0f}px {fs * 1.2:.0f}px;border-radius:{fs:.0f}px;background:{WHITE};box-shadow:0 {fs * .6:.0f}px {fs * 1.6:.0f}px rgba(0,0,0,.3)">'
            f'<div style="display:flex;align-items:center;gap:{fs * .7:.0f}px"><div style="width:{fs * 2.4:.0f}px;height:{fs * 2.4:.0f}px;border-radius:50%;background:{CHAR};display:flex;align-items:center;justify-content:center">{mono(round(fs * 1.5), "gold")}</div>'
            f'<div><div style="font-family:Montserrat;font-weight:600;font-size:{fs * 1.15:.0f}px;color:#1a0dab">Iconic Dent</div><div style="font-family:Montserrat;font-size:{fs * .8:.0f}px;color:{GREY}">Dentist · Norwich</div></div></div>'
            f'<div style="display:flex;align-items:center;gap:{fs * .4:.0f}px;margin-top:{fs * .8:.0f}px;font-family:Montserrat;font-weight:500;font-size:{fs * .9:.0f}px;color:{INK}">5.0<span style="display:flex;gap:1px">{stars}</span><span style="color:{GREY};font-weight:400">(125 Google reviews)</span></div>'
            f'<div style="margin-top:{fs * .4:.0f}px;font-family:Montserrat;font-size:{fs * .85:.0f}px;color:{GREY}">2 Magdalen Street, Norwich</div>'
            f'<div style="margin-top:{fs * .8:.0f}px;padding-top:{fs * .7:.0f}px;border-top:1px solid #E6E1D8;display:flex;align-items:center;gap:{fs * .5:.0f}px;font-family:Montserrat;font-weight:600;font-size:{fs * .9:.0f}px;color:#1E7A46">'
            f'<span style="width:{fs * .55:.0f}px;height:{fs * .55:.0f}px;border-radius:50%;background:#1E9A55;flex:none"></span>{note}</div></div>')


def d1(size):
    """VT-29 Search bar over the real reception, Iconic result card underneath."""
    name = f"{GEN} | Static | Practice photo | Search bar"
    q = "dentist Norwich taking new patients"
    if size == "ls":
        inner = f"""{photo('reception-front.jpg', 0, 0, 1200, 628, .55, .5)}
<div class="abs" data-name="Overlay" style="inset:0;background:linear-gradient(90deg,rgba(46,44,43,.15) 0%,rgba(46,44,43,.55) 45%,rgba(46,44,43,.88) 100%)"></div>
<div class="abs" style="left:620px;top:60px">{search_bar(530, 19, q)}</div>
<div class="abs" style="left:620px;top:150px">{result_card(530, 19)}</div>
<div class="abs" style="left:620px;top:470px">{cta(CTA_CHECK40, 19)}</div>
<div class="abs" style="left:48px;top:40px;padding:12px 14px;border-radius:14px;background:rgba(46,44,43,.5)">{logo(120, 'cream')}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    if s9:
        inner = f"""{photo('DJI_20260322152923_0097_D-scaled.jpg', 0, 0, 1080, 1920, .5, .45)}
<div class="abs" data-name="Overlay" style="inset:0;background:linear-gradient(180deg,rgba(46,44,43,.35) 0%,rgba(46,44,43,.1) 30%,rgba(46,44,43,.6) 55%,rgba(46,44,43,.92) 80%)"></div>
<div class="abs" style="left:80px;top:270px">{logo(190, 'cream')}</div>
<div class="abs" style="left:80px;top:960px">{search_bar(920, 30, q)}</div>
<div class="abs" style="left:80px;top:1100px">{result_card(920, 30)}</div>
<div class="abs" style="left:80px;top:1480px">{cta(CTA_CHECK40, 27)}</div>"""
        return board(size, name, inner)
    inner = f"""{photo('reception-front.jpg', 0, 0, 1080, 1080, .5, .5)}
<div class="abs" data-name="Overlay" style="inset:0;background:linear-gradient(180deg,rgba(46,44,43,.25) 0%,rgba(46,44,43,.15) 25%,rgba(46,44,43,.75) 50%,rgba(46,44,43,.92) 100%)"></div>
<div class="abs" style="left:70px;top:60px">{logo(160, 'cream')}</div>
<div class="abs" style="left:70px;top:420px">{search_bar(940, 26, q)}</div>
<div class="abs" style="left:70px;top:540px">{result_card(940, 26)}</div>
<div class="abs" style="left:70px;top:935px">{cta(CTA_CHECK40, 23)}</div>"""
    return board(size, name, inner)


def offer_panel(fs, w, dark=True):
    col = LINEN if dark else INK
    return (f'<div style="width:{w}px"><div class="eyebrow" style="font-size:{fs * .28:.0f}px">New patient offer</div>'
            f'<div class="hl" style="font-size:{fs:.0f}px;color:{col};margin-top:{fs * .3:.0f}px;white-space:nowrap">Check-ups from</div><div class="hl" style="font-size:{fs * 2:.0f}px;line-height:1;color:{GOLD}">£40</div>'
            f'<div class="body" style="margin-top:{fs * .3:.0f}px;font-size:{fs * .45:.0f}px">Full exam, x-rays only if needed, and a written plan with costs.</div></div>')


def d2(size):
    """VT-06 Offer footer: photo, Charcoal offer panel, address footer."""
    name = f"{GEN} | Static | Practice photo | New patient offer"
    if size == "ls":
        inner = f"""{photo('reception-side.jpg', 0, 0, 560, 628, .5, .5)}
<div class="abs" style="left:620px;top:50px">{logo(160, 'cream', 'horizontal')}</div>
<div class="abs" style="left:620px;top:120px">{offer_panel(44, 540)}</div>
<div class="abs" style="left:620px;top:440px;display:flex;align-items:center;gap:22px">{cta(CTA_CHECK, 18)}{proof(14, LINEN)}</div>
<div class="abs rule" style="left:620px;top:525px;width:520px;opacity:.35"></div>
<div class="abs" style="left:620px;top:550px">{address(16, STONE)}</div>"""
        return board(size, name, inner, bg="char")
    s9 = size == "s9"
    ph = 880 if s9 else 470
    top = ph + (70 if s9 else 50)
    fs = 84 if s9 else 58
    inner = f"""{photo('reception-side.jpg', 0, 0, 1080, ph, .5, .5)}
<div class="abs" style="left:{80 if s9 else 70}px;top:{270 if s9 else 50}px;padding:16px 20px;border-radius:16px;background:rgba(46,44,43,.55)">{logo(170, 'cream', 'horizontal')}</div>
<div class="abs" style="left:{80 if s9 else 70}px;top:{top}px">{offer_panel(fs, 560 if not s9 else 600)}</div>
<div class="abs" style="left:{700 if s9 else 700}px;top:{top + (60 if s9 else 40)}px;display:flex;flex-direction:column;align-items:flex-start;gap:{26 if s9 else 22}px">{logo(150 if s9 else 120, 'cream')}{cta(CTA_CHECK, 22 if s9 else 19)}{proof(15 if s9 else 13, LINEN)}</div>
<div class="abs rule" style="left:{80 if s9 else 70}px;right:{80 if s9 else 70}px;top:{1500 if s9 else 975}px;opacity:.35"></div>
<div class="abs" style="left:0;right:0;top:{1528 if s9 else 1000}px;display:flex;justify-content:center">{address(22 if s9 else 19, STONE)}</div>"""
    return board(size, name, inner, bg="char")


D3_ITEMS = ["2 check-ups a year", "2 hygiene appointments", "2 x-rays", "5% off general dentistry"]


def d3(size):
    """VT-10 Membership: price a month, four ticks, lounge photo in a quarter-round corner."""
    name = f"{GEN} | Static | Practice photo | Membership"
    price = lambda fs: (f'<div class="body" style="font-size:{fs * .32:.0f}px;color:{STONE}">from just</div>'
                        f'<div style="display:flex;align-items:baseline;gap:{fs * .15:.0f}px"><span class="hl" style="font-size:{fs:.0f}px;line-height:1;color:{GOLD}">£14.90</span>'
                        f'<span class="hl" style="font-size:{fs * .38:.0f}px;color:{LINEN}">a month</span></div>')
    badge = lambda d: (f'<div style="width:{d}px;height:{d}px;border-radius:50%;background:radial-gradient(circle at 35% 30%, #D2BB98, {GOLD} 55%, #A88B62);display:flex;align-items:center;justify-content:center;text-align:center;'
                       f'font-family:Montserrat;font-weight:600;font-size:{d * .14:.0f}px;line-height:1.15;color:{WHITE};box-shadow:0 10px 24px rgba(0,0,0,.3)">No waiting<br>list</div>')
    if size == "ls":
        inner = f"""{photo('IMG_7396.jpg', 820, 0, 380, 628, .5, .55, radius=0, extra='border-radius:190px 0 0 0;')}
<div class="abs" style="left:56px;top:44px">{logo(150, 'cream', 'horizontal')}</div>
<div class="abs hl" style="left:56px;top:120px;font-size:44px">Join Our Dental <b>Membership</b></div>
<div class="abs" style="left:56px;top:190px">{price(96)}</div>
<div class="abs" style="left:56px;top:345px;display:grid;grid-template-columns:330px 330px;row-gap:16px">{''.join(ticks([t], 18, 0, LINEN) for t in D3_ITEMS)}</div>
<div class="abs" style="left:56px;top:470px;display:flex;align-items:center;gap:24px">{cta(CTA_CHECK, 18)}{proof(14, LINEN)}</div>
<div class="abs" style="left:700px;top:430px">{badge(130)}</div>"""
        return board(size, name, inner, bg="char")
    s9 = size == "s9"
    if s9:
        inner = f"""{photo('IMG_7396.jpg', 520, 1080, 560, 840, .5, .5, extra='border-radius:280px 0 0 0;')}
<div class="abs" style="left:80px;top:270px">{logo(120, 'cream')}</div>
<div class="abs" style="left:820px;top:280px">{badge(180)}</div>
<div class="abs hl" style="left:80px;top:500px;width:900px;font-size:92px">Join Our Dental <b>Membership</b></div>
<div class="abs" style="left:80px;top:720px">{price(170)}</div>
<div class="abs" style="left:80px;top:1010px;width:460px">{ticks(D3_ITEMS, 28, 36, LINEN)}</div>
<div class="abs" style="left:80px;top:1400px">{cta(CTA_CHECK, 25)}</div>
<div class="abs" style="left:80px;top:1520px">{proof(18, LINEN)}</div>"""
        return board(size, name, inner, bg="char")
    inner = f"""{photo('IMG_7396.jpg', 640, 560, 440, 520, .5, .5, extra='border-radius:220px 0 0 0;')}
<div class="abs" style="left:70px;top:60px">{logo(150, 'cream', 'horizontal')}</div>
<div class="abs" style="left:880px;top:40px">{badge(150)}</div>
<div class="abs hl" style="left:70px;top:170px;width:780px;font-size:72px">Join Our Dental <b>Membership</b></div>
<div class="abs" style="left:70px;top:340px">{price(140)}</div>
<div class="abs" style="left:70px;top:600px;width:540px">{ticks(D3_ITEMS, 25, 28, LINEN)}</div>
<div class="abs" style="left:70px;top:880px">{cta(CTA_CHECK, 22)}</div>
<div class="abs" style="left:70px;top:1000px">{proof(17, LINEN)}</div>"""
    return board(size, name, inner, bg="char")


D4_ROWS = [("New patient check-up", "£40"), ("X-rays, only if needed", "£15 each"), ("Hygiene appointment", "£65"), ("Anything else", "In writing first")]


def price_card(w, fs, rot=-1.5):
    rows = "".join(f'<div style="display:flex;justify-content:space-between;align-items:baseline;gap:{fs}px;padding:{fs * .75:.0f}px 0;border-bottom:1.5px solid rgba(190,161,122,.45)">'
                   f'<span style="font-family:Montserrat;font-weight:500;font-size:{fs:.0f}px;color:{INK}">{a}</span>'
                   f'<span class="hl" style="font-size:{fs * (1.15 if "£" in b else .95):.0f}px;color:{GOLD if "£" in b else INK};white-space:nowrap">{b}</span></div>' for a, b in D4_ROWS)
    return (f'<div style="width:{w}px;padding:{fs * 1.6:.0f}px {fs * 1.5:.0f}px {fs * 1.2:.0f}px;background:#FCFAF6;transform:rotate({rot}deg);'
            f'box-shadow:0 {fs * .9:.0f}px {fs * 2.4:.0f}px rgba(46,36,24,.28),0 2px 4px rgba(46,36,24,.15)">'
            f'<div style="display:flex;justify-content:space-between;align-items:center">{logo(round(fs * 9), "charcoal", "horizontal")}'
            f'<span class="eyebrow" style="font-size:{fs * .6:.0f}px">Your first visit</span></div>'
            f'<div style="margin-top:{fs * .6:.0f}px">{rows}</div>'
            f'<div style="margin-top:{fs * .9:.0f}px;font-family:Montserrat;font-size:{fs * .7:.0f}px;color:{GREY}">Nothing beyond the check-up is booked until you agree your plan.</div></div>')


def d4(size):
    """Custom: a printed price card on Linen with cast shadow, circle of the consult room and gold disc."""
    name = f"{GEN} | Static | Typographic | Price before the chair"
    if size == "ls":
        inner = f"""{circle('consult-room.jpg', 1010, -70, 260, .45, .5, disc=(10, 180, 50))}
<div class="abs hl" style="left:56px;top:60px;width:470px;font-size:52px">Know The Price <b>Before You Sit Down.</b></div>
<div class="abs" style="left:56px;top:330px">{cta(CTA_CHECK40, 19)}</div>
<div class="abs" style="left:56px;top:430px">{proof(15)}</div>
<div class="abs" style="left:56px;top:520px">{logo(170, 'charcoal', 'horizontal')}</div>
<div class="abs" style="left:575px;top:70px">{price_card(540, 18, -1.5)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    if s9:
        inner = f"""{circle('consult-room.jpg', 740, 200, 300, .45, .5, disc=(0, 210, 60))}
<div class="abs" style="left:80px;top:270px">{logo(120)}</div>
<div class="abs hl" style="left:80px;top:560px;width:900px;font-size:94px">Know The Price <b>Before You Sit Down.</b></div>
<div class="abs" style="left:90px;top:830px">{price_card(900, 30, -1.5)}</div>
<div class="abs" style="left:80px;top:1500px;display:flex;align-items:center;gap:30px">{cta(CTA_CHECK40, 25)}{proof(18)}</div>"""
        return board(size, name, inner)
    inner = f"""{circle('consult-room.jpg', 790, -90, 380, .45, .5, disc=(20, 270, 70))}
<div class="abs hl" style="left:70px;top:70px;width:700px;font-size:74px">Know The Price <b>Before You Sit Down.</b></div>
<div class="abs" style="left:80px;top:300px">{price_card(920, 25, -1.2)}</div>
<div class="abs" style="left:70px;top:925px;display:flex;align-items:center;gap:30px">{cta(CTA_CHECK40, 22)}{proof(17)}</div>"""
    return board(size, name, inner)


def usp_pill(t, fs):
    return (f'<span style="display:inline-flex;align-items:center;gap:{fs * .5:.0f}px;padding:{fs * .45:.0f}px {fs * .9:.0f}px;border:1.5px solid {GOLD};border-radius:999px;'
            f'font-family:Montserrat;font-weight:500;font-size:{fs:.0f}px;color:{LINEN};white-space:nowrap">{TICK.format(s=round(fs * 1.1), c=GOLD)}{t}</span>')


def brand_card(w, fs):
    pills = "".join(usp_pill(t, fs * .5) for t in ["No waiting list", "Written plan with costs"])
    return (f'<div style="position:relative;width:{w}px;padding:{fs * .8:.0f}px {fs * .8:.0f}px {fs * .75:.0f}px;border-radius:{fs * .5:.0f}px;background:rgba(46,44,43,.94);box-shadow:0 {fs * .4:.0f}px {fs:.0f}px rgba(0,0,0,.35)">'
            f'<div style="position:absolute;left:0;top:-{fs * 1.05:.0f}px;padding:{fs * .3:.0f}px {fs * .5:.0f}px;border-radius:{fs * .35:.0f}px {fs * .35:.0f}px 0 0;background:rgba(46,44,43,.94)">{logo(round(fs * 3.6), "cream", "horizontal")}</div>'
            f'<div class="hl" style="font-size:{fs:.0f}px;color:{LINEN}">Your New Dentist In <b>Norwich.</b></div>'
            f'<div style="display:flex;align-items:baseline;gap:{fs * .2:.0f}px;margin-top:{fs * .3:.0f}px"><span class="body" style="font-size:{fs * .38:.0f}px;color:{STONE}">Check-ups</span><span class="hl" style="font-size:{fs * .75:.0f}px;color:{GOLD}">£40</span></div>'
            f'<div style="display:flex;gap:{fs * .25:.0f}px;margin-top:{fs * .35:.0f}px;flex-wrap:wrap">{pills}</div>'
            f'<div style="display:flex;align-items:center;gap:{fs * .5:.0f}px;margin-top:{fs * .6:.0f}px">{cta(CTA_CHECK, round(fs * .34))}{proof(round(fs * .24), LINEN)}</div></div>')


def d5(size):
    """VT-03 Brand card over the reception logo wall."""
    name = f"{GEN} | Static | Practice photo | Your new dentist"
    if size == "ls":
        inner = f"""{photo('DJI_20260322152923_0097_D-scaled.jpg', 0, 0, 1200, 628, .5, .32)}
<div class="abs" data-name="Overlay" style="inset:0;background:linear-gradient(90deg,rgba(46,44,43,.6) 0%,rgba(46,44,43,0) 70%)"></div>
<div class="abs" style="left:48px;top:120px">{brand_card(600, 46)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    if s9:
        inner = f"""{photo('DJI_20260322152923_0097_D-scaled.jpg', 0, 0, 1080, 1920, .5, .4)}
<div class="abs" data-name="Overlay" style="inset:0;background:linear-gradient(180deg,rgba(46,44,43,0) 45%,rgba(46,44,43,.55) 100%)"></div>
<div class="abs" style="left:70px;top:860px">{brand_card(940, 84)}</div>"""
        return board(size, name, inner)
    inner = f"""{photo('DJI_20260322152923_0097_D-scaled.jpg', 0, 0, 1080, 1080, .5, .3)}
<div class="abs" data-name="Overlay" style="inset:0;background:linear-gradient(180deg,rgba(46,44,43,0) 40%,rgba(46,44,43,.5) 100%)"></div>
<div class="abs" style="left:60px;top:400px">{brand_card(860, 64)}</div>"""
    return board(size, name, inner)


PERSONAS = {"mark": [m1, m2, m3, m4, m5], "denise": [d1, d2, d3, d4, d5]}
FILES = {"s1": "1x1", "s9": "9x16", "ls": "landscape"}

if __name__ == "__main__":
    which = sys.argv[1:] or list(PERSONAS)
    for p in which:
        for size, suffix in FILES.items():
            (ROOT / f"{p}-{suffix}.html").write_text(page(f"Iconic | {p} | {suffix}", [f(size) for f in PERSONAS[p]]))
    print("built", which)
