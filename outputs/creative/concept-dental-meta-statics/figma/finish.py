"""Generate the Figma finishing script for one persona page after the 1x1 + 9x16 captures.

Usage: python3 figma/finish.py <persona>  -> prints JS for use_figma (run on that persona's page).
Steps (order matters): strip auto layout parents-first keeping geometry; lift the 10 artboards to page level;
name them to the build standard; fix grain (TILE + OVERLAY, locked); lock overlays; name photos;
lay out 1x1 row (y=80), copy cards (Inter) below, 9x16 row below that; delete the capture wrappers.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import build  # noqa: E402

persona = sys.argv[1]
page_id = sys.argv[2] if len(sys.argv) > 2 else None

# Artboard names from the harness (data-name), in order
names1 = re.findall(r'class="ab s1" id="[^"]+" data-name="([^"]+)"', build.BUILDS[persona][0]())
names9 = re.findall(r'class="ab s9" id="[^"]+" data-name="([^"]+)"', build.BUILDS[persona][1]())

# Copy cards from copy-<persona>.md
md = (ROOT / f"copy-{persona}.md").read_text()
cards = []
for block in re.split(r"\n---\n", md):
    m = re.search(r"^## (\w+\d) \| (.+)$", block, re.M)
    if not m:
        continue
    head = re.search(r"\*\*Headline:\*\* (.+)", block).group(1).strip()
    prim = block.split("**Primary text:**", 1)[1].strip()
    prim = re.sub(r"\n{3,}", "\n\n", prim).replace("**", "")
    cards.append({"title": f"{m.group(1)} | {m.group(2)}", "headline": head, "primary": prim})

data = {"page": page_id, "names1": names1, "names9": names9, "cards": cards}

JS = r"""
const D = __DATA__;
const page = D.page ? await figma.getNodeByIdAsync(D.page) : figma.currentPage;
if (D.page) await figma.setCurrentPageAsync(page);
const wrappers = page.children.filter(n => n.type === 'FRAME' && n.width > 4000);
const all = [];
for (const w of wrappers) { all.push(w); for (const n of w.findAll(() => true)) all.push(n); }
const rec = new Map();
for (const n of all) { const t = n.absoluteTransform; rec.set(n.id, { x: t[0][2], y: t[1][2], w: n.width, h: n.height }); }
const depth = n => { let d = 0, p = n.parent; while (p && p.type !== 'PAGE') { d++; p = p.parent; } return d; };
const frames = all.filter(n => 'layoutMode' in n && n.layoutMode && n.layoutMode !== 'NONE').sort((a, b) => depth(a) - depth(b));
for (const f of frames) { const r = rec.get(f.id); f.layoutMode = 'NONE'; if (Math.abs(f.width - r.w) > .5 || Math.abs(f.height - r.h) > .5) f.resize(Math.max(r.w, .01), Math.max(r.h, .01)); }
for (const n of all.slice().sort((a, b) => depth(a) - depth(b))) {
  if (!n.parent || n.parent.type === 'PAGE') continue;
  if ('layoutPositioning' in n && n.layoutPositioning === 'ABSOLUTE') { try { n.layoutPositioning = 'AUTO'; } catch (e) {} }
  const r = rec.get(n.id), pt = n.parent.absoluteTransform;
  const nx = r.x - pt[0][2], ny = r.y - pt[1][2];
  if (Math.abs(n.x - nx) > .5 || Math.abs(n.y - ny) > .5) { n.x = nx; n.y = ny; }
  if (n.type === 'FRAME' && (Math.abs(n.width - r.w) > .5 || Math.abs(n.height - r.h) > .5)) n.resize(Math.max(r.w, .01), Math.max(r.h, .01));
}
const isBoard = n => n.type === 'FRAME' && Math.round(n.width) === 1080 && [1080, 1920].includes(Math.round(n.height)) && !(n.parent && Math.round(n.parent.width) === 1080 && Math.round(n.parent.height) === Math.round(n.height));
const boards = [];
for (const w of wrappers) for (const n of w.findAll(isBoard)) boards.push(n);
const b1 = boards.filter(b => Math.round(b.height) === 1080).sort((a, b) => rec.get(a.id).x - rec.get(b.id).x);
const b9 = boards.filter(b => Math.round(b.height) === 1920).sort((a, b) => rec.get(a.id).x - rec.get(b.id).x);
let locked = 0, photos = 0;
function tidy(b) {
  b.cornerRadius = 0; b.effects = []; b.clipsContent = true;
  for (const c of b.children) {
    const full = Math.round(c.width) === Math.round(b.width) && Math.round(c.height) === Math.round(b.height);
    const fills = ('fills' in c && Array.isArray(c.fills)) ? c.fills : [];
    if (full && fills.some(f => f.type === 'IMAGE')) {
      c.fills = fills.map(f => f.type === 'IMAGE' ? Object.assign({}, f, { scaleMode: 'TILE', scalingFactor: 0.5 }) : f);
      c.blendMode = 'OVERLAY'; c.opacity = 0.12; c.name = 'Grain (locked)'; c.locked = true; locked++;
    } else if (full && fills.some(f => f.type.startsWith('GRADIENT'))) { c.name = 'Overlay (locked)'; c.locked = true; locked++; }
  }
  for (const n of b.findAll(n => (n.type === 'FRAME' || n.type === 'RECTANGLE') && Array.isArray(n.fills) && n.fills.some(f => f.type === 'IMAGE') && !n.locked)) { n.name = 'Photo'; photos++; }
}
b1.forEach((b, i) => { page.appendChild(b); b.name = D.names1[i] || b.name; b.x = 80 + i * 1160; b.y = 80; tidy(b); });
await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
let maxH = 0; const cardIds = [];
D.cards.forEach((c, i) => {
  const f = figma.createFrame(); f.name = 'Copy | ' + c.title; page.appendChild(f);
  f.x = 80 + i * 1160; f.y = 1240; f.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]; f.cornerRadius = 16;
  const mk = (txt, size, bold, y, col) => { const t = figma.createText(); f.appendChild(t); t.fontName = { family: 'Inter', style: bold ? 'Bold' : 'Regular' }; t.fontSize = size; t.characters = txt; t.textAutoResize = 'HEIGHT'; t.resize(1000, t.height); t.x = 40; t.y = y; t.lineHeight = { unit: 'PERCENT', value: 145 }; if (col) t.fills = [{ type: 'SOLID', color: col }]; return t; };
  const grey = { r: .45, g: .42, b: .4 };
  let y = 40;
  const t1 = mk(c.title, 28, true, y); y += t1.height + 24;
  const l1 = mk('HEADLINE', 16, true, y, grey); y += l1.height + 8;
  const t2 = mk(c.headline, 26, false, y); y += t2.height + 28;
  const l2 = mk('PRIMARY TEXT', 16, true, y, grey); y += l2.height + 8;
  const t3 = mk(c.primary, 22, false, y); y += t3.height + 40;
  f.resize(1080, y); maxH = Math.max(maxH, y); cardIds.push(f.id);
});
const y9 = 1240 + maxH + 160;
b9.forEach((b, i) => { page.appendChild(b); b.name = D.names9[i] || b.name; b.x = 80 + i * 1160; b.y = y9; tidy(b); });
const left = wrappers.map(w => ({ id: w.id, kids: w.findAll(isBoard).length }));
for (const w of wrappers) if (w.findAll(isBoard).length === 0) w.remove();
return { b1: b1.length, b9: b9.length, cards: cardIds.length, locked, photos, y9, left, autoLayoutStripped: frames.length };
"""
print(JS.replace("__DATA__", json.dumps(data)))
