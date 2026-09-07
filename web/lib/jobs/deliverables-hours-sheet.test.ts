/**
 * Tests for the pure logic of the deliverables hours sheet job: task
 * classification, client-name resolution, and — most importantly — the grid
 * layout detection, since a wrong column index there silently overwrites a
 * real month's figures.
 *
 * Run:
 *   node --test --import tsx/esm web/lib/jobs/deliverables-hours-sheet.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyTask,
  normaliseClient,
  findLayout,
  readAccountRows,
  resolveClient,
} from './deliverables-hours-sheet.js';

/**
 * Mirrors the real tab: a merged month label row above the header row, with
 * each month spanning an "AM Hrs"/"CM Hrs" pair. Merged cells report their
 * value only in the top-left position, so the label sits on the AM column.
 */
function sampleGrid(): string[][] {
  return [
    ['', '', '', '', '', '', '', '', '', '', 'May 2026', '', 'September 2026', ''],
    ['Account name', 'AM', 'CM', 'Level', 'Calls', 'AM Hrs', 'CM Hrs', 'CS Hrs', 'Tier',
      'Budget', 'AM Hrs', 'CM Hrs', 'AM Hrs', 'CM Hrs'],
    ['Zen House Dental', 'TR', 'TR', 'Semi Pro', '1', '3', '3', '1', '1', '£3,500',
      '1.50', '', '', ''],
    ['Rothley Lodge', 'TR', 'TR', 'Auto', '1', '3', '2', '1', '2', '£1,000',
      '2.25', '5.33', '', ''],
    ['The Sword Stall', 'TR', 'TR', 'Elite', '2', '4', '3', '4', '1', '£7,500',
      '3.50', '', '', ''],
    ['', '', '', '', '', '39', '47', '', '', '', '18.00', '0.50', '', ''],
    ['Working Month', '162', 'Hours', '', '', '', '', '', '', '', '', '', '', ''],
    // Some tabs write footer labels with a trailing colon.
    ['Current Workload:', '86', 'Hours', '', '', '', '', '', '', '', '', '', '', ''],
  ];
}

describe('classifyTask', () => {
  it('puts the Account Management family in AM', () => {
    assert.equal(classifyTask('Account Management — Client Meetings & Calls'), 'am');
    assert.equal(classifyTask('Account Management — Monthly Reporting & Reviews'), 'am');
    assert.equal(classifyTask('Account Management — Client Onboarding'), 'am');
    assert.equal(classifyTask('Account Management — Escalations & Retention'), 'am');
  });

  it('puts every Client Communication variant in AM', () => {
    assert.equal(classifyTask('Paid Social — Client Communication'), 'am');
    assert.equal(classifyTask('Paid Search — Client Communication'), 'am');
    assert.equal(classifyTask('Web Design — Client Communication & Presentations'), 'am');
  });

  it('matches the legacy hyphen form as well as the em-dash', () => {
    // Toby's single largest client task uses a plain hyphen.
    assert.equal(classifyTask('Creative - Client Communication'), 'am');
    assert.equal(classifyTask('Account Management - Emails'), 'am');
    assert.equal(classifyTask('Account Management - Video Calls'), 'am');
  });

  it('puts delivery work in CM', () => {
    assert.equal(classifyTask('Paid Social — Campaign Management & Optimisation'), 'cm');
    assert.equal(classifyTask('Paid Social — Static Ad Creative Design'), 'cm');
    assert.equal(classifyTask('Video Editing — Video Editing'), 'cm');
    assert.equal(classifyTask('SEO — Technical SEO & Audits'), 'cm');
    assert.equal(classifyTask('Paid Social — Reporting & Analysis'), 'cm');
  });

  it('skips leave, which is a mis-log when it lands on a client', () => {
    assert.equal(classifyTask('Leave — Holiday'), 'skip');
    assert.equal(classifyTask('Leave — Bank Holiday'), 'skip');
    assert.equal(classifyTask('Leave — Sick Leave'), 'skip');
    assert.equal(classifyTask('Holiday'), 'skip');
    assert.equal(classifyTask('Sick'), 'skip');
  });
});

describe('normaliseClient', () => {
  it('strips the practice suffixes that differ between sheet and Harvest', () => {
    assert.equal(normaliseClient('Rothley Lodge'), normaliseClient('Rothley Lodge Dental Practice'));
    assert.equal(normaliseClient('Avenue Dental'), normaliseClient('Avenue Dental Practice'));
    assert.equal(normaliseClient('Kana Health'), normaliseClient('Kana Health Group'));
    assert.equal(normaliseClient('Smile For Life'), normaliseClient('Smile for Life'));
  });

  it('keeps genuinely different clients apart', () => {
    assert.notEqual(normaliseClient('Avenue Dental'), normaliseClient('Lakewood Dental'));
    assert.notEqual(normaliseClient('Just Smile Dental'), normaliseClient('Smile For Life'));
  });
});

describe('resolveClient', () => {
  const harvest = new Map(
    ['Rothley Lodge Dental Practice', 'Dentistry.ie', 'The Sword Stall', 'Lakewood Dental']
      .map((n) => [normaliseClient(n), n] as [string, string]),
  );

  it('matches on a normalised exact name', () => {
    assert.equal(resolveClient('The Sword Stall', harvest), 'The Sword Stall');
  });

  it('matches when the sheet trims a suffix Harvest keeps', () => {
    assert.equal(resolveClient('Rothley Lodge', harvest), 'Rothley Lodge Dental Practice');
  });

  it('matches when the sheet prefixes a group name', () => {
    assert.equal(resolveClient('Ravensdale Dental Group - Dentistry.ie', harvest), 'Dentistry.ie');
  });

  it('returns null rather than guessing an unknown row', () => {
    assert.equal(resolveClient('Some Client With No Hours', harvest), null);
    assert.equal(resolveClient('', harvest), null);
  });

  it('refuses an ambiguous match rather than picking one', () => {
    const ambiguous = new Map(
      ['Smile Clinic North', 'Smile Clinic South'].map(
        (n) => [normaliseClient(n), n] as [string, string],
      ),
    );
    assert.equal(resolveClient('Smile Clinic', ambiguous), null);
  });
});

describe('findLayout', () => {
  it('finds the column pair belonging to the requested month', () => {
    const layout = findLayout(sampleGrid(), '2026-09');
    assert.equal(layout.headerRow, 1);
    assert.equal(layout.accountCol, 0);
    assert.equal(layout.amCol, 12);
    assert.equal(layout.cmCol, 13);
  });

  it('picks a different month without drifting onto its neighbour', () => {
    const layout = findLayout(sampleGrid(), '2026-05');
    assert.equal(layout.amCol, 10);
    assert.equal(layout.cmCol, 11);
  });

  it('throws for a month with no column rather than writing somewhere', () => {
    assert.throws(() => findLayout(sampleGrid(), '2026-12'), /Could not find a "2026-12" column/);
  });

  it('throws if the columns under the month header are not AM Hrs/CM Hrs', () => {
    const grid = sampleGrid();
    grid[1][13] = 'Notes';
    assert.throws(() => findLayout(grid, '2026-09'), /expected "am hrs"\/"cm hrs"/);
  });

  it('throws when the header row is missing', () => {
    assert.throws(() => findLayout([['', '']], '2026-09'), /Account name/);
  });

  it('accepts abbreviated and two-digit month spellings', () => {
    const grid = sampleGrid();
    grid[0][12] = 'Sept 26';
    assert.equal(findLayout(grid, '2026-09').amCol, 12);
  });
});

describe('readAccountRows', () => {
  it('returns client rows and skips totals and footer labels', () => {
    const grid = sampleGrid();
    const rows = readAccountRows(grid, findLayout(grid, '2026-09'));
    assert.deepEqual(
      rows.map((r) => r.account),
      ['Zen House Dental', 'Rothley Lodge', 'The Sword Stall'],
    );
    // Row indices are 0-based here; the job converts to 1-based A1 rows.
    assert.deepEqual(rows.map((r) => r.row), [2, 3, 4]);
  });
});
