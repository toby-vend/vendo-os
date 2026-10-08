"""Render outlined word-wall patterns (the site's sale-banner background) to transparent PNGs.

CSS text-stroke doesn't survive Figma capture, so the walls are baked to images.
Usage: python3 make_patterns.py  (needs the local server on :8781 serving this folder)
"""
import subprocess
from pathlib import Path

HERE = Path(__file__).parent
CH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
FONT = """@font-face{font-family:'Saira';src:url('assets/fonts/Saira-Italic[wdth,wght].ttf') format('truetype');font-weight:100 900;font-style:italic}"""

PATTERNS = {
    # name: (word, font px, rows, stroke colour, width, height)
    'pattern-sale': ('SALE', 150, 8, 'rgba(210,240,0,.30)', 2400, 1300),
    'pattern-blackfriday': ('BLACK FRIDAY', 150, 14, 'rgba(210,240,0,.30)', 2400, 2200),
}


def html(word, size, rows, colour, w, h):
    line = (word + '&nbsp; ') * 12
    rows_html = ''.join(
        f'<div style="position:absolute;left:{-(r % 2) * size * 1.3}px;top:{r * size * .98 - size * .2}px;white-space:nowrap">{line}</div>'
        for r in range(rows))
    return (f'<!doctype html><html><head><style>{FONT}html,body{{margin:0;background:transparent;width:{w}px;height:{h}px;overflow:hidden}}'
            f'div{{font-family:Saira;font-style:italic;font-weight:900;font-size:{size}px;line-height:1;color:transparent;'
            f'-webkit-text-stroke:3px {colour};text-transform:uppercase}}</style></head><body>{rows_html}</body></html>')


for name, (word, size, rows, colour, w, h) in PATTERNS.items():
    src = HERE / f'_{name}.html'
    src.write_text(html(word, size, rows, colour, w, h))
    subprocess.run([CH, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--virtual-time-budget=4000',
                    '--default-background-color=00000000', f'--window-size={w},{h}',
                    f'--screenshot={HERE / "assets" / (name + ".png")}', f'http://localhost:8781/_{name}.html'],
                   check=True, capture_output=True)
    src.unlink()
    print('wrote', name)
