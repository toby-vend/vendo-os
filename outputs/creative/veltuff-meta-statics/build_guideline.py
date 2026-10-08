"""Veltuff UK brand guideline: HTML harness for Figma capture.

No brand kit exists on Drive (checked 8 Oct 2026), so this is built from veltuff.co.uk:
  - Type: Saira (headings, theme --heading-font-family, 700 caps) + Titillium Web (body, buttons).
  - Colour: logo lime #A8D500 (sampled from the official wordmark PNG), signal lime #D2F000
    (site header and footer accents), black, graphite #212121 (header bar), charcoal #222021 (footer).
  - Motifs from the site's sale banners: torn lime paper, scuffed black, outlined word pattern,
    tapered white slash rules, heavy italic display caps.
The May 2026 design brief lists "brand green #6AAB3D"; it matches neither the logo nor the site and is not used.
Photos are Veltuff's own site and product images (assets/photos, gitignored).
Textures come from make_assets.py.

Usage: python3 build_guideline.py  ->  guideline.html and guideline-capture.html (Figma capture script)
"""
from pathlib import Path

HERE = Path(__file__).parent

LIME, SIGNAL, BLACK, INK, GRAPHITE, CHARCOAL, CONCRETE, STEEL, WHITE = (
    '#A8D500', '#D2F000', '#000000', '#0B0B0B', '#212121', '#222021', '#ECEAEA', '#6E6E6E', '#FFFFFF')

CSS = f"""
@font-face{{font-family:'Saira';src:url('assets/fonts/Saira[wdth,wght].ttf') format('truetype');font-weight:100 900;font-style:normal}}
@font-face{{font-family:'Saira';src:url('assets/fonts/Saira-Italic[wdth,wght].ttf') format('truetype');font-weight:100 900;font-style:italic}}
@font-face{{font-family:'Titillium Web';src:url('assets/fonts/TitilliumWeb-Regular.ttf');font-weight:400}}
@font-face{{font-family:'Titillium Web';src:url('assets/fonts/TitilliumWeb-SemiBold.ttf');font-weight:600}}
@font-face{{font-family:'Titillium Web';src:url('assets/fonts/TitilliumWeb-Bold.ttf');font-weight:700}}
@font-face{{font-family:'Titillium Web';src:url('assets/fonts/TitilliumWeb-Black.ttf');font-weight:900}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:#3a3a3a;font-family:'Titillium Web',sans-serif;color:{WHITE};display:flex;flex-direction:column;gap:120px;padding:120px;width:2160px;-webkit-font-smoothing:antialiased}}
.page{{position:relative;width:1920px;height:1080px;overflow:hidden;background:{INK};color:{WHITE}}}
.light{{background:{CONCRETE};color:{INK}}}
.abs{{position:absolute}}
.fill{{position:absolute;left:0;top:0;width:100%;height:100%}}
.h{{font-family:'Saira',sans-serif;font-weight:700;text-transform:uppercase;line-height:.95;letter-spacing:.005em}}
.promo{{font-family:'Saira',sans-serif;font-style:italic;font-weight:900;text-transform:uppercase;line-height:.88;letter-spacing:-.01em}}
.body{{font-size:21px;line-height:1.55;font-weight:400}}
.body p+p{{margin-top:14px}}
.body b{{font-weight:700}}
.label{{font-family:'Titillium Web',sans-serif;font-weight:700;font-size:14px;letter-spacing:.22em;text-transform:uppercase;color:{STEEL}}}
.num{{font-family:'Saira',sans-serif;font-weight:700;font-size:18px;letter-spacing:.2em;color:{SIGNAL}}}
.btn{{display:inline-flex;align-items:center;justify-content:center;height:58px;padding:0 34px;font-family:'Titillium Web',sans-serif;font-weight:700;font-size:17px;letter-spacing:.1em;text-transform:uppercase;background:{LIME};color:{BLACK}}}
.btn.dark{{background:{BLACK};color:{SIGNAL}}}
.chip{{display:inline-flex;align-items:center;gap:12px;height:46px;padding:0 18px 0 8px;border:2px solid rgba(210,240,0,.55);font-family:'Titillium Web',sans-serif;font-weight:700;font-size:15px;letter-spacing:.08em;text-transform:uppercase;color:{WHITE}}}
.chip i{{display:block;width:30px;height:30px;background:{LIME};position:relative}}
.chip i:after{{content:'';position:absolute;left:10px;top:5px;width:8px;height:15px;border:solid {BLACK};border-width:0 3px 3px 0;transform:rotate(45deg)}}
.rule{{height:2px;background:rgba(255,255,255,.14)}}
.slash{{display:block;height:8px;background:{WHITE};transform:skewX(-30deg)}}
"""


def page(cls, body, texture=True):
    tex = ('<img class="fill" src="assets/dust.png" style="opacity:.55;object-fit:cover">'
           '<img class="fill" src="assets/grain.png" style="opacity:.07;mix-blend-mode:overlay;object-fit:cover">') if texture else ''
    return f'<section class="page {cls}">{tex}{body}</section>'


def img(src, x, y, w, h, pos='50% 50%', extra=''):
    return (f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;overflow:hidden;{extra}">'
            f'<img src="assets/photos/{src}" style="width:100%;height:100%;object-fit:cover;object-position:{pos};display:block"></div>')


def logo(colour, w, x=None, y=None, extra=''):
    pos = f'left:{x}px;top:{y}px;' if x is not None else ''
    cls = 'abs' if x is not None else ''
    return f'<img class="{cls}" src="assets/logo-{colour}.png" style="{pos}width:{w}px;height:auto;display:block;{extra}">'


def roundel(colour, size, bg='transparent'):
    """V roundel (site favicon): ring + V cut from the official wordmark."""
    ring = max(3, round(size * .075))
    v = round(size * .46)
    return (f'<div style="width:{size}px;height:{size}px;border-radius:50%;border:{ring}px solid {colour};background:{bg};'
            f'display:flex;align-items:center;justify-content:center"><img src="assets/v-{"lime" if colour == LIME else "white" if colour == WHITE else "black"}.png" '
            f'style="width:{v}px;height:auto;display:block"></div>')


def tear(x, y, w, angle=0, flip=False):
    src = 'tear-bottom' if flip else 'tear-top'
    return f'<img class="abs" src="assets/{src}.png" style="left:{x}px;top:{y}px;width:{w}px;height:auto;transform:rotate({angle}deg);transform-origin:50% 50%">'


def slash_title(word, size, colour=WHITE, bar=170):
    return (f'<div style="display:flex;align-items:center;gap:22px">'
            f'<span class="slash" style="width:{bar}px;background:{colour}"></span>'
            f'<span class="promo" style="font-size:{size}px;color:{colour}">{word}</span>'
            f'<span class="slash" style="width:{bar}px;background:{colour}"></span></div>')


def pattern(name, x, y, w, opacity=.7):
    """Outlined word wall from the sale banners (baked by make_patterns.py)."""
    return f'<img class="abs" src="assets/pattern-{name}.png" style="left:{x}px;top:{y}px;width:{w}px;height:auto;opacity:{opacity}">'


def cover():
    return page('', f"""
{img('site-Untitled_design_6.jpg', 960, 0, 960, 1080, '42% 50%')}
<div class="abs" style="left:960px;top:0;width:420px;height:1080px;background:linear-gradient(90deg,{INK},rgba(11,11,11,0))"></div>
{tear(-260, -60, 2400, -3.5)}
{logo('black', 520, 120, 70)}
<div class="abs" style="left:120px;top:430px">
  <div class="label" style="color:{SIGNAL}">Brand guidelines · UK · 2026</div>
  <div class="promo" style="font-size:150px;margin-top:22px">Real<br><span style="color:{SIGNAL}">workwear</span></div>
  <div class="body" style="margin-top:34px;width:640px;color:rgba(255,255,255,.75)">Work clothing, hi-vis, safety footwear and PPE, built to do the job. How the Veltuff brand looks and sounds on social, the web and in ads.</div>
</div>
<div class="abs label" style="left:120px;bottom:56px">veltuff.co.uk</div>
""")


def about():
    partners = ''.join(f'<img src="assets/partners/{p}-white.png" style="height:{h}px;width:auto;opacity:.85;display:block">'
                       for p, h in [('dsv', 46), ('amazon', 44), ('gls', 48), ('swissport', 34), ('dfds', 40)])
    return page('', f"""
<div class="abs num" style="left:120px;top:120px">00 · The brand</div>
<div class="abs h" style="left:116px;top:170px;font-size:92px;width:880px">25 years of<br>real workwear</div>
<div class="abs body" style="left:120px;top:400px;width:760px;color:rgba(255,255,255,.82)">
  <p>For 25 years VELTUFF® has combined safety with style, giving people workwear that is truly up to the task.</p>
  <p>The range covers <b>work clothing, hi-vis, safety footwear and PPE</b>, each designed for protection, durability and comfort, whether you work in a warehouse, drive a commercial vehicle or maintain the railways.</p>
  <p>Premium quality at an honest price. Direct, no-nonsense, built for UK trades and the teams that kit them out.</p>
</div>
<div class="abs label" style="left:120px;top:850px">Proud manufacturers for</div>
<div class="abs" style="left:120px;top:900px;display:flex;gap:56px;align-items:center">{partners}</div>
{img('site-Veltuff_Square_23.png', 1080, 120, 720, 840, '50% 50%')}
<div class="abs" style="left:1080px;top:960px;width:720px;height:8px;background:{LIME}"></div>
""")


def logo_page():
    misuse = [("Don't recolour", 'filter:hue-rotate(150deg)'), ("Don't skew or rotate", 'transform:rotate(-10deg)'),
              ("Don't stretch", 'transform:scaleX(1.45)'), ("Don't outline or shadow", 'filter:drop-shadow(6px 6px 0 #D2F000)')]
    tiles = ''.join(f"""<div style="width:250px">
  <div style="height:130px;background:{GRAPHITE};display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden">
    <div style="{css}">{logo('lime', 170)}</div>
    <div style="position:absolute;left:-30px;right:-30px;top:50%;height:3px;background:#FF3B30;transform:rotate(-27deg)"></div>
  </div><div class="label" style="margin-top:12px;font-size:12px">{t}</div></div>""" for t, css in misuse)

    def tile(inner, w, h, bg, cap, extra=''):
        return f"""<div><div style="width:{w}px;height:{h}px;background:{bg};{extra}display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden">{inner}</div>
<div class="label" style="margin-top:12px;font-size:12px">{cap}</div></div>"""
    photo_tile = (f'<img src="assets/photos/site-Untitled_design_6.jpg" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 40%">'
                  f'<div style="position:absolute;inset:0;background:rgba(0,0,0,.45)"></div><div style="position:relative">{logo("white", 300)}</div>')
    return page('', f"""
<div class="abs num" style="left:120px;top:120px">01</div>
<div class="abs h" style="left:116px;top:160px;font-size:120px">Logo</div>
<div class="abs body" style="left:120px;top:330px;width:520px;color:rgba(255,255,255,.8)">
  <p>The <b>VELTUFF</b> wordmark is cut from heavy square letterforms with chamfered corners. Lime on black is the primary version.</p>
  <p>On lime use black. On photography use white or lime over a darkened area. The <b>V roundel</b> is for avatars, favicons and small placements.</p>
  <p>Clear space on every side equals the width of the V. Minimum width 120px on screen.</p>
  <p style="color:{STEEL};font-size:16px">Supplied as PNG from the website. Ask Veltuff for vector (SVG/AI) master files and the roundel artwork.</p>
</div>
<div class="abs" style="left:720px;top:110px;display:flex;gap:24px">
  {tile(logo('lime', 520), 640, 270, BLACK, 'Primary · lime on black')}
  {tile(logo('black', 360), 440, 270, LIME, 'On lime · black')}
</div>
<div class="abs" style="left:720px;top:440px;display:flex;gap:24px">
  {tile(photo_tile, 460, 250, BLACK, 'On photography · white')}
  {tile(roundel(LIME, 150), 250, 250, GRAPHITE, 'V roundel')}
  {tile(f'<div style="padding:0 64px;border:1px dashed rgba(210,240,0,.6);height:150px;display:flex;align-items:center">{logo("lime", 240)}</div>', 330, 250, 'transparent', 'Clear space = width of V', 'border:1px solid rgba(255,255,255,.12);')}
</div>
<div class="abs" style="left:720px;top:790px;display:flex;gap:20px">{tiles}</div>
""")


def colour():
    sw = [('Veltuff Lime', LIME, 'Logo, CTA buttons, price badges, torn paper.', ''),
          ('Signal Lime', SIGNAL, 'Highlight words and accents on black.', ''),
          ('Black', BLACK, 'Main canvas. Every ad starts here.', 'border:1px solid rgba(255,255,255,.18);'),
          ('Graphite', GRAPHITE, 'Panels, cards, header bars.', 'border:1px solid rgba(255,255,255,.18);'),
          ('Charcoal', CHARCOAL, 'Footer and secondary panels.', 'border:1px solid rgba(255,255,255,.18);'),
          ('Concrete', CONCRETE, 'Light panels and studio backdrops.', ''),
          ('Steel', STEEL, 'Labels, small print, RRP strikethroughs.', ''),
          ('White', WHITE, 'Headlines and body on black.', '')]
    cards = ''.join(f"""<div style="width:370px">
  <div style="height:190px;background:{hx};{extra}"></div>
  <div class="h" style="font-size:30px;margin-top:16px">{n}</div>
  <div class="label" style="margin-top:6px;font-size:13px;color:rgba(255,255,255,.55)">HEX {hx}</div>
  <div class="body" style="font-size:16px;margin-top:4px;color:rgba(255,255,255,.7)">{r}</div></div>""" for n, hx, r, extra in sw)
    return page('', f"""
<div class="abs num" style="left:120px;top:110px">02</div>
<div class="abs h" style="left:116px;top:150px;font-size:120px">Colour</div>
<div class="abs body" style="left:760px;top:170px;width:1040px;color:rgba(255,255,255,.75)">Black and lime, like the kit itself: dark, tough, high-visibility. Black carries most of every layout and lime is used sparingly so it hits hard. Hi-vis yellow, orange and navy come from the products in the photography, never from flat panels.</div>
<div class="abs" style="left:120px;top:340px;width:1680px;display:flex;flex-wrap:wrap;gap:44px 66px">{cards}</div>
""")


def typography():
    return page('', f"""
<div class="abs num" style="left:120px;top:110px">03</div>
<div class="abs h" style="left:116px;top:150px;font-size:120px">Typography</div>
<div class="abs" style="left:120px;top:330px;width:780px">
  <div class="h" style="font-size:280px;line-height:.9;color:{SIGNAL};text-transform:none">Aa</div>
  <div class="h" style="font-size:36px;margin-top:18px">Saira</div>
  <div class="body" style="margin-top:8px;color:rgba(255,255,255,.72)">Headings, prices and promo display. Always uppercase. Bold for headings; ExtraBold–Black Italic for sale and event lockups.</div>
  <div class="h" style="margin-top:26px;font-size:30px;line-height:1.35;color:rgba(255,255,255,.9)">ABCDEFGHIJKLMNOPQRSTUVWXYZ<br>0123456789 £ % ®</div>
  <div class="body" style="margin-top:30px;font-size:20px"><b style="font-size:24px">Titillium Web</b><br><span style="color:rgba(255,255,255,.72)">Body copy, specs, labels and buttons. Regular for reading, Bold caps for buttons and labels.</span></div>
</div>
<div class="abs" style="left:1000px;top:0;width:920px;height:1080px;background:{GRAPHITE};padding:110px 90px">
  <div class="label">Promo display · Saira Black Italic · 120–200px</div>
  <div class="promo" style="font-size:118px;margin-top:14px;color:{SIGNAL}">Price drop</div>
  <div class="label" style="margin-top:46px">Heading · Saira Bold caps · 48–96px</div>
  <div class="h" style="font-size:62px;margin-top:12px">Our collection of workwear</div>
  <div class="label" style="margin-top:46px">Body · Titillium Web Regular · 18–22px · 155%</div>
  <div class="body" style="margin-top:10px;color:rgba(255,255,255,.85)">Our range of high quality workwear includes work clothing, hi-vis garments, safety footwear and PPE.</div>
  <div class="label" style="margin-top:46px">Button and label · Titillium Web Bold caps · +10%</div>
  <div style="margin-top:16px;display:flex;gap:18px;align-items:center"><span class="btn">Shop now</span><span class="btn dark" style="border:2px solid {SIGNAL}">Shop the deals</span></div>
</div>
""")


def elements():
    return page('', f"""
<div class="abs num" style="left:120px;top:110px">04</div>
<div class="abs h" style="left:116px;top:150px;font-size:120px">Graphic elements</div>
<div class="abs" style="left:120px;top:340px;width:820px;height:300px;background:{BLACK};overflow:hidden">
  <img src="assets/dust.png" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.6">
  {tear(-160, -40, 1200, -4)}
  <div class="abs promo" style="left:60px;top:180px;font-size:84px;color:{SIGNAL}">Torn lime</div>
</div>
<div class="abs label" style="left:120px;top:660px">Torn paper over scuffed black · the sale banner signature</div>
<div class="abs" style="left:1000px;top:340px;width:800px;height:300px;background:{BLACK};overflow:hidden">
  {pattern('sale', -40, -30, 1100, .8)}
  <div class="abs" style="left:0;right:0;top:110px;display:flex;justify-content:center">{slash_title('Event', 76, WHITE, 150)}</div>
</div>
<div class="abs label" style="left:1000px;top:660px">Outlined word wall + slash rule lockup</div>
<div class="abs" style="left:120px;top:730px;display:flex;flex-direction:column;gap:14px">
  <span class="chip"><i></i>Knee pad pouches</span><span class="chip"><i></i>Bi-stretch gusset</span><span class="chip"><i></i>Class 2 certified</span>
</div>
<div class="abs label" style="left:120px;top:930px">Feature chips · tick + spec, stacked</div>
<div class="abs" style="left:560px;top:730px;background:{GRAPHITE};padding:22px 30px;border-left:8px solid {LIME}">
  <div class="label" style="color:{STEEL}">From</div>
  <div class="h" style="font-size:88px;color:{SIGNAL};line-height:1">£37.50</div>
  <div class="body" style="font-size:20px;color:{STEEL};text-decoration:line-through">RRP £45.00</div>
</div>
<div class="abs label" style="left:560px;top:930px">Price badge · example only</div>
<div class="abs" style="left:1000px;top:740px;display:flex;flex-direction:column;gap:20px">
  <span class="btn" style="width:380px">Shop hi-vis trousers</span><span class="btn dark" style="width:380px;border:2px solid {SIGNAL}">Shop the deals</span>
</div>
<div class="abs label" style="left:1000px;top:930px">Buttons · square, never rounded</div>
<div class="abs" style="left:1480px;top:720px">{roundel(LIME, 170, BLACK)}</div>
<div class="abs label" style="left:1480px;top:930px">Roundel stamp</div>
""")


def photography():
    return page('', f"""
<div class="abs num" style="left:120px;top:110px">05</div>
<div class="abs h" style="left:116px;top:150px;font-size:120px">Photography</div>
<div class="abs body" style="left:120px;top:330px;width:560px;color:rgba(255,255,255,.82)">
  <p><b style="color:{SIGNAL}">On site.</b> Real jobs, real dirt: groundworks, depots, rail and logistics. Overcast daylight, kit doing its job.</p>
  <p><b style="color:{SIGNAL}">Studio.</b> The product range on the model against light grey. Use for DPA, feature callouts and price ads.</p>
  <p><b style="color:{SIGNAL}">Detail.</b> Macro of fabric, tape, stitching and logo tabs. Proof of build quality without copy.</p>
  <p style="margin-top:26px;color:{STEEL}">Never: AI versions of products, smiling stock workers, clean offices, or products shown in a colourway that doesn't exist.</p>
</div>
{img('site-Untitled_design_6.jpg', 960, 330, 540, 370, '50% 45%')}
{img('site-Veltuff_Square_23.png', 1520, 330, 280, 370, '55% 50%')}
{img('HV8108_1.jpg', 960, 720, 200, 250, '50% 25%')}
{img('TR8825_2.jpg', 1180, 720, 200, 250, '50% 40%')}
{img('2.jpg', 1400, 720, 190, 250, '50% 50%')}
{img('HV8108_CU_1.jpg', 1610, 720, 190, 250, '50% 50%')}
<div class="abs label" style="left:960px;top:296px">On site</div>
<div class="abs label" style="left:960px;top:990px">Studio</div>
<div class="abs label" style="left:1400px;top:990px">Detail</div>
""")


def voice():
    return page('', f"""
<div class="abs num" style="left:120px;top:110px">06</div>
<div class="abs h" style="left:116px;top:150px;font-size:120px">Tone of voice</div>
<div class="abs" style="left:120px;top:360px;width:560px">
  <div class="h" style="font-size:34px;color:{SIGNAL}">We sound</div>
  <div class="body" style="margin-top:14px;color:rgba(255,255,255,.88)">
    <p><b>Direct.</b> Short lines, full stops, no waffle.</p>
    <p><b>Specific.</b> Name the product and the spec: Class 2, 220gsm, knee pad pouches.</p>
    <p><b>Honest.</b> Real prices, real RRPs, real savings.</p>
    <p><b>On the tools.</b> Talk like the site, not the boardroom.</p>
  </div>
</div>
<div class="abs" style="left:760px;top:360px;width:440px">
  <div class="h" style="font-size:34px;color:{SIGNAL}">We never</div>
  <div class="body" style="margin-top:14px;color:rgba(255,255,255,.88)">
    <p>Use emojis</p><p>Say "workwear" when we can name the product</p><p>Invent urgency or fake countdowns</p><p>Sound like a lifestyle brand</p>
  </div>
</div>
<div class="abs" style="left:1300px;top:0;width:620px;height:1080px;background:{LIME};color:{BLACK};padding:300px 70px 0">
  <img src="assets/lime-tex.png" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">
  <div class="promo" style="position:relative;font-size:86px">Real<br>workwear.<br>Honest<br>price.</div>
  <div class="label" style="position:relative;margin-top:36px;color:{BLACK}">The line everything ladders up to</div>
</div>
""")


def applications():
    feed = f"""
<div class="abs" style="left:120px;top:250px;width:680px;height:680px;background:{BLACK};overflow:hidden">
  <img src="assets/dust.png" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.55">
  {img('HV5310_1.jpg', 300, 120, 380, 560, '50% 20%', 'mix-blend-mode:normal')}
  <div class="abs" style="left:300px;top:120px;width:120px;height:560px;background:linear-gradient(90deg,#000,rgba(0,0,0,0))"></div>
  {logo('lime', 190, 36, 36)}
  <div class="abs h" style="left:36px;top:150px;font-size:58px;width:340px">Seen on every site</div>
  <div class="abs" style="left:36px;top:330px;display:flex;flex-direction:column;gap:10px;transform:scale(.82);transform-origin:0 0">
    <span class="chip"><i></i>Hi-vis body warmer</span><span class="chip"><i></i>Orange or yellow</span>
  </div>
  <span class="abs btn" style="left:36px;bottom:36px;height:50px;font-size:14px">Shop hi-vis</span>
</div>
<div class="abs label" style="left:120px;top:952px">Meta feed · 1:1 · product</div>"""
    story = f"""
<div class="abs" style="left:850px;top:250px;width:383px;height:680px;background:{BLACK};overflow:hidden">
  <img src="assets/dust.png" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.55">
  {pattern('sale', -60, 0, 1300, .45)}
  {tear(-300, -20, 1000)}
  {logo('black', 150, 30, 30)}
  <div class="abs" style="left:0;right:0;top:230px;text-align:center">
    <div class="promo" style="font-size:78px;color:{SIGNAL}">Price<br>drop</div>
    <div style="display:flex;justify-content:center;margin-top:8px">{slash_title('Event', 44, WHITE, 60)}</div>
    <div class="h" style="font-size:20px;margin-top:22px;letter-spacing:.04em">Save <span style="color:{SIGNAL}">more</span> on selected workwear</div>
  </div>
  {tear(-120, 520, 700, -6, True)}
  <span class="abs btn" style="left:85px;bottom:120px;height:46px;font-size:13px;width:213px">Shop the deals</span>
</div>
<div class="abs label" style="left:850px;top:952px">Meta story · 9:16 · offer</div>"""
    card = f"""
<div class="abs" style="left:1283px;top:250px;width:517px;height:680px;background:{CONCRETE};overflow:hidden">
  {img('TR8825_2.jpg', 0, 0, 517, 680, '50% 40%')}
  <div class="abs" style="left:0;right:0;bottom:0;height:190px;background:{BLACK};padding:28px 32px">
    {logo('lime', 150)}
    <div class="h" style="font-size:34px;margin-top:16px">Stretch multi-pocket trousers</div>
  </div>
  <div class="abs" style="right:24px;top:24px">{roundel(LIME, 92, BLACK)}</div>
</div>
<div class="abs label" style="left:1283px;top:952px">Catalogue / DPA frame</div>"""
    return page('', f"""
<div class="abs num" style="left:120px;top:90px">07</div>
<div class="abs h" style="left:116px;top:130px;font-size:100px">In use</div>
{feed}{story}{card}
""")


def close():
    return page('', f"""
{tear(-200, -170, 2400, -3)}
<div class="abs" style="left:0;right:0;top:460px;display:flex;justify-content:center">{logo('lime', 760)}</div>
<div class="abs promo" style="left:0;right:0;top:640px;text-align:center;font-size:64px">Real workwear</div>
<div class="abs label" style="left:120px;bottom:56px">veltuff.co.uk</div>
""")


def main():
    pages = [cover(), about(), logo_page(), colour(), typography(), elements(), photography(), voice(), applications(), close()]
    head = f'<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>Veltuff Brand Guidelines</title><style>{CSS}</style>'
    body = f'</head><body>{"".join(pages)}</body></html>'
    (HERE / 'guideline.html').write_text(head + body)
    (HERE / 'guideline-capture.html').write_text(head + '<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>' + body)
    print('pages', len(pages))


if __name__ == '__main__':
    main()
