"""Apply the 21 Sept brand update (pitch deck v4) to the live canvas artboards.

Operates on the published .dc.html files (not the sec_*.py generators) so edits made
directly in the canvas after 18 Sept (BAC-09, 20, 23) are preserved.

- Palette: Champagne Gold #D2B477 (lead), Light Gold #E5CC98 (highlights), Black #0B0B0B,
  Warm Ivory #F6F1E8. Other gold/cream tints are shifted by the same old->new delta so
  lighting gradients keep their shape.
- Type: Freight Sans Pro Book (Bond's header font, single weight) replaces Archivo + Lato.
  Serif accents (Instrument Serif), handwriting (Caveat) and mono (Courier Prime) stay.
- Logo: official vector lockups/marks from "Bond Aligner Club Logos.pdf" replace the keyed rasters.

Usage: python3 rebrand_sep23.py <in_dir> <out_dir>
"""
import colorsys, os, re, sys

FONT_URL = '/_blob/f54de1e6252368066c25aaa925553f71'
LOGOS = {
    '/_blob/9a4eb86c230345a27566e42c0e7f3976': '/_blob/44c403fb9dcf1d6d69ac4a99b3a259b8',  # lockup gold
    '/_blob/ab8e11ffd14a363fba6d73d4b291f40f': '/_blob/262b111ae0f923dfbeeef66520fdef45',  # lockup black
    '/_blob/38684bdc26d74d87ce9905b96c5d293c': '/_blob/a18e7c5327606623f1d70fcc82f49d84',  # mark gold
    '/_blob/30a913549bd64d0fec1a98b7594259f3': '/_blob/109b752166966bf1b47d2ff6d49fde85',  # mark black
}
SNAP = {
    (0xD2, 0xB7, 0x8C): (0xD2, 0xB4, 0x77),  # Bond Gold -> Champagne Gold
    (0xF3, 0xE6, 0xCC): (0xE5, 0xCC, 0x98),  # metallic highlight -> Light Gold
    (0x0A, 0x0A, 0x0A): (0x0B, 0x0B, 0x0B),  # Black
    (0xFA, 0xF3, 0xE9): (0xF6, 0xF1, 0xE8),  # Cream -> Warm Ivory
}


def _hls(rgb):
    return colorsys.rgb_to_hls(*(c / 255 for c in rgb))


OLD_G, NEW_G = _hls((0xD2, 0xB7, 0x8C)), _hls((0xD2, 0xB4, 0x77))
OLD_C, NEW_C = _hls((0xFA, 0xF3, 0xE9)), _hls((0xF6, 0xF1, 0xE8))


def remap(rgb):
    if rgb in SNAP:
        return SNAP[rgb]
    h, l, s = _hls(rgb)
    if s < 0.12 or not (20 / 360 <= h <= 55 / 360) or l < 0.08:
        return rgb  # neutrals, near-blacks and non-gold hues untouched
    if l >= 0.86:  # cream / paper / specular tints
        h, s, l = h + (NEW_C[0] - OLD_C[0]), s * NEW_C[2] / OLD_C[2], l + (NEW_C[1] - OLD_C[1])
    else:  # gold tints and shades: same hue/sat delta, lightness mapped so old gold -> new gold
        h, s = h + (NEW_G[0] - OLD_G[0]), min(1.0, s * NEW_G[2] / OLD_G[2])
        l = l * NEW_G[1] / OLD_G[1] if l <= OLD_G[1] else NEW_G[1] + (l - OLD_G[1]) * (1 - NEW_G[1]) / (1 - OLD_G[1])
    r, g, b = colorsys.hls_to_rgb(h, max(0, min(1, l)), max(0, min(1, s)))
    return tuple(round(c * 255) for c in (r, g, b))


def hex_sub(m):
    raw = m.group(1)
    if len(raw) == 3:
        return m.group(0)  # #222 / #111 / #000 etc. are neutrals
    new = remap(tuple(int(raw[i:i + 2], 16) for i in (0, 2, 4)))
    return '#' + ''.join(f'{c:02X}' for c in new)


def rgba_sub(m):
    new = remap(tuple(int(x) for x in m.group(2, 3, 4)))
    return f'{m.group(1)}({new[0]},{new[1]},{new[2]}'


FONT_FACE = ("@font-face{font-family:'Freight Sans Pro';src:url(" + FONT_URL + ") format('opentype');"
             "font-weight:100 900;font-style:normal;font-display:block}\n*{font-synthesis:none}\n")


def transform(html):
    html = re.sub(r'#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b', hex_sub, html)
    html = re.sub(r'(rgba?)\((\d+), ?(\d+), ?(\d+)', rgba_sub, html)
    for old, new in LOGOS.items():
        html = html.replace(old, new)
    html = re.sub(r"font-family:\s*'?(Archivo|Lato)'?, sans-serif", "font-family: 'Freight Sans Pro', sans-serif", html)
    html = html.replace('family=Archivo:ital,wdth,wght@0,62..125,100..900;1,62..125,100..900&amp;', '')
    html = html.replace('&amp;family=Lato:ital,wght@0,400;0,700;0,900;1,400', '')
    html = html.replace('<style>\nbody{margin:0}\n', '<style>\n' + FONT_FACE + 'body{margin:0}\n', 1)
    return html


if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    os.makedirs(dst, exist_ok=True)
    for name in sorted(os.listdir(src)):
        if name.endswith('.dc.html'):
            out = transform(open(os.path.join(src, name)).read())
            assert 'Archivo' not in out and "'Lato'" not in out and 'Freight Sans Pro' in out, name
            open(os.path.join(dst, name), 'w').write(out)
            print(name)
