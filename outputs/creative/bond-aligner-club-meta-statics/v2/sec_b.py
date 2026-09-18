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


# ---------- BAC-08: arch diagram ----------
def arch_svg(width):
    teeth = []
    n = 14
    for i in range(n):
        a = -82 + i * (164 / (n - 1))
        rad = math.radians(a)
        x = 250 + 185 * math.sin(rad)
        y = 300 - 235 * math.cos(rad)
        t = abs(a) / 82
        tw = 30 + 22 * t
        th = 44 + 14 * t
        rot = a
        crowd = i in (6, 7)
        if crowd:
            rot += -22 if i == 6 else 20
            y += 14 if i == 6 else -6
            x += 8 if i == 6 else -8
        fill = GOLD if crowd else 'rgba(210,183,140,0.08)'
        stroke = BLACK if crowd else GOLD
        teeth.append(f'<rect x="{x - tw / 2:.1f}" y="{y - th / 2:.1f}" width="{tw:.1f}" height="{th:.1f}" rx="{tw * 0.42:.1f}" '
                     f'transform="rotate({rot:.1f} {x:.1f} {y:.1f})" fill="{fill}" stroke="{stroke}" stroke-width="2.4"/>')
    ideal = ' '.join(f'{250 + 185 * math.sin(math.radians(a)):.1f},{300 - 235 * math.cos(math.radians(a)):.1f}' for a in range(-86, 87, 4))
    return (f'<svg width="{width}" height="{int(width * 0.62)}" viewBox="40 40 420 280" aria-hidden="true" style="display: block; overflow: visible;">'
            f'<polyline points="{ideal}" fill="none" stroke="{GOLD}" stroke-width="1.6" stroke-dasharray="4 7" opacity="0.55"/>'
            + ''.join(teeth) +
            f'<path d="M258 70 C 300 40, 360 40, 420 44" stroke="{GOLD}" stroke-width="1.8" fill="none"/>'
            f'<circle cx="258" cy="70" r="5" fill="{GOLD}"/>'
            f'<path d="M196 232 H 232" stroke="{GOLD}" stroke-width="1.6" stroke-dasharray="4 7" opacity="0.8"/>'
            f'<text x="240" y="236" style="font-family: Lato, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 2.5px;" fill="{GOLD}" opacity="0.85">IDEAL ARCH</text>'
            '</svg>')


def bac08(f, w, h):
    aw = v(f, 560, 640, 700)
    lw = v(f, 220, 250, 220)
    cw_ = w - PAD[f][1] - PAD[f][3]
    ml = max(0, int((cw_ - (aw * 0.93 + lw)) / 2))
    diag = (f'<div style="position: relative; align-self: flex-start; margin-left: {ml}px; width: {aw}px; flex-shrink: 0;">{arch_svg(aw)}'
            f'<div style="position: absolute; left: {int(aw * 0.93)}px; top: -{v(f, 34, 36, 40)}px; width: {lw}px;">'
            f'<div style="{MONO} font-size: 18px; letter-spacing: 3px; color: {GOLD};">01</div>'
            f'<div style="{BODY} font-size: {v(f, 23, 25, 28)}px; line-height: 1.3; color: {GOLD};">Crowded teeth can be harder to clean between.</div></div></div>')
    pts = [('02', 'Your assessment looks at your whole dental health, not just your smile.'),
           ('03', 'You’ll see what treatment involves, and what it costs, before you commit.')]
    lst = ''.join(f'<div style="display: flex; gap: 22px; align-items: baseline; padding-top: {v(f, 14, 18, 24)}px; border-top: 1px solid rgba(210,183,140,0.35);">'
                  f'<div style="{MONO} font-size: 18px; letter-spacing: 3px; color: {GOLD}; flex-shrink: 0;">{n}</div>'
                  f'<div style="{BODY} font-size: {v(f, 25, 28, 32)}px; line-height: 1.3; color: {GOLD};">{t}</div></div>' for n, t in pts)
    content = (f'<div style="{BODY} font-size: 17px; font-weight: 700; letter-spacing: 7px; text-transform: uppercase; color: {GOLD};">Why alignment matters</div>'
               + spacer(v(f, 18, 24, 30))
               + two_line_head('gold', 'It’s not just', 'about the photos.', v(f, 80, 92, 104), v(f, 88, 100, 114))
               + grow() + diag + grow()
               + f'<div style="display: flex; flex-direction: column; gap: {v(f, 14, 18, 24)}px;">{lst}</div>'
               + spacer(v(f, 30, 44, 56)) + footer('gold'))
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
