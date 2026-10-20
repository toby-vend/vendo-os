"""Section divider (not a kit block; the designers add it as an SVG shape divider): one of the client's own
shape SVGs (Wilson House's two-layer waves, gold curve line) drawn full width between two sections.

  {"block": "divider", "svg": "assets/shapes/wave-top-purple.svg", "bg": "bg", "fill": "dark", "h": 100, "h_m": 28,
   "width": 1440, "width_m": 390, "name": "Wave"}
bg is the band behind the shape (the section it comes out of), fill recolours every fill in the SVG (the section
it leads into); both take a palette role or a hex. Leave fill out to keep the SVG's own colours (a line).
"""
import re


def _col(ctx, v):
    return ctx.brand.p.get(v, v) if v else v


def divider(ctx, c, m):
    s = (ctx.brand.root / c["svg"]).read_text()
    if c.get("fill"):
        s = re.sub(r'fill="#[0-9A-Fa-f]{3,6}"', f'fill="{_col(ctx, c["fill"])}"', s)
    W = c.get("width_m", 390) if m else c.get("width", 1440)
    vb = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', s)
    h = c.get("h_m" if m else "h") or round(W * float(vb.group(2)) / float(vb.group(1)))
    s = re.sub(r'<svg ([^>]*?)width="[^"]*" height="[^"]*"', rf'<svg \1width="{W}" height="{h}" preserveAspectRatio="none"', s, count=1)
    if c.get("fill"):  # trim a unit off top and bottom so no hairline of the band shows where the shape meets a section
        s = s.replace(vb.group(0), f'viewBox="0 1 {vb.group(1)} {float(vb.group(2)) - 2:g}"', 1)
    return (f'<div data-name="{c.get("name", "Divider")}" style="height:{h}px;background:{_col(ctx, c.get("bg", "bg"))};'
            f'line-height:0;display:flex;justify-content:center;{c.get("style", "")}">{s}</div>')
