/**
 * Tests for the auto-task filter's action logic (with a fake Jev decision
 * function) and the on-call assignee resolver's name-collision handling.
 *
 * Run:
 *   node --test --import tsx/esm web/lib/asana/task-filter.test.ts
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

process.env.ASANA_WORKSPACE_GID ||= 'ws';
process.env.ASANA_API_KEY ||= 'test';

const { reviewActionItem, isClientSideOwner, buildState } = await import('./task-filter.js');
const { resolveAssigneeFromCall, resetUserCache } = await import('./assignee.js');

const invitees = [
  { name: 'Alfie Wakelin', email: 'alfie@vendodigital.co.uk' },
  { name: 'Alfie Lewis', email: 'alfie.lewis@vendodigital.co.uk' },
  { name: 'Helen Walker', email: 'helen@vendodigital.co.uk' },
  { name: 'Stuart Hames', email: 'stuart@veltuff.com' },
];
const ctx = { title: 'Veltuff weekly', clientName: 'Veltuff', summary: 'Discussed BF.', invitees };

const answer = (choice: string, confidence: number) => ({ type: 'choice' as const, choice, confidence, probabilities: {} });

describe('isClientSideOwner', () => {
  it('flags a non-Vendo email', () => {
    assert.equal(isClientSideOwner(invitees, 'Stuart', 'stuart@veltuff.com'), true);
  });
  it('flags a name that matches only an external invitee', () => {
    assert.equal(isClientSideOwner(invitees, 'Stuart Hames', undefined), true);
  });
  it('does not flag Vendo staff or unknown names', () => {
    assert.equal(isClientSideOwner(invitees, 'Helen Walker', undefined), false);
    assert.equal(isClientSideOwner(invitees, 'Helen Walker', 'helen@vendodigital.co.uk'), false);
    assert.equal(isClientSideOwner(invitees, 'Someone Else', undefined), false);
    assert.equal(isClientSideOwner(invitees, undefined, undefined), false);
  });
});

describe('reviewActionItem', () => {
  it('drops a client-side owner without calling Jev', async () => {
    let called = false;
    const r = await reviewActionItem(ctx, 'Send BF deck to Shaun', 'Stuart Hames', async () => {
      called = true;
      return {};
    });
    assert.equal(r.keep, false);
    assert.equal(r.reason, 'Owner is on the client side');
    assert.equal(called, false);
  });

  it('drops a confident client action or non-task', async () => {
    const r1 = await reviewActionItem(ctx, 'Email Alfie your number', undefined, async () => ({ kind: answer('client_action', 0.9) }));
    assert.equal(r1.keep, false);
    const r2 = await reviewActionItem(ctx, 'Think about TikTok', undefined, async () => ({ kind: answer('not_a_task', 0.85) }));
    assert.equal(r2.keep, false);
    assert.equal(r2.reason, 'Not a real task');
  });

  it('keeps low-confidence drops and real work', async () => {
    const r1 = await reviewActionItem(ctx, 'Maybe client sends logo', undefined, async () => ({ kind: answer('client_action', 0.6) }));
    assert.equal(r1.keep, true);
    const r2 = await reviewActionItem(ctx, 'Build BF campaign', undefined, async () => ({ kind: answer('vendo_work', 0.99) }));
    assert.equal(r2.keep, true);
  });

  it('fails open when Jev errors', async () => {
    const r = await reviewActionItem(ctx, 'Build BF campaign', undefined, async () => {
      throw new Error('timeout');
    });
    assert.equal(r.keep, true);
    assert.equal(r.kind, null);
  });

  it('returns a confident owner suggestion mapped back to the name', async () => {
    const r = await reviewActionItem(ctx, 'Send SEO report', undefined, async (_s, q) => {
      const keys = Object.keys((q.owner as { criteria: Record<string, string> }).criteria);
      const lewis = keys.find((k) => k.includes('alfie_lewis'))!;
      return { kind: answer('vendo_work', 0.95), owner: answer(lewis, 0.8) };
    });
    assert.equal(r.suggestedOwner, 'Alfie Lewis');
  });

  it('ignores a low-confidence owner suggestion', async () => {
    const r = await reviewActionItem(ctx, 'Send SEO report', undefined, async (_s, q) => {
      const keys = Object.keys((q.owner as { criteria: Record<string, string> }).criteria);
      return { kind: answer('vendo_work', 0.95), owner: answer(keys[0], 0.4) };
    });
    assert.equal(r.suggestedOwner, null);
  });

  it('scrubs emails and phone numbers from the state', () => {
    const s = buildState(ctx, 'Call 07700 900123 or email a@b.com', undefined);
    assert.ok(!s.includes('a@b.com'));
    assert.ok(!s.includes('07700 900123'));
    assert.ok(!s.includes('stuart@veltuff.com'));
  });
});

describe('resolveAssigneeFromCall — name collisions', () => {
  before(() => {
    resetUserCache();
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          data: [
            { gid: '1', name: 'Alfie Wakelin', email: 'alfie@vendodigital.co.uk' },
            { gid: '2', name: 'Alfie Lewis', email: 'alfie.lewis@vendodigital.co.uk' },
            { gid: '3', name: 'Helen Walker', email: 'helen@vendodigital.co.uk' },
          ],
        }),
      )) as typeof fetch;
  });

  it('leaves a shared first name unresolved when both are on the call', async () => {
    assert.equal(await resolveAssigneeFromCall(invitees, 'Alfie'), undefined);
  });

  it('still resolves full names and unique first names', async () => {
    assert.equal((await resolveAssigneeFromCall(invitees, 'Alfie Lewis'))?.gid, '2');
    assert.equal((await resolveAssigneeFromCall(invitees, 'Helen'))?.gid, '3');
  });

  it('resolves a first name when only one holder is on the call', async () => {
    const one = invitees.filter((i) => i.name !== 'Alfie Lewis');
    assert.equal((await resolveAssigneeFromCall(one, 'Alfie'))?.gid, '1');
  });
});
