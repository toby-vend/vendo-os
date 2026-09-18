"""Section C: Premium (BAC-11 to BAC-14), v2."""
from lib2 import *
from sec_b import two_line_head

BRASS = 'radial-gradient(circle at 34% 30%, #FFF4DE 0%, #D2B78C 42%, #8F7B5A 100%)'


# ---------- BAC-11: lobby + continuity notes ----------
def bac11(f, w, h):
    pad = {'1x1': (0, 72, 64, 72), '4x5': (0, 80, 76, 80), '9x16': (0, 84, 330, 84)}[f]
    ph = v(f, 560, 800, 960)
    fs = v(f, 20, 22, 25)
    row = lambda k, val: (f'<div style="display: flex; align-items: baseline; gap: 12px; {MONO} font-size: {fs}px; color: {GOLD}; letter-spacing: 1px;">'
                          f'<span style="white-space: nowrap;">{k}</span><span style="flex-grow: 1; border-bottom: 2px dotted rgba(210,183,140,0.5); transform: translateY(-6px);"></span>'
                          f'<span style="white-space: nowrap; font-weight: 700;">{val}</span></div>')
    card = (f'<div style="position: absolute; left: {PAD[f][3]}px; bottom: -{v(f, 110, 120, 130)}px; width: {v(f, 600, 640, 700)}px; background: {BLACK}; '
            f'border: 2px solid {GOLD}; padding: {v(f, 22, 26, 30)}px {v(f, 26, 30, 34)}px; box-sizing: border-box; transform: rotate(-2deg); box-shadow: {SHADOW_DEEP}; '
            f'display: flex; flex-direction: column; gap: {v(f, 10, 12, 14)}px;">'
            f'<div style="display: flex; justify-content: space-between; {BODY} font-size: 15px; font-weight: 900; letter-spacing: 5px; color: {GOLD}; text-transform: uppercase; '
            f'padding-bottom: 10px; border-bottom: 1px solid rgba(210,183,140,0.5);"><span>Continuity notes</span><span>Scene: the club</span></div>'
            + row('LOCATION', 'BOND DENTAL LONDON') + row('CAST', 'OUR OWN CLINICIANS') + row('SET', 'UNCHANGED') + row('PRICING', 'CLEARER')
            + '</div>')
    photo = (f'<div style="height: {ph}px; flex-shrink: 0; position: relative; margin: 0 -{pad[1]}px 0 -{pad[3]}px;">'
             f'<div style="position: absolute; left: 0; top: 0; right: 0; bottom: 0; overflow: hidden;">'
             f'<img src="{B["lobby"]}" alt="Bond Dental London reception" style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; object-fit: cover; '
             f'object-position: 50% 55%; filter: sepia(0.28) saturate(0.85) contrast(1.05) brightness(0.95);">'
             f'<div style="position: absolute; left: 0; right: 0; bottom: 0; height: 45%; background: linear-gradient(180deg, rgba(10,10,10,0) 0%, rgba(10,10,10,0.9) 100%);"></div>'
             + grain('light', 0.4, 'overlay') + '</div>' + card + '</div>')
    content = (photo + spacer(v(f, 140, 160, 180))
               + f'<div style="display: flex; align-items: baseline; gap: 22px; flex-wrap: wrap;">'
               f'<div style="{SANS} font-weight: 800; font-size: {v(f, 84, 94, 104)}px; line-height: 0.95; letter-spacing: -0.035em; color: {GOLD};">Same clinics.</div>'
               f'<div style="{SERIF} font-size: {v(f, 96, 108, 118)}px; line-height: 0.95; color: {GOLD};">Same crew.</div></div>'
               + spacer(18)
               + f'<div style="{BODY} font-size: {v(f, 26, 29, 33)}px; line-height: 1.35; color: {GOLD};">Bond Aligner Club is Bond Dental London, with clearer pricing.</div>'
               + spacer(v(f, 24, 30, 40)) + grow() + footer('gold'))
    return frame(w, h, BG_BLACK, GOLD, '', content, grain('light', 0.25, 'overlay'), pad)


# ---------- BAC-12: felt letter board ----------
def bac12(f, w, h):
    bw = v(f, 820, 860, 900)
    ls = v(f, 40, 44, 50)
    lines = ['BOND ALIGNER CLUB', '', 'CLINIC · MARYLEBONE', 'TEAM · BOND DENTAL', 'TREATMENT · INVISALIGN', 'PRICES FROM £995']
    letters = ''.join(
        (f'<div style="height: {int(ls * 0.7)}px;"></div>' if not t else
         f'<div style="{SANS} font-weight: 700; font-stretch: {"125%" if i == 0 else "100%"}; font-size: {int(ls * (1.12 if i == 0 else 1))}px; line-height: 1.22; '
         f'letter-spacing: 0.1em; color: {GOLD}; text-align: center; text-shadow: 0 3px 2px rgba(0,0,0,0.75);">{t}</div>')
        for i, t in enumerate(lines))
    board = (f'<div style="width: {bw}px; align-self: center; flex-shrink: 0; transform: rotate(-1.5deg); box-shadow: {SHADOW_DEEP}; background: {BLACK}; '
             f'padding: 16px; box-sizing: border-box; border-radius: 6px;">'
             f'<div style="border: 2px solid rgba(210,183,140,0.55); padding: {v(f, 34, 44, 56)}px 20px; '
             f'background: repeating-linear-gradient(180deg, #151515 0px, #151515 3px, #0A0A0A 3px, #0A0A0A 12px); position: relative;">'
             + grain('light', 0.18, 'overlay') + f'<div style="position: relative;">{letters}</div></div></div>')
    content = (two_line_head('black', 'Still our clinics.', 'Still our team.', v(f, 84, 96, 106), v(f, 94, 106, 118))
               + grow() + board + grow() + spacer(v(f, 10, 20, 30))
               + f'<div style="{BODY} font-size: {v(f, 26, 29, 33)}px; line-height: 1.35; color: {BLACK};">The same team behind Bond Dental London’s five clinics.</div>'
               + spacer(v(f, 28, 40, 52)) + footer('black'))
    return frame(w, h, BG_CREAM, BLACK, '', content, grain('dark', 0.2, 'multiply'), PAD[f])


# ---------- BAC-13: founder interview ----------
def bac13(f, w, h):
    story = f == '9x16'
    if story:
        photo = (f'<div style="position: absolute; left: 0; top: 0; width: {w}px; height: 1060px; overflow: hidden;">'
                 f'<img src="{B["kev"]}" alt="Dr Kev Patel" style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; object-fit: cover; object-position: 46% 20%; '
                 f'filter: grayscale(1) contrast(1.08) brightness(0.95);">'
                 f'<div style="position: absolute; left: 0; right: 0; bottom: 0; height: 55%; background: linear-gradient(180deg, rgba(10,10,10,0) 0%, #0A0A0A 100%);"></div>'
                 f'<div style="position: absolute; left: 0; right: 0; top: 0; height: 22%; background: linear-gradient(0deg, rgba(10,10,10,0) 0%, rgba(10,10,10,0.6) 100%);"></div>'
                 + grain('light', 0.45, 'overlay') + '</div>')
    else:
        pw = v(f, 560, 620, 0)
        photo = (f'<div style="position: absolute; right: 0; top: 0; width: {pw}px; height: {h}px; overflow: hidden;">'
                 f'<img src="{B["kev"]}" alt="Dr Kev Patel" style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; object-fit: cover; object-position: 46% 30%; '
                 f'filter: grayscale(1) contrast(1.08) brightness(0.95);">'
                 f'<div style="position: absolute; left: 0; top: 0; bottom: 0; width: 70%; background: linear-gradient(90deg, #0A0A0A 0%, rgba(10,10,10,0) 100%);"></div>'
                 f'<div style="position: absolute; left: 0; right: 0; bottom: 0; height: 35%; background: linear-gradient(180deg, rgba(10,10,10,0) 0%, #0A0A0A 100%);"></div>'
                 + grain('light', 0.45, 'overlay') + '</div>')
    qw = v(f, 600, 580, 912)
    quote = (f'<div style="width: {qw}px; position: relative;">'
             f'<div style="{SERIF} font-size: {v(f, 220, 250, 260)}px; line-height: 0.7; color: {GOLD}; height: {v(f, 96, 110, 118)}px;">“</div>'
             f'<div style="{SERIF} font-size: {v(f, 54, 56, 66)}px; line-height: 1.06; color: {GOLD}; letter-spacing: -0.005em;">You’ve aligned your career, your relationships, basically your whole life. It’s about time your smile caught up.</div>'
             f'<div style="display: flex; align-items: center; gap: 22px; margin-top: {v(f, 26, 34, 40)}px;">'
             f'<div style="{HAND} font-weight: 700; font-size: {v(f, 60, 66, 72)}px; color: {GOLD}; line-height: 1; transform: rotate(-4deg);">Kev</div>'
             f'<div style="width: 2px; height: 54px; background: rgba(210,183,140,0.5);"></div>'
             f'<div><div style="{BODY} font-size: 19px; font-weight: 900; letter-spacing: 4px; text-transform: uppercase; color: {GOLD};">Dr Kev Patel</div>'
             f'<div style="{BODY} font-size: 20px; color: {GOLD}; margin-top: 4px;">Founder &amp; CEO, Bond Dental London</div></div></div></div>')
    eyebrow = f'<div style="{BODY} font-size: 17px; font-weight: 700; letter-spacing: 7px; text-transform: uppercase; color: {GOLD};">In conversation with our founder</div>'
    if story:
        content = spacer(560) + grow() + eyebrow + spacer(56) + quote + grow() + spacer(40) + footer('gold')
    else:
        content = eyebrow + grow() + quote + grow() + spacer(30) + footer('gold')
    return frame(w, h, BG_BLACK, GOLD, photo, content, grain('light', 0.25, 'overlay'), PAD[f])


# ---------- BAC-14: door hanger ----------
def bac14(f, w, h):
    hw = v(f, 380, 420, 470)
    hh = v(f, 820, 1000, 860)
    hole = int(hw * 0.3)
    right = v(f, 90, 100, 0)
    left_story = (w - hw) // 2
    top = v(f, 150, 170, 560)
    pos = f'right: {right}px;' if f != '9x16' else f'left: {left_story}px;'
    knob_cx_off = hw // 2
    rose = (f'<div style="position: absolute; {pos} top: {top - 95}px; width: {hw}px; height: 190px; display: flex; justify-content: center; pointer-events: none;">'
            f'<div style="width: 170px; height: 170px; border-radius: 50%; background: {BRASS}; box-shadow: 0 16px 30px -10px rgba(10,10,10,0.5);"></div></div>')
    hanger = (f'<div style="position: absolute; {pos} top: {top}px; width: {hw}px; height: {hh}px; transform: rotate(4deg); transform-origin: 50% 0; '
              f'background: {BG_GOLD}; border-radius: 28px; box-shadow: {SHADOW_DEEP}; overflow: hidden; display: flex; flex-direction: column; align-items: center; '
              f'padding: {hole + 90}px 34px 40px; box-sizing: border-box; text-align: center; color: {BLACK};">'
              + grain('dark', 0.3, 'multiply') +
              f'<div style="position: absolute; left: 50%; top: 40px; width: {hole}px; height: {hole}px; margin-left: -{hole // 2}px; border-radius: 50%; '
              f'background: {BG_CREAM}; box-shadow: inset 0 6px 12px rgba(10,10,10,0.45);"></div>'
                            f'<div style="position: relative; {BODY} font-size: 15px; font-weight: 900; letter-spacing: 5px; text-transform: uppercase;">Bond Aligner Club</div>'
              f'<div style="position: relative; width: 60px; height: 2px; background: {BLACK}; margin: 22px 0;"></div>'
              f'<div style="position: relative; {SANS} font-weight: 900; font-stretch: 112%; font-size: {v(f, 62, 70, 78)}px; line-height: 0.95; letter-spacing: 0.01em;">PLEASE<br>DO NOT<br>RUSH.</div>'
              + grow() +
              f'<div style="position: relative; {SERIF} font-size: {v(f, 34, 38, 42)}px; line-height: 1.05;">Take your time.<br>We’ll be here.</div>'
              f'<div style="position: relative; width: 60px; height: 2px; background: {BLACK}; margin: 22px 0 16px;"></div>'
              f'<img src="{B["mark_black"]}" alt="" style="position: relative; height: 40px; width: auto; display: block;"></div>')
    knob = (f'<div style="position: absolute; {pos} top: {top - 5}px; width: {hw}px; display: flex; justify-content: center; pointer-events: none;">'
            f'<div style="width: 92px; height: 92px; border-radius: 50%; background: {BRASS}; box-shadow: 0 18px 26px -8px rgba(10,10,10,0.6), inset 0 -4px 8px rgba(10,10,10,0.25);"></div></div>')
    panels = (f'<div style="position: absolute; left: 50px; top: 50px; right: 50px; bottom: 50px; border: 2px solid rgba(10,10,10,0.07); '
              f'box-shadow: inset 0 0 0 26px rgba(255,255,255,0.18), inset 0 0 0 28px rgba(10,10,10,0.05);"></div>')
    lines = ['No hard sell.', 'No rush.', 'A clear plan and a clear price before you commit.']
    lst = ''.join(f'<div style="display: flex; gap: 18px; align-items: baseline;"><div style="width: 30px; height: 3px; background: {BLACK}; flex-shrink: 0; transform: translateY(-9px);"></div>'
                  f'<div style="{BODY} font-size: {v(f, 27, 30, 34)}px; line-height: 1.3; color: {BLACK};">{t}</div></div>' for t in lines)
    col_w = v(f, 470, 410, 912)
    if f == '9x16':
        content = (two_line_head('black', 'Premium,', 'without the pressure.', 104, 104) + grow() + footer('black'))
    else:
        content = (f'<div style="width: {v(f, 470, 480, 0)}px;">' + two_line_head('black', 'Premium,', 'without the<br>pressure.', v(f, 96, 104, 0), v(f, 100, 98, 0)) + '</div>'
                   + grow() + f'<div style="width: {col_w}px; display: flex; flex-direction: column; gap: {v(f, 14, 20, 0)}px;">{lst}</div>'
                   + spacer(v(f, 40, 56, 0))
                   + f'<div style="width: {col_w}px; display: flex; flex-direction: column; gap: 28px; align-items: flex-start;">{lockup("black", 210)}{cta("black")}</div>')
    return frame(w, h, BG_CREAM, BLACK, panels, content, rose + hanger + knob + grain('dark', 0.18, 'multiply'), PAD[f])


SECTION = [('11', bac11), ('12', bac12), ('13', bac13), ('14', bac14)]
