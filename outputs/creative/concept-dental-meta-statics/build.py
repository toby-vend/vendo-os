"""Build Concept Dental Meta static harness pages (one HTML page per persona per size).

Usage: python3 build.py   ->  <persona>-1x1.html and <persona>-9x16.html
Brand: Concept Dental guideline (Figma GSWCVxgeoCD3ClQVnAoZdQ, approved 19 Oct 2026).
Palette from the brand sheet; Montserrat; CD logo + monogram SVGs; devices: arch photo frame,
monogram watermark, check-up seal, hairline timeline, Coffee pill CTA, grain.
Photos: assets/photos (gitignored). Object shots are AI-generated objects only (no people);
site-*.jpg are the website's temporary stock, flagged for swap once the clinic is shot.
"""
import re
import struct
from pathlib import Path

ROOT = Path(__file__).parent
A = ROOT / "assets"

BLACK, TAUPE, COFFEE, MOSS, DUNE, VANILLA = "#252525", "#CAB39C", "#463A34", "#C3BDA0", "#E6DDCB", "#FCF6EE"
TAUPE_D, COFFEE_L = "#9C8670", "#54473F"

_LOGO = re.sub(r"^<svg[^>]*>", "", (A / "logo-site.svg").read_text().strip()).rsplit("</svg>", 1)[0]
_MARK = re.sub(r"^<svg[^>]*>", "", (A / "group-10.svg").read_text().strip()).rsplit("</svg>", 1)[0]


def logo(width, colour=COFFEE):
    return (f'<svg data-name="Logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 198 94" width="{width}" '
            f'height="{round(width * 94 / 198, 1)}" fill="none" style="display:block">{_LOGO.replace("#FCF6EE", colour)}</svg>')


def mark(width, colour=DUNE):
    return (f'<svg data-name="Monogram" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 35 37" width="{width}" '
            f'height="{round(width * 37 / 35, 1)}" fill="none" style="display:block">{_MARK.replace("#FCF6EE", colour)}</svg>')


GRAIN = ("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>"
         "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.9 0'/></filter>"
         "<rect width='100%' height='100%' filter='url(%23n)'/></svg>")

CSS = f"""
@font-face {{ font-family: Montserrat; src: url(assets/fonts/Montserrat.ttf); font-weight: 100 900; font-style: normal; }}
@font-face {{ font-family: Montserrat; src: url(assets/fonts/Montserrat-Italic.ttf); font-weight: 100 900; font-style: italic; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ background: #2a2a2a; font-family: Montserrat, sans-serif; display: flex; gap: 80px; padding: 80px; align-items: flex-start; -webkit-font-smoothing: antialiased; }}
.ab {{ position: relative; overflow: hidden; flex: none; color: {COFFEE}; }}
.s1 {{ width: 1080px; height: 1080px; }}
.s9 {{ width: 1080px; height: 1920px; }}
.abs {{ position: absolute; }}
.cover {{ position: absolute; inset: 0; }}
.grain {{ position: absolute; inset: 0; background-image: url("{GRAIN}"); background-size: 300px 300px; opacity: .12; mix-blend-mode: overlay; pointer-events: none; }}
.hl {{ font-weight: 300; letter-spacing: -.02em; line-height: 1.08; }}
.hl em {{ font-style: italic; font-weight: 400; }}
.body {{ font-size: 30px; font-weight: 400; line-height: 1.5; }}
.label {{ font-weight: 600; font-size: 18px; letter-spacing: .24em; text-transform: uppercase; }}
.cta {{ display: inline-flex; align-items: center; gap: 16px; height: 76px; padding: 0 40px; border-radius: 999px; font-size: 20px; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; white-space: nowrap; }}
.cta.dark {{ background: {COFFEE}; color: {VANILLA}; }}
.cta.light {{ background: {VANILLA}; color: {COFFEE}; }}
.arch {{ position: absolute; overflow: hidden; border-radius: 9999px 9999px 0 0; box-shadow: 0 30px 60px rgba(70,58,52,.18); }}
.price {{ font-weight: 200; letter-spacing: -.04em; line-height: .8; }}
.rule {{ height: 1px; background: {TAUPE}; }}
"""

ARROW = ('<svg width="{s}" height="{s}" viewBox="0 0 16 16" fill="none" style="display:block"><path d="M2 8h11M9 4l4 4-4 4" '
         'stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>')

CTA_CHECK = "Book your check-up"
CTA_IMPLANT = "Book a consultation"


def cta(text, kind="dark", size=20, h=76, pad=40):
    return (f'<span class="cta {kind}" data-name="CTA" style="font-size:{size}px;height:{h}px;padding:0 {pad}px">'
            f'{text}{ARROW.format(s=round(size * 1.1))}</span>')


def photo_aspect(img):
    """Width / height of a JPEG in assets/photos, read from the header (never stretch a photo)."""
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
            return w / h
        i += 2 + seg
    raise ValueError(img)


def photo(x, y, w, h, img, fx=0.5, fy=0.5, zoom=1.0, arch=True, radius=0, shadow=True):
    """Cover-crop a photo into an arch (or rectangle). fx/fy pick the focal point of the overflow."""
    a = photo_aspect(img)
    bw, bh = (w, w / a) if w / h > a else (h * a, h)
    bw, bh = bw * zoom, bh * zoom
    ox, oy = -(bw - w) * fx, -(bh - h) * fy
    cls = "arch" if arch else "abs"
    extra = "" if arch else f"overflow:hidden;border-radius:{radius}px;" + ("box-shadow:0 30px 60px rgba(70,58,52,.18);" if shadow else "")
    return (f'<div class="{cls}" data-name="Photo" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;{extra}'
            f'background-image:url(assets/photos/{img});background-size:{bw:.0f}px {bh:.0f}px;background-position:{ox:.0f}px {oy:.0f}px"></div>')


def seal(x, y, w, dark=True, top="Check-up + X-rays", big="£25", sub="Usually £50"):
    bg, fg = (COFFEE, VANILLA) if dark else (VANILLA, COFFEE)
    return f'''<div class="abs" data-name="Seal" style="left:{x}px;top:{y}px;width:{w}px;height:{w}px;border-radius:50%;background:{bg};color:{fg};display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;box-shadow:0 18px 36px rgba(37,37,37,.25)">
<div class="abs" style="inset:{w * .05:.0f}px;border-radius:50%;border:1.5px solid {TAUPE}"></div>
<div class="label" style="font-size:{w * .052:.0f}px;letter-spacing:.14em">{top}</div>
<div style="font-weight:300;font-size:{w * .31:.0f}px;line-height:1;margin-top:{w * .03:.0f}px">{big}</div>
<div class="label" style="font-size:{w * .05:.0f}px;letter-spacing:.14em;margin-top:{w * .04:.0f}px;opacity:.75">{sub}</div></div>'''


def watermark(x, y, w, colour=DUNE, opacity=1.0):
    return f'<div class="abs" data-name="Watermark" style="left:{x}px;top:{y}px;opacity:{opacity}">{mark(w, colour)}</div>'


def glow(colour="rgba(255,255,255,.55)", at="70% 20%"):
    return f'<div class="cover" data-name="Overlay" style="background:radial-gradient(circle at {at},{colour} 0%,transparent 60%)"></div>'


def steps(items, colour_n, colour_t, size=30, gap=30, line=TAUPE, active=None):
    """Vertical hairline timeline: numbered dots on a 1px Taupe line."""
    rows = []
    for i, t in enumerate(items):
        fill = colour_n if active == i else "transparent"
        rows.append(f'<div style="display:flex;gap:26px;align-items:flex-start;position:relative">'
                    f'<div style="flex:none;width:18px;height:18px;border-radius:50%;border:1.5px solid {colour_n};background:{fill};margin-top:{size * .38:.0f}px;position:relative;z-index:1"></div>'
                    f'<div><span class="label" style="font-size:{size * .5:.0f}px;color:{TAUPE_D}">{i + 1:02d}</span>'
                    f'<div style="font-size:{size}px;font-weight:400;line-height:1.3;color:{colour_t};margin-top:4px">{t}</div></div></div>')
    return (f'<div style="position:relative;display:flex;flex-direction:column;gap:{gap}px">'
            f'<div class="abs" style="left:8px;top:{size * .5:.0f}px;bottom:{size:.0f}px;width:1px;background:{line}"></div>{"".join(rows)}</div>')


def page(title, boards):
    return (f"<!doctype html><html lang='en-GB'><head><meta charset='utf-8'><title>{title}</title>"
            f"<style>{CSS}</style><script src='https://mcp.figma.com/mcp/html-to-design/capture.js' async></script></head>"
            f"<body>{''.join(boards)}</body></html>")


def board(bid, name, size, bg, inner):
    return f'<div class="ab {size}" id="{bid}" data-name="{name}" style="background:{bg}">{inner}<div class="grain" data-name="Grain"></div></div>'


DATE = "261019"

# ---------------------------------------------------------------- MARK (lapsed patient, General)


def mark_1x1():
    b = []
    b.append(board("M1", f"No history | Static | Object | Record card | 1x1 | {DATE}", "s1", VANILLA, f"""
  {glow()}
  {watermark(-140, 640, 520, DUNE)}
  <div class="abs" style="left:80px;top:80px">{logo(190)}</div>
  {photo(600, 120, 400, 880, 'mark-record-card.jpg', fx=.45)}
  <div class="abs hl" style="left:80px;top:290px;width:520px;font-size:64px">Nobody here knows <em>how long it&rsquo;s been.</em></div>
  <div class="abs body" style="left:80px;top:590px;width:470px;font-size:27px">No old notes. No raised eyebrows. A brand new practice on Toton Lane, where everyone starts on day one.</div>
  {seal(470, 770, 200)}
  <div class="abs" style="left:80px;top:916px">{cta(CTA_CHECK, size=18, h=68, pad=34)}</div>
"""))
    b.append(board("M2", f"Chewing one side | Static | Object | Toast | 1x1 | {DATE}", "s1", COFFEE, f"""
  {glow('rgba(202,179,156,.18)', '80% 30%')}
  {watermark(700, 620, 520, COFFEE_L)}
  {photo(80, 120, 420, 880, 'mark-toast.jpg', fx=.55, fy=.6)}
  <div class="abs" style="left:580px;top:96px">{logo(170, VANILLA)}</div>
  <div class="abs hl" style="left:580px;top:270px;width:440px;font-size:60px;color:{VANILLA}">You&rsquo;ve started chewing <em>on the other side.</em></div>
  <div class="abs body" style="left:580px;top:560px;width:420px;font-size:27px;color:{DUNE}">You didn&rsquo;t decide to. It just happened.</div>
  <div class="abs rule" style="left:580px;top:680px;width:400px"></div>
  <div class="abs body" style="left:580px;top:710px;width:420px;font-size:27px;color:{VANILLA}">Find out what&rsquo;s going on with a check-up and X-rays, explained in plain English. <b style="font-weight:600">£25.</b></div>
  <div class="abs" style="left:580px;top:916px">{cta(CTA_CHECK, 'light', size=18, h=68, pad=34)}</div>
"""))
    b.append(board("M3", f"Nothing happens today | Static | Object | Plan clipboard | 1x1 | {DATE}", "s1", VANILLA, f"""
  {glow()}
  <div class="abs" style="left:80px;top:80px">{logo(190)}</div>
  {photo(640, 80, 360, 560, 'mark-plan-clipboard.jpg', fx=.4, fy=.7)}
  <div class="abs hl" style="left:80px;top:250px;width:520px;font-size:62px">Your first visit back, <em>step by step.</em></div>
  <div class="abs" style="left:80px;top:470px;width:560px">{steps(['We look', 'We explain, in plain English', 'You get a written plan with prices', 'You decide, in your own time'], COFFEE, COFFEE, size=27, gap=18, active=3)}</div>
  <div class="abs body" style="left:640px;top:680px;width:360px;font-size:26px">Nothing happens unless you <em style="font-weight:500">say yes.</em></div>
  <div class="abs" style="left:80px;top:916px">{cta(CTA_CHECK, size=18, h=68, pad=34)}</div>
  <div class="abs body" style="left:640px;top:920px;width:360px;font-size:20px;color:{TAUPE_D}">Check-up with X-rays, £25 (usually £50)</div>
"""))
    b.append(board("M4", f"Stop guessing | Static | Object | Price | 1x1 | {DATE}", "s1", VANILLA, f"""
  {glow()}
  {photo(640, 80, 360, 640, 'waiting-arch.jpg', fx=.55, fy=.4)}
  <div class="abs" style="left:80px;top:80px">{logo(190)}</div>
  <div class="abs label" style="left:84px;top:300px;color:{TAUPE_D}">Check-up + all X-rays</div>
  <div class="abs price" style="left:62px;top:350px;font-size:300px">£25</div>
  <div class="abs body" style="left:86px;top:625px;font-size:24px;color:{TAUPE_D};text-decoration:line-through">Usually £50</div>
  <div class="abs hl" style="left:80px;top:700px;width:520px;font-size:46px">That&rsquo;s what it costs <em>to stop guessing.</em></div>
  <div class="abs body" style="left:640px;top:760px;width:360px;font-size:22px">Written prices for anything else, before anything starts.</div>
  <div class="abs" style="left:80px;top:916px">{cta(CTA_CHECK, size=18, h=68, pad=34)}</div>
"""))
    b.append(board("M5", f"Book the look | Static | Site photo | Consultation | 1x1 | {DATE}", "s1", COFFEE, f"""
  {glow('rgba(202,179,156,.18)', '20% 20%')}
  {photo(520, 120, 480, 960, 'site-dentist-consultation-concept-dental-1.jpg', fx=.78, fy=.4, shadow=False)}
  <div class="abs" style="left:80px;top:80px">{logo(170, VANILLA)}</div>
  <div class="abs hl" style="left:80px;top:270px;width:420px;font-size:60px;color:{VANILLA}">You don&rsquo;t have to <em>feel ready.</em></div>
  <div class="abs body" style="left:80px;top:500px;width:400px;font-size:28px;color:{DUNE}">Just book the look. A calm check-up, no lecture, at your pace.</div>
  {seal(80, 690, 190, dark=False)}
  <div class="abs" style="left:80px;top:930px">{cta(CTA_CHECK, 'light', size=17, h=64, pad=30)}</div>
"""))
    return page("Concept Dental | Mark | 1x1", b)


def mark_9x16():
    # 9:16 safe zones: key copy stays below y=250 and above y=1580.
    b = []
    b.append(board("M1s", f"No history | Static | Object | Record card | 9x16 | {DATE}", "s9", VANILLA, f"""
  {glow(at='70% 15%')}
  {watermark(-160, 1380, 600, DUNE)}
  <div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(220)}</div>
  <div class="abs hl" style="left:100px;right:100px;top:450px;text-align:center;font-size:76px">Nobody here knows <em>how long it&rsquo;s been.</em></div>
  {photo(220, 690, 640, 640, 'mark-record-card.jpg', fx=.45, fy=.55)}
  {seal(720, 1080, 210)}
  <div class="abs body" style="left:120px;right:120px;top:1370px;text-align:center;font-size:32px">No old notes. No raised eyebrows. A brand new practice on Toton Lane.</div>
  <div class="abs" style="left:0;right:0;top:1490px;display:flex;justify-content:center">{cta(CTA_CHECK)}</div>
"""))
    b.append(board("M2s", f"Chewing one side | Static | Object | Toast | 9x16 | {DATE}", "s9", COFFEE, f"""
  {glow('rgba(202,179,156,.18)', '50% 40%')}
  {watermark(600, 1380, 600, COFFEE_L)}
  <div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(200, VANILLA)}</div>
  <div class="abs hl" style="left:100px;right:100px;top:440px;text-align:center;font-size:76px;color:{VANILLA}">You&rsquo;ve started chewing <em>on the other side.</em></div>
  {photo(240, 700, 600, 560, 'mark-toast.jpg', fx=.55, fy=.62)}
  <div class="abs body" style="left:120px;right:120px;top:1300px;text-align:center;font-size:32px;color:{DUNE}">You didn&rsquo;t decide to. It just happened. Find out what&rsquo;s going on: check-up and X-rays, <b style="font-weight:600;color:{VANILLA}">£25.</b></div>
  <div class="abs" style="left:0;right:0;top:1490px;display:flex;justify-content:center">{cta(CTA_CHECK, 'light')}</div>
"""))
    b.append(board("M3s", f"Nothing happens today | Static | Object | Plan clipboard | 9x16 | {DATE}", "s9", VANILLA, f"""
  {glow(at='60% 20%')}
  <div class="abs" style="left:100px;top:270px">{logo(200)}</div>
  {photo(620, 260, 360, 520, 'mark-plan-clipboard.jpg', fx=.4, fy=.7)}
  <div class="abs hl" style="left:100px;top:470px;width:500px;font-size:70px">Your first visit back, <em>step by step.</em></div>
  <div class="abs" style="left:100px;top:880px;width:880px">{steps(['We look', 'We explain, in plain English', 'You get a written plan with prices', 'You decide, in your own time'], COFFEE, COFFEE, size=36, gap=30, active=3)}</div>
  <div class="abs hl" style="left:100px;top:1360px;width:880px;font-size:44px">Nothing happens unless you <em>say yes.</em></div>
  <div class="abs" style="left:100px;top:1470px">{cta(CTA_CHECK)}</div>
"""))
    b.append(board("M4s", f"Stop guessing | Static | Object | Price | 9x16 | {DATE}", "s9", VANILLA, f"""
  {glow(at='50% 15%')}
  <div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(200)}</div>
  {photo(290, 420, 500, 560, 'waiting-arch.jpg', fx=.55, fy=.4)}
  <div class="abs label" style="left:0;right:0;top:1020px;text-align:center;color:{TAUPE_D}">Check-up + all X-rays</div>
  <div class="abs price" style="left:0;right:0;top:1070px;text-align:center;font-size:260px">£25</div>
  <div class="abs body" style="left:0;right:0;top:1300px;text-align:center;font-size:26px;color:{TAUPE_D};text-decoration:line-through">Usually £50</div>
  <div class="abs hl" style="left:100px;right:100px;top:1360px;text-align:center;font-size:46px">That&rsquo;s what it costs <em>to stop guessing.</em></div>
  <div class="abs" style="left:0;right:0;top:1480px;display:flex;justify-content:center">{cta(CTA_CHECK)}</div>
"""))
    b.append(board("M5s", f"Book the look | Static | Site photo | Consultation | 9x16 | {DATE}", "s9", COFFEE, f"""
  {glow('rgba(202,179,156,.18)', '50% 30%')}
  <div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(200, VANILLA)}</div>
  <div class="abs hl" style="left:100px;right:100px;top:430px;text-align:center;font-size:80px;color:{VANILLA}">You don&rsquo;t have to <em>feel ready.</em></div>
  {photo(190, 650, 700, 680, 'site-dentist-consultation-concept-dental-1.jpg', fx=.62, fy=.4, shadow=False)}
  {seal(770, 1060, 210, dark=False)}
  <div class="abs body" style="left:120px;right:120px;top:1360px;text-align:center;font-size:32px;color:{DUNE}">Just book the look. A calm check-up, no lecture, at your pace.</div>
  <div class="abs" style="left:0;right:0;top:1490px;display:flex;justify-content:center">{cta(CTA_CHECK, 'light')}</div>
"""))
    return page("Concept Dental | Mark | 9x16", b)


def paper(x, y, w, inner, rot=-1.5, pad=48, bg="#FFFDF9"):
    """A sheet of paper/card lying on the canvas, with a soft lifted shadow."""
    return (f'<div class="abs" data-name="Card" style="left:{x}px;top:{y}px;width:{w}px;padding:{pad}px;background:{bg};border-radius:6px;'
            f'transform:rotate({rot}deg);box-shadow:0 28px 56px rgba(70,58,52,.22),0 4px 10px rgba(70,58,52,.12)">{inner}</div>')


def price_rows(rows, size=26):
    out = []
    for name, price, was in rows:
        w = f'<span style="color:{TAUPE_D};text-decoration:line-through;margin-right:12px;font-weight:400">{was}</span>' if was else ""
        out.append(f'<div style="display:flex;justify-content:space-between;align-items:baseline;padding:{size * .55:.0f}px 0;border-bottom:1px solid {DUNE};font-size:{size}px">'
                   f'<span>{name}</span><span style="font-weight:600;white-space:nowrap">{w}{price}</span></div>')
    return "".join(out)


TICK = '<svg width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" style="flex:none;margin-top:4px"><circle cx="12" cy="12" r="11" stroke="{c}" stroke-width="1.4"/><path d="M7 12.5l3.2 3.2L17 9" stroke="{c}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'


def ticks(items, size=26, gap=18, colour=COFFEE):
    rows = "".join(f'<div style="display:flex;gap:16px;align-items:flex-start;font-size:{size}px;line-height:1.35">{TICK.format(s=round(size * 1.05), c=colour)}<span>{t}</span></div>' for t in items)
    return f'<div style="display:flex;flex-direction:column;gap:{gap}px">{rows}</div>'


# ---------------------------------------------------------------- DENISE (locked out, General)

D_FEES = [("Adult check-up, inc. X-rays", "£25", "£50"), ("Child check-up (0–12)", "£20", ""), ("Routine hygiene", "£75", ""), ("White fillings", "from £150", "")]
D_CHECK = ["Every tooth, including existing fillings", "Gum health screening", "Soft tissue check for signs of oral cancer", "X-rays where clinically necessary", "Time for your questions"]


def denise_1x1():
    b = []
    b.append(board("D1", f"Rung round | Static | Object | Notepad | 1x1 | {DATE}", "s1", VANILLA, f"""
  {glow()}
  {photo(600, 120, 400, 880, 'denise-notepad.jpg', fx=.3, fy=.6)}
  <div class="abs" style="left:80px;top:80px">{logo(190)}</div>
  <div class="abs hl" style="left:80px;top:260px;width:500px;font-size:58px">You&rsquo;ve rung round. <em>Everywhere&rsquo;s full.</em></div>
  <div class="abs body" style="left:80px;top:560px;width:470px;font-size:28px">We&rsquo;re a new private practice on Toton Lane, and <b style="font-weight:600">we&rsquo;re taking new patients.</b></div>
  {seal(400, 690, 190)}
  <div class="abs" style="left:80px;top:916px">{cta(CTA_CHECK, size=18, h=68, pad=34)}</div>
"""))
    b.append(board("D2", f"Actual number | Static | Object | Fees card | 1x1 | {DATE}", "s1", DUNE, f"""
  {glow('rgba(252,246,238,.7)', '30% 20%')}
  {watermark(700, -60, 480, VANILLA, .45)}
  <div class="abs" style="left:80px;top:80px">{logo(190)}</div>
  <div class="abs hl" style="left:80px;top:220px;width:900px;font-size:58px">What does a private check-up <em>actually cost?</em></div>
  {paper(110, 420, 640, '<div class="label" style="font-size:15px;color:' + TAUPE_D + ';margin-bottom:10px">Our fees · published online</div>' + price_rows(D_FEES, 25), rot=-1.8, pad=44)}
  <div class="abs body" style="left:800px;top:520px;width:220px;font-size:24px">Every fee is on our website <em style="font-weight:500">before you book.</em></div>
  <div class="abs" style="left:80px;top:916px">{cta(CTA_CHECK, size=18, h=68, pad=34)}</div>
"""))
    b.append(board("D3", f"Not pushed | Static | Object | Envelope | 1x1 | {DATE}", "s1", COFFEE, f"""
  {glow('rgba(202,179,156,.18)', '80% 30%')}
  {photo(80, 120, 420, 880, 'denise-envelope.jpg', fx=.5, fy=.6)}
  <div class="abs" style="left:580px;top:96px">{logo(170, VANILLA)}</div>
  <div class="abs hl" style="left:580px;top:260px;width:440px;font-size:56px;color:{VANILLA}">Worried private means <em>being sold things?</em></div>
  <div class="abs body" style="left:580px;top:540px;width:420px;font-size:26px;color:{DUNE}">You get a written plan. Every option, every price.</div>
  <div class="abs rule" style="left:580px;top:670px;width:400px"></div>
  <div class="abs hl" style="left:580px;top:700px;width:420px;font-size:38px;color:{VANILLA}">You take it home. <em>You decide.</em></div>
  <div class="abs" style="left:580px;top:916px">{cta(CTA_CHECK, 'light', size=18, h=68, pad=34)}</div>
"""))
    b.append(board("D4", f"No waiting list | Static | Site photo | Front desk | 1x1 | {DATE}", "s1", VANILLA, f"""
  {glow()}
  {photo(560, 120, 440, 880, 'site-concept-dental-front-desk.jpg', fx=.42, fy=.5)}
  <div class="abs" style="left:80px;top:80px">{logo(190)}</div>
  <div class="abs hl" style="left:80px;top:270px;width:460px;font-size:84px">No waiting <em>list.</em></div>
  <div class="abs body" style="left:80px;top:470px;width:440px;font-size:28px">A new private practice on Toton Lane, taking new patients. No referral needed.</div>
  <div class="abs" style="left:80px;top:650px;width:440px">{ticks(['Book online, by phone or WhatsApp', 'Weekend appointments', 'On-site parking'], size=24, gap=12)}</div>
  <div class="abs body" style="left:80px;top:820px;width:440px;font-size:24px">Check-up with X-rays <b style="font-weight:600">£25</b> <span style="color:#9C8670;text-decoration:line-through">£50</span></div>
  <div class="abs" style="left:80px;top:916px">{cta(CTA_CHECK, size=18, h=68, pad=34)}</div>
"""))
    b.append(board("D5", f"Five minutes | Static | Object | Checklist | 1x1 | {DATE}", "s1", VANILLA, f"""
  {glow()}
  {watermark(-140, 640, 520, DUNE)}
  <div class="abs" style="left:80px;top:80px">{logo(190)}</div>
  <div class="abs hl" style="left:80px;top:230px;width:920px;font-size:58px">Paid for a <em>five-minute</em> check-up before?</div>
  {paper(330, 420, 640, '<div class="label" style="font-size:15px;color:' + TAUPE_D + ';margin-bottom:22px">Your check-up includes</div>' + ticks(D_CHECK, size=24, gap=14), rot=1.4, pad=44)}
  <div class="abs hl" style="left:80px;top:470px;width:220px;font-size:96px;font-weight:200">£25</div>
  <div class="abs body" style="left:84px;top:580px;width:220px;font-size:20px;color:{TAUPE_D}">usually £50</div>
  <div class="abs" style="left:80px;top:916px">{cta(CTA_CHECK, size=18, h=68, pad=34)}</div>
"""))
    return page("Concept Dental | Denise | 1x1", b)


def denise_9x16():
    b = []
    b.append(board("D1s", f"Rung round | Static | Object | Notepad | 9x16 | {DATE}", "s9", VANILLA, f"""
  {glow(at='70% 15%')}
  <div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(220)}</div>
  <div class="abs hl" style="left:100px;right:100px;top:450px;text-align:center;font-size:76px">You&rsquo;ve rung round. <em>Everywhere&rsquo;s full.</em></div>
  {photo(240, 690, 600, 600, 'denise-notepad.jpg', fx=.3, fy=.55)}
  {seal(720, 1060, 210)}
  <div class="abs body" style="left:120px;right:120px;top:1330px;text-align:center;font-size:32px">A new private practice on Toton Lane, and <b style="font-weight:600">we&rsquo;re taking new patients.</b></div>
  <div class="abs" style="left:0;right:0;top:1480px;display:flex;justify-content:center">{cta(CTA_CHECK)}</div>
"""))
    b.append(board("D2s", f"Actual number | Static | Object | Fees card | 9x16 | {DATE}", "s9", DUNE, f"""
  {glow('rgba(252,246,238,.7)', '40% 25%')}
  {watermark(640, 120, 560, VANILLA, .7)}
  <div class="abs" style="left:100px;top:270px">{logo(200)}</div>
  <div class="abs hl" style="left:100px;top:440px;width:880px;font-size:76px">What does a private check-up <em>actually cost?</em></div>
  {paper(110, 760, 860, '<div class="label" style="font-size:18px;color:' + TAUPE_D + ';margin-bottom:12px">Our fees · published online</div>' + price_rows(D_FEES, 32), rot=-1.6, pad=56)}
  <div class="abs body" style="left:100px;top:1300px;width:880px;font-size:32px">Every fee is on our website <em style="font-weight:500">before you book.</em></div>
  <div class="abs" style="left:100px;top:1440px">{cta(CTA_CHECK)}</div>
"""))
    b.append(board("D3s", f"Not pushed | Static | Object | Envelope | 9x16 | {DATE}", "s9", COFFEE, f"""
  {glow('rgba(202,179,156,.18)', '50% 40%')}
  <div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(200, VANILLA)}</div>
  <div class="abs hl" style="left:100px;right:100px;top:430px;text-align:center;font-size:72px;color:{VANILLA}">Worried private means <em>being sold things?</em></div>
  {photo(240, 690, 600, 560, 'denise-envelope.jpg', fx=.5, fy=.6)}
  <div class="abs body" style="left:120px;right:120px;top:1290px;text-align:center;font-size:32px;color:{DUNE}">A written plan, every option, every price. <em style="font-weight:500;color:{VANILLA}">You take it home. You decide.</em></div>
  <div class="abs" style="left:0;right:0;top:1480px;display:flex;justify-content:center">{cta(CTA_CHECK, 'light')}</div>
"""))
    b.append(board("D4s", f"No waiting list | Static | Site photo | Front desk | 9x16 | {DATE}", "s9", VANILLA, f"""
  {glow(at='50% 15%')}
  <div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(200)}</div>
  <div class="abs hl" style="left:100px;right:100px;top:430px;text-align:center;font-size:110px">No waiting <em>list.</em></div>
  {photo(190, 640, 700, 640, 'site-concept-dental-front-desk.jpg', fx=.42, fy=.55)}
  {seal(760, 1080, 200)}
  <div class="abs body" style="left:120px;right:120px;top:1310px;text-align:center;font-size:32px">A new private practice on Toton Lane, taking new patients. Weekend appointments, on-site parking.</div>
  <div class="abs" style="left:0;right:0;top:1480px;display:flex;justify-content:center">{cta(CTA_CHECK)}</div>
"""))
    b.append(board("D5s", f"Five minutes | Static | Object | Checklist | 9x16 | {DATE}", "s9", VANILLA, f"""
  {glow(at='50% 15%')}
  {watermark(-160, 1400, 600, DUNE)}
  <div class="abs" style="left:100px;top:270px">{logo(200)}</div>
  <div class="abs hl" style="left:100px;top:440px;width:880px;font-size:76px">Paid for a <em>five-minute</em> check-up before?</div>
  {paper(110, 760, 860, '<div class="label" style="font-size:18px;color:' + TAUPE_D + ';margin-bottom:26px">Your check-up includes</div>' + ticks(D_CHECK, size=32, gap=18), rot=1.2, pad=56)}
  <div class="abs" style="left:100px;top:1380px;display:flex;align-items:baseline;gap:22px"><span class="price" style="font-size:110px">£25</span><span class="body" style="font-size:26px;color:{TAUPE_D}">usually £50</span></div>
  <div class="abs" style="left:560px;top:1400px">{cta(CTA_CHECK, size=18, h=68, pad=32)}</div>
"""))
    return page("Concept Dental | Denise | 9x16", b)


# ---------------------------------------------------------------- JO (family consolidator, General)


def member_card(x, y, w, rot=-6):
    h = w * .63
    return (f'<div class="abs" data-name="Membership card" style="left:{x}px;top:{y}px;width:{w}px;height:{h:.0f}px;border-radius:{w * .05:.0f}px;background:linear-gradient(135deg,#54473F,{COFFEE} 60%,#3a302b);'
            f'transform:rotate({rot}deg);box-shadow:0 30px 60px rgba(37,37,37,.3),inset 0 1px 0 rgba(255,255,255,.12);color:{VANILLA};padding:{w * .07:.0f}px;overflow:hidden">'
            f'<div class="abs" style="right:-{w * .12:.0f}px;bottom:-{w * .18:.0f}px;opacity:.25">{mark(w * .6, TAUPE)}</div>'
            f'<div>{logo(w * .34, VANILLA)}</div>'
            f'<div class="label" style="position:absolute;left:{w * .07:.0f}px;bottom:{w * .16:.0f}px;font-size:{w * .036:.0f}px;color:{TAUPE}">Membership · Plan C</div>'
            f'<div style="position:absolute;left:{w * .07:.0f}px;bottom:{w * .06:.0f}px;font-size:{w * .07:.0f}px;font-weight:300">£26.99 a month</div></div>')


J_PLAN = ["2 check-ups + 2 hygiene visits for you", "Free check-ups for up to 2 children", "All small X-rays included", "10% off private treatment"]


def jo_1x1():
    b = []
    b.append(board("J1", f"Everyone but you | Static | Object | Calendar | 1x1 | {DATE}", "s1", VANILLA, f"""
  {glow()}
  {photo(600, 120, 400, 880, 'jo-calendar.jpg', fx=.5, fy=.35)}
  <div class="abs" style="left:80px;top:80px">{logo(190)}</div>
  <div class="abs hl" style="left:80px;top:280px;width:500px;font-size:62px">You booked everyone&rsquo;s check-up. <em>Except yours.</em></div>
  <div class="abs body" style="left:80px;top:590px;width:470px;font-size:27px">Kids&rsquo; check-ups (0&ndash;12) <b style="font-weight:600">£20.</b> Yours, with X-rays, <b style="font-weight:600">£25.</b></div>
  <div class="abs" style="left:80px;top:916px">{cta('Book the family in', size=18, h=68, pad=34)}</div>
"""))
    b.append(board("J2", f"Their pace | Static | Object | Trainers | 1x1 | {DATE}", "s1", DUNE, f"""
  {glow('rgba(252,246,238,.7)', '30% 20%')}
  {photo(560, 120, 440, 880, 'jo-trainers.jpg', fx=.5, fy=.7)}
  <div class="abs" style="left:80px;top:80px">{logo(190)}</div>
  <div class="abs hl" style="left:80px;top:270px;width:460px;font-size:58px">Their first visit <em>isn&rsquo;t about treatment.</em></div>
  <div class="abs body" style="left:80px;top:540px;width:440px;font-size:26px">It&rsquo;s the chair, the light and a friendly face. We go at their pace, and you stay with them the whole time.</div>
  <div class="abs label" style="left:80px;top:790px;color:{TAUPE_D}">Children&rsquo;s check-ups</div>
  <div class="abs price" style="left:74px;top:820px;font-size:80px">£20</div>
  <div class="abs" style="left:80px;top:930px">{cta('Book their check-up', size=17, h=64, pad=30)}</div>
"""))
    b.append(board("J3", f"Car park counts | Static | Object | Keys | 1x1 | {DATE}", "s1", COFFEE, f"""
  {glow('rgba(202,179,156,.18)', '80% 30%')}
  {photo(80, 120, 420, 880, 'jo-keys.jpg', fx=.4, fy=.6)}
  <div class="abs" style="left:580px;top:96px">{logo(170, VANILLA)}</div>
  <div class="abs hl" style="left:580px;top:260px;width:440px;font-size:56px;color:{VANILLA}">Getting everyone there is <em>half the battle.</em></div>
  <div class="abs" style="left:580px;top:520px;width:420px;color:{VANILLA}">{ticks(['Saturday and Sunday appointments', 'On-site parking', 'Book online when it suits you'], size=25, gap=16, colour=TAUPE)}</div>
  <div class="abs body" style="left:580px;top:760px;width:420px;font-size:24px;color:{DUNE}">Kids £20. Adults £25 with X-rays.</div>
  <div class="abs" style="left:580px;top:916px">{cta('Book online', 'light', size=18, h=68, pad=34)}</div>
"""))
    b.append(board("J4", f"Family plan | Static | Object | Membership card | 1x1 | {DATE}", "s1", VANILLA, f"""
  {glow()}
  <div class="abs" style="left:80px;top:80px">{logo(190)}</div>
  <div class="abs hl" style="left:80px;top:220px;width:900px;font-size:58px">Your check-ups and the kids&rsquo;, <em>£26.99 a month.</em></div>
  {member_card(560, 470, 430, rot=-7)}
  <div class="abs" style="left:80px;top:470px;width:460px">{ticks(J_PLAN, size=24, gap=14)}</div>
  <div class="abs body" style="left:80px;top:790px;width:460px;font-size:20px;color:{TAUPE_D}">Plan B, £16.99, includes one child&rsquo;s check-up.</div>
  <div class="abs" style="left:80px;top:916px">{cta('Ask about membership', size=18, h=68, pad=34)}</div>
"""))
    b.append(board("J5", f"All of you | Static | Object | Coats | 1x1 | {DATE}", "s1", VANILLA, f"""
  {glow()}
  {photo(560, 120, 440, 880, 'jo-coats.jpg', fx=.4, fy=.4)}
  <div class="abs" style="left:80px;top:80px">{logo(190)}</div>
  <div class="abs hl" style="left:80px;top:280px;width:460px;font-size:66px">Taking new patients. <em>All of you.</em></div>
  <div class="abs" style="left:80px;top:560px;width:440px">{price_rows([("Children (0–12)", "£20", ""), ("Adults, with X-rays", "£25", "£50")], 25)}</div>
  <div class="abs body" style="left:80px;top:740px;width:440px;font-size:22px;color:{TAUPE_D}">Toton Lane, Stapleford. On-site parking, weekend appointments.</div>
  <div class="abs" style="left:80px;top:916px">{cta('Book the family in', size=18, h=68, pad=34)}</div>
"""))
    return page("Concept Dental | Jo | 1x1", b)


def jo_9x16():
    b = []
    b.append(board("J1s", f"Everyone but you | Static | Object | Calendar | 9x16 | {DATE}", "s9", VANILLA, f"""
  {glow(at='70% 15%')}
  <div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(220)}</div>
  <div class="abs hl" style="left:100px;right:100px;top:440px;text-align:center;font-size:72px">You booked everyone&rsquo;s check-up. <em>Except yours.</em></div>
  {photo(240, 700, 600, 600, 'jo-calendar.jpg', fx=.5, fy=.35)}
  <div class="abs body" style="left:120px;right:120px;top:1340px;text-align:center;font-size:32px">Kids&rsquo; check-ups <b style="font-weight:600">£20.</b> Yours, with X-rays, <b style="font-weight:600">£25.</b></div>
  <div class="abs" style="left:0;right:0;top:1460px;display:flex;justify-content:center">{cta('Book the family in')}</div>
"""))
    b.append(board("J2s", f"Their pace | Static | Object | Trainers | 9x16 | {DATE}", "s9", DUNE, f"""
  {glow('rgba(252,246,238,.7)', '50% 20%')}
  <div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(200)}</div>
  <div class="abs hl" style="left:100px;right:100px;top:430px;text-align:center;font-size:72px">Their first visit <em>isn&rsquo;t about treatment.</em></div>
  {photo(240, 690, 600, 600, 'jo-trainers.jpg', fx=.5, fy=.7)}
  {seal(720, 1080, 200, top="Children 0–12", big="£20", sub="Check-up")}
  <div class="abs body" style="left:120px;right:120px;top:1330px;text-align:center;font-size:32px">We go at their pace, and you stay with them the whole time.</div>
  <div class="abs" style="left:0;right:0;top:1470px;display:flex;justify-content:center">{cta('Book their check-up')}</div>
"""))
    b.append(board("J3s", f"Car park counts | Static | Object | Keys | 9x16 | {DATE}", "s9", COFFEE, f"""
  {glow('rgba(202,179,156,.18)', '50% 40%')}
  <div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(200, VANILLA)}</div>
  <div class="abs hl" style="left:100px;right:100px;top:430px;text-align:center;font-size:72px;color:{VANILLA}">Getting everyone there is <em>half the battle.</em></div>
  {photo(240, 690, 600, 520, 'jo-keys.jpg', fx=.4, fy=.6)}
  <div class="abs" style="left:200px;top:1250px;width:700px;color:{VANILLA}">{ticks(['Saturday and Sunday appointments', 'On-site parking', 'Book online when it suits you'], size=30, gap=14, colour=TAUPE)}</div>
  <div class="abs" style="left:0;right:0;top:1480px;display:flex;justify-content:center">{cta('Book online', 'light')}</div>
"""))
    b.append(board("J4s", f"Family plan | Static | Object | Membership card | 9x16 | {DATE}", "s9", VANILLA, f"""
  {glow(at='50% 20%')}
  <div class="abs" style="left:100px;top:270px">{logo(200)}</div>
  <div class="abs hl" style="left:100px;top:430px;width:880px;font-size:74px">Your check-ups and the kids&rsquo;, <em>£26.99 a month.</em></div>
  {member_card(250, 700, 580, rot=-5)}
  <div class="abs" style="left:100px;top:1150px;width:880px">{ticks(J_PLAN, size=30, gap=14)}</div>
  <div class="abs" style="left:100px;top:1470px">{cta('Ask about membership')}</div>
"""))
    b.append(board("J5s", f"All of you | Static | Object | Coats | 9x16 | {DATE}", "s9", VANILLA, f"""
  {glow(at='50% 15%')}
  <div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(200)}</div>
  <div class="abs hl" style="left:100px;right:100px;top:430px;text-align:center;font-size:80px">Taking new patients. <em>All of you.</em></div>
  {photo(240, 690, 600, 560, 'jo-coats.jpg', fx=.4, fy=.4)}
  <div class="abs" style="left:200px;top:1270px;width:680px">{price_rows([("Children (0–12)", "£20", ""), ("Adults, with X-rays", "£25", "£50")], 30)}</div>
  <div class="abs" style="left:0;right:0;top:1480px;display:flex;justify-content:center">{cta('Book the family in')}</div>
"""))
    return page("Concept Dental | Jo | 9x16", b)


BUILDS = {
    "mark": (mark_1x1, mark_9x16),
    "denise": (denise_1x1, denise_9x16),
    "jo": (jo_1x1, jo_9x16),
}

if __name__ == "__main__":
    import sys
    names = sys.argv[1:] or list(BUILDS)
    for n in names:
        one, nine = BUILDS[n]
        (ROOT / f"{n}-1x1.html").write_text(one())
        (ROOT / f"{n}-9x16.html").write_text(nine())
    print("built", ", ".join(names))
