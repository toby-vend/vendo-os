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


def ribbon(y, size=30, n=5, color=C['terra'], line=C['stone']):
    """The site's "Your Smile, Your Story" ribbon: monogram + line, ruled top and bottom."""
    item = (f'<span style="display:inline-flex;align-items:center;gap:18px;margin-right:56px">{logo("icon", int(size * 1.1))}'
            f'<span class="hl" style="font-size:{size}px;color:{color};white-space:nowrap">Your Smile, Your Story</span></span>')
    return (f'<div class="abs" style="left:0;right:0;top:{y}px;height:{int(size * 2.6)}px;border-top:1px solid {line};border-bottom:1px solid {line};'
            f'display:flex;align-items:center;white-space:nowrap;overflow:hidden;padding-left:40px">{item * n}</div>')


def dots(items, color, size=20):
    """Inclusions as one quiet line, separated by small terracotta dots (no boxes)."""
    sep = f'<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:{C["terra"]};margin:0 16px;vertical-align:middle"></span>'
    return f'<div class="small" style="font-size:{size}px;color:{color};line-height:1.7">{sep.join(items)}</div>'


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
EXAM_INC = ["Two x-rays", "Oral cancer screening", "Every cost explained"]


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
  {warm_linen()}
  <div class="abs" style="left:600px;top:0;width:480px;height:1080px;background:{C['sage']}"></div>
  {arch(640, 150, 380, 640, 'mark-kitchen-thoughtful.jpg', fx=0.6, fy=0.4)}
  {badge(540, 680, 140)}
  <div class="abs hl" style="left:80px;top:150px;font-size:92px">It comes<br>and goes.</div>
  <div class="abs hl" style="left:80px;top:380px;font-size:54px;color:{C['olive']}">But it<br>hasn&rsquo;t gone.</div>
  <div class="abs body" style="left:80px;top:560px;width:430px;font-size:25px">Get it looked at properly, without the lecture.</div>
  <div class="abs body" style="left:80px;top:690px;width:430px;font-size:24px;color:{C['copper']};font-weight:500">New patient exam £90,<br>x-rays included</div>
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
    b.append(board("M4", f"Cost fear | Static | Stock man 50s | One number | 1x1 | {D}", "s1", C['olive'], f"""
  {warm_olive()}
  {arch(640, 130, 360, 720, 'mark-kitchen-smile.jpg', fx=0.5, fy=0.3)}
  <div class="abs hl" style="left:80px;top:130px;font-size:60px;color:{C['linen']}">Worried what<br>it&rsquo;ll cost after<br>all this time?</div>
  <div class="abs label" style="left:80px;top:390px;color:{C['stone']}">Start with one number</div>
  <div class="abs price" style="left:70px;top:440px;font-size:200px;color:{C['linen']}">£90</div>
  <div class="abs" style="left:80px;top:650px;width:470px">{dots(["Two x-rays", "Oral cancer screening"], 'rgba(249,247,245,.88)', 21)}{dots(["Every cost explained first"], 'rgba(249,247,245,.88)', 21)}</div>
  <div class="abs" style="left:80px;top:790px">{proof('rgba(249,247,245,.85)', 20)}</div>
  <div class="abs" style="left:80px;top:950px">{logo('web-light', 230)}</div>
  <div class="abs" style="left:640px;top:968px"><span class="cta linen" style="height:62px;font-size:17px;padding:0 32px">{CTA_FIRST}</span></div>"""))
    b.append(board("M5", f"Social proof | Static | Stock man 50s | 110 reviews | 1x1 | {D}", "s1", C['sage'], f"""
  {warm_sage()}
  {arch(80, 150, 400, 700, 'mark-couch.jpg', fx=0.26, fy=0.4)}
  <div class="abs" style="left:540px;top:110px;width:460px;height:780px;border-radius:230px 230px 0 0;background:{C['linen']};box-shadow:0 30px 60px rgba(30,30,28,.10)"></div>
  <div class="abs" style="left:540px;top:250px;width:460px;text-align:center">
    <div class="price" style="font-size:150px">5.0</div>
    <div style="display:flex;gap:6px;justify-content:center;color:{C['terra']};margin-top:14px">{''.join(STAR.format(s=34) for _ in range(5))}</div>
    <div class="hl" style="font-size:40px;margin-top:18px">from 110<br>Google reviews</div>
    <div class="label" style="font-size:15px;margin-top:44px">What people mention most</div>
    <div class="body" style="font-size:23px;line-height:1.75;margin-top:12px">Comfortable atmosphere<br>Clear explanations<br>Welcoming staff</div></div>
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
  {warm_linen()}
  <div class="abs" style="left:0;top:0;width:1080px;height:960px;background:{C['sage']}"></div>
  {arch(250, 250, 580, 820, 'mark-kitchen-thoughtful.jpg', fx=0.6, fy=0.4)}
  {badge(130, 920, 170)}
  <div class="abs hl" style="left:90px;top:1120px;font-size:104px">It comes and goes.</div>
  <div class="abs hl" style="left:90px;top:1245px;font-size:60px;color:{C['olive']}">But it hasn&rsquo;t gone.</div>
  <div class="abs body" style="left:90px;top:1335px;width:880px;font-size:30px">Get it looked at properly, without the lecture.</div>
  <div class="abs body" style="left:90px;top:1395px;font-size:26px;color:{C['copper']};font-weight:500">New patient exam £90, x-rays included</div>
  <div class="abs" style="left:90px;top:1460px"><span class="cta olive">{CTA_FIRST}</span></div>
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
    b.append(board("M4s", f"Cost fear | Static | Stock man 50s | One number | 9x16 | {D}", "s9", C['olive'], f"""
  {warm_olive()}
  <div class="abs hl" style="left:90px;top:280px;font-size:78px;color:{C['linen']}">Worried what it&rsquo;ll cost<br>after all this time?</div>
  {arch(560, 500, 430, 760, 'mark-kitchen-smile.jpg', fx=0.5, fy=0.3)}
  <div class="abs label" style="left:90px;top:560px;color:{C['stone']}">Start with<br>one number</div>
  <div class="abs price" style="left:80px;top:660px;font-size:205px;color:{C['linen']}">£90</div>
  <div class="abs label" style="left:90px;top:880px;color:{C['stone']}">New patient exam</div>
  <div class="abs" style="left:90px;top:1310px;width:900px">{dots(EXAM_INC, 'rgba(249,247,245,.9)', 26)}</div>
  <div class="abs" style="left:90px;top:1375px">{proof('rgba(249,247,245,.85)', 22)}</div>
  <div class="abs" style="left:90px;top:1460px"><span class="cta linen">{CTA_FIRST}</span></div>
  <div class="abs" style="left:90px;top:1640px">{logo('web-light', 250)}</div>"""))
    b.append(board("M5s", f"Social proof | Static | Stock man 50s | 110 reviews | 9x16 | {D}", "s9", C['sage'], f"""
  {warm_sage()}
  {arch(90, 260, 470, 620, 'mark-couch.jpg', fx=0.26, fy=0.4)}
  {ribbon(960, 30)}
  <div class="abs" style="left:600px;top:300px;width:400px;text-align:center">
    <div class="price" style="font-size:170px">5.0</div>
    <div style="display:flex;gap:6px;justify-content:center;color:{C['terra']};margin-top:16px">{''.join(STAR.format(s=38) for _ in range(5))}</div>
    <div class="hl" style="font-size:46px;margin-top:20px">from 110<br>Google reviews</div></div>
  <div class="abs label" style="left:90px;top:1100px">What people mention most</div>
  <div class="abs hl" style="left:90px;top:1150px;font-size:54px;line-height:1.25">Comfortable atmosphere.<br>Clear explanations.<br>Welcoming staff.</div>
  <div class="abs" style="left:90px;top:1460px"><span class="cta olive">{CTA_FIRST}</span></div>
  <div class="abs body" style="left:560px;top:1478px;font-size:28px;color:{C['copper']};font-weight:500">New patient exam £90</div>
  <div class="abs" style="left:90px;top:1640px">{logo('web', 250)}</div>"""))
    return page("Signature Smiles | Mark | 9x16", b)


# ---------------------------------------------------------------- SOPHIE (registering the family)
CTA_FAM = "Book your family in"


def price_rows(rows, color_l, color_v, color_n, line, size=26, vsize=54, gap=20, width=480):
    """Prices as ruled rows (label left, PARISIAN figure right). No boxes."""
    return "".join(
        f'<div style="width:{width}px;display:flex;justify-content:space-between;align-items:baseline;padding:{gap}px 0;border-top:1px solid {line}">'
        f'<div><div style="font-size:{size}px;font-weight:500;color:{color_l}">{l}</div><div class="small" style="font-size:{int(size * .72)}px;color:{color_n};margin-top:4px">{n}</div></div>'
        f'<div class="price" style="font-size:{vsize}px;color:{color_v}">{v}</div></div>' for l, v, n in rows)


FAM_ROWS = [("Under 4s", "Free", "With a full-paying adult"), ("Children", "£28", "New patient exam"), ("Adults", "£90", "New patient exam, x-rays included")]


def sophie_1x1():
    b = []
    b.append(board("S1", f"Under 4s free | Static | Stock family | Family prices | 1x1 | {D}", "s1", C['linen'], f"""
  {warm_linen()}
  {arch(640, 110, 380, 700, 'family-sofa.jpg', fx=0.3, fy=0.4)}
  {badge(545, 690, 140)}
  <div class="abs hl" style="left:80px;top:110px;font-size:78px">Registering<br>the family?</div>
  <div class="abs label" style="left:80px;top:325px">Here&rsquo;s what it costs</div>
  <div class="abs" style="left:80px;top:365px">{price_rows(FAM_ROWS, C['ink'], C['copper'], C['sand'], C['stone'], size=25, vsize=56, gap=18, width=470)}</div>
  <div class="abs" style="left:80px;top:760px">{proof(C['sand'], 20)}</div>
  <div class="abs" style="left:80px;top:950px">{logo('web', 230)}</div>
  <div class="abs" style="left:640px;top:968px"><span class="cta olive" style="height:62px;font-size:17px;padding:0 32px">{CTA_FAM}</span></div>"""))
    b.append(board("S2", f"New to Brackley | Static | Stock mum and daughter | Moving boxes | 1x1 | {D}", "s1", C['linen'], f"""
  {warm_linen()}
  <div class="abs" style="left:0;top:0;width:470px;height:1080px;background:{C['sage']}"></div>
  {arch(60, 150, 380, 640, 'sophie-moving.jpg', fx=0.62, fy=0.3)}
  {badge(380, 760, 130)}
  <div class="abs label" style="left:560px;top:150px">Welcoming new families</div>
  <div class="abs hl" style="left:560px;top:195px;font-size:84px">New to<br>Brackley?</div>
  <div class="abs hl" style="left:560px;top:400px;width:440px;font-size:44px;color:{C['olive']}">Still haven&rsquo;t found a dentist for the kids?</div>
  <div class="abs body" style="left:560px;top:590px;width:440px;font-size:25px">We&rsquo;re taking on new families now, adults and children.</div>
  <div class="abs" style="left:560px;top:710px">{dots(["Under 4s free", "Children £28"], C['copper'], 23)}</div>
  <div class="abs" style="left:80px;top:950px">{logo('web', 230)}</div>
  <div class="abs" style="left:640px;top:968px"><span class="cta olive" style="height:62px;font-size:17px;padding:0 32px">{CTA_FAM}</span></div>"""))
    b.append(board("S3", f"Their first visit | Static | Stock child in chair | First visit | 1x1 | {D}", "s1", C['olive'], f"""
  {warm_olive()}
  {arch(620, 120, 400, 720, 'girl-chair.jpg', fx=0.55, fy=0.3)}
  <div class="abs hl" style="left:80px;top:120px;width:500px;font-size:60px;color:{C['linen']}">Their first visit decides how they feel about the dentist.</div>
  <div class="abs" style="left:80px;top:470px;width:60px;height:1px;background:{C['terra']}"></div>
  <div class="abs body" style="left:80px;top:510px;width:470px;font-size:26px;color:rgba(249,247,245,.9)">Longer appointments, so nobody&rsquo;s rushed. Time to see the chair and ask questions first.</div>
  <div class="abs" style="left:80px;top:680px">{dots(["Under 4s free with a paying adult"], 'rgba(249,247,245,.9)', 22)}</div>
  <div class="abs" style="left:80px;top:740px">{proof('rgba(249,247,245,.85)', 20)}</div>
  <div class="abs" style="left:80px;top:950px">{logo('web-light', 230)}</div>
  <div class="abs" style="left:640px;top:968px"><span class="cta linen" style="height:62px;font-size:17px;padding:0 32px">{CTA_FAM}</span></div>"""))
    b.append(board("S4", f"Calling round | Static | Stock mum and toddler | Nobody taking on | 1x1 | {D}", "s1", C['sage'], f"""
  {warm_sage()}
  {arch(80, 150, 400, 700, 'sophie-phone.jpg', fx=0.32, fy=0.35)}
  <div class="abs hl" style="left:560px;top:150px;width:440px;font-size:62px">Called round and nobody&rsquo;s taking on?</div>
  <div class="abs price" style="left:556px;top:400px;font-size:150px">We are.</div>
  <div class="abs body" style="left:560px;top:600px;width:430px;font-size:25px">Adults, children and toddlers. Longer appointments, prices published online.</div>
  <div class="abs" style="left:560px;top:740px">{dots(["Under 4s free", "Children £28", "Adults £90"], C['copper'], 21)}</div>
  <div class="abs" style="left:80px;top:950px">{logo('web', 230)}</div>
  <div class="abs" style="left:640px;top:968px"><span class="cta olive" style="height:62px;font-size:17px;padding:0 32px">{CTA_FAM}</span></div>"""))
    b.append(board("S5", f"Logistics | Static | Stock mum and daughter | Late Weds and Saturdays | 1x1 | {D}", "s1", C['linen'], f"""
  {warm_linen()}
  {photo(0, 0, 1080, 470, 'sophie-school.jpg', fx=0.6, fy=0.25)}
  {ribbon(470, 26, line=C['stone'])}
  <div class="abs hl" style="left:80px;top:600px;width:470px;font-size:64px">Fits around school and work</div>
  <div class="abs" style="left:560px;top:595px">{price_rows([("Wednesdays", "8pm", "Open until 8pm"), ("Saturdays", "8:30", "Appointments from 8:30am"), ("Parking", "Free", "Juno Crescent, Brackley")], C['ink'], C['copper'], C['sand'], C['stone'], size=22, vsize=40, gap=12, width=440)}</div>
  <div class="abs" style="left:80px;top:950px">{logo('web', 230)}</div>
  <div class="abs" style="left:640px;top:968px"><span class="cta olive" style="height:62px;font-size:17px;padding:0 32px">{CTA_FAM}</span></div>"""))
    return page("Signature Smiles | Sophie | 1x1", b)


def sophie_9x16():
    b = []
    b.append(board("S1s", f"Under 4s free | Static | Stock family | Family prices | 9x16 | {D}", "s9", C['linen'], f"""
  {warm_linen()}
  {arch(250, 260, 580, 640, 'family-sofa.jpg', fx=0.3, fy=0.4)}
  {badge(140, 780, 170)}
  <div class="abs hl" style="left:90px;top:960px;font-size:96px">Registering the family?</div>
  <div class="abs" style="left:90px;top:1090px">{price_rows(FAM_ROWS, C['ink'], C['copper'], C['sand'], C['stone'], size=28, vsize=62, gap=16, width=900)}</div>
  <div class="abs" style="left:90px;top:1460px"><span class="cta olive">{CTA_FAM}</span></div>
  <div class="abs" style="left:540px;top:1484px">{proof(C['sand'], 21)}</div>
  <div class="abs" style="left:90px;top:1640px">{logo('web', 250)}</div>"""))
    b.append(board("S2s", f"New to Brackley | Static | Stock mum and daughter | Moving boxes | 9x16 | {D}", "s9", C['linen'], f"""
  {warm_linen()}
  <div class="abs" style="left:0;top:0;width:1080px;height:960px;background:{C['sage']}"></div>
  {arch(250, 250, 580, 820, 'sophie-moving.jpg', fx=0.62, fy=0.3)}
  {badge(130, 920, 170)}
  <div class="abs hl" style="left:90px;top:1120px;font-size:110px">New to Brackley?</div>
  <div class="abs hl" style="left:90px;top:1250px;font-size:52px;color:{C['olive']}">Still haven&rsquo;t found a dentist for the kids?</div>
  <div class="abs body" style="left:90px;top:1330px;width:900px;font-size:30px">We&rsquo;re taking on new families now.</div>
  <div class="abs" style="left:90px;top:1385px">{dots(["Under 4s free", "Children £28", "Adults £90"], C['copper'], 26)}</div>
  <div class="abs" style="left:90px;top:1460px"><span class="cta olive">{CTA_FAM}</span></div>
  <div class="abs" style="left:90px;top:1640px">{logo('web', 250)}</div>"""))
    b.append(board("S3s", f"Their first visit | Static | Stock child in chair | First visit | 9x16 | {D}", "s9", C['olive'], f"""
  {warm_olive()}
  <div class="abs hl" style="left:90px;top:280px;width:900px;font-size:76px;color:{C['linen']}">Their first visit decides how they feel about the dentist.</div>
  {arch(250, 560, 580, 680, 'girl-chair.jpg', fx=0.55, fy=0.3)}
  <div class="abs body" style="left:90px;top:1290px;width:900px;font-size:30px;color:rgba(249,247,245,.9)">Longer appointments, so nobody&rsquo;s rushed.</div>
  <div class="abs" style="left:90px;top:1345px">{dots(["Under 4s free with a paying adult"], 'rgba(249,247,245,.9)', 26)}</div>
  <div class="abs" style="left:90px;top:1400px">{proof('rgba(249,247,245,.85)', 22)}</div>
  <div class="abs" style="left:90px;top:1470px"><span class="cta linen">{CTA_FAM}</span></div>
  <div class="abs" style="left:90px;top:1640px">{logo('web-light', 250)}</div>"""))
    b.append(board("S4s", f"Calling round | Static | Stock mum and toddler | Nobody taking on | 9x16 | {D}", "s9", C['sage'], f"""
  {warm_sage()}
  <div class="abs hl" style="left:90px;top:280px;width:900px;font-size:80px">Called round and nobody&rsquo;s taking on?</div>
  {arch(90, 520, 520, 720, 'sophie-phone.jpg', fx=0.32, fy=0.35)}
  <div class="abs price" style="left:640px;top:880px;font-size:150px;line-height:1">We<br>are.</div>
  <div class="abs body" style="left:90px;top:1290px;width:900px;font-size:30px">Adults, children and toddlers.</div>
  <div class="abs" style="left:90px;top:1345px">{dots(["Under 4s free", "Children £28", "Adults £90"], C['copper'], 26)}</div>
  <div class="abs" style="left:90px;top:1460px"><span class="cta olive">{CTA_FAM}</span></div>
  <div class="abs" style="left:90px;top:1640px">{logo('web', 250)}</div>"""))
    b.append(board("S5s", f"Logistics | Static | Stock mum and daughter | Late Weds and Saturdays | 9x16 | {D}", "s9", C['linen'], f"""
  {warm_linen()}
  {photo(0, 0, 1080, 880, 'sophie-school.jpg', fx=0.78, fy=0.3)}
  {ribbon(880, 30)}
  <div class="abs hl" style="left:90px;top:985px;font-size:80px">Fits around<br>school and work</div>
  <div class="abs" style="left:90px;top:1170px">{price_rows([("Wednesdays", "8pm", "Open until 8pm"), ("Saturdays", "8:30", "Appointments from 8:30am"), ("Parking", "Free", "Juno Crescent, Brackley")], C['ink'], C['copper'], C['sand'], C['stone'], size=26, vsize=46, gap=10, width=900)}</div>
  <div class="abs" style="left:90px;top:1490px"><span class="cta olive">{CTA_FAM}</span></div>
  <div class="abs" style="left:90px;top:1640px">{logo('web', 250)}</div>"""))
    return page("Signature Smiles | Sophie | 9x16", b)


# ---------------------------------------------------------------- DENISE (no NHS place, wary of private)
PLAN_ROWS = [("Pay as you go", "£90", "New patient exam, x-rays included"), ("Or a plan", "£20/m", "2 check-ups, 2 hygiene visits, 1 emergency appointment a year")]


def denise_1x1():
    b = []
    b.append(board("D1", f"The price out loud | Static | Stock woman 50s | Exam price | 1x1 | {D}", "s1", C['linen'], f"""
  {warm_linen()}
  {arch(640, 110, 380, 720, 'denise-sofa.jpg', fx=0.72, fy=0.3)}
  {badge(545, 700, 140)}
  <div class="abs hl" style="left:80px;top:110px;width:520px;font-size:62px">What does a private dentist cost in Brackley?</div>
  <div class="abs label" style="left:80px;top:380px">New patient exam</div>
  <div class="abs price" style="left:72px;top:420px;font-size:230px">£90</div>
  <div class="abs" style="left:80px;top:650px;width:470px">{dots(EXAM_INC, C['ink'], 21)}</div>
  <div class="abs" style="left:80px;top:770px">{proof(C['sand'], 20)}</div>
  <div class="abs" style="left:80px;top:950px">{logo('web', 230)}</div>
  <div class="abs" style="left:640px;top:968px"><span class="cta olive" style="height:62px;font-size:17px;padding:0 32px">{CTA_FIRST}</span></div>"""))
    b.append(board("D2", f"Gone private | Static | Stock woman 60s | Kitchen table | 1x1 | {D}", "s1", C['linen'], f"""
  {warm_linen()}
  <div class="abs" style="left:610px;top:0;width:470px;height:1080px;background:{C['sage']}"></div>
  {arch(650, 150, 380, 660, 'denise-kitchen.jpg', fx=0.42, fy=0.25)}
  {badge(570, 720, 130)}
  <div class="abs hl" style="left:80px;top:150px;width:480px;font-size:80px">Your dentist gone private?</div>
  <div class="abs hl" style="left:80px;top:470px;width:470px;font-size:40px;color:{C['olive']}">If you&rsquo;re paying privately anyway, choose where.</div>
  <div class="abs" style="left:80px;top:660px;width:470px">{dots(["New patient exam £90", "Prices published online"], C['copper'], 22)}</div>
  <div class="abs" style="left:80px;top:770px">{proof(C['sand'], 20)}</div>
  <div class="abs" style="left:80px;top:950px">{logo('web', 230)}</div>
  <div class="abs" style="left:640px;top:968px"><span class="cta olive" style="height:62px;font-size:17px;padding:0 32px">{CTA_FIRST}</span></div>"""))
    b.append(board("D3", f"Private means upselling | Static | Team Lorraine | Every cost explained | 1x1 | {D}", "s1", C['olive'], f"""
  {warm_olive()}
  {arch(620, 120, 400, 720, 'team-lorraine.jpg', fx=0.5, fy=0.2)}
  <div class="abs hl" style="left:80px;top:120px;width:500px;font-size:66px;color:{C['linen']}">Worried private means being sold to?</div>
  <div class="abs" style="left:80px;top:400px;width:60px;height:1px;background:{C['terra']}"></div>
  <div class="abs body" style="left:80px;top:440px;width:480px;font-size:30px;color:rgba(249,247,245,.92)">Every cost explained before anything starts. You decide what happens next.</div>
  <div class="abs" style="left:80px;top:640px">{dots(["New patient exam £90"], 'rgba(249,247,245,.9)', 22)}</div>
  <div class="abs" style="left:80px;top:700px">{proof('rgba(249,247,245,.85)', 20)}</div>
  <div class="abs" style="left:80px;top:950px">{logo('web-light', 230)}</div>
  <div class="abs" style="left:640px;top:968px"><span class="cta linen" style="height:62px;font-size:17px;padding:0 32px">{CTA_FIRST}</span></div>"""))
    b.append(board("D4", f"Pay monthly forever | Static | Stock older couple | Plan optional | 1x1 | {D}", "s1", C['sage'], f"""
  {warm_sage()}
  {arch(80, 150, 400, 700, 'older-couple.jpg', fx=0.5, fy=0.3)}
  <div class="abs hl" style="left:560px;top:150px;width:440px;font-size:64px">Private doesn&rsquo;t have to mean a plan.</div>
  <div class="abs" style="left:560px;top:420px">{price_rows(PLAN_ROWS, C['ink'], C['copper'], C['olive'], C['stone'], size=27, vsize=54, gap=18, width=440)}</div>
  <div class="abs" style="left:560px;top:760px">{proof(C['sand'], 19)}</div>
  <div class="abs" style="left:80px;top:950px">{logo('web', 230)}</div>
  <div class="abs" style="left:640px;top:968px"><span class="cta olive" style="height:62px;font-size:17px;padding:0 32px">{CTA_FIRST}</span></div>"""))
    b.append(board("D5", f"Still on the waiting list | Static | Stock woman 60s | On the phone | 1x1 | {D}", "s1", C['linen'], f"""
  {warm_linen()}
  {photo(0, 0, 1080, 470, 'denise-phone.jpg', fx=0.4, fy=0.22)}
  {ribbon(470, 26, line=C['stone'])}
  <div class="abs hl" style="left:80px;top:600px;width:470px;font-size:66px">Still on a waiting list?</div>
  <div class="abs body" style="left:580px;top:605px;width:420px;font-size:28px">We&rsquo;re welcoming new patients in Brackley now.</div>
  <div class="abs" style="left:580px;top:730px">{dots(["New patient exam £90"], C['copper'], 21)}</div>
  <div class="abs" style="left:580px;top:790px">{proof(C['sand'], 18)}</div>
  <div class="abs" style="left:80px;top:950px">{logo('web', 230)}</div>
  <div class="abs" style="left:640px;top:968px"><span class="cta olive" style="height:62px;font-size:17px;padding:0 32px">{CTA_FIRST}</span></div>"""))
    return page("Signature Smiles | Denise | 1x1", b)


def denise_9x16():
    b = []
    b.append(board("D1s", f"The price out loud | Static | Stock woman 50s | Exam price | 9x16 | {D}", "s9", C['linen'], f"""
  {warm_linen()}
  <div class="abs hl" style="left:90px;top:270px;width:900px;font-size:78px">What does a private dentist cost in Brackley?</div>
  {arch(560, 520, 430, 700, 'denise-sofa.jpg', fx=0.72, fy=0.3)}
  <div class="abs label" style="left:90px;top:800px">New patient exam</div>
  <div class="abs price" style="left:80px;top:840px;font-size:210px">£90</div>
  <div class="abs" style="left:90px;top:1290px;width:900px">{dots(EXAM_INC, C['ink'], 26)}</div>
  <div class="abs" style="left:90px;top:1370px">{proof(C['sand'], 22)}</div>
  <div class="abs" style="left:90px;top:1460px"><span class="cta olive">{CTA_FIRST}</span></div>
  <div class="abs" style="left:90px;top:1640px">{logo('web', 250)}</div>"""))
    b.append(board("D2s", f"Gone private | Static | Stock woman 60s | Kitchen table | 9x16 | {D}", "s9", C['linen'], f"""
  {warm_linen()}
  <div class="abs" style="left:0;top:0;width:1080px;height:880px;background:{C['sage']}"></div>
  {arch(250, 250, 580, 740, 'denise-kitchen.jpg', fx=0.42, fy=0.25)}
  {badge(130, 840, 170)}
  <div class="abs hl" style="left:90px;top:1050px;font-size:92px">Your dentist<br>gone private?</div>
  <div class="abs hl" style="left:90px;top:1280px;width:900px;font-size:44px;color:{C['olive']}">If you&rsquo;re paying privately anyway, choose where.</div>
  <div class="abs" style="left:90px;top:1405px">{dots(["New patient exam £90", "5.0 from 110 Google reviews"], C['copper'], 26)}</div>
  <div class="abs" style="left:90px;top:1460px"><span class="cta olive">{CTA_FIRST}</span></div>
  <div class="abs" style="left:90px;top:1640px">{logo('web', 250)}</div>"""))
    b.append(board("D3s", f"Private means upselling | Static | Team Lorraine | Every cost explained | 9x16 | {D}", "s9", C['olive'], f"""
  {warm_olive()}
  <div class="abs hl" style="left:90px;top:280px;width:900px;font-size:84px;color:{C['linen']}">Worried private means being sold to?</div>
  {arch(250, 560, 580, 680, 'team-lorraine.jpg', fx=0.5, fy=0.2)}
  <div class="abs body" style="left:90px;top:1290px;width:900px;font-size:32px;color:rgba(249,247,245,.92)">Every cost explained before anything starts.</div>
  <div class="abs" style="left:90px;top:1350px">{dots(["New patient exam £90"], 'rgba(249,247,245,.9)', 26)}</div>
  <div class="abs" style="left:90px;top:1405px">{proof('rgba(249,247,245,.85)', 22)}</div>
  <div class="abs" style="left:90px;top:1475px"><span class="cta linen">{CTA_FIRST}</span></div>
  <div class="abs" style="left:90px;top:1640px">{logo('web-light', 250)}</div>"""))
    b.append(board("D4s", f"Pay monthly forever | Static | Stock older couple | Plan optional | 9x16 | {D}", "s9", C['sage'], f"""
  {warm_sage()}
  <div class="abs hl" style="left:90px;top:280px;width:900px;font-size:84px">Private doesn&rsquo;t have to mean a plan.</div>
  {arch(250, 540, 580, 560, 'older-couple.jpg', fx=0.5, fy=0.3)}
  <div class="abs" style="left:90px;top:1150px">{price_rows(PLAN_ROWS, C['ink'], C['copper'], C['olive'], C['stone'], size=32, vsize=62, gap=16, width=900)}</div>
  <div class="abs" style="left:90px;top:1480px"><span class="cta olive">{CTA_FIRST}</span></div>
  <div class="abs" style="left:90px;top:1640px">{logo('web', 250)}</div>"""))
    b.append(board("D5s", f"Still on the waiting list | Static | Stock woman 60s | On the phone | 9x16 | {D}", "s9", C['linen'], f"""
  {warm_linen()}
  {photo(0, 0, 1080, 880, 'denise-phone.jpg', fx=0.4, fy=0.25)}
  {ribbon(880, 30)}
  <div class="abs hl" style="left:90px;top:985px;font-size:92px">Still on a<br>waiting list?</div>
  <div class="abs body" style="left:90px;top:1200px;width:900px;font-size:34px">We&rsquo;re welcoming new patients in Brackley now.</div>
  <div class="abs" style="left:90px;top:1270px">{dots(["New patient exam £90"], C['copper'], 26)}</div>
  <div class="abs" style="left:90px;top:1330px">{proof(C['sand'], 22)}</div>
  <div class="abs" style="left:90px;top:1470px"><span class="cta olive">{CTA_FIRST}</span></div>
  <div class="abs" style="left:90px;top:1640px">{logo('web', 250)}</div>"""))
    return page("Signature Smiles | Denise | 9x16", b)


BUILDERS = {"mark": (mark_1x1, mark_9x16), "sophie": (sophie_1x1, sophie_9x16), "denise": (denise_1x1, denise_9x16)}

if __name__ == "__main__":
    for p in sys.argv[1:] or BUILDERS:
        one, nine = BUILDERS[p]
        (ROOT / f"{p}-1x1.html").write_text(one())
        (ROOT / f"{p}-9x16.html").write_text(nine())
        print("built", p)
