"""Print the use_figma script that finishes one persona page after capture.

Strips auto layout (parents first, sizes kept), lifts each artboard out of its capture wrapper, names it to the ad
build standard, locks grain and full-size overlays, names photo frames "Photo", lays out rows (1x1 at y=80, copy
cards below, 9x16 below that, 1.91x1 at the bottom), adds Inter copy cards, and deletes the wrappers.
Usage: python3 figma_finish.py <persona> <wrapper 1x1> <wrapper 9x16> <wrapper landscape>
"""
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
persona, w1, w9, wl = sys.argv[1:5]
sys.path.insert(0, str(HERE))
import build  # noqa: E402

names = {size: [c(size).split('data-name="')[1].split('"')[0] for c in build.PERSONAS[persona][1]] for size in build.SIZES}
copy = json.loads(subprocess.run([sys.executable, str(HERE / 'copy_cards.py'), persona], capture_output=True, text=True).stdout)

JS = r"""
const WRAP = {'1x1': '%W1%', '9x16': '%W9%', 'landscape': '%WL%'};
const NAMES = %NAMES%;
const COPY = %COPY%;
const page = figma.currentPage;
const out = {boards: {}, grain: 0, overlays: 0, photos: 0};
for (const [size, wid] of Object.entries(WRAP)) {
  const wrap = await figma.getNodeByIdAsync(wid);
  const body = wrap.children[0];
  const all = [wrap, ...wrap.findAllWithCriteria({types: ['FRAME']})];
  const depth = n => { let d = 0; while (n.parent && n.parent !== page) { d++; n = n.parent; } return d; };
  const size0 = new Map(all.map(f => [f.id, [f.width, f.height]]));
  all.sort((a, b) => depth(a) - depth(b));
  for (const f of all) {
    if (f.layoutMode && f.layoutMode !== 'NONE') {
      const kids = f.children.map(c => [c, c.x, c.y]);
      const [w, h] = size0.get(f.id);
      f.layoutMode = 'NONE'; f.resize(Math.max(w, .01), Math.max(h, .01));
      for (const [c, x, y] of kids) { c.x = x; c.y = y; }
    }
  }
  const boards = body.children.filter(c => c.width > 10);
  out.boards[size] = [];
  boards.forEach((b, i) => {
    page.appendChild(b);
    b.name = NAMES[size][i]; b.clipsContent = true;
    for (const n of b.findAll(() => true)) {
      const full = Math.abs(n.width - b.width) < 2 && Math.abs(n.height - b.height) < 2;
      const fills = 'fills' in n && Array.isArray(n.fills) ? n.fills : [];
      if (full && n.name === 'Container' && fills.some(f => f.type === 'IMAGE') && n.opacity <= .2) { n.name = 'Grain (locked)'; n.locked = true; out.grain++; continue; }
      if (full && fills.some(f => f.type.startsWith('GRADIENT')) && n.type !== 'TEXT') { n.name = 'Overlay (locked)'; n.locked = true; out.overlays++; continue; }
      if (n.name === 'Image' && fills.some(f => f.type === 'IMAGE')) { n.name = 'Photo'; out.photos++; }
    }
    out.boards[size].push(b.id);
  });
  wrap.remove();
}
// layout
const X0 = 80, Y0 = 80;
for (const [i, id] of out.boards['1x1'].entries()) { const b = await figma.getNodeByIdAsync(id); b.x = X0 + i * 1160; b.y = Y0; }
await figma.loadFontAsync({family: 'Inter', style: 'Regular'});
await figma.loadFontAsync({family: 'Inter', style: 'Semi Bold'});
let copyBottom = 0; out.cards = [];
COPY.forEach((c, i) => {
  const card = figma.createAutoLayout('VERTICAL', {name: 'Copy | ' + c.title, itemSpacing: 18});
  card.paddingTop = card.paddingBottom = 40; card.paddingLeft = card.paddingRight = 44;
  card.fills = [{type: 'SOLID', color: {r: 1, g: 1, b: 1}}]; card.cornerRadius = 8;
  const t = (txt, style, size, col) => { const n = figma.createText(); n.fontName = {family: 'Inter', style}; n.fontSize = size; n.characters = txt; n.fills = [{type: 'SOLID', color: col}]; card.appendChild(n); n.layoutSizingHorizontal = 'FILL'; n.textAutoResize = 'HEIGHT'; return n; };
  const grey = {r: .45, g: .47, b: .5}, ink = {r: .1, g: .1, b: .12};
  t(c.title, 'Semi Bold', 14, grey);
  t('Headline', 'Semi Bold', 13, grey); t(c.headline, 'Semi Bold', 24, ink);
  t('Primary text', 'Semi Bold', 13, grey); t(c.primary, 'Regular', 18, ink);
  card.resize(1080, card.height); card.counterAxisSizingMode = 'FIXED'; card.primaryAxisSizingMode = 'AUTO';
  card.x = X0 + i * 1160; card.y = Y0 + 1080 + 80;
  copyBottom = Math.max(copyBottom, card.y + card.height);
  out.cards.push(card.id);
});
const y9 = copyBottom + 160;
for (const [i, id] of out.boards['9x16'].entries()) { const b = await figma.getNodeByIdAsync(id); b.x = X0 + i * 1160; b.y = y9; }
const yl = y9 + 1920 + 160;
for (const [i, id] of out.boards['landscape'].entries()) { const b = await figma.getNodeByIdAsync(id); b.x = X0 + i * 1280; b.y = yl; }
return out;
"""
print(JS.replace('%W1%', w1).replace('%W9%', w9).replace('%WL%', wl)
      .replace('%NAMES%', json.dumps(names)).replace('%COPY%', json.dumps(copy)))
