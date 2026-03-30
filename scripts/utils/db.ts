import initSqlJs, { type Database } from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');
const DB_PATH = resolve(PROJECT_ROOT, 'data/vendo.db');

let _db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (_db) return _db;

  const SQL = await initSqlJs();
  const dbDir = dirname(DB_PATH);
  if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });

  if (existsSync(DB_PATH)) {
    const buffer = readFileSync(DB_PATH);
    _db = new SQL.Database(buffer);
  } else {
    _db = new SQL.Database();
  }

  _db.run('PRAGMA journal_mode = WAL');
  _db.run('PRAGMA foreign_keys = ON');
  return _db;
}

export function saveDb(): void {
  if (!_db) return;
  const data = _db.export();
  const buffer = Buffer.from(data);
  writeFileSync(DB_PATH, buffer);
}

export function closeDb(): void {
  if (_db) {
    saveDb();
    _db.close();
    _db = null;
  }
}

export async function initSchema(): Promise<void> {
  const db = await getDb();

  db.run(`
    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      duration_seconds INTEGER,
      url TEXT,
      summary TEXT,
      transcript TEXT,
      attendees TEXT,
      raw_action_items TEXT,
      synced_at TEXT NOT NULL,
      processed_at TEXT,
      category TEXT,
      client_name TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS action_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id TEXT NOT NULL REFERENCES meetings(id),
      description TEXT NOT NULL,
      assignee TEXT,
      completed INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      aliases TEXT,
      vertical TEXT,
      status TEXT DEFAULT 'active',
      first_meeting_date TEXT,
      last_meeting_date TEXT,
      meeting_count INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS key_decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id TEXT NOT NULL REFERENCES meetings(id),
      description TEXT NOT NULL,
      context TEXT,
      created_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      meetings_fetched INTEGER DEFAULT 0,
      meetings_new INTEGER DEFAULT 0,
      meetings_updated INTEGER DEFAULT 0,
      status TEXT DEFAULT 'running',
      error TEXT,
      last_cursor TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS meeting_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      label TEXT NOT NULL,
      keywords TEXT
    )
  `);

  // FTS4 virtual table for full-text search (sql.js includes FTS4, not FTS5)
  db.run(`
    CREATE VIRTUAL TABLE IF NOT EXISTS meetings_fts USING fts4(
      title,
      summary,
      transcript,
      content='meetings'
    )
  `);

  // Indexes
  db.run('CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(date)');
  db.run('CREATE INDEX IF NOT EXISTS idx_meetings_category ON meetings(category)');
  db.run('CREATE INDEX IF NOT EXISTS idx_meetings_client ON meetings(client_name)');
  db.run('CREATE INDEX IF NOT EXISTS idx_action_items_assignee ON action_items(assignee)');
  db.run('CREATE INDEX IF NOT EXISTS idx_action_items_meeting ON action_items(meeting_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_action_items_completed ON action_items(completed)');
  db.run('CREATE INDEX IF NOT EXISTS idx_key_decisions_meeting ON key_decisions(meeting_id)');

  seedCategories(db);
  saveDb();
}

function seedCategories(db: Database): void {
  const categories = [
    { slug: 'client_catchup', label: 'Client Catch-up/Update', keywords: JSON.stringify(['catch up', 'catch-up', 'catchup', 'monthly', 'bi-weekly', 'bi weekly', 'update', 'review']) },
    { slug: 'onboarding', label: 'Client Onboarding', keywords: JSON.stringify(['onboarding', 'onboard']) },
    { slug: 'discovery_sales', label: 'Discovery/Sales Call', keywords: JSON.stringify(['discovery', 'intro', 'initial', 'enquiry', 'inquiry', 'proposal']) },
    { slug: 'interview', label: 'Interview', keywords: JSON.stringify(['interview', 'hiring']) },
    { slug: 'strategy', label: 'Strategy/Audit Session', keywords: JSON.stringify(['strategy', 'audit', 'planning']) },
    { slug: 'internal', label: 'Internal Team Meeting', keywords: JSON.stringify(['team meeting', 'team call', 'management', '1 - 1', '1-1', 'catch up']) },
    { slug: 'website_design', label: 'Website/Design Review', keywords: JSON.stringify(['website', 'web design', 'design feedback', 'design review', 'pdp']) },
    { slug: 'service_specific', label: 'Service-Specific', keywords: JSON.stringify(['paid social', 'paid search', 'ppc', 'meta ads', 'google ads', 'seo']) },
    { slug: 'other', label: 'Other/Uncategorised', keywords: JSON.stringify([]) },
  ];

  const stmt = db.prepare('INSERT OR IGNORE INTO meeting_categories (slug, label, keywords) VALUES (?, ?, ?)');
  for (const cat of categories) {
    stmt.run([cat.slug, cat.label, cat.keywords]);
  }
  stmt.free();
}

// Rebuild the FTS index from the meetings table
export async function rebuildFts(): Promise<void> {
  const db = await getDb();
  db.run("INSERT INTO meetings_fts(meetings_fts) VALUES ('rebuild')");
}

// Helper: upsert a meeting
export async function upsertMeeting(meeting: {
  id: string;
  title: string;
  date: string;
  duration_seconds: number | null;
  url: string | null;
  summary: string | null;
  transcript: string | null;
  attendees: string | null;
  raw_action_items: string | null;
}): Promise<'inserted' | 'updated'> {
  const db = await getDb();
  const now = new Date().toISOString();

  const existing = db.exec('SELECT id FROM meetings WHERE id = ?', [meeting.id]);
  const exists = existing.length > 0 && existing[0].values.length > 0;

  if (exists) {
    db.run(`
      UPDATE meetings SET
        title = ?, date = ?, duration_seconds = ?, url = ?,
        summary = COALESCE(?, summary),
        transcript = COALESCE(?, transcript),
        attendees = COALESCE(?, attendees),
        raw_action_items = COALESCE(?, raw_action_items),
        synced_at = ?
      WHERE id = ?
    `, [
      meeting.title, meeting.date, meeting.duration_seconds, meeting.url,
      meeting.summary, meeting.transcript, meeting.attendees, meeting.raw_action_items,
      now, meeting.id,
    ]);
    return 'updated';
  } else {
    db.run(`
      INSERT INTO meetings (id, title, date, duration_seconds, url, summary, transcript, attendees, raw_action_items, synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      meeting.id, meeting.title, meeting.date, meeting.duration_seconds, meeting.url,
      meeting.summary, meeting.transcript, meeting.attendees, meeting.raw_action_items, now,
    ]);
    return 'inserted';
  }
}

export async function getLastSyncedDate(): Promise<string | null> {
  const db = await getDb();
  const result = db.exec('SELECT MAX(date) FROM meetings');
  if (result.length > 0 && result[0].values.length > 0 && result[0].values[0][0]) {
    return result[0].values[0][0] as string;
  }
  return null;
}

export function log(component: string, message: string): void {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${component}] ${message}`);
}

export function logError(component: string, message: string, err?: unknown): void {
  const ts = new Date().toISOString();
  const errMsg = err instanceof Error ? err.message : String(err || '');
  console.error(`[${ts}] [ERROR] [${component}] ${message}${errMsg ? ': ' + errMsg : ''}`);
}

// Run standalone: npx tsx scripts/utils/db.ts --init
if (process.argv.includes('--init')) {
  initSchema().then(() => {
    log('DB', 'Schema initialised successfully');
    log('DB', `Database at: ${DB_PATH}`);
    closeDb();
  }).catch((err) => {
    logError('DB', 'Failed to initialise schema', err);
    process.exit(1);
  });
}
