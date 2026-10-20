"""Final CTA with the third form (kit block: vdk/cta) and the footer (kit block: vdk/footer)."""
from ..ui import sec, grid, stars, form_card, wash


def footer_html(ctx, m, credit=True):
    lw = ctx.brand.data["logo"]
    cr = f' · {ctx.client.get("credit", "Marketing by Vendo Digital")}' if credit else ""
    return (f'<div style="display:flex;{"flex-direction:column;gap:16px" if m else "justify-content:space-between;align-items:center;gap:32px"}">'
            f'<div class="fg2" style="width:{lw.get("width_footer", 130)}px">{ctx.brand.logo(lw.get("footer", "light"))}</div>'
            f'<span class="body fg2" style="font-size:13px">{ctx.t("{{address}}")}</span>'
            f'<span class="body fg3" style="font-size:13px">© {ctx.client.get("year", 2026)} {ctx.t("{{name}}")}. All rights reserved. <u>Privacy policy</u>{cr}</span></div>')


def final_cta(ctx, c, m):
    T = ctx.brand.type["display"]
    tags = "".join(f'<span class="label fg2" style="font-weight:500">{ctx.t(x)}</span>' for x in c.get("tags", []))
    # trust line: the Google rating, unless the page sets "trust": null (no reviews yet)
    trust = (f'<div style="display:flex;align-items:center;gap:12px;margin-top:28px">{stars(5, 16)}<span class="body fg2" style="font-size:14px">'
             f'{ctx.t(c.get("trust", "{{rating}} from {{review_count}} Google reviews"))}</span></div>') if c.get("trust", True) else ""
    left = f'''<div style="display:flex;flex-direction:column;justify-content:center">
      <div class="label acc">{ctx.t(c.get('eyebrow', 'Get started'))}</div>
      <h2 class="display" style="margin-top:18px;font-size:{c.get('size_m', 34) if m else c.get('size', T['size'])}px">{ctx.t(c['title'])}</h2>
      <p class="body fg2" style="margin-top:20px;font-size:{16 if m else 18}px">{ctx.t(c['sub'])}</p>
      <div style="display:flex;gap:28px;margin-top:20px;flex-wrap:wrap">{tags}</div>
      {trust}
    </div>'''
    form = form_card(ctx, 350 if m else 500, 24 if m else 40, title=c.get("form_title"))
    inner = grid([left, form], 1, 32) if m else f'<div style="display:grid;grid-template-columns:1fr 500px;gap:96px;align-items:center">{left}{form}</div>'
    foot = f'<div data-name="Footer" style="margin-top:{56 if m else 96}px;padding-top:32px;border-top:1px solid var(--rule)">{footer_html(ctx, m)}</div>'
    bg = wash(ctx, c["backdrop"], m) if c.get("backdrop") else ""  # optional washed photo behind a dark band
    return sec(ctx, "Final CTA", "final_cta", inner + foot, m, c.get("tone"), extra=bg)
