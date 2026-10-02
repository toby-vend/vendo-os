"""Persona sets for the Oxford House Clear Aligner Open Day (Amy, Dan, Michelle).

Usage: python3 personas.py  -> writes <persona>-1x1.html and <persona>-9x16.html
Shares brand tokens and helpers with build.py. Copy: copy-<persona>.md.
Five layout templates (split, full, band, light, date), each rendered at 1x1 and 9x16.
9:16 keeps key copy between y=250 and y=1580.
"""
from build import (ROOT, C, CTA, TICK, STAR, ARROW, logo, cta, proof, photo, receipt, calendar,
                   avatar, note_card, name, page)

GOLD_TICK = lambda s: TICK.format(s=s, bg=C["gold"], fg=C["wh"])
TEAL_TICK = lambda s: TICK.format(s=s, bg=C["bright"], fg=C["wh"])


def ab(x, y, w, html, extra=""):
    return f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px;{extra}">{html}</div>'


def pill(text, bg=None, fg="#fff", size=1.0):
    bg = bg or C["gold"]
    return (f'<span class="pill" style="background:{bg};color:{fg};height:{int(50*size)}px;font-size:{int(20*size)}px">{text}</span>')


# ---------------------------------------------------------------- cards (static blocks, placed by templates)
def _card(inner, scale, rot, pad=(40, 46), bg=None):
    bg = bg or C["paper"]
    return (f'<div style="padding:{int(pad[0]*scale)}px {int(pad[1]*scale)}px;background:{bg};border-radius:{int(14*scale)}px;'
            f'transform:rotate({rot}deg);box-shadow:0 34px 70px rgba(0,0,0,.36),0 6px 16px rgba(0,0,0,.2)">{inner}</div>')


def eyebrow(text, color, scale):
    return f'<div class="eyebrow" style="font-size:{int(17*scale)}px;color:{color};margin-bottom:{int(14*scale)}px">{text}</div>'


def list_card(title, items, scale=1.0, rot=1.3, value_color=None):
    """items: [(label, value or '')]"""
    value_color = value_color or C["teal"]
    rows = []
    for i, (label, value) in enumerate(items):
        border = f"border-top:1px solid {C['line']};" if i else ""
        rows.append(f'<div style="display:flex;justify-content:space-between;align-items:center;gap:{int(14*scale)}px;padding:{int(17*scale)}px 0;{border}">'
                    f'<span style="display:flex;align-items:center;gap:{int(14*scale)}px;font-size:{int(26*scale)}px;color:{C["ink"]}">{GOLD_TICK(int(28*scale))}{label}</span>'
                    f'<span class="jo" style="font-size:{int(29*scale)}px;font-weight:700;color:{value_color};padding-top:{int(4*scale)}px;white-space:nowrap">{value}</span></div>')
    return _card(eyebrow(title, C["gold"], scale) + "".join(rows), scale, rot, pad=(30, 40))


def text_card(title, body, tick=None, scale=1.0, rot=-1.4):
    t = (f'<div style="margin-top:{int(24*scale)}px;padding-top:{int(22*scale)}px;border-top:1px solid {C["line"]};display:flex;align-items:center;gap:{int(16*scale)}px">'
         f'{GOLD_TICK(int(36*scale))}<span class="jo" style="font-size:{int(28*scale)}px;font-weight:700;color:{C["deep"]};padding-top:{int(4*scale)}px">{tick}</span></div>') if tick else ""
    return _card(eyebrow(title, C["teal"], scale) + f'<div class="body" style="font-size:{int(29*scale)}px;color:{C["ink"]}">{body}</div>' + t, scale, rot, pad=(44, 50))


def price_card(label, big, sub, scale=1.0, rot=1.5):
    return _card(eyebrow(label, C["gold"], scale)
                 + f'<div class="jo" style="font-size:{int(118*scale)}px;font-weight:700;line-height:1;color:{C["deep"]}">{big}</div>'
                 + f'<div style="font-size:{int(23*scale)}px;line-height:1.35;color:#4a5d60;margin-top:{int(12*scale)}px">{sub}</div>', scale, rot, pad=(38, 46))


def steps_card(title, steps, scale=1.0, rot=-1.2):
    rows = []
    for i, s in enumerate(steps, 1):
        rows.append(f'<div style="display:flex;align-items:center;gap:{int(18*scale)}px;padding:{int(12*scale)}px 0">'
                    f'<span class="jo" style="width:{int(46*scale)}px;height:{int(46*scale)}px;flex:none;border-radius:50%;background:{C["bright"]};color:#fff;'
                    f'display:flex;align-items:center;justify-content:center;font-size:{int(24*scale)}px;font-weight:700;padding-top:{int(4*scale)}px">{i}</span>'
                    f'<span style="font-size:{int(27*scale)}px;color:{C["ink"]}">{s}</span></div>')
    return _card(eyebrow(title, C["teal"], scale) + "".join(rows), scale, rot, pad=(36, 44))


def quote_card(quote, who, scale=1.0, rot=-1.3):
    face = (f'<span style="width:{int(72*scale)}px;height:{int(72*scale)}px;flex:none;border-radius:50%;'
            f'background:url(assets/photos/Syed-Photo-424x500-1.webp) 50% 18%/cover;border:3px solid {C["gold"]}"></span>')
    return _card(f'<div class="jo" style="font-size:{int(44*scale)}px;font-weight:700;line-height:1.15;color:{C["deep"]}">&ldquo;{quote}&rdquo;</div>'
                 f'<div style="display:flex;align-items:center;gap:{int(16*scale)}px;margin-top:{int(24*scale)}px">{face}'
                 f'<span style="font-size:{int(22*scale)}px;color:#4a5d60"><b style="color:{C["ink"]}">{who}</b><br>Oxford House Dental Practice</span></div>',
                 scale, rot, pad=(42, 48))


# ---------------------------------------------------------------- shared bits
def column(x, y, w, h, parts, gap=26):
    """Flow column: parts stack top-down; the last part (the CTA row) sits at the bottom."""
    body = "".join(f'<div>{p}</div>' for p in parts[:-1])
    return (f'<div class="abs" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;display:flex;flex-direction:column;gap:{gap}px">'
            f'{body}<div style="margin-top:auto">{parts[-1]}</div></div>')


def hl(html, size, color="#fff"):
    return f'<div class="hl" style="font-size:{size}px;color:{color}">{html}</div>'


def body(text, size, color="#d6e6e7"):
    return f'<div class="body" style="font-size:{size}px;color:{color}">{text}</div>'


def grain():
    return '<div class="grain" data-name="Grain (locked)"></div>'


def board(size, nm, bg, inner):
    cls = "s1" if size == "1x1" else "s9"
    return f'<div class="ab {cls}" data-name="{nm}" style="background:{bg}">{inner}{grain()}</div>'


PILL_DATE = "Open Day &middot; Sat 7 November"


# ---------------------------------------------------------------- templates
def t_split(s, size):
    """Photo panel on one side, deep teal text column on the other, card in the column (1x1) or floating over the photo (9x16)."""
    nm = name(s["persona"], "Stock", s["detail"], size)
    if size == "1x1":
        left = s.get("side", "left") == "left"
        px = 0 if left else 480
        grad = (f"linear-gradient(90deg,rgba(6,68,75,0) 44%,rgba(6,68,75,.8) 52%,{C['deep']} 57%)" if left else
                f"linear-gradient(270deg,rgba(6,68,75,0) 44%,rgba(6,68,75,.8) 52%,{C['deep']} 57%)")
        cx = 568 if left else 64
        inner = (photo(px, 0, 600, 1080, s["img"], fx=s.get("fx", .5), fy=s.get("fy", .35))
                 + f'<div class="cover" data-name="Overlay (locked)" style="background:{grad}"></div>'
                 + column(cx, 64, 448, 952, [pill(PILL_DATE, size=.92), hl(s["hl"], s.get("hl1", 54)), body(s["body"], 23),
                                             s["card"](0.8), cta("teal", 0.78)], gap=24))
        if s.get("proof", False):
            inner += ab(64 if left else 600, 1005, 420, proof("#fff", 18))
        return board(size, nm, C["deep"], inner)
    dev_x = s.get("dev9_x", 520)
    inner = (photo(0, 0, 1080, 1000, s["img"], fx=s.get("fx9", s.get("fx", .5)), fy=s.get("fy9", s.get("fy", .35)))
             + f'<div class="cover" data-name="Overlay (locked)" style="background:linear-gradient(180deg,rgba(6,68,75,0) 32%,rgba(6,68,75,.82) 47%,{C["deep"]} 54%)"></div>'
             + ab(dev_x, s.get("dev9_y", 290), 480, s["card"](0.86))
             + column(80, 830, 920, 750, [pill(PILL_DATE), hl(s["hl9"] if "hl9" in s else s["hl"], s.get("hl9s", 80)), body(s["body"], 30),
                                          f'<div style="display:flex;align-items:center;justify-content:space-between">{cta("teal")}<div style="width:220px">{logo(220, mono=True)}</div></div>'], gap=26))
    return board(size, nm, C["deep"], inner)


def t_full(s, size):
    """Full-bleed lifestyle photo, hook on a white note card, offer bar along the bottom."""
    nm = name(s["persona"], "Stock", s["detail"], size)
    if size == "1x1":
        inner = (photo(0, 0, 1080, 1080, s["img"], fx=s.get("fx", .5), fy=s.get("fy", .4))
                 + '<div class="cover" data-name="Overlay (locked)" style="background:linear-gradient(180deg,rgba(30,43,45,.2) 0%,rgba(30,43,45,0) 28%,rgba(30,43,45,0) 70%,rgba(30,43,45,.5) 100%)"></div>'
                 + note_card(s.get("note_x", 56), 48, s.get("note_w", 620), s["hook"], scale=s.get("note_s", .88), rot=-1.2)
                 + f'<div class="abs" style="left:0;top:960px;width:1080px;height:120px;background:{C["deep"]};display:flex;align-items:center;justify-content:space-between;padding:0 48px">'
                 + f'<div><div class="eyebrow" style="font-size:20px;color:{C["gold"]}">Clear Aligner Open Day</div>'
                 + f'<div class="jo" style="font-size:30px;font-weight:700;color:#fff;margin-top:4px">{s["bar"]}</div></div>{cta("teal", .78)}</div>')
        return board(size, nm, C["ink"], inner)
    inner = (photo(0, 0, 1080, 1920, s["img"], fx=s.get("fx9", s.get("fx", .5)), fy=s.get("fy9", .5))
             + '<div class="cover" data-name="Overlay (locked)" style="background:linear-gradient(180deg,rgba(30,43,45,0) 55%,rgba(30,43,45,.55) 80%,rgba(30,43,45,.8) 100%)"></div>'
             + note_card(70, s.get("note9_y", 280), 860, s["hook"], scale=1.0, rot=-1.4)
             + f'<div class="abs" style="left:60px;top:1330px;width:960px;padding:36px 44px;background:{C["deep"]};border-radius:18px;box-shadow:0 26px 60px rgba(0,0,0,.4)">'
             + f'<div class="eyebrow" style="font-size:22px;color:{C["gold"]}">Clear Aligner Open Day &middot; Sat 7 November</div>'
             + f'<div class="jo" style="font-size:40px;font-weight:700;color:#fff;margin:10px 0 24px">{s["bar9"]}</div>{cta("teal", .9)}</div>')
    return board(size, nm, C["ink"], inner)


def t_band(s, size):
    """Headline on deep teal, photo band, card overlapping the band."""
    nm = name(s["persona"], "Stock", s["detail"], size)
    if size == "1x1":
        inner = (ab(72, 60, 936, hl(s["hl"], s.get("hl1", 58)))
                 + photo(72, 236, 936, 420, s["img"], fx=s.get("fx", .5), fy=s.get("fy", .35), radius=20)
                 + ab(110, s.get("card_y", 540), 860, s["card"](0.8))
                 + ab(72, 940, 500, cta("teal", .85))
                 + ab(600, 952, 420, pill(PILL_DATE, size=.82)))
        return board(size, nm, C["deep"], inner)
    inner = (ab(80, 290, 920, hl(s["hl"], s.get("hl9s", 86)))
             + photo(80, 640, 920, 520, s["img"], fx=s.get("fx9", s.get("fx", .5)), fy=s.get("fy9", s.get("fy", .35)), radius=24)
             + ab(100, s.get("card9_y", 1030), 880, s["card"](0.9))
             + ab(80, 1420, 600, cta("teal"))
             + ab(80, 1525, 700, pill(PILL_DATE, size=.9))
             + ab(780, 1520, 220, logo(220, mono=True)))
    return board(size, nm, C["deep"], inner)


def t_light(s, size):
    """Mist panel with a big headline, photo on the right, card across the seam."""
    nm = name(s["persona"], "Stock", s["detail"], size)
    if size == "1x1":
        inner = (photo(500, 0, 580, 1080, s["img"], fx=s.get("fx", .7), fy=s.get("fy", .3))
                 + f'<div class="cover" data-name="Overlay (locked)" style="background:linear-gradient(90deg,{C["mist"]} 0%,{C["mist"]} 44%,rgba(228,239,240,0) 60%)"></div>'
                 + ab(72, 72, 440, f'<div class="eyebrow" style="color:{C["teal"]}">Clear Aligner Open Day</div>')
                 + ab(72, 118, 520, hl(s["hl"], s.get("hl1", 84), C["deep"]))
                 + ab(330, s.get("card_y", 400), 560, s["card"](0.76))
                 + (ab(72, s.get("body_y", 730), 520, body(s["body"], 24, C["ink"])) if s.get("body") else "")
                 + ab(72, 915, 500, cta("teal", .85))
                 + ab(72, 1005, 190, logo(190)))
        return board(size, nm, C["mist"], inner)
    inner = (photo(0, 0, 1080, 980, s["img"], fx=s.get("fx9", s.get("fx", .6)), fy=s.get("fy9", .3))
             + f'<div class="cover" data-name="Overlay (locked)" style="background:linear-gradient(180deg,rgba(228,239,240,0) 35%,rgba(228,239,240,.9) 48%,{C["mist"]} 54%)"></div>'
             + ab(80, 280, 800, pill("Clear Aligner Open Day &middot; Sat 7 Nov", C["deep"]))
             + ab(140, s.get("card9_y", 560), 800, s["card"](0.95))
             + ab(80, s.get("hl9_y", 1210), 920, hl(s.get("hl9", s["hl"]), s.get("hl9s", 96), C["deep"]))
             + ab(80, 1450, 600, cta("teal"))
             + ab(770, 1460, 230, logo(230)))
    return board(size, nm, C["mist"], inner)


def t_date(s, size):
    """Photo panel, calendar card, headline and a Dr Syed line."""
    nm = name(s["persona"], "Stock", s["detail"], size)
    syed = lambda sc: (f'<div style="display:flex;align-items:center;gap:{int(18*sc)}px">'
                       f'<span style="width:{int(84*sc)}px;height:{int(84*sc)}px;flex:none;border-radius:50%;border:4px solid #fff;'
                       f'background:url(assets/photos/Syed-Photo-424x500-1.webp) 50% 18%/cover"></span>'
                       f'<div><div class="jo" style="font-size:{int(26*sc)}px;font-weight:700;color:#fff;line-height:1.2">{s["line1"]}</div>'
                       f'<div style="font-size:{int(20*sc)}px;color:#d6e6e7;margin-top:6px">{s["line2"]}</div></div></div>')
    if size == "1x1":
        inner = (photo(470, 0, 610, 1080, s["img"], fx=s.get("fx", .5), fy=s.get("fy", .25))
                 + f'<div class="cover" data-name="Overlay (locked)" style="background:linear-gradient(90deg,{C["deep"]} 0%,{C["deep"]} 44%,rgba(6,68,75,.5) 54%,rgba(6,68,75,0) 66%)"></div>'
                 + calendar(72, 70, 210, 0.85, -3)
                 + column(72, 400, 440, 616, [hl(s["hl"], s.get("hl1", 70)), syed(1), cta("teal", .85)], gap=34))
        return board(size, nm, C["deep"], inner)
    inner = (photo(0, 0, 1080, 1150, s["img"], fx=s.get("fx9", s.get("fx", .5)), fy=s.get("fy9", .2))
             + f'<div class="cover" data-name="Overlay (locked)" style="background:linear-gradient(180deg,rgba(6,68,75,0) 40%,rgba(6,68,75,.75) 54%,{C["deep"]} 61%)"></div>'
             + calendar(s.get("cal9_x", 720), 290, 280, 1.08, 3)
             + column(80, 980, 920, 600, [hl(s["hl"], s.get("hl9s", 96)), syed(1.25), cta("teal")], gap=36))
    return board(size, nm, C["deep"], inner)


T = dict(split=t_split, full=t_full, band=t_band, light=t_light, date=t_date)

OFFER_ITEMS = [("Treatment, fixed", "£3,495"), ("Consultation", "Free"), ("Digital scan", "Free"),
               ("Whitening", "Free"), ("Retainers", "Free"), ("Hygiene visit", "Free")]

# ---------------------------------------------------------------- personas
AMY = [
    dict(t="split", detail="Two quotes", img="amy-thinking.jpg", fx=.5, fy=.3, side="left", fx9=.5,
         hl='Two quotes.<br>Two prices.<br><span style="color:#bfa15c">On 7 Nov, one.</span>',
         hl9='Two quotes. Two prices.<br><span style="color:#bfa15c">On 7 Nov, there&rsquo;s one.</span>',
         body="32Co clear aligners for <b style='color:#fff'>£3,495</b>, however complex your case. Usually £3,995.",
         card=lambda sc: price_card("Open day price", "£3,495", "Fixed, however complex your case", sc, 1.5), dev9_x=40, dev9_y=560),
    dict(t="light", detail="Price grow", img="amy-sceptical.jpg", fx=.62, fy=.3, fx9=.55,
         hl='Will the price <span style="color:#14b1bf">grow?</span>', hl1=80, hl9='Will the price <span style="color:#14b1bf">grow?</span>',
         body="Here&rsquo;s everything in it, before you start.", card=lambda sc: list_card("Everything in your open day price", OFFER_ITEMS, sc, -1.2), card_y=330, card9_y=520, hl9_y=1250, hl9s=92),
    dict(t="split", detail="Can aligners fix mine", img="amy-reading.jpg", fx=.3, fy=.3, side="right", fx9=.3, dev9_x=540, dev9_y=560,
         hl='Crowded? Gaps?<br>A bit crooked?', hl9='Crowded? Gaps?<br>A bit crooked?',
         body="Your free scan and consultation will tell you if aligners can fix yours.",
         card=lambda sc: list_card("Clear aligners can treat", [("Crowded teeth", ""), ("Gaps", ""), ("Crooked or uneven", "")], sc, 1.3)),
    dict(t="band", detail="Scan first", img="amy-smiling.jpg", fx=.55, fy=.25, fx9=.55,
         hl='Scan first. <span style="color:#bfa15c">Decide after.</span>',
         card=lambda sc: list_card("Your open day consultation", [("Digital scan", "Free"), ("Consultation with Dr Syed", "Free"), ("Treatment if right for you", "£3,495")], sc, -1.2),
         card_y=560, card9_y=1010),
    dict(t="full", detail="Wear them", img="ls-aligner-hands.jpg", fx=.5, fy=.3, fx9=.5, note_w=700,
         hook="The honest bit: they only work when they&rsquo;re in.", bar="Sat 7 November &middot; Fixed £3,495",
         bar9="Out to eat, drink and brush. In the rest of the time.", note9_y=280),
]

DAN = [
    dict(t="full", detail="It happens", img="dan-scrutinise.jpg", fx=.42, fy=.3, fx9=.3, note_w=640,
         hook="Had braces as a teenager. Stopped wearing the retainer. It happens.", bar="Sat 7 November &middot; Fixed £3,495",
         bar9="Free consultation and scan with Dr Syed", note9_y=1000),
    dict(t="band", detail="Why they moved back", img="dan-bathroom.jpg", fx=.5, fy=.35, fx9=.5,
         hl='Why your teeth <span style="color:#bfa15c">moved back.</span>',
         card=lambda sc: text_card("Not a personal failing", "Teeth naturally drift over time. Retainers are what help hold them in place.",
                                   "Retainers included at our open day. Worth £315.", sc, -1.3)),
    dict(t="split", detail="Retainers included", img="dan-smile-profile.jpg", fx=.38, fy=.3, side="left", fx9=.35, dev9_x=540, dev9_y=560,
         hl='This time,<br>the retainers<br><span style="color:#bfa15c">are included.</span>', hl9='This time, the retainers<br><span style="color:#bfa15c">are included.</span>',
         body="Start 32Co clear aligners at our open day and your retainers come with it.",
         card=lambda sc: price_card("Retainers included", "£315", "Plus whitening and a hygiene visit", sc, 1.5)),
    dict(t="light", detail="Not train tracks", img="dan-brushing.jpg", fx=.72, fy=.3, fx9=.7,
         hl='Not train tracks <span style="color:#14b1bf">this time.</span>', hl1=76, hl9='Not train tracks <span style="color:#14b1bf">this time.</span>',
         card=lambda sc: list_card("Clear aligners", [("Clear", ""), ("Removable", ""), ("Out to eat, drink and brush", ""), ("Fixed price", "£3,495")], sc, -1.2),
         card_y=560, card9_y=560, hl9_y=1220, hl9s=92),
    dict(t="date", detail="One Saturday", img="dan-bigsmile.jpg", fx=.45, fy=.25, fx9=.45, cal9_x=700,
         hl='Sort it in<br><span style="color:#bfa15c">one Saturday.</span>', line1="Free consultation and scan with Dr Syed Hussain",
         line2="Fixed £3,495 &middot; Limited appointments"),
]

MICHELLE = [
    dict(t="full", detail="Twenty years", img="michelle-wistful.jpg", fx=.72, fy=.3, fx9=.74, note_w=640,
         hook="Wanted straighter teeth for twenty years?", bar="Sat 7 November &middot; Fixed £3,495",
         bar9="You&rsquo;ve thought about it long enough.", note9_y=1000),
    dict(t="split", detail="Never too late", img="michelle-smile.jpg", fx=.35, fy=.3, side="right", fx9=.35, dev9_x=540, dev9_y=560,
         hl='It&rsquo;s not<br><span style="color:#bfa15c">too late.</span>', hl1=64, hl9='It&rsquo;s not <span style="color:#bfa15c">too late.</span>', hl9s=92,
         body="Clear aligners are discreet and removable, and fit around the life you already have.",
         card=lambda sc: quote_card("It&rsquo;s never too late to get the smile you&rsquo;ve always wanted.", "Dr Syed Hussain", sc * .85, -1.3)),
    dict(t="split", detail="Real number", img="michelle-serious.jpg", fx=.42, fy=.3, side="left", fx9=.42, dev9_x=520, dev9_y=560,
         hl='Expecting a<br>scary number?<br><span style="color:#bfa15c">Here&rsquo;s the real one.</span>', hl1=50,
         hl9='Expecting a scary number?<br><span style="color:#bfa15c">Here&rsquo;s the real one.</span>', hl9s=72,
         body="32Co clear aligners, fixed however complex your case. Usually £3,995.",
         card=lambda sc: price_card("Open day price", "£3,495", "Whitening, retainers and hygiene included when you start", sc, 1.5)),
    dict(t="light", detail="Straighter then brighter", img="michelle-smile-chin.jpg", fx=.42, fy=.3, fx9=.42,
         hl='Straighter.<br><span style="color:#14b1bf">Then brighter.</span>', hl1=62, hl9='Straighter. <span style="color:#14b1bf">Then brighter.</span>',
         card=lambda sc: list_card("Included when you start", [("Professional whitening", "£399"), ("Retainers", "£315"), ("Hygiene appointment", "£110")], sc, -1.2),
         card_y=440, card9_y=600, hl9_y=1150, hl9s=88),
    dict(t="band", detail="No commitment", img="michelle-tea.jpg", fx=.5, fy=.2, fx9=.5, fy9=.25,
         hl='A consultation, <span style="color:#bfa15c">not a commitment.</span>', hl1=54,
         card=lambda sc: steps_card("What happens on the day", ["Meet Dr Syed Hussain", "Free digital scan", "Options and costs explained", "You go home and decide"], sc, -1.2),
         card_y=520, card9_y=980),
]

PERSONAS = dict(amy=("Amy", AMY), dan=("Dan", DAN), michelle=("Michelle", MICHELLE))


def build(key):
    label, specs = PERSONAS[key]
    out = {}
    for size in ("1x1", "9x16"):
        boards = []
        for s in specs:
            s = dict(s, persona=label)
            boards.append(T[s["t"]](s, size))
        out[size] = page(f"Oxford House | {label} | {size}", boards)
    return out


if __name__ == "__main__":
    for key in PERSONAS:
        pages = build(key)
        for size, html in pages.items():
            (ROOT / f"{key}-{size}.html").write_text(html)
    print("built", ", ".join(PERSONAS))
