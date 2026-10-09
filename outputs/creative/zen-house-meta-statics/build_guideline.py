"""Zen House Dental brand guideline: HTML harness for Figma capture.

Built to the ad system the client has signed off (Figma "Zen House | New Creatives",
NGnCi86PMYF5jlAEGEOYtg), with brand basics from zenhousedental.co.uk (no brand folder on Drive).
- Type: SLTF The Silver Editorial Regular, sentence case, second phrase in Regular Italic;
  Medium for the CTA bar. Open Sans for body and tracked uppercase eyebrows.
- Ad devices (from the signed-off set): full-bleed photo, soft dark scrim, white wordmark top
  centre, eyebrow "TREATMENT · LOCATION", headline, one Open Sans support line, square
  translucent white CTA bar reading "Book a consultation today".
- Palette: the site's Elementor globals plus the sand/cream used in the signed-off set.
- Logo: the site's SVG wordmark (wp-content/uploads/2025/03/Vector-7.svg), recoloured.
- Photos: the practice's own photography from the site (assets/photos, gitignored).

Usage: python3 build_guideline.py  ->  guideline.html + guideline-capture.html (Figma capture)
"""
from pathlib import Path

HERE = Path(__file__).parent
A = HERE / 'assets'

LINEN, GOLD, BRONZE, ESPRESSO, GRAPHITE = '#E7E1D9', '#BEA17A', '#9B794B', '#3D3223', '#4B4A45'
SAND, CREAM, BLACK, WHITE = '#C7BBA5', '#F5ECDD', '#000000', '#FFFFFF'


def logo(colour, width):
    s = (A / 'logo-white.svg').read_text().replace('fill="white"', f'fill="{colour}"')
    h = round(width * 44 / 180, 1)
    return s.replace('width="180" height="44"', f'width="{width}" height="{h}" style="display:block"', 1)


CSS = f"""
@font-face{{font-family:'SLTF The Silver Editorial';src:url('assets/fonts/SLTFTheSilverEditorial-Regular.otf');font-style:normal;font-weight:400}}
@font-face{{font-family:'SLTF The Silver Editorial';src:url('assets/fonts/SLTFTheSilverEditorial-RegularItalic.otf');font-style:italic;font-weight:400}}
@font-face{{font-family:'SLTF The Silver Editorial';src:url('assets/fonts/SLTFTheSilverEditorial-Medium.otf');font-style:normal;font-weight:500}}
@font-face{{font-family:'Open Sans';src:url('assets/fonts/OpenSans-VariableFont_wdthwght.ttf');font-weight:300 800}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:#2b2b2b;font-family:'Open Sans',sans-serif;color:{BLACK};display:flex;flex-direction:column;gap:120px;padding:120px;width:2160px;-webkit-font-smoothing:antialiased}}
.page{{position:relative;width:1920px;height:1080px;overflow:hidden;background:{LINEN}}}
.dark{{background:{BLACK};color:{WHITE}}} .white{{background:{WHITE}}}
.abs{{position:absolute}}
.serif{{font-family:'SLTF The Silver Editorial',serif;font-weight:400;line-height:1.08;letter-spacing:0}}
.serif em,em.i{{font-style:italic;font-weight:400}}
.label{{font-weight:400;font-size:16px;letter-spacing:.1em;text-transform:uppercase}}
.body{{font-size:19px;line-height:1.6}} .body p+p{{margin-top:14px}}
.small{{font-size:15px;line-height:1.55}}
.ph{{position:absolute;overflow:hidden}}
.ph img{{width:100%;height:100%;object-fit:cover;display:block}}
.full{{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}}
.cta{{display:inline-flex;align-items:center;justify-content:center;font-family:'SLTF The Silver Editorial',serif;font-weight:500;color:{BLACK}}}
.foot{{position:absolute;left:80px;right:80px;bottom:44px;display:flex;justify-content:space-between;font-size:13px;letter-spacing:.2em;text-transform:uppercase}}
.num{{font-size:13px;letter-spacing:.2em;color:{BRONZE}}}
.swatch{{position:absolute;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;padding:26px}}
"""


def page(cls, body, n=None, title=None, colour=BLACK):
    head = ''
    if title:
        head = f'<div class="abs num" style="left:80px;top:64px">{n:02d}</div><div class="abs label" style="left:130px;top:62px;font-size:13px;letter-spacing:.2em;color:{colour}">{title}</div>'
    return f'<section class="page {cls}">{head}{body}</section>'


def foot(colour=BLACK):
    return f'<div class="foot" style="color:{colour}"><span>zenhousedental.co.uk</span><span>Brand guidelines · 2026</span></div>'


def ph(src, x, y, w, h, pos='50% 50%'):
    return f'<div class="ph" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px"><img src="assets/photos/{src}" style="object-position:{pos}"></div>'


def cta(w, h, size, alpha=.75, text='Book a consultation today'):
    return f'<div class="cta" style="width:{w}px;height:{h}px;font-size:{size}px;background:rgba(255,255,255,{alpha})">{text}</div>'


def scrim(stop=40):
    return f'<div class="abs" style="inset:0;background:linear-gradient(180deg,rgba(0,0,0,.28),rgba(0,0,0,0) 25%,rgba(0,0,0,0) {stop}%,rgba(0,0,0,.62))"></div>'


# ---------- ads in the signed-off style (used on the Applications page) ----------

def ad_square(s, photo, pos, eyebrow, line1, line2, support):
    """1080x1080 at scale s: logo top centre, eyebrow, headline, support line, CTA bar (left aligned)."""
    return f"""<div style="position:relative;width:{1080 * s}px;height:{1080 * s}px;overflow:hidden;background:{BLACK}">
<img src="assets/photos/{photo}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:{pos}">
{scrim(35)}
<div style="position:absolute;left:0;right:0;top:{104 * s}px;display:flex;justify-content:center">{logo(WHITE, 408 * s)}</div>
<div style="position:absolute;left:{92 * s}px;top:{560 * s}px;width:{800 * s}px;color:{WHITE}">
  <div class="label" style="font-size:{23.5 * s}px">{eyebrow}</div>
  <div class="serif" style="font-size:{80 * s}px;margin-top:{14 * s}px;line-height:1.05">{line1}<br><em>{line2}</em></div>
  <div style="font-size:{26 * s}px;line-height:1.38;margin-top:{18 * s}px;width:{620 * s}px">{support}</div>
</div>
<div style="position:absolute;left:{92 * s}px;top:{905 * s}px">{cta(737 * s, 88 * s, 40 * s)}</div>
</div>"""


def ad_story(s, photo, pos, eyebrow, line1, line2):
    """1080x1920 at scale s, inside the 9:16 safe zones (top 250, bottom 340 kept clear of copy)."""
    return f"""<div style="position:relative;width:{1080 * s}px;height:{1920 * s}px;overflow:hidden;background:{BLACK}">
<img src="assets/photos/{photo}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:{pos}">
{scrim(45)}
<div style="position:absolute;left:0;right:0;top:{260 * s}px;display:flex;justify-content:center">{logo(WHITE, 520 * s)}</div>
<div style="position:absolute;left:{115 * s}px;top:{1160 * s}px;width:{860 * s}px;color:{WHITE}">
  <div class="label" style="font-size:{28 * s}px">{eyebrow}</div>
  <div class="serif" style="font-size:{86 * s}px;margin-top:{16 * s}px;line-height:1.05">{line1}<br><em>{line2}</em></div>
</div>
<div style="position:absolute;left:{115 * s}px;top:{1460 * s}px">{cta(849 * s, 102 * s, 56 * s, .5)}</div>
</div>"""


# ---------- pages ----------

def cover():
    return page('dark', f"""
<img class="full" src="assets/photos/banstead-aligner-neon.jpg" style="object-position:50% 30%">
<div class="abs" style="inset:0;background:linear-gradient(180deg,rgba(0,0,0,.5),rgba(0,0,0,.3) 45%,rgba(0,0,0,.72))"></div>
<div class="abs" style="left:0;right:0;top:320px;display:flex;flex-direction:column;align-items:center;text-align:center">
  {logo(WHITE, 560)}
  <div class="serif" style="font-size:104px;margin-top:70px;color:{WHITE}">Brand <em>guidelines</em></div>
  <div class="label" style="margin-top:28px;color:{WHITE};letter-spacing:.2em">Banstead · Battersea</div>
</div>
{foot(WHITE)}""")


def story():
    return page('', f"""
<div class="abs serif" style="left:80px;top:150px;width:800px;font-size:104px">Exceptional dentistry <em>with a family touch.</em></div>
<div class="abs body" style="left:80px;top:540px;width:720px;color:{GRAPHITE}">
<p>Zen House Dental was founded in 2021 by brother and sister Dr Shaimil Patel and Mrs Priya Shah, in the Banstead building that was once their parents' photo framing and printing studio.</p>
<p>In 2026 the brand opened a second practice on Northcote Road, Battersea. Both share one idea: replace dental anxiety with calm, through soft tones, luxury spaces and a personal touch.</p></div>
<div class="abs" style="left:80px;top:870px">{cta(520, 76, 34, 1).replace('background:rgba(255,255,255,1)', f'background:{WHITE}')}</div>
{ph('team-shaimil.jpg', 960, 150, 420, 560, '50% 20%')}
{ph('team-priya.jpg', 1420, 150, 420, 560, '50% 20%')}
<div class="abs label" style="left:960px;top:735px;font-size:13px">Dr Shaimil Patel</div>
<div class="abs label" style="left:1420px;top:735px;font-size:13px">Mrs Priya Shah</div>
<div class="abs" style="left:960px;top:820px;width:880px">
  <div class="label" style="font-size:13px;color:{BRONZE}">Brand promise</div>
  <div class="serif" style="font-size:58px;margin-top:10px">A luxury <em>dental experience.</em></div></div>
{foot()}""", 1, 'Our story')


def logo_page():
    misuse = [
        ('Stretched', f'<div style="transform:scaleX(1.45)">{logo(BLACK, 150)}</div>'),
        ('Off-palette colour', logo('#2F7DE1', 200)),
        ('Rotated', f'<div style="transform:rotate(-12deg)">{logo(BLACK, 190)}</div>'),
        ('Busy photo, no scrim', f'<div style="position:absolute;inset:0"><img src="assets/photos/consult.jpg" style="width:100%;height:100%;object-fit:cover"><div style="position:absolute;left:31px;top:55px">{logo(GOLD, 200)}</div></div>'),
    ]
    mis = ''.join(f"""<div style="width:262px;height:160px;background:{WHITE};position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden">{m}
<svg class="abs" style="left:0;top:0" width="262" height="160"><line x1="16" y1="146" x2="246" y2="14" stroke="#C0392B" stroke-width="3"/></svg>
<div class="abs label" style="left:20px;top:16px;font-size:11px;color:#C0392B">{t}</div></div>""" for t, m in misuse)
    return page('', f"""
<div class="abs serif" style="left:80px;top:130px;font-size:78px">The <em>wordmark</em></div>
<div class="abs body" style="left:80px;top:270px;width:520px;color:{GRAPHITE}"><p>A typographic wordmark: ZEN HOUSE in wide capitals over a tracked DENTAL. Always use the master artwork. Never retype it.</p>
<p>Clear space on every side equals the height of the Z. Minimum width is 120px on screen, 30mm in print.</p>
<p>In ads the wordmark sits top centre, white, about 38% of the canvas width.</p></div>
<div class="abs" style="left:700px;top:130px;width:1140px;height:430px;background:{WHITE};display:flex;align-items:center;justify-content:center">
  <div style="position:relative;padding:60px;border:1.5px dashed {GOLD}">{logo(BLACK, 620)}
  <div class="abs label" style="left:6px;top:6px;font-size:11px;color:{BRONZE}">Z</div></div></div>
<div class="abs" style="left:700px;top:590px;width:360px;height:150px;background:{BLACK};display:flex;align-items:center;justify-content:center">{logo(WHITE, 260)}</div>
<div class="abs" style="left:1090px;top:590px;width:360px;height:150px;background:{CREAM};display:flex;align-items:center;justify-content:center">{logo(BLACK, 260)}</div>
<div class="abs" style="left:1480px;top:590px;width:360px;height:150px;overflow:hidden"><img src="assets/photos/mirror-reveal-2.jpg" class="full" style="object-position:50% 40%"><div class="abs" style="inset:0;background:rgba(0,0,0,.35)"></div><div class="abs" style="inset:0;display:flex;align-items:center;justify-content:center">{logo(WHITE, 260)}</div></div>
<div class="abs label" style="left:700px;top:752px;font-size:11px">White on black</div>
<div class="abs label" style="left:1090px;top:752px;font-size:11px">Black on cream</div>
<div class="abs label" style="left:1480px;top:752px;font-size:11px">White on photo with scrim</div>
<div class="abs label" style="left:700px;top:800px;font-size:13px;color:{BRONZE}">Misuse</div>
<div class="abs" style="left:700px;top:835px;display:flex;gap:24px">{mis}</div>
{foot()}""", 2, 'Logo')


def colour():
    sw = [
        ('White', WHITE, 'Type and logo on photography', BLACK, 80, 150, 560, 400),
        ('Black', BLACK, 'Type on light grounds and the CTA', WHITE, 680, 150, 560, 400),
        ('Linen', LINEN, 'Website canvas and light sections', BLACK, 1280, 150, 560, 400),
        ('Cream', CREAM, 'Light ad backgrounds', BLACK, 80, 590, 340, 280),
        ('Sand', SAND, 'Warm neutral grounds and gradients', BLACK, 450, 590, 340, 280),
        ('Champagne gold', GOLD, 'Awards band and fine accents', BLACK, 820, 590, 340, 280),
        ('Bronze', BRONZE, 'Small gold text on light grounds', WHITE, 1190, 590, 300, 280),
        ('Espresso', ESPRESSO, 'Deep warm alternative to black', WHITE, 1520, 590, 320, 280),
    ]
    cards = ''.join(f"""<div class="swatch" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;background:{c};color:{t};{'border:1.5px solid ' + SAND + ';' if c in (WHITE, CREAM, LINEN) else ''}">
<div class="serif" style="font-size:{46 if h > 300 else 36}px">{n}</div><div class="label" style="font-size:12px;margin-top:10px;letter-spacing:.2em">{c}</div><div class="small" style="margin-top:6px;opacity:.8">{u}</div></div>""" for n, c, u, t, x, y, w, h in sw)
    return page('white', f"""{cards}
<div class="abs small" style="left:80px;top:910px;width:1500px;color:{GRAPHITE}">Ads are photography-led: white type over the image, black type on cream or sand. Colour comes from the photos, not from fills. Gold is a website and awards accent, kept out of ad headlines.</div>
{foot()}""", 3, 'Colour')


def typography():
    return page('', f"""
<div class="abs" style="left:80px;top:130px;width:1060px">
  <div class="label" style="font-size:13px;color:{BRONZE};letter-spacing:.2em">Headline · SLTF The Silver Editorial Regular + Regular Italic · sentence case</div>
  <div class="serif" style="font-size:150px;margin-top:22px;line-height:1.02">Day one <br><em>to day done.</em></div>
  <div class="small" style="margin-top:22px;color:{GRAPHITE};width:820px">Two short lines. The first line sets up in Regular; the second phrase lands in Italic. Full stop on statements, none on location lines.</div>
</div>
<div class="abs" style="left:80px;top:700px;width:560px">
  <div class="label" style="font-size:13px;color:{BRONZE};letter-spacing:.2em">Eyebrow · Open Sans Regular · uppercase, +10% tracking</div>
  <div class="label" style="font-size:24px;margin-top:18px">Invisalign · Banstead</div>
  <div class="label" style="font-size:13px;color:{BRONZE};margin-top:44px;letter-spacing:.2em">Support line · Open Sans Regular</div>
  <div style="font-size:24px;line-height:1.4;margin-top:12px;color:{GRAPHITE}">Clear aligners no one notices.</div>
</div>
<div class="abs" style="left:720px;top:700px;width:520px">
  <div class="label" style="font-size:13px;color:{BRONZE};letter-spacing:.2em">CTA · SLTF The Silver Editorial Medium</div>
  <div style="margin-top:22px;display:inline-block;background:{SAND}">{cta(500, 72, 34, .75)}</div>
  <div class="small" style="margin-top:14px;color:{GRAPHITE}">Square bar, white at 75% on feed and 50% on story. Always "Book a consultation today".</div>
</div>
<div class="abs" style="left:1320px;top:130px;width:520px;height:800px;background:{BLACK};overflow:hidden">
  <img class="full" src="assets/photos/itero-scan.jpg" style="object-position:50% 50%;opacity:.85">{scrim(30)}
  <div class="abs" style="left:44px;top:420px;width:440px;color:{WHITE}">
    <div class="label" style="font-size:14px">Invisalign · Battersea</div>
    <div class="serif" style="font-size:58px;margin-top:10px;line-height:1.05">Discreet <br><em>by design.</em></div>
    <div style="font-size:16px;line-height:1.4;margin-top:12px">Clear aligners no one notices.</div>
  </div>
  <div class="abs" style="left:44px;top:690px">{cta(430, 60, 30)}</div>
</div>
<div class="abs label" style="left:1320px;top:945px;font-size:11px;letter-spacing:.2em">Hierarchy: eyebrow, headline, support, CTA</div>
{foot()}""", 4, 'Typography')


def elements():
    return page('', f"""
<div class="abs" style="left:80px;top:140px;width:540px;height:400px;background:{SAND};display:flex;flex-direction:column;justify-content:center;padding:50px">
  <div class="label" style="font-size:12px;letter-spacing:.2em">CTA bar</div>
  <div style="margin-top:26px">{cta(440, 68, 32, .75)}</div>
  <div class="small" style="margin-top:22px">Square corners, no border, no icon. Left-aligned with the copy above it.</div>
</div>
<div class="abs" style="left:660px;top:140px;width:540px;height:400px;overflow:hidden;background:{BLACK}">
  <img class="full" src="assets/photos/scan-consult.jpg" style="object-position:50% 40%">{scrim(35)}
  <div class="abs label" style="left:30px;top:24px;font-size:12px;color:{WHITE};letter-spacing:.2em">Scrim</div>
  <div class="abs small" style="left:30px;top:330px;width:480px;color:{WHITE}">Soft dark fade at the top behind the logo and at the bottom behind the copy. The photo stays the hero.</div>
</div>
<div class="abs" style="left:1240px;top:140px;width:600px;height:400px;background:{CREAM};padding:50px">
  <div class="label" style="font-size:12px;letter-spacing:.2em">Eyebrow</div>
  <div class="label" style="font-size:26px;margin-top:30px">Composite bonding · Banstead</div>
  <div class="label" style="font-size:26px;margin-top:14px">Smile makeover · Battersea</div>
  <div class="label" style="font-size:26px;margin-top:14px">Invisalign · Battersea</div>
  <div class="small" style="margin-top:30px;color:{GRAPHITE}">Treatment, then practice. Every location ad carries one.</div>
</div>
<div class="abs" style="left:80px;top:580px;width:1760px;height:200px;background:{GOLD};display:flex;align-items:center;justify-content:space-around;color:{WHITE};text-align:center">
  <div><div class="label" style="font-size:12px;letter-spacing:.2em">Private Dentistry Awards</div><div class="serif" style="font-size:40px;margin-top:8px">Practice of the year</div><div class="label" style="font-size:11px;margin-top:6px;letter-spacing:.2em">Finalist</div></div>
  <div><div class="label" style="font-size:12px;letter-spacing:.2em">Private Dentistry Awards</div><div class="serif" style="font-size:40px;margin-top:8px">Best patient care</div><div class="label" style="font-size:11px;margin-top:6px;letter-spacing:.2em">Finalist</div></div>
  <div><div class="label" style="font-size:12px;letter-spacing:.2em">Private Dentistry Awards</div><div class="serif" style="font-size:40px;margin-top:8px">Best digital practice</div><div class="label" style="font-size:11px;margin-top:6px;letter-spacing:.2em">Finalist</div></div>
</div>
<div class="abs small" style="left:80px;top:800px;width:1760px;color:{GRAPHITE}">Awards band (website): champagne gold, white type. All placings are finalist, so always say finalist. In ads, proof goes in the support line or primary text: top 1% of Invisalign providers in Europe, 5.0 from 500+ Google reviews.</div>
{foot()}""", 5, 'Graphic elements')


def photography():
    return page('white', f"""
<div class="abs serif" style="left:80px;top:130px;font-size:86px;width:520px">Real people, <em>real rooms.</em></div>
<div class="abs body" style="left:80px;top:360px;width:500px;color:{GRAPHITE}">
<p>Full-bleed and warm. Three families of shot: close-up smiles and real patients; candid treatment moments (the scan, the mirror reveal, the aligner); and the two practices.</p>
<p>Use the practice's own photography wherever it exists. Before-and-afters carry the ZEN HOUSE watermark and are used only with patient consent.</p></div>
{ph('smile-1.jpg', 640, 130, 380, 380, '50% 30%')}
{ph('mirror-reveal.jpg', 1050, 130, 380, 380, '50% 40%')}
{ph('aligner-hand.jpg', 1460, 130, 380, 380, '55% 40%')}
{ph('itero-scan.jpg', 640, 540, 380, 380, '50% 50%')}
{ph('battersea-reception.jpg', 1050, 540, 380, 380, '45% 50%')}
{ph('ba-bonding-8.jpg', 1460, 540, 380, 380, '50% 50%')}
<div class="abs" style="left:80px;top:760px;width:500px">
  <div class="label" style="font-size:12px;color:{BRONZE};letter-spacing:.2em">Avoid</div>
  <div class="small" style="margin-top:10px;color:{GRAPHITE}">Cold blue clinical stock, masked close-ups of instruments, before-and-afters without consent, and stock that shows another practice's rooms.</div>
</div>
{foot()}""", 6, 'Photography')


def voice():
    pairs = [('Calm', 'We take it at your pace.', 'Don’t panic about your teeth!'),
             ('Personal', 'Helping Banstead smile with confidence.', 'Our dental solutions provider network.'),
             ('Assured', 'Discreet by design.', 'The best dentist in the world, guaranteed.'),
             ('Warm luxury', 'A luxury dental experience.', 'Cheap deals. Hurry, limited spaces!')]
    rows = ''.join(f"""<div style="display:flex;gap:30px;padding:24px 0;border-top:1px solid {SAND}">
<div class="serif" style="width:260px;font-size:44px">{t}</div>
<div style="width:520px"><div class="label" style="font-size:11px;color:{BRONZE};letter-spacing:.2em">We say</div><div class="body" style="margin-top:6px">{y}</div></div>
<div style="width:520px;opacity:.55"><div class="label" style="font-size:11px;letter-spacing:.2em">We don’t say</div><div class="body" style="margin-top:6px;text-decoration:line-through">{n}</div></div></div>""" for t, y, n in pairs)
    return page('', f"""
<div class="abs serif" style="left:80px;top:130px;font-size:96px">How <em>we sound</em></div>
<div class="abs body" style="left:80px;top:265px;width:1300px;color:{GRAPHITE}">Calm, warm and quietly confident. Short sentences. UK English. No em dashes, no hype, no fear. Headlines are short and name the place where it helps; the facts (offers, awards, reviews) do the persuading.</div>
<div class="abs" style="left:80px;top:390px;width:1400px">{rows}</div>
{foot()}""", 7, 'Tone of voice')


def locations():
    return page('dark', f"""
<div class="abs" style="left:0;top:0;width:960px;height:1080px"><img class="full" src="assets/photos/banstead-waiting.jpg" style="object-position:55% 50%"><div class="abs" style="inset:0;background:rgba(0,0,0,.45)"></div></div>
<div class="abs" style="left:960px;top:0;width:960px;height:1080px"><img class="full" src="assets/photos/battersea-reception.jpg" style="object-position:40% 50%"><div class="abs" style="inset:0;background:rgba(0,0,0,.45)"></div></div>
<div class="abs" style="left:0;width:960px;top:400px;text-align:center"><div class="serif" style="font-size:130px">Banstead</div><div class="label" style="font-size:16px;margin-top:20px;letter-spacing:.2em">55 High Street, Banstead, Surrey SM7 2NL</div><div class="small" style="margin-top:30px;opacity:.85">The original practice. Surrey village high street, families.</div></div>
<div class="abs" style="left:960px;width:960px;top:400px;text-align:center"><div class="serif" style="font-size:130px"><em>Battersea</em></div><div class="label" style="font-size:16px;margin-top:20px;letter-spacing:.2em">128 Northcote Road, London SW11 6QZ</div><div class="small" style="margin-top:30px;opacity:.85">The London practice, opened 2026. Young professionals, busy diaries.</div></div>
<div class="abs label" style="left:80px;top:62px;font-size:13px;color:{WHITE};letter-spacing:.2em"><span style="color:{GOLD}">08</span>&nbsp;&nbsp;&nbsp;Our two practices</div>
<div class="abs small" style="left:0;right:0;bottom:90px;text-align:center;opacity:.85">Location ads name the practice in the eyebrow ("Invisalign · Banstead") and, where it reads naturally, in the headline.</div>
{foot(WHITE)}""")


def applications():
    return page('', f"""
<div class="abs serif" style="left:80px;top:130px;font-size:96px;width:560px">In <em>use</em></div>
<div class="abs body" style="left:80px;top:270px;width:520px;color:{GRAPHITE}"><p>The signed-off Meta system: full-bleed photo, scrim, white wordmark top centre, eyebrow naming the treatment and practice, a two-line headline with an italic second phrase, one support line and the CTA bar.</p>
<p>Story formats keep the logo and copy out of the top 250px and bottom 340px.</p></div>
<div class="abs" style="left:680px;top:150px">{ad_square(0.66, 'itero-scan.jpg', '50% 50%', 'Invisalign · Banstead', 'Discreet', 'by design.', 'Clear aligners no one notices, fitted by the top 1% of Invisalign providers in Europe.')}</div>
<div class="abs label" style="left:680px;top:880px;font-size:12px;letter-spacing:.2em">Feed 1:1 · Banstead</div>
<div class="abs" style="left:1440px;top:110px">{ad_story(0.43, 'battersea-reception.jpg', '45% 50%', 'Smile makeover · Battersea', 'Your smile', 'begins here.')}</div>
<div class="abs label" style="left:1440px;top:950px;font-size:12px;letter-spacing:.2em">Story 9:16 · Battersea</div>
{foot()}""", 9, 'Applications')


def close():
    return page('dark', f"""
<img class="full" src="assets/photos/delighted-chair.jpg" style="object-position:50% 40%">
<div class="abs" style="inset:0;background:rgba(0,0,0,.55)"></div>
<div class="abs" style="left:0;right:0;top:380px;text-align:center"><div class="serif" style="font-size:140px;color:{WHITE}">Your smile <em>begins here.</em></div>
<div style="display:flex;justify-content:center;margin-top:60px">{logo(WHITE, 320)}</div></div>
{foot(WHITE)}""")


def main():
    pages = [cover(), story(), logo_page(), colour(), typography(), elements(), photography(), voice(), locations(), applications(), close()]
    head = f'<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>Zen House Dental Brand Guidelines</title><style>{CSS}</style>'
    body = f'</head><body>{"".join(pages)}</body></html>'
    (HERE / 'guideline.html').write_text(head + body)
    (HERE / 'guideline-capture.html').write_text(head + '<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>' + body)
    print('pages', len(pages))


if __name__ == '__main__':
    main()
