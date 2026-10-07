"""Signature Smiles brand guideline: HTML harness for Figma capture.

Built from signature-smiles.com (Elementor global colours and type, Oct 2026) and the
client's logo SVGs on Drive (folder 1WJuocoJANpINYoHdrIapZkuAYCSohx7r). No guidelines PDF exists.
Type: PARISIAN (the site's display face, assets/fonts/parisian.ttf) + Montserrat (Google).
Motifs taken from the site: arched photo frames with an offset stone outline, the curved
"smile · gentle · care" badge, the "Your Smile, Your Story" ribbon, olive pill buttons.
Photos are the practice's own site images (assets/photos, gitignored).

Usage: python3 build_guideline.py  ->  guideline.html (and guideline-capture.html for Figma)
"""
import re
from pathlib import Path

HERE = Path(__file__).parent
A = HERE / 'assets'

COPPER, TERRA, OLIVE, SAND, STONE, SAGE_CREAM, SAGE, LINEN, CREAM, INK, WHITE = (
    '#87552F', '#C47F4A', '#474A37', '#9A8F73', '#C9BBA0', '#E3E1D2', '#ADBA9F', '#F9F7F5', '#F3F1EF', '#1E1E1C', '#FFFFFF')

_n = 0


def svg(name, width, recolour=None):
    """Inline an official logo SVG. recolour maps source hex -> new hex (mono versions)."""
    global _n
    _n += 1
    s = (A / f'{name}.svg').read_text()
    s = re.sub(r'<\?xml[^>]*\?>', '', s)
    s = re.sub(r'id="([^"]+)"', lambda m: f'id="l{_n}-{m.group(1)}"', s)
    s = re.sub(r'url\(#([^)]+)\)', lambda m: f'url(#l{_n}-{m.group(1)})', s)
    for a, b in (recolour or {}).items():
        s = s.replace(a, b)
    w, h = (float(x) for x in re.search(r'width="([\d.]+)" height="([\d.]+)"', s).groups())
    s = re.sub(r'width="[\d.]+" height="[\d.]+"', f'width="{width}" height="{round(width * h / w, 1)}" style="display:block"', s, count=1)
    return s.strip()


CSS = f"""
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=block');
@font-face{{font-family:'PARISIAN';src:url('assets/fonts/parisian.ttf') format('truetype');font-display:block}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:#3a3a3a;font-family:'Montserrat',sans-serif;color:{INK};display:flex;flex-direction:column;gap:120px;padding:120px;width:2160px;-webkit-font-smoothing:antialiased}}
.page{{position:relative;width:1920px;height:1080px;overflow:hidden;background:{LINEN};color:{INK}}}
.olive{{background:{OLIVE};color:{LINEN}}}
.sage{{background:{SAGE_CREAM}}}
.abs{{position:absolute}}
.display{{font-family:'PARISIAN',serif;font-weight:400;line-height:1.02;color:{COPPER}}}
.h3{{font-family:'PARISIAN',serif;font-size:36px;line-height:1.15;color:{COPPER}}}
.body{{font-size:19px;line-height:1.6;font-weight:400}}
.body p+p{{margin-top:14px}}
.body b{{font-weight:600}}
.label{{font-weight:500;font-size:14px;letter-spacing:.2em;text-transform:uppercase;color:{SAND}}}
.full{{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}}
.foot{{position:absolute;left:80px;right:80px;bottom:46px;display:flex;justify-content:space-between}}
.pill{{display:inline-flex;align-items:center;justify-content:center;height:52px;padding:0 34px;border-radius:999px;font-weight:600;font-size:15px;letter-spacing:.08em;text-transform:uppercase;background:{OLIVE};color:{WHITE}}}
.ticks{{list-style:none}} .ticks li{{position:relative;padding-left:40px;margin-top:14px}}
.ticks li:before{{content:'';position:absolute;left:0;top:.2em;width:22px;height:22px;border-radius:50%;border:1.5px solid {SAND}}}
.ticks li:after{{content:'';position:absolute;left:7px;top:calc(.2em + 5px);width:6px;height:10px;border:solid {SAND};border-width:0 1.5px 1.5px 0;transform:rotate(45deg)}}
.rule{{height:1px;background:{STONE}}}
"""


def page(cls, body):
    return f'<section class="page {cls}">{body}</section>'


def arch(src, x, y, w, h, pos='50% 50%', outline=True, off=14):
    """The site's signature frame: photo in an arch, stone outline offset up and right."""
    r = f'{w / 2}px {w / 2}px 0 0'
    o = (f'<div class="abs" style="left:{x + off}px;top:{y - off}px;width:{w}px;height:{h}px;'
         f'border:2px solid {STONE};border-bottom:none;border-radius:{r}"></div>') if outline else ''
    return (o + f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;border-radius:{r};overflow:hidden">'
            f'<img src="assets/photos/{src}" style="width:100%;height:100%;object-fit:cover;object-position:{pos};display:block"></div>')


def rect(src, x, y, w, h, pos='50% 50%', r=24):
    return (f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;border-radius:{r}px;overflow:hidden">'
            f'<img src="assets/photos/{src}" style="width:100%;height:100%;object-fit:cover;object-position:{pos};display:block"></div>')


def badge(x, y, size=150):
    return f'<img class="abs" src="assets/curve-text.webp" style="left:{x}px;top:{y}px;width:{size}px;height:{size}px;object-fit:contain">'


def ribbon(y, n=6, size=40):
    item = f'<span style="display:inline-flex;align-items:center;gap:22px;margin-right:70px">{svg("logo-icon", size)}<span class="display" style="font-size:{size}px;color:{TERRA};white-space:nowrap">Your Smile, Your Story</span></span>'
    return (f'<div class="abs" style="left:0;right:0;top:{y}px;height:{size * 2.4}px;border-top:1px solid {STONE};border-bottom:1px solid {STONE};'
            f'display:flex;align-items:center;white-space:nowrap;overflow:hidden;padding-left:20px">{item * n}</div>')


def cover():
    return page('', f"""
<div class="abs" style="left:120px;top:250px">{svg('logo-original', 470)}</div>
<div class="abs label" style="left:124px;top:640px;font-size:16px">Brand guidelines · 2026</div>
<div class="abs display" style="left:120px;top:690px;font-size:64px;width:640px">Your Smile, Your Story</div>
{arch('mirror-smile.jpg', 1020, 120, 720, 960, '50% 30%')}
{badge(830, 860, 160)}
<div class="foot label"><span>signature-smiles.com · Juno Crescent, Brackley NN13 6RF</span><span></span></div>
""")


def about():
    return page('', f"""
<div class="abs label" style="left:120px;top:150px">The practice</div>
<div class="abs display" style="left:116px;top:190px;font-size:96px;width:820px">Your Local Brackley Dentist for Every Smile</div>
<div class="abs body" style="left:120px;top:540px;width:700px">
  <p>Signature Smiles is a brand-new private practice on the Brackley–Radstone border, led by its two principal dentists. It offers general, cosmetic and restorative dentistry for families, young professionals and the wider community.</p>
  <p>The practice deliberately limits patient numbers, so appointments are longer, registered patients get same-day emergency care, and every patient is known and listened to.</p>
</div>
<div class="abs" style="left:120px;top:870px;display:flex;gap:48px">
  <div><div class="display" style="font-size:56px">47</div><div class="label" style="margin-top:6px">Google reviews · Excellent</div></div>
  <div><div class="display" style="font-size:56px">0%</div><div class="label" style="margin-top:6px">Finance available</div></div>
  <div><div class="display" style="font-size:56px">Same day</div><div class="label" style="margin-top:6px">Emergency care, registered</div></div>
</div>
<div class="abs sage" style="left:1060px;top:0;width:860px;height:1080px"></div>
{arch('family-sofa.jpg', 1170, 150, 640, 860, '45% 50%')}
""")


def logo():
    misuse = [
        ("Don't recolour", f'filter:hue-rotate(160deg) saturate(2)'),
        ("Don't rotate", 'transform:rotate(-14deg)'),
        ("Don't stretch", 'transform:scaleX(1.45)'),
        ("Don't add effects", 'filter:drop-shadow(5px 6px 0 #9A8F73)'),
    ]
    tiles = ''.join(f"""
<div style="width:250px">
  <div style="height:150px;border-radius:16px;background:{WHITE};display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden">
    <div style="{css}">{svg('logo-web', 170)}</div>
    <div style="position:absolute;left:-30px;right:-30px;top:50%;height:3px;background:#B23A2E;transform:rotate(-31deg)"></div>
  </div>
  <div class="label" style="margin-top:12px;font-size:12px">{t}</div>
</div>""" for t, css in misuse)
    tile = lambda inner, w, h, bg, cap, extra='': f"""<div><div style="width:{w}px;height:{h}px;border-radius:16px;background:{bg};{extra}display:flex;align-items:center;justify-content:center">{inner}</div>
<div class="label" style="margin-top:12px;font-size:12px">{cap}</div></div>"""
    return page('', f"""
<div class="abs label" style="left:120px;top:150px">01</div>
<div class="abs display" style="left:116px;top:190px;font-size:120px">Logo</div>
<div class="abs body" style="left:120px;top:370px;width:560px">
  <p>The logo pairs the copper <b>SS monogram</b> with the hand-signed <b>Signature Smiles</b> wordmark and the Radstone line.</p>
  <p>Use the horizontal lockup in headers and on ads. Use the stacked lockup where space is square. The monogram alone is for small placements: avatars, favicons, ribbons.</p>
  <p>Keep clear space at least the height of the monogram's ring. On olive or photography, switch the wordmark to linen.</p>
</div>
<div class="abs" style="left:780px;top:110px;display:flex;gap:24px">
  {tile(svg('logo-web', 470), 560, 280, WHITE, 'Primary · horizontal')}
  {tile(svg('logo-web-light', 470), 480, 280, OLIVE, 'On olive · linen wordmark')}
</div>
<div class="abs" style="left:780px;top:450px;display:flex;gap:24px">
  {tile(svg('logo-original', 250), 330, 260, WHITE, 'Stacked')}
  {tile(svg('logo-icon', 120), 220, 260, SAGE_CREAM, 'Monogram')}
  {tile(f'<div style="padding:30px;border:1px solid {STONE}">{svg("logo-icon", 80)}</div>', 466, 260, 'transparent', 'Clear space = monogram ring height', f'border:1px dashed {SAND};')}
</div>
<div class="abs" style="left:780px;top:790px;display:flex;gap:20px">{tiles}</div>
""")


def colour():
    sw = [
        ('Copper', COPPER, 'Headlines and key text.', ''),
        ('Terracotta', TERRA, 'Logo monogram, links, small accents.', ''),
        ('Olive', OLIVE, 'Buttons and dark sections.', ''),
        ('Sand', SAND, 'Labels, icons, fine lines.', ''),
        ('Stone', STONE, 'Arch outlines and dividers.', ''),
        ('Sage Cream', SAGE_CREAM, 'Feature panels.', ''),
        ('Linen', LINEN, 'Main background.', f'border:1px solid {STONE};'),
        ('Warm Cream', CREAM, 'Alternate section background.', f'border:1px solid {STONE};'),
    ]
    cards = ''.join(f"""
<div style="width:360px">
  <div style="height:200px;border-radius:20px;background:{hx};{extra}"></div>
  <div class="h3" style="font-size:30px;margin-top:16px">{n}</div>
  <div class="label" style="margin-top:6px;font-size:13px">HEX {hx}</div>
  <div class="body" style="font-size:16px;margin-top:4px;color:rgba(30,30,28,.7)">{r}</div>
</div>""" for n, hx, r, extra in sw)
    return page('', f"""
<div class="abs label" style="left:120px;top:110px">02</div>
<div class="abs display" style="left:116px;top:150px;font-size:120px">Colour</div>
<div class="abs body" style="left:720px;top:180px;width:1050px;color:rgba(30,30,28,.75)">Warm, natural and calm. Copper carries the voice, olive does the work (buttons, dark panels), and the neutrals keep the page light. Black only appears in body text.</div>
<div class="abs" style="left:120px;top:340px;width:1680px;display:flex;flex-wrap:wrap;gap:40px 80px">{cards}</div>
""")


def type_():
    return page('', f"""
<div class="abs label" style="left:120px;top:110px">03</div>
<div class="abs display" style="left:116px;top:150px;font-size:120px">Typography</div>
<div class="abs" style="left:120px;top:330px;width:760px">
  <div class="display" style="font-size:300px;line-height:1">Aa</div>
  <div class="h3" style="margin-top:10px">PARISIAN</div>
  <div class="body" style="margin-top:8px;color:rgba(30,30,28,.72)">Display face. Headlines, big numbers and short statements. Sentence or title case, never all caps. Set light and open.</div>
  <div class="display" style="margin-top:22px;font-size:34px;color:{INK};line-height:1.4">ABCDEFGHIJKLMNOPQRSTUVWXYZ<br>abcdefghijklmnopqrstuvwxyz 0123456789 £</div>
</div>
<div class="abs olive" style="left:1000px;top:0;width:920px;height:1080px;padding:120px 90px">
  <div class="label" style="color:{STONE}">Headline · PARISIAN · 64–120px</div>
  <div class="display" style="font-size:84px;margin-top:16px;color:{LINEN}">Supporting Nervous Patients</div>
  <div class="label" style="margin-top:50px;color:{STONE}">Subhead · PARISIAN · 30–40px</div>
  <div class="display" style="font-size:36px;margin-top:12px;color:{STONE}">We're here to make looking after your smile simple.</div>
  <div class="label" style="margin-top:50px;color:{STONE}">Body · Montserrat Regular · 16–20px · 160%</div>
  <div class="body" style="margin-top:12px;color:rgba(249,247,245,.88)">Our calming interiors, modern technology and friendly team ensure every visit feels comfortable from start to finish.</div>
  <div class="label" style="margin-top:50px;color:{STONE}">Label and button · Montserrat SemiBold · caps · +8–20%</div>
  <div style="margin-top:16px;display:flex;gap:20px;align-items:center"><span class="pill" style="background:{LINEN};color:{OLIVE}">Book an appointment</span><span class="label" style="color:{LINEN}">Why choose us</span></div>
</div>
""")


def elements():
    return page('sage', f"""
<div class="abs label" style="left:120px;top:110px">04</div>
<div class="abs display" style="left:116px;top:150px;font-size:120px">Graphic elements</div>
{arch('girl-chair.jpg', 130, 420, 380, 520, '60% 50%')}
<div class="abs label" style="left:130px;top:960px">The arch · stone outline offset</div>
<div class="abs" style="left:640px;top:420px;width:300px;height:300px;border-radius:24px;background:{LINEN};display:flex;align-items:center;justify-content:center"><img src="assets/curve-text.webp" style="width:190px;height:190px;object-fit:contain"></div>
<div class="abs label" style="left:640px;top:740px">Curved badge</div>
<div class="abs" style="left:1040px;top:420px;width:760px">
  <div class="label">Check list</div>
  <ul class="ticks body" style="margin-top:6px">
    <li>Personalised treatment plans</li><li>Time and attention you deserve</li><li>Comfort and confidence at every step</li>
  </ul>
  <div class="label" style="margin-top:44px">Buttons</div>
  <div style="margin-top:16px;display:flex;gap:18px"><span class="pill">Book online</span><span class="pill" style="background:{WHITE};color:{OLIVE}">Register as a patient</span></div>
  <div class="label" style="margin-top:44px">Panel</div>
  <div style="margin-top:14px;height:90px;border-radius:0 0 60px 60px;background:{LINEN}"></div>
</div>
<div class="abs label" style="left:1040px;top:880px">Ribbon</div>
<div class="abs" style="left:1040px;top:910px;width:880px;height:110px;overflow:hidden">{ribbon(0, 3, 34).replace('left:0;right:0;top:0px', 'left:0;width:2000px;top:0px')}</div>
""")


def photography():
    return page('', f"""
<div class="abs label" style="left:120px;top:110px">05</div>
<div class="abs display" style="left:116px;top:150px;font-size:120px">Photography</div>
<div class="abs body" style="left:120px;top:330px;width:560px">
  <p><b>Do:</b> warm, bright, natural light. Real smiles and relaxed moments: families, couples, children in the chair. The Signature Smiles team in their olive scrubs.</p>
  <p style="margin-top:22px"><b>Don't:</b> cold clinical blue, gloved close-ups or instruments, video grabs with coloured studio lighting. No before-and-afters without a consented case.</p>
</div>
<div class="abs" style="left:120px;top:720px;display:flex;gap:26px">
  {''.join(f'<div style="width:170px;height:170px;border-radius:50%;overflow:hidden"><img src="assets/photos/{p}" style="width:100%;height:100%;object-fit:cover;object-position:50% 20%"></div>' for p in ['team-emilia.jpg', 'team-man.jpg', 'team-lorraine.jpg'])}
</div>
<div class="abs label" style="left:120px;top:910px">The team · olive scrubs, warm studio</div>
{arch('kid-high-five.jpg', 880, 120, 400, 560, '40% 50%', False)}
{arch('older-couple.jpg', 1310, 120, 490, 560, '50% 40%', False)}
{rect('couple-laughing.jpg', 880, 710, 450, 300, '50% 40%')}
{rect('woman-phone-sofa.jpg', 1360, 710, 440, 300, '60% 40%')}
""")


def voice():
    return page('olive', f"""
<div class="abs label" style="left:120px;top:110px;color:{STONE}">06</div>
<div class="abs display" style="left:116px;top:150px;font-size:120px;color:{LINEN}">Tone of voice</div>
<div class="abs" style="left:120px;top:360px;width:560px">
  <div class="h3" style="color:{STONE}">We sound</div>
  <ul class="ticks body" style="margin-top:8px;color:rgba(249,247,245,.9)">
    <li>Warm and local. A Brackley practice talking to neighbours</li>
    <li>Calm and unhurried. Never pressure, never judgement</li>
    <li>Honest and clear. Real prices, explained properly</li>
    <li>Personal. Patients are known and listened to</li>
  </ul>
</div>
<div class="abs" style="left:740px;top:360px;width:460px">
  <div class="h3" style="color:{STONE}">We never</div>
  <ul class="ticks body" style="margin-top:8px;color:rgba(249,247,245,.9)">
    <li>Call a normal price an offer</li>
    <li>Use fake urgency or countdowns</li>
    <li>Judge how long it's been</li>
    <li>Promise results we can't show</li>
  </ul>
</div>
<div class="abs" style="left:1300px;top:120px;width:520px;height:840px;border-radius:260px 260px 0 0;background:{SAGE_CREAM};padding:300px 56px 0">
  <div class="display" style="font-size:40px;line-height:1.25">“From the first consultation, they were honest, clear, and never pressured me.”</div>
  <div class="label" style="margin-top:28px">Google review · how patients describe us</div>
</div>
""")


def applications():
    feed = f"""
<div class="abs" style="left:120px;top:260px;width:680px;height:680px;border-radius:8px;overflow:hidden;background:{WHITE}">
  {arch('patient-mirror.jpg', 370, 70, 280, 610, '30% 50%')}
  <div class="abs" style="left:40px;top:44px">{svg('logo-web', 210)}</div>
  <div class="abs display" style="left:40px;top:250px;font-size:50px;width:300px">Not been in years?</div>
  <div class="abs body" style="left:40px;top:430px;width:250px;font-size:17px">No judgement. Just a calm, unhurried first visit.</div>
  <div class="abs" style="left:40px;bottom:44px"><span class="pill" style="height:46px;font-size:13px;padding:0 24px">Book your visit</span></div>
</div>
<div class="abs label" style="left:120px;top:962px">Meta feed · 1:1</div>"""
    story = f"""
<div class="abs" style="left:850px;top:260px;width:383px;height:680px;border-radius:8px;overflow:hidden;background:{SAGE_CREAM}">
  <div class="abs" style="left:0;right:0;top:70px;display:flex;justify-content:center">{svg('logo-original', 150)}</div>
  {arch('family-sofa.jpg', 46, 300, 290, 250, '45% 50%')}
  <div class="abs display" style="left:30px;right:30px;top:190px;text-align:center;font-size:34px">Care for the whole family</div>
  <div class="abs" style="left:0;right:0;bottom:70px;display:flex;justify-content:center"><span class="pill" style="height:42px;font-size:12px;padding:0 22px">Register as a patient</span></div>
</div>
<div class="abs label" style="left:850px;top:962px">Meta story · 9:16</div>"""
    card = f"""
<div class="abs olive" style="left:1283px;top:260px;width:517px;height:680px;border-radius:8px;overflow:hidden;padding:48px 44px">
  {svg('logo-web-light', 200)}
  <div class="display" style="font-size:60px;margin-top:70px;color:{LINEN}">Your Smile, Your Story</div>
  <ul class="ticks body" style="margin-top:20px;font-size:17px;color:rgba(249,247,245,.9)">
    <li>Longer appointments</li><li>0% finance available</li><li>47 Google reviews, rated Excellent</li>
  </ul>
  <span class="pill" style="position:absolute;left:44px;bottom:48px;background:{LINEN};color:{OLIVE};height:46px;font-size:13px">Book online</span>
</div>
<div class="abs label" style="left:1283px;top:962px">Feed · olive variant</div>"""
    return page('', f"""
<div class="abs label" style="left:120px;top:90px">07</div>
<div class="abs display" style="left:116px;top:120px;font-size:100px">In use</div>
{feed}{story}{card}
""")


def close():
    return page('sage', f"""
{ribbon(120)}
<div class="abs" style="left:0;right:0;top:370px;display:flex;justify-content:center">{svg('logo-original', 420)}</div>
<div class="abs display" style="left:0;right:0;top:720px;text-align:center;font-size:48px">Built on trust, care and a passion for helping patients</div>
<div class="foot label"><span>signature-smiles.com</span><span>01280 733343</span></div>
""")


def main():
    pages = [cover(), about(), logo(), colour(), type_(), elements(), photography(), voice(), applications(), close()]
    head = f'<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>Signature Smiles Brand Guidelines</title><style>{CSS}</style>'
    body = f'</head><body>{"".join(pages)}</body></html>'
    (HERE / 'guideline.html').write_text(head + body)
    (HERE / 'guideline-capture.html').write_text(head + '<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>' + body)
    print('pages', len(pages))


if __name__ == '__main__':
    main()
