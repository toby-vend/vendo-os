"""Migrate the Claude Design "Oxted Evergreen Ads" canvas into Figma-capture harness pages.

Source: Claude Design project c27a71dc ("Studio Glide brand guidelines"), file "Oxted Evergreen Ads.dc.html", pulled
into src/ on 23 Oct 2026. Turns 2 to 9 are migrated (turn 1 was the pre-launch awareness set and is left out).

Each turn becomes one page: 1:1 row at y=80, copy cards below, 9:16 row below that. Artboard markup is copied
unchanged except:
- uploads/ paths point at src/uploads/, Squarespace photos and the logo point at local copies in assets/.
- filter:brightness(0) logos use assets/logo/logo-black.png (same result, no filter for the capture to drop).
- The -apple-system stack on the native-format ads becomes Inter (Figma cannot load SF Pro server-side).
- bake.js pre-renders every object-fit / object-position / filtered <img> to a canvas crop at load, because the
  Figma capture ignores object-position and CSS filters.

Copy cards come from data/studio-glide/oxted-evergreen-ad-copy.json (the live copy sheet). Each card flags offer
lines that no longer match the Oxted LP (23 Oct 2026: First Time Pass, up to 6 classes for £60, 6 to 8 per class).

Usage: python3 build_migration.py  ->  migrate-<turn>.html
"""
import html
import json
import re
from pathlib import Path

HERE = Path(__file__).parent
SRC = (HERE / 'src/Oxted Evergreen Ads.dc.html').read_text()
COPY = json.loads((HERE / '../../../data/studio-glide/oxted-evergreen-ad-copy.json').read_text())
ADS = {a['ref']: a for a in COPY['ads']}
CAROUSEL = COPY['carousel']

TURNS = {
    '9': 'First Time Pass (6 for £60)', '8': 'Evergreen 3 for £29', '7': 'Review carousel',
    '6': 'Platform-native II', '5': 'Platform-native I', '4': 'Chat statics', '3': 'Intro pack',
    '2': 'Brand photo',
}

CHAR, IVORY, TERRA, GREY = '#1C1B19', '#F7F4EE', '#8F6047', '#5A5248'
GAP = 1160
APPLE = "-apple-system,'Helvetica Neue',Helvetica,Arial,sans-serif"


def balanced_div(s, start):
    """Return the end index of the <div> element that opens at s[start]."""
    depth, i = 0, start
    for m in re.finditer(r'<div\b|</div>', s[start:]):
        depth += 1 if m.group() == '<div' else -1
        if depth == 0:
            return start + m.end()
    raise ValueError('unbalanced')


def creatives():
    """{ref: {'label': str, 'boards': [(w, h, html), ...]}} in canvas order."""
    out = {}
    for m in re.finditer(r'<div id="(\d[a-z])" style="position:relative">\s*<div[^>]*>([^<]*)</div>', SRC):
        ref, label = m.group(1), html.unescape(m.group(2))
        end = balanced_div(SRC, m.start())
        block = SRC[m.end():end]
        boards = []
        for b in re.finditer(r'<div style="(?:[^"]*;)?width:1080px;height:(1080|1920)px', block):
            if any(b.start() < e and b.start() > s for s, e, _ in boards):
                continue
            e = balanced_div(block, b.start())
            boards.append((b.start(), e, int(b.group(1))))
        out[ref] = {'label': label.split('·', 1)[-1].strip() or ref,
                    'boards': [(1080, h, block[s:e]) for s, e, h in boards]}
    return out


PHOTO_MAP = {
    'group-reformer-pilates-studio-banstead-surrey-premium': 'site-group-reformer-pilates-studio-banstead-surrey-premium.jpg',
    'reformer-pilates-lunge-pilates-ball-banstead-surrey': 'site-reformer-pilates-lunge-pilates-ball-banstead-surrey.jpg',
    'reformer-pilates-studio-banstead-surrey': 'site-reformer-pilates-studio-banstead-surrey.jpg',
    'studio-glide-pilates-roam-creative-marketing-303': 'site-studio-glide-pilates-roam-creative-marketing-303.jpg',
}


def localise(h):
    def logo(m):
        tag = m.group(0)
        black = 'brightness(0)' in tag
        tag = re.sub(r'src="[^"]+"', f'src="assets/logo/logo-{"black" if black else "white"}.png"', tag)
        return tag.replace('filter:brightness(0)', '')
    h = re.sub(r'<img[^>]*STUDIO_GLIDE_PILATES_logo_06[^>]*>', logo, h)
    for k, v in PHOTO_MAP.items():
        h = re.sub(rf'https://images\.squarespace-cdn\.com/[^"]*/{k}\.jpg\?format=\d+w', f'assets/photos/{v}', h)
    h = h.replace('src="uploads/', 'src="src/uploads/')
    return h.replace(APPLE, "'Inter',sans-serif")


def flags(text):
    """Offer lines on the ad or its copy that no longer match the Oxted LP."""
    t = html.unescape(re.sub(r'<[^>]+>', ' ', text))
    out = []
    if re.search(r'£\s*29|3 classes|three classes|Start with three|3 for', t, re.I):
        out.append('Offer is 3 for £29. LP now: up to 6 classes for £60 (First Time Pass)')
    if re.search(r'capped at 10|classes of 10|10 people|max(imum)? 10', t, re.I):
        out.append('Class size says 10. LP now: 6 to 8 per class')
    if re.search(r'priority list|we.re coming|coming soon|opening soon|coming august', t, re.I):
        out.append('Pre-launch wording (priority list / coming soon)')
    return out


def card(ref, label, extra_text=''):
    a = ADS.get(ref)
    body = (f'<div class="k">Primary text</div><div class="p">{html.escape(a["primary"]).replace(chr(10), "<br>")}</div>'
            f'<div class="k">Headline</div><div class="v">{html.escape(a["headline"])}</div>'
            f'<div class="k">Headline (alt)</div><div class="v">{html.escape(a.get("headlineAlt", ""))}</div>'
            f'<div class="k">Description · CTA</div><div class="v">{html.escape(a.get("description", ""))} · {html.escape(a.get("cta", ""))}</div>'
            ) if a else '<div class="p" style="color:#8F6047">No primary text or headline on file for this ad. Write before launch.</div>'
    fl = flags(extra_text + (a['primary'] + a['headline'] if a else ''))
    fl_html = ''.join(f'<div class="f">Check · {html.escape(f)}</div>' for f in fl)
    return f'<div class="card"><div class="t">{ref} · {html.escape(label)}</div>{fl_html}{body}</div>'


CSS = f"""
*{{box-sizing:border-box}}
body{{margin:0;background:#E9E2D4;font-family:'Lato',sans-serif;color:{CHAR};-webkit-font-smoothing:antialiased}}
.canvas{{position:relative}}
.slot{{position:absolute}}
.card{{position:absolute;width:1080px;background:#fff;border:1px solid #D9C3AA;padding:40px 44px;font-family:'Inter',sans-serif}}
.card .t{{font-size:30px;font-weight:600;margin-bottom:18px}}
.card .k{{font-size:15px;letter-spacing:.14em;text-transform:uppercase;color:{TERRA};margin-top:22px;font-weight:600}}
.card .p{{font-size:22px;line-height:1.5;margin-top:8px;color:{CHAR}}}
.card .v{{font-size:22px;margin-top:6px}}
.card .f{{font-size:19px;color:#fff;background:{TERRA};padding:8px 14px;margin-top:8px;display:inline-block;margin-right:8px}}
"""

BAKE = """
<script>
// Pre-render object-fit / object-position / filtered images so the Figma capture keeps the exact crop.
window.__baked = false;
(async () => {
  const imgs = [...document.querySelectorAll('.slot img')];
  await Promise.all(imgs.map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
  await document.fonts.ready;
  for (const img of imgs) {
    const cs = getComputedStyle(img);
    const fit = cs.objectFit, filt = cs.filter;
    if (fit !== 'cover' && fit !== 'contain' && filt === 'none') continue;
    const bw = img.clientWidth, bh = img.clientHeight;
    if (!bw || !bh || !img.naturalWidth) continue;
    const scale = Math.min(1.5, 1620 / Math.max(bw, bh));
    const c = document.createElement('canvas'); c.width = Math.round(bw * scale); c.height = Math.round(bh * scale);
    const ctx = c.getContext('2d');
    if (filt !== 'none') ctx.filter = filt;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const pos = cs.objectPosition.split(' ').map(v => v.endsWith('%') ? parseFloat(v) / 100 : null);
    const px = pos[0] ?? .5, py = pos[1] ?? .5;
    if (fit === 'cover') {
      const r = Math.max(bw / iw, bh / ih), sw = bw / r, sh = bh / r;
      ctx.drawImage(img, (iw - sw) * px, (ih - sh) * py, sw, sh, 0, 0, c.width, c.height);
    } else if (fit === 'contain') {
      const r = Math.min(bw / iw, bh / ih), dw = iw * r * scale, dh = ih * r * scale;
      ctx.drawImage(img, 0, 0, iw, ih, (c.width - dw) * px, (c.height - dh) * py, dw, dh);
    } else {
      ctx.drawImage(img, 0, 0, c.width, c.height);
    }
    const png = /\\.png/i.test(img.src);
    img.src = c.toDataURL(png ? "image/png" : "image/jpeg", .85);
    img.style.objectFit = 'fill'; img.style.objectPosition = '50% 50%'; img.style.filter = 'none';
  }
  window.__baked = true;
})();
</script>"""


def page(turn, refs, crs, col0=0):
    squares, copies, stories, cards = [], [], [], []
    col = col0
    for ref in refs:
        c = crs[ref]
        sq = [b for b in c['boards'] if b[1] == 1080]
        st = [b for b in c['boards'] if b[1] == 1920]
        if ref == '7a':  # carousel: eight square cards, card copy from the sheet
            for i, b in enumerate(sq):
                x = 80 + col * GAP
                squares.append(f'<div class="slot" data-name="{ref}-{i + 1:02d}" style="left:{x}px;top:80px">{localise(b[2])}</div>')
                cc = CAROUSEL[i] if i < len(CAROUSEL) else {}
                cards.append(f'<div class="card" style="left:{x}px;top:1240px"><div class="t">7a · Card {i + 1:02d} {html.escape(cc.get("card", ""))}</div>'
                             f'<div class="k">Headline</div><div class="v">{html.escape(cc.get("headline", ""))}</div>'
                             f'<div class="k">Description</div><div class="v">{html.escape(cc.get("description", ""))}</div></div>')
                col += 1
            continue
        x = 80 + col * GAP
        if sq:
            squares.append(f'<div class="slot" data-name="{ref}" style="left:{x}px;top:80px">{localise(sq[0][2])}</div>')
        if st:
            stories.append(f'<div class="slot" data-name="{ref}" style="left:{x}px;top:STORYY">{localise(st[0][2])}</div>')
        cards.append(card(ref, c['label'], ''.join(b[2] for b in c['boards'])).replace('class="card"', f'class="card" style="left:{x}px;top:1240px"', 1))
        col += 1
    story_y = 1240 + 1320
    width = 80 + col * GAP
    height = (story_y + 1920 + 80) if stories else 2600
    body = ''.join(squares) + ''.join(cards) + ''.join(stories).replace('STORYY', f'{story_y}px')
    return f'''<!doctype html><html><head><meta charset="utf-8"><title>Studio Glide · {turn} · {TURNS[turn]}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Lato:ital,wght@0,300;0,400;0,700;1,400&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>
<style>{CSS}</style></head><body><div class="canvas" style="width:{width}px;height:{height}px">{body}</div>{BAKE}</body></html>'''


if __name__ == '__main__':
    crs = creatives()
    for turn in TURNS:
        refs = [r for r in crs if r[0] == turn]
        (HERE / f'migrate-{turn}.html').write_text(page(turn, refs, crs))
        print(turn, TURNS[turn], refs)
    # Set 2 is too heavy for one capture: split into halves that keep their column positions.
    refs2 = [r for r in crs if r[0] == '2']
    (HERE / 'migrate-2-part1.html').write_text(page('2', refs2[:4], crs))
    (HERE / 'migrate-2-part2.html').write_text(page('2', refs2[4:], crs, col0=4))
