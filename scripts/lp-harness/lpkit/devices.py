"""The brand's graphic device: the shape that frames the hero photo (and any other "signature" photo).

This is the single biggest thing that stops a page reading as a recoloured template, so it comes from the
client's guideline, not from the kit. Types:
  sframe   Siha's S-frame: top half rounded left, bottom half rounded right
  arch     an arch (top fully rounded), common in dental and aesthetic brands
  rounded  a plain rounded rectangle at the brand's photo radius
  circle   a circle (fw is used for both sides)
Optional cut-out: the person, background removed (tools/cutout.py), layered over the frame so the head breaks
out of the top edge. The frame's bottom edge sits at mid-chest (team photos are mid-chest up only).

Optional hairline ("line": colour, "inset": px): a 1px frame drawn `inset` px outside the photo, open at the bottom
edge, following the device's shape (Wilson House's website frames every photo this way).

Photo spec (from tools/team_crop.py --json): {"src", "w", "h", "head_top", "chest", "face_cx", "cutout"?}.
"""


def _place(spec, fw, fh, fill=.86):
    """Scale and offset the photo inside a fw x fh frame. Three ways to say what shows:
      head_top/chest/face_cx  head_top..chest fills `fill` of the height, chest on the bottom edge (cut-out break-out)
      rows [top, bottom] + cx exactly these source rows fill the frame (photo only, no break-out)
      face [x, y, w, h]       a face box: from 1.1 face-heights above to 2.7 below (mid-chest)"""
    W = spec["w"]
    if "rows" in spec:
        t, b = spec["rows"]
        s = fh / (b - t)
        left, top = min(0, max(fw - W * s, fw / 2 - spec["cx"] * s)), -t * s
    elif "face" in spec:
        fx, fy, fwd, fhd = spec["face"]
        y0, y1 = max(0, fy - 1.1 * fhd), fy + 2.7 * fhd  # a tight portrait has no headroom: never leave the frame top empty
        s = max(fh / (y1 - y0), fw / W)
        left, top = min(0, max(fw - W * s, fw / 2 - s * (fx + fwd / 2))), -s * y0
    else:
        s = fh * fill / (spec["chest"] - spec["head_top"])
        left, top = fw / 2 - s * spec["face_cx"], fh - s * spec["chest"]
    return W * s, spec["h"] * s, left, top


def frame(ctx, spec, fw, fh, cutout=None):
    kind = ctx.brand.device.get("type", "rounded")
    use_cut = ctx.brand.device.get("cutout", True) if cutout is None else cutout
    use_cut = use_cut and bool(spec.get("cutout"))
    w, h, left, top = _place(spec, fw, fh, ctx.brand.device.get("fill", .86))
    bg = f"background-image:url({spec['src']});background-size:{w:.0f}px {h:.0f}px;"
    if kind == "sframe":
        shape = (f'<div class="sframe" data-name="Photo" style="position:absolute;left:0;top:0;width:{fw}px;height:{fh}px">'
                 f'<div class="t" style="{bg}background-position:{left:.0f}px {top:.0f}px"></div>'
                 f'<div class="b" style="{bg}background-position:{left:.0f}px {top - fh / 2:.0f}px"></div></div>')
    else:
        radius = {"arch": f"{fw / 2:.0f}px {fw / 2:.0f}px var(--photo-r) var(--photo-r)",
                  "circle": "50%", "rounded": "var(--photo-r)"}.get(kind, "var(--photo-r)")
        hh = fw if kind == "circle" else fh
        shape = (f'<div data-name="Photo" style="position:absolute;left:0;top:{fh - hh}px;width:{fw}px;height:{hh}px;border-radius:{radius};'
                 f'{bg}background-repeat:no-repeat;background-position:{left:.0f}px {top - (fh - hh):.0f}px"></div>')
    accent = ctx.brand.device.get("backdrop")  # optional flat shape behind the frame, e.g. an offset accent block
    back = ""
    if accent:
        back = (f'<div data-name="Backdrop" style="position:absolute;left:{accent.get("dx", 24)}px;top:{accent.get("dy", 24)}px;width:{fw}px;height:{fh}px;'
                f'border-radius:{ "var(--photo-r)" if kind != "arch" else f"{fw / 2:.0f}px {fw / 2:.0f}px var(--photo-r) var(--photo-r)"};background:var(--{accent.get("color", "panel")})"></div>')
    line = ctx.brand.device.get("line")
    if line:  # hairline frame, open at the bottom, `inset` px outside the photo
        i = ctx.brand.device.get("inset", 8) + 1
        hh = fw if kind == "circle" else fh
        r = {"arch": f"{fw / 2 + i:.0f}px {fw / 2 + i:.0f}px 0 0", "circle": "50%"}.get(kind, "0")
        back += (f'<div data-name="Frame line" style="position:absolute;left:-{i}px;top:{fh - hh - i}px;width:{fw + 2 * i}px;height:{hh + i}px;'
                 f'border:1px solid {line};border-bottom:0;border-radius:{r}"></div>')
    if not use_cut:
        return back + shape
    # breakout "top": the head breaks out of the top edge only; "all": free above and to the sides, flush at the bottom
    if spec.get("breakout", "top") == "all":
        ox, oy = 200, 200
    else:
        ox, oy = 0, 40
    cut = (f'<div data-name="Cut-out clip" style="position:absolute;left:-{ox}px;top:-{oy}px;width:{fw + 2 * ox}px;height:{fh + oy}px;overflow:hidden">'
           f'<img data-name="Cut-out" src="{spec["cutout"]}" '
           f'style="position:absolute;left:{left + ox:.0f}px;top:{top + oy:.0f}px;width:{w:.0f}px;height:{h:.0f}px;max-width:none"></div>')
    return back + shape + cut
