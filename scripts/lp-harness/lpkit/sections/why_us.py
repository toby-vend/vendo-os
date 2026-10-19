"""Why us (kit block: vdk/why-us). Six reasons with icons. No unverifiable superlatives ("the most trusted name")
and no "specialist" unless the clinician is on the GDC specialist list."""
from ..ui import sec, head, cards, grid, cta_row


def why_us(ctx, c, m):
    items = [f'''<div data-name="Reason" style="padding:{24 if m else 32}px 0;border-top:1px solid var(--rule)">
      {ctx.icon(i, 40)}<div class="h3" style="margin-top:16px">{ctx.t(t)}</div><p class="body fg2" style="margin-top:8px;font-size:15px">{ctx.t(d)}</p></div>''' for i, t, d in c["items"]]
    body = cards(items, m, 3, 48) if m else grid(items, 3, 48)
    return sec(ctx, c.get("name", "Why us"), "why_us", head(ctx, c.get("eyebrow"), c["title"], None, m)
               + f'<div style="margin-top:{24 if m else 48}px">{body}</div>' + cta_row(ctx, m), m, c.get("tone"))
