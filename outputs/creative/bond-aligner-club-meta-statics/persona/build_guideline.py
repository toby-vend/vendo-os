"""Bond Aligner Club brand guideline: HTML harness for Figma capture.

Sources: pitch deck v4 (Drive 1dNx1eq8F8b9mdjscxOfruU5EPNyp2OWw), official vector logos
(Chaz, "Bond Aligner Club Logos.pdf"), landing page lp.bonddental.co.uk/aligner-club-v4
(champagne skin CSS, photography). Each section is a 1920x1080 page; capture brings
Freight Sans across as text.

Usage: python3 build_guideline.py  ->  guideline.html
"""
import re
from pathlib import Path

HERE = Path(__file__).parent
LOGO = HERE / 'assets' / 'logo'

GOLD, DEEP, LIGHT, BLACK, IVORY = '#D2B477', '#B99352', '#E5CC98', '#0B0B0B', '#F6F1E8'
CG_HI, CG_MID, CG_LO, CG_PALE = '#EBCDA1', '#D1AD7E', '#B58F60', '#F3E4C8'

_n = 0


def svg(name, width=None, height=None, style=''):
    """Inline an official logo SVG, prefixing ids so repeated instances don't collide."""
    global _n
    _n += 1
    p = f'l{_n}-'
    s = (LOGO / f'{name}.svg').read_text()
    s = re.sub(r'<\?xml[^>]*\?>', '', s)
    s = re.sub(r'id="([^"]+)"', lambda m: f'id="{p}{m.group(1)}"', s)
    s = re.sub(r'(xlink:href|href)="#([^"]+)"', lambda m: f'{m.group(1)}="#{p}{m.group(2)}"', s)
    s = re.sub(r'url\(#([^)]+)\)', lambda m: f'url(#{p}{m.group(1)})', s)
    dims = ''
    if width:
        dims += f' width="{width}"'
    if height:
        dims += f' height="{height}"'
    s = re.sub(r'<svg([^>]*?) width="[^"]+" height="[^"]+"', lambda m: f'<svg{m.group(1)}{dims} style="display:block;{style}"', s, count=1)
    return s.strip()


GRAIN = ("url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E"
         "%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix "
         "values='0 0 0 0 .22 0 0 0 0 .15 0 0 0 0 .06 0 0 0 1.6 -.72'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' "
         "filter='url(%23n)'/%3E%3C/svg%3E\")")
CHAMPAGNE = (f"radial-gradient(120% 90% at 30% 20%, {CG_HI} 0%, {CG_MID} 55%, {CG_LO} 100%)")

CSS = f"""
@font-face{{font-family:'Freight Sans Pro';src:url(assets/fonts/FreightSansProBook-Regular.otf) format('opentype');font-weight:400;font-display:block}}
@font-face{{font-family:'Great Vibes';src:url(assets/fonts/greatvibes-latin.woff2) format('woff2');font-display:block}}
*{{box-sizing:border-box;margin:0;padding:0;font-synthesis:none}}
body{{background:#3a3a3a;font-family:'Freight Sans Pro',sans-serif;color:{BLACK};display:flex;flex-direction:column;gap:120px;padding:120px;width:2160px}}
.page{{position:relative;width:1920px;height:1080px;overflow:hidden;padding:96px 120px}}
.dark{{background:{BLACK};color:{IVORY}}}
.ivory{{background:{IVORY}}}
.champ{{background:{CHAMPAGNE}}}
.grain{{position:absolute;inset:0;background-image:{GRAIN};background-size:240px;opacity:.55;pointer-events:none;mix-blend-mode:multiply}}
.eyebrow{{font-size:20px;letter-spacing:.32em;text-transform:uppercase}}
.dark .eyebrow{{color:{GOLD}}}
.ivory .eyebrow{{color:{DEEP}}}
.num{{position:absolute;top:96px;right:120px;font-size:20px;letter-spacing:.32em}}
.dark .num{{color:{GOLD}}} .ivory .num{{color:{DEEP}}}
h1{{font-weight:400;font-size:104px;line-height:1;letter-spacing:-.01em}}
h2{{font-weight:400;font-size:76px;line-height:1.02;letter-spacing:-.005em;margin-top:22px}}
h2 em,h1 em,.script{{font-family:'Great Vibes',cursive;font-style:normal;font-size:1.32em;line-height:.9;letter-spacing:0}}
.lead{{font-size:28px;line-height:1.4;max-width:760px;margin-top:26px}}
.dark .lead{{color:rgba(246,241,232,.78)}} .ivory .lead{{color:rgba(11,11,11,.72)}}
.small{{font-size:20px;line-height:1.45}}
.label{{font-size:16px;letter-spacing:.24em;text-transform:uppercase}}
.rule{{height:1px;background:currentColor;opacity:.18}}
.pill{{display:inline-flex;align-items:center;justify-content:center;height:64px;padding:0 40px;border-radius:999px;font-size:22px;letter-spacing:.14em;text-transform:uppercase}}
.photo{{position:absolute;overflow:hidden;border-radius:22px}}
.photo img{{width:100%;height:100%;object-fit:cover;display:block}}
.cap{{font-size:17px;letter-spacing:.2em;text-transform:uppercase;margin-top:14px}}
"""


def page(cls, num, body):
    return f'<section class="page {cls}"><div class="num">{num}</div>{body}</section>'


def cover():
    return page('dark', '', f"""
<div class="grain" style="opacity:.35;mix-blend-mode:screen"></div>
<div style="position:absolute;left:120px;top:96px">{svg('lockup-gold', width=360)}</div>
<div style="position:absolute;left:120px;bottom:120px;width:860px">
  <div class="eyebrow">Brand guidelines · October 2026</div>
  <h1 style="margin-top:28px;color:{IVORY}">Start as you<br>mean to <em style="color:{GOLD}">go on.</em></h1>
  <p class="lead">Bond Aligner Club is Bond Dental London's Invisalign sub-brand. Same clinicians. Same clinics. Clearer pricing.</p>
  <div class="label" style="margin-top:48px;color:{GOLD}">by Bond Dental London</div>
</div>
<div class="photo" style="right:120px;top:96px;width:720px;height:888px"><img src="assets/photos/bac-step-2b.webp" style="object-position:40% 50%"></div>
""")


def logo():
    misuse = [
        ('Don\'t recolour', f'filter:hue-rotate(160deg) saturate(2)'),
        ('Don\'t rotate', 'transform:rotate(-14deg)'),
        ('Don\'t stretch', 'transform:scaleX(1.45)'),
        ('Don\'t add effects', 'filter:drop-shadow(6px 8px 0 #7a5a2a)'),
    ]
    tiles = ''.join(f"""
<div style="width:270px">
  <div style="height:150px;border-radius:18px;background:{BLACK};display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden">
    <div style="{css}">{svg('lockup-gold', width=180)}</div>
    <div style="position:absolute;left:-20px;right:-20px;top:50%;height:3px;background:{DEEP};transform:rotate(-30deg)"></div>
  </div>
  <div class="cap" style="color:{BLACK}">{name}</div>
</div>""" for name, css in misuse)
    return page('ivory', '01 · LOGO', f"""
<div class="eyebrow">Logo &amp; lockup</div>
<h2>Use the full lockup <em>wherever it fits.</em></h2>
<p class="lead">The mark alone is for small placements only: avatars and favicons. Always show the "by Bond Dental London" endorsement alongside the logo.</p>
<div style="position:absolute;left:120px;top:470px;display:flex;gap:32px">
  <div>
    <div style="width:560px;height:300px;border-radius:22px;background:{BLACK};display:flex;align-items:center;justify-content:center">{svg('lockup-gold', width=340)}</div>
    <div class="cap">Primary · Champagne Gold on Black</div>
  </div>
  <div>
    <div style="width:560px;height:300px;border-radius:22px;background:#fff;border:1px solid rgba(11,11,11,.12);display:flex;align-items:center;justify-content:center">{svg('lockup-black', width=340)}</div>
    <div class="cap">Secondary · Black on light</div>
  </div>
  <div>
    <div style="width:300px;height:300px;border-radius:22px;background:{BLACK};display:flex;align-items:center;justify-content:center;gap:28px">
      {svg('mark-gold', width=96)}
      <div style="width:96px;height:96px;border-radius:50%;background:{GOLD};display:flex;align-items:center;justify-content:center">{svg('mark-black', width=52)}</div>
    </div>
    <div class="cap">Mark only · small placements</div>
  </div>
</div>
<div style="position:absolute;left:120px;top:850px;display:flex;gap:40px;align-items:flex-start">
  <div style="width:380px">
    <div style="height:150px;border-radius:18px;border:1px dashed {DEEP};display:flex;align-items:center;justify-content:center;position:relative">
      <div style="padding:30px;outline:none;border:1px solid rgba(185,147,82,.5)">{svg('mark-black', width=58)}</div>
    </div>
    <div class="cap">Clear space = height of the mark</div>
  </div>
  {tiles}
</div>
""")


def colour():
    sw = [
        ('Champagne Gold', GOLD, 'Lead colour. Carries most of the colour weight.', BLACK, 540),
        ('Black', BLACK, 'Premium anchor.', IVORY, 270),
        ('Warm Ivory', IVORY, 'Neutral background.', BLACK, 270),
        ('Deeper Gold', DEEP, 'Text and accents on light backgrounds only.', BLACK, 260),
        ('Light Gold', LIGHT, 'Highlights and lighter sections only.', BLACK, 260),
    ]
    cards = ''.join(f"""
<div style="width:{w}px;height:470px;border-radius:22px;background:{hexv};color:{ink};padding:34px;display:flex;flex-direction:column;justify-content:space-between;{'border:1px solid rgba(246,241,232,.18);' if hexv==BLACK else ''}">
  <div class="label">{hexv}</div>
  <div><div style="font-size:40px">{name}</div><div class="small" style="margin-top:10px;opacity:.78">{role}</div></div>
</div>""" for name, hexv, role, ink, w in sw)
    grad = ''.join(f'<div style="flex:1;height:70px;background:{c}"></div>' for c in (CG_PALE, CG_HI, CG_MID, CG_LO))
    return page('dark', '02 · COLOUR', f"""
<div class="eyebrow">Colour palette</div>
<h2>Three golds, black <em>and warm ivory.</em></h2>
<div style="position:absolute;left:120px;top:350px;display:flex;gap:20px">{cards}</div>
<div style="position:absolute;left:120px;top:860px;width:1680px;display:flex;gap:60px;align-items:center">
  <div style="width:620px;height:130px;border-radius:22px;background:{CHAMPAGNE};position:relative;overflow:hidden"><div class="grain"></div></div>
  <div style="flex:1">
    <div class="label" style="color:{GOLD}">Champagne surface · landing page</div>
    <div class="small" style="margin-top:12px;color:rgba(246,241,232,.78)">Grainy gradient sampled from the palette: highlight {CG_HI}, mid {CG_MID}, edge {CG_LO}, pale {CG_PALE}. Black type sits on it.</div>
    <div style="display:flex;margin-top:18px;border-radius:12px;overflow:hidden;width:520px">{grad}</div>
  </div>
</div>
""")


def type_():
    ramp = [
        ('Display', '96 / 100%', 'Start as you mean to go on.', 96),
        ('Headline', '56 / 104%', 'The real Invisalign. No stunt double.', 56),
        ('Body', '26 / 140%', 'Same Invisalign, same Bond Dental clinicians, four clear prices.', 26),
    ]
    rows = ''.join(f"""
<div style="display:flex;align-items:baseline;gap:40px;padding:22px 0;border-top:1px solid rgba(11,11,11,.14)">
  <div style="flex:0 0 220px"><div class="label" style="color:{DEEP}">{n}</div><div class="small" style="opacity:.6;margin-top:6px">{spec}</div></div>
  <div style="font-size:{px}px;line-height:1.05">{t}</div>
</div>""" for n, spec, t, px in ramp)
    return page('ivory', '03 · TYPE', f"""
<div class="eyebrow">Typography</div>
<div style="position:absolute;left:120px;top:170px;width:820px">
  <div style="font-size:300px;line-height:.9;letter-spacing:-.02em">Aa</div>
  <div style="font-size:44px;margin-top:20px">Freight Sans Pro Book</div>
  <p class="lead" style="margin-top:14px">Bond Dental's header font, in a single weight. Used for headlines and small text alike, so hierarchy comes from size, case and colour, never bold.</p>
  <div style="font-size:28px;margin-top:34px;letter-spacing:.04em;opacity:.8">ABCDEFGHIJKLMNOPQRSTUVWXYZ<br>abcdefghijklmnopqrstuvwxyz<br>0123456789 £ % &amp; ? !</div>
</div>
<div style="position:absolute;left:1000px;top:170px;width:800px">
  {rows}
  <div style="display:flex;align-items:baseline;gap:40px;padding:22px 0;border-top:1px solid rgba(11,11,11,.14)">
    <div style="flex:0 0 220px"><div class="label" style="color:{DEEP}">Label</div><div class="small" style="opacity:.6;margin-top:6px">16–20 · caps · +0.24em</div></div>
    <div class="label" style="font-size:20px">by Bond Dental London</div>
  </div>
  <div style="display:flex;align-items:baseline;gap:40px;padding:22px 0;border-top:1px solid rgba(11,11,11,.14);border-bottom:1px solid rgba(11,11,11,.14)">
    <div style="flex:0 0 220px"><div class="label" style="color:{DEEP}">Script accent</div><div class="small" style="opacity:.6;margin-top:6px">Great Vibes · 1.32× headline</div></div>
    <div style="font-size:56px;line-height:1.05">Four plans. <em class="script">One clear price each.</em></div>
  </div>
  <div class="small" style="margin-top:22px;opacity:.72">Script is for the closing words of a headline only, in the headline's colour. Never for body copy, prices or whole lines.</div>
</div>
""")


def graphics():
    return page('dark', '04 · GRAPHIC ELEMENTS', f"""
<div class="eyebrow">Graphic elements</div>
<h2>Soft, warm, <em>a little gilded.</em></h2>
<div style="position:absolute;left:120px;top:360px;display:flex;gap:28px">
  <div style="width:520px">
    <div style="height:520px;border-radius:22px;background:{CHAMPAGNE};position:relative;overflow:hidden;padding:40px;color:{BLACK}">
      <div class="grain"></div>
      <div style="position:relative;font-size:52px;line-height:1.02">Same clinics.<br><em class="script">Same crew.</em></div>
    </div>
    <div class="cap" style="color:{GOLD}">Champagne panel with grain</div>
  </div>
  <div style="width:540px">
    <div style="height:520px;border-radius:22px;background:#161411;border:1px solid rgba(210,180,119,.25);padding:40px;display:flex;flex-direction:column;justify-content:space-between">
      <div style="display:flex;flex-direction:column;gap:18px;align-items:flex-start">
        <div class="pill" style="background:{GOLD};color:{BLACK}">Come be part of the club</div>
        <div class="pill" style="border:1px solid {GOLD};color:{GOLD}">See the four plans</div>
      </div>
      <div class="small" style="color:rgba(246,241,232,.7)">Pill buttons, fully rounded. Gold fill for the main action; gold outline for the second.</div>
    </div>
    <div class="cap" style="color:{GOLD}">Calls to action</div>
  </div>
  <div style="width:560px">
    <div style="height:520px;border-radius:22px;background:{IVORY};color:{BLACK};padding:40px;display:flex;flex-direction:column;justify-content:space-between">
      <div>
        <div class="label" style="color:{DEEP}">Express</div>
        <div style="font-size:96px;line-height:1;margin-top:10px">£995</div>
        <div class="small" style="margin-top:8px;opacity:.7">Up to 7 aligners</div>
      </div>
      <div class="rule"></div>
      <div style="display:flex;gap:22px;flex-wrap:wrap">
        <span class="label" style="color:{DEEP}">Lite £1,995</span><span class="label" style="color:{DEEP}">Moderate £2,995</span><span class="label" style="color:{DEEP}">Comprehensive £3,595</span>
      </div>
    </div>
    <div class="cap" style="color:{GOLD}">Price card · 22px corners, thin gold rules</div>
  </div>
</div>
""")


def photography():
    shots = [
        ('bac-step-3.webp', 'The club kit, in real hands', 120, 300, 520, 560, '50% 40%'),
        ('bac-step-2b.webp', 'Candid, close-crop smiles', 664, 300, 400, 560, '45% 50%'),
        ('clinic-marylebone.webp', 'Real clinics, real streets', 1088, 300, 712, 270, '50% 60%'),
        ('clinic-mayfair.webp', 'Light, calm interiors', 1088, 590, 344, 270, '50% 50%'),
        ('bac-kev-cutout.webp', 'Dr Kev Patel, founder', 1456, 590, 344, 270, '50% 18%'),
    ]
    tiles = ''.join(f"""
<div class="photo" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px"><img src="assets/photos/{f}" style="object-position:{pos}"></div>
<div class="cap" style="position:absolute;left:{x}px;top:{y+h+2}px;color:{DEEP}">{c}</div>""" for f, c, x, y, w, h, pos in shots)
    return page('ivory', '05 · PHOTOGRAPHY', f"""
<div class="eyebrow">Photography</div>
<h2 style="max-width:1500px">Candid, close and <em>a bit main-character.</em></h2>
{tiles}
<div class="small" style="position:absolute;left:120px;top:920px;width:1680px;display:flex;gap:60px;color:rgba(11,11,11,.75)">
  <div style="flex:1"><span class="label" style="color:{DEEP}">Do</span><br>Real people, warm light, natural skin. Bold type overlays and poster-style crops. Real Bond clinics.</div>
  <div style="flex:1"><span class="label" style="color:{DEEP}">Don't</span><br>Glossy stock smiles, clinical close-ups of instruments, before-and-afters without a consented case.</div>
</div>
""")


def tone():
    lines = [
        ('Primary tagline', 'Start as you mean to go on.'),
        ('Quality', 'The real Invisalign. No stunt double.'),
        ('Premium', 'Same clinics. Same crew.'),
        ('Affordability', "Plot twist: it's £995."),
        ('Pricing', "The fine print? There isn't much."),
        ('Closing CTA', "Come be part of the club."),
    ]
    rows = ''.join(f"""
<div style="display:flex;gap:30px;padding:16px 0;border-top:1px solid rgba(210,180,119,.22);align-items:baseline">
  <div class="label" style="width:200px;color:{GOLD}">{k}</div><div style="font-size:30px">{v}</div>
</div>""" for k, v in lines)
    prin = [
        ('01', 'Professional, warm, honest', 'Modern, expert and calm. Inherited from Bond Dental London. Never arrogant.'),
        ('02', 'Confident, a little wry', 'The "main character" joke is always self-aware, never a boast about the product.'),
        ('03', 'Premium, never pressure', 'No hard sell, no urgency tactics, no discount framing.'),
        ('04', "You'll never leave wondering", 'Prices and claims stay clear and substantiated.'),
    ]
    pr = ''.join(f"""
<div style="padding:18px 0;border-top:1px solid rgba(210,180,119,.22)">
  <div style="display:flex;gap:18px;align-items:baseline"><span class="label" style="color:{GOLD}">{n}</span><span style="font-size:32px">{t}</span></div>
  <div class="small" style="margin-top:8px;color:rgba(246,241,232,.7);padding-left:46px">{d}</div>
</div>""" for n, t, d in prin)
    return page('dark', '06 · TONE OF VOICE', f"""
<div class="eyebrow">Tone of voice</div>
<h2>Premium should never <em>mean pressure.</em></h2>
<div style="position:absolute;left:120px;top:370px;width:780px">{pr}</div>
<div style="position:absolute;left:1000px;top:370px;width:800px">
  <div class="label" style="color:{GOLD};margin-bottom:12px">Key lines · use as written</div>{rows}
  <div class="small" style="margin-top:22px;color:rgba(246,241,232,.6)">Never imply a discount or budget version of Bond Dental. No "most popular" or "best in London" claims without data.</div>
</div>
""")


def examples():
    feed = f"""
<div style="position:absolute;left:120px;top:330px;width:600px;height:600px;border-radius:6px;overflow:hidden;background:{CHAMPAGNE}">
  <div class="grain"></div>
  <div style="position:absolute;left:44px;top:44px">{svg('lockup-black', width=170)}</div>
  <div style="position:absolute;left:44px;top:170px;font-size:62px;line-height:1.02;width:520px">Plot twist:<br>it's £995.</div>
  <div class="small" style="position:absolute;left:44px;top:330px;width:250px;opacity:.78">The real Invisalign, from Bond Dental's own clinicians in Marylebone.</div>
  <div class="photo" style="right:-30px;bottom:-30px;width:290px;height:320px;border-radius:22px 0 0 0"><img src="assets/photos/bac-step-3.webp" style="object-position:62% 40%"></div>
  <div class="pill" style="position:absolute;left:44px;bottom:44px;height:52px;font-size:16px;padding:0 28px;background:{BLACK};color:{GOLD}">See the four plans</div>
</div>
<div class="cap" style="position:absolute;left:120px;top:942px;color:{DEEP}">Meta feed · 1:1</div>"""
    story = f"""
<div style="position:absolute;left:780px;top:330px;width:338px;height:600px;border-radius:6px;overflow:hidden;background:{BLACK};color:{IVORY}">
  <img src="assets/photos/clinic-marylebone.webp" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:55% 50%;opacity:.9">
  <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,11,11,.9) 0%,rgba(11,11,11,.55) 18%,rgba(11,11,11,0) 34%,rgba(11,11,11,0) 42%,rgba(11,11,11,.92) 78%)"></div>
  <div style="position:absolute;left:26px;top:70px">{svg('lockup-gold', width=120)}</div>
  <div style="position:absolute;left:26px;top:350px;font-size:40px;line-height:1.02;width:290px">Same clinics.<br><em class="script" style="color:{GOLD}">Same crew.</em></div>
  <div class="label" style="position:absolute;left:26px;top:470px;font-size:11px;color:{GOLD}">by Bond Dental London · Marylebone</div>
</div>
<div class="cap" style="position:absolute;left:780px;top:942px;color:{DEEP}">Meta story · 9:16</div>"""
    tiers = [('Express', '£995', 'Up to 7 aligners'), ('Lite', '£1,995', 'Up to 14 aligners'),
             ('Moderate', '£2,995', 'Up to 20 aligners'), ('Comprehensive', '£3,595', 'Unlimited aligners')]
    tl = ''.join(f"""<div style="display:flex;justify-content:space-between;align-items:baseline;padding:16px 0;border-top:1px solid rgba(11,11,11,.14)">
  <div><div class="label" style="color:{DEEP}">{n}</div><div class="small" style="opacity:.65;margin-top:4px">{d}</div></div><div style="font-size:44px">{p}</div></div>""" for n, p, d in tiers)
    card = f"""
<div style="position:absolute;left:1180px;top:330px;width:620px;height:600px;border-radius:22px;background:#fff;padding:40px;border:1px solid rgba(11,11,11,.08)">
  <div style="font-size:42px;line-height:1.05">Four plans. <em class="script">One clear price each.</em></div>
  <div style="margin-top:22px">{tl}</div>
  <div class="small" style="margin-top:14px;opacity:.65">0% finance available on all tiers.</div>
</div>
<div class="cap" style="position:absolute;left:1180px;top:942px;color:{DEEP}">Pricing card · landing page / carousel</div>"""
    return page('ivory', '07 · APPLICATIONS', f"""
<div class="eyebrow">Example applications</div>
<h2>How it comes <em>together.</em></h2>
{feed}{story}{card}
""")


def main():
    pages = [cover(), logo(), colour(), type_(), graphics(), photography(), tone(), examples()]
    html = f"""<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>Bond Aligner Club Brand Guidelines</title>
<style>{CSS}</style></head><body>{''.join(pages)}</body></html>"""
    (HERE / 'guideline.html').write_text(html)
    print('wrote guideline.html', len(html))


if __name__ == '__main__':
    main()
