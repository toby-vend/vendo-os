"""Sophie (period restorer) statics: 5 concepts x 1:1 and 9:16. Copy: copy-sophie.md."""
from common import C, logo, photo, frame, panel_line, profile, proof, cta, board, page, write

HALL_BLUE = "astragal-dado-blue-hallway.jpg"
STAIR = "hampton-dado-regency-skirting-board-1.jpg"
PANEL = "double-astragal-dado-sunningdale-panel-mould.jpg"
CURVE = "flexi-bolection-dado-astragal-panel-mould-hallway.jpg"
TEAL_HALL = "flexi-astragal-panel-mould-blue-door-way.jpg"

SLATE_FADE = "rgba(47,79,79,{a})"


def fade(direction, stops):
    """Slate gradient overlay. stops: list of (alpha, pct)."""
    s = ", ".join(f"{SLATE_FADE.format(a=a)} {p}%" for a, p in stops)
    return f'<div class="fill" data-name="Overlay (locked)" style="background:linear-gradient({direction}, {s})"></div>'


def quote_mark(color, size=120):
    return f'<div class="serif" style="font-size:{size}px;line-height:.6;color:{color};font-weight:700">&ldquo;</div>'


# ------------------------------------------------------------------ 1:1
def s1_1():
    inner = f"""
{photo(0, 0, 1080, 1080, HALL_BLUE, fy=0.42)}
{fade('180deg', [(.9, 0), (.6, 22), (0, 40), (.82, 62), (.97, 100)])}
<div class="abs" style="left:80px;top:72px">{logo('white', 120)}</div>
<div class="abs serif" style="left:80px;top:250px;width:760px;color:#fff;font-size:40px;font-style:italic;font-weight:400;line-height:1.25;text-shadow:0 2px 18px rgba(0,0,0,.35)">&ldquo;Tried the merchants.<br>Tried every website.&rdquo;</div>
<div class="abs hl" style="left:80px;top:620px;width:900px;color:#fff;font-size:62px">Nobody stocks your skirting any more. <span style="color:{C['teal_light']}">We can still make it.</span></div>
<div class="abs body" style="left:80px;top:800px;width:900px;color:{C['on_slate']};font-size:25px">Send us an offcut, a drawing or a photo with a tape measure. We scan the profile and grind cutters to match it.</div>
<div class="abs" style="left:80px;top:928px">{cta('Send us a photo', 'teal')}</div>
<div class="abs" style="left:560px;top:950px">{proof(C['on_slate'], 19, 'Made in our Epsom workshop since 2003')}</div>"""
    return board("1x1", "Sophie Made to Match | Static | Room photo | Can't find it", C["slate"], inner)


def s2_1():
    inner = f"""
{photo(0, 0, 560, 1080, STAIR, fx=0.35, fy=0.5)}
{panel_line(36, 36, 488, 1008)}
<div class="abs" style="left:620px;top:80px">{logo('colour', 120)}</div>
<div class="abs hl" style="left:620px;top:290px;width:400px;color:{C['slate']};font-size:68px">Half the hall is original.</div>
<div class="abs body" style="left:620px;top:530px;width:390px;color:{C['ink_soft']};font-size:28px">The other half is the bit you notice every time you walk in.</div>
<div class="abs" style="left:620px;top:690px;width:60px;height:4px;background:{C['teal']}"></div>
<div class="abs body" style="left:620px;top:720px;width:390px;color:{C['ink']};font-size:26px;font-weight:500">We match the original from an offcut or a photo.</div>
<div class="abs" style="left:620px;top:900px">{cta('Send us a photo', 'teal', (66, 19, 34))}</div>"""
    return board("1x1", "Sophie Made to Match | Static | Room photo | Half the hall", C["stone"], inner)


def s3_1():
    inner = f"""
<div class="fill" style="background:radial-gradient(circle at 80% 20%, #fbfaf5 0%, {C['stone']} 45%, #e9e5d8 100%)"></div>
<div class="abs" style="left:80px;top:70px">{quote_mark(C['teal'], 150)}</div>
<div class="abs hl" style="left:80px;top:150px;width:920px;color:{C['slate']};font-size:62px">Isn't MDF wrong for a period house?</div>
<div class="card shadow" style="left:80px;top:340px;width:430px;height:430px;overflow:hidden">{photo(0, 0, 430, 430, PANEL, fx=0.3, fy=0.55)}</div>
{frame(56, 316, 478, 478, C['teal'], t=5)}
<div class="abs" style="left:590px;top:350px;color:{C['slate']}">{profile('ogee', 300, C['slate'], 3)}</div>
<div class="abs mono" style="left:700px;top:600px;width:300px;color:{C['muted']}">Profile machined from MDF. Painted, it reads as the original.</div>
<div class="abs body" style="left:80px;top:830px;width:920px;color:{C['ink']};font-size:25px">Once it's painted, the profile is what people see. MDF holds a crisp profile, has no knots to bleed through the paint, and stays put in a house that moves. <b>Prefer timber? We match in timber too.</b></div>
<div class="abs" style="left:80px;top:966px">{cta('Send us a photo', 'teal', (60, 18, 30))}</div>
<div class="abs" style="left:860px;top:972px">{logo('colour', 90)}</div>"""
    return board("1x1", "Sophie Made to Match | Static | Room photo | MDF objection", C["stone"], inner)


def s4_1():
    inner = f"""
{photo(0, 0, 1080, 1080, CURVE, fx=0.5, fy=0.6)}
{fade('180deg', [(.96, 0), (.88, 34), (0, 56), (0, 72), (.88, 100)])}
<div class="abs" style="left:80px;top:70px">{logo('white', 110)}</div>
<div class="abs hl" style="left:80px;top:220px;width:860px;color:#fff;font-size:64px">Curves are where the skirting usually gives up.</div>
<div class="abs body" style="left:80px;top:395px;width:760px;color:{C['on_slate']};font-size:27px">Our flexible mouldings bend to the wall. No steaming. No kerfing.</div>
<div class="abs mono" style="left:80px;top:905px;width:600px;color:#fff;text-transform:uppercase;letter-spacing:.14em;font-size:16px">Skirting · Architrave · Dado · Picture rail · Cornice</div>
<div class="abs" style="left:80px;top:950px">{cta('Shop flexible', 'teal', (62, 18, 32))}</div>"""
    return board("1x1", "Sophie Flexible | Static | Room photo | Curves and bays", C["slate"], inner)


def s5_1():
    inner = f"""
{photo(0, 0, 1080, 1080, TEAL_HALL, fx=0.5, fy=0.35)}
{fade('180deg', [(.9, 0), (.72, 32), (.6, 55), (.92, 100)])}
<div class="abs hl" style="left:80px;top:96px;width:920px;color:#fff;font-size:56px">&ldquo;Don't get it matched unless you have deep pockets.&rdquo;</div>
<div class="card shadow" style="left:80px;top:380px;width:740px;padding:52px 56px;background:{C['stone']};transform:rotate(-1.4deg)">
  <div class="eyebrow" style="color:{C['teal']};font-size:17px">How our pricing actually works</div>
  <div class="serif" style="font-size:36px;font-weight:600;line-height:1.2;color:{C['slate']};margin-top:22px">Same price per length as our standard range.</div>
  <div class="body" style="font-size:25px;color:{C['ink_soft']};margin-top:16px">Plus a one-off tooling fee if new cutters are needed.</div>
  <div style="height:1px;background:{C['hair']};margin:28px 0 22px"></div>
  <div class="body" style="font-size:23px;color:{C['ink']};font-weight:500">You see the quote before anything is made.</div>
</div>
<div class="abs" style="left:80px;top:945px">{cta('Send us a photo', 'teal', (64, 19, 34))}</div>
<div class="abs" style="left:880px;top:940px">{logo('white', 110)}</div>"""
    return board("1x1", "Sophie Made to Match | Static | Room photo | Price myth", C["slate"], inner)


# ------------------------------------------------------------------ 9:16 (safe zone: top 250, bottom 340 clear of key copy)
def s1_9():
    inner = f"""
{photo(0, 0, 1080, 1920, HALL_BLUE, fy=0.5)}
{fade('180deg', [(.88, 0), (.55, 22), (0, 34), (.88, 56), (.97, 100)])}
<div class="abs serif" style="left:90px;top:300px;width:860px;color:#fff;font-size:46px;font-style:italic;line-height:1.25;text-shadow:0 2px 18px rgba(0,0,0,.35)">&ldquo;Tried the merchants.<br>Tried every website.&rdquo;</div>
<div class="abs hl" style="left:90px;top:1060px;width:900px;color:#fff;font-size:74px">Nobody stocks your skirting any more. <span style="color:{C['teal_light']}">We can still make it.</span></div>
<div class="abs body" style="left:90px;top:1340px;width:880px;color:{C['on_slate']};font-size:31px">Send us an offcut, a drawing or a photo with a tape measure. We scan the profile and grind cutters to match it.</div>
<div class="abs" style="left:90px;top:1480px">{cta('Send us a photo', 'teal')}</div>
<div class="abs" style="left:800px;top:1468px">{logo('white', 110)}</div>"""
    return board("9x16", "Sophie Made to Match | Static | Room photo | Can't find it", C["slate"], inner)


def s2_9():
    inner = f"""
{photo(0, 0, 1080, 1040, STAIR, fx=0.4, fy=0.45)}
{panel_line(40, 270, 1000, 730)}
<div class="abs hl" style="left:90px;top:1100px;width:900px;color:{C['slate']};font-size:84px">Half the hall is original.</div>
<div class="abs body" style="left:90px;top:1220px;width:880px;color:{C['ink_soft']};font-size:33px">The other half is the bit you notice every time you walk in.</div>
<div class="abs" style="left:90px;top:1330px;width:60px;height:4px;background:{C['teal']}"></div>
<div class="abs body" style="left:90px;top:1360px;width:880px;color:{C['ink']};font-size:31px;font-weight:500">We match the original from an offcut or a photo.</div>
<div class="abs" style="left:90px;top:1470px">{cta('Send us a photo', 'teal')}</div>
<div class="abs" style="left:820px;top:1452px">{logo('colour', 110)}</div>"""
    return board("9x16", "Sophie Made to Match | Static | Room photo | Half the hall", C["stone"], inner)


def s3_9():
    inner = f"""
<div class="fill" style="background:radial-gradient(circle at 80% 20%, #fbfaf5 0%, {C['stone']} 45%, #e9e5d8 100%)"></div>
<div class="abs" style="left:90px;top:270px">{quote_mark(C['teal'], 160)}</div>
<div class="abs hl" style="left:90px;top:360px;width:900px;color:{C['slate']};font-size:76px">Isn't MDF wrong for a period house?</div>
<div class="card shadow" style="left:90px;top:620px;width:560px;height:560px;overflow:hidden">{photo(0, 0, 560, 560, PANEL, fx=0.3, fy=0.55)}</div>
{frame(64, 594, 612, 612, C['teal'], t=6)}
<div class="abs" style="left:740px;top:650px;color:{C['slate']}">{profile('ogee', 400, C['slate'], 3)}</div>
<div class="abs body" style="left:90px;top:1250px;width:900px;color:{C['ink']};font-size:30px">Once it's painted, the profile is what people see. MDF holds a crisp profile, has no knots to bleed through the paint, and stays put in a house that moves. <b>Prefer timber? We match in timber too.</b></div>
<div class="abs" style="left:90px;top:1480px">{cta('Send us a photo', 'teal')}</div>
<div class="abs" style="left:820px;top:1462px">{logo('colour', 110)}</div>"""
    return board("9x16", "Sophie Made to Match | Static | Room photo | MDF objection", C["stone"], inner)


def s4_9():
    inner = f"""
{photo(0, 0, 1080, 1920, CURVE, fx=0.5, fy=0.55)}
{fade('180deg', [(.95, 0), (.88, 30), (0, 46), (0, 66), (.9, 100)])}
<div class="abs hl" style="left:90px;top:290px;width:900px;color:#fff;font-size:72px">Curves are where the skirting usually gives up.</div>
<div class="abs body" style="left:90px;top:560px;width:860px;color:{C['on_slate']};font-size:33px">Our flexible mouldings bend to the wall. No steaming. No kerfing.</div>
<div class="abs mono" style="left:90px;top:1420px;width:900px;color:#fff;text-transform:uppercase;letter-spacing:.14em;font-size:19px">Skirting · Architrave · Dado · Picture rail · Cornice</div>
<div class="abs" style="left:90px;top:1478px">{cta('Shop flexible', 'teal')}</div>
<div class="abs" style="left:820px;top:1462px">{logo('white', 110)}</div>"""
    return board("9x16", "Sophie Flexible | Static | Room photo | Curves and bays", C["slate"], inner)


def s5_9():
    inner = f"""
{photo(0, 0, 1080, 1920, TEAL_HALL, fx=0.5, fy=0.4)}
{fade('180deg', [(.92, 0), (.7, 30), (.6, 55), (.94, 100)])}
<div class="abs hl" style="left:90px;top:300px;width:900px;color:#fff;font-size:68px">&ldquo;Don't get it matched unless you have deep pockets.&rdquo;</div>
<div class="card shadow" style="left:90px;top:700px;width:900px;padding:64px 64px;background:{C['stone']};transform:rotate(-1.4deg)">
  <div class="eyebrow" style="color:{C['teal']};font-size:19px">How our pricing actually works</div>
  <div class="serif" style="font-size:44px;font-weight:600;line-height:1.2;color:{C['slate']};margin-top:26px">Same price per length as our standard range.</div>
  <div class="body" style="font-size:30px;color:{C['ink_soft']};margin-top:18px">Plus a one-off tooling fee if new cutters are needed.</div>
  <div style="height:1px;background:{C['hair']};margin:32px 0 26px"></div>
  <div class="body" style="font-size:28px;color:{C['ink']};font-weight:500">You see the quote before anything is made.</div>
</div>
<div class="abs" style="left:90px;top:1478px">{cta('Send us a photo', 'teal')}</div>
<div class="abs" style="left:820px;top:1462px">{logo('white', 110)}</div>"""
    return board("9x16", "Sophie Made to Match | Static | Room photo | Price myth", C["slate"], inner)


if __name__ == "__main__":
    write("sophie-1x1.html", page("MR | Sophie | 1x1", [s1_1(), s2_1(), s3_1(), s4_1(), s5_1()]))
    write("sophie-9x16.html", page("MR | Sophie | 9x16", [s1_9(), s2_9(), s3_9(), s4_9(), s5_9()]))
    print("wrote sophie")
