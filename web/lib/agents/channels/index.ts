/**
 * Channels registry.
 *
 * Single import surface for the runtime + cron handlers:
 *
 *   import { getChannel, recToCard } from '../channels/index.js';
 *   await getChannel('web').requestApproval(userId, recToCard(rec));
 *
 * Adding a new channel = adding to CHANNELS and to the union in
 * web/lib/agents/types#ChannelName.
 */
import type { Channel, ChannelName } from '../types.js';
import { webChannel } from './web.js';
import { slackChannel } from './slack.js';
import { telegramChannel } from './telegram.js';

const CHANNELS: Record<'web' | 'slack' | 'telegram', Channel> = {
  web: webChannel,
  slack: slackChannel,
  telegram: telegramChannel,
};

export function getChannel(name: 'web' | 'slack' | 'telegram'): Channel {
  return CHANNELS[name];
}

/** Channels that can be selected at runtime — excludes the synthetic 'cron'
 *  source-of-trigger value used in agent_runs but never as a delivery target. */
export type DeliveryChannel = 'web' | 'slack' | 'telegram';

export function isDeliveryChannel(name: string): name is DeliveryChannel {
  return name === 'web' || name === 'slack' || name === 'telegram';
}

/** Resolve a list of channel names from notification_preferences (JSON
 *  array stored as TEXT). Defaults to ['web'] when row is absent. */
export function defaultDeliveryChannels(): DeliveryChannel[] {
  return ['web'];
}

// Re-exports so consumers only need this one file.
export { webChannel, slackChannel, telegramChannel };
export { recToCard, logChannel } from './_channel.js';
export type { Channel, ChannelName, ApprovalCard, ApprovalCardField } from './_channel.js';
