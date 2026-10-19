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
    if c.get("style", ctx.brand.data.get("steps_style")) == "timeline":
        return _timeline(ctx, c, m)
    items = [f'''<div data-name="Step" style="border-top:1.5px solid var(--fg);padding-top:24px">
      <div class="price acc" style="font-size:{40 if m else 56}px">{i + 1:02d}</div>
      <div class="h3" style="margin-top:20px">{ctx.t(t)}</div><p class="body fg2" style="margin-top:8px">{ctx.t(d)}</p></div>''' for i, (t, d) in enumerate(c["items"])]
    return sec(ctx, "How it works", "steps", head(ctx, c.get("eyebrow", "How it works"), c["title"], None, m)
               + f'<div style="margin-top:{32 if m else 56}px">{grid(items, 1 if m else len(items), 28 if m else 40)}</div>' + cta_row(ctx, m), m, c.get("tone"))


def _timeline(ctx, c, m):
    """Hairline timeline (Concept Dental): a 1px rule through hollow dots, ExtraLight numerals, one filled dot for
    where the visitor is (c["active"], 0-based). Mobile runs it vertically."""
    act = c.get("active")
    n = len(c["items"])

    def dot(i):
        return (f'<div style="flex:none;width:14px;height:14px;border-radius:50%;background:{"var(--fg)" if i == act else "var(--s-bg)"};'
                f'border:1.5px solid var(--fg);position:relative;z-index:1"></div>')
    if m:
        rows = []
        for i, (t, d) in enumerate(c["items"]):
            line = '' if i == n - 1 else '<div style="position:absolute;left:6.5px;top:14px;bottom:0;width:1px;background:var(--fine)"></div>'
            rows.append(f'<div data-name="Step" style="display:flex;gap:20px;position:relative;padding-bottom:{0 if i == n - 1 else 28}px">{line}{dot(i)}'
                        f'<div style="margin-top:-6px"><div class="label acc" style="font-size:11px">{i + 1:02d}</div><div class="h3" style="margin-top:4px">{ctx.t(t)}</div>'
                        f'<p class="body fg2" style="margin-top:6px;font-size:15px">{ctx.t(d)}</p></div></div>')
        body = f'<div style="margin-top:32px">{"".join(rows)}</div>'
    else:
        cols = "".join(f'<div data-name="Step" style="flex:1;position:relative">{dot(i)}'
                       f'<div class="price acc" style="font-size:56px;margin-top:24px">{i + 1:02d}</div>'
                       f'<div class="h3" style="margin-top:14px">{ctx.t(t)}</div><p class="body fg2" style="margin-top:8px;font-size:15px;padding-right:24px">{ctx.t(d)}</p></div>'
                       for i, (t, d) in enumerate(c["items"]))
        body = (f'<div style="position:relative;display:flex;margin-top:56px">'
                f'<div style="position:absolute;left:7px;right:calc(100% / {n} - 7px);top:7px;height:1px;background:var(--fine)"></div>{cols}</div>')
    return sec(ctx, "How it works", "steps", head(ctx, c.get("eyebrow", "How it works"), c["title"], c.get("sub"), m) + body + cta_row(ctx, m), m, c.get("tone"))
