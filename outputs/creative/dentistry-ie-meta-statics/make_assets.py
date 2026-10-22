"""Dentistry IE: photos masked into the heart-tooth mark (PNG, so the Figma capture keeps them).

The site uses this device itself (Rectangle 49.webp is the mark as a photo mask).
Run with a Python that has Pillow:  python make_assets.py
Needs Google Chrome for rasterising assets/mark.svg.
"""
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).parent
P = HERE / 'assets' / 'photos'
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
W, H = 905, 1000  # mark aspect 0.905

MASKS = {  # output name: (source photo, focal x 0-1, focal y 0-1, zoom)
    'mask-team.png': ('dental-implants.png', .5, .32, 1.0),
    'mask-family.png': ('faq-help-image.png', .5, .45, 1.0),
    'mask-smile.png': ('home-hero.png', .55, .42, 1.0),
}


def mark_alpha():
    html = HERE / 'assets' / '_mark.html'
    html.write_text(f'<html><body style="margin:0;background:transparent"><img src="mark.svg" style="display:block;width:{W}px;height:{H}px"></body></html>')
    out = HERE / 'assets' / '_mark.png'
    subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000',
                    f'--window-size={W},{H}', f'--screenshot={out}', html.as_uri()], check=True, capture_output=True)
    a = Image.open(out).convert('RGBA').split()[3]
    html.unlink(); out.unlink()
    # Solid silhouette: flood the outside from a corner, everything not reached is inside the heart.
    pad = Image.new('L', (W + 2, H + 2), 0)
    pad.paste(a.point(lambda v: 255 if v > 100 else 0), (1, 1))
    ImageDraw.floodfill(pad, (0, 0), 128)
    solid = pad.point(lambda v: 0 if v == 128 else 255).crop((1, 1, W + 1, H + 1))
    return solid.filter(ImageFilter.GaussianBlur(1.2))


def cover(im, w, h, fx, fy, zoom):
    s = max(w / im.width, h / im.height) * zoom
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x = min(max(round(im.width * fx - w / 2), 0), im.width - w)
    y = min(max(round(im.height * fy - h / 2), 0), im.height - h)
    return im.crop((x, y, x + w, y + h))


def main():
    a = mark_alpha()
    for name, (src, fx, fy, z) in MASKS.items():
        im = cover(Image.open(P / src).convert('RGB'), W, H, fx, fy, z).convert('RGBA')
        im.putalpha(a)
        im.save(P / name)
        print(name)


if __name__ == '__main__':
    main()
