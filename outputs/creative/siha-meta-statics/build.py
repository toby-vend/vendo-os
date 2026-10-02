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


def sframe(x, y, w, h, img, pos="center"):
    """Photo cropped inside the S shape: two stacked blocks sharing one image."""
    bg = f"background-image:url(assets/photos/{img});background-size:{w}px {h}px;"
    return (f'<div class="sframe" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px">'
            f'<div class="t" style="{bg}background-position:0 0"></div>'
            f'<div class="b" style="{bg}background-position:0 -{h//2}px"></div></div>')


def page(title, boards):
    return (f"<!doctype html><html lang='en-GB'><head><meta charset='utf-8'><title>{title}</title>"
            f"<style>{CSS}</style><script src='https://mcp.figma.com/mcp/html-to-design/capture.js' async></script></head><body>{''.join(boards)}</body></html>")


# ---------------------------------------------------------------- JOSH (bonding first timer)
CTA_FREE = "Book a free consultation"


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
  <div class="abs body" style="left:80px;top:570px;width:520px;color:{C['be']}">Chipped edge, small gap, one tooth that never quite matched. Composite bonding fixes it in a single visit.</div>
  <div class="abs" style="left:80px;top:800px"><span class="cta light">{CTA_FREE}</span></div>
  <div class="abs" style="left:80px;top:950px;width:200px;color:{C['be']}">{LOGO}</div>
  <div class="grain"></div>
</div>""")
    # J2 one appointment, straight edges, done
    b.append(f"""
<div class="ab s1" id="J2" data-name="Josh | Static | One appointment | 1x1" style="background:{C['be']}">
  <div class="cover" style="background:radial-gradient(circle at 75% 35%,#efe7df 0%,{C['be']} 45%,#d4c5b7 100%)"></div>
  {sframe(615, 110, 400, 860, 'hannan.jpg')}
  <div class="abs hl" style="left:80px;top:150px;font-size:70px;color:{C['bo']}">One<br>appointment.<br><b>Straight</b><br>edges.<br>Done.</div>
  <div class="abs body" style="left:80px;top:610px;width:430px;color:{C['od']}">Most bonding is finished in one 1 to 2 hour visit. No temporaries, no second trip.</div>
  <div class="abs" style="left:80px;top:950px;width:200px;color:{C['ol']}">{LOGO}</div>
  <div class="abs" style="left:620px;top:990px"><span class="cta dark" style="height:56px;font-size:17px;padding:0 30px">{CTA_FREE}</span></div>
  <div class="grain"></div>
</div>""")
    # J3 honest lifespan
    b.append(f"""
<div class="ab s1" id="J3" data-name="Josh | Static | Honest lifespan | 1x1" style="background:{C['od']}">
  <div class="cover" style="height:560px;background-image:url(assets/photos/consultation-space-in-suite-1.jpg);background-position:50% 55%"></div>
  <div class="cover" style="background:linear-gradient(180deg,rgba(20,33,26,.92) 0%,rgba(20,33,26,.75) 30%,rgba(20,33,26,.8) 40%,{C['od']} 56%)"></div>
  <div class="abs hl" style="left:80px;top:90px;font-size:76px;color:{C['nu']}">How long does<br>it <b>last?</b></div>
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
<div class="ab s1" id="J4" data-name="Josh | Static | No drilling | 1x1" style="background:{C['od']}">
  <div class="cover" style="background-image:url(assets/photos/face-photo.jpg);background-position:62% 40%"></div>
  <div class="cover" style="background:linear-gradient(180deg,rgba(20,33,26,0) 30%,rgba(20,33,26,.78) 56%,{C['od']} 74%)"></div>
  <div class="abs hl" style="left:80px;top:560px;font-size:64px;color:{C['nu']}">We <b>add</b> to your teeth.<br>We don't drill them.</div>
  <div class="abs body" style="left:80px;top:720px;width:820px;color:{C['be']}">Tooth-coloured resin, shaped onto the teeth you already have. Nothing filed down, nothing permanent.</div>
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
  <div class="abs body" style="left:80px;top:820px;width:600px;color:{C['ol']}">We usually bond two to four teeth, not ten. Subtle, natural, still your smile. From £250 a tooth.</div>
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
  <div class="abs body" style="left:90px;top:1150px;width:860px;font-size:34px;color:{C['be']}">Chipped edge, small gap, one tooth that never quite matched. Composite bonding fixes it in a single visit.</div>
  <div class="abs" style="left:90px;top:1360px"><span class="cta light">{CTA_FREE}</span></div>
  <div class="abs" style="left:90px;top:1480px;width:200px;color:{C['be']}">{LOGO}</div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s9" id="J2s" data-name="Josh | Static | One appointment | 9x16" style="background:{C['be']}">
  <div class="cover" style="background:radial-gradient(circle at 60% 30%,#efe7df 0%,{C['be']} 45%,#d4c5b7 100%)"></div>
  {sframe(330, 230, 420, 820, 'hannan.jpg')}
  <div class="abs hl" style="left:90px;top:1100px;font-size:84px;color:{C['bo']}">One appointment.<br><b>Straight</b> edges.<br>Done.</div>
  <div class="abs body" style="left:90px;top:1420px;width:880px;font-size:34px;color:{C['od']}">Most bonding is finished in one 1 to 2 hour visit. No temporaries, no second trip.</div>
  <div class="abs" style="left:90px;top:1540px;width:190px;color:{C['ol']}">{LOGO}</div>
  <div class="abs" style="left:560px;top:1548px"><span class="cta dark" style="height:60px;font-size:17px;padding:0 30px">{CTA_FREE}</span></div>
  <div class="grain"></div>
</div>""")
    b.append(f"""
<div class="ab s9" id="J3s" data-name="Josh | Static | Honest lifespan | 9x16" style="background:{C['od']}">
  <div class="cover" style="height:900px;background-image:url(assets/photos/consultation-space-in-suite-1.jpg);background-position:50% 55%"></div>
  <div class="cover" style="background:linear-gradient(180deg,rgba(20,33,26,.85) 0%,rgba(20,33,26,.8) 30%,{C['od']} 48%)"></div>
  <div class="abs hl" style="left:90px;top:330px;font-size:96px;color:{C['nu']}">How long<br>does it <b>last?</b></div>
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
<div class="ab s9" id="J4s" data-name="Josh | Static | No drilling | 9x16" style="background:{C['od']}">
  <div class="cover" style="height:1250px;background-image:url(assets/photos/face-photo.jpg);background-position:58% 40%"></div>
  <div class="cover" style="background:linear-gradient(180deg,rgba(20,33,26,0) 35%,rgba(20,33,26,.8) 56%,{C['od']} 66%)"></div>
  <div class="abs hl" style="left:90px;top:1000px;font-size:92px;color:{C['nu']}">We <b>add</b> to<br>your teeth.<br>We don't<br>drill them.</div>
  <div class="abs body" style="left:90px;top:1400px;width:880px;font-size:34px;color:{C['be']}">Tooth-coloured resin, shaped onto the teeth you already have. Nothing filed down, nothing permanent.</div>
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
  <div class="abs body" style="left:90px;top:1330px;width:880px;font-size:34px;color:{C['ol']}">We usually bond two to four teeth, not ten. Subtle, natural, still your smile. From £250 a tooth.</div>
  <div class="abs" style="left:90px;top:1460px"><span class="cta dark">{CTA_FREE}</span></div>
  <div class="abs" style="left:780px;top:1474px;width:200px;color:{C['ol']}">{LOGO}</div>
  <div class="grain"></div>
</div>""")
    return page("Siha | Josh | 9x16", b)


if __name__ == "__main__":
    (ROOT / "josh-1x1.html").write_text(josh_1x1())
    (ROOT / "josh-9x16.html").write_text(josh_9x16())
    print("built")
