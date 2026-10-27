"""Build R-Dental Meta static harness pages: one HTML page per persona per size.

Usage: ../avenue-dental-meta-statics/.venv/bin/python build.py [persona ...]
       ->  <persona>-1x1.html, <persona>-9x16.html, <persona>-landscape.html
Brand: no guideline, so taken from r-dental.uk and the logo files. Jost (the site's self-hosted font, OFL) for everything.
Colours: site teal #20A0B7 / #43B3B3, logo tooth teal, logo wordmark navy #063763 (the dark canvas), light teal tint.
Shapes from the site: teal gradient panels, 30px pill buttons, tooth-icon bullets. Logo: assets/logo-colour.png and
assets/logo-reversed.png (navy script turned white for dark panels), trimmed from the site's pngLogoRdental.webp.
Layouts: data/creative-templates/vendo-dental-statics (VT codes), rebuilt in R-Dental's brand; custom layouts are marked
Custom in copy-nina.md. Photos: assets/photos/web (gitignored), the client's own only: the team photo and Mrs Ranka's
portrait from r-dental.uk. No stock (Toby's rule). The Feb 2026 Drive shoot is out of the connector's size limit.
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent
A = ROOT / "assets"
WEB = A / "photos/web"

NAVY, DEEP, TEAL, TEAL2, TOOTH = "#063763", "#03223F", "#20A0B7", "#43B3B3", "#1D96AF"
MIST, WHITE, INK, GREY, STAR = "#E6F4F6", "#FFFFFF", "#0B2238", "#55636F", "#F6B40E"
SIZES = {"s1": (1080, 1080), "s9": (1080, 1920), "ls": (1200, 628)}
SUFFIX = {"s1": "1x1", "s9": "9x16", "ls": "1.91x1"}
DATE = "261027"
REVIEWS = "Rated Excellent · 34 Google reviews"
CTA = "Book a consultation"
ADDRESS = "98 Burnt Oak Broadway, Edgware"

GRAIN = ("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>"
         "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.9 0'/></filter>"
         "<rect width='100%' height='100%' filter='url(%23n)'/></svg>")

CSS = f"""
@font-face {{ font-family: Jost; src: url(assets/fonts/Jost.ttf); font-weight: 100 900; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ background: #2b3640; font-family: Jost, sans-serif; font-weight: 400; display: flex; gap: 80px; padding: 80px; align-items: flex-start; -webkit-font-smoothing: antialiased; }}
.ab {{ position: relative; overflow: hidden; flex: none; background: {NAVY}; color: {WHITE}; }}
.abs {{ position: absolute; }}
.ph {{ position: absolute; overflow: hidden; }}
.ph img {{ display: block; width: 100%; height: 100%; }}
.grain {{ position: absolute; inset: 0; background-image: url("{GRAIN}"); opacity: .08; mix-blend-mode: overlay; pointer-events: none; }}
.hl {{ font-family: Jost; font-weight: 500; line-height: 1.06; letter-spacing: -.01em; color: {WHITE}; }}
.hl b {{ font-weight: 500; color: {TEAL2}; }}
.lt .hl {{ color: {NAVY}; }}
.lt .hl b {{ color: {TEAL}; }}
.body {{ font-family: Jost; font-weight: 400; line-height: 1.35; color: rgba(255,255,255,.86); }}
.eyebrow {{ font-family: Jost; font-weight: 600; letter-spacing: .22em; text-transform: uppercase; color: {TEAL2}; }}
.cta {{ display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; font-family: Jost; font-weight: 500; white-space: nowrap; color: {WHITE};
  background: linear-gradient(180deg, #3BB6CB 0%, {TEAL} 55%, #1689A0 100%); box-shadow: inset 0 1.5px 0 rgba(255,255,255,.35), inset 0 -2px 0 rgba(0,40,70,.2), 0 12px 28px rgba(0,20,40,.35); }}
.rule {{ height: 2px; background: {TEAL2}; }}
"""

STARS = '<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="{c}" style="display:block"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>'
TOOTH_ICON = ('<svg viewBox="0 0 24 24" width="{s}" height="{s}" style="display:block;flex:none"><path d="M7.2 3.2c-2.6 0-4.2 2-4.2 4.6 0 2.4 1.1 3.8 1.6 5.6.6 2.2.8 7.4 2.7 7.4 1.7 0 1.6-4.6 3-5.6.5-.4 1.1-.4 1.6 0 1.4 1 1.3 5.6 3 5.6 1.9 0 2.1-5.2 2.7-7.4.5-1.8 1.6-3.2 1.6-5.6 0-2.6-1.6-4.6-4.2-4.6-1.9 0-2.9 1.1-4.8 1.1S9.1 3.2 7.2 3.2z" '
              'fill="none" stroke="{c}" stroke-width="1.6" stroke-linejoin="round"/></svg>')
ARROW = '<svg viewBox="0 0 24 24" width="{s}" height="{s}" style="display:block"><path d="{d}" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
PIN = '<svg viewBox="0 0 24 24" width="{s}" height="{s}" style="display:block;flex:none"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2z" fill="currentColor"/></svg>'
SEARCH = '<svg viewBox="0 0 24 24" width="{s}" height="{s}" style="display:block;flex:none"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="{c}" stroke-width="2.2"/><path d="M15.5 15.5L21 21" stroke="{c}" stroke-width="2.2" stroke-linecap="round"/></svg>'
MIC = ('<svg viewBox="0 0 24 24" width="{s}" height="{s}" style="display:block;flex:none"><rect x="9" y="3" width="6" height="11" rx="3" fill="#4285F4"/>'
       '<path d="M6 11a6 6 0 0 0 12 0M12 17v4" fill="none" stroke="#34A853" stroke-width="2" stroke-linecap="round"/></svg>')


def logo(h, dark=True, extra=""):
    """The stacked tooth + script logo at a given height (source is 1051x1369)."""
    f = "logo-reversed.png" if dark else "logo-colour.png"
    return f'<img src="assets/{f}" data-name="Logo" style="display:block;height:{h}px;width:{round(h * 1051 / 1369)}px;{extra}">'


def mark(h, extra=""):
    return f'<img src="assets/logo-mark.png" style="display:block;height:{h}px;width:{round(h * 1051 / 1096)}px;{extra}">'


def proof(size=22, color=WHITE, text=REVIEWS):
    stars = "".join(STARS.format(s=round(size * 1.05), c=STAR) for _ in range(5))
    return (f'<div style="display:flex;align-items:center;gap:{size * .55:.0f}px;color:{color};font-family:Jost;font-weight:500;font-size:{size}px;white-space:nowrap">'
            f'<span style="display:flex;gap:2px">{stars}</span>{text}</div>')


def cta(text=CTA, size=24, h=None):
    h = h or round(size * 2.8)
    return f'<span class="cta" style="height:{h}px;padding:0 {round(size * 1.6)}px;font-size:{size}px">{text}</span>'


def crop(src, w, h, fx=.5, fy=.5, zoom=1.0, flip=False):
    """Cover-crop from the real image aspect into a pre-cut file (the Figma capture ignores object-position)."""
    w, h = round(w), round(h)
    out = WEB / "crops" / f"{Path(src).stem}-{w}x{h}-{round(fx * 100)}-{round(fy * 100)}-{round(zoom * 100)}{'-f' if flip else ''}.jpg"
    if not out.exists():
        out.parent.mkdir(exist_ok=True)
        dims = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries", "stream=width,height",
                               "-of", "csv=p=0", str(WEB / src)], capture_output=True, text=True).stdout.strip()
        W, H = map(int, dims.split(","))
        if W / H > w / h:
            ch, cw = H, round(H * w / h)
        else:
            cw, ch = W, round(W * h / w)
        cw, ch = round(cw / zoom), round(ch / zoom)
        x = min(max(round(fx * W - cw / 2), 0), W - cw)
        y = min(max(round(fy * H - ch / 2), 0), H - ch)
        ow = min(cw, 2 * w) // 2 * 2
        vf = ("hflip," if flip else "") + f"crop={cw}:{ch}:{x}:{y},scale={ow}:-2"
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(WEB / src), "-vf", vf, "-q:v", "3", str(out)], check=True)
    return f"assets/photos/web/crops/{out.name}"


def photo(src, x, y, w, h, fx=.5, fy=.5, zoom=1.0, radius=0, extra="", flip=False):
    """fx is measured on the image as it appears (after the flip, if any)."""
    rad = f"border-radius:{radius}px;" if radius else ""
    return (f'<div class="ph" data-name="Photo" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;{rad}{extra}">'
            f'<img src="{crop(src, w, h, fx, fy, zoom, flip)}"></div>')


def lit(size):
    """Navy board background lit like the site's hero: a soft teal glow top left, deeper navy bottom right."""
    w, h = SIZES[size]
    m = max(w, h)
    return (f"radial-gradient({m * .7:.0f}px {m * .55:.0f}px at 18% 12%, rgba(32,160,183,.38), rgba(32,160,183,0) 70%),"
            f"radial-gradient({m * .6:.0f}px {m * .5:.0f}px at 90% 95%, rgba(3,25,48,.85), rgba(3,25,48,0) 70%),"
            f"linear-gradient(160deg, #0A4377 0%, {NAVY} 45%, {DEEP} 100%)")


def board(size, name, inner, bg=None):
    w, h = SIZES[size]
    return (f'<div class="ab" data-name="{name} | {SUFFIX[size]} | {DATE}" style="width:{w}px;height:{h}px;background:{bg or lit(size)}">'
            f'{inner}<div class="grain"></div></div>')


def page(title, boards):
    return (f"<!doctype html><html lang='en-GB'><head><meta charset='utf-8'><title>{title}</title>"
            f"<style>{CSS}</style><script src='https://mcp.figma.com/mcp/html-to-design/capture.js' async></script>"
            f"</head><body>{''.join(boards)}</body></html>")


def fade_panel(w, h, solid):
    """Copy-side panel that fades into the photo with plain gradients (the Figma capture drops CSS masks):
    a navy base solid to `solid` (0-1) of its width then clear, with the site's teal glow top left."""
    pct = round(solid * 100)
    bg = (f"radial-gradient({w * .9:.0f}px {h * .9:.0f}px at 12% 8%, rgba(32,160,183,.34), rgba(32,160,183,0) 70%),"
          f"linear-gradient(180deg, rgba(3,34,63,0) 40%, rgba(3,34,63,.55) 100%),"
          f"linear-gradient(90deg, {NAVY} 0%, {NAVY} {pct}%, rgba(6,55,99,0) 100%)")
    return (f'<div class="abs" data-name="Panel (locked)" style="left:0;top:0;width:{w}px;height:{h}px;background:{bg}"></div>'
            f'<div class="abs" data-name="Overlay (locked)" style="left:{w * solid:.0f}px;top:0;width:{w - w * solid:.0f}px;height:{h}px;background:linear-gradient(90deg,rgba(3,34,63,.25),rgba(3,34,63,0))"></div>')


def scrim(css, name="Overlay"):
    return f'<div class="abs" data-name="{name}" style="{css}"></div>'


# ---------------------------------------------------------------- NINA (fixing work done abroad)
SET = "Work done abroad | Static"
N1_HL = "Had work done abroad and something's <b>not right?</b>"
N1_PROMISE = "No judgement. Just an honest look at what can be fixed."
N1_MECH = "Assessed by a Consultant in Restorative Dentistry"


def n1(size):
    """Custom: type on lit navy over the practice's own team photo (Mrs Ranka centre), the team as the 'no judgement' promise."""
    name = f"{SET} | Team photo | Something's not right"
    hl = lambda fs, w: f'<div class="hl" style="width:{w}px;font-size:{fs}px">{N1_HL}</div>'
    if size == "ls":
        inner = f"""{photo('team.jpg', 500, 0, 700, 628, .66, .44)}
{fade_panel(640, 628, .74)}
<div class="abs" style="left:56px;top:40px">{logo(80)}</div>
<div class="abs" style="left:56px;top:142px">{hl(38, 440)}</div>
<div class="abs rule" style="left:56px;top:300px;width:64px"></div>
<div class="abs body" style="left:56px;top:318px;width:420px;font-size:19px">{N1_PROMISE}</div>
<div class="abs eyebrow" style="left:56px;top:396px;width:420px;font-size:12px;line-height:1.6">{N1_MECH}</div>
<div class="abs" style="left:56px;top:462px">{cta(size=18)}</div>
<div class="abs" style="left:56px;top:548px">{proof(14)}</div>"""
        return board(size, name, inner)
    if size == "s9":
        top = 880
        inner = f"""{photo('team.jpg', 0, top, 1080, 1920 - top, .5, .5)}
{scrim(f"left:0;top:{top}px;width:1080px;height:{1920 - top}px;background:linear-gradient(180deg,{NAVY} 0%,rgba(6,55,99,0) 14%,rgba(6,55,99,0) 42%,rgba(3,34,63,.82) 60%,{DEEP} 82%)")}
<div class="abs" style="left:80px;top:270px">{logo(120)}</div>
<div class="abs" style="left:80px;top:430px">{hl(70, 920)}</div>
<div class="abs rule" style="left:80px;top:640px;width:96px"></div>
<div class="abs body" style="left:80px;top:668px;width:920px;font-size:34px">{N1_PROMISE}</div>
<div class="abs eyebrow" style="left:80px;top:776px;font-size:18px">{N1_MECH}</div>
<div class="abs" style="left:80px;top:1470px;display:flex;align-items:center;gap:30px">{cta(size=26)}{proof(19)}</div>"""
        return board(size, name, inner)
    top = 470
    inner = f"""{photo('team.jpg', 0, top, 1080, 1080 - top, .5, .54)}
{scrim(f"left:0;top:{top}px;width:1080px;height:{1080 - top}px;background:linear-gradient(180deg,{NAVY} 0%,rgba(6,55,99,0) 18%,rgba(6,55,99,0) 52%,rgba(3,34,63,.85) 80%,{DEEP} 100%)")}
<div class="abs" style="left:70px;top:56px">{logo(92)}</div>
<div class="abs" style="left:70px;top:178px">{hl(56, 940)}</div>
<div class="abs body" style="left:70px;top:322px;width:940px;font-size:28px">{N1_PROMISE}</div>
<div class="abs eyebrow" style="left:70px;top:384px;font-size:15px">{N1_MECH}</div>
<div class="abs" style="left:70px;top:960px;display:flex;align-items:center;gap:28px">{cta(size=22)}{proof(16)}</div>"""
    return board(size, name, inner)


QUERY = "dentist to fix veneers done abroad"
N2_HL = "You're not the first<br><b>to search this.</b>"


def search_bar(w, fs):
    return (f'<div data-name="Search bar" style="width:{w}px;height:{fs * 2.9:.0f}px;display:flex;align-items:center;gap:{fs * .7:.0f}px;padding:0 {fs * 1.1:.0f}px;border-radius:999px;background:{WHITE};'
            f'box-shadow:0 {fs * .5:.0f}px {fs * 1.4:.0f}px rgba(0,20,40,.35)">{SEARCH.format(s=round(fs * 1.15), c="#5f6368")}'
            f'<span style="flex:1;font-family:Jost;font-size:{fs}px;color:#202124;white-space:nowrap">{QUERY}<span style="display:inline-block;width:2px;height:{fs * 1.1:.0f}px;background:{TEAL};margin-left:3px;vertical-align:-{fs * .18:.0f}px"></span></span>{MIC.format(s=round(fs * 1.2))}</div>')


def result_card(w, fs):
    """The practice as the search result: favicon tooth mark, name, stars, specialty line, address."""
    fav = (f'<div style="width:{fs * 2.3:.0f}px;height:{fs * 2.3:.0f}px;border-radius:50%;background:{MIST};display:flex;align-items:center;justify-content:center;flex:none">{mark(round(fs * 1.55))}</div>')
    stars = "".join(STARS.format(s=round(fs * .95), c=STAR) for _ in range(5))
    return (f'<div data-name="Result card" style="width:{w}px;padding:{fs * 1.05:.0f}px {fs * 1.2:.0f}px;border-radius:{fs * .9:.0f}px;background:{WHITE};box-shadow:0 {fs * .6:.0f}px {fs * 1.6:.0f}px rgba(0,20,40,.4);font-family:Jost;color:#202124">'
            f'<div style="display:flex;align-items:center;gap:{fs * .7:.0f}px">{fav}<div><div style="font-size:{fs * 1.2:.0f}px;font-weight:500;color:#1a0dab;line-height:1.1">R-Dental</div>'
            f'<div style="font-size:{fs * .8:.0f}px;color:#5f6368;margin-top:{fs * .15:.0f}px">r-dental.uk · Dentist</div></div></div>'
            f'<div style="display:flex;align-items:center;gap:{fs * .45:.0f}px;margin-top:{fs * .75:.0f}px;font-size:{fs * .9:.0f}px;color:#3c4043">'
            f'<span style="display:flex;gap:2px">{stars}</span>Excellent · 34 Google reviews</div>'
            f'<div style="font-size:{fs:.0f}px;font-weight:500;color:{NAVY};margin-top:{fs * .55:.0f}px">Consultant-led restorative dentistry · Self-referrals welcome</div>'
            f'<div style="display:flex;align-items:center;gap:{fs * .35:.0f}px;margin-top:{fs * .45:.0f}px;font-size:{fs * .85:.0f}px;color:#5f6368">{PIN.format(s=round(fs))}{ADDRESS}</div></div>')


def n2(size):
    """VT-29 Search bar, type-led: her search and R-Dental as the result on lit navy, the tooth mark as a watermark."""
    name = f"{SET} | Typographic | Search bar"
    hl = lambda fs, w: f'<div class="hl" style="width:{w}px;font-size:{fs}px">{N2_HL}</div>'
    wm = lambda h, x, y: mark(h, f"position:absolute;left:{x}px;top:{y}px;opacity:.07;filter:grayscale(1) brightness(3)")
    if size == "ls":
        inner = f"""{wm(520, 760, 160)}
<div class="abs" style="left:52px;top:40px">{logo(76)}</div>
<div class="abs" style="left:52px;top:170px">{hl(44, 460)}</div>
<div class="abs body" style="left:52px;top:300px;width:440px;font-size:19px">A specialist second opinion in Edgware. No referral needed.</div>
<div class="abs" style="left:52px;top:400px">{cta(size=18)}</div>
<div class="abs" style="left:540px;top:120px">{search_bar(610, 17)}</div>
<div class="abs" style="left:540px;top:200px">{result_card(610, 16)}</div>"""
        return board(size, name, inner)
    if size == "s9":
        inner = f"""{wm(900, 420, 1100)}
<div class="abs" style="left:80px;top:270px">{logo(130)}</div>
<div class="abs" style="left:80px;top:560px">{hl(86, 920)}</div>
<div class="abs" style="left:70px;top:820px">{search_bar(940, 30)}</div>
<div class="abs" style="left:70px;top:940px">{result_card(940, 26)}</div>
<div class="abs" style="left:70px;top:1290px">{cta(size=27)}</div>"""
        return board(size, name, inner)
    inner = f"""{wm(760, 520, 420)}
<div class="abs" style="left:70px;top:60px">{logo(110)}</div>
<div class="abs" style="left:70px;top:230px">{hl(64, 900)}</div>
<div class="abs" style="left:70px;top:430px">{search_bar(940, 27)}</div>
<div class="abs" style="left:70px;top:535px">{result_card(940, 23)}</div>
<div class="abs" style="left:70px;top:810px">{cta(size=24)}</div>"""
    return board(size, name, inner)


PROBLEMS = ["A veneer that's chipped or come loose", "Gums that never settled around them", "Teeth that look bulky, not like you"]


def problems(fs, w, label="Work done abroad?"):
    return (f'<div style="width:{w}px"><div class="eyebrow" style="font-size:{fs * .62:.0f}px">{label}</div>'
            + "".join(f'<div style="display:flex;align-items:center;gap:{fs * .75:.0f}px;padding:{fs * .78:.0f}px 0;border-bottom:1px solid rgba(255,255,255,.16)">{TOOTH_ICON.format(s=round(fs * 1.55), c=TEAL2)}'
                      f'<span style="font-family:Jost;font-weight:500;font-size:{fs:.0f}px;line-height:1.25;color:{WHITE}">{t}</span></div>' for t in PROBLEMS) + '</div>')


def arrow_chip(d, direction="down"):
    path = "M12 5v14M6 13l6 6 6-6" if direction == "down" else "M5 12h14M13 6l6 6-6 6"
    return (f'<div style="width:{d}px;height:{d}px;border-radius:50%;background:radial-gradient(circle at 35% 30%, #4CC3D6, {TEAL} 55%, #137F95);display:flex;align-items:center;justify-content:center;'
            f'box-shadow:0 8px 22px rgba(0,20,40,.4), 0 0 0 {d * .07:.0f}px rgba(255,255,255,.18)">{ARROW.format(s=round(d * .5), d=path)}</div>')


def portrait(d):
    """Mrs Ranka's site portrait (bgOwner.webp) in a ringed circle."""
    return (f'<div style="position:relative;width:{d}px;height:{d}px;flex:none;border-radius:50%;box-shadow:0 0 0 {d * .035:.0f}px {WHITE}, 0 {d * .08:.0f}px {d * .2:.0f}px rgba(0,30,50,.35)">'
            f'{photo("meena-pro.jpg", 0, 0, d, d, .77, .45, 1.25, radius=d / 2)}</div>')


def name_tag(fs, color=WHITE):
    return (f'<div style="font-family:Jost;line-height:1.2"><div style="font-weight:600;font-size:{fs:.0f}px;color:{color}">Mrs Meena Ranka</div>'
            f'<div style="font-size:{fs * .82:.0f}px;color:rgba(255,255,255,.88);margin-top:{fs * .15:.0f}px">Consultant in Restorative Dentistry</div></div>')


def teal_panel(x, y, w, h, wm_h, wm_x, wm_y):
    """The site's teal hero gradient, lit top left, with a faint white tooth mark."""
    return (f'<div class="abs" data-name="Teal panel" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;overflow:hidden;'
            f'background:radial-gradient({w * .9:.0f}px {h * .7:.0f}px at 20% 10%, rgba(255,255,255,.18), rgba(255,255,255,0) 70%),linear-gradient(160deg,#2AAFC4 0%,{TEAL} 40%,#137C93 100%)">'
            f'<img src="assets/logo-mark-white.png" style="position:absolute;left:{wm_x}px;top:{wm_y}px;height:{wm_h}px;opacity:.1"></div>')


def solution(fs):
    return (f'<div class="eyebrow" style="font-size:{fs * .36:.0f}px;color:{NAVY}">The fix</div>'
            f'<div class="hl" style="font-size:{fs:.0f}px;margin-top:{fs * .18:.0f}px">An honest plan <b style="color:{NAVY}">from a consultant.</b></div>')


def n3(size):
    """VT-30 Problem and solution: three problems on navy, arrow chip, the solution on the site's teal panel with Mrs Ranka."""
    name = f"{SET} | Mrs Ranka | Sound familiar"
    if size == "ls":
        inner = f"""{teal_panel(600, 0, 600, 628, 520, 260, 200)}
<div class="abs" style="left:48px;top:40px">{logo(70)}</div>
<div class="abs" style="left:48px;top:142px">{problems(21, 500)}</div>
<div class="abs" style="left:48px;top:450px">{cta(size=17)}</div>
<div class="abs" style="left:48px;top:540px">{proof(14)}</div>
<div class="abs" style="left:570px;top:250px">{arrow_chip(60, 'right')}</div>
<div class="abs" style="left:660px;top:56px">{portrait(190)}</div>
<div class="abs" style="left:880px;top:120px;width:300px">{name_tag(19)}</div>
<div class="abs" style="left:660px;top:330px;width:500px">{solution(40)}</div>"""
        return board(size, name, inner)
    if size == "s9":
        split = 880
        inner = f"""{teal_panel(0, split, 1080, 1920 - split, 900, 480, 360)}
<div class="abs" style="left:80px;top:270px">{logo(130)}</div>
<div class="abs" style="left:80px;top:430px">{problems(36, 920)}</div>
<div class="abs" style="left:80px;top:812px">{proof(19)}</div>
<div class="abs" style="left:880px;top:{split - 62}px">{arrow_chip(124)}</div>
<div class="abs" style="left:80px;top:{split + 90}px">{portrait(250)}</div>
<div class="abs" style="left:370px;top:{split + 170}px;width:620px">{name_tag(30)}</div>
<div class="abs" style="left:80px;top:{split + 380}px;width:920px">{solution(66)}</div>
<div class="abs" style="left:80px;top:1490px">{cta(size=26)}</div>"""
        return board(size, name, inner)
    inner = f"""{teal_panel(540, 0, 540, 1080, 700, 220, 520)}
<div class="abs" style="left:64px;top:60px">{logo(110)}</div>
<div class="abs" style="left:64px;top:290px">{problems(29, 430)}</div>
<div class="abs" style="left:64px;top:880px">{cta(size=22)}</div>
<div class="abs" style="left:64px;top:990px">{proof(15)}</div>
<div class="abs" style="left:500px;top:575px">{arrow_chip(80, "right")}</div>
<div class="abs" style="left:640px;top:110px">{portrait(300)}</div>
<div class="abs" style="left:600px;top:450px;width:440px;text-align:left">{name_tag(24)}</div>
<div class="abs" style="left:600px;top:640px;width:440px">{solution(54)}</div>"""
    return board(size, name, inner)


PERSONAS = {"nina": [n1, n2, n3]}
FILES = {"s1": "1x1", "s9": "9x16", "ls": "landscape"}

if __name__ == "__main__":
    which = sys.argv[1:] or list(PERSONAS)
    for p in which:
        for size, suffix in FILES.items():
            (ROOT / f"{p}-{suffix}.html").write_text(page(f"R-Dental | {p} | {suffix}", [f(size) for f in PERSONAS[p]]))
    print("built", which)
