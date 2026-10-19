"""Shared building blocks every section is written in: section wrapper, heading group, grids, swipe rows,
ticks, stars, photos, the repeated CTA and the booking form.

Nothing here knows a colour. Text and surfaces read the tone variables (--fg, --fg2, --fg3, --surface, --alt,
--rule) that brand.py sets per tone, so a section reads correctly on light, panel, card or dark.
"""
import re

from .icons import icon as _icon

TICK = ('<svg width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" '
        'stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.2 4.2L19 7"/></svg>')
STAR = ('<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="currentColor"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 '
        '1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>')
ARROW = ('<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
         'stroke-linecap="round" stroke-linejoin="round"><path d="{d}"/></svg>')
ARROW_BTN = ('<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" '
             'stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>')
PLAY = '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>'


class Ctx:
    """Everything a section needs besides its own content: brand, client facts and the page-wide form copy."""

    def __init__(self, brand, client, page):
        self.brand, self.client, self.page = brand, client, page
        self.cta = page.get("cta") or client.get("cta", "Book Now")  # SOP wording only: Book Now, Book Appointment, Book Consultation
        self.form = page.get("form", {})

    @property
    def cta_label(self):
        """The CTA text, plus the brand's arrow if its buttons carry one ("says what happens next")."""
        if self.brand.data.get("button", {}).get("arrow"):
            return self.cta + ARROW_BTN
        return self.cta

    def t(self, s):
        """Fill {{tokens}} from client.json (name, address, rating, review_count ...) in any content string."""
        if not isinstance(s, str):
            return s

        def rep(mt):
            key = mt.group(1).strip()
            if key not in self.client:
                raise SystemExit(f"Unknown token {{{{{key}}}}}; add it to client.json")
            return str(self.client[key])
        return re.sub(r"\{\{([^}]+)\}\}", rep, s)

    def icon(self, name, size=40, color="var(--accent)"):
        return _icon(name, color, size, self.brand.stroke)


def sec(ctx, name, block, inner, m, tone=None, pad=(112, 80), pad_m=(64, 20), extra=""):
    py, px = pad_m if m else pad
    tn = ctx.brand.tone(block, tone)
    wm = watermark(ctx, block, m, tn)
    if wm:  # the mark sits behind the content, clipped to the section
        inner = f'{wm}<div style="position:relative">{inner}</div>'
    return (f'<section data-name="{name}" class="tone-{tn}" style="position:relative;padding:{py}px {px}px;{extra}">'
            f'{inner}</section>')


def head(ctx, label, title, sub=None, m=False, center=False, width=760):
    al = "text-align:center;margin-left:auto;margin-right:auto;" if center else ""
    out = f'<div style="{al}max-width:{width}px">'
    if label:
        out += f'<div class="label acc">{ctx.t(label)}</div>'
    out += f'<h2 class="h1" style="margin-top:14px;font-size:{ctx.brand.type["h1"].get("size_m", 32) if m else ctx.brand.type["h1"]["size"]}px">{ctx.t(title)}</h2>'
    if sub:
        out += f'<p class="body fg2" style="margin-top:16px;font-size:{16 if m else 18}px">{ctx.t(sub)}</p>'
    return out + '</div>'


def grid(items, cols, gap=24):
    return f'<div style="display:grid;grid-template-columns:repeat({cols},1fr);gap:{gap}px">{"".join(items)}</div>'


def swipe(items, w=290, gap=14):
    """Mobile: a horizontal swipe row with dots instead of a tall stack (cards keep their own styling)."""
    cells = "".join(f'<div style="flex:none;width:{w}px;display:flex">{i}</div>' for i in items)
    dots = "".join(f'<span style="width:{18 if k == 0 else 6}px;height:6px;border-radius:3px;background:var(--fg);opacity:{1 if k == 0 else .2}"></span>'
                   for k in range(len(items)))
    return (f'<div data-name="Swipe row" style="overflow:hidden;margin-right:-20px"><div style="display:flex;gap:{gap}px;align-items:stretch">{cells}</div></div>'
            f'<div data-name="Dots" style="display:flex;gap:6px;justify-content:center;margin-top:20px">{dots}</div>')


def cards(items, m, cols=3, gap=24):
    return swipe(items) if m else grid(items, cols, gap)


def tick(ctx, text, size=16):
    return f'<div class="tick"><i>{TICK.format(s=12)}</i><span class="body" style="font-size:{size}px">{ctx.t(text)}</span></div>'


def stars(n=5, s=16):
    return f'<span class="acc" style="display:inline-flex;gap:2px">{"".join(STAR.format(s=s) for _ in range(n))}</span>'


def photo(ph, h, radius="var(--photo-r)", arch=False):
    """ph = {"src": "assets/photos/x.jpg", "pos": "50% 40%"} or a bare path. arch=True gives the brand's arch top
    (brand.json "arch_photos": true applies it to the feature photos: explainer, meet_dentist, spotlight)."""
    if isinstance(ph, str):
        ph = {"src": ph}
    if arch:
        radius = "999px 999px 0 0"
    if ph.get("crop"):  # chest-up crop from a face box: crop = {w, h, top, bottom, cx} in source pixels
        c = ph["crop"]
        sc = h / (c["bottom"] - c["top"])
        bg = (f"url({ph['src']}) calc(50% - {(c['cx'] - c['w'] / 2) * sc:.0f}px) -{c['top'] * sc:.0f}px/"
              f"{c['w'] * sc:.0f}px {c['h'] * sc:.0f}px no-repeat var(--alt)")
    else:
        bg = f"url({ph['src']}) {ph.get('pos', '50% 50%')}/cover no-repeat"
    return f'<div data-name="Photo" style="height:{h}px;border-radius:{radius};background:{bg}"></div>'


def cta_row(ctx, m, top=48):
    """The repeated CTA: one unified button that scrolls to the form. The form is the only CTA (no call, no WhatsApp)."""
    return (f'<div data-name="CTA" style="display:flex;{"flex-direction:column;align-items:flex-start;" if m else "align-items:center;"}gap:{16 if m else 24}px;margin-top:{top}px">'
            f'<span class="btn primary">{ctx.cta_label}</span></div>')


def form_card(ctx, width, pad=40, offer=False, title=None):
    f = ctx.form
    def field(x):  # a field is a label, or {"label", "full": true} to span both columns
        x = {"label": x} if isinstance(x, str) else x
        span = ' style="grid-column:1 / -1"' if x.get("full") else ""
        return f'<label class="field"{span}><span>{x["label"]} *</span><div></div></label>'
    fields = "".join(field(x) for x in f.get("fields", ["First name", "Last name", "Email", "Mobile"]))
    note = f'<div class="body fg3" style="margin-top:14px;font-size:14px;text-align:center">{ctx.t(f["note"])}</div>' if f.get("note") else ""
    return f"""
<div class="card tone-card" data-name="Booking form" style="width:100%;max-width:{width}px;margin:0 auto;background:var(--s-bg);padding:{pad}px;box-shadow:0 30px 60px rgba(0,0,0,.12),0 4px 12px rgba(0,0,0,.05)">
  <div class="label acc">{ctx.t(f.get('label', ''))}</div>
  <div class="h2" style="margin-top:10px">{ctx.t(title or f.get('title', 'Book your appointment'))}</div>
  <div class="body fg3" style="margin-top:6px">{ctx.t(f.get('sub', ''))}</div>
  <div style="display:grid;grid-template-columns:{"1fr" if width < 400 else "1fr 1fr"};gap:16px;margin-top:24px">{fields}</div>
  <span class="btn {'offer' if offer else 'primary'}" style="width:100%;margin-top:26px;height:56px">{ctx.cta_label}</span>
  {note}
  <div class="body fg3" style="margin-top:6px;font-size:12px;text-align:center">By submitting, you agree to our <u>privacy policy</u>.</div>
</div>"""


def carousel_arrows():
    return (f'<div data-name="Carousel arrows" style="display:flex;gap:12px">'
            f'<span style="width:52px;height:52px;border-radius:50%;border:1.5px solid var(--rule);color:var(--fg3);display:flex;align-items:center;justify-content:center">{ARROW.format(d="M15 18l-6-6 6-6")}</span>'
            f'<span style="width:52px;height:52px;border-radius:50%;background:var(--btn-bg);color:var(--btn-fg);display:flex;align-items:center;justify-content:center">{ARROW.format(d="M9 18l6-6-6-6")}</span></div>')


def progress(m, share_d, share_m):
    return (f'<div data-name="Progress" style="margin-top:{28 if m else 40}px;height:2px;background:var(--rule);border-radius:2px">'
            f'<div style="width:{share_m if m else share_d};height:2px;background:var(--fg);border-radius:2px"></div></div>')


def seal(ctx, sd, w):
    """Offer seal (round, double hairline ring), e.g. Concept's founding-patient £25 exam. Only while the offer is
    genuinely live; sd = {"top", "price", "bottom", "was"?}."""
    was = f'<div class="body" style="font-size:{w * .055:.0f}px;margin-top:{w * .02:.0f}px;opacity:.6;text-decoration:line-through">{ctx.t(sd["was"])}</div>' if sd.get("was") else ""
    return (f'<div data-name="Offer seal" class="tone-dark" style="position:relative;width:{w}px;height:{w}px;border-radius:50%;background:var(--s-bg);'
            f'border:1px solid var(--fine);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">'
            f'<div style="position:absolute;inset:{w * .05:.0f}px;border-radius:50%;border:1px solid var(--fine)"></div>'
            f'<div class="label" style="font-size:{w * .05:.0f}px;letter-spacing:.16em">{ctx.t(sd["top"])}</div>'
            f'<div class="price" style="font-size:{w * .3:.0f}px;margin-top:{w * .03:.0f}px">{ctx.t(sd["price"])}</div>'
            f'<div class="label" style="font-size:{w * .052:.0f}px;letter-spacing:.14em;margin-top:{w * .04:.0f}px;opacity:.85;max-width:{w * .7:.0f}px">{ctx.t(sd["bottom"])}</div>{was}</div>')


def bullets(ctx, items, size=15):
    return "".join(f'<div class="body fg2" style="font-size:{size}px;line-height:1.5;display:flex;gap:10px"><span class="acc">•</span><span>{ctx.t(i)}</span></div>' for i in items)


def watermark(ctx, block, m, tone="light"):
    """The brand's watermark mark (e.g. Concept's CD monogram in Soft Dune), cropped off an edge of a section.
    brand.json: "watermark": {"file", "light", "dark", "blocks": {"<block>": {"x", "y", "w", "x_m", "y_m", "w_m"}}}"""
    wm = ctx.brand.data.get("watermark")
    if not wm or block not in wm.get("blocks", {}):
        return ""
    b = wm["blocks"][block]
    x, y, w = (b.get("x_m", b["x"]), b.get("y_m", b["y"]), b.get("w_m", b["w"])) if m else (b["x"], b["y"], b["w"])
    color = wm.get("dark" if tone == "dark" else "light")
    svg = ctx.brand.svg(wm["file"])
    return (f'<div data-name="Watermark" style="position:absolute;inset:0;overflow:hidden;pointer-events:none">'
            f'<div style="position:absolute;{"right" if b.get("anchor") == "right" else "left"}:{x}px;top:{y}px;width:{w}px;color:{color}">{svg}</div></div>')
