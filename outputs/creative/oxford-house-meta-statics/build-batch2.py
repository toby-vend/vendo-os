"""Oxford House: General campaign statics, batch 2 (Denise, no NHS place). 27 Oct 2026.

Usage: python3 build-batch2.py [--render]
  writes denise-1x1.html, denise-9x16.html, denise-landscape.html (3 concepts each);
  --render screenshots them with headless Chrome (port 8774) into renders/batch2/.
Brand: Oxford House guideline (Figma i0YW4eDguLAwoZpLn4WSTX): Josefin Sans + Poppins, Deep Teal washes over real
practice photography, Kana crown bullets. Photos: July 2026 practice shoot in assets/photos/web (gitignored).
Copy: copy-denise.md. Research: research-general.md.
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


# ---------------------------------------------------------------- Oxford House brand (guideline i0YW4eDguLAwoZpLn4WSTX)
DT, OT, LT, BT, GOLD, INK, MIST, WHITE = "#06444B", "#0F717A", "#27A1AC", "#14B1BF", "#BFA15C", "#1E2B2D", "#E4EFF0", "#FFFFFF"
PAPER = "#FBFAF6"
BT_TINT = "#7AD3DB"  # tint of Bright Teal for the italic turn over photo washes

CSS = f"""
@font-face {{ font-family: 'Josefin Sans'; src: url(assets/fonts/JosefinSans.ttf); font-weight: 100 700; font-style: normal; }}
@font-face {{ font-family: 'Josefin Sans'; src: url(assets/fonts/JosefinSans-Italic.ttf); font-weight: 100 700; font-style: italic; }}
@font-face {{ font-family: Poppins; src: url(assets/fonts/Poppins-Light.ttf); font-weight: 300; }}
@font-face {{ font-family: Poppins; src: url(assets/fonts/Poppins-Regular.ttf); font-weight: 400; }}
@font-face {{ font-family: Poppins; src: url(assets/fonts/Poppins-Medium.ttf); font-weight: 500; }}
@font-face {{ font-family: Poppins; src: url(assets/fonts/Poppins-SemiBold.ttf); font-weight: 600; }}
.ab {{ font-family: Poppins, sans-serif; color: {INK}; }}
.hl {{ font-family: 'Josefin Sans'; font-weight: 700; line-height: 1.04; letter-spacing: -.005em; }}
.hl em {{ font-weight: 300; font-style: italic; display: block; }}
.onph {{ text-shadow: 0 2px 18px rgba(0,30,34,.55); }}
.lab {{ font-family: 'Josefin Sans'; font-weight: 600; letter-spacing: .2em; text-transform: uppercase; color: {GOLD}; }}
.num {{ font-family: 'Josefin Sans'; font-weight: 300; line-height: .82; letter-spacing: -.03em; }}
.btn {{ position: absolute; display: flex; align-items: center; justify-content: center; background: {BT}; color: {WHITE};
        font-family: 'Josefin Sans'; font-weight: 700; border-radius: 8px; box-shadow: 0 10px 24px rgba(0,0,0,.18); }}
.proof {{ display: flex; align-items: center; gap: 12px; font-weight: 500; }}
"""


def btn(x, y, w, h, fs, text="Book Appointment"):
    return f'<div class="btn" data-name="Button" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;font-size:{fs}px;padding-top:4px">{text}</div>'


def proof(x, y, fs, color, star=None, w=None, stacked=False):
    star = star or fs + 4
    wd = f"width:{w}px;" if w else ""
    if stacked:
        return (f'<div class="abs" data-name="Google reviews" style="left:{x}px;top:{y}px;font-size:{fs}px;color:{color};font-weight:500;line-height:1.3">'
                f'<div class="row" style="gap:10px">{stars(star, GOLD)}<span>4.8</span></div><div style="margin-top:6px">950+ Google reviews</div></div>')
    return (f'<div class="abs proof" data-name="Google reviews" style="left:{x}px;top:{y}px;font-size:{fs}px;color:{color};{wd}">'
            f'{stars(star, GOLD)}<span>4.8 · 950+ Google reviews</span></div>')


def wash(style):
    return f'<div class="abs" data-name="Overlay (locked)" style="inset:0;{style}"></div>'


# ---------------------------------------------------------------- D1: VT-06 Offer footer
def d1(size):
    W, H = SIZES[size]
    panel_bg = f"background:radial-gradient(120% 90% at 85% 0%, {OT} 0%, {DT} 55%, #043339 100%)"
    hook = "No NHS place?<em style='color:%s'>Here's our price.</em>" % BT
    if size == "1x1":
        ph = photo(0, 0, W, 500, "practice-30.jpg", fx=0.5, fy=0.32, zoom=1.15)
        inner = ph + wash("top:420px;height:80px;background:linear-gradient(to bottom,rgba(6,68,75,0),rgba(6,68,75,.55))")
        inner += f'<div class="abs" data-name="Offer panel" style="left:0;top:500px;width:{W}px;height:580px;{panel_bg}"></div>'
        inner += f'<div class="abs lab" style="left:64px;top:540px;font-size:22px">New patient check-up</div>'
        inner += f'<div class="abs hl" style="left:64px;top:584px;font-size:58px;color:{WHITE};width:600px">{hook}</div>'
        inner += f'<div class="abs num" data-name="Price" style="left:58px;top:726px;font-size:200px;color:{WHITE}">£85</div>'
        inner += f'<div class="abs" style="left:66px;top:912px;font-size:23px;color:{MIST};width:610px;line-height:1.35">Full exam, digital X-rays and your treatment plan</div>'
        inner += f'<div class="abs" style="left:680px;top:552px;width:1px;height:370px;background:rgba(255,255,255,.22)"></div>'
        inner += img("logo-white.png", 742, 556, 250)
        inner += proof(724, 760, 21, WHITE, star=22, stacked=True)
        inner += btn(724, 832, 300, 84, 27)
        inner += f'<div class="abs" style="left:64px;top:968px;width:{W - 128}px;height:1px;background:rgba(255,255,255,.22)"></div>'
        inner += f'<div class="abs row" data-name="Address footer" style="left:0;top:998px;width:{W}px;justify-content:center;gap:12px;font-size:23px;color:{WHITE}">{PIN.format(s=26).replace("currentColor", BT)}Aylesbury Street, Fenny Stratford</div>'
    elif size == "9x16":
        ph = photo(0, 0, W, 930, "practice-30.jpg", fx=0.5, fy=0.35, zoom=1.0)
        inner = ph + wash("top:760px;height:170px;background:linear-gradient(to bottom,rgba(6,68,75,0),rgba(6,68,75,.6))")
        inner += f'<div class="abs" data-name="Offer panel" style="left:0;top:930px;width:{W}px;height:990px;{panel_bg}"></div>'
        inner += img("logo-h-white.png", 690, 980, 320)
        inner += f'<div class="abs lab" style="left:72px;top:992px;font-size:24px">New patient check-up</div>'
        inner += f'<div class="abs hl" style="left:72px;top:1060px;font-size:76px;color:{WHITE};width:900px">{hook}</div>'
        inner += f'<div class="abs num" data-name="Price" style="left:62px;top:1240px;font-size:250px;color:{WHITE}">£85</div>'
        inner += f'<div class="abs" style="left:470px;top:1290px;font-size:30px;color:{MIST};width:520px;line-height:1.35">Full exam, digital X-rays and your treatment plan</div>'
        inner += btn(72, 1478, 380, 92, 31)
        inner += proof(486, 1508, 22, WHITE, star=24)
        inner += f'<div class="abs" style="left:72px;top:1640px;width:{W - 144}px;height:1px;background:rgba(255,255,255,.2)"></div>'
        inner += f'<div class="abs row" data-name="Address footer" style="left:0;top:1672px;width:{W}px;justify-content:center;gap:12px;font-size:26px;color:{WHITE}">{PIN.format(s=28).replace("currentColor", BT)}Aylesbury Street, Fenny Stratford</div>'
    else:
        ph = photo(0, 0, 560, H, "practice-30.jpg", fx=0.42, fy=0.3, zoom=1.05)
        inner = ph + f'<div class="abs" data-name="Offer panel" style="left:560px;top:0;width:640px;height:{H}px;{panel_bg}"></div>'
        inner += img("logo-h-white.png", 604, 40, 250)
        inner += f'<div class="abs lab" style="left:604px;top:128px;font-size:16px">New patient check-up</div>'
        inner += f'<div class="abs hl" style="left:604px;top:160px;font-size:44px;color:{WHITE};width:560px">{hook}</div>'
        inner += f'<div class="abs num" data-name="Price" style="left:598px;top:272px;font-size:150px;color:{WHITE}">£85</div>'
        inner += f'<div class="abs" style="left:850px;top:300px;font-size:20px;color:{MIST};width:320px;line-height:1.35">Full exam, digital X-rays and your treatment plan</div>'
        inner += btn(604, 448, 260, 66, 22)
        inner += proof(884, 470, 15, WHITE, star=17)
        inner += f'<div class="abs row" data-name="Address footer" style="left:604px;top:560px;gap:10px;font-size:18px;color:{WHITE}">{PIN.format(s=20).replace("currentColor", BT)}Aylesbury Street, Fenny Stratford</div>'
    return board(size, ad_name("Price Up Front", "Practice", "Offer Footer", size), inner + grain(), DT)


# ---------------------------------------------------------------- D2: VT-29 Search bar
SEARCH = ('<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="none" stroke="#5f6368" stroke-width="2.4" style="flex:none">'
          '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21" stroke-linecap="round"/></svg>')
MIC = ('<svg viewBox="0 0 24 24" width="{s}" height="{s}" style="flex:none"><rect x="9" y="3" width="6" height="11" rx="3" fill="#4285F4"/>'
       '<path d="M6 11a6 6 0 0 0 12 0" fill="none" stroke="#34A853" stroke-width="2"/><path d="M12 17v4" stroke="#EA4335" stroke-width="2"/></svg>')


def search_ui(x, y, w, s):
    """Search bar + result card. s = scale (1 = 1080 square)."""
    bar_h, r = 92 * s, 46 * s
    out = (f'<div class="abs row" data-name="Search bar" style="left:{x}px;top:{y}px;width:{w}px;height:{bar_h}px;border-radius:{r}px;'
           f'background:{WHITE};padding:0 {34 * s}px;gap:{20 * s}px;box-shadow:0 18px 40px rgba(0,0,0,.28);font-size:{30 * s}px;color:#202124">'
           f'{SEARCH.format(s=int(34 * s))}<span data-name="Query" style="flex:1">dentist taking on new patients near me</span>{MIC.format(s=int(34 * s))}</div>')
    cy = y + bar_h + 22 * s
    out += (f'<div class="abs" data-name="Result card" style="left:{x}px;top:{cy}px;width:{w}px;border-radius:{22 * s}px;background:{WHITE};'
            f'padding:{30 * s}px {36 * s}px;box-shadow:0 22px 48px rgba(0,0,0,.3)">'
            f'<div class="row" style="gap:{18 * s}px"><div data-name="Favicon" style="width:{62 * s}px;height:{62 * s}px;border-radius:50%;background:{MIST};display:flex;align-items:center;justify-content:center;flex:none">'
            f'<img src="assets/mark-house-colour.png" style="width:{46 * s}px"></div>'
            f'<div><div style="font-family:\'Josefin Sans\';font-weight:700;font-size:{33 * s}px;color:#1a0dab;line-height:1.1;padding-top:{4 * s}px">Oxford House Dental Practice</div>'
            f'<div style="font-size:{20 * s}px;color:#5f6368;margin-top:{4 * s}px">Dentist · Fenny Stratford</div></div></div>'
            f'<div class="row" style="gap:{10 * s}px;margin-top:{18 * s}px;font-size:{24 * s}px;color:#202124"><b style="font-weight:600">4.8</b>{stars(int(24 * s), "#FBBC04")}'
            f'<span style="color:#5f6368">(950+ Google reviews)</span></div>'
            f'<div style="font-size:{22 * s}px;color:#5f6368;margin-top:{8 * s}px">Aylesbury Street, Fenny Stratford, MK2 2BA</div></div>')
    return out


def d2(size):
    W, H = SIZES[size]
    hook = "Still searching?<em style='color:%s'>We're taking on new patients.</em>" % BT_TINT
    if size == "1x1":
        inner = photo(0, 0, W, H, "practice-1.jpg", fx=0.5, fy=0.4, zoom=1.08)
        inner += wash(f"background:linear-gradient(180deg,rgba(4,51,57,.9) 0%,rgba(6,68,75,.72) 34%,rgba(6,68,75,.5) 50%,rgba(4,51,57,.88) 100%)")
        inner += img("logo-h-white.png", 64, 60, 300)
        inner += f'<div class="abs hl onph" style="left:64px;top:190px;font-size:64px;color:{WHITE};width:950px">{hook}</div>'
        inner += search_ui(64, 470, 952, 1)
        inner += btn(64, 908, 330, 88, 29)
        inner += f'<div class="abs" style="left:424px;top:916px;font-size:26px;color:{WHITE};line-height:1.3;width:560px"><b style="font-weight:600">New patient check-up £85</b><br>X-rays included</div>'
    elif size == "9x16":
        inner = photo(0, 0, W, H, "practice-1.jpg", fx=0.3, fy=0.6, zoom=1.0)
        inner += wash(f"background:linear-gradient(180deg,rgba(4,51,57,.85) 0%,rgba(6,68,75,.6) 28%,rgba(6,68,75,.2) 52%,rgba(4,51,57,.75) 66%,rgba(4,51,57,.95) 100%)")
        inner += img("logo-h-white.png", 72, 290, 330)
        inner += f'<div class="abs hl onph" style="left:72px;top:420px;font-size:80px;color:{WHITE};width:930px">{hook}</div>'
        inner += search_ui(60, 1060, 960, 1.06)
        inner += f'<div class="abs" style="left:72px;top:1452px;font-size:30px;color:{WHITE};line-height:1.3"><b style="font-weight:600">New patient check-up £85</b> · X-rays included</div>'
        inner += btn(72, 1508, 360, 80, 29)
    else:
        inner = photo(0, 0, W, H, "practice-1.jpg", fx=0.5, fy=0.42)
        inner += wash(f"background:linear-gradient(90deg,rgba(4,51,57,.94) 0%,rgba(6,68,75,.8) 52%,rgba(6,68,75,.25) 100%)")
        inner += img("logo-h-white.png", 48, 36, 230)
        inner += f'<div class="abs hl onph" style="left:48px;top:110px;font-size:42px;color:{WHITE};width:620px">{hook}</div>'
        inner += search_ui(48, 236, 640, 0.68)
        inner += btn(48, 532, 250, 62, 21)
        inner += f'<div class="abs" style="left:318px;top:538px;font-size:19px;color:{WHITE};line-height:1.3"><b style="font-weight:600">New patient check-up £85</b><br>X-rays included</div>'
    return board(size, ad_name("The Search", "Practice", "Search Bar", size), inner + grain(), DT)


# ---------------------------------------------------------------- D3: Custom first-visit sheet
def sheet(x, y, w, h, s, rot=-3):
    items = ["Full examination", "Digital X-rays included", "Your plan, in writing", "Free 30-min chat, no obligation"]
    li = "".join(f'<div class="row" style="gap:{14 * s}px;padding:{13 * s}px 0;border-bottom:1px solid rgba(6,68,75,.14)">'
                 f'<img src="assets/crown-colour.png" style="width:{28 * s}px;flex:none">'
                 f'<span style="font-size:{24 * s}px;font-weight:500;color:{DT};white-space:nowrap">{t}</span></div>' for t in items)
    return (f'<div class="abs" data-name="Shadow" style="left:{x + 18 * s}px;top:{y + 30 * s}px;width:{w}px;height:{h}px;transform:rotate({rot + .6}deg);'
            f'background:rgba(0,0,0,.45);filter:blur({26 * s}px)"></div>'
            f'<div class="abs" data-name="Sheet" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;transform:rotate({rot}deg);background:{PAPER};'
            f'border-radius:{6 * s}px;padding:{46 * s}px {46 * s}px {38 * s}px;overflow:hidden;display:flex;flex-direction:column;'
            f'background-image:linear-gradient(160deg,rgba(255,255,255,.9),rgba(230,226,214,.5))">'
            f'<div style="position:absolute;inset:0;background-image:url(&quot;{GRAIN}&quot;);opacity:.18;mix-blend-mode:multiply"></div>'
            f'<div class="lab" style="font-size:{20 * s}px">Your first visit</div>'
            f'<div class="row" style="align-items:flex-end;gap:{18 * s}px;margin-top:{14 * s}px">'
            f'<div class="num" style="font-size:{150 * s}px;color:{DT}">£85</div>'
            f'<div style="font-size:{21 * s}px;color:{OT};padding-bottom:{8 * s}px;line-height:1.3">new patient<br>check-up</div></div>'
            f'<img src="assets/crown-rule-colour.png" style="width:100%;margin:{24 * s}px 0 {4 * s}px;opacity:.9">'
            f'{li}'
            f'<img src="assets/logo-h-colour.png" style="margin-top:auto;width:{220 * s}px"></div>')


def d3(size):
    W, H = SIZES[size]
    hook = "Private,<em style='color:%s'>without the pressure.</em>" % BT_TINT
    if size == "1x1":
        inner = photo(0, 0, W, H, "practice-12.jpg", fx=0.45, fy=0.5, zoom=1.1)
        inner += wash(f"background:linear-gradient(115deg,rgba(4,51,57,.93) 0%,rgba(6,68,75,.78) 45%,rgba(6,68,75,.45) 100%)")
        inner += f'<div class="abs hl onph" style="left:64px;top:84px;font-size:76px;color:{WHITE};width:950px">{hook}</div>'
        inner += sheet(470, 300, 540, 690, 0.98)
        inner += proof(64, 720, 22, WHITE, star=24, stacked=True)
        inner += btn(64, 830, 330, 88, 29)
        inner += f'<div class="abs" style="left:64px;top:300px;width:360px;font-size:26px;line-height:1.45;color:{MIST}">Know the price before you sit down. Then talk it through, and decide.</div>'
    elif size == "9x16":
        inner = photo(0, 0, W, H, "practice-12.jpg", fx=0.45, fy=0.5)
        inner += wash(f"background:linear-gradient(180deg,rgba(4,51,57,.92) 0%,rgba(6,68,75,.7) 50%,rgba(4,51,57,.9) 100%)")
        inner += f'<div class="abs hl" style="left:72px;top:290px;font-size:92px;color:{WHITE};width:940px">{hook}</div>'
        inner += sheet(150, 560, 780, 860, 1.32, rot=-2.5)
        inner += btn(72, 1478, 400, 96, 33)
        inner += proof(500, 1512, 22, WHITE, star=25)
    else:
        inner = photo(0, 0, W, H, "practice-12.jpg", fx=0.4, fy=0.5)
        inner += wash(f"background:linear-gradient(100deg,rgba(4,51,57,.94) 0%,rgba(6,68,75,.75) 50%,rgba(6,68,75,.4) 100%)")
        inner += f'<div class="abs hl" style="left:52px;top:60px;font-size:56px;color:{WHITE};width:560px">{hook}</div>'
        inner += f'<div class="abs" style="left:52px;top:244px;width:520px;font-size:21px;line-height:1.45;color:{MIST}">Know the price before you sit down. Then talk it through, and decide.</div>'
        inner += proof(52, 400, 16, WHITE, star=18)
        inner += btn(52, 456, 270, 70, 23)
        inner += sheet(680, 30, 480, 568, 0.8)
    return board(size, ad_name("Without The Pressure", "Practice", "First Visit Sheet", size), inner + grain(), DT)


if __name__ == "__main__":
    print(write("denise", CSS, [d1, d2, d3]))
    if "--render" in sys.argv:
        render("denise")
        print("rendered to renders/batch2/")
