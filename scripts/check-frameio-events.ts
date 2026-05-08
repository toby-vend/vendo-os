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

  const r = await client.execute('SELECT id, event_id, event_type, resource_type, resource_id, received_at, processing_status, processing_error FROM frameio_events ORDER BY received_at DESC LIMIT 10');
  console.log('\nLatest 10 rows:');
  for (const row of r.rows) {
    console.log(JSON.stringify(row));
  }

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = await client.execute({
    sql: 'SELECT id, event_type, resource_type, received_at, headers, payload FROM frameio_events WHERE received_at >= ? ORDER BY received_at DESC',
    args: [since]
  });
  console.log(`\nRows in last 60 min: ${recent.rows.length}`);
  for (const row of recent.rows) {
    console.log('---');
    console.log('id:', row.id, 'type:', row.event_type, 'resource:', row.resource_type, 'at:', row.received_at);
    const headers = JSON.parse(row.headers as string);
    const interesting = Object.entries(headers).filter(([k]) => /signature|frameio|frame-io|webhook|x-/.test(k.toLowerCase()));
    console.log('Frame.io / signature-ish headers:', interesting);
    const payload = (row.payload as string).slice(0, 300);
    console.log('Payload preview:', payload);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
