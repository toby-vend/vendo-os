"""Lee (small renovation firm) statics: 5 concepts x 1:1 and 9:16, in MR's Instagram editorial and hotspot styles.
Copy: copy-lee.md. Product prices from the live Shopify catalogue (3 Oct 2026); recheck before launch."""
from common import C, logo, photo, board, page, write, editorial_inner, hotspot

SAGE = "img-3345.jpg"               # sage wall, radiator cover, window
CORRIDOR = "img-3333a.jpg"          # long skirting run down a corridor
BLUE_DOORS = "img-7583-karen.jpg"   # blue doors and architrave
GREY = "done-img-6455-karen.jpg"    # sage-green WC, big plain wall
STAIRWELL = "victorian-dado-astragal-panel-mould-big-bolection-skirting.jpg"

SOFT = ('<div class="fill" data-name="Soft shadow" style="background:radial-gradient(ellipse 620px 520px at 18% 24%, '
        'rgba(15,35,40,.62) 0%, rgba(15,35,40,.35) 45%, rgba(15,35,40,0) 100%)"></div>')

E1 = dict(line="Send us the<br>floor plan.", sub="We'll work out every length of skirting,<br>architrave and rail, so you can price the job.")
E3 = dict(line="Straight lengths.<br>Fewer joins.", sub="MDF that won't cup or twist, in lengths up to 4.2m.")
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
              editorial_inner(CORRIDOR, E3["line"] if not tall else "Straight<br>lengths.<br>Fewer joins.", E3["sub"], x=600 if not tall else 640, y=170 if not tall else 430, w=440, size=sz - 10,
                              fx=0.95, fy=0.5, size_px=px, sub_size=sub - 4)),
        board(size, "Lee Made to Match | Static | Room photo | Can't buy it", "#333",
              editorial_inner(BLUE_DOORS, E4["line"], E4["sub"], x=60 if not tall else 70, y=170 if not tall else 430, w=380, size=sz - 6,
                              fx=0.0, fy=0.5, size_px=px, sub_size=sub - 4, sub_w=380)
              .replace('<div class="abs serif"', SOFT + '<div class="abs serif"', 1)),
        board(size, "Lee Trade | Static | Room photo | Trade account", "#333",
              editorial_inner(GREY, E5["line"], E5["sub"], x=80 if not tall else 90, y=170 if not tall else 430, w=600, size=sz,
                              fx=0.5, fy=0.3, size_px=px, sub_size=sub)),
    ]
    return out


if __name__ == "__main__":
    write("lee-1x1.html", page("MR | Lee | 1x1", boards("1x1")))
    write("lee-9x16.html", page("MR | Lee | 9x16", boards("9x16")))
    print("wrote lee")
