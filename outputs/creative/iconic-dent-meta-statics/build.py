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


# ---------------------------------------------------------------- MICHELLE (wanted it for years)
SMILE = "Smile Makeover"
CTA_CONSULT = "Book your free consultation"
TOOTH = ('<svg viewBox="0 0 24 24" width="{s}" height="{s}" style="display:block;flex:none"><path d="M7.2 3.2c-2.6 0-4.2 2-4.2 4.6 0 2.4 1.1 3.8 1.6 5.6.6 2.2.8 7.4 2.7 7.4 1.7 0 1.6-4.6 3-5.6.5-.4 1.1-.4 1.6 0 1.4 1 1.3 5.6 3 5.6 1.9 0 2.1-5.2 2.7-7.4.5-1.8 1.6-3.2 1.6-5.6 0-2.6-1.6-4.6-4.2-4.6-1.9 0-2.9 1.1-4.8 1.1S9.1 3.2 7.2 3.2z" '
         'fill="none" stroke="{c}" stroke-width="1.6" stroke-linejoin="round"/></svg>')
ARROW = '<svg viewBox="0 0 24 24" width="{s}" height="{s}" style="display:block"><path d="{d}" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'


def bond_price(fs, col=LINEN):
    return (f'<div style="display:flex;align-items:baseline;gap:{fs * .25:.0f}px;white-space:nowrap"><span class="body" style="font-size:{fs * .42:.0f}px;color:{STONE if col == LINEN else GREY}">Composite bonding from</span>'
            f'<span class="hl" style="font-size:{fs:.0f}px;line-height:1;color:{GOLD}">£150</span><span class="body" style="font-size:{fs * .42:.0f}px;color:{STONE if col == LINEN else GREY}">per tooth</span></div>')


def mi1(size):
    """VT-04 Side column: Charcoal column with the soft question, the boutique hand mirror photo beside it."""
    name = f"{SMILE} | Static | Practice photo | Still thinking about your smile"
    hl = lambda fs: f'<div class="hl" style="font-size:{fs}px;color:{LINEN}">Still Thinking About <b>Your Smile?</b></div>'
    if size == "ls":
        inner = f"""{photo('mirror-boutique.jpg', 560, 0, 640, 628, .6, .72)}
<div class="abs" data-name="Overlay" style="left:400px;top:0;width:320px;height:628px;background:linear-gradient(90deg,{CHAR} 50%,rgba(46,44,43,0))"></div>
<div class="abs" style="left:0;top:0;width:480px;height:628px;background:{CHAR}"></div>
<div class="abs" style="left:56px;top:48px">{logo(150, 'cream', 'horizontal')}</div>
<div class="abs" style="left:56px;top:140px;width:520px">{hl(54)}</div>
<div class="abs rule" style="left:56px;top:300px;width:70px"></div>
<div class="abs" style="left:56px;top:330px">{bond_price(44)}</div>
<div class="abs eyebrow" style="left:56px;top:410px;font-size:14px">Free smile consultation · Norwich</div>
<div class="abs" style="left:56px;top:470px">{cta(CTA_CONSULT, 18)}</div>"""
        return board(size, name, inner, bg="char")
    s9 = size == "s9"
    if s9:
        inner = f"""{photo('mirror-boutique.jpg', 380, 0, 700, 1920, .6, .9, 1.8)}
<div class="abs" data-name="Overlay" style="left:0;top:0;width:1080px;height:1920px;background:linear-gradient(90deg,{CHAR} 45%,rgba(46,44,43,.6) 62%,rgba(46,44,43,0) 85%)"></div>
<div class="abs" style="left:80px;top:270px">{logo(130, 'cream')}</div>
<div class="abs" style="left:80px;top:620px;width:640px">{hl(104)}</div>
<div class="abs rule" style="left:80px;top:990px;width:90px"></div>
<div class="abs" style="left:80px;top:1030px">{bond_price(74)}</div>
<div class="abs eyebrow" style="left:80px;top:1160px;font-size:20px">Free smile consultation · Norwich</div>
<div class="abs" style="left:80px;top:1260px">{cta(CTA_CONSULT, 26)}</div>
<div class="abs" style="left:80px;top:1400px">{proof(19, LINEN)}</div>"""
        return board(size, name, inner, bg="char")
    inner = f"""{photo('mirror-boutique.jpg', 430, 0, 650, 1080, .62, .74, 1.45)}
<div class="abs" data-name="Overlay" style="left:0;top:0;width:1080px;height:1080px;background:linear-gradient(90deg,{CHAR} 42%,rgba(46,44,43,.5) 60%,rgba(46,44,43,0) 82%)"></div>
<div class="abs" style="left:70px;top:70px">{logo(170, 'cream', 'horizontal')}</div>
<div class="abs" style="left:70px;top:220px;width:600px">{hl(88)}</div>
<div class="abs rule" style="left:70px;top:540px;width:80px"></div>
<div class="abs" style="left:70px;top:580px">{bond_price(62)}</div>
<div class="abs eyebrow" style="left:70px;top:690px;font-size:17px">Free smile consultation · Norwich</div>
<div class="abs" style="left:70px;top:780px">{cta(CTA_CONSULT, 23)}</div>
<div class="abs" style="left:70px;top:910px">{proof(17, LINEN)}</div>"""
    return board(size, name, inner, bg="char")


MI2_PROBLEMS = ["Closed-mouth smile in every photo", "A hand over your mouth when you laugh", "“I'll get them done one day”"]


def problems(fs, w, items=None, label="Sound familiar?"):
    items = items or MI2_PROBLEMS
    return (f'<div style="width:{w}px"><div class="eyebrow" style="font-size:{fs * .6:.0f}px">{label}</div>'
            + "".join(f'<div style="display:flex;align-items:center;gap:{fs * .7:.0f}px;padding:{fs * .8:.0f}px 0;border-bottom:1px solid rgba(227,223,211,.18)">{TOOTH.format(s=round(fs * 1.5), c=GOLD)}'
                      f'<span style="font-family:Montserrat;font-weight:500;font-size:{fs:.0f}px;line-height:1.3;color:{LINEN}">{t}</span></div>' for t in items) + '</div>')


def arrow_chip(d, direction="down"):
    path = "M12 5v14M6 13l6 6 6-6" if direction == "down" else "M5 12h14M13 6l6 6-6 6"
    return (f'<div style="width:{d}px;height:{d}px;border-radius:50%;background:radial-gradient(circle at 35% 30%, #D2BB98, {GOLD} 55%, #A88B62);display:flex;align-items:center;justify-content:center;'
            f'box-shadow:0 8px 20px rgba(0,0,0,.3)">{ARROW.format(s=round(d * .5), d=path)}</div>')


def solution(fs, head="See Your New Smile <b>Before We Start.</b>", price=None):
    price = price or bond_price(fs * .7)
    return (f'<div class="eyebrow" style="font-size:{fs * .32:.0f}px">The solution</div>'
            f'<div class="hl" style="font-size:{fs:.0f}px;color:{LINEN};margin-top:{fs * .15:.0f}px">{head}</div>'
            f'<div style="margin-top:{fs * .3:.0f}px">{price}</div>')


def mi2(size):
    """VT-30 Problem and solution: three habits on Charcoal, arrow chip, solution over the consult room."""
    name = f"{SMILE} | Static | Practice photo | Three habits"
    if size == "ls":
        inner = f"""{photo('consult-room.jpg', 560, 0, 640, 628, .5, .5)}
<div class="abs" data-name="Overlay" style="left:560px;top:0;width:640px;height:628px;background:linear-gradient(180deg,rgba(46,44,43,.25) 0%,rgba(46,44,43,.85) 45%,rgba(46,44,43,.92) 100%)"></div>
<div class="abs" style="left:48px;top:40px">{logo(150, 'cream', 'horizontal')}</div>
<div class="abs" style="left:48px;top:120px">{problems(20, 470)}</div>
<div class="abs" style="left:48px;top:500px">{cta(CTA_CONSULT, 17)}</div>
<div class="abs" style="left:530px;top:280px">{arrow_chip(60, 'right')}</div>
<div class="abs" style="left:610px;top:290px;width:560px">{solution(36)}</div>"""
        return board(size, name, inner, bg="char")
    s9 = size == "s9"
    split = 1000 if s9 else 560
    inner = f"""{photo('consult-room.jpg', 0, split, 1080, (1920 if s9 else 1080) - split, .5, .5)}
<div class="abs" data-name="Overlay" style="left:0;top:{split}px;width:1080px;height:{(1920 if s9 else 1080) - split}px;background:linear-gradient(180deg,rgba(46,44,43,.05) 0%,rgba(46,44,43,.88) {65 if s9 else 70}%)"></div>
<div class="abs rule" style="left:0;right:0;top:{split}px;opacity:1"></div>
<div class="abs" style="left:{80 if s9 else 70}px;top:{270 if s9 else 50}px">{logo(190 if s9 else 160, 'cream', 'horizontal')}</div>
<div class="abs" style="left:{80 if s9 else 70}px;top:{430 if s9 else 140}px">{problems(34 if s9 else 27, 900)}</div>
<div class="abs" style="left:{880 if s9 else 900}px;top:{split - 55}px">{arrow_chip(110 if s9 else 96)}</div>
<div class="abs" style="left:{80 if s9 else 70}px;top:{1180 if s9 else 700}px;width:920px">{solution(80 if s9 else 58)}</div>
<div class="abs" style="left:{80 if s9 else 70}px;top:{1490 if s9 else 960}px;display:flex;align-items:center;gap:28px">{cta(CTA_CONSULT, 24 if s9 else 19)}{proof(17 if s9 else 14, LINEN)}</div>"""
    return board(size, name, inner, bg="char")


def notif(w, fs, app, title, msg, icon="mono"):
    ic = (f'<div style="width:{fs * 2.3:.0f}px;height:{fs * 2.3:.0f}px;border-radius:{fs * .55:.0f}px;background:{CHAR};display:flex;align-items:center;justify-content:center;flex:none">{mono(round(fs * 1.5), "gold")}</div>'
          if icon == "mono" else
          f'<div style="width:{fs * 2.3:.0f}px;height:{fs * 2.3:.0f}px;border-radius:{fs * .55:.0f}px;background:conic-gradient(#F2B84B,#E8746A,#B77BD6,#5FA8E8,#6CC58A,#F2B84B);flex:none"></div>')
    return (f'<div style="width:{w}px;display:flex;gap:{fs * .7:.0f}px;padding:{fs * .8:.0f}px {fs * .9:.0f}px;border-radius:{fs * 1.2:.0f}px;background:rgba(246,243,238,.86);'
            f'backdrop-filter:blur(18px);box-shadow:0 {fs * .4:.0f}px {fs * 1.2:.0f}px rgba(0,0,0,.25)">{ic}'
            f'<div style="flex:1;font-family:Montserrat;color:#1d1b19"><div style="display:flex;justify-content:space-between;font-size:{fs * .75:.0f}px;color:#6d675f;text-transform:uppercase;letter-spacing:.06em"><span>{app}</span><span style="text-transform:none">now</span></div>'
            f'<div style="font-weight:600;font-size:{fs:.0f}px;margin-top:{fs * .2:.0f}px">{title}</div><div style="font-size:{fs * .92:.0f}px;line-height:1.35;margin-top:{fs * .1:.0f}px;color:#3a3632">{msg}</div></div></div>')


def mi3(size):
    """VT-27 Phone notification: lock screen over the real lounge, a photo memory and an Iconic message."""
    name = f"{SMILE} | Static | Practice photo | On this day"
    n1 = lambda w, fs: notif(w, fs, "Photos", "On this day", "You have memories from 2016", icon="photos")
    n2 = lambda w, fs: notif(w, fs, "Iconic Dent", "Free smile consultation", "See your new smile on screen before anything starts.")
    clock = lambda fs: (f'<div style="text-align:center;color:{WHITE};font-family:Montserrat;text-shadow:0 2px 12px rgba(0,0,0,.25)"><div style="font-weight:500;font-size:{fs * .2:.0f}px">Saturday</div>'
                        f'<div style="font-weight:600;font-size:{fs:.0f}px;line-height:1;letter-spacing:-.02em">9:41</div></div>')
    if size == "ls":
        inner = f"""{photo('IMG_7396.jpg', 0, 0, 1200, 628, .5, .6)}
<div class="abs" data-name="Overlay" style="inset:0;background:linear-gradient(90deg,rgba(46,44,43,.88) 0%,rgba(46,44,43,.55) 55%,rgba(46,44,43,.1) 100%)"></div>
<div class="abs" style="left:56px;top:44px">{logo(150, 'cream', 'horizontal')}</div>
<div class="abs hl" style="left:56px;top:120px;width:560px;font-size:46px;color:{LINEN}">Another Year Of<br><b>Closed&#8209;Mouth Photos?</b></div>
<div class="abs" style="left:56px;top:300px">{n1(560, 17)}</div>
<div class="abs" style="left:56px;top:400px">{n2(560, 17)}</div>
<div class="abs" style="left:56px;top:530px;display:flex;align-items:center;gap:22px">{cta(CTA_CONSULT, 16)}{proof(13, LINEN)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    if s9:
        inner = f"""{photo('IMG_7396.jpg', 0, 0, 1080, 1920, .5, .5)}
<div class="abs" data-name="Overlay" style="inset:0;background:linear-gradient(180deg,rgba(46,44,43,.5) 0%,rgba(46,44,43,.45) 20%,rgba(46,44,43,.78) 38%,rgba(46,44,43,.8) 70%,rgba(46,44,43,.92) 100%)"></div>
<div class="abs" style="left:0;right:0;top:300px">{clock(220)}</div>
<div class="abs hl" style="left:80px;right:80px;top:640px;text-align:center;font-size:76px;color:{LINEN}">Another Year Of<br><b>Closed&#8209;Mouth Photos?</b></div>
<div class="abs" style="left:70px;top:1030px">{n1(940, 28)}</div>
<div class="abs" style="left:70px;top:1210px">{n2(940, 28)}</div>
<div class="abs" style="left:70px;top:1440px;display:flex;align-items:center;gap:30px">{cta(CTA_CONSULT, 25)}{proof(17, LINEN)}</div>"""
        return board(size, name, inner)
    inner = f"""{photo('IMG_7396.jpg', 0, 0, 1080, 1080, .5, .6)}
<div class="abs" data-name="Overlay" style="inset:0;background:linear-gradient(180deg,rgba(46,44,43,.85) 0%,rgba(46,44,43,.7) 35%,rgba(46,44,43,.8) 62%,rgba(46,44,43,.92) 100%)"></div>
<div class="abs" style="left:70px;top:56px">{logo(160, 'cream', 'horizontal')}</div>
<div class="abs hl" style="left:70px;top:150px;width:900px;font-size:72px;color:{LINEN}">Another Year Of<br><b>Closed&#8209;Mouth Photos?</b></div>
<div class="abs" style="left:70px;top:560px">{n1(940, 25)}</div>
<div class="abs" style="left:70px;top:720px">{n2(940, 25)}</div>
<div class="abs" style="left:70px;top:925px;display:flex;align-items:center;gap:30px">{cta(CTA_CONSULT, 22)}{proof(16, LINEN)}</div>"""
    return board(size, name, inner)


def mi4(size):
    """Custom: the Iconic hand mirror in a big circle frame off the right edge, gold disc, headline on Linen."""
    name = f"{SMILE} | Static | Practice photo | See it before we start"
    if size == "ls":
        inner = f"""{mono(480, 'white', 'position:absolute;left:-300px;top:260px;opacity:.35')}
{circle('mirror-boutique.jpg', 690, -60, 640, .62, .68, disc=(20, 440, 120))}
<div class="abs" style="left:60px;top:46px">{logo(90)}</div>
<div class="abs hl" style="left:60px;top:175px;width:560px;font-size:60px">See It <b>Before We Start.</b></div>
<div class="abs body" style="left:60px;top:325px;width:520px;font-size:19px;color:{INK}">Your new smile, designed on screen first.</div>
<div class="abs eyebrow" style="left:60px;top:390px;font-size:14px">Free smile consultation</div>
<div class="abs" style="left:60px;top:470px;display:flex;align-items:center;gap:24px">{cta(CTA_CONSULT, 17)}{proof(14)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    if s9:
        inner = f"""{mono(900, 'white', 'position:absolute;left:-420px;top:1180px;opacity:.35')}
{circle('mirror-boutique.jpg', 250, 280, 860, .62, .66, disc=(30, 600, 150))}
<div class="abs" style="left:80px;top:270px">{logo(120)}</div>
<div class="abs hl" style="left:80px;top:1180px;width:920px;font-size:100px">See It <b>Before We Start.</b></div>
<div class="abs body" style="left:80px;top:1400px;width:920px;font-size:30px;color:{INK}">Your new smile, designed on screen first.</div>
<div class="abs eyebrow" style="left:80px;top:1470px;font-size:20px">Free smile consultation</div>
<div class="abs" style="left:80px;top:1560px;display:flex;align-items:center;gap:30px">{cta(CTA_CONSULT, 25)}{proof(18)}</div>"""
        return board(size, name, inner)
    inner = f"""{mono(700, 'white', 'position:absolute;left:-380px;top:560px;opacity:.35')}
{circle('mirror-boutique.jpg', 560, 60, 820, .62, .66, disc=(10, 590, 140))}
<div class="abs" style="left:70px;top:70px">{logo(110)}</div>
<div class="abs hl" style="left:70px;top:300px;width:520px;font-size:92px">See It <b>Before We Start.</b></div>
<div class="abs body" style="left:70px;top:520px;width:430px;font-size:26px;color:{INK}">Your new smile, designed on screen first.</div>
<div class="abs eyebrow" style="left:70px;top:660px;font-size:17px">Free smile consultation</div>
<div class="abs" style="left:70px;top:820px">{cta(CTA_CONSULT, 22)}</div>
<div class="abs" style="left:70px;top:945px">{proof(18)}</div>"""
    return board(size, name, inner)


def mi5(size):
    """Custom: type-led on Charcoal, gold second line, rule, monogram watermark, small mirror circle."""
    name = f"{SMILE} | Static | Typographic | Mouth closed"
    hl = lambda fs, w: f'<div class="hl" style="width:{w}px;font-size:{fs}px;line-height:1.02;color:{LINEN}">Years Of Smiling With <b>Your Mouth Closed?</b></div>'
    if size == "ls":
        inner = f"""{mono(560, 'cream', 'position:absolute;left:760px;top:-60px;opacity:.06')}
{circle('mirror-boutique.jpg', 880, 190, 280, .62, .68, disc=(0, 200, 64))}
<div class="abs" style="left:56px;top:46px">{logo(150, 'cream', 'horizontal')}</div>
<div class="abs" style="left:56px;top:140px">{hl(58, 760)}</div>
<div class="abs rule" style="left:56px;top:330px;width:80px"></div>
<div class="abs eyebrow" style="left:56px;top:360px;font-size:15px">Free smile consultation in Norwich</div>
<div class="abs" style="left:56px;top:420px">{proof(15, LINEN)}</div>
<div class="abs" style="left:56px;top:480px">{cta(CTA_CONSULT, 18)}</div>"""
        return board(size, name, inner, bg="char")
    s9 = size == "s9"
    if s9:
        inner = f"""{mono(1100, 'cream', 'position:absolute;left:200px;top:300px;opacity:.06')}
<div class="abs" style="left:80px;top:270px">{logo(120, 'cream')}</div>
<div class="abs" style="left:80px;top:560px">{hl(118, 920)}</div>
<div class="abs rule" style="left:80px;top:1060px;width:110px"></div>
<div class="abs eyebrow" style="left:80px;top:1100px;font-size:21px">Free smile consultation in Norwich</div>
{circle('mirror-boutique.jpg', 640, 1150, 360, .62, .68, disc=(270, 260, 90))}
<div class="abs" style="left:80px;top:1250px">{proof(19, LINEN)}</div>
<div class="abs" style="left:80px;top:1340px">{cta(CTA_CONSULT, 25)}</div>"""
        return board(size, name, inner, bg="char")
    inner = f"""{mono(820, 'cream', 'position:absolute;left:420px;top:240px;opacity:.06')}
<div class="abs" style="left:70px;top:70px">{logo(100, 'cream')}</div>
<div class="abs" style="left:70px;top:270px">{hl(92, 900)}</div>
<div class="abs rule" style="left:70px;top:590px;width:90px"></div>
<div class="abs eyebrow" style="left:70px;top:625px;font-size:18px">Free smile consultation in Norwich</div>
{circle('mirror-boutique.jpg', 700, 640, 320, .62, .68, disc=(0, 230, 76))}
<div class="abs" style="left:70px;top:740px">{proof(18, LINEN)}</div>
<div class="abs" style="left:70px;top:820px">{cta(CTA_CONSULT, 23)}</div>"""
    return board(size, name, inner, bg="char")


# ---------------------------------------------------------------- HANNAH (getting married)
def seal(d):
    return (f'<div style="width:{d}px;height:{d}px;border-radius:50%;background:radial-gradient(circle at 35% 30%, #D6BE99, {GOLD} 50%, #94774F);display:flex;align-items:center;justify-content:center;'
            f'box-shadow:0 {d * .08:.0f}px {d * .2:.0f}px rgba(40,30,15,.35), inset 0 0 0 {d * .06:.0f}px rgba(255,240,215,.25)">{mono(round(d * .55), "white", "opacity:.9")}</div>')


def invite(w, fs):
    """Save-the-date card half out of a Charcoal envelope with a gold monogram seal (VT-28)."""
    h_card, h_env = w * 1.0, w * .62
    card = (f'<div style="position:absolute;left:{w * .08:.0f}px;top:0;width:{w * .84:.0f}px;height:{h_card:.0f}px;background:#FCFAF6;transform:rotate(-2deg);'
            f'box-shadow:0 {fs * .5:.0f}px {fs * 1.4:.0f}px rgba(40,30,15,.25);padding:{fs * 1.4:.0f}px {fs:.0f}px;text-align:center">'
            f'<div style="border:1.5px solid rgba(190,161,122,.6);position:absolute;inset:{fs * .5:.0f}px"></div>'
            f'<div class="eyebrow" style="font-size:{fs * .55:.0f}px">Save the date</div>'
            f'<div style="font-family:Caveat;font-weight:600;font-size:{fs * 2.2:.0f}px;line-height:1;color:#24211e;margin-top:{fs * .5:.0f}px">Then tell us.</div>'
            f'<div style="width:{fs * 3:.0f}px;height:1.5px;background:{GOLD};margin:{fs * .7:.0f}px auto"></div>'
            f'<div class="hl" style="font-size:{fs * 1.05:.0f}px">Free Smile <b>Consultation</b></div></div>')
    env = (f'<div style="position:absolute;left:0;top:{h_card * .55:.0f}px;width:{w}px;height:{h_env:.0f}px;background:linear-gradient(180deg,#3a3734,{CHAR});border-radius:{fs * .3:.0f}px;'
           f'box-shadow:0 {fs:.0f}px {fs * 2.2:.0f}px rgba(40,30,15,.35);overflow:hidden">'
           f'<div style="position:absolute;left:0;top:0;width:0;height:0;border-left:{w / 2:.0f}px solid transparent;border-right:{w / 2:.0f}px solid transparent;border-top:{h_env * .55:.0f}px solid rgba(255,255,255,.05)"></div></div>'
           f'<div style="position:absolute;left:{w / 2 - fs * 1.6:.0f}px;top:{h_card * .55 + h_env * .38:.0f}px">{seal(round(fs * 3.2))}</div>')
    return f'<div style="position:relative;width:{w}px;height:{h_card * .55 + h_env:.0f}px">{card}{env}</div>'


def h1(size):
    name = f"{SMILE} | Static | Object | Save the date"
    if size == "ls":
        inner = f"""<div class="abs" style="left:56px;top:46px">{logo(150, 'charcoal', 'horizontal')}</div>
<div class="abs hl" style="left:56px;top:150px;width:520px;font-size:52px">Getting Married? <b>Tell Us The Date First.</b></div>
<div class="abs body" style="left:56px;top:320px;width:480px;font-size:19px;color:{INK}">We'll plan your smile around your wedding.</div>
<div class="abs" style="left:56px;top:400px">{cta(CTA_CONSULT, 18)}</div>
<div class="abs" style="left:56px;top:510px">{proof(15)}</div>
<div class="abs" style="left:690px;top:50px">{invite(420, 22)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    if s9:
        inner = f"""<div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(120)}</div>
<div class="abs" style="left:230px;top:470px">{invite(620, 32)}</div>
<div class="abs hl" style="left:80px;right:80px;top:1250px;text-align:center;font-size:72px">Getting Married? <b>Tell Us The Date First.</b></div>
<div class="abs body" style="left:80px;right:80px;top:1420px;text-align:center;font-size:28px;color:{INK}">We'll plan your smile around your wedding.</div>
<div class="abs" style="left:0;right:0;top:1490px;display:flex;justify-content:center;align-items:center;gap:30px">{cta(CTA_CONSULT, 24)}{proof(17)}</div>"""
        return board(size, name, inner)
    inner = f"""<div class="abs" style="left:70px;top:60px">{logo(170, 'charcoal', 'horizontal')}</div>
<div class="abs" style="left:300px;top:130px">{invite(480, 26)}</div>
<div class="abs hl" style="left:70px;right:70px;top:780px;text-align:center;font-size:58px">Getting Married? <b>Tell Us The Date First.</b></div>
<div class="abs" style="left:0;right:0;top:930px;display:flex;justify-content:center;align-items:center;gap:30px">{cta(CTA_CONSULT, 21)}{proof(16)}</div>"""
    return board(size, name, inner)


H2_LIST = ["Venue", "Dress", "Photographer", "Flowers"]


def notepad(w, fs):
    lh = fs * 1.55
    rows = "".join(f'<div style="display:flex;align-items:center;justify-content:space-between;height:{lh:.0f}px;font-family:Caveat;font-weight:600;font-size:{fs:.0f}px;color:#24211e">'
                   f'<span>{t}</span>{TICK.format(s=round(fs * .8), c=GOLD)}</div>' for t in H2_LIST)
    last = (f'<div style="display:flex;align-items:center;height:{lh:.0f}px;font-family:Caveat;font-weight:600;font-size:{fs:.0f}px;color:#24211e">My smile'
            f'<span style="flex:1;margin-left:{fs * .3:.0f}px;border-bottom:2px dashed {GOLD};height:{fs * .6:.0f}px"></span><span style="margin-left:{fs * .3:.0f}px;color:{GOLD}">?</span></div>')
    lines = f"repeating-linear-gradient(180deg,transparent 0,transparent {lh - 1.5:.1f}px,rgba(120,150,180,.28) {lh - 1.5:.1f}px,rgba(120,150,180,.28) {lh:.1f}px)"
    return (f'<div style="position:relative;width:{w}px;padding:{fs * 1.6:.0f}px {fs * .9:.0f}px {fs * .9:.0f}px {fs * 1.6:.0f}px;background:#FDFBF5;transform:rotate(2deg);'
            f'box-shadow:0 {fs * .5:.0f}px {fs * 1.4:.0f}px rgba(40,30,15,.28),0 2px 4px rgba(40,30,15,.15)">'
            f'<div style="position:absolute;left:0;right:0;top:0;height:{fs * .9:.0f}px;background:repeating-linear-gradient(90deg,#3a3734 0,#3a3734 {fs * .25:.0f}px,transparent {fs * .25:.0f}px,transparent {fs * .6:.0f}px)"></div>'
            f'<div style="position:absolute;left:{fs * 1.1:.0f}px;top:0;bottom:0;width:1.5px;background:rgba(200,90,90,.35)"></div>'
            f'<div style="font-family:Caveat;font-weight:700;font-size:{fs * 1.1:.0f}px;color:{GOLD};margin-bottom:{fs * .2:.0f}px">Wedding list</div>'
            f'<div style="background:{lines}">{rows}{last}</div></div>')


def h2(size):
    name = f"{SMILE} | Static | Object | The wedding list"
    if size == "ls":
        inner = f"""<div class="abs" style="left:56px;top:46px">{logo(150, 'charcoal', 'horizontal')}</div>
<div class="abs hl" style="left:56px;top:150px;width:520px;font-size:58px">One Thing Left <b>On The List?</b></div>
<div class="abs eyebrow" style="left:56px;top:310px;font-size:14px">Free smile consultation · Norwich</div>
<div class="abs" style="left:56px;top:380px">{cta(CTA_CONSULT, 18)}</div>
<div class="abs" style="left:56px;top:490px">{proof(15)}</div>
<div class="abs" style="left:700px;top:40px">{notepad(420, 34)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    if s9:
        inner = f"""<div class="abs" style="left:80px;top:270px">{logo(120)}</div>
<div class="abs hl" style="left:80px;top:460px;width:920px;font-size:100px">One Thing Left <b>On The List?</b></div>
<div class="abs" style="left:170px;top:740px">{notepad(740, 58)}</div>
<div class="abs" style="left:80px;top:1440px;display:flex;align-items:center;gap:30px">{cta(CTA_CONSULT, 25)}{proof(17)}</div>"""
        return board(size, name, inner)
    inner = f"""<div class="abs hl" style="left:70px;top:80px;width:520px;font-size:84px">One Thing Left <b>On The List?</b></div>
<div class="abs eyebrow" style="left:70px;top:390px;font-size:17px">Free smile consultation</div>
<div class="abs" style="left:70px;top:820px">{cta(CTA_CONSULT, 22)}</div>
<div class="abs" style="left:70px;top:945px">{proof(17)}</div>
<div class="abs" style="left:70px;top:460px">{logo(110)}</div>
<div class="abs" style="left:590px;top:110px">{notepad(430, 40)}</div>"""
    return board(size, name, inner)


H3_STEPS = [("A few weeks", "Whitening and composite bonding"), ("A few months or more", "Clear aligners as well"), ("Today", "Free smile consultation")]


def timeline(w, fs, vertical=False):
    dot = lambda: f'<div style="width:{fs * 1.1:.0f}px;height:{fs * 1.1:.0f}px;border-radius:50%;background:radial-gradient(circle at 35% 30%, #D2BB98, {GOLD} 55%, #A88B62);box-shadow:0 0 0 {fs * .35:.0f}px rgba(190,161,122,.18);flex:none"></div>'
    if vertical:
        items = "".join(f'<div style="display:flex;gap:{fs * 1.1:.0f}px;align-items:flex-start;margin-top:{fs * 1.6 if i else 0:.0f}px;position:relative">{dot()}'
                        f'<div><div class="hl" style="font-size:{fs * 1.5:.0f}px;color:{GOLD};line-height:1">{a}</div><div class="body" style="font-size:{fs:.0f}px;margin-top:{fs * .3:.0f}px">{b}</div></div></div>'
                        for i, (a, b) in enumerate(H3_STEPS))
        return (f'<div style="position:relative;width:{w}px"><div style="position:absolute;left:{fs * .55 - 1:.0f}px;top:{fs * .5:.0f}px;bottom:{fs * 2:.0f}px;width:2px;background:rgba(190,161,122,.5)"></div>{items}</div>')
    items = "".join(f'<div style="flex:1;padding-right:{fs:.0f}px">{dot()}<div class="hl" style="font-size:{fs * 1.35:.0f}px;color:{GOLD};line-height:1.05;margin-top:{fs * .9:.0f}px">{a}</div>'
                    f'<div class="body" style="font-size:{fs * .85:.0f}px;margin-top:{fs * .35:.0f}px">{b}</div></div>' for a, b in H3_STEPS)
    return (f'<div style="position:relative;width:{w}px;display:flex"><div style="position:absolute;left:0;right:{fs:.0f}px;top:{fs * .55 - 1:.0f}px;height:2px;background:rgba(190,161,122,.5)"></div>{items}</div>')


def h3(size):
    name = f"{SMILE} | Static | Typographic | How long until the day"
    if size == "ls":
        inner = f"""{mono(560, 'cream', 'position:absolute;left:760px;top:-60px;opacity:.06')}
<div class="abs" style="left:56px;top:46px">{logo(150, 'cream', 'horizontal')}</div>
<div class="abs hl" style="left:56px;top:120px;width:900px;font-size:54px">How Long Until <b>The Big Day?</b></div>
<div class="abs" style="left:56px;top:250px">{timeline(1090, 20)}</div>
<div class="abs" style="left:56px;top:500px;display:flex;align-items:center;gap:24px">{cta(CTA_CONSULT, 18)}{proof(14, LINEN)}</div>"""
        return board(size, name, inner, bg="char")
    s9 = size == "s9"
    if s9:
        inner = f"""{mono(1100, 'cream', 'position:absolute;left:200px;top:300px;opacity:.06')}
<div class="abs" style="left:80px;top:270px">{logo(120, 'cream')}</div>
<div class="abs hl" style="left:80px;top:480px;width:900px;font-size:104px">How Long Until <b>The Big Day?</b></div>
<div class="abs" style="left:80px;top:790px">{timeline(900, 32, True)}</div>
<div class="abs" style="left:80px;top:1400px">{cta(CTA_CONSULT, 25)}</div>
<div class="abs" style="left:80px;top:1520px">{proof(18, LINEN)}</div>"""
        return board(size, name, inner, bg="char")
    inner = f"""{mono(820, 'cream', 'position:absolute;left:420px;top:240px;opacity:.06')}
<div class="abs" style="left:70px;top:70px">{logo(170, 'cream', 'horizontal')}</div>
<div class="abs hl" style="left:70px;top:190px;width:900px;font-size:88px">How Long Until <b>The Big Day?</b></div>
<div class="abs" style="left:70px;top:480px">{timeline(960, 28)}</div>
<div class="abs" style="left:70px;top:840px;display:flex;align-items:center;gap:30px">{cta(CTA_CONSULT, 22)}{proof(17, LINEN)}</div>"""
    return board(size, name, inner, bg="char")


H4_USPS = ["Free smile consultation", "See your smile on screen first", "Every cost in writing"]


def band(fs, w, centred=True):
    al = "center" if centred else "flex-start"
    usps = "".join(f'<div style="display:flex;align-items:center;gap:{fs * .25:.0f}px;font-family:Montserrat;font-weight:500;font-size:{fs * .3:.0f}px;color:{LINEN};white-space:nowrap">{TICK.format(s=round(fs * .36), c=GOLD)}{t}</div>' for t in H4_USPS)
    return (f'<div style="width:{w}px;display:flex;flex-direction:column;align-items:{al};text-align:{"center" if centred else "left"}">'
            f'<div class="hl" style="font-size:{fs:.0f}px;color:{LINEN}">Wedding-Ready <b>Smiles</b></div>'
            f'<div style="margin-top:{fs * .3:.0f}px">{bond_price(fs * .8)}</div>'
            f'<div style="display:flex;flex-wrap:wrap;justify-content:{al};gap:{fs * .2:.0f}px {fs * .45:.0f}px;margin-top:{fs * .4:.0f}px">{usps}</div></div>')


def h4(size):
    """VT-01 Offer band: Charcoal band with price and USPs over the boutique smile display."""
    name = f"{SMILE} | Static | Practice photo | Wedding-ready smiles"
    if size == "ls":
        inner = f"""{photo('mirror-boutique.jpg', 640, 0, 560, 628, .6, .72)}
<div class="abs" data-name="Overlay" style="left:540px;top:0;width:260px;height:628px;background:linear-gradient(90deg,{CHAR},rgba(46,44,43,0))"></div>
<div class="abs" style="left:56px;top:46px">{logo(150, 'cream', 'horizontal')}</div>
<div class="abs" style="left:56px;top:150px">{band(56, 600, False)}</div>
<div class="abs" style="left:56px;top:450px;display:flex;align-items:center;gap:24px">{cta(CTA_CONSULT, 18)}{proof(14, LINEN)}</div>"""
        return board(size, name, inner, bg="char")
    s9 = size == "s9"
    H = 1920 if s9 else 1080
    top = 0
    bh = 820 if s9 else 430
    inner = f"""{photo('mirror-boutique.jpg', 0, 0, 1080, H, .6, .78 if s9 else .6, 1.3 if s9 else 1.0)}
<div class="abs" style="left:0;right:0;top:{top}px;height:{bh}px;background:linear-gradient(180deg,rgba(46,44,43,.96),rgba(46,44,43,.9));box-shadow:0 20px 50px rgba(0,0,0,.3)"></div>
<div class="abs rule" style="left:0;right:0;top:{top + bh}px;opacity:1"></div>
<div class="abs" style="left:0;right:0;top:{top + (270 if s9 else 40)}px;display:flex;justify-content:center">{logo(130 if s9 else 110, 'cream', 'stacked') if s9 else logo(170, 'cream', 'horizontal')}</div>
<div class="abs" style="left:60px;right:60px;top:{top + (470 if s9 else 130)}px;display:flex;justify-content:center">{band(84 if s9 else 76, 960)}</div>
<div class="abs" style="left:0;right:0;top:{1450 if s9 else 940}px;display:flex;justify-content:center">{cta(CTA_CONSULT, 26 if s9 else 23)}</div>"""
    return board(size, name, inner, bg="char")


def h5(size):
    """VT-17 Centre band split: reception sign photo, gold band headline, Linen panel with the offer."""
    name = f"{SMILE} | Static | Practice photo | Photos last forever"
    gband = lambda fs, w, h: (f'<div style="width:{w}px;height:{h}px;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#CDB28C,{GOLD} 55%,#A68A63);'
                              f'box-shadow:0 14px 34px rgba(60,44,20,.25)"><div class="hl" style="font-size:{fs}px;color:{WHITE};text-align:center">The Photos Last Forever.</div></div>')
    if size == "ls":
        inner = f"""{photo('sign-wall-tall.jpg', 0, 0, 400, 628, .5, .32)}
<div class="abs" style="left:400px;top:0">{gband(46, 400, 628)}</div>
<div class="abs" style="left:840px;top:60px">{logo(110)}</div>
<div class="abs hl" style="left:840px;top:250px;width:330px;font-size:34px">Plan Your Smile Around <b>Your Wedding.</b></div>
<div class="abs eyebrow" style="left:840px;top:390px;font-size:12px">Free consultation · Norwich</div>
<div class="abs" style="left:840px;top:440px">{cta(CTA_CONSULT, 15)}</div>
<div class="abs" style="left:840px;top:530px">{proof(11)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    ph = 900 if s9 else 470
    bh = 200 if s9 else 150
    inner = f"""{photo('sign-wall-tall.jpg', 0, 0, 1080, ph, .5, .35)}
<div class="abs" style="left:0;top:{ph}px">{gband(84 if s9 else 70, 1080, bh)}</div>
<div class="abs hl" style="left:80px;right:80px;top:{ph + bh + (90 if s9 else 50)}px;text-align:center;font-size:{64 if s9 else 46}px">Plan Your Smile Around <b>Your Wedding.</b></div>
<div class="abs eyebrow" style="left:0;right:0;top:{ph + bh + (290 if s9 else 130)}px;text-align:center;font-size:{20 if s9 else 16}px">Free smile consultation in Norwich</div>
<div class="abs" style="left:0;right:0;top:{ph + bh + (360 if s9 else 185)}px;display:flex;justify-content:center;align-items:center;gap:30px">{cta(CTA_CONSULT, 25 if s9 else 21)}{proof(17 if s9 else 15)}</div>"""
    return board(size, name, inner)


# ---------------------------------------------------------------- PETER (one missing tooth)
IMP = "Dental Implants"
CROSS = ('<svg width="{s}" height="{s}" viewBox="0 0 24 24" style="display:block;flex:none"><circle cx="12" cy="12" r="11.2" fill="none" stroke="{c}" stroke-width="1.6"/>'
         '<path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="{c}" stroke-width="2" stroke-linecap="round"/></svg>')


def implant_price(fs, col=INK, sub=GREY):
    return (f'<div class="eyebrow" style="font-size:{fs * .14:.0f}px">Single dental implant</div>'
            f'<div style="display:flex;align-items:baseline;gap:{fs * .08:.0f}px;margin-top:{fs * .08:.0f}px"><span class="body" style="font-size:{fs * .16:.0f}px;color:{sub}">from</span>'
            f'<span class="hl" style="font-size:{fs:.0f}px;line-height:.95;color:{GOLD}">£2,500</span></div>'
            f'<div class="hl" style="font-size:{fs * .3:.0f}px;color:{col};margin-top:{fs * .06:.0f}px">Crown <b>Included.</b></div>')


def p1(size):
    """VT-20 Editorial price split: big price on Linen beside a capsule of the real 3D scanner."""
    name = f"{IMP} | Static | Practice photo | One price"
    if size == "ls":
        inner = f"""<div class="abs" style="left:56px;top:46px">{logo(150, 'charcoal', 'horizontal')}</div>
<div class="abs" style="left:56px;top:140px">{implant_price(150)}</div>
<div class="abs body" style="left:56px;top:400px;width:560px;font-size:18px;color:{INK}">Free consultation with a 3D scan and a written plan.</div>
<div class="abs" style="left:56px;top:470px;display:flex;align-items:center;gap:24px">{cta(CTA_CONSULT, 18)}{proof(14)}</div>
<div class="abs" style="left:790px;top:30px;width:360px;height:568px;background:{SAND};border-radius:180px"></div>
{capsule('cbct.jpg', 820, 50, 300, 528, .45, .5)}
<div class="abs" style="left:800px;top:420px;width:70px;height:70px;border-radius:50%;background:radial-gradient(circle at 35% 30%, #D2BB98, {GOLD} 55%, #A88B62);box-shadow:0 10px 24px rgba(60,44,20,.25)"></div>"""
        return board(size, name, inner, bg=PAPER)
    s9 = size == "s9"
    if s9:
        inner = f"""<div class="abs" style="left:80px;top:270px">{logo(120)}</div>
<div class="abs" style="left:560px;top:250px;width:440px;height:760px;background:{SAND};border-radius:220px"></div>
{capsule('cbct.jpg', 600, 290, 360, 680, .45, .45)}
<div class="abs" style="left:570px;top:820px;width:110px;height:110px;border-radius:50%;background:radial-gradient(circle at 35% 30%, #D2BB98, {GOLD} 55%, #A88B62);box-shadow:0 10px 24px rgba(60,44,20,.25)"></div>
<div class="abs" style="left:80px;top:1040px">{implant_price(230)}</div>
<div class="abs body" style="left:80px;top:1450px;width:900px;font-size:29px;color:{INK}">Free consultation with a 3D scan and a written plan.</div>
<div class="abs" style="left:80px;top:1530px;display:flex;align-items:center;gap:30px">{cta(CTA_CONSULT, 24)}{proof(17)}</div>"""
        return board(size, name, inner, bg=PAPER)
    inner = f"""<div class="abs" style="left:70px;top:70px">{logo(170, 'charcoal', 'horizontal')}</div>
<div class="abs" style="left:690px;top:60px;width:340px;height:960px;background:{SAND};border-radius:170px"></div>
{capsule('cbct.jpg', 720, 90, 280, 900, .45, .5)}
<div class="abs" style="left:690px;top:760px;width:90px;height:90px;border-radius:50%;background:radial-gradient(circle at 35% 30%, #D2BB98, {GOLD} 55%, #A88B62);box-shadow:0 10px 24px rgba(60,44,20,.25)"></div>
<div class="abs" style="left:70px;top:290px">{implant_price(170)}</div>
<div class="abs body" style="left:70px;top:620px;width:560px;font-size:25px;color:{INK}">Free consultation with a 3D scan and a written plan.</div>
<div class="abs" style="left:70px;top:780px">{cta(CTA_CONSULT, 22)}</div>
<div class="abs" style="left:70px;top:905px">{proof(17)}</div>"""
    return board(size, name, inner, bg=PAPER)


P2_GAP = ["Chewing on one side", "Food getting stuck", "Teeth either side can shift"]
P2_IMP = ["Fixed, like your own tooth", "Doesn't rely on the teeth next to it", "12-month guarantee"]


def vs_card(w, fs, dark, title, items, photo_html=""):
    bg = f"background:{CHAR}" if dark else f"background:#FCFAF6"
    tc, ic = (LINEN, STONE) if dark else (INK, INK)
    icon = (lambda: CROSS.format(s=round(fs * 1.3), c="#9C948A")) if dark else (lambda: TICK.format(s=round(fs * 1.3), c=GOLD))
    rows = "".join(f'<div style="display:flex;align-items:center;gap:{fs * .6:.0f}px;margin-top:{fs * .9:.0f}px">{icon()}<span style="font-family:Montserrat;font-weight:500;font-size:{fs:.0f}px;line-height:1.3;color:{ic}">{t}</span></div>' for t in items)
    return (f'<div style="width:{w}px;{bg};border-radius:{fs * 1.1:.0f}px;padding:{fs * 1.4:.0f}px {fs * 1.3:.0f}px {fs * 1.5:.0f}px;box-shadow:0 {fs * .8:.0f}px {fs * 2:.0f}px rgba(46,44,43,.22);overflow:hidden">'
            f'{photo_html}<div class="hl" style="font-size:{fs * 1.7:.0f}px;color:{tc}">{title}</div>{rows}</div>')


def vs_badge(d):
    return (f'<div style="width:{d}px;height:{d}px;border-radius:50%;background:radial-gradient(circle at 35% 30%, #D2BB98, {GOLD} 55%, #A88B62);display:flex;align-items:center;justify-content:center;'
            f'font-family:\'Mongolian Baiti\';font-size:{d * .38:.0f}px;color:{WHITE};box-shadow:0 10px 24px rgba(0,0,0,.25)">vs</div>')


def p2(size):
    """VT-22 Two-card comparison: living with the gap vs one implant. No competitor named."""
    name = f"{IMP} | Static | Typographic | Living with the gap"
    if size == "ls":
        inner = f"""<div class="abs hl" style="left:56px;top:40px;width:800px;font-size:44px">Got Used To The Gap? <b>Here's What It's Costing.</b></div>
<div class="abs" style="left:56px;top:170px">{vs_card(520, 17, True, "Living with the gap", P2_GAP)}</div>
<div class="abs" style="left:624px;top:170px">{vs_card(520, 17, False, "One implant", P2_IMP)}</div>
<div class="abs" style="left:557px;top:255px">{vs_badge(84)}</div>
<div class="abs" style="left:56px;top:520px;display:flex;align-items:center;gap:24px">{cta(CTA_CONSULT, 17)}<span class="body" style="font-size:16px;color:{INK}">From <b style="color:{GOLD};font-weight:600">£2,500</b>, crown included</span></div>
<div class="abs" style="left:960px;top:520px">{logo(180, 'charcoal', 'horizontal')}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    if s9:
        inner = f"""<div class="abs" style="left:80px;top:270px">{logo(120)}</div>
<div class="abs hl" style="left:80px;top:450px;width:920px;font-size:80px">Got Used To The Gap? <b>Here's What It's Costing.</b></div>
<div class="abs" style="left:80px;top:680px">{vs_card(920, 30, True, "Living with the gap", P2_GAP)}</div>
<div class="abs" style="left:80px;top:1080px">{vs_card(920, 30, False, "One implant", P2_IMP)}</div>
<div class="abs" style="left:880px;top:1005px">{vs_badge(130)}</div>
<div class="abs" style="left:80px;top:1500px;display:flex;align-items:center;gap:30px">{cta(CTA_CONSULT, 24)}<span class="body" style="font-size:24px;color:{INK}">From <b style="color:{GOLD};font-weight:600">£2,500</b>, crown included</span></div>"""
        return board(size, name, inner)
    inner = f"""<div class="abs hl" style="left:70px;top:70px;width:940px;font-size:68px">Got Used To The Gap? <b>Here's What It's Costing.</b></div>
<div class="abs" style="left:70px;top:300px">{vs_card(455, 21, True, "Living with the gap", P2_GAP)}</div>
<div class="abs" style="left:555px;top:300px">{vs_card(455, 21, False, "One implant", P2_IMP)}</div>
<div class="abs" style="left:490px;top:420px">{vs_badge(100)}</div>
<div class="abs" style="left:70px;top:800px;display:flex;align-items:center;gap:30px">{cta(CTA_CONSULT, 22)}<span class="body" style="font-size:22px;color:{INK}">From <b style="color:{GOLD};font-weight:600">£2,500</b>, crown included</span></div>
<div class="abs" style="left:70px;top:960px">{logo(170, 'charcoal', 'horizontal')}</div>
<div class="abs" style="left:760px;top:965px">{proof(15)}</div>"""
    return board(size, name, inner)


def p3(size):
    """Custom: big question on Linen with a large circle of the real surgery bleeding off the edge."""
    name = f"{IMP} | Static | Practice photo | Chewing on one side"
    sub = "One implant. Crown included. From"
    pl = lambda fs: f'<div class="body" style="font-size:{fs}px;color:{INK}">{sub} <b class="hl" style="font-weight:400;color:{GOLD};font-size:{fs * 1.6:.0f}px">£2,500.</b></div>'
    if size == "ls":
        inner = f"""{circle('surgery.jpg', 700, 40, 560, .55, .55, disc=(30, 400, 100))}
<div class="abs" style="left:56px;top:46px">{logo(150, 'charcoal', 'horizontal')}</div>
<div class="abs hl" style="left:56px;top:140px;width:600px;font-size:64px">Still Chewing <b>On One Side?</b></div>
<div class="abs" style="left:56px;top:320px;width:600px">{pl(19)}</div>
<div class="abs" style="left:56px;top:420px;display:flex;align-items:center;gap:24px">{cta(CTA_CONSULT, 17)}{proof(13)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    if s9:
        inner = f"""{circle('surgery.jpg', 140, 1020, 1100, .55, .55, disc=(80, 160, 150))}
<div class="abs" style="left:80px;top:270px">{logo(120)}</div>
<div class="abs hl" style="left:80px;top:470px;width:920px;font-size:118px">Still Chewing <b>On One Side?</b></div>
<div class="abs" style="left:80px;top:760px;width:920px">{pl(30)}</div>
<div class="abs" style="left:80px;top:870px;display:flex;align-items:center;gap:30px">{cta(CTA_CONSULT, 24)}{proof(17)}</div>"""
        return board(size, name, inner)
    inner = f"""{circle('surgery.jpg', 520, 420, 820, .55, .55, disc=(40, 120, 120))}
<div class="abs" style="left:70px;top:70px">{logo(170, 'charcoal', 'horizontal')}</div>
<div class="abs hl" style="left:70px;top:190px;width:900px;font-size:96px">Still Chewing <b>On One Side?</b></div>
<div class="abs" style="left:70px;top:430px;width:520px">{pl(25)}</div>
<div class="abs" style="left:70px;top:820px">{cta(CTA_CONSULT, 22)}</div>
<div class="abs" style="left:70px;top:945px">{proof(17)}</div>"""
    return board(size, name, inner)


P4_PILLS = ["Free consultation", "3D scan", "12-month guarantee"]


def p4(size):
    """VT-02 Lifestyle lower third: the real surgery full bleed, scrim, lower-third offer."""
    name = f"{IMP} | Static | Practice photo | What's included"
    pills = lambda fs: "".join(usp_pill(t, fs) for t in P4_PILLS)
    if size == "ls":
        inner = f"""{photo('surgery.jpg', 0, 0, 1200, 628, .55, .5)}
<div class="abs" data-name="Overlay" style="inset:0;background:linear-gradient(90deg,rgba(46,44,43,.93) 0%,rgba(46,44,43,.8) 45%,rgba(46,44,43,.05) 80%)"></div>
<div class="abs" style="left:56px;top:46px">{logo(150, 'cream', 'horizontal')}</div>
<div class="abs hl" style="left:56px;top:140px;width:560px;font-size:50px;color:{LINEN}">One Price. <b>Implant And Crown.</b></div>
<div class="abs" style="left:56px;top:290px;display:flex;align-items:baseline;gap:10px"><span class="body" style="font-size:18px;color:{STONE}">from</span><span class="hl" style="font-size:72px;color:{GOLD};line-height:1">£2,500</span></div>
<div class="abs" style="left:56px;top:400px;display:flex;gap:10px">{pills(14)}</div>
<div class="abs" style="left:56px;top:480px;display:flex;align-items:center;gap:24px">{cta(CTA_CONSULT, 17)}{proof(13, LINEN)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    H = 1920 if s9 else 1080
    t = 1060 if s9 else 560
    inner = f"""{photo('surgery.jpg', 0, 0, 1080, H, .55 if s9 else .5, .5)}
<div class="abs" data-name="Overlay" style="inset:0;background:linear-gradient(180deg,rgba(46,44,43,.35) 0%,rgba(46,44,43,0) 25%,rgba(46,44,43,.55) {48 if s9 else 42}%,rgba(46,44,43,.94) {64 if s9 else 62}%)"></div>
<div class="abs" style="left:{80 if s9 else 70}px;top:{270 if s9 else 56}px">{logo(190 if s9 else 170, 'cream', 'horizontal')}</div>
<div class="abs hl" style="left:{80 if s9 else 70}px;top:{t}px;width:920px;font-size:{86 if s9 else 72}px;color:{LINEN}">One Price. <b>Implant And Crown.</b></div>
<div class="abs" style="left:{80 if s9 else 70}px;top:{t + (220 if s9 else 100)}px;display:flex;align-items:baseline;gap:14px"><span class="body" style="font-size:{28 if s9 else 24}px;color:{STONE}">from</span><span class="hl" style="font-size:{130 if s9 else 104}px;color:{GOLD};line-height:1">£2,500</span></div>
<div class="abs" style="left:{80 if s9 else 70}px;top:{t + (390 if s9 else 240)}px;display:flex;gap:12px;flex-wrap:wrap;width:920px">{pills(24 if s9 else 19)}</div>
<div class="abs" style="left:{80 if s9 else 70}px;top:{t + (480 if s9 else 330)}px;display:flex;align-items:center;gap:30px">{cta(CTA_CONSULT, 24 if s9 else 21)}{proof(17 if s9 else 15, LINEN)}</div>"""
    return board(size, name, inner)


P5_CALLOUTS = ["3D scan of your jaw", "Shows the bone before we quote", "Written plan with the full cost"]


def callout(text, fs, w):
    return (f'<div style="width:{w}px;padding:{fs * .75:.0f}px {fs:.0f}px;border-radius:{fs * .6:.0f}px;background:#FCFAF6;border-left:{fs * .25:.0f}px solid {GOLD};'
            f'box-shadow:0 {fs * .4:.0f}px {fs * 1.2:.0f}px rgba(46,44,43,.18);font-family:Montserrat;font-weight:500;font-size:{fs:.0f}px;line-height:1.3;color:{INK}">{text}</div>')


def leader(x1, y1, x2, y2):
    """A thin gold leader line from (x1,y1) to a dot at (x2,y2)."""
    import math
    L = math.hypot(x2 - x1, y2 - y1)
    a = math.degrees(math.atan2(y2 - y1, x2 - x1))
    return (f'<div class="abs" style="left:{x1}px;top:{y1}px;width:{L:.0f}px;height:2px;background:{GOLD};transform-origin:0 50%;transform:rotate({a:.1f}deg)"></div>'
            f'<div class="abs" style="left:{x2 - 9}px;top:{y2 - 9}px;width:18px;height:18px;border-radius:50%;background:{GOLD};box-shadow:0 0 0 6px rgba(190,161,122,.3)"></div>')


def p5(size):
    """VT-23 Annotated callouts on the real 3D scanner."""
    name = f"{IMP} | Static | Practice photo | Starts with a scan"
    if size == "ls":
        inner = f"""{photo('cbct.jpg', 0, 0, 460, 628, .4, .45)}
<div class="abs" style="left:520px;top:46px">{logo(150, 'charcoal', 'horizontal')}</div>
<div class="abs hl" style="left:520px;top:120px;width:640px;font-size:44px">Your Implant Starts <b>With A Scan.</b></div>
<div class="abs" style="left:520px;top:250px">{callout(P5_CALLOUTS[0], 17, 300)}</div>
<div class="abs" style="left:840px;top:250px">{callout(P5_CALLOUTS[1], 17, 320)}</div>
<div class="abs" style="left:520px;top:340px">{callout(P5_CALLOUTS[2], 17, 300)}</div>
{leader(520, 275, 300, 180)}
<div class="abs" style="left:840px;top:350px"><span class="body" style="font-size:17px;color:{INK}">From <b class="hl" style="font-weight:400;color:{GOLD};font-size:34px">£2,500</b>, crown included</span></div>
<div class="abs" style="left:520px;top:470px;display:flex;align-items:center;gap:24px">{cta(CTA_CONSULT, 17)}{proof(13)}</div>"""
        return board(size, name, inner, bg=PAPER)
    s9 = size == "s9"
    if s9:
        inner = f"""{photo('cbct.jpg', 0, 0, 1080, 1920, .42, .5, 1.15)}
<div class="abs" data-name="Overlay" style="inset:0;background:linear-gradient(180deg,rgba(244,240,239,.96) 0%,rgba(244,240,239,.94) 26%,rgba(244,240,239,0) 40%,rgba(244,240,239,0) 62%,rgba(244,240,239,.94) 78%)"></div>
<div class="abs" style="left:80px;top:270px">{logo(190, 'charcoal', 'horizontal')}</div>
<div class="abs hl" style="left:80px;top:380px;width:920px;font-size:76px">Your Implant Starts <b>With A Scan.</b></div>
<div class="abs" style="left:600px;top:700px">{callout(P5_CALLOUTS[0], 26, 400)}</div>
<div class="abs" style="left:600px;top:880px">{callout(P5_CALLOUTS[1], 26, 400)}</div>
<div class="abs" style="left:600px;top:1100px">{callout(P5_CALLOUTS[2], 26, 400)}</div>
{leader(600, 735, 470, 690)}{leader(600, 935, 470, 960)}
<div class="abs" style="left:80px;top:1360px"><span class="body" style="font-size:28px;color:{INK}">From <b class="hl" style="font-weight:400;color:{GOLD};font-size:64px">£2,500</b>, crown included</span></div>
<div class="abs" style="left:80px;top:1480px;display:flex;align-items:center;gap:30px">{cta(CTA_CONSULT, 24)}{proof(17)}</div>"""
        return board(size, name, inner, bg=PAPER)
    inner = f"""{photo('cbct.jpg', 0, 0, 520, 1080, .42, .45)}
<div class="abs" style="left:580px;top:60px">{logo(170, 'charcoal', 'horizontal')}</div>
<div class="abs hl" style="left:580px;top:160px;width:440px;font-size:64px">Your Implant Starts <b>With A Scan.</b></div>
<div class="abs" style="left:580px;top:420px">{callout(P5_CALLOUTS[0], 22, 420)}</div>
<div class="abs" style="left:580px;top:530px">{callout(P5_CALLOUTS[1], 22, 420)}</div>
<div class="abs" style="left:580px;top:640px">{callout(P5_CALLOUTS[2], 22, 420)}</div>
{leader(580, 450, 330, 300)}
<div class="abs" style="left:580px;top:770px"><span class="body" style="font-size:22px;color:{INK}">From <b class="hl" style="font-weight:400;color:{GOLD};font-size:52px">£2,500</b>, crown included</span></div>
<div class="abs" style="left:580px;top:880px">{cta(CTA_CONSULT, 21)}</div>
<div class="abs" style="left:580px;top:990px">{proof(15)}</div>"""
    return board(size, name, inner, bg=PAPER)


# ---------------------------------------------------------------- GEOFF (failing teeth, full arch)
MOSAIC = [("Tegan-Lewis-Dental-Nurse.jpg", .5, .35), ("surgery.jpg", .55, .5), ("P1217728.jpg", .5, .35),
          ("cbct.jpg", .42, .45), ("P1080465.jpg", .5, .35), ("consult-room.jpg", .45, .5)]


def mosaic(x, y, cols, cw, ch, gap):
    out = []
    for i, (src, fx, fy) in enumerate(MOSAIC):
        r, c = divmod(i, cols)
        out.append(photo(src, x + c * (cw + gap), y + r * (ch + gap), cw, ch, fx, fy, radius=round(min(cw, ch) * .08),
                         extra="box-shadow:0 14px 34px rgba(0,0,0,.3);"))
    return "".join(out)


def arch_price(fs, col=STONE):
    return (f'<div style="display:flex;align-items:baseline;gap:{fs * .25:.0f}px;white-space:nowrap"><span class="body" style="font-size:{fs * .42:.0f}px;color:{col}">Full-arch implants from</span>'
            f'<span class="hl" style="font-size:{fs:.0f}px;line-height:1;color:{GOLD}">£15,000</span><span class="body" style="font-size:{fs * .42:.0f}px;color:{col}">per arch</span></div>')


def g1(size):
    """VT-13 Team mosaic: six real practice and team photos with the headline."""
    name = f"{IMP} | Static | Team photo | The team"
    if size == "ls":
        inner = f"""{mosaic(560, 40, 3, 184, 266, 12)}
<div class="abs" style="left:56px;top:46px">{logo(150, 'cream', 'horizontal')}</div>
<div class="abs hl" style="left:56px;top:140px;width:460px;font-size:48px;color:{LINEN}">The Team Behind <b>Your New Teeth.</b></div>
<div class="abs body" style="left:56px;top:300px;width:450px;font-size:17px">Full-arch implants, planned and looked after in Norwich.</div>
<div class="abs" style="left:56px;top:380px">{arch_price(36)}</div>
<div class="abs" style="left:56px;top:470px">{cta(CTA_CONSULT, 17)}</div>
<div class="abs" style="left:56px;top:560px">{proof(13, LINEN)}</div>"""
        return board(size, name, inner, bg="char")
    s9 = size == "s9"
    if s9:
        inner = f"""<div class="abs" style="left:80px;top:260px">{logo(190, 'cream', 'horizontal')}</div>
<div class="abs hl" style="left:80px;top:360px;width:920px;font-size:84px;color:{LINEN}">The Team Behind <b>Your New Teeth.</b></div>
{mosaic(80, 600, 2, 452, 250, 16)}
<div class="abs body" style="left:80px;top:1440px;width:920px;font-size:26px">Full-arch implants, planned and looked after in Norwich.</div>
<div class="abs" style="left:80px;top:1500px;display:flex;align-items:center;gap:30px">{cta(CTA_CONSULT, 24)}{proof(17, LINEN)}</div>"""
        return board(size, name, inner, bg="char")
    inner = f"""<div class="abs" style="left:70px;top:56px">{logo(170, 'cream', 'horizontal')}</div>
<div class="abs hl" style="left:70px;top:130px;width:940px;font-size:66px;color:{LINEN}">The Team Behind <b>Your New Teeth.</b></div>
{mosaic(70, 330, 3, 302, 260, 17)}
<div class="abs body" style="left:70px;top:900px;width:600px;font-size:21px">Planned and looked after in Norwich.</div>
<div class="abs" style="left:70px;top:960px;display:flex;align-items:center;gap:30px">{cta(CTA_CONSULT, 21)}{proof(15, LINEN)}</div>"""
    return board(size, name, inner, bg="char")


def g2(size):
    """Custom: type-led price on Charcoal, gold rule, monogram watermark, circle of the consult room."""
    name = f"{IMP} | Static | Typographic | The real price"
    big = lambda fs: (f'<div class="eyebrow" style="font-size:{fs * .13:.0f}px">Full-arch implants</div>'
                      f'<div class="hl" style="font-size:{fs * .3:.0f}px;color:{LINEN};margin-top:{fs * .1:.0f}px">from</div>'
                      f'<div class="hl" style="font-size:{fs:.0f}px;line-height:.9;color:{GOLD};white-space:nowrap">£15,000</div>'
                      f'<div class="hl" style="font-size:{fs * .36:.0f}px;color:{LINEN};margin-top:{fs * .05:.0f}px">per arch.</div>')
    if size == "ls":
        inner = f"""{mono(560, 'cream', 'position:absolute;left:760px;top:-60px;opacity:.06')}
{circle('consult-room.jpg', 860, 170, 300, .45, .5, disc=(0, 210, 70))}
<div class="abs" style="left:56px;top:46px">{logo(150, 'cream', 'horizontal')}</div>
<div class="abs" style="left:56px;top:120px">{big(150)}</div>
<div class="abs rule" style="left:56px;top:425px;width:80px"></div>
<div class="abs body" style="left:56px;top:445px;width:620px;font-size:17px">Free consultation with a 3D scan and a written plan.</div>
<div class="abs" style="left:56px;top:510px;display:flex;align-items:center;gap:24px">{cta(CTA_CONSULT, 17)}{proof(13, LINEN)}</div>"""
        return board(size, name, inner, bg="char")
    s9 = size == "s9"
    if s9:
        inner = f"""{mono(1100, 'cream', 'position:absolute;left:200px;top:300px;opacity:.06')}
<div class="abs" style="left:80px;top:270px">{logo(120, 'cream')}</div>
<div class="abs" style="left:80px;top:500px">{big(270)}</div>
<div class="abs rule" style="left:80px;top:1060px;width:110px"></div>
<div class="abs body" style="left:80px;top:1100px;width:520px;font-size:28px">Free consultation with a 3D scan and a written plan.</div>
{circle('consult-room.jpg', 640, 1060, 360, .45, .5, disc=(270, 260, 90))}
<div class="abs" style="left:80px;top:1260px">{proof(18, LINEN)}</div>
<div class="abs" style="left:80px;top:1340px">{cta(CTA_CONSULT, 25)}</div>"""
        return board(size, name, inner, bg="char")
    inner = f"""{mono(820, 'cream', 'position:absolute;left:420px;top:240px;opacity:.06')}
<div class="abs" style="left:70px;top:70px">{logo(100, 'cream')}</div>
<div class="abs" style="left:70px;top:250px">{big(220)}</div>
<div class="abs rule" style="left:70px;top:700px;width:90px"></div>
<div class="abs body" style="left:70px;top:730px;width:560px;font-size:24px">Free consultation with a 3D scan and a written plan.</div>
{circle('consult-room.jpg', 700, 620, 320, .45, .5, disc=(0, 230, 76))}
<div class="abs" style="left:70px;top:840px">{cta(CTA_CONSULT, 22)}</div>
<div class="abs" style="left:70px;top:960px">{proof(17, LINEN)}</div>"""
    return board(size, name, inner, bg="char")


G3_QS = ["Can I see my 3D scan?", "What's the full price, in writing?", "Who looks after it afterwards?", "How many appointments, and where?", "Could I leave with teeth the same day?"]


def q_card(w, fs, rot=-1.2):
    rows = "".join(f'<div style="display:flex;align-items:baseline;gap:{fs * .8:.0f}px;padding:{fs * .62:.0f}px 0;border-bottom:1.5px solid rgba(190,161,122,.4)">'
                   f'<span class="hl" style="font-size:{fs * 1.4:.0f}px;color:{GOLD};width:{fs * 1.2:.0f}px;flex:none">{i + 1}</span>'
                   f'<span style="font-family:Montserrat;font-weight:500;font-size:{fs:.0f}px;line-height:1.3;color:{INK}">{q}</span></div>' for i, q in enumerate(G3_QS))
    return (f'<div style="width:{w}px;padding:{fs * 1.3:.0f}px {fs * 1.4:.0f}px {fs:.0f}px;background:#FCFAF6;transform:rotate({rot}deg);'
            f'box-shadow:0 {fs * .9:.0f}px {fs * 2.4:.0f}px rgba(46,36,24,.28),0 2px 4px rgba(46,36,24,.15)">'
            f'<div style="display:flex;justify-content:space-between;align-items:center">{logo(round(fs * 8), "charcoal", "horizontal")}<span class="eyebrow" style="font-size:{fs * .55:.0f}px">Before you decide</span></div>'
            f'<div style="margin-top:{fs * .3:.0f}px">{rows}</div></div>')


def g3(size):
    """Custom: a printed question card on Linen with a circle of the real 3D scanner."""
    name = f"{IMP} | Static | Typographic | Questions worth asking"
    if size == "ls":
        inner = f"""{circle('cbct.jpg', 1010, -70, 260, .42, .4, disc=(10, 180, 50))}
<div class="abs hl" style="left:56px;top:60px;width:440px;font-size:46px">Five Questions To Ask <b>Before Full-Arch Implants.</b></div>
<div class="abs" style="left:56px;top:330px">{cta(CTA_CONSULT, 17)}</div>
<div class="abs" style="left:56px;top:420px">{proof(14)}</div>
<div class="abs" style="left:56px;top:520px">{logo(170, 'charcoal', 'horizontal')}</div>
<div class="abs" style="left:560px;top:50px">{q_card(560, 17)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    if s9:
        inner = f"""{circle('cbct.jpg', 740, 200, 300, .42, .4, disc=(0, 210, 60))}
<div class="abs" style="left:80px;top:270px">{logo(120)}</div>
<div class="abs hl" style="left:80px;top:540px;width:920px;font-size:78px">Five Questions To Ask <b>Before Full-Arch Implants.</b></div>
<div class="abs" style="left:90px;top:800px">{q_card(900, 28)}</div>
<div class="abs" style="left:80px;top:1480px;display:flex;align-items:center;gap:30px">{cta(CTA_CONSULT, 24)}{proof(17)}</div>"""
        return board(size, name, inner)
    inner = f"""{circle('cbct.jpg', 790, -90, 380, .42, .4, disc=(20, 270, 70))}
<div class="abs hl" style="left:70px;top:70px;width:700px;font-size:62px">Five Questions To Ask <b>Before Full-Arch Implants.</b></div>
<div class="abs" style="left:80px;top:280px">{q_card(920, 23)}</div>
<div class="abs" style="left:70px;top:930px;display:flex;align-items:center;gap:30px">{cta(CTA_CONSULT, 22)}{proof(17)}</div>"""
    return board(size, name, inner)


G4_PROBLEMS = ["Teeth that wobble when you bite", "Infections that keep coming back", "Cutting everything up small"]
G4_HEAD = "One Fixed Arch <b>Of New Teeth.</b>"


def g4(size):
    """VT-30 Problem and solution: three problems on Charcoal, arrow chip, solution over the consult room."""
    name = f"{IMP} | Static | Practice photo | Loose teeth"
    if size == "ls":
        inner = f"""{photo('consult-room.jpg', 560, 0, 640, 628, .45, .5)}
<div class="abs" data-name="Overlay" style="left:560px;top:0;width:640px;height:628px;background:linear-gradient(180deg,rgba(46,44,43,.25) 0%,rgba(46,44,43,.85) 45%,rgba(46,44,43,.92) 100%)"></div>
<div class="abs" style="left:48px;top:40px">{logo(150, 'cream', 'horizontal')}</div>
<div class="abs" style="left:48px;top:120px">{problems(20, 470, G4_PROBLEMS, "Sound familiar?")}</div>
<div class="abs" style="left:48px;top:500px">{cta(CTA_CONSULT, 17)}</div>
<div class="abs" style="left:530px;top:280px">{arrow_chip(60, 'right')}</div>
<div class="abs" style="left:610px;top:290px;width:560px">{solution(40, G4_HEAD, arch_price(28))}</div>"""
        return board(size, name, inner, bg="char")
    s9 = size == "s9"
    split = 1000 if s9 else 560
    inner = f"""{photo('consult-room.jpg', 0, split, 1080, (1920 if s9 else 1080) - split, .45, .5)}
<div class="abs" data-name="Overlay" style="left:0;top:{split}px;width:1080px;height:{(1920 if s9 else 1080) - split}px;background:linear-gradient(180deg,rgba(46,44,43,.05) 0%,rgba(46,44,43,.88) {65 if s9 else 70}%)"></div>
<div class="abs rule" style="left:0;right:0;top:{split}px;opacity:1"></div>
<div class="abs" style="left:{80 if s9 else 70}px;top:{270 if s9 else 50}px">{logo(190 if s9 else 160, 'cream', 'horizontal')}</div>
<div class="abs" style="left:{80 if s9 else 70}px;top:{430 if s9 else 140}px">{problems(34 if s9 else 27, 900, G4_PROBLEMS)}</div>
<div class="abs" style="left:{880 if s9 else 900}px;top:{split - 55}px">{arrow_chip(110 if s9 else 96)}</div>
<div class="abs" style="left:{80 if s9 else 70}px;top:{1180 if s9 else 690}px;width:920px">{solution(84 if s9 else 62, G4_HEAD, arch_price(58 if s9 else 44))}</div>
<div class="abs" style="left:{80 if s9 else 70}px;top:{1490 if s9 else 960}px;display:flex;align-items:center;gap:28px">{cta(CTA_CONSULT, 24 if s9 else 19)}{proof(17 if s9 else 14, LINEN)}</div>"""
    return board(size, name, inner, bg="char")


def g5(size):
    """VT-11 Statement: the real reception full bleed, warm scrim, gold rules and one large statement."""
    name = f"{IMP} | Static | Practice photo | Often the same day"
    stmt = lambda fs: f'<div class="hl" style="font-size:{fs}px;color:{LINEN};text-align:center">Walk In With Failing Teeth.<br><b>Often, Walk Out With New Ones.</b></div>'
    if size == "ls":
        inner = f"""{photo('reception-front.jpg', 0, 0, 1200, 628, .55, .5)}
<div class="abs" data-name="Overlay" style="inset:0;background:rgba(46,44,43,.78)"></div>
<div class="abs" style="left:0;right:0;top:40px;display:flex;justify-content:center">{logo(170, 'cream', 'horizontal')}</div>
<div class="abs rule" style="left:520px;width:160px;top:130px"></div>
<div class="abs" style="left:80px;right:80px;top:165px">{stmt(48)}</div>
<div class="abs rule" style="left:520px;width:160px;top:320px"></div>
<div class="abs" style="left:0;right:0;top:360px;display:flex;justify-content:center">{arch_price(34)}</div>
<div class="abs" style="left:0;right:0;top:450px;display:flex;justify-content:center;align-items:center;gap:24px">{cta(CTA_CONSULT, 17)}{proof(13, LINEN)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    H = 1920 if s9 else 1080
    inner = f"""{photo('DJI_20260322152923_0097_D-scaled.jpg' if s9 else 'reception-front.jpg', 0, 0, 1080, H, .5, .45 if s9 else .5)}
<div class="abs" data-name="Overlay" style="inset:0;background:linear-gradient(180deg,rgba(46,44,43,.7),rgba(46,44,43,.82) 50%,rgba(46,44,43,.9))"></div>
<div class="abs" style="left:0;right:0;top:{270 if s9 else 70}px;display:flex;justify-content:center">{logo(130 if s9 else 110, 'cream')}</div>
<div class="abs rule" style="left:440px;width:200px;top:{620 if s9 else 300}px"></div>
<div class="abs" style="left:70px;right:70px;top:{680 if s9 else 340}px">{stmt(92 if s9 else 70)}</div>
<div class="abs rule" style="left:440px;width:200px;top:{1110 if s9 else 660}px"></div>
<div class="abs" style="left:0;right:0;top:{1170 if s9 else 710}px;display:flex;justify-content:center">{arch_price(60 if s9 else 50)}</div>
<div class="abs" style="left:0;right:0;top:{1330 if s9 else 840}px;display:flex;justify-content:center">{cta(CTA_CONSULT, 25 if s9 else 22)}</div>
<div class="abs" style="left:0;right:0;top:{1460 if s9 else 960}px;display:flex;justify-content:center">{proof(18 if s9 else 16, LINEN)}</div>"""
    return board(size, name, inner)


# ---------------------------------------------------------------- LINDA (a denture that's never felt right)
DENT = "Dentures"
CTA_DENT = "Book a denture appointment"
L1_FOODS = ["Crusty bread", "Steak", "An apple", "Corn on the cob"]


def menu_card(w, fs, rot=-2):
    items = "".join(f'<div style="position:relative;display:inline-block;margin-top:{fs * .55:.0f}px"><span class="hl" style="font-size:{fs:.0f}px;color:{INK}">{t}</span>'
                    f'<span style="position:absolute;left:-{fs * .2:.0f}px;right:-{fs * .2:.0f}px;top:52%;height:{fs * .12:.0f}px;border-radius:{fs * .1:.0f}px;background:{GOLD};transform:rotate({-3 + (i % 2) * 4}deg)"></span></div><br>'
                    for i, t in enumerate(L1_FOODS))
    return (f'<div style="width:{w}px;padding:{fs * 1.3:.0f}px {fs:.0f}px {fs * 1.2:.0f}px;background:#FCFAF6;transform:rotate({rot}deg);text-align:center;'
            f'box-shadow:0 {fs * .6:.0f}px {fs * 1.6:.0f}px rgba(46,36,24,.28),0 2px 4px rgba(46,36,24,.15)">'
            f'<div style="border:1.5px solid rgba(190,161,122,.55);position:absolute;inset:{fs * .4:.0f}px;pointer-events:none"></div>'
            f'<div class="eyebrow" style="font-size:{fs * .42:.0f}px">Tonight\'s menu</div>'
            f'<div style="width:{fs * 2:.0f}px;height:1.5px;background:{GOLD};margin:{fs * .5:.0f}px auto 0"></div>{items}'
            '</div>')


def dent_price(fs, col=GREY):
    return (f'<div style="display:flex;align-items:baseline;gap:{fs * .25:.0f}px;flex-wrap:wrap;white-space:nowrap">'
            f'<span class="body" style="font-size:{fs * .42:.0f}px;color:{col}">Relines</span><span class="hl" style="font-size:{fs:.0f}px;line-height:1;color:{GOLD}">£90</span>'
            f'<span class="body" style="font-size:{fs * .42:.0f}px;color:{col};margin-left:{fs * .3:.0f}px">New dentures from</span><span class="hl" style="font-size:{fs:.0f}px;line-height:1;color:{GOLD}">£800</span></div>')


def l1(size):
    """Custom: a printed menu card with the foods she's given up crossed through in gold."""
    name = f"{DENT} | Static | Object | Off the menu"
    if size == "ls":
        inner = f"""<div class="abs" style="left:56px;top:46px">{logo(150, 'charcoal', 'horizontal')}</div>
<div class="abs hl" style="left:56px;top:140px;width:560px;font-size:54px">Has Your Denture <b>Changed The Menu?</b></div>
<div class="abs" style="left:56px;top:310px">{dent_price(36)}</div>
<div class="abs" style="left:56px;top:400px">{cta(CTA_DENT, 18)}</div>
<div class="abs" style="left:56px;top:510px">{proof(15)}</div>
<div class="abs" style="left:770px;top:40px">{menu_card(360, 34)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    if s9:
        inner = f"""<div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(120)}</div>
<div class="abs hl" style="left:80px;right:80px;top:470px;text-align:center;font-size:88px">Has Your Denture <b>Changed The Menu?</b></div>
<div class="abs" style="left:250px;top:720px">{menu_card(580, 52)}</div>
<div class="abs" style="left:0;right:0;top:1360px;display:flex;justify-content:center">{dent_price(52)}</div>
<div class="abs" style="left:0;right:0;top:1460px;display:flex;justify-content:center;align-items:center;gap:30px">{cta(CTA_DENT, 24)}{proof(17)}</div>"""
        return board(size, name, inner)
    inner = f"""<div class="abs" style="left:70px;top:70px">{logo(170, 'charcoal', 'horizontal')}</div>
<div class="abs hl" style="left:70px;top:190px;width:520px;font-size:78px">Has Your Denture <b>Changed The Menu?</b></div>
<div class="abs" style="left:70px;top:600px;width:500px">{dent_price(46)}</div>
<div class="abs" style="left:70px;top:720px">{cta(CTA_DENT, 22)}</div>
<div class="abs" style="left:70px;top:845px">{proof(17)}</div>
<div class="abs" style="left:610px;top:180px">{menu_card(400, 44)}</div>"""
    return board(size, name, inner)


L2_TICKS = ["Reline for a better fit · <b style='color:#BEA17A;font-weight:600'>£90</b>", "Repair a crack or chip · <b style='color:#BEA17A;font-weight:600'>£150</b>",
            "New full denture · <b style='color:#BEA17A;font-weight:600'>from £800</b> per arch"]


def l2(size):
    """VT-07 Three reasons: capsule of the consult room on a Linen half-capsule block, three priced options, review bar."""
    name = f"{DENT} | Static | Practice photo | Three ways to sort it"
    if size == "ls":
        inner = f"""{capsule('consult-room.jpg', 900, 40, 250, 548, .5, .5)}
<div class="abs hl" style="left:56px;top:44px;width:800px;font-size:44px">Denture Not Fitting? <b>Three Ways To Sort It.</b></div>
<div class="abs" style="left:56px;top:190px">{ticks(L2_TICKS, 21, 22)}</div>
<div class="abs" style="left:56px;top:415px">{review_bar(800, 16, CTA_DENT)}</div>
<div class="abs" style="left:56px;top:520px">{logo(170, 'charcoal', 'horizontal')}</div>"""
        return board(size, name, inner, bg=PAPER)
    s9 = size == "s9"
    if s9:
        inner = f"""<div class="abs" style="left:80px;top:270px">{logo(110)}</div>
<div class="abs hl" style="left:80px;top:470px;width:920px;font-size:88px">Denture Not Fitting? <b>Three Ways To Sort It.</b></div>
<div class="abs" style="left:610px;top:720px;width:470px;height:680px;background:{LINEN};border-radius:340px 0 0 340px"></div>
{capsule('consult-room.jpg', 650, 760, 360, 620, .5, .5)}
<div class="abs" style="left:80px;top:800px;width:560px">{ticks(L2_TICKS, 30, 60)}</div>
<div class="abs" style="left:80px;top:1440px">{review_bar(920, 21, CTA_DENT)}</div>"""
        return board(size, name, inner, bg=PAPER)
    inner = f"""<div class="abs hl" style="left:70px;top:80px;width:940px;font-size:74px">Denture Not Fitting? <b>Three Ways To Sort It.</b></div>
<div class="abs" style="left:640px;top:250px;width:440px;height:600px;background:{LINEN};border-radius:300px 0 0 300px"></div>
{capsule('consult-room.jpg', 690, 280, 340, 570, .5, .5)}
<div class="abs" style="left:70px;top:340px;width:580px">{ticks(L2_TICKS, 27, 56)}</div>
<div class="abs" style="left:70px;top:880px">{review_bar(940, 19, CTA_DENT)}</div>
<div class="abs" style="left:70px;top:985px">{logo(190, 'charcoal', 'horizontal')}</div>"""
    return board(size, name, inner, bg=PAPER)


def l3(size):
    """VT-04 Side column: Charcoal column with the soft question and prices, beside the real consult room."""
    name = f"{DENT} | Static | Practice photo | Still putting up with it"
    hl = lambda fs: f'<div class="hl" style="font-size:{fs}px;color:{LINEN}">Still Putting Up With <b>Your Denture?</b></div>'
    if size == "ls":
        inner = f"""{photo('consult-room.jpg', 560, 0, 640, 628, .5, .5)}
<div class="abs" data-name="Overlay" style="left:400px;top:0;width:320px;height:628px;background:linear-gradient(90deg,{CHAR} 50%,rgba(46,44,43,0))"></div>
<div class="abs" style="left:0;top:0;width:480px;height:628px;background:{CHAR}"></div>
<div class="abs" style="left:56px;top:48px">{logo(150, 'cream', 'horizontal')}</div>
<div class="abs" style="left:56px;top:140px;width:540px">{hl(54)}</div>
<div class="abs rule" style="left:56px;top:300px;width:70px"></div>
<div class="abs" style="left:56px;top:330px">{dent_price(38, STONE)}</div>
<div class="abs" style="left:56px;top:440px">{cta(CTA_DENT, 18)}</div>
<div class="abs" style="left:56px;top:540px">{proof(13, LINEN)}</div>"""
        return board(size, name, inner, bg="char")
    s9 = size == "s9"
    if s9:
        inner = f"""{photo('reception-side.jpg', 380, 0, 700, 1920, .5, .5)}
<div class="abs" data-name="Overlay" style="left:0;top:0;width:1080px;height:1920px;background:linear-gradient(90deg,{CHAR} 45%,rgba(46,44,43,.6) 62%,rgba(46,44,43,0) 85%)"></div>
<div class="abs" style="left:80px;top:270px">{logo(130, 'cream')}</div>
<div class="abs" style="left:80px;top:620px;width:660px">{hl(100)}</div>
<div class="abs rule" style="left:80px;top:990px;width:90px"></div>
<div class="abs" style="left:80px;top:1030px;width:600px">{dent_price(66, STONE)}</div>
<div class="abs" style="left:80px;top:1260px">{cta(CTA_DENT, 26)}</div>
<div class="abs" style="left:80px;top:1400px">{proof(19, LINEN)}</div>"""
        return board(size, name, inner, bg="char")
    inner = f"""{photo('consult-room.jpg', 430, 0, 650, 1080, .45, .5)}
<div class="abs" data-name="Overlay" style="left:0;top:0;width:1080px;height:1080px;background:linear-gradient(90deg,{CHAR} 42%,rgba(46,44,43,.5) 60%,rgba(46,44,43,0) 82%)"></div>
<div class="abs" style="left:70px;top:70px">{logo(170, 'cream', 'horizontal')}</div>
<div class="abs" style="left:70px;top:220px;width:620px">{hl(86)}</div>
<div class="abs rule" style="left:70px;top:540px;width:80px"></div>
<div class="abs" style="left:70px;top:580px;width:560px">{dent_price(54, STONE)}</div>
<div class="abs" style="left:70px;top:780px">{cta(CTA_DENT, 23)}</div>
<div class="abs" style="left:70px;top:910px">{proof(17, LINEN)}</div>"""
    return board(size, name, inner, bg="char")


L4_STEPS = [("Assessment", "We check your mouth, gums and current denture"), ("Digital impressions", "Made to the shape of your mouth as it is now"),
            ("Fitting", "Adjusted for comfort and a natural bite"), ("Follow-ups", "We see you again as you settle in")]


def steps(w, fs):
    items = "".join(f'<div style="display:flex;gap:{fs * 1.1:.0f}px;align-items:flex-start;margin-top:{fs * 1.2 if i else 0:.0f}px;position:relative">'
                    f'<div style="width:{fs * 2.2:.0f}px;height:{fs * 2.2:.0f}px;border-radius:50%;flex:none;border:1.5px solid {GOLD};background:{CHAR};display:flex;align-items:center;justify-content:center;font-family:\'Mongolian Baiti\';font-size:{fs * 1.2:.0f}px;color:{GOLD}">{i + 1}</div>'
                    f'<div><div class="hl" style="font-size:{fs * 1.35:.0f}px;color:{LINEN};line-height:1.1">{a}</div><div class="body" style="font-size:{fs * .85:.0f}px;margin-top:{fs * .25:.0f}px">{b}</div></div></div>'
                    for i, (a, b) in enumerate(L4_STEPS))
    return f'<div style="position:relative;width:{w}px"><div style="position:absolute;left:{fs * 1.1 - 1:.0f}px;top:{fs:.0f}px;bottom:{fs * 2:.0f}px;width:1.5px;background:rgba(190,161,122,.5)"></div>{items}</div>'


def l4(size):
    """Custom: four numbered steps down a gold line on Charcoal, monogram watermark, circle of the surgery."""
    name = f"{DENT} | Static | Typographic | Made to fit"
    pr = lambda fs: (f'<div style="display:flex;align-items:baseline;gap:{fs * .25:.0f}px;white-space:nowrap"><span class="body" style="font-size:{fs * .42:.0f}px;color:{STONE}">New full dentures from</span>'
                     f'<span class="hl" style="font-size:{fs:.0f}px;line-height:1;color:{GOLD}">£800</span><span class="body" style="font-size:{fs * .42:.0f}px;color:{STONE}">per arch</span></div>')
    if size == "ls":
        inner = f"""{mono(560, 'cream', 'position:absolute;left:760px;top:-60px;opacity:.06')}
<div class="abs" style="left:56px;top:46px">{logo(150, 'cream', 'horizontal')}</div>
<div class="abs hl" style="left:56px;top:130px;width:460px;font-size:52px;color:{LINEN}">New Dentures, <b>Made To Fit.</b></div>
<div class="abs" style="left:56px;top:300px">{pr(40)}</div>
<div class="abs" style="left:56px;top:400px">{cta(CTA_DENT, 17)}</div>
<div class="abs" style="left:56px;top:500px">{proof(13, LINEN)}</div>
<div class="abs" style="left:620px;top:60px">{steps(540, 18)}</div>"""
        return board(size, name, inner, bg="char")
    s9 = size == "s9"
    if s9:
        inner = f"""{mono(1100, 'cream', 'position:absolute;left:200px;top:300px;opacity:.06')}
<div class="abs" style="left:80px;top:270px">{logo(120, 'cream')}</div>
{circle('surgery.jpg', 700, 230, 300, .55, .5, disc=(0, 210, 60))}
<div class="abs hl" style="left:80px;top:560px;width:900px;font-size:100px;color:{LINEN}">New Dentures, <b>Made To Fit.</b></div>
<div class="abs" style="left:80px;top:830px">{steps(900, 30)}</div>
<div class="abs" style="left:80px;top:1360px">{pr(62)}</div>
<div class="abs" style="left:80px;top:1470px;display:flex;align-items:center;gap:30px">{cta(CTA_DENT, 24)}{proof(17, LINEN)}</div>"""
        return board(size, name, inner, bg="char")
    inner = f"""{mono(820, 'cream', 'position:absolute;left:420px;top:240px;opacity:.06')}
{circle('surgery.jpg', 790, -90, 380, .55, .5, disc=(20, 270, 70))}
<div class="abs" style="left:70px;top:70px">{logo(170, 'cream', 'horizontal')}</div>
<div class="abs hl" style="left:70px;top:160px;width:700px;font-size:76px;color:{LINEN}">New Dentures, <b>Made To Fit.</b></div>
<div class="abs" style="left:70px;top:370px">{steps(900, 23)}</div>
<div class="abs" style="left:70px;top:840px">{pr(50)}</div>
<div class="abs" style="left:70px;top:950px;display:flex;align-items:center;gap:30px">{cta(CTA_DENT, 21)}{proof(15, LINEN)}</div>"""
    return board(size, name, inner, bg="char")


def l5(size):
    """VT-29 Search bar: 'denture keeps rubbing' over the real reception, Iconic result card with relines from £90."""
    name = f"{DENT} | Static | Practice photo | Search"
    q, note_ = "denture keeps rubbing", "Denture relines from £90"
    if size == "ls":
        inner = f"""{photo('reception-side.jpg', 0, 0, 1200, 628, .5, .5)}
<div class="abs" data-name="Overlay" style="inset:0;background:linear-gradient(90deg,rgba(46,44,43,.15) 0%,rgba(46,44,43,.55) 45%,rgba(46,44,43,.88) 100%)"></div>
<div class="abs" style="left:620px;top:60px">{search_bar(530, 19, q)}</div>
<div class="abs" style="left:620px;top:150px">{result_card(530, 19, note_)}</div>
<div class="abs" style="left:620px;top:470px">{cta(CTA_DENT, 18)}</div>
<div class="abs" style="left:48px;top:40px;padding:12px 14px;border-radius:14px;background:rgba(46,44,43,.5)">{logo(120, 'cream')}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    if s9:
        inner = f"""{photo('sign-wall-chair.jpg', 0, 0, 1080, 1920, .5, .4)}
<div class="abs" data-name="Overlay" style="inset:0;background:linear-gradient(180deg,rgba(46,44,43,.35) 0%,rgba(46,44,43,.1) 30%,rgba(46,44,43,.6) 50%,rgba(46,44,43,.92) 75%)"></div>
<div class="abs" style="left:80px;top:270px">{logo(190, 'cream')}</div>
<div class="abs" style="left:80px;top:960px">{search_bar(920, 30, q)}</div>
<div class="abs" style="left:80px;top:1100px">{result_card(920, 30, note_)}</div>
<div class="abs" style="left:80px;top:1480px">{cta(CTA_DENT, 27)}</div>"""
        return board(size, name, inner)
    inner = f"""{photo('reception-side.jpg', 0, 0, 1080, 1080, .5, .5)}
<div class="abs" data-name="Overlay" style="inset:0;background:linear-gradient(180deg,rgba(46,44,43,.25) 0%,rgba(46,44,43,.15) 25%,rgba(46,44,43,.75) 50%,rgba(46,44,43,.92) 100%)"></div>
<div class="abs" style="left:70px;top:60px">{logo(160, 'cream')}</div>
<div class="abs" style="left:70px;top:420px">{search_bar(940, 26, q)}</div>
<div class="abs" style="left:70px;top:540px">{result_card(940, 26, note_)}</div>
<div class="abs" style="left:70px;top:935px">{cta(CTA_DENT, 23)}</div>"""
    return board(size, name, inner)


# ---------------------------------------------------------------- CAROL (missing a few teeth)
C1_CARDS = [("Acrylic", "£650", "Simple and lightweight"), ("Cobalt chrome", "£1,000", "Slim, strong metal frame"), ("Flexible", "£1,250", "No metal clasps on show")]


def option_card(w, fs, title, price, line, lifted=False):
    bg = CHAR if lifted else "#FCFAF6"
    tc, lc = (LINEN, STONE) if lifted else (INK, GREY)
    return (f'<div style="position:relative;width:{w}px;padding:{fs * 1.3:.0f}px {fs * .9:.0f}px {fs * 1.2:.0f}px;border-radius:{fs * .8:.0f}px;background:{bg};text-align:center;'
            f'box-shadow:0 {fs * .8:.0f}px {fs * 2:.0f}px rgba(46,44,43,{.3 if lifted else .16})">'
            f'<div class="eyebrow" style="font-size:{fs * .5:.0f}px">{title}</div>'
            f'<div class="body" style="font-size:{fs * .7:.0f}px;color:{lc};margin-top:{fs * .7:.0f}px">from</div>'
            f'<div class="hl" style="font-size:{fs * 2.6:.0f}px;line-height:1;color:{GOLD}">{price}</div>'
            f'<div style="width:{fs * 2:.0f}px;height:1.5px;background:{GOLD};opacity:.6;margin:{fs * .7:.0f}px auto"></div>'
            f'<div style="font-family:Montserrat;font-weight:500;font-size:{fs * .78:.0f}px;line-height:1.35;color:{tc}">{line}</div></div>')


def cards3(x, y, w, fs, gap, lift):
    out = []
    for i, (t, p_, l) in enumerate(C1_CARDS):
        dy = -lift if i == 1 else 0
        out.append(f'<div class="abs" style="left:{x + i * (w + gap)}px;top:{y + dy}px">{option_card(w, fs, t, p_, l, i == 1)}</div>')
    return "".join(out)


def c1(size):
    """Custom: three upright price cards on Linen, the middle one lifted on Charcoal."""
    name = f"{DENT} | Static | Typographic | Three options"
    if size == "ls":
        inner = f"""<div class="abs" style="left:56px;top:46px">{logo(150, 'charcoal', 'horizontal')}</div>
<div class="abs hl" style="left:56px;top:140px;width:360px;font-size:44px">Missing A Few Teeth? <b>Three Ways To Fill The Gap.</b></div>
<div class="abs" style="left:56px;top:430px">{cta(CTA_DENT, 16)}</div>
<div class="abs" style="left:56px;top:530px">{proof(13)}</div>
{cards3(450, 120, 230, 20, 22, 30)}"""
        return board(size, name, inner)
    s9 = size == "s9"
    if s9:
        inner = f"""<div class="abs" style="left:80px;top:270px">{logo(120)}</div>
<div class="abs hl" style="left:80px;top:450px;width:920px;font-size:86px">Missing A Few Teeth? <b>Three Ways To Fill The Gap.</b></div>
{cards3(70, 800, 300, 33, 20, 40)}
<div class="abs" style="left:80px;top:1440px;display:flex;align-items:center;gap:30px">{cta(CTA_DENT, 24)}{proof(17)}</div>"""
        return board(size, name, inner)
    inner = f"""<div class="abs" style="left:70px;top:60px">{logo(170, 'charcoal', 'horizontal')}</div>
<div class="abs hl" style="left:70px;top:150px;width:940px;font-size:68px">Missing A Few Teeth? <b>Three Ways To Fill The Gap.</b></div>
{cards3(70, 420, 300, 29, 20, 30)}
<div class="abs" style="left:70px;top:950px;display:flex;align-items:center;gap:30px">{cta(CTA_DENT, 21)}{proof(15)}</div>"""
    return board(size, name, inner)


def c2(size):
    """VT-31 Handwritten sign: a card propped at the real reception."""
    name = f"{DENT} | Static | Practice photo | Not a full set"
    lines = ["Missing a few teeth?", "You don't need", "a full set."]
    if size == "ls":
        inner = f"""{photo('reception-side.jpg', 0, 0, 1200, 628, .5, .5)}
<div class="abs" data-name="Overlay" style="inset:0;background:linear-gradient(90deg,rgba(46,44,43,.92) 0%,rgba(46,44,43,.7) 42%,rgba(46,44,43,.05) 75%)"></div>
<div class="abs" style="left:60px;top:50px">{logo(96, 'cream')}</div>
<div class="abs hl" style="left:60px;top:200px;width:470px;font-size:48px;color:{LINEN}">Partial Dentures <b>From £650.</b></div>
<div class="abs eyebrow" style="left:60px;top:345px;font-size:14px">Magdalen Street · Norwich</div>
<div class="abs" style="left:60px;top:400px">{cta(CTA_DENT, 18)}</div>
<div class="abs" style="left:60px;top:500px">{proof(15, LINEN)}</div>
<div class="abs" style="left:700px;top:120px">{note(430, 48, lines)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    H = 1920 if s9 else 1080
    inner = f"""{photo('sign-wall-chair.jpg' if s9 else 'reception-side.jpg', 0, 0, 1080, H, .5, .45 if s9 else .5)}
<div class="abs" data-name="Overlay" style="inset:0;background:linear-gradient(180deg,rgba(46,44,43,.35) 0%,rgba(46,44,43,.15) 40%,rgba(46,44,43,.93) {74 if s9 else 70}%)"></div>
<div class="abs" style="left:0;right:0;top:{270 if s9 else 56}px;display:flex;justify-content:center">{logo(110 if s9 else 92, 'cream')}</div>
<div class="abs" style="left:{190 if s9 else 240}px;top:{560 if s9 else 230}px">{note(700 if s9 else 600, 84 if s9 else 68, lines, rot=2)}</div>
<div class="abs eyebrow" style="left:80px;top:{1360 if s9 else 815}px;font-size:{19 if s9 else 16}px">Partial dentures from £650 · Magdalen Street, Norwich</div>
<div class="abs" style="left:80px;top:{1420 if s9 else 870}px;display:flex;align-items:center;gap:34px">{cta(CTA_DENT, 26 if s9 else 22)}{proof(20 if s9 else 18, LINEN)}</div>"""
    return board(size, name, inner)


C3_PILLS = ["Made from digital scans", "No surgery", "Fitted in a few weeks"]


def c3(size):
    """VT-02 Lifestyle lower third: the real consult room full bleed, scrim, lower-third offer."""
    name = f"{DENT} | Static | Practice photo | Colour-matched"
    pills = lambda fs: "".join(usp_pill(t, fs) for t in C3_PILLS)
    if size == "ls":
        inner = f"""{photo('consult-room.jpg', 0, 0, 1200, 628, .55, .5)}
<div class="abs" data-name="Overlay" style="inset:0;background:linear-gradient(90deg,rgba(46,44,43,.93) 0%,rgba(46,44,43,.8) 45%,rgba(46,44,43,.05) 80%)"></div>
<div class="abs" style="left:56px;top:46px">{logo(150, 'cream', 'horizontal')}</div>
<div class="abs hl" style="left:56px;top:140px;width:560px;font-size:50px;color:{LINEN}">Colour-Matched <b>To Your Own Teeth.</b></div>
<div class="abs" style="left:56px;top:290px;display:flex;align-items:baseline;gap:10px"><span class="body" style="font-size:18px;color:{STONE}">Partial dentures from</span><span class="hl" style="font-size:64px;color:{GOLD};line-height:1">£650</span></div>
<div class="abs" style="left:56px;top:390px;display:flex;gap:10px">{pills(13)}</div>
<div class="abs" style="left:56px;top:480px;display:flex;align-items:center;gap:24px">{cta(CTA_DENT, 17)}{proof(13, LINEN)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    H = 1920 if s9 else 1080
    t = 1040 if s9 else 540
    inner = f"""{photo('consult-room.jpg', 0, 0, 1080, H, .5, .5)}
<div class="abs" data-name="Overlay" style="inset:0;background:linear-gradient(180deg,rgba(46,44,43,.35) 0%,rgba(46,44,43,0) 25%,rgba(46,44,43,.55) {48 if s9 else 42}%,rgba(46,44,43,.94) {64 if s9 else 62}%)"></div>
<div class="abs" style="left:{80 if s9 else 70}px;top:{270 if s9 else 56}px">{logo(190 if s9 else 170, 'cream', 'horizontal')}</div>
<div class="abs hl" style="left:{80 if s9 else 70}px;top:{t}px;width:920px;font-size:{86 if s9 else 72}px;color:{LINEN}">Colour-Matched <b>To Your Own Teeth.</b></div>
<div class="abs" style="left:{80 if s9 else 70}px;top:{t + (220 if s9 else 170)}px;display:flex;align-items:baseline;gap:14px"><span class="body" style="font-size:{28 if s9 else 24}px;color:{STONE}">Partial dentures from</span><span class="hl" style="font-size:{120 if s9 else 96}px;color:{GOLD};line-height:1">£650</span></div>
<div class="abs" style="left:{80 if s9 else 70}px;top:{t + (380 if s9 else 300)}px;display:flex;gap:12px;flex-wrap:wrap;width:940px">{pills(23 if s9 else 18)}</div>
<div class="abs" style="left:{80 if s9 else 70}px;top:{t + (470 if s9 else 380)}px;display:flex;align-items:center;gap:30px">{cta(CTA_DENT, 24 if s9 else 21)}{proof(17 if s9 else 15, LINEN)}</div>"""
    return board(size, name, inner)


def c4(size):
    """Custom: a big circle of the real lounge off the right edge, gold disc, headline on Linen."""
    name = f"{DENT} | Static | Practice photo | Laugh properly"
    if size == "ls":
        inner = f"""{mono(480, 'white', 'position:absolute;left:-300px;top:260px;opacity:.35')}
{circle('IMG_7396.jpg', 690, -60, 640, .5, .55, disc=(20, 440, 120))}
<div class="abs" style="left:60px;top:46px">{logo(90)}</div>
<div class="abs hl" style="left:60px;top:170px;width:580px;font-size:56px">Laugh Without Thinking <b>About The Gap.</b></div>
<div class="abs" style="left:60px;top:345px;display:flex;align-items:baseline;gap:12px"><span class="body" style="font-size:17px">Partial dentures from</span><span class="hl" style="font-size:44px;color:{GOLD}">£650</span></div>
<div class="abs" style="left:60px;top:450px;display:flex;align-items:center;gap:24px">{cta(CTA_DENT, 17)}{proof(14)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    if s9:
        inner = f"""{mono(900, 'white', 'position:absolute;left:-420px;top:1180px;opacity:.35')}
{circle('IMG_7396.jpg', 250, 280, 860, .5, .55, disc=(30, 600, 150))}
<div class="abs" style="left:80px;top:270px">{logo(120)}</div>
<div class="abs hl" style="left:80px;top:1170px;width:920px;font-size:86px">Laugh Without Thinking <b>About The Gap.</b></div>
<div class="abs" style="left:80px;top:1390px;display:flex;align-items:baseline;gap:14px"><span class="body" style="font-size:28px">Partial dentures from</span><span class="hl" style="font-size:72px;color:{GOLD}">£650</span></div>
<div class="abs" style="left:80px;top:1500px;display:flex;align-items:center;gap:30px">{cta(CTA_DENT, 24)}{proof(17)}</div>"""
        return board(size, name, inner)
    inner = f"""{mono(700, 'white', 'position:absolute;left:-380px;top:560px;opacity:.35')}
{circle('IMG_7396.jpg', 560, 60, 820, .5, .55, disc=(10, 590, 140))}
<div class="abs" style="left:70px;top:70px">{logo(110)}</div>
<div class="abs hl" style="left:70px;top:260px;width:470px;font-size:74px">Laugh Without Thinking <b>About The Gap.</b></div>
<div class="abs" style="left:70px;top:640px;display:flex;align-items:baseline;gap:14px"><span class="body" style="font-size:22px">Partial dentures from</span><span class="hl" style="font-size:72px;color:{GOLD}">£650</span></div>
<div class="abs" style="left:70px;top:820px">{cta(CTA_DENT, 22)}</div>
<div class="abs" style="left:70px;top:945px">{proof(18)}</div>"""
    return board(size, name, inner)


def partial_panel(fs, w):
    return (f'<div style="width:{w}px"><div class="eyebrow" style="font-size:{fs * .28:.0f}px">Missing a few teeth?</div>'
            f'<div class="hl" style="font-size:{fs:.0f}px;color:{LINEN};margin-top:{fs * .3:.0f}px;white-space:nowrap">Partial dentures from</div><div class="hl" style="font-size:{fs * 2:.0f}px;line-height:1;color:{GOLD}">£650</div>'
            f'<div class="body" style="margin-top:{fs * .3:.0f}px;font-size:{fs * .45:.0f}px">Digital scans, colour-matched, fitted and adjusted.</div></div>')


def c5(size):
    """VT-06 Offer footer: reception photo, Charcoal offer panel, address footer."""
    name = f"{DENT} | Static | Practice photo | Partial dentures offer"
    if size == "ls":
        inner = f"""{photo('reception-front.jpg', 0, 0, 560, 628, .4, .5)}
<div class="abs" style="left:620px;top:50px">{logo(160, 'cream', 'horizontal')}</div>
<div class="abs" style="left:620px;top:120px">{partial_panel(40, 540)}</div>
<div class="abs" style="left:620px;top:440px;display:flex;align-items:center;gap:22px">{cta(CTA_DENT, 17)}{proof(13, LINEN)}</div>
<div class="abs rule" style="left:620px;top:525px;width:520px;opacity:.35"></div>
<div class="abs" style="left:620px;top:550px">{address(16, STONE)}</div>"""
        return board(size, name, inner, bg="char")
    s9 = size == "s9"
    ph = 880 if s9 else 470
    top = ph + (70 if s9 else 50)
    fs = 74 if s9 else 52
    inner = f"""{photo('reception-front.jpg', 0, 0, 1080, ph, .45, .5)}
<div class="abs" style="left:{80 if s9 else 70}px;top:{270 if s9 else 50}px;padding:16px 20px;border-radius:16px;background:rgba(46,44,43,.55)">{logo(170, 'cream', 'horizontal')}</div>
<div class="abs" style="left:{80 if s9 else 70}px;top:{top}px">{partial_panel(fs, 620)}</div>
<div class="abs" style="left:{720 if s9 else 720}px;top:{top + (60 if s9 else 40)}px;display:flex;flex-direction:column;align-items:flex-start;gap:{26 if s9 else 22}px">{logo(150 if s9 else 120, 'cream')}{cta(CTA_DENT, 18 if s9 else 15)}{proof(14 if s9 else 12, LINEN)}</div>
<div class="abs rule" style="left:{80 if s9 else 70}px;right:{80 if s9 else 70}px;top:{1500 if s9 else 975}px;opacity:.35"></div>
<div class="abs" style="left:0;right:0;top:{1528 if s9 else 1000}px;display:flex;justify-content:center">{address(22 if s9 else 19, STONE)}</div>"""
    return board(size, name, inner, bg="char")


PERSONAS = {"mark": [m1, m2, m3, m4, m5], "denise": [d1, d2, d3, d4, d5],
            "michelle": [mi1, mi2, mi3, mi4, mi5],
            "hannah": [h1, h2, h3, h4, h5],
            "peter": [p1, p2, p3, p4, p5],
            "geoff": [g1, g2, g3, g4, g5],
            "linda": [l1, l2, l3, l4, l5],
            "carol": [c1, c2, c3, c4, c5]}
FILES = {"s1": "1x1", "s9": "9x16", "ls": "landscape"}

if __name__ == "__main__":
    which = sys.argv[1:] or list(PERSONAS)
    for p in which:
        for size, suffix in FILES.items():
            (ROOT / f"{p}-{suffix}.html").write_text(page(f"Iconic | {p} | {suffix}", [f(size) for f in PERSONAS[p]]))
    print("built", which)
