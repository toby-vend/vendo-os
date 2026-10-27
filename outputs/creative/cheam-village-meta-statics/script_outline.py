"""Outline Tuesday Night text as SVG paths, so the script renders in Figma without the font installed.

Figma's servers and the web app only see fonts the Figma font helper has loaded, so captured Tuesday Night
text falls back to a sans. This writes one SVG per line from assets/fonts/TuesdayNight-Regular.ttf, with the
baseline where Chrome puts it for line-height:1 (hhea metrics, content area centred in the line box), so the
outline sits exactly where the live text did. Needs fontTools (pip install fonttools).

Usage: python3 script_outline.py '<json list of {id, chars, fs, rgb}>'  ->  prints JSON list of {id, svg, w, h}
"""
import json
import sys
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

FONT = TTFont(Path(__file__).parent / 'assets/fonts/TuesdayNight-Regular.ttf')
UPM = FONT['head'].unitsPerEm
ASC, DESC = FONT['hhea'].ascent, -FONT['hhea'].descent
CMAP, GLYPHS, HMTX = FONT.getBestCmap(), FONT.getGlyphSet(), FONT['hmtx']
KERN = {}
if 'kern' in FONT:
    for t in FONT['kern'].kernTables:
        KERN.update(t.kernTable)


def outline(chars, fs, rgb):
    s = fs / UPM
    baseline = (fs - (ASC + DESC) * s) / 2 + ASC * s
    pen = SVGPathPen(GLYPHS)
    x, prev, xmin, xmax = 0.0, None, 1e9, -1e9
    for ch in chars:
        g = CMAP.get(ord(ch))
        if g is None:
            continue
        if prev and (prev, g) in KERN:
            x += KERN[(prev, g)]
        GLYPHS[g].draw(TransformPen(pen, (s, 0, 0, -s, x * s, baseline)))
        x += HMTX[g][0]
        prev = g
    d = pen.getCommands()
    # Script swashes overhang the advance box, so pad generously and let Figma trim.
    pad = fs * .6
    w, h = x * s + 2 * pad, fs + 2 * pad
    col = '#%02X%02X%02X' % tuple(rgb)
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w:.1f}" height="{h:.1f}" viewBox="{-pad:.1f} {-pad:.1f} {w:.1f} {h:.1f}">'
           f'<path d="{d}" fill="{col}"/></svg>')
    return svg, pad


if __name__ == '__main__':
    out = []
    for t in json.loads(sys.argv[1]):
        svg, pad = outline(t['chars'], t['fs'], t['rgb'])
        out.append({'id': t['id'], 'svg': svg, 'pad': pad})
    print(json.dumps(out))
