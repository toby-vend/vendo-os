/**
 * Tests for the pure logic of the ad spend sheet job: header-date parsing,
 * layout detection, which months can be written, amount parsing, account →
 * row matching, and conditional-format widening.
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
  findMissingMonths,
  checkWritableMonth,
  parseAmount,
  cleanAccountName,
  matchAccounts,
  extendConditionalFormats,
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

describe('findMissingMonths', () => {
  const layout = () => findSpendLayout(sampleGrid());

  it('lists every missing completed month, never the current one', () => {
    assert.deepEqual(findMissingMonths(layout(), new Date('2026-11-14T09:00:00Z')), ['2026-09', '2026-10']);
    assert.deepEqual(findMissingMonths(layout(), new Date('2026-10-01T09:00:00Z')), ['2026-09']);
    assert.deepEqual(findMissingMonths(layout(), new Date('2026-09-20T09:00:00Z')), []);
  });
});

describe('checkWritableMonth', () => {
  const layout = () => findSpendLayout(sampleGrid());
  const now = new Date('2026-11-10T09:00:00Z');

  it('accepts an existing column or the next new one', () => {
    checkWritableMonth(layout(), '2026-03', now);
    checkWritableMonth(layout(), '2026-09', now);
  });

  it('refuses the current month and gaps', () => {
    assert.throws(() => checkWritableMonth(layout(), '2026-11', now), /not a completed month/);
    assert.throws(() => checkWritableMonth(layout(), '2026-10', now), /backfill/);
    assert.throws(() => checkWritableMonth(layout(), '2025-06', now), /backfill/);
  });
});

describe('parseAmount', () => {
  it('reads each currency Ads Reporting shows', () => {
    assert.deepEqual(parseAmount('£9,253.78'), { currency: 'GBP', amount: 9253.78 });
    assert.deepEqual(parseAmount('€15,988.61'), { currency: 'EUR', amount: 15988.61 });
    assert.deepEqual(parseAmount('kr.67,230.28'), { currency: 'DKK', amount: 67230.28 });
    assert.deepEqual(parseAmount('$2,202.21'), { currency: 'USD', amount: 2202.21 });
  });

  it('refuses an unknown currency', () => {
    assert.throws(() => parseAmount('¥1,000'), /Unknown currency/);
  });
});

describe('cleanAccountName', () => {
  it('strips ad-account noise', () => {
    assert.equal(cleanAccountName('Bright Orthodontics - UK'), 'Bright Orthodontics');
    assert.equal(cleanAccountName('VELTUFF® UK'), 'VELTUFF');
    assert.equal(cleanAccountName('Thornley Park Dental 1.0'), 'Thornley Park Dental');
    assert.equal(cleanAccountName('Sone Marketing Ad Account'), 'Sone Marketing');
    assert.equal(cleanAccountName('MK Smiles ad Account'), 'MK Smiles');
    assert.equal(cleanAccountName('Compound Meta Ads'), 'Compound');
  });
});

describe('matchAccounts', () => {
  const rows = findSpendLayout(sampleGrid()).accountRows.map((r) => r.account);

  it('routes group accounts by rule, before any name match', () => {
    const m = matchAccounts(
      [
        'Ravensdale Dental Group - Dentistry.ie (Old Artane)',
        'RDG - Balbriggan Dental Clinic',
        'Kana Health Group Ad Account',
        'MK Smiles ad Account',
      ],
      rows,
    );
    assert.equal(m.get('Ravensdale Dental Group - Dentistry.ie (Old Artane)'), 'Ravensdale Dental Group - Dentistry.ie');
    assert.equal(m.get('RDG - Balbriggan Dental Clinic'), 'Ravensdale Dental Group - Dentistry.ie');
    assert.equal(m.get('Kana Health Group Ad Account'), 'Kana Health');
    assert.equal(m.get('MK Smiles ad Account'), 'Kana Health');
  });

  it('name-matches single accounts', () => {
    const m = matchAccounts(['Bright Orthodontics - UK', 'VELTUFF® UK', 'Studio Glide Pilates'], rows);
    assert.equal(m.get('Bright Orthodontics - UK'), 'Bright Orthodontics');
    assert.equal(m.get('VELTUFF® UK'), 'Veltuff');
    assert.equal(m.get('Studio Glide Pilates'), 'Studio Glide');
  });

  it('leaves our own and unrelated accounts unmatched', () => {
    const m = matchAccounts(['Vendo Digital', 'Boho Bell Tent', 'Pearl Dental'], rows);
    assert.equal(m.get('Vendo Digital'), null);
    assert.equal(m.get('Boho Bell Tent'), null);
    assert.equal(m.get('Pearl Dental'), null);
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
