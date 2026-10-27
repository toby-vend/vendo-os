"""Woburn Sands | General (new patient) Meta statics, batch 2 (27 Oct 2026): persona Sophie (family register).

Usage: python3 build-batch2.py  ->  sophie-1x1.html, sophie-9x16.html, sophie-landscape.html
Copy and sources: copy-sophie.md, research.md. Brand: Woburn Sands guideline (Figma xOAVGppKkuFSLDgZs0OoyO,
build_guideline.py): Woburn Green / Deep / Crown Gold / Mist, Manrope Bold headlines with an Instrument Serif
italic turn (Mist on green, Crown Gold on white), Jost caps labels in Crown Gold, Kana crown bullets, square
photo frames with a Mist offset block, 4px buttons, house sketch watermark. Lime waiting-room walls are decor,
not brand, so they are kept out of frame.
Photos: July 2026 shoot (assets/photos/web, gitignored). No stock (S1 is type-led). Every photo is cover-cropped from its real aspect, never stretched.
"""
import struct
from pathlib import Path

HERE = Path(__file__).parent
PHOTOS = HERE / 'assets/photos'

GREEN, DEEP, GOLD, MIST, PAPER, INK = '#1D6340', '#144A30', '#BE9E5A', '#DCE7E2', '#F3F6F4', '#10261B'
G_RGB, D_RGB = '29,99,64', '20,74,48'
PEN = '#1F2B45'  # biro ink on the S1 list

GRAIN = ("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>"
         "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.9 0'/></filter>"
         "<rect width='100%' height='100%' filter='url(%23n)'/></svg>")

CSS = f"""
@font-face {{ font-family: Manrope; src: url(assets/fonts/Manrope.ttf); font-weight: 200 800; }}
@font-face {{ font-family: 'Instrument Serif'; src: url(assets/fonts/InstrumentSerif-Italic.ttf); font-style: italic; }}
@font-face {{ font-family: Jost; src: url(assets/fonts/Jost.ttf); font-weight: 100 900; }}
@font-face {{ font-family: Caveat; src: url(assets/fonts/Caveat.ttf); font-weight: 400 700; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ background: #2a2a2a; font-family: Manrope, sans-serif; display: flex; gap: 80px; padding: 80px; align-items: flex-start; }}
.ab {{ position: relative; overflow: hidden; flex: none; color: #fff; }}
.s1 {{ width: 1080px; height: 1080px; }}
.s9 {{ width: 1080px; height: 1920px; }}
.sl {{ width: 1200px; height: 628px; }}
.abs {{ position: absolute; }}
.fill {{ position: absolute; inset: 0; }}
.grain {{ position: absolute; inset: 0; background-image: url("{GRAIN}"); opacity: .12; mix-blend-mode: overlay; pointer-events: none; }}
.hl {{ font-weight: 700; line-height: 1.04; letter-spacing: -.02em; }}
.hl i {{ font-family: 'Instrument Serif', serif; font-style: italic; font-weight: 400; letter-spacing: 0; }}
.label {{ font-family: Jost, sans-serif; font-weight: 500; letter-spacing: .2em; text-transform: uppercase; color: {GOLD}; }}
.body {{ font-weight: 500; line-height: 1.4; }}
.cta {{ display: inline-flex; align-items: center; justify-content: center; border-radius: 4px; font-weight: 700; white-space: nowrap; }}
.cta.mist {{ background: {MIST}; color: {DEEP}; }}
.cta.green {{ background: {GREEN}; color: #fff; }}
.num {{ font-weight: 200; letter-spacing: -.04em; line-height: .9; }}
.hand {{ font-family: Caveat, cursive; font-weight: 600; color: {PEN}; }}
"""

CTA = 'Book Appointment'
STAR = '<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="{c}"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>'
TICK = '<svg viewBox="0 0 40 40" width="{s}" height="{s}" fill="none" stroke="{c}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 21c4 3 7 7 9 11C20 20 27 11 36 5"/></svg>'


def proof(color, size=22):
    """Volume proof: 4.8 from 403 on Google Maps (20 Oct 2026), shown as 400+."""
    st = ''.join(STAR.format(s=size + 2, c=GOLD) for _ in range(5))
    return (f'<div style="display:flex;align-items:center;gap:12px;color:{color};font-size:{size}px;font-weight:600">'
            f'<span style="display:flex;gap:3px">{st}</span><span>4.8 from 400+ Google reviews</span></div>')


def size_of(path):
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
    """Cover-crop a photo (path under assets/photos) into a w x h box; at() maps source px to box px."""

    def __init__(self, rel, w, h, fx=.5, fy=.5, zoom=1.0):
        self.rel, self.w, self.h = rel, w, h
        sw, sh = size_of(PHOTOS / rel)
        self.s = max(w / sw, h / sh) * zoom
        self.bw, self.bh = sw * self.s, sh * self.s
        self.ox, self.oy = -(self.bw - w) * fx, -(self.bh - h) * fy

    def css(self):
        return (f'background-image:url(assets/photos/{self.rel});background-size:{self.bw:.0f}px {self.bh:.0f}px;'
                f'background-position:{self.ox:.0f}px {self.oy:.0f}px;background-repeat:no-repeat')

    def at(self, sx, sy):
        return self.ox + sx * self.s, self.oy + sy * self.s


def photo_div(p, x=0, y=0, extra=''):
    return f'<div class="abs" data-name="Photo" style="left:{x}px;top:{y}px;width:{p.w}px;height:{p.h}px;{p.css()};{extra}"></div>'


def logo(w, x, y, colour=False):
    return f'<img data-name="Logo" class="abs" src="assets/{"logo-colour.png" if colour else "logo-white.png"}" style="left:{x}px;top:{y}px;width:{w}px">'


def crown_li(text, fs, color='#fff', gap=14):
    return (f'<div style="display:flex;gap:{gap}px;align-items:flex-start;margin-top:{fs * .55:.0f}px">'
            f'<img src="assets/crown-white.png" style="width:{fs * 1.05:.0f}px;margin-top:{fs * .2:.0f}px;flex:none;opacity:.95">'
            f'<span style="font-size:{fs}px;font-weight:500;color:{color};line-height:1.3">{text}</span></div>')


def page(title, boards):
    return (f"<!doctype html><html lang='en-GB'><head><meta charset='utf-8'><title>{title}</title>"
            f"<style>{CSS}</style><script src='https://mcp.figma.com/mcp/html-to-design/capture.js' async></script></head>"
            f"<body>{''.join(boards)}</body></html>")


def board(cls, bid, name, bg, inner):
    return f'<div class="ab {cls}" id="{bid}" data-name="{name}" style="background:{bg}">{inner}<div class="grain"></div></div>'


# ------------------------------------------------------------------ S1 | The moving list (Custom, type-led: a handwritten list on a paper sheet)
# No photo: the client's Drive (Content Assets, Woburn shoot Pictures/Broll/Talking/Drone, VSL) has practice, team
# and exterior material only, nothing domestic, and stock is off the table (Toby, 9 Oct 2026). Shot list in copy-sophie.md.


def list_sheet(w, rot=-4):
    """Lined notepad sheet with the 'new house list' in biro, the last line ringed in Crown Gold. Design width 600."""
    k = w / 600
    items = ['Boxes (nearly)', 'School forms', 'Register with GP']
    rows = ''.join(f'<div style="display:flex;align-items:center;gap:{16 * k:.0f}px;height:{72 * k:.0f}px">{TICK.format(s=round(42 * k), c=PEN)}'
                   f'<span class="hand" style="font-size:{56 * k:.0f}px;white-space:nowrap">{t}</span></div>' for t in items)
    last = (f'<div style="position:relative;display:flex;align-items:center;gap:{16 * k:.0f}px;height:{130 * k:.0f}px;margin-top:{16 * k:.0f}px">'
            f'<span style="display:inline-block;flex:none;width:{40 * k:.0f}px;height:{38 * k:.0f}px;border:{3.2 * k:.1f}px solid {PEN};border-radius:{6 * k:.0f}px"></span>'
            f'<span class="hand" style="font-size:{62 * k:.0f}px;font-weight:700;line-height:.95;white-space:nowrap">Find a dentist<br>for all of us</span>'
            f'<svg viewBox="0 0 400 170" style="position:absolute;left:{-16 * k:.0f}px;top:{-14 * k:.0f}px;width:{470 * k:.0f}px;height:{165 * k:.0f}px;overflow:visible">'
            f'<path d="M30 92 C 20 30, 190 6, 330 22 C 420 34, 410 128, 300 150 C 190 168, 40 152, 22 104 C 14 78, 50 50, 110 40" '
            f'fill="none" stroke="{GOLD}" stroke-width="7" stroke-linecap="round" opacity=".95"/></svg></div>')
    lines = f'repeating-linear-gradient(180deg,transparent 0,transparent {71 * k:.1f}px,rgba(120,150,170,.28) {71 * k:.1f}px,rgba(120,150,170,.28) {72 * k:.1f}px)'
    return f"""
<div data-name="List sheet" style="position:relative;width:{w}px;padding:{70 * k:.0f}px {50 * k:.0f}px {60 * k:.0f}px {78 * k:.0f}px;transform:rotate({rot}deg);
  background:{lines},linear-gradient(165deg,#ffffff 0%,#f7f8f4 55%,#eceee6 100%);background-position:0 {148 * k:.0f}px,0 0;
  border-radius:{3 * k:.0f}px;box-shadow:0 {34 * k:.0f}px {70 * k:.0f}px rgba(4,24,14,.55),0 {6 * k:.0f}px {14 * k:.0f}px rgba(4,24,14,.35)">
  <div style="position:absolute;left:{56 * k:.0f}px;top:0;bottom:0;width:{2 * k:.1f}px;background:rgba(200,90,90,.35)"></div>
  <div data-name="Tape" style="position:absolute;left:50%;top:-{22 * k:.0f}px;width:{180 * k:.0f}px;height:{48 * k:.0f}px;margin-left:-{90 * k:.0f}px;
    transform:rotate(-3deg);background:rgba(220,231,226,.82);box-shadow:0 1px 3px rgba(0,0,0,.15)"></div>
  <div class="hand" style="font-size:{72 * k:.0f}px;font-weight:700;margin-bottom:{14 * k:.0f}px;text-decoration:underline;text-decoration-thickness:{3 * k:.1f}px;text-underline-offset:{10 * k:.0f}px">New house list</div>
  {rows}{last}
</div>"""


def lit(w, h, x=0, y=0):
    """Deep green ground with a soft lamp-light pool, so the sheet sits on something lit rather than a flat fill."""
    return (f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;'
            f'background:radial-gradient(ellipse at 42% 38%,#2c7a52 0%,{GREEN} 38%,{DEEP} 78%,#0d3322 100%)"></div>')


def prices(fs, color='#fff', label=MIST):
    return (f'<div style="display:flex;gap:{fs * .45:.0f}px;align-items:flex-end">'
            f'<div><div class="num" style="font-size:{fs}px;color:{color}">&pound;85</div><div class="label" style="font-size:{fs * .2:.0f}px;margin-top:{fs * .12:.0f}px">Adults</div></div>'
            f'<div style="width:1px;height:{fs * 1.05:.0f}px;background:rgba(220,231,226,.4)"></div>'
            f'<div><div class="num" style="font-size:{fs}px;color:{color}">&pound;25</div><div class="label" style="font-size:{fs * .2:.0f}px;margin-top:{fs * .12:.0f}px">Children</div></div></div>')


def s1(size):
    if size == '1x1':
        inner = f"""{lit(560, 1080)}
<img class="abs" src="assets/house-white.png" style="left:-60px;top:700px;width:460px;opacity:.05">
<div class="abs" style="left:48px;top:300px">{list_sheet(470)}</div>
<div class="abs" style="left:560px;top:0;width:520px;height:1080px;background:{GREEN}"></div>
<div class="abs" style="left:560px;top:0;width:4px;height:1080px;background:{GOLD}"></div>
<img class="abs" src="assets/house-white.png" style="left:700px;top:760px;width:440px;opacity:.06">
<div class="abs label" style="left:612px;top:90px;font-size:19px">New patients welcome</div>
<div class="abs hl" style="left:612px;top:140px;width:430px;font-size:66px">Moved to <i style="color:{MIST}">Woburn Sands?</i></div>
<div class="abs body" style="left:612px;top:330px;width:420px;font-size:26px;color:{MIST}">One practice for the whole family.</div>
<div class="abs" style="left:612px;top:440px">{prices(96)}</div>
<div class="abs body" style="left:612px;top:640px;width:420px;font-size:21px;color:{MIST}">First check-up. X-rays included for adults.</div>
<div class="abs" style="left:612px;top:730px"><span class="cta mist" style="height:72px;padding:0 40px;font-size:24px">{CTA}</span></div>
<div class="abs" style="left:612px;top:840px">{proof('#fff', 18)}</div>
{logo(150, 612, 920)}"""
        return board('s1', 'S1-1', 'General | Static | Sophie | Moving list | 1x1 | 261027', GREEN, inner)
    if size == '9x16':
        inner = f"""{lit(1080, 1080)}
<div class="abs" style="left:200px;top:300px">{list_sheet(660)}</div>
<div class="abs" style="left:0;top:1080px;width:1080px;height:840px;background:{GREEN}"></div>
<div class="abs" style="left:0;top:1076px;width:1080px;height:4px;background:{GOLD}"></div>
<img class="abs" src="assets/house-white.png" style="left:640px;top:1380px;width:520px;opacity:.06">
<div class="abs hl" style="left:80px;top:1120px;width:900px;font-size:72px">Moved to <i style="color:{MIST}">Woburn Sands?</i></div>
<div class="abs body" style="left:80px;top:1215px;width:900px;font-size:28px;color:{MIST}">One practice for the whole family. X-rays included for adults.</div>
<div class="abs" style="left:80px;top:1290px">{prices(110)}</div>
<div class="abs" style="left:80px;top:1480px;display:flex;align-items:center;gap:40px"><span class="cta mist" style="height:76px;padding:0 44px;font-size:26px">{CTA}</span>{proof('#fff', 20)}</div>
{logo(170, 455, 1660)}"""
        return board('s9', 'S1-9', 'General | Static | Sophie | Moving list | 9x16 | 261027', GREEN, inner)
    inner = f"""{lit(520, 628, x=680)}
<div class="abs" style="left:745px;top:70px">{list_sheet(400, rot=3)}</div>
<div class="abs" style="left:0;top:0;width:680px;height:628px;background:{GREEN}"></div>
<img class="abs" src="assets/house-white.png" style="left:380px;top:330px;width:340px;opacity:.06">
{logo(130, 56, 44)}
<div class="abs hl" style="left:56px;top:170px;width:560px;font-size:52px">Moved to <i style="color:{MIST}">Woburn Sands?</i></div>
<div class="abs body" style="left:56px;top:290px;width:560px;font-size:22px;color:{MIST}">One practice for the whole family.</div>
<div class="abs" style="left:56px;top:345px">{prices(84)}</div>
<div class="abs" style="left:56px;top:520px;display:flex;align-items:center;gap:26px"><span class="cta mist" style="height:58px;padding:0 32px;font-size:20px">{CTA}</span>{proof('#fff', 15)}</div>"""
    return board('sl', 'S1-L', 'General | Static | Sophie | Moving list | 1.91x1 | 261027', GREEN, inner)


# ------------------------------------------------------------------ S2 | Price per person (VT-20 Editorial price split)
POR = 'web/p4.jpg'


def price_block(fs, small):
    row = lambda price, lab, sub: (
        f'<div style="display:flex;align-items:flex-end;gap:{fs * .14:.0f}px">'
        f'<span class="num" style="font-size:{fs}px">&pound;{price}</span>'
        f'<span style="padding-bottom:{fs * .1:.0f}px"><span style="display:block;font-family:\'Instrument Serif\',serif;font-style:italic;font-size:{fs * .34:.0f}px;color:{MIST};line-height:1">{lab}</span>'
        f'<span style="display:block;font-size:{small}px;font-weight:500;color:{MIST};opacity:.85;margin-top:{small * .3:.0f}px">{sub}</span></span></div>')
    return (row('85', 'adults', 'X-rays included')
            + f'<div style="height:1px;background:rgba(220,231,226,.35);margin:{fs * .16:.0f}px 0"></div>'
            + row('25', 'children', 'New patient check-up'))


def s2(size):
    if size == '1x1':
        p = Photo(POR, 500, 1080, fx=.5, fy=.12)
        inner = f"""<div class="abs" style="left:610px;top:0;width:470px;height:1080px;background:{MIST}"></div>
{photo_div(p, x=580, y=0)}
<div class="abs" style="left:0;top:0;width:580px;height:1080px;background:{GREEN}"></div>
<div class="abs" style="left:580px;top:0;width:4px;height:1080px;background:{GOLD}"></div>
{logo(150, 80, 70)}
<div class="abs label" style="left:80px;top:270px;width:440px;font-size:19px;line-height:1.5">New patient check-ups<br>in Woburn Sands</div>
<div class="abs" style="left:76px;top:360px">{price_block(156, 19)}</div>
<div class="abs hl" style="left:80px;top:770px;width:450px;font-size:32px;font-weight:600;line-height:1.2">The whole family, one practice, <i style="color:{MIST};font-size:38px">no surprises.</i></div>
<div class="abs" style="left:80px;top:880px"><span class="cta mist" style="height:70px;padding:0 40px;font-size:23px">{CTA}</span></div>
<div class="abs" style="left:80px;top:985px">{proof('#fff', 17)}</div>"""
        return board('s1', 'S2-1', 'General | Static | Sophie | Price per person | 1x1 | 261027', GREEN, inner)
    if size == '9x16':
        p = Photo(POR, 1080, 860, fx=.5, fy=.29)
        inner = f"""{photo_div(p, x=0, y=0)}
<div class="abs" style="left:0;top:0;width:1080px;height:300px;background:linear-gradient(180deg,rgba({D_RGB},.55),rgba({D_RGB},0))"></div>
<div class="abs" style="left:0;top:860px;width:1080px;height:1060px;background:{GREEN}"></div>
<div class="abs" style="left:0;top:856px;width:1080px;height:4px;background:{GOLD}"></div>
<div class="abs label" style="left:80px;top:920px;font-size:22px">New patient check-ups in Woburn Sands</div>
<div class="abs" style="left:76px;top:985px">{price_block(190, 22)}</div>
<div class="abs hl" style="left:80px;top:1400px;width:940px;font-size:36px;font-weight:600;line-height:1.2">The whole family, one practice, <i style="color:{MIST};font-size:44px">no surprises.</i></div>
<div class="abs" style="left:80px;top:1500px;display:flex;align-items:center;gap:36px"><span class="cta mist" style="height:76px;padding:0 44px;font-size:26px">{CTA}</span>{proof('#fff', 19)}</div>
{logo(170, 455, 1660)}"""
        return board('s9', 'S2-9', 'General | Static | Sophie | Price per person | 9x16 | 261027', GREEN, inner)
    p = Photo(POR, 520, 628, fx=.5, fy=.1)
    inner = f"""{photo_div(p, x=680, y=0)}
<div class="abs" style="left:0;top:0;width:680px;height:628px;background:{GREEN}"></div>
<div class="abs" style="left:680px;top:0;width:4px;height:628px;background:{GOLD}"></div>
{logo(120, 56, 40)}
<div class="abs label" style="left:56px;top:170px;font-size:16px">New patient check-ups in Woburn Sands</div>
<div class="abs" style="left:52px;top:210px">{price_block(110, 15)}</div>
<div class="abs" style="left:56px;top:520px;display:flex;align-items:center;gap:26px"><span class="cta mist" style="height:58px;padding:0 32px;font-size:20px">{CTA}</span>{proof('#fff', 15)}</div>"""
    return board('sl', 'S2-L', 'General | Static | Sophie | Price per person | 1.91x1 | 261027', GREEN, inner)


# ------------------------------------------------------------------ S3 | Ground floor (VT-04 Side column)
ENT = 'web/s16.jpg'
BULLETS = ['Every surgery on the ground floor', 'Wide corridors, easy with a pushchair', 'Monday to Friday, 8am to 5.30pm']


def s3(size):
    if size == '1x1':
        p = Photo(ENT, 620, 1080, fx=.44, fy=.5)
        inner = f"""{photo_div(p)}
<div class="abs" style="left:0;top:0;width:620px;height:1080px;background:linear-gradient(180deg,rgba({D_RGB},0) 70%,rgba({D_RGB},.45))"></div>
<div class="abs" style="left:620px;top:0;width:460px;height:1080px;background:{GREEN}"></div>
<div class="abs" style="left:620px;top:0;width:4px;height:1080px;background:{GOLD}"></div>
<div class="abs label" style="left:670px;top:84px;font-size:18px">Theydon Avenue</div>
<div class="abs hl" style="left:670px;top:130px;width:370px;font-size:54px">Looking for a family dentist in <i style="color:{MIST};font-size:62px">Woburn Sands?</i></div>
<div class="abs" style="left:670px;top:430px;width:370px">{''.join(crown_li(b, 24) for b in BULLETS)}</div>
<div class="abs" style="left:670px;top:705px;width:370px"><div class="label" style="font-size:16px">New patient check-ups</div>
  <div style="font-size:36px;font-weight:700;margin-top:8px">&pound;85 <span style="font-family:'Instrument Serif',serif;font-style:italic;font-weight:400;color:{MIST}">adults</span> &middot; &pound;25 <span style="font-family:'Instrument Serif',serif;font-style:italic;font-weight:400;color:{MIST}">children</span></div></div>
<div class="abs" style="left:670px;top:830px"><span class="cta mist" style="height:70px;padding:0 40px;font-size:23px">{CTA}</span></div>
{logo(140, 670, 940)}"""
        return board('s1', 'S3-1', 'General | Static | Sophie | Ground floor | 1x1 | 261027', GREEN, inner)
    if size == '9x16':
        p = Photo(ENT, 1080, 900, fx=.42, fy=.5)
        inner = f"""<div class="abs" style="left:0;top:0;width:1080px;height:900px;background:{GREEN}"></div>
{photo_div(p, x=0, y=0)}
<div class="abs" style="left:0;top:0;width:1080px;height:300px;background:linear-gradient(180deg,rgba({D_RGB},.5),rgba({D_RGB},0))"></div>
<div class="abs" style="left:0;top:900px;width:1080px;height:1020px;background:{GREEN}"></div>
<div class="abs" style="left:0;top:896px;width:1080px;height:4px;background:{GOLD}"></div>
<img class="abs" src="assets/house-white.png" style="left:620px;top:1250px;width:520px;opacity:.06">
<div class="abs hl" style="left:80px;top:950px;width:900px;font-size:66px">Looking for a family dentist in <i style="color:{MIST};font-size:76px">Woburn Sands?</i></div>
<div class="abs" style="left:80px;top:1130px;width:600px">{''.join(crown_li(b, 28) for b in BULLETS)}</div>
<div class="abs" style="left:80px;top:1375px"><div class="label" style="font-size:18px">New patient check-ups</div>
  <div style="font-size:42px;font-weight:700;margin-top:8px">&pound;85 <span style="font-family:'Instrument Serif',serif;font-style:italic;font-weight:400;color:{MIST}">adults</span> &middot; &pound;25 <span style="font-family:'Instrument Serif',serif;font-style:italic;font-weight:400;color:{MIST}">children</span></div></div>
<div class="abs" style="left:80px;top:1490px"><span class="cta mist" style="height:76px;padding:0 44px;font-size:26px">{CTA}</span></div>
{logo(160, 840, 1480)}"""
        return board('s9', 'S3-9', 'General | Static | Sophie | Ground floor | 9x16 | 261027', GREEN, inner)
    p = Photo(ENT, 600, 628, fx=.45, fy=.5)
    inner = f"""{photo_div(p)}
<div class="abs" style="left:600px;top:0;width:600px;height:628px;background:{GREEN}"></div>
<div class="abs" style="left:600px;top:0;width:4px;height:628px;background:{GOLD}"></div>
<div class="abs hl" style="left:650px;top:46px;width:510px;font-size:40px">Looking for a family dentist in <i style="color:{MIST};font-size:46px">Woburn Sands?</i></div>
<div class="abs" style="left:650px;top:170px;width:500px">{''.join(crown_li(b, 19, gap=10) for b in BULLETS)}</div>
<div class="abs" style="left:650px;top:345px;font-size:27px;font-weight:700">&pound;85 <span style="font-family:'Instrument Serif',serif;font-style:italic;font-weight:400;color:{MIST}">adults</span> &middot; &pound;25 <span style="font-family:'Instrument Serif',serif;font-style:italic;font-weight:400;color:{MIST}">children</span></div>
<div class="abs" style="left:650px;top:420px"><span class="cta mist" style="height:58px;padding:0 32px;font-size:20px">{CTA}</span></div>
{logo(110, 1050, 520)}"""
    return board('sl', 'S3-L', 'General | Static | Sophie | Ground floor | 1.91x1 | 261027', GREEN, inner)


if __name__ == '__main__':
    for size in ('1x1', '9x16', 'landscape'):
        out = HERE / f'sophie-{size}.html'
        out.write_text(page(f'Woburn Sands | Sophie | {size}', [s1(size), s2(size), s3(size)]))
        print('wrote', out.name)
