"""Build Stoke Bishop Dental Centre Meta static harness pages.

Usage: python3 build.py   ->  mark-1x1.html, mark-9x16.html, mark-landscape.html
Brand: no guideline exists, so this is built from the live site (stokebishop-dentalcentre.co.uk, Webflow CSS tokens):
Montserrat headings (light + bold mix, title case), Hind body, deep green / mint palette, and the site's
"cushion" section shape (straight sides, top and bottom edges bowed). Photos are the client's own practice
shoot from the site (assets/photos, gitignored). Copy: copy-mark.md. Research: research.md.
"""
import struct
from pathlib import Path

ROOT = Path(__file__).parent
A = ROOT / "assets"

# Site tokens (--color--*) plus two tints of the same hues for lighting.
C = dict(dk="#1e3329", dk2="#16271f", pr="#4e866c", hv="#3e6e58", mint="#b3f2d5", mint2="#d9ffed", acc="#8ddcad",
         teal="#56a7a8", tint="#eff8f3", line="#e2ece7", text="#333333", wh="#ffffff", paper="#fbfaf4", star="#f4b400")

SIZES = {"s1": (1080, 1080), "s9": (1080, 1920), "ls": (1200, 628)}
FILES = {"s1": "1x1", "s9": "9x16", "ls": "landscape"}
DATE = "261027"

GRAIN = ("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>"
         "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.9 0'/></filter>"
         "<rect width='100%' height='100%' filter='url(%23n)'/></svg>")
PAPER = ("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'>"
         "<filter id='p'><feTurbulence type='fractalNoise' baseFrequency='0.04 0.6' numOctaves='2' seed='7'/>"
         "<feColorMatrix values='0 0 0 0 0.35 0 0 0 0 0.33 0 0 0 0 0.28 0 0 0 0.10 0'/></filter>"
         "<rect width='100%' height='100%' filter='url(%23p)'/></svg>")

FONTS = "".join(
    f"@font-face {{ font-family: '{fam}'; src: url(assets/fonts/{fn}) format('woff2'); font-weight: {w}; font-style: {st}; }}\n"
    for fam, fn, w, st in [
        ("Montserrat", "Montserrat-300.woff2", "100 900", "normal"),
        ("Montserrat", "Montserrat-300i.woff2", "100 900", "italic"),
        ("Hind", "Hind-400.woff2", "400", "normal"),
        ("Hind", "Hind-500.woff2", "500", "normal"),
        ("Hind", "Hind-600.woff2", "600", "normal"),
        ("Permanent Marker", "PermanentMarker-400.woff2", "400", "normal"),
        ("Caveat", "Caveat-700.woff2", "400 700", "normal"),
    ])

CSS = FONTS + f"""
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ background: #2a2a2a; font-family: Hind, sans-serif; display: flex; gap: 80px; padding: 80px; align-items: flex-start; }}
.ab {{ position: relative; overflow: hidden; flex: none; color: {C['dk']}; }}
.s1 {{ width: 1080px; height: 1080px; }}
.s9 {{ width: 1080px; height: 1920px; }}
.ls {{ width: 1200px; height: 628px; }}
.abs {{ position: absolute; }}
.cover {{ position: absolute; inset: 0; }}
.photo {{ position: absolute; overflow: hidden; }}
.photo > i {{ position: absolute; display: block; background-repeat: no-repeat; }}
.grain {{ position: absolute; inset: 0; background-image: url("{GRAIN}"); opacity: .12; mix-blend-mode: overlay; pointer-events: none; }}
.mont {{ font-family: Montserrat, sans-serif; }}
.eyebrow {{ font-family: Montserrat, sans-serif; font-size: 22px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; }}
.hl {{ font-family: Montserrat, sans-serif; font-weight: 300; line-height: 1.04; letter-spacing: -.01em; }}
.hl b {{ font-weight: 700; }}
.body {{ font-family: Hind, sans-serif; font-weight: 400; line-height: 1.35; }}
.price {{ font-family: Montserrat, sans-serif; font-weight: 300; line-height: .82; letter-spacing: -.04em; }}
.cta {{ display: inline-flex; align-items: center; justify-content: center; height: 76px; padding: 0 44px; border-radius: 999px;
        font-family: Montserrat, sans-serif; font-size: 22px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; white-space: nowrap;
        box-shadow: 0 10px 24px rgba(10,25,18,.28); }}
.cta.mint {{ background: {C['mint']}; color: {C['dk']}; }}
.cta.dark {{ background: {C['dk']}; color: {C['wh']}; }}
.chip {{ position: absolute; background: {C['wh']}; border-radius: 18px; padding: 16px 24px 14px; box-shadow: 0 12px 28px rgba(10,25,18,.22); }}
.chip img {{ display: block; height: auto; }}
.small {{ font-family: Hind, sans-serif; font-weight: 500; }}
"""


# ------------------------------------------------------------------ helpers
def jpeg_size(img):
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
            return w, h
        i += 2 + seg
    raise ValueError(f"no size in {img}")


def photo(img, x, y, w, h, fx=.5, fy=.5, zoom=1.0, extra="", inner_style=""):
    """Photo cover-cropped into a box from the real image aspect (never stretched); fx/fy = focal point."""
    iw, ih = jpeg_size(img)
    s = max(w / iw, h / ih) * zoom
    bw, bh = iw * s, ih * s
    ox, oy = -(bw - w) * fx, -(bh - h) * fy
    return (f'<div class="photo" data-name="Photo" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;{extra}">'
            f'<i style="left:{ox:.0f}px;top:{oy:.0f}px;width:{bw:.0f}px;height:{bh:.0f}px;'
            f'background-image:url(assets/photos/{img});background-size:100% 100%;{inner_style}"></i></div>')


def cushion(w, h, d=None, r=18):
    """The site's section shape: top edge sags to the centre, bottom edge bows out (sbs-grad.svg), as a px clip path."""
    d = d if d is not None else round(w * .028)
    return (f"path('M {r} 0 C {w*.3:.0f} {d*.55:.1f} {w*.4:.0f} {d} {w/2:.0f} {d} C {w*.6:.0f} {d} {w*.7:.0f} {d*.55:.1f} {w-r} 0 "
            f"Q {w} 0 {w} {r} L {w} {h-d-r} Q {w} {h-d} {w-r} {h-d} "
            f"C {w*.7:.0f} {h-d*.45:.1f} {w*.6:.0f} {h} {w/2:.0f} {h} C {w*.4:.0f} {h} {w*.3:.0f} {h-d*.45:.1f} {r} {h-d} "
            f"Q 0 {h-d} 0 {h-d-r} L 0 {r} Q 0 0 {r} 0 Z')")


def cushion_v(w, h, d=None, r=18):
    """Cushion turned on its side (left edge sags in, right edge bows out) for landscape side panels."""
    d = d if d is not None else round(h * .045)
    return (f"path('M {r} 0 L {w-d-r} 0 Q {w-d} 0 {w-d} {r} C {w-d*.45:.1f} {h*.3:.0f} {w} {h*.4:.0f} {w} {h/2:.0f} "
            f"C {w} {h*.6:.0f} {w-d*.45:.1f} {h*.7:.0f} {w-d} {h-r} Q {w-d} {h} {w-d-r} {h} L {r} {h} Q 0 {h} 0 {h-r} "
            f"C {d*.55:.1f} {h*.7:.0f} {d} {h*.6:.0f} {d} {h/2:.0f} C {d} {h*.4:.0f} {d*.55:.1f} {h*.3:.0f} 0 {r} Q 0 0 {r} 0 Z')")


def logo_chip(x, y, w=260):
    return f'<div class="chip" data-name="Logo" style="left:{x}px;top:{y}px"><img src="assets/logo.png" style="width:{w}px"></div>'


STAR = '<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="currentColor"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>'


def proof(color, size=24):
    stars = "".join(STAR.format(s=size) for _ in range(5))
    return (f'<div data-name="Google reviews" style="display:flex;align-items:center;gap:12px;color:{color}">'
            f'<span style="display:flex;gap:2px;color:{C["star"]}">{stars}</span>'
            f'<span class="small" style="font-size:{size}px;line-height:1;padding-top:3px">4.9 from 185 Google reviews</span></div>')


PIN = '<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2z"/></svg>'
TICK = '<svg viewBox="0 0 40 40" width="{s}" height="{s}" fill="none" stroke="currentColor" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 22 C9 25 12 29 15 33 C21 21 28 12 36 6"/></svg>'
CTA = "Book your check-up"


def board(size, cid, name, bg, inner):
    w, h = SIZES[size]
    return (f'<div class="ab {size}" id="{cid}" data-name="{name} | {FILES[size].replace("landscape", "1.91x1")} | {DATE}" '
            f'style="background:{bg}">{inner}<div class="grain"></div></div>')


# ------------------------------------------------------------------ M1 | Price up front (VT-06 Offer footer)
M1 = "Price Up Front | Static | Practice shoot | £85 check-up"


def m1(size):
    dk, mint = C["dk"], C["mint"]
    glow = f"radial-gradient(ellipse at 18% 0%,rgba(141,220,173,.20),transparent 55%),radial-gradient(ellipse at 100% 100%,rgba(86,167,168,.18),transparent 60%)"
    if size == "s1":
        inner = f"""
{photo('chair-laugh-wide.jpg', 0, 0, 1080, 580, .5, .3)}
<div class="cover" style="height:580px;background:linear-gradient(180deg,rgba(30,51,41,.0) 55%,rgba(30,51,41,.55) 100%)"></div>
{logo_chip(56, 52, 250)}
<div class="abs" data-name="Offer panel" style="left:0;top:520px;width:1080px;height:600px;clip-path:{cushion(1080, 600, 34)};background:{dk}">
  <div class="cover" style="background:{glow}"></div>
</div>
<div class="abs eyebrow" style="left:72px;top:604px;color:{C['acc']}">New patient check-up</div>
<div class="abs hl" style="left:72px;top:648px;font-size:60px;color:{C['wh']}">Been a few years? <b>Start here.</b></div>
<div class="abs price" style="left:62px;top:748px;font-size:220px;color:{mint}">£85</div>
<div class="abs body" style="left:76px;top:938px;width:470px;font-size:30px;color:{C['mint2']}">Full check-up and two small x-rays</div>
<div class="abs" style="left:560px;top:760px;width:2px;height:190px;background:rgba(179,242,213,.25)"></div>
<div class="abs" style="left:604px;top:782px">{proof(C['wh'], 23)}</div>
<div class="abs" style="left:604px;top:846px"><span class="cta mint" data-name="Button">{CTA}</span></div>
<div class="abs body" style="left:604px;top:944px;font-size:24px;color:{C['acc']};display:flex;gap:10px;align-items:center">{PIN.format(s=24)}<span style="padding-top:3px">15 Druid Hill, Stoke Bishop · Free parking</span></div>
"""
    elif size == "s9":
        inner = f"""
{photo('chair-laugh-wide.jpg', 0, 0, 1080, 900, .42, .3)}
<div class="cover" style="height:900px;background:linear-gradient(180deg,rgba(30,51,41,.35) 0%,rgba(30,51,41,0) 22%,rgba(30,51,41,0) 70%,rgba(30,51,41,.55) 100%)"></div>
{logo_chip(70, 270, 270)}
<div class="abs" data-name="Offer panel" style="left:0;top:830px;width:1080px;height:1090px;clip-path:{cushion(1080, 1200, 40)};background:{dk}">
  <div class="cover" style="background:{glow}"></div>
</div>
<div class="abs eyebrow" style="left:84px;top:930px;font-size:26px;color:{C['acc']}">New patient check-up</div>
<div class="abs hl" style="left:84px;top:984px;font-size:84px;color:{C['wh']}">Been a few years?<br><b>Start here.</b></div>
<div class="abs price" style="left:70px;top:1190px;font-size:250px;color:{mint}">£85</div>
<div class="abs body" style="left:560px;top:1236px;width:430px;font-size:36px;color:{C['mint2']}">Full check-up and two small x-rays</div>
<div class="abs" style="left:84px;top:1430px;width:912px;height:2px;background:rgba(179,242,213,.22)"></div>
<div class="abs" style="left:84px;top:1468px"><span class="cta mint" data-name="Button" style="height:84px;font-size:24px">{CTA}</span></div>
<div class="abs" style="left:560px;top:1478px;width:440px">{proof(C['wh'], 22)}<div class="body" style="margin-top:14px;font-size:24px;color:{C['acc']};display:flex;gap:8px;align-items:center">{PIN.format(s=22)}<span style="padding-top:3px">15 Druid Hill · Free parking</span></div></div>
"""
    else:
        inner = f"""
{photo('chair-laugh-wide.jpg', 0, 0, 640, 628, .5, .4)}
{logo_chip(36, 36, 210)}
<div class="abs" data-name="Offer panel" style="left:560px;top:0;width:640px;height:628px;clip-path:{cushion_v(640, 628, 30)};transform:scaleX(-1);background:{dk}">
  <div class="cover" style="background:{glow}"></div>
</div>
<div class="abs eyebrow" style="left:642px;top:58px;font-size:18px;color:{C['acc']}">New patient check-up</div>
<div class="abs hl" style="left:642px;top:92px;font-size:46px;color:{C['wh']}">Been a few years?<br><b>Start here.</b></div>
<div class="abs price" style="left:634px;top:222px;font-size:156px;color:{mint}">£85</div>
<div class="abs body" style="left:920px;top:252px;width:230px;font-size:24px;color:{C['mint2']}">Full check-up and two small x-rays</div>
<div class="abs" style="left:642px;top:392px">{proof(C['wh'], 20)}</div>
<div class="abs" style="left:642px;top:440px"><span class="cta mint" data-name="Button" style="height:64px;font-size:19px;padding:0 34px">{CTA}</span></div>
<div class="abs body" style="left:642px;top:536px;font-size:20px;color:{C['acc']};display:flex;gap:8px;align-items:center">{PIN.format(s=20)}<span style="padding-top:3px">15 Druid Hill, Stoke Bishop · Free parking</span></div>
"""
    return board(size, f"M1{size}", M1, C["dk"], inner)


# ------------------------------------------------------------------ M2 | No telling off (VT-31 Handwritten sign)
M2 = "No Telling Off | Static | Practice shoot | Handwritten note"


def note(x, y, w, scale=1.0, rot=-2.2):
    """Paper note taped over the scene: marker headline, mint underline, three hand-ticked lines."""
    s = scale
    ticks = "".join(
        f'<div style="display:flex;align-items:center;gap:{18*s:.0f}px;margin-top:{16*s:.0f}px;color:{C["dk"]}">'
        f'<span style="color:{C["pr"]};flex:none">{TICK.format(s=round(44*s))}</span>'
        f'<span style="font-family:Caveat,cursive;font-weight:700;font-size:{52*s:.0f}px;line-height:1">{t}</span></div>'
        for t in ["Extra time if you're nervous", "Nothing done without your OK", "Meet us first, no treatment"])
    return f"""
<div class="abs" data-name="Sign" style="left:{x}px;top:{y}px;width:{w}px;padding:{70*s:.0f}px {64*s:.0f}px {60*s:.0f}px;transform:rotate({rot}deg);
  background:{C['paper']};border-radius:6px;box-shadow:0 {40*s:.0f}px {80*s:.0f}px rgba(8,20,14,.45),0 {8*s:.0f}px {18*s:.0f}px rgba(8,20,14,.3)">
  <div class="cover" style="border-radius:6px;background-image:url(&quot;{PAPER}&quot;)"></div>
  <div class="cover" style="border-radius:6px;background:linear-gradient(160deg,rgba(255,255,255,.6) 0%,rgba(255,255,255,0) 40%,rgba(0,0,0,.05) 100%)"></div>
  <div data-name="Tape" style="position:absolute;left:50%;top:{-26*s:.0f}px;width:{230*s:.0f}px;height:{62*s:.0f}px;transform:translateX(-50%) rotate(3deg);
    background:linear-gradient(180deg,rgba(179,242,213,.82),rgba(141,220,173,.78));box-shadow:0 2px 6px rgba(0,0,0,.12);
    clip-path:polygon(2% 8%,6% 0,12% 6%,20% 0,30% 5%,42% 0,55% 6%,66% 0,78% 5%,88% 0,96% 6%,100% 2%,98% 92%,93% 100%,86% 94%,74% 100%,62% 95%,50% 100%,38% 94%,26% 100%,14% 95%,5% 100%,0 94%)"></div>
  <div style="position:relative;font-family:'Permanent Marker',cursive;font-size:{64*s:.0f}px;line-height:1.08;color:{C['dk']}">Six months or<br>six years.<br><span style="color:{C['pr']}">No telling off.</span></div>
  <svg style="position:relative;display:block;margin:{4*s:.0f}px 0 {18*s:.0f}px" width="{420*s:.0f}" height="{26*s:.0f}" viewBox="0 0 420 26" fill="none">
    <path d="M4 16 C80 6 180 4 300 10 C340 12 380 14 414 9" stroke="{C['acc']}" stroke-width="9" stroke-linecap="round"/></svg>
  <div style="position:relative">{ticks}</div>
</div>"""


def m2(size):
    dk = C["dk"]
    shade = "linear-gradient(180deg,rgba(22,39,31,.55) 0%,rgba(22,39,31,.35) 40%,rgba(22,39,31,.82) 100%)"
    blur = "filter:blur(6px) saturate(.9);transform:scale(1.06)"
    if size == "s1":
        inner = f"""
{photo('waiting-room-wide.jpg', 0, 0, 1080, 1080, .45, .5, inner_style=blur)}
<div class="cover" style="background:{shade}"></div>
<div class="cover" style="background:radial-gradient(ellipse at 45% 38%,rgba(255,240,215,.16),transparent 55%)"></div>
{logo_chip(56, 44, 200)}
{note(150, 190, 780, .94, -2.2)}
<div class="abs" style="left:72px;top:918px;width:936px;display:flex;align-items:center;justify-content:space-between">
  <div><div class="hl" style="font-size:30px;color:{C['wh']}">New patient check-up <b style="color:{C['mint']}">£85</b></div>
  <div style="margin-top:14px">{proof(C['mint2'], 21)}</div></div>
  <span class="cta mint" data-name="Button">{CTA}</span>
</div>
"""
    elif size == "s9":
        inner = f"""
{photo('waiting-room-tall.jpg', 0, 0, 1080, 1920, .5, .5, inner_style=blur)}
<div class="cover" style="background:{shade}"></div>
<div class="cover" style="background:radial-gradient(ellipse at 50% 42%,rgba(255,240,215,.16),transparent 55%)"></div>
{logo_chip(70, 270, 260)}
{note(110, 470, 860, 1.12, -2.0)}
<div class="abs hl" style="left:84px;top:1262px;font-size:40px;color:{C['wh']}">New patient check-up <b style="color:{C['mint']}">£85</b></div>
<div class="abs" style="left:84px;top:1330px">{proof(C['mint2'], 24)}</div>
<div class="abs" style="left:84px;top:1400px"><span class="cta mint" data-name="Button" style="height:84px;font-size:24px">{CTA}</span></div>
"""
    else:
        inner = f"""
{photo('waiting-room-wide.jpg', 0, 0, 1200, 628, .5, .5, inner_style=blur)}
<div class="cover" style="background:linear-gradient(90deg,rgba(22,39,31,.9) 0%,rgba(22,39,31,.75) 40%,rgba(22,39,31,.35) 100%)"></div>
{logo_chip(52, 44, 200)}
<div class="abs hl" style="left:56px;top:160px;width:500px;font-size:46px;color:{C['wh']}">Been putting it off? You'll get a welcome, <b style="color:{C['mint']}">not a lecture.</b></div>
<div class="abs hl" style="left:56px;top:378px;font-size:24px;color:{C['wh']}">New patient check-up <b style="color:{C['mint']}">£85</b></div>
<div class="abs" style="left:56px;top:418px">{proof(C['mint2'], 18)}</div>
<div class="abs" style="left:56px;top:480px"><span class="cta mint" data-name="Button" style="height:62px;font-size:18px;padding:0 32px">{CTA}</span></div>
{note(626, 66, 500, .64, 2.0)}
"""
    return board(size, f"M2{size}", M2, dk, inner)


# ------------------------------------------------------------------ M3 | Your first visit (custom)
M3 = "First Visit | Static | Practice shoot | Three steps"
STEPS = [("Tell us how long it's been.", "No lecture."),
         ("Check-up and two small x-rays.", "£85."),
         ("We explain what we found,", "in plain language.")]


def num(n, s=64):
    return (f'<span style="flex:none;width:{s}px;height:{s}px;border-radius:50%;background:{C["dk"]};color:{C["mint"]};display:flex;'
            f'align-items:center;justify-content:center;font-family:Montserrat;font-weight:700;font-size:{s*.46:.0f}px">{n}</span>')


def steps_cols(fs=27, gap=26):
    return "".join(
        f'<div style="flex:1"><div>{num(i + 1)}</div><div class="body" style="margin-top:18px;font-size:{fs}px;line-height:1.25;color:{C["dk"]}">'
        f'{a} <b style="font-weight:600;color:{C["pr"]}">{b}</b></div></div>' for i, (a, b) in enumerate(STEPS))


def steps_rows(fs=34, s=70, gap=30):
    return "".join(
        f'<div style="display:flex;align-items:center;gap:28px;margin-top:{gap if i else 0}px">{num(i + 1, s)}'
        f'<div class="body" style="font-size:{fs}px;line-height:1.2;color:{C["dk"]}">{a} <b style="font-weight:600;color:{C["pr"]}">{b}</b></div></div>'
        for i, (a, b) in enumerate(STEPS))


def m3(size):
    dk, tint = C["dk"], C["tint"]
    panel_bg = f"linear-gradient(180deg,{C['wh']} 0%,{tint} 60%,#e3f4ea 100%)"
    if size == "s1":
        inner = f"""
{photo('chair-laugh-tall.jpg', 0, 0, 1080, 760, .5, .28)}
<div class="cover" style="height:760px;background:linear-gradient(180deg,rgba(22,39,31,.88) 0%,rgba(22,39,31,.55) 26%,rgba(22,39,31,0) 50%)"></div>
<div class="abs hl" style="left:72px;top:70px;font-size:76px;color:{C['wh']}">The hardest part<br>is <b style="color:{C['mint']}">booking it.</b></div>
<div class="abs" data-name="Steps panel" style="left:0;top:560px;width:1080px;height:560px;clip-path:{cushion(1080, 560, 36)};background:{panel_bg}"></div>
<div class="abs eyebrow" style="left:72px;top:626px;color:{C['pr']}">Your first visit</div>
<div class="abs" style="left:72px;top:676px;width:936px;display:flex;gap:40px">{steps_cols(28)}</div>
<div class="abs" style="left:72px;top:930px;width:936px;height:2px;background:{C['line']}"></div>
<div class="abs" style="left:72px;top:960px;width:936px;display:flex;align-items:center;justify-content:space-between">
  <img src="assets/logo.png" style="width:230px" data-name="Logo">
  {proof(C['text'], 20)}
  <span class="cta dark" data-name="Button" style="height:66px;font-size:19px;padding:0 32px">{CTA}</span>
</div>
"""
    elif size == "s9":
        inner = f"""
<div class="cover" style="background:radial-gradient(ellipse at 20% 15%,rgba(141,220,173,.18),transparent 55%)"></div>
{photo('chair-laugh-tall.jpg', 0, 520, 1080, 620, .5, .3)}
<div class="abs" style="left:0;top:520px;width:1080px;height:620px;background:linear-gradient(180deg,{dk} 0%,rgba(30,51,41,0) 30%)"></div>
{logo_chip(70, 270, 260)}
<div class="abs hl" style="left:84px;top:372px;font-size:92px;color:{C['wh']}">The hardest part<br>is <b style="color:{C['mint']}">booking it.</b></div>
<div class="abs" data-name="Steps panel" style="left:0;top:1060px;width:1080px;height:900px;clip-path:{cushion(1080, 980, 44)};background:{panel_bg}"></div>
<div class="abs eyebrow" style="left:84px;top:1136px;font-size:26px;color:{C['pr']}">Your first visit</div>
<div class="abs" style="left:84px;top:1190px;width:912px">{steps_rows(37, 72, 24)}</div>
<div class="abs" style="left:84px;top:1468px;width:912px;display:flex;align-items:center;justify-content:space-between">
  <span class="cta dark" data-name="Button" style="height:84px;font-size:24px">{CTA}</span>
  {proof(C['text'], 21)}
</div>
"""
    else:
        inner = f"""
{photo('chair-laugh-tall.jpg', 560, 0, 640, 628, .5, .3)}
<div class="abs" data-name="Steps panel" style="left:0;top:0;width:660px;height:628px;clip-path:{cushion_v(660, 628, 30)};background:{panel_bg}"></div>
<div class="abs" style="left:46px;top:40px"><img src="assets/logo.png" style="width:190px" data-name="Logo"></div>
<div class="abs hl" style="left:46px;top:104px;font-size:46px;color:{dk}">The hardest part<br>is <b style="color:{C['pr']}">booking it.</b></div>
<div class="abs eyebrow" style="left:46px;top:236px;font-size:16px;color:{C['pr']}">Your first visit</div>
<div class="abs" style="left:46px;top:270px;width:560px">{steps_rows(21, 44, 14)}</div>
<div class="abs" style="left:46px;top:476px">{proof(C['text'], 17)}</div>
<div class="abs" style="left:46px;top:516px"><span class="cta dark" data-name="Button" style="height:60px;font-size:17px;padding:0 30px">{CTA}</span></div>
"""
    return board(size, f"M3{size}", M3, C["tint"] if size == "ls" else C["dk"], inner)


# ------------------------------------------------------------------ pages
def page(title, boards):
    return (f"<!doctype html><html lang='en-GB'><head><meta charset='utf-8'><title>{title}</title>"
            f"<style>{CSS}</style><script src='https://mcp.figma.com/mcp/html-to-design/capture.js' async></script></head>"
            f"<body>{''.join(boards)}</body></html>")


if __name__ == "__main__":
    for size, label in FILES.items():
        out = ROOT / f"mark-{label}.html"
        out.write_text(page(f"Stoke Bishop | Mark | {label}", [m1(size), m2(size), m3(size)]))
        print("wrote", out.name)
