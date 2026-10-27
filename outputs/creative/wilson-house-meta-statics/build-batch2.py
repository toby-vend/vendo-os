"""Wilson House | General (new patient) Meta statics, batch 2 (27 Oct 2026): persona Denise (no NHS place).

Usage: python3 build-batch2.py  ->  denise-1x1.html, denise-9x16.html, denise-landscape.html
Copy and sources: copy-denise.md, research.md. Brand: Wilson House guideline (Figma IGQz4NTnCHwBgcouPheI90,
build_guideline.py): Purple / Aubergine / Cream / Lilac / Gold / Blush, Playfair Display headlines with an
italic turn, Montserrat body, pill buttons, crown watermark, arch frames with a Blush hairline. No gold stars
pattern (Toby, 20 Oct 2026).
Photos: real practice photography in assets/photos/web (gitignored). Every photo is cover-cropped from its real
aspect (read from the file header), never stretched.
"""
import struct
from pathlib import Path

HERE = Path(__file__).parent
WEB = HERE / 'assets/photos/web'

PURPLE, AUB, CREAM, LILAC, GOLD, BLUSH = '#722577', '#2A003A', '#F8F4EC', '#D4B8D6', '#BFA05C', '#E0C4AB'
ROYAL, INK, MUTE = '#4F026B', '#2A003A', '#6E5F72'
AUB_RGB = '42,0,58'

GRAIN = ("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>"
         "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.9 0'/></filter>"
         "<rect width='100%' height='100%' filter='url(%23n)'/></svg>")

CSS = f"""
@font-face {{ font-family: 'Playfair Display'; src: url(assets/fonts/PlayfairDisplay.ttf); font-weight: 400 900; }}
@font-face {{ font-family: 'Playfair Display'; src: url(assets/fonts/PlayfairDisplay-Italic.ttf); font-weight: 400 900; font-style: italic; }}
@font-face {{ font-family: Montserrat; src: url(assets/fonts/Montserrat.ttf); font-weight: 100 900; }}
@font-face {{ font-family: Montserrat; src: url(assets/fonts/Montserrat-Italic.ttf); font-weight: 100 900; font-style: italic; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ background: #2a2a2a; font-family: Montserrat, sans-serif; display: flex; gap: 80px; padding: 80px; align-items: flex-start; }}
.ab {{ position: relative; overflow: hidden; flex: none; color: {INK}; }}
.s1 {{ width: 1080px; height: 1080px; }}
.s9 {{ width: 1080px; height: 1920px; }}
.sl {{ width: 1200px; height: 628px; }}
.abs {{ position: absolute; }}
.fill {{ position: absolute; inset: 0; }}
.grain {{ position: absolute; inset: 0; background-image: url("{GRAIN}"); opacity: .12; mix-blend-mode: overlay; pointer-events: none; }}
.hl {{ font-family: 'Playfair Display', serif; font-weight: 600; line-height: 1.04; letter-spacing: -.005em; }}
.hl i {{ font-style: italic; font-weight: 500; }}
.eyebrow {{ font-weight: 700; font-size: 20px; letter-spacing: .2em; text-transform: uppercase; }}
.body {{ font-weight: 500; line-height: 1.4; }}
.cta {{ display: inline-flex; align-items: center; justify-content: center; border-radius: 100px; font-weight: 700; letter-spacing: .02em; white-space: nowrap; }}
.cta.lilac {{ background: {LILAC}; color: {AUB}; }}
.cta.royal {{ background: {ROYAL}; color: #fff; }}
.proof {{ display: flex; align-items: center; gap: 12px; font-weight: 600; }}
"""

CTA = 'Book Appointment'
STAR = '<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="{c}"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>'


def stars(size, color=GOLD):
    return f'<span style="display:flex;gap:3px">{"".join(STAR.format(s=size, c=color) for _ in range(5))}</span>'


def proof(color, size=22):
    """Volume proof. 'Rated Excellent' + 400+ is true on both counts on file (LP widget 428, guideline 454)."""
    return (f'<div class="proof" style="color:{color};font-size:{size}px">{stars(size + 2)}'
            f'<span>Rated Excellent &middot; 400+ Google reviews</span></div>')


def size_of(path):
    """(w, h) from a JPEG header."""
    data = path.read_bytes()
    i = 2
    while i < len(data):
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        seg = struct.unpack('>H', data[i + 2:i + 4])[0]
        if marker in (0xC0, 0xC1, 0xC2):
            h, w = struct.unpack('>HH', data[i + 5:i + 9])
            return w, h
        i += 2 + seg
    raise ValueError(path)


class Photo:
    """Cover-crop a photo into a box, with a focal point and zoom; maps source pixels to box pixels."""

    def __init__(self, name, w, h, fx=.5, fy=.5, zoom=1.0):
        self.name, self.w, self.h = name, w, h
        sw, sh = size_of(WEB / name)
        self.s = max(w / sw, h / sh) * zoom
        self.bw, self.bh = sw * self.s, sh * self.s
        self.ox, self.oy = -(self.bw - w) * fx, -(self.bh - h) * fy

    def css(self):
        return (f'background-image:url(assets/photos/web/{self.name});background-size:{self.bw:.0f}px {self.bh:.0f}px;'
                f'background-position:{self.ox:.0f}px {self.oy:.0f}px;background-repeat:no-repeat')

    def at(self, sx, sy):
        return self.ox + sx * self.s, self.oy + sy * self.s


def photo_div(p, x=0, y=0, extra='', name='Photo'):
    return f'<div class="abs" data-name="{name}" style="left:{x}px;top:{y}px;width:{p.w}px;height:{p.h}px;{p.css()};{extra}"></div>'


def logo(w, white=True, x=0, y=0):
    f = 'logo-white.png' if white else 'logo-colour.png'
    return f'<img data-name="Logo" class="abs" src="assets/{f}" style="left:{x}px;top:{y}px;width:{w}px">'


def page(title, boards):
    return (f"<!doctype html><html lang='en-GB'><head><meta charset='utf-8'><title>{title}</title>"
            f"<style>{CSS}</style><script src='https://mcp.figma.com/mcp/html-to-design/capture.js' async></script></head>"
            f"<body>{''.join(boards)}</body></html>")


def board(cls, bid, name, bg, inner):
    return f'<div class="ab {cls}" id="{bid}" data-name="{name}" style="background:{bg}">{inner}<div class="grain"></div></div>'


# ------------------------------------------------------------------ D1 | NHS waiting list (VT-02 Lifestyle lower third)
# Real practice photo (the Wilson House patient parking sign and gable), Aubergine scrim, lower-third headline + price.

def lower_third(fs):
    return (f'<div class="hl" style="font-size:{fs}px;color:{CREAM}">Still waiting for an <i style="color:{LILAC}">NHS place?</i></div>'
            f'<div class="body" style="font-size:{fs * .36:.0f}px;color:{CREAM};margin-top:{fs * .28:.0f}px">You don&rsquo;t have to wait to see a dentist in Newport Pagnell.</div>'
            f'<div style="display:flex;align-items:baseline;gap:{fs * .18:.0f}px;margin-top:{fs * .3:.0f}px;color:{CREAM}">'
            f'<span style="font-family:\'Playfair Display\',serif;font-style:italic;font-size:{fs * .5:.0f}px;color:{LILAC}">New patient check-up</span>'
            f'<span class="hl" style="font-size:{fs * .95:.0f}px;color:#fff">&pound;85</span>'
            f'<span class="body" style="font-size:{fs * .3:.0f}px;color:{LILAC}">X-rays included</span></div>')


def d1(size):
    if size == '1x1':
        p = Photo('gable-sign.jpg', 1080, 1080, fx=.55, fy=.3)
        inner = f"""{photo_div(p)}
<div class="fill" style="background:linear-gradient(180deg,rgba({AUB_RGB},.7) 0%,rgba({AUB_RGB},0) 26%,rgba({AUB_RGB},.15) 40%,rgba({AUB_RGB},.88) 66%,{AUB} 100%)"></div>
{logo(170, x=80, y=60)}
<div class="abs" style="left:80px;top:600px;width:920px">{lower_third(78)}</div>
<div class="abs" style="left:80px;top:950px;display:flex;align-items:center;gap:34px"><span class="cta lilac" style="height:74px;padding:0 44px;font-size:24px">{CTA}</span>{proof(CREAM, 19)}</div>"""
        return board('s1', 'D1-1', 'General | Static | Denise | NHS waiting list | 1x1 | 261027', AUB, inner)
    if size == '9x16':
        p = Photo('gable-sign.jpg', 1080, 1920, fx=.62, fy=.5)
        inner = f"""{photo_div(p)}
<div class="fill" style="background:linear-gradient(180deg,rgba({AUB_RGB},.75) 0%,rgba({AUB_RGB},.2) 20%,rgba({AUB_RGB},.1) 36%,rgba({AUB_RGB},.88) 54%,{AUB} 100%)"></div>
{logo(180, x=80, y=280)}
<div class="abs" style="left:80px;top:960px;width:940px">{lower_third(96)}</div>
<div class="abs" style="left:80px;top:1470px;display:flex;align-items:center;gap:36px"><span class="cta lilac" style="height:84px;padding:0 54px;font-size:28px">{CTA}</span>{proof(CREAM, 21)}</div>"""
        return board('s9', 'D1-9', 'General | Static | Denise | NHS waiting list | 9x16 | 261027', AUB, inner)
    p = Photo('gable-sign.jpg', 1200, 628, fx=.6, fy=.4)
    inner = f"""{photo_div(p)}
<div class="fill" style="background:linear-gradient(90deg,{AUB} 0%,rgba({AUB_RGB},.9) 42%,rgba({AUB_RGB},.2) 68%,rgba({AUB_RGB},0) 100%)"></div>
{logo(120, x=56, y=40)}
<div class="abs" style="left:56px;top:175px;width:640px">{lower_third(52)}</div>
<div class="abs" style="left:56px;top:520px;display:flex;align-items:center;gap:26px"><span class="cta lilac" style="height:58px;padding:0 32px;font-size:20px">{CTA}</span>{proof(CREAM, 15)}</div>"""
    return board('sl', 'D1-L', 'General | Static | Denise | NHS waiting list | 1.91x1 | 261027', AUB, inner)


# ------------------------------------------------------------------ D2 | The fee, written down (Custom: fee card in the nook)

def fee_card(w):
    """Printed fee card, design width w; height follows content. Crown, Playfair price, itemised inclusions."""
    k = w / 420
    items = ['Full examination', 'Digital X-rays', 'Gum health and oral cancer check', '3D scan of your teeth', 'Your personalised plan']
    rows = ''.join(
        f'<div style="display:flex;gap:{10 * k:.0f}px;align-items:flex-start;margin-top:{9 * k:.0f}px">'
        f'<img src="assets/crown-gold.png" style="width:{17 * k:.0f}px;margin-top:{4 * k:.0f}px;flex:none">'
        f'<span style="font-size:{17 * k:.1f}px;font-weight:500;color:{INK};line-height:1.3">{t}</span></div>' for t in items)
    return f"""
<div data-name="Fee card" style="width:{w}px;padding:{30 * k:.0f}px {32 * k:.0f}px {28 * k:.0f}px;background:linear-gradient(160deg,#fffdf9 0%,{CREAM} 70%,#efe8dc 100%);
  border-radius:{4 * k:.0f}px;box-shadow:inset 0 0 0 {1 * k:.1f}px rgba(176,148,123,.35)">
  <div style="border:{1 * k:.1f}px solid {BLUSH};padding:{22 * k:.0f}px {22 * k:.0f}px {20 * k:.0f}px;border-radius:{2 * k:.0f}px">
    <img src="assets/crown-rule-colour.png" style="display:block;width:{170 * k:.0f}px;margin:0 auto">
    <div style="text-align:center;font-size:{13 * k:.1f}px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:{PURPLE};margin-top:{16 * k:.0f}px">New patient check-up</div>
    <div class="hl" style="text-align:center;font-size:{104 * k:.0f}px;color:{AUB};line-height:1;margin-top:{6 * k:.0f}px">&pound;85</div>
    <div style="height:{1 * k:.1f}px;background:{BLUSH};margin:{14 * k:.0f}px 0 {6 * k:.0f}px"></div>
    {rows}
    <div style="text-align:center;font-family:'Playfair Display',serif;font-style:italic;font-size:{21 * k:.0f}px;color:{PURPLE};margin-top:{16 * k:.0f}px">No hidden fees</div>
  </div>
</div>"""


def propped_card(p, sx, sy, sw, rot=-3):
    """Fee card standing on the nook's side table. (sx, sy) is the card's bottom-left in source pixels, sw its
    width in source pixels. Contact shadow on the table top plus a soft cast shadow to the right."""
    x, y = p.at(sx, sy)
    w = sw * p.s
    card = fee_card(round(w))
    return f"""
<div class="abs" data-name="Contact shadow" style="left:{x - w * .05:.0f}px;top:{y - w * .05:.0f}px;width:{w * 1.25:.0f}px;height:{w * .12:.0f}px;border-radius:50%;
  background:radial-gradient(ellipse at 45% 50%,rgba(8,10,25,.7),rgba(8,10,25,0) 70%);filter:blur({w * .01:.0f}px)"></div>
<div class="abs" data-name="Card" style="left:{x:.0f}px;bottom:calc(100% - {y:.0f}px);transform:rotate({rot}deg);transform-origin:bottom left;
  filter:drop-shadow({w * .05:.0f}px {w * .03:.0f}px {w * .05:.0f}px rgba(20,12,30,.45)) drop-shadow(0 {w * .005:.0f}px {w * .01:.0f}px rgba(20,12,30,.35))">{card}</div>"""


def d2(size):
    if size == '1x1':
        p = Photo('nook.jpg', 1080, 760, fx=.32, fy=1.0, zoom=1.0)
        inner = f"""
<div class="abs" style="left:0;top:320px;width:1080px;height:760px;overflow:hidden">{photo_div(p)}
  <div class="fill" style="background:linear-gradient(180deg,rgba({AUB_RGB},.28),rgba({AUB_RGB},0) 30%)"></div>
  {propped_card(p, 600, 1150, 520)}</div>
<div class="abs" style="left:0;top:0;width:1080px;height:320px;background:{CREAM}"></div>
<div class="abs hl" style="left:80px;top:60px;width:760px;font-size:66px;color:{AUB}">Going private? <i style="color:{PURPLE}">Here&rsquo;s the whole price.</i></div>
{logo(150, white=False, x=860, y=64)}
<div class="abs" style="left:80px;top:220px"><span class="cta royal" style="height:70px;padding:0 42px;font-size:23px">{CTA}</span></div>"""
        return board('s1', 'D2-1', 'General | Static | Denise | Fee card | 1x1 | 261027', CREAM, inner)
    if size == '9x16':
        p = Photo('nook.jpg', 1080, 1060, fx=.36, fy=1.0, zoom=1.0)
        inner = f"""
<div class="abs" style="left:0;top:520px;width:1080px;height:1060px;overflow:hidden">{photo_div(p)}
  <div class="fill" style="background:linear-gradient(180deg,rgba({AUB_RGB},.22),rgba({AUB_RGB},0) 22%)"></div>
  {propped_card(p, 560, 1150, 560)}</div>
<div class="abs" style="left:0;top:1580px;width:1080px;height:340px;background:{AUB}"></div>
<img class="abs" src="assets/crown-rule-white.png" style="left:340px;top:1640px;width:400px;opacity:.85">
<div class="abs" style="left:0;top:1700px;width:1080px;display:flex;justify-content:center">{proof(CREAM, 24)}</div>
<div class="abs body" style="left:0;top:1752px;width:1080px;text-align:center;font-size:22px;color:{LILAC}">5 Station Road, Newport Pagnell</div>
<div class="abs" style="left:0;top:0;width:1080px;height:520px;background:{CREAM}"></div>
<div class="abs hl" style="left:80px;top:265px;width:720px;font-size:80px;color:{AUB}">Going private? <i style="color:{PURPLE}">Here&rsquo;s the whole price.</i></div>
{logo(170, white=False, x=830, y=275)}
<div class="abs" style="left:80px;top:580px"><span class="cta royal" style="height:84px;padding:0 54px;font-size:28px;box-shadow:0 12px 30px rgba(20,0,30,.3)">{CTA}</span></div>"""
        return board('s9', 'D2-9', 'General | Static | Denise | Fee card | 9x16 | 261027', CREAM, inner)
    p = Photo('nook.jpg', 640, 628, fx=.3, fy=1.0, zoom=1.0)
    inner = f"""
<div class="abs" style="left:560px;top:0;width:640px;height:628px;overflow:hidden">{photo_div(p)}{propped_card(p, 590, 1150, 520)}</div>
<div class="abs" style="left:0;top:0;width:560px;height:628px;background:{CREAM}"></div>
{logo(130, white=False, x=56, y=44)}
<div class="abs hl" style="left:56px;top:190px;width:470px;font-size:56px;color:{AUB}">Going private? <i style="color:{PURPLE}">Here&rsquo;s the whole price.</i></div>
<div class="abs body" style="left:56px;top:400px;width:440px;font-size:21px;color:{MUTE}">New patient check-up, X-rays included. Newport Pagnell.</div>
<div class="abs" style="left:56px;top:500px"><span class="cta royal" style="height:62px;padding:0 36px;font-size:21px">{CTA}</span></div>"""
    return board('sl', 'D2-L', 'General | Static | Denise | Fee card | 1.91x1 | 261027', CREAM, inner)


# ------------------------------------------------------------------ D3 | No sales pitch (VT-30 Problem and solution)
WORRIES = ['A bill you weren&rsquo;t expecting', 'Work you didn&rsquo;t ask for', 'Being rushed into a decision']
ARROW = '<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="none" stroke="{c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="{d}"/></svg>'


def worries(fs, w):
    rows = ''.join(f'<div style="display:flex;align-items:center;gap:{fs * .7:.0f}px;padding:{fs * .62:.0f}px 0;border-bottom:1px solid rgba(212,184,214,.25)">'
                   f'<img src="assets/crown-gold.png" style="width:{fs * 1.25:.0f}px;flex:none">'
                   f'<span style="font-size:{fs}px;font-weight:500;color:{CREAM};line-height:1.25">{t}</span></div>' for t in WORRIES)
    return (f'<div style="width:{w}px"><div class="eyebrow" style="font-size:{fs * .62:.0f}px;color:{LILAC}">Worried private means</div>{rows}</div>')


def chip(size, down=False):
    d = 'M12 5v14M6 13l6 6 6-6' if down else 'M5 12h14M13 6l6 6-6 6'
    return (f'<div style="width:{size}px;height:{size}px;border-radius:50%;background:{LILAC};display:flex;align-items:center;justify-content:center;'
            f'box-shadow:0 8px 20px rgba(20,0,30,.4)">{ARROW.format(s=round(size * .5), c=AUB, d=d)}</div>')


def solution(fs):
    return (f'<div class="eyebrow" style="font-size:{fs * .36:.0f}px;color:{LILAC}">At Wilson House</div>'
            f'<div class="hl" style="font-size:{fs}px;color:#fff;margin-top:{fs * .2:.0f}px">A check-up, <i style="color:{LILAC}">not a sales pitch.</i></div>'
            f'<div class="body" style="font-size:{fs * .37:.0f}px;color:{CREAM};margin-top:{fs * .3:.0f}px">Time to talk, a personalised plan, no pressure and no hidden fees.</div>'
            f'<div style="display:flex;align-items:baseline;gap:{fs * .15:.0f}px;margin-top:{fs * .28:.0f}px;color:{CREAM}">'
            f'<span style="font-family:\'Playfair Display\',serif;font-style:italic;font-size:{fs * .44:.0f}px;color:{LILAC}">New patient check-up</span>'
            f'<span class="hl" style="font-size:{fs * .8:.0f}px;color:#fff">&pound;85</span>'
            f'<span class="body" style="font-size:{fs * .28:.0f}px;color:{LILAC}">with X-rays</span></div>')


def d3(size):
    if size == '1x1':
        p = Photo('lounge.jpg', 640, 1080, fx=.32, fy=.5)
        inner = f"""<img class="abs" src="assets/site-shapes/crown-watermark.png" style="left:-120px;top:620px;width:560px;opacity:.07">
{logo(150, x=70, y=60)}
<div class="abs" style="left:70px;top:250px">{worries(28, 360)}</div>
<div class="abs" style="left:70px;top:680px"><span class="cta lilac" style="height:70px;padding:0 40px;font-size:23px">{CTA}</span></div>
{photo_div(p, x=440)}
<div class="abs" style="left:440px;top:0;width:640px;height:1080px;background:linear-gradient(180deg,rgba({AUB_RGB},0) 30%,rgba({AUB_RGB},.85) 62%,{AUB} 100%)"></div>
<div class="abs" style="left:438px;top:0;width:3px;height:1080px;background:{LILAC}"></div>
<div class="abs" style="left:406px;top:405px">{chip(68)}</div>
<div class="abs" style="left:490px;top:660px;width:540px">{solution(52)}</div>
<div class="abs" style="left:490px;top:1010px">{proof(CREAM, 16)}</div>"""
        return board('s1', 'D3-1', 'General | Static | Denise | No sales pitch | 1x1 | 261027', AUB, inner)
    if size == '9x16':
        p = Photo('lounge.jpg', 1080, 1000, fx=.45, fy=.5)
        inner = f"""<img class="abs" src="assets/site-shapes/crown-watermark.png" style="left:640px;top:330px;width:560px;opacity:.07">
<div class="abs" style="left:80px;top:300px">{worries(46, 920)}</div>
{photo_div(p, y=920)}
<div class="abs" style="left:0;top:920px;width:1080px;height:1000px;background:linear-gradient(180deg,rgba({AUB_RGB},.15) 0%,rgba({AUB_RGB},.6) 18%,rgba({AUB_RGB},.93) 32%,{AUB} 60%)"></div>
<div class="abs" style="left:0;top:918px;width:1080px;height:3px;background:{LILAC}"></div>
<div class="abs" style="left:496px;top:880px">{chip(84, down=True)}</div>
<div class="abs" style="left:80px;top:1170px;width:920px">{solution(66)}</div>
<div class="abs" style="left:80px;top:1500px;display:flex;align-items:center;gap:36px"><span class="cta lilac" style="height:80px;padding:0 50px;font-size:27px">{CTA}</span>{proof(CREAM, 20)}</div>
{logo(160, x=460, y=1660)}"""
        return board('s9', 'D3-9', 'General | Static | Denise | No sales pitch | 9x16 | 261027', AUB, inner)
    p = Photo('lounge.jpg', 600, 628, fx=.4, fy=.5)
    inner = f"""{logo(110, x=50, y=36)}
<div class="abs" style="left:50px;top:150px">{worries(21, 470)}</div>
<div class="abs" style="left:50px;top:440px"><span class="cta lilac" style="height:56px;padding:0 30px;font-size:19px">{CTA}</span></div>
<div class="abs" style="left:50px;top:530px">{proof(CREAM, 15)}</div>
{photo_div(p, x=600)}
<div class="abs" style="left:600px;top:0;width:600px;height:628px;background:linear-gradient(180deg,rgba({AUB_RGB},0) 15%,rgba({AUB_RGB},.88) 55%,{AUB} 100%)"></div>
<div class="abs" style="left:598px;top:0;width:3px;height:628px;background:{LILAC}"></div>
<div class="abs" style="left:574px;top:270px">{chip(54)}</div>
<div class="abs" style="left:650px;top:290px;width:510px">{solution(38)}</div>"""
    return board('sl', 'D3-L', 'General | Static | Denise | No sales pitch | 1.91x1 | 261027', AUB, inner)


if __name__ == '__main__':
    for size in ('1x1', '9x16', 'landscape'):
        out = HERE / f'denise-{size}.html'
        out.write_text(page(f'Wilson House | Denise | {size}', [d1(size), d2(size), d3(size)]))
        print('wrote', out.name)
