"""USP strip (kit block: vdk/usp-text). Short reasons to choose the practice, one icon each."""
from ..ui import sec, grid


def usp_text(ctx, c, m):
    if m and c.get("hide_m", True):
        return ""  # mobile: folded into the hero trust line
    items = [f'<div style="display:flex;flex-direction:column;gap:16px;align-items:flex-start">{ctx.icon(i, 36)}'
             f'<span class="body fg2" style="font-size:{15 if m else 16}px">{ctx.t(t)}</span></div>' for i, t in c["items"]]
    inner = (f'<div class="label acc" style="{"" if m else "text-align:center;"}margin-bottom:{24 if m else 40}px">{ctx.t(c.get("label", "Why patients choose us"))}</div>'
             + grid(items, 1 if m else len(items), 20 if m else 40))
    return sec(ctx, "Why patients choose us", "usp_text", inner, m, c.get("tone"), pad=(56, 80), pad_m=(48, 20))
