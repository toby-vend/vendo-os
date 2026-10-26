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


def cta(text, size=24, h=None):
    h = h or round(size * 3)
    return f'<span class="cta" style="height:{h}px;padding:0 {round(size * 1.8)}px;font-size:{size}px">{text}</span>'


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


PERSONAS = {"peter": [p1, p2, p3, p4, p5]}
FILES = {"s1": "1x1", "s9": "9x16", "ls": "landscape"}

if __name__ == "__main__":
    which = sys.argv[1:] or list(PERSONAS)
    for p in which:
        for size, suffix in FILES.items():
            (ROOT / f"{p}-{suffix}.html").write_text(page(f"Avenue | {p} | {suffix}", [f(size) for f in PERSONAS[p]]))
    print("built", which)
