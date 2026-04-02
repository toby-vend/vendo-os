/**
 * Task type config registry.
 *
 * Each channel+taskType combo maps to a config object with:
 *   - schema: JSON schema for Anthropic structured output
 *   - buildSystemPrompt: constructs the system message (role + SOPs)
 *   - buildUserMessage: constructs the user message (task request + brand context)
 *
 * Adding a new channel/task type = create a new config module and register it below.
 */

import * as adCopy from './ad_copy.js';
import * as contentBrief from './content_brief.js';
import * as rsaCopy from './rsa_copy.js';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface TaskTypeConfig {
  schema: Record<string, unknown>;
  buildSystemPrompt: (sopContent: string) => string;
  buildUserMessage: (taskType: string, brandContent: string, clientName?: string) => string;
}

// ---------------------------------------------------------------------------
// Registry — keyed as `channel:taskType`
// ---------------------------------------------------------------------------

const REGISTRY = new Map<string, TaskTypeConfig>([
  ['paid_social:ad_copy', adCopy],
  ['seo:content_brief', contentBrief],
  ['paid_ads:rsa_copy', rsaCopy],
]);

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Returns the task type config for the given channel and task type.
 * Throws a descriptive error if no config is registered.
 */
export function loadTaskTypeConfig(channel: string, taskType: string): TaskTypeConfig {
  const key = `${channel}:${taskType}`;
  const config = REGISTRY.get(key);

  if (!config) {
    throw new Error(
      `No task type config found for "${key}". ` +
        `Registered types: ${[...REGISTRY.keys()].join(', ')}`,
    );
  }

  return config;
}
