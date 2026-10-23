"""Build Rothley Lodge Dental Meta static harness pages (one HTML page per persona per size).

Usage: python3 build.py [persona ...]   -> writes <persona>-1x1.html and <persona>-9x16.html
Brand: Rothley Lodge guideline (Figma bzBnK9fZkFYn1dbtzYTjBQ, page "Brand Guidelines").
Type: Cormorant Garamond (headings, one italic accent phrase) + Manrope (body, eyebrows, wordmark).
Motif: the Rothley arch (monogram outline). Navy stays the majority ground.
Based on outputs/creative/siha-meta-statics/build.py.
"""
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).parent
A = ROOT / "assets"

C = dict(navy="#15192C", wh="#FFFFFF", ch="#090909", stone="#F3F2EF", off="#F8F7F4", slate="#737580", silver="#9597A2",
         navy2="#1d2238")

# Logo from the Digimax replica of the new site (Figma 175:593), not the guideline redraw. Toby, 23 Oct 2026.
LOGO_SVG = (A / "logo.svg").read_text()
LOGO = LOGO_SVG.replace('<svg ', '<svg class="logo" ', 1)
# Monogram = the arch + R/L mark cropped out of the same lockup.
MONO = (LOGO_SVG.replace('<svg ', '<svg class="mono" ', 1)
        .replace('width="211" height="110" viewBox="0 0 211 110"', 'width="51" height="69" viewBox="80.2 -0.2 50.6 68.8"', 1)
        .replace('mask0_175_593', 'mask_mono'))

GRAIN = ("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>"
         "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.9 0'/></filter>"
         "<rect width='100%' height='100%' filter='url(%23n)'/></svg>")

CSS = f"""
@font-face {{ font-family: 'Cormorant Garamond'; src: url('assets/fonts/CormorantGaramond[wght].ttf'); font-weight: 300 700; font-style: normal; }}
@font-face {{ font-family: 'Cormorant Garamond'; src: url('assets/fonts/CormorantGaramond-Italic[wght].ttf'); font-weight: 300 700; font-style: italic; }}
@font-face {{ font-family: Manrope; src: url('assets/fonts/Manrope[wght].ttf'); font-weight: 200 800; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ background: #2a2a2a; font-family: Manrope, sans-serif; display: flex; gap: 80px; padding: 80px; align-items: flex-start; }}
.ab {{ position: relative; overflow: hidden; flex: none; color: {C['navy']}; }}
.s1 {{ width: 1080px; height: 1080px; }}
.s9 {{ width: 1080px; height: 1920px; }}
.abs {{ position: absolute; }}
.cover {{ position: absolute; inset: 0; background-size: cover; background-position: center; }}
.grain {{ position: absolute; inset: 0; background-image: url("{GRAIN}"); opacity: .10; mix-blend-mode: overlay; pointer-events: none; }}
.eyebrow {{ font-size: 19px; font-weight: 600; letter-spacing: .22em; text-transform: uppercase; }}
.hl {{ font-family: 'Cormorant Garamond', serif; font-weight: 500; line-height: 1.0; letter-spacing: -.005em; }}
.hl i {{ font-style: italic; font-weight: 400; }}
.body {{ font-size: 27px; font-weight: 400; line-height: 1.55; }}
.small {{ font-size: 19px; font-weight: 500; letter-spacing: .02em; }}
.cta {{ display: inline-flex; align-items: center; gap: 14px; height: 70px; padding: 0 38px; border-radius: 999px; font-size: 21px; font-weight: 600; letter-spacing: .01em; white-space: nowrap; }}
.cta.light {{ background: {C['wh']}; color: {C['navy']}; }}
.cta.dark {{ background: {C['navy']}; color: {C['wh']}; }}
.cta.line {{ border: 1.5px solid currentColor; }}
.mono, .logo {{ display: block; width: 100%; height: auto; }}
.wm {{ display: flex; align-items: center; }}
.wm .t1 {{ font-weight: 400; letter-spacing: .62em; white-space: nowrap; }}
.wm .t2 {{ font-weight: 400; letter-spacing: .5em; white-space: nowrap; opacity: .72; }}
.rule {{ position: absolute; height: 1px; }}
.card {{ position: absolute; border-radius: 22px; }}
"""


def photo_aspect(img):
    """Width / height of a photo in assets/photos, read from the JPEG header."""
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


def fill(w, h, img, fx=0.5, fy=0.4, zoom=1.0):
    """Background CSS that cover-crops a photo into a w x h box from its real aspect (never stretched)."""
    a = photo_aspect(img)
    bw, bh = (w, w / a) if w / h > a else (h * a, h)
    bw, bh = bw * zoom, bh * zoom
    return (f"background-image:url(assets/photos/{img});background-size:{bw:.0f}px {bh:.0f}px;"
            f"background-position:{-(bw - w) * fx:.0f}px {-(bh - h) * fy:.0f}px;background-repeat:no-repeat")


def photo(x, y, w, h, img, fx=0.5, fy=0.4, zoom=1.0, radius="0", name="Photo"):
    return (f'<div class="abs" data-name="{name}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;'
            f'border-radius:{radius};{fill(w, h, img, fx, fy, zoom)}"></div>')


def arch(x, y, w, h, img, fx=0.5, fy=0.4, zoom=1.0, line=None, gap=16, stadium=False):
    """The Rothley arch: photo in an arch-top (or stadium) frame, with the monogram's second hairline outside it."""
    r = f"{w / 2:.0f}px {w / 2:.0f}px {w / 2:.0f}px {w / 2:.0f}px" if stadium else f"{w / 2:.0f}px {w / 2:.0f}px 0 0"
    out = ""
    if line:
        ro = (f"{w / 2 + gap:.0f}px {w / 2 + gap:.0f}px {w / 2 + gap:.0f}px {w / 2 + gap:.0f}px" if stadium
              else f"{w / 2 + gap:.0f}px {w / 2 + gap:.0f}px 0 0")
        bottom = "" if stadium else "border-bottom:none;"
        out = (f'<div class="abs" data-name="Arch line" style="left:{x - gap}px;top:{y - gap}px;width:{w + 2 * gap}px;'
               f'height:{h + (2 * gap if stadium else gap)}px;border:1.5px solid {line};{bottom}border-radius:{ro}"></div>')
    return out + photo(x, y, w, h, img, fx, fy, zoom, r)


def wordmark(color, w=170):
    """The stacked Rothley Lodge lockup (monogram over ROTHLEY LODGE / DENTAL PRACTICE) at width w."""
    return f'<div data-name="Logo" style="width:{w}px;color:{color}">{LOGO}</div>'


STAR = '<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="currentColor"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>'
ARROW = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg>'
REVIEWS = "4.8 from 593 Google reviews"


def proof(color, size=20):
    stars = "".join(STAR.format(s=size) for _ in range(5))
    return (f'<div data-name="Proof" style="display:flex;align-items:center;gap:14px;color:{color}">'
            f'<span style="display:flex;gap:3px">{stars}</span>'
            f'<span class="small" style="font-size:{size}px">{REVIEWS}</span></div>')


def cta(text, kind="light", size=21):
    return f'<span class="cta {kind}" data-name="CTA" style="font-size:{size}px">{text} {ARROW}</span>'


def board(id_, name, size, bg, inner):
    return (f'<div class="ab {size}" id="{id_}" data-name="{name}" style="background:{bg}">{inner}'
            f'<div class="grain" data-name="Grain"></div></div>')


def page(title, boards):
    return (f"<!doctype html><html lang='en-GB'><head><meta charset='utf-8'><title>{title}</title>"
            f"<style>{CSS}</style><script src='https://mcp.figma.com/mcp/html-to-design/capture.js' async></script>"
            f"</head><body>{''.join(boards)}</body></html>")


DATE = "261023"
CTA_IMP = "Book an implant consultation"
CTA_CONS = "Book a consultation"


def nm(concept, talent, detail, size):
    return f"{concept} | Static | {talent} | {detail} | {size} | {DATE}"


# ---------------------------------------------------------------- PETER (single gap, Implants)
OPTIONS = [("Implant", "A new root and tooth. Fixed, and nothing either side is filed down."),
           ("Bridge", "A false tooth held by the teeth either side, which are shaped to support it."),
           ("Denture", "The lowest cost. It comes out at night.")]


def options_list(x, y, w, color_k, color_t, rule, size=26, gap=30):
    rows = ""
    for i, (k, t) in enumerate(OPTIONS):
        rows += (f'<div style="display:flex;gap:28px;align-items:baseline;padding:{gap}px 0;border-top:1px solid {rule}">'
                 f'<div class="hl" style="flex:none;width:{size * 8.6:.0f}px;white-space:nowrap;font-size:{size * 1.55:.0f}px;color:{color_k}">'
                 f'<i>0{i + 1}</i>&nbsp; {k}</div>'
                 f'<div class="body" style="font-size:{size}px;line-height:1.45;color:{color_t}">{t}</div></div>')
    return f'<div class="abs" data-name="Options" style="left:{x}px;top:{y}px;width:{w}px">{rows}</div>'


PLAN = ["Your options, explained", "A 3D scan if you need one", "Every cost, in writing", "Decide in your own time"]


def plan_card(x, y, w, scale=1.0, rot=-1.5):
    s = scale
    rows = "".join(
        f'<div style="display:flex;align-items:center;gap:{18 * s:.0f}px;padding:{17 * s:.0f}px 0;border-bottom:1px solid #d9d6cf">'
        f'<div style="width:{26 * s:.0f}px;height:{26 * s:.0f}px;border-radius:50%;border:1.5px solid {C["navy"]};display:flex;'
        f'align-items:center;justify-content:center;font-size:{14 * s:.0f}px;font-weight:600">{i + 1}</div>'
        f'<div style="font-size:{25 * s:.0f}px;font-weight:500">{t}</div></div>' for i, t in enumerate(PLAN))
    return (f'<div class="abs" data-name="Plan card" style="left:{x}px;top:{y}px;width:{w}px;padding:{46 * s:.0f}px {50 * s:.0f}px;'
            f'background:{C["off"]};border-radius:10px;transform:rotate({rot}deg);color:{C["navy"]};'
            f'box-shadow:0 36px 70px rgba(0,0,0,.42),0 6px 16px rgba(0,0,0,.25)">'
            f'<div style="display:flex;justify-content:space-between;align-items:center">'
            f'<div class="eyebrow" style="font-size:{15 * s:.0f}px;color:{C["slate"]}">Implant consultation</div>'
            f'<div style="width:{34 * s:.0f}px">{MONO}</div></div>'
            f'<div class="hl" style="font-size:{46 * s:.0f}px;margin:{14 * s:.0f}px 0 {12 * s:.0f}px">Your treatment <i>plan</i></div>{rows}'
            f'<div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:{22 * s:.0f}px">'
            f'<div style="font-size:{21 * s:.0f}px;color:{C["slate"]}">Consultation</div>'
            f'<div class="hl" style="font-size:{44 * s:.0f}px">from £199</div></div></div>')


def peter_1x1():
    b = []
    # P1 got used to the gap
    b.append(board("P1", nm("You've got used to the gap", "Simon", "Accommodation", "1x1"), "s1", C["navy"], f"""
  {arch(612, 150, 388, 640, 'simon-scan-patient.jpg', fx=.42, fy=.5, zoom=1.0, line=C['silver'])}
  <div class="abs eyebrow" style="left:80px;top:96px;color:{C['silver']}">Dental implants in Staines</div>
  <div class="abs hl" style="left:80px;top:160px;width:500px;font-size:74px;color:{C['wh']}">You've got so used to the gap, <i>you chew on the other side.</i></div>
  <div class="abs body" style="left:80px;top:520px;width:470px;color:#d6d7de">A tooth that feels like yours again, planned around a 3D scan.</div>
  <div class="abs" style="left:80px;top:705px">{proof(C['silver'])}</div>
  <div class="abs" style="left:80px;top:790px">{cta(CTA_IMP)}</div>
  <div class="rule" style="left:80px;top:925px;width:920px;background:rgba(255,255,255,.16)"></div>
  <div class="abs" style="left:80px;top:965px">{wordmark(C['wh'], 154)}</div>"""))
    # P2 one gap, three options
    b.append(board("P2", nm("One gap three options", "Simon", "Implant bridge denture", "1x1"), "s1", C["off"], f"""
  {arch(770, 80, 230, 330, 'simon-smile-model.jpg', fx=.5, fy=.25, line=C['silver'], gap=12)}
  <div class="abs eyebrow" style="left:80px;top:96px;color:{C['slate']}">Missing a tooth?</div>
  <div class="abs hl" style="left:80px;top:150px;width:640px;font-size:84px;color:{C['navy']}">One gap. <i>Three honest options.</i></div>
  {options_list(80, 440, 920, C['navy'], C['ch'], '#d6d3cc')}
  <div class="abs" style="left:80px;top:960px">{cta(CTA_CONS, 'dark', 20)}</div>
  <div class="abs" style="left:640px;top:972px">{wordmark(C['navy'], 126)}</div>"""))
    # P3 nobody can see it
    b.append(board("P3", nm("Nobody can see it", "Simon", "Bone loss", "1x1"), "s1", C["navy"], f"""
  {photo(0, 0, 1080, 610, 'simon-xray.jpg', fx=.5, fy=.32)}
  <div class="cover" style="background:linear-gradient(180deg,rgba(21,25,44,.15) 0%,rgba(21,25,44,.35) 38%,{C['navy']} 58%)"></div>
  <div class="abs eyebrow" style="left:80px;top:560px;color:{C['silver']}">Why a hidden gap still matters</div>
  <div class="abs hl" style="left:80px;top:610px;width:920px;font-size:86px;color:{C['wh']}">Nobody can see the gap. <i>Your jaw can.</i></div>
  <div class="abs body" style="left:80px;top:800px;width:760px;color:#d6d7de">Without a root, the bone underneath slowly shrinks. An implant puts the root back.</div>
  <div class="rule" style="left:80px;top:925px;width:920px;background:rgba(255,255,255,.16)"></div>
  <div class="abs" style="left:80px;top:965px">{wordmark(C['wh'], 154)}</div>
  <div class="abs" style="left:660px;top:950px">{cta(CTA_CONS, 'light', 19)}</div>"""))
    # P4 a lot of money for one tooth
    b.append(board("P4", nm("A lot for one tooth", "No talent", "Written plan", "1x1"), "s1", C["navy"], f"""
  <div class="abs" style="left:770px;top:-60px;width:420px;opacity:.07;color:{C['wh']}">{MONO}</div>
  <div class="abs hl" style="left:80px;top:96px;width:900px;font-size:76px;color:{C['wh']}">&ldquo;That's a lot of money <i>for one tooth.</i>&rdquo;</div>
  <div class="abs body" style="left:80px;top:268px;width:860px;color:#d6d7de">We agree. So you see every cost in writing before you decide anything.</div>
  {plan_card(140, 455, 560, 0.92)}
  <div class="abs" style="left:80px;top:372px">{proof(C['silver'], 18)}</div>
  <div class="abs" style="left:80px;top:965px">{wordmark(C['wh'], 154)}</div>
  <div class="abs" style="left:660px;top:950px">{cta(CTA_CONS, 'light', 19)}</div>"""))
    # P5 talked through every step
    b.append(board("P5", nm("Every step explained", "Simon", "Fear of procedure", "1x1"), "s1", C["stone"], f"""
  {photo(0, 0, 1080, 640, 'simon-patient-model.jpg', fx=.45, fy=.45)}
  <div class="abs" style="left:0;top:560px;width:1080px;height:520px;background:{C['stone']};border-radius:540px 540px 0 0/120px 120px 0 0"></div>
  <div class="abs hl" style="left:80px;top:640px;width:920px;font-size:70px;color:{C['navy']}">It never seemed like something <i>you could have done.</i></div>
  <div class="abs body" style="left:80px;top:810px;width:900px;color:{C['ch']}">Every step explained before anything starts. Nothing happens until you're ready.</div>
  <div class="abs" style="left:80px;top:960px">{cta(CTA_CONS, 'dark', 20)}</div>
  <div class="abs" style="left:480px;top:983px">{proof(C['slate'], 17)}</div>
  <div class="abs" style="left:880px;top:952px">{wordmark(C['navy'], 120)}</div>"""))
    return page("Rothley | Peter | 1x1", b)


def peter_9x16():
    # Safe zones: key copy stays out of the top 250px and bottom 340px.
    b = []
    b.append(board("P1v", nm("You've got used to the gap", "Simon", "Accommodation", "9x16"), "s9", C["navy"], f"""
  {arch(150, 300, 780, 760, 'simon-scan-patient.jpg', fx=.42, fy=.5, line=C['silver'], gap=20)}
  <div class="cover" style="top:900px;height:200px;background:linear-gradient(180deg,rgba(21,25,44,0),{C['navy']})"></div>
  <div class="abs eyebrow" style="left:90px;top:1110px;color:{C['silver']}">Dental implants in Staines</div>
  <div class="abs hl" style="left:90px;top:1160px;width:900px;font-size:76px;color:{C['wh']}">You've got so used to the gap, <i>you chew on the other side.</i></div>
  <div class="abs body" style="left:90px;top:1405px;width:820px;color:#d6d7de">A tooth that feels like yours again, planned around a 3D scan.</div>
  <div class="abs" style="left:90px;top:1520px">{cta(CTA_IMP)}</div>
  <div class="abs" style="left:90px;top:130px">{wordmark(C['wh'], 168)}</div>
  <div class="abs" style="left:90px;top:1640px">{proof(C['silver'])}</div>"""))
    b.append(board("P2v", nm("One gap three options", "Simon", "Implant bridge denture", "9x16"), "s9", C["off"], f"""
  {arch(330, 290, 420, 520, 'simon-smile-model.jpg', fx=.5, fy=.2, line=C['silver'], gap=16)}
  <div class="abs eyebrow" style="left:90px;top:870px;color:{C['slate']}">Missing a tooth?</div>
  <div class="abs hl" style="left:90px;top:920px;width:900px;font-size:88px;color:{C['navy']}">One gap. <i>Three honest options.</i></div>
  {options_list(90, 1130, 900, C['navy'], C['ch'], '#d6d3cc', 25, 24)}
  <div class="abs" style="left:90px;top:130px">{wordmark(C['navy'], 168)}</div>
  <div class="abs" style="left:90px;top:1620px">{cta(CTA_CONS, 'dark', 21)}</div>"""))
    b.append(board("P3v", nm("Nobody can see it", "Simon", "Bone loss", "9x16"), "s9", C["navy"], f"""
  {photo(0, 0, 1080, 1180, 'simon-xray.jpg', fx=.5, fy=.3)}
  <div class="cover" style="background:linear-gradient(180deg,rgba(21,25,44,.1) 0%,rgba(21,25,44,.1) 22%,rgba(21,25,44,.25) 45%,{C['navy']} 64%)"></div>
  <div class="abs eyebrow" style="left:90px;top:1020px;color:{C['silver']}">Why a hidden gap still matters</div>
  <div class="abs hl" style="left:90px;top:1072px;width:900px;font-size:94px;color:{C['wh']}">Nobody can see the gap. <i>Your jaw can.</i></div>
  <div class="abs body" style="left:90px;top:1300px;width:880px;color:#d6d7de">Without a root, the bone underneath slowly shrinks. An implant puts the root back.</div>
  <div class="abs" style="left:90px;top:1460px">{cta(CTA_CONS)}</div>
  <div class="abs" style="left:822px;top:1442px">{wordmark(C['wh'], 168)}</div>"""))
    b.append(board("P4v", nm("A lot for one tooth", "No talent", "Written plan", "9x16"), "s9", C["navy"], f"""
  <div class="abs" style="left:640px;top:200px;width:560px;opacity:.07;color:{C['wh']}">{MONO}</div>
  <div class="abs hl" style="left:90px;top:300px;width:900px;font-size:88px;color:{C['wh']}">&ldquo;That's a lot of money <i>for one tooth.</i>&rdquo;</div>
  <div class="abs body" style="left:90px;top:540px;width:860px;color:#d6d7de">We agree. So you see every cost in writing before you decide anything.</div>
  {plan_card(150, 720, 780, 1.25)}
  <div class="abs" style="left:90px;top:1500px">{proof(C['silver'])}</div>
  <div class="abs" style="left:90px;top:1560px">{cta(CTA_CONS)}</div>
  <div class="abs" style="left:90px;top:130px">{wordmark(C['wh'], 168)}</div>"""))
    b.append(board("P5v", nm("Every step explained", "Simon", "Fear of procedure", "9x16"), "s9", C["stone"], f"""
  {photo(0, 0, 1080, 1100, 'simon-patient-model.jpg', fx=.4, fy=.45)}
  <div class="abs" style="left:0;top:1000px;width:1080px;height:920px;background:{C['stone']};border-radius:540px 540px 0 0/140px 140px 0 0"></div>
  <div class="abs hl" style="left:90px;top:1090px;width:900px;font-size:80px;color:{C['navy']}">It never seemed like something <i>you could have done.</i></div>
  <div class="abs body" style="left:90px;top:1380px;width:880px;color:{C['ch']}">Every step explained before anything starts. Nothing happens until you're ready.</div>
  <div class="abs" style="left:90px;top:1520px">{cta(CTA_CONS, 'dark', 21)}</div>
  <div class="abs" style="left:90px;top:1625px">{proof(C['slate'])}</div>
  <div class="abs" style="left:822px;top:1500px">{wordmark(C['navy'], 168)}</div>"""))
    return page("Rothley | Peter | 9x16", b)


# ================================================================ shared templates (all other personas)
# Text columns use normal HTML flow (a flex stack) so headlines of any length push the lines below them down.
# Auto layout from the capture is stripped in Figma afterwards, so positions stay where they render.
LT = "#d6d7de"   # body text on navy


def stack(x, y, w, items, gap=30, extra=""):
    inner = "".join(f"<div>{i}</div>" for i in items if i)
    return (f'<div class="abs" data-name="Text" style="left:{x}px;top:{y}px;width:{w}px;display:flex;'
            f'flex-direction:column;gap:{gap}px;{extra}">{inner}</div>')


def hl(text, size, color, width=None):
    w = f"width:{width}px;" if width else ""
    return f'<div class="hl" style="font-size:{size}px;color:{color};{w}">{text}</div>'


def eb(text, color):
    return f'<div class="eyebrow" style="color:{color}">{text}</div>' if text else ""


def bd(text, color, size=27):
    return f'<div class="body" style="font-size:{size}px;color:{color}">{text}</div>' if text else ""


def tone(bg):
    """Colours for type on a given ground."""
    if bg == C["navy"]:
        return dict(hl=C["wh"], body=LT, eb=C["silver"], proof=C["silver"], cta="light", logo=C["wh"], rule="rgba(255,255,255,.16)", line=C["silver"], mono=C["wh"])
    return dict(hl=C["navy"], body=C["ch"], eb=C["slate"], proof=C["slate"], cta="dark", logo=C["navy"], rule="#d6d3cc", line=C["silver"], mono=C["navy"])


# --- A: arch photo beside the type (1x1) / above it (9x16)
def A1(c):
    k = tone(c["bg"])
    return f"""
  {arch(612, 150, 388, 640, c['img'], fx=c.get('fx', .5), fy=c.get('fy', .4), zoom=c.get('zoom', 1), line=k['line'])}
  {stack(80, 96, 500, [eb(c.get('eb'), k['eb']), hl(c['hl'], c.get('hs', 72), k['hl']), bd(c['body'], k['body'], 26),
                       proof(k['proof']) if c.get('proof', True) else '', cta(c['cta'], k['cta'])], 30)}
  <div class="rule" style="left:80px;top:925px;width:920px;background:{k['rule']}"></div>
  <div class="abs" style="left:80px;top:952px">{wordmark(k['logo'], 154)}</div>"""


def A9(c):
    k = tone(c["bg"])
    return f"""
  <div class="abs" style="left:90px;top:130px">{wordmark(k['logo'], 168)}</div>
  {arch(150, 330, 780, 720, c['img'], fx=c.get('fx', .5), fy=c.get('fy', .4), zoom=c.get('zoom', 1), line=k['line'], gap=20)}
  {stack(90, 1110, 900, [eb(c.get('eb'), k['eb']), hl(c['hl'], c.get('hs9', 76), k['hl']), bd(c['body'], k['body'], 28),
                         cta(c['cta'], k['cta'], 22), proof(k['proof']) if c.get('proof', True) else ''], 34)}"""


# --- B: full-width photo fading into navy, type underneath
def B1(c):
    return f"""
  {photo(0, 0, 1080, 620, c['img'], fx=c.get('fx', .5), fy=c.get('fy', .35), zoom=c.get('zoom', 1))}
  <div class="cover" style="background:linear-gradient(180deg,rgba(21,25,44,.1) 0%,rgba(21,25,44,.3) 36%,{C['navy']} 58%)"></div>
  {stack(80, 0, 920, [eb(c.get('eb'), C['silver']), hl(c['hl'], c.get('hs', 80), C['wh']), bd(c['body'], LT, 26)], 24,
         'top:auto;bottom:190px')}
  <div class="rule" style="left:80px;top:925px;width:920px;background:rgba(255,255,255,.16)"></div>
  <div class="abs" style="left:80px;top:952px">{wordmark(C['wh'], 154)}</div>
  <div class="abs" style="right:80px;top:950px">{cta(c['cta'], 'light', 19)}</div>"""


def B9(c):
    return f"""
  {photo(0, 0, 1080, 1180, c['img'], fx=c.get('fx9', c.get('fx', .5)), fy=c.get('fy', .35), zoom=c.get('zoom9', 1))}
  <div class="cover" style="background:linear-gradient(180deg,rgba(21,25,44,.1) 0%,rgba(21,25,44,.45) 40%,{C['navy']} 56%)"></div>
  {stack(90, 0, 900, [eb(c.get('eb'), C['silver']), hl(c['hl'], c.get('hs9', 88), C['wh']), bd(c['body'], LT, 28),
                      cta(c['cta'], 'light', 22), proof(C['silver']) if c.get('proof', True) else ''], 32, 'top:auto;bottom:420px')}
  <div class="abs" style="left:90px;top:1640px">{wordmark(C['wh'], 150)}</div>"""


# --- C: photo with the curved stone panel rising over it
def C1(c):
    return f"""
  {photo(0, 0, 1080, 660, c['img'], fx=c.get('fx', .5), fy=c.get('fy', .45), zoom=c.get('zoom', 1))}
  <div class="abs" data-name="Panel" style="left:0;top:560px;width:1080px;height:520px;background:{C['stone']};border-radius:540px 540px 0 0/120px 120px 0 0"></div>
  {stack(80, 625, 920, [hl(c['hl'], c.get('hs', 66), C['navy']), bd(c['body'], C['ch'], 26)], 20)}
  <div class="abs" style="left:80px;top:960px">{cta(c['cta'], 'dark', 20)}</div>
  <div class="abs" style="left:880px;top:952px">{wordmark(C['navy'], 120)}</div>"""


def C9(c):
    return f"""
  {photo(0, 0, 1080, 1100, c['img'], fx=c.get('fx9', c.get('fx', .5)), fy=c.get('fy', .45), zoom=c.get('zoom9', 1))}
  <div class="abs" data-name="Panel" style="left:0;top:1000px;width:1080px;height:920px;background:{C['stone']};border-radius:540px 540px 0 0/140px 140px 0 0"></div>
  {stack(90, 1090, 900, [hl(c['hl'], c.get('hs9', 78), C['navy']), bd(c['body'], C['ch'], 28),
                         cta(c['cta'], 'dark', 22), proof(C['slate']) if c.get('proof', True) else ''], 30)}
  <div class="abs" style="left:822px;top:1530px">{wordmark(C['navy'], 168)}</div>"""


# --- D: type-led with a device (card, stat, list) in the flow
def D1(c):
    k = tone(c["bg"])
    wm = (f'<div class="abs" data-name="Monogram watermark" style="left:760px;top:-70px;width:400px;opacity:.06;color:{k["mono"]}">{MONO}</div>'
          if c.get("wm", True) else "")
    items = [eb(c.get('eb'), k['eb']), hl(c['hl'], c.get('hs', 74), k['hl'], c.get('hw')), bd(c.get('body'), k['body'], 26),
             f'<div style="margin-top:{c.get("dm", 14)}px">{c["dev1"]}</div>' if c.get("dev1") else ""]
    return f"""{wm}
  {stack(80, 70, 920, items, 24, 'height:840px;justify-content:center')}
  <div class="rule" style="left:80px;top:925px;width:920px;background:{k['rule']}"></div>
  <div class="abs" style="left:80px;top:952px">{wordmark(k['logo'], 154)}</div>
  <div class="abs" style="right:80px;top:950px">{cta(c['cta'], k['cta'], 19)}</div>"""


def D9(c):
    k = tone(c["bg"])
    wm = (f'<div class="abs" data-name="Monogram watermark" style="left:620px;top:180px;width:560px;opacity:.06;color:{k["mono"]}">{MONO}</div>'
          if c.get("wm", True) else "")
    items = [eb(c.get('eb'), k['eb']), hl(c['hl'], c.get('hs9', 84), k['hl']), bd(c.get('body'), k['body'], 28),
             f'<div style="margin-top:{c.get("dm9", 24)}px">{c["dev9"]}</div>' if c.get("dev9") else "",
             f'<div style="margin-top:20px;display:flex;flex-direction:column;align-items:flex-start;gap:26px">{cta(c["cta"], k["cta"], 22)}'
             f'{proof(k["proof"]) if c.get("proof", True) else ""}</div>']
    return f"""{wm}
  <div class="abs" style="left:90px;top:130px">{wordmark(k['logo'], 168)}</div>
  {stack(90, 280, 900, items, 30, 'height:1300px;justify-content:center')}"""


T = {"A": (A1, A9), "B": (B1, B9), "C": (C1, C9), "D": (D1, D9)}


def build_persona(key, title, concepts):
    b1, b9 = [], []
    for c in concepts:
        f1, f9 = T[c["t"]]
        bg = c.get("bg", C["navy"] if c["t"] == "B" else C["stone"] if c["t"] == "C" else C["navy"])
        cc = dict(c, bg=bg)
        b1.append(board(c["id"], nm(c["name"], c["talent"], c["detail"], "1x1"), "s1", bg, f1(cc)))
        b9.append(board(c["id"] + "v", nm(c["name"], c["talent"], c["detail"], "9x16"), "s9", bg, f9(cc)))
    return (lambda: page(f"Rothley | {title} | 1x1", b1)), (lambda: page(f"Rothley | {title} | 9x16", b9))


# ---------------------------------------------------------------- devices
def paper(inner, w, s=1.0, rot=-1.4, pad=(44, 48), bg=None):
    return (f'<div data-name="Card" style="width:{w}px;padding:{pad[0] * s:.0f}px {pad[1] * s:.0f}px;background:{bg or C["off"]};'
            f'border-radius:10px;transform:rotate({rot}deg);color:{C["navy"]};box-shadow:0 34px 64px rgba(0,0,0,.35),0 6px 14px rgba(0,0,0,.2)">{inner}</div>')


def dev_list(label, title, rows, w=620, s=1.0, rot=-1.4, foot=None, mark="num", strike=()):
    def bullet(i):
        if mark == "tick":
            return (f'<svg viewBox="0 0 24 24" width="{24 * s:.0f}" height="{24 * s:.0f}" fill="none" stroke="currentColor" '
                    f'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.2 4.2L19 7"/></svg>')
        if mark == "box":
            return f'<div style="width:{24 * s:.0f}px;height:{24 * s:.0f}px;border:1.5px solid {C["navy"]};border-radius:4px"></div>'
        return (f'<div style="width:{28 * s:.0f}px;height:{28 * s:.0f}px;border-radius:50%;border:1.5px solid {C["navy"]};display:flex;'
                f'align-items:center;justify-content:center;font-size:{14 * s:.0f}px;font-weight:600">{i + 1}</div>')
    rows_h = "".join(
        f'<div style="display:flex;align-items:center;gap:{18 * s:.0f}px;padding:{16 * s:.0f}px 0;border-bottom:1px solid #d9d6cf">'
        f'<div style="flex:none">{bullet(i)}</div><div style="font-size:{24 * s:.0f}px;font-weight:500;'
        f'{"text-decoration:line-through;color:" + C["slate"] if i in strike else ""}">{r}</div></div>' for i, r in enumerate(rows))
    head = (f'<div style="display:flex;justify-content:space-between;align-items:center">'
            f'<div class="eyebrow" style="font-size:{15 * s:.0f}px;color:{C["slate"]}">{label}</div>'
            f'<div style="width:{30 * s:.0f}px;color:{C["navy"]}">{MONO}</div></div>'
            f'<div class="hl" style="font-size:{44 * s:.0f}px;margin:{12 * s:.0f}px 0 {8 * s:.0f}px">{title}</div>')
    ft = (f'<div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:{20 * s:.0f}px">'
          f'<div style="font-size:{20 * s:.0f}px;color:{C["slate"]}">{foot[0]}</div>'
          f'<div class="hl" style="font-size:{42 * s:.0f}px">{foot[1]}</div></div>') if foot else ""
    return paper(head + rows_h + ft, w, s, rot)


def dev_stat(num, label, color, sub_color, size=300, w=900):
    return (f'<div data-name="Stat" style="display:flex;align-items:flex-end;gap:36px;width:{w}px">'
            f'<div class="hl" style="font-size:{size}px;line-height:.82;color:{color};letter-spacing:-.03em">{num}</div>'
            f'<div class="body" style="font-size:{size * .1:.0f}px;line-height:1.35;color:{sub_color};padding-bottom:{size * .06:.0f}px">{label}</div></div>')


def dev_cols(cols, s=1.0, dark=True, w=920):
    bg, fg, sub = (C["navy2"], C["wh"], LT) if dark else (C["wh"], C["navy"], C["slate"])
    cards = "".join(
        f'<div style="flex:1;padding:{30 * s:.0f}px {26 * s:.0f}px;border-radius:18px;background:{bg};border:1px solid rgba(149,151,162,.35)">'
        f'<div class="hl" style="font-size:{40 * s:.0f}px;color:{fg}"><i>{a}</i></div>'
        f'<div class="body" style="font-size:{21 * s:.0f}px;line-height:1.45;color:{sub};margin-top:{10 * s:.0f}px">{b}</div></div>'
        for a, b in cols)
    return f'<div data-name="Columns" style="display:flex;gap:{18 * s:.0f}px;width:{w}px">{cards}</div>'


def dev_steps(steps, s=1.0, dark=True, w=920):
    fg, sub, line = (C["wh"], LT, "rgba(149,151,162,.5)") if dark else (C["navy"], C["slate"], "#cfccc4")
    items = "".join(
        f'<div style="flex:1;position:relative;padding-top:{70 * s:.0f}px">'
        f'<div style="position:absolute;top:0;left:0;width:{50 * s:.0f}px;height:{50 * s:.0f}px;border-radius:50%;border:1.5px solid {C["silver"]};'
        f'background:{C["navy"] if dark else C["stone"]};display:flex;align-items:center;justify-content:center;color:{fg};font-weight:600;font-size:{19 * s:.0f}px">{i + 1}</div>'
        f'<div class="hl" style="font-size:{31 * s:.0f}px;line-height:1.08;color:{fg}">{a}</div>'
        f'<div class="body" style="font-size:{19 * s:.0f}px;line-height:1.4;color:{sub};margin-top:{8 * s:.0f}px">{b}</div></div>'
        for i, (a, b) in enumerate(steps))
    return (f'<div data-name="Steps" style="position:relative;display:flex;gap:{22 * s:.0f}px;width:{w}px">'
            f'<div style="position:absolute;left:{25 * s:.0f}px;right:{40 * s:.0f}px;top:{25 * s:.0f}px;height:1px;background:{line}"></div>{items}</div>')


def dev_steps_v(steps, s=1.0, dark=True, w=900):
    fg, sub, line = (C["wh"], LT, "rgba(149,151,162,.5)") if dark else (C["navy"], C["slate"], "#cfccc4")
    items = "".join(
        f'<div style="display:flex;gap:{30 * s:.0f}px;align-items:center;padding:{18 * s:.0f}px 0;position:relative">'
        f'<div style="flex:none;width:{64 * s:.0f}px;height:{64 * s:.0f}px;border-radius:50%;border:1.5px solid {C["silver"]};background:{C["navy"] if dark else C["stone"]};'
        f'display:flex;align-items:center;justify-content:center;color:{fg};font-weight:600;font-size:{22 * s:.0f}px;position:relative;z-index:1">{i + 1}</div>'
        f'<div><div class="hl" style="font-size:{44 * s:.0f}px;line-height:1.05;color:{fg}">{a}</div>'
        f'<div class="body" style="font-size:{24 * s:.0f}px;color:{sub};margin-top:{4 * s:.0f}px">{b}</div></div></div>'
        for i, (a, b) in enumerate(steps))
    return (f'<div data-name="Steps" style="position:relative;width:{w}px">'
            f'<div style="position:absolute;left:{32 * s:.0f}px;top:{50 * s:.0f}px;bottom:{50 * s:.0f}px;width:1px;background:{line}"></div>{items}</div>')


def dev_menu(items, w=560, s=1.0, rot=1.6):
    rows = "".join(
        f'<div style="display:flex;justify-content:space-between;align-items:baseline;padding:{13 * s:.0f}px 0;'
        f'{"text-decoration:line-through;color:" + C["slate"] if strike else ""}">'
        f'<div class="hl" style="font-size:{31 * s:.0f}px">{name}</div><div style="font-size:{18 * s:.0f}px;color:{C["slate"]}">{note}</div></div>'
        for name, note, strike in items)
    inner = (f'<div class="eyebrow" style="text-align:center;font-size:{15 * s:.0f}px;color:{C["slate"]}">Tonight\'s menu</div>'
             f'<div style="height:1px;background:#d9d6cf;margin:{18 * s:.0f}px 0 {8 * s:.0f}px"></div>{rows}')
    return paper(inner, w, s, rot, pad=(40, 46))


def dev_notif(app, title, text, time, w=760, s=1.0):
    return (f'<div data-name="Notification" style="width:{w}px;padding:{24 * s:.0f}px {28 * s:.0f}px;border-radius:{30 * s:.0f}px;'
            f'background:rgba(248,247,244,.94);color:{C["ch"]};box-shadow:0 24px 50px rgba(0,0,0,.35);display:flex;gap:{20 * s:.0f}px;align-items:flex-start">'
            f'<div style="flex:none;width:{58 * s:.0f}px;height:{58 * s:.0f}px;border-radius:{14 * s:.0f}px;background:{C["navy"]};color:{C["wh"]};'
            f'display:flex;align-items:center;justify-content:center"><div style="width:{26 * s:.0f}px">{MONO}</div></div>'
            f'<div style="flex:1"><div style="display:flex;justify-content:space-between;font-size:{17 * s:.0f}px;color:{C["slate"]};font-weight:600;'
            f'letter-spacing:.04em;text-transform:uppercase"><span>{app}</span><span style="text-transform:none;font-weight:500">{time}</span></div>'
            f'<div style="font-size:{24 * s:.0f}px;font-weight:700;margin-top:{6 * s:.0f}px">{title}</div>'
            f'<div style="font-size:{22 * s:.0f}px;line-height:1.4;margin-top:{4 * s:.0f}px">{text}</div></div></div>')


def dev_clock(time, date, s=1.0, color=None):
    color = color or C["wh"]
    return (f'<div data-name="Clock" style="text-align:center;color:{color}">'
            f'<div style="font-size:{26 * s:.0f}px;font-weight:500;opacity:.8">{date}</div>'
            f'<div style="font-size:{170 * s:.0f}px;font-weight:300;letter-spacing:-.02em;line-height:1.05">{time}</div></div>')


def dev_wave(w=920, h=200, color=None):
    color = color or C["silver"]
    pts, x = [], 0
    import math
    path = "M0 %d" % (h * .7)
    for i in range(1, 61):
        x = w * i / 60
        amp = (h * .15) + (h * .32) * (i / 60)
        y = h * .62 - amp * max(0, math.sin(i / 60 * math.pi * 6)) ** 1.6
        path += f" L{x:.0f} {y:.0f}"
    return (f'<svg data-name="Pain line" width="{w}" height="{h}" viewBox="0 0 {w} {h}" fill="none">'
            f'<path d="{path}" stroke="{color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>'
            f'<line x1="0" y1="{h * .62:.0f}" x2="{w}" y2="{h * .62:.0f}" stroke="{color}" stroke-opacity=".3" stroke-dasharray="4 8"/></svg>')


def arch_inline(img, w, h, fx=.5, fy=.4, line=None, gap=14):
    """An arch photo as a flow element (for type-led layouts)."""
    r = f"{w / 2:.0f}px {w / 2:.0f}px 0 0"
    ln = (f'<div style="position:absolute;left:-{gap}px;top:-{gap}px;width:{w + 2 * gap}px;height:{h + gap}px;border:1.5px solid {line};'
          f'border-bottom:none;border-radius:{w / 2 + gap:.0f}px {w / 2 + gap:.0f}px 0 0"></div>') if line else ""
    return (f'<div style="position:relative;width:{w}px;height:{h}px;margin-left:{gap}px">{ln}'
            f'<div data-name="Photo" style="position:absolute;inset:0;border-radius:{r};{fill(w, h, img, fx, fy)}"></div></div>')


N, ST, OF = C["navy"], C["stone"], C["off"]
CB = "Book a call back"
CC = "Book a check-up"
CF = "Book the family in"

# ---------------------------------------------------------------- LINDA (loose denture, Implants)
LINDA = [
    dict(id="L1", t="D", name="Adhesive every morning", talent="No talent", detail="Morning routine", eb="Wear a denture?",
         hl="Still using adhesive <i>every morning?</i>", hs=78,
         body="There's another way. Your denture can clip onto implants, so it stays put.",
         dev1=dev_list("Every morning", "The <i>routine</i>", ["Kettle on", "Glasses on", "Adhesive in", "Hope it lasts past lunch"], 620, 1.0, -1.6, mark="box"),
         dev9=dev_list("Every morning", "The <i>routine</i>", ["Kettle on", "Glasses on", "Adhesive in", "Hope it lasts past lunch"], 760, 1.2, -1.6, mark="box"),
         cta=CTA_CONS, top=80),
    dict(id="L2", t="D", bg=ST, name="Order what you fancy", talent="No talent", detail="Menu", wm=False,
         hl="You read the menu for what you can manage, <i>not what you fancy.</i>", hs=64,
         body="Implants hold your teeth firm, so you can bite into food again.",
         dev1=dev_menu([("Soup of the day", "", False), ("Fish pie", "", False), ("Steak frites", "too chewy", True), ("Apple tart", "too hard", True)], 560, .86, 1.8),
         dev9=dev_menu([("Soup of the day", "", False), ("Fish pie", "", False), ("Steak frites", "too chewy", True), ("Crusty bread", "skip", True), ("Apple tart", "too hard", True)], 720, 1.15, 1.8),
         cta=CTA_CONS, proof=False),
    dict(id="L3", t="A", name="Laugh without checking", talent="Interior", detail="Lounge", eb="Dentures and implants",
         hl="You laugh with your hand near your mouth. <i>Just in case.</i>", hs=64,
         body="Implants hold your teeth firmly, so you can stop checking.", img="lounge-tall.jpg", fx=.5, fy=.5, cta=CTA_CONS),
    dict(id="L4", t="B", name="Too old for implants", talent="No talent", detail="Teeth model", eb="A question we hear a lot",
         hl="&ldquo;Am I too old <i>for implants?</i>&rdquo;", hs=84,
         body="It depends on your bone and your health, not your birthday. A 3D scan tells us.",
         img="model-logo-full.jpg", fx=.3, fy=.5, fx9=.22, cta=CTA_CONS),
    dict(id="L5", t="C", name="Why dentures loosen", talent="Nurse", detail="3D scan", 
         hl="Why does your denture feel <i>looser every year?</i>", hs=62,
         body="Without roots, the bone underneath slowly shrinks. Implants give it a reason to stay.",
         img="nurse-scanner.jpg", fx=.55, fy=.3, cta=CTA_CONS),
]

# ---------------------------------------------------------------- GEOFF (full arch, Implants)
GEOFF = [
    dict(id="G1", t="D", name="Stop patching", talent="No talent", detail="Repairs list", eb="Full arch implants in Staines",
         hl="Another filling. Another crown. <i>Another repair.</i>", hs=72,
         body="A full arch on implants is planned once, around a 3D scan of your jaw. Led by Dr Simon Chard.",
         dev1=dev_list("Your dental history", "Repairs, <i>so far</i>", ["Filling", "Crown", "Root canal", "Another filling"], 560, .92, -1.4, mark="tick", strike=(0, 1, 2, 3)),
         dev9=dev_list("Your dental history", "Repairs, <i>so far</i>", ["Filling", "Crown", "Root canal", "Another filling", "Another crown"], 740, 1.15, -1.4, mark="tick", strike=(0, 1, 2, 3, 4)),
         cta=CTA_CONS, top=80),
    dict(id="G2", t="B", name="Who looks after it", talent="Exterior", detail="Townhouse", eb="Comparing full-arch quotes?",
         hl="Ask one more question: <i>who looks after it in year five?</i>", hs=70,
         body="Checks, cleaning and fixes, right here in Staines. We've been here for generations.",
         img="exterior-full.jpg", fx=.55, fy=.4, fx9=.6, cta=CTA_CONS),
    dict(id="G3", t="A", name="Choose the dentist", talent="Simon", detail="Portrait", eb="Full arch implants",
         hl="For a full arch, choose the dentist, <i>not the deal.</i>", hs=66,
         body="Dr Simon Chard. Past President, British Academy of Cosmetic Dentistry.", img="head-21.jpg", fx=.5, fy=.2, cta=CTA_CONS),
    dict(id="G4", t="D", name="Start with a scan", talent="No talent", detail="Steps", eb="Full arch implants",
         hl="You don't have to decide on a full arch <i>today.</i>", hs=72,
         body="Step one is a consultation and a 3D scan. Then you'll know what's possible.",
         dev1=dev_steps([("Consultation", "From £199"), ("3D scan", "See your bone in detail"), ("Written plan", "Every cost, in writing"), ("Your call", "In your own time")], 1.2),
         dev9=dev_steps_v([("Consultation", "From £199"), ("3D scan", "See your bone in detail"), ("Written plan", "Every cost, in writing"), ("Your call", "In your own time, no deadline")], 1.0),
         cta=CTA_CONS, top=90),
    dict(id="G5", t="C", name="Decide before your teeth do", talent="Simon", detail="Loupes", 
         hl="Take control before your teeth <i>decide for you.</i>", hs=66,
         body="A fixed, full set of teeth, planned around a 3D scan of your jaw.", img="simon-loupes-full.jpg", fx=.45, fy=.35, fx9=.45, cta=CTA_CONS),
]

# ---------------------------------------------------------------- NICOLA (front tooth, Implants)
NICOLA = [
    dict(id="N1", t="A", name="Lost a front tooth", talent="Reception", detail="Call back", eb="Lost a front tooth?",
         hl="Breathe. <i>Tell us what happened.</i>", hs=78,
         body="We'll call you back and talk you through your options to cover the gap.", img="reception-phone.jpg", fx=.5, fy=.3, cta=CB),
    dict(id="N2", t="D", name="Front tooth step by step", talent="No talent", detail="Steps", eb="Replacing a front tooth",
         hl="A front tooth, <i>step by step.</i>", hs=84, body="Every stage explained before it starts, and every cost in writing.",
         dev1=dev_steps([("Scan and plan", "3D scan, then a plan"), ("Temporary tooth", "Covers the gap"), ("Implant heals", "Bone grows around it"), ("Final tooth", "Shade-matched")], 1.2),
         dev9=dev_steps_v([("Scan and plan", "A 3D scan, then your plan"), ("Temporary tooth", "Covers the gap while you heal"), ("Implant heals", "The bone grows around it"), ("Final tooth", "Shade-matched to the teeth beside it")], 1.0),
         cta=CTA_CONS, top=100),
    dict(id="N3", t="B", name="Nobody can pick it out", talent="No talent", detail="Teeth model", eb="Front tooth implants",
         hl="The goal: a front tooth <i>nobody can pick out.</i>", hs=78,
         body="Shade, shape and translucency matched to the teeth beside it.", img="model-logo-full.jpg", fx=.25, fy=.5, fx9=.2, cta=CTA_CONS, proof=False),
    dict(id="N4", t="C", name="Broken not lost", talent="Nurse", detail="Digital scan", 
         hl="Broken a front tooth? <i>It might be one visit.</i>", hs=64,
         body="If enough tooth is left, we can design, make and fit a ceramic crown in a single visit.", img="nurse-scanner.jpg", fx=.6, fy=.3, cta=CB),
    dict(id="N5", t="D", bg=ST, name="Skip the glue", talent="No talent", detail="Type", wm=False,
         hl="Before you reach for the <i>pharmacy glue&hellip;</i>", hs=88,
         body="Call us. A front tooth deserves a proper fix, and there's usually more we can do than you'd think.",
         dev1=arch_inline("reception-team.jpg", 380, 340, .45, .4, C["silver"]), dev9=arch_inline("reception-team.jpg", 620, 640, .45, .4, C["silver"]),
         cta=CB, top=96),
]

# ---------------------------------------------------------------- MARK (lapsed, New Patient)
MARK = [
    dict(id="M1", t="A", name="No lectures", talent="Interior", detail="Lounge", eb="Been a while?",
         hl="Nobody here will ask <i>why you left it so long.</i>", hs=66,
         body="People come back after years away all the time. We just start from today.", img="lounge-tall.jpg", fx=.5, fy=.55, cta=CC),
    dict(id="M2", t="D", name="That twinge", talent="No talent", detail="Reminder", eb="",
         hl="That twinge has been there <i>for weeks now.</i>", hs=80,
         body="You've been building up to this. Let's make the first step a small one.",
         dev1=dev_notif("Reminders", "Book the dentist", "Snoozed again", "now", 820, 1.3),
         dev9=dev_notif("Reminders", "Book the dentist", "Snoozed again", "now", 900, 1.25),
         cta="Book a check-up from £60", top=110),
    dict(id="M3", t="C", name="Not as bad as you think", talent="Clinician", detail="Consultation",
         hl="It's probably not as bad <i>as you've imagined.</i>", hs=66,
         body="We'll show you your x-rays on screen and tell you straight.", img="meghan-consult-full.jpg", fx=.4, fy=.3, fx9=.3, cta=CC),
    dict(id="M4", t="D", bg=ST, name="Your first visit", talent="No talent", detail="Steps", eb="Your first visit",
         hl="No surprises. <i>Here's what happens.</i>", hs=80, body="Check-up from £60. X-rays from £21 if you need them.",
         dev1=dev_steps([("Chat first", "Chair upright"), ("A look", "Teeth and gums"), ("X-rays", "If needed"), ("You decide", "Plan and costs")], 1.2, dark=False),
         dev9=dev_steps_v([("Chat first", "With the chair upright"), ("A look", "Teeth and gums"), ("X-rays", "Only if needed"), ("You decide", "Plan and costs, in writing")], 1.0, dark=False),
         cta=CC, top=100, wm=False),
    dict(id="M5", t="D", name="For people who'd rather not", talent="No talent", detail="Review counts", eb="For people who avoid the dentist",
         hl="You don't have to love it. <i>Just come back.</i>", hs=76, body="What our patients mention most in their Google reviews:",
         dev1=dev_cols([("79", "mention our caring staff"), ("29", "mention how calm it feels"), ("4.8", "from 593 Google reviews")], 1.4),
         dev9=dev_cols([("79", "mention our caring staff"), ("29", "mention how calm it feels"), ("4.8", "from 593 reviews")], 1.35),
         cta=CC, top=96, proof=False),
]

# ---------------------------------------------------------------- SOPHIE (family, New Patient)
SOPHIE = [
    dict(id="S1", t="B", name="New to Staines", talent="Exterior", detail="Townhouse", eb="New to Staines?",
         hl="Your family dentist has been here <i>for generations.</i>", hs=74,
         body="The oldest dental practice in Staines. Some families have been with us for four generations.", img="exterior-full.jpg", fx=.5, fy=.45, fx9=.55, cta=CF),
    dict(id="S2", t="A", name="One trip everyone seen", talent="Reception", detail="Booking", eb="Family check-ups",
         hl="One trip. <i>Everyone seen.</i>", hs=84,
         body="Book back-to-back family appointments, so the school run only happens once.", img="reception-card.jpg", fx=.5, fy=.3, cta=CF),
    dict(id="S3", t="D", name="Under fives free", talent="No talent", detail="Price", eb="Family dentistry in Staines",
         hl="Under 5? <i>Their check-ups are free.</i>", hs=78,
         dev1=dev_stat("£0", "for children aged 0 to 5<br>when a parent is a patient<br>at Rothley Lodge", C["wh"], LT, 330),
         dev9=dev_stat("£0", "for children aged 0 to 5 when a parent is a patient at Rothley Lodge", C["wh"], LT, 360),
         cta=CF, top=96),
    dict(id="S4", t="A", bg=OF, name="Nervous kid", talent="Clinician", detail="Smiling", eb="Children's dentistry",
         hl="Your child's nervous <i>about the dentist?</i>", hs=72,
         body="Ours are patient, gentle and explain every step to them first. Parents say so in our reviews.", img="meghan-smile.jpg", fx=.5, fy=.25, cta=CC),
    dict(id="S5", t="C", name="Family for generations", talent="Team", detail="Team photo",
         hl="Some of our patients came here as children. <i>Now they bring theirs.</i>", hs=58,
         body="Family dentistry in Staines, for four generations.", img="team-house.jpg", fx=.5, fy=.55, fx9=.5, zoom9=1.0, cta=CF),
]

# ---------------------------------------------------------------- DENISE (no NHS place, New Patient)
DENISE = [
    dict(id="D1", t="A", name="Lost your NHS dentist", talent="Reception", detail="Front desk", eb="Lost your NHS dentist?",
         hl="Private check-ups in Staines, <i>from £60.</i>", hs=74,
         body="A written plan with every cost before any treatment. And a straight answer on what can wait.", img="reception-writing.jpg", fx=.4, fy=.3, cta=CC),
    dict(id="D2", t="D", bg=ST, name="What a check-up costs", talent="No talent", detail="Price card", eb="A question worth answering",
         hl="How much is a private check-up, <i>really?</i>", hs=74, wm=False,
         dev1=dev_list("Fee guide", "New patient <i>check-up</i>", ["Examination: from £60", "X-rays, if needed: from £21", "Everything else: in writing first"], 680, 1.1, -1.2, mark="tick"),
         dev9=dev_list("Fee guide", "New patient <i>check-up</i>", ["Examination: from £60", "X-rays, if needed: from £21", "Everything else: in writing first"], 820, 1.2, -1.2, mark="tick"),
         cta=CC, top=96),
    dict(id="D3", t="D", name="Needed or can wait", talent="No talent", detail="Three columns", eb="Worried private means being sold to?",
         hl="What's needed. What can wait. <i>What isn't.</i>", hs=72,
         body="After your check-up, we sort it into three, in writing, and you decide.",
         dev1=dev_cols([("Now", "What needs doing soon"), ("Later", "What we can watch"), ("Never", "What doesn't need doing")], 1.4),
         dev9=dev_cols([("Now", "What needs doing soon"), ("Later", "What we can watch"), ("Never", "What doesn't need it")], 1.35),
         cta=CC, top=96),
    dict(id="D4", t="A", bg=OF, name="Spread it monthly", talent="Reception", detail="Booking", eb="Prefer a fixed monthly cost?",
         hl="Your dental care, <i>spread monthly.</i>", hs=76,
         body="Ask about Denplan. Your price is set after your first check-up, based on what your teeth need.", img="reception-card.jpg", fx=.5, fy=.3, cta=CC),
    dict(id="D5", t="D", name="The 45-minute clean", talent="No talent", detail="Stat", eb="Hygiene appointments",
         hl="A hygiene visit <i>that takes its time.</i>", hs=74,
         dev1=dev_stat("45", "minutes, with Airflow<br>stain removal. £110.<br>55 Google reviews mention<br>our hygienists.", C["wh"], LT, 330),
         dev9=dev_stat("45", "minutes, with Airflow stain removal. £110. 55 Google reviews mention our hygienists.", C["wh"], LT, 360),
         cta="Book now", top=96, proof=False),
]

# ---------------------------------------------------------------- RAY (in pain today, New Patient)
RAY = [
    dict(id="R1", t="D", name="Pain that comes and goes", talent="No talent", detail="Pain line", eb="Toothache?",
         hl="Pain that comes and goes is not pain <i>that's going.</i>", hs=74,
         body="Let us take a look before it decides for you.", dev1=dev_wave(920, 300), dev9=dev_wave(900, 420), cta=CB, top=90),
    dict(id="R2", t="D", name="Up at 11pm", talent="No talent", detail="Lock screen", eb="",
         hl="Toothache keeping you up <i>tonight?</i>", hs=78,
         body="Leave your details now. We'll call you back first thing to get you seen.",
         dev1=f'<div style="display:flex;gap:44px;align-items:center">{dev_clock("23:07", "Tuesday", .95)}{dev_notif("Rothley Lodge", "We will call you", "First thing tomorrow", "now", 480, 1.05)}</div>',
         dev9=f'<div style="display:flex;flex-direction:column;gap:40px;align-items:center;width:900px">{dev_clock("23:07", "Tuesday", 1.0)}{dev_notif("Rothley Lodge", "We will call you", "First thing tomorrow", "now", 820, 1.15)}</div>',
         cta=CB, top=96, proof=False),
    dict(id="R3", t="A", name="Tell reception it hurts", talent="Reception", detail="Phone", eb="Toothache?",
         hl="Tell reception <i>it hurts.</i>", hs=84,
         body="We'll find the earliest appointment we can. Sometimes that's today. 59 Google reviews mention our reception team.", img="reception-phone.jpg", fx=.5, fy=.3, cta=CB, proof=False),
    dict(id="R4", t="C", name="Quicker than imagined", talent="Clinician", detail="Treatment",
         hl="The worst part is usually <i>the waiting.</i>", hs=68,
         body="Our patients tell us the treatment was quicker and easier than they'd feared.", img="meghan-treating.jpg", fx=.5, fy=.4, fx9=.5, cta=CB),
    dict(id="R5", t="B", name="Get it looked at", talent="Exterior", detail="Porch", eb="Toothache?",
         hl="Been chewing on the other side <i>for a week?</i>", hs=74,
         body="That's your body telling you something. Check-ups from £60. Let us take a look.", img="porch-full.jpg", fx=.4, fy=.5, fx9=.3, cta=CB),
]

PERSONA_DEFS = {"linda": ("Linda", LINDA), "geoff": ("Geoff", GEOFF), "nicola": ("Nicola", NICOLA), "mark": ("Mark", MARK),
                "sophie": ("Sophie", SOPHIE), "denise": ("Denise", DENISE), "ray": ("Ray", RAY)}

PERSONAS = {"peter": (peter_1x1, peter_9x16)}
for _k, (_title, _cs) in PERSONA_DEFS.items():
    PERSONAS[_k] = build_persona(_k, _title, _cs)

if __name__ == "__main__":
    for p in sys.argv[1:] or PERSONAS:
        one, nine = PERSONAS[p]
        (ROOT / f"{p}-1x1.html").write_text(one())
        (ROOT / f"{p}-9x16.html").write_text(nine())
        print("wrote", p)
