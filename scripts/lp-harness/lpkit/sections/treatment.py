"""The treatment (kit block: vdk/treatment), which in the kit holds both parts:
  explainer  photo, what the treatment/visit is, an explainer card and key facts
  steps      how it works, numbered
They are separate here so each can sit in its own tone, as on the Siha pages."""
from ..ui import sec, head, grid, photo, tick, cta_row


def explainer(ctx, c, m):
    left = photo(c["photo"], 360 if m else c.get("photo_h", 680))
    card = c.get("card")
    right = f'''<div style="display:flex;flex-direction:column;justify-content:center">
      {head(ctx, c.get('eyebrow'), c['title'], None, m, width=560)}
      <p class="body fg2" style="margin-top:18px">{ctx.t(c['text'])}</p>
      {f"""<div class="card" style="background:var(--alt);padding:28px;margin-top:28px">
        <div class="h3">{ctx.t(card['title'])}</div>
        <p class="body fg2" style="margin-top:10px;font-size:15px">{ctx.t(card['text'])}</p></div>""" if card else ''}
      <div class="label acc" style="margin-top:28px">{ctx.t(c.get('facts_label', 'Key facts'))}</div>
      <div style="display:grid;grid-template-columns:{'1fr' if m else '1fr 1fr'};gap:14px 20px;margin-top:14px">{"".join(tick(ctx, f, 15) for f in c['facts'])}</div>
    </div>'''
    return sec(ctx, c.get("name", "The treatment"), "explainer", grid([left, right], 1 if m else 2, 32 if m else 72), m, c.get("tone"))


def steps(ctx, c, m):
    items = [f'''<div data-name="Step" style="border-top:1.5px solid var(--fg);padding-top:24px">
      <div class="price acc" style="font-size:{40 if m else 56}px">{i + 1:02d}</div>
      <div class="h3" style="margin-top:20px">{ctx.t(t)}</div><p class="body fg2" style="margin-top:8px">{ctx.t(d)}</p></div>''' for i, (t, d) in enumerate(c["items"])]
    return sec(ctx, "How it works", "steps", head(ctx, c.get("eyebrow", "How it works"), c["title"], None, m)
               + f'<div style="margin-top:{32 if m else 56}px">{grid(items, 1 if m else len(items), 28 if m else 40)}</div>' + cta_row(ctx, m), m, c.get("tone"))
