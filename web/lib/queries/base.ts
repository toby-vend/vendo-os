import { createClient, type Client, type InStatement, type Row } from '@libsql/client';
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
// the database are not, so a write is never applied twice. A reused socket the server already closed surfaces as
// "socket hang up" (ECONNRESET), which can't tell us whether the request landed, so it is retried only for
// statements that are safe to repeat (reads and CREATE … IF NOT EXISTS).
const BEFORE_SEND = /EPIPE|ENOTFOUND|EAI_AGAIN|ECONNREFUSED/;
const CONN_RESET = /socket hang up|ECONNRESET/;
const REPEATABLE = /^\s*(SELECT|WITH|PRAGMA|CREATE\s+(TABLE|INDEX)\s+IF\s+NOT\s+EXISTS)\b/i;
const client: Client = new Proxy(raw, {
  get(target, prop, receiver) {
    if (prop === 'execute') {
      return async (...args: Parameters<Client['execute']>) => {
        try {
          return await target.execute(...args);
        } catch (err) {
          const message = String((err as Error)?.message ?? err);
          const stmt = args[0] as InStatement;
          const sql = typeof stmt === 'string' ? stmt : stmt.sql;
          if (!BEFORE_SEND.test(message) && !(CONN_RESET.test(message) && REPEATABLE.test(sql))) throw err;
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
