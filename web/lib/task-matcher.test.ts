/**
 * Tests for generateDraft and assembleContext with QA-aware generation flow.
 *
 * Uses mock.module to mock:
 *   - @anthropic-ai/sdk
 *   - ./task-types/index.js (loadTaskTypeConfig)
 *   - ./queries/task-runs.js (updateTaskRunOutput, updateTaskRunStatus, updateTaskRunQA, incrementAttempts)
 *   - ./queries/drive.js (searchSkills)
 *   - ./queries/brand.js (getBrandContext)
 *   - ./queries/base.js (scalar — for resolveClientSlug)
 *   - ./qa-checker.js (runSOPCheck)
 *   - ./ahpra-rules.js (checkAHPRACompliance)
 *
 * Run:
 *   node --test --experimental-test-module-mocks --import tsx/esm web/lib/task-matcher.test.ts
 */

import { describe, it, beforeEach, mock } from 'node:test';
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
  updateQACalls: Array<{ id: number; qa: { score: number; critique: string } }>;
  incrementAttemptsCalls: number[];
  updateOutputError: Error | null;
} = {
  updateOutputCalls: [],
  updateStatusCalls: [],
  updateQACalls: [],
  incrementAttemptsCalls: [],
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

// QA checker holder — controls runSOPCheck behaviour
const qaCheckerHolder: {
  results: Array<{ pass: boolean; critique: string | null }>;
  callCount: number;
  error: Error | null;
} = {
  results: [{ pass: true, critique: null }],
  callCount: 0,
  error: null,
};

// AHPRA holder — controls checkAHPRACompliance behaviour
const ahpraHolder: {
  violations: Array<{ rule: string; violation: string; severity: string }>;
} = {
  violations: [],
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
    updateTaskRunQA: async (id: number, qa: { score: number; critique: string }) => {
      taskRunsHolder.updateQACalls.push({ id, qa });
    },
    incrementAttempts: async (id: number) => {
      taskRunsHolder.incrementAttemptsCalls.push(id);
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
      return 'test-client' as unknown as T;
    },
    rows: async () => [],
    db: { execute: async () => ({ rows: [], columns: [] }) },
  },
});

mock.module('./qa-checker.js', {
  namedExports: {
    runSOPCheck: async (_draftText: string, _sopContent: string) => {
      if (qaCheckerHolder.error) {
        throw qaCheckerHolder.error;
      }
      const result = qaCheckerHolder.results[qaCheckerHolder.callCount] ??
        qaCheckerHolder.results[qaCheckerHolder.results.length - 1];
      qaCheckerHolder.callCount++;
      return result;
    },
  },
});

mock.module('./ahpra-rules.js', {
  namedExports: {
    checkAHPRACompliance: (_text: string) => {
      return ahpraHolder.violations;
    },
  },
});

// ---------------------------------------------------------------------------
// Set a dummy API key so generateDraft doesn't throw before reaching the mock
// ---------------------------------------------------------------------------

process.env.ANTHROPIC_API_KEY = 'test-api-key-mock';

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks are registered
// ---------------------------------------------------------------------------

const { assembleContext } = await import('./task-matcher.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetHolders() {
  process.env.ANTHROPIC_API_KEY = 'test-api-key-mock';

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
  taskRunsHolder.updateQACalls = [];
  taskRunsHolder.incrementAttemptsCalls = [];
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

  // Reset QA checker — default: always pass
  qaCheckerHolder.results = [{ pass: true, critique: null }];
  qaCheckerHolder.callCount = 0;
  qaCheckerHolder.error = null;

  // Reset AHPRA
  ahpraHolder.violations = [];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateDraft via assembleContext — QA flow', () => {
  beforeEach(() => {
    resetHolders();
  });

  it('Test 1: successful generation passes SOP QA — qa_score=1, status=draft_ready', async () => {
    // QA passes on first attempt, no AHPRA violations
    qaCheckerHolder.results = [{ pass: true, critique: null }];

    await assembleContext(1, 42, 'paid_social', 'ad_copy');

    // API was called once
    assert.strictEqual(anthropicHolder.callCount, 1, 'Anthropic API should be called once');

    // Status transitioned through qa_check
    const qaCheckCall = taskRunsHolder.updateStatusCalls.find(c => c.status === 'qa_check');
    assert.ok(qaCheckCall, 'Status should transition to qa_check');

    // incrementAttempts called once
    assert.strictEqual(taskRunsHolder.incrementAttemptsCalls.length, 1, 'incrementAttempts called once');

    // QA score = 1
    assert.strictEqual(taskRunsHolder.updateQACalls.length, 1, 'updateTaskRunQA should be called once');
    assert.strictEqual(taskRunsHolder.updateQACalls[0].qa.score, 1, 'qa_score must be 1 on pass');

    // qa_critique has sop_issues and ahpra_violations
    const critique = JSON.parse(taskRunsHolder.updateQACalls[0].qa.critique);
    assert.ok(Array.isArray(critique.sop_issues), 'qa_critique must have sop_issues');
    assert.ok(Array.isArray(critique.ahpra_violations), 'qa_critique must have ahpra_violations');
    assert.deepStrictEqual(critique.sop_issues, [], 'sop_issues should be empty on pass');

    // Output stored
    assert.strictEqual(taskRunsHolder.updateOutputCalls.length, 1, 'updateTaskRunOutput should be called once');
    const parsed = JSON.parse(taskRunsHolder.updateOutputCalls[0].output);
    assert.ok(Array.isArray(parsed.sources) && parsed.sources.length > 0, 'Output must have sources');
  });

  it('Test 2: AHPRA violations included in qa_critique JSON even when SOP QA passes', async () => {
    qaCheckerHolder.results = [{ pass: true, critique: null }];
    ahpraHolder.violations = [
      { rule: 'AHPRA-T1', violation: 'testimonial found', severity: 'HIGH' },
    ];

    await assembleContext(2, 42, 'paid_social', 'ad_copy');

    assert.strictEqual(taskRunsHolder.updateQACalls[0].qa.score, 1, 'qa_score=1 even with AHPRA violations');
    const critique = JSON.parse(taskRunsHolder.updateQACalls[0].qa.critique);
    assert.strictEqual(critique.ahpra_violations.length, 1, 'AHPRA violations included in critique');
    assert.strictEqual(critique.ahpra_violations[0].rule, 'AHPRA-T1');
  });

  it('Test 3: draft fails SOP QA once then passes on second attempt — qa_score=1, attempts=2', async () => {
    // First call fails QA, second passes
    qaCheckerHolder.results = [
      { pass: false, critique: 'Tone is too promotional' },
      { pass: true, critique: null },
    ];

    await assembleContext(3, 42, 'paid_social', 'ad_copy');

    // API called twice (initial + retry)
    assert.strictEqual(anthropicHolder.callCount, 2, 'Anthropic called twice');
    // incrementAttempts called twice
    assert.strictEqual(taskRunsHolder.incrementAttemptsCalls.length, 2, 'incrementAttempts called twice');
    // QA score = 1 on second pass
    assert.strictEqual(taskRunsHolder.updateQACalls.length, 1, 'updateTaskRunQA called once (on final result)');
    assert.strictEqual(taskRunsHolder.updateQACalls[0].qa.score, 1, 'qa_score=1 when eventually passes');
    // Output stored once
    assert.strictEqual(taskRunsHolder.updateOutputCalls.length, 1, 'Output stored once');
  });

  it('Test 4: retry message includes previous critique', async () => {
    const firstCritique = 'Tone is too promotional';
    qaCheckerHolder.results = [
      { pass: false, critique: firstCritique },
      { pass: true, critique: null },
    ];

    await assembleContext(4, 42, 'paid_social', 'ad_copy');

    // Second API call's user message should include the critique
    assert.strictEqual(anthropicHolder.callCount, 2, 'Two Anthropic calls made');
    const lastMessages = anthropicHolder.lastCall?.messages as Array<{ role: string; content: string }> | undefined;
    const userContent = lastMessages?.[0]?.content ?? '';
    assert.ok(
      userContent.includes(firstCritique),
      `Retry message should contain previous critique. Got: ${userContent}`,
    );
    assert.ok(
      userContent.includes('Previous attempt failed QA'),
      'Retry message should start with QA failure prefix',
    );
  });

  it('Test 5: after 3 total attempts all failing — qa_score=0, draft_ready with critique attached', async () => {
    // All 3 attempts fail SOP QA
    qaCheckerHolder.results = [
      { pass: false, critique: 'Issue 1' },
      { pass: false, critique: 'Issue 2' },
      { pass: false, critique: 'Issue 3' },
    ];

    await assembleContext(5, 42, 'paid_social', 'ad_copy');

    // API called 3 times (max attempts)
    assert.strictEqual(anthropicHolder.callCount, 3, 'Anthropic called 3 times (max attempts)');
    // incrementAttempts called 3 times
    assert.strictEqual(taskRunsHolder.incrementAttemptsCalls.length, 3, 'incrementAttempts called 3 times');
    // QA score = 0
    assert.strictEqual(taskRunsHolder.updateQACalls.length, 1, 'updateTaskRunQA called once');
    assert.strictEqual(taskRunsHolder.updateQACalls[0].qa.score, 0, 'qa_score=0 after exhausted attempts');

    // critique contains sop_issues and ahpra_violations
    const critique = JSON.parse(taskRunsHolder.updateQACalls[0].qa.critique);
    assert.ok(Array.isArray(critique.sop_issues), 'sop_issues present in critique');
    assert.ok(critique.sop_issues.length > 0, 'sop_issues non-empty after failure');
    assert.ok(Array.isArray(critique.ahpra_violations), 'ahpra_violations present in critique');

    // Output still stored (draft surfaces as draft_ready with qa_score=0)
    assert.strictEqual(taskRunsHolder.updateOutputCalls.length, 1, 'Output stored even after QA exhaustion');
  });

  it('Test 6: maximum 3 total attempts enforced — no 4th Anthropic call', async () => {
    // All fail — verify cap
    qaCheckerHolder.results = [
      { pass: false, critique: 'Fail 1' },
      { pass: false, critique: 'Fail 2' },
      { pass: false, critique: 'Fail 3' },
    ];

    await assembleContext(6, 42, 'paid_social', 'ad_copy');

    assert.ok(anthropicHolder.callCount <= 3, `Must not exceed 3 Anthropic calls, got ${anthropicHolder.callCount}`);
  });

  it('Test 7: draft fails SOP QA twice, passes on third — qa_score=1, attempts=3', async () => {
    qaCheckerHolder.results = [
      { pass: false, critique: 'Issue A' },
      { pass: false, critique: 'Issue B' },
      { pass: true, critique: null },
    ];

    await assembleContext(7, 42, 'paid_social', 'ad_copy');

    assert.strictEqual(anthropicHolder.callCount, 3, 'Anthropic called 3 times');
    assert.strictEqual(taskRunsHolder.updateQACalls[0].qa.score, 1, 'qa_score=1 on third pass');
    assert.strictEqual(taskRunsHolder.updateOutputCalls.length, 1, 'Output stored once');
  });

  it('Test 8: QA error transitions task to failed (not stuck at qa_check)', async () => {
    qaCheckerHolder.error = new Error('Haiku service unavailable');

    await assembleContext(8, 42, 'paid_social', 'ad_copy');

    // Should not have stored any output
    assert.strictEqual(taskRunsHolder.updateOutputCalls.length, 0, 'No output stored on QA error');
    // Should not have set QA score
    assert.strictEqual(taskRunsHolder.updateQACalls.length, 0, 'No QA score written on QA error');
    // Should have transitioned to failed (not stuck at qa_check)
    const failedCall = taskRunsHolder.updateStatusCalls.find(c => c.status === 'failed');
    assert.ok(failedCall, 'Status must transition to failed on QA error');
  });

  it('Test 9: SOP gap — status failed, no API call made', async () => {
    driveHolder.searchSkillsResult = {
      results: [],
      gap: true,
      query: 'ad_copy',
      channel: 'paid_social',
    };

    await assembleContext(9, 42, 'paid_social', 'ad_copy');

    assert.strictEqual(anthropicHolder.callCount, 0, 'Anthropic API must NOT be called when gap=true');
    assert.strictEqual(taskRunsHolder.updateOutputCalls.length, 0, 'No output stored when gap=true');
    const failedCall = taskRunsHolder.updateStatusCalls.find(c => c.status === 'failed');
    assert.ok(failedCall, 'Status must be failed when gap=true');
  });

  it('Test 10: missing ANTHROPIC_API_KEY causes immediate throw', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    try {
      await assert.rejects(
        async () => assembleContext(10, 42, 'paid_social', 'ad_copy'),
        (err: Error) => {
          assert.ok(err.message.includes('ANTHROPIC_API_KEY'), 'Error must mention missing API key');
          return true;
        },
      );
    } finally {
      process.env.ANTHROPIC_API_KEY = 'test-api-key-mock';
    }

    assert.strictEqual(anthropicHolder.callCount, 0, 'API must not be called without key');
    assert.strictEqual(taskRunsHolder.updateOutputCalls.length, 0, 'No output stored without API key');
  });
});
