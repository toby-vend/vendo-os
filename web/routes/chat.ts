import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';

// Sub-path → agent name. Each specialist URL is its own sidebar entry +
// route slug (chat-am, chat-paid-social, etc.) so admins can grant
// access per-specialist via /admin/permissions.
const SPECIALIST_URL_TO_AGENT: Record<string, string> = {
  'am': 'atlas-am',
  'paid-social': 'atlas-paid-social',
  'paid-search': 'atlas-paid-search',
  'creative': 'atlas-creative',
  'seo': 'atlas-seo',
};

async function renderChat(
  request: FastifyRequest,
  reply: FastifyReply,
  specialist?: string,
  conversationId?: string,
): Promise<void> {
  const user = request.user;
  const tier =
    !user || user.role === 'client'
      ? 'staff'
      : user.role === 'admin'
        ? 'admin'
        : 'staff';
  const initialAgent = specialist ? (SPECIALIST_URL_TO_AGENT[specialist] ?? 'atlas') : 'atlas';
  reply.render('chat', {
    userName: user?.name?.split(' ')[0] ?? 'there',
    userTier: tier,
    initialAgent,
    initialConversationId: conversationId ?? '',
  });
}

export const chatRoutes: FastifyPluginAsync = async (app) => {
  // /chat — new Atlas chat
  app.get('/', async (request, reply) => {
    await renderChat(request, reply);
  });

  // /chat/c/:id — resume Atlas conversation
  app.get('/c/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await renderChat(request, reply, undefined, id);
  });

  // /chat/am, /chat/paid-social, etc. — new specialist chat
  app.get('/:specialist', async (request, reply) => {
    const { specialist } = request.params as { specialist: string };
    if (!SPECIALIST_URL_TO_AGENT[specialist]) {
      reply.code(404).send('not found');
      return;
    }
    await renderChat(request, reply, specialist);
  });

  // /chat/<specialist>/c/:id — resume a specialist conversation
  app.get('/:specialist/c/:id', async (request, reply) => {
    const { specialist, id } = request.params as { specialist: string; id: string };
    if (!SPECIALIST_URL_TO_AGENT[specialist]) {
      reply.code(404).send('not found');
      return;
    }
    await renderChat(request, reply, specialist, id);
  });
};
