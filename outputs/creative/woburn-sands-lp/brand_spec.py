"""Woburn Sands: one-page brand spec sheet (palette roles + type scale + shapes) for the Phase 1 sign-off frame in Figma.

Reads brand.json and writes brand-spec/spec-sheet.html (1440 wide) next to the built brand-spec page, which shows
the device on a real team photo, a card, buttons, the form, and light, panel and dark sections.
Run after build.py: python3 brand_spec.py
"""
import json
from pathlib import Path

HERE = Path(__file__).parent
b = json.loads((HERE / "brand.json").read_text())
p, t, sh, btn = b["palette"], b["type"], b["shape"], b["button"]

ROLES = [("ink", "Headings, light-tone buttons (Woburn Green)"), ("ink2", "Body text"), ("muted", "Captions"),
         ("bg", "Page background"), ("panel", "Alternate band (Paper)"), ("accent", "Labels, stars, headline turn (Crown Gold)"),
         ("mist", "Buttons and turn on green (Mist)"), ("dark", "Inverted bands (Woburn Green)"),
         ("dark2", "Crown cards (Fern)"), ("fine", "Hairlines (Sage)"), ("btn_on_dark_fg", "Text on Mist (Ink)")]
faces = "".join(f"@font-face{{font-family:'{f.get('family', b['fonts']['family'])}';src:url(../{f['file']});font-weight:{f['weight']};font-style:{f.get('style', 'normal')}}}"
                for f in b["fonts"]["faces"])


def sw(role, use):
    c = p[role]
    light = c.upper() in ("#FFFFFF", p["panel"].upper(), p["fine"].upper(), p["mist"].upper())
    fg = p["ink"] if light else "#FFFFFF"
    return (f'<div style="height:150px;background:{c};color:{fg};padding:18px;display:flex;flex-direction:column;justify-content:flex-end;'
            f'border:1px solid #E3ECE7"><div style="font-weight:600;font-size:15px">{role}</div>'
            f'<div class="lab" style="font-size:11px;margin-top:4px;color:{fg}">{c}</div><div style="font-size:12px;margin-top:4px;opacity:.85">{use}</div></div>')


def ty(name, spec, sample):
    st = f"font-weight:{spec['weight']};font-size:{spec['size']}px;line-height:{spec.get('line', 1.3)};letter-spacing:{spec.get('tracking', 'normal')};text-transform:{spec.get('case', 'none')};"
    if spec.get("font"):
        st += f"font-family:{spec['font']};"
    meta = f"{spec.get('font', 'Manrope').strip(chr(39)).split(',')[0].strip(chr(39))} {spec['weight']} · {spec['size']}px" + (f" / {spec['size_m']}px mobile" if spec.get("size_m") else "")
    return (f'<div style="display:grid;grid-template-columns:200px 1fr;gap:24px;align-items:baseline;padding:22px 0;border-top:1px solid {p["fine"]}">'
            f'<div><div class="lab">{name}</div><div style="font-size:12px;color:{p["muted"]};margin-top:6px">{meta}</div></div>'
            f'<div style="{st}color:{p["ink"]}">{sample}</div></div>')


html = f"""<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>Woburn Sands LP brand spec</title><script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script><style>{faces}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:#2a2a2a;padding:80px;font-family:'Manrope',sans-serif;color:{p['ink2']}}}
.sheet{{width:1440px;background:#fff;padding:80px}}
.lab{{font-family:'Jost',sans-serif;font-weight:500;font-size:13px;letter-spacing:.22em;text-transform:uppercase;color:{p['accent']}}}
b.turn{{font-family:'Instrument Serif',serif;font-weight:400;font-style:italic;font-size:1.12em;color:{p['turn']}}}
.btn{{display:inline-flex;align-items:center;justify-content:center;height:{btn['height']}px;padding:0 {btn['pad']}px;border-radius:{sh['button']}px;font-weight:{btn['weight']};font-size:{btn['size']}px}}
</style></head><body><div class="sheet" data-name="Brand spec sheet">
<div class="lab">Landing pages · brand spec</div>
<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:14px">
  <div style="font-weight:700;font-size:52px;line-height:1.1;letter-spacing:-.015em;color:{p['ink']}">Woburn Sands, <b class="turn">on the LP kit.</b></div>
  <img src="../assets/logo-colour.png" style="width:150px;display:block">
</div>
<p style="font-size:16px;line-height:1.7;margin-top:16px;max-width:900px">From the Woburn Sands guideline (Figma xOAVGppKkuFSLDgZs0OoyO), the July 2026 Meta statics and the practice website. The pages beside this sheet show the square photo frame with its Mist offset, the form, crown cards, buttons and the white, Paper and Woburn Green rhythm.</p>
<div class="lab" style="margin-top:56px">Palette roles</div>
<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-top:18px">{''.join(sw(r, u) for r, u in ROLES)}</div>
<div class="lab" style="margin-top:56px">Type scale</div>
<div style="margin-top:12px">
{ty('Display', t['display'], 'New patient check-up, <b class="turn">only £85.</b>')}
{ty('H1', t['h1'], 'Clear prices, <b class="turn">no surprises.</b>')}
{ty('H2', t['h2'], 'Book your check-up')}
{ty('H3', t['h3'], 'Health and oral cancer screening')}
{ty('Body', t['body'], 'A full dental examination, X-rays when needed and a personalised treatment plan.')}
{ty('Label', t['label'], 'New patients welcome · Woburn Sands')}
</div>
<div class="lab" style="margin-top:56px">Shapes and signatures</div>
<div style="display:flex;gap:28px;align-items:center;margin-top:22px;flex-wrap:wrap">
  <span class="btn" style="background:{p['ink']};color:#fff">Book Appointment</span>
  <span class="btn" style="background:{p['mist']};color:{p['btn_on_dark_fg']}">Book Appointment</span>
  <div style="display:flex;gap:10px;align-items:center;font-size:15px;color:{p['ink']}"><img src="../assets/crown-colour.png" style="width:19px">Kana crown replaces ticks</div>
  <div style="display:flex;gap:10px;align-items:center;font-size:15px;font-weight:600;color:#fff;background:{p['dark2']};border:1.5px solid rgba(255,255,255,.75);border-radius:6px;padding:12px 16px"><img src="../assets/crown-white.png" style="width:19px">Crown card on green</div>
  <img src="../assets/crown-rule-colour.png" style="width:220px">
  <img src="../assets/house-colour.png" style="width:120px;opacity:.5">
  <div style="font-size:13px;color:{p['muted']}">Buttons + fields {sh['button']}px · cards {sh['card']}px · photos square with a Mist offset · house sketch watermark · green-wash photo bands</div>
</div>
</div></body></html>"""
(HERE / "brand-spec" / "spec-sheet.html").write_text(html)
print("wrote brand-spec/spec-sheet.html")
