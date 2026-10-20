"""Logo pieces for the Woburn Sands guideline, cut from the practice's own files (never redrawn).

Inputs (assets/src/):
- "Woburn Sands Full Colour.png": Drive 1-P_OcR85aSXYJzoSMY-JQXQqT8eYGXbr (Content Assets / Pictures).
  Stacked lockup: grey house sketch, green serif wordmark, Kana crown between two rules, gold caps.
- head-logo2-1.svg: woburnsandsdentalpractice.co.uk/wp-content/uploads/2022/06/head-logo2-1.svg,
  the horizontal lockup used in the site header (house left, wordmark right).

Outputs (assets/):
- logo-colour.png       stacked lockup, trimmed
- logo-white.png        true white: the PNG's alpha kept, every pixel set to white (no white file on Drive)
- logo-h-white.png      horizontal lockup from the site SVG with every fill set to white, as the July
                        2026 Meta statics carry it (rendered by build step in render_svg())
- house-colour.png / house-white.png         the house sketch alone (crop of the stacked PNG)
- crown-rule-colour.png / crown-rule-white.png   crown between rules (crop)
- crown-colour.png / crown-white.png         the Kana crown alone (crop)

Usage: /usr/bin/python3 make_assets.py   (needs Pillow; Chrome for the SVG render)
"""
import re
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

HERE = Path(__file__).parent
A = HERE / 'assets'
SRC = A / 'src'
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'


def white(im):
    out = Image.new('RGBA', im.size, (255, 255, 255, 0))
    out.putalpha(im.split()[3])
    return out


def save_pair(im, name):
    im = im.crop(im.getbbox())
    im.save(A / f'{name}-colour.png')
    white(im).save(A / f'{name}-white.png')


def render_svg():
    svg = (SRC / 'head-logo2-1.svg').read_text()
    svg = re.sub(r'fill="#[0-9A-Fa-f]{6}"', 'fill="#FFFFFF"', svg)
    with tempfile.TemporaryDirectory() as d:
        (Path(d) / 'w.svg').write_text(svg)
        (Path(d) / 'p.html').write_text('<html><body style="margin:0;background:transparent">'
                                        '<img src="w.svg" style="display:block;width:2400px"></body></html>')
        shot = Path(d) / 'shot.png'
        subprocess.run([CHROME, '--headless=new', '--disable-gpu', f'--user-data-dir={d}/u',
                        '--allow-file-access-from-files', '--default-background-color=00000000',
                        '--hide-scrollbars', f'--screenshot={shot}', '--window-size=2400,578',
                        f'file://{d}/p.html'], check=True, capture_output=True)
        im = Image.open(shot).convert('RGBA')
        im.crop(im.getbbox()).save(A / 'logo-h-white.png')


def main():
    full = Image.open(SRC / 'Woburn Sands Full Colour.png').convert('RGBA')
    save_pair(full, 'logo')
    # Row bands found from the alpha profile: house 447-1365, wordmark 1372-1629,
    # crown + rules 1700-1829, DENTAL PRACTICE 1888-1981.
    save_pair(full.crop((0, 440, full.width, 1368)), 'house')
    rule = full.crop((0, 1695, full.width, 1834))
    save_pair(rule, 'crown-rule')
    bb = rule.getbbox()
    mid = (bb[0] + bb[2]) // 2
    save_pair(rule.crop((mid - 110, 0, mid + 110, rule.height)), 'crown')
    render_svg()
    for p in sorted(A.glob('*.png')):
        print(p.name, Image.open(p).size)


if __name__ == '__main__':
    main()
