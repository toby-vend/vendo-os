"""Meet your dentist (not a kit block yet; Maylands added one by hand). SOP: the clinician's bio.
Photo mid-chest up; GDC number shown; quote must be the clinician's own or approved by them."""
from ..ui import sec, grid, photo, bullets


def meet_dentist(ctx, c, m):
    # "quote" only for the clinician's own published words; otherwise "text" is plain practice copy (no quote marks)
    if c.get("quote"):
        lead = (f'<p style="font-weight:300;font-size:{21 if m else 26}px;line-height:1.45;margin-top:28px;padding-left:24px;'
                f'border-left:2px solid var(--accent)">“{ctx.t(c["quote"])}”</p>')
    else:
        lead = f'<p class="body fg2" style="margin-top:24px;font-size:{16 if m else 18}px">{ctx.t(c["text"])}</p>'
    text = f'''<div style="display:flex;flex-direction:column;justify-content:center">
      <div class="label acc">{ctx.t(c.get('eyebrow', 'Meet your dentist'))}</div>
      <h2 class="h1" style="margin-top:14px;font-size:{32 if m else 44}px">{ctx.t(c['name'])}</h2>
      <div class="body fg3">{ctx.t(c['role'])}</div>
      {lead}
      <div style="display:grid;gap:10px;margin-top:28px">{bullets(ctx, c.get('creds', []))}</div></div>'''
    pic = photo(c["photo"], 380 if m else 560, arch=ctx.brand.data.get("arch_photos", False))
    return sec(ctx, "Meet your dentist", "meet_dentist", grid([pic, text] if m else [text, pic], 1 if m else 2, 32 if m else 96), m, c.get("tone"))
