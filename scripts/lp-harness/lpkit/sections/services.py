"""Services (kit block: vdk/services). Two card styles: photo (image on top) or icon (line icon, no photo)."""
from ..ui import sec, head, cards, photo


def services(ctx, c, m):
    if c.get("style", "icon") == "photo":
        items = [f'''<div class="card" data-name="Service" style="background:var(--surface);overflow:hidden">
      {photo(it['photo'], 200, 0)}<div style="padding:28px"><div class="h3">{ctx.t(it['title'])}</div><p class="body fg2" style="margin-top:8px;font-size:15px">{ctx.t(it['text'])}</p></div></div>''' for it in c["items"]]
    else:
        items = [f'''<div class="card" data-name="Treatment" style="background:var(--surface);padding:{28 if m else 36}px">
      {ctx.icon(it['icon'], 40)}<div class="h3" style="margin-top:18px">{ctx.t(it['title'])}</div><p class="body fg2" style="margin-top:8px;font-size:15px">{ctx.t(it['text'])}</p></div>''' for it in c["items"]]
    return sec(ctx, c.get("name", "Services"), "services", head(ctx, c.get("eyebrow"), c["title"], c.get("sub"), m)
               + f'<div style="margin-top:{32 if m else 56}px">{cards(items, m, 3, 24)}</div>', m, c.get("tone"))
