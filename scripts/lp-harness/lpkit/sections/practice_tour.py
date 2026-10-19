"""Practice tour (kit block: vdk/practice-tour). SOP: a video tour slot. Shown as the video poster with a play
button plus a small gallery of the client's own interior photos (never stock)."""
from ..ui import sec, head, grid, photo, PLAY


def tour(ctx, poster, h, m):
    btn = 72 if m else 96
    return (f'<div data-name="Practice tour video" style="position:relative;height:{h}px;border-radius:var(--photo-r);overflow:hidden;background:url({poster}) 50% 50%/cover">'
            f'<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 50%,rgba(0,0,0,.5) 100%)"></div>'
            f'<div data-name="Play" class="tone-light" style="position:absolute;left:calc(50% - {btn // 2}px);top:calc(50% - {btn // 2}px);width:{btn}px;height:{btn}px;border-radius:50%;background:var(--s-bg);display:flex;align-items:center;justify-content:center;padding-left:4px">{PLAY}</div>'
            f'<div class="label" style="position:absolute;left:{20 if m else 32}px;bottom:{20 if m else 28}px;color:#fff">Practice tour</div></div>')


def practice_tour(ctx, c, m):
    ps = c.get("photos", [])
    if m:
        pics = tour(ctx, c["poster"], 240, m) + (f'<div style="margin-top:12px">{grid([photo(p, 140) for p in ps[:2]], 2, 12)}</div>' if ps else "")
    else:
        cols = "".join(f'<div style="display:grid;gap:20px">{photo(ps[i], 260)}{photo(ps[i + 1], 260)}</div>' for i in range(0, min(len(ps), 4) - 1, 2))
        pics = f'<div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:20px">{tour(ctx, c["poster"], 540, m)}{cols}</div>'
    return sec(ctx, "Practice tour", "practice_tour", head(ctx, c.get("eyebrow"), c.get("title", "Take a look around our practice"), None, m)
               + f'<div style="margin-top:{32 if m else 48}px">{pics}</div>', m, c.get("tone"))
