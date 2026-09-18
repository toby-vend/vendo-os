"""Section D: Price-aware (BAC-15 to BAC-20), v2."""
from lib2 import *
from sec_b import two_line_head

FIN_FOOT = ('0% finance available over up to 36 months, subject to status. Representative example: [TO FOLLOW FROM LENDER]. '
            'Kevom Ltd t/a Bond Dental London is a credit broker, not a lender. FRN 832135.')
TIERS = [('Express', '£995', 'approx. £28/mo', 'Up to 7 aligners'),
         ('Lite', '£1,995', 'approx. £55/mo', 'Up to 14 aligners'),
         ('Moderate', '£2,995', 'approx. £83/mo', 'Up to 20 aligners'),
         ('Comprehensive', '£3,595', 'approx. £99.86/mo', 'Unlimited aligners')]
PAPER = f'radial-gradient(120% 90% at 20% 0%, #fffdf8 0%, {CREAM} 60%, #efe5d4 100%)'
BRASS_H = 'linear-gradient(180deg, #FFF4DE 0%, #D2B78C 40%, #8F7B5A 100%)'


def tick(col, size=30):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{col}" stroke-width="2.6" stroke-linecap="round" '
            f'stroke-linejoin="round" aria-hidden="true" style="flex-shrink: 0;"><path d="M4.5 12.5l5 5 10-11"/></svg>')


# ---------- BAC-15: the ticket ----------
def bac15(f, w, h):
    tw, th = v(f, 860, 880, 900), v(f, 300, 330, 380)
    stub = v(f, 190, 200, 210)
    notch = lambda side: (f'<div style="position: absolute; {side}: -22px; left: {tw - stub - 22}px; width: 44px; height: 44px; border-radius: 50%; '
                          f'background: #0A0A0A;"></div>')
    lab = f'{BODY} font-size: {v(f, 15, 16, 17)}px; font-weight: 900; letter-spacing: 5px; text-transform: uppercase;'
    ticket = (f'<div style="width: {tw}px; height: {th}px; align-self: center; flex-shrink: 0; position: relative; transform: rotate(-4deg); '
              f'filter: drop-shadow(0 40px 40px rgba(0,0,0,0.6));">'
              f'<div style="position: absolute; left: 0; top: 0; width: {tw}px; height: {th}px; border-radius: 14px; overflow: hidden; background: {BG_GOLD}; color: {BLACK};">'
              + grain('dark', 0.3, 'multiply') +
              f'<div style="position: absolute; left: 16px; top: 16px; right: {stub + 16}px; bottom: 16px; border: 1.5px solid rgba(10,10,10,0.45); border-radius: 6px;"></div>'
              f'<div style="position: absolute; left: 44px; top: {v(f, 36, 40, 50)}px; right: {stub + 40}px; bottom: {v(f, 34, 38, 48)}px; display: flex; flex-direction: column;">'
              f'<div style="display: flex; justify-content: space-between; {lab}"><span>Admit one</span><span>Now showing</span></div>'
              + grow() +
              f'<div style="{BODY} font-size: {v(f, 16, 17, 19)}px; font-weight: 700; letter-spacing: 4px; text-transform: uppercase;">Bond Aligner Club presents</div>'
              f'<div style="{SANS} font-weight: 900; font-stretch: 110%; font-size: {v(f, 60, 64, 72)}px; line-height: 0.95; letter-spacing: -0.02em; margin-top: 6px;">Invisalign Express</div>'
              + grow() +
              f'<div style="display: flex; gap: 26px; {MONO} font-size: {v(f, 18, 19, 21)}px;"><span>UP TO 7 ALIGNERS</span><span>ROW: YOURS</span><span>SEAT: THE CHAIR</span></div></div>'
              f'<div style="position: absolute; top: 18px; bottom: 18px; left: {tw - stub}px; border-left: 3px dashed rgba(10,10,10,0.5);"></div>'
              f'<div style="position: absolute; top: 0; bottom: 0; right: 0; width: {stub}px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;">'
              f'<div style="{lab}">Admit one</div>'
              f'<div style="{SANS} font-weight: 900; font-size: {v(f, 54, 58, 64)}px; letter-spacing: -0.03em; line-height: 1;">£995</div>'
              f'<div style="{MONO} font-size: 16px;">No. 000995</div></div>'
              + notch('top') + notch('bottom') + '</div></div>')
    head = (f'<div style="{SERIF} font-size: {v(f, 110, 124, 136)}px; line-height: 0.9; color: {GOLD};">Plot twist:</div>'
            f'<div style="{SANS} font-weight: 900; font-size: {v(f, 176, 196, 214)}px; line-height: 0.88; letter-spacing: -0.05em; color: {GOLD};">it’s £995.</div>')
    content = (head + grow() + ticket + grow() + spacer(v(f, 10, 20, 30))
               + f'<div style="{BODY} font-size: {v(f, 25, 28, 32)}px; line-height: 1.35; color: {GOLD};">The real Invisalign at Bond Dental London. 0% finance available over up to 36 months.</div>'
               + spacer(v(f, 28, 40, 52)) + footer('gold'))
    return frame(w, h, BG_BLACK, GOLD, '', content, grain('light', 0.28, 'overlay'), PAD[f])


# ---------- BAC-16: the Polaroid ----------
def bac16(f, w, h):
    story = f == '9x16'
    pw = v(f, 470, 500, 640)
    border, bottom = int(pw * 0.06), int(pw * 0.24)
    ph = pw - border * 2
    sd = int(pw * 0.36)
    sticker = (f'<div style="position: absolute; right: -{int(sd * 0.3)}px; top: -{int(sd * 0.3)}px; width: {sd}px; height: {sd}px; border-radius: 50%; '
               f'background: {BLACK}; color: {GOLD}; transform: rotate(12deg); box-shadow: {SHADOW_SOFT}; display: flex; flex-direction: column; '
               f'align-items: center; justify-content: center; text-align: center;">'
               f'<div style="position: absolute; left: 10px; top: 10px; right: 10px; bottom: 10px; border-radius: 50%; border: 2px dashed rgba(210,183,140,0.5);"></div>'
               f'<div style="{BODY} font-size: {int(sd * 0.085)}px; font-weight: 900; letter-spacing: 3px; text-transform: uppercase;">The real</div>'
               f'<div style="{SERIF} font-size: {int(sd * 0.2)}px; line-height: 1;">Invisalign</div></div>')
    polaroid = (f'<div style="position: {"relative" if story else "absolute"}; {"align-self: center;" if story else f"right: {v(f, 70, 80, 0)}px; top: {v(f, 150, 190, 0)}px;"} '
                f'width: {pw}px; flex-shrink: 0; background: #FBF8F2; padding: {border}px {border}px {bottom}px; box-sizing: border-box; '
                f'transform: rotate({v(f, 5, 5, -3)}deg); box-shadow: {SHADOW_DEEP};">'
                f'<div style="width: {ph}px; height: {ph}px; position: relative; overflow: hidden; background: #222;">'
                f'<img src="{B["smile"]}" alt="" style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; object-fit: cover; object-position: 58% 32%; '
                f'filter: sepia(0.25) contrast(1.05) saturate(0.9);">'
                + grain('light', 0.4, 'overlay') + '</div>'
                f'<div style="position: absolute; left: {border}px; right: {border}px; bottom: {int(bottom * 0.22)}px; text-align: center; {HAND} font-weight: 700; '
                f'font-size: {int(pw * 0.1)}px; color: {BLACK}; transform: rotate(-2deg);">day one of starting well</div>'
                + sticker + '</div>')
    head = two_line_head('black', 'It’s £995.', 'Honestly?', v(f, 140, 150, 170), v(f, 104, 112, 124), serif_first=True)
    sub = f'<div style="{BODY} font-size: {v(f, 27, 30, 33)}px; line-height: 1.35; color: {BLACK};">Same clinicians. Same clinics. Clearer pricing.</div>'
    if story:
        content = head + spacer(110) + grow() + polaroid + grow() + spacer(40) + sub + spacer(44) + footer('black')
        over = ''
    else:
        cw = v(f, 440, 440, 0)
        content = (f'<div style="width: {cw}px;">{head}</div>' + grow()
                   + f'<div style="width: {cw}px;">{sub}</div>' + spacer(v(f, 36, 48, 0))
                   + f'<div style="width: {cw}px; display: flex; flex-direction: column; gap: 28px; align-items: flex-start;">{lockup("black", 210)}{cta("black")}</div>')
        over = polaroid
    return frame(w, h, BG_CREAM, BLACK, '', content, over + grain('dark', 0.2, 'multiply'), PAD[f])


# ---------- BAC-17: price-list card with magnifier (HOLD) ----------
def fine_block(fw, fs, col=BLACK):
    return f'<div style="width: {fw}px; {BODY} font-size: {fs}px; line-height: 1.4; color: {col};">{FIN_FOOT}</div>'


def bac17(f, w, h):
    cw = v(f, 880, 900, 912)
    pad_x = v(f, 44, 50, 54)
    fw = cw - pad_x * 2
    fs = v(f, 16, 17, 19)
    rows = ''.join(
        f'<div style="display: flex; align-items: baseline; gap: 16px; padding: {v(f, 12, 16, 22)}px 0; border-bottom: 1px solid rgba(10,10,10,0.2);">'
        f'<div style="display: flex; flex-direction: column; gap: 2px;"><div style="{SANS} font-weight: 800; font-size: {v(f, 34, 38, 42)}px; letter-spacing: -0.01em; line-height: 1;">{n}</div>'
        f'<div style="{BODY} font-size: {v(f, 18, 20, 22)}px;">{al}</div></div>'
        f'<div style="flex-grow: 1; border-bottom: 2px dotted rgba(10,10,10,0.45); transform: translateY(-10px);"></div>'
        f'<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px;"><div style="{SANS} font-weight: 800; font-size: {v(f, 40, 44, 48)}px; letter-spacing: -0.02em; line-height: 1;">{p}</div>'
        f'<div style="{BODY} font-size: {v(f, 17, 19, 21)}px;">{mo}</div></div></div>' for n, p, mo, al in TIERS)
    D, bw = v(f, 170, 190, 210), 9
    lens = (f'<div style="position: absolute; right: -{int(D * 0.12)}px; bottom: -{int(D * 0.42)}px; width: {D}px; height: {D}px;">'
            f'<div style="position: absolute; left: 0; top: 0; width: {D}px; height: {D}px; box-sizing: border-box; border-radius: 50%; border: {bw}px solid {GOLD}; '
            f'background: radial-gradient(60% 50% at 30% 22%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.06) 60%, rgba(255,255,255,0.02) 100%); '
            f'box-shadow: 0 24px 30px -12px rgba(10,10,10,0.55), inset 0 0 0 2px rgba(10,10,10,0.25), inset 0 -10px 24px rgba(10,10,10,0.12);"></div>'
            f'<div style="position: absolute; left: {int(D * 0.78)}px; top: {int(D * 0.8)}px; width: 30px; height: {int(D * 0.8)}px; border-radius: 15px; '
            f'background: linear-gradient(90deg, #262626, #0A0A0A 60%); transform: rotate(-40deg); transform-origin: 50% 0; box-shadow: 0 18px 20px -8px rgba(0,0,0,0.6);"></div></div>')
    fine = f'<div style="position: relative; margin-top: {v(f, 22, 30, 40)}px; padding-bottom: {int(D * 0.45)}px;">{fine_block(fw - int(D * 0.2), fs)}{lens}</div>'
    card = (f'<div style="width: {cw}px; align-self: center; flex-shrink: 0; position: relative; transform: rotate(-1.5deg); box-shadow: {SHADOW_DEEP}; '
            f'background: {PAPER}; padding: {v(f, 30, 38, 46)}px {pad_x}px {v(f, 34, 42, 50)}px; box-sizing: border-box; color: {BLACK};">'
            + grain('dark', 0.3, 'multiply') +
            f'<div style="position: relative; display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 2px solid {BLACK};">'
            f'<div style="{SANS} font-weight: 800; font-stretch: 125%; font-size: {v(f, 20, 22, 26)}px; letter-spacing: 0.14em;">PRICE LIST</div>'
            f'<img src="{B["mark_black"]}" alt="" style="height: 34px; width: auto; display: block;"></div>'
            f'<div style="position: relative;">{rows}</div>{fine}</div>')
    content = (two_line_head('gold', 'There isn’t much.', 'The fine print?', v(f, 76, 88, 98), v(f, 80, 92, 104), serif_first=True)
               + grow() + card + grow() + spacer(v(f, 20, 30, 40)) + footer('gold'))
    return frame(w, h, BG_BLACK, GOLD, '', content, grain('light', 0.28, 'overlay'), PAD[f])


# ---------- BAC-18: swing tags on a rail ----------
def bac18(f, w, h):
    inner = w - PAD[f][1] - PAD[f][3]
    gap = v(f, 16, 18, 18)
    tw = int((inner - gap * 3) / 4)
    th = v(f, 300, 380, 520)
    drops = [v(f, 40, 50, 70), v(f, 80, 100, 150), v(f, 20, 30, 40), v(f, 60, 80, 110)]
    rots = [-3, 2.5, -1.5, 3]
    tags = ''
    for i, (n, p, _, al) in enumerate(TIERS):
        tags += (f'<div style="width: {tw}px; flex-shrink: 0; position: relative; padding-top: {drops[i]}px; display: flex; flex-direction: column; align-items: center;">'
                 f'<div style="position: absolute; left: 50%; top: -6px; width: 2px; height: {drops[i] + 44}px; background: {BLACK}; opacity: 0.75;"></div>'
                 f'<div style="width: {tw}px; height: {th}px; position: relative; transform: rotate({rots[i]}deg); transform-origin: 50% 0; box-shadow: {SHADOW_SOFT}; '
                 f'background: {BG_GOLD}; border-radius: 10px 10px 14px 14px; clip-path: polygon(18% 0, 82% 0, 100% 9%, 100% 100%, 0 100%, 0 9%); '
                 f'display: flex; flex-direction: column; align-items: center; padding: {v(f, 64, 74, 90)}px 12px {v(f, 22, 28, 40)}px; box-sizing: border-box; color: {BLACK}; text-align: center;">'
                 + grain('dark', 0.3, 'multiply') +
                 f'<div style="position: absolute; left: 50%; top: 22px; width: 26px; height: 26px; margin-left: -13px; border-radius: 50%; background: {CREAM}; '
                 f'box-shadow: 0 0 0 5px #B59C74, inset 0 3px 5px rgba(10,10,10,0.45);"></div>'
                 f'<div style="position: relative; {BODY} font-size: {v(f, 14, 15, 17)}px; font-weight: 900; letter-spacing: 3px; text-transform: uppercase;">{n}</div>'
                 f'<div style="position: relative; width: 36px; height: 2px; background: {BLACK}; margin: {v(f, 14, 18, 26)}px 0;"></div>'
                 f'<div style="position: relative; {SANS} font-weight: 900; font-size: {v(f, 48, 50, 52)}px; letter-spacing: -0.03em; line-height: 1;">{p}</div>'
                 + grow() +
                 f'<div style="position: relative; {SERIF} font-size: {v(f, 24, 26, 30)}px; line-height: 1.05;">{al}</div></div></div>')
    rail = (f'<div style="position: relative; height: 22px; margin: 0 -{PAD[f][3] - 20}px; border-radius: 11px; background: {BRASS_H}; '
            f'box-shadow: 0 10px 16px -6px rgba(10,10,10,0.45); flex-shrink: 0; z-index: 2;"></div>')
    row = f'<div style="display: flex; gap: {gap}px; align-items: flex-start; position: relative; z-index: 1;">{tags}</div>'
    content = (two_line_head('black', 'Four prices.', 'Which one’s yours?', v(f, 84, 94, 104), v(f, 90, 100, 112))
               + grow() + rail + row + grow() + spacer(v(f, 16, 24, 30))
               + f'<div style="{BODY} font-size: {v(f, 24, 27, 31)}px; line-height: 1.35; color: {BLACK};">Your dentist confirms which plan suits you at your assessment. 0% finance available on every plan.</div>'
               + spacer(v(f, 26, 36, 48)) + footer('black'))
    return frame(w, h, BG_CREAM, BLACK, '', content, grain('dark', 0.2, 'multiply'), PAD[f])


# ---------- BAC-19: tear-off month pad (HOLD) ----------
def bac19(f, w, h):
    pw, ph = v(f, 520, 600, 700), v(f, 480, 600, 720)
    layers = ''.join(f'<div style="position: absolute; left: {i * 5}px; top: {i * 4}px; width: {pw}px; height: {ph}px; background: {"#efe5d4" if i % 2 else "#f6eee2"}; '
                     f'border-radius: 0 0 8px 8px; box-shadow: 0 1px 0 rgba(10,10,10,0.12);"></div>' for i in (5, 4, 3, 2, 1))
    binder = (f'<div style="position: absolute; left: -10px; top: -{v(f, 58, 64, 70)}px; width: {pw + 20}px; height: {v(f, 70, 76, 84)}px; background: {BLACK}; '
              f'border-radius: 10px 10px 4px 4px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 12px -6px rgba(10,10,10,0.6);">'
              f'<div style="{SANS} font-weight: 800; font-stretch: 125%; font-size: {v(f, 18, 20, 22)}px; letter-spacing: 0.2em; color: {GOLD};">BOND ALIGNER CLUB</div></div>')
    perf = (f'<div style="position: absolute; left: 0; right: 0; top: 12px; height: 4px; '
            f'background-image: radial-gradient(circle, rgba(10,10,10,0.35) 1.6px, rgba(0,0,0,0) 2px); background-size: 12px 4px;"></div>')
    page_ = (f'<div style="position: absolute; left: 0; top: 0; width: {pw}px; height: {ph}px; background: {PAPER}; border-radius: 0 0 8px 8px; overflow: hidden; '
             f'display: flex; flex-direction: column; align-items: center; justify-content: center; color: {BLACK}; text-align: center;">'
             + grain('dark', 0.3, 'multiply') + perf +
             f'<div style="position: relative; {MONO} font-size: {v(f, 18, 20, 22)}px; letter-spacing: 3px;">MONTH 1 OF 36</div>'
             f'<div style="position: relative; {SANS} font-weight: 900; font-size: {v(f, 210, 250, 290)}px; letter-spacing: -0.05em; line-height: 0.9; margin-top: 8px;">£28</div>'
             f'<div style="position: relative; {SERIF} font-size: {v(f, 48, 56, 64)}px; line-height: 1;">a month, approx.</div>'
             f'<div style="position: relative; width: 60px; height: 2px; background: {BLACK}; margin: {v(f, 20, 26, 32)}px 0 {v(f, 14, 18, 22)}px;"></div>'
             f'<div style="position: relative; {BODY} font-size: {v(f, 18, 20, 22)}px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase;">Invisalign Express · £995</div></div>')
    pad_ = (f'<div style="position: relative; width: {pw}px; height: {ph}px; align-self: center; flex-shrink: 0; margin-top: {v(f, 60, 64, 110)}px; '
            f'transform: rotate(-3deg); filter: drop-shadow(0 40px 36px rgba(10,10,10,0.45));">{layers}{page_}{binder}</div>')
    story = f == '9x16'
    head = (f'<div style="{SERIF} font-size: {v(f, 84, 96, 110)}px; line-height: 0.95; color: {BLACK};">Genuine Invisalign,</div>'
            f'<div style="{SANS} font-weight: 800; font-size: {v(f, 70, 80, 92)}px; line-height: 0.95; letter-spacing: -0.035em; color: {BLACK};">from around{"<br>" if f == "9x16" else " "}£28 a month.</div>')
    if f == '1x1':
        cw = 350
        content = (f'<div style="width: {cw}px;">'
                   f'<div style="{SERIF} font-size: 80px; line-height: 0.95; color: {BLACK};">Genuine Invisalign,</div>'
                   f'<div style="{SANS} font-weight: 800; font-size: 64px; line-height: 0.95; letter-spacing: -0.035em; color: {BLACK}; margin-top: 8px;">from around £28 a month.</div></div>'
                   + grow() + f'<div style="width: {cw}px; {BODY} font-size: 15px; line-height: 1.4; color: {BLACK};">{FIN_FOOT}</div>'
                   + spacer(32) + f'<div style="width: {cw}px; display: flex; flex-direction: column; gap: 26px; align-items: flex-start;">{lockup("black", 200)}{cta("black")}</div>')
        over = pad_.replace('align-self: center;', 'position: absolute; right: 70px; top: 210px;').replace('position: relative; width', 'width', 1)
        return frame(w, h, BG_GOLD, BLACK, '', content, over + grain('dark', 0.3, 'multiply') + grain('light', 0.3, 'overlay'), PAD[f])
    content = (head + grow() + pad_ + grow() + spacer(v(f, 20, 30, 40))
               + f'<div style="{BODY} font-size: {v(f, 16, 17, 19)}px; line-height: 1.4; color: {BLACK};">{FIN_FOOT}</div>'
               + spacer(v(f, 24, 32, 44)) + footer('black'))
    return frame(w, h, BG_GOLD, BLACK, '', content, grain('dark', 0.3, 'multiply') + grain('light', 0.3, 'overlay'), PAD[f])


# ---------- BAC-20: the gift box ----------
def bac20(f, w, h):
    story = f == '9x16'
    bs = v(f, 440, 500, 540)
    rb = int(bs * 0.12)
    ribbon_v = (f'<div style="position: absolute; left: {(bs - rb) // 2}px; top: 0; width: {rb}px; height: {bs}px; '
                f'background: linear-gradient(90deg, #8F7B5A 0%, #FFF4DE 30%, #D2B78C 55%, #8F7B5A 100%);"></div>')
    ribbon_h = (f'<div style="position: absolute; top: {(bs - rb) // 2}px; left: 0; height: {rb}px; width: {bs}px; '
                f'background: linear-gradient(180deg, #8F7B5A 0%, #FFF4DE 30%, #D2B78C 55%, #8F7B5A 100%);"></div>')
    lw_, lh_ = int(bs * 0.3), int(bs * 0.17)
    c = bs // 2
    loop = lambda rot, dx: (f'<div style="position: absolute; left: {c - lw_ // 2 + dx}px; top: {c - lh_ // 2}px; width: {lw_}px; height: {lh_}px; border-radius: 50%; '
                            f'transform: rotate({rot}deg); background: radial-gradient(70% 70% at 40% 35%, #FFF4DE 0%, #D2B78C 50%, #7E6B4C 100%); '
                            f'box-shadow: 0 10px 16px -6px rgba(0,0,0,0.6), inset 0 0 0 {int(lh_ * 0.22)}px rgba(126,107,76,0.45);"></div>')
    knot = (f'<div style="position: absolute; left: {c - int(bs * 0.055)}px; top: {c - int(bs * 0.055)}px; width: {int(bs * 0.11)}px; height: {int(bs * 0.11)}px; '
            f'border-radius: 40%; background: radial-gradient(circle at 40% 35%, #FFF4DE 0%, #D2B78C 50%, #7E6B4C 100%); box-shadow: 0 6px 10px -4px rgba(0,0,0,0.6);"></div>')
    tag = (f'<div style="position: absolute; left: {c + int(bs * 0.06)}px; top: {c + int(bs * 0.14)}px; width: {int(bs * 0.4)}px; transform: rotate(-14deg); '
           f'background: {PAPER}; padding: {int(bs * 0.045)}px {int(bs * 0.04)}px; box-sizing: border-box; box-shadow: {SHADOW_SOFT}; color: {BLACK}; '
           f'clip-path: polygon(14% 0, 100% 0, 100% 100%, 14% 100%, 0 50%);">'
           f'<div style="{HAND} font-weight: 700; font-size: {int(bs * 0.075)}px; line-height: 1.05; padding-left: {int(bs * 0.05)}px;">for: you<br>with: whitening</div></div>')
    box = (f'<div style="width: {bs}px; height: {bs}px; position: relative; flex-shrink: 0; transform: rotate(7deg); border-radius: 10px; overflow: visible; '
           f'box-shadow: 0 60px 90px -30px rgba(0,0,0,0.85), 0 20px 30px -10px rgba(0,0,0,0.6);">'
           f'<div style="position: absolute; left: 0; top: 0; width: {bs}px; height: {bs}px; border-radius: 10px; overflow: hidden; '
           f'background: radial-gradient(90% 90% at 25% 15%, #262626 0%, #121212 55%, #050505 100%);">'
           f'<div style="position: absolute; left: 0; top: 0; right: 0; bottom: 0; border: 1px solid rgba(210,183,140,0.25); border-radius: 10px;"></div>'
           + ribbon_v + ribbon_h + grain('light', 0.25, 'overlay') + '</div>'
           + loop(-28, -int(lw_ * 0.42)) + loop(28, int(lw_ * 0.42)) + knot + tag + '</div>')
    inc = ['Moderate plan: up to 20 aligners', 'Complimentary whitening', 'Complimentary removable retainer',
           'The Bond bag starter kit', 'Personalised treatment simulation']
    lst = ''.join(f'<div style="display: flex; gap: 16px; align-items: center;">{tick(GOLD, v(f, 26, 28, 32))}'
                  f'<div style="{BODY} font-size: {v(f, 24, 27, 31)}px; line-height: 1.25; color: {GOLD};">{t}</div></div>' for t in inc)
    lst = f'<div style="display: flex; flex-direction: column; gap: {v(f, 12, 16, 20)}px;">{lst}</div>'
    head = (f'<div style="{SANS} font-weight: 900; font-size: {v(f, 150, 170, 190)}px; line-height: 0.88; letter-spacing: -0.05em; color: {GOLD};">£2,995.</div>'
            f'<div style="{SERIF} font-size: {v(f, 76, 88, 100)}px; line-height: 1; color: {GOLD}; margin-top: 6px;">Whitening included.</div>')
    if story:
        content = (head + spacer(80) + grow() + f'<div style="align-self: center;">{box}</div>' + grow() + spacer(30) + lst + spacer(44) + footer('gold'))
        over = ''
    else:
        cw = v(f, 440, 480, 0)
        content = (head + grow() + f'<div style="width: {cw}px;">{lst}</div>' + spacer(v(f, 34, 48, 0)) + footer('gold'))
        over = f'<div style="position: absolute; right: {v(f, 40, 50, 0)}px; top: {v(f, 290, 380, 0)}px;">{box}</div>'
    return frame(w, h, BG_BLACK, GOLD, over, content, grain('light', 0.28, 'overlay'), PAD[f])


SECTION = [('15', bac15), ('16', bac16), ('17', bac17), ('18', bac18), ('19', bac19), ('20', bac20)]
