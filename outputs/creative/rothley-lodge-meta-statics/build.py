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


PERSONAS = {"peter": (peter_1x1, peter_9x16)}

if __name__ == "__main__":
    for p in sys.argv[1:] or PERSONAS:
        one, nine = PERSONAS[p]
        (ROOT / f"{p}-1x1.html").write_text(one())
        (ROOT / f"{p}-9x16.html").write_text(nine())
        print("wrote", p)
