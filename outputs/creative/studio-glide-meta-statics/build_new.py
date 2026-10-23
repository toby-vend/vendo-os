"""Studio Glide Oxted: new First Time Pass statics, 5 personas x 3 concepts, 1:1 + 9:16, for Figma capture.

Brand: Figma guideline C5u0fMGR6XE6WcFAzpvm3C (Playfair Display + Lato, Charcoal/Ivory/Bone/Sand/Terracotta,
one italic flourish per headline, arch motif, pill CTAs). Offer facts: research.md (Oxted LP, 23 Oct 2026).
Copy: copy-<persona>.md (headline + primary text parsed from there, so the md files stay the source of truth).
Photos: the studio's own (assets/photos, gitignored), pre-cropped with ffmpeg because the capture ignores
object-position. 9:16 keeps the top 250px and bottom 340px clear of key copy.

Usage: python3 build_new.py  ->  new-<persona>.html (one Figma page per persona)
"""
import html
import re
import subprocess
from pathlib import Path

HERE = Path(__file__).parent
PH = HERE / 'assets/photos'
CHAR, IVORY, BONE, SAND, TAUPE, TERRA, GREY = '#1C1B19', '#F7F4EE', '#EFE8DC', '#D9C3AA', '#A98F72', '#8F6047', '#5A5248'
CTA = 'Get the First Time Pass'
FOOT = 'Oxted · New clients only'

PHOTO = {
    'group': 'site-group-reformer-pilates-studio-banstead-surrey-premium.jpg',
    'studio': 'site-reformer-pilates-studio-banstead-surrey.jpg',
    'arches': 'site-studio-glide-pilates-roam-creative-marketing-303.jpg',
    'lunge': 'site-reformer-pilates-lunge-pilates-ball-banstead-surrey.jpg',
    'stretch': 'site-studio-glide-pilates-roam-creative-marketing-36.jpg',
    'reach': 'site-studio-glide-pilates-roam-creative-marketing-197.jpg',
    'side': 'site-studio-glide-pilates-roam-creative-marketing-63.jpg',
    'mirror': 'site-studio-glide-pilates-roam-creative-marketing-186.jpg',
    'bridge': 'site-studio-glide-pilates-roam-creative-marketing-48.jpg',
    'oxted': 'lp-hero-studio.jpg',
    'laugh': 'imgi_34_703297264_17939933283230263_4095803711676364056_n.jpg',
    'socks': 'imgi_36_691796264_122172394892937818_5058156896686649072_n.jpg',
    'litmirrors': 'imgi_44_672947777_18576351139020099_4592385227140772399_n.jpg',
    'emptystudio': 'imgi_46_659048953_122166736898937818_3670481458604796799_n.jpg',
    'mirrorlaugh': 'imgi_31_707209631_18196594750364456_4592378990641257877_n.jpg',
}


def crop(key, w, h, fx=.5, fy=.5):
    src = PH / PHOTO[key]
    w, h = round(w), round(h)
    out = PH / 'crops' / f'{key}-{w}x{h}-{round(fx * 100)}-{round(fy * 100)}.jpg'
    if not out.exists():
        out.parent.mkdir(exist_ok=True)
        W, H = map(int, subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v', '-show_entries', 'stream=width,height',
                                        '-of', 'csv=p=0', str(src)], capture_output=True, text=True).stdout.strip().split(','))
        if W / H > w / h:
            ch, cw = H, round(H * w / h)
        else:
            cw, ch = W, round(W * h / w)
        x = min(max(round(fx * W - cw / 2), 0), W - cw)
        y = min(max(round(fy * H - ch / 2), 0), H - ch)
        ow = min(cw, round(1.5 * w)) // 2 * 2
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(src), '-vf', f'crop={cw}:{ch}:{x}:{y},scale={ow}:-2',
                        '-q:v', '3', str(out)], check=True)
    return f'assets/photos/crops/{out.name}'


def photo(key, x, y, w, h, fx=.5, fy=.5, radius='0'):
    return (f'<div class="abs ph" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;border-radius:{radius}">'
            f'<img src="{crop(key, w, h, fx, fy)}"></div>')


def logo(w, kind='white', centre_w=None, top=0):
    left = (centre_w - w) / 2
    return f'<img class="abs" src="assets/logo/logo-{kind}.png" style="left:{left}px;top:{top}px;width:{w}px">'


def btn(text, kind='light', size=26):
    bg, fg = {'light': (IVORY, CHAR), 'dark': (CHAR, IVORY)}[kind]
    return f'<div class="btn" style="background:{bg};color:{fg};font-size:{size}px;padding:{size * .95}px {size * 2.1}px">{text}</div>'


def grain():
    return '<div class="abs grain" style="inset:0"></div>'


def stars(c=SAND, s=34):
    star = f'<svg width="{s}" height="{s}" viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill="{c}"/></svg>'
    return f'<div style="display:flex;gap:6px;justify-content:center">{star * 5}</div>'


# ---------------- templates (W x H artboards) ----------------

def t_photo(c, W, H):
    """Full-bleed studio photo, soft bottom scrim, editorial headline, pill CTA."""
    tall = H > W
    top = 250 if tall else 70
    body_bottom = 340 if tall else 80
    return f'''{photo(c['photo'], 0, 0, W, H, *c.get('focus', (.5, .4)))}
<div class="abs" style="left:0;right:0;bottom:0;height:{H * (.62 if tall else .75)}px;background:linear-gradient(180deg,rgba(28,27,25,0) 0%,rgba(28,27,25,.6) 40%,rgba(28,27,25,.92) 100%)"></div>
<div class="abs" style="left:0;right:0;top:0;height:{top + 160}px;background:linear-gradient(180deg,rgba(28,27,25,.45) 0%,rgba(28,27,25,0) 100%)"></div>
{grain()}{logo(300, 'white', W, top - 10)}
<div class="abs col" style="left:90px;right:90px;bottom:{body_bottom}px;align-items:center;text-align:center">
  <div class="eyebrow" style="color:{SAND}">{c['eyebrow']}</div>
  <div class="h" style="font-size:{c.get('hs', 92) * (1.08 if tall else 1)}px;color:{IVORY};margin-top:26px">{c['hook']}</div>
  <div class="rule" style="margin:34px auto 0"></div>
  <div class="sub" style="color:{BONE};margin-top:30px;max-width:820px">{c['sub']}</div>
  <div style="margin-top:44px">{btn(CTA)}</div>
  <div class="foot" style="color:{TAUPE};margin-top:26px">{FOOT}</div>
</div>'''


def t_arch(c, W, H):
    """Ivory ground, arch-framed photo (the studio mirrors), headline under it."""
    tall = H > W
    if tall:
        aw, ah, ax, ay = 640, 820, (W - 640) / 2, 360
        ty = ay + ah + 60
    else:
        aw, ah, ax, ay = 400, 560, 90, 260
        ty = None
    text_block = f'''<div class="eyebrow">{c['eyebrow']}</div>
  <div class="h" style="font-size:{c.get('hs', 84) * (1 if tall else .8)}px;margin-top:22px">{c['hook']}</div>
  <div class="rule" style="margin-top:30px;{'margin-left:auto;margin-right:auto' if tall else ''}"></div>
  <div class="sub" style="color:{GREY};margin-top:28px;font-size:{32 if tall else 27}px">{c['sub']}</div>
  {c.get('extra', '')}
  <div style="margin-top:40px">{btn(CTA, 'dark', 26 if tall else 19)}</div>
  <div class="foot" style="color:{TAUPE};margin-top:24px">{FOOT}</div>'''
    if tall:
        text = f'<div class="abs col" style="left:90px;right:90px;top:{ty}px;align-items:center;text-align:center">{text_block}</div>'
    else:
        text = f'<div class="abs col" style="left:560px;right:80px;top:250px">{text_block}</div>'
    return f'''<div class="abs" style="inset:0;background:{IVORY}"></div>
<div class="abs" style="left:{ax - 14}px;top:{ay - 14}px;width:{aw + 28}px;height:{ah + 14}px;border:1px solid {SAND};border-bottom:0;border-radius:{(aw + 28) / 2}px {(aw + 28) / 2}px 0 0"></div>
{photo(c['photo'], ax, ay, aw, ah, *c.get('focus', (.5, .4)), radius=f'{aw / 2}px {aw / 2}px 0 0')}
{grain()}{logo(260, 'charcoal', W, 250 if tall else 80) if tall else f'<img class="abs" src="assets/logo/logo-charcoal.png" style="left:90px;top:96px;width:260px">'}
{text}'''


def t_split(c, W, H):
    """Photo on top, charcoal panel below with the headline."""
    tall = H > W
    ph = round(H * (.5 if tall else .42))
    return f'''<div class="abs" style="inset:0;background:{CHAR}"></div>
{photo(c['photo'], 0, 0, W, ph, *c.get('focus', (.5, .45)))}
<div class="abs" style="left:0;right:0;top:0;height:{(250 if tall else 70) + 150}px;background:linear-gradient(180deg,rgba(28,27,25,.5) 0%,rgba(28,27,25,0) 100%)"></div>
{grain()}{logo(280, 'white', W, (250 if tall else 70) - 10)}
<div class="abs col" style="left:90px;right:90px;top:{ph + (90 if tall else 56)}px;align-items:center;text-align:center">
  <div class="eyebrow" style="color:{TAUPE}">{c['eyebrow']}</div>
  <div class="h" style="font-size:{c.get('hs', 80) * (1 if tall else .86)}px;color:{IVORY};margin-top:22px">{c['hook']}</div>
  <div class="sub" style="color:{BONE};margin-top:26px;max-width:860px">{c['sub']}</div>
  <div style="margin-top:{44 if tall else 34}px">{btn(CTA)}</div>
  <div class="foot" style="color:{TAUPE};margin-top:22px">{FOOT}</div>
</div>'''


def t_steps(c, W, H):
    """Bone ground, ghost-number steps, small arch photo."""
    tall = H > W
    rows = ''.join(f'<div style="display:flex;gap:30px;align-items:center;padding:{22 if tall else 16}px 0;border-top:1px solid {SAND}">'
                   f'<div class="num" style="font-size:{86 if tall else 70}px;width:{120 if tall else 100}px">0{i + 1}</div>'
                   f'<div style="font-size:{34 if tall else 30}px;color:{CHAR};line-height:1.3">{s}</div></div>' for i, s in enumerate(c['steps']))
    if tall:
        return f'''<div class="abs" style="inset:0;background:{BONE}"></div>{grain()}{logo(260, 'charcoal', W, 250)}
<div class="abs col" style="left:100px;right:100px;top:420px">
  <div class="eyebrow">{c['eyebrow']}</div>
  <div class="h" style="font-size:96px;margin-top:22px">{c['hook']}</div>
  <div style="margin-top:56px">{rows}</div>
  <div style="margin-top:56px;display:flex;align-items:center;gap:30px">{btn(CTA, 'dark')}</div>
  <div class="foot" style="color:{TAUPE};margin-top:24px">{FOOT}</div>
</div>'''
    return f'''<div class="abs" style="inset:0;background:{BONE}"></div>
{photo(c['photo'], 700, 0, 380, 1080, *c.get('focus', (.5, .5)))}
{grain()}<img class="abs" src="assets/logo/logo-charcoal.png" style="left:80px;top:80px;width:240px">
<div class="abs col" style="left:80px;width:560px;top:200px">
  <div class="eyebrow">{c['eyebrow']}</div>
  <div class="h" style="font-size:66px;margin-top:18px">{c['hook']}</div>
  <div style="margin-top:30px">{rows}</div>
  <div style="margin-top:34px">{btn(CTA, 'dark', 22)}</div>
  <div class="foot" style="color:{TAUPE};margin-top:18px">{FOOT}</div>
</div>'''


def t_card(c, W, H):
    """Charcoal ground with a cream card: a review quote, a receipt or a two-week plan."""
    tall = H > W
    card_w = 840 if tall else 760
    return f'''<div class="abs" style="inset:0;background:{CHAR}"></div>
{photo(c['photo'], 0, 0, W, H, *c.get('focus', (.5, .5)))}
<div class="abs" style="inset:0;background:rgba(28,27,25,.72)"></div>
{grain()}{logo(260, 'white', W, 250 if tall else 70)}
<div class="abs col" style="left:{(W - card_w) / 2}px;width:{card_w}px;top:{430 if tall else 190}px;align-items:center;text-align:center">
  <div class="eyebrow" style="color:{SAND}">{c['eyebrow']}</div>
  <div class="h" style="font-size:{c.get('hs', 70)}px;color:{IVORY};margin-top:20px">{c['hook']}</div>
  <div style="margin-top:{44 if tall else 30}px;width:100%;background:{IVORY};padding:{48 if tall else 36}px {52 if tall else 44}px;text-align:left;box-shadow:0 30px 60px rgba(0,0,0,.35)">{c['card']}</div>
  <div style="margin-top:{48 if tall else 34}px">{btn(CTA)}</div>
  <div class="foot" style="color:{TAUPE};margin-top:22px">{FOOT}</div>
</div>'''


def review_card(quote, who):
    return (f'<div style="text-align:center">{stars(TERRA)}<div class="h" style="font-size:40px;margin-top:22px;line-height:1.3">“{quote}”</div>'
            f'<div class="cap" style="margin-top:22px">{who}</div></div>')


def receipt(lines, total):
    rows = ''.join(f'<div style="display:flex;justify-content:space-between;padding:14px 0;border-bottom:1px dashed {SAND};font-size:28px"><span>{a}</span><span>{b}</span></div>' for a, b in lines)
    return (f'<div class="cap" style="text-align:center">First Time Pass · Studio Glide Oxted</div><div style="margin-top:18px">{rows}</div>'
            f'<div style="display:flex;justify-content:space-between;padding-top:20px;font-family:\'Playfair Display\',serif;font-size:44px"><span>Total</span><span>{total}</span></div>')


def planner():
    days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
    plan = [['Reformer', '', 'Barre', '', 'Mat', '', ''], ['', 'Reformer', '', 'Mat', '', 'Barre', '']]
    out = ''
    for w, week in enumerate(plan):
        cells = ''.join(f'<div style="flex:1;height:96px;border:1px solid {SAND};background:{CHAR if k else "transparent"};color:{IVORY};font-size:17px;display:flex;align-items:flex-end;padding:8px">{k}</div>' for k in week)
        out += f'<div class="cap" style="margin:{18 if w else 0}px 0 10px">Week {w + 1}</div><div style="display:flex;gap:8px">{cells}</div>'
    head = ''.join(f'<div style="flex:1;text-align:center" class="cap">{d}</div>' for d in days)
    return f'<div style="display:flex;gap:8px;margin-bottom:12px">{head}</div>{out}<div class="cap" style="margin-top:20px;text-align:center;color:{GREY}">An example two weeks · pick any mix</div>'


T = {'photo': t_photo, 'arch': t_arch, 'split': t_split, 'steps': t_steps, 'card': t_card}

# ---------------- concepts (on-image copy mirrors the copy-*.md files) ----------------

PERSONAS = [
    ('first-timer', 'Nervous first-timer', 'copy-first-timer.md', [
        dict(code='FT1', name='Never been on a reformer', t='photo', photo='socks', focus=(.45, .45), eyebrow='First time at Studio Glide?',
             hook='Never been on a <em>reformer?</em>', sub='Arrive 10 minutes early and we set up your reformer with you. 6 to 8 people, coached for all levels.'),
        dict(code='FT2', name='Am I good enough', t='arch', photo='mirror', focus=(.5, .4), eyebrow='The question everyone asks', hs=78,
             hook='“Am I good <em>enough</em> for Reformer?”', sub='You don’t need to be good at it to start. That’s what the instructor is for. All levels, every class.'),
        dict(code='FT3', name='First class step by step', t='steps', photo='socks', focus=(.5, .5), eyebrow='Studio Glide Oxted',
             hook='Your first class, <em>step by step</em>',
             steps=['Get your First Time Pass', 'Bring grippy socks and water', 'Arrive 10 minutes early', '50 minutes, coached for all levels']),
    ]),
    ('mum', 'Mum getting back to exercise', 'copy-mum.md', [
        dict(code='MU1', name='Back on the list', t='photo', photo='laugh', focus=(.5, .35), eyebrow='Reformer · Mat · Barre in Oxted',
             hook='Somewhere on the list, <em>after everyone else?</em>', hs=84, sub='50 minutes that are just yours. Coached for all levels, 6 to 8 people.'),
        dict(code='MU2', name='After drop-off', t='split', photo='oxted', focus=(.5, .5), eyebrow='Station Road East, Oxted',
             hook='Drop-off done. <em>Your</em> 50 minutes starts here.', sub='Classes from early mornings to evenings. In and out before pick-up.'),
        dict(code='MU3', name='Two weeks six classes', t='card', photo='studio', eyebrow='First Time Pass · £10 a class',
             hook='Two weeks. Six classes. <em>One hour that’s yours.</em>', hs=62, card=planner()),
    ]),
    ('ex-london', 'Ex-London boutique seeker', 'copy-ex-london.md', [
        dict(code='LN1', name='London standard', t='arch', photo='arches', focus=(.5, .5), eyebrow='Boutique Reformer, Oxted',
             hook='London-standard Reformer. <em>Two minutes</em> from the station.', hs=72, sub='6 to 8 people, 50 minutes, instructors who correct your form as you go.'),
        dict(code='LN2', name='Small class real corrections', t='split', photo='lunge', focus=(.5, .4), eyebrow='Studio Glide Oxted',
             hook='6 to 8 people. <em>One instructor</em> watching your form.', sub='You know the difference between a class and a good class.'),
        dict(code='LN3', name='Worth the drive', t='card', photo='group', focus=(.5, .4), eyebrow='Rated 5.0 on Google',
             hook='People drive for this. <em>You can walk.</em>', hs=66,
             card=review_card('I drive 40mins each way past 4 other studios to attend these classes', 'Molly F · Google review · Studio Glide Banstead')),
    ]),
    ('desk', 'Desk worker / busy professional', 'copy-desk.md', [
        dict(code='DK1', name='Out of the meeting', t='photo', photo='litmirrors', focus=(.5, .45), eyebrow='Early mornings to evenings',
             hook='Out of the meeting. <em>Onto the reformer.</em>', sub='Book up to 3 weeks ahead. After-work slots go first.'),
        dict(code='DK2', name='Phone in the bag', t='arch', photo='bridge', focus=(.45, .5), eyebrow='50 minutes, screens off',
             hook='Nine hours on screens. <em>50 minutes</em> off them.', hs=74, sub='One instruction at a time, an instructor watching your form. Phone in your bag.'),
        dict(code='DK3', name='Ten pounds a class', t='card', photo='studio', eyebrow='First Time Pass · New clients',
             hook='Still paying for the gym <em>you don’t go to?</em>', hs=60,
             card=receipt([('6 classes, booked in', '£10 each'), ('Reformer · Mat · Barre', 'Included'), ('Used within', '2 weeks'), ('Class size', '6 to 8')], '£60')),
    ]),
    ('gym-avoider', 'Never enjoyed the gym', 'copy-gym-avoider.md', [
        dict(code='GY1', name='Maybe it was the gym', t='photo', photo='side', focus=(.5, .4), eyebrow='Reformer · Mat · Barre in Oxted',
             hook='Never liked the gym? <em>Maybe it was the gym.</em>', hs=84, sub='6 to 8 people, a calm studio and an instructor who gives you the easier or harder option.'),
        dict(code='GY2', name='Never done Pilates', t='arch', photo='oxted', focus=(.35, .5), eyebrow='All levels, every class',
             hook='Never done Pilates? <em>Start here.</em>', sub='Low impact and fully coached from your first class. We set up your reformer with you.',
             extra=f'<div class="cap" style="margin-top:26px;color:{TERRA}">“never did any pilates before” · Google review, Banstead</div>'),
        dict(code='GY3', name='Low impact still hard work', t='split', photo='reach', focus=(.5, .35), eyebrow='Studio Glide Oxted',
             hook='Low impact. <em>Still hard work.</em>', sub='Springs and slow control. Easy to follow, felt the next day.'),
    ]),
]


def parse_copy(md, code):
    sec = re.search(rf'## {code} ·(.*?)(?=\n## |\Z)', (HERE / md).read_text(), re.S).group(1)
    head = re.search(r'\*\*Headline:\*\* (.+)', sec).group(1).strip()
    prim = '\n'.join(l[2:] if l.startswith('> ') else '' for l in sec.split('\n') if l.startswith('>'))
    return head, prim.strip()


CSS = f"""
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:#E9E2D4;font-family:'Lato',sans-serif;color:{CHAR};-webkit-font-smoothing:antialiased}}
.canvas{{position:relative}}
.board{{position:absolute;overflow:hidden;background:{IVORY}}}
.abs{{position:absolute}} .col{{display:flex;flex-direction:column}}
.ph{{overflow:hidden}} .ph img{{width:100%;height:100%;object-fit:cover;display:block}}
.grain{{background:url(assets/grain.png);background-size:300px;opacity:.06;pointer-events:none}}
.h{{font-family:'Playfair Display',serif;font-weight:400;line-height:1.08;color:{CHAR}}}
.h em{{font-style:italic;color:{TERRA}}}
.board .h[style*="color:{IVORY}"] em{{color:{SAND}}}
.eyebrow{{font-weight:700;font-size:22px;letter-spacing:.32em;text-transform:uppercase;color:{TERRA}}}
.sub{{font-size:32px;line-height:1.5}}
.rule{{width:110px;height:1px;background:{TERRA}}}
.btn{{display:inline-flex;border-radius:999px;letter-spacing:.2em;text-transform:uppercase;white-space:nowrap}}
.foot{{font-size:20px;letter-spacing:.25em;text-transform:uppercase}}
.num{{font-family:'Playfair Display',serif;color:{SAND};line-height:1}}
.cap{{font-size:18px;letter-spacing:.22em;text-transform:uppercase;color:{TAUPE}}}
.card{{position:absolute;width:1080px;background:#fff;border:1px solid {SAND};padding:40px 44px;font-family:'Inter',sans-serif}}
.card .t{{font-size:30px;font-weight:600;margin-bottom:10px}}
.card .k{{font-size:15px;letter-spacing:.14em;text-transform:uppercase;color:{TERRA};margin-top:22px;font-weight:600}}
.card .p{{font-size:22px;line-height:1.5;margin-top:8px;white-space:pre-wrap}}
.card .v{{font-size:24px;margin-top:6px}}
"""


def build(slug, label, md, concepts):
    boards, cards = [], []
    for i, c in enumerate(concepts):
        x = 80 + i * 1160
        for (W, H, y) in [(1080, 1080, 80), (1080, 1920, 2560)]:
            boards.append(f'<div class="board" style="left:{x}px;top:{y}px;width:{W}px;height:{H}px">{T[c["t"]](c, W, H)}</div>')
        head, prim = parse_copy(md, c['code'])
        cards.append(f'<div class="card" style="left:{x}px;top:1240px"><div class="t">{c["code"]} · {html.escape(c["name"])}</div>'
                     f'<div class="k">Headline</div><div class="v">{html.escape(head)}</div>'
                     f'<div class="k">Primary text</div><div class="p">{html.escape(prim)}</div>'
                     f'<div class="k">CTA button</div><div class="v">Sign Up · instant form, then self-booking on the Oxted timetable</div></div>')
    width = 80 + len(concepts) * 1160
    page = f'''<!doctype html><html><head><meta charset="utf-8"><title>Studio Glide · New · {label}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400;1,500&family=Lato:wght@400;700&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>
<style>{CSS}</style></head><body><div class="canvas" style="width:{width}px;height:4560px">{''.join(boards)}{''.join(cards)}</div></body></html>'''
    (HERE / f'new-{slug}.html').write_text(page)


if __name__ == '__main__':
    for slug, label, md, concepts in PERSONAS:
        build(slug, label, md, concepts)
        print(slug, [c['code'] for c in concepts])
