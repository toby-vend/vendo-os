"""Compound sign statics — native Meta creatives from the 'Vox Pops & Signs' shoot (19 Oct 2026).

Meant not to feel like ads: just the photo, no logo, no CTA. Risk + FCA text sits in a thin
strip at the very bottom. Renders 1:1 and 9:16 for each concept into out/ via headless Chrome.

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
    "S01": dict(name="Month-end sign | Tower Bridge", photos=["IMG_5697.jpg"],
                risk=RISK_B2B, pos={"1x1": "50% 15%", "9x16": "50% 40%"}),
    "S02": dict(name="Month-end sign | Pointing", photos=["IMG_5727.jpg"],
                risk=RISK_B2B, pos={"1x1": "50% 62%", "9x16": "50% 60%"}),
    "S03": dict(name="Admin called / It's sorted | London Bridge", photos=["IMG_5772.jpg", "IMG_5775.jpg"],
                risk=RISK_B2B,
                pos={"1x1": ["50% 50%", "50% 50%"], "9x16": ["50% 45%", "50% 55%"]}),
    "S04": dict(name="Admin called | Tube carriage", photos=["IMG_5779.jpg"],
                risk=RISK_B2B, pos={"1x1": "50% 55%", "9x16": "50% 50%"}),
    "S05": dict(name="Boss sign | Steps", photos=["IMG_5739.jpg"],
                risk=RISK_B2B, pos={"1x1": "50% 75%", "9x16": "50% 70%"}),
    "S06": dict(name="Free your old pensions | Gate", photos=["IMG_5763.jpg"],
                risk=RISK_B2C, pos={"1x1": "50% 55%", "9x16": "50% 40%"}),
}

RATIOS = {"1x1": (1080, 1080), "9x16": (1080, 1920)}


def page(c, ratio):
    w, h = RATIOS[ratio]
    pos = c["pos"][ratio]
    small = ratio == "1x1"
    if len(c["photos"]) == 2:
        # 1:1 splits side by side, 9:16 stacks
        direction = "row" if small else "column"
        photos = "".join(
            f'<div class="half"><img src="../photos/{p}" style="object-position:{xy}"></div>'
            for p, xy in zip(c["photos"], pos))
        media = f'<div class="media split" style="flex-direction:{direction}">{photos}</div>'
    else:
        media = f'<div class="media"><img src="../photos/{c["photos"][0]}" style="object-position:{pos}"></div>'
    return f"""<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500&display=swap" rel="stylesheet">
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{width:{w}px;height:{h}px;overflow:hidden;background:#111}}
body{{display:flex;flex-direction:column}}
.media{{flex:1;min-height:0;overflow:hidden}}
.split{{display:flex;gap:4px;background:#111}}
.half{{flex:1;min-width:0;min-height:0;overflow:hidden}}
img{{display:block;width:100%;height:100%;object-fit:cover}}
.risk{{padding:{18 if small else 24}px {32 if small else 40}px {20 if small else 28}px;
  font-family:'Archivo',sans-serif;font-weight:500;color:rgba(255,255,255,.78);
  font-size:{22 if small else 28}px;line-height:1.32}}
</style></head><body>
{media}
<div class="risk">{c["risk"]}</div>
</body></html>"""


def render(key, ratio):
    w, h = RATIOS[ratio]
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
