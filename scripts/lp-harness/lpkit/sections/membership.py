"""Membership plans (not a kit block; Siha). Groups of plan cards (adults, children), first plan featured."""
from ..ui import sec, head, grid, swipe, bullets


def membership(ctx, c, m):
    def plan(p):
        hi = p.get("featured")
        return (f'''<div class="card{' tone-dark' if hi else ''}" data-name="Plan" style="background:{'var(--s-bg)' if hi else 'var(--surface)'};padding:32px;display:flex;flex-direction:column;width:100%">
          <div class="h3">{ctx.t(p['name'])}</div><div class="body fg2" style="font-size:14px;margin-top:2px">{ctx.t(p.get('who', ''))}</div>
          <div style="margin-top:24px"><span class="price" style="font-size:48px">{ctx.t(p['price'])}</span><span class="body fg2"> /month</span></div>
          <div style="height:1px;background:var(--rule);margin:24px 0"></div>
          <div style="display:grid;gap:12px">{bullets(ctx, p['feats'], 14)}</div></div>''')

    def group(g):
        top = (f'<div data-name="Plan group" style="display:flex;align-items:baseline;gap:14px;{"flex-direction:column;gap:4px;" if m else ""}'
               f'padding-bottom:16px;margin-bottom:{20 if m else 24}px;border-bottom:1.5px solid var(--fg)">'
               f'<span class="h2" style="font-size:{24 if m else 28}px">{ctx.t(g["label"])}</span><span class="body fg2" style="font-size:15px">{ctx.t(g.get("sub", ""))}</span></div>')
        ps = [plan(p) for p in g["plans"]]
        out = top + (swipe(ps) if m else grid(ps, 2, 20))
        if g.get("note"):
            out += (f'<div data-name="Note" style="display:flex;gap:14px;align-items:center;margin-top:20px;padding:18px 22px;border-radius:20px;background:var(--alt)">'
                    f'<span class="acc" style="flex:none;font-weight:600;font-size:13px;letter-spacing:.14em;text-transform:uppercase">{ctx.t(g["note"]["label"])}</span>'
                    f'<span class="body fg2" style="font-size:14px">{ctx.t(g["note"]["text"])}</span></div>')
        return out
    gs = [group(g) for g in c["groups"]]
    plans = "".join(f'<div style="{"margin-top:48px" if i and m else ""}">{x}</div>' for i, x in enumerate(gs)) if m else \
        f'<div style="display:grid;grid-template-columns:{" ".join(["1fr"] * len(gs))};gap:48px;align-items:start">{"".join(f"<div>{x}</div>" for x in gs)}</div>'
    inner = (head(ctx, c.get("eyebrow"), c["title"], c.get("sub"), m)
             + f'<div style="margin-top:{32 if m else 56}px">{plans}</div>'
             + (f'<p class="body fg3" style="margin-top:28px;font-size:13px;max-width:900px">{ctx.t(c["small"])}</p>' if c.get("small") else ""))
    return sec(ctx, "Membership", "membership", inner, m, c.get("tone"))
