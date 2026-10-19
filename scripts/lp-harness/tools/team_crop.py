#!/usr/bin/env python3
"""Mid-chest-up crops and hero photo specs from face boxes (Apple Vision).

  python3 team_crop.py crop <out-dir> <photo>...   3:4 crops (660x880), head near the top, cut at mid-chest
  python3 team_crop.py spec <photo>...             JSON photo specs for the hero device ({"src","w","h","face"})

Why mid-chest: some team photos are AI-extended below the chest, and patients have messaged staff, so team
photos show first names only and stop at mid-chest (Siha, Oct 2026). Needs Xcode command line tools (swiftc)
and ffmpeg. The Swift helpers compile once into tools/bin/ (gitignored).
"""
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
BIN = HERE / "bin"


def tool(name):
    exe = BIN / name
    if not exe.exists():
        BIN.mkdir(exist_ok=True)
        subprocess.run(["swiftc", "-O", str(HERE / f"{name}.swift"), "-o", str(exe)], check=True)
    return str(exe)


def faces(paths):
    out = subprocess.run([tool("faces"), *map(str, paths)], capture_output=True, text=True, check=True).stdout
    res = {}
    for line in out.strip().splitlines():
        parts = line.rsplit(" ", 6)
        if len(parts) == 7:
            res[parts[0]] = tuple(int(x) for x in parts[1:])
        else:
            res[line.rsplit(" ", 1)[0]] = None
    return res


def crop_box(W, H, x, y, w, h):
    """3:4 box from 1.1 face-heights above the face to 2.7 below (mid-chest), centred on the face."""
    top = max(0, int(y - 1.1 * h))
    bottom = min(H, int(y + 2.7 * h))
    ch = bottom - top
    cw = min(W, int(ch * 3 / 4))
    cx = x + w / 2
    left = int(min(max(0, cx - cw / 2), W - cw))
    return left, top, cw, ch


def main():
    if len(sys.argv) < 3 or sys.argv[1] not in ("crop", "spec"):
        raise SystemExit(__doc__)
    if sys.argv[1] == "spec":
        for p, f in faces(sys.argv[2:]).items():
            if not f:
                print(json.dumps({"src": p, "error": "no face found"}))
                continue
            W, H, x, y, w, h = f
            print(json.dumps({"src": p, "w": W, "h": H, "face": [x, y, w, h]}))
        return
    out = Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    for p, f in faces(sys.argv[3:]).items():
        if not f:
            print(f"{p}: no face found, crop by hand")
            continue
        left, top, cw, ch = crop_box(*f)
        dst = out / (Path(p).stem + ".jpg")
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", p, "-vf", f"crop={cw}:{ch}:{left}:{top},scale=660:880", "-q:v", "3", str(dst)], check=True)
        print(f"{p} -> {dst}")


if __name__ == "__main__":
    main()
