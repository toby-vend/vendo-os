"""Section B: Quality (BAC-06 to BAC-10), v2."""
import math
from lib2 import *


def two_line_head(tone, sans_text, serif_text, s1, s2, align='left', serif_first=False):
    c = GOLD if tone == 'gold' else BLACK
    a = f'<div style="{SANS} font-weight: 800; font-size: {s1}px; line-height: 0.92; letter-spacing: -0.035em; color: {c}; text-align: {align};">{sans_text}</div>'
    b = f'<div style="{SERIF} font-size: {s2}px; line-height: 0.98; letter-spacing: -0.01em; color: {c}; text-align: {align}; margin-top: 4px;">{serif_text}</div>'
    return (b + a) if serif_first else (a + b)


# ---------- BAC-06: end credits ----------
def sprockets(h, side, w=58):
    holes = ''.join(f'<div style="width: 26px; height: 34px; border-radius: 6px; background: rgba(210,183,140,0.16); flex-shrink: 0;"></div>' for _ in range(h // 62 + 1))
    pos = 'left: 0;' if side == 'l' else 'right: 0;'
    edge = 'border-right' if side == 'l' else 'border-left'
    return (f'<div style="position: absolute; top: 0; {pos} width: {w}px; height: {h}px; display: flex; flex-direction: column; align-items: center; gap: 28px; '
            f'padding-top: 14px; box-sizing: border-box; {edge}: 1px solid rgba(210,183,140,0.18); overflow: hidden;">{holes}</div>')


def bac06(f, w, h):
    rows = [('Starring', 'Invisalign'), ('Planned by', 'Bond Dental clinicians'),
            ('On location at', 'Bond Dental London'), ('Stunt doubles', None)]
    rs = v(f, 22, 25, 28)
    ns = v(f, 38, 42, 40)
    credit_rows = ''
    for role, name in rows:
        val = (f'<div style="{SANS} font-weight: 800; font-size: {ns}px; letter-spacing: -0.01em; color: {GOLD}; line-height: 1.1;">{name}</div>' if name else
               f'<div style="position: relative; display: inline-block;"><div style="{SERIF} font-size: {int(ns * 1.6)}px; color: {GOLD}; line-height: 0.9;">None.</div>'
               f'<svg width="100%" height="18" viewBox="0 0 100 18" preserveAspectRatio="none" aria-hidden="true" style="position: absolute; left: -6%; bottom: -14px; width: 112%;">'
               f'<path d="M2 12 C 30 4, 60 16, 98 6" stroke="{GOLD}" stroke-width="3" stroke-linecap="round" fill="none" vector-effect="non-scaling-stroke"/></svg></div>')
        credit_rows += (f'<div style="display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); column-gap: 32px; align-items: baseline;">'
                        f'<div style="text-align: right; {SANS} font-stretch: 70%; font-weight: 500; font-size: {rs}px; letter-spacing: 4px; text-transform: uppercase; color: {GOLD}; opacity: 0.8;">{role}</div>'
                        f'<div>{val}</div></div>')
    credits = f'<div style="display: flex; flex-direction: column; gap: {v(f, 22, 30, 42)}px;">{credit_rows}</div>'
    content = (f'<div style="{BODY} font-size: 17px; font-weight: 700; letter-spacing: 7px; text-transform: uppercase; color: {GOLD}; text-align: center;">End credits</div>'
               + spacer(v(f, 24, 32, 40))
               + two_line_head('gold', 'The real Invisalign.', 'No stunt double.', v(f, 84, 92, 96), v(f, 100, 112, 120), 'center')
               + grow() + credits + grow()
               + f'<div style="height: 1px; background: rgba(210,183,140,0.35); margin-bottom: {v(f, 28, 36, 44)}px;"></div>'
               + footer('gold', None, 200))
    sp = sprockets(h, 'l') + sprockets(h, 'r')
    pad = {'1x1': (64, 110, 64, 110), '4x5': (80, 112, 80, 112), '9x16': (250, 116, 330, 116)}[f]
    return frame(w, h, BG_BLACK, GOLD, sp, content, grain('light', 0.3, 'overlay'), pad)


# ---------- BAC-07: appointment card + postmark ----------
def postmark(size, uid):
    r = 40
    wav = ''.join(f'<path d="M100 {y} c 18 -9, 36 9, 54 0 s 36 9, 54 0 s 36 9, 54 0" stroke="{BLACK}" stroke-width="3.4" fill="none" stroke-linecap="round"/>'
                  for y in (36, 50, 64))
    return (f'<svg width="{int(size * 2.6)}" height="{size}" viewBox="0 0 260 100" aria-hidden="true" style="display: block; opacity: 0.88;">'
            f'<defs><path id="pm{uid}" d="M 50 50 m -{r - 7} 0 a {r - 7} {r - 7} 0 1 1 {2 * (r - 7)} 0 a {r - 7} {r - 7} 0 1 1 -{2 * (r - 7)} 0"/></defs>'
            f'<circle cx="50" cy="50" r="{r + 4}" fill="none" stroke="{BLACK}" stroke-width="3.2"/>'
            f'<circle cx="50" cy="50" r="{r - 16}" fill="none" stroke="{BLACK}" stroke-width="1.6"/>'
            f'<text style="font-family: Archivo, sans-serif; font-weight: 800; font-size: 9.6px; letter-spacing: 1.6px;" fill="{BLACK}">'
            f'<textPath href="#pm{uid}">NOT BY POST · NOT BY POST · NOT BY POST ·</textPath></text>'
            f'<text x="50" y="47" text-anchor="middle" style="font-family: Archivo, sans-serif; font-weight: 900; font-size: 10px;" fill="{BLACK}">IN</text>'
            f'<text x="50" y="59" text-anchor="middle" style="font-family: Archivo, sans-serif; font-weight: 900; font-size: 10px;" fill="{BLACK}">PERSON</text>'
            f'{wav}</svg>')


def bac07(f, w, h):
    cw = v(f, 700, 780, 860)
    lab = f'{BODY} font-size: {v(f, 15, 16, 18)}px; font-weight: 700; letter-spacing: 4px; text-transform: uppercase; color: {BLACK}; opacity: 0.7; width: {v(f, 110, 120, 130)}px; flex-shrink: 0;'
    hand = f'{HAND} font-size: {v(f, 40, 46, 52)}px; font-weight: 700; color: {BLACK}; line-height: 1;'
    field = lambda l, val: (f'<div style="display: flex; align-items: baseline; gap: 18px; padding: {v(f, 10, 12, 16)}px 0; border-bottom: 1.5px solid rgba(10,10,10,0.35);">'
                            f'<div style="{lab}">{l}</div><div style="{hand}">{val}</div></div>')
    card = (f'<div style="width: {cw}px; align-self: center; flex-shrink: 0; position: relative; transform: rotate(-3deg); box-shadow: {SHADOW_DEEP}; '
            f'background: radial-gradient(120% 90% at 20% 0%, #fffdf8 0%, {CREAM} 60%, #efe5d4 100%);">'
            + grain('dark', 0.3, 'multiply') +
            f'<div style="background: {BLACK}; padding: {v(f, 18, 22, 26)}px 30px; display: flex; justify-content: space-between; align-items: center;">'
            f'<div style="{SANS} font-weight: 800; font-stretch: 125%; font-size: {v(f, 22, 24, 28)}px; letter-spacing: 0.12em; color: {GOLD};">APPOINTMENT</div>'
            f'<img src="{B["mark_gold"]}" alt="" style="height: {v(f, 34, 38, 42)}px; width: auto; display: block;"></div>'
            f'<div style="position: relative; padding: {v(f, 14, 18, 24)}px 30px {v(f, 24, 28, 34)}px;">'
            + field('With', 'your Bond Dental clinician') + field('Where', 'Bond Dental, Marylebone') + field('How', 'in person, in the chair')
            + '</div>'
            f'<div style="position: absolute; right: -{v(f, 70, 70, 60)}px; bottom: -{v(f, 44, 50, 56)}px; transform: rotate(-14deg); mix-blend-mode: multiply;">{postmark(v(f, 120, 132, 150), f)}</div>'
            '</div>')
    items = ['Assessed in person at a London clinic', 'Planned by a Bond Dental clinician',
             'Progress checked in the chair', 'Genuine Invisalign, from £995']
    cols = 1 if f == '9x16' else 2
    tk = (f'<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="{BLACK}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink: 0; margin-top: 2px;"><path d="M4.5 12.5l5 5 10-11"/></svg>')
    lst = ''.join(f'<div style="display: flex; gap: 14px; align-items: flex-start;">{tk}<div style="{BODY} font-size: {v(f, 24, 27, 32)}px; line-height: 1.25; color: {BLACK};">{t}</div></div>' for t in items)
    grid = f'<div style="display: grid; grid-template-columns: repeat({cols}, minmax(0, 1fr)); column-gap: 32px; row-gap: {v(f, 14, 18, 24)}px;">{lst}</div>'
    content = (two_line_head('black', 'or a dentist you can<br>actually see?', 'Aligners by post,', v(f, 64, 72, 82), v(f, 70, 80, 92), serif_first=True)
               + grow() + card + grow() + spacer(v(f, 10, 20, 30)) + grid + spacer(v(f, 30, 40, 56)) + footer('black'))
    return frame(w, h, BG_GOLD, BLACK, '', content, grain('dark', 0.3, 'multiply') + grain('light', 0.3, 'overlay'), PAD[f])


# ---------- BAC-08: the dentist's markup ----------
def mark_svg(d, extra=''):
    return (f'<svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" '
            f'style="position: absolute; left: 0; top: 0; overflow: visible; filter: drop-shadow(0 2px 6px rgba(10,10,10,0.7));">'
            f'<path d="{d}" stroke="{GOLD}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none" vector-effect="non-scaling-stroke"/>{extra}</svg>')


def note(text, left, top, size, rot, align='left', width=None):
    wcss = f'width: {width}px;' if width else 'white-space: nowrap;'
    return (f'<div style="position: absolute; left: {left}%; top: {top}%; transform: rotate({rot}deg); {HAND} font-weight: 700; font-size: {size}px; '
            f'line-height: 0.95; color: {GOLD}; text-align: {align}; {wcss} text-shadow: 0 2px 10px rgba(10,10,10,0.9), 0 0 2px rgba(10,10,10,0.8);">{text}</div>')


def bac08(f, w, h):
    ph = v(f, 520, 700, 960)
    ns = v(f, 40, 46, 52)
    corner = lambda pos, bd: f'<div style="position: absolute; {pos} width: 44px; height: 44px; {bd}"></div>'
    g = f'3px solid {GOLD}'
    corners = (corner('left: 14px; top: 14px;', f'border-left: {g}; border-top: {g};') + corner('right: 14px; top: 14px;', f'border-right: {g}; border-top: {g};')
               + corner('left: 14px; bottom: 14px;', f'border-left: {g}; border-bottom: {g};') + corner('right: 14px; bottom: 14px;', f'border-right: {g}; border-bottom: {g};'))
    marks = (
        # ring round the front teeth
        mark_svg('M42 50 C 49 45, 62 46, 66 53 C 69 61, 61 68, 52 68 C 42 68, 37 62, 39 55 C 40 52, 43 50, 47 49')
        # arrow from ring to note 1 (upper right)
        + mark_svg('M65 50 C 70 42, 74 37, 79 33', '')
        + mark_svg('M75 32.5 L 79.5 32.8 L 78.5 37.3')
        # bracket along the gum line + arrow to note 2 (left)
        + mark_svg('M37 47 C 44 42.5, 58 42, 66 45.5')
        + mark_svg('M37 46 C 30 40, 24 36, 18 34')
        + mark_svg('M21.5 31.5 L 17.6 34 L 21 37.5')
        # tick for note 3
        + mark_svg('M18 82 L 21 86 L 27 78')
    )
    n1 = note('can be harder<br>to clean between', v(f, 64, 64, 60), v(f, 10, 14, 15), ns, -4)
    n2 = note('gums &amp; bite:<br>checked', v(f, 4, 4, 4), v(f, 14, 17, 18), ns, 3)
    n3 = note('plan + price before<br>you commit', v(f, 29, 29, 29), v(f, 76, 78, 79), ns, -2)
    photo = (f'<div style="height: {ph}px; flex-shrink: 0; position: relative; overflow: hidden; margin: 0 -{PAD[f][1]}px; background: #1a1a1a;">'
             f'<img src="{B["smile"]}" alt="" style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; object-fit: cover; '
             f'object-position: 57% 55%; transform: scale({v(f, 2.1, 2.0, 2.2)}); transform-origin: 57% 56%; filter: grayscale(1) contrast(1.12) brightness(0.9);">'
             f'<div style="position: absolute; left: 0; right: 0; top: 0; bottom: 0; background: radial-gradient(80% 70% at 50% 50%, rgba(10,10,10,0) 40%, rgba(10,10,10,0.55) 100%);"></div>'
             + grain('light', 0.45, 'overlay') + corners
             + f'<div style="position: absolute; left: 70px; top: 28px; {MONO} font-size: 17px; letter-spacing: 3px; color: {GOLD};">ASSESSMENT NOTES</div>'
             + f'<div style="position: absolute; right: 70px; top: 28px; {MONO} font-size: 17px; letter-spacing: 3px; color: {GOLD};">PATIENT: YOU</div>'
             + marks + n1 + n2 + n3 + '</div>')
    content = (f'<div style="{BODY} font-size: 17px; font-weight: 700; letter-spacing: 7px; text-transform: uppercase; color: {GOLD};">Why alignment matters</div>'
               + spacer(v(f, 16, 22, 28))
               + two_line_head('gold', 'It’s not just', 'about the photos.', v(f, 80, 92, 104), v(f, 88, 100, 114))
               + spacer(v(f, 18, 26, 30)) + grow() + photo + spacer(v(f, 24, 32, 40)) + grow()
               + f'<div style="{BODY} font-size: {v(f, 26, 29, 33)}px; line-height: 1.3; color: {GOLD};">Your assessment looks at your whole dental health, not just your smile.</div>'
               + spacer(v(f, 26, 40, 52)) + footer('gold'))
    return frame(w, h, BG_BLACK, GOLD, '', content, grain('light', 0.3, 'overlay'), PAD[f])


# ---------- BAC-09: the seal ----------
def seal(d, uid):
    pts = []
    n = 64
    for i in range(n * 2):
        a = math.pi * i / n
        r = 100 if i % 2 == 0 else 93
        pts.append(f'{110 + r * math.cos(a):.2f},{110 + r * math.sin(a):.2f}')
    ring = 72
    return (f'<svg width="{d}" height="{d}" viewBox="0 0 220 220" aria-hidden="true" style="display: block; filter: drop-shadow(0 30px 40px rgba(0,0,0,0.55));">'
            f'<defs><linearGradient id="sg{uid}" x1="0" y1="0" x2="1" y2="1">'
            f'<stop offset="0" stop-color="#F3E6CC"/><stop offset="0.45" stop-color="{GOLD}"/><stop offset="1" stop-color="#8F7B5A"/></linearGradient>'
            f'<linearGradient id="sh{uid}" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#F3E6CC"/><stop offset="0.5" stop-color="{GOLD}"/><stop offset="1" stop-color="#A08B67"/></linearGradient>'
            f'<path id="sp{uid}" d="M 110 110 m -{ring} 0 a {ring} {ring} 0 1 1 {2 * ring} 0 a {ring} {ring} 0 1 1 -{2 * ring} 0"/></defs>'
            f'<polygon points="{" ".join(pts)}" fill="url(#sg{uid})"/>'
            f'<circle cx="110" cy="110" r="86" fill="url(#sh{uid})"/>'
            f'<circle cx="110" cy="110" r="84" fill="none" stroke="{BLACK}" stroke-width="0.8" opacity="0.5"/>'
            f'<circle cx="110" cy="110" r="60" fill="url(#sg{uid})" stroke="{BLACK}" stroke-width="0.8" stroke-opacity="0.5"/>'
            f'<text style="font-family: Archivo, sans-serif; font-weight: 800; font-size: 11.5px; letter-spacing: 1px;" fill="{BLACK}">'
            f'<textPath href="#sp{uid}" textLength="446" lengthAdjust="spacing">GENUINE INVISALIGN · BOND DENTAL LONDON · </textPath></text>'
            f'<text x="110" y="106" text-anchor="middle" style="font-family: \'Instrument Serif\', serif; font-style: italic; font-size: 30px;" fill="{BLACK}">The real</text>'
            f'<text x="110" y="134" text-anchor="middle" style="font-family: \'Instrument Serif\', serif; font-style: italic; font-size: 30px;" fill="{BLACK}">one.</text>'
            '</svg>')


def bac09(f, w, h):
    s = v(f, 104, 116, 124)
    head = (f'<div style="position: relative;">'
            f'<div style="position: absolute; left: {int(s * 0.16)}px; top: {int(s * 0.16)}px; {SANS} font-style: italic; font-weight: 800; font-size: {s}px; line-height: 0.92; '
            f'letter-spacing: -0.035em; color: rgba(0,0,0,0); -webkit-text-stroke: 1.5px rgba(210,183,140,0.35); white-space: nowrap;">Not a lookalike.</div>'
            f'<div style="position: relative; {SANS} font-style: italic; font-weight: 800; font-size: {s}px; line-height: 0.92; letter-spacing: -0.035em; color: {GOLD}; white-space: nowrap;">Not a lookalike.</div></div>')
    sd = v(f, 450, 560, 680)
    content = (head + grow()
               + f'<div style="align-self: center; transform: rotate(-8deg);">{seal(sd, f)}</div>'
               + grow()
               + f'<div style="{BODY} font-size: {v(f, 27, 30, 34)}px; line-height: 1.35; color: {GOLD};">The real Invisalign, from Invisalign Diamond Provider clinicians at Bond Dental London. Four clear prices from £995.</div>'
               + spacer(v(f, 30, 44, 56)) + footer('gold'))
    under = (f'<div style="position: absolute; left: 0; top: 0; right: 0; bottom: 0; '
             f'background: radial-gradient(50% 40% at 50% 50%, rgba(210,183,140,0.22) 0%, rgba(210,183,140,0) 100%);"></div>')
    return frame(w, h, BG_BLACK, GOLD, under, content, grain('light', 0.3, 'overlay'), PAD[f])


# ---------- BAC-10: storyboard sheet ----------
S = f'stroke="{GOLD}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"'
ILLUS = [
    # 1 assessment: tooth + mirror
    f'<path {S} d="M36 22c-5 0-8 4-8 9 0 6 3 9 4 16 .8 6 2.4 11 5 11 3.2 0 3.2-10 9-10s5.8 10 9 10c2.6 0 4.2-5 5-11 1-7 4-10 4-16 0-5-3-9-8-9-4 0-6 2-10 2s-6-2-10-2z"/>'
    f'<circle {S} cx="88" cy="30" r="12"/><path {S} d="M80 39 L 64 66"/>',
    # 2 preview: tablet with before/after smile
    f'<rect {S} x="22" y="12" width="76" height="54" rx="6"/><path {S} d="M60 16 V 62" stroke-dasharray="3 4"/>'
    f'<path {S} d="M30 40 l5 4 l4 -5 l5 6 l4 -5 l5 4"/><path {S} d="M66 38 Q 79 50, 92 38"/>',
    # 3 aligners: tray top view
    f'<path {S} d="M28 18 C 28 70, 92 70, 92 18"/><path {S} d="M40 18 C 40 56, 80 56, 80 18"/>'
    f'<path {S} d="M28 18 H 40 M 80 18 H 92"/><path {S} d="M100 22 l4 -4 M 102 32 h 6 M 18 26 l-5 -3"/>',
    # 4 retainer case
    f'<rect {S} x="30" y="24" width="60" height="38" rx="16"/><path {S} d="M30 40 H 90"/>'
    f'<circle {S} cx="92" cy="22" r="9"/><path {S} d="M88 22 l3 3 l5 -6"/>',
]


def bac10(f, w, h):
    scenes = [('Your assessment', 'A complimentary dental health assessment, in clinic.'),
              ('The preview', 'A personalised simulation of your results, before you commit.'),
              ('Your aligners', 'Clear aligners made for your teeth, changed as your plan progresses.'),
              ('The retainer', 'A complimentary removable retainer to finish.')]
    ih = v(f, 136, 190, 250)
    panels = ''
    for i, (t, d) in enumerate(scenes):
        panels += (f'<div style="display: flex; flex-direction: column; gap: 10px;">'
                   f'<div style="height: {ih}px; background: {BLACK}; position: relative; display: flex; align-items: center; justify-content: center;">'
                   f'<div style="position: absolute; left: 12px; top: 10px; {MONO} font-size: 15px; letter-spacing: 2px; color: {GOLD};">SC. 0{i + 1}</div>'
                   f'<svg width="{int(ih * 1.35)}" height="{int(ih * 0.9)}" viewBox="0 0 120 80" aria-hidden="true">{ILLUS[i]}</svg></div>'
                   f'<div style="{MONO} font-size: {v(f, 19, 21, 24)}px; font-weight: 700; color: {BLACK}; line-height: 1.2;">{i + 1}. {t}</div>'
                   f'<div style="{MONO} font-size: {v(f, 16, 18, 21)}px; color: {BLACK}; line-height: 1.3;">{d}</div></div>')
    sheet_w = v(f, 880, 900, 912)
    clip = (f'<div style="position: absolute; left: 50%; top: -34px; transform: translateX(-50%); width: 150px; height: 58px; '
            f'background: linear-gradient(180deg, #2a2a2a 0%, {BLACK} 60%); border-radius: 8px 8px 4px 4px; box-shadow: 0 8px 14px -6px rgba(10,10,10,0.6);">'
            f'<div style="position: absolute; left: 22px; right: 22px; top: -22px; height: 30px; border: 4px solid {GOLD}; border-bottom: 0; border-radius: 14px 14px 0 0;"></div></div>')
    sheet = (f'<div style="width: {sheet_w}px; align-self: center; flex-shrink: 0; position: relative; transform: rotate(-1.4deg); box-shadow: {SHADOW_DEEP}; '
             f'background: radial-gradient(120% 90% at 20% 0%, #fffdf8 0%, {CREAM} 60%, #efe5d4 100%); padding: {v(f, 30, 38, 46)}px {v(f, 32, 38, 44)}px {v(f, 30, 38, 46)}px;">'
             + grain('dark', 0.3, 'multiply') + clip +
             f'<div style="position: relative; display: flex; justify-content: space-between; align-items: baseline; padding-bottom: 12px; margin-bottom: {v(f, 18, 24, 30)}px; border-bottom: 2px solid {BLACK};">'
             f'<div style="{SANS} font-weight: 800; font-stretch: 125%; font-size: {v(f, 22, 24, 28)}px; letter-spacing: 0.14em; color: {BLACK};">STORYBOARD</div>'
             f'<div style="{MONO} font-size: {v(f, 15, 16, 18)}px; color: {BLACK};">BOND ALIGNER CLUB · SHEET 1/1</div></div>'
             f'<div style="position: relative; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: {v(f, 26, 30, 34)}px; row-gap: {v(f, 20, 28, 40)}px;">{panels}</div></div>')
    content = (two_line_head('black', 'The whole plot,', 'in four scenes.', v(f, 70, 88, 100), v(f, 76, 96, 110))
               + spacer(v(f, 44, 56, 76)) + grow() + sheet + grow() + spacer(v(f, 14, 20, 30)) + footer('black', None, 200))
    return frame(w, h, BG_GOLD, BLACK, '', content, grain('dark', 0.3, 'multiply') + grain('light', 0.3, 'overlay'), PAD[f])


SECTION = [('06', bac06), ('07', bac07), ('08', bac08), ('09', bac09), ('10', bac10)]
