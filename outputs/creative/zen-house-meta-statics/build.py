"""Zen House Dental Meta statics: HTML harness for Figma capture.

Built to the client's signed-off ad system (Figma NGnCi86PMYF5jlAEGEOYtg, "Zen House | New Creatives"):
full-bleed photo, soft scrim, white wordmark top centre, eyebrow "TREATMENT · PRACTICE",
SLTF The Silver Editorial Regular headline with the second phrase in Regular Italic, one Open Sans
support line, square translucent white CTA bar ("Book a consultation today", Silver Editorial Medium).
Plain variant on a sand gradient for offer and list concepts (as the signed-off "Every aligner" ad).

Personas x concepts live in CONCEPTS; each concept renders for Banstead and Battersea, in 1:1 and 9:16.
Copy per concept: copy-<persona>.md. Photos: assets/photos (gitignored).

Usage: python3 build.py  ->  <persona>-<site>-1x1.html / -9x16.html
"""
import struct
from pathlib import Path

ROOT = Path(__file__).parent
A = ROOT / 'assets'
DATE = '261009'

WHITE, BLACK, SAND, CREAM, GRAPHITE = '#FFFFFF', '#000000', '#C7BBA5', '#F5ECDD', '#4B4A45'
CTA = 'Book a consultation today'
SITES = {'banstead': 'Banstead', 'battersea': 'Battersea'}


def logo(colour, width):
    s = (A / 'logo-white.svg').read_text().replace('fill="white"', f'fill="{colour}"')
    return s.replace('width="180" height="44"', f'width="{width}" height="{round(width * 44 / 180, 1)}" style="display:block"', 1)


def photo_aspect(img):
    data = (A / 'photos' / img).read_bytes()
    i = 2
    while i < len(data):
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        seg = struct.unpack('>H', data[i + 2:i + 4])[0]
        if marker in (0xC0, 0xC1, 0xC2):
            h, w = struct.unpack('>HH', data[i + 5:i + 9])
            return w / h
        i += 2 + seg
    raise ValueError(img)


def cover(img, w, h, fx=0.5, fy=0.5, zoom=1.0, x=0, y=0):
    """Cover-crop a photo into a w x h box from its real aspect (never stretched)."""
    a = photo_aspect(img)
    bw, bh = (w, w / a) if w / h > a else (h * a, h)
    bw, bh = bw * zoom, bh * zoom
    ox, oy = -(bw - w) * fx, -(bh - h) * fy
    return (f'<div class="ph" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;'
            f'background-image:url(assets/photos/{img});background-size:{bw:.0f}px {bh:.0f}px;'
            f'background-position:{ox:.0f}px {oy:.0f}px"></div>')


CSS = f"""
@font-face{{font-family:'SLTF The Silver Editorial';src:url('assets/fonts/SLTFTheSilverEditorial-Regular.otf');font-style:normal;font-weight:400}}
@font-face{{font-family:'SLTF The Silver Editorial';src:url('assets/fonts/SLTFTheSilverEditorial-RegularItalic.otf');font-style:italic;font-weight:400}}
@font-face{{font-family:'SLTF The Silver Editorial';src:url('assets/fonts/SLTFTheSilverEditorial-Medium.otf');font-style:normal;font-weight:500}}
@font-face{{font-family:'Open Sans';src:url('assets/fonts/OpenSans-VariableFont_wdthwght.ttf');font-weight:300 800}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:#2a2a2a;font-family:'Open Sans',sans-serif;display:flex;gap:80px;padding:80px;align-items:flex-start;-webkit-font-smoothing:antialiased}}
.ab{{position:relative;overflow:hidden;flex:none;background:{BLACK}}}
.s1{{width:1080px;height:1080px}} .s9{{width:1080px;height:1920px}}
.abs{{position:absolute}} .ph{{position:absolute;background-repeat:no-repeat}}
.scrim{{position:absolute;inset:0}}
.eb{{font-weight:400;letter-spacing:.1em;text-transform:uppercase}}
.hl{{font-family:'SLTF The Silver Editorial',serif;font-weight:400;line-height:1.06}}
.hl em{{font-style:italic;font-weight:400}}
.sup{{font-weight:400;line-height:1.38}}
.cta{{display:flex;align-items:center;justify-content:center;font-family:'SLTF The Silver Editorial',serif;font-weight:500;color:{BLACK}}}
.list{{list-style:none}} .list li{{display:flex;gap:22px;align-items:baseline;border-top:1.5px solid rgba(0,0,0,.18);font-weight:400}}
.list li:last-child{{border-bottom:1.5px solid rgba(0,0,0,.18)}}
.list li b{{font-family:'SLTF The Silver Editorial',serif;font-weight:400;font-style:italic}}
.tag{{position:absolute;font-weight:700;font-stretch:75%;letter-spacing:.12em;color:{WHITE};text-transform:uppercase}}
"""


def page(title, boards):
    return (f"<!doctype html><html lang='en-GB'><head><meta charset='utf-8'><title>{title}</title><style>{CSS}</style>"
            f"<script src='https://mcp.figma.com/mcp/html-to-design/capture.js' async></script></head><body>{''.join(boards)}</body></html>")


def hl(text):
    """'First line | italic phrase' -> two-line headline, second phrase italic."""
    a, _, b = text.partition('|')
    return f'{a.strip()}<br><em>{b.strip()}</em>' if b else a.strip()


# ------------------------------------------------------------------ layouts

def photo_1x1(c, site):
    p = c['photo'][site]
    return f"""{cover(p['img'], 1080, 1080, p.get('fx', .5), p.get('fy', .5), p.get('zoom', 1))}
<div class="scrim" style="background:linear-gradient(180deg,rgba(0,0,0,.42) 0%,rgba(0,0,0,0) 26%,rgba(0,0,0,0) 38%,rgba(0,0,0,.72) 78%,rgba(0,0,0,.8) 100%)"></div>
<div class="abs" style="left:0;right:0;top:104px;display:flex;justify-content:center">{logo(WHITE, 408)}</div>
<div class="abs" style="left:92px;bottom:200px;width:880px;color:{WHITE}">
  <div class="eb" style="font-size:24px">{c['eyebrow']} · {SITES[site]}</div>
  <div class="hl" style="font-size:{c.get('size1', 80)}px;margin-top:14px">{hl(c['hl'][site])}</div>
  <div class="sup" style="font-size:27px;margin-top:18px;width:{c.get('supw', 700)}px">{c['sup'][site]}</div>
</div>
<div class="abs cta" style="left:92px;top:905px;width:737px;height:88px;font-size:40px;background:rgba(255,255,255,.75)">{CTA}</div>"""


def photo_9x16(c, site):
    p = c['photo'][site]
    p9 = p.get('s9', {})
    return f"""{cover(p['img'], 1080, 1920, p9.get('fx', p.get('fx', .5)), p9.get('fy', p.get('fy', .5)), p9.get('zoom', p.get('zoom', 1)))}
<div class="scrim" style="background:linear-gradient(180deg,rgba(0,0,0,.42) 0%,rgba(0,0,0,0) 22%,rgba(0,0,0,0) 42%,rgba(0,0,0,.72) 72%,rgba(0,0,0,.82) 100%)"></div>
<div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(WHITE, 520)}</div>
<div class="abs" style="left:115px;bottom:480px;width:860px;color:{WHITE}">
  <div class="eb" style="font-size:30px">{c['eyebrow']} · {SITES[site]}</div>
  <div class="hl" style="font-size:{c.get('size9', 92)}px;margin-top:16px">{hl(c['hl'][site])}</div>
  <div class="sup" style="font-size:33px;margin-top:20px">{c['sup'][site]}</div>
</div>
<div class="abs cta" style="left:115px;top:1478px;width:849px;height:102px;font-size:56px;background:rgba(255,255,255,.6)">{CTA}</div>"""


def sand_bg():
    return f'<div class="scrim" style="background:radial-gradient(120% 90% at 50% 18%,{CREAM} 0%,#E4D9C6 45%,{SAND} 100%)"></div>'


def plain_1x1(c, site):
    items = c.get('items')
    body = (f'<ul class="list" style="margin-top:26px;width:820px;text-align:left">'
            + ''.join(f'<li style="font-size:28px;padding:11px 4px"><b style="font-size:32px;width:46px;flex:none">{i + 1:02d}</b>{t}</li>' for i, t in enumerate(items))
            + '</ul>') if items else ''
    return f"""{sand_bg()}
<div class="abs" style="left:0;right:0;top:92px;display:flex;justify-content:center">{logo(BLACK, 340)}</div>
<div class="abs" style="left:0;right:0;top:{c.get('top1', 250)}px;display:flex;flex-direction:column;align-items:center;text-align:center;color:{BLACK}">
  <div class="eb" style="font-size:24px">{c['eyebrow']} · {SITES[site]}</div>
  <div class="hl" style="font-size:{c.get('size1', 96)}px;margin-top:16px">{hl(c['hl'][site])}</div>
  {body}
  <div class="sup" style="font-size:26px;margin-top:20px;width:820px;color:{GRAPHITE}">{c['sup'][site]}</div>
</div>
<div class="abs cta" style="left:171px;top:930px;width:737px;height:88px;font-size:40px;background:rgba(255,255,255,.75)">{CTA}</div>"""


def plain_9x16(c, site):
    items = c.get('items')
    body = (f'<ul class="list" style="margin-top:44px;width:850px;text-align:left">'
            + ''.join(f'<li style="font-size:36px;padding:22px 4px"><b style="font-size:40px;width:56px;flex:none">{i + 1:02d}</b>{t}</li>' for i, t in enumerate(items))
            + '</ul>') if items else ''
    return f"""{sand_bg()}
<div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(BLACK, 440)}</div>
<div class="abs" style="left:0;right:0;top:{c.get('top9', 560)}px;display:flex;flex-direction:column;align-items:center;text-align:center;color:{BLACK}">
  <div class="eb" style="font-size:30px">{c['eyebrow']} · {SITES[site]}</div>
  <div class="hl" style="font-size:{c.get('size9', 112)}px;margin-top:18px">{hl(c['hl'][site])}</div>
  {body}
  <div class="sup" style="font-size:33px;margin-top:30px;width:860px;color:{GRAPHITE}">{c['sup'][site]}</div>
</div>
<div class="abs cta" style="left:115px;top:1478px;width:849px;height:102px;font-size:56px;background:rgba(255,255,255,.75)">{CTA}</div>"""


LAYOUTS = {'photo': (photo_1x1, photo_9x16), 'plain': (plain_1x1, plain_9x16)}


def board(c, site, size, persona):
    f1, f9 = LAYOUTS[c['layout']]
    inner = f1(c, site) if size == '1x1' else f9(c, site)
    name = f"{c['name']} | Static | {c.get('talent', 'No talent')} | {SITES[site]} | {size} | {DATE}"
    cls = 's1' if size == '1x1' else 's9'
    return f'<div class="ab {cls}" id="{c["id"]}-{site}-{size}" data-name="{name}">{inner}</div>'


# ------------------------------------------------------------------ concepts
# Filled per persona from copy-<persona>.md. hl uses 'line one | italic phrase'.
def both(v):
    return {'banstead': v, 'battersea': v}


CONCEPTS = {
    'amy': [
        dict(id='A1', name='Included', layout='plain', eyebrow='Invisalign',
             hl=both('Already in | your treatment.'), size1=88, size9=110, top1=205, top9=520,
             items=['Whitening', 'Tooth contouring', 'Three sets of Vivera retainers', 'Check-up and OPG', 'Follow-ups at 3 and 6 months'],
             sup=both('Plus a free consultation and 3D scan.')),
        dict(id='A2', name='See it first', layout='photo', eyebrow='Invisalign', talent='Clinician + patient',
             hl=both('See the result | before you start.'),
             sup=both('A free 3D scan shows your expected smile before a single aligner is made.'),
             photo={'banstead': dict(img='shoot/zh-39.jpg', fx=.5, fy=.35),
                    'battersea': dict(img='shoot/zh-16.jpg', fx=.5, fy=.3)}),
        dict(id='A3', name='Too complex', layout='photo', eyebrow='Invisalign', talent='Clinician',
             hl=both('Told your case | is too complex?'),
             sup=both('Our Diamond Apex team treats the cases many practices refer on.'),
             photo={'banstead': dict(img='shoot/zh-26.jpg', fx=.5, fy=.2),
                    'battersea': dict(img='shoot/zh-27.jpg', fx=.4, fy=.2)}),
        dict(id='A4', name='After the last aligner', layout='photo', eyebrow='Invisalign', talent='Patient + clinician',
             hl=both('Straight teeth. | Staying straight.'),
             sup=both('Three sets of Vivera retainers and follow-ups at 3 and 6 months, included.'),
             photo={'banstead': dict(img='shoot/zh-43.jpg', fx=.5, fy=.3),
                    'battersea': dict(img='shoot/zh-45.jpg', fx=.5, fy=.3)}),
        dict(id='A5', name='30 minutes', layout='photo', eyebrow='Invisalign', talent='No talent', size1=62, size9=66,
             hl={'banstead': '30 minutes on the High Street. | Then you’ll know.',
                 'battersea': '30 minutes on Northcote Road. | Then you’ll know.'},
             sup=both('Whether Invisalign suits you, which package fits, and your 3D result. Free, no commitment.'),
             photo={'banstead': dict(img='shoot/zh-1.jpg', fx=.5, fy=.4),
                    'battersea': dict(img='battersea-reception.jpg', fx=.45, fy=.5)}),
    ],
}


def main():
    for persona, concepts in CONCEPTS.items():
        for site in SITES:
            for size in ('1x1', '9x16'):
                boards = [board(c, site, size, persona) for c in concepts]
                (ROOT / f'{persona}-{site}-{size}.html').write_text(page(f'Zen House | {persona} | {site} | {size}', boards))
    print({p: len(c) for p, c in CONCEPTS.items()})


if __name__ == '__main__':
    main()
