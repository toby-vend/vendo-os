"""Bake Veltuff's Black November identity pieces to transparent PNGs (CSS outline text and glows don't survive Figma capture).

Matches Veltuff's draft banner (assets/src/black-november-ref.png): outlined neon-lime "BLACK" with glow,
letter-spaced solid "NOVEMBER", scalloped % badge. Set in Saira (brand font) at its widest width axis.
Also writes the dark chevron backgrounds with Pillow.
Usage: python3 make_lockups.py  (needs the local server on :8781; chevrons need the venv python)
"""
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
A = HERE / 'assets'
CH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
SIG = '#D2F000'
FONT = ("@font-face{font-family:'SairaV';src:url('assets/fonts/Saira[wdth,wght].ttf') format('truetype');font-weight:100 900;font-stretch:50% 125%}"
        "@font-face{font-family:'SairaVI';src:url('assets/fonts/Saira-Italic[wdth,wght].ttf') format('truetype');font-weight:100 900;font-stretch:50% 125%}")

PIECES = {
    'bn-lockup': (1400, 560, f"""
<div style="position:absolute;left:0;right:0;top:40px;text-align:center;font-family:SairaV;font-stretch:125%;font-weight:600;font-size:300px;line-height:1;letter-spacing:.01em;
color:transparent;-webkit-text-stroke:9px {SIG};text-shadow:0 0 22px rgba(210,240,0,.75),0 0 60px rgba(210,240,0,.35)">BLACK</div>
<div style="position:absolute;left:478px;top:28px;width:260px;height:14px;border-radius:50%;background:radial-gradient(closest-side,rgba(240,255,140,1),rgba(210,240,0,.6) 40%,rgba(210,240,0,0))"></div>
<div style="position:absolute;left:250px;top:330px;width:200px;height:12px;border-radius:50%;background:radial-gradient(closest-side,rgba(240,255,140,.9),rgba(210,240,0,.5) 40%,rgba(210,240,0,0))"></div>
<div style="position:absolute;left:0;right:0;top:372px;text-align:center;font-family:SairaV;font-stretch:125%;font-weight:700;font-size:112px;line-height:1;letter-spacing:.42em;padding-left:.42em;color:{SIG}">NOVEMBER</div>
"""),
    'bf-lockup': (1400, 560, f"""
<div style="position:absolute;left:0;right:0;top:40px;text-align:center;font-family:SairaV;font-stretch:125%;font-weight:600;font-size:300px;line-height:1;letter-spacing:.01em;
color:transparent;-webkit-text-stroke:9px {SIG};text-shadow:0 0 22px rgba(210,240,0,.75),0 0 60px rgba(210,240,0,.35)">BLACK</div>
<div style="position:absolute;left:478px;top:28px;width:260px;height:14px;border-radius:50%;background:radial-gradient(closest-side,rgba(240,255,140,1),rgba(210,240,0,.6) 40%,rgba(210,240,0,0))"></div>
<div style="position:absolute;left:250px;top:330px;width:200px;height:12px;border-radius:50%;background:radial-gradient(closest-side,rgba(240,255,140,.9),rgba(210,240,0,.5) 40%,rgba(210,240,0,0))"></div>
<div style="position:absolute;left:0;right:0;top:372px;text-align:center;font-family:SairaV;font-stretch:125%;font-weight:700;font-size:112px;line-height:1;letter-spacing:.42em;padding-left:.42em;color:{SIG}">FRIDAY</div>
"""),
    'bn-badge': (420, 420, f"""
<svg width="420" height="420" viewBox="0 0 420 420" style="position:absolute;left:0;top:0;filter:drop-shadow(0 0 14px rgba(210,240,0,.55))">
<polygon fill="none" stroke="{SIG}" stroke-width="16" stroke-linejoin="round" points="{' '.join(f'{210+ (180 if i%2==0 else 150)*__import__("math").cos(__import__("math").pi*i/12)},{210+(180 if i%2==0 else 150)*__import__("math").sin(__import__("math").pi*i/12)}' for i in range(24))}"/>
<circle cx="160" cy="160" r="28" fill="none" stroke="{SIG}" stroke-width="16"/><circle cx="260" cy="260" r="28" fill="none" stroke="{SIG}" stroke-width="16"/>
<line x1="270" y1="140" x2="150" y2="280" stroke="{SIG}" stroke-width="18" stroke-linecap="round"/></svg>"""),
}


def chrome(name, w, h, body):
    src = HERE / f'_{name}.html'
    src.write_text(f'<!doctype html><html><head><style>{FONT}html,body{{margin:0;background:transparent;width:{w}px;height:{h}px;overflow:hidden;position:relative}}</style></head><body>{body}</body></html>')
    subprocess.run([CH, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--virtual-time-budget=4000', '--default-background-color=00000000',
                    f'--window-size={w},{h}', f'--screenshot={A / (name + ".png")}', f'http://localhost:8781/_{name}.html'], check=True, capture_output=True)
    src.unlink()


def chevrons():
    import numpy as np
    from PIL import Image, ImageFilter
    for name, (W, H) in {'chevron-1x1': (1080, 1080), 'chevron-9x16': (1080, 1920)}.items():
        y, x = np.mgrid[0:H, 0:W].astype('float32')
        u = x * 0.55 + np.abs(y - H / 2) * 0.55          # right-pointing chevrons
        band = (np.mod(u, 180) < 70).astype('float32')
        base = 11 + band * 9                               # #0B0B0B with #141414 bands
        vign = 1 - 0.35 * (((x - W / 2) / W) ** 2 + ((y - H / 2) / H) ** 2) * 2
        img = Image.fromarray(np.clip(base * vign, 0, 255).astype('uint8')).filter(ImageFilter.GaussianBlur(1.2)).convert('RGB')
        img.save(A / f'{name}.png')


if __name__ == '__main__':
    if 'chevrons' in sys.argv:
        chevrons()
    else:
        for n, (w, h, b) in PIECES.items():
            chrome(n, w, h, b)
    print('done')
