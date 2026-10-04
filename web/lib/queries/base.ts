import { createClient, type Client, type Row } from '@libsql/client';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Use Turso in production, local SQLite file in dev
const raw: Client = createClient({
  url: process.env.TURSO_DATABASE_URL || `file:${resolve(__dirname, '../../../data/vendo.db')}`,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// A connection left idle (e.g. during a 20-minute upload on an editor's laptop) or a Wi-Fi blip can fail the next
// request before it is sent (EPIPE, DNS lookup). Those are retried once; errors after a request may have reached
// the database are not, so a write is never applied twice.
const BEFORE_SEND = /EPIPE|ENOTFOUND|EAI_AGAIN|ECONNREFUSED/;
const client: Client = new Proxy(raw, {
  get(target, prop, receiver) {
    if (prop === 'execute') {
      return async (...args: Parameters<Client['execute']>) => {
        try {
          return await target.execute(...args);
        } catch (err) {
          if (!BEFORE_SEND.test(String((err as Error)?.message ?? err))) throw err;
          await new Promise((r) => setTimeout(r, 1000));
          return target.execute(...args);
        }
      };
    }
    const value = Reflect.get(target, prop, receiver);
    return typeof value === 'function' ? value.bind(target) : value;
  },
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
