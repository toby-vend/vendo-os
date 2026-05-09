import type { FastifyPluginAsync } from 'fastify';

export const chatRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const user = request.user;
    // Atlas isn't available to client-portal users — keep the legacy chat
    // for them until the portal gets its own scoped agent.
    const tier =
      !user || user.role === 'client'
        ? 'staff'
        : user.role === 'admin'
          ? 'admin'
          : 'staff';
    reply.render('chat', {
      userName: user?.name?.split(' ')[0] ?? 'there',
      userTier: tier,
    });
  });
};
