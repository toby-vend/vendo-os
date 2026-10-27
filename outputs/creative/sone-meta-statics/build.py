"""Build Sone Productions Meta static harness pages (one HTML page per persona per size).

Usage: python3 build.py            -> writes <persona>-1x1.html, <persona>-9x16.html, <persona>-landscape.html
Brand: Sone 2026 brand sheet (Drive "S_2026_Brand_Sheet_Update.pdf"). Yellow #FCDA43, black, stone #F7F5EF.
Fonts: RL Horizon (headlines, lowercase) and Komet (body). Only partial copies extracted from the brand sheet PDF
are available (assets/fonts), so glyphs they lack (e.g. £, N, P) fall back to Zilla Slab / Fira Sans.
CSS families are named "RL Horizon" and "Komet" so Figma resolves to the real fonts once they're installed.
Copy: copy-<persona>.md. Photos: assets/photos (gitignored), real Sone shoot stills only.
"""
from pathlib import Path

ROOT = Path(__file__).parent

Y, K, S, INK, GREY = "#FCDA43", "#000000", "#F7F5EF", "#151515", "#2a2a2a"
DATE = "261026"
DOT = f'<span style="color:{Y}">.</span>'

GRAIN = ("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>"
         "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.9 0'/></filter>"
         "<rect width='100%' height='100%' filter='url(%23n)'/></svg>")

FONTS_LINK = ("https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Fira+Sans:wght@400;600"
              "&family=Zilla+Slab:wght@700&display=swap")

CSS = f"""
@font-face {{ font-family: 'RL Horizon'; src: url(assets/fonts/RLHorizonSubset-Bold.otf); font-weight: 700; }}
@font-face {{ font-family: 'RL Horizon'; src: url(assets/fonts/RLHorizonSubset-Regular.otf); font-weight: 400; }}
@font-face {{ font-family: Komet; src: url(assets/fonts/Komet-Regular.ttf); font-weight: 400; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ background: #3a3a3a; font-family: Komet, 'Fira Sans', sans-serif; display: flex; gap: 80px; padding: 80px; align-items: flex-start; }}
.ab {{ position: relative; overflow: hidden; flex: none; color: {INK}; }}
.s1 {{ width: 1080px; height: 1080px; }}
.s9 {{ width: 1080px; height: 1920px; }}
.sl {{ width: 1200px; height: 628px; }}
.abs {{ position: absolute; }}
.cover {{ position: absolute; inset: 0; background-size: cover; background-position: center; }}
.grain {{ position: absolute; inset: 0; background-image: url("{GRAIN}"); background-size: 300px; opacity: .12; mix-blend-mode: overlay; pointer-events: none; }}
.hl {{ font-family: 'RL Horizon', 'Zilla Slab', serif; font-weight: 700; line-height: .98; letter-spacing: -.01em; }}
.lab {{ font-family: 'RL Horizon', 'Zilla Slab', serif; font-weight: 700; letter-spacing: 0; }}
.body {{ font-size: 30px; line-height: 1.38; }}
.hand {{ font-family: Caveat, cursive; font-weight: 700; }}
.dot {{ display: inline-block; width: .3em; height: .27em; border-radius: .07em; background: {Y}; margin-left: .05em; vertical-align: baseline; }}
.cta {{ display: inline-flex; align-items: center; height: 74px; padding: 0 40px; border-radius: 999px; background: {Y}; color: {K};
        font-family: Komet, 'Fira Sans', sans-serif; font-size: 28px; font-weight: 700; letter-spacing: .01em; box-shadow: 0 10px 24px rgba(0,0,0,.25); }}
.cta.dark {{ background: {K}; color: {S}; }}
.price {{ font-family: 'RL Horizon', 'Zilla Slab', serif; font-weight: 700; letter-spacing: -.02em; line-height: 1; }}
img.logo {{ display: block; height: auto; }}
"""


def page(title, boards):
    return (f"<!doctype html><html lang='en-GB'><head><meta charset='utf-8'><title>{title}</title>"
            f"<link rel='stylesheet' href='{FONTS_LINK}'><style>{CSS}</style>"
            f"<script src='https://mcp.figma.com/mcp/html-to-design/capture.js' async></script></head>"
            f"<body>{''.join(boards)}</body></html>")


def hl(text):
    """Lowercase headline; a trailing full stop is set in Sone yellow."""
    return text[:-1] + DOT if text.endswith(".") else text


def logo(x, y, w, dark_bg=True):
    f = "sone-wordmark-stone-mustard.png" if dark_bg else "sone-wordmark-black-mustard.png"
    return f'<img class="logo abs" data-name="Logo" src="assets/logos/{f}" style="left:{x}px;top:{y}px;width:{w}px">'


def cta(x, y, label="Book a discovery call", scale=1.0, dark=False):
    st = f"height:{74 * scale:.0f}px;padding:0 {40 * scale:.0f}px;font-size:{28 * scale:.0f}px" if scale != 1 else ""
    return f'<div class="abs" data-name="Button" style="left:{x}px;top:{y}px"><span class="cta{" dark" if dark else ""}" style="{st}">{label}</span></div>'


def photo(img, x=0, y=0, w=None, h=None, pos="50% 50%", extra=""):
    """Cover-cropped photo (CSS cover keeps the real aspect, never stretches)."""
    box = f"left:{x}px;top:{y}px;width:{w}px;height:{h}px;" if w else "inset:0;"
    return (f'<div class="abs" data-name="Photo" style="{box}background-image:url(assets/photos/{img});'
            f'background-size:cover;background-position:{pos};{extra}"></div>')


def board(cid, name, size, bg, inner):
    cls = {"1x1": "s1", "9x16": "s9", "1.91x1": "sl"}[size]
    return (f'<div class="ab {cls}" id="{cid}-{size}" data-name="{name} | {size} | {DATE}" style="background:{bg}">'
            f'{inner}<div class="grain" data-name="Grain"></div></div>')


# ---------------------------------------------------------------- shared objects

def notepad(x, y, w, h, rot, lines, title="this week", fs=46):
    """Lined notepad with yellow tape and handwritten items. lines: list of (text, style) where style in
    '', 'done', 'carried'."""
    rows = []
    for t, st in lines:
        if st == "done":
            rows.append(f'<div style="height:{fs * 1.5:.0f}px;color:#5b6470"><span style="font-size:.8em;margin-right:14px">&#10003;</span>'
                        f'<span style="text-decoration:line-through;text-decoration-thickness:3px">{t}</span></div>')
        elif st == "carried":
            rows.append(f'<div style="height:{fs * 1.5:.0f}px;color:#1d2a6b">'
                        f'<span style="position:relative;display:inline-block">{t}'
                        f'<span style="position:absolute;left:-14px;right:-14px;top:-10px;bottom:-12px;border:4px solid #c8261d;border-radius:50%;transform:rotate(-2deg)"></span></span></div>')
        else:
            rows.append(f'<div style="height:{fs * 1.5:.0f}px;color:#1d2a6b">{t}</div>')
    line_bg = (f"repeating-linear-gradient(180deg,transparent 0,transparent {fs * 1.5 - 2:.0f}px,#b9cbe0 {fs * 1.5 - 2:.0f}px,#b9cbe0 {fs * 1.5:.0f}px)")
    return f"""
<div class="abs" data-name="Notepad" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;transform:rotate({rot}deg);
     background:#fbf8ef;border-radius:6px;box-shadow:0 40px 70px rgba(0,0,0,.5),0 10px 18px rgba(0,0,0,.3)">
  <div class="abs" style="left:0;top:0;right:0;height:100%;background:radial-gradient(circle at 30% 10%,rgba(255,255,255,.7),transparent 60%),linear-gradient(180deg,rgba(0,0,0,0) 70%,rgba(0,0,0,.06))"></div>
  <div class="abs" style="left:{w * .3:.0f}px;top:-26px;width:{w * .4:.0f}px;height:58px;background:rgba(252,218,67,.78);transform:rotate(-2deg);box-shadow:0 2px 4px rgba(0,0,0,.12)" data-name="Tape"></div>
  <div class="abs" style="left:70px;top:0;bottom:0;width:3px;background:#e9a6a1"></div>
  <div class="abs hand" style="left:100px;top:{fs * .9:.0f}px;font-size:{fs * 1.05:.0f}px;color:#1d2a6b">{title}</div>
  <div class="abs hand" style="left:100px;right:40px;top:{fs * 2.4:.0f}px;font-size:{fs}px;line-height:{fs * 1.5:.0f}px;background:{line_bg};background-position:0 0">
    {''.join(rows)}
  </div>
</div>"""


ICONS = {
    "clock": '<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    "speech": '<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/><path d="M9 10h.01M12 10h.01M15 10h.01" stroke-linecap="round" stroke-width="2.6"/></svg>',
    "team": '<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14.2c2.8.2 5 2.6 5 5.8"/></svg>',
    "arrow": '<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    "down": '<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
    "tick": '<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.2 4.2L19 7"/></svg>',
}


def icon(name, s):
    return ICONS[name].format(s=s)


def problems(items, fs, gap, iconsize, color=S):
    rows = "".join(
        f'<div style="display:flex;align-items:center;gap:{fs * .7:.0f}px;padding:{gap / 2:.0f}px 0;border-bottom:1px solid rgba(247,245,239,.18)">'
        f'<span style="color:{Y};display:flex">{icon(ic, iconsize)}</span><span class="lab" style="font-size:{fs}px;color:{color}">{t}</span></div>'
        for ic, t in items)
    return f'<div data-name="Problems">{rows}</div>'


def planner(x, y, w, h, rot, fs=40):
    days = [("mon", "clinic", False), ("tue", "sone. shoot day", True),
            ("wed", "clinic", False), ("thu", "clinic", False), ("fri", "clinic", False)]
    rh = (h - 120) / len(days)
    rows = "".join(
        f'<div style="display:flex;align-items:center;height:{rh:.0f}px;border-top:2px solid #d7d2c4">'
        f'<span class="lab" style="width:{fs * 2.6:.0f}px;font-size:{fs * .62:.0f}px;color:#8a8577;letter-spacing:.06em">{d}</span>'
        f'<span class="hand" style="position:relative;font-size:{fs * (1.3 if hi else 1):.0f}px;color:{"#111" if hi else "#5d6a86"}">'
        + (f'<span style="padding:0 12px;border-radius:6px;background:linear-gradient(180deg,transparent 30%,rgba(252,218,67,.9) 30%,rgba(252,218,67,.9) 86%,transparent 86%)">{t}</span>' if hi else t)
        + '</span></div>'
        for d, t, hi in days)
    return f"""
<div class="abs" data-name="Planner" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;transform:rotate({rot}deg);background:#fdfbf4;border-radius:10px;
     box-shadow:0 50px 80px rgba(0,0,0,.55),0 12px 20px rgba(0,0,0,.3);padding:40px 50px 0">
  <div class="abs" style="inset:0;border-radius:10px;background:linear-gradient(115deg,rgba(255,255,255,.65),rgba(255,255,255,0) 45%,rgba(0,0,0,.05))"></div>
  <div class="lab" style="position:relative;font-size:{fs * .7:.0f}px;color:#8a8577;letter-spacing:.08em;height:70px">this week</div>
  <div style="position:relative">{rows}</div>
  <div class="abs" style="left:-22px;top:60px;bottom:60px;width:22px;background:repeating-linear-gradient(180deg,#9a958a 0,#9a958a 10px,transparent 10px,transparent 34px);border-radius:6px"></div>
</div>"""


def pen(x, y, length, rot):
    return (f'<div class="abs" data-name="Pen" style="left:{x}px;top:{y}px;width:{length}px;height:26px;transform:rotate({rot}deg);border-radius:13px 4px 4px 13px;'
            f'background:linear-gradient(180deg,#3a3a3a,#0d0d0d 55%,#262626);box-shadow:0 22px 26px rgba(0,0,0,.5)">'
            f'<div class="abs" style="right:-34px;top:5px;width:40px;height:16px;background:linear-gradient(180deg,#d8d8d8,#8d8d8d);clip-path:polygon(0 0,100% 45%,100% 55%,0 100%)"></div>'
            f'<div class="abs" style="left:40px;top:-6px;width:{length * .35:.0f}px;height:8px;background:{Y};border-radius:4px"></div></div>')


def notification(x, y, w, title, msg, scale=1.0):
    f = lambda v: f"{v * scale:.0f}"
    return (f'<div class="abs" data-name="Notification" style="left:{x}px;top:{y}px;width:{w}px;padding:{f(26)}px {f(28)}px;border-radius:{f(34)}px;'
            f'background:rgba(245,243,238,.86);backdrop-filter:blur(18px);box-shadow:0 20px 40px rgba(0,0,0,.35);display:flex;gap:{f(22)}px;align-items:flex-start;font-family:-apple-system,\'Helvetica Neue\',Arial,sans-serif">'
            f'<div style="flex:none;width:{f(76)}px;height:{f(76)}px;border-radius:{f(18)}px;background:{K};display:flex;align-items:center;justify-content:center">'
            f'<img src="assets/logos/sone-icon-mustard.png" style="width:{f(54)}px"></div>'
            f'<div style="flex:1"><div style="display:flex;justify-content:space-between;font-size:{f(26)}px;font-weight:600;color:#111">{title}<span style="font-weight:400;color:#777">now</span></div>'
            f'<div style="font-size:{f(27)}px;line-height:1.3;color:#222;margin-top:{f(4)}px">{msg}</div></div></div>')


def mosaic(x, y, w, h, imgs, cols, gap=6):
    rows = (len(imgs) + cols - 1) // cols
    cw, ch = (w - gap * (cols - 1)) / cols, (h - gap * (rows - 1)) / rows
    out = []
    for i, (img, pos) in enumerate(imgs):
        cx, cy = x + (i % cols) * (cw + gap), y + (i // cols) * (ch + gap)
        out.append(photo(img, round(cx), round(cy), round(cw), round(ch), pos))
    return "".join(out)


# ---------------------------------------------------------------- OVERWHELMED OWNER
OWNER_NOTE = [("sign off rota", "done"), ("call the lab", "done"),
              ("film practice videos", "carried"), ("(moved from last week)", "")]
O_SUB = "We plan it, script it, film it and edit it. You give us one day."


def o1(size):
    name = "Still on the list | Static | No talent | Handwritten list"
    if size == "1x1":
        inner = f"""
{photo('iconic-reception.jpg', pos='40% 50%', extra='filter:blur(7px) brightness(.55);transform:scale(1.06)')}
<div class="cover" style="background:radial-gradient(circle at 60% 60%,rgba(0,0,0,0),rgba(0,0,0,.55))"></div>
<div class="abs hl" style="left:80px;top:96px;font-size:104px;color:{S}">still on<br>the list?</div>
{notepad(480, 140, 530, 430, 3.2, OWNER_NOTE, fs=42)}
<div class="abs body" style="left:80px;top:760px;width:560px;color:{S}">{O_SUB}</div>
{cta(80, 930)}
{logo(800, 960, 200)}"""
    elif size == "9x16":
        inner = f"""
{photo('iconic-reception.jpg', pos='35% 50%', extra='filter:blur(8px) brightness(.55);transform:scale(1.06)')}
<div class="cover" style="background:radial-gradient(circle at 50% 55%,rgba(0,0,0,0),rgba(0,0,0,.6))"></div>
<div class="abs hl" style="left:90px;top:280px;font-size:128px;color:{S}">still on<br>the list?</div>
{notepad(150, 660, 800, 560, 2.6, OWNER_NOTE, fs=66)}
<div class="abs body" style="left:90px;top:1410px;width:860px;font-size:34px;color:{S}">{O_SUB}</div>
{cta(90, 1500)}
{logo(800, 1520, 190)}"""
    else:
        inner = f"""
{photo('iconic-reception.jpg', pos='40% 50%', extra='filter:blur(6px) brightness(.55);transform:scale(1.06)')}
<div class="abs hl" style="left:60px;top:70px;font-size:76px;color:{S}">still on<br>the list?</div>
<div class="abs body" style="left:60px;top:270px;width:470px;font-size:26px;color:{S}">{O_SUB}</div>
{cta(60, 430, scale=.85)}
{logo(60, 548, 150)}
{notepad(640, 90, 480, 400, 3, OWNER_NOTE, fs=36)}"""
    return board("O1", name, size, K, inner)


O2_ITEMS = [("clock", "no time to plan it"), ("speech", "no idea what to say on camera"), ("team", "a team that hates filming")]


def o2(size):
    name = "Three blockers | Static | Clinician | Problem and solution"
    if size == "1x1":
        inner = f"""
<div class="abs" style="left:0;top:0;width:560px;height:1080px;background:{K}"></div>
{photo('clinician-camera.jpg', 560, 0, 520, 1080, '52% 50%')}
<div class="abs" style="left:560px;top:0;width:520px;height:1080px;background:linear-gradient(180deg,rgba(0,0,0,0) 45%,rgba(0,0,0,.85) 80%)"></div>
{logo(70, 70, 190)}
<div class="abs lab" style="left:70px;top:220px;font-size:30px;color:{Y}">the problem{DOT}</div>
<div class="abs" style="left:70px;top:270px;width:440px">{problems(O2_ITEMS, 36, 44, 44)}</div>
<div class="abs" style="left:520px;top:520px;width:80px;height:80px;border-radius:50%;background:{Y};color:{K};display:flex;align-items:center;justify-content:center;box-shadow:0 10px 24px rgba(0,0,0,.4)">{icon('arrow', 40)}</div>
<div class="abs lab" style="left:620px;top:720px;font-size:30px;color:{Y}">the fix{DOT}</div>
<div class="abs hl" style="left:620px;top:770px;font-size:78px;color:{S}">one shoot<br>day{DOT}</div>
<div class="abs body" style="left:620px;top:960px;font-size:28px;color:{S}">from <b class="price" style="font-size:38px">£750</b> + VAT</div>
{cta(70, 930)}"""
    elif size == "9x16":
        inner = f"""
<div class="abs" style="left:0;top:0;width:1080px;height:820px;background:{K}"></div>
{photo('clinician-camera.jpg', 0, 820, 1080, 1100, '45% 30%')}
<div class="abs" style="left:0;top:820px;width:1080px;height:1100px;background:linear-gradient(180deg,rgba(0,0,0,.2) 0%,rgba(0,0,0,0) 25%,rgba(0,0,0,.35) 42%,rgba(0,0,0,.92) 62%)"></div>
{logo(90, 280, 200)}
<div class="abs lab" style="left:90px;top:400px;font-size:38px;color:{Y}">the problem{DOT}</div>
<div class="abs" style="left:90px;top:450px;width:900px">{problems(O2_ITEMS, 48, 50, 56)}</div>
<div class="abs" style="left:490px;top:770px;width:100px;height:100px;border-radius:50%;background:{Y};color:{K};display:flex;align-items:center;justify-content:center;box-shadow:0 10px 24px rgba(0,0,0,.4)">{icon('down', 50)}</div>
<div class="abs lab" style="left:90px;top:1250px;font-size:38px;color:{Y}">the fix{DOT}</div>
<div class="abs hl" style="left:90px;top:1300px;font-size:104px;color:{S}">one shoot day{DOT}</div>
<div class="abs body" style="left:90px;top:1420px;font-size:34px;color:{S}">from <b class="price" style="font-size:46px">£750</b> + VAT</div>
{cta(560, 1408)}"""
    else:
        inner = f"""
<div class="abs" style="left:0;top:0;width:640px;height:628px;background:{K}"></div>
{photo('clinician-camera.jpg', 640, 0, 560, 628, '50% 45%')}
<div class="abs" style="left:640px;top:0;width:560px;height:628px;background:linear-gradient(180deg,rgba(0,0,0,0) 40%,rgba(0,0,0,.85) 85%)"></div>
{logo(50, 44, 140)}
<div class="abs lab" style="left:50px;top:130px;font-size:24px;color:{Y}">the problem{DOT}</div>
<div class="abs" style="left:50px;top:166px;width:540px">{problems(O2_ITEMS, 28, 32, 34)}</div>
<div class="abs" style="left:608px;top:282px;width:64px;height:64px;border-radius:50%;background:{Y};color:{K};display:flex;align-items:center;justify-content:center">{icon('arrow', 32)}</div>
<div class="abs lab" style="left:690px;top:420px;font-size:22px;color:{Y}">the fix{DOT}</div>
<div class="abs hl" style="left:690px;top:455px;font-size:54px;color:{S}">one shoot day{DOT}</div>
<div class="abs body" style="left:690px;top:530px;font-size:22px;color:{S}">from <b class="price" style="font-size:30px">£750</b> + VAT</div>
{cta(50, 500, scale=.85)}"""
    return board("O2", name, size, K, inner)


def desk():
    return (f'<div class="cover" style="background:radial-gradient(ellipse at 40% 35%,#4a3f33 0%,#2a231c 55%,#120f0c 100%)"></div>'
            f'<div class="cover" style="opacity:.35;background:repeating-linear-gradient(92deg,rgba(255,255,255,.05) 0,rgba(255,255,255,.05) 2px,transparent 2px,transparent 9px),'
            f'repeating-linear-gradient(88deg,rgba(0,0,0,.12) 0,rgba(0,0,0,.12) 1px,transparent 1px,transparent 23px)"></div>'
            f'<div class="cover" style="background:radial-gradient(circle at 75% 15%,rgba(255,230,170,.22),transparent 45%)"></div>')


def o3(size):
    name = "One day in the diary | Static | No talent | Planner"
    sub = "Plan, script, film, edit. All done for you."
    if size == "1x1":
        inner = f"""
{desk()}
<div class="abs hl" style="left:80px;top:80px;font-size:92px;color:{S}">one day{DOT}<br>that&rsquo;s the whole job{DOT}</div>
{planner(150, 330, 640, 560, -3, fs=40)}
{pen(640, 760, 380, -32)}
<div class="abs body" style="left:80px;top:925px;width:470px;font-size:26px;color:{S}">{sub}</div>
{logo(80, 990, 160)}
{cta(640, 950, scale=.9)}"""
    elif size == "9x16":
        inner = f"""
{desk()}
{logo(90, 270, 190)}
<div class="abs hl" style="left:90px;top:380px;font-size:116px;color:{S}">one day{DOT}<br>that&rsquo;s the<br>whole job{DOT}</div>
{planner(130, 820, 820, 680, -3, fs=50)}
{pen(560, 1380, 460, -30)}
<div class="abs body" style="left:90px;top:1530px;width:520px;font-size:30px;color:{S}">{sub}</div>
{cta(620, 1520, scale=.85)}"""
    else:
        inner = f"""
{desk()}
<div class="abs hl" style="left:56px;top:70px;font-size:66px;color:{S}">one day{DOT}<br>that&rsquo;s the<br>whole job{DOT}</div>
<div class="abs body" style="left:56px;top:330px;width:440px;font-size:24px;color:{S}">{sub}</div>
{cta(56, 440, scale=.85)}
{logo(56, 552, 140)}
{planner(600, 50, 520, 500, -3, fs=34)}
{pen(860, 470, 300, -24)}"""
    return board("O3", name, size, K, inner)


def lock_time(x, y, fs, color=S):
    return (f'<div class="abs" data-name="Lock screen" style="left:{x}px;top:{y}px;text-align:center;width:100%;color:{color};font-family:-apple-system,\'Helvetica Neue\',Arial,sans-serif;text-shadow:0 2px 20px rgba(0,0,0,.35)">'
            f'<div style="font-size:{fs * .24:.0f}px;font-weight:600">Tuesday, three weeks later</div><div style="font-size:{fs}px;font-weight:600;line-height:1;letter-spacing:-.02em">9:41</div></div>')


def o4(size):
    name = "Your videos are ready | Static | Clinician | Phone notification"
    n1 = ("sone.", "Your edited videos are ready to download.")
    n2 = ("sone.", "Edited package from £1,250 + VAT. Book a discovery call.")
    if size == "1x1":
        inner = f"""
{photo('iconic-clinician.jpg', pos='30% 40%')}
<div class="cover" style="background:linear-gradient(180deg,rgba(0,0,0,.85) 0%,rgba(0,0,0,.55) 22%,rgba(0,0,0,0) 40%,rgba(0,0,0,0) 50%,rgba(0,0,0,.85) 100%)"></div>
<div class="abs hl" style="left:80px;top:80px;font-size:84px;color:{S};text-shadow:0 4px 30px rgba(0,0,0,.4)">the easiest video<br>you&rsquo;ll ever make{DOT}</div>
{notification(80, 600, 920, *n1)}
{notification(80, 760, 920, *n2)}
{cta(80, 940)}
{logo(800, 966, 200)}"""
    elif size == "9x16":
        inner = f"""
{photo('iconic-clinician.jpg', pos='34% 40%')}
<div class="cover" style="background:linear-gradient(180deg,rgba(0,0,0,.45) 0%,rgba(0,0,0,0) 26%,rgba(0,0,0,0) 40%,rgba(0,0,0,.8) 54%,rgba(0,0,0,.92) 100%)"></div>
<div class="abs" style="left:0;top:270px;width:1080px">{lock_time(0, 0, 200).replace('class="abs" ', 'class="" ')}</div>
<div class="abs hl" style="left:90px;top:1000px;font-size:96px;color:{S}">the easiest video<br>you&rsquo;ll ever make{DOT}</div>
{notification(70, 1230, 940, *n1)}
{notification(70, 1390, 940, *n2)}
{cta(70, 1540, scale=.9)}"""
    else:
        inner = f"""
{photo('iconic-clinician.jpg', 520, 0, 680, 628, '28% 40%')}
<div class="abs" style="left:0;top:0;width:640px;height:628px;background:linear-gradient(90deg,{K} 0%,{K} 70%,rgba(0,0,0,0) 100%)"></div>
<div class="abs hl" style="left:56px;top:66px;font-size:62px;color:{S}">the easiest<br>video you&rsquo;ll<br>ever make{DOT}</div>
{cta(56, 420, scale=.85)}
{logo(56, 550, 140)}
{notification(560, 330, 600, *n1, scale=.75)}
{notification(560, 450, 600, *n2, scale=.75)}"""
    return board("O4", name, size, K, inner)


O5_IMGS = [("clinician-camera.jpg", "50% 40%"), ("iconic-consult.jpg", "45% 50%"), ("smdc-photo.jpg", "50% 50%"),
           ("nuyu-patient.jpg", "50% 40%"), ("patient-laugh.jpg", "40% 40%"), ("iconic-exterior.jpg", "50% 50%")]


def tickline(text, fs, color=S):
    return (f'<div style="display:flex;gap:{fs * .5:.0f}px;align-items:flex-start;color:{color};font-size:{fs}px;line-height:1.3">'
            f'<span style="color:{Y};flex:none;margin-top:2px">{icon("tick", round(fs * 1.1))}</span><span>{text}</span></div>')


def o5(size):
    name = "One day, all of this | Static | Clinician | Shoot mosaic"
    usp = "Planned, filmed and edited by a dental-only crew."
    if size == "1x1":
        inner = f"""
{mosaic(460, 0, 620, 1080, O5_IMGS, 2)}
<div class="abs" style="left:0;top:0;width:460px;height:1080px;background:{K}"></div>
{logo(70, 80, 200)}
<div class="abs hl" style="left:70px;top:330px;font-size:84px;color:{S}">this is<br>one shoot<br>day{DOT}</div>
<div class="abs" style="left:70px;top:640px;width:330px">{tickline(usp, 28)}</div>
{cta(70, 930, scale=.85)}"""
    elif size == "9x16":
        inner = f"""
<div class="abs" style="inset:0;background:{K}"></div>
{logo(90, 270, 200)}
<div class="abs hl" style="left:90px;top:390px;font-size:110px;color:{S}">this is one<br>shoot day{DOT}</div>
{mosaic(0, 690, 1080, 830, O5_IMGS, 3)}
<div class="abs" style="left:90px;top:1550px;width:520px">{tickline(usp, 30)}</div>
{cta(640, 1548, scale=.8)}"""
    else:
        inner = f"""
{mosaic(500, 0, 700, 628, O5_IMGS, 3)}
<div class="abs" style="left:0;top:0;width:500px;height:628px;background:{K}"></div>
{logo(50, 50, 150)}
<div class="abs hl" style="left:50px;top:160px;font-size:64px;color:{S}">this is one<br>shoot day{DOT}</div>
<div class="abs" style="left:50px;top:330px;width:400px">{tickline(usp, 22)}</div>
{cta(50, 500, scale=.8)}"""
    return board("O5", name, size, K, inner)


PERSONAS = {"owner": [o1, o2, o3, o4, o5]}

if __name__ == "__main__":
    for key, fns in PERSONAS.items():
        rows = []
        for size, suffix in (("1x1", "1x1"), ("9x16", "9x16"), ("1.91x1", "landscape")):
            boards = [f(size) for f in fns]
            (ROOT / f"{key}-{suffix}.html").write_text(page(f"Sone | {key} | {size}", boards))
            rows.append(f'<div class="row" data-name="{size}" style="display:flex;gap:80px;margin-bottom:{720 if size == "1x1" else 120}px">{"".join(boards)}</div>')
        # One page per persona for the Figma capture; the gap under the 1:1 row leaves room for the copy cards.
        (ROOT / f"{key}-all.html").write_text(page(f"Sone | {key}", rows).replace("<body>", '<body style="display:block">'))
    print("built")
