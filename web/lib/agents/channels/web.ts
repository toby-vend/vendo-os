/**
 * Web channel — the user is in /chat or /inbox.
 *
 * The /chat page already owns the streamed UIMessage transport (driven by
 * streamAgent), so this channel does not push arbitrary chat messages from
 * the agent. Its job is purely "tell the user something landed in the
 * inbox" via push notifications. The recommendation row already exists in
 * agent_recommendations (the draft tool wrote it); the /inbox page reads
 * it back when the user follows the push.
 */
import type { Channel, ApprovalCard } from './_channel.js';
import { logChannel } from './_channel.js';
import { sendPushToUser } from '../../push-sender.js';

export const webChannel: Channel = {
  name: 'web',

  async sendMessage(_conversationId: string, _text: string) {
    // No-op: web /chat conversations are streamed by streamAgent. Out-of-band
    // text messages are not part of the web channel's responsibility.
    logChannel('web', 'sendMessage.noop');
  },

  async requestApproval(userId: string, card: ApprovalCard) {
    logChannel('web', 'requestApproval', { userId, recId: card.id });
    try {
      await sendPushToUser(userId, {
        title: `Vendo: ${card.title}`,
        body: card.reasoning.length > 180
          ? card.reasoning.slice(0, 177) + '...'
          : card.reasoning,
        url: `/inbox#${card.id}`,
      });
    } catch (err: unknown) {
      console.error(
        '[channel:web] requestApproval push failed:',
        err instanceof Error ? err.message : String(err),
      );
    }
  },

  async deliverProactive(userId, payload) {
    logChannel('web', 'deliverProactive', { userId, title: payload.title });
    try {
      await sendPushToUser(userId, {
        title: payload.title,
        body: payload.body,
        url: payload.url ?? '/',
      });
    } catch (err: unknown) {
      console.error(
        '[channel:web] deliverProactive push failed:',
        err instanceof Error ? err.message : String(err),
      );
    }
  },
};
