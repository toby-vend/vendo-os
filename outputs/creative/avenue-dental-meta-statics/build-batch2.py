"""Avenue Dental Meta statics, batch 2 (27 Oct 2026): Emma (General), Linda (Missing Teeth), Hannah (Smile Makeover).

Usage: .venv/bin/python build-batch2.py [persona ...]  ->  <persona>-1x1.html, <persona>-9x16.html, <persona>-landscape.html
Harness copied from build.py (batch 1, left untouched): same palette, fonts, logo, crop/photo/lit/board/page helpers.
Layouts: VT codes from data/creative-templates/vendo-dental-statics not used in batch 1, plus one custom per persona.
Copy: copy-emma.md, copy-linda.md, copy-hannah.md. Research: research-batch2.md.
Photos: Avenue's own Drive (Content Assets) only, no stock; originals in assets/photos/drive, working copies av2-* in
assets/photos/web (both gitignored). Sources in assets/photos/stock/SOURCES-batch2.txt.
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent
A = ROOT / "assets"
WEB = A / "photos/web"

GOLD, SAND, BLUSH, BLACK, WHITE = "#A88C61", "#C49C60", "#EDE2CF", "#1B1B1B", "#FFFFFF"
INK, SOFT, PANEL, LINE = "#1B1B1B", "#D9D4CC", "#242322", "#3A3733"
SIZES = {"s1": (1080, 1080), "s9": (1080, 1920), "ls": (1200, 628)}
SUFFIX = {"s1": "1x1", "s9": "9x16", "ls": "1.91x1"}
DATE = "261027"


def svg_file(name, width, extra=""):
    s = (A / name).read_text()
    s = re.sub(r'<svg width="\d+" height="\d+"', f'<svg width="{width}" height="{round(width * 104 / 136)}" style="display:block;{extra}"', s, count=1)
    return s


def logo(w, kind="reverse"):
    return svg_file({"reverse": "logo-reverse.svg", "primary": "logo-primary.svg"}[kind], w)


def mono(w, extra=""):
    return svg_file("monogram-gold.svg", w, extra)


GRAIN = ("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>"
         "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.9 0'/></filter>"
         "<rect width='100%' height='100%' filter='url(%23n)'/></svg>")

CSS = f"""
@font-face {{ font-family: Jost; src: url(assets/fonts/Jost.ttf); font-weight: 100 900; }}
@font-face {{ font-family: Lexend; src: url(assets/fonts/Lexend.ttf); font-weight: 100 900; }}
@font-face {{ font-family: Caveat; src: url(assets/fonts/Caveat.ttf); font-weight: 400 700; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ background: #3a3733; font-family: Lexend, sans-serif; font-weight: 300; display: flex; gap: 80px; padding: 80px; align-items: flex-start; -webkit-font-smoothing: antialiased; }}
.ab {{ position: relative; overflow: hidden; flex: none; background: {BLACK}; color: {WHITE}; }}
.abs {{ position: absolute; }}
.ph {{ position: absolute; overflow: hidden; }}
.ph img {{ display: block; width: 100%; height: 100%; }}
.grain {{ position: absolute; inset: 0; background-image: url("{GRAIN}"); opacity: .10; mix-blend-mode: overlay; pointer-events: none; }}
.hl {{ font-family: Jost, sans-serif; font-weight: 500; line-height: 1.06; letter-spacing: -.01em; }}
.hl b {{ font-weight: 500; color: {GOLD}; }}
.body {{ font-family: Lexend, sans-serif; font-weight: 300; line-height: 1.45; color: {SOFT}; }}
.label {{ font-family: Jost, sans-serif; font-weight: 500; letter-spacing: .26em; text-transform: uppercase; }}
.eyebrow {{ display: flex; align-items: center; gap: .7em; font-family: Jost, sans-serif; font-weight: 500; }}
.eyebrow:before {{ content: ''; width: 2.2em; height: 2px; background: {GOLD}; }}
.cta {{ display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; font-family: Jost, sans-serif; font-weight: 600; white-space: nowrap; background: linear-gradient(180deg, #D3B67F 0%, {GOLD} 52%, #8C7149 100%); color: {BLACK}; box-shadow: inset 0 2px 0 rgba(255,240,212,.55), inset 0 -2px 0 rgba(60,44,20,.35), 0 12px 28px rgba(0,0,0,.4); }}
.glow {{ text-shadow: 0 0 46px rgba(196,156,96,.45); }}
.rule {{ height: 1.5px; background: {GOLD}; opacity: .7; }}
"""

STAR = '<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="{c}" style="display:block"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>'
PIN = '<svg viewBox="0 0 24 24" width="{s}" height="{s}" style="display:block;flex:none"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2z" fill="currentColor"/></svg>'
CTA_FREE = "Book a free consultation"
CTA_BOOK = "Book your appointment"


def proof(size=22, color=WHITE, star=GOLD, text="4.9 from 227 Google reviews"):
    stars = "".join(STAR.format(s=round(size * 1.05), c=star) for _ in range(5))
    return (f'<div style="display:flex;align-items:center;gap:{size * .55}px;color:{color};font-family:Lexend;font-weight:300;font-size:{size}px;white-space:nowrap">'
            f'<span style="display:flex;gap:2px">{stars}</span>{text}</div>')


def cta(text, size=24, h=None, dark=False):
    h = h or round(size * 3)
    col = f"background:{BLACK};color:{WHITE};" if dark else ""
    return f'<span class="cta" style="height:{h}px;padding:0 {round(size * 1.8)}px;font-size:{size}px;{col}">{text}</span>'


def crop(src, w, h, fx=.5, fy=.5, zoom=1.0):
    """Cover-crop from the real image aspect into a pre-cut file (the Figma capture ignores object-position)."""
    w, h = round(w), round(h)
    out = WEB / "crops" / f"{Path(src).stem}-{w}x{h}-{round(fx * 100)}-{round(fy * 100)}-{round(zoom * 100)}.jpg"
    if not out.exists():
        out.parent.mkdir(exist_ok=True)
        dims = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries", "stream=width,height",
                               "-of", "csv=p=0", str(WEB / src)], capture_output=True, text=True).stdout.strip()
        W, H = map(int, dims.split(","))
        if W / H > w / h:
            ch, cw = H, round(H * w / h)
        else:
            cw, ch = W, round(W * h / w)
        cw, ch = round(cw / zoom), round(ch / zoom)
        x = min(max(round(fx * W - cw / 2), 0), W - cw)
        y = min(max(round(fy * H - ch / 2), 0), H - ch)
        ow = min(cw, 2 * w) // 2 * 2
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(WEB / src), "-vf",
                        f"crop={cw}:{ch}:{x}:{y},scale={ow}:-2", "-q:v", "3", str(out)], check=True)
    return f"assets/photos/web/crops/{out.name}"


def photo(src, x, y, w, h, fx=.5, fy=.5, zoom=1.0, corner=None, r=None, extra=""):
    """A photo frame. corner = tl/tr/bl/br gives the guideline's single rounded 'leaf' corner."""
    rad = ""
    if corner:
        r = r or round(min(w, h) * .16)
        rad = "border-radius:" + {"tr": f"0 {r}px 0 0", "tl": f"{r}px 0 0 0", "br": f"0 0 {r}px 0", "bl": f"0 0 0 {r}px"}[corner] + ";"
    return (f'<div class="ph" data-name="Photo" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;{rad}{extra}">'
            f'<img src="{crop(src, w, h, fx, fy, zoom)}"></div>')


def wash(direction="90deg", a=.96, b=0, stop=60, extra=""):
    return (f'<div class="abs" data-name="Overlay" style="inset:0;{extra}background:linear-gradient({direction},'
            f'rgba(27,27,27,{a}) 0%,rgba(27,27,27,{(a + b) / 2:.2f}) {stop * .6:.0f}%,rgba(27,27,27,{b}) {stop}%)"></div>')


def lit(size, light=False):
    """Board background: the brand black (or blush) lit like a room, from depth.panel."""
    import depth
    w, h = SIZES[size]
    m = max(w, h)
    glows = [(w * .3, h * .24, m * .3, .17), (w * .68, h * .72, m * .36, .08)]
    if light:
        return f"{BLUSH} url({depth.panel(w, h, glows, key='bg-blush', ink=BLUSH, tone='#7A6447', light='#FFF8EE', vignette=.13)}) center/cover"
    return f"{BLACK} url({depth.panel(w, h, glows, key='bg-dark')}) center/cover"


def board(size, name, inner, bg=BLACK):
    w, h = SIZES[size]
    if bg in (BLACK, BLUSH):
        bg = lit(size, bg == BLUSH)
    return (f'<div class="ab" data-name="{name} | {SUFFIX[size]} | {DATE}" style="width:{w}px;height:{h}px;background:{bg}">'
            f'{inner}<div class="grain"></div></div>')


def page(title, boards):
    return (f"<!doctype html><html lang='en-GB'><head><meta charset='utf-8'><title>{title}</title>"
            f"<style>{CSS}</style><script src='https://mcp.figma.com/mcp/html-to-design/capture.js' async></script>"
            f"</head><body>{''.join(boards)}</body></html>")


TICK = '<svg viewBox="0 0 24 24" width="{s}" height="{s}" style="display:block;flex:none" fill="none" stroke="{c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.2 4.2L19 7"/></svg>'


def ticks(items, size=24, gap=14, color=WHITE, tick=GOLD):
    return "".join(f'<div style="display:flex;align-items:center;gap:{size * .6:.0f}px;margin-top:{gap if i else 0}px;font-family:Lexend;font-weight:300;font-size:{size}px;color:{color}">'
                   f'{TICK.format(s=round(size * 1.1), c=tick)}{t}</div>' for i, t in enumerate(items))


def address(size=18, color=SOFT):
    return f'<div style="display:flex;align-items:center;gap:{size * .5:.0f}px;font-family:Lexend;font-weight:300;font-size:{size}px;color:{color}">{PIN.format(s=round(size * 1.2))}2 Lime Avenue, Leamington Spa, CV32 7DA</div>'




def pin_line(text, size=20, color=SOFT):
    return f'<div style="display:flex;align-items:center;gap:{size * .5:.0f}px;font-family:Lexend;font-weight:300;font-size:{size}px;color:{color}">{PIN.format(s=round(size * 1.2))}{text}</div>'


CREAM, KRAFT, GRAPHITE = "#F6F0E4", "#B98F5E", "#4E4A44"


# ---------------------------------------------------------------- EMMA (new to the area)
GEN = "General"


def e1(size):
    """VT-24 Stat headline: the stat is Avenue's own rating and review count (homepage, 27 Oct 2026)."""
    name = f"{GEN} | Static | Team photo | 227 people to ask"
    stars = lambda s: '<span style="display:flex;gap:4px">' + "".join(STAR.format(s=s, c=GOLD) for _ in range(5)) + "</span>"
    if size == "ls":
        inner = f"""
{photo('av2-team-welcome.jpg', 690, 0, 510, 628, .24, .5, corner='bl', r=120)}
<div class="abs" style="left:56px;top:46px">{logo(108)}</div>
<div class="abs hl" style="left:56px;top:150px;width:600px;font-size:40px">New to Leamington and <b>nobody to ask yet?</b></div>
<div class="abs hl glow" style="left:50px;top:250px;font-size:150px;color:{GOLD};letter-spacing:-.03em;line-height:1">4.9</div>
<div class="abs" style="left:290px;top:278px">{stars(30)}</div>
<div class="abs body" style="left:290px;top:322px;width:360px;font-size:24px;color:{WHITE};line-height:1.3">from 227 Google reviews</div>
<div class="abs label" style="left:56px;top:436px;font-size:13px;color:{GOLD}">Now accepting new patients on Lime Avenue</div>
<div class="abs" style="left:56px;top:490px">{cta(CTA_BOOK, 18)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    if s9:
        inner = f"""
{photo('av2-team-welcome.jpg', 0, 1120, 1080, 800, .34, .42, corner='tr', r=220)}
<div class="abs" style="left:80px;top:270px">{logo(150)}</div>
<div class="abs hl" style="left:80px;top:440px;width:920px;font-size:70px">New to Leamington and <b>nobody to ask yet?</b></div>
<div class="abs hl glow" style="left:70px;top:640px;font-size:250px;color:{GOLD};letter-spacing:-.03em;line-height:1">4.9</div>
<div class="abs" style="left:470px;top:690px">{stars(48)}</div>
<div class="abs body" style="left:470px;top:760px;width:520px;font-size:38px;color:{WHITE};line-height:1.25">from 227 Google reviews</div>
<div class="abs label" style="left:80px;top:950px;font-size:21px;color:{GOLD}">Now accepting new patients on Lime Avenue</div>
<div class="abs" style="left:80px;top:1010px;z-index:2">{cta(CTA_BOOK, 26)}</div>"""
        return board(size, name, inner)
    inner = f"""
{photo('av2-team-welcome.jpg', 0, 690, 1080, 390, .34, .36, corner='tr', r=150)}
<div class="abs" style="left:80px;top:66px">{logo(120)}</div>
<div class="abs hl" style="left:80px;top:180px;width:940px;font-size:58px">New to Leamington and <b>nobody to ask yet?</b></div>
<div class="abs hl glow" style="left:72px;top:330px;font-size:200px;color:{GOLD};letter-spacing:-.03em;line-height:1">4.9</div>
<div class="abs" style="left:400px;top:360px">{stars(40)}</div>
<div class="abs body" style="left:400px;top:420px;width:560px;font-size:34px;color:{WHITE};line-height:1.25">from 227 Google reviews</div>
<div class="abs label" style="left:80px;top:548px;font-size:17px;color:{GOLD}">Now accepting new patients on Lime Avenue</div>
<div class="abs" style="left:80px;top:592px">{cta(CTA_BOOK, 22)}</div>"""
    return board(size, name, inner)


def envelope(w):
    """VT-28 invitation card, rebuilt: a cream welcome card rising out of a gold envelope with the monogram seal.
    w is the envelope width; returns (html, height). The card's lower edge sits inside the pocket."""
    s = w / 640
    cw, ch = round(520 * s), round(470 * s)
    pocket_h = round(250 * s)
    top_card = 0
    pocket_y = round(330 * s)
    H = pocket_y + pocket_h
    cx = (w - cw) // 2
    f = lambda v: round(v * s)
    card = f"""<div class="abs" data-name="Invitation card" style="left:{cx}px;top:{top_card}px;width:{cw}px;height:{ch}px;background:linear-gradient(180deg,#FBF7EF,{CREAM});border-radius:{f(6)}px;box-shadow:0 {f(18)}px {f(40)}px rgba(0,0,0,.45);color:{INK};text-align:center">
  <div class="abs" style="inset:{f(14)}px;border:1.5px solid rgba(168,140,97,.6);border-radius:{f(3)}px"></div>
  <div class="label" style="margin-top:{f(46)}px;font-size:{f(15)}px;color:{GOLD}">Welcome to</div>
  <div class="hl" style="margin-top:{f(6)}px;font-size:{f(76)}px;font-style:italic;font-weight:400;color:{INK}">Leamington</div>
  <div style="margin:{f(16)}px auto 0;display:inline-block;padding:{f(9)}px {f(22)}px;border-radius:999px;background:{BLACK};color:{GOLD};font-family:Jost;font-weight:500;font-size:{f(19)}px;letter-spacing:.04em">Now accepting new patients</div>
  <div class="body" style="margin-top:{f(20)}px;font-size:{f(20)}px;line-height:1.75;color:#4A443C">A full check-up and 3D scan<br>Oral cancer screening<br>Time to ask questions</div>
</div>"""
    back = f'<div class="abs" data-name="Envelope back" style="left:0;top:{pocket_y - f(110)}px;width:{w}px;height:{pocket_h + f(110)}px;background:linear-gradient(180deg,#7E6644,#5E4C33);border-radius:{f(8)}px"></div>'
    front = (f'<div class="abs" data-name="Envelope front" style="left:0;top:{pocket_y}px;width:{w}px;height:{pocket_h}px;'
             f'background:linear-gradient(180deg,#B89A6B 0%,{GOLD} 45%,#8F7550 100%);border-radius:0 0 {f(8)}px {f(8)}px;'
             f'clip-path:polygon(0 0,50% 46%,100% 0,100% 100%,0 100%);box-shadow:0 {f(20)}px {f(40)}px rgba(0,0,0,.5)"></div>'
             f'<div class="abs" style="left:0;top:{pocket_y}px;width:{w}px;height:{pocket_h}px;background:linear-gradient(180deg,rgba(255,240,210,.25),rgba(0,0,0,0) 30%);clip-path:polygon(0 0,50% 46%,100% 0,100% 6%,50% 52%,0 6%)"></div>')
    seal_d = f(84)
    seal = (f'<div class="abs" data-name="Seal" style="left:{(w - seal_d) // 2}px;top:{pocket_y + round(pocket_h * .46) - seal_d // 2}px;width:{seal_d}px;height:{seal_d}px;border-radius:50%;'
            f'background:radial-gradient(circle at 35% 30%,#3A3530,{BLACK} 70%);box-shadow:0 {f(6)}px {f(14)}px rgba(0,0,0,.5),inset 0 0 0 {f(3)}px rgba(168,140,97,.7);display:flex;align-items:center;justify-content:center">{mono(f(46))}</div>')
    return f'<div class="abs" style="left:0;top:0;width:{w}px;height:{H}px">{back}{card}{front}{seal}</div>', H


def e2(size):
    """VT-28 Invitation card, repurposed as a welcome card (no open day, no date, no price)."""
    name = f"{GEN} | Static | Illustration | Welcome card"
    if size == "ls":
        env, H = envelope(470)
        inner = f"""
<div class="abs" style="left:56px;top:50px">{logo(108)}</div>
<div class="abs hl" style="left:56px;top:160px;width:560px;font-size:50px">New to Leamington? <b>You can stop ringing round.</b></div>
<div class="abs" style="left:56px;top:350px">{pin_line('2 Lime Avenue, Lillington', 18)}</div>
<div class="abs" style="left:56px;top:410px">{cta(CTA_BOOK, 18)}</div>
<div class="abs" style="left:56px;top:510px">{proof(15)}</div>
<div class="abs" style="left:680px;top:{(628 - H) // 2 + 6}px;width:470px;height:{H}px">{env}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    w = 800 if s9 else 600
    env, H = envelope(w)
    if s9:
        inner = f"""
<div class="abs" style="left:80px;top:270px">{logo(150)}</div>
<div class="abs hl" style="left:80px;top:420px;width:920px;font-size:72px">New to Leamington? <b>You can stop ringing round.</b></div>
<div class="abs" style="left:{(1080 - w) // 2}px;top:640px;width:{w}px;height:{H}px">{env}</div>
<div class="abs" style="left:80px;top:{640 + H + 44}px">{pin_line('2 Lime Avenue, Lillington', 26)}</div>
<div class="abs" style="left:80px;top:{640 + H + 110}px;display:flex;align-items:center;gap:34px">{cta(CTA_BOOK, 26)}{proof(21)}</div>"""
        return board(size, name, inner)
    inner = f"""
<div class="abs" style="left:70px;top:70px">{logo(120)}</div>
<div class="abs hl" style="left:70px;top:210px;width:380px;font-size:60px">New to Leamington? <b>You can stop ringing round.</b></div>
<div class="abs" style="left:70px;top:700px">{pin_line('2 Lime Avenue, Lillington', 20)}</div>
<div class="abs" style="left:70px;top:770px">{cta(CTA_BOOK, 22)}</div>
<div class="abs" style="left:70px;top:960px">{proof(18)}</div>
<div class="abs" style="left:450px;top:{(1080 - H) // 2 + 20}px;width:{w}px;height:{H}px">{env}</div>"""
    return board(size, name, inner)


def kraft_label(w, rot=-3):
    """A brown moving-box label taped on, with a marker-pen list: the dentist is the one not ticked yet."""
    s = w / 420
    f = lambda v: round(v * s)
    row = lambda t, done: (f'<div style="display:flex;align-items:center;gap:{f(14)}px;font-family:Caveat;font-weight:700;font-size:{f(58)}px;line-height:1.05;color:#1E1A15">'
                           f'<span style="width:{f(38)}px;height:{f(38)}px;border:{f(4)}px solid #1E1A15;border-radius:{f(5)}px;flex:none;display:flex;align-items:center;justify-content:center">'
                           + (f'<svg viewBox="0 0 24 24" width="{f(40)}" height="{f(40)}" style="display:block;margin:-{f(10)}px 0 0 {f(8)}px" fill="none" stroke="#1E1A15" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13l5 5L21 4"/></svg>' if done else "")
                           + f'</span>{t}</div>')
    tape = lambda x, r: f'<div class="abs" style="left:{x}px;top:-{f(22)}px;width:{f(120)}px;height:{f(44)}px;background:rgba(232,226,210,.62);transform:rotate({r}deg);box-shadow:0 1px 2px rgba(0,0,0,.15)"></div>'
    return (f'<div class="abs" data-name="Box label" style="width:{w}px;padding:{f(30)}px {f(36)}px {f(26)}px;transform:rotate({rot}deg);'
            f'background:linear-gradient(160deg,#C9A273 0%,{KRAFT} 55%,#A97F51 100%);border-radius:{f(4)}px;'
            f'box-shadow:0 {f(10)}px {f(26)}px rgba(0,0,0,.45),inset 0 0 {f(30)}px rgba(90,60,30,.35)">'
            f'{tape(f(-30), -8)}{tape(w - f(90), 10)}'
            f'<div style="font-family:Jost;font-weight:600;font-size:{f(16)}px;letter-spacing:.24em;color:rgba(30,26,21,.7);margin-bottom:{f(10)}px">TO SORT</div>'
            f'{row("Broadband", True)}{row("GP", True)}{row("Dentist", False)}</div>')


def e3(size):
    """Custom: photo-led, real object. Emma mid-unpack; a taped kraft label on the box carries the list."""
    name = f"{GEN} | Static | Practice photo | Moving list"
    if size == "ls":
        inner = f"""
{photo('av2-drone-practice.jpg', 470, 0, 730, 628, .62, .5)}
{wash('90deg', 1, 0, 34, 'left:470px;width:300px;')}
<div class="abs" style="left:56px;top:46px">{logo(108)}</div>
<div class="abs hl" style="left:56px;top:150px;width:440px;font-size:50px">Still one thing on <b>the moving list?</b></div>
<div class="abs label" style="left:56px;top:330px;font-size:13px;color:{GOLD}">New patients welcome on Lime Avenue</div>
<div class="abs" style="left:56px;top:380px">{cta(CTA_BOOK, 18)}</div>
<div class="abs" style="left:56px;top:480px">{proof(15)}</div>
<div class="abs" style="left:760px;top:400px">{kraft_label(250, -4)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    if s9:
        inner = f"""
{photo('av2-drone-practice-full.jpg', 0, 0, 1080, 1920, .5, .5)}
<div class="abs" data-name="Overlay" style="inset:0;background:linear-gradient(180deg,rgba(27,27,27,.95) 0%,rgba(27,27,27,.88) 30%,rgba(27,27,27,0) 46%,rgba(27,27,27,0) 56%,rgba(27,27,27,.9) 72%,{BLACK} 100%)"></div>
<div class="abs" style="left:80px;top:270px">{logo(150)}</div>
<div class="abs hl" style="left:80px;top:420px;width:640px;font-size:80px">Still one thing on <b>the moving list?</b></div>
<div class="abs" style="left:560px;top:1060px">{kraft_label(400, -4)}</div>
<div class="abs label" style="left:80px;top:1440px;font-size:21px;color:{GOLD}">New patients welcome on Lime Avenue</div>
<div class="abs" style="left:80px;top:1495px;display:flex;align-items:center;gap:34px">{cta(CTA_BOOK, 26)}{proof(21)}</div>"""
        return board(size, name, inner)
    inner = f"""
{photo('av2-drone-practice.jpg', 0, 0, 1080, 1080, .6, .55)}
<div class="abs" data-name="Overlay" style="inset:0;background:linear-gradient(180deg,rgba(27,27,27,.95) 0%,rgba(27,27,27,.86) 28%,rgba(27,27,27,0) 46%,rgba(27,27,27,0) 66%,rgba(27,27,27,.8) 82%,{BLACK} 100%)"></div>
<div class="abs" style="left:70px;top:60px">{logo(120)}</div>
<div class="abs hl" style="left:70px;top:150px;width:900px;font-size:70px">Still one thing on <b>the moving list?</b></div>
<div class="abs" style="left:640px;top:560px">{kraft_label(340, -4)}</div>
<div class="abs label" style="left:70px;top:900px;font-size:17px;color:{GOLD}">New patients welcome on Lime Avenue</div>
<div class="abs" style="left:70px;top:946px;display:flex;align-items:center;gap:30px">{cta(CTA_BOOK, 22)}{proof(18)}</div>"""
    return board(size, name, inner)


# ---------------------------------------------------------------- LINDA (the loose denture)
MT = "Missing Teeth"
DGOLD = "#8C7149"  # the darker gold for accents on Blush Gold, where #A88C61 is too pale to read


def denture_svg(w, ink=INK):
    """Line drawing (not a real case): a lower denture lifted above the gum ridge, two implant caps beneath, dashed arrows
    showing it seats onto them. viewBox 600 x 400. Returns (svg, anchor) where anchor is the left implant cap in px."""
    s = w / 600
    widths = [56, 50, 44, 40, 40, 44, 50, 56]
    x, teeth = 110, ""
    for tw in widths:
        teeth += f'<rect x="{x + 2}" y="66" width="{tw - 4}" height="{90 if tw < 50 else 84}" rx="16" fill="url(#tooth)" stroke="{ink}" stroke-width="2.2"/>'
        x += tw
    gum_top = "M80,150 " + "".join(f"Q{110 + sum(widths[:i]) + widths[i] / 2:.0f},{132 if i % 2 else 136} {110 + sum(widths[:i + 1])},{150}" for i in range(8)) + " L520,150"
    gum = f'<path d="{gum_top} Q540,160 528,190 Q520,206 490,206 L110,206 Q80,206 72,190 Q60,160 80,150Z" fill="url(#gum)" stroke="{ink}" stroke-width="2.2" stroke-linejoin="round"/>'
    housings = "".join(f'<rect x="{cx - 17}" y="200" width="34" height="14" rx="4" fill="{GOLD}" stroke="{ink}" stroke-width="1.8"/>' for cx in (205, 395))
    arrows = "".join(f'<path d="M{cx},226 L{cx},262" stroke="{ink}" stroke-width="2" stroke-dasharray="5 6" fill="none"/><path d="M{cx - 8},254 L{cx},266 L{cx + 8},254" stroke="{ink}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' for cx in (205, 395))
    ridge = f'<path d="M40,400 L40,318 Q60,290 120,288 L480,288 Q540,290 560,318 L560,400Z" fill="url(#ridge)" stroke="{ink}" stroke-width="2.2"/>'
    implants = ""
    for cx in (205, 395):
        threads = "".join(f'<path d="M{cx - 13 + i * .4:.1f},{304 + i * 12} L{cx + 13 - i * .4:.1f},{300 + i * 12}" stroke="{ink}" stroke-width="1.6" opacity=".7"/>' for i in range(7))
        implants += (f'<path d="M{cx - 14},296 L{cx + 14},296 L{cx + 11},378 Q{cx},392 {cx - 11},378Z" fill="#E9E3D8" stroke="{ink}" stroke-width="2"/>{threads}'
                     f'<rect x="{cx - 15}" y="274" width="30" height="20" rx="5" fill="{GOLD}" stroke="{ink}" stroke-width="1.8"/>')
    defs = (f'<defs><linearGradient id="tooth" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#EFE7D8"/></linearGradient>'
            f'<linearGradient id="gum" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E2C3AE"/><stop offset="1" stop-color="#C99F86"/></linearGradient>'
            f'<linearGradient id="ridge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#DDBBA4"/><stop offset=".5" stop-color="#C79B83"/><stop offset="1" stop-color="rgba(199,155,131,0)"/></linearGradient></defs>')
    svg = (f'<svg data-name="Denture drawing" viewBox="0 0 600 400" width="{w:.0f}" height="{400 * s:.0f}" style="display:block;overflow:visible">{defs}'
           f'<ellipse cx="300" cy="226" rx="250" ry="16" fill="rgba(60,44,20,.16)"/>{ridge}{implants}{arrows}{gum}{teeth}{housings}</svg>')
    return svg, (205 * s, 284 * s)


def callout(text, size, dark=True):
    bg, fg = (BLACK, WHITE) if dark else (WHITE, INK)
    return (f'<div style="display:inline-block;padding:{size * .6:.0f}px {size * .9:.0f}px;border-radius:{size * .5:.0f}px;background:{bg};color:{fg};border:1.5px solid {GOLD};'
            f'font-family:Jost;font-weight:500;font-size:{size}px;white-space:nowrap;box-shadow:0 {size * .5:.0f}px {size * 1.2:.0f}px rgba(0,0,0,.28)">{text}</div>')


def leader(x1, y1, x2, y2, color=INK, dot=8):
    l, t = min(x1, x2) - dot, min(y1, y2) - dot
    return (f'<svg class="abs" style="left:{l}px;top:{t}px;overflow:visible" width="{abs(x2 - x1) + 2 * dot}" height="{abs(y2 - y1) + 2 * dot}">'
            f'<path d="M{x1 - l},{y1 - t} L{x2 - l},{y2 - t}" stroke="{color}" stroke-width="2"/>'
            f'<circle cx="{x2 - l}" cy="{y2 - t}" r="{dot}" fill="none" stroke="{color}" stroke-width="2"/><circle cx="{x2 - l}" cy="{y2 - t}" r="{dot * .38:.1f}" fill="{color}"/></svg>')


def footer(size, h, fs):
    w = SIZES[size][0]
    return (f'<div class="abs" data-name="Footer" style="left:0;bottom:0;width:{w}px;height:{h}px;background:{BLACK};display:flex;align-items:center;justify-content:space-between;padding:0 {fs * 4:.0f}px">'
            f'{logo(round(fs * 6.4))}{proof(fs)}</div>')


def l1(size):
    """VT-05 Product hero: the 'product' is a line drawing of an implant-retained denture; one callout; reviews footer."""
    name = f"{MT} | Static | Illustration | Another option"
    hl = lambda fs, w: f'<div class="hl" style="width:{w}px;font-size:{fs}px;color:{INK}">Still using denture adhesive <b style="color:{DGOLD}">every morning?</b></div>'
    price = lambda fs: (f'<div class="label" style="font-size:{fs * .19:.0f}px;line-height:1.6;color:{DGOLD}">Implant-retained<br>dentures from</div>'
                        f'<div class="hl" style="font-size:{fs}px;color:{INK};letter-spacing:-.02em;margin-top:{fs * .08:.0f}px">£8,100</div>')
    if size == "ls":
        svg, (ax, ay) = denture_svg(520)
        inner = f"""
<div class="abs" style="left:0;top:0;width:520px;height:628px;background:{BLACK}"></div>
<div class="abs" style="left:48px;top:44px">{logo(104)}</div>
<div class="abs hl" style="left:48px;top:140px;width:440px;font-size:40px">Still using denture adhesive <b>every morning?</b></div>
<div class="abs body" style="left:48px;top:300px;font-size:22px;color:{WHITE}">There's another option.</div>
<div class="abs label" style="left:48px;top:372px;font-size:12px;color:{GOLD}">Implant-retained dentures from</div>
<div class="abs hl glow" style="left:46px;top:392px;font-size:62px;color:{GOLD}">£8,100</div>
<div class="abs" style="left:48px;top:500px">{cta(CTA_FREE, 17)}</div>
<div class="abs" style="left:620px;top:120px">{svg}</div>
{leader(780, 488, 620 + ax, 120 + ay)}
<div class="abs" style="left:700px;top:488px">{callout('Held in place by implants', 17)}</div>
<div class="abs" style="left:640px;top:572px">{proof(14, INK, DGOLD)}</div>"""
        return board(size, name, inner, bg=BLUSH)
    s9 = size == "s9"
    if s9:
        svg, (ax, ay) = denture_svg(760)
        dx, dy = 160, 640
        rx = dx + ax * 395 / 205
        inner = f"""
<div class="abs" style="left:80px;top:280px">{hl(84, 920)}</div>
<div class="abs body" style="left:80px;top:500px;font-size:40px;color:{INK};font-weight:400">There's another option.</div>
<div class="abs" style="left:{dx}px;top:{dy}px">{svg}</div>
{leader(760, 1186, rx + 4, dy + ay + 8)}
<div class="abs" style="left:600px;top:1160px">{callout('Held in place by implants', 24)}</div>
<div class="abs" style="left:80px;top:1240px">{price(120)}</div>
<div class="abs" style="left:560px;top:1430px">{cta(CTA_FREE, 24)}</div>
{footer(size, 300, 22)}"""
        return board(size, name, inner, bg=BLUSH)
    svg, (ax, ay) = denture_svg(600)
    dx, dy = 420, 330
    inner = f"""
<div class="abs" style="left:80px;top:80px">{hl(66, 920)}</div>
<div class="abs body" style="left:80px;top:250px;font-size:32px;color:{INK};font-weight:400">There's another option.</div>
<div class="abs" style="left:80px;top:420px">{price(104)}</div>
<div class="abs" style="left:{dx}px;top:{dy}px">{svg}</div>
{leader(330, 707, dx + ax, dy + ay)}
<div class="abs" style="left:80px;top:680px">{callout('Held in place by implants', 21)}</div>
<div class="abs" style="left:80px;top:810px">{cta(CTA_FREE, 22)}</div>
{footer(size, 150, 19)}"""
    return board(size, name, inner, bg=BLUSH)


TIERS = [("Partial dentures", "from £1,045"), ("Full dentures", "from £1,320"), ("Implant-retained dentures", "from £8,100")]


def tiers(size=26, color=WHITE):
    rows = "".join(f'<div style="display:flex;justify-content:space-between;align-items:baseline;gap:24px;padding:{size * .62:.0f}px 0;border-top:1.5px solid rgba(168,140,97,.55)">'
                   f'<span class="body" style="font-size:{size}px;color:{color}">{a}</span><span class="hl" style="font-size:{size * 1.15:.0f}px;color:{GOLD}">{b}</span></div>'
                   for a, b in TIERS)
    return rows + '<div style="border-top:1.5px solid rgba(168,140,97,.55)"></div>'


BAND = f"background:linear-gradient(180deg,#C2A475 0%,{GOLD} 60%,#977C55 100%)"


def l2(size):
    """VT-17 Centre band split: Linda in her kitchen, a gold band with the question, the three tiers priced beneath."""
    name = f"{MT} | Static | Practice photo | Whole apple"
    q = lambda fs: f'<div class="hl" style="font-size:{fs}px;color:{BLACK}">When did you last bite <span style="color:{WHITE}">into an apple?</span></div>'
    if size == "ls":
        inner = f"""
{photo('av2-consult-chat.jpg', 0, 0, 420, 628, .36, .4)}
<div class="abs" style="left:0;top:0;width:420px;height:150px;background:linear-gradient(180deg,rgba(27,27,27,.7),rgba(27,27,27,0))"></div>
<div class="abs" style="left:36px;top:34px">{logo(96)}</div>
<div class="abs" data-name="Band" style="left:420px;top:0;width:330px;height:628px;{BAND};padding:150px 36px 0">{q(44)}</div>
<div class="abs" style="left:780px;top:96px;width:380px">{tiers(17)}</div>
<div class="abs" style="left:780px;top:400px">{cta(CTA_FREE, 17)}</div>
<div class="abs" style="left:780px;top:500px">{proof(14)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    ph, band = (900, 230) if s9 else (480, 160)
    fs = 26 if s9 else 24
    inner = f"""
{photo('av2-consult-chat.jpg', 0, 0, 1080, ph, .5, .4)}
<div class="abs" style="left:0;top:0;width:1080px;height:{480 if s9 else 220}px;background:linear-gradient(180deg,rgba(27,27,27,.8),rgba(27,27,27,.4) {58 if s9 else 50}%,rgba(27,27,27,0))"></div>
<div class="abs" style="left:80px;top:{270 if s9 else 60}px">{logo(150 if s9 else 120)}</div>
<div class="abs" data-name="Band" style="left:0;top:{ph}px;width:1080px;height:{band}px;{BAND};display:flex;align-items:center;padding:0 80px;box-shadow:0 10px 30px rgba(0,0,0,.35)">{q(72 if s9 else 56)}</div>
<div class="abs" style="left:80px;top:{ph + band + (40 if s9 else 30)}px;width:920px">{tiers(fs)}</div>
<div class="abs" style="left:80px;top:{1460 if s9 else 960}px;display:flex;align-items:center;gap:34px">{cta(CTA_FREE, 24 if s9 else 21)}{proof(21 if s9 else 17)}</div>"""
    return board(size, name, inner)


MENU = [("Sirloin steak", "peppercorn sauce, hand-cut chips", "x"), ("Crusty bread", "salted butter", "x"),
        ("Soup of the day", "with a soft roll", "o"), ("Corn on the cob", "garlic butter", "x"), ("Toffee apple crumble", "warm custard", "x")]


def menu_card(w, rot=4):
    """A cream restaurant menu, pencil through everything that needs a proper bite; the soup circled."""
    s = w / 440
    f = lambda v: round(v * s)
    rows = ""
    for dish, desc, mark in MENU:
        if mark == "x":
            mk = (f'<svg class="abs" style="left:-{f(8)}px;top:{f(14)}px;overflow:visible" width="{f(330)}" height="{f(20)}"><path d="M0,{f(12)} C{f(90)},{f(6)} {f(200)},{f(14)} {f(318)},{f(4)}" stroke="{GRAPHITE}" stroke-width="{max(2, f(3))}" fill="none" stroke-linecap="round" opacity=".85"/></svg>')
        else:
            mk = (f'<svg class="abs" style="left:-{f(26)}px;top:-{f(14)}px;overflow:visible" width="{f(380)}" height="{f(96)}"><path d="M{f(20)},{f(52)} C{f(10)},{f(10)} {f(330)},{f(-6)} {f(360)},{f(40)} C{f(380)},{f(82)} {f(60)},{f(98)} {f(16)},{f(62)}" stroke="{GRAPHITE}" stroke-width="{max(2, f(3))}" fill="none" stroke-linecap="round" opacity=".85"/></svg>')
        rows += (f'<div style="position:relative;margin-top:{f(30)}px">'
                 f'<div style="font-family:Jost;font-weight:500;font-size:{f(30)}px;color:#2A2520;letter-spacing:.01em">{dish}</div>'
                 f'<div style="font-family:Jost;font-style:italic;font-weight:400;font-size:{f(18)}px;color:#7A6E60;margin-top:{f(2)}px">{desc}</div>{mk}</div>')
    return (f'<div class="abs" data-name="Menu card" style="width:{w}px;padding:{f(54)}px {f(56)}px {f(60)}px;transform:rotate({rot}deg);'
            f'background:linear-gradient(170deg,#FBF7EE 0%,{CREAM} 60%,#EADFCB 100%);border-radius:{f(4)}px;'
            f'box-shadow:0 {f(30)}px {f(60)}px rgba(0,0,0,.55),0 {f(4)}px {f(10)}px rgba(0,0,0,.3)">'
            f'<div class="abs" style="inset:{f(16)}px;border:1px solid rgba(122,110,96,.45)"></div>'
            f'<div style="text-align:center;font-family:Jost;font-weight:500;font-size:{f(15)}px;letter-spacing:.42em;color:#7A6E60">TONIGHT</div>'
            f'<div style="text-align:center;font-family:Jost;font-weight:400;font-style:italic;font-size:{f(46)}px;color:#2A2520;margin-top:{f(4)}px">Menu</div>'
            f'<div style="width:{f(60)}px;height:1px;background:#7A6E60;margin:{f(14)}px auto 0"></div>{rows}</div>')


def l3(size):
    """Custom: real object. A menu with everything chewy crossed out in pencil, lit on the dark backdrop."""
    import depth
    name = f"{MT} | Static | Illustration | The menu"
    w, h = SIZES[size]
    if size == "ls":
        glows = [(930, 300, 260, .26), (200, 150, 220, .1)]
        inner = f"""
<div class="abs" style="left:56px;top:46px">{logo(108)}</div>
<div class="abs hl" style="left:56px;top:140px;width:540px;font-size:46px">You've started ordering by <b>what you can chew.</b></div>
<div class="abs label" style="left:56px;top:330px;font-size:13px;color:{GOLD}">Implant-retained dentures from</div>
<div class="abs hl glow" style="left:54px;top:350px;font-size:66px;color:{GOLD}">£8,100</div>
<div class="abs" style="left:56px;top:470px">{cta(CTA_FREE, 18)}</div>
<div class="abs" style="left:56px;top:565px">{proof(14)}</div>
<div class="abs" style="left:790px;top:-30px">{menu_card(310, 5)}</div>"""
    elif size == "s9":
        glows = [(700, 900, 420, .26), (300, 400, 300, .1)]
        inner = f"""
<div class="abs" style="left:80px;top:270px">{logo(150)}</div>
<div class="abs hl" style="left:80px;top:430px;width:920px;font-size:78px">You've started ordering by <b>what you can chew.</b></div>
<div class="abs" style="left:480px;top:660px">{menu_card(470, 4)}</div>
<div class="abs label" style="left:80px;top:1080px;width:300px;font-size:20px;line-height:1.6;color:{GOLD}">Implant-retained dentures from</div>
<div class="abs hl glow" style="left:76px;top:1160px;font-size:104px;color:{GOLD}">£8,100</div>
<div class="abs" style="left:80px;top:1480px;display:flex;align-items:center;gap:34px">{cta(CTA_FREE, 26)}{proof(21)}</div>"""
    else:
        glows = [(780, 520, 340, .26), (250, 250, 260, .1)]
        inner = f"""
<div class="abs" style="left:70px;top:70px">{logo(120)}</div>
<div class="abs hl" style="left:70px;top:200px;width:480px;font-size:62px">You've started ordering by <b>what you can chew.</b></div>
<div class="abs label" style="left:70px;top:540px;font-size:17px;color:{GOLD}">Implant-retained dentures from</div>
<div class="abs hl glow" style="left:66px;top:570px;font-size:104px;color:{GOLD}">£8,100</div>
<div class="abs" style="left:70px;top:760px">{cta(CTA_FREE, 22)}</div>
<div class="abs" style="left:70px;top:985px">{proof(17)}</div>
<div class="abs" style="left:570px;top:90px">{menu_card(430, 4)}</div>"""
    bg = depth.panel(w, h, glows, key=f"l3-bg-{size}")
    return board(size, name, inner, bg=f"{BLACK} url({bg}) center/cover")


# ---------------------------------------------------------------- HANNAH (the trend follower)
SMO = "Smile Makeover"
H_ITEMS = ["Free consultation", "Digital scans and photos", "A written plan and price before anything starts"]


def h1(size):
    """VT-11 Statement, repurposed: the promise as the statement, the three consultation lines in place of freebies."""
    name = f"{SMO} | Static | UGC Khawla | Tell us the result"
    if size == "ls":
        items = "".join(f'<div class="body" style="font-size:16px;color:{SOFT};margin-top:8px">{t}</div>' for t in H_ITEMS)
        inner = f"""
{photo('av2-khawla-lounge.jpg', 0, 0, 560, 628, .4, .4, corner='br', r=130)}
<div class="abs" style="left:610px;top:44px">{logo(104)}</div>
<div class="abs hl" style="left:610px;top:150px;width:540px;font-size:36px">You don't need to know the treatment.</div>
<div class="abs hl glow" style="left:610px;top:240px;width:540px;font-size:50px;color:{GOLD};font-style:italic;font-weight:400">Just tell us the result.</div>
<div class="abs rule" style="left:610px;top:330px;width:90px"></div>
<div class="abs" style="left:610px;top:346px">{items}</div>
<div class="abs" style="left:610px;top:470px">{cta(CTA_FREE, 18)}</div>
<div class="abs" style="left:610px;top:565px">{proof(14)}</div>"""
        return board(size, name, inner)
    s9 = size == "s9"
    H = 1920 if s9 else 1080
    sep = f'<span style="color:{GOLD};padding:0 .6em">·</span>'
    items = (f'<div class="body" style="font-size:{26 if s9 else 21}px;color:{SOFT};line-height:1.6">{H_ITEMS[0]}{sep}{H_ITEMS[1]}<br>{H_ITEMS[2]}</div>')
    top = 1040 if s9 else 640
    inner = f"""
{photo('av2-khawla-lounge.jpg', 0, 0, 1080, H, .5, .64 if s9 else .6, 1.2 if s9 else 1.0)}
<div class="abs" data-name="Overlay" style="inset:0;background:linear-gradient(180deg,rgba(27,27,27,.75) 0%,rgba(27,27,27,.5) {18 if s9 else 8}%,rgba(27,27,27,0) {27 if s9 else 16}%,rgba(27,27,27,0) {40 if s9 else 42}%,rgba(27,27,27,.9) {54 if s9 else 60}%,{BLACK} {70 if s9 else 80}%)"></div>
<div class="abs" style="left:{80 if s9 else 70}px;top:{270 if s9 else 60}px">{logo(150 if s9 else 120)}</div>
<div class="abs" style="left:0;top:{top}px;width:1080px;text-align:center">
  <div class="hl" style="font-size:{62 if s9 else 50}px">You don't need to know the treatment.</div>
  <div class="hl glow" style="margin-top:{18 if s9 else 6}px;font-size:{98 if s9 else 72}px;color:{GOLD};font-style:italic;font-weight:400">Just tell us the result.</div>
  <div class="rule" style="width:120px;margin:{34 if s9 else 20}px auto {26 if s9 else 16}px"></div>
  {items}
  <div style="margin-top:{44 if s9 else 26}px">{cta(CTA_FREE, 26 if s9 else 22)}</div>
</div>"""
    return board(size, name, inner)


def tooth_path(x, y, w, h, tip=False, chip=False):
    """Front view of an upper tooth hanging from the gum line at y: flat top, gently waisted sides, rounded biting edge."""
    r = w * .22
    b = y + h
    if tip:
        edge = f"L{x + w},{b - h * .2} Q{x + w * .62},{b - h * .02} {x + w * .5},{b} Q{x + w * .38},{b - h * .02} {x},{b - h * .2}"
    elif chip:
        edge = f"L{x + w},{b - h * .2} L{x + w * .7},{b - h * .07} L{x + w * .62},{b - 2} Q{x + w * .3},{b + 2} {x + r * .4},{b - r * .3} Q{x},{b - r} {x},{b - r * 1.4}"
    else:
        edge = f"L{x + w},{b - r} Q{x + w},{b} {x + w - r},{b} L{x + r},{b} Q{x},{b} {x},{b - r}"
    return f"M{x + w * .04},{y} L{x + w * .96},{y} Q{x + w * 1.02},{y + h * .45} {x + w},{b - h * .3} {edge} Q{x - w * .02},{y + h * .45} {x + w * .04},{y}Z"


def teeth_svg(w):
    """Six upper front teeth as a line drawing (illustration, not a case): one chipped edge, one tooth overlapping, one shade darker.
    viewBox 700 x 320. Returns (svg, anchors) with anchors chip / overlap / shade in px."""
    s = w / 700
    g = 60
    T = [  # x, w, h, tip, chip, rot, fill
        (22, 100, 186, True, False, 0, "url(#shade)"),
        (120, 92, 168, False, False, -2, "url(#tooth)"),
        (212, 122, 214, False, True, 0, "url(#tooth)"),
        (336, 122, 214, False, False, 0, "url(#tooth)"),
        (460, 92, 168, False, False, 9, "url(#tooth)"),
        (550, 100, 186, True, False, 0, "url(#tooth)"),
    ]
    order = [0, 1, 2, 3, 5, 4]  # the rotated lateral is drawn last so it overlaps the central
    body = ""
    for i in order:
        x, tw, th, tip, chip, rot, fill = T[i]
        cx = x + tw / 2
        body += (f'<path d="{tooth_path(x, g - 34, tw, th + 34, tip, chip)}" fill="{fill}" stroke="{GOLD}" stroke-width="2.6" stroke-linejoin="round" transform="rotate({rot} {cx} {g})"/>'
                 f'<path d="M{x + tw * .3},{g + 26} Q{x + tw * .26},{g + th * .5} {x + tw * .34},{g + th * .72}" stroke="#FFFFFF" stroke-width="5" fill="none" opacity=".7" stroke-linecap="round" transform="rotate({rot} {cx} {g})"/>')
    gum = f"M12,{g + 14} L22,{g + 22} " + "".join(f"Q{x + tw / 2:.0f},{g - 24} {x + tw:.0f},{g + 22}" for x, tw, *_ in T) + f" L688,{g + 14} Q700,{g - 4} 688,{g - 22} Q350,-66 12,{g - 22} Q0,{g - 4} 12,{g + 14}Z"
    defs = ('<defs><linearGradient id="tooth" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3ECDF"/><stop offset="1" stop-color="#FFFDF8"/></linearGradient>'
            '<linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D9C39B"/><stop offset="1" stop-color="#E9D9BA"/></linearGradient>'
            '<linearGradient id="gumg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5A3E33"/><stop offset="1" stop-color="#8A5E4E"/></linearGradient></defs>')
    svg = (f'<svg data-name="Teeth drawing" viewBox="0 0 700 320" width="{w:.0f}" height="{320 * s:.0f}" style="display:block;overflow:visible">{defs}{body}'
           f'<path d="{gum}" fill="url(#gumg)" stroke="{GOLD}" stroke-width="2.6" stroke-linejoin="round"/></svg>')
    anchors = {"chip": (212 + 122 * .8, g + 214 - 12), "overlap": (492, 149), "shade": (72, 150)}
    return svg, {k: (a * s, b * s) for k, (a, b) in anchors.items()}


def note_box(title, line, fs, w=None):
    width = f"width:{w}px;" if w else ""
    return (f'<div style="{width}padding:{fs * .75:.0f}px {fs:.0f}px;border-radius:{fs * .55:.0f}px;background:{PANEL};border:1.5px solid {GOLD};box-shadow:0 {fs * .6:.0f}px {fs * 1.4:.0f}px rgba(0,0,0,.4)">'
            f'<div style="font-family:Jost;font-weight:500;font-size:{fs}px;color:{WHITE};line-height:1.2">{title}</div>'
            f'<div style="font-family:Lexend;font-weight:300;font-size:{fs * .78:.0f}px;color:{GOLD};margin-top:{fs * .3:.0f}px;white-space:nowrap">{line}</div></div>')


NOTES = {"chip": ("A chipped or uneven edge", "Edge bonding · from £175 a tooth"),
         "shade": ("A shade or two brighter", "Whitening · £199"),
         "overlap": ("Teeth that overlap", "Clear aligners · from £2,500")}


def h2(size):
    """VT-23 Annotated product callouts: the product is a drawing of six front teeth; three callouts name the fix and the price."""
    name = f"{SMO} | Static | Illustration | Which is which"
    if size == "ls":
        dw, dx, dy, fs = 520, 640, 200, 15
        svg, an = teeth_svg(dw)
        boxes = {"shade": (600, 40, 0), "overlap": (900, 40, 0), "chip": (640, 480, 0)}
        text = f"""<div class="abs" style="left:56px;top:46px">{logo(108)}</div>
<div class="abs hl" style="left:56px;top:150px;width:520px;font-size:38px">Bonding, veneers, aligners. <b>Which one do you actually need?</b></div>
<div class="abs body" style="left:56px;top:330px;width:500px;font-size:19px;color:{SOFT}">Not sure which is you? That's what the free consultation is for.</div>
<div class="abs" style="left:56px;top:440px">{cta(CTA_FREE, 18)}</div>
<div class="abs" style="left:56px;top:540px">{proof(14)}</div>"""
    elif size == "s9":
        dw, dx, dy, fs = 880, 100, 900, 26
        svg, an = teeth_svg(dw)
        boxes = {"shade": (80, 690, 0), "overlap": (600, 690, 0), "chip": (300, 1330, 0)}
        text = f"""<div class="abs" style="left:80px;top:270px">{logo(150)}</div>
<div class="abs hl" style="left:80px;top:420px;width:920px;font-size:66px">Bonding, veneers, aligners. <b>Which one do you actually need?</b></div>
<div class="abs" style="left:80px;top:1480px;display:flex;align-items:center;gap:34px">{cta(CTA_FREE, 26)}{proof(21)}</div>"""
    else:
        dw, dx, dy, fs = 700, 190, 460, 22
        svg, an = teeth_svg(dw)
        boxes = {"shade": (70, 322, 0), "overlap": (640, 322, 0), "chip": (300, 830, 0)}
        text = f"""<div class="abs" style="left:70px;top:60px">{logo(120)}</div>
<div class="abs hl" style="left:70px;top:172px;width:940px;font-size:52px">Bonding, veneers, aligners. <b>Which one do you actually need?</b></div>
<div class="abs" style="left:70px;top:960px;display:flex;align-items:center;gap:30px">{cta(CTA_FREE, 22)}{proof(18)}</div>"""
    # leaders run from the box edge nearest the tooth to the anchor
    bh = fs * 3.4
    parts = []
    for k, (bx, by, _) in boxes.items():
        ax, ay = dx + an[k][0], dy + an[k][1]
        sx = bx + fs * 2
        sy = by + bh if ay > by + bh else by
        parts.append(leader(sx, sy, ax, ay, GOLD, round(fs * .34)))
    notes = "".join(f'<div class="abs" style="left:{bx}px;top:{by}px">{note_box(*NOTES[k], fs)}</div>' for k, (bx, by, _) in boxes.items())
    inner = f"""{text}
<div class="abs" style="left:{dx}px;top:{dy}px">{svg}</div>
{''.join(parts)}
{notes}"""
    return board(size, name, inner)


SHADES = ["#F6F2E8", "#F3EDDF", "#F1E8D6", "#EEE4CF", "#EBDFC6", "#E8DABF", "#E5D4B6", "#E1CEAE", "#DDC8A6", "#D8C09B",
          "#D3B992", "#CDB189", "#C7A980", "#C0A077", "#B8976D", "#AF8D63"]
CODES = ["B1", "A1", "B2", "D2", "A2", "C1", "C2", "D4", "A3", "D3", "B3", "A3.5", "B4", "C3", "A4", "C4"]


def shade_fan(w, lift=5):
    """A dentist's shade guide (illustration): sixteen tooth tabs on short metal stems fanned from a hub; tab `lift` is pulled up.
    Design space 900 wide; returns (html, hub_y, height) with hub_y the hub centre."""
    s = w / 900
    f = lambda v: round(v * s)
    stem, tw, th, up_by = f(300), f(62), f(86), f(64)
    px, py = f(450), stem + th + up_by + f(16)
    out = ""
    n = len(SHADES)
    for i, c in enumerate(SHADES):
        a = -74 + 148 * i / (n - 1)
        up = up_by if i == lift else 0
        tab = (f'<div style="position:absolute;left:{-tw // 2}px;top:{-stem - th - up}px;width:{tw}px;height:{th}px;'
               f'border-radius:42% 42% 46% 46% / 30% 30% 62% 62%;background:radial-gradient(ellipse at 38% 30%,#FFFFFF 0%,{c} 45%,{c} 70%,rgba(120,96,64,.55) 130%);'
               f'box-shadow:0 {f(10)}px {f(18)}px rgba(0,0,0,.5),inset 0 -{f(6)}px {f(10)}px rgba(120,96,64,.25)'
               + (f',0 0 {f(44)}px rgba(232,207,159,.6)' if i == lift else "") + '"></div>')
        st = (f'<div style="position:absolute;left:-{f(9)}px;top:{-stem - up}px;width:{f(18)}px;height:{stem + up}px;'
              f'background:linear-gradient(90deg,#55524D,#B9B5AD 45%,#6B6862);border-radius:{f(3)}px;box-shadow:0 {f(6)}px {f(12)}px rgba(0,0,0,.45)">'
              f'<div style="position:absolute;top:{f(14)}px;left:0;width:100%;text-align:center;font-family:Jost;font-weight:600;font-size:{f(11)}px;color:#1B1B1B;writing-mode:vertical-rl;transform:rotate(180deg)">{CODES[i]}</div></div>')
        z = 30 if i == lift else i
        out += f'<div style="position:absolute;left:{px}px;top:{py}px;width:0;height:0;transform:rotate({a:.1f}deg);z-index:{z}">{st}{tab}</div>'
    r = f(70)
    hub = (f'<div style="position:absolute;left:{px - r}px;top:{py - r}px;width:{2 * r}px;height:{2 * r}px;border-radius:50%;z-index:40;'
           f'background:radial-gradient(circle at 40% 35%,#4A4743,#1E1D1B 70%);box-shadow:0 {f(14)}px {f(30)}px rgba(0,0,0,.6),inset 0 0 0 {f(3)}px rgba(168,140,97,.6);'
           f'display:flex;align-items:center;justify-content:center">{mono(f(70))}</div>')
    return f'<div data-name="Shade guide" style="position:relative;width:{w}px;height:{py + r}px">{out}{hub}</div>', py, py + r


def h3(size):
    """Custom: real object. A shade guide fanned on the lit dark backdrop, one tab lifted out."""
    import depth
    name = f"{SMO} | Static | Illustration | Your shade"
    w, h = SIZES[size]
    if size == "ls":
        fan, hy, fh = shade_fan(540)
        fx, fy = 620, 100
        glows = [(fx + 270, fy + hy - 120, 260, .3), (200, 200, 220, .1)]
        inner = f"""
<div class="abs" style="left:{fx}px;top:{fy}px">{fan}</div>
<div class="abs" style="left:56px;top:46px">{logo(108)}</div>
<div class="abs hl" style="left:56px;top:150px;width:520px;font-size:52px">Not piano-key white. <b style="font-style:italic;font-weight:400">Your shade.</b></div>
<div class="abs body" style="left:56px;top:300px;width:480px;font-size:20px;color:{SOFT}">Bonding colour-matched to your own teeth</div>
<div class="abs" style="left:56px;top:350px">{price_tooth(46, 16)}</div>
<div class="abs" style="left:56px;top:450px">{cta(CTA_FREE, 18)}</div>
<div class="abs" style="left:56px;top:550px">{proof(14)}</div>"""
    elif size == "s9":
        fan, hy, fh = shade_fan(1000)
        fx, fy = 40, 660
        glows = [(540, fy + hy - 200, 460, .3), (540, 400, 300, .08)]
        inner = f"""
<div class="abs" style="left:{fx}px;top:{fy}px">{fan}</div>
<div class="abs" style="left:80px;top:270px">{logo(150)}</div>
<div class="abs hl" style="left:80px;top:420px;width:920px;font-size:90px">Not piano-key white. <b style="font-style:italic;font-weight:400">Your shade.</b></div>
<div class="abs body" style="left:0;width:1080px;text-align:center;top:{fy + fh + 30}px;font-size:30px;color:{SOFT}">Bonding colour-matched to your own teeth</div>
<div class="abs" style="left:0;width:1080px;top:{fy + fh + 90}px;display:flex;justify-content:center">{price_tooth(80, 26)}</div>
<div class="abs" style="left:0;width:1080px;top:{fy + fh + 210}px;display:flex;justify-content:center;align-items:center;gap:34px">{cta(CTA_FREE, 24)}{proof(20)}</div>"""
    else:
        fan, hy, fh = shade_fan(860)
        fx, fy = 110, 300
        glows = [(540, fy + hy - 160, 380, .3), (540, 200, 260, .08)]
        inner = f"""
<div class="abs" style="left:{fx}px;top:{fy}px">{fan}</div>
<div class="abs" style="left:70px;top:60px">{logo(120)}</div>
<div class="abs hl" style="left:70px;top:170px;width:940px;font-size:72px">Not piano-key white. <b style="font-style:italic;font-weight:400">Your shade.</b></div>
<div class="abs body" style="left:70px;top:{fy + fh + 26}px;font-size:22px;color:{SOFT}">Bonding colour-matched to your own teeth</div>
<div class="abs" style="left:70px;top:{fy + fh + 64}px">{price_tooth(58, 20)}</div>
<div class="abs" style="left:640px;top:{fy + fh + 74}px">{cta(CTA_FREE, 22)}</div>"""
    bg = depth.panel(w, h, glows, key=f"h3-bg-{size}")
    return board(size, name, inner, bg=f"{BLACK} url({bg}) center/cover")


def price_tooth(big, small, color=GOLD):
    return (f'<div style="display:flex;align-items:baseline;gap:{small * .5:.0f}px;white-space:nowrap">'
            f'<span class="label" style="font-size:{small * .8:.0f}px;color:{GOLD}">Edge bonding from</span>'
            f'<span class="hl glow" style="font-size:{big}px;color:{color};letter-spacing:-.02em">£175</span>'
            f'<span class="body" style="font-size:{small}px;color:{WHITE}">a tooth</span></div>')


PERSONAS = {"emma": [e1, e2, e3], "linda": [l1, l2, l3], "hannah": [h1, h2, h3]}
FILES = {"s1": "1x1", "s9": "9x16", "ls": "landscape"}

if __name__ == "__main__":
    which = sys.argv[1:] or list(PERSONAS)
    for p in which:
        for size, suffix in FILES.items():
            (ROOT / f"{p}-{suffix}.html").write_text(page(f"Avenue | {p} | {suffix}", [f(size) for f in PERSONAS[p]]))
    print("built", which)
