/**
 * Tests for the pure logic of the ad spend sheet job: header-date parsing,
 * layout detection, which months a given day writes, account → row
 * matching, and conditional-format widening.
 *
 * Run:
 *   node --test --import tsx/esm web/lib/jobs/ad-spend-sheet.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  serialToMonth,
  monthToSerial,
  nextMonth,
  findSpendLayout,
  planMonths,
  cleanAccountName,
  matchAccounts,
  extendConditionalFormats,
  type MetaAccount,
} from './ad-spend-sheet.js';

/**
 * Mirrors the real tab read UNFORMATTED: headers are date serials for the
 * 25th of each month (displayed "mmmm yy"), Jan–Aug 2026 in columns N–U.
 */
function sampleGrid(): string[][] {
  const pad = (row: string[]) => [...row, ...Array(24 - row.length).fill('')];
  return [
    pad(['Vendo Paid Social Clients ']),
    pad(['', '', '', '', '', '', '', '', '', '', '', '', '', 'Over Budget']),
    pad(['', '', '', '', '', '', '', '', '', '', '', '', '', 'On Budget']),
    pad(['Account name', 'AM', 'CM', 'Level', 'Calls', 'AM Hrs', 'CM Hrs', 'CS Hrs', 'Tier',
      'Budget', 'Bio', 'CF', 'Report',
      '46047', '46078', '46106', '46137', '46167', '46198', '46228', '46259']),
    pad(['Ravensdale Dental Group - Dentistry.ie', 'SS', 'SS', 'Elite', '2', '3', '5', '4', '1',
      '16000', '', '', '', '2758.24', '2676.29', '2797.36', '5126.56', '10507.05', '9034.25',
      '11714.93', '11729.24']),
    pad(['Kana Health', 'SS', 'SS', 'Pro', '2', '2', '4', '2', '1', '5000']),
    pad(['Bright Orthodontics', 'TR', 'SS', 'Pro', '2', '3', '4', '3', '1', '3500']),
    pad(['Veltuff', 'TR', 'TR', 'Elite', '2', '3', '5', '8', '1', '10000']),
    pad(['Studio Glide', 'TR', 'TR', 'Auto', '1', '2', '1', '1', '4', '£1,000']),
    pad(['Sunny Dental', 'TR', 'TR', 'Auto', '1', '2', '1', '1', '4', '1000']),
    pad(['', '', '', '', '', '', '', '', '', '', '', '', '', 'N/A', 'N/A', '1207.73']),
    pad(['', '', '', '', '', '88', '78']),
    pad(['', '', 'Total Hours', '', '', '166']),
  ];
}

describe('date serials', () => {
  it('reads the 25th-of-month headers as their month', () => {
    assert.equal(serialToMonth(46047), '2026-01');
    assert.equal(serialToMonth(46259), '2026-08');
  });

  it('round-trips a month through its 1st-of-month serial', () => {
    assert.equal(serialToMonth(monthToSerial('2026-09')), '2026-09');
    assert.equal(monthToSerial('2026-01'), 46023);
  });

  it('rolls the year over', () => {
    assert.equal(nextMonth('2026-12'), '2027-01');
  });
});

describe('findSpendLayout', () => {
  it('finds the header, month run and client rows', () => {
    const l = findSpendLayout(sampleGrid());
    assert.equal(l.headerRow, 3);
    assert.equal(l.accountCol, 0);
    assert.equal(l.firstMonthCol, 13); // N
    assert.equal(l.lastMonthCol, 20); // U
    assert.equal(l.lastMonth, '2026-08');
    assert.equal(l.monthCols.size, 8);
    assert.deepEqual(
      l.accountRows.map((r) => r.account),
      ['Ravensdale Dental Group - Dentistry.ie', 'Kana Health', 'Bright Orthodontics',
        'Veltuff', 'Studio Glide', 'Sunny Dental'],
    );
  });

  it('ignores numeric non-date headers like budgets', () => {
    const g = sampleGrid();
    g[3][10] = '2000';
    assert.equal(findSpendLayout(g).firstMonthCol, 13);
  });

  it('refuses a gap in the month run', () => {
    const g = sampleGrid();
    g[3][17] = '';
    assert.throws(() => findSpendLayout(g), /contiguous/);
  });

  it('refuses a duplicated month', () => {
    const g = sampleGrid();
    g[3][21] = '46259';
    assert.throws(() => findSpendLayout(g), /twice/);
  });
});

describe('planMonths', () => {
  const layout = () => findSpendLayout(sampleGrid());

  it('backfills every missing completed month, never the current one', () => {
    const p = planMonths(layout(), new Date('2026-11-14T18:00:00Z'), 5);
    assert.deepEqual(p.months, ['2026-09', '2026-10']);
  });

  it('adds last month on the 1st', () => {
    const p = planMonths(layout(), new Date('2026-10-01T18:00:00Z'), 5);
    assert.deepEqual(p.months, ['2026-09']);
  });

  it('restates last month inside the close window', () => {
    const p = planMonths(layout(), new Date('2026-09-03T18:00:00Z'), 5);
    assert.deepEqual(p.months, ['2026-08']);
  });

  it('does nothing after the close window once the column exists', () => {
    const p = planMonths(layout(), new Date('2026-09-20T18:00:00Z'), 5);
    assert.deepEqual(p.months, []);
    assert.match(p.skipped ?? '', /close window/);
  });

  it('accepts an explicit existing or next month only', () => {
    const now = new Date('2026-10-10T18:00:00Z');
    assert.deepEqual(planMonths(layout(), now, 5, '2026-03').months, ['2026-03']);
    assert.deepEqual(planMonths(layout(), now, 5, '2026-09').months, ['2026-09']);
    assert.throws(() => planMonths(layout(), now, 5, '2026-10'), /not a completed month/);
    assert.throws(() => planMonths(layout(), now, 5, '2025-06'), /no column/);
  });
});

describe('cleanAccountName', () => {
  it('strips ad-account noise', () => {
    assert.equal(cleanAccountName('Bright Orthodontics - UK'), 'Bright Orthodontics');
    assert.equal(cleanAccountName('VELTUFF® UK'), 'VELTUFF');
    assert.equal(cleanAccountName('Thornley Park Dental 1.0'), 'Thornley Park Dental');
    assert.equal(cleanAccountName('Sone Marketing Ad Account'), 'Sone Marketing');
    assert.equal(cleanAccountName('MK Smiles ad Account'), 'MK Smiles');
  });
});

describe('matchAccounts', () => {
  const rows = findSpendLayout(sampleGrid()).accountRows.map((r) => r.account);
  const acc = (account_id: string, name: string, currency = 'GBP'): MetaAccount => ({
    account_id, name, currency,
  });

  it('routes group accounts by rule, before any name match', () => {
    const m = matchAccounts(
      [
        acc('3614267825545279', 'RDG - Artane Dental & Implant Clinic', 'EUR'),
        acc('578359420830356', 'RDG - Sundrive Dental', 'EUR'),
        acc('3023686887933343', 'MK Smiles ad Account'),
        acc('144068806258342', 'Oxford House Dental Practice'),
      ],
      rows,
    );
    assert.equal(m.get('3614267825545279'), 'Ravensdale Dental Group - Dentistry.ie');
    assert.equal(m.get('578359420830356'), 'Ravensdale Dental Group - Dentistry.ie');
    assert.equal(m.get('3023686887933343'), 'Kana Health');
    assert.equal(m.get('144068806258342'), 'Kana Health');
  });

  it('name-matches single accounts', () => {
    const m = matchAccounts(
      [
        acc('1691845820984786', 'Bright Orthodontics - UK'),
        acc('496760751455236', 'VELTUFF® UK', 'DKK'),
        acc('1634566744569294', 'Studio Glide Pilates'),
      ],
      rows,
    );
    assert.equal(m.get('1691845820984786'), 'Bright Orthodontics');
    assert.equal(m.get('496760751455236'), 'Veltuff');
    assert.equal(m.get('1634566744569294'), 'Studio Glide');
  });

  it('leaves our own and unrelated accounts unmatched', () => {
    const m = matchAccounts(
      [
        acc('1915275659298894', 'Vendo Digital '),
        acc('7031046903619259', 'The Solar Co'),
        acc('937285261228681', 'One Dental'),
      ],
      rows,
    );
    assert.equal(m.get('1915275659298894'), null);
    assert.equal(m.get('7031046903619259'), null);
    assert.equal(m.get('937285261228681'), null);
  });
});

describe('extendConditionalFormats', () => {
  const layout = { firstMonthCol: 13, lastMonthCol: 20 };
  const rule = (start: number, end: number, rows: [number, number]) => ({
    ranges: [{ sheetId: 1, startRowIndex: rows[0], endRowIndex: rows[1],
      startColumnIndex: start, endColumnIndex: end }],
    booleanRule: { condition: { type: 'NOT_BLANK' } },
  });

  it('widens rules ending at the last month column, keeping their index', () => {
    const reqs = extendConditionalFormats(
      [rule(13, 21, [4, 44]), rule(0, 5, [0, 3]), rule(13, 21, [3, 4])],
      1, layout, 22,
    ) as Array<{ updateConditionalFormatRule: { index: number; rule: { ranges: Array<{ endColumnIndex: number }> } } }>;
    assert.equal(reqs.length, 2);
    assert.deepEqual(reqs.map((r) => r.updateConditionalFormatRule.index), [0, 2]);
    for (const r of reqs) {
      assert.equal(r.updateConditionalFormatRule.rule.ranges[0].endColumnIndex, 22);
    }
  });
});
