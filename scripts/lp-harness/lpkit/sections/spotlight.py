"""Spotlight (not a kit block): one clinician or one differentiator, photo with a name badge plus three pillars.
Siha used it for orthodontist-led aligners."""
from ..ui import sec, head, grid, photo, cta_row, feature_photo


def spotlight(ctx, c, m):
    pillars = [f'''<div data-name="Benefit" style="padding-top:{20 if m else 24}px;border-top:1px solid var(--rule)">
      {ctx.icon(k, 40)}<div class="h3" style="margin-top:16px">{ctx.t(t)}</div>
      <p class="body fg2" style="margin-top:8px;font-size:15px">{ctx.t(d)}</p></div>''' for k, t, d in c["items"]]
    b = c.get("badge")
    badge = (f'<div class="card tone-light" style="position:absolute;left:{16 if m else 24}px;bottom:{16 if m else 24}px;background:var(--s-bg);padding:{"14px 18px" if m else "18px 24px"}">'
             f'<div class="h3" style="font-size:{17 if m else 20}px">{ctx.t(b["name"])}</div>'
             f'<div class="label fg3" style="margin-top:4px;font-size:11px">{ctx.t(b["role"])}</div></div>') if b else ""
    pic = f'<div data-name="{b["name"] if b else "Photo"}" style="position:relative">{feature_photo(ctx, c["photo"], 400 if m else 680, m)}{badge}</div>'
    text = (head(ctx, c.get("eyebrow"), c["title"], c.get("sub"), m, width=600)
            + f'<div style="margin-top:{28 if m else 40}px;display:grid;gap:{20 if m else 24}px">{"".join(pillars)}</div>' + cta_row(ctx, m, top=40))
    body = grid([pic, text], 1, 32) if m else f'<div style="display:grid;grid-template-columns:520px 1fr;gap:96px;align-items:center">{pic}<div>{text}</div></div>'
    return sec(ctx, c.get("name", "Spotlight"), "spotlight", body, m, c.get("tone"))
