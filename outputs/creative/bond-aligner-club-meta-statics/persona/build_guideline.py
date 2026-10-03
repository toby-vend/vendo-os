"""Bond Aligner Club brand guideline: HTML harness for Figma capture.

Look and layout follow Bond Dental's own Brand Kit (July 2026): photo-led editorial pages,
huge heavy uppercase headlines, black and white panels. Type is Inter (as bonddental.co.uk),
set heavy and tight for headlines in place of the kit's Agrandir Heavy. Palette and content
come from the Bond Aligner Club pitch deck v4 (Drive folder 1i_7qHvKPPUYcDb1WoJ7cPUddj6jTtVQ2).
Logos are Chaz's official vectors. Photos are the landing page's own (assets/photos, gitignored).

Usage: python3 build_guideline.py  ->  guideline.html (and guideline-capture.html for Figma)
"""
import re
from pathlib import Path

HERE = Path(__file__).parent
LOGO = HERE / 'assets' / 'logo'

GOLD, DEEP, LIGHT, BLACK, IVORY, WHITE = '#D2B477', '#B99352', '#E5CC98', '#0B0B0B', '#F6F1E8', '#FFFFFF'

_n = 0


def svg(name, width):
    """Inline an official logo SVG, prefixing ids so repeated instances don't collide."""
    global _n
    _n += 1
    p = f'l{_n}-'
    s = (LOGO / f'{name}.svg').read_text()
    s = re.sub(r'<\?xml[^>]*\?>', '', s)
    s = re.sub(r'id="([^"]+)"', lambda m: f'id="{p}{m.group(1)}"', s)
    s = re.sub(r'(xlink:href|href)="#([^"]+)"', lambda m: f'{m.group(1)}="#{p}{m.group(2)}"', s)
    s = re.sub(r'url\(#([^)]+)\)', lambda m: f'url(#{p}{m.group(1)})', s)
    w, h = (float(x) for x in re.search(r'width="([\d.]+)" height="([\d.]+)"', s).groups())
    s = re.sub(r'width="[\d.]+" height="[\d.]+"', f'width="{width}" height="{round(width * h / w, 1)}" style="display:block"', s, count=1)
    return s.strip()


CSS = f"""
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=block');
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:#3a3a3a;font-family:'Inter',sans-serif;color:{BLACK};display:flex;flex-direction:column;gap:120px;padding:120px;width:2160px;-webkit-font-smoothing:antialiased}}
.page{{position:relative;width:1920px;height:1080px;overflow:hidden;background:{BLACK};color:{WHITE}}}
.white{{background:{WHITE};color:{BLACK}}}
.abs{{position:absolute}}
.display{{font-weight:900;text-transform:uppercase;letter-spacing:-.065em;line-height:.84}}
.h3{{font-weight:700;font-size:30px;letter-spacing:-.01em;line-height:1.2}}
.body{{font-size:19px;line-height:1.5}}
.body p+p{{margin-top:14px}}
.body b{{font-weight:700}}
.label{{font-weight:500;font-size:15px;letter-spacing:.18em;text-transform:uppercase}}
.gold{{color:{GOLD}}} .deep{{color:{DEEP}}}
.img{{position:absolute;overflow:hidden;border-radius:8px}}
.img img{{width:100%;height:100%;object-fit:cover;display:block}}
.full{{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}}
.foot{{position:absolute;left:70px;right:70px;bottom:48px;display:flex;justify-content:space-between}}
ul.b{{list-style:none}} ul.b li{{position:relative;padding-left:22px;margin-top:6px}}
ul.b li:before{{content:'';position:absolute;left:4px;top:.62em;width:6px;height:6px;border-radius:50%;background:currentColor}}
.card{{background:{WHITE};color:{BLACK};border-radius:14px}}
.pill{{display:inline-flex;align-items:center;height:58px;padding:0 34px;border-radius:999px;font-weight:600;font-size:18px;letter-spacing:.02em}}
"""


def page(cls, body):
    return f'<section class="page {cls}">{body}</section>'


def img(src, x, y, w, h, pos='50% 50%', r=8):
    return f'<div class="img" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;border-radius:{r}px"><img src="assets/photos/{src}" style="object-position:{pos}"></div>'


def cover():
    return page('', f"""
<img class="full" src="assets/photos/gs-clinic-marylebone.jpg" style="object-position:50% 60%">
<div class="abs" style="inset:0;background:rgba(11,11,11,.78)"></div>
<div class="abs" style="left:0;right:0;top:330px;display:flex;flex-direction:column;align-items:center">
  {svg('lockup-gold', 620)}
  <div class="label" style="margin-top:46px;color:{WHITE};letter-spacing:.32em">by Bond Dental London</div>
</div>
<div class="foot label" style="color:{WHITE}"><span>www.bonddental.co.uk</span><span>Brand guidelines</span></div>
""")


def intro():
    return page('', f"""
<div class="abs" style="left:70px;top:270px;width:480px">
  <div class="h3">What Bond Aligner Club is</div>
  <div class="body" style="margin-top:24px;color:rgba(255,255,255,.86)">
    <p>Bond Aligner Club is a sub-brand of Bond Dental London, offering Invisalign across London clinics at four clear, transparent price points starting from £995.</p>
    <p>It is not a separate company, a discount spin-off or a different clinical standard.</p>
    <p><b>It is the same Invisalign, delivered by the same Bond Dental clinicians, priced more accessibly.</b></p>
    <p>Same clinicians. Same clinics. Clearer pricing.</p>
  </div>
</div>
{img('bac-step-2b.webp', 620, 30, 1270, 1020, '50% 30%', 10)}
<div class="abs" style="left:620px;top:30px;width:1270px;height:1020px;border-radius:10px;background:linear-gradient(180deg,rgba(11,11,11,0) 40%,rgba(11,11,11,.75) 100%)"></div>
<div class="abs display" style="left:672px;top:500px;font-size:168px;color:{WHITE}">Quality.<br>Premium.<br>Affordable.</div>
<div class="abs h3" style="left:676px;top:955px;font-size:34px;color:{GOLD}">Your values aligned with ours.</div>
""")


def logo():
    misuse = [
        ("Don't recolour", 'filter:hue-rotate(170deg) saturate(2.4)'),
        ("Don't rotate", 'transform:rotate(-14deg)'),
        ("Don't stretch", 'transform:scaleX(1.5)'),
        ("Don't add effects", 'filter:drop-shadow(5px 7px 0 #8a6a35)'),
    ]
    tiles = ''.join(f"""
<div style="width:250px">
  <div style="height:150px;border-radius:8px;background:{BLACK};display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden">
    <div style="{css}">{svg('lockup-gold', 160)}</div>
    <div style="position:absolute;left:-30px;right:-30px;top:50%;height:3px;background:#C0392B;transform:rotate(-31deg)"></div>
  </div>
  <div class="label" style="margin-top:12px;font-size:13px">{t}</div>
</div>""" for t, css in misuse)
    return page('', f"""
<div class="abs" style="left:70px;top:70px;width:560px">
  <div class="h3">Logo &amp; lockup</div>
  <div class="body" style="margin-top:22px;color:rgba(255,255,255,.86)">
    <p>Use the full lockup wherever space allows. The mark alone is for small placements only, like avatars and favicons.</p>
    <p>Always show the <b>"by Bond Dental London"</b> endorsement alongside the logo.</p>
    <p>Keep clear space at least the height of the mark. Never recolour, rotate, stretch or add effects.</p>
  </div>
</div>
<div class="abs display" style="left:62px;bottom:60px;font-size:250px">Logo</div>
<div class="abs" style="left:760px;top:0;width:1160px;height:1080px;background:{WHITE};color:{BLACK}">
  <div class="abs" style="left:70px;top:70px;display:flex;gap:24px">
    <div><div style="width:500px;height:300px;border-radius:8px;background:{BLACK};display:flex;align-items:center;justify-content:center">{svg('lockup-gold', 300)}</div>
      <div class="label" style="margin-top:12px;font-size:13px">Primary · gold on black</div></div>
    <div><div style="width:500px;height:300px;border-radius:8px;background:{WHITE};border:1px solid rgba(11,11,11,.14);display:flex;align-items:center;justify-content:center">{svg('lockup-black', 300)}</div>
      <div class="label" style="margin-top:12px;font-size:13px">Secondary · black on light</div></div>
  </div>
  <div class="abs" style="left:70px;top:440px;display:flex;gap:24px">
    <div><div style="width:238px;height:238px;border-radius:8px;background:{BLACK};display:flex;align-items:center;justify-content:center">{svg('mark-gold', 110)}</div>
      <div class="label" style="margin-top:12px;font-size:13px">Mark · small use</div></div>
    <div><div style="width:238px;height:238px;border-radius:8px;background:{GOLD};display:flex;align-items:center;justify-content:center">{svg('mark-black', 110)}</div>
      <div class="label" style="margin-top:12px;font-size:13px">Mark on gold</div></div>
    <div><div style="width:500px;height:238px;border-radius:8px;border:1px dashed {DEEP};display:flex;align-items:center;justify-content:center">
      <div style="padding:34px;border:1px solid rgba(185,147,82,.6)">{svg('mark-black', 66)}</div></div>
      <div class="label" style="margin-top:12px;font-size:13px">Clear space = height of the mark</div></div>
  </div>
  <div class="abs" style="left:70px;top:780px;display:flex;gap:20px">{tiles}</div>
</div>
""")


def colour():
    sw = [
        ('Champagne Gold', GOLD, 'Lead colour. Carries most of the colour weight.', ''),
        ('Deeper Gold', DEEP, 'Text and accents on light backgrounds.', ''),
        ('Light Gold', LIGHT, 'Highlights and lighter sections only.', ''),
        ('Black', BLACK, 'Premium anchor.', ''),
        ('Warm Ivory', IVORY, 'Neutral background.', 'border:1px solid rgba(11,11,11,.18);'),
    ]
    rows = ''.join(f"""
<div style="display:flex;align-items:center;gap:30px;margin-top:{0 if i == 0 else 26}px">
  <div style="width:118px;height:118px;border-radius:50%;background:{hx};{extra}flex:none"></div>
  <div><div style="font-weight:700;font-size:26px">{n}</div>
    <div class="label deep" style="margin-top:6px;font-size:14px">HEX {hx}</div>
    <div class="body" style="font-size:17px;margin-top:4px;color:rgba(11,11,11,.7)">{r}</div></div>
</div>""" for i, (n, hx, r, extra) in enumerate(sw))
    return page('', f"""
{img('bac-step-1.webp', 50, 60, 520, 560, '42% 50%')}
{img('bac-kev-cutout.webp', 600, 60, 520, 560, '50% 16%')}
<div class="abs label gold" style="left:50px;top:640px;font-size:13px">(01)</div>
<div class="abs label gold" style="left:600px;top:640px;font-size:13px">(02)</div>
<div class="abs display" style="left:40px;top:700px;font-size:250px">Colour</div>
<div class="abs body" style="left:50px;top:960px;width:1060px;color:rgba(255,255,255,.75)">Three golds give depth, black is the premium anchor and warm ivory is the neutral. Champagne Gold carries most of the colour.</div>
<div class="abs" style="left:1180px;top:0;width:740px;height:1080px;background:{WHITE};color:{BLACK};padding:92px 70px">{rows}</div>
""")


def type_():
    return page('white', f"""
<div class="abs" style="left:70px;top:70px">
  <div class="display" style="font-size:520px;letter-spacing:-.07em;text-transform:none">Aa</div>
  <div class="h3" style="margin-top:34px;font-size:40px">Inter</div>
  <div class="body" style="margin-top:12px;width:620px;color:rgba(11,11,11,.72)">The same family as bonddental.co.uk. Black weight, uppercase and tightly set for headlines. Regular and Bold for everything else.</div>
  <div style="margin-top:34px;font-size:26px;line-height:1.45;color:rgba(11,11,11,.8)">ABCDEFGHIJKLMNOPQRSTUVWXYZ<br>abcdefghijklmnopqrstuvwxyz<br>0123456789 £ % &amp; ? !</div>
</div>
<div class="abs" style="left:900px;top:0;width:1020px;height:1080px;background:{BLACK};color:{WHITE};padding:90px 80px">
  <div class="label gold">Headline · Inter Black · caps · tracking −6.5%</div>
  <div class="display" style="font-size:130px;margin-top:22px">The real<br>Invisalign.</div>
  <div class="label gold" style="margin-top:60px">Subhead · Inter Bold · 30–40px</div>
  <div class="h3" style="margin-top:16px;font-size:40px">Your values aligned with ours.</div>
  <div class="label gold" style="margin-top:56px">Body · Inter Regular · 18–20px · 150%</div>
  <div class="body" style="margin-top:16px;color:rgba(255,255,255,.86);width:760px">Four clear prices, from £995. The same Invisalign, delivered by the same Bond Dental clinicians, priced more accessibly.</div>
  <div class="label gold" style="margin-top:56px">Label · Inter Medium · caps · tracking +18%</div>
  <div class="label" style="margin-top:16px;font-size:18px">by Bond Dental London</div>
</div>
""")


def photography():
    return page('', f"""
{img('bac-step-3.webp', 0, 0, 760, 1080, '50% 40%', 0)}
{img('gs-clinic-marylebone.jpg', 780, 0, 1140, 520, '50% 60%', 0)}
{img('clinic-mayfair.webp', 780, 540, 560, 540, '50% 50%', 0)}
{img('bac-film-poster.jpg', 1360, 540, 560, 540, '50% 40%', 0)}
<div class="abs" style="left:0;top:0;width:760px;height:1080px;background:linear-gradient(180deg,rgba(11,11,11,0) 40%,rgba(11,11,11,.7) 100%)"></div>
<div class="abs display" style="left:48px;bottom:250px;font-size:150px">Photo-<br>graphy</div>
<div class="abs card" style="left:48px;bottom:48px;width:664px;padding:26px 30px;display:flex;gap:30px">
  <div style="flex:1"><div class="label deep" style="font-size:13px">Do</div><div class="body" style="font-size:16px;margin-top:6px">Real people, natural light, candid close-crop smiles. Real Bond clinics and the club kit.</div></div>
  <div style="flex:1"><div class="label deep" style="font-size:13px">Don't</div><div class="body" style="font-size:16px;margin-top:6px">Glossy stock smiles. Before-and-afters without a consented case.</div></div>
</div>
""")


def voice():
    return page('', f"""
<img class="abs" src="assets/photos/gs-bac-step-1.jpg" style="left:0;top:0;width:1240px;height:1080px;object-fit:cover;object-position:40% 50%">
<div class="abs" style="left:0;top:0;width:1240px;height:1080px;background:rgba(11,11,11,.5)"></div>
<div class="abs display" style="left:48px;top:330px;font-size:165px">Brand voice</div>
<div class="abs" style="left:48px;top:560px;width:560px">
  <div class="h3">We sound</div>
  <ul class="b body" style="margin-top:14px;color:rgba(255,255,255,.9)">
    <li>Professional, warm, honest, modern, expert and calm</li>
    <li>Built on three pillars: Quality, Premium and Affordable. Every message leads with at least one</li>
    <li>Premium, never pressure. No hard sell, urgency or discount framing</li>
    <li>Clear. "You'll never leave wondering." Prices and claims stay substantiated</li>
  </ul>
</div>
<div class="abs" style="left:680px;top:560px;width:500px">
  <div class="h3">We never</div>
  <ul class="b body" style="margin-top:14px;color:rgba(255,255,255,.9)">
    <li>Imply a discount or budget version of Bond Dental</li>
    <li>Claim "most popular" or "best in London" without data</li>
    <li>Use "main character" or gimmick-led humour</li>
    <li>Alter the logo or quote prices loosely</li>
  </ul>
</div>
<div class="abs" style="left:1240px;top:0;width:680px;height:1080px;background:{WHITE}"></div>
{img('bac-story-poster-v3e.webp', 1400, 110, 360, 420, '50% 22%')}
{img('bac-step-2b.webp', 1400, 550, 360, 420, '55% 30%')}
""")


def pillars():
    cols = [
        ('Quality', 'Patients get genuine, high-quality Invisalign.',
         ['The real Invisalign', 'Delivered by Bond Dental clinicians', 'Personalised treatment plan simulation']),
        ('Premium', 'Treatment through Bond Dental, in premium Central London clinics, with a premium level of service and care.',
         ['Bond Dental\'s own London clinics', 'Complimentary dental health assessment', 'Starter aligner kit and member benefits']),
        ('Affordable', 'Invisalign made accessible at a genuinely competitive price, with affordable payment options.',
         ['Four clear prices from £995', '0% finance over up to 36 months', 'Members get 10% off general treatments at Bond Dental']),
    ]
    cards = ''.join(f"""<div style="flex:1">
  <div class="display" style="font-size:64px;letter-spacing:-.05em">{t}</div>
  <div class="body" style="font-size:18px;margin-top:14px;color:rgba(11,11,11,.8)">{d}</div>
  <ul class="b body" style="font-size:16px;margin-top:12px;color:rgba(11,11,11,.7)">{''.join(f'<li>{x}</li>' for x in pts)}</ul>
</div>""" for t, d, pts in cols)
    return page('', f"""
<img class="full" src="assets/photos/clinic-mayfair.webp" style="object-position:50% 50%">
<div class="abs" style="inset:0;background:linear-gradient(90deg,rgba(11,11,11,.6) 0%,rgba(11,11,11,0) 65%)"></div>
<div class="abs display" style="left:70px;top:90px;font-size:190px">Three<br>pillars</div>
<div class="abs h3" style="left:74px;top:425px;font-size:34px;color:{WHITE}">Your values aligned with ours.</div>
<div class="abs card" style="left:70px;right:70px;bottom:60px;padding:40px 44px;display:flex;gap:50px">{cards}</div>
""")


def audience_card(cols):
    return ''.join(f"""<div style="flex:1"><div style="font-weight:700;font-size:17px">{h}</div>
<ul class="b body" style="font-size:15px;margin-top:6px;color:rgba(11,11,11,.78)">{''.join(f'<li>{x}</li>' for x in items)}</ul></div>""" for h, items in cols)


def audience_primary():
    cols = [
        ('Who they are', ['Women 25 to 44, strongest at 25 to 34', 'Working professionals in London', 'Live on their phone: selfies, socials, trends']),
        ('What they value', ['The real Invisalign, not a lookalike', 'A premium clinic they can trust', 'A clear price they can plan around']),
        ('What holds them back', ['Not knowing who to trust', 'Worry that cheaper means a worse result', 'Not knowing which option is right']),
        ('How we speak to them', ['Relatable, everyday, UGC-style imagery', 'Aspirational but never out of reach', 'Lead with a pillar, name Invisalign']),
    ]
    return page('', f"""
<img class="full" src="assets/photos/bac-step-3.webp" style="object-position:50% 28%">
<div class="abs" style="inset:0;background:linear-gradient(90deg,rgba(11,11,11,.65) 0%,rgba(11,11,11,0) 60%)"></div>
<div class="abs display" style="left:70px;top:90px;font-size:190px">Target<br>audience</div>
<div class="abs card" style="left:70px;right:70px;bottom:60px;padding:32px 40px">
  <div class="h3" style="font-size:24px">Primary: <span style="font-weight:400">The Aspirational Professional</span></div>
  <div style="display:flex;gap:36px;margin-top:20px">{audience_card(cols)}</div>
</div>
""")


def audience_secondary():
    a = [('Who they are', ['Mild cases, often one or two crooked teeth', 'Would love straighter teeth but think theirs "aren\'t bad enough"', 'Put off by a single high price']),
         ('How we speak to them', ['Show Express and Lite: treatment sized to them', 'Four clear prices from £995', 'Complimentary assessment tells them what they need'])]
    b = [('Who they are', ['Price-aware, but want it done right', 'Have seen cheap aligners and expensive ones', 'Want to feel they\'re in a safe place']),
         ('How we speak to them', ['Quality first: genuine Invisalign, Bond Dental clinicians', 'Premium clinics, transparent pricing', 'Never "the cheapest dentist"'])]
    def block(title, cols):
        return f"""<div style="flex:1;background:{WHITE};color:{BLACK};border-radius:14px;padding:32px 36px">
  <div class="h3" style="font-size:24px">{title}</div>
  <div style="display:flex;gap:30px;margin-top:18px">{audience_card(cols)}</div></div>"""
    return page('', f"""
<img class="abs" src="assets/photos/bac-hero-girl-selfie.webp" style="right:0;top:0;height:780px;width:974px;object-fit:cover;object-position:50% 30%">
<div class="abs display" style="left:70px;top:90px;font-size:150px">Secondary<br>audiences</div>
<div class="abs" style="left:70px;right:70px;bottom:60px;display:flex;gap:24px">
  {block('The "Not Bad Enough" Improver', a)}
  {block('The Careful Investor', b)}
</div>
""")


def targeting():
    rows = [
        ('Where', 'Ads talk about all Bond Dental London clinics. At launch, consultations are booked at Marylebone only, so targeting centres on Marylebone.'),
        ('Who', 'New patients. Cold audiences, split by audience and offer type.'),
        ('Not the focus', 'Existing Bond Dental patients. Don\'t lead with existing-patient offers, and never alienate patients who paid full price.'),
        ('Creators', 'UGC and partnership creators bring their own communities. Match the creator to the audience.'),
    ]
    rl = ''.join(f"""<div style="display:flex;gap:30px;padding:20px 0;border-top:1px solid rgba(11,11,11,.14)">
<div class="label deep" style="width:170px;flex:none;font-size:14px;padding-top:4px">{k}</div><div class="body" style="font-size:19px">{v}</div></div>""" for k, v in rows)
    must = ['Name Invisalign. People know it, and it is the real thing',
            'Lead with Quality, Premium or Affordable',
            'Make it feel like a club: membership, benefits, community',
            'Keep Bond Aligner Club separate from Bond Dental\'s own Invisalign offer',
            'Never position it as the cheapest dentist']
    ml = ''.join(f'<li>{x}</li>' for x in must)
    return page('', f"""
<div class="abs display" style="left:66px;top:80px;font-size:122px">Targeting</div>
<div class="abs" style="left:70px;top:330px;width:560px">
  <div class="h3">Every ad should</div>
  <ul class="b body" style="margin-top:14px;color:rgba(255,255,255,.88)">{ml}</ul>
</div>
<div class="abs" style="left:760px;top:0;width:1160px;height:1080px;background:{WHITE};color:{BLACK};padding:90px 80px">
  {rl}
  <div style="border-top:1px solid rgba(11,11,11,.14)"></div>
</div>
{img('clinic-marylebone.webp', 840, 690, 1000, 320, '50% 55%')}
<div class="abs label deep" style="left:840px;top:1022px;font-size:12px">Marylebone · the launch clinic</div>
""")


def pricing():
    tiers = [('Express', '£995', 'Up to 7 aligners'), ('Lite', '£1,995', 'Up to 14 aligners'),
             ('Moderate', '£2,995', 'Up to 20 aligners'), ('Comprehensive', '£3,595', 'Unlimited aligners')]
    tl = ''.join(f"""<div style="flex:1;padding:24px 26px;border-radius:10px;background:{BLACK};color:{WHITE}">
<div class="label gold" style="font-size:13px">{n}</div><div class="display" style="font-size:72px;margin-top:14px;letter-spacing:-.05em">{p}</div>
<div class="body" style="font-size:16px;margin-top:10px;color:rgba(255,255,255,.75)">{d}</div></div>""" for n, p, d in tiers)
    perks = ['Complimentary dental health assessment', 'Members get 10% off general treatments at Bond Dental',
             'Complimentary whitening on Moderate and Comprehensive', 'One set of complimentary retainers',
             'Starter aligner kit', 'Personalised treatment plan simulation']
    pl = ''.join(f'<li>{p}</li>' for p in perks)
    return page('white', f"""
<div class="abs display" style="left:70px;top:70px;font-size:190px">Four plans.</div>
<div class="abs body" style="left:74px;top:250px;width:760px;color:rgba(11,11,11,.72)">Always quote prices exactly as below. The four-tier structure is core to the brand's transparency promise. 0% finance is available on all tiers over up to 36 months.</div>
<div class="abs" style="left:70px;top:380px;width:1100px;display:flex;gap:16px">{tl}</div>
<div class="abs" style="left:70px;top:640px;width:1100px">
  <div class="h3">Club benefits</div>
  <ul class="b body" style="margin-top:12px;columns:2;column-gap:40px">{pl}</ul>
  <div class="body" style="margin-top:26px;font-size:15px;color:rgba(11,11,11,.55)">Monthly figures are left off until they're checked against the lender's illustration.</div>
</div>
{img('bac-step-1.webp', 1240, 70, 610, 940, '30% 50%', 10)}
""")


def live():
    ads = [('31', 'Quiet luxury, three pillars'), ('32', "Members' club, values aligned"), ('33', 'Champagne gold foil pillars'),
           ('34', 'Bond minimal, three columns'), ('35', 'Soft lifestyle pillars'), ('40', 'Aligned on what matters'),
           ('09', 'Not a lookalike'), ('18', "Four prices, which one's yours")]
    tiles = ''.join(f"""<div style="width:380px"><div style="width:380px;height:380px;border-radius:6px;overflow:hidden"><img src="assets/live/bac-{n}.jpg" style="width:100%;height:100%;display:block"></div>
<div class="label" style="font-size:12px;margin-top:10px;color:rgba(255,255,255,.75)"><span class="gold">BAC-{n}</span> · {t}</div></div>""" for n, t in ads)
    return page('', f"""
<div class="abs display" style="left:70px;top:60px;font-size:150px">In use</div>
<div class="abs body" style="left:740px;top:80px;width:1100px;color:rgba(255,255,255,.75)">Live Bond Aligner Club Meta statics built around the three pillars. Square versions shown; each also runs in 4:5 and 9:16.</div>
<div class="abs" style="left:70px;top:230px;width:1780px;display:flex;flex-wrap:wrap;gap:36px 86px">{tiles}</div>
""")


def applications():
    feed = f"""
<div class="abs" style="left:70px;top:260px;width:680px;height:680px;border-radius:6px;overflow:hidden;background:{BLACK}">
  <img class="full" src="assets/photos/bac-step-3.webp" style="object-position:50% 30%">
  <div class="abs" style="inset:0;background:linear-gradient(180deg,rgba(11,11,11,.75) 0%,rgba(11,11,11,0) 26%,rgba(11,11,11,0) 45%,rgba(11,11,11,.85) 100%)"></div>
  <div class="abs" style="left:40px;top:36px">{svg('lockup-gold', 150)}</div>
  <div class="abs label" style="left:40px;bottom:318px;font-size:13px;color:{GOLD}">Affordable</div>
  <div class="abs display" style="left:36px;bottom:120px;font-size:100px">Invisalign<br>from £995.</div>
  <div class="abs" style="left:40px;bottom:40px;display:flex;align-items:center;gap:18px"><span class="pill" style="height:50px;font-size:16px;background:{GOLD};color:{BLACK}">See the four plans</span><span class="label" style="font-size:12px">by Bond Dental London</span></div>
</div>
<div class="abs label gold" style="left:70px;top:962px;font-size:13px">Meta feed · 1:1</div>"""
    story = f"""
<div class="abs" style="left:800px;top:260px;width:383px;height:680px;border-radius:6px;overflow:hidden;background:{BLACK}">
  <img class="full" src="assets/photos/gs-clinic-marylebone.jpg" style="object-position:55% 50%">
  <div class="abs" style="inset:0;background:linear-gradient(180deg,rgba(11,11,11,.85) 0%,rgba(11,11,11,.4) 22%,rgba(11,11,11,0) 38%,rgba(11,11,11,0) 50%,rgba(11,11,11,.9) 100%)"></div>
  <div class="abs" style="left:28px;top:80px">{svg('lockup-gold', 120)}</div>
  <div class="abs label" style="left:28px;bottom:308px;font-size:11px;color:{GOLD}">Premium</div>
  <div class="abs display" style="left:26px;bottom:150px;font-size:50px">Premium<br>London<br>clinics.</div>
  <div class="abs label" style="left:28px;bottom:110px;font-size:11px;color:{GOLD}">Marylebone · by Bond Dental London</div>
</div>
<div class="abs label gold" style="left:800px;top:962px;font-size:13px">Meta story · 9:16</div>"""
    card = f"""
<div class="abs" style="left:1233px;top:260px;width:617px;height:680px;border-radius:6px;overflow:hidden;background:{WHITE};color:{BLACK};padding:44px">
  {svg('lockup-black', 140)}
  <div class="label deep" style="margin-top:40px;font-size:13px">Quality</div>
  <div class="display" style="font-size:88px;margin-top:14px">The real<br>Invisalign.</div>
  <div class="h3" style="margin-top:20px">Quality you can trust.</div>
  <div class="body" style="margin-top:14px;width:470px;color:rgba(11,11,11,.72)">Genuine Invisalign, delivered by Bond Dental clinicians in premium Central London clinics.</div>
  <div class="pill" style="position:absolute;left:44px;bottom:44px;background:{BLACK};color:{WHITE}">Book your assessment</div>
</div>
<div class="abs label gold" style="left:1233px;top:962px;font-size:13px">Feed · light variant</div>"""
    return page('', f"""
<div class="abs display" style="left:70px;top:60px;font-size:160px">New look</div>
<div class="abs label gold" style="left:76px;top:205px;font-size:14px">Ad examples in the guideline style</div>
{feed}{story}{card}
""")


def close():
    return page('', f"""
<img class="full" src="assets/photos/gs-clinic-mayfair.jpg" style="object-position:50% 50%">
<div class="abs" style="inset:0;background:rgba(11,11,11,.66)"></div>
<div class="abs display" style="left:0;right:0;top:250px;text-align:center;font-size:210px">Quality.<br>Premium.<br>Affordable.</div>
<div class="abs h3" style="left:0;right:0;top:850px;text-align:center;font-size:40px;color:{GOLD}">Your values aligned with ours.</div>
<div class="foot label" style="color:{WHITE}"><span>www.bonddental.co.uk</span><span>by Bond Dental London</span></div>
""")


def main():
    pages = [cover(), intro(), logo(), colour(), type_(), photography(), voice(), pillars(), audience_primary(), audience_secondary(), targeting(), pricing(), live(), applications(), close()]
    head = f'<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>Bond Aligner Club Brand Guidelines</title><style>{CSS}</style>'
    body = f'</head><body>{"".join(pages)}</body></html>'
    (HERE / 'guideline.html').write_text(head + body)
    (HERE / 'guideline-capture.html').write_text(head + '<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>' + body)
    print('pages', len(pages))


if __name__ == '__main__':
    main()
