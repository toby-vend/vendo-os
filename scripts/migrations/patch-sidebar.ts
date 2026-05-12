/**
 * One-shot: force the sidebar_config DB row to be patched with any new
 * items added to DEFAULT_SIDEBAR_CONFIG. Run this after adding a new
 * admin nav entry if you don't want to wait for the next cold-start
 * cycle to run migrateSidebarConfig() automatically.
 *
 * Usage: npx tsx scripts/migrations/patch-sidebar.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

const { migrateSidebarConfig, getSidebarConfig } = await import('../../web/lib/queries/sidebar.js');

await migrateSidebarConfig();
const cfg = await getSidebarConfig();
const admin = cfg.find(g => g.id === 'admin');
console.log('Admin group items after patch:');
for (const i of admin?.items ?? []) {
  console.log(`  - ${i.id.padEnd(28)} → ${i.href}`);
}
