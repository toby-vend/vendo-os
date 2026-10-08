"""Veltuff UK Black Friday statics: HTML harness for render QA and Figma capture.

Brand: Veltuff guideline (Figma aHWliZbwJcLPtVS1PWzulV) + the look of Veltuff's draft Black November banner, renamed Black Friday (Toby, 8 Oct)
(assets/src/black-november-ref.png). Copy and facts: copy-suite.md, offers.md. Prices are Stuart's 2 Oct list.
Assets: make_assets.py (logos, textures, tears), make_cutouts.py (product mattes), make_lockups.py (lockup, badge, chevrons).

Usage: python3 build.py  ->  suite-1x1.html, suite-9x16.html, carousel.html, dpa.html (+ *-capture.html for Figma)
"""
from pathlib import Path

HERE = Path(__file__).parent
LIME, SIG, BLACK, INK, GRAPHITE, CONCRETE, STEEL, WHITE = '#A8D500', '#D2F000', '#000000', '#0B0B0B', '#212121', '#ECEAEA', '#8A8A8A', '#FFFFFF'

CSS = f"""
@font-face{{font-family:'Saira';src:url('assets/fonts/Saira[wdth,wght].ttf') format('truetype');font-weight:100 900;font-stretch:50% 125%;font-style:normal}}
@font-face{{font-family:'Saira';src:url('assets/fonts/Saira-Italic[wdth,wght].ttf') format('truetype');font-weight:100 900;font-stretch:50% 125%;font-style:italic}}
@font-face{{font-family:'Titillium Web';src:url('assets/fonts/TitilliumWeb-Regular.ttf');font-weight:400}}
@font-face{{font-family:'Titillium Web';src:url('assets/fonts/TitilliumWeb-SemiBold.ttf');font-weight:600}}
@font-face{{font-family:'Titillium Web';src:url('assets/fonts/TitilliumWeb-Bold.ttf');font-weight:700}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:#2a2a2a;font-family:'Titillium Web',sans-serif;display:flex;gap:80px;padding:80px;align-items:flex-start;-webkit-font-smoothing:antialiased}}
.ab{{position:relative;overflow:hidden;flex:none;background:{INK};color:{WHITE}}}
.s1{{width:1080px;height:1080px}} .s9{{width:1080px;height:1920px}}
.abs{{position:absolute}} .fill{{position:absolute;left:0;top:0;width:100%;height:100%}}
.h{{font-family:'Saira',sans-serif;font-weight:800;text-transform:uppercase;line-height:.92;letter-spacing:.005em}}
.wide{{font-family:'Saira',sans-serif;font-stretch:125%;font-weight:800;text-transform:uppercase;line-height:.9}}
.promo{{font-family:'Saira',sans-serif;font-style:italic;font-weight:900;text-transform:uppercase;line-height:.88}}
.body{{font-size:30px;line-height:1.35}}
.lbl{{font-weight:700;font-size:22px;letter-spacing:.18em;text-transform:uppercase}}
.btn{{display:inline-flex;align-items:center;justify-content:center;height:84px;padding:0 46px;background:{SIG};color:{BLACK};font-weight:700;font-size:28px;letter-spacing:.1em;text-transform:uppercase}}
.chip{{display:flex;align-items:center;gap:14px;height:58px;padding:0 22px 0 10px;border:2px solid rgba(210,240,0,.55);background:rgba(0,0,0,.55);font-weight:700;font-size:21px;letter-spacing:.07em;text-transform:uppercase;color:{WHITE};white-space:nowrap}}
.chip i{{display:block;flex:none;width:38px;height:38px;background:{LIME};position:relative}}
.chip i:after{{content:'';position:absolute;left:13px;top:6px;width:10px;height:19px;border:solid {BLACK};border-width:0 4px 4px 0;transform:rotate(45deg)}}
.strike{{position:relative;display:inline-block}}
.strike:after{{content:'';position:absolute;left:-4px;right:-4px;top:52%;height:3px;background:currentColor}}
.ph{{border:3px dashed {SIG};padding:0 10px;color:{SIG}}}
"""

CAPTURE = '<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>'


# ---------- building blocks ----------

def canvas(size, tone='chevron'):
    bg = f'assets/chevron-{"1x1" if size == "s1" else "9x16"}.png'
    return (f'<img class="fill" src="{bg}" style="object-fit:cover">'
            '<img class="fill" src="assets/dust.png" style="object-fit:cover;opacity:.28">')


def grain():
    return '<img class="fill" src="assets/grain.jpg" style="object-fit:cover;opacity:.06;mix-blend-mode:overlay">'


def logo(colour, w, x, y):
    return f'<img class="abs" src="assets/logo-{colour}.png" style="left:{x}px;top:{y}px;width:{w}px;height:auto">'


def lockup(w, x, y):
    return f'<img class="abs" src="assets/bf-lockup.png" style="left:{x}px;top:{y}px;width:{w}px;height:auto">'


def badge(w, x, y):
    return f'<img class="abs" src="assets/bn-badge.png" style="left:{x}px;top:{y}px;width:{w}px;height:{w}px">'


def product(name, cx, base, h, glow=SIG, lit=True):
    """Cut-out stood on an implied floor: back glow, floor pool, contact shadow, lit matte."""
    src = f'assets/cutouts/{name}{"-lit" if lit else ""}.png'
    gw = h * 0.95
    return (f'<div class="abs" style="left:{cx - gw / 2}px;top:{base - h * .85}px;width:{gw}px;height:{h * .8}px;border-radius:50%;'
            f'background:radial-gradient(closest-side,rgba(210,240,0,.20),rgba(210,240,0,.06) 60%,rgba(210,240,0,0))"></div>'
            f'<div class="abs" style="left:{cx - h * .32}px;top:{base - 22}px;width:{h * .64}px;height:44px;border-radius:50%;'
            f'background:radial-gradient(closest-side,rgba(0,0,0,.85),rgba(0,0,0,0))"></div>'
            f'<img class="abs" src="{src}" style="left:{cx}px;top:{base}px;height:{h}px;width:auto;transform:translate(-50%,-100%)">')


def photo(src, x, y, w, h, pos='50% 50%', extra=''):
    return (f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;overflow:hidden;{extra}">'
            f'<img src="assets/photos/{src}" style="width:100%;height:100%;object-fit:cover;object-position:{pos};display:block"></div>')


def price(now, was, x, y, size=120, align='left', label='Black Friday price'):
    was_html = f'<div style="font-size:{size * .26}px;font-weight:600;color:{STEEL};margin-top:6px">RRP <span class="strike">{was}</span></div>' if was else ''
    return (f'<div class="abs" style="left:{x}px;top:{y}px;text-align:{align}">'
            f'<div class="lbl" style="font-size:{max(16, size * .15)}px;color:{SIG}">{label}</div>'
            f'<div class="h" style="font-size:{size}px;color:{WHITE};margin-top:6px">{now}</div>{was_html}</div>')


def chips(items, x, y, gap=14):
    inner = ''.join(f'<div class="chip"><i></i>{t}</div>' for t in items)
    return f'<div class="abs" style="left:{x}px;top:{y}px;display:flex;flex-direction:column;align-items:flex-start;gap:{gap}px">{inner}</div>'


def cta(text, x, y, w=None):
    width = f'width:{w}px;' if w else ''
    return f'<div class="abs btn" style="left:{x}px;top:{y}px;{width}">{text}</div>'


def tear(x, y, w, angle=0, flip=False):
    src = 'tear-bottom' if flip else 'tear-top'
    return f'<img class="abs" src="assets/{src}.png" style="left:{x}px;top:{y}px;width:{w}px;height:auto;transform:rotate({angle}deg)">'


def slash(word, size, colour=WHITE, bar=120):
    return (f'<div style="display:flex;align-items:center;justify-content:center;gap:20px">'
            f'<span style="display:block;width:{bar}px;height:9px;background:{colour};transform:skewX(-30deg)"></span>'
            f'<span class="promo" style="font-size:{size}px;color:{colour}">{word}</span>'
            f'<span style="display:block;width:{bar}px;height:9px;background:{colour};transform:skewX(-30deg)"></span></div>')


def ab(size, name, body):
    return f'<section class="ab {size}" data-name="{name}">{canvas(size)}{body}{grain()}</section>'


# ---------- concepts: each returns (name, body) for a size ----------

def s01a(s):
    n = 'S01a Black Friday teaser | Static | Range | Prep teaser'
    if s == 's1':
        return n, f"""{logo('white', 230, 425, 70)}
<div class="abs lbl" style="left:0;right:0;top:230px;text-align:center;color:{WHITE};font-size:26px;letter-spacing:.4em">It's coming</div>
{lockup(920, 80, 280)}
<div class="abs" style="left:0;right:0;top:665px;text-align:center;font-size:40px;font-weight:600">Tough discounts on real workwear</div>
<div class="abs" style="left:0;right:0;top:760px;display:flex;justify-content:center"><div class="h" style="font-size:44px;border:3px solid {SIG};padding:18px 34px">Up to 60% off RRP from <span class="ph">16 NOV</span></div></div>
{badge(150, 60, 870)}{badge(150, 870, 870)}"""
    return n, f"""{logo('white', 260, 410, 260)}
<div class="abs lbl" style="left:0;right:0;top:520px;text-align:center;font-size:30px;letter-spacing:.4em">It's coming</div>
{lockup(1000, 40, 590)}
<div class="abs" style="left:0;right:0;top:1010px;text-align:center;font-size:46px;font-weight:600">Tough discounts on real workwear</div>
<div class="abs" style="left:0;right:0;top:1120px;display:flex;justify-content:center"><div class="h" style="font-size:48px;border:3px solid {SIG};padding:20px 36px">Up to 60% off RRP<br>from <span class="ph">16 NOV</span></div></div>
{badge(200, 440, 1330)}"""


def s01b(s):
    n = 'S01b Black Friday hero | Static | Range | Up to 60% off RRP'
    if s == 's1':
        return n, f"""{logo('white', 200, 440, 50)}
{lockup(620, 230, 120)}
<div class="abs" style="left:0;right:0;top:385px;text-align:center"><span class="h" style="font-size:44px;color:{SIG}">Up to </span><span class="h" style="font-size:110px;color:{SIG}">60%</span><span class="h" style="font-size:44px;color:{SIG}"> off RRP</span></div>
{product('waterproof-bomber', 250, 910, 360)}{product('cotton-trade-trousers', 540, 920, 430)}{product('cargo-hivis-trousers', 830, 910, 400)}
{cta('Check the offers', 335, 950, 410)}"""
    return n, f"""{logo('white', 230, 425, 260)}
{lockup(860, 110, 360)}
<div class="abs" style="left:0;right:0;top:720px;text-align:center"><span class="h" style="font-size:54px;color:{SIG}">Up to </span><span class="h" style="font-size:150px;color:{SIG}">60%</span><span class="h" style="font-size:54px;color:{SIG}"> off RRP</span></div>
{product('waterproof-bomber', 240, 1420, 470)}{product('cotton-trade-trousers', 540, 1460, 600)}{product('cargo-hivis-trousers', 845, 1420, 540)}
{cta('Check the offers', 320, 1490, 440)}"""


def hero_product(s, name, cut, hook, chip_list, now, was, product_h=(820, 1040)):
    if s == 's1':
        return name, f"""{logo('white', 190, 60, 60)}{lockup(300, 720, 40)}
<div class="abs h" style="left:60px;top:170px;font-size:112px;width:620px">{hook}</div>
{chips(chip_list, 60, 520)}
{price(now, was, 60, 760, 120)}
{product(cut, 790, 1040, product_h[0])}"""
    return name, f"""{logo('white', 220, 60, 260)}{lockup(330, 690, 230)}
<div class="abs h" style="left:60px;top:400px;font-size:128px;width:960px">{hook}</div>
{product(cut, 790, 1575, product_h[1] * .82)}
{chips(chip_list, 60, 760)}
{price(now, was, 60, 1300, 130)}"""


def s02a(s):
    return hero_product(s, 'S02a Cotton Trade Trousers | Static | Product | £21 was £70', 'cotton-trade-trousers',
                        f'£70 trousers.<br><span style="color:{SIG}">£21.</span>', ['CORDURA® wear areas', 'Knee pad pouches', '100% cotton'], '£21', '£70')


def s02b(s):
    return hero_product(s, 'S02b Waterproof Bomber | Static | Product | £18', 'waterproof-bomber',
                        f'Waterproof.<br><span style="color:{SIG}">£18.</span>', ['Sealed seams', 'Quilted liner', 'Tuck-away hood'], '£18', '£35.95', (600, 760))


def s02c(s):
    n = 'S02c Stretch Multi-Pocket | Static | Model | Made for kneeling'
    if s == 's1':
        return n, f"""{photo("TR8825_2.jpg", 560, 60, 460, 960, "35% 50%", 'border:3px solid ' + SIG + ';filter:brightness(.92) contrast(1.05)')}
{logo('white', 190, 60, 60)}
<div class="abs h" style="left:60px;top:170px;font-size:82px;width:470px">Made for<br><span style="color:{SIG}">kneeling.</span></div>
{chips(['Stretch knee panels', 'Knee pad pockets', 'Zip-off holsters'], 60, 450)}
{price('£25', '£62.95', 60, 720, 120)}{lockup(300, 60, 975)}"""
    return n, f"""{photo('TR8825_2.jpg', 60, 860, 960, 720, '45% 45%', 'border:3px solid ' + SIG)}
{logo('white', 220, 60, 260)}{lockup(330, 690, 230)}
<div class="abs h" style="left:60px;top:400px;font-size:128px;width:960px">Made for <span style="color:{SIG}">kneeling.</span></div>
{chips(['Stretch knee panels', 'Knee pad pockets'], 60, 680)}
<div class="abs" style="left:60px;top:1300px;background:rgba(0,0,0,.85);padding:26px 34px 30px;border-left:10px solid {LIME}">{price('£25', '£62.95', 0, 0, 120).replace('class="abs" style="left:0px;top:0px;', 'style="')}</div>"""


def s03(s):
    items = [('cotton-trade-trousers', 'Cotton Trade Trousers', '£21', '£70'), ('cargo-hybrid', 'Cargo Hybrid Trousers', '£26', '£65'),
             ('bomber-work-jacket', 'Bomber Work Jacket', '£28.06', '£52.95'), ('two-tone-softshell', 'Two Tone Softshell', '£19.98', '£39.95')]
    n = 'S03 Price drops | Static | Range | Was now x4'
    tw, th = (470, 390) if s == 's1' else (470, 450)
    x0, y0 = (60, 240) if s == 's1' else (60, 620)
    tiles = ''
    for i, (cut, title, now, was) in enumerate(items):
        x, y = x0 + (i % 2) * (tw + 20), y0 + (i // 2) * (th + 20)
        ph = th * (0.62 if s == 's1' else 0.66)
        tiles += (f'<div class="abs" style="left:{x}px;top:{y}px;width:{tw}px;height:{th}px;background:rgba(33,33,33,.82);border:2px solid rgba(255,255,255,.08)">'
                  f'<img src="assets/cutouts/{cut}-lit.png" style="position:absolute;right:16px;bottom:16px;height:{ph}px;width:auto">'
                  f'<div class="lbl" style="position:absolute;left:24px;top:22px;font-size:17px;color:{CONCRETE};width:200px;line-height:1.3">{title}</div>'
                  f'<div style="position:absolute;left:24px;bottom:24px">'
                  f'<div style="display:flex;align-items:center;gap:8px"><svg width="34" height="40" viewBox="0 0 34 40"><path d="M17 40 L0 20 H10 V0 H24 V20 H34 Z" fill="{SIG}"/></svg>'
                  f'<span class="h" style="font-size:64px">{now}</span></div>'
                  f'<div style="font-size:22px;font-weight:600;color:{STEEL};margin-top:4px">RRP <span class="strike">{was}</span></div></div></div>')
    if s == 's1':
        return n, f"""{logo('white', 170, 60, 60)}{lockup(300, 720, 34)}
<div class="abs h" style="left:60px;top:150px;font-size:62px">Price drops. <span style="color:{SIG}">No code needed.</span></div>
{tiles}"""
    return n, f"""{logo('white', 220, 60, 260)}{lockup(420, 600, 230)}
<div class="abs h" style="left:60px;top:400px;font-size:84px">Price drops.<br><span style="color:{SIG}">No code.</span></div>
{tiles}"""


def s06(s):
    n = 'S06 Retargeting sizing | Static | Cargo Hybrid | Go one waist up'
    dim = lambda x, y, w: (f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px;height:56px">'
                           f'<div style="position:absolute;left:0;right:0;top:26px;height:4px;background:{SIG}"></div>'
                           f'<div style="position:absolute;left:0;top:8px;width:4px;height:40px;background:{SIG}"></div>'
                           f'<div style="position:absolute;right:0;top:8px;width:4px;height:40px;background:{SIG}"></div>'
                           f'<div class="h" style="position:absolute;left:50%;top:-44px;transform:translateX(-50%);font-size:34px;color:{SIG};white-space:nowrap">+1 waist size</div></div>')
    if s == 's1':
        return n, f"""{photo('TR9074_4.jpg', 560, 60, 460, 960, '50% 30%', 'border:3px solid ' + SIG)}
{dim(600, 360, 380)}
{logo('white', 190, 60, 60)}
<div class="abs h" style="left:60px;top:180px;font-size:92px;width:470px">Not sure <span style="color:{SIG}">on size?</span></div>
<div class="abs body" style="left:60px;top:430px;width:450px;font-size:32px">Our trousers run small. Order <b>one waist size up</b> from your normal and they'll fit how they should.</div>
<div class="abs lbl" style="left:60px;top:740px;color:{CONCRETE};font-size:20px;line-height:1.6">30 days to return<br>Black Friday prices end 26 Nov</div>
{lockup(320, 60, 930)}"""
    return n, f"""{photo('TR9074_4.jpg', 60, 880, 960, 700, '50% 30%', 'border:3px solid ' + SIG)}
{dim(300, 1180, 480)}
{logo('white', 220, 60, 260)}{lockup(330, 690, 230)}
<div class="abs h" style="left:60px;top:400px;font-size:120px;width:960px">Not sure <span style="color:{SIG}">on size?</span></div>
<div class="abs body" style="left:60px;top:660px;width:900px;font-size:40px">Our trousers run small. Order <b>one waist size up</b> and they'll fit how they should. 30 days to return.</div>"""


def weekend(s, name, kicker, big, sub, small, flag=None):
    """27–30 Nov look: lime torn paper over scuffed black, full-price Protex1 jacket."""
    if s == 's1':
        return name, f"""{tear(-160, -40, 1400, -3)}{logo('black', 230, 60, 52)}
{f'<div class="abs promo" style="right:60px;top:52px;font-size:46px;color:{BLACK}">{flag}</div>' if flag else ''}
<div class="abs promo" style="left:60px;top:300px;font-size:60px;color:{WHITE}">{kicker}</div>
<div class="abs promo" style="left:52px;top:375px;font-size:170px;color:{SIG}">{big}</div>
<div class="abs h" style="left:60px;top:560px;font-size:62px">{sub}</div>
<div class="abs lbl" style="left:60px;top:660px;color:{CONCRETE};font-size:21px;line-height:1.7;width:540px">{small}</div>
{product('protex1-jacket', 850, 1040, 470)}"""
    return name, f"""{tear(-200, 205, 1500, -3)}{logo('black', 260, 60, 268)}
{f'<div class="abs promo" style="right:60px;top:262px;font-size:54px;color:{BLACK}">{flag}</div>' if flag else ''}
<div class="abs promo" style="left:60px;top:560px;font-size:72px;color:{WHITE}">{kicker}</div>
<div class="abs promo" style="left:50px;top:650px;font-size:205px;color:{SIG}">{big}</div>
<div class="abs h" style="left:60px;top:860px;font-size:78px">{sub}</div>
<div class="abs lbl" style="left:60px;top:965px;color:{CONCRETE};font-size:26px;line-height:1.6">{small}</div>
{product('protex1-jacket', 720, 1580, 500)}"""


def s08a(s):
    n = 'S08a Countdown 3 days | Static | Range | Category ends Thu'
    if s == 's1':
        return n, f"""{logo('white', 190, 445, 60)}
<div class="abs" style="left:0;right:0;top:170px;text-align:center"><span class="promo" style="font-size:260px;color:{SIG}">3</span><span class="promo" style="font-size:110px;color:{WHITE}"> days left</span></div>
{lockup(620, 230, 470)}
<div class="abs h" style="left:0;right:0;top:760px;text-align:center;font-size:48px">Up to 60% off RRP ends Thursday</div>
{cta('Check the offers', 335, 880, 410)}"""
    return n, f"""{logo('white', 230, 425, 260)}
<div class="abs promo" style="left:0;right:0;top:420px;text-align:center;font-size:420px;color:{SIG}">3</div>
<div class="abs promo" style="left:0;right:0;top:800px;text-align:center;font-size:130px">days left</div>
{lockup(760, 160, 990)}
<div class="abs h" style="left:0;right:0;top:1340px;text-align:center;font-size:56px">Up to 60% off RRP<br>ends Thursday</div>"""


def s08b(s):
    return weekend(s, 'S08b Black Friday 30 sitewide | Static | Protex1 | Code', "It's Black Friday", '30% off', 'Sitewide',
                   'With code <span class="ph">[CODE]</span><br>Excludes reduced items · Ends midnight Mon 30 Nov')


def s08c(s):
    return weekend(s, 'S08c Last day 30 | Static | Protex1 | Ends midnight', 'Last day', '30% off', 'Ends midnight',
                   'Code <span class="ph">[CODE]</span> · Sitewide<br>Excludes reduced items')


def s09(s):
    return weekend(s, 'S09 HOLD Extension | Static | Protex1 | Extended', 'Extended', '30% off', 'Sitewide',
                   'Now ends <span class="ph">[DAY DATE]</span><br>Code <span class="ph">[CODE]</span> · Excludes reduced items', flag='HOLD')


CONCEPTS = [s01a, s01b, s02a, s02b, s02c, s03, s06, s08a, s08b, s08c, s09]


# ---------- carousel (1:1 cards) ----------

def carousel():
    cards = []
    cards.append(('S04 Card 1 Cover', f"""{logo('white', 200, 440, 70)}{lockup(860, 110, 220)}
<div class="abs" style="left:0;right:0;top:600px;text-align:center"><span class="h" style="font-size:52px;color:{SIG}">Up to </span><span class="h" style="font-size:140px;color:{SIG}">60%</span><span class="h" style="font-size:52px;color:{SIG}"> off RRP</span></div>
<div class="abs lbl" style="left:0;right:0;top:880px;text-align:center;font-size:26px">Swipe for the best of it →</div>"""))

    def pair(title, a, b):
        (ca, na, pa, wa), (cb, nb, pb, wb) = a, b
        return f"""{logo('white', 170, 60, 60)}{lockup(300, 720, 40)}
<div class="abs h" style="left:60px;top:160px;font-size:96px">{title}</div>
{product(ca, 290, 900, 560)}{product(cb, 790, 900, 560)}
<div class="abs" style="left:60px;top:930px;width:460px"><div class="lbl" style="font-size:18px;color:{CONCRETE}">{na}</div><div class="h" style="font-size:58px;margin-top:4px">{pa} <span style="font-size:24px;font-weight:600;color:{STEEL};font-family:'Titillium Web'">{'RRP <span class="strike">' + wa + '</span>' if wa else ''}</span></div></div>
<div class="abs" style="left:560px;top:930px;width:460px"><div class="lbl" style="font-size:18px;color:{CONCRETE}">{nb}</div><div class="h" style="font-size:58px;margin-top:4px">{pb} <span style="font-size:24px;font-weight:600;color:{STEEL};font-family:'Titillium Web'">{'RRP <span class="strike">' + wb + '</span>' if wb else ''}</span></div></div>"""
    cards.append(('S04 Card 2 Jackets', pair(f'Jackets <span style="color:{SIG}">from £18</span>', ('waterproof-bomber', 'Waterproof Bomber', '£18', '£35.95'), ('bomber-work-jacket', 'Bomber Work Jacket', '£28.06', '£52.95'))))
    cards.append(('S04 Card 3 Trousers', pair(f'Trousers <span style="color:{SIG}">from £21</span>', ('cotton-trade-trousers', 'Cotton Trade Trousers', '£21', '£70'), ('stretch-multi-pocket', 'Stretch Multi-Pocket', '£25', '£62.95'))))
    cards.append(('S04 Card 4 Hi-vis', pair(f'Hi-vis <span style="color:{SIG}">from £16.30</span>', ('cargo-hivis-trousers', 'Cargo Hi-Vis · Class 2', '£18', '£42.95'), ('teamline-trousers', 'Teamline Reflective', '£16.30', '£33.95'))))
    cards.append(('S04 Card 5 Crew kit', pair(f'Crew kit <span style="color:{SIG}">from £9</span>', ('two-tone-softshell', 'Two Tone Softshell', '£19.98', '£39.95'), ('duratex-sweatshirt', 'Duratex™ 1/4 Zip · Logo-ready', '£9', '£30'))))
    return cards


# ---------- DPA frames + stickers ----------

def dpa():
    out = []
    for size, h in (('s1', 1080), ('s9', 1920)):
        top = 0 if size == 's1' else 250
        bot = h if size == 's1' else h - 340
        band = 190
        a = f"""<div class="fill" style="background:repeating-linear-gradient(45deg,#3a3a3a 0 20px,#444 20px 40px)"></div>
<div class="abs lbl" style="left:0;right:0;top:{h / 2 - 20}px;text-align:center;color:#777;font-size:24px">Catalogue image area</div>
{logo('lime', 200, 40, top + 36)}
<div class="abs" style="left:0;right:0;top:{bot - band}px;height:{band}px;background:{INK};border-top:6px solid {SIG}"></div>
<img class="abs" src="assets/bf-lockup.png" style="left:40px;top:{bot - band + 30}px;width:330px">
<div class="abs" style="right:40px;top:{bot - band + 34}px;text-align:right"><div class="h" style="font-size:34px;color:{SIG}">Up to</div><div class="h" style="font-size:96px;color:{SIG};line-height:.85">60% off</div></div>"""
        b = f"""<div class="fill" style="background:repeating-linear-gradient(45deg,#3a3a3a 0 20px,#444 20px 40px)"></div>
<div class="abs lbl" style="left:0;right:0;top:{h / 2 - 20}px;text-align:center;color:#777;font-size:24px">Catalogue image area (full-price set only)</div>
{logo('lime', 200, 40, top + 36)}
<div class="abs" style="left:0;right:0;top:{bot - band}px;height:{band}px;background:{SIG}"></div>
<div class="abs promo" style="left:40px;top:{bot - band + 36}px;font-size:118px;color:{BLACK}">30% off</div>
<div class="abs" style="right:40px;top:{bot - band + 44}px;text-align:right;color:{BLACK}"><div class="h" style="font-size:44px">Sitewide</div><div class="h" style="font-size:34px;margin-top:8px">Code <span style="border:3px dashed #000;padding:0 8px">[CODE]</span></div></div>"""
        out.append((size, f'S05 DPA frame A 60 | {"1x1" if size == "s1" else "9x16"}', a))
        out.append((size, f'S05 DPA frame B 30 | {"1x1" if size == "s1" else "9x16"}', b))
    return out


def stickers():
    st = [
        ('Sticker Black Friday', f'<div style="width:300px;height:300px;border-radius:50%;background:{INK};border:6px solid {SIG};display:flex;align-items:center;justify-content:center"><img src="assets/bf-lockup.png" style="width:240px"></div>'),
        ('Sticker Price drop', f'<div style="display:flex;align-items:center;gap:14px;background:{SIG};padding:18px 30px"><svg width="40" height="48" viewBox="0 0 34 40"><path d="M17 40 L0 20 H10 V0 H24 V20 H34 Z" fill="#000"/></svg><span class="promo" style="font-size:64px;color:#000">Price drop</span></div>'),
        ('Sticker Up to 60', f'<div style="background:{INK};border:5px solid {SIG};padding:16px 30px;text-align:center"><div class="h" style="font-size:30px;color:{SIG}">Up to</div><div class="h" style="font-size:96px;color:{SIG};line-height:.85">60% off</div><div class="h" style="font-size:30px;color:{SIG}">RRP</div></div>'),
        ('Sticker 30 sitewide', f'<div style="background:{SIG};padding:18px 30px;transform:rotate(-4deg)"><div class="promo" style="font-size:84px;color:#000">30% off</div><div class="h" style="font-size:34px;color:#000">Sitewide</div></div>'),
        ('Sticker Last days', f'<div style="background:{WHITE};padding:16px 30px;transform:rotate(3deg)"><span class="promo" style="font-size:70px;color:#000">Last days</span></div>'),
    ]
    return ''.join(f'<section data-name="{n}" style="position:relative;flex:none;padding:0;background:transparent">{h}</section>' for n, h in st)


def page(title, body, capture):
    return (f'<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>{title}</title><style>{CSS}</style>'
            f'{CAPTURE if capture else ""}</head><body>{body}</body></html>')


def main():
    for size, fname in (('s1', 'suite-1x1'), ('s9', 'suite-9x16')):
        body = ''.join(ab(size, *c(size)) for c in CONCEPTS)
        for cap in (False, True):
            (HERE / f'{fname}{"-capture" if cap else ""}.html').write_text(page(f'Veltuff Black Friday {fname}', body, cap))
    car = ''.join(ab('s1', n, b) for n, b in carousel())
    d = ''.join(f'<section class="ab {s}" data-name="{n}">{b}</section>' for s, n, b in dpa()) + f'<div style="display:flex;flex-direction:column;gap:60px">{stickers()}</div>'
    for cap in (False, True):
        sfx = '-capture' if cap else ''
        (HERE / f'carousel{sfx}.html').write_text(page('Veltuff Black Friday carousel', car, cap))
        (HERE / f'dpa{sfx}.html').write_text(page('Veltuff Black Friday DPA', d, cap))
    print('concepts', len(CONCEPTS), 'carousel cards', len(carousel()))


if __name__ == '__main__':
    main()
