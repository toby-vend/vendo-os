/**
 * Role Registry — define, query, and maintain team roles and responsibilities.
 *
 * Each role has: title, holder, reports_to, responsibilities, KPIs, tools.
 * Seeds with Vendo's current team structure on first run.
 *
 * Usage:
 *   npx tsx scripts/functions/role-registry.ts              # show all roles
 *   npx tsx scripts/functions/role-registry.ts --seed        # seed default roles
 *   npx tsx scripts/functions/role-registry.ts --role "AM"   # show specific role
 *   npx tsx scripts/functions/role-registry.ts --kpis        # show all KPIs by role
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';

// --- Default Vendo roles ---

interface RoleDefinition {
  title: string;
  holder: string | null;
  reportsTo: string;
  responsibilities: string[];
  kpis: string[];
  tools: string[];
}

const DEFAULT_ROLES: RoleDefinition[] = [
  {
    title: 'Founder / Managing Director',
    holder: 'Toby',
    reportsTo: 'N/A',
    responsibilities: [
      'Business strategy and vision',
      'Key client relationships',
      'Team leadership and hiring',
      'Financial oversight',
      'New business development',
      'High-value creative/strategy review',
    ],
    kpis: ['Revenue growth (MRR)', 'Client retention rate', 'Team utilisation', 'Net profit margin'],
    tools: ['Claude Code', 'GHL', 'Xero', 'Slack', 'Asana', 'Google Ads', 'Meta Ads'],
  },
  {
    title: 'Operations Manager',
    holder: 'Sarah',
    reportsTo: 'Founder',
    responsibilities: [
      'Leave and absence management',
      'Payroll and expenses processing',
      'Staff onboarding/offboarding admin',
      'Client invoicing via Xero',
      'Office and IT administration',
      'Compliance and HR documentation',
    ],
    kpis: ['Invoice accuracy', 'Payroll timeliness', 'Onboarding completion rate', 'Expense processing time'],
    tools: ['Xero', 'Asana', 'Slack', 'Google Drive', 'GHL'],
  },
  {
    title: 'Account Manager',
    holder: null,
    reportsTo: 'Founder',
    responsibilities: [
      'Client communication and relationship management',
      'Campaign brief creation and approval',
      'Monthly reporting and strategy reviews',
      'Client onboarding coordination',
      'Upsell identification',
      'Creative and QA review (standard tier)',
    ],
    kpis: ['Client health scores', 'Response time (<4hrs)', 'Report delivery on time', 'Upsell conversion rate'],
    tools: ['GHL', 'Asana', 'Slack', 'Google Ads', 'Meta Ads', 'Google Drive'],
  },
  {
    title: 'Paid Media Specialist',
    holder: null,
    reportsTo: 'Account Manager',
    responsibilities: [
      'Campaign setup and management (Google/Meta)',
      'Ad copy and creative asset creation',
      'Conversion tracking implementation',
      'Performance optimisation',
      'Landing page builds',
      'A/B testing',
    ],
    kpis: ['Campaign ROAS', 'QA pass rate', 'Campaign launch on time', 'CPA targets met'],
    tools: ['Google Ads', 'Meta Ads', 'Google Analytics', 'Unbounce/Instapage', 'Canva', 'Asana'],
  },
  {
    title: 'Cover / Junior AM',
    holder: 'Rhiannon',
    reportsTo: 'Account Manager',
    responsibilities: [
      'Client communication during AM absence',
      'Routine task execution per SOP',
      'Escalation to founder for unresolvable issues',
      'Meeting attendance and note-taking',
    ],
    kpis: ['Escalation rate', 'Task completion during cover', 'Client satisfaction during cover'],
    tools: ['GHL', 'Asana', 'Slack'],
  },
];

// --- Seed roles ---

async function seedRoles(): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  for (const role of DEFAULT_ROLES) {
    db.run(`
      INSERT INTO roles (title, holder, reports_to, responsibilities, kpis, tools, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
      ON CONFLICT(title) DO UPDATE SET
        holder = excluded.holder, reports_to = excluded.reports_to,
        responsibilities = excluded.responsibilities, kpis = excluded.kpis,
        tools = excluded.tools, updated_at = excluded.updated_at
    `, [
      role.title, role.holder, role.reportsTo,
      JSON.stringify(role.responsibilities), JSON.stringify(role.kpis), JSON.stringify(role.tools),
      now, now,
    ]);
  }

  saveDb();
  log('ROLES', `Seeded ${DEFAULT_ROLES.length} roles`);
}

// --- Display ---

async function showRoles(roleFilter?: string): Promise<void> {
  const db = await getDb();

  let query = 'SELECT title, holder, reports_to, responsibilities, kpis, tools, status FROM roles WHERE status = \'active\'';
  const params: string[] = [];

  if (roleFilter) {
    query += ' AND title LIKE ?';
    params.push(`%${roleFilter}%`);
  }

  query += ' ORDER BY CASE WHEN reports_to = \'N/A\' THEN 0 WHEN reports_to = \'Founder\' THEN 1 ELSE 2 END';

  const result = db.exec(query, params);

  if (!result.length || !result[0].values.length) {
    log('ROLES', 'No roles found — run with --seed to populate');
    return;
  }

  console.log('\n=== Vendo Team Roles ===\n');

  for (const row of result[0].values) {
    const [title, holder, reportsTo, respJson, kpisJson, toolsJson] = row as string[];
    const responsibilities: string[] = JSON.parse(respJson);
    const kpis: string[] = JSON.parse(kpisJson);
    const tools: string[] = JSON.parse(toolsJson);

    console.log(`  ${title}${holder ? ' — ' + holder : ''}`);
    console.log(`  Reports to: ${reportsTo}`);
    console.log('  Responsibilities:');
    for (const r of responsibilities) {
      console.log(`    - ${r}`);
    }
    console.log('  KPIs:');
    for (const k of kpis) {
      console.log(`    - ${k}`);
    }
    console.log(`  Tools: ${tools.join(', ')}`);
    console.log('');
  }
}

async function showKpis(): Promise<void> {
  const db = await getDb();

  const result = db.exec(`
    SELECT title, holder, kpis FROM roles WHERE status = 'active'
    ORDER BY title
  `);

  if (!result.length || !result[0].values.length) {
    log('ROLES', 'No roles found');
    return;
  }

  console.log('\n=== KPIs by Role ===\n');

  for (const row of result[0].values) {
    const [title, holder, kpisJson] = row as [string, string | null, string];
    const kpis: string[] = JSON.parse(kpisJson);
    console.log(`  ${title}${holder ? ' (' + holder + ')' : ''}:`);
    for (const k of kpis) {
      console.log(`    - ${k}`);
    }
    console.log('');
  }
}

// --- Main ---

async function main() {
  await initSchema();

  if (process.argv.includes('--seed')) {
    await seedRoles();
  } else if (process.argv.includes('--kpis')) {
    await showKpis();
  } else {
    const roleFilter = process.argv.includes('--role')
      ? process.argv[process.argv.indexOf('--role') + 1]
      : undefined;
    await showRoles(roleFilter);
  }

  closeDb();
}

main().catch((err) => {
  logError('ROLES', 'Role registry failed', err);
  process.exit(1);
});
