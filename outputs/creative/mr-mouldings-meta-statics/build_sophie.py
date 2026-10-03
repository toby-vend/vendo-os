"""Sophie (period restorer) statics: 5 concepts x 1:1 and 9:16. Copy: copy-sophie.md."""
from common import C, logo, photo, frame, panel_line, profile, proof, cta, board, page, write, editorial_inner

HALL_BLUE = "astragal-dado-blue-hallway.jpg"
STAIR = "hampton-dado-regency-skirting-board-1.jpg"
PANEL = "double-astragal-dado-sunningdale-panel-mould.jpg"
CURVE = "flexi-bolection-dado-astragal-panel-mould-hallway.jpg"
CORNER = "first-img-6851-karen.jpg"
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
    inner = editorial_inner(STAIR, "Half the hall<br>is original.", "The other half is the bit you notice.<br>We match the original from an offcut<br>or a photo.",
                            x=300, y=290, w=440, size=56, fx=0.5, fy=0.3)
    return board("1x1", "Sophie Made to Match | Static | Room photo | Half the hall", "#333", inner)


def s3_1():
    inner = editorial_inner(PANEL, "Isn't MDF wrong for<br>a period house?", "Painted, the profile is what people see.<br>Prefer timber? We match in timber too.",
                            x=250, y=70, w=600, size=46, fx=0.5, fy=0.5, sub_size=24, dark=True)
    return board("1x1", "Sophie Made to Match | Static | Room photo | MDF objection", "#333", inner)


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


def spec_rows(x, y, w, rows, size=24, label_w=170):
    """Ruled spec list, like a joinery spec sheet: label left, value right."""
    out = ""
    for i, (label, value) in enumerate(rows):
        out += (f'<div style="display:flex;gap:24px;padding:{size * .8:.0f}px 0;border-top:1px solid {C["hair"]}">'
                f'<span class="eyebrow" style="width:{label_w}px;flex:none;color:{C["teal"]};font-size:{size * .62:.0f}px;padding-top:{size * .22:.0f}px">{label}</span>'
                f'<span class="body" style="font-size:{size}px;line-height:1.35;color:{C["ink"]}">{value}</span></div>')
    return f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px;border-bottom:1px solid {C["hair"]}">{out}</div>'


S5_ROWS = [("Per length", "The same as our standard range."),
           ("Tooling", "A one-off fee, only if new cutters are needed."),
           ("Quote", "Before anything is made.")]


def s5_1():
    inner = editorial_inner(TEAL_HALL, "Matched doesn't<br>mean expensive.", "Same price per length as<br>our standard range.",
                            x=80, y=200, w=560, size=58, fx=0.4, fy=0.5)
    return board("1x1", "Sophie Made to Match | Static | Room photo | Price myth", "#333", inner)


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
    inner = editorial_inner(STAIR, "Half the hall<br>is original.", "The other half is the bit you notice.<br>We match the original from an offcut<br>or a photo.",
                            x=400, y=560, w=600, size=70, fx=0.5, fy=0.3, size_px=(1080, 1920), sub_size=32)
    return board("9x16", "Sophie Made to Match | Static | Room photo | Half the hall", "#333", inner)


def s3_9():
    inner = editorial_inner(PANEL, "Isn't MDF wrong<br>for a period house?", "Painted, the profile is what people see.<br>Prefer timber? We match in timber too.",
                            x=90, y=330, w=760, size=62, fx=0.5, fy=0.5, size_px=(1080, 1920), sub_size=30, dark=True)
    return board("9x16", "Sophie Made to Match | Static | Room photo | MDF objection", "#333", inner)


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
    inner = editorial_inner(TEAL_HALL, "Matched<br>doesn't mean<br>expensive.", "Same price per length as<br>our standard range.",
                            x=90, y=760, w=460, size=64, fx=0.42, fy=0.5, size_px=(1080, 1920), sub_size=32, lines=3)
    return board("9x16", "Sophie Made to Match | Static | Room photo | Price myth", "#333", inner)


if __name__ == "__main__":
    write("sophie-1x1.html", page("MR | Sophie | 1x1", [s1_1(), s2_1(), s3_1(), s4_1(), s5_1()]))
    write("sophie-9x16.html", page("MR | Sophie | 9x16", [s1_9(), s2_9(), s3_9(), s4_9(), s5_9()]))
    print("wrote sophie")
