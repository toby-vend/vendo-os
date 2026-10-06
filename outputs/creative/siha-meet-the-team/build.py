"""Build the Siha Dental 'Meet the Team' Meta carousel harness (10 cards, 1080x1080).

Usage: python3 build.py  -> writes carousel-1x1.html
Brand: Siha guideline (Figma AbtwUHTD50G38QuOaCG4Hh). Font: Metropolis (assets/fonts).
Photos: Siha team folder on Drive (1AuPYT-L9XuAtKWC9dmabeLOkXyu_bI5_), downscaled into assets/photos.
Team facts: siha.dental/our-team (checked 2026-10-06).
"""
import json
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
.ab {{ position: relative; overflow: hidden; flex: none; width: 1080px; height: 1080px; color: {C['od']}; }}
.abs {{ position: absolute; }}
.cover {{ position: absolute; inset: 0; background-size: cover; background-position: center; }}
.grain {{ position: absolute; inset: 0; background-image: url("{GRAIN}"); opacity: .13; mix-blend-mode: overlay; pointer-events: none; }}
.eyebrow {{ font-size: 20px; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; }}
.hl {{ font-weight: 300; text-transform: uppercase; line-height: .98; letter-spacing: .005em; }}
.hl b {{ font-weight: 700; }}
.body {{ font-size: 28px; font-weight: 400; line-height: 1.4; }}
.small {{ font-size: 19px; font-weight: 500; line-height: 1.45; letter-spacing: .02em; }}
.cta {{ display: inline-flex; align-items: center; height: 64px; padding: 0 36px; border-radius: 999px; font-size: 18px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; }}
.cta.dark {{ background: {C['od']}; color: {C['nu']}; }}
.cta.light {{ background: {C['be']}; color: {C['od']}; }}
.logo, .icon, .line-s {{ display: block; height: auto; }}
.sframe {{ position: absolute; }}
.sframe .t, .sframe .b {{ position: absolute; left: 0; width: 100%; height: 50%; background-repeat: no-repeat; }}
.sframe .t {{ top: 0; border-radius: 9999px 0 0 9999px; }}
.sframe .b {{ bottom: 0; border-radius: 0 9999px 9999px 0; }}
.print {{ position: absolute; background: #f6f2ee; padding: 14px 14px 0; border-radius: 3px;
          box-shadow: 0 2px 3px rgba(20,33,26,.25), 0 18px 40px rgba(20,33,26,.35), 0 40px 70px rgba(20,33,26,.18); }}
.print .ph {{ background-repeat: no-repeat; }}
.print .cap {{ font-size: 16px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: {C['br']}; padding: 14px 4px 16px; }}
.rule {{ width: 64px; height: 2px; }}
"""


def photo_aspect(img):
    """Width / height of a photo in assets/photos, read from the JPEG header."""
    data = (A / "photos" / img).read_bytes()
    i = 2
    while i < len(data):
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        seg_len = struct.unpack(">H", data[i + 2:i + 4])[0]
        if marker in (0xC0, 0xC1, 0xC2):
            h, w = struct.unpack(">HH", data[i + 5:i + 9])
            return w / h
        i += 2 + seg_len
    raise ValueError(f"no size found in {img}")


def cover_bg(img, w, h, fx=0.5, fy=0.3, zoom=1.0):
    """background-size/position that cover-crops img into w x h (never stretched)."""
    a = photo_aspect(img)
    bw, bh = (w, w / a) if w / h > a else (h * a, h)
    bw, bh = bw * zoom, bh * zoom
    return bw, bh, -(bw - w) * fx, -(bh - h) * fy


def sframe(x, y, w, h, img, fx=0.5, fy=0.2, zoom=1.0):
    """Photo cropped inside the Siha S shape: two stacked halves sharing one image."""
    bw, bh, ox, oy = cover_bg(img, w, h, fx, fy, zoom)
    bg = f"background-image:url(assets/photos/{img});background-size:{bw:.0f}px {bh:.0f}px;"
    return (f'<div class="sframe" data-name="Photo" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px">'
            f'<div class="t" style="{bg}background-position:{ox:.0f}px {oy:.0f}px"></div>'
            f'<div class="b" style="{bg}background-position:{ox:.0f}px {oy - h / 2:.0f}px"></div></div>')


def print_card(x, y, w, h, img, cap, rot=-4, fx=0.5, fy=0.15, zoom=1.0):
    """A small photo print (fun photo) lying on the card with a real shadow."""
    bw, bh, ox, oy = cover_bg(img, w, h, fx, fy, zoom)
    cap_html = f'<div class="cap">{cap}</div>' if cap else '<div style="height:44px"></div>'
    return (f'<div class="print" data-name="Off duty print" style="left:{x}px;top:{y}px;transform:rotate({rot}deg)">'
            f'<div class="ph" data-name="Photo" style="width:{w}px;height:{h}px;background-image:url(assets/photos/{img});'
            f'background-size:{bw:.0f}px {bh:.0f}px;background-position:{ox:.0f}px {oy:.0f}px"></div>{cap_html}</div>')


STAR = '<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="currentColor"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>'


def proof(color, size=20):
    stars = "".join(STAR.format(s=size) for _ in range(5))
    return (f'<div style="display:flex;align-items:center;gap:14px;color:{color}">'
            f'<span style="display:flex;gap:3px">{stars}</span>'
            f'<span class="small" style="font-size:{size}px">5.0 from 156 Google reviews</span></div>')


CTA = "Book a free consultation"

# name lines, role, what they do (site bio), credential (site bio), off-duty caption (only where the fun photo shows it)
TEAM = [
    dict(id="hannan", first="Dr Hannan", last="Imran", role="Director &amp; Restorative Dentist",
         line="Natural smile makeovers with Invisalign, bonding and veneers.",
         cred="PG Cert in Restorative Dentistry, Eastman Dental Institute",),
    dict(id="abeera", first="Dr Abeera", last="Imran", role="Specialist Orthodontist",
         line="Braces and aligners for adults and children.",
         cred="Masters in Orthodontics, King&rsquo;s College London",),
    dict(id="darshan", first="Dr Darshan", last="Boindala", role="Special interest in oral surgery",
         line="Oral surgery and dental implants.",
         cred="MSc in Implantology and Oral Surgery. Dentist since 1999",),
    dict(id="asiya", first="Dr Asiya", last="Janmohamed", role="Special interest in endodontics",
         line="Calm, reassuring root canal care.",
         cred="Specialist training in endodontics, King&rsquo;s College London",),
    dict(id="leen", first="Leen", last="El Ghandour", role="Hygienist",
         line="Making sure you feel informed and at ease.",
         cred="Doctor of Dental Surgery, Saint Joseph University, Beirut",),
    dict(id="umasha", first="Umasha", last="Ukwatte", role="Hygiene Therapist",
         line="Personalised care to keep your smile healthy at home.",
         cred="5+ years in practice. Researcher at the University of Oxford",),
    dict(id="francisca", first="Francisca", last="Nagam", role="Assistant Practice Manager",
         line="Keeps every day at the practice running smoothly.",
         cred="3+ years in dentistry",),
    dict(id="amelia", first="Amelia", last="Halmarick", role="Patient Concierge",
         line="Your first point of contact, from booking to payment options.",
         cred="8+ years in patient care",),
    dict(id="sara", first="Sara", last="El-Ali", role="Patient Concierge",
         line="Here to welcome and guide you from your very first visit.",
         cred=None, last_card=True),
]


CUT = json.loads((A / "cutouts" / "meta.json").read_text())
FRAME = dict(x=570, y=190, w=430, h=790)   # S-frame; the cut-out breaks out of it
CX, TARGET_W, MAX_H = 785, 430, 720        # person centre, body width, head-to-hem height


def person_layers(pid):
    """S-frame photo plus the matching background-removed cut-out on top, so the person breaks out of the frame."""
    m = CUT[pid]
    bx0, by0, bx1, _ = m["bbox"]
    f = FRAME
    # size by body width (capped by height), never smaller than the frame; photo hem sits on the frame's bottom edge
    s = max(min(TARGET_W / (bx1 - bx0), MAX_H / (m["h"] - by0)), f["h"] / m["h"], f["w"] / m["w"])
    w, h = m["w"] * s, m["h"] * s
    left, top = CX - s * (bx0 + bx1) / 2, f["y"] + f["h"] - h
    bg = f"background-image:url(assets/photos/{pid}.jpg);background-size:{w:.0f}px {h:.0f}px;"
    ox, oy = left - f["x"], top - f["y"]
    frame = (f'<div class="sframe" data-name="Photo" style="left:{f["x"]}px;top:{f["y"]}px;width:{f["w"]}px;height:{f["h"]}px">'
             f'<div class="t" style="{bg}background-position:{ox:.0f}px {oy:.0f}px"></div>'
             f'<div class="b" style="{bg}background-position:{ox:.0f}px {oy - f["h"] / 2:.0f}px"></div></div>')
    cut = (f'<img class="abs" data-name="Cut-out" src="assets/cutouts/{pid}.png" '
           f'style="left:{left:.0f}px;top:{top:.0f}px;width:{w:.0f}px;height:{h:.0f}px;'
           f'filter:drop-shadow(0 18px 28px rgba(20,33,26,.28))">')
    return frame, cut


def person(n, p, dark):
    bg, fg, sub, acc = (C['od'], C['nu'], C['be'], C['bo']) if dark else (C['nu'], C['od'], C['ol'], C['bo'])
    glow = ("radial-gradient(circle at 78% 30%,rgba(171,111,75,.20),transparent 55%)" if dark
            else "radial-gradient(circle at 75% 30%,#f5f0eb 0%,rgba(234,227,222,0) 60%),linear-gradient(180deg,rgba(0,0,0,0) 60%,rgba(135,118,99,.10) 100%)")
    last = p.get("last_card")
    longest = max(len(p['first']), len(p['last']))
    name_size = 64 if longest <= 9 else 56 if longest <= 10 else 50
    cred = f'<div class="small" style="margin-top:26px;color:{C["be"] if dark else C["br"]};opacity:.9">{p["cred"]}</div>' if p.get("cred") else ""
    end = (f'<div style="margin-top:44px">{proof(sub, 18)}</div>'
           f'<div style="margin-top:26px"><span class="cta {"light" if dark else "dark"}">{CTA}</span></div>') if last else ""
    frame, cut = person_layers(p['id'])
    return f"""
<div class="ab" id="{p['id']}" data-name="Meet the team | Carousel {n:02d} | {p['first'].replace('Dr ', '')} | 1x1" style="background:{bg}">
  <div class="cover" data-name="Overlay (locked)" style="background:{glow}"></div>
  <div class="abs" style="left:560px;top:-20px;width:520px;color:{acc};opacity:{.35 if dark else .5}">{LINE_S}</div>
  <div class="abs" data-name="Carousel line" style="left:0;top:1040px;width:1080px;height:1px;background:{acc};opacity:.6"></div>
  {frame}
  {cut}
  <div class="abs" data-name="Text" style="left:80px;top:{200 if not last else 180}px;width:400px">
    <div class="eyebrow" style="width:360px;color:{acc}">{p['role']}</div>
    <div class="hl" style="margin-top:22px;margin-left:-2px;font-size:{name_size}px;color:{fg}">{p['first']}<br><b>{p['last']}</b></div>
    <div class="rule" style="margin-top:30px;background:{acc}"></div>
    <div class="body" style="margin-top:28px;font-size:26px;color:{sub}">{p['line']}</div>
    {cred}
    {end}
  </div>
  <div class="abs" style="left:80px;top:930px;width:170px;color:{fg}">{LOGO}</div>
  <div class="grain" data-name="Grain (locked)"></div>
</div>"""


def cover():
    prints = [
        print_card(478, 410, 240, 320, "abeera.jpg", "", rot=-10, fx=1.0, fy=0.1, zoom=1.35),
        print_card(770, 440, 240, 320, "amelia.jpg", "", rot=9, fx=0.0, fy=0.1, zoom=1.35),
        print_card(590, 350, 280, 380, "hannan.jpg", "", rot=-1.5, fy=0.12),
    ]
    return f"""
<div class="ab" id="cover" data-name="Meet the team | Carousel 01 | Cover | 1x1" style="background:{C['be']}">
  <div class="cover" data-name="Overlay (locked)" style="background:radial-gradient(circle at 70% 40%,#efe7df 0%,{C['be']} 45%,#d2c3b5 100%)"></div>
  <div class="abs" style="left:520px;top:120px;width:560px;color:{C['bo']};opacity:.55">{LINE_S}</div>
  <div class="abs" style="left:80px;top:80px;width:170px;color:{C['od']}">{LOGO}</div>
  <div class="abs eyebrow" style="left:80px;top:250px;color:{C['bo']}">The people behind your smile</div>
  <div class="abs hl" style="left:76px;top:300px;font-size:112px;color:{C['od']}">Meet<br>the<br><b>team.</b></div>
  <div class="abs body" style="left:80px;top:690px;width:380px;color:{C['ol']}">Dentists, specialists, hygienists and the faces who greet you at the door.</div>
  {''.join(prints)}
  <div class="abs" style="left:80px;top:870px">{proof(C['ol'], 18)}</div>
  <div class="abs eyebrow" style="left:80px;top:950px;color:{C['od']};display:flex;align-items:center;gap:16px">Swipe to meet them <span style="font-size:30px;letter-spacing:0;font-weight:400">&rarr;</span></div>
  <div class="abs" data-name="Carousel line" style="left:0;top:1040px;width:1080px;height:1px;background:{C['bo']};opacity:.6"></div>
  <div class="grain" data-name="Grain (locked)"></div>
</div>"""


def page(title, boards):
    return (f"<!doctype html><html lang='en-GB'><head><meta charset='utf-8'><title>{title}</title>"
            f"<style>{CSS}</style><script src='https://mcp.figma.com/mcp/html-to-design/capture.js' async></script></head><body>{''.join(boards)}</body></html>")


if __name__ == "__main__":
    boards = [cover()] + [person(i + 2, p, dark=(i % 2 == 0)) for i, p in enumerate(TEAM)]
    (ROOT / "carousel-1x1.html").write_text(page("Siha | Meet the team | 1x1", boards))
    print("wrote carousel-1x1.html")
