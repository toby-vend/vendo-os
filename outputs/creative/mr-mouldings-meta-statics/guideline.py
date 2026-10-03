"""Build the MR Mouldings brand guideline page for Figma capture.

Usage: python3 guideline.py   -> writes guideline.html (8 sections, 1920x1080 each)
Sources: VD_2024_AUG_MR_MOULDINGS_BRAND_GUIDELINES.pdf (palette, type, logo rules)
         + live site tokens (mr-home.css, vendo.css) + site copy for tone of voice.
"""
import re
import struct
from pathlib import Path

ROOT = Path(__file__).parent
A = ROOT / "assets"

C = dict(
    teal="#008080", slate="#2F4F4F", stone="#F5F3EB", grey="#D3D3D3", white="#FFFFFF",
    ink="#1D1D1D", ink_soft="#4D4D4D", muted="#6B6B6B", hair="#DDDDDD",
    teal_dark="#006A6A", teal_light="#7FD1D1", on_slate="#C9D4D4", fire="#A3402E", star="#FFAB41",
)


def logo(variant="colour", cls="logo", style=""):
    """Inline master logo, cropped to the mark (the master file has wide padding)."""
    s = (A / f"logo-{variant}.svg").read_text()
    s = re.sub(r"<\?xml.*?\?>", "", s)
    s = s.replace('viewBox="0 0 1045.43 922.44"', f'viewBox="236 228 573 466" class="{cls}" style="{style}"', 1)
    # ids must stay unique when the logo appears many times on one page
    n = logo.count = getattr(logo, "count", 0) + 1
    s = s.replace('id="clippath"', f'id="cp{n}"').replace("url(#clippath)", f"url(#cp{n})")
    s = s.replace("cls-", f"l{n}-")
    return s


def aspect(img):
    data = (A / "photos" / img).read_bytes()
    i = 2
    while i < len(data):
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        seg = struct.unpack(">H", data[i + 2:i + 4])[0]
        if marker in (0xC0, 0xC1, 0xC2):
            h, w = struct.unpack(">HH", data[i + 5:i + 9])
            return w / h
        i += 2 + seg
    raise ValueError(img)


def photo(x, y, w, h, img, fx=0.5, fy=0.5, zoom=1.0, extra=""):
    """Cover-crop a photo into a box from its real aspect ratio (never stretched)."""
    a = aspect(img)
    bw, bh = (w, w / a) if w / h > a else (h * a, h)
    bw, bh = bw * zoom, bh * zoom
    ox, oy = -(bw - w) * fx, -(bh - h) * fy
    return (f'<div class="ph" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;'
            f'background-image:url(assets/photos/{img});background-size:{bw:.0f}px {bh:.0f}px;'
            f'background-position:{ox:.0f}px {oy:.0f}px;{extra}"></div>')


STAR = '<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="currentColor"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>'


def proof(color, size=20, text="4.6 from 11,700+ product reviews"):
    stars = "".join(STAR.format(s=size) for _ in range(5))
    return (f'<div style="display:flex;align-items:center;gap:12px;color:{color}">'
            f'<span style="display:flex;gap:2px;color:{C["star"]}">{stars}</span>'
            f'<span class="sans" style="font-size:{size}px;font-weight:500">{text}</span></div>')


# Ogee skirting profile drawn as a single line (graphic device: the moulding cross-section)
PROFILE = ('<svg viewBox="0 0 120 420" class="{cls}" style="{style}" fill="none" stroke="currentColor" '
           'stroke-width="{sw}" vector-effect="non-scaling-stroke" stroke-linejoin="round">'
           '<path d="M8 416 V8 H40 C40 34 58 40 66 52 C76 66 74 86 92 92 H100 V416 Z"/></svg>')

# Open frame from the logo: three sides, gaps at the bottom corners
def frame(x, y, w, h, color, t=6, foot=0.12, extra=""):
    f = int(w * foot)
    return (f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;{extra}">'
            f'<div class="abs" style="left:0;top:0;width:{w}px;height:{t}px;background:{color}"></div>'
            f'<div class="abs" style="left:0;top:0;width:{t}px;height:{h}px;background:{color}"></div>'
            f'<div class="abs" style="right:0;top:0;width:{t}px;height:{h}px;background:{color}"></div>'
            f'<div class="abs" style="left:0;bottom:0;width:{f}px;height:{t}px;background:{color}"></div>'
            f'<div class="abs" style="right:0;bottom:0;width:{f}px;height:{t}px;background:{color}"></div></div>')


GRAIN = ("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>"
         "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.9 0'/></filter>"
         "<rect width='100%' height='100%' filter='url(%23n)'/></svg>")

CSS = f"""
@font-face {{ font-family: Bitter; src: url(assets/fonts/Bitter-VF.ttf); font-weight: 100 900; font-style: normal; }}
@font-face {{ font-family: Bitter; src: url(assets/fonts/Bitter-Italic-VF.ttf); font-weight: 100 900; font-style: italic; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ background: #1a1a1a; display: flex; flex-direction: column; gap: 120px; padding: 120px; align-items: flex-start; }}
.sec {{ position: relative; width: 1920px; height: 1080px; overflow: hidden; flex: none; background: {C['stone']}; color: {C['ink']}; }}
.abs {{ position: absolute; }}
.ph {{ position: absolute; background-repeat: no-repeat; }}
.serif {{ font-family: Bitter, Georgia, serif; }}
.sans {{ font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; }}
.eyebrow {{ font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; }}
.h1 {{ font-family: Bitter, serif; font-weight: 600; font-size: 72px; line-height: 1.04; letter-spacing: -.01em; }}
.h2 {{ font-family: Bitter, serif; font-weight: 600; font-size: 34px; line-height: 1.15; }}
.h3 {{ font-family: Bitter, serif; font-weight: 600; font-size: 24px; line-height: 1.2; }}
.body {{ font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 20px; line-height: 1.55; color: {C['ink_soft']}; }}
.small {{ font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.5; color: {C['muted']}; }}
.mono {{ font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 500; letter-spacing: .04em; }}
.logo {{ display: block; }}
.pagehead {{ position: absolute; left: 120px; right: 120px; top: 64px; display: flex; justify-content: space-between; align-items: center;
  border-bottom: 1px solid {C['hair']}; padding-bottom: 20px; }}
.sw {{ position: absolute; border-radius: 4px; }}
.card {{ position: absolute; background: {C['white']}; border-radius: 6px; }}
.cross {{ position: absolute; right: 14px; top: 14px; width: 30px; height: 30px; border-radius: 50%; background: {C['fire']}; color: #fff;
  font-family: "Helvetica Neue", sans-serif; font-weight: 700; font-size: 18px; display: flex; align-items: center; justify-content: center; }}
.tick {{ background: {C['teal']}; }}
.grain {{ position: absolute; inset: 0; background-image: url("{GRAIN}"); opacity: .10; mix-blend-mode: overlay; }}
.btn {{ display: inline-flex; align-items: center; height: 56px; padding: 0 30px; border-radius: 3px; font-family: "Helvetica Neue", sans-serif;
  font-size: 16px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }}
"""


def head(num, title, dark=False):
    col = C["on_slate"] if dark else C["muted"]
    line = "rgba(255,255,255,.18)" if dark else C["hair"]
    return (f'<div class="pagehead" style="border-color:{line};color:{col}">'
            f'<span class="eyebrow">{num} &nbsp;·&nbsp; {title}</span>'
            f'<span class="eyebrow">MR Mouldings &nbsp;·&nbsp; Brand Guidelines</span></div>')


def sec(name, inner, bg=None, color=None):
    st = ""
    if bg:
        st += f"background:{bg};"
    if color:
        st += f"color:{color};"
    return f'<section class="sec" data-name="{name}" style="{st}">{inner}</section>'


# ------------------------------------------------------------------ 01 COVER
cover = sec("01 Cover", f"""
{photo(0, 0, 1920, 1080, "architrave-block-rosette-flexi-regency-architrave-curved-windowhallway.jpg", fy=0.42)}
<div class="abs" style="inset:0;background:linear-gradient(90deg, rgba(47,79,79,.96) 0%, rgba(47,79,79,.9) 38%, rgba(47,79,79,.2) 70%, rgba(47,79,79,0) 100%)"></div>
<div class="grain"></div>
<div class="abs" style="left:120px;top:120px">{logo("white", style="width:220px;height:auto")}</div>
<div class="abs" style="left:120px;top:520px;width:820px;color:#fff">
  <div class="eyebrow" style="color:{C['teal_light']}">Brand Guidelines &nbsp;·&nbsp; Version 2.0</div>
  <div class="serif" style="font-size:112px;font-weight:600;line-height:1;letter-spacing:-.015em;margin-top:28px">Made to match.</div>
  <div class="sans" style="font-size:24px;line-height:1.5;color:{C['on_slate']};margin-top:30px;max-width:640px">
    Skirting boards, architraves and mouldings, manufactured in Epsom, Surrey since 2003.</div>
</div>
<div class="abs sans" style="left:120px;bottom:72px;color:{C['on_slate']};font-size:15px;letter-spacing:.08em">
  OCTOBER 2026 &nbsp;·&nbsp; PREPARED BY VENDO DIGITAL &nbsp;·&nbsp; MDFSKIRTINGMOULDINGS.CO.UK</div>
""", bg=C["slate"])

# ------------------------------------------------------------------ 02 LOGO
misuse = [
    ("Don't stretch or squash", "transform:scaleX(1.45)"),
    ("Don't recolour", "filter:hue-rotate(150deg) saturate(2)"),
    ("Don't add outlines or shadows", "filter:drop-shadow(6px 8px 4px rgba(0,0,0,.45))"),
    ("Don't rotate", "transform:rotate(-14deg)"),
    ("Don't place on busy photos", None),
    ("Don't change the lock-up", None),
]
mis = ""
for i, (label, css) in enumerate(misuse):
    x = 1010 + (i % 3) * 270
    y = 520 + (i // 3) * 250
    if label.startswith("Don't place"):
        body = (photo(0, 0, 250, 170, "img-6888-karen.jpg", fy=0.4, extra="border-radius:6px 6px 0 0")
                + f'<div class="abs" style="left:65px;top:30px">{logo("colour", style="width:120px;height:auto")}</div>')
    elif label.startswith("Don't change"):
        # wordmark pulled out of the frame and set beside it: deliberately wrong
        body = (f'<div class="abs" style="left:24px;top:52px;width:70px;height:62px;overflow:hidden">'
                f'{logo("colour", style="width:150px;height:auto;margin-left:-40px;margin-top:-20px")}</div>'
                f'<div class="abs serif" style="left:104px;top:64px;font-size:22px;font-weight:700;color:{C["ink"]}">MR<br>Mouldings</div>')
    else:
        body = f'<div class="abs" style="left:65px;top:30px">{logo("colour", style=f"width:120px;height:auto;{css}")}</div>'
    mis += (f'<div class="card" style="left:{x}px;top:{y}px;width:250px;height:230px;overflow:hidden">{body}'
            f'<div class="cross">✕</div>'
            f'<div class="abs small" style="left:16px;bottom:14px;right:16px;color:{C["ink_soft"]}">{label}</div></div>')

logo_sec = sec("02 Logo", f"""
{head("02", "Logo")}
<div class="abs" style="left:120px;top:150px;width:760px">
  <div class="h1">The frame and the monogram.</div>
  <div class="body" style="margin-top:24px">The mark is an open frame, like an architrave around a doorway, holding the MR monogram.
  Use the master artwork only. Never redraw, re-space or recolour it.</div>
</div>
<div class="card" style="left:120px;top:420px;width:400px;height:300px;display:flex;align-items:center;justify-content:center">{logo("colour", style="width:220px;height:auto")}</div>
<div class="sw" style="left:540px;top:420px;width:400px;height:300px;background:{C['slate']};display:flex;align-items:center;justify-content:center">{logo("colour-white", style="width:220px;height:auto")}</div>
<div class="sw" style="left:120px;top:740px;width:400px;height:220px;background:{C['teal']};display:flex;align-items:center;justify-content:center">{logo("white", style="width:160px;height:auto")}</div>
<div class="card" style="left:540px;top:740px;width:400px;height:220px;display:flex;align-items:center;justify-content:center">{logo("black", style="width:160px;height:auto")}</div>
<div class="abs small" style="left:120px;top:968px;width:820px">Colour on Stone or white &nbsp;·&nbsp; Colour reversed on Slate &nbsp;·&nbsp; White on Teal or photography &nbsp;·&nbsp; Black for single-colour print</div>

<div class="abs" style="left:1010px;top:150px;width:790px">
  <div class="h3">Clear space and minimum size</div>
  <div class="body" style="margin-top:10px;font-size:17px">Keep clear space equal to the height of the "M" on every side. Minimum width 90px on screen, 22mm in print.</div>
</div>
<div class="card" style="left:1010px;top:270px;width:790px;height:210px">
  <div class="abs" style="left:262px;top:22px;width:198px;height:166px;background:rgba(0,128,128,.08);border:1.5px dashed {C['teal']}"></div>
  <div class="abs" style="left:296px;top:50px;width:130px;height:110px;background:{C['white']}"></div>
  <div class="abs" style="left:296px;top:50px">{logo("colour", style="width:130px;height:auto")}</div>
  <div class="abs" style="left:262px;top:89px;width:34px;height:34px;background:{C['teal']};opacity:.35"></div>
  <div class="abs" style="left:426px;top:89px;width:34px;height:34px;background:{C['teal']};opacity:.35"></div>
  <div class="abs" style="left:344px;top:22px;width:34px;height:28px;background:{C['teal']};opacity:.35"></div>
  <div class="abs" style="left:344px;top:160px;width:34px;height:28px;background:{C['teal']};opacity:.35"></div>
  <div class="abs mono" style="left:60px;top:96px;color:{C['teal']}">x = height of "M"</div>
  <div class="abs" style="left:600px;top:78px">{logo("colour", style="width:56px;height:auto")}</div>
  <div class="abs mono" style="left:588px;top:140px;color:{C['muted']}">90px min</div>
</div>
<div class="abs h3" style="left:1010px;top:488px;font-size:20px;color:{C['ink_soft']}">Misuse</div>
{mis}
""")

# ------------------------------------------------------------------ 03 COLOUR
def swatch(x, y, w, h, hexv, name, role, dark_text=False, border=False):
    tc = C["ink"] if dark_text else "#fff"
    b = f"border:1px solid {C['hair']};" if border else ""
    return (f'<div class="sw" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;background:{hexv};{b}color:{tc}">'
            f'<div class="abs h3" style="left:28px;bottom:74px">{name}</div>'
            f'<div class="abs mono" style="left:28px;bottom:48px">{hexv.upper()}</div>'
            f'<div class="abs sans" style="left:28px;bottom:24px;font-size:14px;opacity:.8">{role}</div></div>')

colour = sec("03 Colour", f"""
{head("03", "Colour")}
<div class="abs" style="left:120px;top:150px;width:700px">
  <div class="h1">Calm, architectural, painted.</div>
  <div class="body" style="margin-top:24px">Teal and Slate carry the brand. Stone is the canvas: it reads like a freshly
  primed wall and lets the profiles do the talking. Support colours are functional, not decorative.</div>
</div>
<div class="abs eyebrow" style="left:120px;top:452px;color:{C['muted']}">Primary</div>
{swatch(120, 488, 420, 280, C['teal'], "Teal", "Accent · CTAs · highlights")}
{swatch(560, 488, 420, 280, C['slate'], "Slate Grey", "Foundation · dark backgrounds")}
<div class="abs eyebrow" style="left:1000px;top:452px;color:{C['muted']}">Neutrals</div>
{swatch(1000, 488, 260, 280, C['stone'], "Stone", "Canvas", True, True)}
{swatch(1280, 488, 250, 280, C['grey'], "Light Grey", "Lines · secondary", True)}
{swatch(1550, 488, 250, 280, C['ink'], "Ink", "Body text")}
<div class="abs eyebrow" style="left:120px;top:806px;color:{C['muted']}">Support (use sparingly)</div>
{swatch(120, 842, 320, 140, C['teal_dark'], "Teal Dark", "Hover · pressed")}
{swatch(460, 842, 320, 140, C['teal_light'], "Teal Light", "On Slate only", True)}
{swatch(800, 842, 320, 140, C['fire'], "Fire Red", "Fire-rated range only")}
{swatch(1140, 842, 320, 140, C['star'], "Star", "Review stars only", True)}
<div class="abs" style="left:1480px;top:842px;width:320px;height:150px">
  <div class="small" style="margin-bottom:12px">Balance across a layout</div>
  <div style="display:flex;height:40px;border-radius:4px;overflow:hidden">
    <div style="flex:55;background:{C['stone']};border:1px solid {C['hair']}"></div><div style="flex:22;background:{C['slate']}"></div>
    <div style="flex:13;background:{C['teal']}"></div><div style="flex:7;background:{C['ink']}"></div><div style="flex:3;background:{C['star']}"></div></div>
  <div class="small" style="margin-top:12px">55 Stone · 22 Slate · 13 Teal · 7 Ink · 3 support</div>
</div>
""")

# ------------------------------------------------------------------ 04 TYPOGRAPHY
scale = [
    ("Display", "Bitter SemiBold · 96 / 100", '<span class="serif" style="font-size:96px;font-weight:600;line-height:1">Torus</span>'),
    ("H1", "Bitter SemiBold · 64 / 68", '<span class="serif" style="font-size:64px;font-weight:600">Architraves</span>'),
    ("H2", "Bitter SemiBold · 40 / 46", '<span class="serif" style="font-size:40px;font-weight:600">Panel mouldings</span>'),
    ("Eyebrow", "Helvetica Neue Bold · 16 caps", '<span class="eyebrow" style="color:#008080">Made-to-match service</span>'),
    ("Body", "Helvetica Neue Regular · 20 / 31", '<span class="sans" style="font-size:20px;color:#4D4D4D">Over 150 profiles, cut and finished in our own workshop.</span>'),
]
rows = ""
for i, (lab, spec, sample) in enumerate(scale):
    y = 400 + sum([150, 112, 86, 70, 70][:i])
    rows += (f'<div class="abs" style="left:1010px;top:{y}px;width:790px;border-top:1px solid {C["hair"]};padding-top:14px;display:flex;align-items:baseline">'
             f'<div style="width:190px"><div class="mono" style="color:{C["ink"]}">{lab}</div><div class="small" style="font-size:13px">{spec}</div></div>'
             f'<div>{sample}</div></div>')

typo = sec("04 Typography", f"""
{head("04", "Typography")}
<div class="abs" style="left:120px;top:150px;width:780px">
  <div class="h1">A crafted serif with a clean, trade-ready sans.</div>
</div>
<div class="card" style="left:120px;top:400px;width:400px;height:560px;padding:36px">
  <div class="eyebrow" style="color:{C['teal']}">Primary · Headlines</div>
  <div class="serif" style="font-size:180px;font-weight:600;line-height:1;margin-top:36px">Aa</div>
  <div class="serif" style="font-size:30px;font-weight:600;margin-top:18px">Bitter</div>
  <div class="small" style="margin-top:8px">Regular · Italic · SemiBold · Bold<br>Free Google font</div>
  <div class="serif" style="font-size:19px;line-height:1.5;margin-top:24px;color:{C['ink_soft']}">ABCDEFGHIJKLMNOPQRSTUVWXYZ<br>abcdefghijklmnopqrstuvwxyz<br>0123456789 £ & ( ) · ★</div>
</div>
<div class="card" style="left:540px;top:400px;width:400px;height:560px;padding:36px">
  <div class="eyebrow" style="color:{C['teal']}">Secondary · Body</div>
  <div class="sans" style="font-size:180px;font-weight:500;line-height:1;margin-top:36px">Aa</div>
  <div class="sans" style="font-size:30px;font-weight:700;margin-top:18px">Helvetica Neue</div>
  <div class="small" style="margin-top:8px">Regular · Medium · Bold<br>Fallback: Helvetica, Arial</div>
  <div class="sans" style="font-size:19px;line-height:1.5;margin-top:24px;color:{C['ink_soft']}">ABCDEFGHIJKLMNOPQRSTUVWXYZ<br>abcdefghijklmnopqrstuvwxyz<br>0123456789 £ & ( ) · ★</div>
</div>
<div class="abs" style="left:1010px;top:150px;width:790px">
  <div class="h3">Hierarchy</div>
  <div class="body" style="margin-top:10px;font-size:17px">Bitter for anything the eye lands on first. Helvetica Neue for everything you read.
  Sentence case for headlines; caps only for short eyebrows.</div>
</div>
{rows}
""")

# ------------------------------------------------------------------ 05 GRAPHIC ELEMENTS
graphic = sec("05 Graphic elements", f"""
{head("05", "Graphic elements")}
<div class="abs" style="left:120px;top:150px;width:900px">
  <div class="h1">Borrowed from the joinery.</div>
  <div class="body" style="margin-top:24px">Three devices, all taken from the product: the open frame from the logo, the panel line from
  panel moulding, and the profile line, the cross-section every customer is trying to match.</div>
</div>
<div class="card" style="left:120px;top:420px;width:540px;height:560px;overflow:hidden">
  <div class="abs" style="left:0;top:0;width:540px;height:400px;background:{C['slate']}"></div>
  {frame(110, 70, 320, 260, C['teal_light'], t=5)}
  <div class="abs serif" style="left:140px;top:150px;width:260px;color:#fff;font-size:36px;font-weight:600;line-height:1.1;text-align:center">Made<br>to match.</div>
  <div class="abs h3" style="left:32px;top:424px">01 &nbsp;The open frame</div>
  <div class="abs small" style="left:32px;top:462px;width:470px">Three sides and two short feet, lifted from the logo. Frames a headline or a single product.
  Line weight 4 to 6px at 1080. Never close the bottom.</div>
</div>
<div class="card" style="left:690px;top:420px;width:540px;height:560px;overflow:hidden">
  {photo(0, 0, 540, 400, "img-6795-karen.jpg", fy=0.45)}
  <div class="abs" style="left:40px;top:40px;width:460px;height:320px;border:2px solid rgba(255,255,255,.85)"></div>
  <div class="abs" style="left:56px;top:56px;width:428px;height:288px;border:1px solid rgba(255,255,255,.55)"></div>
  <div class="abs h3" style="left:32px;top:424px">02 &nbsp;The panel line</div>
  <div class="abs small" style="left:32px;top:462px;width:470px">A double hairline inset on photography, echoing a box of panel moulding.
  White at 85% and 55%. Keeps type zones tidy on busy rooms.</div>
</div>
<div class="card" style="left:1260px;top:420px;width:540px;height:560px;overflow:hidden">
  <div class="abs" style="left:0;top:0;width:540px;height:400px;background:{C['stone']}"></div>
  <div class="abs" style="left:70px;top:40px;color:{C['teal']}">{PROFILE.format(cls="", style="width:100px;height:330px", sw=3)}</div>
  <div class="abs" style="left:220px;top:40px;color:{C['slate']}">{PROFILE.format(cls="", style="width:70px;height:240px", sw=3)}</div>
  <div class="abs mono" style="left:310px;top:250px;color:{C['muted']}">Ogee 2 &nbsp;·&nbsp; 18 × 145mm</div>
  <div class="abs" style="left:310px;top:290px">{proof(C['ink'], 15, "4.6 · 11,700+ reviews")}</div>
  <div class="abs h3" style="left:32px;top:424px">03 &nbsp;The profile line</div>
  <div class="abs small" style="left:32px;top:462px;width:470px">A single-weight line drawing of the moulding's cross-section, labelled like a spec sheet.
  Shows the exact shape the customer is matching. Pair with the review strip for proof.</div>
</div>
""")

# ------------------------------------------------------------------ 06 PHOTOGRAPHY
photography = sec("06 Photography", f"""
{head("06", "Photography")}
<div class="abs" style="left:120px;top:150px;width:520px">
  <div class="h1">Real rooms. The detail in focus.</div>
  <div class="body" style="margin-top:24px">Finished, painted mouldings in real UK homes, shot in natural light.
  Period hallways, staircases and panelled rooms are our strongest frames.</div>
  <div class="h3" style="margin-top:40px;color:{C['teal']}">Do</div>
  <div class="body" style="font-size:17px;margin-top:8px">Show the profile catching the light · Keep corners and mitres in shot ·
  Let colour come from the paint · Crop tight enough to read the moulding</div>
  <div class="h3" style="margin-top:28px;color:{C['fire']}">Avoid</div>
  <div class="body" style="font-size:17px;margin-top:8px">CGI renders as the lead image · Raw MDF as a hero (fine for process) ·
  Clutter covering the skirting · Heavy filters</div>
</div>
{photo(720, 150, 520, 830, "astragal-dado-blue-hallway.jpg", fy=0.5)}
{photo(1260, 150, 260, 405, "img-6881-karen.jpg", fy=0.5)}
{photo(1540, 150, 260, 405, "done-img-6327-karen.jpg", fy=0.5)}
{photo(1260, 575, 540, 405, "img-6888-karen.jpg", fy=0.45)}
<div class="abs small" style="left:720px;top:990px;width:1080px">Client photography: Drive › MR Mouldings › lookbook › Images and August 2025 Images.</div>
""")

# ------------------------------------------------------------------ 07 TONE OF VOICE
pairs = [
    ("Send us a photo. We'll match the profile.", "Unlock bespoke moulding solutions for your space."),
    ("Over 150 profiles, cut in our own workshop in Epsom.", "Premium quality you can trust."),
    ("Bends to the curve. No steaming, no kerfing.", "Revolutionary flexible technology!"),
]
pr = ""
for i, (yes, no) in enumerate(pairs):
    y = 520 + i * 150
    pr += (f'<div class="card" style="left:1010px;top:{y}px;width:385px;height:130px;padding:22px 24px">'
           f'<div class="eyebrow" style="color:{C["teal"]};font-size:13px">We say</div>'
           f'<div class="serif" style="font-size:21px;font-weight:600;margin-top:10px;line-height:1.3">{yes}</div></div>'
           f'<div class="card" style="left:1415px;top:{y}px;width:385px;height:130px;padding:22px 24px;background:transparent;border:1px solid {C["hair"]}">'
           f'<div class="eyebrow" style="color:{C["fire"]};font-size:13px">Not</div>'
           f'<div class="sans" style="font-size:19px;margin-top:10px;line-height:1.35;color:{C["muted"]}">{no}</div></div>')
principles = [
    ("Lead with the match", "68% of surveyed customers chose us for the exact profile and size. Say that first."),
    ("Name the profile", "Torus, Ogee 2, Edwardian. Specific beats generic every time."),
    ("Talk like the trade", "Plain, practical, confident. Mitres, lengths, finishes. No hype."),
    ("Show the proof", "Since 2003, our own workshop, 11,700+ reviews. Facts, not adjectives."),
]
pp = "".join(
    f'<div class="abs" style="left:120px;top:{430 + i * 132}px;width:820px;border-top:1px solid {C["hair"]};padding-top:18px;display:flex;gap:30px">'
    f'<div class="serif" style="font-size:40px;font-weight:600;color:{C["teal"]};width:60px">0{i + 1}</div>'
    f'<div><div class="h3">{t}</div><div class="body" style="font-size:18px;margin-top:6px">{d}</div></div></div>'
    for i, (t, d) in enumerate(principles))

tone = sec("07 Tone of voice", f"""
{head("07", "Tone of voice")}
<div class="abs" style="left:120px;top:150px;width:1000px">
  <div class="h1">The joiner who knows every profile.</div>
  <div class="body" style="margin-top:24px">Knowledgeable, helpful and straight to the point. UK English, no exclamation marks, no em dashes in ads.</div>
</div>
{pp}
<div class="abs h3" style="left:1010px;top:470px;font-size:20px;color:{C['ink_soft']}">In practice</div>
{pr}
""")

# ------------------------------------------------------------------ 08 APPLICATIONS
# Meta 1:1 mock at 0.5 scale (540) and 9:16 at 0.4 scale
feed = f"""
<div class="abs" style="left:120px;top:400px;width:540px;height:540px;overflow:hidden;background:{C['slate']}">
  {photo(0, 0, 540, 540, "img-6795-karen.jpg", fy=0.5)}
  <div class="abs" style="inset:0;background:linear-gradient(180deg, rgba(47,79,79,0) 40%, rgba(47,79,79,.92) 100%)"></div>
  <div class="abs" style="left:20px;top:20px;width:500px;height:500px;border:1.5px solid rgba(255,255,255,.8)"></div>
  <div class="abs" style="left:44px;top:44px">{logo("white", style="width:70px;height:auto")}</div>
  <div class="abs serif" style="left:44px;bottom:116px;width:440px;color:#fff;font-size:38px;font-weight:600;line-height:1.08">Your 1890s skirting, matched exactly.</div>
  <div class="abs sans" style="left:44px;bottom:80px;color:{C['on_slate']};font-size:15px">Send us a photo. We'll match the profile.</div>
  <div class="abs" style="left:44px;bottom:40px">{proof('#fff', 13)}</div>
</div>
<div class="abs small" style="left:120px;top:952px">Meta feed 1:1 &nbsp;·&nbsp; shown at 50%</div>"""

story = f"""
<div class="abs" style="left:700px;top:400px;width:304px;height:540px;overflow:hidden;background:{C['stone']}">
  {photo(0, 0, 304, 330, "astragal-dado-blue-hallway.jpg", fy=0.55, zoom=1.3)}
  <div class="abs" style="left:24px;top:350px;width:256px">
    <div class="eyebrow" style="color:{C['teal']};font-size:10px">Flexible mouldings</div>
    <div class="serif" style="font-size:25px;font-weight:600;line-height:1.1;margin-top:8px">Bay windows, without the joinery.</div>
    <div class="sans" style="font-size:11px;color:{C['ink_soft']};margin-top:8px;line-height:1.45">Bends to the curve. No steaming, no kerfing.</div>
    <div class="btn" style="background:{C['teal']};color:#fff;height:34px;padding:0 16px;font-size:10px;margin-top:14px">Shop flexible</div>
  </div>
</div>
<div class="abs small" style="left:700px;top:952px">Story 9:16 &nbsp;·&nbsp; shown at 28%</div>"""

web = f"""
<div class="abs" style="left:1044px;top:400px;width:756px;height:540px;overflow:hidden;background:{C['white']};border-radius:6px">
  <div class="abs" style="left:0;top:0;width:756px;height:34px;background:{C['slate']};color:{C['on_slate']};font-family:'Helvetica Neue';font-size:11px;display:flex;align-items:center;justify-content:center">Made to order in Epsom, Surrey · Delivered in 5–7 working days · Free click &amp; collect</div>
  <div class="abs" style="left:28px;top:48px">{logo("colour", style="width:58px;height:auto")}</div>
  {photo(378, 34, 378, 506, "img-6888-karen.jpg", fy=0.5)}
  <div class="abs" style="left:28px;top:170px;width:320px">
    <div class="eyebrow" style="color:{C['teal']};font-size:11px">Manufactured in Epsom since 2003</div>
    <div class="serif" style="font-size:36px;font-weight:600;line-height:1.08;margin-top:12px">Skirting boards &amp; architraves, made to match.</div>
    <div class="sans" style="font-size:13px;color:{C['ink_soft']};margin-top:12px;line-height:1.5">Over 150 profiles, including made-to-match for profiles no longer made.</div>
    <div style="display:flex;gap:10px;margin-top:20px">
      <div class="btn" style="background:{C['teal']};color:#fff;height:40px;padding:0 18px;font-size:11px">Shop skirting</div>
      <div class="btn" style="border:1.5px solid {C['slate']};color:{C['slate']};height:40px;padding:0 18px;font-size:11px">Match a profile</div></div>
    <div style="margin-top:22px">{proof(C['ink'], 12)}</div>
  </div>
</div>
<div class="abs small" style="left:1044px;top:952px">Website hero &nbsp;·&nbsp; 1512 desktop, shown at 50%</div>"""

apps = sec("08 Example applications", f"""
{head("08", "Example applications")}
<div class="abs" style="left:120px;top:150px;width:1100px">
  <div class="h1">Putting it together.</div>
  <div class="body" style="margin-top:24px">Real room, one clear line, the profile or the proof underneath. Stone or Slate grounds, Teal for the action.</div>
</div>
{feed}{story}{web}
""")

SECTIONS = [cover, logo_sec, colour, typo, graphic, photography, tone, apps]

html = (f"<!doctype html><html lang='en-GB'><head><meta charset='utf-8'><title>MR Mouldings Brand Guidelines</title>"
        f"<style>{CSS}</style><script src='https://mcp.figma.com/mcp/html-to-design/capture.js' async></script>"
        f"</head><body>{''.join(SECTIONS)}</body></html>")
(ROOT / "guideline.html").write_text(html)
print("wrote guideline.html")
