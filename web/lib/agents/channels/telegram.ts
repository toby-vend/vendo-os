/**
 * Telegram channel — bot REST adapter.
 *
 * Vendo user → Telegram chat_id mapping is held in the telegram_users table
 * (created in the agent runtime migration). v1 mappings are seeded by an
 * admin; the /start <token> self-onboarding flow lands later.
 *
 * If TELEGRAM_BOT_TOKEN is unset, every method logs and returns — same
 * graceful degradation as the Slack adapter.
 */
import type { Channel, ApprovalCard } from './_channel';
import { logChannel } from './_channel';
import { db } from '../../queries/base';

const TG_API_BASE = 'https://api.telegram.org/bot';
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function vendoUserToChatId(userId: string): Promise<string | null> {
  const result = await db.execute({
    sql: `SELECT chat_id FROM telegram_users WHERE user_id = ? LIMIT 1`,
    args: [userId],
  });
  const row = result.rows[0];
  return row ? String(row.chat_id) : null;
}

async function tgCall<T = unknown>(
  method: string,
  body: Record<string, unknown>,
): Promise<T | null> {
  if (!TOKEN) {
    logChannel('telegram', `${method}.skipped`, { reason: 'no TELEGRAM_BOT_TOKEN' });
    return null;
  }
  try {
    const res = await fetch(`${TG_API_BASE}${TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { ok: boolean; description?: string; result?: T };
    if (!data.ok) {
      console.error(`[channel:telegram] ${method} error:`, data.description);
      return null;
    }
    return data.result ?? null;
  } catch (err: unknown) {
    console.error(
      `[channel:telegram] ${method} failed:`,
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Card → Telegram message: Markdown body + inline_keyboard with three
// buttons. callback_data carries the recommendation id; the webhook
// receiver (Block 9) parses it and routes to recommendations.decide().
// ---------------------------------------------------------------------------

function escapeMd(text: string): string {
  // Telegram MarkdownV2 reserves these — escape so user-supplied content
  // doesn't break parsing. Reference: https://core.telegram.org/bots/api#markdownv2-style
  return text.replace(/[_*\[\]()~`>#+\-=|{}.!]/g, (m) => `\\${m}`);
}

function approvalText(card: ApprovalCard): string {
  const fields = card.fields
    .map(f => `• *${escapeMd(f.label)}:* ${escapeMd(f.value)}`)
    .join('\n');
  const links = (card.sourceLinks ?? [])
    .map(s => `[${escapeMd(s.label)}](${s.url})`)
    .join(' · ');
  const lines = [
    `*${escapeMd(card.title)}*`,
    '',
    escapeMd(card.reasoning),
  ];
  if (fields) lines.push('', fields);
  if (links) lines.push('', `_Sources_: ${links}`);
  return lines.join('\n');
}

function approvalKeyboard(recId: string) {
  return {
    inline_keyboard: [
      [
        { text: '✅ Approve', callback_data: `approve:${recId}` },
        { text: '✏️ Edit', callback_data: `edit:${recId}` },
        { text: '❌ Reject', callback_data: `reject:${recId}` },
      ],
    ],
  };
}

// ---------------------------------------------------------------------------
// Channel implementation
// ---------------------------------------------------------------------------

export const telegramChannel: Channel = {
  name: 'telegram',

  async sendMessage(chatId: string, text: string) {
    logChannel('telegram', 'sendMessage', { chatId });
    await tgCall('sendMessage', { chat_id: chatId, text });
  },

  async requestApproval(userId: string, card: ApprovalCard) {
    logChannel('telegram', 'requestApproval', { userId, recId: card.id });
    const chatId = await vendoUserToChatId(userId);
    if (!chatId) {
      console.warn(
        `[channel:telegram] no chat_id mapped for vendo user '${userId}' — skipping approval card.`,
      );
      return;
    }
    await tgCall('sendMessage', {
      chat_id: chatId,
      text: approvalText(card),
      parse_mode: 'MarkdownV2',
      reply_markup: approvalKeyboard(card.id),
    });
  },

  async deliverProactive(userId, payload) {
    logChannel('telegram', 'deliverProactive', { userId, title: payload.title });
    const chatId = await vendoUserToChatId(userId);
    if (!chatId) return;
    const lines = [`*${escapeMd(payload.title)}*`, '', escapeMd(payload.body)];
    if (payload.url) lines.push('', `[Open](${payload.url})`);
    await tgCall('sendMessage', {
      chat_id: chatId,
      text: lines.join('\n'),
      parse_mode: 'MarkdownV2',
    });
  },
};
