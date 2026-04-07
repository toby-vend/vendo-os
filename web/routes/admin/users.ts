import type { FastifyPluginAsync } from 'fastify';
import {
  getAllUsers,
  getChannels,
  createUser,
  updateUser,
  deleteUser,
  setUserChannels,
  updateUserPassword,
  getUserById,
  getUserByEmail,
  getUserRouteOverrides,
  setUserRouteOverrides,
} from '../../lib/queries.js';
import { hashPassword, generateId, validatePasswordComplexity, type SessionUser } from '../../lib/auth.js';
import { sendInviteNotifications } from '../../lib/notifications.js';
import { ROUTE_SLUGS } from './permissions.js';

export const adminUsersRoutes: FastifyPluginAsync = async (app) => {
  // List all users
  app.get('/', async (request, reply) => {
    const [users, channels] = await Promise.all([getAllUsers(), getChannels()]);
    reply.render('admin/users', { users, channels });
  });

  // Create new user
  app.post('/', async (request, reply) => {
    const body = request.body as Record<string, string | string[]>;
    const email = (typeof body.email === 'string' ? body.email : '').trim().toLowerCase();
    const name = (typeof body.name === 'string' ? body.name : '').trim();
    const VALID_ROLES = ['admin', 'standard', 'client'] as const;
    const rawRole = typeof body.role === 'string' ? body.role : 'standard';
    const role = (VALID_ROLES as readonly string[]).includes(rawRole) ? rawRole as 'admin' | 'standard' | 'client' : 'standard';
    const password = (typeof body.password === 'string' ? body.password : '').trim();
    const channelIds = Array.isArray(body.channels) ? body.channels : (body.channels ? [body.channels] : []);

    if (!email || !name || !password) {
      const [users, channels] = await Promise.all([getAllUsers(), getChannels()]);
      reply.render('admin/users', { users, channels, error: 'Email, name, and password are required' });
      return;
    }

    // Check for duplicate email
    const existing = await getUserByEmail(email);
    if (existing) {
      const [users, channels] = await Promise.all([getAllUsers(), getChannels()]);
      reply.render('admin/users', { users, channels, error: 'A user with that email already exists' });
      return;
    }

    const userId = generateId();
    await createUser({ id: userId, email, name, passwordHash: hashPassword(password), role });

    if (channelIds.length > 0) {
      await setUserChannels(userId, channelIds);
    }

    // Send invite notifications (non-blocking — don't delay the redirect)
    const currentUser = (request as any).user as SessionUser;
    sendInviteNotifications({
      name,
      email,
      role,
      invitedBy: currentUser.name,
    }).catch(e => console.error('[notify] Invite notification error:', e));

    reply.redirect('/admin/users');
  });

  // Edit user form (HTMX partial)
  app.get('/:id/edit', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await getUserById(id);
    if (!user) { reply.code(404).send('User not found'); return; }

    const channels = await getChannels();

    // Get user's current channel IDs
    const { db } = await import('../../lib/queries.js');
    const result = await db.execute({ sql: 'SELECT channel_id FROM user_channels WHERE user_id = ?', args: [id] });
    const userChannelIds = result.rows.map((r: any) => r.channel_id as string);

    // Get per-user route overrides
    const overrides = await getUserRouteOverrides(id);
    const overrideMap: Record<string, string> = {};
    for (const o of overrides) overrideMap[o.route_slug] = o.mode;

    reply.render('admin/user-edit', { editUser: user, channels, userChannelIds, routeSlugs: ROUTE_SLUGS, overrideMap });
  });

  // Update user
  app.post('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, string | string[]>;
    const name = (typeof body.name === 'string' ? body.name : '').trim();
    const VALID_ROLES = ['admin', 'standard', 'client'] as const;
    const rawRole = typeof body.role === 'string' ? body.role : 'standard';
    const role = (VALID_ROLES as readonly string[]).includes(rawRole) ? rawRole : 'standard';
    const email = (typeof body.email === 'string' ? body.email : '').trim().toLowerCase();
    const channelIds = Array.isArray(body.channels) ? body.channels : (body.channels ? [body.channels] : []);

    // Prevent admin from demoting themselves
    const currentUser = (request as any).user as SessionUser;
    if (id === currentUser.id && role !== 'admin') {
      const [users, channels] = await Promise.all([getAllUsers(), getChannels()]);
      reply.render('admin/users', { users, channels, error: 'You cannot remove your own admin role' });
      return;
    }

    await updateUser(id, { name, role, email });
    await setUserChannels(id, channelIds);

    // Save per-user route overrides
    const overrideValues = Array.isArray(body.overrides) ? body.overrides : (body.overrides ? [body.overrides] : []);
    const overrides: { routeSlug: string; mode: 'grant' | 'deny' }[] = [];
    for (const val of overrideValues as string[]) {
      const [mode, slug] = val.split(':');
      if ((mode === 'grant' || mode === 'deny') && slug) {
        overrides.push({ routeSlug: slug, mode });
      }
    }
    await setUserRouteOverrides(id, overrides);

    reply.redirect('/admin/users');
  });

  // Delete user
  app.post('/:id/delete', async (request, reply) => {
    const { id } = request.params as { id: string };
    const currentUser = (request as any).user as SessionUser;

    if (id === currentUser.id) {
      const [users, channels] = await Promise.all([getAllUsers(), getChannels()]);
      reply.render('admin/users', { users, channels, error: 'You cannot delete your own account' });
      return;
    }

    await deleteUser(id);
    reply.redirect('/admin/users');
  });

  // Reset password — step 1: generate and preview
  app.post('/:id/reset-password', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await getUserById(id);
    if (!user) { reply.redirect('/admin/users'); return; }

    // Generate a random compliant password (12 chars, mixed case + digit + symbol)
    const lower = 'abcdefghijkmnpqrstuvwxyz';
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const digits = '23456789';
    const symbols = '!@#$%&*';
    const all = lower + upper + digits;
    let pw = '';
    pw += upper[Math.floor(Math.random() * upper.length)];
    pw += lower[Math.floor(Math.random() * lower.length)];
    pw += digits[Math.floor(Math.random() * digits.length)];
    pw += symbols[Math.floor(Math.random() * symbols.length)];
    for (let i = 0; i < 8; i++) pw += all[Math.floor(Math.random() * all.length)];
    pw = pw.split('').sort(() => Math.random() - 0.5).join('');

    const [users, channels] = await Promise.all([getAllUsers(), getChannels()]);
    reply.render('admin/users', { users, channels, resetUser: { id: user.id, name: user.name, password: pw } });
  });

  // Reset password — step 2: confirm
  app.post('/:id/reset-password/confirm', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, string | string[]>;
    const password = (typeof body.password === 'string' ? body.password : '').trim();

    if (!password) { reply.redirect('/admin/users'); return; }

    await updateUserPassword(id, hashPassword(password), true);
    reply.redirect('/admin/users');
  });
};
