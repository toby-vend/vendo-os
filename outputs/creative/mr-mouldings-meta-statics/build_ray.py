"""Ray (commercial fit-out) statics: 5 concepts x 1:1 and 9:16. Copy: copy-ray.md.
Fire rated claims limited to what the MR site states: Euroclass B, FR equivalents across the range.
Hotspot prices are the 'from' prices shown on each product page (3 Oct 2026); recheck before launch."""
from common import C, logo, photo, frame, board, page, write, editorial_inner, hotspot, cta

STAIR = "img-7557-karen.jpg"                                   # stair with runner, communal feel
PANELLED = "double-astragal-dado-sunningdale-panel-mould.jpg"  # dado, panel moulds, skirting
STAIR_ABOVE = "bolection-dado-astragal-panel-mould-1.jpg"      # stair well from above
DOORS = "img-6735-karen.jpg"                                   # repeated panelled doors
DOOR = "img-4694.jpg"                                          # door, architrave, plain wall

STONE_BG = f'<div class="fill" style="background:{C["stone"]}"></div>'


def split(img, side, eyebrow, headline, body, cta_label, fx=0.5, fy=0.5, tall=False, hl_size=None):
    """Stone panel + room photo, the layout Toby was happy with (no cards, no spec rules)."""
    W, H = 1080, (1920 if tall else 1080)
    if not tall:
        px = 0 if side == "left" else 540
        tx = 600 if side == "left" else 70
        ph = photo(px, 0, 540, H, img, fx=fx, fy=fy)
        lg = f'<div class="abs" style="left:{tx}px;top:70px">{logo("colour", 104)}</div>'
        txt = (f'<div class="abs eyebrow" style="left:{tx}px;top:250px;width:420px;color:{C["teal"]};font-size:16px">{eyebrow}</div>'
               f'<div class="abs hl" style="left:{tx}px;top:290px;width:420px;color:{C["slate"]};font-size:{hl_size or 50}px">{headline}</div>'
               f'<div class="abs body" style="left:{tx}px;top:{560 if (hl_size or 50) <= 50 else 600}px;width:400px;color:{C["ink_soft"]};font-size:23px">{body}</div>'
               f'<div class="abs" style="left:{tx}px;top:955px">{cta(cta_label, "teal", (60, 16, 26))}</div>')
        return STONE_BG + ph + lg + txt
    ph = photo(0, 0, W, 1060, img, fx=fx, fy=fy)
    txt = (f'<div class="abs eyebrow" style="left:90px;top:1110px;width:900px;color:{C["teal"]};font-size:19px">{eyebrow}</div>'
           f'<div class="abs hl" style="left:90px;top:1155px;width:900px;color:{C["slate"]};font-size:{(hl_size or 50) + 14}px">{headline}</div>'
           f'<div class="abs body" style="left:90px;top:1330px;width:880px;color:{C["ink_soft"]};font-size:28px">{body}</div>'
           f'<div class="abs" style="left:90px;top:1490px">{cta(cta_label, "teal")}</div>'
           f'<div class="abs" style="left:840px;top:1474px">{logo("colour", 100)}</div>')
    return STONE_BG + ph + txt


def r2_inner(tall=False):
    if not tall:
        return (photo(0, 0, 1080, 1080, PANELLED, fx=0.5, fy=0.5)
                + f'<div class="abs" style="left:56px;top:52px">{logo("colour", 104)}</div>'
                + f'<div class="abs serif" style="left:260px;top:60px;width:560px;color:{C["slate"]};font-size:46px;font-weight:500;line-height:1.1">Same profiles.<br>Fire rated.</div>'
                + hotspot(225, 495, 60, 395, "fr-double-astragal-dado.jpg", "Double Astragal FR<br>MDF Dado Rail", "£30.00")
                + hotspot(285, 552, 60, 620, "fr-sunningdale-panel.jpg", "Sunningdale FR<br>MDF Panel Mould", "£30.00")
                + hotspot(360, 915, 430, 950, "fr-big-bolection-skirting.jpg", "Big Bolection FR<br>MDF Skirting Board", "£19.14"))
    return (photo(0, 0, 1080, 1920, PANELLED, fx=0.5, fy=0.5)
            + f'<div class="abs" style="left:90px;top:1470px">{logo("white", 104)}</div>'
            + f'<div class="abs serif" style="left:90px;top:280px;width:420px;color:{C["slate"]};font-size:62px;font-weight:500;line-height:1.1">Same profiles.<br>Fire rated.</div>'
            + hotspot(92, 896, 300, 740, "fr-double-astragal-dado.jpg", "Double Astragal FR<br>MDF Dado Rail", "£30.00")
            + hotspot(177, 975, 300, 1080, "fr-sunningdale-panel.jpg", "Sunningdale FR<br>MDF Panel Mould", "£30.00")
            + hotspot(284, 1493, 420, 1380, "fr-big-bolection-skirting.jpg", "Big Bolection FR<br>MDF Skirting Board", "£19.14"))


def boards(size):
    tall = size == "9x16"
    px = (1080, 1920) if tall else (1080, 1080)
    r4 = editorial_inner(DOORS, "Forty units.<br>One spec.", "Euroclass B skirting and<br>architrave in the same<br>profile, flat after flat.",
                         x=80 if not tall else 90, y=170 if not tall else 430, w=700, size=72 if tall else 62,
                         fx=0.3, fy=0.5, size_px=px, sub_size=32 if tall else 26, dark=True)
    return [
        board(size, "Ray Fire Rated | Static | Room photo | Euroclass B range", "#333",
              split(STAIR, "left", "Fire rated MDF · Euroclass B", "Euroclass B, in every moulding.",
                    "Skirting, architrave, panel mould, dado, picture rail and cornice, from one range.", "Shop fire rated",
                    fx=0.4, tall=tall)),
        board(size, "Ray Fire Rated | Static | Room photo | Period profiles hotspots", "#333", r2_inner(tall)),
        board(size, "Ray Fire Rated | Static | Room photo | Where it's needed", "#333",
              split(STAIR_ABOVE, "right", "Where fire rated trim goes", "Fire rated where it counts.",
                    "Escape routes. Communal areas in flats and HMOs. Anywhere Building Control asks. A standard domestic room doesn't need it.",
                    "Shop fire rated", fx=0.5, tall=tall)),
        board(size, "Ray Fire Rated | Static | Room photo | Multi-unit", "#333", r4),
        board(size, "Ray Fire Rated | Static | Room photo | Paperwork", "#333",
              split(DOOR, "left", "Before you order", "Ask for the paperwork first.",
                    "Every fire rated product is marked Euroclass B. Tell us what your sign-off needs and we'll tell you what we can supply.",
                    "Call 01372 740777", fx=0.75, tall=tall)),
    ]


if __name__ == "__main__":
    write("ray-1x1.html", page("MR | Ray | 1x1", boards("1x1")))
    write("ray-9x16.html", page("MR | Ray | 9x16", boards("9x16")))
    print("wrote ray")
