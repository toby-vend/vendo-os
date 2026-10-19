"""Compound sign statics — native Meta creatives from the 'Vox Pops & Signs' shoot (19 Oct 2026).

Photo is the ad: full-bleed shot, white Compound logo, one short line, risk + FCA text on a
bottom fade. Renders 1:1 and 9:16 for each concept into out/ via headless Chrome.

    python3 build.py            # all
    python3 build.py S01 S06    # some
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent
OUT = ROOT / "out"
HTML = ROOT / "html"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

FCA = ("Compound Digital Ltd is an appointed representative of RiskSave Technologies Ltd, "
       "which is authorised and regulated by the Financial Conduct Authority (FRN 775330).")
RISK_B2B = ("Capital at risk. The value of investments can go down as well as up and members may get back "
            "less than is paid in. Tax rules can change. Compound does not provide financial advice. " + FCA)
RISK_B2C = ("Capital at risk. The value of investments can go down as well as up and you may get back less "
            "than you put in. Transferring is not right for everyone. Check for exit fees or benefits you may "
            "lose. Compound does not provide financial advice. " + FCA)

# pos = CSS object-position per ratio (x% y%); pair = two photos shown as a before/after split
CONCEPTS = {
    "S01": dict(name="Month-end sign | Tower Bridge", photos=["IMG_5697.jpg"], line="See how it works →",
                risk=RISK_B2B, pos={"1x1": "50% 15%", "9x16": "50% 40%"}),
    "S02": dict(name="Month-end sign | Pointing", photos=["IMG_5727.jpg"], line="See how it works →",
                risk=RISK_B2B, pos={"1x1": "50% 62%", "9x16": "50% 60%"}),
    "S03": dict(name="Admin called / It's sorted | London Bridge", photos=["IMG_5772.jpg", "IMG_5775.jpg"],
                line="See how it works →", risk=RISK_B2B,
                pos={"1x1": ["50% 50%", "50% 50%"], "9x16": ["50% 45%", "50% 55%"]}),
    "S04": dict(name="Admin called | Tube carriage", photos=["IMG_5779.jpg"], line="See how it works →",
                risk=RISK_B2B, pos={"1x1": "50% 55%", "9x16": "50% 50%"}),
    "S05": dict(name="Boss sign | Steps", photos=["IMG_5739.jpg"], line="Book a demo →",
                risk=RISK_B2B, pos={"1x1": "50% 75%", "9x16": "50% 70%"}),
    "S06": dict(name="Free your old pensions | Gate", photos=["IMG_5763.jpg"], line="One search. One app. Easy.",
                risk=RISK_B2C, pos={"1x1": "50% 55%", "9x16": "50% 40%"}),
}

RATIOS = {
    # w, h, top safe, photo height. The photo sits above a dark text band so the risk copy never
    # covers a sign; on 9:16 the band text ends above the bottom ~330px Stories/Reels UI zone.
    "1x1": (1080, 1080, 48, 880),
    "9x16": (1080, 1920, 250, 1330),
}


def page(c, ratio):
    w, h, top, ph = RATIOS[ratio]
    pos = c["pos"][ratio]
    small = ratio == "1x1"
    if len(c["photos"]) == 2:
        # 1:1 splits side by side, 9:16 stacks
        direction = "row" if small else "column"
        photos = "".join(
            f'<div class="half"><img src="../photos/{p}" style="object-position:{xy}"></div>'
            for p, xy in zip(c["photos"], pos))
        media = f'<div class="split" style="flex-direction:{direction}">{photos}</div>'
    else:
        media = f'<img class="bg" src="../photos/{c["photos"][0]}" style="object-position:{pos}">'
    return f"""<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600&family=Archivo+Black&display=swap" rel="stylesheet">
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{width:{w}px;height:{h}px;overflow:hidden;background:#0E0716}}
.bg,.half img{{width:100%;height:100%;object-fit:cover;filter:contrast(1.04) saturate(1.06)}}
.bg{{position:absolute;left:0;top:0;width:100%;height:{ph}px}}
.split{{position:absolute;left:0;top:0;right:0;height:{ph}px;display:flex;gap:6px;background:#0E0716}}
.half{{flex:1;overflow:hidden}}
.top{{position:absolute;left:0;right:0;top:0;height:{top + 200}px;
  background:linear-gradient(rgba(14,7,22,.45),rgba(14,7,22,0))}}
.logo{{position:absolute;left:{56 if small else 64}px;top:{top + 8}px;width:{190 if small else 230}px;
  filter:drop-shadow(0 2px 8px rgba(0,0,0,.35))}}
.foot{{position:absolute;left:0;right:0;top:{ph - 90}px;bottom:0;padding:90px {56 if small else 64}px 0;
  background:linear-gradient(rgba(14,7,22,0),#0E0716 90px)}}
.line{{font-family:'Archivo Black',sans-serif;color:#fff;font-size:{44 if small else 58}px;line-height:1.1;
  letter-spacing:-.01em;margin-bottom:{18 if small else 26}px;text-shadow:0 2px 12px rgba(0,0,0,.3)}}
.risk{{font-family:'Archivo',sans-serif;font-weight:500;color:rgba(255,255,255,.92);
  font-size:{17 if small else 22}px;line-height:1.38}}
</style></head><body>
{media}
<div class="top"></div>
<img class="logo" src="../logo.svg">
<div class="foot"><div class="line">{c["line"]}</div><div class="risk">{c["risk"]}</div></div>
</body></html>"""


def render(key, ratio):
    w, h, *_ = RATIOS[ratio]
    src = HTML / f"{key}-{ratio}.html"
    src.write_text(page(CONCEPTS[key], ratio))
    png = OUT / f"Compound_{key}_{ratio}.png"
    subprocess.run([CHROME, "--headless=new", "--hide-scrollbars", "--force-device-scale-factor=1",
                    f"--window-size={w},{h}", "--virtual-time-budget=6000",
                    f"--screenshot={png}", src.resolve().as_uri()],
                   check=True, capture_output=True)
    print(png.name)


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    HTML.mkdir(exist_ok=True)
    for key in sys.argv[1:] or CONCEPTS:
        for ratio in RATIOS:
            render(key, ratio)
