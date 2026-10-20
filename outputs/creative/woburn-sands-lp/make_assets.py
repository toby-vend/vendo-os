"""Logo wraps, before-and-after cards and team crops for the Woburn Sands landing pages.

Inputs:
- assets/logo-*.png, crown-*.png, house-*.png: copied from the signed-off guideline harness
  (outputs/creative/woburn-sands-meta-statics/assets, cut from the practice's own files, never redrawn).
- assets/src/head-logo2-1.svg: the site header lockup (woburnsandsdentalpractice.co.uk/wp-content/uploads/2022/06/).
  Its house sketch is drawn in white for the green site header; on the white LP header it is set to Sketch Grey
  #595958, the house line colour of the full-colour logo.
- assets/src/ba/*.jpg: the practice's published smile gallery (woburnsandsdentalpractice.co.uk/smile-gallery,
  read 20 Oct 2026). Gitignored; consent for LP use still to confirm with the practice.
- assets/photos/*.jpg: Joe Goodchild's July 2026 shoot (1800px copies from the guideline harness, gitignored).

Outputs: assets/logo-h-colour.png + .svg, assets/logo-h-white.svg, assets/house-colour.svg (watermark),
assets/ba/*.jpg (before over after, labelled), assets/team/*.jpg (mid-chest crops via tools/team_crop.py).
Usage: /usr/bin/python3 make_assets.py   (needs Pillow and Chrome)
"""
import base64
import re
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).parent
A = HERE / "assets"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
HARNESS = HERE.parents[2] / "scripts/lp-harness"


def wrap_svg(png, out):
    """The harness inlines logos as SVG; wrap the PNG so its colours survive (it is PNG only on Drive)."""
    im = Image.open(png)
    b64 = base64.b64encode(png.read_bytes()).decode()
    out.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {im.width} {im.height}" '
                   f'width="{im.width}" height="{im.height}"><image width="{im.width}" height="{im.height}" href="data:image/png;base64,{b64}"/></svg>')


def render_header_logo():
    svg = (A / "src/head-logo2-1.svg").read_text()
    svg = re.sub(r'fill="#FFFFFF"', 'fill="#595958"', svg)
    with tempfile.TemporaryDirectory() as d:
        (Path(d) / "c.svg").write_text(svg)
        (Path(d) / "p.html").write_text('<html><body style="margin:0;background:transparent">'
                                        '<img src="c.svg" style="display:block;width:2400px"></body></html>')
        shot = Path(d) / "shot.png"
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", f"--user-data-dir={d}/u", "--allow-file-access-from-files",
                        "--default-background-color=00000000", "--hide-scrollbars", f"--screenshot={shot}",
                        "--window-size=2400,578", f"file://{d}/p.html"], check=True, capture_output=True)
        im = Image.open(shot).convert("RGBA")
        im.crop(im.getbbox()).save(A / "logo-h-colour.png")


BA = [("Case-1-B", "Case-1-A", "whitening-1"), ("TW-B2", "TW-A2", "whitening-2"), ("I-B5", "I-A5", "invisalign-1"),
      ("I-B3", "I-A3", "invisalign-2"), ("Case-3-B", "Case-3-A", "implant-1"), ("DI-B2", "DI-A2", "implant-2")]


def ba_cards():
    font = ImageFont.truetype(str(A / "fonts/Jost.ttf"), 26)
    out = A / "ba"
    out.mkdir(exist_ok=True)
    for b, a, name in BA:
        B, Af = (Image.open(A / f"src/ba/{x}.jpg").convert("RGB").resize((796, 320), Image.LANCZOS) for x in (b, a))
        card = Image.new("RGB", (796, 648), "#FFFFFF")
        card.paste(B, (0, 0))
        card.paste(Af, (0, 328))
        d = ImageDraw.Draw(card)
        for y, label in ((0, "BEFORE"), (328, "AFTER")):
            w = d.textlength(label, font=font) + 36
            d.rectangle((0, y, w, y + 44), fill="#1D6340")
            d.text((18, y + 7), label, font=font, fill="#FFFFFF")
        card.save(out / f"{name}.jpg", quality=92)


# Matched by face to the practice's own Meet the Team headshots (read 20 Oct 2026); first names only on the page
TEAM = {"simone": "p4.jpg", "sabrina": "p12.jpg", "boglarka": "p9.jpg", "tessa": "p17.jpg",
        "charlotte": "p15.jpg", "agnieszka": "p8.jpg", "julia": "p5.jpg"}


def team():
    out = A / "team"
    with tempfile.TemporaryDirectory() as d:
        for name, src in TEAM.items():
            (Path(d) / f"{name}.jpg").symlink_to(A / "photos" / src)
        subprocess.run(["python3", str(HARNESS / "tools/team_crop.py"), "crop", str(out),
                        *[str(Path(d) / f"{n}.jpg") for n in TEAM]], check=True)


def main():
    render_header_logo()
    wrap_svg(A / "logo-h-colour.png", A / "logo-h-colour.svg")
    wrap_svg(A / "logo-h-white.png", A / "logo-h-white.svg")
    wrap_svg(A / "house-colour.png", A / "house-colour.svg")
    ba_cards()
    team()
    print("assets done")


if __name__ == "__main__":
    main()
