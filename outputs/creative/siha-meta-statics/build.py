"""Build Siha Dental Meta static harness pages (one HTML page per persona per size).

Usage: python3 build.py            -> writes <persona>-1x1.html and <persona>-9x16.html
Brand: Siha guideline (Figma AbtwUHTD50G38QuOaCG4Hh). Font: Metropolis (assets/fonts).
"""
import re
from pathlib import Path

ROOT = Path(__file__).parent
A = ROOT / "assets"

C = dict(od="#14211a", ol="#293425", gl="#4c5d46", be="#e1d5ca", nu="#eae3de", bo="#ab6f4b", br="#877663", wh="#ffffff")


def inline_svg(name, cls):
    s = (A / name).read_text()
    s = re.sub(r"<\?xml.*?\?>|<!DOCTYPE.*?>", "", s, flags=re.S)
    s = re.sub(r'fill:#[0-9a-fA-F]{6};?', "", s)
    s = s.replace('width="100%" height="100%"', f'class="{cls}" fill="currentColor"', 1)
    return s


LOGO = inline_svg("logo-dark.svg", "logo")
ICON = inline_svg("shape.svg", "icon")
# Outline S for the line-S motif (same geometry as the icon, stroked)
LINE_S = ICON.replace('class="icon" fill="currentColor"', 'class="line-s" fill="none" stroke="currentColor" stroke-width="1.6" vector-effect="non-scaling-stroke"')

GRAIN = ("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>"
         "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.9 0'/></filter>"
         "<rect width='100%' height='100%' filter='url(%23n)'/></svg>")

CSS = f"""
@font-face {{ font-family: Metropolis; src: url(assets/fonts/Metropolis-Light.otf); font-weight: 300; }}
@font-face {{ font-family: Metropolis; src: url(assets/fonts/Metropolis-Regular.otf); font-weight: 400; }}
@font-face {{ font-family: Metropolis; src: url(assets/fonts/Metropolis-Medium.otf); font-weight: 500; }}
@font-face {{ font-family: Metropolis; src: url(assets/fonts/Metropolis-SemiBold.otf); font-weight: 600; }}
@font-face {{ font-family: Metropolis; src: url(assets/fonts/Metropolis-Bold.otf); font-weight: 700; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ background: #2a2a2a; font-family: Metropolis, sans-serif; display: flex; gap: 80px; padding: 80px; align-items: flex-start; }}
.ab {{ position: relative; overflow: hidden; flex: none; color: {C['od']}; }}
.s1 {{ width: 1080px; height: 1080px; }}
.s9 {{ width: 1080px; height: 1920px; }}
.abs {{ position: absolute; }}
.cover {{ position: absolute; inset: 0; background-size: cover; background-position: center; }}
.grain {{ position: absolute; inset: 0; background-image: url("{GRAIN}"); opacity: .13; mix-blend-mode: overlay; pointer-events: none; }}
.eyebrow {{ font-size: 22px; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; }}
.hl {{ font-weight: 300; text-transform: uppercase; line-height: .98; letter-spacing: .005em; }}
.hl b {{ font-weight: 700; }}
.body {{ font-size: 30px; font-weight: 400; line-height: 1.45; }}
.cta {{ display: inline-flex; align-items: center; height: 76px; padding: 0 44px; border-radius: 999px; font-size: 22px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; }}
.cta.dark {{ background: {C['od']}; color: {C['nu']}; }}
.cta.light {{ background: {C['be']}; color: {C['od']}; }}
.cta.line {{ border: 2px solid currentColor; }}
.logo {{ display: block; height: auto; }}
.icon, .line-s {{ display: block; }}
.sframe {{ position: absolute; }}
.sframe .t, .sframe .b {{ position: absolute; left: 0; width: 100%; height: 50%; background-repeat: no-repeat; }}
.sframe .t {{ top: 0; border-radius: 9999px 0 0 9999px; }}
.sframe .b {{ bottom: 0; border-radius: 0 9999px 9999px 0; }}
.price {{ font-weight: 300; line-height: .85; letter-spacing: -.02em; }}
.small {{ font-size: 20px; font-weight: 500; letter-spacing: .04em; }}
"""


def photo_aspect(img):
    """Width / height of a photo in assets/photos, read from the JPEG header."""
    import struct
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


def sframe(x, y, w, h, img, fx=0.5, fy=0.35, zoom=1.0):
    """Photo cropped inside the S shape: two stacked blocks sharing one image.

    The photo is scaled to cover the whole S (never stretched); fx/fy set the
    focal point (0 to 1) used when cropping the overflow.
    """
    a = photo_aspect(img)
    if w / h > a:   # frame wider than photo: fit width, crop height
        bw, bh = w, w / a
    else:           # frame taller than photo: fit height, crop width
        bw, bh = h * a, h
    bw, bh = bw * zoom, bh * zoom
    ox = -(bw - w) * fx
    oy = -(bh - h) * fy
    bg = f"background-image:url(assets/photos/{img});background-size:{bw:.0f}px {bh:.0f}px;"
    return (f'<div class="sframe" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px">'
            f'<div class="t" style="{bg}background-position:{ox:.0f}px {oy:.0f}px"></div>'
            f'<div class="b" style="{bg}background-position:{ox:.0f}px {oy - h / 2:.0f}px"></div></div>')


def page(title, boards):
    return (f"<!doctype html><html lang='en-GB'><head><meta charset='utf-8'><title>{title}</title>"
            f"<style>{CSS}</style><script src='https://mcp.figma.com/mcp/html-to-design/capture.js' async></script></head><body>{''.join(boards)}</body></html>")


# ---------------------------------------------------------------- JOSH (bonding first timer)
CTA_FREE = "Book a free consultation"
STAR = '<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="currentColor"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>'


def proof(color, size=22):
    stars = "".join(STAR.format(s=size) for _ in range(5))
    return (f'<div style="display:flex;align-items:center;gap:14px;color:{color}">'
            f'<span style="display:flex;gap:3px">{stars}</span>'
            f'<span class="small" style="font-size:{size}px">5.0 from 156 Google reviews</span></div>')


def josh_1x1():
    b = []
    # J1 price per tooth
    b.append(f"""
<div class="ab s1" id="J1" data-name="Josh | Static | Price per tooth | 1x1" style="background:{C['od']}">
  <div class="cover" style="left:470px;background-image:url(assets/photos/suite-1.jpg);background-position:50% 60%"></div>
  <div class="cover" style="background:linear-gradient(90deg,{C['od']} 0%,{C['od']} 40%,rgba(20,33,26,.82) 58%,rgba(20,33,26,.25) 100%)"></div>
  <div class="cover" style="background:radial-gradient(circle at 18% 22%,rgba(171,111,75,.22),transparent 55%)"></div>
  <div class="abs" style="left:80px;top:96px;color:{C['be']}" ><div class="eyebrow">One appointment, from</div></div>
  <div class="abs price" style="left:70px;top:150px;font-size:330px;color:{C['nu']}">£250</div>
  <div class="abs hl" style="left:80px;top:445px;font-size:72px;color:{C['nu']}">a <b>tooth.</b></div>
  <div class="abs body" style="left:80px;top:565px;width:540px;font-size:28px;color:{C['be']}">Veneers here are £995 a tooth. Bonding adds to the tooth you have, so nothing healthy is filed down.</div>
  <div class="abs" style="left:80px;top:745px">{proof(C['be'])}</div>
  <div class="abs" style="left:80px;top:810px"><span class="cta light">{CTA_FREE}</span></div>
  <div class="abs" style="left:80px;top:950px;width:200px;color:{C['be']}">{LOGO}</div>
  <div class="grain"></div>
</div>""")
    # J2 one appointment, straight edges, done
    b.append(f"""
<div class="ab s1" id="J2" data-name="Josh | Static | Accommodation | 1x1" style="background:{C['be']}">
  <div class="cover" style="background:radial-gradient(circle at 75% 35%,#efe7df 0%,{C['be']} 45%,#d4c5b7 100%)"></div>
  {sframe(560, 110, 450, 812, 'hannan.jpg', fx=0.55, fy=0.2)}
  <div class="abs hl" style="left:80px;top:150px;font-size:66px;color:{C['bo']}">You rarely<br>show your<br>teeth when<br>you <b>smile.</b></div>
  <div class="abs body" style="left:80px;top:470px;width:440px;color:{C['od']}">One small fix. One appointment. Still your teeth.</div>
  <div class="abs body" style="left:80px;top:620px;width:440px;font-size:24px;color:{C['ol']}">Bonding from £250 a tooth, usually done in a single 1 to 2 hour visit.</div>
  <div class="abs" style="left:80px;top:950px;width:200px;color:{C['ol']}">{LOGO}</div>
  <div class="abs" style="left:620px;top:990px"><span class="cta dark" style="height:56px;font-size:17px;padding:0 30px">{CTA_FREE}</span></div>
  <div class="grain"></div>
</div>""")
    # J3 honest lifespan
    b.append(f"""
<div class="ab s1" id="J3" data-name="Josh | Static | Chips easily | 1x1" style="background:{C['od']}">
  <div class="cover" style="top:250px;height:480px;background-image:url(assets/photos/consultation-space-in-suite-1.jpg);background-position:50% 75%"></div>
  <div class="cover" style="top:250px;height:260px;background:linear-gradient(180deg,{C['od']} 0%,rgba(20,33,26,0) 100%)"></div>
  <div class="cover" style="background:linear-gradient(180deg,rgba(20,33,26,.97) 0%,rgba(20,33,26,.9) 30%,rgba(20,33,26,.85) 40%,{C['od']} 56%)"></div>
  <div class="abs hl" style="left:80px;top:100px;font-size:84px;color:{C['nu']}">&ldquo;It chips<br><b>easily.</b>&rdquo;</div>
  <div class="abs" style="left:80px;top:390px;width:760px;padding:52px 56px;background:#f3eee9;border-radius:6px;transform:rotate(-1.6deg);box-shadow:0 30px 60px rgba(0,0,0,.45),0 6px 14px rgba(0,0,0,.3)">
    <div class="eyebrow" style="color:{C['bo']};font-size:18px;margin-bottom:22px">The honest answer</div>
    <div class="body" style="font-size:30px;color:{C['od']}">5 to 7 years with normal care. Coffee and red wine can stain it over time. We check it at every visit and touch it up when it needs it.</div>
    <div class="body" style="font-size:24px;color:{C['br']};margin-top:22px">Every bonding treatment comes with a 12-month warranty.</div>
  </div>
  <div class="abs" style="left:80px;top:950px;width:200px;color:{C['be']}">{LOGO}</div>
  <div class="abs" style="left:620px;top:972px"><span class="cta light" style="height:60px;font-size:17px;padding:0 30px">{CTA_FREE}</span></div>
  <div class="grain"></div>
</div>""")
    # J4 we add, we don't drill
    b.append(f"""
<div class="ab s1" id="J4" data-name="Josh | Static | No filing down | 1x1" style="background:{C['od']}">
  <div class="cover" style="background-image:url(assets/photos/face-photo.jpg);background-position:62% 40%"></div>
  <div class="cover" style="background:linear-gradient(180deg,rgba(20,33,26,0) 30%,rgba(20,33,26,.78) 56%,{C['od']} 74%)"></div>
  <div class="abs hl" style="left:80px;top:560px;font-size:64px;color:{C['nu']}">Healthy teeth don't<br>need <b>filing down.</b></div>
  <div class="abs body" style="left:80px;top:720px;width:820px;color:{C['be']}">Bonding adds tooth-coloured resin to the teeth you already have. Nothing healthy is drilled away.</div>
  <div class="abs" style="left:80px;top:950px;width:200px;color:{C['be']}">{LOGO}</div>
  <div class="abs" style="left:620px;top:972px"><span class="cta light" style="height:60px;font-size:17px;padding:0 30px">{CTA_FREE}</span></div>
  <div class="grain"></div>
</div>""")
    # J5 you might only need two
    b.append(f"""
<div class="ab s1" id="J5" data-name="Josh | Static | Only need two | 1x1" style="background:{C['nu']}">
  <div class="cover" style="background:radial-gradient(circle at 30% 20%,#f4efea 0%,{C['nu']} 50%,#ddd2c8 100%)"></div>
  <div class="abs" style="left:80px;top:80px;width:920px;height:500px;border-radius:30px;overflow:hidden;box-shadow:0 24px 50px rgba(20,33,26,.18)">
    <div class="cover" style="background-image:url(assets/photos/lounge-action.jpg);background-position:50% 45%"></div>
  </div>
  <div class="abs" style="left:640px;top:40px;width:330px;color:{C['bo']}">{LINE_S}</div>
  <div class="abs hl" style="left:80px;top:630px;font-size:84px;color:{C['od']}">You might only<br>need <b>two.</b></div>
  <div class="abs body" style="left:80px;top:815px;width:620px;color:{C['ol']}">We usually bond two to four teeth, not ten. From £250 a tooth.</div>
  <div class="abs" style="left:80px;top:925px">{proof(C['br'],20)}</div>
  <div class="abs" style="left:800px;top:968px;width:200px;color:{C['ol']}">{LOGO}</div>
  <div class="abs" style="left:80px;top:978px"><span class="cta dark" style="height:56px;font-size:17px;padding:0 30px">{CTA_FREE}</span></div>
  <div class="grain"></div>
</div>""")
    return page("Siha | Josh | 1x1", b)


def josh_9x16():
    # Safe zones: keep text out of the top 270px and bottom 380px.
    b = []
    b.append(f"""
<div class="ab s9" id="J1s" data-name="Josh | Static | Price per tooth | 9x16" style="background:{C['od']}">
  <div class="cover" style="height:1000px;background-image:url(assets/photos/suite-1.jpg);background-position:50% 40%"></div>
  <div class="cover" style="background:linear-gradient(180deg,rgba(20,33,26,.2) 0%,rgba(20,33,26,.55) 32%,{C['od']} 52%)"></div>
  <div class="cover" style="background:radial-gradient(circle at 20% 55%,rgba(171,111,75,.2),transparent 50%)"></div>
  <div class="abs eyebrow" style="left:90px;top:640px;color:{C['be']}">One appointment, from</div>
  <div class="abs price" style="left:78px;top:700px;font-size:360px;color:{C['nu']}">£250</div>
  <div class="abs hl" style="left:90px;top:1020px;font-size:80px;color:{C['nu']}">a <b>tooth.</b></div>
  <div class="abs body" style="left:90px;top:1150px;width:860px;font-size:34px;color:{C['be']}">Veneers here are £995 a tooth. Bonding adds to the tooth you have, so nothing healthy is filed down.</div>
  <div class="abs" style="left:90px;top:1300px">{proof(C['be'],24)}</div>
  <div class="abs" style="left:90px;top:1370px"><span class="cta light">{CTA_FREE}</span></div>
  <div class="abs" style="left:90px;top:1480px;width:200px;color:{C['be']}">{LOGO}</div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s9" id="J2s" data-name="Josh | Static | Accommodation | 9x16" style="background:{C['be']}">
  <div class="cover" style="background:radial-gradient(circle at 60% 30%,#efe7df 0%,{C['be']} 45%,#d4c5b7 100%)"></div>
  {sframe(310, 230, 460, 830, 'hannan.jpg', fx=0.55, fy=0.2)}
  <div class="abs hl" style="left:90px;top:1100px;font-size:84px;color:{C['bo']}">You rarely show<br>your teeth when<br>you <b>smile.</b></div>
  <div class="abs body" style="left:90px;top:1400px;width:880px;font-size:34px;color:{C['od']}">One small fix. One appointment. Still your teeth. Bonding from £250 a tooth.</div>
  <div class="abs" style="left:90px;top:1540px;width:190px;color:{C['ol']}">{LOGO}</div>
  <div class="abs" style="left:560px;top:1548px"><span class="cta dark" style="height:60px;font-size:17px;padding:0 30px">{CTA_FREE}</span></div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s9" id="J3s" data-name="Josh | Static | Chips easily | 9x16" style="background:{C['od']}">
  <div class="cover" style="top:560px;height:640px;background-image:url(assets/photos/consultation-space-in-suite-1.jpg);background-position:50% 75%"></div>
  <div class="cover" style="top:560px;height:320px;background:linear-gradient(180deg,{C['od']} 0%,rgba(20,33,26,0) 100%)"></div>
  <div class="cover" style="background:linear-gradient(180deg,rgba(20,33,26,.95) 0%,rgba(20,33,26,.88) 30%,{C['od']} 48%)"></div>
  <div class="abs hl" style="left:90px;top:330px;font-size:104px;color:{C['nu']}">&ldquo;It chips<br><b>easily.</b>&rdquo;</div>
  <div class="abs" style="left:90px;top:720px;width:900px;padding:64px 64px;background:#f3eee9;border-radius:6px;transform:rotate(-1.6deg);box-shadow:0 34px 70px rgba(0,0,0,.45),0 6px 14px rgba(0,0,0,.3)">
    <div class="eyebrow" style="color:{C['bo']};font-size:20px;margin-bottom:26px">The honest answer</div>
    <div class="body" style="font-size:36px;color:{C['od']}">5 to 7 years with normal care. Coffee and red wine can stain it over time. We check it at every visit and touch it up when it needs it.</div>
    <div class="body" style="font-size:28px;color:{C['br']};margin-top:26px">Every bonding treatment comes with a 12-month warranty.</div>
  </div>
  <div class="abs" style="left:90px;top:1400px"><span class="cta light">{CTA_FREE}</span></div>
  <div class="abs" style="left:90px;top:1520px;width:190px;color:{C['be']}">{LOGO}</div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s9" id="J4s" data-name="Josh | Static | No filing down | 9x16" style="background:{C['od']}">
  <div class="cover" style="height:1250px;background-image:url(assets/photos/face-photo.jpg);background-position:58% 40%"></div>
  <div class="cover" style="background:linear-gradient(180deg,rgba(20,33,26,0) 35%,rgba(20,33,26,.8) 56%,{C['od']} 66%)"></div>
  <div class="abs hl" style="left:90px;top:1000px;font-size:92px;color:{C['nu']}">Healthy teeth<br>don't need<br><b>filing down.</b></div>
  <div class="abs body" style="left:90px;top:1330px;width:880px;font-size:34px;color:{C['be']}">Bonding adds tooth-coloured resin to the teeth you already have. Nothing healthy is drilled away.</div>
  <div class="abs" style="left:90px;top:1540px;width:190px;color:{C['be']}">{LOGO}</div>
  <div class="abs" style="left:560px;top:1548px"><span class="cta light" style="height:60px;font-size:17px;padding:0 30px">{CTA_FREE}</span></div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s9" id="J5s" data-name="Josh | Static | Only need two | 9x16" style="background:{C['nu']}">
  <div class="cover" style="background:radial-gradient(circle at 30% 25%,#f4efea 0%,{C['nu']} 50%,#ddd2c8 100%)"></div>
  <div class="abs" style="left:90px;top:270px;width:900px;height:760px;border-radius:30px;overflow:hidden;box-shadow:0 24px 50px rgba(20,33,26,.18)">
    <div class="cover" style="background-image:url(assets/photos/lounge-action.jpg);background-position:50% 45%"></div>
  </div>
  <div class="abs" style="left:600px;top:200px;width:420px;color:{C['bo']}">{LINE_S}</div>
  <div class="abs hl" style="left:90px;top:1100px;font-size:100px;color:{C['od']}">You might<br>only need <b>two.</b></div>
  <div class="abs body" style="left:90px;top:1320px;width:880px;font-size:34px;color:{C['ol']}">We usually bond two to four teeth, not ten. From £250 a tooth.</div>
  <div class="abs" style="left:90px;top:1510px"><span class="cta dark">{CTA_FREE}</span></div>
  <div class="abs" style="left:90px;top:1445px">{proof(C['br'],22)}</div>
  <div class="abs" style="left:780px;top:1524px;width:200px;color:{C['ol']}">{LOGO}</div>
  <div class="grain"></div>
</div>""")
    return page("Siha | Josh | 9x16", b)



# ---------------------------------------------------------------- HANNAH (trend follower)
def shade_tabs(x, y, scale=1.0):
    """A row of shade-guide tabs (tooth shades, tints of the brand neutrals) with real shadows."""
    shades = ["#f6f2ea", "#f1eadf", "#ebe1d2", "#e4d7c4", "#dccbb3", "#d2bf a4".replace(" ", "")]
    tabs = []
    w, h, gap = int(92 * scale), int(190 * scale), int(26 * scale)
    for i, c in enumerate(shades):
        sel = i == 2
        ring = ""
        if sel:  # drawn as a bordered element (Figma capture drops CSS outlines)
            o = int(10 * scale)
            tabs.append(f'<div style="position:absolute;left:{i*(w+gap)-o}px;top:{-int(18*scale)-o}px;width:{w+2*o}px;height:{h+2*o}px;'
                        f'border:{max(2,int(3*scale))}px solid {C["bo"]};border-radius:{(w+2*o)//2}px {(w+2*o)//2}px {int(20*scale)}px {int(20*scale)}px;box-sizing:border-box"></div>')
        tabs.append(f'<div style="position:absolute;left:{i*(w+gap)}px;top:{-int(18*scale) if sel else 0}px;width:{w}px;height:{h}px;'
                    f'border-radius:{w//2}px {w//2}px {int(14*scale)}px {int(14*scale)}px;'
                    f'background:linear-gradient(180deg,#fffdf9 0%,{c} 38%,{c} 100%);'
                    f'box-shadow:0 {int(18*scale)}px {int(30*scale)}px rgba(20,33,26,.22),0 {int(3*scale)}px {int(6*scale)}px rgba(20,33,26,.18),inset 0 -{int(10*scale)}px {int(18*scale)}px rgba(135,118,99,.18);{ring}"></div>')
    label = (f'<div class="small" style="position:absolute;left:{2*(w+gap)}px;top:{h+int(28*scale)}px;width:{w}px;text-align:center;'
             f'font-size:{int(20*scale)}px;color:{C["bo"]};font-weight:600;letter-spacing:.12em">YOURS</div>')
    return f'<div style="position:absolute;left:{x}px;top:{y}px;width:{6*(w+gap)}px;height:{h+60}px">{"".join(tabs)}{label}</div>'


def vocab(rows, color_k, color_v, size=26, gap=22):
    out = []
    for k, v in rows:
        out.append(f'<div style="display:flex;gap:22px;align-items:baseline;margin-bottom:{gap}px">'
                   f'<div style="width:190px;flex:none;font-weight:600;font-size:{size}px;color:{color_k}">{k}</div>'
                   f'<div style="font-size:{size}px;line-height:1.35;color:{color_v}">{v}</div></div>')
    return "".join(out)


VOCAB = [("Aligners", "Move your teeth. Nothing removed."),
         ("Whitening", "Lifts the shade. Nothing removed."),
         ("Bonding", "Adds to the tooth. Nothing removed."),
         ("Veneers", "Cover the tooth. Some enamel removed, for good.")]


def steps(color_n, color_t, size=40, gap=34, circle=64):
    items = [("1", "Straighten"), ("2", "Whiten"), ("3", "Bond, only where it&rsquo;s needed")]
    out = []
    for n, t in items:
        out.append(f'<div style="display:flex;align-items:center;gap:26px;margin-bottom:{gap}px">'
                   f'<div style="width:{circle}px;height:{circle}px;flex:none;border:2px solid {color_n};border-radius:50%;display:flex;align-items:center;justify-content:center;'
                   f'font-size:{int(circle*0.42)}px;font-weight:500;color:{color_n}">{n}</div>'
                   f'<div style="font-size:{size}px;font-weight:300;color:{color_t}">{t}</div></div>')
    return "".join(out)


def hannah_1x1():
    b = []
    b.append(f"""
<div class="ab s1" id="H1" data-name="Hannah | Static | Same teeth | 1x1" style="background:{C['be']}">
  <div class="cover" style="background:radial-gradient(circle at 72% 32%,#f1e9e1 0%,{C['be']} 48%,#d4c5b7 100%)"></div>
  <div class="abs" style="left:575px;top:150px;width:430px;height:750px;border-radius:30px;background:#fff;overflow:hidden;box-shadow:0 26px 54px rgba(20,33,26,.16)">
    <div class="cover" style="background-image:url(assets/photos/patient-smile.jpg);background-size:contain;background-repeat:no-repeat;background-position:50% 100%"></div></div>
  <div class="abs hl" style="left:80px;top:140px;font-size:58px;color:{C['bo']}">The same<br>teeth.<br>Just <b>whiter</b><br><b>and repaired.</b></div>
  <div class="abs body" style="left:80px;top:500px;width:450px;font-size:27px;color:{C['od']}">Not a set of veneers. Not one big white strip. Yours, done carefully.</div>
  <div class="abs" style="left:80px;top:700px">{proof(C['br'],20)}</div>
  <div class="abs" style="left:80px;top:950px;width:200px;color:{C['ol']}">{LOGO}</div>
  <div class="abs" style="left:620px;top:965px"><span class="cta dark" style="height:60px;font-size:17px;padding:0 30px">{CTA_FREE}</span></div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s1" id="H2" data-name="Hannah | Static | Photo you dont want | 1x1" style="background:{C['nu']}">
  <div class="cover" style="background:radial-gradient(circle at 25% 15%,#f4efea 0%,{C['nu']} 50%,#ddd2c8 100%)"></div>
  <div class="abs" style="left:80px;top:80px;width:920px;height:440px;border-radius:30px;overflow:hidden;box-shadow:0 24px 50px rgba(20,33,26,.18)">
    <div class="cover" style="background-image:url(assets/photos/concierge-patient.jpg);background-position:50% 30%"></div>
  </div>
  <div class="abs hl" style="left:80px;top:575px;font-size:70px;color:{C['od']}">Bring a photo of<br>what you <b>don&rsquo;t</b> want.</div>
  <div class="abs body" style="left:80px;top:745px;width:860px;font-size:27px;color:{C['ol']}">Most people bring the smile they want. Show us the one you&rsquo;re scared of, and we&rsquo;ll show you how we avoid it.</div>
  <div class="abs" style="left:80px;top:978px"><span class="cta dark" style="height:56px;font-size:17px;padding:0 30px">{CTA_FREE}</span></div>
  <div class="abs" style="left:800px;top:968px;width:200px;color:{C['ol']}">{LOGO}</div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s1" id="H3" data-name="Hannah | Static | Move dont file | 1x1" style="background:{C['od']}">
  <div class="cover" style="left:430px;background-image:url(assets/photos/lounge-plants.jpg);background-position:40% 50%"></div>
  <div class="cover" style="background:linear-gradient(90deg,{C['od']} 0%,{C['od']} 42%,rgba(20,33,26,.7) 60%,rgba(20,33,26,.15) 100%)"></div>
  <div class="abs hl" style="left:80px;top:110px;font-size:66px;color:{C['nu']}">We&rsquo;d rather<br><b>move</b> your<br>teeth than<br>file them.</div>
  <div class="abs" style="left:80px;top:480px">{steps(C['be'], C['nu'], size=36, gap=30, circle=60)}</div>
  <div class="abs" style="left:80px;top:950px;width:200px;color:{C['be']}">{LOGO}</div>
  <div class="abs" style="left:620px;top:972px"><span class="cta light" style="height:60px;font-size:17px;padding:0 30px">{CTA_FREE}</span></div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s1" id="H4" data-name="Hannah | Static | Natural is a shade | 1x1" style="background:{C['nu']}">
  <div class="cover" style="background:radial-gradient(ellipse at 50% 40%,#f7f3ee 0%,{C['nu']} 45%,#d8cbbf 100%)"></div>
  <div class="cover" style="top:520px;height:240px;background:radial-gradient(ellipse at 50% 30%,rgba(255,255,255,.55),transparent 70%)"></div>
  {shade_tabs(118, 380)}
  <div class="abs hl" style="left:80px;top:110px;font-size:82px;color:{C['od']}">Not one big<br><b>white strip.</b></div>
  <div class="abs body" style="left:80px;top:745px;width:860px;font-size:32px;color:{C['bo']};font-weight:500">Natural is a shade. You choose it.</div>
  <div class="abs body" style="left:80px;top:800px;width:860px;font-size:24px;color:{C['ol']}">Shade, shape and length matched to your face, so it still looks like you.</div>
  <div class="abs" style="left:80px;top:950px;width:200px;color:{C['ol']}">{LOGO}</div>
  <div class="abs" style="left:620px;top:965px"><span class="cta dark" style="height:60px;font-size:17px;padding:0 30px">{CTA_FREE}</span></div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s1" id="H5" data-name="Hannah | Static | Dont need the names | 1x1" style="background:{C['od']}">
  <div class="cover" style="height:330px;background-image:url(assets/photos/concierge-2.jpg);background-position:50% 30%"></div>
  <div class="cover" style="top:120px;height:230px;background:linear-gradient(180deg,rgba(20,33,26,0) 0%,{C['od']} 100%)"></div>
  <div class="abs hl" style="left:80px;top:340px;font-size:52px;color:{C['nu']}">Don&rsquo;t know what to ask for?<br><b>That&rsquo;s fine.</b></div>
  <div class="abs" style="left:80px;top:520px;width:920px">{vocab(VOCAB, C['be'], C['nu'], size=26, gap=20)}</div>
  <div class="abs" style="left:80px;top:950px;width:200px;color:{C['be']}">{LOGO}</div>
  <div class="abs" style="left:620px;top:972px"><span class="cta light" style="height:60px;font-size:17px;padding:0 30px">{CTA_FREE}</span></div>
  <div class="grain"></div>
</div>""")
    return page("Siha | Hannah | 1x1", b)


def hannah_9x16():
    b = []
    b.append(f"""
<div class="ab s9" id="H1s" data-name="Hannah | Static | Same teeth | 9x16" style="background:{C['be']}">
  <div class="cover" style="background:radial-gradient(circle at 55% 28%,#f1e9e1 0%,{C['be']} 45%,#d4c5b7 100%)"></div>
  <div class="abs" style="left:250px;top:250px;width:580px;height:760px;border-radius:30px;background:#fff;overflow:hidden;box-shadow:0 26px 54px rgba(20,33,26,.16)">
    <div class="cover" style="background-image:url(assets/photos/patient-smile.jpg);background-size:contain;background-repeat:no-repeat;background-position:50% 100%"></div></div>
  <div class="abs hl" style="left:90px;top:1050px;font-size:80px;color:{C['bo']}">The same teeth.<br>Just <b>whiter and<br>repaired.</b></div>
  <div class="abs body" style="left:90px;top:1310px;width:880px;font-size:32px;color:{C['od']}">Not a set of veneers. Not one big white strip. Yours, done carefully.</div>
  <div class="abs" style="left:90px;top:1415px">{proof(C['br'],22)}</div>
  <div class="abs" style="left:90px;top:1468px"><span class="cta dark" style="height:64px;font-size:18px;padding:0 34px">{CTA_FREE}</span></div>
  <div class="abs" style="left:780px;top:1474px;width:200px;color:{C['ol']}">{LOGO}</div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s9" id="H2s" data-name="Hannah | Static | Photo you dont want | 9x16" style="background:{C['nu']}">
  <div class="cover" style="background:radial-gradient(circle at 25% 20%,#f4efea 0%,{C['nu']} 50%,#ddd2c8 100%)"></div>
  <div class="abs" style="left:90px;top:270px;width:900px;height:720px;border-radius:30px;overflow:hidden;box-shadow:0 24px 50px rgba(20,33,26,.18)">
    <div class="cover" style="background-image:url(assets/photos/concierge-patient.jpg);background-position:40% 30%"></div>
  </div>
  <div class="abs hl" style="left:90px;top:1060px;font-size:90px;color:{C['od']}">Bring a photo<br>of what you<br><b>don&rsquo;t</b> want.</div>
  <div class="abs body" style="left:90px;top:1360px;width:880px;font-size:32px;color:{C['ol']}">Most people bring the smile they want. Show us the one you&rsquo;re scared of, and we&rsquo;ll show you how we avoid it.</div>
  <div class="abs" style="left:90px;top:1510px"><span class="cta dark" style="height:60px;font-size:17px;padding:0 30px">{CTA_FREE}</span></div>
  <div class="abs" style="left:780px;top:1515px;width:200px;color:{C['ol']}">{LOGO}</div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s9" id="H3s" data-name="Hannah | Static | Move dont file | 9x16" style="background:{C['od']}">
  <div class="cover" style="height:1000px;background-image:url(assets/photos/lounge-plants.jpg);background-position:42% 50%"></div>
  <div class="cover" style="background:linear-gradient(180deg,rgba(20,33,26,.25) 0%,rgba(20,33,26,.55) 30%,{C['od']} 50%)"></div>
  <div class="abs hl" style="left:90px;top:760px;font-size:84px;color:{C['nu']}">We&rsquo;d rather <b>move</b><br>your teeth than<br>file them.</div>
  <div class="abs" style="left:90px;top:1100px">{steps(C['be'], C['nu'], size=42, gap=34, circle=70)}</div>
  <div class="abs" style="left:90px;top:1460px"><span class="cta light">{CTA_FREE}</span></div>
  <div class="abs" style="left:780px;top:1474px;width:200px;color:{C['be']}">{LOGO}</div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s9" id="H4s" data-name="Hannah | Static | Natural is a shade | 9x16" style="background:{C['nu']}">
  <div class="cover" style="background:radial-gradient(ellipse at 50% 45%,#f7f3ee 0%,{C['nu']} 45%,#d8cbbf 100%)"></div>
  <div class="abs hl" style="left:90px;top:330px;font-size:100px;color:{C['od']}">Not one big<br><b>white strip.</b></div>
  {shade_tabs(130, 760, 1.05)}
  <div class="abs body" style="left:90px;top:1180px;width:880px;font-size:40px;color:{C['bo']};font-weight:500">Natural is a shade. You choose it.</div>
  <div class="abs body" style="left:90px;top:1250px;width:880px;font-size:30px;color:{C['ol']}">Shade, shape and length matched to your face, so it still looks like you.</div>
  <div class="abs" style="left:90px;top:1420px"><span class="cta dark">{CTA_FREE}</span></div>
  <div class="abs" style="left:780px;top:1434px;width:200px;color:{C['ol']}">{LOGO}</div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s9" id="H5s" data-name="Hannah | Static | Dont need the names | 9x16" style="background:{C['od']}">
  <div class="cover" style="height:720px;background-image:url(assets/photos/concierge-2.jpg);background-position:30% 30%"></div>
  <div class="cover" style="top:360px;height:380px;background:linear-gradient(180deg,rgba(20,33,26,0) 0%,{C['od']} 100%)"></div>
  <div class="abs hl" style="left:90px;top:720px;font-size:80px;color:{C['nu']}">Don&rsquo;t know<br>what to ask for?<br><b>That&rsquo;s fine.</b></div>
  <div class="abs" style="left:90px;top:1030px;width:900px">{vocab(VOCAB, C['be'], C['nu'], size=30, gap=26)}</div>
  <div class="abs" style="left:90px;top:1440px"><span class="cta light">{CTA_FREE}</span></div>
  <div class="abs" style="left:780px;top:1454px;width:200px;color:{C['be']}">{LOGO}</div>
  <div class="grain"></div>
</div>""")
    return page("Siha | Hannah | 9x16", b)


if __name__ == "__main__":
    (ROOT / "josh-1x1.html").write_text(josh_1x1())
    (ROOT / "josh-9x16.html").write_text(josh_9x16())
    (ROOT / "hannah-1x1.html").write_text(hannah_1x1())
    (ROOT / "hannah-9x16.html").write_text(hannah_9x16())
    print("built")
