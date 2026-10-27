"""Build ARC Dental Surgery Meta static harness pages: one HTML page per persona per size.

Usage: python3 build.py  ->  mark-1x1.html, mark-9x16.html, mark-landscape.html
Campaign: General (new private patients). Persona: Mark, the lapsed patient (Dental Persona Bank).
Brand: no guideline exists. Palette and logo follow ARC's live Meta statics (espresso #372a1f, latte panels,
cream buttons, white tooth-arc logo, traced from those statics) with accents from arcdentalsurgery.co.uk
(terracotta #c66738 family, teal #7cc0b0). Fonts: Plus Jakarta Sans + Libre Caslon Text italic + Caveat
(Google fonts in assets/fonts). Layouts: data/creative-templates/vendo-dental-statics (VT codes) or Custom.
Photos: assets/photos (gitignored), ARC's own 2022 practice shoot (site and Drive), sources in assets/photos/SOURCES.txt. No stock.
"""
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).parent
A = ROOT / "assets"
PH = A / "photos"

ESP, ESP2, LATTE, TAN, CREAM, TERRA, TEAL = "#372a1f", "#2a2018", "#5e4c3b", "#c9a27e", "#f6efe3", "#e3925f", "#7cc0b0"
INK = "#2a2018"
SIZES = {"s1": (1080, 1080), "s9": (1080, 1920), "ls": (1200, 628)}
SUFFIX = {"s1": "1x1", "s9": "9x16", "ls": "1.91x1"}
DATE = "261027"
CTA = "Book your check-up"
PROOF = "4.9 on Google"


def logo(w, color=CREAM):
    s = (A / "logo-arc.svg").read_text()
    s = s.replace("<svg ", f'<svg width="{w}" height="{round(w * 825 / 1305)}" style="display:block;color:{color}" ', 1)
    return s


GRAIN = ("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>"
         "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.9 0'/></filter>"
         "<rect width='100%' height='100%' filter='url(%23n)'/></svg>")

CSS = f"""
@font-face {{ font-family: Jakarta; src: url(assets/fonts/PlusJakartaSans.ttf); font-weight: 200 800; }}
@font-face {{ font-family: Caslon; src: url(assets/fonts/LibreCaslonText-Italic.ttf); font-weight: 400 700; font-style: italic; }}
@font-face {{ font-family: Caveat; src: url(assets/fonts/Caveat.ttf); font-weight: 400 700; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ background: #1c1712; font-family: Jakarta, sans-serif; display: flex; gap: 80px; padding: 80px; align-items: flex-start; -webkit-font-smoothing: antialiased; }}
.ab {{ position: relative; overflow: hidden; flex: none; background: {ESP}; color: {CREAM}; }}
.abs {{ position: absolute; }}
.ph {{ position: absolute; overflow: hidden; }}
.ph img {{ display: block; width: 100%; height: 100%; }}
.grain {{ position: absolute; inset: 0; background-image: url("{GRAIN}"); opacity: .12; mix-blend-mode: overlay; pointer-events: none; }}
.hl {{ font-family: Jakarta, sans-serif; font-weight: 700; line-height: 1.02; letter-spacing: -.025em; }}
.it {{ font-family: Caslon, serif; font-style: italic; font-weight: 400; letter-spacing: -.01em; }}
.body {{ font-family: Jakarta, sans-serif; font-weight: 400; line-height: 1.4; }}
.label {{ font-family: Jakarta, sans-serif; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; }}
.cta {{ display: inline-flex; align-items: center; justify-content: center; font-family: Jakarta, sans-serif; font-weight: 700; white-space: nowrap;
        background: linear-gradient(180deg, #fffaf1 0%, {CREAM} 55%, #e6dccb 100%); color: {INK}; border-radius: 6px;
        box-shadow: inset 0 -2px 0 rgba(90,70,50,.25), 0 14px 30px rgba(0,0,0,.35); }}
.hand {{ font-family: Caveat, cursive; font-weight: 600; color: #2b2622; line-height: 1.05; }}
"""

STAR = '<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="{c}" style="display:block"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>'
PIN = '<svg viewBox="0 0 24 24" width="{s}" height="{s}" style="display:block;flex:none"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2z" fill="currentColor"/></svg>'
GOOGLE = ('<svg viewBox="0 0 48 48" width="{s}" height="{s}" style="display:block;flex:none">'
          '<path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>'
          '<path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>'
          '<path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/>'
          '<path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>')


def proof(size=24, color=CREAM, text=PROOF):
    stars = "".join(STAR.format(s=round(size * 1.0), c="#f4b740") for _ in range(5))
    return (f'<div style="display:flex;align-items:center;gap:{round(size * .5)}px;color:{color};font-family:Jakarta;font-weight:600;font-size:{size}px;white-space:nowrap">'
            f'{GOOGLE.format(s=round(size * 1.2))}<span style="display:flex;gap:2px">{stars}</span>{text}</div>')


def cta(text=CTA, size=26, h=None):
    h = h or round(size * 3.1)
    return f'<span class="cta" data-name="Button" style="height:{h}px;padding:0 {round(size * 1.6)}px;font-size:{size}px">{text}</span>'


def address(size=22, color=CREAM):
    return (f'<div style="display:flex;align-items:center;gap:{round(size * .5)}px;color:{color};font-size:{size}px;font-weight:500">'
            f'{PIN.format(s=round(size * 1.2))}307 Lytham Road, Blackpool, FY4 1DR</div>')


def crop(src, w, h, fx=.5, fy=.5, zoom=1.0, blur=0):
    """Cover-crop from the real image aspect into a pre-cut file (the Figma capture ignores object-position)."""
    w, h = round(w), round(h)
    out = PH / "crops" / f"{Path(src).stem}-{w}x{h}-{round(fx * 100)}-{round(fy * 100)}-{round(zoom * 100)}-{blur}.jpg"
    if not out.exists():
        out.parent.mkdir(exist_ok=True)
        dims = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries", "stream=width,height",
                               "-of", "csv=p=0", str(PH / src)], capture_output=True, text=True).stdout.strip()
        W, H = map(int, dims.split(","))
        if W / H > w / h:
            ch, cw = H, round(H * w / h)
        else:
            cw, ch = W, round(W * h / w)
        cw, ch = round(cw / zoom), round(ch / zoom)
        x = min(max(round(fx * W - cw / 2), 0), W - cw)
        y = min(max(round(fy * H - ch / 2), 0), H - ch)
        ow = min(cw, 2 * w) // 2 * 2
        vf = f"crop={cw}:{ch}:{x}:{y},scale={ow}:-2" + (f",gblur=sigma={blur}" if blur else "")
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(PH / src), "-vf", vf, "-q:v", "3", str(out)], check=True)
    return f"assets/photos/crops/{out.name}"


def photo(src, x, y, w, h, fx=.5, fy=.5, zoom=1.0, blur=0, extra=""):
    return (f'<div class="ph" data-name="Photo" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;{extra}">'
            f'<img src="{crop(src, w, h, fx, fy, zoom, blur)}"></div>')


def scrim(css):
    return f'<div class="abs" data-name="Overlay (locked)" style="inset:0;background:{css}"></div>'


def esp(a):
    return f"rgba(42,32,24,{a})"


def lit(w, h):
    """Espresso lit like a room: a warm pool top-left, falling off to the edges."""
    return (f"radial-gradient(ellipse {w * .9:.0f}px {h * .7:.0f}px at 28% 18%, rgba(120,88,58,.55), rgba(55,42,31,0) 70%),"
            f"radial-gradient(ellipse {w:.0f}px {h:.0f}px at 80% 100%, rgba(18,13,9,.6), rgba(18,13,9,0) 70%), {ESP}")


def board(size, name, inner, bg=None):
    w, h = SIZES[size]
    return (f'<div class="ab" data-name="Mark | {name} | Static | {SUFFIX[size]} | {DATE}" style="width:{w}px;height:{h}px;background:{bg or lit(w, h)}">'
            f'{inner}<div class="grain"></div></div>')


def page(title, boards):
    return (f"<!doctype html><html lang='en-GB'><head><meta charset='utf-8'><title>{title}</title>"
            f"<style>{CSS}</style><script src='https://mcp.figma.com/mcp/html-to-design/capture.js' async></script>"
            f"</head><body>{''.join(boards)}</body></html>").replace('X-rays', 'X&#8209;rays')


def halo(x, y, w, a=.75):
    """A soft espresso pool behind the logo where it sits over a bright window."""
    h = w * .7
    return (f'<div class="abs" data-name="Overlay (locked)" style="left:{x - w * .45:.0f}px;top:{y - h * .5:.0f}px;width:{w * 1.9:.0f}px;height:{h * 2:.0f}px;'
            f'background:radial-gradient(closest-side,{esp(a)},{esp(a * .5)} 55%,{esp(0)})"></div>')


def at(x, y, html, w=None, extra=""):
    ww = f"width:{w}px;" if w else ""
    return f'<div class="abs" style="left:{x}px;top:{y}px;{ww}{extra}">{html}</div>'


# ---------------------------------------------------------------- Ma1 | Let's just have a look (Custom)
IMG1 = "arc-026-scan-chat.jpg"


def ma1_block(hl, w, body, cta_size, proof_size, gap, inline=False):
    """Headline, line, CTA and proof in one flow so nothing overlaps when lines wrap."""
    foot = (f'<div style="display:flex;align-items:center;gap:{gap * 1.2:.0f}px;margin-top:{gap:.0f}px">{cta(size=cta_size)}{proof(proof_size)}</div>' if inline else
            f'<div style="margin-top:{gap:.0f}px">{cta(size=cta_size)}</div><div style="margin-top:{gap * .8:.0f}px">{proof(proof_size)}</div>')
    return (f'<div style="width:{w}px">'
            f'<div class="hl" style="font-size:{hl}px;white-space:nowrap">It’s been years.</div>'
            f'<div class="it" style="color:{TERRA};font-size:{hl * 1.04:.0f}px;line-height:1.1;white-space:nowrap">Let’s just have a look.</div>'
            f'<div class="body" style="font-size:{body}px;margin-top:{gap * .9:.0f}px;opacity:.92">Private new patient check-up, <b style="font-weight:700">£65</b>, including 2 small X-rays.</div>'
            f'{foot}</div>')


def ma1(size):
    if size == "s1":
        inner = (photo(IMG1, 0, 0, 1080, 1080, fx=.56, fy=.5, zoom=1.0)
                 + scrim(f"linear-gradient(0deg,{esp(.97)} 0%,{esp(.9)} 30%,{esp(.35)} 52%,{esp(0)} 66%)")
                 + scrim(f"linear-gradient(180deg,{esp(.6)} 0%,{esp(0)} 24%)")
                 + halo(64, 56, 176, .6)
                 + at(64, 56, logo(176))
                 + at(64, 600, ma1_block(90, 960, 30, 26, 24, 36, inline=True)))
    elif size == "s9":
        inner = (photo(IMG1, 0, 0, 1080, 1920, fx=.7, fy=.5, zoom=1.0)
                 + scrim(f"linear-gradient(0deg,{esp(.98)} 0%,{esp(.94)} 34%,{esp(.4)} 52%,{esp(0)} 64%)")
                 + scrim(f"linear-gradient(180deg,{esp(.85)} 0%,{esp(.55)} 13%,{esp(0)} 24%)")
                 + halo(72, 270, 190)
                 + at(72, 270, logo(190))
                 + at(72, 1060, ma1_block(88, 940, 34, 30, 26, 44)))
    else:
        inner = (photo(IMG1, 470, 0, 730, 628, fx=.6, fy=.4, zoom=1.0)
                 + f'<div class="abs" data-name="Overlay (locked)" style="left:470px;top:0;width:260px;height:628px;background:linear-gradient(90deg,{ESP} 0%,{esp(.85)} 30%,{esp(0)} 100%)"></div>'
                 + at(56, 44, logo(132))
                 + at(56, 178, ma1_block(46, 520, 20, 19, 17, 26)))
    return board(size, "Let's just have a look", inner, bg=ESP)


# ---------------------------------------------------------------- Ma2 | Find out where you stand (VT-06 Offer footer)
IMG2 = "arc-122-reception-phone.jpg"


def offer_block(scale=1.0, w=560):
    s = scale
    return (f'<div class="label" style="font-size:{19 * s:.0f}px;color:{TERRA}">Private new patient check-up</div>'
            f'<div class="it" style="font-size:{46 * s:.0f}px;margin-top:{14 * s:.0f}px;color:{CREAM}">Find out where you stand for</div>'
            f'<div class="hl" style="font-size:{200 * s:.0f}px;line-height:.9;letter-spacing:-.045em;margin-top:{6 * s:.0f}px;'
            f'text-shadow:0 0 60px rgba(227,146,95,.25)">£65</div>'
            f'<div class="body" style="font-size:{25 * s:.0f}px;margin-top:{20 * s:.0f}px;width:{w * s:.0f}px;opacity:.9">'
            f'A full check-up and 2 small X-rays. Any costs explained before anything is agreed.</div>')


def ma2(size):
    if size == "s1":
        inner = (photo(IMG2, 0, 0, 1080, 520, fx=.6, fy=.55, zoom=1.15)
                 + scrim(f"linear-gradient(180deg,{esp(0)} 34%,{esp(.6)} 47%,{esp(0)} 48.2%)")
                 + f'<div class="abs" style="left:0;top:520px;width:1080px;height:560px;background:{lit(1080, 560)}"></div>'
                 + f'<div class="abs" style="left:0;top:518px;width:1080px;height:3px;background:{TERRA};opacity:.85"></div>'
                 + at(64, 572, offer_block(.84, 640).replace('font-size:21px','font-size:24px'))
                 + f'<div class="abs" style="left:700px;top:580px;width:1.5px;height:300px;background:{TAN};opacity:.45"></div>'
                 + at(742, 590, logo(230))
                 + at(742, 760, proof(20))
                 + at(742, 812, cta(size=22))
                 + f'<div class="abs" style="left:64px;top:968px;width:952px;height:1.5px;background:{TAN};opacity:.35"></div>'
                 + at(0, 1000, address(22), 1080, "display:flex;justify-content:center"))
    elif size == "s9":
        inner = (photo(IMG2, 0, 0, 1080, 1010, fx=.7, fy=.55, zoom=1.0)
                 + f'<div class="abs" style="left:0;top:1010px;width:1080px;height:910px;background:{lit(1080, 910)}"></div>'
                 + f'<div class="abs" style="left:0;top:1008px;width:1080px;height:3px;background:{TERRA};opacity:.85"></div>'
                 + scrim(f"linear-gradient(180deg,{esp(.55)} 0%,{esp(0)} 13%)")
                 + halo(72, 270, 170)
                 + at(72, 270, logo(170))
                 + at(72, 1070, offer_block(1.0, 900).replace('font-size:25px','font-size:31px'))
                 + at(72, 1490, proof(26))
                 + at(560, 1462, cta(size=28)))
    else:
        inner = (photo(IMG2, 0, 0, 560, 628, fx=.62, fy=.5, zoom=1.0)
                 + f'<div class="abs" style="left:558px;top:0;width:3px;height:628px;background:{TERRA};opacity:.85"></div>'
                 + f'<div class="abs" style="left:561px;top:0;width:639px;height:628px;background:{lit(640, 628)}"></div>'
                 + at(608, 40, logo(118))
                 + at(608, 150, offer_block(.62, 830).replace('font-size:16px','font-size:19px'))
                 + at(608, 452, cta(size=18))
                 + at(608, 564, address(16)))
    return board(size, "Find out where you stand", inner)


# ---------------------------------------------------------------- Ma3 | The to-do list (VT-31 Handwritten sign)
IMG3 = "arc-150-reception-room.jpg"
TICK = '<svg viewBox="0 0 40 40" width="{s}" height="{s}" style="display:block;flex:none"><path d="M6 21 L16 31 L35 7" fill="none" stroke="{c}" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
BOX = '<svg viewBox="0 0 40 40" width="{s}" height="{s}" style="display:block;flex:none"><path d="M7 8 Q20 6 33 8 Q35 21 33 33 Q20 35 7 33 Q5 20 7 8 Z" fill="none" stroke="#2b2622" stroke-width="3" stroke-linejoin="round"/></svg>'
CIRCLE = ('<svg viewBox="0 0 300 110" preserveAspectRatio="none" style="position:absolute;left:-6%;top:-14%;width:112%;height:128%">'
          '<path d="M30 58 C 34 18, 150 6, 250 16 C 300 24, 296 84, 230 96 C 150 108, 40 104, 22 70 C 14 52, 40 30, 90 22" fill="none" stroke="#c0392b" stroke-width="4" stroke-linecap="round"/></svg>')


def note(w, s):
    """A paper note with masking tape and a real-feeling shadow; s scales the handwriting."""
    items = [("Car MOT", True), ("Boiler service", True), ("Sort the gutter", True)]
    rows = "".join(f'<div style="display:flex;align-items:center;gap:{18 * s:.0f}px;margin-top:{14 * s:.0f}px">'
                   f'{TICK.format(s=round(40 * s), c="#2b2622")}<span class="hand" style="font-size:{50 * s:.0f}px;text-decoration:line-through;text-decoration-thickness:{3 * s:.1f}px;opacity:.75">{t}</span></div>'
                   for t, _ in items)
    rows += (f'<div style="display:flex;align-items:center;gap:{18 * s:.0f}px;margin-top:{18 * s:.0f}px">{BOX.format(s=round(40 * s))}'
             f'<span class="hand" style="position:relative;font-size:{62 * s:.0f}px;font-weight:700">Ring the dentist{CIRCLE}</span></div>'
             f'<div class="hand" style="font-size:{36 * s:.0f}px;margin:{6 * s:.0f}px 0 0 {58 * s:.0f}px;color:#5b524a">(it’s been years…)</div>')
    paper = ("background:linear-gradient(170deg,#fffdf7 0%,#f8f2e4 60%,#efe6d2 100%);"
             "box-shadow:0 1px 0 rgba(255,255,255,.6) inset, 0 2px 3px rgba(0,0,0,.25), 0 18px 30px rgba(0,0,0,.35), 0 40px 80px rgba(0,0,0,.35);")
    lines = "".join(f'<div class="abs" style="left:0;right:0;top:{(150 + i * 66) * s:.0f}px;height:1.5px;background:rgba(80,120,160,.18)"></div>' for i in range(7))
    tape = (f'<div class="abs" style="left:50%;top:{-26 * s:.0f}px;width:{190 * s:.0f}px;height:{56 * s:.0f}px;transform:translateX(-50%) rotate(-3deg);'
            f'background:linear-gradient(180deg,rgba(232,220,190,.88),rgba(214,200,166,.86));box-shadow:0 2px 6px rgba(0,0,0,.18);'
            f'clip-path:polygon(2% 8%,98% 0,100% 92%,0 100%)"></div>')
    return (f'<div class="abs" data-name="Sign" style="position:relative;width:{w}px;padding:{44 * s:.0f}px {48 * s:.0f}px {50 * s:.0f}px;{paper}">'
            f'{lines}{tape}<div class="hand" style="position:relative;font-size:{70 * s:.0f}px;font-weight:700">To do</div>{rows}</div>')


def ma3(size):
    if size == "s1":
        inner = (photo(IMG3, 0, 0, 1080, 1080, fx=.6, fy=.45, zoom=1.0, blur=14)
                 + scrim(f"linear-gradient(0deg,{esp(.95)} 0%,{esp(.75)} 22%,{esp(.25)} 50%,{esp(.35)} 100%)")
                 + at(118, 70, note(620, 1.0), extra="transform:rotate(-2.5deg)")
                 + at(64, 834, f'<div class="hl" style="font-size:58px">Tick it off. <span class="it" style="color:{TERRA}">£65.</span></div>', 620)
                 + at(64, 912, f'<div class="body" style="font-size:24px;opacity:.9">Private new patient check-up with 2 small X-rays.<br>Family-run in Blackpool for over 40 years.</div>', 640)
                 + at(780, 72, logo(220))
                 + at(712, 940, cta(size=24)))
    elif size == "s9":
        inner = (photo(IMG3, 0, 0, 1080, 1920, fx=.6, fy=.45, zoom=1.0, blur=14)
                 + scrim(f"linear-gradient(0deg,{esp(.96)} 0%,{esp(.8)} 26%,{esp(.25)} 50%,{esp(.4)} 100%)")
                 + at(72, 270, logo(190))
                 + at(150, 560, note(760, 1.18), extra="transform:rotate(-2.5deg)")
                 + at(72, 1330, f'<div class="hl" style="font-size:80px">Tick it off. <span class="it" style="color:{TERRA}">£65.</span></div>', 940)
                 + at(72, 1440, f'<div class="body" style="font-size:30px;opacity:.9">Private new patient check-up with 2 small X-rays. Family-run in Blackpool for over 40 years.</div>', 900)
                 + at(72, 1555, f'<div style="display:flex;align-items:center;gap:36px">{cta(size=28)}{proof(24)}</div>'))
    else:
        inner = (photo(IMG3, 0, 0, 1200, 628, fx=.6, fy=.45, zoom=1.0, blur=10)
                 + scrim(f"linear-gradient(90deg,{esp(.95)} 0%,{esp(.85)} 38%,{esp(.2)} 70%,{esp(.3)} 100%)")
                 + at(56, 44, logo(132))
                 + at(56, 214, f'<div class="hl" style="font-size:56px">Tick it off.<br><span class="it" style="color:{TERRA}">£65.</span></div>', 520)
                 + at(56, 360, f'<div class="body" style="font-size:19px;opacity:.9">Private new patient check-up with 2 small X-rays. Family-run in Blackpool for over 40 years.</div>', 440)
                 + at(56, 470, cta(size=18))
                 + at(56, 560, proof(17))
                 + at(690, 70, note(440, .7), extra="transform:rotate(2deg)"))
    return board(size, "To do list", inner)


if __name__ == "__main__":
    for size, suf in (("s1", "1x1"), ("s9", "9x16"), ("ls", "landscape")):
        (ROOT / f"mark-{suf}.html").write_text(page(f"Mark | {suf}", [ma1(size), ma2(size), ma3(size)]))
    print("built mark-1x1.html, mark-9x16.html, mark-landscape.html")
