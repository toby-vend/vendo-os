import type { FastifyPluginAsync } from 'fastify';
import { db, rows } from '../../lib/queries/base.js';

/**
 * Admin UI for mapping Google Ads accounts (gads_accounts) to Vendo clients.
 *
 * Until now `gads_accounts` had no link to `clients.id`, so the daily
 * sync's structured data couldn't be joined into client reports. This
 * page lets an admin pick a client for each Google Ads account; the
 * mapping is the foundation A2 / A4 / A5 build on top of.
 *
 *   GET  /admin/gads-account-map           — page
 *   POST /admin/gads-account-map/upsert    — set / change a mapping (or clear it)
 *
 * Admin-gated by the global server.ts auth hook.
 */

interface GadsAccountRow {
  id: string;
  descriptive_name: string | null;
  currency_code: string | null;
  status: string | null;
  synced_at: string;
  client_id: number | null;
  client_name: string | null;
  notes: string | null;
  mapping_updated_at: string | null;
}

interface ClientOption {
  id: number;
  name: string;
  display_name: string | null;
  label: string;
}

export const adminGadsAccountMapRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const user = (request as { user?: { role?: string } }).user;
    if (!user || user.role !== 'admin') {
      return reply.code(403).send('Admin only');
    }

    const accounts = await rows<GadsAccountRow>(`
      SELECT a.id,
             a.descriptive_name,
             a.currency_code,
             a.status,
             a.synced_at,
             m.client_id,
             c.name AS client_name,
             m.notes,
             m.updated_at AS mapping_updated_at
        FROM gads_accounts a
        LEFT JOIN gads_account_client_map m ON m.gads_customer_id = a.id
        LEFT JOIN clients c ON c.id = m.client_id
       ORDER BY (m.client_id IS NULL) DESC,
                LOWER(COALESCE(a.descriptive_name, a.id)) ASC
    `);

    const clients = await rows<ClientOption>(`
      SELECT id, name, display_name,
             COALESCE(display_name, name) AS label
        FROM clients
       WHERE status IS NULL OR status = 'active'
       ORDER BY label COLLATE NOCASE
    `);

    const totals = {
      accounts: accounts.length,
      mapped: accounts.filter(a => a.client_id != null).length,
      unmapped: accounts.filter(a => a.client_id == null).length,
    };

    reply.render('admin/gads-account-map', { accounts, clients, totals });
  });

  // Upsert (or clear) a mapping.
  app.post('/upsert', async (request, reply) => {
    const user = (request as { user?: { role?: string } }).user;
    if (!user || user.role !== 'admin') return reply.code(403).send('Admin only');

    const body = request.body as { gads_customer_id?: string; client_id?: string; notes?: string };
    const gadsId = (body.gads_customer_id ?? '').trim();
    if (!gadsId) return reply.code(400).send('Missing gads_customer_id');

    const clientIdRaw = (body.client_id ?? '').trim();
    const notes = (body.notes ?? '').trim() || null;

    // Empty client_id == clear the mapping
    if (!clientIdRaw) {
      await db.execute({
        sql: 'DELETE FROM gads_account_client_map WHERE gads_customer_id = ?',
        args: [gadsId],
      });
      return reply.redirect('/admin/gads-account-map');
    }

    const clientId = Number(clientIdRaw);
    if (!Number.isFinite(clientId) || clientId <= 0) {
      return reply.code(400).send('Invalid client_id');
    }

    await db.execute({
      sql: `INSERT INTO gads_account_client_map (gads_customer_id, client_id, notes, updated_at)
            VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT(gads_customer_id) DO UPDATE SET
              client_id = excluded.client_id,
              notes = excluded.notes,
              updated_at = excluded.updated_at`,
      args: [gadsId, clientId, notes],
    });
    reply.redirect('/admin/gads-account-map');
  });
};
