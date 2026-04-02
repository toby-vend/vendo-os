/**
 * Referral and Partner Tracking — track referrals, manage rewards, review partners.
 *
 * Referral pipeline:
 *   - Referral received (from client or agency partner)
 *   - Source tagged, prospect contacted
 *   - Conversion tracked
 *   - Reward processed (client = invoice credit, partner = commission)
 *
 * Usage:
 *   npx tsx scripts/functions/referral-tracking.ts                                    # show dashboard
 *   npx tsx scripts/functions/referral-tracking.ts --add "Referrer" "client" "Lead" "Company"  # add referral
 *   npx tsx scripts/functions/referral-tracking.ts --partners                          # partner review
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';

// --- Reward rules ---

const REWARD_RULES: Record<string, { type: string; amount: number; description: string }> = {
  client: { type: 'invoice_credit', amount: 250, description: '£250 invoice credit' },
  partner: { type: 'commission', amount: 500, description: '£500 commission (paid by Sarah)' },
  employee: { type: 'bonus', amount: 100, description: '£100 bonus' },
};

// --- Add referral ---

async function addReferral(
  referrerName: string,
  referrerType: string,
  referredName: string,
  referredCompany: string | null,
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  const reward = REWARD_RULES[referrerType] ?? REWARD_RULES.client;

  db.run(`
    INSERT INTO referrals
      (referrer_name, referrer_type, referred_name, referred_company, status, reward_type, reward_amount, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'received', ?, ?, ?, ?)
  `, [referrerName, referrerType, referredName, referredCompany, reward.type, reward.amount, now, now]);

  saveDb();
  log('REFERRAL', `Added: ${referredName} (${referredCompany ?? ''}) referred by ${referrerName} (${referrerType})`);
  log('REFERRAL', `  Reward on conversion: ${reward.description}`);
}

// --- Auto-match referrals to GHL opportunities ---

async function matchToOpportunities(): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  // Find unmatched referrals
  const unmatched = db.exec(`
    SELECT id, referred_name, referred_company
    FROM referrals
    WHERE ghl_opportunity_id IS NULL AND status IN ('received', 'contacted')
  `);

  if (!unmatched.length || !unmatched[0].values.length) return;

  for (const row of unmatched[0].values) {
    const [id, name, company] = row as [number, string, string | null];

    // Try to match by name or company in GHL opportunities
    const match = db.exec(`
      SELECT id, name, status FROM ghl_opportunities
      WHERE (contact_name LIKE ? OR contact_company LIKE ? OR name LIKE ?)
      ORDER BY created_at DESC LIMIT 1
    `, [`%${name}%`, `%${company ?? name}%`, `%${name}%`]);

    if (match.length && match[0].values.length) {
      const [oppId, _oppName, oppStatus] = match[0].values[0] as [string, string, string];

      db.run(
        'UPDATE referrals SET ghl_opportunity_id = ?, status = ?, updated_at = ? WHERE id = ?',
        [oppId, oppStatus === 'won' ? 'converted' : 'contacted', now, id],
      );

      if (oppStatus === 'won') {
        db.run(
          'UPDATE referrals SET converted = 1, updated_at = ? WHERE id = ?',
          [now, id],
        );
        log('REFERRAL', `  Matched & converted: ${name} → opp ${oppId}`);
      } else {
        log('REFERRAL', `  Matched: ${name} → opp ${oppId} (${oppStatus})`);
      }
    }
  }

  saveDb();
}

// --- Dashboard ---

async function showDashboard(): Promise<void> {
  const db = await getDb();

  // Match any new referrals to GHL opportunities
  await matchToOpportunities();

  // All referrals
  const result = db.exec(`
    SELECT referrer_name, referrer_type, referred_name, referred_company, status, converted, reward_type, reward_amount, reward_paid, created_at
    FROM referrals
    ORDER BY created_at DESC
  `);

  if (!result.length || !result[0].values.length) {
    log('REFERRAL', 'No referrals tracked yet');
    return;
  }

  console.log('\n=== Referral Dashboard ===\n');
  console.log('  Referrer               Type      Referred                 Status      Reward      Paid');
  console.log('  ' + '-'.repeat(95));

  for (const row of result[0].values) {
    const [referrer, rtype, referred, company, status, converted, rewardType, rewardAmt, paid] =
      row as [string, string, string, string | null, string, number, string, number, number];

    const referredStr = company ? `${referred} (${company})` : referred;
    const rewardStr = converted ? `£${rewardAmt}` : '-';
    const paidStr = paid ? 'Yes' : converted ? 'No' : '-';

    console.log(
      `  ${(referrer ?? '').slice(0, 22).padEnd(22)} ` +
      `${(rtype ?? '').padEnd(9)} ` +
      `${referredStr.slice(0, 24).padEnd(24)} ` +
      `${(status ?? '').padEnd(11)} ` +
      `${rewardStr.padEnd(11)} ` +
      `${paidStr}`,
    );
  }

  // Summary
  const summary = db.exec(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN converted = 1 THEN 1 ELSE 0 END) as converted,
      SUM(CASE WHEN reward_paid = 1 THEN reward_amount ELSE 0 END) as paid_out,
      SUM(CASE WHEN converted = 1 AND reward_paid = 0 THEN reward_amount ELSE 0 END) as owing
    FROM referrals
  `);

  if (summary.length && summary[0].values.length) {
    const [total, converted, paid, owing] = summary[0].values[0] as [number, number, number, number];
    const convRate = total > 0 ? ((converted / total) * 100).toFixed(0) : '0';
    console.log(`\n  Total: ${total} | Converted: ${converted} (${convRate}%) | Paid: £${paid ?? 0} | Owing: £${owing ?? 0}`);
  }

  console.log('');
}

// --- Partner review ---

async function showPartnerReview(): Promise<void> {
  const db = await getDb();

  const result = db.exec(`
    SELECT
      referrer_name,
      referrer_type,
      COUNT(*) as total_referrals,
      SUM(CASE WHEN converted = 1 THEN 1 ELSE 0 END) as converted,
      SUM(CASE WHEN reward_paid = 1 THEN reward_amount ELSE 0 END) as total_paid,
      MIN(created_at) as first_referral,
      MAX(created_at) as last_referral
    FROM referrals
    GROUP BY referrer_name, referrer_type
    ORDER BY total_referrals DESC
  `);

  if (!result.length || !result[0].values.length) {
    log('REFERRAL', 'No partner data');
    return;
  }

  console.log('\n=== Partner / Referrer Review ===\n');
  console.log('  Referrer               Type      Referrals  Converted  Conv %   Total Paid  Last Referral');
  console.log('  ' + '-'.repeat(95));

  for (const row of result[0].values) {
    const [name, rtype, total, converted, paid, _first, last] =
      row as [string, string, number, number, number, string, string];

    const convPct = total > 0 ? ((converted / total) * 100).toFixed(0) : '0';
    const lastDate = (last ?? '').split('T')[0];

    console.log(
      `  ${(name ?? '').slice(0, 22).padEnd(22)} ` +
      `${(rtype ?? '').padEnd(9)} ` +
      `${String(total).padStart(9)}  ` +
      `${String(converted).padStart(9)}  ` +
      `${(convPct + '%').padStart(5)}   ` +
      `${('£' + (paid ?? 0)).padStart(10)}  ` +
      `${lastDate}`,
    );
  }

  // Flag inactive partners (no referral in 90+ days)
  const inactive = db.exec(`
    SELECT referrer_name, MAX(created_at) as last_referral
    FROM referrals
    WHERE referrer_type = 'partner'
    GROUP BY referrer_name
    HAVING MAX(created_at) < date('now', '-90 days')
  `);

  if (inactive.length && inactive[0].values.length) {
    console.log('\n  Inactive partners (>90 days):');
    for (const row of inactive[0].values) {
      console.log(`    ${row[0]} — last referral: ${(row[1] as string).split('T')[0]}`);
    }
  }

  console.log('');
}

// --- Main ---

async function main() {
  await initSchema();

  if (process.argv.includes('--add')) {
    const addIdx = process.argv.indexOf('--add');
    const referrer = process.argv[addIdx + 1];
    const rtype = process.argv[addIdx + 2];
    const referred = process.argv[addIdx + 3];
    const company = process.argv[addIdx + 4] ?? null;
    if (!referrer || !rtype || !referred) {
      logError('REFERRAL', 'Usage: --add "Referrer Name" "client|partner|employee" "Lead Name" "Company"');
      process.exit(1);
    }
    await addReferral(referrer, rtype, referred, company);
  } else if (process.argv.includes('--partners')) {
    await showPartnerReview();
  } else {
    await showDashboard();
  }

  closeDb();
}

main().catch((err) => {
  logError('REFERRAL', 'Referral tracking failed', err);
  process.exit(1);
});
