"""Pricing (kit block: vdk/pricing-cards).

Two layouts:
  panel  one headline price on an inverted card, with a photo and a "what you get" list (single-offer pages:
         new patient assessment, emergency appointment)
  cards  three treatment cards, the middle one featured, plus a finance strip (smile makeover)
Prices must come from facts.json; finance wording must not quote monthly figures (FCA).
"""
from ..ui import sec, head, grid, cards, photo, cta_row, bullets, TICK


def pricing(ctx, c, m):
    if c.get("layout", "panel") == "cards":
        return _cards(ctx, c, m)
    notes = "".join(f'<p class="body fg2" style="margin-top:14px;font-size:14px">{ctx.t(n)}</p>' for n in c.get("notes", []))
    price = f'''<div class="card tone-dark" data-name="Price card" style="background:var(--s-bg);padding:{32 if m else 56}px;display:flex;flex-direction:column">
      <div class="label acc">{ctx.t(c.get('eyebrow', 'Pricing'))}</div>
      <h2 class="h1" style="margin-top:14px;font-size:{30 if m else 40}px">{ctx.t(c['title'])}</h2>
      <p class="body fg2" style="margin-top:16px">{ctx.t(c.get('sub', ''))}</p>
      <div style="margin-top:{32 if m else 44}px;padding-top:28px;border-top:1px solid var(--rule)">
        <div class="label fg2">{ctx.t(c['price_label'])}</div>
        <div style="display:flex;align-items:baseline;gap:16px;margin-top:8px"><span class="price" style="font-size:{72 if m else 96}px">{ctx.t(c['price'])}</span><span class="body fg2">{ctx.t(c.get('price_note', ''))}</span></div>
        {notes}
      </div>
      <span class="btn primary" style="margin-top:32px;align-self:flex-start">{ctx.cta_label}</span>
    </div>'''
    rows = "".join(f'''<div style="display:flex;gap:18px;padding:22px 0;border-bottom:1px solid var(--rule)">
        <i style="flex:none;width:36px;height:36px;border-radius:50%;background:var(--alt);display:flex;align-items:center;justify-content:center">{TICK.format(s=12)}</i>
        <div><div class="h3">{ctx.t(t)}</div><div class="body fg2" style="margin-top:4px">{ctx.t(d)}</div></div></div>''' for t, d in c["get"])
    right = f'''<div style="display:flex;flex-direction:column">
      {photo(c['photo'], 220 if m else 260)}
      <div class="label acc" style="margin-top:32px">{ctx.t(c.get('get_label', 'What you get'))}</div>
      <div style="margin-top:6px">{rows}</div></div>'''
    return sec(ctx, "Pricing", "pricing", grid([price, right], 1 if m else 2, 32 if m else 48), m, c.get("tone"))


def _cards(ctx, c, m):
    items = []
    for it in c["items"]:
        cls = "card tone-dark" if it.get("featured") else "card"
        items.append(f'''<div class="{cls}" data-name="Price card" style="background:{'var(--s-bg)' if it.get('featured') else 'var(--surface)'};padding:{28 if m else 36}px;display:flex;flex-direction:column">
          <div class="label acc">{ctx.t(it.get('tag', ''))}</div>
          <div class="h3" style="margin-top:12px;font-size:22px">{ctx.t(it['name'])}</div>
          <p class="body fg2" style="margin-top:8px;font-size:15px">{ctx.t(it.get('desc', ''))}</p>
          <div style="margin-top:24px;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><span class="price" style="font-size:56px">{ctx.t(it['price'])}</span><span class="body fg2" style="font-size:14px">{ctx.t(it.get('unit', ''))}</span></div>
          <div style="height:1px;background:var(--rule);margin:24px 0"></div>
          <div style="display:grid;gap:12px">{bullets(ctx, it.get('feats', []), 14)}</div></div>''')
    fin = c.get("finance")
    finance = ""
    if fin:
        finance = f'''<div class="card" data-name="Finance" style="background:var(--alt);padding:{24 if m else 32}px {24 if m else 40}px;margin-top:24px;display:flex;{'flex-direction:column;gap:12px' if m else 'align-items:center;justify-content:space-between;gap:40px'}">
      <div><div class="h3">{ctx.t(fin['title'])}</div>
      <p class="body fg2" style="margin-top:6px;font-size:15px">{ctx.t(fin['text'])}</p></div>
      <div class="body fg2" style="flex:none;font-size:14px">{ctx.t(fin.get('aside', ''))}</div></div>'''
    inner = (head(ctx, c.get("eyebrow", "Pricing"), c["title"], c.get("sub"), m)
             + f'<div style="margin-top:{32 if m else 56}px">{cards(items, m, 3, 24)}</div>' + finance + cta_row(ctx, m))
    return sec(ctx, "Pricing", "pricing", inner, m, c.get("tone"))
