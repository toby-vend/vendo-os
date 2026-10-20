"""Hero with form (kit block: vdk/hero-form).

SOP: a direct, priced headline with the location above the fold; the first of three forms.
The brand's graphic device frames the lead clinician (devices.frame); on mobile the frame drops below the copy
and the form overlaps its bottom edge. "backdrop": {"src", ...} instead sets the hero on a real photo under the
brand's dark wash (ui.wash), for brands whose signature is the washed photo rather than a framed portrait.
"""
from ..devices import frame
from ..ui import tick, stars, form_card, seal, watermark, wash


def hero_form(ctx, c, m):
    T = ctx.brand.type
    ph = c.get("photo")
    glow = ctx.brand.data.get("hero", {}).get("glow")
    stats_d = c.get("stats", [])
    bd = c.get("backdrop")
    tn = "dark" if bd else "light"
    bg = wash(ctx, bd, m) if bd else "background:var(--s-bg);"
    if m:
        sl = f'<div style="position:absolute;right:-56px;bottom:40px">{seal(ctx, c["seal"], 130)}</div>' if c.get("seal") else ""
        fr = (f'<div data-name="Device" style="position:relative;width:230px;height:360px;margin:{c.get('device_gap_m', 48)}px auto 0">{frame(ctx, ph, 230, 360)}{sl}</div>'
              if ph else "")
        trust = (f'<div data-name="Trust line" style="display:flex;align-items:center;gap:10px;margin-top:18px">{stars(5, 14)}<span class="body fg2" style="font-size:13px;white-space:nowrap">{ctx.t(c.get('trust', '{{rating}} from {{review_count}} Google reviews'))}</span></div>'
                 if c.get("trust", True) else "")
        if bd and c.get("seal"):
            # no framed photo: the seal sits on the clear photo band at the top of the hero
            fr = f'<div data-name="Seal" style="position:absolute;right:16px;top:24px;z-index:2">{seal(ctx, c["seal"], 120)}</div>'
        stats = "".join(f'<div><div class="h1" style="font-size:32px">{ctx.t(n)}</div><div class="label fg3" style="margin-top:4px;font-size:12px">{ctx.t(l)}</div></div>'
                        for n, l in c.get("stats_m", stats_d))
        return f"""
<section data-name="Hero" class="tone-{tn}" style="position:relative;padding:{c.get('pad_top_m', 40)}px 20px 48px;{bg}">
  {watermark(ctx, "hero_form", m, tn)}
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
    if bd and c.get("seal"):  # no framed photo: the seal sits on the form's top-left corner
        fr = f'<div data-name="Seal" class="hero-s" style="position:absolute;right:{c.get("seal_right", 370)}px;top:{c.get("seal_top", 50)}px;z-index:2">{seal(ctx, c["seal"], 170)}</div>'
    form_top = c.get("form_top", 150)
    return f"""
<section data-name="Hero" class="tone-{tn}" style="position:relative;min-height:840px;padding:0px 80px;{bg}">
  {bgl}{watermark(ctx, "hero_form", m, tn)}
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
  <div class="hero-form" style="position:absolute;right:0;top:{form_top}px;width:400px">{form_card(ctx, 400, 36, offer=True)}</div>
  </div>
</section>"""
