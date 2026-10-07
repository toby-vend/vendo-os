"""Bond Aligner Club influencer-lifestyle statics: five creator-style scenes built around the smile.

Same layout as the approved P1 to P5 pillar ads (Figma n9prGJlXWDAyp1k6Ow3RxU page 0:1): full-bleed photo,
gold lockup top-left, white Invisalign Provider logo top-right (Chaz, 7 Oct), Inter Black caps headline,
gold "Book a consultation" pill. Photos are Magnific (Nano Banana Pro) generations, AI talent, one model
per scene, in assets/photos/influencer/.

Usage: python3 build_influencer.py  ->  ads-influencer.html (+ ads-influencer-capture.html)
"""
from pathlib import Path

from build_guideline import svg, GOLD, BLACK, WHITE

HERE = Path(__file__).parent
PH = 'assets/photos/influencer/'
INV = 'assets/logo/invisalign-provider-white.png'
DATE = '261007'

RATING = f'<span class="small" style="font-size:22px">4.8<span style="color:{GOLD}">★</span> Google · 1,000+ reviews</span>'
BY = f'<span class="small" style="font-size:20px;color:{GOLD}">by Bond Dental London</span>'
FINANCE = '<span class="small" style="font-size:19px;color:rgba(255,255,255,.8)">0% finance available · subject to status</span>'

# key, concept, pillar, headline, sub, footer, talent detail, 1x1 photo y%, 9x16 photo y%
ADS = [
    ('L1', 'Best angle', 'Premium', 'Your best angle is a smile.',
     "The real Invisalign, in Bond Dental's<br>premium Central London clinics.", RATING, 'Rooftop selfie', 52, 50),
    ('L2', 'Camera ready', 'Quality', 'Camera ready.<br>Every day.',
     'Clear, removable, genuine Invisalign.<br>Nobody has to know.', BY, 'Mirror selfie', 44, 50),
    ('L3', 'Group chat', 'Premium', 'Made for the<br>group chat.',
     'Genuine Invisalign, planned by Bond Dental clinicians.', RATING, 'Brunch, filmed by a friend', 38, 50),
    ('L4', 'Close-ups', 'Quality', 'Close-ups?<br>Bring them on.',
     'The real Invisalign. Four clear prices from £995.', BY, 'Creator ring light', 46, 50),
    ('L5', 'From 995', 'Affordable', 'The perfect<br>smile, from<br>£995.',
     'Genuine Invisalign with 0% finance available.<br>Why wait?', FINANCE, 'Street style', 44, 40),
]

CSS = f"""
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=block');
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:#2a2a2a;font-family:'Inter',sans-serif;padding:80px;-webkit-font-smoothing:antialiased}}
.row{{display:flex;gap:80px;align-items:flex-start;margin-bottom:120px}}
.ab{{position:relative;overflow:hidden;flex:none;background:{BLACK};color:{WHITE}}}
.s1{{width:1080px;height:1080px}} .s9{{width:1080px;height:1920px}}
.abs{{position:absolute}}
.ph{{position:absolute;inset:0;overflow:hidden}} .ph img{{width:100%;height:100%;object-fit:cover;display:block}}
.d{{font-weight:900;text-transform:uppercase;letter-spacing:-.06em;line-height:.86}}
.sub{{font-weight:600;font-size:34px;line-height:1.25;letter-spacing:-.01em}}
.lab{{font-weight:600;font-size:22px;letter-spacing:.2em;text-transform:uppercase}}
.small{{font-weight:500;letter-spacing:.16em;text-transform:uppercase}}
.pill{{display:inline-flex;align-items:center;height:76px;padding:0 42px;border-radius:999px;font-weight:700;font-size:26px;letter-spacing:.01em;white-space:nowrap}}
.gold{{color:{GOLD}}}
"""


def board(size, a):
    key, concept, pillar, head, sub, foot, detail, p1, p9 = a
    s9 = size == 's9'
    H = 1920 if s9 else 1080
    top = 270 if s9 else 64
    base = 1580 if s9 else 1016
    fs = 124 if s9 else 112
    top_fade = ('rgba(11,11,11,.8) 0%,rgba(11,11,11,.55) 17%,rgba(11,11,11,0) 30%' if s9
                else 'rgba(11,11,11,.72) 0%,rgba(11,11,11,0) 22%')
    name = f'{key} {concept} | Static | AI talent | {detail} | {"9x16" if s9 else "1x1"} | {DATE}'
    return f'''<div class="ab {size}" data-name="{name}">
<div class="ph"><img src="{PH}{key}.jpg" style="object-position:50% {p9 if s9 else p1}%"></div>
<div class="abs" style="inset:0;background:linear-gradient(180deg,{top_fade},rgba(11,11,11,0) 34%,rgba(11,11,11,.7) 58%,rgba(11,11,11,.92) 86%)"></div>
<div class="abs" style="left:64px;top:{top}px">{svg('lockup-gold', 210 if s9 else 170)}</div>
<img class="abs" src="{INV}" style="right:64px;top:{top + (14 if s9 else 12)}px;width:{240 if s9 else 200}px">
<div class="abs" style="left:64px;right:64px;bottom:{H - base + 110}px">
  <div class="lab gold">{pillar}</div>
  <div class="d" style="font-size:{fs}px;margin-top:22px">{head}</div>
  <div class="sub" style="margin-top:26px;color:rgba(255,255,255,.88);max-width:900px">{sub}</div>
</div>
<div class="abs" style="left:64px;right:64px;top:{base - 76}px;display:flex;align-items:center;justify-content:space-between">
  {foot}<span class="pill" style="background:{GOLD};color:{BLACK}">Book a consultation</span>
</div></div>'''


def build():
    body = (f'<div class="row">{"".join(board("s1", a) for a in ADS)}</div>'
            f'<div class="row">{"".join(board("s9", a) for a in ADS)}</div>')
    head = f'<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>BAC | Influencer lifestyle</title><style>{CSS}</style>'
    (HERE / 'ads-influencer.html').write_text(head + f'</head><body>{body}</body></html>')
    (HERE / 'ads-influencer-capture.html').write_text(
        head + '<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>' + f'</head><body>{body}</body></html>')
    print(len(ADS), 'concepts')


if __name__ == '__main__':
    build()
