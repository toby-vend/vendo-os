"""Awards marquee (not in the kit yet; Maylands and Siha both needed one). An edge-to-edge strip that
auto-scrolls and loops (CSS translateX(-50%) on a doubled track, pause on hover, off for reduced motion)."""


def awards(ctx, c, m):
    h, gap = (58, 28) if m else (84, 72)
    def item(a):
        if m:
            return (f'<div data-name="Award" style="flex:none;width:140px;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center">'
                    f'<img src="{a["img"]}" style="height:{h}px;width:auto;max-width:140px;object-fit:contain">'
                    f'<span class="label fg3" style="font-size:10px;line-height:1.5">{a["result"]}<br>{a["title"]}</span></div>')
        return (f'<div data-name="Award" style="flex:none;display:flex;flex-direction:column;align-items:center;gap:10px">'
                f'<img src="{a["img"]}" style="height:{h}px;width:auto">'
                f'<span class="label fg3" style="font-size:12px;white-space:nowrap">{a["result"]} · {a["title"]}</span></div>')
    items = "".join(item(a) for a in c["items"])
    fade = lambda side: (f'<div style="position:absolute;top:0;bottom:0;{side}:0;width:{60 if m else 160}px;'
                         f'background:linear-gradient(to {"right" if side == "left" else "left"},var(--s-bg),transparent);z-index:1"></div>')
    tn = ctx.brand.tone("awards", c.get("tone"))
    return (f'<section data-name="Awards marquee (auto-scrolls, loops)" class="tone-{tn}" style="position:relative;padding:{"28px 0 30px" if m else "36px 0 40px"};overflow:hidden">'
            f'<div class="label acc" style="text-align:center;margin-bottom:{18 if m else 24}px">{ctx.t(c.get("label", "Award-winning care"))}</div>'
            f'<div style="position:relative;overflow:hidden">{fade("left")}{fade("right")}'
            f'<div class="track" data-name="Track" style="--g:{gap}px;display:flex;gap:{gap}px;align-items:flex-start;margin-left:-{70 if m else 220}px;width:max-content">{items}{items}</div></div></section>')
