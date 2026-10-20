"""Google reviews (kit block: vdk/google-reviews, rendered live by Trustindex). The design shows the score and
three real reviews so the client sees the section; the build pulls the live widget."""
from ..ui import sec, head, cards, stars


def google_reviews(ctx, c, m):
    items = [f'''<div class="card" data-name="Review" style="background:var(--surface);padding:32px;display:flex;flex-direction:column;gap:18px">
      {stars(5, 16)}<p class="body" style="font-size:17px;line-height:1.6">“{ctx.t(q)}”</p>
      <div style="margin-top:auto"><div class="body" style="font-weight:600">{n}</div><div class="body fg2" style="font-size:13px">Posted on Google</div></div></div>''' for n, q in c["items"]]
    rating = ctx.t('{{rating}}')
    size = 72 if len(rating) <= 4 else (40 if m else 56)  # a word score ("Excellent") must fit a 390 artboard
    score = f'''<div style="display:flex;align-items:center;gap:{14 if m else 20}px;flex-wrap:wrap;{'margin-top:24px' if m else ''}">
      <span class="price" style="font-size:{size}px">{rating}</span>
      <div>{stars(5, 18)}<div class="body fg2" style="font-size:14px;margin-top:4px">{ctx.t(c.get('score_line', 'Based on {{review_count}} Google reviews'))}</div></div></div>'''
    top = (f'<div style="display:flex;{"flex-direction:column" if m else "justify-content:space-between;align-items:flex-end"}">'
           f'{head(ctx, c.get("eyebrow", "Patient reviews"), c.get("title", "What our patients say"), c.get("sub"), m, width=620)}{score}</div>')
    return sec(ctx, "Reviews", "google_reviews", top + f'<div style="margin-top:{32 if m else 56}px">{cards(items, m, 3, 20)}</div>', m, c.get("tone"))
