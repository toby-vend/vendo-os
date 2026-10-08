"""Generate Veltuff texture assets (needs Pillow + numpy; run with a venv python).

Writes into assets/:
  logo-{lime,white,black}.png  official wordmark (veltuff.co.uk CDN PNG), trimmed + recoloured
  v-{lime,white,black}.png     the V glyph cut from the official wordmark (for the roundel)
  grain.png, dust.png          film grain + the scuffed black of the site's sale banners
  lime-tex.png                 mottled lime card that sits under the torn-paper edge
  tear-top.png                 lime card with a torn bottom edge, paper fibre and cast shadow
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

A = Path(__file__).parent / 'assets'
rng = np.random.default_rng(7)
LIME = (168, 213, 0)


def logos():
    im = Image.open(A / 'src' / 'logo-green.png').convert('RGBA')
    im = im.crop(im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox())
    a = im.getchannel('A')
    for name, rgb in [('lime', LIME), ('white', (255, 255, 255)), ('black', (0, 0, 0))]:
        Image.merge('RGBA', [Image.new('L', im.size, c) for c in rgb] + [a]).save(A / f'logo-{name}.png')
    col = np.array(a) > 8
    x0 = np.where(col.any(0))[0][0]
    x1 = next(i for i in range(x0, im.size[0]) if not col[:, i].any())
    va = a.crop((x0, 0, x1, im.size[1]))
    for name, rgb in [('lime', LIME), ('white', (255, 255, 255)), ('black', (0, 0, 0))]:
        Image.merge('RGBA', [Image.new('L', va.size, c) for c in rgb] + [va]).save(A / f'v-{name}.png')


def lime_card(w, h):
    base = np.array(LIME, 'float32')
    m = rng.normal(0, 1, (h // 4 + 1, w // 4 + 1))
    m = Image.fromarray(((m * 40) + 128).clip(0, 255).astype('uint8')).resize((w, h), Image.BICUBIC).filter(ImageFilter.GaussianBlur(6))
    m = np.array(m, 'float32') / 255 - .5
    k = (1 + m * .35 + rng.normal(0, 1, (h, w)) * .035)[..., None]
    return Image.fromarray((base * k).clip(0, 255).astype('uint8'))


def textures():
    n = rng.normal(128, 40, (1080, 1080)).clip(0, 255).astype('uint8')
    Image.fromarray(n, 'L').convert('RGB').save(A / 'grain.png')
    W = H = 2160
    a = np.zeros((H, W), 'float32')
    for _ in range(2600):
        x, y = rng.integers(0, W), rng.integers(0, H)
        r = rng.choice([1, 1, 1, 2, 2, 3, 4])
        a[max(0, y - r):y + r, max(0, x - r):x + r] = rng.uniform(.25, .9)
    for _ in range(70):
        x, y, L, ang = rng.integers(0, W), rng.integers(0, H), rng.integers(20, 140), rng.uniform(0, np.pi)
        for t in range(L):
            xx, yy = int(x + t * np.cos(ang)), int(y + t * np.sin(ang))
            if 0 <= xx < W and 0 <= yy < H:
                a[yy, xx] = max(a[yy, xx], rng.uniform(.15, .5))
    al = Image.fromarray((a * 255).astype('uint8'), 'L').filter(ImageFilter.GaussianBlur(.7))
    Image.merge('RGBA', [Image.new('L', (W, H), 235)] * 3 + [al]).save(A / 'dust.png')
    lime_card(1080, 1080).save(A / 'lime-tex.png')


def tear():
    """Lime card torn along its bottom edge: ragged line, white paper fibre, soft cast shadow."""
    W, H, edge = 2600, 520, 300
    xs = np.arange(0, W + 8, 8)
    walk = np.cumsum(rng.normal(0, 3.2, xs.size))
    walk -= np.linspace(walk[0], walk[-1], xs.size)
    jag = rng.normal(0, 2.2, xs.size)
    y = edge + walk * .9 + jag
    fibre = y + 10 + np.abs(rng.normal(0, 7, xs.size))  # paper core shows below the lime face
    def poly(yy):
        return [(0, 0)] + [(float(x), float(v)) for x, v in zip(xs, yy)] + [(W, 0)]
    shadow = Image.new('L', (W, H), 0)
    ImageDraw.Draw(shadow).polygon(poly(fibre + 14), fill=150)
    shadow = shadow.filter(ImageFilter.GaussianBlur(14))
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    out.paste(Image.new('RGBA', (W, H), (0, 0, 0, 255)), (0, 0), shadow)
    fm = Image.new('L', (W, H), 0)
    ImageDraw.Draw(fm).polygon(poly(fibre), fill=255)
    paper = np.full((H, W, 3), 226, 'float32') + rng.normal(0, 14, (H, W, 1))
    out.paste(Image.fromarray(paper.clip(0, 255).astype('uint8')).convert('RGBA'), (0, 0), fm.filter(ImageFilter.GaussianBlur(.6)))
    lm = Image.new('L', (W, H), 0)
    ImageDraw.Draw(lm).polygon(poly(y), fill=255)
    out.paste(lime_card(W, H).convert('RGBA'), (0, 0), lm.filter(ImageFilter.GaussianBlur(.5)))
    out.save(A / 'tear-top.png')
    out.transpose(Image.FLIP_TOP_BOTTOM).save(A / 'tear-bottom.png')


if __name__ == '__main__':
    logos()
    textures()
    tear()
    print('assets written')
