/**
 * Set an API key for a GHL location.
 * Usage: npx tsx scripts/sync/set-ghl-key.ts <location_id> <api_key>
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb } from '../utils/db.js';

async function main() {
  const [locationId, apiKey] = process.argv.slice(2);

  if (!locationId || !apiKey) {
    console.error('Usage: npx tsx scripts/sync/set-ghl-key.ts <location_id> <api_key>');
    process.exit(1);
  }

  await initSchema();
  const db = await getDb();

  try { db.run('ALTER TABLE ghl_locations ADD COLUMN api_key TEXT'); } catch { /* exists */ }

  db.run('UPDATE ghl_locations SET api_key = ? WHERE id = ?', [apiKey, locationId]);

  const result = db.exec('SELECT id, name FROM ghl_locations WHERE id = ?', [locationId]);
  if (result.length > 0 && result[0].values.length > 0) {
    const name = result[0].values[0][1];
    console.log(`Key set for: ${name} (${locationId})`);
  } else {
    console.log(`Warning: location ${locationId} not found in ghl_locations table`);
  }

  // Show summary
  const keyed = db.exec('SELECT name FROM ghl_locations WHERE api_key IS NOT NULL ORDER BY name');
  if (keyed.length > 0) {
    console.log(`\nLocations with keys (${keyed[0].values.length} total):`);
    keyed[0].values.forEach((r: any) => console.log(`  - ${r[0]}`));
  }

  saveDb();
  closeDb();
}

main();
