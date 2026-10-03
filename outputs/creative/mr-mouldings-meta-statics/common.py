"""Shared pieces for the MR Mouldings Meta static harness.

Brand: MR Mouldings guideline (Figma NVGpdyW7y5MIfUW92LIyaR). Bitter headlines (assets/fonts),
Helvetica Neue body. Devices: open frame (from the logo), panel line, profile line.
Artboards: 1080x1080 and 1080x1920. 9:16 safe zone: keep key copy out of the top 250px and bottom 340px.
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
    slate_deep="#243D3D",
)

DATE = "261003"


def logo(variant="colour", width=170):
    """Inline master logo, cropped to the mark. Variants: colour, colour-white, white, black."""
    s = (A / f"logo-{variant}.svg").read_text()
    s = re.sub(r"<\?xml.*?\?>", "", s)
    n = logo.count = getattr(logo, "count", 0) + 1
    s = s.replace('viewBox="0 0 1045.43 922.44"',
                  f'viewBox="236 228 573 466" style="display:block;width:{width}px;height:auto"', 1)
    s = s.replace('id="clippath"', f'id="cp{n}"').replace("url(#clippath)", f"url(#cp{n})").replace("cls-", f"l{n}-")
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


def photo(x, y, w, h, img, fx=0.5, fy=0.5, zoom=1.0, extra="", name="Photo"):
    """Cover-crop a photo into a box from its real aspect ratio (never stretched)."""
    a = aspect(img)
    bw, bh = (w, w / a) if w / h > a else (h * a, h)
    bw, bh = bw * zoom, bh * zoom
    ox, oy = -(bw - w) * fx, -(bh - h) * fy
    return (f'<div class="ph" data-name="{name}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;'
            f'background-image:url(assets/photos/{img});background-size:{bw:.0f}px {bh:.0f}px;'
            f'background-position:{ox:.0f}px {oy:.0f}px;{extra}"></div>')


def frame(x, y, w, h, color, t=6, foot=0.14):
    """Open frame from the logo: three sides, two short feet, the bottom never closed."""
    f = int(w * foot)
    bar = 'position:absolute;background:' + color
    return (f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px">'
            f'<div style="{bar};left:0;top:0;width:{w}px;height:{t}px"></div>'
            f'<div style="{bar};left:0;top:0;width:{t}px;height:{h}px"></div>'
            f'<div style="{bar};right:0;top:0;width:{t}px;height:{h}px"></div>'
            f'<div style="{bar};left:0;bottom:0;width:{f}px;height:{t}px"></div>'
            f'<div style="{bar};right:0;bottom:0;width:{f}px;height:{t}px"></div></div>')


def panel_line(x, y, w, h, color="rgba(255,255,255,.85)", inner="rgba(255,255,255,.55)", gap=16):
    """Double hairline inset, like a box of panel moulding."""
    return (f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;border:2px solid {color}"></div>'
            f'<div class="abs" style="left:{x + gap}px;top:{y + gap}px;width:{w - 2 * gap}px;height:{h - 2 * gap}px;border:1px solid {inner}"></div>')


# Profile cross-sections as single-line drawings (x = depth, y = height), all in a 120-wide box.
# Heights are drawn to the stated mm so side-by-side comparisons are honest.
PROFILES = {
    # name: (path in a 120 x H box, H)
    "pencil": ("M8 {H} V12 C8 6 12 4 18 4 H22 C28 4 30 8 30 14 V{H} Z", None),
    "ogee": ("M8 {H} V8 H40 C40 34 58 40 66 52 C76 66 74 86 92 92 H100 V{H} Z", None),
    "torus": ("M8 {H} V8 H30 C46 8 52 22 52 40 C52 58 46 70 34 72 C50 74 62 86 62 104 V108 H70 V{H} Z", None),
    "bullnose": ("M8 {H} V20 C8 10 14 4 24 4 C32 4 36 10 36 20 V{H} Z", None),
}


def profile(kind, height_px, stroke, sw=3, depth_px=None, fill="none"):
    """A profile drawn at a given pixel height (the top detail keeps its shape; the run is stretched)."""
    path, _ = PROFILES[kind]
    H = 420
    d = path.format(H=H - 4)
    w = depth_px or 120 * height_px / H
    return (f'<svg viewBox="0 0 120 {H}" style="display:block;width:{w:.0f}px;height:{height_px}px;overflow:visible" '
            f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}" vector-effect="non-scaling-stroke" '
            f'stroke-linejoin="round" preserveAspectRatio="none"><path d="{d}" vector-effect="non-scaling-stroke"/></svg>')


PROOF_TEXT = "Made in our Epsom workshop since 2003"


def proof(color, size=22, text=PROOF_TEXT):
    """Facts strip. No star ratings or review counts (on-site reviews unverifiable, Toby 3 Oct 2026)."""
    return (f'<div style="display:flex;align-items:center;gap:12px;color:{color}">'
            f'<span style="width:{size * 1.6:.0f}px;height:2px;background:{C["teal_light"]}"></span>'
            f'<span class="sans" style="font-size:{size}px;font-weight:500;letter-spacing:.01em">{text}</span></div>')


def cta(label, style="teal", size=None):
    styles = {
        "teal": f"background:{C['teal']};color:#fff",
        "stone": f"background:{C['stone']};color:{C['slate']}",
        "slate": f"background:{C['slate']};color:#fff",
        "line-light": "border:2px solid rgba(255,255,255,.9);color:#fff",
        "line-dark": f"border:2px solid {C['slate']};color:{C['slate']}",
    }
    sz = f"height:{size[0]}px;font-size:{size[1]}px;padding:0 {size[2]}px;" if size else ""
    return f'<span class="cta" style="{styles[style]};{sz}">{label}</span>'


GRAIN = ("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>"
         "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.9 0'/></filter>"
         "<rect width='100%' height='100%' filter='url(%23n)'/></svg>")

CSS = f"""
@font-face {{ font-family: Bitter; src: url(assets/fonts/Bitter-VF.ttf); font-weight: 100 900; font-style: normal; }}
@font-face {{ font-family: Bitter; src: url(assets/fonts/Bitter-Italic-VF.ttf); font-weight: 100 900; font-style: italic; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ background: #2a2a2a; display: flex; gap: 80px; padding: 80px; align-items: flex-start; }}
.ab {{ position: relative; overflow: hidden; flex: none; color: {C['ink']}; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; }}
.s1 {{ width: 1080px; height: 1080px; }}
.s9 {{ width: 1080px; height: 1920px; }}
.abs {{ position: absolute; }}
.ph {{ position: absolute; background-repeat: no-repeat; }}
.fill {{ position: absolute; inset: 0; }}
.grain {{ position: absolute; inset: 0; background-image: url("{GRAIN}"); opacity: .11; mix-blend-mode: overlay; pointer-events: none; }}
.serif {{ font-family: Bitter, Georgia, serif; }}
.sans {{ font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; }}
.hl {{ font-family: Bitter, Georgia, serif; font-weight: 600; line-height: 1.04; letter-spacing: -.012em; }}
.hl i {{ font-style: italic; font-weight: 500; }}
.eyebrow {{ font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 20px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; }}
.body {{ font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 30px; line-height: 1.42; }}
.small {{ font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 20px; line-height: 1.45; }}
.mono {{ font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 18px; font-weight: 500; letter-spacing: .06em; }}
.cta {{ display: inline-flex; align-items: center; height: 72px; padding: 0 40px; border-radius: 3px; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 21px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; white-space: nowrap; }}
.card {{ position: absolute; background: {C['white']}; border-radius: 4px; }}
.shadow {{ box-shadow: 0 30px 60px rgba(0,0,0,.28), 0 6px 14px rgba(0,0,0,.18); }}
"""


def page(title, boards):
    return (f"<!doctype html><html lang='en-GB'><head><meta charset='utf-8'><title>{title}</title>"
            f"<style>{CSS}</style><script src='https://mcp.figma.com/mcp/html-to-design/capture.js' async></script>"
            f"</head><body>{''.join(boards)}</body></html>")


def board(size, name, bg, inner):
    cls = "s1" if size == "1x1" else "s9"
    return f'<div class="ab {cls}" data-name="{name} | {size} | {DATE}" style="background:{bg}">{inner}<div class="grain"></div></div>'


def write(fname, html):
    (ROOT / fname).write_text(html)
    return fname


# ------------------------------------------------------------------ MR Instagram editorial style
TEXT_SHADOW = "text-shadow:0 2px 26px rgba(0,0,0,.38), 0 1px 3px rgba(0,0,0,.25)"


def editorial_inner(img, line, sub, x, y, w, size, fx=0.5, fy=0.5, sub_w=None, sub_gap=26, size_px=(1080, 1080),
                    sub_size=28, lines=None, dark=False):
    """Full-bleed room photo, one white Bitter line in the wall space, smaller Bitter subline, small white logo.
    `lines` = rendered line count of `line` (for placing the subline)."""
    W, H = size_px
    n = lines or (line.count("<br>") + 1)
    col, shadow, lg = (C["slate"], "", "colour") if dark else ("#fff", TEXT_SHADOW, "white")
    sub_top = y + int(size * 1.08 * n) + sub_gap
    return (f'{photo(0, 0, W, H, img, fx=fx, fy=fy)}'
            f'<div class="abs" style="left:56px;top:{52 if H == 1080 else 250}px">{logo(lg, 104)}</div>'
            f'<div class="abs serif" style="left:{x}px;top:{y}px;width:{w}px;color:{col};font-size:{size}px;font-weight:500;'
            f'line-height:1.08;letter-spacing:-.01em;{shadow}">{line}</div>'
            f'<div class="abs serif" style="left:{x}px;top:{sub_top}px;width:{sub_w or w}px;color:{col};font-size:{sub_size}px;'
            f'font-weight:400;line-height:1.3;{shadow}">{sub}</div>')


def hotspot(x, y, card_x, card_y, thumb, title, price):
    """Product hotspot like MR's live ads: dot on the moulding, hairline to a white card (250 x 84)."""
    import math
    cx, cy = card_x + (0 if card_x > x else 250), card_y + 42
    length = math.hypot(cx - x, cy - y)
    angle = math.degrees(math.atan2(cy - y, cx - x))
    return (f'<div class="abs" style="left:{x}px;top:{y}px;width:{length:.0f}px;height:2px;background:rgba(255,255,255,.9);'
            f'transform-origin:0 50%;transform:rotate({angle:.1f}deg)"></div>'
            f'<div class="abs" style="left:{x - 11}px;top:{y - 11}px;width:22px;height:22px;border-radius:50%;background:#fff;'
            f'box-shadow:0 0 0 6px rgba(255,255,255,.35)"></div>'
            f'<div class="abs" style="left:{card_x}px;top:{card_y}px;width:250px;height:84px;background:#fff;border-radius:3px;'
            f'display:flex;align-items:center;gap:12px;padding:10px;box-shadow:0 6px 18px rgba(0,0,0,.18)">'
            f'<div style="width:64px;height:64px;flex:none;background:#f3f3f3 url(assets/photos/products/{thumb}) center/contain no-repeat"></div>'
            f'<div><div class="sans" style="font-size:16px;font-weight:600;line-height:1.2;color:{C["ink"]}">{title}</div>'
            f'<div class="sans" style="font-size:15px;color:{C["muted"]};margin-top:4px">From {price}</div></div></div>')


def soft(cx, cy, rx, ry, light=False, strong=False):
    """Soft, edgeless shadow (or light glow) behind editorial text, as MR's Instagram posts do. Not a box.
    `strong` for busy, bright stock rooms where the text sits over detailed mouldings."""
    c = "245,243,235" if light else "15,35,40"
    a1, a2 = ((.95, .82) if strong else (.88, .55)) if light else (.62, .35)
    return (f'<div class="fill" data-name="Soft {"glow" if light else "shadow"}" style="background:radial-gradient(ellipse {rx}px {ry}px at {cx}px {cy}px, '
            f'rgba({c},{a1}) 0%, rgba({c},{a2}) 45%, rgba({c},0) 100%)"></div>')


def with_soft(inner, glow):
    """Insert a soft shadow/glow just above the photo (before the logo)."""
    return inner.replace('<div class="abs" style="left:56px', glow + '<div class="abs" style="left:56px', 1)
