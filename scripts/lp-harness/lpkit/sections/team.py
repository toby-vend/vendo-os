"""Meet the team carousel (kit: vdk/team backed by the Team post type). First names only; photos mid-chest up
(tools/team_crop.py). Desktop shows four cards with the fifth peeking in; mobile one card with the next peeking."""
from ..ui import carousel_arrows, progress


def team(ctx, c, m):
    card_w, img_h, gap = (250, 320, 16) if m else (270, 360, 24)
    items = "".join(f'''<div data-name="Team member" style="flex:none;width:{card_w}px">
      <div data-name="Photo" style="height:{img_h}px;border-radius:var(--thumb-r);background:url({img}) 50% 0%/cover no-repeat"></div>
      <div class="h3" style="margin-top:16px">{ctx.t(name)}</div>
      <div class="label fg3" style="margin-top:6px;font-size:{13 if m else 11}px">{ctx.t(role)}</div></div>''' for img, name, role in c["members"])
    head = (f'<div style="display:flex;{"flex-direction:column;gap:24px" if m else "justify-content:space-between;align-items:flex-end"}">'
            f'<div style="max-width:780px"><div class="label acc">{ctx.t(c.get("eyebrow", "Meet the team"))}</div>'
            f'<h2 class="h1" style="margin-top:14px;font-size:{32 if m else 44}px">{ctx.t(c.get("title", "The people who’ll look after you"))}</h2>'
            f'<p class="body fg2" style="margin-top:16px;font-size:{16 if m else 18}px">{ctx.t(c.get("sub", ""))}</p></div>'
            f'{"" if m else carousel_arrows()}</div>')
    track = (f'<div data-name="Carousel" style="margin-top:{32 if m else 48}px;overflow:hidden;margin-right:-{20 if m else 80}px">'
             f'<div data-name="Track" style="display:flex;gap:{gap}px">{items}</div></div>')
    tn = ctx.brand.tone("team", c.get("tone"))
    return (f'<section data-name="Meet the team" class="tone-{tn}" style="position:relative;padding:{"64px 20px" if m else "112px 80px"};overflow:hidden">'
            f'{head}{track}{progress(m, "34%", "9%")}</section>')
