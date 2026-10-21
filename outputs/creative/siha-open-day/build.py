"""Siha Dental Clear Aligner Open Day (Sat 5 Dec 2026) Meta statics.

Usage: python3 build.py -> open-day-1x1.html, open-day-9x16.html
Same Siha system as ../siha-new-ads (Metropolis, S-frame, grain) and the meet-the-team head breakout.
Facts: Hannan's open day email (21 Oct 2026) + siha.dental fees page. Copy: copy-open-day.md. Research: research.md.
Photos, cut-outs and cases (assets/photos, assets/cutouts, assets/cases) are gitignored; sources:
../siha-meet-the-team/assets, ../siha-lp-smile-makeover/assets/photos, ../siha-ba-cards/assets/ba.
"""
import re
import struct
from pathlib import Path

ROOT = Path(__file__).parent
A = ROOT / "assets"

C = dict(od="#14211a", ol="#293425", gl="#4c5d46", be="#e1d5ca", nu="#eae3de", bo="#ab6f4b", br="#877663", wh="#ffffff")


def inline_svg(name, cls):
    s = (A / name).read_text()
    s = re.sub(r"<\?xml.*?\?>|<!DOCTYPE.*?>", "", s, flags=re.S)
    s = re.sub(r'fill:#[0-9a-fA-F]{6};?', "", s)
    return s.replace('width="100%" height="100%"', f'class="{cls}" fill="currentColor"', 1)


LOGO = inline_svg("logo-dark.svg", "logo")
ICON = inline_svg("shape.svg", "icon")
LINE_S = ICON.replace('class="icon" fill="currentColor"', 'class="line-s" fill="none" stroke="currentColor" stroke-width="1.6" vector-effect="non-scaling-stroke"')

GRAIN = ("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>"
         "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.9 0'/></filter>"
         "<rect width='100%' height='100%' filter='url(%23n)'/></svg>")

CSS = f"""
@font-face {{ font-family: Metropolis; src: url(assets/fonts/Metropolis-Light.otf); font-weight: 300; }}
@font-face {{ font-family: Metropolis; src: url(assets/fonts/Metropolis-Regular.otf); font-weight: 400; }}
@font-face {{ font-family: Metropolis; src: url(assets/fonts/Metropolis-Medium.otf); font-weight: 500; }}
@font-face {{ font-family: Metropolis; src: url(assets/fonts/Metropolis-SemiBold.otf); font-weight: 600; }}
@font-face {{ font-family: Metropolis; src: url(assets/fonts/Metropolis-Bold.otf); font-weight: 700; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ background: #2a2a2a; font-family: Metropolis, sans-serif; display: flex; gap: 80px; padding: 80px; align-items: flex-start; }}
.ab {{ position: relative; overflow: hidden; flex: none; color: {C['od']}; }}
.s1 {{ width: 1080px; height: 1080px; }}
.s9 {{ width: 1080px; height: 1920px; }}
.abs {{ position: absolute; }}
.cover {{ position: absolute; inset: 0; background-size: cover; background-position: center; }}
.grain {{ position: absolute; inset: 0; background-image: url("{GRAIN}"); opacity: .13; mix-blend-mode: overlay; pointer-events: none; }}
.eyebrow {{ font-size: 22px; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; }}
.hl {{ font-weight: 300; text-transform: uppercase; line-height: .98; letter-spacing: .005em; }}
.hl b {{ font-weight: 700; }}
.body {{ font-size: 30px; font-weight: 400; line-height: 1.45; }}
.cta {{ display: inline-flex; align-items: center; height: 76px; padding: 0 44px; border-radius: 999px; font-size: 22px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; }}
.cta.dark {{ background: {C['od']}; color: {C['nu']}; }}
.cta.light {{ background: {C['be']}; color: {C['od']}; }}
.logo {{ display: block; height: auto; }}
.icon, .line-s {{ display: block; }}
.sframe {{ position: absolute; }}
.sframe .t, .sframe .b {{ position: absolute; left: 0; width: 100%; height: 50%; background-repeat: no-repeat; }}
.sframe .t {{ top: 0; border-radius: 9999px 0 0 9999px; }}
.sframe .b {{ bottom: 0; border-radius: 0 9999px 9999px 0; }}
.price {{ font-weight: 300; line-height: .85; letter-spacing: -.02em; }}
.small {{ font-size: 20px; font-weight: 500; letter-spacing: .04em; }}
.rule {{ width: 64px; height: 2px; }}
"""

CTA = "Book your open day slot"
EYEBROW = "Clear Aligner Open Day · Sat 5 December"
EYEBROW_2L = "Clear Aligner Open Day<br>Saturday 5 December"
STAR = '<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="currentColor"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>'
TICK = ('<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="none" stroke="currentColor" stroke-width="2.4" '
        'stroke-linecap="round" stroke-linejoin="round" style="flex:none"><path d="M5 12.5l4.2 4.2L19 7"/></svg>')

# Open day packages (Hannan's email) against the fees page prices, 21 Oct 2026
PACKAGES = [("Express", "£1,895", "£2,195"), ("Moderate", "£3,395", "£3,695"), ("Complex", "£4,195", "£4,495")]
INCLUDED = ["Plan designed by a specialist orthodontist", "3D digital smile simulation", "Complimentary whitening",
            "Clear night retainers", "Tooth contouring", "15% off composite bonding"]


def aspect(path):
    """Width / height of a JPEG or PNG, read from the file header."""
    data = path.read_bytes()
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        w, h = struct.unpack(">II", data[16:24])
        return w / h
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
    raise ValueError(path)


def cover_bg(path, w, h, fx=0.5, fy=0.35, zoom=1.0):
    """background-size/position that cover-crops the image into w x h (never stretched)."""
    a = aspect(path)
    bw, bh = (w, w / a) if w / h > a else (h * a, h)
    bw, bh = bw * zoom, bh * zoom
    return bw, bh, -(bw - w) * fx, -(bh - h) * fy


def sframe(x, y, w, h, img, fx=0.5, fy=0.35, zoom=1.0):
    """Photo cropped inside the Siha S shape: two stacked halves sharing one image."""
    bw, bh, ox, oy = cover_bg(A / "photos" / img, w, h, fx, fy, zoom)
    bg = f"background-image:url(assets/photos/{img});background-size:{bw:.0f}px {bh:.0f}px;"
    return (f'<div class="sframe" data-name="Photo" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px">'
            f'<div class="t" style="{bg}background-position:{ox:.0f}px {oy:.0f}px"></div>'
            f'<div class="b" style="{bg}background-position:{ox:.0f}px {oy - h / 2:.0f}px"></div></div>')


# Face boxes (source w, h, face x, face y, face size), from ../siha-meet-the-team/build.py
FACES = {"hannan": (1067, 1600, 435, 434, 221), "abeera": (1067, 1600, 451, 441, 218), "ayesha": (893, 1340, 397, 373, 197)}


def person(pid, x, y, w, h, breakout=None):
    """Team member from mid-chest up inside an S-frame, head breaking out above it (Toby's approved card style).

    The frame holds the team photo; a background-removed cut-out, clipped to the strip above the frame, carries
    the head over the frame's top edge. Mid-chest sits on the frame's bottom edge.
    """
    W, H, fx, fy, fs = FACES[pid]
    br = breakout if breakout is not None else round(h * .19)
    s = (h + br) / (3.25 * fs)
    iw, ih = W * s, H * s
    left = x + w / 2 + 10 - s * (fx + fs / 2)
    top = y + h - s * (fy + 2.7 * fs)
    bg = f"background-image:url(assets/photos/{pid}.jpg);background-size:{iw:.0f}px {ih:.0f}px;"
    ox, oy = left - x, top - y
    frame = (f'<div class="sframe" data-name="Photo" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px">'
             f'<div class="t" style="{bg}background-position:{ox:.0f}px {oy:.0f}px"></div>'
             f'<div class="b" style="{bg}background-position:{ox:.0f}px {oy - h / 2:.0f}px"></div></div>')
    pad = 60
    bx, by = x - pad, y - br - pad
    cut = (f'<div class="abs" data-name="Head breakout" style="left:{bx}px;top:{by}px;width:{w + 2 * pad}px;height:{br + pad}px;overflow:hidden">'
           f'<img data-name="Cut-out" src="assets/cutouts/{pid}.png" style="position:absolute;left:{left - bx:.0f}px;top:{top - by:.0f}px;width:{iw:.0f}px;height:{ih:.0f}px"></div>')
    return frame + cut


def shot(x, y, w, h, img, label, cx=50, cy=50, zoom=1.0, dark=True, r=10):
    """Before/after crop from assets/cases, zoomed around (cx, cy) percent, with a label pill."""
    pill_bg, pill_c = (C["od"], C["nu"]) if dark else (C["nu"], C["od"])
    bw, bh, _, _ = cover_bg(A / "cases" / img, w, h, zoom=zoom)
    ox, oy = -(bw - w) * cx / 100, -(bh - h) * cy / 100
    return (f'<div class="abs" data-name="{label}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;border-radius:{r}px;overflow:hidden;'
            f'background-image:url(assets/cases/{img});background-size:{bw:.0f}px {bh:.0f}px;background-position:{ox:.0f}px {oy:.0f}px">'
            f'<span class="eyebrow" style="position:absolute;left:18px;bottom:18px;font-size:15px;letter-spacing:.18em;padding:9px 16px;border-radius:999px;'
            f'background:{pill_bg};color:{pill_c}">{label}</span></div>')


def proof(color, size=22):
    stars = "".join(STAR.format(s=size) for _ in range(5))
    return (f'<div style="display:flex;align-items:center;gap:14px;color:{color}">'
            f'<span style="display:flex;gap:3px">{stars}</span>'
            f'<span class="small" style="font-size:{size}px">5.0 from 157 Google reviews</span></div>')


def foot(color, kind, nine=False, logo_y=1474):
    """Logo bottom-left, CTA bottom-right (same positions as the existing Siha ads)."""
    if nine:
        return (f'<div class="abs" style="left:90px;top:{logo_y}px;width:200px;color:{color}">{LOGO}</div>'
                f'<div class="abs" style="right:90px;top:{logo_y - 14}px"><span class="cta {kind}">{CTA}</span></div>')
    return (f'<div class="abs" style="left:80px;top:950px;width:200px;color:{color}">{LOGO}</div>'
            f'<div class="abs" style="right:70px;top:965px"><span class="cta {kind}" style="height:60px;font-size:17px;padding:0 30px">{CTA}</span></div>')


def ladder(x, y, w, color, line, size=30, gap=22):
    """Open day package prices with the usual fee struck through beside each."""
    rows = "".join(f'<div style="display:flex;justify-content:space-between;align-items:baseline;padding:{gap}px 0;border-top:1px solid {line}">'
                   f'<span style="font-size:{size}px;font-weight:500">{n}</span>'
                   f'<span style="display:flex;align-items:baseline;gap:{int(size * .6)}px">'
                   f'<span style="font-size:{int(size * .7)}px;opacity:.6;text-decoration:line-through">{was}</span>'
                   f'<span class="price" style="font-size:{int(size * 1.9)}px;color:{C["bo"]}">{now}</span></span></div>'
                   for n, now, was in PACKAGES)
    return f'<div class="abs" data-name="Package ladder" style="left:{x}px;top:{y}px;width:{w}px;color:{color};border-bottom:1px solid {line}">{rows}</div>'


def ticks(x, y, w, items, color, size=24, gap=14):
    rows = "".join(f'<div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:{gap}px;font-size:{size}px;line-height:1.3">'
                   f'<span style="color:{C["bo"]};margin-top:2px">{TICK.format(s=int(size * 1.05))}</span><span>{t}</span></div>' for t in items)
    return f'<div class="abs" data-name="Included" style="left:{x}px;top:{y}px;width:{w}px;color:{color}">{rows}</div>'


def real(color, size=17):
    return f'<span style="font-size:{size}px;font-weight:500;letter-spacing:.04em;color:{color}">Real Siha patient. Individual results vary.</span>'


def page(title, boards):
    return (f"<!doctype html><html lang='en-GB'><head><meta charset='utf-8'><title>{title}</title>"
            f"<style>{CSS}</style><script src='https://mcp.figma.com/mcp/html-to-design/capture.js' async></script></head><body>{''.join(boards)}</body></html>")


GLOW_NU = f"radial-gradient(circle at 75% 35%,#f7f3ee 0%,{C['nu']} 46%,#d8cbbf 100%)"
GLOW_BE = f"radial-gradient(circle at 30% 40%,#f1e9e1 0%,{C['be']} 46%,#d2c2b2 100%)"
GLOW_OD = "radial-gradient(circle at 78% 30%,rgba(171,111,75,.20),transparent 55%)"


# ---------------------------------------------------------------- 1:1
def open_day_1x1():
    b = []
    # OD1 | Who plans it: Dr Abeera breaking out of the S-frame
    b.append(f"""
<div class="ab s1" id="OD1" data-name="Open Day | Static | Abeera | Specialist planned | 1x1 | 261021" style="background:{C['nu']}">
  <div class="cover" data-name="Overlay (locked)" style="background:{GLOW_NU}"></div>
  {person('abeera', 610, 330, 390, 570, breakout=150)}
  <div class="abs eyebrow" style="left:80px;top:110px;width:480px;font-size:19px;line-height:1.5;color:{C['bo']}">{EYEBROW_2L}</div>
  <div class="abs hl" style="left:80px;top:175px;font-size:62px;color:{C['od']}">Planned by a<br><b>specialist<br>orthodontist.</b></div>
  <div class="abs body" style="left:80px;top:430px;width:470px;font-size:26px;color:{C['ol']}">Every tray is decided before your teeth move. So we plan it properly, and show you the result first.</div>
  <div class="abs" style="left:80px;top:640px;color:{C['bo']}"><span style="font-size:22px;font-weight:500;color:{C['ol']}">From</span> <span class="price" style="font-size:72px">£1,895</span> <span style="font-size:22px;font-weight:500;color:{C['ol']}">on the day</span></div>
  <div class="abs" style="left:80px;top:760px">{proof(C['br'], 20)}</div>
  <div class="abs small" style="left:610px;top:915px;width:390px;font-size:16px;color:{C['br']};text-align:center">Dr Abeera, specialist orthodontist</div>
  {foot(C['ol'], 'dark')}
  <div class="grain" data-name="Grain (locked)"></div>
</div>""")
    # OD2 | See it first: consultation photo in the S-frame
    b.append(f"""
<div class="ab s1" id="OD2" data-name="Open Day | Static | Practice | See it first | 1x1 | 261021" style="background:{C['be']}">
  <div class="cover" data-name="Overlay (locked)" style="background:{GLOW_BE}"></div>
  {sframe(80, 90, 420, 800, 'concierge-discuss.jpg', fx=0.28, fy=0.5)}
  <div class="abs eyebrow" style="left:570px;top:110px;width:440px;font-size:19px;line-height:1.5;color:{C['bo']}">{EYEBROW_2L}</div>
  <div class="abs hl" style="left:570px;top:190px;font-size:60px;color:{C['od']}">See your<br>straighter<br>smile <b>before<br>you start.</b></div>
  <div class="abs body" style="left:570px;top:500px;width:430px;font-size:26px;color:{C['ol']}">A 3D digital smile simulation at every open day consultation. See where your teeth will finish, then decide.</div>
  <div class="abs" style="left:570px;top:740px">{proof(C['br'], 20)}</div>
  {foot(C['ol'], 'dark')}
  <div class="grain" data-name="Grain (locked)"></div>
</div>""")
    # OD3 | Everything, one morning: the offer card
    b.append(f"""
<div class="ab s1" id="OD3" data-name="Open Day | Static | Offer | Packages and extras | 1x1 | 261021" style="background:{C['od']}">
  <div class="cover" data-name="Overlay (locked)" style="background:{GLOW_OD}"></div>
  <div class="abs" style="left:700px;top:-260px;width:480px;color:{C['bo']};opacity:.18">{LINE_S}</div>
  <div class="abs eyebrow" style="left:80px;top:100px;font-size:19px;color:{C['bo']}">Clear Aligner Open Day</div>
  <div class="abs hl" style="left:80px;top:150px;font-size:60px;color:{C['nu']}">Saturday 5 December.<br><b>9am to 1pm.</b></div>
  {ladder(80, 330, 500, C['nu'], "rgba(225,213,202,.22)", size=28, gap=20)}
  <div class="abs small" style="left:80px;top:690px;width:500px;font-size:17px;color:{C['be']};opacity:.8">Open day prices when you start treatment on the day.</div>
  {ticks(650, 340, 360, INCLUDED, C['be'], size=23, gap=16)}
  <div class="abs" style="left:80px;top:800px">{proof(C['be'], 20)}</div>
  {foot(C['be'], 'light')}
  <div class="grain" data-name="Grain (locked)"></div>
</div>""")
    # OD4 | Lips closed: real aligner case al01
    b.append(f"""
<div class="ab s1" id="OD4" data-name="Open Day | Static | B&amp;A al01 | Lips closed | 1x1 | 261021" style="background:{C['nu']}">
  <div class="cover" data-name="Overlay (locked)" style="background:{GLOW_NU}"></div>
  <div class="abs hl" style="left:80px;top:90px;font-size:62px;color:{C['od']}">Still smiling with<br><b>your lips closed?</b></div>
  {shot(80, 290, 452, 452, 'al01-before.jpg', 'Before', 50, 50, 1.0, dark=True)}
  {shot(548, 290, 452, 452, 'al01-after.jpg', 'After', 50, 50, 1.0, dark=True)}
  <div class="abs body" style="left:80px;top:765px;width:920px;font-size:25px;color:{C['ol']}">Clear aligners, planned by a specialist orthodontist.<br><b style="font-weight:600;color:{C['bo']}">Clear Aligner Open Day · Sat 5 December</b></div>
  <div class="abs" style="left:80px;top:860px">{real(C['br'])}</div>
  {foot(C['ol'], 'dark')}
  <div class="grain" data-name="Grain (locked)"></div>
</div>""")
    # OD5 | Thirty minutes: Hannan and Ayesha
    b.append(f"""
<div class="ab s1" id="OD5" data-name="Open Day | Static | Hannan + Ayesha | Thirty minutes | 1x1 | 261021" style="background:{C['od']}">
  <div class="cover" data-name="Overlay (locked)" style="background:{GLOW_OD}"></div>
  {person('hannan', 540, 330, 220, 520, breakout=100)}
  {person('ayesha', 780, 330, 220, 520, breakout=100)}
  <div class="abs small" style="left:540px;top:870px;width:220px;font-size:16px;color:{C['be']};text-align:center">Dr Hannan</div>
  <div class="abs small" style="left:780px;top:870px;width:220px;font-size:16px;color:{C['be']};text-align:center">Dr Ayesha</div>
  <div class="abs eyebrow" style="left:80px;top:110px;font-size:19px;color:{C['bo']}">Clear Aligner Open Day</div>
  <div class="abs hl" style="left:80px;top:165px;font-size:60px;color:{C['nu']}">Saturday<br>5 December.<br><b>9am to 1pm.</b></div>
  <div class="abs body" style="left:80px;top:420px;width:410px;font-size:26px;color:{C['be']}">Thirty minutes with Dr Hannan or Dr Ayesha. Leave with your plan, your package and your price.</div>
  <div class="abs" style="left:80px;top:700px">{proof(C['be'], 20)}</div>
  {foot(C['be'], 'light')}
  <div class="grain" data-name="Grain (locked)"></div>
</div>""")
    return page("Siha | Open Day | 1x1", b)


# ---------------------------------------------------------------- 9:16 (keep the top 250px and bottom 340px clear of key copy)
def open_day_9x16():
    b = []
    b.append(f"""
<div class="ab s9" id="OD1s" data-name="Open Day | Static | Abeera | Specialist planned | 9x16 | 261021" style="background:{C['nu']}">
  <div class="cover" data-name="Overlay (locked)" style="background:{GLOW_NU}"></div>
  <div class="abs eyebrow" style="left:90px;top:260px;font-size:24px;color:{C['bo']}">{EYEBROW}</div>
  <div class="abs hl" style="left:90px;top:320px;font-size:80px;color:{C['od']}">Planned by a<br><b>specialist orthodontist.</b></div>
  {person('abeera', 330, 700, 420, 500, breakout=110)}
  <div class="abs small" style="left:330px;top:1215px;width:420px;font-size:19px;color:{C['br']};text-align:center">Dr Abeera, specialist orthodontist</div>
  <div class="abs body" style="left:90px;top:1270px;width:900px;font-size:30px;color:{C['ol']}">Every tray is decided before your teeth move. So we plan it properly, and show you the result first.</div>
  <div class="abs" style="left:90px;top:1400px;color:{C['bo']};display:flex;align-items:baseline;gap:14px"><span style="font-size:26px;font-weight:500;color:{C['ol']}">From</span><span class="price" style="font-size:64px">£1,895</span><span style="font-size:26px;font-weight:500;color:{C['ol']}">on the day</span></div>
  {foot(C['ol'], 'dark', nine=True, logo_y=1500)}
  <div class="grain" data-name="Grain (locked)"></div>
</div>""")
    b.append(f"""
<div class="ab s9" id="OD2s" data-name="Open Day | Static | Practice | See it first | 9x16 | 261021" style="background:{C['be']}">
  <div class="cover" data-name="Overlay (locked)" style="background:{GLOW_BE}"></div>
  {sframe(290, 220, 500, 740, 'concierge-discuss.jpg', fx=0.28, fy=0.5)}
  <div class="abs eyebrow" style="left:90px;top:1010px;font-size:24px;color:{C['bo']}">{EYEBROW}</div>
  <div class="abs hl" style="left:90px;top:1075px;font-size:74px;color:{C['od']}">See your<br>straighter smile<br><b>before you start.</b></div>
  <div class="abs body" style="left:90px;top:1320px;width:900px;font-size:30px;color:{C['ol']}">A 3D digital smile simulation at every open day consultation.</div>
  <div class="abs" style="left:90px;top:1400px">{proof(C['br'], 22)}</div>
  {foot(C['ol'], 'dark', nine=True, logo_y=1500)}
  <div class="grain" data-name="Grain (locked)"></div>
</div>""")
    b.append(f"""
<div class="ab s9" id="OD3s" data-name="Open Day | Static | Offer | Packages and extras | 9x16 | 261021" style="background:{C['od']}">
  <div class="cover" data-name="Overlay (locked)" style="background:{GLOW_OD}"></div>
  <div class="abs eyebrow" style="left:90px;top:260px;font-size:24px;color:{C['bo']}">Clear Aligner Open Day</div>
  <div class="abs hl" style="left:90px;top:315px;font-size:84px;color:{C['nu']}">Saturday<br>5 December.<br><b>9am to 1pm.</b></div>
  {ladder(90, 620, 900, C['nu'], "rgba(225,213,202,.22)", size=34, gap=22)}
  <div class="abs small" style="left:90px;top:1010px;width:900px;font-size:20px;color:{C['be']};opacity:.8">Open day prices when you start treatment on the day.</div>
  {ticks(90, 1080, 900, INCLUDED, C['be'], size=29, gap=16)}
  {foot(C['be'], 'light', nine=True, logo_y=1500)}
  <div class="grain" data-name="Grain (locked)"></div>
</div>""")
    b.append(f"""
<div class="ab s9" id="OD4s" data-name="Open Day | Static | B&amp;A al01 | Lips closed | 9x16 | 261021" style="background:{C['nu']}">
  <div class="cover" data-name="Overlay (locked)" style="background:{GLOW_NU}"></div>
  <div class="abs hl" style="left:90px;top:260px;font-size:84px;color:{C['od']}">Still smiling with<br><b>your lips closed?</b></div>
  {shot(90, 500, 900, 400, 'al01-before.jpg', 'Before', 50, 50, 1.1, dark=True)}
  {shot(90, 916, 900, 400, 'al01-after.jpg', 'After', 50, 50, 1.1, dark=True)}
  <div class="abs body" style="left:90px;top:1340px;width:900px;font-size:29px;color:{C['ol']}">Clear aligners, planned by a specialist orthodontist. <b style="font-weight:600;color:{C['bo']}">Open Day · Sat 5 December.</b></div>
  <div class="abs" style="left:90px;top:1438px">{real(C['br'], 19)}</div>
  {foot(C['ol'], 'dark', nine=True, logo_y=1510)}
  <div class="grain" data-name="Grain (locked)"></div>
</div>""")
    b.append(f"""
<div class="ab s9" id="OD5s" data-name="Open Day | Static | Hannan + Ayesha | Thirty minutes | 9x16 | 261021" style="background:{C['od']}">
  <div class="cover" data-name="Overlay (locked)" style="background:{GLOW_OD}"></div>
  <div class="abs eyebrow" style="left:90px;top:260px;font-size:24px;color:{C['bo']}">Clear Aligner Open Day</div>
  <div class="abs hl" style="left:90px;top:315px;font-size:84px;color:{C['nu']}">Saturday 5 December.<br><b>9am to 1pm.</b></div>
  {person('hannan', 150, 720, 360, 500, breakout=100)}
  {person('ayesha', 570, 720, 360, 500, breakout=100)}
  <div class="abs small" style="left:150px;top:1235px;width:360px;font-size:20px;color:{C['be']};text-align:center">Dr Hannan</div>
  <div class="abs small" style="left:570px;top:1235px;width:360px;font-size:20px;color:{C['be']};text-align:center">Dr Ayesha</div>
  <div class="abs body" style="left:90px;top:1300px;width:900px;font-size:30px;color:{C['be']}">Thirty minutes. Leave with your plan, your package and your price.</div>
  <div class="abs" style="left:90px;top:1415px">{proof(C['be'], 22)}</div>
  {foot(C['be'], 'light', nine=True, logo_y=1500)}
  <div class="grain" data-name="Grain (locked)"></div>
</div>""")
    return page("Siha | Open Day | 9x16", b)


if __name__ == "__main__":
    (ROOT / "open-day-1x1.html").write_text(open_day_1x1())
    (ROOT / "open-day-9x16.html").write_text(open_day_9x16())
    print("built")
