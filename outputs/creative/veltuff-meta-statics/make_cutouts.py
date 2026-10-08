"""Cut Veltuff packshots (white studio background) out to transparent PNGs.

Background = pixels connected to the border that sit close to the corner colour. Edge alpha is
softened from colour distance, then edge pixels are un-blended from the background colour so no
white fringe shows on black. Output: assets/cutouts/<name>.png, trimmed to the product.
Needs Pillow + numpy (venv python).
"""
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

A = Path(__file__).parent / 'assets'
SRC = A / 'packshots'
OUT = A / 'cutouts'
OUT.mkdir(exist_ok=True)

NAMES = {
    'TR2510_black.jpg': 'cotton-trade-trousers',
    'CW1216L_black_angle_b7306a72-e7d6-490c-9872-ffa997e3eebe.jpg': 'waterproof-bomber',
    'TR2205_ora.jpg': 'cargo-hivis-trousers',
    'TR8825_navy.jpg': 'stretch-multi-pocket',
    'TR9074_black.jpg': 'cargo-hybrid',
    'CW2020_black.jpg': 'bomber-work-jacket',
    'CW6681_black_green_f1563e31-bbf9-4e9e-b4a2-402570f30171.png': 'two-tone-softshell',
    '1500x1500_images_Dec21_222.jpg': 'duratex-sweatshirt',
    'TR5515_black_f7873b04-0088-4323-ac5e-27f86c78fc97.jpg': 'teamline-trousers',
    'HV2264_orange.jpg': 'hivis-sweatshirt',
    'HV8108-2.jpg': 'protex1-jacket',
}


def cut(path, hard=22.0, soft=48.0):
    im = np.asarray(Image.open(path).convert('RGB')).astype('float32')
    h, w, _ = im.shape
    corners = np.array([im[2, 2], im[2, -3], im[-3, 2], im[-3, -3]])
    bg = np.median(corners, axis=0)
    dist = np.sqrt(((im - bg) ** 2).sum(-1))
    # flood from the border through "near background" pixels
    near = dist < soft
    seen = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near[y, x] and not seen[y, x]:
                seen[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near[y, x] and not seen[y, x]:
                seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and near[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx))
    # alpha: background region fades by colour distance between hard..soft, product = 1
    a = np.ones((h, w), 'float32')
    a[seen] = np.clip((dist[seen] - hard) / (soft - hard), 0, 1)
    a = np.asarray(Image.fromarray((a * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(0.6)), 'float32') / 255
    # un-blend the background from semi-transparent edge pixels
    af = np.clip(a, 1e-3, 1)[..., None]
    rgb = np.clip((im - (1 - af) * bg) / af, 0, 255)
    rgba = np.dstack([rgb, a * 255]).astype('uint8')
    out = Image.fromarray(rgba, 'RGBA')
    bbox = out.getchannel('A').point(lambda v: 255 if v > 10 else 0).getbbox()
    return out.crop(bbox)


def lift(name, gamma=0.9, rim=0.45):
    """Lit version for black canvases: open the shadows a touch and add a cool-white rim on top/left edges."""
    im = Image.open(OUT / f'{name}.png').convert('RGBA')
    arr = np.asarray(im).astype('float32')
    rgb, a = arr[..., :3] / 255, arr[..., 3] / 255
    rgb = rgb ** gamma
    # rim: alpha minus alpha shifted down-right = edges facing up-left
    sh = np.zeros_like(a); sh[6:, 6:] = a[:-6, :-6]
    edge = np.clip(a - sh, 0, 1)
    edge = np.asarray(Image.fromarray((edge * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(3)), 'float32') / 255
    rgb = rgb + edge[..., None] * rim * (1 - rgb)
    out = np.dstack([np.clip(rgb, 0, 1) * 255, a * 255]).astype('uint8')
    Image.fromarray(out, 'RGBA').save(OUT / f'{name}-lit.png')


if __name__ == '__main__':
    for src, name in NAMES.items():
        o = cut(SRC / src)
        o.save(OUT / f'{name}.png')
        lift(name)
        print(name, o.size)
