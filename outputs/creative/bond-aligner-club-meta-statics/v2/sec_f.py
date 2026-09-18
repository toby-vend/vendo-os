"""Section F: Club (BAC-26 to BAC-30), v2."""
import math
from lib2 import *
from sec_b import two_line_head
from sec_d import PAPER, tick

FOIL = 'linear-gradient(115deg, #B59C74 0%, #F3E6CC 18%, #D2B78C 36%, #A8916B 52%, #F3E6CC 70%, #D2B78C 86%, #9C8660 100%)'
PERKS = ['Complimentary dental health assessment', '10% off for Bond Dental patients', 'Whitening on Moderate and Comprehensive',
         'Complimentary removable retainer', 'The Bond bag starter kit', 'Personalised treatment simulation']


# ---------- BAC-26: membership card ----------
def bac26(f, w, h):
    cw = v(f, 620, 700, 800)
    ch = int(cw / 1.586)
    emb = 'text-shadow: 0 1px 0 rgba(255,255,255,0.45), 0 -1px 0 rgba(10,10,10,0.35);'
    card = (f'<div style="width: {cw}px; height: {ch}px; border-radius: 30px; position: relative; overflow: hidden; background: {FOIL}; '
            f'box-shadow: 0 60px 80px -30px rgba(0,0,0,0.85), 0 20px 30px -12px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.35); color: {BLACK};">'
            + grain('dark', 0.35, 'multiply') +
            f'<div style="position: absolute; left: 0; top: 0; right: 0; bottom: 0; background: linear-gradient(160deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 35%);"></div>'
            f'<div style="position: absolute; left: {int(cw * 0.06)}px; top: {int(ch * 0.1)}px; right: {int(cw * 0.06)}px; bottom: {int(ch * 0.1)}px; display: flex; flex-direction: column;">'
            f'<div style="display: flex; justify-content: space-between; align-items: flex-start;">'
            f'<img src="{B["lock_black"]}" alt="Bond Aligner Club" style="width: {int(cw * 0.3)}px; height: auto; display: block; opacity: 0.9;">'
            f'<div style="{BODY} font-size: {int(cw * 0.024)}px; font-weight: 900; letter-spacing: 5px; text-transform: uppercase; {emb}">Member</div></div>'
            + grow() +
            f'<div style="{MONO} font-size: {int(cw * 0.05)}px; letter-spacing: 6px; {emb}">0001 · 2026</div>'
            f'<div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: {int(ch * 0.05)}px;">'
            f'<div><div style="{BODY} font-size: {int(cw * 0.018)}px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; opacity: 0.75;">Member name</div>'
            f'<div style="{SERIF} font-size: {int(cw * 0.058)}px; line-height: 1.1; {emb}">You, starting well</div></div>'
            f'<div style="text-align: right;"><div style="{BODY} font-size: {int(cw * 0.018)}px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; opacity: 0.75;">Club</div>'
            f'<div style="{SANS} font-weight: 800; font-size: {int(cw * 0.032)}px; letter-spacing: 0.08em; {emb}">MARYLEBONE</div></div></div></div></div>')
    sleeve_w = int(cw * 1.02)
    sleeve = (f'<div style="position: relative; width: {sleeve_w}px; height: {int(ch * 1.08)}px; align-self: center; flex-shrink: 0; margin-top: {v(f, 10, 20, 30)}px;">'
              f'<div style="position: absolute; left: {int(cw * 0.04)}px; top: 0; transform: rotate(-7deg); transform-origin: 30% 60%;">{card}</div></div>')
    cols = 1 if f == '9x16' else 2
    lst = ''.join(f'<div style="display: flex; gap: 12px; align-items: flex-start;">{tick(GOLD, v(f, 22, 24, 28))}'
                  f'<div style="{BODY} font-size: {v(f, 20, 23, 28)}px; line-height: 1.25; color: {GOLD};">{t}</div></div>' for t in PERKS)
    grid = f'<div style="display: grid; grid-template-columns: repeat({cols}, minmax(0, 1fr)); column-gap: 30px; row-gap: {v(f, 10, 14, 18)}px;">{lst}</div>'
    content = (two_line_head('gold', 'Come be part', 'of the club.', v(f, 80, 92, 104), v(f, 88, 100, 114))
               + grow() + sleeve + grow() + spacer(v(f, 10, 20, 30)) + grid + spacer(v(f, 26, 36, 48)) + footer('gold'))
    under = (f'<div style="position: absolute; left: 0; top: 0; right: 0; bottom: 0; '
             f'background: radial-gradient(55% 40% at 50% 50%, rgba(210,183,140,0.22) 0%, rgba(210,183,140,0) 100%);"></div>')
    return frame(w, h, BG_BLACK, GOLD, under, content, grain('light', 0.26, 'overlay'), PAD[f])


# ---------- BAC-27: the Bond bag ----------
def bac27(f, w, h):
    bw, bh = v(f, 400, 500, 580), v(f, 360, 470, 560)
    hw_, hh_ = int(bw * 0.44), int(bh * 0.42)
    hx = (bw - hw_) // 2
    rope = lambda dx, col, sw: (f'<path d="M{hx + dx} {hh_ + 4} C {hx + dx} {int(hh_ * 0.05)}, {hx + hw_ + dx} {int(hh_ * 0.05)}, {hx + hw_ + dx} {hh_ + 4}" '
                                f'stroke="{col}" stroke-width="{sw}" fill="none" stroke-linecap="round"/>')
    handle = (f'<svg width="{bw}" height="{hh_ + 10}" viewBox="0 0 {bw} {hh_ + 10}" aria-hidden="true" style="position: absolute; left: 0; top: -{hh_}px; overflow: visible;">'
              + rope(-18, '#050505', 14) + rope(-18, '#3a3a3a', 3) + rope(18, '#0d0d0d', 14) + rope(18, '#444', 3) + '</svg>')
    tissue = (f'<svg width="{bw}" height="{int(bh * 0.35)}" viewBox="0 0 100 35" preserveAspectRatio="none" aria-hidden="true" '
              f'style="position: absolute; left: 0; top: -{int(bh * 0.22)}px;">'
              f'<path d="M8 35 L 18 8 L 30 22 L 42 2 L 55 20 L 66 5 L 78 22 L 92 10 L 94 35 Z" fill="#F3E6CC"/>'
              f'<path d="M8 35 L 18 8 L 30 22 L 42 2 L 55 20 L 66 5 L 78 22 L 92 10 L 94 35" fill="none" stroke="#BFA47A" stroke-width="0.6"/></svg>')
    case = (f'<div style="position: absolute; left: {int(bw * 0.58)}px; top: -{int(bh * 0.16)}px; width: {int(bw * 0.3)}px; height: {int(bw * 0.2)}px; '
            f'border-radius: {int(bw * 0.1)}px; background: linear-gradient(180deg, #FFFDF8 0%, {CREAM} 50%, #E6D9C3 100%); transform: rotate(10deg); '
            f'box-shadow: 0 10px 16px -8px rgba(10,10,10,0.5);"><div style="position: absolute; left: 0; right: 0; top: 48%; height: 2px; background: rgba(10,10,10,0.18);"></div></div>')
    bag = (f'<div style="position: relative; width: {bw}px; height: {bh}px; flex-shrink: 0; margin-top: {int(bh * 0.45)}px;">'
           + handle + tissue + case +
           f'<div style="position: absolute; left: 0; top: 0; width: {bw}px; height: {bh}px; background: radial-gradient(120% 90% at 30% 10%, #2b2b2b 0%, #121212 55%, #060606 100%); '
           f'clip-path: polygon(3% 0, 97% 0, 100% 100%, 0 100%); box-shadow: 0 60px 80px -30px rgba(0,0,0,0.8); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;">'
           + grain('light', 0.25, 'overlay') +
           f'<div style="position: absolute; left: 0; right: 0; top: 0; height: 18px; background: linear-gradient(180deg, #000 0%, rgba(0,0,0,0) 100%);"></div>'
           f'<div style="position: absolute; left: 0; top: 0; bottom: 0; width: 22%; background: linear-gradient(90deg, rgba(0,0,0,0.35), rgba(0,0,0,0));"></div>'
           f'<img src="{B["lock_gold"]}" alt="Bond Aligner Club" style="position: relative; width: {int(bw * 0.46)}px; height: auto; display: block;">'
           f'<div style="position: relative; {BODY} font-size: {int(bw * 0.03)}px; font-weight: 900; letter-spacing: 5px; text-transform: uppercase; color: {GOLD};">Starter kit</div></div>'
           f'<div style="position: absolute; right: -{int(bw * 0.2)}px; top: {int(bh * 0.12)}px; width: {int(bw * 0.34)}px; transform: rotate(9deg); background: {PAPER}; '
           f'padding: 16px 16px 16px 30px; box-sizing: border-box; box-shadow: {SHADOW_SOFT}; clip-path: polygon(14% 0, 100% 0, 100% 100%, 14% 100%, 0 50%);">'
           f'<div style="{HAND} font-weight: 700; font-size: {int(bw * 0.058)}px; line-height: 1.05; color: {BLACK};">welcome<br>to the club</div></div></div>')
    shadow = (f'<div style="width: {int(bw * 1.3)}px; height: 40px; margin-top: -18px; border-radius: 50%; '
              f'background: radial-gradient(50% 50% at 50% 50%, rgba(10,10,10,0.45) 0%, rgba(10,10,10,0) 100%);"></div>')
    scene = f'<div style="align-self: center; display: flex; flex-direction: column; align-items: center; flex-shrink: 0;">{bag}{shadow}</div>'
    content = (two_line_head('black', 'Your welcome kit’s', 'waiting.', v(f, 80, 90, 100), v(f, 92, 104, 116))
               + grow() + scene + grow()
               + f'<div style="{BODY} font-size: {v(f, 25, 28, 32)}px; line-height: 1.35; color: {BLACK};">Every club member gets the Bond bag: a branded starter aligner kit.</div>'
               + spacer(v(f, 26, 36, 48)) + footer('black'))
    return frame(w, h, BG_GOLD, BLACK, '', content, grain('dark', 0.3, 'multiply') + grain('light', 0.3, 'overlay'), PAD[f])


# ---------- BAC-28: treatment simulation on a tablet ----------
def arch(crowded, stroke, fill, extra_id):
    teeth = []
    n = 14
    for i in range(n):
        a = -82 + i * (164 / (n - 1))
        r = math.radians(a)
        x, y = 250 + 185 * math.sin(r), 300 - 235 * math.cos(r)
        t = abs(a) / 82
        tw, th = 30 + 22 * t, 44 + 14 * t
        rot = a
        if crowded:
            off = {3: (12, 10, 6), 4: (18, -8, 4), 5: (-24, 14, 10), 6: (-30, 22, 14), 7: (28, -12, -12), 8: (20, 14, -6), 9: (-16, 4, 2)}
            if i in off:
                dr, dy, dx = off[i]
                rot += dr; y += dy; x += dx
        teeth.append(f'<rect x="{x - tw / 2:.1f}" y="{y - th / 2:.1f}" width="{tw:.1f}" height="{th:.1f}" rx="{tw * 0.42:.1f}" '
                     f'transform="rotate({rot:.1f} {x:.1f} {y:.1f})" fill="{fill}" stroke="{stroke}" stroke-width="2.4"/>')
    return ''.join(teeth)


def bac28(f, w, h):
    tw = v(f, 760, 860, 900)
    th = int(tw * 0.66)
    sw = tw - 60
    sh = th - 60
    split = 0.5
    aw = int(sw * 0.78)
    ah = int(aw * 0.62)
    ax = (sw - aw) // 2
    ay = int(sh * 0.2)
    svg = lambda crowded: (f'<svg width="{aw}" height="{ah}" viewBox="40 40 420 280" aria-hidden="true" style="position: absolute; left: {ax}px; top: {ay}px; overflow: visible;">'
                           + arch(crowded, GOLD, 'rgba(210,183,140,0.12)' if crowded else 'rgba(210,183,140,0.35)', '') + '</svg>')
    left = (f'<div style="position: absolute; left: 0; top: 0; width: {int(sw * split)}px; height: {sh}px; overflow: hidden;">{svg(True)}</div>')
    right = (f'<div style="position: absolute; left: {int(sw * split)}px; top: 0; width: {sw - int(sw * split)}px; height: {sh}px; overflow: hidden;">'
             f'<div style="position: absolute; left: -{int(sw * split)}px; top: 0; width: {sw}px; height: {sh}px;">{svg(False)}</div></div>')
    handle = (f'<div style="position: absolute; left: {int(sw * split) - 2}px; top: 0; width: 4px; height: {sh}px; background: {GOLD};"></div>'
              f'<div style="position: absolute; left: {int(sw * split) - 30}px; top: {int(sh * 0.46)}px; width: 60px; height: 60px; border-radius: 50%; background: {GOLD}; '
              f'display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 18px rgba(0,0,0,0.6);">'
              f'<svg width="32" height="20" viewBox="0 0 32 20" fill="none" stroke="{BLACK}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
              f'<path d="M10 3 L3 10 L10 17M22 3 L29 10 L22 17"/></svg></div>')
    lbl = f'{BODY} font-size: {v(f, 15, 16, 18)}px; font-weight: 900; letter-spacing: 4px; text-transform: uppercase; color: {GOLD};'
    labels = (f'<div style="position: absolute; left: 24px; bottom: 22px; {lbl}">Today</div>'
              f'<div style="position: absolute; right: 24px; bottom: 22px; {lbl}">Your plan</div>'
              f'<div style="position: absolute; left: 24px; top: 20px; {MONO} font-size: {v(f, 16, 17, 18)}px; color: {GOLD};">TREATMENT SIMULATION · PREVIEW</div>'
              f'<div style="position: absolute; right: 24px; top: 20px; {MONO} font-size: {v(f, 16, 17, 18)}px; color: {GOLD};">STAGE 0 → 14</div>')
    screen = (f'<div style="position: absolute; left: 30px; top: 30px; width: {sw}px; height: {sh}px; border-radius: 18px; overflow: hidden; '
              f'background: radial-gradient(90% 80% at 50% 30%, #1c1a16 0%, #0b0b0a 80%);">'
              + left + right + handle + labels + grain('light', 0.2, 'overlay') + '</div>')
    tablet = (f'<div style="width: {tw}px; height: {th}px; position: relative; flex-shrink: 0; align-self: center; border-radius: 44px; transform: rotate(-3deg); '
              f'background: linear-gradient(135deg, #3a3a3a 0%, #111 30%, #050505 70%, #2a2a2a 100%); box-shadow: {SHADOW_DEEP}, inset 0 0 0 2px rgba(255,255,255,0.08);">{screen}</div>')
    content = (two_line_head('black', 'See your smile', 'before you commit.', v(f, 84, 96, 106), v(f, 90, 102, 112))
               + grow() + tablet + grow() + spacer(v(f, 30, 40, 50))
               + f'<div style="{BODY} font-size: {v(f, 24, 27, 31)}px; line-height: 1.35; color: {BLACK};">A personalised treatment plan simulation, included for every member. Illustration only.</div>'
               + spacer(v(f, 26, 36, 48)) + footer('black'))
    return frame(w, h, BG_CREAM, BLACK, '', content, grain('dark', 0.2, 'multiply'), PAD[f])


# ---------- BAC-29: welcome-back envelope ----------
def bac29(f, w, h):
    ew = v(f, 700, 760, 840)
    eh = int(ew * 0.62)
    letter_h = int(eh * 0.9)
    letter = (f'<div style="position: absolute; left: {int(ew * 0.06)}px; top: -{int(eh * 0.52)}px; width: {int(ew * 0.88)}px; height: {letter_h}px; '
              f'background: {PAPER}; box-shadow: 0 -4px 20px rgba(0,0,0,0.3); padding: {int(eh * 0.08)}px {int(ew * 0.06)}px; box-sizing: border-box; color: {BLACK}; '
              f'transform: rotate(-2deg);">'
              + grain('dark', 0.3, 'multiply') +
              f'<div style="position: relative; {BODY} font-size: {int(ew * 0.02)}px; font-weight: 900; letter-spacing: 5px; text-transform: uppercase;">For Bond Dental patients</div>'
              f'<div style="position: relative; {SERIF} font-size: {int(ew * 0.085)}px; line-height: 1; margin-top: {int(eh * 0.05)}px;">Welcome back.</div>'
              f'<div style="position: relative; {BODY} font-size: {int(ew * 0.03)}px; line-height: 1.35; margin-top: {int(eh * 0.04)}px;">As an existing patient, you get 10% off your Bond Aligner Club treatment.</div></div>')
    pocket = (f'<div style="position: absolute; left: 0; top: 0; width: {ew}px; height: {eh}px; border-radius: 10px; overflow: hidden; '
              f'background: radial-gradient(120% 100% at 30% 0%, #242424 0%, #101010 60%, #060606 100%); box-shadow: 0 60px 80px -30px rgba(0,0,0,0.85);">'
              f'<svg width="{ew}" height="{eh}" viewBox="0 0 100 62" preserveAspectRatio="none" aria-hidden="true" style="position: absolute; left: 0; top: 0;">'
              f'<path d="M0 0 L 50 36 L 100 0" fill="none" stroke="rgba(210,183,140,0.35)" stroke-width="0.4"/>'
              f'<path d="M0 62 L 40 30 M 100 62 L 60 30" fill="none" stroke="rgba(210,183,140,0.18)" stroke-width="0.35"/></svg>'
              + grain('light', 0.25, 'overlay') + '</div>')
    sd = int(ew * 0.26)
    seal = (f'<div style="position: absolute; left: {int(ew / 2 - sd / 2)}px; top: {int(eh * 0.58 - sd / 2)}px; width: {sd}px; height: {sd}px; '
            f'border-radius: 47% 53% 50% 50% / 52% 48% 52% 48%; background: radial-gradient(circle at 36% 30%, #F3E6CC 0%, #D2B78C 40%, #8F7B5A 85%, #6F5E42 100%); '
            f'box-shadow: 0 14px 22px -8px rgba(0,0,0,0.7), inset 0 -6px 12px rgba(10,10,10,0.3); display: flex; align-items: center; justify-content: center;">'
            f'<div style="width: {int(sd * 0.74)}px; height: {int(sd * 0.74)}px; border-radius: 50%; border: 3px solid rgba(111,94,66,0.55); box-sizing: border-box; '
            f'display: flex; flex-direction: column; align-items: center; justify-content: center; color: #5C4D35;">'
            f'<div style="{SANS} font-weight: 900; font-size: {int(sd * 0.26)}px; line-height: 0.9; letter-spacing: -0.03em; text-shadow: 0 1px 0 rgba(255,244,222,0.6);">10%</div>'
            f'<div style="{BODY} font-size: {int(sd * 0.075)}px; font-weight: 900; letter-spacing: 3px; text-transform: uppercase; margin-top: 4px;">off</div></div></div>')
    env = (f'<div style="position: relative; width: {ew}px; height: {eh}px; flex-shrink: 0; align-self: center; margin-top: {int(eh * 0.55)}px; transform: rotate(3deg);">'
           + letter + pocket + seal + '</div>')
    content = (f'<div style="{BODY} font-size: 17px; font-weight: 700; letter-spacing: 7px; text-transform: uppercase; color: {GOLD};">Already a Bond Dental patient?</div>'
               + grow() + env + grow() + spacer(v(f, 16, 24, 32))
               + f'<div style="{BODY} font-size: {v(f, 24, 27, 31)}px; line-height: 1.35; color: {GOLD};">Same clinicians. Same clinics. Clearer pricing.</div>'
               + spacer(v(f, 26, 36, 48)) + footer('gold'))
    under = (f'<div style="position: absolute; left: 0; top: 0; right: 0; bottom: 0; '
             f'background: radial-gradient(55% 40% at 50% 52%, rgba(210,183,140,0.2) 0%, rgba(210,183,140,0) 100%);"></div>')
    return frame(w, h, BG_BLACK, GOLD, under, content, grain('light', 0.26, 'overlay'), PAD[f])


# ---------- BAC-30: index-card FAQ ----------
def bac30(f, w, h):
    qa = [('What does it cost?', '£995, £1,995, £2,995 or £3,595, depending on your plan.'),
          ('Is it the real Invisalign?', 'Yes. The same Invisalign, from the same Bond Dental clinicians.'),
          ('Can I spread the cost?', 'Yes. 0% finance is available on every plan, over up to 36 months.'),
          ('Where is treatment?', 'At Bond Dental London, starting at our Marylebone clinic.'),
          ('What’s the first step?', 'A consultation, where you see your options before you commit.')]
    if f == '1x1':
        qa = [qa[0], qa[1], qa[2], qa[4]]
    cw = v(f, 880, 900, 912)
    tabs = ''.join(f'<div style="flex-grow: 1; height: {v(f, 30, 34, 38)}px; margin-right: 6px; border-radius: 10px 10px 0 0; background: {"#D2B78C" if i == 0 else "#C2A87E" if i == 1 else "#B39A71"}; '
                   f'{BODY} font-size: 13px; font-weight: 900; letter-spacing: 3px; color: {BLACK}; display: flex; align-items: center; justify-content: center;">{["COST", "QUALITY", "FINANCE", "START"][i]}</div>'
                   for i in range(4))
    rows = ''.join(f'<div style="padding: {v(f, 14, 18, 24)}px 0; border-bottom: 1px solid rgba(10,10,10,0.18); display: flex; gap: 18px;">'
                   f'<div style="{SERIF} font-size: {v(f, 34, 38, 44)}px; line-height: 1; color: #8F7B5A; flex-shrink: 0; width: 34px;">Q.</div>'
                   f'<div><div style="{SANS} font-weight: 800; font-size: {v(f, 28, 31, 35)}px; letter-spacing: -0.01em; line-height: 1.15;">{q}</div>'
                   f'<div style="{BODY} font-size: {v(f, 21, 23, 26)}px; line-height: 1.35; margin-top: 6px;">{a}</div></div></div>' for q, a in qa)
    card = (f'<div style="width: {cw}px; align-self: center; flex-shrink: 0; transform: rotate(-1.5deg); filter: drop-shadow(0 40px 40px rgba(0,0,0,0.55));">'
            f'<div style="display: flex; padding: 0 {v(f, 30, 34, 36)}px;">{tabs}</div>'
            f'<div style="position: relative; background: {PAPER}; padding: {v(f, 14, 20, 26)}px {v(f, 36, 42, 46)}px {v(f, 22, 30, 38)}px; box-sizing: border-box; color: {BLACK}; '
            f'background-image: repeating-linear-gradient(180deg, rgba(0,0,0,0) 0 {v(f, 48, 52, 58)}px, rgba(143,123,90,0.14) {v(f, 48, 52, 58)}px {v(f, 49, 53, 59)}px), {PAPER};">'
            + grain('dark', 0.3, 'multiply') + f'<div style="position: relative;">{rows}</div></div></div>')
    content = (two_line_head('gold', 'You’ll never', 'leave wondering.', v(f, 84, 96, 106), v(f, 92, 104, 116))
               + grow() + card + grow() + spacer(v(f, 20, 30, 40)) + footer('gold'))
    return frame(w, h, BG_BLACK, GOLD, '', content, grain('light', 0.26, 'overlay'), PAD[f])


SECTION = [('26', bac26), ('27', bac27), ('28', bac28), ('29', bac29), ('30', bac30)]
