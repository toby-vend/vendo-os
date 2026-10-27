"""Tighten the logo SVGs cropped from the Drive brand sheet (assets/brand/branding.pdf, Drive 1ivs31oHkSXzx_Sfhu9b2Nxm2kyzb6ODo).

pdftocairo keeps the full-page viewBox, so each file gets the bounding box headless Chrome measured for its
visible ink (BOX), the white page-background rect is dropped, and ink / white / navy variants are written by
swapping every colour value. The tooth mark is the single tooth path lifted out of the horizontal lock-up.
Nothing is redrawn.
Usage: python3 clean_logos.py
"""
import re
from pathlib import Path

HERE = Path(__file__).parent / 'assets/logos'
VARIANTS = {'ink': '#231F20', 'white': '#FFFFFF', 'navy': '#1E445B'}
WHITE_RECT = re.compile(r'<g clip-path="url\(#clip-0\)">\s*<path[^>]*fill="rgb\(100%, 100%, 100%\)"[^>]*/>\s*</g>')
BOX = {'horizontal': (99.35, 882.76, 496.20, 915.10), 'stacked': (196.50, 884.45, 394.93, 916.82),
       'roundel': (226.77, 832.88, 359.05, 966.39)}


def write(stem, s, x0, y0, x1, y1, pad=0.0):
    p = (y1 - y0) * pad
    x0, y0, w, h = x0 - p, y0 - p, x1 - x0 + 2 * p, y1 - y0 + 2 * p
    s = re.sub(r'width="[\d.]+(pt)?" height="[\d.]+(pt)?" viewBox="[^"]*"',
               f'width="{w:.2f}" height="{h:.2f}" viewBox="{x0:.2f} {y0:.2f} {w:.2f} {h:.2f}"', s, count=1)
    for name, col in VARIANTS.items():
        (HERE / f'{stem}-{name}.svg').write_text(re.sub(r'rgb\([^)]*\)', col, s))
    print(stem, f'{w:.0f}x{h:.0f}')


for stem, box in BOX.items():
    write(stem, WHITE_RECT.sub('', (HERE / 'src' / f'{stem}.svg').read_text()), *box)

h = (HERE / 'src/horizontal.svg').read_text()
tooth = [p for p in re.findall(r'<path [^>]*/>', h) if 'M 297.507812 912.691406' in p][0]
head = re.search(r'<svg [^>]*>', h).group(0)
write('tooth', f'{head}\n{tooth}\n</svg>\n', 279.0, 882.0, 306.4, 915.2, pad=.03)
