"""Priya (interior designer) statics: 5 concepts x 1:1 and 9:16. Copy: copy-priya.md."""
from common import C, logo, photo, frame, panel_line, profile, proof, cta, board, page, write, editorial_inner, soft, with_soft

PERIOD = "stock/stock-living-period-grey.jpg"  # licensed Freepik stock: period sitting room, ornate original mouldings
DOORWAY = "edwardian-panel-mould-small-bolection-skirting-architrave-block-rosette.jpg"  # view through to next room
MUSIC = "music-room-1-karen.jpg"           # designed room, through to dining
CRANES = "img-6881-karen.jpg"              # dark panelled cloakroom, crane wallpaper
HALL = "a-wix-hall-karen.jpg"              # high ceiling, tall skirting
SCHEME = "astragal-dado-westbury-cornice-ogee-bead-skiritng-board.jpg"  # cornice, dado, skirting together

SLATE_FADE = "rgba(47,79,79,{a})"


def fade(direction, stops):
    s = ", ".join(f"{SLATE_FADE.format(a=a)} {p}%" for a, p in stops)
    return f'<div class="fill" data-name="Overlay (locked)" style="background:linear-gradient({direction}, {s})"></div>'


def steps(x, y, w, color, num_color, size=24, gap=26):
    items = ["Scan the profile.", "CNC-cut a template.", "Grind cutters to it.", "Machine your lengths."]
    rows = "".join(
        f'<div style="display:flex;gap:20px;align-items:baseline;margin-bottom:{gap}px">'
        f'<span class="serif" style="font-size:{size * 1.6:.0f}px;font-weight:600;color:{num_color};width:{size * 1.5:.0f}px">{i + 1}</span>'
        f'<span class="body" style="font-size:{size}px;color:{color}">{t}</span></div>'
        for i, t in enumerate(items))
    return f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px">{rows}</div>'


# ------------------------------------------------------------------ 1:1
def p1_1():
    inner = with_soft(editorial_inner(PERIOD, "Matched from<br>one offcut.", "We scan the profile, grind cutters to it<br>and machine your lengths, in MDF or timber.",
                            x=80, y=170, w=600, size=58, fx=0.3, fy=0.5, sub_size=24, dark=True), soft(330, 270, 640, 360, light=True, strong=True))
    return board("1x1", "Priya Made to Match | Static | Room photo | One offcut", "#333", inner)


def p2_1():
    inner = f"""
{photo(0, 0, 1080, 1080, DOORWAY, fx=0.5, fy=0.5)}
{fade('180deg', [(.92, 0), (.7, 24), (0, 42), (0, 56), (.9, 70), (.96, 100)])}
<div class="abs" style="left:80px;top:70px">{logo('white', 110)}</div>
<div class="abs hl" style="left:80px;top:220px;width:900px;color:#fff;font-size:60px">Stand in the doorway. Count the profiles.</div>
<div class="abs body" style="left:80px;top:810px;width:840px;color:#fff;font-size:26px">The fastest giveaway in an extension is a skirting that's nearly right. We match the original from a sample or drawing.</div>
<div class="abs" style="left:80px;top:950px">{cta('Start a bespoke enquiry', 'teal', (62, 17, 30))}</div>"""
    return board("1x1", "Priya Made to Match | Static | Room photo | The giveaway", C["slate"], inner)


def p3_1():
    inner = editorial_inner(CRANES, "Bespoke, at<br>standard prices.", "Matched profiles cost the same per<br>length as our standard range.<br>Up to 14 days to make.",
                            x=80, y=600, w=520, size=56, fx=0.5, fy=0.5, sub_size=26)
    return board("1x1", "Priya Made to Match | Static | Room photo | Bespoke pricing", "#333", inner)


def p4_1():
    inner = f"""
{photo(0, 0, 640, 1080, HALL, fx=0.4, fy=0.6)}
<div class="fill" style="left:640px;background:{C['stone']}"></div>
<div class="abs" style="left:700px;top:80px">{logo('colour', 110)}</div>
<div class="abs hl" style="left:700px;top:260px;width:330px;color:{C['slate']};font-size:52px">Period rooms need period proportions.</div>
<div class="abs" style="left:700px;top:560px;width:60px;height:4px;background:{C['teal']}"></div>
<div class="abs body" style="left:700px;top:590px;width:330px;color:{C['ink']};font-size:24px"><b>167mm to 219mm</b> skirting for Victorian and Edwardian ceilings.</div>
<div class="abs mono" style="left:700px;top:740px;width:330px;color:{C['muted']};font-size:16px;line-height:1.6;letter-spacing:.08em;text-transform:uppercase">Torus · Ogee · Bolection<br>Georgian · Regency</div>
<div class="abs" style="left:700px;top:955px">{cta('Shop Victorian skirting', 'teal', (60, 15, 22))}</div>"""
    return board("1x1", "Priya Period Range | Static | Room photo | Proper scale", C["stone"], inner)


def p5_1():
    inner = f"""
{photo(0, 0, 1080, 1080, SCHEME, fx=0.5, fy=0.4)}
{fade('180deg', [(0, 0), (0, 40), (.85, 64), (.97, 100)])}
<div class="abs" style="left:80px;top:70px">{logo('white', 110)}</div>
<div class="abs mono" style="left:80px;top:660px;width:920px;color:{C['teal_light']};text-transform:uppercase;letter-spacing:.16em;font-size:18px">Skirting · Architrave · Dado · Picture rail · Cornice</div>
<div class="abs hl" style="left:80px;top:705px;width:920px;color:#fff;font-size:52px">Every moulding in the room, from one workshop.</div>
<div class="abs body" style="left:80px;top:850px;width:880px;color:{C['on_slate']};font-size:24px">One profile family, so every piece belongs together.</div>
<div class="abs" style="left:80px;top:950px">{cta('Shop by profile', 'teal', (62, 18, 32))}</div>"""
    return board("1x1", "Priya Period Range | Static | Room photo | Whole scheme", C["slate"], inner)


# ------------------------------------------------------------------ 9:16
def p1_9():
    inner = with_soft(editorial_inner(PERIOD, "Matched from<br>one offcut.", "We scan the profile, grind cutters to it<br>and machine your lengths, in MDF or timber.",
                            x=90, y=400, w=800, size=74, fx=0.3, fy=0.5, size_px=(1080, 1920), sub_size=30, dark=True), soft(440, 560, 780, 440, light=True, strong=True))
    return board("9x16", "Priya Made to Match | Static | Room photo | One offcut", "#333", inner)


def p2_9():
    inner = f"""
{photo(0, 0, 1080, 1920, DOORWAY, fx=0.5, fy=0.5)}
{fade('180deg', [(.92, 0), (.7, 22), (0, 34), (0, 52), (.92, 64), (.96, 100)])}
<div class="abs hl" style="left:90px;top:290px;width:900px;color:#fff;font-size:76px">Stand in the doorway. Count the profiles.</div>
<div class="abs body" style="left:90px;top:1250px;width:880px;color:#fff;font-size:31px">The fastest giveaway in an extension is a skirting that's nearly right. We match the original from a sample or drawing.</div>
<div class="abs" style="left:90px;top:1478px">{cta('Start a bespoke enquiry', 'teal')}</div>
<div class="abs" style="left:840px;top:1462px">{logo('white', 100)}</div>"""
    return board("9x16", "Priya Made to Match | Static | Room photo | The giveaway", C["slate"], inner)


def p3_9():
    inner = editorial_inner(CRANES, "Bespoke, at<br>standard prices.", "Matched profiles cost the same per<br>length as our standard range.<br>Up to 14 days to make.",
                            x=90, y=1060, w=700, size=70, fx=0.3, fy=0.5, size_px=(1080, 1920), sub_size=32)
    return board("9x16", "Priya Made to Match | Static | Room photo | Bespoke pricing", "#333", inner)


def p4_9():
    inner = f"""
{photo(0, 0, 1080, 1180, HALL, fx=0.4, fy=0.6)}
<div class="fill" style="top:1180px;background:{C['stone']}"></div>
<div class="abs hl" style="left:90px;top:1230px;width:900px;color:{C['slate']};font-size:66px">Period rooms need period proportions.</div>
<div class="abs body" style="left:90px;top:1400px;width:880px;color:{C['ink']};font-size:29px"><b>167mm to 219mm</b> skirting for Victorian and Edwardian ceilings. Torus, ogee, bolection, Georgian, Regency.</div>
<div class="abs" style="left:90px;top:1520px">{cta('Shop Victorian skirting', 'teal', (66, 19, 34))}</div>
<div class="abs" style="left:840px;top:1506px">{logo('colour', 100)}</div>"""
    return board("9x16", "Priya Period Range | Static | Room photo | Proper scale", C["stone"], inner)


def p5_9():
    inner = f"""
{photo(0, 0, 1080, 1920, SCHEME, fx=0.5, fy=0.45)}
{fade('180deg', [(.5, 0), (0, 14), (0, 50), (.88, 68), (.97, 100)])}
<div class="abs mono" style="left:90px;top:1190px;width:900px;color:{C['teal_light']};text-transform:uppercase;letter-spacing:.16em;font-size:20px">Skirting · Architrave · Dado · Picture rail · Cornice</div>
<div class="abs hl" style="left:90px;top:1240px;width:900px;color:#fff;font-size:64px">Every moulding in the room, from one workshop.</div>
<div class="abs body" style="left:90px;top:1400px;width:880px;color:{C['on_slate']};font-size:29px">One profile family, so every piece belongs together.</div>
<div class="abs" style="left:90px;top:1490px">{cta('Shop by profile', 'teal')}</div>
<div class="abs" style="left:840px;top:1474px">{logo('white', 100)}</div>"""
    return board("9x16", "Priya Period Range | Static | Room photo | Whole scheme", C["slate"], inner)


if __name__ == "__main__":
    write("priya-1x1.html", page("MR | Priya | 1x1", [p1_1(), p2_1(), p3_1(), p4_1(), p5_1()]))
    write("priya-9x16.html", page("MR | Priya | 9x16", [p1_9(), p2_9(), p3_9(), p4_9(), p5_9()]))
    print("wrote priya")
