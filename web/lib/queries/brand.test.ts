/**
 * Tests for Brand Hub query module — BRND-01 through BRND-04.
 *
 * Uses a real in-memory libsql database with the FTS5 schema so SQL is
 * validated against an actual engine, not mocked.
 *
 * Run:
 *   node --test --experimental-test-module-mocks --import tsx/esm web/lib/queries/brand.test.ts
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
// Mock ./base.js before importing brand.ts so the module picks up the in-memory
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
  upsertBrandFromDrive,
  getBrandContext,
  listBrandClients,
  searchBrandContent,
  getBrandFile,
  deleteBrandFile,
  syncBrandFts,
  deleteBrandFts,
} = await import('./brand.js');

// ---------------------------------------------------------------------------
// Schema + fixture helpers
// ---------------------------------------------------------------------------

async function setupSchema() {
  await testDb.execute({ sql: `CREATE TABLE IF NOT EXISTS brand_hub (
    id INTEGER PRIMARY KEY,
    client_id INTEGER NOT NULL,
    client_name TEXT NOT NULL,
    client_slug TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    drive_file_id TEXT,
    drive_modified_at TEXT,
    indexed_at TEXT NOT NULL
  )`, args: [] });

  await testDb.execute({ sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_hub_drive_file ON brand_hub(drive_file_id)`, args: [] });
  await testDb.execute({ sql: `CREATE INDEX IF NOT EXISTS idx_brand_hub_client ON brand_hub(client_id)`, args: [] });

  await testDb.execute({ sql: `CREATE VIRTUAL TABLE IF NOT EXISTS brand_hub_fts USING fts5(
    client_name,
    content,
    content='brand_hub',
    tokenize='unicode61'
  )`, args: [] });
}

async function insertFixture(data: {
  drive_file_id: string;
  title: string;
  client_id: number;
  client_name: string;
  client_slug: string;
  content: string;
  content_hash: string;
}) {
  const now = new Date().toISOString();
  await testDb.execute({
    sql: `INSERT INTO brand_hub (drive_file_id, title, client_id, client_name, client_slug, content, content_hash, indexed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [data.drive_file_id, data.title, data.client_id, data.client_name, data.client_slug, data.content, data.content_hash, now],
  });
  const row = await testDb.execute({ sql: 'SELECT rowid FROM brand_hub WHERE drive_file_id = ?', args: [data.drive_file_id] });
  const rowid = row.rows[0][0] as number;
  await testDb.execute({ sql: 'INSERT INTO brand_hub_fts(rowid, client_name, content) VALUES(?, ?, ?)', args: [rowid, data.client_name, data.content] });
}

// ---------------------------------------------------------------------------
// Test fixtures — inserted once in `before()`
// ---------------------------------------------------------------------------

before(async () => {
  await setupSchema();

  // Client A — 2 files
  await insertFixture({
    drive_file_id: 'brand-a-001',
    title: 'Brand Guidelines',
    client_id: 1,
    client_name: 'Client Alpha',
    client_slug: 'client-a',
    content: 'Tone of voice: professional and approachable. Colour palette: navy and gold.',
    content_hash: 'hash-a1',
  });

  await insertFixture({
    drive_file_id: 'brand-a-002',
    title: 'Messaging Framework',
    client_id: 1,
    client_name: 'Client Alpha',
    client_slug: 'client-a',
    content: 'Core message: leading dental care provider. Tone should be warm and authoritative.',
    content_hash: 'hash-a2',
  });

  // Client B — 1 file
  await insertFixture({
    drive_file_id: 'brand-b-001',
    title: 'Visual Identity',
    client_id: 2,
    client_name: 'Client Beta',
    client_slug: 'client-b',
    content: 'Logo usage: always use on white background. Tone must remain formal.',
    content_hash: 'hash-b1',
  });
});

// ---------------------------------------------------------------------------
// upsertBrandFromDrive tests
// ---------------------------------------------------------------------------

describe('upsertBrandFromDrive', () => {
  it('inserts a new brand file record', async () => {
    await upsertBrandFromDrive({
      driveFileId: 'brand-upsert-001',
      title: 'New Brand File',
      content: 'Initial content for upsert test.',
      contentHash: 'hash-u1',
      clientId: 99,
      clientName: 'Upsert Client',
      clientSlug: 'upsert-client',
      driveModifiedAt: '2026-01-01T00:00:00Z',
    });

    const result = await testDb.execute({
      sql: 'SELECT * FROM brand_hub WHERE drive_file_id = ?',
      args: ['brand-upsert-001'],
    });
    assert.strictEqual(result.rows.length, 1);
    assert.strictEqual(result.rows[0].title as string, 'New Brand File');
    assert.strictEqual(result.rows[0].client_name as string, 'Upsert Client');
  });

  it('updates an existing record on conflict (same driveFileId)', async () => {
    // First insert
    await upsertBrandFromDrive({
      driveFileId: 'brand-upsert-002',
      title: 'Original Title',
      content: 'Original content.',
      contentHash: 'hash-orig',
      clientId: 99,
      clientName: 'Upsert Client',
      clientSlug: 'upsert-client',
      driveModifiedAt: '2026-01-01T00:00:00Z',
    });

    // Second insert with same driveFileId — should update
    await upsertBrandFromDrive({
      driveFileId: 'brand-upsert-002',
      title: 'Updated Title',
      content: 'Updated content with new tokens.',
      contentHash: 'hash-upd',
      clientId: 99,
      clientName: 'Upsert Client',
      clientSlug: 'upsert-client',
      driveModifiedAt: '2026-02-01T00:00:00Z',
    });

    const result = await testDb.execute({
      sql: 'SELECT count(*) as cnt, title FROM brand_hub WHERE drive_file_id = ?',
      args: ['brand-upsert-002'],
    });
    assert.strictEqual(result.rows[0].cnt as number, 1, 'Should not create a duplicate row');
    assert.strictEqual(result.rows[0].title as string, 'Updated Title');
  });
});

// ---------------------------------------------------------------------------
// getBrandContext tests — BRND-04 client isolation
// ---------------------------------------------------------------------------

describe('getBrandContext — BRND-04 isolation', () => {
  it('returns only files for the requested clientSlug', async () => {
    const files = await getBrandContext('client-a');
    assert.ok(files.length > 0, 'Expected files for client-a');
    const slugs = files.map((f: { client_slug: string }) => f.client_slug);
    assert.ok(slugs.every((s: string) => s === 'client-a'), `All results must belong to client-a, got: ${slugs.join(', ')}`);
  });

  it('BRND-04: client-a query NEVER returns client-b data', async () => {
    const files = await getBrandContext('client-a');
    const fileIds = files.map((f: { drive_file_id: string }) => f.drive_file_id);
    assert.ok(!fileIds.includes('brand-b-001'), 'client-b file must not appear in client-a results');
  });

  it('returns client-b files when queried for client-b', async () => {
    const files = await getBrandContext('client-b');
    const fileIds = files.map((f: { drive_file_id: string }) => f.drive_file_id);
    assert.ok(fileIds.includes('brand-b-001'), 'Expected brand-b-001 in client-b results');
  });

  it('returns results ordered by title ASC', async () => {
    const files = await getBrandContext('client-a');
    assert.ok(files.length >= 2, 'Expected at least 2 files for client-a');
    const titles = files.map((f: { title: string }) => f.title);
    const sorted = [...titles].sort();
    assert.deepStrictEqual(titles, sorted, 'Results should be ordered by title ASC');
  });

  it('returns empty array for unknown clientSlug', async () => {
    const files = await getBrandContext('non-existent-client');
    assert.strictEqual(files.length, 0);
  });
});

// ---------------------------------------------------------------------------
// listBrandClients tests
// ---------------------------------------------------------------------------

describe('listBrandClients', () => {
  it('returns distinct clients with file counts', async () => {
    const clients = await listBrandClients();
    assert.ok(clients.length >= 2, `Expected at least 2 clients, got ${clients.length}`);

    const clientA = clients.find((c: { client_slug: string }) => c.client_slug === 'client-a');
    assert.ok(clientA, 'Expected client-a in results');
    assert.ok((clientA.file_count as number) >= 2, `Expected at least 2 files for client-a, got ${clientA.file_count}`);
  });

  it('does not return content field — names and counts only', async () => {
    const clients = await listBrandClients();
    assert.ok(clients.length > 0);
    const firstClient = clients[0];
    assert.ok(!('content' in firstClient), 'listBrandClients must not return content field');
  });

  it('orders results by client_name ASC', async () => {
    const clients = await listBrandClients();
    const names = clients.map((c: { client_name: string }) => c.client_name);
    const sorted = [...names].sort();
    assert.deepStrictEqual(names, sorted, 'Clients should be ordered by name ASC');
  });
});

// ---------------------------------------------------------------------------
// searchBrandContent tests — BRND-04 isolation + FTS5 ranking
// ---------------------------------------------------------------------------

describe('searchBrandContent', () => {
  it('returns FTS5-ranked results scoped to client when clientSlug provided', async () => {
    const results = await searchBrandContent('tone', 'client-a');
    assert.ok(results.length > 0, 'Expected at least one result for "tone" in client-a');
    const slugs = results.map((r: { client_slug: string }) => r.client_slug);
    assert.ok(slugs.every((s: string) => s === 'client-a'), `All results must be client-a, got: ${slugs.join(', ')}`);
  });

  it('BRND-04: searchBrandContent scoped to client-a never returns client-b data', async () => {
    const results = await searchBrandContent('tone', 'client-a');
    const fileIds = results.map((r: { drive_file_id: string }) => r.drive_file_id);
    assert.ok(!fileIds.includes('brand-b-001'), 'client-b file must not appear in client-a search results');
  });

  it('returns results from ALL clients when no clientSlug provided (global internal search)', async () => {
    const results = await searchBrandContent('tone');
    assert.ok(results.length > 0, 'Expected global results');
    const slugs = results.map((r: { client_slug: string }) => r.client_slug);
    const uniqueSlugs = new Set(slugs);
    // Should include both client-a and client-b since both have "tone" in content
    assert.ok(uniqueSlugs.size >= 2, `Expected results from multiple clients, got slugs: ${[...uniqueSlugs].join(', ')}`);
  });

  it('returns empty array for non-matching query', async () => {
    const results = await searchBrandContent('xyznonexistent99zyx', 'client-a');
    assert.strictEqual(results.length, 0);
  });

  it('sanitises FTS5 query — does not throw with quoted input', async () => {
    await assert.doesNotReject(async () => {
      await searchBrandContent('"tone voice"', 'client-a');
    });
  });

  it('returns at most 10 results (default limit)', async () => {
    const results = await searchBrandContent('tone');
    assert.ok(results.length <= 10, `Expected at most 10 results, got ${results.length}`);
  });
});

// ---------------------------------------------------------------------------
// getBrandFile tests
// ---------------------------------------------------------------------------

describe('getBrandFile', () => {
  it('returns the correct single record by driveFileId', async () => {
    const file = await getBrandFile('brand-a-001');
    assert.ok(file !== null, 'Expected a record, got null');
    assert.strictEqual(file.drive_file_id, 'brand-a-001');
    assert.strictEqual(file.client_slug, 'client-a');
    assert.strictEqual(file.title, 'Brand Guidelines');
  });

  it('returns null for a non-existent driveFileId', async () => {
    const file = await getBrandFile('nonexistent-file-id');
    assert.strictEqual(file, null);
  });
});

// ---------------------------------------------------------------------------
// deleteBrandFile tests
// ---------------------------------------------------------------------------

describe('deleteBrandFile', () => {
  it('removes the record and its FTS5 index entry', async () => {
    // Insert a dedicated record for this test
    await upsertBrandFromDrive({
      driveFileId: 'brand-del-test',
      title: 'Delete Test File',
      content: 'Unique zorblax content to verify FTS5 removal.',
      contentHash: 'hash-del',
      clientId: 50,
      clientName: 'Delete Test Client',
      clientSlug: 'delete-test',
      driveModifiedAt: '2026-01-01T00:00:00Z',
    });

    // Verify it exists before deletion
    const before = await getBrandFile('brand-del-test');
    assert.ok(before !== null, 'Record must exist before deletion');

    // Verify it is findable in FTS5
    const ftsBefore = await testDb.execute({ sql: "SELECT rowid FROM brand_hub_fts WHERE brand_hub_fts MATCH 'zorblax'", args: [] });
    assert.ok(ftsBefore.rows.length > 0, 'Should find "zorblax" in FTS5 before deletion');

    await deleteBrandFile('brand-del-test');

    // Verify row is gone
    const after = await getBrandFile('brand-del-test');
    assert.strictEqual(after, null, 'Record should not exist after deletion');

    // Verify FTS5 entry is gone
    const ftsAfter = await testDb.execute({ sql: "SELECT rowid FROM brand_hub_fts WHERE brand_hub_fts MATCH 'zorblax'", args: [] });
    assert.strictEqual(ftsAfter.rows.length, 0, 'FTS5 entry should be removed after deleteBrandFile');
  });
});

// ---------------------------------------------------------------------------
// syncBrandFts tests
// ---------------------------------------------------------------------------

describe('syncBrandFts', () => {
  it('updates FTS5 index so new terms are findable and old terms are removed', async () => {
    // Insert dedicated skill for this test
    const now = new Date().toISOString();
    await testDb.execute({
      sql: `INSERT INTO brand_hub (drive_file_id, title, client_id, client_name, client_slug, content, content_hash, indexed_at)
            VALUES ('brand-fts-sync', 'Sync Test', 99, 'Sync Client', 'sync-client', 'old content about widgets', 'hash-sync1', ?)`,
      args: [now],
    });
    const rowResult = await testDb.execute({ sql: 'SELECT rowid FROM brand_hub WHERE drive_file_id = ?', args: ['brand-fts-sync'] });
    const rowid = rowResult.rows[0][0] as number;
    await testDb.execute({ sql: 'INSERT INTO brand_hub_fts(rowid, client_name, content) VALUES(?, ?, ?)', args: [rowid, 'Sync Client', 'old content about widgets'] });

    // Update the row then sync FTS
    await testDb.execute({ sql: 'UPDATE brand_hub SET content = ? WHERE rowid = ?', args: ['new content about gadgets', rowid] });
    await syncBrandFts(rowid, 'Sync Client', 'old content about widgets', 'Sync Client', 'new content about gadgets');

    // New term is findable
    const newResult = await testDb.execute({ sql: 'SELECT rowid FROM brand_hub_fts WHERE brand_hub_fts MATCH ?', args: ['gadgets'] });
    assert.ok(newResult.rows.some(r => r[0] === rowid), 'Expected to find "gadgets" in FTS5 after sync');

    // Old term is no longer associated with this rowid
    const oldResult = await testDb.execute({ sql: 'SELECT rowid FROM brand_hub_fts WHERE brand_hub_fts MATCH ?', args: ['widgets'] });
    const oldRowids = oldResult.rows.map(r => r[0]);
    assert.ok(!oldRowids.includes(rowid), 'Old term "widgets" should not be in FTS5 after sync');
  });
});

// ---------------------------------------------------------------------------
// deleteBrandFts tests
// ---------------------------------------------------------------------------

describe('deleteBrandFts', () => {
  it('removes entry from FTS5 index', async () => {
    const now = new Date().toISOString();
    await testDb.execute({
      sql: `INSERT INTO brand_hub (drive_file_id, title, client_id, client_name, client_slug, content, content_hash, indexed_at)
            VALUES ('brand-fts-del', 'FTS Del Test', 99, 'Del Client', 'del-client', 'unique flurble phrase to remove', 'hash-fd1', ?)`,
      args: [now],
    });
    const rowResult = await testDb.execute({ sql: 'SELECT rowid FROM brand_hub WHERE drive_file_id = ?', args: ['brand-fts-del'] });
    const rowid = rowResult.rows[0][0] as number;
    await testDb.execute({ sql: 'INSERT INTO brand_hub_fts(rowid, client_name, content) VALUES(?, ?, ?)', args: [rowid, 'Del Client', 'unique flurble phrase to remove'] });

    const before = await testDb.execute({ sql: "SELECT rowid FROM brand_hub_fts WHERE brand_hub_fts MATCH 'flurble'", args: [] });
    assert.ok(before.rows.some(r => r[0] === rowid), 'Expected to find entry before deletion');

    await deleteBrandFts(rowid, 'Del Client', 'unique flurble phrase to remove');

    const after = await testDb.execute({ sql: "SELECT rowid FROM brand_hub_fts WHERE brand_hub_fts MATCH 'flurble'", args: [] });
    const afterRowids = after.rows.map(r => r[0]);
    assert.ok(!afterRowids.includes(rowid), 'Entry should be removed from FTS5 after deleteBrandFts');
  });
});

// ---------------------------------------------------------------------------
// BRND-03: Performance — 25+ client records
// ---------------------------------------------------------------------------

describe('BRND-03 performance: 25+ clients', () => {
  it('inserts and queries 25+ clients without error', async () => {
    // Serialise inserts — FTS5 content-sync tables do not tolerate concurrent writes
    for (let i = 1; i <= 25; i++) {
      await upsertBrandFromDrive({
        driveFileId: `perf-client-${i}-file`,
        title: `Brand Doc ${i}`,
        content: `Brand content for performance client number ${i}.`,
        contentHash: `hash-perf-${i}`,
        clientId: 1000 + i,
        clientName: `Perf Client ${String(i).padStart(2, '0')}`,
        clientSlug: `perf-client-${i}`,
        driveModifiedAt: '2026-01-01T00:00:00Z',
      });
    }

    const clients = await listBrandClients();
    assert.ok(clients.length >= 25, `Expected at least 25 clients, got ${clients.length}`);
  });
});
