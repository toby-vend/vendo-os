import { db } from '../web/lib/queries/base.js';

async function main() {
  try { await db.execute({ sql: 'DROP TABLE IF EXISTS skills_fts', args: [] }); } catch(e: any) { console.log('drop failed:', e.message); }
  await db.execute({ sql: `CREATE VIRTUAL TABLE IF NOT EXISTS skills_fts USING fts5(title, content, content='skills', content_rowid='rowid')`, args: [] });
  console.log('FTS5 table rebuilt');

  // Use raw SQL to re-populate FTS5 from the content table
  await db.execute({ sql: `INSERT INTO skills_fts(rowid, title, content) SELECT rowid, title, content FROM skills`, args: [] });
  const countResult = await db.execute({ sql: 'SELECT count(*) as c FROM skills', args: [] });
  console.log(`Re-indexed ${countResult.rows[0]['c']} existing skills`);
}
main().catch(e => { console.error(e); process.exit(1); });
