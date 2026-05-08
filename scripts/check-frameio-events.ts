import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@libsql/client';

async function main() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  const total = await client.execute('SELECT COUNT(*) AS n FROM frameio_events');
  console.log('Total rows:', total.rows[0].n);

  const r = await client.execute('SELECT id, event_type, resource_type, received_at, processing_status FROM frameio_events ORDER BY received_at DESC LIMIT 10');
  console.log('\nLatest 10:');
  for (const row of r.rows) {
    console.log(`  id=${row.id}  ${row.received_at}  ${row.event_type}/${row.resource_type}  status=${row.processing_status}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
