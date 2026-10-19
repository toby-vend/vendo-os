"""Assemble a page from a recipe and write the four outputs:
  lp-desktop.html / lp-mobile.html   fixed 1440 / 390 artboards for the Figma capture
  index.html                         the live, responsive preview (mobile layout below 1024px)
  ty-desktop.html / ty-mobile.html / thank-you.html   the same for the thank-you page

The live layer (.live) only applies outside a Figma capture (the capture adds #figmacapture to the URL), so the
same file serves both: sticky header, the mobile Book Now bar that appears once the hero button has scrolled
off, the awards marquee, and every button scrolling to the hero form.
"""
from .sections import REGISTRY

LIVE_CSS = """
.live body { padding: 0; background: var(--bg); }
.live .page { margin: 0 auto; overflow: clip; }
.live .d, .live .m { width: 100%; }
.live [data-name^="Sticky header"] { position: sticky; top: 0; z-index: 20; background: var(--bg); }
.live .d > [style*="px 80px"], .live .d > [data-name="Sticky header"] {
  padding-left: max(clamp(32px, 5.5vw, 80px), calc(50% - 640px)) !important; padding-right: max(clamp(32px, 5.5vw, 80px), calc(50% - 640px)) !important; }
.live .m > [style*="px 20px"] { padding-left: max(20px, calc(50% - 300px)) !important; padding-right: max(20px, calc(50% - 300px)) !important; }
.live .hero-copy { width: min(560px, calc(100% - 440px)) !important; }
@media (max-width: 1419px) { .live .hero-s { display: none; } }
.live .bar { position: fixed !important; top: auto !important; bottom: 0; left: 0 !important; width: 100% !important; transform: translateY(110%); transition: transform .3s ease; }
.live.show-bar .bar { transform: none; }
@media (max-width: 1023px) { .live .both .page.d { display: none; } }
@media (min-width: 1024px) { .live .both .page.m { display: none; } }
.live .track { margin-left: 0 !important; padding-right: var(--g); animation: marquee 30s linear infinite; }
.live .track:hover { animation-play-state: paused; }
@keyframes marquee { to { transform: translateX(-50%); } }
@media (prefers-reduced-motion: reduce) { .live .track { animation: none; } }
.d { width: 1440px; }
.m { width: 390px; padding-bottom: 84px; }
"""

LIVE_JS = ("document.addEventListener('DOMContentLoaded',function(){var R=document.documentElement;if(!R.classList.contains('live'))return;"
           "var btn=document.querySelector('.page.m [data-name^=\"Hero button\"]'),form=document.querySelector('.page.m [data-name=\"Hero\"] [data-name=\"Booking form\"]');"
           "function upd(){if(!btn||!form||btn.offsetParent===null)return R.classList.remove('show-bar');var b=btn.getBoundingClientRect(),f=form.getBoundingClientRect();"
           "R.classList.toggle('show-bar',b.bottom<0&&(f.bottom<innerHeight*.25||f.top>innerHeight*.75))}addEventListener('scroll',upd,{passive:true});addEventListener('resize',upd);upd();"
           "document.addEventListener('click',function(ev){var b=ev.target.closest('.btn');if(!b||b.closest('[data-name=\"Booking form\"]')||b.tagName==='A')return;"
           "var f=[].slice.call(document.querySelectorAll('[data-name=\"Hero\"] [data-name=\"Booking form\"]')).filter(function(x){return x.offsetParent!==null})[0];"
           "if(f){ev.preventDefault();scrollTo({top:f.getBoundingClientRect().top+scrollY-96,behavior:'smooth'})}});});")


def bottom_bar(ctx):
    """Mobile sticky bottom bar: the form CTA only, scrolls to the hero form. Drawn at the first screen's fold."""
    return (f'<div class="bar tone-light" data-name="Sticky bottom bar (fixed to viewport bottom)" style="position:absolute;left:0;top:760px;width:390px;height:84px;'
            f'padding:12px 16px;background:var(--s-bg);box-shadow:0 -8px 24px rgba(0,0,0,.1);display:grid;z-index:5">'
            f'<span class="btn primary" style="height:56px">{ctx.cta}</span></div>')


def render_sections(ctx, recipe, m):
    out = []
    for s in recipe:
        fn = REGISTRY.get(s["block"])
        if fn is None:
            raise SystemExit(f"Unknown block '{s['block']}'. Known: {', '.join(sorted(REGISTRY))}")
        if m and s.get("desktop_only") or not m and s.get("mobile_only"):
            continue
        out.append(fn(ctx, s, m))
    return "".join(out)


def doc(ctx, title, body_cls, inner):
    return (f"<!doctype html><html lang='en-GB'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1'>"
            f"<script>if(!/figmacapture|static/.test(location.hash))document.documentElement.className='live'</script><title>{title}</title>"
            f"<style>{ctx.brand.css()}{LIVE_CSS}</style><script>{LIVE_JS}</script>"
            f"<script src='https://mcp.figma.com/mcp/html-to-design/capture.js' async></script></head>"
            f"<body{body_cls}>{inner}</body></html>")


def artboard(ctx, title, recipe, m, bar=True):
    cls = "m" if m else "d"
    body = render_sections(ctx, recipe, m)
    return f"<div class='page {cls}' data-name='{title}' style='position:relative'>{body}{bottom_bar(ctx) if m and bar else ''}</div>"


def build(ctx, out_dir, slug, title, recipe, ty_recipe):
    """Write all six files for one page type into out_dir."""
    name = ctx.client["name"]
    files = {
        "lp-desktop.html": doc(ctx, f"{title} | Desktop", "", artboard(ctx, f"{title} | Desktop", recipe, False)),
        "lp-mobile.html": doc(ctx, f"{title} | Mobile", "", artboard(ctx, f"{title} | Mobile", recipe, True)),
        "ty-desktop.html": doc(ctx, "Thank you | Desktop", "", artboard(ctx, "Thank you | Desktop", ty_recipe, False)),
        "ty-mobile.html": doc(ctx, "Thank you | Mobile", "", artboard(ctx, "Thank you | Mobile", ty_recipe, True, bar=False)),
        "index.html": doc(ctx, f"{title} | {name}", " class='both'",
                          artboard(ctx, f"{title} | Desktop", recipe, False) + artboard(ctx, f"{title} | Mobile", recipe, True)),
        "thank-you.html": doc(ctx, f"Thank you | {name}", " class='both'",
                              artboard(ctx, "Thank you | Desktop", ty_recipe, False) + artboard(ctx, "Thank you | Mobile", ty_recipe, True, bar=False)),
    }
    out_dir.mkdir(parents=True, exist_ok=True)
    for f, html in files.items():
        (out_dir / f).write_text(html)
    return list(files)
