import type { VercelRequest, VercelResponse } from '@vercel/node';
import { parseCookies, verifySessionToken } from '../web/lib/auth.js';
import { rows } from '../web/lib/queries/base.js';

interface OutputRow {
  id: number;
  skill_slug: string;
  skill_title: string;
  client_id: number;
  client_name: string;
  output: string;
  created_by: string | null;
  created_at: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
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

  const clientId = req.query.client_id as string | undefined;
  const skillSlug = req.query.skill_slug as string | undefined;

  let sql = `SELECT id, skill_slug, skill_title, client_id, client_name,
             SUBSTR(output, 1, 200) as output, created_by, created_at
             FROM skill_outputs WHERE 1=1`;
  const args: (string | number)[] = [];

  if (clientId) {
    sql += ' AND client_id = ?';
    args.push(parseInt(clientId, 10));
  }
  if (skillSlug) {
    sql += ' AND skill_slug = ?';
    args.push(skillSlug);
  }

  sql += ' ORDER BY created_at DESC LIMIT 50';

  try {
    const results = await rows<OutputRow>(sql, args);
    res.status(200).json({ outputs: results });
  } catch {
    // Table may not exist yet
    res.status(200).json({ outputs: [] });
  }
}
