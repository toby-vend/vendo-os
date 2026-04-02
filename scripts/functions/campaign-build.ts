/**
 * Campaign Build — tracks campaign builds from brief to launch with a QA gate.
 *
 * Scans Asana for campaign-related projects/tasks, generates standardised
 * checklists, tracks progress, and enforces a QA gate before launch.
 *
 * Usage:
 *   npx tsx scripts/functions/campaign-build.ts              # scan and update builds
 *   npx tsx scripts/functions/campaign-build.ts --status      # show all active builds
 *   npx tsx scripts/functions/campaign-build.ts --client "X"  # filter by client
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';

// --- Campaign checklist template ---

interface ChecklistItem {
  step: string;
  category: 'brief' | 'assets' | 'build' | 'tracking' | 'qa';
  owner: string;
  status: 'pending' | 'done' | 'blocked';
}

function generateChecklist(platform: string): ChecklistItem[] {
  const base: ChecklistItem[] = [
    // Brief
    { step: 'Campaign brief approved by client', category: 'brief', owner: 'AM', status: 'pending' },
    { step: 'Target audience defined', category: 'brief', owner: 'AM', status: 'pending' },
    { step: 'Budget and schedule confirmed', category: 'brief', owner: 'AM', status: 'pending' },
    { step: 'KPIs and success metrics agreed', category: 'brief', owner: 'AM', status: 'pending' },
    // Assets
    { step: 'Ad copy written and approved', category: 'assets', owner: 'Specialist', status: 'pending' },
    { step: 'Creative assets designed and approved', category: 'assets', owner: 'Specialist', status: 'pending' },
    { step: 'Landing page built and reviewed', category: 'assets', owner: 'Specialist', status: 'pending' },
    // Build
    { step: 'Campaign created in ad platform', category: 'build', owner: 'Specialist', status: 'pending' },
    { step: 'Targeting configured per brief', category: 'build', owner: 'Specialist', status: 'pending' },
    { step: 'Budget and schedule set', category: 'build', owner: 'Specialist', status: 'pending' },
    { step: 'Naming conventions applied', category: 'build', owner: 'Specialist', status: 'pending' },
    // Tracking
    { step: 'Conversion tracking pixels installed', category: 'tracking', owner: 'Specialist', status: 'pending' },
    { step: 'UTM parameters configured', category: 'tracking', owner: 'Specialist', status: 'pending' },
    { step: 'Test conversion fired and verified', category: 'tracking', owner: 'Specialist', status: 'pending' },
    // QA gate
    { step: 'QA grading passed', category: 'qa', owner: 'QA', status: 'pending' },
    { step: 'Launch approval from AM', category: 'qa', owner: 'AM', status: 'pending' },
  ];

  // Platform-specific additions
  const platformLower = platform.toLowerCase();
  if (platformLower.includes('google') || platformLower.includes('search')) {
    base.splice(11, 0,
      { step: 'Negative keywords added', category: 'build', owner: 'Specialist', status: 'pending' },
      { step: 'Ad extensions configured', category: 'build', owner: 'Specialist', status: 'pending' },
    );
  }
  if (platformLower.includes('meta') || platformLower.includes('facebook')) {
    base.splice(11, 0,
      { step: 'Audience exclusions set', category: 'build', owner: 'Specialist', status: 'pending' },
      { step: 'Placement selection reviewed', category: 'build', owner: 'Specialist', status: 'pending' },
    );
  }

  return base;
}

// --- Detect platform from task/project context ---

function detectPlatform(name: string): string {
  const lower = name.toLowerCase();
  if (/google|gads|search|pmax|performance max/i.test(lower)) return 'Google Ads';
  if (/meta|facebook|instagram|fb|ig/i.test(lower)) return 'Meta Ads';
  if (/linkedin/i.test(lower)) return 'LinkedIn';
  if (/tiktok/i.test(lower)) return 'TikTok';
  return 'Multi-platform';
}

// --- Detect campaign tasks from Asana ---

interface CampaignCandidate {
  projectGid: string;
  projectName: string;
  taskCount: number;
  latestTaskName: string;
}

async function findCampaignCandidates(clientFilter?: string): Promise<CampaignCandidate[]> {
  const db = await getDb();

  let query = `
    SELECT
      t.project_gid,
      t.project_name,
      COUNT(*) as task_count,
      MAX(t.name) as latest_task
    FROM asana_tasks t
    WHERE t.completed = 0
      AND t.project_gid IS NOT NULL
      AND (
        t.section_name LIKE '%campaign%'
        OR t.section_name LIKE '%build%'
        OR t.section_name LIKE '%launch%'
        OR t.project_name LIKE '%campaign%'
        OR t.name LIKE '%campaign build%'
        OR t.name LIKE '%campaign setup%'
        OR t.name LIKE '%launch%'
      )
      AND t.project_gid NOT IN (SELECT asana_project_gid FROM campaign_builds WHERE asana_project_gid IS NOT NULL AND status != 'launched')
  `;

  const params: string[] = [];
  if (clientFilter) {
    query += ' AND t.project_name LIKE ?';
    params.push(`%${clientFilter}%`);
  }

  query += ' GROUP BY t.project_gid ORDER BY task_count DESC LIMIT 20';

  const result = db.exec(query, params);
  if (!result.length || !result[0].values.length) return [];

  const cols = result[0].columns;
  return result[0].values.map((row: unknown[]) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((c: string, i: number) => obj[c] = row[i]);
    return {
      projectGid: obj.project_gid as string,
      projectName: obj.project_name as string,
      taskCount: obj.task_count as number,
      latestTaskName: obj.latest_task as string,
    };
  });
}

// --- Update existing builds by checking Asana task completion ---

async function updateExistingBuilds(): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  const active = db.exec(`
    SELECT id, asana_project_gid, checklist, status
    FROM campaign_builds
    WHERE status IN ('in_progress', 'qa_pending')
  `);

  if (!active.length || !active[0].values.length) return;

  for (const row of active[0].values) {
    const [id, projectGid, checklistJson, status] = row as [number, string, string, string];

    if (!projectGid) continue;

    // Count completed vs total tasks in the project
    const taskStats = db.exec(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as done
      FROM asana_tasks
      WHERE project_gid = ?
    `, [projectGid]);

    if (!taskStats.length || !taskStats[0].values.length) continue;

    const [total, done] = taskStats[0].values[0] as [number, number];
    const completion = total > 0 ? done / total : 0;

    // Check if QA has been passed
    const qaResult = db.exec(`
      SELECT grade FROM qa_grades
      WHERE deliverable_ref = ? AND grade = 'pass'
      LIMIT 1
    `, [projectGid]);

    const qaPassed = qaResult.length > 0 && qaResult[0].values.length > 0;

    let newStatus = status;
    if (completion >= 0.8 && !qaPassed) {
      newStatus = 'qa_pending';
    }
    if (qaPassed && completion >= 0.8) {
      newStatus = 'ready_to_launch';
    }

    if (newStatus !== status) {
      db.run(
        'UPDATE campaign_builds SET status = ?, updated_at = ? WHERE id = ?',
        [newStatus, now, id],
      );
      log('CAMPAIGN', `  ${projectGid}: ${status} -> ${newStatus} (${done}/${total} tasks, QA ${qaPassed ? 'passed' : 'pending'})`);
    }
  }

  saveDb();
}

// --- Status report ---

async function showStatus(clientFilter?: string): Promise<void> {
  const db = await getDb();

  let query = `
    SELECT client_name, campaign_name, platform, status, checklist, created_at, updated_at
    FROM campaign_builds
    WHERE status != 'launched'
  `;

  const params: string[] = [];
  if (clientFilter) {
    query += ' AND client_name LIKE ?';
    params.push(`%${clientFilter}%`);
  }
  query += ' ORDER BY created_at DESC';

  const result = db.exec(query, params);
  if (!result.length || !result[0].values.length) {
    log('CAMPAIGN', 'No active campaign builds');
    return;
  }

  console.log('\n=== Active Campaign Builds ===\n');

  for (const row of result[0].values) {
    const [client, name, platform, status, checklistJson, created, updated] = row as string[];
    const checklist: ChecklistItem[] = JSON.parse(checklistJson);
    const done = checklist.filter((i) => i.status === 'done').length;
    const total = checklist.length;
    const pct = Math.round((done / total) * 100);

    const statusIcon = {
      in_progress: 'IN PROG',
      qa_pending: 'QA PEND',
      ready_to_launch: 'READY',
      launched: 'LIVE',
    }[status] ?? status;

    console.log(`  ${client} — ${name}`);
    console.log(`    Platform: ${platform} | Status: ${statusIcon} | Progress: ${done}/${total} (${pct}%)`);
    console.log(`    Created: ${created?.split('T')[0]} | Updated: ${updated?.split('T')[0]}`);

    // Show incomplete items
    const incomplete = checklist.filter((i) => i.status !== 'done');
    if (incomplete.length <= 5) {
      for (const item of incomplete) {
        console.log(`    [ ] ${item.step} (${item.owner})`);
      }
    } else {
      console.log(`    ${incomplete.length} items remaining`);
    }
    console.log('');
  }
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

  // Update existing builds
  log('CAMPAIGN', 'Updating existing campaign builds...');
  await updateExistingBuilds();

  // Find new campaign candidates
  const candidates = await findCampaignCandidates(clientFilter);

  if (!candidates.length) {
    log('CAMPAIGN', 'No new campaign builds detected');
    closeDb();
    return;
  }

  log('CAMPAIGN', `Found ${candidates.length} new campaign build(s)`);
  const db = await getDb();
  const now = new Date().toISOString();

  for (const candidate of candidates) {
    const platform = detectPlatform(candidate.projectName + ' ' + candidate.latestTaskName);
    const checklist = generateChecklist(platform);
    const campaignName = candidate.projectName;
    const clientName = candidate.projectName; // best proxy we have

    db.run(
      `INSERT INTO campaign_builds
        (client_name, campaign_name, platform, asana_project_gid, checklist, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'in_progress', ?, ?)`,
      [clientName, campaignName, platform, candidate.projectGid, JSON.stringify(checklist), now, now],
    );

    log('CAMPAIGN', `  Created build: ${campaignName} [${platform}] — ${checklist.length} checklist items`);
  }

  saveDb();
  log('CAMPAIGN', 'Campaign build scan complete');
  closeDb();
}

main().catch((err) => {
  logError('CAMPAIGN', 'Campaign build check failed', err);
  process.exit(1);
});
