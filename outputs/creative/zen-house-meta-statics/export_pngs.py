"""Export every board in the harness HTML to a 1080px PNG named with its Meta ad name.

Renders each <persona>-<site>-<size>.html in headless Chrome at 1x (boards sit at x=80+i*1160, y=80),
then crops each board with ffmpeg. Needs the local server: python3 -m http.server 8765.
"""
import glob, os, re, subprocess, tempfile

CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
OUT = 'exports'
H = {'1x1': 1080, '9x16': 1920}

for html in sorted(glob.glob('*-*-*x*.html')):
    m = re.match(r'(\w+)-(\w+)-(1x1|9x16)\.html$', html)
    if not m:
        continue
    persona, site, size = m.groups()
    src = open(html).read()
    boards = re.findall(r'<div class="ab s(?:1|9)" id="(\w\d)-\w+-[\dx]+" data-name="([^"]+)"', src)
    w, h = 80 + len(boards) * 1160, 80 + H[size] + 80
    with tempfile.TemporaryDirectory() as tmp:
        shot = os.path.join(tmp, 'page.png')
        subprocess.run([CHROME, '--headless=new', '--hide-scrollbars', '--force-device-scale-factor=1',
                        f'--window-size={w},{h}', '--virtual-time-budget=8000', f'--screenshot={shot}',
                        f'http://localhost:8765/{html}'], check=True, capture_output=True)
        folder = os.path.join(OUT, f'{persona.capitalize()} {site.capitalize()}')
        os.makedirs(folder, exist_ok=True)
        for i, (cid, name) in enumerate(boards):
            dest = os.path.join(folder, f'{cid} {name.replace("&amp;", "&")}.png')
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', shot, '-vf',
                            f'crop=1080:{H[size]}:{80 + i * 1160}:80', dest], check=True)
    print(html, len(boards))
