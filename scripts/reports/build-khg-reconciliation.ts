/**
 * Build the Kana Health Group per-practice reconciliation workbook.
 * Sources: Kana tracker xlsx, Meta campaign export, Google Ads API exports (all in data/kana-health-group/uploads).
 * Output: outputs/reports/kana-health-group/KHG-Reconciliation-<date>.xlsx (uploaded to Google Sheets manually/via MCP).
 *
 * Run: node --import tsx/esm scripts/reports/build-khg-reconciliation.ts
 */
import ExcelJS from 'exceljs';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const UP = 'data/kana-health-group/uploads';
const OUT = `outputs/reports/kana-health-group/KHG-Reconciliation-${new Date().toISOString().slice(0, 10)}.xlsx`;

const PRACTICES = [
  { code: 'OH', name: 'Oxford House', meta: 'Oxford House Dental', gads: 'Oxford-House-Dental-Practice' },
  { code: 'MK', name: 'MK Smiles', meta: 'MK Smiles', gads: 'MK-Smiles' },
  { code: 'EB', name: 'Edward Byrne', meta: 'Edward Byrne', gads: 'Edward-Byrne' },
  { code: 'WS', name: 'Woburn Sands', meta: 'Woburn Sands', gads: 'Woburn-Sands-Dental' },
  { code: 'WH', name: 'Wilson House', meta: 'Wilson House', gads: 'Wilson-House-Dental' },
];
const MONTHS = ['2026-05', '2026-06', '2026-07', '2026-08'];
const MLABEL: Record<string, string> = { '2026-05': 'May', '2026-06': 'June', '2026-07': 'July', '2026-08': 'August' };
const TRACKER_MONTHS = ['2026-05', '2026-06', '2026-07'];

// ---------- CSV ----------
function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cur = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
function csvObjects(path: string, skip = 0): Record<string, string>[] {
  const rows = parseCsv(readFileSync(path, 'utf-8').replace(/^﻿/, '')).slice(skip).filter((r) => r.length > 1);
  const h = rows[0];
  return rows.slice(1).map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ''])));
}
const num = (v: any) => { const n = parseFloat(String(v ?? '').replace(/[,%£]/g, '')); return Number.isFinite(n) ? n : 0; };
const MONTH_IDX: Record<string, string> = { January: '01', February: '02', March: '03', April: '04', May: '05', June: '06', July: '07', August: '08', September: '09', October: '10', November: '11', December: '12' };
const ym = (label: string) => { const [m, y] = label.split(' '); return `${y}-${MONTH_IDX[m]}`; };

// ---------- Meta ----------
type MetaRow = { practice: string; month: string; campaign: string; spend: number; results: number; kind: 'Form' | 'VC'; delivery: string };
const metaFile = readdirSync(join(UP, 'meta')).find((f) => f.endsWith('.csv'))!;
const meta: MetaRow[] = csvObjects(join(UP, 'meta', metaFile)).map((r) => ({
  practice: r['Campaign name'].split('|')[1].trim(),
  month: r['Reporting starts'].slice(0, 7),
  campaign: r['Campaign name'],
  spend: num(r['Amount spent (GBP)']),
  results: num(r['Results']),
  kind: /Instant Form/.test(r['Campaign name']) ? 'Form' : 'VC',
  delivery: r['Campaign delivery'],
}));
function metaAgg(p: typeof PRACTICES[0], month: string) {
  const rows = meta.filter((r) => r.practice === p.meta && r.month === month);
  return {
    spend: rows.reduce((s, r) => s + r.spend, 0),
    form: rows.filter((r) => r.kind === 'Form').reduce((s, r) => s + r.results, 0),
    vc: rows.filter((r) => r.kind === 'VC').reduce((s, r) => s + r.results, 0),
  };
}

// ---------- Google ----------
const gdir = join(UP, 'google-ads');
const gperf: Record<string, Record<string, string>[]> = {};
const gconv: Record<string, Record<string, string>[]> = {};
for (const p of PRACTICES) {
  const pf = readdirSync(gdir).find((f) => f.startsWith(`${p.gads}-Campaign-Performance-by-Month-2025`))!;
  const cf = readdirSync(gdir).find((f) => f.startsWith(`${p.gads}-Conversion-Actions-by-Month-2025`))!;
  gperf[p.code] = csvObjects(join(gdir, pf));
  gconv[p.code] = csvObjects(join(gdir, cf));
}
// Call-tracking-number actions duplicate click-to-call; exclude from the de-duplicated lead count.
const isDuplicateAction = (a: string) => /\(\d|GFN|GHL|Website Call|Phone no click/i.test(a);
function gadsAgg(p: typeof PRACTICES[0], month: string) {
  const perf = gperf[p.code].filter((r) => ym(r.Month) === month);
  const conv = gconv[p.code].filter((r) => ym(r.Month) === month);
  const byAction: Record<string, number> = {};
  for (const r of conv) byAction[r['Conversion action']] = (byAction[r['Conversion action']] ?? 0) + num(r.Conversions);
  const leads = Object.entries(byAction).filter(([a]) => !isDuplicateAction(a)).reduce((s, [, v]) => s + v, 0);
  return {
    spend: perf.reduce((s, r) => s + num(r.Cost), 0),
    clicks: perf.reduce((s, r) => s + num(r.Clicks), 0),
    conversions: perf.reduce((s, r) => s + num(r.Conversions), 0),
    leads, byAction,
  };
}

// ---------- Tracker ----------
const trackerFile = readdirSync(UP).find((f) => f.endsWith('.xlsx'))!;
const cellVal = (c: any): any => {
  if (c == null) return null;
  if (c instanceof Date) return c.toISOString().slice(0, 10);
  if (typeof c === 'object') { if (c.result !== undefined) return c.result; if (c.richText) return c.richText.map((t: any) => t.text).join(''); if (c.text) return typeof c.text === 'string' ? c.text : (c.text.richText ?? []).map((t: any) => t.text).join(''); return null; }
  return c;
};
type Patient = { code: string; month: string; name: string; revenue: number; type: string; platform: string; channel: string; comment: string };
const patients: Patient[] = [];
const tracker: Record<string, Record<string, { gSpend: number; mSpend: number; gRev: number; mRev: number }>> = {};
const boxly: Record<string, Record<string, { gForms: number; mForms: number; mGhost: number; mLostFarm: number; mConverted: number }>> = {};
const MONTH_NAME: Record<string, string> = { May: '2026-05', June: '2026-06', July: '2026-07', August: '2026-08' };

async function loadTracker() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(join(UP, trackerFile));
  const sheet = (code: string, suffix: string) => wb.worksheets.find((w) => w.name.replace(/\s/g, '').startsWith(`${code}-${suffix}`))!;
  for (const p of PRACTICES) {
    const t = sheet(p.code, 'Totals');
    const row = (label: string) => { let found: any[] = []; t.eachRow((r) => { const v = r.values as any[]; if (String(cellVal(v[5])).trim() === label) found = v; }); return found; };
    const gS = row('Google Spend'), mS = row('Meta Spend'), gR = row('Google Revenue'), mR = row('Meta Revenue');
    tracker[p.code] = {};
    TRACKER_MONTHS.forEach((m, i) => {
      tracker[p.code][m] = { gSpend: num(cellVal(gS[6 + i])), mSpend: num(cellVal(mS[6 + i])), gRev: num(cellVal(gR[6 + i])), mRev: num(cellVal(mR[6 + i])) };
    });
    const ps = sheet(p.code, 'Patients');
    ps.eachRow((r, i) => {
      if (i === 1) return; const v = (r.values as any[]).map(cellVal);
      if (!v[1] || !v[2] || !MONTH_NAME[String(v[1]).trim()]) return;
      patients.push({ code: p.code, month: MONTH_NAME[String(v[1]).trim()], name: String(v[2]), revenue: num(v[3]), type: String(v[4] ?? ''), platform: String(v[5] ?? '').trim(), channel: String(v[6] ?? ''), comment: v[8] ? String(v[8]) : '' });
    });
    boxly[p.code] = {};
    for (const [suffix, key] of [['G-Forms', 'g'], ['M-Forms', 'm']] as const) {
      const ws = wb.worksheets.find((w) => w.name.replace(/\s/g, '').startsWith(`${p.code}-${suffix}`));
      if (!ws) continue;
      ws.eachRow((r, i) => {
        if (i === 1) return; const v = (r.values as any[]).map(cellVal);
        const d = String(v[1] ?? ''); if (!/^\d{4}-\d{2}/.test(d) || !v[2]) return;
        const m = d.slice(0, 7); const b = (boxly[p.code][m] ??= { gForms: 0, mForms: 0, mGhost: 0, mLostFarm: 0, mConverted: 0 });
        const stage = String(v[6] ?? '');
        if (key === 'g') b.gForms++; else { b.mForms++; if (/ghost/i.test(stage)) b.mGhost++; if (/lost sale/i.test(stage)) b.mLostFarm++; if (/^converted/i.test(stage)) b.mConverted++; }
      });
    }
  }
}

// ---------- Workbook ----------
const GBP = '£#,##0.00;[Red]-£#,##0.00';
const GBP0 = '£#,##0;[Red]-£#,##0';
const X = '0.00"x"';
const PCT = '0.0%';
const HEAD = { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3A5F' } } as ExcelJS.Fill };
const SUB = { font: { bold: true }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF5' } } as ExcelJS.Fill };
const WARN = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF4CE' } } as ExcelJS.Fill;
const BAD = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0E0' } } as ExcelJS.Fill;

function header(ws: ExcelJS.Worksheet, row: number, cols: string[]) {
  const r = ws.getRow(row); cols.forEach((c, i) => { const cell = r.getCell(i + 1); cell.value = c; cell.font = HEAD.font; cell.fill = HEAD.fill; cell.alignment = { wrapText: true, vertical: 'middle' }; });
  r.height = 32;
}
const colRef = (n: number) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

async function main() {
  await loadTracker();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Vendo Digital';

  // ===== 1. Summary (May–Jul, tracker period) =====
  const s = wb.addWorksheet('Summary');
  s.getCell('A1').value = 'Kana Health Group × Vendo — per-practice reconciliation'; s.getCell('A1').font = { bold: true, size: 14 };
  s.getCell('A2').value = `Tracker period May–July 2026 (Kana revenue available). August ad data included on the Monthly tab, awaiting Kana revenue. Built ${new Date().toISOString().slice(0, 10)} from the Kana tracking sheet, Meta Ads Manager export and Google Ads API.`;
  s.getCell('A3').value = 'Meta leads = Instant Form leads + View Content results. Google leads = click-to-call + lead forms + calls from ads (call-tracking-number actions excluded as they duplicate click-to-call). Return = revenue ÷ ad spend, before Vendo fees.';
  s.getCell('A2').font = { italic: true, color: { argb: 'FF555555' } }; s.getCell('A3').font = { italic: true, color: { argb: 'FF555555' } };
  const sCols = ['Practice', 'Google spend', 'Google leads', 'Google CPL', 'Google patients', 'Google revenue', 'Google CAC', 'Google return',
    'Meta spend', 'Meta leads (Form + VC)', 'Meta CPL', 'Meta patients', 'Meta revenue', 'Meta CAC', 'Meta return',
    'Total spend', 'Total leads', 'Total patients', 'Lead → patient', 'Total revenue', 'Blended CAC', 'Blended return'];
  header(s, 5, sCols);
  let r = 6; const first = r;
  for (const p of PRACTICES) {
    let gSpend = 0, gLeads = 0, mSpend = 0, mLeads = 0;
    for (const m of TRACKER_MONTHS) { const g = gadsAgg(p, m); const me = metaAgg(p, m); gSpend += g.spend; gLeads += g.leads; mSpend += me.spend; mLeads += me.form + me.vc; }
    const pats = patients.filter((x) => x.code === p.code && TRACKER_MONTHS.includes(x.month));
    const gP = pats.filter((x) => /google/i.test(x.platform)); const mP = pats.filter((x) => /meta/i.test(x.platform));
    const gRev = TRACKER_MONTHS.reduce((a, m) => a + tracker[p.code][m].gRev, 0); const mRev = TRACKER_MONTHS.reduce((a, m) => a + tracker[p.code][m].mRev, 0);
    const row = s.getRow(r);
    row.values = [p.name, gSpend, gLeads, { formula: `IFERROR(B${r}/C${r},0)` }, gP.length, gRev, { formula: `IFERROR(B${r}/E${r},0)` }, { formula: `IFERROR(F${r}/B${r},0)` },
      mSpend, mLeads, { formula: `IFERROR(I${r}/J${r},0)` }, mP.length, mRev, { formula: `IFERROR(I${r}/L${r},0)` }, { formula: `IFERROR(M${r}/I${r},0)` },
      { formula: `B${r}+I${r}` }, { formula: `C${r}+J${r}` }, { formula: `E${r}+L${r}` }, { formula: `IFERROR(R${r}/Q${r},0)` }, { formula: `F${r}+M${r}` }, { formula: `IFERROR(P${r}/R${r},0)` }, { formula: `IFERROR(T${r}/P${r},0)` }];
    r++;
  }
  const last = r - 1; const tr = s.getRow(r);
  tr.values = ['Group', { formula: `SUM(B${first}:B${last})` }, { formula: `SUM(C${first}:C${last})` }, { formula: `IFERROR(B${r}/C${r},0)` }, { formula: `SUM(E${first}:E${last})` }, { formula: `SUM(F${first}:F${last})` }, { formula: `IFERROR(B${r}/E${r},0)` }, { formula: `IFERROR(F${r}/B${r},0)` },
    { formula: `SUM(I${first}:I${last})` }, { formula: `SUM(J${first}:J${last})` }, { formula: `IFERROR(I${r}/J${r},0)` }, { formula: `SUM(L${first}:L${last})` }, { formula: `SUM(M${first}:M${last})` }, { formula: `IFERROR(I${r}/L${r},0)` }, { formula: `IFERROR(M${r}/I${r},0)` },
    { formula: `B${r}+I${r}` }, { formula: `C${r}+J${r}` }, { formula: `E${r}+L${r}` }, { formula: `IFERROR(R${r}/Q${r},0)` }, { formula: `F${r}+M${r}` }, { formula: `IFERROR(P${r}/R${r},0)` }, { formula: `IFERROR(T${r}/P${r},0)` }];
  tr.eachCell((c) => { c.font = SUB.font; c.fill = SUB.fill; });
  for (let i = first; i <= r; i++) {
    const row = s.getRow(i);
    [2, 4, 6, 7, 9, 11, 13, 14, 16, 20, 21].forEach((c) => (row.getCell(c).numFmt = GBP0));
    [8, 15, 22].forEach((c) => (row.getCell(c).numFmt = X));
    row.getCell(19).numFmt = PCT;
  }
  s.columns.forEach((c, i) => (c.width = i === 0 ? 16 : 12));
  s.views = [{ state: 'frozen', xSplit: 1, ySplit: 5 }];


  // ===== helper: monthly stats block (Google / Meta / Blended) =====
  const BLOCK_COLS = ['Month',
    'Google spend', 'Google leads', 'Google CPL', 'Google patients', 'Google lead → patient', 'Google CAC', 'Google revenue', 'Google return',
    'Meta spend', 'Meta leads (Form + VC)', 'Meta CPL', 'Meta patients', 'Meta lead → patient', 'Meta CAC', 'Meta revenue', 'Meta return',
    'Total spend', 'Total leads', 'Blended CPL', 'Total patients', 'Lead → patient', 'Blended CAC', 'Total revenue', 'Blended return'];
  type MonthStat = { label: string; gSpend: number; gLeads: number; gPat: number | null; gRev: number | null; mSpend: number; mLeads: number; mPat: number | null; mRev: number | null };
  function statsFor(p: typeof PRACTICES[0], m: string): MonthStat {
    const g = gadsAgg(p, m), me = metaAgg(p, m), t = tracker[p.code][m];
    const pats = patients.filter((x) => x.code === p.code && x.month === m);
    return { label: MLABEL[m], gSpend: g.spend, gLeads: g.leads, gPat: t ? pats.filter((x) => /google/i.test(x.platform)).length : null, gRev: t ? t.gRev : null,
      mSpend: me.spend, mLeads: me.form + me.vc, mPat: t ? pats.filter((x) => /meta/i.test(x.platform)).length : null, mRev: t ? t.mRev : null };
  }
  function writeBlock(ws: ExcelJS.Worksheet, startRow: number, title: string, stats: MonthStat[], totalLabel = 'Total (May–Jul, where Kana revenue exists)') {
    ws.getCell(`A${startRow}`).value = title; ws.getCell(`A${startRow}`).font = { bold: true, size: 12 };
    header(ws, startRow + 1, BLOCK_COLS);
    let r = startRow + 2; const first = r;
    const fmt = (row: ExcelJS.Row) => {
      [2, 4, 7, 8, 10, 12, 15, 16, 18, 20, 23, 24].forEach((c) => (row.getCell(c).numFmt = GBP0));
      [9, 17, 25].forEach((c) => (row.getCell(c).numFmt = X));
      [6, 14, 22].forEach((c) => (row.getCell(c).numFmt = PCT));
    };
    for (const st of stats) {
      const row = ws.getRow(r); const hasT = st.gPat !== null;
      row.values = [st.label,
        st.gSpend, st.gLeads, { formula: `IFERROR(B${r}/C${r},0)` }, st.gPat, hasT ? { formula: `IFERROR(E${r}/C${r},0)` } : null, hasT ? { formula: `IFERROR(B${r}/E${r},0)` } : null, st.gRev, hasT ? { formula: `IFERROR(H${r}/B${r},0)` } : null,
        st.mSpend, st.mLeads, { formula: `IFERROR(J${r}/K${r},0)` }, st.mPat, hasT ? { formula: `IFERROR(M${r}/K${r},0)` } : null, hasT ? { formula: `IFERROR(J${r}/M${r},0)` } : null, st.mRev, hasT ? { formula: `IFERROR(P${r}/J${r},0)` } : null,
        { formula: `B${r}+J${r}` }, { formula: `C${r}+K${r}` }, { formula: `IFERROR(R${r}/S${r},0)` }, hasT ? { formula: `E${r}+M${r}` } : null, hasT ? { formula: `IFERROR(U${r}/S${r},0)` } : null, hasT ? { formula: `IFERROR(R${r}/U${r},0)` } : null, hasT ? { formula: `H${r}+P${r}` } : null, hasT ? { formula: `IFERROR(X${r}/R${r},0)` } : null];
      fmt(row);
      if (!hasT) { row.getCell(1).value = `${st.label} (awaiting Kana revenue)`; row.getCell(1).fill = WARN; }
      r++;
    }
    // Total row: spend/leads over the tracker months only so ratios stay like-for-like
    const tRows = stats.map((st, i) => ({ st, row: first + i })).filter((x) => x.st.gPat !== null).map((x) => x.row);
    const sum = (col: string) => ({ formula: tRows.length ? `SUM(${tRows.map((rr) => `${col}${rr}`).join(',')})` : '0' });
    const tr = ws.getRow(r);
    tr.values = [totalLabel,
      sum('B'), sum('C'), { formula: `IFERROR(B${r}/C${r},0)` }, sum('E'), { formula: `IFERROR(E${r}/C${r},0)` }, { formula: `IFERROR(B${r}/E${r},0)` }, sum('H'), { formula: `IFERROR(H${r}/B${r},0)` },
      sum('J'), sum('K'), { formula: `IFERROR(J${r}/K${r},0)` }, sum('M'), { formula: `IFERROR(M${r}/K${r},0)` }, { formula: `IFERROR(J${r}/M${r},0)` }, sum('P'), { formula: `IFERROR(P${r}/J${r},0)` },
      { formula: `B${r}+J${r}` }, { formula: `C${r}+K${r}` }, { formula: `IFERROR(R${r}/S${r},0)` }, { formula: `E${r}+M${r}` }, { formula: `IFERROR(U${r}/S${r},0)` }, { formula: `IFERROR(R${r}/U${r},0)` }, { formula: `H${r}+P${r}` }, { formula: `IFERROR(X${r}/R${r},0)` }];
    fmt(tr); tr.eachCell((c) => { c.font = SUB.font; c.fill = SUB.fill; });
    return r + 2;
  }

  // ===== 2. By practice — monthly stats per practice =====
  const bp = wb.addWorksheet('By practice');
  bp.getCell('A1').value = 'Monthly stats per practice — spend, leads, patients, lead → patient, CAC, return. Google and Meta split, then blended.'; bp.getCell('A1').font = { italic: true, color: { argb: 'FF555555' } };
  let br = 3;
  for (const p of PRACTICES) br = writeBlock(bp, br, p.name, MONTHS.map((m) => statsFor(p, m)));
  bp.columns.forEach((c, i) => (c.width = i === 0 ? 30 : 11));
  bp.views = [{ state: 'frozen', xSplit: 1 }];

  // ===== 3. Group blended — all practices combined, per month =====
  const gb = wb.addWorksheet('Group blended');
  gb.getCell('A1').value = 'All five practices combined, per month, then the May–July total. August ad data is in but Kana revenue and patients are not yet entered.'; gb.getCell('A1').font = { italic: true, color: { argb: 'FF555555' } };
  const groupStats: MonthStat[] = MONTHS.map((m) => {
    const parts = PRACTICES.map((p) => statsFor(p, m)); const hasT = parts[0].gPat !== null;
    const add = (k: keyof MonthStat) => parts.reduce((a, x) => a + (Number(x[k]) || 0), 0);
    return { label: MLABEL[m], gSpend: add('gSpend'), gLeads: add('gLeads'), gPat: hasT ? add('gPat') : null, gRev: hasT ? add('gRev') : null, mSpend: add('mSpend'), mLeads: add('mLeads'), mPat: hasT ? add('mPat') : null, mRev: hasT ? add('mRev') : null };
  });
  let gr = writeBlock(gb, 3, 'Kana Health Group — all practices', groupStats);
  // Per-practice May–Jul totals side by side
  gb.getCell(`A${gr}`).value = 'By practice, May–July'; gb.getCell(`A${gr}`).font = { bold: true, size: 12 };
  header(gb, gr + 1, ['Practice', ...BLOCK_COLS.slice(1)]);
  let pr = gr + 2;
  for (const p of PRACTICES) {
    const parts = TRACKER_MONTHS.map((m) => statsFor(p, m)); const add = (k: keyof MonthStat) => parts.reduce((a, x) => a + (Number(x[k]) || 0), 0);
    const row = gb.getRow(pr); const r = pr;
    row.values = [p.name, add('gSpend'), add('gLeads'), { formula: `IFERROR(B${r}/C${r},0)` }, add('gPat'), { formula: `IFERROR(E${r}/C${r},0)` }, { formula: `IFERROR(B${r}/E${r},0)` }, add('gRev'), { formula: `IFERROR(H${r}/B${r},0)` },
      add('mSpend'), add('mLeads'), { formula: `IFERROR(J${r}/K${r},0)` }, add('mPat'), { formula: `IFERROR(M${r}/K${r},0)` }, { formula: `IFERROR(J${r}/M${r},0)` }, add('mRev'), { formula: `IFERROR(P${r}/J${r},0)` },
      { formula: `B${r}+J${r}` }, { formula: `C${r}+K${r}` }, { formula: `IFERROR(R${r}/S${r},0)` }, { formula: `E${r}+M${r}` }, { formula: `IFERROR(U${r}/S${r},0)` }, { formula: `IFERROR(R${r}/U${r},0)` }, { formula: `H${r}+P${r}` }, { formula: `IFERROR(X${r}/R${r},0)` }];
    [2, 4, 7, 8, 10, 12, 15, 16, 18, 20, 23, 24].forEach((c) => (row.getCell(c).numFmt = GBP0)); [9, 17, 25].forEach((c) => (row.getCell(c).numFmt = X)); [6, 14, 22].forEach((c) => (row.getCell(c).numFmt = PCT));
    pr++;
  }
  gb.columns.forEach((c, i) => (c.width = i === 0 ? 34 : 11));
  gb.views = [{ state: 'frozen', xSplit: 1 }];

  // ===== 4. Reconciliation detail =====
  const mo = wb.addWorksheet('Reconciliation detail');
  const moCols = ['Practice', 'Month', 'Google spend (API)', 'Google spend (tracker)', 'Google Δ', 'Google conversions (raw)', 'Google leads (dedup)', 'Google CPL', 'Boxly Google form leads', 'Google patients', 'Google revenue', 'Google CAC', 'Google return',
    'Meta spend (export)', 'Meta spend (tracker)', 'Meta Δ', 'Meta form leads', 'Meta VC leads', 'Meta leads (total)', 'Meta CPL', 'Boxly Meta form leads', 'Boxly Ghost', 'Boxly Lost Sale (Farm)', 'Boxly Converted', 'Meta patients', 'Meta revenue', 'Meta CAC', 'Meta return',
    'Total spend', 'Total leads', 'Total patients', 'Total revenue', 'Blended CAC', 'Blended return'];
  header(mo, 1, moCols);
  r = 2;
  for (const p of PRACTICES) for (const m of MONTHS) {
    const g = gadsAgg(p, m), me = metaAgg(p, m), t = tracker[p.code][m], b = boxly[p.code][m];
    const pats = patients.filter((x) => x.code === p.code && x.month === m);
    const gP = pats.filter((x) => /google/i.test(x.platform)).length, mP = pats.filter((x) => /meta/i.test(x.platform)).length;
    const hasT = !!t;
    const row = mo.getRow(r);
    row.values = [p.name, MLABEL[m], g.spend, hasT ? t.gSpend : null, hasT ? { formula: `C${r}-D${r}` } : null, g.conversions, g.leads, { formula: `IFERROR(C${r}/G${r},0)` }, b?.gForms ?? null, hasT ? gP : null, hasT ? t.gRev : null, hasT ? { formula: `IFERROR(C${r}/J${r},0)` } : null, hasT ? { formula: `IFERROR(K${r}/C${r},0)` } : null,
      me.spend, hasT ? t.mSpend : null, hasT ? { formula: `N${r}-O${r}` } : null, me.form, me.vc, { formula: `Q${r}+R${r}` }, { formula: `IFERROR(N${r}/S${r},0)` }, b?.mForms ?? null, b?.mGhost ?? null, b?.mLostFarm ?? null, b?.mConverted ?? null, hasT ? mP : null, hasT ? t.mRev : null, hasT ? { formula: `IFERROR(N${r}/Y${r},0)` } : null, hasT ? { formula: `IFERROR(Z${r}/N${r},0)` } : null,
      { formula: `C${r}+N${r}` }, { formula: `G${r}+S${r}` }, hasT ? { formula: `J${r}+Y${r}` } : null, hasT ? { formula: `K${r}+Z${r}` } : null, hasT ? { formula: `IFERROR(AC${r}/AE${r},0)` } : null, hasT ? { formula: `IFERROR(AF${r}/AC${r},0)` } : null];
    [3, 4, 5, 8, 11, 12, 14, 15, 16, 20, 26, 27, 29, 32, 33].forEach((c) => (row.getCell(c).numFmt = GBP));
    [13, 28, 34].forEach((c) => (row.getCell(c).numFmt = X));
    if (hasT && Math.abs(g.spend - t.gSpend) > 1) row.getCell(5).fill = WARN;
    if (hasT && Math.abs(me.spend - t.mSpend) > 1) row.getCell(16).fill = WARN;
    if (!hasT) row.getCell(2).fill = WARN;
    r++;
  }
  mo.columns.forEach((c, i) => (c.width = i === 0 ? 14 : i === 1 ? 9 : 11));
  mo.views = [{ state: 'frozen', xSplit: 2, ySplit: 1 }];
  mo.autoFilter = { from: 'A1', to: `${colRef(moCols.length)}1` };

  // ===== 3. Google conversion actions =====
  const ga = wb.addWorksheet('Google actions');
  header(ga, 1, ['Practice', 'Month', 'Conversion action', 'Conversions', 'Counted as lead?', 'Note']);
  r = 2;
  for (const p of PRACTICES) for (const m of MONTHS) {
    const g = gadsAgg(p, m);
    for (const [a, v] of Object.entries(g.byAction).sort()) {
      ga.getRow(r).values = [p.name, MLABEL[m], a, v, isDuplicateAction(a) ? 'No' : 'Yes', isDuplicateAction(a) ? 'Call-tracking number; duplicates click-to-call' : ''];
      if (isDuplicateAction(a)) ga.getRow(r).getCell(5).fill = WARN;
      r++;
    }
  }
  ga.columns = [{ width: 14 }, { width: 9 }, { width: 44 }, { width: 12 }, { width: 14 }, { width: 44 }];
  ga.views = [{ state: 'frozen', ySplit: 1 }]; ga.autoFilter = { from: 'A1', to: 'F1' };

  // ===== 4. Meta campaigns =====
  const mc = wb.addWorksheet('Meta campaigns');
  header(mc, 1, ['Practice', 'Month', 'Campaign', 'Type', 'Delivery', 'Spend', 'Results', 'Counted as leads', 'CPR']);
  r = 2;
  for (const row of meta.filter((x) => MONTHS.includes(x.month)).sort((a, b) => a.practice.localeCompare(b.practice) || a.month.localeCompare(b.month) || b.spend - a.spend)) {
    if (row.spend === 0) continue;
    const p = PRACTICES.find((x) => x.meta === row.practice)!;
    mc.getRow(r).values = [p.name, MLABEL[row.month], row.campaign, row.kind === 'Form' ? 'Instant Form' : 'View Content', row.delivery, row.spend, row.results, 'Yes', { formula: `IFERROR(F${r}/G${r},0)` }];
    mc.getRow(r).getCell(6).numFmt = GBP; mc.getRow(r).getCell(9).numFmt = GBP; r++;
  }
  mc.columns = [{ width: 14 }, { width: 9 }, { width: 48 }, { width: 13 }, { width: 10 }, { width: 11 }, { width: 9 }, { width: 14 }, { width: 10 }];
  mc.views = [{ state: 'frozen', ySplit: 1 }]; mc.autoFilter = { from: 'A1', to: 'I1' };

  // ===== 5. Patients =====
  const pt = wb.addWorksheet('Patients');
  header(pt, 1, ['Practice', 'Month', 'Name / number', 'Revenue', 'Campaign type', 'Platform', 'Form / phone', 'Kana comment']);
  r = 2;
  for (const x of patients.sort((a, b) => a.code.localeCompare(b.code) || a.month.localeCompare(b.month) || b.revenue - a.revenue)) {
    const p = PRACTICES.find((y) => y.code === x.code)!;
    pt.getRow(r).values = [p.name, MLABEL[x.month], x.name, x.revenue, x.type, x.platform, x.channel, x.comment];
    pt.getRow(r).getCell(4).numFmt = GBP; r++;
  }
  pt.columns = [{ width: 14 }, { width: 9 }, { width: 24 }, { width: 11 }, { width: 22 }, { width: 9 }, { width: 11 }, { width: 60 }];
  pt.views = [{ state: 'frozen', ySplit: 1 }]; pt.autoFilter = { from: 'A1', to: 'H1' };


  // ===== Strategy =====
  const st = wb.addWorksheet('Strategy');
  st.columns = [{ width: 18 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 70 }];
  let sr = 1;
  const title = (t: string) => { st.getCell(`A${sr}`).value = t; st.getCell(`A${sr}`).font = { bold: true, size: 13 }; sr += 1; };
  const para = (t: string) => { st.getCell(`A${sr}`).value = t; st.mergeCells(`A${sr}:H${sr}`); st.getCell(`A${sr}`).alignment = { wrapText: true, vertical: 'top' }; st.getRow(sr).height = Math.max(18, Math.ceil(t.length / 150) * 16); sr += 1; };
  const gap = () => { sr += 1; };

  title('1. Where each practice stands (May–July, Kana revenue)');
  const verdicts: [string, string][] = [
    ['Oxford House', '4.3x blended. Google 4.1x, Meta 5.1x. Carries 62% of group revenue on 33% of spend. Implant patients drive the big tickets (£7,930, £6,365, £2,750). Watch-outs: Google CPC has doubled since November (£3.50 → £7.50) and Emergency Dentist search is paused; Meta July revenue fell to £456 on 46 leads while August Meta spend was scaled to £2,300 — that scale-up needs August revenue to justify it.'],
    ['MK Smiles', '2.4x blended, but the channels are opposite: Google 1.1x (22 patients, avg £368 each) vs Meta 7.9x (8 patients, three of them £3k–£5.7k in July). Google produces plenty of cheap leads (£40 CPL, 11% lead → patient) that turn into low-value general/emergency patients. Value comes from Ortho and Smile Makeover.'],
    ['Edward Byrne', '0.97x blended (the tracker shows 1.31x because its May column is excluded). Lead volume is healthy on both channels (Google £27 CPA, Meta £23 CPL) and lead → patient is ~10%, but most patients are £85 new-patient assessments. The one Invisalign patient (£3,085) came from the Clear Aligners search campaign, which is now paused. Six Boxly leads sit at "Consultation Booked". August spend jumped to £3,100 (Meta doubled into View Content) before any of this was proven.'],
    ['Woburn Sands', '1.0x blended, but Google is 0.1x (£3,145 → 5 patients, £326) while Meta is 2.5x (£1,834 → 8 patients, £4,577). August moved the wrong way: Meta was cut to £369. Google leads convert at 6% and the website-sourced calls outnumber ad calls, so the search budget is largely paying for existing-patient traffic.'],
    ['Wilson House', '0.07x. £4,850 for 3 patients and £325. 109 Meta leads → 2 patients; 48 of 73 Boxly Meta leads are Ghost and 20 Lost Sale. This is a practice-side follow-up problem, not a lead-volume problem. Meta lead forms are already off; Google is still running £800–£1,000 a month for one patient.'],
  ];
  header(st, sr, ['Practice', '', '', '', '', '', '', 'Verdict']); st.mergeCells(`B${sr}:G${sr}`); sr++;
  for (const [pr, v] of verdicts) { st.getCell(`A${sr}`).value = pr; st.getCell(`A${sr}`).font = { bold: true }; st.mergeCells(`B${sr}:H${sr}`); st.getCell(`B${sr}`).value = v; st.getCell(`B${sr}`).alignment = { wrapText: true, vertical: 'top' }; st.getRow(sr).height = 64; sr++; }
  gap();

  title('2. September budget proposal — shift spend to where the return is proven');
  para('Current = August actual spend. Proposed keeps the group total roughly flat and moves money from sub-1x channels to channels with a proven May–July return. Expected revenue uses each channel\'s own May–July return, capped at 4x where a single month or patient inflates it (MK Meta), so the estimate is deliberately conservative. Edit the Proposed columns and the sheet recalculates.');
  const bh = sr; header(st, sr, ['Practice', 'Google Aug actual', 'Google proposed', 'Meta Aug actual', 'Meta proposed', 'May–Jul Google return', 'May–Jul Meta return', 'Rationale']); sr++;
  const proposal: Record<string, { g: number; m: number; why: string }> = {
    OH: { g: 3200, m: 2000, why: 'Re-enable Emergency Dentist search (+£300; historically 105 calls, highest-intent query). Hold Meta at ~£2,000 rather than the August £2,300 until August revenue confirms the View Content scale-up. Keep Implant VC — it produces the largest tickets.' },
    MK: { g: 2000, m: 1600, why: 'Trim General Dentistry search and PMax by ~£600; keep Ortho search intact. Move it to Meta (Smile Makeover and General VC), which returned 7.9x on £1,850. Even at a conservative 4x this is the best marginal pound in the group.' },
    EB: { g: 1500, m: 800, why: 'Pull August back to the May–July run-rate until August revenue is in. Re-enable Clear Aligners search at £150–£200 (it produced the £3,085 Invisalign patient). Chase the six "Consultation Booked" Boxly leads — converting two at typical values would flip EB above 1x.' },
    WS: { g: 450, m: 900, why: 'Google is 0.1x: cut to PMax plus Emergency only and drop General Dentistry search. Restore Meta to £900 — it was the only channel producing revenue here (2.5x) and was cut in August.' },
    WH: { g: 450, m: 300, why: 'Reduce to a floor (PMax + brand/emergency) until the practice fixes follow-up. Run only the £10/day Statics test on Meta. Re-invest once Boxly shows leads being contacted within the hour and Ghost drops below 30%. The £800/month saved goes to MK and WS Meta.' },
  };
  const augS = (p: typeof PRACTICES[0]) => ({ g: gadsAgg(p, '2026-08').spend, m: metaAgg(p, '2026-08').spend });
  const ret = (p: typeof PRACTICES[0]) => { let gS = 0, gR = 0, mS = 0, mR = 0; for (const m of TRACKER_MONTHS) { gS += gadsAgg(p, m).spend; gR += tracker[p.code][m].gRev; mS += metaAgg(p, m).spend; mR += tracker[p.code][m].mRev; } return { g: gS ? gR / gS : 0, m: mS ? mR / mS : 0 }; };
  const firstB = sr;
  for (const p of PRACTICES) {
    const a = augS(p), rt = ret(p), pr = proposal[p.code]; const row = st.getRow(sr);
    row.values = [p.name, a.g, pr.g, a.m, pr.m, rt.g, rt.m, pr.why];
    [2, 3, 4, 5].forEach((c) => (row.getCell(c).numFmt = GBP0)); [6, 7].forEach((c) => (row.getCell(c).numFmt = X));
    row.getCell(8).alignment = { wrapText: true, vertical: 'top' }; row.height = 78; [3, 5].forEach((c) => (row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F4EA' } }));
    sr++;
  }
  const lastB = sr - 1; const tot = st.getRow(sr);
  tot.values = ['Group', { formula: `SUM(B${firstB}:B${lastB})` }, { formula: `SUM(C${firstB}:C${lastB})` }, { formula: `SUM(D${firstB}:D${lastB})` }, { formula: `SUM(E${firstB}:E${lastB})` }, '', '', 'Total moves from ~£14,100 to ~£13,200; the ~£900 difference is held back as headroom for Oxford House Meta once August revenue is confirmed.'];
  [2, 3, 4, 5].forEach((c) => (tot.getCell(c).numFmt = GBP0)); tot.eachCell((c) => { c.font = SUB.font; c.fill = SUB.fill; }); tot.getCell(8).alignment = { wrapText: true }; tot.height = 34; sr++;
  gap();
  st.getCell(`A${sr}`).value = 'Expected monthly revenue at proposed spend (conservative)'; st.getCell(`A${sr}`).font = { bold: true }; sr++;
  header(st, sr, ['Practice', 'Current spend', 'Expected rev (current mix)', 'Proposed spend', 'Expected rev (proposed mix)', 'Uplift', '', 'Basis']); sr++;
  const firstE = sr;
  for (let i = 0; i < PRACTICES.length; i++) {
    const r = firstB + i; const row = st.getRow(sr);
    row.values = [PRACTICES[i].name, { formula: `B${r}+D${r}` }, { formula: `B${r}*MIN(F${r},4)+D${r}*MIN(G${r},4)` }, { formula: `C${r}+E${r}` }, { formula: `C${r}*MIN(F${r},4)+E${r}*MIN(G${r},4)` }, { formula: `E${sr}-C${sr}` }, '', 'Spend × May–Jul channel return, capped at 4x. Does not include the effect of re-enabled campaigns or conversion fixes.'];
    [2, 3, 4, 5, 6].forEach((c) => (row.getCell(c).numFmt = GBP0)); sr++;
  }
  const te = st.getRow(sr); te.values = ['Group', { formula: `SUM(B${firstE}:B${sr - 1})` }, { formula: `SUM(C${firstE}:C${sr - 1})` }, { formula: `SUM(D${firstE}:D${sr - 1})` }, { formula: `SUM(E${firstE}:E${sr - 1})` }, { formula: `E${sr}-C${sr}` }, '', { formula: `"Blended return moves from "&TEXT(C${sr}/B${sr},"0.00")&"x to "&TEXT(E${sr}/D${sr},"0.00")&"x on the same money"` }];
  [2, 3, 4, 5, 6].forEach((c) => (te.getCell(c).numFmt = GBP0)); te.eachCell((c) => { c.font = SUB.font; c.fill = SUB.fill; }); sr++;
  gap();

  const leadsPat = (code: string) => { const p = PRACTICES.find((x) => x.code === code)!; let l = 0, pt = 0; for (const m of TRACKER_MONTHS) { const x = statsFor(p, m); l += x.gLeads + x.mLeads; pt += (x.gPat ?? 0) + (x.mPat ?? 0); } return { l, pt }; };
  const all = PRACTICES.map((p) => leadsPat(p.code)); const convStats = { group: all.reduce((a, x) => a + x.pt, 0) / all.reduce((a, x) => a + x.l, 0), OH: leadsPat('OH').pt / leadsPat('OH').l, WH: leadsPat('WH').pt / leadsPat('WH').l, WHleads: leadsPat('WH').l, WHpat: leadsPat('WH').pt };
  console.log('conv', JSON.stringify(convStats));
  title('3. Other improvements');
  const improvements: [string, string][] = [
    ['Conversion (biggest lever)', `Group lead → patient is ${(convStats.group * 100).toFixed(0)}% overall, ${(convStats.OH * 100).toFixed(0)}% at Oxford House and ${(convStats.WH * 100).toFixed(1)}% at Wilson House on the same ad system. Agree a speed-to-lead standard (first contact within 1 hour, 5 attempts over 5 days) and use Boxly stages consistently. Target: Ghost below 30% at every practice. At Wilson House alone, converting at the group average would have produced roughly ${Math.round(convStats.WHleads * convStats.group - convStats.WHpat)} more patients on the same spend.`],
    ['Missed calls', 'The call logs show 72 missed calls to date across the group (OH 33, MK 27, EB 10, WS 2) plus 37 Oxford House calls marked "no phone number available to track outcome". A missed-call text-back or overflow answering service recovers a share of these at almost no cost.'],
    ['Emergency search', 'Emergency Dentist is the best-performing search campaign in the group where it runs (EB £13–£23 CPA, 95% top-of-page) yet it is paused at OH, WS and WH. Re-enable with a capped daily budget; emergency patients are the cheapest way to fill diaries and convert to general patients.'],
    ['High-value treatments', 'Every large ticket came from implants (OH), ortho / smile makeover (MK) or aligners (EB). Shift creative and search budget toward those treatments at the practices that can deliver them, and give the £85 NPA offer less weight in ad copy at EB and WS.'],
    ['Google conversion tracking', 'Click-to-call and the call-tracking-number actions count the same call twice, so headline conversions overstate leads by roughly a third and Smart Bidding is optimising on inflated data. Set the call-tracking-number actions to secondary in each account so bidding uses real leads.'],
    ['Google CPC at OH', 'Average CPC at Oxford House went from £3.50 in November to £7.50–£8.00 in May–July with lead volume falling. Review search terms, match types and the PMax share before adding budget; the August recovery (43 leads at £5.15 CPC) suggests it is fixable.'],
    ['Meta lead quality', 'Instant Form leads are 55% Ghost across the group; View Content patients are higher value. Keep View Content as the core, use the £10/day Statics test to see whether cheaper form leads (£4–£8 CPL in August) convert before scaling it.'],
    ['Reporting cadence', 'Adopt this workbook as the shared source. Kana enters revenue and patients by the 5th of each month; Vendo refreshes ad data and Boxly exports on the same day so the bi-weekly call reviews one number set.'],
  ];
  for (const [k, v] of improvements) { st.getCell(`A${sr}`).value = k; st.getCell(`A${sr}`).font = { bold: true }; st.getCell(`A${sr}`).alignment = { wrapText: true, vertical: 'top' }; st.mergeCells(`B${sr}:H${sr}`); st.getCell(`B${sr}`).value = v; st.getCell(`B${sr}`).alignment = { wrapText: true, vertical: 'top' }; st.getRow(sr).height = 56; sr++; }
  gap();
  title('4. Asks of Kana for the 10 September call');
  for (const a of ['August revenue and patients on each Patients tab.', 'Fill the call Outcome column for at least the last 30 days (new patient booked / existing / unanswered / other).', 'Confirm which practices can take implant, ortho and aligner cases so budget follows capacity.', 'Agree the speed-to-lead standard and who owns Boxly stages at each practice.', 'Sign off the September budget split.']) para('• ' + a);

  // ===== 6. Data issues / asks =====
  const di = wb.addWorksheet('Data issues');
  header(di, 1, ['#', 'Practice', 'Issue', 'Impact', 'Ask / fix', 'Owner', 'Status']);
  const issues: string[][] = [
    ['All', 'August revenue and patients not yet entered in the tracker', 'August spend (£11,094 Google + £5,363 Meta) has no outcome against it', 'Kana to complete August on Patients tabs before the catch-up', 'Kana', 'Open'],
    ['All', 'Call log Outcome column blank on >90% of calls', 'Phone-lead conversion cannot be measured from the log; phone patients only appear by number on Patients tab', 'Agree a minimal outcome set (New patient booked / Existing / Unanswered / Other) and who fills it', 'Kana', 'Open'],
    ['All', 'Call start times typed as text from ~20 July', 'Breaks month filters and sorting in the call logs', 'Vendo to re-enter as dates; keep the import format going forward', 'Vendo', 'Open'],
    ['All', 'Boxly form exports stop at end of June', 'July and August leads cannot be traced from ad → Boxly → patient', 'Vendo to append July and August Boxly exports (G-Forms and M-Forms)', 'Vendo', 'Open'],
    ['Edward Byrne', 'Totals tab excludes May (SUM starts at June); patient counts and CAC blank', 'Sheet shows 1.31x; true May–July return is 0.97x', 'Fix SUM ranges and fill patient counts (2 / 7 / 9)', 'Vendo', 'Open'],
    ['MK Smiles', 'July Meta spend in tracker (£635.39) vs Ads Manager (£617.26)', '£18 difference', 'Align tracker to Ads Manager', 'Vendo', 'Open'],
    ['Woburn Sands / Edward Byrne', 'Patients tab side-labels say "May … Total" for June and July', 'Cosmetic, but easy to misread', 'Relabel', 'Vendo', 'Open'],
    ['Wilson House', '108 Meta form leads May–July, 2 patients, £170 revenue', 'Lowest lead-to-patient rate in the group (2%); 48 of 73 Boxly Meta leads marked Ghost', 'Review follow-up speed and script with the practice; Meta form campaign already switched off in August', 'Both', 'Open'],
    ['Oxford House', 'Google CPA has risen from £41 (Jan) to £100 (Jul); Emergency Dentist campaign paused', 'Fewer Google leads at higher cost; still the strongest practice on revenue', 'Discuss re-enabling Emergency and where the £2.9k/month is best placed', 'Vendo', 'Open'],
    ['All', 'Google "Conversions" double-counts phone leads (click-to-call + call-tracking number)', 'Headline conversions overstate leads by roughly a third', 'Report the de-duplicated lead figure (Google actions tab) in future', 'Vendo', 'Open'],
  ];
  issues.forEach((row, i) => { const rr = di.getRow(i + 2); rr.values = [i + 1, ...row]; rr.alignment = { wrapText: true, vertical: 'top' }; });
  di.columns = [{ width: 4 }, { width: 18 }, { width: 48 }, { width: 44 }, { width: 48 }, { width: 8 }, { width: 8 }];
  di.views = [{ state: 'frozen', ySplit: 1 }];

  for (const p of PRACTICES) for (const m of MONTHS) { const st = statsFor(p, m); console.log(p.code, m, 'G', st.gSpend.toFixed(0), st.gLeads, st.gPat, st.gRev, '| M', st.mSpend.toFixed(0), st.mLeads, st.mPat, st.mRev); }
  (wb.worksheets.find((w) => w.name === 'Strategy') as any).orderNo = 0;
  await wb.xlsx.writeFile(OUT);
  console.log('wrote', OUT, 'patients', patients.length);
}
main().catch((e) => { console.error(e); process.exit(1); });
