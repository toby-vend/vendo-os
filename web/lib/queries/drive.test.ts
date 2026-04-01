/**
 * Tests for Skills FTS5 search, gap detection, and version tracking.
 *
 * Uses a real in-memory libsql database with the FTS5 schema so SQL is
 * validated against an actual engine, not mocked.
 *
 * Run:
 *   node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/drive.test.ts
 */
import { describe, it, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, type Client } from '@libsql/client';

// ---------------------------------------------------------------------------
// In-memory database — created before module mock so the mock closure
// captures the same client instance.
// ---------------------------------------------------------------------------

const testDb: Client = createClient({ url: ':memory:' });

// ---------------------------------------------------------------------------
// Mock ./base.js before importing drive.ts so the module picks up the in-memory
// client. mock.module must be called at top level for the mock to intercept.
// ---------------------------------------------------------------------------

mock.module('./base.js', {
  namedExports: {
    db: testDb,
    rows: async <T>(sql: string, args: (string | number | null)[] = []): Promise<T[]> => {
      const result = await testDb.execute({ sql, args });
      return result.rows as unknown as T[];
    },
    scalar: async <T = number>(sql: string, args: (string | number | null)[] = []): Promise<T | null> => {
      const result = await testDb.execute({ sql, args });
      if (!result.rows.length) return null;
      const row = result.rows[0];
      return row[result.columns[0]] as T;
    },
  },
});

// Import module under test AFTER mock is registered
const {
  searchSkills,
  getSkillVersion,
  getSkillsByVersion,
  syncSkillFts,
  deleteSkillFts,
} = await import('./drive.js');

// ---------------------------------------------------------------------------
// Schema + fixture helpers
// ---------------------------------------------------------------------------

async function setupSchema() {
  await testDb.execute({ sql: `CREATE TABLE IF NOT EXISTS skills (
    id INTEGER PRIMARY KEY,
    drive_file_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    channel TEXT NOT NULL,
    skill_type TEXT NOT NULL,
    drive_modified_at TEXT NOT NULL,
    indexed_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1
  )`, args: [] });

  await testDb.execute({ sql: `CREATE VIRTUAL TABLE IF NOT EXISTS skills_fts USING fts5(
    title,
    content,
    content='skills',
    tokenize='unicode61'
  )`, args: [] });
}

async function insertFixture(skill: {
  drive_file_id: string;
  title: string;
  content: string;
  content_hash: string;
  channel: string;
  skill_type: string;
  drive_modified_at: string;
  indexed_at: string;
  version?: number;
}) {
  await testDb.execute({
    sql: `INSERT INTO skills (drive_file_id, title, content, content_hash, channel, skill_type, drive_modified_at, indexed_at, version)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      skill.drive_file_id, skill.title, skill.content, skill.content_hash,
      skill.channel, skill.skill_type, skill.drive_modified_at, skill.indexed_at,
      skill.version ?? 1,
    ],
  });
  const row = await testDb.execute({ sql: 'SELECT rowid FROM skills WHERE drive_file_id = ?', args: [skill.drive_file_id] });
  const rowid = row.rows[0][0] as number;
  await testDb.execute({ sql: 'INSERT INTO skills_fts(rowid, title, content) VALUES(?, ?, ?)', args: [rowid, skill.title, skill.content] });
}

// ---------------------------------------------------------------------------
// Test fixtures — inserted once in `before()`
// ---------------------------------------------------------------------------

before(async () => {
  await setupSchema();

  await insertFixture({
    drive_file_id: 'file-001',
    title: 'Ad Copy Framework for Paid Social',
    content: 'This SOP describes how to write compelling ad copy for Facebook and Instagram campaigns targeting dental practices.',
    content_hash: 'hash-001',
    channel: 'paid_social',
    skill_type: 'sop',
    drive_modified_at: '2026-01-01T10:00:00Z',
    indexed_at: '2026-01-01T10:05:00Z',
  });

  await insertFixture({
    drive_file_id: 'file-002',
    title: 'Brand Voice and Tone Guide',
    content: 'General guidelines for maintaining consistent brand voice across all channels and communication templates.',
    content_hash: 'hash-002',
    channel: 'general',
    skill_type: 'guide',
    drive_modified_at: '2026-01-15T09:00:00Z',
    indexed_at: '2026-01-15T09:05:00Z',
  });

  await insertFixture({
    drive_file_id: 'file-003',
    title: 'SEO Content Template',
    content: 'Template for creating SEO-optimised content for organic search campaigns.',
    content_hash: 'hash-003',
    channel: 'organic_social',
    skill_type: 'template',
    drive_modified_at: '2026-02-01T08:00:00Z',
    indexed_at: '2026-02-01T08:05:00Z',
  });

  await insertFixture({
    drive_file_id: 'file-004',
    title: 'Retargeting Ad Copy SOP',
    content: 'Step-by-step SOP for writing retargeting ad copy to re-engage website visitors with paid social ads.',
    content_hash: 'hash-004',
    channel: 'paid_social',
    skill_type: 'sop',
    drive_modified_at: '2026-03-01T12:00:00Z',
    indexed_at: '2026-03-01T12:05:00Z',
    version: 3,
  });
});

// ---------------------------------------------------------------------------
// searchSkills tests
// ---------------------------------------------------------------------------

describe('searchSkills', () => {
  it('returns results matching the query in the specified channel', async () => {
    const response = await searchSkills('ad copy', 'paid_social');
    assert.strictEqual(response.gap, false);
    assert.ok(response.results.length > 0, 'Expected at least one result');
    const titles = response.results.map(r => r.title);
    assert.ok(
      titles.some(t => t.includes('Ad Copy') || t.includes('Retargeting')),
      `Expected ad copy results, got: ${titles.join(', ')}`
    );
  });

  it('includes general channel skills in results for any channel search', async () => {
    const response = await searchSkills('brand voice', 'paid_social');
    assert.strictEqual(response.gap, false);
    assert.ok(response.results.length > 0, 'Expected at least one result');
    const titles = response.results.map(r => r.title);
    assert.ok(titles.some(t => t.includes('Brand Voice')), `Expected Brand Voice result, got: ${titles.join(', ')}`);
  });

  it('does NOT return results from a different non-general channel', async () => {
    // organic_social skill should not appear when searching paid_social
    const response = await searchSkills('SEO', 'paid_social');
    const channels = response.results.map(r => r.channel);
    assert.ok(
      channels.every(c => c === 'paid_social' || c === 'general'),
      `Got unexpected channel: ${channels.join(', ')}`
    );
  });

  it('respects the limit parameter', async () => {
    const response = await searchSkills('ad copy', 'paid_social', 1);
    assert.ok(response.results.length <= 1, `Expected at most 1 result, got ${response.results.length}`);
  });

  it('returns gap: true with empty results for non-existent query', async () => {
    const response = await searchSkills('xyznonexistentterm99', 'paid_social');
    assert.strictEqual(response.gap, true);
    assert.strictEqual(response.results.length, 0);
    assert.strictEqual(response.query, 'xyznonexistentterm99');
    assert.strictEqual(response.channel, 'paid_social');
  });

  it('gap property equals (results.length === 0)', async () => {
    const response = await searchSkills('ad copy', 'paid_social');
    assert.strictEqual(response.gap, response.results.length === 0);
  });

  it('includes all required fields in each result', async () => {
    const response = await searchSkills('ad copy', 'paid_social');
    assert.ok(response.results.length > 0);
    const result = response.results[0];
    assert.ok('id' in result, 'Missing id');
    assert.ok('title' in result, 'Missing title');
    assert.ok('content' in result, 'Missing content');
    assert.ok('channel' in result, 'Missing channel');
    assert.ok('skill_type' in result, 'Missing skill_type');
    assert.ok('drive_modified_at' in result, 'Missing drive_modified_at');
    assert.ok('content_hash' in result, 'Missing content_hash');
    assert.ok('bm25_score' in result, 'Missing bm25_score');
    assert.strictEqual(typeof result.bm25_score, 'number');
  });

  it('sanitises FTS5 operators — does not throw with quoted query', async () => {
    await assert.doesNotReject(async () => {
      await searchSkills('"ad copy"', 'paid_social');
    });
  });

  it('returns gap: true when query becomes empty after sanitisation', async () => {
    const response = await searchSkills('""', 'paid_social');
    assert.strictEqual(response.gap, true);
    assert.strictEqual(response.results.length, 0);
  });

  it('response includes query and channel metadata', async () => {
    const response = await searchSkills('ad copy', 'paid_social');
    assert.strictEqual(response.query, 'ad copy');
    assert.strictEqual(response.channel, 'paid_social');
  });
});

// ---------------------------------------------------------------------------
// getSkillVersion tests
// ---------------------------------------------------------------------------

describe('getSkillVersion', () => {
  it('returns version info for an existing skill', async () => {
    const info = await getSkillVersion('file-001');
    assert.ok(info !== null, 'Expected version info, got null');
    assert.strictEqual(info.drive_modified_at, '2026-01-01T10:00:00Z');
    assert.strictEqual(info.content_hash, 'hash-001');
    assert.strictEqual(info.indexed_at, '2026-01-01T10:05:00Z');
    assert.strictEqual(info.version, 1);
  });

  it('returns null for a non-existent drive file id', async () => {
    const info = await getSkillVersion('nonexistent-file-id');
    assert.strictEqual(info, null);
  });

  it('returns correct version number for a multi-version skill', async () => {
    const info = await getSkillVersion('file-004');
    assert.ok(info !== null);
    assert.strictEqual(info.version, 3);
  });
});

// ---------------------------------------------------------------------------
// getSkillsByVersion tests
// ---------------------------------------------------------------------------

describe('getSkillsByVersion', () => {
  it('returns skills in the given channel indexed after sinceDate', async () => {
    const skills = await getSkillsByVersion('paid_social', '2026-02-01T00:00:00Z');
    // file-004 indexed at 2026-03-01, file-001 indexed at 2026-01-01 (before cutoff)
    assert.ok(skills.length >= 1, 'Expected at least one skill');
    const fileIds = skills.map(s => s.drive_file_id);
    assert.ok(fileIds.includes('file-004'), 'Expected file-004 in results');
    assert.ok(!fileIds.includes('file-001'), 'file-001 should be before cutoff');
  });

  it('returns empty array when no skills updated since the given date', async () => {
    const skills = await getSkillsByVersion('paid_social', '2030-01-01T00:00:00Z');
    assert.strictEqual(skills.length, 0);
  });

  it('only returns skills from the specified channel', async () => {
    const skills = await getSkillsByVersion('organic_social', '2025-01-01T00:00:00Z');
    assert.ok(skills.every(s => s.channel === 'organic_social'), 'All results should be organic_social');
  });
});

// ---------------------------------------------------------------------------
// syncSkillFts tests
// ---------------------------------------------------------------------------

describe('syncSkillFts', () => {
  it('updates FTS index so new terms are findable and old terms are removed', async () => {
    // Insert skill dedicated to this test
    await testDb.execute({
      sql: `INSERT INTO skills (drive_file_id, title, content, content_hash, channel, skill_type, drive_modified_at, indexed_at, version)
            VALUES ('file-sync-test', 'Old Title', 'old content about widgets', 'hash-s1', 'general', 'sop', '2026-01-01T00:00:00Z', '2026-01-01T00:01:00Z', 1)`,
      args: [],
    });
    const rowResult = await testDb.execute({ sql: 'SELECT rowid FROM skills WHERE drive_file_id = ?', args: ['file-sync-test'] });
    const rowid = rowResult.rows[0][0] as number;
    await testDb.execute({ sql: 'INSERT INTO skills_fts(rowid, title, content) VALUES(?, ?, ?)', args: [rowid, 'Old Title', 'old content about widgets'] });

    // Update the row in skills then sync FTS — pass OLD values for delete, NEW values for insert
    await testDb.execute({ sql: 'UPDATE skills SET title=?, content=? WHERE rowid=?', args: ['New Title', 'new content about gadgets', rowid] });
    await syncSkillFts(rowid, 'Old Title', 'old content about widgets', 'New Title', 'new content about gadgets');

    // New term is findable
    const newResult = await testDb.execute({ sql: 'SELECT rowid FROM skills_fts WHERE skills_fts MATCH ?', args: ['gadgets'] });
    assert.ok(newResult.rows.some(r => r[0] === rowid), 'Expected to find "gadgets" in FTS after sync');

    // Old term is no longer associated with this rowid
    const oldResult = await testDb.execute({ sql: 'SELECT rowid FROM skills_fts WHERE skills_fts MATCH ?', args: ['widgets'] });
    const oldRowids = oldResult.rows.map(r => r[0]);
    assert.ok(!oldRowids.includes(rowid), 'Old term "widgets" should not be in FTS after sync');
  });
});

// ---------------------------------------------------------------------------
// deleteSkillFts tests
// ---------------------------------------------------------------------------

describe('deleteSkillFts', () => {
  it('removes the entry from the FTS index', async () => {
    await testDb.execute({
      sql: `INSERT INTO skills (drive_file_id, title, content, content_hash, channel, skill_type, drive_modified_at, indexed_at, version)
            VALUES ('file-del-test', 'Delete Me Title', 'unique zorblax phrase to be removed', 'hash-d1', 'general', 'sop', '2026-01-01T00:00:00Z', '2026-01-01T00:01:00Z', 1)`,
      args: [],
    });
    const rowResult = await testDb.execute({ sql: 'SELECT rowid FROM skills WHERE drive_file_id = ?', args: ['file-del-test'] });
    const rowid = rowResult.rows[0][0] as number;
    await testDb.execute({ sql: 'INSERT INTO skills_fts(rowid, title, content) VALUES(?, ?, ?)', args: [rowid, 'Delete Me Title', 'unique zorblax phrase to be removed'] });

    // Verify findable before deletion
    const before = await testDb.execute({ sql: "SELECT rowid FROM skills_fts WHERE skills_fts MATCH 'zorblax'", args: [] });
    assert.ok(before.rows.some(r => r[0] === rowid), 'Expected to find entry before deletion');

    await deleteSkillFts(rowid, 'Delete Me Title', 'unique zorblax phrase to be removed');

    // Verify gone after deletion
    const after = await testDb.execute({ sql: "SELECT rowid FROM skills_fts WHERE skills_fts MATCH 'zorblax'", args: [] });
    const afterRowids = after.rows.map(r => r[0]);
    assert.ok(!afterRowids.includes(rowid), 'Entry should be removed from FTS after deleteSkillFts');
  });
});
