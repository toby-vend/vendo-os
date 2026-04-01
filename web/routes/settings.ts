import type { FastifyPluginAsync } from 'fastify';
import { getUserOAuthToken } from '../lib/queries.js';
import type { SessionUser } from '../lib/auth.js';

export const settingsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const user = (request as any).user as SessionUser | null;
    if (!user) { reply.redirect('/login'); return; }

    const googleToken = await getUserOAuthToken(user.id, 'google');
    const query = request.query as Record<string, string>;

    reply.render('settings', {
      googleConnected: !!googleToken,
      googleEmail: googleToken?.provider_email,
      googleName: googleToken?.provider_name,
      flash: query.google,
    });
  });
};
