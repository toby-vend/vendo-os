"""Section E: Emotional (BAC-21 to BAC-25), v2."""
from lib2 import *
from sec_b import two_line_head
from sec_d import PAPER, tick

STICKY = ('radial-gradient(120% 90% at 20% 0%, #F3E6CC 0%, #D2B78C 55%, #BFA47A 100%)')


def scribble(col=GOLD, sw=9):
    return (f'<svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true" style="position: absolute; left: -4%; top: 0; width: 108%; height: 100%; overflow: visible;">'
            + ''.join(f'<path d="M2 {y} C 14 {y - 3}, 22 {y + 3}, 34 {y - 1} S 52 {y - 3}, 60 {y + 1} S 80 {y + 3}, {e} {y - 2}" stroke="{col}" stroke-width="{sw}" stroke-linecap="round" fill="none" vector-effect="non-scaling-stroke"/>'
                      for y, e in ((7.5, 98), (21, 96), (34, 58)))
            + f'<path d="M4 16 C 30 12, 60 26, 94 10" stroke="{col}" stroke-width="{sw - 3}" stroke-linecap="round" fill="none" vector-effect="non-scaling-stroke" opacity="0.8"/></svg>')


# ---------- BAC-21: sticky notes ----------
def bac21(f, w, h):
    s1 = v(f, 560, 620, 720)
    s2 = v(f, 400, 440, 500)
    hand = f'{HAND} font-weight: 700; color: {BLACK}; line-height: 1.02;'
    note1 = (f'<div style="position: absolute; left: 0; top: 0; width: {s1}px; height: {s1}px; transform: rotate(-5deg); background: {STICKY}; '
             f'box-shadow: 0 30px 40px -18px rgba(10,10,10,0.55), 0 6px 10px -4px rgba(10,10,10,0.25); padding: {int(s1 * 0.12)}px; box-sizing: border-box;">'
             + grain('dark', 0.35, 'multiply') +
             f'<div style="position: absolute; left: 0; right: 0; top: 0; height: {int(s1 * 0.1)}px; background: linear-gradient(180deg, rgba(10,10,10,0.07), rgba(10,10,10,0));"></div>'
             f'<div style="position: relative; {hand} font-size: {int(s1 * 0.15)}px;">Note to self:</div>'
             f'<div style="position: relative; margin-top: {int(s1 * 0.06)}px; display: inline-block;">'
             f'<div style="{hand} font-size: {int(s1 * 0.13)}px;">my teeth aren’t<br>bad enough to<br>bother.</div>{scribble(BLACK, 7)}</div></div>')
    note2 = (f'<div style="position: absolute; left: {int(s1 * 0.52)}px; top: {int(s1 * 0.62)}px; width: {s2}px; height: {s2}px; transform: rotate(6deg); background: {BLACK}; '
             f'box-shadow: 0 34px 44px -18px rgba(10,10,10,0.7); padding: {int(s2 * 0.12)}px; box-sizing: border-box; color: {GOLD};">'
             + grain('light', 0.3, 'overlay') +
             f'<div style="position: relative; {HAND} font-weight: 700; font-size: {int(s2 * 0.13)}px; line-height: 1.05;">Update:</div>'
             f'<div style="position: relative; {SERIF} font-size: {int(s2 * 0.135)}px; line-height: 1.05; margin-top: {int(s2 * 0.05)}px;">That’s exactly what Express is for.</div>'
             f'<div style="position: relative; {BODY} font-size: {int(s2 * 0.05)}px; font-weight: 900; letter-spacing: 3px; text-transform: uppercase; margin-top: {int(s2 * 0.07)}px;">Up to 7 aligners · £995</div></div>')
    stack_w, stack_h = int(s1 * 0.52) + s2 + 30, int(s1 * 0.62) + s2 + 20
    stack = f'<div style="position: relative; width: {stack_w}px; height: {stack_h}px; align-self: center; flex-shrink: 0;">{note1}{note2}</div>'
    content = (f'<div style="{BODY} font-size: 17px; font-weight: 700; letter-spacing: 7px; text-transform: uppercase; color: {BLACK};">Heard it before</div>'
               + grow() + stack + grow() + spacer(v(f, 10, 20, 30))
               + f'<div style="{BODY} font-size: {v(f, 24, 27, 31)}px; line-height: 1.35; color: {BLACK};">Genuine Invisalign at Bond Dental London. Suitability confirmed at your assessment.</div>'
               + spacer(v(f, 26, 36, 48)) + footer('black'))
    return frame(w, h, BG_CREAM, BLACK, '', content, grain('dark', 0.2, 'multiply'), PAD[f])


# ---------- BAC-22: magazine quiz ----------
def hand_box(checked, size):
    box = (f'<svg width="{size}" height="{size}" viewBox="0 0 40 40" aria-hidden="true" style="flex-shrink: 0; overflow: visible;">'
           f'<path d="M5 6 L35 5 L36 35 L4 36 Z" fill="none" stroke="{BLACK}" stroke-width="2.4" stroke-linejoin="round"/>')
    if checked == 'x':
        box += (f'<path d="M9 12 C 16 20, 24 26, 32 32" stroke="{BLACK}" stroke-width="3.4" stroke-linecap="round" fill="none"/>'
                f'<path d="M31 10 C 24 18, 16 26, 8 33" stroke="{BLACK}" stroke-width="3.4" stroke-linecap="round" fill="none"/>')
    elif checked == 'tick':
        box += f'<path d="M8 20 L 17 30 L 42 -4" stroke="#8F7B5A" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
    return box + '</svg>'


def bac22(f, w, h):
    cw = v(f, 880, 900, 912)
    items = [('Hiding your smile on video calls.', 'x'), ('Cropping it out of photos.', 'x'),
             ('Holding back on first dates.', 'x'), ('Booking the consultation.', 'tick')]
    rows = ''
    for i, (t, c) in enumerate(items):
        last = c == 'tick'
        rows += (f'<div style="display: flex; align-items: center; gap: 24px; padding: {v(f, 16, 20, 26)}px 0; '
                 f'{"" if last else "border-bottom: 1px solid rgba(10,10,10,0.2);"} position: relative;">'
                 f'<div style="{MONO} font-size: {v(f, 18, 20, 22)}px; width: 34px; flex-shrink: 0;">{chr(65 + i)}.</div>'
                 f'{hand_box(c, v(f, 44, 48, 54))}'
                 f'<div style="{SANS if last else BODY} {"font-weight: 800;" if last else ""} font-size: {v(f, 30, 33, 37)}px; line-height: 1.2; letter-spacing: {"-0.01em" if last else "0"};">{t}</div></div>')
    ring = (f'<svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true" style="position: absolute; left: -{v(f, 20, 20, 22)}px; bottom: -{v(f, 16, 18, 22)}px; '
            f'width: {cw - 60}px; height: {v(f, 96, 104, 120)}px; overflow: visible;">'
            f'<path d="M50 3 C 80 2, 98 8, 97 16 C 96 25, 72 28, 48 28 C 20 28, 3 23, 4 14 C 5 6, 26 2, 58 4" stroke="#8F7B5A" stroke-width="3.5" stroke-linecap="round" fill="none" vector-effect="non-scaling-stroke"/></svg>')
    page_ = (f'<div style="width: {cw}px; align-self: center; flex-shrink: 0; position: relative; transform: rotate(-1.5deg); box-shadow: {SHADOW_DEEP}; '
             f'background: {PAPER}; padding: {v(f, 34, 42, 50)}px {v(f, 44, 50, 54)}px {v(f, 40, 50, 60)}px; box-sizing: border-box; color: {BLACK};">'
             + grain('dark', 0.3, 'multiply') +
             f'<div style="position: relative; display: flex; justify-content: space-between; align-items: baseline; padding-bottom: 14px; border-bottom: 3px double {BLACK};">'
             f'<div style="{SANS} font-weight: 800; font-stretch: 125%; font-size: {v(f, 20, 22, 24)}px; letter-spacing: 0.14em;">THE QUIZ</div>'
             f'<div style="{MONO} font-size: {v(f, 16, 17, 19)}px;">Tick all that apply</div></div>'
             f'<div style="position: relative; {SERIF} font-size: {v(f, 60, 68, 76)}px; line-height: 1; margin: {v(f, 20, 26, 32)}px 0 {v(f, 8, 12, 16)}px;">Sound familiar?</div>'
             f'<div style="position: relative;">{rows}{ring}</div></div>')
    right = (f'<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 16px;">'
             f'<div style="{SERIF} font-size: {v(f, 38, 44, 50)}px; color: {GOLD}; line-height: 1; text-align: right;">Start as you mean to go on.</div>{cta("gold")}</div>')
    content = (f'<div style="{BODY} font-size: 17px; font-weight: 700; letter-spacing: 7px; text-transform: uppercase; color: {GOLD};">A short quiz</div>'
               + grow() + page_ + grow() + spacer(v(f, 20, 30, 40)) + footer('gold', right, 200))
    under = (f'<div style="position: absolute; left: 0; top: 0; right: 0; bottom: 0; '
             f'background: radial-gradient(60% 45% at 50% 48%, rgba(210,183,140,0.2) 0%, rgba(210,183,140,0) 100%);"></div>')
    return frame(w, h, BG_BLACK, GOLD, under, content, grain('light', 0.28, 'overlay'), PAD[f])


# ---------- BAC-23: that one tooth ----------
def bac23(f, w, h):
    ph = v(f, 620, 860, 900)
    top = v(f, 0, 0, 0)
    ring = (f'<svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" style="position: absolute; left: 0; top: 0; overflow: visible; '
            f'filter: drop-shadow(0 2px 8px rgba(10,10,10,0.7));">'
            f'<path d="M50 44 C 57 42, 61 48, 60 55 C 59 62, 53 65, 48 63 C 42 61, 41 54, 43 49 C 44 46, 47 44, 52 43.5" stroke="{GOLD}" stroke-width="4.5" stroke-linecap="round" fill="none" vector-effect="non-scaling-stroke"/>'
            f'<path d="M61 47 C 66 40, 70 35, 76 31" stroke="{GOLD}" stroke-width="3.5" stroke-linecap="round" fill="none" vector-effect="non-scaling-stroke"/>'
            f'<path d="M72 30.5 L 76.5 30.8 L 75.5 35.3" stroke="{GOLD}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none" vector-effect="non-scaling-stroke"/></svg>')
    note = (f'<div style="position: absolute; left: 70%; top: {v(f, 16, 20, 21)}%; transform: rotate(-6deg); {HAND} font-weight: 700; font-size: {v(f, 58, 66, 74)}px; '
            f'color: {GOLD}; line-height: 0.95; text-shadow: 0 2px 10px rgba(10,10,10,0.9);">this one.</div>')
    photo = (f'<div style="height: {ph}px; flex-shrink: 0; position: relative; overflow: hidden; background: #111;">'
             f'<img src="{B["smile"]}" alt="" style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; object-fit: cover; object-position: 57% 55%; '
             f'transform: scale({v(f, 2.4, 2.3, 2.6)}); transform-origin: 57% 56%; filter: grayscale(1) contrast(1.15) brightness(0.92);">'
             f'<div style="position: absolute; left: 0; right: 0; top: 0; bottom: 0; background: radial-gradient(75% 65% at 50% 52%, rgba(10,10,10,0) 40%, rgba(10,10,10,0.75) 100%);"></div>'
             f'<div style="position: absolute; left: 0; right: 0; bottom: 0; height: 30%; background: linear-gradient(180deg, rgba(10,10,10,0) 0%, #0A0A0A 100%);"></div>'
             + grain('light', 0.5, 'overlay') + ring + note + '</div>')
    body = (f'<div style="flex-grow: 1; display: flex; flex-direction: column; padding: {v(f, 8, 16, 24)}px {PAD[f][1]}px {v(f, 64, 76, 330)}px {PAD[f][3]}px; box-sizing: border-box;">'
            + two_line_head('gold', 'That one tooth.', 'You notice it in every photo.', v(f, 100, 112, 124), v(f, 58, 66, 74))
            + spacer(v(f, 18, 24, 30))
            + f'<div style="{BODY} font-size: {v(f, 25, 28, 32)}px; line-height: 1.35; color: {GOLD};">Your assessment will show you what it would take to straighten it.</div>'
            + grow() + footer('gold') + '</div>')
    lead = f'<div style="height: {v(f, 0, 0, 150)}px; flex-shrink: 0;"></div>'
    return frame(w, h, BG_BLACK, GOLD, '', lead + photo + body, grain('light', 0.22, 'overlay'), (0, 0, 0, 0))


# ---------- BAC-24: phone reminders ----------
def bac24(f, w, h):
    pw = v(f, 520, 520, 580)
    phh = v(f, 820, 1000, 980)
    years = ['2021', '2022', '2023', '2024', '2025']
    fs = v(f, 22, 24, 27)
    rows = ''
    for y in years:
        rows += (f'<div style="display: flex; align-items: center; gap: 16px; padding: {v(f, 14, 18, 22)}px 0; border-bottom: 1px solid rgba(210,183,140,0.18);">'
                 f'<div style="width: 30px; height: 30px; border-radius: 50%; border: 2.5px solid rgba(210,183,140,0.55); flex-shrink: 0; box-sizing: border-box;"></div>'
                 f'<div style="flex-grow: 1;"><div style="{BODY} font-size: {fs}px; color: rgba(250,243,233,0.85);">Sort my teeth out</div>'
                 f'<div style="{BODY} font-size: {fs - 6}px; color: rgba(210,183,140,0.7); margin-top: 2px;">{y} · snoozed</div></div>'
                 f'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(210,183,140,0.6)" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M5 4 2.5 6.5M19 4l2.5 2.5"/></svg></div>')
    rows += (f'<div style="display: flex; align-items: center; gap: 16px; padding: {v(f, 16, 20, 24)}px 16px; margin: 14px -16px 0; border-radius: 16px; background: {GOLD};">'
             f'<div style="width: 30px; height: 30px; border-radius: 50%; background: {BLACK}; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">'
             f'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="{GOLD}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12.5l5 5 10-11"/></svg></div>'
             f'<div style="flex-grow: 1;"><div style="{BODY} font-size: {fs}px; font-weight: 900; color: {BLACK};">Book the consultation</div>'
             f'<div style="{BODY} font-size: {fs - 6}px; color: {BLACK}; margin-top: 2px;">2026 · done</div></div></div>')
    screen = (f'<div style="position: absolute; left: 14px; top: 14px; right: 14px; bottom: 14px; border-radius: 52px; overflow: hidden; '
              f'background: radial-gradient(100% 60% at 50% 0%, #1d1a15 0%, #0d0c0a 70%); padding: {v(f, 70, 80, 90)}px 34px 30px; box-sizing: border-box;">'
              f'<div style="position: absolute; left: 50%; top: 18px; width: 120px; height: 34px; margin-left: -60px; border-radius: 20px; background: #000;"></div>'
              f'<div style="{SANS} font-weight: 800; font-size: {v(f, 40, 44, 50)}px; color: {GOLD}; letter-spacing: -0.02em;">Reminders</div>'
              f'<div style="{BODY} font-size: {fs - 6}px; color: rgba(210,183,140,0.7); margin: 6px 0 {v(f, 10, 16, 20)}px;">6 items · 5 snoozed</div>'
              f'{rows}</div>')
    phone = (f'<div style="width: {pw}px; height: {phh}px; flex-shrink: 0; position: relative; border-radius: 66px; transform: rotate(-4deg); '
             f'background: linear-gradient(135deg, #3a3a3a 0%, #111 30%, #050505 70%, #2a2a2a 100%); '
             f'box-shadow: {SHADOW_DEEP}, inset 0 0 0 2px rgba(255,255,255,0.08);">{screen}</div>')
    story = f == '9x16'
    head = two_line_head('black', 'You’ve been meaning', 'to for years.', v(f, 80, 88, 92), v(f, 88, 96, 100))
    if story:
        content = head + grow() + f'<div style="align-self: center;">{phone}</div>' + grow() + spacer(30) + footer('black')
        over = ''
    else:
        cw = v(f, 420, 400, 0)
        right_tag = f'<div style="{SERIF} font-size: {v(f, 40, 46, 0)}px; color: {BLACK}; line-height: 1.05;">Start as you<br>mean to go on.</div>'
        content = (f'<div style="width: {cw}px;">' + two_line_head('black', 'You’ve been meaning', 'to for years.', v(f, 72, 70, 0), v(f, 80, 78, 0)) + '</div>'
                   + grow() + f'<div style="width: {cw}px;">{right_tag}</div>' + spacer(v(f, 34, 44, 0))
                   + f'<div style="width: {cw}px; display: flex; flex-direction: column; gap: 28px; align-items: flex-start;">{lockup("black", 210)}{cta("black")}</div>')
        over = f'<div style="position: absolute; right: {v(f, 60, 60, 0)}px; top: {v(f, 150, 190, 0)}px;">{phone}</div>'
    return frame(w, h, BG_GOLD, BLACK, over, content, grain('dark', 0.3, 'multiply') + grain('light', 0.3, 'overlay'), PAD[f])


# ---------- BAC-25: laptop call ----------
def avatar(col, bg, size):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 100 100" aria-hidden="true" style="position: absolute; left: 50%; bottom: 0; margin-left: -{size // 2}px;">'
            f'<circle cx="50" cy="38" r="20" fill="{col}"/><path d="M12 100 C 14 70, 30 62, 50 62 C 70 62, 86 70, 88 100 Z" fill="{col}"/></svg>')


MIC_OFF = ('<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
           '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 11 4.7M18.5 11c0 .7-.1 1.3-.3 1.9M12 17.5V21M3 3l18 18"/></svg>')


def bac25(f, w, h):
    lw = v(f, 700, 920, 940)
    sh = int(lw * 0.6)
    names = ['Priya', 'You', 'Tom', 'Grace', 'Marcus', 'Hannah']
    tiles = ''
    for i, n in enumerate(names):
        you = n == 'You'
        tb = GOLD if you else '#1b1b1b'
        ac = BLACK if you else '#2e2e2e'
        tiles += (f'<div style="position: relative; overflow: hidden; border-radius: 10px; background: {tb}; {"box-shadow: 0 0 0 4px " + GOLD + ";" if you else ""}">'
                  + avatar(ac, tb, int(sh * 0.36)) +
                  f'<div style="position: absolute; left: 10px; bottom: 10px; display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 8px; '
                  f'background: rgba(10,10,10,{0.85 if you else 0.6}); color: {GOLD}; {BODY} font-size: 15px; font-weight: 700;">{MIC_OFF if you else ""}{n}</div></div>')
    screen = (f'<div style="position: relative; width: {lw}px; height: {sh}px; background: #0c0c0c; border-radius: 22px 22px 0 0; padding: 22px; box-sizing: border-box; '
              f'box-shadow: inset 0 0 0 3px #2b2b2b;">'
              f'<div style="position: absolute; left: 50%; top: 8px; width: 8px; height: 8px; margin-left: -4px; border-radius: 50%; background: #333;"></div>'
              f'<div style="width: 100%; height: 100%; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-rows: repeat(2, minmax(0, 1fr)); gap: 10px;">{tiles}</div></div>')
    base = (f'<div style="width: {lw + 90}px; height: 26px; margin-left: -45px; border-radius: 0 0 26px 26px; '
            f'background: linear-gradient(180deg, #4a4a4a 0%, #1b1b1b 45%, #0a0a0a 100%); box-shadow: 0 30px 40px -12px rgba(0,0,0,0.8);">'
            f'<div style="width: 140px; height: 8px; margin: 0 auto; border-radius: 0 0 8px 8px; background: #111;"></div></div>')
    laptop = f'<div style="align-self: center; flex-shrink: 0; transform: rotate(-1.5deg);">{screen}{base}</div>'
    note = (f'<div style="position: absolute; left: {int(lw * 0.38)}px; top: -{v(f, 70, 76, 86)}px; transform: rotate(-5deg); display: flex; align-items: flex-end; gap: 6px;">'
            f'<div style="{HAND} font-weight: 700; font-size: {v(f, 46, 52, 58)}px; color: {GOLD}; line-height: 1; white-space: nowrap;">nobody needs to know</div>'
            f'<svg width="60" height="54" viewBox="0 0 60 54" fill="none" stroke="{GOLD}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
            f'<path d="M50 6 C 44 24, 30 36, 10 46"/><path d="M10 32 L 9 47 L 23 49"/></svg></div>')
    laptop = laptop.replace('transform: rotate(-1.5deg);">', 'transform: rotate(-1.5deg); position: relative;">' + note, 1)
    content = (two_line_head('gold', 'Straightening,', 'on mute.', v(f, 96, 108, 118), v(f, 104, 116, 128))
               + grow() + spacer(v(f, 60, 70, 80)) + laptop + grow() + spacer(v(f, 24, 34, 44))
               + f'<div style="{BODY} font-size: {v(f, 25, 28, 32)}px; line-height: 1.35; color: {GOLD};">Invisalign clear aligners are designed to be discreet, on camera and off.</div>'
               + spacer(v(f, 26, 36, 48)) + footer('gold'))
    return frame(w, h, BG_BLACK, GOLD, '', content, grain('light', 0.26, 'overlay'), PAD[f])


SECTION = [('21', bac21), ('22', bac22), ('23', bac23), ('24', bac24), ('25', bac25)]
