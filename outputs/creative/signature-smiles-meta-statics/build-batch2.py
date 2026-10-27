"""Build Signature Smiles Meta statics, batch 2 (27 Oct 2026): Ray (General) and Claire (Smile Makeover).

Usage: python3 build-batch2.py [ray|claire ...]  -> writes <persona>-1x1.html, -9x16.html and -landscape.html
Reuses the brand helpers in build.py (palette, PARISIAN + Montserrat, logo, arch, ribbon, badge, dots, grain).
Copy: copy-ray.md, copy-claire.md. Facts and sources: research-batch2.md. Photos: assets/photos (gitignored), the
client's own Drive shoot and site photography only; Claire is type-led (no client photo fits her).
"""
import sys

from build import C, CSS, ROOT, STAR, arch, badge, board, bg, dots, logo, numbered, photo, warm_linen, warm_olive, warm_sage

D = "261027"
PHONE = "01280 733343"
CTA_CALL = f"Call {PHONE}"
CTA_CONSULT = "Book your free consultation"
REVIEWS = "Rated Excellent &middot; 112 Google reviews"

CSS2 = CSS + ".sl { width: 1200px; height: 628px; }\n"


def page(title, boards):
    return (f"<!doctype html><html lang='en-GB'><head><meta charset='utf-8'><title>{title}</title>"
            f"<style>{CSS2}</style><script src='https://mcp.figma.com/mcp/html-to-design/capture.js' async></script></head>"
            f"<body>{''.join(boards)}</body></html>")


def proof(color, size=22, star=C['terra']):
    """Google proof as the site widget shows it: five stars, "Excellent", 112 reviews (no decimal)."""
    stars = "".join(STAR.format(s=size) for _ in range(5))
    return (f'<div style="display:flex;align-items:center;gap:14px">'
            f'<span style="display:flex;gap:3px;color:{star}">{stars}</span>'
            f'<span class="small" style="font-size:{size}px;color:{color};white-space:nowrap">{REVIEWS}</span></div>')


def cta(text, tone="olive", h=62, fs=17, pad=32):
    return f'<span class="cta {tone}" style="height:{h}px;font-size:{fs}px;padding:0 {pad}px;white-space:nowrap">{text}</span>'


def at(x, y, inner, extra=""):
    return f'<div class="abs" style="left:{x}px;top:{y}px;{extra}">{inner}</div>'


def hl(x, y, text, size, color=C['copper'], width=None, extra=""):
    w = f"width:{width}px;" if width else ""
    return f'<div class="abs hl" style="left:{x}px;top:{y}px;{w}font-size:{size}px;color:{color};{extra}">{text}</div>'


def scrim(css):
    return f'<div class="cover" style="background:{css}"></div>'


# ---------------------------------------------------------------- RAY (in pain today, General)
SEARCH_ICON = ('<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="none" stroke="{c}" stroke-width="2.2" stroke-linecap="round">'
               '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5l5 5"/></svg>')


def search_bar(w, h, fs, query="emergency dentist brackley"):
    s = int(fs * 1.15)
    return (f'<div style="width:{w}px;height:{h}px;border-radius:{h // 2}px;background:#FFFFFF;display:flex;align-items:center;gap:{int(fs * .7)}px;'
            f'padding:0 {int(h * .45)}px;box-shadow:0 18px 40px rgba(30,30,28,.28),0 2px 6px rgba(30,30,28,.12)">'
            f'{SEARCH_ICON.format(s=s, c=C["sand"])}<span style="font-size:{fs}px;color:{C["ink"]};letter-spacing:.01em">{query}</span>'
            f'<span style="margin-left:auto;width:2px;height:{int(fs * 1.2)}px;background:{C["terra"]}"></span></div>')


def result_card(w, k=1.0):
    """The search result, in brand: linen card, copper monogram, PARISIAN name, real rating and address."""
    stars = "".join(STAR.format(s=int(22 * k)) for _ in range(5))
    icon = int(64 * k)
    return (f'<div style="width:{w}px;padding:{int(28 * k)}px {int(36 * k)}px;border-radius:{int(26 * k)}px;'
            f'background:linear-gradient(170deg,#FFFFFF 0%,{C["linen"]} 55%,#EFEAE3 100%);'
            f'box-shadow:0 30px 60px rgba(30,30,28,.30),0 6px 14px rgba(30,30,28,.14);display:flex;gap:{int(24 * k)}px;align-items:flex-start">'
            f'<div style="flex:none;width:{icon}px;height:{icon}px;border-radius:50%;border:1.5px solid {C["stone"]};background:#FFFFFF;'
            f'display:flex;align-items:center;justify-content:center">{logo("icon", int(icon * .62))}</div>'
            f'<div><div class="hl" style="font-size:{int(40 * k)}px;line-height:1.1">Signature Smiles</div>'
            f'<div class="small" style="font-size:{int(19 * k)}px;color:{C["sand"]};margin-top:{int(4 * k)}px">Dentist</div>'
            f'<div style="display:flex;align-items:center;gap:{int(10 * k)}px;margin-top:{int(12 * k)}px">'
            f'<span style="display:flex;gap:2px;color:{C["terra"]}">{stars}</span>'
            f'<span class="small" style="font-size:{int(19 * k)}px;color:{C["ink"]}">112 Google reviews</span></div>'
            f'<div class="small" style="font-size:{int(19 * k)}px;color:{C["ink"]};opacity:.75;margin-top:{int(8 * k)}px">Juno Crescent, Brackley NN13 6RF</div>'
            f'</div></div>')


R_STEPS = [f"Call {PHONE}", "Same-day appointment where possible", "Assessment and x-ray, £95", "Your plan and prices before any treatment"]
R_STEPS_SHORT = [f"Call {PHONE}", "Same day where possible", "Assessment and x-ray, £95", "Plan and prices first"]


FRONT = "drive-P1066144.jpg"   # client Drive, Feb 2026 shoot: practice frontage, Juno Crescent
DESK = "drive-P1066170.jpg"    # client Drive, Feb 2026 shoot: reception desk
LORRAINE = "team-lorraine.jpg"  # client site / shoot: Lorraine Murphy, Front of House (about-us)


def caption(x, y, w, text, color=C['sand'], size=15, align="center"):
    return f'<div class="abs label" style="left:{x}px;top:{y}px;width:{w}px;text-align:{align};font-size:{size}px;color:{color}">{text}</div>'


def ray_1x1():
    b = []
    b.append(board("R1", f"Search bar | Static | Practice frontage | Emergency search | 1x1 | {D}", "s1", C['olive'], f"""
  {photo(0, 0, 1080, 1080, FRONT, fx=0.5, fy=0.8)}
  {scrim("linear-gradient(180deg,rgba(30,30,28,.75) 0%,rgba(30,30,28,.3) 14%,rgba(30,30,28,0) 24%,rgba(54,56,41,0) 38%,rgba(54,56,41,.85) 60%,#363829 100%)")}
  {at(80, 60, logo('web-light', 210))}
  {at(80, 470, search_bar(920, 84, 30))}
  {at(80, 576, result_card(920))}
  {hl(80, 830, "New patients welcome in an emergency.", 46, C['linen'], 920)}
  {at(80, 896, dots(["£95 emergency appointment", "X-ray included"], 'rgba(249,247,245,.9)', 22))}
  {at(80, 968, cta(CTA_CALL, 'linen'))}
  {at(560, 986, proof('rgba(249,247,245,.85)', 18))}"""))
    b.append(board("R2", f"Rung round | Static | Practice reception | New patients welcome | 1x1 | {D}", "s1", C['olive'], f"""
  {photo(0, 0, 1080, 1080, DESK, fx=0.5, fy=0.62)}
  {scrim("linear-gradient(180deg,rgba(30,30,28,.45) 0%,rgba(30,30,28,0) 20%)")}
  <div class="abs" style="left:0;top:520px;width:1080px;height:560px;background:linear-gradient(180deg,rgba(54,56,41,0) 0%,rgba(54,56,41,.88) 28%,#363829 60%)"></div>
  {at(80, 60, logo('web-light', 210))}
  {hl(80, 590, "Rung round and nobody<br>can see you?", 66, C['linen'], 920)}
  <div class="abs" style="left:80px;top:760px;width:60px;height:1px;background:{C['terra']}"></div>
  {hl(80, 785, "We regularly see new patients in an emergency.", 36, C['stone'], 920)}
  <div class="abs" style="left:80px;top:850px;display:flex;align-items:baseline;gap:22px"><span class="price" style="font-size:76px;color:{C['linen']}">£95</span>{dots(["X-ray included", "Same day where possible"], 'rgba(249,247,245,.9)', 22)}</div>
  {at(80, 968, cta(CTA_CALL, 'linen'))}
  {at(560, 986, proof('rgba(249,247,245,.85)', 18))}"""))
    b.append(board("R3", f"What happens | Static | Lorraine front of house | Four steps | 1x1 | {D}", "s1", C['sage'], f"""
  {warm_sage()}
  {arch(80, 150, 400, 660, LORRAINE, fx=0.5, fy=0.15)}
  {caption(80, 830, 400, "Lorraine &middot; Front of House")}
  <div class="abs" style="left:540px;top:110px;width:460px;height:780px;border-radius:230px 230px 0 0;background:linear-gradient(175deg,#FFFFFF 0%,{C['linen']} 45%,#F1EDE7 100%);box-shadow:0 30px 60px rgba(30,30,28,.12)"></div>
  {hl(540, 250, "Toothache<br>keeping you up?", 52, C['copper'], 460, "text-align:center")}
  <div class="abs label" style="left:540px;top:400px;width:460px;text-align:center;font-size:15px">What happens when you call</div>
  {at(585, 450, numbered(R_STEPS, C['copper'], C['ink'], size=23, gap=20, circle=46), "width:390px")}
  {at(80, 950, logo('web', 230))}
  {at(640, 968, cta(CTA_CALL))}"""))
    return page("Signature Smiles | Ray | 1x1", b)


def ray_9x16():
    """9:16: key copy kept out of the top 250px and bottom 340px."""
    b = []
    b.append(board("R1s", f"Search bar | Static | Practice frontage | Emergency search | 9x16 | {D}", "s9", C['olive'], f"""
  {photo(0, 0, 1080, 1920, FRONT, fx=0.5, fy=1.0, zoom=1.1)}
  {scrim("linear-gradient(180deg,rgba(30,30,28,.78) 0%,rgba(30,30,28,.4) 17%,rgba(30,30,28,0) 26%,rgba(54,56,41,0) 44%,rgba(54,56,41,.88) 60%,#363829 80%)")}
  {at(90, 270, logo('web-light', 240))}
  {at(90, 930, search_bar(900, 92, 33))}
  {at(90, 1040, result_card(900))}
  {hl(90, 1300, "New patients welcome<br>in an emergency.", 56, C['linen'], 900)}
  {at(90, 1432, dots(["£95 emergency appointment", "X-ray included"], 'rgba(249,247,245,.9)', 26))}
  {at(90, 1495, cta(CTA_CALL, 'linen', 72, 20, 42))}
  {at(90, 1640, proof('rgba(249,247,245,.85)', 22))}"""))
    b.append(board("R2s", f"Rung round | Static | Practice reception | New patients welcome | 9x16 | {D}", "s9", C['olive'], f"""
  {photo(0, 0, 1080, 1300, DESK, fx=0.5, fy=0.3)}
  {scrim("linear-gradient(180deg,rgba(30,30,28,.55) 0%,rgba(30,30,28,0) 22%)")}
  <div class="abs" style="left:0;top:950px;width:1080px;height:970px;background:linear-gradient(180deg,rgba(54,56,41,0) 0%,rgba(54,56,41,.9) 20%,#363829 40%)"></div>
  {at(90, 270, logo('web-light', 240))}
  {hl(90, 1030, "Rung round and nobody can see you?", 84, C['linen'], 900)}
  <div class="abs" style="left:90px;top:1230px;width:70px;height:1px;background:{C['terra']}"></div>
  {hl(90, 1255, "We regularly see new patients in an emergency.", 42, C['stone'], 900)}
  <div class="abs" style="left:90px;top:1375px;display:flex;align-items:baseline;gap:24px"><span class="price" style="font-size:86px;color:{C['linen']}">£95</span>{dots(["X-ray included", "Same day where possible"], 'rgba(249,247,245,.9)', 25)}</div>
  {at(90, 1495, cta(CTA_CALL, 'linen', 72, 20, 42))}
  {at(90, 1640, proof('rgba(249,247,245,.85)', 22))}"""))
    b.append(board("R3s", f"What happens | Static | Lorraine front of house | Four steps | 9x16 | {D}", "s9", C['sage'], f"""
  {warm_sage()}
  {hl(90, 270, "Toothache<br>keeping you up?", 84, C['copper'], 900, "text-align:center")}
  <div class="abs" style="left:90px;top:470px;width:900px;height:1110px;border-radius:450px 450px 0 0;background:linear-gradient(175deg,#FFFFFF 0%,{C['linen']} 45%,#F1EDE7 100%);box-shadow:0 30px 60px rgba(30,30,28,.12)"></div>
  {arch(330, 560, 420, 480, LORRAINE, fx=0.5, fy=0.12)}
  {caption(90, 1060, 900, "Lorraine &middot; Front of House", size=16)}
  <div class="abs label" style="left:90px;top:1112px;width:900px;text-align:center;font-size:18px;color:{C['copper']}">What happens when you call</div>
  {at(170, 1160, numbered(R_STEPS, C['copper'], C['ink'], size=28, gap=18, circle=52), "width:760px")}
  {at(90, 1640, logo('web', 250))}
  {at(560, 1650, cta(CTA_CALL))}"""))
    return page("Signature Smiles | Ray | 9x16", b)


def ray_landscape():
    b = []
    b.append(board("R1l", f"Search bar | Static | Practice frontage | Emergency search | 1.91x1 | {D}", "sl", C['olive'], f"""
  {warm_olive()}
  {photo(640, 0, 560, 628, FRONT, fx=0.5, fy=0.64)}
  <div class="abs" style="left:640px;top:0;width:200px;height:628px;background:linear-gradient(90deg,#424533 0%,rgba(66,69,51,0) 100%)"></div>
  {at(56, 40, logo('web-light', 170))}
  {at(56, 120, search_bar(600, 62, 22))}
  {at(56, 200, result_card(600, .78))}
  {hl(56, 392, "New patients welcome in an emergency.", 34, C['linen'], 560)}
  {at(56, 474, dots(["£95 emergency appointment", "X-ray included"], 'rgba(249,247,245,.9)', 18))}
  {at(56, 530, cta(CTA_CALL, 'linen', 54, 15, 28))}
  {at(330, 546, proof('rgba(249,247,245,.85)', 14))}"""))
    b.append(board("R2l", f"Rung round | Static | Practice reception | New patients welcome | 1.91x1 | {D}", "sl", C['olive'], f"""
  {warm_olive()}
  {photo(600, 0, 600, 628, DESK, fx=0.5, fy=0.42)}
  <div class="abs" style="left:600px;top:0;width:220px;height:628px;background:linear-gradient(90deg,#424533 0%,rgba(66,69,51,0) 100%)"></div>
  {at(56, 40, logo('web-light', 170))}
  {hl(56, 130, "Rung round and nobody can see you?", 52, C['linen'], 560)}
  <div class="abs" style="left:56px;top:270px;width:50px;height:1px;background:{C['terra']}"></div>
  {hl(56, 290, "We regularly see new patients in an emergency.", 28, C['stone'], 520)}
  <div class="abs" style="left:56px;top:380px;display:flex;align-items:baseline;gap:18px"><span class="price" style="font-size:64px;color:{C['linen']}">£95</span>{dots(["X-ray included"], 'rgba(249,247,245,.9)', 18)}</div>
  {at(56, 458, dots(["Same-day appointments where possible"], 'rgba(249,247,245,.9)', 18))}
  {at(56, 530, cta(CTA_CALL, 'linen', 54, 15, 28))}"""))
    b.append(board("R3l", f"What happens | Static | Lorraine front of house | Four steps | 1.91x1 | {D}", "sl", C['sage'], f"""
  {warm_sage()}
  {arch(64, 90, 330, 500, LORRAINE, fx=0.5, fy=0.12)}
  {caption(64, 600, 330, "Lorraine &middot; Front of House", size=12)}
  <div class="abs" style="left:470px;top:40px;width:680px;height:548px;border-radius:28px;background:linear-gradient(175deg,#FFFFFF 0%,{C['linen']} 45%,#F1EDE7 100%);box-shadow:0 24px 50px rgba(30,30,28,.12)"></div>
  {hl(520, 78, "Toothache keeping you up?", 44, C['copper'], 600)}
  <div class="abs label" style="left:520px;top:150px;font-size:13px">What happens when you call</div>
  {at(520, 186, numbered(R_STEPS, C['copper'], C['ink'], size=20, gap=12, circle=40), "width:580px")}
  {at(520, 504, logo('web', 170))}
  {at(790, 508, cta(CTA_CALL, 'olive', 50, 14, 26))}"""))
    return page("Signature Smiles | Ray | 1.91x1", b)


# ---------------------------------------------------------------- CLAIRE (camera-conscious, Smile Makeover)
TOOTH = ('<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="none" stroke="{c}" stroke-width="1.4" stroke-linejoin="round">'
         '<path d="M7.2 3.2c-2.6 0-4.2 2-4.2 4.7 0 2.4 1.1 3.8 1.6 6 .6 2.6.9 6.9 2.9 6.9 1.6 0 1.6-4.6 2.6-6 .5-.7 1.3-.7 1.8 0 1 1.4 1 6 2.6 6 2 0 2.3-4.3 2.9-6.9.5-2.2 1.6-3.6 1.6-6 0-2.7-1.6-4.7-4.2-4.7-1.9 0-2.7 1-4.8 1s-2.9-1-4.8-1z"/></svg>')
ARROW = ('<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
         '<path d="M5 12h14M13 6l6 6-6 6"/></svg>')
CAM_OFF = ('<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="none" stroke="{c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
           '<rect x="2.5" y="6.5" width="13" height="11" rx="2"/><path d="M15.5 10.5l5-3v9l-5-3"/><path d="M3 3l18 18"/></svg>')
MIC = ('<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="none" stroke="{c}" stroke-width="1.8" stroke-linecap="round">'
       '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21"/></svg>')
PIN = ('<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="none" stroke="{c}" stroke-width="1.8">'
       '<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0113 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>')
PROBLEMS = ["Chipped or worn edges", "Small gaps", "Short or uneven teeth"]


def problems(size, gap, line, icon):
    return "".join(
        f'<div style="display:flex;align-items:center;gap:{int(size * .8)}px;padding:{gap}px 0;border-bottom:1px solid {line}">'
        f'{TOOTH.format(s=icon, c=C["copper"])}<span style="font-size:{size}px;font-weight:500;color:{C["ink"]}">{p}</span></div>' for p in PROBLEMS)


def chip(x, y, d, rot=0):
    return (f'<div class="abs" style="left:{x}px;top:{y}px;width:{d}px;height:{d}px;border-radius:50%;background:{C["terra"]};'
            f'display:flex;align-items:center;justify-content:center;transform:rotate({rot}deg);box-shadow:0 12px 26px rgba(135,85,47,.35)">{ARROW.format(s=int(d * .5))}</div>')


def price_line(size, k_small, color=C['copper'], small_color=C['olive']):
    return (f'<div style="display:flex;align-items:baseline;gap:{int(size * .14)}px;white-space:nowrap">'
            f'<span class="hl" style="font-size:{int(size * .42)}px;color:{small_color}">from</span>'
            f'<span class="price" style="font-size:{size}px;color:{color}">£250</span>'
            f'<span class="small" style="font-size:{k_small}px;color:{small_color};font-weight:500">per tooth</span></div>')


def call_window(w, h, k=1.0):
    """A neutral video-call window (no platform branding): three colleagues on camera off, her own tile flagged."""
    pad = int(14 * k)
    th = int((h - int(64 * k) - pad * 3) / 2)
    tw = int((w - pad * 3) / 2)

    def tile(initials, me=False):
        ring = f"border:2px solid {C['terra']};" if me else ""
        tag = (f'<div style="position:absolute;left:{int(12 * k)}px;bottom:{int(10 * k)}px;display:flex;align-items:center;gap:{int(8 * k)}px;'
               f'font-size:{int(15 * k)}px;color:#F3F1EF;font-weight:500">{CAM_OFF.format(s=int(18 * k), c=C["terra"] if me else "#BFB8AB")}'
               f'{"You &middot; Camera off" if me else "Camera off"}</div>')
        return (f'<div style="position:relative;width:{tw}px;height:{th}px;border-radius:{int(12 * k)}px;'
                f'background:radial-gradient(circle at 50% 40%,#3A3A35 0%,#262622 100%);{ring}display:flex;align-items:center;justify-content:center">'
                f'<div style="width:{int(74 * k)}px;height:{int(74 * k)}px;border-radius:50%;background:{"#5A5E47" if me else "#45453F"};'
                f'display:flex;align-items:center;justify-content:center;font-size:{int(26 * k)}px;font-weight:500;color:#F3F1EF;letter-spacing:.04em">{initials}</div>{tag}</div>')

    btn = lambda icon, red=False: (f'<div style="width:{int(42 * k)}px;height:{int(42 * k)}px;border-radius:50%;background:{C["terra"] if red else "#3A3A35"};'
                                   f'display:flex;align-items:center;justify-content:center">{icon}</div>')
    grid = (f'<div style="display:grid;grid-template-columns:{tw}px {tw}px;gap:{pad}px;padding:{pad}px">'
            f'{tile("JM")}{tile("AK")}{tile("RP")}{tile("You", True)}</div>')
    bar = (f'<div style="height:{int(64 * k)}px;display:flex;align-items:center;justify-content:center;gap:{int(16 * k)}px;border-top:1px solid #34342F">'
           f'{btn(MIC.format(s=int(20 * k), c="#F3F1EF"))}{btn(CAM_OFF.format(s=int(20 * k), c="#FFFFFF"), True)}'
           f'<div style="width:{int(84 * k)}px;height:{int(42 * k)}px;border-radius:{int(21 * k)}px;background:#8E3B2E;color:#fff;font-size:{int(14 * k)}px;'
           f'font-weight:600;display:flex;align-items:center;justify-content:center;letter-spacing:.06em">LEAVE</div></div>')
    return (f'<div style="width:{w}px;height:{h}px;border-radius:{int(18 * k)}px;background:#1E1E1C;overflow:hidden;'
            f'box-shadow:0 40px 80px rgba(30,30,28,.32),0 8px 18px rgba(30,30,28,.18);transform:rotate(-1.2deg)">{grid}{bar}</div>')


def arch_card(x, y, w, h, inner, r=None):
    """The site's cream arch card (tone-of-voice page), lit and shadowed."""
    r = r if r is not None else w // 2
    return (f'<div class="abs" style="left:{x + 16}px;top:{y - 16}px;width:{w}px;height:{h}px;border:2px solid {C["stone"]};border-bottom:none;border-radius:{r}px {r}px 0 0"></div>'
            f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;border-radius:{r}px {r}px 0 0;'
            f'background:linear-gradient(175deg,#FFFFFF 0%,{C["linen"]} 45%,#F1EDE7 100%);box-shadow:0 30px 60px rgba(30,30,28,.13),0 6px 14px rgba(30,30,28,.06)">{inner}</div>')


def centre(top, inner, extra=""):
    return f'<div style="position:absolute;left:0;right:0;top:{top}px;display:flex;flex-direction:column;align-items:center;text-align:center;{extra}">{inner}</div>'


def claire_1x1():
    b = []
    b.append(board("K1", f"On display | Static | Type-led | Bonding price | 1x1 | {D}", "s1", C['sage'], f"""
  {warm_sage()}
  {hl(80, 120, "Feel like your teeth are on display every time you speak?", 58, C['copper'], 460)}
  <div class="abs" style="left:80px;top:500px;width:60px;height:1px;background:{C['terra']}"></div>
  {hl(80, 530, "Often it&rsquo;s a small fix.", 36, C['olive'], 440)}
  <div class="abs" style="left:80px;top:610px;display:flex;align-items:center;gap:10px">{PIN.format(s=24, c=C['terra'])}<span class="hl" style="font-size:30px;color:{C['olive']}">Brackley</span></div>
  {at(80, 680, proof(C['sand'], 17))}
  {arch_card(590, 120, 420, 760, centre(250, f'<div class="label">Composite bonding</div><div style="margin-top:26px">{price_line(82, 20)}</div>'
             f'<div style="width:60px;height:1px;background:{C["terra"]};margin:34px 0 30px"></div>'
             f'<div class="body" style="font-size:24px;line-height:1.5;width:320px">Often just one appointment.<br>No drilling or injections in most cases.</div>'))}
  {badge(430, 760, 140)}
  {at(80, 950, logo('web', 230))}
  {at(600, 968, cta(CTA_CONSULT))}"""))
    b.append(board("K2", f"Camera off | Static | Type-led | Video call | 1x1 | {D}", "s1", C['linen'], f"""
  {warm_linen()}
  {hl(80, 90, "Camera off again?", 92, C['copper'], 920)}
  {at(110, 260, call_window(860, 450, 1.25))}
  {hl(80, 770, "Bonding for chipped edges and small gaps.", 40, C['olive'], 920)}
  {at(80, 850, dots(["Often one appointment", "From £250 per tooth", "Free consultation"], C['copper'], 21))}
  {at(80, 950, logo('web', 230))}
  {at(600, 968, cta(CTA_CONSULT))}"""))
    b.append(board("K3", f"Problem and solution | Static | Type-led | Bonding | 1x1 | {D}", "s1", C['linen'], f"""
  {warm_linen()}
  <div class="abs" style="left:520px;top:0;width:560px;height:1080px;background:{C['sage']}"></div>
  <div class="abs label" style="left:80px;top:150px">The problem</div>
  {at(80, 190, problems(27, 30, C['stone'], 44), "width:410px")}
  {at(80, 640, dots(["Free smile makeover consultation"], C['copper'], 20))}
  {at(80, 690, proof(C['sand'], 17))}
  {arch_card(590, 140, 420, 740, centre(240, f'<div class="label">The solution</div>'
             f'<div class="hl" style="font-size:54px;margin-top:22px;line-height:1.05">Composite<br>bonding</div>'
             f'<div style="margin-top:26px">{price_line(74, 19)}</div>'
             f'<div style="width:60px;height:1px;background:{C["terra"]};margin:30px 0 26px"></div>'
             f'<div class="body" style="font-size:22px;line-height:1.5;width:320px">Shade-matched to your own teeth. No drilling or injections in most cases.</div>'))}
  {chip(488, 330, 64)}
  {at(80, 950, logo('web', 230))}
  {at(600, 968, cta(CTA_CONSULT))}"""))
    return page("Signature Smiles | Claire | 1x1", b)


def claire_9x16():
    b = []
    b.append(board("K1s", f"On display | Static | Type-led | Bonding price | 9x16 | {D}", "s9", C['sage'], f"""
  {warm_sage()}
  {hl(90, 280, "Feel like your teeth are on display every time you speak?", 76, C['copper'], 900)}
  {arch_card(190, 690, 700, 760, centre(260, f'<div class="label" style="font-size:21px">Composite bonding</div><div style="margin-top:28px">{price_line(140, 30)}</div>'
             f'<div style="width:70px;height:1px;background:{C["terra"]};margin:38px 0 32px"></div>'
             f'<div class="body" style="font-size:30px;line-height:1.5">Often just one appointment.<br>No drilling or injections in most cases.</div>'))}
  {badge(90, 600, 170)}
  {at(90, 1490, cta(CTA_CONSULT, 'olive', 72, 20, 42))}
  <div class="abs" style="left:660px;top:1508px;display:flex;align-items:center;gap:10px">{PIN.format(s=26, c=C['terra'])}<span class="hl" style="font-size:34px;color:{C['olive']}">Brackley</span></div>
  {at(90, 1640, logo('web', 250))}"""))
    b.append(board("K2s", f"Camera off | Static | Type-led | Video call | 9x16 | {D}", "s9", C['linen'], f"""
  {warm_linen()}
  {hl(90, 280, "Camera off again?", 110, C['copper'], 900)}
  {at(110, 470, call_window(860, 640, 1.4))}
  {hl(90, 1190, "Bonding for chipped edges and small gaps.", 56, C['olive'], 900)}
  {at(90, 1340, dots(["Often one appointment", "From £250 per tooth"], C['copper'], 26))}
  {at(90, 1400, dots(["Free smile makeover consultation"], C['ink'], 24))}
  {at(90, 1480, cta(CTA_CONSULT, 'olive', 72, 20, 42))}
  {at(90, 1640, logo('web', 250))}"""))
    b.append(board("K3s", f"Problem and solution | Static | Type-led | Bonding | 9x16 | {D}", "s9", C['linen'], f"""
  {warm_linen()}
  <div class="abs" style="left:0;top:760px;width:1080px;height:1160px;background:{C['sage']}"></div>
  <div class="abs label" style="left:90px;top:280px;font-size:21px">The problem</div>
  {at(90, 320, problems(36, 28, C['stone'], 54), "width:900px")}
  {chip(508, 726, 68, 90)}
  {arch_card(190, 850, 700, 720, centre(230, f'<div class="label" style="font-size:20px">The solution</div>'
             f'<div class="hl" style="font-size:76px;margin-top:22px">Composite bonding</div>'
             f'<div style="margin-top:22px">{price_line(100, 26)}</div>'
             f'<div class="body" style="font-size:27px;line-height:1.5;margin-top:30px;width:560px">Shade-matched to your own teeth. No drilling or injections in most cases.</div>'))}
  {at(90, 1640, logo('web', 230))}
  {at(560, 1650, cta(CTA_CONSULT))}"""))
    return page("Signature Smiles | Claire | 9x16", b)


def claire_landscape():
    b = []
    b.append(board("K1l", f"On display | Static | Type-led | Bonding price | 1.91x1 | {D}", "sl", C['sage'], f"""
  {warm_sage()}
  {at(56, 40, logo('web', 170))}
  {hl(56, 130, "Feel like your teeth are on display every time you speak?", 46, C['copper'], 560)}
  {at(56, 400, dots(["Brackley", "Free consultation"], C['olive'], 18))}
  {at(56, 520, cta(CTA_CONSULT, 'olive', 54, 15, 28))}
  {arch_card(730, 80, 400, 548, centre(170, f'<div class="label" style="font-size:15px">Composite bonding</div><div style="margin-top:18px">{price_line(66, 16)}</div>'
             f'<div style="width:50px;height:1px;background:{C["terra"]};margin:26px 0 22px"></div>'
             f'<div class="body" style="font-size:19px;line-height:1.5">Often just one appointment.<br>No drilling or injections<br>in most cases.</div>'))}"""))
    b.append(board("K2l", f"Camera off | Static | Type-led | Video call | 1.91x1 | {D}", "sl", C['linen'], f"""
  {warm_linen()}
  {at(56, 40, logo('web', 170))}
  {hl(56, 120, "Camera off again?", 62, C['copper'], 520)}
  {hl(56, 230, "Bonding for chipped edges and small gaps.", 32, C['olive'], 480)}
  {at(56, 350, dots(["Often one appointment"], C['copper'], 18))}
  {at(56, 392, dots(["From £250 per tooth"], C['copper'], 18))}
  {at(56, 520, cta(CTA_CONSULT, 'olive', 54, 15, 28))}
  {at(610, 90, call_window(540, 440, .9))}"""))
    b.append(board("K3l", f"Problem and solution | Static | Type-led | Bonding | 1.91x1 | {D}", "sl", C['linen'], f"""
  {warm_linen()}
  <div class="abs" style="left:470px;top:0;width:730px;height:628px;background:{C['sage']}"></div>
  {at(56, 40, logo('web', 160))}
  <div class="abs label" style="left:56px;top:140px;font-size:14px">The problem</div>
  {at(56, 170, problems(22, 20, C['stone'], 34), "width:350px")}
  {at(56, 420, proof(C['sand'], 14))}
  {chip(442, 240, 56)}
  {arch_card(560, 70, 380, 558, centre(150, f'<div class="label" style="font-size:14px">The solution</div>'
             f'<div class="hl" style="font-size:46px;margin-top:14px;line-height:1.05">Composite<br>bonding</div>'
             f'<div style="margin-top:16px">{price_line(56, 14)}</div>'
             f'<div class="body" style="font-size:16px;line-height:1.5;margin-top:18px;width:280px">No drilling or injections in most cases.</div>'))}
  {at(56, 520, cta(CTA_CONSULT, 'olive', 54, 15, 28))}"""))
    return page("Signature Smiles | Claire | 1.91x1", b)


BUILDERS = {"ray": (ray_1x1, ray_9x16, ray_landscape), "claire": (claire_1x1, claire_9x16, claire_landscape)}

if __name__ == "__main__":
    for p in sys.argv[1:] or BUILDERS:
        one, nine, land = BUILDERS[p]
        (ROOT / f"{p}-1x1.html").write_text(one())
        (ROOT / f"{p}-9x16.html").write_text(nine())
        (ROOT / f"{p}-landscape.html").write_text(land())
        print("built", p)
