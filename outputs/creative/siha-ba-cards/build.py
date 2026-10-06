"""Siha before-and-after cards: before on top, Siha logo band in the middle, after underneath (1080x1350).

Usage: python3 build.py -> cards.html (all cards in a grid; capture to Figma, crop to PNGs with render.sh)
Photos: Siha shared Drive treatment folders (Composite Bonding, Ceramic Veneers, Aligners, Whitening + Airflow),
downscaled into assets/ba/ (gitignored).
"""
import re
from pathlib import Path

ROOT = Path(__file__).parent
SM = ROOT.parent / "siha-lp-smile-makeover" / "assets"
C = dict(od="#14211a", ol="#293425", be="#e1d5ca", nu="#eae3de", bo="#ab6f4b")

# key, treatment (Figma layer name + LP caption), Drive folder / case
CASES = [("cb04", "Composite bonding + whitening", "Composite Bonding / Case 4"),
         ("cv02", "Ceramic veneers", "Ceramic Veneers / Case 2"),
         ("cb06", "Composite bonding", "Composite Bonding / Case 6"),
         ("al02", "Clear aligners", "Aligners / Case 2"),
         ("cb17", "Whitening + composite bonding", "Composite Bonding / Case 17"),
         ("cb08", "Composite bonding", "Composite Bonding / Case 8"),
         ("cb21", "Whitening + composite bonding", "Composite Bonding / Case 21"),
         ("wh04", "Whitening", "Whitening + Airflow / Case 4"),
         ("cb26", "Whitening + composite bonding", "Composite Bonding / Case 26"),
         ("cb01", "Composite bonding + whitening", "Composite Bonding / Case 1")]


def logo():
    s = (SM / "logo-dark.svg").read_text()
    s = re.sub(r"<\?xml.*?\?>|<!DOCTYPE.*?>", "", s, flags=re.S)
    s = re.sub(r'fill:#[0-9a-fA-F]{6};?', "", s)
    return s.replace('width="100%" height="100%"', 'class="logo" fill="currentColor"', 1)


LOGO = logo()
CSS = f"""
@font-face {{ font-family: Metropolis; src: url(../siha-lp-smile-makeover/assets/fonts/Metropolis-SemiBold.otf); font-weight: 600; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ background: #2a2a2a; font-family: Metropolis, sans-serif; padding: 80px; display: flex; flex-wrap: wrap; gap: 80px; width: {80 * 2 + 1080 * 5 + 80 * 4}px; }}
.card {{ position: relative; width: 1080px; height: 1350px; background: {C['od']}; overflow: hidden; flex: none; }}
.ph {{ position: absolute; left: 0; width: 1080px; height: 600px; background-size: cover; background-position: 50% 50%; background-repeat: no-repeat; }}
.tag {{ position: absolute; left: 40px; padding: 12px 22px; border-radius: 999px; background: rgba(20,33,26,.82); color: {C['nu']};
        font-weight: 600; font-size: 22px; letter-spacing: .16em; text-transform: uppercase; }}
.band {{ position: absolute; left: 0; top: 600px; width: 1080px; height: 150px; display: flex; align-items: center; justify-content: center; color: {C['be']}; }}
.logo {{ display: block; width: 230px; height: auto; }}
"""


def card(key, treatment, source):
    return f"""<div class="card" id="{key}" data-name="Siha B&amp;A | {treatment} | {source} | 4x5">
  <div class="ph" data-name="Before" style="top:0;background-image:url(assets/ba/{key}-before.jpg)"></div>
  <span class="tag" style="top:36px">Before</span>
  <div class="band" data-name="Logo band">{LOGO}</div>
  <div class="ph" data-name="After" style="top:750px;background-image:url(assets/ba/{key}-after.jpg)"></div>
  <span class="tag" style="top:786px">After</span>
</div>"""


if __name__ == "__main__":
    html = ("<!doctype html><html lang='en-GB'><head><meta charset='utf-8'><title>Siha before and after cards</title>"
            f"<style>{CSS}</style><script src='https://mcp.figma.com/mcp/html-to-design/capture.js' async></script></head><body>"
            + "".join(card(*c) for c in CASES) + "</body></html>")
    (ROOT / "cards.html").write_text(html)
    print("wrote cards.html")
