// Injected into a rendered slide. Walks the DOM and records every visual primitive
// (filled/bordered boxes, single-side rules, text blocks with styled runs, SVGs)
// with its absolute position, so build_editable.py can rebuild it as native shapes.
(async () => {
  await document.fonts.ready;
  await new Promise((r) => setTimeout(r, 300));
  const slide = document.querySelector('.slide');
  const S = slide.getBoundingClientRect();
  const out = { bg: getComputedStyle(slide).backgroundColor, items: [] };
  const box = (r) => ({ x: r.left - S.left, y: r.top - S.top, w: r.width, h: r.height });
  const px = (v) => parseFloat(v) || 0;
  const visible = (cs) => cs.display !== 'none' && cs.visibility !== 'hidden' && px(cs.opacity) > 0.02;
  const transparent = (c) => !c || c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c);

  function textOf(node, cs) {
    let t = node.textContent.replace(/\s+/g, ' ');
    if (cs.textTransform === 'uppercase') t = t.toUpperCase();
    return t;
  }
  function runs(el) {
    const rs = [];
    const walk = (n) => {
      if (n.nodeType === 3) {
        const p = n.parentElement, cs = getComputedStyle(p);
        const t = textOf(n, cs);
        if (t) rs.push({ t, color: cs.color, size: px(cs.fontSize), weight: +cs.fontWeight,
          italic: cs.fontStyle === 'italic', font: cs.fontFamily.split(',')[0].replace(/['"]/g, '').trim(),
          ls: cs.letterSpacing === 'normal' ? 0 : px(cs.letterSpacing) });
      } else if (n.nodeType === 1) {
        if (n.tagName === 'BR') { rs.push({ br: true }); return; }
        if (n.tagName === 'svg') return;
        n.childNodes.forEach(walk);
      }
    };
    el.childNodes.forEach(walk);
    // trim leading/trailing spaces across runs
    while (rs.length && !rs[0].br && !rs[0].t.trim()) rs.shift();
    if (rs.length && !rs[0].br) rs[0].t = rs[0].t.replace(/^\s+/, '');
    while (rs.length && !rs[rs.length - 1].br && !rs[rs.length - 1].t.trim()) rs.pop();
    if (rs.length && !rs[rs.length - 1].br) rs[rs.length - 1].t = rs[rs.length - 1].t.replace(/\s+$/, '');
    return rs;
  }
  const hasDirectText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());

  function visit(el) {
    if (el.classList.contains('grid') || el.classList.contains('orb')) return;
    const cs = getComputedStyle(el);
    if (!visible(cs)) return;
    const r = el.getBoundingClientRect();
    if (el.tagName === 'svg') { out.items.push({ k: 'svg', ...box(r), html: el.outerHTML }); return; }
    if (el !== slide && r.width > 0 && r.height > 0) {
      const bw = ['Top', 'Right', 'Bottom', 'Left'].map((s) => px(cs['border' + s + 'Width']));
      const bc = ['Top', 'Right', 'Bottom', 'Left'].map((s) => cs['border' + s + 'Color']);
      const allBorder = bw.every((w) => w > 0);
      const fill = transparent(cs.backgroundColor) ? null : cs.backgroundColor;
      if (fill || allBorder) {
        out.items.push({ k: 'rect', ...box(r), fill, line: allBorder ? bc[0] : null, lw: allBorder ? bw[0] : 0,
          radius: px(cs.borderTopLeftRadius) });
      }
      if (!allBorder) {
        if (bw[2] > 0 && !transparent(bc[2])) out.items.push({ k: 'line', x: r.left - S.left, y: r.bottom - S.top - bw[2] / 2, w: r.width, h: 0, color: bc[2], lw: bw[2] });
        if (bw[0] > 0 && !transparent(bc[0])) out.items.push({ k: 'line', x: r.left - S.left, y: r.top - S.top + bw[0] / 2, w: r.width, h: 0, color: bc[0], lw: bw[0] });
        if (bw[3] > 0 && !transparent(bc[3])) out.items.push({ k: 'line', x: r.left - S.left + bw[3] / 2, y: r.top - S.top, w: 0, h: r.height, color: bc[3], lw: bw[3], vertical: true });
      }
    }
    if (el.tagName === 'UL' || el.tagName === 'OL') {
      const lis = [...el.children].filter((c) => c.tagName === 'LI');
      if (lis.length) {
        const lcs = getComputedStyle(lis[0]);
        const b = box(r);
        const firstR = lis[0].getBoundingClientRect();
        out.items.push({ k: 'text', x: b.x, y: firstR.top - S.top, w: b.w, h: b.h, align: 'start',
          lh: lcs.lineHeight === 'normal' ? px(lcs.fontSize) * 1.25 : px(lcs.lineHeight),
          indent: firstR.left - r.left, gap: px(lcs.marginBottom),
          paras: lis.map((li) => runs(li)).filter((rs) => rs.length), bullet: true });
        return;
      }
    }
    const inlineOnly = [...el.children].every((c) => c.tagName === 'BR' || (c.tagName !== 'svg' && getComputedStyle(c).display.startsWith('inline')));
    if (el.textContent.trim() && (hasDirectText(el) || inlineOnly)) {
      const rs = runs(el);
      if (rs.length) {
        // content box (inside padding) so text lands where the browser put it
        const pl = px(cs.paddingLeft), pr = px(cs.paddingRight), pt = px(cs.paddingTop), pb = px(cs.paddingBottom);
        const range = document.createRange(); range.selectNodeContents(el);
        const tr = range.getBoundingClientRect();
        const b = box(r);
        const content = { x: b.x + pl, y: b.y + pt, w: b.w - pl - pr, h: b.h - pt - pb };
        // for inline elements the element box is the text box
        const isInline = cs.display.startsWith('inline');
        const tb = isInline ? box(tr) : { x: content.x, y: box(tr).y, w: content.w, h: box(tr).h };
        out.items.push({ k: 'text', ...tb, runs: rs, align: cs.textAlign, lh: cs.lineHeight === 'normal' ? px(cs.fontSize) * 1.25 : px(cs.lineHeight),
          bullet: el.tagName === 'LI', inline: isInline });
      }
      return;
    }
    [...el.children].forEach(visit);
  }
  slide.style.background = slide.style.background; // no-op, keeps slide bg
  visit(slide);
  const pre = document.createElement('pre'); pre.id = 'LAYOUT'; pre.style.display = 'none';
  pre.textContent = 'LAYOUT' + JSON.stringify(out) + 'ENDLAYOUT';
  document.body.appendChild(pre);
})();
