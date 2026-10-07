"""Build Signature Smiles Meta static harness pages (one HTML page per persona per size).

Usage: python3 build.py [persona ...]   -> writes <persona>-1x1.html and <persona>-9x16.html
Brand: Signature Smiles guideline (Figma OsACbOAzknBYQcjlGwWI8m). Type: PARISIAN (assets/fonts) + Montserrat.
Copy: copy-<persona>.md. Photos: assets/photos (gitignored); stock is licensed Freepik via Magnific.
"""
import re
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).parent
A = ROOT / "assets"

C = dict(copper="#87552F", terra="#C47F4A", olive="#474A37", sand="#9A8F73", stone="#C9BBA0",
         sage="#E3E1D2", linen="#F9F7F5", cream="#F3F1EF", ink="#1E1E1C", white="#FFFFFF")


def logo(variant="web", width=220):
    """Official logo SVG inline. variant: web | web-light | original | original-light | icon."""
    s = (A / f"logo-{variant}.svg").read_text()
    s = re.sub(r"<\?xml.*?\?>", "", s, flags=re.S)
    w, h = (float(x) for x in re.search(r'width="([\d.]+)" height="([\d.]+)"', s).groups())
    return re.sub(r'width="[\d.]+" height="[\d.]+"', f'width="{width}" height="{round(width * h / w, 1)}" style="display:block"', s, count=1)


GRAIN = ("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>"
         "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.9 0'/></filter>"
         "<rect width='100%' height='100%' filter='url(%23n)'/></svg>")

CSS = f"""
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600&display=block');
@font-face {{ font-family: 'PARISIAN'; src: url(assets/fonts/parisian.ttf) format('truetype'); font-display: block; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ background: #2a2a2a; font-family: Montserrat, sans-serif; display: flex; gap: 80px; padding: 80px; align-items: flex-start; -webkit-font-smoothing: antialiased; }}
.ab {{ position: relative; overflow: hidden; flex: none; color: {C['ink']}; }}
.s1 {{ width: 1080px; height: 1080px; }}
.s9 {{ width: 1080px; height: 1920px; }}
.abs {{ position: absolute; }}
.cover {{ position: absolute; inset: 0; background-size: cover; background-position: center; }}
.grain {{ position: absolute; inset: 0; background-image: url("{GRAIN}"); opacity: .10; mix-blend-mode: overlay; pointer-events: none; }}
.hl {{ font-family: 'PARISIAN', serif; font-weight: 400; line-height: 1.04; color: {C['copper']}; }}
.price {{ font-family: 'PARISIAN', serif; font-weight: 400; line-height: .9; color: {C['copper']}; }}
.body {{ font-size: 30px; font-weight: 400; line-height: 1.45; }}
.label {{ font-size: 19px; font-weight: 600; letter-spacing: .2em; text-transform: uppercase; color: {C['sand']}; }}
.cta {{ display: inline-flex; align-items: center; height: 72px; padding: 0 42px; border-radius: 999px; font-size: 20px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; }}
.cta.olive {{ background: {C['olive']}; color: {C['white']}; }}
.cta.linen {{ background: {C['linen']}; color: {C['olive']}; }}
.small {{ font-size: 20px; font-weight: 500; letter-spacing: .02em; }}
"""


def photo_aspect(img):
    """Width / height of a JPEG in assets/photos, read from the header (never stretch a photo)."""
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


def bg(img, w, h, fx=0.5, fy=0.4, zoom=1.0):
    """background CSS that cover-crops img into a w x h box around focal point fx, fy."""
    a = photo_aspect(img)
    bw, bh = (w, w / a) if w / h > a else (h * a, h)
    bw, bh = bw * zoom, bh * zoom
    return (f"background-image:url(assets/photos/{img});background-size:{bw:.0f}px {bh:.0f}px;"
            f"background-position:{-(bw - w) * fx:.0f}px {-(bh - h) * fy:.0f}px;background-repeat:no-repeat;")


def photo(x, y, w, h, img, fx=0.5, fy=0.4, zoom=1.0, radius="0", extra=""):
    return f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;border-radius:{radius};{bg(img, w, h, fx, fy, zoom)}{extra}"></div>'


def arch(x, y, w, h, img, fx=0.5, fy=0.35, zoom=1.0, outline=True, off=16, line=C['stone']):
    """The brand's arched photo frame, with the stone outline offset up and right."""
    r = f"{w / 2}px {w / 2}px 0 0"
    o = (f'<div class="abs" style="left:{x + off}px;top:{y - off}px;width:{w}px;height:{h}px;border:2px solid {line};'
         f'border-bottom:none;border-radius:{r}"></div>') if outline else ""
    return o + photo(x, y, w, h, img, fx, fy, zoom, r, "box-shadow:0 30px 60px rgba(30,30,28,.16);")


def badge(x, y, size=150):
    return f'<img class="abs" src="assets/curve-text.webp" style="left:{x}px;top:{y}px;width:{size}px;height:{size}px;object-fit:contain">'


STAR = '<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="currentColor"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>'
TICK = '<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10.5" stroke-width="1.4"/><path d="M7.5 12.4l3 3 6-6.4"/></svg>'
REVIEWS = "5.0 from 110 Google reviews"


def proof(color, size=22, star=C['terra']):
    stars = "".join(STAR.format(s=size) for _ in range(5))
    return (f'<div style="display:flex;align-items:center;gap:14px">'
            f'<span style="display:flex;gap:3px;color:{star}">{stars}</span>'
            f'<span class="small" style="font-size:{size}px;color:{color}">{REVIEWS}</span></div>')


def numbered(items, color_n, color_t, size=30, gap=24, circle=54):
    return "".join(
        f'<div style="display:flex;align-items:center;gap:24px;margin-bottom:{gap}px">'
        f'<div style="width:{circle}px;height:{circle}px;flex:none;border:1.5px solid {color_n};border-radius:50%;display:flex;align-items:center;justify-content:center;'
        f'font-family:PARISIAN,serif;font-size:{int(circle * .5)}px;color:{color_n}">{i}</div>'
        f'<div style="font-size:{size}px;line-height:1.3;color:{color_t}">{t}</div></div>' for i, t in enumerate(items, 1))


def ticks(items, color_i, color_t, size=28, gap=16):
    return "".join(
        f'<div style="display:flex;align-items:center;gap:18px;margin-bottom:{gap}px;color:{color_i}">{TICK.format(s=int(size * 1.15))}'
        f'<span style="font-size:{size}px;line-height:1.3;color:{color_t}">{t}</span></div>' for t in items)


def receipt(x, y, w, title, items, total=None, scale=1.0, rot=1.4):
    """A paper card with a tick list, lit and shadowed so it sits on the canvas."""
    s = scale
    rows = ticks(items, C['terra'], C['ink'], size=int(25 * s), gap=int(12 * s))
    tot = (f'<div style="display:flex;justify-content:space-between;align-items:baseline;border-top:1px dashed {C["stone"]};margin-top:{int(14 * s)}px;padding-top:{int(18 * s)}px">'
           f'<span class="label" style="font-size:{int(16 * s)}px">{total[0]}</span>'
           f'<span class="price" style="font-size:{int(64 * s)}px">{total[1]}</span></div>') if total else ""
    return (f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px;padding:{int(40 * s)}px {int(44 * s)}px;'
            f'background:linear-gradient(160deg,#FFFFFF 0%,#FBF9F6 60%,#F3EFE9 100%);border-radius:6px;transform:rotate({rot}deg);'
            f'box-shadow:0 40px 70px rgba(30,30,28,.24),0 8px 16px rgba(30,30,28,.12)">'
            f'<div class="label" style="font-size:{int(16 * s)}px;margin-bottom:{int(18 * s)}px">{title}</div>{rows}{tot}</div>')


def board(bid, name, size, bgc, inner):
    return (f'<div class="ab {size}" id="{bid}" data-name="{name}" style="background:{bgc}">{inner}'
            f'<div class="grain"></div></div>')


def page(title, boards):
    return (f"<!doctype html><html lang='en-GB'><head><meta charset='utf-8'><title>{title}</title>"
            f"<style>{CSS}</style><script src='https://mcp.figma.com/mcp/html-to-design/capture.js' async></script></head><body>{''.join(boards)}</body></html>")


def warm_linen():
    return f'<div class="cover" style="background:radial-gradient(circle at 22% 18%,#FFFFFF 0%,{C["linen"]} 40%,#EDE8E1 100%)"></div>'


def warm_sage():
    return f'<div class="cover" style="background:radial-gradient(circle at 25% 20%,#EFEEE4 0%,{C["sage"]} 45%,#D3D0BE 100%)"></div>'


def warm_olive():
    return f'<div class="cover" style="background:radial-gradient(circle at 75% 20%,#5A5E47 0%,{C["olive"]} 45%,#363829 100%)"></div>'


# ---------------------------------------------------------------- MARK (lapsed five years or more)
CTA_FIRST = "Book your first visit"
EXAM_ITEMS = ["Teeth and gums checked", "Two x-rays", "Oral cancer screening", "Jaw and bite check", "A plan with every cost"]
D = "261008"


def mark_1x1():
    b = []
    b.append(board("M1", f"No judgement | Static | Stock man 50s | Not been in years | 1x1 | {D}", "s1", C['linen'], f"""
  {warm_linen()}
  {arch(600, 120, 400, 700, 'mark-relief.jpg', fx=0.42, fy=0.25)}
  {badge(500, 690, 150)}
  <div class="abs hl" style="left:80px;top:150px;font-size:96px">Not been<br>in years?</div>
  <div class="abs hl" style="left:80px;top:390px;font-size:46px;color:{C['olive']}">Nobody here<br>will ask why.</div>
  <div class="abs body" style="left:80px;top:540px;width:420px;font-size:25px;color:{C['ink']}">It&rsquo;s one of the things we hear most often.</div>
  <div class="abs" style="left:80px;top:660px">{proof(C['sand'], 20)}</div>
  <div class="abs body" style="left:80px;top:720px;font-size:24px;color:{C['copper']};font-weight:500">New patient exam £90</div>
  <div class="abs" style="left:80px;top:950px">{logo('web', 230)}</div>
  <div class="abs" style="left:640px;top:968px"><span class="cta olive" style="height:62px;font-size:17px;padding:0 32px">{CTA_FIRST}</span></div>"""))
    b.append(board("M2", f"The twinge | Static | Stock man 40s | Comes and goes | 1x1 | {D}", "s1", C['linen'], f"""
  {photo(380, 0, 700, 1080, 'mark-kitchen-thoughtful.jpg', fx=0.62, fy=0.5)}
  <div class="cover" style="background:linear-gradient(90deg,{C['linen']} 0%,{C['linen']} 36%,rgba(249,247,245,.86) 48%,rgba(249,247,245,0) 72%)"></div>
  <div class="abs hl" style="left:80px;top:150px;font-size:100px">It comes<br>and goes.</div>
  <div class="abs hl" style="left:80px;top:390px;font-size:60px;color:{C['olive']}">But it<br>hasn&rsquo;t gone.</div>
  <div class="abs body" style="left:80px;top:570px;width:430px;font-size:26px">Get it looked at properly, without the lecture.</div>
  <div class="abs body" style="left:80px;top:700px;width:430px;font-size:24px;color:{C['copper']};font-weight:500">New patient exam £90,<br>x-rays included</div>
  <div class="abs" style="left:80px;top:950px">{logo('web', 230)}</div>
  <div class="abs" style="left:640px;top:968px"><span class="cta olive" style="height:62px;font-size:17px;padding:0 32px">{CTA_FIRST}</span></div>"""))
    b.append(board("M3", f"What happens | Static | Stock man 40s | Step by step | 1x1 | {D}", "s1", C['sage'], f"""
  {warm_sage()}
  {arch(690, 110, 320, 470, 'mark-chair.jpg', fx=0.66, fy=0.35)}
  <div class="abs label" style="left:80px;top:120px">If it&rsquo;s been a while</div>
  <div class="abs hl" style="left:80px;top:165px;font-size:74px">Your first visit,<br>step by step</div>
  <div class="abs" style="left:80px;top:390px">{numbered(["Full check of teeth and gums", "Two x-rays", "Oral cancer screening", "Your plan and the costs, explained"], C['copper'], C['ink'], size=28, gap=22, circle=52)}</div>
  <div class="abs" style="left:80px;top:720px;display:flex;align-items:baseline;gap:20px"><span class="price" style="font-size:110px">£90</span><span class="label" style="font-size:17px">New patient exam</span></div>
  <div class="abs" style="left:80px;top:950px">{logo('web', 230)}</div>
  <div class="abs" style="left:640px;top:968px"><span class="cta olive" style="height:62px;font-size:17px;padding:0 32px">{CTA_FIRST}</span></div>"""))
    b.append(board("M4", f"Cost fear | Static | Product | One number | 1x1 | {D}", "s1", C['olive'], f"""
  {warm_olive()}
  <div class="abs hl" style="left:80px;top:110px;font-size:62px;color:{C['linen']}">Worried what it&rsquo;ll<br>cost after all<br>this time?</div>
  <div class="abs label" style="left:80px;top:380px;color:{C['stone']}">Start with one number</div>
  <div class="abs price" style="left:70px;top:440px;font-size:210px;color:{C['linen']}">£90</div>
  <div class="abs body" style="left:80px;top:660px;width:380px;font-size:24px;color:rgba(249,247,245,.88)">Every cost explained before anything starts.</div>
  {receipt(545, 300, 470, "Your new patient exam", EXAM_ITEMS, scale=0.96, rot=2.2)}
  <div class="abs" style="left:80px;top:790px">{proof('rgba(249,247,245,.85)', 20)}</div>
  <div class="abs" style="left:80px;top:950px">{logo('web-light', 230)}</div>
  <div class="abs" style="left:640px;top:968px"><span class="cta linen" style="height:62px;font-size:17px;padding:0 32px">{CTA_FIRST}</span></div>"""))
    b.append(board("M5", f"Social proof | Static | Stock man 50s | 110 reviews | 1x1 | {D}", "s1", C['linen'], f"""
  {photo(0, 0, 1080, 520, 'mark-couch.jpg', fx=0.15, fy=0.4)}
  <div class="cover" style="top:300px;height:240px;background:linear-gradient(180deg,rgba(249,247,245,0) 0%,{C['linen']} 100%)"></div>
  <div class="abs" style="left:80px;top:470px;display:flex;align-items:center;gap:26px"><span class="price" style="font-size:150px">5.0</span>
    <div><div style="display:flex;gap:6px;color:{C['terra']}">{''.join(STAR.format(s=40) for _ in range(5))}</div><div class="hl" style="font-size:44px;margin-top:8px">from 110 Google reviews</div></div></div>
  <div class="abs label" style="left:80px;top:660px">What people mention most</div>
  <div class="abs" style="left:80px;top:705px;width:920px;display:flex;gap:0;border-top:1px solid {C['stone']};border-bottom:1px solid {C['stone']}">
    {''.join(f'<div style="flex:1;padding:22px 0;text-align:center;font-size:24px;color:{C["ink"]};{"border-left:1px solid " + C["stone"] + ";" if i else ""}">{t}</div>' for i, t in enumerate(["Comfortable atmosphere", "Clear explanations", "Welcoming staff"]))}</div>
  <div class="abs body" style="left:80px;top:830px;font-size:24px;color:{C['copper']};font-weight:500">New patient exam £90</div>
  <div class="abs" style="left:80px;top:950px">{logo('web', 230)}</div>
  <div class="abs" style="left:640px;top:968px"><span class="cta olive" style="height:62px;font-size:17px;padding:0 32px">{CTA_FIRST}</span></div>"""))
    return page("Signature Smiles | Mark | 1x1", b)


def mark_9x16():
    """9:16: key copy kept out of the top 250px and bottom 340px."""
    b = []
    b.append(board("M1s", f"No judgement | Static | Stock man 50s | Not been in years | 9x16 | {D}", "s9", C['linen'], f"""
  {warm_linen()}
  {arch(250, 260, 580, 760, 'mark-relief.jpg', fx=0.42, fy=0.25)}
  {badge(140, 880, 170)}
  <div class="abs hl" style="left:90px;top:1080px;width:900px;font-size:108px">Not been in years?</div>
  <div class="abs hl" style="left:90px;top:1210px;font-size:56px;color:{C['olive']}">Nobody here will ask why.</div>
  <div class="abs body" style="left:90px;top:1300px;width:880px;font-size:30px">It&rsquo;s one of the things we hear most often.</div>
  <div class="abs" style="left:90px;top:1360px">{proof(C['sand'], 22)}</div>
  <div class="abs body" style="left:90px;top:1400px;font-size:26px;color:{C['copper']};font-weight:500">New patient exam £90</div>
  <div class="abs" style="left:90px;top:1460px"><span class="cta olive">{CTA_FIRST}</span></div>
  <div class="abs" style="left:90px;top:1640px">{logo('web', 250)}</div>"""))
    b.append(board("M2s", f"The twinge | Static | Stock man 40s | Comes and goes | 9x16 | {D}", "s9", C['linen'], f"""
  {photo(0, 0, 1080, 1000, 'mark-kitchen-thoughtful.jpg', fx=0.6, fy=0.45)}
  <div class="cover" style="background:linear-gradient(180deg,rgba(249,247,245,0) 0%,rgba(249,247,245,0) 30%,rgba(249,247,245,.92) 46%,{C['linen']} 52%)"></div>
  <div class="abs hl" style="left:90px;top:860px;font-size:124px">It comes<br>and goes.</div>
  <div class="abs hl" style="left:90px;top:1140px;font-size:68px;color:{C['olive']}">But it hasn&rsquo;t gone.</div>
  <div class="abs body" style="left:90px;top:1250px;width:880px;font-size:32px">Get it looked at properly, without the lecture.</div>
  <div class="abs body" style="left:90px;top:1360px;font-size:28px;color:{C['copper']};font-weight:500">New patient exam £90, x-rays included</div>
  <div class="abs" style="left:90px;top:1450px"><span class="cta olive">{CTA_FIRST}</span></div>
  <div class="abs" style="left:90px;top:1640px">{logo('web', 250)}</div>"""))
    b.append(board("M3s", f"What happens | Static | Stock man 40s | Step by step | 9x16 | {D}", "s9", C['sage'], f"""
  {warm_sage()}
  {arch(560, 250, 420, 600, 'mark-chair.jpg', fx=0.66, fy=0.35)}
  <div class="abs label" style="left:90px;top:300px">If it&rsquo;s been a while</div>
  <div class="abs hl" style="left:90px;top:350px;font-size:84px">Your first<br>visit, step<br>by step</div>
  <div class="abs" style="left:90px;top:920px">{numbered(["Full check of teeth and gums", "Two x-rays", "Oral cancer screening", "Your plan and the costs, explained"], C['copper'], C['ink'], size=34, gap=26, circle=62)}</div>
  <div class="abs" style="left:90px;top:1300px;display:flex;align-items:baseline;gap:24px"><span class="price" style="font-size:130px">£90</span><span class="label">New patient exam</span></div>
  <div class="abs" style="left:90px;top:1460px"><span class="cta olive">{CTA_FIRST}</span></div>
  <div class="abs" style="left:90px;top:1640px">{logo('web', 250)}</div>"""))
    b.append(board("M4s", f"Cost fear | Static | Product | One number | 9x16 | {D}", "s9", C['olive'], f"""
  {warm_olive()}
  <div class="abs hl" style="left:90px;top:290px;font-size:80px;color:{C['linen']}">Worried what it&rsquo;ll cost<br>after all this time?</div>
  <div class="abs label" style="left:90px;top:520px;color:{C['stone']}">Start with one number</div>
  <div class="abs price" style="left:80px;top:560px;font-size:280px;color:{C['linen']}">£90</div>
  {receipt(300, 790, 640, "Your new patient exam", EXAM_ITEMS, scale=1.2, rot=2.0)}
  <div class="abs body" style="left:90px;top:1360px;width:880px;font-size:30px;color:rgba(249,247,245,.88)">Every cost explained before anything starts.</div>
  <div class="abs" style="left:90px;top:1460px"><span class="cta linen">{CTA_FIRST}</span></div>
  <div class="abs" style="left:90px;top:1640px">{logo('web-light', 250)}</div>"""))
    b.append(board("M5s", f"Social proof | Static | Stock man 50s | 110 reviews | 9x16 | {D}", "s9", C['linen'], f"""
  {photo(0, 0, 1080, 900, 'mark-couch.jpg', fx=0.12, fy=0.4)}
  <div class="cover" style="top:600px;height:320px;background:linear-gradient(180deg,rgba(249,247,245,0) 0%,{C['linen']} 100%)"></div>
  <div class="abs price" style="left:80px;top:860px;font-size:190px">5.0</div>
  <div class="abs" style="left:90px;top:1050px;display:flex;gap:8px;color:{C['terra']}">{''.join(STAR.format(s=46) for _ in range(5))}</div>
  <div class="abs hl" style="left:90px;top:1110px;font-size:58px">from 110 Google reviews</div>
  <div class="abs label" style="left:90px;top:1210px">What people mention most</div>
  <div class="abs body" style="left:90px;top:1250px;font-size:32px;line-height:1.5">Comfortable atmosphere<br>Clear explanations<br>Welcoming staff</div>
  <div class="abs" style="left:90px;top:1460px"><span class="cta olive">{CTA_FIRST}</span></div>
  <div class="abs body" style="left:560px;top:1478px;font-size:28px;color:{C['copper']};font-weight:500">New patient exam £90</div>
  <div class="abs" style="left:90px;top:1640px">{logo('web', 250)}</div>"""))
    return page("Signature Smiles | Mark | 9x16", b)


BUILDERS = {"mark": (mark_1x1, mark_9x16)}

if __name__ == "__main__":
    for p in sys.argv[1:] or BUILDERS:
        one, nine = BUILDERS[p]
        (ROOT / f"{p}-1x1.html").write_text(one())
        (ROOT / f"{p}-9x16.html").write_text(nine())
        print("built", p)
