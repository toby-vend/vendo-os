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


def icon():
    s = (SM / "shape.svg").read_text()
    s = re.sub(r"<\?xml.*?\?>|<!DOCTYPE.*?>", "", s, flags=re.S)
    s = re.sub(r'fill:#[0-9a-fA-F]{6};?', "", s)
    return s.replace('width="100%" height="100%"', 'class="icon" fill="currentColor"', 1)


ICON = icon()
CSS = f"""
@font-face {{ font-family: Metropolis; src: url(../siha-lp-smile-makeover/assets/fonts/Metropolis-SemiBold.otf); font-weight: 600; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ background: #2a2a2a; font-family: Metropolis, sans-serif; padding: 80px; display: flex; flex-wrap: wrap; gap: 80px; width: {80 * 2 + 1080 * 5 + 80 * 4}px; }}
.card {{ position: relative; width: 1080px; height: 1350px; overflow: hidden; flex: none; }}
.ph {{ position: absolute; background-size: cover; background-position: 50% 50%; background-repeat: no-repeat; }}
.tag {{ position: absolute; font-weight: 600; font-size: 20px; letter-spacing: .2em; text-transform: uppercase; }}
.icon {{ display: block; width: 100%; height: auto; }}
"""
GRAIN = ("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>"
         "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.9 0'/></filter>"
         "<rect width='100%' height='100%' filter='url(%23n)'/></svg>")


def badge(cx, cy, d=128):
    """Guideline device: Dark Olive circle with the Beige S, sitting on the dividing line."""
    return (f'<div data-name="Logo" style="position:absolute;left:{cx - d // 2}px;top:{cy - d // 2}px;width:{d}px;height:{d}px;border-radius:50%;'
            f'background:{C["od"]};display:flex;align-items:center;justify-content:center;color:{C["be"]};box-shadow:0 0 0 10px rgba(20,33,26,.12)">'
            f'<div style="width:{int(d * .42)}px">{ICON}</div></div>')


def tag(text, x, y, color):
    return f'<span class="tag" style="left:{x}px;top:{y}px;color:{color}">{text}</span>'


def card_line(key, treatment, source):
    """Guideline layout 2: before top, after bottom, Dark Olive line with the S badge in the middle."""
    return f"""<div class="card" id="{key}-line" data-name="Siha B&amp;A | Line | {treatment} | {source} | 4x5" style="background:{C['nu']}">
  <div class="ph" data-name="Before" style="left:0;top:0;width:1080px;height:675px;background-image:url(assets/ba/{key}-before.jpg)"></div>
  <div class="ph" data-name="After" style="left:0;top:675px;width:1080px;height:675px;background-image:url(assets/ba/{key}-after.jpg)"></div>
  <div data-name="Line" style="position:absolute;left:0;top:669px;width:1080px;height:12px;background:{C['od']}"></div>
  {badge(540, 675)}
  <span class="tag" style="left:48px;top:44px;padding:12px 20px;border-radius:999px;background:{C['nu']};color:{C['od']}">Before</span>
  <span class="tag" style="left:48px;top:1258px;padding:12px 20px;border-radius:999px;background:{C['nu']};color:{C['od']}">After</span>
  <div style="position:absolute;inset:0;background-image:url(&quot;{GRAIN}&quot;);opacity:.06;mix-blend-mode:overlay"></div>
</div>"""


def card_s(key, treatment, source):
    """Guideline layout 1: S-frame split on Dark Olive. Before fills the top bowl, after the bottom bowl."""
    return f"""<div class="card" id="{key}-s" data-name="Siha B&amp;A | S-frame | {treatment} | {source} | 4x5" style="background:{C['od']}">
  <div style="position:absolute;inset:0;background:radial-gradient(circle at 20% 15%,rgba(76,93,70,.55),transparent 55%)"></div>
  <div class="ph" data-name="Before" style="left:216px;top:0;width:864px;height:675px;border-radius:9999px 0 0 9999px;background-image:url(assets/ba/{key}-before.jpg)"></div>
  <div class="ph" data-name="After" style="left:0;top:675px;width:864px;height:675px;border-radius:0 9999px 9999px 0;background-image:url(assets/ba/{key}-after.jpg)"></div>
  {tag('Before', 48, 300, C['be'])}
  {tag('After', 916, 1000, C['be'])}
  <div style="position:absolute;left:48px;top:48px;width:64px;color:{C['be']}">{ICON}</div>
  <div style="position:absolute;inset:0;background-image:url(&quot;{GRAIN}&quot;);opacity:.08;mix-blend-mode:overlay"></div>
</div>"""


if __name__ == "__main__":
    html = ("<!doctype html><html lang='en-GB'><head><meta charset='utf-8'><title>Siha before and after cards</title>"
            f"<style>{CSS}</style><script src='https://mcp.figma.com/mcp/html-to-design/capture.js' async></script></head><body>"
            + "{cards}</body></html>")
    (ROOT / "cards-line.html").write_text(html.replace("{cards}", "".join(card_line(*c) for c in CASES)))
    (ROOT / "cards-s.html").write_text(html.replace("{cards}", "".join(card_s(*c) for c in CASES)))
    print("wrote cards-line.html, cards-s.html")
