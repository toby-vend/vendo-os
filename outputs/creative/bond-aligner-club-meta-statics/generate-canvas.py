#!/usr/bin/env python3
"""Generate the Bond Aligner Club Meta statics canvas (30 creatives x 3 formats)."""
import json, os, datetime

ROOT = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.join(ROOT, 'project')
os.makedirs(PROJ, exist_ok=True)

GOLD, BLACK, CREAM = '#D2B78C', '#0A0A0A', '#FAF3E9'
LOGO = {'gold': '/_blob/9a4eb86c230345a27566e42c0e7f3976', 'black': '/_blob/ab8e11ffd14a363fba6d73d4b291f40f'}
MARK = {'gold': '/_blob/38684bdc26d74d87ce9905b96c5d293c', 'black': '/_blob/30a913549bd64d0fec1a98b7594259f3'}
LOBBY = '/_blob/095d6f03ca3b629cfcfdb4824addce9a'
FONTS = ('https://fonts.googleapis.com/css2?family=Archivo:ital,wdth,wght@0,62..125,100..900;1,62..125,100..900'
         '&amp;family=Courier+Prime:ital,wght@0,400;0,700;1,400&amp;family=Lato:ital,wght@0,400;0,700;1,400&amp;display=swap')

FMTS = [('1x1', 1080, 1080, '1:1'), ('4x5', 1080, 1350, '4:5'), ('9x16', 1080, 1920, '9:16')]
PAD = {'1x1': (72, 72, 72, 72), '4x5': (84, 80, 84, 80), '9x16': (250, 84, 330, 84)}

DISPLAY = "font-family: 'Archivo', sans-serif;"
BODY = "font-family: 'Lato', sans-serif;"
MONO = "font-family: 'Courier Prime', monospace;"


def v(f, a, b, c):
    return {'1x1': a, '4x5': b, '9x16': c}[f]


def fg_for(bg):
    return BLACK if bg in (GOLD, CREAM) else GOLD


def tone_for(bg):
    return 'black' if bg in (GOLD, CREAM) else 'gold'


# ---------- shared pieces ----------

def lockup(bg, w=230, align='flex-start'):
    t = tone_for(bg)
    c = fg_for(bg)
    return (f'<div style="display: flex; flex-direction: column; align-items: {align}; gap: 12px;">'
            f'<img src="{LOGO[t]}" alt="Bond Aligner Club" style="width: {w}px; height: auto; display: block;">'
            f'<div style="{BODY} font-size: 19px; font-weight: 700; letter-spacing: 5px; text-transform: uppercase; color: {c};">by Bond Dental London</div>'
            '</div>')


def cta(bg, text='Book a consultation'):
    c = fg_for(bg)
    return (f'<div style="{BODY} font-size: 24px; font-weight: 700; letter-spacing: 1px; color: {c}; '
            f'border: 2px solid {c}; border-radius: 999px; padding: 18px 32px; white-space: nowrap;">{text}</div>')


def footer(bg, right=None, lw=220):
    right = cta(bg) if right is None else right
    return (f'<div style="display: flex; justify-content: space-between; align-items: flex-end; gap: 32px; flex-shrink: 0;">'
            f'{lockup(bg, lw)}{right}</div>')


def tagline_small(bg, size=30):
    return (f'<div style="{DISPLAY} font-style: italic; font-weight: 700; font-size: {size}px; color: {fg_for(bg)}; '
            f'text-align: right; line-height: 1.1;">Start as you mean<br>to go on.</div>')


def eyebrow(bg, text, size=22):
    return (f'<div style="{BODY} font-size: {size}px; font-weight: 700; letter-spacing: 6px; text-transform: uppercase; '
            f'color: {fg_for(bg)};">{text}</div>')


def h(bg, text, size, weight=800, italic=False, align='left', lh=0.98, ls='-0.025em', extra=''):
    it = 'font-style: italic; ' if italic else ''
    return (f'<div style="{DISPLAY} {it}font-weight: {weight}; font-size: {size}px; line-height: {lh}; letter-spacing: {ls}; '
            f'color: {fg_for(bg)}; text-align: {align}; {extra}">{text}</div>')


def p(bg, text, size=32, align='left', lh=1.35, extra=''):
    return (f'<div style="{BODY} font-size: {size}px; line-height: {lh}; color: {fg_for(bg)}; text-align: {align}; {extra}">{text}</div>')


def rule(bg, w=96, thick=3):
    return f'<div style="width: {w}px; height: {thick}px; background: {fg_for(bg)}; flex-shrink: 0;"></div>'


CAM = ('<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" '
       'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.3l1.4-2h7.6l1.4 2h2.3A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z"/>'
       '<circle cx="12" cy="13" r="3.6"/></svg>')


def slot(bg, label, sub, style=''):
    """Labelled image slot for photography still to be supplied."""
    if bg == BLACK:
        fill, col, bd = 'rgba(210,183,140,0.13)', GOLD, 'rgba(210,183,140,0.4)'
    else:
        fill, col, bd = 'rgba(10,10,10,0.08)', BLACK, 'rgba(10,10,10,0.3)'
    return (f'<div style="background: {fill}; border: 2px dashed {bd}; color: {col}; display: flex; flex-direction: column; '
            f'align-items: center; justify-content: center; gap: 14px; text-align: center; padding: 24px; box-sizing: border-box; {style}">'
            f'{CAM}<div style="{BODY} font-size: 20px; font-weight: 700; letter-spacing: 4px; text-transform: uppercase;">{label}</div>'
            f'<div style="{BODY} font-size: 19px; line-height: 1.35; max-width: 460px;">{sub}</div></div>')


def root(f, w, hgt, bg, inner, gap=0, pad=None, extra=''):
    t, r, b, l = pad or PAD[f]
    return (f'<div style="width: {w}px; height: {hgt}px; box-sizing: border-box; padding: {t}px {r}px {b}px {l}px; '
            f'display: flex; flex-direction: column; gap: {gap}px; background: {bg}; color: {fg_for(bg)}; {BODY} '
            f'position: relative; overflow: hidden; {extra}">{inner}</div>')


def grow(n=1):
    return f'<div style="flex-grow: {n};"></div>'


def tick(bg, size=34):
    c = fg_for(bg)
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{c}" stroke-width="2.2" '
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink: 0;"><path d="M4.5 12.5l5 5 10-11"/></svg>')


def disc(n, size=64, bgc=GOLD, fgc=BLACK):
    return (f'<div style="width: {size}px; height: {size}px; border-radius: 50%; background: {bgc}; color: {fgc}; flex-shrink: 0; '
            f'display: flex; align-items: center; justify-content: center; {DISPLAY} font-weight: 800; font-size: {int(size*0.42)}px;">{n}</div>')


FIN_FOOT = ('0% finance available over up to 36 months, subject to status. Representative example: [TO FOLLOW FROM LENDER]. '
            'Kevom Ltd t/a Bond Dental London is a credit broker, not a lender. FRN 832135.')

# ---------- creatives ----------
# each returns (bg, inner_html, gap, pad_override_or_None)


def c01(f):
    bg = GOLD
    inner = (f'<div style="display: flex; justify-content: space-between; align-items: center;">{eyebrow(bg, "Invisalign · Five London clinics", 20)}</div>'
             + grow()
             + h(bg, 'Start as you<br>mean to<br>go on.', v(f, 150, 162, 176), 800, True, lh=0.92, ls='-0.035em')
             + f'<div style="height: {v(f, 36, 48, 64)}px;"></div>' + rule(bg)
             + f'<div style="height: 28px;"></div>'
             + p(bg, 'Invisalign from £995.<br>0% finance available over up to 36 months.', v(f, 32, 34, 38))
             + grow() + footer(bg))
    return bg, inner


def c02(f):
    bg = BLACK
    photo = slot(bg, 'Photo · candid close-crop smile', 'Real patient or UGC still from Chaz’s incoming shoot. No stock, no AI faces.',
                 f'flex-grow: 1; min-height: 0;')
    inner = (photo + f'<div style="height: {v(f, 40, 52, 64)}px;"></div>'
             + h(bg, 'Nobody’s the main<br>character every day.', v(f, 70, 80, 90), 800)
             + f'<div style="height: 16px;"></div>'
             + h(bg, 'But a good start helps.', v(f, 44, 50, 58), 500, True, ls='-0.01em')
             + f'<div style="height: {v(f, 40, 56, 72)}px;"></div>' + footer(bg, tagline_small(bg, 28)))
    return bg, inner


def c03(f):
    bg = BLACK
    billing = ('A BOND ALIGNER CLUB PRODUCTION &nbsp;·&nbsp; STARRING GENUINE INVISALIGN &nbsp;·&nbsp; SAME CLINICIANS. SAME CLINICS. CLEARER PRICING. '
               '&nbsp;·&nbsp; EXPRESS £995 &nbsp;·&nbsp; LITE £1,995 &nbsp;·&nbsp; MODERATE £2,995 &nbsp;·&nbsp; COMPREHENSIVE £3,595 '
               '&nbsp;·&nbsp; 0% FINANCE AVAILABLE OVER UP TO 36 MONTHS &nbsp;·&nbsp; AT BOND DENTAL LONDON')
    frame_pad = v(f, 44, 56, 64)
    inner = (f'<div style="flex-grow: 1; border: 2px solid {GOLD}; padding: {frame_pad}px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0;">'
             + eyebrow(bg, 'Bond Dental London presents', 20)
             + grow()
             + h(bg, 'STARTING<br>WELL', v(f, 150, 168, 184), 800, align='center', lh=0.86, ls='0', extra='font-stretch: 125%;')
             + f'<div style="height: {v(f, 28, 40, 56)}px;"></div>'
             + h(bg, 'Start as you mean to go on.', v(f, 40, 44, 50), 600, True, align='center', ls='-0.01em')
             + grow()
             + f'<div style="{DISPLAY} font-stretch: 62%; font-weight: 600; font-size: {v(f, 22, 24, 26)}px; line-height: 1.35; letter-spacing: 1px; color: {GOLD}; max-width: 860px;">{billing}</div>'
             + f'<div style="height: {v(f, 32, 44, 56)}px;"></div>'
             + f'<div style="display: flex; flex-direction: column; align-items: center; gap: 28px;">'
             + h(bg, 'NOW BOOKING', v(f, 40, 44, 50), 800, align='center', ls='0.12em', extra='font-stretch: 125%;')
             + lockup(bg, 200, 'center') + '</div></div>')
    pad = {'1x1': (48, 48, 48, 48), '4x5': (56, 56, 56, 56), '9x16': (230, 64, 310, 64)}[f]
    return bg, inner, 0, pad


def c04(f):
    bg = CREAM
    labels = ['Delete', 'Delete', 'Delete', 'Keep']
    vertical = f == '9x16'
    frames = ''
    for i, lab in enumerate(labels):
        keep = lab == 'Keep'
        mark = ('' if keep else
                '<svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" '
                'style="position: absolute; left: 0; top: 0;"><path d="M4 4L96 96M96 4L4 96" stroke="#D2B78C" stroke-width="2.4" vector-effect="non-scaling-stroke" fill="none"/></svg>')
        size = 'width: 100%; flex-grow: 1; min-height: 0;' if vertical else 'height: 100%; flex-grow: 1; min-width: 0;'
        frames += (f'<div style="position: relative; display: flex; flex-direction: column; gap: 10px; {size}">'
                   f'<div style="position: relative; flex-grow: 1; background: rgba(210,183,140,0.16); border: 2px dashed rgba(210,183,140,0.5); '
                   f'display: flex; align-items: center; justify-content: center; color: {GOLD}; {BODY} font-size: 16px; letter-spacing: 3px; text-transform: uppercase; text-align: center; padding: 8px;">'
                   f'{"Photo " + str(i + 1)}{mark}</div>'
                   f'<div style="{MONO} font-size: 20px; font-weight: 700; color: {GOLD}; text-align: center; letter-spacing: 2px; text-transform: uppercase;">{lab}</div></div>')
    strip_dir = 'column' if vertical else 'row'
    strip_size = 'width: 420px; align-self: center; flex-grow: 1; min-height: 0;' if vertical else f'height: {v(f, 330, 420, 0)}px;'
    strip = (f'<div style="background: {BLACK}; padding: 22px; display: flex; flex-direction: {strip_dir}; gap: 18px; box-sizing: border-box; flex-shrink: 0; {strip_size}">{frames}</div>')
    inner = (h(bg, 'No more <span style="font-style: italic; font-weight: 600;">“wait, delete<br>that one.”</span>', v(f, 72, 80, 86), 800)
             + f'<div style="height: {v(f, 36, 44, 56)}px;"></div>' + strip
             + f'<div style="height: {v(f, 32, 44, 56)}px;"></div>'
             + p(bg, 'Straighter teeth with the real Invisalign, from £995.', v(f, 30, 34, 38))
             + grow() + footer(bg))
    return bg, inner


def c05(f):
    bg = CREAM
    fs = v(f, 30, 33, 36)
    def line(t, indent=0, extra=''):
        return f'<div style="{MONO} font-size: {fs}px; line-height: 1.45; color: {BLACK}; padding-left: {indent}px; {extra}">{t}</div>'
    cue = v(f, 300, 320, 330)
    dlg = v(f, 150, 160, 160)
    script = (f'<div style="{MONO} font-size: {fs}px; color: {BLACK}; text-align: right;">1.</div>'
              + line('<b>INT. BOND DENTAL, MARYLEBONE. MORNING.</b>')
              + f'<div style="height: {v(f, 18, 26, 34)}px;"></div>'
              + line('Our lead walks in. She has been meaning to do this for years.')
              + f'<div style="height: {v(f, 18, 26, 34)}px;"></div>'
              + line('DENTIST', cue)
              + line('So. Where would you like to start?', dlg, 'padding-right: 120px;')
              + f'<div style="height: {v(f, 18, 26, 34)}px;"></div>'
              + line('OUR LEAD', cue)
              + line('(beat)', dlg + 90)
              + line(f'<span style="background: {GOLD}; padding: 2px 8px; box-decoration-break: clone; -webkit-box-decoration-break: clone;">As I mean to go on.</span>', dlg)
              + f'<div style="height: {v(f, 18, 26, 34)}px;"></div>'
              + line('She books the consultation. Invisalign, from £995.'))
    inner = script + grow() + footer(bg, tagline_small(bg, 30))
    return bg, inner


def c06(f):
    bg = BLACK
    rows = [('Invisalign', 'Played by Invisalign'), ('Your clinician', 'A Bond Dental clinician'),
            ('Your clinic', 'Bond Dental London'), ('Stunt doubles', 'None')]
    credits = ''
    for role, who in rows:
        credits += (f'<div style="display: flex; align-items: baseline; gap: 18px; {DISPLAY} font-stretch: 75%; font-size: {v(f, 34, 38, 42)}px; color: {GOLD}; text-transform: uppercase; letter-spacing: 2px;">'
                    f'<span style="font-weight: 500; white-space: nowrap;">{role}</span>'
                    f'<span style="flex-grow: 1; border-bottom: 2px dotted rgba(210,183,140,0.6); transform: translateY(-8px);"></span>'
                    f'<span style="font-weight: 800; white-space: nowrap;">{who}</span></div>')
    inner = (h(bg, 'The real Invisalign.', v(f, 84, 90, 100), 800)
             + h(bg, 'No stunt double.', v(f, 84, 90, 100), 700, True)
             + grow()
             + f'<div style="display: flex; flex-direction: column; gap: {v(f, 22, 30, 40)}px;">{credits}</div>'
             + grow()
             + p(bg, 'Same Invisalign system. Same Bond Dental clinicians. Clearer pricing.', v(f, 28, 32, 36))
             + f'<div style="height: {v(f, 36, 48, 64)}px;"></div>' + footer(bg))
    return bg, inner


def c07(f):
    bg = CREAM
    items = ['Assessed in person at a London clinic', 'Treatment planned by a Bond Dental clinician',
             'Progress checked in the chair, not just on camera', 'Genuine Invisalign, never a lookalike',
             'Four clear prices, from £995']
    lst = ''.join(f'<div style="display: flex; gap: 22px; align-items: center; padding: {v(f, 16, 22, 30)}px 0; border-top: 2px solid {BLACK};">'
                  f'{tick(bg, v(f, 34, 38, 42))}{p(bg, it, v(f, 30, 33, 37), lh=1.25)}</div>' for it in items)
    inner = (h(bg, 'Aligners by post,', v(f, 72, 78, 88), 600, True)
             + h(bg, 'or a dentist you can actually see?', v(f, 72, 78, 88), 800)
             + grow() + f'<div style="display: flex; flex-direction: column; border-bottom: 2px solid {BLACK};">{lst}</div>'
             + grow() + footer(bg))
    return bg, inner


ICON_TOOTH = '<path d="M7 3c-2.5 0-4 2-4 4.5 0 3 1.5 4.5 2 8 .4 3 1.2 5.5 2.5 5.5 1.6 0 1.6-5 4.5-5s2.9 5 4.5 5c1.3 0 2.1-2.5 2.5-5.5.5-3.5 2-5 2-8C21 5 19.5 3 17 3c-2 0-3 1-5 1S9 3 7 3z"/>'
ICON_SEARCH = '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>'
ICON_CHAT = '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>'


def icon(paths, bg, size=56):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{fg_for(bg)}" stroke-width="1.5" '
            f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink: 0;">{paths}</svg>')


def c08(f):
    bg = BLACK
    pts = [(ICON_TOOTH, 'Crowded teeth can be harder to clean between.'),
           (ICON_SEARCH, 'Your assessment looks at your whole dental health, not just your smile.'),
           (ICON_CHAT, 'You’ll see what treatment involves, and what it costs, before you commit.')]
    lst = ''.join(f'<div style="display: flex; gap: 28px; align-items: center;">{icon(ic, bg, v(f, 56, 62, 70))}{p(bg, t, v(f, 31, 34, 38), lh=1.3)}</div>' for ic, t in pts)
    inner = (eyebrow(bg, 'Why alignment matters', 20) + f'<div style="height: 28px;"></div>'
             + h(bg, 'It’s not just<br>about the photos.', v(f, 88, 96, 108), 800)
             + grow() + f'<div style="display: flex; flex-direction: column; gap: {v(f, 30, 42, 56)}px;">{lst}</div>'
             + grow() + footer(bg))
    return bg, inner


def c09(f):
    bg = GOLD
    photo = slot(bg, 'Photo · Invisalign aligners', 'Product still: aligners and case on stone or linen, soft daylight.', 'flex-grow: 1; min-height: 0;')
    inner = (photo + f'<div style="height: {v(f, 40, 52, 64)}px;"></div>'
             + h(bg, 'Not a lookalike.', v(f, 96, 104, 116), 800, True)
             + f'<div style="height: 20px;"></div>'
             + p(bg, 'The real Invisalign, from Invisalign Diamond Provider clinicians at Bond Dental London. Four clear prices from £995.', v(f, 29, 32, 36))
             + f'<div style="height: {v(f, 40, 52, 64)}px;"></div>' + footer(bg))
    return bg, inner


def c10(f):
    bg = CREAM
    scenes = [('Your assessment', 'A complimentary dental health assessment, in clinic.'),
              ('The preview', 'A personalised simulation of your results, before you commit.'),
              ('Your aligners', 'Clear aligners made for your teeth, changed as your plan progresses.'),
              ('The retainer', 'A complimentary removable retainer to finish.')]
    cols = 1 if f == '9x16' else 2
    cards = ''.join(f'<div style="border: 2px solid {BLACK}; padding: {v(f, 26, 30, 32)}px; display: flex; flex-direction: column; gap: 14px; box-sizing: border-box;">'
                    f'<div style="display: flex; align-items: center; gap: 18px;">{disc(i + 1, v(f, 54, 58, 60))}'
                    f'<div style="{BODY} font-size: 19px; font-weight: 700; letter-spacing: 4px; text-transform: uppercase;">Scene {["one", "two", "three", "four"][i]}</div></div>'
                    f'{h(bg, t, v(f, 36, 40, 44), 800, lh=1.05, ls="-0.015em")}{p(bg, d, v(f, 24, 26, 29), lh=1.35)}</div>'
                    for i, (t, d) in enumerate(scenes))
    inner = (h(bg, 'The whole plot,<br>in four scenes.', v(f, 80, 88, 100), 800)
             + grow() + f'<div style="display: grid; grid-template-columns: repeat({cols}, minmax(0, 1fr)); gap: {v(f, 20, 24, 24)}px;">{cards}</div>'
             + grow() + footer(bg, tagline_small(bg, 28)))
    return bg, inner


def c11(f):
    bg = BLACK
    ph = v(f, 560, 760, 1060)
    img = (f'<div style="height: {ph}px; flex-shrink: 0; background-image: url({LOBBY}); background-size: cover; background-position: center 60%;"></div>')
    body = (f'<div style="flex-grow: 1; display: flex; flex-direction: column; padding: {v(f, 48, 56, 64)}px {PAD[f][1]}px {v(f, 60, 72, 330)}px {PAD[f][3]}px; gap: 0;">'
            + h(bg, 'Same clinics. <span style="font-style: italic; font-weight: 600;">Same crew.</span>', v(f, 76, 84, 92), 800)
            + f'<div style="height: 18px;"></div>'
            + p(bg, 'Bond Aligner Club is Bond Dental London, with clearer pricing.', v(f, 28, 31, 35))
            + grow() + footer(bg) + '</div>')
    top = v(f, 0, 0, 180)
    lead = f'<div style="height: {top}px; flex-shrink: 0; background: {BLACK};"></div>' if top else ''
    return bg, lead + img + body, 0, (0, 0, 0, 0)


def c12(f):
    bg = CREAM
    card = (f'<div style="border: 2px solid {BLACK}; padding: {v(f, 36, 44, 52)}px; display: flex; flex-direction: column; gap: 22px;">'
            f'<div style="{BODY} font-size: 19px; font-weight: 700; letter-spacing: 5px; text-transform: uppercase;">Club directory</div>'
            f'<div style="height: 2px; background: {BLACK};"></div>'
            f'<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 24px;">'
            f'{p(bg, "Your club clinic", v(f, 26, 28, 30))}{h(bg, "Bond Dental Marylebone", v(f, 38, 42, 46), 800, align="right", ls="-0.01em")}</div>'
            f'<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 24px;">'
            f'{p(bg, "Your clinicians", v(f, 26, 28, 30))}{h(bg, "Bond Dental’s own", v(f, 38, 42, 46), 800, align="right", ls="-0.01em")}</div>'
            f'<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 24px;">'
            f'{p(bg, "Your treatment", v(f, 26, 28, 30))}{h(bg, "Genuine Invisalign", v(f, 38, 42, 46), 800, align="right", ls="-0.01em")}</div>'
            '</div>')
    inner = (h(bg, 'Still our clinics.', v(f, 88, 96, 104), 800)
             + h(bg, 'Still our team.', v(f, 88, 96, 104), 600, True)
             + grow() + card + f'<div style="height: 26px;"></div>'
             + p(bg, 'The same team behind Bond Dental London’s five clinics.', v(f, 26, 29, 32))
             + grow() + footer(bg))
    return bg, inner


def c13(f):
    bg = BLACK
    photo = slot(bg, 'Photo · Dr Kev Patel', 'Still from Kev’s founder videos (portrait crop, raw file preferred).',
                 f'width: {v(f, 300, 360, 100)}{"px" if f != "9x16" else "%"}; flex-shrink: 0; {"height: 520px;" if f == "9x16" else "align-self: stretch;"}')
    quote = (f'<div style="{DISPLAY} font-weight: 800; font-size: {v(f, 150, 170, 190)}px; line-height: 0.6; color: {GOLD}; height: {v(f, 70, 80, 90)}px;">“</div>'
             + h(bg, 'You’ve aligned your career, your relationships, basically your whole life. It’s about time your smile caught up.',
                 v(f, 46, 52, 60), 600, True, lh=1.12, ls='-0.01em')
             + f'<div style="height: 28px;"></div>'
             + f'<div style="{BODY} font-size: 22px; font-weight: 700; letter-spacing: 4px; text-transform: uppercase; color: {GOLD};">Dr Kev Patel</div>'
             + p(bg, 'Founder &amp; CEO, Bond Dental London', 22))
    if f == '9x16':
        mid = photo + f'<div style="height: 56px;"></div>' + f'<div style="display: flex; flex-direction: column;">{quote}</div>'
    else:
        mid = (f'<div style="display: flex; gap: 48px; flex-grow: 1; min-height: 0;">{photo}'
               f'<div style="display: flex; flex-direction: column; justify-content: center; flex-grow: 1;">{quote}</div></div>')
    inner = mid + (grow() if f == '9x16' else f'<div style="height: 48px;"></div>') + footer(bg)
    return bg, inner


def c14(f):
    bg = CREAM
    lines = ['No hard sell.', 'No rush.', 'A clear plan and a clear price before you commit.']
    lst = ''.join(f'<div style="display: flex; gap: 26px; align-items: baseline;"><div style="width: 44px; height: 4px; background: {GOLD}; flex-shrink: 0; transform: translateY(-10px);"></div>'
                  f'{p(bg, t, v(f, 34, 38, 42), lh=1.25)}</div>' for t in lines)
    inner = (h(bg, 'Premium,', v(f, 104, 116, 128), 800)
             + h(bg, 'without the pressure.', v(f, 80, 88, 100), 600, True)
             + grow() + f'<div style="display: flex; flex-direction: column; gap: {v(f, 22, 30, 40)}px;">{lst}</div>'
             + grow() + footer(bg))
    return bg, inner


def c15(f):
    bg = GOLD
    inner = (eyebrow(bg, 'The real Invisalign', 20) + grow()
             + h(bg, 'Plot twist:', v(f, 64, 72, 80), 700, True, ls='-0.01em')
             + h(bg, 'it’s £995.', v(f, 212, 232, 250), 900, lh=0.9, ls='-0.05em')
             + f'<div style="height: {v(f, 32, 44, 56)}px;"></div>' + rule(bg) + f'<div style="height: 26px;"></div>'
             + p(bg, 'Invisalign Express at Bond Dental London. Up to 7 aligners.<br>0% finance available over up to 36 months.', v(f, 28, 31, 35))
             + grow() + footer(bg))
    return bg, inner


def c16(f):
    bg = BLACK
    photo = slot(bg, 'Photo · candid smile', 'Warm, unposed smile. Real patient or UGC (Izzie, pending paid-partnership permission).', 'flex-grow: 1; min-height: 0;')
    inner = (photo + f'<div style="height: {v(f, 40, 52, 64)}px;"></div>'
             + h(bg, 'Honestly?', v(f, 64, 72, 80), 600, True, ls='-0.01em')
             + h(bg, 'It’s £995.', v(f, 124, 136, 150), 900, lh=0.92, ls='-0.04em')
             + f'<div style="height: 22px;"></div>'
             + p(bg, 'Same clinicians. Same clinics. Clearer pricing.', v(f, 28, 31, 35))
             + f'<div style="height: {v(f, 40, 52, 64)}px;"></div>' + footer(bg))
    return bg, inner


TIERS = [('Express', '£995', 'Approx. £28 a month', 'Up to 7 aligners'),
         ('Lite', '£1,995', 'Approx. £55 a month', 'Up to 14 aligners'),
         ('Moderate', '£2,995', 'Approx. £83 a month', 'Up to 20 aligners'),
         ('Comprehensive', '£3,595', 'Approx. £99.86 a month', 'Unlimited aligners')]


def c17(f):
    bg = CREAM
    cols = 1 if f == '9x16' else 2
    cards = ''
    for name, price, mo, al in TIERS:
        hi = name == 'Moderate'
        cb, cf = (BLACK, GOLD) if hi else ('transparent', BLACK)
        cards += (f'<div style="background: {cb}; color: {cf}; border: 2px solid {BLACK}; padding: {v(f, 22, 28, 26)}px {v(f, 26, 30, 32)}px; display: flex; '
                  f'flex-direction: {"row" if f == "9x16" else "column"}; {"justify-content: space-between; align-items: center;" if f == "9x16" else ""} gap: 8px; box-sizing: border-box;">'
                  f'<div style="display: flex; flex-direction: column; gap: 6px;"><div style="{BODY} font-size: 19px; font-weight: 700; letter-spacing: 4px; text-transform: uppercase;">{name}</div>'
                  f'<div style="{DISPLAY} font-weight: 800; font-size: {v(f, 56, 62, 60)}px; letter-spacing: -0.03em; line-height: 1;">{price}</div></div>'
                  f'<div style="display: flex; flex-direction: column; gap: 4px; {"text-align: right;" if f == "9x16" else ""}"><div style="{BODY} font-size: {v(f, 22, 24, 25)}px; font-weight: 700;">{mo}</div>'
                  f'<div style="{BODY} font-size: {v(f, 21, 23, 24)}px;">{al}</div></div></div>')
    inner = (h(bg, 'The fine print?', v(f, 72, 80, 90), 600, True)
             + h(bg, 'There isn’t much.', v(f, 72, 80, 90), 800)
             + grow() + f'<div style="display: grid; grid-template-columns: repeat({cols}, minmax(0, 1fr)); gap: {v(f, 16, 20, 18)}px;">{cards}</div>'
             + f'<div style="height: 20px;"></div>' + p(bg, FIN_FOOT, 18, lh=1.35)
             + grow() + footer(bg, None, 200))
    return bg, inner


def c18(f):
    bg = BLACK
    rows = ''.join(f'<div style="display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: {v(f, 20, 26, 34)}px 0; border-top: 2px solid rgba(210,183,140,0.5);">'
                   f'<div style="display: flex; flex-direction: column; gap: 6px;"><div style="{BODY} font-size: 20px; font-weight: 700; letter-spacing: 4px; text-transform: uppercase; color: {GOLD};">{n}</div>'
                   f'{p(bg, al, v(f, 26, 28, 31))}</div>'
                   f'{h(bg, pr, v(f, 64, 70, 78), 800, align="right", lh=1)}</div>' for n, pr, _, al in TIERS)
    inner = (h(bg, 'Four prices.', v(f, 84, 92, 104), 800)
             + h(bg, 'Which one’s yours?', v(f, 84, 92, 104), 600, True)
             + grow() + f'<div style="display: flex; flex-direction: column; border-bottom: 2px solid rgba(210,183,140,0.5);">{rows}</div>'
             + f'<div style="height: 24px;"></div>'
             + p(bg, 'Your dentist confirms which plan suits you at your assessment. 0% finance available on every plan.', v(f, 24, 26, 29))
             + grow() + footer(bg))
    return bg, inner


def c19(f):
    bg = GOLD
    inner = (eyebrow(bg, 'Genuine Invisalign', 20) + grow()
             + h(bg, 'From around', v(f, 58, 64, 72), 600, True, ls='-0.01em')
             + h(bg, '£28', v(f, 250, 280, 310), 900, lh=0.88, ls='-0.05em')
             + h(bg, 'a month.', v(f, 72, 80, 90), 800)
             + f'<div style="height: {v(f, 28, 40, 52)}px;"></div>'
             + p(bg, 'Express plan, £995, spread over 36 months at 0% finance.', v(f, 28, 31, 35))
             + f'<div style="height: 18px;"></div>' + p(bg, FIN_FOOT, 18, lh=1.35)
             + grow() + footer(bg))
    return bg, inner


def c20(f):
    bg = BLACK
    inc = ['Moderate plan: up to 20 aligners', 'Complimentary whitening', 'Complimentary removable retainer',
           'The Bond bag starter kit', 'Personalised treatment simulation']
    lst = ''.join(f'<div style="display: flex; gap: 20px; align-items: center;">{tick(bg, v(f, 32, 36, 40))}{p(bg, t, v(f, 29, 32, 36), lh=1.2)}</div>' for t in inc)
    inner = (h(bg, '£2,995.', v(f, 170, 186, 200), 900, lh=0.9, ls='-0.045em')
             + h(bg, 'Whitening included.', v(f, 64, 70, 78), 600, True, ls='-0.01em')
             + grow() + f'<div style="display: flex; flex-direction: column; gap: {v(f, 16, 22, 30)}px;">{lst}</div>'
             + grow() + footer(bg))
    return bg, inner


def c21(f):
    bg = CREAM
    quote = (f'<div style="position: relative; align-self: flex-start;">'
             + h(bg, '“My teeth aren’t<br>bad enough.”', v(f, 92, 100, 110), 600, True, ls='-0.02em')
             + f'<div style="position: absolute; left: -12px; right: -12px; top: 50%; height: 12px; background: {GOLD}; transform: rotate(-4deg);"></div></div>')
    inner = (eyebrow(bg, 'Heard it before', 20) + grow() + quote
             + f'<div style="height: {v(f, 48, 64, 80)}px;"></div>'
             + h(bg, 'That’s exactly what<br>Express is for.', v(f, 64, 70, 78), 800)
             + f'<div style="height: 22px;"></div>'
             + p(bg, 'Up to 7 aligners. £995. Genuine Invisalign at Bond Dental London.<br>Suitability confirmed at your assessment.', v(f, 27, 30, 34))
             + grow() + footer(bg))
    return bg, inner


def checkbox(bg, checked, size):
    if checked:
        return (f'<div style="width: {size}px; height: {size}px; background: {GOLD}; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">'
                f'<svg width="{int(size*0.7)}" height="{int(size*0.7)}" viewBox="0 0 24 24" fill="none" stroke="{BLACK}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12.5l5 5 10-11"/></svg></div>')
    return f'<div style="width: {size}px; height: {size}px; border: 3px solid {GOLD}; box-sizing: border-box; flex-shrink: 0;"></div>'


def c22(f):
    bg = BLACK
    items = [('Hiding it on video calls.', False), ('Cropping it out of photos.', False),
             ('Holding back your smile on first dates.', False), ('Booking the consultation.', True)]
    lst = ''.join(f'<div style="display: flex; gap: 26px; align-items: center;">{checkbox(bg, c, v(f, 44, 48, 52))}'
                  f'{h(bg, t, v(f, 38, 42, 46), 800 if c else 500, c, lh=1.15, ls="-0.01em")}</div>' for t, c in items)
    inner = (h(bg, 'Sound familiar?', v(f, 104, 112, 124), 800)
             + grow() + f'<div style="display: flex; flex-direction: column; gap: {v(f, 30, 40, 52)}px;">{lst}</div>'
             + grow() + footer(bg, tagline_small(bg, 30)))
    return bg, inner


def c23(f):
    bg = GOLD
    ring = (f'<svg width="{v(f, 170, 190, 220)}" height="{v(f, 170, 190, 220)}" viewBox="0 0 100 100" aria-hidden="true" '
            f'style="position: absolute; left: 56%; top: 38%;"><ellipse cx="50" cy="50" rx="44" ry="40" fill="none" stroke="{BLACK}" stroke-width="3" transform="rotate(-8 50 50)"/></svg>')
    photo = (f'<div style="position: relative; flex-grow: 1; min-height: 0; display: flex;">'
             + slot(bg, 'Photo · extreme close-crop smile', 'One slightly crooked front tooth, natural light. Ring marks the tooth.', 'flex-grow: 1;')
             + ring + '</div>')
    inner = (photo + f'<div style="height: {v(f, 40, 52, 64)}px;"></div>'
             + h(bg, 'That one tooth.', v(f, 104, 112, 124), 800)
             + f'<div style="height: 20px;"></div>'
             + p(bg, 'You notice it in every photo. Your assessment will show you what it would take to straighten it.', v(f, 28, 31, 35))
             + f'<div style="height: {v(f, 40, 52, 64)}px;"></div>' + footer(bg))
    return bg, inner


def c24(f):
    bg = CREAM
    years = ['2021', '2022', '2023', '2024', '2025'] if f != '1x1' else ['2022', '2023', '2024', '2025']
    rs = v(f, 20, 24, 30)
    rows = ''
    for y in years:
        rows += (f'<div style="display: flex; align-items: center; gap: 22px; padding: {rs}px 28px; border-bottom: 2px solid rgba(10,10,10,0.14);">'
                 f'<div style="width: 34px; height: 34px; border-radius: 50%; border: 3px solid {BLACK}; box-sizing: border-box; flex-shrink: 0;"></div>'
                 f'<div style="flex-grow: 1; {BODY} font-size: {v(f, 28, 30, 32)}px; color: {BLACK};">Sort my teeth out</div>'
                 f'<div style="{BODY} font-size: {v(f, 22, 24, 25)}px; font-style: italic; color: {BLACK};">{y} · Snoozed</div></div>')
    rows += (f'<div style="display: flex; align-items: center; gap: 22px; padding: {rs + 6}px 28px; background: {GOLD};">'
             f'<div style="width: 34px; height: 34px; border-radius: 50%; background: {BLACK}; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">'
             f'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="{GOLD}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12.5l5 5 10-11"/></svg></div>'
             f'<div style="flex-grow: 1; {BODY} font-size: {v(f, 28, 30, 32)}px; font-weight: 700; color: {BLACK};">Book the consultation</div>'
             f'<div style="{BODY} font-size: {v(f, 22, 24, 25)}px; font-weight: 700; color: {BLACK};">2026 · Done</div></div>')
    card = (f'<div style="border: 2px solid {BLACK}; border-radius: 28px; overflow: hidden; background: {CREAM};">'
            f'<div style="padding: 22px 28px; border-bottom: 2px solid {BLACK}; {BODY} font-size: 20px; font-weight: 700; letter-spacing: 4px; text-transform: uppercase;">Reminders</div>{rows}</div>')
    inner = (h(bg, 'You’ve been meaning<br>to for years.', v(f, 76, 84, 94), 800)
             + grow() + card + grow() + footer(bg, tagline_small(bg, 30)))
    return bg, inner


def c25(f):
    bg = BLACK
    n = 6 if f == '9x16' else 4
    mic = ('<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
           '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 11 4.7M18.5 11c0 .7-.1 1.3-.3 1.9M12 17.5V21M3 3l18 18"/></svg>')
    tiles = ''
    for i in range(n):
        you = i == (1 if n == 4 else 3)
        tb, tc = (GOLD, BLACK) if you else ('rgba(210,183,140,0.12)', GOLD)
        label = 'You' if you else ['A', 'B', 'C', 'D', 'E', 'F'][i]
        tiles += (f'<div style="background: {tb}; color: {tc}; border: 2px solid {GOLD}; position: relative; display: flex; align-items: center; justify-content: center;">'
                  f'<div style="width: {v(f, 96, 110, 120)}px; height: {v(f, 96, 110, 120)}px; border-radius: 50%; border: 2px solid {tc}; display: flex; align-items: center; justify-content: center; {DISPLAY} font-weight: 800; font-size: {v(f, 34, 38, 42)}px;">{label}</div>'
                  f'<div style="position: absolute; left: 16px; bottom: 14px; display: flex; align-items: center; gap: 8px; {BODY} font-size: 18px; font-weight: 700;">{mic if you else ""}{"Straightening" if you else ""}</div></div>')
    rows = 3 if n == 6 else 2
    grid = (f'<div style="flex-grow: 1; min-height: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: repeat({rows}, minmax(0, 1fr)); gap: 16px;">{tiles}</div>')
    inner = (h(bg, 'Straightening, <span style="font-style: italic; font-weight: 600;">on mute.</span>', v(f, 76, 84, 94), 800)
             + f'<div style="height: {v(f, 32, 44, 56)}px;"></div>' + grid
             + f'<div style="height: {v(f, 32, 44, 56)}px;"></div>'
             + p(bg, 'Invisalign clear aligners are designed to be discreet, on camera and off.', v(f, 28, 31, 35))
             + f'<div style="height: {v(f, 36, 48, 60)}px;"></div>' + footer(bg))
    return bg, inner


def c26(f):
    bg = BLACK
    cw = v(f, 560, 640, 760)
    card = (f'<div style="align-self: center; width: {cw}px; height: {int(cw / 1.586)}px; background: {GOLD}; border-radius: 30px; padding: 36px 40px; box-sizing: border-box; '
            f'display: flex; flex-direction: column; justify-content: space-between; flex-shrink: 0; transform: rotate(-4deg);">'
            f'<div style="display: flex; justify-content: space-between; align-items: flex-start;"><img src="{MARK["black"]}" alt="" style="height: {int(cw*0.12)}px; width: auto; display: block;">'
            f'<div style="{BODY} font-size: 18px; font-weight: 700; letter-spacing: 4px; text-transform: uppercase; color: {BLACK};">Member</div></div>'
            f'<div style="display: flex; justify-content: space-between; align-items: flex-end;">'
            f'<div style="{DISPLAY} font-weight: 800; font-stretch: 125%; font-size: {int(cw*0.05)}px; letter-spacing: 0.08em; color: {BLACK}; line-height: 1.2;">BOND ALIGNER<br><span style="font-weight: 500; letter-spacing: 0.5em;">CLUB</span></div>'
            f'<div style="{BODY} font-size: 18px; color: {BLACK}; text-align: right;">Member since<br><b>2026</b></div></div></div>')
    perks = ['Complimentary dental health assessment', '10% off for Bond Dental patients', 'Whitening on Moderate and Comprehensive',
             'Complimentary removable retainer', 'The Bond bag starter kit', 'Personalised treatment simulation']
    cols = 1 if f == '9x16' else 2
    lst = ''.join(f'<div style="display: flex; gap: 14px; align-items: flex-start;">{tick(bg, 28)}{p(bg, t, v(f, 23, 25, 29), lh=1.25)}</div>' for t in perks)
    inner = (card + f'<div style="height: {v(f, 48, 64, 80)}px;"></div>'
             + h(bg, 'Come be part of the club.', v(f, 68, 76, 86), 800)
             + f'<div style="height: {v(f, 26, 32, 40)}px;"></div>'
             + f'<div style="display: grid; grid-template-columns: repeat({cols}, minmax(0, 1fr)); column-gap: 36px; row-gap: {v(f, 14, 18, 22)}px;">{lst}</div>'
             + grow() + footer(bg))
    return bg, inner


def c27(f):
    bg = GOLD
    photo = slot(bg, 'Photo · The Bond bag', 'Flat-lay of the branded starter aligner kit. Needs the real kit photographed.', 'flex-grow: 1; min-height: 0;')
    inner = (photo + f'<div style="height: {v(f, 40, 52, 64)}px;"></div>'
             + h(bg, 'Your welcome kit’s waiting.', v(f, 76, 84, 94), 800)
             + f'<div style="height: 20px;"></div>'
             + p(bg, 'Every club member gets the Bond bag: a branded starter aligner kit.', v(f, 28, 31, 35))
             + f'<div style="height: {v(f, 40, 52, 64)}px;"></div>' + footer(bg))
    return bg, inner


def c28(f):
    bg = CREAM
    halves = (f'<div style="flex-grow: 1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px;">'
              + slot(BLACK, 'Today', 'Real scan image', 'min-height: 0;')
              + slot(BLACK, 'Simulation', 'Real simulation screenshot, approved by Bond', 'min-height: 0;') + '</div>')
    tablet = (f'<div style="flex-grow: 1; min-height: 0; background: {BLACK}; border-radius: 36px; padding: 26px; display: flex; flex-direction: column; gap: 18px;">'
              f'<div style="display: flex; justify-content: space-between; {BODY} font-size: 18px; font-weight: 700; letter-spacing: 4px; text-transform: uppercase; color: {GOLD};"><span>Your treatment plan</span><span>Preview</span></div>'
              f'{halves}</div>')
    inner = (h(bg, 'See your smile', v(f, 84, 92, 102), 800)
             + h(bg, 'before you commit.', v(f, 84, 92, 102), 600, True)
             + f'<div style="height: {v(f, 32, 44, 56)}px;"></div>' + tablet
             + f'<div style="height: {v(f, 28, 40, 52)}px;"></div>'
             + p(bg, 'A personalised treatment plan simulation, included for every member.', v(f, 28, 31, 35))
             + f'<div style="height: {v(f, 36, 48, 60)}px;"></div>' + footer(bg))
    return bg, inner


def c29(f):
    bg = BLACK
    inner = (eyebrow(bg, 'Already a Bond Dental patient?', 22) + grow()
             + h(bg, 'Welcome<br>back.', v(f, 180, 196, 214), 800, lh=0.9, ls='-0.04em')
             + f'<div style="height: {v(f, 40, 52, 64)}px;"></div>' + rule(bg) + f'<div style="height: 28px;"></div>'
             + h(bg, '10% off your Bond Aligner Club treatment.', v(f, 48, 54, 60), 600, True, lh=1.1, ls='-0.01em')
             + f'<div style="height: 22px;"></div>'
             + p(bg, 'Same clinicians. Same clinics. Clearer pricing.', v(f, 27, 30, 34))
             + grow() + footer(bg))
    return bg, inner


def c30(f):
    bg = BLACK
    qa = [('What does it cost?', '£995, £1,995, £2,995 or £3,595, depending on your plan.'),
          ('Is it the real Invisalign?', 'Yes. The same Invisalign, from the same Bond Dental clinicians.'),
          ('Can I spread the cost?', 'Yes. 0% finance is available on every plan, over up to 36 months.'),
          ('Where is treatment?', 'At Bond Dental London, starting at our Marylebone clinic.'),
          ('What’s the first step?', 'A consultation, where you see your options before you commit.')]
    if f == '1x1':
        qa = [qa[0], qa[1], qa[2], qa[4]]
    lst = ''.join(f'<div style="display: flex; flex-direction: column; gap: 6px; padding-top: {v(f, 16, 22, 30)}px; border-top: 2px solid rgba(210,183,140,0.5);">'
                  f'{h(bg, q, v(f, 32, 35, 39), 800, lh=1.1, ls="-0.01em")}{p(bg, a, v(f, 24, 26, 29), lh=1.3)}</div>' for q, a in qa)
    inner = (h(bg, 'You’ll never<br>leave wondering.', v(f, 80, 88, 98), 800)
             + grow() + f'<div style="display: flex; flex-direction: column; gap: {v(f, 16, 22, 30)}px;">{lst}</div>'
             + grow() + footer(bg))
    return bg, inner


# ---------- catalogue ----------
CREATIVES = [
    # id, fn, page, row title, sticky
    ('01', c01, 'a', 'Start as you mean to go on.', 'Persona: all (campaign anchor).\nType-led. Ready to review.'),
    ('02', c02, 'a', 'Nobody’s the main character every day.', 'Persona: Smile Investor.\nNeeds photo: candid close-crop smile (Chaz shoot / UGC).'),
    ('03', c03, 'a', 'Starting Well: the film poster', 'Persona: all. Ties to the campaign film.\nBilling block carries all four prices.'),
    ('04', c04, 'a', 'No more “wait, delete that one.”', 'Persona: Boardroom / Not Bad Enough.\nNeeds 4 photo-booth frames (same person).'),
    ('05', c05, 'a', 'The screenplay page', 'Persona: Smile Investor.\nType-led. Scene set at Marylebone (launch booking clinic).'),
    ('06', c06, 'b', 'The real Invisalign. No stunt double.', 'Persona: Smile Investor / Discerning.\nType-led: film credits, “Stunt doubles: None”.'),
    ('07', c07, 'b', 'Aligners by post, or a dentist you can actually see?', 'Persona: Smile Investor / Price-Aware.\nNo competitor named; Bond-only ticks.\nCHECK with Kev: in-chair progress checks are accurate for every tier.'),
    ('08', c08, 'b', 'It’s not just about the photos.', 'Persona: Not Bad Enough.\nEducation piece (deck asks for genuine education).'),
    ('09', c09, 'b', 'Not a lookalike.', 'Persona: Discerning.\nNeeds product still.\nCONFIRM Diamond Provider status is current for 2026.'),
    ('10', c10, 'b', 'The whole plot, in four scenes.', 'Persona: all.\nType-led explainer of the treatment journey.'),
    ('11', c11, 'c', 'Same clinics. Same crew.', 'Persona: Discerning / Smile Investor.\nUses the real Mayfair lobby photo.'),
    ('12', c12, 'c', 'Still our clinics. Still our team.', 'Persona: Discerning.\nMarylebone-led per the “five clinics, soft” decision.'),
    ('13', c13, 'c', 'Kev: “It’s about time your smile caught up.”', 'Persona: Smile Investor / Boardroom.\nNeeds Kev still (raw landscape file for a clean portrait crop).\nQuote is from the approved landing page.'),
    ('14', c14, 'c', 'Premium, without the pressure.', 'Persona: Discerning / anxious.\nType-led.'),
    ('15', c15, 'd', 'Plot twist: it’s £995.', 'Persona: Price-Aware.\nType-led. Deck’s affordability line verbatim.'),
    ('16', c16, 'd', 'Honestly? It’s £995.', 'Persona: Price-Aware / Not Bad Enough.\nNeeds candid smile photo.'),
    ('17', c17, 'd', 'HOLD · The fine print? There isn’t much.', 'HOLD until the lender’s finance illustration + representative example arrive (Kev, 13 Sept).\nMonthly figures are Kev’s approximations.'),
    ('18', c18, 'd', 'Four prices. Which one’s yours?', 'Persona: Price-Aware / Not Bad Enough.\nNo monthly figures, so no hold.'),
    ('19', c19, 'd', 'HOLD · From around £28 a month.', 'HOLD until lender illustration, representative example and legal sign-off.\nEva flagged lenders pulling “from £X a month” creative.'),
    ('20', c20, 'd', '£2,995. Whitening included.', 'Persona: Price-Aware / Smile Investor.\nModerate tier value stack.'),
    ('21', c21, 'e', '“My teeth aren’t bad enough.”', 'Persona: Not Bad Enough (Claire’s insight).\nSuitability caveat included.'),
    ('22', c22, 'e', 'Sound familiar?', 'Persona: Boardroom.\nPain points from the landing page.'),
    ('23', c23, 'e', 'That one tooth.', 'Persona: Not Bad Enough.\nNeeds extreme close-crop smile.'),
    ('24', c24, 'e', 'You’ve been meaning to for years.', 'Persona: Smile Investor.\nType-led reminders list.'),
    ('25', c25, 'e', 'Straightening, on mute.', 'Persona: Boardroom.\nType-led video-call grid.'),
    ('26', c26, 'f', 'Come be part of the club.', 'Persona: all.\nMembership card + all six club benefits.'),
    ('27', c27, 'f', 'Your welcome kit’s waiting.', 'Persona: Smile Investor.\nNeeds a real photo of the Bond bag.'),
    ('28', c28, 'f', 'See your smile before you commit.', 'Persona: Smile Investor / Discerning.\nNeeds a real simulation screenshot Bond approves.'),
    ('29', c29, 'f', 'Welcome back. 10% off.', 'Existing Bond Dental patients ONLY (custom audience).\nNever run to cold audiences: reads as a discount.'),
    ('30', c30, 'f', 'You’ll never leave wondering.', 'Persona: all (retargeting).\n1:1 drops the “Where” question for space.'),
]
PAGES = [('a', 'A · Campaign hero'), ('b', 'B · Quality'), ('c', 'C · Premium'),
         ('d', 'D · Price-aware'), ('e', 'E · Emotional'), ('f', 'F · Club')]

TEMPLATE = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link href="{fonts}" rel="stylesheet">
<style>
body{{margin:0}}
</style>
</helmet>
{root}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{w},"height":{h}}}}}'>
class Component extends DCLogic {{
renderVals() {{
return {{}};
}}
}}
</script>
</body>
</html>
'''

boards, order, notes = {}, [], {}
ROW_PITCH = 2420
COL_X = [0, 1160, 2320]
page_rows = {}
for cid, fn, page, rtitle, sticky in CREATIVES:
    r = page_rows.get(page, 0)
    page_rows[page] = r + 1
    y = r * ROW_PITCH
    for ci, (fk, w, hh, lab) in enumerate(FMTS):
        res = fn(fk)
        bg, inner = res[0], res[1]
        gap = res[2] if len(res) > 2 else 0
        pad = res[3] if len(res) > 3 else None
        html = TEMPLATE.format(title=f'BAC-{cid} {lab}', fonts=FONTS, root=root(fk, w, hh, bg, inner, gap, pad), w=w, h=hh)
        name = 'Main.dc.html' if (cid == '01' and fk == '1x1') else f'BAC-{cid}-{fk}.dc.html'
        with open(os.path.join(PROJ, name), 'w') as fh:
            fh.write(html)
        boards[name] = {'x': COL_X[ci], 'y': y, 'w': w, 'h': hh, 'title': f'BAC-{cid} · {lab}', 'page': page}
        order.append(name)
    notes[f't{cid}'] = {'x': 0, 'y': y - 260, 'text': f'BAC-{cid} · {rtitle}', 'kind': 'title1', 'maxW': 3400, 'page': page}
    notes[f's{cid}'] = {'x': 3480, 'y': y, 'text': sticky, 'w': 620, 'size': 'l',
                        'color': 'red' if 'HOLD' in sticky or 'CONFIRM' in sticky or 'CHECK' in sticky else 'orange' if 'Needs' in sticky else 'green',
                        'page': page}

canvas = {
    'v': 3,
    'createdOnFiles': {'v': 1, 'at': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')},
    'title': 'Bond Aligner Club Meta Statics',
    'launch': {'view': 'canvas', 'page': 'a'},
    'pages': [{'id': pid, 'name': pn} for pid, pn in PAGES],
    'boards': boards,
    'order': order,
    'notes': notes,
    'designSystems': [],
}
with open(os.path.join(PROJ, 'canvas.json'), 'w') as fh:
    json.dump(canvas, fh, ensure_ascii=False, indent=1)
print(len(boards), 'artboards;', len(notes), 'notes')
