"""Header (kit block: vdk/header). Logo, address, one CTA. Sticky on scroll in the live build.
No phone number or click-to-call: the form is the only CTA."""


def header(ctx, c, m):
    lw = ctx.brand.data["logo"]
    if m:
        return (f'<div data-name="Sticky header (stays on scroll)" class="tone-light" style="height:72px;padding:0 16px 0 20px;display:flex;align-items:center;'
                f'justify-content:space-between;border-bottom:1px solid var(--rule);background:var(--s-bg);box-shadow:0 6px 16px rgba(0,0,0,.05)">'
                f'<div class="fg2" style="width:{lw.get("width_m", 116)}px">{ctx.brand.logo("dark")}</div>'
                f'<div style="display:flex;gap:8px;align-items:center"><span class="btn primary" style="height:42px;padding:0 18px;font-size:11px">{ctx.cta_label}</span></div></div>')
    return (f'<div data-name="Sticky header" class="tone-light" style="height:96px;padding:0 80px;display:flex;align-items:center;justify-content:space-between;'
            f'border-bottom:1px solid var(--rule)">'
            f'<div class="fg2" style="width:{lw.get("width", 150)}px">{ctx.brand.logo("dark")}</div>'
            f'<div style="display:flex;align-items:center;gap:40px"><span class="body fg2" style="font-size:14px">{ctx.t(c.get("address", "{{address}}"))}</span>'
            f'<span class="btn primary">{ctx.cta_label}</span></div></div>')
