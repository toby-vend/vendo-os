"""Siha Dental new Meta statics from Hannan's 10 Oct 2026 feedback: membership plans, ICON white-spot cases, before/afters.

Usage: python3 build.py -> membership-1x1.html, membership-9x16.html, cases-1x1.html, cases-9x16.html
Styles copied from ../siha-meta-statics/build.py (same Siha system: Metropolis, S-frame, grain).
Facts: siha.dental fees pages (12 Oct 2026) + Hannan's email. Cases: Hannan's ICON Drive folder
(1yo64Oj7EtTAQHP10v_lIKEJxwRAZ0Bhd) and Siha's Drive treatment folders (via ../siha-ba-cards). assets/cases is gitignored.
"""
import re
from pathlib import Path

ROOT = Path(__file__).parent
A = ROOT / "assets"

C = dict(od="#14211a", ol="#293425", gl="#4c5d46", be="#e1d5ca", nu="#eae3de", bo="#ab6f4b", br="#877663", wh="#ffffff")


def inline_svg(name, cls):
    s = (A / name).read_text()
    s = re.sub(r"<\?xml.*?\?>|<!DOCTYPE.*?>", "", s, flags=re.S)
    s = re.sub(r'fill:#[0-9a-fA-F]{6};?', "", s)
    s = s.replace('width="100%" height="100%"', f'class="{cls}" fill="currentColor"', 1)
    return s


LOGO = inline_svg("logo-dark.svg", "logo")
ICON = inline_svg("shape.svg", "icon")
# Outline S for the line-S motif (same geometry as the icon, stroked)
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
.cta.line {{ border: 2px solid currentColor; }}
.logo {{ display: block; height: auto; }}
.icon, .line-s {{ display: block; }}
.sframe {{ position: absolute; }}
.sframe .t, .sframe .b {{ position: absolute; left: 0; width: 100%; height: 50%; background-repeat: no-repeat; }}
.sframe .t {{ top: 0; border-radius: 9999px 0 0 9999px; }}
.sframe .b {{ bottom: 0; border-radius: 0 9999px 9999px 0; }}
.price {{ font-weight: 300; line-height: .85; letter-spacing: -.02em; }}
.small {{ font-size: 20px; font-weight: 500; letter-spacing: .04em; }}
"""


def photo_aspect(img):
    """Width / height of a photo in assets/photos, read from the JPEG header."""
    import struct
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


def sframe(x, y, w, h, img, fx=0.5, fy=0.35, zoom=1.0):
    """Photo cropped inside the S shape: two stacked blocks sharing one image.

    The photo is scaled to cover the whole S (never stretched); fx/fy set the
    focal point (0 to 1) used when cropping the overflow.
    """
    a = photo_aspect(img)
    if w / h > a:   # frame wider than photo: fit width, crop height
        bw, bh = w, w / a
    else:           # frame taller than photo: fit height, crop width
        bw, bh = h * a, h
    bw, bh = bw * zoom, bh * zoom
    ox = -(bw - w) * fx
    oy = -(bh - h) * fy
    bg = f"background-image:url(assets/photos/{img});background-size:{bw:.0f}px {bh:.0f}px;"
    return (f'<div class="sframe" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px">'
            f'<div class="t" style="{bg}background-position:{ox:.0f}px {oy:.0f}px"></div>'
            f'<div class="b" style="{bg}background-position:{ox:.0f}px {oy - h / 2:.0f}px"></div></div>')



def page(title, boards):
    return (f"<!doctype html><html lang='en-GB'><head><meta charset='utf-8'><title>{title}</title>"
            f"<style>{CSS}</style><script src='https://mcp.figma.com/mcp/html-to-design/capture.js' async></script></head><body>{''.join(boards)}</body></html>")


CTA_FREE = "Book a free consultation"
STAR = '<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="currentColor"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>'


def proof(color, size=22):
    stars = "".join(STAR.format(s=size) for _ in range(5))
    return (f'<div style="display:flex;align-items:center;gap:14px;color:{color}">'
            f'<span style="display:flex;gap:3px">{stars}</span>'
            f'<span class="small" style="font-size:{size}px">5.0 from 156 Google reviews</span></div>')



CTA_ASSESS = "Book your assessment"
TICK = ('<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="none" stroke="currentColor" stroke-width="2.4" '
        'stroke-linecap="round" stroke-linejoin="round" style="flex:none"><path d="M5 12.5l4.2 4.2L19 7"/></svg>')

# Plan contents: siha.dental/fees-and-finance, 12 Oct 2026. Under-6s: Hannan's email (10 Oct 2026).
ADULT = ["1 oral health assessment a year", "2 hygiene visits a year", "Routine X-rays included", "5% off treatments",
         "10% off oral health products", "Dental accident and emergency cover"]
PLUS = ["1 oral health assessment a year", "4 hygiene visits a year", "Routine X-rays included", "5% off treatments",
        "Dental accident and emergency cover"]
CHILD = ["2 oral health assessments a year", "Brushing and diet advice", "Fluoride varnish", "X-rays when needed",
         "5% off treatments", "Dental accident and emergency cover"]


def cta(text, kind, x, y, small=True):
    st = "height:60px;font-size:17px;padding:0 30px" if small else ""
    return f'<div class="abs" style="left:{x}px;top:{y}px"><span class="cta {kind}" style="{st}">{text}</span></div>'


def foot(color, cta_text, kind, nine=False, logo_y=None):
    """Logo bottom-left, CTA bottom-right (same positions as the existing Siha ads)."""
    if nine:
        return (f'<div class="abs" style="left:90px;top:{logo_y or 1474}px;width:200px;color:{color}">{LOGO}</div>'
                f'<div class="abs" style="right:90px;top:{(logo_y or 1474) - 14}px"><span class="cta {kind}">{cta_text}</span></div>')
    return (f'<div class="abs" style="left:80px;top:950px;width:200px;color:{color}">{LOGO}</div>'
            f'<div class="abs" style="right:70px;top:965px"><span class="cta {kind}" style="height:60px;font-size:17px;padding:0 30px">{cta_text}</span></div>')


def plan_card(x, y, w, name, price, items, scale=1.0, rot=-1.2, note=""):
    """Membership plan card: name, monthly price, tick list. Off-white paper card with a real cast shadow."""
    s = scale
    rows = "".join(f'<div style="display:flex;align-items:center;gap:{int(14*s)}px;padding:{int(11*s)}px 0;'
                   f'border-top:1px solid rgba(20,33,26,.1);color:{C["od"]}">'
                   f'<span style="color:{C["bo"]}">{TICK.format(s=int(24*s))}</span>'
                   f'<span style="font-size:{int(25*s)}px">{t}</span></div>' for t in items)
    nt = f'<div style="margin-top:{int(14*s)}px;font-size:{int(18*s)}px;color:{C["br"]}">{note}</div>' if note else ""
    return (f'<div class="abs" data-name="Plan card" style="left:{x}px;top:{y}px;width:{w}px;padding:{int(40*s)}px {int(44*s)}px {int(34*s)}px;'
            f'background:#fbf9f6;border-radius:{int(10*s)}px;transform:rotate({rot}deg);'
            f'box-shadow:0 {int(40*s)}px {int(70*s)}px rgba(20,33,26,.24),0 {int(6*s)}px {int(14*s)}px rgba(20,33,26,.14)">'
            f'<div class="eyebrow" style="font-size:{int(17*s)}px;color:{C["br"]}">{name}</div>'
            f'<div style="display:flex;align-items:baseline;gap:{int(10*s)}px;margin:{int(10*s)}px 0 {int(18*s)}px;color:{C["bo"]}">'
            f'<span class="price" style="font-size:{int(88*s)}px">{price}</span>'
            f'<span style="font-size:{int(22*s)}px;font-weight:500;color:{C["ol"]}">a month</span></div>{rows}{nt}</div>')


def ladder(x, y, w, rows, color, line, size=30, gap=26):
    """Family price ladder: who / what it costs, one row each."""
    out = "".join(f'<div style="display:flex;justify-content:space-between;align-items:baseline;padding:{gap}px 0;border-top:1px solid {line}">'
                  f'<span style="font-size:{size}px;font-weight:500">{a}<span style="display:block;font-size:{int(size*.62)}px;font-weight:400;opacity:.75;margin-top:6px">{b}</span></span>'
                  f'<span class="price" style="font-size:{int(size*2)}px;color:{C["bo"] if p != "Free" else color}">{p}</span></div>'
                  for a, b, p in rows)
    return f'<div class="abs" data-name="Price ladder" style="left:{x}px;top:{y}px;width:{w}px;color:{color};border-bottom:1px solid {line}">{out}</div>'


def zshot(x, y, w, h, img, label, cx=50, cy=50, zoom=1.0, dark=True, r=10):
    """Like shot() but zooms into the photo around (cx, cy) percent, for tight crops of the teeth."""
    pill_bg, pill_c = (C["od"], C["nu"]) if dark else (C["nu"], C["od"])
    a = photo_aspect_cases(img)
    bw, bh = (w, w / a) if w / h > a else (h * a, h)
    bw, bh = bw * zoom, bh * zoom
    ox = -(bw - w) * cx / 100
    oy = -(bh - h) * cy / 100
    return (f'<div class="abs" data-name="{label.title()}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;border-radius:{r}px;overflow:hidden;'
            f'background-image:url(assets/cases/{img});background-size:{bw:.0f}px {bh:.0f}px;background-position:{ox:.0f}px {oy:.0f}px">'
            f'<span class="eyebrow" style="position:absolute;left:18px;bottom:18px;font-size:15px;letter-spacing:.18em;padding:9px 16px;border-radius:999px;'
            f'background:{pill_bg};color:{pill_c}">{label}</span></div>')


def photo_aspect_cases(img):
    import struct
    data = (A / "cases" / img).read_bytes()
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
    raise ValueError(img)


def real(color, size=18, text="Real Siha patient. Individual results vary."):
    return f'<span style="font-size:{size}px;font-weight:500;letter-spacing:.04em;color:{color}">{text}</span>'


# ---------------------------------------------------------------- MEMBERSHIP (adults + children)
def membership_1x1():
    b = []
    b.append(f"""
<div class="ab s1" id="MB1" data-name="Membership | Static | Adult Smile plan | 1x1" style="background:{C['be']}">
  <div class="cover" style="background:radial-gradient(circle at 78% 40%,#f1e9e1 0%,{C['be']} 46%,#d2c2b2 100%)"></div>
  <div class="abs hl" style="left:80px;top:110px;font-size:52px;color:{C['od']}">Your dental<br>care, sorted<br>for <b>£19.56</b><br>a month.</div>
  <div class="abs body" style="left:80px;top:440px;width:420px;font-size:26px;color:{C['ol']}">Check-ups, hygiene visits and X-rays in one plan. Members get first pick of appointments, evenings and weekends included.</div>
  <div class="abs" style="left:80px;top:700px">{proof(C['br'],20)}</div>
  {plan_card(540, 120, 450, "Smile plan · adults", "£19.56", ADULT, scale=0.95)}
  {foot(C['ol'], CTA_ASSESS, 'dark')}
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s1" id="MB2" data-name="Membership | Static | Child plan | 1x1" style="background:{C['nu']}">
  <div class="cover" style="background:radial-gradient(circle at 25% 40%,#f7f3ee 0%,{C['nu']} 46%,#d8cbbf 100%)"></div>
  {plan_card(90, 120, 450, "Smile Child · under 12", "£5.45", CHILD, scale=0.95, rot=1.2)}
  <div class="abs hl" style="left:600px;top:120px;font-size:56px;color:{C['bo']}">Their<br>check-ups,<br>sorted for<br><b>£5.45</b> a<br>month.</div>
  <div class="abs body" style="left:600px;top:470px;width:400px;font-size:25px;color:{C['ol']}">Two visits a year, with brushing and diet advice that makes sense to them.</div>
  <div class="abs body" style="left:600px;top:640px;width:400px;font-size:22px;font-weight:600;color:{C['od']}">Under 6? Free when you're a registered patient and come in regularly.</div>
  {foot(C['ol'], CTA_ASSESS, 'dark')}
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s1" id="MB3" data-name="Membership | Static | Family ladder | 1x1" style="background:{C['od']}">
  <div class="cover" style="left:600px;background-image:url(assets/photos/lounge-plants.jpg);background-position:50% 50%"></div>
  <div class="cover" style="background:linear-gradient(90deg,{C['od']} 0%,{C['od']} 52%,rgba(20,33,26,.55) 72%,rgba(20,33,26,.15) 100%)"></div>
  <div class="abs hl" style="left:80px;top:100px;font-size:56px;color:{C['nu']}">One practice.<br><b>The whole family.</b></div>
  {ladder(80, 290, 560, [("Adults", "Smile plan", "£19.56"), ("13 to 17", "Smile Plus teen plan", "£12.07"), ("Under 12", "Smile Child plan", "£5.45"), ("Under 6", "With a registered parent", "Free")], C['nu'], "rgba(225,213,202,.22)", size=27, gap=18)}
  <div class="abs small" style="left:80px;top:850px;width:560px;font-size:17px;color:{C['be']};opacity:.8">Monthly prices. Under-6s are free when their parent is a registered patient who attends regularly.</div>
  {foot(C['be'], CTA_ASSESS, 'light')}
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s1" id="MB4" data-name="Membership | Static | Smile Plus gums | 1x1" style="background:{C['be']}">
  <div class="cover" style="background:radial-gradient(circle at 75% 30%,#f1e9e1 0%,{C['be']} 48%,#d2c2b2 100%)"></div>
  {sframe(620, 110, 390, 704, 'hygiene-suite.jpg', fx=0.5, fy=0.4)}
  <div class="abs hl" style="left:80px;top:120px;font-size:58px;color:{C['od']}">Gums that<br>need more<br><b>looking after?</b></div>
  <div class="abs body" style="left:80px;top:390px;width:480px;font-size:30px;font-weight:500;color:{C['bo']}">Four hygiene visits a year. One monthly price.</div>
  <div class="abs body" style="left:80px;top:500px;width:480px;font-size:23px;color:{C['ol']}">Smile Plus is built for gum health, implants, crowns, bridges and dentures. Assessment, X-rays and 5% off treatments included.</div>
  <div class="abs" style="left:80px;top:690px;color:{C['bo']}"><span class="price" style="font-size:80px">£33.89</span> <span style="font-size:22px;font-weight:500;color:{C['ol']}">a month</span></div>
  {foot(C['ol'], CTA_ASSESS, 'dark')}
  <div class="grain"></div>
</div>""")
    return page("Siha | Membership | 1x1", b)


def membership_9x16():
    b = []
    b.append(f"""
<div class="ab s9" id="MB1s" data-name="Membership | Static | Adult Smile plan | 9x16" style="background:{C['be']}">
  <div class="cover" style="background:radial-gradient(circle at 60% 50%,#f1e9e1 0%,{C['be']} 46%,#d2c2b2 100%)"></div>
  <div class="abs hl" style="left:90px;top:250px;font-size:84px;color:{C['od']}">Your dental care,<br>sorted for <b>£19.56</b><br>a month.</div>
  {plan_card(200, 560, 680, "Smile plan · adults", "£19.56", ADULT, scale=1.25)}
  <div class="abs body" style="left:90px;top:1280px;width:900px;font-size:31px;color:{C['ol']}">Members get first pick of appointments, evenings and weekends included.</div>
  <div class="abs" style="left:90px;top:1380px">{proof(C['br'],22)}</div>
  {foot(C['ol'], CTA_ASSESS, 'dark', nine=True, logo_y=1500)}
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s9" id="MB2s" data-name="Membership | Static | Child plan | 9x16" style="background:{C['nu']}">
  <div class="cover" style="background:radial-gradient(circle at 40% 50%,#f7f3ee 0%,{C['nu']} 46%,#d8cbbf 100%)"></div>
  <div class="abs hl" style="left:90px;top:250px;font-size:84px;color:{C['bo']}">Their check-ups,<br>sorted for <b>£5.45</b><br>a month.</div>
  {plan_card(200, 560, 680, "Smile Child · under 12", "£5.45", CHILD, scale=1.25, rot=1.2)}
  <div class="abs body" style="left:90px;top:1300px;width:900px;font-size:33px;font-weight:600;color:{C['od']}">Under 6? Free when you're a registered patient and come in regularly.</div>
  {foot(C['ol'], CTA_ASSESS, 'dark', nine=True, logo_y=1500)}
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s9" id="MB3s" data-name="Membership | Static | Family ladder | 9x16" style="background:{C['od']}">
  <div class="cover" style="height:760px;background-image:url(assets/photos/lounge-plants.jpg);background-position:50% 50%"></div>
  <div class="cover" style="top:300px;height:470px;background:linear-gradient(180deg,rgba(20,33,26,0) 0%,{C['od']} 100%)"></div>
  <div class="abs hl" style="left:90px;top:640px;font-size:80px;color:{C['nu']}">One practice.<br><b>The whole family.</b></div>
  {ladder(90, 860, 900, [("Adults", "Smile plan", "£19.56"), ("13 to 17", "Smile Plus teen plan", "£12.07"), ("Under 12", "Smile Child plan", "£5.45"), ("Under 6", "With a registered parent", "Free")], C['nu'], "rgba(225,213,202,.22)", size=34, gap=20)}
  <div class="abs small" style="left:90px;top:1400px;width:900px;font-size:21px;color:{C['be']};opacity:.8">Monthly prices. Under-6s are free when their parent is a registered patient who attends regularly.</div>
  {foot(C['be'], CTA_ASSESS, 'light', nine=True, logo_y=1500)}
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s9" id="MB4s" data-name="Membership | Static | Smile Plus gums | 9x16" style="background:{C['be']}">
  <div class="cover" style="background:radial-gradient(circle at 55% 28%,#f1e9e1 0%,{C['be']} 45%,#d2c2b2 100%)"></div>
  {sframe(310, 200, 460, 760, 'hygiene-suite.jpg', fx=0.5, fy=0.4)}
  <div class="abs hl" style="left:90px;top:1040px;font-size:80px;color:{C['od']}">Gums that<br>need more<br><b>looking after?</b></div>
  <div class="abs body" style="left:90px;top:1300px;width:900px;font-size:38px;font-weight:500;color:{C['bo']}">Four hygiene visits a year. £33.89 a month.</div>
  <div class="abs body" style="left:90px;top:1370px;width:900px;font-size:28px;color:{C['ol']}">Smile Plus: built for gum health, implants, crowns and dentures.</div>
  {foot(C['ol'], CTA_ASSESS, 'dark', nine=True, logo_y=1500)}
  <div class="grain"></div>
</div>""")
    return page("Siha | Membership | 9x16", b)


# ---------------------------------------------------------------- CASES (ICON white spots + before/afters)
def cases_1x1():
    b = []
    b.append(f"""
<div class="ab s1" id="I1" data-name="ICON | Static | Case 5 spots gone | 1x1" style="background:{C['od']}">
  <div class="abs hl" style="left:80px;top:90px;font-size:64px;color:{C['nu']}">White spots.<br><b>Gone in one visit.</b></div>
  {zshot(80, 290, 452, 452, 'icon-c5-before.jpg', 'Before', 50, 45, 1.15, dark=False)}
  {zshot(548, 290, 452, 452, 'icon-c5-after.jpg', 'After', 50, 45, 1.15, dark=False)}
  <div class="abs body" style="left:80px;top:775px;width:900px;font-size:26px;color:{C['be']}">ICON treatment only. No drilling, no needles. From £395.</div>
  <div class="abs" style="left:80px;top:830px">{real(C['be'],17)}</div>
  {foot(C['be'], CTA_FREE, 'light')}
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s1" id="I2" data-name="ICON | Static | Case 3 long-standing mark | 1x1" style="background:{C['nu']}">
  <div class="cover" style="background:radial-gradient(ellipse at 50% 50%,#f7f3ee 0%,{C['nu']} 45%,#d8cbbf 100%)"></div>
  <div class="abs hl" style="left:80px;top:90px;font-size:58px;color:{C['od']}">The mark you&rsquo;ve<br>had for <b>years.</b></div>
  {zshot(80, 270, 920, 250, 'icon-c3-before.jpg', 'Before', 50, 52, 1.0)}
  {zshot(80, 532, 920, 250, 'icon-c3-after.jpg', 'After', 50, 50, 1.0)}
  <div class="abs body" style="left:80px;top:805px;width:900px;font-size:24px;color:{C['ol']}">ICON, Enlighten whitening and a touch of bonding, planned together.</div>
  <div class="abs" style="left:80px;top:860px">{real(C['br'],17)}</div>
  {foot(C['ol'], CTA_FREE, 'dark')}
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s1" id="I3" data-name="ICON | Static | Case 9 no drilling | 1x1" style="background:{C['be']}">
  <div class="cover" style="background:radial-gradient(circle at 70% 25%,#f1e9e1 0%,{C['be']} 48%,#d2c2b2 100%)"></div>
  {zshot(80, 80, 600, 400, 'icon-c9-before.jpg', 'Before', 50, 50, 1.1, dark=False)}
  {zshot(80, 492, 600, 400, 'icon-c9-after.jpg', 'After', 50, 50, 1.1, dark=False)}
  <div class="abs hl" style="left:720px;top:90px;font-size:50px;color:{C['bo']}">No<br>drilling.<br>No<br>needles.<br><b>No spots.</b></div>
  <div class="abs body" style="left:720px;top:470px;width:290px;font-size:22px;color:{C['ol']}">ICON fills the marked enamel with resin, so the spot blends in. Here with whitening.</div>
  <div class="abs" style="left:720px;top:720px;width:290px">{real(C['br'],16)}</div>
  <div class="abs" style="left:720px;top:900px;width:180px;color:{C['ol']}">{LOGO}</div>
  <div class="abs" style="left:80px;top:965px"><span class="cta dark" style="height:60px;font-size:17px;padding:0 30px">{CTA_FREE}</span></div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s1" id="B1" data-name="B&amp;A | Static | Bonding same teeth | 1x1" style="background:{C['be']}">
  <div class="cover" style="background:radial-gradient(circle at 50% 45%,#f1e9e1 0%,{C['be']} 48%,#d2c2b2 100%)"></div>
  <div class="abs hl" style="left:80px;top:90px;font-size:64px;color:{C['od']}">Same teeth.<br><b>Better shape.</b></div>
  {zshot(80, 290, 452, 452, 'cb06-before.jpg', 'Before', 50, 55, 1.25, dark=False)}
  {zshot(548, 290, 452, 452, 'cb06-after.jpg', 'After', 50, 55, 1.25, dark=False)}
  <div class="abs body" style="left:80px;top:775px;width:900px;font-size:26px;color:{C['ol']}">Composite bonding. No drilling, usually one visit. From £250 a tooth.</div>
  <div class="abs" style="left:80px;top:830px">{real(C['br'],17)}</div>
  {foot(C['ol'], CTA_FREE, 'dark')}
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s1" id="B2" data-name="B&amp;A | Static | Aligners orthodontist-led | 1x1" style="background:{C['od']}">
  <div class="abs hl" style="left:80px;top:90px;font-size:58px;color:{C['nu']}">Straighter teeth,<br><b>planned by an orthodontist.</b></div>
  {zshot(80, 290, 452, 452, 'al02-before.jpg', 'Before', 50, 50, 1.2, dark=False)}
  {zshot(548, 290, 452, 452, 'al02-after.jpg', 'After', 50, 50, 1.2, dark=False)}
  <div class="abs body" style="left:80px;top:775px;width:900px;font-size:26px;color:{C['be']}">Clear aligners. Predictable, with no never-ending adjustments.</div>
  <div class="abs" style="left:80px;top:830px">{real(C['be'],17)}</div>
  {foot(C['be'], CTA_FREE, 'light')}
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s1" id="B3" data-name="B&amp;A | Static | Smile makeover whiten and bond | 1x1" style="background:{C['nu']}">
  <div class="cover" style="background:radial-gradient(ellipse at 50% 50%,#f7f3ee 0%,{C['nu']} 45%,#d8cbbf 100%)"></div>
  <div class="abs hl" style="left:80px;top:90px;font-size:58px;color:{C['bo']}">Whitening, then<br>bonding. <b>One plan.</b></div>
  {zshot(80, 270, 920, 250, 'cb21-before.jpg', 'Before', 50, 55, 1.0)}
  {zshot(80, 532, 920, 250, 'cb21-after.jpg', 'After', 50, 55, 1.0)}
  <div class="abs body" style="left:80px;top:805px;width:900px;font-size:24px;color:{C['ol']}">0% finance over up to 12 months on treatments over £300.</div>
  <div class="abs" style="left:80px;top:860px">{real(C['br'],17)}</div>
  {foot(C['ol'], CTA_FREE, 'dark')}
  <div class="grain"></div>
</div>""")
    return page("Siha | Cases | 1x1", b)


def cases_9x16():
    def stack(id_, name, bg, head, before, after, body, light, cx=50, cy=50, zoom=1.0, extra=""):
        tc, sc, kind = (C['nu'], C['be'], 'light') if light else (C['od'], C['ol'], 'dark')
        cover = "" if light else f'<div class="cover" style="background:radial-gradient(ellipse at 50% 45%,#f7f3ee 0%,{bg} 46%,#d6c8bb 100%)"></div>'
        return f"""
<div class="ab s9" id="{id_}" data-name="{name} | 9x16" style="background:{bg}">
  {cover}
  <div class="abs hl" style="left:90px;top:240px;font-size:78px;color:{C['bo'] if not light else tc}">{head}</div>
  {zshot(90, 520, 900, 420, before, 'Before', cx, cy, zoom, dark=not light)}
  {zshot(90, 956, 900, 420, after, 'After', cx, cy, zoom, dark=not light)}
  <div class="abs body" style="left:90px;top:1395px;width:900px;font-size:30px;color:{sc}">{body}</div>
  <div class="abs" style="left:90px;top:1448px">{real(sc,20)}</div>
  {foot(sc, CTA_FREE, kind, nine=True, logo_y=1520)}
  <div class="grain"></div>
</div>"""
    b = [
        stack("I1s", "ICON | Static | Case 5 spots gone", C['od'], "White spots.<br><b>Gone in one visit.</b>", 'icon-c5-before.jpg', 'icon-c5-after.jpg',
              "ICON only. No drilling, no needles. From £395.", True, 50, 45, 1.15),
        stack("I2s", "ICON | Static | Case 3 long-standing mark", C['nu'], "The mark you&rsquo;ve<br>had for <b>years.</b>", 'icon-c3-before.jpg', 'icon-c3-after.jpg',
              "ICON, Enlighten whitening and a touch of bonding.", False, 50, 52, 1.0),
        stack("I3s", "ICON | Static | Case 9 no drilling", C['be'], "No drilling. No needles.<br><b>No spots.</b>", 'icon-c9-before.jpg', 'icon-c9-after.jpg',
              "ICON with whitening. The spot blends into the tooth.", False, 50, 50, 1.1),
        stack("B1s", "B&amp;A | Static | Bonding same teeth", C['be'], "Same teeth.<br><b>Better shape.</b>", 'cb06-before.jpg', 'cb06-after.jpg',
              "Composite bonding. No drilling. From £250 a tooth.", False, 50, 55, 1.2),
        stack("B2s", "B&amp;A | Static | Aligners orthodontist-led", C['od'], "Straighter teeth,<br><b>planned by an<br>orthodontist.</b>", 'al02-before.jpg', 'al02-after.jpg',
              "Clear aligners. Predictable, no never-ending adjustments.", True, 50, 50, 1.15),
        stack("B3s", "B&amp;A | Static | Smile makeover whiten and bond", C['nu'], "Whitening, then<br>bonding. <b>One plan.</b>", 'cb21-before.jpg', 'cb21-after.jpg',
              "0% finance over up to 12 months on treatments over £300.", False, 50, 55, 1.0),
    ]
    return page("Siha | Cases | 9x16", b)


if __name__ == "__main__":
    for name, fn in [("membership-1x1", membership_1x1), ("membership-9x16", membership_9x16),
                     ("cases-1x1", cases_1x1), ("cases-9x16", cases_9x16)]:
        (ROOT / f"{name}.html").write_text(fn())
    print("built")
