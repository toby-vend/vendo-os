"""Zen House Dental brand guideline: HTML harness for Figma capture.

Everything is pulled from zenhousedental.co.uk (Oct 2026); there is no brand folder on Drive.
- Palette: the site's Elementor global colours (post-7.css) plus the bronze used for gold text.
- Type: SLTF The Silver Editorial Thin Italic, set lowercase (headlines), Open Sans (body and
  tracked uppercase labels), Mistress Benedict Brush (script accent). Font files in assets/fonts.
- Logo: the site's SVG wordmark (wp-content/uploads/2025/03/Vector-7.svg), recoloured.
- Motifs: wave section edge (Rectangle-7.svg), gold faceted gem bullet, rounded photo cards with a
  thin gold border, pill buttons, gold awards band, wave-line texture.
- Photos: the practice's own photography from the site (assets/photos, gitignored).

Usage: python3 build_guideline.py  ->  guideline.html + guideline-capture.html (Figma capture)
"""
from pathlib import Path

HERE = Path(__file__).parent
A = HERE / 'assets'

LINEN, GOLD, BRONZE, ESPRESSO, GRAPHITE = '#E7E1D9', '#BEA17A', '#9B794B', '#3D3223', '#4B4A45'
BLACK, MIST, WHITE, LILAC = '#000000', '#F4F4F4', '#FFFFFF', '#D0C2D4'


def logo(colour, width):
    s = (A / 'logo-white.svg').read_text().replace('fill="white"', f'fill="{colour}"')
    h = round(width * 44 / 180, 1)
    return s.replace('width="180" height="44"', f'width="{width}" height="{h}" style="display:block"', 1)


def gem(colour=GOLD, size=19):
    s = (A / 'tooth.svg').read_text().replace('#BEA17A', colour)
    return s.replace('width="19" height="21"', f'width="{size}" height="{round(size * 21 / 19)}" style="display:block;flex:none"', 1)


def wave(colour, y, h=200, w=1920):
    """The site's soft wave section edge (Rectangle-7.svg), stretched to width w."""
    vh = round(h * 1300 / w)
    return (f'<svg style="position:absolute;left:0;top:{y}px;display:block" width="{w}" height="{h}" viewBox="0 0 1300 {vh}" '
            f'preserveAspectRatio="none"><path d="M0 20.25C522 -20.25 788 50.64 1300 0V{vh}H0Z" fill="{colour}"/></svg>')


CSS = f"""
@font-face{{font-family:'SLTF The Silver Editorial';src:url('assets/fonts/SLTFTheSilverEditorial-ThinItalic.ttf');font-style:italic;font-weight:100}}
@font-face{{font-family:'SLTF The Silver Editorial';src:url('assets/fonts/SLTFTheSilverEditorial-Thin.ttf');font-style:normal;font-weight:100}}
@font-face{{font-family:'MistressBenedictBrush';src:url('assets/fonts/MistressBenedictBrush.woff')}}
@font-face{{font-family:'Open Sans';src:url('assets/fonts/OpenSans-VariableFont_wdthwght.ttf');font-weight:300 800}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:#2b2b2b;font-family:'Open Sans',sans-serif;color:{BLACK};display:flex;flex-direction:column;gap:120px;padding:120px;width:2160px;-webkit-font-smoothing:antialiased}}
.page{{position:relative;width:1920px;height:1080px;overflow:hidden;background:{LINEN}}}
.dark{{background:{BLACK};color:{WHITE}}} .white{{background:{WHITE}}}
.abs{{position:absolute}}
.serif{{font-family:'SLTF The Silver Editorial',serif;font-style:italic;font-weight:100;text-transform:lowercase;line-height:1.05;letter-spacing:-.01em}}
.script{{font-family:'MistressBenedictBrush',cursive}}
.label{{font-weight:400;font-size:16px;letter-spacing:.24em;text-transform:uppercase}}
.body{{font-size:19px;line-height:1.6}} .body p+p{{margin-top:14px}}
.small{{font-size:15px;line-height:1.55}}
.card{{position:absolute;overflow:hidden;border-radius:16px;border:2px solid {GOLD}}}
.card img,.ph img{{width:100%;height:100%;object-fit:cover;display:block}}
.ph{{position:absolute;overflow:hidden}}
.full{{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}}
.pill{{display:inline-flex;align-items:center;justify-content:center;height:48px;padding:0 44px;border-radius:999px;font-size:14px;font-weight:500;letter-spacing:.08em;text-transform:uppercase}}
.pill.blk{{background:{BLACK};color:{WHITE}}} .pill.lin{{background:{LINEN};color:{BLACK}}} .pill.out{{border:1.5px solid {GOLD};color:{BLACK}}}
.foot{{position:absolute;left:80px;right:80px;bottom:44px;display:flex;justify-content:space-between;font-size:13px;letter-spacing:.24em;text-transform:uppercase}}
.num{{font-size:13px;letter-spacing:.24em;color:{BRONZE}}}
ul.g{{list-style:none}} ul.g li{{display:flex;gap:16px;align-items:flex-start;margin-top:14px}}
ul.g li svg{{margin-top:3px}}
.swatch{{position:absolute;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;padding:26px}}
"""


def page(cls, body, n=None, title=None):
    head = ''
    if title:
        head = f'<div class="abs num" style="left:80px;top:64px">{n:02d}</div><div class="abs label" style="left:130px;top:62px;font-size:13px">{title}</div>'
    return f'<section class="page {cls}">{head}{body}</section>'


def foot(colour=BLACK):
    return f'<div class="foot" style="color:{colour}"><span>zenhousedental.co.uk</span><span>Brand guidelines · 2026</span></div>'


def ph(src, x, y, w, h, pos='50% 50%', card=True, r=16):
    cls = 'card' if card else 'ph'
    return f'<div class="{cls}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;border-radius:{r}px"><img src="assets/photos/{src}" style="object-position:{pos}"></div>'


def cover():
    return page('dark', f"""
<img class="full" src="assets/photos/banstead-aligner-neon.jpg" style="object-position:50% 30%">
<div class="abs" style="inset:0;background:linear-gradient(180deg,rgba(0,0,0,.55),rgba(0,0,0,.35) 45%,rgba(0,0,0,.7))"></div>
<div class="abs" style="left:0;right:0;top:330px;display:flex;flex-direction:column;align-items:center">
  {logo(WHITE, 560)}
  <div class="serif" style="font-size:96px;margin-top:70px;color:{WHITE}">brand guidelines</div>
  <div class="label" style="margin-top:28px;color:{LINEN}">Banstead · Battersea</div>
</div>
{foot(WHITE)}""")


def story():
    return page('', f"""
<div class="abs serif" style="left:80px;top:150px;width:780px;font-size:110px">exceptional dentistry with a family touch</div>
<div class="abs body" style="left:80px;top:560px;width:720px;color:{GRAPHITE}">
<p>Zen House Dental was founded in 2021 by brother and sister Dr Shaimil Patel and Mrs Priya Shah, in the Banstead building that was once their parents' photo framing and printing studio.</p>
<p>In 2026 the brand opened a second practice on Northcote Road, Battersea. Both share one idea: replace dental anxiety with calm, through soft tones, luxury spaces and a personal touch.</p></div>
<div class="abs" style="left:80px;top:860px;display:flex;gap:16px"><span class="pill blk">Book online</span><span class="pill out">Our smiles</span></div>
{ph('team-shaimil.jpg', 960, 150, 420, 560, '50% 20%')}
{ph('team-priya.jpg', 1420, 150, 420, 560, '50% 20%')}
<div class="abs label" style="left:960px;top:740px;font-size:13px">Dr Shaimil Patel</div>
<div class="abs label" style="left:1420px;top:740px;font-size:13px">Mrs Priya Shah</div>
<div class="abs" style="left:960px;top:820px;width:880px">
  <div class="label" style="font-size:13px;color:{BRONZE}">Brand promise</div>
  <div class="serif" style="font-size:54px;margin-top:10px">a luxury dental experience</div></div>
{foot()}""", 1, 'Our story')


def logo_page():
    misuse = [
        ('Stretched', f'<div style="transform:scaleX(1.5)">{logo(BLACK, 220)}</div>'),
        ('Off-palette colour', logo('#2F7DE1', 200)),
        ('Rotated', f'<div style="transform:rotate(-12deg)">{logo(BLACK, 190)}</div>'),
        ('Busy photo, no overlay', f'<div style="position:absolute;inset:0"><img src="assets/photos/consult.jpg" style="width:100%;height:100%;object-fit:cover"><div style="position:absolute;left:31px;top:55px">{logo(GOLD, 200)}</div></div>'),
    ]
    mis = ''.join(f"""<div style="width:262px;height:160px;background:{WHITE};border-radius:16px;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden">{m}
<svg class="abs" style="left:0;top:0" width="262" height="160"><line x1="16" y1="146" x2="246" y2="14" stroke="#C0392B" stroke-width="3"/></svg>
<div class="abs label" style="left:20px;top:16px;font-size:11px;color:#C0392B">{t}</div></div>""" for t, m in misuse)
    return page('', f"""
<div class="abs serif" style="left:80px;top:130px;font-size:96px">the wordmark</div>
<div class="abs body" style="left:80px;top:260px;width:520px;color:{GRAPHITE}"><p>Zen House Dental is a typographic wordmark: ZEN HOUSE in wide capitals over a tracked DENTAL. Always use the master artwork. Never retype it.</p>
<p>Clear space on every side equals the height of the Z. Minimum width is 120px on screen, 30mm in print.</p></div>
<div class="abs" style="left:700px;top:130px;width:1140px;height:430px;background:{WHITE};border-radius:16px;display:flex;align-items:center;justify-content:center">
  <div style="position:relative;padding:60px;outline:none;border:1.5px dashed {GOLD}">{logo(BLACK, 620)}
  <div class="abs label" style="left:6px;top:6px;font-size:11px;color:{BRONZE}">Z</div></div></div>
<div class="abs" style="left:700px;top:590px;width:360px;height:150px;background:{BLACK};border-radius:16px;display:flex;align-items:center;justify-content:center">{logo(WHITE, 260)}</div>
<div class="abs" style="left:1090px;top:590px;width:360px;height:150px;background:{LINEN};border:1.5px solid {GOLD};border-radius:16px;display:flex;align-items:center;justify-content:center">{logo(ESPRESSO, 260)}</div>
<div class="abs" style="left:1480px;top:590px;width:360px;height:150px;background:{ESPRESSO};border-radius:16px;display:flex;align-items:center;justify-content:center">{logo(GOLD, 260)}</div>
<div class="abs label" style="left:700px;top:752px;font-size:11px">White on black or photo</div>
<div class="abs label" style="left:1090px;top:752px;font-size:11px">Espresso on linen</div>
<div class="abs label" style="left:1480px;top:752px;font-size:11px">Gold on espresso</div>
<div class="abs label" style="left:700px;top:800px;font-size:13px;color:{BRONZE}">Misuse</div>
<div class="abs" style="left:700px;top:835px;display:flex;gap:24px">{mis}</div>
{foot()}""", 2, 'Logo')


def colour():
    sw = [
        ('Linen', LINEN, 'Primary canvas', BLACK, 80, 150, 560, 400),
        ('Champagne gold', GOLD, 'Accents, borders, awards band', BLACK, 680, 150, 560, 400),
        ('Black', BLACK, 'Buttons, text, dark sections', WHITE, 1280, 150, 560, 400),
        ('Bronze', BRONZE, 'Gold text on light grounds', WHITE, 80, 590, 340, 280),
        ('Espresso', ESPRESSO, 'Deep warm alternative to black', WHITE, 450, 590, 340, 280),
        ('Graphite', GRAPHITE, 'Body copy', WHITE, 820, 590, 340, 280),
        ('Mist', MIST, 'Alternate light section', BLACK, 1190, 590, 300, 280),
        ('Lilac', LILAC, 'Rare accent, use sparingly', BLACK, 1520, 590, 320, 280),
    ]
    cards = ''.join(f"""<div class="swatch" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;background:{c};color:{t};{'border:1.5px solid ' + GOLD + ';' if c in (LINEN, MIST) else ''}">
<div class="serif" style="font-size:{46 if h > 300 else 36}px">{n}</div><div class="label" style="font-size:12px;margin-top:10px">{c}</div><div class="small" style="margin-top:6px;opacity:.8">{u}</div></div>""" for n, c, u, t, x, y, w, h in sw)
    return page('white', f"""{cards}
<div class="abs small" style="left:80px;top:910px;width:1400px;color:{GRAPHITE}">Ratio guide: roughly 60% linen or white, 25% black, 10% gold, 5% everything else. Champagne gold is for lines, icons and large type only; on linen use bronze for anything under 24px so it stays legible.</div>
{foot()}""", 3, 'Colour')


def typography():
    return page('', f"""
<div class="abs" style="left:80px;top:140px;width:1000px">
  <div class="label" style="font-size:13px;color:{BRONZE}">Headline · SLTF The Silver Editorial Thin Italic · always lowercase</div>
  <div class="serif" style="font-size:150px;margin-top:20px">your smile begins here</div>
</div>
<div class="abs" style="left:80px;top:540px;width:560px">
  <div class="label" style="font-size:13px;color:{BRONZE}">Label · Open Sans Regular · uppercase, +240 tracking</div>
  <div class="label" style="font-size:22px;margin-top:22px">Why choose us?</div>
  <div class="label" style="font-size:13px;color:{BRONZE};margin-top:56px">Body · Open Sans Regular 16 to 20px</div>
  <div class="body" style="margin-top:16px;color:{GRAPHITE}">Our highly skilled cosmetic dentists deliver consistent, outstanding results in a calm and relaxed environment.</div>
</div>
<div class="abs" style="left:720px;top:540px;width:520px">
  <div class="label" style="font-size:13px;color:{BRONZE}">Script accent · Mistress Benedict Brush</div>
  <div class="script" style="font-size:82px;margin-top:10px;color:{BRONZE}">Your Smile Begins Here</div>
  <div class="small" style="margin-top:14px;color:{GRAPHITE}">Echoes the neon in the Banstead practice. One short phrase per layout, never for body copy or prices.</div>
</div>
<div class="abs" style="left:1320px;top:540px;width:520px;background:{WHITE};border-radius:16px;padding:34px;border:1.5px solid {GOLD}">
  <div class="label" style="font-size:12px;color:{BRONZE}">Hierarchy</div>
  <div class="label" style="font-size:14px;margin-top:20px">Award-winning Invisalign providers</div>
  <div class="serif" style="font-size:52px;margin-top:10px">in the trusted hands of a skilled team</div>
  <div class="small" style="margin-top:14px;color:{GRAPHITE}">Label sits above the headline. Body follows. One pill button closes.</div>
  <div style="margin-top:22px"><span class="pill blk">Book online</span></div>
</div>
{foot()}""", 4, 'Typography')


def elements():
    items = ['0% finance plans', '500+ five-star Google reviews', 'Dental phobia certified', 'Top 1% of Invisalign providers in Europe']
    lis = ''.join(f'<li>{gem()}<span class="label" style="font-size:14px;letter-spacing:.12em">{t}</span></li>' for t in items)
    return page('', f"""
<div class="abs" style="left:80px;top:140px;width:540px;height:380px;background:{WHITE};border-radius:16px;padding:40px">
  <div class="label" style="font-size:12px;color:{BRONZE}">Gem bullet</div>
  <div style="display:flex;gap:28px;margin-top:22px;align-items:center">{gem(GOLD, 60)}{gem(BLACK, 60)}<div style="background:#000;padding:10px;border-radius:8px">{gem(WHITE, 40)}</div></div>
  <ul class="g" style="margin-top:26px">{lis}</ul>
</div>
<div class="abs" style="left:660px;top:140px;width:540px;height:380px;border-radius:16px;overflow:hidden;background:{LINEN};border:1.5px solid {GOLD}">
  <img src="assets/photos/battersea-reception.jpg" style="width:100%;height:100%;object-fit:cover;opacity:.9;height:260px">
  {wave(LINEN, 250, 140, 540)}
  <div class="abs label" style="left:30px;top:24px;font-size:12px;color:{WHITE}">Wave edge</div>
  <div class="abs small" style="left:30px;top:316px;width:480px;color:{GRAPHITE}">A soft wave closes every photo section into linen.</div>
</div>
<div class="abs" style="left:1240px;top:140px;width:600px;height:380px;border-radius:16px;overflow:hidden;background:{ESPRESSO}">
  <img src="assets/photos/wave-lines.jpg" style="width:100%;height:100%;object-fit:cover;opacity:.22;mix-blend-mode:screen">
  <div class="abs label" style="left:30px;top:24px;font-size:12px;color:{GOLD}">Wave-line texture</div>
  <div class="abs small" style="left:30px;top:316px;width:540px;color:{LINEN}">Low opacity on dark grounds only. Never behind body copy.</div>
</div>
{ph('mirror-reveal-2.jpg', 80, 560, 300, 380, '45% 50%')}
<div class="abs" style="left:410px;top:560px;width:300px">
  <div class="label" style="font-size:12px;color:{BRONZE}">Photo card</div>
  <div class="small" style="margin-top:12px;color:{GRAPHITE}">16px radius, 2px champagne gold border. Labels sit inside the card in serif lowercase.</div>
  <div class="label" style="font-size:12px;color:{BRONZE};margin-top:40px">Pills</div>
  <div style="display:flex;flex-direction:column;gap:12px;margin-top:14px;align-items:flex-start"><span class="pill blk">Book online</span><span class="pill out">Our fees</span></div>
</div>
<div class="abs" style="left:760px;top:560px;width:1080px;height:200px;background:{GOLD};border-radius:16px;display:flex;align-items:center;justify-content:space-around;color:{WHITE};text-align:center">
  <div><div class="label" style="font-size:12px">Private Dentistry Awards</div><div class="serif" style="font-size:38px;margin-top:8px">practice of the year</div><div class="label" style="font-size:11px;margin-top:6px">Finalist</div></div>
  <div><div class="label" style="font-size:12px">Private Dentistry Awards</div><div class="serif" style="font-size:38px;margin-top:8px">best patient care</div><div class="label" style="font-size:11px;margin-top:6px">Finalist</div></div>
  <div><div class="label" style="font-size:12px">Private Dentistry Awards</div><div class="serif" style="font-size:38px;margin-top:8px">best digital practice</div><div class="label" style="font-size:11px;margin-top:6px">Finalist</div></div>
</div>
<div class="abs small" style="left:760px;top:780px;width:1080px;color:{GRAPHITE}">Awards band: champagne gold, white type. Award names as on the website; all are finalist placings, so always say finalist.</div>
{foot()}""", 5, 'Graphic elements')


def photography():
    return page('white', f"""
<div class="abs serif" style="left:80px;top:130px;font-size:86px;width:520px">real people, real rooms</div>
<div class="abs body" style="left:80px;top:360px;width:500px;color:{GRAPHITE}">
<p>Use the practice's own photography. Warm, bright and natural, with soft daylight and neutral rooms.</p>
<p>Three families of shot: team portraits on white in black scrubs; candid treatment moments (the mirror reveal, the scan, the aligner); and the two practices.</p>
<p>Smile close-ups always carry the ZEN HOUSE watermark and are used only with patient consent.</p></div>
{ph('mirror-reveal.jpg', 640, 130, 380, 380, '50% 40%')}
{ph('aligner-hand.jpg', 1050, 130, 380, 380, '55% 40%')}
{ph('team-woman.jpg', 1460, 130, 380, 380, '50% 15%')}
{ph('itero-scan.jpg', 640, 540, 380, 380, '50% 50%')}
{ph('banstead-waiting.jpg', 1050, 540, 380, 380, '60% 50%')}
{ph('ba-bonding-8.jpg', 1460, 540, 380, 380, '50% 50%')}
<div class="abs" style="left:80px;top:760px;width:500px">
  <div class="label" style="font-size:12px;color:{BRONZE}">Avoid</div>
  <div class="small" style="margin-top:10px;color:{GRAPHITE}">Cold blue clinical stock, masked close-ups of instruments, before-and-afters without consent, and stock that shows another practice's rooms.</div>
</div>
{foot()}""", 6, 'Photography')


def voice():
    pairs = [('Calm', 'We take it at your pace.', 'Don’t panic about your teeth!'),
             ('Personal', 'A family-founded practice that knows you by name.', 'Our dental solutions provider network.'),
             ('Assured', 'Award-winning Invisalign providers.', 'The best dentist in the world, guaranteed.'),
             ('Warm luxury', 'A luxury dental experience.', 'Cheap deals. Hurry, limited spaces!')]
    rows = ''.join(f"""<div style="display:flex;gap:30px;padding:24px 0;border-top:1px solid {GOLD}">
<div class="serif" style="width:250px;font-size:44px">{t.lower()}</div>
<div style="width:520px"><div class="label" style="font-size:11px;color:{BRONZE}">We say</div><div class="body" style="margin-top:6px">{y}</div></div>
<div style="width:520px;opacity:.55"><div class="label" style="font-size:11px">We don’t say</div><div class="body" style="margin-top:6px;text-decoration:line-through">{n}</div></div></div>""" for t, y, n in pairs)
    return page('', f"""
<div class="abs serif" style="left:80px;top:130px;font-size:96px">how we sound</div>
<div class="abs body" style="left:80px;top:260px;width:1200px;color:{GRAPHITE}">Calm, warm and quietly confident. Short sentences. UK English. No em dashes, no hype, no fear. Headlines lowercase and soft; the facts (prices, awards, reviews) do the persuading.</div>
<div class="abs" style="left:80px;top:390px;width:1400px">{rows}</div>
{foot()}""", 7, 'Tone of voice')


def locations():
    return page('dark', f"""
<div class="abs" style="left:0;top:0;width:960px;height:1080px"><img class="full" src="assets/photos/banstead-waiting.jpg" style="object-position:55% 50%"><div class="abs" style="inset:0;background:rgba(0,0,0,.45)"></div></div>
<div class="abs" style="left:960px;top:0;width:960px;height:1080px"><img class="full" src="assets/photos/battersea-reception.jpg" style="object-position:40% 50%"><div class="abs" style="inset:0;background:rgba(0,0,0,.45)"></div></div>
<div class="abs" style="left:0;width:960px;top:400px;text-align:center"><div class="serif" style="font-size:130px;color:{GOLD}">banstead</div><div class="label" style="font-size:16px;margin-top:20px">55 High Street, Banstead, Surrey SM7 2NL</div><div class="small" style="margin-top:30px;opacity:.85">The original practice. Surrey, village high street, families.</div></div>
<div class="abs" style="left:960px;width:960px;top:400px;text-align:center"><div class="serif" style="font-size:130px;color:{GOLD}">battersea</div><div class="label" style="font-size:16px;margin-top:20px">128 Northcote Road, London SW11 6QZ</div><div class="small" style="margin-top:30px;opacity:.85">The London practice, opened 2026. Young professionals, busy diaries.</div></div>
<div class="abs label" style="left:80px;top:62px;font-size:13px;color:{WHITE}"><span style="color:{GOLD}">08</span>&nbsp;&nbsp;&nbsp;Our two practices</div>
<div class="abs small" style="left:0;right:0;bottom:90px;text-align:center;opacity:.8">Location-specific ads name the practice in the label and the CTA, and use that practice's own rooms.</div>
{foot(WHITE)}""")


def ad_1x1(scale):
    s = scale
    return f"""<div style="position:relative;width:{1080 * s}px;height:{1080 * s}px;overflow:hidden;border-radius:6px;background:{LINEN}">
<img src="assets/photos/banstead-aligner-neon.jpg" style="position:absolute;left:0;top:0;width:100%;height:{640 * s}px;object-fit:cover;object-position:50% 25%">
<div style="position:absolute;left:0;top:0;width:100%;height:{640 * s}px;background:linear-gradient(180deg,rgba(0,0,0,.55),rgba(0,0,0,0) 45%)"></div>
{wave(LINEN, 560 * s, 520 * s, 1080 * s)}
<div style="position:absolute;left:{70 * s}px;top:{60 * s}px">{logo(WHITE, 220 * s)}</div>
<div style="position:absolute;left:0;right:0;top:{680 * s}px;text-align:center">
  <div class="label" style="font-size:{22 * s}px">Invisalign in Banstead</div>
  <div class="serif" style="font-size:{92 * s}px;margin-top:{14 * s}px">straighter, without the brackets</div>
  <div style="margin-top:{36 * s}px"><span class="pill blk" style="height:{70 * s}px;font-size:{20 * s}px;padding:0 {60 * s}px">Book a free consultation</span></div>
</div></div>"""


def ad_9x16(scale):
    s = scale
    return f"""<div style="position:relative;width:{1080 * s}px;height:{1920 * s}px;overflow:hidden;border-radius:6px;background:{BLACK}">
<img src="assets/photos/battersea-reception.jpg" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:45% 50%">
<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.25),rgba(0,0,0,.15) 40%,rgba(0,0,0,.75))"></div>
<div style="position:absolute;left:0;right:0;top:{270 * s}px;display:flex;justify-content:center">{logo(WHITE, 300 * s)}</div>
<div style="position:absolute;left:0;right:0;top:{1060 * s}px;text-align:center;color:{WHITE}">
  <div class="label" style="font-size:{24 * s}px">Northcote Road, Battersea</div>
  <div class="serif" style="font-size:{110 * s}px;margin-top:{16 * s}px;color:{LINEN}">your smile begins here</div>
  <div style="margin-top:{40 * s}px"><span class="pill lin" style="height:{76 * s}px;font-size:{22 * s}px;padding:0 {64 * s}px">Book online</span></div>
</div></div>"""


def applications():
    return page('', f"""
<div class="abs serif" style="left:80px;top:130px;font-size:96px;width:600px">in use</div>
<div class="abs body" style="left:80px;top:260px;width:560px;color:{GRAPHITE}"><p>Meta statics follow the site: practice photography up top, a wave into linen, a tracked label naming the treatment and the place, a lowercase serif headline and a single pill.</p>
<p>Story formats keep the logo and copy out of the top 250px and bottom 340px.</p></div>
<div class="abs" style="left:700px;top:150px;border:1.5px solid {GOLD};border-radius:8px">{ad_1x1(0.68)}</div>
<div class="abs label" style="left:700px;top:900px;font-size:12px">Feed 1:1 · Banstead</div>
<div class="abs" style="left:1440px;top:110px">{ad_9x16(0.43)}</div>
<div class="abs label" style="left:1440px;top:950px;font-size:12px">Story 9:16 · Battersea</div>
{foot()}""", 9, 'Applications')


def close():
    return page('dark', f"""
<img class="full" src="assets/photos/delighted-chair.jpg" style="object-position:50% 40%">
<div class="abs" style="inset:0;background:rgba(0,0,0,.55)"></div>
<div class="abs" style="left:0;right:0;top:380px;text-align:center"><div class="serif" style="font-size:150px;color:{LINEN}">your smile begins here</div>
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
