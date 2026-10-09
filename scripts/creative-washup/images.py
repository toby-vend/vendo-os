"""Download a preview image for every creative into <run-dir>/site/img/c<i>.jpg.

    python3 -I scripts/creative-washup/images.py <run-dir>

Artifact pages cannot load images from other sites, so each preview ships
with the page. Facebook CDN thumbnails expire, so when a download fails or is
not an image, a frame is pulled from the video with ffmpeg instead. Images are
shrunk to 640px with sips to keep the page light.
"""
import json
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

RUN = sys.argv[1]
c = json.load(open(os.path.join(RUN, 'creatives.json')))
raw_dir = os.path.join(RUN, 'img-raw')
out_dir = os.path.join(RUN, 'site', 'img')
os.makedirs(raw_dir, exist_ok=True)
os.makedirs(out_dir, exist_ok=True)


def is_image(path):
    try:
        with open(path, 'rb') as f:
            head = f.read(12)
        return head[:3] == b'\xff\xd8\xff' or head[:8] == b'\x89PNG\r\n\x1a\n' or head[8:12] == b'WEBP'
    except OSError:
        return False


def fetch(i):
    x = c[i]
    raw = os.path.join(raw_dir, str(i))
    url = x['image'] if (x['image'] and not x['is_video']) else (x['preview'] or x['thumb'] or x['image'] or x['cardImg'])
    if url:
        subprocess.run(['curl', '-s', '-m', '60', '-o', raw, url], check=False)
    if not is_image(raw) and x.get('video'):
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-ss', '1.5', '-i', x['video'], '-frames:v', '1',
                        '-y', raw + '.jpg'], check=False)
        if os.path.exists(raw + '.jpg'):
            os.replace(raw + '.jpg', raw)
    dst = os.path.join(out_dir, f'c{i}.jpg')
    if is_image(raw):
        subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '68', '-Z', '640', raw, '--out', dst],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
    return i if os.path.exists(dst) else None


with ThreadPoolExecutor(12) as pool:
    done = [r for r in pool.map(fetch, range(len(c))) if r is not None]
missing = sorted(set(range(len(c))) - set(done))
print(f'{len(done)} images, {len(missing)} missing: {missing[:20]}')
