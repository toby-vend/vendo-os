import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@libsql/client';
import { resolve } from 'path';

const url = process.env.TURSO_DATABASE_URL || `file:${resolve(process.cwd(), 'data/vendo.db')}`;
console.log('Target:', url.startsWith('file:') ? `LOCAL ${url}` : `TURSO ${url.split('@')[1] || url}`);

const c = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const r = await c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'client%' ORDER BY name");
for (const row of r.rows) console.log(' -', row.name);
