"""Mid-page form (not a kit block yet). SOP: forms in three places, hero, mid-page and final.
Mobile swaps the form for one button back to the hero form, so the page isn't three forms long."""
from ..ui import sec, head, grid, tick, form_card


def note_card(ctx, n, m):
    return (f'<div class="card" data-name="{n.get("name", "Note")}" style="background:var(--alt);padding:{"20px" if m else "22px 26px"};display:flex;gap:16px;align-items:flex-start">'
            f'{ctx.icon(n.get("icon", "shield"), 32)}<div><div class="h3" style="font-size:17px">{ctx.t(n["title"])}</div>'
            f'<p class="body fg2" style="margin-top:6px;font-size:15px">{ctx.t(n["text"])}</p></div></div>')


def form_band(ctx, c, m):
    note = c.get("note_card")
    if m:
        inner = (f'<div class="label acc">{ctx.t(c.get("m_label", "Book now"))}</div>'
                 f'<h2 class="h1" style="margin-top:12px;font-size:30px">{ctx.t(c["title"])}</h2>'
                 f'<p class="body fg2" style="margin-top:12px">{ctx.t(c.get("m_sub", "It takes under a minute. We’ll call you back to confirm."))}</p>'
                 f'<div style="margin-top:24px"><span class="btn primary" style="height:56px;width:100%">{ctx.cta_label}</span></div>'
                 + (f'<div style="margin-top:20px">{note_card(ctx, note, m)}</div>' if note else ""))
        return sec(ctx, "Book now (mobile: button to hero form)", "form_band", inner, True, c.get("tone"), pad_m=(48, 20))
    left = f'''<div style="display:flex;flex-direction:column;justify-content:center">
      {head(ctx, c.get('eyebrow'), c['title'], c.get('sub'), m, width=520)}
      <div style="display:grid;gap:12px;margin-top:28px">{"".join(tick(ctx, x) for x in c.get('ticks', []))}</div>
      {f'<div style="margin-top:28px">{note_card(ctx, note, m)}</div>' if note else ''}</div>'''
    body = f'<div style="display:grid;grid-template-columns:1fr 520px;gap:96px;align-items:center">{left}{form_card(ctx, 520, 40, title=c.get("form_title"))}</div>'
    return sec(ctx, c.get("name", "Book (form 2)"), "form_band", body, m, c.get("tone"))
