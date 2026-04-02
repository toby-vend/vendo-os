/**
 * Tests for task type config registry and prompt builders.
 *
 * Pure functions — no mocks needed.
 *
 * Run:
 *   node --test --import tsx/esm web/lib/task-types/task-types.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { loadTaskTypeConfig, type TaskTypeConfig } from './index.js';

// ---------------------------------------------------------------------------
// loadTaskTypeConfig registry
// ---------------------------------------------------------------------------

describe('loadTaskTypeConfig', () => {
  it('resolves paid_social:ad_copy', () => {
    const config = loadTaskTypeConfig('paid_social', 'ad_copy');
    assert.ok(config, 'config should be defined');
    assert.strictEqual(typeof config.schema, 'object');
    assert.strictEqual(typeof config.buildSystemPrompt, 'function');
    assert.strictEqual(typeof config.buildUserMessage, 'function');
  });

  it('resolves seo:content_brief', () => {
    const config = loadTaskTypeConfig('seo', 'content_brief');
    assert.ok(config, 'config should be defined');
    assert.strictEqual(typeof config.schema, 'object');
    assert.strictEqual(typeof config.buildSystemPrompt, 'function');
    assert.strictEqual(typeof config.buildUserMessage, 'function');
  });

  it('resolves paid_ads:rsa_copy', () => {
    const config = loadTaskTypeConfig('paid_ads', 'rsa_copy');
    assert.ok(config, 'config should be defined');
    assert.strictEqual(typeof config.schema, 'object');
    assert.strictEqual(typeof config.buildSystemPrompt, 'function');
    assert.strictEqual(typeof config.buildUserMessage, 'function');
  });

  it('throws for unknown channel+taskType', () => {
    assert.throws(
      () => loadTaskTypeConfig('unknown', 'unknown'),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(
          err.message.includes('unknown') || err.message.includes('No task type config'),
          `Expected descriptive error, got: ${err.message}`,
        );
        return true;
      },
    );
  });
});

// ---------------------------------------------------------------------------
// Schema validation — all three task types
// ---------------------------------------------------------------------------

describe('ad_copy schema', () => {
  const config: TaskTypeConfig = loadTaskTypeConfig('paid_social', 'ad_copy');

  it('has additionalProperties: false at top level', () => {
    assert.strictEqual((config.schema as Record<string, unknown>).additionalProperties, false);
  });

  it('has required sources array', () => {
    const required = (config.schema as Record<string, unknown>).required as string[];
    assert.ok(Array.isArray(required), 'required should be an array');
    assert.ok(required.includes('sources'), 'sources should be in required');
  });

  it('has variants property in schema', () => {
    const props = (config.schema as Record<string, unknown>).properties as Record<string, unknown>;
    assert.ok(props.variants, 'variants property should exist');
  });
});

describe('content_brief schema', () => {
  const config: TaskTypeConfig = loadTaskTypeConfig('seo', 'content_brief');

  it('has additionalProperties: false at top level', () => {
    assert.strictEqual((config.schema as Record<string, unknown>).additionalProperties, false);
  });

  it('has required sources array', () => {
    const required = (config.schema as Record<string, unknown>).required as string[];
    assert.ok(Array.isArray(required), 'required should be an array');
    assert.ok(required.includes('sources'), 'sources should be in required');
  });

  it('has meta_title and meta_description in schema', () => {
    const props = (config.schema as Record<string, unknown>).properties as Record<string, unknown>;
    assert.ok(props.meta_title, 'meta_title property should exist');
    assert.ok(props.meta_description, 'meta_description property should exist');
  });
});

describe('rsa_copy schema', () => {
  const config: TaskTypeConfig = loadTaskTypeConfig('paid_ads', 'rsa_copy');

  it('has additionalProperties: false at top level', () => {
    assert.strictEqual((config.schema as Record<string, unknown>).additionalProperties, false);
  });

  it('has required sources array', () => {
    const required = (config.schema as Record<string, unknown>).required as string[];
    assert.ok(Array.isArray(required), 'required should be an array');
    assert.ok(required.includes('sources'), 'sources should be in required');
  });

  it('has headlines and descriptions in schema', () => {
    const props = (config.schema as Record<string, unknown>).properties as Record<string, unknown>;
    assert.ok(props.headlines, 'headlines property should exist');
    assert.ok(props.descriptions, 'descriptions property should exist');
  });
});

// ---------------------------------------------------------------------------
// buildSystemPrompt
// ---------------------------------------------------------------------------

describe('buildSystemPrompt', () => {
  it('ad_copy includes SOP content', () => {
    const config = loadTaskTypeConfig('paid_social', 'ad_copy');
    const sopContent = 'Meta Ad Best Practices v2';
    const prompt = config.buildSystemPrompt(sopContent);
    assert.ok(typeof prompt === 'string', 'prompt should be a string');
    assert.ok(prompt.includes(sopContent), 'prompt should include SOP content');
  });

  it('content_brief includes SOP content', () => {
    const config = loadTaskTypeConfig('seo', 'content_brief');
    const sopContent = 'SEO Writing Guidelines 2025';
    const prompt = config.buildSystemPrompt(sopContent);
    assert.ok(prompt.includes(sopContent), 'prompt should include SOP content');
  });

  it('rsa_copy includes SOP content', () => {
    const config = loadTaskTypeConfig('paid_ads', 'rsa_copy');
    const sopContent = 'Google Ads RSA Playbook';
    const prompt = config.buildSystemPrompt(sopContent);
    assert.ok(prompt.includes(sopContent), 'prompt should include SOP content');
  });
});

// ---------------------------------------------------------------------------
// buildUserMessage
// ---------------------------------------------------------------------------

describe('buildUserMessage', () => {
  it('includes brand context with client name heading', () => {
    const config = loadTaskTypeConfig('paid_social', 'ad_copy');
    const msg = config.buildUserMessage('ad_copy', 'Brand voice: friendly', 'Acme Corp');
    assert.ok(typeof msg === 'string', 'message should be a string');
    assert.ok(
      msg.includes('## Brand Context for Acme Corp'),
      'should include labelled brand context heading',
    );
    assert.ok(msg.includes('Brand voice: friendly'), 'should include brand content');
  });

  it('omits brand section when brandContent is empty', () => {
    const config = loadTaskTypeConfig('paid_social', 'ad_copy');
    const msg = config.buildUserMessage('ad_copy', '', 'Acme Corp');
    assert.ok(!msg.includes('## Brand Context'), 'should not include brand section when empty');
  });

  it('works without clientName', () => {
    const config = loadTaskTypeConfig('seo', 'content_brief');
    const msg = config.buildUserMessage('content_brief', '');
    assert.ok(typeof msg === 'string', 'should return a string with no clientName');
  });

  it('rsa_copy includes brand context', () => {
    const config = loadTaskTypeConfig('paid_ads', 'rsa_copy');
    const msg = config.buildUserMessage('rsa_copy', 'Tone: professional', 'Dentist Plus');
    assert.ok(msg.includes('## Brand Context for Dentist Plus'), 'should include labelled heading');
  });
});
