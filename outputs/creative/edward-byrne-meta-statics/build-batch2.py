"""Edward Byrne Associates: General campaign statics, batch 2 (Mark, lapsed patient). 27 Oct 2026.

Usage: python3 build-batch2.py [--render]
  writes mark-1x1.html, mark-9x16.html, mark-landscape.html (3 concepts each);
  --render screenshots them with headless Chrome (port 8774) into renders/batch2/.
Brand: Edward Byrne guideline (Figma hR3IRDkgBzuJoYycZ2qTe4): Poppins SemiBold + italic turn (Plum on light, Gold on
Black), Jost labels, Kana crown ticks, Gold hairline photo frames, Gold buttons. Photos: July 2026 shoot (gitignored).
Copy: copy-mark.md. Research: research-general.md.
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


# ---------------------------------------------------------------- Edward Byrne brand (guideline hR3IRDkgBzuJoYycZ2qTe4)
BLACK, GOLD, PLUM, BLUSH, CREAM, WHITE = "#241F1F", "#C2A76C", "#73424F", "#D0B0A8", "#F8EDE2", "#FFFFFF"
PAPER = "#FCF8F2"
PROOF = "Rated Excellent · 280+ Google reviews"

CSS = f"""
@font-face {{ font-family: Poppins; src: url(assets/fonts/Poppins-Light.ttf); font-weight: 300; }}
@font-face {{ font-family: Poppins; src: url(assets/fonts/Poppins-LightItalic.ttf); font-weight: 300; font-style: italic; }}
@font-face {{ font-family: Poppins; src: url(assets/fonts/Poppins-Regular.ttf); font-weight: 400; }}
@font-face {{ font-family: Poppins; src: url(assets/fonts/Poppins-Italic.ttf); font-weight: 400; font-style: italic; }}
@font-face {{ font-family: Poppins; src: url(assets/fonts/Poppins-Medium.ttf); font-weight: 500; }}
@font-face {{ font-family: Poppins; src: url(assets/fonts/Poppins-SemiBold.ttf); font-weight: 600; }}
@font-face {{ font-family: Jost; src: url(assets/fonts/Jost.ttf); font-weight: 100 900; }}
.ab {{ font-family: Poppins, sans-serif; color: {BLACK}; }}
.hl {{ font-weight: 600; line-height: 1.1; letter-spacing: -.012em; }}
.hl em {{ font-weight: 400; font-style: italic; }}
.lab {{ font-family: Jost; font-weight: 500; letter-spacing: .22em; text-transform: uppercase; }}
.btn {{ position: absolute; display: flex; align-items: center; justify-content: center; background: {GOLD}; color: {BLACK};
        font-weight: 600; border-radius: 4px; box-shadow: 0 10px 24px rgba(0,0,0,.22); }}
.li {{ display: flex; align-items: center; font-weight: 500; }}
"""


def btn(x, y, w, h, fs, text="Book Appointment"):
    return f'<div class="btn" data-name="Button" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;font-size:{fs}px">{text}</div>'


def proof(x, y, fs, color, star=None):
    star = star or fs + 4
    return (f'<div class="abs row" data-name="Google reviews" style="left:{x}px;top:{y}px;gap:12px;font-size:{fs}px;color:{color};font-weight:500;white-space:nowrap">'
            f'{stars(star, GOLD)}<span>{PROOF}</span></div>')


def crowns(x, y, items, fs, color, gap, w=None):
    wd = f"width:{w}px;" if w else ""
    li = "".join(f'<div class="li" style="gap:{fs * .65:.0f}px;font-size:{fs}px;color:{color};margin-bottom:{gap}px;line-height:1.3">'
                 f'<img src="assets/crown.png" style="width:{fs * 1.3:.0f}px;flex:none">{t}</div>' for t in items)
    return f'<div class="abs" data-name="Ticks" style="left:{x}px;top:{y}px;{wd}">{li}</div>'


def wash(style):
    return f'<div class="abs" data-name="Overlay (locked)" style="inset:0;{style}"></div>'


# ---------------------------------------------------------------- M1: VT-31 note
def note(x, y, w, h, s, rot=-2.2):
    items = ["We take things at your pace", "Everything explained as we go", "45 minutes, never rushed"]
    li = "".join(f'<div class="li" style="gap:{16 * s}px;font-size:{30 * s}px;color:{BLACK};margin-top:{20 * s}px">'
                 f'<img src="assets/crown.png" style="width:{36 * s}px;flex:none">{t}</div>' for t in items)
    return (f'<div class="abs" data-name="Shadow" style="left:{x + 14 * s}px;top:{y + 26 * s}px;width:{w}px;height:{h}px;transform:rotate({rot + .8}deg);'
            f'background:rgba(0,0,0,.55);filter:blur({24 * s}px)"></div>'
            f'<div class="abs" data-name="Sign" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;transform:rotate({rot}deg);background:{PAPER};'
            f'padding:{60 * s}px {56 * s}px;background-image:linear-gradient(170deg,#FFFDF9 0%,#F3EADF 100%);border-radius:{3 * s}px">'
            f'<div style="position:absolute;inset:0;background-image:url(&quot;{GRAIN}&quot;);opacity:.2;mix-blend-mode:multiply"></div>'
            f'<div data-name="Tape" style="position:absolute;left:50%;top:{-22 * s}px;width:{190 * s}px;height:{50 * s}px;margin-left:{-95 * s}px;'
            f'transform:rotate(3deg);background:rgba(194,167,108,.55);box-shadow:0 2px 6px rgba(0,0,0,.12)"></div>'
            f'<div class="hl" data-name="Headline" style="font-size:{64 * s}px;line-height:1.08">Been a few years?<br><em style="color:{PLUM}">That\'s fine.</em></div>'
            f'<div data-name="Underline" style="width:{300 * s}px;height:{4 * s}px;background:{GOLD};margin:{22 * s}px 0 {14 * s}px;border-radius:2px"></div>'
            f'{li}</div>')


def m1(size):
    W, H = SIZES[size]
    offer = f'New patient check-up <b style="font-weight:600;color:{GOLD}">£60</b> · Bedford'
    if size == "1x1":
        inner = photo(-20, -20, W + 40, H + 40, "l11.jpg", fx=0.4, fy=0.5, style="filter:blur(5px)")
        inner += wash("background:linear-gradient(180deg,rgba(36,31,31,.35) 0%,rgba(36,31,31,.25) 45%,rgba(36,31,31,.88) 100%)")
        inner += note(110, 150, 860, 470, 1.08)
        inner += f'<div class="abs" style="left:72px;top:800px;font-size:30px;color:{WHITE}">{offer}</div>'
        inner += btn(72, 872, 330, 84, 26)
        inner += img("logo-white.png", 728, 868, 290)
    elif size == "9x16":
        inner = photo(-20, -20, W + 40, H + 40, "l11.jpg", fx=0.38, fy=0.5, style="filter:blur(5px)")
        inner += wash("background:linear-gradient(180deg,rgba(36,31,31,.6) 0%,rgba(36,31,31,.25) 28%,rgba(36,31,31,.55) 58%,rgba(36,31,31,.93) 68%,rgba(36,31,31,.96) 100%)")
        inner += img("logo-white.png", 72, 270, 330)
        inner += note(80, 540, 920, 500, 1.1)
        inner += f'<div class="abs" style="left:72px;top:1290px;font-size:34px;color:{WHITE}">{offer}</div>'
        inner += btn(72, 1370, 400, 96, 32)
        inner += proof(72, 1500, 22, WHITE, star=24)
    else:
        inner = photo(-20, -20, W + 40, H + 40, "l11.jpg", fx=0.45, fy=0.5, style="filter:blur(4px)")
        inner += wash("background:linear-gradient(90deg,rgba(36,31,31,.9) 0%,rgba(36,31,31,.6) 45%,rgba(36,31,31,.25) 100%)")
        inner += img("logo-white.png", 48, 40, 250)
        inner += f'<div class="abs" style="left:48px;top:200px;font-size:24px;color:{WHITE};width:420px;line-height:1.45">Nervous about coming back? We take it at your pace.</div>'
        inner += f'<div class="abs" style="left:48px;top:330px;font-size:22px;color:{WHITE}">{offer}</div>'
        inner += btn(48, 390, 270, 68, 22)
        inner += proof(48, 500, 15, WHITE, star=17)
        inner += note(560, 70, 590, 480, .74)
    return board(size, ad_name("Been A Few Years", "Practice", "Handwritten Sign", size), inner + grain(), BLACK)


# ---------------------------------------------------------------- M2: VT-07 Three reasons
P6 = ("p6.jpg", .46, .37, .13)  # face from Apple Vision


def framed(x, y, w, h, off, face):
    im, cx, cy, fh = P6
    return (f'<div class="abs" data-name="Frame line" style="left:{x + off}px;top:{y + off}px;width:{w}px;height:{h}px;border:1.5px solid {GOLD}"></div>'
            f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;box-shadow:0 24px 50px rgba(36,31,31,.25)"></div>'
            + portrait(x, y, w, h, im, cx, cy, fh, face=face, at=.3))


def m2(size):
    W, H = SIZES[size]
    hook = f'3 reasons to come back to the dentist <em style="color:{PLUM}">in Bedford</em>'
    items = ["45 minutes with your dentist, never rushed", "A 3D scan, so you can see what we see", "A written plan: what's urgent, what can wait"]
    bg = f"background:radial-gradient(90% 70% at 20% 10%, #FFF8F0 0%, {CREAM} 55%, #EFDFD0 100%)"
    if size == "1x1":
        inner = f'<div class="abs" style="inset:0;{bg}"></div>'
        inner += img("logo-colour.png", 64, 56, 230)
        inner += f'<div class="abs hl" style="left:64px;top:190px;font-size:52px;width:560px">{hook}</div>'
        inner += crowns(64, 450, items, 25, BLACK, 30, w=520)
        inner += framed(660, 160, 356, 640, 16, .2)
        bar = 850
        inner += f'<div class="abs" data-name="Review bar" style="left:64px;top:{bar}px;width:952px;height:150px;background:{BLACK};border-radius:6px"></div>'
        inner += f'<div class="abs" style="left:104px;top:{bar + 36}px;color:{WHITE};font-size:20px;font-weight:500;line-height:1.4">{stars(24, GOLD)}<div style="margin-top:8px">{PROOF}</div><div style="color:{BLUSH};font-size:18px">New patient check-up £60</div></div>'
        inner += btn(652, bar + 33, 330, 84, 26)
    elif size == "9x16":
        inner = f'<div class="abs" style="inset:0;{bg}"></div>'
        inner += img("logo-colour.png", 72, 270, 280)
        inner += f'<div class="abs hl" style="left:72px;top:420px;font-size:66px;width:930px">{hook}</div>'
        inner += crowns(72, 700, items, 28, BLACK, 52, w=500)
        inner += framed(620, 690, 390, 560, 16, .22)
        bar = 1340
        inner += f'<div class="abs" data-name="Review bar" style="left:72px;top:{bar}px;width:936px;height:200px;background:{BLACK};border-radius:6px"></div>'
        inner += f'<div class="abs" style="left:112px;top:{bar + 40}px;color:{WHITE};font-size:22px;font-weight:500;line-height:1.4">{stars(26, GOLD)}<div style="margin-top:8px">{PROOF}</div><div style="color:{BLUSH};font-size:20px">New patient check-up £60</div></div>'
        inner += btn(626, bar + 54, 340, 92, 28)
    else:
        inner = f'<div class="abs" style="inset:0;{bg}"></div>'
        inner += img("logo-colour.png", 48, 34, 190)
        inner += f'<div class="abs hl" style="left:48px;top:128px;font-size:36px;width:700px">{hook}</div>'
        inner += crowns(48, 252, items, 19, BLACK, 14, w=640)
        inner += f'<div class="abs" style="left:48px;top:420px;width:300px;font-size:17px;color:{PLUM};font-weight:500">New patient check-up £60</div>'
        inner += btn(48, 470, 250, 64, 20)
        inner += f'<div class="abs" data-name="Review pill" style="left:318px;top:470px;height:64px;padding:0 22px;border-radius:32px;background:{BLACK};display:flex;align-items:center;gap:10px;color:{WHITE};font-size:15px;font-weight:500">{stars(16, GOLD)}{PROOF}</div>'
        inner += framed(870, 40, 290, 530, 12, .2)
    return board(size, ad_name("Three Reasons", "Team", "Three Reasons", size), inner + grain(.08), CREAM)


# ---------------------------------------------------------------- M3: Custom full-bleed editorial
def m3(size):
    W, H = SIZES[size]
    hook = f'The longer you leave it,<em style="color:{GOLD};display:block">the harder it is to book.</em>'
    sub = "So let's make it easy. New patient check-up £60 · 45 minutes · 3D scan included"
    crown_wm = f'<img data-name="Crown watermark" src="assets/crown.png" class="abs" style="{{}};opacity:.08">'
    if size == "1x1":
        inner = photo(0, 0, W, H, "l23.jpg", fx=0.55, fy=0.35, zoom=1.05)
        inner += wash("background:linear-gradient(180deg,rgba(36,31,31,.7) 0%,rgba(36,31,31,.25) 22%,rgba(36,31,31,.35) 35%,rgba(36,31,31,.94) 70%,rgba(36,31,31,.98) 100%)")
        inner += crown_wm.format("left:700px;top:560px;width:460px")
        inner += img("logo-white.png", 64, 56, 260)
        inner += f'<div class="abs hl" style="left:64px;top:470px;font-size:66px;color:{WHITE};width:960px">{hook}</div>'
        inner += img("crown-rule-white.png", 64, 712, 520, "opacity:.75", name="Crown rule")
        inner += f'<div class="abs" style="left:64px;top:770px;font-size:26px;color:{CREAM};width:900px;line-height:1.45">{sub}</div>'
        inner += btn(64, 878, 330, 84, 26)
        inner += proof(424, 908, 19, WHITE, star=21)
        inner += f'<div class="abs lab" style="left:64px;top:1008px;font-size:15px;color:{GOLD}">16 De Parys Avenue, Bedford</div>'
    elif size == "9x16":
        inner = photo(0, 0, W, 1250, "l23.jpg", fx=0.55, fy=0.4)
        inner += f'<div class="abs" style="left:0;top:1240px;width:{W}px;height:680px;background:{BLACK}"></div>'
        inner += wash("background:linear-gradient(180deg,rgba(36,31,31,.75) 0%,rgba(36,31,31,.45) 20%,rgba(36,31,31,.15) 34%,rgba(36,31,31,.3) 44%,rgba(36,31,31,.96) 62%,rgba(36,31,31,1) 100%)")
        inner += crown_wm.format("left:620px;top:1300px;width:520px")
        inner += img("logo-white.png", 72, 270, 300)
        inner += f'<div class="abs hl" style="left:72px;top:880px;font-size:82px;color:{WHITE};width:940px">{hook}</div>'
        inner += img("crown-rule-white.png", 72, 1180, 560, "opacity:.75", name="Crown rule")
        inner += f'<div class="abs" style="left:72px;top:1240px;font-size:31px;color:{CREAM};width:900px;line-height:1.45">{sub}</div>'
        inner += btn(72, 1400, 400, 96, 32)
        inner += proof(72, 1520, 22, WHITE, star=24)
    else:
        inner = photo(420, 0, 780, H, "l23.jpg", fx=0.55, fy=0.4)
        inner += f'<div class="abs" style="left:0;top:0;width:430px;height:{H}px;background:{BLACK}"></div>'
        inner += wash("background:linear-gradient(90deg,rgba(36,31,31,1) 0%,rgba(36,31,31,.98) 38%,rgba(36,31,31,.55) 62%,rgba(36,31,31,.05) 100%)")
        inner += crown_wm.format("left:-60px;top:330px;width:380px")
        inner += img("logo-white.png", 48, 36, 220)
        inner += f'<div class="abs hl" style="left:48px;top:150px;font-size:40px;color:{WHITE};width:640px">{hook}</div>'
        inner += f'<div class="abs" style="left:48px;top:318px;font-size:19px;color:{CREAM};width:560px;line-height:1.45">{sub}</div>'
        inner += btn(48, 418, 260, 66, 21)
        inner += proof(48, 520, 15, WHITE, star=17)
        inner += f'<div class="abs lab" style="left:48px;top:568px;font-size:12px;color:{GOLD}">16 De Parys Avenue, Bedford</div>'
    return board(size, ad_name("Longer You Leave It", "Practice", "Editorial Full Bleed", size), inner + grain(), BLACK)


if __name__ == "__main__":
    print(write("mark", CSS, [m1, m2, m3]))
    if "--render" in sys.argv:
        render("mark")
        print("rendered to renders/batch2/")
