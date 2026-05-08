import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@libsql/client';

async function main() {
  const c = createClient({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN! });

  console.log('=== frameio_events: status breakdown ===');
  const breakdown = await c.execute("SELECT processing_status, COUNT(*) AS n FROM frameio_events GROUP BY processing_status");
  for (const r of breakdown.rows) console.log(`  ${r.processing_status}: ${r.n}`);

  console.log('\n=== frameio_events: latest 5 ===');
  const events = await c.execute('SELECT id, event_type, processing_status, processed_at, processing_error FROM frameio_events ORDER BY id DESC LIMIT 5');
  for (const r of events.rows) console.log(`  id=${r.id} ${r.event_type} status=${r.processing_status} processed=${r.processed_at} err=${r.processing_error}`);

  console.log('\n=== frameio_projects ===');
  try {
    const projects = await c.execute('SELECT * FROM frameio_projects');
    console.log(`  ${projects.rows.length} project(s)`);
    for (const p of projects.rows) console.log(`  ${p.project_id}  name=${p.name}`);
  } catch (e) { console.log('  not yet created'); }

  console.log('\n=== client_source_mappings (frameio) ===');
  const maps = await c.execute("SELECT * FROM client_source_mappings WHERE source='frameio'");
  console.log(`  ${maps.rows.length} mapping(s)`);
  for (const m of maps.rows) console.log(`  client_id=${m.client_id} project=${m.external_id} name=${m.external_name}`);

  console.log('\n=== frameio_project_match_queue ===');
  try {
    const q = await c.execute('SELECT * FROM frameio_project_match_queue');
    console.log(`  ${q.rows.length} queued`);
    for (const r of q.rows) console.log(`  project=${r.project_id} best=${r.best_client_name} confidence=${r.best_confidence} method=${r.best_method}`);
  } catch (e) { console.log('  not yet created'); }

  console.log('\n=== creative_reviews (frameio-sourced) ===');
  try {
    const r = await c.execute("SELECT id, client_name, asset_name, status, frameio_file_id, feedback, revision_count FROM creative_reviews WHERE frameio_file_id IS NOT NULL");
    console.log(`  ${r.rows.length} row(s)`);
    for (const row of r.rows) console.log(`  id=${row.id} client=${row.client_name} asset=${row.asset_name} status=${row.status} rev=${row.revision_count}`);
  } catch (e) { console.log('  ', (e as Error).message); }
}
main().catch(e => { console.error(e); process.exit(1); });
