"""Sound familiar (kit block: vdk/pain-points). The situations that bring people in, then one bridging line."""
from ..ui import sec, head, cards


def pain_points(ctx, c, m):
    items = [f'''<div class="card" data-name="Situation" style="background:var(--surface);padding:{28 if m else 36}px">
      <div class="h3">{ctx.t(t)}</div><p class="body fg2" style="margin-top:10px">{ctx.t(d)}</p></div>''' for t, d in c["items"]]
    close = (f'<p style="margin:{36 if m else 56}px auto 0;max-width:{c.get("close_width", 860)}px;{"" if m else "text-align:center;"}font-size:{20 if m else 24}px;font-weight:300;line-height:1.45">'
             f'{ctx.t(c["close"])}</p>') if c.get("close") else ""
    inner = (head(ctx, c.get("eyebrow", "Sound familiar?"), c["title"], c.get("sub"), m, center=not m, width=c.get("width", 760))
             + f'<div style="margin-top:{32 if m else 56}px">{cards(items, m, 3, 20)}</div>' + close)
    return sec(ctx, "Sound familiar", "pain_points", inner, m, c.get("tone"))
