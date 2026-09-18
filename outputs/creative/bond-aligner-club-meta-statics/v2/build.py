"""Build one section's artboards into project/ and render local QA PNGs into qa/.
Usage: python3 build.py a [--render] [--only 01]"""
import sys, os, subprocess, importlib
from lib2 import FMTS, page, B

HERE = os.path.dirname(os.path.abspath(__file__))
sec = sys.argv[1]
mod = importlib.import_module(f'sec_{sec}')
only = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else None
LOCAL = {
    B['lock_gold']: 'uploads/bac-lockup-gold.png', B['lock_black']: 'uploads/bac-lockup-black.png',
    B['mark_gold']: 'uploads/bac-mark-gold.png', B['mark_black']: 'uploads/bac-mark-black.png',
    B['lobby']: 'uploads/mayfair-lobby.jpg', B['grain_light']: 'uploads/grain-light.png',
    B['grain_dark']: 'uploads/grain-dark.png', B['smile']: 'uploads/standin-smile.jpg', B['kev']: 'uploads/kev-patel.jpg', B['crooked']: 'uploads/crooked-smile.jpg',
}
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
os.makedirs(os.path.join(HERE, 'project'), exist_ok=True)
os.makedirs(os.path.join(HERE, 'qa'), exist_ok=True)
written = []
for cid, fn in mod.SECTION:
    if only and cid != only:
        continue
    for fk, w, h, lab in FMTS:
        html = page(f'BAC-{cid} {lab}', w, h, fn(fk, w, h))
        name = 'Main.dc.html' if (cid == '01' and fk == '1x1') else f'BAC-{cid}-{fk}.dc.html'
        open(os.path.join(HERE, 'project', name), 'w').write(html)
        written.append(name)
        if '--render' in sys.argv:
            loc = html
            for blob, path in LOCAL.items():
                loc = loc.replace(blob, 'file://' + os.path.join(HERE, path))
            rp = os.path.join(HERE, 'qa', f'BAC-{cid}-{fk}.html')
            open(rp, 'w').write(loc)
            out = os.path.join(HERE, 'qa', f'BAC-{cid}-{fk}.png')
            subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
                            f'--window-size={w},{h}', '--virtual-time-budget=6000', '--force-device-scale-factor=1',
                            f'--screenshot={out}', 'file://' + rp], capture_output=True, timeout=90)
print('\n'.join(written))
