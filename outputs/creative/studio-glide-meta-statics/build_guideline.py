"""Studio Glide Pilates brand guideline: HTML harness for Figma capture.

Sources (23 Oct 2026):
- Palette, type, buttons, arch motif, voice: the Claude Design "Studio Glide Brand Cheat Sheet" (v1.0, July 2026),
  pulled into src/ from Claude Design project c27a71dc. Sampled from studioglidepilates.com.
- Logo: the site's Squarespace PNGs (STUDIO_GLIDE_PILATES_logo_06 = white, logo_03 = ivory), 2500w. No vector
  published. Charcoal and terracotta versions are the white file's alpha recoloured, never redrawn.
- Photos: studioglidepilates.com (Banstead studio, roam creative shoot), the Oxted LP hero, and the uploads in the
  Claude Design project (Oxted team and studio). assets/photos is gitignored; crops land in assets/photos/crops.
- Facts: Oxted LP (lp.studioglidepilates.com/oxted, 23 Oct 2026): 53 Station Road East, Oxted, RH8 0AX. First Time
  Pass, up to 6 classes for £60 within 2 weeks, new clients. 50-minute classes, 6 to 8 people. Reformer, Mat, Barre.
  5.0 on Google.

Usage: python3 build_guideline.py  ->  guideline.html (Figma capture)
"""
import subprocess
from pathlib import Path

HERE = Path(__file__).parent
PH = HERE / 'assets/photos'

CHAR, IVORY, BONE, WHITE = '#1C1B19', '#F7F4EE', '#EFE8DC', '#FFFFFF'
SAND, TAUPE, TERRA, GREY = '#D9C3AA', '#A98F72', '#8F6047', '#5A5248'

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
    'team': 'imgi_32_691913036_122172396506937818_5417391527192752565_n.jpg',
    'laugh': 'imgi_44_672947777_18576351139020099_4592385227140772399_n.jpg',
    'socks': 'imgi_46_659048953_122166736898937818_3670481458604796799_n.jpg',
    'selfie': 'imgi_33_691082548_122172395366937818_5578713930521360098_n.jpg',
}


def crop(key, w, h, fx=.5, fy=.5):
    """Cover-crop from the real image aspect (capture ignores object-position, so every frame gets a pre-cut file)."""
    src = PH / PHOTO[key]
    w, h = round(w), round(h)
    out = PH / 'crops' / f'{key}-{w}x{h}-{round(fx * 100)}-{round(fy * 100)}.jpg'
    if not out.exists():
        out.parent.mkdir(exist_ok=True)
        dims = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v', '-show_entries', 'stream=width,height',
                               '-of', 'csv=p=0', str(src)], capture_output=True, text=True).stdout.strip()
        W, H = map(int, dims.split(','))
        if W / H > w / h:
            ch, cw = H, round(H * w / h)
        else:
            cw, ch = W, round(W * h / w)
        x = min(max(round(fx * W - cw / 2), 0), W - cw)
        y = min(max(round(fy * H - ch / 2), 0), H - ch)
        ow = min(cw, 2 * w) // 2 * 2
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(src), '-vf',
                        f'crop={cw}:{ch}:{x}:{y},scale={ow}:-2', '-q:v', '3', str(out)], check=True)
    return f'assets/photos/crops/{out.name}'


def photo(key, x, y, w, h, fx=.5, fy=.5, radius='0', extra=''):
    return (f'<div class="abs ph" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;border-radius:{radius};{extra}">'
            f'<img src="{crop(key, w, h, fx, fy)}"></div>')


def arch(key, x, y, w, h, fx=.5, fy=.5):
    return photo(key, x, y, w, h, fx, fy, f'{w / 2}px {w / 2}px 0 0')


def logo(w, kind='charcoal', extra=''):
    return f'<img src="assets/logo/logo-{kind}.png" style="display:block;width:{w}px;{extra}">'


def btn(text, size=16, kind='dark'):
    bg, fg, bd = {'dark': (CHAR, IVORY, CHAR), 'light': (IVORY, CHAR, IVORY), 'outline': ('transparent', CHAR, CHAR),
                  'outline-light': ('transparent', IVORY, IVORY)}[kind]
    return (f'<div class="btn" style="font-size:{size}px;padding:{size}px {size * 2.6}px;background:{bg};color:{fg};'
            f'border:1px solid {bd}">{text}</div>')


def pill(text, kind='outline'):
    bg, fg, bd = {'outline': ('transparent', CHAR, SAND), 'tint': (BONE, GREY, BONE), 'dark': (CHAR, IVORY, CHAR),
                  'terra': (TERRA, IVORY, TERRA)}[kind]
    return f'<div class="pill" style="background:{bg};color:{fg};border:1px solid {bd}">{text}</div>'


CSS = f"""
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:#cfc6b6;font-family:'Lato',sans-serif;color:{CHAR};display:flex;flex-direction:column;gap:120px;padding:120px;width:2160px;-webkit-font-smoothing:antialiased}}
.page{{position:relative;width:1920px;height:1080px;overflow:hidden;background:{IVORY}}}
.dark{{background:{CHAR};color:{IVORY}}} .bone{{background:{BONE}}}
.abs{{position:absolute}}
.ph{{overflow:hidden}} .ph img{{width:100%;height:100%;object-fit:cover;display:block}}
.h{{font-family:'Playfair Display',serif;font-weight:400;line-height:1.08;color:{CHAR}}}
.dark .h{{color:{IVORY}}}
.h em{{font-style:italic;color:{TERRA}}} .dark .h em{{color:{SAND}}}
.eyebrow{{font-weight:700;font-size:14px;letter-spacing:.35em;text-transform:uppercase;color:{TERRA}}}
.dark .eyebrow{{color:{TAUPE}}}
.body{{font-size:19px;line-height:1.65;color:{GREY}}} .dark .body{{color:{BONE}}}
.body p+p{{margin-top:14px}}
.small{{font-size:15px;line-height:1.55;color:{GREY}}}
.btn{{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;letter-spacing:.25em;text-transform:uppercase;white-space:nowrap;font-weight:400}}
.pill{{display:inline-flex;align-items:center;border-radius:999px;padding:8px 18px;font-size:14px;letter-spacing:.08em;white-space:nowrap}}
.rule{{height:1px;background:{SAND}}}
.num{{font-family:'Playfair Display',serif;color:{SAND};line-height:1}}
.foot{{position:absolute;left:96px;right:96px;bottom:44px;display:flex;justify-content:space-between;font-size:13px;letter-spacing:.3em;text-transform:uppercase;color:{TAUPE}}}
.cap{{font-size:12px;letter-spacing:.25em;text-transform:uppercase;color:{TAUPE}}}
"""


def foot(n, title, dark=False):
    return f'<div class="foot"><div>Studio Glide Pilates · Brand guidelines</div><div>{n:02d} · {title}</div></div>'


def head(n, eyebrow, title, x=96, y=96, w=760):
    return (f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px"><div class="eyebrow">{n:02d} · {eyebrow}</div>'
            f'<div class="h" style="font-size:64px;margin-top:22px">{title}</div></div>')


# ---------- pages ----------

def cover():
    return f'''<div class="page" id="cover">
{photo('stretch', 960, 0, 960, 1080, .5, .45)}
<div class="abs" style="left:96px;top:96px">{logo(380)}</div>
<div class="abs" style="left:96px;top:420px;width:760px">
  <div class="eyebrow">Brand guidelines · v1.0 · October 2026</div>
  <div class="h" style="font-size:104px;margin-top:28px">Your space to move, <em>breathe</em> and reset.</div>
</div>
<div class="abs" style="left:96px;bottom:96px;width:760px">
  <div class="rule" style="width:110px;background:{TERRA}"></div>
  <div class="body" style="margin-top:24px">Boutique Reformer, Mat and Barre Pilates. Banstead and Oxted, Surrey.</div>
</div></div>'''


def logo_page():
    cell = lambda x, y, w, h, bg, kind, label, inner=None: (
        f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;background:{bg};display:flex;align-items:center;justify-content:center">'
        f'{inner or logo(round(w * .56), kind)}</div><div class="abs cap" style="left:{x}px;top:{y + h + 14}px">{label}</div>')
    clear = f'''<div class="abs" style="left:96px;top:300px;width:820px;height:400px;background:{BONE}"></div>
<div class="abs" style="left:216px;top:403px;width:580px;height:194px;border:1px dashed {TERRA}"></div>
<div class="abs" style="left:256px;top:443px">{logo(500)}</div>
<div class="abs" style="left:216px;top:403px;width:40px;height:40px;background:rgba(143,96,71,.18)"></div>
<div class="abs cap" style="left:96px;top:714px">Primary logo · clear space = height of “PILATES” on every side</div>'''
    misuse = [('Stretch', 'transform:scaleX(1.35)'), ('Low contrast', 'opacity:.18'),
              ('Add effects', 'filter:drop-shadow(6px 6px 4px rgba(0,0,0,.6))')]
    mis = ''.join(f'''<div class="abs" style="left:{96 + i * 280}px;top:820px;width:260px;height:130px;background:{IVORY};border:1px solid {SAND};display:flex;align-items:center;justify-content:center;overflow:hidden">{logo(150, 'charcoal', s)}</div>
<div class="abs" style="left:{96 + i * 280}px;top:820px;width:260px;height:130px;background:linear-gradient(to top right,transparent calc(50% - 1px),{TERRA} 50%,transparent calc(50% + 1px))"></div>
<div class="abs cap" style="left:{96 + i * 280}px;top:962px">Don’t · {t}</div>''' for i, (t, s) in enumerate(misuse))
    return f'''<div class="page" id="logo">
{head(1, 'Logo', 'The wordmark', w=800)}
<div class="abs body" style="left:1000px;top:120px;width:820px">The Studio Glide wordmark pairs a fine serif STUDIO with a heavier GLIDE, over wide-tracked PILATES. Use it as supplied, in one colour, with room to breathe. Minimum width 120px on screen.</div>
{clear}
{cell(1000, 300, 400, 220, CHAR, 'white', 'White on Charcoal')}
{cell(1420, 300, 400, 220, TERRA, 'ivory', 'Ivory on Terracotta')}
<div class="abs" style="left:1000px;top:570px;width:820px;height:300px">{photo('studio', 0, 0, 820, 300, .5, .5)}<div class="abs" style="inset:0;background:rgba(28,27,25,.35)"></div><div class="abs" style="left:250px;top:115px">{logo(320, 'white')}</div></div>
<div class="abs cap" style="left:1000px;top:884px">White over photography · on a calm, darkened area only</div>
{mis}
{foot(1, 'Logo')}</div>'''


def colour_page():
    sw = [(CHAR, 'Charcoal Ink', 'Text, buttons, dark bands', IVORY), (IVORY, 'Ivory', 'Page canvas', CHAR),
          (BONE, 'Bone', 'Cards, alt sections', CHAR), (WHITE, 'White', 'Logo and text on dark', CHAR),
          (SAND, 'Sand', 'Tints, dividers, ghost numbers', CHAR), (TAUPE, 'Taupe', 'Secondary text on dark', CHAR),
          (TERRA, 'Terracotta', 'Accent, eyebrows, links', IVORY), (GREY, 'Warm Grey', 'Body copy, captions', IVORY)]
    cells = ''.join(f'''<div class="abs" style="left:{96 + (i % 4) * 438}px;top:{300 + (i // 4) * 300}px;width:414px;height:276px;background:{c};border:1px solid {'#E3DACB' if c in (IVORY, WHITE, BONE) else c};padding:28px;display:flex;flex-direction:column;justify-content:flex-end;color:{t}">
<div class="h" style="font-size:30px;color:{t}">{n}</div><div style="font-size:15px;margin-top:8px;letter-spacing:.12em">{c}</div><div style="font-size:14px;margin-top:6px;opacity:.8">{u}</div></div>''' for i, (c, n, u, t) in enumerate(sw))
    ratio = f'''<div class="abs" style="left:96px;top:930px;width:1728px;height:28px;display:flex">
<div style="width:70%;background:{BONE};border:1px solid #E3DACB"></div><div style="width:20%;background:{CHAR}"></div><div style="width:6%;background:{SAND}"></div><div style="width:4%;background:{TERRA}"></div></div>
<div class="abs cap" style="left:96px;top:972px">Ratio · ~70% Ivory and Bone · 20% Charcoal · 10% Sand and Terracotta · one accent per composition · no gradients</div>'''
    return f'''<div class="page" id="colour">
{head(2, 'Colour', 'Warm neutrals, <em>one</em> accent')}
<div class="abs body" style="left:1000px;top:130px;width:820px">Sampled from the studio itself: cream walls, pale wood, black reformer upholstery. Keep grounds light and calm, let Charcoal carry the type, and save Terracotta for one detail.</div>
{cells}{ratio}
{foot(2, 'Colour')}</div>'''


def type_page():
    rows = [('Display · Playfair Display 400 · 64/1.05', f'<div class="h" style="font-size:64px">Reformer Pilates, <em>redefined</em></div>'),
            ('H2 · Playfair Display 500 · 38/1.15', f'<div class="h" style="font-size:38px;font-weight:500">Your space to move, breathe and reset</div>'),
            ('H3 · Playfair Display 500 · 24/1.3', f'<div class="h" style="font-size:24px;font-weight:500">Three signature class styles</div>'),
            ('Eyebrow · Lato 700 · 13 · .35em', '<div class="eyebrow" style="font-size:13px">Welcome to Studio Glide</div>'),
            ('Body · Lato 400 · 17/1.65', '<div class="body" style="font-size:17px;max-width:760px">A bright, dynamic space dedicated to movement, designed for all levels and combining precision, power and a modern approach to fitness.</div>'),
            ('Caption · Lato 400 · 13/1.5', '<div class="small" style="font-size:13px">53 Station Road East, Oxted, RH8 0AX</div>')]
    body = ''.join(f'<div style="display:flex;gap:40px;align-items:baseline;padding:22px 0;border-top:1px solid {SAND}"><div class="cap" style="width:300px;flex:none">{l}</div>{s}</div>' for l, s in rows)
    return f'''<div class="page" id="type">
<div class="abs" style="left:0;top:0;width:620px;height:1080px;background:{CHAR}"></div>
<div class="abs" style="left:96px;top:96px;width:460px"><div class="eyebrow" style="color:{TAUPE}">03 · Typography</div>
<div class="h" style="font-size:200px;color:{IVORY};margin-top:40px">Aa</div>
<div class="h" style="font-size:40px;color:{IVORY};margin-top:10px">Playfair Display</div><div style="color:{TAUPE};font-size:16px;margin-top:8px">Titles and display. One italic word per headline.</div>
<div style="font-family:Lato;font-weight:300;font-size:120px;color:{SAND};margin-top:60px;line-height:1">Aa</div>
<div style="font-family:Lato;font-size:40px;color:{IVORY};margin-top:10px">Lato</div><div style="color:{TAUPE};font-size:16px;margin-top:8px">Body, labels, buttons and UI.</div></div>
<div class="abs" style="left:700px;top:96px;width:1124px">{body}</div>
<div class="abs body" style="left:700px;top:880px;width:1124px;font-size:16px"><b style="color:{CHAR}">Rules.</b> Sentence-case headlines with a single italic serif flourish, never more. Wide-tracked capitals for eyebrows and labels only. Both fonts are free Google Fonts.</div>
{foot(3, 'Typography')}</div>'''


def graphics_page():
    nums = ''.join(f'<div style="display:flex;gap:18px;align-items:flex-start;width:250px"><div class="num" style="font-size:84px">0{i + 1}</div><div class="small" style="padding-top:14px">{t}</div></div>'
                   for i, t in enumerate(['Book your First Time Pass', 'Bring grippy socks', 'Arrive 10 minutes early']))
    return f'''<div class="page bone" id="graphics">
{head(4, 'Graphic elements', 'Arches, hairlines and <em>quiet</em> detail')}
{arch('mirror', 96, 330, 360, 560, .5, .4)}
<div class="abs cap" style="left:96px;top:906px">Arch · echoes the studio mirrors · one per layout</div>
{arch('oxted', 500, 470, 260, 420, .3, .5)}
<div class="abs" style="left:860px;top:330px;width:960px">
  <div class="cap">Buttons · fully rounded · uppercase · .25em tracking</div>
  <div style="display:flex;gap:16px;margin-top:20px">{btn('Book now')}{btn('Learn more', kind='outline')}</div>
  <div style="display:flex;gap:16px;margin-top:16px;background:{CHAR};padding:24px;width:fit-content">{btn('Get the First Time Pass', kind='light')}{btn('View schedule', kind='outline-light')}</div>
  <div class="cap" style="margin-top:44px">Tag pills · outline · tint · charcoal · terracotta</div>
  <div style="display:flex;gap:12px;margin-top:18px">{pill('All levels')}{pill('50 min', 'tint')}{pill('Reformer', 'dark')}{pill('New · Oxted', 'terra')}</div>
  <div class="cap" style="margin-top:44px">Ghost numbers · Sand Playfair for steps</div>
  <div style="display:flex;gap:40px;margin-top:14px">{nums}</div>
  <div class="cap" style="margin-top:36px">Hairline · 1px Terracotta, 110px, between headline and copy</div>
  <div class="rule" style="width:110px;background:{TERRA};margin-top:22px"></div>
</div>
{foot(4, 'Graphic elements')}</div>'''


def photo_page():
    return f'''<div class="page" id="photography">
{head(5, 'Photography', 'Real people, <em>real</em> daylight', w=640)}
<div class="abs body" style="left:96px;top:330px;width:560px">
<p>Natural daylight, cream walls, pale wood and black reformer upholstery. Real clients and instructors mid-movement or mid-laugh.</p>
<p><b style="color:{CHAR}">Do</b> use the studio’s own shoots, keep grades warm and soft, crop close on movement.</p>
<p><b style="color:{CHAR}">Don’t</b> use stock poses, dark moody grades, heavy filters, or text over faces.</p></div>
{photo('lunge', 720, 96, 360, 520, .5, .45)}
{photo('team', 1100, 96, 360, 520, .5, .3)}
{photo('reach', 1480, 96, 344, 520, .5, .4)}
{photo('oxted', 720, 636, 540, 340, .5, .5)}
{photo('laugh', 1280, 636, 260, 340, .5, .35)}
{photo('socks', 1560, 636, 264, 340, .5, .5)}
{foot(5, 'Photography')}</div>'''


def voice_page():
    pairs = [('Your space to move, breathe and reset.', 'Smash your goals at Surrey’s No.1 studio!!'),
             ('Every class is coached for all levels.', 'Don’t worry, it’s super easy, anyone can do it.'),
             ('Small classes, so your instructor sees you.', 'Get your dream body in 6 weeks.'),
             ('Up to 6 classes for £60, new clients.', 'HUGE SALE, LIMITED TIME ONLY 🔥')]
    rows = ''.join(f'<div style="display:flex;border-top:1px solid #3A352E"><div style="width:50%;padding:22px 24px 22px 0;color:{IVORY};font-family:Playfair Display;font-size:24px">{a}</div><div style="width:50%;padding:22px 0 22px 24px;color:{TAUPE};font-size:18px;text-decoration:line-through">{b}</div></div>' for a, b in pairs)
    return f'''<div class="page dark" id="voice">
{head(6, 'Tone of voice', 'Calm, welcoming, <em>confident</em>')}
<div class="abs" style="left:96px;top:370px;width:700px;display:flex;flex-direction:column;gap:30px">
{''.join(f'<div><div class="h" style="font-size:30px">{t}</div><div class="body" style="margin-top:8px;font-size:17px">{d}</div></div>' for t, d in [('Second person, present tense', 'Talk to one person about their hour: “your space to move”.'), ('Triads, not hype', 'Strength · flow · calm. No exclamation marks, no emoji, no superlatives.'), ('Specific and true', 'Real prices, real class sizes, real reviews. No body-transformation or medical claims.'), ('British English', 'Colour, centre, programme. No em dashes in ad copy.')])}
</div>
<div class="abs" style="left:900px;top:370px;width:924px"><div style="display:flex" class="cap"><div style="width:50%;color:{SAND}">We say</div><div style="width:50%;padding-left:24px">We don’t say</div></div><div style="margin-top:16px">{rows}</div></div>
{foot(6, 'Tone of voice')}</div>'''


def apps_page():
    sq = f'''<div class="abs" style="left:96px;top:300px;width:620px;height:620px;background:{CHAR};overflow:hidden">
{photo('stretch', 0, 0, 620, 620, .5, .4)}<div class="abs" style="inset:0;background:linear-gradient(180deg,rgba(28,27,25,0) 35%,rgba(28,27,25,.85) 100%)"></div>
<div class="abs" style="left:40px;top:36px">{logo(170, 'white')}</div>
<div class="abs" style="left:40px;bottom:40px;width:540px"><div class="eyebrow" style="color:{SAND};font-size:11px">Now open in Oxted</div>
<div class="h" style="font-size:50px;color:{IVORY};margin-top:12px">Six classes. <em style="color:{SAND}">Two</em> weeks. £60.</div>
<div style="margin-top:20px">{btn('Get the First Time Pass', 11, 'light')}</div></div></div>
<div class="abs cap" style="left:96px;top:936px">Meta feed · 1:1</div>'''
    story = f'''<div class="abs" style="left:780px;top:300px;width:349px;height:620px;background:{IVORY};overflow:hidden">
<div class="abs" style="left:0;right:0;top:40px;display:flex;justify-content:center">{logo(130)}</div>
{arch('mirror', 60, 120, 229, 300, .5, .4)}
<div class="abs" style="left:28px;right:28px;top:440px;text-align:center"><div class="h" style="font-size:28px">Never tried <em>Reformer</em>?</div>
<div class="small" style="font-size:12px;margin-top:8px">Every class is coached for all levels.</div><div style="margin-top:14px">{btn('Book now', 9)}</div></div></div>
<div class="abs cap" style="left:780px;top:936px">Story · 9:16</div>'''
    lp = f'''<div class="abs" style="left:1190px;top:300px;width:634px;height:620px;background:{BONE};overflow:hidden">
<div class="abs" style="left:0;right:0;top:0;height:56px;background:{IVORY};display:flex;align-items:center;justify-content:space-between;padding:0 28px">{logo(120)}{btn('Book', 9)}</div>
{photo('oxted', 0, 56, 634, 300, .5, .5)}
<div class="abs" style="left:40px;top:384px;width:554px"><div class="eyebrow" style="font-size:11px">Oxted · new clients</div>
<div class="h" style="font-size:36px;margin-top:12px">Your First Time <em>Pass</em></div>
<div class="small" style="margin-top:10px">Up to 6 classes for £60 within 2 weeks. Reformer, Mat and Barre.</div>
<div style="display:flex;gap:10px;margin-top:18px">{pill('50 min')}{pill('6 to 8 per class', 'tint')}{pill('All levels', 'dark')}</div></div></div>
<div class="abs cap" style="left:1190px;top:936px">Landing page hero</div>'''
    return f'''<div class="page" id="applications">
{head(7, 'Example applications', 'Putting it <em>together</em>', w=900)}
{sq}{story}{lp}
{foot(7, 'Example applications')}</div>'''


PAGES = [cover, logo_page, colour_page, type_page, graphics_page, photo_page, voice_page, apps_page]

html = f'''<!doctype html><html><head><meta charset="utf-8"><title>Studio Glide brand guideline</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Lato:ital,wght@0,300;0,400;0,700;1,400&display=swap" rel="stylesheet">
<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>
<style>{CSS}</style></head><body>
{''.join(p() for p in PAGES)}
</body></html>'''
(HERE / 'guideline.html').write_text(html)
print('guideline.html', len(PAGES), 'pages')
