/**
 * Backup and Disaster Recovery — database backup, recovery procedures, key rotation reminders.
 *
 * Usage:
 *   npx tsx scripts/functions/backup-recovery.ts --backup    # backup local DB
 *   npx tsx scripts/functions/backup-recovery.ts --status    # show backup status
 *   npx tsx scripts/functions/backup-recovery.ts --verify    # verify latest backup
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { log, logError } from '../utils/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');
const DB_PATH = resolve(PROJECT_ROOT, 'data/vendo.db');
const BACKUP_DIR = resolve(PROJECT_ROOT, 'data/backups');

function ensureBackupDir(): void {
  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });
}

async function createBackup(): Promise<void> {
  ensureBackupDir();

  if (!existsSync(DB_PATH)) {
    logError('BACKUP', 'Database not found at ' + DB_PATH);
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupPath = resolve(BACKUP_DIR, `vendo-${timestamp}.db`);

  copyFileSync(DB_PATH, backupPath);
  const size = statSync(backupPath).size;

  log('BACKUP', `Created: ${backupPath}`);
  log('BACKUP', `  Size: ${(size / 1024 / 1024).toFixed(2)} MB`);

  // Clean old backups (keep last 10)
  const backups = readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('vendo-') && f.endsWith('.db'))
    .sort()
    .reverse();

  if (backups.length > 10) {
    const toDelete = backups.slice(10);
    for (const f of toDelete) {
      const { unlinkSync } = await import('fs');
      unlinkSync(resolve(BACKUP_DIR, f));
      log('BACKUP', `  Cleaned old backup: ${f}`);
    }
  }
}

async function showStatus(): Promise<void> {
  ensureBackupDir();

  const backups = readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('vendo-') && f.endsWith('.db'))
    .sort()
    .reverse();

  console.log('\n=== Backup Status ===\n');

  if (!backups.length) {
    console.log('  No backups found. Run --backup to create one.\n');
    return;
  }

  console.log('  Backups:');
  for (const f of backups) {
    const s = statSync(resolve(BACKUP_DIR, f));
    console.log(`    ${f}  (${(s.size / 1024 / 1024).toFixed(2)} MB)`);
  }

  // DB status
  if (existsSync(DB_PATH)) {
    const dbSize = statSync(DB_PATH).size;
    console.log(`\n  Current DB: ${(dbSize / 1024 / 1024).toFixed(2)} MB`);
  }

  // Recovery checklist
  console.log('\n  Recovery procedure:');
  console.log('    1. Stop any running sync scripts');
  console.log('    2. Copy backup to data/vendo.db');
  console.log('    3. Run npm run db:init to verify schema');
  console.log('    4. Run npm run sync:all to refresh from APIs');
  console.log('');
}

async function verifyBackup(): Promise<void> {
  ensureBackupDir();

  const backups = readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('vendo-') && f.endsWith('.db'))
    .sort()
    .reverse();

  if (!backups.length) {
    logError('BACKUP', 'No backups to verify');
    return;
  }

  const latest = backups[0];
  const backupPath = resolve(BACKUP_DIR, latest);
  const size = statSync(backupPath).size;

  // Basic verification: file exists and has reasonable size
  if (size < 1024) {
    logError('BACKUP', `Latest backup ${latest} is suspiciously small (${size} bytes)`);
    return;
  }

  log('BACKUP', `Verified: ${latest} (${(size / 1024 / 1024).toFixed(2)} MB) — OK`);
}

async function main() {
  if (process.argv.includes('--backup')) { await createBackup(); }
  else if (process.argv.includes('--verify')) { await verifyBackup(); }
  else { await showStatus(); }
}

main().catch((err) => { logError('BACKUP', 'Failed', err); process.exit(1); });
