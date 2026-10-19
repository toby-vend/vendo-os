"""Hero with form (kit block: vdk/hero-form).

SOP: a direct, priced headline with the location above the fold; the first of three forms.
The brand's graphic device frames the lead clinician (devices.frame); on mobile the frame drops below the copy
and the form overlaps its bottom edge.
"""
from ..devices import frame
from ..ui import tick, stars, form_card, seal, watermark


def hero_form(ctx, c, m):
    T = ctx.brand.type
    ph = c.get("photo")
    glow = ctx.brand.data.get("hero", {}).get("glow")
    stats_d = c.get("stats", [])
    if m:
        sl = f'<div style="position:absolute;right:-56px;bottom:40px">{seal(ctx, c["seal"], 130)}</div>' if c.get("seal") else ""
        fr = (f'<div data-name="Device" style="position:relative;width:230px;height:360px;margin:{c.get('device_gap_m', 48)}px auto 0">{frame(ctx, ph, 230, 360)}{sl}</div>'
              if ph else "")
        trust = (f'<div data-name="Trust line" style="display:flex;align-items:center;gap:10px;margin-top:18px">{stars(5, 14)}<span class="body fg2" style="font-size:13px;white-space:nowrap">{ctx.t(c.get('trust', '{{rating}} from {{review_count}} Google reviews'))}</span></div>'
                 if c.get("trust", True) else "")
        stats = "".join(f'<div><div class="h1" style="font-size:32px">{ctx.t(n)}</div><div class="label fg3" style="margin-top:4px;font-size:12px">{ctx.t(l)}</div></div>'
                        for n, l in c.get("stats_m", stats_d))
        return f"""
<section data-name="Hero" class="tone-light" style="position:relative;padding:40px 20px 48px;background:var(--s-bg)">
  {watermark(ctx, "hero_form", m)}
  <div class="label acc" style="position:relative">{ctx.t(c['eyebrow'])}</div>
  <h1 class="display" style="margin-top:16px;font-size:{T['display'].get('size_m', 36)}px">{ctx.t(c['title'])}</h1>
  <p class="h2" style="margin-top:12px;font-size:22px;font-weight:300">{ctx.t(c.get('tagline', ''))}</p>
  <p class="body fg2" style="margin-top:12px">{ctx.t(c.get('sub', ''))}</p>
  <div style="display:grid;gap:10px;margin-top:20px">{"".join(tick(ctx, x, 15) for x in c.get('ticks_m', c.get('ticks', [])[:2]))}</div>
  <div data-name="Hero button (scrolls to the form)" style="margin-top:22px"><span class="btn primary" style="height:54px;width:100%">{ctx.cta_label}</span></div>
  {trust}
  {fr}
  <div style="margin-top:{-60 if ph else 32}px;position:relative">{form_card(ctx, 350, 24, offer=True)}</div>
  <div style="display:flex;justify-content:space-between;margin-top:32px">{stats}</div>
</section>"""
    stats = "".join(f'<div><div class="h1" style="font-size:40px">{ctx.t(n)}</div><div class="label fg3" style="margin-top:6px">{ctx.t(l)}</div></div>'
                    for n, l in stats_d)
    bgl = f'<div style="position:absolute;inset:0;background:radial-gradient(circle at 72% 40%,{glow} 0%,var(--s-bg) 55%)"></div>' if glow else ""
    sl = f'<div style="position:absolute;left:-90px;bottom:60px">{seal(ctx, c["seal"], 180)}</div>' if c.get("seal") else ""
    fr = (f'<div data-name="Device" class="hero-s" style="position:absolute;right:320px;top:100px;width:380px;height:640px">{frame(ctx, ph, 380, 640)}{sl}</div>'
          if ph else "")
    return f"""
<section data-name="Hero" class="tone-light" style="position:relative;min-height:840px;padding:0px 80px;background:var(--s-bg)">
  {bgl}{watermark(ctx, "hero_form", m)}
  <div class="hero-in" style="position:relative;max-width:1280px;margin:0 auto;min-height:840px">
  <div class="hero-copy" style="position:relative;padding:96px 0 80px;width:560px">
    <div class="label acc">{ctx.t(c['eyebrow'])}</div>
    <h1 class="display" style="margin-top:22px;{f"font-size:{c['title_size']}px" if c.get('title_size') else ''}">{ctx.t(c['title'])}</h1>
    <p class="h2" style="margin-top:18px;font-weight:300">{ctx.t(c.get('tagline', ''))}</p>
    <p class="body fg2" style="margin-top:16px;font-size:18px;max-width:500px">{ctx.t(c.get('sub', ''))}</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px 24px;margin-top:32px;max-width:520px">{"".join(tick(ctx, x) for x in c.get('ticks', []))}</div>
    <div style="display:flex;gap:56px;margin-top:48px;padding-top:32px;border-top:1px solid var(--rule);max-width:520px">{stats}</div>
  </div>
  {fr}
  <div class="hero-form" style="position:absolute;right:0;top:150px;width:400px">{form_card(ctx, 400, 36, offer=True)}</div>
  </div>
</section>"""
