"""Shared design language v2 for the Bond Aligner Club statics (depth, texture, editorial type)."""

GOLD, BLACK, CREAM = '#D2B78C', '#0A0A0A', '#FAF3E9'
B = {
    'lock_gold': '/_blob/9a4eb86c230345a27566e42c0e7f3976',
    'lock_black': '/_blob/ab8e11ffd14a363fba6d73d4b291f40f',
    'mark_gold': '/_blob/38684bdc26d74d87ce9905b96c5d293c',
    'mark_black': '/_blob/30a913549bd64d0fec1a98b7594259f3',
    'lobby': '/_blob/095d6f03ca3b629cfcfdb4824addce9a',
    'grain_light': '/_blob/050e630d7e21da6ae42846d7ea3fbf0c',
    'grain_dark': '/_blob/57b1dd74897935b37c4eaf28dc52054d',
    'smile': '/_blob/ac6fc3d95e09da732e0848aa5fb8f1ab',
    'kev': '/_blob/9b3e632e9855cb4cb0c49649b8a65138',
    'crooked': '/_blob/e331637b6ad4bb9c6b526ce01054e260',
}
FONTS = ('https://fonts.googleapis.com/css2?family=Archivo:ital,wdth,wght@0,62..125,100..900;1,62..125,100..900'
         '&amp;family=Instrument+Serif:ital@0;1&amp;family=Caveat:wght@500;700'
         '&amp;family=Courier+Prime:ital,wght@0,400;0,700;1,400&amp;family=Lato:ital,wght@0,400;0,700;0,900;1,400&amp;display=swap')

SANS = "font-family: 'Archivo', sans-serif;"
SERIF = "font-family: 'Instrument Serif', Georgia, serif; font-style: italic; font-weight: 400;"
BODY = "font-family: 'Lato', sans-serif;"
MONO = "font-family: 'Courier Prime', monospace;"
HAND = "font-family: 'Caveat', cursive;"

FMTS = [('1x1', 1080, 1080, '1:1'), ('4x5', 1080, 1350, '4:5'), ('9x16', 1080, 1920, '9:16')]
# Stories keep type out of the top 250 / bottom 330 (Meta UI).
PAD = {'1x1': (72, 72, 72, 72), '4x5': (84, 80, 84, 80), '9x16': (250, 84, 330, 84)}

# Lighting: tints and shades of the single brand gold, never a new hue.
BG_GOLD = ('radial-gradient(110% 80% at 18% 0%, rgba(255,250,240,0.55) 0%, rgba(255,250,240,0) 58%), '
           'radial-gradient(120% 100% at 100% 100%, rgba(10,10,10,0.26) 0%, rgba(10,10,10,0) 62%), #D2B78C')
BG_BLACK = ('radial-gradient(85% 55% at 50% 0%, rgba(210,183,140,0.17) 0%, rgba(210,183,140,0) 72%), '
            'radial-gradient(90% 60% at 50% 110%, rgba(210,183,140,0.07) 0%, rgba(210,183,140,0) 70%), #0A0A0A')
BG_CREAM = ('radial-gradient(120% 80% at 25% 5%, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0) 60%), '
            'radial-gradient(130% 100% at 100% 100%, rgba(10,10,10,0.08) 0%, rgba(10,10,10,0) 62%), #FAF3E9')

SHADOW_DEEP = '0 50px 90px -30px rgba(10,10,10,0.6), 0 18px 36px -12px rgba(10,10,10,0.45)'
SHADOW_SOFT = '0 30px 60px -24px rgba(10,10,10,0.45), 0 8px 18px -8px rgba(10,10,10,0.3)'


def v(f, a, b, c):
    return {'1x1': a, '4x5': b, '9x16': c}[f]


def ink(bg):
    return GOLD if bg == 'black' else BLACK


def grain(kind='light', opacity=0.5, blend='overlay'):
    cls = 'gl' if kind == 'light' else 'gd'
    return (f'<div class="{cls}" style="position: absolute; left: 0; top: 0; right: 0; bottom: 0; opacity: {opacity}; '
            f'mix-blend-mode: {blend}; pointer-events: none;"></div>')


def lockup(tone, w=220, align='flex-start'):
    c = GOLD if tone == 'gold' else BLACK
    src = B['lock_gold'] if tone == 'gold' else B['lock_black']
    return (f'<div style="display: flex; flex-direction: column; align-items: {align}; gap: 12px; flex-shrink: 0;">'
            f'<img src="{src}" alt="Bond Aligner Club" style="width: {w}px; height: auto; display: block;">'
            f'<div style="{BODY} font-size: 18px; font-weight: 700; letter-spacing: 5px; text-transform: uppercase; color: {c};">by Bond Dental London</div></div>')


ARROW = ('<svg width="30" height="18" viewBox="0 0 30 18" fill="none" stroke="currentColor" stroke-width="2.4" '
         'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 9h27M20 1.5L28 9l-8 7.5"/></svg>')


def cta(tone, text='Book a consultation', size=21):
    c = GOLD if tone == 'gold' else BLACK
    return (f'<div style="display: flex; align-items: center; gap: 14px; color: {c}; {BODY} font-size: {size}px; font-weight: 900; '
            f'letter-spacing: 3px; text-transform: uppercase; padding-bottom: 10px; border-bottom: 2px solid {c}; white-space: nowrap;">'
            f'{text}{ARROW}</div>')


def footer(tone, right=None, lw=220):
    right = cta(tone) if right is None else right
    return (f'<div style="display: flex; justify-content: space-between; align-items: flex-end; gap: 28px; flex-shrink: 0;">'
            f'{lockup(tone, lw)}{right}</div>')


def spacer(hpx):
    return f'<div style="height: {hpx}px; flex-shrink: 0;"></div>'


def grow(n=1):
    return f'<div style="flex-grow: {n};"></div>'


def page(title, w, h, body):
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link href="{FONTS}" rel="stylesheet">
<style>
body{{margin:0}}
.gl{{background-image:url({B['grain_light']});background-size:320px 320px}}
.gd{{background-image:url({B['grain_dark']});background-size:320px 320px}}
</style>
</helmet>
{body}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{w},"height":{h}}}}}'>
class Component extends DCLogic {{
renderVals() {{
return {{}};
}}
}}
</script>
</body>
</html>
'''


def frame(w, h, bg_css, ink_col, layers_under, content, layers_over, pad):
    """Root artboard: background + absolute deco layers + flex content column + overlays."""
    t, r, b, l = pad
    return (f'<div style="width: {w}px; height: {h}px; position: relative; overflow: hidden; background: {bg_css}; color: {ink_col}; {BODY}">'
            f'{layers_under}'
            f'<div style="position: absolute; left: 0; top: 0; width: {w}px; height: {h}px; box-sizing: border-box; padding: {t}px {r}px {b}px {l}px; '
            f'display: flex; flex-direction: column;">{content}</div>'
            f'{layers_over}</div>')
