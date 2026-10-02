"""Build Oxford House Clear Aligner Open Day Meta statics (one HTML page per size).

Usage: python3 build.py  -> writes open-day-1x1.html and open-day-9x16.html
Brand: taken from the live open day page (lp.mkdentist.co.uk/clear-aligner-open-day/).
Fonts: Josefin Sans (headlines) + Poppins (body), both Google fonts.
Copy: copy-open-day.md. Research: research.md.
"""
import struct
from pathlib import Path

ROOT = Path(__file__).parent
A = ROOT / "assets"
DATE = "261002"

C = dict(deep="#06444b", ink="#1e2b2d", teal="#0f717a", bright="#14b1bf", gold="#bfa15c",
         mist="#e4eff0", mist2="#eef6f6", line="#d6e6e7", wh="#ffffff", paper="#fbfaf7")

GRAIN = ("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>"
         "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.9 0'/></filter>"
         "<rect width='100%' height='100%' filter='url(%23n)'/></svg>")

FONTS = ("<link rel='preconnect' href='https://fonts.googleapis.com'><link rel='preconnect' href='https://fonts.gstatic.com' crossorigin>"
         "<link href='https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@400;600;700&family=Poppins:wght@400;500;600&display=swap' rel='stylesheet'>")

CSS = f"""
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ background: #2a2a2a; font-family: Poppins, sans-serif; display: flex; gap: 80px; padding: 80px; align-items: flex-start; }}
.ab {{ position: relative; overflow: hidden; flex: none; color: {C['ink']}; }}
.s1 {{ width: 1080px; height: 1080px; }}
.s9 {{ width: 1080px; height: 1920px; }}
.abs {{ position: absolute; }}
.cover {{ position: absolute; inset: 0; background-size: cover; background-position: center; }}
.grain {{ position: absolute; inset: 0; background-image: url("{GRAIN}"); opacity: .12; mix-blend-mode: overlay; pointer-events: none; }}
.jo {{ font-family: 'Josefin Sans', sans-serif; }}
.eyebrow {{ font-family: 'Josefin Sans', sans-serif; font-size: 24px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }}
.hl {{ font-family: 'Josefin Sans', sans-serif; font-weight: 700; line-height: 1.02; letter-spacing: -.005em; }}
.body {{ font-size: 30px; font-weight: 400; line-height: 1.45; }}
.cta {{ display: inline-flex; align-items: center; gap: 14px; height: 78px; padding: 0 44px; border-radius: 10px; font-family: 'Josefin Sans', sans-serif;
        font-size: 26px; font-weight: 700; letter-spacing: .02em; padding-top: 4px; box-shadow: 0 14px 30px rgba(6,68,75,.28); }}
.cta.teal {{ background: {C['bright']}; color: {C['wh']}; }}
.cta.gold {{ background: {C['gold']}; color: {C['wh']}; }}
.cta.white {{ background: {C['wh']}; color: {C['deep']}; }}
.logo {{ display: block; width: 100%; height: auto; }}
.pill {{ display: inline-flex; align-items: center; gap: 12px; height: 54px; padding: 4px 26px 0; border-radius: 999px; font-family: 'Josefin Sans', sans-serif;
         font-size: 22px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }}
.small {{ font-size: 21px; font-weight: 500; }}
"""

STAR = '<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="currentColor"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>'
TICK = ('<svg viewBox="0 0 24 24" width="{s}" height="{s}"><circle cx="12" cy="12" r="11" fill="{bg}"/>'
        '<path d="M7 12.4l3.3 3.3L17.2 8.8" fill="none" stroke="{fg}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>')
ARROW = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
CTA = f"Book your free consultation"


def logo(w, mono=False):
    src = "assets/logo-mono.png" if mono else "assets/logo.png"
    return f'<img class="logo" src="{src}" style="width:{w}px">'


def cta(kind="teal", size=1.0):
    st = "" if size == 1.0 else f"height:{int(78*size)}px;font-size:{int(26*size)}px;padding:{int(4*size)}px {int(44*size)}px 0"
    return f'<span class="cta {kind}" style="{st}">{CTA} {ARROW}</span>'


def proof(color, size=22):
    stars = "".join(STAR.format(s=size) for _ in range(5))
    return (f'<div style="display:flex;align-items:center;gap:14px;color:{color}">'
            f'<span style="display:flex;gap:3px;color:{C["gold"]}">{stars}</span>'
            f'<span class="small" style="font-size:{size}px">4.8 from 956 Google reviews</span></div>')


def date_pill(bg, fg, size=1.0):
    return (f'<span class="pill" style="background:{bg};color:{fg};height:{int(54*size)}px;font-size:{int(22*size)}px">'
            f'Clear Aligner Open Day &middot; Sat 7 November</span>')


def photo_aspect(img):
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


def photo(x, y, w, h, img, fx=0.5, fy=0.35, zoom=1.0, radius=0, extra=""):
    """Photo cover-cropped into a box from its real aspect (never stretched)."""
    a = photo_aspect(img)
    bw, bh = (w, w / a) if w / h > a else (h * a, h)
    bw, bh = bw * zoom, bh * zoom
    ox, oy = -(bw - w) * fx, -(bh - h) * fy
    return (f'<div class="abs" data-name="Photo" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;overflow:hidden;border-radius:{radius}px;'
            f'background-image:url(assets/photos/{img});background-size:{bw:.0f}px {bh:.0f}px;background-position:{ox:.0f}px {oy:.0f}px;{extra}"></div>')


def price_list(x, y, w, scale=1.0):
    """Same price, whatever the problem: the fixed-price mechanism as a list."""
    rows = ["Crowded teeth", "Gaps", "Crooked or uneven", "Complex cases"]
    r = []
    for i, t in enumerate(rows):
        border = f"border-top:1px solid {C['line']};" if i else ""
        r.append(f'<div style="display:flex;justify-content:space-between;align-items:center;padding:{int(20*scale)}px 0;{border}">'
                 f'<span style="display:flex;align-items:center;gap:{int(16*scale)}px;font-size:{int(27*scale)}px;color:{C["ink"]}">'
                 f'{TICK.format(s=int(30*scale), bg=C["gold"], fg=C["wh"])}{t}</span>'
                 f'<span class="jo" style="font-size:{int(32*scale)}px;font-weight:700;color:{C["teal"]};padding-top:{int(4*scale)}px">£3,495</span></div>')
    return (f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px;padding:{int(30*scale)}px {int(40*scale)}px;background:{C["paper"]};border-radius:{int(14*scale)}px;'
            f'transform:rotate(1.4deg);box-shadow:0 34px 70px rgba(0,0,0,.38),0 6px 16px rgba(0,0,0,.2)">'
            f'<div class="eyebrow" style="font-size:{int(17*scale)}px;color:{C["gold"]};margin-bottom:{int(6*scale)}px">Your open day price</div>'
            f'{"".join(r)}</div>')


RECEIPT = [("32Co clear aligners", "Fixed £3,495", "usually £3,995"),
           ("Consultation", "Free", "worth £85"),
           ("Digital scan", "Free", "worth £100"),
           ("Teeth whitening", "Free", "worth £399"),
           ("Retainers", "Free", "worth £315"),
           ("Hygiene appointment", "Free", "worth £110")]


def receipt(x, y, w, scale=1.0, rot=-1.3):
    r = []
    for i, (item, val, note) in enumerate(RECEIPT):
        border = f"border-top:1px dashed #c9d9da;" if i else ""
        r.append(f'<div style="display:flex;justify-content:space-between;align-items:center;padding:{int(17*scale)}px 0;{border}">'
                 f'<span style="display:flex;align-items:center;gap:{int(14*scale)}px;font-size:{int(26*scale)}px;color:{C["ink"]}">'
                 f'{TICK.format(s=int(28*scale), bg=C["bright"], fg=C["wh"])}{item}</span>'
                 f'<span style="text-align:right;line-height:1.15"><span class="jo" style="display:block;font-size:{int(29*scale)}px;font-weight:700;color:{C["deep"]}">{val}</span>'
                 f'<span style="font-size:{int(17*scale)}px;color:#6b7f81">{note}</span></span></div>')
    total = (f'<div style="display:flex;justify-content:space-between;align-items:center;margin-top:{int(10*scale)}px;padding:{int(22*scale)}px {int(26*scale)}px {int(16*scale)}px;'
             f'background:{C["deep"]};border-radius:{int(10*scale)}px;color:{C["wh"]}">'
             f'<span class="eyebrow" style="font-size:{int(19*scale)}px;color:{C["gold"]}">Total open day saving</span>'
             f'<span class="jo" style="font-size:{int(44*scale)}px;font-weight:700">£1,509</span></div>')
    return (f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px;padding:{int(34*scale)}px {int(40*scale)}px {int(36*scale)}px;background:{C["paper"]};border-radius:{int(12*scale)}px;'
            f'transform:rotate({rot}deg);box-shadow:0 40px 80px rgba(6,68,75,.30),0 8px 18px rgba(6,68,75,.16)">'
            f'<div class="eyebrow" style="font-size:{int(17*scale)}px;color:{C["teal"]};margin-bottom:{int(4*scale)}px">Your open day package</div>'
            f'{"".join(r)}{total}'
            f'<div style="font-size:{int(16*scale)}px;color:#6b7f81;margin-top:{int(14*scale)}px">Whitening, retainers and hygiene included when you start treatment.</div></div>')


def answer_card(x, y, w, scale=1.0, rot=-1.5):
    return (f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px;padding:{int(48*scale)}px {int(54*scale)}px;background:{C["paper"]};border-radius:{int(10*scale)}px;'
            f'transform:rotate({rot}deg);box-shadow:0 34px 70px rgba(0,0,0,.45),0 6px 16px rgba(0,0,0,.25)">'
            f'<div class="eyebrow" style="font-size:{int(18*scale)}px;color:{C["teal"]};margin-bottom:{int(20*scale)}px">The honest answer</div>'
            f'<div class="body" style="font-size:{int(30*scale)}px;color:{C["ink"]}">Teeth naturally try to drift. Retainers help hold them where your aligners put them.</div>'
            f'<div style="margin-top:{int(26*scale)}px;padding-top:{int(24*scale)}px;border-top:1px solid {C["line"]};display:flex;align-items:center;gap:{int(18*scale)}px">'
            f'{TICK.format(s=int(40*scale), bg=C["gold"], fg=C["wh"])}'
            f'<span class="jo" style="font-size:{int(30*scale)}px;font-weight:700;color:{C["deep"]};padding-top:{int(4*scale)}px">Retainers included at our open day. Worth £315.</span></div></div>')


def calendar(x, y, w, scale=1.0, rot=2.5):
    return (f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px;border-radius:{int(18*scale)}px;overflow:hidden;background:{C["paper"]};text-align:center;'
            f'transform:rotate({rot}deg);box-shadow:0 34px 70px rgba(0,0,0,.4),0 6px 16px rgba(0,0,0,.22)">'
            f'<div class="eyebrow" style="background:{C["bright"]};color:{C["wh"]};font-size:{int(26*scale)}px;padding:{int(20*scale)}px 0 {int(14*scale)}px">Saturday</div>'
            f'<div class="jo" style="font-size:{int(190*scale)}px;font-weight:700;line-height:1;color:{C["deep"]};padding-top:{int(30*scale)}px">7</div>'
            f'<div class="eyebrow" style="font-size:{int(30*scale)}px;color:{C["gold"]};padding:{int(4*scale)}px 0 {int(26*scale)}px">November</div></div>')


def chips(items, scale=1.0, dark=True):
    bg, fg = (C["wh"], C["deep"]) if dark else (C["deep"], C["wh"])
    return "".join(f'<span class="pill" style="background:{bg};color:{fg};height:{int(52*scale)}px;font-size:{int(20*scale)}px;margin:0 {int(10*scale)}px {int(12*scale)}px 0">{t}</span>' for t in items)


def avatar(x, y, d):
    return (f'<div class="abs" data-name="Photo" style="left:{x}px;top:{y}px;width:{d}px;height:{d}px;border-radius:50%;border:5px solid {C["wh"]};'
            f'background:url(assets/photos/Syed-Photo-424x500-1.webp) 50% 18%/cover;box-shadow:0 14px 30px rgba(0,0,0,.35)"></div>')


def note_card(x, y, w, text, scale=1.0, rot=-1.2):
    return (f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px;padding:{int(30*scale)}px {int(38*scale)}px {int(26*scale)}px;background:{C["wh"]};border-radius:{int(18*scale)}px;'
            f'transform:rotate({rot}deg);box-shadow:0 26px 60px rgba(0,0,0,.35)">'
            f'<div class="hl" style="font-size:{int(54*scale)}px;color:{C["ink"]}">{text}</div></div>')


def name(concept, talent, detail, size):
    return f"{concept} | Static | {talent} | {detail} | {size} | {DATE}"


def page(title, boards):
    return (f"<!doctype html><html lang='en-GB'><head><meta charset='utf-8'><title>{title}</title>{FONTS}"
            f"<style>{CSS}</style><script src='https://mcp.figma.com/mcp/html-to-design/capture.js' async></script></head><body>{''.join(boards)}</body></html>")


# ------------------------------------------------------------------ 1:1
def od_1x1():
    b = []
    # OD1 complex case, same price
    b.append(f"""
<div class="ab s1" id="OD1" data-name="{name('Open Day', 'None', 'Complex case same price', '1x1')}" style="background:{C['deep']}">
  {photo(560, 0, 520, 1080, 'sign-top.jpg', fx=0.3, fy=0.3, extra='opacity:.55')}
  <div class="cover" data-name="Overlay (locked)" style="background:linear-gradient(90deg,{C['deep']} 0%,{C['deep']} 48%,rgba(6,68,75,.55) 75%,rgba(6,68,75,.35) 100%)"></div>
  <div class="cover" data-name="Overlay (locked)" style="background:radial-gradient(circle at 20% 15%,rgba(20,177,191,.28),transparent 55%)"></div>
  <div class="abs" style="left:72px;top:72px">{date_pill(C['gold'], C['wh'])}</div>
  <div class="abs hl" style="left:72px;top:178px;font-size:64px;color:{C['wh']}">Crowded. Crooked.<br>Complicated.</div>
  <div class="abs hl" style="left:72px;top:330px;font-size:64px;color:{C['gold']}">One fixed price.</div>
  <div class="abs body" style="left:72px;top:440px;width:460px;font-size:27px;color:#d6e6e7">32Co clear aligners for <b style="color:#fff">£3,495</b>, however complex your case. A comprehensive case is usually £3,995.</div>
  {price_list(548, 400, 470, 0.88)}
  <div class="abs" style="left:72px;top:735px">{proof('#d6e6e7')}</div>
  <div class="abs" style="left:72px;top:840px">{cta('teal')}</div>
  <div class="abs" style="left:790px;top:965px;width:220px">{logo(220, mono=True)}</div>
  <div class="grain" data-name="Grain (locked)"></div>
</div>""")
    # OD2 closed-lip photos (native video still)
    b.append(f"""
<div class="ab s1" id="OD2" data-name="{name('Open Day', 'Dr Syed', 'Closed-lip photos', '1x1')}" style="background:{C['ink']}">
  {photo(0, 0, 1080, 1080, 'syed-talk-clean.jpg', fx=0.5, fy=0.05, zoom=1.08)}
  <div class="cover" data-name="Overlay (locked)" style="background:linear-gradient(180deg,rgba(30,43,45,0) 62%,rgba(30,43,45,.55) 100%)"></div>
  {note_card(56, 40, 600, 'Still smiling with your lips closed in every photo?', scale=0.86, rot=-1.2)}
  <div class="abs" style="left:90px;top:815px;width:900px;text-align:center;font-weight:600;font-size:34px;line-height:1.3;color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.6)">No more hiding, no more closed-lip photos.</div>
  <div class="abs" style="left:0;top:960px;width:1080px;height:120px;background:{C['deep']};display:flex;align-items:center;justify-content:space-between;padding:0 48px">
    <div><div class="eyebrow" style="font-size:20px;color:{C['gold']}">Clear Aligner Open Day</div>
    <div class="jo" style="font-size:30px;font-weight:700;color:#fff;margin-top:4px">Sat 7 November &middot; Fixed £3,495</div></div>
    {cta('teal', 0.78)}
  </div>
  <div class="grain" data-name="Grain (locked)"></div>
</div>""")
    # OD3 receipt
    b.append(f"""
<div class="ab s1" id="OD3" data-name="{name('Open Day', 'None', 'Package receipt', '1x1')}" style="background:{C['mist']}">
  {photo(0, 0, 1080, 1080, 'reception-top.jpg', fx=0.5, fy=0.25, extra='filter:blur(6px);transform:scale(1.04)')}
  <div class="cover" data-name="Overlay (locked)" style="background:linear-gradient(90deg,rgba(228,239,240,.97) 0%,rgba(228,239,240,.93) 45%,rgba(228,239,240,.6) 100%)"></div>
  <div class="abs eyebrow" style="left:72px;top:84px;width:380px;color:{C['teal']}">Clear Aligner<br>Open Day</div>
  <div class="abs hl" style="left:72px;top:170px;font-size:118px;color:{C['deep']}">Save<br><span style="color:{C['bright']}">£1,509</span></div>
  <div class="abs body" style="left:72px;top:420px;width:380px;font-size:28px;color:{C['ink']}">Everything a straighter smile needs, in one fixed price.</div>
  <div class="abs" style="left:72px;top:600px"><span class="pill" style="background:{C['deep']};color:#fff">Sat 7 November</span></div>
  <div class="abs body" style="left:72px;top:672px;width:380px;font-size:22px;color:#4a5d60">Oxford House, Fenny Stratford, Milton Keynes</div>
  {receipt(476, 64, 540, 0.86)}
  <div class="abs" style="left:72px;top:840px">{cta('teal')}</div>
  <div class="abs" style="left:72px;top:960px;width:230px">{logo(230)}</div>
  <div class="abs" style="left:650px;top:990px">{proof(C['ink'], 20)}</div>
  <div class="grain" data-name="Grain (locked)"></div>
</div>""")
    # OD4 won't my teeth move back
    b.append(f"""
<div class="ab s1" id="OD4" data-name="{name('Open Day', 'None', 'Teeth move back', '1x1')}" style="background:{C['ink']}">
  {photo(0, 0, 1080, 1080, 'surgery-top.jpg', fx=0.5, fy=0.2, extra='opacity:.45')}
  <div class="cover" data-name="Overlay (locked)" style="background:linear-gradient(180deg,rgba(6,68,75,.92) 0%,rgba(6,68,75,.82) 40%,{C['deep']} 75%)"></div>
  <div class="abs hl" style="left:72px;top:92px;width:900px;font-size:78px;color:{C['wh']}">&ldquo;Won&rsquo;t my teeth just <span style="color:{C['gold']}">move back?</span>&rdquo;</div>
  {answer_card(90, 340, 860, 0.98)}
  <div class="abs" style="left:72px;top:820px">{date_pill(C['gold'], C['wh'], 0.9)}</div>
  <div class="abs" style="left:72px;top:925px">{cta('teal', 0.85)}</div>
  <div class="abs" style="left:800px;top:960px;width:210px">{logo(210, mono=True)}</div>
  <div class="grain" data-name="Grain (locked)"></div>
</div>""")
    # OD5 one Saturday
    b.append(f"""
<div class="ab s1" id="OD5" data-name="{name('Open Day', 'Dr Syed', 'Put it off', '1x1')}" style="background:{C['deep']}">
  {photo(470, 0, 610, 1080, 'syed-look-clean.jpg', fx=0.62, fy=0.0)}
  <div class="cover" data-name="Overlay (locked)" style="background:linear-gradient(90deg,{C['deep']} 0%,{C['deep']} 44%,rgba(6,68,75,.55) 58%,rgba(6,68,75,0) 72%)"></div>
  <div class="cover" data-name="Overlay (locked)" style="background:linear-gradient(180deg,rgba(6,68,75,0) 70%,rgba(6,68,75,.85) 100%)"></div>
  {calendar(72, 80, 210, 0.85, -3)}
  <div class="abs hl" style="left:72px;top:420px;font-size:78px;color:{C['wh']}">Put it off<br><span style="color:{C['gold']}">long<br>enough?</span></div>
  <div class="abs" style="left:72px;top:720px;width:470px">
    <div class="jo" style="font-size:29px;font-weight:700;color:#fff;line-height:1.2">Clear Aligner Open Day with Dr Syed Hussain</div>
    <div style="font-size:22px;color:#d6e6e7;margin-top:10px">Fixed £3,495 &middot; Save £1,509<br>Limited appointments</div>
  </div>
  <div class="abs" style="left:72px;top:935px">{cta('teal', 0.85)}</div>
  <div class="abs" style="left:800px;top:975px;width:210px">{logo(210, mono=True)}</div>
  <div class="grain" data-name="Grain (locked)"></div>
</div>""")
    return page("Oxford House | Open Day | 1x1", b)


# ------------------------------------------------------------------ 9:16 (keep key copy out of the top 250px and bottom 340px)
def od_9x16():
    b = []
    b.append(f"""
<div class="ab s9" id="OD1s" data-name="{name('Open Day', 'None', 'Complex case same price', '9x16')}" style="background:{C['deep']}">
  {photo(0, 0, 1080, 760, 'sign-top.jpg', fx=0.5, fy=0.5, extra='opacity:.6')}
  <div class="cover" data-name="Overlay (locked)" style="background:linear-gradient(180deg,rgba(6,68,75,.2) 0%,rgba(6,68,75,.75) 28%,{C['deep']} 42%)"></div>
  <div class="abs" style="left:80px;top:290px">{date_pill(C['gold'], C['wh'])}</div>
  <div class="abs hl" style="left:80px;top:390px;font-size:84px;color:{C['wh']}">Crowded. Crooked.<br>Complicated.<br><span style="color:{C['gold']}">One fixed price.</span></div>
  <div class="abs body" style="left:80px;top:690px;width:900px;font-size:31px;color:#d6e6e7">32Co clear aligners for <b style="color:#fff">£3,495</b>, however complex your case. A comprehensive case is usually £3,995.</div>
  {price_list(110, 880, 860, 1.25)}
  <div class="abs" style="left:80px;top:1400px">{cta('teal')}</div>
  <div class="abs" style="left:80px;top:1505px">{proof('#d6e6e7')}</div>
  <div class="abs" style="left:780px;top:1490px;width:220px">{logo(220, mono=True)}</div>
  <div class="grain" data-name="Grain (locked)"></div>
</div>""")
    b.append(f"""
<div class="ab s9" id="OD2s" data-name="{name('Open Day', 'Dr Syed', 'Closed-lip photos', '9x16')}" style="background:{C['ink']}">
  {photo(0, 0, 1080, 1920, 'syed-talk-clean.jpg', fx=0.5, fy=0.5)}
  <div class="cover" data-name="Overlay (locked)" style="background:linear-gradient(180deg,rgba(30,43,45,0) 55%,rgba(30,43,45,.6) 80%,rgba(30,43,45,.85) 100%)"></div>
  {note_card(80, 880, 860, 'Still smiling with your lips closed in every photo?', scale=0.98, rot=-1.4)}
  <div class="abs" style="left:60px;top:1300px;width:960px;height:110px;padding:0 30px 0 40px;background:{C['deep']};border-radius:16px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 26px 60px rgba(0,0,0,.4)">
    <div><div class="eyebrow" style="font-size:18px;color:{C['gold']}">Open Day &middot; Sat 7 Nov</div>
    <div class="jo" style="font-size:30px;font-weight:700;color:#fff;margin-top:4px">Fixed £3,495</div></div>
    {cta('teal', 0.8)}
  </div>
  <div class="grain" data-name="Grain (locked)"></div>
</div>""")
    b.append(f"""
<div class="ab s9" id="OD3s" data-name="{name('Open Day', 'None', 'Package receipt', '9x16')}" style="background:{C['mist']}">
  {photo(0, 0, 1080, 1920, 'reception-top.jpg', fx=0.5, fy=0.3, extra='filter:blur(7px);transform:scale(1.04)')}
  <div class="cover" data-name="Overlay (locked)" style="background:rgba(228,239,240,.9)"></div>
  <div class="abs eyebrow" style="left:80px;top:290px;color:{C['teal']}">Clear Aligner Open Day &middot; Sat 7 November</div>
  <div class="abs hl" style="left:80px;top:345px;font-size:150px;color:{C['deep']}">Save <span style="color:{C['bright']}">£1,509</span></div>
  <div class="abs body" style="left:80px;top:520px;width:880px;font-size:32px;color:{C['ink']}">Everything a straighter smile needs, in one fixed price.</div>
  {receipt(110, 630, 860, 1.06, rot=-1.1)}
  <div class="abs" style="left:80px;top:1470px">{cta('teal')}</div>
  <div class="abs" style="left:770px;top:1478px;width:230px">{logo(230)}</div>
  <div class="grain" data-name="Grain (locked)"></div>
</div>""")
    b.append(f"""
<div class="ab s9" id="OD4s" data-name="{name('Open Day', 'None', 'Teeth move back', '9x16')}" style="background:{C['ink']}">
  {photo(0, 0, 1080, 1920, 'surgery-top.jpg', fx=0.5, fy=0.3, extra='opacity:.45')}
  <div class="cover" data-name="Overlay (locked)" style="background:linear-gradient(180deg,rgba(6,68,75,.9) 0%,rgba(6,68,75,.82) 40%,{C['deep']} 70%)"></div>
  <div class="abs hl" style="left:80px;top:300px;width:920px;font-size:96px;color:{C['wh']}">&ldquo;Won&rsquo;t my teeth just <span style="color:{C['gold']}">move back?</span>&rdquo;</div>
  {answer_card(90, 720, 900, 1.12)}
  <div class="abs" style="left:80px;top:1300px">{date_pill(C['gold'], C['wh'])}</div>
  <div class="abs" style="left:80px;top:1400px">{cta('teal')}</div>
  <div class="abs" style="left:780px;top:1500px;width:220px">{logo(220, mono=True)}</div>
  <div class="grain" data-name="Grain (locked)"></div>
</div>""")
    b.append(f"""
<div class="ab s9" id="OD5s" data-name="{name('Open Day', 'Dr Syed', 'Put it off', '9x16')}" style="background:{C['deep']}">
  {photo(0, 0, 1080, 1150, 'syed-look-clean.jpg', fx=0.75, fy=0.55, zoom=1.22)}
  <div class="cover" data-name="Overlay (locked)" style="background:linear-gradient(180deg,rgba(6,68,75,0) 35%,rgba(6,68,75,.75) 52%,{C['deep']} 60%)"></div>
  {calendar(700, 300, 300, 1.15, 3)}
  <div class="abs hl" style="left:80px;top:1000px;font-size:104px;color:{C['wh']}">Put it off<br><span style="color:{C['gold']}">long enough?</span></div>
  <div class="abs" style="left:80px;top:1270px;width:920px">
    <div class="jo" style="font-size:34px;font-weight:700;color:#fff">Clear Aligner Open Day with Dr Syed Hussain</div>
    <div style="font-size:25px;color:#d6e6e7;margin-top:6px">Fixed £3,495 &middot; Save £1,509 &middot; Limited appointments</div>
  </div>
  <div class="abs" style="left:80px;top:1450px">{cta('teal')}</div>
  <div class="grain" data-name="Grain (locked)"></div>
</div>""")
    return page("Oxford House | Open Day | 9x16", b)


if __name__ == "__main__":
    (ROOT / "open-day-1x1.html").write_text(od_1x1())
    (ROOT / "open-day-9x16.html").write_text(od_9x16())
    print("built")
