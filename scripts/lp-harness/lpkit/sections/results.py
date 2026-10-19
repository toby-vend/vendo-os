"""Before and after (kit block: vdk/results), as a swipe carousel. Consented cases only, from the client's own
Drive or published smile gallery; the disclaimer line is mandatory."""
from ..ui import sec, head, carousel_arrows, progress


def results(ctx, c, m):
    w = 260 if m else 300
    items = "".join(f'''<div data-name="Case" style="flex:none;width:{w}px">
      <div data-name="Before and after" style="width:{w}px;height:{int(w * c.get('ratio', 1.25))}px;border-radius:var(--thumb-r);background:url({img}) 50% 50%/cover no-repeat"></div>
      <div class="label fg3" style="margin-top:14px;font-size:11px">{ctx.t(t)}</div></div>''' for img, t in c["items"])
    top = (f'<div style="display:flex;{"flex-direction:column;gap:24px" if m else "justify-content:space-between;align-items:flex-end"}">'
           f'{head(ctx, c.get("eyebrow", "Results"), c.get("title", "Before &amp; after"), c.get("sub"), m, width=760)}{carousel_arrows()}</div>')
    track = (f'<div data-name="Carousel" style="margin-top:{32 if m else 48}px;overflow:hidden;margin-right:-{20 if m else 80}px">'
             f'<div data-name="Track" style="display:flex;gap:{16 if m else 24}px">{items}</div></div>')
    note = f'<p class="body fg3" style="margin-top:20px;font-size:13px">{ctx.t(c.get("note", "Individual results vary. All images are of actual {{name}} patients, with consent."))}</p>'
    return sec(ctx, "Before and after (carousel)", "results", top + track + progress(m, "29%", "7%") + note, m, c.get("tone"), extra="overflow:hidden")
