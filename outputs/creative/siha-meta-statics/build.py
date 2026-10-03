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
def shade_tabs(x, y, scale=1.0, label="YOURS"):
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
             f'font-size:{int(20*scale)}px;color:{C["bo"]};font-weight:600;letter-spacing:.12em">{label}</div>')
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



# ---------------------------------------------------------------- MARK (lapsed patient)
CTA_CHECK = "Book your check-up"
TICK = '<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.2 4.2L19 7"/></svg>'


def numbered(items, color_n, color_t, size=30, gap=26, circle=52):
    out = []
    for i, t in enumerate(items, 1):
        out.append(f'<div style="display:flex;align-items:center;gap:22px;margin-bottom:{gap}px">'
                   f'<div style="width:{circle}px;height:{circle}px;flex:none;border:2px solid {color_n};border-radius:50%;display:flex;align-items:center;justify-content:center;'
                   f'font-size:{int(circle*0.42)}px;font-weight:500;color:{color_n}">{i}</div>'
                   f'<div style="font-size:{size}px;font-weight:400;line-height:1.3;color:{color_t}">{t}</div></div>')
    return "".join(out)


def plan_card(x, y, w, scale=1.0, rot=-1.4):
    rows = [("Needs doing now", "Essential"), ("Can wait", "Recommended"), ("Your choice", "Optional")]
    r = []
    for i, (a, b_) in enumerate(rows):
        border = f"border-top:1px solid #ddd3c8;" if i else ""
        r.append(f'<div style="display:flex;justify-content:space-between;align-items:center;padding:{int(22*scale)}px 0;{border}">'
                 f'<span style="font-size:{int(28*scale)}px;font-weight:500;color:{C["od"]}">{a}</span>'
                 f'<span style="font-size:{int(20*scale)}px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:{C["bo"]}">{b_}</span></div>')
    return (f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px;padding:{int(40*scale)}px {int(48*scale)}px;background:#f3eee9;border-radius:6px;'
            f'transform:rotate({rot}deg);box-shadow:0 30px 60px rgba(0,0,0,.35),0 6px 14px rgba(0,0,0,.22)">'
            f'<div class="eyebrow" style="font-size:{int(18*scale)}px;color:{C["br"]};margin-bottom:{int(10*scale)}px">Your plan, in order</div>'
            f'{"".join(r)}'
            f'<div style="font-size:{int(20*scale)}px;color:{C["br"]};margin-top:{int(10*scale)}px">A price for each, before anything starts.</div></div>')


CHECK_ITEMS = ["Teeth and gums", "Jaw joints", "Oral cancer screening", "Small X-rays", "3D scan and photos", "A plan with prices"]


def receipt(x, y, w, scale=1.0, rot=1.2):
    items = "".join(
        f'<div style="display:flex;align-items:center;gap:{int(16*scale)}px;padding:{int(12*scale)}px 0;color:{C["od"]}">'
        f'<span style="color:{C["bo"]};display:flex">{TICK.format(s=int(26*scale))}</span>'
        f'<span style="font-size:{int(27*scale)}px">{t}</span></div>' for t in CHECK_ITEMS)
    return (f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px;padding:{int(38*scale)}px {int(44*scale)}px;background:#fbf9f6;border-radius:8px;'
            f'transform:rotate({rot}deg);box-shadow:0 34px 64px rgba(20,33,26,.22),0 6px 14px rgba(20,33,26,.14)">'
            f'<div class="eyebrow" style="font-size:{int(17*scale)}px;color:{C["br"]};margin-bottom:{int(12*scale)}px">Your new patient check-up</div>'
            f'{items}</div>')


def mark_1x1():
    b = []
    b.append(f"""
<div class="ab s1" id="M1" data-name="Mark | Static | No telling off | 1x1" style="background:{C['nu']}">
  <div class="cover" style="background:radial-gradient(circle at 75% 30%,#f4efea 0%,{C['nu']} 48%,#ddd2c8 100%)"></div>
  {sframe(620, 110, 390, 704, 'hannan-2.jpg', fx=0.5, fy=0.15)}
  <div class="abs hl" style="left:80px;top:120px;font-size:52px;color:{C['od']}">You think<br>we&rsquo;ll tell you<br>off for leaving<br>it so <b>long.</b></div>
  <div class="abs body" style="left:80px;top:440px;width:470px;font-size:38px;font-weight:600;color:{C['bo']}">We won&rsquo;t.</div>
  <div class="abs body" style="left:80px;top:510px;width:470px;font-size:25px;color:{C['ol']}">Plenty of our patients have stayed away for years. We&rsquo;ve never judged anyone for it.</div>
  <div class="abs" style="left:80px;top:690px">{proof(C['br'],20)}</div>
  <div class="abs" style="left:80px;top:950px;width:200px;color:{C['ol']}">{LOGO}</div>
  <div class="abs" style="left:700px;top:965px"><span class="cta dark" style="height:60px;font-size:17px;padding:0 30px">{CTA_CHECK}</span></div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s1" id="M2" data-name="Mark | Static | What happens | 1x1" style="background:{C['od']}">
  <div class="cover" style="height:400px;background-image:url(assets/photos/patient-concierge.jpg);background-position:50% 60%"></div>
  <div class="cover" style="top:160px;height:260px;background:linear-gradient(180deg,rgba(20,33,26,0) 0%,{C['od']} 100%)"></div>
  <div class="abs hl" style="left:80px;top:360px;font-size:52px;color:{C['nu']}">If it&rsquo;s been years, here&rsquo;s<br>exactly <b>what happens.</b></div>
  <div class="abs" style="left:80px;top:520px">{numbered(["A quick call with our patient concierge", "A full check-up, with X-rays and a 3D scan", "Your plan, in order, with prices", "You decide what happens next"], C['be'], C['nu'], size=26, gap=18, circle=46)}</div>
  <div class="abs" style="left:80px;top:950px;width:200px;color:{C['be']}">{LOGO}</div>
  <div class="abs" style="left:700px;top:972px"><span class="cta light" style="height:60px;font-size:17px;padding:0 30px">{CTA_CHECK}</span></div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s1" id="M3" data-name="Mark | Static | Not one big bill | 1x1" style="background:{C['od']}">
  <div class="cover" style="background-image:url(assets/photos/hygienist-action.jpg);background-position:30% 40%"></div>
  <div class="cover" style="background:linear-gradient(180deg,rgba(20,33,26,.9) 0%,rgba(20,33,26,.55) 30%,rgba(20,33,26,.35) 50%,rgba(20,33,26,.85) 100%)"></div>
  <div class="abs hl" style="left:80px;top:90px;font-size:68px;color:{C['nu']}">Worried it&rsquo;ll be<br>one <b>huge bill?</b></div>
  {plan_card(330, 420, 650)}
  <div class="abs" style="left:80px;top:950px;width:200px;color:{C['be']}">{LOGO}</div>
  <div class="abs" style="left:700px;top:972px"><span class="cta light" style="height:60px;font-size:17px;padding:0 30px">{CTA_CHECK}</span></div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s1" id="M4" data-name="Mark | Static | The twinge | 1x1" style="background:{C['od']}">
  <div class="cover" style="left:520px;background-image:url(assets/photos/lounge-seating-2.jpg);background-position:50% 55%"></div>
  <div class="cover" style="background:linear-gradient(90deg,{C['od']} 0%,{C['od']} 45%,rgba(20,33,26,.55) 65%,rgba(20,33,26,.1) 100%)"></div>
  <div class="abs hl" style="left:80px;top:130px;font-size:70px;color:{C['nu']}">That twinge<br>hasn&rsquo;t gone<br>away, has it?</div>
  <div class="abs body" style="left:80px;top:470px;width:480px;font-size:28px;color:{C['be']}">Small problems are quicker to sort early.</div>
  <div class="abs body" style="left:80px;top:580px;width:480px;font-size:24px;color:{C['be']}">Check-up <b style="color:{C['nu']}">£89</b>. Tuesday evenings and Saturdays available.</div>
  <div class="abs" style="left:80px;top:700px">{proof(C['be'],20)}</div>
  <div class="abs" style="left:80px;top:950px;width:200px;color:{C['be']}">{LOGO}</div>
  <div class="abs" style="left:700px;top:972px"><span class="cta light" style="height:60px;font-size:17px;padding:0 30px">{CTA_CHECK}</span></div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s1" id="M5" data-name="Mark | Static | 89 check-up | 1x1" style="background:{C['be']}">
  <div class="cover" style="background:radial-gradient(circle at 25% 25%,#f1e9e1 0%,{C['be']} 45%,#d2c2b2 100%)"></div>
  <div class="abs price" style="left:70px;top:120px;font-size:200px;color:{C['bo']}">£89</div>
  <div class="abs hl" style="left:80px;top:320px;font-size:44px;color:{C['od']}">Everything<br><b>checked.</b></div>
  <div class="abs body" style="left:80px;top:470px;width:380px;font-size:25px;color:{C['ol']}">Then a plan in order, with a price for each. Nothing happens unless you decide it should.</div>
  {receipt(530, 130, 450)}
  <div class="abs" style="left:80px;top:720px">{proof(C['br'],20)}</div>
  <div class="abs" style="left:80px;top:950px;width:200px;color:{C['ol']}">{LOGO}</div>
  <div class="abs" style="left:700px;top:965px"><span class="cta dark" style="height:60px;font-size:17px;padding:0 30px">{CTA_CHECK}</span></div>
  <div class="grain"></div>
</div>""")
    return page("Siha | Mark | 1x1", b)


def mark_9x16():
    b = []
    b.append(f"""
<div class="ab s9" id="M1s" data-name="Mark | Static | No telling off | 9x16" style="background:{C['nu']}">
  <div class="cover" style="background:radial-gradient(circle at 55% 28%,#f4efea 0%,{C['nu']} 45%,#ddd2c8 100%)"></div>
  {sframe(330, 240, 420, 758, 'hannan-2.jpg', fx=0.5, fy=0.15)}
  <div class="abs hl" style="left:90px;top:1050px;font-size:72px;color:{C['od']}">You think we&rsquo;ll tell<br>you off for leaving<br>it so <b>long.</b></div>
  <div class="abs body" style="left:90px;top:1300px;width:880px;font-size:44px;font-weight:600;color:{C['bo']}">We won&rsquo;t.</div>
  <div class="abs body" style="left:90px;top:1370px;width:880px;font-size:30px;color:{C['ol']}">Plenty of our patients have stayed away for years. We&rsquo;ve never judged anyone for it.</div>
  <div class="abs" style="left:90px;top:1478px"><span class="cta dark" style="height:60px;font-size:17px;padding:0 30px">{CTA_CHECK}</span></div>
  <div class="abs" style="left:780px;top:1484px;width:200px;color:{C['ol']}">{LOGO}</div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s9" id="M2s" data-name="Mark | Static | What happens | 9x16" style="background:{C['od']}">
  <div class="cover" style="height:820px;background-image:url(assets/photos/patient-concierge.jpg);background-position:45% 60%"></div>
  <div class="cover" style="top:420px;height:420px;background:linear-gradient(180deg,rgba(20,33,26,0) 0%,{C['od']} 100%)"></div>
  <div class="abs hl" style="left:90px;top:770px;font-size:74px;color:{C['nu']}">If it&rsquo;s been years,<br>here&rsquo;s exactly<br><b>what happens.</b></div>
  <div class="abs" style="left:90px;top:1060px">{numbered(["A quick call with our patient concierge", "A full check-up, with X-rays and a 3D scan", "Your plan, in order, with prices", "You decide what happens next"], C['be'], C['nu'], size=31, gap=22, circle=54)}</div>
  <div class="abs" style="left:90px;top:1460px"><span class="cta light">{CTA_CHECK}</span></div>
  <div class="abs" style="left:780px;top:1474px;width:200px;color:{C['be']}">{LOGO}</div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s9" id="M3s" data-name="Mark | Static | Not one big bill | 9x16" style="background:{C['od']}">
  <div class="cover" style="background-image:url(assets/photos/hygienist-action.jpg);background-position:35% 40%"></div>
  <div class="cover" style="background:linear-gradient(180deg,rgba(20,33,26,.92) 0%,rgba(20,33,26,.5) 25%,rgba(20,33,26,.4) 45%,rgba(20,33,26,.9) 75%)"></div>
  <div class="abs hl" style="left:90px;top:300px;font-size:90px;color:{C['nu']}">Worried it&rsquo;ll<br>be one<br><b>huge bill?</b></div>
  {plan_card(110, 900, 860, scale=1.12)}
  <div class="abs" style="left:90px;top:1460px"><span class="cta light">{CTA_CHECK}</span></div>
  <div class="abs" style="left:780px;top:1474px;width:200px;color:{C['be']}">{LOGO}</div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s9" id="M4s" data-name="Mark | Static | The twinge | 9x16" style="background:{C['od']}">
  <div class="cover" style="height:1050px;background-image:url(assets/photos/lounge-seating-2.jpg);background-position:50% 50%"></div>
  <div class="cover" style="background:linear-gradient(180deg,rgba(20,33,26,.2) 0%,rgba(20,33,26,.55) 35%,{C['od']} 55%)"></div>
  <div class="abs hl" style="left:90px;top:820px;font-size:90px;color:{C['nu']}">That twinge<br>hasn&rsquo;t gone away,<br>has it?</div>
  <div class="abs body" style="left:90px;top:1150px;width:880px;font-size:34px;color:{C['be']}">Small problems are quicker to sort early. Check-up <b style="color:{C['nu']}">£89</b>. Tuesday evenings and Saturdays available.</div>
  <div class="abs" style="left:90px;top:1330px">{proof(C['be'],24)}</div>
  <div class="abs" style="left:90px;top:1420px"><span class="cta light">{CTA_CHECK}</span></div>
  <div class="abs" style="left:780px;top:1434px;width:200px;color:{C['be']}">{LOGO}</div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s9" id="M5s" data-name="Mark | Static | 89 check-up | 9x16" style="background:{C['be']}">
  <div class="cover" style="background:radial-gradient(circle at 30% 25%,#f1e9e1 0%,{C['be']} 45%,#d2c2b2 100%)"></div>
  <div class="abs price" style="left:80px;top:280px;font-size:300px;color:{C['bo']}">£89</div>
  <div class="abs hl" style="left:90px;top:570px;font-size:60px;color:{C['od']}">Everything <b>checked.</b></div>
  {receipt(140, 700, 800, scale=1.15)}
  <div class="abs body" style="left:90px;top:1330px;width:880px;font-size:30px;color:{C['ol']}">Then a plan in order, with a price for each.</div>
  <div class="abs" style="left:90px;top:1400px">{proof(C['br'],22)}</div>
  <div class="abs" style="left:90px;top:1470px"><span class="cta dark" style="height:64px;font-size:18px;padding:0 34px">{CTA_CHECK}</span></div>
  <div class="abs" style="left:780px;top:1476px;width:200px;color:{C['ol']}">{LOGO}</div>
  <div class="grain"></div>
</div>""")
    return page("Siha | Mark | 9x16", b)



# ---------------------------------------------------------------- NIAMH (anxious, needs control)
CTA_ONLINE = "Book online"


def bullets(items, color_dot, color_t, size=26, gap=14):
    return "".join(
        f'<div style="display:flex;align-items:center;gap:18px;margin-bottom:{gap}px">'
        f'<span style="width:9px;height:9px;flex:none;border-radius:50%;background:{color_dot}"></span>'
        f'<span style="font-size:{size}px;line-height:1.3;color:{color_t}">{t}</span></div>' for t in items)


def control_cards(x, y, w, scale=1.0):
    items = ["A pause signal, agreed before we start", "Every step explained first", "Book online, no phone call needed"]
    out = []
    for i, t in enumerate(items):
        out.append(f'<div style="position:absolute;left:{int(i*26*scale)}px;top:{int(i*150*scale)}px;width:{w}px;padding:{int(30*scale)}px {int(36*scale)}px;'
                   f'background:#fbf9f6;border-radius:{int(18*scale)}px;display:flex;align-items:center;gap:{int(24*scale)}px;'
                   f'box-shadow:0 {int(22*scale)}px {int(44*scale)}px rgba(20,33,26,.2),0 {int(4*scale)}px {int(10*scale)}px rgba(20,33,26,.12)">'
                   f'<div style="width:{int(56*scale)}px;height:{int(56*scale)}px;flex:none;border-radius:50%;background:{C["ol"]};color:{C["be"]};display:flex;align-items:center;justify-content:center;font-size:{int(24*scale)}px;font-weight:500">{i+1}</div>'
                   f'<div style="font-size:{int(28*scale)}px;font-weight:500;color:{C["od"]};line-height:1.25">{t}</div></div>')
    return f'<div class="abs" style="left:{x}px;top:{y}px;width:{w+60}px;height:{int(460*scale)}px">{"".join(out)}</div>'


def niamh_1x1():
    b = []
    b.append(f"""
<div class="ab s1" id="N1" data-name="Niamh | Static | Stop signal | 1x1" style="background:{C['od']}">
  <div class="cover" style="background-image:url(assets/photos/hygiene-suite.jpg);background-position:35% 50%"></div>
  <div class="cover" style="background:linear-gradient(180deg,rgba(20,33,26,.25) 0%,rgba(20,33,26,.45) 35%,rgba(20,33,26,.88) 58%,{C['od']} 75%)"></div>
  <div class="abs hl" style="left:80px;top:520px;font-size:74px;color:{C['nu']}">Raise your hand.<br><b>We stop.</b> Every time.</div>
  <div class="abs body" style="left:80px;top:720px;width:820px;font-size:28px;color:{C['be']}">We agree a pause signal before anything starts. No explanation needed.</div>
  <div class="abs" style="left:80px;top:950px;width:200px;color:{C['be']}">{LOGO}</div>
  <div class="abs" style="left:790px;top:972px"><span class="cta light" style="height:60px;font-size:17px;padding:0 30px">{CTA_ONLINE}</span></div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s1" id="N2" data-name="Niamh | Static | No surprises | 1x1" style="background:{C['nu']}">
  <div class="cover" style="background:radial-gradient(circle at 78% 30%,#f4efea 0%,{C['nu']} 48%,#ddd2c8 100%)"></div>
  {sframe(620, 110, 390, 704, 'suite-one-consultation-space.jpg', fx=0.45, fy=0.5)}
  <div class="abs hl" style="left:80px;top:120px;font-size:50px;color:{C['od']}">You&rsquo;ll know<br>what happens<br><b>before it<br>happens.</b></div>
  <div class="abs" style="left:80px;top:420px;width:500px">{bullets(["What the room looks like", "Who you&rsquo;ll see", "What pain relief we use, and how", "How long it takes", "That you can stop at any moment"], C['bo'], C['ol'], size=25, gap=14)}</div>
  <div class="abs" style="left:80px;top:950px;width:200px;color:{C['ol']}">{LOGO}</div>
  <div class="abs" style="left:790px;top:965px"><span class="cta dark" style="height:60px;font-size:17px;padding:0 30px">{CTA_ONLINE}</span></div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s1" id="N3" data-name="Niamh | Static | Booked it cancelled it | 1x1" style="background:{C['be']}">
  <div class="cover" style="background:radial-gradient(circle at 25% 20%,#f1e9e1 0%,{C['be']} 45%,#d2c2b2 100%)"></div>
  <div class="abs" style="left:540px;top:80px;width:460px;height:820px;border-radius:30px;overflow:hidden;box-shadow:0 26px 54px rgba(20,33,26,.18)">
    <div class="cover" style="background-image:url(assets/photos/concierge.jpg);background-position:42% 40%"></div>
  </div>
  <div class="abs hl" style="left:80px;top:130px;font-size:58px;color:{C['od']}">Booked it.<br><span style="text-decoration:line-through;text-decoration-thickness:4px;text-decoration-color:{C['bo']}">Cancelled it.</span><br><b>Booked it<br>again.</b></div>
  <div class="abs body" style="left:80px;top:500px;width:420px;font-size:30px;font-weight:500;color:{C['bo']}">Start with a conversation, not the chair.</div>
  <div class="abs body" style="left:80px;top:610px;width:420px;font-size:23px;color:{C['ol']}">Your first contact is our patient concierge. Tell us what would help.</div>
  <div class="abs" style="left:80px;top:950px;width:200px;color:{C['ol']}">{LOGO}</div>
  <div class="abs" style="left:80px;top:770px"><span class="cta dark" style="height:60px;font-size:17px;padding:0 30px">{CTA_ONLINE}</span></div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s1" id="N4" data-name="Niamh | Static | No clinical smell | 1x1" style="background:{C['od']}">
  <div class="cover" style="background-image:url(assets/photos/lounge.jpg);background-position:55% 50%"></div>
  <div class="cover" style="background:linear-gradient(180deg,rgba(20,33,26,.85) 0%,rgba(20,33,26,.55) 28%,rgba(20,33,26,.2) 55%,rgba(20,33,26,.85) 100%)"></div>
  <div class="abs hl" style="left:80px;top:90px;font-size:62px;color:{C['nu']}">No harsh clinical smell.<br><b>No equipment on display.</b></div>
  <div class="abs body" style="left:80px;top:830px;width:800px;font-size:28px;color:{C['nu']}">A practice designed, on purpose, not to feel like one.</div>
  <div class="abs" style="left:80px;top:950px;width:200px;color:{C['be']}">{LOGO}</div>
  <div class="abs" style="left:790px;top:972px"><span class="cta light" style="height:60px;font-size:17px;padding:0 30px">{CTA_ONLINE}</span></div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s1" id="N5" data-name="Niamh | Static | You set the pace | 1x1" style="background:{C['nu']}">
  <div class="cover" style="background:radial-gradient(ellipse at 60% 55%,#f7f3ee 0%,{C['nu']} 45%,#d8cbbf 100%)"></div>
  <div class="abs" style="left:700px;top:30px;width:330px;color:{C['bo']}">{LINE_S}</div>
  <div class="abs hl" style="left:80px;top:110px;font-size:90px;color:{C['od']}">You set<br>the <b>pace.</b></div>
  {control_cards(100, 440, 760)}
  <div class="abs" style="left:80px;top:950px;width:200px;color:{C['ol']}">{LOGO}</div>
  <div class="abs" style="left:790px;top:965px"><span class="cta dark" style="height:60px;font-size:17px;padding:0 30px">{CTA_ONLINE}</span></div>
  <div class="grain"></div>
</div>""")
    return page("Siha | Niamh | 1x1", b)


def niamh_9x16():
    b = []
    b.append(f"""
<div class="ab s9" id="N1s" data-name="Niamh | Static | Stop signal | 9x16" style="background:{C['od']}">
  <div class="cover" style="height:1150px;background-image:url(assets/photos/hygiene-suite.jpg);background-position:30% 50%"></div>
  <div class="cover" style="background:linear-gradient(180deg,rgba(20,33,26,.2) 0%,rgba(20,33,26,.45) 35%,rgba(20,33,26,.9) 52%,{C['od']} 62%)"></div>
  <div class="abs hl" style="left:90px;top:960px;font-size:92px;color:{C['nu']}">Raise your hand.<br><b>We stop.</b><br>Every time.</div>
  <div class="abs body" style="left:90px;top:1290px;width:880px;font-size:34px;color:{C['be']}">We agree a pause signal before anything starts. No explanation needed.</div>
  <div class="abs" style="left:90px;top:1450px"><span class="cta light">{CTA_ONLINE}</span></div>
  <div class="abs" style="left:780px;top:1464px;width:200px;color:{C['be']}">{LOGO}</div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s9" id="N2s" data-name="Niamh | Static | No surprises | 9x16" style="background:{C['nu']}">
  <div class="cover" style="background:radial-gradient(circle at 55% 25%,#f4efea 0%,{C['nu']} 45%,#ddd2c8 100%)"></div>
  {sframe(360, 230, 360, 650, 'suite-one-consultation-space.jpg', fx=0.45, fy=0.5)}
  <div class="abs hl" style="left:90px;top:930px;font-size:70px;color:{C['od']}">You&rsquo;ll know what<br>happens <b>before<br>it happens.</b></div>
  <div class="abs" style="left:90px;top:1160px;width:880px">{bullets(["What the room looks like", "Who you&rsquo;ll see", "What pain relief we use, and how", "How long it takes", "That you can stop at any moment"], C['bo'], C['ol'], size=29, gap=10)}</div>
  <div class="abs" style="left:90px;top:1440px"><span class="cta dark">{CTA_ONLINE}</span></div>
  <div class="abs" style="left:780px;top:1454px;width:200px;color:{C['ol']}">{LOGO}</div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s9" id="N3s" data-name="Niamh | Static | Booked it cancelled it | 9x16" style="background:{C['be']}">
  <div class="cover" style="background:radial-gradient(circle at 30% 20%,#f1e9e1 0%,{C['be']} 45%,#d2c2b2 100%)"></div>
  <div class="abs" style="left:90px;top:260px;width:900px;height:640px;border-radius:30px;overflow:hidden;box-shadow:0 26px 54px rgba(20,33,26,.18)">
    <div class="cover" style="background-image:url(assets/photos/concierge.jpg);background-position:45% 40%"></div>
  </div>
  <div class="abs hl" style="left:90px;top:960px;font-size:82px;color:{C['od']}">Booked it.<br><span style="text-decoration:line-through;text-decoration-thickness:5px;text-decoration-color:{C['bo']}">Cancelled it.</span><br><b>Booked it again.</b></div>
  <div class="abs body" style="left:90px;top:1250px;width:880px;font-size:36px;font-weight:500;color:{C['bo']}">Start with a conversation, not the chair.</div>
  <div class="abs body" style="left:90px;top:1320px;width:880px;font-size:28px;color:{C['ol']}">Your first contact is our patient concierge. Tell us what would help.</div>
  <div class="abs" style="left:90px;top:1450px"><span class="cta dark">{CTA_ONLINE}</span></div>
  <div class="abs" style="left:780px;top:1464px;width:200px;color:{C['ol']}">{LOGO}</div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s9" id="N4s" data-name="Niamh | Static | No clinical smell | 9x16" style="background:{C['od']}">
  <div class="cover" style="background-image:url(assets/photos/lounge.jpg);background-position:55% 50%"></div>
  <div class="cover" style="background:linear-gradient(180deg,rgba(20,33,26,.88) 0%,rgba(20,33,26,.55) 26%,rgba(20,33,26,.15) 50%,rgba(20,33,26,.9) 82%)"></div>
  <div class="abs hl" style="left:90px;top:300px;font-size:80px;color:{C['nu']}">No harsh<br>clinical smell.<br><b>No equipment<br>on display.</b></div>
  <div class="abs body" style="left:90px;top:1300px;width:880px;font-size:36px;color:{C['nu']}">A practice designed, on purpose, not to feel like one.</div>
  <div class="abs" style="left:90px;top:1450px"><span class="cta light">{CTA_ONLINE}</span></div>
  <div class="abs" style="left:780px;top:1464px;width:200px;color:{C['be']}">{LOGO}</div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s9" id="N5s" data-name="Niamh | Static | You set the pace | 9x16" style="background:{C['nu']}">
  <div class="cover" style="background:radial-gradient(ellipse at 50% 55%,#f7f3ee 0%,{C['nu']} 45%,#d8cbbf 100%)"></div>
  <div class="abs" style="left:640px;top:230px;width:380px;color:{C['bo']}">{LINE_S}</div>
  <div class="abs hl" style="left:90px;top:330px;font-size:120px;color:{C['od']}">You set<br>the <b>pace.</b></div>
  {control_cards(100, 760, 820, scale=1.1)}
  <div class="abs" style="left:90px;top:1450px"><span class="cta dark">{CTA_ONLINE}</span></div>
  <div class="abs" style="left:780px;top:1464px;width:200px;color:{C['ol']}">{LOGO}</div>
  <div class="grain"></div>
</div>""")
    return page("Siha | Niamh | 9x16", b)



# ---------------------------------------------------------------- CLAIRE (camera-conscious, ICON)
def video_call(x, y, w, scale=1.0):
    h = int(w * 0.66)
    tile_w, tile_h = (w - int(54 * scale)) // 2, (h - int(110 * scale)) // 2
    def tile(label, initials, you=False):
        ring = f"border:{max(2,int(3*scale))}px solid {C['bo']};" if you else "border:1px solid rgba(225,213,202,.12);"
        person = (f'<svg viewBox="0 0 100 100" width="{int(tile_h*0.62)}" height="{int(tile_h*0.62)}" style="display:block">'
                  f'<circle cx="50" cy="36" r="18" fill="{C["gl"]}"/><path d="M14 96c4-22 19-33 36-33s32 11 36 33z" fill="{C["gl"]}"/></svg>') if you else \
                 (f'<div style="width:{int(tile_h*0.42)}px;height:{int(tile_h*0.42)}px;border-radius:50%;background:{C["ol"]};color:{C["be"]};'
                  f'display:flex;align-items:center;justify-content:center;font-size:{int(tile_h*0.15)}px;font-weight:500">{initials}</div>')
        return (f'<div style="position:relative;width:{tile_w}px;height:{tile_h}px;border-radius:{int(12*scale)}px;box-sizing:border-box;'
                f'background:{"#24342b" if you else "#1b2a22"};{ring}display:flex;align-items:center;justify-content:center">{person}'
                f'<div style="position:absolute;left:{int(12*scale)}px;bottom:{int(10*scale)}px;font-size:{int(15*scale)}px;font-weight:500;color:{C["be"]}">{label}</div></div>')
    tiles = tile("You", "", True) + tile("Weekly review", "WR") + tile("Sam", "S") + tile("Priya", "P")
    dot = lambda c: f'<span style="width:{int(40*scale)}px;height:{int(40*scale)}px;border-radius:50%;background:{c};display:inline-block"></span>'
    bar = (f'<div style="display:flex;gap:{int(14*scale)}px;justify-content:center;margin-top:{int(16*scale)}px">'
           f'{dot("#33463b")}{dot("#33463b")}{dot(C["bo"])}</div>')
    return (f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;padding:{int(18*scale)}px;box-sizing:border-box;border-radius:{int(18*scale)}px;'
            f'background:#101a14;box-shadow:0 {int(40*scale)}px {int(80*scale)}px rgba(0,0,0,.45),0 {int(6*scale)}px {int(14*scale)}px rgba(0,0,0,.3)">'
            f'<div style="display:grid;grid-template-columns:1fr 1fr;gap:{int(18*scale)}px">{tiles}</div>{bar}</div>')


def claire_1x1():
    b = []
    b.append(f"""
<div class="ab s1" id="C1" data-name="Claire | Static | Mouth closed | 1x1" style="background:{C['od']}">
  <div class="cover" style="background-image:url(assets/photos/face-photo.jpg);background-size:200%;background-position:34% 88%"></div>
  <div class="cover" style="background:linear-gradient(180deg,rgba(20,33,26,.2) 0%,rgba(20,33,26,.4) 40%,rgba(20,33,26,.9) 62%,{C['od']} 78%)"></div>
  <div class="abs hl" style="left:80px;top:560px;font-size:62px;color:{C['nu']}">You smile with your<br><b>mouth closed</b> in<br>every photo.</div>
  <div class="abs body" style="left:80px;top:790px;width:860px;font-size:26px;color:{C['be']}">Those marks can go in one appointment. No needles, no drilling.</div>
  <div class="abs" style="left:80px;top:860px">{proof(C['be'],20)}</div>
  <div class="abs" style="left:80px;top:950px;width:200px;color:{C['be']}">{LOGO}</div>
  <div class="abs" style="left:620px;top:972px"><span class="cta light" style="height:60px;font-size:17px;padding:0 30px">{CTA_FREE}</span></div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s1" id="C2" data-name="Claire | Static | Video calls | 1x1" style="background:{C['nu']}">
  <div class="cover" style="background:radial-gradient(ellipse at 60% 60%,#f7f3ee 0%,{C['nu']} 45%,#d8cbbf 100%)"></div>
  <div class="abs hl" style="left:80px;top:90px;font-size:54px;color:{C['od']}">You&rsquo;ve watched your own<br>smile on <b>every call</b> this week.</div>
  {video_call(170, 300, 740)}
  <div class="abs body" style="left:80px;top:840px;width:900px;font-size:26px;color:{C['ol']}">White spots and marks, gone in one 90-minute appointment.</div>
  <div class="abs" style="left:80px;top:950px;width:200px;color:{C['ol']}">{LOGO}</div>
  <div class="abs" style="left:620px;top:965px"><span class="cta dark" style="height:60px;font-size:17px;padding:0 30px">{CTA_FREE}</span></div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s1" id="C3" data-name="Claire | Static | One appointment | 1x1" style="background:{C['od']}">
  <div class="cover" style="left:460px;background-image:url(assets/photos/lounge-desk-1.jpg);background-position:58% 50%"></div>
  <div class="cover" style="background:linear-gradient(90deg,{C['od']} 0%,{C['od']} 42%,rgba(20,33,26,.6) 62%,rgba(20,33,26,.1) 100%)"></div>
  <div class="abs hl" style="left:80px;top:120px;font-size:72px;color:{C['nu']}">One<br>appointment.<br><b>90 minutes.</b><br>No needles.</div>
  <div class="abs body" style="left:80px;top:560px;width:480px;font-size:27px;color:{C['be']}">ICON white spot treatment. No drilling, nothing healthy removed.</div>
  <div class="abs" style="left:80px;top:690px;color:{C['nu']}"><span class="small" style="font-size:20px;letter-spacing:.14em;color:{C['be']}">FROM</span> <span class="price" style="font-size:72px">£395</span></div>
  <div class="abs" style="left:80px;top:950px;width:200px;color:{C['be']}">{LOGO}</div>
  <div class="abs" style="left:620px;top:972px"><span class="cta light" style="height:60px;font-size:17px;padding:0 30px">{CTA_FREE}</span></div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s1" id="C4" data-name="Claire | Static | Braces white spots | 1x1" style="background:{C['be']}">
  <div class="cover" style="background:radial-gradient(circle at 75% 30%,#f1e9e1 0%,{C['be']} 48%,#d2c2b2 100%)"></div>
  {sframe(620, 110, 390, 704, 'drinks-station.jpg', fx=0.5, fy=0.3)}
  <div class="abs hl" style="left:80px;top:130px;font-size:60px;color:{C['bo']}">Those<br>white spots<br>from your<br><b>braces?</b></div>
  <div class="abs body" style="left:80px;top:470px;width:480px;font-size:30px;font-weight:500;color:{C['od']}">They can fade in one visit. No drilling.</div>
  <div class="abs body" style="left:80px;top:580px;width:470px;font-size:23px;color:{C['ol']}">ICON fills the marked enamel with resin, so the spot blends into the tooth. From £395.</div>
  <div class="abs" style="left:80px;top:720px">{proof(C['br'],20)}</div>
  <div class="abs" style="left:80px;top:950px;width:200px;color:{C['ol']}">{LOGO}</div>
  <div class="abs" style="left:620px;top:965px"><span class="cta dark" style="height:60px;font-size:17px;padding:0 30px">{CTA_FREE}</span></div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s1" id="C5" data-name="Claire | Static | Whiten first | 1x1" style="background:{C['nu']}">
  <div class="cover" style="background:radial-gradient(ellipse at 50% 42%,#f7f3ee 0%,{C['nu']} 45%,#d8cbbf 100%)"></div>
  <div class="abs hl" style="left:80px;top:100px;font-size:78px;color:{C['od']}">Whiten first.<br><b>Then the spots.</b></div>
  {shade_tabs(118, 400, label="B1")}
  <div class="abs body" style="left:80px;top:745px;width:860px;font-size:30px;color:{C['bo']};font-weight:500">The order is what makes it blend.</div>
  <div class="abs body" style="left:80px;top:800px;width:880px;font-size:23px;color:{C['ol']}">Enlighten whitening with a VITA B1 shade guarantee, then ICON for the marks, matched to your new shade.</div>
  <div class="abs" style="left:80px;top:950px;width:200px;color:{C['ol']}">{LOGO}</div>
  <div class="abs" style="left:620px;top:965px"><span class="cta dark" style="height:60px;font-size:17px;padding:0 30px">{CTA_FREE}</span></div>
  <div class="grain"></div>
</div>""")
    return page("Siha | Claire | 1x1", b)


def claire_9x16():
    b = []
    b.append(f"""
<div class="ab s9" id="C1s" data-name="Claire | Static | Mouth closed | 9x16" style="background:{C['od']}">
  <div class="cover" style="height:1150px;background-image:url(assets/photos/face-photo.jpg);background-size:auto 150%;background-position:44% 38%"></div>
  <div class="cover" style="background:linear-gradient(180deg,rgba(20,33,26,.15) 0%,rgba(20,33,26,.4) 35%,rgba(20,33,26,.92) 54%,{C['od']} 64%)"></div>
  <div class="abs hl" style="left:90px;top:1000px;font-size:80px;color:{C['nu']}">You smile with<br>your <b>mouth closed</b><br>in every photo.</div>
  <div class="abs body" style="left:90px;top:1290px;width:880px;font-size:32px;color:{C['be']}">Those marks can go in one appointment. No needles, no drilling.</div>
  <div class="abs" style="left:90px;top:1395px">{proof(C['be'],22)}</div>
  <div class="abs" style="left:90px;top:1460px"><span class="cta light">{CTA_FREE}</span></div>
  <div class="abs" style="left:780px;top:1474px;width:200px;color:{C['be']}">{LOGO}</div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s9" id="C2s" data-name="Claire | Static | Video calls | 9x16" style="background:{C['nu']}">
  <div class="cover" style="background:radial-gradient(ellipse at 50% 50%,#f7f3ee 0%,{C['nu']} 45%,#d8cbbf 100%)"></div>
  <div class="abs hl" style="left:90px;top:300px;font-size:76px;color:{C['od']}">You&rsquo;ve watched<br>your own smile on<br><b>every call</b> this week.</div>
  {video_call(90, 640, 900, scale=1.15)}
  <div class="abs body" style="left:90px;top:1300px;width:880px;font-size:34px;color:{C['ol']}">White spots and marks, gone in one 90-minute appointment.</div>
  <div class="abs" style="left:90px;top:1440px"><span class="cta dark">{CTA_FREE}</span></div>
  <div class="abs" style="left:780px;top:1454px;width:200px;color:{C['ol']}">{LOGO}</div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s9" id="C3s" data-name="Claire | Static | One appointment | 9x16" style="background:{C['od']}">
  <div class="cover" style="height:900px;background-image:url(assets/photos/lounge-desk-1.jpg);background-position:55% 50%"></div>
  <div class="cover" style="background:linear-gradient(180deg,rgba(20,33,26,.25) 0%,rgba(20,33,26,.5) 30%,{C['od']} 47%)"></div>
  <div class="abs hl" style="left:90px;top:720px;font-size:92px;color:{C['nu']}">One appointment.<br><b>90 minutes.</b><br>No needles.</div>
  <div class="abs body" style="left:90px;top:1050px;width:880px;font-size:34px;color:{C['be']}">ICON white spot treatment. No drilling, nothing healthy removed.</div>
  <div class="abs" style="left:90px;top:1190px;color:{C['nu']}"><span class="small" style="font-size:24px;letter-spacing:.14em;color:{C['be']}">FROM</span> <span class="price" style="font-size:110px">£395</span></div>
  <div class="abs" style="left:90px;top:1440px"><span class="cta light">{CTA_FREE}</span></div>
  <div class="abs" style="left:780px;top:1454px;width:200px;color:{C['be']}">{LOGO}</div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s9" id="C4s" data-name="Claire | Static | Braces white spots | 9x16" style="background:{C['be']}">
  <div class="cover" style="background:radial-gradient(circle at 55% 25%,#f1e9e1 0%,{C['be']} 45%,#d2c2b2 100%)"></div>
  {sframe(360, 230, 360, 650, 'drinks-station.jpg', fx=0.5, fy=0.3)}
  <div class="abs hl" style="left:90px;top:940px;font-size:80px;color:{C['bo']}">Those white spots<br>from your <b>braces?</b></div>
  <div class="abs body" style="left:90px;top:1140px;width:880px;font-size:36px;font-weight:500;color:{C['od']}">They can fade in one visit. No drilling.</div>
  <div class="abs body" style="left:90px;top:1210px;width:880px;font-size:29px;color:{C['ol']}">ICON fills the marked enamel with resin, so the spot blends into the tooth. From £395.</div>
  <div class="abs" style="left:90px;top:1360px">{proof(C['br'],22)}</div>
  <div class="abs" style="left:90px;top:1440px"><span class="cta dark">{CTA_FREE}</span></div>
  <div class="abs" style="left:780px;top:1454px;width:200px;color:{C['ol']}">{LOGO}</div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s9" id="C5s" data-name="Claire | Static | Whiten first | 9x16" style="background:{C['nu']}">
  <div class="cover" style="background:radial-gradient(ellipse at 50% 45%,#f7f3ee 0%,{C['nu']} 45%,#d8cbbf 100%)"></div>
  <div class="abs hl" style="left:90px;top:320px;font-size:96px;color:{C['od']}">Whiten first.<br><b>Then the spots.</b></div>
  {shade_tabs(130, 720, 1.05, label="B1")}
  <div class="abs body" style="left:90px;top:1130px;width:880px;font-size:40px;color:{C['bo']};font-weight:500">The order is what makes it blend.</div>
  <div class="abs body" style="left:90px;top:1200px;width:880px;font-size:29px;color:{C['ol']}">Enlighten whitening with a VITA B1 shade guarantee, then ICON for the marks, matched to your new shade.</div>
  <div class="abs" style="left:90px;top:1440px"><span class="cta dark">{CTA_FREE}</span></div>
  <div class="abs" style="left:780px;top:1454px;width:200px;color:{C['ol']}">{LOGO}</div>
  <div class="grain"></div>
</div>""")
    return page("Siha | Claire | 9x16", b)



# ---------------------------------------------------------------- SMILE MAKEOVER (align, whiten, bond)
def timeline(x, y, w, scale=1.0, dark=False):
    steps_ = [("1", "Align", "Usually six to nine months"), ("2", "Whiten", "14 nights at home"), ("3", "Bond", "One appointment")]
    rows = []
    gap = int(150 * scale)
    for i, (n, t, d) in enumerate(steps_):
        rows.append(f'<div style="position:absolute;left:0;top:{i*gap}px;width:{w}px;display:flex;align-items:center;gap:{int(28*scale)}px">'
                    f'<div style="width:{int(74*scale)}px;height:{int(74*scale)}px;flex:none;border-radius:50%;background:{C["bo"]};color:{C["wh"]};'
                    f'display:flex;align-items:center;justify-content:center;font-size:{int(30*scale)}px;font-weight:500;box-shadow:0 {int(10*scale)}px {int(20*scale)}px rgba(20,33,26,.25)">{n}</div>'
                    f'<div style="flex:1;padding:{int(24*scale)}px {int(30*scale)}px;background:#fbf9f6;border-radius:{int(16*scale)}px;'
                    f'box-shadow:0 {int(18*scale)}px {int(36*scale)}px rgba(20,33,26,.18),0 {int(3*scale)}px {int(8*scale)}px rgba(20,33,26,.1);display:flex;justify-content:space-between;align-items:baseline">'
                    f'<span style="font-size:{int(38*scale)}px;font-weight:600;color:{C["od"]}">{t}</span>'
                    f'<span style="font-size:{int(22*scale)}px;color:{C["br"]}">{d}</span></div></div>')
    line = (f'<div style="position:absolute;left:{int(36*scale)}px;top:{int(40*scale)}px;width:3px;height:{2*gap}px;background:{C["bo"]};opacity:.5"></div>')
    return f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px;height:{3*gap}px">{line}{"".join(rows)}</div>'


def compare_cards(x, y, scale=1.0):
    card = lambda title, big, sub, bg, fg, sfg, rot, dx, dy: (
        f'<div style="position:absolute;left:{dx}px;top:{dy}px;width:{int(400*scale)}px;padding:{int(36*scale)}px {int(38*scale)}px;background:{bg};border-radius:{int(14*scale)}px;'
        f'transform:rotate({rot}deg);box-shadow:0 {int(26*scale)}px {int(50*scale)}px rgba(20,33,26,.25),0 {int(4*scale)}px {int(10*scale)}px rgba(20,33,26,.14)">'
        f'<div class="eyebrow" style="font-size:{int(16*scale)}px;color:{sfg};margin-bottom:{int(12*scale)}px">{title}</div>'
        f'<div class="price" style="font-size:{int(84*scale)}px;color:{fg}">{big}</div>'
        f'<div style="font-size:{int(22*scale)}px;line-height:1.35;color:{sfg};margin-top:{int(14*scale)}px">{sub}</div></div>')
    return (f'<div class="abs" style="left:{x}px;top:{y}px;width:{int(860*scale)}px;height:{int(360*scale)}px">'
            + card("Ten veneers", "£9,950", "Ten healthy teeth filed down, for good.", "#f3eee9", C["br"], C["br"], -2.2, 0, int(20*scale))
            + card("Bonding, per tooth", "£250", "Added to your own teeth. Usually two to four.", C["od"], C["nu"], C["be"], 1.6, int(440*scale), 0)
            + '</div>')


def smile_1x1():
    b = []
    b.append(f"""
<div class="ab s1" id="S1" data-name="Smile makeover | Static | Hated them | 1x1" style="background:{C['od']}">
  <div class="cover" style="left:430px;background-image:url(assets/photos/lounge-plants.jpg);background-size:cover;background-position:12% 50%"></div>
  <div class="cover" style="background:linear-gradient(90deg,{C['od']} 0%,{C['od']} 42%,rgba(20,33,26,.65) 60%,rgba(20,33,26,.05) 100%)"></div>
  <div class="abs hl" style="left:80px;top:120px;font-size:56px;color:{C['nu']}">You&rsquo;ve hated<br>your teeth for<br>as long as you<br>can <b>remember.</b></div>
  <div class="abs body" style="left:80px;top:470px;width:470px;font-size:34px;font-weight:500;color:{C['be']}">Align. Whiten. Bond.</div>
  <div class="abs body" style="left:80px;top:540px;width:460px;font-size:25px;color:{C['be']}">Your own teeth, finally the way you wanted them.</div>
  <div class="abs" style="left:80px;top:680px">{proof(C['be'],20)}</div>
  <div class="abs" style="left:80px;top:950px;width:200px;color:{C['be']}">{LOGO}</div>
  <div class="abs" style="left:620px;top:972px"><span class="cta light" style="height:60px;font-size:17px;padding:0 30px">{CTA_FREE}</span></div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s1" id="S2" data-name="Smile makeover | Static | Three steps | 1x1" style="background:{C['be']}">
  <div class="cover" style="background:radial-gradient(circle at 30% 20%,#f1e9e1 0%,{C['be']} 45%,#d2c2b2 100%)"></div>
  <div class="abs hl" style="left:80px;top:100px;font-size:84px;color:{C['od']}">Align. Whiten.<br><b>Bond.</b></div>
  <div class="abs body" style="left:80px;top:310px;width:860px;font-size:26px;color:{C['ol']}">A smile makeover without veneers, in the order that makes it look natural.</div>
  {timeline(80, 420, 920)}
  <div class="abs" style="left:80px;top:950px;width:200px;color:{C['ol']}">{LOGO}</div>
  <div class="abs" style="left:620px;top:965px"><span class="cta dark" style="height:60px;font-size:17px;padding:0 30px">{CTA_FREE}</span></div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s1" id="S3" data-name="Smile makeover | Static | Never too old | 1x1" style="background:{C['od']}">
  <div class="cover" style="background-image:url(assets/photos/lounge.jpg);background-size:cover;background-position:20% 60%"></div>
  <div class="cover" style="background:linear-gradient(180deg,rgba(20,33,26,.9) 0%,rgba(20,33,26,.6) 30%,rgba(20,33,26,.3) 55%,rgba(20,33,26,.9) 100%)"></div>
  <div class="abs hl" style="left:80px;top:100px;font-size:72px;color:{C['nu']}">Too old to fix<br>your smile?<br><b>You&rsquo;re not.</b></div>
  <div class="abs body" style="left:80px;top:800px;width:860px;font-size:28px;color:{C['nu']}">Plenty of people start in their forties, fifties and sixties.</div>
  <div class="abs" style="left:80px;top:950px;width:200px;color:{C['be']}">{LOGO}</div>
  <div class="abs" style="left:620px;top:972px"><span class="cta light" style="height:60px;font-size:17px;padding:0 30px">{CTA_FREE}</span></div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s1" id="S4" data-name="Smile makeover | Static | See it first | 1x1" style="background:{C['nu']}">
  <div class="cover" style="background:radial-gradient(circle at 25% 15%,#f4efea 0%,{C['nu']} 50%,#ddd2c8 100%)"></div>
  <div class="abs" style="left:80px;top:80px;width:920px;height:480px;border-radius:30px;overflow:hidden;box-shadow:0 24px 50px rgba(20,33,26,.18)">
    <div class="cover" style="background-image:url(assets/photos/concierge-patient-discussing-case.jpg);background-size:cover;background-position:50% 45%"></div>
  </div>
  <div class="abs hl" style="left:80px;top:610px;font-size:66px;color:{C['od']}">See your new smile<br><b>before you start.</b></div>
  <div class="abs body" style="left:80px;top:775px;width:860px;font-size:26px;color:{C['ol']}">A 3D scan shows your predicted result before you commit to anything.</div>
  <div class="abs" style="left:80px;top:978px"><span class="cta dark" style="height:56px;font-size:17px;padding:0 30px">{CTA_FREE}</span></div>
  <div class="abs" style="left:800px;top:968px;width:200px;color:{C['ol']}">{LOGO}</div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s1" id="S5" data-name="Smile makeover | Static | Not ten veneers | 1x1" style="background:{C['be']}">
  <div class="cover" style="background:radial-gradient(ellipse at 50% 55%,#f3ece4 0%,{C['be']} 45%,#cfbfae 100%)"></div>
  <div class="abs hl" style="left:80px;top:100px;font-size:64px;color:{C['od']}">You probably don&rsquo;t<br>need <b>ten veneers.</b></div>
  {compare_cards(110, 340)}
  <div class="abs body" style="left:80px;top:770px;width:880px;font-size:26px;color:{C['ol']}">Align, whiten, then bond the two to four teeth that still need it.</div>
  <div class="abs" style="left:80px;top:950px;width:200px;color:{C['ol']}">{LOGO}</div>
  <div class="abs" style="left:620px;top:965px"><span class="cta dark" style="height:60px;font-size:17px;padding:0 30px">{CTA_FREE}</span></div>
  <div class="grain"></div>
</div>""")
    return page("Siha | Smile makeover | 1x1", b)


def smile_9x16():
    b = []
    b.append(f"""
<div class="ab s9" id="S1s" data-name="Smile makeover | Static | Hated them | 9x16" style="background:{C['od']}">
  <div class="cover" style="height:1050px;background-image:url(assets/photos/lounge-plants.jpg);background-size:cover;background-position:40% 50%"></div>
  <div class="cover" style="background:linear-gradient(180deg,rgba(20,33,26,.1) 0%,rgba(20,33,26,.45) 35%,rgba(20,33,26,.92) 52%,{C['od']} 60%)"></div>
  <div class="abs hl" style="left:90px;top:930px;font-size:76px;color:{C['nu']}">You&rsquo;ve hated your<br>teeth for as long as<br>you can <b>remember.</b></div>
  <div class="abs body" style="left:90px;top:1200px;width:880px;font-size:40px;font-weight:500;color:{C['be']}">Align. Whiten. Bond.</div>
  <div class="abs body" style="left:90px;top:1270px;width:880px;font-size:30px;color:{C['be']}">Your own teeth, finally the way you wanted them.</div>
  <div class="abs" style="left:90px;top:1360px">{proof(C['be'],22)}</div>
  <div class="abs" style="left:90px;top:1440px"><span class="cta light">{CTA_FREE}</span></div>
  <div class="abs" style="left:780px;top:1454px;width:200px;color:{C['be']}">{LOGO}</div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s9" id="S2s" data-name="Smile makeover | Static | Three steps | 9x16" style="background:{C['be']}">
  <div class="cover" style="background:radial-gradient(circle at 30% 20%,#f1e9e1 0%,{C['be']} 45%,#d2c2b2 100%)"></div>
  <div class="abs hl" style="left:90px;top:320px;font-size:108px;color:{C['od']}">Align.<br>Whiten.<br><b>Bond.</b></div>
  <div class="abs body" style="left:90px;top:700px;width:880px;font-size:32px;color:{C['ol']}">A smile makeover without veneers, in the order that makes it look natural.</div>
  {timeline(90, 860, 900, scale=1.08)}
  <div class="abs" style="left:90px;top:1440px"><span class="cta dark">{CTA_FREE}</span></div>
  <div class="abs" style="left:780px;top:1454px;width:200px;color:{C['ol']}">{LOGO}</div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s9" id="S3s" data-name="Smile makeover | Static | Never too old | 9x16" style="background:{C['od']}">
  <div class="cover" style="background-image:url(assets/photos/lounge.jpg);background-size:cover;background-position:30% 55%"></div>
  <div class="cover" style="background:linear-gradient(180deg,rgba(20,33,26,.9) 0%,rgba(20,33,26,.55) 28%,rgba(20,33,26,.25) 50%,rgba(20,33,26,.92) 80%)"></div>
  <div class="abs hl" style="left:90px;top:300px;font-size:96px;color:{C['nu']}">Too old to fix<br>your smile?<br><b>You&rsquo;re not.</b></div>
  <div class="abs body" style="left:90px;top:1320px;width:880px;font-size:36px;color:{C['nu']}">Plenty of people start in their forties, fifties and sixties.</div>
  <div class="abs" style="left:90px;top:1450px"><span class="cta light">{CTA_FREE}</span></div>
  <div class="abs" style="left:780px;top:1464px;width:200px;color:{C['be']}">{LOGO}</div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s9" id="S4s" data-name="Smile makeover | Static | See it first | 9x16" style="background:{C['nu']}">
  <div class="cover" style="background:radial-gradient(circle at 25% 20%,#f4efea 0%,{C['nu']} 50%,#ddd2c8 100%)"></div>
  <div class="abs" style="left:90px;top:270px;width:900px;height:740px;border-radius:30px;overflow:hidden;box-shadow:0 24px 50px rgba(20,33,26,.18)">
    <div class="cover" style="background-image:url(assets/photos/concierge-patient-discussing-case.jpg);background-size:cover;background-position:45% 45%"></div>
  </div>
  <div class="abs hl" style="left:90px;top:1070px;font-size:86px;color:{C['od']}">See your new<br>smile <b>before<br>you start.</b></div>
  <div class="abs body" style="left:90px;top:1350px;width:880px;font-size:32px;color:{C['ol']}">A 3D scan shows your predicted result before you commit.</div>
  <div class="abs" style="left:90px;top:1450px"><span class="cta dark">{CTA_FREE}</span></div>
  <div class="abs" style="left:780px;top:1464px;width:200px;color:{C['ol']}">{LOGO}</div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s9" id="S5s" data-name="Smile makeover | Static | Not ten veneers | 9x16" style="background:{C['be']}">
  <div class="cover" style="background:radial-gradient(ellipse at 50% 50%,#f3ece4 0%,{C['be']} 45%,#cfbfae 100%)"></div>
  <div class="abs hl" style="left:90px;top:320px;font-size:90px;color:{C['od']}">You probably<br>don&rsquo;t need<br><b>ten veneers.</b></div>
  {compare_cards(100, 720, scale=1.02)}
  <div class="abs body" style="left:90px;top:1120px;width:880px;font-size:34px;color:{C['ol']}">Align, whiten, then bond the two to four teeth that still need it.</div>
  <div class="abs" style="left:90px;top:1440px"><span class="cta dark">{CTA_FREE}</span></div>
  <div class="abs" style="left:780px;top:1454px;width:200px;color:{C['ol']}">{LOGO}</div>
  <div class="grain"></div>
</div>""")
    return page("Siha | Smile makeover | 9x16", b)


if __name__ == "__main__":
    (ROOT / "josh-1x1.html").write_text(josh_1x1())
    (ROOT / "josh-9x16.html").write_text(josh_9x16())
    (ROOT / "hannah-1x1.html").write_text(hannah_1x1())
    (ROOT / "hannah-9x16.html").write_text(hannah_9x16())
    (ROOT / "mark-1x1.html").write_text(mark_1x1())
    (ROOT / "mark-9x16.html").write_text(mark_9x16())
    (ROOT / "niamh-1x1.html").write_text(niamh_1x1())
    (ROOT / "niamh-9x16.html").write_text(niamh_9x16())
    (ROOT / "claire-1x1.html").write_text(claire_1x1())
    (ROOT / "claire-9x16.html").write_text(claire_9x16())
    (ROOT / "smile-1x1.html").write_text(smile_1x1())
    (ROOT / "smile-9x16.html").write_text(smile_9x16())
    print("built")
