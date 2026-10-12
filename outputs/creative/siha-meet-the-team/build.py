"""Build the Siha Dental 'Meet the Team' Meta carousel harness (10 cards, 1080x1080).

Usage: python3 build.py  -> writes carousel-1x1.html
Brand: Siha guideline (Figma AbtwUHTD50G38QuOaCG4Hh). Font: Metropolis (assets/fonts).
Photos: Siha team folder on Drive (1AuPYT-L9XuAtKWC9dmabeLOkXyu_bI5_), downscaled into assets/photos.
Team facts: siha.dental/our-team (checked 2026-10-06).
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
TEAM = [  # first names only (Hannan, 12 Oct 2026: patients have messaged female team members)
    dict(id="hannan", name="Dr Hannan", role="Director &amp; Restorative Dentist",
         line="Natural smile makeovers with Invisalign, bonding and veneers.",
         cred="PG Cert in Restorative Dentistry, Eastman Dental Institute",),
    dict(id="abeera", name="Dr Abeera", role="Specialist Orthodontist",
         line="Braces and aligners for adults and children.",
         cred="Masters in Orthodontics, King&rsquo;s College London",),
    dict(id="darshan", name="Dr Darshan", role="Special interest in oral surgery",
         line="Oral surgery and dental implants.",
         cred="MSc in Implantology and Oral Surgery. Dentist since 1999",),
    dict(id="asiya", name="Dr Asiya", role="Special interest in endodontics",
         line="Calm, reassuring root canal care.",
         cred="Specialist training in endodontics, King&rsquo;s College London",),
    dict(id="nicholas", name="Dr Nicholas", role="Cosmetic Dentist",
         line="Natural, confident smiles, tailored to each patient.",
         cred="Master&rsquo;s in Restorative Dentistry and Oral Rehabilitation, Barcelona",),
    dict(id="ayesha", name="Dr Ayesha", role="Dentist",  # role to confirm with Hannan; not on siha.dental yet
         line="Looking after your smile from your very first visit.", cred=None,),
    dict(id="thishock", name="Dr Thishock", role="Dentist",  # role to confirm with Hannan; not on siha.dental yet
         line="Looking after your smile from your very first visit.", cred=None,),
    dict(id="leen", name="Leen", role="Hygienist",
         line="Making sure you feel informed and at ease.",
         cred="Doctor of Dental Surgery, Saint Joseph University, Beirut",),
    dict(id="umasha", name="Umasha", role="Hygiene Therapist",
         line="Personalised care to keep your smile healthy at home.",
         cred="5+ years in practice. Researcher at the University of Oxford",),
    dict(id="francisca", name="Francisca", role="Assistant Practice Manager",
         line="Keeps every day at the practice running smoothly.",
         cred="3+ years in dentistry",),
    dict(id="amelia", name="Amelia", role="Patient Concierge",
         line="Your first point of contact, from booking to payment options.",
         cred="8+ years in patient care",),
    dict(id="sara", name="Sara", role="Patient Concierge",
         line="Here to welcome and guide you from your very first visit.",
         cred=None, last_card=True),
]


# Face boxes (x, y, w, h in source pixels, Apple Vision) for each team photo in assets/photos.
FACES = {"hannan": (1067, 1600, 435, 434, 221), "abeera": (1067, 1600, 451, 441, 218), "darshan": (1066, 1600, 427, 204, 244),
         "asiya": (1067, 1600, 439, 419, 218), "leen": (1067, 1600, 544, 471, 204), "umasha": (1067, 1600, 433, 349, 228),
         "francisca": (1067, 1600, 428, 483, 239), "amelia": (1067, 1600, 418, 334, 281), "sara": (1067, 1600, 438, 297, 255),
         "ayesha": (893, 1340, 397, 373, 197), "nicholas": (1024, 1536, 423, 352, 238), "thishock": (1024, 1536, 427, 384, 212)}
FRAME = dict(x=570, y=400, w=430, h=580)   # S-frame; only the head breaks out above it
BREAKOUT = 110


def person_layers(pid):
    """Team member from mid-chest up (Hannan, 12 Oct 2026: some photos are AI-retouched, so no arms or hands).

    Mid-chest (face top + 2.7 face heights) sits on the frame's bottom edge; the background-removed cut-out is
    clipped to the strip above the frame so only the head breaks out and the shoulders stay inside the S.
    """
    W, H, fx, fy, fs = FACES[pid]
    f = FRAME
    s = (f["h"] + BREAKOUT) / (3.25 * fs)
    w, h = W * s, H * s
    left = f["x"] + f["w"] / 2 + 15 - s * (fx + fs / 2)
    top = f["y"] + f["h"] - s * (fy + 2.7 * fs)
    bg = f"background-image:url(assets/photos/{pid}.jpg);background-size:{w:.0f}px {h:.0f}px;"
    ox, oy = left - f["x"], top - f["y"]
    frame = (f'<div class="sframe" data-name="Photo" style="left:{f["x"]}px;top:{f["y"]}px;width:{f["w"]}px;height:{f["h"]}px">'
             f'<div class="t" style="{bg}background-position:{ox:.0f}px {oy:.0f}px"></div>'
             f'<div class="b" style="{bg}background-position:{ox:.0f}px {oy - f["h"] / 2:.0f}px"></div></div>')
    pad = 60
    bx, by = f["x"] - pad, f["y"] - BREAKOUT - pad
    cut = (f'<div class="abs" data-name="Head breakout" style="left:{bx}px;top:{by}px;width:{f["w"] + 2 * pad}px;height:{BREAKOUT + pad}px;overflow:hidden">'
           f'<img data-name="Cut-out" src="assets/cutouts/{pid}.png" style="position:absolute;left:{left - bx:.0f}px;top:{top - by:.0f}px;width:{w:.0f}px;height:{h:.0f}px"></div>')
    return frame, cut


def person(n, p, dark):
    bg, fg, sub, acc = (C['od'], C['nu'], C['be'], C['bo']) if dark else (C['nu'], C['od'], C['ol'], C['bo'])
    glow = ("radial-gradient(circle at 78% 30%,rgba(171,111,75,.20),transparent 55%)" if dark
            else "radial-gradient(circle at 75% 30%,#f5f0eb 0%,rgba(234,227,222,0) 60%),linear-gradient(180deg,rgba(0,0,0,0) 60%,rgba(135,118,99,.10) 100%)")
    last = p.get("last_card")
    title, first = p['name'].split(' ', 1) if p['name'].startswith('Dr ') else ('', p['name'])
    name_html = f"{title}<br><b>{first}</b>" if title else f"<b>{first}</b>"
    name_size = 64 if len(first) <= 9 else 56
    cred = f'<div class="small" style="margin-top:26px;color:{C["be"] if dark else C["br"]};opacity:.9">{p["cred"]}</div>' if p.get("cred") else ""
    end = (f'<div style="margin-top:44px">{proof(sub, 18)}</div>'
           f'<div style="margin-top:26px"><span class="cta {"light" if dark else "dark"}">{CTA}</span></div>') if last else ""
    frame, cut = person_layers(p['id'])
    return f"""
<div class="ab" id="{p['id']}" data-name="Meet the team | Carousel {n:02d} | {p['id'].title()} | 1x1" style="background:{bg}">
  <div class="cover" data-name="Overlay (locked)" style="background:{glow}"></div>
  <div class="abs" style="left:560px;top:-20px;width:520px;color:{acc};opacity:{.35 if dark else .5}">{LINE_S}</div>
  <div class="abs" data-name="Carousel line" style="left:0;top:1040px;width:1080px;height:1px;background:{acc};opacity:.6"></div>
  {frame}
  {cut}
  <div class="abs" data-name="Text" style="left:80px;top:{200 if not last else 180}px;width:400px">
    <div class="eyebrow" style="width:360px;color:{acc}">{p['role']}</div>
    <div class="hl" style="margin-top:22px;margin-left:-2px;font-size:{name_size}px;color:{fg}">{name_html}</div>
    <div class="rule" style="margin-top:30px;background:{acc}"></div>
    <div class="body" style="margin-top:28px;font-size:26px;color:{sub}">{p['line']}</div>
    {cred}
    {end}
  </div>
  <div class="abs" style="left:80px;top:930px;width:170px;color:{fg}">{LOGO}</div>
  <div class="grain" data-name="Grain (locked)"></div>
</div>"""


def chest_print(x, y, w, h, pid, rot):
    """A photo print cropped from just above the head to mid-chest, face centred."""
    W, H, fx, fy, fs = FACES[pid]
    sc = h / (3.45 * fs)
    ox, oy = w / 2 - sc * (fx + fs / 2), -sc * (fy - 0.75 * fs)
    return (f'<div class="print" data-name="Team print" style="left:{x}px;top:{y}px;transform:rotate({rot}deg)">'
            f'<div class="ph" data-name="Photo" style="width:{w}px;height:{h}px;background-image:url(assets/photos/{pid}.jpg);'
            f'background-size:{W * sc:.0f}px {H * sc:.0f}px;background-position:{ox:.0f}px {oy:.0f}px"></div><div style="height:44px"></div></div>')


def cover():
    prints = [  # mid-chest-up crops, like the cards
        chest_print(478, 410, 240, 320, "abeera", rot=-10),
        chest_print(770, 440, 240, 320, "amelia", rot=9),
        chest_print(590, 350, 280, 380, "hannan", rot=-1.5),
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
