import { createClient, type Client, type Row } from '@libsql/client';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Use Turso in production, local SQLite file in dev
const client: Client = createClient({
  url: process.env.TURSO_DATABASE_URL || `file:${resolve(__dirname, '../../../data/vendo.db')}`,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export { client as db };

// --- Helpers ---

export async function rows<T>(sql: string, args: (string | number | null)[] = []): Promise<T[]> {
  const result = await client.execute({ sql, args });
  return result.rows as unknown as T[];
}

export async function scalar<T = number>(sql: string, args: (string | number | null)[] = []): Promise<T | null> {
  const result = await client.execute({ sql, args });
  if (!result.rows.length) return null;
  const row = result.rows[0];
  return row[result.columns[0]] as T;
}
