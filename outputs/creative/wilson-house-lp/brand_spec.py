"""One-page brand spec sheet (palette roles + type scale + shapes) for the Phase 1 frame in Figma.

Reads brand.json and writes brand-spec/spec-sheet.html (1440 wide) next to the built brand-spec page, which shows
the arch device on a real team photo, the form, cards, buttons, the waves and curve line, and light, Cream and
Purple sections.
Run after build.py: python3 brand_spec.py
"""
import json
import re
from pathlib import Path

HERE = Path(__file__).parent
b = json.loads((HERE / "brand.json").read_text())
p, t, sh, btn = b["palette"], b["type"], b["shape"], b["button"]
PF = "'Playfair Display', serif"

ROLES = [("ink", "Headlines (Aubergine)"), ("ink2", "Body text (Charcoal)"), ("turn", "Headline turn on light (Purple)"),
         ("dark", "Inverted bands (Wilson Purple)"), ("offer", "Buttons on light (Royal Purple)"), ("btn_on_dark", "Buttons on Purple (Lilac)"),
         ("bg", "Page background"), ("panel", "Alternate band (Cream)"), ("fine", "Frame hairlines, turn on Purple (Blush)"),
         ("accent", "Labels, rating stars, curve (Gold)"), ("tan", "Treatment and team card frames (Tan)"), ("aub", "Steps, why us, final CTA (Aubergine)")]
COL = {**p, "tan": "#B0947B", "aub": "#2A003A"}
faces = "".join(f"@font-face{{font-family:'{f.get('family', b['fonts']['family'])}';src:url(../{f['file']});font-weight:{f['weight']};font-style:{f.get('style', 'normal')}}}"
                for f in b["fonts"]["faces"])


def sw(role, use):
    c = COL[role]
    light = c.upper() in ("#FFFFFF", p["panel"].upper(), p["fine"].upper(), p["btn_on_dark"].upper())
    fg = p["ink"] if light else "#FFFFFF"
    return (f'<div style="height:150px;background:{c};color:{fg};padding:18px;display:flex;flex-direction:column;justify-content:flex-end;'
            f'border:1px solid #EDE6DA"><div style="font-weight:600;font-size:15px">{role}</div>'
            f'<div class="lab" style="font-size:11px;margin-top:4px;color:{fg}">{c}</div><div style="font-size:12px;margin-top:4px;opacity:.85">{use}</div></div>')


def ty(name, spec, sample):
    st = f"font-weight:{spec['weight']};font-size:{spec['size']}px;line-height:{spec.get('line', 1.3)};letter-spacing:{spec.get('tracking', 'normal')};text-transform:{spec.get('case', 'none')};"
    if spec.get("font"):
        st += f"font-family:{spec['font']};"
    fam = "Playfair Display" if "Playfair" in spec.get("font", "") else "Montserrat"
    meta = f"{fam} {spec['weight']} · {spec['size']}px" + (f" / {spec['size_m']}px mobile" if spec.get("size_m") else "")
    return (f'<div style="display:grid;grid-template-columns:200px 1fr;gap:24px;align-items:baseline;padding:22px 0;border-top:1px solid {p["fine"]}">'
            f'<div><div class="lab">{name}</div><div style="font-size:12px;color:{p["muted"]};margin-top:6px">{meta}</div></div>'
            f'<div style="{st}color:{p["ink"]}">{sample}</div></div>')


def shape(name, w, h, fill=None):
    s = (HERE / "assets/shapes" / name).read_text()
    if fill:
        s = re.sub(r'fill="#[0-9A-Fa-f]{6}"', f'fill="{fill}"', s)
    s = re.sub(r'<svg ([^>]*?)width="[^"]*" height="[^"]*"', rf'<svg \1width="{w}" height="{h}" preserveAspectRatio="none"', s, count=1)
    return f'<div style="width:{w}px;height:{h}px;line-height:0">{s}</div>'


html = f"""<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>Wilson House LP brand spec</title><script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script><style>{faces}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:#2a2a2a;padding:80px;font-family:'Montserrat',sans-serif;color:{p['ink2']}}}
.sheet{{width:1440px;background:#fff;padding:80px}}
.lab{{font-weight:600;font-size:13px;letter-spacing:.22em;text-transform:uppercase;color:{p['accent']}}}
b.turn{{font-family:{PF};font-weight:400;font-style:italic;color:{p['turn']}}}
.btn{{display:inline-flex;align-items:center;justify-content:center;height:{btn['height']}px;padding:0 {btn['pad']}px;border-radius:{sh['button']}px;font-weight:{btn['weight']};font-size:{btn['size']}px}}
.cap{{font-size:12px;color:{p['muted']};margin-top:10px}}
</style></head><body><div class="sheet" data-name="Brand spec sheet">
<div class="lab">Landing pages · brand spec</div>
<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:14px">
  <div style="font-family:{PF};font-size:56px;line-height:1.1;color:{p['ink']}">Wilson House, <b class="turn">on the LP kit.</b></div>
  <img src="../assets/logo-colour.png" style="width:130px;display:block">
</div>
<p style="font-size:16px;line-height:1.7;margin-top:16px;max-width:980px">From the brand guideline (Figma IGQz4NTnCHwBgcouPheI90) and the practice website's own shapes. The pages beside this sheet show the arch device on a real team photo, the form, cards, buttons, the waves and gold curve, and the white, Cream and Purple rhythm. Headlines follow the guideline (Playfair Display); the July statics used Montserrat Bold, so that choice is Toby's to confirm.</p>
<div class="lab" style="margin-top:56px">Palette roles</div>
<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-top:18px">{''.join(sw(r, u) for r, u in ROLES)}</div>
<div class="lab" style="margin-top:56px">Type scale</div>
<div style="margin-top:12px">
{ty('Display', t['display'], 'Your new patient check-up, <b class="turn">only £85.</b>')}
{ty('H1', t['h1'], 'One clear price, <b class="turn">X-rays included.</b>')}
{ty('H2', t['h2'], 'Book your check-up')}
{ty('H3', t['h3'], 'Gum health and oral cancer screening')}
{ty('Body', t['body'], 'A full examination, time to talk through any worries, and a clear treatment plan with no hidden fees.')}
{ty('Label', t['label'], 'New patients welcome · Newport Pagnell')}
</div>
<div class="lab" style="margin-top:56px">The website's shapes</div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:28px;margin-top:22px;align-items:end">
  <div><div style="width:200px;height:260px;border:1px solid {p['fine']};border-bottom:0;border-radius:110px 110px 0 0;padding:9px 9px 0"><div style="height:250px;border-radius:91px 91px 0 0;background:url(../assets/team-chest/zakaria.jpg) 50% 20%/cover"></div></div><div class="cap">Arch · 1px Blush hairline, 8–10px inset, open at the bottom</div></div>
  <div><div style="height:180px;border:1px solid {p['fine']};border-right:0;border-radius:90px 0 0 90px;padding:8px 0 8px 8px"><div style="height:162px;border-radius:81px 0 0 81px;background:url(../assets/photos/web/exterior-blossom.jpg) 50% 50%/cover"></div></div><div class="cap">Side arch · bleeds off the page edge</div></div>
  <div><div style="border:1px solid #B0947B;padding:10px 10px 16px"><div style="height:150px;background:url(../assets/photos/web/team-surgery-2.jpg) 50% 15%/cover"></div><div style="font-weight:600;font-size:16px;color:{p['ink']};margin-top:12px">Hygiene &amp; Airflow</div></div><div class="cap">Treatment and team cards · Tan hairline, 10px inset</div></div>
  <div style="display:flex;flex-direction:column;gap:14px;align-items:flex-start">
    <span class="btn" style="background:{p['offer']};color:#fff">Book Appointment</span>
    <span class="btn" style="background:{p['btn_on_dark']};color:{p['ink']}">Book Appointment</span>
    <div style="width:250px;height:48px;border:1px solid {p['fine']};border-radius:{sh['field']}px"></div>
    <div class="cap">Pill buttons (100px) · Royal on light, Lilac on Purple · 24px fields</div></div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:40px">
  <div><div style="background:{p['panel']};padding-top:30px">{shape('wave-top-purple.svg', 624, 44, p['dark'])}<div style="height:40px;background:{p['dark']}"></div></div><div class="cap">Two-layer wave divider, from the site</div></div>
  <div><div style="height:114px;display:flex;align-items:center">{shape('curve-line.svg', 624, 38)}</div><div class="cap">Gold hairline curve, from the site</div></div>
</div>
<div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:28px;margin-top:40px;align-items:end">
  <div><div style="position:relative;height:180px;overflow:hidden;background:#2A003A"><img src="../assets/shapes/crown-watermark.png" style="position:absolute;right:-30px;top:20px;width:260px;opacity:.08"><div style="position:absolute;left:32px;top:48px;font-family:{PF};font-size:76px;color:{p['btn_on_dark']}">01.</div></div><div class="cap">Aubergine sections · crown watermark · steps numbered in Lilac Playfair</div></div>
  <div><div style="display:flex;gap:12px;align-items:center;font-size:15px;color:{p['ink']}"><img src="../assets/crown-gold.png" style="width:20px">Crown bullets replace ticks</div></div>
  <div><img src="../assets/crown-rule-colour.png" style="width:240px"><div class="cap">Crown rule from the logo</div></div>
</div>
</div></body></html>"""
(HERE / "brand-spec" / "spec-sheet.html").write_text(html)
print("wrote brand-spec/spec-sheet.html")
