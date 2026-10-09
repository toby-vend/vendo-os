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
  <div class="sup" style="font-size:27px;margin-top:18px;width:{c.get('supw', 700)}px">{free(c['sup'][site])}</div>
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
  <div class="sup" style="font-size:33px;margin-top:20px">{free(c['sup'][site])}</div>
</div>
<div class="abs cta" style="left:115px;top:1478px;width:849px;height:102px;font-size:56px;background:rgba(255,255,255,.6)">{CTA}</div>"""


def sand_bg():
    return f'<div class="scrim" style="background:radial-gradient(120% 90% at 50% 18%,{CREAM} 0%,#E4D9C6 45%,{SAND} 100%)"></div>'


def free(t):
    return t.replace('FREE', '<strong style="font-weight:600;letter-spacing:.04em">FREE</strong>')


def items_html(c, fs, pad, mt, w, num_fs, cols=1, items=None):
    items = items or c.get('items')
    if not items:
        return ''
    if c.get('ticks'):
        marks = ['<b style="font-size:%dpx;width:%dpx;flex:none;font-style:normal">✓</b>' % (num_fs, num_fs + 14)] * len(items)
    else:
        marks = [f'<b style="font-size:{num_fs}px;width:{num_fs + 14}px;flex:none">{i + 1:02d}</b>' for i in range(len(items))]
    if cols == 2:
        return (f'<div style="margin-top:{mt}px;width:{w}px;display:grid;grid-template-columns:1fr 1fr;column-gap:36px;text-align:left">'
                + ''.join(f'<div style="display:flex;gap:12px;align-items:baseline;font-size:{fs}px;line-height:1.25;padding:{pad}px 0;border-top:1.5px solid rgba(0,0,0,.18)">{m}<span>{free(t)}</span></div>' for m, t in zip(marks, items))
                + '</div>')
    return (f'<ul class="list" style="margin-top:{mt}px;width:{w}px;text-align:left">'
            + ''.join(f'<li style="font-size:{fs}px;padding:{pad}px 4px">{m}<span>{free(t)}</span></li>' for m, t in zip(marks, items))
            + '</ul>')


def sup_html(c, site, fs, mt, w, key='sup'):
    t = (c.get(key) or c['sup'])[site]
    return f'<div class="sup" style="font-size:{fs}px;margin-top:{mt}px;width:{w}px;color:{GRAPHITE}">{free(t)}</div>' if t else ''


def plain_1x1(c, site):
    it = c.get('items1') or c.get('items')
    body = items_html(c, c.get('li1', 28), c.get('pad1', 11), 26, c.get('w1', 820), 32, c.get('cols1', 1), it)
    return f"""{sand_bg()}
<div class="abs" style="left:0;right:0;top:92px;display:flex;justify-content:center">{logo(BLACK, 340)}</div>
<div class="abs" style="left:0;right:0;top:{c.get('top1', 250)}px;display:flex;flex-direction:column;align-items:center;text-align:center;color:{BLACK}">
  <div class="eb" style="font-size:24px">{c['eyebrow']} · {SITES[site]}</div>
  <div class="hl" style="font-size:{c.get('size1', 96)}px;margin-top:16px">{hl(c['hl'][site])}</div>
  {body}
  {sup_html(c, site, 26, 20, 820, 'sup1')}
</div>
<div class="abs cta" style="left:171px;top:930px;width:737px;height:88px;font-size:40px;background:rgba(255,255,255,.75)">{CTA}</div>"""


def plain_9x16(c, site):
    body = items_html(c, c.get('li9', 36), c.get('pad9', 22), 44, 850, 40)
    return f"""{sand_bg()}
<div class="abs" style="left:0;right:0;top:270px;display:flex;justify-content:center">{logo(BLACK, 440)}</div>
<div class="abs" style="left:0;right:0;top:{c.get('top9', 560)}px;display:flex;flex-direction:column;align-items:center;text-align:center;color:{BLACK}">
  <div class="eb" style="font-size:30px">{c['eyebrow']} · {SITES[site]}</div>
  <div class="hl" style="font-size:{c.get('size9', 112)}px;margin-top:18px">{hl(c['hl'][site])}</div>
  {body}
  {sup_html(c, site, 33, 30, 860)}
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


# Priya's wording (email 9 Oct 2026, "Post Meeting Action Points"); Vivera capitalised as the brand name.
PRIYA_INVIS = ['FREE consultation &amp; 3D digital scan', 'FREE dental assessment &amp; OPG', 'FREE refinement aligners',
               'FREE home whitening kit', 'FREE teeth edge sculpting', 'FREE premium Vivera retainers (3 sets)',
               'All aligners and review appointments']

CONCEPTS = {
    'amy': [
        dict(id='A1', name='Save over 1500', layout='plain', eyebrow='Invisalign', ticks=True,
             hl=both('Save over £1,500 | on Invisalign.'), size1=86, size9=104, top1=200, top9=500, li1=29, pad1=14, li9=34, pad9=18,
             items=PRIYA_INVIS, items1=PRIYA_INVIS[:6], cols1=2, w1=900, sup=both(''), sup1=both(PRIYA_INVIS[6] + '.')),
        dict(id='A2', name='See it first', layout='photo', eyebrow='Invisalign', talent='Clinician + patient',
             hl=both('See the result | before you start.'),
             sup=both('A FREE 3D digital scan shows your expected smile before a single aligner is made.'),
             photo={'banstead': dict(img='shoot/zh-39.jpg', fx=.5, fy=.35),
                    'battersea': dict(img='shoot/zh-16.jpg', fx=.5, fy=.3)}),
        dict(id='A3', name='Too complex', layout='photo', eyebrow='Invisalign', talent='Clinician',
             hl=both('Told your case | is too complex?'),
             sup=both('Our Diamond Apex team treats the cases many practices refer on.'),
             photo={'banstead': dict(img='shoot/zh-26.jpg', fx=.5, fy=.2),
                    'battersea': dict(img='shoot/zh-27.jpg', fx=.4, fy=.2)}),
        dict(id='A4', name='After the last aligner', layout='photo', eyebrow='Invisalign', talent='Patient + clinician',
             hl=both('Straight teeth. | Staying straight.'),
             sup=both('FREE premium Vivera retainers (3 sets) and review appointments, with every treatment.'),
             photo={'banstead': dict(img='shoot/zh-43.jpg', fx=.5, fy=.3),
                    'battersea': dict(img='shoot/zh-45.jpg', fx=.5, fy=.3)}),
        dict(id='A5', name='30 minutes', layout='photo', eyebrow='Invisalign', talent='No talent', size1=62, size9=66,
             hl={'banstead': '30 minutes on the High Street. | Then you’ll know.',
                 'battersea': '30 minutes on Northcote Road. | Then you’ll know.'},
             sup=both('Whether Invisalign suits you, which package fits, and your 3D result. FREE, no commitment.'),
             photo={'banstead': dict(img='shoot/zh-1.jpg', fx=.5, fy=.4),
                    'battersea': dict(img='drive/battersea/bat-055.jpg', fx=.5, fy=.35)}),
        dict(id='A6', name='From 2650', layout='plain', eyebrow='Invisalign', talent='No talent',
             hl=both('Invisalign | from £2,650.'), size1=130, size9=150, top1=300, top9=640,
             sup=both('Save over £1,500 with FREE whitening, refinement aligners and 3 sets of Vivera retainers.')),
        dict(id='A7', name='All free', layout='photo', eyebrow='Invisalign', talent='Clinician + patient', size1=72, size9=84,
             hl=both('Whitening. Retainers. Refinements. | All FREE.'),
             sup=both('Plus a FREE consultation, 3D scan and dental assessment. Save over £1,500 on Invisalign.'),
             photo={'banstead': dict(img='shoot/zh-17.jpg', fx=.5, fy=.25),
                    'battersea': dict(img='shoot/zh-42.jpg', fx=.5, fy=.25)}),
    ],
    'josh': [
        dict(id='J1', name='Still your teeth', layout='photo', eyebrow='Composite bonding', talent='Patient + clinician',
             hl=both('Still your teeth. | Just better.'),
             sup=both('Bonding adds to the teeth you have. No drilling, nothing filed down, nothing fake.'),
             photo={'banstead': dict(img='shoot/zh-46.jpg', fx=.5, fy=.15),
                    'battersea': dict(img='delighted-chair.jpg', fx=.5, fy=.3)}),
        dict(id='J2', name='Two hours', layout='photo', eyebrow='Composite bonding', talent='Clinician',
             hl=both('One visit. | A whole new edge.'),
             sup=both('Chips, gaps and uneven edges reshaped in a single appointment, usually in 1 to 2 hours.'),
             photo={'banstead': dict(img='shoot/zh-33.jpg', fx=.5, fy=.25),
                    'battersea': dict(img='shoot/zh-38.jpg', fx=.5, fy=.25)}),
        dict(id='J3', name='From 2100', layout='plain', eyebrow='Composite bonding', ticks=True,
             hl=both('Six teeth | from £2,100.'), size1=104, size9=124, top1=230, top9=540, li1=29, pad1=12, li9=36, pad9=20,
             items=['6 teeth £2,100 · 8 teeth £2,800 · 10 teeth £3,500', 'FREE home whitening kit', 'FREE custom retainer', 'Digital smile design before you start'],
             sup=both('No drilling. Nothing filed down. Most cases done in one visit.')),
        dict(id='J4', name='Chips easily', layout='plain', eyebrow='Composite bonding', ticks=True,
             hl=both('“It chips easily.” | The honest answer.'), size1=92, size9=112, top1=230, top9=560, li1=30, pad1=13, li9=38, pad9=22,
             items=['Typically lasts 5 to 7 years with care', 'A chip can be repaired, not replaced', 'Checked at every annual review', 'FREE custom retainer to protect it'],
             sup=both('')),
        dict(id='J5', name='On camera', layout='photo', eyebrow='Composite bonding', talent='Patient',
             hl=both('On camera all day? | Smile like it.'),
             sup=both('Chips, gaps and short teeth reshaped in one visit. No drilling, nothing filed down.'),
             photo={'banstead': dict(img='shoot/zh-15.jpg', fx=.5, fy=.8, s9=dict(fy=.3)),
                    'battersea': dict(img='shoot/zh-44.jpg', fx=.6, fy=.55, s9=dict(fy=.25))}),
    ],
    'michelle': [
        dict(id='M1', name='Too late', layout='photo', eyebrow='Smile makeover', talent='No talent',
             hl=both('Is it too late? | It’s really not.'),
             sup=both('Whitening, bonding, veneers or Invisalign, planned around your face and designed before anything starts.'),
             photo={'banstead': dict(img='shoot/zh-4.jpg', fx=.5, fy=.4),
                    'battersea': dict(img='drive/battersea/bat-048.jpg', fx=.5, fy=.4)}),
        dict(id='M2', name='Just for you', layout='photo', eyebrow='Smile makeover', talent='No talent', size1=72, size9=84,
             hl=both('For once, | something just for you.'),
             sup=both('A smile makeover planned at your pace, with clear prices before anything starts.'),
             photo={'banstead': dict(img='shoot/zh-3.jpg', fx=.5, fy=.35),
                    'battersea': dict(img='drive/battersea/bat-025.jpg', fx=.45, fy=.5)}),
        dict(id='M3', name='Natural', layout='plain', eyebrow='Smile makeover', ticks=True,
             hl=both('Natural. | Never “done”.'), size1=104, size9=124, top1=230, top9=560, li1=29, pad1=13, li9=37, pad9=22,
             items=['Shade and shape chosen to suit your face', 'Digital smile design before you start', 'Bonding adds to your teeth, nothing filed down', 'FREE home whitening kit and custom retainer with bonding'],
             sup=both('')),
        dict(id='M4', name='Photos', layout='photo', eyebrow='Smile makeover', talent='Patient + clinician', size1=74, size9=86,
             hl=both('Smile in the photos. | Properly, this time.'),
             sup=both('One consultation: what bothers you, what’s possible, and what it costs.'),
             photo={'banstead': dict(img='shoot/zh-44.jpg', fx=.6, fy=.3),
                    'battersea': dict(img='shoot/zh-43.jpg', fx=.5, fy=.3)}),
        dict(id='M5', name='Every option', layout='plain', eyebrow='Smile makeover', ticks=True,
             hl=both('One consultation. | Every option.'), size1=92, size9=112, top1=220, top9=540, li1=30, pad1=13, li9=38, pad9=22,
             items=['Teeth whitening £400', 'Composite bonding, 6 teeth from £2,100', 'Porcelain veneers £950 a tooth', 'Invisalign from £2,650'],
             sup=both('Smile makeover consultation £30. 0% finance over 12 months.')),
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
