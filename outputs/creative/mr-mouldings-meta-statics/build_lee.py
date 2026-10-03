"""Lee (small renovation firm) statics: 5 concepts x 1:1 and 9:16, in MR's Instagram editorial and hotspot styles.
Copy: copy-lee.md. Product prices from the live Shopify catalogue (3 Oct 2026); recheck before launch."""
from common import C, logo, photo, board, page, write, editorial_inner, hotspot, soft, with_soft

SAGE = "img-3345.jpg"               # sage wall, radiator cover, window
BEIGE = "stock/stock-living-beige.jpg"           # licensed Freepik stock: panelled living room, long skirting runs
BLUE_DOORS = "img-7583-karen.jpg"   # blue doors and architrave
WHITE = "stock/stock-living-white-fireplace.jpg"  # licensed Freepik stock: fully panelled white living room
STAIRWELL = "victorian-dado-astragal-panel-mould-big-bolection-skirting.jpg"

SOFT = ('<div class="fill" data-name="Soft shadow" style="background:radial-gradient(ellipse 620px 520px at 18% 24%, '
        'rgba(15,35,40,.62) 0%, rgba(15,35,40,.35) 45%, rgba(15,35,40,0) 100%)"></div>')

E1 = dict(line="Send us the<br>floor plan.", sub="We'll work out every length of skirting,<br>architrave and rail, so you can price the job.")
E3 = dict(line="Straight lengths.<br>Fewer joins.", sub="MDF that won't cup or twist,<br>in lengths up to 4.2m.")
E4 = dict(line="Half of it's<br>missing.", sub="We match the original from an offcut or a photo, so you don't redo the house.")
E5 = dict(line="Built for<br>the trade.", sub="150+ profiles from our own workshop.<br>Ask about a trade account.")


def l2_inner(H=1080):
    oy = 0 if H == 1080 else 420
    img = photo(0, 0, 1080, H, STAIRWELL, fx=0.45, fy=0.5)
    if H == 1080:
        return (img + f'<div class="abs" style="left:56px;top:52px">{logo("colour", 104)}</div>'
                f'<div class="abs serif" style="left:80px;top:180px;width:520px;color:{C["slate"]};font-size:44px;font-weight:500;line-height:1.1">One order.<br>Every moulding<br>in the house.</div>'
                + hotspot(444, 588, 80, 420, "victorian-dado.png", "Victorian MDF<br>Dado Rail", "£17.70")
                + hotspot(600, 700, 650, 250, "astragal-panel.png", "Astragal MDF<br>Panel Mould", "£9.00")
                + hotspot(470, 835, 560, 930, "big-bolection-skirting.jpg", "Big Bolection MDF<br>Skirting Board", "£12.68"))
    # 9:16: photo is square, cover-cropped taller; positions scale by 1920/1080 around the crop
    s = 1920 / 1080
    ox = -(1920 - 1080) * 0.45
    pt = lambda x, y: (int(x * s + ox), int(y * s))
    (dx, dy), (px, py), (kx, ky) = pt(444, 588), pt(600, 700), pt(470, 835)
    return (img + f'<div class="abs" style="left:900px;top:1460px">{logo("colour", 104)}</div>'
            f'<div class="abs serif" style="left:90px;top:270px;width:900px;color:{C["slate"]};font-size:60px;font-weight:500;line-height:1.1">One order.<br>Every moulding<br>in the house.</div>'
            + hotspot(dx, dy, 90, dy - 260, "victorian-dado.png", "Victorian MDF<br>Dado Rail", "£17.70")
            + hotspot(px, py, 700, py - 200, "astragal-panel.png", "Astragal MDF<br>Panel Mould", "£9.00")
            + hotspot(kx, ky, 600, ky + 120, "big-bolection-skirting.jpg", "Big Bolection MDF<br>Skirting Board", "£12.68"))


def boards(size):
    tall = size == "9x16"
    px = (1080, 1920) if tall else (1080, 1080)
    sz = 72 if tall else 60
    sub = 32 if tall else 26
    out = [
        board(size, "Lee Whole House | Static | Room photo | Floor plan", "#333",
              editorial_inner(SAGE, E1["line"], E1["sub"], x=80 if not tall else 90, y=170 if not tall else 430, w=700, size=sz,
                              fx=0.25, fy=0.5, size_px=px, sub_size=sub)),
        board(size, "Lee Whole House | Static | Room photo | One order hotspots", "#333", l2_inner(1920 if tall else 1080)),
        board(size, "Lee Whole House | Static | Room photo | Straight lengths", "#333",
              with_soft(editorial_inner(BEIGE, E3["line"] if not tall else "Straight<br>lengths.<br>Fewer joins.", E3["sub"],
                                        x=80 if not tall else 600, y=150 if not tall else 400, w=640 if not tall else 440, size=sz - 6,
                                        fx=0.3 if not tall else 0.85, fy=0.2, size_px=px, sub_size=sub - 2, dark=True),
                        soft(380, 250, 680, 320, light=True, strong=True) if not tall else soft(800, 540, 520, 400, light=True, strong=True))),
        board(size, "Lee Made to Match | Static | Room photo | Can't buy it", "#333",
              editorial_inner(BLUE_DOORS, E4["line"], E4["sub"], x=60 if not tall else 70, y=170 if not tall else 430, w=380, size=sz - 6,
                              fx=0.0, fy=0.5, size_px=px, sub_size=sub - 4, sub_w=380)
              .replace('<div class="abs serif"', SOFT + '<div class="abs serif"', 1)),
        board(size, "Lee Trade | Static | Room photo | Trade account", "#333",
              with_soft(editorial_inner(WHITE, E5["line"], E5["sub"], x=80 if not tall else 90, y=150 if not tall else 400, w=600, size=sz,
                                        fx=0.62 if not tall else 0.45, fy=0.15, size_px=px, sub_size=sub, dark=True),
                        soft(340, 250, 640, 300, light=True, strong=True) if not tall else soft(420, 520, 700, 360, light=True, strong=True))),
    ]
    return out


if __name__ == "__main__":
    write("lee-1x1.html", page("MR | Lee | 1x1", boards("1x1")))
    write("lee-9x16.html", page("MR | Lee | 9x16", boards("9x16")))
    print("wrote lee")
