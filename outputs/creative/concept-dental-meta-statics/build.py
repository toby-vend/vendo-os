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


BUILDS = {
    "mark": (mark_1x1, mark_9x16),
}

if __name__ == "__main__":
    import sys
    names = sys.argv[1:] or list(BUILDS)
    for n in names:
        one, nine = BUILDS[n]
        (ROOT / f"{n}-1x1.html").write_text(one())
        (ROOT / f"{n}-9x16.html").write_text(nine())
    print("built", ", ".join(names))
