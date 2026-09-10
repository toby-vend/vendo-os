/**
 * Build the VELTUFF paid social portal from the Meta Ads Manager CSV exports.
 *
 * Produces a single self-contained HTML file with every figure baked in, so it
 * can be opened offline, printed, or published as a shareable link.
 *
 * Data spine: the full account history export (weekly Tue-Mon windows,
 * Jul 2023 to Aug 2026). Recent discrete windows are appended on their own
 * Mon-Sun grid. Nothing is interpolated: a week is present only if an export
 * covers it, and months are bucketed by the window's start date (stated in the
 * portal footer) rather than split pro-rata across month boundaries.
 *
 * Usage:  npm run report:veltuff:portal
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const FX = 0.1147; // DKK -> GBP, the rate Stuart's Media Spend Tracker uses
const ROOT = process.cwd();
const META = join(ROOT, 'data/veltuff/uploads/meta');
const OUT = join(ROOT, 'outputs/reports/veltuff');

// ── CSV (RFC4180: the Meta exports quote fields containing commas) ──────────
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift()!.map(h => h.replace(/^﻿/, '').trim());
  return rows.filter(r => r.some(v => v !== '')).map(r =>
    Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}
const readCsv = (f: string) => parseCsv(readFileSync(join(META, f), 'utf8'));
const num = (r: Record<string, string>, k: string) => {
  const v = parseFloat(r[k] ?? '');
  return Number.isFinite(v) ? v : 0;
};

// ── campaign classification ────────────────────────────────────────────────
type Layer = 'Prospecting' | 'Category' | 'Retargeting' | 'Offer' | 'Awareness' | 'Other';

function layerOf(raw: string): Layer {
  const n = raw.toLowerCase();
  if (n.includes('awareness')) return 'Awareness';
  if (n.includes('retargeting') || n.includes('abandoned cart') || /\brm\b/.test(n)) return 'Retargeting';
  if (/blknov|wintersale|clearance|decdeals|black friday|safety shoe sale/.test(n)) return 'Offer';
  if (/hi-vis|protex1|customised workwear|key categories|trousers|seasonal best sellers|women/.test(n)) return 'Category';
  if (n.includes('job add') || n.includes('kam jylland')) return 'Other';
  return 'Prospecting';
}

/** Short, client-readable label. No em dashes (house style). */
function labelOf(raw: string): string {
  const map: [RegExp, string][] = [
    [/hi-vis only/i, 'Hi-Vis Advantage+'],
    [/sales \| protex1|protex1 \| advantage/i, 'ProTex1 Advantage+'],
    [/seasonal best sellers/i, 'Seasonal Best Sellers DPA'],
    [/sales \| trousers \| dpa/i, 'Trousers DPA'],
    [/retargeting \| dpa/i, 'Retargeting DPA'],
    [/abandoned cart/i, 'Abandoned Cart Retargeting'],
    [/broad \| awareness|awareness \| advantage/i, 'Awareness / Reach'],
    [/customised workwear \| sales/i, 'Customised Workwear'],
    [/key categories/i, 'Key Categories'],
    [/prospecting \| sales \| broad|broad \| prospecting \| sales/i, 'Broad Prospecting'],
    [/blknov25/i, 'Black November 2025'],
    [/black friday 2024/i, 'Black Friday 2024'],
    [/decdeals25/i, 'December Deals 2025'],
    [/wintersale/i, 'Winter Sale'],
    [/warehouse clearance/i, 'Warehouse Clearance'],
    [/clearance sales/i, 'Clearance'],
    [/safety shoe sale/i, 'Safety Shoe Sale'],
    [/flexible ad/i, 'Flexible Ads'],
    [/advantage\+ shopping/i, 'Advantage+ Shopping'],
    [/sales campaign women/i, 'Womenswear'],
    [/rm campaign|rm - uk/i, 'Remarketing'],
    [/sales campaign - uk mpa/i, 'Legacy Sales (MPA)'],
    [/job add|kam jylland/i, 'Recruitment Ad'],
  ];
  for (const [re, lbl] of map) if (re.test(raw)) return lbl;
  return raw.replace(/\s*\|\s*/g, ' ').replace(/\bSH Campaign\b|\bCampaign\b/g, '').trim();
}

// ── aggregation ────────────────────────────────────────────────────────────
type Row = { n: string; raw: string; t: Layer; spend: number; imp: number; reach: number;
             clk: number; pur: number; rev: number; atc: number; co: number };

function rowsFrom(recs: Record<string, string>[]): Row[] {
  const by = new Map<string, Row>();
  for (const r of recs) {
    const spend = num(r, 'Amount spent (DKK)');
    if (spend <= 0) continue;
    const raw = r['Campaign name'];
    const key = labelOf(raw);
    const cur = by.get(key) ?? { n: key, raw, t: layerOf(raw), spend: 0, imp: 0, reach: 0,
                                 clk: 0, pur: 0, rev: 0, atc: 0, co: 0 };
    cur.spend += spend;
    cur.imp += num(r, 'Impressions');
    cur.reach += num(r, 'Reach');
    cur.clk += num(r, 'Link clicks');
    cur.pur += num(r, 'Purchases');
    cur.rev += num(r, 'Results value');
    cur.atc += num(r, 'Adds to cart');
    cur.co += num(r, 'Checkouts initiated');
    by.set(key, cur);
  }
  return [...by.values()].sort((a, b) => b.rev - a.rev || b.spend - a.spend);
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const d = (s: string) => new Date(s + 'T00:00:00Z');
const days = (a: string, b: string) => Math.round((d(b).getTime() - d(a).getTime()) / 864e5) + 1;

function fmtRange(a: string, b: string): string {
  const A = d(a), B = d(b);
  const am = SHORT[A.getUTCMonth()], bm = SHORT[B.getUTCMonth()];
  const ay = A.getUTCFullYear(), byr = B.getUTCFullYear();
  if (ay !== byr) return `${A.getUTCDate()} ${am} ${ay} to ${B.getUTCDate()} ${bm} ${byr}`;
  if (am === bm) return `${A.getUTCDate()} to ${B.getUTCDate()} ${bm} ${ay}`;
  return `${A.getUTCDate()} ${am} to ${B.getUTCDate()} ${bm} ${ay}`;
}
/** True only for a 7 day window that starts on a Monday, i.e. a real ISO week. */
function isIsoWeek(start: string, len: number): boolean {
  return len === 7 && d(start).getUTCDay() === 1;
}
const DAYNAME = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
/** Human description of a window that is not a Monday to Sunday ISO week. */
function gridNote(start: string, end: string, len: number): string {
  return len === 7
    ? `7 days, ${DAYNAME[d(start).getUTCDay()]} to ${DAYNAME[d(end).getUTCDay()]}`
    : `${len} days, not a full week`;
}
/** Compact axis label, e.g. "8 Sep 26". */
function tickOf(s: string): string {
  const t = d(s);
  return `${t.getUTCDate()} ${SHORT[t.getUTCMonth()]} ${String(t.getUTCFullYear()).slice(2)}`;
}
/** ISO week number, for continuity with Stuart's own WK numbering. */
function isoWeek(s: string): number {
  const t = d(s); const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day + 3);
  const first = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const fday = (first.getUTCDay() + 6) % 7;
  first.setUTCDate(first.getUTCDate() - fday + 3);
  return 1 + Math.round((t.getTime() - first.getTime()) / (7 * 864e5));
}

type Period = { key: string; label: string; sub: string; short: string; tick: string; start: string; end: string;
                days: number; partial?: string; campaigns: Row[] };

// ── 1. weekly spine from the full history export ───────────────────────────
const HIST = 'VELTUFF®-UK-Campaigns-Jul-11-2023-Aug-11-2026.csv';
const hist = readCsv(HIST);
const byWindow = new Map<string, Record<string, string>[]>();
for (const r of hist) {
  if (num(r, 'Amount spent (DKK)') <= 0) continue;
  const k = `${r['Reporting starts']}|${r['Reporting ends']}`;
  (byWindow.get(k) ?? byWindow.set(k, []).get(k)!).push(r);
}

const weeks: Period[] = [];
for (const [k, recs] of [...byWindow.entries()].sort()) {
  const [start, end] = k.split('|');
  const len = days(start, end);
  if (len < 7) continue; // drop the 1-day stub at the end of the history export
  const iso = isIsoWeek(start, len);
  weeks.push({ key: `w${start}`, label: fmtRange(start, end),
               sub: iso ? `WK${isoWeek(start)}` : gridNote(start, end, len),
               short: iso ? `WK${isoWeek(start)}` : fmtRange(start, end),
               tick: tickOf(start), start, end, days: len, campaigns: rowsFrom(recs) });
}

// ── 2. append the recent discrete windows (Mon-Sun grid) ───────────────────
// Windows pulled straight from Ads Manager to close the gap the history export
// left and to give week 36 its true Monday to Sunday range. The 11 day
// 31 Aug to 10 Sept export is deliberately not used here: it is superseded by
// the real week 36 below, and is kept only for its ad level detail.
const RECENT = [
  'VELTUFF®-UK-Campaigns-Aug-11-2026-Aug-16-2026.csv',
  'VELTUFF®-UK-Campaigns-Aug-17-2026-Aug-23-2026.csv',
  'VELTUFF®-UK-Campaigns-Aug-24-2026-Aug-30-2026 (1).csv',
  'VELTUFF®-UK-Campaigns-Aug-31-2026-Sep-6-2026.csv',
];
for (const f of RECENT) {
  if (!existsSync(join(META, f))) { console.warn(`  skip (missing): ${f}`); continue; }
  const recs = readCsv(f).filter(r => num(r, 'Amount spent (DKK)') > 0);
  if (!recs.length) continue;
  const start = recs[0]['Reporting starts'], end = recs[0]['Reporting ends'];
  if (weeks.some(w => w.start === start)) continue;
  const len = days(start, end);
  // Only a genuine 7 day window earns a WK label. An 11 day export is not a week
  // and must never be presented as one.
  const isWeek = isIsoWeek(start, len);
  weeks.push({ key: `w${start}`, label: fmtRange(start, end),
               sub: isWeek ? `WK${isoWeek(start)}` : gridNote(start, end, len),
               short: isWeek ? `WK${isoWeek(start)}` : fmtRange(start, end),
               tick: tickOf(start),
               start, end, days: len, campaigns: rowsFrom(recs),
               partial: isWeek ? undefined
                 : `${len} day window bridging the two export grids` });
}
weeks.sort((a, b) => a.start.localeCompare(b.start));

// ── 3. months, bucketed by window start ────────────────────────────────────
const monthBuckets = new Map<string, Period[]>();
for (const w of weeks) {
  // bucket by the window's midpoint so a window straddling a month end lands
  // in the month it mostly covers (31 Aug to 10 Sept is September, not August)
  const mid = new Date(d(w.start).getTime() + Math.floor((w.days - 1) / 2) * 864e5);
  const k = mid.toISOString().slice(0, 7);
  (monthBuckets.get(k) ?? monthBuckets.set(k, []).get(k)!).push(w);
}
const months: Period[] = [];
for (const [k, ws] of [...monthBuckets.entries()].sort()) {
  const merged = new Map<string, Row>();
  for (const w of ws) for (const c of w.campaigns) {
    const cur = merged.get(c.n);
    if (!cur) { merged.set(c.n, { ...c }); continue; }
    for (const f of ['spend','imp','reach','clk','pur','rev','atc','co'] as const) cur[f] += c[f];
  }
  const [y, m] = k.split('-').map(Number);
  const covered = ws.reduce((s, w) => s + w.days, 0);
  const inMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  months.push({
    key: k, label: `${MONTHS[m - 1]} ${y}`, sub: `${ws.length} weeks, ${covered} days`,
    short: `${SHORT[m - 1]} ${y}`, tick: `${SHORT[m - 1]} ${String(y).slice(2)}`,
    start: ws[0].start, end: ws[ws.length - 1].end, days: covered,
    partial: covered < inMonth - 4 ? `${covered} days so far` : undefined,
    campaigns: [...merged.values()].sort((a, b) => b.rev - a.rev || b.spend - a.spend),
  });
}

// ── 4. ad set and ad level, from the ad exports (Apr 2026 onward) ──────────
// These exports carry an "Ad set name" but no campaign column, so the layer is
// attributed from the ad set name using the same rules as the campaign names.
type Unit = { n: string; parent?: string; t: Layer; spend: number; imp: number; reach: number;
              clk: number; pur: number; rev: number; atc: number; co: number; thru: number };

function unitsFrom(recs: Record<string, string>[], nameKey: 'Ad name' | 'Ad set name',
                   keyed: boolean): Unit[] {
  const by = new Map<string, Unit>();
  for (const r of recs) {
    const spend = num(r, 'Amount spent (DKK)');
    if (spend <= 0) continue;
    const set = r['Ad set name'] ?? '';
    const name = r[nameKey] ?? 'Unnamed';
    // an ad name can run in several ad sets: key on both so they stay distinct
    const key = keyed ? `${set}\u0000${name}` : name;
    const cur = by.get(key) ?? { n: name, parent: keyed ? set : undefined, t: layerOf(set),
      spend: 0, imp: 0, reach: 0, clk: 0, pur: 0, rev: 0, atc: 0, co: 0, thru: 0 };
    cur.spend += spend;
    cur.imp += num(r, 'Impressions');
    cur.reach += num(r, 'Reach');
    cur.clk += num(r, 'Link clicks');
    cur.pur += num(r, 'Purchases');
    cur.rev += num(r, 'Results value');
    cur.atc += num(r, 'Adds to cart');
    cur.co += num(r, 'Checkouts initiated');
    cur.thru += num(r, 'ThruPlays');
    by.set(key, cur);
  }
  return [...by.values()].sort((a, b) => b.spend - a.spend);
}

const AD_FILES = [
  'VELTUFF®-UK-Ads-Apr-1-2026-Sep-1-2026.csv',
  'VELTUFF-UK-Ads-2026-08-31-to-09-10-allcampaigns.csv',
];
const adRecs: Record<string, string>[] = [];
for (const f of AD_FILES) {
  if (!existsSync(join(META, f))) { console.warn(`  skip (missing): ${f}`); continue; }
  adRecs.push(...readCsv(f).filter(r => num(r, 'Amount spent (DKK)') > 0));
}
const adWindows = new Map<string, Record<string, string>[]>();
for (const r of adRecs) {
  const k = `${r['Reporting starts']}|${r['Reporting ends']}`;
  (adWindows.get(k) ?? adWindows.set(k, []).get(k)!).push(r);
}
type AdPeriod = { key: string; label: string; sub: string; short: string; start: string; end: string;
                  days: number; partial?: string; adSets: Unit[]; ads: Unit[] };
const adPeriods: AdPeriod[] = [];
for (const [k, recs] of [...adWindows.entries()].sort()) {
  const [start, end] = k.split('|');
  const len = days(start, end);
  const isWeek = isIsoWeek(start, len);
  adPeriods.push({
    key: `a${start}`, label: fmtRange(start, end),
    sub: isWeek ? `WK${isoWeek(start)}` : gridNote(start, end, len),
    short: isWeek ? `WK${isoWeek(start)}` : fmtRange(start, end),
    start, end, days: len,
    partial: isWeek ? undefined : `${len} day window covering ${fmtRange(start, end)}, not a single week`,
    adSets: unitsFrom(recs, 'Ad set name', false),
    ads: unitsFrom(recs, 'Ad name', true),
  });
}
// an "everything" roll-up across the ad level coverage
if (adPeriods.length) {
  const first = adPeriods[0].start, last = adPeriods[adPeriods.length - 1].end;
  adPeriods.unshift({
    key: 'aALL', label: `All, ${fmtRange(first, last)}`, sub: `${adPeriods.length} windows`,
    short: 'All', start: first, end: last,
    days: adPeriods.reduce((s, p) => s + p.days, 0),
    adSets: unitsFrom(adRecs, 'Ad set name', false),
    ads: unitsFrom(adRecs, 'Ad name', true),
  });
}

// coverage gaps between consecutive weekly windows
const gapList: string[] = [];
for (let i = 1; i < weeks.length; i++) {
  const g = days(weeks[i - 1].end, weeks[i].start) - 2;
  if (g > 0) gapList.push(fmtRange(
    new Date(d(weeks[i - 1].end).getTime() + 864e5).toISOString().slice(0, 10),
    new Date(d(weeks[i].start).getTime() - 864e5).toISOString().slice(0, 10)));
}

// Targets from Stuart's Media Spend Tracker, for the progress view
const budget = existsSync(join(ROOT, 'data/veltuff/media-budget-2026.json'))
  ? JSON.parse(readFileSync(join(ROOT, 'data/veltuff/media-budget-2026.json'), 'utf8'))
  : null;

const payload = {
  fx: FX,
  targets: budget?.UK ?? null,
  generatedAt: new Date().toISOString().slice(0, 10),
  gap: gapList.join('; '),
  weeks, months, adPeriods,
  sources: [
    `${HIST} (weekly Tue to Mon windows, the account history spine)`,
    ...RECENT.map(f => `${f} (single window)`),
    ...AD_FILES.map(f => `${f} (ad level)`),
  ],
};

writeFileSync(join(OUT, 'portal-data.json'), JSON.stringify(payload));

// inject into the template to produce the standalone portal
let tpl = readFileSync(join(ROOT, 'scripts/reports/veltuff-portal-template.html'), 'utf8');
if (!tpl.includes('__PORTAL_DATA__')) throw new Error('template placeholder missing');

// Veltuff's own mark, taken from their site rather than redrawn
const iconPath = join(ROOT, 'data/veltuff/assets/veltuff-icon.png');
if (existsSync(iconPath)) {
  tpl = tpl.replace('__VELTUFF_ICON__',
    'data:image/png;base64,' + readFileSync(iconPath).toString('base64'));
} else {
  console.warn('  client icon missing, sidebar will show a broken image');
}
const json = JSON.stringify(payload).replace(/</g, '\\u003c');
writeFileSync(join(OUT, 'VELTUFF-portal.html'), tpl.replace('__PORTAL_DATA__', json));
console.log(`portal: outputs/reports/veltuff/VELTUFF-portal.html`);
console.log(`weeks: ${weeks.length}  months: ${months.length}  ad windows: ${adPeriods.length - 1}`);
console.log(`ad level coverage: ${adPeriods.length ? adPeriods[1].start + ' to ' + adPeriods[adPeriods.length-1].end : 'none'}`);
console.log(`range: ${weeks[0].start} to ${weeks[weeks.length - 1].end}`);
const gaps: string[] = [];
for (let i = 1; i < weeks.length; i++) {
  const prevEnd = d(weeks[i - 1].end), curStart = d(weeks[i].start);
  const gap = Math.round((curStart.getTime() - prevEnd.getTime()) / 864e5) - 1;
  if (gap > 0) gaps.push(`${weeks[i - 1].end} to ${weeks[i].start} (${gap}d)`);
}
console.log(`gaps in coverage: ${gaps.length ? gaps.join(', ') : 'none'}`);
