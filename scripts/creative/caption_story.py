"""Burn TikTok-style captions (black text on white rounded line boxes) onto 1080x1920 story images."""
import json
import os
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

# TikTok Sans (OFL): https://github.com/google/fonts/tree/main/ofl/tiktoksans. Set TIKTOK_SANS to the .ttf path.
FONT = os.environ.get("TIKTOK_SANS", str(Path(__file__).parent / "fonts/tiktok.ttf"))
SIZE = 50
MAX_W = 840
PAD_X, PAD_Y, RADIUS = 22, 12, 16


def load_font():
    f = ImageFont.truetype(FONT, SIZE)
    f.set_variation_by_axes([36, 100, 620, 0])  # opsz, width, weight, slant
    return f


def greedy(text, font, draw, max_w):
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = f"{cur} {w}".strip()
        if not cur or draw.textlength(trial, font=font) <= max_w:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    lines.append(cur)
    return lines


def wrap(text, font, draw):
    """Balanced wrap: keep the greedy line count but shrink the width until lines are even (no widows)."""
    n = len(greedy(text, font, draw, MAX_W))
    lo, hi = 100, MAX_W
    while lo < hi:
        mid = (lo + hi) // 2
        if len(greedy(text, font, draw, mid)) <= n:
            hi = mid
        else:
            lo = mid + 1
    return greedy(text, font, draw, lo)


def render(src, dst, text, y):
    img = Image.open(src).convert("RGB")
    draw = ImageDraw.Draw(img)
    font = load_font()
    lines = wrap(text, font, draw)
    asc, desc = font.getmetrics()
    line_h = asc + desc + PAD_Y * 2 - 6  # boxes overlap slightly so they read as one shape
    cx = img.width // 2
    for i, line in enumerate(lines):
        w = draw.textlength(line, font=font)
        top = y + i * line_h
        draw.rounded_rectangle(
            [cx - w / 2 - PAD_X, top, cx + w / 2 + PAD_X, top + asc + desc + PAD_Y * 2],
            radius=RADIUS, fill=(255, 255, 255),
        )
    for i, line in enumerate(lines):
        w = draw.textlength(line, font=font)
        draw.text((cx - w / 2, y + i * line_h + PAD_Y), line, font=font, fill=(18, 18, 18))
    img.save(dst, quality=92)


if __name__ == "__main__":
    spec = json.loads(Path(sys.argv[1]).read_text())
    src_dir, out_dir = Path(spec["src"]), Path(spec["out"])
    out_dir.mkdir(parents=True, exist_ok=True)
    for item in spec["items"]:
        render(src_dir / item["file"], out_dir / item["file"], item["text"], item.get("y", 230))
        print("ok", item["file"])
