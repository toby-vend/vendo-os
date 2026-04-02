/**
 * Creative Review — tracks creative assets through submission, review, and approval.
 *
 * Scans Asana for tasks in creative/design sections, creates review records,
 * assigns reviewers based on client tier, and tracks revision history.
 *
 * Usage:
 *   npx tsx scripts/functions/creative-review.ts              # scan and create reviews
 *   npx tsx scripts/functions/creative-review.ts --status      # show pending reviews
 *   npx tsx scripts/functions/creative-review.ts --client "X"  # filter by client
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';

// --- Asset type detection ---

function detectAssetType(taskName: string): string {
  const lower = taskName.toLowerCase();
  if (/video|reel|motion/i.test(lower)) return 'video';
  if (/banner|display|gdn/i.test(lower)) return 'display_banner';
  if (/carousel/i.test(lower)) return 'carousel';
  if (/static|image|graphic|visual/i.test(lower)) return 'static_image';
  if (/copy|text|headline|caption/i.test(lower)) return 'copy';
  if (/landing|lp|page/i.test(lower)) return 'landing_page';
  if (/email|edm|newsletter/i.test(lower)) return 'email';
  return 'creative_asset';
}

// --- Reviewer assignment ---

// High-value clients get founder review; standard clients get AM review
async function assignReviewer(clientName: string | null): Promise<string> {
  if (!clientName) return 'AM';

  const db = await getDb();

  // Check client retainer value from Xero invoices (high-value = top quartile)
  const result = db.exec(`
    SELECT COALESCE(SUM(total), 0) as total_billed
    FROM xero_invoices
    WHERE contact_name LIKE ? AND type = 'ACCREC'
    ORDER BY date DESC
    LIMIT 12
  `, [`%${clientName}%`]);

  if (result.length && result[0].values.length) {
    const totalBilled = result[0].values[0][0] as number;
    // Founder reviews clients billed over 50k in last 12 invoices
    if (totalBilled > 50000) return 'Founder';
  }

  return 'AM';
}

// --- Find creative tasks needing review ---

interface CreativeCandidate {
  gid: string;
  name: string;
  projectName: string | null;
  sectionName: string | null;
  assigneeName: string | null;
}

async function findCreativeCandidates(clientFilter?: string): Promise<CreativeCandidate[]> {
  const db = await getDb();

  let query = `
    SELECT t.gid, t.name, t.project_name, t.section_name, t.assignee_name
    FROM asana_tasks t
    WHERE t.completed = 0
      AND (
        t.section_name LIKE '%creative%'
        OR t.section_name LIKE '%design%'
        OR t.section_name LIKE '%review%'
        OR t.section_name LIKE '%approval%'
        OR t.name LIKE '%creative%'
        OR t.name LIKE '%design review%'
        OR t.name LIKE '%asset%'
      )
      AND t.gid NOT IN (SELECT asana_task_gid FROM creative_reviews WHERE asana_task_gid IS NOT NULL)
  `;

  const params: string[] = [];
  if (clientFilter) {
    query += ' AND t.project_name LIKE ?';
    params.push(`%${clientFilter}%`);
  }

  query += ' ORDER BY t.modified_at DESC LIMIT 30';

  const result = db.exec(query, params);
  if (!result.length || !result[0].values.length) return [];

  const cols = result[0].columns;
  return result[0].values.map((row: unknown[]) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((c: string, i: number) => obj[c] = row[i]);
    return {
      gid: obj.gid as string,
      name: obj.name as string,
      projectName: obj.project_name as string | null,
      sectionName: obj.section_name as string | null,
      assigneeName: obj.assignee_name as string | null,
    };
  });
}

// --- Update existing reviews by checking task completion ---

async function updateExistingReviews(): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  // Check if any pending reviews have had their Asana tasks completed
  const pending = db.exec(`
    SELECT cr.id, cr.asana_task_gid, cr.status
    FROM creative_reviews cr
    WHERE cr.status IN ('pending', 'in_review', 'revision_requested')
      AND cr.asana_task_gid IS NOT NULL
  `);

  if (!pending.length || !pending[0].values.length) return;

  for (const row of pending[0].values) {
    const [id, taskGid, _status] = row as [number, string, string];

    // Check if Asana task is now completed
    const taskResult = db.exec(
      'SELECT completed, section_name FROM asana_tasks WHERE gid = ?',
      [taskGid],
    );

    if (!taskResult.length || !taskResult[0].values.length) continue;

    const [completed, sectionName] = taskResult[0].values[0] as [number, string | null];
    const section = (sectionName ?? '').toLowerCase();

    let newStatus: string | null = null;
    if (completed) {
      newStatus = 'approved';
    } else if (section.includes('revision') || section.includes('amend')) {
      newStatus = 'revision_requested';
    } else if (section.includes('review') || section.includes('approval')) {
      newStatus = 'in_review';
    }

    if (newStatus && newStatus !== _status) {
      const revisionBump = newStatus === 'revision_requested' ? ', revision_count = revision_count + 1' : '';
      db.run(
        `UPDATE creative_reviews SET status = ?, updated_at = ?${revisionBump} WHERE id = ?`,
        [newStatus, now, id],
      );
      log('CREATIVE', `  Review ${id}: ${_status} -> ${newStatus}`);
    }
  }

  saveDb();
}

// --- Status report ---

async function showStatus(clientFilter?: string): Promise<void> {
  const db = await getDb();

  let query = `
    SELECT client_name, asset_name, asset_type, submitted_by, reviewer, status, revision_count, created_at, updated_at
    FROM creative_reviews
    WHERE status NOT IN ('approved', 'cancelled')
  `;

  const params: string[] = [];
  if (clientFilter) {
    query += ' AND client_name LIKE ?';
    params.push(`%${clientFilter}%`);
  }
  query += ' ORDER BY created_at DESC';

  const result = db.exec(query, params);
  if (!result.length || !result[0].values.length) {
    log('CREATIVE', 'No pending creative reviews');
    return;
  }

  console.log('\n=== Pending Creative Reviews ===\n');
  console.log('  Client                 Asset                        Type             Reviewer   Status      Revisions');
  console.log('  ' + '-'.repeat(100));

  for (const row of result[0].values) {
    const [client, asset, atype, _submitter, reviewer, status, revisions] = row as [string, string, string, string, string, string, number];
    console.log(
      `  ${(client ?? '').slice(0, 22).padEnd(22)} ` +
      `${(asset ?? '').slice(0, 28).padEnd(28)} ` +
      `${(atype ?? '').padEnd(16)} ` +
      `${(reviewer ?? '').padEnd(10)} ` +
      `${(status ?? '').padEnd(11)} ` +
      `${revisions}`,
    );
  }

  // Summary
  const summary = db.exec(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'in_review' THEN 1 ELSE 0 END) as in_review,
      SUM(CASE WHEN status = 'revision_requested' THEN 1 ELSE 0 END) as revisions,
      ROUND(AVG(revision_count), 1) as avg_revisions
    FROM creative_reviews
    WHERE status NOT IN ('approved', 'cancelled')
  `);

  if (summary.length && summary[0].values.length) {
    const [total, pending, inReview, revisions, avgRev] = summary[0].values[0] as [number, number, number, number, number];
    console.log(`\n  Total: ${total} | Pending: ${pending} | In Review: ${inReview} | Revisions: ${revisions} | Avg revisions: ${avgRev}`);
  }

  console.log('');
}

// --- Main ---

async function main() {
  await initSchema();

  const clientFilter = process.argv.includes('--client')
    ? process.argv[process.argv.indexOf('--client') + 1]
    : undefined;

  if (process.argv.includes('--status')) {
    await showStatus(clientFilter);
    closeDb();
    return;
  }

  // Update existing reviews
  log('CREATIVE', 'Updating existing reviews...');
  await updateExistingReviews();

  // Find new creative tasks
  const candidates = await findCreativeCandidates(clientFilter);

  if (!candidates.length) {
    log('CREATIVE', 'No new creative assets pending review');
    closeDb();
    return;
  }

  log('CREATIVE', `Found ${candidates.length} new creative asset(s) for review`);
  const db = await getDb();
  const now = new Date().toISOString();

  for (const candidate of candidates) {
    const assetType = detectAssetType(candidate.name);
    const clientName = candidate.projectName ?? 'Unknown';
    const reviewer = await assignReviewer(clientName);

    db.run(
      `INSERT INTO creative_reviews
        (client_name, asset_name, asset_type, asana_task_gid, submitted_by, reviewer, status, revision_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)`,
      [clientName, candidate.name, assetType, candidate.gid, candidate.assigneeName, reviewer, now, now],
    );

    log('CREATIVE', `  New review: ${candidate.name} [${assetType}] — reviewer: ${reviewer}`);
  }

  saveDb();
  log('CREATIVE', `Creative review scan complete — ${candidates.length} new review(s) created`);
  closeDb();
}

main().catch((err) => {
  logError('CREATIVE', 'Creative review failed', err);
  process.exit(1);
});
