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


# ---------------------------------------------------------------- GROWTH-MODE PRINCIPAL
import math


def xcross(s, color="#c8261d"):
    return (f'<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="none" stroke="{color}" stroke-width="2.6" stroke-linecap="round">'
            f'<path d="M6 6l12 12M18 6L6 18"/></svg>')


def vs_card(x, y, w, h, img, pos, title, points, ours, fs=28):
    """Comparison card: photo on top, title, ticks (ours) or crosses (theirs)."""
    ph = round(h * .52)
    mark = (lambda: f'<span style="color:{K};display:flex">{icon("tick", round(fs * 1.05))}</span>') if ours else (lambda: f'<span style="display:flex">{xcross(round(fs * 1.05))}</span>')
    rows = "".join(f'<div style="display:flex;gap:{fs * .45:.0f}px;align-items:flex-start;margin-top:{fs * .55:.0f}px">{mark()}<span>{t}</span></div>' for t in points)
    bg = Y if ours else "#262626"
    col = K if ours else "#bdbab2"
    extra = "" if ours else "filter:grayscale(.85) contrast(.9) brightness(.9);"
    stamp = "" if ours else (f'<div class="abs lab" style="left:0;right:0;top:{ph / 2 - fs * .9:.0f}px;text-align:center;font-size:{fs * 1.5:.0f}px;color:rgba(255,255,255,.75);'
                             f'letter-spacing:.2em;transform:rotate(-12deg)">stock</div>')
    return (f'<div class="abs" data-name="{"Our card" if ours else "Their card"}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;background:{bg};border-radius:22px;overflow:hidden;'
            f'box-shadow:0 30px 60px rgba(0,0,0,.45)">'
            f'{photo(img, 0, 0, w, ph, pos, extra)}{stamp}'
            f'<div class="abs" style="left:{fs}px;right:{fs}px;top:{ph + fs * .8:.0f}px;color:{col};font-size:{fs * .9:.0f}px;line-height:1.25">'
            f'<div class="lab" style="font-size:{fs * 1.25:.0f}px;color:{K if ours else S}">{title}</div>{rows}</div></div>')


def vs_badge(x, y, d):
    return (f'<div class="abs lab" data-name="VS badge" style="left:{x}px;top:{y}px;width:{d}px;height:{d}px;border-radius:50%;background:{K};color:{S};'
            f'border:4px solid {Y};display:flex;align-items:center;justify-content:center;font-size:{d * .34:.0f}px;box-shadow:0 10px 24px rgba(0,0,0,.5)">vs</div>')


G1_THEM = ["the same model as every practice", "reads as an advert"]
G1_US = ["your rooms, your team", "reads as real"]


def g1(size):
    name = "Stock vs your practice | Static | Clinician | Us vs them"
    if size == "1x1":
        inner = f"""
<div class="cover" style="background:radial-gradient(circle at 50% 30%,#2b2b2b,{K} 70%)"></div>
{logo(80, 70, 180)}
<div class="abs hl" style="left:80px;top:150px;font-size:72px;color:{S}">your ads look like<br>everyone else&rsquo;s{DOT}</div>
{vs_card(80, 360, 440, 560, 'stock-smile.jpg', '50% 30%', 'stock photo', G1_THEM, False, 26)}
{vs_card(560, 360, 440, 560, 'iconic-consult.jpg', '48% 45%', 'your practice', G1_US, True, 26)}
{vs_badge(495, 520, 90)}
{cta(80, 960, scale=.85)}"""
    elif size == "9x16":
        inner = f"""
<div class="cover" style="background:radial-gradient(circle at 50% 35%,#2b2b2b,{K} 70%)"></div>
{logo(90, 270, 190)}
<div class="abs hl" style="left:90px;top:370px;font-size:92px;color:{S}">your ads look like<br>everyone else&rsquo;s{DOT}</div>
{vs_card(70, 640, 455, 780, 'stock-smile.jpg', '50% 30%', 'stock photo', G1_THEM, False, 30)}
{vs_card(555, 640, 455, 780, 'iconic-consult.jpg', '48% 45%', 'your practice', G1_US, True, 30)}
{vs_badge(490, 850, 100)}
{cta(90, 1480)}"""
    else:
        inner = f"""
<div class="cover" style="background:radial-gradient(circle at 70% 40%,#2b2b2b,{K} 70%)"></div>
{logo(56, 50, 140)}
<div class="abs hl" style="left:56px;top:150px;font-size:56px;color:{S}">your ads look<br>like everyone<br>else&rsquo;s{DOT}</div>
{cta(56, 470, scale=.8)}
{vs_card(520, 40, 310, 548, 'stock-smile.jpg', '50% 30%', 'stock photo', G1_THEM, False, 21)}
{vs_card(860, 40, 310, 548, 'iconic-consult.jpg', '48% 45%', 'your practice', G1_US, True, 21)}
{vs_badge(806, 170, 78)}"""
    return board("G1", name, size, K, inner)


def joe(x, y, h):
    w = round(h * 1254 / 960)
    return f'<img class="abs" data-name="Photo" src="assets/photos/joe-gimbal.png" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px">'


def g2(size):
    name = "750 for the day | Static | Founder | Editorial price split"
    small = "Want it edited? From £1,250 + VAT."
    if size == "1x1":
        inner = f"""
{joe(300, 140, 940)}
<div class="abs" style="left:0;top:0;width:600px;height:1080px;background:linear-gradient(90deg,{K} 0%,{K} 78%,rgba(0,0,0,0) 100%)"></div>
{logo(80, 80, 190)}
<div class="abs lab" style="left:80px;top:250px;font-size:34px;color:{Y}">dental content shoot day{DOT}</div>
<div class="abs price" style="left:72px;top:300px;font-size:230px;color:{S}">£750</div>
<div class="abs lab" style="left:84px;top:530px;font-size:40px;color:{S}">+ VAT</div>
<div class="abs body" style="left:80px;top:610px;width:440px;color:{S}">One full day at your practice. Footage ready for your editor.</div>
{cta(80, 820)}
<div class="abs body" style="left:80px;top:930px;width:460px;font-size:22px;color:#a8a49a">{small}</div>"""
    elif size == "9x16":
        inner = f"""
{joe(200, 900, 1020)}
<div class="abs" style="left:0;top:0;width:1080px;height:1200px;background:linear-gradient(180deg,{K} 0%,{K} 80%,rgba(0,0,0,0) 100%)"></div>
{logo(90, 270, 200)}
<div class="abs lab" style="left:90px;top:420px;font-size:42px;color:{Y}">dental content shoot day{DOT}</div>
<div class="abs price" style="left:80px;top:480px;font-size:300px;color:{S}">£750</div>
<div class="abs lab" style="left:96px;top:790px;font-size:50px;color:{S}">+ VAT</div>
<div class="abs body" style="left:90px;top:870px;width:600px;font-size:34px;color:{S}">One full day at your practice. Footage ready for your editor.</div>
<div class="abs" style="left:0;top:1380px;width:1080px;height:540px;background:linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.75) 45%)"></div>
{cta(90, 1470)}"""
    else:
        inner = f"""
{joe(560, 40, 588)}
<div class="abs" style="left:0;top:0;width:640px;height:628px;background:linear-gradient(90deg,{K} 0%,{K} 80%,rgba(0,0,0,0) 100%)"></div>
{logo(56, 46, 140)}
<div class="abs lab" style="left:56px;top:130px;font-size:24px;color:{Y}">dental content shoot day{DOT}</div>
<div class="abs price" style="left:50px;top:160px;font-size:160px;color:{S}">£750</div>
<div class="abs lab" style="left:60px;top:322px;font-size:28px;color:{S}">+ VAT</div>
<div class="abs body" style="left:56px;top:370px;width:440px;font-size:22px;color:{S}">One full day at your practice. Footage ready for your editor.</div>
{cta(56, 470, scale=.8)}
<div class="abs body" style="left:56px;top:565px;font-size:17px;color:#a8a49a">{small}</div>"""
    return board("G2", name, size, K, inner)


def viewfinder(w, h, inset, fs):
    """Camera viewfinder overlay: corner brackets, REC, timecode, battery, 9:16 and 1:1 guides."""
    c = 3
    L = round(min(w, h) * .07)
    br = "".join(f'<div class="abs" style="{sx}:{inset}px;{sy}:{inset}px;width:{L}px;height:{L}px;border-{sy}:{c + 1}px solid {S};border-{sx}:{c + 1}px solid {S}"></div>'
                 for sx in ("left", "right") for sy in ("top", "bottom"))
    g9w = round(h * .78 * 9 / 16)
    g9h = round(h * .78)
    g1s = round(min(w, h) * .62)
    guides = (f'<div class="abs" data-name="Guide 9:16" style="left:{(w - g9w) / 2:.0f}px;top:{(h - g9h) / 2:.0f}px;width:{g9w}px;height:{g9h}px;border:2px dashed rgba(252,218,67,.9)">'
              f'<span class="abs lab" style="left:8px;top:6px;font-size:{fs * .7:.0f}px;color:{Y}">9:16</span></div>'
              f'<div class="abs" data-name="Guide 1:1" style="left:{(w - g1s) / 2:.0f}px;top:{(h - g1s) / 2:.0f}px;width:{g1s}px;height:{g1s}px;border:2px dashed rgba(247,245,239,.7)">'
              f'<span class="abs lab" style="right:8px;bottom:6px;font-size:{fs * .7:.0f}px;color:{S}">1:1</span></div>')
    hud = (f'<div class="abs" style="left:{inset + L + 14}px;top:{inset + 6}px;display:flex;align-items:center;gap:12px;font-family:\'Fira Sans\',sans-serif;font-weight:600;font-size:{fs}px;color:{S}">'
           f'<span style="width:{fs * .7:.0f}px;height:{fs * .7:.0f}px;border-radius:50%;background:#e23b2e;box-shadow:0 0 12px rgba(226,59,46,.8)"></span>REC</div>'
           f'<div class="abs" style="right:{inset + L + 14}px;top:{inset + 6}px;font-family:\'Fira Sans\',sans-serif;font-weight:600;font-size:{fs}px;color:{S};letter-spacing:.06em">00:00:12:08</div>'
           f'<div class="abs" style="left:{inset + L + 14}px;bottom:{inset + 6}px;font-family:\'Fira Sans\',sans-serif;font-size:{fs * .8:.0f}px;color:{S};opacity:.85">4K &middot; 25p &middot; ISO 800</div>')
    return f'<div class="abs" data-name="Viewfinder" style="inset:0">{br}{guides}{hud}</div>'


def g3(size):
    name = "Shot for the feed | Static | Clinician | Viewfinder"
    sub = "Every clip planned for where it'll run."
    if size == "1x1":
        inner = f"""
{photo('smdc-loupes.jpg', 0, 0, 1080, 760, '50% 40%')}
<div class="abs" style="left:0;top:0;width:1080px;height:760px;background:radial-gradient(ellipse at 50% 50%,rgba(0,0,0,0) 55%,rgba(0,0,0,.45))"></div>
<div class="abs" style="left:0;top:0;width:1080px;height:760px">{viewfinder(1080, 760, 40, 26)}</div>
<div class="abs" style="left:0;top:760px;width:1080px;height:320px;background:{K}"></div>
<div class="abs hl" style="left:80px;top:800px;font-size:66px;color:{S}">shot for your ads,<br>not your showreel{DOT}</div>
<div class="abs body" style="left:80px;top:960px;font-size:26px;color:#cfccc4">{sub}</div>
{cta(640, 950, scale=.85)}"""
    elif size == "9x16":
        inner = f"""
{photo('smdc-loupes.jpg', 0, 0, 1080, 1340, '55% 40%')}
<div class="abs" style="left:0;top:0;width:1080px;height:1340px">{viewfinder(1080, 1340, 50, 30)}</div>
<div class="abs" style="left:0;top:1340px;width:1080px;height:580px;background:{K}"></div>
<div class="abs hl" style="left:90px;top:1370px;font-size:76px;color:{S}">shot for your ads,<br>not your showreel{DOT}</div>
<div class="abs body" style="left:90px;top:1550px;width:480px;font-size:28px;color:#cfccc4">{sub}</div>
{cta(600, 1530, scale=.85)}
<div class="abs" style="left:0;top:0;width:1080px;height:250px;background:linear-gradient(180deg,rgba(0,0,0,.5),rgba(0,0,0,0))"></div>"""
    else:
        inner = f"""
{photo('smdc-loupes.jpg', 480, 0, 720, 628, '50% 40%')}
<div class="abs" style="left:480px;top:0;width:720px;height:628px">{viewfinder(720, 628, 28, 20)}</div>
<div class="abs" style="left:0;top:0;width:480px;height:628px;background:{K}"></div>
{logo(56, 50, 140)}
<div class="abs hl" style="left:56px;top:160px;font-size:52px;color:{S}">shot for<br>your ads,<br>not your<br>showreel{DOT}</div>
<div class="abs body" style="left:56px;top:420px;width:380px;font-size:20px;color:#cfccc4">{sub}</div>
{cta(56, 500, scale=.8)}"""
    if size == "1x1":
        inner += logo(830, 815, 170)
    elif size == "9x16":
        inner += logo(860, 1390, 140)
    return board("G3", name, size, K, inner)


def callout(bx, by, text, px, py, fs, w):
    """Callout box (top-left bx,by, width w) with a leader line from its nearest edge to the point (px,py)."""
    pad_y, pad_x = fs * .45, fs * .7
    lines = max(1, math.ceil(len(text) * fs * .56 / (w - 2 * pad_x)))
    h = lines * fs * 1.15 + 2 * pad_y
    cx, cy = bx + w / 2, by + h / 2
    if py > by + h:
        ax, ay = min(max(px, bx + 20), bx + w - 20), by + h
    elif py < by:
        ax, ay = min(max(px, bx + 20), bx + w - 20), by
    else:
        ax, ay = (bx + w if px > cx else bx), cy
    dx, dy = px - ax, py - ay
    length, ang = math.hypot(dx, dy), math.degrees(math.atan2(dy, dx))
    return (f'<div class="abs" data-name="Leader line" style="left:{ax:.0f}px;top:{ay - 1.5:.0f}px;width:{length:.0f}px;height:3px;background:{Y};transform-origin:0 50%;transform:rotate({ang:.1f}deg)"></div>'
            f'<div class="abs" data-name="Callout point" style="left:{px - 9}px;top:{py - 9}px;width:18px;height:18px;border-radius:50%;background:{Y};box-shadow:0 0 0 6px rgba(252,218,67,.35)"></div>'
            f'<div class="abs lab" data-name="Callout box" style="left:{bx}px;top:{by}px;width:{w}px;padding:{pad_y:.0f}px {pad_x:.0f}px;background:{S};color:{K};'
            f'border-radius:{fs * .4:.0f}px;font-size:{fs}px;line-height:1.15;box-shadow:0 12px 26px rgba(0,0,0,.4)">{text}</div>')


def g4(size):
    name = "What's in a shoot day | Static | Sone crew | Callouts"
    if size == "1x1":
        inner = f"""
<div class="cover" style="background:{K}"></div>
{logo(80, 70, 180)}
<div class="abs hl" style="left:80px;top:150px;font-size:72px;color:{S}">what you get<br>in one day{DOT}</div>
<div class="abs" style="left:80px;top:360px;width:920px;height:518px;border-radius:20px;overflow:hidden;box-shadow:0 30px 60px rgba(0,0,0,.6)">{photo('crew-lounge.jpg', 0, 0, 920, 518, '50% 45%')}</div>
{callout(150, 395, 'lighting and audio sorted', 120, 520, 24, 320)}
{callout(110, 800, 'direction for every clinician', 400, 690, 24, 380)}
{callout(600, 400, 'shot list planned before we arrive', 830, 610, 24, 360)}
<div class="abs lab" style="left:640px;top:180px;font-size:30px;color:{Y}">from £750 + VAT</div>
{cta(80, 960, scale=.85)}
<div class="abs body" style="left:520px;top:975px;width:480px;font-size:22px;color:#cfccc4">Edited for ads, website and socials.</div>"""
    elif size == "9x16":
        inner = f"""
<div class="cover" style="background:{K}"></div>
{logo(90, 270, 190)}
<div class="abs hl" style="left:90px;top:370px;font-size:96px;color:{S}">what you get<br>in one day{DOT}</div>
<div class="abs" style="left:0;top:660px;width:1080px;height:700px;overflow:hidden">{photo('crew-lounge.jpg', 0, 0, 1080, 700, '45% 45%')}</div>
{callout(60, 690, 'lighting and audio sorted', 100, 830, 30, 380)}
{callout(60, 1300, 'direction for every clinician', 420, 1120, 30, 440)}
{callout(560, 700, 'shot list planned before we arrive', 900, 960, 30, 440)}
<div class="abs lab" style="left:90px;top:1500px;font-size:36px;color:{Y}">from £750 + VAT</div>
{cta(560, 1480, scale=.85)}"""
    else:
        inner = f"""
<div class="cover" style="background:{K}"></div>
{logo(56, 46, 140)}
<div class="abs hl" style="left:56px;top:140px;font-size:54px;color:{S}">what you<br>get in<br>one day{DOT}</div>
<div class="abs lab" style="left:56px;top:370px;font-size:24px;color:{Y}">from £750 + VAT</div>
{cta(56, 460, scale=.8)}
<div class="abs" style="left:440px;top:60px;width:720px;height:420px;border-radius:16px;overflow:hidden">{photo('crew-lounge.jpg', 0, 0, 720, 420, '50% 45%')}</div>
{callout(470, 80, 'lighting and audio sorted', 470, 160, 18, 250)}
{callout(470, 520, 'direction for every clinician', 700, 400, 18, 300)}
{callout(860, 520, 'shot list planned before we arrive', 1000, 300, 18, 300)}"""
    return board("G4", name, size, K, inner)


G5_ITEMS = ["We only film dentistry", "Every video planned before we arrive", "Edited for ads, website and socials"]


def reasons(items, fs, gap):
    return "".join(f'<div style="display:flex;gap:{fs * .6:.0f}px;align-items:center;margin-bottom:{gap}px">'
                   f'<span style="flex:none;width:{fs * 1.6:.0f}px;height:{fs * 1.6:.0f}px;border-radius:50%;background:{K};color:{Y};display:flex;align-items:center;justify-content:center">{icon("tick", round(fs * .95))}</span>'
                   f'<span style="font-size:{fs}px;line-height:1.25;color:{K}">{t}</span></div>' for t in items)


def price_bar(x, y, w, h, fs):
    return (f'<div class="abs" data-name="Price bar" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;border-radius:{h / 2:.0f}px;background:{K};display:flex;align-items:center;justify-content:space-between;padding:0 {h * .14:.0f}px 0 {h * .45:.0f}px">'
            f'<span class="lab" style="font-size:{fs}px;color:{S}">from <span style="color:{Y}">£750</span> + VAT</span>'
            f'<span class="cta" style="height:{h * .72:.0f}px;font-size:{fs * .85:.0f}px;padding:0 {fs * 1.2:.0f}px;box-shadow:none">Book a discovery call</span></div>')


def g5(size):
    name = "Three reasons | Static | Clinician | Three reasons"
    if size == "1x1":
        inner = f"""
<div class="abs hl" style="left:80px;top:90px;font-size:70px;color:{K}">3 reasons to book<br>a sone<span style="color:#e0b800">.</span> shoot day</div>
<div class="abs" style="left:80px;top:330px;width:500px">{reasons(G5_ITEMS, 32, 52)}</div>
<div class="abs" style="left:640px;top:300px;width:360px;height:560px;border-radius:24px;overflow:hidden;box-shadow:0 30px 60px rgba(0,0,0,.25)">{photo('nuyu-consult-m.jpg', 0, 0, 360, 560, '50% 40%')}</div>
<div class="abs" style="left:610px;top:270px;width:90px;height:80px;border-radius:18px;background:{Y}"></div>
{price_bar(80, 930, 920, 96, 30)}"""
    elif size == "9x16":
        inner = f"""
<div class="abs hl" style="left:90px;top:280px;font-size:88px;color:{K}">3 reasons to book<br>a sone<span style="color:#e0b800">.</span> shoot day</div>
<div class="abs" style="left:90px;top:560px;width:900px">{reasons(G5_ITEMS, 40, 50)}</div>
<div class="abs" style="left:300px;top:900px;width:690px;height:520px;border-radius:28px;overflow:hidden;box-shadow:0 30px 60px rgba(0,0,0,.25)">{photo('nuyu-consult-m.jpg', 0, 0, 690, 520, '50% 35%')}</div>
<div class="abs" style="left:250px;top:860px;width:110px;height:96px;border-radius:22px;background:{Y}"></div>
{price_bar(90, 1470, 900, 100, 30)}"""
    else:
        inner = f"""
<div class="abs hl" style="left:56px;top:56px;font-size:50px;color:{K}">3 reasons to book<br>a sone<span style="color:#e0b800">.</span> shoot day</div>
<div class="abs" style="left:56px;top:220px;width:560px">{reasons(G5_ITEMS, 24, 26)}</div>
<div class="abs" style="left:880px;top:40px;width:280px;height:548px;border-radius:20px;overflow:hidden">{photo('nuyu-consult-m.jpg', 0, 0, 280, 548, '50% 40%')}</div>
{price_bar(56, 480, 760, 80, 24)}"""
    return board("G5", name, size, S, inner)


PERSONAS["growth"] = [g1, g2, g3, g4, g5]



# ---------------------------------------------------------------- COSMETIC CLINICIAN
def caption(text, fs):
    return (f'<span style="display:inline-block;background:{S};color:{K};font-family:Komet,\'Fira Sans\',sans-serif;font-size:{fs}px;'
            f'line-height:1.15;padding:{fs * .28:.0f}px {fs * .45:.0f}px;border-radius:{fs * .22:.0f}px;margin:0;box-shadow:0 6px 16px rgba(0,0,0,.25)">{text}</span>')


def c1(size):
    name = "You on camera | Static | Clinician | Native captions"
    caps = lambda fs: f'<div style="text-align:center">{caption("you&rsquo;re not bad on camera.", fs)}<br>{caption("nobody&rsquo;s directing you.", fs)}</div>'
    if size == "1x1":
        inner = f"""
{photo('nuyu-explainer.jpg', pos='50% 40%')}
<div class="abs" style="left:0;right:0;top:868px">{caps(50)}</div>
{logo(40, 40, 150, dark_bg=False)}"""
    elif size == "9x16":
        inner = f"""
{photo('nuyu-explainer.jpg', pos='50% 50%')}
<div class="abs" style="left:0;right:0;top:1192px">{caps(60)}</div>
{logo(60, 270, 160, dark_bg=False)}"""
    else:
        inner = f"""
{photo('nuyu-explainer.jpg', 640, 0, 560, 628, '50% 30%')}
<div class="abs" style="left:640px;width:560px;top:470px">{caps(30)}</div>
<div class="abs" style="left:0;top:0;width:640px;height:628px;background:{K}"></div>
{logo(56, 50, 140)}
<div class="abs hl" style="left:56px;top:150px;font-size:54px;color:{S}">you&rsquo;re not<br>stiff<span style="color:{Y}">.</span> you&rsquo;re<br>undirected{DOT}</div>
<div class="abs body" style="left:56px;top:380px;width:520px;font-size:22px;color:#cfccc4">Scripts you approve before the day. Direction on the day.</div>
{cta(56, 480, scale=.8)}"""
    return board("C1", name, size, K, inner)


C2_FRAMES = [("broll-intraoral.jpg", "50% 50%"), ("broll-mirror.jpg", "50% 50%"), ("broll-design.jpg", "50% 50%"),
             ("broll-burs.jpg", "50% 50%"), ("broll-teeth.jpg", "50% 50%"), ("broll-scanner.jpg", "50% 50%")]


def contact_sheet(x, y, w, cols, rows, frames, rot, circle=2):
    """Film contact sheet on a light box: dark strip with sprocket holes, frames, one circled in yellow."""
    pad = round(w * .035); sp = round(w * .02)
    fw = (w - 2 * pad - (cols - 1) * sp) / cols; fh = fw * 9 / 16
    hole = lambda yy: "".join(f'<div class="abs" style="left:{pad + k * (w - 2 * pad) / 22:.0f}px;top:{yy}px;width:{w / 60:.0f}px;height:{w / 60 * .7:.0f}px;border-radius:2px;background:#f4f1e6"></div>' for k in range(22))
    h = round(2 * pad + rows * fh + (rows - 1) * sp * 3 + rows * 0)
    out = []
    for i, (img, pos) in enumerate(frames[:cols * rows]):
        cx = pad + (i % cols) * (fw + sp); cy = pad + (i // cols) * (fh + sp * 3)
        out.append(photo(img, round(cx), round(cy), round(fw), round(fh), pos))
        if i == circle:
            out.append(f'<div class="abs" data-name="Circle" style="left:{cx - fw * .12:.0f}px;top:{cy - fh * .16:.0f}px;width:{fw * 1.24:.0f}px;height:{fh * 1.32:.0f}px;'
                       f'border:{w / 160:.0f}px solid {Y};border-radius:50%;transform:rotate(-4deg)"></div>')
    holes = hole(round(pad * .25)) + "".join(hole(round(pad + (r + 1) * fh + r * sp * 3 + sp * .9)) for r in range(rows - 1)) + hole(h - round(pad * .7))
    return (f'<div class="abs" data-name="Contact sheet" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;transform:rotate({rot}deg);background:#151515;'
            f'border-radius:6px;box-shadow:0 40px 70px rgba(0,0,0,.45),0 0 0 10px rgba(255,255,255,.04)">{holes}{"".join(out)}</div>')


def lightbox():
    return (f'<div class="cover" style="background:radial-gradient(ellipse at 50% 45%,#ffffff 0%,#f4f2ea 45%,#d9d5c9 100%)"></div>'
            f'<div class="cover" style="opacity:.5;background:repeating-linear-gradient(0deg,rgba(0,0,0,.03) 0,rgba(0,0,0,.03) 1px,transparent 1px,transparent 6px)"></div>')


def c2(size):
    name = "Your work, shot properly | Static | No talent | Contact sheet"
    sub = "Treatment explainers, patient stories, b-roll. One day."
    if size == "1x1":
        inner = f"""
{lightbox()}
<div class="abs hl" style="left:80px;top:80px;font-size:76px;color:{K}">your work deserves<br>better than a<br>phone clip{DOT}</div>
{contact_sheet(80, 400, 920, 3, 2, C2_FRAMES, -2)}
<div class="abs body" style="left:80px;top:880px;width:640px;font-size:26px;color:#3a3a3a">{sub}</div>
{cta(80, 950, scale=.85, dark=True)}
{logo(800, 980, 200, dark_bg=False)}"""
    elif size == "9x16":
        inner = f"""
{lightbox()}
{logo(90, 270, 190, dark_bg=False)}
<div class="abs hl" style="left:90px;top:380px;font-size:94px;color:{K}">your work<br>deserves better<br>than a phone clip{DOT}</div>
{contact_sheet(60, 800, 960, 3, 2, C2_FRAMES, -2)}
<div class="abs body" style="left:90px;top:1360px;width:600px;font-size:30px;color:#3a3a3a">{sub}</div>
{cta(90, 1460, dark=True)}"""
    else:
        inner = f"""
{lightbox()}
{logo(56, 50, 140, dark_bg=False)}
<div class="abs hl" style="left:56px;top:140px;font-size:50px;color:{K}">your work<br>deserves better<br>than a phone<br>clip{DOT}</div>
<div class="abs body" style="left:56px;top:390px;width:400px;font-size:20px;color:#3a3a3a">{sub}</div>
{cta(56, 480, scale=.8, dark=True)}
{contact_sheet(500, 90, 650, 3, 2, C2_FRAMES, -2)}"""
    return board("C2", name, size, S, inner)


def side_column(x, y, w, h, fs):
    return f"""
<div class="abs" data-name="Column" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;background:{K};padding:{fs * 1.6:.0f}px {fs * 1.4:.0f}px">
  <div class="lab" style="font-size:{fs * 1.55:.0f}px;line-height:1.05;color:{S}">still letting your before-and-afters do all the talking?</div>
  <div style="height:3px;width:{fs * 3}px;background:{Y};margin:{fs * 1.2:.0f}px 0"></div>
  <div style="font-size:{fs * .85:.0f}px;color:#cfccc4">treatment explainers from</div>
  <div class="price" style="font-size:{fs * 3.4:.0f}px;color:{Y};margin-top:{fs * .2:.0f}px">£1,250</div>
  <div style="font-size:{fs * .85:.0f}px;color:#cfccc4;margin-top:{fs * .3:.0f}px">+ VAT, edited, with scripting support</div>
</div>"""


def c3(size):
    name = "Watched before they booked | Static | Clinician | Side column"
    if size == "1x1":
        inner = f"""
{photo('nuyu-consult-f.jpg', 0, 0, 620, 1080, '40% 40%')}
{side_column(620, 0, 460, 1080, 30)}
{cta(660, 930, scale=.85)}
<img class="logo abs" data-name="Logo" src="assets/logos/sone-wordmark-stone-mustard.png" style="left:40px;top:40px;width:150px">"""
    elif size == "9x16":
        inner = f"""
{photo('nuyu-consult-f.jpg', 0, 0, 1080, 1100, '40% 30%')}
{side_column(0, 1000, 1080, 920, 40)}
<div class="abs" style="left:0;top:1000px;width:1080px;height:920px;pointer-events:none"></div>
{cta(600, 1360, scale=.9)}
<img class="logo abs" data-name="Logo" src="assets/logos/sone-wordmark-stone-mustard.png" style="left:60px;top:270px;width:170px">"""
    else:
        inner = f"""
{photo('nuyu-consult-f.jpg', 0, 0, 640, 628, '40% 30%')}
{side_column(640, 0, 560, 628, 24)}
{cta(680, 530, scale=.75)}
<img class="logo abs" data-name="Logo" src="assets/logos/sone-wordmark-stone-mustard.png" style="left:30px;top:30px;width:120px">"""
    return board("C3", name, size, K, inner)


def step_card(x, y, w, n, label, img, pos, fs):
    h = round(w * .78)
    return (f'<div class="abs" data-name="Step {n}" style="left:{x}px;top:{y}px;width:{w}px">'
            f'<div style="position:relative;width:{w}px;height:{h}px;border-radius:{fs * .6:.0f}px;overflow:hidden;box-shadow:0 18px 36px rgba(0,0,0,.35)">{photo(img, 0, 0, w, h, pos)}</div>'
            f'<div style="display:flex;gap:{fs * .4:.0f}px;align-items:center;margin-top:{fs * .6:.0f}px">'
            f'<span class="lab" style="flex:none;width:{fs * 1.5:.0f}px;height:{fs * 1.5:.0f}px;border-radius:50%;background:{Y};color:{K};display:flex;align-items:center;justify-content:center;font-size:{fs * .85:.0f}px">{n}</span>'
            f'<span class="lab" style="font-size:{fs}px;line-height:1.1;color:{S}">{label}</span></div></div>')


C4_STEPS = [("a clip in<br>their feed", "nuyu-explainer.jpg", "50% 25%"), ("your treatment<br>explainer", "broll-design.jpg", "50% 50%"),
            ("a patient&rsquo;s<br>story", "nuyu-patient.jpg", "50% 35%")]


def arrow_h(x, y, w):
    return f'<div class="abs" style="left:{x}px;top:{y}px;color:{Y}">{icon("arrow", w)}</div>'


def c4(size):
    name = "Path to a consultation | Static | Clinician | Question and diagram"
    q = "what does a bonding patient watch before they book?"
    if size == "1x1":
        steps = "".join(step_card(80 + i * 320, 420, 280, i + 1, l, im, ps, 26) for i, (l, im, ps) in enumerate(C4_STEPS))
        inner = f"""
<div class="cover" style="background:radial-gradient(circle at 50% 20%,#262626,{K} 70%)"></div>
{logo(80, 70, 170)}
<div class="abs hl" style="left:80px;top:150px;font-size:66px;color:{S}">{q}</div>
{steps}{arrow_h(364, 520, 36)}{arrow_h(684, 520, 36)}
<div class="abs" style="left:80px;top:800px;display:flex;align-items:center;gap:16px"><span style="color:{Y};display:flex">{icon('tick', 34)}</span><span class="lab" style="font-size:34px;color:{Y}">consultation booked<span style="color:{S}">.</span></span></div>
<div class="abs body" style="left:80px;top:870px;font-size:24px;color:#cfccc4">We plan all three in one shoot day.</div>
{cta(80, 940, scale=.85)}"""
    elif size == "9x16":
        rows = "".join(f'<div class="abs" style="left:90px;top:{560 + i * 300}px;width:900px;height:260px;display:flex;gap:30px;align-items:center">'
                       f'<div style="position:relative;flex:none;width:340px;height:240px;border-radius:18px;overflow:hidden;box-shadow:0 18px 36px rgba(0,0,0,.4)">{photo(im, 0, 0, 340, 240, ps)}</div>'
                       f'<div style="display:flex;gap:18px;align-items:center"><span class="lab" style="flex:none;width:64px;height:64px;border-radius:50%;background:{Y};color:{K};display:flex;align-items:center;justify-content:center;font-size:36px">{i + 1}</span>'
                       f'<span class="lab" style="font-size:44px;line-height:1.08;color:{S}">{l}</span></div></div>'
                       for i, (l, im, ps) in enumerate(C4_STEPS))
        inner = f"""
<div class="cover" style="background:radial-gradient(circle at 50% 20%,#262626,{K} 70%)"></div>
{logo(90, 270, 180)}
<div class="abs hl" style="left:90px;top:360px;font-size:72px;color:{S}">{q}</div>
{rows}
<div class="abs" style="left:90px;top:1470px;display:flex;align-items:center;gap:16px"><span style="color:{Y};display:flex">{icon('tick', 40)}</span><span class="lab" style="font-size:40px;color:{Y}">consultation booked<span style="color:{S}">.</span></span></div>
{cta(600, 1458, scale=.8)}"""
    else:
        steps = "".join(step_card(480 + i * 240, 140, 210, i + 1, l, im, ps, 20) for i, (l, im, ps) in enumerate(C4_STEPS))
        inner = f"""
<div class="cover" style="background:{K}"></div>
{logo(56, 50, 140)}
<div class="abs hl" style="left:56px;top:140px;font-size:44px;color:{S}">what does a<br>bonding patient<br>watch before<br>they book?</div>
{cta(56, 470, scale=.8)}
{steps}{arrow_h(693, 210, 26)}{arrow_h(933, 210, 26)}
<div class="abs" style="left:480px;top:470px;display:flex;align-items:center;gap:12px"><span style="color:{Y};display:flex">{icon('tick', 28)}</span><span class="lab" style="font-size:28px;color:{Y}">consultation booked<span style="color:{S}">.</span></span></div>
<div class="abs body" style="left:480px;top:520px;font-size:18px;color:#cfccc4">We plan all three in one shoot day.</div>"""
    return board("C4", name, size, K, inner)


def c5(size):
    name = "Shot on a Sone shoot day | Static | Clinician | Native photo"
    bug = lambda w, x, y, fs: (f'<div class="abs" data-name="Logo bug" style="left:{x}px;top:{y}px;display:flex;align-items:center;gap:{fs * .6:.0f}px;background:rgba(0,0,0,.55);'
                               f'backdrop-filter:blur(6px);padding:{fs * .5:.0f}px {fs * .8:.0f}px;border-radius:999px">'
                               f'<img src="assets/logos/sone-icon-mustard.png" style="width:{fs * 1.6:.0f}px">'
                               f'<span class="lab" style="font-size:{fs}px;color:{S}">shot on a sone<span style="color:{Y}">.</span> shoot day</span></div>')
    if size == "1x1":
        inner = f"""{photo('iconic-team.jpg', pos='48% 50%')}{bug(0, 40, 980, 30)}"""
    elif size == "9x16":
        inner = f"""{photo('iconic-team.jpg', pos='52% 50%')}{bug(0, 60, 1480, 36)}"""
    else:
        inner = f"""{photo('iconic-team.jpg', pos='50% 45%')}{bug(0, 30, 548, 24)}"""
    return board("C5", name, size, K, inner)


PERSONAS["cosmetic"] = [c1, c2, c3, c4, c5]


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
