/**
 * Pull onboarding-questionnaire snapshots from ClientDashboard's
 * Supabase Postgres into the Turso `cd_onboarding_snapshots` mirror.
 *
 * Idempotent. Keyed on cd_submission_id. Used by:
 *   - scripts/sync/pull-onboarding-from-portal.ts (CLI: npm run sync:onboarding)
 *   - web/routes/api/cron.ts (Vercel cron every 6h)
 *
 * Sources Postgres rows from CD's `questionnaire_submissions` joined to
 * `organisations` so we know the external_vendo_id → VendoOS client_id.
 */
import { createClient } from '@supabase/supabase-js';
import { db } from '../queries/base.js';

interface CdSubmissionRow {
  id: string;
  template_id: string;
  status: string | null;
  answers: unknown;
  completion_percent: number | null;
  section_status: unknown;
  submitted_at: string | null;
  updated_at: string;
  external_vendo_id: number | null;
  template_name: string | null;
  template_version: number | null;
}

export interface PullOnboardingResult {
  loaded: number;
  upserted: number;
  skipped: number;
  warnings: string[];
}

export async function pullOnboardingFromPortal(): Promise<PullOnboardingResult> {
  const url = process.env.PORTAL_SUPABASE_URL;
  const key = process.env.PORTAL_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing PORTAL_SUPABASE_URL or PORTAL_SUPABASE_SERVICE_ROLE_KEY');
  }

  const portal = createClient(url, key, { auth: { persistSession: false } });

  // Pull every submission joined with org metadata + template name. CD's
  // schema (per src/lib/db/schema/questionnaire-submissions.ts) has no
  // explicit `status` column; we derive it below from submittedAt +
  // completionPercent. Column is `section_statuses` (plural), and
  // template_version lives on the submission itself.
  const { data, error } = await portal
    .from('questionnaire_submissions')
    .select(`
      id, answers, completion_percent, section_statuses,
      template_version, submitted_at, updated_at,
      organisations:organisation_id (external_vendo_id),
      questionnaire_templates:template_id (name)
    `)
    .returns<Array<{
      id: string;
      answers: unknown;
      completion_percent: number | null;
      section_statuses: unknown;
      template_version: number | null;
      submitted_at: string | null;
      updated_at: string;
      organisations: { external_vendo_id: number | null } | null;
      questionnaire_templates: { name: string | null } | null;
    }>>();

  if (error) throw new Error(`load CD submissions: ${error.message}`);
  if (!data) return { loaded: 0, upserted: 0, skipped: 0, warnings: [] };

  const warnings: string[] = [];
  let upserted = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  for (const sub of data) {
    const externalVendoId = sub.organisations?.external_vendo_id;
    if (!externalVendoId) {
      skipped++;
      continue;
    }

    // Look up the VendoOS client_id for this external_vendo_id.
    const clientResult = await db.execute({
      sql: `SELECT id FROM clients WHERE id = ? LIMIT 1`,
      args: [externalVendoId],
    });
    const clientId = clientResult.rows[0]?.id;
    if (clientId == null) {
      warnings.push(`external_vendo_id ${externalVendoId} not found in VendoOS clients`);
      skipped++;
      continue;
    }

    // Derive status: submitted > 0%-in-progress > not-started
    const derivedStatus = sub.submitted_at
      ? 'submitted'
      : (sub.completion_percent ?? 0) > 0
        ? 'in_progress'
        : 'not_started';

    await db.execute({
      sql: `INSERT INTO cd_onboarding_snapshots
              (client_id, cd_submission_id, template_name, template_version,
               status, completion_percent, section_status, answers,
               submitted_at, cd_updated_at, synced_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(cd_submission_id) DO UPDATE SET
              template_name = excluded.template_name,
              template_version = excluded.template_version,
              status = excluded.status,
              completion_percent = excluded.completion_percent,
              section_status = excluded.section_status,
              answers = excluded.answers,
              submitted_at = excluded.submitted_at,
              cd_updated_at = excluded.cd_updated_at,
              synced_at = excluded.synced_at`,
      args: [
        Number(clientId),
        sub.id,
        sub.questionnaire_templates?.name ?? null,
        sub.template_version ?? null,
        derivedStatus,
        sub.completion_percent ?? null,
        sub.section_statuses ? JSON.stringify(sub.section_statuses) : null,
        sub.answers ? JSON.stringify(sub.answers) : '{}',
        sub.submitted_at,
        sub.updated_at,
        now,
      ],
    });
    upserted++;
  }

  return { loaded: data.length, upserted, skipped, warnings };
}
