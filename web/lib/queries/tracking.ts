import { rows, scalar, db } from './base.js';

// --- NPS ---

export interface NpsRow {
  id: number;
  client_name: string;
  score: number;
  feedback: string | null;
  follow_up_action: string | null;
  follow_up_done: number;
  created_at: string;
}

export interface NpsStats {
  total: number;
  avg_score: number;
  promoters: number;
  passives: number;
  detractors: number;
  nps: number;
}

export async function getNpsResponses(limit = 50): Promise<NpsRow[]> {
  return rows<NpsRow>(
    'SELECT id, client_name, score, feedback, follow_up_action, follow_up_done, created_at FROM nps_responses ORDER BY created_at DESC LIMIT ?',
    [limit],
  );
}

export async function getNpsStats(): Promise<NpsStats> {
  const result = await rows<{ total: number; avg_score: number; promoters: number; passives: number; detractors: number }>(`
    SELECT COUNT(*) as total,
           ROUND(AVG(score), 1) as avg_score,
           SUM(CASE WHEN score >= 9 THEN 1 ELSE 0 END) as promoters,
           SUM(CASE WHEN score >= 7 AND score < 9 THEN 1 ELSE 0 END) as passives,
           SUM(CASE WHEN score < 7 THEN 1 ELSE 0 END) as detractors
    FROM nps_responses
  `);
  const r = result[0] || { total: 0, avg_score: 0, promoters: 0, passives: 0, detractors: 0 };
  const nps = r.total > 0 ? Math.round(((r.promoters - r.detractors) / r.total) * 100) : 0;
  return { ...r, nps };
}

export async function addNpsResponse(clientName: string, score: number, feedback: string | null): Promise<void> {
  await db.execute({
    sql: 'INSERT INTO nps_responses (client_name, score, feedback, created_at) VALUES (?, ?, ?, ?)',
    args: [clientName, score, feedback, new Date().toISOString()],
  });
}

export async function updateNpsFollowUp(id: number, action: string, done: boolean): Promise<void> {
  await db.execute({
    sql: 'UPDATE nps_responses SET follow_up_action = ?, follow_up_done = ? WHERE id = ?',
    args: [action, done ? 1 : 0, id],
  });
}

// --- Escalations ---

export interface EscalationRow {
  id: number;
  client_name: string;
  tier: string;
  description: string;
  resolution: string | null;
  resolution_minutes: number | null;
  post_mortem: string | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
}

export interface EscalationStats {
  total: number;
  open: number;
  resolved: number;
  avg_resolution_mins: number | null;
}

export async function getEscalations(statusFilter?: string, limit = 50): Promise<EscalationRow[]> {
  if (statusFilter) {
    return rows<EscalationRow>(
      'SELECT * FROM escalations WHERE status = ? ORDER BY created_at DESC LIMIT ?',
      [statusFilter, limit],
    );
  }
  return rows<EscalationRow>(
    'SELECT * FROM escalations ORDER BY CASE WHEN status = \'open\' THEN 0 ELSE 1 END, created_at DESC LIMIT ?',
    [limit],
  );
}

export async function getEscalationStats(): Promise<EscalationStats> {
  const result = await rows<{ total: number; open: number; resolved: number; avg_mins: number | null }>(`
    SELECT COUNT(*) as total,
           SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
           SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
           AVG(CASE WHEN status = 'resolved' THEN resolution_minutes ELSE NULL END) as avg_mins
    FROM escalations
  `);
  const r = result[0] || { total: 0, open: 0, resolved: 0, avg_mins: null };
  return { total: r.total, open: r.open, resolved: r.resolved, avg_resolution_mins: r.avg_mins };
}

export async function addEscalation(clientName: string, tier: string, description: string): Promise<void> {
  await db.execute({
    sql: 'INSERT INTO escalations (client_name, tier, description, status, created_at) VALUES (?, ?, ?, \'open\', ?)',
    args: [clientName, tier, description, new Date().toISOString()],
  });
}

export async function resolveEscalation(id: number, resolution: string): Promise<void> {
  const esc = await rows<EscalationRow>('SELECT created_at FROM escalations WHERE id = ?', [id]);
  const mins = esc[0] ? Math.round((Date.now() - new Date(esc[0].created_at).getTime()) / 60000) : null;
  await db.execute({
    sql: 'UPDATE escalations SET status = \'resolved\', resolution = ?, resolution_minutes = ?, resolved_at = ? WHERE id = ?',
    args: [resolution, mins, new Date().toISOString(), id],
  });
}

// --- Client Feedback (portal) ---

export interface FeedbackRow {
  id: number;
  client_id: number;
  client_name: string | null;
  type: string;
  message: string;
  status: string;
  created_at: string;
}

export async function getClientFeedback(clientId?: number, limit = 50): Promise<FeedbackRow[]> {
  if (clientId) {
    return rows<FeedbackRow>(
      `SELECT f.*, COALESCE(c.display_name, c.name) as client_name
       FROM client_feedback f LEFT JOIN clients c ON c.id = f.client_id
       WHERE f.client_id = ? ORDER BY f.created_at DESC LIMIT ?`,
      [clientId, limit],
    );
  }
  return rows<FeedbackRow>(
    `SELECT f.*, COALESCE(c.display_name, c.name) as client_name
     FROM client_feedback f LEFT JOIN clients c ON c.id = f.client_id
     ORDER BY f.created_at DESC LIMIT ?`,
    [limit],
  );
}

export async function addClientFeedback(clientId: number, type: string, message: string): Promise<void> {
  await db.execute({
    sql: 'INSERT INTO client_feedback (client_id, type, message, status, created_at) VALUES (?, ?, ?, \'new\', ?)',
    args: [clientId, type, message, new Date().toISOString()],
  });
}

export async function updateFeedbackStatus(id: number, status: string): Promise<void> {
  await db.execute({
    sql: 'UPDATE client_feedback SET status = ? WHERE id = ?',
    args: [status, id],
  });
}
