import type { VercelRequest, VercelResponse } from '@vercel/node';
import { parseCookies, verifySessionToken } from '../web/lib/auth.js';
import { rows, db } from '../web/lib/queries/base.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Auth check
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies['vendo_session'];
  const payload = token ? verifySessionToken(token) : null;
  if (!payload) {
    res.status(401).json({ error: 'Unauthorised' });
    return;
  }

  const { skill_slug, client_id, inputs, output } = req.body as {
    skill_slug: string;
    client_id: number;
    inputs: Record<string, string>;
    output: string;
  };

  if (!skill_slug || !client_id || !output) {
    res.status(400).json({ error: 'Missing skill_slug, client_id, or output' });
    return;
  }

  // Ensure table exists
  await db.execute({
    sql: `CREATE TABLE IF NOT EXISTS skill_outputs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      skill_slug TEXT NOT NULL,
      skill_title TEXT NOT NULL,
      client_id INTEGER NOT NULL,
      client_name TEXT NOT NULL,
      inputs TEXT NOT NULL,
      output TEXT NOT NULL,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    args: [],
  });

  // Look up skill title and client name
  const skillRows = await rows<{ title: string }>('SELECT title FROM skills_library WHERE slug = ?', [skill_slug]);
  const skillTitle = skillRows[0]?.title ?? skill_slug;

  const clientRows = await rows<{ name: string }>('SELECT COALESCE(display_name, name) as name FROM clients WHERE id = ?', [client_id]);
  const clientName = clientRows[0]?.name ?? 'Unknown';

  // Load the user's name
  const userRows = await rows<{ name: string }>('SELECT name FROM users WHERE id = ?', [payload.userId]);
  const createdBy = userRows[0]?.name ?? payload.userId;

  const result = await db.execute({
    sql: `INSERT INTO skill_outputs (skill_slug, skill_title, client_id, client_name, inputs, output, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [skill_slug, skillTitle, client_id, clientName, JSON.stringify(inputs), output, createdBy],
  });

  res.status(200).json({ ok: true, id: Number(result.lastInsertRowid) });
}
