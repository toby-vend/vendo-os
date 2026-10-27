"""Build DK Dental Practice Meta static harness pages (one HTML page per persona per size).

Usage: python3 build.py   -> writes <persona>-1x1.html, <persona>-9x16.html, <persona>-landscape.html, <persona>-all.html
Brand: no guideline, so everything comes from dkdentalpractice.com (Elementor kit post-6.css):
  gold #A88C61, light gold #CFB68F, sand #E7E1D9, cream #F9F7F5, ink #1F1F1F.
  Canela (the site self-hosts the Trial cut) for headlines, DM Sans for body and uppercase labels.
  Site devices: gold pill buttons with an arrow, 20px-radius images with thin gold borders, tooth line mark.
Copy: copy-<persona>.md. Photos: assets/photos (gitignored). No stock: M1 is type-led (lit wall + paper note),
M2 uses DK's own March 2026 shoot (Drive 'DK March 23rd 2026/Pictures'), M3 the practice's waiting room photo from the site.
"""
from pathlib import Path

ROOT = Path(__file__).parent

GOLD, GOLD_L, SAND, CREAM, INK, DEEP = "#A88C61", "#CFB68F", "#E7E1D9", "#F9F7F5", "#1F1F1F", "#151412"
DATE = "261027"

GRAIN = ("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>"
         "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.9 0'/></filter>"
         "<rect width='100%' height='100%' filter='url(%23n)'/></svg>")

FONTS_LINK = "https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&display=swap"

CSS = f"""
@font-face {{ font-family: 'Canela Trial'; src: url(assets/fonts/Canela-Light-Trial.woff); font-weight: 300; }}
@font-face {{ font-family: 'Canela Trial'; src: url(assets/fonts/Canela-LightItalic-Trial.woff); font-weight: 300; font-style: italic; }}
@font-face {{ font-family: 'Canela Trial'; src: url(assets/fonts/Canela-Regular-Trial.woff); font-weight: 400; }}
@font-face {{ font-family: 'Canela Trial'; src: url(assets/fonts/Canela-RegularItalic-Trial.woff); font-weight: 400; font-style: italic; }}
@font-face {{ font-family: 'Canela Trial'; src: url(assets/fonts/Canela-Medium-Trial.woff); font-weight: 500; }}
@font-face {{ font-family: 'DM Sans'; src: url(assets/fonts/DMSans-Variable.ttf); font-weight: 100 1000; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ background: #3a3a3a; font-family: 'DM Sans', sans-serif; display: flex; gap: 80px; padding: 80px; align-items: flex-start; }}
.ab {{ position: relative; overflow: hidden; flex: none; color: {INK}; }}
.s1 {{ width: 1080px; height: 1080px; }}
.s9 {{ width: 1080px; height: 1920px; }}
.sl {{ width: 1200px; height: 628px; }}
.abs {{ position: absolute; }}
.grain {{ position: absolute; inset: 0; background-image: url("{GRAIN}"); background-size: 300px; opacity: .14; mix-blend-mode: overlay; pointer-events: none; }}
.hl {{ font-family: 'Canela Trial', Georgia, serif; font-weight: 300; line-height: 1.04; letter-spacing: -.01em; }}
.hl i {{ font-style: italic; color: {GOLD_L}; }}
.hl.onlight i {{ color: {GOLD}; }}
.eyebrow {{ font-family: 'DM Sans', sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: .14em; }}
.body {{ font-size: 30px; line-height: 1.4; }}
.hand {{ font-family: Caveat, cursive; font-weight: 700; }}
.cta {{ display: inline-flex; align-items: center; gap: 18px; height: 78px; padding: 0 44px; border-radius: 500px; background: {GOLD}; color: #fff;
        font-family: 'DM Sans', sans-serif; font-size: 22px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
        box-shadow: 0 14px 30px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.25); white-space: nowrap; }}
.price {{ font-family: 'Canela Trial', Georgia, serif; font-weight: 300; letter-spacing: -.03em; line-height: .9; }}
img.logo {{ display: block; height: auto; }}
"""

ARROW = ('<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="none" stroke="currentColor" stroke-width="2.2" '
         'stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>')
PIN = ('<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="{c}"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.6a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2z"/></svg>')


def page(title, boards):
    return (f"<!doctype html><html lang='en-GB'><head><meta charset='utf-8'><title>{title}</title>"
            f"<link rel='stylesheet' href='{FONTS_LINK}'><style>{CSS}</style>"
            f"<script src='https://mcp.figma.com/mcp/html-to-design/capture.js' async></script></head>"
            f"<body>{''.join(boards)}</body></html>")


def logo(x, y, w, tone="light"):
    return f'<img class="logo abs" data-name="Logo" src="assets/logo-{tone}.svg" style="left:{x}px;top:{y}px;width:{w}px">'


def cta(x, y, label="Book your check-up", scale=1.0):
    f = lambda v: f"{v * scale:.0f}"
    st = f"height:{f(78)}px;padding:0 {f(44)}px;font-size:{f(22)}px;gap:{f(18)}px"
    return (f'<div class="abs" data-name="Button" style="left:{x}px;top:{y}px"><span class="cta" style="{st}">{label}'
            f'{ARROW.format(s=f(26))}</span></div>')


def inline_cta(scale, label="Book your check-up"):
    f = lambda v: f"{v * scale:.0f}"
    return (f'<span class="cta" data-name="Button" style="height:{f(78)}px;padding:0 {f(44)}px;font-size:{f(22)}px;gap:{f(18)}px">{label}'
            f'{ARROW.format(s=f(26))}</span>')


def photo(img, x=0, y=0, w=None, h=None, pos="50% 50%", extra=""):
    """Cover-cropped photo: CSS cover keeps the source aspect, never stretches."""
    box = f"left:{x}px;top:{y}px;width:{w}px;height:{h}px;" if w else "inset:0;"
    return (f'<div class="abs" data-name="Photo" style="{box}background-image:url(assets/photos/{img});'
            f'background-size:cover;background-position:{pos};{extra}"></div>')


def board(cid, name, size, bg, inner):
    cls = {"1x1": "s1", "9x16": "s9", "1.91x1": "sl"}[size]
    label = {"1x1": "1x1", "9x16": "9x16", "1.91x1": "1.91x1"}[size]
    return (f'<div class="ab {cls}" id="{cid}-{size}" data-name="{name} | {label} | {DATE}" style="background:{bg}">'
            f'{inner}<div class="grain" data-name="Grain"></div></div>')


# ---------------------------------------------------------------- shared objects

def note(x, y, w, h, rot, fs, items, title="to do"):
    """Taped paper to-do note. items: list of (text, state) with state in 'done', 'open'."""
    rows = []
    for t, st in items:
        if st == "done":
            rows.append(f'<div style="height:{fs * 1.45:.0f}px;color:#5b6573"><span style="font-size:.8em;margin-right:{fs * .3:.0f}px">&#10003;</span>'
                        f'<span style="text-decoration:line-through;text-decoration-thickness:{fs * .07:.0f}px">{t}</span></div>')
        else:
            rows.append(f'<div style="height:{fs * 1.45:.0f}px;color:#1b2a55;padding-left:{fs * .3:.0f}px">'
                        f'<span style="position:relative;display:inline-block">{t}'
                        f'<span style="position:absolute;left:-{fs * .35:.0f}px;right:-{fs * .35:.0f}px;top:-{fs * .18:.0f}px;bottom:-{fs * .22:.0f}px;'
                        f'border:{fs * .08:.0f}px solid {GOLD};border-radius:50%;transform:rotate(-3deg)"></span></span>'
                        f'<span style="font-size:.62em;color:#5b6573;margin-left:{fs * .55:.0f}px">(again)</span></div>')
    line = fs * 1.45
    lines_bg = f"repeating-linear-gradient(180deg,transparent 0,transparent {line - 2:.0f}px,#c9d3e0 {line - 2:.0f}px,#c9d3e0 {line:.0f}px)"
    return f"""
<div class="abs" data-name="Note" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;transform:rotate({rot}deg);
     background:#fbf9f3;border-radius:4px;box-shadow:0 40px 70px rgba(0,0,0,.5),0 10px 18px rgba(0,0,0,.3)">
  <div class="abs" style="inset:0;border-radius:4px;background:radial-gradient(circle at 25% 8%,rgba(255,255,255,.8),transparent 55%),linear-gradient(180deg,rgba(0,0,0,0) 65%,rgba(80,60,30,.07))"></div>
  <div class="abs" data-name="Tape" style="left:{w * .32:.0f}px;top:-{fs * .55:.0f}px;width:{w * .36:.0f}px;height:{fs * 1.15:.0f}px;background:rgba(207,182,143,.72);
       transform:rotate(-2.5deg);box-shadow:0 2px 4px rgba(0,0,0,.12)"></div>
  <div class="abs" style="left:{fs * 1.5:.0f}px;top:0;bottom:0;width:2px;background:#e3a9a3"></div>
  <div class="abs hand" style="left:{fs * 1.9:.0f}px;top:{fs * .7:.0f}px;font-size:{fs * 1.1:.0f}px;color:#1b2a55">{title}</div>
  <div class="abs hand" style="left:{fs * 1.9:.0f}px;right:{fs:.0f}px;top:{fs * 2.25:.0f}px;font-size:{fs}px;line-height:{line:.0f}px;background:{lines_bg}">
    {''.join(rows)}
  </div>
</div>"""


NOTE_ITEMS = [("car MOT", "done"), ("renew passport", "done"), ("book dentist", "open")]


def steps_card(x, y, w, fs, items, price_fs, pad=44, btn_scale=None, gap=None):
    gap = gap or fs * .95
    rows = "".join(
        f'<div style="display:flex;gap:{fs * .8:.0f}px;align-items:baseline;padding:{gap / 2:.0f}px 0;border-bottom:1px solid rgba(168,140,97,.28)">'
        f'<span class="price" style="flex:none;width:{fs * 1.1:.0f}px;font-size:{fs * 1.5:.0f}px;color:{GOLD}">{i + 1}</span>'
        f'<span style="font-size:{fs}px;line-height:1.3;color:{INK}">{t}</span></div>'
        for i, t in enumerate(items))
    return f"""
<div class="abs" data-name="Steps card" style="left:{x}px;top:{y}px;width:{w}px;padding:{pad}px {pad}px {pad * .9:.0f}px;background:{CREAM};border-radius:20px;
     border:2px solid {GOLD_L};box-shadow:0 40px 80px rgba(0,0,0,.45),0 10px 20px rgba(0,0,0,.25)">
  <div class="eyebrow" style="font-size:{fs * .62:.0f}px;color:{GOLD};margin-bottom:{fs * .3:.0f}px">Your first visit</div>
  <div>{rows}</div>
  <div style="display:flex;align-items:center;justify-content:space-between;margin-top:{fs * .9:.0f}px">
    <div><span class="price" style="font-size:{price_fs}px;color:{INK}">&pound;75</span>
      <div class="eyebrow" style="font-size:{fs * .5:.0f}px;color:#6b645a;margin-top:{fs * .3:.0f}px">New patient check-up</div></div>
    {inline_cta(btn_scale) if btn_scale else ""}
  </div>
</div>"""


# ---------------------------------------------------------------- MARK, THE LAPSED PATIENT

M1_SUB = "One &pound;75 check-up and you&rsquo;ll know exactly where you stand."
M1_MECH = "Exam, X-rays and a written plan with full costs."


def wall():
    """Lit plaster wall in brand sand/cream: warm key light top left, falloff to the corners."""
    return (f'<div class="abs" style="inset:0;background:radial-gradient(ellipse at 28% 18%,#fbf8f2 0%,{SAND} 48%,#cdbfa9 100%)"></div>'
            f'<div class="abs" style="inset:0;opacity:.5;background:repeating-linear-gradient(97deg,rgba(255,255,255,.05) 0,rgba(255,255,255,.05) 3px,transparent 3px,transparent 11px),'
            f'repeating-linear-gradient(7deg,rgba(90,70,40,.04) 0,rgba(90,70,40,.04) 1px,transparent 1px,transparent 17px)"></div>'
            f'<div class="abs" style="inset:0;background:radial-gradient(circle at 80% 85%,rgba(60,45,25,.22),transparent 55%)"></div>')


def m1(size):
    name = "General Patients | Static | No talent | Still on the list"
    if size == "1x1":
        inner = f"""
{wall()}
<div class="abs hl onlight" style="left:72px;top:76px;font-size:104px;color:{INK}">Still on<br><i>the list?</i></div>
{note(560, 250, 450, 420, 3.5, 46, NOTE_ITEMS)}
<div class="abs body" style="left:72px;top:776px;width:600px;color:{INK}">{M1_SUB}</div>
<div class="abs" style="left:72px;top:870px;font-size:24px;color:#7a6440">{M1_MECH}</div>
{cta(72, 942)}
{logo(782, 950, 230, 'dark')}"""
    elif size == "9x16":
        inner = f"""
{wall()}
{logo(80, 262, 260, 'dark')}
<div class="abs hl onlight" style="left:80px;top:400px;font-size:128px;color:{INK}">Still on<br><i>the list?</i></div>
{note(250, 760, 700, 540, 3, 64, NOTE_ITEMS)}
<div class="abs body" style="left:80px;top:1340px;width:900px;font-size:36px;color:{INK}">{M1_SUB}</div>
<div class="abs" style="left:80px;top:1440px;font-size:28px;color:#7a6440">{M1_MECH}</div>
{cta(80, 1494, scale=.95)}"""
    else:
        inner = f"""
{wall()}
<div class="abs hl onlight" style="left:56px;top:56px;font-size:78px;color:{INK}">Still on<br><i>the list?</i></div>
<div class="abs body" style="left:56px;top:262px;width:430px;font-size:25px;color:{INK}">{M1_SUB}</div>
<div class="abs" style="left:56px;top:350px;width:430px;font-size:20px;color:#7a6440">{M1_MECH}</div>
{cta(56, 420, scale=.8)}
{logo(56, 540, 190, 'dark')}
{note(640, 110, 470, 400, 3.5, 44, NOTE_ITEMS)}"""
    return board("M1", name, size, SAND, inner)


M2_SPEC = "Exam, X-rays, oral cancer screening and a written plan with full costs."
ADDRESS = "33 The Esplanade, Weymouth"


def offer_panel(fs, price_fs):
    """Left column of the VT-06 offer panel."""
    return (f'<div class="eyebrow" style="font-size:{fs * .62:.0f}px;color:{GOLD_L}">New patient check-up</div>'
            f'<div class="hl" style="font-size:{fs * 1.55:.0f}px;color:{CREAM};margin-top:{fs * .45:.0f}px"><i style="color:{CREAM}">Know the cost before</i><br>anything starts</div>'
            f'<div class="price" style="font-size:{price_fs}px;color:{GOLD_L};margin-top:{fs * .55:.0f}px">&pound;75</div>')


def address(x, y, fs, w, center=True):
    return (f'<div class="abs" data-name="Address footer" style="left:{x}px;top:{y}px;width:{w}px;display:flex;gap:{fs * .5:.0f}px;align-items:center;'
            f'justify-content:{"center" if center else "flex-start"};font-size:{fs}px;color:{CREAM};letter-spacing:.02em">'
            f'{PIN.format(s=round(fs * 1.2), c=GOLD_L)}{ADDRESS}</div>')


def m2(size):
    name = "General Patients | Static | No talent | Know the cost first"
    hook = 'Put off by what<br>it <i>might cost?</i>'
    if size == "1x1":
        inner = f"""
<div class="abs" style="inset:0;background:{DEEP}"></div>
<div class="abs hl" style="left:64px;top:44px;font-size:68px;color:{CREAM}">Put off by what it <i>might cost?</i></div>
{photo('exam-wide.jpg', 0, 150, 1080, 440, '50% 55%')}
<div class="abs" style="left:0;top:150px;width:1080px;height:440px;background:linear-gradient(180deg,{DEEP} 0%,rgba(21,20,18,0) 14%,rgba(21,20,18,0) 85%,rgba(21,20,18,.6) 100%)"></div>
<div class="abs" style="left:0;top:590px;width:1080px;height:490px;background:linear-gradient(180deg,{INK},{DEEP})"></div>
<div class="abs" style="left:0;top:590px;width:1080px;height:3px;background:{GOLD}"></div>
<div class="abs" style="left:64px;top:626px;width:560px">{offer_panel(30, 140)}</div>
<div class="abs" style="left:64px;top:912px;width:580px;font-size:22px;line-height:1.38;color:{SAND}">{M2_SPEC}</div>
<div class="abs" style="left:670px;top:636px;width:1px;height:330px;background:rgba(207,182,143,.35)"></div>
{logo(716, 660, 290)}
{cta(716, 820, scale=.72)}
<div class="abs" style="left:64px;top:1012px;width:952px;height:1px;background:rgba(207,182,143,.3)"></div>
{address(0, 1030, 21, 1080)}"""
    elif size == "9x16":
        inner = f"""
<div class="abs" style="left:0;top:0;width:1080px;height:1920px;background:linear-gradient(180deg,{DEEP},{INK} 30%,{DEEP})"></div>
<div class="abs hl" style="left:80px;top:262px;font-size:100px;color:{CREAM}">{hook}</div>
{photo('exam-tall.jpg', 0, 520, 1080, 560, '50% 47%')}
<div class="abs" style="left:0;top:520px;width:1080px;height:560px;background:linear-gradient(180deg,rgba(21,20,18,.55) 0%,rgba(21,20,18,0) 22%,rgba(21,20,18,0) 80%,rgba(21,20,18,.5) 100%)"></div>
<div class="abs" style="left:0;top:1080px;width:1080px;height:3px;background:{GOLD}"></div>
<div class="abs" style="left:80px;top:1120px;width:600px">{offer_panel(34, 170)}</div>
<div class="abs" style="left:700px;top:1130px;width:1px;height:300px;background:rgba(207,182,143,.35)"></div>
{logo(740, 1150, 260)}
{address(740, 1330, 21, 300, center=False)}
<div class="abs" style="left:80px;top:1448px;width:920px;font-size:27px;line-height:1.38;color:{SAND}">{M2_SPEC}</div>
{cta(80, 1500, scale=.9)}"""
    else:
        inner = f"""
{photo('exam-tall.jpg', 0, 0, 560, 628, '50% 62%')}
<div class="abs" style="left:0;top:0;width:560px;height:628px;background:linear-gradient(180deg,rgba(21,20,18,.9) 0%,rgba(21,20,18,.55) 26%,rgba(21,20,18,0) 45%)"></div>
<div class="abs hl" style="left:40px;top:40px;font-size:50px;color:{CREAM}">{hook}</div>
<div class="abs" style="left:560px;top:0;width:640px;height:628px;background:linear-gradient(180deg,{INK},{DEEP})"></div>
<div class="abs" style="left:560px;top:0;width:3px;height:628px;background:{GOLD}"></div>
<div class="abs" style="left:610px;top:44px;width:560px">{offer_panel(26, 130)}</div>
<div class="abs" style="left:610px;top:340px;width:540px;font-size:19px;line-height:1.4;color:{SAND}">{M2_SPEC}</div>
{cta(610, 420, scale=.76)}
{logo(990, 540, 170)}
{address(610, 562, 17, 360, center=False)}"""
    return board("M2", name, size, DEEP, inner)


M3_STEPS = ["A chat about you and any worries", "A full exam and digital X-rays", "An oral cancer screening",
            "A written plan with full costs. <b style='font-weight:600'>You decide.</b>"]
M3_HL = 'Been a few years?<br><i>Here&rsquo;s your first visit.</i>'


def m3(size):
    name = "General Patients | Static | No talent | Your first visit"
    if size == "1x1":
        inner = f"""
{photo('waiting-room.webp', pos='75% 100%', extra='background-size:2400px auto')}
<div class="abs" style="inset:0;background:linear-gradient(180deg,rgba(21,20,18,.9) 0%,rgba(21,20,18,.55) 30%,rgba(21,20,18,.05) 55%,rgba(21,20,18,.35) 100%)"></div>
{logo(72, 64, 220)}
<div class="abs hl" style="left:72px;top:156px;font-size:72px;color:{CREAM}">{M3_HL}</div>
{steps_card(72, 400, 560, 24, M3_STEPS, 84, pad=34, gap=18, btn_scale=.62)}"""
    elif size == "9x16":
        inner = f"""
<div class="abs" style="inset:0;background:{DEEP}"></div>
{photo('waiting-room.webp', 0, 560, 1080, 760, '100% 100%', 'background-size:2200px auto')}
<div class="abs" style="left:0;top:560px;width:1080px;height:760px;background:linear-gradient(180deg,{DEEP} 0%,rgba(21,20,18,0) 22%,rgba(21,20,18,0) 70%,{DEEP} 100%)"></div>
{logo(80, 262, 260)}
<div class="abs hl" style="left:80px;top:390px;font-size:96px;color:{CREAM}">{M3_HL}</div>
{steps_card(80, 1040, 920, 32, M3_STEPS, 104, pad=44, gap=20, btn_scale=.82)}"""
    else:
        inner = f"""
{photo('waiting-room.webp', 0, 0, 640, 628, '100% 50%')}
<div class="abs" style="left:0;top:0;width:640px;height:628px;background:linear-gradient(180deg,rgba(21,20,18,.9) 0%,rgba(21,20,18,.5) 40%,rgba(21,20,18,.1) 65%,rgba(21,20,18,.6) 100%)"></div>
{logo(44, 40, 180)}
<div class="abs hl" style="left:44px;top:120px;font-size:52px;color:{CREAM}">{M3_HL}</div>
<div class="abs" style="left:640px;top:0;width:560px;height:628px;background:{DEEP}"></div>
{steps_card(600, 36, 560, 21, M3_STEPS, 74, pad=30, gap=14, btn_scale=.6)}"""
    return board("M3", name, size, DEEP, inner)


PERSONAS = {"mark": [m1, m2, m3]}

if __name__ == "__main__":
    for key, fns in PERSONAS.items():
        rows = []
        for size, suffix in (("1x1", "1x1"), ("9x16", "9x16"), ("1.91x1", "landscape")):
            boards = [f(size) for f in fns]
            (ROOT / f"{key}-{suffix}.html").write_text(page(f"DK Dental | {key} | {size}", boards))
            rows.append(f'<div class="row" data-name="{size}" style="display:flex;gap:80px;margin-bottom:{720 if size == "1x1" else 120}px">{"".join(boards)}</div>')
        # One page per persona for the Figma capture; the gap under the 1:1 row leaves room for the copy cards.
        (ROOT / f"{key}-all.html").write_text(page(f"DK Dental | {key}", rows).replace("<body>", '<body style="display:block">'))
    print("built")
