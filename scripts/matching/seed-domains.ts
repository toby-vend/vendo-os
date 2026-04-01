/**
 * One-time seeder — populates contact_email_domains from existing
 * Xero contacts and GHL opportunities. Run once then incrementally
 * via the domain learner.
 *
 * Usage: npx tsx scripts/matching/seed-domains.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log } from '../utils/db.js';
import { VENDO_TEAM_DOMAINS, GENERIC_EMAIL_DOMAINS } from './team.js';

async function seedDomains() {
  await initSchema();
  const db = await getDb();
  const now = new Date().toISOString();
  let seeded = 0;

  // Seed from Xero contacts linked to clients
  const xero = db.exec(`
    SELECT xc.email, c.name
    FROM xero_contacts xc
    JOIN clients c ON c.xero_contact_id = xc.id
    WHERE xc.email IS NOT NULL AND xc.email != ''
      AND xc.is_customer = 1
  `);

  if (xero.length) {
    for (const row of xero[0].values) {
      const email = (row[0] as string).toLowerCase();
      const clientName = row[1] as string;
      const domain = email.split('@')[1];
      if (!domain) continue;
      if (VENDO_TEAM_DOMAINS.has(domain) || GENERIC_EMAIL_DOMAINS.has(domain)) continue;

      try {
        db.run(
          `INSERT OR IGNORE INTO contact_email_domains (domain, client_name, source, contact_email, created_at)
           VALUES (?, ?, 'xero', ?, ?)`,
          [domain, clientName, email, now],
        );
        seeded++;
      } catch { /* duplicate */ }
    }
  }

  log('SEED', `Seeded ${seeded} domains from Xero contacts`);

  // Seed from Xero contacts with email but no client link (use contact name as client)
  const xeroUnlinked = db.exec(`
    SELECT xc.email, xc.name
    FROM xero_contacts xc
    LEFT JOIN clients c ON c.xero_contact_id = xc.id
    WHERE xc.email IS NOT NULL AND xc.email != ''
      AND xc.is_customer = 1
      AND c.id IS NULL
  `);

  let xeroUnlinkedCount = 0;
  if (xeroUnlinked.length) {
    for (const row of xeroUnlinked[0].values) {
      const email = (row[0] as string).toLowerCase();
      const contactName = row[1] as string;
      const domain = email.split('@')[1];
      if (!domain) continue;
      if (VENDO_TEAM_DOMAINS.has(domain) || GENERIC_EMAIL_DOMAINS.has(domain)) continue;

      try {
        db.run(
          `INSERT OR IGNORE INTO contact_email_domains (domain, client_name, source, contact_email, created_at)
           VALUES (?, ?, 'xero', ?, ?)`,
          [domain, contactName, email, now],
        );
        xeroUnlinkedCount++;
      } catch { /* duplicate */ }
    }
  }

  log('SEED', `Seeded ${xeroUnlinkedCount} domains from unlinked Xero contacts`);

  // Seed from GHL opportunities
  let ghlCount = 0;
  const ghl = db.exec(`
    SELECT contact_email, COALESCE(contact_company, contact_name) as company
    FROM ghl_opportunities
    WHERE contact_email IS NOT NULL AND contact_email != ''
      AND COALESCE(contact_company, contact_name) IS NOT NULL
  `);

  if (ghl.length) {
    for (const row of ghl[0].values) {
      const email = (row[0] as string).toLowerCase();
      const company = row[1] as string;
      const domain = email.split('@')[1];
      if (!domain) continue;
      if (VENDO_TEAM_DOMAINS.has(domain) || GENERIC_EMAIL_DOMAINS.has(domain)) continue;

      try {
        db.run(
          `INSERT OR IGNORE INTO contact_email_domains (domain, client_name, source, contact_email, created_at)
           VALUES (?, ?, 'ghl', ?, ?)`,
          [domain, company, email, now],
        );
        ghlCount++;
      } catch { /* duplicate */ }
    }
  }

  log('SEED', `Seeded ${ghlCount} domains from GHL opportunities`);

  // Summary
  const total = db.exec('SELECT COUNT(*) FROM contact_email_domains');
  const totalCount = total.length ? total[0].values[0][0] : 0;
  log('SEED', `Total domain mappings: ${totalCount}`);

  saveDb();
  closeDb();
}

seedDomains().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
