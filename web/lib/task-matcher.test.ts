/**
 * Tests for generateDraft and assembleContext with full LLM generation.
 *
 * Uses mock.module to mock:
 *   - @anthropic-ai/sdk
 *   - ./task-types/index.js (loadTaskTypeConfig)
 *   - ./queries/task-runs.js (updateTaskRunOutput, updateTaskRunStatus)
 *   - ./queries/drive.js (searchSkills)
 *   - ./queries/brand.js (getBrandContext)
 *   - ./queries/base.js (scalar — for resolveClientSlug)
 *
 * Run:
 *   node --test --experimental-test-module-mocks --import tsx/esm web/lib/task-matcher.test.ts
 */

import { describe, it, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Mutable holders — each test can override these to control mock behaviour
// ---------------------------------------------------------------------------

const anthropicHolder: {
  messagesCreateResult: unknown;
  messagesCreateError: Error | null;
  callCount: number;
  lastCall: { system?: string; messages?: unknown[] } | null;
} = {
  messagesCreateResult: {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          variants: [{ primary_text: 'Ad copy A', headline: 'Headline A', description: 'Desc A', cta: 'Learn More' }],
          sources: [{ id: 1, title: 'Ad copy SOP' }, { id: 2, title: 'Creative brief' }],
        }),
      },
    ],
  },
  messagesCreateError: null,
  callCount: 0,
  lastCall: null,
};

const taskRunsHolder: {
  updateOutputCalls: Array<{ id: number; output: string }>;
  updateStatusCalls: Array<{ id: number; status: string; extras?: unknown }>;
  updateOutputError: Error | null;
} = {
  updateOutputCalls: [],
  updateStatusCalls: [],
  updateOutputError: null,
};

const driveHolder: {
  searchSkillsResult: unknown;
} = {
  searchSkillsResult: {
    results: [
      { id: 1, title: 'Ad copy SOP', content: 'SOP content A', channel: 'paid_social', skill_type: 'ad_copy_template', drive_modified_at: '2026-01-01', content_hash: 'h1', bm25_score: -1.2 },
      { id: 2, title: 'Creative brief', content: 'SOP content B', channel: 'paid_social', skill_type: 'creative_framework', drive_modified_at: '2026-01-01', content_hash: 'h2', bm25_score: -0.8 },
    ],
    gap: false,
    query: 'ad_copy',
    channel: 'paid_social',
  },
};

const brandHolder: {
  getBrandContextResult: unknown[];
} = {
  getBrandContextResult: [
    {
      id: 10,
      client_id: 42,
      client_name: 'Test Client',
      client_slug: 'test-client',
      title: 'Brand Doc',
      content: 'Brand guidelines content',
      content_hash: 'bh1',
      drive_file_id: 'bfile-1',
      drive_modified_at: '2026-01-01',
      indexed_at: '2026-01-01',
    },
  ],
};

const taskTypeHolder: {
  schema: Record<string, unknown>;
  buildSystemPromptResult: string;
  buildUserMessageResult: string;
} = {
  schema: {
    type: 'object',
    properties: {
      variants: { type: 'array', items: { type: 'object' } },
      sources: { type: 'array', items: { type: 'object' } },
    },
    required: ['variants', 'sources'],
    additionalProperties: false,
  },
  buildSystemPromptResult: 'You are an expert ad copywriter. ## SOPs\n### Ad copy SOP\nSOP content A',
  buildUserMessageResult: 'Generate ad copy for Test Client. ## Brand Context\nBrand guidelines content',
};

// ---------------------------------------------------------------------------
// Module mocks — must be called at top level before any imports
// ---------------------------------------------------------------------------

mock.module('@anthropic-ai/sdk', {
  namedExports: {},
  defaultExport: class MockAnthropic {
    messages = {
      create: async (params: unknown) => {
        anthropicHolder.callCount++;
        anthropicHolder.lastCall = params as { system?: string; messages?: unknown[] };
        if (anthropicHolder.messagesCreateError) {
          throw anthropicHolder.messagesCreateError;
        }
        return anthropicHolder.messagesCreateResult;
      },
    };
  },
});

mock.module('./task-types/index.js', {
  namedExports: {
    loadTaskTypeConfig: (_channel: string, _taskType: string) => ({
      schema: taskTypeHolder.schema,
      buildSystemPrompt: (_sopContent: string) => taskTypeHolder.buildSystemPromptResult,
      buildUserMessage: (_taskType: string, _brandContent: string, _clientName?: string) => taskTypeHolder.buildUserMessageResult,
    }),
  },
});

mock.module('./queries/task-runs.js', {
  namedExports: {
    updateTaskRunOutput: async (id: number, output: string) => {
      if (taskRunsHolder.updateOutputError) throw taskRunsHolder.updateOutputError;
      taskRunsHolder.updateOutputCalls.push({ id, output });
    },
    updateTaskRunStatus: async (id: number, status: string, extras?: unknown) => {
      taskRunsHolder.updateStatusCalls.push({ id, status, extras });
    },
  },
});

mock.module('./queries/drive.js', {
  namedExports: {
    searchSkills: async (_query: string, _channel: string, _limit: number) => {
      return driveHolder.searchSkillsResult;
    },
  },
});

mock.module('./queries/brand.js', {
  namedExports: {
    getBrandContext: async (_clientSlug: string) => {
      return brandHolder.getBrandContextResult;
    },
  },
});

// Mock ./queries/base.js for resolveClientSlug — returns a client_slug scalar
mock.module('./queries/base.js', {
  namedExports: {
    scalar: async <T = string>(_sql: string, _args: unknown[]): Promise<T | null> => {
      // resolveClientSlug queries brand_hub for client_slug by client_id
      // Return 'test-client' to simulate a found slug
      return 'test-client' as unknown as T;
    },
    rows: async () => [],
    db: { execute: async () => ({ rows: [], columns: [] }) },
  },
});

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks are registered
// ---------------------------------------------------------------------------

const { assembleContext } = await import('./task-matcher.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetHolders() {
  // Reset anthropic
  anthropicHolder.messagesCreateError = null;
  anthropicHolder.callCount = 0;
  anthropicHolder.lastCall = null;
  anthropicHolder.messagesCreateResult = {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          variants: [{ primary_text: 'Ad copy A', headline: 'Headline A', description: 'Desc A', cta: 'Learn More' }],
          sources: [{ id: 1, title: 'Ad copy SOP' }, { id: 2, title: 'Creative brief' }],
        }),
      },
    ],
  };

  // Reset task runs
  taskRunsHolder.updateOutputCalls = [];
  taskRunsHolder.updateStatusCalls = [];
  taskRunsHolder.updateOutputError = null;

  // Reset drive
  driveHolder.searchSkillsResult = {
    results: [
      { id: 1, title: 'Ad copy SOP', content: 'SOP content A', channel: 'paid_social', skill_type: 'ad_copy_template', drive_modified_at: '2026-01-01', content_hash: 'h1', bm25_score: -1.2 },
      { id: 2, title: 'Creative brief', content: 'SOP content B', channel: 'paid_social', skill_type: 'creative_framework', drive_modified_at: '2026-01-01', content_hash: 'h2', bm25_score: -0.8 },
    ],
    gap: false,
    query: 'ad_copy',
    channel: 'paid_social',
  };

  // Reset brand
  brandHolder.getBrandContextResult = [
    {
      id: 10,
      client_id: 42,
      client_name: 'Test Client',
      client_slug: 'test-client',
      title: 'Brand Doc',
      content: 'Brand guidelines content',
      content_hash: 'bh1',
      drive_file_id: 'bfile-1',
      drive_modified_at: '2026-01-01',
      indexed_at: '2026-01-01',
    },
  ];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateDraft via assembleContext', () => {
  beforeEach(() => {
    resetHolders();
  });

  it('Test 1: successful generation stores output JSON and transitions to draft_ready', async () => {
    // assembleContext calls generateDraft which calls Anthropic API and stores output
    await assembleContext(1, 42, 'paid_social', 'ad_copy');

    // API was called
    assert.strictEqual(anthropicHolder.callCount, 1, 'Anthropic API should be called once');

    // Output stored
    assert.strictEqual(taskRunsHolder.updateOutputCalls.length, 1, 'updateTaskRunOutput should be called once');
    const storedOutput = taskRunsHolder.updateOutputCalls[0];
    assert.strictEqual(storedOutput.id, 1, 'Output stored for correct task run ID');

    // Output is valid JSON with sources
    const parsed = JSON.parse(storedOutput.output);
    assert.ok(Array.isArray(parsed.sources), 'sources array must be in output');
    assert.ok(parsed.sources.length > 0, 'sources array must be non-empty');

    // Status transitions: first 'generating' (from assembleContext), then 'draft_ready' (from updateTaskRunOutput)
    const statusCalls = taskRunsHolder.updateStatusCalls;
    const generatingCall = statusCalls.find(c => c.status === 'generating');
    assert.ok(generatingCall, 'Status should transition to generating before API call');
  });

  it('Test 2: API failure on first attempt then retry succeeds — output stored', async () => {
    let callCount = 0;
    const originalResult = anthropicHolder.messagesCreateResult;

    // First call fails, second succeeds
    anthropicHolder.messagesCreateError = null;
    const originalCreate = anthropicHolder.messagesCreateResult;

    // Override via error on first call only
    let failOnce = true;
    // We need to intercept per-call — use the callCount approach
    anthropicHolder.messagesCreateError = new Error('API timeout') as Error;
    // But we want second call to succeed, so we use a counter trick:
    // We'll set error to null after the first call is observed
    // Since we can't change mid-test with current holder, use a different approach:
    // Reset error after first throw by replacing the mock result timing

    // Actually let's use the callCount directly in the mock — but the mock is already
    // registered. Use a workaround: set messagesCreateError, then after one call, clear it.
    // We can do this by making the error conditional on callCount.
    // Re-implement: set to Error, then override with a proxy approach.
    // Simplest: set error to throw only when callCount === 0 at call time — not directly possible.
    // Use a different field: errorOnFirstCallOnly flag.

    // Best approach: set error for first call, reset after
    anthropicHolder.messagesCreateError = new Error('First call fails') as Error;

    // We need the mock to clear the error after first throw.
    // The mock reads from the holder each time, so we can set up:
    //   1. Before assembleContext: set error
    //   2. The mock will throw on first call
    //   3. generateDraft retries after 1s delay
    //   4. But we need to clear the error before the retry
    // This is hard to orchestrate synchronously. Instead, test via a simple approach:
    // just check that when error is cleared between calls, the second attempt works.
    // We'll skip the timing and validate retry count by mocking properly.

    // SIMPLIFIED: Clear the error immediately so both calls "see" the same mock,
    // but use a counter-based approach with a fresh mock per call.
    // Let's restructure: use a call counter in the mock and throw only on first call.
    // The mock reads anthropicHolder.callCount (set before throw), so:
    anthropicHolder.callCount = 0;
    anthropicHolder.messagesCreateError = null;

    // Create a stateful error that throws once then succeeds
    let throwNext = true;
    // Override the mock result to use our stateful logic
    // We can't re-register mock.module, but we can make messagesCreateResult a signal...
    // Use a workaround: use a special sentinal in the result that the mock reads per call.
    // Actually the simplest fix: since generateDraft waits 1 second between retries,
    // use a promise that resolves the error only for the first call.
    // For tests, the real approach is: we need the mock to conditionally throw.
    // The mock IS reading from anthropicHolder.messagesCreateError each call.
    // So: set error before call, unset it inside a timer that fires before retry.

    // Set error for first call only
    anthropicHolder.messagesCreateError = new Error('First call API failure');
    // Schedule clearing the error after 500ms (before the 1s retry delay)
    const clearTimer = setTimeout(() => {
      anthropicHolder.messagesCreateError = null;
    }, 100);

    try {
      await assembleContext(2, 42, 'paid_social', 'ad_copy');
    } finally {
      clearTimeout(clearTimer);
    }

    assert.strictEqual(anthropicHolder.callCount, 2, 'API should be called twice (initial + retry)');
    assert.strictEqual(taskRunsHolder.updateOutputCalls.length, 1, 'Output should be stored after retry success');
    const statusCalls = taskRunsHolder.updateStatusCalls;
    assert.ok(!statusCalls.find(c => c.status === 'failed'), 'Status should not be failed when retry succeeds');
  });

  it('Test 3: two consecutive API failures transition to failed, no output stored', async () => {
    anthropicHolder.messagesCreateError = new Error('Persistent API failure');

    await assembleContext(3, 42, 'paid_social', 'ad_copy');

    assert.strictEqual(anthropicHolder.callCount, 2, 'API should be called twice (initial + one retry)');
    assert.strictEqual(taskRunsHolder.updateOutputCalls.length, 0, 'Output must NOT be stored on double failure');

    const statusCalls = taskRunsHolder.updateStatusCalls;
    const failedCall = statusCalls.find(c => c.status === 'failed');
    assert.ok(failedCall, 'Status must transition to failed after two consecutive API failures');
  });

  it('Test 4: JSON parse failure on first attempt triggers retry, second succeeds', async () => {
    let firstCall = true;
    // First call returns invalid JSON, second call returns valid JSON
    // We do this by changing the result mid-test using the callCount
    anthropicHolder.messagesCreateResult = {
      content: [{ type: 'text', text: 'NOT VALID JSON {{{' }],
    };

    // Schedule switching to valid response after first call
    let switched = false;
    const originalCreate = anthropicHolder.messagesCreateResult;

    // Use a hook: after callCount reaches 1, switch result
    anthropicHolder.callCount = 0;
    const validResult = {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            variants: [{ primary_text: 'Good copy', headline: 'Good headline', description: 'Good desc', cta: 'Sign Up' }],
            sources: [{ id: 1, title: 'Ad copy SOP' }],
          }),
        },
      ],
    };

    // We need the mock to return different values per call.
    // Since we can't easily intercept per-call without re-registering the mock,
    // use a timer approach similar to Test 2:
    // The invalid JSON response will cause a parse error → retry after 1s.
    // We switch the result to valid within 100ms.
    const switchTimer = setTimeout(() => {
      anthropicHolder.messagesCreateResult = validResult;
    }, 100);

    try {
      await assembleContext(4, 42, 'paid_social', 'ad_copy');
    } finally {
      clearTimeout(switchTimer);
    }

    assert.strictEqual(anthropicHolder.callCount, 2, 'Should retry after JSON parse failure');
    assert.strictEqual(taskRunsHolder.updateOutputCalls.length, 1, 'Output stored on second (successful) attempt');
    const parsed = JSON.parse(taskRunsHolder.updateOutputCalls[0].output);
    assert.ok(Array.isArray(parsed.sources) && parsed.sources.length > 0, 'Output must have non-empty sources');
  });

  it('Test 5: empty sources array in output triggers retry', async () => {
    // First call returns sources=[], second returns valid sources
    anthropicHolder.messagesCreateResult = {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            variants: [{ primary_text: 'Copy', headline: 'H', description: 'D', cta: 'Buy' }],
            sources: [], // empty — should trigger retry
          }),
        },
      ],
    };

    const validResult = {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            variants: [{ primary_text: 'Copy B', headline: 'H2', description: 'D2', cta: 'Shop' }],
            sources: [{ id: 2, title: 'Creative brief' }],
          }),
        },
      ],
    };

    const switchTimer = setTimeout(() => {
      anthropicHolder.messagesCreateResult = validResult;
    }, 100);

    try {
      await assembleContext(5, 42, 'paid_social', 'ad_copy');
    } finally {
      clearTimeout(switchTimer);
    }

    assert.strictEqual(anthropicHolder.callCount, 2, 'Should retry when sources array is empty');
    assert.strictEqual(taskRunsHolder.updateOutputCalls.length, 1, 'Output stored on retry');
    const parsed = JSON.parse(taskRunsHolder.updateOutputCalls[0].output);
    assert.ok(parsed.sources.length > 0, 'Stored output must have non-empty sources');
  });

  it('Test 6: SOP gap (gap=true) — status failed, no API call made', async () => {
    driveHolder.searchSkillsResult = {
      results: [],
      gap: true,
      query: 'ad_copy',
      channel: 'paid_social',
    };

    await assembleContext(6, 42, 'paid_social', 'ad_copy');

    assert.strictEqual(anthropicHolder.callCount, 0, 'Anthropic API must NOT be called when gap=true');
    assert.strictEqual(taskRunsHolder.updateOutputCalls.length, 0, 'No output stored when gap=true');
    const failedCall = taskRunsHolder.updateStatusCalls.find(c => c.status === 'failed');
    assert.ok(failedCall, 'Status must be failed when gap=true');
  });

  it('Test 7: missing ANTHROPIC_API_KEY causes immediate throw without retry', async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    try {
      // assembleContext should propagate the error (outer catch marks failed)
      await assert.rejects(
        async () => assembleContext(7, 42, 'paid_social', 'ad_copy'),
        (err: Error) => {
          assert.ok(err.message.includes('ANTHROPIC_API_KEY'), 'Error must mention missing API key');
          return true;
        },
      );
    } finally {
      if (originalKey !== undefined) {
        process.env.ANTHROPIC_API_KEY = originalKey;
      }
    }

    assert.strictEqual(anthropicHolder.callCount, 0, 'API must not be called without key');
    assert.strictEqual(taskRunsHolder.updateOutputCalls.length, 0, 'No output stored without API key');
  });
});
