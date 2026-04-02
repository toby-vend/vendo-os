import type { FastifyPluginAsync } from 'fastify';
import {
  getAllPortalUsers,
  createPortalUser,
  deletePortalUser,
  getUserByEmail,
} from '../../lib/queries.js';
import { getAllClientsAdmin } from '../../lib/queries/clients.js';
import { hashPassword, generateId } from '../../lib/auth.js';

export const adminPortalUsersRoutes: FastifyPluginAsync = async (app) => {
  // List all client portal users
  app.get('/', async (_request, reply) => {
    const [portalUsers, clients] = await Promise.all([
      getAllPortalUsers(),
      getAllClientsAdmin(),
    ]);
    reply.render('admin/portal-users', { portalUsers, clients });
  });

  // Create a new client portal user
  app.post('/', async (request, reply) => {
    const body = request.body as Record<string, string | string[]>;
    const email = (typeof body.email === 'string' ? body.email : '').trim().toLowerCase();
    const name = (typeof body.name === 'string' ? body.name : '').trim();
    const password = (typeof body.password === 'string' ? body.password : '').trim();
    const clientIdStr = typeof body.client_id === 'string' ? body.client_id : '';
    const clientName = (typeof body.client_name === 'string' ? body.client_name : '').trim();

    if (!email || !name || !password || !clientIdStr) {
      const [portalUsers, clients] = await Promise.all([
        getAllPortalUsers(),
        getAllClientsAdmin(),
      ]);
      reply.render('admin/portal-users', {
        portalUsers,
        clients,
        error: 'Email, name, password, and client are required',
      });
      return;
    }

    const clientId = parseInt(clientIdStr, 10);
    if (isNaN(clientId)) {
      const [portalUsers, clients] = await Promise.all([
        getAllPortalUsers(),
        getAllClientsAdmin(),
      ]);
      reply.render('admin/portal-users', {
        portalUsers,
        clients,
        error: 'Invalid client ID',
      });
      return;
    }

    // Check for duplicate email
    const existing = await getUserByEmail(email);
    if (existing) {
      const [portalUsers, clients] = await Promise.all([
        getAllPortalUsers(),
        getAllClientsAdmin(),
      ]);
      reply.render('admin/portal-users', {
        portalUsers,
        clients,
        error: 'A user with that email already exists',
      });
      return;
    }

    await createPortalUser({
      id: generateId(),
      email,
      name,
      passwordHash: hashPassword(password),
      clientId,
      clientName,
    });

    reply.redirect('/admin/portal-users');
  });

  // Delete a portal user
  app.post('/:id/delete', async (request, reply) => {
    const { id } = request.params as { id: string };
    await deletePortalUser(id);
    reply.redirect('/admin/portal-users');
  });
};
