// Figma finishing for one captured migration page (paste into use_figma with PAGE_ID, PAGE_NAME, SET, LABELS filled).
// Strips auto layout (parents first), lifts artboards + copy cards to page level at their absolute x/y,
// deletes the capture wrapper, names artboards to the build standard, names photo frames, locks full-bleed overlays.
const page = await figma.getNodeByIdAsync(PAGE_ID);
await figma.setCurrentPageAsync(page);
const root = page.children.find(c => c.type === 'FRAME' && c.width > 2000);
const all = [root, ...root.findAll(() => true)];
const depth = n => { let d = 0, p = n; while (p.parent && p.parent.type !== 'PAGE') { d++; p = p.parent } return d };
const geo = new Map(all.map(n => [n.id, { w: n.width, h: n.height, ax: n.absoluteTransform[0][2], ay: n.absoluteTransform[1][2], d: depth(n) }]));
all.filter(n => 'layoutMode' in n && n.layoutMode !== 'NONE').sort((a, b) => geo.get(a.id).d - geo.get(b.id).d).forEach(f => { f.layoutMode = 'NONE' });
for (const n of all) {
  if (n === root) continue;
  const g = geo.get(n.id);
  if (Math.abs(n.width - g.w) > .5 || Math.abs(n.height - g.h) > .5) { try { n.resize(Math.max(g.w, .01), Math.max(g.h, .01)) } catch (e) {} }
  const ax = n.absoluteTransform[0][2], ay = n.absoluteTransform[1][2];
  if (Math.abs(ax - g.ax) > .5 || Math.abs(ay - g.ay) > .5) { n.x += g.ax - ax; n.y += g.ay - ay }
}
const body = root.children.find(c => c.name === 'Body') || root;
const items = [...body.children];
const ox = root.x, oy = root.y;
const named = [];
const col = x => Math.round((x - 80) / 1160);
const isCarousel = SET === '7';
for (const n of items) {
  const g = geo.get(n.id);
  page.appendChild(n);
  n.x = g.ax - ox; n.y = g.ay - oy;
  const w = Math.round(n.width), h = Math.round(n.height), i = col(n.x);
  if (w === 1080 && (h === 1080 || h === 1920)) {
    const lab = isCarousel ? ['7a', `Review Carousel ${String(i + 1).padStart(2, '0')}`] : LABELS[i];
    n.name = `${lab[0]} ${lab[1]} | Static | Studio Glide | ${SET_NAME} | ${h === 1080 ? '1x1' : '9x16'}`;
    n.clipsContent = true;
    n.findAll(c => 'fills' in c && Array.isArray(c.fills) && c.fills.some(p => p.type === 'IMAGE') && c.width > 200 && c.height > 150 && !/logo|studio glide/i.test(c.name)).forEach(c => { c.name = 'Photo' });
    n.children.filter(c => Math.abs(c.width - w) < 2 && Math.abs(c.height - h) < 2 && 'fills' in c && Array.isArray(c.fills) && c.fills.some(p => p.type.startsWith('GRADIENT'))).forEach(c => { c.name = 'Overlay (locked)'; c.locked = true });
    named.push(n.name);
  } else {
    const lab = isCarousel ? ['7a', `Card ${i + 1}`] : (LABELS[i] || ['?', '']);
    n.name = `Copy · ${lab[0]}`;
  }
}
root.remove();
page.name = PAGE_NAME;
return { page: page.name, artboards: named.length, items: items.length };
