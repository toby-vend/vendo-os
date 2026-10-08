// Figma capture splits an inline highlight span (box-decoration-break: clone) into its own text box,
// which then overlaps the rest of the headline. Before capture, measure every headline line in the
// browser and rebuild it as absolutely positioned single-line spans, with the highlight plates drawn
// as separate rectangles behind them. Visual result is identical; capture gets clean text layers.
(async () => {
  await document.fonts.ready;
  const heads = [...document.querySelectorAll('span[style*="box-decoration-break"]')].map(s => s.parentElement);
  for (const H of heads) {
    const hr = H.getBoundingClientRect();
    const hlSpan = H.querySelector('span[style*="box-decoration-break"]');
    const cs = getComputedStyle(hlSpan);
    const hlStyle = { color: cs.color, backgroundColor: cs.backgroundColor }; // copy: computed styles go blank once the span is removed
    const plates = [...hlSpan.getClientRects()].filter(r => r.width > 1 && hlSpan.textContent.trim());
    // collect words with their line position and segment (pre / hl / post)
    const words = [];
    const walk = document.createTreeWalker(H, NodeFilter.SHOW_TEXT);
    let t;
    while ((t = walk.nextNode())) {
      const isHl = hlSpan.contains(t);
      const re = /\S+\s*/g; let m;
      while ((m = re.exec(t.data))) {
        const rg = document.createRange(); rg.setStart(t, m.index); rg.setEnd(t, m.index + m[0].trimEnd().length);
        const r = rg.getBoundingClientRect();
        words.push({ text: m[0], isHl, left: r.left, top: Math.round(r.top), h: r.height });
      }
    }
    const lines = [];
    for (const w of words) {
      let line = lines.find(l => Math.abs(l.top - w.top) < 4);
      if (!line) { line = { top: w.top, h: w.h, segs: [] }; lines.push(line); }
      const last = line.segs[line.segs.length - 1];
      if (last && last.isHl === w.isHl) last.text += w.text; else line.segs.push({ isHl: w.isHl, text: w.text, left: w.left });
    }
    const lh = parseFloat(getComputedStyle(H).lineHeight);
    const fs = parseFloat(getComputedStyle(H).fontSize);
    const height = hr.height;
    H.textContent = '';
    H.style.position = 'relative'; H.style.height = height + 'px';
    for (const p of plates) {
      const d = document.createElement('div');
      d.style.cssText = `position:absolute;left:${p.left - hr.left}px;top:${p.top - hr.top}px;width:${p.width}px;height:${p.height}px;background:${hlStyle.backgroundColor};border-radius:${0.14 * fs}px`;
      H.appendChild(d);
    }
    for (const l of lines) for (const s of l.segs) {
      const e = document.createElement('div');
      e.textContent = s.text.trimEnd();
      // the measured rect is the font's content area; centre it in a line box of the original line-height
      e.style.cssText = `position:absolute;white-space:pre;left:${s.left - hr.left}px;top:${l.top - hr.top - (lh - l.h) / 2}px;line-height:${lh}px;color:${s.isHl ? hlStyle.color : 'inherit'}`;
      H.appendChild(e);
    }
  }
  document.documentElement.dataset.flattened = '1';
})();
