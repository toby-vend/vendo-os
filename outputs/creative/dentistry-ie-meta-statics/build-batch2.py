"""Dentistry.ie batch 2 statics (27 Oct 2026): Sedation and VHI / Irish Life. 3 concepts each, 1:1 + 9:16 + 1200x628.

Requested by Shaun:
  Sedation      McEvoy (Dublin 2), Kilkenny, Kildare   persona: Mark (lapsed, put off by the chair)
  VHI cover     Kilkenny, McEvoy (Dublin 2)            persona: Denise (unsure what private care costs or what her plan covers)

All in the approved photo-top layout (Toby, 23 Oct), headline below on navy, button, area pin.
Photos are stills from the client's own Drive footage (Meta Ads > Videos > no sound videos: Clinic Walkthrough + Montage),
saved as assets/photos/drv-*.jpg. No stock (Toby, 27 Oct).
The clinic is one slot: CLINICS[key] = (area label, address). Add a key to a campaign's list to render another clinic.

Facts: research-batch2.md. Copy: copy-mark-sedation.md, copy-denise-vhi.md.
No sedation prices (IV €300 Balbriggan vs from €400 McEvoy on the prices page), no staff names, no review counts,
no insurer logos, no claim that either clinic is on a direct-pay network (not verified).

Usage: python3 build-batch2.py  ->  b2-<campaign>-<clinic>-<1x1|9x16|landscape>.html, one row of 3 artboards each.
"""
from build import CSS as BASE_CSS, HERE, ad, photo
from build_campaigns import addr_line, centre, fade, head, logo1, logo9, step_row, sub
from build_guideline import LINEN, NAVY, SKY, btn, logo

DATE = '261027'

CLINICS = {  # the swappable slot: area on image, address (copy cards)
    'mcevoy': ('Dublin 2', '17 Fitzwilliam Street Upper, Dublin 2'),
    'kilkenny': ('Kilkenny', 'Friary Street, Kilkenny'),
    'kildare': ('Kildare', 'Claregate Street, Kildare'),
}

CSS = BASE_CSS + '\n.sL{width:1200px;height:628px}\n'


# ---------------------------------------------------------------- shared photo-top frames

def stack(x, y, w, size, h, body, body_size, extra='', align='left', gap=22):
    """Headline, body and any extra block in normal flow, so the spacing holds whatever the line count."""
    b = f'<div class="body" style="font-size:{body_size}px;line-height:1.45;opacity:.88;margin-top:{gap}px">{body}</div>' if body else ''
    e = f'<div style="margin-top:{gap + 6}px;display:flex;justify-content:{"center" if align == "center" else "flex-start"}">{extra}</div>' if extra else ''
    return f"""<div style="position:absolute;left:{x}px;top:{y}px;width:{w}px;color:{LINEN};text-align:{align}">
<div class="h" style="font-size:{size}px;line-height:1.06">{h}</div>{b}{e}</div>"""


def f1(img, pos, h, body, cta, pin_text, photo_h=610, top=560, size=66, extra=''):
    """1:1, the Dentures Slipping layout: photo across the top, headline on navy, button + area pin."""
    return ad('s1', NAVY, f"""
{photo(img, 0, 0, 1080, photo_h, pos, radius=0)}
{fade(0, 220, up=True)}{fade(photo_h - 240, 242)}
{logo1()}
{stack(72, top, 936, size, h, body, 25, extra)}
<div style="position:absolute;left:72px;top:900px">{btn(cta, 24, 32, 22, SKY, NAVY)}</div>
<div style="position:absolute;right:72px;top:917px">{addr_line(pin_text, 24)}</div>""")


def f9(img, pos, h, body, cta, pin_text, photo_top=380, head_top=1030, size=72, extra=''):
    """9:16: photo starts below the logo (faces stay clear of it), copy and pin above the bottom 340px safe zone."""
    return ad('s9', NAVY, f"""
{photo(img, 0, photo_top, 1080, 1150 - photo_top, pos, radius=0)}
{fade(photo_top, 200, up=True)}{fade(760, 392)}
{logo9()}
{stack(90, head_top, 900, size, h, body, 28, extra, align='center')}
{centre(1392, addr_line(pin_text, 27, align='center'))}
{centre(1462, btn(cta, 28, 40, 24, SKY, NAVY))}""")


def fL(img, pos, h, body, cta, pin_text, size=46, extra=''):
    """1200x628: text on navy left, photo right, fading into the navy."""
    return ad('sL', NAVY, f"""
{photo(img, 540, 0, 660, 628, pos, radius=0)}
<div style="position:absolute;left:540px;top:0;width:240px;height:628px;background:linear-gradient(90deg,{NAVY},rgba(15,27,41,0))"></div>
<div style="position:absolute;left:52px;top:46px">{logo(180, LINEN)}</div>
<div style="position:absolute;left:0;top:104px;width:640px;height:336px;display:flex;align-items:center"><div style="position:relative;width:100%;height:100%">{stack(52, 0, 580, size, h, body, 20, extra, gap=18).replace('top:0px', 'top:50%;transform:translateY(-50%)')}</div></div>
<div style="position:absolute;left:52px;top:458px">{addr_line(pin_text, 19)}</div>
<div style="position:absolute;left:52px;top:506px">{btn(cta, 19, 26, 17, SKY, NAVY)}</div>""")


# ================================================================ SEDATION (Mark)
SED_CTA = 'Book a sedation consultation'
SED_STEPS = [('Consultation', ''), ('Oral or IV sedation', ''), ('Relaxed treatment', ''), ('A lift home after', '')]


def sed_pin(area):
    return f'Sedation in {area}'


SA_H = 'Years since your last check-up?<br><em>Sedation can make it easier.</em>'
SA_B = 'You stay awake but deeply relaxed, with our team monitoring you throughout.'


def sa_1(area):
    return f1('drv-sed-dentist-smile.jpg', '50% 14%', SA_H, SA_B, SED_CTA, sed_pin(area), size=62)


def sa_9(area):
    return f9('drv-sed-dentist-smile.jpg', '50% 14%', SA_H, SA_B, SED_CTA, sed_pin(area), size=58)


def sa_L(area):
    return fL('drv-sed-dentist-smile.jpg', '50% 14%', SA_H, SA_B, SED_CTA, sed_pin(area), size=40)


SB_H = 'Dental sedation, <em>explained before you book.</em>'


def sb_1(area):
    return f1('drv-sed-consult-chat.jpg', '50% 12%', SB_H, '', SED_CTA, sed_pin(area), photo_h=560, top=500,
              extra=step_row(SED_STEPS, 936, 2, 1.1))


def sb_9(area):
    return f9('drv-sed-consult-chat.jpg', '50% 12%', SB_H, '', SED_CTA, sed_pin(area), head_top=980,
              extra=step_row(SED_STEPS, 820, 2, 1.25))


def sb_L(area):
    return fL('drv-sed-consult-chat.jpg', '50% 12%', SB_H, '', SED_CTA, sed_pin(area),
              extra=step_row(SED_STEPS, 520, 2, .8))


SC_H = 'Relaxed in the chair.<br><em>Home for a cuppa after.</em>'
SC_B = 'Time often seems to pass quickly under sedation. Someone you trust takes you home, with clear aftercare from us.'


def sc_1(area):
    return f1('drv-sed-relaxed-chair.jpg', '50% 90%', SC_H, SC_B, SED_CTA, sed_pin(area))


def sc_9(area):
    return f9('drv-sed-relaxed-chair.jpg', '50% 90%', SC_H, SC_B, SED_CTA, sed_pin(area))


def sc_L(area):
    return fL('drv-sed-relaxed-chair.jpg', '50% 90%', SC_H, SC_B, SED_CTA, sed_pin(area))


# ================================================================ VHI / IRISH LIFE (Denise)
VHI_CTA = 'Book your check-up'


def vhi_pin(area):
    return f'Dentistry.ie {area}'


VA_H = 'VHI or Irish Life member?<br><em>You’re welcome here.</em>'
VA_B = 'We support patients using VHI, Irish Life and other major Irish health insurers.'


def va_1(area):
    return f1('drv-vhi-reception.jpg', '50% 42%', VA_H, VA_B, VHI_CTA, vhi_pin(area))


def va_9(area):
    return f9('drv-vhi-reception.jpg', '50% 42%', VA_H, VA_B, VHI_CTA, vhi_pin(area))


def va_L(area):
    return fL('drv-vhi-reception.jpg', '50% 42%', VA_H, VA_B, VHI_CTA, vhi_pin(area))


VB_H = 'Paying for dental cover?<br><em>Make sure you use it.</em>'
VB_B = 'Check what your VHI or Irish Life plan covers, then book your check-up and cleaning with us.'


def vb_1(area):
    return f1('drv-vhi-xray-checkup.jpg', '50% 26%', VB_H, VB_B, VHI_CTA, vhi_pin(area))


def vb_9(area):
    return f9('drv-vhi-xray-checkup.jpg', '50% 26%', VB_H, VB_B, VHI_CTA, vhi_pin(area))


def vb_L(area):
    return fL('drv-vhi-xray-checkup.jpg', '50% 26%', VB_H, VB_B, VHI_CTA, vhi_pin(area))


VC_H = 'Health cover, PRSI and tax relief.<br><em>Make the most of all three.</em>'
VC_STEPS = [('VHI or Irish Life cover', ''), ('Free PRSI exam, if eligible', ''), ('20% tax relief, organised for you', '')]


def vc_1(area):
    return f1('drv-vhi-reception-wide.jpg', '50% 50%', VC_H, '', VHI_CTA, vhi_pin(area), photo_h=520, top=470, size=60,
              extra=step_row(VC_STEPS, 936, 1, 1.0))


def vc_9(area):
    return f9('drv-vhi-reception-wide.jpg', '50% 50%', VC_H, '', VHI_CTA, vhi_pin(area), head_top=950, size=58,
              extra=step_row(VC_STEPS, 640, 1, 1.15))


def vc_L(area):
    return fL('drv-vhi-reception-wide.jpg', '50% 50%', VC_H, '', VHI_CTA, vhi_pin(area), size=36,
              extra=step_row(VC_STEPS, 520, 1, .78))


CAMPAIGNS = {
    'sedation': {'title': 'Sedation', 'persona': 'Mark', 'clinics': ['mcevoy', 'kilkenny', 'kildare'],
                 'concepts': [('Been A While', sa_1, sa_9, sa_L), ('Explained First', sb_1, sb_9, sb_L),
                              ('Home For A Cuppa', sc_1, sc_9, sc_L)]},
    'vhi': {'title': 'VHI and Irish Life', 'persona': 'Denise', 'clinics': ['kilkenny', 'mcevoy'],
            'concepts': [('Members Welcome', va_1, va_9, va_L), ('Use Your Cover', vb_1, vb_9, vb_L),
                         ('All Three', vc_1, vc_9, vc_L)]},
}
SIZES = {'1x1': 1, '9x16': 2, 'landscape': 3}


def main():
    n = 0
    for key, camp in CAMPAIGNS.items():
        for k in camp['clinics']:
            area = CLINICS[k][0]
            for size, idx in SIZES.items():
                row = ''.join(c[idx](area) for c in camp['concepts'])
                html = (f'<!doctype html><html lang="en-IE"><head><meta charset="utf-8">'
                        f'<title>Dentistry.ie {camp["title"]} {area} {size}</title><style>{CSS}</style></head>'
                        f'<body><div class="row">{row}</div></body></html>')
                (HERE / f'b2-{key}-{k}-{size}.html').write_text(html)
                n += len(camp['concepts'])
    print('built', n, 'artboards')


if __name__ == '__main__':
    main()
