import { rows, scalar, db } from './base.js';

// ── Interfaces ──────────────────────────────────────────────────────

export interface VideoProject {
  id: number;
  client_id: number;
  client_name: string;
  title: string;
  shoot_date: string | null;
  shoot_time: string | null;
  shoot_end_time: string | null;
  location: string | null;
  contact_on_day: string | null;
  treatments_planned: string | null;
  video_types: string | null;
  num_videos: number;
  status: string;
  priority: string;
  assigned_editor_id: string | null;
  assigned_editor_name: string | null;
  deadline: string | null;
  revision_round: number;
  client_status: string;
  raw_files_confirmed_at: string | null;
  client_approved_at: string | null;
  publish_date: string | null;
  publish_platforms: string | null;
  publish_link: string | null;
  internal_notes: string | null;
  archived: number;
  created_at: string;
  updated_at: string;
}

export interface VideoShootPlan {
  id: number;
  project_id: number;
  version: number;
  treatments: string | null;
  run_order: string | null;
  shot_list: string | null;
  equipment_notes: string | null;
  talent_requirements: string | null;
  status: string;
  client_comments: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VideoFile {
  id: number;
  project_id: number;
  type: string;
  url: string;
  label: string | null;
  treatment: string | null;
  video_type: string | null;
  version: number;
  uploaded_by: string | null;
  created_at: string;
}

export interface VideoQaReview {
  id: number;
  project_id: number;
  round: number;
  reviewer_id: string | null;
  reviewer_name: string | null;
  matches_brief: number | null;
  captions_accurate: number | null;
  brand_correct: number | null;
  compliance_ok: number | null;
  audio_ok: number | null;
  hook_ok: number | null;
  cta_present: number | null;
  result: string | null;
  notes: string | null;
  reviewed_at: string;
}

export interface VideoComment {
  id: number;
  project_id: number;
  source: string;
  round: number;
  author_name: string | null;
  body: string;
  timestamp_ref: string | null;
  created_at: string;
}

export interface VideoAuditEntry {
  id: number;
  project_id: number;
  action: string;
  from_value: string | null;
  to_value: string | null;
  user_id: string | null;
  user_name: string | null;
  details: string | null;
  created_at: string;
}

// ── Column definitions ──────────────────────────────────────────────

export const VIDEO_COLUMNS = [
  { key: 'shoot_booked', label: 'Shoot Booked' },
  { key: 'shoot_plan_in_progress', label: 'Shoot Plan In Progress' },
  { key: 'shoot_plan_approved', label: 'Shoot Plan Approved' },
  { key: 'content_day_complete', label: 'Content Day Complete' },
  { key: 'raw_files_shared', label: 'Raw Files Shared' },
  { key: 'in_editing', label: 'In Editing' },
  { key: 'qa_review', label: 'QA Review' },
  { key: 'revisions', label: 'Revisions' },
  { key: 'client_review', label: 'Client Review' },
  { key: 'live', label: 'Live' },
] as const;

export const VALID_STATUSES = VIDEO_COLUMNS.map(c => c.key);

// ── Projects ────────────────────────────────────────────────────────

export async function getActiveVideoProjects(filters?: {
  clientId?: number;
  editorId?: string;
  priority?: string;
  status?: string;
}): Promise<VideoProject[]> {
  let sql = `
    SELECT vp.*,
           COALESCE(c.display_name, c.name) as client_name
    FROM video_projects vp
    JOIN clients c ON c.id = vp.client_id
    WHERE vp.archived = 0
  `;
  const args: (string | number | null)[] = [];

  if (filters?.clientId) {
    sql += ' AND vp.client_id = ?';
    args.push(filters.clientId);
  }
  if (filters?.editorId) {
    sql += ' AND vp.assigned_editor_id = ?';
    args.push(filters.editorId);
  }
  if (filters?.priority) {
    sql += ' AND vp.priority = ?';
    args.push(filters.priority);
  }
  if (filters?.status) {
    sql += ' AND vp.status = ?';
    args.push(filters.status);
  }

  sql += ' ORDER BY vp.deadline ASC NULLS LAST, vp.created_at DESC';
  return rows<VideoProject>(sql, args);
}

export async function getVideoProject(id: number): Promise<VideoProject | null> {
  const result = await rows<VideoProject>(`
    SELECT vp.*,
           COALESCE(c.display_name, c.name) as client_name
    FROM video_projects vp
    JOIN clients c ON c.id = vp.client_id
    WHERE vp.id = ?
  `, [id]);
  return result[0] ?? null;
}

export async function createVideoProject(data: {
  client_id: number;
  title: string;
  shoot_date?: string;
  shoot_time?: string;
  shoot_end_time?: string;
  location?: string;
  contact_on_day?: string;
  treatments_planned?: string;
  num_videos?: number;
  internal_notes?: string;
  priority?: string;
  deadline?: string;
  assigned_editor_id?: string;
  assigned_editor_name?: string;
}): Promise<number> {
  const now = new Date().toISOString();
  const result = await db.execute({
    sql: `INSERT INTO video_projects
          (client_id, title, shoot_date, shoot_time, shoot_end_time, location,
           contact_on_day, treatments_planned, num_videos, internal_notes,
           priority, deadline, assigned_editor_id, assigned_editor_name,
           status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'shoot_booked', ?, ?)`,
    args: [
      data.client_id,
      data.title,
      data.shoot_date || null,
      data.shoot_time || null,
      data.shoot_end_time || null,
      data.location || null,
      data.contact_on_day || null,
      data.treatments_planned || null,
      data.num_videos || 0,
      data.internal_notes || null,
      data.priority || 'normal',
      data.deadline || null,
      data.assigned_editor_id || null,
      data.assigned_editor_name || null,
      now,
      now,
    ],
  });
  return Number(result.lastInsertRowid);
}

export async function updateVideoProject(
  id: number,
  fields: Partial<{
    title: string;
    shoot_date: string;
    shoot_time: string;
    shoot_end_time: string;
    location: string;
    contact_on_day: string;
    treatments_planned: string;
    video_types: string;
    num_videos: number;
    status: string;
    priority: string;
    assigned_editor_id: string | null;
    assigned_editor_name: string | null;
    deadline: string;
    revision_round: number;
    client_status: string;
    raw_files_confirmed_at: string;
    client_approved_at: string;
    publish_date: string;
    publish_platforms: string;
    publish_link: string;
    internal_notes: string;
    archived: number;
  }>,
): Promise<void> {
  const sets: string[] = [];
  const args: (string | number | null)[] = [];

  for (const [key, val] of Object.entries(fields)) {
    sets.push(`${key} = ?`);
    args.push(val ?? null);
  }

  if (sets.length === 0) return;
  sets.push('updated_at = ?');
  args.push(new Date().toISOString());
  args.push(id);

  await db.execute({
    sql: `UPDATE video_projects SET ${sets.join(', ')} WHERE id = ?`,
    args,
  });
}

export async function moveVideoProject(
  id: number,
  newStatus: string,
  userId?: string,
  userName?: string,
): Promise<{ oldStatus: string } | null> {
  if (!VALID_STATUSES.includes(newStatus as any)) return null;

  const project = await getVideoProject(id);
  if (!project) return null;

  const oldStatus = project.status;
  if (oldStatus === newStatus) return { oldStatus };

  await updateVideoProject(id, { status: newStatus });

  // Log the move
  await logVideoAudit(id, 'status_change', oldStatus, newStatus, userId, userName);

  return { oldStatus };
}

// ── Shoot Plans ─────────────────────────────────────────────────────

export async function getShootPlan(projectId: number): Promise<VideoShootPlan | null> {
  const result = await rows<VideoShootPlan>(
    'SELECT * FROM video_shoot_plans WHERE project_id = ? ORDER BY version DESC LIMIT 1',
    [projectId],
  );
  return result[0] ?? null;
}

export async function getShootPlanHistory(projectId: number): Promise<VideoShootPlan[]> {
  return rows<VideoShootPlan>(
    'SELECT * FROM video_shoot_plans WHERE project_id = ? ORDER BY version DESC',
    [projectId],
  );
}

export async function createShootPlan(data: {
  project_id: number;
  treatments?: string;
  run_order?: string;
  shot_list?: string;
  equipment_notes?: string;
  talent_requirements?: string;
}): Promise<number> {
  const now = new Date().toISOString();
  // Get current max version
  const maxVer = await scalar<number>(
    'SELECT MAX(version) FROM video_shoot_plans WHERE project_id = ?',
    [data.project_id],
  );
  const version = (maxVer ?? 0) + 1;

  const result = await db.execute({
    sql: `INSERT INTO video_shoot_plans
          (project_id, version, treatments, run_order, shot_list,
           equipment_notes, talent_requirements, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
    args: [
      data.project_id,
      version,
      data.treatments || null,
      data.run_order || null,
      data.shot_list || null,
      data.equipment_notes || null,
      data.talent_requirements || null,
      now,
      now,
    ],
  });
  return Number(result.lastInsertRowid);
}

export async function updateShootPlan(
  id: number,
  fields: Partial<{
    treatments: string;
    run_order: string;
    shot_list: string;
    equipment_notes: string;
    talent_requirements: string;
    status: string;
    client_comments: string;
    approved_at: string;
  }>,
): Promise<void> {
  const sets: string[] = [];
  const args: (string | number | null)[] = [];

  for (const [key, val] of Object.entries(fields)) {
    sets.push(`${key} = ?`);
    args.push(val ?? null);
  }
  if (sets.length === 0) return;
  sets.push('updated_at = ?');
  args.push(new Date().toISOString());
  args.push(id);

  await db.execute({
    sql: `UPDATE video_shoot_plans SET ${sets.join(', ')} WHERE id = ?`,
    args,
  });
}

// ── Files ───────────────────────────────────────────────────────────

export async function getVideoFiles(projectId: number, type?: string): Promise<VideoFile[]> {
  if (type) {
    return rows<VideoFile>(
      'SELECT * FROM video_files WHERE project_id = ? AND type = ? ORDER BY created_at DESC',
      [projectId, type],
    );
  }
  return rows<VideoFile>(
    'SELECT * FROM video_files WHERE project_id = ? ORDER BY type, created_at DESC',
    [projectId],
  );
}

export async function addVideoFile(data: {
  project_id: number;
  type: string;
  url: string;
  label?: string;
  treatment?: string;
  video_type?: string;
  version?: number;
  uploaded_by?: string;
}): Promise<number> {
  const result = await db.execute({
    sql: `INSERT INTO video_files
          (project_id, type, url, label, treatment, video_type, version, uploaded_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      data.project_id,
      data.type,
      data.url,
      data.label || null,
      data.treatment || null,
      data.video_type || null,
      data.version || 1,
      data.uploaded_by || null,
      new Date().toISOString(),
    ],
  });
  return Number(result.lastInsertRowid);
}

export async function deleteVideoFile(id: number): Promise<void> {
  await db.execute({ sql: 'DELETE FROM video_files WHERE id = ?', args: [id] });
}

// ── QA Reviews ──────────────────────────────────────────────────────

export async function getQaReviews(projectId: number): Promise<VideoQaReview[]> {
  return rows<VideoQaReview>(
    'SELECT * FROM video_qa_reviews WHERE project_id = ? ORDER BY round DESC',
    [projectId],
  );
}

export async function submitQaReview(data: {
  project_id: number;
  reviewer_id?: string;
  reviewer_name?: string;
  matches_brief: number;
  captions_accurate: number;
  brand_correct: number;
  compliance_ok: number;
  audio_ok: number;
  hook_ok: number;
  cta_present: number;
  result: string;
  notes?: string;
}): Promise<number> {
  const maxRound = await scalar<number>(
    'SELECT MAX(round) FROM video_qa_reviews WHERE project_id = ?',
    [data.project_id],
  );
  const round = (maxRound ?? 0) + 1;

  const result = await db.execute({
    sql: `INSERT INTO video_qa_reviews
          (project_id, round, reviewer_id, reviewer_name,
           matches_brief, captions_accurate, brand_correct, compliance_ok,
           audio_ok, hook_ok, cta_present, result, notes, reviewed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      data.project_id, round,
      data.reviewer_id || null, data.reviewer_name || null,
      data.matches_brief, data.captions_accurate, data.brand_correct,
      data.compliance_ok, data.audio_ok, data.hook_ok, data.cta_present,
      data.result, data.notes || null, new Date().toISOString(),
    ],
  });
  return Number(result.lastInsertRowid);
}

// ── Comments ────────────────────────────────────────────────────────

export async function getVideoComments(projectId: number): Promise<VideoComment[]> {
  return rows<VideoComment>(
    'SELECT * FROM video_comments WHERE project_id = ? ORDER BY created_at DESC',
    [projectId],
  );
}

export async function addVideoComment(data: {
  project_id: number;
  source: string;
  round?: number;
  author_name?: string;
  body: string;
  timestamp_ref?: string;
}): Promise<number> {
  const result = await db.execute({
    sql: `INSERT INTO video_comments
          (project_id, source, round, author_name, body, timestamp_ref, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      data.project_id, data.source, data.round || 0,
      data.author_name || null, data.body,
      data.timestamp_ref || null, new Date().toISOString(),
    ],
  });
  return Number(result.lastInsertRowid);
}

// ── Audit Log ───────────────────────────────────────────────────────

export async function logVideoAudit(
  projectId: number,
  action: string,
  fromValue?: string | null,
  toValue?: string | null,
  userId?: string | null,
  userName?: string | null,
  details?: Record<string, unknown>,
): Promise<void> {
  await db.execute({
    sql: `INSERT INTO video_audit_log
          (project_id, action, from_value, to_value, user_id, user_name, details, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      projectId, action,
      fromValue ?? null, toValue ?? null,
      userId ?? null, userName ?? null,
      details ? JSON.stringify(details) : null,
      new Date().toISOString(),
    ],
  });
}

export async function getVideoAuditLog(projectId: number, limit = 50): Promise<VideoAuditEntry[]> {
  return rows<VideoAuditEntry>(
    'SELECT * FROM video_audit_log WHERE project_id = ? ORDER BY created_at DESC LIMIT ?',
    [projectId, limit],
  );
}

// ── Stats / helpers ─────────────────────────────────────────────────

export async function getVideoColumnCounts(): Promise<Record<string, number>> {
  const result = await rows<{ status: string; count: number }>(
    'SELECT status, COUNT(*) as count FROM video_projects WHERE archived = 0 GROUP BY status',
  );
  const counts: Record<string, number> = {};
  for (const col of VIDEO_COLUMNS) counts[col.key] = 0;
  for (const r of result) counts[r.status] = r.count;
  return counts;
}

export async function getActiveClients(): Promise<{ id: number; label: string }[]> {
  return rows<{ id: number; label: string }>(
    "SELECT id, COALESCE(display_name, name) as label FROM clients WHERE status = 'active' ORDER BY label COLLATE NOCASE",
  );
}

export async function getInternalUsers(): Promise<{ id: string; name: string }[]> {
  return rows<{ id: string; name: string }>(
    "SELECT id, name FROM users WHERE role IN ('admin', 'standard') ORDER BY name COLLATE NOCASE",
  );
}
