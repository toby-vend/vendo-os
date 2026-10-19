"""FAQ (kit block: vdk/faq). The first item (or those listed in "open") is shown expanded in the design."""
from ..ui import sec, head, grid


def faq(ctx, c, m):
    rows = []
    opened = set(c.get("open", [0]))
    for i, (q, a) in enumerate(c["items"]):
        o = i in opened
        ans = f'<p class="body fg2" style="margin-top:12px;max-width:760px">{ctx.t(a)}</p>' if o and a else ''
        rows.append(f'''<div data-name="FAQ item" style="border-bottom:1px solid var(--rule);padding:{20 if m else 26}px 0">
          <div style="display:flex;justify-content:space-between;gap:20px;align-items:center"><span class="h3" style="font-size:{17 if m else 20}px">{ctx.t(q)}</span>
          <span style="flex:none;width:36px;height:36px;border-radius:50%;background:{'var(--btn-bg)' if o else 'var(--alt)'};color:{'var(--btn-fg)' if o else 'var(--fg)'};display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:300">{'–' if o else '+'}</span></div>
          {ans}</div>''')
    left = head(ctx, c.get("eyebrow", "FAQ"), c.get("title", "Common questions"), c.get("sub", "Can’t see your question? Send us your details and we’ll call you back."), m, width=380)
    right = f'<div style="border-top:1px solid var(--rule)">{"".join(rows)}</div>'
    body = grid([left, right], 1, 32) if m else f'<div style="display:grid;grid-template-columns:380px 1fr;gap:80px">{left}{right}</div>'
    return sec(ctx, "FAQ", "faq", body, m, c.get("tone"))
