/**
 * Seed treatment_types reference table with dental vertical data.
 *
 * Idempotent — safe to run multiple times (uses INSERT OR REPLACE).
 *
 * Usage:
 *   npm run seed:treatments
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';

interface TreatmentType {
  slug: string;
  label: string;
  default_value: number;
  vertical: string;
  keywords: string[];
}

const TREATMENTS: TreatmentType[] = [
  {
    slug: 'implants',
    label: 'Dental Implants',
    default_value: 3500,
    vertical: 'dental',
    keywords: ['implant', 'implants', 'all-on-4', 'all on 4'],
  },
  {
    slug: 'invisalign',
    label: 'Invisalign',
    default_value: 3500,
    vertical: 'dental',
    keywords: ['invisalign', 'aligners', 'braces', 'clear aligners'],
  },
  {
    slug: 'composite_bonding',
    label: 'Composite Bonding',
    default_value: 1500,
    vertical: 'dental',
    keywords: ['bonding', 'composite', 'veneers'],
  },
  {
    slug: 'whitening',
    label: 'Teeth Whitening',
    default_value: 400,
    vertical: 'dental',
    keywords: ['whitening', 'bleaching'],
  },
  {
    slug: 'general',
    label: 'General Dentistry',
    default_value: 250,
    vertical: 'dental',
    keywords: ['checkup', 'check-up', 'cleaning', 'filling', 'extraction'],
  },
  {
    slug: 'emergency',
    label: 'Emergency',
    default_value: 150,
    vertical: 'dental',
    keywords: ['emergency', 'pain', 'toothache'],
  },
];

async function main() {
  await initSchema();
  const db = await getDb();

  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS treatment_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL,
        default_value REAL NOT NULL DEFAULT 0,
        vertical TEXT NOT NULL DEFAULT 'dental',
        keywords TEXT
      )
    `);

    log('SEED', `Seeding ${TREATMENTS.length} treatment types...`);

    for (const t of TREATMENTS) {
      db.run(
        `INSERT OR REPLACE INTO treatment_types (slug, label, default_value, vertical, keywords)
         VALUES (?, ?, ?, ?, ?)`,
        [t.slug, t.label, t.default_value, t.vertical, JSON.stringify(t.keywords)]
      );
      log('SEED', `  ${t.slug}: ${t.label} (£${t.default_value})`);
    }

    saveDb();
    log('SEED', `Seed complete: ${TREATMENTS.length} treatment types inserted.`);
  } catch (err) {
    logError('SEED', 'Seed failed', err);
    process.exit(1);
  } finally {
    closeDb();
  }
}

main();
