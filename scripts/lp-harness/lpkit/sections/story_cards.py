"""Patient stories (kit block: vdk/story-cards). Real Google reviews only, never another clinic's template quotes."""
from ..ui import sec, head, cards, stars, cta_row


def story_cards(ctx, c, m):
    items = [f'''<div class="card" data-name="Story" style="background:var(--surface);padding:{28 if m else 40}px;display:flex;flex-direction:column;gap:20px">
      <div class="label acc">{ctx.t(t)}</div>
      <p class="h3" style="font-weight:400;font-size:{18 if m else 20}px;line-height:1.5">“{ctx.t(q)}”</p>
      <div style="margin-top:auto">
        <div style="display:flex;align-items:center;justify-content:space-between"><span class="body" style="font-weight:600">{n}</span>{stars(5, 14)}</div>
        <div class="body fg3" style="font-size:13px">Google review</div></div>
    </div>''' for t, q, n in c["items"]]
    inner = (head(ctx, c.get("eyebrow", "Patient stories"), c.get("title", "Real patients. Real results."), c.get("sub"), m)
             + f'<div style="margin-top:{32 if m else 56}px">{cards(items, m, 3, 24)}</div>' + (cta_row(ctx, m) if c.get("cta", True) else ""))
    return sec(ctx, "Patient stories", "story_cards", inner, m, c.get("tone"))
