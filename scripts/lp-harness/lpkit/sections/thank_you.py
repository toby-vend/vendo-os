"""Thank-you page. SOP: confirm the request and offer online booking. Call and WhatsApp buttons only ever go
here (never on the LP), and only when the client asks, so those clicks can be tracked as conversions."""
from ..ui import sec, TICK
from .header import header
from .cta import footer_html


def thank_you(ctx, c, m):
    btns = []
    for b in c.get("buttons", [{"label": "Choose a time online", "href": "{{booking_url}}", "style": "primary"}]):
        ic = ctx.icon(b["icon"], 18, "currentColor").replace('style="', 'style="display:inline-flex;', 1) if b.get("icon") else ""
        btns.append(f'<a data-name="{b.get("name", b["label"])}" href="{ctx.t(b.get("href", "#"))}" class="btn {b.get("style", "primary")}" style="gap:10px;text-decoration:none">{ic}{ctx.t(b["label"])}</a>')
    card = f'''<div class="card tone-card" data-name="Confirmation" style="background:var(--s-bg);max-width:720px;margin:0 auto;padding:{32 if m else 64}px;text-align:center;box-shadow:0 30px 60px rgba(0,0,0,.08)">
      <div style="width:64px;height:64px;border-radius:50%;background:var(--alt);display:flex;align-items:center;justify-content:center;margin:0 auto">{TICK.format(s=26)}</div>
      <div class="label acc" style="margin-top:28px">{ctx.t(c.get('label', 'Request received'))}</div>
      <h1 class="h1" style="margin-top:12px;font-size:{32 if m else 44}px">{ctx.t(c.get('title', 'Thank you. We’ve got your details.'))}</h1>
      <p class="body fg2" style="margin-top:16px;font-size:{16 if m else 18}px">{ctx.t(c['text'])}</p>
      <div data-name="Buttons" style="display:flex;{'flex-direction:column;align-items:stretch;' if m else 'justify-content:center;align-items:center;'}gap:{12 if m else 16}px;margin-top:32px">{"".join(btns)}</div>
      <p class="body fg3" style="margin-top:28px;font-size:14px">{ctx.t('{{address}}')}</p>
    </div>'''
    return (header(ctx, {}, m) + sec(ctx, "Thank you", "thank_you", card, m, c.get("tone"), pad=(120, 80), pad_m=(48, 20))
            + sec(ctx, "Footer", "footer", footer_html(ctx, m, credit=False), m, c.get("footer_tone", "dark"), pad=(40, 80), pad_m=(32, 20)))
