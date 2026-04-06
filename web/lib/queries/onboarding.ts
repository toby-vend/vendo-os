import { rows, db } from './base.js';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OnboardingRow {
  id: number;
  token: string;
  template_id: string;
  client_id: number | null;
  practice_name: string | null;
  contact_email: string | null;
  drive_folder_url: string | null;
  status: string;
  answers: string; // JSON
  current_step: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export async function initOnboardingSchema(): Promise<void> {
  await db.execute({
    sql: `CREATE TABLE IF NOT EXISTS onboarding_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      template_id TEXT NOT NULL,
      client_id INTEGER,
      practice_name TEXT,
      contact_email TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      answers TEXT NOT NULL DEFAULT '{}',
      current_step INTEGER NOT NULL DEFAULT 1,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      submitted_at TEXT
    )`,
    args: [],
  });

  await db.execute({
    sql: 'CREATE INDEX IF NOT EXISTS idx_onboarding_token ON onboarding_submissions(token)',
    args: [],
  });

  await db.execute({
    sql: 'CREATE INDEX IF NOT EXISTS idx_onboarding_status ON onboarding_submissions(status)',
    args: [],
  });

  // Migration: add drive_folder_url column
  try {
    await db.execute({ sql: 'ALTER TABLE onboarding_submissions ADD COLUMN drive_folder_url TEXT', args: [] });
  } catch { /* already exists */ }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getOnboardingByToken(token: string): Promise<OnboardingRow | null> {
  const result = await rows<OnboardingRow>(
    'SELECT * FROM onboarding_submissions WHERE token = ?',
    [token],
  );
  return result[0] ?? null;
}

export async function getOnboardingById(id: number): Promise<OnboardingRow | null> {
  const result = await rows<OnboardingRow>(
    'SELECT * FROM onboarding_submissions WHERE id = ?',
    [id],
  );
  return result[0] ?? null;
}

export async function getAllOnboardings(): Promise<OnboardingRow[]> {
  return rows<OnboardingRow>(
    'SELECT * FROM onboarding_submissions ORDER BY updated_at DESC',
  );
}

export async function createOnboarding(data: {
  templateId: string;
  practiceName?: string;
  contactEmail?: string;
  driveFolderUrl?: string;
  createdBy?: string;
}): Promise<{ id: number; token: string }> {
  const token = crypto.randomBytes(24).toString('base64url');
  const now = new Date().toISOString();

  const result = await db.execute({
    sql: `INSERT INTO onboarding_submissions (token, template_id, practice_name, contact_email, drive_folder_url, status, answers, current_step, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 'draft', '{}', 1, ?, ?, ?)`,
    args: [token, data.templateId, data.practiceName || null, data.contactEmail || null, data.driveFolderUrl || null, data.createdBy || null, now, now],
  });

  return { id: Number(result.lastInsertRowid), token };
}

export async function saveOnboardingAnswers(
  id: number,
  answers: Record<string, unknown>,
  currentStep: number,
): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE onboarding_submissions SET answers = ?, current_step = ?, updated_at = ? WHERE id = ?`,
    args: [JSON.stringify(answers), currentStep, now, id],
  });
}

export async function updateOnboardingMeta(
  id: number,
  data: { practiceName?: string; contactEmail?: string; clientId?: number; status?: string },
): Promise<void> {
  const sets: string[] = [];
  const args: (string | number | null)[] = [];

  if (data.practiceName !== undefined) { sets.push('practice_name = ?'); args.push(data.practiceName); }
  if (data.contactEmail !== undefined) { sets.push('contact_email = ?'); args.push(data.contactEmail); }
  if (data.clientId !== undefined) { sets.push('client_id = ?'); args.push(data.clientId); }
  if (data.status !== undefined) {
    sets.push('status = ?');
    args.push(data.status);
    if (data.status === 'submitted') {
      sets.push('submitted_at = ?');
      args.push(new Date().toISOString());
    }
  }

  if (sets.length === 0) return;

  sets.push('updated_at = ?');
  args.push(new Date().toISOString());
  args.push(id);

  await db.execute({
    sql: `UPDATE onboarding_submissions SET ${sets.join(', ')} WHERE id = ?`,
    args,
  });
}

export async function deleteOnboarding(id: number): Promise<void> {
  await db.execute({
    sql: 'DELETE FROM onboarding_submissions WHERE id = ?',
    args: [id],
  });
}
