"""Hannah (new-build upgrader) statics: 5 concepts x 1:1 and 9:16. Copy: copy-hannah.md."""
from common import C, logo, photo, frame, panel_line, profile, proof, cta, board, page, write

TILES = "img-3400a.jpg"                                   # clean doorway, tall skirting, tiles
DOORWAY = "square-strips-wall-panel-kits-ogee-architrave.jpg"  # painted architrave, dado, colour
PANEL = "img-3381-karen.jpg"                              # panel moulding close-up, shadow line
DOOR = "img-3399a-karen.jpg"                              # plain door, skirting, architrave
BOOT = "chamfered-2-skirting-board.jpg"                   # modern boot room, chamfered skirting

SLATE_FADE = "rgba(47,79,79,{a})"


def fade(direction, stops):
    s = ", ".join(f"{SLATE_FADE.format(a=a)} {p}%" for a, p in stops)
    return f'<div class="fill" data-name="Overlay (locked)" style="background:linear-gradient({direction}, {s})"></div>'


STONE_BG = f'<div class="fill" style="background:radial-gradient(circle at 80% 15%, #fbfaf5 0%, {C["stone"]} 45%, #e8e3d6 100%)"></div>'


def compare(x, y, scale=1.0):
    """Two skirting profiles drawn to relative height: 70mm vs 145mm."""
    small, tall = int(150 * scale), int(310 * scale)
    base = y + tall
    return (f'<div class="abs" style="left:{x}px;top:{base - small}px;color:{C["muted"]}">{profile("pencil", small, C["muted"], 3, depth_px=int(70 * scale), fill="#E4E0D3")}</div>'
            f'<div class="abs mono" style="left:{x - 6}px;top:{base + 18}px;color:{C["muted"]};font-size:{int(18 * scale)}px">70mm</div>'
            f'<div class="abs" style="left:{x + int(150 * scale)}px;top:{y}px">{profile("bullnose", tall, C["teal"], 3.5, depth_px=int(80 * scale), fill="rgba(0,128,128,.14)")}</div>'
            f'<div class="abs mono" style="left:{x + int(144 * scale)}px;top:{base + 18}px;color:{C["teal"]};font-size:{int(18 * scale)}px;font-weight:700">145mm</div>'
            f'<div class="abs" style="left:{x - 30}px;top:{base}px;width:{int(330 * scale)}px;height:2px;background:{C["slate"]}"></div>')


# ------------------------------------------------------------------ 1:1
def h1_1():
    inner = f"""
{STONE_BG}
<div class="abs serif" style="left:80px;top:80px;width:920px;color:{C['slate']};font-size:44px;font-style:italic;line-height:1.2">&ldquo;Builders like to put in the smallest ones to save money.&rdquo;</div>
<div class="card shadow" style="left:80px;top:300px;width:470px;height:560px;overflow:hidden">{photo(0, 0, 470, 560, TILES, fx=0.5, fy=0.7)}</div>
{compare(650, 330, 1.15)}
<div class="abs hl" style="left:620px;top:770px;width:400px;color:{C['slate']};font-size:30px;line-height:1.15">A taller profile makes a room look finished.</div>
<div class="abs body" style="left:80px;top:905px;width:600px;color:{C['ink_soft']};font-size:23px">95mm to 145mm suits most modern rooms.</div>
<div class="abs" style="left:80px;top:960px">{cta('Shop skirting', 'teal', (62, 18, 32))}</div>
<div class="abs" style="left:880px;top:952px">{logo('colour', 110)}</div>"""
    return board("1x1", "Hannah Taller Skirting | Static | Graphic | Smallest ones", C["stone"], inner)


def h2_1():
    inner = f"""
{photo(0, 0, 1080, 1080, DOORWAY, fx=0.5, fy=0.45)}
{fade('180deg', [(.92, 0), (.75, 26), (0, 46), (0, 62), (.9, 100)])}
<div class="abs" style="left:80px;top:70px">{logo('white', 110)}</div>
<div class="abs hl" style="left:80px;top:205px;width:900px;color:#fff;font-size:58px">How do you make a new build feel less new build-ey?</div>
<div class="abs" style="left:80px;top:770px;width:920px;display:flex;gap:16px">
  <span class="cta" style="background:rgba(245,243,235,.94);color:{C['slate']};height:58px;font-size:17px;padding:0 24px">Taller skirting</span>
  <span class="cta" style="background:rgba(245,243,235,.94);color:{C['slate']};height:58px;font-size:17px;padding:0 24px">Matching architrave</span>
  <span class="cta" style="background:rgba(245,243,235,.94);color:{C['slate']};height:58px;font-size:17px;padding:0 24px">One panelled wall</span>
</div>
<div class="abs" style="left:80px;top:950px">{cta('Shop skirting', 'teal', (62, 18, 32))}</div>
<div class="abs" style="left:560px;top:972px">{proof(C['on_slate'], 18, 'Over 150 profiles, made in Epsom')}</div>"""
    return board("1x1", "Hannah New Build | Static | Room photo | Less new build-ey", C["slate"], inner)


def h3_1():
    inner = f"""
{photo(0, 0, 1080, 1080, PANEL, fx=0.5, fy=0.5)}
<div class="fill" data-name="Overlay (locked)" style="background:linear-gradient(90deg, rgba(245,243,235,.97) 0%, rgba(245,243,235,.92) 44%, rgba(245,243,235,0) 70%)"></div>
<div class="abs" style="left:80px;top:80px">{logo('colour', 110)}</div>
<div class="abs hl" style="left:80px;top:270px;width:520px;color:{C['slate']};font-size:76px">Start with one wall.</div>
<div class="abs body" style="left:80px;top:470px;width:470px;color:{C['ink_soft']};font-size:27px">Panel moulding has a real profile, so the boxes cast a shadow line instead of looking stuck on.</div>
<div class="abs mono" style="left:80px;top:700px;color:{C['teal']};text-transform:uppercase;letter-spacing:.14em;font-size:17px">Ogee · Astragal · Ovolo · and more</div>
<div class="abs" style="left:80px;top:950px">{cta('Shop panel moulds', 'teal', (62, 18, 32))}</div>"""
    return board("1x1", "Hannah Panel Moulding | Static | Room photo | One wall first", C["stone"], inner)


def h4_1():
    inner = f"""
{photo(0, 0, 1080, 1080, DOOR, fx=0.5, fy=0.55)}
{fade('180deg', [(.6, 0), (0, 30), (0, 100)])}
<div class="abs hl" style="left:80px;top:90px;width:900px;color:#fff;font-size:60px;text-shadow:0 2px 20px rgba(0,0,0,.3)">&ldquo;I'd never get the corners right.&rdquo;</div>
<div class="card shadow" style="left:80px;top:470px;width:600px;padding:44px 48px;background:{C['stone']}">
  <div class="eyebrow" style="color:{C['teal']};font-size:16px">The honest version</div>
  <div class="body" style="font-size:24px;color:{C['ink']};margin-top:18px"><b>Masonry walls:</b> grab adhesive.<br><b>Stud walls:</b> adhesive and pins.</div>
  <div class="body" style="font-size:22px;color:{C['ink_soft']};margin-top:16px">The corners take practice, so we tell everyone to order 10% extra.</div>
</div>
<div class="abs" style="left:80px;top:955px">{cta('Shop skirting', 'teal', (62, 18, 32))}</div>
<div class="abs" style="left:880px;top:940px">{logo('white', 110)}</div>"""
    return board("1x1", "Hannah Taller Skirting | Static | Room photo | Not a builder job", C["slate"], inner)


def h5_1():
    inner = f"""
{STONE_BG}
{photo(460, 0, 620, 1080, BOOT, fx=0.45, fy=0.5)}
{frame(500, 60, 540, 960, C['stone'], t=6)}
<div class="abs" style="left:70px;top:80px">{logo('colour', 110)}</div>
<div class="abs hl" style="left:70px;top:260px;width:360px;color:{C['slate']};font-size:56px">Character doesn't have to mean <i>Victorian.</i></div>
<div class="abs body" style="left:70px;top:590px;width:350px;color:{C['ink_soft']};font-size:24px">Chamfered, bullnose and square edge profiles, at a proper height.</div>
<div class="abs body" style="left:70px;top:740px;width:350px;color:{C['ink']};font-size:24px;font-weight:600">Built for the house you've got.</div>
<div class="abs" style="left:70px;top:955px">{cta('Shop modern skirting', 'teal', (60, 16, 26))}</div>"""
    return board("1x1", "Hannah New Build | Static | Room photo | Not Bridgerton", C["stone"], inner)


# ------------------------------------------------------------------ 9:16
def h1_9():
    inner = f"""
{STONE_BG}
<div class="abs serif" style="left:90px;top:290px;width:900px;color:{C['slate']};font-size:52px;font-style:italic;line-height:1.2">&ldquo;Builders like to put in the smallest ones to save money.&rdquo;</div>
<div class="card shadow" style="left:90px;top:560px;width:900px;height:520px;overflow:hidden">{photo(0, 0, 900, 520, TILES, fx=0.5, fy=0.75)}</div>
{compare(150, 1110, 0.95)}
<div class="abs hl" style="left:560px;top:1170px;width:440px;color:{C['slate']};font-size:42px;line-height:1.12">A taller profile makes a room look finished.</div>
<div class="abs body" style="left:560px;top:1370px;width:440px;color:{C['ink_soft']};font-size:26px">95mm to 145mm suits most modern rooms.</div>
<div class="abs" style="left:90px;top:1480px">{cta('Shop skirting', 'teal')}</div>
<div class="abs" style="left:820px;top:1462px">{logo('colour', 110)}</div>"""
    return board("9x16", "Hannah Taller Skirting | Static | Graphic | Smallest ones", C["stone"], inner)


def h2_9():
    inner = f"""
{photo(0, 0, 1080, 1920, DOORWAY, fx=0.5, fy=0.45)}
{fade('180deg', [(.94, 0), (.8, 28), (0, 44), (0, 62), (.92, 100)])}
<div class="abs hl" style="left:90px;top:300px;width:900px;color:#fff;font-size:64px">How do you make a new build feel less new build-ey?</div>
<div class="abs" style="left:90px;top:1260px;width:900px;display:flex;flex-direction:column;gap:14px;align-items:flex-start">
  <span class="cta" style="background:rgba(245,243,235,.94);color:{C['slate']};height:62px;font-size:19px;padding:0 28px">Taller skirting</span>
  <span class="cta" style="background:rgba(245,243,235,.94);color:{C['slate']};height:62px;font-size:19px;padding:0 28px">Matching architrave</span>
  <span class="cta" style="background:rgba(245,243,235,.94);color:{C['slate']};height:62px;font-size:19px;padding:0 28px">One panelled wall</span>
</div>
<div class="abs" style="left:90px;top:1500px">{cta('Shop skirting', 'teal')}</div>
<div class="abs" style="left:820px;top:1484px">{logo('white', 110)}</div>"""
    return board("9x16", "Hannah New Build | Static | Room photo | Less new build-ey", C["slate"], inner)


def h3_9():
    inner = f"""
{photo(0, 0, 1080, 1920, PANEL, fx=0.5, fy=0.5)}
<div class="fill" data-name="Overlay (locked)" style="background:linear-gradient(180deg, rgba(245,243,235,0) 0%, rgba(245,243,235,0) 34%, rgba(245,243,235,.94) 52%, rgba(245,243,235,.98) 100%)"></div>
<div class="abs hl" style="left:90px;top:1030px;width:900px;color:{C['slate']};font-size:92px">Start with one wall.</div>
<div class="abs body" style="left:90px;top:1150px;width:880px;color:{C['ink_soft']};font-size:31px">Panel moulding has a real profile, so the boxes cast a shadow line instead of looking stuck on.</div>
<div class="abs mono" style="left:90px;top:1330px;color:{C['teal']};text-transform:uppercase;letter-spacing:.14em;font-size:19px">Ogee · Astragal · Ovolo · and more</div>
<div class="abs" style="left:90px;top:1460px">{cta('Shop panel moulds', 'teal')}</div>
<div class="abs" style="left:820px;top:1446px">{logo('colour', 110)}</div>"""
    return board("9x16", "Hannah Panel Moulding | Static | Room photo | One wall first", C["stone"], inner)


def h4_9():
    inner = f"""
{photo(0, 0, 1080, 1920, DOOR, fx=0.5, fy=0.5)}
{fade('180deg', [(.65, 0), (0, 26), (0, 100)])}
<div class="abs hl" style="left:90px;top:290px;width:900px;color:#fff;font-size:72px;text-shadow:0 2px 20px rgba(0,0,0,.3)">&ldquo;I'd never get the corners right.&rdquo;</div>
<div class="card shadow" style="left:90px;top:1000px;width:900px;padding:56px 60px;background:{C['stone']}">
  <div class="eyebrow" style="color:{C['teal']};font-size:18px">The honest version</div>
  <div class="body" style="font-size:31px;color:{C['ink']};margin-top:22px"><b>Masonry walls:</b> grab adhesive.<br><b>Stud walls:</b> adhesive and pins.</div>
  <div class="body" style="font-size:28px;color:{C['ink_soft']};margin-top:18px">The corners take practice, so we tell everyone to order 10% extra.</div>
</div>
<div class="abs" style="left:90px;top:1490px">{cta('Shop skirting', 'teal')}</div>
<div class="abs" style="left:820px;top:1472px">{logo('white', 110)}</div>"""
    return board("9x16", "Hannah Taller Skirting | Static | Room photo | Not a builder job", C["slate"], inner)


def h5_9():
    inner = f"""
{STONE_BG}
{photo(0, 0, 1080, 1100, BOOT, fx=0.45, fy=0.45)}
{frame(60, 260, 960, 780, C['stone'], t=6)}
<div class="abs hl" style="left:90px;top:1150px;width:900px;color:{C['slate']};font-size:72px">Character doesn't have to mean <i>Victorian.</i></div>
<div class="abs body" style="left:90px;top:1330px;width:880px;color:{C['ink_soft']};font-size:30px">Chamfered, bullnose and square edge profiles, at a proper height. <b style="color:{C['ink']}">Built for the house you've got.</b></div>
<div class="abs" style="left:90px;top:1480px">{cta('Shop modern skirting', 'teal')}</div>
<div class="abs" style="left:840px;top:1462px">{logo('colour', 100)}</div>"""
    return board("9x16", "Hannah New Build | Static | Room photo | Not Bridgerton", C["stone"], inner)


if __name__ == "__main__":
    write("hannah-1x1.html", page("MR | Hannah | 1x1", [h1_1(), h2_1(), h3_1(), h4_1(), h5_1()]))
    write("hannah-9x16.html", page("MR | Hannah | 9x16", [h1_9(), h2_9(), h3_9(), h4_9(), h5_9()]))
    print("wrote hannah")
