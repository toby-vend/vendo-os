/**
 * Seed the 17 SOPs from local markdown files into the skills table + FTS5 index.
 * This is a one-off script to populate the database before the Drive webhook sync
 * is activated. Once webhooks are live, Drive changes are indexed automatically.
 *
 * Usage: npx tsx scripts/seed-drive-sops.ts
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { updateSkillContent } from '../web/lib/queries/drive.js';
import { db } from '../web/lib/queries/base.js';

interface SopEntry {
  file: string;
  driveFileId: string;
  title: string;
  channel: string;
  skillType: string;
}

// Map local markdown files to their Drive doc IDs and metadata
const SOPS: SopEntry[] = [
  // Paid Social
  { file: 'outputs/sops/paid-social/sop-1-performance-sops.md', driveFileId: '11qVwq70_QZHIvNh76XswSWg_CBJ8jfdW-wQRJJGxMhE', title: 'Paid Social — Performance SOP', channel: 'paid_social', skillType: 'performance_sop' },
  { file: 'outputs/sops/paid-social/sop-2-ad-copy-templates.md', driveFileId: '18qP9WMXVcil-9muuhnU5iVtpQog96WL2iw1UN1O33Fo', title: 'Paid Social — Ad Copy Templates', channel: 'paid_social', skillType: 'ad_copy_template' },
  { file: 'outputs/sops/paid-social/sop-3-creative-frameworks.md', driveFileId: '10Bwxi3cwM2AGifXKAXN2czWedVkHf2f326-y4aPJYyI', title: 'Paid Social — Creative Frameworks', channel: 'paid_social', skillType: 'creative_framework' },
  { file: 'outputs/sops/paid-social/sop-4-audience-research.md', driveFileId: '17ADFpyn1j7JGb1Jye9pAPS9AKVTX-U6T6Wl9BBcjGAU', title: 'Paid Social — Audience Research', channel: 'paid_social', skillType: 'audience_research' },
  { file: 'outputs/sops/paid-social/sop-5-reporting-templates.md', driveFileId: '1dVg7nXpVQxPRXhn13EdlJctyflAGOf3fJAhg_NZ_YLE', title: 'Paid Social — Reporting Templates', channel: 'paid_social', skillType: 'reporting_template' },
  { file: 'outputs/sops/paid-social/sop-6-client-comms.md', driveFileId: '1l0T-PfEFJUmkPxbnCadBBJfNBwGpJHRwA2jBa4Nucmw', title: 'Paid Social — Client Comms', channel: 'paid_social', skillType: 'client_comms' },
  // SEO
  { file: 'outputs/sops/seo/performance-sops/seo-performance-sops.md', driveFileId: '1RnDvxK9ACVc_24C4eNamW5lokxu5XFtD-GF8qLMFmCU', title: 'SEO — Performance SOP', channel: 'seo', skillType: 'performance_sop' },
  { file: 'outputs/sops/seo/content-guides/seo-content-guides.md', driveFileId: '17w9K3TA99fwwWXjzYN9riJPWmlhWD8ITC0b6UAu3ESA', title: 'SEO — Content Guides', channel: 'seo', skillType: 'content_guide' },
  { file: 'outputs/sops/seo/reporting-templates/seo-reporting-templates.md', driveFileId: '1tJvWVXyyc6DkRxFQinVAwq0jy6R3FGybteg2D6bPCdc', title: 'SEO — Reporting Templates', channel: 'seo', skillType: 'reporting_template' },
  { file: 'outputs/sops/seo/client-comms/seo-client-comms.md', driveFileId: '1cJmme2bEsJCR3iAJeTCH5FeqPrtDjTTdRPSuLzw1QEQ', title: 'SEO — Client Comms', channel: 'seo', skillType: 'client_comms' },
  { file: 'outputs/sops/seo/onboarding/seo-onboarding.md', driveFileId: '1pzq1B7sduLZfovrJHP0etAPlIM81DsmWVK7L-cnJ-Hc', title: 'SEO — Onboarding', channel: 'seo', skillType: 'onboarding' },
  // Paid Ads
  { file: 'outputs/sops/paid-ads/performance-sops/performance-sops.md', driveFileId: '13_P0H-KTXe_FkWkIo96mH0fG2Dsd8wzp9DfSSHGObNo', title: 'Paid Ads — Performance SOP', channel: 'paid_ads', skillType: 'performance_sop' },
  { file: 'outputs/sops/paid-ads/ad-copy-templates/ad-copy-templates.md', driveFileId: '145LfAiB5n_My_wRbjQEThbXKb7MZN8yfuX3A_0Ct76A', title: 'Paid Ads — Ad Copy Templates', channel: 'paid_ads', skillType: 'ad_copy_template' },
  { file: 'outputs/sops/paid-ads/reporting-templates/reporting-templates.md', driveFileId: '1Iamfqni7rOLcunDoGM9xt6tHmcK05P-auw8SWrvq-E0', title: 'Paid Ads — Reporting Templates', channel: 'paid_ads', skillType: 'reporting_template' },
  { file: 'outputs/sops/paid-ads/client-comms/client-comms.md', driveFileId: '1ijHjHFcziVe1hYKh2qioD8Y__nq1vM-xkupClZM9Qzg', title: 'Paid Ads — Client Comms', channel: 'paid_ads', skillType: 'client_comms' },
  // General
  { file: 'plans/sops/general/onboarding/SOP-client-onboarding.md', driveFileId: '1CRIo5mh90Or-wUb-NNKOgesvyzhZA8mVmDLjViIL1vw', title: 'General — Client Onboarding (Master SOP)', channel: 'general', skillType: 'onboarding' },
  { file: 'plans/sops/general/client-comms/SOP-client-comms.md', driveFileId: '1DDltzI-putiO-0lVSIw8-GyBh3UobtrAn9GTq6QjLOM', title: 'General — Client Communications (Master SOP)', channel: 'general', skillType: 'client_comms' },
];

async function main() {
  // Ensure skills table and FTS5 index exist
  await db.execute({ sql: `CREATE TABLE IF NOT EXISTS skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drive_file_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    content_hash TEXT NOT NULL DEFAULT '',
    channel TEXT NOT NULL,
    skill_type TEXT NOT NULL DEFAULT 'sop',
    drive_modified_at TEXT NOT NULL,
    indexed_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1
  )`, args: [] });

  await db.execute({ sql: `CREATE VIRTUAL TABLE IF NOT EXISTS skills_fts USING fts5(
    title, content, content='skills', content_rowid='rowid'
  )`, args: [] });

  const now = new Date().toISOString();

  for (const sop of SOPS) {
    const content = readFileSync(sop.file, 'utf-8');
    const contentHash = createHash('sha256').update(content, 'utf8').digest('hex');

    await updateSkillContent({
      driveFileId: sop.driveFileId,
      title: sop.title,
      content,
      contentHash,
      channel: sop.channel,
      skillType: sop.skillType,
      driveModifiedAt: now,
    });

    console.log(`  Indexed: ${sop.title} (${sop.channel}/${sop.skillType})`);
  }

  console.log(`\nDone: ${SOPS.length} SOPs indexed into skills table + FTS5.`);
}

main().catch(err => { console.error(err); process.exit(1); });
