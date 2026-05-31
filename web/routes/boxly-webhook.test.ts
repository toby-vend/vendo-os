import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';

// Point the DB at an in-memory libSQL instance BEFORE importing anything that
// pulls in lib/queries/base.js (which reads TURSO_DATABASE_URL at import time).
process.env.TURSO_DATABASE_URL = ':memory:';
delete process.env.TURSO_AUTH_TOKEN;
process.env.BOXLY_WEBHOOK_TOKEN = 'test-token-0123456789abcdef';

const { db } = await import('../lib/queries/base.js');
const { boxlyWebhookRoutes } = await import('./boxly-webhook.js');

const TOKEN = process.env.BOXLY_WEBHOOK_TOKEN!;

describe('POST /api/boxly/webhook', () => {
  let app: ReturnType<typeof Fastify>;

  before(async () => {
    // Minimal clients table so the boxly_leads FK reference resolves.
    await db.execute(`CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY, name TEXT)`);
    await db.execute(`INSERT OR IGNORE INTO clients (id, name) VALUES (1, 'Test Client')`);
    app = Fastify({ logger: false });
    app.register(boxlyWebhookRoutes, { prefix: '/api/boxly' });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  it('rejects a missing token with 403', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/boxly/webhook?client=1',
      payload: { email: 'a@b.com' },
    });
    assert.equal(res.statusCode, 403);
  });

  it('rejects a wrong token with 403', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/boxly/webhook?client=1&token=wrong',
      payload: { email: 'a@b.com' },
    });
    assert.equal(res.statusCode, 403);
  });

  it('rejects a missing client id with 400', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/boxly/webhook?token=${TOKEN}`,
      payload: { email: 'a@b.com' },
    });
    assert.equal(res.statusCode, 400);
  });

  it('accepts a valid lead, archives + normalises it', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/boxly/webhook?client=1&token=${TOKEN}`,
      payload: {
        lead_id: 'L-1',
        full_name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '07700900111',
        message: 'Invisalign please',
        entry_point_url: 'https://clinic.com/?utm_source=google&utm_medium=cpc&gclid=GC1',
        box: 'New Enquiries',
        stage: 'New',
      },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.payload).channel, 'google');

    const ev = await db.execute('SELECT COUNT(*) AS n FROM boxly_events WHERE client_id = 1');
    assert.equal(Number(ev.rows[0].n), 1);

    const lead = await db.execute('SELECT * FROM boxly_leads WHERE client_id = 1 AND boxly_lead_id = ?', ['L-1']);
    assert.equal(lead.rows.length, 1);
    assert.equal(lead.rows[0].channel, 'google');
    assert.equal(lead.rows[0].gclid, 'GC1');
    assert.equal(lead.rows[0].contact_email, 'jane@example.com');
  });

  it('dedups a re-sent identical lead (Zapier retry)', async () => {
    const payload = {
      lead_id: 'L-2', email: 'bob@example.com',
      entry_point_url: 'https://clinic.com/?fbclid=FB1',
    };
    await app.inject({ method: 'POST', url: `/api/boxly/webhook?client=1&token=${TOKEN}`, payload });
    await app.inject({ method: 'POST', url: `/api/boxly/webhook?client=1&token=${TOKEN}`, payload });

    const lead = await db.execute('SELECT COUNT(*) AS n FROM boxly_leads WHERE client_id = 1 AND boxly_lead_id = ?', ['L-2']);
    assert.equal(Number(lead.rows[0].n), 1, 'retry must collapse to one row');
  });

  it('classifies an fbclid lead as meta', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/boxly/webhook?client=1&token=${TOKEN}`,
      payload: { lead_id: 'L-3', email: 'meta@example.com', entry_point_url: 'https://x.com/?fbclid=FB2' },
    });
    assert.equal(JSON.parse(res.payload).channel, 'meta');
  });
});
