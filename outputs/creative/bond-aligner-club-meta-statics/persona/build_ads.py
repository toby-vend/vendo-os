"""Bond Aligner Club persona Meta statics: HTML harness for render QA and Figma capture.

Style follows the approved brand guideline (Figma xSkDoBcG2gyevbN2c3h1Yt): Inter Black caps
headlines, black/white panels, Bond's premium shoot photography, BAC golds as accents.
One page per persona: 1:1 row, copy-card row, 9:16 row. Copy is parsed from copy-<persona>.md.

Usage: python3 build_ads.py  ->  ads-<persona>.html (+ ads-<persona>-capture.html)
"""
import re
from pathlib import Path

from build_guideline import svg, GOLD, DEEP, LIGHT, BLACK, IVORY, WHITE

HERE = Path(__file__).parent
PH = 'assets/photos/ads/'
DATE = '261003'

CSS = f"""
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=block');
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:#2a2a2a;font-family:'Inter',sans-serif;padding:80px;-webkit-font-smoothing:antialiased}}
.row{{display:flex;gap:80px;align-items:flex-start;margin-bottom:120px}}
.ab{{position:relative;overflow:hidden;flex:none;background:{BLACK};color:{WHITE}}}
.s1{{width:1080px;height:1080px}} .s9{{width:1080px;height:1920px}}
.abs{{position:absolute}}
.ph{{position:absolute;overflow:hidden}} .ph img{{width:100%;height:100%;object-fit:cover;display:block}}
.d{{font-weight:900;text-transform:uppercase;letter-spacing:-.06em;line-height:.86}}
.sub{{font-weight:600;font-size:34px;line-height:1.25;letter-spacing:-.01em}}
.lab{{font-weight:600;font-size:22px;letter-spacing:.2em;text-transform:uppercase}}
.small{{font-weight:500;font-size:20px;letter-spacing:.16em;text-transform:uppercase}}
.pill{{display:inline-flex;align-items:center;height:76px;padding:0 42px;border-radius:999px;font-weight:700;font-size:26px;letter-spacing:.01em;white-space:nowrap}}
.gold{{color:{GOLD}}} .deep{{color:{DEEP}}}
.card{{flex:none;width:1080px;background:{WHITE};color:{BLACK};border-radius:16px;padding:44px 48px;font-size:24px;line-height:1.5}}
.card h4{{font-size:16px;letter-spacing:.18em;text-transform:uppercase;color:{DEEP};font-weight:600}}
.card .hd{{font-weight:800;font-size:30px;margin:8px 0 22px}}
.card p+p{{margin-top:14px}}
.card ul{{margin:10px 0 0 26px}}
"""


def ph(src, x, y, w, h, pos='50% 50%', r=0):
    return f'<div class="ph" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;border-radius:{r}px"><img src="{PH}{src}" style="object-position:{pos}"></div>'


def grad(css):
    return f'<div class="abs" style="inset:0;background:{css}"></div>'


def rating(color=WHITE, size=22):
    return f'<span class="small" style="font-size:{size}px;color:{color}">4.8<span style="color:{GOLD}">★</span> Google · 1,000+ reviews</span>'


def endorse(color=GOLD, size=18):
    return f'<span class="small" style="font-size:{size}px;color:{color}">by Bond Dental London</span>'


def board(size, name, inner, bg=BLACK, color=WHITE):
    tag = '1x1' if size == 's1' else '9x16'
    return f'<div class="ab {size}" data-name="{name} | {tag} | {DATE}" style="background:{bg};color:{color}">{inner}</div>'


# ------------------------------------------------------------------ copy parsing

def parse_copy(md):
    """Return {code: {'title','headline','primary'(html)}} from a copy-<persona>.md file."""
    out = {}
    for block in re.split(r'\n## ', md)[1:]:
        m = re.match(r'(\w+) \| (.+)', block)
        if not m or 'Notes' in m.group(0):
            continue
        code, title = m.group(1), m.group(2).strip()
        hl = re.search(r'^\*\*Headline:\*\* (.+)$', block, re.M).group(1).strip()
        prim = block.split('**Primary text:**', 1)[1].split('\n---', 1)[0].strip()
        html, items = [], []
        for para in prim.split('\n'):
            para = para.strip()
            if para.startswith('- '):
                items.append(para[2:])
                continue
            if items:
                html.append('<ul>' + ''.join(f'<li>{i}</li>' for i in items) + '</ul>')
                items = []
            if para:
                html.append('<p>' + re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', para) + '</p>')
        if items:
            html.append('<ul>' + ''.join(f'<li>{i}</li>' for i in items) + '</ul>')
        out[code] = {'title': title, 'headline': hl, 'primary': ''.join(html)}
    return out


def copy_card(code, c):
    return f'''<div class="card" data-name="Copy | {code} | {c['title']}"><h4>{code} · {c['title']}</h4>
<div class="hd">Headline: {c['headline']}</div><div>{c['primary']}</div></div>'''


# ------------------------------------------------------------------ templates

def t_photo_hero(size, name, photo, pos, label, head, sub, foot_left, fs1=118, fs9=124):
    """Full-bleed photo, lockup top, huge headline bottom-left, CTA."""
    s9 = size == 's9'
    top = 270 if s9 else 64
    base = 1580 if s9 else 1016
    fs = fs9 if s9 else fs1
    return board(size, name, f'''
<div class="ph" style="inset:0"><img src="{PH}{photo}" style="object-position:{pos}"></div>
{grad("linear-gradient(180deg," + ("rgba(11,11,11,.8) 0%,rgba(11,11,11,.55) 17%,rgba(11,11,11,0) 30%" if s9 else "rgba(11,11,11,.72) 0%,rgba(11,11,11,0) 22%") + ",rgba(11,11,11,0) 38%,rgba(11,11,11,.9) 82%)")}
<div class="abs" style="left:64px;top:{top}px">{svg('lockup-gold', 210 if s9 else 170)}</div>
<div class="abs" style="left:64px;right:64px;bottom:{(1920 if s9 else 1080) - base + 110}px">
  <div class="lab gold">{label}</div>
  <div class="d" style="font-size:{fs}px;margin-top:22px">{head}</div>
  <div class="sub" style="margin-top:26px;color:rgba(255,255,255,.88);max-width:900px">{sub}</div>
</div>
<div class="abs" style="left:64px;right:64px;top:{base - 76}px;display:flex;align-items:center;justify-content:space-between">
  {foot_left}<span class="pill" style="background:{GOLD};color:{BLACK}">Book a consultation</span>
</div>''')


def t_split(size, name, photo, pos, label, head, sub, fs1=88, fs9=112):
    """Photo top, white panel bottom with black headline."""
    s9 = size == 's9'
    split = 920 if s9 else 470
    fs = fs9 if s9 else fs1
    base = 1580 if s9 else 1016
    return board(size, name, f'''
{ph(photo, 0, 0, 1080, split, pos)}
<div class="abs" style="left:64px;top:{270 if s9 else 54}px">{svg('lockup-gold', 200 if s9 else 160)}</div>
{grad("linear-gradient(180deg," + ("rgba(11,11,11,.8) 0%,rgba(11,11,11,.55) 17%,rgba(11,11,11,0) 30%" if s9 else "rgba(11,11,11,.6) 0%,rgba(11,11,11,0) 30%") + ")")}
<div class="abs" style="left:0;right:0;top:{split}px;bottom:0;background:{WHITE}"></div>
<div class="abs" style="left:64px;right:64px;top:{split + 56}px;color:{BLACK}">
  <div class="lab deep">{label}</div>
  <div class="d" style="font-size:{fs}px;margin-top:18px">{head}</div>
  <div class="sub" style="margin-top:22px;color:rgba(11,11,11,.72)">{sub}</div>
</div>
<div class="abs" style="left:64px;right:64px;top:{base - 76}px;display:flex;align-items:center;justify-content:space-between">
  {endorse(DEEP)}<span class="pill" style="background:{BLACK};color:{WHITE}">Book a consultation</span>
</div>''', bg=WHITE, color=BLACK)


def tiers_grid(x, y, w, cols, gap=16, pfs=78, note=None):
    tiers = [('Express', '£995', 'Up to 7 aligners'), ('Lite', '£1,995', 'Up to 14 aligners'),
             ('Moderate', '£2,995', 'Up to 20 aligners'), ('Comprehensive', '£3,595', 'Unlimited aligners')]
    cw = (w - gap * (cols - 1)) / cols
    cards = ''.join(f'''<div style="width:{cw}px;background:#16140f;border:1px solid rgba(210,180,119,.35);border-radius:14px;padding:26px 28px">
<div class="lab gold" style="font-size:{15 if cols == 4 else 18}px;letter-spacing:.14em">{n}</div><div class="d" style="font-size:{pfs}px;margin-top:14px;letter-spacing:-.045em">{p}</div>
<div style="font-size:22px;margin-top:12px;color:rgba(255,255,255,.72)">{d}</div></div>''' for n, p, d in tiers)
    return f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px;display:flex;flex-wrap:wrap;gap:{gap}px">{cards}</div>'


def t_price(size, name, photo, pos, label, head, fs1=92, fs9=118):
    """Black board, photo strip, headline and the four-tier price ladder."""
    s9 = size == 's9'
    if s9:
        inner = f'''{ph(photo, 0, 0, 1080, 600, pos)}
{grad("linear-gradient(180deg,rgba(11,11,11,.8) 0%,rgba(11,11,11,.55) 17%,rgba(11,11,11,0) 30%,rgba(11,11,11,0) 22%,rgba(11,11,11,1) 31.5%)")}
<div class="abs" style="left:64px;top:270px">{svg('lockup-gold', 200)}</div>
<div class="abs" style="left:64px;right:64px;top:640px"><div class="lab gold">{label}</div>
<div class="d" style="font-size:{fs9 - 10}px;margin-top:18px">{head}</div></div>
{tiers_grid(64, 1030, 952, 2, 18, 76)}
<div class="abs" style="left:64px;right:64px;top:1504px;display:flex;align-items:center;justify-content:space-between">
{endorse()}<span class="pill" style="background:{GOLD};color:{BLACK}">Book a consultation</span></div>'''
    else:
        inner = f'''<div class="abs" style="left:64px;top:56px">{svg('lockup-gold', 150)}</div>
<div class="abs" style="left:64px;right:64px;top:170px"><div class="lab gold">{label}</div>
<div class="d" style="font-size:{fs1}px;margin-top:18px">{head}</div></div>
{tiers_grid(64, 560, 952, 4, 14, 58)}
<div class="abs" style="left:64px;top:800px;font-size:26px;color:rgba(255,255,255,.75)">Priced by how far your teeth need to move.</div>
<div class="abs" style="left:64px;right:64px;top:940px;display:flex;align-items:center;justify-content:space-between">
<span class="small" style="font-size:20px;color:rgba(255,255,255,.75)">0% finance available · subject to status</span><span class="pill" style="background:{GOLD};color:{BLACK}">Book a consultation</span></div>'''
    return board(size, name, inner)


def t_badge(size, name, photo, pos, label, head, sub, fs1=116, fs9=140):
    """Full-bleed premium interior, headline top-left, rating badge card bottom."""
    s9 = size == 's9'
    base = 1580 if s9 else 1016
    return board(size, name, f'''
<div class="ph" style="inset:0"><img src="{PH}{photo}" style="object-position:{pos}"></div>
{grad("linear-gradient(180deg,rgba(11,11,11,.82) 0%,rgba(11,11,11,.35) 45%,rgba(11,11,11,.1) 62%,rgba(11,11,11,.8) 100%)")}
<div class="abs" style="left:64px;right:64px;top:{270 if s9 else 64}px">
  {svg('lockup-gold', 200 if s9 else 160)}
  <div class="lab gold" style="margin-top:{60 if s9 else 44}px">{label}</div>
  <div class="d" style="font-size:{fs9 if s9 else fs1}px;margin-top:20px">{head}</div>
  <div class="sub" style="margin-top:24px;color:rgba(255,255,255,.9)">{sub}</div>
</div>
<div class="abs" style="left:64px;right:64px;top:{base - 190}px;background:{WHITE};color:{BLACK};border-radius:18px;padding:0 28px 0 36px;height:190px;display:flex;align-items:center;justify-content:space-between">
  <div><div class="d" style="font-size:66px;letter-spacing:-.04em">4.8<span style="color:{GOLD}">★</span></div>
  <div class="small" style="font-size:17px;margin-top:8px;color:rgba(11,11,11,.7)">Google · 1,000+ reviews</div></div>
  <span class="pill" style="background:{BLACK};color:{WHITE}">Book a consultation</span>
</div>''')


def t_pillars(size, name, photo, pos, head, sub, rows):
    """Photo top, black panel with the three pillars stacked."""
    s9 = size == 's9'
    split = 820 if s9 else 420
    rl = ''.join(f'''<div style="display:flex;align-items:baseline;gap:28px;padding:{22 if s9 else 16}px 0;border-top:1px solid rgba(210,180,119,.35)">
<div class="d" style="font-size:{86 if s9 else 76}px;width:{620 if s9 else 500}px;flex:none">{k}</div>
<div style="font-size:{26 if s9 else 25}px;font-weight:500;color:rgba(255,255,255,.82)">{v}</div></div>''' for k, v in rows)
    return board(size, name, f'''
{ph(photo, 0, 0, 1080, split, pos)}
{grad("linear-gradient(180deg," + ("rgba(11,11,11,.8) 0%,rgba(11,11,11,.55) 17%,rgba(11,11,11,0) 30%" if s9 else "rgba(11,11,11,.55) 0%,rgba(11,11,11,0) 35%") + ")")}
<div class="abs" style="left:64px;top:{270 if s9 else 50}px">{svg('lockup-gold', 200 if s9 else 150)}</div>
<div class="abs" style="left:64px;right:64px;top:{split + (56 if s9 else 40)}px">
  <div class="sub gold" style="font-size:{38 if s9 else 32}px">{sub}</div>
  <div style="margin-top:{30 if s9 else 22}px">{rl}</div>
</div>
<div class="abs" style="left:64px;right:64px;top:{(1580 if s9 else 1016) - 76}px;display:flex;align-items:center;justify-content:space-between">
  {endorse()}<span class="pill" style="background:{GOLD};color:{BLACK}">Book a consultation</span>
</div>''')


# ------------------------------------------------------------------ personas

def professional(size):
    n = lambda c, d: f'{c} | Static | {d}'
    return [
        t_photo_hero(size, n('P1 No photo you like', 'Patient | Smiling in chair'), 'kit-patient-cream.jpg', '50% 22%',
                     'Premium', 'Smile in<br>the photo.<br>Not around it.',
                     'The real Invisalign, planned by Bond Dental clinicians.', rating()),
        t_split(size, n('P2 Client-facing', 'Patient + clinician | Consultation'), 'kit-consult-ipad.jpg', '50% 45%',
                'Quality', 'You present<br>for a living.<br>Your aligners<br>don\'t need to.', 'Clear, removable, genuine Invisalign.'),
        t_price(size, n('P3 Wish list for years', 'Patient | Price ladder'), 'kit-patient-check.jpg', '50% 30%',
                'Affordable', 'On your list<br>for years. Now<br>there\'s a price.'),
        t_badge(size, n('P4 Premium no pressure', 'No talent | Reception'), 'kit-reception.jpg', '60% 50%',
                'Premium', 'Premium<br>clinics.<br>Zero<br>pressure.', 'Bond Dental\'s own Central London clinics.'),
        t_pillars(size, n('P5 Values aligned', 'Patient | Three pillars'), 'kit-patient-relax.jpg', '72% 40%',
                  '', 'Your values aligned with ours.',
                  [('Quality.', 'The real Invisalign'), ('Premium.', 'Bond Dental\'s Central London clinics'),
                   ('Affordable.', 'Four clear prices from £995')]),
    ]


PERSONAS = {'professional': (professional, 'copy-professional.md', 'The Aspirational Professional')}


def build(key):
    fn, copy_file, title = PERSONAS[key]
    copy = parse_copy((HERE / copy_file).read_text())
    cards = ''.join(copy_card(c, copy[c]) for c in copy)
    body = (f'<div class="row">{"".join(fn("s1"))}</div><div class="row">{cards}</div>'
            f'<div class="row">{"".join(fn("s9"))}</div>')
    head = f'<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>BAC | {title}</title><style>{CSS}</style>'
    (HERE / f'ads-{key}.html').write_text(head + f'</head><body>{body}</body></html>')
    (HERE / f'ads-{key}-capture.html').write_text(head + '<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>' + f'</head><body>{body}</body></html>')
    print(key, len(copy), 'concepts')


if __name__ == '__main__':
    import sys
    for k in (sys.argv[1:] or PERSONAS):
        build(k)
