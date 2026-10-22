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


# ---------------------------------------------------------------- PETER (single gap, Implants)

P_OPTIONS = [("Implant", "Fixed. Teeth either side left alone. Minor surgery.", "£2,500", "inc. CBCT scan + crown"),
             ("Bridge", "Fixed. No surgery. Neighbouring teeth prepared.", "£650", "per unit"),
             ("Partial denture", "Removable. No surgery.", "£650", "")]


def option_cards(x, y, w, size=1.0, gap=22, stack=False):
    cards = []
    for i, (name, desc, price, note) in enumerate(P_OPTIONS):
        bg = COFFEE if i == 0 else "#FFFDF9"
        fg = VANILLA if i == 0 else COFFEE
        cards.append(f'<div style="flex:1;background:{bg};color:{fg};border-radius:8px;padding:{30 * size:.0f}px {26 * size:.0f}px;box-shadow:0 20px 40px rgba(70,58,52,.16);display:flex;flex-direction:column;gap:{12 * size:.0f}px">'
                     f'<div class="label" style="font-size:{15 * size:.0f}px;color:{TAUPE}">0{i + 1}</div>'
                     f'<div style="font-size:{34 * size:.0f}px;font-weight:400;line-height:1.1">{name}</div>'
                     f'<div style="font-size:{19 * size:.0f}px;line-height:1.45;opacity:.85;min-height:{0 if stack else 80 * size:.0f}px">{desc}</div>'
                     f'<div style="font-size:{46 * size:.0f}px;font-weight:300;line-height:1;margin-top:auto">{price}</div>'
                     f'<div class="label" style="font-size:{12 * size:.0f}px;letter-spacing:.12em;opacity:.7;min-height:{14 * size:.0f}px">{note}</div></div>')
    direction = "column" if stack else "row"
    return f'<div class="abs" data-name="Options" style="left:{x}px;top:{y}px;width:{w}px;display:flex;flex-direction:{direction};gap:{gap}px">{"".join(cards)}</div>'


def tooth_row(x, y, w, colour=COFFEE, drift=True, raster=True):
    """Simple line drawing: a row of molars with one gap; neighbours lean into it."""
    def tooth(cx, lean=0):
        return (f'<g transform="rotate({lean} {cx} 150)"><path d="M{cx - 34} 40 q-6 -26 18 -28 q16 -2 16 10 q0 -12 16 -10 q24 2 18 28 '
                f'l-6 60 q-3 18 -12 52 q-4 14 -10 0 l-6 -36 l-6 36 q-6 14 -10 0 q-9 -34 -12 -52 z" fill="none" stroke="{colour}" stroke-width="2.2" stroke-linejoin="round"/></g>')
    teeth = tooth(60) + tooth(150) + tooth(240, 9 if drift else 0) + tooth(420, -9 if drift else 0) + tooth(510)
    gum = f'<path d="M10 70 Q285 92 560 70" fill="none" stroke="{TAUPE}" stroke-width="1.5" stroke-dasharray="4 6"/>'
    arrows = (f'<path d="M262 30 l26 14 M262 30 l8 26" stroke="{TAUPE_D}" stroke-width="2" fill="none" stroke-linecap="round"/>'
              f'<path d="M398 30 l-26 14 M398 30 l-8 26" stroke="{TAUPE_D}" stroke-width="2" fill="none" stroke-linecap="round"/>') if drift else ""
    gap = f'<text x="330" y="132" text-anchor="middle" font-family="Montserrat" font-size="15" font-weight="600" letter-spacing="3" fill="{TAUPE_D}">GAP</text>'
    if raster:  # Figma capture mangles the rotated SVG paths, so the harness uses the PNG rendered from this SVG
        return (f'<img class="abs" data-name="Tooth row" src="assets/tooth-row.png" '
                f'style="left:{x}px;top:{y}px;width:{w}px;height:{w * 618 / 1600:.0f}px">')
    return (f'<div class="abs" data-name="Tooth row" style="left:{x}px;top:{y}px;width:{w}px">'
            f'<svg viewBox="0 0 570 220" width="{w}" height="{w * 220 / 570:.0f}" style="display:block;overflow:visible">{gum}{teeth}{arrows}{gap}</svg></div>')


def receipt(x, y, w, rows, total, rot=1.2, size=26):
    items = "".join(f'<div style="display:flex;gap:14px;align-items:baseline;font-size:{size}px;padding:{size * .45:.0f}px 0;border-bottom:1px dashed {TAUPE}">'
                    f'{TICK.format(s=round(size * .9), c=COFFEE)}<span>{r}</span></div>' for r in rows)
    inner = (f'<div class="label" style="font-size:{size * .6:.0f}px;color:{TAUPE_D};margin-bottom:12px">Single implant · what&rsquo;s included</div>{items}'
             f'<div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:{size * .8:.0f}px">'
             f'<span class="label" style="font-size:{size * .6:.0f}px">Total, in writing</span><span style="font-size:{size * 2.4:.0f}px;font-weight:300">{total}</span></div>')
    return paper(x, y, w, inner, rot=rot, pad=round(size * 1.7))


P_INCLUDED = ["CBCT scan to plan it", "The implant", "Your custom-made crown"]


def peter_1x1():
    b = []
    b.append(board("P1", f"Three options | Static | Object | Option cards | 1x1 | {DATE}", "s1", DUNE, f"""
  {glow('rgba(252,246,238,.7)', '30% 15%')}
  <div class="abs" style="left:80px;top:80px">{logo(190)}</div>
  <div class="abs hl" style="left:80px;top:220px;width:900px;font-size:64px">One gap. <em>Three options.</em></div>
  {option_cards(80, 370, 920, size=.92)}
  <div class="abs body" style="left:80px;top:830px;width:900px;font-size:24px">We&rsquo;ll tell you honestly which one suits you, including leaving it.</div>
  <div class="abs" style="left:80px;top:916px">{cta(CTA_IMPLANT, size=18, h=68, pad=34)}</div>
"""))
    b.append(board("P2", f"Nobody can see it | Static | Illustration | Drift | 1x1 | {DATE}", "s1", VANILLA, f"""
  {glow()}
  <div class="abs" style="left:80px;top:80px">{logo(190)}</div>
  <div class="abs hl" style="left:80px;top:230px;width:900px;font-size:70px">Nobody can see it. <em>Your teeth can.</em></div>
  {tooth_row(190, 420, 700)}
  <div class="abs body" style="left:80px;top:720px;width:880px;font-size:27px">The teeth next to a gap can drift and tilt into the space. Find out where yours stands before they do.</div>
  <div class="abs" style="left:80px;top:916px">{cta(CTA_IMPLANT, size=18, h=68, pad=34)}</div>
"""))
    b.append(board("P3", f"Other side | Static | Object | Steak | 1x1 | {DATE}", "s1", COFFEE, f"""
  {glow('rgba(202,179,156,.18)', '80% 30%')}
  {photo(80, 120, 420, 880, 'peter-steak.jpg', fx=.45, fy=.65)}
  <div class="abs" style="left:580px;top:96px">{logo(170, VANILLA)}</div>
  <div class="abs hl" style="left:580px;top:250px;width:440px;font-size:54px;color:{VANILLA}">You&rsquo;ve chewed on the other side <em>since it came out.</em></div>
  <div class="abs body" style="left:580px;top:540px;width:420px;font-size:26px;color:{DUNE}">A single implant puts a fixed tooth back where the gap is.</div>
  <div class="abs rule" style="left:580px;top:660px;width:400px"></div>
  <div class="abs" style="left:580px;top:690px;color:{VANILLA}"><div class="label" style="color:{TAUPE}">Implant, scan and crown</div><div class="price" style="font-size:96px;margin-top:14px">£2,500</div></div>
  <div class="abs" style="left:580px;top:916px">{cta(CTA_IMPLANT, 'light', size=18, h=68, pad=34)}</div>
"""))
    b.append(board("P4", f"Everything in | Static | Object | Receipt | 1x1 | {DATE}", "s1", VANILLA, f"""
  {glow()}
  {watermark(-140, 640, 520, DUNE)}
  <div class="abs" style="left:80px;top:80px">{logo(190)}</div>
  <div class="abs hl" style="left:80px;top:230px;width:440px;font-size:60px">One implant. <em>Everything in.</em></div>
  <div class="abs body" style="left:80px;top:480px;width:400px;font-size:24px">Confirmed in writing before you commit. Led by Dr Zain, Postgraduate Diploma in Implant Dentistry.</div>
  {receipt(500, 220, 510, P_INCLUDED, "£2,500", rot=1.6, size=30)}
  <div class="abs body" style="left:540px;top:760px;width:420px;font-size:22px;color:{TAUPE_D}">Usually £3,000</div>
  <div class="abs" style="left:80px;top:916px">{cta(CTA_IMPLANT, size=18, h=68, pad=34)}</div>
"""))
    b.append(board("P5", f"Find out first | Static | Object | CBCT tablet | 1x1 | {DATE}", "s1", VANILLA, f"""
  {glow()}
  {photo(560, 120, 440, 880, 'peter-cbct.jpg', fx=.5, fy=.55)}
  <div class="abs" style="left:80px;top:80px">{logo(190)}</div>
  <div class="abs hl" style="left:80px;top:270px;width:460px;font-size:60px">Not sure an implant&rsquo;s <em>right for you?</em></div>
  <div class="abs body" style="left:80px;top:530px;width:440px;font-size:26px">A CBCT scan shows the bone around your gap in 3D. You&rsquo;ll know if you&rsquo;re suitable, and what it costs, before you commit.</div>
  <div class="abs" style="left:80px;top:916px">{cta(CTA_IMPLANT, size=18, h=68, pad=34)}</div>
"""))
    return page("Concept Dental | Peter | 1x1", b)


def peter_9x16():
    b = []
    b.append(board("P1s", f"Three options | Static | Object | Option cards | 9x16 | {DATE}", "s9", DUNE, f"""
  {glow('rgba(252,246,238,.7)', '30% 15%')}
  <div class="abs" style="left:100px;top:270px">{logo(200)}</div>
  <div class="abs hl" style="left:100px;top:430px;width:880px;font-size:80px">One gap. <em>Three options.</em></div>
  {option_cards(100, 690, 880, size=.82, gap=14, stack=True)}
  <div class="abs" style="left:100px;top:1480px">{cta(CTA_IMPLANT)}</div>
"""))
    b.append(board("P2s", f"Nobody can see it | Static | Illustration | Drift | 9x16 | {DATE}", "s9", VANILLA, f"""
  {glow(at='50% 20%')}
  <div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(200)}</div>
  <div class="abs hl" style="left:100px;right:100px;top:440px;text-align:center;font-size:84px">Nobody can see it. <em>Your teeth can.</em></div>
  {tooth_row(140, 790, 800)}
  <div class="abs body" style="left:120px;right:120px;top:1180px;text-align:center;font-size:34px">The teeth next to a gap can drift and tilt into the space. Find out where yours stands before they do.</div>
  <div class="abs" style="left:0;right:0;top:1460px;display:flex;justify-content:center">{cta(CTA_IMPLANT)}</div>
"""))
    b.append(board("P3s", f"Other side | Static | Object | Steak | 9x16 | {DATE}", "s9", COFFEE, f"""
  {glow('rgba(202,179,156,.18)', '50% 40%')}
  <div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(200, VANILLA)}</div>
  <div class="abs hl" style="left:100px;right:100px;top:430px;text-align:center;font-size:70px;color:{VANILLA}">You&rsquo;ve chewed on the other side <em>since it came out.</em></div>
  {photo(240, 720, 600, 520, 'peter-steak.jpg', fx=.45, fy=.65)}
  <div class="abs body" style="left:120px;right:120px;top:1290px;text-align:center;font-size:32px;color:{DUNE}">A single implant puts a fixed tooth back where the gap is. £2,500, including your CBCT scan and crown.</div>
  <div class="abs" style="left:0;right:0;top:1480px;display:flex;justify-content:center">{cta(CTA_IMPLANT, 'light')}</div>
"""))
    b.append(board("P4s", f"Everything in | Static | Object | Receipt | 9x16 | {DATE}", "s9", VANILLA, f"""
  {glow(at='50% 20%')}
  <div class="abs" style="left:100px;top:270px">{logo(200)}</div>
  <div class="abs hl" style="left:100px;top:430px;width:880px;font-size:80px">One implant. <em>Everything in.</em></div>
  {receipt(150, 680, 780, P_INCLUDED, "£2,500", rot=1.2, size=32)}
  <div class="abs body" style="left:100px;top:1280px;width:880px;font-size:30px">Confirmed in writing before you commit. Usually £3,000. Led by Dr Zain, PgDip Implant Dentistry.</div>
  <div class="abs" style="left:100px;top:1460px">{cta(CTA_IMPLANT)}</div>
"""))
    b.append(board("P5s", f"Find out first | Static | Object | CBCT tablet | 9x16 | {DATE}", "s9", VANILLA, f"""
  {glow(at='50% 15%')}
  <div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(200)}</div>
  <div class="abs hl" style="left:100px;right:100px;top:430px;text-align:center;font-size:76px">Not sure an implant&rsquo;s <em>right for you?</em></div>
  {photo(240, 700, 600, 560, 'peter-cbct.jpg', fx=.5, fy=.55)}
  <div class="abs body" style="left:120px;right:120px;top:1300px;text-align:center;font-size:32px">A CBCT scan shows the bone in 3D. Know if you&rsquo;re suitable, and the cost, before you commit.</div>
  <div class="abs" style="left:0;right:0;top:1470px;display:flex;justify-content:center">{cta(CTA_IMPLANT)}</div>
"""))
    return page("Concept Dental | Peter | 9x16", b)


# ---------------------------------------------------------------- LINDA (loose denture, Implants)


def linda_1x1():
    b = []
    b.append(board("L1", f"Adhesive | Static | Object | Adhesive tube | 1x1 | {DATE}", "s1", VANILLA, f"""
  {glow()}
  {photo(560, 120, 440, 880, 'linda-adhesive.jpg', fx=.4, fy=.6)}
  <div class="abs" style="left:80px;top:80px">{logo(190)}</div>
  <div class="abs hl" style="left:80px;top:270px;width:460px;font-size:62px">Still using adhesive <em>every morning?</em></div>
  <div class="abs body" style="left:80px;top:500px;width:440px;font-size:27px">And by the evening, it&rsquo;s worn off.</div>
  <div class="abs rule" style="left:80px;top:600px;width:400px"></div>
  <div class="abs body" style="left:80px;top:630px;width:440px;font-size:27px">Dentures can be held in place by implants, so they don&rsquo;t rely on adhesive. <em style="font-weight:500">Worth one conversation.</em></div>
  <div class="abs" style="left:80px;top:916px">{cta(CTA_IMPLANT, size=18, h=68, pad=34)}</div>
"""))
    b.append(board("L2", f"Apples cut up | Static | Object | Apple slices | 1x1 | {DATE}", "s1", DUNE, f"""
  {glow('rgba(252,246,238,.7)', '30% 20%')}
  {photo(560, 120, 440, 880, 'linda-apple.jpg', fx=.4, fy=.62)}
  <div class="abs" style="left:80px;top:80px">{logo(190)}</div>
  <div class="abs hl" style="left:80px;top:270px;width:460px;font-size:58px">When did you start <em>cutting your apples up?</em></div>
  <div class="abs body" style="left:80px;top:520px;width:440px;font-size:26px">You didn&rsquo;t decide to. The denture decided for you.</div>
  <div class="abs body" style="left:80px;top:640px;width:440px;font-size:26px">Ask about dentures that are <b style="font-weight:600">held in place by implants.</b></div>
  <div class="abs" style="left:80px;top:916px">{cta(CTA_IMPLANT, size=18, h=68, pad=34)}</div>
"""))
    b.append(board("L3", f"Not too old | Static | Object | Reading glasses | 1x1 | {DATE}", "s1", COFFEE, f"""
  {glow('rgba(202,179,156,.18)', '80% 30%')}
  {photo(80, 120, 420, 880, 'linda-glasses.jpg', fx=.4, fy=.6)}
  <div class="abs" style="left:580px;top:96px">{logo(170, VANILLA)}</div>
  <div class="abs hl" style="left:580px;top:260px;width:440px;font-size:58px;color:{VANILLA}">Think you&rsquo;re too old <em>for implants?</em></div>
  <div class="abs body" style="left:580px;top:520px;width:420px;font-size:26px;color:{DUNE}">Age on its own isn&rsquo;t what decides it.</div>
  <div class="abs" style="left:580px;top:620px;width:420px;color:{VANILLA}">{ticks(['Your gums', 'The bone in your jaw', 'Your general health'], size=26, gap=12, colour=TAUPE)}</div>
  <div class="abs body" style="left:580px;top:810px;width:420px;font-size:22px;color:{DUNE}">We check all three, and tell you honestly.</div>
  <div class="abs" style="left:580px;top:916px">{cta(CTA_IMPLANT, 'light', size=18, h=68, pad=34)}</div>
"""))
    b.append(board("L4", f"Laugh freely | Static | Site photo | Front desk | 1x1 | {DATE}", "s1", VANILLA, f"""
  {glow()}
  {photo(560, 120, 440, 880, 'site-concept-dental-front-desk.jpg', fx=.42, fy=.5)}
  <div class="abs" style="left:80px;top:80px">{logo(190)}</div>
  <div class="abs hl" style="left:80px;top:260px;width:460px;font-size:56px">You&rsquo;ve started laughing <em>with your hand over your mouth.</em></div>
  <div class="abs body" style="left:80px;top:560px;width:440px;font-size:26px">Dentures held in place by implants don&rsquo;t rely on adhesive.</div>
  <div class="abs hl" style="left:80px;top:690px;width:440px;font-size:36px"><em>Ask what&rsquo;s possible for you.</em></div>
  <div class="abs" style="left:80px;top:916px">{cta(CTA_IMPLANT, size=18, h=68, pad=34)}</div>
"""))
    b.append(board("L5", f"Booking for Mum | Static | Object | Two teas | 1x1 | {DATE}", "s1", DUNE, f"""
  {glow('rgba(252,246,238,.7)', '30% 20%')}
  {photo(560, 120, 440, 880, 'linda-two-teas.jpg', fx=.5, fy=.6)}
  <div class="abs" style="left:80px;top:80px">{logo(190)}</div>
  <div class="abs hl" style="left:80px;top:270px;width:460px;font-size:62px">Noticed Mum <em>cutting everything up?</em></div>
  <div class="abs body" style="left:80px;top:500px;width:440px;font-size:26px">You can call us on her behalf. We&rsquo;ll talk you both through it, and you&rsquo;ll get a written plan to take home together.</div>
  <div class="abs body" style="left:80px;top:760px;width:440px;font-size:24px"><b style="font-weight:600">01157 731923</b> · on-site parking</div>
  <div class="abs" style="left:80px;top:916px">{cta('Call or book online', size=18, h=68, pad=34)}</div>
"""))
    return page("Concept Dental | Linda | 1x1", b)


def linda_9x16():
    b = []
    rows = [("L1s", "Adhesive", "Adhesive tube", 'linda-adhesive.jpg', VANILLA, COFFEE, "Still using adhesive <em>every morning?</em>",
             "Dentures can be held in place by implants, so they don&rsquo;t rely on adhesive. Worth one conversation.", .4, .6),
            ("L2s", "Apples cut up", "Apple slices", 'linda-apple.jpg', DUNE, COFFEE, "When did you start <em>cutting your apples up?</em>",
             "You didn&rsquo;t decide to. Ask about dentures that are held in place by implants.", .4, .62),
            ("L3s", "Not too old", "Reading glasses", 'linda-glasses.jpg', COFFEE, VANILLA, "Think you&rsquo;re too old <em>for implants?</em>",
             "Age on its own isn&rsquo;t what decides it. Your gums, bone and general health do. We check all three.", .4, .6),
            ("L4s", "Laugh freely", "Front desk", 'site-concept-dental-front-desk.jpg', VANILLA, COFFEE, "Laughing with your hand <em>over your mouth?</em>",
             "Dentures held in place by implants don&rsquo;t rely on adhesive. Ask what&rsquo;s possible for you.", .42, .55),
            ("L5s", "Booking for Mum", "Two teas", 'linda-two-teas.jpg', DUNE, COFFEE, "Noticed Mum <em>cutting everything up?</em>",
             "Call us on her behalf on 01157 731923. We&rsquo;ll talk you both through it.", .5, .6)]
    for bid, concept, detail, img, bg, fg, hl, body, fx, fy in rows:
        talent = "Site photo" if img.startswith("site-") else "Object"
        light = bg == COFFEE
        b.append(board(bid, f"{concept} | Static | {talent} | {detail} | 9x16 | {DATE}", "s9", bg, f"""
  {glow('rgba(202,179,156,.18)' if light else 'rgba(252,246,238,.7)', '50% 30%')}
  <div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(200, VANILLA if light else COFFEE)}</div>
  <div class="abs hl" style="left:100px;right:100px;top:430px;text-align:center;font-size:76px;color:{fg}">{hl}</div>
  {photo(240, 700, 600, 560, img, fx=fx, fy=fy)}
  <div class="abs body" style="left:120px;right:120px;top:1300px;text-align:center;font-size:32px;color:{DUNE if light else COFFEE}">{body}</div>
  <div class="abs" style="left:0;right:0;top:1470px;display:flex;justify-content:center">{cta('Call or book online' if bid == 'L5s' else CTA_IMPLANT, 'light' if light else 'dark')}</div>
"""))
    return page("Concept Dental | Linda | 9x16", b)


# ---------------------------------------------------------------- BARRY (fears the surgery, Implants)


def chat_phone(x, y, w, msgs, rot=-4):
    h = w * 2.05
    bubbles = "".join(
        f'<div style="align-self:{"flex-end" if me else "flex-start"};max-width:82%;background:{COFFEE if me else "#FFFFFF"};color:{VANILLA if me else COFFEE};'
        f'padding:{w * .045:.0f}px {w * .055:.0f}px;border-radius:{w * .06:.0f}px;font-size:{w * .052:.0f}px;line-height:1.4;box-shadow:0 2px 6px rgba(0,0,0,.06)">{t}</div>'
        for me, t in msgs)
    return (f'<div class="abs" data-name="Phone" style="left:{x}px;top:{y}px;width:{w}px;height:{h:.0f}px;border-radius:{w * .13:.0f}px;background:#1d1a18;padding:{w * .035:.0f}px;'
            f'transform:rotate({rot}deg);box-shadow:0 40px 80px rgba(37,37,37,.35)">'
            f'<div style="width:100%;height:100%;border-radius:{w * .1:.0f}px;background:{DUNE};overflow:hidden;display:flex;flex-direction:column">'
            f'<div style="background:{VANILLA};padding:{w * .1:.0f}px {w * .06:.0f}px {w * .04:.0f}px;display:flex;align-items:center;gap:{w * .04:.0f}px;border-bottom:1px solid {DUNE}">'
            f'<div style="width:{w * .12:.0f}px;height:{w * .12:.0f}px;border-radius:50%;background:{COFFEE};display:flex;align-items:center;justify-content:center">{mark(w * .07, VANILLA)}</div>'
            f'<div style="font-size:{w * .05:.0f}px;font-weight:600;color:{COFFEE}">Concept Dental</div></div>'
            f'<div style="flex:1;display:flex;flex-direction:column;gap:{w * .035:.0f}px;padding:{w * .06:.0f}px;justify-content:flex-start">{bubbles}</div></div></div>')


B_MSGS = [(True, "Hi, I&rsquo;m really nervous about implants. Can I ask a few questions before I book?"),
          (False, "Of course. Ask anything you like, and we&rsquo;ll talk you through exactly what&rsquo;s involved.")]
B_STEPS = ["We examine the gap and talk it through", "A CBCT scan plans the implant", "Written plan and cost. You decide", "Implant placed under local anaesthetic", "Healing, then your crown"]


def barry_1x1():
    b = []
    b.append(board("B1", f"Horror stories | Static | Object | Bedside phone | 1x1 | {DATE}", "s1", COFFEE, f"""
  {glow('rgba(202,179,156,.18)', '80% 30%')}
  {photo(80, 120, 420, 880, 'barry-bedside.jpg', fx=.5, fy=.55)}
  <div class="abs" style="left:580px;top:96px">{logo(170, VANILLA)}</div>
  <div class="abs hl" style="left:580px;top:260px;width:440px;font-size:56px;color:{VANILLA}">You&rsquo;ve read every <em>horror story going.</em></div>
  <div class="abs body" style="left:580px;top:500px;width:420px;font-size:26px;color:{DUNE}">None of them are about your mouth.</div>
  <div class="abs rule" style="left:580px;top:600px;width:400px"></div>
  <div class="abs body" style="left:580px;top:630px;width:420px;font-size:26px;color:{VANILLA}">Your consultation is a look, a scan and a conversation. <em style="font-weight:500">Nothing else.</em></div>
  <div class="abs" style="left:580px;top:916px">{cta(CTA_IMPLANT, 'light', size=18, h=68, pad=34)}</div>
"""))
    b.append(board("B2", f"Stop any time | Static | Object | Empty chair | 1x1 | {DATE}", "s1", VANILLA, f"""
  {glow()}
  {photo(560, 120, 440, 880, 'barry-chair.jpg', fx=.4, fy=.6)}
  <div class="abs" style="left:80px;top:80px">{logo(190)}</div>
  <div class="abs hl" style="left:80px;top:270px;width:460px;font-size:70px">You can stop <em>at any point.</em></div>
  <div class="abs body" style="left:80px;top:500px;width:440px;font-size:27px">We agree a signal before we start. Raise it, and we stop, take a break or slow down.</div>
  <div class="abs hl" style="left:80px;top:700px;width:440px;font-size:36px"><em>You&rsquo;re in control of the pace.</em></div>
  <div class="abs" style="left:80px;top:916px">{cta(CTA_IMPLANT, size=18, h=68, pad=34)}</div>
"""))
    b.append(board("B3", f"The steps | Static | Object | Timeline | 1x1 | {DATE}", "s1", VANILLA, f"""
  {glow()}
  {photo(640, 80, 360, 520, 'peter-cbct.jpg', fx=.5, fy=.55)}
  <div class="abs" style="left:80px;top:80px">{logo(190)}</div>
  <div class="abs hl" style="left:80px;top:240px;width:520px;font-size:60px">Here&rsquo;s exactly <em>what happens.</em></div>
  <div class="abs" style="left:80px;top:430px;width:900px">{steps(B_STEPS, COFFEE, COFFEE, size=25, gap=12, active=2)}</div>
  <div class="abs body" style="left:640px;top:650px;width:360px;font-size:22px">No surprises. Just steps. Single implant £2,500, scan and crown included.</div>
  <div class="abs" style="left:80px;top:916px">{cta(CTA_IMPLANT, size=18, h=68, pad=34)}</div>
"""))
    b.append(board("B4", f"Conversation first | Static | Site photo | Scan review | 1x1 | {DATE}", "s1", COFFEE, f"""
  {glow('rgba(202,179,156,.18)', '20% 20%')}
  {photo(520, 120, 480, 960, 'site-dentist-xray-review-concept-dental.jpg', fx=.45, fy=.4, shadow=False)}
  <div class="abs" style="left:80px;top:80px">{logo(170, VANILLA)}</div>
  <div class="abs hl" style="left:80px;top:260px;width:420px;font-size:58px;color:{VANILLA}">Petrified of getting <em>an implant?</em></div>
  <div class="abs body" style="left:80px;top:500px;width:400px;font-size:27px;color:{DUNE}">Start with a conversation, not a procedure. Meet the dentist. Ask everything.</div>
  <div class="abs body" style="left:80px;top:720px;width:400px;font-size:21px;color:{TAUPE}">Led by Dr Zain, Postgraduate Diploma in Implant Dentistry.</div>
  <div class="abs" style="left:80px;top:930px">{cta(CTA_IMPLANT, 'light', size=17, h=64, pad=30)}</div>
"""))
    b.append(board("B5", f"Message first | Static | Object | Chat | 1x1 | {DATE}", "s1", DUNE, f"""
  {glow('rgba(252,246,238,.7)', '70% 20%')}
  {chat_phone(620, 120, 360, B_MSGS, rot=-4)}
  <div class="abs" style="left:80px;top:80px">{logo(190)}</div>
  <div class="abs hl" style="left:80px;top:270px;width:480px;font-size:70px">Not ready <em>to book?</em></div>
  <div class="abs body" style="left:80px;top:470px;width:470px;font-size:27px">Send us a WhatsApp first. Ask what it involves, what you&rsquo;ll feel, what it costs. No commitment.</div>
  <div class="abs" style="left:80px;top:916px">{cta('Message us first', size=18, h=68, pad=34)}</div>
"""))
    return page("Concept Dental | Barry | 1x1", b)


def barry_9x16():
    b = []
    b.append(board("B1s", f"Horror stories | Static | Object | Bedside phone | 9x16 | {DATE}", "s9", COFFEE, f"""
  {glow('rgba(202,179,156,.18)', '50% 40%')}
  <div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(200, VANILLA)}</div>
  <div class="abs hl" style="left:100px;right:100px;top:430px;text-align:center;font-size:76px;color:{VANILLA}">You&rsquo;ve read every <em>horror story going.</em></div>
  {photo(240, 700, 600, 560, 'barry-bedside.jpg', fx=.5, fy=.55)}
  <div class="abs body" style="left:120px;right:120px;top:1300px;text-align:center;font-size:32px;color:{DUNE}">None of them are about your mouth. Your consultation is a look, a scan and a conversation.</div>
  <div class="abs" style="left:0;right:0;top:1470px;display:flex;justify-content:center">{cta(CTA_IMPLANT, 'light')}</div>
"""))
    b.append(board("B2s", f"Stop any time | Static | Object | Empty chair | 9x16 | {DATE}", "s9", VANILLA, f"""
  {glow(at='50% 15%')}
  <div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(200)}</div>
  <div class="abs hl" style="left:100px;right:100px;top:430px;text-align:center;font-size:86px">You can stop <em>at any point.</em></div>
  {photo(240, 700, 600, 560, 'barry-chair.jpg', fx=.4, fy=.6)}
  <div class="abs body" style="left:120px;right:120px;top:1300px;text-align:center;font-size:32px">We agree a signal before we start. Raise it, and we stop. You&rsquo;re in control of the pace.</div>
  <div class="abs" style="left:0;right:0;top:1470px;display:flex;justify-content:center">{cta(CTA_IMPLANT)}</div>
"""))
    b.append(board("B3s", f"The steps | Static | Object | Timeline | 9x16 | {DATE}", "s9", VANILLA, f"""
  {glow(at='50% 15%')}
  <div class="abs" style="left:100px;top:270px">{logo(200)}</div>
  <div class="abs hl" style="left:100px;top:430px;width:880px;font-size:80px">Here&rsquo;s exactly <em>what happens.</em></div>
  <div class="abs" style="left:100px;top:700px;width:880px">{steps(B_STEPS, COFFEE, COFFEE, size=34, gap=22, active=2)}</div>
  <div class="abs body" style="left:100px;top:1330px;width:880px;font-size:30px">No surprises. Just steps. Single implant £2,500, with the CBCT scan and crown.</div>
  <div class="abs" style="left:100px;top:1460px">{cta(CTA_IMPLANT)}</div>
"""))
    b.append(board("B4s", f"Conversation first | Static | Site photo | Scan review | 9x16 | {DATE}", "s9", COFFEE, f"""
  {glow('rgba(202,179,156,.18)', '50% 30%')}
  <div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(200, VANILLA)}</div>
  <div class="abs hl" style="left:100px;right:100px;top:430px;text-align:center;font-size:76px;color:{VANILLA}">Petrified of getting <em>an implant?</em></div>
  {photo(190, 680, 700, 600, 'site-dentist-xray-review-concept-dental.jpg', fx=.45, fy=.4, shadow=False)}
  <div class="abs body" style="left:120px;right:120px;top:1320px;text-align:center;font-size:32px;color:{DUNE}">Start with a conversation, not a procedure. Meet the dentist and ask everything.</div>
  <div class="abs" style="left:0;right:0;top:1470px;display:flex;justify-content:center">{cta(CTA_IMPLANT, 'light')}</div>
"""))
    b.append(board("B5s", f"Message first | Static | Object | Chat | 9x16 | {DATE}", "s9", DUNE, f"""
  {glow('rgba(252,246,238,.7)', '50% 30%')}
  <div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(200)}</div>
  <div class="abs hl" style="left:100px;right:100px;top:430px;text-align:center;font-size:86px">Not ready <em>to book?</em></div>
  {chat_phone(370, 620, 340, B_MSGS, rot=-3)}
  <div class="abs body" style="left:120px;right:120px;top:1370px;text-align:center;font-size:30px">Send us a WhatsApp first. No commitment.</div>
  <div class="abs" style="left:0;right:0;top:1440px;display:flex;justify-content:center">{cta('Message us first')}</div>
"""))
    return page("Concept Dental | Barry | 9x16", b)


# ---------------------------------------------------------------- COSMETIC (Amy, Hannah, Josh; replaces Implants, 22 Oct 2026)
# Toby (21 Oct): photos must not all be arches with a border. Each concept uses one of five treatments:
# arch, bleed (runs off the edge), rounded, offset (square on a tone block), pill/circle.

CDATE = "261022"
CTA_FREE = "Book free consultation"
CTA_COS = "Book a consultation"


def shot(x, y, w, h, img, kind="rounded", fx=.5, fy=.5, zoom=1.0, tone=DUNE, off=28):
    """Photo in one of the five treatments. 'offset' adds a solid tone block behind, offset down-right."""
    if kind == "arch":
        return photo(x, y, w, h, img, fx, fy, zoom)
    if kind == "bleed":
        return photo(x, y, w, h, img, fx, fy, zoom, arch=False, radius=0, shadow=False)
    if kind == "offset":
        block = f'<div class="abs" data-name="Tone block" style="left:{x + off}px;top:{y + off}px;width:{w}px;height:{h}px;background:{tone}"></div>'
        return block + photo(x, y, w, h, img, fx, fy, zoom, arch=False, radius=0)
    radius = 9999 if kind == "pill" else 32
    return photo(x, y, w, h, img, fx, fy, zoom, arch=False, radius=radius)


def plan_sheet(x, y, w, rows, rot=-1.5, size=24, title="Your written plan"):
    """A printed treatment plan: label, line items with right-hand values, a confirmed stamp."""
    items = "".join(f'<div style="display:flex;justify-content:space-between;gap:20px;align-items:baseline;padding:{size * .6:.0f}px 0;border-bottom:1px solid {DUNE};font-size:{size}px">'
                    f'<span>{a}</span><span style="font-weight:600;white-space:nowrap">{b}</span></div>' for a, b in rows)
    inner = (f'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:{size * .5:.0f}px">{logo(size * 5.4)}'
             f'<span class="label" style="font-size:{size * .55:.0f}px;color:{TAUPE_D}">{title}</span></div>{items}'
             f'<div class="label" style="margin-top:{size:.0f}px;display:inline-block;border:1.5px solid {COFFEE};border-radius:999px;padding:{size * .4:.0f}px {size * .8:.0f}px;font-size:{size * .55:.0f}px">Confirmed before you start</div>')
    return paper(x, y, w, inner, rot=rot, pad=round(size * 1.8))


A_PLAN = [("Invisalign, your case", "Confirmed price"), ("Consultation", "Free"), ("Retainer after (Essix)", "£100 per arch")]


def amy_1x1():
    b = []
    b.append(board("A1", f"Not in the quote | Static | Object | Plan sheet | 1x1 | {CDATE}", "s1", DUNE, f"""
  {glow('rgba(252,246,238,.75)', '25% 15%')}
  {watermark(760, 700, 420, VANILLA, .5)}
  <div class="abs" style="left:80px;top:80px">{logo(190)}</div>
  <div class="abs hl" style="left:80px;top:220px;width:900px;font-size:66px">Ask what&rsquo;s <em>not</em> in the quote.</div>
  {plan_sheet(470, 400, 530, A_PLAN, rot=2, size=22)}
  <div class="abs body" style="left:80px;top:420px;width:340px;font-size:27px">The number you were given isn&rsquo;t always the number you pay.</div>
  <div class="abs body" style="left:80px;top:640px;width:340px;font-size:24px">Invisalign from <b style="font-weight:600">£2,000.</b> Your price confirmed in writing first.</div>
  <div class="abs" style="left:80px;top:916px">{cta(CTA_FREE, size=18, h=68, pad=34)}</div>
"""))
    b.append(board("A2", f"Lips closed | Static | Lifestyle | Party | 1x1 | {CDATE}", "s1", COFFEE, f"""
  {glow('rgba(202,179,156,.18)', '80% 25%')}
  {shot(0, 0, 500, 1080, 'gen-amy-a2-party.jpg', 'bleed', fx=.42, fy=.5)}
  <div class="abs" style="left:580px;top:96px">{logo(170, VANILLA)}</div>
  <div class="abs hl" style="left:580px;top:260px;width:430px;font-size:58px;color:{VANILLA}">Same smile in every photo. <em>Lips closed.</em></div>
  <div class="abs body" style="left:580px;top:520px;width:420px;font-size:26px;color:{DUNE}">You know which side to stand on. You know when to stop laughing.</div>
  <div class="abs rule" style="left:580px;top:690px;width:400px"></div>
  <div class="abs body" style="left:580px;top:720px;width:420px;font-size:25px;color:{VANILLA}">Free Invisalign consultation. From <b style="font-weight:600">£2,000.</b></div>
  <div class="abs" style="left:580px;top:916px">{cta(CTA_FREE, 'light', size=17, h=66, pad=30)}</div>
"""))
    b.append(board("A3", f"Braces wore off | Static | Lifestyle | Aligner in hand | 1x1 | {CDATE}", "s1", VANILLA, f"""
  {glow()}
  {shot(560, 120, 440, 640, 'stock-amy-a3-aligner-hold.jpg', 'rounded', fx=.45, fy=.3)}
  <div class="abs" style="left:80px;top:80px">{logo(190)}</div>
  <div class="abs hl" style="left:80px;top:260px;width:440px;font-size:68px">You had braces <em>at 14.</em></div>
  <div class="abs body" style="left:80px;top:470px;width:430px;font-size:27px">Your teeth didn&rsquo;t stay where they put them.</div>
  <div class="abs body" style="left:80px;top:610px;width:430px;font-size:25px">Aligners can move them back, and a retainer keeps them there this time.</div>
  <div class="abs body" style="left:560px;top:800px;width:440px;font-size:22px;color:{TAUPE_D}">Invisalign from £2,000. Consultation free.</div>
  <div class="abs" style="left:80px;top:916px">{cta(CTA_FREE, size=18, h=68, pad=34)}</div>
"""))
    b.append(board("A4", f"From 2000 | Static | Object | Aligner case | 1x1 | {CDATE}", "s1", VANILLA, f"""
  {glow()}
  {shot(660, 100, 320, 500, 'stock-amy-a4-case.jpg', 'offset', fx=.5, fy=.5, tone=TAUPE)}
  <div class="abs" style="left:80px;top:80px">{logo(190)}</div>
  <div class="abs label" style="left:84px;top:290px;color:{TAUPE_D}">Invisalign from</div>
  <div class="abs price" style="left:66px;top:350px;font-size:160px">£2,000</div>
  <div class="abs hl" style="left:80px;top:680px;width:520px;font-size:44px">You&rsquo;ve been thinking about it <em>for years.</em></div>
  <div class="abs body" style="left:660px;top:700px;width:340px;font-size:23px">Free consultation. Confirmed price in writing before you start.</div>
  <div class="abs" style="left:80px;top:916px">{cta(CTA_FREE, size=18, h=68, pad=34)}</div>
"""))
    b.append(board("A5", f"22 hours | Static | Object | Lunch with aligners | 1x1 | {CDATE}", "s1", DUNE, f"""
  {glow('rgba(252,246,238,.7)', '30% 20%')}
  {shot(620, 80, 380, 840, 'gen-amy-a5-lunch.jpg', 'pill', fx=.45, fy=.5)}
  <div class="abs" style="left:80px;top:80px">{logo(190)}</div>
  <div class="abs label" style="left:84px;top:280px;color:{TAUPE_D}">Aligners, the honest version</div>
  <div class="abs hl" style="left:80px;top:330px;width:500px;font-size:70px">20 to 22 <em>hours a day.</em></div>
  <div class="abs body" style="left:80px;top:540px;width:480px;font-size:26px">That&rsquo;s the part nobody likes to mention. Out to eat, back in after.</div>
  <div class="abs body" style="left:80px;top:700px;width:480px;font-size:24px">We&rsquo;ll talk through how it fits your day before you commit.</div>
  <div class="abs" style="left:80px;top:916px">{cta(CTA_FREE, size=18, h=68, pad=34)}</div>
"""))
    return page("Concept Dental | Amy | 1x1", b)


def amy_9x16():
    b = []
    b.append(board("A1s", f"Not in the quote | Static | Object | Plan sheet | 9x16 | {CDATE}", "s9", DUNE, f"""
  {glow('rgba(252,246,238,.75)', '50% 20%')}
  {watermark(640, 1420, 560, VANILLA, .5)}
  <div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(200)}</div>
  <div class="abs hl" style="left:100px;right:100px;top:430px;text-align:center;font-size:80px">Ask what&rsquo;s <em>not</em> in the quote.</div>
  {plan_sheet(170, 700, 740, A_PLAN, rot=-1.5, size=28)}
  <div class="abs body" style="left:120px;right:120px;top:1250px;text-align:center;font-size:32px">Invisalign from <b style="font-weight:600">£2,000.</b> Your price confirmed in writing before you start.</div>
  <div class="abs" style="left:0;right:0;top:1470px;display:flex;justify-content:center">{cta(CTA_FREE)}</div>
"""))
    b.append(board("A2s", f"Lips closed | Static | Lifestyle | Party | 9x16 | {CDATE}", "s9", COFFEE, f"""
  {glow('rgba(202,179,156,.18)', '50% 30%')}
  <div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(200, VANILLA)}</div>
  <div class="abs hl" style="left:100px;right:100px;top:420px;text-align:center;font-size:76px;color:{VANILLA}">Same smile in every photo. <em>Lips closed.</em></div>
  {shot(0, 680, 1080, 640, 'gen-amy-a2-party.jpg', 'bleed', fx=.5, fy=.45)}
  <div class="abs body" style="left:120px;right:120px;top:1350px;text-align:center;font-size:32px;color:{DUNE}">Free Invisalign consultation. From <b style="font-weight:600;color:{VANILLA}">£2,000.</b></div>
  <div class="abs" style="left:0;right:0;top:1470px;display:flex;justify-content:center">{cta(CTA_FREE, 'light')}</div>
"""))
    b.append(board("A3s", f"Braces wore off | Static | Lifestyle | Aligner in hand | 9x16 | {CDATE}", "s9", VANILLA, f"""
  {glow(at='50% 15%')}
  <div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(200)}</div>
  <div class="abs hl" style="left:100px;right:100px;top:430px;text-align:center;font-size:84px">You had braces <em>at 14.</em></div>
  {shot(220, 650, 640, 640, 'stock-amy-a3-aligner-hold.jpg', 'rounded', fx=.45, fy=.3)}
  <div class="abs body" style="left:120px;right:120px;top:1330px;text-align:center;font-size:32px">Your teeth didn&rsquo;t stay put. Aligners can move them back, and a retainer keeps them there.</div>
  <div class="abs" style="left:0;right:0;top:1480px;display:flex;justify-content:center">{cta(CTA_FREE)}</div>
"""))
    b.append(board("A4s", f"From 2000 | Static | Object | Aligner case | 9x16 | {CDATE}", "s9", VANILLA, f"""
  {glow(at='50% 15%')}
  <div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(200)}</div>
  {shot(290, 420, 470, 520, 'stock-amy-a4-case.jpg', 'offset', fx=.5, fy=.5, tone=TAUPE, off=34)}
  <div class="abs label" style="left:0;right:0;top:1020px;text-align:center;color:{TAUPE_D}">Invisalign from</div>
  <div class="abs price" style="left:0;right:0;top:1070px;text-align:center;font-size:200px">£2,000</div>
  <div class="abs hl" style="left:100px;right:100px;top:1280px;text-align:center;font-size:46px">You&rsquo;ve been thinking about it <em>for years.</em></div>
  <div class="abs" style="left:0;right:0;top:1470px;display:flex;justify-content:center">{cta(CTA_FREE)}</div>
"""))
    b.append(board("A5s", f"22 hours | Static | Object | Lunch with aligners | 9x16 | {CDATE}", "s9", DUNE, f"""
  {glow('rgba(252,246,238,.7)', '50% 20%')}
  <div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(200)}</div>
  <div class="abs hl" style="left:100px;right:100px;top:430px;text-align:center;font-size:84px">20 to 22 <em>hours a day.</em></div>
  {shot(290, 640, 500, 680, 'gen-amy-a5-lunch.jpg', 'pill', fx=.45, fy=.5)}
  <div class="abs body" style="left:120px;right:120px;top:1350px;text-align:center;font-size:32px">Out to eat, back in after. We&rsquo;ll talk through how it fits your day.</div>
  <div class="abs" style="left:0;right:0;top:1470px;display:flex;justify-content:center">{cta(CTA_FREE)}</div>
"""))
    return page("Concept Dental | Amy | 9x16", b)


def compare_two(x, y, w, size=1.0, stack=False):
    """Bonding vs veneers, side by side (or stacked)."""
    def card(dark, kicker, title, rows, price):
        bg, fg, sub = (COFFEE, VANILLA, TAUPE) if dark else ("#FFFDF9", COFFEE, TAUPE_D)
        items = "".join(f'<div style="display:flex;gap:12px;font-size:{20 * size:.0f}px;line-height:1.35">{TICK.format(s=round(20 * size), c=sub)}<span>{r}</span></div>' for r in rows)
        return (f'<div style="flex:1;background:{bg};color:{fg};border-radius:10px;padding:{32 * size:.0f}px {28 * size:.0f}px;box-shadow:0 22px 44px rgba(70,58,52,.18);display:flex;flex-direction:column;gap:{14 * size:.0f}px">'
                f'<div class="label" style="font-size:{14 * size:.0f}px;color:{sub}">{kicker}</div>'
                f'<div style="font-size:{36 * size:.0f}px;font-weight:400;line-height:1.1">{title}</div>'
                f'<div style="display:flex;flex-direction:column;gap:{10 * size:.0f}px">{items}</div>'
                f'<div style="font-size:{48 * size:.0f}px;font-weight:300;line-height:1;margin-top:auto;padding-top:{10 * size:.0f}px">{price}</div></div>')
    a = card(True, "Adds to your tooth", "Composite bonding", ["Little or no preparation", "Often one visit", "Can be repaired if it chips"], "from £300")
    v = card(False, "Prepares the tooth", "E.max veneers", ["Tooth prepared first", "Can&rsquo;t be reversed", "Shade, shape and fit checked with you"], "£695")
    return f'<div class="abs" data-name="Compare" style="left:{x}px;top:{y}px;width:{w}px;display:flex;flex-direction:{"column" if stack else "row"};gap:22px">{a}{v}</div>'


H_TICKS = ["Shade-matched", "Often one visit", "Little or no preparation"]


def hannah_1x1():
    b = []
    b.append(board("H1", f"Same teeth | Static | Lifestyle | Friends | 1x1 | {CDATE}", "s1", VANILLA, f"""
  {glow()}
  {shot(560, 120, 440, 880, 'stock-hannah-h1-friends.jpg', 'arch', fx=.08, fy=.4, zoom=1.25)}
  <div class="abs" style="left:80px;top:80px">{logo(190)}</div>
  <div class="abs hl" style="left:80px;top:270px;width:460px;font-size:70px">Same teeth. <em>Just better.</em></div>
  <div class="abs body" style="left:80px;top:480px;width:440px;font-size:27px">Not new teeth. Yours, fixed where they need it.</div>
  <div class="abs body" style="left:80px;top:640px;width:440px;font-size:23px;color:{TAUPE_D}">Bonding adds to your teeth, shade-matched to the ones around it. From £300.</div>
  <div class="abs" style="left:80px;top:916px">{cta(CTA_COS, size=18, h=68, pad=34)}</div>
"""))
    b.append(board("H2", f"Not the white strip | Static | Object | Shade guide | 1x1 | {CDATE}", "s1", DUNE, f"""
  {glow('rgba(252,246,238,.75)', '25% 15%')}
  {shot(560, 120, 420, 480, 'stock-hannah-h2-shades.jpg', 'offset', fx=.5, fy=.55, tone=VANILLA)}
  <div class="abs" style="left:80px;top:80px">{logo(190)}</div>
  <div class="abs hl" style="left:80px;top:250px;width:440px;font-size:58px">Not the <em>one big white strip.</em></div>
  <div class="abs body" style="left:80px;top:520px;width:420px;font-size:26px">Natural shape. A shade that suits you. Checked with you first.</div>
  <div class="abs body" style="left:560px;top:680px;width:420px;font-size:22px;color:{TAUPE_D}">Composite bonding from £300. E.max veneers £695.</div>
  <div class="abs" style="left:80px;top:916px">{cta(CTA_COS, size=18, h=68, pad=34)}</div>
"""))
    b.append(board("H3", f"Add or take away | Static | Object | Compare cards | 1x1 | {CDATE}", "s1", VANILLA, f"""
  {glow()}
  <div class="abs" style="left:80px;top:80px">{logo(190)}</div>
  <div class="abs hl" style="left:80px;top:220px;width:920px;font-size:54px">Bonding adds. <em>Veneers prepare.</em></div>
  {compare_two(80, 340, 920, size=.95)}
  <div class="abs body" style="left:80px;top:830px;width:900px;font-size:23px">One of those can&rsquo;t be undone. We&rsquo;ll tell you which you actually need.</div>
  <div class="abs" style="left:80px;top:916px">{cta(CTA_COS, size=18, h=68, pad=34)}</div>
"""))
    b.append(board("H4", f"Lost on options | Static | Lifestyle | Sofa phone | 1x1 | {CDATE}", "s1", COFFEE, f"""
  {glow('rgba(202,179,156,.18)', '20% 25%')}
  {shot(580, 0, 500, 1080, 'stock-hannah-h4-sofa.jpg', 'bleed', fx=.48, fy=.5)}
  <div class="abs" style="left:80px;top:80px">{logo(170, VANILLA)}</div>
  <div class="abs hl" style="left:80px;top:250px;width:460px;font-size:56px;color:{VANILLA}">Bonding? Veneers? <em>Aligners?</em></div>
  <div class="abs body" style="left:80px;top:490px;width:440px;font-size:26px;color:{DUNE}">You know what bothers you. You just don&rsquo;t know what it&rsquo;s called.</div>
  <div class="abs rule" style="left:80px;top:660px;width:420px"></div>
  <div class="abs body" style="left:80px;top:690px;width:440px;font-size:25px;color:{VANILLA}">Tell us. We&rsquo;ll tell you what would help, and what it costs.</div>
  <div class="abs" style="left:80px;top:916px">{cta(CTA_COS, 'light', size=18, h=68, pad=34)}</div>
"""))
    b.append(board("H5", f"From 300 | Static | Lifestyle | Selfie | 1x1 | {CDATE}", "s1", VANILLA, f"""
  {glow()}
  {shot(660, 140, 340, 340, 'stock-hannah-h5-selfie.jpg', 'pill', fx=.55, fy=.35)}
  <div class="abs" style="left:80px;top:80px">{logo(190)}</div>
  <div class="abs label" style="left:84px;top:270px;color:{TAUPE_D}">Composite bonding from</div>
  <div class="abs price" style="left:64px;top:330px;font-size:180px">£300</div>
  <div class="abs hl" style="left:80px;top:580px;width:470px;font-size:44px">You might need <em>less than you think.</em></div>
  <div class="abs" style="left:620px;top:640px;width:380px">{ticks(H_TICKS, size=24, gap=14)}</div>
  <div class="abs" style="left:80px;top:916px">{cta(CTA_COS, size=18, h=68, pad=34)}</div>
"""))
    return page("Concept Dental | Hannah | 1x1", b)


def hannah_9x16():
    b = []
    b.append(board("H1s", f"Same teeth | Static | Lifestyle | Friends | 9x16 | {CDATE}", "s9", VANILLA, f"""
  {glow(at='50% 15%')}
  <div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(200)}</div>
  <div class="abs hl" style="left:100px;right:100px;top:430px;text-align:center;font-size:88px">Same teeth. <em>Just better.</em></div>
  {shot(240, 660, 600, 660, 'stock-hannah-h1-friends.jpg', 'arch', fx=.08, fy=.4, zoom=1.25)}
  <div class="abs body" style="left:120px;right:120px;top:1350px;text-align:center;font-size:32px">Not new teeth. Yours, fixed where they need it. Bonding from £300.</div>
  <div class="abs" style="left:0;right:0;top:1470px;display:flex;justify-content:center">{cta(CTA_COS)}</div>
"""))
    b.append(board("H2s", f"Not the white strip | Static | Object | Shade guide | 9x16 | {CDATE}", "s9", DUNE, f"""
  {glow('rgba(252,246,238,.75)', '50% 20%')}
  <div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(200)}</div>
  <div class="abs hl" style="left:100px;right:100px;top:430px;text-align:center;font-size:80px">Not the <em>one big white strip.</em></div>
  {shot(230, 700, 590, 560, 'stock-hannah-h2-shades.jpg', 'offset', fx=.5, fy=.55, tone=VANILLA, off=34)}
  <div class="abs body" style="left:120px;right:120px;top:1340px;text-align:center;font-size:32px">Natural shape. A shade that suits you. Checked with you first.</div>
  <div class="abs" style="left:0;right:0;top:1470px;display:flex;justify-content:center">{cta(CTA_COS)}</div>
"""))
    b.append(board("H3s", f"Add or take away | Static | Object | Compare cards | 9x16 | {CDATE}", "s9", VANILLA, f"""
  {glow(at='50% 15%')}
  <div class="abs" style="left:100px;top:270px">{logo(200)}</div>
  <div class="abs hl" style="left:100px;top:420px;width:880px;font-size:76px">Bonding adds. <em>Veneers prepare.</em></div>
  {compare_two(100, 640, 880, size=1.05, stack=True)}
  <div class="abs" style="left:100px;top:1470px">{cta(CTA_COS)}</div>
"""))
    b.append(board("H4s", f"Lost on options | Static | Lifestyle | Sofa phone | 9x16 | {CDATE}", "s9", COFFEE, f"""
  {glow('rgba(202,179,156,.18)', '50% 30%')}
  <div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(200, VANILLA)}</div>
  <div class="abs hl" style="left:100px;right:100px;top:420px;text-align:center;font-size:76px;color:{VANILLA}">Bonding? Veneers? <em>Aligners?</em></div>
  {shot(0, 680, 1080, 620, 'stock-hannah-h4-sofa.jpg', 'bleed', fx=.5, fy=.4)}
  <div class="abs body" style="left:120px;right:120px;top:1340px;text-align:center;font-size:32px;color:{DUNE}">Tell us what bothers you. We&rsquo;ll tell you what would help, and what it costs.</div>
  <div class="abs" style="left:0;right:0;top:1470px;display:flex;justify-content:center">{cta(CTA_COS, 'light')}</div>
"""))
    b.append(board("H5s", f"From 300 | Static | Lifestyle | Selfie | 9x16 | {CDATE}", "s9", VANILLA, f"""
  {glow(at='50% 15%')}
  <div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(200)}</div>
  {shot(290, 400, 500, 500, 'stock-hannah-h5-selfie.jpg', 'pill', fx=.55, fy=.35)}
  <div class="abs label" style="left:0;right:0;top:960px;text-align:center;color:{TAUPE_D}">Composite bonding from</div>
  <div class="abs price" style="left:0;right:0;top:1010px;text-align:center;font-size:220px">£300</div>
  <div class="abs hl" style="left:100px;right:100px;top:1250px;text-align:center;font-size:48px">You might need <em>less than you think.</em></div>
  <div class="abs body" style="left:120px;right:120px;top:1380px;text-align:center;font-size:26px;color:{TAUPE_D}">Shade-matched. Often one visit.</div>
  <div class="abs" style="left:0;right:0;top:1470px;display:flex;justify-content:center">{cta(CTA_COS)}</div>
"""))
    return page("Concept Dental | Hannah | 9x16", b)


X_RECEIPT = ["Shade-matched to your teeth", "Often done in one visit", "Little or no preparation", "Price in writing before you start"]


def bond_receipt(x, y, w, rot=1.2, size=24):
    items = "".join(f'<div style="display:flex;gap:14px;align-items:baseline;font-size:{size}px;padding:{size * .45:.0f}px 0;border-bottom:1px dashed {TAUPE}">'
                    f'{TICK.format(s=round(size * .9), c=COFFEE)}<span>{r}</span></div>' for r in X_RECEIPT)
    inner = (f'<div class="label" style="font-size:{size * .6:.0f}px;color:{TAUPE_D};margin-bottom:12px">Composite bonding</div>{items}'
             f'<div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:{size * .8:.0f}px">'
             f'<span class="label" style="font-size:{size * .6:.0f}px">From</span><span style="font-size:{size * 2.6:.0f}px;font-weight:300">£300</span></div>')
    return paper(x, y, w, inner, rot=rot, pad=round(size * 1.7))


def josh_1x1():
    b = []
    b.append(board("X1", f"One visit | Static | Lifestyle | Mirror | 1x1 | {CDATE}", "s1", VANILLA, f"""
  {glow()}
  {shot(560, 120, 440, 680, 'stock-josh-js1-mirror.jpg', 'rounded', fx=.4, fy=.35)}
  <div class="abs" style="left:80px;top:80px">{logo(190)}</div>
  <div class="abs hl" style="left:80px;top:260px;width:460px;font-size:64px">One visit. <em>Straight edges.</em></div>
  <div class="abs body" style="left:80px;top:500px;width:440px;font-size:26px">No months of treatment. No new set of teeth.</div>
  <div class="abs body" style="left:80px;top:610px;width:440px;font-size:24px">Bonding is added to your own teeth and shaped in the chair. <b style="font-weight:600">From £300.</b></div>
  <div class="abs" style="left:80px;top:916px">{cta(CTA_COS, size=18, h=68, pad=34)}</div>
"""))
    b.append(board("X2", f"Sunday league | Static | Object | Football boots | 1x1 | {CDATE}", "s1", COFFEE, f"""
  {glow('rgba(202,179,156,.18)', '80% 25%')}
  {shot(0, 0, 500, 1080, 'stock-josh-js2-boots.jpg', 'bleed', fx=.62, fy=.5)}
  <div class="abs" style="left:580px;top:96px">{logo(170, VANILLA)}</div>
  <div class="abs hl" style="left:580px;top:260px;width:430px;font-size:60px;color:{VANILLA}">That chip from <em>Sunday league.</em></div>
  <div class="abs body" style="left:580px;top:500px;width:420px;font-size:26px;color:{DUNE}">You stopped noticing it. You didn&rsquo;t stop hiding it.</div>
  <div class="abs rule" style="left:580px;top:670px;width:400px"></div>
  <div class="abs body" style="left:580px;top:700px;width:420px;font-size:25px;color:{VANILLA}">Rebuilt in your own shade, often in one visit. From <b style="font-weight:600">£300.</b></div>
  <div class="abs" style="left:580px;top:916px">{cta(CTA_COS, 'light', size=18, h=68, pad=34)}</div>
"""))
    b.append(board("X3", f"On camera | Static | Lifestyle | Video call | 1x1 | {CDATE}", "s1", DUNE, f"""
  {glow('rgba(252,246,238,.7)', '30% 20%')}
  {shot(560, 120, 440, 880, 'stock-josh-js3-call.jpg', 'arch', fx=.42, fy=.4)}
  <div class="abs" style="left:80px;top:80px">{logo(190)}</div>
  <div class="abs hl" style="left:80px;top:250px;width:450px;font-size:50px">More time looking at your teeth on calls <em>than in the mirror.</em></div>
  <div class="abs body" style="left:80px;top:590px;width:420px;font-size:26px">And now you can&rsquo;t stop seeing it.</div>
  <div class="abs body" style="left:80px;top:720px;width:420px;font-size:24px">Bonding, often in one visit. <b style="font-weight:600">From £300.</b></div>
  <div class="abs" style="left:80px;top:916px">{cta(CTA_COS, size=18, h=68, pad=34)}</div>
"""))
    b.append(board("X4", f"Honest answer | Static | Object | Coffee | 1x1 | {CDATE}", "s1", VANILLA, f"""
  {glow()}
  {shot(600, 140, 400, 400, 'stock-josh-js4-coffee.jpg', 'pill', fx=.5, fy=.5)}
  <div class="abs" style="left:80px;top:80px">{logo(190)}</div>
  <div class="abs hl" style="left:80px;top:250px;width:480px;font-size:62px">Will bonding stain? <em>Honest answer.</em></div>
  <div class="abs" style="left:80px;top:590px;width:900px">{ticks(['Tea, coffee and smoking can stain it over time', 'A polish helps keep it fresh', 'If it chips, it can be repaired'], size=26, gap=16)}</div>
  <div class="abs body" style="left:80px;top:820px;width:900px;font-size:22px;color:{TAUPE_D}">Composite bonding from £300. Written price before anything starts.</div>
  <div class="abs" style="left:80px;top:916px">{cta(CTA_COS, size=18, h=68, pad=34)}</div>
"""))
    b.append(board("X5", f"Not a full set | Static | Object | Receipt | 1x1 | {CDATE}", "s1", COFFEE, f"""
  {glow('rgba(202,179,156,.2)', '75% 30%')}
  {watermark(-120, 620, 520, COFFEE_L)}
  <div class="abs" style="left:80px;top:80px">{logo(170, VANILLA)}</div>
  <div class="abs hl" style="left:80px;top:250px;width:420px;font-size:64px;color:{VANILLA}">Not a full set. <em>From £300.</em></div>
  <div class="abs body" style="left:80px;top:500px;width:400px;font-size:26px;color:{DUNE}">You don&rsquo;t need veneers to fix one edge.</div>
  {bond_receipt(530, 200, 470, rot=2, size=23)}
  <div class="abs" style="left:80px;top:916px">{cta(CTA_COS, 'light', size=18, h=68, pad=34)}</div>
"""))
    return page("Concept Dental | Josh | 1x1", b)


def josh_9x16():
    b = []
    b.append(board("X1s", f"One visit | Static | Lifestyle | Mirror | 9x16 | {CDATE}", "s9", VANILLA, f"""
  {glow(at='50% 15%')}
  <div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(200)}</div>
  <div class="abs hl" style="left:100px;right:100px;top:430px;text-align:center;font-size:88px">One visit. <em>Straight edges.</em></div>
  {shot(220, 660, 640, 640, 'stock-josh-js1-mirror.jpg', 'rounded', fx=.4, fy=.35)}
  <div class="abs body" style="left:120px;right:120px;top:1340px;text-align:center;font-size:32px">Bonding is added to your own teeth and shaped in the chair. <b style="font-weight:600">From £300.</b></div>
  <div class="abs" style="left:0;right:0;top:1480px;display:flex;justify-content:center">{cta(CTA_COS)}</div>
"""))
    b.append(board("X2s", f"Sunday league | Static | Object | Football boots | 9x16 | {CDATE}", "s9", COFFEE, f"""
  {glow('rgba(202,179,156,.18)', '50% 30%')}
  <div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(200, VANILLA)}</div>
  <div class="abs hl" style="left:100px;right:100px;top:420px;text-align:center;font-size:80px;color:{VANILLA}">That chip from <em>Sunday league.</em></div>
  {shot(0, 680, 1080, 620, 'stock-josh-js2-boots.jpg', 'bleed', fx=.6, fy=.5)}
  <div class="abs body" style="left:120px;right:120px;top:1340px;text-align:center;font-size:32px;color:{DUNE}">You stopped noticing it. You didn&rsquo;t stop hiding it. Often fixed in one visit.</div>
  <div class="abs" style="left:0;right:0;top:1480px;display:flex;justify-content:center">{cta(CTA_COS, 'light')}</div>
"""))
    b.append(board("X3s", f"On camera | Static | Lifestyle | Video call | 9x16 | {CDATE}", "s9", DUNE, f"""
  {glow('rgba(252,246,238,.7)', '50% 20%')}
  <div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(200)}</div>
  <div class="abs hl" style="left:90px;right:90px;top:420px;text-align:center;font-size:62px">More time looking at your teeth on calls <em>than in the mirror.</em></div>
  {shot(240, 700, 600, 600, 'stock-josh-js3-call.jpg', 'arch', fx=.42, fy=.4)}
  <div class="abs body" style="left:120px;right:120px;top:1340px;text-align:center;font-size:32px">Bonding, often in one visit. <b style="font-weight:600">From £300.</b></div>
  <div class="abs" style="left:0;right:0;top:1470px;display:flex;justify-content:center">{cta(CTA_COS)}</div>
"""))
    b.append(board("X4s", f"Honest answer | Static | Object | Coffee | 9x16 | {CDATE}", "s9", VANILLA, f"""
  {glow(at='50% 15%')}
  <div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(200)}</div>
  <div class="abs hl" style="left:100px;right:100px;top:420px;text-align:center;font-size:80px">Will bonding stain? <em>Honest answer.</em></div>
  {shot(340, 690, 400, 400, 'stock-josh-js4-coffee.jpg', 'pill', fx=.5, fy=.5)}
  <div class="abs" style="left:150px;top:1150px;width:800px">{ticks(['Tea, coffee and smoking can stain it over time', 'A polish helps keep it fresh', 'If it chips, it can be repaired'], size=30, gap=14)}</div>
  <div class="abs" style="left:0;right:0;top:1480px;display:flex;justify-content:center">{cta(CTA_COS)}</div>
"""))
    b.append(board("X5s", f"Not a full set | Static | Object | Receipt | 9x16 | {CDATE}", "s9", COFFEE, f"""
  {glow('rgba(202,179,156,.2)', '50% 35%')}
  {watermark(620, 1400, 560, COFFEE_L)}
  <div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(200, VANILLA)}</div>
  <div class="abs hl" style="left:100px;right:100px;top:420px;text-align:center;font-size:84px;color:{VANILLA}">Not a full set. <em>From £300.</em></div>
  {bond_receipt(200, 680, 680, rot=-1.5, size=30)}
  <div class="abs body" style="left:120px;right:120px;top:1340px;text-align:center;font-size:32px;color:{DUNE}">You don&rsquo;t need veneers to fix one edge.</div>
  <div class="abs" style="left:0;right:0;top:1470px;display:flex;justify-content:center">{cta(CTA_COS, 'light')}</div>
"""))
    return page("Concept Dental | Josh | 9x16", b)


BUILDS = {
    "mark": (mark_1x1, mark_9x16),
    "denise": (denise_1x1, denise_9x16),
    "jo": (jo_1x1, jo_9x16),
    "peter": (peter_1x1, peter_9x16),
    "linda": (linda_1x1, linda_9x16),
    "barry": (barry_1x1, barry_9x16),
    "amy": (amy_1x1, amy_9x16),
    "hannah": (hannah_1x1, hannah_9x16),
    "josh": (josh_1x1, josh_9x16),
}

if __name__ == "__main__":
    import sys
    names = sys.argv[1:] or list(BUILDS)
    for n in names:
        one, nine = BUILDS[n]
        (ROOT / f"{n}-1x1.html").write_text(one())
        (ROOT / f"{n}-9x16.html").write_text(nine())
    print("built", ", ".join(names))
