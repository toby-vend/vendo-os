"""MK Smiles: General campaign statics, batch 2 (Sophie, family register). 27 Oct 2026.

Usage: python3 build-batch2.py [--render]
  writes sophie-1x1.html, sophie-9x16.html, sophie-landscape.html (3 concepts each);
  --render screenshots them with headless Chrome (port 8774) into renders/batch2/.
Brand: MK Smiles guideline (Figma Q67istgFgNYkRSaMFD9kCi): Poppins SemiBold + Light Italic turn, Jost caps labels,
Teal/Deep washes, tooth M bullets, MK watermark, Mint button. Photos: July 2026 shoot in assets/photos/web (gitignored).
Copy: copy-sophie.md. Research: research-general.md.
"""
import struct
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).parent
A = ROOT / "assets"
PH = "assets/photos/web"
DATE = "261027"
PORT = 8774
SIZES = {"1x1": (1080, 1080), "9x16": (1080, 1920), "ls": (1200, 628)}
SIZE_LABEL = {"1x1": "1x1", "9x16": "9x16", "ls": "1.91x1"}

GRAIN = ("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>"
         "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.9 0'/></filter>"
         "<rect width='100%' height='100%' filter='url(%23n)'/></svg>")
STAR = ('<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="currentColor" style="display:block">'
        '<path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>')
PIN = ('<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="currentColor" style="display:block;flex:none">'
       '<path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>')

BASE_CSS = f"""
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ background: #2a2a2a; display: flex; gap: 80px; padding: 80px; align-items: flex-start; }}
.ab {{ position: relative; overflow: hidden; flex: none; }}
.abs {{ position: absolute; }}
.ph {{ position: absolute; overflow: hidden; background-repeat: no-repeat; }}
.grain {{ position: absolute; inset: 0; background-image: url("{GRAIN}"); opacity: .12; mix-blend-mode: overlay; pointer-events: none; }}
.row {{ display: flex; align-items: center; }}
.stars {{ display: flex; gap: 3px; }}
"""


def aspect(img):
    """Width / height of a JPEG in assets/photos/web, read from its header (so crops never stretch)."""
    data = (ROOT / PH / img).read_bytes()
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


def photo(x, y, w, h, img, fx=0.5, fy=0.4, zoom=1.0, style="", name="Photo"):
    """Cover-crop a real photo into a box; fx/fy is the focal point (0 to 1), zoom > 1 crops tighter."""
    a = aspect(img)
    bw, bh = (w, w / a) if w / h > a else (h * a, h)
    bw, bh = bw * zoom, bh * zoom
    ox, oy = -(bw - w) * fx, -(bh - h) * fy
    return (f'<div class="ph" data-name="{name}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;'
            f'background-image:url({PH}/{img});background-size:{bw:.0f}px {bh:.0f}px;'
            f'background-position:{ox:.0f}px {oy:.0f}px;{style}"></div>')


def stars(s, color, n=5):
    return f'<div class="stars" style="color:{color}">' + STAR.format(s=s) * n + "</div>"


def grain(op=0.12):
    return f'<div class="grain" data-name="Grain (locked)" style="opacity:{op}"></div>'


def img(src, x, y, w, style="", name="Logo"):
    return f'<img data-name="{name}" src="assets/{src}" class="abs" style="left:{x}px;top:{y}px;width:{w}px;{style}">'


def board(size, name, inner, bg):
    w, h = SIZES[size]
    return f'<div class="ab" data-name="{name}" style="width:{w}px;height:{h}px;background:{bg}">{inner}</div>'


def ad_name(concept, talent, detail, size):
    return f"{concept} | Static | {talent} | {detail} | {SIZE_LABEL[size]} | {DATE}"


def page(title, css, boards):
    return (f"<!doctype html><html lang='en-GB'><head><meta charset='utf-8'><title>{title}</title>"
            f"<style>{BASE_CSS}{css}</style>"
            f"<script src='https://mcp.figma.com/mcp/html-to-design/capture.js' async></script></head>"
            f"<body>{''.join(boards)}</body></html>")


def write(persona, css, concepts):
    """concepts: list of functions size -> board html. Writes <persona>-1x1/-9x16/-landscape.html."""
    out = []
    for size, suffix in (("1x1", "1x1"), ("9x16", "9x16"), ("ls", "landscape")):
        f = ROOT / f"{persona}-{suffix}.html"
        f.write_text(page(f"{persona} {suffix}", css, [c(size) for c in concepts]))
        out.append(f.name)
    return out


def render(persona, n=3):
    """Headless Chrome at half scale, then crop every artboard into renders/batch2/ with ffmpeg."""
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=ROOT,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    rd = ROOT / "renders" / "batch2"
    rd.mkdir(parents=True, exist_ok=True)
    try:
        for size, suffix in (("1x1", "1x1"), ("9x16", "9x16"), ("ls", "landscape")):
            w, h = SIZES[size]
            shot = rd / f"{persona}-{suffix}.png"
            subprocess.run([chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--virtual-time-budget=9000",
                            "--force-device-scale-factor=0.5", f"--window-size={80 + n * (w + 80)},{h + 160}",
                            f"--screenshot={shot}", f"http://localhost:{PORT}/{persona}-{suffix}.html"],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            for i in range(n):
                subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(shot), "-vf",
                                f"crop={w // 2}:{h // 2}:{40 + i * (w + 80) // 2}:40", "-q:v", "3",
                                str(rd / f"{persona}-{suffix}-{i + 1}.jpg")])
    finally:
        srv.terminate()


def portrait(x, y, w, h, img, cx, cy, fh, face=0.26, at=0.36, name="Photo"):
    """Crop a team photo around a detected face (Apple Vision: centre cx/cy and height fh as fractions of the photo).

    The photo is scaled so the face is `face` of the box height, with its centre on the box's vertical axis at
    `at` of the box height; it never scales below cover, so the box is always filled (no stretching, no gaps).
    """
    a = aspect(img)
    bh = max(face * h / fh, h, w / a)
    bw = bh * a
    ox = min(0, max(w - bw, w / 2 - cx * bw))
    oy = min(0, max(h - bh, at * h - cy * bh))
    return (f'<div class="ph" data-name="{name}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;'
            f'background-image:url({PH}/{img});background-size:{bw:.0f}px {bh:.0f}px;'
            f'background-position:{ox:.0f}px {oy:.0f}px"></div>')


# ---------------------------------------------------------------- MK Smiles brand (guideline Q67istgFgNYkRSaMFD9kCi)
TEAL, SAGE, MINT, GOLD, SAND, WHITE = "#046169", "#7D9F98", "#7EBBAF", "#BFA05D", "#DFD1B5", "#FFFFFF"
DEEP, MIST, INK = "#03474D", "#EEF4F3", "#0E2A2C"
PROOF = "4.8 · 280+ Google reviews"

CSS = f"""
@font-face {{ font-family: Poppins; src: url(assets/fonts/Poppins-Light.ttf); font-weight: 300; }}
@font-face {{ font-family: Poppins; src: url(assets/fonts/Poppins-LightItalic.ttf); font-weight: 300; font-style: italic; }}
@font-face {{ font-family: Poppins; src: url(assets/fonts/Poppins-Regular.ttf); font-weight: 400; }}
@font-face {{ font-family: Poppins; src: url(assets/fonts/Poppins-Medium.ttf); font-weight: 500; }}
@font-face {{ font-family: Poppins; src: url(assets/fonts/Poppins-SemiBold.ttf); font-weight: 600; }}
@font-face {{ font-family: Jost; src: url(assets/fonts/Jost.ttf); font-weight: 100 900; }}
.ab {{ font-family: Poppins, sans-serif; color: {INK}; }}
.hl {{ font-weight: 600; line-height: 1.08; letter-spacing: -.012em; }}
.hl em {{ font-weight: 300; font-style: italic; display: block; }}
.lab {{ font-family: Jost; font-weight: 500; letter-spacing: .22em; text-transform: uppercase; color: {GOLD}; }}
.num {{ font-weight: 300; line-height: .8; letter-spacing: -.04em; }}
.btn {{ position: absolute; display: flex; align-items: center; justify-content: center; background: {MINT}; color: {DEEP};
        font-weight: 600; border-radius: 6px; box-shadow: 0 10px 24px rgba(0,0,0,.2); }}
.li {{ display: flex; align-items: center; font-weight: 500; }}
"""


def btn(x, y, w, h, fs, text="Book Appointment"):
    return f'<div class="btn" data-name="Button" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;font-size:{fs}px">{text}</div>'


def proof(x, y, fs, color, star=None):
    star = star or fs + 4
    return (f'<div class="abs row" data-name="Google reviews" style="left:{x}px;top:{y}px;gap:12px;font-size:{fs}px;color:{color};font-weight:500">'
            f'{stars(star, GOLD)}<span>{PROOF}</span></div>')


def ticks(x, y, items, fs, color, gap, w=None, icon="mark-m-white.png"):
    wd = f"width:{w}px;" if w else ""
    li = "".join(f'<div class="li" style="gap:{fs * .6:.0f}px;font-size:{fs}px;color:{color};margin-bottom:{gap}px">'
                 f'<img src="assets/{icon}" style="width:{fs * 1.25:.0f}px;flex:none">{t}</div>' for t in items)
    return f'<div class="abs" data-name="List" style="left:{x}px;top:{y}px;{wd}">{li}</div>'


def wash(style):
    return f'<div class="abs" data-name="Overlay (locked)" style="inset:0;{style}"></div>'


def panel(x, y, w, h, extra=""):
    return (f'<div class="abs" data-name="Panel" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;'
            f'background:radial-gradient(110% 80% at 15% 0%, #0A7680 0%, {TEAL} 45%, {DEEP} 100%);{extra}"></div>')


def watermark(x, y, w, op=.08):
    return f'<img data-name="MK watermark" src="assets/mark-mk-white.png" class="abs" style="left:{x}px;top:{y}px;width:{w}px;opacity:{op}">'


# ---------------------------------------------------------------- S1: VT-13 Team mosaic
# Face centres and heights from Apple Vision (scratch faces.swift), as fractions of each photo.
TEAM = [("18.jpg", .57, .50, .24), ("20.jpg", .55, .45, .22), ("22.jpg", .60, .45, .22), ("24.jpg", .63, .45, .20), ("26.jpg", .66, .50, .23), ("29.jpg", .55, .44, .23)]


def mosaic(x, y, cols, rows, cw, rh, face, gap=6):
    out = ""
    for i, (im, cx, cy, fh) in enumerate(TEAM[:cols * rows]):
        c, r = i % cols, i // cols
        out += portrait(x + c * (cw + gap), y + r * (rh + gap), cw, rh, im, cx, cy, fh, face=face, at=.42, name=f"Photo {i + 1}")
    return out


def s1(size):
    W, H = SIZES[size]
    hook = f"New to Brooklands?<em style='color:{MINT}'>Meet your new dental team.</em>"
    items = ["New patient check-up £50", "Open till 7pm Mon and Wed", "Saturdays till 4:30pm"]
    if size == "1x1":
        inner = f'<div class="abs" style="inset:0;background:{DEEP}"></div>' + mosaic(426, 0, 2, 3, 324, 356, .3)
        inner += panel(0, 0, 420, H) + watermark(-120, 760, 520, .07)
        inner += img("logo-white.png", 52, 52, 150)
        inner += f'<div class="abs hl" style="left:52px;top:262px;font-size:48px;color:{WHITE};width:350px">{hook}</div>'
        inner += ticks(52, 540, items, 22, WHITE, 18, w=360)
        inner += f'<div class="abs" style="left:52px;top:716px;font-size:19px;color:{WHITE};font-weight:500;line-height:1.4">{stars(20, GOLD)}<div style="margin-top:6px">{PROOF}</div></div>'
        inner += btn(52, 822, 316, 82, 25)
        inner += f'<div class="abs lab" style="left:52px;top:978px;font-size:15px">Brooklands Health Centre, MK10</div>'
    elif size == "9x16":
        inner = f'<div class="abs" style="inset:0;background:{DEEP}"></div>' + mosaic(0, 1110, 3, 2, 356, 405, .27)
        inner += panel(0, 0, W, 1104) + watermark(560, 120, 620, .07)
        inner += img("logo-white.png", 72, 262, 170)
        inner += f'<div class="abs hl" style="left:72px;top:470px;font-size:70px;color:{WHITE};width:900px">{hook}</div>'
        inner += ticks(72, 745, items, 30, WHITE, 20)
        inner += btn(72, 960, 380, 92, 31)
        inner += proof(482, 992, 22, WHITE, star=24)
    else:
        inner = f'<div class="abs" style="inset:0;background:{DEEP}"></div>' + mosaic(526, 0, 3, 2, 221, 311, .3)
        inner += panel(0, 0, 520, H) + watermark(250, 360, 360, .07)
        inner += img("logo-white.png", 44, 34, 110)
        inner += f'<div class="abs hl" style="left:44px;top:166px;font-size:36px;color:{WHITE};width:450px">{hook}</div>'
        inner += ticks(44, 312, items, 18, WHITE, 12)
        inner += btn(44, 448, 260, 64, 21)
        inner += f'<div class="abs" style="left:44px;top:538px;font-size:15px;color:{WHITE};font-weight:500;line-height:1.4">{stars(17, GOLD)}<div style="margin-top:4px">{PROOF}</div></div>'
    return board(size, ad_name("Faces First", "Team", "Team Mosaic", size), inner + grain(.1), DEEP)


# ---------------------------------------------------------------- S2: VT-03 Brand card
def pills(x, y, items, fs, w=None):
    p = "".join(f'<div class="li" style="gap:{fs * .5:.0f}px;font-size:{fs}px;color:{WHITE};border:1.5px solid rgba(255,255,255,.55);'
                f'border-radius:6px;padding:{fs * .55:.0f}px {fs * .8:.0f}px"><img src="assets/mark-m-white.png" style="width:{fs * 1.2:.0f}px">{t}</div>' for t in items)
    wd = f"width:{w}px;" if w else ""
    return f'<div class="abs" data-name="USP pills" style="left:{x}px;top:{y}px;display:flex;flex-wrap:wrap;gap:{fs * .6:.0f}px;{wd}">{p}</div>'


def card(x, y, w, h, s, items_w=None):
    hook = f"Your new dentist in<em style='color:{MINT};font-size:1.25em;line-height:1.05;margin-top:4px'>Brooklands</em>"
    return (f'<div class="abs" data-name="Card tab" style="left:{x}px;top:{y - 150 * s}px;width:{230 * s}px;height:{160 * s}px;border-radius:{16 * s}px {16 * s}px 0 0;'
            f'background:{DEEP};display:flex;align-items:center;justify-content:center"><img src="assets/logo-white.png" style="height:{122 * s}px"></div>'
            f'<div class="abs" data-name="Card" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;border-radius:0 {22 * s}px {22 * s}px {22 * s}px;'
            f'background:linear-gradient(160deg,{DEEP} 0%,#033B40 100%);box-shadow:0 30px 60px rgba(0,0,0,.35)"></div>'
            f'<div class="abs hl" style="left:{x + 48 * s}px;top:{y + 44 * s}px;font-size:{58 * s}px;color:{WHITE};width:{w - 96 * s}px">{hook}</div>'
            f'<div class="abs" style="left:{x + 48 * s}px;top:{y + 228 * s}px;font-size:{27 * s}px;color:{WHITE}">New patient check-up <b style="font-weight:600;color:{MINT}">£50</b>'
            f' <span style="opacity:.7;text-decoration:line-through">£76.70</span></div>'
            + pills(x + 48 * s, y + 296 * s, ["3D scan included", "Evenings Mon and Wed", "Saturdays"], 20 * s, w=items_w)
            + btn(x + 48 * s, y + h - 130 * s, 316 * s, 82 * s, 25 * s)
            + proof(x + 392 * s, y + h - 102 * s, 18 * s, WHITE, star=20 * s))


def s2(size):
    W, H = SIZES[size]
    if size == "1x1":
        inner = photo(0, 0, W, H, "7.jpg", fx=0.5, fy=0.5, zoom=1.15)
        inner += wash("background:linear-gradient(180deg,rgba(3,71,77,0) 30%,rgba(3,71,77,.45) 100%)")
        inner += card(56, 470, 968, 556, 1)
    elif size == "9x16":
        inner = photo(0, 0, W, H, "7.jpg", fx=0.42, fy=0.5)
        inner += wash("background:linear-gradient(180deg,rgba(3,71,77,0) 35%,rgba(3,71,77,.5) 100%)")
        inner += card(48, 1010, 984, 520, 1.0, items_w=900)
    else:
        inner = photo(0, 0, W, H, "7.jpg", fx=0.6, fy=0.5)
        inner += wash("background:linear-gradient(90deg,rgba(3,71,77,.5) 0%,rgba(3,71,77,0) 60%)")
        inner += card(36, 150, 660, 440, .72, items_w=600)
    return board(size, ad_name("New Dentist Brooklands", "Practice", "Brand Card", size), inner + grain(.1), DEEP)


# ---------------------------------------------------------------- S3: Custom oversized 7pm split
def big7(x, y, s):
    return (f'<div class="abs lab" style="left:{x}px;top:{y}px;font-size:{20 * s}px">Mondays and Wednesdays</div>'
            f'<div class="abs num" data-name="Big number" style="left:{x - 10 * s}px;top:{y + 40 * s}px;font-size:{250 * s}px;color:{WHITE}">7<span style="font-size:.5em;letter-spacing:0;margin-left:{8 * s}px">pm</span></div>')


def s3(size):
    W, H = SIZES[size]
    hook = f"Dentist after school pick-up?<em style='color:{MINT}'>We're open till 7pm.</em>"
    sub = "Saturdays 8:45am to 4:30pm<br>New patient check-up £50"
    if size == "1x1":
        inner = photo(0, 0, 500, H, "4.jpg", fx=0.42, fy=0.5, zoom=1.0)
        inner += panel(500, 0, 580, H) + watermark(760, 700, 520, .08)
        inner += f'<div class="abs hl" style="left:556px;top:70px;font-size:42px;color:{WHITE};width:480px">{hook}</div>'
        inner += big7(556, 300, 1)
        inner += img("crown-rule-white.png", 556, 600, 460, "opacity:.8", name="Crown rule")
        inner += f'<div class="abs" style="left:556px;top:650px;font-size:26px;color:{WHITE};line-height:1.5">{sub}</div>'
        inner += f'<div class="abs" style="left:556px;top:772px;font-size:18px;color:{WHITE};font-weight:500;line-height:1.4">{stars(20, GOLD)}<div style="margin-top:6px">{PROOF}</div></div>'
        inner += btn(556, 880, 316, 82, 25)
        inner += f'<div class="abs" style="left:0;top:0;width:500px;height:{H}px;box-shadow:inset -40px 0 60px -30px rgba(0,0,0,.35)"></div>'
    elif size == "9x16":
        inner = photo(0, 0, W, 860, "4.jpg", fx=0.4, fy=0.5)
        inner += wash("height:860px;background:linear-gradient(180deg,rgba(3,71,77,0) 60%,rgba(3,71,77,.5) 100%)")
        inner += panel(0, 860, W, 1060) + watermark(600, 1200, 700, .07)
        inner += f'<div class="abs hl" style="left:72px;top:920px;font-size:58px;color:{WHITE};width:940px">{hook}</div>'
        inner += big7(72, 1100, .9)
        inner += f'<div class="abs" style="left:520px;top:1190px;font-size:28px;color:{WHITE};line-height:1.5">{sub}</div>'
        inner += btn(72, 1440, 380, 92, 31)
        inner += proof(482, 1472, 22, WHITE, star=24)
    else:
        inner = photo(0, 0, 520, H, "4.jpg", fx=0.42, fy=0.5)
        inner += panel(520, 0, 680, H) + watermark(900, 330, 420, .08)
        inner += f'<div class="abs hl" style="left:566px;top:40px;font-size:32px;color:{WHITE};width:600px">{hook}</div>'
        inner += big7(566, 170, .62)
        inner += f'<div class="abs" style="left:880px;top:236px;font-size:19px;color:{WHITE};line-height:1.5">{sub}</div>'
        inner += img("crown-rule-white.png", 566, 400, 580, "opacity:.7", name="Crown rule")
        inner += btn(566, 456, 260, 64, 21)
        inner += proof(846, 478, 15, WHITE, star=17)
    return board(size, ad_name("Open Till 7pm", "Practice", "Big Number Split", size), inner + grain(.1), DEEP)


if __name__ == "__main__":
    print(write("sophie", CSS, [s1, s2, s3]))
    if "--render" in sys.argv:
        render("sophie")
        print("rendered to renders/batch2/")
