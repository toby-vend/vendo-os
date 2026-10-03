"""Style sample in MR Mouldings' own Instagram / live-ad language, for sign-off before the full rebuild."""
from common import C, logo, photo, board, page, write

TEXT_SHADOW = "text-shadow:0 2px 26px rgba(0,0,0,.38), 0 1px 3px rgba(0,0,0,.25)"


def editorial(img, line, sub, fx=0.5, fy=0.5, x=80, y=110, w=760, size=66, name=""):
    inner = f"""
{photo(0, 0, 1080, 1080, img, fx=fx, fy=fy)}
<div class="abs" style="left:56px;top:52px">{logo('white', 104)}</div>
<div class="abs serif" style="left:{x}px;top:{y}px;width:{w}px;color:#fff;font-size:{size}px;font-weight:500;line-height:1.08;letter-spacing:-.01em;{TEXT_SHADOW}">{line}</div>
<div class="abs serif" style="left:{x}px;top:{y + int(size * 1.08 * line.count('<br>') + size * 1.08) + 26}px;width:{w}px;color:#fff;font-size:28px;font-weight:400;line-height:1.3;{TEXT_SHADOW}">{sub}</div>"""
    return board("1x1", name, "#333", inner)


def hotspot(x, y, card_x, card_y, thumb, title, price):
    """Product hotspot like MR's live ads: dot on the moulding, hairline to a white card."""
    import math
    cx, cy = card_x + (0 if card_x > x else 250), card_y + 42
    length = math.hypot(cx - x, cy - y)
    angle = math.degrees(math.atan2(cy - y, cx - x))
    return f"""
<div class="abs" style="left:{x}px;top:{y}px;width:{length:.0f}px;height:2px;background:rgba(255,255,255,.9);transform-origin:0 50%;transform:rotate({angle:.1f}deg)"></div>
<div class="abs" style="left:{x - 11}px;top:{y - 11}px;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 0 0 6px rgba(255,255,255,.35)"></div>
<div class="abs" style="left:{card_x}px;top:{card_y}px;width:250px;height:84px;background:#fff;border-radius:3px;display:flex;align-items:center;gap:12px;padding:10px;box-shadow:0 6px 18px rgba(0,0,0,.18)">
  <div style="width:64px;height:64px;flex:none;background:#f3f3f3 url(assets/photos/products/{thumb}) center/contain no-repeat"></div>
  <div><div class="sans" style="font-size:16px;font-weight:600;line-height:1.2;color:{C['ink']}">{title}</div>
  <div class="sans" style="font-size:15px;color:{C['muted']};margin-top:4px">From {price}</div></div>
</div>"""


def p5_hotspot():
    inner = f"""
{photo(0, 0, 1080, 1080, "astragal-dado-westbury-cornice-ogee-bead-skiritng-board.jpg", fy=0.6)}
<div class="abs" style="left:56px;top:52px">{logo('white', 104)}</div>
{hotspot(600, 186, 700, 270, "westbury-cornice.png", "Westbury MDF<br>Cornice", "£55.00")}
{hotspot(902, 686, 560, 560, "astragal-dado.png", "Astragal MDF<br>Dado Rail", "£9.55")}
{hotspot(850, 975, 470, 860, "ogee-bead-skirting.jpg", "Ogee Bead MDF<br>Skirting Board", "£12.68")}"""
    return board("1x1", "Priya Period Range | Static | Room photo | Whole scheme hotspots", "#333", inner)


if __name__ == "__main__":
    boards = [
        editorial("hampton-dado-regency-skirting-board-1.jpg", "Nobody stocks<br>your skirting<br>any more.",
                  "We still make it, from an offcut or a photo.", fx=0.5, fy=0.3, x=300, y=290, w=430, size=54,
                  name="Sophie Made to Match | Static | Room photo | Can't find it"),
        editorial("flexi-astragal-panel-mould-blue-door-way.jpg", "Matched doesn't<br>mean expensive.",
                  "Same price per length as<br>our standard range.", fx=0.4, fy=0.5, x=80, y=200, w=560, size=58,
                  name="Sophie Made to Match | Static | Room photo | Price myth"),
        p5_hotspot(),
    ]
    write("style-sample.html", page("MR | Style sample", boards))
    print("wrote style-sample.html")
