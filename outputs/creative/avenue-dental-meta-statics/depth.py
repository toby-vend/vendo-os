"""Baked depth layers for the Avenue statics: lit panel textures and cut-out people with rim light and cast shadow.

Baked to image files because the Figma capture drops CSS filters and blend modes. Needs Pillow and numpy:
python3 -m venv .venv && .venv/bin/pip install pillow numpy, then run build.py with .venv/bin/python.
Cut-outs live in assets/photos/cutouts (gitignored, made with Magnific background removal from the licensed stock file).
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageFilter

ROOT = Path(__file__).parent
WEB = ROOT / "assets/photos/web"
CUT = ROOT / "assets/photos/cutouts"
FX = WEB / "fx"


def _hex(c):
    return tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))


def crop_box(W, H, w, h, fx=.5, fy=.5, zoom=1.0):
    """Same cover-crop geometry as build.crop(), in source pixels."""
    if W / H > w / h:
        ch, cw = H, H * w / h
    else:
        cw, ch = W, W * h / w
    cw, ch = cw / zoom, ch / zoom
    x = min(max(fx * W - cw / 2, 0), W - cw)
    y = min(max(fy * H - ch / 2, 0), H - ch)
    return x, y, cw, ch


def _cover(img, w, h, fx=.5, fy=.5, zoom=1.0):
    x, y, cw, ch = crop_box(*img.size, w, h, fx, fy, zoom)
    return img.crop((round(x), round(y), round(x + cw), round(y + ch))).resize((w, h), Image.LANCZOS)


def panel(w, h, glows=(), src="lounge-blur.jpg", key="panel", base=.16, ink="#1B1B1B", tone="#3A2F22", light="#B8925A", vignette=.55):
    """A flat brand colour lit like a room: the lounge photo blurred out and kept as a faint `tone` of light and shade,
    pools of `light` at `glows` [(x, y, radius, strength)], and edges darkened by `vignette`."""
    out = FX / f"{key}-{w}x{h}.jpg"
    FX.mkdir(parents=True, exist_ok=True)
    img = _cover(Image.open(WEB / src).convert("RGB"), w, h).filter(ImageFilter.GaussianBlur(max(w, h) / 22))
    a = np.asarray(img).astype(np.float32) / 255
    lum = a.mean(axis=2, keepdims=True)
    ink = np.array(_hex(ink), np.float32) / 255
    warm = np.array(_hex(tone), np.float32) / 255
    a = ink + warm * (lum - lum.mean()) * base * 4  # the room's light and shade, faintly, in warm tones
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    gold = np.array(_hex(light), np.float32) / 255
    for gx, gy, r, s in glows:
        d = np.exp(-(((xx - gx) ** 2 + (yy - gy) ** 2) / (2 * r * r)))[..., None]
        a = a + (gold - a) * d * s
    v = (((xx - w / 2) / (w * .75)) ** 2 + ((yy - h / 2) / (h * .75)) ** 2)[..., None]
    a = a * (1 - np.clip(v, 0, 1) * vignette)
    Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).save(out, quality=92)
    return f"assets/photos/web/fx/{out.name}"


def person(cut, board, frame, fx=.5, fy=.5, zoom=1.0, key="person", shadow_clip=None,
           light=(-1, -1), rim="#E8CF9F", rim_strength=.5, shadow=(26, 34, 34, .6)):
    """A cut-out person baked onto a transparent board-sized PNG, aligned pixel for pixel with
    photo(src, *frame, fx, fy, zoom) so it sits exactly over the person in the photo.
    Adds edge decontamination, a warm rim light from `light` (dx, dy direction the light comes from)
    and a soft cast shadow (dx, dy, blur, opacity) limited to `shadow_clip` (x0, y0, x1, y1)."""
    bw, bh = board
    x0, y0, w, h = frame
    out = FX / f"{key}-{bw}x{bh}.png"
    FX.mkdir(parents=True, exist_ok=True)
    src = Image.open(CUT / cut).convert("RGBA")
    p = _cover(src, w, h, fx, fy, zoom)
    r, g, b, al = p.split()
    al = al.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(.8))  # drop the light fringe
    # rim light: the band just inside the edge, weighted towards the light direction
    inner = al.filter(ImageFilter.MinFilter(7)).filter(ImageFilter.GaussianBlur(2))
    edge = np.asarray(ImageChops.subtract(al, inner)).astype(np.float32) / 255
    A = np.asarray(al).astype(np.float32) / 255
    gy, gx = np.gradient(A)
    facing = np.clip(-(gx * light[0] + gy * light[1]) * 6, 0, 1)
    facing = np.asarray(Image.fromarray((facing * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))).astype(np.float32) / 255
    rim_a = np.clip(edge * (.35 + facing * 1.6), 0, 1) * rim_strength
    rgb = np.dstack([np.asarray(c).astype(np.float32) for c in (r, g, b)]) / 255
    rc = np.array(_hex(rim), np.float32) / 255
    rgb = rgb + (1 - rgb) * rc * rim_a[..., None]  # screen
    lit = Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8)).convert("RGBA")
    lit.putalpha(al)
    layer = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    if shadow:
        dx, dy, blur, op = shadow
        sh = Image.new("L", (bw, bh), 0)
        sh.paste(al, (x0 + dx, y0 + dy))
        sh = sh.filter(ImageFilter.GaussianBlur(blur)).point(lambda v: round(v * op))
        if shadow_clip:
            m = Image.new("L", (bw, bh), 0)
            m.paste(255, shadow_clip)
            sh = ImageChops.multiply(sh, m.filter(ImageFilter.GaussianBlur(2)))
        black = Image.new("RGBA", (bw, bh), (8, 6, 4, 0))
        black.putalpha(sh)
        layer = Image.alpha_composite(layer, black)
    person_layer = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    person_layer.paste(lit, (x0, y0))
    layer = Image.alpha_composite(layer, person_layer)
    layer.save(out)
    return f"assets/photos/web/fx/{out.name}"
