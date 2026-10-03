"""Hannah (new-build upgrader) statics: 5 concepts x 1:1 and 9:16. Copy: copy-hannah.md."""
from common import C, logo, photo, frame, panel_line, profile, proof, cta, board, page, write, editorial_inner, soft, with_soft

TILES = "img-3400a.jpg"                                   # clean doorway, tall skirting, tiles
DOORWAY = "square-strips-wall-panel-kits-ogee-architrave.jpg"  # painted architrave, dado, colour
PANEL = "img-3381-karen.jpg"                              # panel moulding close-up, shadow line
DOOR = "img-3399a-karen.jpg"                              # plain door, skirting, architrave
CORNER = "first-img-6851-karen.jpg"               # tall skirting wrapping an external corner
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
    inner = editorial_inner(DOOR, "&ldquo;Builders like to put in<br>the smallest ones.&rdquo;", "A taller profile is the quickest way to make a<br>room look finished. 95mm to 145mm suits<br>most modern rooms.",
                            x=80, y=190, w=760, size=48, fx=0.5, fy=0.4, sub_size=24, dark=True)
    return board("1x1", "Hannah Taller Skirting | Static | Room photo | Smallest ones", "#333", inner)


def h2_1():
    inner = with_soft(editorial_inner(DOORWAY, "How do you make a new build<br>feel less new build-ey?", "Taller skirting. Matching architrave.<br>One panelled wall.",
                            x=80, y=170, w=880, size=54, fx=0.5, fy=0.45, sub_size=28), soft(380, 260, 720, 330))
    return board("1x1", "Hannah New Build | Static | Room photo | Less new build-ey", "#333", inner)


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
    inner = editorial_inner(CORNER, "&ldquo;I'd never get the<br>corners right.&rdquo;", "Grab adhesive on masonry. Adhesive and pins<br>on stud walls. Order 10% extra for the corners.",
                            x=60, y=580, w=640, size=54, fx=0.2, fy=0.7, sub_size=24)
    return board("1x1", "Hannah Taller Skirting | Static | Room photo | Not a builder job", "#333", inner)


def h5_1():
    inner = editorial_inner(BOOT, "Character<br>doesn't have<br>to mean<br><i>Victorian.</i>", "Chamfered, bullnose<br>and square edge<br>profiles, at a<br>proper height.",
                            x=56, y=300, w=300, size=42, fx=0.0, fy=0.4, sub_size=21, dark=True)
    return board("1x1", "Hannah New Build | Static | Room photo | Not Bridgerton", "#333", inner)


def h1_9():
    inner = editorial_inner(DOOR, "&ldquo;Builders like to<br>put in the smallest<br>ones.&rdquo;", "A taller profile is the quickest way to make a<br>room look finished. 95mm to 145mm suits<br>most modern rooms.",
                            x=90, y=360, w=860, size=64, fx=0.5, fy=0.4, size_px=(1080, 1920), sub_size=29, dark=True)
    return board("9x16", "Hannah Taller Skirting | Static | Room photo | Smallest ones", "#333", inner)


def h2_9():
    inner = with_soft(editorial_inner(DOORWAY, "How do you make<br>a new build feel less<br>new build-ey?", "Taller skirting. Matching architrave.<br>One panelled wall.",
                            x=90, y=400, w=900, size=66, fx=0.5, fy=0.45, size_px=(1080, 1920), sub_size=32), soft(420, 560, 760, 420))
    return board("9x16", "Hannah New Build | Static | Room photo | Less new build-ey", "#333", inner)


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
    inner = editorial_inner(CORNER, "&ldquo;I'd never get<br>the corners right.&rdquo;", "Grab adhesive on masonry. Adhesive and<br>pins on stud walls. Order 10% extra<br>for the corners.",
                            x=70, y=900, w=560, size=64, fx=0.15, fy=0.6, size_px=(1080, 1920), sub_size=29)
    return board("9x16", "Hannah Taller Skirting | Static | Room photo | Not a builder job", "#333", inner)


def h5_9():
    inner = editorial_inner(BOOT, "Character<br>doesn't have<br>to mean<br><i>Victorian.</i>", "Chamfered, bullnose<br>and square edge<br>profiles, at a<br>proper height.",
                            x=56, y=600, w=300, size=48, fx=0.0, fy=0.4, size_px=(1080, 1920), sub_size=23, dark=True)
    return board("9x16", "Hannah New Build | Static | Room photo | Not Bridgerton", "#333", inner)


if __name__ == "__main__":
    write("hannah-1x1.html", page("MR | Hannah | 1x1", [h1_1(), h2_1(), h3_1(), h4_1(), h5_1()]))
    write("hannah-9x16.html", page("MR | Hannah | 9x16", [h1_9(), h2_9(), h3_9(), h4_9(), h5_9()]))
    print("wrote hannah")
