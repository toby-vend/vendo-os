"""Build the Siha Dental 'New patient check-up' landing page harness (desktop 1440 + mobile 390).

Usage: python3 build.py  -> writes lp-desktop.html and lp-mobile.html
Brand: Siha guideline only (Figma AbtwUHTD50G38QuOaCG4Hh): Metropolis, Dark Olive / Nude lead,
Beige panels, Burnt Orange for the one offer CTA, 30px card corners, pill buttons, S-frame once (hero).
Copy: maxr155.sg-host.com/new-patient-check-up (6 Oct 2026), with the fixes agreed with Toby.
Photos: Siha shared Drive (clinic interior, action shots, team), downscaled into assets/photos.
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
    return s.replace('width="100%" height="100%"', f'class="{cls}" fill="currentColor"', 1)


LOGO = inline_svg("logo-dark.svg", "logo")
ICON = inline_svg("shape.svg", "icon")

CSS = f"""
@font-face {{ font-family: Metropolis; src: url(assets/fonts/Metropolis-Light.otf); font-weight: 300; }}
@font-face {{ font-family: Metropolis; src: url(assets/fonts/Metropolis-Regular.otf); font-weight: 400; }}
@font-face {{ font-family: Metropolis; src: url(assets/fonts/Metropolis-Medium.otf); font-weight: 500; }}
@font-face {{ font-family: Metropolis; src: url(assets/fonts/Metropolis-SemiBold.otf); font-weight: 600; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ background: #2a2a2a; font-family: Metropolis, sans-serif; padding: 80px; color: {C['od']}; }}
.page {{ background: {C['nu']}; overflow: hidden; }}
.d {{ width: 1440px; }}
.m {{ width: 390px; padding-bottom: 84px; }}
.logo, .icon {{ display: block; height: auto; }}
/* guideline type scale */
.display {{ font-weight: 400; font-size: 56px; line-height: 1.1; letter-spacing: .04em; text-transform: uppercase; }}
.display b {{ font-weight: 600; }}
.h1 {{ font-weight: 300; font-size: 44px; line-height: 1.15; }}
.h2 {{ font-weight: 400; font-size: 28px; line-height: 1.3; }}
.h3 {{ font-weight: 500; font-size: 20px; line-height: 1.4; }}
.body {{ font-weight: 400; font-size: 16px; line-height: 1.6; }}
.label {{ font-weight: 600; font-size: 13px; letter-spacing: .14em; text-transform: uppercase; }}
.btn {{ display: inline-flex; align-items: center; justify-content: center; height: 52px; padding: 0 30px; border-radius: 999px;
        font-weight: 600; font-size: 13px; letter-spacing: .14em; text-transform: uppercase; white-space: nowrap; }}
.btn.primary {{ background: {C['od']}; color: {C['nu']}; }}
.btn.offer {{ background: {C['bo']}; color: {C['nu']}; }}
.btn.outline {{ border: 1.5px solid {C['od']}; color: {C['od']}; }}
.btn.beige {{ background: {C['be']}; color: {C['od']}; }}
.card {{ border-radius: 30px; }}
.sframe {{ position: relative; }}
.sframe .t, .sframe .b {{ position: absolute; left: 0; width: 100%; height: 50%; background-repeat: no-repeat; }}
.sframe .t {{ top: 0; border-radius: 9999px 0 0 9999px; }}
.sframe .b {{ bottom: 0; border-radius: 0 9999px 9999px 0; }}
.field {{ display: flex; flex-direction: column; gap: 8px; }}
.field span {{ font-weight: 500; font-size: 13px; color: {C['ol']}; }}
.field div {{ height: 50px; border-radius: 12px; border: 1px solid #d8cec4; background: {C['wh']}; }}
.tick {{ display: flex; gap: 12px; align-items: flex-start; }}
.tick i {{ flex: none; width: 22px; height: 22px; border-radius: 50%; background: {C['be']}; display: flex; align-items: center; justify-content: center; margin-top: 1px; }}
"""

TICK_SVG = f'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="{C["od"]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.2 4.2L19 7"/></svg>'
STAR = '<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="currentColor"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>'
PHONE = "020 4602 3510"
CTA = "Book Now"  # SOP: one unified CTA; forms use Book Now / Book Appointment / Book Consultation


def tick(text, size=16):
    return f'<div class="tick"><i>{TICK_SVG}</i><span class="body" style="font-size:{size}px">{text}</span></div>'


def stars(n=5, s=16, color=C['bo']):
    return f'<span style="display:inline-flex;gap:2px;color:{color}">{"".join(STAR.format(s=s) for _ in range(n))}</span>'


# Hannan cut-out over the S-frame (photo bottom edge on the frame bottom, person breaks out of it)
HANNAN = dict(w=1067, h=1600, bbox=(223, 312, 1007, 1600))


def s_hero(fw, fh, target_w):
    """Return (frame_html, cutout_html) positioned relative to a wrapper of size fw x fh."""
    bx0, by0, bx1, _ = HANNAN['bbox']
    s = max(target_w / (bx1 - bx0), fh / HANNAN['h'], fw / HANNAN['w'])
    w, h = HANNAN['w'] * s, HANNAN['h'] * s
    left, top = fw / 2 - s * (bx0 + bx1) / 2, fh - h
    bg = f"background-image:url(assets/photos/hannan-1600.jpg);background-size:{w:.0f}px {h:.0f}px;"
    frame = (f'<div class="sframe" data-name="Photo" style="position:absolute;left:0;top:0;width:{fw}px;height:{fh}px">'
             f'<div class="t" style="{bg}background-position:{left:.0f}px {top:.0f}px"></div>'
             f'<div class="b" style="{bg}background-position:{left:.0f}px {top - fh / 2:.0f}px"></div></div>')
    cut = (f'<img data-name="Cut-out" src="assets/cutouts/hannan.png" '
           f'style="position:absolute;left:{left:.0f}px;top:{top:.0f}px;width:{w:.0f}px;height:{h:.0f}px">')
    return frame, cut


def form_card(width, pad=40, offer=False, title="Book your first visit"):
    fields = "".join(f'<label class="field"><span>{f} *</span><div></div></label>' for f in ["First name", "Last name", "Email", "Mobile"])
    return f"""
<div class="card" data-name="Booking form" style="width:{width}px;background:{C['wh']};padding:{pad}px;box-shadow:0 30px 60px rgba(20,33,26,.14),0 4px 12px rgba(20,33,26,.06)">
  <div class="label" style="color:{C['bo']}">New patient check-up</div>
  <div class="h2" style="margin-top:10px">{title}</div>
  <div class="body" style="margin-top:6px;color:{C['br']}">Same-week appointments, evenings and weekends available.</div>
  <div style="display:grid;grid-template-columns:{"1fr" if width < 400 else "1fr 1fr"};gap:16px;margin-top:24px">{fields}</div>
  <span class="btn {'offer' if offer else 'primary'}" style="width:100%;margin-top:26px;height:56px">{CTA}</span>
  <div class="body" style="margin-top:14px;font-size:14px;text-align:center;color:{C['br']}">Your check-up is £89, with no hidden extras.</div>
  <div class="body" style="margin-top:6px;font-size:12px;text-align:center;color:{C['br']}">By submitting, you agree to our <u>privacy policy</u>.</div>
</div>"""


def nav_d():
    return f"""
<div data-name="Sticky header" style="height:96px;padding:0 80px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(20,33,26,.1)">
  <div style="width:150px;color:{C['ol']}">{LOGO}</div>
  <div style="display:flex;align-items:center;gap:40px">
    <span class="body" style="font-size:14px;color:{C['ol']}">157 Askew Road, London W12 9AU</span>
    <span class="body" style="font-size:14px;font-weight:500">{PHONE}</span>
    <span class="btn primary">{CTA}</span>
  </div>
</div>"""


def hero_d():
    frame, cut = s_hero(380, 640, 330)
    stats = "".join(f'<div><div class="h1" style="font-size:40px">{n}</div><div class="label" style="margin-top:6px;color:{C["br"]}">{l}</div></div>'
                    for n, l in [("5.0", "Google rating"), ("150+", "Patient reviews"), ("3", "2025 award wins")])
    return f"""
<section data-name="Hero" style="position:relative;height:840px">
  <div style="position:absolute;inset:0;background:radial-gradient(circle at 72% 40%,#f4efea 0%,{C['nu']} 55%)"></div>
  <div style="position:absolute;left:80px;top:96px;width:560px">
    <div class="label" style="color:{C['bo']}">New patients welcome · Shepherd’s Bush, W12</div>
    <h1 class="display" style="margin-top:22px">New patient check-up <b>£89</b></h1>
    <p class="h2" style="margin-top:18px;font-weight:300">A dentist you can actually stick with.</p>
    <p class="body" style="margin-top:16px;font-size:18px;color:{C['ol']};width:500px">Thorough check-ups, honest advice and treatment that’s genuinely right for you. New patients welcome at our Shepherd’s Bush practice.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px 24px;margin-top:32px;width:520px">
      {tick("Full exam + 3D scan")}{tick("Same-week appointments")}{tick("0% finance available")}{tick("Evening &amp; weekend slots")}
    </div>
    <div style="display:flex;gap:56px;margin-top:48px;padding-top:32px;border-top:1px solid rgba(20,33,26,.12);width:520px">{stats}</div>
  </div>
  <div data-name="S-frame" style="position:absolute;left:660px;top:100px;width:380px;height:640px">{frame}{cut}</div>
  <div style="position:absolute;left:960px;top:150px">{form_card(400, 36, offer=True)}</div>
</section>"""


def nav_m():
    return f"""
<div data-name="Sticky header (stays on scroll; Call lives in the bottom bar)" style="height:72px;padding:0 16px 0 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(20,33,26,.1);background:{C['nu']};box-shadow:0 6px 16px rgba(20,33,26,.06)">
  <div style="width:116px;color:{C['ol']}">{LOGO}</div>
  <div style="display:flex;gap:8px;align-items:center">
    <span class="btn primary" style="height:42px;padding:0 18px;font-size:11px">{CTA}</span></div>
</div>"""


def hero_m():
    frame, cut = s_hero(230, 360, 210)
    return f"""
<section data-name="Hero" style="position:relative;padding:40px 20px 48px">
  <div class="label" style="color:{C['bo']}">New patients welcome · Shepherd’s Bush, W12</div>
  <h1 class="display" style="margin-top:16px;font-size:36px">New patient check-up <b>£89</b></h1>
  <p class="h2" style="margin-top:12px;font-size:22px;font-weight:300">A dentist you can actually stick with.</p>
  <p class="body" style="margin-top:12px;color:{C['ol']}">Thorough check-ups, honest advice and treatment that’s genuinely right for you. New patients welcome at our Shepherd’s Bush practice.</p>
  <div style="display:grid;gap:10px;margin-top:20px">{tick("Full exam + 3D scan", 15)}{tick("Same-week appointments", 15)}</div>
  <div data-name="Hero buttons" style="display:grid;grid-template-columns:1fr auto;gap:10px;margin-top:22px"><span class="btn primary" style="height:54px">{CTA}</span><span class="btn outline" style="height:54px;padding:0 22px">Call</span></div>
  <div data-name="Trust line" style="display:flex;align-items:center;gap:10px;margin-top:18px">{stars(5, 14)}<span class="body" style="font-size:13px;white-space:nowrap;color:{C['ol']}">5.0 from 157 Google reviews</span></div>
  <div data-name="S-frame" style="position:relative;width:230px;height:360px;margin:96px auto 0">{frame}{cut}</div>
  <div style="margin-top:-60px;position:relative">{form_card(350, 24, offer=True)}</div>
  <div style="display:flex;justify-content:space-between;margin-top:32px">
    {"".join(f'<div><div class="h1" style="font-size:32px">{n}</div><div class="label" style="margin-top:4px;font-size:12px;color:{C["br"]}">{l}</div></div>' for n, l in [("5.0", "Google rating"), ("150+", "Reviews"), ("3", "2025 awards")])}
  </div>
</section>"""


SECTIONS_D = [nav_d, hero_d]
SECTIONS_M = [nav_m, hero_m]


# Mobile sticky bottom bar: fixed to the bottom of the viewport on every scroll position (shown at the first
# screen's fold, 844px, in the design). The page gets matching bottom padding so the footer isn't hidden.
BOTTOM_BAR = (f'<div data-name="Sticky bottom bar (fixed to viewport bottom)" style="position:absolute;left:0;top:760px;width:390px;height:84px;'
              f'padding:12px 16px;background:{C["nu"]};box-shadow:0 -8px 24px rgba(20,33,26,.12);display:grid;grid-template-columns:auto 1fr;gap:10px;z-index:5">'
              f'<span class="btn outline" style="height:56px;padding:0 20px">Call</span><span class="btn primary" style="height:56px">{CTA}</span></div>')


def page(title, cls, sections):
    body = "".join(s() for s in sections)
    return (f"<!doctype html><html lang='en-GB'><head><meta charset='utf-8'><title>{title}</title><style>{CSS}</style>"
            f"<script src='https://mcp.figma.com/mcp/html-to-design/capture.js' async></script></head>"
            f"<body><div class='page {cls}' data-name='{title}' style='position:relative'>{body}{BOTTOM_BAR if cls == 'm' else ''}</div></body></html>")


if __name__ == "__main__":
    from sections import BODY, thank_you
    SECTIONS_D += [lambda f=f: f(False) for f in BODY]
    SECTIONS_M += [lambda f=f: f(True) for f in BODY]
    (ROOT / "lp-desktop.html").write_text(page("New patient check-up | Desktop", "d", SECTIONS_D))
    (ROOT / "lp-mobile.html").write_text(page("New patient check-up | Mobile", "m", SECTIONS_M))
    (ROOT / "ty-desktop.html").write_text(page("Thank you | Desktop", "d", [lambda: thank_you(False)]))
    (ROOT / "ty-mobile.html").write_text(page("Thank you | Mobile", "m", [lambda: thank_you(True)]))
    print("wrote lp-desktop.html, lp-mobile.html, ty-desktop.html, ty-mobile.html")
