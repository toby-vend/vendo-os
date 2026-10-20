// Figma finishing for landing page captures: paste into use_figma (skillNames "figma-use"), after replacing PLAN.
// For each capture wrapper: find the artboard BY WIDTH (1440 or 390) and tallest, never wrapper.children[0]:
// desktop captures put the artboard straight under the wrapper, mobile ones add a "Body" level, and lifting
// children[0] of the artboard (the header) then deleting the wrapper throws the page away (Concept, 20 Oct 2026).
// Then: load fonts, strip auto layout parents-first keeping sizes and child positions, lift to page level, name,
// lay out in a row, delete the wrapper.
const PLAN = [
  // [wrapperId, width, "Frame name", x]
  ["WRAPPER_ID", 1440, "New patient | Desktop 1440", 0],
];
const out = [];
for (const [wid, width, name, x] of PLAN) {
  const w = await figma.getNodeByIdAsync(wid);
  const cands = w.findAll(n => n.type === "FRAME" && Math.round(n.width) === width).sort((a, b) => b.height - a.height);
  const art = cands[0];
  if (!art) throw new Error(`no ${width}px artboard in ${wid}`);
  const fonts = new Map();
  for (const t of art.findAllWithCriteria({ types: ["TEXT"] })) for (const f of t.getRangeAllFontNames(0, t.characters.length)) fonts.set(f.family + "|" + f.style, f);
  for (const f of fonts.values()) await figma.loadFontAsync(f);
  const frames = [art, ...art.findAllWithCriteria({ types: ["FRAME"] })];
  const depth = n => { let d = 0; while (n !== art && n.parent) { n = n.parent; d++; } return d; };
  frames.sort((a, b) => depth(a) - depth(b));
  const sizes = new Map(frames.map(f => [f.id, [f.width, f.height]]));
  let stripped = 0;
  for (const f of frames) {
    if (f.layoutMode && f.layoutMode !== "NONE") {
      const kids = f.children.map(c => [c, c.x, c.y]);
      f.layoutMode = "NONE"; stripped++;
      for (const [c, cx, cy] of kids) { c.x = cx; c.y = cy; }
      const [sw, sh] = sizes.get(f.id); f.resize(sw, sh);
    }
  }
  figma.currentPage.appendChild(art);
  art.x = x; art.y = 0; art.name = name;
  w.remove();
  out.push({ id: art.id, name, w: art.width, h: art.height, stripped });
}
return { artboards: out };
