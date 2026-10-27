"""Build Legacy Smile Meta static harness pages (one HTML page per persona per size).

Usage: python3 build.py   -> writes mark-1x1.html, mark-9x16.html, mark-landscape.html

Brand: LEGACY SMILE BRAND GUIDELINES.pdf (Drive 1fo6dGvDHDInrWjztuNhTMNIwAe4EHi89).
Fonts: ES Serif (headings, from the live site's embedded webfont; no £ glyph, falls back to Georgia),
Montserrat (body), Caveat (handwritten note only). Photos: August 2026 shoot (assets/photos, gitignored).
"""
import struct
from pathlib import Path

ROOT = Path(__file__).parent
A = ROOT / "assets"

C = dict(navy="#2B3A4C", deep="#1F2B3A", mag="#A81F64", turq="#65C5B7", gold="#BB9763",
         stone="#EDE5DA", paper="#F6F1E9", ink="#1B2430")

GRAIN = ("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>"
         "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.9 0'/></filter>"
         "<rect width='100%' height='100%' filter='url(%23n)'/></svg>")

# Houndstooth tile (4x4 units): dark check plus the diagonal teeth in the two mixed quadrants.
HT_PATH = "M0 0H2V2H0Z M2 0H3L2 1Z M4 0V1L3 2H2Z M0 2H1L0 3Z M2 2V3L1 4H0Z"

CSS = f"""
@font-face {{ font-family: ESSerif; src: url(assets/fonts/ESSerif-Regular.woff2); font-weight: 400; }}
@font-face {{ font-family: Montserrat; src: url(assets/fonts/Montserrat.ttf); font-weight: 100 900; }}
@font-face {{ font-family: Caveat; src: url(assets/fonts/Caveat-SemiBold.woff2); font-weight: 600; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ background: #2a2a2a; font-family: Montserrat, sans-serif; display: flex; gap: 80px; padding: 80px; align-items: flex-start; }}
.ab {{ position: relative; overflow: hidden; flex: none; color: {C['stone']}; }}
.s1 {{ width: 1080px; height: 1080px; }}
.s9 {{ width: 1080px; height: 1920px; }}
.sl {{ width: 1200px; height: 628px; }}
.abs {{ position: absolute; }}
.cover {{ position: absolute; inset: 0; }}
.grain {{ position: absolute; inset: 0; background-image: url("{GRAIN}"); opacity: .14; mix-blend-mode: overlay; pointer-events: none; }}
.serif {{ font-family: ESSerif, Georgia, serif; font-weight: 400; letter-spacing: -.005em; }}
.hl {{ font-family: ESSerif, Georgia, serif; font-weight: 400; line-height: 1.02; letter-spacing: -.01em; }}
.eyebrow {{ font-weight: 600; letter-spacing: .2em; text-transform: uppercase; }}
.body {{ font-weight: 400; line-height: 1.42; }}
.cta {{ display: inline-flex; align-items: center; gap: 14px; border-radius: 999px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; background: {C['mag']}; color: {C['stone']}; box-shadow: 0 10px 24px rgba(20,10,20,.28); }}
.cta svg {{ display: block; }}
.hand {{ font-family: Caveat, cursive; font-weight: 600; color: {C['navy']}; line-height: 1.05; }}
.chip {{ display: inline-flex; align-items: center; border: 2px solid rgba(187,151,99,.75); border-radius: 6px; color: {C['stone']}; font-weight: 500; }}
.logo {{ display: block; height: auto; }}
"""

ARROW = '<svg width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
GOOGLE_G = ('<svg width="{s}" height="{s}" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.2C12.5 13.6 17.8 9.5 24 9.5z"/>'
            '<path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17z"/>'
            '<path fill="#FBBC05" d="M10.6 28.5c-.5-1.4-.8-2.9-.8-4.5s.3-3.1.8-4.5l-7.9-6.2C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.2z"/>'
            '<path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.2-13.4-9.9l-7.9 6.2C6.6 42.6 14.6 48 24 48z"/></svg>')
TICK = '<svg width="{s}" height="{s}" viewBox="0 0 40 40" fill="none" stroke="{c}" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 21c4 3 7 7 9 11C19 21 26 12 35 6"/></svg>'

POUND = '<span style="font-family:Georgia,serif;font-size:.86em">£</span>'


def photo_size(img):
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
            return w, h
        i += 2 + seg_len
    raise ValueError(f"no size found in {img}")


def photo(x, y, w, h, img, fx=0.5, fy=0.5, zoom=1.0, style="", name="Photo"):
    """Photo cover-cropped into a box from its real aspect (never stretched). fx/fy = focal point 0..1."""
    pw, ph = photo_size(img)
    a = pw / ph
    if w / h > a:
        bw, bh = w, w / a
    else:
        bw, bh = h * a, h
    bw, bh = bw * zoom, bh * zoom
    ox = -(bw - w) * fx
    oy = -(bh - h) * fy
    return (f'<div class="abs" data-name="{name}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;'
            f'background-image:url(assets/photos/{img});background-size:{bw:.0f}px {bh:.0f}px;'
            f'background-position:{ox:.0f}px {oy:.0f}px;{style}"></div>')


def ht(x, y, w, h, fg, bg="transparent", unit=10, opacity=1.0, name="Houndstooth"):
    """Houndstooth band. unit = px per tile unit (tile is 4 units)."""
    pid = f"ht{x}{y}{w}{h}".replace("-", "m")
    t = unit * 4
    return (f'<svg class="abs" data-name="{name}" style="left:{x}px;top:{y}px;opacity:{opacity}" width="{w}" height="{h}" shape-rendering="crispEdges">'
            f'<defs><pattern id="{pid}" width="{t}" height="{t}" patternUnits="userSpaceOnUse">'
            f'<g transform="scale({unit})"><path fill="{fg}" d="{HT_PATH}"/></g></pattern></defs>'
            f'<rect width="{w}" height="{h}" fill="{bg}"/><rect width="{w}" height="{h}" fill="url(#{pid})"/></svg>')


def logo(x, y, w, colour="stone"):
    return f'<img class="abs logo" data-name="Logo" src="assets/logo-{colour}.png" style="left:{x}px;top:{y}px;width:{w}px">'


def cta(label, size=24, h=80, pad=44):
    return (f'<span class="cta" data-name="Button" style="height:{h}px;padding:0 {pad}px;font-size:{size}px">'
            f'{label}{ARROW.format(s=int(size * 1.1))}</span>')


def proof(colour, size=22):
    return (f'<div data-name="Google reviews" style="display:flex;align-items:center;gap:12px;color:{colour};font-size:{size}px;font-weight:500;letter-spacing:.02em">'
            f'<span style="display:flex;width:{size + 14}px;height:{size + 14}px;border-radius:50%;background:#fff;align-items:center;justify-content:center">{GOOGLE_G.format(s=size)}</span>'
            f'Over 300 Google reviews</div>')


def page(title, boards):
    return (f"<!doctype html><html lang='en-GB'><head><meta charset='utf-8'><title>{title}</title>"
            f"<style>{CSS}</style><script src='https://mcp.figma.com/mcp/html-to-design/capture.js' async></script></head>"
            f"<body>{''.join(boards)}</body></html>")


DIM = {"s1": (1080, 1080), "s9": (1080, 1920), "sl": (1200, 628)}
TAG = {"s1": "1x1", "s9": "9x16", "sl": "1.91x1"}


# ---------------------------------------------------------------- M1 New name, clean slate (custom)
def m1(s):
    W, H = DIM[s]
    nm = f"Fresh Start | Static | Practice | Plaque | {TAG[s]} | 261027"
    b = [f'<div class="ab {s}" id="M1-{s}" data-name="{nm}" style="background:{C["navy"]}">']
    if s == "s1":
        b.append(photo(500, 0, 580, 1080, "plaque-tall.jpg", fx=0.6, fy=0.3, zoom=1.06))
        b.append(f'<div class="abs" data-name="Overlay (locked)" style="left:500px;top:0;width:580px;height:1080px;background:linear-gradient(90deg,rgba(31,43,58,.55) 0%,rgba(31,43,58,0) 22%),linear-gradient(0deg,rgba(31,43,58,.55) 0%,rgba(31,43,58,0) 35%)"></div>')
        b.append(f'<div class="abs" style="left:0;top:0;width:520px;height:1080px;background:radial-gradient(circle at 30% 20%,#34465b 0%,{C["navy"]} 55%,{C["deep"]} 100%)"></div>')
        b.append(ht(0, 0, 44, 1080, C["gold"], unit=8, opacity=.55))
        b.append(f'<div class="abs eyebrow" style="left:96px;top:96px;font-size:18px;color:{C["gold"]}">Formerly Widcombe Dental</div>')
        b.append(f'<div class="abs hl" style="left:92px;top:150px;width:400px;font-size:76px;color:{C["stone"]}">New name over the door.<br><span style="display:inline-block;margin-top:26px;color:{C["gold"]}">A clean slate for you.</span></div>')
        b.append(f'<div class="abs body" style="left:96px;top:600px;width:370px;font-size:25px;color:rgba(237,229,218,.88)">Been years since your last check-up? Start again here as a new patient.</div>')
        b.append(f'<div class="abs" style="left:96px;top:790px;color:{C["stone"]}"><div class="eyebrow" style="font-size:15px;color:{C["gold"]}">New patient exam</div><div class="serif" style="font-size:84px;line-height:1">{POUND}110</div></div>')
        b.append(f'<div class="abs" style="left:96px;top:950px">{cta("Book online", 20, 66, 34)}</div>')
        b.append(f'<div class="abs" style="left:560px;top:990px">{proof(C["stone"], 20)}</div>')
    elif s == "s9":
        b.append(photo(0, 0, 1080, 1060, "plaque-tall.jpg", fx=0.8, fy=0.16, zoom=1.18))
        b.append(f'<div class="abs" data-name="Overlay (locked)" style="left:0;top:700px;width:1080px;height:360px;background:linear-gradient(180deg,rgba(43,58,76,0) 0%,{C["navy"]} 100%)"></div>')
        b.append(f'<div class="abs" style="left:0;top:1060px;width:1080px;height:860px;background:radial-gradient(circle at 20% 10%,#34465b 0%,{C["navy"]} 50%,{C["deep"]} 100%)"></div>')
        b.append(ht(0, 1040, 1080, 40, C["gold"], unit=10, opacity=.55))
        b.append(f'<div class="abs eyebrow" style="left:90px;top:1130px;font-size:20px;color:{C["gold"]}">Formerly Widcombe Dental</div>')
        b.append(f'<div class="abs hl" style="left:86px;top:1180px;width:920px;font-size:92px;color:{C["stone"]}">New name over the door.<br><span style="color:{C["gold"]}">A clean slate for you.</span></div>')
        b.append(f'<div class="abs body" style="left:90px;top:1400px;width:560px;font-size:30px;color:rgba(237,229,218,.88)">Been years since your last check-up? Start again here as a new patient.</div>')
        b.append(f'<div class="abs" style="left:700px;top:1392px;color:{C["stone"]}"><div class="eyebrow" style="font-size:16px;color:{C["gold"]}">New patient exam</div><div class="serif" style="font-size:96px;line-height:1">{POUND}110</div></div>')
        b.append(f'<div class="abs" style="left:90px;top:1530px">{cta("Book online", 22, 76, 40)}</div>')
        b.append(f'<div class="abs" style="left:520px;top:1552px">{proof(C["stone"], 22)}</div>')
    else:
        b.append(photo(600, 0, 600, 628, "plaque-wide.jpg", fx=0.55, fy=0.4))
        b.append(f'<div class="abs" style="left:0;top:0;width:620px;height:628px;background:radial-gradient(circle at 30% 20%,#34465b 0%,{C["navy"]} 55%,{C["deep"]} 100%)"></div>')
        b.append(ht(0, 0, 30, 628, C["gold"], unit=6, opacity=.55))
        b.append(f'<div class="abs eyebrow" style="left:70px;top:56px;font-size:13px;color:{C["gold"]}">Formerly Widcombe Dental</div>')
        b.append(f'<div class="abs hl" style="left:68px;top:92px;width:520px;font-size:50px;color:{C["stone"]}">New name over the door.<br><span style="color:{C["gold"]}">A clean slate for you.</span></div>')
        b.append(f'<div class="abs body" style="left:70px;top:236px;width:460px;font-size:19px;color:rgba(237,229,218,.88)">Been years since your last check-up? Start again here as a new patient.</div>')
        b.append(f'<div class="abs" style="left:70px;top:340px;color:{C["stone"]}"><div class="eyebrow" style="font-size:12px;color:{C["gold"]}">New patient exam</div><div class="serif" style="font-size:64px;line-height:1">{POUND}110</div></div>')
        b.append(f'<div class="abs" style="left:70px;top:470px">{cta("Book online", 16, 54, 28)}</div>')
        b.append(f'<div class="abs" style="left:70px;top:548px">{proof(C["stone"], 16)}</div>')
    b.append('<div class="grain" data-name="Grain (locked)"></div></div>')
    return "".join(b)


# ---------------------------------------------------------------- M2 No telling off (VT-31 handwritten sign)
def note(w, scale=1.0, rot=-2.2):
    f = scale
    ticks = ["No telling off", "Options at different prices", "You choose what's next"]
    rows = "".join(
        f'<div style="display:flex;align-items:center;gap:{18 * f:.0f}px;margin-top:{14 * f:.0f}px">{TICK.format(s=int(46 * f), c=C["mag"])}'
        f'<span class="hand" style="font-size:{50 * f:.0f}px">{t}</span></div>' for t in ticks)
    underline = (f'<svg width="{430 * f:.0f}" height="{22 * f:.0f}" viewBox="0 0 430 22" style="display:block;margin:{4 * f:.0f}px 0 {14 * f:.0f}px -6px">'
                 f'<path d="M4 14C90 6 220 4 424 10" stroke="{C["mag"]}" stroke-width="6" fill="none" stroke-linecap="round" opacity=".85"/></svg>')
    return (f'<div data-name="Sign" style="position:relative;width:{w}px;padding:{64 * f:.0f}px {60 * f:.0f}px {58 * f:.0f}px;background:{C["paper"]};'
            f'transform:rotate({rot}deg);border-radius:4px;box-shadow:0 {40 * f:.0f}px {70 * f:.0f}px rgba(10,14,20,.5),0 {8 * f:.0f}px {16 * f:.0f}px rgba(10,14,20,.35)">'
            f'<div class="abs" style="inset:0;background-image:url(&quot;{GRAIN}&quot;);opacity:.22;mix-blend-mode:multiply;border-radius:4px"></div>'
            f'<div class="abs" data-name="Tape" style="left:50%;top:{-22 * f:.0f}px;width:{190 * f:.0f}px;height:{50 * f:.0f}px;margin-left:{-95 * f:.0f}px;background:rgba(187,151,99,.55);transform:rotate(3deg);box-shadow:0 2px 6px rgba(0,0,0,.12)"></div>'
            f'<div class="hand" style="position:relative;font-size:{84 * f:.0f}px">Haven\'t been<br>in years?</div>{underline}'
            f'<div style="position:relative">{rows}</div></div>')


def m2(s):
    nm = f"No Telling Off | Static | Practice | Handwritten Note | {TAG[s]} | 261027"
    b = [f'<div class="ab {s}" id="M2-{s}" data-name="{nm}" style="background:{C["deep"]}">']
    if s == "s1":
        b.append(photo(-30, -30, 1140, 1140, "waiting.jpg", fx=0.62, fy=0.5, style="filter:blur(7px) saturate(.9)"))
        b.append(f'<div class="cover" data-name="Overlay (locked)" style="background:linear-gradient(180deg,rgba(31,43,58,.35) 0%,rgba(31,43,58,.25) 45%,rgba(31,43,58,.92) 78%,{C["deep"]} 100%)"></div>')
        b.append(ht(1036, 0, 44, 1080, C["gold"], unit=8, opacity=.5))
        b.append(f'<div class="abs" style="left:110px;top:110px">{note(720, 1.0)}</div>')
        b.append(f'<div class="abs" style="left:90px;top:828px;color:{C["stone"]}"><span class="eyebrow" style="font-size:16px;color:{C["gold"]}">New patient exam</span> <span class="serif" style="font-size:58px;margin-left:12px;vertical-align:-6px">{POUND}110</span></div>')
        b.append(f'<div class="abs" style="left:90px;top:930px">{cta("Book online", 20, 66, 34)}</div>')
        b.append(f'<div class="abs" style="left:400px;top:952px">{proof(C["stone"], 20)}</div>')
        b.append(logo(800, 860, 190))
    elif s == "s9":
        b.append(photo(-30, -30, 1140, 1980, "waiting.jpg", fx=0.6, fy=0.5, style="filter:blur(8px) saturate(.9)"))
        b.append(f'<div class="cover" data-name="Overlay (locked)" style="background:linear-gradient(180deg,rgba(31,43,58,.45) 0%,rgba(31,43,58,.25) 30%,rgba(31,43,58,.35) 60%,rgba(31,43,58,.92) 75%,{C["deep"]} 100%)"></div>')
        b.append(ht(1036, 0, 44, 1920, C["gold"], unit=8, opacity=.5))
        b.append(logo(90, 280, 210))
        b.append(f'<div class="abs" style="left:70px;top:520px">{note(950, 1.28)}</div>')
        b.append(f'<div class="abs" style="left:90px;top:1350px;color:{C["stone"]}"><span class="eyebrow" style="font-size:18px;color:{C["gold"]}">New patient exam</span> <span class="serif" style="font-size:70px;margin-left:14px;vertical-align:-8px">{POUND}110</span></div>')
        b.append(f'<div class="abs" style="left:90px;top:1470px">{cta("Book online", 22, 76, 40)}</div>')
        b.append(f'<div class="abs" style="left:450px;top:1494px">{proof(C["stone"], 22)}</div>')
    else:
        b.append(photo(-30, -30, 1260, 688, "waiting.jpg", fx=0.6, fy=0.5, style="filter:blur(6px) saturate(.9)"))
        b.append(f'<div class="cover" data-name="Overlay (locked)" style="background:linear-gradient(90deg,{C["deep"]} 0%,rgba(31,43,58,.9) 38%,rgba(31,43,58,.3) 62%,rgba(31,43,58,.2) 100%)"></div>')
        b.append(logo(64, 52, 150))
        b.append(f'<div class="abs hl" style="left:64px;top:190px;width:470px;font-size:42px;color:{C["stone"]}">Your first visit back,<br><span style="color:{C["gold"]}">without the lecture.</span></div>')
        b.append(f'<div class="abs" style="left:64px;top:330px;color:{C["stone"]}"><span class="eyebrow" style="font-size:12px;color:{C["gold"]}">New patient exam</span> <span class="serif" style="font-size:46px;margin-left:8px;vertical-align:-5px">{POUND}110</span></div>')
        b.append(f'<div class="abs" style="left:64px;top:418px">{cta("Book online", 16, 54, 28)}</div>')
        b.append(f'<div class="abs" style="left:64px;top:500px">{proof(C["stone"], 16)}</div>')
        b.append(f'<div class="abs" style="left:640px;top:70px">{note(500, 0.68, rot=2.0)}</div>')
    b.append('<div class="grain" data-name="Grain (locked)"></div></div>')
    return "".join(b)


# ---------------------------------------------------------------- M3 Your new dentist in Bath (VT-03 brand card)
def card(w, f=1.0, chips_wrap=False):
    chips = ["Full exam with a dentist", "Your options, explained", "In Widcombe since 1978"]
    chip_html = "".join(f'<span class="chip" style="height:{50 * f:.0f}px;padding:0 {18 * f:.0f}px;font-size:{19 * f:.0f}px">{c}</span>' for c in chips)
    return (f'<div data-name="Card" style="position:relative;width:{w}px;background:{C["navy"]};border-radius:0 18px 18px 18px;padding:{50 * f:.0f}px {52 * f:.0f}px {46 * f:.0f}px;'
            f'box-shadow:0 30px 70px rgba(10,14,20,.45)">'
            f'<div data-name="Card tab" style="position:absolute;left:0;top:{-86 * f:.0f}px;height:{88 * f:.0f}px;padding:{16 * f:.0f}px {34 * f:.0f}px 0;background:{C["navy"]};border-radius:18px 18px 0 0">'
            f'<img class="logo" src="assets/logo-stone.png" style="width:{120 * f:.0f}px"></div>'
            f'<div class="eyebrow" style="font-size:{16 * f:.0f}px;color:{C["gold"]}">Been a while? Start here.</div>'
            f'<div class="hl" style="margin-top:{16 * f:.0f}px;font-size:{62 * f:.0f}px;color:{C["stone"]}">Your new dentist in <span style="color:{C["gold"]}">Bath</span></div>'
            f'<div style="margin-top:{18 * f:.0f}px;font-size:{24 * f:.0f}px;color:rgba(237,229,218,.9)">New patient exam <span class="serif" style="font-size:{40 * f:.0f}px;color:{C["stone"]};margin-left:6px">{POUND}110</span></div>'
            f'<div style="display:flex;flex-wrap:wrap;gap:{12 * f:.0f}px;margin-top:{22 * f:.0f}px">{chip_html}</div>'
            f'<div style="display:flex;align-items:center;gap:{28 * f:.0f}px;margin-top:{30 * f:.0f}px">{cta("Book online", round(20 * f), round(66 * f), round(34 * f))}{proof(C["stone"], round(19 * f))}</div>'
            f'{ht(w - int(150 * f), 0, int(150 * f), int(26 * f), C["gold"], unit=max(4, int(5 * f)), opacity=.45)}'
            f'</div>')


def m3(s):
    nm = f"New Dentist Bath | Static | Clinician | Brand Card | {TAG[s]} | 261027"
    b = [f'<div class="ab {s}" id="M3-{s}" data-name="{nm}" style="background:{C["navy"]}">']
    if s == "s1":
        b.append(photo(0, 0, 1080, 1080, "dentist.jpg", fx=0.5, fy=0.42, zoom=1.0))
        b.append(f'<div class="cover" data-name="Overlay (locked)" style="background:linear-gradient(180deg,rgba(31,43,58,0) 40%,rgba(31,43,58,.45) 100%)"></div>')
        b.append(f'<div class="abs" style="left:60px;top:556px">{card(960, 0.92)}</div>')
    elif s == "s9":
        b.append(photo(0, 0, 1080, 1920, "dentist.jpg", fx=0.5, fy=0.1, zoom=1.0))
        b.append(f'<div class="cover" data-name="Overlay (locked)" style="background:linear-gradient(180deg,rgba(31,43,58,0) 45%,rgba(31,43,58,.5) 100%)"></div>')
        b.append(f'<div class="abs" style="left:60px;top:1010px">{card(960, 1.0)}</div>')
    else:
        b.append(photo(600, 0, 600, 628, "dentist.jpg", fx=0.5, fy=0.2))
        b.append(f'<div class="abs" style="left:0;top:0;width:760px;height:628px;background:linear-gradient(90deg,{C["deep"]} 0%,{C["deep"]} 76%,rgba(31,43,58,0) 100%)"></div>')
        b.append(f'<div class="abs" style="left:36px;top:200px">{card(700, 0.68)}</div>')
    b.append('<div class="grain" data-name="Grain (locked)"></div></div>')
    return "".join(b)


if __name__ == "__main__":
    for key, suffix in (("s1", "1x1"), ("s9", "9x16"), ("sl", "landscape")):
        html = page(f"Mark | {suffix}", [m1(key), m2(key), m3(key)])
        (ROOT / f"mark-{suffix}.html").write_text(html)
        print("wrote", f"mark-{suffix}.html")
