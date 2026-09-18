"""Section A: Campaign hero (BAC-01 to BAC-05), v2."""
from lib2 import *


# ---------- BAC-01: the slate ----------
def bac01(f, w, h):
    stripes = f'repeating-linear-gradient(118deg, {BLACK} 0 46px, {GOLD} 46px 92px)'
    stick_h = v(f, 62, 72, 100)
    lab = f'{BODY} font-size: 15px; font-weight: 700; letter-spacing: 4px; text-transform: uppercase; color: {GOLD}; opacity: 0.8;'
    chalk = f'{HAND} font-weight: 700; color: {GOLD}; line-height: 1;'
    rule = 'rgba(210,183,140,0.45)'
    cell = lambda label, value, size, extra='': (
        f'<div style="display: flex; flex-direction: column; gap: 6px; padding: {v(f, 14, 18, 22)}px {v(f, 20, 24, 26)}px; {extra}">'
        f'<div style="{lab}">{label}</div><div style="{chalk} font-size: {size}px;">{value}</div></div>')
    board = (
        f'<div style="background: {BLACK}; border-radius: 0 0 10px 10px; display: flex; flex-direction: column;">'
        f'<div style="border-bottom: 2px solid {rule}; display: flex; flex-direction: column; gap: 6px; padding: {v(f, 16, 20, 26)}px {v(f, 20, 24, 26)}px;">'
        f'<div style="{lab}">Production</div>'
        f'<div style="{SANS} font-weight: 800; font-stretch: 125%; font-size: {v(f, 30, 34, 40)}px; letter-spacing: 0.06em; color: {GOLD}; line-height: 1;">BOND ALIGNER CLUB</div></div>'
        f'<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));">'
        + cell('Scene', '01', v(f, 50, 58, 76), f'border-right: 2px solid {rule};')
        + cell('Take', '01', v(f, 50, 58, 76), f'border-right: 2px solid {rule};')
        + cell('Director', 'You', v(f, 50, 58, 76))
        + '</div></div>')
    slate = (
        f'<div style="transform: rotate(-2.5deg); transform-origin: 30% 50%; box-shadow: {SHADOW_DEEP}; border-radius: 10px; '
        f'width: {v(f, 700, 780, 900)}px; flex-shrink: 0; position: relative; margin-top: {v(f, 18, 24, 30)}px;">'
        f'<div style="height: {stick_h}px; background: {stripes}; border: 3px solid {BLACK}; box-sizing: border-box; border-radius: 8px 8px 0 0; transform: rotate(-7deg); transform-origin: 0 100%; '
        f'box-shadow: 0 10px 20px -8px rgba(10,10,10,0.5); position: relative; top: -6px;"></div>'
        f'<div style="height: {int(stick_h * 0.55)}px; background: {stripes}; background-position: 23px 0; border: 3px solid {BLACK}; border-bottom: 0; box-sizing: border-box;"></div>'
        f'{board}</div>')
    size = v(f, 118, 140, 150)
    headline = (
        f'<div style="position: relative;">'
        f'<div style="{SANS} font-style: italic; font-weight: 800; font-size: {size}px; line-height: 0.9; letter-spacing: -0.04em; color: {BLACK};">Start as you<br>mean to</div>'
        f'<div style="{SERIF} font-size: {int(size * 1.22)}px; line-height: 0.95; letter-spacing: -0.015em; color: {BLACK}; margin-top: -4px;">go on.</div>'
        + sticker(f) + '</div>')
    right = (f'<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 18px;">'
             f'<div style="{BODY} font-size: {v(f, 21, 22, 24)}px; line-height: 1.35; text-align: right; color: {BLACK};">0% finance available<br>over up to 36 months.</div>'
             f'{cta("black")}</div>')
    content = (slate + grow() + headline + grow() + footer('black', right))
    return frame(w, h, BG_GOLD, BLACK, '', content, grain('dark', 0.35, 'multiply') + grain('light', 0.35, 'overlay'), PAD[f])


def sticker(f):
    d = v(f, 220, 244, 290)
    return (f'<div style="position: absolute; right: {v(f, 0, 10, 10)}px; top: {v(f, 96, 122, 118)}px; width: {d}px; height: {d}px; border-radius: 50%; '
            f'background: {BLACK}; color: {GOLD}; transform: rotate(9deg); box-shadow: {SHADOW_SOFT}; display: flex; flex-direction: column; '
            f'align-items: center; justify-content: center; text-align: center;">'
            f'<div style="position: absolute; left: 12px; top: 12px; right: 12px; bottom: 12px; border-radius: 50%; border: 2px dashed rgba(210,183,140,0.5);"></div>'
            f'<div style="{BODY} font-size: 16px; font-weight: 900; letter-spacing: 4px; text-transform: uppercase;">Invisalign</div>'
            f'<div style="{SERIF} font-size: {int(d * 0.17)}px; line-height: 1; margin-top: 4px;">from</div>'
            f'<div style="{SANS} font-weight: 900; font-size: {int(d * 0.3)}px; letter-spacing: -0.04em; line-height: 0.95;">£995</div></div>')


# ---------- BAC-02: the film still ----------
def bac02(f, w, h):
    bar_top = v(f, 112, 132, 250)
    photo_h = v(f, 560, 760, 900)
    meta = f'{MONO} font-size: {v(f, 19, 20, 22)}px; letter-spacing: 3px; color: {GOLD};'
    top_bar = (f'<div style="height: {bar_top}px; flex-shrink: 0; display: flex; justify-content: space-between; align-items: flex-end; '
               f'padding: 0 {PAD[f][1]}px 22px {PAD[f][3]}px; box-sizing: border-box;">'
               f'<div style="{meta}">SCENE 01 · TAKE 03</div><div style="{meta}">00:01:14:08</div></div>')
    photo = (f'<div style="height: {photo_h}px; flex-shrink: 0; position: relative; overflow: hidden;">'
             f'<img src="{B["smile"]}" alt="" style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; object-fit: cover; '
             f'object-position: 58% {v(f, 28, 30, 32)}%; filter: grayscale(1) contrast(1.08) brightness(0.96);">'
             f'<div style="position: absolute; left: 0; right: 0; bottom: 0; height: 55%; background: linear-gradient(180deg, rgba(10,10,10,0) 0%, rgba(10,10,10,0.72) 100%);"></div>'
             + grain('light', 0.45, 'overlay') +
             f'<div style="position: absolute; left: 60px; right: 60px; bottom: {v(f, 34, 44, 56)}px; text-align: center; {BODY} font-weight: 700; '
             f'font-size: {v(f, 44, 50, 56)}px; line-height: 1.25; color: {GOLD}; text-shadow: 0 2px 14px rgba(10,10,10,0.85);">'
             f'Nobody’s the main character<br>every day.</div></div>')
    bottom = (f'<div style="flex-grow: 1; display: flex; flex-direction: column; padding: {v(f, 40, 52, 64)}px {PAD[f][1]}px {v(f, 64, 76, 330)}px {PAD[f][3]}px; box-sizing: border-box;">'
              f'<div style="{SERIF} font-size: {v(f, 88, 100, 116)}px; line-height: 0.95; color: {GOLD}; letter-spacing: -0.01em;">But a good start helps.</div>'
              + grow() + footer('gold') + '</div>')
    content = top_bar + photo + bottom
    return frame(w, h, BG_BLACK, GOLD, '', content, grain('light', 0.25, 'overlay'), (0, 0, 0, 0))


# ---------- BAC-03: the poster ----------
def bac03(f, w, h):
    art_h = v(f, 360, 520, 760)
    small = f'{SANS} font-stretch: 62%; font-weight: 600; font-size: {v(f, 17, 19, 21)}px; letter-spacing: 1px;'
    big = f'{SANS} font-stretch: 62%; font-weight: 800; font-size: {v(f, 27, 30, 33)}px; letter-spacing: 1px;'
    billing = (f'<div style="text-align: center; color: {GOLD}; line-height: 1.15; max-width: 820px; align-self: center; text-transform: uppercase;">'
               f'<span style="{small}">a</span> <span style="{big}">Bond Aligner Club</span> <span style="{small}">production</span> '
               f'<span style="{small}">starring</span> <span style="{big}">genuine Invisalign</span> '
               f'<span style="{small}">with</span> <span style="{big}">the same clinicians</span> <span style="{small}">and</span> <span style="{big}">the same clinics</span><br>'
               f'<span style="{small}">express £995 · lite £1,995 · moderate £2,995 · comprehensive £3,595 · 0% finance available over up to 36 months · at Bond Dental London</span></div>')
    art = (f'<div style="height: {art_h}px; flex-shrink: 0; position: relative; overflow: hidden; background: {GOLD}; margin: 0 -{v(f, 34, 42, 48)}px;">'
           f'<img src="{B["smile"]}" alt="" style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; object-fit: cover; '
           f'object-position: 58% {v(f, 26, 28, 30)}%; filter: grayscale(1) contrast(1.25) brightness(1.02); mix-blend-mode: multiply;">'
           f'<div style="position: absolute; left: 0; right: 0; bottom: 0; height: 60%; background: linear-gradient(180deg, rgba(10,10,10,0) 0%, rgba(10,10,10,0.85) 70%, #0A0A0A 100%);"></div>'
           f'<div style="position: absolute; left: 0; right: 0; top: 0; height: 30%; background: linear-gradient(0deg, rgba(10,10,10,0) 0%, rgba(10,10,10,0.55) 100%);"></div>'
           + grain('light', 0.5, 'overlay') + '</div>')
    title = (f'<div style="{SANS} font-weight: 900; font-stretch: 125%; font-size: {v(f, 112, 132, 128)}px; line-height: 0.84; letter-spacing: 0.01em; '
             f'color: {GOLD}; text-align: center; margin-top: -{v(f, 100, 118, 116)}px; position: relative; text-shadow: 0 10px 40px rgba(10,10,10,0.6);">STARTING<br>WELL</div>')
    inner_pad = v(f, 34, 42, 48)
    poster = (
        f'<div style="flex-grow: 1; border: 2px solid {GOLD}; padding: 10px; display: flex; flex-direction: column; min-height: 0;">'
        f'<div style="flex-grow: 1; border: 1px solid rgba(210,183,140,0.55); padding: {v(f, 34, 42, 170)}px {inner_pad}px {v(f, 28, 36, 250)}px; display: flex; flex-direction: column; overflow: hidden;">'
        f'<div style="{BODY} font-size: 17px; font-weight: 700; letter-spacing: 7px; text-transform: uppercase; color: {GOLD}; text-align: center; padding-bottom: {v(f, 20, 26, 32)}px;">Bond Dental London presents</div>'
        + art + title
        + f'<div style="{SERIF} font-size: {v(f, 44, 52, 60)}px; color: {GOLD}; text-align: center; margin-top: {v(f, 14, 22, 30)}px; line-height: 1;">Start as you mean to go on.</div>'
        + grow() + billing + spacer(v(f, 18, 28, 40))
        + f'<div style="display: flex; justify-content: space-between; align-items: flex-end;">{lockup("gold", v(f, 180, 200, 210))}'
          f'<div style="{SANS} font-weight: 800; font-stretch: 125%; font-size: {v(f, 30, 34, 38)}px; letter-spacing: 0.14em; color: {GOLD}; line-height: 1;">NOW BOOKING</div></div>'
        + '</div></div>')
    pad = {'1x1': (40, 40, 40, 40), '4x5': (48, 48, 48, 48), '9x16': (64, 56, 64, 56)}[f]
    return frame(w, h, BG_BLACK, GOLD, '', poster, grain('light', 0.3, 'overlay'), pad)


# ---------- BAC-04: the photo-booth strip ----------
X_MARK = ('<svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" style="position: absolute; left: 0; top: 0;">'
          '<path d="M14 12 C 36 36, 62 64, 88 90" stroke="#D2B78C" stroke-width="7" stroke-linecap="round" fill="none" vector-effect="non-scaling-stroke"/>'
          '<path d="M86 14 C 62 38, 40 60, 12 88" stroke="#D2B78C" stroke-width="7" stroke-linecap="round" fill="none" vector-effect="non-scaling-stroke"/></svg>')
RING = ('<svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" style="position: absolute; left: 0; top: 0;">'
        '<path d="M50 6 C 80 5, 95 26, 94 50 C 93 78, 74 95, 48 94 C 20 93, 5 74, 7 48 C 9 24, 26 9, 55 8" stroke="#D2B78C" stroke-width="6" '
        'stroke-linecap="round" fill="none" vector-effect="non-scaling-stroke"/></svg>')


def booth_frame(i, fh):
    # Takes 1-3 are visibly wrong (blurred, cropped, tilted); take 4 is the keeper.
    styles = [
        'object-position: 58% 30%; filter: grayscale(1) contrast(1.1) blur(3px);',
        'object-position: 90% 95%; transform: scale(1.9); filter: grayscale(1) contrast(1.1);',
        'object-position: 58% 30%; transform: rotate(14deg) scale(1.45); filter: grayscale(1) contrast(1.1) brightness(0.85);',
        'object-position: 58% 28%; transform: scale(1.25); filter: grayscale(1) contrast(1.12);',
    ]
    mark = RING if i == 3 else X_MARK
    return (f'<div style="height: {fh}px; flex-shrink: 0; position: relative; overflow: hidden; background: #222;">'
            f'<img src="{B["smile"]}" alt="" style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; object-fit: cover; {styles[i]}">'
            + grain('light', 0.5, 'overlay') + mark + '</div>')


def bac04(f, w, h):
    sw = v(f, 300, 330, 380)
    top = v(f, 64, 84, 520)
    sh = v(f, 950, 1170, 1000)
    pad_s, gap = 18, 14
    fh = int((sh - pad_s * 2 - gap * 3 - 44) / 4)
    right = v(f, 78, 86, 96)
    frames = ''.join(booth_frame(i, fh) for i in range(4))
    strip = (f'<div style="position: absolute; right: {right}px; top: {top}px; width: {sw}px; height: {sh}px; background: {BLACK}; '
             f'padding: {pad_s}px; box-sizing: border-box; display: flex; flex-direction: column; gap: {gap}px; transform: rotate(4.5deg); box-shadow: {SHADOW_DEEP};">'
             f'{frames}<div style="{MONO} font-size: 15px; letter-spacing: 3px; color: {GOLD}; text-align: center; padding-top: 4px;">4 TAKES · 1 KEEPER</div></div>')
    tape = (f'<div style="position: absolute; right: {right + sw // 2 - 70}px; top: {top - 26}px; width: 140px; height: 46px; '
            f'background: rgba(210,183,140,0.78); transform: rotate(-6deg); box-shadow: 0 4px 10px -4px rgba(10,10,10,0.3);"></div>')
    note_top = top + pad_s + 3 * (fh + gap) + int(fh * 0.25)
    note = (f'<div style="position: absolute; right: {right + sw + v(f, 14, 18, 22)}px; top: {note_top}px; display: flex; align-items: center; gap: 8px; transform: rotate(-7deg); color: {BLACK};">'
            f'<div style="{HAND} font-size: {v(f, 50, 56, 62)}px; font-weight: 700; line-height: 1;">this one.</div>'
            f'<svg width="74" height="40" viewBox="0 0 74 40" fill="none" stroke="{BLACK}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
            f'<path d="M3 30 C 22 36, 46 30, 66 12"/><path d="M52 10 L67 11 L63 26"/></svg></div>')
    col_w = w - PAD[f][3] - right - sw - v(f, 30, 40, 60)
    head_w = col_w if f != '9x16' else w - PAD[f][1] - PAD[f][3]
    head = (f'<div style="width: {head_w}px;">'
            f'<div style="{SANS} font-weight: 800; font-size: {v(f, 96, 108, 118)}px; line-height: 0.9; letter-spacing: -0.04em; color: {BLACK};">No more</div>'
            f'<div style="{SERIF} font-size: {v(f, 92, 106, 116)}px; line-height: 0.95; color: {BLACK}; margin-top: 10px;">“wait, delete that one.”</div></div>')
    sub = (f'<div style="width: {col_w}px; {BODY} font-size: {v(f, 28, 31, 34)}px; line-height: 1.35; color: {BLACK};">'
           f'Straighter teeth with the real Invisalign, from&nbsp;<b>£995</b>.</div>')
    foot = (f'<div style="width: {col_w}px; display: flex; flex-direction: column; gap: 30px; align-items: flex-start;">{lockup("black", 210)}{cta("black")}</div>')
    content = head + spacer(v(f, 34, 44, 56)) + sub + grow() + foot
    under = grain('dark', 0.22, 'multiply')
    return frame(w, h, BG_CREAM, BLACK, under, content, tape + strip + note, PAD[f])


# ---------- BAC-05: the script page ----------
def bac05(f, w, h):
    fs = v(f, 29, 32, 36)
    lh = 1.42
    pw = v(f, 840, 880, 912)
    ph = v(f, 790, 1010, 1110)
    L = lambda t, ind=0, extra='': f'<div style="{MONO} font-size: {fs}px; line-height: {lh}; color: {BLACK}; padding-left: {ind}px; {extra}">{t}</div>'
    gapb = spacer(int(fs * 0.9))
    cue, dlg = int(pw * 0.33), int(pw * 0.17)
    hl = (f'<span style="background: linear-gradient(176deg, rgba(210,183,140,0) 6%, {GOLD} 9%, {GOLD} 88%, rgba(210,183,140,0) 92%); '
          f'padding: 0 10px; margin: 0 -6px; border-radius: 4px 10px 6px 12px;">As I mean to go on.</span>')
    margin_note = (f'<div style="position: absolute; left: {int(pw * 0.6)}px; top: -4px; transform: rotate(-8deg); display: flex; align-items: center; gap: 6px; color: #0A0A0A; opacity: 0.85;">'
                   f'<svg width="54" height="30" viewBox="0 0 54 30" fill="none" stroke="#0A0A0A" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
                   f'<path d="M50 22 C 36 28, 18 26, 5 12"/><path d="M4 24 L4 11 L17 10"/></svg>'
                   f'<div style="{HAND} font-size: {v(f, 42, 46, 52)}px; font-weight: 700; line-height: 1; white-space: nowrap;">that’s you</div></div>')
    script = (
        f'<div style="{MONO} font-size: {fs}px; color: {BLACK}; text-align: right;">1.</div>' + spacer(int(fs * 0.6))
        + L('<b>INT. BOND DENTAL, MARYLEBONE. MORNING.</b>') + gapb
        + L('Our lead walks in. She has been meaning to do this for years.') + gapb
        + L('DENTIST', cue) + L('So. Where would you like to start?', dlg, f'padding-right: {dlg}px;') + gapb
        + f'<div style="position: relative;">{L("OUR LEAD", cue)}{margin_note}</div>'
        + L('(beat)', dlg + 70) + L(hl, dlg) + gapb
        + L('She books the consultation. Invisalign, from £995.') + grow()
        + L('CUT TO:', 0, 'text-align: right;'))
    holes = ''.join(f'<div style="position: absolute; left: 30px; top: {int(ph * p) - 13}px; width: 26px; height: 26px; border-radius: 50%; '
                    f'background: radial-gradient(circle at 35% 30%, #fff5dc 0%, {GOLD} 45%, rgba(10,10,10,0.55) 100%); '
                    f'box-shadow: 0 2px 4px rgba(10,10,10,0.45);"></div>' for p in ((0.12, 0.88) if f == '1x1' else (0.1, 0.5, 0.9)))
    paper = (f'<div style="width: {pw}px; height: {ph}px; flex-shrink: 0; align-self: center; position: relative; transform: rotate(-1.8deg); box-shadow: {SHADOW_DEEP}; '
             f'background: radial-gradient(120% 90% at 30% 0%, #fffdf8 0%, {CREAM} 55%, #efe5d4 100%);">'
             + grain('dark', 0.35, 'multiply') + holes
             + f'<div style="position: absolute; left: 0; top: 0; width: {pw}px; height: {ph}px; box-sizing: border-box; padding: {v(f, 44, 60, 70)}px {v(f, 60, 70, 76)}px {v(f, 40, 56, 66)}px {v(f, 96, 110, 116)}px; '
               f'display: flex; flex-direction: column;">{script}</div></div>')
    right = (f'<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 16px;">'
             f'<div style="{SERIF} font-size: {v(f, 40, 46, 52)}px; color: {GOLD}; line-height: 1; text-align: right;">Start as you mean to go on.</div>{cta("gold")}</div>')
    content = paper + grow() + footer('gold', right, 200)
    pad = {'1x1': (56, 72, 64, 72), '4x5': (80, 80, 80, 80), '9x16': (250, 84, 330, 84)}[f]
    under = (f'<div style="position: absolute; left: 0; top: 0; right: 0; bottom: 0; '
             f'background: radial-gradient(60% 45% at 50% 40%, rgba(210,183,140,0.2) 0%, rgba(210,183,140,0) 100%);"></div>')
    return frame(w, h, BG_BLACK, GOLD, under, content, grain('light', 0.3, 'overlay'), pad)


SECTION = [('01', bac01), ('02', bac02), ('03', bac03), ('04', bac04), ('05', bac05)]
