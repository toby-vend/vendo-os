"""Build Avenue Dental Meta static harness pages: one HTML page per persona per size.

Usage: python3 build.py [persona ...]  ->  <persona>-1x1.html, <persona>-9x16.html, <persona>-landscape.html
Brand: Avenue guideline (Figma gak08SGMFi9t7rZ2QWuhOU). Fonts: Jost (headlines, labels, buttons) and
Lexend (body), both Google fonts in assets/fonts. Layouts: data/creative-templates/vendo-dental-statics
(VT codes), rebuilt in Avenue's brand; custom layouts are marked Custom in the copy files.
Photos: assets/photos/web (gitignored). Stock is licensed via Magnific; sources in assets/photos/stock/SOURCES.txt.
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent
A = ROOT / "assets"
WEB = A / "photos/web"

GOLD, SAND, BLUSH, BLACK, WHITE = "#A88C61", "#C49C60", "#EDE2CF", "#1B1B1B", "#FFFFFF"
INK, SOFT, PANEL, LINE = "#1B1B1B", "#D9D4CC", "#242322", "#3A3733"
SIZES = {"s1": (1080, 1080), "s9": (1080, 1920), "ls": (1200, 628)}
SUFFIX = {"s1": "1x1", "s9": "9x16", "ls": "1.91x1"}
DATE = "261026"


def svg_file(name, width, extra=""):
    s = (A / name).read_text()
    s = re.sub(r'<svg width="\d+" height="\d+"', f'<svg width="{width}" height="{round(width * 104 / 136)}" style="display:block;{extra}"', s, count=1)
    return s


def logo(w, kind="reverse"):
    return svg_file({"reverse": "logo-reverse.svg", "primary": "logo-primary.svg"}[kind], w)


def mono(w, extra=""):
    return svg_file("monogram-gold.svg", w, extra)


GRAIN = ("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>"
         "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.9 0'/></filter>"
         "<rect width='100%' height='100%' filter='url(%23n)'/></svg>")

CSS = f"""
@font-face {{ font-family: Jost; src: url(assets/fonts/Jost.ttf); font-weight: 100 900; }}
@font-face {{ font-family: Lexend; src: url(assets/fonts/Lexend.ttf); font-weight: 100 900; }}
@font-face {{ font-family: Caveat; src: url(assets/fonts/Caveat.ttf); font-weight: 400 700; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ background: #3a3733; font-family: Lexend, sans-serif; font-weight: 300; display: flex; gap: 80px; padding: 80px; align-items: flex-start; -webkit-font-smoothing: antialiased; }}
.ab {{ position: relative; overflow: hidden; flex: none; background: {BLACK}; color: {WHITE}; }}
.abs {{ position: absolute; }}
.ph {{ position: absolute; overflow: hidden; }}
.ph img {{ display: block; width: 100%; height: 100%; }}
.grain {{ position: absolute; inset: 0; background-image: url("{GRAIN}"); opacity: .10; mix-blend-mode: overlay; pointer-events: none; }}
.hl {{ font-family: Jost, sans-serif; font-weight: 500; line-height: 1.06; letter-spacing: -.01em; }}
.hl b {{ font-weight: 500; color: {GOLD}; }}
.body {{ font-family: Lexend, sans-serif; font-weight: 300; line-height: 1.45; color: {SOFT}; }}
.label {{ font-family: Jost, sans-serif; font-weight: 500; letter-spacing: .26em; text-transform: uppercase; }}
.eyebrow {{ display: flex; align-items: center; gap: .7em; font-family: Jost, sans-serif; font-weight: 500; }}
.eyebrow:before {{ content: ''; width: 2.2em; height: 2px; background: {GOLD}; }}
.cta {{ display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; font-family: Jost, sans-serif; font-weight: 600; white-space: nowrap; background: {GOLD}; color: {BLACK}; }}
.rule {{ height: 1.5px; background: {GOLD}; opacity: .7; }}
"""

STAR = '<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="{c}" style="display:block"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>'
PIN = '<svg viewBox="0 0 24 24" width="{s}" height="{s}" style="display:block;flex:none"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2z" fill="currentColor"/></svg>'
CTA_FREE = "Book a free consultation"
CTA_BOOK = "Book your appointment"


def proof(size=22, color=WHITE, star=GOLD, text="4.9 from 227 Google reviews"):
    stars = "".join(STAR.format(s=round(size * 1.05), c=star) for _ in range(5))
    return (f'<div style="display:flex;align-items:center;gap:{size * .55}px;color:{color};font-family:Lexend;font-weight:300;font-size:{size}px;white-space:nowrap">'
            f'<span style="display:flex;gap:2px">{stars}</span>{text}</div>')


def cta(text, size=24, h=None, dark=False):
    h = h or round(size * 3)
    col = f"background:{BLACK};color:{WHITE};" if dark else ""
    return f'<span class="cta" style="height:{h}px;padding:0 {round(size * 1.8)}px;font-size:{size}px;{col}">{text}</span>'


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


def photo(src, x, y, w, h, fx=.5, fy=.5, zoom=1.0, corner=None, r=None, extra=""):
    """A photo frame. corner = tl/tr/bl/br gives the guideline's single rounded 'leaf' corner."""
    rad = ""
    if corner:
        r = r or round(min(w, h) * .16)
        rad = "border-radius:" + {"tr": f"0 {r}px 0 0", "tl": f"{r}px 0 0 0", "br": f"0 0 {r}px 0", "bl": f"0 0 0 {r}px"}[corner] + ";"
    return (f'<div class="ph" data-name="Photo" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;{rad}{extra}">'
            f'<img src="{crop(src, w, h, fx, fy, zoom)}"></div>')


def wash(direction="90deg", a=.96, b=0, stop=60, extra=""):
    return (f'<div class="abs" data-name="Overlay" style="inset:0;{extra}background:linear-gradient({direction},'
            f'rgba(27,27,27,{a}) 0%,rgba(27,27,27,{(a + b) / 2:.2f}) {stop * .6:.0f}%,rgba(27,27,27,{b}) {stop}%)"></div>')


def board(size, name, inner, bg=BLACK):
    w, h = SIZES[size]
    return (f'<div class="ab" data-name="{name} | {SUFFIX[size]} | {DATE}" style="width:{w}px;height:{h}px;background:{bg}">'
            f'{inner}<div class="grain"></div></div>')


def page(title, boards):
    return (f"<!doctype html><html lang='en-GB'><head><meta charset='utf-8'><title>{title}</title>"
            f"<style>{CSS}</style><script src='https://mcp.figma.com/mcp/html-to-design/capture.js' async></script>"
            f"</head><body>{''.join(boards)}</body></html>")


# ---------------------------------------------------------------- tooth line drawings (P1, P3)
CROWN = "M10,52 C8,28 22,16 34,22 C42,12 58,12 66,22 C78,16 92,28 90,52 L87,72 L13,72 Z"
ROOTS = "M16,72 L24,128 C26,137 35,137 37,128 L44,86 L56,86 L63,128 C65,137 74,137 76,128 L84,72"


def tooth(x, y, s=1.0, rot=0, flip=False, stroke=GOLD, fill="none", dash=False, roots=True):
    t = f"translate({x},{y}) rotate({rot} 50 70) scale({s})" + (" translate(0,150) scale(1,-1)" if flip else "")
    d = ' stroke-dasharray="6 6"' if dash else ""
    r = f'<path d="{ROOTS}" fill="none" stroke="{stroke}" stroke-width="3" stroke-linejoin="round"{d}/>' if roots else ""
    return f'<g transform="{t}"><path d="{CROWN}" fill="{fill}" stroke="{stroke}" stroke-width="3" stroke-linejoin="round"{d}/>{r}</g>'


def implant(x, y, s=1.0, stroke=GOLD):
    threads = "".join(f'<line x1="38" y1="{92 + i * 9}" x2="62" y2="{95 + i * 9}" stroke="{stroke}" stroke-width="2.5"/>' for i in range(5))
    return (f'<g transform="translate({x},{y}) scale({s})"><path d="{CROWN}" fill="none" stroke="{stroke}" stroke-width="3" stroke-linejoin="round"/>'
            f'<rect x="42" y="72" width="16" height="12" fill="none" stroke="{stroke}" stroke-width="3"/>'
            f'<path d="M38,84 L62,84 L60,136 C58,144 42,144 40,136 Z" fill="none" stroke="{stroke}" stroke-width="3" stroke-linejoin="round"/>{threads}</g>')


def jaw_now(w, h):
    """Lower row with one gap, upper row intact. Bone line straight."""
    g = []
    for i, x in enumerate([10, 120, 340, 450]):
        g.append(tooth(x, 200, 1.0))
        g.append(tooth(x, 10, 1.0, flip=True))
    g.append(tooth(230, 10, 1.0, flip=True))
    g.append(f'<line x1="0" y1="300" x2="560" y2="300" stroke="{GOLD}" stroke-width="2" stroke-dasharray="8 8" opacity=".6"/>')
    return f'<svg viewBox="0 0 560 360" width="{w}" height="{h}" style="display:block">{"".join(g)}</svg>'


def jaw_later(w, h):
    """Same row over time: neighbours lean into the gap, the tooth above drops, the bone dips."""
    g = [tooth(10, 200), tooth(450, 200), tooth(126, 205, rot=14), tooth(334, 205, rot=-14)]
    for x in [10, 120, 340, 450]:
        g.append(tooth(x, 10, 1.0, flip=True))
    g.append(tooth(230, 48, 1.0, flip=True))
    g.append(f'<path d="M0,300 L190,300 C230,300 240,336 280,336 C320,336 330,300 370,300 L560,300" fill="none" stroke="{GOLD}" stroke-width="2" stroke-dasharray="8 8" opacity=".6"/>')
    return f'<svg viewBox="0 0 560 360" width="{w}" height="{h}" style="display:block">{"".join(g)}</svg>'


def option_implant(w):
    g = tooth(0, 10) + implant(110, 10) + tooth(220, 10)
    g += f'<line x1="0" y1="112" x2="320" y2="112" stroke="{GOLD}" stroke-width="2" stroke-dasharray="7 7" opacity=".6"/>'
    return f'<svg viewBox="-4 0 328 160" width="{w}" height="{round(w * 160 / 328)}" style="display:block">{g}</svg>'


def option_bridge(w):
    shaved = "M18,52 C18,34 30,26 40,30 C48,22 58,22 66,30 C76,26 84,34 82,52 L80,72 L20,72 Z"
    g = (f'<g transform="translate(0,10)"><path d="{CROWN}" fill="none" stroke="{SOFT}" stroke-width="3" opacity=".9"/>'
         f'<path d="{shaved}" fill="none" stroke="{SOFT}" stroke-width="2" stroke-dasharray="5 5" opacity=".8"/>'
         f'<path d="{ROOTS}" fill="none" stroke="{SOFT}" stroke-width="3"/></g>'
         f'<g transform="translate(110,10)"><path d="{CROWN}" fill="none" stroke="{SOFT}" stroke-width="3"/></g>'
         f'<g transform="translate(220,10)"><path d="{CROWN}" fill="none" stroke="{SOFT}" stroke-width="3" opacity=".9"/>'
         f'<path d="{shaved}" fill="none" stroke="{SOFT}" stroke-width="2" stroke-dasharray="5 5" opacity=".8"/>'
         f'<path d="{ROOTS}" fill="none" stroke="{SOFT}" stroke-width="3"/></g>'
         f'<line x1="90" y1="50" x2="120" y2="50" stroke="{SOFT}" stroke-width="3"/><line x1="200" y1="50" x2="230" y2="50" stroke="{SOFT}" stroke-width="3"/>')
    g += f'<line x1="0" y1="112" x2="320" y2="112" stroke="{SOFT}" stroke-width="2" stroke-dasharray="7 7" opacity=".4"/>'
    return f'<svg viewBox="-4 0 328 160" width="{w}" height="{round(w * 160 / 328)}" style="display:block">{g}</svg>'


# ---------------------------------------------------------------- PETER (single gap)
PETER = "Missing Teeth"


def p1(size):
    """VT-21 Question and diagram."""
    name = f"{PETER} | Static | Line art | Why the gap matters"
    if size == "ls":
        inner = f"""
<div class="abs" style="left:60px;top:52px">{logo(118)}</div>
<div class="abs hl" style="left:60px;top:190px;width:500px;font-size:46px">Nobody can see the gap. <b>Here's why it still matters.</b></div>
<div class="abs" style="left:60px;top:400px">{proof(16)}</div>
<div class="abs" style="left:60px;top:448px">{cta(CTA_FREE, 19)}</div>
<div class="abs body" style="left:60px;top:540px;font-size:16px;color:{GOLD}">Single implants from £2,450, crown included</div>
<div class="abs" style="left:590px;top:90px;width:270px;height:330px;background:{PANEL};border-radius:0 40px 0 0;padding:26px 20px">
  <div class="label" style="font-size:12px;color:{GOLD}">Now</div><div style="margin-top:44px">{jaw_now(230, 148)}</div></div>
<div class="abs" style="left:900px;top:90px;width:270px;height:330px;background:{PANEL};border-radius:0 40px 0 0;padding:26px 20px">
  <div class="label" style="font-size:12px;color:{GOLD}">Over time</div><div style="margin-top:44px">{jaw_later(230, 148)}</div></div>
<div class="abs body" style="left:590px;top:450px;width:580px;font-size:18px">Teeth either side lean in, the one above drops, and the bone shrinks back.</div>
<div class="abs" style="left:858px;top:236px;width:40px;height:40px;border-radius:50%;background:{GOLD};display:flex;align-items:center;justify-content:center;color:{BLACK};font-family:Jost;font-size:22px;font-weight:600">&rarr;</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    top = 300 if s9 else 70
    inner = f"""
<div class="abs" style="left:0;right:0;top:{top}px;display:flex;justify-content:center">{logo(170 if s9 else 150)}</div>
<div class="abs hl" style="left:80px;right:80px;top:{top + (210 if s9 else 175)}px;text-align:center;font-size:{74 if s9 else 62}px">Nobody can see the gap.<br><b>Here's why it still matters.</b></div>
<div class="abs" style="left:80px;top:{top + (480 if s9 else 365)}px;width:440px;height:{400 if s9 else 330}px;background:{PANEL};border-radius:0 48px 0 0;padding:30px 30px">
  <div class="label" style="font-size:15px;color:{GOLD}">Now</div>
  <div style="margin-top:{60 if s9 else 34}px">{jaw_now(380, 244)}</div></div>
<div class="abs" style="left:560px;top:{top + (480 if s9 else 365)}px;width:440px;height:{400 if s9 else 330}px;background:{PANEL};border-radius:0 48px 0 0;padding:30px 30px">
  <div class="label" style="font-size:15px;color:{GOLD}">Over time</div>
  <div style="margin-top:{60 if s9 else 34}px">{jaw_later(380, 244)}</div></div>
<div class="abs" style="left:514px;top:{top + (650 if s9 else 505)}px;width:52px;height:52px;border-radius:50%;background:{GOLD};display:flex;align-items:center;justify-content:center;color:{BLACK};font-family:Jost;font-size:28px;font-weight:600">&rarr;</div>
<div class="abs body" style="left:80px;right:80px;top:{top + (920 if s9 else 720)}px;text-align:center;font-size:{26 if s9 else 24}px">Teeth either side lean in, the one above drops, and the bone shrinks back.</div>
<div class="abs" style="left:0;right:0;top:{top + (1030 if s9 else 800)}px;display:flex;flex-direction:column;align-items:center;gap:{26 if s9 else 20}px">
  <div class="label" style="font-size:{20 if s9 else 17}px;color:{GOLD}">Single implants from £2,450, crown included</div>
  {cta(CTA_FREE, 26 if s9 else 22)}
  {proof(22 if s9 else 18)}</div>"""
    return board(size, name, inner)


def p2(size):
    """VT-02 Lifestyle lower third."""
    name = f"{PETER} | Static | Stock 55-65 | Chewing on one side"
    if size == "ls":
        inner = f"""
{photo('peter-eating.jpg', 440, 0, 760, 628, .42, .45)}
<div class="abs" style="left:0;top:0;width:620px;height:628px;background:linear-gradient(90deg,{BLACK} 62%,rgba(27,27,27,0))"></div>
<div class="abs" style="left:60px;top:52px">{logo(118)}</div>
<div class="abs hl" style="left:60px;top:160px;width:470px;font-size:50px">You've started chewing on <b>the other side.</b></div>
<div class="abs" style="left:60px;top:340px"><div class="label" style="font-size:14px;color:{GOLD}">Single implants from</div>
  <div class="hl" style="font-size:46px;margin-top:6px">£2,450 <span style="font-size:20px;font-weight:400;color:{SOFT}">crown included</span></div></div>
<div class="abs" style="left:60px;top:460px">{cta(CTA_FREE, 18)}</div>
<div class="abs" style="left:60px;top:540px">{proof(14)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    H = 1920 if s9 else 1080
    inner = f"""
{photo('peter-eating.jpg', 0, 0, 1080, H, .42, .38 if s9 else .3)}
<div class="abs" style="left:0;right:0;bottom:0;height:{H * (.58 if s9 else .62):.0f}px;background:linear-gradient(0deg,{BLACK} 52%,rgba(27,27,27,.86) 72%,rgba(27,27,27,0))"></div>
<div class="abs" style="left:80px;top:{300 if s9 else 70}px">{logo(150 if s9 else 130)}</div>
<div class="abs hl" style="left:80px;top:{1060 if s9 else 520}px;width:900px;font-size:{86 if s9 else 70}px">You've started chewing on <b>the other side.</b></div>
<div class="abs" style="left:80px;top:{1290 if s9 else 710}px">
  <div class="label" style="font-size:{19 if s9 else 17}px;color:{GOLD}">Single implants from</div>
  <div style="display:flex;align-items:baseline;gap:18px;margin-top:6px"><span class="hl" style="font-size:{78 if s9 else 64}px">£2,450</span>
  <span class="body" style="font-size:{26 if s9 else 22}px">crown included</span></div></div>
<div class="abs" style="left:80px;top:{1470 if s9 else 880}px;display:flex;align-items:center;gap:34px">{cta(CTA_FREE, 26 if s9 else 22)}{proof(21 if s9 else 18)}</div>"""
    return board(size, name, inner)


def compare(w, s=1.0):
    S = lambda v: round(v * s)
    card = lambda title, svgx, pts, hi: (
        f'<div style="width:{S(w / 2 - 14)}px;padding:{S(30)}px {S(26)}px;border-radius:0 {S(44)}px 0 0;'
        f'background:{"#2B2723" if hi else PANEL};border:1.5px solid {GOLD if hi else LINE}">'
        f'<div class="label" style="font-size:{S(16)}px;color:{GOLD if hi else SOFT}">{title}</div>'
        f'<div style="margin:{S(22)}px 0 {S(18)}px">{svgx}</div>'
        + "".join(f'<div class="body" style="font-size:{S(23)}px;line-height:1.35;margin-top:{S(10)}px;color:{WHITE if hi else SOFT}">{p}</div>' for p in pts)
        + "</div>")
    return (f'<div style="display:flex;gap:{S(28)}px;align-items:stretch">'
            + card("Implant", option_implant(S(w / 2 - 14 - 52)), ["Replaces the root", "Teeth either side left alone", "Fixed in place"], True)
            + card("Bridge", option_bridge(S(w / 2 - 14 - 52)), ["No surgery", "Teeth either side filed for crowns", "Cheaper at the start"], False)
            + "</div>")


def p3(size):
    """VT-22 Us vs them comparison (no named competitors)."""
    name = f"{PETER} | Static | Line art | Implant or bridge"
    if size == "ls":
        inner = f"""
<div class="abs" style="left:60px;top:52px">{logo(118)}</div>
<div class="abs hl" style="left:60px;top:190px;width:380px;font-size:44px">One gap. Two fixes. <b>The honest difference.</b></div>
<div class="abs label" style="left:60px;top:400px;font-size:13px;color:{GOLD}">Single implants from £2,450</div>
<div class="abs" style="left:60px;top:440px">{cta(CTA_FREE, 18)}</div>
<div class="abs" style="left:60px;top:530px">{proof(14)}</div>
<div class="abs" style="left:470px;top:70px">{compare(700, .92)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    inner = f"""
<div class="abs" style="left:80px;top:{300 if s9 else 70}px">{logo(150 if s9 else 130)}</div>
<div class="abs hl" style="left:80px;top:{520 if s9 else 230}px;width:900px;font-size:{80 if s9 else 64}px">One gap. Two fixes.<br><b>The honest difference.</b></div>
<div class="abs" style="left:80px;top:{780 if s9 else 420}px">{compare(920, 1.0)}</div>
<div class="abs" style="left:80px;top:{1470 if s9 else 930}px;display:flex;align-items:center;gap:30px">{cta(CTA_FREE, 26 if s9 else 22)}
  <div class="label" style="font-size:{18 if s9 else 15}px;color:{GOLD}">Single implants<br>from £2,450</div></div>"""
    return board(size, name, inner)


def price_list(items, size=26, color=SOFT):
    rows = "".join(f'<div style="display:flex;justify-content:space-between;gap:24px;padding:{size * .55:.0f}px 0;border-top:1.5px solid rgba(168,140,97,.55)">'
                   f'<span class="body" style="font-size:{size}px;color:{WHITE}">{a}</span><span class="label" style="font-size:{size * .62:.0f}px;color:{GOLD};align-self:center">{b}</span></div>'
                   for a, b in items)
    return rows + '<div style="border-top:1.5px solid rgba(168,140,97,.55)"></div>'


PETER_ITEMS = [("Implant, abutment and crown", "£2,450"), ("Consultation and 3D scan", "Free"), ("Implant and crown guarantee", "12 months")]


def p4(size):
    """Custom: the full price, itemised, over the lounge."""
    name = f"{PETER} | Static | Practice photo | The full price"
    if size == "ls":
        inner = f"""
{photo('lounge-sign.jpg', 600, 0, 600, 628, .45, .45)}
{wash('90deg', 1, 0, 100, 'left:540px;right:0;')}
<div class="abs label" style="left:60px;top:150px;font-size:14px;color:{GOLD}">A single implant, in full</div>
<div class="abs hl" style="left:56px;top:178px;font-size:120px;color:{GOLD}">£2,450</div>
<div class="abs" style="left:60px;top:330px;width:470px">{price_list(PETER_ITEMS[1:], 18)}</div>
<div class="abs" style="left:60px;top:500px">{cta(CTA_FREE, 18)}</div>
<div class="abs body" style="left:360px;top:516px;font-size:14px">Crown included</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    H = 1920 if s9 else 1080
    inner = f"""
{photo('lounge-sign.jpg', 0, 0, 1080, H, .5, .4)}
<div class="abs" data-name="Overlay" style="inset:0;background:linear-gradient(180deg,rgba(27,27,27,.55) 0%,rgba(27,27,27,.88) {38 if s9 else 30}%,{BLACK} {62 if s9 else 56}%)"></div>
<div class="abs label" style="left:80px;top:{780 if s9 else 330}px;font-size:{22 if s9 else 19}px;color:{GOLD}">A single implant, in full</div>
<div class="abs hl" style="left:72px;top:{820 if s9 else 365}px;font-size:{220 if s9 else 180}px;color:{GOLD};letter-spacing:-.03em">£2,450</div>
<div class="abs" style="left:80px;top:{1090 if s9 else 590}px;width:920px">{price_list(PETER_ITEMS, 30 if s9 else 26)}</div>
<div class="abs" style="left:80px;top:{1440 if s9 else 900}px;display:flex;align-items:center;gap:34px">{cta(CTA_FREE, 26 if s9 else 22)}{proof(21 if s9 else 18)}</div>"""
    return board(size, name, inner)


def search_card(w, s=1.0):
    S = lambda v: round(v * s)
    g = '<svg viewBox="0 0 24 24" width="{0}" height="{0}"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="#5f6368" stroke-width="2.2"/><line x1="15.5" y1="15.5" x2="21" y2="21" stroke="#5f6368" stroke-width="2.2" stroke-linecap="round"/></svg>'
    stars = "".join(STAR.format(s=S(20), c="#F4B400") for _ in range(5))
    return f"""
<div style="width:{w}px">
  <div style="display:flex;align-items:center;gap:{S(16)}px;height:{S(78)}px;padding:0 {S(28)}px;background:{WHITE};border-radius:999px;color:#202124;font-family:Lexend;font-size:{S(25)}px;font-weight:300;box-shadow:0 {S(10)}px {S(30)}px rgba(0,0,0,.35)">{g.format(S(28))}how much is one dental implant in Leamington Spa</div>
  <div style="margin-top:{S(18)}px;background:{WHITE};border-radius:{S(22)}px;padding:{S(26)}px {S(30)}px;color:#202124;box-shadow:0 {S(10)}px {S(30)}px rgba(0,0,0,.35)">
    <div style="display:flex;align-items:center;gap:{S(16)}px">
      <div style="width:{S(54)}px;height:{S(54)}px;border-radius:50%;background:{BLACK};display:flex;align-items:center;justify-content:center">{mono(S(36))}</div>
      <div><div style="font-family:Lexend;font-weight:500;font-size:{S(26)}px;color:#1a0dab">Avenue Dental Practice</div>
      <div style="font-family:Lexend;font-weight:300;font-size:{S(19)}px;color:#5f6368">Dentist · 2 Lime Avenue, Leamington Spa</div></div></div>
    <div style="display:flex;align-items:center;gap:{S(10)}px;margin-top:{S(16)}px;font-family:Lexend;font-size:{S(21)}px;color:#5f6368"><b style="color:#202124;font-weight:500">4.9</b><span style="display:flex;gap:2px">{stars}</span>(227 Google reviews)</div>
    <div style="margin-top:{S(16)}px;padding-top:{S(16)}px;border-top:1px solid #e3e3e3;font-family:Lexend;font-size:{S(23)}px;color:#202124">Single implants from <b style="font-weight:600">£2,450</b>, crown included</div>
  </div>
</div>"""


def p5(size):
    """VT-29 Search bar."""
    name = f"{PETER} | Static | Stock 55-65 | What you searched"
    if size == "ls":
        inner = f"""
{photo('peter-phone.jpg', 0, 0, 600, 628, .6, .5, corner='br', r=110)}
<div class="abs" style="left:640px;top:52px">{logo(118)}</div>
<div class="abs" style="left:640px;top:190px">{search_card(510, .6)}</div>
<div class="abs" style="left:640px;top:500px">{cta(CTA_FREE, 18)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    H = 1920 if s9 else 1080
    inner = f"""
{photo('peter-phone.jpg', 0, 0, 1080, H, .5 if s9 else .48, .4)}
<div class="abs" data-name="Overlay" style="inset:0;background:linear-gradient(180deg,rgba(27,27,27,.5) 0%,rgba(27,27,27,.15) 30%,rgba(27,27,27,.7) 58%,{BLACK} 85%)"></div>
<div class="abs" style="left:80px;top:{300 if s9 else 70}px">{logo(150 if s9 else 130)}</div>
<div class="abs" style="left:80px;top:{1010 if s9 else 520}px">{search_card(920, 1.0 if s9 else .9)}</div>
<div class="abs" style="left:80px;top:{1460 if s9 else 930}px">{cta(CTA_FREE, 26 if s9 else 22)}</div>"""
    return board(size, name, inner)


# ---------------------------------------------------------------- GEOFF (full arch)
GEOFF = "Missing Teeth"
TICK = '<svg viewBox="0 0 24 24" width="{s}" height="{s}" style="display:block;flex:none" fill="none" stroke="{c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.2 4.2L19 7"/></svg>'


def ticks(items, size=24, gap=14, color=WHITE, tick=GOLD):
    return "".join(f'<div style="display:flex;align-items:center;gap:{size * .6:.0f}px;margin-top:{gap if i else 0}px;font-family:Lexend;font-weight:300;font-size:{size}px;color:{color}">'
                   f'{TICK.format(s=round(size * 1.1), c=tick)}{t}</div>' for i, t in enumerate(items))


def address(size=18, color=SOFT):
    return f'<div style="display:flex;align-items:center;gap:{size * .5:.0f}px;font-family:Lexend;font-weight:300;font-size:{size}px;color:{color}">{PIN.format(s=round(size * 1.2))}2 Lime Avenue, Leamington Spa, CV32 7DA</div>'


def g1(size):
    """Custom: editorial, dark. Leaf-framed portrait bleeding off the edge, headline left."""
    name = f"{GEOFF} | Static | Stock 60-70 | Not for a day"
    if size == "ls":
        inner = f"""
{photo('geoff-table.jpg', 640, 0, 560, 628, .46, .42, corner='bl', r=120)}
<div class="abs" style="left:60px;top:52px">{logo(118)}</div>
<div class="abs hl" style="left:60px;top:170px;width:540px;font-size:58px">You won't leave without teeth. <b>Not for a day.</b></div>
<div class="abs label" style="left:60px;top:370px;font-size:14px;color:{GOLD}">Full-arch implants, fixed the same day</div>
<div class="abs" style="left:60px;top:430px">{cta(CTA_FREE, 18)}</div>
<div class="abs" style="left:60px;top:520px">{proof(14)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    if s9:
        inner = f"""
{photo('geoff-table.jpg', 0, 0, 1080, 1130, .46, .4, corner='br', r=220)}
<div class="abs" style="left:0;right:0;top:0;height:420px;background:linear-gradient(180deg,rgba(27,27,27,.75),rgba(27,27,27,0))"></div>
<div class="abs" style="left:80px;top:270px">{logo(150)}</div>
<div class="abs hl" style="left:80px;top:1165px;width:920px;font-size:84px">You won't leave without teeth. <b>Not for a day.</b></div>
<div class="abs label" style="left:80px;top:1440px;font-size:21px;color:{GOLD}">Full-arch implants, fixed the same day</div>
<div class="abs" style="left:80px;top:1495px;display:flex;align-items:center;gap:34px">{cta(CTA_FREE, 26)}{proof(21)}</div>"""
        return board(size, name, inner)
    inner = f"""
{photo('geoff-table.jpg', 560, 0, 520, 1080, .46, .45, corner='bl', r=200)}
<div class="abs" style="left:80px;top:80px">{logo(130)}</div>
<div class="abs hl" style="left:80px;top:300px;width:470px;font-size:80px">You won't leave without teeth. <b>Not for a day.</b></div>
<div class="abs label" style="left:80px;top:690px;width:440px;font-size:18px;line-height:1.6;color:{GOLD}">Full-arch implants,<br>fixed the same day</div>
<div class="abs" style="left:80px;top:810px">{cta(CTA_FREE, 22)}</div>
<div class="abs" style="left:80px;top:930px">{proof(18)}</div>"""
    return board(size, name, inner)


def pills(items, size=20):
    return "".join(f'<span style="display:inline-flex;align-items:center;gap:{size * .5:.0f}px;padding:{size * .55:.0f}px {size * .8:.0f}px;border:1.5px solid rgba(168,140,97,.7);border-radius:999px;font-family:Lexend;font-weight:300;font-size:{size}px;color:{WHITE};white-space:nowrap">{TICK.format(s=size, c=GOLD)}{t}</span>' for t in items)


G2_PILLS = ["Free consultation", "3D scan included", "12-month guarantee"]


def g2(size):
    """VT-03 Brand card over a practice photo."""
    name = f"{GEOFF} | Static | Practice photo | One plan instead of another repair"
    def card(w, fs, ps, pad, logo_w):
        return (f'<div style="width:{w}px;background:rgba(27,27,27,.94);border-radius:0 {pad * 1.6:.0f}px 0 0;padding:{pad}px">'
                f'<div style="margin-bottom:{pad * .7:.0f}px">{logo(logo_w)}</div>'
                f'<div class="hl" style="font-size:{fs}px;color:{SOFT};font-weight:400;line-height:1.25">Another crown.<br>Another filling.<br>Another tooth that\'s started to move.</div>'
                f'<div class="hl" style="font-size:{fs * 1.25:.0f}px;margin-top:{pad * .45:.0f}px"><b>Or one plan for the whole arch.</b></div>'
                f'<div style="display:flex;flex-wrap:wrap;gap:{ps * .6:.0f}px;margin-top:{pad * .6:.0f}px">{pills(G2_PILLS, ps)}</div>'
                f'<div style="display:flex;align-items:center;gap:{pad * .5:.0f}px;margin-top:{pad * .7:.0f}px">{cta(CTA_FREE, ps + 2)}{proof(ps - 2)}</div></div>')
    if size == "ls":
        inner = f"""{photo('lounge-sign.jpg', 0, 0, 1200, 628, .5, .45)}
<div class="abs" style="left:40px;top:40px">{card(640, 30, 15, 34, 100)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    H = 1920 if s9 else 1080
    inner = f"""{photo('lounge-sign.jpg', 0, 0, 1080, H, .5, .4)}
<div class="abs" style="left:70px;top:{900 if s9 else 520}px">{card(940, 44, 20, 48, 130)}</div>"""
    return board(size, name, inner)


def g3(size):
    """VT-06 Offer footer: the free consultation and 3D scan as the offer."""
    name = f"{GEOFF} | Static | Practice photo | Start with a free 3D scan"
    def panel(w, big, sm, pad, logo_w):
        return (f'<div style="display:flex;gap:{pad}px;align-items:flex-start">'
                f'<div style="flex:1"><div class="label" style="font-size:{sm}px;color:{GOLD}">Full-arch implants · Step one</div>'
                f'<div class="hl" style="font-size:{big}px;margin-top:{sm * .6:.0f}px;color:{GOLD};letter-spacing:-.02em">Free</div>'
                f'<div class="body" style="font-size:{sm * 1.35:.0f}px;color:{WHITE};margin-top:{sm * .3:.0f}px">Consultation and 3D scan, worth £250</div>'
                f'<div class="body" style="font-size:{sm * 1.15:.0f}px;margin-top:{sm * .5:.0f}px">No commitment to treatment</div></div>'
                f'<div style="width:1.5px;align-self:stretch;background:rgba(168,140,97,.6)"></div>'
                f'<div style="width:{logo_w * 1.9:.0f}px;display:flex;flex-direction:column;gap:{sm}px">{logo(logo_w)}{proof(sm - 1)}{cta(CTA_FREE, sm + 1)}</div></div>')
    if size == "ls":
        inner = f"""{photo('scanner-a.jpg', 0, 0, 480, 628, .45, .5, corner='br', r=110)}
<div class="abs hl" style="left:530px;top:60px;width:610px;font-size:40px">You don't have to decide on a full arch today.</div>
<div class="abs" style="left:530px;top:200px;width:620px">{panel(620, 110, 14, 26, 108)}</div>
<div class="abs" style="left:530px;top:550px">{address(15)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    ph = 900 if s9 else 470
    top = 250 if s9 else 0
    inner = f"""{photo('scanner-a.jpg', 0, top, 1080, ph, .45, .45, corner='br' if s9 else None, r=160)}
<div class="abs hl" style="left:80px;top:{top + ph + 50}px;width:920px;font-size:{60 if s9 else 50}px">You don't have to decide on a full arch today.</div>
<div class="abs" style="left:80px;top:{top + ph + (230 if s9 else 190)}px;width:920px">{panel(920, 150 if s9 else 120, 19 if s9 else 17, 40, 140)}</div>
<div class="abs" style="left:80px;top:{top + ph + (610 if s9 else 520)}px;width:920px;border-top:1.5px solid rgba(168,140,97,.5);padding-top:24px">{address(20 if s9 else 18)}</div>"""
    return board(size, name, inner)


def compare_lines(rows, size=24):
    return "".join(f'<div style="display:flex;gap:{size}px;padding:{size * .7:.0f}px 0;border-top:1.5px solid rgba(168,140,97,.55)">'
                   f'<span class="label" style="width:{size * 7:.0f}px;flex:none;font-size:{size * .6:.0f}px;color:{GOLD};padding-top:{size * .25:.0f}px">{a}</span>'
                   f'<span class="body" style="font-size:{size}px;color:{WHITE}">{b}</span></div>' for a, b in rows) + '<div style="border-top:1.5px solid rgba(168,140,97,.55)"></div>'


G4_ROWS = [("Check-ups", "Here on Lime Avenue, Leamington Spa"), ("Adjustments", "Book a time and drive over"), ("Guarantee", "12 months on the implants and teeth")]


def g4(size):
    """Custom: the building at night in a leaf frame, calm UK aftercare comparison."""
    name = f"{GEOFF} | Static | Practice photo | Aftercare a drive away"
    if size == "ls":
        inner = f"""{photo('exterior-night.jpg', 700, 0, 500, 628, .4, .5, corner='bl', r=120)}
<div class="abs" style="left:60px;top:52px">{logo(118)}</div>
<div class="abs hl" style="left:60px;top:160px;width:600px;font-size:46px">Your check-ups should be a drive away, <b>not a flight.</b></div>
<div class="abs" style="left:60px;top:320px;width:600px">{compare_lines(G4_ROWS[::2], 17)}</div>
<div class="abs" style="left:60px;top:480px">{cta(CTA_FREE, 18)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    if s9:
        inner = f"""{photo('exterior-night.jpg', 0, 250, 1080, 820, .5, .5, corner='br', r=200)}
<div class="abs" style="left:80px;top:290px">{logo(150)}</div>
<div class="abs hl" style="left:80px;top:1120px;width:920px;font-size:76px">Your check-ups should be a drive away, <b>not a flight.</b></div>
<div class="abs" style="left:80px;top:1330px;width:920px">{compare_lines(G4_ROWS, 26)}</div>
<div class="abs" style="left:80px;top:1610px">{cta(CTA_FREE, 26)}</div>"""
        return board(size, name, inner).replace('top:1610px', 'top:1560px')
    inner = f"""{photo('exterior-night.jpg', 560, 0, 520, 1080, .38, .5, corner='bl', r=200)}
<div class="abs" style="left:80px;top:80px">{logo(130)}</div>
<div class="abs hl" style="left:80px;top:270px;width:460px;font-size:62px">Your check-ups should be a drive away, <b>not a flight.</b></div>
<div class="abs" style="left:80px;top:610px;width:440px">{compare_lines(G4_ROWS, 20)}</div>
<div class="abs" style="left:80px;top:930px">{cta(CTA_FREE, 22)}</div>"""
    return board(size, name, inner)


MOSAIC = [("scanner-a.jpg", .45, .45), ("lounge-chat.jpg", .45, .5), ("mirror.jpg", .55, .45), ("scanner-b.jpg", .45, .45), ("dentist-treating.jpg", .5, .4), ("exterior-day.jpg", .5, .6)]
G5_TICKS = ["Free full-arch consultation", "3D scan included", "4.9 from 227 Google reviews"]


def mosaic(x, y, w, h, cols, rows, gap=6):
    cw, ch = (w - gap * (cols - 1)) / cols, (h - gap * (rows - 1)) / rows
    return "".join(photo(src, round(x + (i % cols) * (cw + gap)), round(y + (i // cols) * (ch + gap)), round(cw), round(ch), fx, fy)
                   for i, (src, fx, fy) in enumerate(MOSAIC[:cols * rows]))


def g5(size):
    """VT-13 Team mosaic (real practice photos only)."""
    name = f"{GEOFF} | Static | Practice photos | Meet the team"
    if size == "ls":
        inner = f"""{mosaic(560, 0, 640, 628, 3, 2)}
<div class="abs" style="left:56px;top:52px">{logo(110)}</div>
<div class="abs hl" style="left:56px;top:170px;width:460px;font-size:46px">Meet the team behind your <b>new smile</b></div>
<div class="abs" style="left:56px;top:320px">{ticks(G5_TICKS, 17, 10)}</div>
<div class="abs" style="left:56px;top:470px">{cta(CTA_FREE, 18)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    if s9:
        inner = f"""
<div class="abs" style="left:80px;top:270px">{logo(150)}</div>
<div class="abs hl" style="left:80px;top:470px;width:920px;font-size:84px">Meet the team behind your <b>new smile</b></div>
<div class="abs" style="left:80px;top:700px">{ticks(G5_TICKS + ['Lime Avenue, Leamington Spa'], 26, 16)}</div>
{mosaic(0, 960, 1080, 600, 3, 2)}
<div class="abs" style="left:80px;top:1600px;display:none"></div>"""
        inner = inner.replace('<div class="abs" style="left:80px;top:1600px;display:none"></div>', f'<div class="abs" style="left:80px;top:1478px">{cta(CTA_FREE, 26)}</div>')
        inner = inner.replace(mosaic(0, 960, 1080, 600, 3, 2), mosaic(0, 940, 1080, 500, 3, 2))
        return board(size, name, inner)
    inner = f"""{mosaic(500, 0, 580, 1080, 2, 3)}
<div class="abs" style="left:70px;top:80px">{logo(130)}</div>
<div class="abs hl" style="left:70px;top:300px;width:400px;font-size:62px">Meet the team behind your <b>new smile</b></div>
<div class="abs" style="left:70px;top:560px">{ticks(G5_TICKS, 20, 14)}</div>
<div class="abs" style="left:70px;top:720px">{address(17)}</div>
<div class="abs" style="left:70px;top:900px">{cta(CTA_FREE, 21)}</div>"""
    return board(size, name, inner)

# ---------------------------------------------------------------- MICHELLE (wanted it for twenty years)
SMO = "Smile Makeover"
MI_PRICES = [("Edge bonding", "from £175 a tooth"), ("Veneers", "from £775 a tooth"), ("Clear aligners", "from £2,500")]


def mi1(size):
    """VT-04 Side column."""
    name = f"{SMO} | Static | Stock 50-60 | Still thinking about it"
    if size == "ls":
        inner = f"""{photo('michelle-portrait.jpg', 420, 0, 780, 628, .4, .4)}
<div class="abs" style="left:0;top:0;width:640px;height:628px;background:linear-gradient(90deg,{BLACK} 62%,rgba(27,27,27,0))"></div>
<div class="abs" style="left:60px;top:52px">{logo(118)}</div>
<div class="abs hl" style="left:60px;top:170px;width:480px;font-size:56px">Still thinking about <b>your smile?</b></div>
<div class="abs body" style="left:60px;top:320px;width:420px;font-size:19px">Two or three things have bothered you for years.</div>
<div class="abs" style="left:60px;top:400px">{address(15)}</div>
<div class="abs" style="left:60px;top:470px">{cta(CTA_FREE, 18)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    H = 1920 if s9 else 1080
    colw = 560 if not s9 else 1080
    if s9:
        inner = f"""{photo('michelle-portrait.jpg', 0, 0, 1080, 1250, .38, .45)}
<div class="abs" style="left:0;right:0;top:820px;height:430px;background:linear-gradient(0deg,{BLACK},rgba(27,27,27,0))"></div>
<div class="abs" style="left:0;right:0;top:0;height:520px;background:linear-gradient(180deg,rgba(27,27,27,.75),rgba(27,27,27,0))"></div>
<div class="abs" style="left:80px;top:1010px">{logo(140)}</div>
<div class="abs hl" style="left:80px;top:1160px;width:900px;font-size:96px">Still thinking about <b>your smile?</b></div>
<div class="abs body" style="left:80px;top:1390px;width:880px;font-size:30px">Two or three things have bothered you for years.</div>
<div class="abs" style="left:80px;top:1480px;display:flex;align-items:center;gap:34px">{cta(CTA_FREE, 26)}{proof(21)}</div>"""
        return board(size, name, inner)
    inner = f"""{photo('michelle-portrait.jpg', 380, 0, 700, 1080, .4, .45)}
<div class="abs" style="left:0;top:0;width:{colw}px;height:1080px;background:linear-gradient(90deg,{BLACK} 70%,rgba(27,27,27,0))"></div>
<div class="abs" style="left:70px;top:80px">{logo(130)}</div>
<div class="abs hl" style="left:70px;top:300px;width:440px;font-size:76px">Still thinking about <b>your smile?</b></div>
<div class="abs rule" style="left:70px;top:560px;width:90px"></div>
<div class="abs body" style="left:70px;top:600px;width:400px;font-size:26px">Two or three things have bothered you for years.</div>
<div class="abs" style="left:70px;top:740px">{address(17)}</div>
<div class="abs" style="left:70px;top:840px">{cta(CTA_FREE, 22)}</div>
<div class="abs" style="left:70px;top:960px">{proof(17)}</div>"""
    return board(size, name, inner)


def mi2(size):
    """Custom: photo-led, the accommodation."""
    name = f"{SMO} | Static | Stock 50-60 | Always taking the photo"
    if size == "ls":
        inner = f"""{photo('michelle-friends.jpg', 560, 0, 640, 628, .32, .45, corner='bl', r=120)}
<div class="abs" style="left:60px;top:52px">{logo(118)}</div>
<div class="abs hl" style="left:60px;top:200px;width:520px;font-size:56px">You're always the one <b>taking the photo.</b></div>
<div class="abs label" style="left:60px;top:390px;font-size:14px;color:{GOLD}">Free smile consultation in Leamington Spa</div>
<div class="abs" style="left:60px;top:440px">{cta(CTA_FREE, 18)}</div>
<div class="abs" style="left:60px;top:530px">{proof(14)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    H = 1920 if s9 else 1080
    inner = f"""{photo('michelle-friends.jpg', 0, 0, 1080, H, .36 if s9 else .4, .4)}
<div class="abs" data-name="Overlay" style="left:0;right:0;bottom:0;height:{H * (.5 if s9 else .55):.0f}px;background:linear-gradient(0deg,{BLACK} 45%,rgba(27,27,27,.8) 70%,rgba(27,27,27,0))"></div>
<div class="abs" style="left:0;right:0;top:0;height:{480 if s9 else 260}px;background:linear-gradient(180deg,rgba(27,27,27,.7),rgba(27,27,27,0))"></div>
<div class="abs" style="left:80px;top:{270 if s9 else 70}px">{logo(150 if s9 else 130)}</div>
<div class="abs hl" style="left:80px;top:{1150 if s9 else 600}px;width:920px;font-size:{92 if s9 else 76}px">You're always the one <b>taking the photo.</b></div>
<div class="abs label" style="left:80px;top:{1390 if s9 else 810}px;font-size:{20 if s9 else 17}px;color:{GOLD}">Free smile consultation in Leamington Spa</div>
<div class="abs" style="left:80px;top:{1450 if s9 else 870}px;display:flex;align-items:center;gap:34px">{cta(CTA_FREE, 26 if s9 else 22)}{proof(21 if s9 else 18)}</div>"""
    return board(size, name, inner)


def mi_prices(size=28):
    return price_list([(a, b) for a, b in MI_PRICES], size)


def mi3(size):
    """VT-20 Editorial price split (three from-prices)."""
    name = f"{SMO} | Static | Stock 50-60 | What it actually costs"
    if size == "ls":
        inner = f"""{photo('michelle-sofa.jpg', 680, 0, 520, 628, .58, .4, corner='bl', r=110)}
<div class="abs" style="left:56px;top:48px">{logo(110)}</div>
<div class="abs hl" style="left:56px;top:160px;width:560px;font-size:40px">What a smile makeover <b>actually costs</b></div>
<div class="abs" style="left:56px;top:270px;width:560px">{mi_prices(18)}</div>
<div class="abs body" style="left:56px;top:440px;font-size:15px">Full cost in writing before you start</div>
<div class="abs" style="left:56px;top:490px">{cta(CTA_FREE, 18)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    if s9:
        inner = f"""{photo('michelle-sofa.jpg', 0, 0, 1080, 860, .5, .4, corner='br', r=200)}
<div class="abs" style="left:0;right:0;top:0;height:520px;background:linear-gradient(180deg,rgba(27,27,27,.75),rgba(27,27,27,0))"></div>
<div class="abs" style="left:80px;top:900px">{logo(130)}</div>
<div class="abs hl" style="left:80px;top:1030px;width:920px;font-size:72px">What a smile makeover <b>actually costs</b></div>
<div class="abs" style="left:80px;top:1220px;width:920px">{mi_prices(26)}</div>
<div class="abs body" style="left:80px;top:1455px;font-size:23px">Full cost in writing before you start</div>
<div class="abs" style="left:80px;top:1505px;display:flex;align-items:center;gap:34px">{cta(CTA_FREE, 24)}{proof(21)}</div>"""
        return board(size, name, inner)
    inner = f"""{photo('michelle-sofa.jpg', 600, 0, 480, 1080, .6, .4)}
<div class="abs" style="left:70px;top:80px">{logo(130)}</div>
<div class="abs hl" style="left:70px;top:270px;width:480px;font-size:62px">What a smile makeover <b>actually costs</b></div>
<div class="abs" style="left:70px;top:480px;width:470px">{mi_prices(22)}</div>
<div class="abs body" style="left:70px;top:700px;width:460px;font-size:21px">Full cost in writing before you start</div>
<div class="abs" style="left:70px;top:820px">{cta(CTA_FREE, 21)}</div>
<div class="abs" style="left:70px;top:940px">{proof(16)}</div>"""
    return board(size, name, inner)


def note(w, fs, rot=-2.5):
    tape = f'<div style="position:absolute;left:50%;top:{-fs * .45:.0f}px;width:{fs * 3.2:.0f}px;height:{fs * .9:.0f}px;transform:translateX(-50%) rotate(3deg);background:rgba(237,226,207,.82);box-shadow:0 1px 2px rgba(0,0,0,.15)"></div>'
    return (f'<div style="position:relative;width:{w}px;padding:{fs * 1.1:.0f}px {fs * 1.0:.0f}px {fs * 1.2:.0f}px;background:#F7F2E8;transform:rotate({rot}deg);'
            f'box-shadow:0 {fs * .5:.0f}px {fs * 1.2:.0f}px rgba(0,0,0,.45),0 2px 4px rgba(0,0,0,.25)">{tape}'
            f'<div style="font-family:Caveat;font-weight:600;font-size:{fs}px;line-height:1.12;color:#22201d">Tell us what you\'d change.</div>'
            f'<div style="font-family:Caveat;font-weight:600;font-size:{fs}px;line-height:1.12;color:#22201d;margin-top:{fs * .2:.0f}px">We\'ll tell you what\'s <span style="border-bottom:{fs * .07:.1f}px solid {GOLD}">possible.</span></div>'
            f'<div style="font-family:Caveat;font-weight:500;font-size:{fs * .62:.0f}px;color:#6b645a;margin-top:{fs * .45:.0f}px;text-align:right">Avenue Dental</div></div>')


def mi4(size):
    """VT-31 Handwritten sign: a note in the Avenue lounge."""
    name = f"{SMO} | Static | Practice photo | Tell us what you'd change"
    if size == "ls":
        inner = f"""{photo('lounge-blur.jpg', 0, 0, 1200, 628, .5, .5)}
<div class="abs" style="inset:0;background:linear-gradient(90deg,rgba(27,27,27,.85),rgba(27,27,27,.3))"></div>
<div class="abs" style="left:60px;top:52px">{logo(118)}</div>
<div class="abs hl" style="left:60px;top:190px;width:500px;font-size:48px;text-shadow:0 2px 12px rgba(0,0,0,.4)">You don't need to know <b>the treatment.</b></div>
<div class="abs" style="left:60px;top:400px">{cta(CTA_FREE, 18)}</div>
<div class="abs" style="left:60px;top:490px">{proof(14)}</div>
<div class="abs" style="left:690px;top:110px">{note(440, 46)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    H = 1920 if s9 else 1080
    inner = f"""{photo('lounge-blur.jpg', 0, 0, 1080, H, .5, .5)}
<div class="abs" style="inset:0;background:linear-gradient(180deg,rgba(27,27,27,.4),rgba(27,27,27,.25) 45%,rgba(27,27,27,.92) 72%)"></div>
<div class="abs" style="left:80px;top:{270 if s9 else 70}px">{logo(150 if s9 else 130)}</div>
<div class="abs" style="left:{150 if s9 else 220}px;top:{560 if s9 else 230}px">{note(780 if s9 else 620, 84 if s9 else 64)}</div>
<div class="abs label" style="left:80px;top:{1330 if s9 else 820}px;font-size:{20 if s9 else 17}px;color:{GOLD}">Free smile consultation · Lime Avenue</div>
<div class="abs" style="left:80px;top:{1390 if s9 else 880}px;display:flex;align-items:center;gap:34px">{cta(CTA_FREE, 26 if s9 else 22)}{proof(21 if s9 else 18)}</div>"""
    return board(size, name, inner)


MI_STEPS = [("1", "Health first", "Cosmetic work lasts longer on healthy gums."), ("2", "Straighten and whiten", "So everything after is matched to it."), ("3", "Bonding or veneers to finish", "Shade, shape and spacing decided once.")]


def steps(size=26, gap=26):
    return "".join(f'<div style="display:flex;gap:{size * .8:.0f}px;align-items:flex-start;margin-top:{gap if i else 0}px">'
                   f'<div class="hl" style="font-size:{size * 2:.0f}px;color:{GOLD};line-height:.9;width:{size * 1.3:.0f}px">{n}</div>'
                   f'<div><div class="hl" style="font-size:{size * 1.1:.0f}px;color:{INK}">{t}</div><div class="body" style="font-size:{size * .8:.0f}px;color:#5a554e;margin-top:4px">{d}</div></div></div>'
                   for i, (n, t, d) in enumerate(MI_STEPS))


def mi5(size):
    """Custom: three-step band on Blush Gold with the lounge in a leaf frame."""
    name = f"{SMO} | Static | Practice photo | Done in the right order"
    if size == "ls":
        inner = f"""{photo('lounge-sign.jpg', 820, 0, 380, 628, .3, .5, corner='bl', r=110)}
<div class="abs" style="left:56px;top:48px">{logo(110, 'primary')}</div>
<div class="abs hl" style="left:56px;top:150px;width:700px;font-size:38px;color:{INK}">Why fixing one tooth at a time <b>stops matching</b></div>
<div class="abs" style="left:56px;top:270px;width:700px">{steps(18, 16)}</div>
<div class="abs" style="left:56px;top:520px">{cta(CTA_FREE, 18, dark=True)}</div>"""
        return board(size, name, inner, bg=BLUSH)
    s9 = size == "s9"
    if s9:
        inner = f"""{photo('lounge-sign.jpg', 540, 250, 540, 640, .3, .5, corner='bl', r=160)}
<div class="abs" style="left:80px;top:270px">{logo(150, 'primary')}</div>
<div class="abs hl" style="left:80px;top:500px;width:440px;font-size:66px;color:{INK}">Why fixing one tooth at a time <b>stops matching</b></div>
<div class="abs" style="left:80px;top:960px;width:920px">{steps(32, 40)}</div>
<div class="abs label" style="left:80px;top:1420px;font-size:20px;color:{GOLD}">One plan, one shade</div>
<div class="abs" style="left:80px;top:1480px">{cta(CTA_FREE, 26, dark=True)}</div>"""
        return board(size, name, inner, bg=BLUSH)
    inner = f"""{photo('lounge-sign.jpg', 640, 0, 440, 520, .3, .5, corner='bl', r=140)}
<div class="abs" style="left:70px;top:80px">{logo(130, 'primary')}</div>
<div class="abs hl" style="left:70px;top:260px;width:520px;font-size:56px;color:{INK}">Why fixing one tooth at a time <b>stops matching</b></div>
<div class="abs" style="left:70px;top:580px;width:940px">{steps(26, 28)}</div>
<div class="abs" style="left:70px;top:940px;display:flex;align-items:center;gap:30px">{cta(CTA_FREE, 22, dark=True)}<span class="label" style="font-size:16px;color:{GOLD}">One plan, one shade</span></div>"""
    return board(size, name, inner, bg=BLUSH)

# ---------------------------------------------------------------- JOSH (edge bonding)
J_PROBLEMS = ["A chipped corner", "Uneven edges", "A small gap"]
TOOTH_ICON = '<svg width="{s}" height="{s}" viewBox="0 0 48 48" fill="none" stroke="{c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex:none"><path d="M16 6c-5 0-9 4-9 10 0 5 2 8 3 12 1 5 2 14 6 14 3 0 3-9 8-9s5 9 8 9c4 0 5-9 6-14 1-4 3-7 3-12 0-6-4-10-9-10-3 0-5 2-8 2s-5-2-8-2z"/></svg>'


def problems(size=28, gap=22):
    return "".join(f'<div style="display:flex;align-items:center;gap:{size * .7:.0f}px;padding:{gap * .6:.0f}px 0;border-bottom:1.5px solid rgba(168,140,97,.4)">'
                   f'{TOOTH_ICON.format(s=round(size * 1.3), c=GOLD)}<span class="hl" style="font-size:{size}px;font-weight:400">{t}</span></div>' for t in J_PROBLEMS)


def price_tooth(big, small, color=GOLD):
    return (f'<div style="display:flex;align-items:baseline;gap:{small * .5:.0f}px"><span class="body" style="font-size:{small}px;color:{SOFT}">from</span>'
            f'<span class="hl" style="font-size:{big}px;color:{color}">£175</span><span class="body" style="font-size:{small}px;color:{SOFT}">per tooth</span></div>')


def j1(size):
    """VT-30 Problem and solution."""
    name = f"{SMO} | Static | Practice photo | Chips edges gaps"
    arrow = lambda d: f'<div style="width:{d}px;height:{d}px;border-radius:50%;background:{GOLD};display:flex;align-items:center;justify-content:center;color:{BLACK};font-family:Jost;font-weight:600;font-size:{d * .5:.0f}px">&rarr;</div>'
    if size == "ls":
        inner = f"""{photo('dentist-treating.jpg', 640, 0, 560, 628, .5, .4)}
{wash('0deg', .92, 0, 60, 'left:640px;')}
<div class="abs" style="left:56px;top:48px">{logo(110)}</div>
<div class="abs label" style="left:56px;top:170px;font-size:13px;color:{GOLD}">The problem</div>
<div class="abs" style="left:56px;top:196px;width:500px">{problems(22, 16)}</div>
<div class="abs" style="left:56px;top:470px">{cta(CTA_FREE, 18)}</div>
<div class="abs" style="left:614px;top:290px">{arrow(52)}</div>
<div class="abs label" style="left:690px;top:450px;font-size:13px;color:{GOLD}">The solution</div>
<div class="abs hl" style="left:690px;top:476px;font-size:34px">Edge bonding</div>
<div class="abs" style="left:690px;top:520px">{price_tooth(44, 17)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    if s9:
        inner = f"""{photo('dentist-treating.jpg', 0, 900, 1080, 1020, .5, .35)}
{wash('0deg', .95, 0, 70, 'top:900px;')}
<div class="abs" style="left:80px;top:270px">{logo(150)}</div>
<div class="abs label" style="left:80px;top:470px;font-size:20px;color:{GOLD}">The problem</div>
<div class="abs" style="left:80px;top:510px;width:920px">{problems(40, 30)}</div>
<div class="abs" style="left:500px;top:868px">{arrow(80)}</div>
<div class="abs label" style="left:80px;top:1250px;font-size:20px;color:{GOLD}">The solution</div>
<div class="abs hl" style="left:80px;top:1290px;font-size:70px">Edge bonding</div>
<div class="abs" style="left:80px;top:1410px">{price_tooth(66, 24)}</div>
<div class="abs" style="left:80px;top:1512px">{cta(CTA_FREE, 22)}</div>"""
        return board(size, name, inner)
    inner = f"""{photo('dentist-treating.jpg', 520, 0, 560, 1080, .5, .4)}
{wash('0deg', .95, 0, 65, 'left:520px;')}
<div class="abs" style="left:520px;top:0;width:2px;height:1080px;background:{GOLD};opacity:.6"></div>
<div class="abs" style="left:70px;top:80px">{logo(130)}</div>
<div class="abs label" style="left:70px;top:300px;font-size:17px;color:{GOLD}">The problem</div>
<div class="abs" style="left:70px;top:336px;width:400px">{problems(30, 24)}</div>
<div class="abs" style="left:70px;top:900px">{cta(CTA_FREE, 22)}</div>
<div class="abs" style="left:490px;top:500px">{arrow(60)}</div>
<div class="abs label" style="left:580px;top:760px;font-size:17px;color:{GOLD}">The solution</div>
<div class="abs hl" style="left:580px;top:792px;font-size:54px">Edge bonding</div>
<div class="abs" style="left:580px;top:860px">{price_tooth(64, 22)}</div>"""
    return board(size, name, inner)


def notif(w, s, title, body):
    S = lambda v: round(v * s)
    return (f'<div style="width:{w}px;padding:{S(22)}px {S(24)}px;border-radius:{S(26)}px;background:rgba(245,242,236,.82);display:flex;gap:{S(18)}px;align-items:flex-start;box-shadow:0 {S(8)}px {S(24)}px rgba(0,0,0,.25)">'
            f'<div style="width:{S(58)}px;height:{S(58)}px;flex:none;border-radius:{S(14)}px;background:{BLACK};display:flex;align-items:center;justify-content:center">{mono(S(40))}</div>'
            f'<div style="flex:1"><div style="display:flex;justify-content:space-between;font-family:Lexend;font-weight:500;font-size:{S(21)}px;color:#1b1b1b">Avenue Dental<span style="font-weight:300;color:#6b6760;font-size:{S(18)}px">now</span></div>'
            f'<div style="font-family:Lexend;font-weight:500;font-size:{S(22)}px;color:#1b1b1b;margin-top:{S(4)}px">{title}</div>'
            f'<div style="font-family:Lexend;font-weight:300;font-size:{S(21)}px;color:#2b2925;margin-top:{S(2)}px;line-height:1.35">{body}</div></div></div>')


J2_N = [("Your smile preview is ready", "See your new edges before anything touches your teeth."), ("Edge bonding", "From £175 per tooth. Usually one visit.")]


def j2(size):
    """VT-27 Phone notification."""
    name = f"{SMO} | Static | Stock 24-32 | Your smile preview"
    clock = lambda fs: f'<div style="text-align:center;color:{WHITE}"><div style="font-family:Lexend;font-weight:400;font-size:{fs * .2:.0f}px">Tuesday</div><div style="font-family:Lexend;font-weight:500;font-size:{fs}px;line-height:1;letter-spacing:-.02em">18:42</div></div>'
    if size == "ls":
        inner = f"""{photo('josh-street.jpg', 0, 0, 1200, 628, .45, .35)}
{wash('90deg', .1, .85, 100)}
<div class="abs" style="left:60px;top:52px">{logo(118)}</div>
<div class="abs" style="left:640px;top:70px">{notif(500, .8, *J2_N[0])}</div>
<div class="abs" style="left:640px;top:210px">{notif(500, .8, *J2_N[1])}</div>
<div class="abs hl" style="left:640px;top:360px;width:520px;font-size:40px">See it <b>before you decide.</b></div>
<div class="abs" style="left:640px;top:480px">{cta(CTA_FREE, 18)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    H = 1920 if s9 else 1080
    inner = f"""{photo('josh-street.jpg', 0, 0, 1080, H, .52 if s9 else .5, .35)}
<div class="abs" data-name="Overlay" style="inset:0;background:linear-gradient(180deg,rgba(27,27,27,.45) 0%,rgba(27,27,27,.1) 35%,rgba(27,27,27,.55) 60%,rgba(27,27,27,.92) 100%)"></div>
<div class="abs" style="left:0;right:0;top:{300 if s9 else 70}px">{clock(170 if s9 else 120)}</div>
<div class="abs" style="left:90px;top:{1040 if s9 else 560}px">{notif(900, 1.15 if s9 else 1.05, *J2_N[0])}</div>
<div class="abs" style="left:90px;top:{1230 if s9 else 735}px">{notif(900, 1.15 if s9 else 1.05, *J2_N[1])}</div>
<div class="abs" style="left:90px;top:{1440 if s9 else 920}px;display:flex;align-items:center;gap:34px">{cta(CTA_FREE, 26 if s9 else 22)}{proof(21 if s9 else 18)}</div>"""
    return board(size, name, inner)


def notes_card(w, s, rot=-1.5):
    S = lambda v: round(v * s)
    lines = ["bonding vs veneers ??", "", "- chip on front left", "- the two either side look short", "- don't want them filed down", "- price??"]
    body = "".join(f'<div style="min-height:{S(36)}px">{l}</div>' for l in lines[2:])
    return (f'<div style="width:{w}px;border-radius:{S(28)}px;background:#FBFAF7;transform:rotate({rot}deg);box-shadow:0 {S(24)}px {S(60)}px rgba(0,0,0,.55);overflow:hidden">'
            f'<div style="padding:{S(26)}px {S(34)}px {S(10)}px;font-family:Lexend;font-size:{S(20)}px;color:#C49C60;font-weight:500">&lsaquo; Notes</div>'
            f'<div style="padding:{S(6)}px {S(34)}px {S(34)}px">'
            f'<div style="font-family:Lexend;font-weight:600;font-size:{S(36)}px;color:#1b1b1b">{lines[0]}</div>'
            f'<div style="font-family:Lexend;font-weight:300;font-size:{S(25)}px;color:#2b2925;margin-top:{S(16)}px;line-height:1.4">{body}</div></div></div>')


J3_ROWS = [("Bonding", "Added to your tooth. No drilling in most cases. From £175 per tooth."), ("Veneers", "Thin shells for bigger changes. From £775 per tooth.")]


def j3(size):
    """Custom: native note-to-self."""
    name = f"{SMO} | Static | Graphic | Bonding or veneers"
    if size == "ls":
        inner = f"""<div class="abs" style="left:60px;top:70px">{notes_card(470, .78)}</div>
<div class="abs" style="left:600px;top:52px">{logo(110)}</div>
<div class="abs hl" style="left:600px;top:160px;width:540px;font-size:38px">Keep your teeth. <b>Change the edges.</b></div>
<div class="abs" style="left:600px;top:270px;width:540px">{compare_lines(J3_ROWS, 16)}</div>
<div class="abs" style="left:600px;top:500px">{cta(CTA_FREE, 18)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    if s9:
        inner = f"""<div class="abs" style="left:80px;top:270px">{logo(150)}</div>
<div class="abs" style="left:110px;top:470px">{notes_card(860, 1.25)}</div>
<div class="abs hl" style="left:80px;top:1060px;width:920px;font-size:64px">Keep your teeth. <b>Change the edges.</b></div>
<div class="abs" style="left:80px;top:1265px;width:920px">{compare_lines(J3_ROWS, 24)}</div>
<div class="abs" style="left:80px;top:1500px">{cta(CTA_FREE, 24)}</div>"""
        return board(size, name, inner)
    inner = f"""<div class="abs" style="left:70px;top:70px">{logo(120)}</div>
<div class="abs" style="left:150px;top:170px">{notes_card(780, 1.08)}</div>
<div class="abs hl" style="left:70px;top:650px;width:900px;font-size:50px">Keep your teeth. <b>Change the edges.</b></div>
<div class="abs" style="left:70px;top:730px;width:940px">{compare_lines(J3_ROWS, 20)}</div>
<div class="abs" style="left:70px;top:950px">{cta(CTA_FREE, 21)}</div>"""
    return board(size, name, inner)


J4_USPS = ["Usually one visit", "No drilling in most cases", "Free smile preview"]


def j4(size):
    """VT-01 Offer band."""
    name = f"{SMO} | Static | Stock 24-32 | From £175 a tooth"
    if size == "ls":
        inner = f"""{photo('josh-tea.jpg', 600, 0, 600, 628, .5, .4)}
<div class="abs" style="left:0;top:0;width:640px;height:628px;background:{BLACK};border-radius:0 0 120px 0"></div>
<div class="abs" style="left:56px;top:48px">{logo(110)}</div>
<div class="abs hl" style="left:56px;top:160px;font-size:44px">Even up your smile</div>
<div class="abs" style="left:56px;top:220px">{price_tooth(76, 20)}</div>
<div class="abs" style="left:56px;top:340px">{ticks(J4_USPS, 18, 10)}</div>
<div class="abs" style="left:56px;top:500px">{cta(CTA_FREE, 18)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    band = 1160 if s9 else 740
    inner = f"""{photo('josh-tea.jpg', 0, band - 80, 1080, (1920 if s9 else 1080) - band + 80, .5, .3)}
<div class="abs" style="left:0;top:0;width:1080px;height:{band}px;background:{BLACK};border-radius:0 0 {200 if s9 else 140}px 0"></div>
<div class="abs" style="left:0;right:0;top:{270 if s9 else 60}px;display:flex;justify-content:center">{logo(150 if s9 else 120)}</div>
<div class="abs hl" style="left:0;right:0;top:{470 if s9 else 220}px;text-align:center;font-size:{70 if s9 else 58}px">Even up your smile</div>
<div class="abs" style="left:0;right:0;top:{560 if s9 else 296}px;display:flex;justify-content:center">{price_tooth(120 if s9 else 100, 30 if s9 else 26)}</div>
<div class="abs" style="left:0;right:0;top:{760 if s9 else 440}px;display:flex;justify-content:center"><div>{ticks(J4_USPS, 28 if s9 else 23, 14)}</div></div>
<div class="abs" style="left:0;right:0;top:{980 if s9 else 610}px;display:flex;justify-content:center">{cta(CTA_FREE, 26 if s9 else 22)}</div>"""
    return board(size, name, inner)


def selfview(w, h, s):
    S = lambda v: round(v * s)
    return (f'<div class="abs" style="left:0;top:0;width:{w}px;height:{h}px;border:{S(4)}px solid {GOLD};border-radius:{S(22)}px"></div>'
            f'<div class="abs" style="left:{S(18)}px;bottom:{S(18)}px;padding:{S(8)}px {S(16)}px;border-radius:{S(10)}px;background:rgba(27,27,27,.7);font-family:Lexend;font-size:{S(20)}px;color:{WHITE}">You</div>'
            f'<div class="abs" style="right:{S(18)}px;bottom:{S(18)}px;width:{S(44)}px;height:{S(44)}px;border-radius:50%;background:rgba(27,27,27,.7);display:flex;align-items:center;justify-content:center">'
            f'<svg width="{S(22)}" height="{S(22)}" viewBox="0 0 24 24" fill="none" stroke="{WHITE}" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></div>')


def j5(size):
    """Custom: native photo, the video-call self-view."""
    name = f"{SMO} | Static | Stock 24-32 | Closed-mouth smile"
    if size == "ls":
        inner = f"""<div class="abs" style="left:620px;top:60px;width:540px;height:508px">{photo('josh-call2.jpg', 0, 0, 540, 508, .5, .35)}{selfview(540, 508, .8)}</div>
<div class="abs" style="left:56px;top:48px">{logo(110)}</div>
<div class="abs hl" style="left:56px;top:170px;width:520px;font-size:46px">You've got a closed-mouth smile <b>for calls.</b></div>
<div class="abs" style="left:56px;top:350px">{price_tooth(54, 18)}</div>
<div class="abs label" style="left:56px;top:430px;font-size:13px;color:{GOLD}">Edge bonding · usually one visit</div>
<div class="abs" style="left:56px;top:480px">{cta(CTA_FREE, 18)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    if s9:
        inner = f"""<div class="abs" style="left:80px;top:270px">{logo(150)}</div>
<div class="abs hl" style="left:80px;top:450px;width:920px;font-size:76px">You've got a closed-mouth smile <b>for calls.</b></div>
<div class="abs" style="left:80px;top:720px;width:920px;height:640px">{photo('josh-call2.jpg', 0, 0, 920, 640, .5, .35)}{selfview(920, 640, 1.2)}</div>
<div class="abs" style="left:80px;top:1400px">{price_tooth(70, 24)}</div>
<div class="abs" style="left:560px;top:1430px">{cta(CTA_FREE, 22)}</div>"""
        return board(size, name, inner)
    inner = f"""<div class="abs" style="left:70px;top:70px">{logo(120)}</div>
<div class="abs hl" style="left:70px;top:210px;width:940px;font-size:58px">You've got a closed-mouth smile <b>for calls.</b></div>
<div class="abs" style="left:70px;top:390px;width:940px;height:480px">{photo('josh-call2.jpg', 0, 0, 940, 480, .5, .3)}{selfview(940, 480, 1.0)}</div>
<div class="abs" style="left:70px;top:915px">{price_tooth(60, 21)}</div>
<div class="abs" style="left:600px;top:925px">{cta(CTA_FREE, 21)}</div>"""
    return board(size, name, inner)

PERSONAS = {"peter": [p1, p2, p3, p4, p5], "geoff": [g1, g2, g3, g4, g5], "michelle": [mi1, mi2, mi3, mi4, mi5], "josh": [j1, j2, j3, j4, j5]}
FILES = {"s1": "1x1", "s9": "9x16", "ls": "landscape"}

if __name__ == "__main__":
    which = sys.argv[1:] or list(PERSONAS)
    for p in which:
        for size, suffix in FILES.items():
            (ROOT / f"{p}-{suffix}.html").write_text(page(f"Avenue | {p} | {suffix}", [f(size) for f in PERSONAS[p]]))
    print("built", which)
